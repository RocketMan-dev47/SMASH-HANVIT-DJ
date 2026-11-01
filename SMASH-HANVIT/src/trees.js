import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointInPolygon, distToPolygonEdge, distToSegment, mulberry32 } from './geom.js';
import { xmasTreeGeometry } from './xmas.js';

// 소나무(붉은 줄기, 층층이 납작한 잎), 활엽수, 철쭉(분홍 덤불). 종류마다 InstancedMesh로 한 번에 그립니다.
function pineCanopy() {
  const spec = [[0, 5.2, 0, 2.7, 1.0], [1.0, 6.5, 0.5, 2.1, 0.85], [-0.7, 7.5, -0.4, 1.7, 0.75], [0.3, 8.4, 0.1, 1.1, 0.6]];
  return mergeGeometries(spec.map(([x, y, z, r, sy]) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(r, sy, r * 0.9);
    g.translate(x, y, z);
    return g;
  }));
}

const KINDS = {
  pine: {
    parts: () => [
      [pineCanopy(), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), 'leaf'],
      [new THREE.CylinderGeometry(0.2, 0.34, 6.4, 6).translate(0, 3.2, 0), new THREE.MeshStandardMaterial({ color: 0x8b4a30, roughness: 1 }), 'trunk'],
    ],
    colors: ['#284b2a', '#305632', '#23422a', '#386238'],
    particle: 'leaf',
  },
  broad: {
    parts: () => [
      [new THREE.IcosahedronGeometry(1, 1).scale(2.6, 2.2, 2.6).translate(0, 5.2, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), 'leaf'],
      [new THREE.CylinderGeometry(0.22, 0.32, 4.2, 6).translate(0, 2.1, 0), new THREE.MeshStandardMaterial({ color: 0x6a4e37, roughness: 1 }), 'trunk'],
    ],
    colors: ['#43702f', '#527f36', '#5f8a3a', '#4a7631'],
    particle: 'leaf',
  },
  azalea: {
    parts: () => [
      [new THREE.IcosahedronGeometry(1, 1).scale(1.35, 0.8, 1.25).translate(0, 0.6, 0), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), 'leaf'],
    ],
    colors: ['#e04f95', '#ef6aa9', '#d23a7f', '#f28dbf', '#e04f95', '#4f7a3a'],
    particle: 'petal',
  },
};

export class Trees {
  constructor(scene, terrain, fx) {
    this.scene = scene;
    this.terrain = terrain;
    this.fx = fx;
    this.kinds = {};
  }

