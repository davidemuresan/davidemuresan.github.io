/* zones.js — one functional block per project. Each zone lights up when its
   project card is on screen (activation 0..1 comes from flightPath.js).
     Z0 SafeCross   → AI accelerator + RGB / thermal camera modules + "detection" hologram
     Z1 Campus Net  → three switch "buildings" with blinking ports, OSPF triangle
     Z2 TalentMatch → memory controller + DRAM bank streaming data + "match" hologram
     Z3 FPGA        → LUT fabric die, I2C / SPI headers and an Ethernet jack */

import * as THREE from 'three';
import { ZONES } from './layout.js';
import { createDieMaterial } from './chip.js';

const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

/** Traces that belong to zones (merged into the board's single trace mesh). World coords. */
export function zoneTraces() {
  const out = [];
  const z1 = ZONES[1];
  // OSPF triangle between the three switches
  const A = [z1.x - 6, z1.z + 2], B = [z1.x + 6, z1.z + 2], C = [z1.x, z1.z - 6];
  for (const [p, q] of [[A, B], [B, C], [C, A]]) for (let k = -1; k <= 1; k++) {
    out.push({ pts: [[p[0], p[1] + k * 0.8], [q[0], q[1] + k * 0.8]], width: 0.42, seed: Math.random(), active: 1, reverse: k === 0 });
  }
  return out;
}

/* Hologram label (canvas sprite) */
function holoLabel(lines, color = '#5ff0ff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(6, 6, 500, 148);
  g.fillStyle = 'rgba(95,240,255,0.08)'; g.fillRect(6, 6, 500, 148);
  // auto-fit each line inside the frame
  const fit = (text, size, weight) => {
    g.font = `${weight} ${size}px "JetBrains Mono", monospace`;
    const w = g.measureText(text).width;
    if (w > 460) g.font = `${weight} ${Math.floor(size * 460 / w)}px "JetBrains Mono", monospace`;
  };
  g.fillStyle = color;
  fit(lines[0], 54, 500); g.fillText(lines[0], 26, 72);
  g.globalAlpha = 0.75; fit(lines[1], 30, 400); g.fillText(lines[1], 26, 124);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.scale.set(5.2, 1.62, 1);
  return s;
}

/* Ring + light column that marks the active zone */
function marker(half) {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5ff0ff').multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(half * 1.18, half * 1.22, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), ringMat);
  ring.position.y = 0.06;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(half * 1.18, half * 1.2, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), ringMat.clone());
  ring2.position.y = 0.06;
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOp: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uOp, uTime; varying vec2 vUv;
      void main(){ float a = pow(1.0 - vUv.y, 2.2) * uOp; a *= 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 4.0);
        gl_FragColor = vec4(vec3(0.37, 0.94, 1.0) * a * 1.4, a); }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(half * 1.2, half * 1.2, 16, 4, 1, true, Math.PI / 4), beamMat);
  beam.position.y = 8;
  g.add(ring, ring2, beam);
  return {
    group: g,
    update(t, a) {
      ringMat.opacity = a;
      const k = (t * 0.6) % 1;
      ring2.scale.setScalar(1 + k * 0.35); ring2.material.opacity = a * (1 - k);
      beamMat.uniforms.uOp.value = a * 0.22; beamMat.uniforms.uTime.value = t;
    },
  };
}

