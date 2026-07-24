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

/**
 * Connect the browser wallet, switch to Base Sepolia if needed, and
 * instantiate contract handles for every configured contract.
 * Returns true on success, false otherwise.
 */
async function pcConnectWallet() {
  if (typeof window.ethereum === "undefined") {
    pcToast("No Web3 wallet detected. Install MetaMask, Coinbase Wallet, or Rabby.", "error");
    window.open("https://metamask.io/download/", "_blank");
    return false;
  }

  try {
    PC.provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    const accounts = await PC.provider.send("eth_requestAccounts", []);
    PC.address = accounts[0];
    PC.signer = PC.provider.getSigner();

    const network = await PC.provider.getNetwork();
    if (network.chainId !== POWERCOMPUTE_CONFIG.CHAIN_ID) {
      pcToast("Switching network to Base Sepolia testnet...");
      await pcSwitchToBaseSepolia();
      PC.provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      PC.signer = PC.provider.getSigner();
    }

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

    // Determine owner/admin status (checked against token contract owner()
    // since it's always configured first in the deployment order).
    PC.isOwner = false;
    if (PC.tokenContract) {
      try {
        const tokenOwner = await PC.tokenContract.owner();
        PC.isOwner = tokenOwner.toLowerCase() === PC.address.toLowerCase();
      } catch (e) { /* ignore */ }
    }

    PC.walletKind = "injected";
    pcUpdateWalletUI(true);
    pcToast(`Wallet connected: ${pcShorten(PC.address)}`, "success");

    window.ethereum.removeAllListeners && window.ethereum.removeAllListeners("accountsChanged");
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());

    PC.listeners.forEach(fn => fn());

    return true;
  } catch (err) {
    console.error(err);
    pcToast("Wallet connection was rejected or failed.", "error");
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
async function pcConnectWalletConnect() {
  if (!POWERCOMPUTE_CONFIG.walletConnectConfigured) {
    pcToast("WalletConnect is not configured. Get a free Project ID at cloud.reown.com and set WALLETCONNECT_PROJECT_ID in assets/js/config.js.", "error", 6500);
    return false;
  }

  try {
    pcToast("Loading WalletConnect...", "info", 6000);

    const { EthereumProvider } = await import("https://esm.sh/@walletconnect/ethereum-provider@2.11.0?bundle");

    const wcProvider = await EthereumProvider.init({
      projectId: POWERCOMPUTE_CONFIG.WALLETCONNECT_PROJECT_ID,
      chains: [POWERCOMPUTE_CONFIG.CHAIN_ID],
      showQrModal: true,
      rpcMap: { [POWERCOMPUTE_CONFIG.CHAIN_ID]: POWERCOMPUTE_CONFIG.CHAIN_PARAMS.rpcUrls[0] },
      metadata: {
        name: "PowerCompute",
        description: "Decentralized Energy-to-Compute Orchestration Protocol",
        url: window.location.origin,
        icons: []
      }
    });

    await wcProvider.enable();

    PC.wcProvider = wcProvider;
    PC.provider = new ethers.providers.Web3Provider(wcProvider);
    PC.signer = PC.provider.getSigner();
    const accounts = await PC.provider.listAccounts();
    PC.address = accounts[0];

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

    PC.isOwner = false;
    if (PC.tokenContract) {
      try {
        const tokenOwner = await PC.tokenContract.owner();
        PC.isOwner = tokenOwner.toLowerCase() === PC.address.toLowerCase();
      } catch (e) { /* ignore */ }
    }

    PC.walletKind = "walletconnect";
    pcUpdateWalletUI(true);
    pcToast(`WalletConnect connected: ${pcShorten(PC.address)}`, "success");

    wcProvider.on("accountsChanged", () => window.location.reload());
    wcProvider.on("chainChanged", () => window.location.reload());
    wcProvider.on("disconnect", () => window.location.reload());

    PC.listeners.forEach(fn => fn());

    return true;
  } catch (err) {
    console.error(err);
    pcToast("WalletConnect connection failed or was cancelled.", "error");
    return false;
  }
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
    connectBtns.forEach(btn => btn.classList.add('ring-2', 'ring-emerald-400'));
    statusEls.forEach(el => {
      el.textContent = `● Connected on Base Sepolia — ${PC.address}`;
      el.classList.add('text-emerald-glow');
    });
  } else {
    labelEls.forEach(el => { el.textContent = 'Connect Wallet'; });
    statusEls.forEach(el => { el.textContent = ""; });
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
  // If already connected, clicking "Connect Wallet" again is a no-op —
  // there's nothing to pick between once a session is active.
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

  // A single data-connect-wallet button now opens the picker sheet, which
  // in turn calls pcConnectWallet() or pcConnectWalletConnect() based on
  // the user's choice. (data-connect-walletconnect is still supported for
  // any custom button that wants to skip the picker and go straight to
  // WalletConnect, but no page ships one anymore by default.)
  document.querySelectorAll('[data-connect-wallet]').forEach(btn => {
    btn.addEventListener('click', pcOpenWalletPicker);
  });
  document.querySelectorAll('[data-connect-walletconnect]').forEach(btn => {
    btn.addEventListener('click', pcConnectWalletConnect);
  });
});
