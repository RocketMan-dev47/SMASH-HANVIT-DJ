import * as THREE from 'three';

// 한빛고 동물 도감: 고양이 5마리 + 산과 연못의 동물들
export const DEX = [
  { id: 'cat-mom', name: '하양', kind: '흰 고양이(엄마)', emoji: '🐈', desc: '본관 앞 잔디의 대장. 새끼 셋을 데리고 다녀요.', hint: '본관 앞 잔디' },
  { id: 'cat-k1', name: '솜', kind: '아기 고양이', emoji: '🐱', desc: '엄마 바로 뒤를 졸졸. 겁이 제일 많아요.', hint: '엄마 고양이 근처' },
  { id: 'cat-k2', name: '눈송이', kind: '아기 고양이', emoji: '🐱', desc: '호기심 대장. 꼬리 잡기를 좋아해요.', hint: '엄마 고양이 근처' },
  { id: 'cat-k3', name: '구름', kind: '아기 고양이', emoji: '🐱', desc: '막내. 줄 맨 끝에서 따라와요.', hint: '엄마 고양이 근처' },
  { id: 'cat-cheese', name: '치즈', kind: '치즈 고양이', emoji: '🐈', desc: '급식실 근처 연못가가 단골 자리예요.', hint: '미래관 근처' },
  { id: 'frog', name: '개구리', kind: '양서류', emoji: '🐸', desc: '연못에서 개굴개굴. 겨울엔 겨울잠을 자요.', hint: '연못가 · 봄~가을' },
  { id: 'mantis', name: '사마귀', kind: '곤충', emoji: '🦗', desc: '세심정 가는 길 풀숲에서 앞발을 들고 있어요.', hint: '세심정 주변 풀숲 · 늦여름~가을' },
  { id: 'bat', name: '박쥐', kind: '포유류', emoji: '🦇', desc: '해가 지면 인재원 불빛 근처를 휙휙 날아다녀요.', hint: '밤 · 인재원 근처 하늘' },
  { id: 'squirrel', name: '하늘다람쥐', kind: '천연기념물', emoji: '🐿️', desc: '밤에 나무 사이를 활공하는 귀한 손님. 아주 드물게 보여요.', hint: '밤 · 산 가장자리 나무 · 아주 드묾' },
  { id: 'deer', name: '고라니', kind: '포유류', emoji: '🦌', desc: '송곳니가 있는 작은 사슴. 산 깊은 곳에 살아요.', hint: '학교 뒤 깊은 산' },
  { id: 'boar', name: '멧돼지', kind: '포유류', emoji: '🐗', desc: '산 깊은 곳을 어슬렁. 마주치면 조용히 물러나요.', hint: '학교 뒤 깊은 산' },
];

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });

