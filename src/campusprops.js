import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { centroid } from './geom.js';

const merge = (geos) => mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));

// 스탠드 자리 깎기: 계단 높이를 따라 땅을 낮추고, 양 끝은 1:1 비탈로 자연스럽게 이어요(도랑이 안 생겨요).
export function carveStands(terrain, e, fieldY, N) {
  const { rise, depth } = STEP;
  const len = e.L * 0.78;
  const uMin = -len / 2 - 0.6, uMax = len / 2 + 4.4; // +x 끝에는 옆 계단
  const vEnd = 1.6 + N * depth;
  const R = Math.hypot(e.L, vEnd) / 2 + 20;
  // buildStands의 그룹 회전과 같은 축(그룹의 +x)
  const th = Math.atan2(e.nx, e.nz), lx = Math.cos(th), lz = -Math.sin(th);
  terrain.carve(e.mx - R, e.mx + R, e.mz - R, e.mz + R, (x, z) => {
    const dx = x - e.mx, dz = z - e.mz;
    const u = dx * lx + dz * lz, v = dx * e.nx + dz * e.nz;
    if (v < -1 || v > vEnd + 70) return null; // 뒤쪽 비탈은 원래 땅과 만날 때까지 이어져요
    const out = Math.max(uMin - u, u - uMax, 0);
    if (out > 12) return null;
    const step = Math.max(0, Math.min(N, Math.floor((v - 1.6) / depth) + 1));
    const base = v < 1.6 ? fieldY : v > vEnd ? fieldY + N * rise + (v - vEnd) * 0.55 : fieldY + step * rise - 0.15;
    return base + out * 0.7;
  });
}

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
export const STEP = { rise: 0.5, depth: 1.2 };
export function standSteps(fieldY, backY) {
  return Math.max(4, Math.min(24, Math.round((backY - fieldY) / STEP.rise)));
}
export function standFootprint(e, N = 7) {
  const len = e.L * 0.78 + 7, d0 = 1.2, d1 = 1.6 + N * STEP.depth + 0.6;
  const P = (u, v) => [e.mx + e.tx * u + e.nx * v, e.mz + e.tz * u + e.nz * v];
  return [P(-len / 2, d0), P(len / 2, d0), P(len / 2, d1), P(-len / 2, d1)];
}

// 운동장에서 본관 쪽 높이까지 올라가는 계단식 스탠드 + 옆 계단 + 흰 아치 지붕
export function buildStands(scene, e, fieldY, N) {
  const { L, tx, tz, nx, nz, mx, mz } = e;
  const g = new THREE.Group();
  const { rise, depth } = STEP;
  const len = L * 0.78;
  const seats = [], risers = [];
  for (let k = 0; k < N; k++) {
    const top = fieldY + rise * (k + 1);
    const h = top - (fieldY - 3);
    const box = new THREE.BoxGeometry(len, h, depth);
    box.translate(0, top - h / 2, 1.6 + k * depth + depth / 2);
    (k % 2 ? seats : risers).push(box);
  }
  const brick = new THREE.MeshStandardMaterial({ color: 0x9a5240, roughness: 0.85 });
  const brick2 = new THREE.MeshStandardMaterial({ color: 0xa96150, roughness: 0.85 });
  for (const [list, m] of [[seats, brick], [risers, brick2]]) {
    const mesh = new THREE.Mesh(merge(list), m);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  // 옆 계단(회색 콘크리트): 운동장에서 위쪽까지 가파르게
  const stairs = [];
  const sr = 0.18, sn = Math.round((rise * N) / sr), sp = (N * depth) / sn;
  for (let k = 0; k < sn; k++) {
    const top = fieldY + sr * (k + 1);
    const h = top - (fieldY - 3);
    const box = new THREE.BoxGeometry(3.6, h, sp);
    box.translate(len / 2 + 2.2, top - h / 2, 1.6 + k * sp + sp / 2);
    stairs.push(box);
  }
  const stairMesh = new THREE.Mesh(merge(stairs), new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.9 }));
  stairMesh.castShadow = stairMesh.receiveShadow = true;
  g.add(stairMesh);
  // 흰 아치 지붕(막 구조): 스탠드 가운데를 덮어요.
  const span = Math.min(10, N * depth * 0.55), R = span / 2;
  const arch = new THREE.CylinderGeometry(R, R, len * 0.35, 32, 1, true, 0, Math.PI);
  arch.rotateZ(Math.PI / 2);
  arch.scale(1, 0.75, 1);
  const zMid = 1.6 + span / 2;
  const yBase = fieldY + rise * (span / depth) + 1.6;
  const roof = new THREE.Mesh(arch, new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
  roof.position.set(0, yBase, zMid);
  roof.castShadow = true;
  g.add(roof);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd2, roughness: 0.4, metalness: 0.6 });
  for (const x of [-len * 0.17, 0, len * 0.17]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.08, 6, 24, Math.PI), ribMat);
    rib.rotation.y = Math.PI / 2;
    rib.scale.set(1, 0.75, 1);
    rib.position.set(x, yBase, zMid);
    g.add(rib);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, yBase - fieldY, 8), ribMat);
    leg.position.set(x, (yBase + fieldY) / 2, zMid - R);
    g.add(leg);
  }
  g.position.set(mx, 0, mz);
  g.rotation.y = Math.atan2(nx, nz);
  scene.add(g);
  return g;
}

