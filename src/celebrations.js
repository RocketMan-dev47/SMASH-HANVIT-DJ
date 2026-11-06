import * as THREE from 'three';
import { taegukgiCanvas } from './flag.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Flyers } from './extras.js';

// 기념일 특별 에디션 연출(크리스마스·시험 끝·수능은 따로 있어요)
const paint = (geo, color) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
};

function bannerTex(text, bg, fg, accent) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 200);
  g.fillStyle = accent; g.fillRect(0, 0, 1024, 14); g.fillRect(0, 186, 1024, 14);
  g.fillStyle = fg; g.font = '800 80px "Pretendard Variable", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512, 104);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 글자를 점 위치로(드론쇼 대형)
function textPoints(text, n, w, h) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 120;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 320, 120);
  g.fillStyle = '#fff'; g.font = '900 96px "Pretendard Variable", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 160, 64);
  let data = null;
  try { data = g.getImageData(0, 0, 320, 120).data; } catch { /* 무시 */ }
  const pts = [];
  if (data && data.length) for (let y = 0; y < 120; y += 3) for (let x = 0; x < 320; x += 3) if (data[(y * 320 + x) * 4] > 128) pts.push([(x / 320 - 0.5) * w, (0.5 - y / 120) * h]);
  const out = [];
  for (let i = 0; i < n; i++) out.push(pts.length ? pts[Math.floor((i / n) * pts.length)] : [(Math.random() - 0.5) * w, (Math.random() - 0.5) * h]);
  return out;
}
const heartPoints = (n, s) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [s * 16 * Math.sin(t) ** 3 / 16, s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; });

