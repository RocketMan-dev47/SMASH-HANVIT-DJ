import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  vAlpha = aAlpha;
  vColor = aColor;
}`;

const FRAG = /* glsl */ `
uniform float uSoft;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = 1.0 - smoothstep(uSoft, 1.0, d);
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

// 점 하나하나를 화면에 동그랗게 그리는 입자 묶음. 한 번에 그려서 가볍습니다.
class Particles {
  constructor(max, additive, soft) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.live = 0;
    const g = new THREE.BufferGeometry();
    this.attrPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attrPos);
    g.setAttribute('aColor', this.attrCol);
    g.setAttribute('aSize', this.attrSize);
    g.setAttribute('aAlpha', this.attrAlpha);
    this.uniforms = { uScale: { value: 500 }, uSoft: { value: soft } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, o = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = color.r; this.col[i3 + 1] = color.g; this.col[i3 + 2] = color.b;
    this.size[i] = size;
    this.life[i] = life; this.maxLife[i] = life;
    this.grow[i] = o.grow ?? 0;
    this.drag[i] = o.drag ?? 1.5;
    this.grav[i] = o.grav ?? 0;
    this.a0[i] = o.alpha ?? 1;
    this.alpha[i] = this.a0[i];
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      live++;
      this.life[i] -= dt;
      const i3 = i * 3;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= k; this.vel[i3 + 1] = this.vel[i3 + 1] * k - this.grav[i] * dt; this.vel[i3 + 2] *= k;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      // 처음엔 빨리 나타나고 천천히 사라집니다.
      this.alpha[i] = this.a0[i] * Math.min(1, (1 - t) * 8) * Math.pow(t, 0.8);
    }
    this.live = live;
    this.attrPos.needsUpdate = this.attrCol.needsUpdate = this.attrSize.needsUpdate = this.attrAlpha.needsUpdate = true;
  }

  clear() {
    this.life.fill(0); this.alpha.fill(0);
    this.attrAlpha.needsUpdate = true;
  }
}

// 부서진 콘크리트 덩어리(작은 돌). 하나의 InstancedMesh로 수천 개를 그립니다.
class Debris {
  constructor(max, terrain) {
    this.max = max;
    this.terrain = terrain;
    const geo = new THREE.DodecahedronGeometry(0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rot = Array.from({ length: max }, () => new THREE.Quaternion());
    this.ang = new Float32Array(max * 3);
    this.scale = new Float32Array(max);
    this.state = new Uint8Array(max);
    this.still = new Float32Array(max);
    this.moving = new Set();
    this.next = 0;
    this.m = new THREE.Matrix4();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.ax = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) { this.mesh.setMatrixAt(i, zero); this.mesh.setColorAt(i, white); }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  spawn(x, y, z, vx, vy, vz, size, color) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.ang[i3] = (Math.random() - 0.5) * 14; this.ang[i3 + 1] = (Math.random() - 0.5) * 14; this.ang[i3 + 2] = (Math.random() - 0.5) * 14;
    this.rot[i].set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();
    this.scale[i] = size;
    this.state[i] = 1;
    this.still[i] = 0;
    this.mesh.setColorAt(i, color);
    this.mesh.instanceColor.needsUpdate = true;
    this.moving.add(i);
    this.write(i);
  }

  write(i) {
    const i3 = i * 3;
    this.p.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
    const s = this.scale[i];
    this.s.set(s, s * 0.8, s * 1.1);
    this.m.compose(this.p, this.rot[i], this.s);
    this.mesh.setMatrixAt(i, this.m);
  }

