import * as THREE from 'three';

// HASA 택배차: 하루 두 번(10:30, 15:30) 4분 동안 와요. 누르면 "로켓 배송" — 건물에 로켓을 달아 우주로 보내요.
function truckModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x24384d, roughness: 0.1, metalness: 0.6 });
  const c = document.createElement('canvas');
  c.width = 512; c.height = 200;
  const k = c.getContext('2d');
  k.fillStyle = '#f4f5f7'; k.fillRect(0, 0, 512, 200);
  k.fillStyle = '#0b3d91'; k.fillRect(0, 128, 512, 34);
  k.fillStyle = '#fc3d21'; k.fillRect(0, 162, 512, 10);
  k.fillStyle = '#0b3d91';
  k.font = '800 64px "Pretendard Variable", Pretendard, sans-serif';
  k.fillText('HASA 로켓 배송', 26, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  // 짐칸(옆면에 글씨) + 운전석
  add(new THREE.BoxGeometry(2.3, 2.4, 4.4), [side, side, white, white, white, white], 0, 1.9, -0.8);
  add(new THREE.BoxGeometry(2.2, 1.7, 1.8), white, 0, 1.5, 2.3);
  add(new THREE.BoxGeometry(2.0, 0.8, 0.1), glass, 0, 1.95, 3.21);
  for (const [x, z] of [[-1.05, 2.2], [1.05, 2.2], [-1.05, -1.9], [1.05, -1.9]]) add(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2), dark, x, 0.45, z);
  const lamp = add(new THREE.BoxGeometry(0.9, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8a00, emissiveIntensity: 2 }), 0, 2.45, 2.6);
  g.userData.lamp = lamp;
  g.scale.setScalar(1.4);
  return g;
}

export class Delivery {
  constructor(world, path) {
    this.w = world;
    this.path = path.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.truck = truckModel();
    this.truck.visible = false;
    world.scene.add(this.truck);
    this.meshes = [];
    this.truck.traverse((o) => { if (o.isMesh) this.meshes.push(o); });
    this.state = 'off';
    this.t = 0;
    this.slotDone = '';
    this.launches = [];
  }

  // 정해진 시간(10:30, 15:30)에 4분 동안
  schedule(now = new Date()) {
    if (this.state !== 'off') return;
    const mins = now.getHours() * 60 + now.getMinutes();
    for (const s of [10 * 60 + 30, 15 * 60 + 30]) {
      const key = `${now.toDateString()}-${s}`;
      if (mins >= s && mins < s + 4 && this.slotDone !== key) { this.slotDone = key; this.arrive(); }
    }
  }

  arrive() {
    if (this.state !== 'off') return;
    this.rolled = false; // 택배 상자 뽑기는 방문마다 한 번
    this.state = 'drive';
    this.seg = 0;
    this.u = 0;
    this.stay = 240;
    this.truck.visible = true;
    this.w.ui.toast('HASA 택배 도착!', '주차장의 택배차를 눌러 보세요');
    if (this.w.autoSound?.()) this.w.sound.honk?.();
  }

  leave() { if (this.state === 'park') { this.state = 'leave'; this.seg = this.path.length - 2; this.u = 1; } }

  hit(ray) { return this.truck.visible && ray.intersectObjects(this.meshes, false).length > 0; }

