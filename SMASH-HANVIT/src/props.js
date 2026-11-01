import * as THREE from 'three';

// ---------- 테슬라 로드스터 UFO (스타맨이 운전, 추진기로 떠 있어요) ----------
export function makeRoadster() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xc1121f, roughness: 0.22, metalness: 0.6, side: THREE.DoubleSide });
  const black = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x14202a, roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.75 });
  const suit = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  const visor = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.1, metalness: 1 });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  // 옆모습 단면(앞이 +z)
  const prof = [[-2.05, 0.3], [-2.0, 0.78], [-1.5, 0.92], [-0.7, 0.95], [0.6, 0.93], [1.7, 0.78], [2.1, 0.55], [2.1, 0.32], [1.6, 0.2], [-1.6, 0.2]];
  const body = new THREE.ExtrudeGeometry(new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y))), { depth: 1.85, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  body.translate(0, 0, -0.925).rotateY(-Math.PI / 2);
  add(body, paint);
  const ws = add(new THREE.PlaneGeometry(1.6, 0.5), glass, 0, 1.08, 0.48);
  ws.rotation.x = -0.95;
  // 바퀴
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 18).rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) add(wheel, black, x, 0.33, z);
  // 스타맨
  add(new THREE.BoxGeometry(0.42, 0.5, 0.32), suit, -0.4, 1.12, -0.25);
  add(new THREE.SphereGeometry(0.21, 16, 12), suit, -0.4, 1.55, -0.25);
  add(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI), visor, -0.4, 1.57, -0.15).rotation.y = 0;
  const arm = add(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8), suit, -0.78, 1.18, -0.1);
  arm.rotation.z = 1.1;
  // 추진기 4개와 파란 불꽃
  const glow = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [x, z] of [[-0.75, 1.2], [0.75, 1.2], [-0.75, -1.2], [0.75, -1.2]]) {
    add(new THREE.CylinderGeometry(0.16, 0.26, 0.35, 14, 1, true), black, x, 0.05, z);
    const f = add(new THREE.ConeGeometry(0.22, 1.4, 12, 1, true).rotateX(Math.PI), flameMat, x, -0.75, z);
    f.castShadow = false;
    glow.push(f);
  }
  const emitter = add(new THREE.CircleGeometry(0.3, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5040 }), 0, 0.12, 0);
  emitter.castShadow = false;
  g.userData = { glow, emitter };
  return g;
}

// 위성 대신 하늘에 떠서 레이저를 쏘는 로드스터
export class RoadsterUFO {
  constructor(scene) {
    this.g = makeRoadster();
    this.g.scale.setScalar(3);
    this.g.visible = false;
    scene.add(this.g);
    this.state = 'off';
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.t = 0;
  }

  show(P) {
    this.target.copy(P);
    if (this.state === 'off') this.pos.copy(P).add(new THREE.Vector3(60, 340, -40));
    this.state = 'in';
    this.g.visible = true;
  }

  follow(P) { this.target.copy(P); }

  hide() { if (this.state !== 'off') this.state = 'out'; }

  // 레이저가 나가는 아랫면(월드 좌표)
  emitter(out) { return out.copy(this.g.position).add(new THREE.Vector3(0, 0.3, 0)); }

  update(dt) {
    if (this.state === 'off') return;
    this.t += dt;
    const hover = this.target.clone().add(new THREE.Vector3(0, 55, 0));
    if (this.state === 'out') hover.add(new THREE.Vector3(80, 380, 40));
    const k = 1 - Math.exp(-dt * (this.state === 'out' ? 2.5 : 4));
    const before = this.pos.clone();
    this.pos.lerp(hover, k);
    const vel = this.pos.clone().sub(before).divideScalar(Math.max(dt, 1e-3));
    this.g.position.copy(this.pos).add(new THREE.Vector3(0, Math.sin(this.t * 2.2) * 0.6, 0));
    this.g.rotation.set(THREE.MathUtils.clamp(vel.z * 0.01, -0.35, 0.35), this.t * 0.35, THREE.MathUtils.clamp(-vel.x * 0.01, -0.35, 0.35));
    for (const f of this.g.userData.glow) f.scale.y = 0.8 + Math.random() * 0.5;
    if (this.state === 'out' && this.pos.distanceTo(hover) < 30) { this.state = 'off'; this.g.visible = false; }
  }
}

// ---------- 우주에 숨어 있는 귀여운 외계인 ----------
export function makeAlien() {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.25, metalness: 0.9 });
  const green = new THREE.MeshStandardMaterial({ color: 0x7ed957, roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.1, metalness: 0.3 });
  const dome = new THREE.MeshStandardMaterial({ color: 0xaee3ff, roughness: 0.05, transparent: true, opacity: 0.35 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff27a });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.SphereGeometry(3, 28, 12), silver).scale.set(1, 0.28, 1);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(new THREE.SphereGeometry(0.22, 8, 6), lamp, Math.cos(a) * 2.7, 0, Math.sin(a) * 2.7); }
  add(new THREE.SphereGeometry(1.55, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), dome, 0, 0.6, 0);
  add(new THREE.SphereGeometry(0.75, 20, 14), green, 0, 1.25, 0);
  for (const s of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.26, 14, 10), black, 0.3 * s, 1.35, 0.6);
    eye.scale.set(0.8, 1.15, 0.5);
    add(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.24 * s, 1.47, 0.73);
    const ant = add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), green, 0.32 * s, 2.05, 0);
    ant.rotation.z = -0.35 * s;
    add(new THREE.SphereGeometry(0.1, 8, 6), lamp, 0.43 * s, 2.35, 0);
  }
  const arm = new THREE.Group();
  arm.position.set(0.75, 1.15, 0.1);
  const a = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), green);
  a.position.y = 0.35;
  arm.add(a);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), green);
  hand.position.y = 0.72;
  arm.add(hand);
  g.add(arm);
  g.userData.arm = arm;
  return g;
}

// ---------- 배트(오렌지·블랙, 이글스 느낌) ----------
const BAT = [[0.0, 0], [0.034, 0.004], [0.034, 0.016], [0.014, 0.022], [0.013, 0.2], [0.015, 0.38], [0.022, 0.5], [0.031, 0.62], [0.034, 0.75], [0.033, 0.83], [0.026, 0.84], [0.0, 0.84]];
export function makeBat() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.35, metalness: 0.05 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  // 손잡이(검정) / 배럴(주황)을 나눠서 회전체로 만들어요
  const handle = BAT.filter(([, y]) => y <= 0.4).concat([[0.0, 0.4]]);
  const barrel = [[0.0, 0.4], [0.015, 0.4]].concat(BAT.filter(([, y]) => y > 0.4));
  const lathe = (pts, m) => { const o = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24), m); o.castShadow = true; g.add(o); return o; };
  lathe(handle, black);
  lathe(barrel, orange);
  for (const y of [0.42, 0.45, 0.79]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.0, 0.006, 24, 1, true), white);
    const r = BAT.reduce((best, [rr, yy]) => (Math.abs(yy - y) < Math.abs(best[1] - y) ? [rr, yy] : best))[0];
    ring.geometry = new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.008, 24, 1, true);
    ring.position.y = y;
    g.add(ring);
  }
  return g;
}
