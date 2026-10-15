// Angel OS, desktop shell: windows, menus, desktop icons and a dock.
import { APPS, SLOT, PROJECTS, PERSON, glyph, copyEmail, goNormal } from './content.js';
import { $, RM, say, clock, setWall, savedWall, WALLS, routeApp, setRoute } from './shared.js';

const layer = $('#windows');
const vw = () => innerWidth, vh = () => innerHeight;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MENU_H = 36, DOCK_SPACE = 104;
const BASE_TITLE = document.title;

let z = 40, count = 0, uid = 0, active = null;
const wins = new Map();

// ---------------------------------------------------------------- window manager
function ctxFor(win) {
  return {
    mode: 'desk',
    open: (id, opts, from) => open(id, opts, from),
    say,
    setTitle: (t) => setTitle(win, t),
    route: (r) => { win.route = r; if (active === win) setRoute(r); }
  };
}

export function open(id, opts = {}, from) {
  const app = APPS[id];
  if (!app) return null;
  const key = SLOT[id] || id;
  let win = wins.get(key);
  if (win) {
    if (win.min) restore(win);
    if (win.id !== id || id === 'viewer' || id === 'mail') build(win, id, opts);
    focusWin(win, true);
    return win;
  }
  win = createWin(id, key, app, from);
  build(win, id, opts);
  focusWin(win, true);
  return win;
}

function build(win, id, opts) {
  const app = APPS[id];
  win.id = id;
  win.route = app.route; // undefined keeps the current address (viewer, mail)
  win.el.classList.toggle('win--dark', !!app.dark);
  win.body.querySelectorAll('video').forEach((v) => v.pause());
  win.body.innerHTML = '';
  win.ctx = ctxFor(win);
  setTitle(win, app.title);
  app.build(win.body, opts, win.ctx);
}

function createWin(id, key, app, from) {
  let [w, h] = app.size;
  const maxH = vh() - MENU_H - DOCK_SPACE - 16;
  w = Math.min(w, vw() - 40);
  h = Math.min(h, maxH);
  let x, y;
  if (id === 'welcome') {
    x = Math.round((vw() - w) / 2 - Math.min(140, vw() * 0.07));
    y = Math.round(MENU_H + (maxH - h) / 2 + 8);
  } else {
    const n = count++ % 6;
    x = 120 + n * 34;
    y = MENU_H + 26 + n * 28;
  }
  x = clamp(x, 12, vw() - w - 12);
  y = clamp(y, MENU_H + 8, Math.max(MENU_H + 8, vh() - h - DOCK_SPACE));

  const el = document.createElement('section');
  const tid = 'wt-' + ++uid;
  el.className = 'win is-opening';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', tid);
  el.tabIndex = -1;
  el.innerHTML = `<div class="win__bar"><div class="lights">
      <button type="button" data-a="close" aria-label="Close window"></button>
      <button type="button" data-a="min" aria-label="Minimise window"></button>
      <button type="button" data-a="max" aria-label="Zoom window"></button>
    </div><h2 class="win__title" id="${tid}"></h2></div><div class="win__body"></div><div class="win__grip" aria-hidden="true"></div>`;
  Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  if (from && from.getBoundingClientRect) {
    const r = from.getBoundingClientRect();
    el.style.transformOrigin = `${r.left + r.width / 2 - x}px ${r.top + r.height / 2 - y}px`;
  }
  layer.appendChild(el);
  const win = { key, el, body: el.querySelector('.win__body'), from: from || document.activeElement };
  wins.set(key, win);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-opening')));
  wire(win);
  return win;
}

function setTitle(win, t) {
  win.title = t;
  win.el.querySelector('.win__title').textContent = t;
  if (active === win) docTitle(win);
}
const docTitle = (win) => { document.title = !win || win.id === 'welcome' ? BASE_TITLE : `${win.title}, Angel OS`; };

function focusWin(win, moveFocus) {
  if (active && active !== win) active.el.classList.remove('is-active');
  active = win;
  win.el.classList.add('is-active');
  win.el.style.zIndex = ++z;
  if (win.route !== undefined) setRoute(win.route);
  docTitle(win);
  if (moveFocus) (win.ctx && win.ctx.focusTarget ? win.ctx.focusTarget : win.el).focus({ preventScroll: true });
  updateDock();
}

function topWin() {
  return [...wins.values()].filter((w) => !w.min).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0] || null;
}

