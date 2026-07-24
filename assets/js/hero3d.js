/**
 * PowerCompute — animated 3D hero scene (index.html only).
 *
 * Loaded as `<script type="module" src="./assets/js/hero3d.js">`. Three.js
 * itself is resolved via the `<script type="importmap">` in index.html's
 * <head> (pinned to a specific version on the unpkg CDN) — no npm/build
 * step, consistent with the rest of this "just static files" project.
 *
 * Scene concept (matches the protocol's story): a glowing central
 * "compute core" (GPU/AI) receives energy routed in from a solar panel
 * and a wind turbine, carried by animated particle streams, while small
 * emissive "staking node" spheres orbit the core — all rendered in the
 * existing emerald (#10B981) / cyan (#06B6D4) theme against a starfield.
 *
 * Respects:
 *  - prefers-reduced-motion: skipped entirely, falls back to the static
 *    `.pc-hero-3d-fallback` gradient (already defined in style.css).
 *  - No WebGL support: same static fallback, detected via a throwaway
 *    canvas context probe before touching Three.js at all.
 *  - Scroll: camera + core react to scroll position (see hero3d-scroll.js
 *    hook wired in at the bottom of this file) for a parallax feel as the
 *    user scrolls past the hero.
 *  - Resize / mobile: full resize handling + a lower-poly/fewer-particles
 *    path on narrow viewports for performance (see IS_LOW_POWER below).
 *
 * Everything in this file is additive/self-contained — it only ever
 * touches the #pc-hero-3d-container element and never assumes anything
 * about the rest of the page beyond that ID existing.
 */

function pcHeroSupportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch (e) {
    return false;
  }
}

function pcHeroPrefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Shows the existing static gradient fallback (defined in style.css) when
 * the 3D scene can't/shouldn't run. This keeps the hero looking
 * intentional rather than empty for reduced-motion users, older browsers,
 * or environments without WebGL (e.g. some headless/CI contexts).
 */
function pcHeroShowFallback(container) {
  const fallback = document.createElement("div");
  fallback.className = "pc-hero-3d-fallback";
  container.appendChild(fallback);
}

