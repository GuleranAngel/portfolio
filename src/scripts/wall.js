// The gallery wall: every piece on one endless masonry you drag around (mouse, touch, trackpad, wheel, arrow keys).
// Columns loop on their own up and down, and the set of columns repeats left and right, so it never runs out.
// Tiles are plain DOM, made only while they're on screen and reused after. Click a piece to see it big.

const $ = (s, r = document) => r.querySelector(s);
const data = JSON.parse($('#wall-data').textContent);
const view = $('[data-view]');
const plane = $('[data-plane]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)');
// motion pieces play on the wall by themselves, muted, while they're on screen
// (not with reduced motion or data saver: then they play on hover, or big in the lightbox)
const AUTO = !reduce && !(navigator.connection && navigator.connection.saveData);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a seeded shuffle, so the wall comes out the same on every visit
let seed = 20261016;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// spread every set evenly through the order, so pieces from one set rarely sit side by side
const ORDER = (() => {
  const sets = new Map();
  data.forEach((it, i) => {
    const k = it.set || it.cat;
    if (!sets.has(k)) sets.set(k, []);
    sets.get(k).push(i);
  });
  const keyed = [];
  for (const list of sets.values()) {
    for (let j = list.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [list[j], list[r]] = [list[r], list[j]]; }
    const off = rnd();
    list.forEach((i, j) => keyed.push([(j + off) / list.length + rnd() * 0.03, i]));
  }
  return keyed.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
})();

// ---------- layout ----------
let L = null;
function layout() {
  // a tab opened in the background can report a 0x0 window at first; lay out for a small screen
  // until the real size comes in (the resize handler redoes it then)
  const vw = Math.max(320, innerWidth || document.documentElement.clientWidth || 0);
  const vh = Math.max(480, innerHeight || document.documentElement.clientHeight || 0);
  const phone = vw < 768;
  const gap = phone ? 12 : 20;
  const colW = phone ? Math.round(vw / 2.3 - gap) : Math.round(clamp(vw / 4.8, 240, 380));
  const pitch = colW + gap;
  const n = clamp(Math.ceil(vw / pitch) + 2, 6, 12);
  const cols = Array.from({ length: n }, () => ({ items: [], H: 0, off: 0 }));
  for (const i of ORDER) {
    const it = data[i];
    const h = Math.round(colW * clamp(it.h / it.w, 0.42, 1.5));
    let c = cols[0];
    for (const x of cols) if (x.H < c.H - 1) c = x;
    c.items.push({ i, y: c.H, h, n: c.items.length });
    c.H += h + gap;
  }
  // a column has to be taller than the screen, or the same piece would show twice in it
  for (const c of cols) {
    const base = c.items.slice();
    while (c.H < vh * 1.4 + 600) for (const t of base) { c.items.push({ i: t.i, y: c.H, h: t.h, n: c.items.length }); c.H += t.h + gap; }
  }
  // stagger the columns so the tops don't line up
  cols.forEach((c, k) => { c.off = Math.round(((k * 0.618034 + 0.21) % 1) * c.H); });
  const big = colW * Math.min(devicePixelRatio || 1, 2) > 600;
  return { vw, vh, gap, colW, pitch, n, cols, big };
}

// ---------- tiles ----------
const live = new Map(); // key -> element on screen
const pool = new Map(); // item index -> spare elements
function tile(i, h) {
  const spare = pool.get(i);
  if (spare && spare.length) return spare.pop();
  const it = data[i];
  const el = document.createElement('div');
  el.className = 't';
  el.dataset.i = i;
  el.style.width = `${L.colW}px`;
  el.style.height = `${h}px`;
  el.innerHTML = `<div class="t__m"><img alt="" decoding="async" draggable="false"></div>${it.video ? '<span class="t__play"></span>' : ''}<span class="t__chip"><i>${esc(it.kind)}</i><b>${esc(it.title)}</b></span>`;
  const img = el.querySelector('img');
  img.addEventListener('load', () => img.classList.add('is-in'), { once: true });
  img.src = L.big ? it.src : it.thumb;
  return el;
}
// the muted loop inside a motion tile, made the first time it's needed
function motion(el) {
  let v = el.querySelector('video');
  if (v) return v;
  const it = data[el.dataset.i];
  if (!it.video) return null;
  v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.addEventListener('playing', () => { v.classList.add('is-on'); el.classList.add('is-playing'); });
  v.addEventListener('pause', () => el.classList.remove('is-playing'));
  v.src = it.mp4;
  el.querySelector('.t__m').appendChild(v);
  return v;
}
function play(el) { const v = motion(el); if (v) v.play().catch(() => {}); }
const pauseAll = () => { for (const el of live.values()) { const v = el.querySelector('video'); if (v) v.pause(); } };
const playAll = () => { if (AUTO) for (const el of live.values()) play(el); };
document.addEventListener('visibilitychange', () => (document.hidden ? pauseAll() : lb.hidden && playAll()));

