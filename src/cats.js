import * as THREE from 'three';

// 학교 고양이: 흰 엄마 고양이 + 흰 새끼 3마리(엄마를 졸졸 따라다녀요), 치즈 고양이(급식실 근처).
// 폭발이 가까우면 깜짝 놀라 도망가고, 절대 다치지 않아요. 누르면 "냐옹".
function catModel(main, accent, stripes = false) {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: main, roughness: 0.9 });
  const fur2 = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.9 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xf2a3b3, roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const body = add(new THREE.SphereGeometry(0.2, 12, 10), fur, 0, 0.2, 0);
  body.scale.set(0.85, 0.8, 1.45);
  if (stripes) for (const z of [-0.12, 0, 0.12]) add(new THREE.TorusGeometry(0.155, 0.018, 6, 16, Math.PI), fur2, 0, 0.22, z).rotation.y = Math.PI / 2;
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.27);
  g.add(head);
  add(new THREE.SphereGeometry(0.14, 12, 10), fur, 0, 0, 0, head).scale.set(1.05, 0.95, 0.95);
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.055, 0.1, 4), fur, 0.075 * s, 0.13, -0.01, head).rotation.z = -0.25 * s;
    add(new THREE.ConeGeometry(0.03, 0.06, 4), pink, 0.075 * s, 0.125, 0.012, head).rotation.z = -0.25 * s;
    add(new THREE.SphereGeometry(0.022, 8, 6), black, 0.05 * s, 0.025, 0.118, head);
  }
  add(new THREE.SphereGeometry(0.016, 6, 4), pink, 0, -0.02, 0.135, head);
  const legs = [];
  for (const [x, z] of [[-0.08, 0.15], [0.08, 0.15], [-0.08, -0.15], [0.08, -0.15]]) legs.push(add(new THREE.CylinderGeometry(0.035, 0.03, 0.16, 6), fur, x, 0.08, z));
  // 꼬리(두 마디)
  const tail = new THREE.Group();
  tail.position.set(0, 0.24, -0.27);
  g.add(tail);
  add(new THREE.CylinderGeometry(0.028, 0.032, 0.22, 6), stripes ? fur2 : fur, 0, 0.1, -0.02, tail).rotation.x = -0.4;
  const tip = add(new THREE.CylinderGeometry(0.022, 0.028, 0.16, 6), fur, 0, 0.24, -0.06, tail);
  tip.rotation.x = 0.4;
  g.userData = { head, tail, legs, body };
  return g;
}

export class Cats {
  // 1인칭에선 실제 크기(약 30 cm)로, 위에서 볼 땐 잘 보이게 크게
  realistic(on) { this.real = on; for (const c of this.cats) c.g.scale.setScalar(c.scale * (on ? 0.22 : 1)); }

  constructor(world, spots) {
    this.w = world;
    this.cats = [];
    const mk = (main, accent, stripes, scale, at, follow = null, name = '') => {
      const g = catModel(main, accent, stripes);
      g.scale.setScalar(scale);
      world.scene.add(g);
      const c = { g, pos: new THREE.Vector3(at[0], 0, at[1]), home: new THREE.Vector3(at[0], 0, at[1]), target: null, yaw: Math.random() * 6, state: 'idle', timer: 2 + Math.random() * 4, follow, scale, name, t: Math.random() * 10, jump: 0 };
      this.cats.push(c);
      return c;
    };
    // 크기는 실제보다 3배쯤 키웠어요(멀리서도 보이게).
    const mom = mk(0xf6f4ef, 0xe8e4dc, false, 3.4, spots.white, null, '하양');
    mom.dex = 'cat-mom';
    ['솜', '눈송이', '구름'].forEach((n, i) => { const k = mk(0xfbfaf6, 0xece8e0, false, 1.9, [spots.white[0] + 1.2 * (i + 1), spots.white[1] + 1.5], i === 0 ? mom : this.cats[this.cats.length - 1], n); k.dex = `cat-k${i + 1}`; });
    const ch = mk(0xf0a13a, 0xc96f1f, true, 3.4, spots.cheese, null, '치즈');
    ch.dex = 'cat-cheese';
    this.place();
  }

  place() {
    for (const c of this.cats) {
      c.pos.y = this.w.terrain.heightAt(c.pos.x, c.pos.z);
      c.g.position.copy(c.pos);
      c.g.rotation.y = c.yaw;
    }
  }

