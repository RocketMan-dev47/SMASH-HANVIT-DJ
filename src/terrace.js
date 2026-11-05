import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { centroid } from './geom.js';

// 본관 앞 옹벽: 본관은 앞쪽 길보다 3~4 m 높은 단 위에 있어요. 땅을 비탈로 만들면(4 m 격자) 톱니 절벽이 생겨서,
// 실제처럼 보도(2.5 m) + 반듯한 콘크리트 옹벽 + 난간 + 가운데 현관에서 양쪽으로 내려가는 계단을 놓고, 옹벽 아래는 길 높이로 다져요.
// 지형 모양을 바꾸므로 terrain.build() 전에 불러요.
const GAP = 2.5, FLAT = 4.5, RISE = 0.17, TREAD = 0.3, STAIR_W = 2.2;

export function planTerrace(terrain, b, toward) {
  const P = b.poly, c = centroid(P);
  let best = null;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], q = P[(i + 1) % P.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]);
    if (L < 8) continue;
    let nx = (q[1] - a[1]) / L, nz = -(q[0] - a[0]) / L;
    const m = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2];
    if ((m[0] - c[0]) * nx + (m[1] - c[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const face = nx * toward[0] + nz * toward[1];
    if (face > 0.6 && (!best || L > best.L)) best = { a, b: q, L, nx, nz, tx: (q[0] - a[0]) / L, tz: (q[1] - a[1]) / L };
  }
  if (!best) return null;
  // 옹벽 아래 높이: 변을 따라 4 m마다, 바깥 8 m 지점 땅 높이(부드럽게)
  const n = Math.max(2, Math.ceil(best.L / 4)), low = [];
  for (let k = 0; k <= n; k++) {
    const u = (best.L * k) / n, x = best.a[0] + best.tx * u + best.nx * 8, z = best.a[1] + best.tz * u + best.nz * 8;
    low.push(Math.min(b.base - 0.4, terrain.heightAt(x, z)));
  }
  const sm = low.map((_, k) => { let s = 0, w = 0; for (let d = -2; d <= 2; d++) { const j = k + d; if (j >= 0 && j < low.length) { s += low[j]; w++; } } return s / w; });
  const drop = b.base - Math.min(...sm);
  if (drop < 1.0) return null; // 단 차이가 작으면 옹벽 없이
  return { ...best, base: b.base, low: sm, n, drop };
}

export function lowAt(plan, u) {
  const f = Math.max(0, Math.min(plan.n, (u / plan.L) * plan.n)), k = Math.min(plan.n - 1, Math.floor(f)), t = f - k;
  return plan.low[k] * (1 - t) + plan.low[k + 1] * t;
}

// 지형: 보도 아래와 옹벽 바로 앞(4.5 m)을 길 높이로 낮춰요(보도는 옹벽 덩어리가 덮어요)
export function shapeTerrace(terrain, plan) {
  const { a, tx, tz, nx, nz, L } = plan, pad = 4;
  const xs = [a[0], a[0] + tx * L, a[0] + nx * (GAP + FLAT), a[0] + tx * L + nx * (GAP + FLAT)], zs = [a[1], a[1] + tz * L, a[1] + nz * (GAP + FLAT), a[1] + tz * L + nz * (GAP + FLAT)];
  terrain.carve(Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad, (x, z) => {
    const dx = x - a[0], dz = z - a[1], u = dx * tx + dz * tz, v = dx * nx + dz * nz;
    if (u < -1.5 || u > L + 1.5 || v < 0.3 || v > GAP + FLAT) return null;
    return lowAt(plan, Math.max(0, Math.min(L, u)));
  });
}

export function buildTerrace(scene, plan) {
  const { a, tx, tz, nx, nz, L, base } = plan;
  const g = new THREE.Group(), yaw = Math.atan2(tx, tz);
  const minLow = Math.min(...plan.low) - 1.2;
  const at = (u, v) => new THREE.Vector3(a[0] + tx * u + nx * v, 0, a[1] + tz * u + nz * v);
  const concrete = new THREE.MeshStandardMaterial({ color: '#b9b4aa', roughness: 0.92 });
  const paving = new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: '#5f656c', roughness: 0.45, metalness: 0.6 });
  // ① 보도 + 옹벽 덩어리(윗면은 보도, 앞면은 옹벽)
  const H = base + 0.04 - minLow, depth = GAP + 0.6;
  const block = new THREE.Mesh(new THREE.BoxGeometry(L + 2.4, H, depth), [concrete, concrete, paving, concrete, concrete, concrete]);
  const cpos = at(L / 2, (GAP - 0.6) / 2); block.position.set(cpos.x, minLow + H / 2, cpos.z); block.rotation.y = yaw + Math.PI / 2;
  block.castShadow = block.receiveShadow = true; g.add(block);
  // ② 옹벽 윗단 마감(살짝 튀어나온 갓돌)
  const cap = new THREE.Mesh(new THREE.BoxGeometry(L + 2.6, 0.18, 0.42), concrete);
  const kp = at(L / 2, GAP + 0.05); cap.position.set(kp.x, base + 0.1, kp.z); cap.rotation.y = yaw + Math.PI / 2; g.add(cap);
  // ③ 계단 두 줄: 가운데에서 양쪽으로, 옹벽 앞면을 따라 내려가요
  const mid = L / 2, lowC = lowAt(plan, mid), steps = Math.max(3, Math.ceil((base - lowC) / RISE)), rise = (base - lowC) / steps;
  const geos = [];
  for (const dir of [-1, 1]) {
    for (let k = 0; k < steps; k++) {
      const top = base - (k + 1) * rise, h = top - (minLow - 0.2);
      const geo = new THREE.BoxGeometry(TREAD, h, STAIR_W);
      const u = mid + dir * (1.4 + k * TREAD + TREAD / 2), p = at(u, GAP + STAIR_W / 2);
      geo.rotateY(yaw + Math.PI / 2); geo.translate(p.x, minLow - 0.2 + h / 2, p.z);
      geos.push(geo);
    }
  }
  // 계단 위 작은 참(현관 앞)
  const land = new THREE.BoxGeometry(2.8, base - minLow, STAIR_W); land.rotateY(yaw + Math.PI / 2);
  const lp = at(mid, GAP + STAIR_W / 2); land.translate(lp.x, minLow + (base - minLow) / 2, lp.z); geos.push(land);
  const stairs = new THREE.Mesh(mergeGeometries(geos.map((q) => q.toNonIndexed())), concrete);
  stairs.castShadow = stairs.receiveShadow = true; g.add(stairs);
  // ④ 난간: 옹벽 위(가운데 계단 입구만 비움) + 계단 바깥쪽
  const rails = [];
  const rail = (u0, u1, v, y0, y1) => {
    const len = Math.abs(u1 - u0), um = (u0 + u1) / 2, p = at(um, v);
    const bar = new THREE.BoxGeometry(len, 0.05, 0.05); bar.rotateZ(Math.atan2(y1 - y0, u1 - u0)); bar.rotateY(yaw + Math.PI / 2); bar.translate(p.x, (y0 + y1) / 2 + 1.0, p.z); rails.push(bar);
    const nPost = Math.max(2, Math.round(len / 2));
    for (let i = 0; i <= nPost; i++) { const u = u0 + ((u1 - u0) * i) / nPost, y = y0 + ((y1 - y0) * i) / nPost, q = at(u, v), post = new THREE.BoxGeometry(0.05, 1.0, 0.05); post.translate(q.x, y + 0.5, q.z); rails.push(post); }
  };
  rail(-1.1, mid - 1.4, GAP + 0.1, base, base); rail(mid + 1.4, L + 1.1, GAP + 0.1, base, base);
  const run = 1.4 + steps * TREAD;
  rail(mid - 1.4, mid - run, GAP + STAIR_W - 0.05, base, lowC); rail(mid + 1.4, mid + run, GAP + STAIR_W - 0.05, base, lowC);
  const railMesh = new THREE.Mesh(mergeGeometries(rails.map((q) => q.toNonIndexed())), metal); g.add(railMesh);
  g.userData = { plan, steps };
  scene.add(g);
  return g;
}