function closeWin(win) {
  if (!win || !wins.has(win.key)) return;
  wins.delete(win.key);
  win.el.querySelectorAll('video').forEach((v) => v.pause());
  win.el.classList.add('is-closing');
  setTimeout(() => win.el.remove(), RM ? 0 : 260);
  const back = win.from;
  if (active === win) {
    active = null;
    const next = topWin();
    if (next) focusWin(next, false); else { setRoute(null); docTitle(null); }
  }
  if (back && back !== document.body && document.contains(back) && !win.el.contains(back)) back.focus({ preventScroll: true });
  else if (active) active.el.focus({ preventScroll: true });
  updateDock();
}
const closeAll = () => [...wins.values()].forEach(closeWin);

function minimise(win) {
  win.min = true;
  const d = $('#dock').getBoundingClientRect(), r = win.el.getBoundingClientRect();
  win.el.style.transformOrigin = `${d.left + d.width / 2 - r.left}px ${d.top - r.top}px`;
  win.el.classList.add('is-min');
  win.el.querySelectorAll('video').forEach((v) => { v.setAttribute('data-hold', ''); v.pause(); });
  if (active === win) { active = null; const next = topWin(); if (next) focusWin(next, true); else setRoute(null); }
  updateDock();
}
function restore(win) {
  if (!win.min) return;
  win.min = false;
  win.el.classList.remove('is-min');
  win.el.querySelectorAll('video').forEach((v) => { v.removeAttribute('data-hold'); if (v.autoplay || v.hasAttribute('data-motion')) v.play().catch(() => {}); });
  updateDock();
}
function toggleMax(win) {
  const s = win.el.style;
  if (win.prev) { Object.assign(s, win.prev); win.prev = null; return; }
  win.prev = { left: s.left, top: s.top, width: s.width, height: s.height };
  Object.assign(s, { left: '8px', top: MENU_H + 6 + 'px', width: vw() - 16 + 'px', height: vh() - MENU_H - 6 - DOCK_SPACE + 'px' });
}
function tidy() {
  [...wins.values()].filter((w) => !w.min).forEach((w, i) => { w.prev = null; Object.assign(w.el.style, { left: 100 + i * 40 + 'px', top: MENU_H + 24 + i * 34 + 'px' }); focusWin(w, false); });
}

function wire(win) {
  const el = win.el, bar = el.querySelector('.win__bar');
  el.addEventListener('pointerdown', () => { if (active !== win) focusWin(win, false); });
  el.addEventListener('focusin', () => { if (active !== win) focusWin(win, false); });
  el.querySelectorAll('.lights button').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    ({ close: () => closeWin(win), min: () => minimise(win), max: () => toggleMax(win) })[b.dataset.a]();
  }));
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#menu').classList.contains('is-open')) { e.stopPropagation(); closeWin(win); } });
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('.lights')) toggleMax(win); });
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.lights') || e.button !== 0) return;
    bar.setPointerCapture(e.pointerId);
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
    el.classList.add('is-dragging');
    document.body.classList.add('is-dragging');
    const mv = (ev) => {
      el.style.left = clamp(ev.clientX - sx, -el.offsetWidth + 140, vw() - 140) + 'px';
      el.style.top = clamp(ev.clientY - sy, MENU_H, vh() - 60) + 'px';
    };
    const up = () => { el.classList.remove('is-dragging'); document.body.classList.remove('is-dragging'); bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); };
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  });
  const grip = el.querySelector('.win__grip');
  grip.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); grip.setPointerCapture(e.pointerId);
    const sw = el.offsetWidth, sh = el.offsetHeight, sx = e.clientX, sy = e.clientY;
    el.classList.add('is-dragging'); document.body.classList.add('is-dragging');
    const mv = (ev) => { el.style.width = Math.max(340, sw + ev.clientX - sx) + 'px'; el.style.height = Math.max(240, sh + ev.clientY - sy) + 'px'; };
    const up = () => { el.classList.remove('is-dragging'); document.body.classList.remove('is-dragging'); grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); };
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
  });
}

// ---------------------------------------------------------------- desktop icons
const P = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
const ICONS = [
  { label: 'Topout', html: glyph('folder', { p: P.topout }), app: 'topout' },
  { label: 'Atlas Pay', html: glyph('folder', { p: P.atlas }), app: 'atlas' },
  { label: 'POG', html: glyph('folder', { p: P.pog }), app: 'pog' },
  { label: 'about.txt', html: glyph('file', { ext: 'TXT' }), app: 'about' },
  { label: 'contact.vcf', html: glyph('file', { ext: 'VCF' }), app: 'contact' },
  { label: 'Old logos', html: glyph('trash'), app: 'trash' }
];
const iconsEl = $('#icons');
ICONS.forEach((ic) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon';
  b.innerHTML = `${ic.html}<span class="icon__label">${ic.label}</span>`;
  b.addEventListener('click', () => open(ic.app, {}, b));
  iconsEl.appendChild(b);
});

