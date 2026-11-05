import * as THREE from 'three';

// 한빛고 태권도: 거대한 사범이 나타나 발차기로 격파해요. 누를 때마다 기술이 바뀌고, 쓸수록 띠가 올라가요.
export const KICKS = [
  { id: 'dollyeo', name: '돌려차기', R: 6.5, power: 34, desc: '옆으로 크게 휘둘러 차요' },
  { id: 'yeop', name: '옆차기', R: 5.5, power: 42, desc: '옆으로 곧게 내질러요' },
  { id: 'naeryeo', name: '내려찍기', R: 6, power: 38, desc: '높이 들어 위에서 찍어요' },
  { id: 'dwihuryeo', name: '뒤후려차기', R: 7.5, power: 40, desc: '한 바퀴 돌며 후려쳐요' },
  { id: 'twio', name: '뛰어옆차기', R: 7, power: 46, desc: '뛰어올라 날아차요' },
];
export const BELTS = [
  [0, '흰 띠', 0xf4f4f0], [5, '노란 띠', 0xf2c94c], [15, '초록 띠', 0x2f9e44], [30, '파란 띠', 0x2f6fe0], [50, '빨간 띠', 0xd8282f], [80, '검은 띠', 0x151515],
];
export const beltFor = (n) => [...BELTS].reverse().find(([k]) => n >= k);

// 도복 입은 사범(관절별 그룹). 키 약 18 m.
function master(beltColor) {
  const g = new THREE.Group();
  const dobok = new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.75 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe9c4a2, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.8 });
  const belt = new THREE.MeshStandardMaterial({ color: beltColor, roughness: 0.6 });
  const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const S = 2.2; // 비율
  const hips = new THREE.Group();
  hips.position.y = 4.2 * S;
  g.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  add(new THREE.BoxGeometry(2.3 * S, 3.0 * S, 1.3 * S), dobok, 0, 1.6 * S, 0, torso);
  add(new THREE.BoxGeometry(0.5 * S, 2.6 * S, 0.06 * S), trim, 0.35 * S, 1.8 * S, 0.66 * S, torso).rotation.z = 0.35; // 깃
  add(new THREE.BoxGeometry(2.4 * S, 0.35 * S, 1.4 * S), belt, 0, 0.3 * S, 0, torso);
  add(new THREE.BoxGeometry(0.3 * S, 1.0 * S, 0.12 * S), belt, 0.5 * S, -0.3 * S, 0.72 * S, torso);
  add(new THREE.BoxGeometry(0.3 * S, 0.9 * S, 0.12 * S), belt, 0.15 * S, -0.25 * S, 0.72 * S, torso);
  const head = new THREE.Group();
  head.position.y = 3.6 * S;
  torso.add(head);
  add(new THREE.SphereGeometry(0.75 * S, 18, 14), skin, 0, 0.3 * S, 0, head);
  add(new THREE.SphereGeometry(0.78 * S, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2.2), hair, 0, 0.42 * S, -0.05 * S, head);
  for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.09 * S, 8, 6), trim, sx * 0.28 * S, 0.35 * S, 0.68 * S, head);
  // 팔(가드 자세)
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(sx * 1.35 * S, 2.8 * S, 0);
    torso.add(sh);
    add(new THREE.BoxGeometry(0.6 * S, 1.6 * S, 0.6 * S), dobok, 0, -0.75 * S, 0, sh);
    const el = new THREE.Group();
    el.position.y = -1.5 * S;
    sh.add(el);
    add(new THREE.BoxGeometry(0.55 * S, 1.5 * S, 0.55 * S), dobok, 0, -0.7 * S, 0, el);
    add(new THREE.SphereGeometry(0.33 * S, 10, 8), skin, 0, -1.5 * S, 0, el);
    sh.rotation.x = -0.9; el.rotation.x = -1.4;
    arms.push({ sh, el });
  }
  // 다리: 0 = 차는 다리, 1 = 디딤 다리
  const legs = [];
  for (const sx of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.7 * S, 0, 0);
    hips.add(hip);
    add(new THREE.BoxGeometry(0.85 * S, 2.1 * S, 0.85 * S), dobok, 0, -1.0 * S, 0, hip);
    const knee = new THREE.Group();
    knee.position.y = -2.05 * S;
    hip.add(knee);
    add(new THREE.BoxGeometry(0.8 * S, 2.0 * S, 0.8 * S), dobok, 0, -1.0 * S, 0, knee);
    add(new THREE.BoxGeometry(0.55 * S, 0.3 * S, 1.0 * S), skin, 0, -2.1 * S, 0.2 * S, knee);
    legs.push({ hip, knee });
  }
  g.userData = { hips, torso, arms, legs, S };
  return g;
}

