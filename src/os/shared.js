// Bits both shells use: the toast, the clock, the wallpapers (including the live dot field) and the hash routes.
import { ROUTES, DATA, store } from './content.js';

export const $ = (s, r = document) => r.querySelector(s);
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const toast = $('#toast');
let toastT;
export function say(t) {
  toast.textContent = t;
  toast.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.classList.remove('is-on'), 1800);
}

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
export const fmtDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
export function clock(el, withDay) {
  const tick = () => {
    const d = new Date();
    el.textContent = withDay ? `${fmtDay.format(d)} ${fmtTime.format(d)}` : fmtTime.format(d);
    el.dateTime = d.toISOString();
  };
  tick();
  setInterval(tick, 15000);
}
export const timeNow = () => fmtTime.format(new Date());
// the lock screen clock: just the digits, no AM or PM
export const timeBig = () => fmtTime.formatToParts(new Date()).filter((p) => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && /[:.h]/.test(p.value))).map((p) => p.value).join('').trim();

// ---------------------------------------------------------------- dot field
// The Topout dot field, drawn live: a fine grid of dots with orange patches drifting through it.
// It never loops (so it never jumps back to the start), stays sharp at any size,
// and the dots under the pointer light up like the holds on Board B.
function makeNoise(seed = 7) {
  const p = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  let s = seed;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(lerp(lerp(grad(p[AA] & 15, x, y, z), grad(p[BA] & 15, x - 1, y, z), u), lerp(grad(p[AB] & 15, x, y - 1, z), grad(p[BB] & 15, x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1] & 15, x, y, z - 1), grad(p[BA + 1] & 15, x - 1, y, z - 1), u), lerp(grad(p[AB + 1] & 15, x, y - 1, z - 1), grad(p[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  };
}

export function dotField(host, { gap = 10, fps = 30 } = {}) {
  const cv = document.createElement('canvas');
  cv.className = 'wall__canvas';
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  const g = cv.getContext('2d', { alpha: false });
  const noise = makeNoise();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0, cols = 0, rows = 0, raf = 0, last = 0, t = Math.random() * 100, burst = 0;
  const mouse = { x: -999, y: -999, a: 0 };
  // pre-drawn dots, like the "fine" Topout hero: tiny grey dots in a halo, full orange holds in the patches
  const sprite = (r, col) => { const s = Math.ceil(r * 2 * dpr) + 2; const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); x.fillStyle = col; x.beginPath(); x.arc(s / 2, s / 2, r * dpr, 0, Math.PI * 2); x.fill(); return c; };
  const GREYS = 6;
  const grey = Array.from({ length: GREYS }, (_, k) => { const f = k / (GREYS - 1); const c = Math.round(50 + f * 52); return sprite(0.7 + f * 1.1, `rgb(${c},${c},${c - 4})`); });
  const faint = sprite(0.65, '#2a2a27');
  const edge = sprite(gap * 0.3, '#a8341a');
  const mid = sprite(gap * 0.36, '#e2441d');
  const hot = sprite(gap * 0.4, '#ff4b1f');
  const T = 0.34, G0 = 0.1;
  const resize = () => {
    W = host.clientWidth; H = host.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cols = Math.ceil(W / gap) + 1; rows = Math.ceil(H / gap) + 1;
    draw();
  };
  function draw() {
    g.fillStyle = '#11110f';
    g.fillRect(0, 0, cv.width, cv.height);
    const sc = 0.07, z = t;
    const R = 110, mx = mouse.x, my = mouse.y, ma = mouse.a;
    for (let j = 0; j < rows; j++) {
      const y = j * gap + gap / 2, ny = j * sc;
      for (let i = 0; i < cols; i++) {
        const x = i * gap + gap / 2, nx = i * sc;
        // a slow main shape plus a finer octave for ragged edges; the third axis keeps them changing, so it never loops
        let v = noise(nx + z * 0.5, ny - z * 0.2, z * 0.3) * 0.9 + noise(nx * 2.2 + 31, ny * 2.2, z * 0.6) * 0.22;
        if (ma > 0) { const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy; if (d2 < R * R) v += (1 - Math.sqrt(d2) / R) * 0.42 * ma; }
        if (burst > 0) v += burst * (0.5 + 0.5 * Math.sin((x + y) * 0.015 - t * 60)) * 0.6;
        let s;
        if (v >= T) s = v < T + 0.03 ? edge : v < T + 0.07 ? mid : hot;
        else if (v >= G0) s = grey[Math.min(GREYS - 1, ((v - G0) / (T - G0) * GREYS) | 0)];
        else if (v > -0.22 && noise(nx * 0.35 + 7, ny * 0.35, z * 0.15) > -0.05) s = faint;
        else continue;
        g.drawImage(s, (x * dpr - s.width / 2) | 0, (y * dpr - s.height / 2) | 0);
      }
    }
  }
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / fps) return;
    const dt = Math.min(100, now - last); last = now;
    t += dt * 0.00011;
    mouse.a = Math.max(0, mouse.a - dt * 0.0007);
    burst = Math.max(0, burst - dt * 0.00035);
    draw();
  };
  const onMove = (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.a = 1; };
  const ro = new ResizeObserver(resize); ro.observe(host);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  const vis = () => { cancelAnimationFrame(raf); if (!document.hidden && !RM) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', vis);
  resize(); vis();
  return {
    burst() { burst = 1.2; if (RM) draw(); },
    stop() { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onMove); document.removeEventListener('visibilitychange', vis); cv.remove(); }
  };
}

// ---------------------------------------------------------------- wallpapers
export const WALLS = DATA.walls;
const fields = new Map();
export function setWall(el, name) {
  const w = WALLS[name] || WALLS['Dot field'];
  fields.get(el)?.stop(); fields.delete(el);
  el.style.backgroundImage = '';
  el.innerHTML = '';
  if (w.live) fields.set(el, dotField(el, { gap: innerWidth < 760 ? 9 : 10 }));
  else {
    el.style.backgroundImage = `url(${w.poster})`;
    if (!RM) el.innerHTML = `<video class="wall__video" src="${w.video}" poster="${w.poster}" autoplay muted loop playsinline disablepictureinpicture aria-hidden="true" tabindex="-1"></video>`;
  }
  store.set('wall', name);
}
export const wallField = (el) => fields.get(el);
export function savedWall() { const w = store.get('wall'); return w && WALLS[w] ? w : 'Dot field'; }

// #topout, #atlas, #about… open that app on load and when the hash changes
export const routeApp = () => ROUTES[location.hash.slice(1)] || null;
export function setRoute(route) {
  const next = route ? '#' + route : location.pathname + location.search;
  if ((location.hash || '') === (route ? '#' + route : '')) return;
  history.replaceState(history.state, '', next);
}

// one long-press helper for touch and mouse: fires after 480ms without moving
export function onLongPress(el, fn, { ms = 480 } = {}) {
  let tm = null, sx = 0, sy = 0, fired = false;
  const cancel = () => { clearTimeout(tm); tm = null; };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    fired = false; sx = e.clientX; sy = e.clientY;
    tm = setTimeout(() => { fired = true; tm = null; fn(e); }, ms);
  });
  el.addEventListener('pointermove', (e) => { if (tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  // a long press must not also count as a tap
  el.addEventListener('click', (e) => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } }, true);
  el.addEventListener('contextmenu', (e) => { if (e.pointerType !== 'mouse') e.preventDefault(); });
}
