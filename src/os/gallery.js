// gallery.exe: the rest of the work (3D, motion, branding, logos), two ways in.
// The capsule machine (a Blender render: a still, and one clip of the knob turning and a capsule dropping out)
// hands them out one turn at a time and keeps an album of what you found.
// The wall is the same one as /gallery on the website: every piece at once, dragged around, and each opens big.
import { DATA, esc, store } from './content.js';
import { createWall } from '../scripts/wall-core.js';

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
const asFile = (it) => ({ type: it.video ? 'video' : 'image', src: it.video ? it.mp4 : it.src, sound: it.sound, hd: it.hd, poster: it.src, cap: it.title, name: `${it.id} ${it.title}`, p: { name: caseOf(it).title } });
const openIn = (ctx, list, it, from) => ctx.open('viewer', { list: list.map(asFile), idx: list.indexOf(it) }, from);
const media = (it, cls = '') => it.video
  ? `<video class="${cls}" src="${it.mp4}" poster="${it.src}" ${RM ? '' : 'autoplay'} muted loop playsinline aria-label="${esc(it.title)}"></video>`
  : `<img class="${cls}" src="${it.src}" alt="${esc(it.title)}" decoding="async">`;
const rar = (it) => gal().rarity[it.cat];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- the app: two tabs
export function gallery(body, opts = {}, ctx) {
  let tab = opts.tab || store.get('gtab') || 'machine';
  if (tab === 'board') tab = 'wall'; // the case board became the wall
  body.innerHTML = `<div class="gx">
    <div class="gx__bar"><div class="gx__tabs" role="tablist" aria-label="gallery.exe">
      <button type="button" role="tab" data-tab="machine">Capsule machine</button>
      <button type="button" role="tab" data-tab="wall">The wall</button></div>
      <span class="gx__count" aria-live="polite"></span></div>
    <div class="gx__pane"></div></div>`;
  const pane = body.querySelector('.gx__pane'), count = body.querySelector('.gx__count');
  let cleanup = null;
  const show = (t) => {
    tab = t; store.set('gtab', t);
    body.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    if (cleanup) cleanup();
    pane.innerHTML = '';
    cleanup = t === 'wall' ? wall(pane, ctx, count) : machine(pane, ctx, count);
  };
  body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  show(tab);
}

