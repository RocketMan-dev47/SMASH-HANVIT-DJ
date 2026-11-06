import * as THREE from 'three';

// 2.0 비주얼: 하늘 반사(유리창) · 비 온 뒤 물웅덩이·젖은 바닥 · 입체 구름 · 노을 빛줄기 · 붕괴 먼지 · 사진 모드 아웃포커스
// 화질 단계(gfx)에 따라: 높음 = 전부, 보통 = 빛줄기·아웃포커스 빼고, 낮음 = 반사만.
const soft = (inner, outer, size = 128) => {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, inner); gr.addColorStop(0.55, inner.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
function cloudTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const x = 60 + Math.random() * 136, y = 90 + Math.random() * 80, r = 30 + Math.random() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shaftTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,220,170,0.0)'); gr.addColorStop(0.2, 'rgba(255,220,170,0.55)'); gr.addColorStop(1, 'rgba(255,220,170,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Visuals {
  constructor({ renderer, scene, camera, controls, sky, sun, terrain, roads }) {
    Object.assign(this, { renderer, scene, camera, controls, sky, sun, T: terrain });
    this.level = 2; this.wet = 0; this.raining = false; this.t = 0;
    // ① 하늘 반사: 하늘 구를 따로 담은 장면을 PMREM으로 구워 scene.environment에
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(sky.geometry, sky.material));
    this.envT = 99;
    // ② 물웅덩이(길 위)
    const spots = [];
    for (const r of roads || []) for (let i = 0; i < r.pts.length - 1 && spots.length < 70; i++) {
      const [a, b] = [r.pts[i], r.pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 6; d < L; d += 14 + Math.random() * 18) { const k = d / L, side = (Math.random() - 0.5) * (r.w || 5) * 0.6; spots.push([a[0] + (b[0] - a[0]) * k + side * 0.3, a[1] + (b[1] - a[1]) * k + side * 0.3, 0.8 + Math.random() * 2.2, Math.random() * Math.PI]); }
    }
    this.puddleSpots = spots;
    this.puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x22282e, roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.9, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -4 }), Math.max(1, spots.length));
    this.puddles.renderOrder = 1; scene.add(this.puddles);
    // ③ 입체 구름(부드러운 덩어리 여러 장을 겹쳐서)
    this.clouds = new THREE.Group(); scene.add(this.clouds);
    const ct = cloudTex(), cx = terrain.x0 + terrain.w / 2, cz = terrain.z0 + terrain.d / 2;
    for (let i = 0; i < 12; i++) {
      const cl = new THREE.Group();
      for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.8, fog: true })); s.scale.set(90 + Math.random() * 70, 50 + Math.random() * 30, 1); s.position.set((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 60); cl.add(s); }
      cl.position.set(cx + (Math.random() - 0.5) * 1400, 190 + Math.random() * 90, cz + (Math.random() - 0.5) * 1400);
      this.clouds.add(cl);
    }
    // ④ 노을 빛줄기(더해지는 빛)
    this.shafts = new THREE.Group(); scene.add(this.shafts);
    const st = shaftTex();
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(26 + Math.random() * 30, 420), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, side: THREE.DoubleSide })); m.userData.off = (i - 3) * 38 + (Math.random() - 0.5) * 20; this.shafts.add(m); }
    // ⑤ 붕괴 먼지
    this.dustTex = soft('rgba(176,164,146,0.9)', 'rgba(176,164,146,0)');
    this.dusts = [];
    this.update(0);
  }

  setLevel(lv) { this.level = lv; this.clouds.visible = lv >= 1; this.shafts.visible = lv >= 2; }

  // 하늘 색이 바뀌면(시간대·날씨) 반사를 다시 구워요(가끔만)
  refreshEnv(force) {
    if (!force) return; // 하늘색이 바뀔 때만(update에서 판단)
    this.envT = 0;
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 1, 6000); // 하늘 구(반지름 3000 m)가 다 담기게
    this.scene.environment = this.envRT.texture;
    old?.dispose();
  }

  setWeather(kind) { this.raining = kind === 'rain' || kind === 'storm'; this.cloudy = kind === 'cloud' || this.raining || kind === 'fog'; }

  dust(P, size = 10) {
    if (this.level < 1) return;
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, transparent: true, depthWrite: false, opacity: 0.7 }));
      s.position.set(P.x + (Math.random() - 0.5) * size, P.y + Math.random() * size * 0.4, P.z + (Math.random() - 0.5) * size);
      s.userData = { t: 0, life: 5 + Math.random() * 3, v: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 3), s0: size * 0.4 };
      this.scene.add(s); this.dusts.push(s);
    }
  }

  update(dt, ctx = {}) {
    this.t += dt; this.envT += dt;
    // 하늘색이 눈에 띄게 바뀌었을 때만 반사를 다시 구워요(최소 3초 간격)
    if (ctx.skyColor && this.envT > 3) { const c = ctx.skyColor, k = this.lastSky; if (!k || Math.abs(k.r - c.r) + Math.abs(k.g - c.g) + Math.abs(k.b - c.b) > 0.06) { this.lastSky = c.clone ? c.clone() : { r: c.r, g: c.g, b: c.b }; this.refreshEnv(true); } }
    // 젖음: 비 오면 1분에 걸쳐 젖고, 그친 뒤 8분에 걸쳐 말라요
    this.wet = Math.max(0, Math.min(1, this.wet + (this.raining ? dt / 60 : -dt / 480)));
    const T = this.T, m = new THREE.Matrix4(), q = new THREE.Quaternion(), on = this.level >= 1 && this.wet > 0.02;
    this.puddles.visible = on;
    if (on) {
      this.puddleSpots.forEach(([x, z, r, a], i) => { const k = Math.min(1, this.wet * 1.4 - (i % 5) * 0.1); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m.compose(new THREE.Vector3(x, T.heightAt(x, z) + 0.04, z), q, new THREE.Vector3(Math.max(0.001, r * k), 1, Math.max(0.001, r * k * 0.7))); this.puddles.setMatrixAt(i, m); });
      this.puddles.instanceMatrix.needsUpdate = true;
    }
    if (T.material) { T.material.roughness = 0.97 - this.wet * 0.42; T.material.color.setScalar(1 - this.wet * 0.18); }
    // 구름: 바람 따라 흐르고, 날씨에 따라 짙어져요. 하늘색을 조금 머금어요.
    const sky = ctx.skyColor, dark = this.raining ? 0.55 : 1;
    for (const cl of this.clouds.children) {
      cl.position.x += dt * 4; if (cl.position.x > T.x0 + T.w / 2 + 760) cl.position.x -= 1520;
      for (const s of cl.children) { s.material.opacity = (this.cloudy ? 0.9 : 0.45) * (ctx.night ? 0.5 : 1); if (sky) s.material.color.copy(sky).lerp(new THREE.Color(1, 1, 1), 0.7).multiplyScalar(dark * (ctx.night ? 0.35 : 1)); }
    }
    // 빛줄기: 해가 낮을 때(새벽·노을)만, 비 오면 없음
    const sunDir = this.sun.position.clone().sub(this.sun.target.position).normalize();
    const low = Math.max(0, 1 - Math.abs(sunDir.y - 0.18) / 0.22) * (this.raining || ctx.night ? 0 : 1);
    if (this.shafts.visible) {
      const c = this.controls.target, base = c.clone().addScaledVector(new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize(), 260);
      for (const sh of this.shafts.children) {
        const side = new THREE.Vector3(-sunDir.z, 0, sunDir.x).normalize();
        sh.position.copy(base).addScaledVector(side, sh.userData.off); sh.position.y = c.y + 120;
        sh.lookAt(this.camera.position.x, sh.position.y, this.camera.position.z);
        sh.rotation.z = Math.atan2(sunDir.x, sunDir.y) * 0.4;
        sh.material.opacity = low * (0.1 + 0.05 * Math.sin(this.t * 0.4 + sh.userData.off));
      }
    }
    // 먼지: 퍼지면서 천천히 오르고 옅어져요(빛을 가려요)
    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const s = this.dusts[i], u = s.userData; u.t += dt;
      const k = u.t / u.life; s.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 0.25);
      const sz = u.s0 + k * u.s0 * 3.5; s.scale.set(sz, sz, 1); s.material.opacity = 0.7 * (1 - k) * (1 - k);
      if (k >= 1) { this.scene.remove(s); s.material.dispose(); this.dusts.splice(i, 1); }
    }
  }

  // 사진 모드 아웃포커스(보케): 필요할 때만 불러와요
  async photoDOF(on) {
    this.dof = on && this.level >= 2;
    if (!this.dof || this.composer) return;
    const [{ EffectComposer }, { RenderPass }, { BokehPass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/BokehPass.js'), import('three/addons/postprocessing/OutputPass.js'),
    ]);
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 120, aperture: 0.00018, maxblur: 0.008, width: size.x, height: size.y });
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());
  }

  // true를 돌려주면 이번 프레임은 여기서 그렸어요
  render() {
    if (!this.dof || !this.composer) return false;
    this.bokeh.uniforms.focus.value = this.camera.position.distanceTo(this.controls.target);
    this.composer.setSize(...this.renderer.getSize(new THREE.Vector2()).toArray());
    this.composer.render();
    return true;
  }
}

// 외벽 거칠기·금속감 지도: 유리(푸른 어두운 부분)는 매끈하게 → 하늘이 비쳐요
export function surfaceMaps(facade) {
  const src = facade.image, w = src.width, h = src.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], glass = b > r + 8 && b > 40 && r < 170;
    const v = glass ? 22 : 225; // 거칠기: 유리 0.09, 벽 0.88
    p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const rough = new THREE.CanvasTexture(c);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.copy(facade.repeat);
  // 금속감: 거칠기의 반대(유리만 살짝)
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const g2 = c2.getContext('2d'); g2.drawImage(c, 0, 0); g2.globalCompositeOperation = 'difference'; g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h);
  g2.globalCompositeOperation = 'multiply'; g2.fillStyle = '#707070'; g2.fillRect(0, 0, w, h);
  const metal = new THREE.CanvasTexture(c2);
  metal.wrapS = metal.wrapT = THREE.RepeatWrapping; metal.repeat.copy(facade.repeat);
  return { rough, metal };
}
