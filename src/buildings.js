import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeOutline, planBuilding, pieceGeometry } from './fracture.js';
import { centroid, signedArea, hashString, mulberry32, orientedBox, pointInPolygon } from './geom.js';
import { facadeTexture, facadeGlowTexture, concreteTexture, roofTexture, STYLES } from './textures.js';

const GRAVITY = 15.5; // 실제(9.8)보다 조금 세게: 무너지는 맛이 빨라요
const FOUNDATION = 2.5;
const MAX_DYNAMIC = 650;

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

function toBuffer(geo) {
  let total = 0;
  for (const g of geo.groups) total += g.pos.length;
  const pos = new Float32Array(total), nor = new Float32Array(total), uv = new Float32Array((total / 3) * 2);
  const out = new THREE.BufferGeometry();
  let o = 0;
  geo.groups.forEach((g, mi) => {
    if (!g.pos.length) return;
    pos.set(g.pos, o); nor.set(g.nor, o); uv.set(g.uv, (o / 3) * 2);
    out.addGroup(o / 3, g.pos.length / 3, mi);
    o += g.pos.length;
  });
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// 여러 조각을 한 덩어리로 합쳐 그리기 횟수를 줄입니다.
function mergePieces(list, rotated) {
  const counts = [0, 0, 0];
  for (const p of list) for (let g = 0; g < 3; g++) counts[g] += p.geo.groups[g].pos.length;
  const total = counts[0] + counts[1] + counts[2];
  const pos = new Float32Array(total), nor = new Float32Array(total), uv = new Float32Array((total / 3) * 2);
  const out = new THREE.BufferGeometry();
  let o = 0;
  const m = new THREE.Matrix4();
  for (let g = 0; g < 3; g++) {
    const start = o;
    for (const p of list) {
      const G = p.geo.groups[g];
      const n = G.pos.length;
      if (!n) continue;
      let tx, ty, tz;
      let r = null;
      if (rotated) {
        m.makeRotationFromQuaternion(p.quat);
        r = m.elements;
        tx = p.pos.x; ty = p.pos.y; tz = p.pos.z;
      } else {
        [tx, ty, tz] = p.geo.center;
      }
      for (let k = 0; k < n; k += 3) {
        const x = G.pos[k], y = G.pos[k + 1], z = G.pos[k + 2];
        const nx = G.nor[k], ny = G.nor[k + 1], nz = G.nor[k + 2];
        if (r) {
          pos[o + k] = r[0] * x + r[4] * y + r[8] * z + tx;
          pos[o + k + 1] = r[1] * x + r[5] * y + r[9] * z + ty;
          pos[o + k + 2] = r[2] * x + r[6] * y + r[10] * z + tz;
          nor[o + k] = r[0] * nx + r[4] * ny + r[8] * nz;
          nor[o + k + 1] = r[1] * nx + r[5] * ny + r[9] * nz;
          nor[o + k + 2] = r[2] * nx + r[6] * ny + r[10] * nz;
        } else {
          pos[o + k] = x + tx; pos[o + k + 1] = y + ty; pos[o + k + 2] = z + tz;
          nor[o + k] = nx; nor[o + k + 1] = ny; nor[o + k + 2] = nz;
        }
      }
      uv.set(G.uv, (o / 3) * 2);
      o += n;
    }
    if (o > start) out.addGroup(start / 3, (o - start) / 3, g);
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

class Building {
  constructor(sys, d) {
    this.sys = sys;
    this.id = d.id;
    this.name = d.name || '';
    this.poly = d.poly;
    this.levels = d.levels;
    this.floorH = d.floorH;
    this.base = d.base;
    this.height = d.levels * d.floorH;
    this.top = this.base + this.height;
    this.style = d.style;
    this.seed = hashString(String(d.id));
    this.color = new THREE.Color(STYLES[d.style]?.wall || '#cccccc');
    this.area = signedArea(this.poly);
    this.totalVolume = this.area * this.height;
    this.c2 = centroid(this.poly);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of this.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    Object.assign(this, { minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    this.outline = makeOutline(this.poly);
    this.ctx = { outline: this.outline, base: this.base, floorH: this.floorH, bay: 3.4 };
    this.mats = sys.materialsFor(d.style, d.roof, d.id);

    const geo = pieceGeometry(this.poly, this.base - FOUNDATION, this.top, { ...this.ctx, top: true });
    this.intact = new THREE.Mesh(toBuffer(geo), this.mats);
    this.intact.position.set(...geo.center);
    this.intact.castShadow = this.intact.receiveShadow = true;
    sys.group.add(this.intact);

    // 박공지붕(gable)·사모지붕(hip): 장식용 지붕. 건물이 부서지기 시작하면 사라져요.
    if (d.shape === 'gable' || d.shape === 'hip') {
      const ob = orientedBox(this.poly);
      const roofMat = new THREE.MeshStandardMaterial({ color: d.roof || '#4a4f55', roughness: 0.8, metalness: 0.1 });
      let geo;
      if (d.shape === 'gable') {
        const h = Math.min(4, ob.W * 0.35);
        const tri = new THREE.Shape([new THREE.Vector2(-ob.W / 2 - 0.4, 0), new THREE.Vector2(ob.W / 2 + 0.4, 0), new THREE.Vector2(0, h)]);
        geo = new THREE.ExtrudeGeometry(tri, { depth: ob.L + 0.6, bevelEnabled: false });
        geo.translate(0, 0, -(ob.L + 0.6) / 2);
        this.cap = new THREE.Mesh(geo, roofMat);
        this.cap.rotation.y = Math.PI / 2 - ob.angle;
      } else {
        const h = Math.max(2.2, Math.min(ob.L, ob.W) * 0.45);
        geo = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
        geo.scale(((ob.L + 1) / 2) * Math.SQRT2, h, ((ob.W + 1) / 2) * Math.SQRT2);
        geo.translate(0, h / 2, 0);
        this.cap = new THREE.Mesh(geo, roofMat);
        this.cap.rotation.y = -ob.angle;
      }
      this.cap.position.set(ob.cx, this.top, ob.cz);
      this.cap.castShadow = this.cap.receiveShadow = true;
      sys.group.add(this.cap);
    }

    this.buildDecor(d);

    this.pieces = null;
    this.staticMesh = null;
    this.rubbleMesh = null;
    this.rubble = [];
    this.dirtyStatic = false;
    this.dirtyRubble = false;
    this.lost = 0;
    this.collapsed = false;

    if (this.name) {
      const el = document.createElement('div');
      el.className = 'bldg-label';
      el.textContent = this.name;
      this.label = new CSS2DObject(el);
      this.label.position.set(this.c2[0], this.top + 2.5, this.c2[1]);
      sys.group.add(this.label);
    }
  }

  // 옥상 장식: 난간, 계단실·설비 상자, 미래관 같은 둥근 지붕(barrel). 부서지기 시작하면 사라져요.
  buildDecor(d) {
    const g = new THREE.Group();
    const rand = mulberry32(this.seed + 3);
    const band = new THREE.Color(STYLES[d.style]?.band || '#cccccc');
    if (d.shape === 'barrel') {
      const ob = orientedBox(this.poly);
      const geo = new THREE.CylinderGeometry(ob.W / 2 + 0.3, ob.W / 2 + 0.3, ob.L + 0.4, 32, 1, false, 0, Math.PI);
      geo.rotateZ(Math.PI / 2);
      geo.scale(1, 0.32, 1);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: d.roof || '#8d9399', roughness: 0.45, metalness: 0.6 }));
      m.rotation.y = -ob.angle;
      m.position.set(ob.cx, this.top, ob.cz);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    } else if (!d.shape) {
      const parts = [];
      for (let i = 0; i < this.poly.length; i++) {
        const a = this.poly[i], b = this.poly[(i + 1) % this.poly.length];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.5) continue;
        const box = new THREE.BoxGeometry(L + 0.3, 0.9, 0.3);
        box.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
        box.translate((a[0] + b[0]) / 2, this.top + 0.45, (a[1] + b[1]) / 2);
        parts.push(box.toNonIndexed());
      }
      if (parts.length) {
        const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: band, roughness: 0.8 }));
        m.castShadow = true;
        g.add(m);
      }
      if (this.area > 250) {
        const ob = orientedBox(this.poly);
        const units = 1 + Math.floor(rand() * 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0xc9cbcd, roughness: 0.7 });
        const hv = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.5 });
        for (let k = 0; k < units * 3 && g.children.length < units + 1; k++) {
          const u = (rand() - 0.5) * ob.L * 0.7, v = (rand() - 0.5) * ob.W * 0.5;
          const x = ob.cx + u * Math.cos(ob.angle) - v * Math.sin(ob.angle);
          const z = ob.cz + u * Math.sin(ob.angle) + v * Math.cos(ob.angle);
          if (!pointInPolygon([x, z], this.poly)) continue;
          const big = rand() < 0.5;
          const w = big ? 4.5 : 2.2, h = big ? 3.2 : 1.4, dd = big ? 3.5 : 1.8;
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), big ? mat : hv);
          m.position.set(x, this.top + h / 2, z);
          m.rotation.y = -ob.angle;
          m.castShadow = true;
          g.add(m);
        }
      }
    }
    if (g.children.length) { this.decor = g; this.sys.group.add(g); }
  }

  fracture() {
    const plan = planBuilding(this.poly, { seed: this.seed, cell: 4.6, maxCells: 110 });
    this.pieces = [];
    this.columns = [];
    // 칸(세로 기둥)마다 바닥 모양과 범위: 장애물 판정에 써요(남아 있는 칸만 막아요).
    this.cellShapes = plan.cells.map((c) => {
      const xs = c.shape.map((q) => q[0]), zs = c.shape.map((q) => q[1]);
      return { poly: c.shape, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    });
    for (const cell of plan.cells) {
      const col = [];
      for (let f = 0; f < this.levels; f++) {
        const y0 = f === 0 ? this.base - FOUNDATION : this.base + f * this.floorH;
        const y1 = this.base + (f + 1) * this.floorH;
        const geo = pieceGeometry(cell.shape, y0, y1, { ...this.ctx, top: f === this.levels - 1 });
        const p = {
          b: this, floor: f, geo, state: 0, sv: cell.area * this.floorH,
          pos: new THREE.Vector3(...geo.center), quat: new THREE.Quaternion(),
          vel: new THREE.Vector3(), ang: new THREE.Vector3(),
          delay: 0, still: 0, age: 0, landed: false, mesh: null,
        };
        col.push(p);
        this.pieces.push(p);
      }
      this.columns.push(col);
    }
    this.sys.group.remove(this.intact);
    this.intact.geometry.dispose();
    this.intact = null;
    if (this.decor) { this.sys.group.remove(this.decor); this.decor = null; }
    if (this.cap) {
      this.sys.group.remove(this.cap);
      this.sys.fx.debrisBurst(this.cap.position.clone().add(new THREE.Vector3(0, 1, 0)), [3, 1, 3], this.cap.position.clone().add(new THREE.Vector3(0, -3, 0)), 14, 10, this.cap.material.color);
      this.cap = null;
    }
    this.staticMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mats);
    this.staticMesh.castShadow = this.staticMesh.receiveShadow = true;
    this.sys.group.add(this.staticMesh);
    this.buildClassrooms(plan.cells);
    this.rubbleMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mats);
    this.rubbleMesh.castShadow = this.rubbleMesh.receiveShadow = true;
    this.sys.group.add(this.rubbleMesh);
    this.dirtyStatic = true;
  }

  rebuildStatic() {
    this.dirtyStatic = false;
    const list = this.pieces.filter((p) => p.state === 0);
    this.staticMesh.geometry.dispose();
    this.staticMesh.geometry = list.length ? mergePieces(list, false) : new THREE.BufferGeometry();
    this.staticMesh.visible = list.length > 0;
  }

  rebuildRubble() {
    this.dirtyRubble = false;
    this.rubble = [...new Set(this.rubble.filter((p) => p.state === 2))];
    this.rubbleMesh.geometry.dispose();
    this.rubbleMesh.geometry = this.rubble.length ? mergePieces(this.rubble, true) : new THREE.BufferGeometry();
    this.rubbleMesh.visible = this.rubble.length > 0;
  }

  near(P, R) {
    const dx = Math.max(this.minX - P.x, 0, P.x - this.maxX);
    const dz = Math.max(this.minZ - P.z, 0, P.z - this.maxZ);
    const dy = Math.max(this.base - FOUNDATION - P.y, 0, P.y - this.top);
    return dx * dx + dy * dy + dz * dz < R * R;
  }

  boxDist(p, P) {
    const [hx, hy, hz] = p.geo.half;
    const dx = Math.max(Math.abs(P.x - p.pos.x) - hx, 0);
    const dy = Math.max(Math.abs(P.y - p.pos.y) - hy, 0);
    const dz = Math.max(Math.abs(P.z - p.pos.z) - hz, 0);
    return Math.hypot(dx, dy, dz);
  }

  count(p, out) {
    if (p.counted) return;
    p.counted = true;
    this.lost += p.sv;
    out.volume += p.sv;
  }

  // 부서진 단면 속 교실: 칸(조각)마다 책상·의자, 가끔 칠판. 그 칸이 떨어져 나가면 같이 사라져요.
  buildClassrooms(cells) {
    const S = this.sys;
    if (!S.deskGeo) {
      S.deskGeo = new THREE.BoxGeometry(1.1, 0.08, 0.6).translate(0, 0.75, 0);
      S.chairGeo = new THREE.BoxGeometry(0.45, 0.5, 0.45).translate(0, 0.25, -0.55);
      S.boardGeo = new THREE.BoxGeometry(2.6, 1.15, 0.06).translate(0, 1.55, 0);
      S.deskMat = new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.7 });
      S.chairMat = new THREE.MeshStandardMaterial({ color: 0x3d6fb6, roughness: 0.6 });
      S.boardMat = new THREE.MeshStandardMaterial({ color: 0x1f4a3a, roughness: 0.9 });
    }
    const rand = mulberry32(this.seed + 11);
    const desks = [], boards = [];
    const perCell = [];
    for (let c = 0; c < cells.length; c++) {
      const cen = centroid(cells[c].shape);
      for (let f = 0; f < this.levels; f++) {
        const y = this.base + f * this.floorH;
        const list = [];
        for (const dx of [-0.8, 0.8]) {
          const x = cen[0] + dx, z = cen[1] + (rand() - 0.5) * 0.6;
          if (!pointInPolygon([x, z], cells[c].shape)) continue;
          list.push(['d', desks.length]);
          desks.push([x, y, z]);
        }
        if (rand() < 0.12) { list.push(['b', boards.length]); boards.push([cen[0], y, cen[1] + 1.6, rand() * Math.PI]); }
        perCell.push(list);
      }
    }
    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.castShadow = false; m.receiveShadow = true; return m; };
    this.desks = mk(S.deskGeo, S.deskMat, desks.length);
    this.chairs = mk(S.chairGeo, S.chairMat, desks.length);
    this.boards = mk(S.boardGeo, S.boardMat, boards.length);
    const m = new THREE.Matrix4();
    desks.forEach(([x, y, z], i) => { m.makeTranslation(x, y, z); this.desks.setMatrixAt(i, m); this.chairs.setMatrixAt(i, m); });
    boards.forEach(([x, y, z, r], i) => { m.makeRotationY(r).setPosition(x, y, z); this.boards.setMatrixAt(i, m); });
    this.classrooms = { perCell, hidden: new Set() };
    S.group.add(this.desks, this.chairs, this.boards);
  }

  // 떨어져 나간 칸의 책상은 숨겨요.
  syncClassrooms() {
    if (!this.classrooms) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    let changed = false;
    this.pieces.forEach((p, k) => {
      if (p.state === 0 || this.classrooms.hidden.has(k)) return;
      this.classrooms.hidden.add(k);
      for (const [t, i] of this.classrooms.perCell[k] || []) {
        if (t === 'd') { this.desks.setMatrixAt(i, zero); this.chairs.setMatrixAt(i, zero); } else this.boards.setMatrixAt(i, zero);
        changed = true;
      }
    });
    if (changed) for (const m of [this.desks, this.chairs, this.boards]) m.instanceMatrix.needsUpdate = true;
  }

  blast(P, R, power, out, rand) {
    if (!this.near(P, R + 2)) return;
    if (!this.pieces) this.fracture();
    let hit = false;
    for (const p of this.pieces) {
      if (p.state !== 0) continue;
      const d = this.boxDist(p, P);
      if (d >= R) continue;
      const s = 1 - d / R;
      hit = true;
      this.count(p, out);
      if (s > 0.55 || this.sys.dynamic.length > MAX_DYNAMIC) this.sys.pulverize(p, P, s * power);
      else this.sys.launch(p, P, s, power, rand);
    }
    for (const p of this.rubble) {
      if (p.state !== 2) continue;
      const d = this.boxDist(p, P);
      if (d >= R * 0.9) continue;
      const s = 1 - d / R;
      this.dirtyRubble = true;
      out.rubble += 1;
      if (s > 0.35 || this.sys.dynamic.length > MAX_DYNAMIC) this.sys.pulverize(p, P, s * power);
      else this.sys.launch(p, P, s * 0.8, power, rand);
    }
    if (hit) {
      this.dirtyStatic = true;
      this.support(P, out, rand);
      this.syncClassrooms();
    }
  }

  support(P, out, rand) {
    // 아래층이 사라진 칸은 위층이 차례로 내려앉습니다.
    for (const col of this.columns) {
      for (let f = 1; f < col.length; f++) {
        const p = col[f];
        if (p.state === 0 && col[f - 1].state !== 0) {
          this.count(p, out);
          this.sys.drop(p, rand() * 0.12 + f * 0.04, rand);
        }
      }
    }
    if (this.collapsed) return;
    let groundLost = 0;
    for (const col of this.columns) if (col[0].state !== 0) groundLost++;
    const g = groundLost / this.columns.length;
    if (g > 0.45 || this.lost / this.totalVolume > 0.6) {
      // 버티던 기둥이 무너져 건물 전체가 주저앉습니다.
      this.collapsed = true;
      out.collapses.push(this);
      for (const p of this.pieces) {
        if (p.state !== 0) continue;
        this.count(p, out);
        const dist = Math.hypot(p.pos.x - P.x, p.pos.z - P.z);
        this.sys.drop(p, 0.15 + dist / 45 + p.floor * 0.05 + rand() * 0.25, rand, true);
      }
    }
    this.dirtyStatic = true;
  }

  lostFraction() {
    if (this.launched) return 1;
    return Math.min(1, this.lost / this.totalVolume);
  }
}

