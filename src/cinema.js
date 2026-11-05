import * as THREE from 'three';

// 사계절 시네마: 레터박스 + 필름 그레인 + 비네트 + 자막, 계절마다 다른 카메라 무빙과 시간대, 0.35배속 슬로모션, 잔잔한 화음.
// 봄(새벽빛 벚꽃) → 여름(한낮) → 가을(노을 단풍) → 겨울(밤눈). 누르거나 Esc로 끝내요.
const $ = (id) => document.getElementById(id);
const SCENES = [
  { season: 'spring', time: 'dawn', weather: null, title: '봄', en: 'SPRING · Vivaldi, La primavera I. Allegro', sub: '벚꽃이 내려앉는 첫 등굣길', music: 'spring', chord: [57, 61, 64, 69], move: { from: [-0.6, 0.22, 1.25], to: [-0.15, 0.16, 0.95], look: [0, 0] } },
  { season: 'summer', time: 'day', weather: null, title: '여름', en: 'SUMMER · Vivaldi, L’estate III. Presto', sub: '운동장 위로 쏟아지는 한낮의 햇살', music: 'summer', chord: [55, 59, 62, 67], move: { from: [0.9, 0.55, 0.6], to: [0.45, 0.3, 1.1], look: [0.1, 0.1] } },
  { season: 'autumn', time: 'sunset', weather: null, title: '가을', en: 'AUTUMN · Vivaldi, L’autunno I. Allegro', sub: '노을빛에 물드는 본관', music: 'autumn', chord: [52, 55, 59, 64], move: { from: [0.2, 0.12, -1.2], to: [-0.5, 0.2, -0.85], look: [-0.1, 0.05] } },
  { season: 'winter', time: 'night', weather: 'snow', title: '겨울', en: 'WINTER · Vivaldi, L’inverno II. Largo', sub: '불 꺼지지 않는 인재원, 소리 없이 쌓이는 눈', music: 'winter', chord: [50, 53, 57, 62], move: { from: [-1.1, 0.7, -0.2], to: [-0.7, 0.35, 0.4], look: [0, 0] } },
];
// 비발디 「사계」(1725년 출판, 저작권 만료) 대표 선율을 직접 연주해요. 음원(녹음)은 쓰지 않아요.
// [MIDI 음, 길이(박)] · 0은 쉼표. bass는 마디마다 바닥음.
const SCORES = {
  spring: { bpm: 104, mel: [[76, 0.5], [80, 0.5], [80, 0.5], [80, 0.5], [78, 0.25], [76, 0.25], [83, 1.5], [83, 0.25], [81, 0.25], [80, 0.5], [80, 0.5], [80, 0.5], [78, 0.25], [76, 0.25], [83, 1.5], [83, 0.25], [81, 0.25], [80, 0.5], [81, 0.5], [83, 0.5], [81, 0.5], [80, 0.5], [78, 0.5], [76, 1], [0, 0.5], [76, 0.5], [80, 0.5], [80, 0.5], [80, 0.5], [78, 0.25], [76, 0.25], [83, 1.5]], bass: [40, 40, 47, 40, 45, 47, 40, 40] },
  summer: { bpm: 168, mel: [[67, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [79, 0.25], [77, 0.25], [75, 0.25], [74, 0.25], [72, 0.25], [70, 0.25], [69, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [67, 0.25], [79, 0.25], [77, 0.25], [75, 0.25], [74, 0.25], [72, 0.25], [70, 0.25], [69, 0.25], [67, 0.25], [66, 0.25], [67, 0.25], [69, 0.25], [70, 0.25], [72, 0.25], [74, 0.25], [75, 0.25], [77, 0.25], [79, 1]], bass: [43, 43, 39, 38, 43, 43, 38, 43] },
  autumn: { bpm: 112, mel: [[65, 1], [65, 0.5], [69, 0.5], [72, 1], [72, 0.5], [69, 0.5], [70, 1], [70, 0.5], [74, 0.5], [72, 1], [69, 0.5], [65, 0.5], [67, 0.5], [69, 0.5], [70, 0.5], [72, 0.5], [74, 0.5], [72, 0.5], [70, 0.5], [69, 0.5], [67, 1], [65, 1], [0, 0.5], [72, 0.5], [77, 1], [76, 0.5], [74, 0.5], [72, 2]], bass: [41, 41, 46, 41, 48, 48, 41, 41] },
  winter: { bpm: 58, mel: [[70, 1], [75, 0.75], [74, 0.25], [75, 0.5], [77, 0.5], [79, 1], [77, 0.5], [75, 0.5], [74, 1], [72, 0.5], [70, 0.5], [68, 0.75], [67, 0.25], [68, 0.5], [70, 0.5], [67, 2]], bass: [39, 39, 46, 39, 44, 46, 39, 39], pizz: true },
};
const SEG = 9.5, INTRO = 2.2, OUTRO = 3.5;

export class Cinema {
  constructor({ camera, controls, center, radius, hooks, sound }) {
    this.camera = camera; this.controls = controls; this.center = center; this.R = radius;
    this.hooks = hooks; this.sound = sound;
    this.active = false;
    this.el = $('cine');
    this.el.addEventListener('click', () => this.stop());
    addEventListener('keydown', (e) => { if (this.active && e.key === 'Escape') this.stop(); });
    this.grain();
  }

  // 필름 그레인(작은 노이즈 타일을 계속 흔들어요)
  grain() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), d = g.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; }
    g.putImageData(d, 0, 0);
    $('cine-grain').style.backgroundImage = `url(${c.toDataURL()})`;
  }

  get timeScale() { return this.active ? 0.35 : 1; }

  start() {
    if (this.active) return;
    this.active = true;
    this.t = 0; this.i = -1;
    this.saved = { pos: this.camera.position.clone(), target: this.controls.target.clone(), fov: this.camera.fov };
    this.controls.enabled = false;
    this.el.hidden = false;
    document.body.classList.add('cine-on');
    requestAnimationFrame(() => this.el.classList.add('on'));
    this.title('SMASH 한빛', '한빛의 사계', 'A YEAR AT HANVIT');
    this.hooks.begin?.();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('on');
    document.body.classList.remove('cine-on');
    this.padStop();
    setTimeout(() => { this.el.hidden = true; }, 700);
    this.camera.position.copy(this.saved.pos);
    this.controls.target.copy(this.saved.target);
    this.camera.fov = this.saved.fov; this.camera.updateProjectionMatrix();
    this.controls.enabled = true;
    this.controls.update();
    this.hooks.end?.();
  }

  title(main, sub, en) {
    const t = $('cine-title');
    t.classList.remove('show');
    clearTimeout(this.tt);
    this.tt = setTimeout(() => {
      $('cine-main').textContent = main; $('cine-sub').textContent = sub; $('cine-en').textContent = en;
      t.classList.add('show');
    }, 450);
    clearTimeout(this.th);
    this.th = setTimeout(() => t.classList.remove('show'), 5200);
  }

  // 「사계」 선율: 바이올린 느낌(톱니파 2개 + 비브라토 + 부드러운 필터) + 저음(통주저음 또는 피치카토)
  music(name) {
    const ctx = this.sound?.ensure?.();
    if (!ctx || !this.sound.on || !SCORES[name]) return;
    this.padStop();
    const sc = SCORES[name], beat = 60 / sc.bpm;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 0.6);
    const verb = ctx.createDelay(); verb.delayTime.value = 0.19;
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    out.connect(this.sound.master); out.connect(verb); verb.connect(fb).connect(verb); verb.connect(this.sound.master);
    const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const nodes = [];
    const violin = (m, t, d) => {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o1.type = o2.type = 'sawtooth'; o1.frequency.value = N(m); o2.frequency.value = N(m) * 1.003;
      lfo.frequency.value = 5.6; lg.gain.value = N(m) * 0.006; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      f.type = 'lowpass'; f.frequency.value = 2600; f.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + Math.min(0.06, d * 0.3)); g.gain.setValueAtTime(0.42, t + d * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.98);
      o1.connect(f); o2.connect(f); f.connect(g).connect(out);
      for (const o of [o1, o2, lfo]) { o.start(t); o.stop(t + d); nodes.push(o); }
    };
    const low = (m, t, d, pizz) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = pizz ? 'triangle' : 'sawtooth'; o.frequency.value = N(m);
      f.type = 'lowpass'; f.frequency.value = pizz ? 900 : 700;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pizz ? 0.6 : 0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (pizz ? 0.35 : d * 0.95));
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + d); nodes.push(o);
    };
    let t = ctx.currentTime + 0.1;
    const end = t + SEG - 0.4;
    // 선율을 장면 길이만큼 반복
    while (t < end) {
      const t0 = t;
      for (const [m, b] of sc.mel) { const d = b * beat; if (t >= end) break; if (m) violin(m, t, d); t += d; }
      const bars = Math.ceil((t - t0) / (beat * 4));
      for (let k = 0; k < bars; k++) { const bm = sc.bass[k % sc.bass.length], bt = t0 + k * beat * 4; if (bt >= end) break; if (sc.pizz) for (let q = 0; q < 4; q++) low(bm + (q % 2 ? 12 : 0), bt + q * beat, beat, true); else { low(bm, bt, beat * 2); low(bm, bt + beat * 2, beat * 2); } }
    }
    this.voice = { out, oscs: nodes, ctx };
  }

  // 잔잔한 화음(사인파 4개, 천천히 커졌다 작아짐)
  pad(chord) {
    const ctx = this.sound?.ensure?.();
    if (!ctx || !this.sound.on) return;
    this.padStop();
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 2.5);
    out.connect(this.sound.master);
    const oscs = chord.map((m, k) => {
      const o = ctx.createOscillator();
      o.type = k ? 'sine' : 'triangle';
      o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
      o.detune.value = (k - 1.5) * 4;
      o.connect(out); o.start();
      return o;
    });
    this.voice = { out, oscs, ctx };
  }

  padStop() {
    const v = this.voice;
    if (!v) return;
    this.voice = null;
    const t = v.ctx.currentTime;
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setValueAtTime(Math.max(0.0001, v.out.gain.value), t);
    v.out.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    for (const o of v.oscs) { try { o.stop(t + 1.7); } catch { /* 이미 멈춤 */ } }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t - INTRO;
    const i = Math.floor(t / SEG);
    if (t >= 0 && i !== this.i && i < SCENES.length) {
      this.i = i;
      const S = SCENES[i];
      this.hooks.scene(S);
      this.title(S.title, S.sub, S.en);
      if (S.music) this.music(S.music); else this.pad(S.chord);
      this.el.classList.remove('flash'); void this.el.offsetWidth; this.el.classList.add('flash'); // 장면 전환 페이드
    }
    if (t >= SCENES.length * SEG) {
      if (!this.ended) { this.ended = true; this.title('한빛의 사계', '모든 계절의 한빛을 지나온 당신에게', 'FIN'); this.padStop(); }
      if (t >= SCENES.length * SEG + OUTRO) { this.ended = false; this.stop(); }
      return;
    }
    // 카메라: 장면마다 from → to로 아주 천천히(가속·감속), 시작 직후 살짝 줌인
    const S = SCENES[Math.max(0, Math.min(SCENES.length - 1, i))];
    const k = t < 0 ? 0 : Math.min(1, (t - Math.max(0, i) * SEG) / SEG);
    const e = k * k * (3 - 2 * k);
    const c = this.center, R = this.R;
    const f = S.move.from, to = S.move.to;
    const p = new THREE.Vector3(
      c.x + (f[0] + (to[0] - f[0]) * e) * R,
      c.y + (f[1] + (to[1] - f[1]) * e) * R,
      c.z + (f[2] + (to[2] - f[2]) * e) * R,
    );
    this.camera.position.lerp(p, Math.min(1, dt * (t < 0.5 ? 6 : 2.2)));
    const look = new THREE.Vector3(c.x + S.move.look[0] * R, c.y, c.z + S.move.look[1] * R);
    this.controls.target.lerp(look, Math.min(1, dt * 2));
    this.camera.lookAt(this.controls.target);
    this.camera.fov = 42 - e * 4;
    this.camera.updateProjectionMatrix();
  }
}
