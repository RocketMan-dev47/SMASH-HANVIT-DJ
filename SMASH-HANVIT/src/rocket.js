import * as THREE from 'three';
import { sideFrom } from './camera.js';
import { hasaLogoTexture, hasaSignTexture } from './hasa.js';

// ---------- HFV-1 (HFV-1.step에서 뽑은 실제 치수, 단위 mm) ----------
// 몸체(카본 튜브) y 10~1510, 반지름 47 / 페이로드(흰 ABS) 1510~1710 / 노즈콘(흰 ABS) 1710~1993 / 강철 팁 1993~2060
// 핀 4장(강철): 뿌리 (r 47, y 10~310), 끝 (r 113.5, y -56.4~24.6), 두께 7 / 노즐 지름 약 44
const MM = 0.0078; // 게임에서는 약 7.8배로 키워 길이 16 m로 보여요
const NOSE = [[47, 1710], [45.3, 1743], [43.7, 1767], [40.9, 1815], [37.4, 1839], [33.5, 1862], [28, 1910], [22.5, 1934], [19, 1958], [16, 1981], [14.3, 1993]];
const TIP = [[14.3, 1993], [12.9, 1998], [10.3, 2013], [7.5, 2028], [4.6, 2038], [1.6, 2053], [0.01, 2060]];
const FIN = [[47, 10], [113.4, -56.4], [113.6, 24.6], [47, 310]];
const SPLIT = 1510; // 1단·2단이 나뉘는 커플러 위치
export const HFV = { length: 2060 * MM, split: SPLIT * MM, radius: 47 * MM };

const UP = new THREE.Vector3(0, 1, 0);
const CATCH_LIFT = 1.0;
const ARM_Y = 1.3 + CATCH_LIFT + 1300 * MM; // 붙잡는 높이(발사대 바닥 기준): 1단 위쪽

function carbonTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#16181b';
  g.fillRect(0, 0, 128, 128);
  // 2×2 트윌 무늬
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      const k = ((x / 8 + y / 8) >> 1) % 2;
      const grad = g.createLinearGradient(x, y, x + 8, y + 8);
      grad.addColorStop(0, k ? '#2a2e33' : '#101215');
      grad.addColorStop(1, k ? '#1a1d21' : '#23272b');
      g.fillStyle = grad;
      g.fillRect(x, y, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 40);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function payloadTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f6f3';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#20242a';
  g.font = '700 64px Pretendard, -apple-system, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const x of [128, 384]) {
    g.save();
    g.translate(x, 128);
    g.rotate(-Math.PI / 2);
    g.fillText('HFV-1', 0, 0);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const mats = () => ({
  carbon: new THREE.MeshStandardMaterial({ map: carbonTexture(), roughness: 0.32, metalness: 0.35 }),
  abs: new THREE.MeshStandardMaterial({ color: 0xf6f6f3, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
  label: new THREE.MeshStandardMaterial({ map: payloadTexture(), roughness: 0.55, metalness: 0 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.32, metalness: 0.85, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7, metalness: 0.3 }),
  logo: new THREE.MeshBasicMaterial({ map: hasaLogoTexture(), transparent: true }),
  pine: new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.3, metalness: 0.8 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd8282f, roughness: 0.35, metalness: 0.3 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2f6fe0, roughness: 0.35, metalness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 }),
  star: new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb300, emissiveIntensity: 1.4, roughness: 0.3 }),
});

const add = (parent, geo, mat, y = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = true;
  parent.add(m);
  return m;
};

// 1단: 카본 몸체 + 강철 핀 4장 + 노즐. 원점은 노즐 끝(바닥).
function boosterModel(M) {
  const s1 = new THREE.Group();
  const r = 47 * MM;
  add(s1, new THREE.CylinderGeometry(r, r, (SPLIT - 10) * MM, 40, 1, true), M.carbon, ((SPLIT + 10) / 2) * MM);
  add(s1, new THREE.CircleGeometry(r, 40).rotateX(Math.PI / 2), M.dark, 10 * MM);
  add(s1, new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), M.dark, SPLIT * MM);
  add(s1, new THREE.CylinderGeometry(18 * MM, 22 * MM, 9.4 * MM, 24), M.steel, 5.3 * MM);
  add(s1, new THREE.CircleGeometry(16 * MM, 24).rotateX(Math.PI / 2), M.dark, 0.7 * MM);
  const shape = new THREE.Shape(FIN.map(([fr, fy]) => new THREE.Vector2(fr * MM, fy * MM)));
  const finGeo = new THREE.ExtrudeGeometry(shape, { depth: 7 * MM, bevelEnabled: false });
  finGeo.translate(0, 0, -3.5 * MM);
  for (let i = 0; i < 4; i++) {
    const f = add(s1, finGeo, M.steel);
    f.rotation.y = (i * Math.PI) / 2;
  }
  return s1;
}

