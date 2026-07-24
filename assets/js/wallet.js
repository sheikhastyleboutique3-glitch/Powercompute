/* ==========================================================================
   POWERCOMPUTE — SHARED WALLET / CHAIN UTILITIES
   Ethers.js v5 wallet connection, network switching, formatting helpers,
   and a toast notification system shared by index.html, dashboard.html,
   and admin.html.

   Depends on: ethers.js v5 (global `ethers`), lucide (global `lucide`),
   and assets/js/config.js being loaded first (global `POWERCOMPUTE_CONFIG`,
   `PWR_TOKEN_ABI`, `NODE_REGISTRY_ABI`, `PRESALE_ABI`).
   ========================================================================== */

const PC = {
  provider: null,
  signer: null,
  address: null,
  tokenContract: null,
  nodeRegistryContract: null,
  presaleContract: null,
  announcementsContract: null,
  timelockContract: null,
  vestingContract: null,
  governorContract: null,
  isOwner: false,
  walletKind: null, // "injected" | "walletconnect"
  wcProvider: null, // raw WalletConnect EthereumProvider instance, if connected via WC
  listeners: []
};

/* -------------------------------------------------------------------------
   Toast notifications
   ------------------------------------------------------------------------- */
function pcToast(message, variant = "info", duration = 4200) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'fixed top-5 right-5 z-[100] hidden max-w-sm';
    toast.innerHTML = `
      <div class="glass glass-border-glow rounded-xl px-4 py-3 shadow-glow-emerald flex items-start gap-3">
        <i data-lucide="info" class="w-5 h-5 text-emerald-glow mt-0.5 shrink-0" id="toast-icon"></i>
        <p id="toast-msg" class="text-sm text-slate-200"></p>
      </div>`;
    document.body.appendChild(toast);
  }
  const msg = document.getElementById('toast-msg');
  const icon = document.getElementById('toast-icon');
  const iconName = variant === "error" ? "alert-triangle" : variant === "success" ? "check-circle-2" : "info";
  msg.textContent = message;
  if (icon) {
    icon.setAttribute('data-lucide', iconName);
    icon.className = `w-5 h-5 mt-0.5 shrink-0 ${variant === 'error' ? 'text-red-400' : variant === 'success' ? 'text-emerald-glow' : 'text-cyan-glow'}`;
  }
  toast.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
  clearTimeout(window.__pcToastTimer);
  window.__pcToastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

/* -------------------------------------------------------------------------
   Formatting helpers
   ------------------------------------------------------------------------- */
function pcShorten(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function pcFmtToken(rawBigNumber, decimals = 18, fractionDigits = 2) {
  try {
    return parseFloat(ethers.utils.formatUnits(rawBigNumber, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits
    });
  } catch (e) {
    return "0";
  }
}

function pcFmtEth(rawBigNumber, fractionDigits = 4) {
  try {
    return parseFloat(ethers.utils.formatEther(rawBigNumber)).toFixed(fractionDigits);
  } catch (e) {
    return "0.0000";
  }
}

function pcFmtDate(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n) return "--";
  return new Date(n * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/* -------------------------------------------------------------------------
   Wallet connection
   ------------------------------------------------------------------------- */
async function pcSwitchToBaseSepolia() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POWERCOMPUTE_CONFIG.CHAIN_ID_HEX }]
    });
  } catch (switchError) {
    if (switchError && switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [POWERCOMPUTE_CONFIG.CHAIN_PARAMS]
        });
      } catch (addError) {
        pcToast("Could not add Base Sepolia network automatically. Please add it manually.", "error");
      }
    }
  }
}

/* -------------------------------------------------------------------------
   Connection persistence — lets the wallet survive navigation between
   pages. Since this dApp has no SPA router (every page is a full HTML
   file/full page load), PC's in-memory state is wiped on every navigation
   by definition. Persisting just WHICH connection method was last used
   (never any keys/secrets — those live in the wallet app itself) lets us
   silently re-establish the same connection on the next page load instead
   of making the user reconnect every time they click a nav link.
   ------------------------------------------------------------------------- */
