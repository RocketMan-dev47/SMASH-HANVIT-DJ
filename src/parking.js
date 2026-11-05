import * as THREE from 'three';
import { orientedBox, pointInPolygon } from './geom.js';

// 주차장: 긴 쪽을 따라 2.5 m × 5 m 칸을 두 줄(가운데 6 m 통로)로 나누고, 칸의 약 70%에 차를 세워요.
// 칸 계산은 땅 그림(주차선)과 차 배치가 같이 써요.
export function parkingSlots(poly) {
  const b = orientedBox(poly);
  if (b.L < 6 || b.W < 5) return [];
  const W2 = 2.5, D2 = 5, aisle = 6, best = [];
  // 두 방향(긴 쪽·짧은 쪽을 따라) 모두 해 보고 칸이 많은 쪽
  for (const turn of [0, Math.PI / 2]) {
    const ang = b.angle + turn, L = turn ? b.W : b.L, W = turn ? b.L : b.W;
    const u = [Math.cos(ang), Math.sin(ang)], v = [-u[1], u[0]];
    const out = [];
    // 등을 맞댄 두 줄 + 통로를 반복
    for (let y = -W / 2 + D2 / 2; y < W / 2; y += D2 * 2 + aisle) {
      for (const [off, face] of [[y, 1], [y + D2, -1]]) {
        for (let a = -L / 2 + W2 / 2; a < L / 2; a += W2) {
          const x = b.cx + u[0] * a + v[0] * off, z = b.cz + u[1] * a + v[1] * off;
          const corners = [[-W2 / 2, -D2 / 2], [W2 / 2, -D2 / 2], [W2 / 2, D2 / 2], [-W2 / 2, D2 / 2]].map(([p, q]) => [x + u[0] * p + v[0] * q, z + u[1] * p + v[1] * q]);
          if (corners.every((c) => pointInPolygon(c, poly))) out.push({ x, z, u, v, face, w: W2, d: D2, yaw: Math.atan2(v[0] * face, v[1] * face) });
        }
      }
    }
    if (out.length > best.length) { best.length = 0; best.push(...out); }
  }
  return best;
}

// 땅 그림에 주차선(흰 선) 그리기: GroundPainter 좌표(m)로 그려요.
export function paintParking(g, poly) {
  const slots = parkingSlots(poly);
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.12;
  for (const s of slots) {
    const hw = s.w / 2, hd = s.d / 2;
    const P = (a, b) => [s.x + s.u[0] * a + s.v[0] * b, s.z + s.u[1] * a + s.v[1] * b];
    // ㄷ자 칸(통로 쪽은 열림)
    const back = -hd * s.face, front = hd * s.face;
    const p1 = P(-hw, front), p2 = P(-hw, back), p3 = P(hw, back), p4 = P(hw, front);
    g.beginPath(); g.moveTo(...p1); g.lineTo(...p2); g.lineTo(...p3); g.lineTo(...p4); g.stroke();
  }
  // 통로 화살표 대신 장애인 칸 하나(파란 칸)
  if (slots.length > 6) {
    const s = slots[0], P = (a, b) => [s.x + s.u[0] * a + s.v[0] * b, s.z + s.u[1] * a + s.v[1] * b];
    g.fillStyle = 'rgba(30,90,200,0.45)';
    g.beginPath(); const c = [P(-1.15, -2.4), P(1.15, -2.4), P(1.15, 2.4), P(-1.15, 2.4)]; g.moveTo(...c[0]); for (const q of c.slice(1)) g.lineTo(...q); g.closePath(); g.fill();
  }
  g.restore();
}

// 실제 도로 위 자동차 색 비율(흰·검·회·은 위주)
const COLORS = [['#f2f2f0', 34], ['#16181b', 20], ['#6e7378', 17], ['#b8bcc0', 14], ['#1f3f7a', 6], ['#8c1d1d', 5], ['#3b4a3a', 2], ['#c7a46a', 2]];
const pickColor = (r) => { let t = r * 100; for (const [c, w] of COLORS) { if ((t -= w) <= 0) return c; } return COLORS[0][0]; };