function recycle(el) {
  if (el === hov) setHover(null);
  const v = el.querySelector('video');
  if (v) v.pause();
  el.remove();
  const i = Number(el.dataset.i);
  if (!pool.has(i)) pool.set(i, []);
  pool.get(i).push(el);
}

// ---------- camera ----------
let cx = 0, cy = 0, tx = 0, ty = 0; // where the camera is, and where it's heading
let vx = 0, vy = 0; // fling speed after a drag, px per frame
let W = 0; // how much the wall bulges while it moves
let ease = 0.2;
let fid = 0, raf = 0, last = 0;

function render() {
  fid++;
  const { vw, vh, colW, pitch, n, cols } = L;
  const m = 120 + W * 1400;
  const x0 = cx - m, x1 = cx + vw + m, y0 = cy - m, y1 = cy + vh + m;
  const hx = vw / 2, hy = vh / 2, R2 = hx * hx + hy * hy;
  for (let k = Math.floor(x0 / pitch); k <= Math.floor(x1 / pitch); k++) {
    const col = cols[((k % n) + n) % n];
    const sx = k * pitch - cx;
    const r0 = Math.floor((y0 - col.off) / col.H) - 1, r1 = Math.floor((y1 - col.off) / col.H);
    for (let r = r0; r <= r1; r++) {
      const oy = r * col.H + col.off;
      for (const t of col.items) {
        const wy = oy + t.y;
        if (wy + t.h < y0 || wy > y1) continue;
        const key = `${k},${r},${t.n}`;
        let el = live.get(key);
        if (!el) { el = tile(t.i, t.h); plane.appendChild(el); live.set(key, el); if (AUTO && lb.hidden) play(el); }
        el._f = fid;
        let x = sx, y = wy - cy, s = 1;
        if (W > 0.0004) {
          // a soft bulge: pieces near the edges pull in and shrink a little, like the wall is curving away
          const dx = x + colW / 2 - hx, dy = y + t.h / 2 - hy;
          const q = (dx * dx + dy * dy) / R2;
          const f = Math.max(0.55, 1 - W * q);
          x = hx + dx * f - colW / 2;
          y = hy + dy * f - t.h / 2;
          s = Math.max(0.55, 1 - W * q * 1.5);
        }
        el.style.transform = s === 1 ? `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)` : `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
      }
    }
  }
  for (const [key, el] of live) if (el._f !== fid) { live.delete(key); recycle(el); }
}

function frame(now) {
  raf = 0;
  const dt = Math.min(4, Math.max(0.25, (now - last) / 16.667));
  last = now;
  if (!down) {
    if (Math.abs(vx) + Math.abs(vy) > 0.05) {
      tx += vx * dt; ty += vy * dt;
      const f = Math.pow(0.94, dt);
      vx *= f; vy *= f;
    } else vx = vy = 0;
  }
  const k = reduce ? 1 : 1 - Math.pow(1 - ease, dt);
  cx += (tx - cx) * k;
  cy += (ty - cy) * k;
  const speed = Math.hypot(tx - cx, ty - cy) + Math.hypot(vx, vy) * 3;
  const goal = reduce ? 0 : Math.min(0.1, speed * 0.0014 + (down && moved ? 0.025 : 0));
  W += (goal - W) * (1 - Math.pow(0.86, dt));
  if (W < 0.0004 && goal === 0) W = 0;
  const busy = down || vx || vy || Math.abs(tx - cx) > 0.3 || Math.abs(ty - cy) > 0.3 || W > 0;
  if (!busy) { cx = tx; cy = ty; }
  render();
  // the frame comes back on the piece under the mouse as soon as the wall has nearly stopped
  if (busy && !down && mx !== null && speed < 0.8 && W < 0.012 && lb.hidden) hoverAt(mx, my);
  if (busy) raf = requestAnimationFrame(frame);
  else settle();
}
const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

// ---------- hover (mouse only): white frame, a closer look, motion pieces play ----------
let hov = null, mx = null, my = null;
function setHover(el) {
  if (el === hov) return;
  if (hov) {
    hov.classList.remove('is-hover');
    // without autoplay the hover is what plays a piece, so leaving it stops it
    if (!AUTO) { const v = hov.querySelector('video'); if (v) v.pause(); }
  }
  hov = el && fine.matches ? el : null;
  if (!hov) return;
  hov.classList.add('is-hover');
  play(hov);
}
function hoverAt(x, y) {
  const el = document.elementFromPoint(x, y);
  setHover(el && el.closest ? el.closest('.t') : null);
}
function settle() { if (mx !== null && !down && lb.hidden) hoverAt(mx, my); }

// ---------- drag ----------
let down = false, moved = false, pid = null, sx0 = 0, sy0 = 0, px = 0, py = 0, samples = [];
view.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || pid !== null) return;
  pid = e.pointerId; down = true; moved = false;
  sx0 = px = e.clientX; sy0 = py = e.clientY;
  samples = [[e.timeStamp, px, py]];
  vx = vy = 0;
  ease = e.pointerType === 'touch' ? 0.42 : 0.24;
  try { view.setPointerCapture(pid); } catch (err) {}
  kick();
});
view.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; }
  if (!down || e.pointerId !== pid) { if (!raf && e.pointerType === 'mouse') hoverAt(mx, my); return; }
  const dx = e.clientX - px, dy = e.clientY - py;
  px = e.clientX; py = e.clientY;
  tx -= dx; ty -= dy;
  if (!moved && Math.hypot(px - sx0, py - sy0) > 6) { moved = true; view.classList.add('is-dragging'); setHover(null); }
  samples.push([e.timeStamp, px, py]);
  while (samples.length > 2 && e.timeStamp - samples[0][0] > 90) samples.shift();
  kick();
});
function release(e) {
  if (e.pointerId !== pid) return;
  pid = null; down = false;
  view.classList.remove('is-dragging');
  if (!moved && e.type === 'pointerup') {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const t = el && el.closest ? el.closest('.t') : null;
    if (t) open(Number(t.dataset.i));
  } else if (moved && !reduce) {
    const a = samples[0], b = samples[samples.length - 1];
    const span = b[0] - a[0];
    if (span > 0 && e.timeStamp - b[0] < 70) {
      vx = clamp((-(b[1] - a[1]) / span) * 16.667, -70, 70);
      vy = clamp((-(b[2] - a[2]) / span) * 16.667, -70, 70);
    }
  }
  kick();
}
view.addEventListener('pointerup', release);
view.addEventListener('pointercancel', release);
view.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !down) { mx = my = null; setHover(null); } });
view.addEventListener('dragstart', (e) => e.preventDefault());

// ---------- wheel and trackpad ----------
view.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey) return; // a trackpad pinch: nothing to zoom here
  const f = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? innerHeight : 1;
  let dx = e.deltaX * f, dy = e.deltaY * f;
  if (e.shiftKey && !dx) { dx = dy; dy = 0; }
  tx += dx; ty += dy;
  vx = vy = 0;
  ease = 0.16;
  setHover(null);
  kick();
}, { passive: false });

// ---------- keys ----------
function pan(e) {
  const step = e.shiftKey ? 640 : 240;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step], PageUp: [0, -innerHeight * 0.8], PageDown: [0, innerHeight * 0.8] }[e.key];
  if (!d) return false;
  e.preventDefault();
  tx += d[0]; ty += d[1];
  vx = vy = 0;
  ease = 0.12;
  kick();
  return true;
}

// ---------- the lightbox ----------
const lb = $('[data-lb]');
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
    setHover(null);
    lb.hidden = false;
    pauseAll(); // the wall rests while a piece is open
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
  playAll();
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
  const a = document.activeElement;
  if (a === view && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCentre(); return; }
  if (a === view || a === document.body || a === document.documentElement || (a && a.id === 'main')) pan(e);
});

// Enter on the wall opens the piece nearest the middle of the screen
function openCentre() {
  let best = null, bd = Infinity;
  for (const el of live.values()) {
    const r = el.getBoundingClientRect();
    const d = Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2);
    if (d < bd) { bd = d; best = el; }
  }
  if (best) open(Number(best.dataset.i));
}

// ---------- start ----------
let rz = 0;
addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    const next = layout();
    if (!L) { L = next; kick(); return; }
    if (next.colW === L.colW && next.n === L.n && next.big === L.big) { L.vw = next.vw; L.vh = next.vh; kick(); return; }
    const f = next.pitch / L.pitch;
    cx *= f; tx *= f; cy *= f; ty *= f;
    setHover(null);
    for (const el of live.values()) el.remove();
    live.clear(); pool.clear();
    L = next;
    kick();
  }, 120);
});

L = layout();
tx = cx = Math.round(L.pitch * 0.4);
ty = 0;
if (reduce) { cy = 0; render(); }
else { cy = 280; W = 0.08; ease = 0.07; kick(); } // the wall drifts up into place
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
