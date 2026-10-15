// Bits both shells use: the toast, the clock, the wallpapers (including the live dot field) and the hash routes.
import { ROUTES, DATA, store } from './content.js';
import { dotField } from './dots.js';

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

export { onLongPress } from './press.js';
