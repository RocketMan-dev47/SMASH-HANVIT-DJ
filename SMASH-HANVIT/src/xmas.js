import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LIGHTS = ['#ff3b30', '#ffd60a', '#34c759', '#0a84ff', '#ffffff', '#ff6fae'].map((c) => new THREE.Color(c));

// 크리스마스 트리 한 그루(원뿔 3층 + 장식 방울). 꼭짓점 색을 써서 InstancedMesh 하나로 그려요.
export function xmasTreeGeometry() {
  const parts = [];
  const paint = (geo, color) => {
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };
  const tiers = [[2.6, 3.2, 3.2], [2.0, 2.8, 5.2], [1.35, 2.4, 7.0]];
  for (const [r, h, y] of tiers) parts.push(paint(new THREE.ConeGeometry(r, h, 14).toNonIndexed().translate(0, y, 0), '#1f6b3a'));
  parts.push(paint(new THREE.CylinderGeometry(0.25, 0.35, 2, 8).toNonIndexed().translate(0, 1, 0), '#6a4630'));
  const balls = ['#ff3b30', '#ffd60a', '#0a84ff', '#ffffff', '#ff6fae'];
  let k = 0;
  for (const [r, h, y] of tiers) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + y;
      const rr = r * 0.62;
      parts.push(paint(new THREE.SphereGeometry(0.22, 6, 4).toNonIndexed().translate(Math.cos(a) * rr, y - h * 0.22, Math.sin(a) * rr), balls[k++ % balls.length]));
    }
  }
  return mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }));
}

function sleighModel() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.35, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b84a, roughness: 0.3, metalness: 0.9 });
  const brown = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.8 });
  const nose = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 2 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 });
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  // 썰매
  add(new THREE.BoxGeometry(1.3, 0.6, 2.0), red, 0, 0.75, -1.2);
  add(new THREE.BoxGeometry(1.3, 0.9, 0.25), red, 0, 1.2, -2.15);
  for (const x of [-0.6, 0.6]) {
    add(new THREE.BoxGeometry(0.08, 0.08, 2.6), gold, x, 0.25, -1.1);
    add(new THREE.TorusGeometry(0.3, 0.04, 6, 12, Math.PI), gold, x, 0.55, 0.2).rotation.y = Math.PI / 2;
  }
  // 선물 꾸러미
  add(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x34c759 }), -0.3, 1.3, -1.6);
  add(new THREE.BoxGeometry(0.45, 0.6, 0.45), new THREE.MeshStandardMaterial({ color: 0x0a84ff }), 0.3, 1.35, -1.7);
  // 산타
  add(new THREE.BoxGeometry(0.6, 0.7, 0.5), red, 0, 1.4, -0.9);
  add(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf2c9a8 }), 0, 1.95, -0.9);
  add(new THREE.SphereGeometry(0.2, 10, 8), white, 0, 1.82, -0.75);
  add(new THREE.ConeGeometry(0.2, 0.45, 10), red, 0, 2.25, -0.9);
  // 루돌프(빨간 코) 두 마리
  for (const [x, z, rudolph] of [[0, 2.2, true], [0, 4.0, false]]) {
    const d = new THREE.Group();
    d.position.set(x, 0, z);
    g.add(d);
    add(new THREE.BoxGeometry(0.45, 0.5, 1.1), brown, 0, 1.05, 0, d);
    add(new THREE.BoxGeometry(0.3, 0.3, 0.45), brown, 0, 1.45, 0.6, d);
    for (const [lx, lz] of [[-0.15, -0.4], [0.15, -0.4], [-0.15, 0.4], [0.15, 0.4]]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), dark, lx, 0.45, lz, d);
    for (const s of [-1, 1]) {
      const ant = add(new THREE.CylinderGeometry(0.025, 0.03, 0.45, 5), dark, 0.12 * s, 1.75, 0.55, d);
      ant.rotation.z = -0.4 * s;
    }
    add(new THREE.SphereGeometry(rudolph ? 0.09 : 0.06, 8, 6), rudolph ? nose : dark, 0, 1.45, 0.86, d);
  }
  add(new THREE.BoxGeometry(0.04, 0.04, 4.4), gold, 0, 1.1, 1.6);
  return g;
}

