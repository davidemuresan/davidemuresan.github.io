/* flightPath.js — the "spaceship" camera path.
   Each keyframe is tied to a DOM anchor; when that anchor is centred in the
   viewport, the camera sits exactly on the keyframe. Between anchors the
   camera glides along Catmull-Rom splines (position + look-at target), with a
   "dwell" easing so it rests while you read and flies between sections. */

import * as THREE from 'three';
import { ZONES } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* shift: horizontal screen offset (fraction of width) so the subject sits right of the text.
   zone: index of the zone highlighted at this keyframe. */
const KEYS = [
  { anchor: '#top',        pos: V(-14, 26, 44),  tgt: V(2, 0, 0),     shift: 0.17 },
  { anchor: '#about', mix: -0.55, pos: V(10, 9, 70), tgt: V(0, 0.5, 36), shift: 0.1 },        // dive toward the edge connector
  { anchor: '#about',      pos: V(1.6, 2.4, 44), tgt: V(0, 1.2, 10),  shift: 0.14 },          // skim the fan-out traces
  { anchor: '[data-anchor="projects"]', pos: V(-12, 22, 30), tgt: V(-30, 0, 8), shift: 0.16 },
  { anchor: '[data-anchor="project-0"]', pos: V(-21, 10, 40), tgt: V(-38, 2, 21), shift: 0.2, zone: 0 },
  { anchor: '[data-anchor="project-1"]', pos: V(-22, 9, -11), tgt: V(-40, 2, -30), shift: 0.2, zone: 1 },
  { anchor: '[data-anchor="project-2"]', pos: V(21, 9.5, -12), tgt: V(38, 2, -30), shift: 0.2, zone: 2 },
  { anchor: '[data-anchor="project-3"]', pos: V(22, 10, 40), tgt: V(39, 2, 21), shift: 0.2, zone: 3 },
  { anchor: '#skills',     pos: V(0, 34, 7),     tgt: V(0, 0, 0),     shift: 0 },
  { anchor: '#contact',    pos: V(0, 6.5, 100),  tgt: V(0, 0.4, 70),  shift: 0.12, end: true },
];

export function createFlightPath({ mobile }) {
  // On narrow portrait screens pull the camera back & up so subjects fit.
  const keys = KEYS.map((k) => {
    if (!mobile) return k;
    const dir = k.pos.clone().sub(k.tgt);
    return { ...k, pos: k.tgt.clone().add(dir.multiplyScalar(1.35)).add(V(0, 3, 0)), shift: 0 };
  });
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.pos), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.tgt), false, 'centripetal');
  const anchorsY = new Array(keys.length).fill(0);

  function measure() {
    const vh = innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    keys.forEach((k, i) => {
      const el = document.querySelector(k.anchor);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = r.top + scrollY;
      let y = top + r.height / 2 - vh / 2;
      if (k.mix) y = top + k.mix * vh;           // a point before the section
      if (i === 0) y = 0;
      if (k.end) y = max;
      anchorsY[i] = Math.min(max, Math.max(0, y));
    });
    for (let i = 1; i < anchorsY.length; i++) anchorsY[i] = Math.max(anchorsY[i], anchorsY[i - 1] + 1);
  }

  // Dwell: hold still for the first/last 12% of each segment, ease in between.
  const dwell = (u) => { const x = THREE.MathUtils.clamp((u - 0.12) / 0.76, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

  /** Returns a continuous key index s ∈ [0, n-1] for a scroll position. */
  function keyIndex(y) {
    const n = anchorsY.length;
    if (y <= anchorsY[0]) return 0;
    for (let i = 0; i < n - 1; i++) {
      if (y < anchorsY[i + 1]) return i + dwell((y - anchorsY[i]) / (anchorsY[i + 1] - anchorsY[i]));
    }
    return n - 1;
  }

  const outPos = new THREE.Vector3(), outTgt = new THREE.Vector3();
  function sample(s) {
    const t = s / (keys.length - 1);
    posCurve.getPoint(t, outPos);
    tgtCurve.getPoint(t, outTgt);
    const i = Math.floor(s), f = s - i;
    const a = keys[i], b = keys[Math.min(keys.length - 1, i + 1)];
    const shift = a.shift + (b.shift - a.shift) * f;
    // zone activations: 1 when sitting on the zone's keyframe
    const zones = ZONES.map((_, z) => {
      const kz = keys.findIndex((k) => k.zone === z);
      return THREE.MathUtils.clamp(1 - Math.abs(s - kz) * 1.6, 0, 1);
    });
    const skills = THREE.MathUtils.clamp(1 - Math.abs(s - (keys.length - 2)) * 1.5, 0, 1);
    const contact = THREE.MathUtils.clamp(1 - Math.abs(s - (keys.length - 1)) * 1.5, 0, 1);
    return { pos: outPos, tgt: outTgt, shift, zones, skills, contact };
  }

  return { measure, keyIndex, sample, count: keys.length };
}
