/* render.js — builds the whole page from content.js.
   Structure is semantic: <header><nav>, <main> with <section>s, <article> per project. */

import { site, ui, hero, about, projectsIntro, projects, skills, contact } from './content.js';
import { bind, lang, setLang } from './i18n.js';

/* ---- tiny DOM helper ---------------------------------------------------- */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') bind(el, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

/** Heading whose visible text can be "decoded" on reveal, with an accessible copy. */
function scrambleHeading(tag, value, cls) {
  const el = h(tag, { class: cls, 'data-scramble': '' },
    h('span', { class: 'sr-only' }),
    h('span', { 'aria-hidden': 'true', 'data-scramble-target': '' }));
  return bind(el, value, 'scramble');
}

const ext = { target: '_blank', rel: 'noopener noreferrer' };

const icons = {
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 4v14M6 12l6 6 6-6M5 21h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>',
  github: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 5h18v14H3zM3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};
const icon = (name) => { const s = h('span', { class: 'icon' }); s.innerHTML = icons[name]; return s; };

/* ---- Header ------------------------------------------------------------- */
function renderHeader() {
  const bar = document.getElementById('topbar');
  const navItems = ['about', 'projects', 'skills', 'contact'].map((id) =>
    h('li', {}, h('a', { href: `#${id}`, class: 'nav__link', 'data-nav': id, text: ui.nav[id] })));

  // Accessible name = visible "EN / RO" + a screen-reader hint (keeps label-in-name rule happy)
  const toggle = h('button', { class: 'lang', type: 'button' },
    h('span', { 'data-l': 'en' }, 'EN'), h('span', { class: 'lang__sep', 'aria-hidden': 'true' }, '/'), h('span', { 'data-l': 'ro' }, 'RO'),
    h('span', { class: 'sr-only', text: ui.langLabel }));
  const syncToggle = () => toggle.querySelectorAll('[data-l]').forEach((s) => s.classList.toggle('is-on', s.dataset.l === lang));
  syncToggle();
  toggle.addEventListener('click', () => { setLang(lang === 'en' ? 'ro' : 'en'); syncToggle(); });

  bar.append(
    h('a', { href: '#top', class: 'brand' },
      h('span', { class: 'brand__chip', 'aria-hidden': 'true' }, site.shortName),
      h('span', { class: 'brand__name' }, site.name)),
    h('nav', { class: 'nav', 'aria-label': 'Primary' }, h('ul', {}, navItems)),
    toggle,
  );
  bind(document.querySelector('[data-i18n-skip]'), ui.skip);
  bind(document.querySelector('[data-boot-label]'), ui.boot);
}

/* ---- Sections ----------------------------------------------------------- */
function renderHero() {
  const [first, ...rest] = site.name.split(' ');
  return h('section', { class: 'section hero', id: 'top', 'data-section': '0', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'wrap' },
      h('p', { class: 'eyebrow', 'data-reveal': '', text: hero.eyebrow }),
      h('h1', { class: 'hero__title', id: 'hero-title' },
        h('span', { class: 'line' }, h('span', { class: 'line__in' }, first)),
        h('span', { class: 'line' }, h('span', { class: 'line__in accent-grad' }, rest.join(' ')))),
      h('p', { class: 'hero__tagline', 'data-reveal': '', text: hero.tagline }),
      h('p', { class: 'status', 'data-reveal': '' }, h('span', { class: 'status__dot', 'aria-hidden': 'true' }), h('span', { text: hero.status })),
      h('div', { class: 'cta', 'data-reveal': '' },
        h('a', { class: 'btn btn--primary', href: '#projects' }, h('span', { text: hero.ctaPrimary }), icon('arrow')),
        h('a', { class: 'btn btn--ghost', href: site.links.cv, download: 'Davide-Muresan-CV.pdf' }, h('span', { text: hero.ctaSecondary }), icon('down')))),
    h('div', { class: 'scroll-cue', 'aria-hidden': 'true' }, h('span', { text: ui.scroll }), h('i')));
}

function renderAbout() {
  return h('section', { class: 'section about', id: 'about', 'data-section': '1', 'aria-labelledby': 'about-title' },
    h('div', { class: 'wrap panel' },
      h('p', { class: 'label', 'data-reveal': '', text: about.label }),
      Object.assign(scrambleHeading('h2', about.title, 'h2'), { id: 'about-title' }),
      ...about.body.map((p) => h('p', { class: 'lead', 'data-reveal': '', text: p })),
      h('ol', { class: 'timeline', 'aria-label': 'Timeline' },
        about.timeline.map((item) => h('li', { class: 'timeline__item', 'data-reveal': '' },
          h('p', { class: 'timeline__when mono', text: item.when }),
          h('h3', { class: 'timeline__what', text: item.what }),
          h('p', { class: 'timeline__where mono', text: item.where }),
          h('p', { class: 'timeline__note', text: item.note }))))));
}

