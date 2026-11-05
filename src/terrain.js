import * as THREE from 'three';
import { pointInPolygon, distToPolygonEdge } from './geom.js';
import { soilTexture } from './textures.js';

// 땅: 높이 격자 + 모형처럼 잘린 옆면(흙층)
export class Terrain {
  constructor(src, spacing = 2) {
    // 원본 격자를 원하는 간격으로 다시 나눕니다(구덩이가 부드럽게 보이도록).
    this.x0 = src.x0; this.z0 = src.z0; this.w = src.w; this.d = src.d;
    this.nx = Math.max(2, Math.round(this.w / spacing) + 1);
    this.nz = Math.max(2, Math.round(this.d / spacing) + 1);
    this.dx = this.w / (this.nx - 1);
    this.dz = this.d / (this.nz - 1);
    this.h = new Float32Array(this.nx * this.nz);
    const sdx = src.w / (src.nx - 1), sdz = src.d / (src.nz - 1);
    const sh = src.h;
    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i < this.nx; i++) {
        const fx = Math.min(src.nx - 1.0001, (i * this.dx) / sdx);
        const fz = Math.min(src.nz - 1.0001, (j * this.dz) / sdz);
        const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz;
        const a = sh[iz * src.nx + ix], b = sh[iz * src.nx + ix + 1];
        const c = sh[(iz + 1) * src.nx + ix], d = sh[(iz + 1) * src.nx + ix + 1];
        this.h[j * this.nx + i] = (a * (1 - ax) + b * ax) * (1 - az) + (c * (1 - ax) + d * ax) * az;
      }
    }
    let lo = Infinity;
    for (const v of this.h) lo = Math.min(lo, v);
    this.bottom = lo - 14;
    this.h0 = null;
  }

  static flat(x0, z0, w, d) {
    const nx = 3, nz = 3;
    return { x0, z0, w, d, nx, nz, h: new Array(nx * nz).fill(0) };
  }

  heightAt(x, z) {
    let fx = (x - this.x0) / this.dx, fz = (z - this.z0) / this.dz;
    fx = Math.max(0, Math.min(this.nx - 1.0001, fx));
    fz = Math.max(0, Math.min(this.nz - 1.0001, fz));
    const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz;
    const n = this.nx, h = this.h;
    const a = h[iz * n + ix], b = h[iz * n + ix + 1], c = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
    return (a * (1 - ax) + b * ax) * (1 - az) + (c * (1 - ax) + d * ax) * az;
  }

  inside(x, z) {
    return x >= this.x0 && x <= this.x0 + this.w && z >= this.z0 && z <= this.z0 + this.d;
  }

  // 건물·운동장 아래를 평평하게 깎거나 돋웁니다(계단식 학교 부지).
  flatten(poly, target, margin) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const i0 = Math.max(0, Math.floor((x0 - margin - this.x0) / this.dx));
    const i1 = Math.min(this.nx - 1, Math.ceil((x1 + margin - this.x0) / this.dx));
    const j0 = Math.max(0, Math.floor((z0 - margin - this.z0) / this.dz));
    const j1 = Math.min(this.nz - 1, Math.ceil((z1 + margin - this.z0) / this.dz));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const p = [this.x0 + i * this.dx, this.z0 + j * this.dz];
        const k = j * this.nx + i;
        if (pointInPolygon(p, poly)) { this.h[k] = target; continue; }
        const d = distToPolygonEdge(p, poly);
        if (d < margin) {
          const t = d / margin;
          const s = t * t * (3 - 2 * t);
          this.h[k] = target + (this.h[k] - target) * s;
        }
      }
    }
  }

  // 깎기: 범위 안 점마다 target(x, z)보다 높으면 그 높이까지 낮춰요(스탠드 자리 등).
  carve(x0, x1, z0, z1, target) {
    const i0 = Math.max(0, Math.floor((x0 - this.x0) / this.dx)), i1 = Math.min(this.nx - 1, Math.ceil((x1 - this.x0) / this.dx));
    const j0 = Math.max(0, Math.floor((z0 - this.z0) / this.dz)), j1 = Math.min(this.nz - 1, Math.ceil((z1 - this.z0) / this.dz));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = this.x0 + i * this.dx, z = this.z0 + j * this.dz;
        const t = target(x, z);
        if (t === null || t === undefined) continue;
        const k = j * this.nx + i;
        if (this.h[k] > t) this.h[k] = t;
      }
    }
  }

  // 길 다듬기: 길을 따라 높이를 부드럽게 이어서, 차가 덜컹거리지 않게 해요.
  smoothRoads(roads, margin = 3) {
    for (const r of roads) {
      const pts = r.pts;
      if (pts.length < 2) continue;
      // 2 m마다 높이를 재고 이동평균으로 부드럽게
      const samples = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 2));
        for (let k = 0; k < n; k++) { const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; samples.push([x, z, this.heightAt(x, z)]); }
      }
      samples.push([pts[pts.length - 1][0], pts[pts.length - 1][1], this.heightAt(...pts[pts.length - 1])]);
      for (let pass = 0; pass < 3; pass++) {
        const hs = samples.map((s) => s[2]);
        for (let i = 0; i < samples.length; i++) {
          let sum = 0, c = 0;
          for (let d = -4; d <= 4; d++) { const k = i + d; if (k >= 0 && k < hs.length) { sum += hs[k]; c++; } }
          samples[i][2] = sum / c;
        }
      }
      const half = r.w / 2 + 0.6;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of samples) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      const R = half + margin;
      const i0 = Math.max(0, Math.floor((minX - R - this.x0) / this.dx)), i1 = Math.min(this.nx - 1, Math.ceil((maxX + R - this.x0) / this.dx));
      const j0 = Math.max(0, Math.floor((minZ - R - this.z0) / this.dz)), j1 = Math.min(this.nz - 1, Math.ceil((maxZ + R - this.z0) / this.dz));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = this.x0 + i * this.dx, z = this.z0 + j * this.dz;
          let best = Infinity, bh = 0;
          for (let s = 0; s < samples.length - 1; s++) {
            const [ax, az, ah] = samples[s], [bx, bz, bh2] = samples[s + 1];
            const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
            const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
            if (d < best) { best = d; bh = ah + (bh2 - ah) * t; }
          }
          if (best > R) continue;
          const k = j * this.nx + i;
          const w = best <= half ? 1 : 1 - (best - half) / margin;
          this.h[k] = this.h[k] + (bh - this.h[k]) * w * w * (3 - 2 * w);
        }
      }
    }
  }

  build(groundTexture) {
    this.h0 = this.h.slice();
    const { nx, nz } = this;
    const pos = new Float32Array(nx * nz * 3);
    const uv = new Float32Array(nx * nz * 2);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = this.x0 + i * this.dx;
        pos[k * 3 + 1] = this.h[k];
        pos[k * 3 + 2] = this.z0 + j * this.dz;
        uv[k * 2] = i / (nx - 1);
        uv[k * 2 + 1] = 1 - j / (nz - 1);
      }
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx.length > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    this.material = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.97, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';

    this.skirtGeo = new THREE.BufferGeometry();
    this.skirtMat = new THREE.MeshStandardMaterial({ map: soilTexture(), roughness: 1, side: THREE.DoubleSide });
    this.skirt = new THREE.Mesh(this.skirtGeo, this.skirtMat);
    this.skirt.receiveShadow = true;
    this.updateSkirt();
    return this.mesh;
  }

  updateSkirt() {
    const { nx, nz } = this;
    const edge = [];
    for (let i = 0; i < nx; i++) edge.push([i, 0]);
    for (let j = 1; j < nz; j++) edge.push([nx - 1, j]);
    for (let i = nx - 2; i >= 0; i--) edge.push([i, nz - 1]);
    for (let j = nz - 2; j >= 0; j--) edge.push([0, j]);
    const pos = [], uv = [];
    let s = 0;
    const span = 0 - this.bottom + 40;
    for (let e = 0; e < edge.length - 1; e++) {
      const [i1, j1] = edge[e], [i2, j2] = edge[e + 1];
      const x1 = this.x0 + i1 * this.dx, z1 = this.z0 + j1 * this.dz, y1 = this.h[j1 * nx + i1];
      const x2 = this.x0 + i2 * this.dx, z2 = this.z0 + j2 * this.dz, y2 = this.h[j2 * nx + i2];
      const L = Math.hypot(x2 - x1, z2 - z1);
      const b = this.bottom;
      const v = (y) => (y - b) / span;
      pos.push(x1, y1, z1, x1, b, z1, x2, b, z2, x1, y1, z1, x2, b, z2, x2, y2, z2);
      uv.push(s / 8, v(y1), s / 8, 0, (s + L) / 8, 0, s / 8, v(y1), (s + L) / 8, 0, (s + L) / 8, v(y2));
      s += L;
    }
    // 바닥 판
    const xa = this.x0, xb = this.x0 + this.w, za = this.z0, zb = this.z0 + this.d, b = this.bottom;
    pos.push(xa, b, za, xb, b, za, xb, b, zb, xa, b, za, xb, b, zb, xa, b, zb);
    uv.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    this.skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.skirtGeo.computeVertexNormals();
    this.skirtGeo.computeBoundingSphere();
  }

  // 폭발 구덩이. 가장자리는 살짝 솟아오릅니다.
  crater(cx, cz, r, depth) {
    const i0 = Math.max(0, Math.floor((cx - r * 1.4 - this.x0) / this.dx));
    const i1 = Math.min(this.nx - 1, Math.ceil((cx + r * 1.4 - this.x0) / this.dx));
    const j0 = Math.max(0, Math.floor((cz - r * 1.4 - this.z0) / this.dz));
    const j1 = Math.min(this.nz - 1, Math.ceil((cz + r * 1.4 - this.z0) / this.dz));
    if (i0 > i1 || j0 > j1) return;
    const pos = this.mesh.geometry.attributes.position;
    const floor = this.bottom + 3;
    let edgeTouched = false;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = this.x0 + i * this.dx, z = this.z0 + j * this.dz;
        const t = Math.hypot(x - cx, z - cz) / r;
        let dy = 0;
        if (t < 1) dy = -depth * (1 - t * t) * (1 - t * t);
        if (t > 0.75 && t < 1.4) { const u = (t - 0.75) / 0.65; dy += depth * 0.18 * Math.sin(u * Math.PI); }
        if (!dy) continue;
        const k = j * this.nx + i;
        this.h[k] = Math.max(floor, this.h[k] + dy);
        pos.setY(k, this.h[k]);
        if (i === 0 || j === 0 || i === this.nx - 1 || j === this.nz - 1) edgeTouched = true;
      }
    }
    pos.needsUpdate = true;
    this.dirty = true;
    if (edgeTouched) this.edgeDirty = true;
  }

  // 구덩이를 여러 번 파도 그림자·빛 계산은 한 프레임에 한 번만 합니다.
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
    if (this.edgeDirty) { this.edgeDirty = false; this.updateSkirt(); }
  }

  reset() {
    this.h.set(this.h0);
    const pos = this.mesh.geometry.attributes.position;
    for (let k = 0; k < this.h.length; k++) pos.setY(k, this.h[k]);
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
    this.updateSkirt();
  }
}