const PC_WALLET_KIND_STORAGE_KEY = "pc_wallet_kind";

function pcPersistWalletKind(kind) {
  try { localStorage.setItem(PC_WALLET_KIND_STORAGE_KEY, kind); } catch (e) { /* storage unavailable, ignore */ }
}
function pcClearPersistedWalletKind() {
  try { localStorage.removeItem(PC_WALLET_KIND_STORAGE_KEY); } catch (e) { /* ignore */ }
}
function pcGetPersistedWalletKind() {
  try { return localStorage.getItem(PC_WALLET_KIND_STORAGE_KEY); } catch (e) { return null; }
}

/**
 * Instantiate every configured contract handle against the current
 * PC.signer. Shared by both connection paths (injected + WalletConnect)
 * so they can't drift out of sync with each other.
 */
function _pcInstantiateContracts() {
  if (POWERCOMPUTE_CONFIG.tokenConfigured) {
    PC.tokenContract = new ethers.Contract(POWERCOMPUTE_CONFIG.TOKEN_ADDRESS, PWR_TOKEN_ABI, PC.signer);
  }
  if (POWERCOMPUTE_CONFIG.nodeRegistryConfigured) {
    PC.nodeRegistryContract = new ethers.Contract(POWERCOMPUTE_CONFIG.NODE_REGISTRY_ADDRESS, NODE_REGISTRY_ABI, PC.signer);
  }
  if (POWERCOMPUTE_CONFIG.presaleConfigured) {
    PC.presaleContract = new ethers.Contract(POWERCOMPUTE_CONFIG.PRESALE_ADDRESS, PRESALE_ABI, PC.signer);
  }
  if (POWERCOMPUTE_CONFIG.announcementsConfigured) {
    PC.announcementsContract = new ethers.Contract(POWERCOMPUTE_CONFIG.ANNOUNCEMENTS_ADDRESS, ANNOUNCEMENTS_ABI, PC.signer);
  }
  if (POWERCOMPUTE_CONFIG.timelockConfigured) {
    PC.timelockContract = new ethers.Contract(POWERCOMPUTE_CONFIG.TIMELOCK_ADDRESS, TIMELOCK_ABI, PC.signer);
  }
  if (POWERCOMPUTE_CONFIG.vestingConfigured) {
    PC.vestingContract = new ethers.Contract(POWERCOMPUTE_CONFIG.VESTING_ADDRESS, VESTING_ABI, PC.signer);
  }
  if (POWERCOMPUTE_CONFIG.governorConfigured) {
    PC.governorContract = new ethers.Contract(POWERCOMPUTE_CONFIG.GOVERNOR_ADDRESS, GOVERNOR_ABI, PC.signer);
  }
}

/**
 * Determine owner/admin status against the token contract's owner().
 */
async function _pcCheckOwnership() {
  PC.isOwner = false;
  if (!PC.tokenContract || !PC.address) return;
  try {
    const tokenOwner = await PC.tokenContract.owner();
    PC.isOwner = tokenOwner.toLowerCase() === PC.address.toLowerCase();
  } catch (e) { /* ignore */ }
}

/**
 * Connect the browser wallet, switch to Base Sepolia if needed, and
 * instantiate contract handles for every configured contract.
 *
 * @param {{silent?: boolean}} opts — when `silent: true` (used for
 *        auto-reconnect on page load), this uses `eth_accounts` (never
 *        prompts the wallet) instead of `eth_requestAccounts` (always
 *        prompts), and suppresses toasts/popups so navigating between
 *        pages doesn't repeatedly interrupt the user.
 * Returns true on success, false otherwise.
 */
