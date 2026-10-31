/* scroll.js — smooth scroll (Lenis) + GSAP ScrollTrigger UI choreography.
   Exposes `scrollState` which the 3D scene reads every frame. */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { onLangChange } from './i18n.js';

gsap.registerPlugin(ScrollTrigger);

/** Shared, read by the WebGL scene (no coupling to Lenis itself). */
export const scrollState = { y: 0, velocity: 0, max: 1, progress: 0 };

let lenis = null;

export function initScroll({ reduced }) {
  if (!reduced) {
    lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true, touchMultiplier: 1.4 });
    lenis.on('scroll', (e) => {
      scrollState.velocity = e.velocity;
      ScrollTrigger.update();
    });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const read = () => {
    scrollState.y = window.scrollY;
    scrollState.max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scrollState.progress = scrollState.y / scrollState.max;
    if (!lenis) scrollState.velocity *= 0.9;
  };
  gsap.ticker.add(read);
  read();

  // In-page links → smooth scroll + move focus for keyboard / screen-reader users
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const done = () => { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); };
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 2.2, onComplete: done });
    else { target.scrollIntoView(); done(); }
    history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
  });

  setupHud();
  if (!reduced) setupReveals();
}

/* ---- Hero intro (called once the boot overlay leaves) ------------------- */
export function playIntro({ reduced }) {
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.hero__title .line__in', { y: 0, duration: 1.4, stagger: 0.12 })
    .to('.hero [data-reveal]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, 0.25)
    .from('.topbar', { opacity: 0, y: -16, duration: 1 }, 0.3);
}

/* ---- Scroll-driven reveals --------------------------------------------- */
function setupReveals() {
  // Generic fade-up for everything outside the hero
  gsap.utils.toArray('[data-reveal]').filter((el) => !el.closest('.hero')).forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
    });
  });

  // Project cards: clip-path wipe in, like a scan reaching the block
  gsap.utils.toArray('[data-card]').forEach((card) => {
    gsap.to(card, {
      clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: 'expo.inOut',
      scrollTrigger: { trigger: card, start: 'top 80%', toggleActions: 'play none none reverse' },
    });
    // gentle parallax drift as the card passes
    gsap.fromTo(card, { y: 60 }, {
      y: -60, ease: 'none',
      scrollTrigger: { trigger: card.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Headings "decode" like a signal locking in
  gsap.utils.toArray('[data-scramble]').forEach((el) => {
    const target = el.querySelector('[data-scramble-target]');
    ScrollTrigger.create({ trigger: el, start: 'top 85%', onEnter: () => scramble(target) });
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } });
  });
  onLangChange(() => document.querySelectorAll('[data-scramble-target]').forEach(scramble));

  // Section transition sweep + chromatic kick (scene reads scrollState.kick)
  const sweep = document.getElementById('sweep');
  document.querySelectorAll('[data-section]').forEach((sec, i) => {
    if (i === 0) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%',
      onEnter: () => fireSweep(sweep), onLeaveBack: () => fireSweep(sweep),
    });
  });
}

function fireSweep(sweep) {
  sweep.classList.remove('is-on');
  void sweep.offsetWidth; // restart CSS animation
  sweep.classList.add('is-on');
  scrollState.kick = 1;
}

const GLYPHS = '01<>/\\[]{}#$%&*+=ABCDEF∆◊';
function scramble(el) {
  const final = el.dataset.final || el.textContent; // always read the current language's text
  const len = final.length;
  const obj = { p: 0 };
  el._scrambleTween?.kill(); // a running decode (e.g. in the other language) must not finish later
  el._scrambleTween = gsap.to(obj, {
    p: 1, duration: Math.min(1.4, 0.5 + len * 0.02), ease: 'power2.out',
    onUpdate: () => {
      const n = Math.floor(obj.p * len);
      let out = final.slice(0, n);
      for (let i = n; i < len; i++) out += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
    },
    onComplete: () => { el.textContent = final; },
  });
}

/* ---- HUD + nav state ---------------------------------------------------- */
function setupHud() {
  const bar = document.getElementById('hud-bar');
  const idx = document.getElementById('hud-index');
  gsap.ticker.add(() => { bar.style.transform = `scaleX(${scrollState.progress.toFixed(4)})`; });

  const links = document.querySelectorAll('[data-nav]');
  document.querySelectorAll('[data-section]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => {
        if (!self.isActive) return;
        idx.textContent = String(Number(sec.dataset.section) + 1).padStart(2, '0');
        links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === sec.id));
      },
    });
  });
}

export function refreshScroll() { ScrollTrigger.refresh(); }
