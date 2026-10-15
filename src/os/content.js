// Angel OS: what every app shows. The desktop (windows) and the phone (full-screen apps)
// both render through these builders, so the content only lives in one place.
// The data (projects, every picture and film from the case studies) is written into the page at build time.
export const DATA = JSON.parse(document.getElementById('aos-data').textContent);
export const PERSON = DATA.person;
export const PROJECTS = DATA.projects;
export const NORMAL_URL = DATA.normal;
export const caseUrl = (p) => p.url;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------- file system
export const FOLDER_OF = { topout: 'Topout', atlas: 'Atlas Pay', pog: 'POG' };
export const PROJECT_OF = Object.fromEntries(PROJECTS.map((p) => [p.name, p]));
export const FOLDERS = {};
PROJECTS.forEach((p) => { FOLDERS[p.name] = p.files.map((f) => ({ ...f, p })); });
FOLDERS.Work = [
  { type: 'folder', name: 'Topout', id: 'topout' },
  { type: 'folder', name: 'Atlas Pay', id: 'atlas' },
  { type: 'folder', name: 'POG', id: 'pog' },
  { type: 'text', name: 'about.txt' },
  { type: 'contact', name: 'contact.vcf' }
];
export const SIDEBAR = ['Work', 'Topout', 'Atlas Pay', 'POG'];

export function glyph(kind, opts = {}) {
  if (kind === 'folder') {
    const p = opts.p;
    return `<span class="glyph glyph--folder" style="--g1:${p ? p.color : '#e4e1d9'}" aria-hidden="true"></span>`;
  }
  if (kind === 'trash') return '<span class="glyph glyph--trash" aria-hidden="true"></span>';
  return `<span class="glyph glyph--file" aria-hidden="true"><b>${esc(opts.ext || '')}</b></span>`;
}

function thumb(f) {
  if (f.type === 'image') return `<span class="file__thumb" style="background:${f.bg}"><img src="${f.thumb}" alt="" loading="lazy" decoding="async" width="${f.tw}" height="${f.th}"></span>`;
  if (f.type === 'video') return `<span class="file__thumb" style="background:${f.bg}"><img src="${f.poster}" alt="" loading="lazy" decoding="async"><span class="file__kind">Video</span></span>`;
  if (f.type === 'folder') return `<span class="file__thumb file__thumb--bare">${glyph('folder', { p: PROJECT_OF[f.name] })}</span>`;
  return `<span class="file__thumb file__thumb--bare">${glyph('file', { ext: f.name.split('.').pop().toUpperCase() })}</span>`;
}

// ---------------------------------------------------------------- builders
// Each builder gets (body, opts, ctx). ctx = { open(id, opts, from), say(text), setTitle(text), mode }

function folder(body, { name = 'Work' } = {}, ctx) {
  const render = (n) => {
    const files = FOLDERS[n] || [];
    const p = PROJECT_OF[n];
    ctx.setTitle(n === 'Work' ? 'Work' : 'Work / ' + n);
    ctx.route && ctx.route(p ? p.id : 'work');
    const side = ctx.mode === 'desk'
      ? `<nav class="folder__side" aria-label="Folders">${SIDEBAR.map((s) => `<button type="button" class="${s === n ? 'is-on' : ''}" data-go="${esc(s)}" ${s === n ? 'aria-current="true"' : ''}>${esc(s)}</button>`).join('')}</nav>`
      : '';
    const head = p
      ? `<header class="folder__head" style="--accent:${p.color}"><div><h2>${esc(p.name)}</h2><p>${esc(p.desc)}</p></div><a class="os-btn" href="${caseUrl(p)}">Read the case study</a></header>`
      : `<header class="folder__head"><div><h2>Selected work</h2><p>Three brands, each built from one idea. Open a folder to look around.</p></div></header>`;
    body.innerHTML = `<div class="folder ${side ? '' : 'folder--solo'}">${side}<div class="folder__main">${head}
      <ul class="folder__grid" role="list">${files.map((f, i) => `<li><button type="button" class="file" data-i="${i}">${thumb(f)}<span class="file__name">${esc(f.name)}</span></button></li>`).join('')}</ul>
      <p class="folder__status">${files.length} items</p></div></div>`;
    body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => render(b.dataset.go)));
    body.querySelectorAll('.file').forEach((b) => b.addEventListener('click', () => {
      const f = files[+b.dataset.i];
      if (f.type === 'folder') return ctx.mode === 'desk' ? render(f.name) : ctx.open(f.id, {}, b);
      if (f.type === 'text') return ctx.open('about', {}, b);
      if (f.type === 'contact') return ctx.open('contact', {}, b);
      const list = files.filter((x) => x.type === 'image' || x.type === 'video');
      ctx.open('viewer', { list, idx: list.indexOf(f) }, b);
    }));
  };
  render(name);
}