async function pcConnectWallet(opts = {}) {
  const silent = !!opts.silent;

  if (typeof window.ethereum === "undefined") {
    if (!silent) {
      pcToast("No Web3 wallet detected. Install MetaMask, Coinbase Wallet, or Rabby.", "error");
      window.open("https://metamask.io/download/", "_blank");
    }
    return false;
  }

  try {
    PC.provider = new ethers.providers.Web3Provider(window.ethereum, "any");

    let accounts;
    if (silent) {
      // eth_accounts never prompts — returns [] if the site was never
      // previously authorized (or the user revoked access), so this is
      // safe to call automatically on every page load.
      accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (!accounts || accounts.length === 0) return false;
    } else {
      accounts = await PC.provider.send("eth_requestAccounts", []);
    }

    PC.address = accounts[0];
    PC.signer = PC.provider.getSigner();

    const network = await PC.provider.getNetwork();
    if (network.chainId !== POWERCOMPUTE_CONFIG.CHAIN_ID) {
      if (silent) {
        // Don't force a network-switch prompt during a silent background
        // reconnect — just warn; any write action will still correctly
        // fail/prompt via pcRequire()'s normal flow.
        pcToast("Connected wallet is on the wrong network. Switch to Base Sepolia to use all features.", "error");
      } else {
        pcToast("Switching network to Base Sepolia testnet...");
        await pcSwitchToBaseSepolia();
        PC.provider = new ethers.providers.Web3Provider(window.ethereum, "any");
        PC.signer = PC.provider.getSigner();
      }
    }

    _pcInstantiateContracts();
    await _pcCheckOwnership();

    PC.walletKind = "injected";
    pcPersistWalletKind("injected");
    pcUpdateWalletUI(true);
    if (!silent) pcToast(`Wallet connected: ${pcShorten(PC.address)}`, "success");

    window.ethereum.removeAllListeners && window.ethereum.removeAllListeners("accountsChanged");
    window.ethereum.on("accountsChanged", (accs) => {
      if (!accs || accs.length === 0) {
        // The wallet itself revoked/disconnected access to this site.
        pcDisconnectWallet();
      } else {
        window.location.reload();
      }
    });
    window.ethereum.on("chainChanged", () => window.location.reload());

    PC.listeners.forEach(fn => fn());

    return true;
  } catch (err) {
    console.error(err);
    if (!silent) pcToast("Wallet connection was rejected or failed.", "error");
    return false;
  }
}

/* -------------------------------------------------------------------------
   WalletConnect v2 (mobile wallet support)

   Loaded on-demand via a dynamic ESM import from esm.sh, which bundles the
   CJS-only @walletconnect packages into a browser-ready module at request
   time — there is no official pre-bundled UMD/CDN build of WalletConnect
   v2 (the old web3modal@1.x + walletconnect/web3-provider@1.x CDN scripts
   you'll find in older tutorials are WalletConnect v1, whose relay
   protocol was shut down in June 2023 and no longer connects to anything).

   Requires a free WALLETCONNECT_PROJECT_ID from https://cloud.reown.com
   set in assets/js/config.js. Without it, the WalletConnect button shows
   a toast pointing you to get one instead of silently failing.
   ------------------------------------------------------------------------- */
