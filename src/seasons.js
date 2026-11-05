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
  spring: { n: 2600, colors: ['#ffd6e5', '#f9c0d6', '#ffe9f1', '#f4a9c6', '#ffffff'], size: 0.42, speed: [0.6, 1.4], sway: 1.6, petal: 1 },
  autumn: { n: 1900, colors: ['#e0601e', '#f2a43a', '#c6371f', '#e8c13a', '#a8541c'], size: 0.55, speed: [1.0, 2.0], sway: 1.3, petal: 1 },
  winter: { n: 5200, colors: ['#ffffff', '#f2f6fb', '#e8f0fa'], size: 0.42, speed: [1.6, 3.6], sway: 0.35, petal: 0 },
  confetti: { n: 1100, colors: ['#ffd700', '#ff5d5d', '#ffffff', '#ffb347'], size: 0.45, speed: [1.0, 2.0], sway: 1.6, petal: 1 },
  saekdong: { n: 1000, colors: ['#d63a4a', '#f3b33d', '#2f6fe0', '#3fa34d', '#ffffff', '#ff8fb1'], size: 0.5, speed: [0.8, 1.6], sway: 1.5, petal: 1 },
  hearts: { n: 800, colors: ['#ff5d8f', '#ff8fb1', '#e8456f', '#ffd1e0'], size: 0.65, speed: [0.6, 1.2], sway: 1.8, petal: 1 },
  candy: { n: 800, colors: ['#ffffff', '#bfe3ff', '#ffd1e0', '#fff3b0'], size: 0.5, speed: [0.8, 1.4], sway: 1.2, petal: 0 },
  leafgreen: { n: 900, colors: ['#4caf50', '#7cc36b', '#2f7a3a', '#a5d68f'], size: 0.6, speed: [0.7, 1.4], sway: 1.6, petal: 1 },
  beans: { n: 600, colors: ['#8b2a2a', '#a33a3a', '#6e1f1f'], size: 0.25, speed: [1.4, 2.4], sway: 0.6, petal: 0 },
  cotton: { n: 900, colors: ['#ffffff', '#ffe3ec', '#fff4dc', '#fbe8ff'], size: 1.15, speed: [0.25, 0.55], sway: 2.2, petal: 0 },
  halloween: { n: 1200, colors: ['#ff7a00', '#8a3ffc', '#ffb347', '#3b1d6e'], size: 0.6, speed: [0.8, 1.6], sway: 1.4, petal: 1 },
  clover: { n: 1400, colors: ['#5cc96b', '#8ee07a', '#2f9e44', '#ffd479'], size: 0.6, speed: [0.7, 1.4], sway: 1.5, petal: 1 },
  rain: { n: 4200, colors: ['#b8cfe6', '#d6e4f2', '#9fbad6'], size: 0.55, speed: [24, 30], sway: 0, petal: 2 },
};

// 카메라 바로 앞(12~45 m)에서는 흐려져서 시야를 가리지 않아요. 꽃잎·잎은 납작하게 돌면서 떨어져요.
const VERT = `
attribute vec3 aColor; attribute float aSize; attribute float aSpin;
uniform float uScale; uniform float uTime;
varying vec3 vColor; varying float vAlpha; varying float vSpin;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = -mv.z;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(1.0, d);
  vAlpha = smoothstep(10.0, 40.0, d) * (1.0 - smoothstep(380.0, 520.0, d));
  vColor = aColor;
  vSpin = aSpin + uTime * (0.8 + fract(aSpin) * 1.6);
}`;
const FRAG = `
uniform float uPetal;
varying vec3 vColor; varying float vAlpha; varying float vSpin;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  if (uPetal > 1.5) {
    p.x *= 7.0; // 빗줄기: 가늘고 길게
  } else {
    float c = cos(vSpin), s = sin(vSpin);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    p.y *= mix(1.0, 1.9 + 0.8 * sin(vSpin * 1.7), uPetal);
  }
  float a = 1.0 - smoothstep(0.32, 0.5, length(p));
  a *= vAlpha;
  if (a < 0.02) discard;
  gl_FragColor = vec4(vColor, a);
}`;

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
    // 땅에 쌓이는 꽃잎·낙엽은 활엽수 아래에 그려요.
    const spots = (w.trees.items?.broad || []).map((t) => [t.x, t.z, t.s]);
    w.painter.setSeason(season, spots);
    w.buildings.setSnow(season === 'winter' || !!w.xmasOn);
    this.noFall = noFall;
    this.setFall(noFall ? null : FALL[this.weatherFall() || season]);
    if (changed && !quiet) w.ui.toast(`${SEASON_NAME[season]}`, SEASON_TEXT[season]);
  }

  // 실시간 날씨: 비가 오면 비, 눈이 오면 눈(계절보다 먼저)
  weatherFall() {
    if (this.weather === 'rain' || this.weather === 'storm') return 'rain';
    if (this.weather === 'snow') return 'winter';
    return null;
  }

  setWeather(kind) {
    this.weather = kind;
    if (this.season && !this.noFall) this.setFall(FALL[this.weatherFall() || this.season]);
  }

  // 특별 에디션 파티클(수능: 네잎클로버 잎이 흩날려요)
  special(kind) {
    this.specialKind = kind;
    if (kind && FALL[kind]) this.setFall(FALL[kind]);
    else if (this.season) this.setFall(this.noFall ? null : FALL[this.weatherFall() || this.season]);
  }

  // 화질 단계에 맞춰 떨어지는 입자 수를 줄여요(0~1).
  setDensity(k) {
    this.density = k;
    if (this.points) this.points.geometry.setDrawRange(0, Math.floor((this.spec?.n || 0) * k));
  }

  setScale(px) {
    this.scale = px;
    if (this.mat) this.mat.uniforms.uScale.value = px;
  }

  setFall(spec) {
    if (this.points) { this.w.scene.remove(this.points); this.points.geometry.dispose(); this.points = null; }
    this.spec = spec;
    if (!spec) return;
    const N = spec.n;
    this.pos = new Float32Array(N * 3);
    this.spd = new Float32Array(N);
    const col = new Float32Array(N * 3), size = new Float32Array(N), spin = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * 520;
      this.pos[i * 3 + 1] = Math.random() * 110;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * 520;
      this.spd[i] = spec.speed[0] + Math.random() * (spec.speed[1] - spec.speed[0]);
      c.set(spec.colors[i % spec.colors.length]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = spec.size * (0.7 + Math.random() * 0.7);
      spin[i] = Math.random() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { uScale: { value: this.scale || 600 }, uTime: { value: 0 }, uPetal: { value: spec.petal } },
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    if (this.density !== undefined) geo.setDrawRange(0, Math.floor(N * this.density));
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
      if (p[i * 3 + 1] < 0) p[i * 3 + 1] += 110;
    }
    this.mat.uniforms.uTime.value = this.t;
    this.points.position.set(center.x, center.y - 10, center.z);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
