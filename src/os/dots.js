// The Topout dot field, drawn live: a fine grid of small grey dots with orange patches drifting through it,
// in the style of the "fine" Topout hero loop. It never loops (so it never jumps back to the start),
// stays sharp at any size, and the dots under the pointer light up like the holds on Board B.
//
// It runs on the graphics card (WebGL), so the page stays free for dragging windows and icons.
// Browsers without WebGL get the same picture drawn with a 2D canvas, at a lower frame rate.

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

// one look, shared by both renderers
const LOOK = {
  bg: [0x11, 0x11, 0x0f],
  scale: 0.07, // noise step per dot
  hot: 0.34, // above this a dot is an orange hold
  halo: 0.1, // between halo and hot: grey dots that grow towards the patch
  mouseR: 110,
  edge: ['#a8341a', 0.3], mid: ['#e2441d', 0.36], full: ['#ff4b1f', 0.4], // colour, radius as a share of the gap
  faint: ['#2a2a27', 0.65] // colour, radius in px
};
const greyOf = (k) => { const f = k / 5; const c = Math.round(50 + f * 52); return [[c, c, c - 4], 0.7 + f * 1.1]; };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function dotField(host, opts = {}) {
  const gl = glField(host, opts);
  return gl || canvasField(host, opts);
}

// shared clock, pointer and lifecycle for both renderers
function driver(host, cv, draw, { fps = 30 } = {}) {
  let raf = 0, last = 0, t = Math.random() * 10, burst = 0, paused = false;
  const mouse = { x: -999, y: -999, a: 0 };
  const state = () => ({ t, burst, mouse });
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    // full frame rate while the pointer is lighting dots up, 30 fps when it is only drifting
    const busy = mouse.a > 0 || burst > 0;
    if (now - last < (busy ? 15 : 1000 / fps)) return;
    const dt = Math.min(100, now - last); last = now;
    t += dt * 0.00011;
    mouse.a = Math.max(0, mouse.a - dt * 0.0007);
    burst = Math.max(0, burst - dt * 0.00035);
    draw(state());
  };
  const onMove = (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.a = 1; };
  const run = () => { cancelAnimationFrame(raf); raf = 0; if (!document.hidden && !RM && !paused) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const ro = new ResizeObserver(() => draw(state(), true)); ro.observe(host);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  document.addEventListener('visibilitychange', run);
  run();
  return {
    burst() { burst = 1.2; if (RM || paused) draw(state()); },
    pause(on) { paused = on; run(); },
    redraw() { draw(state(), true); },
    stop() { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onMove); document.removeEventListener('visibilitychange', run); cv.remove(); }
  };
}

function makeCanvas(host) {
  const cv = document.createElement('canvas');
  cv.className = 'wall__canvas';
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  return cv;
}

