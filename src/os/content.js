// Angel OS: what every app shows. The desktop (windows) and the phone (full-screen apps)
// both render through these builders, so the content only lives in one place.
// The data (projects and every module of each Behance presentation, in order) is written into the page at build time.
export const DATA = JSON.parse(document.getElementById('aos-data').textContent);
export const PERSON = DATA.person;
export const PROJECTS = DATA.projects;
export const NORMAL_URL = DATA.normal;
export const caseUrl = (p) => p.url;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const linkFor = (route) => `${location.origin}/${route ? '#' + route : ''}`;
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('aos-' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('aos-' + k, JSON.stringify(v)); } catch (e) {} }
};

// ---------------------------------------------------------------- file system
export const FOLDER_OF = { topout: 'Topout', atlas: 'Atlas Pay', pog: 'POG' };
export const PROJECT_OF = Object.fromEntries(PROJECTS.map((p) => [p.name, p]));
export const PROJECT_BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
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
  if (kind === 'folder') return `<span class="glyph glyph--folder" style="--g1:${opts.p ? opts.p.color : '#e4e1d9'}" aria-hidden="true"></span>`;
  if (kind === 'trash') return '<span class="glyph glyph--trash" aria-hidden="true"></span>';
  if (kind === 'site') return '<span class="glyph glyph--site" aria-hidden="true"><i></i></span>';
  return `<span class="glyph glyph--file" aria-hidden="true"><b>${esc(opts.ext || '')}</b></span>`;
}

function thumb(f) {
  if (f.type === 'image' || f.type === 'video') {
    return `<span class="file__thumb"><img src="${f.thumb}" alt="" loading="lazy" decoding="async" width="${f.tw}" height="${f.th}">${f.type === 'video' ? '<span class="file__kind">Video</span>' : ''}</span>`;
  }
  if (f.type === 'folder') return `<span class="file__thumb file__thumb--bare">${glyph('folder', { p: PROJECT_OF[f.name] })}</span>`;
  return `<span class="file__thumb file__thumb--bare">${glyph('file', { ext: f.name.split('.').pop().toUpperCase() })}</span>`;
}

// ---------------------------------------------------------------- builders
// Each builder gets (body, opts, ctx).
// ctx = { mode: 'desk' | 'phone', open(id, opts, from), say(text), setTitle(text), route(r), menu(items, event) }

export async function copyText(text, ctx, done = 'Copied') {
  try { await navigator.clipboard.writeText(text); ctx.say(done); }
  catch (e) { ctx.say(text); }
}
export const copyEmail = (ctx) => copyText(PERSON.email, ctx, 'Email copied');

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
      ? `<header class="folder__head"><div><h2>${esc(p.name)}</h2><p>${esc(p.desc)}</p></div><a class="os-btn" href="${caseUrl(p)}">Read the case study</a></header>`
      : `<header class="folder__head"><div><h2>Selected work</h2><p>Three brands, each built from one idea. Open a folder to look around.</p></div></header>`;
    const hint = ctx.mode === 'desk' ? 'Double-click to open' : 'Tap to open';
    body.innerHTML = `<div class="folder ${side ? '' : 'folder--solo'}">${side}<div class="folder__main">${head}
      <ul class="folder__grid" role="list">${files.map((f, i) => `<li><button type="button" class="file" data-i="${i}">${thumb(f)}<span class="file__name">${esc(f.name)}</span></button></li>`).join('')}</ul>
      <p class="folder__status" aria-live="polite">${files.length} items. ${hint}.</p></div></div>`;
    const status = body.querySelector('.folder__status');
    body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => render(b.dataset.go)));
    const openFile = (f, b) => {
      if (f.type === 'folder') return ctx.mode === 'desk' ? render(f.name) : ctx.open(f.id, {}, b);
      if (f.type === 'text') return ctx.open('about', {}, b);
      if (f.type === 'contact') return ctx.open('contact', {}, b);
      const list = files.filter((x) => x.type === 'image' || x.type === 'video');
      ctx.open('viewer', { list, idx: list.indexOf(f) }, b);
    };
    body.querySelectorAll('.file').forEach((b) => {
      const f = files[+b.dataset.i];
      const select = () => {
        body.querySelectorAll('.file.is-sel').forEach((x) => x.classList.remove('is-sel'));
        b.classList.add('is-sel');
        status.textContent = `${files.length} items, 1 selected: ${f.name}`;
      };
      if (ctx.mode === 'desk') {
        b.addEventListener('click', select);
        b.addEventListener('dblclick', () => openFile(f, b));
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); openFile(f, b); } });
      } else {
        b.addEventListener('click', () => openFile(f, b));
      }
      b.addEventListener('contextmenu', (e) => {
        if (!ctx.menu) return;
        e.preventDefault(); select();
        const items = [['Open', () => openFile(f, b)]];
        if (f.p) items.push(['Get info', () => ctx.open('info', { file: f }, b)], '-', ['Read the case study', () => { location.href = caseUrl(f.p); }]);
        if (f.type === 'folder') items.push(['Copy link', () => copyText(linkFor(f.id), ctx, 'Link copied')]);
        ctx.menu(items, e);
      });
    });
  };
  render(name);
}