export function buildZones({ silk, metal, lite }) {
  const zones = [];
  const dark = new THREE.MeshStandardMaterial({ color: '#0c0e10', roughness: 0.6, metalness: 0.2 });
  const shield = new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 1, roughness: 0.28 });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.7 });

  ZONES.forEach((Z, i) => {
    const group = new THREE.Group();
    group.position.set(Z.x, 0, Z.z);
    const updates = [];
    const mk = marker(Z.half);
    group.add(mk.group);
    silk.rect(Z.x - Z.half, Z.z - Z.half, Z.x + Z.half, Z.z + Z.half, { corners: true, color: 'rgba(95,240,255,.55)' });
    silk.text(Z.x - Z.half, Z.z + Z.half + 1.6, Z.label, 1.3, { color: 'rgba(225,235,228,.85)' });

    let holo = null;

    if (i === 0) {
      /* SafeCross — AI accelerator */
      group.add(box(15, 0.8, 15, dark, 0, 0.4, -1));
      const die = createDieMaterial({ cells: 8, style: 1, colorA: '#5ff0ff', colorB: '#ff7a3d', glow: 0.5 });
      const dieMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), [dark, dark, die, dark, dark, dark]);
      dieMesh.position.set(0, 1.05, -1); group.add(dieMesh);
      updates.push((t, a) => { die.uniforms.uTime.value = t; die.uniforms.uGlow.value = 0.35 + a * 1.4; });
      // RGB + thermal camera modules
      [['#5ff0ff', -4], ['#ff6a2b', 4]].forEach(([col, x]) => {
        group.add(box(4, 1.6, 3.4, blackPlastic, x, 0.8, 8.6));
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 1.6, 32), new THREE.MeshStandardMaterial({ color: '#111316', metalness: 0.8, roughness: 0.3 }));
        barrel.position.set(x, 2.4, 8.6); group.add(barrel);
        const glass = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#05080c', metalness: 1, roughness: 0.05 }));
        glass.position.set(x, 3.21, 8.6); group.add(glass);
        const lensRing = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.06, 8, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2) }));
        lensRing.position.set(x, 3.22, 8.6); group.add(lensRing);
        updates.push((t, a) => lensRing.material.color.set(col).multiplyScalar(0.5 + a * 2.5 * (0.8 + 0.2 * Math.sin(t * 5 + x))));
      });
      silk.text(Z.x - 4, Z.z + 11.2, 'RGB', 0.9, { align: 'center' });
      silk.text(Z.x + 4, Z.z + 11.2, 'THERMAL', 0.9, { align: 'center' });
      // Detection "bounding box" hologram
      const bb = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 4.6, 3)), new THREE.LineBasicMaterial({ color: new THREE.Color('#5ff0ff').multiplyScalar(2), transparent: true, opacity: 0 }));
      bb.position.set(0, 4.1, -1); group.add(bb);
      holo = holoLabel(['PEDESTRIAN 0.93', 'intent: CROSSING · 20 ms']);
      holo.position.set(0, 7.6, -1);
      updates.push((t, a) => { bb.material.opacity = a; bb.rotation.y = t * 0.4; });
    }

    if (i === 1) {
      /* Campus network — three switch "buildings" */
      const spots = [[-6, 2], [6, 2], [0, -6]];
      const nPorts = 6;
      const ports = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.62, 0.2), new THREE.MeshBasicMaterial({ color: '#000' }), spots.length * nPorts * 2);
      const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.2) });
      const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.14, 0.1), ledMat, spots.length * nPorts * 2);
      const m4 = new THREE.Matrix4(); let n = 0;
      spots.forEach(([x, z], s) => {
        const h = 2.6 + s * 0.9;
        group.add(box(5.6, h, 3.8, shield, x, h / 2, z));
        group.add(box(5.7, 0.25, 3.9, dark, x, h + 0.12, z));
        for (let r = 0; r < 2; r++) for (let p = 0; p < nPorts; p++) {
          const px = x - 2.2 + p * 0.88, py = 0.6 + r * 0.95;
          m4.makeTranslation(px, Math.min(py, h - 0.6), z + 1.92); ports.setMatrixAt(n, m4);
          m4.makeTranslation(px + 0.22, Math.min(py, h - 0.6) + 0.42, z + 1.95); leds.setMatrixAt(n, m4);
          leds.setColorAt(n, new THREE.Color('#3dff9a')); n++;
        }
        silk.text(Z.x + x, Z.z + z - 2.8, ['SW-A', 'SW-B', 'SW-CORE'][s], 0.9, { align: 'center' });
      });
      group.add(ports, leds);
      const green = new THREE.Color('#3dff9a'), amber = new THREE.Color('#ffb648'), off = new THREE.Color('#06150d'), tmp = new THREE.Color();
      const seeds = Array.from({ length: n }, () => Math.random());
      updates.push((t, a) => {
        for (let k = 0; k < n; k++) {
          const on = Math.sin(t * (6 + seeds[k] * 18) + seeds[k] * 50) > (0.2 - a * 0.6);
          tmp.copy(on ? (seeds[k] > 0.8 ? amber : green) : off).multiplyScalar(0.35 + a * 0.9);
          leds.setColorAt(k, tmp);
        }
        leds.instanceColor.needsUpdate = true;
      });
      holo = holoLabel(['OSPF AREA 0 · FULL', '3 sites · VLAN · DMZ · SSH']);
      holo.position.set(-3, 6.4, 1);
    }

    if (i === 2) {
      /* TalentMatch — memory bank + controller */
      const ctrl = createDieMaterial({ cells: 6, glow: 0.5 });
      group.add(box(7, 0.7, 7, dark, -4.5, 0.35, 0));
      const c = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 4.6), [dark, dark, ctrl, dark, dark, dark]);
      c.position.set(-4.5, 0.9, 0); group.add(c);
      const nD = 4;
      const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.06, 6.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2) }), nD);
      const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.12, 0.26), metal, nD * 22);
      const m4 = new THREE.Matrix4(); let np = 0;
      for (let k = 0; k < nD; k++) {
        const x = 1.6 + k * 2.6;
        group.add(box(1.8, 1.0, 8, dark, x, 0.5, 0));
        m4.makeTranslation(x, 1.03, 0); strips.setMatrixAt(k, m4); strips.setColorAt(k, new THREE.Color('#5ff0ff'));
        for (let p = 0; p < 11; p++) for (const sd of [-1, 1]) { m4.makeTranslation(x + sd * 1.05, 0.08, -3.4 + p * 0.68); pins.setMatrixAt(np++, m4); }
        silk.text(Z.x + x, Z.z - 5.2, `D${k}`, 0.8, { align: 'center' });
      }
      group.add(strips, pins);
      const col = new THREE.Color(), cyan = new THREE.Color('#5ff0ff'), gold = new THREE.Color('#ffc46b');
      updates.push((t, a) => {
        ctrl.uniforms.uTime.value = t; ctrl.uniforms.uGlow.value = 0.4 + a * 1.3;
        for (let k = 0; k < nD; k++) {
          const ph = Math.max(0, Math.sin(t * 5 - k * 0.9));
          col.copy(k % 2 ? gold : cyan).multiplyScalar(0.15 + a * (0.4 + ph * 1.6));
          strips.setColorAt(k, col);
        }
        strips.instanceColor.needsUpdate = true;
      });
      holo = holoLabel(['MATCH SCORE 0.87', 'semantic + rules · Gemini']);
      holo.position.set(2, 5.2, -1);
    }

    if (i === 3) {
      /* FPGA — LUT fabric + protocol headers */
      group.add(box(14, 0.9, 14, dark, -1, 0.45, 1));
      const fab = createDieMaterial({ cells: 16, style: 2, colorA: '#ffc46b', colorB: '#5ff0ff', glow: 0.5 });
      const f = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 10), [dark, dark, fab, dark, dark, dark]);
      f.position.set(-1, 1.1, 1); group.add(f);
      updates.push((t, a) => { fab.uniforms.uTime.value = t; fab.uniforms.uGlow.value = 0.35 + a * 1.3; });
      // pin headers
      const pinMat = new THREE.MeshStandardMaterial({ color: '#f0c46a', metalness: 1, roughness: 0.25 });
      [['I2C', -6, 4], ['SPI', 0.5, 6]].forEach(([name, x, n]) => {
        group.add(box(n * 1.0, 1.0, 1.2, blackPlastic, x, 0.5, -8.6));
        const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 2.6, 0.26), pinMat, n);
        const m4 = new THREE.Matrix4();
        for (let k = 0; k < n; k++) { m4.makeTranslation(x - (n - 1) / 2 + k, 1.3, -8.6); pins.setMatrixAt(k, m4); }
        group.add(pins);
        silk.text(Z.x + x, Z.z - 10.1, name, 1.0, { align: 'center' });
      });
      // Ethernet magjack
      group.add(box(4.2, 3.4, 5, shield, 8.2, 1.7, 1));
      group.add(box(2.2, 1.6, 0.3, new THREE.MeshBasicMaterial({ color: '#000' }), 8.2, 1.4, 3.55));
      const led = box(0.5, 0.3, 0.1, new THREE.MeshBasicMaterial({ color: new THREE.Color('#3dff9a').multiplyScalar(2) }), 7, 2.6, 3.56);
      group.add(led);
      updates.push((t, a) => { led.visible = Math.sin(t * 14) > 0.3 - a; });
      silk.text(Z.x + 8.2, Z.z + 4.6, 'ETH', 1.0, { align: 'center' });
      holo = holoLabel(['TX ▸ RX · LOCKED', 'I²C · SPI · ETHERNET · VHDL']);
      holo.position.set(2, 5.4, 0);
    }

    if (holo) group.add(holo);
    zones.push({
      group,
      update(t, a) {
        mk.update(t, a);
        if (holo) { holo.material.opacity = a * 0.85; holo.position.y += (Math.sin(t * 1.5 + i) * 0.003); }
        updates.forEach((u) => u(t, a));
      },
    });
  });
  return zones;
}