// 2단: 흰 페이로드 튜브(HFV-1 글자) + 오지브 노즈콘 + 강철 팁
function upperModel(M) {
  const s2 = new THREE.Group();
  const r = 47 * MM;
  add(s2, new THREE.CylinderGeometry(r, r, 200 * MM, 40, 1, true), M.label, 1610 * MM);
  add(s2, new THREE.CircleGeometry(r, 40).rotateX(Math.PI / 2), M.dark, SPLIT * MM);
  add(s2, new THREE.LatheGeometry(NOSE.map(([nr, ny]) => new THREE.Vector2(nr * MM, ny * MM)), 40), M.abs);
  add(s2, new THREE.LatheGeometry(TIP.map(([nr, ny]) => new THREE.Vector2(nr * MM, ny * MM)), 32), M.steel);
  // HASA 로고 스티커
  const decal = add(s2, new THREE.PlaneGeometry(0.42, 0.42), M.logo, 1560 * MM);
  decal.position.z = r + 0.005;
  stage2Engine(s2, M);
  return s2;
}

// 2단 엔진(진공용 노즐). 쌓여 있을 때는 1단 안쪽에 숨어 있어요.
function stage2Engine(s2, M) {
  add(s2, new THREE.CylinderGeometry(0.11, 0.3, 0.85, 24, 1, true), M.steel, SPLIT * MM - 0.42);
  add(s2, new THREE.CylinderGeometry(0.16, 0.12, 0.25, 16), M.dark, SPLIT * MM - 0.02);
}

// 크리스마스 에디션: 트리 모양 로켓
function xmasBooster(M) {
  const s1 = new THREE.Group();
  const r = 47 * MM;
  add(s1, new THREE.CylinderGeometry(r, r, (SPLIT - 10) * MM, 40), M.pine, ((SPLIT + 10) / 2) * MM);
  for (let i = 1; i < 6; i++) add(s1, new THREE.TorusGeometry(r * 1.02, 0.05, 8, 40).rotateX(Math.PI / 2), M.gold, i * 2.0);
  const balls = [M.red, M.gold, M.blue];
  for (let i = 0; i < 40; i++) {
    const a = i * 0.9, y = 1 + (i / 40) * 10.4;
    add(s1, new THREE.SphereGeometry(0.09, 8, 6), balls[i % 3], y).position.set(Math.cos(a) * r * 1.05, y, Math.sin(a) * r * 1.05);
  }
  add(s1, new THREE.CylinderGeometry(18 * MM, 22 * MM, 9.4 * MM, 24), M.steel, 5.3 * MM);
  const shape = new THREE.Shape(FIN.map(([fr, fy]) => new THREE.Vector2(fr * MM, fy * MM)));
  const finGeo = new THREE.ExtrudeGeometry(shape, { depth: 7 * MM, bevelEnabled: false });
  finGeo.translate(0, 0, -3.5 * MM);
  for (let i = 0; i < 4; i++) add(s1, finGeo, i % 2 ? M.red : M.white).rotation.y = (i * Math.PI) / 2;
  add(s1, new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), M.dark, SPLIT * MM);
  return s1;
}

function xmasUpper(M) {
  const s2 = new THREE.Group();
  const y0 = SPLIT * MM;
  const tiers = [[0.95, 1.7, 0.85], [0.78, 1.5, 1.95], [0.58, 1.3, 2.95]];
  for (const [r, h, y] of tiers) add(s2, new THREE.ConeGeometry(r, h, 28), M.pine, y0 + y);
  const balls = [M.red, M.gold, M.blue, M.white];
  for (let i = 0; i < 18; i++) {
    const tier = tiers[i % 3], a = i * 2.1;
    const rr = tier[0] * 0.55;
    const m = add(s2, new THREE.SphereGeometry(0.1, 10, 8), balls[i % 4], 0);
    m.position.set(Math.cos(a) * rr, y0 + tier[2] - tier[1] * 0.12, Math.sin(a) * rr);
  }
  const star = add(s2, new THREE.OctahedronGeometry(0.32), M.star, y0 + 3.85);
  star.scale.set(1, 1.3, 0.45);
  stage2Engine(s2, M);
  return s2;
}