function viewer(body, { list, idx = 0 }, ctx) {
  body.innerHTML = `<div class="viewer"><div class="viewer__stage"></div>
    <div class="viewer__bar"><button type="button" class="viewer__nav" data-d="-1" aria-label="Previous">&larr;</button><p class="viewer__cap" aria-live="polite"></p><button type="button" class="viewer__nav" data-d="1" aria-label="Next">&rarr;</button></div></div>`;
  const stage = body.querySelector('.viewer__stage'), cap = body.querySelector('.viewer__cap');
  const show = () => {
    const f = list[idx];
    stage.innerHTML = f.type === 'image'
      ? `<img src="${f.src}" alt="${esc(f.p.name + ': ' + f.cap)}">`
      : `<video src="${f.src}" poster="${f.poster}" ${RM ? 'controls' : 'autoplay'} muted loop playsinline aria-label="${esc(f.p.name + ': ' + f.cap)}"></video>`;
    cap.innerHTML = `<span class="viewer__text">${esc(f.cap)}</span><span class="viewer__count">${esc(f.p.name)}, ${idx + 1} of ${list.length}</span>`;
    ctx.setTitle(f.name);
    // warm the next one so stepping through feels instant
    const n = list[(idx + 1) % list.length];
    if (n && n.type === 'image') { const im = new Image(); im.src = n.src; }
  };
  const step = (d) => { idx = (idx + d + list.length) % list.length; show(); };
  body.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => step(+b.dataset.d)));
  let sx = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); });
  ctx.step = step;
  show();
}

const LEDE = 'I design brand identities that work flat, in 3D and in motion: the mark, the type, the app and the film, all from one idea.';

function about(body, _o, ctx) {
  body.innerHTML = `<article class="doc">
    <h2>${esc(PERSON.name)}</h2>
    <p class="doc__role">${esc(PERSON.role)}. ${esc(PERSON.base)}.</p>
    <p>${esc(LEDE)}</p>
    <h3>Selected work</h3>
    <ul class="doc__work">${PROJECTS.map((p) => `<li><button type="button" data-open="${p.id}">${esc(p.name)}</button><span>${esc(p.sector)}</span></li>`).join('')}</ul>
    <p>Ten years of logos, brand systems, 3D and motion, for founders and for studios.</p>
    <p><a href="mailto:${PERSON.email}">${esc(PERSON.email)}</a></p>
  </article>`;
  body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => ctx.open(b.dataset.open, {}, b)));
}

// remember the choice, so the next visit opens the normal website straight away
export function goNormal() {
  try { localStorage.setItem('aos-pref', 'site'); } catch (e) {}
  location.href = NORMAL_URL;
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-switch]')) { try { localStorage.setItem('aos-pref', 'site'); } catch (err) {} } });

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

