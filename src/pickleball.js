// 미래관 파인홀 피클볼: 손가락·마우스로 패들을 좌우로 움직여 받아쳐요. 7점 먼저(2점 차) 이기면 승리.
// 피클볼 규칙 맛보기: 서브는 대각선, 서브와 리턴은 한 번 튀긴 뒤 치기(투 바운스), 키친(네트 앞 구역)에서는 바로 치기 금지.
const $ = (id) => document.getElementById(id);

export class Pickleball {
  constructor({ hap, sound, onEnd }) {
    this.hap = hap;
    this.sound = sound;
    this.onEnd = onEnd;
    this.el = $('pb');
    this.cv = $('pb-canvas');
    this.g = this.cv.getContext('2d');
    $('pb-close').addEventListener('click', () => this.close());
    $('pb-start').addEventListener('click', () => this.serveStart());
    const move = (e) => { const r = this.cv.getBoundingClientRect(); this.target = Math.max(0.06, Math.min(0.94, (e.clientX - r.left) / r.width)); };
    this.cv.addEventListener('pointermove', move);
    this.cv.addEventListener('pointerdown', (e) => { move(e); this.cv.setPointerCapture(e.pointerId); });
    addEventListener('keydown', (e) => {
      if (this.el.hidden) return;
      if (e.key === 'ArrowLeft') this.target = Math.max(0.06, (this.target ?? 0.5) - 0.08);
      if (e.key === 'ArrowRight') this.target = Math.min(0.94, (this.target ?? 0.5) + 0.08);
      if (e.key === 'Escape') this.close();
    });
  }

  open() {
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.reset();
    this.loop(performance.now());
  }

  close() {
    this.el.classList.remove('show');
    cancelAnimationFrame(this.raf);
    setTimeout(() => { this.el.hidden = true; }, 250);
  }

  reset() {
    this.me = 0; this.ai = 0;
    this.server = 'me';
    this.state = 'ready';
    this.px = 0.5; this.ax = 0.5; this.target = 0.5;
    this.ball = null;
    this.msg('패들을 좌우로 움직여요 · 시작을 누르세요');
    $('pb-start').hidden = false;
    this.score();
  }

  msg(t) { $('pb-msg').textContent = t; }
  score() { $('pb-score').textContent = `나 ${this.me} : ${this.ai} 사범님`; }

  // 공 좌표: x(0~1 가로), y(0 내 쪽 끝 ~ 1 상대 끝), z(높이), 속도 vx, vy, vz
  serveStart() {
    $('pb-start').hidden = true;
    this.state = 'play';
    const meServe = this.server === 'me';
    this.ball = { x: meServe ? 0.7 : 0.3, y: meServe ? 0.05 : 0.95, z: 0.25, vx: meServe ? -0.22 : 0.22, vy: meServe ? 0.82 : -0.82, vz: 0.62, bounces: 0, side: meServe ? 'me' : 'ai', shots: 0 };
    this.msg(meServe ? '내 서브! 대각선으로 넘어가요' : '사범님 서브');
    this.sound?.pop?.();
  }

  hit(by) {
    const b = this.ball;
    const paddle = by === 'me' ? this.px : this.ax;
    b.vx = (b.x - paddle) * 1.6 + (Math.random() - 0.5) * 0.25;
    b.vy = (by === 'me' ? 1 : -1) * (0.86 + Math.min(0.4, b.shots * 0.025));
    b.vz = 0.55 + Math.random() * 0.2;
    b.bounces = 0;
    b.aiRoll = undefined;
    b.side = by;
    b.shots++;
    this.sound?.pop?.();
    if (by === 'me') this.hap?.play('select');
  }

  point(winner, why) {
    this.state = 'between';
    if (winner === 'me') this.me++; else this.ai++;
    this.score();
    this.msg(`${winner === 'me' ? '득점!' : '실점'} · ${why}`);
    this.hap?.play(winner === 'me' ? 'badge' : 'tap');
    this.server = winner;
    const done = (this.me >= 7 || this.ai >= 7) && Math.abs(this.me - this.ai) >= 2;
    if (done) {
      const win = this.me > this.ai;
      this.msg(win ? `🏆 승리! ${this.me} : ${this.ai}` : `아쉬워요 ${this.me} : ${this.ai} · 다시 도전!`);
      this.onEnd?.(win, this.me, this.ai);
      this.state = 'over';
      $('pb-start').hidden = false;
      $('pb-start').textContent = '다시 하기';
      this.me = this.ai = 0;
      return;
    }
    setTimeout(() => { if (this.state === 'between') { $('pb-start').hidden = false; $('pb-start').textContent = '다음 서브'; this.msg(`${this.server === 'me' ? '내' : '사범님'} 서브 차례예요`); } }, 700);
  }

