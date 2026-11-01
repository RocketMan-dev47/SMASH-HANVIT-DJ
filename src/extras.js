import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const paint = (geo, color) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
};

// 바나나우유(노란 단지 + 초록 뚜껑)
function bananaMilk() {
  return mergeGeometries([
    paint(new THREE.SphereGeometry(0.5, 12, 10).scale(1, 1.15, 1), '#f7d64a'),
    paint(new THREE.CylinderGeometry(0.22, 0.3, 0.35, 12).translate(0, 0.65, 0), '#f7d64a'),
    paint(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12).translate(0, 0.86, 0), '#2fa35a'),
  ]);
}
// 초코파이(빨간 봉지 + 초콜릿)
function chocoPie() {
  return mergeGeometries([
    paint(new THREE.BoxGeometry(1.1, 0.35, 1.1), '#d8282f'),
    paint(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16), '#5a3420'),
  ]);
}

// 하늘로 튀었다가 떨어져 쌓이는 물건들(매점 간식, 시험지)
class Flyers {
  constructor(scene, terrain, geo, mat, max, { gravity = 18, drag = 0.4, flutter = 0 } = {}) {
    this.terrain = terrain;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.max = max;
    this.next = 0;
    this.items = [];
    this.o = { gravity, drag, flutter };
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.ax = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, zero);
  }

  spawn(P, n, speed = 14, scale = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2, sp = speed * (0.5 + Math.random() * 0.7);
      this.items[i] = {
        i, p: P.clone().add(new THREE.Vector3(0, 1, 0)),
        v: new THREE.Vector3(Math.cos(a) * sp * 0.6, sp * (0.7 + Math.random() * 0.6), Math.sin(a) * sp * 0.6),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8),
        s: scale * (0.8 + Math.random() * 0.4), moving: true, t: Math.random() * 10,
      };
    }
  }

  update(dt) {
    const T = this.terrain, o = this.o;
    let any = false;
    for (const it of this.items) {
      if (!it || !it.moving) continue;
      any = true;
      it.t += dt;
      it.v.y -= o.gravity * dt;
      const k = Math.exp(-o.drag * dt);
      it.v.x *= k; it.v.z *= k;
      if (o.flutter) { it.v.y = Math.max(it.v.y, -2.2); it.v.x += Math.sin(it.t * 3) * o.flutter * dt; it.v.z += Math.cos(it.t * 2.3) * o.flutter * dt; }
      it.p.addScaledVector(it.v, dt);
      const wl = it.w.length();
      if (wl > 1e-3) { this.q.setFromAxisAngle(this.ax.copy(it.w).divideScalar(wl), wl * dt); it.q.premultiply(this.q); }
      const g = T.inside(it.p.x, it.p.z) ? T.heightAt(it.p.x, it.p.z) + 0.15 * it.s : -999;
      if (it.p.y < g) {
        it.p.y = g;
        it.v.multiplyScalar(0.3); it.v.y = Math.abs(it.v.y) * 0.3;
        it.w.multiplyScalar(0.4);
        if (it.v.lengthSq() < 0.8) { it.moving = false; if (o.flutter) it.q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.random() * 6)); }
      }
      this.m.compose(it.p, it.q, new THREE.Vector3(it.s, it.s, it.s));
      this.mesh.setMatrixAt(it.i, this.m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, zero);
    this.items = [];
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function omrTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 180;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 128, 180);
  g.fillStyle = '#d8282f'; g.fillRect(0, 0, 128, 14);
  g.strokeStyle = 'rgba(216,40,47,0.5)';
  for (let r = 0; r < 14; r++) for (let k = 0; k < 5; k++) {
    g.beginPath(); g.ellipse(30 + k * 18, 28 + r * 11, 5, 3.5, 0, 0, Math.PI * 2); g.stroke();
    if (Math.random() < 0.22) { g.fillStyle = '#222'; g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Extras {
  constructor(world) {
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
    this.milk = new Flyers(world.scene, world.terrain, bananaMilk(), vc, 60);
    this.pie = new Flyers(world.scene, world.terrain, chocoPie(), vc, 60);
    this.papers = new Flyers(world.scene, world.terrain, new THREE.PlaneGeometry(0.8, 1.1),
      new THREE.MeshStandardMaterial({ map: omrTexture(), side: THREE.DoubleSide, roughness: 0.9 }), 260, { gravity: 6, drag: 1.4, flutter: 3 });
  }

  jackpot(P) {
    this.milk.spawn(P, 22, 16, 1.4);
    this.pie.spawn(P, 22, 16, 1.4);
  }

  examPapers(P, volume) {
    this.papers.spawn(P.clone().add(new THREE.Vector3(0, 4, 0)), Math.min(26, 4 + Math.round(volume / 60)), 9, 1.6);
  }

  update(dt) { this.milk.update(dt); this.pie.update(dt); this.papers.update(dt); }
  clear() { this.milk.clear(); this.pie.clear(); this.papers.clear(); }
}

// 본관 1층 매점 간판
export function storeSign(scene, at, yaw) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#101a34'; g.fillRect(0, 0, 256, 80);
  g.fillStyle = '#ffc94a';
  g.font = '800 40px "Pretendard Variable", Pretendard, Helvetica, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HV STORE', 128, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.2), [0, 0, 0, 0, 1, 1].map((k) => (k ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshStandardMaterial({ color: 0x101a34 }))));
  m.position.copy(at);
  m.rotation.y = yaw;
  scene.add(m);
  return m;
}
