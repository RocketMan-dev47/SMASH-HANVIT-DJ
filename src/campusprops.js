import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { centroid } from './geom.js';

const merge = (geos) => mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));

// 운동장 변 중 본관을 바라보는 가장 긴 변
export function pickStandEdge(pitch, mainPoly) {
  const pc = centroid(pitch);
  const mc = centroid(mainPoly);
  let best = null;
  for (let i = 0; i < pitch.length; i++) {
    const a = pitch[i], b = pitch[(i + 1) % pitch.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    let nx = tz, nz = -tx;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if ((mx - pc[0]) * nx + (mz - pc[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const toMain = ((mc[0] - mx) * nx + (mc[1] - mz) * nz) / Math.hypot(mc[0] - mx, mc[1] - mz);
    if (toMain > 0.5 && (!best || L > best.L)) best = { i, a, b, L, tx, tz, nx, nz, mx, mz };
  }
  return best;
}

// 스탠드가 차지하는 땅(나무를 안 심으려고)
export function standFootprint(e) {
  const len = e.L * 0.78, d0 = 1.2, d1 = 11.5;
  const P = (u, v) => [e.mx + e.tx * u + e.nx * v, e.mz + e.tz * u + e.nz * v];
  return [P(-len / 2, d0), P(len / 2, d0), P(len / 2, d1), P(-len / 2, d1)];
}

// 운동장에서 본관 쪽으로 올라가는 계단식 스탠드 + 흰 아치 지붕
export function buildStands(scene, terrain, pitch, mainPoly) {
  const best = pickStandEdge(pitch, mainPoly);
  if (!best) return null;
  const { L, tx, tz, nx, nz, mx, mz } = best;
  const fieldY = terrain.heightAt(mx - nx * 3, mz - nz * 3);
  const ang = Math.atan2(tz, tx);
  const g = new THREE.Group();
  const steps = [];
  const N = 7, depth = 1.3, rise = 0.45, len = L * 0.78;
  for (let k = 0; k < N; k++) {
    const top = fieldY + rise * (k + 1);
    const h = top - (fieldY - 3);
    const box = new THREE.BoxGeometry(len, h, depth);
    box.translate(0, top - h / 2, 1.6 + k * depth + depth / 2);
    steps.push(box);
  }
  const stepMesh = new THREE.Mesh(merge(steps), new THREE.MeshStandardMaterial({ color: 0x9a5240, roughness: 0.85 }));
  stepMesh.castShadow = stepMesh.receiveShadow = true;
  g.add(stepMesh);
  // 흰 아치 지붕(막 구조): 스탠드 가운데를 덮어요.
  const span = N * depth + 1.5, R = span / 2;
  const arch = new THREE.CylinderGeometry(R, R, len * 0.4, 32, 1, true, 0, Math.PI);
  arch.rotateZ(Math.PI / 2);
  arch.scale(1, 0.75, 1);
  const roof = new THREE.Mesh(arch, new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
  roof.position.set(0, fieldY + rise * N * 0.5 + 1.4, 1.6 + span / 2 - 0.8);
  roof.castShadow = true;
  g.add(roof);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd2, roughness: 0.4, metalness: 0.6 });
  for (const x of [-len * 0.2, 0, len * 0.2]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.08, 6, 24, Math.PI), ribMat);
    rib.rotation.y = Math.PI / 2;
    rib.scale.set(1, 0.75, 1);
    rib.position.set(x, roof.position.y, roof.position.z);
    g.add(rib);
  }
  g.position.set(mx, 0, mz);
  // 그룹의 +z가 운동장 바깥(본관 쪽)을 향하도록 돌려요.
  g.rotation.y = Math.atan2(nx, nz);
  scene.add(g);
  return { group: g, edge: best, angle: ang };
}

// 운동장 둘레 공 막이 그물(초록 철망)
export function buildFence(scene, terrain, pitch, low = null) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g2 = c.getContext('2d');
  g2.strokeStyle = 'rgba(40,110,70,0.9)';
  g2.lineWidth = 2;
  for (let i = -64; i < 128; i += 10) {
    g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i + 64, 64); g2.stroke();
    g2.beginPath(); g2.moveTo(i + 64, 0); g2.lineTo(i, 64); g2.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const netMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.9 });
  const posts = [];
  const nets = [];
  const pc = centroid(pitch);
  for (let i = 0; i < pitch.length; i++) {
    const a = pitch[i], b = pitch[(i + 1) % pitch.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4) continue;
    const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    let nx = tz, nz = -tx;
    if (((a[0] + b[0]) / 2 - pc[0]) * nx + ((a[1] + b[1]) / 2 - pc[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const isLow = low && low === i;
    const H = isLow ? 1.4 : 6;
    const ax = a[0] + nx * 1.2, az = a[1] + nz * 1.2;
    const y0 = terrain.heightAt(ax + tx * L / 2, az + tz * L / 2);
    for (let s = 0; s <= L; s += 5) {
      const px = ax + tx * s, pz = az + tz * s;
      const p = new THREE.CylinderGeometry(0.06, 0.06, H, 6);
      p.translate(px, y0 + H / 2, pz);
      posts.push(p);
    }
    const net = new THREE.PlaneGeometry(L, H);
    net.rotateY(-Math.atan2(tz, tx));
    net.translate(ax + tx * L / 2, y0 + H / 2, az + tz * L / 2);
    const uv = net.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * L / 3, uv.getY(k) * H / 3);
    nets.push(net);
  }
  const postMesh = new THREE.Mesh(merge(posts), new THREE.MeshStandardMaterial({ color: 0x2c5a3e, roughness: 0.6, metalness: 0.4 }));
  const netMesh = new THREE.Mesh(merge(nets), netMat);
  postMesh.castShadow = true;
  scene.add(postMesh, netMesh);
  return { postMesh, netMesh };
}

// 한빛고 명물 거북바위: 산으로 이어지는 쪽에 앉아 있는 귀여운 돌 거북
export function buildTurtleRock(scene, terrain, at, faceTo) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x6f6a61, roughness: 1, flatShading: true });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.SphereGeometry(2.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 0.3, 0).scale.set(1, 0.72, 1.12);
  for (const [x, z] of [[0, 0], [1.2, 0.9], [-1.2, 0.9], [1.2, -0.9], [-1.2, -0.9], [0, 1.7], [0, -1.7]]) {
    add(new THREE.SphereGeometry(0.75, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), dark, x, 1.0 + (x === 0 && z === 0 ? 0.65 : 0.2), z).scale.set(1, 0.35, 1);
  }
  add(new THREE.SphereGeometry(0.85, 10, 8), stone, 0, 0.9, 3.0).scale.set(1, 0.85, 1.1);
  const eye = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.13, 8, 6), eye, 0.38 * s, 1.15, 3.75);
    add(new THREE.SphereGeometry(0.04, 6, 4), shine, 0.42 * s, 1.21, 3.86);
  }
  add(new THREE.TorusGeometry(0.16, 0.03, 6, 10, Math.PI), eye, 0, 0.82, 3.88).rotation.z = Math.PI;
  for (const [x, z] of [[1.9, 1.5], [-1.9, 1.5], [1.9, -1.5], [-1.9, -1.5]]) add(new THREE.SphereGeometry(0.55, 8, 6), stone, x, 0.35, z).scale.set(1, 0.6, 1.2);
  add(new THREE.ConeGeometry(0.3, 0.9, 6), stone, 0, 0.4, -3.0).rotation.x = -Math.PI / 2;
  const [x, z] = at;
  g.position.set(x, terrain.heightAt(x, z) - 0.2, z);
  g.rotation.y = Math.atan2(faceTo[0] - x, faceTo[1] - z);
  const el = document.createElement('div');
  el.className = 'bldg-label';
  el.textContent = '거북바위';
  const label = new CSS2DObject(el);
  label.position.set(0, 4.2, 0);
  g.add(label);
  scene.add(g);
  return { group: g, label };
}