  plan(campus, buildings, maxTrees = 1400, maxShrubs = 450, outside = 260) {
    const rand = mulberry32(7);
    const T = this.terrain;
    const polys = buildings.map((b) => b.poly);
    const roads = campus.roads || [];
    const inCampus = (x, z) => (campus.boundary ? pointInPolygon([x, z], campus.boundary) : true);
    const blocked = (x, z, clearance, bClear = 1.5) => {
      if (!T.inside(x, z)) return true;
      for (const p of polys) {
        if (pointInPolygon([x, z], p) || distToPolygonEdge([x, z], p) < clearance + bClear) return true;
      }
      for (const r of roads) {
        for (let i = 0; i < r.pts.length - 1; i++) {
          if (distToSegment([x, z], r.pts[i], r.pts[i + 1]).d < r.w / 2 + clearance) return true;
        }
      }
      for (const a of campus.areas || []) {
        if (['pitch', 'track', 'parking', 'water', 'sand'].includes(a.kind) && pointInPolygon([x, z], a.poly)) return true;
      }
      return false;
    };
    const trees = [];
    const shrubs = [];
    const treeType = (pinePart) => (rand() < pinePart ? 'pine' : 'broad');

    for (const [x, z] of campus.trees || []) if (!blocked(x, z, 0.5)) trees.push([x, z, 1, treeType(0.6)]);
    for (const a of campus.areas || []) {
      if (a.kind !== 'forest' && a.kind !== 'scrub') continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of a.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const step = a.kind === 'forest' ? 6 : 5;
      for (let x = x0; x < x1; x += step) {
        for (let z = z0; z < z1; z += step) {
          const px = x + (rand() - 0.5) * step, pz = z + (rand() - 0.5) * step;
          if (!pointInPolygon([px, pz], a.poly) || blocked(px, pz, 1)) continue;
          if (a.kind === 'forest') trees.push([px, pz, 1.1, treeType(0.55)]);
          else shrubs.push([px, pz, 1.1]);
        }
      }
    }
    // 학교 담장을 따라 심은 소나무
    if (campus.boundary) {
      const b = campus.boundary;
      for (let i = 0; i < b.length; i++) {
        const p = b[i], q = b[(i + 1) % b.length];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L;
        for (let s = 3; s < L - 3; s += 7 + rand() * 3) {
          const t = s / L;
          const bx = p[0] + (q[0] - p[0]) * t, bz = p[1] + (q[1] - p[1]) * t;
          const side = pointInPolygon([bx + nx * 3, bz + nz * 3], b) ? 1 : -1;
          const x = bx + nx * 3 * side, z = bz + nz * 3 * side;
          if (!blocked(x, z, 1)) trees.push([x, z, 0.95, 'pine']);
          // 담장 안쪽 철쭉 띠
          const sx = bx + nx * 6 * side, sz = bz + nz * 6 * side;
          if (rand() < 0.5 && !blocked(sx, sz, 0.4, 0.5)) shrubs.push([sx, sz, 0.9]);
        }
      }
    }
    // 건물 앞 화단(철쭉)
    for (const p of polys) {
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 4) continue;
        const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; // 바깥 방향(반시계 다각형)
        for (let s = 2; s < L - 2; s += 3 + rand() * 1.5) {
          if (rand() < 0.35) continue;
          const t = s / L;
          const x = a[0] + (b[0] - a[0]) * t + nx * (4.6 + rand()), z = a[1] + (b[1] - a[1]) * t + nz * (4.6 + rand());
          if (inCampus(x, z) && !blocked(x, z, 0.3, 3.4)) shrubs.push([x, z, 0.8 + rand() * 0.5]);
        }
      }
    }
    for (let i = 0; i < outside; i++) {
      const x = T.x0 + rand() * T.w, z = T.z0 + rand() * T.d;
      if (campus.boundary && pointInPolygon([x, z], campus.boundary)) continue;
      if (!blocked(x, z, 1.5)) trees.push([x, z, 1, treeType(0.5)]);
    }
    if (trees.length > maxTrees) trees.length = maxTrees;
    if (shrubs.length > maxShrubs) shrubs.length = maxShrubs;

    const make = (x, z, k) => ({ x, z, y: T.heightAt(x, z), s: (0.75 + rand() * 0.6) * k, h: 0.85 + rand() * 0.4, rot: rand() * 6.28, lean: (rand() - 0.5) * 0.12, hue: rand(), alive: true });
    this.items = {
      pine: trees.filter((t) => t[3] === 'pine').map(([x, z, k]) => make(x, z, k)),
      broad: trees.filter((t) => t[3] === 'broad').map(([x, z, k]) => make(x, z, k)),
      azalea: shrubs.map(([x, z, k]) => make(x, z, k)),
    };
  }

  build() {
    for (const [name, def] of Object.entries(KINDS)) {
      const items = this.items[name];
      const meshes = def.parts().map(([geo, mat, role]) => {
        const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
        m.castShadow = name !== 'azalea';
        m.receiveShadow = true;
        m.userData.role = role;
        if (!items.length) m.count = 0;
        this.scene.add(m);
        return m;
      });
      this.kinds[name] = { def, items, meshes };
      this.write(name);
    }
  }

  write(name) {
    const { def, items, meshes } = this.kinds[name];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const pal = (this.palette?.[name] || def.colors).map((x) => new THREE.Color(x));
    const bare = name === 'broad' && this.bare;
    items.forEach((t, i) => {
      e.set(t.lean, t.rot, t.lean * 0.6);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(t.x, t.y - 0.15, t.z), q, new THREE.Vector3(t.s, t.s * t.h, t.s));
      c.copy(pal[Math.floor(t.hue * pal.length) % pal.length]).offsetHSL(0, 0, (t.hue - 0.5) * 0.06);
      for (const mesh of meshes) {
        mesh.setMatrixAt(i, t.alive && !(bare && mesh.userData.role === 'leaf') ? m : zero);
        if (mesh.userData.role === 'leaf') mesh.setColorAt(i, c);
      }
    });
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  // 계절: 봄(벚꽃), 여름(초록), 가을(단풍), 겨울(앙상한 나무, 눈 덮인 소나무)
  setSeason(season) {
    const PAL = {
      spring: { broad: ['#f7c6d8', '#f2abc6', '#fbdbe7', '#ea9bbd', '#f9e4ec'], azalea: ['#e8448f', '#f25aa0', '#d12e7a', '#ff7fb8'] },
      summer: {},
      autumn: { broad: ['#d4451c', '#ee8424', '#f2c12e', '#bf2f1c', '#e36b2a', '#b98a1c'], azalea: ['#a3392a', '#c4532f', '#8e2e22'], pine: ['#2f4b29', '#38552f', '#2a4527'] },
      winter: { pine: ['#b7c8bd', '#a6bbae', '#c6d4cb', '#9db3a5'], azalea: ['#8a7f6a', '#7d735f', '#958a74'] },
    };
    this.palette = PAL[season] || {};
    this.bare = season === 'winter';
    for (const name of Object.keys(this.kinds)) this.write(name);
  }

  // 크리스마스: 소나무·활엽수를 장식된 트리로 바꿔요(같은 자리, 같은 생존 여부).
  setXmas(on) {
    if (on && !this.xmas) {
      const items = [...this.kinds.pine.items, ...this.kinds.broad.items];
      const n = Math.max(1, items.length);
      const tree = new THREE.InstancedMesh(xmasTreeGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), n);
      const star = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45).scale(1, 1.3, 0.5).translate(0, 8.9, 0),
        new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb300, emissiveIntensity: 1.6 }), n);
      tree.castShadow = true; tree.receiveShadow = true;
      if (!items.length) { tree.count = 0; star.count = 0; }
      this.scene.add(tree, star);
      this.xmas = { items, meshes: [tree, star] };
    }
    if (this.xmas) for (const m of this.xmas.meshes) m.visible = on;
    for (const name of ['pine', 'broad']) for (const m of this.kinds[name].meshes) m.visible = !on;
    this.xmasOn = on;
    if (on) this.writeXmas();
  }

  writeXmas() {
    if (!this.xmas) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.xmas.items.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      m.compose(new THREE.Vector3(t.x, t.y - 0.15, t.z), q, new THREE.Vector3(t.s * 0.85, t.s * 0.85 * t.h, t.s * 0.85));
      for (const mesh of this.xmas.meshes) mesh.setMatrixAt(i, t.alive ? m : zero);
    });
    for (const mesh of this.xmas.meshes) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  }

  // 터진 자리의 나무와 덤불을 날려 보냅니다. 쓰러진 그루 수를 돌려줘요.
  blast(P, R) {
    let n = 0;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const [name, k] of Object.entries(this.kinds)) {
      let hit = false;
      k.items.forEach((t, i) => {
        if (!t.alive) return;
        const d = Math.hypot(t.x - P.x, t.z - P.z, Math.max(0, t.y - P.y));
        if (d > R) return;
        t.alive = false;
        hit = true;
        n++;
        for (const mesh of k.meshes) mesh.setMatrixAt(i, zero);
        if (k.def.particle === 'petal') this.fx.petals(t.x, t.y + 0.8, t.z);
        else this.fx.leaves(t.x, t.y + 4.5 * t.s, t.z);
      });
      if (hit) for (const mesh of k.meshes) mesh.instanceMatrix.needsUpdate = true;
    }
    if (n && this.xmasOn) this.writeXmas();
    return n;
  }

  settle(P, R) {
    for (const [name, k] of Object.entries(this.kinds)) {
      let any = false;
      for (const t of k.items) {
        if (!t.alive || Math.hypot(t.x - P.x, t.z - P.z) > R * 1.5) continue;
        t.y = this.terrain.heightAt(t.x, t.z);
        any = true;
      }
      if (any) this.write(name);
    }
    if (this.xmasOn) this.writeXmas();
  }

  reset() {
    for (const [name, k] of Object.entries(this.kinds)) {
      for (const t of k.items) { t.alive = true; t.y = this.terrain.heightAt(t.x, t.z); }
      this.write(name);
    }
    if (this.xmasOn) this.writeXmas();
  }
}