function deer() {
  const g = new THREE.Group(), fur = mat(0x9c7350), dark = mat(0x2a1d14), white = mat(0xf2ede4);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.SphereGeometry(0.35, 10, 8), fur, 0, 0.75, 0).scale.set(0.8, 0.8, 1.6);
  add(new THREE.SphereGeometry(0.17, 10, 8), fur, 0, 1.1, 0.55).scale.set(0.9, 1, 1.3);
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.06, 0.18, 6), fur, 0.09 * s, 1.27, 0.5).rotation.z = -0.4 * s;
    add(new THREE.SphereGeometry(0.03, 6, 4), dark, 0.08 * s, 1.15, 0.7);
    add(new THREE.ConeGeometry(0.015, 0.09, 4), white, 0.04 * s, 0.98, 0.72).rotation.x = Math.PI;
  }
  const legs = [];
  for (const [x, z] of [[-0.12, 0.35], [0.12, 0.35], [-0.12, -0.35], [0.12, -0.35]]) legs.push(add(new THREE.CylinderGeometry(0.03, 0.025, 0.6, 6), fur, x, 0.3, z));
  g.userData.legs = legs;
  return g;
}
function boar() {
  const g = new THREE.Group(), fur = mat(0x3b2b22), snout = mat(0xc99a8a), white = mat(0xf2ede4);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.SphereGeometry(0.45, 10, 8), fur, 0, 0.55, 0).scale.set(0.85, 0.85, 1.5);
  add(new THREE.SphereGeometry(0.28, 10, 8), fur, 0, 0.55, 0.6).scale.set(0.9, 0.9, 1.2);
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 10).rotateX(Math.PI / 2), snout, 0, 0.5, 0.92);
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.03, 0.14, 5), white, 0.1 * s, 0.5, 0.86).rotation.x = -0.6;
    add(new THREE.ConeGeometry(0.07, 0.14, 4), fur, 0.15 * s, 0.82, 0.5);
  }
  const legs = [];
  for (const [x, z] of [[-0.18, 0.4], [0.18, 0.4], [-0.18, -0.4], [0.18, -0.4]]) legs.push(add(new THREE.CylinderGeometry(0.06, 0.05, 0.35, 6), fur, x, 0.17, z));
  g.userData.legs = legs;
  return g;
}
function squirrel() {
  const g = new THREE.Group(), fur = mat(0x9a8f84), belly = mat(0xf0ebe3), eye = mat(0x111111, { roughness: 0.2 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.SphereGeometry(0.12, 10, 8), fur, 0, 0, 0).scale.set(1, 0.6, 1.4);
  add(new THREE.SphereGeometry(0.09, 10, 8), fur, 0, 0.03, 0.17);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.035, 8, 6), eye, 0.045 * s, 0.06, 0.24);
  const wing = add(new THREE.PlaneGeometry(0.5, 0.32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb3a89c, side: THREE.DoubleSide }), 0, -0.01, 0);
  add(new THREE.CylinderGeometry(0.04, 0.02, 0.28, 6).rotateX(Math.PI / 2), fur, 0, 0, -0.28);
  add(new THREE.SphereGeometry(0.08, 8, 6), belly, 0, -0.04, 0.02).scale.set(1, 0.4, 1.2);
  g.userData.wing = wing;
  return g;
}
function bat() {
  const g = new THREE.Group(), body = mat(0x1d1a1f), wm = new THREE.MeshStandardMaterial({ color: 0x2b2530, side: THREE.DoubleSide, roughness: 0.9 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), body);
  b.scale.set(1, 1, 1.5);
  g.add(b);
  const wings = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    const w = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.06), new THREE.Vector2(0.35 * s, 0.1), new THREE.Vector2(0.28 * s, -0.06), new THREE.Vector2(0.12 * s, -0.02), new THREE.Vector2(0, -0.08)])).rotateX(-Math.PI / 2), wm);
    piv.add(w);
    g.add(piv);
    wings.push({ piv, s });
  }
  g.userData.wings = wings;
  return g;
}
function frog() {
  const g = new THREE.Group(), skin = mat(0x5aa83a), belly = mat(0xd9e8a0), eye = mat(0x111111, { roughness: 0.2 }), eyeW = mat(0xf2f2c8);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.SphereGeometry(0.12, 10, 8), skin, 0, 0.08, 0).scale.set(1.1, 0.7, 1.2);
  add(new THREE.SphereGeometry(0.09, 10, 8), belly, 0, 0.05, 0.03).scale.set(1, 0.5, 1);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.045, 8, 6), eyeW, 0.06 * s, 0.17, 0.08);
    add(new THREE.SphereGeometry(0.025, 8, 6), eye, 0.065 * s, 0.18, 0.115);
    add(new THREE.SphereGeometry(0.05, 6, 4), skin, 0.11 * s, 0.03, -0.08).scale.set(1, 0.5, 1.6);
  }
  return g;
}
function mantis() {
  const g = new THREE.Group(), skin = mat(0x7fb54a), eye = mat(0x2d4a1a);
  const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 6), skin, 0, 0.12, -0.05, Math.PI / 2 - 0.2);
  add(new THREE.CylinderGeometry(0.015, 0.02, 0.18, 6), skin, 0, 0.22, 0.14, 0.5);
  add(new THREE.ConeGeometry(0.05, 0.07, 3), skin, 0, 0.31, 0.2, Math.PI);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.018, 6, 4), eye, 0.03 * s, 0.32, 0.21);
    add(new THREE.CylinderGeometry(0.01, 0.012, 0.12, 5), skin, 0.04 * s, 0.24, 0.24, -0.6);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), skin, 0.06 * s, 0.07, -0.05, 0.3);
  }
  g.userData.arms = g.children.filter((c, i) => i > 3 && i % 3 === 2);
  return g;
}

