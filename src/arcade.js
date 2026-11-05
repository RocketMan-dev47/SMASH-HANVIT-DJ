// 미니게임 틀: 화면 아래에서 올라오는 시트 하나에 모든 게임이 같은 규칙(시작 카드 → 게임 → 결과 카드)으로 들어가요.
// 디자인: 애플 시스템 색·글씨 위계, 장식 없이 정보만. 게임 밖 화면은 건드리지 않아요.
const $ = (id) => document.getElementById(id);

export const SYS = {
  bg: '#000000', panel: '#1c1c1e', panel2: '#2c2c2e', line: 'rgba(255,255,255,0.12)', text: '#ffffff', text2: 'rgba(235,235,245,0.62)', text3: 'rgba(235,235,245,0.32)',
  blue: '#0a84ff', green: '#30d158', orange: '#ff9f0a', red: '#ff453a', yellow: '#ffd60a', teal: '#64d2ff', indigo: '#5e5ce6', pink: '#ff375f', gray: '#8e8e93',
  font: '"SF Pro Display", "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif',
  mono: '"SF Mono", ui-monospace, Menlo, monospace',
};

// 그리기 도우미
export const D = {
  rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); },
  text(g, s, x, y, { size = 15, weight = 600, color = SYS.text, align = 'left', base = 'alphabetic', mono = false } = {}) {
    g.font = `${weight} ${size}px ${mono ? SYS.mono : SYS.font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = base; g.fillText(s, x, y);
  },
  ease: (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3),
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  // 아주 작은 파티클(불꽃·먼지)
  burst(list, x, y, n, color, speed = 160, life = 0.7) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random()); list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color }); } },
  stepParticles(list, dt, g, grav = 0) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vy += grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (g) { g.globalAlpha = p.life / p.max; g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    }
  },
};

export class Arcade {
  constructor({ hap, sound, onResult }) {
    this.hap = hap; this.sound = sound; this.onResult = onResult;
    this.el = $('arc');
    this.cv = $('arc-canvas');
    this.g = this.cv.getContext('2d');
    this.keys = new Set();
    this.ptr = { x: 0, y: 0, down: false, id: null, sx: 0, sy: 0, t0: 0 };
    $('arc-close').addEventListener('click', () => this.close());
    $('arc-start').addEventListener('click', () => this.begin());
    $('arc-again').addEventListener('click', () => this.begin());
    $('arc-done').addEventListener('click', () => this.close());
    const pos = (e) => { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    this.cv.addEventListener('pointerdown', (e) => {
      if (this.state !== 'play') return;
      const [x, y] = pos(e);
      Object.assign(this.ptr, { x, y, down: true, id: e.pointerId, sx: x, sy: y, t0: performance.now() });
      this.cv.setPointerCapture(e.pointerId);
      this.game.down?.(x, y, e);
    });
    this.cv.addEventListener('pointermove', (e) => { if (this.state !== 'play') return; const [x, y] = pos(e); this.ptr.x = x; this.ptr.y = y; this.game.move?.(x, y, e); });
    const up = (e) => { if (this.state !== 'play' || !this.ptr.down) return; const [x, y] = pos(e); this.ptr.down = false; this.game.up?.(x, y, { dx: x - this.ptr.sx, dy: y - this.ptr.sy, dt: (performance.now() - this.ptr.t0) / 1000 }); };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', up);
    addEventListener('keydown', (e) => {
      if (this.el.hidden) return;
      if (e.key === 'Escape') { this.close(); return; }
      this.keys.add(e.key);
      if (this.state === 'play') { this.game.key?.(e.key, true); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.begin(); }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.key); if (this.state === 'play') this.game.key?.(e.key, false); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(true); });
    $('arc-resume').addEventListener('click', () => this.pause(false));
    // 화면 위 터치 버튼(게임이 정의)
    this.pads = $('arc-pads');
  }

  best(id) { try { return Number(localStorage.getItem(`smash-best-${id}`) || 0); } catch { return 0; } }
  setBest(id, v) { try { localStorage.setItem(`smash-best-${id}`, String(v)); } catch { /* 무시 */ } }

  open(game) {
    this.game = game;
    this.state = 'intro';
    this.el.classList.toggle('light', !!game.light);
    $('arc-title').textContent = game.title;
    $('arc-sub').textContent = game.place || '';
    $('arc-score').textContent = '';
    $('arc-icon').innerHTML = game.icon || '';
    $('arc-name').textContent = game.title;
    $('arc-desc').textContent = game.desc;
    $('arc-how').innerHTML = (game.how || []).map((h) => `<li>${h}</li>`).join('');
    const b = this.best(game.id);
    $('arc-best').textContent = b ? `최고 기록 ${game.fmt ? game.fmt(b) : b.toLocaleString('ko-KR')}` : '첫 도전이에요';
    const ex = $('arc-extra');
    ex.innerHTML = game.extra ? game.extra() : '';
    if (game.bindExtra) game.bindExtra(ex, this);
    $('arc-intro').hidden = false; $('arc-result').hidden = true; $('arc-pause').hidden = true;
    this.pads.innerHTML = '';
    this.el.hidden = false;
    document.body.classList.add('arc-on');
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.hap?.play('toggle');
    this.resize();
    game.preview?.(this);
    this.loop(performance.now());
  }

  close() {
    this.state = 'off';
    this.game?.stop?.();
    this.el.classList.remove('show');
    document.body.classList.remove('arc-on');
    cancelAnimationFrame(this.raf);
    setTimeout(() => { this.el.hidden = true; }, 380);
  }

  begin() {
    $('arc-intro').hidden = true; $('arc-result').hidden = true;
    this.state = 'play';
    this.pads.innerHTML = '';
    this.score(0);
    this.game.start(this);
    this.hap?.play('select');
  }

  pause(on) {
    if (on && this.state === 'play') { this.state = 'pause'; $('arc-pause').hidden = false; }
    else if (!on && this.state === 'pause') { this.state = 'play'; $('arc-pause').hidden = true; this.lt = performance.now(); }
  }

  score(v, label) { this.cur = v; $('arc-score').textContent = label ?? (this.game.fmt ? this.game.fmt(v) : v.toLocaleString('ko-KR')); }

  // 게임 끝: { score, win, title, detail, medal }
  finish(r) {
    if (this.state !== 'play') return;
    this.state = 'result';
    const id = this.game.id, lower = this.game.lowerIsBetter;
    const prev = this.best(id);
    const better = r.score > 0 && (!prev || (lower ? r.score < prev : r.score > prev));
    if (better) this.setBest(id, r.score);
    $('arc-r-title').textContent = r.title || (r.win ? '성공' : '끝');
    $('arc-r-score').textContent = this.game.fmt ? this.game.fmt(r.score) : r.score.toLocaleString('ko-KR');
    $('arc-r-detail').textContent = r.detail || '';
    $('arc-r-best').textContent = better ? '새 최고 기록' : prev ? `최고 기록 ${this.game.fmt ? this.game.fmt(prev) : prev.toLocaleString('ko-KR')}` : '';
    $('arc-r-best').classList.toggle('new', better);
    $('arc-result').hidden = false;
    $('arc-r-extra').innerHTML = this.game.extra ? this.game.extra() : '';
    if (this.game.bindExtra) this.game.bindExtra($('arc-r-extra'), this);
    this.pads.innerHTML = '';
    this.hap?.play(r.win ? 'badge' : 'tap');
    this.onResult?.(id, r, better);
  }

  // 터치 버튼(게임별): [{ id, label, x: 'left'|'right'|'center', hold }]
  setPads(list, onChange) {
    this.pads.innerHTML = list.map((p) => `<button type="button" class="arc-pad ${p.cls || ''}" data-id="${p.id}" aria-label="${p.aria || p.label}">${p.label}</button>`).join('');
    for (const b of this.pads.querySelectorAll('button')) {
      const on = (v) => (e) => { e.preventDefault(); b.classList.toggle('on', v); onChange(b.dataset.id, v); if (v) this.hap?.play('tap'); };
      b.addEventListener('pointerdown', on(true));
      b.addEventListener('pointerup', on(false));
      b.addEventListener('pointerleave', on(false));
      b.addEventListener('pointercancel', on(false));
    }
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = this.cv.clientWidth, H = this.cv.clientHeight;
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    this.W = W; this.H = H; this.dpr = dpr;
  }

  loop(t) {
    const dt = Math.min(0.033, (t - (this.lt || t)) / 1000);
    this.lt = t;
    this.resize();
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.state === 'play') this.game.update(dt, this);
    this.game.draw(g, this.W, this.H, this, this.state === 'play' ? dt : 0);
    if (!this.el.hidden) this.raf = requestAnimationFrame((x) => this.loop(x));
  }
}

// 꾹 누른 자리 근처에 잠깐 뜨는 작은 알약(원래 화면을 가리지 않게 3.5초 뒤 사라져요)
export function contextPill(x, y, { icon, text, action, onGo }) {
  const el = $('ctx-pill');
  el.innerHTML = `<span class="cp-i">${icon}</span><span class="cp-t">${text}</span><button type="button">${action}</button>`;
  const W = innerWidth, H = innerHeight;
  el.style.left = `${Math.max(12, Math.min(W - 260, x - 120))}px`;
  el.style.top = `${Math.max(70, Math.min(H - 140, y - 70))}px`;
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 250); }, 3500);
  el.querySelector('button').onclick = (e) => { e.stopPropagation(); el.hidden = true; onGo(); };
}