export class BuildingSystem {
  constructor({ scene, terrain, fx, sound }) {
    this.scene = scene;
    this.terrain = terrain;
    this.fx = fx;
    this.sound = sound;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this.dynamic = [];
    this.matCache = new Map();
    this.interior = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 1, metalness: 0 });
    this.rebuildTimer = 0;
    this.landings = 0;
    this.labelsVisible = true;
  }

  // 건물마다 따로(밤에 건물별로 불을 켜고 끄려고)
  materialsFor(style, roof, id = '') {
    const key = style + '|' + roof + '|' + id;
    if (this.matCache.has(key)) return this.matCache.get(key);
    const facade = new THREE.MeshStandardMaterial({
      map: facadeTexture(style), roughness: 0.82, metalness: 0.02,
      emissiveMap: facadeGlowTexture(style), emissive: new THREE.Color(0x000000),
    });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTexture(roof), roughness: 0.92, metalness: 0 });
    roofMat.userData.map = roofMat.map;
    if (this.snowy) roofMat.map = roofTexture('#eef2f6');
    const mats = [facade, this.interior, roofMat];
    this.matCache.set(key, mats);
    return mats;
  }

  // 지붕에 눈이 쌓여요(크리스마스 에디션)
  setSnow(on) {
    this.snowy = on;
    for (const mats of this.matCache.values()) {
      const roof = mats[2];
      roof.map = on ? roofTexture('#eef2f6') : roof.userData.map;
      roof.needsUpdate = true;
    }
  }

  // lit(building) → true면 그 건물 창문에 불이 켜져요(없으면 모두).
  setNight(on, lit = null) {
    for (const b of this.list) {
      const [facade] = b.mats;
      const yes = on && (!lit || lit(b));
      facade.emissive.set(yes ? 0xffffff : 0x000000);
      facade.emissiveIntensity = yes ? 0.95 : 0;
    }
  }

  add(d) {
    const b = new Building(this, d);
    this.list.push(b);
    return b;
  }

  get totalVolume() {
    return this.list.reduce((s, b) => s + b.totalVolume, 0);
  }

  destroyedFraction() {
    const t = this.totalVolume;
    return t ? this.list.reduce((s, b) => s + (b.launched ? b.totalVolume : Math.min(b.lost, b.totalVolume)), 0) / t : 0;
  }

  pickables() {
    const out = [];
    for (const b of this.list) {
      if (b.intact) out.push(b.intact);
      if (b.staticMesh?.visible) out.push(b.staticMesh);
      if (b.rubbleMesh?.visible) out.push(b.rubbleMesh);
    }
    return out;
  }

  blast(P, R, power, seed = Math.random() * 1e9) {
    const rand = mulberry32(seed);
    const out = { volume: 0, rubble: 0, collapses: [] };
    for (const b of this.list) if (!b.launched) b.blast(P, R, power, out, rand);
    // 날아가던 조각도 다시 밀어냅니다.
    for (const p of this.dynamic) {
      _v.copy(p.pos).sub(P);
      const d = _v.length();
      if (d < R * 1.3 && d > 0.01) p.vel.addScaledVector(_v.normalize(), power * 0.5 * (1 - d / (R * 1.3)));
    }
    return out;
  }

  launch(p, P, s, power, rand) {
    p.state = 1;
    _v.copy(p.pos).sub(P);
    _v.y = Math.max(_v.y, 0.3);
    _v.normalize();
    const k = power * s * (0.55 + 0.6 * rand());
    p.vel.copy(_v).multiplyScalar(k);
    p.vel.y += power * s * (0.35 + 0.5 * rand());
    p.ang.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(4 + 10 * s);
    p.delay = 0;
    this.activate(p);
  }

  drop(p, delay, rand, topple = false) {
    p.state = 1;
    p.vel.set((rand() - 0.5) * 1.5, -0.5, (rand() - 0.5) * 1.5);
    p.ang.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(topple ? 1.6 : 0.8);
    p.delay = delay;
    this.activate(p);
  }

  activate(p) {
    p.still = 0; p.age = 0; p.landed = false;
    if (!p.buf) p.buf = toBuffer(p.geo);
    if (!p.mesh) {
      p.mesh = new THREE.Mesh(p.buf, p.b.mats);
      p.mesh.castShadow = true;
      p.mesh.receiveShadow = true;
    }
    p.mesh.position.copy(p.pos);
    p.mesh.quaternion.copy(p.quat);
    this.group.add(p.mesh);
    if (!p.inDyn) { p.inDyn = true; this.dynamic.push(p); }
  }

  pulverize(p, P, strength) {
    const wasRubble = p.state === 2;
    p.state = 3;
    if (p.mesh) this.group.remove(p.mesh);
    const [hx, hy, hz] = p.geo.half;
    const vol = hx * hy * hz * 8;
    const n = Math.max(2, Math.min(9, Math.round(vol / 14)));
    this.fx.debrisBurst(p.pos, p.geo.half, P, strength, n, p.b.color);
    if (!wasRubble) p.b.dirtyStatic = true;
    else p.b.dirtyRubble = true;
  }

  rest(p) {
    p.state = 2;
    this.group.remove(p.mesh);
    p.b.rubble.push(p);
    p.b.dirtyRubble = true;
  }

  update(dt) {
    const T = this.terrain;
    this.landings = 0;
    for (let i = this.dynamic.length - 1; i >= 0; i--) {
      const p = this.dynamic[i];
      if (p.state !== 1) { p.inDyn = false; this.dynamic[i] = this.dynamic[this.dynamic.length - 1]; this.dynamic.pop(); continue; }
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      p.vel.y -= GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      const w = p.ang.length();
      if (w > 1e-4) { _q.setFromAxisAngle(_v.copy(p.ang).divideScalar(w), w * dt); p.quat.premultiply(_q); }

      // 회전한 조각의 아래쪽 끝까지 거리
      const q = p.quat;
      const [hx, hy, hz] = p.geo.half;
      const ext = Math.abs(2 * (q.x * q.y + q.z * q.w)) * hx + Math.abs(1 - 2 * (q.x * q.x + q.z * q.z)) * hy + Math.abs(2 * (q.y * q.z - q.x * q.w)) * hz;

      if (T.inside(p.pos.x, p.pos.z)) {
        const g = T.heightAt(p.pos.x, p.pos.z);
        if (p.pos.y - ext < g) {
          p.pos.y = g + ext;
          const impact = -p.vel.y;
          if (!p.landed && impact > 6) { p.landed = true; this.landings++; this.fx.dust(p.pos, Math.max(hx, hz) * 1.2); }
          if (p.vel.y < 0) p.vel.y *= -0.18;
          p.vel.x *= 0.5; p.vel.z *= 0.5;
          p.ang.multiplyScalar(0.5);
          if (p.vel.lengthSq() < 1.2 && p.ang.lengthSq() < 0.8) p.still += dt; else p.still = 0;
        } else {
          p.still = 0;
        }
      } else if (p.pos.y < T.bottom - 80) {
        // 모형 밖으로 떨어진 조각은 사라집니다.
        p.state = 3;
        this.group.remove(p.mesh);
        continue;
      }
      p.mesh.position.copy(p.pos);
      p.mesh.quaternion.copy(p.quat);
      if (p.still > 0.3 || p.age > 9) this.rest(p);
    }
    if (this.landings && this.sound) this.sound.crumble(Math.min(1, this.landings / 6));

    for (const b of this.list) if (b.dirtyStatic && b.pieces) b.rebuildStatic();
    this.rebuildTimer -= dt;
    if (this.rebuildTimer <= 0) {
      this.rebuildTimer = 0.35;
      for (const b of this.list) if (b.dirtyRubble && b.pieces) b.rebuildRubble();
    }
    for (const b of this.list) if (b.label) b.label.visible = this.labelsVisible && b.lostFraction() < 0.5;
  }

  // 구덩이가 생겨 바닥이 꺼진 곳의 잔해를 다시 떨어뜨립니다.
  wake(P, R) {
    for (const b of this.list) {
      for (const p of b.rubble) {
        if (p.state !== 2) continue;
        if (Math.hypot(p.pos.x - P.x, p.pos.z - P.z) > R) continue;
        b.dirtyRubble = true;
        this.drop(p, 0, Math.random);
      }
    }
  }

  setLabels(on) {
    this.labelsVisible = on;
  }

  clear() {
    for (const p of this.dynamic) if (p.mesh) this.group.remove(p.mesh);
    this.dynamic = [];
    for (const b of this.list) {
      if (b.label) this.group.remove(b.label);
      if (b.cap) this.group.remove(b.cap);
      if (b.decor) this.group.remove(b.decor);
      if (b.desks) this.group.remove(b.desks, b.chairs, b.boards);
      if (b.intact) { this.group.remove(b.intact); b.intact.geometry.dispose(); }
      if (b.staticMesh) { this.group.remove(b.staticMesh); b.staticMesh.geometry.dispose(); }
      if (b.rubbleMesh) { this.group.remove(b.rubbleMesh); b.rubbleMesh.geometry.dispose(); }
      if (b.pieces) for (const p of b.pieces) p.buf?.dispose();
    }
    this.list = [];
  }
}
