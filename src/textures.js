import * as THREE from 'three';
import { mulberry32 } from './geom.js';

// 건물 겉모습 종류. config.json의 buildings.<id>.style 로 고를 수 있어요.
export const STYLES = {
  cream: { wall: '#d9ccb0', band: '#c4b493', glass: '#41596a', frame: '#efebe2', sill: '#bfb194' },
  brick: { wall: '#9a5a44', band: '#d8d0c0', glass: '#3a5363', frame: '#efebe2', sill: '#cfc6b4', brick: true },
  white: { wall: '#e5e3dc', band: '#cfcdc5', glass: '#2f5b79', frame: '#8e989f', sill: '#d2d0c9' },
  gray: { wall: '#b3b0a8', band: '#9d9a92', glass: '#3a4d59', frame: '#e1ddd3', sill: '#a29e95' },
  glass: { wall: '#6f8696', band: '#c9ccc9', glass: '#355368', frame: '#c9ccc9', sill: '#c9ccc9', curtain: true },
  // 한빛고 사진에서 뽑은 색: 본관·인재원 Ⅰ(연분홍 갈색 타일 + 흰 띠), 와우관(흰 벽 + 파란 띠), 인재원 Ⅱ(회색 석재), 세심정(나무)
  salmon: { wall: '#cf9c8c', band: '#f1e7de', glass: '#4b6273', frame: '#f4eee6', sill: '#e9ddd1', tile: true },
  whiteblue: { wall: '#eef0f2', band: '#2f5ea8', glass: '#3a5b7a', frame: '#d6dbe0', sill: '#cdd3d9' },
  stone: { wall: '#7f858c', band: '#9aa0a6', glass: '#2e3b45', frame: '#c9ccd0', sill: '#8d939a', tile: true },
  wood: { wall: '#8a5a3b', band: '#6b432b', glass: '#3b2a1f', frame: '#c79a6b', sill: '#6b432b' },
};

let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

function finish(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noise(ctx, w, h, count, colors, rmin, rmax, rand) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const r = rmin + rand() * (rmax - rmin);
    ctx.fillRect(rand() * w, rand() * h, r, r);
  }
}

const facadeCache = new Map();
// 창문 한 칸(가로 한 칸 × 한 층) 무늬. 아래쪽이 그 층의 바닥이에요.
export function facadeTexture(styleName) {
  if (facadeCache.has(styleName)) return facadeCache.get(styleName);
  const st = STYLES[styleName] || STYLES.cream;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rand = mulberry32(styleName.length * 97 + 13);
  g.fillStyle = st.wall;
  g.fillRect(0, 0, S, S);
  if (st.brick) {
    g.strokeStyle = 'rgba(235,225,210,0.35)';
    g.lineWidth = 1.5;
    for (let y = 0, row = 0; y < S; y += 9, row++) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
      for (let x = (row % 2) * 14; x < S; x += 28) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 9); g.stroke(); }
    }
  }
  if (st.tile) {
    // 타일 줄눈
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    for (let y = 0; y < S; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    for (let x = 0; x < S; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  }
  noise(g, S, S, 900, ['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.05)'], 1, 3, rand);

  // 층 사이 띠(슬래브)
  g.fillStyle = st.band;
  g.fillRect(0, 0, S, 22);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 22, S, 3);

  if (st.curtain) {
    const grad = g.createLinearGradient(0, 25, 0, S);
    grad.addColorStop(0, '#7f9fb4'); grad.addColorStop(0.5, st.glass); grad.addColorStop(1, '#22394a');
    g.fillStyle = grad; g.fillRect(0, 25, S, S - 25);
    g.fillStyle = st.frame;
    for (const x of [0, S / 2]) g.fillRect(x, 25, 6, S);
    g.fillRect(0, 150, S, 5);
  } else {
    const x0 = 34, x1 = S - 34, y0 = 58, y1 = 202;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 10);
    g.fillStyle = st.frame;
    g.fillRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
    const grad = g.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, '#9fb8c8'); grad.addColorStop(0.35, st.glass); grad.addColorStop(1, '#1f3240');
    g.fillStyle = grad;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // 하늘 반사
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.moveTo(x0, y0 + 30); g.lineTo(x0 + 60, y0); g.lineTo(x0 + 90, y0); g.lineTo(x0, y0 + 60); g.fill();
    g.fillStyle = st.frame;
    g.fillRect(S / 2 - 3, y0, 6, y1 - y0);
    g.fillRect(x0, y0 + 46, x1 - x0, 5);
    g.fillStyle = st.sill;
    g.fillRect(x0 - 10, y1 + 6, x1 - x0 + 20, 8);
  }
  const t = finish(c);
  facadeCache.set(styleName, t);
  return t;
}

// 밤에 켜지는 창문 빛. 8칸×6층마다 반복되고, 창문마다 켜짐·밝기·색이 달라요.
const glowCache = new Map();
export function facadeGlowTexture(styleName) {
  if (glowCache.has(styleName)) return glowCache.get(styleName);
  const st = STYLES[styleName] || STYLES.cream;
  const C = 64, NX = 8, NY = 6;
  const c = document.createElement('canvas');
  c.width = C * NX; c.height = C * NY;
  const g = c.getContext('2d');
  const rand = mulberry32(styleName.length * 31 + 7);
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const warm = ['#ffd9a0', '#ffe8c2', '#fff4dc', '#cfe3ff'];
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      if (rand() < 0.42) continue;
      g.globalAlpha = 0.45 + rand() * 0.55;
      g.fillStyle = warm[Math.floor(rand() * warm.length)];
      const x = i * C, y = j * C;
      if (st.curtain) g.fillRect(x + 2, y + 7, C - 4, C - 7);
      else g.fillRect(x + 9, y + 15, C - 18, 36);
    }
  }
  g.globalAlpha = 1;
  const t = finish(c);
  t.repeat.set(1 / NX, 1 / NY);
  glowCache.set(styleName, t);
  return t;
}

let concrete = null;
export function concreteTexture() {
  if (concrete) return concrete;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rand = mulberry32(5);
  g.fillStyle = '#9d9993'; g.fillRect(0, 0, S, S);
  noise(g, S, S, 2600, ['#8d8983', '#aaa69f', '#85817b', '#b4b0a9'], 1, 4, rand);
  g.strokeStyle = 'rgba(60,55,50,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    let x = rand() * S, y = rand() * S; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 40; y += (rand() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  concrete = finish(c);
  return concrete;
}

const roofCache = new Map();
// 학교 옥상에 흔한 초록 방수 도장
export function roofTexture(color) {
  if (roofCache.has(color)) return roofCache.get(color);
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rand = mulberry32(11);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  noise(g, S, S, 1400, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)'], 2, 6, rand);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
  for (let x = 0; x <= S; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  for (let y = 0; y <= S; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  const t = finish(c);
  roofCache.set(color, t);
  return t;
}

let soil = null;
export function soilTexture() {
  if (soil) return soil;
  const W = 128, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rand = mulberry32(3);
  const layers = [['#5b4532', 40], ['#6e5238', 110], ['#7d6146', 160], ['#8a7058', 202]];
  let y = 0;
  for (const [col, h] of layers) { g.fillStyle = col; g.fillRect(0, y, W, h); y += h; }
  noise(g, W, H, 1800, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.07)', '#9b8a74'], 1, 4, rand);
  const t = finish(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  soil = t;
  return t;
}
