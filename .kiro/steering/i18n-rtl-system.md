# i18n / RTL System — PowerCompute

This project ships bilingual **English / Modern Standard Arabic (RTL)**
support with zero build step. Read this before touching any translation,
language-switcher, or RTL-related code.

## File map

| File | Role |
|---|---|
| `assets/i18n/en.js` | `window.PC_I18N_EN` — English dictionary, dot-path keys (e.g. `"index.hero.badge"`) |
| `assets/i18n/ar.js` | `window.PC_I18N_AR` — Arabic dictionary, **identical key structure** to en.js |
| `assets/js/i18n.js` | Engine: `pcGetLang`/`pcSetLang` (localStorage key `pc_lang`), `pcApplyTranslations()`, `pcT(key, fallback)`, `pcSetupLanguageSwitcher()` |
| `assets/css/style.css` | `html.rtl` block — RTL logical-property overrides (search `RTL SUPPORT` comment header) |

**Why plain `.js` globals, not `.json` + `fetch`:** avoids CORS/MIME-type
failures when a page is opened directly from disk or from certain static
hosts. This project has zero build step — keep it that way.

## Key rules — do not break these

1. **Never rename or remove a dictionary key** — only edit the string
   value. A renamed/removed key silently falls back to the English text
   still sitting inline in the HTML (the safe failure mode), it does not
   error, so a rename is easy to miss.
2. **`en.js` and `ar.js` must always have the exact same key structure.**
   Before committing a dictionary change, run:
   ```bash
   node --check assets/i18n/en.js && node --check assets/i18n/ar.js
   ```
3. **Never put HTML markup inside a translated string.** `data-i18n` sets
   `el.textContent`, not `innerHTML`. If a sentence needs a styled/linked
   span in the middle (e.g. a highlighted `$PWR`), split the dictionary
   entry into `xxxPre` / `xxxMid` / `xxxPost` keys and keep the markup in
   the HTML between separate `<span data-i18n="...">` tags — see
   `index.hero.subtitlePre` for the pattern.
4. **`data-wallet-label` spans never get `data-i18n`.** That text is
   exclusively owned by `wallet.js` (shows the connected address or the
   translated "Connect Wallet" string via `pcT('common.connectWallet', ...)`).
   Adding `data-i18n` there would fight `wallet.js` and reset a connected
   wallet's address display back to "Connect Wallet" on every language
   switch.
5. **Dynamically-built DOM** (news cards, wallet picker/account menu,
   toasts — anything injected via `innerHTML` after page load) must use
   `pcT('dot.path.key', 'English fallback')` instead of a static
   `data-i18n` attribute, since the element doesn't exist in the HTML
   source for the engine to walk on load.
6. **Icons, `<canvas>` elements, and `.mono` content stay LTR always**,
   even on the Arabic/RTL page — see the exclusions in the `html.rtl`
   block in `style.css`. Never remove these exclusions; a mirrored chart
   axis or a right-to-left hex address is unreadable.
7. **Translation scope is intentionally uneven across pages** —
   `index.html` is fully translated (~140 keys); `dashboard.html`,
   `governance.html`, `leaderboard.html`, `admin.html` only have
   nav + title + page-header translated (`common.nav.*`,
   `common.footer.*`, `pages.<page>.*`). This was a deliberate
   scope-reduction decision, not an oversight — extend it incrementally
   using the same `data-i18n` pattern if/when asked to go deeper on those
   pages.

## Adding a new language

1. Copy `assets/i18n/ar.js` → `assets/i18n/<code>.js`, translate every
   string, **keep the exact same key nesting/names**.
2. Set `meta.dir` (`"ltr"`/`"rtl"`), `meta.langLabel` (switcher button
   text, e.g. `"FR"`), `meta.fontFamily` (add a matching Google Fonts
   `<link>` to every HTML page's `<head>` if it's a new font family).
3. In `assets/js/i18n.js`: add the code to `PC_SUPPORTED_LANGS` and teach
   `pcGetDictionary(lang)` to return the new `window.PC_I18N_<CODE>`.
4. Add `<script src="./assets/i18n/<code>.js"></script>` to every HTML
   page's `<head>`, alongside the existing `en.js`/`ar.js` tags, **before**
   `i18n.js`.
5. Beyond 2 languages, consider swapping the single toggle button for a
   dropdown using `[data-lang-option]` elements (the active-state class
   is already managed by `pcApplyTranslations()`).

## Verification checklist before committing an i18n/RTL change

Run this after any change to dictionaries, `data-i18n*` attributes, or
`i18n.js`/`wallet.js`:

```bash
# JS syntax
node --check assets/i18n/en.js
node --check assets/i18n/ar.js
node --check assets/js/i18n.js
node --check assets/js/wallet.js

# Every data-i18n / data-i18n-placeholder / data-i18n-content / data-i18n-title
# key referenced in any HTML file must resolve to a string in BOTH dictionaries.
# (Write a small Node script: eval both dict files into a fake `window`,
#  regex every *.html for the four attributes, dot-path-resolve each key
#  against both dictionaries, and fail loudly on any miss.)
```

Full EN/AR key-resolution + HTML tag-balance + `getElementById`
cross-reference checks were run across all 5 pages when this system was
built — repeat that pattern (not just a visual smoke test) for any future
i18n change before considering it done.