// 학교 밖 먼 곳의 HASA 발사장: 섬 모양 땅, 발사대·화염 유도로, 발사탑(젓가락 팔), 피뢰탑,
// 연료 탱크, 물탱크, 크롤러웨이, 조립동(VAB, HASA 간판), 관제센터
function siteModel(M) {
  const g = new THREE.Group();
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  const grass = mat(0x7d9455, { roughness: 1 });
  const concrete = mat(0xbdb9b1, { roughness: 0.95 });
  const gravel = mat(0x9c958a, { roughness: 1 });
  const truss = mat(0x5d636b, { roughness: 0.55, metalness: 0.6 });
  const wall = mat(0xe3e5e7, { roughness: 0.7 });
  const panel = mat(0xb4bac1, { roughness: 0.6, metalness: 0.2 });
  const glass = mat(0x2b3f57, { roughness: 0.15, metalness: 0.6 });
  const white = mat(0xf2f2ef, { roughness: 0.45, metalness: 0.1 });
  const put = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const box = (w, h, d, x, y, z, m = truss) => put(new THREE.BoxGeometry(w, h, d), m, x, y, z);

  put(new THREE.CircleGeometry(240, 72).rotateX(-Math.PI / 2), grass, 0, -0.05, 0);
  put(new THREE.CylinderGeometry(240, 232, 18, 72, 1, true), mat(0x6e5238, { roughness: 1, side: THREE.DoubleSide }), 0, -9.05, 0);
  // 발사대 주변 콘크리트(팔각형)와 화염 유도로
  put(new THREE.CylinderGeometry(30, 30, 0.5, 8), concrete, 0, 0.2, 0);
  box(6, 0.6, 26, 0, 0.18, -15, mat(0x2a2b2d));
  put(new THREE.CylinderGeometry(4.2, 4.8, 0.8, 32), concrete, 0, 0.4, 0);
  put(new THREE.CylinderGeometry(1.2, 1.4, 0.5, 24), truss, 0, 1.05, 0);
  // 발사탑
  const tx = 3.3, h = 26;
  for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(0.18, h, 0.18, tx + dx, h / 2 + 0.8, dz);
  for (let y = 2; y < h; y += 2) {
    box(1.58, 0.12, 0.12, tx, y + 0.8, -0.7); box(1.58, 0.12, 0.12, tx, y + 0.8, 0.7);
    box(0.12, 0.12, 1.58, tx - 0.7, y + 0.8, 0); box(0.12, 0.12, 1.58, tx + 0.7, y + 0.8, 0);
  }
  box(1.8, 0.6, 1.8, tx, h + 1.1, 0);
  const banner = put(new THREE.PlaneGeometry(1.5, 1.5), M.logo, tx + 0.92, h - 2, 0);
  banner.rotation.y = Math.PI / 2;
  // 피뢰탑 3개
  for (const a of [0.6, 2.7, 4.8]) {
    put(new THREE.CylinderGeometry(0.18, 0.35, 42, 8), truss, Math.cos(a) * 26, 21, Math.sin(a) * 26);
    put(new THREE.ConeGeometry(0.3, 2.5, 8), truss, Math.cos(a) * 26, 43.2, Math.sin(a) * 26);
  }
  // 연료(액체산소·케로신) 탱크
  for (const x of [34, 46]) {
    put(new THREE.SphereGeometry(5, 24, 16), white, x, 6.5, -24);
    put(new THREE.CylinderGeometry(3, 3.4, 1.6, 20), concrete, x, 0.8, -24);
  }
  // 물탱크(소음 억제용)
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) box(0.3, 14, 0.3, -38 + dx, 7, -30 + dz);
  put(new THREE.CylinderGeometry(4, 4, 7, 24), white, -38, 17.5, -30);
  // 크롤러웨이(자갈길 두 줄)
  for (const x of [-5.5, 5.5]) box(7, 0.12, 150, x, 0.06, 105, gravel);
  // 조립동(VAB)
  const vx = 0, vz = 205;
  box(50, 62, 42, vx, 31, vz, wall);
  box(52, 2, 44, vx, 62.5, vz, panel);
  for (const dx of [-16, 16]) box(12, 54, 0.6, vx + dx, 27, vz - 21.3, panel);
  for (let y = 4; y < 54; y += 6) for (const dx of [-16, 16]) box(12, 0.25, 0.4, vx + dx, y, vz - 21.7, truss);
  const sign = put(new THREE.PlaneGeometry(17, 21.25), new THREE.MeshBasicMaterial({ map: hasaSignTexture(), transparent: true }), vx, 40, vz - 21.4);
  sign.rotation.y = Math.PI;
  // 관제센터
  box(40, 12, 18, -78, 6, 130, wall);
  box(40.4, 3.4, 0.6, -78, 8.5, 120.8, glass);
  box(42, 1, 20, -78, 12.4, 130, panel);
  put(new THREE.CylinderGeometry(4, 4, 2, 20), white, -66, 14, 130).scale.set(1, 1, 1);
  box(0.2, 6, 0.2, -66, 18, 130, truss);
  box(8, 0.1, 40, -78, 0.05, 160, concrete);
  // 붙잡는 팔
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(tx - 0.75, ARM_Y, side * 0.62);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 0.2), M.dark);
    arm.position.x = -1.7;
    pivot.add(arm);
    g.add(pivot);
    arms.push({ pivot, side });
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, arms };
}

