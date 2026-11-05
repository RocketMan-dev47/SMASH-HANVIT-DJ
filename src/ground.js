import * as THREE from 'three';
import { paintParking } from './parking.js';
import { mulberry32, orientedBox } from './geom.js';

const AREA = {
  grass: '#759548', forest: '#45632f', scrub: '#6b8045', parking: '#8d8c87',
  sand: '#d4c193', water: '#5b7f93', track: '#b05a43',
};

// 땅 무늬를 캔버스 하나에 미터 단위로 그립니다. 그을음도 여기에 덧그려요.
export class GroundPainter {
  constructor(terrain, maxPx = 2048) {
    this.t = terrain;
    const ratio = terrain.w / terrain.d;
    this.W = ratio >= 1 ? maxPx : Math.round(maxPx * ratio);
    this.H = ratio >= 1 ? Math.round(maxPx / ratio) : maxPx;
    this.scale = this.W / terrain.w;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  meters() {
    const s = this.scale;
    this.g.setTransform(s, 0, 0, s, -this.t.x0 * s, -this.t.z0 * s);
  }

  path(poly) {
    const g = this.g;
    g.beginPath();
    poly.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
    g.closePath();
  }

  paint(campus, buildings) {
    const g = this.g;
    const rand = mulberry32(42);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#6a8a42';
    g.fillRect(0, 0, this.W, this.H);
    const cols = ['#5f7f3a', '#7a9a50', '#648441', '#82a157', '#587636'];
    for (let i = 0; i < this.W * this.H / 90; i++) {
      g.fillStyle = cols[Math.floor(rand() * cols.length)];
      const r = 1 + rand() * 3;
      g.globalAlpha = 0.35;
      g.fillRect(rand() * this.W, rand() * this.H, r, r);
    }
    g.globalAlpha = 1;
    this.meters();

    // 학교 부지는 살짝 다듬어진 잔디색
    if (campus.boundary) {
      this.path(campus.boundary);
      g.fillStyle = 'rgba(140,170,95,0.28)';
      g.fill();
    }

    const order = ['forest', 'scrub', 'grass', 'water', 'sand', 'parking', 'track', 'pitch'];
    const areas = [...(campus.areas || [])].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    for (const a of areas) this.paintArea(a);

    // 건물 둘레 포장(에이프런)
    g.lineJoin = 'round';
    g.strokeStyle = '#bdb6a8';
    g.fillStyle = '#bdb6a8';
    g.lineWidth = 7;
    for (const b of buildings) { this.path(b.poly); g.stroke(); g.fill(); }

    const roads = [...(campus.roads || [])].sort((a, b) => a.w - b.w);
    for (const r of roads) this.paintRoad(r, 'base');
    for (const r of roads) this.paintRoad(r, 'top');
    for (const r of roads) this.paintRoad(r, 'mark');

    g.setTransform(1, 0, 0, 1, 0, 0);
    this.base = g.getImageData(0, 0, this.W, this.H);
    this.texture.needsUpdate = true;
  }

  paintArea(a) {
    const g = this.g;
    this.path(a.poly);
    if (a.kind === 'pitch') {
      const turf = a.surface !== 'dirt' && a.surface !== 'sand' && a.surface !== 'ground';
      g.fillStyle = turf ? '#4f9a4c' : '#c6a77b';
      g.fill();
      g.save();
      g.clip();
      if (turf) {
        // 잔디 깎은 줄무늬
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const [x, z] of a.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        g.fillStyle = 'rgba(255,255,255,0.06)';
        for (let x = x0; x < x1; x += 10) g.fillRect(x, z0, 5, z1 - z0);
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 0.25;
      this.path(a.poly); g.stroke();
      if (turf) this.pitchLines(a.poly);
      return;
    }
    g.fillStyle = AREA[a.kind] || AREA.grass;
    g.fill();
    if (a.kind === 'parking') {
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 0.15;
      g.stroke();
      paintParking(g, a.poly); // 주차칸 선
    }
    if (a.kind === 'track') {
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 0.12;
      g.stroke();
    }
  }

  // 축구장 라인: 하프라인, 센터서클, 페널티 박스, 골 에어리어
  pitchLines(poly) {
    const g = this.g;
    const b = orientedBox(poly);
    if (b.L < 30 || b.W < 18) return;
    const L = b.L - 3, W = b.W - 3;
    g.save();
    g.translate(b.cx, b.cz);
    g.rotate(b.angle);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 0.18;
    g.strokeRect(-L / 2, -W / 2, L, W);
    g.beginPath(); g.moveTo(0, -W / 2); g.lineTo(0, W / 2); g.stroke();
    const cr = Math.min(9.15, W * 0.15);
    g.beginPath(); g.arc(0, 0, cr, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, 0.3, 0, Math.PI * 2); g.fill();
    const pd = Math.min(16.5, L * 0.16), pw = Math.min(40.3, W * 0.62);
    const gd = Math.min(5.5, L * 0.055), gw = Math.min(18.3, W * 0.3);
    for (const sgn of [-1, 1]) {
      const x = sgn * L / 2;
      g.strokeRect(sgn > 0 ? x - pd : x, -pw / 2, pd, pw);
      g.strokeRect(sgn > 0 ? x - gd : x, -gw / 2, gd, gw);
      g.beginPath(); g.arc(x - sgn * Math.min(11, pd * 0.67), 0, 0.25, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  paintRoad(r, pass) {
    const g = this.g;
    const foot = ['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'track'].includes(r.kind);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    r.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
    if (pass === 'base') {
      g.strokeStyle = foot ? '#a59d8e' : '#77756f';
      g.lineWidth = r.w + (foot ? 0.6 : 1.2);
      g.stroke();
    } else if (pass === 'top') {
      g.strokeStyle = foot ? '#c9c0ae' : '#55575a';
      g.lineWidth = r.w;
      g.stroke();
    } else if (!foot && r.w >= 6) {
      g.setLineDash([3, 3]);
      g.strokeStyle = 'rgba(236,201,82,0.85)';
      g.lineWidth = 0.22;
      g.stroke();
      g.setLineDash([]);
    }
  }

  scorch(x, z, r) {
    const g = this.g;
    this.meters();
    const grad = g.createRadialGradient(x, z, 0, x, z, r);
    grad.addColorStop(0, 'rgba(28,22,18,0.85)');
    grad.addColorStop(0.55, 'rgba(45,36,28,0.55)');
    grad.addColorStop(1, 'rgba(60,50,40,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.dirty = true;
  }

  // 산사태가 지나간 흙길
  mud(x, z, r) {
    const g = this.g;
    this.meters();
    g.fillStyle = 'rgba(101,78,55,0.35)';
    g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.dirty = true;
  }

  // 지진으로 갈라진 땅
  crack(x, z, R) {
    const g = this.g;
    this.meters();
    g.strokeStyle = 'rgba(35,28,22,0.75)';
    g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      let a = (k / 9) * Math.PI * 2 + Math.random() * 0.5;
      let px = x, pz = z;
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(px, pz);
      for (let d = 0; d < R; d += 3) {
        a += (Math.random() - 0.5) * 0.7;
        px += Math.cos(a) * 3; pz += Math.sin(a) * 3;
        g.lineWidth = Math.max(0.15, 0.9 * (1 - d / R));
        g.lineTo(px, pz);
      }
      g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.dirty = true;
  }

  // 큰 캔버스를 GPU로 올리는 건 무거워서 0.2초에 한 번만 합니다.
  flush(dt) {
    this.wait = (this.wait || 0) - dt;
    if (!this.dirty || this.wait > 0) return;
    this.dirty = false;
    this.wait = 0.2;
    this.texture.needsUpdate = true;
  }

  reset() {
    if (!this.base) return;
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.putImageData(this.base, 0, 0);
    if (this.tint) { this.g.fillStyle = this.tint; this.g.fillRect(0, 0, this.W, this.H); }
    if (this.season === 'spring' || this.season === 'autumn') this.paintFallen();
    if (this.snow) this.paintSnow();
    this.texture.needsUpdate = true;
  }

  // 계절 색: 봄(연두), 가을(누런 빛), 겨울은 눈
  setSeason(season, spots) {
    this.season = season;
    if (spots) this.spots = spots;
    this.tint = { spring: 'rgba(170,215,120,0.10)', autumn: 'rgba(176,128,52,0.20)', winter: 'rgba(150,140,120,0.15)' }[season] || null;
    this.snow = season === 'winter' || this.xmasSnow;
    this.reset();
  }

  // 눈 덮인 땅(크리스마스 에디션)
  setSnow(on) {
    this.xmasSnow = on;
    this.snow = on;
    this.reset();
  }

  // 나무 아래에 떨어져 쌓인 꽃잎(봄)·낙엽(가을)
  paintFallen() {
    if (!this.spots) return;
    const cols = this.season === 'spring'
      ? ['rgba(255,214,229,0.85)', 'rgba(249,192,214,0.8)', 'rgba(255,240,246,0.85)']
      : ['rgba(224,96,30,0.8)', 'rgba(242,164,58,0.8)', 'rgba(198,55,31,0.75)', 'rgba(232,193,58,0.8)'];
    this.meters();
    const g = this.g;
    let seed = 9;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [x, z, s] of this.spots) {
      const R = 3.2 * (s || 1);
      for (let k = 0; k < 46; k++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R;
        g.fillStyle = cols[k % cols.length];
        const w = 0.18 + rnd() * 0.22;
        g.fillRect(x + Math.cos(a) * r, z + Math.sin(a) * r, w, w * 0.7);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  paintSnow() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(244,247,250,0.62)';
    g.fillRect(0, 0, this.W, this.H);
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (this.W * this.H) / 120; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(200,210,222,0.35)';
      const r = 1 + rnd() * 4;
      g.fillRect(rnd() * this.W, rnd() * this.H, r, r);
    }
  }
}
