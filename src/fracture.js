// 건물 바닥 모양을 격자 칸으로 미리 쪼개고, 칸×층 조각의 3D 모양(배열)을 만듭니다.
// three.js 없이 돌아가서 node로 테스트할 수 있어요.
import {
  cross, dist, signedArea, centroid, cleanPolygon, triangulate,
  clipToRect, dominantAngle, mulberry32,
} from './geom.js';

// 원래 외벽 둘레 정보. 조각의 벽이 바깥벽인지 판단하고, 창문 무늬를 이어 붙이는 데 씁니다.
export function makeOutline(poly) {
  const edges = [];
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = dist(a, b);
    if (len < 1e-6) continue;
    edges.push({ a, b, len, s0: s, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len });
    s += len;
  }
  return { poly, edges, perimeter: s };
}

function facadeEdge(outline, p, q) {
  const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
  const L = dist(p, q);
  let best = null, bestD = Infinity;
  for (const e of outline.edges) {
    const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1];
    const l2 = dx * dx + dz * dz;
    let t = ((mx - e.a[0]) * dx + (mz - e.a[1]) * dz) / l2;
    if (t < -0.01 || t > 1.01) continue;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(mx - e.a[0] - t * dx, mz - e.a[1] - t * dz);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best || bestD > 0.06) return null;
  // 방향도 같아야 바깥벽입니다.
  const par = Math.abs(best.tx * (q[1] - p[1]) - best.tz * (q[0] - p[0]));
  if (par > 0.05 * L + 1e-6) return null;
  const sOf = (pt) => best.s0 + (pt[0] - best.a[0]) * best.tx + (pt[1] - best.a[1]) * best.tz;
  return { sp: sOf(p), sq: sOf(q) };
}

// 바닥 모양을 칸으로 나눕니다.
export function planBuilding(poly, opts = {}) {
  const cellTarget = opts.cell ?? 4.6;
  const maxCells = opts.maxCells ?? 110;
  const rand = mulberry32(opts.seed ?? 1);
  const ang = dominantAngle(poly);
  const c = Math.cos(ang), s = Math.sin(ang);
  const local = poly.map(([x, z]) => [x * c + z * s, -x * s + z * c]);
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const [u, v] of local) {
    umin = Math.min(umin, u); umax = Math.max(umax, u);
    vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
  }
  const W = umax - umin, D = vmax - vmin;
  let cs = cellTarget, nu, nv;
  for (;;) {
    nu = Math.max(1, Math.round(W / cs));
    nv = Math.max(1, Math.round(D / cs));
    if (nu * nv <= maxCells) break;
    cs *= 1.12;
  }
  // 안쪽 칸 경계를 조금씩 흔들어서 너무 반듯하게 부서지지 않게 합니다.
  const lines = (lo, len, n) => {
    const arr = [lo - 0.5];
    for (let i = 1; i < n; i++) arr.push(lo + (len * i) / n + (rand() - 0.5) * (len / n) * 0.3);
    arr.push(lo + len + 0.5);
    return arr;
  };
  const us = lines(umin, W, nu), vs = lines(vmin, D, nv);
  const cells = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const clipped = clipToRect(local, us[i], us[i + 1], vs[j], vs[j + 1]);
      if (clipped.length < 3) continue;
      const world = clipped.map(([u, v]) => [u * c - v * s, u * s + v * c]);
      const shape = cleanPolygon(world, 0.02, 0.01);
      if (shape.length < 3) continue;
      const area = signedArea(shape);
      if (area < 0.3) continue;
      cells.push({ i, j, shape, area });
    }
  }
  return { angle: ang, nu, nv, cells };
}

// 조각 하나(바닥 모양 + 아래·위 높이)의 3D 모양을 만듭니다.
// 재질 묶음: 0 바깥벽(창문), 1 속살(콘크리트), 2 지붕
export function pieceGeometry(shape, y0, y1, ctx) {
  const { outline, base, floorH, bay } = ctx;
  const S = ctx.texScale ?? 2.5;
  const [cx, cz] = centroid(shape);
  const cy = (y0 + y1) / 2;
  const groups = [0, 1, 2].map(() => ({ pos: [], nor: [], uv: [] }));
  const push = (g, x, y, z, nx, ny, nz, u, v) => {
    const G = groups[g];
    G.pos.push(x - cx, y - cy, z - cz);
    G.nor.push(nx, ny, nz);
    G.uv.push(u, v);
  };

  const n = shape.length;
  for (let i = 0; i < n; i++) {
    const a = shape[i], b = shape[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const L = Math.hypot(dx, dz);
    if (L < 1e-4) continue;
    const nx = dz / L, nz = -dx / L;
    const f = facadeEdge(outline, a, b);
    let g, uA, uB, vA0, vA1;
    if (f) {
      g = 0;
      uA = -f.sp / bay; uB = -f.sq / bay;
      vA0 = (y0 - base) / floorH; vA1 = (y1 - base) / floorH;
    } else {
      g = 1;
      const tx = dx / L, tz = dz / L;
      uA = (a[0] * tx + a[1] * tz) / S; uB = uA + L / S;
      vA0 = y0 / S; vA1 = y1 / S;
    }
    // (A0, A1, B0), (B0, A1, B1) 순서가 바깥을 봅니다.
    push(g, a[0], y0, a[1], nx, 0, nz, uA, vA0);
    push(g, a[0], y1, a[1], nx, 0, nz, uA, vA1);
    push(g, b[0], y0, b[1], nx, 0, nz, uB, vA0);
    push(g, b[0], y0, b[1], nx, 0, nz, uB, vA0);
    push(g, a[0], y1, a[1], nx, 0, nz, uA, vA1);
    push(g, b[0], y1, b[1], nx, 0, nz, uB, vA1);
  }

  const tris = triangulate(shape);
  const topG = ctx.top ? 2 : 1;
  const RS = ctx.top ? (ctx.roofScale ?? 3) : S;
  for (const [i, j, k] of tris) {
    // 위 뚜껑: 반시계 삼각형을 뒤집어야 위(+y)를 봅니다.
    for (const idx of [i, k, j]) push(topG, shape[idx][0], y1, shape[idx][1], 0, 1, 0, shape[idx][0] / RS, shape[idx][1] / RS);
    for (const idx of [i, j, k]) push(1, shape[idx][0], y0, shape[idx][1], 0, -1, 0, shape[idx][0] / S, shape[idx][1] / S);
  }

  let hx = 0, hz = 0;
  for (const [x, z] of shape) { hx = Math.max(hx, Math.abs(x - cx)); hz = Math.max(hz, Math.abs(z - cz)); }
  const area = signedArea(shape);
  return {
    center: [cx, cy, cz],
    half: [hx, (y1 - y0) / 2, hz],
    volume: area * (y1 - y0),
    groups: groups.map((G) => ({
      pos: new Float32Array(G.pos), nor: new Float32Array(G.nor), uv: new Float32Array(G.uv),
    })),
  };
}

export { cross };