export class Wildlife {
  constructor(world, { focus, pond, shrine, dorm, spots }) {
    this.w = world;
    this.T = world.terrain;
    this.list = [];
    this.t = 0;
    const T = this.T;
    // 산 깊은 곳: 학교 중심에서 110 m 이상 떨어진, 가장 높은 쪽
    const deep = [];
    for (let i = 0; i < 400; i++) {
      const x = T.x0 + 12 + Math.random() * (T.w - 24), z = T.z0 + 12 + Math.random() * (T.d - 24);
      if (Math.hypot(x - focus[0], z - focus[1]) > 110) deep.push([x, z, T.heightAt(x, z)]);
    }
    deep.sort((a, b) => b[2] - a[2]);
    this.deep = deep.slice(0, 40);
    this.focus = focus;
    const mk = (id, model, scale, home, opts = {}) => {
      model.scale.setScalar(scale);
      world.scene.add(model);
      const a = { id, g: model, scale, home: new THREE.Vector3(home[0], 0, home[1]), pos: new THREE.Vector3(home[0], 0, home[1]), target: null, yaw: Math.random() * 6, timer: Math.random() * 5, state: 'idle', t: Math.random() * 10, ...opts };
      this.list.push(a);
      return a;
    };
    const pick = () => this.deep[Math.floor(Math.random() * this.deep.length)] || [focus[0] + 130, focus[1] + 130];
    mk('deer', deer(), 2.4, pick(), { walk: 1.4, range: 25, body: 1.0 });
    mk('deer', deer(), 2.4, pick(), { walk: 1.4, range: 25, body: 1.0 });
    mk('boar', boar(), 2.4, pick(), { walk: 1.1, range: 20, body: 0.9 });
    if (pond) for (let i = 0; i < 3; i++) mk('frog', frog(), 3.2, [pond[0] + (Math.random() - 0.5) * 6, pond[1] + (Math.random() - 0.5) * 5], { hop: true, range: 4, free: true });
    if (shrine) for (let i = 0; i < 2; i++) mk('mantis', mantis(), 4, [shrine[0] + 6 + Math.random() * 8, shrine[1] - 4 + Math.random() * 8], { range: 1, free: true });
    this.dorm = dorm ? new THREE.Vector3(dorm[0], 0, dorm[1]) : new THREE.Vector3(focus[0], 0, focus[1]);
    for (let i = 0; i < 6; i++) mk('bat', bat(), 4, [this.dorm.x, this.dorm.z], { fly: true, phase: Math.random() * 6, r: 18 + Math.random() * 16, h: 18 + Math.random() * 14 });
    this.sq = mk('squirrel', squirrel(), 5, [focus[0], focus[1]], { glide: true });
    this.sq.g.visible = false;
    this.sqTimer = 20;
    this.spots = spots || [];
    this.place();
  }

  // 개발자 메뉴: 특정 생물을 P 근처로 불러와요(하늘다람쥐는 바로 활공 시작)
  summon(id, P) {
    const T = this.T;
    if (id === 'squirrel') {
      this.sq.from = new THREE.Vector3(P.x - 18, T.heightAt(P.x - 18, P.z) + 14, P.z - 6);
      this.sq.to = new THREE.Vector3(P.x + 18, T.heightAt(P.x + 18, P.z) + 4, P.z + 6);
      this.sq.u = 0; this.sq.g.visible = true; this.forceSq = 6;
      return true;
    }
    const a = this.list.find((x) => x.id === id);
    if (!a) return false;
    const x = P.x + (Math.random() - 0.5) * 8, z = P.z + (Math.random() - 0.5) * 8;
    a.pos.set(x, T.heightAt(x, z), z); a.home.copy(a.pos); a.target = null; a.state = 'idle';
    a.g.visible = true; a.g.position.copy(a.pos); a.forced = 30;
    return true;
  }

