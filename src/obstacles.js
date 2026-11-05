import { pointInPolygon, distToPolygonEdge } from './geom.js';

// 공용 장애물 지도: 로봇개·1인칭 투어·고양이·동물이 건물이나 지형지물을 뚫고 지나가지 않게 해요.
// - 건물: 무너지거나(55% 이상) 우주로 배송된 건물은 지나갈 수 있어요.
// - 다각형(스탠드·연못·분리수거장 등)과 원(국기게양대·나무 줄기·차양 기둥·거북바위 등)
// - 8 m 격자에 나눠 담아서 빠르게 찾아요.
const CELL = 8;

export class Obstacles {
  constructor(buildings, terrain) {
    this.buildings = buildings;
    this.terrain = terrain;
    this.grid = new Map();
    this.polys = [];
  }

  key(i, j) { return `${i},${j}`; }

  addCircle(x, z, r, tag = '') {
    const c = { x, z, r, tag };
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(c);
    }
    return c;
  }

  addPoly(poly, tag = '') {
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    this.polys.push({ poly, tag, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
  }

  // 반지름 r인 몸이 (x, z)에 있을 수 없으면 true
  blocked(x, z, r = 0.5, { treesToo = true } = {}) {
    if (!this.terrain.inside(x, z)) return true;
    for (const b of this.buildings.list) {
      if (b.launched) continue;
      if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue;
      if (!b.columns || !b.cellShapes) {
        // 아직 멀쩡한 건물: 바닥 모양 전체가 벽
        if (pointInPolygon([x, z], b.poly) || distToPolygonEdge([x, z], b.poly) < r) return true;
        continue;
      }
      // 부서지기 시작한 건물: 아직 서 있는 칸(기둥)만 벽. 반쯤 남은 벽도 뚫고 지나가지 못해요.
      for (let k = 0; k < b.columns.length; k++) {
        const col = b.columns[k], c = b.cellShapes[k];
        if (!c || !col.some((p) => p.state === 0)) continue;
        if (x < c.minX - r || x > c.maxX + r || z < c.minZ - r || z > c.maxZ + r) continue;
        if (pointInPolygon([x, z], c.poly) || distToPolygonEdge([x, z], c.poly) < r) return true;
      }
    }
    for (const p of this.polys) {
      if (x < p.minX - r || x > p.maxX + r || z < p.minZ - r || z > p.maxZ + r) continue;
      if (pointInPolygon([x, z], p.poly) || distToPolygonEdge([x, z], p.poly) < r) return true;
    }
    const list = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (list) for (const c of list) {
      if (!treesToo && c.tag === 'tree') continue;
      if (c.alive && !c.alive()) continue;
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    }
    return false;
  }

  // 이미 막힌 곳(벽 속)에 있으면 가장 가까운 빈 곳으로 꺼내 줘요.
  escape(pos, r, opt) {
    if (!this.blocked(pos.x, pos.z, r, opt)) return false;
    for (let d = 0.6; d <= 16; d += 0.6) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = pos.x + Math.cos(a) * d, z = pos.z + Math.sin(a) * d;
        if (!this.blocked(x, z, r, opt)) { pos.x = x; pos.z = z; return true; }
      }
    }
    return false;
  }

  // 한 걸음 이동: 막히면 벽을 따라 미끄러지고(x만, z만), 그래도 막히면 제자리
  slide(pos, dx, dz, r, opt) {
    if (!this.blocked(pos.x + dx, pos.z + dz, r, opt)) { pos.x += dx; pos.z += dz; return 'free'; }
    if (!this.blocked(pos.x + dx, pos.z, r, opt)) { pos.x += dx; return 'slide'; }
    if (!this.blocked(pos.x, pos.z + dz, r, opt)) { pos.z += dz; return 'slide'; }
    return 'stuck';
  }
}
