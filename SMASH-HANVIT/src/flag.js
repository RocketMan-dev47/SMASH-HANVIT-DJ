import * as THREE from 'three';

// 태극기(국기 제작법 비율대로): 가로:세로 3:2, 태극 지름 = 세로의 1/2,
// 괘의 길이 = 지름의 1/2, 막대 두께 = 지름의 1/12, 막대 사이 = 지름의 1/24, 태극과 괘 사이 = 지름의 1/4
export function taegukgiCanvas(W = 1200) {
  const H = (W * 2) / 3;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const RED = '#cd2e3a', BLUE = '#0047a0', BLACK = '#000000';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const D = H / 2, R = D / 2;
  const th = Math.atan2(H, W);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(th);
  // 태극: 위 빨강, 아래 파랑, 왼쪽은 빨강 머리, 오른쪽은 파랑 머리
  g.fillStyle = BLUE; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = RED; g.beginPath(); g.arc(0, 0, R, Math.PI, 0); g.fill();
  g.fillStyle = RED; g.beginPath(); g.arc(-R / 2, 0, R / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = BLUE; g.beginPath(); g.arc(R / 2, 0, R / 2, 0, Math.PI * 2); g.fill();
  g.restore();
  // 4괘: 건(☰) 왼쪽 위, 곤(☷) 오른쪽 아래, 감(☵) 오른쪽 위, 리(☲) 왼쪽 아래
  const bar = D / 12, gap = D / 24, len = D / 2;
  const inner = R + D / 4;
  const tri = (phi, pattern) => {
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(phi);
    g.fillStyle = BLACK;
    pattern.forEach((solid, i) => {
      const x = inner + i * (bar + gap);
      if (solid) g.fillRect(x, -len / 2, bar, len);
      else { g.fillRect(x, -len / 2, bar, len / 2 - gap / 2); g.fillRect(x, gap / 2, bar, len / 2 - gap / 2); }
    });
    g.restore();
  };
  tri(th - Math.PI, [1, 1, 1]);
  tri(th, [0, 0, 0]);
  tri(-th, [0, 1, 0]);
  tri(Math.PI - th, [1, 0, 1]);
  return c;
}

// 깃대와 펄럭이는 국기. 국기는 부서지지 않아요(모든 게 무너져도 끝까지 펄럭여요).
export class FlagPole {
  constructor(scene, terrain, at, { height = 35, size = [8, 5.3] } = {}) {
    this.terrain = terrain;
    const [x, z] = at;
    const y = terrain.heightAt(x, z);
    this.g = new THREE.Group();
    this.g.position.set(x, y, z);
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, roughness: 0.25, metalness: 0.85 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b84a, roughness: 0.25, metalness: 0.9 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 });
    const add = (geo, m, yy) => { const o = new THREE.Mesh(geo, m); o.position.y = yy; o.castShadow = true; o.receiveShadow = true; this.g.add(o); return o; };
    add(new THREE.CylinderGeometry(2.6, 3, 0.8, 8), stone, 0.4);
    add(new THREE.CylinderGeometry(0.16, 0.32, height, 16), steel, height / 2 + 0.8);
    add(new THREE.SphereGeometry(0.42, 16, 12), gold, height + 1.2);
    const [fw, fh] = size;
    this.fw = fw;
    this.fh = fh;
    const geo = new THREE.PlaneGeometry(fw, fh, 28, 18);
    geo.translate(fw / 2, 0, 0);
    this.base = geo.attributes.position.array.slice();
    const tex = new THREE.CanvasTexture(taegukgiCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
    this.flag.position.set(0.2, height + 0.8 - fh / 2 - 0.3, 0);
    this.flag.castShadow = true;
    this.g.add(this.flag);
    scene.add(this.g);
    this.t = Math.random() * 10;
    this.wind = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.t += dt;
    // 바람 방향이 천천히 바뀌어요.
    this.wind += Math.sin(this.t * 0.05) * dt * 0.08;
    this.g.rotation.y = this.wind;
    const p = this.flag.geometry.attributes.position;
    const b = this.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1];
      const k = x / this.fw; // 깃대 쪽은 고정, 끝으로 갈수록 크게 펄럭
      const wave = Math.sin(x * 0.9 - this.t * 4.2 + y * 0.25) * 0.55 + Math.sin(x * 1.7 - this.t * 6.1) * 0.18;
      p.setZ(i, wave * k * (0.7 + 0.3 * Math.sin(this.t * 0.7)));
      p.setY(i, y - k * k * 0.35);
    }
    p.needsUpdate = true;
    this.flag.geometry.computeVertexNormals();
  }
}