  place() { for (const a of this.list) { a.pos.y = this.T.heightAt(a.pos.x, a.pos.z); a.g.position.copy(a.pos); } }

  // 계절·시간에 따라 보이기/숨기기
  setConditions({ night, month }) {
    this.night = night;
    for (const a of this.list) {
      if (a.forced > 0) continue; // 개발자 메뉴로 불러온 동안은 그대로
      if (a.id === 'bat') a.g.visible = night;
      if (a.id === 'frog') a.g.visible = !(month === 12 || month <= 2);
      if (a.id === 'mantis') a.g.visible = month >= 7 && month <= 11;
    }
    if (!night && !(this.forceSq > 0)) this.sq.g.visible = false;
  }

  pickScreen(x, y, camera, rect) {
    let best = null, bd = Infinity;
    const v = new THREE.Vector3();
    for (const a of this.list) {
      if (!a.g.visible) continue;
      v.copy(a.g.position).project(camera);
      if (v.z > 1) continue;
      const sx = rect.left + ((v.x + 1) / 2) * rect.width, sy = rect.top + ((1 - v.y) / 2) * rect.height;
      const dist = camera.position.distanceTo(a.g.position);
      const R = Math.max(26, Math.min(80, (700 * a.scale * 0.3) / dist));
      const d = Math.hypot(sx - x, sy - y);
      if (d < R && d < bd) { bd = d; best = a; }
    }
    return best;
  }

  scare(P, R) {
    for (const a of this.list) {
      if (a.fly || a.glide) continue;
      const d = Math.hypot(a.pos.x - P.x, a.pos.z - P.z);
      if (d > R + 20) continue;
      const away = new THREE.Vector3(a.pos.x - P.x, 0, a.pos.z - P.z).normalize().multiplyScalar(R + 20);
      a.target = a.pos.clone().add(away);
      a.state = 'flee';
      if (d < R && (!this.w.obstacles || a.fly || !this.w.obstacles.blocked(a.target.x, a.target.z, 0.8))) a.pos.copy(a.target);
    }
  }

