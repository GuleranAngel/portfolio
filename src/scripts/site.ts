// Mobile menu
const btn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
const label = document.querySelector<HTMLElement>('[data-menu-label]');
if (btn && menu) {
  const set = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (label) label.textContent = open ? 'Close' : 'Menu';
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('[data-menu-link]').forEach((a) => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
  });
  matchMedia('(min-width: 768px)').addEventListener('change', (e) => e.matches && set(false));
}

// Looping videos: load and play only while on screen, pause off screen.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video.loop-video'));

const pickSrc = (v: HTMLVideoElement) => {
  const px = v.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2);
  return conn?.saveData || px <= 1100 ? v.dataset.srcSd! : v.dataset.srcHd!;
};
const ensureSrc = (v: HTMLVideoElement) => {
  if (v.getAttribute('src')) return;
  const start = Number(v.dataset.start || 0);
  if (start) v.addEventListener('loadedmetadata', () => { if (v.currentTime < 0.05) v.currentTime = Math.min(start, v.duration - 0.05); }, { once: true });
  v.src = pickSrc(v);
};
const toggleFor = (v: HTMLVideoElement) => v.parentElement?.querySelector<HTMLButtonElement>('[data-vid-toggle]') ?? null;
const showPaused = (v: HTMLVideoElement, paused: boolean) => {
  const t = toggleFor(v);
  if (!t) return;
  t.dataset.paused = paused ? '1' : '0';
  t.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
};
const syncToggle = (v: HTMLVideoElement) =>
  showPaused(v, v.dataset.userPaused === '1' || (reduce.matches && v.dataset.userPlay !== '1'));
// If the browser refuses to autoplay (iPhone Low Power Mode, data saver), show the play button instead of a dead pause button
const play = (v: HTMLVideoElement) => v.play().then(() => showPaused(v, false)).catch((e: DOMException) => { if (e?.name !== 'AbortError') showPaused(v, true); });
const tryPlay = (v: HTMLVideoElement) => {
  if (v.dataset.userPaused === '1') return;
  if (reduce.matches && v.dataset.userPlay !== '1') return;
  ensureSrc(v);
  play(v);
};

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const v = e.target as HTMLVideoElement;
    v.dataset.visible = e.isIntersecting ? '1' : '0';
    if (e.isIntersecting) tryPlay(v); else if (!v.paused) v.pause();
  }
}, { rootMargin: '250px 0px' });

for (const v of videos) {
  // iOS needs the muted property set, not just the attribute, before it allows inline autoplay
  v.muted = true;
  v.defaultMuted = true;
  // No src is set until the video is near the screen, so autoplay only kicks in then. With reduced motion it stays off.
  if (reduce.matches) v.autoplay = false;
  syncToggle(v);
  io.observe(v);
  toggleFor(v)?.addEventListener('click', () => {
    const paused = v.paused || v.dataset.userPaused === '1';
    if (paused) {
      v.dataset.userPaused = '0';
      v.dataset.userPlay = '1';
      ensureSrc(v);
      syncToggle(v);
      play(v);
    } else {
      v.dataset.userPaused = '1';
      v.pause();
      syncToggle(v);
    }
  });
}
reduce.addEventListener('change', () => videos.forEach((v) => {
  v.autoplay = !reduce.matches;
  syncToggle(v);
  if (reduce.matches && v.dataset.userPlay !== '1') v.pause(); else if (v.dataset.visible === '1') tryPlay(v);
}));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) videos.forEach((v) => v.pause());
  else videos.forEach((v) => v.dataset.visible === '1' && tryPlay(v));
});
