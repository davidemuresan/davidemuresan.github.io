/* board.js — the procedural PCB.
   - board slab + soldermask with a canvas-drawn silkscreen
   - copper traces: chip fan-out buses, zone buses, random 45° "walkers"
   - vias, SMD passives, ICs, electrolytic caps, inductors, crystals (all instanced)
   - gold edge connector */

import * as THREE from 'three';
import { BOARD, CHIP, ZONES, CONNECTOR, Occupancy } from './layout.js';
import { buildTraceGeometry, createTraceMaterial } from './packets.js';

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/* ---------- Silkscreen (canvas texture painted onto the board) ----------- */
export class Silk {
  constructor(pxPerUnit) {
    this.k = pxPerUnit;
    this.c = document.createElement('canvas');
    this.c.width = Math.round((BOARD.x1 - BOARD.x0) * pxPerUnit);
    this.c.height = Math.round((BOARD.z1 - BOARD.z0) * pxPerUnit);
    this.g = this.c.getContext('2d');
    this.paintBase();
  }
  X(x) { return (x - BOARD.x0) * this.k; }
  Z(z) { return (z - BOARD.z0) * this.k; }
  paintBase() {
    const { g, c } = this;
    const grad = g.createRadialGradient(c.width / 2, c.height * 0.46, 10, c.width / 2, c.height / 2, c.width * 0.7);
    grad.addColorStop(0, '#0d1d19');
    grad.addColorStop(1, '#060d0c');
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    // faint copper-pour hatch under the mask
    g.strokeStyle = 'rgba(120, 190, 160, 0.035)'; g.lineWidth = 1;
    const step = this.k * 2;
    for (let i = -c.height; i < c.width; i += step) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + c.height, c.height); g.stroke(); }
    // subtle mask mottling (cheap: a few hundred soft blotches instead of per-pixel noise)
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '60,110,95'}, 0.035)`;
      const r = (2 + Math.random() * 10) * this.k;
      g.beginPath(); g.arc(Math.random() * c.width, Math.random() * c.height, r, 0, 6.283); g.fill();
    }
  }
  text(x, z, str, size = 1.2, { rot = 0, color = 'rgba(225, 235, 228, 0.78)', align = 'left', weight = 500 } = {}) {
    const { g } = this;
    g.save(); g.translate(this.X(x), this.Z(z)); g.rotate(rot);
    g.font = `${weight} ${size * this.k}px "JetBrains Mono", ui-monospace, monospace`;
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(str, 0, 0); g.restore();
  }
  rect(x0, z0, x1, z1, { color = 'rgba(225, 235, 228, 0.55)', w = 0.18, corners = false } = {}) {
    const { g } = this;
    g.strokeStyle = color; g.lineWidth = w * this.k;
    if (!corners) { g.strokeRect(this.X(x0), this.Z(z0), (x1 - x0) * this.k, (z1 - z0) * this.k); return; }
    const L = 2.2 * this.k, a = [this.X(x0), this.Z(z0)], b = [this.X(x1), this.Z(z1)];
    g.beginPath();
    [[a[0], a[1], 1, 1], [b[0], a[1], -1, 1], [a[0], b[1], 1, -1], [b[0], b[1], -1, -1]].forEach(([x, y, sx, sy]) => {
      g.moveTo(x + sx * L, y); g.lineTo(x, y); g.lineTo(x, y + sy * L);
    });
    g.stroke();
  }
  circle(x, z, r, { color = 'rgba(225, 235, 228, 0.55)', fill = false, w = 0.15 } = {}) {
    const { g } = this;
    g.beginPath(); g.arc(this.X(x), this.Z(z), r * this.k, 0, Math.PI * 2);
    if (fill) { g.fillStyle = color; g.fill(); } else { g.strokeStyle = color; g.lineWidth = w * this.k; g.stroke(); }
  }
  pad(x, z, w, h, color = 'rgba(150, 120, 70, 0.55)') {
    this.g.fillStyle = color; this.g.fillRect(this.X(x - w / 2), this.Z(z - h / 2), w * this.k, h * this.k);
  }
  texture(renderer) {
    const t = new THREE.CanvasTexture(this.c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
}

/* ---------- Routing helpers ---------------------------------------------- */
function clean(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-3) continue;
    out.push(p);
  }
  // remove collinear middles
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-4) out.splice(i, 1);
  }
  return out;
}

/** Octilinear route (only 0°/45°/90°) from A (leaving along dA) to B (arriving along dB). */
function route(A, dA, B, dB, stubA = 2, stubB = 2) {
  const P1 = [A[0] + dA[0] * stubA, A[1] + dA[1] * stubA];
  const P2 = [B[0] - dB[0] * stubB, B[1] - dB[1] * stubB];
  const dx = P2[0] - P1[0], dz = P2[1] - P1[1], ax = Math.abs(dx), az = Math.abs(dz);
  const sx = Math.sign(dx), sz = Math.sign(dz);
  let mid;
  if (dA[0] !== 0 && dA[1] === 0) mid = ax >= az ? [P1[0] + sx * (ax - az), P1[1]] : [P1[0] + dx, P1[1] + sz * ax];
  else mid = az >= ax ? [P1[0], P1[1] + sz * (az - ax)] : [P1[0] + sx * az, P1[1] + dz];
  return clean([A, P1, mid, P2, B]);
}

function offsetPolyline(pts, o) {
  const n = pts.length;
  return pts.map((b, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)];
    let d1 = [b[0] - a[0], b[1] - a[1]], d2 = [c[0] - b[0], c[1] - b[1]];
    if (i === 0) d1 = d2; if (i === n - 1) d2 = d1;
    const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
    const n1 = [-d1[1] / l1, d1[0] / l1], n2 = [-d2[1] / l2, d2[0] / l2];
    let m = [n1[0] + n2[0], n1[1] + n2[1]];
    const ml = Math.hypot(...m) || 1; m = [m[0] / ml, m[1] / ml];
    const k = o / Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
    return [b[0] + m[0] * k, b[1] + m[1] * k];
  });
}

/* ---------- Board builder ------------------------------------------------- */
export function buildBoard({ renderer, rand, lite, silk, extraTraces = [] }) {
  const group = new THREE.Group();
  const occ = new Occupancy();
  const traces = [];
  const viaPts = [];
  const addTrace = (pts, width, opts = {}) => {
    traces.push({ pts, width, seed: rand(), active: rand() < (opts.activeP ?? 0.55) ? 1 : 0, reverse: opts.reverse ?? rand() < 0.5 });
  };

  // Keep-outs: chip, zones, connector
  const pk = CHIP.pkg / 2 + 1.5;
  occ.markRect(CHIP.x - pk, CHIP.z - pk, CHIP.x + pk, CHIP.z + pk);
  ZONES.forEach((z) => occ.markRect(z.x - z.half - 1, z.z - z.half - 1, z.x + z.half + 1, z.z + z.half + 1));
  occ.markRect(CONNECTOR.x0 - 1, CONNECTOR.z0 - 1, CONNECTOR.x1 + 1, BOARD.z1);

  /* 1 · Fan-out: edge connector fingers → bottom side of the chip */
  const fingers = [];
  for (let x = CONNECTOR.x0 + 0.8; x <= CONNECTOR.x1 - 0.8 + 1e-6; x += CONNECTOR.pitch) fingers.push(x);
  const fanN = 24, firstFan = Math.round((fingers.length - fanN) / 2);
  fingers.forEach((fx, i) => {
    const k = i - firstFan;
    if (k >= 0 && k < fanN) {
      const tx = CHIP.x + (k - (fanN - 1) / 2) * 0.68;
      const pts = route([fx, CONNECTOR.z0 + 1], [0, -1], [tx, CHIP.z + 7.5], [0, -1], 3, 1.5);
      addTrace(pts, 0.32, { activeP: 0.8, reverse: rand() < 0.3 });
      occ.markPolyline(pts, 1);
    } else {
      const pts = [[fx, CONNECTOR.z0 + 1], [fx, CONNECTOR.z0 - 3 - rand() * 4]];
      addTrace(pts, 0.32); viaPts.push(pts[1]);
    }
  });

  /* 2 · Buses: chip ↔ zones, zone ↔ zone */
  const bus = (A, dA, B, dB, n, spacing, width, s1 = 2, s2 = 2) => {
    const center = route(A, dA, B, dB, s1, s2);
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * spacing;
      const pts = offsetPolyline(center, o);
      addTrace(pts, width, { activeP: 0.7 });
      occ.markPolyline(pts, 1);
    }
  };
  const [z0, z1, z2, z3] = ZONES;
  bus([-7.5, 3.2], [-1, 0], [z0.x + 3, z0.z - z0.half + 1], [0, 1], 8, 0.9, 0.34, 3, 2);
  bus([-7.5, -3.2], [-1, 0], [z1.x + 3, z1.z + z1.half - 1], [0, -1], 8, 0.9, 0.34, 3, 2);
  bus([7.5, -3.2], [1, 0], [z2.x - 3, z2.z + z2.half - 1], [0, -1], 8, 0.9, 0.34, 3, 2);
  bus([7.5, 3.2], [1, 0], [z3.x - 3, z3.z - z3.half + 1], [0, 1], 8, 0.9, 0.34, 3, 2);
  bus([0, -7.5], [0, -1], [0, -26], [0, -1], 10, 0.8, 0.3, 3, 1);
  bus([z0.x - 4, z0.z - z0.half + 1], [0, -1], [z1.x - 4, z1.z + z1.half - 1], [0, -1], 6, 0.9, 0.34, 2, 2);
  bus([z3.x + 4, z3.z - z3.half + 1], [0, -1], [z2.x + 4, z2.z + z2.half - 1], [0, -1], 6, 0.9, 0.34, 2, 2);
  bus([z1.x + z1.half - 1, z1.z - 5], [1, 0], [z2.x - z2.half + 1, z2.z - 5], [1, 0], 7, 0.9, 0.34, 2, 2);
  bus([z0.x + 2, z0.z + z0.half - 1], [0, 1], [CONNECTOR.x0 - 4, CONNECTOR.z0 + 2], [0, 1], 5, 1.0, 0.4, 2, 2);
  bus([z3.x - 2, z3.z + z3.half - 1], [0, 1], [CONNECTOR.x1 + 4, CONNECTOR.z0 + 2], [0, 1], 5, 1.0, 0.4, 2, 2);

  /* 3 · Random 45° walkers fill the rest of the board */
  const walkers = lite ? 120 : 300;
  for (let w = 0; w < walkers; w++) {
    let x = Math.round(BOARD.x0 + 3 + rand() * (BOARD.x1 - BOARD.x0 - 6));
    let z = Math.round(BOARD.z0 + 3 + rand() * (BOARD.z1 - BOARD.z0 - 6));
    if (!occ.isFree(x, z)) continue;
    let d = (rand() * 8) | 0;
    const pts = [[x, z]];
    const len = 6 + ((rand() * 46) | 0);
    let since = 0;
    for (let s = 0; s < len; s++) {
      if (since > 3 && rand() < 0.12) { d = (d + (rand() < 0.5 ? 1 : 7)) % 8; since = 0; pts.push([x, z]); }
      const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
      if (!occ.isFree(nx, nz) || !occ.isFree(nx + DIRS[d][0], nz + DIRS[d][1])) break;
      x = nx; z = nz; since++;
    }
    pts.push([x, z]);
    const pl = clean(pts);
    if (pl.length < 2) continue;
    const L = pl.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pl[i - 1][0], p[1] - pl[i - 1][1]) : 0), 0);
    if (L < 4) continue;
    const width = rand() < 0.15 ? 0.7 : 0.26 + rand() * 0.14;
    addTrace(pl, width, { activeP: 0.42 });
    // differential pair twin
    if (rand() < 0.22 && L > 8) { addTrace(offsetPolyline(pl, 0.62), width, { activeP: 0.42 }); occ.markPolyline(pl, 2); }
    else occ.markPolyline(pl, 1);
    viaPts.push(pl[0], pl[pl.length - 1]);
  }

  traces.push(...extraTraces);

  /* --- Trace mesh --- */
  const traceMat = createTraceMaterial();
  const traceMesh = new THREE.Mesh(buildTraceGeometry(traces), traceMat);
  traceMesh.frustumCulled = false;
  group.add(traceMesh);

  /* --- Board slab + soldermask --- */
  const W = BOARD.x1 - BOARD.x0, D = BOARD.z1 - BOARD.z0;
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#1f2a1c', roughness: 0.8 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: '#050908', roughness: 1 });
  // Silk is drawn later (zones add labels) so we expose a finaliser.
  const maskMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.46, metalness: 0.0 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, BOARD.thickness, D), [edgeMat, edgeMat, maskMat, bottomMat, edgeMat, edgeMat]);
  slab.position.set((BOARD.x0 + BOARD.x1) / 2, -BOARD.thickness / 2, (BOARD.z0 + BOARD.z1) / 2);
  group.add(slab);

  /* --- Vias (instanced rings) + stitching vias --- */
  for (let i = 0; i < (lite ? 150 : 420); i++) {
    const x = Math.round(BOARD.x0 + 2 + rand() * (W - 4)), z = Math.round(BOARD.z0 + 2 + rand() * (D - 4));
    if (occ.isFree(x, z)) { viaPts.push([x, z]); occ.mark(x, z); }
  }
  const metal = new THREE.MeshStandardMaterial({ color: '#d9b26a', metalness: 1, roughness: 0.32 });
  const viaGeo = new THREE.RingGeometry(0.2, 0.46, 14).rotateX(-Math.PI / 2);
  const vias = new THREE.InstancedMesh(viaGeo, metal, viaPts.length);
  const holeGeo = new THREE.CircleGeometry(0.2, 10).rotateX(-Math.PI / 2);
  const holes = new THREE.InstancedMesh(holeGeo, new THREE.MeshBasicMaterial({ color: '#010202' }), viaPts.length);
  const m4 = new THREE.Matrix4();
  viaPts.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0.04, z); vias.setMatrixAt(i, m4);
    m4.makeTranslation(x, 0.042, z); holes.setMatrixAt(i, m4);
  });
  group.add(vias, holes);

  /* --- SMD components ------------------------------------------------- */
  const parts = placeParts({ occ, rand, lite, silk, metal });
  group.add(parts);

  /* --- Edge connector (gold fingers) --- */
  const gold = new THREE.MeshStandardMaterial({ color: '#f0c46a', metalness: 1, roughness: 0.2, emissive: '#3a2604', emissiveIntensity: 0.4 });
  const fGeo = new THREE.BoxGeometry(1.0, 0.06, CONNECTOR.z1 - CONNECTOR.z0 - 1.6);
  const fingersMesh = new THREE.InstancedMesh(fGeo, gold, fingers.length);
  fingers.forEach((fx, i) => { m4.makeTranslation(fx, 0.03, (CONNECTOR.z0 + CONNECTOR.z1) / 2 + 0.6); fingersMesh.setMatrixAt(i, m4); });
  group.add(fingersMesh);

  /* --- Mounting holes --- */
  const mh = new THREE.Mesh(new THREE.RingGeometry(1.6, 3.2, 40).rotateX(-Math.PI / 2), metal);
  [[BOARD.x0 + 6, BOARD.z0 + 6], [BOARD.x1 - 6, BOARD.z0 + 6], [BOARD.x0 + 6, BOARD.z1 - 12], [BOARD.x1 - 6, BOARD.z1 - 12]].forEach(([x, z]) => {
    const r = mh.clone(); r.position.set(x, 0.03, z); group.add(r);
    const h = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000' }));
    h.position.set(x, 0.035, z); group.add(h);
  });

  /* --- Silkscreen: global markings --- */
  silk.text(BOARD.x0 + 12, BOARD.z1 - 6, 'SIGNAL-PATH  REV 2.6   ·   D.A. MUREȘAN   ·   CLUJ-NAPOCA  RO', 1.5);
  silk.text(BOARD.x1 - 12, BOARD.z1 - 6, 'UTCN · RCSD · 2026', 1.5, { align: 'right' });
  silk.text(BOARD.x0 + 12, BOARD.z0 + 5, '⚠ ESD SENSITIVE   ·   94V-0   ·   ROHS', 1.2, { color: 'rgba(225,235,228,.55)' });
  silk.text(CONNECTOR.x0 - 2, CONNECTOR.z0 + 3.5, 'J1', 1.6, { align: 'right' });
  silk.text(CONNECTOR.x1 + 2, CONNECTOR.z0 + 3.5, 'EDGE · CONTACT', 1.2);
  [[BOARD.x0 + 14, BOARD.z0 + 14], [BOARD.x1 - 14, BOARD.z1 - 18]].forEach(([x, z]) => {
    silk.circle(x, z, 1.2); silk.circle(x, z, 0.5, { fill: true, color: 'rgba(210,170,100,.7)' });
  });
  for (let i = 0; i < 24; i++) silk.text(BOARD.x0 + 4, BOARD.z0 + 20 + i * 5, `TP${i + 1}`, 0.9, { color: 'rgba(225,235,228,.35)' });

  const finalize = () => { maskMat.map = silk.texture(renderer); maskMat.needsUpdate = true; };
  return { group, traceMat, finalize, fingers: fingersMesh, gold };
}

/* ---------- Component placement ------------------------------------------ */
function placeParts({ occ, rand, lite, silk, metal }) {
  const g = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tryPlace = (w, d, margin = 0.6) => {
    for (let a = 0; a < 40; a++) {
      const x = BOARD.x0 + 4 + rand() * (BOARD.x1 - BOARD.x0 - 8);
      const z = BOARD.z0 + 4 + rand() * (BOARD.z1 - BOARD.z0 - 10);
      if (occ.rectFree(x - w / 2 - margin, z - d / 2 - margin, x + w / 2 + margin, z + d / 2 + margin)) {
        occ.markRect(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
        return [x, z];
      }
    }
    return null;
  };

  /* Passives: ceramic caps (tan) & resistors (black) */
  const nPass = lite ? 220 : 620;
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.55 }), nPass);
  const term = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), metal, nPass * 2);
  const capCol = new THREE.Color('#9a7650'), resCol = new THREE.Color('#16181a'), c2 = new THREE.Color('#6d5137');
  let nb = 0, nt = 0;
  for (let i = 0; i < nPass; i++) {
    const big = rand() < 0.25;
    const L = big ? 2.0 : 1.2, Wd = big ? 1.1 : 0.62, H = big ? 0.7 : 0.45;
    const rot = rand() < 0.5;
    const spot = tryPlace(rot ? Wd : L, rot ? L : Wd, 0.4);
    if (!spot) continue;
    const [x, z] = spot;
    q.setFromAxisAngle(up, rot ? Math.PI / 2 : 0);
    const isRes = rand() < 0.4;
    m4.compose(p.set(x, H / 2, z), q, s.set(L * 0.7, H, Wd)); body.setMatrixAt(nb, m4);
    body.setColorAt(nb++, isRes ? resCol : rand() < 0.5 ? capCol : c2);
    for (const side of [-1, 1]) {
      const off = new THREE.Vector3(side * L * 0.42, H / 2, 0).applyQuaternion(q);
      m4.compose(p.set(x + off.x, H / 2 + 0.01, z + off.z), q, s.set(L * 0.16, H + 0.02, Wd + 0.02)); term.setMatrixAt(nt++, m4);
    }
    if (rand() < 0.35) silk.text(x, z + (rot ? 0 : Wd + 0.6), `${isRes ? 'R' : 'C'}${(rand() * 900 + 10) | 0}`, 0.7, { color: 'rgba(225,235,228,.5)', align: 'center' });
  }
  body.count = nb; term.count = nt;
  g.add(body, term);

  /* ICs (SOIC) with gull-wing legs */
  const nIC = lite ? 12 : 30;
  const icBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#0d0f11', roughness: 0.65 }), nIC);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#cfd3d6', metalness: 1, roughness: 0.3 }), nIC * 16);
  let ni = 0, nl = 0;
  for (let i = 0; i < nIC; i++) {
    const pins = 4 + ((rand() * 4) | 0), w = 3.2, d = pins * 0.9 + 0.4;
    const spot = tryPlace(w + 1.6, d, 0.8);
    if (!spot) continue;
    const [x, z] = spot;
    m4.compose(p.set(x, 0.55, z), q.identity(), s.set(w, 1.1, d)); icBody.setMatrixAt(ni++, m4);
    for (let k = 0; k < pins; k++) for (const side of [-1, 1]) {
      m4.compose(p.set(x + side * (w / 2 + 0.35), 0.18, z - d / 2 + 0.65 + k * 0.9), q, s.set(0.8, 0.14, 0.32));
      legs.setMatrixAt(nl++, m4);
    }
    silk.circle(x - w / 2 + 0.6, z - d / 2 - 0.9, 0.3, { fill: true });
    silk.text(x, z - d / 2 - 1.5, `IC${(rand() * 90 + 10) | 0}`, 0.9, { align: 'center' });
  }
  icBody.count = ni; legs.count = nl;
  g.add(icBody, legs);

  /* Electrolytic caps — the "skyscrapers" you fly past */
  const nEl = lite ? 8 : 18;
  const can = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 32), new THREE.MeshStandardMaterial({ color: '#141c2c', metalness: 0.5, roughness: 0.4 }), nEl);
  const top = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.92, 0.92, 0.1, 32), new THREE.MeshStandardMaterial({ color: '#b9c0c6', metalness: 1, roughness: 0.25 }), nEl);
  const stripe = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.01, 1.01, 1, 32, 1, true, 0, 0.9), new THREE.MeshStandardMaterial({ color: '#8b93a3', roughness: 0.5 }), nEl);
  let ne = 0;
  for (let i = 0; i < nEl; i++) {
    const r = 1.4 + rand() * 1.4, h = 2.5 + rand() * 3.5;
    const spot = tryPlace(r * 2, r * 2, 1);
    if (!spot) continue;
    const [x, z] = spot;
    m4.compose(p.set(x, h / 2, z), q.identity(), s.set(r, h, r)); can.setMatrixAt(ne, m4);
    m4.compose(p.set(x, h + 0.03, z), q, s.set(r, 1, r)); top.setMatrixAt(ne, m4);
    m4.compose(p.set(x, h / 2, z), q.setFromAxisAngle(up, rand() * 6.28), s.set(r, h * 0.98, r)); stripe.setMatrixAt(ne, m4);
    q.identity();
    silk.circle(x, z, r + 0.4);
    silk.text(x + r + 1, z, `+ C${(rand() * 90 + 100) | 0}`, 0.9);
    ne++;
  }
  can.count = top.count = stripe.count = ne;
  g.add(can, top, stripe);

  /* Power inductors */
  const nInd = lite ? 5 : 12;
  const ind = new THREE.InstancedMesh(new RoundedBox(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#2a2d30', roughness: 0.75, metalness: 0.2 }), nInd);
  let nn = 0;
  for (let i = 0; i < nInd; i++) {
    const sz = 3 + rand() * 2.5;
    const spot = tryPlace(sz, sz, 0.8);
    if (!spot) continue;
    m4.compose(p.set(spot[0], 1.1, spot[1]), q.identity(), s.set(sz, 2.2, sz)); ind.setMatrixAt(nn++, m4);
    silk.text(spot[0], spot[1] + sz / 2 + 1, `L${nn}`, 0.9, { align: 'center' });
  }
  ind.count = nn;
  g.add(ind);

  /* Crystals (silver HC-49 style) */
  const nX = lite ? 3 : 7;
  const xtal = new THREE.InstancedMesh(new RoundedBox(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#d8dde2', metalness: 1, roughness: 0.18 }), nX);
  let nx = 0;
  for (let i = 0; i < nX; i++) {
    const spot = tryPlace(5, 2, 0.8);
    if (!spot) continue;
    m4.compose(p.set(spot[0], 0.7, spot[1]), q.identity(), s.set(5, 1.4, 2)); xtal.setMatrixAt(nx++, m4);
    silk.text(spot[0], spot[1] - 1.9, `Y${nx} 25.000MHz`, 0.8, { align: 'center' });
  }
  xtal.count = nx;
  g.add(xtal);

  g.traverse((o) => { if (o.isInstancedMesh) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; } });
  return g;
}

/** Cheap rounded box: a box with bevelled edges via ExtrudeGeometry. */
function RoundedBox(w, h, d, r = 0.12) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r); shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d); shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * r * 0.5, bevelEnabled: true, bevelThickness: r * 0.5, bevelSize: r * 0.5, bevelSegments: 2, curveSegments: 3 });
  geo.rotateX(-Math.PI / 2);
  geo.center();
  return geo;
}
