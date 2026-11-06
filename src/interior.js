import * as THREE from 'three';

// 한빛 인사이드(2.0 베타): 건물 안을 1인칭으로 걸어요. 본관 1층은 점자안내도 그대로의 실 배치예요.
// 복도는 동서로 길게, 가운데 현관·중앙 계단, 앞쪽(운동장 쪽)에 큰 실, 뒤쪽에 작은 실.
const $ = (id) => document.getElementById(id);
const CORR = 3.2, H = 3.2, DEPTH_FRONT = 8, DEPTH_BACK = 4.5;
const widthOf = (n) => (/화장실|창고|서고|인쇄|기구/.test(n) ? 4.5 : /교무실/.test(n) ? 12 : /위클래스|휴게|교감|방송|전산/.test(n) ? 6 : 9);

function plaqueTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1f3d6d'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff'; g.font = '700 30px "Pretendard Variable", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function floorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9c6bf'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { g.fillStyle = ['#b9b5ad', '#d8d5ce', '#a9a59c'][i % 3]; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Interior {
  constructor({ renderer, hap, toast, onExit }) {
    this.renderer = renderer; this.hap = hap; this.toast = toast; this.onExit = onExit;
    this.active = false;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 400);
    this.keys = {}; this.yaw = 0; this.pitch = 0; this.stick = null; this.look = null;
    addEventListener('keydown', (e) => { if (this.active) { this.keys[e.code] = true; if (e.code === 'Escape') this.exit(); } });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      const left = e.clientX < innerWidth * 0.45 && e.pointerType !== 'mouse';
      if (left) this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; else this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (this.stick && e.pointerId === this.stick.id) { this.stick.dx = Math.max(-1, Math.min(1, (e.clientX - this.stick.x) / 60)); this.stick.dy = Math.max(-1, Math.min(1, (e.clientY - this.stick.y) / 60)); }
      if (this.look && e.pointerId === this.look.id) { this.yaw -= (e.clientX - this.look.x) * 0.005; this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - (e.clientY - this.look.y) * 0.004)); this.look.x = e.clientX; this.look.y = e.clientY; }
    });
    addEventListener('pointerup', (e) => { if (this.stick?.id === e.pointerId) this.stick = null; if (this.look?.id === e.pointerId) this.look = null; });
    $('in-exit').addEventListener('click', () => this.exit());
  }

  // data: interiors.json의 한 층 · ctx: { blackboard: 오늘 시간표 문자열 }
  build(name, floor, data, ctx = {}) {
    const S = new THREE.Scene();
    S.background = new THREE.Color('#dfe7ee');
    S.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 1.6));
    const dl = new THREE.DirectionalLight(0xfff4e0, 1.2); dl.position.set(10, 20, 30); S.add(dl);
    const M = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const wall = M('#efe9dc'), trim = M('#8d9399', 0.6), wood = M('#a8794e', 0.7), metal = M('#9aa1a8', 0.4), dark = M('#2f3338', 0.6);
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe6f5', emissive: '#bcdcf2', emissiveIntensity: 0.6, roughness: 0.1 });
    const flo = new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.55 });
    const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); S.add(o); return o; };
    this.walk = []; // 걸을 수 있는 사각형 [x0, z0, x1, z1]
    this.rooms = [];
    // 실을 날개별·앞뒤로 나누기
    const rooms = data.rooms || [];
    const west = rooms.filter((r) => r.wing === '서'), east = rooms.filter((r) => r.wing === '동' && r.side !== '끝'), ends = rooms.filter((r) => r.side === '끝');
    const LOBBY = 10;
    const lay = (list, dir) => { // dir: -1 서쪽(왼쪽으로), +1 동쪽
      const out = { front: [], back: [] };
      for (const side of ['앞', '뒤']) { let x = dir * LOBBY / 2; for (const r of list.filter((q) => q.side === side)) { const w = widthOf(r.name); out[side === '앞' ? 'front' : 'back'].push({ ...r, x0: dir < 0 ? x - w : x, x1: dir < 0 ? x : x + w }); x += dir * w; } }
      return out;
    };
    const W = lay(west, -1), E = lay(east, 1);
    const xmin = Math.min(-LOBBY / 2, ...[...W.front, ...W.back].map((r) => r.x0)) - 4;
    let xmax = Math.max(LOBBY / 2, ...[...E.front, ...E.back].map((r) => r.x1)) + 2;
    // 동쪽 끝 화장실(복도 끝에)
    const endRooms = ends.map((r, i) => ({ ...r, x0: xmax + i * 4.5, x1: xmax + (i + 1) * 4.5, endRoom: true }));
    if (endRooms.length) xmax = endRooms[endRooms.length - 1].x1 + 0.5;
    const L = xmax - xmin, cx = (xmin + xmax) / 2;
    // 복도 바닥·천장·끝벽
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(L, CORR + DEPTH_FRONT * 2 + DEPTH_BACK * 2).rotateX(-Math.PI / 2), flo);
    fl.material.map.repeat.set(L / 2, (CORR + DEPTH_FRONT * 2) / 2); fl.position.set(cx, 0, 0); S.add(fl);
    box(L, 0.2, CORR + DEPTH_FRONT + DEPTH_BACK + 0.6, cx, H + 0.1, (DEPTH_FRONT - DEPTH_BACK) / 2, M('#f6f5f2'));
    for (let x = xmin + 3; x < xmax; x += 5) { const l = box(1.6, 0.04, 0.5, x, H - 0.02, 0, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.9 })); l.userData.light = true; }
    box(0.2, H, CORR, xmin, H / 2, 0, wall); box(0.2, H, CORR, xmax, H / 2, 0, wall);
    this.walk.push([xmin + 0.4, -CORR / 2 + 0.35, xmax - 0.4, CORR / 2 - 0.35]);
    // 현관(앞쪽으로 뚫림) + 경사로 + 중앙 계단(뒤쪽)
    this.walk.push([-LOBBY / 2 + 0.4, -CORR / 2, LOBBY / 2 - 0.4, CORR / 2 + 6]);
    box(LOBBY, 0.3, 4, 0, -0.15, CORR / 2 + 5, M('#bdb8ae'));
    box(LOBBY - 2, 2.4, 0.08, 0, 1.5, CORR / 2 + 7, glass); // 현관 유리문
    const stairs = (x, z, dz) => { for (let i = 0; i < 10; i++) box(3, 0.18, 0.3, x, 0.09 + i * 0.18, z + dz * (0.6 + i * 0.3), M('#d6d2ca')); return { x, z: z + dz * 2 }; };
    this.stairs = [stairs(0, -CORR / 2, -1), stairs(xmin + 2, -CORR / 2, -1), stairs(xmax - 2, -CORR / 2, -1)];
    // 실 하나 만들기
    const makeRoom = (r, front, endRoom) => {
      const depth = endRoom ? CORR : front ? DEPTH_FRONT : DEPTH_BACK, w = r.x1 - r.x0, mx = (r.x0 + r.x1) / 2;
      const z0 = endRoom ? -CORR / 2 : front ? CORR / 2 : -CORR / 2 - depth, z1 = endRoom ? CORR / 2 : front ? CORR / 2 + depth : -CORR / 2;
      const mz = (z0 + z1) / 2, doorW = 1.2;
      if (!endRoom) {
        // 복도 쪽 벽(문 구멍 남기고)
        const wz = front ? z0 : z1, dx = r.x0 + Math.min(1.6, w * 0.25);
        box(dx - r.x0 - doorW / 2, H, 0.15, (r.x0 + dx - doorW / 2) / 2, H / 2, wz, wall);
        box(r.x1 - dx - doorW / 2, H, 0.15, (dx + doorW / 2 + r.x1) / 2, H / 2, wz, wall);
        box(doorW, H - 2.2, 0.15, dx, 2.2 + (H - 2.2) / 2, wz, wall);
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: plaqueTex(r.name) }));
        pl.position.set(dx, 2.5, wz + (front ? -0.09 : 0.09)); pl.rotation.y = front ? Math.PI : 0; S.add(pl);
        this.walk.push([dx - doorW / 2 + 0.25, Math.min(wz - 0.5, wz + 0.5), dx + doorW / 2 - 0.25, Math.max(wz - 0.5, wz + 0.5)]);
        // 바깥벽(앞쪽 실은 큰 창)
        const oz = front ? z1 : z0;
        if (front) { box(w, 0.9, 0.2, mx, 0.45, oz, wall); box(w - 0.4, 1.7, 0.06, mx, 1.75, oz, glass); box(w, H - 2.6, 0.2, mx, 2.6 + (H - 2.6) / 2, oz, wall); }
        else box(w, H, 0.2, mx, H / 2, oz, wall);
        box(0.15, H, depth, r.x0, H / 2, mz, wall); box(0.15, H, depth, r.x1, H / 2, mz, wall);
      } else {
        box(0.15, H, CORR, r.x1, H / 2, 0, wall);
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: plaqueTex(r.name) }));
        pl.position.set(r.x0 + 0.1, 2.5, 0); pl.rotation.y = Math.PI / 2; S.add(pl);
      }
      box(w, 0.2, depth, mx, H + 0.1, mz, M('#f6f5f2'));
      this.walk.push([r.x0 + 0.4, Math.min(z0, z1) + 0.4, r.x1 - 0.4, Math.max(z0, z1) - 0.4]);
      this.rooms.push({ name: r.name, x0: r.x0, x1: r.x1, z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
      // 가구(실 이름으로 종류를 정해요)
      const n = r.name, inner = (fx, fz) => [r.x0 + 0.8 + fx * (w - 1.6), Math.min(z0, z1) + 0.8 + fz * (depth - 1.6)];
      if (/생물|화학|과학교과|실험/.test(n)) { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const [x, z] = inner(0.25 + i * 0.5, 0.3 + j * 0.45); box(2.4, 0.9, 1.1, x, 0.45, z, M('#e8e6e0')); box(0.5, 0.05, 0.4, x + 0.8, 0.92, z, metal); } }
      else if (/교무|행정|교감|휴게|전산|방송|인쇄/.test(n)) { for (let i = 0; i < Math.max(1, Math.floor(w / 3)); i++) { const [x, z] = inner((i + 0.5) / Math.max(1, Math.floor(w / 3)), 0.5); box(1.4, 0.75, 0.7, x, 0.375, z, wood); box(0.55, 0.35, 0.04, x, 0.95, z - 0.15, dark); } }
      else if (/서고|창고|기구/.test(n)) { for (let i = 0; i < 2; i++) { const [x, z] = inner(0.5, 0.2 + i * 0.6); box(w - 1.6, 2.0, 0.4, x, 1.0, z, wood); } }
      else if (/화장실/.test(n)) { for (let i = 0; i < 3; i++) { const [x, z] = inner(0.5, i / 3); box(0.05, 2.0, 1.0, x - 0.6, 1.0, z, M('#c9d6e0')); } }
      else if (/위클래스/.test(n)) { const [x, z] = inner(0.5, 0.5); box(2.2, 0.45, 0.8, x, 0.225, z - 0.8, M('#7aa3c8')); box(1.0, 0.5, 1.0, x, 0.25, z + 0.4, wood); }
      else { // 일반 교실: 책상 줄 + 칠판(오늘 시간표)
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const [x, z] = inner(0.15 + i * 0.23, 0.3 + j * 0.25); box(0.6, 0.72, 0.45, x, 0.36, z, wood); }
      }
      if (front && !/화장실|창고/.test(n) && !endRoom) {
        const bb = document.createElement('canvas'); bb.width = 512; bb.height = 160; const g = bb.getContext('2d');
        g.fillStyle = '#25483a'; g.fillRect(0, 0, 512, 160); g.fillStyle = '#f2f2ea'; g.font = '600 28px "Pretendard Variable", sans-serif'; g.fillText(n, 20, 44); g.font = '22px "Pretendard Variable", sans-serif'; g.fillText(ctx.blackboard || '오늘도 화이팅!', 20, 100);
        const t = new THREE.CanvasTexture(bb); t.colorSpace = THREE.SRGBColorSpace;
        const b = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(4, w - 1), 1.2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
        b.position.set(r.x0 + 0.1, 1.5, mz); b.rotation.y = Math.PI / 2; S.add(b);
      }
    };
    for (const r of [...W.front, ...E.front]) makeRoom(r, true);
    for (const r of [...W.back, ...E.back]) makeRoom(r, false);
    for (const r of endRooms) makeRoom(r, false, true);
    // 복도 뒤쪽 벽(뒤 실이 없는 구간), 앞쪽 벽(현관 제외)
    const backCovered = [...W.back, ...E.back].map((r) => [r.x0, r.x1]), frontCovered = [...W.front, ...E.front].map((r) => [r.x0, r.x1]).concat([[-LOBBY / 2, LOBBY / 2]]);
    const fillGaps = (covered, z) => { const sorted = covered.sort((a, b) => a[0] - b[0]); let x = xmin; for (const [a, b] of sorted) { if (a - x > 0.1) box(a - x, H, 0.15, (x + a) / 2, H / 2, z, wall); x = Math.max(x, b); } if (xmax - x > 0.1) box(xmax - x, H, 0.15, (x + xmax) / 2, H / 2, z, wall); };
    fillGaps(backCovered.concat(this.stairs.map((s) => [s.x - 1.5, s.x + 1.5])), -CORR / 2);
    fillGaps(frontCovered, CORR / 2);
    // 걸레받이 띠
    box(L, 0.12, 0.02, cx, 0.06, CORR / 2 - 0.08, trim); box(L, 0.12, 0.02, cx, 0.06, -CORR / 2 + 0.08, trim);
    this.scene = S; this.name = name; this.floor = floor;
    this.pos = new THREE.Vector3(0, 1.6, CORR / 2 + 4.5); this.yaw = 0; this.pitch = 0;
    return this;
  }

  inside(x, z) { return this.walk.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d); }

  enter() {
    this.active = true;
    document.body.classList.add('inside');
    $('in-hud').hidden = false;
    $('in-where').textContent = `${this.name} ${this.floor}`;
    this.hap?.play('toggle');
    this.toast?.(`${this.name} ${this.floor}`, '왼쪽(또는 WASD)으로 걷고, 오른쪽을 끌어 둘러봐요. 계단 옆에서 2층은 아직 준비 중이에요.');
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove('inside');
    $('in-hud').hidden = true;
    this.onExit?.();
  }

  update(dt) {
    if (!this.active) return;
    const k = this.keys, f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - (this.stick?.dy || 0);
    const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + (this.stick?.dx || 0);
    if (k.ArrowLeft) this.yaw += dt * 1.8; if (k.ArrowRight) this.yaw -= dt * 1.8;
    const sp = (k.ShiftLeft ? 4.2 : 2.4) * dt, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const nx = this.pos.x + (fx * f + -fz * s) * sp, nz = this.pos.z + (fz * f + fx * s) * sp;
    if (this.inside(nx, nz)) { this.pos.x = nx; this.pos.z = nz; } else if (this.inside(nx, this.pos.z)) this.pos.x = nx; else if (this.inside(this.pos.x, nz)) this.pos.z = nz;
    // 현관 밖으로 나가면 끝
    if (this.pos.z > CORR / 2 + 5.6) { this.exit(); return; } // 현관 유리문 앞까지 오면 밖으로
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // 지금 있는 실 이름 · 계단 근처 안내
    const r = this.rooms.find((q) => this.pos.x >= q.x0 && this.pos.x <= q.x1 && this.pos.z >= q.z0 && this.pos.z <= q.z1);
    const st = this.stairs.find((q) => Math.hypot(q.x - this.pos.x, q.z - this.pos.z) < 2.4);
    $('in-where').textContent = `${this.name} ${this.floor}${r ? ` · ${r.name}` : st ? ' · 계단(2층은 안내도를 받으면 열려요)' : ' · 복도'}`;
  }

  render() {
    const w = innerWidth, h = innerHeight;
    if (this.camera.aspect !== w / h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.renderer.render(this.scene, this.camera);
  }
}