// 폭탄이 터지면 튀어나오는 선물상자
class Gifts {
  constructor(scene, terrain, max = 260) {
    this.terrain = terrain;
    this.max = max;
    this.box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4 }), max);
    const r1 = new THREE.BoxGeometry(1.04, 1.04, 0.2), r2 = new THREE.BoxGeometry(0.2, 1.04, 1.04);
    const bow = new THREE.TorusGeometry(0.18, 0.06, 6, 12).translate(0, 0.56, 0);
    this.ribbon = new THREE.InstancedMesh(mergeGeometries([r1, r2, bow].map((x) => x.toNonIndexed())), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.4 }), max);
    for (const m of [this.box, this.ribbon]) { m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.items = [];
    this.next = 0;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) { this.box.setMatrixAt(i, zero); this.ribbon.setMatrixAt(i, zero); this.box.setColorAt(i, c); this.ribbon.setColorAt(i, c); }
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.ax = new THREE.Vector3();
  }

  burst(P, n = 12) {
    const boxCols = ['#d8282f', '#2f9e44', '#2f6fe0', '#f2c14e', '#ffffff', '#ff6fae'];
    const ribCols = ['#f2c14e', '#ffffff', '#d8282f'];
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2, sp = 8 + Math.random() * 14;
      this.items[i] = {
        i, p: P.clone().add(new THREE.Vector3(0, 1, 0)), v: new THREE.Vector3(Math.cos(a) * sp, 10 + Math.random() * 14, Math.sin(a) * sp),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(10),
        s: 0.9 + Math.random() * 1.1, moving: true,
      };
      const ci = Math.floor(Math.random() * boxCols.length);
      this.box.setColorAt(i, new THREE.Color(boxCols[ci]));
      this.ribbon.setColorAt(i, new THREE.Color(ribCols[(ci + 1) % ribCols.length]));
    }
    this.box.instanceColor.needsUpdate = true;
    this.ribbon.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const T = this.terrain;
    let any = false;
    for (const it of this.items) {
      if (!it || !it.moving) continue;
      any = true;
      it.v.y -= 20 * dt;
      it.p.addScaledVector(it.v, dt);
      const wl = it.w.length();
      if (wl > 1e-3) { this.q.setFromAxisAngle(this.ax.copy(it.w).divideScalar(wl), wl * dt); it.q.premultiply(this.q); }
      const g = T.inside(it.p.x, it.p.z) ? T.heightAt(it.p.x, it.p.z) + it.s * 0.5 : -999;
      if (it.p.y < g) {
        it.p.y = g;
        it.v.y *= -0.3; it.v.x *= 0.5; it.v.z *= 0.5; it.w.multiplyScalar(0.5);
        if (it.v.lengthSq() < 1) { it.moving = false; it.q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)); }
      }
      this.m.compose(it.p, it.q, new THREE.Vector3(it.s, it.s, it.s));
      this.box.setMatrixAt(it.i, this.m);
      this.ribbon.setMatrixAt(it.i, this.m);
    }
    if (any) { this.box.instanceMatrix.needsUpdate = true; this.ribbon.instanceMatrix.needsUpdate = true; }
  }

  clear() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) { this.box.setMatrixAt(i, zero); this.ribbon.setMatrixAt(i, zero); }
    this.items = [];
    this.box.instanceMatrix.needsUpdate = true;
    this.ribbon.instanceMatrix.needsUpdate = true;
  }
}

export class XmasTheme {
  constructor(world, { showAt }) {
    this.w = world;
    this.showAt = showAt;
    this.on = false;
    this.t = 0;
    this.gifts = new Gifts(world.scene, world.terrain);
    this.group = new THREE.Group();
    this.group.visible = false;
    world.scene.add(this.group);
    this.buildBigTree();
    this.buildSnow();
  }

