// 2D 도형 계산 도우미. 점은 [x, z] (미터). three.js 없이 돌아가서 node로 테스트할 수 있어요.

export function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

export function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function signedArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[i], r = p[(i + 1) % n];
    a += q[0] * r[1] - r[0] * q[1];
  }
  return a / 2;
}

export function centroid(p) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[i], r = p[(i + 1) % n];
    const f = q[0] * r[1] - r[0] * q[1];
    a += f; cx += (q[0] + r[0]) * f; cz += (q[1] + r[1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    let x = 0, z = 0;
    for (const q of p) { x += q[0]; z += q[1]; }
    return [x / p.length, z / p.length];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

// 겹친 점, 거의 일직선인 점을 지우고 반시계(넓이 +) 방향으로 맞춥니다.
export function cleanPolygon(p, minDist = 0.05, lineTol = 0.05) {
  let q = [];
  for (const pt of p) {
    if (!q.length || dist(q[q.length - 1], pt) > minDist) q.push([pt[0], pt[1]]);
  }
  if (q.length > 1 && dist(q[0], q[q.length - 1]) <= minDist) q.pop();
  let changed = true;
  while (changed && q.length > 3) {
    changed = false;
    for (let i = 0; i < q.length; i++) {
      const n = q.length;
      const a = q[(i - 1 + n) % n], b = q[i], c = q[(i + 1) % n];
      const len = dist(a, c);
      if (len < 1e-9 || Math.abs(cross(a, b, c)) < lineTol * len) {
        q.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (q.length >= 3 && signedArea(q) < 0) q.reverse();
  return q;
}

export function pointInPolygon(pt, poly) {
  let inside = false;
  const [x, z] = pt;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz), t };
}

export function distToPolygonEdge(p, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const { d } = distToSegment(p, poly[i], poly[(i + 1) % poly.length]);
    if (d < best) best = d;
  }
  return best;
}

function pointInTriStrict(p, a, b, c) {
  const e = 1e-9;
  return cross(a, b, p) > e && cross(b, c, p) > e && cross(c, a, p) > e;
}

// 귀 자르기 삼각분할. 반시계 다각형을 받아 [i, j, k] 목록(반시계)을 돌려줍니다.
export function triangulate(pts) {
  const n = pts.length;
  if (n < 3) return [];
  const idx = [...Array(n).keys()];
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let found = false;
    for (let i = 0; i < idx.length; i++) {
      const m = idx.length;
      const a = idx[(i - 1 + m) % m], b = idx[i], c = idx[(i + 1) % m];
      const A = pts[a], B = pts[b], C = pts[c];
      if (cross(A, B, C) <= 1e-9) continue;
      let blocked = false;
      for (const k of idx) {
        if (k === a || k === b || k === c) continue;
        if (pointInTriStrict(pts[k], A, B, C)) { blocked = true; break; }
      }
      if (blocked) continue;
      tris.push([a, b, c]);
      idx.splice(i, 1);
      found = true;
      break;
    }
    if (!found) {
      // 귀가 없으면(일직선이나 꼬인 점) 가장 납작한 점을 버리고 계속합니다.
      let minI = 0, minV = Infinity;
      for (let i = 0; i < idx.length; i++) {
        const m = idx.length;
        const v = Math.abs(cross(pts[idx[(i - 1 + m) % m]], pts[idx[i]], pts[idx[(i + 1) % m]]));
        if (v < minV) { minV = v; minI = i; }
      }
      idx.splice(minI, 1);
    }
  }
  if (idx.length === 3 && cross(pts[idx[0]], pts[idx[1]], pts[idx[2]]) > 1e-9) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

function clipAgainst(poly, inside, intersect) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i], prev = poly[(i - 1 + n) % n];
    const ci = inside(cur), pi = inside(prev);
    if (ci) {
      if (!pi) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (pi) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

// 다각형을 축 정렬 사각형 [u0,u1]×[v0,v1]로 자릅니다 (Sutherland–Hodgman).
export function clipToRect(poly, u0, u1, v0, v1) {
  let p = poly;
  const lerpU = (u) => (a, b) => { const t = (u - a[0]) / (b[0] - a[0]); return [u, a[1] + t * (b[1] - a[1])]; };
  const lerpV = (v) => (a, b) => { const t = (v - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), v]; };
  p = clipAgainst(p, (q) => q[0] >= u0, lerpU(u0)); if (p.length < 3) return [];
  p = clipAgainst(p, (q) => q[0] <= u1, lerpU(u1)); if (p.length < 3) return [];
  p = clipAgainst(p, (q) => q[1] >= v0, lerpV(v0)); if (p.length < 3) return [];
  p = clipAgainst(p, (q) => q[1] <= v1, lerpV(v1)); if (p.length < 3) return [];
  return p;
}

// 건물이 어느 방향으로 놓였는지(가장 긴 벽들의 방향)를 0~90도 사이 각도로 구합니다.
export function dominantAngle(poly) {
  const bins = new Float64Array(90);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = dist(a, b);
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ang = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    bins[Math.min(89, Math.floor((ang / (Math.PI / 2)) * 90))] += len;
  }
  let best = 0;
  for (let i = 1; i < 90; i++) if (bins[i] > bins[best]) best = i;
  // 고른 칸 안에서 길이 가중 평균으로 각도를 다듬습니다.
  let sum = 0, w = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = dist(a, b);
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ang = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    const bin = Math.min(89, Math.floor((ang / (Math.PI / 2)) * 90));
    if (Math.abs(bin - best) <= 1) { sum += ang * len; w += len; }
  }
  return w > 0 ? sum / w : (best + 0.5) * (Math.PI / 180);
}

// 결정적인 난수 (같은 건물은 늘 같은 모양으로 쪼개지게)
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 운동장 같은 직사각형 구역의 방향 상자: 중심, 긴 축 각도, 길이(L)·폭(W)
export function orientedBox(poly) {
  const a = dominantAngle(poly);
  let best = null;
  for (const ang of [a, a + Math.PI / 2]) {
    const c = Math.cos(ang), s = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of poly) {
      const u = x * c + z * s, v = -x * s + z * c;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const L = u1 - u0, W = v1 - v0;
    if (!best || L >= W) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      best = { angle: ang, L, W, cx: cu * c - cv * s, cz: cu * s + cv * c };
      if (L >= W) break;
    }
  }
  return best;
}