// 지층 단면에 박힌 암모나이트 화석: 만든 사람 이스터에그
export function buildFossil(scene, terrain, text = 'Made By. @eh._.p_09') {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const cx = 260, cy = 250;
  // 암모나이트 나선(로그 나선) + 갈비 무늬
  const pt = (t) => { const r = 14 * Math.exp(0.19 * t); return [cx + r * Math.cos(t), cy + r * Math.sin(t), r]; };
  g.fillStyle = 'rgba(214,196,160,0.95)';
  g.beginPath(); g.arc(cx, cy, 200, 0, Math.PI * 2); g.fill();
  g.lineCap = 'round';
  for (let t = 0; t < 16.2; t += 0.05) {
    const [x, y, r] = pt(t);
    if (Math.round(t * 20) % 5 === 0) {
      const [x2, y2] = pt(t - Math.PI * 2);
      g.strokeStyle = 'rgba(120,96,64,0.55)';
      g.lineWidth = Math.max(1.5, r * 0.05);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    }
  }
  g.strokeStyle = 'rgba(96,74,48,0.85)';
  g.lineWidth = 6;
  g.beginPath();
  for (let t = 0; t < 16.2; t += 0.04) { const [x, y] = pt(t); t === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
  g.strokeStyle = 'rgba(255,245,225,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  for (let t = 0; t < 16.2; t += 0.04) { const [x, y] = pt(t); t === 0 ? g.moveTo(x - 2, y - 2) : g.lineTo(x - 2, y - 2); }
  g.stroke();
  // 새겨진 글씨
  g.font = '700 64px "Pretendard Variable", Pretendard, -apple-system, sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,240,215,0.35)';
  g.fillText(text, 492, 252);
  g.fillStyle = 'rgba(70,52,34,0.9)';
  g.fillText(text, 490, 250);
  g.font = '500 30px "Pretendard Variable", Pretendard, -apple-system, sans-serif';
  g.fillStyle = 'rgba(70,52,34,0.75)';
  g.fillText('신생대 한빛기 · 지층 화석', 492, 318);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshStandardMaterial({
    map: tex, transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  // 처음 보는 쪽(남쪽) 지층 단면 가운데쯤
  const x = terrain.x0 + terrain.w * 0.62, z = terrain.z0 + terrain.d + 0.12;
  mesh.position.set(x, terrain.bottom + 6, z);
  scene.add(mesh);
  return mesh;
}
