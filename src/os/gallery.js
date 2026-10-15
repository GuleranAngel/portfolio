// gallery.exe: 72 more pieces of work (3D, motion, branding, logos), two ways in.
// The capsule machine hands them out one pull at a time and keeps an album of what you found.
// The case board pins them to a corkboard like evidence: cases, red string, an inspector for every print.
import { DATA, esc, store } from './content.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let G = null;
const gal = () => {
  if (G) return G;
  const g = DATA.gallery;
  const byId = Object.fromEntries(g.items.map((it) => [it.id, it]));
  const caseById = Object.fromEntries(g.cases.map((c) => [c.id, c]));
  G = { ...g, byId, caseById };
  return G;
};
const caseOf = (it) => gal().caseById[it.case];
// the viewer app expects the same shape as the project folders
const asFile = (it) => ({ type: it.video ? 'video' : 'image', src: it.video ? it.mp4 : it.src, poster: it.src, cap: it.title, name: `${it.id} ${it.title}`, p: { name: caseOf(it).title } });
const openIn = (ctx, list, it, from) => ctx.open('viewer', { list: list.map(asFile), idx: list.indexOf(it) }, from);
const media = (it, cls = '') => it.video
  ? `<video class="${cls}" src="${it.mp4}" poster="${it.src}" ${RM ? '' : 'autoplay'} muted loop playsinline aria-label="${esc(it.title)}"></video>`
  : `<img class="${cls}" src="${it.src}" alt="${esc(it.title)}" decoding="async">`;
const rar = (it) => gal().rarity[it.cat];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- the app: two tabs
export function gallery(body, opts = {}, ctx) {
  let tab = opts.tab || store.get('gtab') || 'machine';
  body.innerHTML = `<div class="gx">
    <div class="gx__bar"><div class="gx__tabs" role="tablist" aria-label="gallery.exe">
      <button type="button" role="tab" data-tab="machine">Capsule machine</button>
      <button type="button" role="tab" data-tab="board">Case board</button></div>
      <span class="gx__count" aria-live="polite"></span></div>
    <div class="gx__pane"></div></div>`;
  const pane = body.querySelector('.gx__pane'), count = body.querySelector('.gx__count');
  let cleanup = null;
  const show = (t) => {
    tab = t; store.set('gtab', t);
    body.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    if (cleanup) cleanup();
    pane.innerHTML = '';
    cleanup = t === 'board' ? board(pane, ctx, count) : machine(pane, ctx, count);
  };
  body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  show(tab);
}