  step(dt) {
    this.px += ((this.target ?? 0.5) - this.px) * Math.min(1, dt * 14);
    const b = this.ball;
    if (this.state !== 'play' || !b) return;
    // 사범님(AI): 공을 따라가되 살짝 느리게
    const aim = b.vy > 0 ? b.x + b.vx * ((0.95 - b.y) / Math.max(0.1, b.vy)) * 0.6 : 0.5;
    this.ax += (Math.max(0.08, Math.min(0.92, aim)) - this.ax) * Math.min(1, dt * (2.6 + this.ai * 0.15));
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= 1.9 * dt;
    if (b.x < 0.02 || b.x > 0.98) { b.vx *= -0.6; b.x = Math.max(0.02, Math.min(0.98, b.x)); }
    if (b.z <= 0) {
      b.z = 0; b.vz = Math.abs(b.vz) * 0.62; b.bounces++;
      this.sound?.pop?.();
      const hitter = b.side, other = hitter === 'me' ? 'ai' : 'me';
      if (b.bounces === 1) {
        // 첫 바운드는 상대 코트 안이어야 해요.
        const inOpp = hitter === 'me' ? b.y > 0.5 && b.y <= 1 : b.y < 0.5 && b.y >= 0;
        if (!inOpp) return this.point(other, b.y < 0 || b.y > 1 ? '공이 코트 밖으로 나갔어요' : '네트를 못 넘었어요');
      } else return this.point(hitter, '두 번 튀었어요');
    }
    // 네트(가운데)에 걸림
    if (Math.abs(b.y - 0.5) < 0.012 && b.z < 0.06) return this.point(b.side === 'me' ? 'ai' : 'me', '네트에 걸렸어요');
    const mustBounce = b.shots < 2 && b.bounces === 0; // 서브·리턴은 한 번 튀긴 뒤(투 바운스 규칙)
    // 내 패들(아래쪽 y≈0.06)
    if (b.side === 'ai' && b.vy < 0 && b.y <= 0.07) {
      const near = Math.abs(b.x - this.px) < 0.11 && b.z < 0.45;
      if (near && !mustBounce) this.hit('me');
      else if (b.y < -0.03) return this.point(b.bounces ? 'ai' : 'me', b.bounces ? (mustBounce ? '서브·리턴은 한 번 튀긴 뒤 쳐야 해요' : '놓쳤어요') : '사범님 공이 밖으로 나갔어요');
    }
    // 사범님 패들(위쪽 y≈0.94): 다가올 때 한 번만 성공·실수를 정해요.
    if (b.side === 'me' && b.vy > 0 && b.y >= 0.9) {
      if (b.aiRoll === undefined) b.aiRoll = Math.random() > 0.06 + this.me * 0.015 + b.shots * 0.012;
      const near = Math.abs(b.x - this.ax) < 0.12 && b.z < 0.5;
      if (near && !mustBounce && b.aiRoll && b.y >= 0.93) this.hit('ai');
      else if (b.y > 1.03) return this.point(b.bounces ? 'me' : 'ai', b.bounces ? '사범님이 놓쳤어요' : '공이 밖으로 나갔어요');
    }
  }

  // 원근 코트: y(0 아래~1 위)를 화면 사다리꼴로
  proj(x, y, z = 0) {
    const W = this.W, H = this.H;
    const top = H * 0.16, bot = H * 0.92;
    const sy = bot - (bot - top) * Math.pow(y, 0.92);
    const half = (W * 0.42) * (1 - y * 0.42);
    return [W / 2 + (x - 0.5) * 2 * half, sy - z * H * 0.35 * (1 - y * 0.35), half];
  }

  draw() {
    const c = this.cv, dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    this.W = W; this.H = H;
    const g = this.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // 체육관 바닥
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#c99a62'); grad.addColorStop(1, '#a8743f');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const quad = (y0, y1, col) => {
      const [a] = this.proj(0, y0), [b] = this.proj(1, y0), [cc] = this.proj(1, y1), [d] = this.proj(0, y1);
      g.fillStyle = col; g.beginPath();
      g.moveTo(a, this.proj(0, y0)[1]); g.lineTo(b, this.proj(1, y0)[1]); g.lineTo(cc, this.proj(1, y1)[1]); g.lineTo(d, this.proj(0, y1)[1]); g.fill();
    };
    quad(0, 1, '#2f6fb6');
    quad(0.36, 0.64, '#3d84d1'); // 키친
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    const line = (x0, y0, x1, y1) => { const p = this.proj(x0, y0), q = this.proj(x1, y1); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); };
    line(0, 0, 1, 0); line(0, 1, 1, 1); line(0, 0, 0, 1); line(1, 0, 1, 1); line(0, 0.36, 1, 0.36); line(0, 0.64, 1, 0.64); line(0.5, 0, 0.5, 0.36); line(0.5, 0.64, 0.5, 1);
    // 네트
    const n0 = this.proj(-0.03, 0.5), n1 = this.proj(1.03, 0.5), nh = H * 0.07;
    g.fillStyle = 'rgba(20,24,30,0.55)'; g.fillRect(n0[0], n0[1] - nh, n1[0] - n0[0], nh);
    g.fillStyle = '#fff'; g.fillRect(n0[0], n0[1] - nh, n1[0] - n0[0], 3);
    g.font = '700 11px Pretendard Variable, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.55)'; g.textAlign = 'center';
    g.fillText('KITCHEN', W / 2, this.proj(0.5, 0.42)[1]);
    // 패들
    const paddle = (x, y, col) => { const [px, py, half] = this.proj(x, y); const w = half * 0.2; g.fillStyle = col; g.beginPath(); g.roundRect(px - w / 2, py - 10, w, 14, 6); g.fill(); };
    paddle(this.ax, 0.95, '#ff6b6b');
    // 공 + 그림자
    const b = this.ball;
    if (b) {
      const s = this.proj(b.x, b.y, 0), p = this.proj(b.x, b.y, b.z);
      const r = 9 * (1 - b.y * 0.4);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(s[0], s[1], r, r * 0.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8ff5a'; g.beginPath(); g.arc(p[0], p[1] - r, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (const [dx, dy] of [[-3, -2], [3, 1], [0, 3]]) { g.beginPath(); g.arc(p[0] + dx * r / 9, p[1] - r + dy * r / 9, 1.4, 0, Math.PI * 2); g.fill(); }
    }
    paddle(this.px, 0.04, '#ffc94a');
  }

  loop(t) {
    const dt = Math.min(0.033, (t - (this.lt || t)) / 1000);
    this.lt = t;
    this.step(dt);
    this.draw();
    if (!this.el.hidden) this.raf = requestAnimationFrame((x) => this.loop(x));
  }
}