// ---------------------------------------------------------------- terminal, with a small puzzle in it
// The code is three numbers hidden in the work itself: the holds in the Topout mark,
// the angle of the Atlas Pay ray grid and the faces of POG.
const TOPPED = () => !!store.get('topped');
const NOTE = `Board B has a hidden route. Its code has three parts.

  1. How many holds make the Topout mark?
  2. Atlas Pay is built on a grid of rays. How many degrees apart?
  3. How many faces does POG have?

Every answer is somewhere in the work folders.
Then: unlock <1>-<2>-<3>     (stuck? type hint)`;
const HINTS = ['Open the Topout folder and look at 07-the-mark.', 'In Atlas Pay, 08-icon-construction says it in the title.', 'In POG, count the faces in 09-all-the-faces.'];
const HOLD = (lit) => {
  const rows = [3, 5, 5, 5, 3], out = [];
  rows.forEach((n, r) => { const pad = ' '.repeat((5 - n) * 2); out.push(pad + Array.from({ length: n }, (_, i) => (r === 0 && i === 1 && lit ? '<b>●</b>' : '●')).join(' ')); });
  return out.join('\n');
};

function terminal(body, _o, ctx) {
  body.innerHTML = `<div class="term"><p class="o">Angel OS terminal. Type <b>help</b> to see what you can do.</p><div class="out" aria-live="polite"></div>
    <label class="in"><span aria-hidden="true">angel@os <i class="cwd">~</i> %</span><input aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"></label></div>`;
  const out = body.querySelector('.out'), inp = body.querySelector('input'), term = body.querySelector('.term'), cwdEl = body.querySelector('.cwd');
  const print = (s) => { const d = document.createElement('p'); d.className = 'o'; d.innerHTML = s; out.appendChild(d); term.scrollTop = term.scrollHeight; };
  let cwd = '~', hintN = 0;
  const hist = store.get('history') || [];
  let hi = hist.length;
  const setCwd = (c) => { cwd = c; cwdEl.textContent = c; };
  const FILES = { '~': ['work/', 'about.txt', 'contact.vcf'], '~/.board-b': ['note.txt', 'route.lock'], '~/work': ['topout/', 'atlas-pay/', 'pog/'] };
  const cmds = {
    help: () => print('<b>ls</b>            list files (ls -a shows everything)\n<b>cd</b> <i>dir</i>        change folder\n<b>cat</b> <i>file</i>      read a file\n<b>open</b> <i>name</i>     topout | atlas | pog | about | contact\n<b>whoami</b>        who made this\n<b>email</b>         write to Angel\n<b>site</b>          switch to the normal website\n<b>history</b>, <b>date</b>, <b>clear</b>, <b>exit</b>\n\n<span class="dim">Not every command is on this list.</span>'),
    ls: (a) => {
      const all = a.includes('-a');
      const here = FILES[cwd] || [];
      const list = cwd === '~' && all ? ['.', '..', '.board-b/', ...here] : here;
      print(list.join('   ') || '(empty)');
    },
    cd: (a) => {
      const t = (a || '~').replace(/\/$/, '');
      if (t === '~' || t === '..' || t === '/') return setCwd('~');
      const full = t.startsWith('~') ? t : (cwd === '~' ? '~/' : cwd + '/') + t;
      if (FILES[full]) return setCwd(full);
      if (['topout', 'atlas-pay', 'atlas', 'pog'].includes(t.replace('work/', ''))) { ctx.open(t.includes('pog') ? 'pog' : t.includes('atlas') ? 'atlas' : 'topout'); return print('opened it in a window'); }
      print(`cd: no such folder: ${esc(t)}`);
    },
    cat: (a) => {
      const f = (a || '').replace(/^\.\/|^\.board-b\//, '');
      if (cwd === '~/.board-b' || a.startsWith('.board-b/')) {
        if (f === 'note.txt') return print(esc(NOTE));
        if (f === 'route.lock') return print(TOPPED() ? 'unlocked. you topped out.' : 'binary file. it wants a code: unlock <1>-<2>-<3>');
      }
      if (f === 'about.txt') return print(`${esc(PERSON.name)}\n${esc(PERSON.role)}. ${esc(PERSON.base)}.\n\n${esc(LEDE)}`);
      if (f === 'contact.vcf') return print(`BEGIN:VCARD\nFN:${esc(PERSON.name)}\nEMAIL:${esc(PERSON.email)}\nURL:${esc(PERSON.behance)}\nEND:VCARD`);
      print(`cat: ${esc(a || '')}: no such file`);
    },
    open: (a) => { const ok = ['topout', 'atlas', 'pog', 'about', 'contact', 'work'].includes(a); ok ? ctx.open(a) : print(`nothing called "${esc(a || '')}". Try: topout, atlas, pog, about, contact`); },
    whoami: () => print(`${esc(PERSON.name)}. ${esc(PERSON.role)}. ${esc(PERSON.base)}.`),
    email: () => { print(esc(PERSON.email)); ctx.open('mail'); },
    contact: () => cmds.email(),
    site: () => { print('switching…'); goNormal(); },
    date: () => print(esc(new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date()))),
    clear: () => { out.innerHTML = ''; },
    history: () => print(hist.slice(-20).map((h, i) => `${String(i + 1).padStart(3)}  ${esc(h)}`).join('\n') || '(nothing yet)'),
    exit: () => ctx.close ? ctx.close() : print('bye'),
    pwd: () => print(cwd.replace('~', '/home/angel')),
    echo: (a, rest) => print(esc([a, rest].filter(Boolean).join(' '))),
    hint: () => {
      if (TOPPED()) return print('you already topped out.');
      if (cwd !== '~/.board-b' && hintN === 0) return print('try <b>ls -a</b>');
      print(`hint ${hintN + 1}/3: ${esc(HINTS[Math.min(hintN, 2)])}`); hintN++;
    },
    unlock: (a, rest) => {
      const raw = [a, rest].filter(Boolean).join(' ').replace(',', '.');
      const parts = raw.split(/[-\s]+/).filter(Boolean).map((x) => x.replace(/[°º]/g, ''));
      if (parts.length < 3) return print('the lock wants three parts: unlock 1-2-3');
      const ok = [parts[0] === '21', ['7.5', '7.50'].includes(parts[1]), parts[2] === '9'];
      const right = ok.filter(Boolean).length;
      if (right < 3) return print(`<span class="dim">click.</span> ${right} of 3 right. Keep looking.`);
      print(`\n${HOLD(true)}\n\n<b>You topped out.</b> Not many people find this.\nA file just appeared on your desktop.`);
      store.set('topped', true);
      document.dispatchEvent(new CustomEvent('aos:topped'));
    },
    sudo: (a, rest) => { if ((a + ' ' + rest).includes('hire')) { print('Permission granted.'); ctx.open('mail', { subject: 'Project enquiry' }); } else print('nice try'); },
    hire: () => print('did you mean <b>sudo hire angel</b>?'),
    rm: () => print('Nice try. Everything here is load-bearing.'),
    vim: () => print('You are now stuck in vim. Forever. (type :q)'),
    ':q': () => print('See? Easy.'),
    ping: () => print('pong'),
    coffee: () => print('   ( (\n    ) )\n  ........\n  |      |]\n  \\      /\n   `----\'   brewing… the work will wait.'),
    climb: () => print(HOLD(true) + '\n\n21 holds. One lit.'),
    hello: () => print('hi :)'),
    hi: () => print('hello :)')
  };
  const NAMES = Object.keys(cmds).filter((c) => !c.startsWith(':'));
  const run = (raw) => {
    print(`<span class="pr">angel@os ${esc(cwd)} %</span> ${esc(raw)}`);
    if (!raw) return;
    hist.push(raw); store.set('history', hist.slice(-50)); hi = hist.length;
    const [c, a = '', ...rest] = raw.trim().split(/\s+/);
    const fn = cmds[c.toLowerCase()];
    fn ? fn(a.toLowerCase(), rest.join(' ').toLowerCase()) : print(`command not found: ${esc(c)}. Try <b>help</b>.`);
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const raw = inp.value.trim(); inp.value = ''; run(raw); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) inp.value = hist[--hi] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const v = inp.value;
      if (!v.includes(' ')) { const m = NAMES.filter((n) => n.startsWith(v)); if (m.length === 1) inp.value = m[0] + ' '; else if (m.length) print(m.join('   ')); }
    }
  });
  term.addEventListener('click', () => { if (!getSelection().toString()) inp.focus(); });
  ctx.focusTarget = inp;
}

