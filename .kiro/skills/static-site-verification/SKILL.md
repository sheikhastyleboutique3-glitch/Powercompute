---
name: static-site-verification
description: Verify a zero-build-step static HTML/JS/CSS site (no bundler, no npm required to run) after making edits — checks JS syntax, HTML tag balance, getElementById cross-references, inline <script> syntax, i18n dictionary key resolution across languages, and CSS brace balance. Use this whenever editing plain HTML/CSS/JS files directly (as opposed to a framework/build-tool project) and before telling the user changes are verified/done.
---

# Static Site Verification

A lightweight, tool-free (no npm install needed) verification pass for
projects that ship as plain HTML/CSS/JS with no bundler — e.g. this
PowerCompute repo, or any similar "just static files" project. Use these
checks instead of just eyeballing a diff before claiming edits are correct.

All checks below only need Python 3 and Node.js, both normally present
in the sandbox with zero extra installs.

## 1. JS syntax check (every touched .js file)

```bash
node --check path/to/file.js
```

For ES modules (files using `import`/`export`, loaded via
`<script type="module">`), copy to a `.mjs` extension first so Node
parses it correctly:

```bash
cp assets/js/some-module.js /tmp/check.mjs && node --check /tmp/check.mjs
```

For inline `<script>` blocks inside HTML, extract and check each one:

```bash
python3 - <<'EOF'
import re
for page in ['index.html', 'other.html']:
    html = open(page, encoding='utf-8').read()
    for i, s in enumerate(re.findall(r'<script>(.*?)</script>', html, re.DOTALL)):
        open(f'/tmp/chk_{page}_{i}.js', 'w', encoding='utf-8').write(s)
EOF
for f in /tmp/chk_*.js; do node --check "$f" || echo "FAIL: $f"; done
rm -f /tmp/chk_*.js
```

(This only catches syntax errors, not type errors — there is no
TypeScript/type-checking safety net on a plain-JS static site, so review
logic changes carefully by hand too.)

## 2. HTML tag balance

Catches mismatched/unclosed tags introduced by a `str_replace` edit that
didn't account for a tag spanning multiple replacements.

```bash
python3 - <<'EOF'
import re
pages = ['index.html']  # add every page touched
tags = ['div','section','header','footer','nav','button','span','p',
        'h1','h2','h3','label','a','ul','li','main']
for page in pages:
    html = open(page, encoding='utf-8').read()
    for tag in tags:
        opens = len(re.findall(r'<' + tag + r'(\s[^>]*)?>', html))
        closes = len(re.findall(r'</' + tag + r'>', html))
        if opens != closes:
            print(f"{page}: MISMATCH <{tag}> open={opens} close={closes}")
EOF
```

No output = all balanced. Re-run this after any structural HTML edit
(inserting/removing a wrapping div, restructuring a section, etc.).

## 3. getElementById cross-reference

Catches a `getElementById('some-id')` call left pointing at an id that
got renamed or removed during editing.

```bash
python3 - <<'EOF'
import re
pages = ['index.html']  # add every page touched
for page in pages:
    html = open(page, encoding='utf-8').read()
    ids_in_markup = set(re.findall(r'\bid="([^"]+)"', html))
    ids_referenced = set(re.findall(r"getElementById\('([^']+)'\)", html))
    missing = ids_referenced - ids_in_markup
    if missing:
        print(f"{page}: MISSING ids referenced by JS but absent from markup: {missing}")
EOF
```

No output = clean. Also works for `querySelector('#some-id')` patterns —
adjust the regex if the codebase uses that style instead.

## 4. i18n dictionary key resolution (if the project has translation dictionaries)

If the project uses dictionary files that attach a global object (e.g.
`window.PC_I18N_EN`) rather than fetched JSON, verify every
`data-i18n`/`data-i18n-placeholder`/`data-i18n-content`/`data-i18n-title`
key referenced anywhere in the HTML resolves to an actual string in
**every** language's dictionary — a typo'd or renamed key silently falls
back to the English text in the HTML rather than erroring, so this must
be checked programmatically, not visually.

```bash
node - <<'EOF'
const fs = require('fs');
global.window = {};
eval(fs.readFileSync('assets/i18n/en.js', 'utf8'));
eval(fs.readFileSync('assets/i18n/ar.js', 'utf8'));
// add more eval() lines here for additional languages
const dicts = { en: window.PC_I18N_EN, ar: window.PC_I18N_AR };

function resolve(dict, path) {
  return path.split('.').reduce((acc, seg) =>
    (acc && typeof acc === 'object') ? acc[seg] : undefined, dict);
}

const pages = ['index.html']; // add every page touched
let anyMissing = false;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const keys = new Set();
  for (const attr of ['data-i18n', 'data-i18n-placeholder', 'data-i18n-content', 'data-i18n-title']) {
    const re = new RegExp(attr + '="([^"]+)"', 'g');
    let m;
    while ((m = re.exec(html))) keys.add(m[1]);
  }
  for (const [lang, dict] of Object.entries(dicts)) {
    const missing = [...keys].filter(k => typeof resolve(dict, k) !== 'string');
    if (missing.length) { anyMissing = true; console.log(`${page} [${lang}]: MISSING`, missing); }
  }
}
if (!anyMissing) console.log('All i18n keys resolve in every language.');
EOF
```

## 5. CSS brace balance (sanity check, not a full linter)

```bash
python3 -c "
c = open('assets/css/style.css', encoding='utf-8').read()
o, cl = c.count('{'), c.count('}')
print('CSS braces:', o, cl, 'OK' if o==cl else 'MISMATCH')
"
```

## 6. Confirm unrelated systems weren't touched (e.g. smart contracts, backend)

If the repo has a non-static-site component that a build/test suite can't
be run against in this sandbox (blocked npm registry, no local DB, etc.),
prove it's unaffected via git instead of skipping verification silently:

```bash
git status --porcelain    # confirm zero changes under contracts/, test/, etc.
git diff --stat           # sanity-check the shape of the diff matches intent
```

State explicitly in your final summary which checks were run vs. which
were structurally provably-unaffected (via git diff) vs. genuinely
unverifiable in this environment (e.g. an npm-registry-gated test suite)
— never imply "verified" for something you could not actually check.

## When to use this skill

Run this full pass (steps 1-5, plus step 6 if relevant) before telling
the user a static HTML/CSS/JS change is complete and verified — not just
after the final edit, but any time enough edits have accumulated that a
visual read-through is no longer a reliable substitute for a mechanical
check.
