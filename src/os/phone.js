// Angel OS, phone shell: a lock screen, a home screen of apps that open full screen and stack,
// long-press menus, a jiggle mode to rearrange the icons and a control centre.
import { APPS, PROJECTS, PERSON, glyph, copyText, copyEmail, goNormal, linkFor, store, caseUrl } from './content.js';
import { $, RM, say, clock, timeBig, fmtDate, setWall, savedWall, wallField, WALLS, routeApp, onLongPress } from './shared.js';

const P = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
const home = $('#home'), sheetsEl = $('#sheets'), phone = $('#phone');
const stack = [];

// ---------------------------------------------------------------- sheets (apps, full screen)
function ctxFor(sheet) {
  return {
    mode: 'phone',
    open: (id, opts, from) => openSheet(id, opts, from),
    say,
    setTitle: (t) => { sheet.el.querySelector('.sheet__title').textContent = t; },
    route: () => {},
    menu: (items) => actionSheet(items),
    close: () => history.back()
  };
}

function openSheet(id, opts = {}, from, { push = true } = {}) {
  const app = APPS[id];
  if (!app) return;
  closeOverlays();
  const depth = stack.length;
  const el = document.createElement('section');
  const tid = 'st-' + Date.now();
  el.className = 'sheet is-opening' + (app.dark ? ' sheet--dark' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', tid);
  el.tabIndex = -1;
  el.innerHTML = `<header class="sheet__bar">
      <button type="button" class="sheet__back"><span aria-hidden="true">&lsaquo;</span> ${depth ? 'Back' : 'Home'}</button>
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
  el.focus({ preventScroll: true });
  el.querySelector('.sheet__back').addEventListener('click', () => history.back());
  el.querySelector('.sheet__home').addEventListener('click', goHome);
  swipeUpHome(el.querySelector('.sheet__home'));
  pullDownClose(el, el.querySelector('.sheet__bar'));
  if (push) history.pushState({ sheet: stack.length }, '', app.route ? '#' + app.route : location.hash || location.pathname);
}

// one history entry per sheet, so the phone's back gesture closes the top app
function popSheet() {
  const sheet = stack.pop();
  if (!sheet) return;
  sheet.el.querySelectorAll('video').forEach((v) => v.pause());
  sheet.el.style.transform = '';
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

// the wallpaper rests while something covers it (an app, a menu or the control centre)
const syncWall = () => { const f = wallField($('#phone-wall')); if (f && f.pause) f.pause(stack.length > 0 || !overlay.hidden || !cc.hidden); };
function setInert() {
  syncWall();
  const top = stack[stack.length - 1];
  home.inert = !!top;
  $('#phone-dock').inert = !!top;
  stack.forEach((s) => { s.el.inert = s !== top; });
}

// drag the bar at the bottom up to go home
function swipeUpHome(handle) {
  let sy = null;
  handle.addEventListener('pointerdown', (e) => { sy = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointerup', (e) => { if (sy !== null && sy - e.clientY > 30) goHome(); sy = null; });
}
// pull the top bar of an app down to close it
function pullDownClose(el, barEl) {
  barEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const sy = e.clientY; let dy = 0;
    barEl.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    const mv = (ev) => { dy = Math.max(0, ev.clientY - sy); el.style.transform = `translateY(${dy}px)`; };
    const up = () => {
      barEl.removeEventListener('pointermove', mv); barEl.removeEventListener('pointerup', up); barEl.removeEventListener('pointercancel', up);
      el.classList.remove('is-dragging');
      if (dy > 110) history.back(); else el.style.transform = '';
    };
    barEl.addEventListener('pointermove', mv); barEl.addEventListener('pointerup', up); barEl.addEventListener('pointercancel', up);
  });
}

// ---------------------------------------------------------------- menus: long-press menu and action sheet
const overlay = document.createElement('div');
overlay.className = 'press'; overlay.hidden = true;
phone.appendChild(overlay);
function closeOverlays() {
  overlay.hidden = true; overlay.innerHTML = '';
  phone.classList.remove('is-pressing');
  syncWall();
}
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlays(); });
function menuButtons(items) {
  return items.map((it, k) => (it === '-' ? '<hr>' : `<button type="button" data-k="${k}">${it[0]}</button>`)).join('');
}
function wireMenu(root, items) {
  root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { closeOverlays(); items[+b.dataset.k][1](); }));
}
// iOS-style: the pressed icon lifts out, the rest blurs, a menu appears next to it
function pressMenu(target, items) {
  const r = target.getBoundingClientRect();
  const clone = target.cloneNode(true);
  clone.className = target.className + ' press__icon';
  Object.assign(clone.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
  const below = r.bottom + 220 < innerHeight;
  overlay.innerHTML = `<div class="press__menu" role="menu" style="${below ? `top:${r.bottom + 10}px` : `bottom:${innerHeight - r.top + 10}px`};${r.left + r.width / 2 < innerWidth / 2 ? `left:${Math.max(12, r.left)}px` : `right:${Math.max(12, innerWidth - r.right)}px`}">${menuButtons(items)}</div>`;
  overlay.prepend(clone);
  overlay.hidden = false;
  phone.classList.add('is-pressing');
  syncWall();
  wireMenu(overlay, items);
  if (navigator.vibrate) navigator.vibrate(8);
  overlay.querySelector('[data-k]').focus({ preventScroll: true });
}
function actionSheet(items) {
  overlay.innerHTML = `<div class="press__sheet"><div class="press__group" role="menu">${menuButtons(items)}</div><button type="button" class="press__cancel">Cancel</button></div>`;
  overlay.hidden = false;
  phone.classList.add('is-pressing');
  syncWall();
  wireMenu(overlay, items);
  overlay.querySelector('.press__cancel').addEventListener('click', closeOverlays);
  overlay.querySelector('[data-k]')?.focus({ preventScroll: true });
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!overlay.hidden) closeOverlays();
  else if (!cc.hidden) toggleControl(false);
  else if (jiggle) stopJiggle();
});
const share = async (title, url) => {
  try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { return; }
  copyText(url, { say }, 'Link copied');
};

// ---------------------------------------------------------------- home screen
const APPS_HOME = {
  topout: { label: 'Topout', html: glyph('folder', { p: P.topout }), app: 'topout', p: P.topout },
  atlas: { label: 'Atlas Pay', html: glyph('folder', { p: P.atlas }), app: 'atlas', p: P.atlas },
  pog: { label: 'POG', html: glyph('folder', { p: P.pog }), app: 'pog', p: P.pog },
  work: { label: 'Work', html: '<span class="tile tile--hot" aria-hidden="true"><span class="dock-folder"></span></span>', app: 'work' },
  hello: { label: 'Hello', html: '<span class="tile tile--paper" aria-hidden="true">Hi</span>', app: 'welcome' },
  about: { label: 'About', html: glyph('file', { ext: 'TXT' }), app: 'about' },
  contact: { label: 'Contact', html: glyph('file', { ext: 'VCF' }), app: 'contact' },
  term: { label: 'Terminal', html: '<span class="tile tile--dark" aria-hidden="true">&gt;_</span>', app: 'term' },
  trash: { label: 'Old logos', html: glyph('trash'), app: 'trash' },
  topped: { label: 'Topped out', html: glyph('file', { ext: 'TXT' }), app: 'topped', secret: true }
};
const DEFAULT_ORDER = Object.keys(APPS_HOME);
let order = (store.get('springboard') || []).filter((k) => APPS_HOME[k]);
DEFAULT_ORDER.forEach((k) => { if (!order.includes(k)) order.push(k); });
const spring = $('#springboard');
let jiggle = false;

function appMenu(key, el) {
  const a = APPS_HOME[key];
  const items = [['Open', () => openSheet(a.app, {}, el)]];
  if (a.p) items.push(['Read the case study', () => { location.href = caseUrl(a.p); }], ['Share', () => share(a.p.name, linkFor(a.p.id))]);
  if (key === 'contact') items.push(['Copy email', () => copyEmail({ say })]);
  items.push('-', ['Edit Home Screen', startJiggle]);
  pressMenu(el, items);
}

function renderSpring() {
  spring.innerHTML = '';
  order.forEach((key) => {
    const a = APPS_HOME[key];
    if (a.secret && !store.get('topped')) return;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spring-app';
    b.dataset.key = key;
    b.innerHTML = `<span class="spring-app__icon">${a.html}</span><span class="spring-app__label">${a.label}</span>`;
    b.addEventListener('click', () => { if (!jiggle) openSheet(a.app, {}, b); });
    onLongPress(b, () => { if (!jiggle) appMenu(key, b); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!jiggle) appMenu(key, b); });
    li.appendChild(b);
    spring.appendChild(li);
  });
}

// jiggle mode: drag icons to rearrange, Done to finish
const done = document.createElement('button');
done.type = 'button'; done.className = 'jiggle-done'; done.textContent = 'Done'; done.hidden = true;
phone.appendChild(done);
function startJiggle() {
  jiggle = true; phone.classList.add('is-jiggling'); done.hidden = false; done.focus();
}
function stopJiggle() {
  jiggle = false; phone.classList.remove('is-jiggling'); done.hidden = true;
  store.set('springboard', order);
}
done.addEventListener('click', stopJiggle);
spring.addEventListener('pointerdown', (e) => {
  if (!jiggle) return;
  const b = e.target.closest('.spring-app');
  if (!b) return;
  e.preventDefault();
  b.setPointerCapture(e.pointerId);
  const start = { x: e.clientX, y: e.clientY };
  b.classList.add('is-lifted');
  const mv = (ev) => {
    b.style.transform = `translate(${ev.clientX - start.x}px, ${ev.clientY - start.y}px) scale(1.12)`;
    const over = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList && n.classList.contains('spring-app') && n !== b);
    if (over) {
      const from = order.indexOf(b.dataset.key), to = order.indexOf(over.dataset.key);
      order.splice(to, 0, order.splice(from, 1)[0]);
      const r0 = b.getBoundingClientRect();
      const li = b.parentElement, target = over.parentElement;
      if (from < to) target.after(li); else target.before(li);
      const r1 = b.getBoundingClientRect();
      start.x += r1.left - r0.left; start.y += r1.top - r0.top;
      b.style.transform = `translate(${ev.clientX - start.x}px, ${ev.clientY - start.y}px) scale(1.12)`;
    }
  };
  const up = () => { b.classList.remove('is-lifted'); b.style.transform = ''; b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); };
  b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
});
home.addEventListener('click', (e) => { if (jiggle && !e.target.closest('.spring-app')) stopJiggle(); });

// dock: email, Behance, LinkedIn and the normal website
const DOCK = [
  { label: 'Email', g: '@', href: `mailto:${PERSON.email}` },
  { label: 'Behance', g: 'Bē', href: PERSON.behance, ext: true },
  { label: 'LinkedIn', g: 'in', href: PERSON.linkedin, ext: true },
  { label: 'Switch to normal website', g: '<span class="dock-site"><i></i></span>', href: '/site', site: true }
];
const dock = $('#phone-dock');
DOCK.forEach((a) => {
  const el = document.createElement('a');
  el.className = 'phone-app' + (a.site ? ' phone-app--site' : '');
  el.href = a.href;
  if (a.ext) { el.target = '_blank'; el.rel = 'noopener'; }
  if (a.site) el.setAttribute('data-switch', '');
  el.setAttribute('aria-label', a.label + (a.ext ? ' (opens in a new tab)' : ''));
  el.innerHTML = `<span aria-hidden="true">${a.g}</span>`;
  onLongPress(el, () => pressMenu(el, a.site ? [['Open the normal website', goNormal]] : [['Open', () => { a.ext ? window.open(a.href, '_blank', 'noopener') : (location.href = a.href); }], ...(a.label === 'Email' ? [['Copy email', () => copyEmail({ say })]] : [['Copy link', () => copyText(a.href, { say }, 'Link copied')]])]));
  dock.appendChild(el);
});

// ---------------------------------------------------------------- control centre (tap the status bar)
const cc = $('#control');
function renderControl() {
  const cur = savedWall();
  cc.innerHTML = `<div class="cc__panel" role="dialog" aria-label="Control centre">
    <p class="cc__label">Wallpaper</p>
    <div class="cc__walls">${Object.keys(WALLS).map((k) => `<button type="button" class="${k === cur ? 'is-on' : ''}" data-wall="${k}" aria-pressed="${k === cur}">${k}</button>`).join('')}</div>
    <div class="cc__row">
      <button type="button" data-a="copy">Copy email</button>
      <button type="button" data-a="lock">Lock screen</button>
    </div>
    <a class="os-btn os-btn--hot cc__switch" href="/site" data-switch>Switch to normal website</a>
  </div>`;
  cc.querySelectorAll('[data-wall]').forEach((b) => b.addEventListener('click', () => { setWall($('#phone-wall'), b.dataset.wall); renderControl(); syncWall(); }));
  cc.querySelector('[data-a=copy]').addEventListener('click', () => copyEmail({ say }));
  cc.querySelector('[data-a=lock]').addEventListener('click', () => { toggleControl(false); lock(); });
}
function toggleControl(on) {
  cc.hidden = !on;
  syncWall();
  $('#status-btn').setAttribute('aria-expanded', String(on));
  if (on) { renderControl(); cc.querySelector('button').focus(); }
}
$('#status-btn').addEventListener('click', () => toggleControl(cc.hidden));
cc.addEventListener('click', (e) => { if (e.target === cc) toggleControl(false); });
// pull down from the status bar to open it
(() => {
  const s = $('#status-btn');
  let sy = null;
  s.addEventListener('pointerdown', (e) => { sy = e.clientY; });
  s.addEventListener('pointerup', (e) => { if (sy !== null && e.clientY - sy > 30) toggleControl(true); sy = null; });
})();

// ---------------------------------------------------------------- lock screen
const lockEl = $('#lock');
function lock() {
  lockEl.hidden = false;
  lockEl.classList.remove('is-open');
  phone.classList.add('is-locked');
  $('#lock-time').textContent = timeBig();
  $('#lock-date').textContent = fmtDate.format(new Date());
  lockEl.querySelector('.lock__notes').innerHTML = `
    <div class="lnote" data-note><span class="lnote__app">Angel</span><p><b>Hi, I’m Angel.</b> Brand identity designer. Swipe up to look around my work.</p><button type="button" class="lnote__x" aria-label="Dismiss">×</button></div>
    <div class="lnote" data-note><span class="lnote__app">Topout</span><p><b>New case study.</b> A bouldering gym brand built from one lit hold.</p><button type="button" class="lnote__open" data-open="topout">Open</button><button type="button" class="lnote__x" aria-label="Dismiss">×</button></div>
    <div class="lnote lnote--site" data-note><span class="lnote__app">Angel OS</span><p>Prefer a normal website?</p><a class="lnote__open" href="/site" data-switch>Switch</a><button type="button" class="lnote__x" aria-label="Dismiss">×</button></div>`;
  lockEl.querySelectorAll('[data-note]').forEach((n) => {
    n.querySelector('.lnote__x').addEventListener('click', () => dismiss(n));
    // swipe a notification sideways to clear it
    let sx = null;
    n.addEventListener('pointerdown', (e) => { if (e.target.closest('button, a')) return; sx = e.clientX; n.setPointerCapture(e.pointerId); });
    n.addEventListener('pointermove', (e) => { if (sx !== null) n.style.transform = `translateX(${e.clientX - sx}px)`; });
    n.addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 90) dismiss(n, dx); else n.style.transform = ''; });
  });
  lockEl.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { unlock(); setTimeout(() => openSheet(b.dataset.open), RM ? 0 : 380); }));
}
setInterval(() => { if (!lockEl.hidden) $('#lock-time').textContent = timeBig(); }, 15000);
function dismiss(n, dx = 300) {
  n.style.transition = 'transform .3s, opacity .3s'; n.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`; n.style.opacity = '0';
  setTimeout(() => n.remove(), 300);
}
function unlock() {
  try { sessionStorage.setItem('aos-unlocked', '1'); } catch (e) {}
  lockEl.classList.add('is-open');
  phone.classList.remove('is-locked');
  setTimeout(() => { lockEl.hidden = true; lockEl.style.transform = ''; }, RM ? 0 : 420);
}
// swipe up anywhere on the lock screen (or tap the hint) to unlock
(() => {
  let sy = null;
  lockEl.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-note], button, a')) return; sy = e.clientY; lockEl.setPointerCapture(e.pointerId); });
  lockEl.addEventListener('pointermove', (e) => { if (sy !== null) lockEl.style.transform = `translateY(${Math.min(0, e.clientY - sy)}px)`; });
  lockEl.addEventListener('pointerup', (e) => { if (sy === null) return; const dy = sy - e.clientY; sy = null; if (dy > 80) unlock(); else lockEl.style.transform = ''; });
  $('#lock-hint').addEventListener('click', unlock);
  lockEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.target === $('#lock-hint')) { e.preventDefault(); unlock(); } } });
})();

// the terminal puzzle unlocks a new app
document.addEventListener('aos:topped', () => { renderSpring(); setTimeout(() => openSheet('topped'), 900); });

// ---------------------------------------------------------------- start
clock($('#phone-clock'), false);
setWall($('#phone-wall'), savedWall());
renderSpring();

const first = routeApp();
history.replaceState({ sheet: 0 }, '', location.pathname + location.search);
let unlocked = false;
try { unlocked = sessionStorage.getItem('aos-unlocked') === '1'; } catch (e) {}
if (first) { lockEl.hidden = true; openSheet(first); }
else if (unlocked) lockEl.hidden = true;
else lock();
$('.skip').addEventListener('click', (e) => { e.preventDefault(); if (!lockEl.hidden) unlock(); (stack.length ? stack[stack.length - 1].el : spring.querySelector('.spring-app')).focus(); });
