/**
 * PowerCompute — i18n engine.
 *
 * Loaded after assets/i18n/en.js and assets/i18n/ar.js (both attach a
 * plain object to `window`), and before wallet.js on every page.
 *
 * Usage in markup:
 *   <span data-i18n="index.hero.badge">Testnet Active — Base Sepolia</span>
 *   <input data-i18n-placeholder="index.presale.ethPlaceholder" placeholder="ETH amount to contribute" />
 *   <meta data-i18n-content="index.description" content="...">
 *
 * The English text left in the HTML is the fallback/default — if a key is
 * missing from a dictionary (partial translation, typo, etc.) the English
 * text stays visible instead of the page showing a blank string or a raw
 * dot-path key, which would be a worse failure mode for a live dApp.
 *
 * Depends on: window.PC_I18N_EN, window.PC_I18N_AR (loaded first).
 */

const PC_LANG_STORAGE_KEY = "pc_lang";
const PC_SUPPORTED_LANGS = ["en", "ar"];

function pcGetDictionary(lang) {
  return lang === "ar" ? window.PC_I18N_AR : window.PC_I18N_EN;
}

/**
 * Resolve a dot-path key ("index.hero.badge") against a dictionary object.
 * Returns undefined if any segment is missing (caller falls back to the
 * existing HTML text in that case).
 */
function pcResolveKey(dict, path) {
  return path.split(".").reduce((acc, segment) => {
    return acc && typeof acc === "object" ? acc[segment] : undefined;
  }, dict);
}

/**
 * Translate a dot-path key against the CURRENTLY ACTIVE language, for use
 * from plain JS (dynamically-generated markup like news cards, toasts,
 * and the wallet picker/account menu built by wallet.js, where a static
 * data-i18n attribute in the HTML source isn't available because the
 * element doesn't exist until runtime). Falls back to `fallback` (or the
 * key itself) if the key is missing from the active dictionary.
 */
function pcT(key, fallback) {
  const dict = pcGetDictionary(pcGetLang());
  const value = pcResolveKey(dict, key);
  return typeof value === "string" ? value : (fallback !== undefined ? fallback : key);
}

function pcGetLang() {
  try {
    const stored = localStorage.getItem(PC_LANG_STORAGE_KEY);
    if (stored && PC_SUPPORTED_LANGS.includes(stored)) return stored;
  } catch (e) { /* storage unavailable, fall through to default */ }
  return "en";
}

function pcSetLang(lang) {
  if (!PC_SUPPORTED_LANGS.includes(lang)) return;
  try { localStorage.setItem(PC_LANG_STORAGE_KEY, lang); } catch (e) { /* ignore */ }
  pcApplyTranslations(lang);
}

/**
 * Apply every data-i18n / data-i18n-placeholder / data-i18n-content
 * attribute on the current page against the given language's dictionary,
 * and flip <html dir="rtl"|"ltr"> + swap the base font stack for Arabic.
 */
function pcApplyTranslations(lang) {
  const dict = pcGetDictionary(lang);
  const meta = (dict && dict.meta) || { dir: "ltr", langLabel: "EN", fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" };

  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", meta.dir);
  document.documentElement.classList.toggle("rtl", meta.dir === "rtl");
  document.body.style.fontFamily = meta.fontFamily;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const value = pcResolveKey(dict, key);
    if (typeof value === "string") el.textContent = value;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    const value = pcResolveKey(dict, key);
    if (typeof value === "string") el.setAttribute("placeholder", value);
  });

  document.querySelectorAll("[data-i18n-content]").forEach(el => {
    const key = el.getAttribute("data-i18n-content");
    const value = pcResolveKey(dict, key);
    if (typeof value === "string") el.setAttribute("content", value);
  });

  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    const value = pcResolveKey(dict, key);
    if (typeof value === "string") document.title = value;
  });

  // Update the language switcher's own label to show the CURRENT language
  // (tapping it opens a picker to switch to the OTHER one).
  document.querySelectorAll("[data-lang-current-label]").forEach(el => {
    el.textContent = meta.langLabel;
  });
  document.querySelectorAll("[data-lang-option]").forEach(el => {
    const optionLang = el.getAttribute("data-lang-option");
    el.classList.toggle("pc-lang-active", optionLang === lang);
  });

  if (window.pcRenderIcons) window.pcRenderIcons();

  // The wallet connect button's label is exclusively owned/managed by
  // wallet.js (it shows either "Connect Wallet" or the shortened live
  // address depending on connection state) rather than a static
  // data-i18n attribute, so re-run it here to pick up the new language's
  // "Connect Wallet" string when disconnected.
  if (window.pcUpdateWalletUI) window.pcUpdateWalletUI(!!(window.PC && window.PC.address));

  document.dispatchEvent(new CustomEvent("pc:langchange", { detail: { lang } }));
}

/**
 * Simple language switcher: a small pill button showing the current
 * language code, tapping it toggles directly between the two supported
 * languages (2-language toggle — no need for a full dropdown menu).
 */
function pcSetupLanguageSwitcher() {
  document.querySelectorAll("[data-lang-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = pcGetLang();
      const next = current === "en" ? "ar" : "en";
      pcSetLang(next);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  pcSetupLanguageSwitcher();
  pcApplyTranslations(pcGetLang());
});
