import * as THREE from 'three';
import { pointInPolygon } from './geom.js';

// 로봇개(Go2 느낌) + 등에 단 화염방사기. 앞이 +z. 길이 약 2.1 m(실물의 3배).
function dogModel() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.35, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.5, metalness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x5ac8fa });
  const tank = new THREE.MeshStandardMaterial({ color: 0xd8342c, roughness: 0.35, metalness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.9 });
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const body = new THREE.Group();
  body.position.y = 1.05;
  g.add(body);
  add(new THREE.BoxGeometry(0.9, 0.42, 1.75), shell, 0, 0, 0, body);
  add(new THREE.BoxGeometry(0.92, 0.12, 1.5), dark, 0, -0.22, 0, body);
  // 머리(센서) + 라이다 돔 + 눈 불빛
  add(new THREE.BoxGeometry(0.62, 0.3, 0.42), dark, 0, 0.02, 1.02, body);
  add(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 16), dark, 0, -0.08, 1.2, body).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.05, 8, 6), glow, 0.18 * s, 0.06, 1.24, body);
  // 화염방사기: 빨간 연료통 + 총열
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.9, 14), tank, -0.2, 0.42, -0.15, body).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.9, 14), tank, 0.2, 0.42, -0.15, body).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.2, 0.16, 0.5), dark, 0, 0.45, 0.45, body);
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 10), steel, 0, 0.47, 0.95, body).rotation.x = Math.PI / 2;
  const nozzle = new THREE.Object3D();
  nozzle.position.set(0, 0.47, 1.42);
  body.add(nozzle);
  // 다리 4개(허벅지·종아리)
  const legs = [];
  for (const [x, z] of [[-0.48, 0.62], [0.48, 0.62], [-0.48, -0.62], [0.48, -0.62]]) {
    const hip = new THREE.Group();
    hip.position.set(x, -0.1, z);
    body.add(hip);
    add(new THREE.BoxGeometry(0.16, 0.5, 0.18), dark, 0, -0.25, 0, hip);
    const knee = new THREE.Group();
    knee.position.set(0, -0.5, 0);
    hip.add(knee);
    add(new THREE.BoxGeometry(0.1, 0.48, 0.1), steel, 0, -0.24, 0, knee);
    add(new THREE.SphereGeometry(0.08, 8, 6), dark, 0, -0.5, 0, knee);
    legs.push({ hip, knee, phase: (x < 0) === (z > 0) ? 0 : Math.PI });
  }
  g.userData = { body, legs, nozzle };
  return g;
}

export class RoboDog {
  constructor(world) {
    this.w = world;
    this.g = dogModel();
    this.g.visible = false;
    world.scene.add(this.g);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.active = false;
    this.flaming = false;
    this.input = { x: 0, y: 0, keys: new Set() };
    this.t = 0;
    this.tick = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.light = new THREE.PointLight(0xff8a3a, 0, 30, 2);
    world.scene.add(this.light);
  }

  // 누른 곳에 로봇개를 내려놓고 조종을 시작해요.
  start(P, controls, camera) {
    if (!this.g.visible) {
      this.pos.copy(P);
      this.yaw = Math.atan2(camera.position.x - P.x, camera.position.z - P.z) + Math.PI;
      this.g.visible = true;
      this.w.fx.dust(P, 2);
    }
    this.active = true;
    this.controls = controls;
    this.saved = { pos: camera.position.clone(), target: controls.target.clone() };
    this.camPos.copy(camera.position);
    this.camLook.copy(controls.target);
    controls.enabled = false;
    this.w.ui.dogMode(true);
  }

  stop(camera) {
    if (!this.active) return;
    this.active = false;
    this.setFlame(false);
    this.input.keys.clear();
    this.input.x = this.input.y = 0;
    // 보던 자리 대신 로봇개 근처를 내려다보게 돌아가요.
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    camera.position.copy(this.pos).addScaledVector(back, -45).add(new THREE.Vector3(0, 38, 0));
    this.controls.target.copy(this.pos);
    this.controls.enabled = true;
    this.controls.update();
    this.w.ui.dogMode(false);
  }

  setFlame(on) {
    if (this.flaming === on) return;
    this.flaming = on;
    this.w.sound.flame(on);
  }

  key(code, down) {
    const map = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    if (map[code]) { down ? this.input.keys.add(map[code]) : this.input.keys.delete(map[code]); return true; }
    if (code === 'Space') { this.setFlame(down); return true; }
    return false;
  }

  // 몸통(반지름 1.1 m)과 머리 끝(앞 1 m)이 모두 비어 있어야 지나가요.
  blocked(x, z) {
    const O = this.w.obstacles;
    if (!O) return !this.w.terrain.inside(x, z) || this.w.buildings.list.some((b) => !b.launched && b.lostFraction() <= 0.55 && pointInPolygon([x, z], b.poly));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    // 몸통 가운데 + 머리 끝 + 엉덩이 끝 세 곳을 봐요(옆으로 돌 때 꼬리가 벽에 박히지 않게).
    return O.blocked(x, z, 1.1, { treesToo: true }) || O.blocked(x + fx * 1.0, z + fz * 1.0, 0.5) || O.blocked(x - fx * 0.9, z - fz * 0.9, 0.5);
  }

