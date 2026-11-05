import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { pointInPolygon } from './geom.js';

// 게임 모드 "타임캡슐 찾기": 학교 어딘가에 묻힌 타임캡슐을 탐사 폭탄 6발로 찾아요.
// 터뜨린 자리마다 타임캡슐까지 거리가 숫자로 남아요(지뢰찾기처럼). 7 m 안에 터뜨리면 성공!
export class TreasureHunt {
  constructor(world, boundary) {
    this.w = world;
    this.boundary = boundary;
    this.active = false;
    this.marks = [];
    try { this.best = Number(localStorage.getItem('smash-hunt-best')) || 0; } catch { this.best = 0; }
  }

  start() {
    const T = this.w.terrain;
    const xs = this.boundary.map((p) => p[0]), zs = this.boundary.map((p) => p[1]);
    for (let k = 0; k < 200; k++) {
      const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
      const z = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
      if (pointInPolygon([x, z], this.boundary)) { this.target = new THREE.Vector3(x, T.heightAt(x, z), z); break; }
    }
    this.clear();
    this.active = true;
    this.shots = 6;
    this.min = Infinity;
    this.last = null;
    this.used = 0;
    this.hud();
    this.w.ui.toast('타임캡슐 찾기', '탐사 폭탄 6발! 숫자는 타임캡슐까지의 거리예요');
  }

  stop() { this.active = false; this.clear(); this.w.ui.hunt(null); if (this.chest) { this.w.scene.remove(this.chest); this.chest = null; } }

  clear() { for (const m of this.marks) this.w.scene.remove(m); this.marks = []; }

  hud(msg = '') {
    this.w.ui.hunt({ shots: this.shots, min: this.min, msg, best: this.best });
  }

  // 탐사 폭탄 한 발
  fire(P) {
    if (!this.active || this.shots <= 0) return;
    this.shots--;
    this.used++;
    const d = Math.hypot(P.x - this.target.x, P.z - this.target.z);
    this.w.explode(P, { tool: 'hunt', R: 6, power: 22, craterR: 0.5, craterD: 0.2, weight: 0.4 });
    // 거리 숫자 표시(빨강=뜨거움, 파랑=차가움)
    const heat = Math.max(0, Math.min(1, 1 - d / 120));
    const col = new THREE.Color().setHSL(0.62 - heat * 0.62, 0.85, 0.55);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.position.set(P.x, this.w.terrain.heightAt(P.x, P.z) + 0.3, P.z);
    g.add(ring);
    const el = document.createElement('div');
    el.className = 'hunt-num';
    el.style.background = `#${col.getHexString()}`;
    el.textContent = `${Math.round(d)}m`;
    const label = new CSS2DObject(el);
    label.position.set(P.x, ring.position.y + 4, P.z);
    g.add(label);
    this.w.scene.add(g);
    this.marks.push(g);
    let msg = d < 15 ? '🔥 거의 다 왔어요!' : d < 35 ? '뜨거워요!' : d < 70 ? '미지근해요' : '차가워요…';
    if (this.last !== null) msg += d < this.last ? ' (더 가까워졌어요)' : ' (더 멀어졌어요)';
    this.last = d;
    this.min = Math.min(this.min, d);
    if (d <= 7) return this.win();
    if (this.shots <= 0) return this.lose();
    this.hud(msg);
  }

  reveal(gold) {
    const box = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: gold ? 0xf2c14e : 0x8a8f96, metalness: 0.8, roughness: 0.3 }));
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), body.material);
    lid.position.y = 0.8;
    box.add(body, lid);
    box.position.copy(this.target).add(new THREE.Vector3(0, -1.5, 0));
    box.userData.rise = 0;
    this.w.scene.add(box);
    this.chest = box;
  }

  win() {
    this.active = false;
    this.reveal(true);
    const shots = this.used;
    if (!this.best || shots < this.best) { this.best = shots; try { localStorage.setItem('smash-hunt-best', String(shots)); } catch { /* 무시 */ } }
    // 금빛 불꽃 두 번
    this.w.fx.burst?.(this.target.clone().add(new THREE.Vector3(0, 8, 0)), new THREE.Color('#ffc94a'), 140);
    this.w.fx.burst?.(this.target.clone().add(new THREE.Vector3(0, 12, 0)), new THREE.Color('#ff6fae'), 90);
    this.w.sound.jackpot?.();
    this.w.ui.hunt({ done: true, win: true, shots, best: this.best });
    this.w.onHuntWin?.(shots);
  }

  lose() {
    this.active = false;
    this.reveal(false);
    this.w.ui.hunt({ done: true, win: false, min: this.min, best: this.best });
  }

  update(dt) {
    if (this.chest && this.chest.userData.rise < 1) {
      this.chest.userData.rise += dt / 1.5;
      this.chest.position.y = this.target.y - 1.5 + Math.min(1, this.chest.userData.rise) * 3;
      this.chest.rotation.y += dt * 1.5;
    }
  }
}
