import * as THREE from 'three';

const PALETTE = ['#ffc94a', '#ff5a5f', '#5ac8fa', '#a0e75a', '#ff6fae', '#ffffff', '#bf8cff'].map((c) => new THREE.Color(c));

// 운동장 불꽃놀이: 꼬리를 끌며 올라가서 터지고, 가끔 한꺼번에 여러 발(피날레)이 터져요.
export class Fireworks {
  constructor(world, center) {
    this.w = world;
    this.center = center;
    this.shells = [];
    this.on = false;
    this.timer = 0;
    this.finale = 25;
  }

  start() { this.on = true; this.timer = 0.3; }
  stop() { this.on = false; }

  launch() {
    const T = this.w.terrain;
    const x = this.center[0] + (Math.random() - 0.5) * 36;
    const z = this.center[1] + (Math.random() - 0.5) * 36;
    const g = T.heightAt(x, z);
    this.shells.push({
      p: new THREE.Vector3(x, g + 1, z),
      v: new THREE.Vector3((Math.random() - 0.5) * 6, 40 + Math.random() * 12, (Math.random() - 0.5) * 6),
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      double: Math.random() < 0.3,
    });
    this.w.sound.firework(false);
  }

  update(dt) {
    if (this.on) {
      this.timer -= dt;
      this.finale -= dt;
      if (this.timer <= 0) { this.launch(); this.timer = 0.6 + Math.random() * 0.9; }
      if (this.finale <= 0) {
        this.finale = 25 + Math.random() * 10;
        for (let i = 0; i < 6; i++) setTimeout(() => this.launch(), i * 140);
      }
    }
    const fx = this.w.fx;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.v.y -= 22 * dt;
      s.p.addScaledVector(s.v, dt);
      fx.fire.spawn(s.p.x, s.p.y, s.p.z, (Math.random() - 0.5) * 2, -3, (Math.random() - 0.5) * 2, s.color, 0.6, 0.5, { drag: 2, grav: 3 });
      if (s.v.y < 4) {
        fx.burst(s.p, s.color, 120);
        if (s.double) fx.burst(s.p, PALETTE[Math.floor(Math.random() * PALETTE.length)], 60);
        this.w.sound.firework(true);
        this.shells.splice(i, 1);
      }
    }
  }
}
