/* i18n.js — tiny EN/RO system.
   Elements are rendered once; every translatable node is "bound" to its
   bilingual value so switching language only swaps text (no DOM rebuild,
   so scroll animations keep their references). */

const STORAGE_KEY = 'dm-lang';
const bindings = [];
const listeners = new Set();

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ro') return saved;
  } catch (_) { /* storage blocked: ignore */ }
  return 'en'; // English is the default
}

export let lang = initialLang();

/** Resolve a value that is either a plain string or { en, ro }. */
export function t(value) {
  if (value == null) return '';
  if (typeof value === 'object' && 'en' in value) return value[lang] ?? value.en;
  return String(value);
}

/**
 * Bind an element to a bilingual value.
 * mode: 'text' (default) | 'aria' (aria-label) | 'scramble' (heading with sr-only copy)
 */
export function bind(el, value, mode = 'text') {
  bindings.push({ el, value, mode });
  apply(el, value, mode);
  return el;
}

function apply(el, value, mode) {
  const text = t(value);
  if (mode === 'aria') el.setAttribute('aria-label', text);
  else if (mode === 'scramble') {
    // Screen readers read the sr-only copy; the visible copy may be "scrambled" by animations.
    el.querySelector('.sr-only').textContent = text;
    const vis = el.querySelector('[data-scramble-target]');
    vis.textContent = text;
    vis.dataset.final = text;
  } else el.textContent = text;
}

export function setLang(next) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  document.documentElement.lang = lang;
  bindings.forEach((b) => apply(b.el, b.value, b.mode));
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) { listeners.add(fn); }

document.documentElement.lang = lang;