  update(dt) {
    if (!this.moving.size) return;
    const T = this.terrain;
    for (const i of this.moving) {
      const i3 = i * 3;
      this.vel[i3 + 1] -= 18 * dt;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const w = Math.hypot(this.ang[i3], this.ang[i3 + 1], this.ang[i3 + 2]);
      if (w > 1e-3) {
        this.ax.set(this.ang[i3] / w, this.ang[i3 + 1] / w, this.ang[i3 + 2] / w);
        this.q.setFromAxisAngle(this.ax, w * dt);
        this.rot[i].premultiply(this.q);
      }
      const x = this.pos[i3], z = this.pos[i3 + 2];
      if (T.inside(x, z)) {
        const g = T.heightAt(x, z) + this.scale[i] * 0.35;
        if (this.pos[i3 + 1] < g) {
          this.pos[i3 + 1] = g;
          this.vel[i3 + 1] *= -0.3;
          this.vel[i3] *= 0.55; this.vel[i3 + 2] *= 0.55;
          this.ang[i3] *= 0.6; this.ang[i3 + 1] *= 0.6; this.ang[i3 + 2] *= 0.6;
          const sp = Math.abs(this.vel[i3]) + Math.abs(this.vel[i3 + 1]) + Math.abs(this.vel[i3 + 2]);
          if (sp < 1.2) this.still[i] += dt;
        }
      } else if (this.pos[i3 + 1] < T.bottom - 80) {
        this.scale[i] = 0;
        this.still[i] = 1;
      }
      this.write(i);
      if (this.still[i] > 0.25) { this.state[i] = 2; this.moving.delete(i); }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  wake(P, R) {
    for (let i = 0; i < this.max; i++) {
      if (this.state[i] !== 2) continue;
      const i3 = i * 3;
      if (Math.hypot(this.pos[i3] - P.x, this.pos[i3 + 2] - P.z) > R) continue;
      this.state[i] = 1;
      this.still[i] = 0;
      this.moving.add(i);
    }
  }

  clear() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) { this.mesh.setMatrixAt(i, zero); this.state[i] = 0; }
    this.moving.clear();
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const FIRE = ['#fff3b0', '#ffd166', '#ff9f43', '#ff6b2c', '#e2451f'].map((c) => new THREE.Color(c));
const SMOKE = ['#4b4540', '#5d5650', '#6e6760', '#3f3a36'].map((c) => new THREE.Color(c));
const DUST = ['#a8998a', '#b5a796', '#9a8c7d'].map((c) => new THREE.Color(c));
const LEAF = ['#4f7a35', '#6a9444', '#3f6a2b'].map((c) => new THREE.Color(c));
const PETAL = ['#f07ab6', '#e04f95', '#ffb3d4', '#d23a7f'].map((c) => new THREE.Color(c));
const WHITE_SMOKE = ['#e9e7e2', '#d6d3cc', '#f4f2ee', '#c9c5bd'].map((c) => new THREE.Color(c));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Effects {
  constructor(scene, terrain, quality) {
    this.scene = scene;
    this.terrain = terrain;
    const many = quality === 'high';
    this.fire = new Particles(many ? 2500 : 1200, true, 0.15);
    this.smoke = new Particles(many ? 5000 : 2200, false, 0.0);
    this.debris = new Debris(many ? 2600 : 1200, terrain);
    scene.add(this.smoke.points, this.fire.points, this.debris.mesh);

    this.flash = new THREE.PointLight(0xffa64d, 0, 0, 2);
    scene.add(this.flash);
    this.flashT = 0;
    this.flashI = 0;

    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xfff1d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, t: 1, R: 1 });
    }
    this.ringNext = 0;
    this.shake = 0;
    this.shakeOff = new THREE.Vector3();
  }

  setScale(px) {
    this.fire.uniforms.uScale.value = px;
    this.smoke.uniforms.uScale.value = px;
  }

  explosion(P, R, opts = {}) {
    const k = R / 9;
    const n = (v) => Math.round(v * Math.min(2.2, k));
    // 불덩이
    for (let i = 0; i < n(55); i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.1;
      const sp = (6 + Math.random() * 16) * k;
      this.fire.spawn(P.x, P.y + 0.5, P.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 4, Math.sin(a) * Math.cos(e) * sp,
        pick(FIRE), (3 + Math.random() * 5) * k, 0.35 + Math.random() * 0.45, { grow: 9 * k, drag: 4 });
    }
    // 불꽃
    for (let i = 0; i < n(70); i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3;
      const sp = (14 + Math.random() * 26) * k;
      this.fire.spawn(P.x, P.y + 0.5, P.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp,
        FIRE[0], 0.35 + Math.random() * 0.4, 0.6 + Math.random() * 0.7, { drag: 0.8, grav: 16 });
    }
    // 연기 기둥
    for (let i = 0; i < n(55); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.6;
      this.smoke.spawn(P.x + Math.cos(a) * r, P.y + Math.random() * R * 0.5, P.z + Math.sin(a) * r,
        Math.cos(a) * 3 * k, 3 + Math.random() * 7 * k, Math.sin(a) * 3 * k,
        pick(SMOKE), (5 + Math.random() * 6) * k, 2.8 + Math.random() * 2.5, { grow: 3.2 * k, drag: 0.9, alpha: 0.75 });
    }
    // 땅을 쓸고 나가는 흙먼지
    const g = this.terrain.heightAt(P.x, P.z);
    if (P.y - g < R * 0.8) {
      for (let i = 0; i < n(40); i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (10 + Math.random() * 12) * k;
        this.smoke.spawn(P.x, g + 0.8, P.z, Math.cos(a) * sp, 0.6, Math.sin(a) * sp,
          pick(DUST), (3 + Math.random() * 4) * k, 1.6 + Math.random() * 1.4, { grow: 4 * k, drag: 1.7, alpha: 0.7 });
      }
      const ring = this.rings[this.ringNext];
      this.ringNext = (this.ringNext + 1) % this.rings.length;
      ring.m.position.set(P.x, g + 0.4, P.z);
      ring.t = 0; ring.R = R * 2.6; ring.dur = 0.55;
      ring.m.visible = true;
    }
    this.flash.position.set(P.x, P.y + 3, P.z);
    this.flash.color.set(0xffa64d);
    this.flashI = 70 * R * R * (opts.flash ?? 1);
    this.flashT = 0;
    this.shake = Math.min(2.5, this.shake + 0.35 * k);
  }

  debrisBurst(center, half, P, strength, n, color) {
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = center.x + (Math.random() - 0.5) * half[0] * 2;
      const y = center.y + (Math.random() - 0.5) * half[1] * 2;
      const z = center.z + (Math.random() - 0.5) * half[2] * 2;
      let dx = x - P.x, dy = y - P.y + 1, dz = z - P.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      dx /= d; dy /= d; dz /= d;
      const sp = strength * (0.4 + Math.random() * 0.7);
      c.copy(Math.random() < 0.55 ? color : DUST[i % 3]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
      this.debris.spawn(x, y, z, dx * sp, dy * sp + Math.random() * 6, dz * sp, 0.5 + Math.random() * 1.3, c);
    }
    for (let i = 0; i < 3; i++) {
      this.smoke.spawn(center.x, center.y, center.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4,
        pick(DUST), 4 + Math.random() * 4, 1.8 + Math.random() * 1.5, { grow: 2.5, drag: 1.2, alpha: 0.6 });
    }
  }

  dust(pos, size) {
    const g = this.terrain.heightAt(pos.x, pos.z);
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.spawn(pos.x, g + 0.5, pos.z, Math.cos(a) * 3, 0.8 + Math.random(), Math.sin(a) * 3,
        pick(DUST), size * (0.9 + Math.random() * 0.6), 1.6 + Math.random() * 1.6, { grow: size * 0.9, drag: 1.4, alpha: 0.55 });
    }
  }

  leaves(x, y, z) {
    for (let i = 0; i < 14; i++) {
      this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 12, Math.random() * 9, (Math.random() - 0.5) * 12,
        pick(LEAF), 0.6 + Math.random() * 0.6, 1.2 + Math.random(), { drag: 1.6, grav: 4, alpha: 0.95 });
    }
  }

  petals(x, y, z) {
    for (let i = 0; i < 16; i++) {
      this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 9, 2 + Math.random() * 6, (Math.random() - 0.5) * 9,
        pick(PETAL), 0.35 + Math.random() * 0.35, 1.6 + Math.random() * 1.2, { drag: 1.8, grav: 2.5, alpha: 1 });
    }
  }

  sparks(P, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3;
      const sp = 6 + Math.random() * 14;
      this.fire.spawn(P.x, P.y + 0.3, P.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp,
        Math.random() < 0.5 ? FIRE[0] : FIRE[2], 0.3 + Math.random() * 0.4, 0.3 + Math.random() * 0.4, { drag: 1, grav: 14 });
    }
    if (Math.random() < 0.5) {
      this.smoke.spawn(P.x, P.y + 0.5, P.z, (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2,
        pick(SMOKE), 1.5 + Math.random() * 1.5, 1.2 + Math.random(), { grow: 2, drag: 1, alpha: 0.5 });
    }
  }

  impact(P, R) {
    const g = this.terrain.heightAt(P.x, P.z);
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      this.smoke.spawn(P.x, Math.max(P.y, g + 0.5), P.z, Math.cos(a) * sp, 1 + Math.random() * 2, Math.sin(a) * sp,
        pick(DUST), 1.5 + Math.random() * 2, 1 + Math.random(), { grow: 2.5, drag: 2, alpha: 0.7 });
    }
    this.shakeTo(0.5);
    const ring = this.rings[this.ringNext];
    this.ringNext = (this.ringNext + 1) % this.rings.length;
    ring.m.position.set(P.x, Math.max(P.y, g) + 0.3, P.z);
    ring.t = 0; ring.R = R * 1.6; ring.dur = 0.55;
    ring.m.visible = true;
  }

  ring(P, R, dur = 0.55) {
    const g = this.terrain.heightAt(P.x, P.z);
    const ring = this.rings[this.ringNext];
    this.ringNext = (this.ringNext + 1) % this.rings.length;
    ring.m.position.set(P.x, g + 0.4, P.z);
    ring.t = 0; ring.R = R; ring.dur = dur;
    ring.m.visible = true;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 8 + Math.random() * 10;
      this.smoke.spawn(P.x + Math.cos(a) * 3, g + 0.6, P.z + Math.sin(a) * 3, Math.cos(a) * sp, 0.5, Math.sin(a) * sp,
        pick(DUST), 3 + Math.random() * 3, 1.6 + Math.random(), { grow: 3, drag: 1.2, alpha: 0.55 });
    }
  }

  // 로켓 배기 불꽃
  exhaust(nozzle, dir, k = 1) {
    for (let i = 0; i < 5; i++) {
      const sp = 30 + Math.random() * 25;
      this.fire.spawn(nozzle.x, nozzle.y, nozzle.z,
        -dir.x * sp + (Math.random() - 0.5) * 5, -dir.y * sp + (Math.random() - 0.5) * 5, -dir.z * sp + (Math.random() - 0.5) * 5,
        i < 2 ? FIRE[0] : pick(FIRE), (1.6 + Math.random() * 1.5) * k, 0.18 + Math.random() * 0.15, { grow: 6 * k, drag: 3.5 });
    }
    this.smoke.spawn(nozzle.x, nozzle.y, nozzle.z, -dir.x * 8, -dir.y * 8, -dir.z * 8,
      pick(WHITE_SMOKE), (2 + Math.random() * 2) * k, 2.5 + Math.random() * 1.5, { grow: 2.2, drag: 1.2, alpha: 0.6 });
  }

  // 2단 엔진(진공용): 가늘고 밝은 흰·푸른 불꽃
  exhaust2(nozzle, dir) {
    const C = [new THREE.Color('#f4f8ff'), new THREE.Color('#bcd6ff'), new THREE.Color('#ffd9a8')];
    for (let i = 0; i < 4; i++) {
      const sp = 40 + Math.random() * 25;
      this.fire.spawn(nozzle.x, nozzle.y, nozzle.z,
        -dir.x * sp + (Math.random() - 0.5) * 2, -dir.y * sp + (Math.random() - 0.5) * 2, -dir.z * sp + (Math.random() - 0.5) * 2,
        C[i % 3], 0.7 + Math.random() * 0.6, 0.16 + Math.random() * 0.1, { grow: 3.5, drag: 2.5 });
    }
  }

  // 이륙할 때 발사대 둘레로 퍼지는 흰 연기
  launchSmoke(base) {
    const a = Math.random() * Math.PI * 2;
    const sp = 10 + Math.random() * 14;
    this.smoke.spawn(base.x + Math.cos(a) * 2, base.y + 1, base.z + Math.sin(a) * 2, Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp,
      pick(WHITE_SMOKE), 4 + Math.random() * 4, 3 + Math.random() * 2.5, { grow: 3.5, drag: 1.1, alpha: 0.75 });
  }

  // 버섯구름
  nuke(P, R) {
    this.explosion(P, R, { flash: 3 });
    const g = this.terrain.heightAt(P.x, P.z);
    const H = R * 2.1;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.18;
      this.smoke.spawn(P.x + Math.cos(a) * r, g + Math.random() * 6, P.z + Math.sin(a) * r, 0, 14 + Math.random() * 20, 0,
        pick(SMOKE), 6 + Math.random() * 6, 6 + Math.random() * 3, { grow: 2.5, drag: 0.55, alpha: 0.85 });
    }
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2, r = R * (0.25 + Math.random() * 0.45);
      this.smoke.spawn(P.x + Math.cos(a) * r, g + H + (Math.random() - 0.5) * R * 0.5, P.z + Math.sin(a) * r,
        Math.cos(a) * 3, 3 + Math.random() * 4, Math.sin(a) * 3,
        pick(SMOKE), 10 + Math.random() * 10, 7 + Math.random() * 4, { grow: 2.2, drag: 0.4, alpha: 0.8 });
    }
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.35;
      this.fire.spawn(P.x + Math.cos(a) * r, g + H * (0.2 + Math.random() * 0.8), P.z + Math.sin(a) * r, 0, 6 + Math.random() * 8, 0,
        pick(FIRE), 8 + Math.random() * 10, 1.5 + Math.random() * 1.5, { grow: 5, drag: 0.8 });
    }
    for (let k = 0; k < 3; k++) {
      const ring = this.rings[this.ringNext];
      this.ringNext = (this.ringNext + 1) % this.rings.length;
      ring.m.position.set(P.x, g + 0.5 + k * 0.2, P.z);
      ring.t = -k * 0.25; ring.R = R * (3 + k); ring.dur = 0.55;
      ring.m.visible = true;
    }
    this.shakeTo(3.2);
  }

  // 핵폭발 충격파가 지나가는 자리의 흙먼지 벽
  surge(P, r) {
    const n = Math.min(36, 8 + Math.round(r * 0.8));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (!this.terrain.inside(x, z)) continue;
      const g = this.terrain.heightAt(x, z);
      this.smoke.spawn(x, g + 1 + Math.random() * 3, z, Math.cos(a) * 9, 2 + Math.random() * 3, Math.sin(a) * 9,
        pick(DUST), 5 + Math.random() * 5, 2.5 + Math.random() * 2, { grow: 3.5, drag: 0.9, alpha: 0.65 });
    }
  }

  // 버섯구름: 기둥은 위로 빨려 올라가고, 머리 부분은 바깥으로 말려 나가요. 처음엔 속에서 불빛이 비쳐요.
  mushroom(P, g, R, H, t, dt) {
    const hot = Math.max(0, 1 - t / 4);
    const rate = (t < 3 ? 130 : 70) * dt;
    let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
    while (n-- > 0) {
      const a = Math.random() * Math.PI * 2;
      if (Math.random() < 0.35) {
        const r = Math.random() * R * 0.13 * (1 + t * 0.08);
        const y = g + Math.random() * Math.max(4, H * 0.8);
        this.smoke.spawn(P.x + Math.cos(a) * r, y, P.z + Math.sin(a) * r, Math.cos(a) * 0.8, H / 3.2 + 6, Math.sin(a) * 0.8,
          Math.random() < hot * 0.6 ? pick(FIRE) : pick(SMOKE), 5 + Math.random() * 4, 3 + Math.random() * 2, { grow: 2, drag: 0.6, alpha: 0.8 });
      } else {
        const rc = R * (0.3 + 0.32 * Math.min(1, t / 6)) * (0.6 + Math.random() * 0.5);
        const y = g + H + (Math.random() - 0.35) * R * 0.45;
        const up = y > g + H;
        const sp = 2 + Math.random() * 3;
        this.smoke.spawn(P.x + Math.cos(a) * rc, y, P.z + Math.sin(a) * rc,
          Math.cos(a) * (up ? sp : -sp * 0.6), up ? 1.5 : -0.8 + Math.random(), Math.sin(a) * (up ? sp : -sp * 0.6),
          Math.random() < hot * 0.45 ? pick(FIRE) : pick(SMOKE), 11 + Math.random() * 9, 6 + Math.random() * 4, { grow: 1.6, drag: 0.5, alpha: 0.85 });
      }
    }
    if (t < 2.5) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.25;
        this.fire.spawn(P.x + Math.cos(a) * r, g + H * (0.7 + Math.random() * 0.4), P.z + Math.sin(a) * r, 0, 3, 0,
          pick(FIRE), 10 + Math.random() * 8, 0.9 + Math.random() * 0.6, { grow: 4, drag: 1 });
      }
    }
  }

  // 자세 제어 가스처럼 작은 흰 연기
  puff(P) {
    this.smoke.spawn(P.x, P.y, P.z, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6,
      pick(WHITE_SMOKE), 1.2 + Math.random(), 0.7 + Math.random() * 0.5, { grow: 2.5, drag: 2.5, alpha: 0.7 });
  }

  // 불꽃놀이 한 발이 터질 때
  burst(P, color, n = 110) {
    const c2 = color.clone().lerp(new THREE.Color(1, 1, 1), 0.5);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const sp = 15 + Math.random() * 6;
      this.fire.spawn(P.x, P.y, P.z, r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp,
        Math.random() < 0.2 ? c2 : color, 0.9 + Math.random() * 0.7, 1.5 + Math.random() * 0.8, { drag: 1.3, grav: 5 });
    }
    this.flash.position.copy(P);
    this.flashI = Math.max(this.flashI, 9000);
    this.flash.color.copy(color);
    this.flashT = 0;
  }

  shakeTo(v) {
    this.shake = Math.max(this.shake, v);
  }

  trail(x, y, z, k = 1) {
    this.fire.spawn(x, y, z, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3,
      pick(FIRE), (2.5 + Math.random() * 2) * k, 0.35 + Math.random() * 0.25, { grow: 3, drag: 2 });
    if (Math.random() < 0.6) {
      this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2,
        pick(SMOKE), (3 + Math.random() * 3) * k, 1.6 + Math.random(), { grow: 2.5, drag: 1, alpha: 0.6 });
    }
  }

  update(dt, camera) {
    this.fire.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
    if (this.flashI > 0) {
      this.flashT += dt;
      this.flash.intensity = this.flashI * Math.exp(-this.flashT * 9);
      if (this.flashT > 0.8) { this.flashI = 0; this.flash.intensity = 0; }
    }
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt / (r.dur || 0.55);
      const s = 1 + (r.R - 1) * (1 - Math.pow(1 - Math.max(0, Math.min(1, r.t)), 3));
      r.m.scale.set(s, 1, s);
      r.m.material.opacity = r.t < 0 ? 0 : Math.max(0, 0.75 * (1 - r.t));
      if (r.t >= 1) r.m.visible = false;
    }
    // 화면 흔들림: 그리기 직전에 더하고 그린 뒤 뺍니다.
    this.shake = Math.max(0, this.shake - dt * 2.8);
    const s = this.shake * this.shake;
    this.shakeOff.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  clear() {
    this.fire.clear(); this.smoke.clear(); this.debris.clear();
    this.flash.intensity = 0; this.flashI = 0;
    for (const r of this.rings) r.m.visible = false;
  }
}