  update(dt) {
    const T = this.T;
    this.t += dt;
    this.forceSq = (this.forceSq || 0) - dt;
    for (const a of this.list) if (a.forced > 0) a.forced -= dt;
    // 하늘다람쥐: 밤에만, 90초마다 25% 확률로 나무 사이를 활공
    if (this.night) {
      this.sqTimer -= dt;
      if (this.sqTimer <= 0 && !this.sq.g.visible) {
        this.sqTimer = 90;
        if (Math.random() < 0.25 && this.spots.length > 1) {
          const a = this.spots[Math.floor(Math.random() * this.spots.length)], b = this.spots[Math.floor(Math.random() * this.spots.length)];
          this.sq.from = new THREE.Vector3(a[0], T.heightAt(a[0], a[1]) + 12, a[1]);
          this.sq.to = new THREE.Vector3(b[0], T.heightAt(b[0], b[1]) + 4, b[1]);
          this.sq.u = 0;
          this.sq.g.visible = true;
        }
      }
    }
    for (const a of this.list) {
      a.t += dt;
      if (!a.g.visible) continue;
      if (a.id === 'squirrel') {
        a.u += dt / 5;
        const p = a.from.clone().lerp(a.to, Math.min(1, a.u));
        p.y += Math.sin(Math.min(1, a.u) * Math.PI) * 3;
        a.g.position.copy(p);
        a.g.rotation.y = Math.atan2(a.to.x - a.from.x, a.to.z - a.from.z);
        a.g.userData.wing.scale.set(1, 1, a.u < 1 ? 1 : 0.4);
        if (a.u > 3) a.g.visible = false;
        continue;
      }
      if (a.fly) {
        const ang = a.t * 0.6 + a.phase;
        a.g.position.set(this.dorm.x + Math.cos(ang) * a.r, T.heightAt(this.dorm.x, this.dorm.z) + a.h + Math.sin(a.t * 2.3 + a.phase) * 3, this.dorm.z + Math.sin(ang * 1.3) * a.r);
        a.g.rotation.y = -ang;
        for (const w of a.g.userData.wings) w.piv.rotation.z = Math.sin(a.t * 18) * 0.8 * w.s;
        continue;
      }
      // 걷는 동물·개구리·사마귀
      a.timer -= dt;
      if (a.state === 'idle' && a.timer <= 0) {
        const ang = Math.random() * Math.PI * 2, r = Math.random() * (a.range || 10);
        a.target = new THREE.Vector3(a.home.x + Math.cos(ang) * r, 0, a.home.z + Math.sin(ang) * r);
        a.state = 'walk';
        a.timer = 3 + Math.random() * 6;
        // 고라니는 아주 가끔 산 아래로 조금 내려와요.
        if (a.id === 'deer' && Math.random() < 0.04) a.target.lerp(new THREE.Vector3(this.focus[0], 0, this.focus[1]), 0.25);
        if (a.id === 'frog') {
          a.jump = 0.4;
          // 개굴(도-동) 소리는 35 m 안에 있을 때만, 20초에 한 번까지
          const cam = this.w.camera?.position, d = cam ? cam.distanceTo(a.pos) : 999;
          a.croakT = (a.croakT ?? 0);
          if (d < 35 && this.t - a.croakT > 20 && Math.random() < 0.5) { a.croakT = this.t; this.w.sound.animal?.('frog', 1 - d / 35); }
        }
      }
      if ((a.state === 'walk' || a.state === 'flee') && a.target) {
        const dx = a.target.x - a.pos.x, dz = a.target.z - a.pos.z, d = Math.hypot(dx, dz);
        const sp = a.state === 'flee' ? 8 : a.hop ? 2.5 : a.walk || 0.3;
        if (d < 0.4) { if (a.state === 'flee') a.home.copy(a.pos); a.state = 'idle'; }
        else {
          a.yaw = Math.atan2(dx, dz);
          const st = Math.min(d, sp * dt);
          const O = this.w.obstacles;
          // 개구리·사마귀는 연못가·풀숲 안에서만 아주 조금 움직여서 장애물을 따지지 않아요.
          if (O && !a.fly && !a.free) {
            O.escape(a.pos, a.body ?? 0.6, { treesToo: true });
            const res = O.slide(a.pos, (dx / d) * st, (dz / d) * st, a.body ?? 0.6, { treesToo: true });
            if (res === 'stuck') { a.state = 'idle'; a.timer = 0.5 + Math.random(); }
          } else { a.pos.x += (dx / d) * st; a.pos.z += (dz / d) * st; }
        }
        if (a.g.userData.legs) a.g.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(a.t * 10 + (i % 3 ? 0 : Math.PI)) * 0.5; });
      }
      a.jump = Math.max(0, (a.jump || 0) - dt);
      a.pos.y = T.heightAt(a.pos.x, a.pos.z);
      a.g.position.set(a.pos.x, a.pos.y + (a.jump ? Math.sin((a.jump / 0.4) * Math.PI) * 0.6 : 0), a.pos.z);
      a.g.rotation.y = a.yaw;
      if (a.id === 'mantis') a.g.rotation.z = Math.sin(a.t * 1.5) * 0.08;
    }
  }
}

// 도감 기록(이 기기에 저장)
export class Dex {
  constructor() {
    try { this.found = JSON.parse(localStorage.getItem('smash-dex') || '{}'); } catch { this.found = {}; }
  }
  // 새로 발견하면 true
  add(id) {
    if (this.found[id]) return false;
    this.found[id] = Date.now();
    try { localStorage.setItem('smash-dex', JSON.stringify(this.found)); } catch { /* 무시 */ }
    return true;
  }
  entries() { return DEX.map((d) => ({ ...d, at: this.found[d.id] || 0 })); }
  count() { return Object.keys(this.found).length; }
}