// ---------------------------------------------------------------- capsule machine
function machine(pane, ctx, count) {
  const g = gal();
  const found = new Set((store.get('capsules') || []).filter((id) => g.byId[id]));
  const save = () => store.set('capsules', [...found]);
  pane.innerHTML = `<div class="cm">
    <div class="cm__left">
      <button type="button" class="cm__machine" data-a="knob" aria-label="Turn the knob">
        <img class="cm__still" src="${g.machine.still}" width="800" height="1000" alt="" decoding="async">
        <video class="cm__clip" muted playsinline preload="auto" aria-hidden="true" tabindex="-1"><source src="${g.machine.pull}" type="video/mp4"><source src="${g.machine.pullWebm}" type="video/webm"></video>
      </button>
      <div class="cm__actions">
        <button type="button" class="os-btn os-btn--hot cm__pull" data-a="pull">Turn the knob</button>
        <button type="button" class="os-btn" data-a="ten">Ten turns</button>
      </div>
    </div>
    <section class="album" aria-label="Album">
      <header class="album__head"><h2>Album</h2><span class="album__count"></span><button type="button" class="album__skip" data-a="all">Skip the game, show me everything</button></header>
      ${g.cats.map((cat) => `<h3 class="album__cat"><i style="--c:${g.rarity[cat].color}"></i>${esc(cat)} <span data-cat="${esc(cat)}"></span></h3>
        <ul class="album__grid" role="list">${g.items.filter((it) => it.cat === cat).map((it) => `<li><button type="button" class="slot" data-id="${it.id}" style="--c:${g.rarity[cat].color};--ar:${it.w}/${it.h}"></button></li>`).join('')}</ul>`).join('')}
    </section>
    <div class="cm-reveal" hidden></div>
  </div>`;
  const reveal = pane.querySelector('.cm-reveal'), mach = pane.querySelector('.cm__machine'), clip = pane.querySelector('.cm__clip');
  const albumOrder = () => g.items.filter((it) => found.has(it.id));
  function paintSlot(b, flash) {
    const it = g.byId[b.dataset.id];
    const on = found.has(it.id);
    b.classList.toggle('is-found', on);
    b.dataset.shape = it.w >= it.h ? 'wide' : 'tall';
    b.innerHTML = on ? `<span class="slot__pic"><img src="${it.thumb}" alt="" loading="lazy" decoding="async">${it.video ? '<span class="slot__play" aria-hidden="true"></span>' : ''}</span>` : `<span class="slot__q">${esc(it.id)}</span>`;
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
      if (!found.has(it.id)) { ctx.say('Not found yet. Turn the knob'); mach.classList.remove('is-nudge'); void mach.offsetWidth; mach.classList.add('is-nudge'); return; }
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
  // play the render: the knob turns, a capsule rolls out; the card comes up as it lands
  async function crank(fast) {
    if (RM) return;
    clip.playbackRate = fast ? 1.8 : 1;
    try { clip.currentTime = 0; } catch (e) {}
    mach.classList.add('is-playing');
    try { await clip.play(); } catch (e) { mach.classList.remove('is-playing'); return; }
    const land = 1.86; // seconds into the clip: the capsule has hit the floor
    await new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; clip.removeEventListener('timeupdate', tick); clip.removeEventListener('ended', fin); res(); };
      const tick = () => { if (clip.currentTime >= land) fin(); };
      clip.addEventListener('timeupdate', tick); clip.addEventListener('ended', fin);
      setTimeout(fin, (land / clip.playbackRate) * 1000 + 900);
    });
  }
  async function pull() {
    if (busy) return; busy = true;
    const it = pickOne(), isNew = !found.has(it.id);
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
    await crank(true);
    const fresh = picks.filter((it) => !found.has(it.id)).map((it) => it.id);
    picks.forEach((it) => found.add(it.id)); save();
    showTen(picks, new Set(fresh));
    picks.forEach((it) => paintSlot(pane.querySelector(`.slot[data-id="${it.id}"]`), true)); paintCounts();
    busy = false;
  }
  // back to the still, ready for the next turn
  const resetMachine = () => { clip.pause(); mach.classList.remove('is-playing'); try { clip.currentTime = 0; } catch (e) {} };
  // while a card is up, the album behind it must not scroll (on the phone a swipe on the card used to move the album)
  const lock = (on) => [pane.querySelector('.cm'), pane.closest('.sheet__body'), pane.closest('.win__body')].forEach((el) => el && el.classList.toggle('is-locked', on));
  function openReveal() { reveal.hidden = false; reveal.scrollTop = 0; lock(true); }
  function closeReveal() { reveal.querySelectorAll('video').forEach((v) => v.pause()); reveal.hidden = true; reveal.innerHTML = ''; lock(false); resetMachine(); }
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
        <div class="prize__meta"><span class="prize__tag">${isNew ? 'New' : 'Already in your album'}</span><span class="prize__rar">${esc(it.cat)} · ${esc(caseOf(it).title)}</span></div>
        <h3>${esc(it.title)}</h3>
        <p class="prize__sub">#${esc(it.id)} · ${esc(it.kind)}${it.year ? ' · ' + esc(it.year) : ''}</p>
        ${done ? '<p class="prize__done">That was the last one. Album complete.</p>' : ''}
        <div class="os-row"><button type="button" class="os-btn os-btn--hot" data-r="again">Turn again</button><button type="button" class="os-btn" data-r="big">See it big</button><button type="button" class="os-btn os-btn--quiet" data-r="close">Back to the album</button></div>
      </div></div>`;
    openReveal();
    reveal.querySelector('[data-r=big]').addEventListener('click', (e) => { closeReveal(); openIn(ctx, albumOrder(), it, e.currentTarget); });
    wireReveal();
  }
  function showTen(picks, fresh) {
    reveal.innerHTML = `<div class="prize prize--ten" role="dialog" aria-label="Ten capsules">
      <div class="prize__card"><h3>${fresh.size} new ${fresh.size === 1 ? 'piece' : 'pieces'}${fresh.size < picks.length ? `, ${picks.length - fresh.size} you had` : ''}</h3>
        <ul class="ten" role="list">${picks.map((it, i) => `<li style="--c:${rar(it).color};--d:${i * 60}ms"><button type="button" data-id="${it.id}"><span class="ten__pic"><img src="${it.thumb}" alt="" decoding="async" width="${it.w}" height="${it.h}"></span><span class="ten__name">${fresh.has(it.id) ? '<b>New</b> ' : ''}${esc(it.title)}</span></button></li>`).join('')}</ul>
        <div class="os-row"><button type="button" class="os-btn os-btn--hot" data-r="again">Turn once more</button><button type="button" class="os-btn os-btn--quiet" data-r="close">Back to the album</button></div>
      </div></div>`;
    openReveal();
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
  // the machine itself is the big button
  mach.addEventListener('click', pull);
  const onKey = (e) => { if (e.key === 'Escape' && !reveal.hidden) { e.stopPropagation(); closeReveal(); } };
  pane.addEventListener('keydown', onKey);
  return () => closeReveal();
}

// ---------------------------------------------------------------- the wall
function wall(pane, ctx, count) {
  const g = gal();
  pane.innerHTML = `<div class="gw">
    <div class="wall__view" tabindex="0" role="region" aria-roledescription="canvas" aria-label="The wall, ${g.items.length} pieces. Drag, scroll or use the arrow keys to move around, and press Enter to open the piece in the middle.">
      <div class="wall__plane" aria-hidden="true"></div>
    </div>
    <p class="gw__hint" aria-hidden="true"><span></span>Drag to see more</p>
  </div>`;
  count.textContent = `${g.items.length} pieces`;
  // pieces from one case are kept apart on the wall; a click opens the piece in the viewer, with every piece to page through
  const items = g.items.map((it) => ({ ...it, set: it.case }));
  const w = createWall({
    view: pane.querySelector('.wall__view'),
    plane: pane.querySelector('.wall__plane'),
    items,
    onOpen: (i, el) => openIn(ctx, g.items, g.items[i], el)
  });
  return () => w.destroy();
}