function viewer(body, { list, idx = 0 }, ctx) {
  body.innerHTML = `<div class="viewer"><div class="viewer__stage"></div>
    <div class="viewer__bar"><button type="button" class="viewer__nav" data-d="-1" aria-label="Previous">&larr;</button><p class="viewer__cap" aria-live="polite"></p><button type="button" class="viewer__nav" data-d="1" aria-label="Next">&rarr;</button></div></div>`;
  const stage = body.querySelector('.viewer__stage'), cap = body.querySelector('.viewer__cap');
  const show = () => {
    const f = list[idx];
    stage.style.background = f.bg || '';
    stage.innerHTML = f.type === 'image'
      ? `<img src="${f.src}" alt="${esc(f.cap)}" width="${f.w}" height="${f.h}">`
      : `<video src="${f.src}" poster="${f.poster}" ${RM ? 'controls' : 'autoplay'} muted loop playsinline aria-label="${esc(f.cap)}"></video>`;
    cap.innerHTML = `<span class="viewer__text">${esc(f.cap)}</span><span class="viewer__count">${esc(f.p.name)}, ${idx + 1} of ${list.length}</span>`;
    ctx.setTitle(f.name);
  };
  const step = (d) => { idx = (idx + d + list.length) % list.length; show(); };
  body.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => step(+b.dataset.d)));
  // swipe on touch screens, arrows on keyboards (wired by the shell through ctx.step)
  let sx = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); });
  ctx.step = step;
  show();
}

const ABOUT = [
  ['h', PERSON.name],
  ['p', `${PERSON.role}. ${PERSON.base}.`],
  ['p', 'I design identities that work flat, in 3D and in motion. From the first sketch of a mark to the system, 3D and motion around it.'],
  ['h3', 'Selected work'],
  ['list', PROJECTS.map((p) => [p.name, p.sector, p.id])],
  ['p', 'I work with founders hiring directly, and with studios that need an extra pair of hands.'],
  ['mail', PERSON.email]
];
function about(body, _o, ctx) {
  body.innerHTML = `<article class="doc">${ABOUT.map(([t, v]) => {
    if (t === 'h') return `<h2>${esc(v)}</h2>`;
    if (t === 'h3') return `<h3>${esc(v)}</h3>`;
    if (t === 'list') return `<ul class="doc__work">${v.map(([n, s, id]) => `<li><button type="button" data-open="${id}">${esc(n)}</button><span>${esc(s)}</span></li>`).join('')}</ul>`;
    if (t === 'mail') return `<p><a href="mailto:${v}">${esc(v)}</a></p>`;
    return `<p>${esc(v)}</p>`;
  }).join('')}</article>`;
  body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => ctx.open(b.dataset.open, {}, b)));
}

// remember the choice, so the next visit opens the normal website straight away
export function goNormal() {
  try { localStorage.setItem('aos-pref', 'site'); } catch (e) {}
  location.href = NORMAL_URL;
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-switch]')) { try { localStorage.setItem('aos-pref', 'site'); } catch (err) {} } });

export async function copyEmail(ctx) {
  try { await navigator.clipboard.writeText(PERSON.email); ctx.say('Email copied'); }
  catch (e) { ctx.say(PERSON.email); }
}

function contact(body, _o, ctx) {
  body.innerHTML = `<div class="card">
    <h2>${esc(PERSON.name)}</h2>
    <p>${esc(PERSON.role)}. ${esc(PERSON.base)}.</p>
    <p class="card__mail" translate="no">${esc(PERSON.email)}</p>
    <div class="os-row">
      <a class="os-btn os-btn--hot" href="mailto:${PERSON.email}">Write an email</a>
      <button class="os-btn" type="button" data-a="copy">Copy email</button>
    </div>
    <div class="os-row">
      <a class="os-btn os-btn--quiet" href="${PERSON.behance}" target="_blank" rel="noopener">Behance</a>
      <a class="os-btn os-btn--quiet" href="${PERSON.linkedin}" target="_blank" rel="noopener">LinkedIn</a>
    </div></div>`;
  body.querySelector('[data-a=copy]').addEventListener('click', () => copyEmail(ctx));
}

function mail(body, { subject = '' } = {}, ctx) {
  body.innerHTML = `<form class="mail" novalidate>
    <div class="mail__row"><span id="mail-to">To</span><span translate="no" aria-labelledby="mail-to">${esc(PERSON.email)}</span></div>
    <label class="mail__row"><span>Subject</span><input name="s" value="${esc(subject)}" placeholder="A new brand for…" autocomplete="off"></label>
    <label class="mail__msg"><span class="sr-only">Message</span><textarea name="m" placeholder="Hi Angel,"></textarea></label>
    <div class="os-row os-row--end"><button class="os-btn os-btn--hot" type="submit">Open in my mail app</button></div></form>`;
  const form = body.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    location.href = `mailto:${PERSON.email}?subject=${encodeURIComponent(form.s.value.trim())}&body=${encodeURIComponent(form.m.value.trim())}`;
    ctx.say('Opening your mail app');
  });
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
}