  // 로켓 배송: 멀쩡한 건물마다 로켓 엔진 4개를 달고 차례로 발사
  rocketDelivery() {
    const w = this.w;
    const all = w.buildings.list.filter((b) => b.intact && !b.launched && !this.launches.some((L) => L.b === b));
    if (!all.length) { w.ui.toast('배송할 건물이 없어요', '멀쩡한 건물만 로켓 배송돼요'); return false; }
    // 한 번 누를 때 한 동만(택배차에서 가장 가까운 건물)
    const tp = this.truck.position, list = [all.sort((a, b) => Math.hypot(a.c2[0] - tp.x, a.c2[1] - tp.z) - Math.hypot(b.c2[0] - tp.x, b.c2[1] - tp.z))[0]];
    w.ui.toast('로켓 배송 출발!', `${list[0].name || '건물'}을(를) 우주로 배송해요 · 다시 짓기로 돌아와요`, 'gold');
    w.sound.countdown?.();
    const engineMat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.3, metalness: 0.8 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    list.forEach((b, i) => {
      const objs = [b.intact, b.decor, b.cap].filter(Boolean);
      for (const o of objs) o.userData.p0 = o.position.clone(); // 원래 자리 기억
      const pack = new THREE.Group();
      const engines = [];
      const xs = b.poly.map((p) => p[0]), zs = b.poly.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const hx = (Math.max(...xs) - Math.min(...xs)) * 0.32, hz = (Math.max(...zs) - Math.min(...zs)) * 0.32;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const e = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 4, 16), engineMat);
        e.position.set(cx + sx * hx, b.base - 1.5, cz + sz * hz);
        const f = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 14, 1, true).rotateX(Math.PI), flameMat);
        f.position.set(e.position.x, b.base - 8, e.position.z);
        f.visible = false;
        pack.add(e, f);
        engines.push({ e, f });
      }
      w.scene.add(pack);
      this.launches.push({ b, objs, pack, engines, t: -2.2 - i * 0.45, y: 0, v: 0, label: b.label, cx, cz });
    });
    // 첫 건물을 따라가는 카메라
    const first = this.launches[this.launches.length - list.length];
    const side = new THREE.Vector3(1, 0, 0.6).normalize();
    w.director?.play((t) => {
      const L = first;
      const P = new THREE.Vector3(L.cx, L.b.base + L.y, L.cz);
      if (t < 2.4) return { key: 'pad', pos: P.clone().addScaledVector(side, 120).add(new THREE.Vector3(0, 40, 0)), look: P.clone().add(new THREE.Vector3(0, 10, 0)), snap: 2 };
      if (t < 11) return { key: 'up', pos: P.clone().addScaledVector(side, 90).add(new THREE.Vector3(0, -20 + Math.min(60, t * 6), 0)), look: P.clone().add(new THREE.Vector3(0, 15, 0)), snap: 3, lookSnap: 6 };
      return null;
    });
    return true;
  }

  update(dt) {
    const w = this.w;
    const T = w.terrain;
    if (this.state === 'drive' || this.state === 'leave') {
      const a = this.path[this.seg], b = this.path[this.seg + 1];
      const L = a.distanceTo(b) || 1;
      const sp = 9;
      this.u += ((this.state === 'drive' ? 1 : -1) * sp * dt) / L;
      if (this.state === 'drive' && this.u >= 1) { this.u = 0; this.seg++; if (this.seg >= this.path.length - 1) { this.state = 'park'; this.seg = this.path.length - 2; this.u = 1; } }
      if (this.state === 'leave' && this.u <= 0) { this.u = 1; this.seg--; if (this.seg < 0) { this.state = 'off'; this.truck.visible = false; } }
    }
    if (this.state !== 'off') {
      const a = this.path[Math.max(0, this.seg)], b = this.path[Math.max(0, this.seg) + 1];
      const p = a.clone().lerp(b, Math.max(0, Math.min(1, this.u)));
      p.y = T.heightAt(p.x, p.z);
      this.truck.position.copy(p);
      const dir = this.state === 'leave' ? a.clone().sub(b) : b.clone().sub(a);
      this.truck.rotation.y = Math.atan2(dir.x, dir.z);
      this.truck.userData.lamp.material.emissiveIntensity = 1 + Math.sin(performance.now() / 120) * 1;
      if (this.state === 'park') { this.stay -= dt; if (this.stay <= 0) this.leave(); }
    }
    // 발사 중인 건물
    for (let i = this.launches.length - 1; i >= 0; i--) {
      const L = this.launches[i];
      L.t += dt;
      if (L.t < 0) {
        // 카운트다운: 들썩들썩 + 하얀 연기
        const shake = L.t > -1.2 ? 0.15 : 0.05;
        for (const o of L.objs) o.position.x = o.userData.p0.x + (Math.random() - 0.5) * shake;
        if (L.t > -1.2 && Math.random() < 0.5) w.fx.smoke.spawn(L.cx + (Math.random() - 0.5) * 20, L.b.base + 0.5, L.cz + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 8, 1, (Math.random() - 0.5) * 8, new THREE.Color('#e9e6df'), 3, 2.5, { grow: 2, drag: 1.2, alpha: 0.7 });
        continue;
      }
      if (!L.lit) {
        L.lit = true;
        for (const e of L.engines) e.f.visible = true;
        w.sound.roar?.(4);
        if (L.label) L.label.visible = false;
      }
      L.v += (6 + L.t * 6) * dt;
      L.y += L.v * dt;
      for (const o of L.objs) o.position.set(o.userData.p0.x, o.userData.p0.y + L.y, o.userData.p0.z);
      L.pack.position.y = L.y;
      for (const e of L.engines) {
        e.f.scale.set(1, 0.8 + Math.random() * 0.5, 1);
        const q = e.e.position.clone().add(L.pack.position);
        w.fx.exhaust?.(new THREE.Vector3(q.x, q.y - 2.5, q.z), new THREE.Vector3(0, 1, 0), 0.8);
      }
      if (L.y > 1400) {
        for (const o of L.objs) w.buildings.group.remove(o);
        w.scene.remove(L.pack);
        L.b.launched = true;
        L.b.collapsed = true;
        this.launches.splice(i, 1);
        w.onLaunched?.(L.b);
      }
    }
  }

  reset() {
    for (const L of this.launches) w_removePack(this.w, L);
    this.launches = [];
  }
}

function w_removePack(w, L) { w.scene.remove(L.pack); }