  unstick() {
    for (let r = 1; r <= 14; r += 1) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, x = this.pos.x + Math.cos(a) * r, z = this.pos.z + Math.sin(a) * r;
        if (!this.blocked(x, z)) { this.pos.x = x; this.pos.z = z; return; }
      }
    }
  }

  update(dt, camera) {
    const w = this.w;
    if (!this.g.visible) return;
    this.t += dt;
    const k = this.input.keys;
    let fwd = this.input.y + (k.has('f') ? 1 : 0) - (k.has('b') ? 1 : 0);
    let turn = this.input.x + (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
    if (!this.active) { fwd = 0; turn = 0; }
    fwd = Math.max(-1, Math.min(1, fwd));
    turn = Math.max(-1, Math.min(1, turn));
    // 회전은 천천히(화면이 빨리 돌지 않게)
    this.turnV = (this.turnV || 0) + (turn * 1.25 - (this.turnV || 0)) * Math.min(1, dt * 4);
    this.yaw -= this.turnV * dt;
    const target = fwd * 6;
    this.speed += (target - this.speed) * Math.min(1, dt * 6);
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const nx = this.pos.x + dir.x * this.speed * dt, nz = this.pos.z + dir.z * this.speed * dt;
    if (!this.blocked(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (!this.blocked(nx, this.pos.z)) { this.pos.x = nx; this.speed *= 0.8; } // 벽을 따라 미끄러지기
    else if (!this.blocked(this.pos.x, nz)) { this.pos.z = nz; this.speed *= 0.8; }
    else this.speed *= 0.3;
    // 무너진 조각이 다시 쌓이거나 처음 내려앉은 곳이 막혀 있으면, 가까운 빈 곳으로 살짝 밀려나요.
    if (this.blocked(this.pos.x, this.pos.z)) this.unstick();
    this.pos.y = w.terrain.heightAt(this.pos.x, this.pos.z);
    this.g.position.copy(this.pos);
    this.g.rotation.y = this.yaw;
    // 걸음(대각선 다리끼리 같이 움직이는 트롯)
    const { legs, body, nozzle } = this.g.userData;
    const moving = Math.min(1, Math.abs(this.speed) / 3 + Math.abs(turn) * 0.5);
    const ph = this.t * 11;
    for (const L of legs) {
      const s = Math.sin(ph + L.phase) * moving;
      L.hip.rotation.x = s * 0.5 - (this.active ? 0 : 0.35);
      L.knee.rotation.x = -Math.max(0, -Math.cos(ph + L.phase)) * 0.7 * moving + (this.active ? 0 : 0.7);
    }
    body.position.y = (this.active ? 1.05 : 0.8) + Math.abs(Math.sin(ph)) * 0.04 * moving;
    // 화염
    if (this.flaming && this.active) {
      this.flameTime = (this.flameTime || 0) + dt;
      const n = new THREE.Vector3();
      nozzle.getWorldPosition(n);
      for (let i = 0; i < 7; i++) {
        const sp = 14 + Math.random() * 10;
        const spread = 0.18;
        const v = dir.clone().multiplyScalar(sp).add(new THREE.Vector3((Math.random() - 0.5) * sp * spread, (Math.random() - 0.3) * sp * spread, (Math.random() - 0.5) * sp * spread));
        const c = i < 2 ? new THREE.Color('#fff3b0') : new THREE.Color(['#ffd166', '#ff9f43', '#ff6b2c', '#e2451f'][i % 4]);
        w.fx.fire.spawn(n.x, n.y, n.z, v.x, v.y, v.z, c, 0.5 + Math.random() * 0.5, 0.45 + Math.random() * 0.25, { grow: 4.5, drag: 1.6, grav: -2 });
      }
      if (Math.random() < 0.4) w.fx.smoke.spawn(n.x + dir.x * 6, n.y + 1, n.z + dir.z * 6, dir.x * 2, 3, dir.z * 2, new THREE.Color('#4b4540'), 2, 1.8, { grow: 2, drag: 1, alpha: 0.5 });
      this.light.position.copy(n).addScaledVector(dir, 3);
      this.light.intensity = 260 + Math.random() * 120;
      this.tick -= dt;
      if (this.tick <= 0) {
        this.tick = 0.12;
        for (const d of [3.5, 6.5]) {
          const P = new THREE.Vector3(n.x + dir.x * d, n.y - 0.3, n.z + dir.z * d);
          w.explode(P, { tool: 'robodog', R: 2.2, power: 9, fx: false, sound: false, crater: false, scorchR: 1.1, weight: 0.08, quiet: true });
        }
      }
    } else {
      this.light.intensity = 0;
    }
    if (this.active) {
      // 3인칭 카메라: 로봇개 뒤에서 살짝 위
      const want = this.pos.clone().addScaledVector(dir, -9).add(new THREE.Vector3(0, 4.8, 0));
      const look = this.pos.clone().addScaledVector(dir, 5).add(new THREE.Vector3(0, 1.2, 0));
      this.camPos.lerp(want, 1 - Math.exp(-dt * 2.6));
      this.camLook.lerp(look, 1 - Math.exp(-dt * 4));
      camera.position.copy(this.camPos);
      camera.lookAt(this.camLook);
    }
  }

  reset() {
    this.g.visible = false;
    this.setFlame(false);
  }
}