// ---------------------------------------------------------------- capsule machine
function machine(pane, ctx, count) {
  const g = gal();
  const found = new Set((store.get('capsules') || []).filter((id) => g.byId[id]));
  const save = () => store.set('capsules', [...found]);
  const balls = Array.from({ length: 22 }, (_, i) => {
    const pool = ['Logos', 'Logos', 'xMoney visuals', 'Branding', 'Branding', '3D', '3D', 'Motion', 'Overview'];
    const col = g.rarity[pool[(i * 7 + 3) % pool.length]].color;
    const row = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4][i];
    const inRow = [5, 5, 5, 4, 3][row], k = i - [0, 5, 10, 15, 19][row];
    const x = 50 + (k - (inRow - 1) / 2) * 17 + (row % 2 ? 4 : -2), y = 84 - row * 15.5;
    return `<i style="--c:${col};left:${x}%;top:${y}%;--r:${(i * 47) % 360}deg"></i>`;
  }).join('');
  pane.innerHTML = `<div class="cm">
    <div class="cm__left">
      <div class="cm__machine" aria-hidden="true">
        <div class="cm__globe"><div class="cm__balls">${balls}</div><span class="cm__shine"></span></div>
        <div class="cm__neck"></div>
        <div class="cm__body">
          <span class="cm__plate">gallery.exe</span>
          <span class="cm__price">1 pull · free</span>
          <span class="cm__knob"><b></b></span>
          <span class="cm__chute"><span class="cm__cap"><i></i><i></i></span></span>
        </div>
      </div>
      <div class="cm__actions">
        <button type="button" class="os-btn os-btn--hot cm__pull" data-a="pull">Pull the lever</button>
        <button type="button" class="os-btn" data-a="ten">Pull 10</button>
      </div>
      <ul class="cm__legend" aria-label="Capsule colours">${g.cats.filter((c) => c !== 'Overview').map((c) => `<li><i style="--c:${g.rarity[c].color}"></i>${esc(c === 'xMoney visuals' ? 'xMoney' : c)} <span>${esc(g.rarity[c].label)}</span></li>`).join('')}</ul>
    </div>
    <section class="album" aria-label="Album">
      <header class="album__head"><h2>Album</h2><span class="album__count"></span><button type="button" class="album__skip" data-a="all">Skip the game, show me everything</button></header>
      ${g.cats.map((cat) => `<h3 class="album__cat"><i style="--c:${g.rarity[cat].color}"></i>${esc(cat)} <span data-cat="${esc(cat)}"></span></h3>
        <ul class="album__grid" role="list">${g.items.filter((it) => it.cat === cat).map((it) => `<li><button type="button" class="slot" data-id="${it.id}" style="--c:${g.rarity[cat].color};--ar:${it.w}/${it.h}"></button></li>`).join('')}</ul>`).join('')}
    </section>
    <div class="cm-reveal" hidden></div>
  </div>`;
  const reveal = pane.querySelector('.cm-reveal'), mach = pane.querySelector('.cm__machine'), cap = pane.querySelector('.cm__cap');
  const albumOrder = () => g.items.filter((it) => found.has(it.id));
  function paintSlot(b, flash) {
    const it = g.byId[b.dataset.id];
    const on = found.has(it.id);
    b.classList.toggle('is-found', on);
    b.innerHTML = on ? `<img src="${it.thumb}" alt="" loading="lazy" decoding="async">${it.video ? '<span class="slot__play" aria-hidden="true"></span>' : ''}` : `<span class="slot__q">${esc(it.id)}</span>`;
    b.setAttribute('aria-label', on ? `${it.title}, ${it.cat}` : `Not found yet, ${it.cat}`);
    if (flash) { b.classList.remove('is-new'); void b.offsetWidth; b.classList.add('is-new'); }
  }
  function paintCounts() {
    pane.querySelector('.album__count').textContent = `${found.size} / ${g.items.length} found`;
    pane.querySelectorAll('[data-cat]').forEach((s) => { const all = g.items.filter((it) => it.cat === s.dataset.cat); s.textContent = `${all.filter((it) => found.has(it.id)).length}/${all.length}`; });
    count.textContent = found.size === g.items.length ? 'Album complete' : `${found.size} / ${g.items.length} found`;
    pane.querySelector('[data-a=all]').hidden = found.size === g.items.length;
  }
  pane.querySelectorAll('.slot').forEach((b) => {
    paintSlot(b);
    b.addEventListener('click', () => {
      const it = g.byId[b.dataset.id];
      if (!found.has(it.id)) { ctx.say('Not found yet. Pull the lever'); mach.classList.remove('is-nudge'); void mach.offsetWidth; mach.classList.add('is-nudge'); return; }
      openIn(ctx, albumOrder(), it, b);
    });
  });
  paintCounts();

  const pickOne = () => {
    const left = g.items.filter((it) => !found.has(it.id));
    return left.length ? left[Math.floor(Math.random() * left.length)] : g.items[Math.floor(Math.random() * g.items.length)];
  };
  let busy = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, RM ? 0 : ms));
  async function crank(fast) {
    mach.classList.remove('is-turning', 'is-dropping'); void mach.offsetWidth;
    mach.classList.add('is-turning');
    await wait(fast ? 380 : 620);
    mach.classList.add('is-dropping');
    await wait(fast ? 300 : 650);
  }
  async function pull() {
    if (busy) return; busy = true;
    const it = pickOne(), isNew = !found.has(it.id);
    cap.style.setProperty('--c', rar(it).color);
    await crank(false);
    found.add(it.id); save();
    showPrize(it, isNew);
    const slot = pane.querySelector(`.slot[data-id="${it.id}"]`); paintSlot(slot, true); paintCounts();
    busy = false;
  }
  async function pullTen() {
    if (busy) return; busy = true;
    const left = shuffle(g.items.filter((it) => !found.has(it.id)));
    const picks = (left.length ? left : shuffle([...g.items])).slice(0, 10);
    cap.style.setProperty('--c', rar(picks[0]).color);
    await crank(true);
    const fresh = picks.filter((it) => !found.has(it.id)).map((it) => it.id);
    picks.forEach((it) => found.add(it.id)); save();
    showTen(picks, new Set(fresh));
    picks.forEach((it) => paintSlot(pane.querySelector(`.slot[data-id="${it.id}"]`), true)); paintCounts();
    busy = false;
  }
  function closeReveal() { reveal.querySelectorAll('video').forEach((v) => v.pause()); reveal.hidden = true; reveal.innerHTML = ''; mach.classList.remove('is-turning', 'is-dropping'); }
  function wireReveal() {
    reveal.querySelector('[data-r=again]')?.addEventListener('click', () => { closeReveal(); pull(); });
    reveal.querySelector('[data-r=close]')?.addEventListener('click', closeReveal);
    reveal.addEventListener('click', (e) => { if (e.target === reveal) closeReveal(); }, { once: true });
    reveal.querySelector('button')?.focus({ preventScroll: true });
  }
  function showPrize(it, isNew) {
    const r = rar(it);
    const done = found.size === g.items.length && isNew;
    reveal.innerHTML = `<div class="prize" role="dialog" aria-label="${esc(it.title)}" style="--c:${r.color}">
      <span class="prize__cap" aria-hidden="true"><i></i><i></i></span>
      <div class="prize__card">
        <div class="prize__media" style="aspect-ratio:${it.w}/${it.h}">${media(it)}</div>
        <div class="prize__meta"><span class="prize__tag">${isNew ? 'New' : 'Already in your album'}</span><span class="prize__rar">${esc(r.label)} · ${esc(it.cat)}</span></div>
        <h3>${esc(it.title)}</h3>
        <p class="prize__sub">#${esc(it.id)} · ${esc(it.kind)}${it.year ? ' · ' + esc(it.year) : ''}</p>
        ${done ? '<p class="prize__done">That was the last one. Album complete.</p>' : ''}
        <div class="os-row"><button type="button" class="os-btn os-btn--hot" data-r="again">Pull again</button><button type="button" class="os-btn" data-r="big">See it big</button><button type="button" class="os-btn os-btn--quiet" data-r="close">Back to the album</button></div>
      </div></div>`;
    reveal.hidden = false;
    reveal.querySelector('[data-r=big]').addEventListener('click', (e) => { closeReveal(); openIn(ctx, albumOrder(), it, e.currentTarget); });
    wireReveal();
  }
  function showTen(picks, fresh) {
    reveal.innerHTML = `<div class="prize prize--ten" role="dialog" aria-label="Ten capsules">
      <div class="prize__card"><h3>${fresh.size} new ${fresh.size === 1 ? 'piece' : 'pieces'}${fresh.size < picks.length ? `, ${picks.length - fresh.size} you had` : ''}</h3>
        <ul class="ten" role="list">${picks.map((it, i) => `<li style="--c:${rar(it).color};--d:${i * 60}ms"><button type="button" data-id="${it.id}"><img src="${it.thumb}" alt="" decoding="async"><span>${esc(it.title)}</span>${fresh.has(it.id) ? '<b>New</b>' : ''}</button></li>`).join('')}</ul>
        <div class="os-row"><button type="button" class="os-btn os-btn--hot" data-r="again">Pull once more</button><button type="button" class="os-btn os-btn--quiet" data-r="close">Back to the album</button></div>
      </div></div>`;
    reveal.hidden = false;
    reveal.querySelectorAll('.ten [data-id]').forEach((b) => b.addEventListener('click', () => { const it = g.byId[b.dataset.id]; closeReveal(); openIn(ctx, albumOrder(), it, b); }));
    wireReveal();
  }
  pane.querySelector('[data-a=pull]').addEventListener('click', pull);
  pane.querySelector('[data-a=ten]').addEventListener('click', pullTen);
  pane.querySelector('[data-a=all]').addEventListener('click', () => {
    g.items.forEach((it) => found.add(it.id)); save();
    pane.querySelectorAll('.slot').forEach((b, i) => setTimeout(() => paintSlot(b, true), RM ? 0 : i * 12));
    paintCounts();
  });
  // the knob turns when you grab it, too
  mach.addEventListener('click', pull);
  const onKey = (e) => { if (e.key === 'Escape' && !reveal.hidden) { e.stopPropagation(); closeReveal(); } };
  pane.addEventListener('keydown', onKey);
  return () => closeReveal();
}

