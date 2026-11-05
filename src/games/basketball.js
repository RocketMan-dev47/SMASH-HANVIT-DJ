import { SYS, D } from '../arcade.js';

// 농구장 60초 슛아웃: 공을 뒤로 당겼다 놓으면 날아가요. 림·백보드에 튕기고, 먼 자리는 3점. 30초 뒤부터 골대가 움직여요.
export function basketball() {
  let S;
  const GR = 900; // 중력(px/s²)
  const reset = (W, H) => { S = { t: 60, pts: 0, made: 0, shots: 0, streak: 0, ball: null, spot: 0, aim: null, parts: [], msg: '', msgT: 0, hoopOff: 0 }; place(W, H); };
  const spots = (W, H) => [[W * 0.2, H * 0.78, 2], [W * 0.32, H * 0.8, 2], [W * 0.12, H * 0.74, 3], [W * 0.42, H * 0.82, 2], [W * 0.08, H * 0.8, 3]];
  const hoop = (W, H) => ({ x: W * 0.78 + S.hoopOff, y: H * 0.36, r: 22 });
  const place = (W, H) => { const sp = spots(W, H)[S.spot % 5]; S.home = { x: sp[0], y: sp[1], v: sp[2] }; S.ball = { x: sp[0], y: sp[1], vx: 0, vy: 0, live: false, scored: false, hitRim: false }; };
  return {
    id: 'basketball', title: '60초 슛아웃', place: '농구장',
    icon: '<svg viewBox="0 0 48 48"><circle cx="20" cy="28" r="12" fill="#ff9f0a"/><path d="M8 28h24M20 16v24M11 19q9 9 0 18M29 19q-9 9 0 18" stroke="#1c1c1e" stroke-width="1.5" fill="none"/><path d="M30 10h14M33 10l2 8h6l2-8" stroke="#fff" stroke-width="2" fill="none"/></svg>',
    desc: '60초 동안 최대한 많이 넣어요. 먼 자리는 3점.',
    how: ['공을 누른 채 뒤로 당겼다 놓으면 반대쪽으로 날아가요.', '연속으로 넣으면 보너스가 붙어요(3연속부터 +1).', '15초가 지나면 골대가 좌우로 움직여요. 28점이면 성공.'],
    fmt: (v) => `${v}점`,
    start(a) { reset(a.W, a.H); },
    down(x, y) { const b = S.ball; if (b && !b.live && Math.hypot(x - b.x, y - b.y) < 70) S.aim = { x, y }; },
    move(x, y) { if (S.aim) { S.aim.x = x; S.aim.y = y; } },
    up(x, y) {
      if (!S.aim) return;
      const b = S.ball, dx = b.x - S.aim.x, dy = b.y - S.aim.y, p = Math.min(1, Math.hypot(dx, dy) / 180);
      S.aim = null;
      if (p < 0.08) return;
      b.vx = dx * 6.2; b.vy = dy * 6.2; b.live = true; S.shots++;
      this.a?.hap?.play('select');
    },
    update(dt, a) {
      this.a = a;
      S.t -= dt; S.msgT -= dt;
      if (S.t < 45) S.hoopOff = Math.sin((45 - S.t) * 1.3) * a.W * 0.09;
      const b = S.ball, h = hoop(a.W, a.H);
      if (b?.live) {
        b.vy += GR * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        // 백보드
        const bbx = h.x + h.r + 8;
        if (b.x > bbx - 11 && b.x < bbx + 4 && b.y > h.y - 90 && b.y < h.y + 10 && b.vx > 0) { b.vx *= -0.55; b.x = bbx - 11; a.hap?.play('tap'); }
        // 림 양 끝(점)과 부딪힘
        for (const rx of [h.x - h.r, h.x + h.r]) {
          const dx = b.x - rx, dy = b.y - h.y, d = Math.hypot(dx, dy);
          if (d < 13) { const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; b.x = rx + nx * 13; b.y = h.y + ny * 13; b.hitRim = true; a.hap?.play('tap'); } }
        }
        // 골: 위에서 아래로 림 사이를 지나감
        if (!b.scored && b.vy > 0 && Math.abs(b.x - h.x) < h.r - 6 && b.y > h.y - 4 && b.y < h.y + 14) {
          b.scored = true; S.made++; S.streak++;
          const bonus = S.streak >= 3 ? 1 : 0, v = S.home.v + bonus;
          S.pts += v; S.msg = `${b.hitRim ? '' : '클린 '}+${v}${bonus ? ' 연속 보너스' : ''}`; S.msgT = 1;
          D.burst(S.parts, h.x, h.y + 20, 20, SYS.orange, 150);
          a.hap?.play('badge'); a.score(S.pts);
        }
        if (b.y > a.H + 40 || b.x < -60 || b.x > a.W + 60) {
          if (!b.scored) S.streak = 0;
          if (b.scored) S.spot++;
          place(a.W, a.H);
        }
      }
      if (S.t <= 0) a.finish({ score: S.pts, win: S.pts >= 28, title: S.pts >= 30 ? '슈팅 가드 등극' : '경기 종료', detail: `${S.shots}개 중 ${S.made}개 성공 · 성공률 ${S.shots ? Math.round((S.made / S.shots) * 100) : 0}%` });
    },
    draw(g, W, H, a, dt) {
      if (!S) reset(W, H);
      g.fillStyle = '#0f1115'; g.fillRect(0, 0, W, H);
      // 코트 바닥(우레탄 파랑) + 3점 라인
      g.fillStyle = '#1f4fa8'; g.fillRect(0, H * 0.72, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(W * 0.82, H * 0.86, W * 0.62, H * 0.12, 0, Math.PI * 0.55, Math.PI * 1.02); g.stroke();
      const h = hoop(W, H);
      // 백보드 + 림 + 그물
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(h.x + h.r + 4, h.y - 92, 7, 104);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
      for (let i = 0; i <= 6; i++) { const x = h.x - h.r + (i * 2 * h.r) / 6; g.beginPath(); g.moveTo(x, h.y); g.lineTo(h.x + (x - h.x) * 0.6, h.y + 34); g.stroke(); }
      g.strokeStyle = SYS.orange; g.lineWidth = 4; g.beginPath(); g.moveTo(h.x - h.r, h.y); g.lineTo(h.x + h.r, h.y); g.stroke();
      // 조준 점선(당기는 중)
      const b = S.ball;
      if (S.aim && b) {
        let x = b.x, y = b.y, vx = (b.x - S.aim.x) * 6.2, vy = (b.y - S.aim.y) * 6.2;
        g.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 16; i++) { for (let k = 0; k < 3; k++) { vy += GR * 0.016; x += vx * 0.016; y += vy * 0.016; } g.beginPath(); g.arc(x, y, 2.4 - i * 0.1, 0, Math.PI * 2); g.fill(); }
      }
      // 공
      if (b) {
        g.fillStyle = '#ff9f0a'; g.beginPath(); g.arc(b.x, b.y, 12, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(b.x - 12, b.y); g.lineTo(b.x + 12, b.y); g.moveTo(b.x, b.y - 12); g.lineTo(b.x, b.y + 12); g.stroke();
        if (!b.live) D.text(g, S.home.v === 3 ? '3점 자리' : '2점 자리', b.x, b.y + 34, { size: 11, color: SYS.text2, align: 'center' });
      }
      D.text(g, `${Math.max(0, Math.ceil(S.t))}`, W / 2, 96, { size: 34, weight: 300, mono: true, align: 'center', color: S.t < 10 ? SYS.red : SYS.text });
      if (S.streak >= 2) D.text(g, `${S.streak}연속`, W / 2, 118, { size: 12, weight: 700, color: SYS.orange, align: 'center' });
      if (S.msgT > 0) { g.globalAlpha = Math.min(1, S.msgT * 2); D.text(g, S.msg, h.x, h.y - 110, { size: 16, weight: 700, align: 'center', color: SYS.orange }); g.globalAlpha = 1; }
      D.stepParticles(S.parts, dt, g, 300);
    },
  };
}