// ---------------------------------------------------------------- WebGL
// Pass 1 works out every dot (colour and size) into a tiny texture, one texel per dot.
// Pass 2 draws the screen: each pixel finds its dot in that texture and paints an anti-aliased circle.
// Classic Perlin noise in GLSL by Stefan Gustavson (MIT licence, github.com/stegu/webgl-noise).
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0=floor(P),Pi1=Pi0+vec3(1.0);Pi0=mod289(Pi0);Pi1=mod289(Pi1);
  vec3 Pf0=fract(P),Pf1=Pf0-vec3(1.0);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x),iy=vec4(Pi0.yy,Pi1.yy),iz0=Pi0.zzzz,iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy),ixy0=permute(ixy+iz0),ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0*(1.0/7.0),gy0=fract(floor(gx0)*(1.0/7.0))-0.5;gx0=fract(gx0);
  vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0),sz0=step(gz0,vec4(0.0));
  gx0-=sz0*(step(0.0,gx0)-0.5);gy0-=sz0*(step(0.0,gy0)-0.5);
  vec4 gx1=ixy1*(1.0/7.0),gy1=fract(floor(gx1)*(1.0/7.0))-0.5;gx1=fract(gx1);
  vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1),sz1=step(gz1,vec4(0.0));
  gx1-=sz1*(step(0.0,gx1)-0.5);gy1-=sz1*(step(0.0,gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x),g100=vec3(gx0.y,gy0.y,gz0.y),g010=vec3(gx0.z,gy0.z,gz0.z),g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x),g101=vec3(gx1.y,gy1.y,gz1.y),g011=vec3(gx1.z,gy1.z,gz1.z),g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=norm0.x;g010*=norm0.y;g100*=norm0.z;g110*=norm0.w;
  vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=norm1.x;g011*=norm1.y;g101*=norm1.z;g111*=norm1.w;
  float n000=dot(g000,Pf0),n100=dot(g100,vec3(Pf1.x,Pf0.yz)),n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)),n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z)),n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z)),n011=dot(g011,vec3(Pf0.x,Pf1.yz)),n111=dot(g111,Pf1);
  vec3 f=fade(Pf0);
  vec4 nz=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),f.z);
  vec2 nyz=mix(nz.xy,nz.zw,f.y);
  return 2.2*mix(nyz.x,nyz.y,f.x);
}`;

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
const HEAD = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const v3 = (rgb) => `vec3(${rgb.map((c) => (c / 255).toFixed(4)).join(',')})`;

const CELLS = HEAD + NOISE + `
uniform vec2 uCells; uniform float uGap, uT, uBurst; uniform vec3 uMouse;
void main(){
  vec2 c = floor(gl_FragCoord.xy);
  vec2 ij = vec2(c.x, uCells.y - 1.0 - c.y);
  vec2 n = ij * ${LOOK.scale.toFixed(3)};
  float z = uT, K = 0.92;
  float v = cnoise(vec3(n.x + z * 0.5, n.y - z * 0.2, z * 0.3)) * 0.9 * K + cnoise(vec3(n * 2.2 + vec2(31.0, 0.0), z * 0.6)) * 0.22 * K;
  vec2 p = (ij + 0.5) * uGap;
  float d = distance(p, uMouse.xy);
  if (d < ${LOOK.mouseR.toFixed(1)}) v += (1.0 - d / ${LOOK.mouseR.toFixed(1)}) * 0.42 * uMouse.z;
  v += uBurst * (0.5 + 0.5 * sin((p.x + p.y) * 0.015 - z * 60.0)) * 0.6;
  vec3 col = vec3(0.0); float r = 0.0;
  if (v >= ${LOOK.hot.toFixed(3)}) {
    if (v < ${(LOOK.hot + 0.03).toFixed(3)}) { col = ${v3(hex(LOOK.edge[0]))}; r = ${LOOK.edge[1]} * uGap; }
    else if (v < ${(LOOK.hot + 0.07).toFixed(3)}) { col = ${v3(hex(LOOK.mid[0]))}; r = ${LOOK.mid[1]} * uGap; }
    else { col = ${v3(hex(LOOK.full[0]))}; r = ${LOOK.full[1]} * uGap; }
  } else if (v >= ${LOOK.halo.toFixed(3)}) {
    float k = min(5.0, floor((v - ${LOOK.halo.toFixed(3)}) / ${(LOOK.hot - LOOK.halo).toFixed(3)} * 6.0)), f = k / 5.0;
    float g = (50.0 + floor(f * 52.0 + 0.5)) / 255.0;
    col = vec3(g, g, g - 4.0 / 255.0); r = 0.7 + f * 1.1;
  } else if (v > -0.22 && cnoise(vec3(n * 0.35 + vec2(7.0, 0.0), z * 0.15)) * K > -0.05) {
    col = ${v3(hex(LOOK.faint[0]))}; r = ${LOOK.faint[1].toFixed(2)};
  }
  gl_FragColor = vec4(col, r / (uGap * 0.5));
}`;

const SCREEN = HEAD + `
uniform sampler2D uTex; uniform vec2 uCells, uRes; uniform float uGapPx;
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(px / uGapPx);
  vec4 c = texture2D(uTex, (vec2(cell.x, uCells.y - 1.0 - cell.y) + 0.5) / uCells);
  float r = c.a * uGapPx * 0.5;
  float a = r > 0.0 ? clamp(r - length(px - (cell + 0.5) * uGapPx) + 0.5, 0.0, 1.0) : 0.0;
  gl_FragColor = vec4(mix(${v3(LOOK.bg)}, c.rgb, a), 1.0);
}`;

function glField(host, { gap = 10, fps = 30 } = {}) {
  const cv = makeCanvas(host);
  const gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) { cv.remove(); return null; }
  let progCells, progScreen, tex, fb, buf, ok = false;
  const U = new Map();
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = (frag, names) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    U.set(p, Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)])));
    return p;
  };
  function init() {
    try {
      progCells = program(CELLS, ['uCells', 'uGap', 'uT', 'uBurst', 'uMouse']);
      progScreen = program(SCREEN, ['uTex', 'uCells', 'uRes', 'uGapPx']);
    } catch (e) { return false; }
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    tex = gl.createTexture(); fb = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    size.cols = 0;
    return true;
  }
  const size = { W: 0, H: 0, dpr: 1, cols: 0, rows: 0 };
  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = host.clientWidth, H = host.clientHeight;
    if (W === size.W && H === size.H && dpr === size.dpr && size.cols) return;
    Object.assign(size, { W, H, dpr });
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    size.cols = Math.ceil(W / gap) + 1; size.rows = Math.ceil(H / gap) + 1;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.cols, size.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function draw({ t, burst, mouse }) {
    if (!ok || gl.isContextLost()) return;
    fit();
    const { cols, rows, dpr } = size;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, cols, rows);
    gl.useProgram(progCells);
    const a = U.get(progCells);
    gl.uniform2f(a.uCells, cols, rows); gl.uniform1f(a.uGap, gap); gl.uniform1f(a.uT, t); gl.uniform1f(a.uBurst, burst);
    gl.uniform3f(a.uMouse, mouse.x, mouse.y, mouse.a);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(progScreen);
    const b = U.get(progScreen);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(b.uTex, 0); gl.uniform2f(b.uCells, cols, rows); gl.uniform2f(b.uRes, cv.width, cv.height); gl.uniform1f(b.uGapPx, gap * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  ok = init();
  if (!ok) { cv.remove(); return null; }
  const d = driver(host, cv, draw, { fps });
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ok = false; });
  cv.addEventListener('webglcontextrestored', () => { ok = init(); d.redraw(); });
  d.redraw();
  return d;
}

// ---------------------------------------------------------------- 2D canvas fallback
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

function canvasField(host, { gap = 10 } = {}) {
  const cv = makeCanvas(host);
  const g = cv.getContext('2d', { alpha: false });
  const noise = makeNoise();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let cols = 0, rows = 0;
  const rgb = (c) => `rgb(${c.join(',')})`;
  const sprite = (r, col) => { const s = Math.ceil(r * 2 * dpr) + 2; const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); x.fillStyle = col; x.beginPath(); x.arc(s / 2, s / 2, r * dpr, 0, Math.PI * 2); x.fill(); return c; };
  const grey = Array.from({ length: 6 }, (_, k) => { const [c, r] = greyOf(k); return sprite(r, rgb(c)); });
  const faint = sprite(LOOK.faint[1], LOOK.faint[0]);
  const edge = sprite(gap * LOOK.edge[1], LOOK.edge[0]), mid = sprite(gap * LOOK.mid[1], LOOK.mid[0]), hot = sprite(gap * LOOK.full[1], LOOK.full[0]);
  const T = LOOK.hot, G0 = LOOK.halo, R = LOOK.mouseR;
  function draw({ t, burst, mouse }, resized) {
    if (resized || !cols) {
      const W = host.clientWidth, H = host.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cols = Math.ceil(W / gap) + 1; rows = Math.ceil(H / gap) + 1;
    }
    g.fillStyle = rgb(LOOK.bg);
    g.fillRect(0, 0, cv.width, cv.height);
    const sc = LOOK.scale, z = t, mx = mouse.x, my = mouse.y, ma = mouse.a;
    for (let j = 0; j < rows; j++) {
      const y = j * gap + gap / 2, ny = j * sc;
      for (let i = 0; i < cols; i++) {
        const x = i * gap + gap / 2, nx = i * sc;
        let v = noise(nx + z * 0.5, ny - z * 0.2, z * 0.3) * 0.9 + noise(nx * 2.2 + 31, ny * 2.2, z * 0.6) * 0.22;
        if (ma > 0) { const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy; if (d2 < R * R) v += (1 - Math.sqrt(d2) / R) * 0.42 * ma; }
        if (burst > 0) v += burst * (0.5 + 0.5 * Math.sin((x + y) * 0.015 - t * 60)) * 0.6;
        let s;
        if (v >= T) s = v < T + 0.03 ? edge : v < T + 0.07 ? mid : hot;
        else if (v >= G0) s = grey[Math.min(5, ((v - G0) / (T - G0) * 6) | 0)];
        else if (v > -0.22 && noise(nx * 0.35 + 7, ny * 0.35, z * 0.15) > -0.05) s = faint;
        else continue;
        g.drawImage(s, (x * dpr - s.width / 2) | 0, (y * dpr - s.height / 2) | 0);
      }
    }
  }
  const d = driver(host, cv, draw, { fps: 20 });
  d.redraw();
  return d;
}
