/* main.js — bootstrap.
   Order: render text (instant) → scroll/UI animations → lazy-load the 3D scene after first paint. */

import './styles/main.css';
import { renderPage } from './render.js';
import { initScroll, playIntro, scrollState, refreshScroll } from './scroll.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 720px)').matches || matchMedia('(pointer: coarse)').matches;
// Users who asked to save data get the static poster instead of WebGL.
// (CPU-count / memory heuristics are NOT used: Brave & co. randomise them for privacy.)
const lowEnd = !!navigator.connection?.saveData;

if (!reduced) document.documentElement.classList.add('js-anim');

renderPage();
initScroll({ reduced });

/* ---- Boot overlay ------------------------------------------------------- */
const boot = document.getElementById('boot');
const pct = document.getElementById('boot-pct');
const bar = document.getElementById('boot-bar');
let shown = 0;
let target = 35;
const t0 = performance.now();
let booted = false;

function finishBoot() {
  if (booted) return;
  booted = true;
  target = 100;
  setTimeout(() => {
    boot.classList.add('is-done');
    playIntro({ reduced });
  }, 250);
}
(function tickBoot() {
  shown += (target - shown) * 0.12;
  pct.textContent = String(Math.round(shown)).padStart(2, '0');
  bar.style.width = `${shown}%`;
  if (!booted && performance.now() - t0 > 950) finishBoot(); // short intro; text is never blocked
  if (shown < 99.5 || !booted) requestAnimationFrame(tickBoot);
})();
if (reduced) finishBoot();

/* ---- WebGL detection ---------------------------------------------------- */
// Cheap feature check only: creating a throw-away GL context costs ~150 ms on a cold GPU.
// If the real renderer then fails to get a context, createScene() throws and we fall back.
function hasWebGL() {
  return 'WebGLRenderingContext' in window;
}

/* ---- Lazy 3D: after load + idle, so text paints first ------------------- */
function startScene() {
  if (!hasWebGL() || lowEnd) {
    document.documentElement.classList.add('no-webgl');
    finishBoot();
    return;
  }
  target = 70;
  import('./scene/index.js')
    .then(({ createScene }) =>
      createScene({
        stage: document.getElementById('stage'),
        coords: document.getElementById('hud-coords'),
        scroll: scrollState,
        mobile,
        reduced,
      }))
    .then(() => {
      document.getElementById('stage').classList.add('is-live');
      refreshScroll();
      finishBoot();
    })
    .catch((err) => {
      console.warn('[scene] falling back to static poster:', err);
      document.documentElement.classList.add('no-webgl');
      finishBoot();
    });
}

const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
// The 3D is decoration: start it on the visitor's first interaction (mouse move, scroll,
// touch, key) or 2.5 s after load, whichever comes first. The page is never blocked while
// someone is trying to read or click, and the static poster covers the gap.
let started = false;
const EVENTS = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'];
function go() {
  if (started) return;
  started = true;
  EVENTS.forEach((e) => removeEventListener(e, go));
  idle(startScene, { timeout: 600 });
}
function arm() {
  EVENTS.forEach((e) => addEventListener(e, go, { passive: true, once: true }));
  setTimeout(go, 2500);
}
if (document.readyState === 'complete') arm();
else addEventListener('load', arm, { once: true });
