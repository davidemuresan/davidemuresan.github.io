/* packets.js — copper traces + the light "packets" travelling along them.
   All traces are merged into ONE geometry and drawn with ONE shader:
   every vertex knows its distance along its trace, so pulses are pure math
   in the fragment shader (no per-frame CPU work). */

import * as THREE from 'three';

const vert = /* glsl */ `
  attribute vec4 aData;            // x: distance along trace, y: side (-1..1), z: seed, w: active
  varying vec4 vData;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vData = aData;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;     // boot: radius of the "power-on" wave from the chip
  uniform float uBoost;      // global extra brightness (scroll velocity)
  uniform vec3 uCopper;
  uniform vec3 uPulseA;
  uniform vec3 uPulseB;
  uniform vec4 uZones[4];    // xy = centre, z = radius, w = activation 0..1
  uniform vec4 uFocus;       // extra highlight disc (xy, radius, strength)
  varying vec4 vData;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  void main() {
    float along = vData.x, side = vData.y, seed = vData.z, isOn = vData.w;
    float core = 1.0 - smoothstep(0.55, 1.0, abs(side));

    // Copper: brighter at grazing angles (fake specular sheen)
    vec3 V = normalize(cameraPosition - vWorld);
    float graze = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0);
    vec3 col = uCopper * (0.32 + 0.22 * core + graze * 0.9);

    // Zone highlight
    float boost = 0.0;
    for (int i = 0; i < 4; i++) {
      float d = distance(vWorld.xz, uZones[i].xy);
      boost += uZones[i].w * (1.0 - smoothstep(uZones[i].z * 0.35, uZones[i].z, d));
    }
    float fd = distance(vWorld.xz, uFocus.xy);
    boost += uFocus.w * (1.0 - smoothstep(uFocus.z * 0.3, uFocus.z, fd));

    // Packets: a bright head followed by an exponential tail
    float speed = 7.0 + seed * 13.0 + boost * 14.0;
    float period = 20.0 + fract(seed * 7.13) * 46.0 - boost * 8.0;
    float x = mod(uTime * speed - along + seed * 97.0, period);
    float tail = exp(-x * 0.26);
    float head = exp(-x * 2.6);
    vec3 pc = mix(uPulseA, uPulseB, step(0.84, fract(seed * 13.7)));
    float lit = max(isOn, boost * 0.85);
    col += pc * (tail * 1.4 + head * 4.5) * lit * core * (1.0 + boost * 1.6 + uBoost);
    col += uPulseA * boost * 0.18 * core;

    // Power-on wave
    float dist = length(vWorld.xz);
    float shown = 1.0 - smoothstep(uReveal - 10.0, uReveal, dist);
    float front = exp(-abs(dist - uReveal) * 0.45) * (1.0 - step(190.0, uReveal));
    col = col * (0.15 + 0.85 * shown) + uPulseA * front * 2.2 * core;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createTraceMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uBoost: { value: 0 },
        uCopper: { value: new THREE.Color('#b8743f') },
        uPulseA: { value: new THREE.Color('#5ff0ff') },
        uPulseB: { value: new THREE.Color('#ffc46b') },
        uZones: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) },
        uFocus: { value: new THREE.Vector4(0, 0, 1, 0) },
      },
    ]),
  });
}

/**
 * Build one merged ribbon mesh from many 2D polylines.
 * @param {{pts:[number,number][], width:number, seed:number, active:number, reverse?:boolean}[]} traces
 */
export function buildTraceGeometry(traces, y = 0.025) {
  let vCount = 0, iCount = 0;
  for (const t of traces) { vCount += t.pts.length * 2; iCount += (t.pts.length - 1) * 6; }
  const pos = new Float32Array(vCount * 3);
  const data = new Float32Array(vCount * 4);
  const index = new Uint32Array(iCount);
  let v = 0, ii = 0;

  for (const t of traces) {
    const p = t.pts, n = p.length, hw = t.width / 2;
    // cumulative length
    const acc = [0];
    for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const total = acc[n - 1];
    const base = v;
    for (let i = 0; i < n; i++) {
      // miter join normal
      const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(n - 1, i + 1)];
      let d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = c[0] - b[0], d2z = c[1] - b[1];
      if (i === 0) { d1x = d2x; d1z = d2z; }
      if (i === n - 1) { d2x = d1x; d2z = d1z; }
      const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
      const n1x = -d1z / l1, n1z = d1x / l1, n2x = -d2z / l2, n2z = d2x / l2;
      let mx = n1x + n2x, mz = n1z + n2z;
      const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const k = hw / Math.max(0.35, mx * n1x + mz * n1z);
      const along = t.reverse ? total - acc[i] : acc[i];
      for (let s = 0; s < 2; s++) {
        const sign = s === 0 ? 1 : -1;
        pos[v * 3] = b[0] + mx * k * sign;
        pos[v * 3 + 1] = y;
        pos[v * 3 + 2] = b[1] + mz * k * sign;
        data[v * 4] = along; data[v * 4 + 1] = sign; data[v * 4 + 2] = t.seed; data[v * 4 + 3] = t.active;
        v++;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a0 = base + i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
      index.set([a0, b0, a1, a1, b0, b1], ii); ii += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aData', new THREE.BufferAttribute(data, 4));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

/* ---- Floating dust / "charge" particles for depth ----------------------- */
export function createDust(count, rand) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (rand() - 0.5) * 160;
    p[i * 3 + 1] = 0.4 + Math.pow(rand(), 1.6) * 30;
    p[i * 3 + 2] = -70 + rand() * 170;
    s[i] = rand();
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.3 + aSeed * 30.0) * 0.6;
        p.x += sin(uTime * 0.17 + aSeed * 11.0) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (1.0 + aSeed * 2.2) * (40.0 / -mv.z);
        vA = (0.25 + 0.75 * fract(aSeed * 17.0)) * (1.0 - smoothstep(10.0, 120.0, -mv.z)) * (0.6 + 0.4 * sin(uTime + aSeed * 50.0));
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA;
        gl_FragColor = vec4(vec3(0.45, 0.95, 1.0) * 1.4 * a, a);
      }`,
  });
  return new THREE.Points(g, m);
}