function trash(body) {
  body.innerHTML = `<div class="empty"><h2>Nothing to see here.</h2><p>Rejected marks end up in this folder. Some of them become whole brands later, like Topout did.</p></div>`;
}

function topped(body, _o, ctx) {
  body.innerHTML = `<article class="doc doc--note">
    <pre class="doc__hold" aria-hidden="true">${HOLD(true)}</pre>
    <h2>You topped out.</h2>
    <p>You found the hidden route on Board B: 21 holds, a 7.5° ray grid and 9 faces. That means you actually looked at the work, which is exactly the kind of person I like working with.</p>
    <p>Say hi with the subject “Topped out” and I’ll know you got here.</p>
    <div class="os-row"><a class="os-btn os-btn--hot" href="mailto:${PERSON.email}?subject=${encodeURIComponent('Topped out')}">Say hi</a></div>
  </article>`;
}

function info(body, { file, p } = {}, ctx) {
  const proj = p || (file && file.p);
  const rows = file
    ? [['Kind', file.type === 'video' ? 'Video loop' : 'Image'], ['Project', proj.name], ['Size', `${file.w} × ${file.h}`], ['Position', `${file.n} of ${proj.files.length} in the Behance presentation`]]
    : [['Kind', 'Folder'], ['Sector', proj.sector], ['Items', String(proj.files.length)], ['Case study', proj.url]];
  ctx.setTitle(`${file ? file.name : proj.name} info`);
  body.innerHTML = `<div class="info"><div class="info__head">${file ? `<img src="${file.thumb}" alt="">` : glyph('folder', { p: proj })}<h2>${esc(file ? file.cap : proj.name)}</h2></div>
    <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`;
}

