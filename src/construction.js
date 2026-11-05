import * as THREE from 'three';
import { orientedBox } from './geom.js';

// 본관 증축 공사장: 본관 끝(인재원 쪽)을 인재원 끝선까지 늘리는 미완성 붉은 벽돌 건물 + 비계 + 타워크레인 + 가설 울타리
// + 노란 중장비(굴착기·덤프트럭·레미콘)가 오가요. 차들은 골프카트가 가까이 오면 멈춰서 양보해요.
const YELLOW = 0xf2b705;

function brickTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7d3a2a'; g.fillRect(0, 0, 256, 256); // 줄눈
  const bh = 12, bw = 30;
  for (let r = 0; r * bh < 256; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 256; x += bw) {
      const t = (r * 31 + Math.round(x)) % 7;
      g.fillStyle = ['#a8452f', '#b24e35', '#9c3f2b', '#ad4a33', '#a34530', '#b85538', '#963b28'][(t + 7) % 7];
      g.fillRect(x + off + 1, r * bh + 1, bw - 2, bh - 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#1f4fa8'; g.fillRect(0, 0, 512, 22); g.fillRect(0, 106, 512, 22);
  g.fillStyle = '#1f2a44'; g.font = '800 44px "Pretendard Variable", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('안전제일 · 본관 증축 공사 중', 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 본관 끝 중 인재원 쪽을 찾아, 인재원 끝선까지 늘린 직사각형(증축 자리)과 앞마당(차가 다니는 곳)을 구해요.
export function planSite(mainB, dorm, pitch, roads = []) {
  const ob = orientedBox(mainB.poly);
  const u = [Math.cos(ob.angle), Math.sin(ob.angle)], v = [-u[1], u[0]];
  const pu = (p) => (p[0] - ob.cx) * u[0] + (p[1] - ob.cz) * u[1];
  const pv = (p) => (p[0] - ob.cx) * v[0] + (p[1] - ob.cz) * v[1];
  const us = mainB.poly.map(pu), umin = Math.min(...us), umax = Math.max(...us);
  let end = -1, depth = 10;
  if (dorm) {
    const du = dorm.poly.map(pu), dmin = Math.min(...du), dmax = Math.max(...du);
    if (umin - dmin > 3) { end = -1; depth = umin - dmin; } else if (dmax - umax > 3) { end = 1; depth = dmax - umax; }
    else { const dc = du.reduce((a, b) => a + b, 0) / du.length; end = dc < 0 ? -1 : 1; }
  }
  depth = Math.max(6, Math.min(16, depth));
  const edgeU = end < 0 ? umin : umax;
  // 그 끝 근처(3.5 m 안) 점들의 가로 폭 = 증축 폭
  const near = mainB.poly.filter((p) => Math.abs(pu(p) - edgeU) < 3.5).map(pv);
  let v0 = Math.min(...near), v1 = Math.max(...near);
  if (!(v1 - v0 > 6)) { v0 = -ob.W / 2; v1 = ob.W / 2; }
  if (v1 - v0 > 20) { const m = (v0 + v1) / 2; v0 = m - 10; v1 = m + 10; }
  const u0 = edgeU, u1 = edgeU + end * depth;
  const W = (p) => [ob.cx + p[0] * u[0] + p[1] * v[0], ob.cz + p[0] * u[1] + p[1] * v[1]];
  const poly = [W([u0, v0]), W([u1, v0]), W([u1, v1]), W([u0, v1])];
  // 앞마당: 운동장 쪽(정면)으로 12 m
  let front = 1;
  if (pitch) { const pc = [pitch.cx, pitch.cz]; front = pv(pc) >= 0 ? 1 : -1; }
  // 앞마당 폭: 도로(골프카트 길)와 2 m 이상 떨어질 때까지 줄여요(울타리가 길을 막지 않게).
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c; } return c; };
  const roadNear = (poly) => roads.some((r) => r.pts.some((a, i) => { const b = r.pts[i + 1]; if (!b) return false; for (let k = 0; k <= 24; k++) { const q = [a[0] + ((b[0] - a[0]) * k) / 24, a[1] + ((b[1] - a[1]) * k) / 24]; const half = (r.w || 4) / 2 + 2; for (const [ox, oz] of [[0, 0], [half, 0], [-half, 0], [0, half], [0, -half]]) if (inPoly([q[0] + ox, q[1] + oz], poly)) return true; } return false; }));
  let band = 12, yard;
  for (; band >= 4; band -= 1) {
    const yv0 = front > 0 ? v1 : v0 - band, yv1 = front > 0 ? v1 + band : v0;
    yard = [W([u0 + end * 2, yv0]), W([u1 + end * 4, yv0]), W([u1 + end * 4, yv1]), W([u0 + end * 2, yv1])];
    if (!roadNear(yard)) break;
  }
  return { poly, yard, center: W([(u0 + u1) / 2, (v0 + v1) / 2]), angle: ob.angle + (end < 0 ? Math.PI : 0), depth: Math.abs(u1 - u0), width: v1 - v0, toU: [u[0] * end, u[1] * end], frontV: [v[0] * front, v[1] * front], W, u0, u1, v0, v1, end, front };
}

