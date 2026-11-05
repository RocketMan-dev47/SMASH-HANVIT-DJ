import { SYS, D } from '../arcade.js';

// 운동장 승부차기: 5번씩 번갈아 차고, 비기면 서든데스. 슛은 쓸어 올리기, 수비는 골문 왼쪽·가운데·오른쪽 누르기.
export function soccer() {
  let S;
  const reset = () => { S = { round: 0, me: [], ai: [], turn: 'shoot', phase: 'aim', ball: null, keeper: 0, kTarget: 0, t: 0, msg: '쓸어 올려서 슛!', msgT: 9, over: false, parts: [] }; };
  const goalBox = (W, H) => { const gw = Math.min(W * 0.78, 520), gh = gw * 0.34; return { x: W / 2 - gw / 2, y: H * 0.26, w: gw, h: gh }; };
  const score = () => [S.me.filter(Boolean).length, S.ai.filter(Boolean).length];
  const decided = () => {
    const [m, a] = score(), n = Math.max(S.me.length, S.ai.length);
    if (S.me.length <= 5 && S.ai.length <= 5) {
      const leftM = 5 - S.me.length, leftA = 5 - S.ai.length;
      if (m > a + leftA || a > m + leftM) return true;
      return S.me.length === 5 && S.ai.length === 5 && m !== a;
    }
    return S.me.length === S.ai.length && m !== a && n > 5;
  };
  return {
    id: 'soccer', title: '승부차기', place: '운동장 · 축구장',
    icon: '<svg viewBox="0 0 48 48"><rect x="6" y="10" width="36" height="16" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="24" cy="36" r="7" fill="#fff"/><path d="M24 31l3 2-1 4h-4l-1-4z" fill="#1c1c1e"/></svg>',
    desc: '한빛 운동장에서 사범님과 승부차기 한 판.',
    how: ['찰 때: 공에서 골문 쪽으로 쓸어 올려요. 방향과 세기가 그대로 슛이 돼요.', '막을 때: 상대가 차는 순간 골문 왼쪽·가운데·오른쪽 중 하나를 눌러요.', '5번씩 차고, 비기면 서든데스예요.'],
    fmt: (v) => `${Math.floor(v / 10)} : ${v % 10}`,
    start() { reset(); },
    up(x, y, s) {
      const a = this.a;
      if (S.over || !a) return;
      const G = goalBox(a.W, a.H);
      if (S.turn === 'shoot' && S.phase === 'aim' && s.dy < -30) {
        const speed = Math.min(1.25, Math.hypot(s.dx, s.dy) / Math.max(0.08, s.dt) / 1400);
        // 세게 찰수록 흔들려요(정확도 ↔ 세기)
        const shake = (Math.random() - 0.5) * G.w * 0.16 * speed;
        const tx = G.x + G.w / 2 + s.dx * 1.6 + shake, ty = G.y + G.h * 0.9 + s.dy * 0.35 * speed;
        S.ball = { x0: a.W / 2, y0: a.H * 0.78, tx, ty, t: 0, dur: 0.7 - speed * 0.25 };
        // 키퍼: 느린 슛은 방향을 읽고(70%), 빠른 슛은 미리 고른 쪽으로
        const dir = Math.sign(tx - (G.x + G.w / 2)) * (Math.abs(tx - (G.x + G.w / 2)) > G.w * 0.15 ? 1 : 0);
        S.kTarget = (speed < 0.85 && Math.random() < 0.7 ? dir : [-1, 0, 1][Math.floor(Math.random() * 3)]) * G.w * 0.33;
        S.phase = 'fly'; a.hap?.play('select');
      } else if (S.turn === 'save' && S.phase === 'ready') {
        S.myDive = x < G.x + G.w * 0.36 ? -1 : x > G.x + G.w * 0.64 ? 1 : 0;
        a.hap?.play('tap');
      }
    },
    down() {},
    update(dt, a) {
      this.a = a;
      if (S.over) return;
      S.t += dt; S.msgT -= dt;
      const G = goalBox(a.W, a.H);
      if (S.turn === 'save' && S.phase === 'ready') {
        S.wait -= dt;
        if (S.wait <= 0) {
          const side = [-1, 0, 1][Math.floor(Math.random() * 3)], high = Math.random() < 0.5;
          S.aiSide = side;
          S.ball = { x0: a.W / 2, y0: a.H * 0.78, tx: G.x + G.w / 2 + side * G.w * (0.28 + Math.random() * 0.12), ty: G.y + (high ? G.h * 0.3 : G.h * 0.8), t: 0, dur: 0.5 };
          S.phase = 'fly';
        }
      }
      if (S.phase === 'fly' && S.ball) {
        const b = S.ball; b.t += dt;
        const k = Math.min(1, b.t / b.dur);
        if (S.turn === 'shoot') S.keeper = D.lerp(S.keeper, S.kTarget, Math.min(1, dt * 7));
        else S.keeper = D.lerp(S.keeper, (S.myDive ?? 0) * G.w * 0.33, Math.min(1, dt * 9));
        if (k >= 1) {
          const inGoal = b.tx > G.x + 6 && b.tx < G.x + G.w - 6 && b.ty > G.y + 4 && b.ty < G.y + G.h;
          const kx = G.x + G.w / 2 + S.keeper, saved = inGoal && Math.abs(b.tx - kx) < G.w * 0.17;
          const goal = inGoal && !saved;
          if (S.turn === 'shoot') { S.me.push(goal); S.msg = goal ? '골!' : saved ? '막혔어요' : '빗나갔어요'; }
          else { S.ai.push(goal); S.msg = goal ? '실점' : '선방!'; }
          S.msgT = 1.3;
          if (goal) D.burst(S.parts, b.tx, b.ty, 26, S.turn === 'shoot' ? SYS.green : SYS.red, 160);
          a.hap?.play(goal === (S.turn === 'shoot') ? 'badge' : 'tap');
          const [m, ai] = score();
          a.score(m * 10 + ai, `${m} : ${ai}`);
          S.phase = 'done';
          setTimeout(() => {
            if (decided()) {
              const [mm, aa] = score(); S.over = true;
              a.finish({ score: mm * 10 + aa, win: mm > aa, title: mm > aa ? '승부차기 승리' : '아쉽게 패배', detail: `${mm} : ${aa}${S.me.length > 5 ? ' · 서든데스' : ''}` });
              return;
            }
            S.ball = null; S.keeper = 0; S.myDive = null;
            if (S.turn === 'shoot') { S.turn = 'save'; S.phase = 'ready'; S.wait = 1.2 + Math.random(); S.msg = '막아요! 골문을 눌러 다이빙'; S.msgT = 9; }
            else { S.turn = 'shoot'; S.phase = 'aim'; S.msg = '쓸어 올려서 슛!'; S.msgT = 9; }
          }, 1100);
        }
      }
    },
    draw(g, W, H, a, dt) {
      if (!S) reset();
      // 잔디(줄무늬) + 라인
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3f8a3a' : '#468f40'; g.fillRect(0, (H / 12) * i, W, H / 12 + 1); }
      const G = goalBox(W, H);
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, G.y + G.h + 2); g.lineTo(W, G.y + G.h + 2); g.stroke();
      g.strokeRect(G.x - G.w * 0.25, G.y + G.h + 2, G.w * 1.5, H * 0.3);
      g.beginPath(); g.arc(W / 2, H * 0.78, 3, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      // 골대 + 그물
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
      for (let x = G.x; x <= G.x + G.w; x += 14) { g.beginPath(); g.moveTo(x, G.y); g.lineTo(x, G.y + G.h); g.stroke(); }
      for (let y = G.y; y <= G.y + G.h; y += 14) { g.beginPath(); g.moveTo(G.x, y); g.lineTo(G.x + G.w, y); g.stroke(); }
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(G.x, G.y + G.h); g.lineTo(G.x, G.y); g.lineTo(G.x + G.w, G.y); g.lineTo(G.x + G.w, G.y + G.h); g.stroke();
      // 키퍼(내가 막을 땐 내 교복, 찰 땐 사범님)
      const kx = G.x + G.w / 2 + S.keeper, ky = G.y + G.h - 4, lean = S.keeper / (G.w * 0.33);
      g.save(); g.translate(kx, ky); g.rotate(lean * 0.6);
      g.fillStyle = S.turn === 'save' ? '#3a3d43' : '#ff9f0a'; D.rr(g, -14, -52, 28, 46, 10); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-12, -46); g.lineTo(-30, -66); g.moveTo(12, -46); g.lineTo(30, -66); g.stroke();
      g.fillStyle = '#f08848'; g.beginPath(); g.arc(0, -64, 13, 0, Math.PI * 2); g.fill();
      g.restore();
      // 공
      let bx = W / 2, by = H * 0.78, br = 13;
      if (S.ball) { const b = S.ball, k = D.ease(Math.min(1, b.t / b.dur)); bx = D.lerp(b.x0, b.tx, k); by = D.lerp(b.y0, b.ty, k) - Math.sin(k * Math.PI) * 30; br = D.lerp(13, 7, k); }
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(bx, by + br, br, br * 0.35, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1c1c1e'; g.beginPath(); g.arc(bx, by, br * 0.35, 0, Math.PI * 2); g.fill();
      // 점수 동그라미(5개씩)
      const dots = (arr, y, label) => {
        D.text(g, label, 20, y + 5, { size: 12, weight: 600, color: 'rgba(255,255,255,0.8)' });
        for (let i = 0; i < Math.max(5, arr.length); i++) { g.beginPath(); g.arc(70 + i * 20, y, 6, 0, Math.PI * 2); g.fillStyle = i < arr.length ? (arr[i] ? SYS.green : SYS.red) : 'rgba(255,255,255,0.25)'; g.fill(); }
      };
      dots(S.me, H - 54, '나'); dots(S.ai, H - 32, '상대');
      if (S.msgT > 0) { g.globalAlpha = Math.min(1, S.msgT * 2); D.text(g, S.msg, W / 2, G.y - 18, { size: 17, weight: 700, align: 'center' }); g.globalAlpha = 1; }
      D.stepParticles(S.parts, dt, g, 200);
    },
  };
}
