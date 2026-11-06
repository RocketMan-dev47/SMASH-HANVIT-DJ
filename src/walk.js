import * as THREE from 'three';
import { pointInPolygon } from './geom.js';

// 신입생 투어: 1인칭으로 학교를 걸어 다녀요. 눈높이 1.7 m.
// PC: WASD·방향키 이동, Shift 달리기, 마우스 끌기로 둘러보기 / 폰: 왼쪽 조이스틱 + 화면 끌기
export class Walk {
  constructor(world) {
    this.w = world;
    this.active = false;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.near = null;
  }

  start(P, camera, controls) {
    this.w.cats?.realistic?.(true);
    this.active = true;
    this.controls = controls;
    controls.enabled = false;
    this.pos.set(P.x, 0, P.z);
    const d = new THREE.Vector3().subVectors(P, camera.position);
    this.yaw = Math.atan2(d.x, d.z);
    this.pitch = 0;
    this.w.ui.walkMode(true);
  }

  stop(camera) {
    this.w.cats?.realistic?.(false);
    if (!this.active) return;
    this.active = false;
    this.keys.clear();
    this.stick.x = this.stick.y = 0;
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    camera.position.copy(this.pos).addScaledVector(back, -60).add(new THREE.Vector3(0, 45, 0));
    this.controls.target.copy(this.pos);
    this.controls.enabled = true;
    this.controls.update();
    this.w.ui.walkMode(false);
  }

  key(code, down) {
    const map = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' };
    if (!map[code]) return false;
    down ? this.keys.add(map[code]) : this.keys.delete(map[code]);
    return true;
  }

  // 화면 끌기: 천천히 돌아가게 감도를 낮췄어요.
  look(dx, dy) {
    this.yaw -= dx * 0.0032;
    this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - dy * 0.0028));
  }

  blocked(x, z) {
    if (this.w.obstacles) return this.w.obstacles.blocked(x, z, 0.35);
    const T = this.w.terrain;
    if (!T.inside(x, z)) return true;
    for (const b of this.w.buildings.list) {
      if (b.launched || b.lostFraction() > 0.55) continue;
      if (x < b.minX - 0.3 || x > b.maxX + 0.3 || z < b.minZ - 0.3 || z > b.maxZ + 0.3) continue;
      if (pointInPolygon([x, z], b.poly)) return true;
    }
    return false;
  }

  // 텔레포트(안내 버튼): 건물 앞에서 건물을 바라보게
  goTo(b) {
    const xs = b.poly.map((p) => p[0]), zs = b.poly.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const f = this.w.focus || [0, 0];
    const dir = new THREE.Vector3(f[0] - cx, 0, f[1] - cz).normalize();
    let r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 8;
    let x = cx + dir.x * r, z = cz + dir.z * r;
    for (let k = 0; k < 10 && this.blocked(x, z); k++) { r += 4; x = cx + dir.x * r; z = cz + dir.z * r; }
    this.pos.set(x, 0, z);
    this.yaw = Math.atan2(cx - x, cz - z);
    this.pitch = 0.12;
  }

  update(dt, camera) {
    if (!this.active) return;
    const k = this.keys;
    const fwd = this.stick.y + (k.has('f') ? 1 : 0) - (k.has('b') ? 1 : 0);
    const side = this.stick.x + (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
    const sp = (k.has('run') ? 11 : 5) * dt;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const mv = f.multiplyScalar(Math.max(-1, Math.min(1, fwd))).add(r.multiplyScalar(Math.max(-1, Math.min(1, side))));
    if (mv.lengthSq() > 0) {
      mv.normalize().multiplyScalar(sp);
      if (!this.blocked(this.pos.x + mv.x, this.pos.z)) this.pos.x += mv.x;
      if (!this.blocked(this.pos.x, this.pos.z + mv.z)) this.pos.z += mv.z;
    }
    const gy = this.w.terrain.heightAt(this.pos.x, this.pos.z);
    this.pos.y = this.pos.y ? this.pos.y + (gy - this.pos.y) * Math.min(1, dt * 10) : gy;
    const look = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.w.onlineMode) {
      // 온라인: 내 아바타 어깨 너머로(뒤 3 m, 위 0.6 m)
      const eye = new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z), back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      camera.position.copy(eye).addScaledVector(back, -3).add(new THREE.Vector3(0, 0.6, 0));
      const gy2 = this.w.terrain.heightAt(camera.position.x, camera.position.z); if (camera.position.y < gy2 + 0.6) camera.position.y = gy2 + 0.6;
      camera.lookAt(eye.clone().addScaledVector(look, 6));
    } else {
      camera.position.set(this.pos.x, this.pos.y + 1.7, this.pos.z);
      camera.lookAt(camera.position.clone().add(look));
    }
    // 가까운 건물 안내
    let best = null, bd = 14;
    for (const b of this.w.buildings.list) {
      if (b.launched) continue;
      const xs = b.poly.map((p) => p[0]), zs = b.poly.map((p) => p[1]);
      const dx = Math.max(Math.min(...xs) - this.pos.x, 0, this.pos.x - Math.max(...xs));
      const dz = Math.max(Math.min(...zs) - this.pos.z, 0, this.pos.z - Math.max(...zs));
      const d = Math.hypot(dx, dz);
      if (d < bd && b.name) { bd = d; best = b; }
    }
    if (best !== this.near) { this.near = best; this.w.ui.walkNear(best); }
  }
}
