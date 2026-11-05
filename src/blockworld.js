import * as THREE from 'three';

// 블록 월드 모드(택배차에서 낮은 확률로 얻는 숨은 모드)
// - 화면을 낮은 해상도로 그려 또렷한 픽셀로 키워요(image-rendering: pixelated).
// - 땅을 3 m 블록 기둥으로 바꾸고, 원래 땅 그림(도로·운동장·잔디)의 색을 블록 윗면에 그대로 칠해요.
// - 나무는 네모난 나무로, 하늘엔 네모난 구름과 해.
const CELL = 3, STEP = 1.5;
const KEY = 'smash-blockworld';

export const BlockUnlock = {
  has() { try { return localStorage.getItem(KEY) === 'unlocked' || localStorage.getItem(KEY) === 'on'; } catch { return false; } },
  on() { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* 무시 */ } },
};

function boxColors(geo, top, side) {
  const g = geo.toNonIndexed();
  const n = g.attributes.position.count, c = new Float32Array(n * 3), nrm = g.attributes.normal;
  for (let i = 0; i < n; i++) {
    const v = nrm.getY(i) > 0.5 ? top : nrm.getY(i) < -0.5 ? side * 0.6 : side;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export class BlockWorld {
  constructor(world, { renderer, painter, trees, terrain, sky }) {
    this.w = world;
    this.renderer = renderer;
    this.painter = painter;
    this.trees = trees;
    this.T = terrain;
    this.skyMesh = sky;
    this.active = false;
    this.group = new THREE.Group();
    this.group.visible = false;
    world.scene.add(this.group);
    this.treeTick = 0;
  }

  // 원래 땅 그림을 작게 줄여서 블록 색을 뽑아요.
  sampleGround() {
    const T = this.T, src = this.painter.canvas;
    const nx = Math.ceil(T.w / CELL), nz = Math.ceil(T.d / CELL);
    const c = document.createElement('canvas');
    c.width = nx; c.height = nz;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, nx, nz);
    this.ground = { nx, nz, data: g.getImageData(0, 0, nx, nz).data };
  }

  buildTerrain() {
    if (this.cols) { this.group.remove(this.cols); this.cols.geometry.dispose(); }
    const T = this.T;
    this.sampleGround();
    const { nx, nz, data } = this.ground;
    const geo = boxColors(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 1, 0.62);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.cols = new THREE.InstancedMesh(geo, mat, nx * nz);
    this.cols.receiveShadow = true;
    this.cols.castShadow = false;
    this.cells = [];
    const m = new THREE.Matrix4(), col = new THREE.Color();
    let k = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = T.x0 + (i + 0.5) * CELL, z = T.z0 + (j + 0.5) * CELL;
        if (!T.inside(x, z)) continue;
        const p = (j * nx + i) * 4;
        // 살짝 다른 밝기(블록마다 무늬)
        const jitter = 0.94 + (((i * 73856093) ^ (j * 19349663)) % 1000) / 1000 * 0.12;
        col.setRGB((data[p] / 255) * jitter, (data[p + 1] / 255) * jitter, (data[p + 2] / 255) * jitter, THREE.SRGBColorSpace);
        this.cols.setColorAt(k, col);
        this.cells.push({ x, z, k });
        k++;
      }
    }
    this.cols.count = k;
    for (const c of this.cells) this.placeCol(c, m);
    this.cols.instanceMatrix.needsUpdate = true;
    if (this.cols.instanceColor) this.cols.instanceColor.needsUpdate = true;
    this.group.add(this.cols);
  }

  placeCol(c, m = new THREE.Matrix4()) {
    const T = this.T;
    const h = Math.round(T.heightAt(c.x, c.z) / STEP) * STEP;
    const base = T.bottom;
    m.makeScale(CELL, Math.max(0.5, h - base), CELL).setPosition(c.x, base, c.z);
    this.cols.setMatrixAt(c.k, m);
  }

  // 폭발로 땅이 파이면 그 근처 블록만 다시 쌓아요.
  refresh(P, R) {
    if (!this.active || !this.cols) return;
    const m = new THREE.Matrix4();
    for (const c of this.cells) if (Math.abs(c.x - P.x) < R + CELL && Math.abs(c.z - P.z) < R + CELL) this.placeCol(c, m);
    this.cols.instanceMatrix.needsUpdate = true;
  }

  buildTrees() {
    for (const o of [this.trunks, this.leaves]) if (o) { this.group.remove(o); o.geometry.dispose(); }
    const items = [...(this.trees.kinds.pine?.items || []), ...(this.trees.kinds.broad?.items || [])];
    this.treeItems = items;
    const n = Math.max(1, items.length);
    this.trunks = new THREE.InstancedMesh(boxColors(new THREE.BoxGeometry(0.9, 4.5, 0.9).translate(0, 2.25, 0), 0.75, 0.55), new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x7a5232 }), n);
    const leaf = new THREE.BoxGeometry(4.2, 3, 4.2).translate(0, 5.6, 0);
    const top = new THREE.BoxGeometry(2.4, 1.6, 2.4).translate(0, 7.9, 0);
    const merged = new THREE.BufferGeometry();
    const a = boxColors(leaf, 1, 0.78), b = boxColors(top, 1, 0.78);
    const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]);
    const nor = new Float32Array([...a.attributes.normal.array, ...b.attributes.normal.array]);
    const colr = new Float32Array([...a.attributes.color.array, ...b.attributes.color.array]);
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    this.leaves = new THREE.InstancedMesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }), n);
    for (const o of [this.trunks, this.leaves]) { o.castShadow = true; this.group.add(o); }
    this.writeTrees();
  }

  writeTrees() {
    if (!this.leaves) return;
    const m = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color();
    const pal = this.trees.palette?.broad || ['#4f8a34', '#5e9a3c', '#447a2c'];
    const pine = this.trees.palette?.pine || ['#2f5a2c', '#386637'];
    const bare = this.trees.bare;
    this.treeItems.forEach((t, i) => {
      const s = Math.max(0.7, Math.min(1.4, t.s || 1));
      const isPine = i < (this.trees.kinds.pine?.items.length || 0);
      m.makeScale(s, s * (t.h || 1), s).setPosition(t.x, Math.round(this.T.heightAt(t.x, t.z) / STEP) * STEP, t.z);
      this.trunks.setMatrixAt(i, t.alive ? m : zero);
      this.leaves.setMatrixAt(i, t.alive && !(bare && !isPine) ? m : zero);
      col.set((isPine ? pine : pal)[i % (isPine ? pine : pal).length]);
      this.leaves.setColorAt(i, col);
    });
    for (const o of [this.trunks, this.leaves]) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere(); }
    if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
  }

  buildSkyBits() {
    if (this.clouds) return;
    this.clouds = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const T = this.T, cx = T.x0 + T.w / 2, cz = T.z0 + T.d / 2;
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(12 + Math.random() * 18, 4, 10 + Math.random() * 12), mat);
        b.position.set(k * 9 - n * 4, 0, (Math.random() - 0.5) * 10);
        c.add(b);
      }
      c.position.set(cx + (Math.random() - 0.5) * 600, 150 + Math.random() * 40, cz + (Math.random() - 0.5) * 600);
      this.clouds.add(c);
    }
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
    this.group.add(this.clouds, this.sun);
  }

  enable() {
    if (this.active) return;
    this.active = true;
    this.prevRatio = this.renderer.getPixelRatio();
    // 화면을 1/4 해상도로 그리고 또렷한 픽셀로 키워요.
    this.renderer.setPixelRatio(Math.max(0.22, (devicePixelRatio || 1) * 0.26));
    this.renderer.domElement.style.imageRendering = 'pixelated';
    this.buildTerrain();
    this.buildTrees();
    this.buildSkyBits();
    this.T.mesh.visible = false;
    if (this.T.skirt) this.T.skirt.visible = false;
    for (const k of Object.values(this.trees.kinds)) for (const mesh of k.meshes) mesh.visible = false;
    if (this.trees.xmas) for (const mesh of this.trees.xmas.meshes) mesh.visible = false;
    this.group.visible = true;
    document.body.classList.add('blockworld');
    this.w.onResize?.();
  }

  disable() {
    if (!this.active) return;
    this.active = false;
    this.renderer.setPixelRatio(this.prevRatio || 1);
    this.renderer.domElement.style.imageRendering = '';
    this.T.mesh.visible = true;
    if (this.T.skirt) this.T.skirt.visible = true;
    for (const [name, k] of Object.entries(this.trees.kinds)) for (const mesh of k.meshes) mesh.visible = !(this.trees.xmasOn && (name === 'pine' || name === 'broad'));
    if (this.trees.xmas) for (const mesh of this.trees.xmas.meshes) mesh.visible = !!this.trees.xmasOn;
    this.group.visible = false;
    document.body.classList.remove('blockworld');
    this.w.onResize?.();
  }

  // 다시 지었을 때(땅·나무가 처음으로 돌아감)
  rebuilt() { if (this.active) { this.buildTerrain(); this.writeTrees(); } }

  update(dt, camera) {
    if (!this.active) return;
    this.treeTick -= dt;
    if (this.treeTick <= 0) { this.treeTick = 0.6; this.writeTrees(); }
    for (const c of this.clouds.children) { c.position.x += dt * 3; if (c.position.x > this.T.x0 + this.T.w / 2 + 360) c.position.x -= 720; }
    // 네모난 해: 늘 카메라를 바라보게
    const s = this.w.sunLight;
    if (s) { this.sun.position.copy(camera.position).addScaledVector(s.position.clone().sub(s.target.position).normalize(), 900); this.sun.lookAt(camera.position); }
  }
}