// ---------------------------------------------------------------- case board
const PIN = 8; // the pin sits this far below the top edge of a print
function layoutBoard(W, top = 260) {
  const g = gal();
  const rnd = (n) => { const x = Math.sin(n * 9301.13 + 49297.7) * 233280; return x - Math.floor(x); };
  const GAP = 110, CARD = { w: 250, h: 150 };
  let x = 140, y = top, rowH = 0;
  const nodes = {}, prints = [], cards = [];
  g.cases.forEach((c, ci) => {
    const its = c.items.map((id) => g.byId[id]).filter(Boolean);
    const sizes = its.map((it) => { const ar = it.w / it.h; const w = Math.round(Math.sqrt(24000 * ar)); return { w, h: Math.round(w / ar) }; });
    const cols = its.length <= 3 ? its.length : its.length <= 6 ? 3 : 4;
    const cellW = Math.max(...sizes.map((s) => s.w)) + 44, cellH = Math.max(...sizes.map((s) => s.h)) + 74;
    const rows = Math.ceil(its.length / cols);
    const bw = Math.max(CARD.w + 40, cols * cellW), bh = CARD.h + 40 + rows * cellH;
    if (x + bw > W) { x = 140; y += rowH + GAP; rowH = 0; }
    const card = { id: 'case-' + c.id, c, x: x + 10, y, w: CARD.w, h: CARD.h, rot: (rnd(ci) - 0.5) * 4 };
    cards.push(card); nodes[card.id] = card;
    its.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols), s = sizes[i];
      const p = {
        id: 'p-' + it.id, it, w: s.w, h: s.h,
        x: Math.round(x + col * cellW + (cellW - s.w) / 2 + (rnd(i + ci * 31) - 0.5) * 18),
        y: Math.round(y + CARD.h + 40 + row * cellH + (rnd(i * 3 + ci) - 0.5) * 16),
        rot: (rnd(i * 7 + ci * 13) - 0.5) * 7
      };
      prints.push(p); nodes[p.id] = p;
    });
    x += bw + GAP; rowH = Math.max(rowH, bh);
  });
  return { W, H: y + rowH + 200, nodes, prints, cards };
}