// 아트플라자에서 미래관 쪽으로 단차를 두고 흐르는 물길 + 끝의 작은 연못
export class Stream {
  constructor(scene, terrain, fx, { path, width = 2.2, drop = 0.45, pond = [5, 3.4] }) {
    this.fx = fx;
    this.t = 0;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#3f8fb5';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.2})`;
      g.lineWidth = 1 + Math.random() * 1.5;
      const y = Math.random() * 128, x = Math.random() * 128;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 10, y - 4, x + 20, y + 4, x + 30, y); g.stroke();
    }
    this.tex = new THREE.CanvasTexture(c);
    this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const water = new THREE.MeshStandardMaterial({ map: this.tex, transparent: true, opacity: 0.88, roughness: 0.08, metalness: 0.2 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x8b8780, roughness: 0.95, flatShading: true });
    this.falls = [];
    const group = new THREE.Group();
    const pts = path;
    const n = pts.length - 1;
    // 칸마다 실제 땅 높이를 따라가되, 아래 칸으로 갈수록 최소 drop만큼 낮아지게
    const lv = [];
    for (let i = 0; i < n; i++) {
      const cx = (pts[i][0] + pts[i + 1][0]) / 2, cz = (pts[i][1] + pts[i + 1][1]) / 2;
      lv.push(terrain.heightAt(cx, cz) + 0.3);
    }
    for (let i = n - 2; i >= 0; i--) lv[i] = Math.max(lv[i], lv[i + 1] + drop);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const lvl = lv[i];
      const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
      const last = i === n - 1;
      const w = last ? pond[1] : width, len = last ? Math.max(L, pond[0]) : L;
      const ground = Math.min(terrain.heightAt(a[0], a[1]), terrain.heightAt(b[0], b[1]), terrain.heightAt(cx, cz)) - 1.2;
      const h = lvl + 0.25 - ground;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(len + 0.7, h, w + 0.9), stone);
      rim.position.set(cx, ground + h / 2, cz);
      rim.rotation.y = -ang;
      rim.castShadow = rim.receiveShadow = true;
      group.add(rim);
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2), water);
      surf.position.set(cx, lvl + 0.3, cz);
      surf.rotation.y = -ang;
      group.add(surf);
      if (!last) {
        const d = lvl - lv[i + 1];
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d + 0.1), water);
        fall.position.set(b[0], lv[i + 1] + 0.3 + d / 2, b[1]);
        fall.rotation.y = -ang + Math.PI / 2;
        group.add(fall);
        this.falls.push(new THREE.Vector3(b[0], lv[i + 1] + 0.35, b[1]));
      }
      // 연못 둘레 돌과 수초
      if (last) {
        for (let k = 0; k < 10; k++) {
          const a2 = (k / 10) * Math.PI * 2;
          const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.25), stone);
          r.position.set(cx + Math.cos(a2) * (len / 2 + 0.6), lvl + 0.35, cz + Math.sin(a2) * (w / 2 + 0.6));
          group.add(r);
        }
      }
    }
    const [sx, sz] = pts[0];
    const spout = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), stone);
    spout.position.set(sx, lv[0] + 0.9, sz);
    group.add(spout);
    scene.add(group);
    this.group = group;
  }

  update(dt) {
    this.t += dt;
    this.tex.offset.set(this.t * 0.25, this.t * 0.05);
    if (Math.random() < 0.5) {
      for (const p of this.falls) {
        this.fx.smoke.spawn(p.x + (Math.random() - 0.5) * 0.8, p.y, p.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6,
          new THREE.Color('#eaf6ff'), 0.35, 0.5, { grow: 0.6, drag: 2, alpha: 0.7 });
      }
    }
  }
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