export class Construction {
  constructor(world, { mainB, dorm, pitch, cart, override, roads = [] }) {
    this.w = world;
    this.cart = cart;
    const T = world.terrain;
    const site = planSite(mainB, dorm, pitch, roads);
    if (override?.poly) site.poly = override.poly;
    this.site = site;
    this.group = new THREE.Group();
    world.scene.add(this.group);
    const base = mainB.base, fh = mainB.floorH || 3.6;
    this.base = base;
    const brick = brickTexture();
    const brickMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.92 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.95 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.5, metalness: 0.6 });
    const rebar = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.8, metalness: 0.3 });
    const yellow = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.7 });

    // 건물: 증축 직사각형 로컬 좌표(x = 바깥쪽 깊이, z = 폭)
    const b = new THREE.Group();
    const [cx, cz] = site.center;
    b.position.set(cx, base, cz);
    b.rotation.y = -Math.atan2(site.toU[1], site.toU[0]);
    this.group.add(b);
    const D = site.depth, Wd = site.width;
    const box = (w, h, d, x, y, z, m, parent = b) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    // 1·2층: 벽돌 벽(본관과 붙은 쪽은 열림), 창 자리는 뚫린 채
    for (let f = 0; f < 2; f++) {
      const y = f * fh;
      box(D + 0.3, 0.35, Wd + 0.3, 0, y + 0.17, 0, concrete); // 바닥 슬래브
      const wallH = fh - 0.35;
      const wall = (len, alongX, x, z) => {
        // 창문 3개씩: 벽돌 기둥 사이로 구멍
        const n = Math.max(2, Math.round(len / 4));
        const seg = len / n;
        for (let i = 0; i < n; i++) {
          const c0 = -len / 2 + seg * (i + 0.5);
          const pierW = seg * 0.35;
          const geo = (w, h) => (alongX ? [w, h, 0.3] : [0.3, h, w]);
          const at = (o, yy) => (alongX ? [x + o, yy, z] : [x, yy, z + o]);
          const [a1, a2, a3] = geo(pierW, wallH); box(a1, a2, a3, ...at(c0 - seg / 2 + pierW / 2, y + 0.35 + wallH / 2), brickMat);
          const [s1, s2, s3] = geo(seg - pierW, 0.9); box(s1, s2, s3, ...at(c0 + pierW / 2, y + 0.35 + 0.45), brickMat); // 창 아래
          const [l1, l2, l3] = geo(seg - pierW, 0.6); box(l1, l2, l3, ...at(c0 + pierW / 2, y + fh - 0.3), brickMat); // 창 위
        }
        const brickRepeat = Math.max(1, len / 4);
        brick.repeat.set(brickRepeat, 1);
      };
      wall(Wd, false, D / 2, 0); // 바깥 끝벽
      wall(D, true, 0, -Wd / 2);
      wall(D, true, 0, Wd / 2);
    }
    // 3층 바닥 + 기둥만(미완성) + 철근
    box(D + 0.3, 0.35, Wd + 0.3, 0, 2 * fh + 0.17, 0, concrete);
    const cols = [];
    for (const x of [-D / 2 + 0.4, 0, D / 2 - 0.4]) for (const z of [-Wd / 2 + 0.4, -Wd / 6, Wd / 6, Wd / 2 - 0.4]) cols.push([x, z]);
    cols.forEach(([x, z], i) => {
      const h = i % 3 === 0 ? fh : fh * (0.45 + (i % 4) * 0.12);
      box(0.6, h, 0.6, x, 2 * fh + 0.35 + h / 2, z, concrete);
      for (const [ox, oz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), rebar);
        r.position.set(x + ox, 2 * fh + 0.35 + h + 0.8, z + oz);
        b.add(r);
      }
    });
    // 3층 벽돌 벽: 크레인 미니게임에서 짐을 올릴수록 조각이 하나씩 생겨요(처음엔 숨김).
    this.f3 = [];
    {
      const y = 2 * fh + 0.35, h = fh - 0.35;
      const runs = [[D, true, 0, -Wd / 2], [D, true, 0, Wd / 2], [Wd, false, D / 2, 0]];
      for (const [len, alongX, x, z] of runs) {
        const n = Math.max(3, Math.round(len / 2.4));
        for (let i = 0; i < n; i++) {
          const o = -len / 2 + (len * (i + 0.5)) / n;
          const piece = box(alongX ? len / n - 0.05 : 0.3, h, alongX ? 0.3 : len / n - 0.05, alongX ? x + o : x, y + h / 2, alongX ? z : z + o, brickMat);
          piece.visible = false;
          this.f3.push(piece);
        }
      }
    }
    // 비계(파이프) + 초록 안전망(바깥 끝벽과 정면 쪽)
    const pipe = new THREE.CylinderGeometry(0.05, 0.05, 1, 5);
    const pipes = [];
    const H = 3 * fh + 1.2, off = 1.1;
    const faces = [[D / 2 + off, 0, Wd + 2 * off, false], [0, Wd / 2 + off, D + 2 * off, true], [0, -Wd / 2 - off, D + 2 * off, true]];
    for (const [fx, fz, len, alongX] of faces) {
      const n = Math.ceil(len / 2);
      for (let i = 0; i <= n; i++) { const o = -len / 2 + (len * i) / n; pipes.push({ p: alongX ? [fx + o, H / 2, fz] : [fx, H / 2, fz + o], s: [1, H, 1], r: 0 }); }
      for (let y = 1; y < H; y += 2) pipes.push({ p: [fx, y, fz], s: [1, len, 1], r: alongX ? 'z' : 'x' });
      // 안전망
      const net = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? len : len, H * 0.75), new THREE.MeshStandardMaterial({ color: 0x2e8b3a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 1 }));
      net.position.set(fx + (alongX ? 0 : 0.15), H * 0.62, fz + (alongX ? Math.sign(fz) * 0.15 : 0));
      net.rotation.y = alongX ? 0 : Math.PI / 2;
      b.add(net);
    }
    const pm = new THREE.InstancedMesh(pipe, steel, pipes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    pipes.forEach((pp, i) => {
      q.setFromEuler(new THREE.Euler(pp.r === 'z' ? 0 : pp.r === 'x' ? Math.PI / 2 : 0, 0, pp.r === 'z' ? Math.PI / 2 : 0));
      m4.compose(new THREE.Vector3(...pp.p), q, new THREE.Vector3(...pp.s));
      pm.setMatrixAt(i, m4);
    });
    b.add(pm);

    // 흙바닥(앞마당) — 지형을 따라
    const yard = site.yard;
    const yc = yard.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
    const ylen = Math.hypot(yard[1][0] - yard[0][0], yard[1][1] - yard[0][1]), ywid = Math.hypot(yard[3][0] - yard[0][0], yard[3][1] - yard[0][1]);
    const dirt = new THREE.PlaneGeometry(ylen + D, ywid + 2, 16, 8).rotateX(-Math.PI / 2);
    const ang = Math.atan2(yard[1][1] - yard[0][1], yard[1][0] - yard[0][0]);
    const pos = dirt.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i);
      const wx = yc[0] + lx * Math.cos(ang) - lz * Math.sin(ang), wz = yc[1] + lx * Math.sin(ang) + lz * Math.cos(ang);
      pos.setXYZ(i, wx, T.heightAt(wx, wz) + 0.06, wz);
    }
    dirt.computeVertexNormals();
    this.group.add(new THREE.Mesh(dirt, new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })));

    // 가설 울타리 + 안내판(앞마당 바깥 테두리)
    const sign = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.8 });
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.8 });
    const fenceAt = (a, bb, withSign) => {
      const L = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
      const mx = (a[0] + bb[0]) / 2, mz = (a[1] + bb[1]) / 2;
      const f = new THREE.Mesh(new THREE.BoxGeometry(L, 2.2, 0.12), withSign ? [fenceMat, fenceMat, fenceMat, fenceMat, sign, sign] : fenceMat);
      f.position.set(mx, T.heightAt(mx, mz) + 1.1, mz);
      f.rotation.y = -Math.atan2(bb[1] - a[1], bb[0] - a[0]);
      f.castShadow = true;
      this.group.add(f);
    };
    // 정면 쪽 긴 변에는 차가 드나드는 입구를 남겨요(가운데 8 m 비움)
    const [p0, p1, p2, p3] = yard;
    const gapA = [p3[0] + (p2[0] - p3[0]) * 0.35, p3[1] + (p2[1] - p3[1]) * 0.35], gapB = [p3[0] + (p2[0] - p3[0]) * 0.65, p3[1] + (p2[1] - p3[1]) * 0.65];
    fenceAt(p1, p2, false);
    fenceAt(p3, gapA, true);
    fenceAt(gapB, p2, true);
    this.gate = [(gapA[0] + gapB[0]) / 2, (gapA[1] + gapB[1]) / 2];

    // 타워크레인(앞마당 바깥 모서리)
    const crane = new THREE.Group();
    const [kx, kz] = p2;
    crane.position.set(kx, T.heightAt(kx, kz), kz);
    this.group.add(crane);
    const mastH = 34;
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) box(0.14, mastH, 0.14, ox, mastH / 2, oz, yellow, crane);
    for (let y = 2; y < mastH; y += 2.4) { box(1.7, 0.1, 0.1, 0, y, -0.8, yellow, crane); box(1.7, 0.1, 0.1, 0, y, 0.8, yellow, crane); box(0.1, 0.1, 1.7, -0.8, y, 0, yellow, crane); box(0.1, 0.1, 1.7, 0.8, y, 0, yellow, crane); }
    box(2.6, 1.2, 2.6, 0, 0.6, 0, concrete, crane);
    const slew = new THREE.Group();
    slew.position.y = mastH;
    crane.add(slew);
    box(30, 1.0, 1.1, 12, 0.5, 0, yellow, slew); // 지브
    box(10, 0.9, 1.0, -5, 0.5, 0, yellow, slew); // 카운터 지브
    box(2.4, 2.2, 1.6, -9, -0.6, 0, concrete, slew); // 균형추
    box(1.6, 1.6, 1.6, 0.4, -0.6, 1.3, new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.4 }), slew); // 조종실
    box(0.3, 5, 0.3, 0, 3, 0, yellow, slew); // 꼭대기
    const trolley = new THREE.Group();
    slew.add(trolley);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), dark);
    trolley.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), yellow);
    trolley.add(hook);
    const load = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.4), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 }));
    trolley.add(load);
    this.crane = { slew, trolley, cable, hook, load, mastH, at: crane.position };

    // 중장비
    this.vehicles = [];
    const into = (x, z) => [yc[0] + x * Math.cos(ang) - z * Math.sin(ang), yc[1] + x * Math.sin(ang) + z * Math.cos(ang)];
    // 굴착기(제자리 작업)
    const ex = this.excavator(yellow, dark);
    const [ex1, ez1] = into(-ylen * 0.32, 0); // 본관 쪽 안쪽 구석
    ex.g.position.set(ex1, T.heightAt(ex1, ez1), ez1);
    ex.g.rotation.y = -ang + Math.PI / 2;
    this.group.add(ex.g);
    this.vehicles.push({ kind: 'excavator', ...ex, t: 0 });
    // 덤프트럭: 앞마당 안에서 굴착기 옆 ↔ 입구 왕복(상차 4초)
    const dump = this.dumpTruck(yellow, dark);
    this.group.add(dump.g);
    const a1 = into(ylen * 0.3, 0);
    const a2 = [this.gate[0] - site.frontV[0] * 3, this.gate[1] - site.frontV[1] * 3];
    this.vehicles.push({ kind: 'dump', ...dump, path: [a1, a2], i: 0, s: 0, wait: 2, speed: 3.2 });
    // 레미콘: 입구 안쪽 ↔ 입구 밖으로 나갔다 들어오기
    const mix = this.mixer(yellow, dark);
    this.group.add(mix.g);
    const fv = site.frontV;
    const g0 = [this.gate[0] - fv[0] * 6, this.gate[1] - fv[1] * 6], g1 = [this.gate[0] + fv[0] * 16, this.gate[1] + fv[1] * 16];
    this.vehicles.push({ kind: 'mixer', ...mix, path: [g0, g1], i: 0, s: 0.3, wait: 5, speed: 2.4 });
    for (const v of this.vehicles) if (v.path) this.place(v, 0);
  }

  excavator(yellow, dark) {
    const g = new THREE.Group();
    const add = (geo, m, x, y, z, p = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.0, 0.9, 4.2), dark, s * 1.3, 0.45, 0);
    const body = new THREE.Group(); body.position.y = 0.9; g.add(body);
    add(new THREE.BoxGeometry(3, 1.2, 3.6), yellow, 0, 0.6, -0.3, body);
    add(new THREE.BoxGeometry(1.4, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: 0xcfe4f2, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.8 }), 0.7, 1.9, 0.6, body);
    const boom = new THREE.Group(); boom.position.set(-0.5, 1.2, 1.2); body.add(boom);
    add(new THREE.BoxGeometry(0.5, 0.6, 4.2), yellow, 0, 0, 2.0, boom);
    const arm = new THREE.Group(); arm.position.set(0, 0, 4.1); boom.add(arm);
    add(new THREE.BoxGeometry(0.4, 0.5, 3), yellow, 0, 0, 1.4, arm);
    const bucket = new THREE.Group(); bucket.position.set(0, 0, 2.9); arm.add(bucket);
    add(new THREE.BoxGeometry(1.2, 0.8, 0.8), dark, 0, -0.3, 0.3, bucket);
    return { g, body, boom, arm, bucket };
  }

  dumpTruck(yellow, dark) {
    const g = new THREE.Group();
    const add = (geo, m, x, y, z, p = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    add(new THREE.BoxGeometry(2.4, 2.0, 2.0), yellow, 0, 1.9, 2.4);
    add(new THREE.BoxGeometry(2.3, 0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0xcfe4f2, roughness: 0.2 }), 0, 2.4, 3.2);
    add(new THREE.BoxGeometry(2.4, 0.5, 6), dark, 0, 0.9, 0.3);
    const bed = new THREE.Group(); bed.position.set(0, 1.2, -2.6); g.add(bed);
    add(new THREE.BoxGeometry(2.5, 1.4, 4.4), yellow, 0, 0.7, 2.2, bed);
    for (const z of [2.4, -0.6, -2.0]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12).rotateZ(Math.PI / 2), dark, s * 1.15, 0.55, z);
    return { g, bed };
  }

  mixer(yellow, dark) {
    const g = new THREE.Group();
    const add = (geo, m, x, y, z, p = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    add(new THREE.BoxGeometry(2.4, 2.0, 1.9), yellow, 0, 1.9, 2.6);
    add(new THREE.BoxGeometry(2.4, 0.5, 6.4), dark, 0, 0.9, 0.2);
    const drum = new THREE.Group(); drum.position.set(0, 2.3, -0.6); drum.rotation.x = -0.25; g.add(drum);
    const d = add(new THREE.CylinderGeometry(1.0, 1.3, 4.2, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.5 }), 0, 0, 0, drum);
    for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(1.15, 0.06, 4, 18), yellow, 0, 0, -1.4 + i * 1.4, drum);
    for (const z of [2.4, -1.2, -2.4]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12).rotateZ(Math.PI / 2), dark, s * 1.15, 0.55, z);
    return { g, drum, d };
  }

  place(v, dt) {
    const [a, b] = [v.path[v.i], v.path[1 - v.i]];
    const x = a[0] + (b[0] - a[0]) * v.s, z = a[1] + (b[1] - a[1]) * v.s;
    const T = this.w.terrain;
    v.g.position.set(x, T.heightAt(x, z), z);
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    v.g.rotation.y += Math.atan2(Math.sin(yaw - v.g.rotation.y), Math.cos(yaw - v.g.rotation.y)) * Math.min(1, dt * 3 + (dt ? 0 : 1));
  }

  // 골프카트가 앞쪽 10 m 안에 있으면 멈춰요.
  blockedByCart(v) {
    const c = this.cart?.model?.position;
    if (!c || !this.cart.model.visible) return false;
    const p = v.g.position, dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz);
    if (d > 10) return false;
    const fx = Math.sin(v.g.rotation.y), fz = Math.cos(v.g.rotation.y);
    return (dx * fx + dz * fz) / (d || 1) > -0.2 || d < 5;
  }

  update(dt) {
    this.t = (this.t || 0) + dt;
    const t = this.t;
    // 크레인: 천천히 돌면서 벽돌 짐을 올렸다 내려요
    const C = this.crane;
    C.slew.rotation.y = Math.sin(t * 0.08) * 1.4;
    const reach = 10 + (Math.sin(t * 0.13) * 0.5 + 0.5) * 16;
    const drop = 6 + (Math.sin(t * 0.21) * 0.5 + 0.5) * (C.mastH - 12);
    C.trolley.position.set(reach, 0, 0);
    C.cable.scale.y = drop; C.cable.position.y = -drop / 2;
    C.hook.position.y = -drop - 0.4; C.load.position.y = -drop - 1.1;
    for (const v of this.vehicles) {
      if (v.kind === 'excavator') {
        v.t += dt;
        const k = v.t * 0.9;
        v.body.rotation.y = Math.sin(k * 0.5) * 0.9;
        v.boom.rotation.x = -0.35 + Math.sin(k) * 0.25;
        v.arm.rotation.x = 0.6 + Math.sin(k + 1) * 0.35;
        v.bucket.rotation.x = 0.4 + Math.sin(k + 2) * 0.5;
        continue;
      }
      if (v.kind === 'mixer') v.drum.rotation.z += dt * 1.2;
      if (v.wait > 0) { v.wait -= dt; if (v.kind === 'dump') v.bed.rotation.x = v.i === 1 && v.wait > 1 ? -Math.min(0.7, (3 - v.wait) * 0.6) : 0; continue; }
      if (this.blockedByCart(v)) { v.yield = true; continue; }
      v.yield = false;
      const [a, b] = [v.path[v.i], v.path[1 - v.i]];
      const L = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
      v.s += (v.speed * dt) / L;
      if (v.s >= 1) { v.s = 0; v.i = 1 - v.i; v.wait = v.kind === 'dump' ? 4 : 6; }
      this.place(v, dt);
    }
  }

  // 크레인 미니게임 누적 짐 수 → 3층 벽 조각(짐 4개마다 한 조각)
  setProgress(n) {
    const k = Math.min(this.f3.length, Math.floor(n / 4));
    this.f3.forEach((p, i) => { p.visible = i < k; });
  }

  // 장애물(동물·로봇개가 지나가지 않게)
  addObstacles(O) {
    O.addPoly(this.site.poly, 'construction');
    O.addCircle(this.crane.at.x, this.crane.at.z, 2.2, 'crane');
    const ex = this.vehicles.find((v) => v.kind === 'excavator');
    if (ex) O.addCircle(ex.g.position.x, ex.g.position.z, 3, 'excavator');
  }
}