export class Taekwondo {
  constructor(world) {
    this.w = world;
    this.list = [];
    this.next = 0;
    try { this.kicks = Number(localStorage.getItem('smash-tkd') || 0); } catch { this.kicks = 0; }
  }

  belt() { return beltFor(this.kicks); }

  // P를 향해 기술을 써요. 사범은 카메라에서 옆모습이 보이게 서요.
  kick(P) {
    const w = this.w;
    const K = KICKS[this.next % KICKS.length];
    this.next++;
    const before = this.belt();
    this.kicks++;
    try { localStorage.setItem('smash-tkd', String(this.kicks)); } catch { /* 무시 */ }
    const after = this.belt();
    const cam = w.camera.position;
    const toCam = new THREE.Vector3(cam.x - P.x, 0, cam.z - P.z).normalize();
    const side = new THREE.Vector3(-toCam.z, 0, toCam.x); // 화면에서 옆으로
    const g = master(after[2]);
    const reach = 11;
    const base = P.clone().addScaledVector(side, -reach);
    base.y = w.terrain.heightAt(base.x, base.z);
    g.position.copy(base);
    // 차는 다리(+x)가 목표를 향하게. 내려찍기는 몸 정면이 목표를 향해요.
    g.rotation.y = Math.atan2(side.x, side.z) - Math.PI / 2 + (K.id === 'naeryeo' ? Math.PI / 2 : 0);
    g.scale.setScalar(0.001);
    w.scene.add(g);
    this.list.push({ g, K, P: P.clone(), dir: side, t: 0, hit: false });
    w.sound.kihap?.();
    w.ui.toast(`🥋 ${K.name}`, `${after[1]} · ${this.kicks}번째 기술`);
    if (after !== before) w.onBelt?.(after, this.kicks);
    w.onKick?.(K, this.kicks);
    return K;
  }

  update(dt) {
    const w = this.w;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const k = this.list[i];
      k.t += dt;
      const { hips, torso, arms, legs } = k.g.userData;
      const T = 1.15, u = Math.min(1, k.t / T);
      // 나타나기·사라지기
      const appear = Math.min(1, k.t / 0.15), vanish = Math.max(0, 1 - (k.t - T) / 0.3);
      k.g.scale.setScalar(Math.max(0.001, Math.min(appear, vanish)));
      const kickLeg = legs[0], stand = legs[1];
      const ease = (a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));
      const chamber = ease(0.05, 0.35), extend = ease(0.35, 0.55), back = ease(0.7, 0.95);
      const ext = extend * (1 - back);
      const ch = chamber * (1 - back);
      kickLeg.hip.rotation.set(0, 0, 0); kickLeg.knee.rotation.set(0, 0, 0); torso.rotation.set(0, 0, 0); hips.rotation.set(0, 0, 0);
      stand.knee.rotation.x = 0.25 * ch;
      if (k.K.id === 'naeryeo') {
        // 다리를 높이 들었다가 아래로 찍기
        kickLeg.hip.rotation.x = -2.6 * ch + 2.0 * ext;
        kickLeg.knee.rotation.x = 0.2 * (1 - ext);
        torso.rotation.x = 0.25 * ch;
      } else {
        // 옆차기·돌려차기: 몸을 옆으로 눕히며 무릎을 접었다 편다
        kickLeg.hip.rotation.z = 1.5 * ch;
        kickLeg.knee.rotation.x = 2.0 * ch * (1 - ext);
        kickLeg.hip.rotation.x = k.K.id === 'dollyeo' ? -0.9 * ext : 0;
        torso.rotation.z = -0.55 * ch;
        if (k.K.id === 'dwihuryeo') hips.rotation.y = -Math.PI * 2 * ease(0.05, 0.55);
        if (k.K.id === 'twio') hips.position.y = k.g.userData.S * 4.2 + Math.sin(Math.min(1, u / 0.6) * Math.PI) * 6;
      }
      for (const a of arms) a.sh.rotation.x = -0.9 - 0.4 * ch;
      if (!k.hit && u >= 0.5) {
        k.hit = true;
        const C = k.P.clone().addScaledVector(k.dir, -k.K.R * 0.5);
        if (k.K.id === 'naeryeo') C.y += 6;
        w.explode(C, { tool: 'tkd', kick: k.K.id, R: k.K.R * 1.2, power: k.K.power, fx: false, sound: false, crater: k.K.id === 'naeryeo', craterR: 0.4, craterD: 0.25, scorch: false, weight: 0.85 });
        w.fx.impact(k.P, k.K.R);
        w.sound.crack?.(true);
      }
      if (k.t > T + 0.35) { w.scene.remove(k.g); this.list.splice(i, 1); }
    }
  }

  clear() { for (const k of this.list) this.w.scene.remove(k.g); this.list = []; }
}