function terminal(body, _o, ctx) {
  body.innerHTML = `<div class="term"><p class="o">Angel OS terminal. Type <b>help</b> to see what you can do.</p><div class="out" aria-live="polite"></div>
    <label class="in"><span aria-hidden="true">angel@os ~ %</span><input aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></label></div>`;
  const out = body.querySelector('.out'), inp = body.querySelector('input'), term = body.querySelector('.term');
  const print = (s) => { const d = document.createElement('p'); d.className = 'o'; d.innerHTML = s; out.appendChild(d); term.scrollTop = term.scrollHeight; };
  const cmds = {
    help: () => print('<b>ls</b>  list the work\n<b>open</b> topout | atlas | pog | about | contact\n<b>whoami</b>  who made this\n<b>email</b>  write to Angel\n<b>site</b>  switch to the normal website\n<b>date</b>\n<b>clear</b>'),
    ls: (a) => { const k = FOLDER_OF[a] || 'Work'; print((FOLDERS[k] || []).map((f) => f.name).join('\n')); },
    open: (a) => { const ok = ['topout', 'atlas', 'pog', 'about', 'contact', 'work'].includes(a); ok ? ctx.open(a) : print(`nothing called "${esc(a || '')}". Try: topout, atlas, pog, about, contact`); },
    whoami: () => print(`${esc(PERSON.name)}. ${esc(PERSON.role)}. ${esc(PERSON.base)}.`),
    email: () => { print(esc(PERSON.email)); ctx.open('mail'); },
    contact: () => cmds.email(),
    site: () => { print('switching…'); goNormal(); },
    date: () => print(esc(new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date()))),
    clear: () => { out.innerHTML = ''; },
    sudo: (a, rest) => { if ((a + ' ' + rest).includes('hire')) { print('Permission granted.'); ctx.open('mail', { subject: 'Project enquiry' }); } else print('nice try'); }
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const raw = inp.value.trim(); inp.value = '';
    print(`<span class="pr">angel@os ~ %</span> ${esc(raw)}`);
    if (!raw) return;
    const [c, a = '', ...rest] = raw.toLowerCase().split(/\s+/);
    (cmds[c] || (() => print(`command not found: ${esc(c)}. Try <b>help</b>.`)))(a, rest.join(' '));
  });
  term.addEventListener('click', (e) => { if (!getSelection().toString()) inp.focus(); });
  ctx.focusTarget = inp;
}

function trash(body) {
  body.innerHTML = `<div class="empty"><h2>Nothing to see here.</h2><p>Rejected marks end up in this folder. Some of them become whole brands later, like Topout did.</p></div>`;
}

function welcome(body, _o, ctx) {
  body.innerHTML = `<div class="hello">
    <h1 class="hello__title">Hi, I’m Angel.</h1>
    <p class="hello__lede">I design brand identities that work flat, in 3D and in motion. I work directly with founders, and with studios as an embedded designer.</p>
    <ul class="hello__work" role="list">${PROJECTS.map((p) => `<li><button type="button" data-open="${p.id}" style="--accent:${p.color}">${glyph('folder', { p })}<span class="hello__name">${esc(p.name)}</span><span class="hello__sector">${esc(p.sector)}</span></button></li>`).join('')}</ul>
    <div class="os-row">
      <a class="os-btn os-btn--hot" href="mailto:${PERSON.email}">Write an email</a>
      <button class="os-btn" type="button" data-a="copy">Copy email</button>
      <a class="os-btn os-btn--quiet hello__switch" href="${NORMAL_URL}" data-switch>Switch to normal website</a>
    </div>
    ${ctx.mode === 'desk' ? '<p class="hello__hint">Click anything. Drag windows around by their top bar.</p>' : ''}
  </div>`;
  body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => ctx.open(b.dataset.open, {}, b)));
  body.querySelector('[data-a=copy]').addEventListener('click', () => copyEmail(ctx));
}

// ---------------------------------------------------------------- registry
// size = desktop window size; route = the #hash that opens it
export const APPS = {
  welcome: { title: 'Welcome', size: [560, 560], route: '', build: welcome },
  work: { title: 'Work', size: [820, 560], route: 'work', build: (b, o, c) => folder(b, { name: 'Work' }, c) },
  topout: { title: 'Work / Topout', size: [820, 580], route: 'topout', build: (b, o, c) => folder(b, { name: 'Topout' }, c) },
  atlas: { title: 'Work / Atlas Pay', size: [820, 580], route: 'atlas', build: (b, o, c) => folder(b, { name: 'Atlas Pay' }, c) },
  pog: { title: 'Work / POG', size: [820, 580], route: 'pog', build: (b, o, c) => folder(b, { name: 'POG' }, c) },
  viewer: { title: '', size: [900, 620], build: viewer, dark: true },
  about: { title: 'about.txt', size: [520, 560], route: 'about', build: about },
  contact: { title: 'contact.vcf', size: [460, 380], route: 'contact', build: contact },
  mail: { title: 'New message', size: [560, 440], build: mail },
  term: { title: 'Terminal', size: [640, 400], route: 'terminal', build: terminal, dark: true },
  trash: { title: 'Old logos', size: [440, 300], build: trash }
};
// folder windows share one slot on the desktop, so opening Atlas Pay reuses an open Topout window
export const SLOT = { work: 'folder', topout: 'folder', atlas: 'folder', pog: 'folder' };
export const ROUTES = Object.fromEntries(Object.entries(APPS).filter(([, a]) => a.route).map(([id, a]) => [a.route, id]));
