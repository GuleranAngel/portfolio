// /gallery: the wall (wall-core.js), plus what only the website has: a lightbox for one piece,
// the Index of every piece, and links to one piece (/gallery#105) that Back closes again.
import { createWall } from './wall-core.js';

const $ = (s, r = document) => r.querySelector(s);
const data = JSON.parse($('#wall-data').textContent);
const view = $('[data-view]');
const lb = $('[data-lb]');
const wall = createWall({ view, plane: $('[data-plane]'), items: data, onOpen: (i) => open(i), blocked: () => !lb.hidden });

// ---------- the lightbox ----------
const stage = $('[data-lb-stage]');
const lbTitle = $('[data-lb-title]'), lbMeta = $('[data-lb-meta]'), lbCount = $('[data-lb-count]');
const outside = () => document.querySelectorAll('.skip-link, .site-header, .wall > :not([data-lb])');
let cur = -1, lastFocus = null, pushed = false;

function show(i) {
  cur = (i + data.length) % data.length;
  const it = data[cur];
  lbTitle.textContent = it.title;
  lbMeta.textContent = [it.kind, it.year, it.where].filter(Boolean).join(' · ');
  lbCount.textContent = `${cur + 1} / ${data.length}`;
  clearStage();
  const box = document.createElement('div');
  box.className = 'lb__media';
  box.style.cssText = 'position:absolute;inset:0';
  if (it.video) {
    const v = document.createElement('video');
    v.playsInline = true; v.setAttribute('playsinline', '');
    v.controls = true;
    v.setAttribute('controlslist', 'nodownload noplaybackrate');
    v.disablePictureInPicture = true;
    v.poster = it.src;
    v.setAttribute('aria-label', it.title);
    if (it.sound) v.src = it.sound; // the full cut, with its soundtrack
    else { v.muted = true; v.defaultMuted = true; v.setAttribute('muted', ''); v.loop = true; v.src = it.mp4; }
    box.appendChild(v);
    stage.appendChild(box);
    v.play().catch(() => {});
  } else {
    const lo = new Image();
    lo.className = 'lb__lo'; lo.alt = ''; lo.src = it.thumb;
    const hi = new Image();
    hi.className = 'lb__hi'; hi.alt = it.title; hi.decoding = 'async';
    hi.addEventListener('load', () => { hi.classList.add('is-in'); setTimeout(() => lo.remove(), 320); }, { once: true });
    hi.src = it.hd || it.src;
    box.append(lo, hi);
    stage.appendChild(box);
  }
  // warm up the pieces either side
  for (const j of [cur + 1, cur - 1]) {
    const nb = data[(j + data.length) % data.length];
    if (!nb.video) new Image().src = nb.hd || nb.src;
  }
}
function clearStage() {
  stage.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
  stage.textContent = '';
}
function open(i, { push = true } = {}) {
  if (i < 0) return;
  const was = !lb.hidden;
  show(i);
  const hash = `#${encodeURIComponent(data[cur].id)}`;
  if (!was) {
    lastFocus = document.activeElement;
    lb.hidden = false;
    wall.pause(); // the wall rests while a piece is open
    outside().forEach((el) => { el.inert = true; });
    $('[data-lb-close]').focus({ preventScroll: true });
    if (push) { history.pushState({ lb: 1 }, '', hash); pushed = true; return; }
  }
  history.replaceState(history.state, '', hash);
}
function close({ fromHistory = false, key = false } = {}) {
  if (lb.hidden) return;
  clearStage();
  lb.hidden = true;
  outside().forEach((el) => { el.inert = false; });
  wall.resume();
  if (!fromHistory) {
    if (pushed && history.state && history.state.lb) history.back();
    else history.replaceState(null, '', location.pathname + location.search);
  }
  pushed = false;
  // back to where focus was. When that was the wall itself (a piece was clicked), a mouse close leaves
  // focus on the page, so no ring is drawn around the wall; a keyboard close puts it back on the wall.
  const back = lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : view;
  if (back !== view || key) back.focus({ preventScroll: true });
  else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
}
const step = (d) => { if (!lb.hidden) open(cur + d); };
$('[data-lb-close]').addEventListener('click', (e) => close({ key: e.detail === 0 }));
$('[data-lb-prev]').addEventListener('click', () => step(-1));
$('[data-lb-next]').addEventListener('click', () => step(1));
addEventListener('popstate', () => {
  if (!lb.hidden && !(history.state && history.state.lb)) close({ fromHistory: true });
  else if (lb.hidden && history.state && history.state.lb) { openFromHash(); pushed = !lb.hidden; }
});
addEventListener('hashchange', () => { if (lb.hidden) openFromHash(); });
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const i = id ? data.findIndex((x) => x.id === id) : -1;
  if (i >= 0) open(i, { push: false });
}

// a click on the dark around the picture closes it; a swipe sideways goes to the next one
function contentBox(el) {
  const r = el.getBoundingClientRect();
  const nw = el.naturalWidth || el.videoWidth, nh = el.naturalHeight || el.videoHeight;
  if (!nw || !nh) return r;
  const s = Math.min(r.width / nw, r.height / nh);
  const w = nw * s, h = nh * s;
  return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, right: r.left + (r.width + w) / 2, bottom: r.top + (r.height + h) / 2 };
}
let sw = null;
stage.addEventListener('pointerdown', (e) => { sw = { x: e.clientX, y: e.clientY, t: e.timeStamp, touch: e.pointerType !== 'mouse' }; });
stage.addEventListener('pointerup', (e) => {
  if (!sw) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  const s = sw; sw = null;
  if (s.touch && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { step(dx < 0 ? 1 : -1); return; }
  if (Math.hypot(dx, dy) > 8) return;
  const media = stage.querySelector('.lb__hi, video') || stage.querySelector('img');
  if (!media) return;
  const b = contentBox(media);
  const pad = 12;
  if (e.clientX < b.left - pad || e.clientX > b.right + pad || e.clientY < b.top - pad || e.clientY > b.bottom + pad) close();
});
stage.addEventListener('pointercancel', () => { sw = null; });

// ---------- the index ----------
const idx = $('[data-index]');
const idxBtn = $('[data-index-open]');
function setIndex(on) {
  idx.hidden = !on;
  idxBtn.setAttribute('aria-expanded', String(on));
  (on ? $('[data-index-close]') : idxBtn).focus({ preventScroll: true });
}
idxBtn.addEventListener('click', () => setIndex(idx.hidden));
$('[data-index-close]').addEventListener('click', () => setIndex(false));
idx.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b) open(data.findIndex((x) => x.id === b.dataset.open));
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!lb.hidden) {
    if (e.key === 'Escape') { e.preventDefault(); close({ key: true }); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    return;
  }
  if (e.key === 'Escape' && !idx.hidden) { e.preventDefault(); setIndex(false); return; }
  // the wall handles its own keys when it has focus; with nothing focused, the arrows still move it
  const a = document.activeElement;
  if (a === document.body || a === document.documentElement || (a && a.id === 'main')) wall.pan(e);
});

// a link to one piece (/gallery#105) opens it, and Back closes it onto the wall
{
  const h = location.hash;
  const id = decodeURIComponent(h.slice(1));
  if (id && data.some((x) => x.id === id)) {
    history.replaceState(null, '', location.pathname + location.search);
    history.pushState({ lb: 1 }, '', h);
    openFromHash();
    pushed = true;
  }
}
