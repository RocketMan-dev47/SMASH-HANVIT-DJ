import * as THREE from 'three';

// 온라인 아바타: 한빛고 교복을 입은 학생(받침 없이 땅에 바로, 키 약 1.7 m).
// 교복(학교 안내문 기준) — 동복: 진회색 자켓(남 차이나칼라 / 여 라운드넥, 싱글 5버튼), V넥 진회색 조끼, 흰 셔츠·블라우스, 넥타이, 진회색 바지·앞주름 치마
//                       하복: 순백 반팔 셔츠(진회색 깃·앞단 배색), 진회색 바지·치마
const C = { charcoal: 0x3a3d43, vest: 0x4a4d53, gray: 0x5b5f66, white: 0xf7f7f4, trim: 0x55595f, tie: 0x6b6f76, head: 0xf08848, shoe: 0x1c1d20, cushion: 0x8d9097 };

// 날씨에 맞는 교복: 기온 22도 이상이면 하복, 모르면 6~9월 하복
export function uniformFor(temp, month) {
  if (typeof temp === 'number') return temp >= 22 ? 'summer' : 'winter';
  return month >= 6 && month <= 9 ? 'summer' : 'winter';
}

const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// 성별: 본인이 고른 값(peer.g = 'm'|'f'), 없으면 아이디로 정해요
export function genderOf(peer) { return peer.g === 'f' || peer.g === 'm' ? peer.g : hash(peer.id) % 2 ? 'f' : 'm'; }

const SKIN = 0xf1d3bd, HAIR = [0x1d1a19, 0x2a211c, 0x3a2a20];

// 키 약 1.7 m, 머리:몸 = 1:7 정도의 균형 잡힌 학생. 받침 없이 땅에 바로 서요.
export function makeAvatar(peer, season) {
  const girl = genderOf(peer) === 'f';
  const g = new THREE.Group();
  const M = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const mesh = (geo, mat, x, y, z, p) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const body = new THREE.Group(); g.add(body);
  const skin = M(SKIN, 0.6), hairM = M(HAIR[hash(peer.id) % 3], 0.5), shoe = M(C.shoe, 0.5), bottom = M(C.gray, 0.8);
  const summer = season === 'summer';
  // 다리(엉덩이 높이 0.86 m): 위다리·아래다리를 묶어 걸을 때 흔들어요
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.86, 0); body.add(hip);
    if (girl) { mesh(new THREE.CylinderGeometry(0.052, 0.045, 0.78, 10), skin, 0, -0.43, 0, hip); mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.2, 10), M(0x2b2d31, 0.8), 0, -0.68, 0, hip); }
    else mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.82, 10), bottom, 0, -0.41, 0, hip);
    mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), shoe, 0, -0.83, 0.04, hip);
    legs.push(hip);
  }
  if (girl) mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.4, 16, 1, true), bottom, 0, 0.82, 0, body); // 앞주름 치마(무릎 위)
  else mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 14), bottom, 0, 0.9, 0, body); // 바지 허리
  // 몸통(0.9~1.42 m)
  const torsoY = 1.16;
  const top = summer ? M(C.white, 0.6) : M(C.charcoal, 0.75);
  const torso = mesh(new THREE.CylinderGeometry(girl ? 0.17 : 0.19, girl ? 0.16 : 0.17, 0.54, 16), top, 0, torsoY, 0, body); torso.scale.set(1, 1, 0.72);
  if (summer) {
    mesh(new THREE.BoxGeometry(0.035, 0.5, 0.02), M(C.trim), 0, torsoY, 0.125, body); // 앞단 배색
    for (const s of [-1, 1]) { const c = mesh(new THREE.BoxGeometry(0.09, 0.03, 0.08), M(C.trim), s * 0.05, torsoY + 0.27, 0.1, body); c.rotation.z = s * 0.45; } // 회색 깃
  } else {
    const v = mesh(new THREE.CylinderGeometry(0.075, 0.0, 0.22, 3), M(C.white), 0, torsoY + 0.16, 0.115, body); v.rotation.z = Math.PI; v.scale.set(1, 1, 0.2); // 셔츠 V
    mesh(new THREE.BoxGeometry(0.035, 0.2, 0.015), M(C.tie), 0, torsoY + 0.12, 0.13, body); // 넥타이
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.012, 6, 4), M(0x9a9da3), 0.03, torsoY + 0.02 - i * 0.07, 0.125, body); // 단추
  }
  // 팔(어깨 1.38 m): 걸을 때 다리와 반대로 흔들어요
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (girl ? 0.21 : 0.23), 1.38, 0); body.add(sh);
    if (summer) { mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.2, 10), top, 0, -0.1, 0, sh); mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.42, 10), skin, 0, -0.39, 0, sh); }
    else mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.58, 10), top, 0, -0.29, 0, sh);
    mesh(new THREE.SphereGeometry(0.045, 8, 6), skin, 0, -0.62, 0, sh);
    sh.rotation.z = s * 0.06; arms.push(sh);
  }
  // 목·머리(머리 높이 약 0.24 m)
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), skin, 0, 1.46, 0, body);
  const head = mesh(new THREE.SphereGeometry(0.115, 20, 16), skin, 0, 1.58, 0, body); head.scale.set(0.92, 1.05, 1);
  // 머리카락: 남 짧은 머리 / 여 단발
  const hairTop = mesh(new THREE.SphereGeometry(0.125, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 1.6, -0.005, body); hairTop.scale.set(0.95, 1.05, 1.03);
  if (girl) { const bob = mesh(new THREE.CylinderGeometry(0.13, 0.145, 0.2, 18, 1, true, Math.PI * 0.18, Math.PI * 1.64), hairM, 0, 1.53, -0.01, body); bob.rotation.y = Math.PI; }
  else mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), hairM, 0, 1.63, -0.1, body);
  // 이름표 색 작은 배지(가슴)
  mesh(new THREE.BoxGeometry(0.05, 0.02, 0.01), M(new THREE.Color(peer.color || '#ffc94a').getHex(), 0.4), -0.09, torsoY + 0.16, 0.125, body);
  g.userData = { body, legs, arms, girl, season, ph: hash(peer.id) % 100, walk: 0 };
  return g;
}

// 걷기: 속도(0~1)에 따라 팔다리를 흔들고, 서 있을 땐 살짝 숨쉬어요
export function animateAvatar(g, t, speed = 0) {
  const u = g.userData;
  u.walk += (Math.min(1, speed) - u.walk) * 0.15;
  const k = u.walk, sw = Math.sin(t * 7 + u.ph) * 0.55 * k;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.arms[0].rotation.x = -sw * 0.8; u.arms[1].rotation.x = sw * 0.8;
  u.body.position.y = Math.abs(Math.sin(t * 7 + u.ph)) * 0.03 * k + Math.sin(t * 1.6 + u.ph) * 0.004 * (1 - k);
}