function board(pane, ctx, count) {
  const g = gal();
  const phone = ctx.mode !== 'desk';
  const BW = phone ? 2300 : 4300;
  const L = layoutBoard(BW, phone ? 420 : 260);
  const saved = store.get('board-pos') || {};
  Object.values(L.nodes).forEach((n) => { if (saved[n.id]) { n.x = saved[n.id][0]; n.y = saved[n.id][1]; } });
  const seen = new Set((store.get('board-seen') || []).filter((id) => g.byId[id]));
  pane.innerHTML = `<div class="cb">
    <div class="cb__view" tabindex="0" aria-label="Case board. Drag to look around, scroll or pinch to zoom, click a print to inspect it.">
      <div class="cb__world" style="width:${L.W}px;height:${L.H}px">
        <h2 class="cb__title">Case file: ten years of work<small>${g.items.length} exhibits · ${g.cases.length} cases · follow the red string</small></h2>
        <svg class="cb__strings" width="${L.W}" height="${L.H}" aria-hidden="true"></svg>
        ${L.cards.map((k) => `<div class="cb__card" data-node="${k.id}" style="left:${k.x}px;top:${k.y}px;width:${k.w}px;--rot:${k.rot}deg"><span class="cb__pin" aria-hidden="true"></span>
          <span class="cb__case">Case ${String(g.cases.indexOf(k.c) + 1).padStart(2, '0')}</span><b>${esc(k.c.title)}</b><span class="cb__note">${esc(k.c.note)}</span><span class="cb__n">${k.c.items.length} exhibits</span></div>`).join('')}
        ${L.prints.map((p) => `<button type="button" class="cb__print${seen.has(p.it.id) ? ' is-seen' : ''}" data-node="${p.id}" data-id="${p.it.id}" style="left:${p.x}px;top:${p.y}px;--rot:${p.rot}deg" aria-label="Exhibit ${esc(p.it.id)}: ${esc(p.it.title)}">
          <span class="cb__pin" aria-hidden="true"></span><img src="${p.it.thumb}" alt="" width="${p.w}" height="${p.h}" loading="lazy" decoding="async" draggable="false">
          <span class="cb__label">${esc(p.it.id)} · ${esc(p.it.title)}</span>${p.it.video ? '<span class="cb__vid" aria-hidden="true">Motion</span>' : ''}<span class="cb__stamp" aria-hidden="true">Reviewed</span></button>`).join('')}
        <p class="cb__sticky" style="left:${phone ? 160 : 960}px;top:${phone ? 190 : 46}px">${phone ? 'tap a print to inspect it. pinch to zoom' : 'click a print to inspect it. drag to look around, scroll to zoom'}</p>
      </div>
    </div>
    <div class="cb__tools" role="toolbar" aria-label="Board">
      <button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="fit">Fit</button><button type="button" data-z="tidy">Tidy</button>
    </div>
    <aside class="cb__insp" hidden aria-live="polite"></aside>
    <div class="cb__closed" hidden><b>Case closed</b><span>You reviewed every exhibit.</span></div>
  </div>`;
  const view = pane.querySelector('.cb__view'), world = pane.querySelector('.cb__world'), svg = pane.querySelector('.cb__strings'), insp = pane.querySelector('.cb__insp');
  const el = (id) => world.querySelector(`[data-node="${id}"]`);

  // ---- red string
  const strings = [];
  const pinOf = (n) => ({ x: n.x + n.w / 2, y: n.y + PIN });
  const mk = (a, b, cls) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('class', cls); svg.appendChild(p); const s = { a, b, p }; strings.push(s); return s; };
  const draw = (s) => {
    const A = pinOf(L.nodes[s.a]), B = pinOf(L.nodes[s.b]);
    const d = Math.hypot(B.x - A.x, B.y - A.y), sag = Math.min(90, d * 0.1);
    s.p.setAttribute('d', `M${A.x},${A.y} Q${(A.x + B.x) / 2},${(A.y + B.y) / 2 + sag} ${B.x},${B.y}`);
  };
  g.links.forEach(([a, b]) => mk('case-' + a, 'case-' + b, 'str str--case'));
  L.prints.forEach((p) => mk('case-' + p.it.case, p.id, 'str'));
  strings.forEach(draw);
  const redrawFor = (id) => strings.forEach((s) => { if (s.a === id || s.b === id) draw(s); });

  // ---- pan and zoom
  const v = { x: 0, y: 0, s: 1 };
  const apply = () => { world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`; };
  const clampS = (s) => Math.min(2.4, Math.max(0.16, s));
  const zoomAt = (cx, cy, f) => { const r = view.getBoundingClientRect(); const px = cx - r.left, py = cy - r.top; const ns = clampS(v.s * f); v.x = px - (px - v.x) * (ns / v.s); v.y = py - (py - v.y) * (ns / v.s); v.s = ns; apply(); };
  const fit = (animate) => {
    const r = view.getBoundingClientRect();
    v.s = clampS(Math.min(r.width / L.W, r.height / L.H) * 0.96);
    v.x = (r.width - L.W * v.s) / 2; v.y = (r.height - L.H * v.s) / 2;
    if (animate && !RM) { world.classList.add('is-gliding'); setTimeout(() => world.classList.remove('is-gliding'), 420); }
    apply();
  };
  const focusOn = (n, s) => {
    const r = view.getBoundingClientRect();
    v.s = clampS(s); v.x = r.width / 2 - (n.x + n.w / 2) * v.s; v.y = r.height / 2.4 - (n.y + n.h / 2) * v.s;
    if (!RM) { world.classList.add('is-gliding'); setTimeout(() => world.classList.remove('is-gliding'), 420); }
    apply();
  };
  // start on the first case, close enough to read the cards
  requestAnimationFrame(() => { const first = L.cards[0]; v.s = phone ? 0.42 : 0.62; v.x = 24 - (first.x - 20) * v.s; v.y = 20 - 40 * v.s; apply(); });
  // a mouse wheel zooms; a trackpad's two-finger scroll pans and its pinch (ctrl + wheel) zooms
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pan = !e.ctrlKey && (Math.abs(e.deltaX) > 0.5 || (e.deltaMode === 0 && Math.abs(e.deltaY) < 40 && !Number.isInteger(e.deltaY)));
    if (pan) { v.x -= e.deltaX; v.y -= e.deltaY; apply(); }
    else zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  // one pointer pans the board or drags a print; two pointers pinch
  const pts = new Map();
  let drag = null, pinch = null;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    view.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      if (drag && drag.node) el(drag.node.id).classList.remove('is-lifted');
      drag = null; return;
    }
    const t = e.target.closest('[data-node]');
    drag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, node: t ? L.nodes[t.dataset.node] : null, el: t };
  });
  view.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      v.x += cx - pinch.cx; v.y += cy - pinch.cy; apply();
      zoomAt(cx, cy, d / pinch.d);
      pinch = { d, cx, cy }; return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    if (!drag.moved) { drag.moved = true; view.classList.add('is-grabbing'); if (drag.node) drag.el.classList.add('is-lifted'); }
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.node) {
      drag.node.x += dx / v.s; drag.node.y += dy / v.s;
      Object.assign(drag.el.style, { left: drag.node.x + 'px', top: drag.node.y + 'px' });
      redrawFor(drag.node.id);
    } else { v.x += dx; v.y += dy; apply(); }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!drag) return;
    const d = drag; drag = null;
    view.classList.remove('is-grabbing');
    if (d.node && d.moved) { d.el.classList.remove('is-lifted'); const pos = store.get('board-pos') || {}; pos[d.node.id] = [Math.round(d.node.x), Math.round(d.node.y)]; store.set('board-pos', pos); }
    if (!d.moved && d.el && d.el.classList.contains('cb__print')) inspect(g.byId[d.el.dataset.id], d.el);
    if (!d.moved && d.el && d.el.classList.contains('cb__card')) focusOn(d.node, phone ? 0.7 : 0.9);
  };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
    if (k) { e.preventDefault(); v.x += k[0]; v.y += k[1]; apply(); }
    if (e.key === '+' || e.key === '=') { const r = view.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); }
    if (e.key === '-') { const r = view.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); }
    if (e.key === 'Enter' && e.target.classList.contains('cb__print')) inspect(g.byId[e.target.dataset.id], e.target);
  });
  pane.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
    const r = view.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (b.dataset.z === 'in') zoomAt(cx, cy, 1.25);
    if (b.dataset.z === 'out') zoomAt(cx, cy, 0.8);
    if (b.dataset.z === 'fit') fit(true);
    if (b.dataset.z === 'tidy') {
      const fresh = layoutBoard(BW, phone ? 420 : 260);
      store.set('board-pos', {});
      Object.values(fresh.nodes).forEach((n) => { const o = L.nodes[n.id]; o.x = n.x; o.y = n.y; const node = el(n.id); node.classList.add('is-settling'); Object.assign(node.style, { left: n.x + 'px', top: n.y + 'px' }); setTimeout(() => node.classList.remove('is-settling'), 450); });
      strings.forEach(draw);
    }
  }));

  // ---- the inspector
  let current = null, openedAt = 0;
  // the tap that opens the inspector must not also land on the inspector that just appeared under the finger
  const fresh = () => performance.now() - openedAt < 450;
  function paintCount() {
    count.textContent = `Reviewed ${seen.size} / ${g.items.length}`;
    if (seen.size === g.items.length) pane.querySelector('.cb__closed').hidden = false;
  }
  function inspect(it, from) {
    current = it; openedAt = performance.now();
    const c = caseOf(it);
    const linked = c.items.filter((id) => id !== it.id).map((id) => g.byId[id]);
    const rows = [['Case', `${String(g.cases.indexOf(c) + 1).padStart(2, '0')} · ${c.title}`], ['Type', it.kind], ['Year', it.year], ['For', it.where], ['Role', it.role]].filter((r) => r[1]);
    insp.innerHTML = `<div class="ins">
      <header class="ins__head"><span class="ins__no">Exhibit ${esc(it.id)}</span><button type="button" class="ins__x" aria-label="Close the inspector">×</button></header>
      <button type="button" class="ins__media" style="aspect-ratio:${it.w}/${it.h}" aria-label="See ${esc(it.title)} big">${media(it)}</button>
      <h3>${esc(it.title)}</h3>
      <dl>${rows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
      <p class="ins__note">${esc(c.note)}</p>
      ${linked.length ? `<p class="ins__lbl">Linked evidence</p><ul class="ins__linked" role="list">${linked.map((l) => `<li><button type="button" data-id="${l.id}" aria-label="${esc(l.title)}"><img src="${l.thumb}" alt="" loading="lazy"></button></li>`).join('')}</ul>` : ''}
      <div class="os-row"><button type="button" class="os-btn os-btn--hot" data-i="big">See it big</button><button type="button" class="os-btn" data-i="find">Show on the board</button></div>
    </div>`;
    insp.hidden = false;
    pane.querySelector('.cb').classList.add('has-insp');
    world.querySelectorAll('.cb__print.is-current').forEach((p) => p.classList.remove('is-current'));
    const pe = world.querySelector(`[data-node="p-${it.id}"]`); pe.classList.add('is-current', 'is-seen');
    svg.querySelectorAll('.str.is-hot').forEach((p) => p.classList.remove('is-hot'));
    strings.forEach((s) => { if (s.b === 'p-' + it.id || (s.a === 'case-' + it.case && s.b.startsWith('p-'))) s.p.classList.add('is-hot'); });
    if (!seen.has(it.id)) { seen.add(it.id); store.set('board-seen', [...seen]); paintCount(); }
    const caseList = c.items.map((id) => g.byId[id]);
    insp.querySelector('.ins__x').addEventListener('click', () => { if (!fresh()) closeInsp(); });
    insp.querySelector('.ins__media').addEventListener('click', (e) => { if (!fresh()) openIn(ctx, caseList, it, e.currentTarget); });
    insp.querySelector('[data-i=big]').addEventListener('click', (e) => { if (!fresh()) openIn(ctx, caseList, it, e.currentTarget); });
    insp.querySelector('[data-i=find]').addEventListener('click', () => { if (fresh()) return; focusOn(L.nodes['p-' + it.id], phone ? 1 : 1.3); if (phone) closeInsp(); });
    insp.querySelectorAll('.ins__linked [data-id]').forEach((b) => b.addEventListener('click', () => { if (!fresh()) inspect(g.byId[b.dataset.id]); }));
  }
  function closeInsp() {
    insp.querySelectorAll('video').forEach((x) => x.pause());
    insp.hidden = true; insp.innerHTML = ''; current = null;
    pane.querySelector('.cb').classList.remove('has-insp');
    world.querySelectorAll('.cb__print.is-current').forEach((p) => p.classList.remove('is-current'));
    svg.querySelectorAll('.str.is-hot').forEach((p) => p.classList.remove('is-hot'));
  }
  pane.querySelector('.cb__closed').addEventListener('click', (e) => { e.currentTarget.hidden = true; });
  pane.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) { e.stopPropagation(); closeInsp(); } });
  paintCount();
  const ro = new ResizeObserver(() => apply()); ro.observe(view);
  return () => { ro.disconnect(); closeInsp(); };
}
