// Angel OS, phone shell: a home screen of apps; each app opens full screen and stacks.
import { APPS, PROJECTS, PERSON, glyph } from './content.js';
import { $, RM, say, clock, setWall, savedWall, routeApp } from './shared.js';

const P = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
const home = $('#home'), sheetsEl = $('#sheets');
const stack = [];

// ---------------------------------------------------------------- sheets
function ctxFor(sheet) {
  return {
    mode: 'phone',
    open: (id, opts, from) => openSheet(id, opts, from),
    say,
    setTitle: (t) => { sheet.el.querySelector('.sheet__title').textContent = t; },
    route: () => {}
  };
}

function openSheet(id, opts = {}, from, { push = true } = {}) {
  const app = APPS[id];
  if (!app) return;
  const depth = stack.length;
  const el = document.createElement('section');
  const tid = 'st-' + Date.now();
  el.className = 'sheet is-opening' + (app.dark ? ' sheet--dark' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', tid);
  el.tabIndex = -1;
  el.innerHTML = `<header class="sheet__bar">
      <button type="button" class="sheet__back">${depth ? '<span aria-hidden="true">&lsaquo;</span> Back' : '<span aria-hidden="true">&lsaquo;</span> Home'}</button>
      <h2 class="sheet__title" id="${tid}"></h2><span class="sheet__spacer" aria-hidden="true"></span>
    </header><div class="sheet__body"></div>
    <button type="button" class="sheet__home" aria-label="Go to the home screen"><i aria-hidden="true"></i></button>`;
  sheetsEl.appendChild(el);
  const sheet = { id, el, from: from || document.activeElement };
  sheet.ctx = ctxFor(sheet);
  sheet.ctx.setTitle(app.title || '');
  app.build(el.querySelector('.sheet__body'), opts, sheet.ctx);
  stack.push(sheet);
  setInert();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-opening')));
  (sheet.ctx.focusTarget && id !== 'term' ? sheet.ctx.focusTarget : el).focus({ preventScroll: true });
  el.querySelector('.sheet__back').addEventListener('click', () => history.back());
  el.querySelector('.sheet__home').addEventListener('click', goHome);
  swipeHome(el.querySelector('.sheet__home'));
  if (push) history.pushState({ sheet: stack.length }, '', app.route ? '#' + app.route : location.hash || location.pathname);
}

// one history entry per sheet, so the phone's back gesture closes the top app
function popSheet() {
  const sheet = stack.pop();
  if (!sheet) return;
  sheet.el.querySelectorAll('video').forEach((v) => v.pause());
  sheet.el.classList.add('is-closing');
  setTimeout(() => sheet.el.remove(), RM ? 0 : 340);
  setInert();
  const back = sheet.from;
  if (back && document.contains(back) && !sheet.el.contains(back)) back.focus({ preventScroll: true });
}
window.addEventListener('popstate', (e) => {
  const want = (e.state && e.state.sheet) || 0;
  while (stack.length > want) popSheet();
});
function goHome() { if (stack.length) history.go(-stack.length); }

function setInert() {
  const top = stack[stack.length - 1];
  home.inert = !!top;
  $('#phone-dock').inert = !!top;
  stack.forEach((s) => { s.el.inert = s !== top; });
}

// drag the bar at the bottom up to go home
function swipeHome(handle) {
  let sy = null;
  handle.addEventListener('pointerdown', (e) => { sy = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointerup', (e) => { if (sy !== null && sy - e.clientY > 30) goHome(); sy = null; });
}

// ---------------------------------------------------------------- home screen
const SPRING = [
  { label: 'Topout', html: glyph('folder', { p: P.topout }), app: 'topout' },
  { label: 'Atlas Pay', html: glyph('folder', { p: P.atlas }), app: 'atlas' },
  { label: 'POG', html: glyph('folder', { p: P.pog }), app: 'pog' },
  { label: 'Work', html: '<span class="tile tile--hot" aria-hidden="true"><span class="dock-folder"></span></span>', app: 'work' },
  { label: 'About', html: glyph('file', { ext: 'TXT' }), app: 'about' },
  { label: 'Contact', html: glyph('file', { ext: 'VCF' }), app: 'contact' },
  { label: 'Terminal', html: '<span class="tile tile--dark" aria-hidden="true">&gt;_</span>', app: 'term' },
  { label: 'Old logos', html: glyph('trash'), app: 'trash' }
];
const spring = $('#springboard');
SPRING.forEach((a) => {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'spring-app';
  b.innerHTML = `<span class="spring-app__icon">${a.html}</span><span class="spring-app__label">${a.label}</span>`;
  b.addEventListener('click', () => openSheet(a.app, {}, b));
  li.appendChild(b);
  spring.appendChild(li);
});

const DOCK = [
  { label: 'Email', g: '@', href: `mailto:${PERSON.email}` },
  { label: 'Behance', g: 'Bē', href: PERSON.behance, ext: true },
  { label: 'LinkedIn', g: 'in', href: PERSON.linkedin, ext: true },
  { label: 'Hello', g: 'Hi', app: 'welcome', hot: true }
];
const dock = $('#phone-dock');
DOCK.forEach((a) => {
  const el = document.createElement(a.href ? 'a' : 'button');
  el.className = 'phone-app' + (a.hot ? ' phone-app--hot' : '');
  if (a.href) { el.href = a.href; if (a.ext) { el.target = '_blank'; el.rel = 'noopener'; } }
  else { el.type = 'button'; el.addEventListener('click', () => openSheet(a.app, {}, el)); }
  el.setAttribute('aria-label', a.label + (a.ext ? ' (opens in a new tab)' : ''));
  el.innerHTML = `<span aria-hidden="true">${a.g}</span>`;
  dock.appendChild(el);
});

clock($('#phone-clock'), false);
setWall($('#phone-wall'), savedWall());

// a shared link like guleranangel.com/#topout opens straight into that app, with Back going home
const first = routeApp();
history.replaceState({ sheet: 0 }, '', location.pathname + location.search);
if (first) openSheet(first);
$('.skip').addEventListener('click', (e) => { e.preventDefault(); (stack.length ? stack[stack.length - 1].el : $('#widget-name')).focus(); });
