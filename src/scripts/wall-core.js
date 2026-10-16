// The gallery wall, shared by /gallery on the website and gallery.exe in Angel OS.
// Every piece sits on one endless masonry you drag around (mouse, touch, trackpad, wheel, arrow keys).
// Columns loop on their own up and down, and the set of columns repeats left and right, so it never runs out.
// Tiles are plain DOM, made only while they're on screen and reused after. Motion pieces play muted
// while they're on screen. What a click does is up to the page (a lightbox, or the OS viewer).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// spread every set evenly through the order, so pieces from one set rarely sit side by side.
// The shuffle is seeded, so the wall comes out the same on every visit.
function mix(items, seed) {
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const sets = new Map();
  items.forEach((it, i) => {
    const k = it.set || it.case || it.cat;
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
}

/**
 * view: the element you drag (fills its box), plane: an empty child that holds the tiles.
 * onOpen(index, tileEl): a piece was clicked or Enter was pressed on the wall.
 * blocked(): true while something covers the wall (a lightbox): no hover, no autoplay, no keys.
 */
export function createWall({ view, plane, items, onOpen, blocked = () => false, intro = true, seed = 20261016 }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  // muted loops play by themselves, except with reduced motion or data saver (then a hover plays them)
  const AUTO = !reduce && !(navigator.connection && navigator.connection.saveData);
  const ORDER = mix(items, seed);
  let visible = true, dead = false;

  // ---------- layout ----------
  let L = null;
  function layout() {
    // a box that isn't laid out yet (a background tab, a window still opening) reports 0x0:
    // lay out for a small screen until the real size comes in
    const vw = Math.max(320, view.clientWidth || 0);
    const vh = Math.max(480, view.clientHeight || 0);
    const phone = vw < 768;
    const gap = phone ? 12 : 20;
    const colW = phone ? Math.round(vw / 2.3 - gap) : Math.round(clamp(vw / 4.8, 240, 380));
    const pitch = colW + gap;
    const n = clamp(Math.ceil(vw / pitch) + 2, 6, 12);
    const cols = Array.from({ length: n }, () => ({ items: [], H: 0, off: 0 }));
    for (const i of ORDER) {
      const it = items[i];
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
    // narrow tiles: the label on hover keeps just the title
    plane.classList.toggle('is-narrow', colW < 280);
    return { vw, vh, gap, colW, pitch, n, cols, big };
  }

  // ---------- tiles ----------
  const live = new Map(); // key -> element on screen
  const pool = new Map(); // item index -> spare elements
  function tile(i, h) {
    const spare = pool.get(i);
    if (spare && spare.length) return spare.pop();
    const it = items[i];
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
    const it = items[el.dataset.i];
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
  const play = (el) => { const v = motion(el); if (v) v.play().catch(() => {}); };
  const pauseAll = () => { for (const el of live.values()) { const v = el.querySelector('video'); if (v) v.pause(); } };
  const playAll = () => { if (AUTO && visible && !document.hidden && !blocked()) for (const el of live.values()) play(el); };
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
    const auto = AUTO && visible && !blocked();
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
          if (!el) { el = tile(t.i, t.h); plane.appendChild(el); live.set(key, el); if (auto) play(el); }
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
    if (dead) return;
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
    if (busy && !down && mx !== null && speed < 0.8 && W < 0.012) hoverAt(mx, my);
    if (busy) raf = requestAnimationFrame(frame);
    else if (mx !== null && !down) hoverAt(mx, my);
  }
  const kick = () => { if (!raf && !dead) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  // ---------- hover (mouse only): white frame, a closer look, motion pieces play ----------
  let hov = null, mx = null, my = null;
  function setHover(el) {
    if (el === hov) return;
    if (hov) {
      hov.classList.remove('is-hover');
      // without autoplay the hover is what plays a piece, so leaving it stops it
      if (!AUTO) { const v = hov.querySelector('video'); if (v) v.pause(); }
    }
    hov = el && fine.matches && !blocked() ? el : null;
    if (!hov) return;
    hov.classList.add('is-hover');
    play(hov);
  }
  function tileAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const t = el && el.closest ? el.closest('.t') : null;
    return t && plane.contains(t) ? t : null;
  }
  const hoverAt = (x, y) => setHover(tileAt(x, y));

  // ---------- drag ----------
  let down = false, moved = false, pid = null, sx0 = 0, sy0 = 0, px = 0, py = 0, samples = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
  const offs = [];
  on(view, 'pointerdown', (e) => {
    if (e.button !== 0 || pid !== null) return;
    pid = e.pointerId; down = true; moved = false;
    sx0 = px = e.clientX; sy0 = py = e.clientY;
    samples = [[e.timeStamp, px, py]];
    vx = vy = 0;
    ease = e.pointerType === 'touch' ? 0.42 : 0.24;
    try { view.setPointerCapture(pid); } catch (err) { /* already released */ }
    kick();
  });
  on(view, 'pointermove', (e) => {
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
      const t = tileAt(e.clientX, e.clientY);
      if (t) { setHover(null); onOpen(Number(t.dataset.i), t); }
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
  on(view, 'pointerup', release);
  on(view, 'pointercancel', release);
  on(view, 'pointerleave', (e) => { if (e.pointerType === 'mouse' && !down) { mx = my = null; setHover(null); } });
  on(view, 'dragstart', (e) => e.preventDefault());

  // ---------- wheel and trackpad ----------
  on(view, 'wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey) return; // a trackpad pinch: nothing to zoom here
    const f = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? L.vh : 1;
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
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step], PageUp: [0, -L.vh * 0.8], PageDown: [0, L.vh * 0.8] }[e.key];
    if (!d) return false;
    e.preventDefault();
    tx += d[0]; ty += d[1];
    vx = vy = 0;
    ease = 0.12;
    kick();
    return true;
  }
  // Enter on the wall opens the piece nearest the middle of it
  function openCentre() {
    const r = view.getBoundingClientRect();
    let best = null, bd = Infinity;
    for (const el of live.values()) {
      const b = el.getBoundingClientRect();
      const d = Math.hypot(b.left + b.width / 2 - (r.left + r.width / 2), b.top + b.height / 2 - (r.top + r.height / 2));
      if (d < bd) { bd = d; best = el; }
    }
    if (best) onOpen(Number(best.dataset.i), best);
  }
  on(view, 'keydown', (e) => {
    if (blocked() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCentre(); return; }
    if (pan(e)) e.stopPropagation();
  });

  // ---------- size, and whether the wall can be seen at all ----------
  let rz = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (dead) return;
      const next = layout();
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
  ro.observe(view);
  // a minimised window or a hidden tab: the loops rest
  const io = new IntersectionObserver((es) => {
    if (!view.isConnected) { destroy(); return; }
    visible = es[es.length - 1].isIntersecting;
    if (visible) playAll(); else pauseAll();
  });
  io.observe(view);
  on(document, 'visibilitychange', () => {
    if (!view.isConnected) { destroy(); return; }
    if (document.hidden) pauseAll(); else playAll();
  });

  function destroy() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf); raf = 0;
    ro.disconnect(); io.disconnect();
    offs.forEach((f) => f());
    const all = [...live.values(), ...[...pool.values()].flat()];
    for (const el of all) { const v = el.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } }
    live.clear(); pool.clear();
    plane.textContent = '';
  }

  // ---------- start ----------
  L = layout();
  tx = cx = Math.round(L.pitch * 0.4);
  ty = 0;
  if (reduce || !intro) { cy = 0; render(); }
  else { cy = 280; W = 0.08; ease = 0.07; render(); kick(); } // the wall drifts up into place

  return {
    pan,
    openCentre,
    // something opens over the wall (a lightbox): loops rest, hover goes
    pause() { setHover(null); pauseAll(); },
    resume() { playAll(); },
    destroy
  };
}
