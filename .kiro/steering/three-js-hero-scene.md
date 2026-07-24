# 3D Animated Hero (Three.js) — PowerCompute

`index.html`'s hero section renders an animated Three.js scene (compute
core, orbiting staking nodes, solar panel, wind turbine, energy particle
streams, starfield) behind the hero text. Read this before touching
`assets/js/hero3d.js` or the hero markup in `index.html`.

## How it's loaded (no build step — do not "fix" this with npm)

Three.js is resolved via a browser-native **import map** in `index.html`'s
`<head>`, pinned to a specific version on the `unpkg` CDN:
```html
<script type="importmap">
  { "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }
</script>
```
`assets/js/hero3d.js` is loaded as an ES module:
```html
<script type="module" src="./assets/js/hero3d.js"></script>
```
Inside that file, `import * as THREE from "three"` resolves through the
import map above. **This project has zero npm/bundler dependency for the
dApp itself — keep the 3D hero the same way.** If Three.js needs a version
bump, only the version string in the importmap URL changes.

## File/DOM contract

- Mount point: `<div id="pc-hero-3d-container" aria-hidden="true"></div>`
  inside `.pc-hero-3d-scope` (a `.relative` wrapper sized via
  `min-height` in CSS), followed by `<div class="pc-hero-3d-scrim"></div>`,
  followed by `.pc-hero-content` (the actual text/CTAs).
- `pcInitHero3D()` in `hero3d.js` looks up `#pc-hero-3d-container` by ID
  and does nothing if it isn't found — safe to leave the script tag on
  any page; it only activates where the container exists.
- z-index contract (all in `style.css`): container `z-index:0` <
  scrim `z-index:1` < content `z-index:2`.

## Fallback logic — do not remove or reorder these checks

Before touching Three.js/WebGL at all, in this order:
1. `prefers-reduced-motion: reduce` → skip.
2. No WebGL context available (`canvas.getContext("webgl")` probe) → skip.
3. `import("three")` throws (CDN unreachable/blocked) → caught, skip.

In every skip case, a `<div class="pc-hero-3d-fallback">` (static
emerald/cyan radial-gradient glow, defined in `style.css`) is inserted
into the container instead. Never let a failure here throw an unhandled
error or leave the hero visually broken/empty.

## Theme colors

Every material in the scene references one of two constants at the top of
`pcInitHero3D()`:
```js
const EMERALD = 0x10b981; // matches --pc-emerald in style.css
const CYAN = 0x06b6d4;    // matches --pc-cyan in style.css
```
To re-theme the hero, change these two constants — do not hardcode new
hex colors on individual materials.

## Performance / responsiveness rules

- `IS_LOW_POWER = window.innerWidth < 768` at load time — reduces star
  count, particle-stream point count, and staking-node count, and caps
  `devicePixelRatio` at `1.5` instead of `2`. Any new heavy object added
  to the scene should also branch on this flag.
- `resize` listener updates camera aspect + renderer size — any new
  camera-dependent logic must go through `handleResize()`, not a
  one-off listener.
- `IntersectionObserver` + `visibilitychange` set an `isRendering` flag
  checked at the top of `animate()` — new per-frame work should also
  respect this flag rather than running unconditionally.

## Scroll-driven parallax

`scrollProgress` (0 = hero fully visible, 1 = hero fully scrolled past) is
computed from `#top`'s `getBoundingClientRect()` on a passive `scroll`
listener, and currently drives: core rotation speed, camera dolly/drift,
and canvas opacity fade. Any new scroll-reactive behavior should read from
this same `scrollProgress` variable rather than adding a second scroll
listener.

## Extending the scene

Every object is a named `THREE.Group`/`THREE.Mesh` local variable inside
`pcInitHero3D()` (`coreGroup`, `solarGroup`, `turbineGroup`,
`stakingNodes`, `energyStreams`, `stars`). To add something new: build it
the same way (geometry + material + optional group), `scene.add()` it,
and add its per-frame update inside `animate()` at the bottom of the
file. To mount an equivalent scene on another page, give that page's
markup an element with `id="pc-hero-3d-container"` and include the same
importmap + script tags — no changes to `hero3d.js` needed.

## Verification after any change here

```bash
cp assets/js/hero3d.js /tmp/hero3d_check.mjs && node --check /tmp/hero3d_check.mjs
```
(`.mjs` extension forces Node to parse it as an ES module, matching how
the browser will actually load it via `type="module"`.) Also re-validate
the importmap's JSON body and re-run the HTML div-balance / id
cross-reference checks if the hero markup itself changed.