async function pcConnectWalletConnect(opts = {}) {
  const silent = !!opts.silent;

  if (!POWERCOMPUTE_CONFIG.walletConnectConfigured) {
    if (!silent) {
      pcToast("WalletConnect is not configured. Get a free Project ID at cloud.reown.com and set WALLETCONNECT_PROJECT_ID in assets/js/config.js.", "error", 6500);
    }
    return false;
  }

  try {
    if (!silent) pcToast("Loading WalletConnect...", "info", 6000);

    const { EthereumProvider } = await import("https://esm.sh/@walletconnect/ethereum-provider@2.11.0?bundle");

    const wcProvider = await EthereumProvider.init({
      projectId: POWERCOMPUTE_CONFIG.WALLETCONNECT_PROJECT_ID,
      chains: [POWERCOMPUTE_CONFIG.CHAIN_ID],
      showQrModal: !silent,
      rpcMap: { [POWERCOMPUTE_CONFIG.CHAIN_ID]: POWERCOMPUTE_CONFIG.CHAIN_PARAMS.rpcUrls[0] },
      metadata: {
        name: "PowerCompute",
        description: "Decentralized Energy-to-Compute Orchestration Protocol",
        url: window.location.origin,
        icons: []
      }
    });

    if (silent) {
      // On a silent auto-reconnect, only proceed if WalletConnect already
      // has a live session from a previous visit (its own internal
      // storage) — never pop the QR modal automatically.
      if (!wcProvider.session) return false;
    } else {
      await wcProvider.enable();
    }

    PC.wcProvider = wcProvider;
    PC.provider = new ethers.providers.Web3Provider(wcProvider);
    PC.signer = PC.provider.getSigner();
    const accounts = await PC.provider.listAccounts();
    if (!accounts || accounts.length === 0) return false;
    PC.address = accounts[0];

    _pcInstantiateContracts();
    await _pcCheckOwnership();

    PC.walletKind = "walletconnect";
    pcPersistWalletKind("walletconnect");
    pcUpdateWalletUI(true);
    if (!silent) pcToast(`WalletConnect connected: ${pcShorten(PC.address)}`, "success");

    wcProvider.on("accountsChanged", () => window.location.reload());
    wcProvider.on("chainChanged", () => window.location.reload());
    wcProvider.on("disconnect", () => pcDisconnectWallet());

    PC.listeners.forEach(fn => fn());

    return true;
  } catch (err) {
    console.error(err);
    if (!silent) pcToast("WalletConnect connection failed or was cancelled.", "error");
    return false;
  }
}

/**
 * Disconnect the current wallet session and reset all PC state. Reloads
 * the page afterward so every UI element (balances, admin gate, etc.)
 * cleanly resets to its disconnected state rather than needing every
 * page's own script to separately handle a "disconnected" transition.
 */
async function pcDisconnectWallet() {
  try {
    if (PC.walletKind === "walletconnect" && PC.wcProvider && typeof PC.wcProvider.disconnect === "function") {
      await PC.wcProvider.disconnect();
    }
  } catch (e) {
    console.error("Error during WalletConnect disconnect:", e);
  }

  PC.provider = null;
  PC.signer = null;
  PC.address = null;
  PC.tokenContract = null;
  PC.nodeRegistryContract = null;
  PC.presaleContract = null;
  PC.announcementsContract = null;
  PC.timelockContract = null;
  PC.vestingContract = null;
  PC.governorContract = null;
  PC.isOwner = false;
  PC.walletKind = null;
  PC.wcProvider = null;

  pcClearPersistedWalletKind();
  pcToast("Wallet disconnected.", "info");

  window.location.reload();
}

/**
 * Register a callback to run right after a successful wallet connection
 * (e.g. to trigger a page's own balance-refresh routine).
 */
function pcOnConnect(fn) {
  PC.listeners.push(fn);
}

function pcUpdateWalletUI(connected) {
  const labelEls = document.querySelectorAll('[data-wallet-label]');
  const statusEls = document.querySelectorAll('[data-wallet-status]');
  const connectBtns = document.querySelectorAll('[data-connect-wallet]');

  if (connected && PC.address) {
    labelEls.forEach(el => { el.textContent = pcShorten(PC.address); });
    connectBtns.forEach(btn => {
      btn.classList.add('ring-2', 'ring-emerald-400');
      // Once connected, the same button opens the account menu (with
      // Disconnect) instead of re-opening the connect-method picker.
      btn.dataset.pcConnected = "true";
    });
    statusEls.forEach(el => {
      el.textContent = `● Connected on Base Sepolia — ${PC.address}`;
      el.classList.add('text-emerald-glow');
    });
  } else {
    labelEls.forEach(el => { el.textContent = 'Connect Wallet'; });
    connectBtns.forEach(btn => {
      btn.classList.remove('ring-2', 'ring-emerald-400');
      delete btn.dataset.pcConnected;
    });
    statusEls.forEach(el => { el.textContent = ""; });
  }
}

