// 소리는 파일 없이 Web Audio로 합성합니다.
export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.lastCrumble = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = last * 0.6 + w * 0.4; d[i] = last; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.value = v ? 0.85 : 0;
  }

  noiseSrc() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    return s;
  }

  boom(size = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const dur = 1.1 + size * 0.9;
    // 우르릉
    const n = this.noiseSrc();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600 + 600 * size, t);
    lp.frequency.exponentialRampToValueAtTime(70, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(1.4, 0.8 + size * 0.3), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + dur + 0.05);
    // 쿵(저음)
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.7);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(1.0, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 1);
    // 탁(고음 파열)
    const c = this.noiseSrc();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.6, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    c.connect(hp).connect(cg).connect(this.master);
    c.start(t); c.stop(t + 0.2);
  }

  crumble(amount = 0.5) {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    if (t - this.lastCrumble < 0.12) return;
    this.lastCrumble = t;
    const n = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 300 + Math.random() * 300; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + amount * 0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6 + amount * 0.6);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 1.3);
  }

  whoosh(dur = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const n = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(250, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + dur + 0.1);
  }

  // 학교 종(기본: 미-도-레-솔). 계이름은 config.json의 bell에서 바꿀 수 있어요.
  bell(notes = [659.25, 523.25, 587.33, 392.0]) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const start = ctx.currentTime + 0.05;
    notes.forEach((f, i) => {
      const t = start + i * 0.5;
      for (const [mul, vol] of [[1, 0.22], [2.01, 0.06], [3.02, 0.03]]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f * mul;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 1.45);
      }
    });
  }

  // 둔탁한 '쿵' (망치)
  thud() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.4);
    this.crumble(0.6);
  }

  // 땅울림 (지진, 산사태)
  rumble(dur = 3, level = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const n = this.noiseSrc();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.2 * level, t + 0.25);
    g.gain.setValueAtTime(1.2 * level, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp).connect(g).connect(this.master);
    n.start(t); n.stop(t + dur + 0.1);
  }

  // 로켓 엔진 소리
  roar(dur = 3) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const n = this.noiseSrc();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.25, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    n.connect(lp).connect(g).connect(this.master);
    n.start(t); n.stop(t + dur + 0.4);
  }

  pop() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const n = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.3);
  }

  // 발사 카운트다운 삐-삐-삐
  countdown() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.4;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1320 : 880;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.2);
    }
  }

  // 레이저: 누르는 동안 '위잉'
  laser(on) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (on && this.on && !this.laserNodes) {
      const t = ctx.currentTime;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o1.frequency.value = 110;
      o2.type = 'square'; o2.frequency.value = 221;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 9; lfoG.gain.value = 18;
      lfo.connect(lfoG).connect(o1.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(this.master);
      o1.start(t); o2.start(t); lfo.start(t);
      this.laserNodes = { o1, o2, lfo, g };
    } else if (!on && this.laserNodes) {
      const { o1, o2, lfo, g } = this.laserNodes;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      for (const o of [o1, o2, lfo]) o.stop(t + 0.15);
      this.laserNodes = null;
    }
  }

  // 폭탄이 떨어질 때 '휘이이—'
  whistle(dur = 1.1) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(380, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.2);
    g.gain.setValueAtTime(0.18, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // 핵폭발: 터지는 소리 + 길게 깔리는 '주우웅' 저음
  nuke() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    this.boom(3.5);
    this.rumble(7, 1.2);
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(48, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 6.6);
  }

  // 핵 발사 경보 '왜애앵'
  siren() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(880, t + 0.45);
    o.frequency.linearRampToValueAtTime(520, t + 0.9);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.setValueAtTime(0.16, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.92);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.95);
  }

  // 불꽃놀이: 올라갈 때 '피융', 터질 때 '펑'
  firework(burst) {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    if (!burst) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(500, t);
      o.frequency.exponentialRampToValueAtTime(1600, t + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.95);
      return;
    }
    const n = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass'; bp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.85);
    // 지지직
    const c = this.noiseSrc();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t + 0.15);
    cg.gain.exponentialRampToValueAtTime(0.08, t + 0.25);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    c.connect(hp).connect(cg).connect(this.master);
    c.start(t + 0.15, Math.random()); c.stop(t + 1.45);
  }

  // 배트 '딱!' (크게 맞으면 관중 환호)
  crack(big = false) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const n = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.1);
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(1150, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.4, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.13);
    this.crumble(0.7);
    if (big) {
      const c = this.noiseSrc();
      const cb = ctx.createBiquadFilter();
      cb.type = 'bandpass'; cb.frequency.value = 900; cb.Q.value = 0.6;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t + 0.15);
      cg.gain.exponentialRampToValueAtTime(0.22, t + 0.6);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      c.connect(cb).connect(cg).connect(this.master);
      c.start(t + 0.15); c.stop(t + 2.7);
    }
  }

  // 전투기가 지나가는 소리(도플러로 높아졌다 낮아짐)
  jet(dur = 6) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const n = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(320, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + dur + 0.05);
  }

  // 화염방사기: 누르는 동안 '화르르'
  flame(on) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (on && this.on && !this.flameNodes) {
      const t = ctx.currentTime;
      const n = this.noiseSrc();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 7; lg.gain.value = 180;
      lfo.connect(lg).connect(bp.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.12);
      n.connect(bp).connect(g).connect(this.master);
      n.start(t); lfo.start(t);
      this.flameNodes = { n, lfo, g };
    } else if (!on && this.flameNodes) {
      const { n, lfo, g } = this.flameNodes;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      n.stop(t + 0.25); lfo.stop(t + 0.25);
      this.flameNodes = null;
    }
  }

  // 고양이 소리: meow(냐-옹), kitten(미야~), long(냐아아옹), trill(브르릅), purr(골골)
  meow(kind = 'meow') {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    if (kind === 'purr') {
      // 골골: 낮은 소리를 초당 25번 떨리게
      const n = this.noiseSrc();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 260;
      const am = ctx.createGain();
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 25; lg.gain.value = 0.5;
      am.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      n.connect(lp).connect(am).connect(g).connect(this.master);
      n.start(t); lfo.start(t); n.stop(t + 1.9); lfo.stop(t + 1.9);
      return;
    }
    const P = {
      meow: { f: [560, 780, 520], dur: 0.62, form: [1100, 1900, 1200] },
      kitten: { f: [900, 1250, 1050], dur: 0.36, form: [1800, 2600, 2100] },
      long: { f: [520, 820, 480], dur: 1.0, form: [1000, 2000, 1100] },
      trill: { f: [620, 900, 760], dur: 0.32, form: [1500, 2300, 1800] },
    }[kind] || { f: [560, 780, 520], dur: 0.6, form: [1100, 1900, 1200] };
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(P.f[0], t);
    o.frequency.linearRampToValueAtTime(P.f[1], t + P.dur * 0.35);
    o.frequency.linearRampToValueAtTime(P.f[2], t + P.dur);
    // 살짝 떨리는 목소리(비브라토)
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = kind === 'trill' ? 28 : 6; vg.gain.value = kind === 'trill' ? 40 : 12;
    vib.connect(vg).connect(o.frequency);
    // "냐"→"옹" 입 모양: 포먼트 필터 두 개
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = f2.type = 'bandpass'; f1.Q.value = 4; f2.Q.value = 6;
    f1.frequency.setValueAtTime(P.form[0], t); f1.frequency.linearRampToValueAtTime(P.form[1], t + P.dur * 0.4); f1.frequency.linearRampToValueAtTime(P.form[2], t + P.dur);
    f2.frequency.setValueAtTime(P.form[0] * 2.2, t); f2.frequency.linearRampToValueAtTime(P.form[1] * 1.6, t + P.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.06);
    g.gain.setValueAtTime(0.4, t + P.dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + P.dur);
    const mix = ctx.createGain();
    mix.gain.value = 1;
    o.connect(f1).connect(mix);
    o.connect(f2).connect(mix);
    mix.connect(g).connect(this.master);
    o.start(t); vib.start(t); o.stop(t + P.dur + 0.05); vib.stop(t + P.dur + 0.05);
  }

  // 택배차 '빵빵'
  honk() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    [0, 0.28].forEach((d) => {
      const t = ctx.currentTime + d;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = o2.type = 'square'; o.frequency.value = 415; o2.frequency.value = 523;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); o2.connect(g); g.connect(this.master);
      o.start(t); o2.start(t); o.stop(t + 0.25); o2.stop(t + 0.25);
    });
  }

  // 매점 잭팟 '띠리링'
  jackpot() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    [784, 988, 1175, 1568].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.4);
    });
  }

  // 동물 소리: frog(개굴), boar(꿀꿀), deer(컹), bat(찍), squirrel(찌르르), mantis(바스락)
  animal(kind) {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const tone = (type, f0, f1, dur, vol, at = 0, q = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + at);
      o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(vol, t + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      let node = o;
      if (q) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = q; f.Q.value = 3; o.connect(f); node = f; }
      node.connect(g).connect(this.master);
      o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    if (kind === 'frog') { tone('square', 220, 160, 0.09, 0.25, 0, 700); tone('square', 240, 170, 0.12, 0.25, 0.13, 700); }
    else if (kind === 'boar') { tone('sawtooth', 140, 90, 0.18, 0.3, 0, 400); tone('sawtooth', 130, 85, 0.22, 0.3, 0.22, 400); }
    else if (kind === 'deer') { tone('sawtooth', 700, 380, 0.25, 0.25, 0, 1200); }
    else if (kind === 'bat') { for (let i = 0; i < 3; i++) tone('sine', 4200, 3000, 0.04, 0.12, i * 0.07); }
    else if (kind === 'squirrel') { for (let i = 0; i < 5; i++) tone('triangle', 2400, 3200, 0.05, 0.12, i * 0.06); }
    else { const n = this.noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 3000; g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); n.connect(f).connect(g).connect(this.master); n.start(t); n.stop(t + 0.3); }
  }

  // 퀸드라 톤: 아폴로 관제센터 무전 '삐-'(2525 Hz, 0.25초)
  quindar() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2525;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    g.gain.setValueAtTime(0.08, t + 0.24);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.27);
  }

  // 눈 밟는 소리(뽀드득)
  crunch() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const n = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.13);
  }

  // 태권도 기합 "얍!"
  kihap() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, t);
    o.frequency.linearRampToValueAtTime(330, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.28);
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = f2.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 5; f2.frequency.value = 1250; f2.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }

  // 하모니홀 팡파레(직접 작곡한 짧은 오케스트라풍 곡): 금관 선율 + 현악 화음 + 팀파니
  fanfare() {
    const ctx = this.ensure();
    if (!ctx || !this.on) return;
    const t0 = ctx.currentTime + 0.05;
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const voice = (midi, t, d, type, gain, cut) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = o2.type = type; o.frequency.value = N(midi); o2.frequency.value = N(midi) * 1.004;
      f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.06);
      g.gain.setValueAtTime(gain, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
      o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
    };
    // 화음 진행: C – Am – F – G – C (현악)
    const chords = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62], [48, 60, 64, 67, 72]];
    chords.forEach((ch, i) => ch.forEach((m) => voice(m, t0 + i * 0.8, i === 4 ? 1.6 : 0.85, 'sawtooth', 0.035, 1400)));
    // 금관 선율(하모니홀을 위한 새 선율)
    const mel = [[67, 0, 0.3], [72, 0.3, 0.5], [76, 0.8, 0.3], [74, 1.1, 0.5], [72, 1.6, 0.3], [69, 1.9, 0.5], [71, 2.4, 0.3], [74, 2.7, 0.5], [79, 3.2, 1.2]];
    mel.forEach(([m, at, d]) => voice(m, t0 + at, d, 'square', 0.05, 2200));
    // 팀파니
    for (const at of [0, 1.6, 3.2]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(N(36) * 1.6, t0 + at); o.frequency.exponentialRampToValueAtTime(N(36), t0 + at + 0.3);
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.5, t0 + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.9);
      o.connect(g).connect(this.master); o.start(t0 + at); o.stop(t0 + at + 1);
    }
  }
}
