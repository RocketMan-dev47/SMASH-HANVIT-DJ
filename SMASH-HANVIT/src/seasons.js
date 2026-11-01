import * as THREE from 'three';

export const SEASON_NAME = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
export const SEASON_TEXT = {
  spring: '벚꽃이 피고 꽃잎이 날려요',
  summer: '초록이 가장 짙은 계절이에요',
  autumn: '산이 단풍으로 물들고 낙엽이 떨어져요',
  winter: '나무가 앙상해지고 눈이 내려요',
};

export function seasonOf(date) {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const FALL = {
  spring: { n: 900, colors: ['#ffd6e5', '#f9c0d6', '#ffe9f1', '#f4a9c6'], size: 0.55, speed: [0.8, 1.6], sway: 1.4 },
  autumn: { n: 700, colors: ['#e0601e', '#f2a43a', '#c6371f', '#e8c13a', '#a8541c'], size: 0.75, speed: [1.2, 2.2], sway: 1.1 },
  winter: { n: 2600, colors: ['#ffffff', '#f2f6fb'], size: 0.9, speed: [2, 4.5], sway: 0.3 },
};

// 계절: 나무 색·땅 색·지붕 눈을 바꾸고, 꽃잎·낙엽·눈을 카메라 주변에 흩날려요.
export class Seasons {
  constructor(world) {
    this.w = world;
    this.season = null;
    this.t = 0;
    this.points = null;
    this.tex = dotTexture();
  }

  apply(season, { quiet = false, noFall = false } = {}) {
    const w = this.w;
    const changed = season !== this.season;
    this.season = season;
    w.trees.setSeason(season);
    w.painter.setSeason(season);
    w.buildings.setSnow(season === 'winter' || !!w.xmasOn);
    this.setFall(noFall ? null : FALL[season]);
    if (changed && !quiet) w.ui.toast(`${SEASON_NAME[season]}`, SEASON_TEXT[season]);
  }

  setFall(spec) {
    if (this.points) { this.w.scene.remove(this.points); this.points.geometry.dispose(); this.points = null; }
    this.spec = spec;
    if (!spec) return;
    const N = spec.n;
    this.pos = new Float32Array(N * 3);
    this.spd = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * 460;
      this.pos[i * 3 + 1] = Math.random() * 160;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * 460;
      this.spd[i] = spec.speed[0] + Math.random() * (spec.speed[1] - spec.speed[0]);
      c.set(spec.colors[i % spec.colors.length]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: spec.size, map: this.tex, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95,
    }));
    this.points.frustumCulled = false;
    this.w.scene.add(this.points);
  }

  update(dt, center) {
    if (!this.points) return;
    this.t += dt;
    const p = this.pos, s = this.spec;
    for (let i = 0; i < this.spd.length; i++) {
      p[i * 3 + 1] -= this.spd[i] * dt;
      p[i * 3] += Math.sin(this.t * 0.9 + i * 1.7) * s.sway * dt;
      p[i * 3 + 2] += Math.cos(this.t * 0.7 + i * 0.9) * s.sway * 0.6 * dt;
      if (p[i * 3 + 1] < 0) p[i * 3 + 1] += 160;
    }
    this.points.position.set(center.x, center.y - 15, center.z);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