export class Celebrations {
  constructor(world, { pitch, mainB, buildings, roads, busAt, flood, foundingYear = 2000 }) {
    this.w = world;
    this.pitch = pitch; // orientedBox
    this.mainB = mainB;
    this.buildings = buildings;
    this.roads = roads || [];
    this.busAt = busAt;
    this.founding = foundingYear;
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.kind = null;
    this.t = 0;
    this.items = [];
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
    const S = world.scene, T = world.terrain;
    // 폭발하면 튀어나오는 것들
    this.candy = new Flyers(S, T, mergeGeometries([paint(new THREE.SphereGeometry(0.35, 10, 8).scale(1.4, 1, 1), '#ff6fae'), paint(new THREE.ConeGeometry(0.28, 0.4, 8).rotateZ(Math.PI / 2).translate(-0.62, 0, 0), '#ffd34d'), paint(new THREE.ConeGeometry(0.28, 0.4, 8).rotateZ(-Math.PI / 2).translate(0.62, 0, 0), '#ffd34d')]), vc, 80);
    this.sticks = new Flyers(S, T, mergeGeometries([paint(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8).translate(0, -0.35, 0), '#e8c08a'), paint(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8).translate(0, 0.7, 0), '#4a2412')]), vc, 90);
    this.caps = new Flyers(S, T, mergeGeometries([paint(new THREE.BoxGeometry(1.4, 0.08, 1.4).translate(0, 0.32, 0), '#111318'), paint(new THREE.CylinderGeometry(0.42, 0.46, 0.34, 12).translate(0, 0.12, 0), '#111318'), paint(new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(0.6, 0.05, 0.6), '#ffc94a')]), vc, 60, { gravity: 9, drag: 0.6 });
    const jamoMat = (ch) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c0392b'; g.font = '900 48px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); };
    this.jamo = ['ㄱ', 'ㄴ', 'ㅎ', 'ㅏ'].map((ch) => new Flyers(S, T, new THREE.BoxGeometry(1, 1, 1), jamoMat(ch), 30));
  }

  // 폭발 지점에서 에디션별로 튀어나와요.
  burst(P, R) {
    const n = Math.min(24, 6 + Math.round(R));
    if (this.kind === 'halloween') this.candy.spawn(P, n, 14, 1.4);
    if (this.kind === 'stickday') this.sticks.spawn(P, n, 14, 1.6);
    if (this.kind === 'hangul') this.jamo.forEach((f) => f.spawn(P, Math.ceil(n / 4), 13, 1.3));
    if (this.kind === 'graduation') this.caps.spawn(P, Math.ceil(n / 2), 16, 1.5);
    const THEME = { newyear: ['#ffd700', '#ff5d5d', '#ffffff'], seollal: ['#d63a4a', '#f3b33d', '#2f6fe0', '#3fa34d'], chuseok: ['#ffe08a', '#f5cf6a', '#ffffff'], valentine: ['#ff5d8f', '#ff8fb1', '#e8456f'], whiteday: ['#ffffff', '#bfe3ff', '#ffd1e0'], arbor: ['#4caf50', '#7cc36b', '#2f7a3a'], earth: ['#4caf50', '#3a8fd6', '#7cc36b'], students: ['#1f3d8a', '#ffc94a', '#ffffff'], dongji: ['#8b2a2a', '#5a4d9e'], parents: ['#ff8fb1', '#ffffff'], children: ['#ff5d5d', '#ffd60a', '#64d2ff', '#30d158'] }[this.kind];
    if (THEME) for (const c of THEME) this.w.fx.burst?.(P.clone().add(new THREE.Vector3(0, 3, 0)), new THREE.Color(c), Math.ceil((40 + R * 4) / THEME.length));
  }

  // ---------- 기념일 모으기: 그날만의 물건 12개를 눌러 모아요 ----------
  spawnCollect(kind) {
    const SPEC = {
      newyear: ['복 동전', '새해 복 동전을 모아요'], seollal: ['복주머니', '숨은 복주머니를 찾아요'], chuseok: ['청사초롱', '꺼진 청사초롱에 불을 켜요'],
      valentine: ['하트 풍선', '하트 풍선을 터뜨려요'], whiteday: ['사탕', '흩어진 사탕을 모아요'], samil: ['태극기', '빈 깃대에 태극기를 달아요'], gwangbok: ['태극기', '빈 깃대에 태극기를 달아요'],
      arbor: ['나무 심기', '빛나는 자리에 나무를 심어요'], earth: ['나무 심기', '빛나는 자리에 나무를 심어요'], students: ['종이비행기', '날아다니는 종이비행기를 잡아요'], dongji: ['팥죽', '따뜻한 팥죽 그릇을 모아요'], halloween: ['호박', '숨은 호박을 찾아요'],
    }[kind];
    this.collect = null;
    if (!SPEC || !this.pitch) return;
    const T = this.w.terrain, P = this.pitch;
    // 자리: 길가와 운동장 둘레를 섞어서 12곳
    const road = this.roadside(30, 4).filter((_, i) => i % 2 === 0);
    const ring = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2 + 0.2; return [P.cx + Math.cos(a) * (P.L / 2 + 10), P.cz + Math.sin(a) * (P.W / 2 + 10)]; });
    const spots = [];
    for (let i = 0; spots.length < 12 && i < 40; i++) { const q = (i % 2 ? road[i >> 1] : ring[i >> 1]) || ring[i % 12]; if (q && !spots.some((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) < 12)) spots.push(q); }
    const M = (c, e = 0, ec) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: ec || c, emissiveIntensity: e });
    const make = () => {
      const g = new THREE.Group(), add = (geo, m, y = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; g.add(o); return o; };
      if (kind === 'newyear') { add(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 20).rotateX(Math.PI / 2), M('#ffd23f', 0.5), 2.2); g.userData.float = 2.2; }
      else if (kind === 'seollal') { const b = add(new THREE.SphereGeometry(0.8, 14, 10), M('#d63a4a', 0.15), 0.85); b.scale.set(1, 1.1, 1); add(new THREE.ConeGeometry(0.38, 0.55, 10), M('#f3b33d'), 1.8); }
      else if (kind === 'chuseok') { add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6), M('#6b4a2e'), 1.3); g.userData.top = add(new THREE.CylinderGeometry(0.28, 0.28, 0.32, 10), M('#5a2a2a', 0, '#ff5a3c'), 2.4); g.userData.bot = add(new THREE.CylinderGeometry(0.28, 0.28, 0.26, 10), M('#20294a', 0, '#3b5bff'), 2.1); }
      else if (kind === 'valentine') { const sh = new THREE.Shape(); sh.moveTo(0, -1); sh.bezierCurveTo(-1.4, 0, -0.9, 1.1, 0, 0.5); sh.bezierCurveTo(0.9, 1.1, 1.4, 0, 0, -1); add(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }), M('#ff5d8f', 0.25), 4); g.userData.float = 4; }
      else if (kind === 'whiteday') { add(new THREE.SphereGeometry(0.55, 14, 10), M('#bfe3ff', 0.2), 1.4); const w1 = add(new THREE.ConeGeometry(0.35, 0.6, 8), M('#ffffff'), 1.4); w1.rotation.z = Math.PI / 2; w1.position.x = 0.75; const w2 = add(new THREE.ConeGeometry(0.35, 0.6, 8), M('#ffffff'), 1.4); w2.rotation.z = -Math.PI / 2; w2.position.x = -0.75; g.userData.float = 1.4; }
      else if (kind === 'samil' || kind === 'gwangbok') { add(new THREE.CylinderGeometry(0.05, 0.06, 4.2, 6), M('#d9d9d9'), 2.1); const f = add(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshStandardMaterial({ map: this.flagTex(), side: THREE.DoubleSide }), 3.6); f.position.x = 0.78; f.visible = false; g.userData.flag = f; }
      else if (kind === 'arbor' || kind === 'earth') { const r = add(new THREE.TorusGeometry(0.9, 0.08, 6, 24).rotateX(Math.PI / 2), M('#7cff8a', 1.2), 0.05); g.userData.ring = r; const tree = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1, 6), M('#7a5230')); t.position.y = 0.5; const l = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 8), M('#4caf50')); l.position.y = 1.5; tree.add(t, l); tree.scale.setScalar(0.01); tree.visible = false; g.add(tree); g.userData.tree = tree; }
      else if (kind === 'students') { const sh = new THREE.Shape([new THREE.Vector2(0, 0.9), new THREE.Vector2(0.7, -0.6), new THREE.Vector2(0, -0.2), new THREE.Vector2(-0.7, -0.6)]); const pl = add(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.2 }), 3); pl.rotation.x = -Math.PI / 2.4; g.userData.float = 3; g.userData.fly = true; }
      else if (kind === 'dongji') { add(new THREE.CylinderGeometry(0.6, 0.4, 0.4, 16), M('#d9c8a5'), 0.2); add(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16), M('#8b2a2a', 0.2), 0.42); }
      else if (kind === 'halloween') { const b = add(new THREE.SphereGeometry(0.8, 14, 10), M('#ff7a00', 0.35), 0.7); b.scale.set(1.2, 0.85, 1.2); add(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 6), M('#3f6b2a'), 1.45); }
      return g;
    };
    const items = spots.map(([x, z], i) => { const g = make(); g.position.set(x, T.heightAt(x, z), z); g.userData.ph = i * 0.7; g.userData.base = g.position.y; this.group.add(g); const it = { type: 'collect', g, done: false }; this.items.push(it); return it; });
    this.collect = { kind, label: SPEC[0], hint: SPEC[1], items, got: 0 };
    this.w.ui?.toast?.(`🎁 ${SPEC[1]}`, `캠퍼스 곳곳에 ${items.length}개 · 눌러서 모아요`, 'gold');
  }

  flagTex() { if (!this._flagTex) { this._flagTex = new THREE.CanvasTexture(taegukgiCanvas(256)); this._flagTex.colorSpace = THREE.SRGBColorSpace; } return this._flagTex; }

  // 화면을 누른 자리 근처(36px)에 모을 물건이 있으면 모아요
  pickScreen(sx, sy, camera, rect) {
    const C = this.collect;
    if (!C) return false;
    let best = null, bd = 36;
    for (const it of C.items) {
      if (it.done) continue;
      const p = it.g.position.clone(); p.y += it.g.userData.float || 1;
      p.project(camera);
      if (p.z > 1) continue;
      const x = rect.left + ((p.x + 1) / 2) * rect.width, y = rect.top + ((1 - p.y) / 2) * rect.height, d = Math.hypot(x - sx, y - sy);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) return false;
    best.done = true; C.got++;
    const u = best.g.userData, P = best.g.position.clone().add(new THREE.Vector3(0, (u.float || 1) + 0.5, 0));
    if (C.kind === 'chuseok') { u.top.material.emissiveIntensity = 1.4; u.top.material.color.set('#d63a4a'); u.bot.material.emissiveIntensity = 1.0; u.bot.material.color.set('#2f4fb0'); }
    else if (u.flag) u.flag.visible = true;
    else if (u.tree) { u.tree.visible = true; u.ring.visible = false; u.grow = 0; }
    else best.g.visible = false;
    this.w.fx.burst?.(P, new THREE.Color(C.kind === 'valentine' ? '#ff5d8f' : C.kind === 'newyear' ? '#ffd700' : '#ffffff'), 40);
    this.onCollect?.(C.got, C.items.length, C.label, C.kind);
    return true;
  }

  clear() {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.items = [];
    this.collect = null;
    this.drones = null;
    this.jelly = false;
    for (const b of this.buildings.list) this.unjelly(b);
    document.body.classList.remove('hangul', 'ed-parents');
  }

  // 본관 앞 현수막
  banner(text, bg, fg, accent) {
    const B = this.mainB, P = this.pitch;
    if (!B || !P) return;
    let best = null;
    for (let i = 0; i < B.poly.length; i++) {
      const a = B.poly[i], b = B.poly[(i + 1) % B.poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 14) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = Math.hypot(mx - P.cx, mz - P.cz);
      if (!best || d < best.d) best = { a, b, L, mx, mz, d };
    }
    if (!best) return;
    let nx = (best.b[1] - best.a[1]) / best.L, nz = -(best.b[0] - best.a[0]) / best.L;
    if ((P.cx - best.mx) * nx + (P.cz - best.mz) * nz < 0) { nx = -nx; nz = -nz; }
    const L = Math.min(30, best.L * 0.6);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, L * 0.2), new THREE.MeshStandardMaterial({ map: bannerTex(text, bg, fg, accent), side: THREE.DoubleSide, roughness: 0.8 }));
    m.position.set(best.mx + nx * 0.5, B.base + B.levels * B.floorH * 0.7, best.mz + nz * 0.5);
    m.rotation.y = Math.atan2(nx, nz);
    this.group.add(m);
    this.front = { x: best.mx, z: best.mz, nx, nz, L: best.L, tx: (best.b[0] - best.a[0]) / best.L, tz: (best.b[1] - best.a[1]) / best.L };
  }

  // 길가를 따라 일정 간격의 점
  roadside(step, off) {
    const out = [];
    for (const r of this.roads) for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let s = step / 2; s < L; s += step) { const sd = (out.length % 2 ? 1 : -1) * (r.w / 2 + off); const x = ax + ((bx - ax) * s) / L + nx * sd, z = az + ((bz - az) * s) / L + nz * sd; if (this.w.terrain.inside(x, z)) out.push([x, z]); }
    }
    return out;
  }

  enable(kind) {
    this.clear();
    this.kind = kind;
    setTimeout(() => { if (this.kind === kind) this.spawnCollect(kind); }, 0);
    this.t = 0;
    const T = this.w.terrain, P = this.pitch;
    const at = (x, z, y = 0) => new THREE.Vector3(x, T.heightAt(x, z) + y, z);
    if (kind === 'halloween') {
      this.banner('🎃 HAPPY HALLOWEEN 한빛 🎃', '#1a0f2e', '#ffb347', '#ff7a00');
      // 잭오랜턴: 주황 호박 + 빛나는 얼굴(앞쪽 노란 판) + 꼭지
      const pump = mergeGeometries([paint(new THREE.SphereGeometry(1, 14, 10).scale(1.25, 0.9, 1.25).translate(0, 0.9, 0), '#ff7a00'), paint(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6).translate(0, 1.95, 0), '#3b6b1f')]);
      const face = new THREE.PlaneGeometry(1.3, 0.75).translate(0, 0.95, 1.16);
      const spots = this.roadside(14, 2.5).slice(0, 48);
      const pm = new THREE.InstancedMesh(pump, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x3a1500, emissiveIntensity: 0.6 }), spots.length);
      const fm = new THREE.InstancedMesh(face, new THREE.MeshBasicMaterial({ map: this.faceTex(), transparent: true }), spots.length);
      const mm = new THREE.Matrix4();
      spots.forEach(([x, z], i) => { const s = 1 + Math.random() * 0.7; mm.compose(at(x, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6.28, 0)), new THREE.Vector3(s, s, s)); pm.setMatrixAt(i, mm); fm.setMatrixAt(i, mm); });
      pm.castShadow = true;
      this.group.add(pm, fm);
      // 유령
      const ghostMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, emissive: 0x8888aa, emissiveIntensity: 0.4 });
      for (let i = 0; i < 7; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), ghostMat));
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 2.4, 16, 1, true), ghostMat);
        skirt.position.y = -1.2; g.add(skirt);
        for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 })); e.position.set(sx * 0.45, 0.4, 1.25); g.add(e); }
        const a = (i / 7) * Math.PI * 2;
        g.userData = { cx: P.cx + Math.cos(a) * 60, cz: P.cz + Math.sin(a) * 60, r: 12 + Math.random() * 18, ph: Math.random() * 6, h: 14 + Math.random() * 10 };
        this.group.add(g);
        this.items.push({ type: 'ghost', g });
      }
      this.w.seasons?.special('halloween');
    } else if (kind === 'stickday') {
      this.banner('🍫 11·11 막대과자 데이 🍫', '#fff1dc', '#7a3e12', '#d8a35a');
      // 운동장에 거대한 '11': 과자 막대(아래 1/3 비스킷 + 위 2/3 초콜릿)
      const stick = mergeGeometries([paint(new THREE.CylinderGeometry(0.9, 0.9, 7, 16).translate(0, 3.5, 0), '#e8c08a'), paint(new THREE.CylinderGeometry(1.05, 1.05, 15, 16).translate(0, 14.5, 0), '#4a2412'), paint(new THREE.SphereGeometry(1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 22, 0), '#4a2412')]);
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
      for (const off of [-5, 5]) {
        const m = new THREE.Mesh(stick, mat);
        const x = P.cx + Math.cos(P.angle) * off, z = P.cz + Math.sin(P.angle) * off;
        m.position.copy(at(x, z)); m.rotation.z = off * 0.012; m.castShadow = true;
        this.group.add(m);
      }
    } else if (kind === 'anniv') {
      const years = new Date().getFullYear() - this.founding;
      this.banner(`🎂 개교 ${years}주년 · 한빛`, '#0e1a3a', '#ffd479', '#ffc94a');
      // 드론 300대: 흩어짐 → '한빛' → 'N주년' → 하트, 6초마다 바뀌어요.
      const N = 300, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pts.frustumCulled = false;
      this.group.add(pts);
      const W = 80, H = 30;
      const forms = [Array.from({ length: N }, () => [(Math.random() - 0.5) * W * 1.4, (Math.random() - 0.5) * H * 1.6]), textPoints('한빛', N, W, H), textPoints(`${years}주년`, N, W, H), heartPoints(N, 14)];
      this.drones = { pts, pos, col, forms, cur: forms[0].map((p) => [...p]), i: 0, center: at(P.cx, P.cz, 70), yaw: Math.atan2(-Math.sin(P.angle), Math.cos(P.angle)) };
    } else if (kind === 'teachers') {
      this.banner('💐 선생님 감사합니다 💐', '#fff0f3', '#c0392b', '#ff6fae');
      // 본관 창가 카네이션
      const F = this.front;
      if (F) {
        const flower = mergeGeometries([paint(new THREE.SphereGeometry(0.42, 10, 8).scale(1, 0.75, 1).translate(0, 0.55, 0), '#e8253f'), paint(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5).translate(0, 0.15, 0), '#2f7a3a')]);
        const n = Math.floor(F.L / 2.2) * 3;
        const fm = new THREE.InstancedMesh(flower, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), n);
        const m = new THREE.Matrix4(); let k = 0;
        for (let fl = 1; fl <= 3; fl++) for (let s = -F.L / 2 + 1; s < F.L / 2 && k < n; s += 2.2) {
          const x = F.x + F.tx * s + F.nx * 0.45, z = F.z + F.tz * s + F.nz * 0.45, y = this.mainB.base + fl * this.mainB.floorH + 0.1;
          m.makeTranslation(x, y, z); fm.setMatrixAt(k++, m);
        }
        fm.count = k;
        this.group.add(fm);
      }
    } else if (kind === 'sports') {
      this.banner('🏃 한빛 체육대회 · 점수 2배!', '#eaf6ff', '#1f4fa8', '#ff453a');
      this.bunting();
    } else if (kind === 'festival') {
      this.banner('🎤 한빛 축제', '#1a1030', '#ff9fd8', '#8a5cf0');
      this.stage();
    } else if (kind === 'entrance') {
      this.banner('🌸 입학을 환영해요 🌸', '#fff4f8', '#d6336c', '#ff9fc6');
      this.arch();
      this.w.seasons?.special('spring');
    } else if (kind === 'graduation') {
      this.banner('🎓 졸업을 축하해요 🎓', '#0e1a3a', '#ffd479', '#ffc94a');
    } else if (kind === 'hangul') {
      this.banner('ㄱ ㄴ ㄷ  한글날  ㄹ ㅁ ㅂ', '#fffaf0', '#2b2b2b', '#c0392b');
      document.body.classList.add('hangul');
    } else if (kind === 'children' || kind === 'aprilfools') {
      this.banner(kind === 'children' ? '🎈 어린이날 · 말랑말랑 한빛 🎈' : '🤪 만우절 · 오늘 학교는 젤리로 지었어요', '#fff8e1', '#e8452c', '#ffc94a');
      this.jelly = true;
      if (kind === 'children') this.balloons();
    } else if (kind === 'science') {
      this.banner('🔬 과학의 날 · HASA 특별 임무', '#06243f', '#8fd3ff', '#5ac8fa');
    } else if (kind === 'firstsnow') {
      this.banner('❄️ 첫눈이 와요 ❄️', '#f4f8ff', '#2f6fe0', '#8fd3ff');
    } else if (kind === 'newyear') {
      this.banner('🎉 새해 복 많이 받으세요 🎉', '#fff8e1', '#c8102e', '#ffd700'); this.w.seasons?.special('confetti'); this.fireT = 1;
    } else if (kind === 'seollal') {
      this.banner('🧧 설날 · 새해 복 많이 받으세요', '#fff1f0', '#b0182c', '#f3b33d'); this.w.seasons?.special('saekdong'); this.kites(); this.bags();
    } else if (kind === 'chuseok') {
      this.banner('🌕 풍성한 한가위 되세요', '#fff9e6', '#7a4a12', '#ffcf5c'); this.moon(); this.lanterns();
    } else if (kind === 'valentine') {
      this.banner('💝 해피 발렌타인데이', '#fff0f5', '#d0457a', '#ff8fb1'); this.w.seasons?.special('hearts');
    } else if (kind === 'whiteday') {
      this.banner('🍬 해피 화이트데이', '#f7fbff', '#2f6fe0', '#bfe3ff'); this.w.seasons?.special('candy');
    } else if (kind === 'samil' || kind === 'gwangbok') {
      this.banner(kind === 'samil' ? '삼일절 · 대한독립 만세' : '광복절 · 빛을 되찾은 날', '#ffffff', '#1f3d8a', '#c8102e'); this.flags('kr');
    } else if (kind === 'arbor' || kind === 'earth') {
      this.banner(kind === 'arbor' ? '🌱 식목일 · 나무 한 그루' : '🌍 지구의 날 · 지구를 위한 하루', '#f1fbef', '#2f7a3a', '#7cc36b'); this.w.seasons?.special('leafgreen'); if (kind === 'arbor') this.saplings();
    } else if (kind === 'students') {
      this.banner('📣 학생의 날 · 학생독립운동기념일', '#f5f7ff', '#1f3d8a', '#ffc94a'); this.flags('school');
    } else if (kind === 'dongji') {
      this.banner('🌙 동지 · 일 년 중 가장 긴 밤', '#f4f1ff', '#3b2f6e', '#b25a5a'); this.w.seasons?.special('beans');
    } else if (kind === 'parents') {
      // 어버이날: 폭닥한 솜뭉치 구름 + 동물 가족 행렬 + 파스텔 화면
      this.banner('💐 엄마 아빠, 사랑해요 💐', '#fff5f7', '#d0457a', '#ffb7cf');
      this.w.seasons?.special('cotton');
      document.body.classList.add('ed-parents');
      this.cotton();
      this.parade();
    }
  }

  // 길을 따라 깃발(태극기 또는 한빛 깃발)
  flags(type) {
    let tex;
    if (type === 'kr') { tex = new THREE.CanvasTexture(taegukgiCanvas(256)); }
    else { const c = document.createElement('canvas'); c.width = 128; c.height = 84; const g = c.getContext('2d'); g.fillStyle = '#1f3d8a'; g.fillRect(0, 0, 128, 84); g.fillStyle = '#ffc94a'; g.fillRect(0, 34, 128, 16); g.fillStyle = '#fff'; g.font = '800 20px sans-serif'; g.fillText('HANVIT', 22, 28); tex = new THREE.CanvasTexture(c); }
    tex.colorSpace = THREE.SRGBColorSpace;
    const pole = new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.5, roughness: 0.4 }), cloth = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
    for (const [x, z] of this.roadside(20, 2.6).slice(0, 36)) {
      const g = new THREE.Group(); g.position.set(x, this.w.terrain.heightAt(x, z), z); g.rotation.y = Math.random() * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4.2, 6), pole); p.position.y = 2.1; g.add(p);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), cloth); f.position.set(0.78, 3.6, 0); g.add(f);
      this.group.add(g); this.items.push({ type: 'flag', m: f, ph: Math.random() * 6 });
    }
  }

  // 청사초롱(위는 빨강, 아래는 파랑) 길을 따라
  lanterns() {
    const red = new THREE.MeshStandardMaterial({ color: '#d63a4a', emissive: '#ff5a3c', emissiveIntensity: 1.2 }), blue = new THREE.MeshStandardMaterial({ color: '#2f4fb0', emissive: '#3b5bff', emissiveIntensity: 0.9 }), pole = new THREE.MeshStandardMaterial({ color: '#6b4a2e' });
    for (const [x, z] of this.roadside(13, 2.2).slice(0, 48)) {
      const g = new THREE.Group(); g.position.set(x, this.w.terrain.heightAt(x, z), z);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), pole); p.position.y = 1.3; g.add(p);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 10), red); a.position.y = 2.35; g.add(a);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 10), blue); b.position.y = 2.1; g.add(b);
      this.group.add(g); this.items.push({ type: 'static', m: g });
    }
  }

  // 커다란 보름달(운동장 너머 하늘)
  moon() {
    const P = this.pitch, T = this.w.terrain;
    const m = new THREE.Mesh(new THREE.SphereGeometry(38, 32, 20), new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false }));
    m.position.set(P.cx + 520, T.heightAt(P.cx, P.cz) + 260, P.cz - 380); this.group.add(m);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,190,0.7)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false })); glow.scale.set(240, 240, 1); glow.position.copy(m.position); this.group.add(glow);
    this.items.push({ type: 'static', m });
  }

  // 하늘에 연 여섯 개(방패연·가오리연), 실은 운동장 쪽으로
  kites() {
    const P = this.pitch, T = this.w.terrain, gy = T.heightAt(P.cx, P.cz);
    const cols = [['#d63a4a', '#f3b33d'], ['#2f6fe0', '#ffffff'], ['#3fa34d', '#f3b33d'], ['#ff8fb1', '#2f6fe0'], ['#f3b33d', '#d63a4a'], ['#ffffff', '#1f3d8a']];
    cols.forEach(([a, b], i) => {
      const c = document.createElement('canvas'); c.width = 96; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = a; g.fillRect(0, 0, 96, 128); g.fillStyle = b; g.fillRect(0, 0, 96, 30); g.beginPath(); g.arc(48, 70, 16, 0, Math.PI * 2); g.fillStyle = '#ffffffcc'; g.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const k = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide }));
      const ang = (i / 6) * Math.PI * 2, r = 20 + i * 6;
      k.position.set(P.cx + Math.cos(ang) * r, gy + 45 + i * 6, P.cz + Math.sin(ang) * r);
      const anchor = new THREE.Vector3(P.cx + Math.cos(ang) * (r * 0.3), gy + 1, P.cz + Math.sin(ang) * (r * 0.3));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([anchor, k.position.clone()]), new THREE.LineBasicMaterial({ color: '#f5f5f5', transparent: true, opacity: 0.6 }));
      this.group.add(k, line);
      this.items.push({ type: 'kite', m: k, base: k.position.clone(), ph: i * 1.3, line, anchor });
    });
  }

  // 복주머니(운동장 둘레)
  bags() {
    const P = this.pitch, T = this.w.terrain;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2, x = P.cx + Math.cos(ang) * (P.L / 2 + 4), z = P.cz + Math.sin(ang) * (P.W / 2 + 4);
      const g = new THREE.Group(); g.position.set(x, T.heightAt(x, z), z);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? '#d63a4a' : '#ff8fb1', roughness: 0.6 })); body.scale.set(1, 1.1, 1); body.position.y = 0.75; g.add(body);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#f3b33d' })); knot.position.y = 1.6; g.add(knot);
      this.group.add(g); this.items.push({ type: 'static', m: g });
    }
  }

  // 묘목(운동장 둘레)
  saplings() {
    const P = this.pitch, T = this.w.terrain, leaf = new THREE.MeshStandardMaterial({ color: '#4caf50' }), trunk = new THREE.MeshStandardMaterial({ color: '#7a5230' });
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2, x = P.cx + Math.cos(ang) * (P.L / 2 + 7), z = P.cz + Math.sin(ang) * (P.W / 2 + 7);
      const g = new THREE.Group(); g.position.set(x, T.heightAt(x, z), z);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), trunk); t.position.y = 0.4; g.add(t);
      const l = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8), leaf); l.position.y = 1.2; g.add(l);
      this.group.add(g); this.items.push({ type: 'static', m: g });
    }
  }

  // 솜뭉치 구름: 하얀·연분홍 구 여러 개를 뭉쳐 하늘에 띄워요
  cotton() {
    const P = this.pitch;
    const mat = [new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0xffe3ec, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 1 })];
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const n = 6 + Math.floor(Math.random() * 6);
      for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random() * 2.4, 16, 12), mat[k % 3]); b.position.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 6); g.add(b); }
      const a = (i / 14) * Math.PI * 2, r = 70 + Math.random() * 90;
      g.userData = { cx: P.cx + Math.cos(a) * r, cz: P.cz + Math.sin(a) * r, h: 34 + Math.random() * 22, ph: Math.random() * 6 };
      this.group.add(g);
      this.items.push({ type: 'cotton', g });
    }
  }

  // 동물 가족 행렬: 운동장 둘레를 다 같이 천천히 걸어요(엄마 고양이가 앞장)
  parade() {
    const P = this.pitch;
    const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const mk = (body, head, scale, ears) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), M(body)); b.scale.set(1, 0.8, 1.4); b.position.y = 0.55; g.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), M(head)); h.position.set(0, 0.95, 0.62); g.add(h);
      if (ears) for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), M(head)); e.position.set(sx * 0.17, 1.24, 0.6); g.add(e); }
      for (const [x, z] of [[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 6), M(body)); l.position.set(x, 0.18, z); g.add(l); }
      for (const c of g.children) c.castShadow = true;
      g.scale.setScalar(scale);
      return g;
    };
    const family = [
      ['엄마 고양이', 0xf6f6f2, 0xf6f6f2, 2.2, true], ['아기 고양이', 0xffffff, 0xffffff, 1.4, true], ['아기 고양이', 0xf2efe8, 0xf2efe8, 1.3, true], ['아기 고양이', 0xfafafa, 0xfafafa, 1.2, true],
      ['치즈', 0xf2b45c, 0xf2b45c, 2.0, true], ['고라니', 0xa77b52, 0xb98c62, 3.0, true], ['멧돼지', 0x5a4636, 0x4d3b2d, 3.0, false], ['다람쥐', 0x9a6a44, 0xb07e55, 1.2, true], ['거북이', 0x5f7a3a, 0x7a9a4a, 1.6, false], ['개구리', 0x6fbf4a, 0x6fbf4a, 1.0, false],
    ];
    family.forEach(([name, b, h, sc, ears], k) => {
      const g = mk(b, h, sc, ears);
      g.userData = { k, name };
      this.group.add(g);
      this.items.push({ type: 'walker', g });
    });
    this.paradeT = 0;
  }


  faceTex() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    g.fillStyle = '#ffd34d';
    const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x + s, y + s * 0.6); g.lineTo(x, y - s * 0.6); g.fill(); };
    tri(38, 22, 12); tri(90, 22, 12); tri(64, 40, 7);
    g.beginPath(); g.moveTo(26, 52); for (let i = 0; i <= 8; i++) g.lineTo(26 + i * 9.5, 52 + (i % 2 ? 10 : 0)); g.lineTo(102, 64); g.lineTo(26, 64); g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 만국기: 운동장 위로 여러 줄
  bunting() {
    const P = this.pitch, T = this.w.terrain, c = Math.cos(P.angle), s = Math.sin(P.angle);
    const cols = ['#ff453a', '#ffc94a', '#34c759', '#0a84ff', '#bf5af2', '#ffffff', '#ff9f43'];
    const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.6, 0, 0), new THREE.Vector3(0.6, 0, 0), new THREE.Vector3(0, -1.2, 0)]);
    tri.computeVertexNormals();
    for (const v of [-P.W / 4, 0, P.W / 4]) {
      const n = 26;
      const mesh = new THREE.InstancedMesh(tri, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -P.angle, 0));
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1) - 0.5) * (P.L + 6);
        const x = P.cx + u * c - v * s, z = P.cz + u * s + v * c;
        const sag = 1 - Math.pow((i / (n - 1)) * 2 - 1, 2);
        m.compose(new THREE.Vector3(x, T.heightAt(P.cx, P.cz) + 18 - sag * 4, z), q, new THREE.Vector3(1, 1, 1));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, new THREE.Color(cols[i % cols.length]));
      }
      this.group.add(mesh);
    }
  }

  // 축제 무대(문화관 쪽 운동장 끝) + 움직이는 조명 + 레이저
  stage() {
    const P = this.pitch, T = this.w.terrain, c = Math.cos(P.angle), s = Math.sin(P.angle);
    const u = P.L / 2 - 8, x = P.cx + u * c, z = P.cz + u * s, y = T.heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = -P.angle + Math.PI / 2;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.6 });
    const truss = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 });
    const box = (w, h, d, px, py, pz, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    box(18, 1.4, 9, 0, 0.7, 0, dark);
    for (const px of [-8.5, 8.5]) box(0.4, 9, 0.4, px, 5.9, -3.5, truss);
    box(17.4, 0.5, 0.5, 0, 10.2, -3.5, truss);
    box(16, 7, 0.2, 0, 5.5, -4.2, new THREE.MeshBasicMaterial({ color: 0x3b1d6e }));
    for (const px of [-7, 7]) box(2, 3.4, 1.6, px, 3.1, 2.5, dark);
    this.group.add(g);
    const beamMat = (col) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    ['#ff3b91', '#5ac8fa', '#a0e75a', '#ffd34d', '#bf5af2'].forEach((col, i) => {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 120, 6, 1, true).translate(0, 60, 0), beamMat(col));
      beam.position.set(x + (i - 2) * 3 * s, y + 10, z - (i - 2) * 3 * c);
      this.group.add(beam);
      this.items.push({ type: 'laser', m: beam, ph: i * 1.3 });
    });
  }

  // 입학식: 정문(버스 정류장 쪽) 벚꽃 아치
  arch() {
    if (!this.busAt) return;
    const T = this.w.terrain, [x, z] = this.busAt;
    const g = new THREE.Group();
    g.position.set(x - 8, T.heightAt(x - 8, z), z);
    const blossom = new THREE.MeshStandardMaterial({ color: 0xffc3d8, roughness: 0.8 });
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI, r = 7;
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1 + Math.random() * 0.5, 8, 6), blossom);
      b.position.set(Math.cos(a) * r, Math.sin(a) * r * 1.1, 0);
      g.add(b);
    }
    this.group.add(g);
  }

  balloons() {
    const P = this.pitch, T = this.w.terrain;
    const cols = [0xff453a, 0xffc94a, 0x34c759, 0x0a84ff, 0xbf5af2, 0xff6fae];
    for (let i = 0; i < 24; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10).scale(1, 1.2, 1), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.3 }));
      const x = P.cx + (Math.random() - 0.5) * P.L, z = P.cz + (Math.random() - 0.5) * P.W;
      b.position.set(x, T.heightAt(x, z) + 2 + Math.random() * 40, z);
      b.userData = { v: 1.5 + Math.random() * 2, base: T.heightAt(x, z) };
      this.group.add(b);
      this.items.push({ type: 'balloon', m: b });
    }
  }

  // 건물이 젤리처럼 출렁(바닥 기준으로 늘었다 줄었다)
  setJelly(b, s) {
    for (const o of [b.intact, b.decor, b.cap]) {
      if (!o) continue;
      if (!o.userData.p0) o.userData.p0 = o.position.clone();
      const p0 = o.userData.p0, cx = b.c2[0], cz = b.c2[1], by = b.base;
      const sx = 1 + (1 - s) * 0.5;
      o.scale.set(sx, s, sx);
      // 바닥 가운데(cx, by, cz)를 기준으로 늘었다 줄었다
      o.position.set(cx + (p0.x - cx) * sx, by + (p0.y - by) * s, cz + (p0.z - cz) * sx);
    }
  }
  unjelly(b) { for (const o of [b.intact, b.decor, b.cap]) if (o && o.userData.p0) { o.scale.set(1, 1, 1); o.position.copy(o.userData.p0); delete o.userData.p0; } }

  update(dt) {
    for (const f of [this.candy, this.sticks, this.caps, ...this.jamo]) f.update(dt);
    if (!this.kind) return;
    this.t += dt;
    const t = this.t;
    // 졸업식: 운동장에서 학사모가 하늘로
    if (this.kind === 'graduation') { this.capT = (this.capT || 0) - dt; if (this.capT <= 0) { this.capT = 3.5; const P = this.pitch; this.caps.spawn(new THREE.Vector3(P.cx + (Math.random() - 0.5) * P.L * 0.6, this.w.terrain.heightAt(P.cx, P.cz), P.cz + (Math.random() - 0.5) * P.W * 0.6), 10, 18, 1.6); } }
    for (const it of this.items) {
      if (it.type === 'collect') {
        const u = it.g.userData;
        if (!it.done && u.float) { it.g.position.y = u.base + Math.sin(t * 1.6 + u.ph) * 0.3; it.g.rotation.y += dt * 0.8; }
        if (!it.done && u.fly) { it.g.position.x += Math.sin(t * 0.5 + u.ph) * dt * 2; it.g.position.z += Math.cos(t * 0.4 + u.ph) * dt * 2; }
        if (u.tree && it.done && u.grow < 1) { u.grow = Math.min(1, u.grow + dt * 1.5); u.tree.scale.setScalar(Math.max(0.01, u.grow)); }
        continue;
      }
      if (it.type === 'flag') it.m.rotation.y = Math.sin(t * 3 + it.ph) * 0.25;
      else if (it.type === 'kite') {
        it.m.position.set(it.base.x + Math.sin(t * 0.7 + it.ph) * 3, it.base.y + Math.sin(t * 1.1 + it.ph) * 1.5, it.base.z + Math.cos(t * 0.6 + it.ph) * 3);
        it.m.rotation.z = Math.sin(t * 1.3 + it.ph) * 0.3;
        it.line.geometry.setFromPoints([it.anchor, it.m.position.clone()]);
      }
    }
    if (this.kind === 'newyear' && this.pitch) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 1.5 + Math.random() * 2;
        const P = this.pitch, y = this.w.terrain.heightAt(P.cx, P.cz) + 50 + Math.random() * 30;
        this.w.fx.burst?.(new THREE.Vector3(P.cx + (Math.random() - 0.5) * 120, y, P.cz + (Math.random() - 0.5) * 90), new THREE.Color(['#ffd700', '#ff5d5d', '#64d2ff', '#ffffff'][Math.floor(Math.random() * 4)]), 120);
      }
    }
    // 어버이날 행렬: 운동장 둘레(타원)를 한 줄로, 깡총깡총
    if (this.kind === 'parents' && this.pitch) {
      this.paradeT += dt * 0.035;
      const P = this.pitch, rx = P.L / 2 + 8, rz = P.W / 2 + 8, T = this.w.terrain;
      for (const it of this.items) {
        if (it.type === 'walker') {
          const a = this.paradeT - it.g.userData.k * 0.06, ca = Math.cos(P.angle), sa = Math.sin(P.angle);
          const lx = Math.cos(a) * rx, lz = Math.sin(a) * rz;
          const x = P.cx + lx * ca - lz * sa, z = P.cz + lx * sa + lz * ca;
          const dx = -Math.sin(a) * rx * ca - Math.cos(a) * rz * sa, dz = -Math.sin(a) * rx * sa + Math.cos(a) * rz * ca;
          it.g.position.set(x, T.heightAt(x, z) + Math.abs(Math.sin(t * 6 + it.g.userData.k)) * 0.25, z);
          it.g.rotation.y = Math.atan2(dx, dz);
        } else if (it.type === 'cotton') {
          const u = it.g.userData;
          it.g.position.set(u.cx + Math.sin(t * 0.05 + u.ph) * 12, T.heightAt(u.cx, u.cz) + u.h + Math.sin(t * 0.4 + u.ph) * 1.5, u.cz + Math.cos(t * 0.04 + u.ph) * 10);
          const sq = 1 + Math.sin(t * 0.8 + u.ph) * 0.04; it.g.scale.set(sq, 2 - sq, sq); // 폭닥폭닥
        }
      }
    }
    for (const it of this.items) {
      if (it.type === 'ghost') { const u = it.g.userData; it.g.position.set(u.cx + Math.cos(t * 0.4 + u.ph) * u.r, this.w.terrain.heightAt(u.cx, u.cz) + u.h + Math.sin(t * 1.6 + u.ph) * 1.2, u.cz + Math.sin(t * 0.4 + u.ph) * u.r); it.g.rotation.y = -t * 0.4 - u.ph; }
      if (it.type === 'laser') { it.m.rotation.z = Math.sin(t * 0.8 + it.ph) * 0.6; it.m.rotation.x = Math.cos(t * 0.6 + it.ph) * 0.4; it.m.visible = this.w.isNight?.() ?? true; }
      if (it.type === 'balloon') { it.m.position.y += it.m.userData.v * dt; if (it.m.position.y > it.m.userData.base + 90) it.m.position.y = it.m.userData.base; }
    }
    if (this.jelly) for (const [i, b] of this.buildings.list.entries()) if (b.intact) this.setJelly(b, 1 + Math.sin(t * 5 + i * 1.3) * 0.045);
    // 드론쇼
    const D = this.drones;
    if (D) {
      D.pts.visible = this.w.isNight?.() ?? true;
      const phase = Math.floor(t / 6) % D.forms.length;
      if (phase !== D.i) D.i = phase;
      const tgt = D.forms[D.i];
      // 어디서 보든 글자가 바로 읽히게, 카메라 쪽을 바라보는 판 위에 배치해요.
      const cam = this.w.camera, right = new THREE.Vector3(1, 0, 0);
      if (cam) { right.setFromMatrixColumn(cam.matrixWorld, 0); right.y = 0; right.normalize(); }
      const c = right.x, s = right.z, col = new THREE.Color();
      for (let i = 0; i < tgt.length; i++) {
        D.cur[i][0] += (tgt[i][0] - D.cur[i][0]) * Math.min(1, dt * 1.6);
        D.cur[i][1] += (tgt[i][1] - D.cur[i][1]) * Math.min(1, dt * 1.6);
        D.pos[i * 3] = D.center.x + D.cur[i][0] * c;
        D.pos[i * 3 + 1] = D.center.y + D.cur[i][1];
        D.pos[i * 3 + 2] = D.center.z + D.cur[i][0] * s;
        col.setHSL(((t * 0.05 + i / tgt.length * 0.3) % 1), 0.8, 0.65);
        D.col[i * 3] = col.r; D.col[i * 3 + 1] = col.g; D.col[i * 3 + 2] = col.b;
      }
      D.pts.geometry.attributes.position.needsUpdate = true;
      D.pts.geometry.attributes.color.needsUpdate = true;
    }
  }

  disable() { this.kind = null; this.clear(); this.w.seasons?.special(null); }
  clearBursts() { for (const f of [this.candy, this.sticks, this.caps, ...this.jamo]) f.clear(); }
}
