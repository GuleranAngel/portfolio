// one long-press helper for touch and mouse: fires after 450ms without moving
export function onLongPress(el, fn, { ms = 450 } = {}) {
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
