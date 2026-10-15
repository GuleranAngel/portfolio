// Angel OS, desktop shell: windows, menus, desktop icons, a dock and right-click menus.
import { APPS, SLOT, PROJECTS, PERSON, glyph, copyEmail, copyText, goNormal, linkFor, store, caseUrl } from './content.js';
import { $, RM, say, clock, setWall, savedWall, WALLS, wallField, routeApp, setRoute } from './shared.js';

const desk = $('#desk'), layer = $('#windows');
const vw = () => innerWidth, vh = () => innerHeight;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MENU_H = 34, DOCK_SPACE = 100, ICON_W = 96, ICON_H = 100;
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
    route: (r) => { win.route = r; if (active === win) setRoute(r); },
    menu: (items, e) => showMenuAt(items, e.clientX, e.clientY),
    close: () => closeWin(win)
  };
}

export function open(id, opts = {}, from) {
  const app = APPS[id];
  if (!app) return null;
  const key = SLOT[id] || id;
  let win = wins.get(key);
  if (win) {
    if (win.min) restore(win);
    if (win.id !== id || ['viewer', 'mail', 'info'].includes(id)) build(win, id, opts);
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
  win.body.classList.toggle('win__body--fixed', id === 'viewer');
}

function createWin(id, key, app, from) {
  let [w, h] = app.size;
  const maxH = vh() - MENU_H - DOCK_SPACE - 16;
  w = Math.min(w, vw() - 160);
  h = Math.min(h, maxH);
  let x, y;
  if (id === 'welcome') {
    x = Math.round((vw() - w) / 2 + 40);
    y = Math.round(MENU_H + (maxH - h) / 2 + 8);
  } else {
    const n = count++ % 6;
    x = 150 + n * 34;
    y = MENU_H + 26 + n * 28;
  }
  x = clamp(x, 120, Math.max(120, vw() - w - 16));
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
    </div><h2 class="win__title" id="${tid}"></h2></div><div class="win__body"></div>
    ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => `<div class="win__edge win__edge--${d}" data-edge="${d}" aria-hidden="true"></div>`).join('')}`;
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
const topWin = () => [...wins.values()].filter((w) => !w.min).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0] || null;

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
  win.el.querySelectorAll('video').forEach((v) => { v.removeAttribute('data-hold'); if (v.autoplay) v.play().catch(() => {}); });
  updateDock();
}
const full = () => ({ left: '0px', top: MENU_H + 'px', width: vw() + 'px', height: vh() - MENU_H - DOCK_SPACE + 'px' });
function toggleMax(win) {
  const s = win.el.style;
  win.el.classList.add('is-animating');
  setTimeout(() => win.el.classList.remove('is-animating'), 320);
  if (win.prev) { Object.assign(s, win.prev); win.prev = null; return; }
  win.prev = { left: s.left, top: s.top, width: s.width, height: s.height };
  Object.assign(s, full());
}
function tidy() {
  [...wins.values()].filter((w) => !w.min).forEach((w, i) => { w.prev = null; Object.assign(w.el.style, { left: 150 + i * 40 + 'px', top: MENU_H + 24 + i * 34 + 'px' }); focusWin(w, false); });
}

// drag to the left or right edge to fill half the screen, to the top to fill all of it
const snapEl = document.createElement('div');
snapEl.className = 'snap-preview'; snapEl.hidden = true; desk.appendChild(snapEl);
const snapFor = (x, y) => {
  if (y <= MENU_H + 2) return full();
  if (x <= 4) return { left: '0px', top: MENU_H + 'px', width: vw() / 2 + 'px', height: vh() - MENU_H - DOCK_SPACE + 'px' };
  if (x >= vw() - 5) return { left: vw() / 2 + 'px', top: MENU_H + 'px', width: vw() / 2 + 'px', height: vh() - MENU_H - DOCK_SPACE + 'px' };
  return null;
};

function wire(win) {
  const el = win.el, bar = el.querySelector('.win__bar');
  el.addEventListener('pointerdown', () => { if (active !== win) focusWin(win, false); });
  el.addEventListener('focusin', () => { if (active !== win) focusWin(win, false); });
  el.querySelectorAll('.lights button').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    ({ close: () => closeWin(win), min: () => minimise(win), max: () => toggleMax(win) })[b.dataset.a]();
  }));
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menuOpen()) { e.stopPropagation(); closeWin(win); } });
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('.lights')) toggleMax(win); });
  bar.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showMenuAt([['Minimise', () => minimise(win)], [win.prev ? 'Restore size' : 'Zoom', () => toggleMax(win)], '-', ['Close', () => closeWin(win), 'Alt W']], e.clientX, e.clientY);
  });
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.lights') || e.button !== 0) return;
    bar.setPointerCapture(e.pointerId);
    // the window moves with a transform while dragging (no layout work per frame), then settles into left/top
    let x0 = el.offsetLeft, y0 = el.offsetTop, w = el.offsetWidth, sx = e.clientX - x0, sy = e.clientY - y0, nx = x0, ny = y0, snap = null, moved = false;
    const vW = vw(), vH = vh();
    const mv = (ev) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
        moved = true; el.classList.add('is-dragging'); document.body.classList.add('is-dragging');
        // dragging a zoomed window out of its slot shrinks it back under the pointer
        if (win.prev) { const k = (e.clientX - x0) / w; Object.assign(el.style, { width: win.prev.width, height: win.prev.height }); win.prev = null; w = el.offsetWidth; sx = w * k; }
      }
      nx = clamp(ev.clientX - sx, -w + 80, vW - 80);
      ny = clamp(ev.clientY - sy, MENU_H, vH - 40);
      el.style.transform = `translate3d(${nx - x0}px, ${ny - y0}px, 0)`;
      const next = snapFor(ev.clientX, ev.clientY);
      if (!!next !== !!snap || (next && next.left + next.width !== snap.left + snap.width)) { snapEl.hidden = !next; if (next) Object.assign(snapEl.style, next); }
      snap = next;
    };
    const up = () => {
      bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
      snapEl.hidden = true;
      if (!moved) return;
      Object.assign(el.style, { transform: '', left: nx + 'px', top: ny + 'px' });
      void el.offsetWidth; // settle before the transition comes back, so nothing animates from the old spot
      el.classList.remove('is-dragging'); document.body.classList.remove('is-dragging');
      if (snap) { win.prev = { left: el.style.left, top: Math.max(MENU_H + 8, ny) + 'px', width: el.style.width, height: el.style.height }; el.classList.add('is-animating'); Object.assign(el.style, snap); setTimeout(() => el.classList.remove('is-animating'), 320); }
    };
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  });
  // resize from any edge or corner
  el.querySelectorAll('[data-edge]').forEach((h) => h.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); h.setPointerCapture(e.pointerId);
    const d = h.dataset.edge, r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }, sx = e.clientX, sy = e.clientY;
    el.classList.add('is-dragging'); document.body.classList.add('is-dragging'); win.prev = null;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h: hh } = r;
      if (d.includes('e')) w = Math.max(340, r.w + dx);
      if (d.includes('s')) hh = Math.max(220, r.h + dy);
      if (d.includes('w')) { w = Math.max(340, r.w - dx); x = r.x + r.w - w; }
      if (d.includes('n')) { hh = Math.max(220, r.h - dy); y = Math.max(MENU_H, r.y + r.h - hh); hh = r.y + r.h - y; }
      Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
    };
    const up = () => { el.classList.remove('is-dragging'); document.body.classList.remove('is-dragging'); h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
  }));
}

// ---------------------------------------------------------------- desktop icons
// Left column by default. Click selects, double-click opens, drag moves (all selected icons together),
// drag on the empty desktop draws a selection box, right-click shows what you can do.
const P = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
const ICONS = [
  { id: 'topout', label: 'Topout', html: glyph('folder', { p: P.topout }), app: 'topout', p: P.topout },
  { id: 'atlas', label: 'Atlas Pay', html: glyph('folder', { p: P.atlas }), app: 'atlas', p: P.atlas },
  { id: 'pog', label: 'POG', html: glyph('folder', { p: P.pog }), app: 'pog', p: P.pog },
  { id: 'about', label: 'about.txt', html: glyph('file', { ext: 'TXT' }), app: 'about' },
  { id: 'contact', label: 'contact.vcf', html: glyph('file', { ext: 'VCF' }), app: 'contact' },
  { id: 'term', label: 'Terminal', html: '<span class="glyph glyph--term" aria-hidden="true">&gt;_</span>', app: 'term' },
  { id: 'trash', label: 'Old logos', html: glyph('trash'), app: 'trash' },
  { id: 'topped', label: 'topped-out.txt', html: glyph('file', { ext: 'TXT' }), app: 'topped', secret: true }
];
const iconsEl = $('#icons');
const icons = [];
const slot = (i) => { const perCol = Math.max(1, Math.floor((vh() - MENU_H - DOCK_SPACE - 16) / ICON_H)); return { x: 14 + Math.floor(i / perCol) * (ICON_W + 8), y: MENU_H + 14 + (i % perCol) * ICON_H }; };
const saved = store.get('icons') || {};
function placeIcon(ic, i) {
  const pos = saved[ic.id] && saved[ic.id].x < vw() - 40 && saved[ic.id].y < vh() - 60 ? saved[ic.id] : slot(i);
  ic.x = pos.x; ic.y = pos.y;
  ic.el.style.transform = `translate(${ic.x}px, ${ic.y}px)`;
}
const saveIcons = () => store.set('icons', Object.fromEntries(icons.map((ic) => [ic.id, { x: ic.x, y: ic.y }])));
function cleanUp() { icons.filter((ic) => !ic.el.hidden).forEach((ic, i) => { const p = slot(i); ic.x = p.x; ic.y = p.y; ic.el.classList.add('is-gliding'); ic.el.style.transform = `translate(${ic.x}px, ${ic.y}px)`; setTimeout(() => ic.el.classList.remove('is-gliding'), 300); }); saveIcons(); }

const selected = new Set();
const select = (ic, add) => {
  if (!add) { selected.forEach((s) => s.el.classList.remove('is-sel')); selected.clear(); }
  if (ic) { selected.add(ic); ic.el.classList.add('is-sel'); }
};

ICONS.forEach((def, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon';
  b.innerHTML = `${def.html}<span class="icon__label">${def.label}</span>`;
  const ic = { ...def, el: b };
  icons.push(ic);
  iconsEl.appendChild(b);
  if (def.secret && !store.get('topped')) b.hidden = true;
  placeIcon(ic, icons.filter((x) => !x.el.hidden).length - 1);

  b.addEventListener('dblclick', () => open(ic.app, {}, b));
  b.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); open(ic.app, {}, b); }
    if (e.key === ' ') { e.preventDefault(); select(ic, e.shiftKey || e.ctrlKey || e.metaKey); }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = b.getBoundingClientRect(); iconMenu(ic, r.right, r.top + 20, true); }
  });
  b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!selected.has(ic)) select(ic); iconMenu(ic, e.clientX, e.clientY); });
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!selected.has(ic) || add) select(ic, add);
    // touch screens: a tap opens, like a phone
    if (e.pointerType !== 'mouse') b.dataset.tap = '1';
    const start = { x: e.clientX, y: e.clientY }, group = [...selected].map((s) => ({ s, x: s.x, y: s.y }));
    let dragging = false;
    b.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 4) return;
      if (!dragging) { dragging = true; b.dataset.tap = ''; group.forEach(({ s }) => s.el.classList.add('is-dragged')); document.body.classList.add('is-dragging'); }
      group.forEach((g) => { g.s.x = clamp(g.x + dx, 0, vw() - ICON_W); g.s.y = clamp(g.y + dy, MENU_H, vh() - ICON_H); g.s.el.style.transform = `translate(${g.s.x}px, ${g.s.y}px)`; });
    };
    const up = () => {
      b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
      document.body.classList.remove('is-dragging');
      if (dragging) {
        group.forEach(({ s }) => { s.el.classList.remove('is-dragged'); s.x = Math.round(s.x / 8) * 8; s.y = Math.round(s.y / 8) * 8; s.el.style.transform = `translate(${s.x}px, ${s.y}px)`; });
        saveIcons();
      } else if (b.dataset.tap) { b.dataset.tap = ''; open(ic.app, {}, b); }
    };
    b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
});

function iconMenu(ic, x, y, focusFirst) {
  const many = selected.size > 1;
  const items = [[many ? `Open ${selected.size} items` : 'Open', () => (many ? [...selected] : [ic]).forEach((s) => open(s.app, {}, s.el))]];
  if (ic.p && !many) items.push(['Get info', () => open('info', { p: ic.p }, ic.el)], ['Read the case study', () => { location.href = caseUrl(ic.p); }], ['Copy link', () => copyText(linkFor(ic.id), { say }, 'Link copied')]);
  if (ic.id === 'contact') items.push(['Copy email address', () => copyEmail({ say })]);
  items.push('-', ['Move to Old logos', () => say(ic.id === 'trash' ? 'It is already in there.' : 'Nope. That one is a keeper.')]);
  showMenuAt(items, x, y, focusFirst);
}

// selection box on the empty desktop
const marquee = document.createElement('div');
marquee.className = 'marquee'; marquee.hidden = true; desk.appendChild(marquee);
desk.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('.win, .menubar, .menu, .dock, .icon, .sticky')) return;
  hideMenu(false);
  select(null);
  if (active) { active.el.classList.remove('is-active'); active = null; setRoute(null); docTitle(null); }
  const sx = e.clientX, sy = e.clientY;
  desk.setPointerCapture(e.pointerId);
  const mv = (ev) => {
    const x = Math.min(sx, ev.clientX), y = Math.max(MENU_H, Math.min(sy, ev.clientY)), w = Math.abs(ev.clientX - sx), h = Math.abs(ev.clientY - sy);
    if (w + h < 4) return;
    marquee.hidden = false;
    Object.assign(marquee.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    icons.forEach((ic) => {
      if (ic.el.hidden) return;
      const r = ic.el.getBoundingClientRect();
      const hit = r.left < x + w && r.right > x && r.top < y + h && r.bottom > y;
      if (hit && !selected.has(ic)) { selected.add(ic); ic.el.classList.add('is-sel'); }
      if (!hit && selected.has(ic)) { selected.delete(ic); ic.el.classList.remove('is-sel'); }
    });
  };
  const up = () => { marquee.hidden = true; desk.removeEventListener('pointermove', mv); desk.removeEventListener('pointerup', up); };
  desk.addEventListener('pointermove', mv); desk.addEventListener('pointerup', up);
});
desk.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.win, .icon, .menu')) return;
  if (e.target.closest('.menubar, .dock')) return e.preventDefault();
  e.preventDefault();
  showMenuAt([
    ['New Work window', () => open('work')],
    ['Open Terminal', () => open('term')],
    '-',
    ...Object.keys(WALLS).map((k) => [`Wallpaper: ${k}`, () => setWall($('#wall'), k)]),
    '-',
    ['Clean up icons', cleanUp],
    ['Tidy windows', tidy],
    '-',
    ['About this site', () => open('about')],
    ['Switch to normal website', goNormal]
  ], e.clientX, e.clientY);
});

// sticky note: drag it anywhere
const sticky = $('#sticky');
sticky.addEventListener('pointerdown', (e) => {
  sticky.setPointerCapture(e.pointerId);
  const r = sticky.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  sticky.classList.add('is-held');
  const mv = (ev) => Object.assign(sticky.style, { left: ev.clientX - sx + 'px', top: ev.clientY - sy + 'px', bottom: 'auto', right: 'auto' });
  sticky.addEventListener('pointermove', mv);
  sticky.addEventListener('pointerup', () => { sticky.removeEventListener('pointermove', mv); sticky.classList.remove('is-held'); }, { once: true });
});

// ---------------------------------------------------------------- dock
const DOCK = [
  { id: 'welcome', tip: 'Welcome', g: 'Hi', hot: true },
  { id: 'work', tip: 'Work', g: '<span class="dock-folder" aria-hidden="true"></span>' },
  { id: 'mail', tip: 'Write an email', g: '@' },
  { id: 'term', tip: 'Terminal', g: '&gt;_', dark: true },
  'sep',
  { tip: 'Behance', g: 'Bē', href: PERSON.behance },
  { tip: 'LinkedIn', g: 'in', href: PERSON.linkedin },
  'sep',
  { tip: 'Switch to normal website', g: '<span class="dock-site" aria-hidden="true"><i></i></span>', site: true }
];
const dock = $('#dock');
DOCK.forEach((a) => {
  if (a === 'sep') { const s = document.createElement('span'); s.className = 'dock__sep'; s.setAttribute('aria-hidden', 'true'); dock.appendChild(s); return; }
  const el = document.createElement(a.href || a.site ? 'a' : 'button');
  el.className = 'app' + (a.hot ? ' app--hot' : '') + (a.dark ? ' app--dark' : '') + (a.site ? ' app--site' : '');
  if (a.id) el.dataset.id = a.id;
  if (a.site) { el.href = '/site'; el.setAttribute('data-switch', ''); el.setAttribute('aria-label', a.tip); }
  else if (a.href) { el.href = a.href; el.target = '_blank'; el.rel = 'noopener'; el.setAttribute('aria-label', a.tip + ' (opens in a new tab)'); }
  else { el.type = 'button'; el.setAttribute('aria-label', a.tip); el.addEventListener('click', () => open(a.id, {}, el)); }
  el.innerHTML = `<span class="app__g" aria-hidden="true">${a.g}</span><span class="app__tip" aria-hidden="true">${a.tip}</span>`;
  if (a.id) el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const key = a.id === 'work' ? 'folder' : a.id, w = wins.get(key);
    showMenuAt(w ? [['Show window', () => { restore(w); focusWin(w, true); }], ['Close window', () => closeWin(w)]] : [['Open', () => open(a.id, {}, el)]], e.clientX, e.clientY);
  });
  dock.appendChild(el);
});
const minSep = document.createElement('span'); minSep.className = 'dock__sep'; minSep.hidden = true;
const minWrap = document.createElement('div'); minWrap.className = 'dock__min';
dock.append(minSep, minWrap);
function updateDock() {
  dock.querySelectorAll('[data-id]').forEach((el) => {
    const id = el.dataset.id;
    el.classList.toggle('has-dot', id === 'work' ? wins.has('folder') : wins.has(id));
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

// ---------------------------------------------------------------- menus (menubar and right-click share one)
const link = (url) => () => window.open(url, '_blank', 'noopener');
const MENUS = [
  ['Angel OS', [['Welcome', () => open('welcome')], ['About this site', () => open('about')], '-', ['Switch to normal website', goNormal], ['Restart', () => restart()]]],
  ['File', [['New Work window', () => open('work'), 'Alt N'], ['Close window', () => active && closeWin(active), 'Alt W'], ['Close all windows', closeAll]]],
  ['Work', [['Topout', () => open('topout')], ['Atlas Pay', () => open('atlas')], ['POG', () => open('pog')], '-', ['Old logos', () => open('trash')], ['Terminal', () => open('term')]]],
  ['View', [['Clean up icons', cleanUp], ['Tidy windows', tidy], '-', ...Object.keys(WALLS).map((k) => [`Wallpaper: ${k}`, () => setWall($('#wall'), k)])]],
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
let openIdx = -1, ctxOpen = false, returnFocus = null;
const menuOpen = () => openIdx >= 0 || ctxOpen;
function renderMenu(items) {
  menu.innerHTML = items.map((it, k) => (it === '-' ? '<hr role="separator">' : `<button type="button" role="menuitem" tabindex="-1" data-k="${k}">${it[0]}${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`)).join('');
  menu.querySelectorAll('[role=menuitem]').forEach((b) => b.addEventListener('click', () => { hideMenu(false); items[+b.dataset.k][1](); }));
  menu.hidden = false;
  menu.classList.add('is-open');
}
function showMenu(i, focusFirst) {
  ctxOpen = false;
  renderMenu(MENUS[i][1]);
  const r = roots[i].getBoundingClientRect();
  Object.assign(menu.style, { left: r.left + 'px', top: MENU_H + 2 + 'px' });
  roots.forEach((x, k) => { x.classList.toggle('is-open', k === i); x.setAttribute('aria-expanded', String(k === i)); });
  openIdx = i;
  if (focusFirst) menu.querySelector('[role=menuitem]').focus();
}
function showMenuAt(items, x, y, focusFirst) {
  hideMenu(false);
  returnFocus = document.activeElement;
  renderMenu(items);
  ctxOpen = true;
  const w = menu.offsetWidth, h = menu.offsetHeight;
  Object.assign(menu.style, { left: Math.min(x, vw() - w - 6) + 'px', top: Math.min(y, vh() - h - 6) + 'px' });
  (focusFirst ? menu.querySelector('[role=menuitem]') : menu).focus?.();
}
function hideMenu(refocus) {
  if (!menuOpen()) return;
  const was = openIdx >= 0 ? roots[openIdx] : returnFocus;
  menu.classList.remove('is-open'); menu.hidden = true;
  roots.forEach((x) => { x.classList.remove('is-open'); x.setAttribute('aria-expanded', 'false'); });
  openIdx = -1; ctxOpen = false;
  if (refocus && was && was.focus) was.focus();
}
menu.tabIndex = -1;
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
  if (openIdx >= 0 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); const n = (openIdx + (e.key === 'ArrowRight' ? 1 : -1) + roots.length) % roots.length; showMenu(n, true); }
  if (e.key === 'Tab') hideMenu(false);
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menu, .menu-root')) hideMenu(false); }, true);
addEventListener('blur', () => hideMenu(false));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen()) { hideMenu(true); return; }
  if (e.altKey && e.code === 'KeyW') { e.preventDefault(); if (active) closeWin(active); }
  if (e.altKey && e.code === 'KeyN') { e.preventDefault(); open('work'); }
  if (active && active.ctx && active.ctx.step && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input, textarea, [role=menu], .menubar')) {
    e.preventDefault(); active.ctx.step(e.key === 'ArrowRight' ? 1 : -1);
  }
});

$('.skip').addEventListener('click', (e) => { e.preventDefault(); (active ? active.el : iconsEl.querySelector('.icon')).focus(); });

// the puzzle in the terminal unlocks a file on the desktop
document.addEventListener('aos:topped', () => {
  const ic = icons.find((x) => x.id === 'topped');
  ic.el.hidden = false; placeIcon(ic, icons.filter((x) => !x.el.hidden).length - 1); select(ic);
  wallField($('#wall'))?.burst();
  setTimeout(() => open('topped', {}, ic.el), 900);
});

// ---------------------------------------------------------------- boot
clock($('#clock'), true);
setWall($('#wall'), savedWall());
addEventListener('resize', () => icons.forEach((ic) => { if (ic.x > vw() - ICON_W || ic.y > vh() - ICON_H) { const p = slot(icons.indexOf(ic)); ic.x = p.x; ic.y = p.y; ic.el.style.transform = `translate(${ic.x}px, ${ic.y}px)`; } }));

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
