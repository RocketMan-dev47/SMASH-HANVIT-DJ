import * as THREE from 'three';
import { sideFrom } from './camera.js';
import { makeKF21 } from './kf21.js';
import { RoadsterUFO, makeAlien, makeBat } from './props.js';

const svg = (d) => `<svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const TOOL_DEFS = [
  { id: 'bomb', name: '폭탄', R: 9, hint: '누른 곳이 바로 터져요', icon: svg('<circle cx="12.5" cy="16" r="8"/><path d="M18 10.5l2.6-2.6"/><path d="M21.5 7c1-1.6 2.7-1.7 3.6-.8"/>') },
  { id: 'bat', name: '배트', R: 5.5, options: 'bat', hint: '크기를 골라 거대한 배트로 날려 버려요', icon: svg('<path d="M5 23l2.2 2.2"/><path d="M6.2 21.8L18.5 7.6c1.6-1.8 4-2 5.3-.7s1.1 3.7-.7 5.3L8.9 24.5"/><circle cx="23.5" cy="21" r="2.2"/>') },
  { id: 'laser', name: '레이저', R: 2.2, hold: true, hint: '누른 채로 끌면 하늘에 뜬 로드스터가 레이저를 쏴요', icon: svg('<path d="M14 3v6"/><path d="M14 13v12"/><circle cx="14" cy="11" r="2"/><path d="M8 5.5l2.2 2.2M20 5.5l-2.2 2.2"/>') },
  { id: 'meteor', name: '운석', R: 17, hint: '우주에서부터 불타며 떨어져요', icon: svg('<circle cx="18.5" cy="18.5" r="6"/><path d="M4 4l10 10M9 3.5l7 7M3.5 9l7 7"/>') },
  { id: 'quake', name: '지진', R: 42, options: 'quake', hint: '진도를 골라 주변 건물을 흔들어 무너뜨려요', icon: svg('<path d="M3 15h4l2.5-6 4 12 3.5-9 2 3H25"/>') },
  { id: 'landslide', name: '산사태', R: 14, hint: '산 위에서 바위가 굴러 내려와요', icon: svg('<path d="M3 23L12 8l5 7 3-4 5 12z"/><circle cx="19" cy="20" r="2"/><circle cx="14" cy="21.5" r="1.4"/>') },
  { id: 'rocket', name: '로켓', R: 15, hint: '운동장 발사대에서 2단 로켓을 쏴요', icon: svg('<path d="M14 3c3.5 3 4.5 7 4.5 11.5L14 20l-4.5-5.5C9.5 10 10.5 6 14 3z"/><path d="M9.5 15L6 19l3.5.8M18.5 15l3.5 4-3.5.8"/><path d="M12.5 22.5L14 26l1.5-3.5"/>') },
  { id: 'nuke', name: '핵폭탄', R: 38, hint: '목표를 찍으면 KF-21이 날아와 떨어뜨려요', icon: svg('<circle cx="14" cy="14" r="1.9"/><path d="M11.90 10.36 L8.75 4.91 A10.5 10.5 0 0 1 19.25 4.91 L16.10 10.36 A4.2 4.2 0 0 0 11.90 10.36Z"/><path d="M18.20 14.00 L24.50 14.00 A10.5 10.5 0 0 1 19.25 23.09 L16.10 17.64 A4.2 4.2 0 0 0 18.20 14.00Z"/><path d="M11.90 17.64 L8.75 23.09 A10.5 10.5 0 0 1 3.50 14.00 L9.80 14.00 A4.2 4.2 0 0 0 11.90 17.64Z"/>') },
];

const _v = new THREE.Vector3();

// 진도(Ⅳ~Ⅹ)에 따라 지진 크기가 달라져요.
export const ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];
export const QUAKE_TEXT = {
  4: '창문이 덜컹거려요', 5: '물건이 떨어지고 벽이 흔들려요', 6: '벽에 금이 가고 일부가 부서져요',
  7: '오래된 건물부터 무너져요', 8: '많은 건물이 무너져요', 9: '거의 모든 건물이 무너져요', 10: '땅이 갈라지고 전부 무너져요',
};
export const BAT_SIZES = [
  { name: 'S', len: 6, R: 3.5, power: 26 }, { name: 'M', len: 9, R: 5.5, power: 32 },
  { name: 'L', len: 13, R: 8, power: 38 }, { name: 'XL', len: 18, R: 11, power: 44 },
];

export function quakeParams(I) {
  const k = (I - 4) / 6;
  return {
    R: 14 + (I - 4) * 8,
    dur: 1.4 + (I - 4) * 0.45,
    hitR: 2.2 + Math.max(0, I - 5) * 0.55,
    power: 3 + (I - 4) * 1.7,
    hits: [0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 4][I],
    chance: [0, 0, 0, 0, 0, 0.3, 0.45, 0.7, 0.9, 1, 1][I],
    shake: 0.5 + k * 2.1,
    trees: I - 3,
    crack: I >= 6,
  };
}

// 바위(산사태). InstancedMesh 하나로 굴러가는 바위를 그립니다.
class Boulders {
  constructor(world, max = 160) {
    this.w = world;
    this.max = max;
    const geo = new THREE.DodecahedronGeometry(1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), max);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.items = [];
    this.next = 0;
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) { this.mesh.setMatrixAt(i, this.zero); this.mesh.setColorAt(i, c); }
    world.scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.mudTimer = 0;
  }

  spawn(pos, r, vel) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const col = new THREE.Color().setHSL(0.08, 0.15 + Math.random() * 0.1, 0.3 + Math.random() * 0.15);
    this.mesh.setColorAt(i, col);
    this.mesh.instanceColor.needsUpdate = true;
    this.items[i] = { i, pos: pos.clone(), vel: vel.clone(), r, q: new THREE.Quaternion(), life: 10, cool: 0, alive: true, moving: true };
  }

  update(dt) {
    const T = this.w.terrain;
    let any = false;
    this.mudTimer -= dt;
    for (const b of this.items) {
      if (!b || !b.alive || !b.moving) continue;
      any = true;
      b.life -= dt;
      const p = b.pos;
      const e = 1.5;
      const gx = (T.heightAt(p.x + e, p.z) - T.heightAt(p.x - e, p.z)) / (2 * e);
      const gz = (T.heightAt(p.x, p.z + e) - T.heightAt(p.x, p.z - e)) / (2 * e);
      // 비탈 아래로 가속하고 땅과 마찰합니다.
      b.vel.x += -gx * 16 * dt;
      b.vel.z += -gz * 16 * dt;
      const f = Math.exp(-0.35 * dt);
      b.vel.x *= f; b.vel.z *= f;
      p.x += b.vel.x * dt; p.z += b.vel.z * dt;
      if (!T.inside(p.x, p.z)) { b.alive = false; this.mesh.setMatrixAt(b.i, this.zero); continue; }
      p.y = T.heightAt(p.x, p.z) + b.r * 0.85;
      const sp = Math.hypot(b.vel.x, b.vel.z);
      if (sp > 0.05) {
        _v.set(b.vel.z, 0, -b.vel.x).normalize();
        this.q.setFromAxisAngle(_v, (sp * dt) / b.r);
        b.q.premultiply(this.q);
      }
      b.cool -= dt;
      if (sp > 3 && b.cool <= 0) {
        b.cool = 0.22;
        const res = this.w.explode(p.clone(), { tool: 'landslide', R: b.r * 2.3, power: 5 + sp * 1.3, fx: false, sound: false, crater: false, weight: 0.12, quiet: true });
        if (res.volume > 0) { b.vel.multiplyScalar(0.62); this.w.fx.dust(p, b.r * 2); }
      }
      if (this.mudTimer <= 0) this.w.painter.mud(p.x, p.z, b.r * 1.3);
      if (Math.random() < 0.35) this.w.fx.dust(p, b.r * 1.1);
      if ((sp < 0.4 && b.life < 8.5) || b.life <= 0) b.moving = false;
      this.s.setScalar(b.r);
      this.m.compose(p, b.q, this.s);
      this.mesh.setMatrixAt(b.i, this.m);
    }
    if (this.mudTimer <= 0) this.mudTimer = 0.12;
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
    return any;
  }

  clear() {
    for (const b of this.items) if (b) { b.alive = false; this.mesh.setMatrixAt(b.i, this.zero); }
    this.items = [];
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Tools {
  constructor(world) {
    this.w = world;
    this.meteors = [];
    this.quakes = [];
    this.boulders = new Boulders(world);
    this.meteorGeo = new THREE.IcosahedronGeometry(2.6, 1);
    this.meteorMat = new THREE.MeshStandardMaterial({ color: 0x3a2f28, emissive: 0xff5a1f, emissiveIntensity: 0.9, roughness: 0.8, flatShading: true });
    this.laser = null;
    this.quakeId = 0;
    this.rumbling = 0;
    this.nukes = [];
    try { this.intensity = Number(localStorage.getItem('smash-quake')) || 7; } catch { this.intensity = 7; }
    try { this.batSize = Number(localStorage.getItem('smash-bat')) || 2; } catch { this.batSize = 2; }
    this.bats = [];
    this.ufo = new RoadsterUFO(world.scene);
    // 우주에 숨어 있는 외계인(운석 출발점 근처)
    this.meteorDir = new THREE.Vector3(-0.42, 1, 0.3).normalize();
    this.alien = makeAlien();
    const f = world.focus || [0, 0];
    const across = new THREE.Vector3(-this.meteorDir.z, 0, this.meteorDir.x).normalize();
    this.alien.position.set(f[0], 0, f[1]).addScaledVector(this.meteorDir, 3950).addScaledVector(across, 48).add(new THREE.Vector3(0, -12, 0));
    world.scene.add(this.alien);

    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    this.beamCore = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff1ec, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beamGlow = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beamCore.visible = this.beamGlow.visible = false;
    this.beamLight = new THREE.PointLight(0xff4a3a, 0, 40, 2);
    world.scene.add(this.beamCore, this.beamGlow, this.beamLight);
  }

  fire(tool, P) {
    const w = this.w;
    switch (tool.id) {
      case 'bomb':
        w.explode(P, { tool: 'bomb', R: 9, power: 26 });
        break;
      case 'bat':
        this.swing(P);
        break;
      case 'meteor': {
        // 우주(약 4 km 위)에서 출발해 대기권에 들어오며 불타올라요.
        const dir = this.meteorDir;
        const m = new THREE.Mesh(this.meteorGeo, this.meteorMat);
        m.castShadow = true;
        w.scene.add(m);
        const mt = { m, from: P.clone().addScaledVector(dir, 4000), to: P.clone(), t: 0, dur: 4.6 };
        this.meteors.push(mt);
        w.sound.whoosh(4.6);
        const side = sideFrom(w.camera, P);
        const cross = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        w.director?.play((t) => {
          if (!mt.done) {
            const p = mt.m.position;
            if (t < 1.4) return { key: 'space', cut: true, pos: mt.from.clone().addScaledVector(cross, 70).addScaledVector(dir, 25).add(new THREE.Vector3(0, -30, 0)), look: p.clone().addScaledVector(dir, -60), snap: 2, lookSnap: 6 };
            return { key: 'chase', pos: p.clone().addScaledVector(dir, 38).addScaledVector(cross, 14).add(new THREE.Vector3(0, 4, 0)), look: p.clone().lerp(mt.to, 0.3), snap: 5, lookSnap: 10 };
          }
          if (t < mt.dur + 2.3) return { key: 'impact', pos: mt.to.clone().addScaledVector(side, 62).add(new THREE.Vector3(0, 34, 0)), look: mt.to.clone().add(new THREE.Vector3(0, 6, 0)), snap: 2.4 };
          return null;
        });
        break;
      }
      case 'quake':
        this.quake(P);
        break;
      case 'landslide':
        this.landslide(P);
        break;
      case 'rocket':
        if (!w.rocket.launch(P)) w.ui.toast('로켓 준비 중', '발사대에 새 로켓이 올라오고 있어요');
        break;
      case 'nuke':
        // 핵폭탄은 위치 지정 패드에서 목표를 찍고 발사해요(main.js 참고).
        break;
      default:
        break;
    }
  }

  // ---------- 배트 ----------
  setBatSize(n) {
    this.batSize = Math.max(1, Math.min(4, Math.round(n)));
    try { localStorage.setItem('smash-bat', String(this.batSize)); } catch { /* 무시 */ }
  }

  // 카메라 쪽에서 보이게, 목표 옆에서 크게 휘둘러요. 0도를 지나는 순간 맞아요.
  swing(P) {
    const w = this.w;
    const S = BAT_SIZES[this.batSize - 1];
    const side = sideFrom(w.camera, P);
    const across = new THREE.Vector3(-side.z, 0, side.x);
    const bat = makeBat();
    const k = S.len / 0.84;
    bat.scale.setScalar(k);
    const pivot = new THREE.Group();
    pivot.position.copy(P).addScaledVector(across, -0.72 * S.len).addScaledVector(side, S.len * 0.15).add(new THREE.Vector3(0, Math.max(1.2, S.len * 0.08), 0));
    // 배트 길이 방향(+y)을 수평으로 눕혀요.
    bat.rotation.z = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(bat);
    pivot.add(holder);
    w.scene.add(pivot);
    this.bats.push({ pivot, holder, P: P.clone(), S, t: 0, hit: false, base: Math.atan2(across.x, across.z) - Math.PI / 2, side, across });
    w.sound.whoosh(0.3);
  }

  updateBats(dt) {
    const w = this.w;
    for (let i = this.bats.length - 1; i >= 0; i--) {
      const b = this.bats[i];
      b.t += dt;
      const swingT = 0.34;
      const u = Math.min(1, b.t / swingT);
      // 뒤로 젖혔다가(-110°) 앞으로(+45°) 가속하며 휘둘러요.
      const a = -1.92 + (1.92 + 0.78) * u * u;
      b.holder.rotation.set(0, b.base - a, -0.12 + u * 0.2);
      if (!b.hit && a >= 0) {
        b.hit = true;
        const tangent = b.side.clone().multiplyScalar(-1);
        const C = b.P.clone().addScaledVector(tangent, -b.S.R * 0.55);
        const res = w.explode(C, { tool: 'bat', R: b.S.R * 1.25, power: b.S.power, fx: false, sound: false, crater: false, scorch: false, weight: 0.8 });
        w.fx.impact(b.P, b.S.R);
        w.sound.crack(res.volume > 600);
        if (res.volume > 600) w.ui.toast('홈런!', '담장을 넘어갔어요', 'gold');
      }
      if (b.t > swingT + 0.25) b.pivot.scale.setScalar(Math.max(0.001, 1 - (b.t - swingT - 0.25) / 0.3));
      if (b.t > swingT + 0.6) { w.scene.remove(b.pivot); this.bats.splice(i, 1); }
    }
  }

  // ---------- 레이저 ----------
  holdStart(P) {
    this.laser = { P: P.clone(), tick: 0, on: false };
    this.ufo.show(P);
  }

  holdMove(P) {
    if (this.laser && P) { this.laser.P.copy(P); this.ufo.follow(P); }
  }

  holdEnd() {
    if (!this.laser) return;
    if (this.laser.on) this.w.sound.laser(false);
    this.laser = null;
    this.beamCore.visible = this.beamGlow.visible = false;
    this.beamLight.intensity = 0;
    this.ufo.hide();
  }

  updateLaser(dt) {
    const L = this.laser;
    if (!L) return;
    // 로드스터가 목표 위에 도착해야 레이저가 켜져요.
    const P = L.P;
    const top = this.ufo.emitter(new THREE.Vector3());
    if (!L.on) {
      if (Math.abs(top.y - (P.y + 55)) > 14) return;
      L.on = true;
      this.w.sound.laser(true);
    }
    const mid = top.clone().add(P).multiplyScalar(0.5);
    const len = top.distanceTo(P);
    const dir = P.clone().sub(top).normalize();
    const flick = 0.85 + Math.random() * 0.3;
    for (const [m, r] of [[this.beamCore, 0.35], [this.beamGlow, 1.3]]) {
      m.visible = true;
      m.position.copy(mid);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.scale.set(r * flick, len, r * flick);
    }
    this.beamCore.material.color.set(this.w.edition === 'xmas' ? 0xf4fff4 : 0xfff1ec);
    this.beamGlow.material.color.set(this.w.edition === 'xmas' ? 0x34c759 : 0xff3b30);
    this.beamLight.position.copy(P).add(new THREE.Vector3(0, 2, 0));
    this.beamLight.intensity = 900 * flick;
    this.w.fx.sparks(P, 3);
    L.tick -= dt;
    if (L.tick <= 0) {
      L.tick = 0.07;
      this.w.explode(P.clone(), { tool: 'laser', R: 2.2, power: 12, fx: false, sound: false, craterR: 0.8, craterD: 0.18, scorchR: 0.9, weight: 0.06, quiet: true });
    }
  }

  // ---------- 지진 ----------
  setIntensity(I) {
    this.intensity = Math.max(4, Math.min(10, Math.round(I)));
    try { localStorage.setItem('smash-quake', String(this.intensity)); } catch { /* 무시 */ }
  }

  quake(P) {
    const w = this.w;
    const id = ++this.quakeId;
    const q = quakeParams(this.intensity);
    this.quakes.push({ id, P: P.clone(), t: 0, tick: 0, I: this.intensity, ...q });
    if (q.crack) w.painter.crack(P.x, P.z, q.R * 0.9);
    w.sound.rumble(q.dur + 0.4, 0.5 + (this.intensity - 4) * 0.12);
    w.missions.quakeStart(id);
    w.fx.ring(P, q.R * 1.3);
    w.ui.toast(`진도 ${ROMAN[this.intensity]} 지진`, QUAKE_TEXT[this.intensity]);
    // 지구시스템과학 메모: 진앙거리, 진원거리, PS시, 오모리 공식
    const st = w.focus || [0, 0];
    const dm = Math.hypot(P.x - st[0], P.z - st[1]);
    const delta = 4 + dm * 0.15;
    const depth = 5 + Math.random() * 6 + (this.intensity - 4) * 1.2;
    const D = Math.hypot(delta, depth);
    const vp = 6.0, vs = 3.5;
    w.ui.quakeInfo?.({
      I: this.intensity, roman: ROMAN[this.intensity], M: 3.8 + (this.intensity - 4) * 0.6 + Math.random() * 0.2,
      delta, depth, D, vp, vs, tP: D / vp, tS: D / vs, k: (vp * vs) / (vp - vs), dur: q.dur,
    });
  }

  updateQuakes(dt) {
    const w = this.w;
    for (let i = this.quakes.length - 1; i >= 0; i--) {
      const q = this.quakes[i];
      q.t += dt;
      const fade = Math.max(0, 1 - q.t / q.dur);
      w.fx.shakeTo(q.shake * (0.35 + 0.65 * fade));
      q.tick -= dt;
      if (q.tick <= 0) {
        q.tick = 0.22;
        for (const b of w.buildings.list) {
          const d = Math.hypot(b.c2[0] - q.P.x, b.c2[1] - q.P.z);
          if (d > q.R || b.collapsed) continue;
          const k = 1 - d / q.R;
          for (let n = 0; n < q.hits; n++) {
            if (Math.random() > q.chance) continue;
            const x = b.c2[0] + (b.maxX - b.minX) * (Math.random() - 0.5) * 0.8;
            const z = b.c2[1] + (b.maxZ - b.minZ) * (Math.random() - 0.5) * 0.8;
            const P = new THREE.Vector3(x, b.base + 1.2 + Math.random() * 2, z);
            w.explode(P, { tool: 'quake', R: q.hitR * (0.6 + k * 0.6), power: q.power * (0.5 + k), fx: false, sound: false, crater: false, scorch: false, weight: 0.1, quiet: true, quakeId: q.id });
            w.fx.dust(P, 2 + q.I * 0.3);
          }
        }
        for (let n = 0; n < q.trees; n++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * q.R;
          const tp = new THREE.Vector3(q.P.x + Math.cos(a) * r, 0, q.P.z + Math.sin(a) * r);
          tp.y = w.terrain.heightAt(tp.x, tp.z);
          if (Math.random() < 0.35 + q.I * 0.05) w.trees.blast(tp, 3 + q.I * 0.3);
        }
      }
      if (q.t >= q.dur) {
        this.quakes.splice(i, 1);
        w.missions.quakeEnd(q.id);
      }
    }
  }

  // ---------- 핵폭탄 ----------
  // 떨어짐(휘파람) → 섬광 → 부풀어 오르는 불덩이 → 바깥으로 퍼지는 충격파 → 천천히 피어오르는 버섯구름
  nuke(P) {
    const w = this.w;
    const bomb = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.5, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3, 14), dark);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 8), dark);
    nose.position.y = -1.5;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 0.1), dark);
    tail.position.y = 1.7;
    const tail2 = tail.clone();
    tail2.rotation.y = Math.PI / 2;
    bomb.add(body, nose, tail, tail2);
    w.scene.add(bomb);
    // KF-21이 옆에서 날아와 떨어뜨려요. 폭탄은 비행기 속도를 그대로 가진 채 포물선으로 떨어져요.
    const side0 = sideFrom(w.camera, P);
    const dirJ = new THREE.Vector3(-side0.z, 0, side0.x);
    const h = 230, gB = 32, v = 150;
    const tFall = Math.sqrt((2 * h) / gB);
    const release = P.clone().addScaledVector(dirJ, -v * tFall).add(new THREE.Vector3(0, h, 0));
    const jet = makeKF21();
    jet.scale.setScalar(1.15);
    w.scene.add(jet);
    w.sound.jet(6);
    const R = 38;
    const fireball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18), new THREE.MeshBasicMaterial({
      color: 0xfff1d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    fireball.visible = false;
    w.scene.add(fireball);
    const light = new THREE.PointLight(0xffc27a, 0, 0, 2);
    w.scene.add(light);
    const lead = 3.0;
    const n = { P: P.clone(), R, t: -(tFall + lead), H: 0, bomb, fireball, light, wave: 0, waveTick: 0, cratered: false,
      jet, dirJ, v, gB, tFall, release, released: false };
    this.nukes.push(n);
    // 떨어지는 폭탄을 올려다보다가, 터지면 멀리 물러나 버섯구름을 천천히 돌며 보여줘요.
    const side = sideFrom(w.camera, P);
    w.director?.play(() => {
      const tt = n.t;
      const up = (y) => new THREE.Vector3(0, y, 0);
      if (tt < -n.tFall) {
        const j = n.jet.position;
        return { key: 'jet', cut: true, pos: j.clone().addScaledVector(n.dirJ, -34).addScaledVector(side, 14).add(up(5)), look: j.clone().addScaledVector(n.dirJ, 25), snap: 6, lookSnap: 10 };
      }
      if (tt < 0) {
        const b = n.bomb.position;
        return { key: 'bomb', pos: b.clone().addScaledVector(side, 38).addScaledVector(n.dirJ, -18).add(up(8)), look: b.clone().lerp(P, 0.25), snap: 3.5, lookSnap: 8 };
      }
      if (tt < 9 && !n.gone) {
        const a = tt * 0.07;
        const off = new THREE.Vector3(side.x * Math.cos(a) - side.z * Math.sin(a), 0, side.x * Math.sin(a) + side.z * Math.cos(a));
        return {
          pos: P.clone().addScaledVector(off, R * 4.4).add(new THREE.Vector3(0, R * 1.2 + tt * 5, 0)),
          look: P.clone().add(new THREE.Vector3(0, n.H * 0.55 + 8, 0)),
          snap: tt < 1.2 ? 2.2 : 1.3, lookSnap: 3,
        };
      }
      return null;
    });
  }

  // KF-21과 폭탄 위치 (n.t < 0: 접근·투하·낙하, 그 뒤: 비행기가 급상승하며 빠져나가요)
  updateJet(n, dt) {
    const w = this.w;
    const tRel = -n.tFall;
    const t = n.t;
    const fwd = n.dirJ;
    const jet = n.jet;
    let pos, dir;
    if (t < tRel) {
      pos = n.release.clone().addScaledVector(fwd, n.v * (t - tRel));
      dir = fwd.clone();
    } else {
      const tau = t - tRel;
      pos = n.release.clone().addScaledVector(fwd, n.v * tau).add(new THREE.Vector3(0, 7 * tau * tau, 0));
      dir = fwd.clone().multiplyScalar(n.v).add(new THREE.Vector3(0, 14 * tau, 0)).normalize();
    }
    jet.position.copy(pos);
    jet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    if (t >= tRel) jet.rotateZ(Math.min(1, (t - tRel) * 0.8) * 0.9);
    for (const b of jet.userData.burners) b.scale.set(1, 0.7 + Math.random() * 0.6 + (t > tRel ? 0.6 : 0), 1);
    if (t < tRel) {
      n.bomb.position.copy(pos).add(new THREE.Vector3(0, -1.6, 0));
      n.bomb.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), fwd);
    } else if (t < 0) {
      if (!n.released) { n.released = true; w.sound.whistle(n.tFall); w.ui.toast('KF-21 투하', '폭탄이 떨어지고 있어요'); }
      const tau = t - tRel;
      n.bomb.position.copy(n.release).add(new THREE.Vector3(0, -1.6, 0)).addScaledVector(fwd, n.v * tau).add(new THREE.Vector3(0, -0.5 * n.gB * tau * tau, 0));
      const vel = fwd.clone().multiplyScalar(n.v).add(new THREE.Vector3(0, -n.gB * tau, 0)).normalize();
      n.bomb.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), vel);
    }
    if (t > 4) jet.visible = false;
  }

  updateNukes(dt) {
    const w = this.w;
    for (let i = this.nukes.length - 1; i >= 0; i--) {
      const n = this.nukes[i];
      const prevT = n.t;
      n.t += dt;
      const { P, R } = n;
      const g = w.terrain.heightAt(P.x, P.z);
      this.updateJet(n, dt);
      if (n.t < 0) continue;
      if (prevT < 0) {
        w.scene.remove(n.bomb);
        n.fireball.visible = true;
        n.fireball.position.set(P.x, g + 2, P.z);
        w.ui.flash();
        w.sound.nuke();
        w.fx.explosion(P, R * 0.6, { flash: 0 });
        w.fx.ring(P, R * 3.2, 2.2);
      }
      const t = n.t;
      // 불덩이: 1.2초 동안 부풀고, 구름과 함께 올라가며 식어요.
      const grow = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);
      const H = R * 2.7 * (1 - Math.pow(1 - Math.min(1, t / 6.5), 2.2));
      n.H = H;
      const fbR = R * (0.12 + 0.36 * grow) * (1 + Math.min(1, t / 6) * 0.25);
      n.fireball.scale.setScalar(fbR);
      n.fireball.position.set(P.x, g + Math.max(fbR * 0.6, H * 0.92), P.z);
      const heat = Math.max(0, 1 - t / 5.5);
      n.fireball.material.color.setRGB(1, 0.55 + 0.4 * heat, 0.2 + 0.6 * heat * heat);
      n.fireball.material.opacity = t < 0.15 ? t / 0.15 : Math.max(0, 0.95 * heat);
      n.light.position.copy(n.fireball.position);
      n.light.intensity = 140 * R * R * Math.max(0, 1 - t / 3) ** 2;
      w.fx.shakeTo(2.4 * Math.max(0.15, 1 - t / 3.5));

      // 충격파: 1.8초에 걸쳐 바깥으로 퍼지며 건물을 차례로 쓰러뜨려요.
      if (n.wave < R) {
        n.wave = R * (1 - Math.pow(1 - Math.min(1, t / 1.8), 2));
        n.waveTick -= dt;
        if (n.waveTick <= 0) {
          n.waveTick = 0.09;
          w.explode(P, { tool: 'nuke', R: Math.max(4, n.wave), power: 55 - 25 * (n.wave / R), fx: false, sound: false, crater: false, scorch: false, weight: 0.3, quiet: true });
          w.fx.surge(P, n.wave);
        }
      }
      if (!n.cratered && t > 0.15) {
        n.cratered = true;
        w.explode(P, { tool: 'nuke', R: R * 0.35, power: 60, fx: false, sound: false, craterR: 1.6, craterD: 0.75, scorchR: 4, weight: 1 });
      }
      // 버섯구름
      if (t < 8) w.fx.mushroom(P, g, R, H, t, dt);
      if (t > 10) {
        w.scene.remove(n.fireball, n.light, n.jet);
        n.fireball.geometry.dispose();
        n.fireball.material.dispose();
        n.gone = true;
        this.nukes.splice(i, 1);
      }
    }
  }

  // ---------- 산사태 ----------
  landslide(P) {
    const w = this.w, T = w.terrain;
    // 누른 곳에서 비탈 위쪽으로 올라가며 바위가 출발할 자리를 찾습니다.
    let x = P.x, z = P.z;
    let climbed = 0;
    for (let i = 0; i < 16; i++) {
      const e = 2;
      const gx = (T.heightAt(x + e, z) - T.heightAt(x - e, z)) / (2 * e);
      const gz = (T.heightAt(x, z + e) - T.heightAt(x, z - e)) / (2 * e);
      const g = Math.hypot(gx, gz);
      if (g < 0.03) break;
      const nx = x + (gx / g) * 4, nz = z + (gz / g) * 4;
      if (!T.inside(nx, nz)) break;
      climbed += T.heightAt(nx, nz) - T.heightAt(x, z);
      x = nx; z = nz;
    }
    const src = new THREE.Vector3(x, T.heightAt(x, z), z);
    const toward = new THREE.Vector3(P.x - x, 0, P.z - z);
    if (climbed < 4 || toward.length() < 15) {
      // 평지라면 화면 뒤쪽에서 밀려오게 합니다.
      const cam = w.camera.position;
      const back = new THREE.Vector3(cam.x - P.x, 0, cam.z - P.z).normalize().multiplyScalar(-45);
      src.set(P.x + back.x, 0, P.z + back.z);
      src.x = Math.max(T.x0 + 2, Math.min(T.x0 + T.w - 2, src.x));
      src.z = Math.max(T.z0 + 2, Math.min(T.z0 + T.d - 2, src.z));
      src.y = T.heightAt(src.x, src.z);
      toward.set(P.x - src.x, 0, P.z - src.z);
    }
    toward.normalize();
    for (let i = 0; i < 38; i++) {
      const side = new THREE.Vector3(-toward.z, 0, toward.x).multiplyScalar((Math.random() - 0.5) * 22);
      const pos = src.clone().add(side).addScaledVector(toward, (Math.random() - 0.5) * 10);
      const r = 0.9 + Math.random() * 1.6;
      pos.y = T.heightAt(pos.x, pos.z) + r;
      const vel = toward.clone().multiplyScalar(9 + Math.random() * 7);
      this.boulders.spawn(pos, r, vel);
    }
    w.fx.ring(src, 20);
    w.sound.rumble(3.5);
    w.fx.shakeTo(0.9);
  }

  update(dt) {
    const w = this.w;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const mt = this.meteors[i];
      mt.t += dt / mt.dur;
      const k = Math.min(1, mt.t) ** 1.45;
      mt.m.position.lerpVectors(mt.from, mt.to, k);
      mt.m.rotation.x += dt * 4; mt.m.rotation.y += dt * 3;
      // 대기권에 들어올수록(아래로 갈수록) 불꽃 꼬리가 커져요.
      const heat = Math.min(1, 0.35 + k * 1.2);
      for (let j = 0; j < 5; j++) w.fx.trail(mt.m.position.x, mt.m.position.y, mt.m.position.z, 1.6 * heat + 0.4);
      if (mt.t >= 1) {
        w.scene.remove(mt.m);
        mt.done = true;
        this.meteors.splice(i, 1);
        w.explode(mt.to, { tool: 'meteor', R: 17, power: 40, flash: 1.6, craterR: 0.85, craterD: 0.45 });
      }
    }
    this.updateLaser(dt);
    this.updateQuakes(dt);
    this.updateNukes(dt);
    this.updateBats(dt);
    this.ufo.update(dt);
    this.alienT = (this.alienT || 0) + dt;
    this.alien.rotation.y = Math.sin(this.alienT * 0.6) * 0.5;
    this.alien.userData.arm.rotation.z = -0.4 + Math.sin(this.alienT * 6) * 0.5;
    this.alien.position.y += Math.sin(this.alienT * 1.5) * 0.02;
    if (this.boulders.update(dt)) {
      this.rumbling -= dt;
      if (this.rumbling <= 0) { this.rumbling = 0.5; w.sound.crumble(0.7); }
    }
  }

  reset() {
    for (const mt of this.meteors) this.w.scene.remove(mt.m);
    this.meteors = [];
    this.quakes = [];
    for (const n of this.nukes) this.w.scene.remove(n.bomb, n.fireball, n.light, n.jet);
    for (const b of this.bats) this.w.scene.remove(b.pivot);
    this.bats = [];
    this.nukes = [];
    this.boulders.clear();
    this.holdEnd();
  }
}