function welcome(body, _o, ctx) {
  body.innerHTML = `<div class="hello">
    <h1 class="hello__title">Hi, I’m Angel.</h1>
    <p class="hello__lede">${esc(LEDE)}</p>
    <ul class="hello__work" role="list">${PROJECTS.map((p) => `<li><button type="button" data-open="${p.id}" style="--accent:${p.color}">${glyph('folder', { p })}<span class="hello__name">${esc(p.name)}</span><span class="hello__sector">${esc(p.sector)}</span></button></li>`).join('')}</ul>
    <div class="os-row">
      <a class="os-btn os-btn--hot" href="mailto:${PERSON.email}">Write an email</a>
      <button class="os-btn" type="button" data-a="copy">Copy email</button>
    </div>
    ${ctx.mode === 'desk' ? '<p class="hello__hint">Double-click to open things. Drag anything around. Right-click for more.</p>' : ''}
  </div>`;
  body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => ctx.open(b.dataset.open, {}, b)));
  body.querySelector('[data-a=copy]').addEventListener('click', () => copyEmail(ctx));
}

// ---------------------------------------------------------------- registry
// size = desktop window size; route = the #hash that opens it
export const APPS = {
  welcome: { title: 'Welcome', size: [560, 540], route: '', build: welcome },
  work: { title: 'Work', size: [880, 600], route: 'work', build: (b, o, c) => folder(b, { name: 'Work' }, c) },
  topout: { title: 'Work / Topout', size: [880, 620], route: 'topout', build: (b, o, c) => folder(b, { name: 'Topout' }, c) },
  atlas: { title: 'Work / Atlas Pay', size: [880, 620], route: 'atlas', build: (b, o, c) => folder(b, { name: 'Atlas Pay' }, c) },
  pog: { title: 'Work / POG', size: [880, 620], route: 'pog', build: (b, o, c) => folder(b, { name: 'POG' }, c) },
  viewer: { title: '', size: [960, 660], build: viewer, dark: true },
  about: { title: 'about.txt', size: [520, 540], route: 'about', build: about },
  contact: { title: 'contact.vcf', size: [460, 380], route: 'contact', build: contact },
  mail: { title: 'New message', size: [560, 440], build: mail },
  term: { title: 'Terminal', size: [660, 420], route: 'terminal', build: terminal, dark: true },
  trash: { title: 'Old logos', size: [440, 300], build: trash },
  topped: { title: 'topped-out.txt', size: [480, 520], build: topped },
  info: { title: 'Info', size: [380, 360], build: info }
};
// folder windows share one slot on the desktop, so opening Atlas Pay reuses an open Topout window
export const SLOT = { work: 'folder', topout: 'folder', atlas: 'folder', pog: 'folder' };
export const ROUTES = Object.fromEntries(Object.entries(APPS).filter(([, a]) => a.route).map(([id, a]) => [a.route, id]));