  meshes() {
    const out = [];
    for (const c of this.cats) c.g.traverse((o) => { if (o.isMesh) { o.userData.cat = c; out.push(o); } });
    return out;
  }

  // 화면 좌표에서 가장 가까운 고양이(손가락으로 누르기 쉽게 넉넉하게)
  pickScreen(x, y, camera, rect) {
    let best = null, bd = Infinity;
    const v = new THREE.Vector3();
    for (const c of this.cats) {
      v.copy(c.g.position).add(new THREE.Vector3(0, 0.25 * c.scale, 0)).project(camera);
      if (v.z > 1) continue;
      const sx = rect.left + ((v.x + 1) / 2) * rect.width, sy = rect.top + ((1 - v.y) / 2) * rect.height;
      const dist = camera.position.distanceTo(c.g.position);
      const R = Math.max(30, Math.min(90, (900 * c.scale * 0.5) / dist));
      const d = Math.hypot(sx - x, sy - y);
      if (d < R && d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // 쓰다듬기: 반응이 여러 가지예요.
  pet(c) {
    const kitten = c.scale < 2.5;
    const R = kitten
      ? [['hop', '미야~', '폴짝! 신났어요'], ['roll', '미유…', '배를 보여 줬어요'], ['spin', '먀!', '자기 꼬리를 쫓아 빙글빙글'], ['purr', '골골골', '손에 얼굴을 비벼요'], ['pounce', '냥!', '엄마한테 달려가요']]
      : [['hop', '냐옹', '기분이 좋아 보여요'], ['roll', '냐아앙~', '발라당 누워서 배를 보여 줬어요'], ['stretch', '냐-옹', '쭉- 기지개를 켜요'], ['purr', '골골골…', '눈을 감고 골골송을 불러요'], ['loaf', '…냥', '식빵 자세로 꾸벅꾸벅'], ['spin', '냥?', '빙글 돌며 냄새를 맡아요']];
    const [type, word, text] = R[Math.floor(Math.random() * R.length)];
    c.react = { type, t: 0 };
    c.state = 'idle';
    c.timer = 4;
    const fx = this.w.fx;
    const p = c.g.position;
    const n = type === 'purr' ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const col = type === 'loaf' ? '#cfd8ff' : i % 2 ? '#ff6fae' : '#ff9fc6';
      fx.smoke.spawn(p.x, p.y + 1.6 * (c.scale / 3.4), p.z, (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2, new THREE.Color(col), 0.32, 1.3, { drag: 1.5, alpha: 1 });
    }
    this.w.sound.meow(type === 'purr' ? 'purr' : kitten ? 'kitten' : type === 'stretch' ? 'long' : Math.random() < 0.5 ? 'meow' : 'trill');
    this.w.ui.toast(word, `${c.name}: ${text}`);
  }

  // 폭발이 가까우면 반대쪽으로 도망가요.
  scare(P, R) {
    for (const c of this.cats) {
      const d = Math.hypot(c.pos.x - P.x, c.pos.z - P.z);
      if (d > R + 25) continue;
      const away = new THREE.Vector3(c.pos.x - P.x, 0, c.pos.z - P.z);
      if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      away.normalize().multiplyScalar(R + 30 + Math.random() * 10);
      let tx = c.pos.x + away.x, tz = c.pos.z + away.z;
      const T = this.w.terrain;
      tx = Math.max(T.x0 + 5, Math.min(T.x0 + T.w - 5, tx));
      tz = Math.max(T.z0 + 5, Math.min(T.z0 + T.d - 5, tz));
      c.target = new THREE.Vector3(tx, 0, tz);
      c.state = 'flee';
      c.jump = 0.35;
      if (d < R) {
        // 폭발 한가운데 있으면 순간이동하듯 피해요(절대 안 다쳐요). 건물 안으로는 가지 않게 빈 곳을 찾아요.
        const O = this.w.obstacles;
        let ok = !O || !O.blocked(tx, tz, 0.6);
        for (let k = 0; k < 12 && !ok; k++) { const a = Math.random() * Math.PI * 2, rr = R + 20 + k * 3; tx = c.pos.x + Math.cos(a) * rr; tz = c.pos.z + Math.sin(a) * rr; ok = !O.blocked(tx, tz, 0.6); }
        if (ok) c.pos.set(tx, 0, tz);
        c.target = new THREE.Vector3(tx, 0, tz);
      }
    }
  }

  update(dt) {
    const T = this.w.terrain;
    for (const c of this.cats) {
      c.t += dt;
      const ud = c.g.userData;
      if (c.follow) {
        // 새끼: 앞 고양이를 1.4 m 뒤에서 따라가요.
        const lead = c.follow.pos;
        const d = Math.hypot(lead.x - c.pos.x, lead.z - c.pos.z);
        if (d > 1.6) { c.target = lead.clone(); c.state = c.follow.state === 'flee' ? 'flee' : 'walk'; } else if (c.state !== 'idle') { c.state = 'idle'; }
      } else if (c.state === 'idle') {
        c.timer -= dt;
        if (c.timer <= 0) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 10;
          c.target = new THREE.Vector3(c.home.x + Math.cos(a) * r, 0, c.home.z + Math.sin(a) * r);
          c.state = 'walk';
        }
      }
      let moving = 0;
      if ((c.state === 'walk' || c.state === 'flee') && c.target) {
        const dx = c.target.x - c.pos.x, dz = c.target.z - c.pos.z;
        const d = Math.hypot(dx, dz);
        const sp = (c.state === 'flee' ? 9 : 1.6) * (c.follow ? 1.25 : 1);
        if (d < 0.6 || (c.follow && d < 1.5)) {
          if (!c.follow) { c.home.copy(c.pos); c.state = 'idle'; c.timer = 3 + Math.random() * 6; }
        } else {
          const want = Math.atan2(dx, dz);
          let dy = want - c.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          c.yaw += dy * Math.min(1, dt * 8);
          const step = Math.min(d, sp * dt);
          const O = this.w.obstacles, r = 0.35 * (c.scale / 3.4) + 0.25;
          if (O) {
            O.escape(c.pos, r, { treesToo: true });
            const res = O.slide(c.pos, (dx / d) * step, (dz / d) * step, r, { treesToo: true });
            // 완전히 막히면 다른 곳으로 방향을 바꿔요.
            if (res === 'stuck') { c.stuck = (c.stuck || 0) + dt; if (c.stuck > 0.4 && !c.follow) { c.stuck = 0; const a = Math.random() * Math.PI * 2; c.target = new THREE.Vector3(c.pos.x + Math.cos(a) * 8, 0, c.pos.z + Math.sin(a) * 8); } }
            else c.stuck = 0;
          } else { c.pos.x += (dx / d) * step; c.pos.z += (dz / d) * step; }
          moving = c.state === 'flee' ? 1.6 : 1;
        }
      }
      // 쓰다듬은 반응 애니메이션
      let roll = 0, stretch = 1, low = 0;
      if (c.react) {
        const r = c.react;
        r.t += dt;
        const u = Math.min(1, r.t / 1.2);
        if (r.type === 'hop' || r.type === 'pounce') { if (r.t < 0.05) c.jump = 0.5; }
        if (r.type === 'roll') roll = Math.sin(u * Math.PI) * Math.PI * 0.9;
        if (r.type === 'stretch') stretch = 1 + Math.sin(u * Math.PI) * 0.35;
        if (r.type === 'spin') c.yaw += dt * 9 * (1 - u);
        if (r.type === 'purr') ud.body.scale.x = 0.85 + Math.sin(r.t * 40) * 0.015;
        if (r.type === 'loaf') low = Math.min(1, r.t * 3) * 0.08 * c.scale;
        if (r.t > (r.type === 'loaf' ? 3 : 1.3)) c.react = null;
      }
      c.jump = Math.max(0, c.jump - dt);
      c.pos.y = T.heightAt(c.pos.x, c.pos.z);
      c.g.position.set(c.pos.x, c.pos.y + Math.sin((c.jump / 0.5) * Math.PI) * 0.5 * (c.scale / 3.4), c.pos.z);
      c.g.rotation.set(0, c.yaw, roll);
      c.g.position.y -= low;
      ud.body.scale.z = 1.45 * stretch;
      ud.tail.rotation.z = Math.sin(c.t * (moving ? 6 : 1.8)) * 0.4;
      ud.head.rotation.y = moving ? 0 : Math.sin(c.t * 0.5) * 0.5;
      ud.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(c.t * 14 * moving + (i % 3 === 0 ? 0 : Math.PI)) * 0.6 : 0; });
      ud.body.scale.y = 0.8 + (moving ? 0 : Math.sin(c.t * 2) * 0.02);
    }
  }

  reset() {
    for (const c of this.cats) { c.state = 'idle'; c.target = null; }
  }
}