// sticky note: drag it anywhere
const sticky = $('#sticky');
sticky.addEventListener('pointerdown', (e) => {
  sticky.setPointerCapture(e.pointerId);
  const r = sticky.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  sticky.classList.add('is-held');
  const mv = (ev) => Object.assign(sticky.style, { left: ev.clientX - sx + 'px', top: ev.clientY - sy + 'px', bottom: 'auto' });
  sticky.addEventListener('pointermove', mv);
  sticky.addEventListener('pointerup', () => { sticky.removeEventListener('pointermove', mv); sticky.classList.remove('is-held'); }, { once: true });
});

// ---------------------------------------------------------------- dock
const DOCK = [
  { id: 'welcome', tip: 'Welcome', g: 'Hi', hot: true },
  { id: 'work', tip: 'Work', g: '<span class="dock-folder" aria-hidden="true"></span>', has: (k) => k === 'folder' },
  { id: 'mail', tip: 'Write an email', g: '@' },
  { id: 'term', tip: 'Terminal', g: '&gt;_', dark: true },
  'sep',
  { tip: 'Behance', g: 'Bē', href: PERSON.behance },
  { tip: 'LinkedIn', g: 'in', href: PERSON.linkedin }
];
const dock = $('#dock');
DOCK.forEach((a) => {
  if (a === 'sep') { const s = document.createElement('span'); s.className = 'dock__sep'; s.setAttribute('aria-hidden', 'true'); dock.appendChild(s); return; }
  const el = document.createElement(a.href ? 'a' : 'button');
  el.className = 'app' + (a.hot ? ' app--hot' : '') + (a.dark ? ' app--dark' : '');
  if (a.id) el.dataset.id = a.id;
  if (a.href) { el.href = a.href; el.target = '_blank'; el.rel = 'noopener'; el.setAttribute('aria-label', a.tip + ' (opens in a new tab)'); }
  else { el.type = 'button'; el.setAttribute('aria-label', a.tip); el.addEventListener('click', () => open(a.id, {}, el)); }
  el.innerHTML = `<span class="app__g" aria-hidden="true">${a.g}</span><span class="app__tip" aria-hidden="true">${a.tip}</span>`;
  dock.appendChild(el);
});
const minSep = document.createElement('span'); minSep.className = 'dock__sep'; minSep.hidden = true;
const minWrap = document.createElement('div'); minWrap.className = 'dock__min';
dock.append(minSep, minWrap);
function updateDock() {
  dock.querySelectorAll('[data-id]').forEach((el) => {
    const id = el.dataset.id;
    const on = id === 'work' ? wins.has('folder') : wins.has(id);
    el.classList.toggle('has-dot', on);
  });
  const mins = [...wins.values()].filter((w) => w.min);
  minSep.hidden = !mins.length;
  minWrap.innerHTML = '';
  mins.forEach((w) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mini-win'; b.textContent = w.title;
    b.setAttribute('aria-label', 'Restore ' + w.title);
    b.addEventListener('click', () => { restore(w); focusWin(w, true); });
    minWrap.appendChild(b);
  });
}