/* -------------------------------------------------------------------------
   Account menu — shown instead of the connect picker once a wallet is
   already connected. Gives the user a visible way to see their full
   address, copy it, and disconnect (previously missing entirely).
   ------------------------------------------------------------------------- */
function pcBuildAccountMenu() {
  if (document.getElementById('pc-account-menu')) return;

  const overlay = document.createElement('div');
  overlay.id = 'pc-account-menu';
  overlay.className = 'fixed inset-0 z-[110] hidden items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0';
  overlay.innerHTML = `
    <div class="glass glass-border-glow rounded-2xl w-full sm:w-96 p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-base flex items-center gap-2">
          <i data-lucide="wallet" class="w-4 h-4 text-emerald-glow"></i> Wallet
        </h3>
        <button id="pc-account-menu-close" class="text-slate-500 hover:text-slate-300">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="glass rounded-xl p-3 mb-3">
        <p class="text-[11px] text-slate-500 mb-1">Connected address</p>
        <p class="mono text-sm font-semibold break-all" id="pc-account-menu-address">--</p>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <button id="pc-account-menu-copy" class="flex items-center justify-center gap-2 rounded-lg glass glass-border-glow px-3 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-glow transition">
          <i data-lucide="copy" class="w-4 h-4"></i> Copy
        </button>
        <a id="pc-account-menu-explorer" href="#" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center gap-2 rounded-lg glass glass-border-glow px-3 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-glow transition">
          <i data-lucide="external-link" class="w-4 h-4"></i> Explorer
        </a>
      </div>
      <button id="pc-account-menu-disconnect" class="w-full flex items-center justify-center gap-2 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/25 transition">
        <i data-lucide="log-out" class="w-4 h-4"></i> Disconnect
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const hide = () => overlay.classList.add('hidden');

  document.getElementById('pc-account-menu-close').addEventListener('click', hide);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hide(); });

  document.getElementById('pc-account-menu-copy').addEventListener('click', () => {
    if (!PC.address) return;
    navigator.clipboard.writeText(PC.address)
      .then(() => pcToast("Address copied to clipboard!", "success"))
      .catch(() => pcToast("Could not copy automatically — address shown above.", "info"));
  });

  document.getElementById('pc-account-menu-disconnect').addEventListener('click', () => {
    hide();
    pcDisconnectWallet();
  });

  pcRenderIcons();
}

function pcOpenAccountMenu() {
  if (!PC.address) return;

  pcBuildAccountMenu();
  document.getElementById('pc-account-menu-address').textContent = PC.address;
  const explorerLink = document.getElementById('pc-account-menu-explorer');
  const baseExplorer = (POWERCOMPUTE_CONFIG.CHAIN_PARAMS.blockExplorerUrls || [])[0];
  explorerLink.href = baseExplorer ? `${baseExplorer}/address/${PC.address}` : "#";

  const overlay = document.getElementById('pc-account-menu');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  pcRenderIcons();
}

/**
 * Silently attempt to restore a previous session on page load (injected
 * or WalletConnect, whichever was used last), without ever prompting the
 * wallet or popping a QR modal. This is what actually fixes "it
 * disconnects every time I navigate to another page" — each page load is
 * a fresh script execution with empty PC state, so we re-establish the
 * same connection quietly before the user notices anything changed.
 */
async function pcAutoReconnect() {
  const lastKind = pcGetPersistedWalletKind();
  if (!lastKind) return;

  if (lastKind === "injected") {
    await pcConnectWallet({ silent: true });
  } else if (lastKind === "walletconnect") {
    await pcConnectWalletConnect({ silent: true });
  }
}

/**
 * Requires an active wallet connection + the given contract handle to be
 * configured. Shows a toast and returns false if not ready.
 */
function pcRequire(contractHandle, contractLabel) {
  if (!PC.signer || !PC.address) {
    pcToast("Please connect your wallet first.", "error");
    return false;
  }
  if (!contractHandle) {
    pcToast(`${contractLabel} contract address is not configured yet. Deploy it and update assets/js/config.js.`, "error");
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------
   Wallet picker — single "Connect Wallet" button opens this sheet so the
   user picks HOW to connect (browser extension vs. WalletConnect QR),
   instead of cluttering every page with two separate buttons. Built once
   and appended to <body> on first use, then just shown/hidden afterward.
   ------------------------------------------------------------------------- */
function pcBuildWalletPicker() {
  if (document.getElementById('pc-wallet-picker')) return;

  const overlay = document.createElement('div');
  overlay.id = 'pc-wallet-picker';
  overlay.className = 'fixed inset-0 z-[110] hidden items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0';
  overlay.innerHTML = `
    <div class="glass glass-border-glow rounded-2xl w-full sm:w-96 p-5 max-h-[80vh] overflow-y-auto scrollbar-thin">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-base flex items-center gap-2">
          <i data-lucide="wallet" class="w-4 h-4 text-emerald-glow"></i> Connect a Wallet
        </h3>
        <button id="pc-wallet-picker-close" class="text-slate-500 hover:text-slate-300">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="space-y-2">
        <button id="pc-picker-injected" class="w-full flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3.5 font-semibold text-charcoal hover:brightness-110 transition text-left">
          <i data-lucide="chrome" class="w-5 h-5 shrink-0"></i>
          <span>
            <span class="block text-sm">Browser Extension</span>
            <span class="block text-xs opacity-80">MetaMask, Coinbase Wallet, Rabby, etc.</span>
          </span>
        </button>
        <button id="pc-picker-walletconnect" class="w-full flex items-center gap-3 rounded-xl glass glass-border-glow px-4 py-3.5 font-semibold text-slate-100 hover:border-cyan-glow transition text-left">
          <i data-lucide="qr-code" class="w-5 h-5 shrink-0 text-cyan-glow"></i>
          <span>
            <span class="block text-sm">WalletConnect</span>
            <span class="block text-xs text-slate-400">Scan a QR code with any mobile wallet app</span>
          </span>
        </button>
      </div>
      <p class="text-[11px] text-slate-500 mt-4 text-center">On mobile without a wallet browser extension, choose WalletConnect.</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const hide = () => overlay.classList.add('hidden');

  document.getElementById('pc-wallet-picker-close').addEventListener('click', hide);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hide(); });

  document.getElementById('pc-picker-injected').addEventListener('click', async () => {
    hide();
    await pcConnectWallet();
  });
  document.getElementById('pc-picker-walletconnect').addEventListener('click', async () => {
    hide();
    await pcConnectWalletConnect();
  });

  pcRenderIcons();
}

