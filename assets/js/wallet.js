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
  isOwner: false,
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

    // Determine owner/admin status (checked against token contract owner()
    // since it's always configured first in the deployment order).
    PC.isOwner = false;
    if (PC.tokenContract) {
      try {
        const tokenOwner = await PC.tokenContract.owner();
        PC.isOwner = tokenOwner.toLowerCase() === PC.address.toLowerCase();
      } catch (e) { /* ignore */ }
    }

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
  const adminOnlyEls = document.querySelectorAll('[data-admin-only]');
  const connectBtns = document.querySelectorAll('[data-connect-wallet]');

  if (connected && PC.address) {
    labelEls.forEach(el => { el.textContent = pcShorten(PC.address); });
    connectBtns.forEach(btn => btn.classList.add('ring-2', 'ring-emerald-400'));
    statusEls.forEach(el => {
      el.textContent = `● Connected on Base Sepolia — ${PC.address}`;
      el.classList.add('text-emerald-glow');
    });
    adminOnlyEls.forEach(el => {
      el.classList.toggle('hidden', !PC.isOwner);
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

  document.querySelectorAll('[data-connect-wallet]').forEach(btn => {
    btn.addEventListener('click', pcConnectWallet);
  });
});
