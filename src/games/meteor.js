import { SYS, D } from '../arcade.js';

// 운석 요격 미션: 도킹처럼 관성 추력으로 요격기를 조종해, 충돌 순간 운석 중심(코어)에 정확히 맞혀요.
// 운석은 조금씩 옆으로 흘러가고(드리프트) 회전해요. 화면의 "예상 빗나감"이 0에 가깝게 유지되도록 미리 움직여야 해요.
const CORE = 0.45; // 코어 반지름(m) — 이 안에 맞혀야 성공

export function meteor(opts = {}) {
  const lv = opts.level ?? 1, CORE_R = Math.max(0.3, CORE - (lv - 1) * 0.015);
  let S;
  const spawn = (k) => {
    const r = (a) => (Math.random() * 2 - 1) * a;
    const lvl = (1 + k * 0.6) * (1 + (lv - 1) * 0.08);
    return { x: r(14), y: r(10), z: 1600 + k * 300, vx: r(0.9) * lvl, vy: r(0.7) * lvl, vz: -(110 + k * 40 + (lv - 1) * 8), spin: Math.random() * 6, rs: r(0.8), wob: Math.random() * 6, jolt: 2 + Math.random() * 2 };
  };
  const reset = () => { S = { k: 0, m: spawn(0), mx: 0, my: 0, vx: 0, vy: 0, fuel: 100, hits: [], t: 0, over: false, in: {}, parts: [], flash: 0, stars: Array.from({ length: 160 }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()]) }; };
  const ACC = 2.2; // 추력 가속(m/s²)
  return {
    id: 'meteor', title: opts.title || '운석 요격', place: opts.place || 'HASA 행성 방어 · 요격 관제', campaign: opts.stage,
    icon: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="none" stroke="#ff9f0a" stroke-width="2.5"/><circle cx="24" cy="24" r="3" fill="#ff9f0a"/><path d="M24 2v10M24 36v10M2 24h10M36 24h10" stroke="#ff9f0a" stroke-width="2.5"/></svg>',
    desc: '학교로 다가오는 운석 세 개를 요격기로 정확히 맞혀요. 코어(지름 0.9 m)를 맞혀야 해요.',
    how: ['WASD(또는 왼쪽 버튼)로 추력. 누르는 동안 속도가 붙고, 멈추려면 반대로 밀어야 해요.', '“예상 빗나감”은 지금 속도 그대로 갔을 때 코어에서 벗어나는 거리예요. 0.45 m 안으로 유지하세요. 운석이 가끔 가스를 뿜어 궤도가 틀어져요.', '운석은 옆으로 흘러가고, 뒤로 갈수록 빠르고 거세져요. 연료는 세 번 모두에 써야 해요.'],
    fmt: (v) => `${v.toLocaleString('ko-KR')}점`,
    peek: () => S,
    start(a) {
      reset();
      a.setPads([{ id: 'w', label: '▲', cls: 'l r1' }, { id: 'a', label: '◀', cls: 'l r2a' }, { id: 'd', label: '▶', cls: 'l r2b' }, { id: 's', label: '▼', cls: 'l r3' }], (id, v) => { S.in[id] = v; });
    },
    key(k, down) { const m = { w: 'w', a: 'a', s: 's', d: 'd', ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd' }[k]; if (m) S.in[m] = down; },
    update(dt, a) {
      if (S.over) return;
      S.t += dt; S.flash -= dt;
      const m = S.m;
      // 추력(연료 소모)
      const ax = ((S.in.d ? 1 : 0) - (S.in.a ? 1 : 0)) * ACC, ay = ((S.in.w ? 1 : 0) - (S.in.s ? 1 : 0)) * ACC;
      if ((ax || ay) && S.fuel > 0) { S.vx += ax * dt; S.vy += ay * dt; S.fuel = Math.max(0, S.fuel - dt * 2.6); }
      S.mx += S.vx * dt; S.my += S.vy * dt;
      // 운석: 드리프트 + 회전으로 생기는 작은 흔들림(뒤로 갈수록 커져요)
      m.wob += dt;
      m.x += (m.vx + Math.sin(m.wob * 0.9) * 0.15 * (1 + S.k)) * dt;
      m.y += (m.vy + Math.cos(m.wob * 0.7) * 0.12 * (1 + S.k)) * dt;
      m.z += m.vz * dt; m.spin += m.rs * dt;
      // 가스 분출: 2~4초마다 운석이 갑자기 옆으로 툭 밀려요(뒤 운석일수록 세게)
      m.jolt -= dt;
      if (m.jolt <= 0) { m.jolt = 2 + Math.random() * 2; const k2 = 0.25 + S.k * 0.12, ang = Math.random() * Math.PI * 2; m.vx += Math.cos(ang) * k2; m.vy += Math.sin(ang) * k2; S.gas = 0.6; a.hap?.play('tap'); }
      S.gas = (S.gas || 0) - dt;
      if (m.z <= 0) {
        const miss = Math.hypot(m.x - S.mx, m.y - S.my), hit = miss <= CORE_R;
        S.hits.push({ hit, miss });
        D.burst(S.parts, a.W / 2, a.H * 0.45, hit ? 70 : 20, hit ? SYS.orange : SYS.gray, hit ? 320 : 120);
        S.flash = hit ? 0.5 : 0;
        a.hap?.play(hit ? 'collapse' : 'error');
        S.k++;
        const score = S.hits.reduce((s, h) => s + (h.hit ? Math.round(1000 - (h.miss / CORE_R) * 500) : 0), 0) + Math.round(S.fuel * 3);
        a.score(score);
        if (S.k >= 3) {
          S.over = true;
          const n = S.hits.filter((h) => h.hit).length;
          setTimeout(() => a.finish({ score: n ? score : 0, win: n === 3, title: n === 3 ? '세 개 모두 요격' : `${n}/3 요격`, detail: S.hits.map((h, i) => `${i + 1}번 ${h.hit ? '명중' : '빗나감'} ${h.miss.toFixed(2)} m`).join(' · ') }), 900);
        } else { S.m = spawn(S.k); S.mx = S.my = 0; S.vx = S.vy = 0; }
      }
    },
    draw(g, W, H, a, dt) {
      if (!S) reset();
      const m = S.m, cx = W / 2, cy = H * 0.45;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      // 별(요격기 시점, 앞으로 날아가는 느낌)
      for (const s of S.stars) { s[2] -= dt * 0.25; if (s[2] <= 0.02) { s[0] = Math.random() * 2 - 1; s[1] = Math.random() * 2 - 1; s[2] = 1; } const k = 1 / s[2]; const x = cx + s[0] * W * 0.25 * k, y = cy + s[1] * H * 0.25 * k; g.globalAlpha = Math.min(1, (1 - s[2]) * 1.5); g.fillStyle = '#fff'; g.fillRect(x, y, 1.4, 1.4); }
      g.globalAlpha = 1;
      // 운석(원근: 가까울수록 커짐)
      const f = Math.min(W, H) * 1.1 / Math.max(6, m.z), rx = (m.x - S.mx) * f, ry = -(m.y - S.my) * f, R = 4.5 * f;
      if (m.z > 0) {
        g.save(); g.translate(cx + rx, cy + ry); g.rotate(m.spin);
        const grd = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
        grd.addColorStop(0, '#9b8a78'); grd.addColorStop(1, '#3a322b');
        g.fillStyle = grd; g.beginPath();
        for (let i = 0; i < 14; i++) { const ang = (i / 14) * Math.PI * 2, rr = R * (0.82 + 0.18 * Math.sin(i * 2.7 + 1)); i ? g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : g.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
        g.closePath(); g.fill();
        // 코어 표시
        g.strokeStyle = 'rgba(255,159,10,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, Math.max(2, CORE_R * f), 0, Math.PI * 2); g.stroke();
        g.restore();
      }
      // 고정 조준선
      const tti = Math.max(0, m.z / -m.vz), pmx = m.x - S.mx + (m.vx - S.vx) * tti, pmy = m.y - S.my + (m.vy - S.vy) * tti, pmiss = Math.hypot(pmx, pmy);
      const good = pmiss <= CORE_R;
      g.strokeStyle = good ? SYS.green : 'rgba(255,255,255,0.75)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(cx + dx * 38, cy + dy * 38); g.lineTo(cx + dx * 58, cy + dy * 58); g.stroke(); }
      // 예측 충돌점(작은 마름모)
      const px = cx + pmx * Math.min(40, f * 6), py = cy - pmy * Math.min(40, f * 6);
      g.save(); g.translate(D.clamp(px, 20, W - 20), D.clamp(py, 80, H - 200)); g.rotate(Math.PI / 4); g.strokeStyle = good ? SYS.green : SYS.orange; g.strokeRect(-5, -5, 10, 10); g.restore();
      // 원격 측정
      const row = (x, y, lbl, val, ok, align = 'left') => { D.text(g, lbl, x, y, { size: 10, color: SYS.text3, align }); D.text(g, val, x, y + 18, { size: 16, weight: 600, mono: true, align, color: ok ? SYS.green : SYS.orange }); };
      row(18, 70, '상대 X', `${(m.x - S.mx >= 0 ? '+' : '') + (m.x - S.mx).toFixed(2)} m`, Math.abs(m.x - S.mx) < CORE_R);
      row(18, 114, '상대 Y', `${(m.y - S.my >= 0 ? '+' : '') + (m.y - S.my).toFixed(2)} m`, Math.abs(m.y - S.my) < CORE_R);
      row(18, 158, '상대 속도', `${Math.hypot(m.vx - S.vx, m.vy - S.vy).toFixed(2)} m/s`, Math.hypot(m.vx - S.vx, m.vy - S.vy) < 0.15);
      row(W - 18, 70, '거리', `${m.z.toFixed(0)} m`, true, 'right');
      row(W - 18, 114, '충돌까지', `${tti.toFixed(1)} s`, true, 'right');
      row(W - 18, 158, '운석', `${S.k + 1}/3`, true, 'right');
      D.text(g, '예상 빗나감', cx, H * 0.72, { size: 10, color: SYS.text3, align: 'center' });
      D.text(g, `${pmiss.toFixed(2)} m`, cx, H * 0.72 + 26, { size: 28, weight: 600, mono: true, align: 'center', color: good ? SYS.green : SYS.orange });
      D.rr(g, cx - 60, H * 0.72 + 40, 120, 4, 2); g.fillStyle = SYS.panel2; g.fill();
      D.rr(g, cx - 60, H * 0.72 + 40, 120 * S.fuel / 100, 4, 2); g.fillStyle = S.fuel > 25 ? SYS.text2 : SYS.red; g.fill();
      D.text(g, `연료 ${Math.round(S.fuel)}%`, cx, H * 0.72 + 60, { size: 11, color: SYS.text3, align: 'center' });
      if (S.gas > 0) { g.globalAlpha = S.gas; D.text(g, '가스 분출 · 궤도 변화', cx, H * 0.45 - 80, { size: 13, weight: 700, color: SYS.orange, align: 'center' }); g.globalAlpha = 1; }
      if (S.flash > 0) { g.fillStyle = `rgba(255,190,90,${S.flash})`; g.fillRect(0, 0, W, H); }
      D.stepParticles(S.parts, dt, g);
    },
  };
}