  buildBigTree() {
    const T = this.w.terrain;
    const [x, z] = this.showAt;
    const tree = new THREE.Mesh(xmasTreeGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    tree.scale.setScalar(3.2);
    tree.position.set(x, T.heightAt(x, z), z);
    tree.castShadow = true;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb300, emissiveIntensity: 2 }));
    star.scale.set(1, 1.3, 0.5);
    star.position.set(x, T.heightAt(x, z) + 8.6 * 3.2, z);
    this.star = star;
    this.group.add(tree, star);
  }

  buildSnow() {
    const N = 2600;
    this.flakes = new Float32Array(N * 3);
    this.speed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.flakes[i * 3] = (Math.random() - 0.5) * 460;
      this.flakes[i * 3 + 1] = Math.random() * 180;
      this.flakes[i * 3 + 2] = (Math.random() - 0.5) * 460;
      this.speed[i] = 2 + Math.random() * 2.5;
    }
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.flakes, 3).setUsage(THREE.DynamicDrawUsage));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.95 }));
    this.snow.frustumCulled = false;
    this.group.add(this.snow);
  }

  // 지붕 둘레에 줄조명을 답니다(건물을 다시 지을 때마다 새로 만들어요).
  buildLights() {
    if (this.lights) { this.group.remove(this.lights); this.lights.geometry.dispose(); }
    const pts = [];
    this.ranges = [];
    for (const b of this.w.buildings.list) {
      const start = pts.length;
      const poly = b.poly;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], c = poly[(i + 1) % poly.length];
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        for (let s = 0; s < L; s += 2.2) {
          const t = s / L;
          const sag = Math.sin((s % 6.6) / 6.6 * Math.PI) * 0.35;
          pts.push([a[0] + (c[0] - a[0]) * t, b.top + 0.35 - sag, a[1] + (c[1] - a[1]) * t]);
        }
      }
      this.ranges.push({ b, start, end: pts.length });
    }
    this.lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 6, 4), new THREE.MeshBasicMaterial(), Math.max(1, pts.length));
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); this.lights.setMatrixAt(i, m); this.lights.setColorAt(i, LIGHTS[i % LIGHTS.length]); });
    if (!pts.length) this.lights.count = 0;
    this.lightPts = pts;
    this.group.add(this.lights);
  }

  enable() {
    if (this.on) return;
    this.on = true;
    const w = this.w;
    this.group.visible = true;
    this.buildLights();
    w.trees.setXmas(true);
    w.cart?.setModel('sleigh');
    w.painter.setSnow(true);
    w.buildings.setSnow(true);
    w.rocket.setTheme('xmas');
  }

  disable() {
    if (!this.on) return;
    this.on = false;
    const w = this.w;
    this.group.visible = false;
    w.trees.setXmas(false);
    w.cart?.setModel('cart');
    w.painter.setSnow(false);
    w.buildings.setSnow(false);
    w.rocket.setTheme('normal');
    this.gifts.clear();
  }

  // 다시 지었을 때(건물이 새로 생김)
  rebuilt() {
    if (this.on) this.buildLights();
    this.gifts.clear();
  }

  update(dt, center) {
    this.gifts.update(dt);
    if (!this.on) return;
    this.t += dt;
    // 눈: 카메라가 보는 곳 주변에서 계속 내려요.
    const f = this.flakes;
    for (let i = 0; i < this.speed.length; i++) {
      f[i * 3 + 1] -= this.speed[i] * dt;
      f[i * 3] += Math.sin(this.t * 0.8 + i) * 0.3 * dt;
      if (f[i * 3 + 1] < 0) f[i * 3 + 1] += 180;
    }
    this.snow.position.set(center.x, center.y - 20, center.z);
    this.snow.geometry.attributes.position.needsUpdate = true;
    this.star.rotation.y += dt * 0.8;
    // 줄조명 반짝이기 + 무너진 건물의 조명은 꺼요.
    this.blink = (this.blink || 0) - dt;
    if (this.blink <= 0 && this.lights) {
      this.blink = 0.35;
      const phase = Math.floor(this.t / 0.35);
      const zero = new THREE.Matrix4().makeScale(0, 0, 0), m = new THREE.Matrix4();
      for (const r of this.ranges) {
        const dead = r.b.lostFraction() > 0.25;
        for (let i = r.start; i < r.end; i++) {
          const p = this.lightPts[i];
          this.lights.setMatrixAt(i, dead ? zero : m.makeTranslation(p[0], p[1], p[2]));
          this.lights.setColorAt(i, LIGHTS[(i + phase) % LIGHTS.length]);
        }
      }
      this.lights.instanceMatrix.needsUpdate = true;
      if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    }
  }
}

export { sleighModel };