// 분리수거장·소각장(하모니홀 뒤): 콘크리트 바닥, 수거함, 굴뚝 있는 소각로
export class Recycling {
  constructor(scene, terrain, fx, { center, angle = 0 }) {
    this.fx = fx;
    const g = new THREE.Group();
    const [cx, cz] = center;
    const y = terrain.heightAt(cx, cz);
    g.position.set(cx, y, cz);
    g.rotation.y = (-angle * Math.PI) / 180;
    const concrete = new THREE.MeshStandardMaterial({ color: 0xa7a49d, roughness: 0.95 });
    const add = (geo, m, x, yy, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, yy, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    add(new THREE.BoxGeometry(14, 1.2, 9), concrete, 0, -0.45, 0);
    const bins = [0x2f9e44, 0x2f6fe0, 0xf2c14e, 0x8a8f96];
    bins.forEach((c, i) => {
      add(new THREE.BoxGeometry(1.8, 1.5, 1.3), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), -5 + i * 2.2, 0.9, -2.6);
      add(new THREE.BoxGeometry(1.9, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: 0x333333 }), -5 + i * 2.2, 1.7, -2.6);
    });
    // 소각로 + 굴뚝
    add(new THREE.BoxGeometry(4.5, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0x7c7f84, roughness: 0.8 }), 4, 1.75, 1.5);
    add(new THREE.CylinderGeometry(0.45, 0.55, 8, 12), new THREE.MeshStandardMaterial({ color: 0x5d6168, roughness: 0.7 }), 5.2, 6.5, 2.4);
    add(new THREE.BoxGeometry(2.6, 0.2, 3.4), new THREE.MeshStandardMaterial({ color: 0x55585e }), -3.5, 2.6, 2.2);
    for (const [x, z] of [[-4.7, 0.7], [-2.3, 0.7], [-4.7, 3.7], [-2.3, 3.7]]) add(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), concrete, x, 1.3, z);
    this.chimney = new THREE.Vector3(5.2, 10.6, 2.4).applyEuler(g.rotation).add(g.position);
    scene.add(g);
    this.group = g;
  }

  update(dt) {
    if (Math.random() < dt * 3) {
      const p = this.chimney;
      this.fx.smoke.spawn(p.x, p.y, p.z, 0.6 + Math.random(), 2 + Math.random(), (Math.random() - 0.5), new THREE.Color('#9a9a9a'), 2.2, 5, { grow: 1.6, drag: 0.4, alpha: 0.45 });
    }
  }
}

// 운동장 네 모서리 조명탑(밤에 켜져요)
export class Floodlights {
  constructor(scene, terrain, box) {
    this.lights = [];
    this.heads = [];
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.8 });
    this.headMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff6dd, emissiveIntensity: 0 });
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff3d1, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const c = Math.cos(box.angle), s = Math.sin(box.angle);
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const u = su * (box.L / 2 + 3), v = sv * (box.W / 2 + 3);
      const x = box.cx + u * c - v * s, z = box.cz + u * s + v * c;
      const y = terrain.heightAt(x, z);
      const H = 20;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, H, 10), steel);
      pole.position.set(x, y + H / 2, z);
      pole.castShadow = true;
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 0.5), this.headMat);
      head.position.set(x, y + H + 0.6, z);
      head.lookAt(box.cx, y, box.cz);
      scene.add(head);
      this.heads.push(head);
      const target = new THREE.Object3D();
      target.position.set(box.cx + (x - box.cx) * 0.2, y, box.cz + (z - box.cz) * 0.2);
      scene.add(target);
      const L = new THREE.SpotLight(0xfff3d6, 0, 140, 0.75, 0.6, 1.2);
      L.position.copy(head.position);
      L.target = target;
      scene.add(L);
      this.lights.push(L);
      // 빛줄기(살짝)
      const dist = head.position.distanceTo(target.position);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(dist * 0.32, dist, 20, 1, true), this.beamMat);
      beam.position.copy(head.position).lerp(target.position, 0.5);
      beam.lookAt(target.position);
      beam.rotateX(Math.PI / 2);
      scene.add(beam);
    }
  }

  set(on) {
    for (const L of this.lights) L.intensity = on ? 900 : 0; // 예전 2600은 운동장이 하얗게 날아갔어요
    this.headMat.emissiveIntensity = on ? 1.6 : 0;
    this.beamMat.opacity = on ? 0.03 : 0;
  }
}

// 버스 정류장 "한빛고교"
export function buildBusStop(scene, terrain, at, yaw) {
  const g = new THREE.Group();
  const [x, z] = at;
  g.position.set(x, terrain.heightAt(x, z), z);
  g.rotation.y = yaw;
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b4a66, roughness: 0.4, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc3e6, transparent: true, opacity: 0.35, roughness: 0.05 });
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(5, 0.15, 2.2), steel, 0, 2.8, 0);
  for (const px of [-2.3, 2.3]) add(new THREE.BoxGeometry(0.12, 2.8, 0.12), steel, px, 1.4, -0.9);
  add(new THREE.BoxGeometry(4.6, 2.2, 0.06), glass, 0, 1.5, -1.0);
  add(new THREE.BoxGeometry(3.4, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a5a3b }), 0, 0.6, -0.6);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const k = c.getContext('2d');
  k.fillStyle = '#1f4fa8'; k.fillRect(0, 0, 256, 96);
  k.fillStyle = '#fff'; k.font = '800 40px "Pretendard Variable", Pretendard, sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
  k.fillText('한빛고교', 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  add(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8), steel, 3.2, 1.8, 0.4);
  const sign = add(new THREE.BoxGeometry(1.4, 0.55, 0.06), [0, 0, 0, 0, 1, 1].map((q) => (q ? new THREE.MeshBasicMaterial({ map: t }) : steel)), 3.2, 3.4, 0.4);
  sign.rotation.y = Math.PI / 2;
  scene.add(g);
  return g;
}