export class ParkedCars {
  constructor(world, areas) {
    this.w = world;
    const T = world.terrain;
    const slots = areas.flatMap((poly) => parkingSlots(poly));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.cars = slots.filter(() => rnd() < 0.7).map((s) => ({ ...s, color: pickColor(rnd()), kind: rnd() < 0.25 ? 'suv' : 'sedan', alive: true }));
    const n = Math.max(1, this.cars.length);
    const body = new THREE.BoxGeometry(1.82, 0.72, 4.5).translate(0, 0.62, 0);
    const cabin = new THREE.BoxGeometry(1.6, 0.62, 2.3).translate(0, 1.28, -0.2);
    const glass = new THREE.BoxGeometry(1.62, 0.46, 2.32).translate(0, 1.3, -0.2);
    this.body = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 }), n);
    this.cabin = new THREE.InstancedMesh(cabin, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 }), n);
    this.glass = new THREE.InstancedMesh(glass, new THREE.MeshStandardMaterial({ color: 0x1d2530, roughness: 0.1, metalness: 0.4 }), n);
    this.wheel = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }), n * 4);
    this.stop = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.14, 0.22), new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 0.95 }), Math.max(1, slots.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), one = new THREE.Vector3(1, 1, 1);
    this.cars.forEach((c, i) => {
      const y = T.heightAt(c.x, c.z);
      // 대부분 앞으로 넣고, 일부는 후진 주차
      const yaw = c.yaw + (rnd() < 0.35 ? Math.PI : 0) + (rnd() - 0.5) * 0.06;
      const sx = c.kind === 'suv' ? 1.05 : 1, sy = c.kind === 'suv' ? 1.18 : 1;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      m.compose(new THREE.Vector3(c.x, y, c.z), q, new THREE.Vector3(sx, sy, 1));
      this.body.setMatrixAt(i, m); this.cabin.setMatrixAt(i, m); this.glass.setMatrixAt(i, m);
      col.set(c.color); this.body.setColorAt(i, col); this.cabin.setColorAt(i, col);
      c.m = m.clone(); c.y = y; c.q = q.clone();
      [[-0.86, 1.45], [0.86, 1.45], [-0.86, -1.45], [0.86, -1.45]].forEach(([wx, wz], k) => {
        const p = new THREE.Vector3(wx, 0.34, wz).applyQuaternion(q).add(new THREE.Vector3(c.x, y, c.z));
        m.compose(p, q, one); this.wheel.setMatrixAt(i * 4 + k, m);
      });
    });
    slots.forEach((s, i) => {
      const bx = s.x - s.v[0] * s.face * (s.d / 2 - 0.5), bz = s.z - s.v[1] * s.face * (s.d / 2 - 0.5);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
      m.compose(new THREE.Vector3(bx, T.heightAt(bx, bz) + 0.07, bz), q, one);
      this.stop.setMatrixAt(i, m);
    });
    for (const o of [this.body, this.cabin, this.glass, this.wheel, this.stop]) { o.castShadow = true; o.receiveShadow = true; world.scene.add(o); }
    // 주차장마다 가로등 2개
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b7077, roughness: 0.5, metalness: 0.6 });
    for (const poly of areas) {
      const b = orientedBox(poly);
      for (const t of [-0.35, 0.35]) {
        const x = b.cx + Math.cos(b.angle) * b.L * t, z = b.cz + Math.sin(b.angle) * b.L * t, y = T.heightAt(x, z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), poleMat); pole.position.set(x, y + 3.5, z); pole.castShadow = true; world.scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 1.1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0.4 })); lamp.position.set(x, y + 7.05, z); world.scene.add(lamp);
      }
    }
  }

  // 폭발 반경 안의 차는 사라져요(실제 파편은 폭발 효과가 맡아요)
  blast(P, R) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    let hit = 0;
    this.cars.forEach((c, i) => {
      if (!c.alive || Math.hypot(c.x - P.x, c.z - P.z) > R + 2) return;
      c.alive = false; hit++;
      for (const o of [this.body, this.cabin, this.glass]) o.setMatrixAt(i, zero);
      for (let k = 0; k < 4; k++) this.wheel.setMatrixAt(i * 4 + k, zero);
      this.w.fx?.debris?.(new THREE.Vector3(c.x, c.y + 1, c.z), 0.8);
    });
    if (hit) for (const o of [this.body, this.cabin, this.glass, this.wheel]) o.instanceMatrix.needsUpdate = true;
    return hit;
  }

  reset() {
    const one = new THREE.Vector3(1, 1, 1);
    this.cars.forEach((c, i) => { c.alive = true; for (const o of [this.body, this.cabin, this.glass]) o.setMatrixAt(i, c.m); });
    // 바퀴는 위치를 다시 계산
    const m = new THREE.Matrix4();
    this.cars.forEach((c, i) => [[-0.86, 1.45], [0.86, 1.45], [-0.86, -1.45], [0.86, -1.45]].forEach(([wx, wz], k) => { const p = new THREE.Vector3(wx, 0.34, wz).applyQuaternion(c.q).add(new THREE.Vector3(c.x, c.y, c.z)); m.compose(p, c.q, one); this.wheel.setMatrixAt(i * 4 + k, m); }));
    for (const o of [this.body, this.cabin, this.glass, this.wheel]) o.instanceMatrix.needsUpdate = true;
  }

  addObstacles(O) { for (const c of this.cars) O.addCircle(c.x, c.z, 2.0, 'car'); }
}
