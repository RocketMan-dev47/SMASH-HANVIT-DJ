import * as THREE from 'three';

// 온라인 아바타: 둥근 주황 머리의 작은 인형이 한빛고 교복을 입고 방석 위에 서 있어요(함께 보기 방에서만).
// 교복(학교 안내문 기준) — 동복: 진회색 자켓(남 차이나칼라 / 여 라운드넥, 싱글 5버튼), V넥 진회색 조끼, 흰 셔츠·블라우스, 넥타이, 진회색 바지·앞주름 치마
//                       하복: 순백 반팔 셔츠(진회색 깃·앞단 배색), 진회색 바지·치마
const C = { charcoal: 0x3a3d43, vest: 0x4a4d53, gray: 0x5b5f66, white: 0xf7f7f4, trim: 0x55595f, tie: 0x6b6f76, head: 0xf08848, shoe: 0x1c1d20, cushion: 0x8d9097 };

// 날씨에 맞는 교복: 기온 22도 이상이면 하복, 모르면 6~9월 하복
export function uniformFor(temp, month) {
  if (typeof temp === 'number') return temp >= 22 ? 'summer' : 'winter';
  return month >= 6 && month <= 9 ? 'summer' : 'winter';
}

const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function makeAvatar(peer, season) {
  const girl = hash(peer.id) % 2 === 1;
  const g = new THREE.Group();
  const M = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const add = (geo, mat, x, y, z, p = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const body = new THREE.Group();
  g.add(body);
  // 방석(사진처럼 회색 정사각 방석, 가장자리에 그 친구 색)
  add(new THREE.BoxGeometry(1.5, 0.22, 1.5), M(C.cushion, 0.9), 0, 0.11, 0);
  add(new THREE.BoxGeometry(1.52, 0.05, 1.52), M(new THREE.Color(peer.color || '#ffc94a').getHex(), 0.6), 0, 0.03, 0);
  // 다리·하의
  if (girl) {
    add(new THREE.CylinderGeometry(0.34, 0.5, 0.62, 12, 1, true), M(C.gray), 0, 0.68, 0, body); // 앞주름 치마
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 8), M(0xf3d6c2), s * 0.15, 0.3, 0, body); add(new THREE.SphereGeometry(0.11, 10, 8).scale(1, 0.6, 1.4), M(C.shoe), s * 0.15, 0.13, 0.04, body); }
  } else {
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.13, 0.14, 0.6, 10), M(C.gray), s * 0.15, 0.52, 0, body); add(new THREE.SphereGeometry(0.12, 10, 8).scale(1, 0.6, 1.4), M(C.shoe), s * 0.15, 0.16, 0.05, body); }
  }
  // 상의
  const torsoY = girl ? 1.18 : 1.12;
  if (season === 'winter') {
    add(new THREE.CylinderGeometry(0.36, 0.4, 0.66, 14), M(C.charcoal), 0, torsoY, 0, body); // 자켓
    add(new THREE.CylinderGeometry(0.2, 0.18, 0.5, 3).rotateZ(Math.PI), M(C.white), 0, torsoY + 0.1, 0.3, body).scale.set(1, 1, 0.3); // 셔츠 V
    add(new THREE.BoxGeometry(0.06, 0.3, 0.04), M(C.tie), 0, torsoY + 0.08, 0.37, body); // 넥타이
    for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.025, 6, 4), M(0x9a9da3), girl ? 0.03 : 0.06, torsoY + 0.24 - i * 0.12, 0.38, body); // 5버튼
    if (!girl) add(new THREE.CylinderGeometry(0.17, 0.19, 0.08, 14), M(C.charcoal), 0, torsoY + 0.36, 0, body); // 차이나칼라
    else add(new THREE.TorusGeometry(0.17, 0.035, 6, 16).rotateX(Math.PI / 2), M(C.white), 0, torsoY + 0.34, 0.02, body); // 둥근 깃
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.1, 0.11, 0.5, 8), M(C.charcoal), s * 0.42, torsoY - 0.02, 0, body).rotation.z = s * 0.25; add(new THREE.SphereGeometry(0.08, 8, 6), M(0xf3d6c2), s * 0.48, torsoY - 0.3, 0, body); }
  } else {
    add(new THREE.CylinderGeometry(0.35, 0.38, 0.62, 14), M(C.white, 0.6), 0, torsoY, 0, body); // 순백 셔츠
    add(new THREE.BoxGeometry(0.07, 0.56, 0.03), M(C.trim), 0, torsoY, 0.37, body); // 앞단 배색
    if (girl) add(new THREE.TorusGeometry(0.18, 0.045, 6, 16).rotateX(Math.PI / 2), M(C.trim), 0, torsoY + 0.32, 0.02, body); // 둥근 깃(회색)
    else for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.05, 0.12), M(C.trim), s * 0.09, torsoY + 0.32, 0.28, body).rotation.z = s * 0.4; // 셔츠 깃
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 8), M(C.white, 0.6), s * 0.42, torsoY + 0.15, 0, body).rotation.z = s * 0.6; add(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 8), M(0xf3d6c2), s * 0.47, torsoY - 0.1, 0, body).rotation.z = s * 0.2; }
  }
  // 머리: 사진처럼 크고 매끈한 주황 구(얼굴 없이)
  const head = add(new THREE.SphereGeometry(0.5, 24, 18), new THREE.MeshStandardMaterial({ color: C.head, roughness: 0.45 }), 0, torsoY + 0.78, 0, body);
  head.scale.set(1, 0.98, 1);
  g.userData = { body, girl, season, ph: hash(peer.id) % 100 };
  g.scale.setScalar(2.4); // 지도에서 보이도록 큼직하게
  return g;
}

// 살짝 숨쉬듯 흔들거리기
export function animateAvatar(g, t) {
  const u = g.userData;
  u.body.position.y = Math.abs(Math.sin(t * 2 + u.ph)) * 0.06;
  u.body.rotation.z = Math.sin(t * 1.3 + u.ph) * 0.05;
}
