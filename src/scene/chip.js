/* chip.js — the central SoC (BGA package + glowing silicon die)
   and the reusable "die" shader (also used by the AI accelerator and FPGA zones). */

import * as THREE from 'three';
import { CHIP } from './layout.js';

/** Procedural silicon die: a grid of cores that flicker, a travelling wave and a scan line. */
export function createDieMaterial({ cells = 12, colorA = '#5ff0ff', colorB = '#e8b04a', glow = 1, style = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGlow: { value: glow },
      uCells: { value: cells },
      uStyle: { value: style },     // 0 = SoC cores, 1 = neural grid, 2 = FPGA LUT fabric
      uA: { value: new THREE.Color(colorA) },
      uB: { value: new THREE.Color(colorB) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uGlow, uCells, uStyle; uniform vec3 uA, uB;
      varying vec2 vUv; varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 g = vUv * uCells; vec2 id = floor(g); vec2 f = fract(g);
        float h = hash(id);
        float border = max(1.0 - smoothstep(0.0, 0.05, min(f.x, f.y)), 1.0 - smoothstep(0.0, 0.05, min(1.0 - f.x, 1.0 - f.y)));
        vec2 inner2 = smoothstep(0.12, 0.18, f) * (1.0 - smoothstep(0.82, 0.88, f));
        float inner = inner2.x * inner2.y;
        float flick = pow(0.5 + 0.5 * sin(uTime * (0.8 + h * 3.0) + h * 40.0), 5.0);
        float wave = 0.5 + 0.5 * sin(length(id - uCells * 0.5) * 0.9 - uTime * 2.2);
        // sub-pattern inside each core
        vec2 sub = fract(f * (uStyle > 1.5 ? 4.0 : 3.0));
        float subl = (1.0 - smoothstep(0.0, 0.08, min(sub.x, sub.y))) * inner;

        vec3 V = normalize(cameraPosition - vWorld);
        float irid = 0.5 + 0.5 * sin(dot(V.xz, vec2(6.0, 4.0)) + vUv.x * 4.0);
        vec3 silicon = mix(vec3(0.02, 0.035, 0.06), vec3(0.06, 0.04, 0.09), irid);

        vec3 col = silicon;
        vec3 c = mix(uA, uB, step(0.86, h));
        col += c * inner * (0.08 + flick * 0.9 + wave * 0.35) * uGlow;
        col += uA * subl * 0.25 * uGlow;
        col += uB * border * 0.22 * (0.6 + 0.4 * wave);
        // scan line
        float scan = exp(-abs(vUv.y - fract(uTime * 0.12)) * 80.0);
        col += uA * scan * 0.9 * uGlow;
        // frame
        vec2 e = min(vUv, 1.0 - vUv);
        col += uB * (1.0 - smoothstep(0.0, 0.012, min(e.x, e.y))) * 1.2;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildChip({ silk, metal }) {
  const group = new THREE.Group();
  group.position.set(CHIP.x, 0, CHIP.z);
  const P = CHIP.pkg, D = CHIP.die;

  // BGA solder balls peeking out under the substrate
  const balls = [];
  for (let r = 0; r < 2; r++) {
    const e = P / 2 - 0.7 - r * 1.1;
    for (let i = -7; i <= 7; i++) {
      const t = (i / 7) * e;
      balls.push([t, -e], [t, e], [-e, t], [e, t]);
    }
  }
  const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: 1, roughness: 0.25 }), balls.length);
  const m4 = new THREE.Matrix4();
  balls.forEach(([x, z], i) => { m4.makeTranslation(x, 0.3, z); ballMesh.setMatrixAt(i, m4); });
  group.add(ballMesh);

  // Substrate (organic, dark green with gold edge)
  const sub = new THREE.Mesh(new THREE.BoxGeometry(P, 0.5, P), new THREE.MeshStandardMaterial({ color: '#0e2a22', roughness: 0.3, metalness: 0.1 }));
  sub.position.y = 0.85;
  group.add(sub);

  // Small caps on the substrate around the die
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.5 }), 40);
  let n = 0;
  for (let i = 0; i < 10; i++) {
    const t = -6.3 + i * 1.4;
    [[t, -7.9], [t, 7.9], [-7.9, t], [7.9, t]].forEach(([x, z]) => { m4.makeTranslation(x, 1.28, z); caps.setMatrixAt(n++, m4); });
  }
  group.add(caps);

  // Die
  const dieMat = createDieMaterial({ cells: 12, glow: 1.2 });
  const side = new THREE.MeshStandardMaterial({ color: '#0a0c10', metalness: 0.6, roughness: 0.35 });
  const die = new THREE.Mesh(new THREE.BoxGeometry(D, 0.7, D), [side, side, dieMat, side, side, side]);
  die.position.y = 1.45;
  group.add(die);

  // Gold seal ring around the die
  const ring = new THREE.Mesh(new THREE.RingGeometry(D * 0.72, D * 0.74, 4, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), metal);
  ring.position.y = 1.11;
  group.add(ring);

  // Light that makes the chip "breathe" onto nearby parts
  const light = new THREE.PointLight('#5ff0ff', 60, 42, 1.6);
  light.position.set(0, 5, 0);
  group.add(light);

  silk.text(CHIP.x - P / 2, CHIP.z + P / 2 + 1.6, 'U1  DAM-SoC  ·  NET/AI', 1.4);
  silk.rect(CHIP.x - P / 2 - 1, CHIP.z - P / 2 - 1, CHIP.x + P / 2 + 1, CHIP.z + P / 2 + 1, { corners: true });
  silk.circle(CHIP.x - P / 2 - 2, CHIP.z - P / 2 - 2, 0.5, { fill: true });

  return { group, dieMat, light };
}