async function pcInitHero3D() {
  const container = document.getElementById("pc-hero-3d-container");
  if (!container) return; // this page/section doesn't have a 3D hero mount point

  if (pcHeroPrefersReducedMotion() || !pcHeroSupportsWebGL()) {
    pcHeroShowFallback(container);
    return;
  }

  let THREE;
  try {
    THREE = await import("three");
  } catch (err) {
    console.warn("PowerCompute: Three.js failed to load from CDN, using static hero fallback.", err);
    pcHeroShowFallback(container);
    return;
  }

  // Fewer particles/lower geometry detail on small screens for performance
  // — re-evaluated on resize in case of an orientation change / responsive
  // breakpoint crossing, but the renderer/scene itself isn't rebuilt (only
  // pixel ratio + a couple of visual toggles react live).
  const IS_LOW_POWER = window.innerWidth < 768;

  const EMERALD = 0x10b981;
  const CYAN = 0x06b6d4;

  /* ---------------------------------------------------------------------
     Renderer / scene / camera
     --------------------------------------------------------------------- */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.1,
    100
  );
  camera.position.set(0, 0.6, 9);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_LOW_POWER ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0); // transparent — the page's own dark background shows through
  container.appendChild(renderer.domElement);

  /* ---------------------------------------------------------------------
     Lighting — mostly emissive materials carry the look, but a little
     ambient + a couple of colored point lights add depth/glow bounce.
     --------------------------------------------------------------------- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const emeraldLight = new THREE.PointLight(EMERALD, 8, 20);
  emeraldLight.position.set(-4, 2, 3);
  scene.add(emeraldLight);

  const cyanLight = new THREE.PointLight(CYAN, 8, 20);
  cyanLight.position.set(4, -1.5, 3);
  scene.add(cyanLight);

  /* ---------------------------------------------------------------------
     Starfield backdrop — a simple point cloud, subtly rotating.
     --------------------------------------------------------------------- */
  const STAR_COUNT = IS_LOW_POWER ? 250 : 600;
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const radius = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = radius * Math.cos(phi) - 10;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0x9fd8c9,
    size: 0.045,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  /* ---------------------------------------------------------------------
     Central compute core — the GPU/AI representation. An icosahedron
     "core" plus a slightly larger wireframe shell orbiting it at a
     different speed, both emissive, sitting at the scene origin.
     --------------------------------------------------------------------- */
  const coreGroup = new THREE.Group();

  const coreGeometry = new THREE.IcosahedronGeometry(1.15, 1);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x0e2a22,
    emissive: EMERALD,
    emissiveIntensity: 0.9,
    metalness: 0.6,
    roughness: 0.25,
    flatShading: true
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  coreGroup.add(core);

  const shellGeometry = new THREE.IcosahedronGeometry(1.65, 1);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: CYAN,
    wireframe: true,
    transparent: true,
    opacity: 0.35
  });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  coreGroup.add(shell);

  scene.add(coreGroup);

  /* ---------------------------------------------------------------------
     Orbiting staking nodes — small glowing spheres circling the core at
     staggered radii/speeds/inclinations, representing $PWR stakers
     participating in the network around the compute core.
     --------------------------------------------------------------------- */
  const NODE_COUNT = IS_LOW_POWER ? 5 : 8;
  const stakingNodes = [];
  const nodeGeometry = new THREE.SphereGeometry(0.11, 16, 16);

  for (let i = 0; i < NODE_COUNT; i++) {
    const isEmerald = i % 2 === 0;
    const nodeMaterial = new THREE.MeshStandardMaterial({
      color: isEmerald ? EMERALD : CYAN,
      emissive: isEmerald ? EMERALD : CYAN,
      emissiveIntensity: 1.4,
      metalness: 0.4,
      roughness: 0.3
    });
    const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
    stakingNodes.push({
      mesh: node,
      radius: 2.4 + Math.random() * 1.3,
      speed: 0.18 + Math.random() * 0.22,
      offset: Math.random() * Math.PI * 2,
      tilt: (Math.random() - 0.5) * 1.1
    });
    scene.add(node);
  }

  /* ---------------------------------------------------------------------
     Solar panel — a simple tilted grid of emissive-striped panels on
     the left side of the scene, feeding energy toward the core.
     --------------------------------------------------------------------- */
  const solarGroup = new THREE.Group();
  const panelFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x14202b, metalness: 0.5, roughness: 0.6 });
  const panelCellMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b3b32,
    emissive: EMERALD,
    emissiveIntensity: 0.45,
    metalness: 0.3,
    roughness: 0.4
  });

  const panelRows = 3, panelCols = 2;
  const cellSize = 0.34;
  for (let r = 0; r < panelRows; r++) {
    for (let c = 0; c < panelCols; c++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(cellSize, cellSize, 0.03), panelCellMaterial);
      cell.position.set(c * (cellSize + 0.03) - 0.2, r * (cellSize + 0.03) - 0.34, 0);
      solarGroup.add(cell);
    }
  }
  const panelFrame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.25, 0.05), panelFrameMaterial);
  panelFrame.position.z = -0.03;
  solarGroup.add(panelFrame);

  const solarPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a2436, metalness: 0.6, roughness: 0.5 })
  );
  solarPole.position.set(0, -1.15, 0);
  solarGroup.add(solarPole);

  solarGroup.position.set(-4.6, -0.6, -1.2);
  solarGroup.rotation.set(-0.15, 0.5, 0.12); // tilted toward an implied "sun" for visual interest
  scene.add(solarGroup);

  /* ---------------------------------------------------------------------
     Wind turbine — a pole + hub + 3 blades on the right side, the blades
     spin continuously in the animation loop.
     --------------------------------------------------------------------- */
  const turbineGroup = new THREE.Group();
  const turbineMaterial = new THREE.MeshStandardMaterial({ color: 0xdbe7ec, metalness: 0.3, roughness: 0.55 });
  const turbineAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a2e33,
    emissive: CYAN,
    emissiveIntensity: 0.6,
    metalness: 0.4,
    roughness: 0.4
  });

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.6, 10), turbineMaterial);
  tower.position.y = -1.3;
  turbineGroup.add(tower);

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), turbineAccentMaterial);
  turbineGroup.add(hub);

  const bladesGroup = new THREE.Group();
  const bladeGeometry = new THREE.ConeGeometry(0.09, 0.95, 6);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeometry, turbineMaterial);
    blade.position.y = 0.5;
    blade.rotation.x = Math.PI; // point outward from hub rather than into it
    const pivot = new THREE.Group();
    pivot.add(blade);
    pivot.rotation.z = (i * Math.PI * 2) / 3;
    bladesGroup.add(pivot);
  }
  turbineGroup.add(bladesGroup);

  turbineGroup.position.set(4.7, 0.4, -1.6);
  scene.add(turbineGroup);

  /* ---------------------------------------------------------------------
     Energy particle streams — small emissive points flowing from the
     solar panel and wind turbine toward the compute core, looping.
     --------------------------------------------------------------------- */
  function makeEnergyStream(fromVec, color) {
    const count = IS_LOW_POWER ? 14 : 26;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const progress = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      progress[i] = i / count;
      positions[i * 3] = fromVec.x;
      positions[i * 3 + 1] = fromVec.y;
      positions[i * 3 + 2] = fromVec.z;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.09,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    return { points, geometry, progress, from: fromVec.clone(), count };
  }

  const energyStreams = [
    makeEnergyStream(new THREE.Vector3(-4.6, -0.6, -1.2), EMERALD),
    makeEnergyStream(new THREE.Vector3(4.7, 0.4, -1.6), CYAN)
  ];

  function updateEnergyStream(stream, dt, target) {
    const posAttr = stream.geometry.attributes.position;
    for (let i = 0; i < stream.count; i++) {
      stream.progress[i] += dt * 0.35;
      if (stream.progress[i] > 1) stream.progress[i] -= 1;
      const t = stream.progress[i];
      // Slight curve toward the core rather than a straight line, using a
      // simple quadratic bezier through a midpoint lifted on Y.
      const mid = stream.from.clone().lerp(target, 0.5).add(new THREE.Vector3(0, 1.1, 0.6));
      const p1 = stream.from.clone().lerp(mid, t);
      const p2 = mid.clone().lerp(target, t);
      const p = p1.lerp(p2, t);
      posAttr.array[i * 3] = p.x;
      posAttr.array[i * 3 + 1] = p.y;
      posAttr.array[i * 3 + 2] = p.z;
    }
    posAttr.needsUpdate = true;
  }

  /* ---------------------------------------------------------------------
     Scroll-driven parallax — as the user scrolls the hero out of view,
     gently dolly the camera in and rotate the core faster, then stop all
     scroll-based updates once the hero is fully scrolled past (keeps the
     effect purely "of the hero", not something that fights scrolling
     through the rest of the page).
     --------------------------------------------------------------------- */
  const heroSection = document.getElementById("top");
  let scrollProgress = 0; // 0 = hero fully in view, 1 = hero fully scrolled past

  function updateScrollProgress() {
    if (!heroSection) return;
    const rect = heroSection.getBoundingClientRect();
    const heroHeight = rect.height || 1;
    // Progress reaches 1 once the hero's bottom has scrolled to the top
    // of the viewport (i.e. the hero is entirely above the fold).
    const raw = 1 - Math.max(rect.bottom, 0) / heroHeight;
    scrollProgress = Math.min(Math.max(raw, 0), 1);
  }
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  updateScrollProgress();

  /* ---------------------------------------------------------------------
     Resize handling
     --------------------------------------------------------------------- */
  function handleResize() {
    const width = container.clientWidth;
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", handleResize);

  /* ---------------------------------------------------------------------
     Pause rendering when the hero isn't visible (off-screen tab, or the
     user has scrolled far past it) to save battery/CPU — resumes
     automatically via IntersectionObserver + the visibilitychange event.
     --------------------------------------------------------------------- */
  let isRendering = true;
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => { isRendering = entries[0].isIntersecting; },
      { threshold: 0.01 }
    );
    observer.observe(container);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) isRendering = false;
    else if (!("IntersectionObserver" in window)) isRendering = true;
  });

  /* ---------------------------------------------------------------------
     Animation loop
     --------------------------------------------------------------------- */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    if (!isRendering) return;

    // Core: slow continuous spin + a slight scroll-linked speed-up.
    coreGroup.rotation.y += dt * (0.18 + scrollProgress * 0.5);
    coreGroup.rotation.x = Math.sin(t * 0.25) * 0.08;
    shell.rotation.y -= dt * 0.12;
    shell.rotation.x += dt * 0.05;

    // Staking nodes orbit the core at their own radius/speed/tilt.
    stakingNodes.forEach((n) => {
      const angle = t * n.speed + n.offset;
      n.mesh.position.set(
        Math.cos(angle) * n.radius,
        Math.sin(angle * 0.6) * n.radius * 0.35 * Math.cos(n.tilt),
        Math.sin(angle) * n.radius * 0.6
      );
    });

    // Wind turbine blades spin continuously.
    bladesGroup.rotation.z += dt * 2.2;

    // Solar panel gently glints (emissive pulse) as if catching light.
    panelCellMaterial.emissiveIntensity = 0.35 + Math.sin(t * 1.4) * 0.15;

    // Energy streams flow from each source toward the core.
    updateEnergyStream(energyStreams[0], dt, new THREE.Vector3(0, 0, 0));
    updateEnergyStream(energyStreams[1], dt, new THREE.Vector3(0, 0, 0));

    // Starfield: very slow ambient rotation for a sense of depth.
    stars.rotation.y += dt * 0.01;

    // Scroll parallax: dolly the camera in slightly and drift it upward
    // as the hero scrolls out of view, and fade the whole scene's opacity
    // via the renderer's canvas element so the transition to the next
    // section feels intentional rather than the scene abruptly vanishing.
    camera.position.z = 9 - scrollProgress * 2.4;
    camera.position.y = 0.6 + scrollProgress * 1.1;
    camera.lookAt(0, 0, 0);
    renderer.domElement.style.opacity = String(1 - scrollProgress * 0.85);

    renderer.render(scene, camera);
  }

  animate();
}

// Wait for DOM to be ready (this module script has `defer`-like semantics
// by default, but the explicit check is cheap insurance since the module
// is also imported dynamically in some load orders during development).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pcInitHero3D);
} else {
  pcInitHero3D();
}
