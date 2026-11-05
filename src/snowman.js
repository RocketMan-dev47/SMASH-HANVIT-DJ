import * as THREE from 'three';

// 눈사람 만들기(겨울·눈 오는 날): 땅을 끌면 눈덩이가 굴러가며 커지고,
// 놓은 눈덩이를 다른 눈덩이 위에 놓으면 쌓여서 눈사람이 돼요(얼굴·당근 코·목도리 자동).
export class Snowmen {
  constructor(world) {
    this.w = world;
    this.list = [];
    this.snowMat = new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.95 });
    this.rolling = null;
  }

  begin(P) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), this.snowMat);
    m.castShadow = m.receiveShadow = true;
    this.w.scene.add(m);
    this.rolling = { m, r: 0.35, last: P.clone(), dist: 0, pos: P.clone() };
    this.place(this.rolling);
  }

  place(R) {
    R.m.scale.setScalar(R.r);
    R.m.position.set(R.pos.x, this.w.terrain.heightAt(R.pos.x, R.pos.z) + R.r * 0.92, R.pos.z);
  }

  move(P) {
    const R = this.rolling;
    if (!R) return;
    const d = Math.hypot(P.x - R.last.x, P.z - R.last.z);
    if (d < 0.05) return;
    R.dist += d;
    R.r = Math.min(2.4, 0.35 + R.dist * 0.05);
    // 굴러가는 방향으로 회전
    const axis = new THREE.Vector3(P.z - R.last.z, 0, -(P.x - R.last.x)).normalize();
    R.m.rotateOnWorldAxis(axis, d / R.r);
    R.pos.copy(P);
    R.last.copy(P);
    this.place(R);
    if (Math.random() < 0.25) this.w.sound.crunch?.();
  }

  // 손을 떼면: 가까운 눈사람 몸통 위면 쌓고, 아니면 새 몸통
  end() {
    const R = this.rolling;
    this.rolling = null;
    if (!R) return null;
    if (R.r < 0.5) { this.w.scene.remove(R.m); return null; }
    const base = this.list.find((s) => !s.top && Math.hypot(s.pos.x - R.pos.x, s.pos.z - R.pos.z) < s.r + 0.6);
    if (base) {
      const r = Math.min(R.r, base.r * 0.72);
      R.m.scale.setScalar(r);
      R.m.position.set(base.pos.x, base.m.position.y + base.r * 0.85 + r * 0.85, base.pos.z);
      R.m.rotation.set(0, 0, 0);
      base.top = { m: R.m, r };
      this.decorate(base);
      return 'done';
    }
    this.list.push({ m: R.m, r: R.r, pos: R.pos.clone(), top: null, deco: null });
    return 'base';
  }

  decorate(s) {
    const g = new THREE.Group();
    const { m, r } = s.top;
    g.position.copy(m.position);
    const yaw = Math.random() * Math.PI * 2;
    g.rotation.y = yaw;
    const coal = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    for (const sx of [-1, 1]) add(new THREE.SphereGeometry(r * 0.09, 8, 6), coal, sx * r * 0.32, r * 0.22, r * 0.88);
    add(new THREE.ConeGeometry(r * 0.1, r * 0.55, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf07a1c, roughness: 0.6 }), 0, 0, r * 1.15);
    for (let i = -2; i <= 2; i++) add(new THREE.SphereGeometry(r * 0.05, 6, 4), coal, i * r * 0.14, -r * 0.3 - Math.abs(i) * -r * 0.04, r * 0.9);
    // 목도리
    add(new THREE.TorusGeometry(r * 0.85, r * 0.12, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0xd8282f : 0x2f6fe0, roughness: 0.8 }), 0, -r * 0.8, 0);
    // 나뭇가지 팔(몸통 쪽)
    const twig = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const a = add(new THREE.CylinderGeometry(0.05, 0.07, s.r * 1.4, 5), twig, sx * s.r * 1.2, -r - s.r * 0.35, 0);
      a.rotation.z = sx * 1.1;
    }
    // 가끔 모자
    if (Math.random() < 0.5) {
      add(new THREE.CylinderGeometry(r * 0.55, r * 0.55, r * 0.08, 16), coal, 0, r * 0.9, 0);
      add(new THREE.CylinderGeometry(r * 0.38, r * 0.4, r * 0.6, 16), coal, 0, r * 1.2, 0);
    }
    this.w.scene.add(g);
    s.deco = g;
  }

  // 폭발에 휘말리면 '펑' 하고 눈가루가 돼요.
  blast(P, R) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      if (Math.hypot(s.pos.x - P.x, s.pos.z - P.z) > R + s.r) continue;
      for (let k = 0; k < 20; k++) {
        this.w.fx.smoke.spawn(s.pos.x, s.m.position.y, s.pos.z, (Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8, new THREE.Color('#ffffff'), 1, 1.4, { drag: 1.5, alpha: 0.9 });
      }
      this.remove(s);
      this.list.splice(i, 1);
    }
  }

  remove(s) {
    this.w.scene.remove(s.m);
    if (s.top) this.w.scene.remove(s.top.m);
    if (s.deco) this.w.scene.remove(s.deco);
  }

  clear() {
    for (const s of this.list) this.remove(s);
    this.list = [];
    if (this.rolling) { this.w.scene.remove(this.rolling.m); this.rolling = null; }
  }
}
