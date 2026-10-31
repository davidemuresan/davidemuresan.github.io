/* scene/index.js — creates the renderer, assembles the PCB world and runs the loop.
   Loaded lazily (dynamic import) after first paint, so it never delays the text. */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rng, ZONES } from './layout.js';
import { buildBoard, Silk } from './board.js';
import { buildChip } from './chip.js';
import { buildZones, zoneTraces } from './zones.js';
import { createDust } from './packets.js';
import { createFlightPath } from './flightPath.js';

// Yield to the browser between heavy steps so no single task blocks input for long.
const breathe = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 16)));

export async function createScene({ stage, coords, scroll, mobile, reduced }) {
  const lite = mobile;
  const rand = rng(2026);

  /* ---- Renderer ---- */
  const qs = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ antialias: lite, powerPreference: 'high-performance', alpha: false });
  // Render scale: starts at the device pixel ratio (capped) and is lowered automatically
  // by the frame-time governor below if the GPU can't keep up. `?dpr=` forces a value (debug).
  const forcedScale = qs.has('dpr') ? +qs.get('dpr') : null;
  const MAX_SCALE = Math.min(devicePixelRatio || 1, lite ? 1.5 : 1.25);
  const MIN_SCALE = 0.6;
  let scale = forcedScale ?? MAX_SCALE;
  const dpr = scale;
  renderer.setPixelRatio(scale);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.debug.checkShaderErrors = import.meta.env.DEV; // skip sync status checks in production
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#04080a');
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#04080a', lite ? 0.0105 : 0.0125);
  scene.background = new THREE.Color('#04080a');
  await breathe();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(lite ? 58 : 40, innerWidth / innerHeight, 0.1, 400);

  /* ---- Lights ---- */
  scene.add(new THREE.HemisphereLight('#7fb4ff', '#06100c', 0.5));
  const key = new THREE.DirectionalLight('#dfeaff', 1.4);
  key.position.set(-40, 60, 30);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffb36b', 0.38);
  rim.position.set(50, 20, -60);
  scene.add(rim);
  const zoneLight = new THREE.PointLight('#5ff0ff', 0, 36, 1.4);
  scene.add(zoneLight);

  /* ---- World ---- */
  // make sure the silkscreen font is ready before painting the canvas
  try { await document.fonts?.load('500 20px "JetBrains Mono"'); } catch (_) {}
  const silk = new Silk(lite ? 9 : 13);
  const metal = new THREE.MeshStandardMaterial({ color: '#d9b26a', metalness: 1, roughness: 0.32 });
  const chip = buildChip({ silk, metal });
  await breathe();
  const zones = buildZones({ silk, metal, lite });
  await breathe();
  const board = buildBoard({ renderer, rand, lite, silk, extraTraces: zoneTraces() });
  await breathe();
  board.finalize();
  scene.add(board.group, chip.group, ...zones.map((z) => z.group));
  const dust = createDust(lite ? 350 : 1400, rand);
  dust.material.uniforms.uPx.value = dpr;
  scene.add(dust);

  // Zone centres for the trace shader
  const tu = board.traceMat.uniforms;
  ZONES.forEach((z, i) => tu.uZones.value[i].set(z.x, z.z, z.half * 1.9, 0));
  tu.uFocus.value.set(0, 0, 16, 0);

  /* ---- Post-processing (desktop only) ---- */
  let post = null;
  const allowPost = !qs.has('nopost');
  async function makePost() {
    const { createPost } = await import('./post.js');
    const p = createPost(renderer, scene, camera, innerWidth * scale, innerHeight * scale, qs.has('msaa') ? +qs.get('msaa') : 0);
    p.composer.setPixelRatio(scale);
    p.setSize(innerWidth, innerHeight);
    return p;
  }
  // Desktop: bloom from the start. Mobile: starts without it and gets it later if the phone is fast enough.
  if (!lite && allowPost) post = await makePost();

  /* ---- Flight path ---- */
  const path = createFlightPath({ mobile });
  path.measure();
  const remeasure = () => path.measure();
  new ResizeObserver(remeasure).observe(document.getElementById('main'));
  document.fonts?.ready.then(remeasure);

  /* ---- Pointer parallax ---- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!mobile && !reduced) addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  /* ---- Resize ---- */
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post?.setSize(w, h);
    path.measure();
    if (reduced) render(0);
  }
  addEventListener('resize', resize);

  /* ---- Adaptive quality governor ----
     Averages real frame times each second. Too slow (< ~52 fps) → drop the render scale ~18 %.
     Lots of headroom (high-refresh screens) → raise it again, never above MAX_SCALE.
     Text is HTML, so only the (bloomed, soft) 3D layer changes resolution. */
  const gov = { sum: 0, n: 0, t: 0, cool: 2.5 };
  let bloomTried = false;
  /** Mobile only: switch bloom on once the phone has proven it holds ~55+ fps. */
  async function upgradeToBloom() {
    bloomTried = true;
    try {
      const p = await makePost();
      // compile its shaders for the float target before the first frame that uses them
      renderer.setRenderTarget(p.composer.readBuffer);
      const seen = new Set();
      scene.traverse((o) => {
        if (!(o.isMesh || o.isPoints || o.isSprite || o.isLineSegments)) return;
        const key = [].concat(o.material).map((m) => m.type + (o.isInstancedMesh ? 'I' : '') + (m.isShaderMaterial ? m.uuid : '')).join('|');
        if (!seen.has(key)) { seen.add(key); renderer.compile(o, camera, scene); }
      });
      renderer.setRenderTarget(null);
      post = p;
      document.documentElement.dataset.bloom = 'on'; // visible in devtools, handy for testing
      gov.cool = 2; gov.sum = gov.n = gov.t = 0;
    } catch (_) { /* stay without bloom */ }
  }
  function setScale(s) {
    scale = s;
    renderer.setPixelRatio(s);
    renderer.setSize(innerWidth, innerHeight);
    if (post) { post.composer.setPixelRatio(s); post.setSize(innerWidth, innerHeight); }
    dust.material.uniforms.uPx.value = s;
  }
  function govern(raw) {
    if (forcedScale || reduced || raw > 0.25) return; // ignore tab switches / hitches
    gov.cool -= raw; gov.t += raw;
    if (gov.cool > 0) return;                          // settle after start / after a change
    gov.sum += raw; gov.n++;
    if (gov.t < 1) return;
    const avg = (gov.sum / gov.n) * 1000;
    gov.sum = gov.n = gov.t = 0;
    if (avg > 19.2) {
      // on phones, give up bloom before giving up sharpness; never try it again this visit
      if (lite && post) { post = null; document.documentElement.dataset.bloom = 'off'; gov.cool = 1.5; }
      else if (scale > MIN_SCALE) { setScale(Math.max(MIN_SCALE, scale * 0.82)); gov.cool = 1.5; }
    } else if (lite && allowPost && !post && !bloomTried && avg < 18) {
      upgradeToBloom();
    } else if (avg < 11 && scale < MAX_SCALE) { setScale(Math.min(MAX_SCALE, scale * 1.1)); gov.cool = 3; }
  }

  /* ---- State ---- */
  const cam = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), s: 0, shift: 0 };
  const act = { zones: [0, 0, 0, 0], skills: 0, contact: 0 };
  let first = true;
  let reveal = reduced ? 200 : 0;
  let kick = 0;
  const clock = new THREE.Clock();
  let time = reduced ? 12.0 : 0;
  let frame = 0;
  const snap = new URLSearchParams(location.search).has('snap'); // debug: no camera easing (screenshots)
  const look = new THREE.Vector3();

  function render(dt) {
    if (!reduced) time += dt;

    // 1 · where are we on the path?
    const sTarget = reduced ? 0 : path.keyIndex(scroll.y);
    // single smoothing stage (Lenis already eases the scroll) → responsive, never floaty
    cam.s = first ? sTarget : THREE.MathUtils.damp(cam.s, sTarget, 7, dt);
    const smp = path.sample(cam.s);
    if (first || snap) { cam.s = sTarget; Object.assign(smp, path.sample(cam.s)); cam.pos.copy(smp.pos); cam.tgt.copy(smp.tgt); cam.shift = smp.shift; act.zones = [...smp.zones]; act.skills = smp.skills; act.contact = smp.contact; first = false; }
    cam.pos.copy(smp.pos);
    cam.tgt.copy(smp.tgt);
    cam.shift += (smp.shift - cam.shift) * (1 - Math.exp(-dt * 4));
    for (let i = 0; i < 4; i++) act.zones[i] += (smp.zones[i] - act.zones[i]) * (1 - Math.exp(-dt * 5));
    act.skills += (smp.skills - act.skills) * (1 - Math.exp(-dt * 4));
    act.contact += (smp.contact - act.contact) * (1 - Math.exp(-dt * 4));

    // 2 · camera: subtle "hover" bob + pointer parallax
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    camera.position.copy(cam.pos);
    if (!reduced) {
      camera.position.x += Math.sin(time * 0.5) * 0.25 + pointer.sx * 2.2;
      camera.position.y += Math.sin(time * 0.7) * 0.15 - pointer.sy * 1.2;
    }
    look.copy(cam.tgt);
    camera.lookAt(look);
    const vel = Math.min(Math.abs(scroll.velocity || 0), 80);
    camera.fov = (lite ? 58 : 40) + vel * 0.12;
    // horizontal view offset puts the subject to the right of the text column
    const w = innerWidth, h = innerHeight;
    if (!qs.has('nooffset')) camera.setViewOffset(w, h, -w * cam.shift * 0.8, 0, w, h);
    camera.updateProjectionMatrix();

    // 3 · uniforms
    if (!reduced && reveal < 200) reveal += dt * 70;
    tu.uTime.value = time;
    tu.uReveal.value = reveal;
    tu.uBoost.value = vel * 0.012;
    act.zones.forEach((a, i) => { tu.uZones.value[i].w = a; });
    tu.uFocus.value.w = act.skills;
    chip.dieMat.uniforms.uTime.value = time;
    chip.dieMat.uniforms.uGlow.value = 0.9 + act.skills * 1.4 + Math.max(0, 1 - reveal / 60) * 1.5;
    chip.light.intensity = 40 + act.skills * 90;
    zones.forEach((z, i) => z.update(time, act.zones[i]));
    board.gold.emissiveIntensity = 0.3 + act.contact * 1.6;
    dust.material.uniforms.uTime.value = time;

    // the moving zone light follows whichever block is active
    let best = -1, bestA = 0;
    act.zones.forEach((a, i) => { if (a > bestA) { bestA = a; best = i; } });
    if (best >= 0) { zoneLight.position.set(ZONES[best].x, 9, ZONES[best].z); }
    zoneLight.intensity = bestA * 70;

    if (scroll.kick) { kick = 1; scroll.kick = 0; }
    kick *= Math.exp(-dt * 3);

    if (post) {
      post.lens.uniforms.uAberration.value = Math.min(1, vel / 60) * 0.45 + kick * 0.3;
      post.lens.uniforms.uTime.value = time;
      post.bloom.strength = 0.8 + kick * 0.5 + act.skills * 0.2;
      post.composer.render(dt);
    } else renderer.render(scene, camera);

    // 4 · HUD readout (throttled)
    if (coords && (frame++ % 6 === 0)) {
      const p = camera.position;
      coords.textContent = `X ${p.x.toFixed(1).padStart(6, ' ')} · Y ${p.y.toFixed(1).padStart(5, ' ')} · Z ${p.z.toFixed(1).padStart(6, ' ')}`;
    }
  }

  await breathe();
  // Warm up shaders object-by-object, yielding between each, so the GPU driver's
  // shader compilation never freezes the page in one long task.
  const parts = [];
  scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isSprite || o.isLineSegments) parts.push(o); });
  const seen = new Set();
  // Compile for the target we'll really draw into (post's float target ≠ screen → different programs).
  if (post) renderer.setRenderTarget(post.composer.readBuffer);
  for (const o of parts) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const key = mats.map((m) => m.type + (o.isInstancedMesh ? 'I' : '') + (m.isShaderMaterial ? m.uuid : '')).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    renderer.compile(o, camera, scene);
    await breathe();
  }
  if (post) {
    // warm the post-processing shaders one by one on a dummy full-screen quad
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    const b = post.bloom;
    const mats = [post.sanitize.material, ...b.separableBlurMaterials, b.compositeMaterial, b.materialHighPassFilter, b.blendMaterial, post.lens.material];
    for (const m of mats) { quad.material = m; renderer.compile(quad, camera); await breathe(); }
    renderer.setRenderTarget(null);
  }
  render(1 / 60);
  await breathe();

  const loop = () => {
    const raw = clock.getDelta();
    render(Math.min(raw, 1 / 20));
    govern(raw);
  };
  if (!reduced) renderer.setAnimationLoop(loop);

  // If the browser's GPU process crashes or resets, the WebGL context is lost.
  // Fade back to the static poster instead of showing a frozen/black canvas,
  // and resume automatically if the browser restores the context.
  const canvas = renderer.domElement;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // allows the browser to restore it later
    renderer.setAnimationLoop(null);
    stage.classList.remove('is-live');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clock.getDelta();
    if (!reduced) renderer.setAnimationLoop(loop); else render(0);
    stage.classList.add('is-live');
  });
  return { renderer, scene, camera };
}
