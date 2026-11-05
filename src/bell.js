import * as THREE from 'three';
import { pointInPolygon } from './geom.js';

// 진짜 종소리 시간표: 수업 시작·끝에 종이 울리고, 쉬는 시간·점심엔 학생들이 나와요.
export const DEFAULT_PERIODS = [
  ['1교시', '08:40', '09:30'], ['2교시', '09:40', '10:30'], ['3교시', '10:40', '11:30'], ['4교시', '11:40', '12:30'],
  ['점심', '12:30', '13:30'], ['5교시', '13:30', '14:20'], ['6교시', '14:30', '15:20'], ['7교시', '15:30', '16:20'],
];
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// 지금 상태: { label, kind: 'class'|'break'|'lunch'|'off', until }
export function periodAt(date, periods = DEFAULT_PERIODS) {
  const day = date.getDay();
  if (day === 0 || day === 6) return { label: '주말', kind: 'off' };
  const m = date.getHours() * 60 + date.getMinutes();
  const P = periods.map(([n, a, b]) => [n, toMin(a), toMin(b)]);
  if (m < P[0][1] - 40 || m >= P[P.length - 1][2]) return { label: m < P[0][1] ? '등교 전' : '방과 후', kind: 'off' };
  if (m < P[0][1]) return { label: '등교 시간', kind: 'break', until: P[0][1] };
  for (let i = 0; i < P.length; i++) {
    const [n, a, b] = P[i];
    if (m >= a && m < b) return { label: n, kind: n === '점심' ? 'lunch' : 'class', until: b };
    if (P[i + 1] && m >= b && m < P[i + 1][1]) return { label: '쉬는 시간', kind: 'break', until: P[i + 1][1] };
  }
  return { label: '방과 후', kind: 'off' };
}

// 학생들(교복 입은 작은 사람들). 폭발이 나면 피하고 절대 다치지 않아요.
export class Students {
  constructor(world, spots, cafeteria, n = 40) {
    this.w = world;
    this.spots = spots;
    this.caf = cafeteria;
    this.body = new THREE.InstancedMesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.28, 0.9, 4, 8) : new THREE.CylinderGeometry(0.28, 0.28, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x1f2f57, roughness: 0.8 }), n);
    this.head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf0c9a8, roughness: 0.8 }), n);
    for (const m of [this.body, this.head]) { m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); world.scene.add(m); }
    this.items = [];
    for (let i = 0; i < n; i++) {
      const s = spots[Math.floor(Math.random() * spots.length)] || [0, 0];
      this.items.push({ p: new THREE.Vector3(s[0] + Math.random() * 4, 0, s[1] + Math.random() * 4), t: null, wait: Math.random() * 3, sp: 1.2 + Math.random() * 0.8 });
    }
    this.visible = false;
    this.mode = 'break';
    this.m = new THREE.Matrix4();
    this.setVisible(false);
  }

  setVisible(on, mode = 'break') {
    this.visible = on;
    this.mode = mode;
    this.body.visible = this.head.visible = on;
  }

  scare(P, R) {
    for (const s of this.items) {
      const d = Math.hypot(s.p.x - P.x, s.p.z - P.z);
      if (d > R + 15) continue;
      const away = new THREE.Vector3(s.p.x - P.x, 0, s.p.z - P.z).normalize().multiplyScalar(R + 18);
      s.t = s.p.clone().add(away);
      s.flee = 1.5;
      if (d < R) s.p.copy(s.t);
    }
  }

  update(dt) {
    if (!this.visible) return;
    const T = this.w.terrain;
    this.items.forEach((s, i) => {
      s.flee = Math.max(0, (s.flee || 0) - dt);
      if (!s.t) {
        s.wait -= dt;
        if (s.wait <= 0) {
          const dest = this.mode === 'lunch' && this.caf && Math.random() < 0.7 ? this.caf : this.spots[Math.floor(Math.random() * this.spots.length)];
          s.t = new THREE.Vector3(dest[0] + (Math.random() - 0.5) * 8, 0, dest[1] + (Math.random() - 0.5) * 8);
        }
      } else {
        const dx = s.t.x - s.p.x, dz = s.t.z - s.p.z, d = Math.hypot(dx, dz);
        if (d < 0.5) { s.t = null; s.wait = 1 + Math.random() * 5; }
        else { const sp = (s.flee ? 6 : s.sp) * dt; s.p.x += (dx / d) * Math.min(d, sp); s.p.z += (dz / d) * Math.min(d, sp); }
      }
      const y = T.heightAt(s.p.x, s.p.z);
      const bob = s.t ? Math.abs(Math.sin(performance.now() / 160 + i)) * 0.08 : 0;
      this.m.makeTranslation(s.p.x, y + 0.75 + bob, s.p.z);
      this.body.setMatrixAt(i, this.m);
      this.m.makeTranslation(s.p.x, y + 1.6 + bob, s.p.z);
      this.head.setMatrixAt(i, this.m);
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
  }
}

// 학생들이 돌아다닐 자리: 운동장 안과 건물 밖 학교 땅
export function studentSpots(boundary, pitch, buildings) {
  const out = [];
  const xs = boundary.map((p) => p[0]), zs = boundary.map((p) => p[1]);
  for (let k = 0; k < 600 && out.length < 60; k++) {
    const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
    if (!pointInPolygon([x, z], boundary)) continue;
    if (buildings.some((b) => pointInPolygon([x, z], b.poly))) continue;
    out.push([x, z]);
  }
  if (pitch) for (let k = 0; k < 20; k++) { const p = pitch[Math.floor(Math.random() * pitch.length)]; out.push(p); }
  return out;
}