function pcOpenWalletPicker() {
  // Guard kept for safety even though the bootstrap click handler already
  // routes to pcOpenAccountMenu() once connected — if already connected,
  // there's nothing to pick between.
  if (PC.address) return;

  pcBuildWalletPicker();
  const overlay = document.getElementById('pc-wallet-picker');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  pcRenderIcons();
}

/* -------------------------------------------------------------------------
   Shared page chrome: mobile menu, icon re-render helper
   ------------------------------------------------------------------------- */
function pcSetupMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => menu.classList.toggle('hidden'));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.add('hidden')));
}

function pcRenderIcons() {
  if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  pcRenderIcons();
  pcSetupMobileMenu();

  // A single data-connect-wallet button opens the connect-method picker
  // when NOT connected, or the account menu (address + Disconnect) when
  // already connected — so the same button always does something useful
  // instead of being a no-op once a session exists.
  document.querySelectorAll('[data-connect-wallet]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (PC.address) {
        pcOpenAccountMenu();
      } else {
        pcOpenWalletPicker();
      }
    });
  });
  document.querySelectorAll('[data-connect-walletconnect]').forEach(btn => {
    btn.addEventListener('click', pcConnectWalletConnect);
  });

  // Attempt a silent reconnect using whichever method was used last, so
  // navigating to a different page (a full page load, since this dApp has
  // no SPA router) doesn't force the user to reconnect every single time.
  pcAutoReconnect();
});
