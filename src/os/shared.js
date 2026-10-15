// Bits both shells use: the toast, the clock, the wallpaper and the hash routes.
import { ROUTES, DATA } from './content.js';

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

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
export function clock(el, withDay) {
  const tick = () => {
    const d = new Date();
    el.textContent = withDay ? `${fmtDay.format(d)} ${fmtTime.format(d)}` : fmtTime.format(d);
    el.dateTime = d.toISOString();
  };
  tick();
  setInterval(tick, 15000);
}

export const WALLS = DATA.walls;
export function setWall(el, name) {
  const w = WALLS[name];
  el.style.backgroundImage = `url(${w.poster})`;
  el.innerHTML = RM ? '' : `<video class="wall__video" src="${w.video}" poster="${w.poster}" autoplay muted loop playsinline disablepictureinpicture aria-hidden="true" tabindex="-1"></video>`;
  try { localStorage.setItem('aos-wall', name); } catch (e) {}
}
export function savedWall() {
  try { const w = localStorage.getItem('aos-wall'); if (w && WALLS[w]) return w; } catch (e) {}
  return 'Dot field';
}

// #topout, #atlas, #about… open that app on load and when the hash changes
export const routeApp = () => ROUTES[location.hash.slice(1)] || null;
export function setRoute(route) {
  const next = route ? '#' + route : location.pathname + location.search;
  if ((location.hash || '') === (route ? '#' + route : '')) return;
  history.replaceState(history.state, '', next);
}
