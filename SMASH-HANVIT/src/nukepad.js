import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const $ = (id) => document.getElementById(id);

// 핵 위치 지정 패드: 미니맵이나 화면을 눌러 목표를 찍고, 발사를 누르면 3초 뒤 떨어져요.
export class NukePad {
  constructor({ world, campus, R, onLaunch }) {
    this.w = world;
    this.campus = campus;
    this.R = R;
    this.onLaunch = onLaunch;
    this.target = null;
    this.count = -1;
    this.canvas = $('pad-map');
    this.ctx = this.canvas.getContext('2d');
    this.redraw = 0;
    this.buildMarker();

    this.canvas.addEventListener('pointerdown', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const [x, z] = this.toWorld(e.clientX - r.left, e.clientY - r.top);
      const T = this.w.terrain;
      if (!T.inside(x, z)) return;
      this.setTarget(new THREE.Vector3(x, T.heightAt(x, z), z));
    });
    $('pad-launch').addEventListener('click', () => this.launch());
    $('pad-cancel').addEventListener('click', () => this.clear());
  }

  buildMarker() {
    const red = (o) => new THREE.MeshBasicMaterial({ color: 0xff453a, transparent: true, opacity: o, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false });
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 128).rotateX(-Math.PI / 2), red(0.9));
    ring.scale.setScalar(this.R);
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), red(0.9));
    inner.scale.setScalar(this.R * 0.18);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), red(0.08));
    fill.scale.setScalar(this.R);
    for (const rot of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(this.R * 2.3, 0.35).rotateX(-Math.PI / 2).rotateY(rot), red(0.7));
      g.add(bar);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 160, 10, 1, true), new THREE.MeshBasicMaterial({
      color: 0xff453a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    beam.position.y = 80;
    g.add(fill, ring, inner, beam);
    g.traverse((o) => { o.renderOrder = 9; });
    const el = document.createElement('div');
    el.className = 'target-label';
    this.label = new CSS2DObject(el);
    this.label.position.y = 14;
    g.add(this.label);
    g.visible = false;
    this.marker = g;
    this.ring = ring;
    this.fill = fill;
    this.w.scene.add(g);
  }

  // 지도 좌표 변환(북쪽이 위)
  layout() {
    const T = this.w.terrain;
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const s = Math.min(W / T.w, H / T.d) * 0.96;
    return { s, ox: (W - T.w * s) / 2, oz: (H - T.d * s) / 2, W, H };
  }

  toMap(x, z) {
    const { s, ox, oz } = this.L;
    const T = this.w.terrain;
    return [ox + (x - T.x0) * s, oz + (z - T.z0) * s];
  }

  toWorld(px, py) {
    const L = this.layout();
    const T = this.w.terrain;
    return [T.x0 + (px - L.ox) / L.s, T.z0 + (py - L.oz) / L.s];
  }

  draw() {
    const c = this.canvas, g = this.ctx;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    this.L = this.layout();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const path = (pts, close) => {
      g.beginPath();
      pts.forEach(([x, z], i) => { const [a, b] = this.toMap(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
      if (close) g.closePath();
    };
    // 격자
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const r of this.campus.roads || []) {
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = Math.max(1, r.w * this.L.s * 0.7);
      path(r.pts, false);
      g.stroke();
    }
    if (this.campus.boundary) {
      g.setLineDash([4, 3]);
      g.strokeStyle = 'rgba(255,201,74,0.7)';
      g.lineWidth = 1.2;
      path(this.campus.boundary, true);
      g.stroke();
      g.setLineDash([]);
    }
    for (const b of this.w.buildings.list) {
      const alive = 1 - b.lostFraction();
      g.fillStyle = `rgba(255,255,255,${0.15 + 0.7 * alive})`;
      path(b.poly, true);
      g.fill();
    }
    // 카메라 위치
    const cam = this.w.camera.position;
    const [cx, cy] = this.toMap(cam.x, cam.z);
    if (cx > 0 && cy > 0 && cx < W && cy < H) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    }
    if (this.target) {
      const [tx, ty] = this.toMap(this.target.x, this.target.z);
      const rr = this.R * this.L.s;
      g.fillStyle = 'rgba(255,69,58,0.18)';
      g.strokeStyle = '#ff453a';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(tx, ty, rr, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(tx - rr - 6, ty); g.lineTo(tx + rr + 6, ty); g.moveTo(tx, ty - rr - 6); g.lineTo(tx, ty + rr + 6); g.stroke();
    }
  }

  open() {
    $('pad').hidden = false;
    this.clear(true);
    requestAnimationFrame(() => this.draw());
  }

  close() {
    $('pad').hidden = true;
    if (this.count < 0) this.clear(true);
  }

  clear(silent) {
    if (this.count >= 0) return;
    this.target = null;
    this.marker.visible = false;
    $('pad-launch').disabled = true;
    $('pad-info').textContent = '지도나 화면을 눌러 목표를 정하세요';
    if (!silent) this.draw();
  }

  setTarget(P) {
    if (this.count >= 0) return;
    this.target = P.clone();
    this.marker.position.set(P.x, this.w.terrain.heightAt(P.x, P.z) + 0.4, P.z);
    this.marker.visible = true;
    this.label.element.textContent = '목표 지정';
    $('pad-launch').disabled = false;
    let near = null, nd = Infinity;
    for (const b of this.w.buildings.list) {
      const d = Math.hypot(b.c2[0] - P.x, b.c2[1] - P.z);
      if (b.name && d < nd) { nd = d; near = b; }
    }
    $('pad-info').textContent = near && nd < this.R * 1.5 ? `${near.name} 근처 · 반경 ${this.R} m` : `반경 ${this.R} m`;
    this.w.sound.ensure();
    this.w.sound.pop();
    this.draw();
  }

  launch() {
    if (!this.target || this.count >= 0) return;
    this.count = 3;
    this.tick = 0;
    $('pad').hidden = true;
    this.label.element.textContent = '3';
    this.label.element.classList.add('count');
    this.w.sound.siren();
  }

  update(dt) {
    if (this.marker.visible) {
      const k = 0.55 + 0.35 * Math.sin(performance.now() / (this.count >= 0 ? 90 : 220));
      this.ring.material.opacity = k;
      this.fill.material.opacity = 0.05 + 0.08 * k;
    }
    if (this.count >= 0) {
      this.tick += dt;
      if (this.tick >= 1) {
        this.tick -= 1;
        this.count--;
        if (this.count > 0) {
          this.label.element.textContent = String(this.count);
          this.w.sound.siren();
        } else if (this.count === 0) {
          this.label.element.textContent = '발사';
          this.onLaunch(this.target.clone());
          setTimeout(() => {
            this.marker.visible = false;
            this.label.element.classList.remove('count');
            this.count = -1;
            this.target = null;
            $('pad-launch').disabled = true;
          }, 1300);
        }
      }
    }
    if (!$('pad').hidden) {
      this.redraw -= dt;
      if (this.redraw <= 0) { this.redraw = 0.4; this.draw(); }
    }
  }

  reset() {
    this.count = -1;
    this.label.element.classList.remove('count');
    this.clear(true);
  }
}
