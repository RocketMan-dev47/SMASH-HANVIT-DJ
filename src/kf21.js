import * as THREE from 'three';

// KF-21 보라매(단순화 모형). 기수는 +z 방향, 길이 약 17 m.
function roundel() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  // 태극 문양
  g.fillStyle = '#cd2e3a';
  g.beginPath(); g.arc(64, 64, 50, Math.PI, 0); g.arc(89, 64, 25, 0, Math.PI, true); g.arc(39, 64, 25, 0, Math.PI); g.fill();
  g.fillStyle = '#0047a0';
  g.beginPath(); g.arc(64, 64, 50, 0, Math.PI); g.arc(39, 64, 25, Math.PI, 0, true); g.arc(89, 64, 25, Math.PI, 0); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeKF21() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x8e979f, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4047, roughness: 0.6, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2b33, roughness: 0.05, metalness: 0.9 });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };

  // 동체: 옆에서 본 단면을 회전시킨 몸통
  const prof = [[0, -8.4], [0.55, -7.9], [0.85, -6.5], [0.95, -3], [1.0, 2], [0.95, 5], [0.75, 7], [0.35, 8.3], [0.02, 8.9]]
    .map(([r, z]) => new THREE.Vector2(r, z));
  const body = add(new THREE.LatheGeometry(prof, 20), skin);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.25, 1, 0.8);
  // 조종석 캐노피
  const can = add(new THREE.SphereGeometry(1, 20, 12), glass, 0, 0.62, 4.6);
  can.scale.set(0.5, 0.42, 1.7);
  // 공기 흡입구
  for (const x of [-1.15, 1.15]) add(new THREE.BoxGeometry(0.55, 0.75, 3.2), dark, x, -0.25, 1.6);
  // 주날개(뒤로 젖힌 사다리꼴)
  const wing = new THREE.Shape([new THREE.Vector2(0, 2.4), new THREE.Vector2(5.4, -1.4), new THREE.Vector2(5.4, -2.6), new THREE.Vector2(0, -3.4)]);
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.16, bevelEnabled: false }).rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const w = add(wingGeo, skin, 0.6 * s, 0.05, 0);
    w.scale.x = s;
  }
  // 수평 꼬리날개
  const tail = new THREE.Shape([new THREE.Vector2(0, -4.6), new THREE.Vector2(2.6, -6.8), new THREE.Vector2(2.6, -7.6), new THREE.Vector2(0, -7.9)]);
  const tailGeo = new THREE.ExtrudeGeometry(tail, { depth: 0.12, bevelEnabled: false }).rotateX(Math.PI / 2);
  for (const s of [-1, 1]) add(tailGeo, skin, 0.9 * s, 0.05, 0).scale.x = s;
  // 바깥으로 기운 수직 꼬리날개 두 장
  const fin = new THREE.Shape([new THREE.Vector2(0, -3.8), new THREE.Vector2(0, -7.4), new THREE.Vector2(2.8, -7.8), new THREE.Vector2(2.8, -6.2)]);
  // shape의 x는 높이(위), y는 앞뒤가 되도록 세워요.
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.12, bevelEnabled: false }).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
  for (const s of [-1, 1]) add(finGeo, skin, 0.95 * s, 0.6, 0).rotation.z = -s * 0.42;
  // 쌍발 엔진 노즐 + 애프터버너 불빛
  const burners = [];
  for (const x of [-0.55, 0.55]) {
    add(new THREE.CylinderGeometry(0.42, 0.38, 0.8, 16, 1, true).rotateX(Math.PI / 2), dark, x, -0.05, -8.6);
    const flame = add(new THREE.ConeGeometry(0.36, 3.2, 14, 1, true).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      color: 0xffb066, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
    }), x, -0.05, -10.6);
    flame.castShadow = false;
    burners.push(flame);
  }
  // 태극 마크
  const mark = new THREE.MeshBasicMaterial({ map: roundel(), transparent: true });
  for (const s of [-1, 1]) {
    const m = add(new THREE.CircleGeometry(0.75, 24).rotateX(-Math.PI / 2), mark, 3.6 * s, 0.15, -1.3);
    m.castShadow = false;
  }
  g.userData.burners = burners;
  return g;
}