// ---------------------------------------------------------------- menus
const link = (url) => () => window.open(url, '_blank', 'noopener');
const MENUS = [
  ['Angel OS', [['Welcome', () => open('welcome')], ['About this site', () => open('about')], '-', ['Switch to normal website', goNormal], ['Restart', () => restart()]]],
  ['File', [['New Work window', () => open('work'), 'Alt N'], ['Close window', () => active && closeWin(active), 'Alt W'], ['Close all windows', closeAll]]],
  ['Work', [['Topout', () => open('topout')], ['Atlas Pay', () => open('atlas')], ['POG', () => open('pog')], '-', ['Old logos', () => open('trash')], ['Terminal', () => open('term')]]],
  ['View', [['Tidy windows', tidy], '-', ...Object.keys(WALLS).map((k) => [`Wallpaper: ${k}`, () => setWall($('#wall'), k)])]],
  ['Contact', [['Write an email…', () => open('mail')], ['Copy email address', () => copyEmail({ say })], ['Contact card', () => open('contact')], '-', ['Behance', link(PERSON.behance)], ['LinkedIn', link(PERSON.linkedin)]]]
];
const bar = $('#menubar'), menu = $('#menu');
const roots = MENUS.map(([name], i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'menu-root' + (i === 0 ? ' menu-logo' : '');
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.innerHTML = i === 0 ? `<span class="dot" aria-hidden="true"></span>${name}` : name;
  bar.appendChild(b);
  return b;
});
let openIdx = -1;
function showMenu(i, focusFirst) {
  const items = MENUS[i][1];
  menu.innerHTML = items.map((it, k) => (it === '-' ? '<hr role="separator">' : `<button type="button" role="menuitem" tabindex="-1" data-k="${k}">${it[0]}${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`)).join('');
  menu.querySelectorAll('[role=menuitem]').forEach((b) => b.addEventListener('click', () => { hideMenu(false); items[+b.dataset.k][1](); }));
  const r = roots[i].getBoundingClientRect();
  menu.style.left = r.left + 'px';
  menu.hidden = false;
  menu.classList.add('is-open');
  roots.forEach((x, k) => { x.classList.toggle('is-open', k === i); x.setAttribute('aria-expanded', String(k === i)); });
  openIdx = i;
  if (focusFirst) menu.querySelector('[role=menuitem]').focus();
}
function hideMenu(refocus) {
  if (openIdx < 0) return;
  const was = roots[openIdx];
  menu.classList.remove('is-open'); menu.hidden = true;
  roots.forEach((x) => { x.classList.remove('is-open'); x.setAttribute('aria-expanded', 'false'); });
  openIdx = -1;
  if (refocus) was.focus();
}
roots.forEach((b, i) => {
  b.addEventListener('click', (e) => { e.stopPropagation(); openIdx === i ? hideMenu(false) : showMenu(i, e.detail === 0); });
  b.addEventListener('pointerenter', () => { if (openIdx >= 0 && openIdx !== i) showMenu(i, false); });
  b.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); showMenu(i, true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); roots[(i + 1) % roots.length].focus(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); roots[(i - 1 + roots.length) % roots.length].focus(); }
  });
});
menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('[role=menuitem]')];
  const k = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(k + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(k - 1 + items.length) % items.length].focus(); }
  if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
  if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = (openIdx + (e.key === 'ArrowRight' ? 1 : -1) + roots.length) % roots.length; showMenu(n, true); }
  if (e.key === 'Tab') hideMenu(false);
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menu, .menu-root')) hideMenu(false); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openIdx >= 0) { hideMenu(true); return; }
  if (e.altKey && e.code === 'KeyW') { e.preventDefault(); if (active) closeWin(active); }
  if (e.altKey && e.code === 'KeyN') { e.preventDefault(); open('work'); }
  if (active && active.ctx && active.ctx.step && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input, textarea, [role=menu], .menubar')) {
    e.preventDefault(); active.ctx.step(e.key === 'ArrowRight' ? 1 : -1);
  }
});

// skip link: jump into the front window
$('.skip').addEventListener('click', (e) => { e.preventDefault(); (active ? active.el : layer).focus(); });

// ---------------------------------------------------------------- boot
clock($('#clock'), true);
setWall($('#wall'), savedWall());

const LINES = ['ANGEL OS 3.0', '', 'checking type systems ............ ok', 'loading 3d holds .................. ok', 'mounting /work/topout ............. ok', 'mounting /work/atlas-pay .......... ok', 'mounting /work/pog ................ ok'];
let booted = false, timers = [];
function start() {
  if (booted) return;
  booted = true;
  timers.forEach(clearTimeout); timers = [];
  $('#boot').classList.add('is-done');
  setTimeout(() => open(routeApp() || 'welcome'), RM ? 0 : 280);
}
function boot(force) {
  let seen = false;
  try { seen = sessionStorage.getItem('aos-boot') === '1'; sessionStorage.setItem('aos-boot', '1'); } catch (e) {}
  const el = $('#boot'), log = $('#boot-log'), barEl = $('#boot-bar');
  booted = false;
  if ((seen || RM || location.hash) && !force) { el.classList.add('is-done'); start(); return; }
  el.classList.remove('is-done'); log.innerHTML = ''; barEl.innerHTML = '<i></i>'.repeat(28);
  const dots = barEl.querySelectorAll('i');
  LINES.forEach((l, i) => timers.push(setTimeout(() => { const d = document.createElement('div'); d.textContent = l || ' '; log.appendChild(d); }, i * 170)));
  dots.forEach((d, i) => timers.push(setTimeout(() => d.classList.add('on'), 200 + i * 48)));
  timers.push(setTimeout(start, 1700));
}
function restart() { try { sessionStorage.removeItem('aos-boot'); } catch (e) {} closeAll(); setTimeout(() => boot(true), 300); }
const skip = () => { if (!booted) start(); };
window.addEventListener('keydown', skip);
$('#boot').addEventListener('pointerdown', skip);
window.addEventListener('hashchange', () => { const id = routeApp(); if (id) open(id); });

boot(false);
