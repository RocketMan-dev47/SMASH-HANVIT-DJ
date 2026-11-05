import { SYS, D } from '../arcade.js';

// HASA 착륙 챌린지: 1단 부스터를 추력·기울기로 조종해 발사탑 젓가락 팔 사이에 천천히 내려놓아요.
export function landing() {
  let S;
  const G = 9.8, MAXT = 2.0 * G; // 최대 추력 = 중력의 2배
  const reset = () => { S = { x: -60 + Math.random() * 120, y: 900, vx: (Math.random() - 0.5) * 18, vy: -95, ang: 0, va: 0, thr: 0, fuel: 100, t: 0, over: false, in: {}, parts: [], flame: 0 }; };
  return {
    id: 'landing', title: '착륙 챌린지', place: 'HASA 발사장 · 1단 회수',
    icon: '<svg viewBox="0 0 48 48"><rect x="20" y="6" width="8" height="26" rx="3" fill="#f2f4f7"/><path d="M24 34l-4 8h8z" fill="#ff9f0a"/><path d="M6 42h36M10 30h10M28 30h10" stroke="#8e8e93" stroke-width="3" stroke-linecap="round"/></svg>',
    desc: '떨어지는 부스터를 젓가락 팔 사이에 사뿐히 붙잡히게 해요.',
    how: ['오른쪽 버튼(또는 ↑, 스페이스)을 누르는 동안 엔진이 켜져요.', '왼쪽 ◀ ▶(또는 ← →)로 몸체를 기울이면 옆으로 움직여요.', '팔 높이에서 수직 2.2 m/s · 수평 1.0 m/s 아래, 중심 2.2 m 안, 기울기 3° 안이어야 성공. 옆바람(돌풍)이 불어요.'],
    fmt: (v) => `${v.toLocaleString('ko-KR')}점`,
    start(a) {
      reset();
      a.setPads([{ id: 'l', label: '◀', cls: 'l r2a' }, { id: 'r', label: '▶', cls: 'l r2b' }, { id: 'thr', label: '엔진', cls: 'r big' }], (id, v) => { S.in[id] = v; });
    },
    key(k, down) { if (k === 'ArrowLeft') S.in.l = down; if (k === 'ArrowRight') S.in.r = down; if (k === 'ArrowUp' || k === ' ') S.in.thr = down; },
    update(dt, a) {
      if (S.over) return;
      S.t += dt;
      S.va += ((S.in.r ? 1 : 0) - (S.in.l ? 1 : 0)) * 1.6 * dt;
      S.va *= 1 - Math.min(1, dt * 1.8);
      S.ang = D.clamp(S.ang + S.va * dt, -0.6, 0.6);
      const on = S.in.thr && S.fuel > 0;
      S.thr = D.lerp(S.thr, on ? 1 : 0, Math.min(1, dt * 10));
      if (on) S.fuel = Math.max(0, S.fuel - dt * 6.6);
      // 돌풍: 2초마다 바뀌는 옆바람
      S.gt = (S.gt || 0) - dt; if (S.gt <= 0) { S.gt = 1.5 + Math.random() * 1.5; S.gust = (Math.random() - 0.5) * 1.8; }
      S.vx += (S.gust || 0) * dt;
      const T = S.thr * MAXT;
      S.vx += Math.sin(S.ang) * T * dt;
      S.vy += (Math.cos(S.ang) * T - G) * dt;
      S.vx *= 1 - dt * 0.02;
      S.x += S.vx * dt; S.y += S.vy * dt;
      if (S.thr > 0.1) for (let i = 0; i < 2; i++) S.parts.push({ x: S.x, y: S.y, vx: -Math.sin(S.ang) * 40 + (Math.random() - 0.5) * 10, vy: -Math.cos(S.ang) * 60 - 20 * Math.random(), life: 0.5, max: 0.5, color: SYS.orange });
      a.score(Math.round(S.y), `${Math.max(0, Math.round(S.y))} m`);
      // 팔 높이(y=0)에 닿았을 때 판정
      if (S.y <= 0) {
        S.over = true;
        const good = Math.abs(S.vy) <= 2.2 && Math.abs(S.vx) <= 1.0 && Math.abs(S.x) <= 2.2 && Math.abs(S.ang) <= 0.05;
        const sc = good ? Math.round(1000 - Math.abs(S.vy) * 60 - Math.abs(S.x) * 40 - (100 - S.fuel) * 2) : 0;
        a.hap?.play(good ? 'badge' : 'collapse');
        a.finish({ score: Math.max(good ? 100 : 0, sc), win: good, title: good ? '포획 성공' : Math.abs(S.x) > 3 ? '팔을 벗어났어요' : '너무 세게 닿았어요', detail: `수직 ${Math.abs(S.vy).toFixed(1)} m/s · 수평 ${Math.abs(S.vx).toFixed(1)} m/s · 연료 ${Math.round(S.fuel)}%` });
      }
    },
    draw(g, W, H, a, dt) {
      if (!S) reset();
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0b1a33'); sky.addColorStop(0.7, '#2b4a7a'); sky.addColorStop(1, '#e9a46b');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // 화면 배율: 높을 땐 멀리, 가까울수록 크게
      const groundY = H - 90, scale = D.clamp((groundY - 80) / Math.max(60, S.y + 40), 0.25, 6);
      const sx = (x) => W / 2 + x * scale, sy = (y) => groundY - y * scale;
      // 발사탑 + 젓가락 팔
      g.fillStyle = '#2a2f37'; g.fillRect(sx(-9) - 6, sy(0) - 4, 12, H - sy(0) + 4);
      g.fillStyle = '#4a515c'; g.fillRect(sx(-14), sy(0) - 3, sx(-3) - sx(-14), 6); g.fillRect(sx(3), sy(0) - 3, sx(14) - sx(3), 6);
      g.strokeStyle = 'rgba(48,209,88,0.6)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(sx(-3), sy(0)); g.lineTo(sx(-3), sy(0) - 30); g.moveTo(sx(3), sy(0)); g.lineTo(sx(3), sy(0) - 30); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#1a1d22'; g.fillRect(0, groundY + 40, W, H);
      // 불꽃
      D.stepParticles(S.parts.map((p) => p), 0, null);
      for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.life -= dt; if (p.life <= 0) { S.parts.splice(i, 1); continue; } p.x += p.vx * dt * 0.05; p.y += p.vy * dt * 0.05; g.globalAlpha = p.life / p.max; g.fillStyle = p.color; g.beginPath(); g.arc(sx(p.x), sy(p.y), 3 + (1 - p.life / p.max) * 6, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      // 부스터
      const bw = Math.max(5, 3.6 * scale), bh = Math.max(26, 30 * scale);
      g.save(); g.translate(sx(S.x), sy(S.y)); g.rotate(S.ang);
      g.fillStyle = '#eef0f3'; D.rr(g, -bw / 2, -bh, bw, bh, bw * 0.2); g.fill();
      g.fillStyle = '#2b2f36'; g.fillRect(-bw / 2, -bh * 0.18, bw, bh * 0.05); // 띠
      for (const s of [-1, 1]) { g.fillStyle = '#9aa0a8'; g.fillRect(s > 0 ? bw / 2 : -bw / 2 - bw * 0.35, -bh * 0.95, bw * 0.35, bh * 0.08); } // 그리드 핀
      if (S.thr > 0.05) { g.fillStyle = 'rgba(255,190,90,0.9)'; g.beginPath(); g.moveTo(-bw * 0.35, 0); g.lineTo(bw * 0.35, 0); g.lineTo(0, bh * (0.3 + S.thr * 0.5) * (0.85 + Math.random() * 0.3)); g.fill(); }
      g.restore();
      // 계기판
      const m = (lbl, v, good, x) => { D.text(g, lbl, x, 74, { size: 10, color: SYS.text3, align: 'center' }); D.text(g, v, x, 96, { size: 18, weight: 600, mono: true, align: 'center', color: good ? SYS.text : SYS.orange }); };
      m('고도', `${Math.max(0, S.y).toFixed(0)} m`, true, W * 0.18);
      m('수직 속도', `${(-S.vy).toFixed(1)}`, -S.vy <= 2.2 || S.y > 60, W * 0.41);
      m('수평 속도', `${S.vx.toFixed(1)}`, Math.abs(S.vx) <= 1.0 || S.y > 60, W * 0.62);
      m('기울기', `${((S.ang * 180) / Math.PI).toFixed(1)}°`, Math.abs(S.ang) <= 0.05 || S.y > 60, W * 0.83);
      D.rr(g, W / 2 - 70, 110, 140, 4, 2); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fill();
      D.rr(g, W / 2 - 70, 110, 140 * S.fuel / 100, 4, 2); g.fillStyle = S.fuel > 20 ? SYS.text2 : SYS.red; g.fill();
    },
  };
}