function renderProjects() {
  const intro = h('div', { class: 'wrap projects__intro panel', 'data-anchor': 'projects' },
    h('p', { class: 'label', 'data-reveal': '', text: projectsIntro.label }),
    Object.assign(scrambleHeading('h2', projectsIntro.title, 'h2'), { id: 'projects-title' }),
    h('p', { class: 'lead', 'data-reveal': '', text: projectsIntro.sub }));

  const cards = projects.map((p, i) => {
    const link = p.github
      ? h('a', { class: 'btn btn--ghost btn--sm', href: p.github, ...ext }, icon('github'), h('span', { text: ui.viewCode }))
      : h('p', { class: 'project__private mono', text: ui.privateRepo });
    return h('article', { class: 'project', 'data-zone': String(i), 'data-anchor': `project-${i}`, 'aria-labelledby': `project-${i}-title` },
      h('div', { class: 'project__card panel', 'data-card': '' },
        h('div', { class: 'project__head' },
          h('span', { class: 'project__ref mono' }, `${p.ref} · 0${i + 1}`),
          h('span', { class: 'project__kind mono', text: p.kind })),
        h('h3', { class: 'project__title', id: `project-${i}-title`, 'data-reveal': '', text: p.title }),
        h('p', { class: 'project__desc', 'data-reveal': '', text: p.description }),
        h('dl', { class: 'metrics', 'data-reveal': '' },
          p.metrics.map((m) => h('div', { class: 'metric' }, h('dt', { class: 'metric__value' }, m.value), h('dd', { class: 'metric__label', text: m.label })))),
        h('ul', { class: 'tags', 'aria-label': 'Tech stack', 'data-reveal': '' }, p.stack.map((s) => h('li', { class: 'tag' }, s))),
        h('div', { class: 'project__foot', 'data-reveal': '' }, link)));
  });

  return h('section', { class: 'section projects', id: 'projects', 'data-section': '2', 'aria-labelledby': 'projects-title' }, intro, cards);
}

function renderSkills() {
  return h('section', { class: 'section skills', id: 'skills', 'data-section': '3', 'aria-labelledby': 'skills-title' },
    h('div', { class: 'wrap wrap--wide' },
      h('div', { class: 'skills__head' },
        h('p', { class: 'label', 'data-reveal': '', text: skills.label }),
        Object.assign(scrambleHeading('h2', skills.title, 'h2'), { id: 'skills-title' })),
      h('div', { class: 'ports' },
        skills.groups.map((g) => h('div', { class: 'port panel', 'data-reveal': '' },
          h('p', { class: 'port__id mono' }, g.port),
          h('h3', { class: 'port__name', text: g.name }),
          h('ul', { class: 'pins' }, g.items.map((it) => h('li', { class: 'pin' }, it)))))),
      h('div', { class: 'skills__extra' },
        h('div', { class: 'extra panel', 'data-reveal': '' },
          h('h3', { class: 'extra__title mono', text: skills.certsTitle }),
          h('ul', { class: 'extra__list' }, skills.certs.map((c) => h('li', { text: c })))),
        h('div', { class: 'extra panel', 'data-reveal': '' },
          h('h3', { class: 'extra__title mono', text: skills.langsTitle }),
          h('ul', { class: 'extra__list' }, skills.langs.map((c) => h('li', { text: c })))))));
}

function renderContact() {
  return h('section', { class: 'section contact', id: 'contact', 'data-section': '4', 'aria-labelledby': 'contact-title' },
    h('div', { class: 'wrap contact__wrap' },
      h('p', { class: 'label', 'data-reveal': '', text: contact.label }),
      Object.assign(scrambleHeading('h2', contact.title, 'h2 h2--xl'), { id: 'contact-title' }),
      h('p', { class: 'lead', 'data-reveal': '', text: contact.body }),
      h('a', { class: 'contact__email', href: `mailto:${site.email}`, 'data-reveal': '' },
        h('span', { class: 'contact__email-label mono', text: contact.emailLabel }),
        h('span', { class: 'contact__email-addr' }, site.email)),
      h('ul', { class: 'contact__links', 'data-reveal': '' },
        h('li', {}, h('a', { class: 'btn btn--primary', href: site.links.cv, download: 'Davide-Muresan-CV.pdf' }, icon('down'), h('span', { text: contact.cvLabel }))),
        h('li', {}, h('a', { class: 'btn btn--ghost', href: site.links.linkedin, ...ext }, icon('linkedin'), h('span', {}, 'LinkedIn'))),
        h('li', {}, h('a', { class: 'btn btn--ghost', href: site.links.github, ...ext }, icon('github'), h('span', {}, 'GitHub'))))));
}

function renderFooter() {
  const f = document.getElementById('footer');
  f.append(h('p', { class: 'mono', text: ui.footer }), h('p', { class: 'mono' }, `© ${new Date().getFullYear()} · ${site.location}`));
}

export function renderPage() {
  renderHeader();
  document.getElementById('main').append(renderHero(), renderAbout(), renderProjects(), renderSkills(), renderContact());
  renderFooter();
}
