import * as THREE from 'three';
import { pointInPolygon } from './geom.js';
import { sleighModel } from './xmas.js';

const ROADS = new Set(['service', 'footway', 'path', 'pedestrian', 'residential', 'unclassified', 'living_street', 'track', 'tertiary']);

// 학교 안 길 중 가장 긴 길을 고릅니다. 이어진 길 조각은 하나로 이어 붙여요.
export function findCartPath(campus, terrain) {
  const inside = (p) => (campus.boundary ? pointInPolygon(p, campus.boundary) : Math.hypot(p[0], p[1]) < 200);
  const segs = [];
  for (const r of campus.roads || []) {
    if (!ROADS.has(r.kind)) continue;
    const pts = r.pts.filter((p) => terrain.inside(p[0], p[1]));
    if (pts.length < 2) continue;
    if (pts.filter(inside).length / pts.length < 0.6) continue;
    segs.push(pts.map((p) => [p[0], p[1]]));
  }
  const key = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < segs.length; i++) {
      for (let j = 0; j < segs.length; j++) {
        if (i === j) continue;
        const a = segs[i], b = segs[j];
        let joined = null;
        if (key(a[a.length - 1]) === key(b[0])) joined = a.concat(b.slice(1));
        else if (key(a[a.length - 1]) === key(b[b.length - 1])) joined = a.concat(b.slice(0, -1).reverse());
        if (joined) {
          segs[i] = joined;
          segs.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  let best = null, bestL = 0;
  for (const s of segs) {
    let L = 0;
    for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    if (L > bestL) { bestL = L; best = s; }
  }
  return bestL >= 35 ? best : null;
}

function buildModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.45, metalness: 0.05 });
  const seat = new THREE.MeshStandardMaterial({ color: 0xc9b48f, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.7 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(1.25, 0.45, 2.3), white, 0, 0.58, 0);
  add(new THREE.BoxGeometry(1.25, 0.4, 0.55), white, 0, 0.98, 0.9);
  add(new THREE.BoxGeometry(1.15, 0.15, 0.62), seat, 0, 0.9, -0.05);
  add(new THREE.BoxGeometry(1.15, 0.55, 0.14), seat, 0, 1.2, -0.38);
  add(new THREE.BoxGeometry(1.4, 0.08, 2.0), white, 0, 2.08, -0.05);
  for (const [x, z] of [[-0.58, 0.72], [0.58, 0.72], [-0.58, -0.9], [0.58, -0.9]]) add(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 6), dark, x, 1.46, z);
  const wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 14);
  wheel.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.63, 0.8], [0.63, 0.8], [-0.63, -0.8], [0.63, -0.8]]) add(wheel, dark, x, 0.3, z);
  add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16).rotateX(-1.1), dark, -0.3, 1.25, 0.55);
  return g;
}

export class GolfCart {
  constructor(scene, terrain, fx, path) {
    this.scene = scene;
    this.terrain = terrain;
    this.fx = fx;
    this.path = path;
    this.cum = [0];
    for (let i = 1; i < path.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    this.L = this.cum[this.cum.length - 1];
    this.model = buildModel();
    this.kind = 'cart';
    this.lift = 0;
    this.model.rotation.order = 'YXZ';
    scene.add(this.model);
    this.vel = new THREE.Vector3();
    this.spin = new THREE.Vector3();
    this.respawn();
  }

  // 'cart'(골프 카트) 또는 'sleigh'(루돌프 썰매: 살짝 떠서 달려요)
  setModel(kind) {
    if (this.kind === kind) return;
    this.kind = kind;
    while (this.model.children.length) this.model.remove(this.model.children[0]);
    const src = kind === 'sleigh' ? sleighModel() : buildModel();
    for (const c of [...src.children]) this.model.add(c);
    this.lift = kind === 'sleigh' ? 1.4 : 0;
  }

  respawn() {
    this.s = 0;
    this.dir = 1;
    this.pause = 0;
    this.state = 'drive';
    this.model.rotation.set(0, 0, 0);
    this.place();
  }

  at(s) {
    s = Math.max(0, Math.min(this.L, s));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const a = this.path[i - 1], b = this.path[i];
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const t = (s - this.cum[i - 1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg };
  }

  place() {
    const p = this.at(this.s);
    const dx = p.dx * this.dir, dz = p.dz * this.dir;
    // 오른쪽 차선으로 달립니다.
    const x = p.x - dz * 0.9, z = p.z + dx * 0.9;
    const T = this.terrain;
    const hf = T.heightAt(x + dx * 1.2, z + dz * 1.2), hb = T.heightAt(x - dx * 1.2, z - dz * 1.2);
    const bob = this.lift ? Math.sin(performance.now() / 300) * 0.35 : Math.sin(performance.now() / 90) * 0.015;
    this.model.position.set(x, T.heightAt(x, z) + (this.lift || 0) + bob, z);
    this.model.rotation.set(-Math.atan2(hf - hb, 2.4), Math.atan2(dx, dz), 0);
  }

  update(dt) {
    if (this.state === 'drive') {
      if (this.pause > 0) {
        this.pause -= dt;
        if (this.pause <= 0) this.dir *= -1;
      } else {
        this.s += this.dir * 4.2 * dt;
        if (this.s >= this.L || this.s <= 0) { this.s = Math.max(0, Math.min(this.L, this.s)); this.pause = 1.4; }
      }
      this.place();
    } else if (this.state === 'fly') {
      const m = this.model;
      this.vel.y -= 15 * dt;
      m.position.addScaledVector(this.vel, dt);
      m.rotation.x += this.spin.x * dt; m.rotation.y += this.spin.y * dt; m.rotation.z += this.spin.z * dt;
      const T = this.terrain;
      if (!T.inside(m.position.x, m.position.z)) {
        if (m.position.y < T.bottom - 60) { this.state = 'wreck'; this.timer = 4; m.visible = false; }
        return;
      }
      const g = T.heightAt(m.position.x, m.position.z) + 0.4;
      if (m.position.y < g) {
        m.position.y = g;
        if (this.vel.y < -4) { this.vel.y *= -0.25; this.fx.dust(m.position, 2); } else this.vel.y = 0;
        this.vel.x *= 0.6; this.vel.z *= 0.6;
        this.spin.multiplyScalar(0.55);
        if (this.vel.lengthSq() < 0.5) { this.state = 'wreck'; this.timer = 7; }
      }
    } else if (this.state === 'wreck') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.model.visible = true;
        this.respawn();
        this.fx.dust(this.model.position, 2.5);
      }
    }
  }

  // 폭발에 휘말리면 날아갑니다. 처음 날아갈 때만 true.
  blast(P, R, power) {
    const m = this.model;
    const d = m.position.distanceTo(P);
    if (d > R + 2.5 || !m.visible) return false;
    const k = 1 - d / (R + 2.5);
    const away = m.position.clone().sub(P);
    away.y = 0;
    if (away.lengthSq() < 0.5) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    away.normalize();
    // 빙글빙글 돌며 포물선으로 날아가요(너무 높이는 안 가게).
    this.vel.copy(away).multiplyScalar(power * 0.45 * (0.6 + k)).add(new THREE.Vector3(0, Math.min(22, power * 0.4 * (0.7 + k)), 0));
    this.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 12);
    const first = this.state === 'drive';
    if (first) m.position.y += 0.8;
    this.state = 'fly';
    return first;
  }

  reset() {
    this.model.visible = true;
    this.respawn();
  }
}
