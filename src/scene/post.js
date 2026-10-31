/* post.js — desktop-only post-processing:
   MSAA render → bloom → "lens" pass (velocity-driven chromatic aberration,
   vignette, film grain) → output (tone mapping + sRGB). */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/* Guards the HDR buffer before bloom: some GPU drivers occasionally output NaN/Inf
   for a pixel (e.g. extreme specular); bloom's blur would smear it into black blocks. */
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, 48.0);
    }`,
};

const LensShader = {
  uniforms: { tDiffuse: { value: null }, uAberration: { value: 0 }, uTime: { value: 0 }, uVignette: { value: 0.9 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uAberration, uTime, uVignette; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * (0.0006 + uAberration * 0.014) * (0.4 + r2 * 2.5);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= 1.0 - smoothstep(0.18, 0.75, r2) * uVignette;
      col += (rand(vUv * 1000.0 + uTime) - 0.5) * 0.012;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, w, h, samples = 0) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const sanitize = new ShaderPass(SanitizeShader);
  composer.addPass(sanitize);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.55, 0.92);
  composer.addPass(bloom);
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, lens, sanitize,
    setSize(w2, h2) { composer.setSize(w2, h2); },
  };
}