const bez = (P, u, out) => {
  const [a, b, c, d] = P;
  const v = 1 - u;
  return out.set(
    v * v * v * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u * u * u * d.x,
    v * v * v * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u * u * u * d.y,
    v * v * v * a.z + 3 * v * v * u * b.z + 3 * v * u * u * c.z + u * u * u * d.z,
  );
};
const ease = (u) => u * u * (3 - 2 * u);
const fmtClock = (t) => {
  const s = Math.abs(t);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `T${t < 0 ? '−' : '+'} 00:${mm}:${ss}`;
};

// 1단 회수 단계별 길이(초). 비행 시간에 맞춰 늘립니다.
const PHASES = [['flip', 1.2], ['boostback', 3.0], ['entry', 2.0], ['landing', 2.2]];

export class RocketSystem {
  // siteXZ: 학교에서 멀리 떨어진 발사장 위치
  constructor(world, siteXZ, siteY = 0) {
    this.w = world;
    this.M = mats();
    this.sitePos = new THREE.Vector3(siteXZ[0], siteY, siteXZ[1]);
    const site = siteModel(this.M);
    this.site = site.g;
    this.arms = site.arms;
    this.site.position.copy(this.sitePos);
    world.scene.add(this.site);
    this.base = this.sitePos.clone().add(new THREE.Vector3(0, 1.3, 0));
    this.flightNo = 0;
    this.bst = null;
    this.dir = UP.clone();
    this.impactAt = -99;
    this.setArms(1);
    this.stack(true);
  }

  get busy() { return this.state !== 'idle'; }

  // 'normal' 또는 'xmas'(트리 로켓). 비행 중이 아니면 바로 다시 세워요.
  setTheme(theme) {
    if (this.theme === theme) return;
    this.theme = theme;
    if (this.state === 'idle' || this.state === 'stack') this.reset();
  }

  setArms(open) {
    for (const a of this.arms) a.pivot.rotation.y = a.side * 0.95 * open;
  }

  stack(fresh, reuse = null) {
    this.root = new THREE.Group();
    this.root.position.copy(this.base);
    const xmas = this.theme === 'xmas';
    this.s1 = reuse || (xmas ? xmasBooster(this.M) : boosterModel(this.M));
    this.s1.position.set(0, 0, 0);
    this.s1.quaternion.identity();
    this.s1.scale.set(1, fresh ? 0.001 : 1, 1);
    this.s2 = xmas ? xmasUpper(this.M) : upperModel(this.M);
    this.s2.scale.set(1, 0.001, 1);
    this.root.add(this.s1, this.s2);
    this.w.scene.add(this.root);
    this.state = 'stack';
    this.t = 0;
    this.freshStack = fresh;
  }

  launch(target) {
    if (this.state !== 'idle') return false;
    this.flightNo++;
    this.target = target.clone();
    const flat = Math.hypot(target.x - this.base.x, target.z - this.base.z);
    const apex = Math.max(420, flat * 0.42);
    const back = new THREE.Vector3(this.base.x - target.x, 0, this.base.z - target.z).multiplyScalar(0.22);
    this.P = [
      this.base.clone(),
      this.base.clone().add(new THREE.Vector3(0, apex, 0)),
      target.clone().add(new THREE.Vector3(0, apex * 0.7, 0)).add(back),
      target.clone(),
    ];
    this.T = 7 + flat / 450;
    this.tSep = this.T * 0.3;
    // 1단은 2단이 명중하고 2.6초쯤 뒤에 붙잡히도록 회수 단계를 늘립니다.
    const base = PHASES.reduce((s, [, d]) => s + d, 0);
    this.k = Math.max(1, (this.T + 2.6 - this.tSep) / base);
    let acc = 0;
    this.phaseAt = {};
    for (const [name, d] of PHASES) { this.phaseAt[name] = acc; acc += d * this.k; }
    this.phaseAt.catch = acc;
    this.phaseAt.lower = acc + 0.8;
    this.phaseAt.done = acc + 1.6;

    // 최대 동압: 공기 밀도가 고도에 따라 지수적으로 줄어든다고 보고 ½ρv²가 가장 큰 순간
    let best = 0, tMaxQ = this.tSep * 0.5;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let t = 0.05; t < this.tSep; t += 0.02) {
      this.flightPos(t, a); this.flightPos(t + 0.01, b);
      const v = a.distanceTo(b) / 0.01;
      const rho = Math.exp(-(a.y - this.base.y) / (apex * 0.22));
      const q = 0.5 * rho * v * v;
      if (q > best) { best = q; tMaxQ = t; }
    }
    const s = this.tSep, P = this.phaseAt;
    this.events = [
      { t: -1.2, label: 'STARTUP' },
      { t: 0, label: 'LIFTOFF' },
      { t: tMaxQ, label: 'MAX-Q' },
      { t: s - 0.15, label: 'MECO' },
      { t: s, label: 'STAGE SEP' },
      { t: s + P.boostback, label: 'BOOSTBACK' },
      { t: this.T, label: 'IMPACT' },
      { t: s + P.landing, label: 'LANDING BURN' },
      { t: s + P.catch, label: 'CATCH' },
    ].sort((x, y) => x.t - y.t);
    this.tEnd = s + P.catch + 1;
    this.state = 'count';
    this.t = -1.6;
    this.separated = false;
    this.lit = false;
    this.s2live = true;
    this.bst = null;
    this.tel = { s1: { spd: 0, alt: 0 }, s2: { spd: 0, alt: 0 } };
    this.prev2 = this.base.clone();
    this.prev1 = this.base.clone();
    this.w.sound.countdown();
    this.w.ui.sx.show(this.events, -1.6, this.tEnd, `HASA · ${this.theme === 'xmas' ? 'SANTA' : 'HFV-1'} FLIGHT ${this.flightNo}`);
    this.cinema(target);
    return true;
  }

  // 먼 발사장에서 이륙 → 로켓을 쫓아 학교까지 → 명중 → 다시 발사장으로 가서 1단 붙잡기
  cinema(target) {
    const base = this.base;
    const toSchool = new THREE.Vector3(target.x - base.x, 0, target.z - base.z).normalize();
    const across = new THREE.Vector3(-toSchool.z, 0, toSchool.x);
    const tSide = sideFrom(this.w.camera, target);
    const up = (h) => new THREE.Vector3(0, h, 0);
    this.w.director?.play(() => {
      const T = this.t;
      if (this.state === 'idle') return null;
      if (this.state === 'stack') return this.t < 1.2 ? { key: 'restack', pos: base.clone().addScaledVector(across, 26).addScaledVector(toSchool, -12).add(up(14)), look: base.clone().add(up(8)), snap: 2 } : null;
      if (T < 1.5) {
        return { key: 'pad', cut: true, pos: base.clone().addScaledVector(across, 24).addScaledVector(toSchool, -16).add(up(4)), look: base.clone().add(up(9 + Math.max(0, T) * 22)), snap: 3.5 };
      }
      if (this.s2live) {
        const p = this.root.position;
        return { key: 'chase', pos: p.clone().addScaledVector(this.dir, -26).addScaledVector(across, 8).add(up(4)), look: p.clone().addScaledVector(this.dir, 14), snap: 4.5, lookSnap: 9 };
      }
      if (T - this.impactAt < 1.9) return { key: 'impact', pos: target.clone().addScaledVector(tSide, 64).add(up(32)), look: target.clone().add(up(5)), snap: 2.4 };
      if (this.bst) {
        const b = this.bst.obj.position;
        return { key: 'catch', cut: true, pos: base.clone().addScaledVector(across, 34).addScaledVector(toSchool, -22).add(up(16)), look: b.clone().add(up(5)), snap: 2.2, lookSnap: 5 };
      }
      return null;
    });
  }

  flightPos(t, out) {
    const u = Math.max(0, Math.min(1, t / this.T));
    return bez(this.P, Math.pow(u, 1.6), out);
  }

  smooth(tel, pos, prev, dt) {
    const spd = (pos.distanceTo(prev) / Math.max(dt, 1e-3)) * 3.6;
    tel.spd += (spd - tel.spd) * Math.min(1, dt * 8);
    tel.alt = Math.max(0, pos.y - this.base.y);
    prev.copy(pos);
  }

  update(dt) {
    const { fx, sound, ui } = this.w;
    this.t += dt;

    if (this.state === 'stack') {
      const k = ease(Math.min(1, this.t / 1.4));
      if (this.freshStack) this.s1.scale.set(1, Math.max(0.001, k), 1);
      const k2 = ease(Math.min(1, Math.max(0, (this.t - (this.freshStack ? 0.6 : 0)) / 1.2)));
      this.s2.scale.set(1, Math.max(0.001, k2), 1);
      if (this.t > (this.freshStack ? 1.9 : 1.3)) { this.s1.scale.set(1, 1, 1); this.s2.scale.set(1, 1, 1); this.state = 'idle'; }
      return;
    }
    if (this.state === 'idle') return;

    const t = this.t;
    if (this.state === 'count') {
      if (t > -0.3) for (let i = 0; i < 6; i++) fx.launchSmoke(this.base);
      if (t >= 0) { this.state = 'flight'; sound.roar(this.tSep + 0.4); }
    }

    if (this.state === 'flight' && this.s2live) {
      const pos = this.flightPos(t, new THREE.Vector3());
      const dir = this.flightPos(t + 0.01, new THREE.Vector3()).sub(pos);
      if (dir.lengthSq() < 1e-8) dir.copy(UP); else dir.normalize();
      this.root.position.copy(pos);
      this.root.quaternion.setFromUnitVectors(UP, dir);
      this.dir = dir;
      this.smooth(this.tel.s2, pos, this.prev2, dt);
      if (!this.separated) { this.tel.s1.spd = this.tel.s2.spd; this.tel.s1.alt = this.tel.s2.alt; this.prev1.copy(pos); }
      if (!this.separated) {
        fx.exhaust(pos.clone().addScaledVector(dir, -0.1), dir, 1.0);
      } else if (t - this.tSep > 0.55) {
        // 분리 뒤 0.55초 관성 비행 → 2단 점화(진공용 노즐이라 가늘고 밝은 불꽃)
        const nozzle = pos.clone().addScaledVector(dir, HFV.split - 0.85);
        if (!this.lit) { this.lit = true; fx.sparks(nozzle, 24); this.w.sound.roar(this.T - t + 0.2); }
        fx.exhaust2(nozzle, dir);
      }
      if (pos.y - this.base.y < 30) for (let i = 0; i < 3; i++) fx.launchSmoke(this.base);
      if (!this.separated && t >= this.tSep) this.separate(dir);
      if (t >= this.T) {
        this.s2live = false;
        this.impactAt = t;
        this.w.scene.remove(this.root);
        this.w.explode(this.target, { tool: 'rocket', R: 15, power: 42, flash: 1.4, craterR: 0.8, craterD: 0.4 });
        this.tel.s2.spd = 0;
      }
    }

    if (this.bst) this.updateBooster(dt);
    ui.sx.update(t, fmtClock(t), this.tel.s1, this.s2live ? this.tel.s2 : null);

    if (!this.s2live && this.bst?.phase === 'done') {
      const s1 = this.bst.obj;
      this.w.scene.remove(s1);
      this.bst = null;
      setTimeout(() => this.w.ui.sx.hide(), 1200);
      this.stack(false, s1);
    }
  }

  separate(dir) {
    this.separated = true;
    const s1 = this.s1;
    // 1단은 로켓 원점에 그대로 붙어 있으니 로켓 전체의 위치·자세가 곧 1단의 위치·자세예요.
    const p = this.root.position.clone(), q = this.root.quaternion.clone();
    this.root.remove(s1);
    s1.position.copy(p);
    s1.quaternion.copy(q);
    this.w.scene.add(s1);
    const vel = dir.clone().multiplyScalar((this.tel.s2.spd / 3.6) * 0.45);
    const toPad = new THREE.Vector3(this.base.x - p.x, 0, this.base.z - p.z);
    if (toPad.lengthSq() < 1) toPad.set(1, 0, 0);
    toPad.normalize().add(new THREE.Vector3(0, 0.25, 0)).normalize();
    this.bst = { obj: s1, phase: 'flip', t0: this.t, vel, q0: q.clone(), qPad: new THREE.Quaternion().setFromUnitVectors(UP, toPad) };
    this.prev1.copy(p);
    this.w.fx.sparks(p.clone().add(new THREE.Vector3(0, HFV.split, 0).applyQuaternion(q)), 30);
    this.w.sound.pop();
  }

  updateBooster(dt) {
    const b = this.bst, o = b.obj, fx = this.w.fx, P = this.phaseAt, k = this.k;
    const tb = this.t - b.t0;
    const above = this.base.clone().add(new THREE.Vector3(0, 230, 0));
    const low = this.base.clone().add(new THREE.Vector3(0, 70, 0));
    const catchPos = this.base.clone().add(new THREE.Vector3(0, CATCH_LIFT, 0));
    const engines = () => o.position.clone().add(new THREE.Vector3(0, -0.2, 0).applyQuaternion(o.quaternion));
    const noseDir = () => new THREE.Vector3(0, 1, 0).applyQuaternion(o.quaternion);
    const u = (name, next) => Math.min(1, Math.max(0, (tb - P[name]) / (P[next] - P[name])));

    if (b.phase === 'flip') {
      b.vel.y -= 9.8 * dt;
      o.position.addScaledVector(b.vel, dt);
      o.quaternion.slerpQuaternions(b.q0, b.qPad, ease(u('flip', 'boostback')));
      if (Math.random() < 0.6) fx.puff(o.position.clone().addScaledVector(noseDir(), HFV.split * 0.9));
      if (tb >= P.boostback) {
        b.phase = 'boostback';
        const p0 = o.position.clone();
        b.path = [p0, p0.clone().addScaledVector(b.vel, 0.9 * k), above.clone().add(new THREE.Vector3(0, 60, 0)).lerp(p0, 0.3), above];
      }
    } else if (b.phase === 'boostback') {
      const v = u('boostback', 'entry');
      bez(b.path, ease(v), o.position);
      o.quaternion.slerpQuaternions(b.qPad, new THREE.Quaternion(), ease(Math.max(0, (v - 0.6) / 0.4)));
      if (v < 0.7) fx.exhaust(engines(), noseDir(), 0.7);
      if (v >= 1) b.phase = 'entry';
    } else if (b.phase === 'entry') {
      const v = u('entry', 'landing');
      o.position.lerpVectors(above, low, v * v);
      o.quaternion.identity();
      if (v >= 1) { b.phase = 'landing'; this.w.sound.roar(2.2 * k); }
    } else if (b.phase === 'landing') {
      const v = u('landing', 'catch');
      o.position.lerpVectors(low, catchPos, 1 - (1 - v) * (1 - v));
      o.quaternion.identity();
      fx.exhaust(engines(), UP, 0.8);
      if (o.position.y - this.base.y < 30) fx.launchSmoke(this.base);
      if (v >= 1) b.phase = 'catch';
    } else if (b.phase === 'catch') {
      const v = u('catch', 'lower');
      this.setArms(1 - ease(Math.min(1, v * 2)));
      o.position.copy(catchPos);
      if (v >= 0.5 && !b.clanked) {
        b.clanked = true;
        this.w.sound.pop();
        this.w.ui.toast('1단 회수 성공', '발사탑 팔이 붙잡았어요', 'green');
      }
      if (v >= 1) b.phase = 'lower';
    } else if (b.phase === 'lower') {
      const v = u('lower', 'done');
      this.setArms(ease(v));
      o.position.lerpVectors(catchPos, this.base, ease(v));
      if (v >= 1) b.phase = 'done';
    }
    if (b.phase !== 'done') this.smooth(this.tel.s1, o.position, this.prev1, dt);
    else this.tel.s1.spd = 0;
  }

  reset() {
    if (this.root) this.w.scene.remove(this.root);
    if (this.bst) this.w.scene.remove(this.bst.obj);
    this.bst = null;
    this.setArms(1);
    this.w.ui.sx.hide();
    this.stack(true);
  }
}
