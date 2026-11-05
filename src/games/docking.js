import { SYS, D } from '../arcade.js';

// HASA 도킹: 국제우주정거장 도킹처럼 관성 조작으로 도킹 포트에 맞춰 붙여요.
// 한 번 누를 때마다 속도가 0.05 m/s(회전은 0.1°/s)씩 더해지고, 멈추려면 반대로 눌러야 해요.
const LIM = { pos: 0.12, rate: 0.12, ang: 0.3, arate: 0.08 };

export function docking(opts = {}) {
  const lv = opts.level ?? 1; // 캠페인 단계(1~)
  const tight = 1 + (lv - 1) * 0.06, LIMS = { pos: LIM.pos / tight, rate: LIM.rate / tight, ang: LIM.ang / tight };
  let S, parts, stars;
  const reset = () => {
    const r = (a) => (Math.random() * 2 - 1) * a;
    S = { x: r(3.2 * (1 + (lv - 1) * 0.1)), y: r(2.4 * (1 + (lv - 1) * 0.1)), z: 80 + (lv - 1) * 8, vx: r(0.07), vy: r(0.07), vz: -0.1, roll: r(9), pitch: r(6), yaw: r(6), vr: r(0.25), vp: r(0.18), vyw: r(0.18), t: 0, fuel: 100, hold: {}, over: false, msg: '' };
    parts = [];
  };
  stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);
  const impulse = (k) => {
    if (S.fuel <= 0) return;
    const m = { up: ['vy', 0.05], down: ['vy', -0.05], left: ['vx', -0.05], right: ['vx', 0.05], fwd: ['vz', -0.05], back: ['vz', 0.05], rl: ['vr', -0.1], rr: ['vr', 0.1], pu: ['vp', 0.1], pd: ['vp', -0.1], yl: ['vyw', -0.1], yr: ['vyw', 0.1] }[k];
    if (!m) return;
    S[m[0]] += m[1];
    S.fuel = Math.max(0, S.fuel - (['vx', 'vy', 'vz'].includes(m[0]) ? 0.85 : 0.45) * (1 + (lv - 1) * 0.05));
  };
  const KEY = { w: 'up', s: 'down', a: 'left', d: 'right', e: 'fwd', q: 'back', ArrowUp: 'pu', ArrowDown: 'pd', ArrowLeft: 'yl', ArrowRight: 'yr', z: 'rl', c: 'rr' };
  const ok = (v, l) => Math.abs(v) <= l;

  return {
    id: 'docking', title: opts.title || 'HASA 도킹', place: opts.place || 'HASA 우주정거장 · 도킹 관제', campaign: opts.stage,
    icon: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="none" stroke="#30d158" stroke-width="2.5"/><circle cx="24" cy="24" r="6" fill="none" stroke="#30d158" stroke-width="2.5"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke="#30d158" stroke-width="2.5"/></svg>',
    desc: '관성만으로 움직이는 우주선을 도킹 포트에 맞춰 붙여요.',
    how: ['한 번 누를 때마다 속도가 조금씩 더해져요. 멈추려면 반대로 눌러요.', '위치 0.12 m · 속도 0.12 m/s · 각도 0.3° 안. 모든 숫자가 초록인 채로 닿아야 해요.', '키보드: W A S D 상하좌우 · E 전진 · Q 후진 · 방향키 피치·요 · Z C 롤'],
    fmt: (v) => `${v.toLocaleString('ko-KR')}점`,
    start(a) {
      reset();
      a.setPads([
        { id: 'up', label: '▲', cls: 'l r1' }, { id: 'left', label: '◀', cls: 'l r2a' }, { id: 'right', label: '▶', cls: 'l r2b' }, { id: 'down', label: '▼', cls: 'l r3' },
        { id: 'fwd', label: '전진', cls: 'c c1' }, { id: 'back', label: '후진', cls: 'c c2' },
        { id: 'pu', label: '↑', cls: 'r r1' }, { id: 'yl', label: '↶', cls: 'r r2a' }, { id: 'yr', label: '↷', cls: 'r r2b' }, { id: 'pd', label: '↓', cls: 'r r3' },
        { id: 'rl', label: '⟲', cls: 'r r4a' }, { id: 'rr', label: '⟳', cls: 'r r4b' },
      ], (id, v) => { if (v) impulse(id); });
    },
    key(k, down) { if (down && KEY[k] && !S.hold[k]) impulse(KEY[k]); S.hold[k] = down; },
    update(dt, a) {
      if (S.over) return;
      S.t += dt;
      S.x += S.vx * dt; S.y += S.vy * dt; S.z += S.vz * dt;
      S.roll += S.vr * dt; S.pitch += S.vp * dt; S.yaw += S.vyw * dt;
      // 자세가 틀어지면 정렬 오차가 생겨요(요·피치가 좌우·상하로 번져요)
      S.x += Math.sin((S.yaw * Math.PI) / 180) * S.vz * dt * -0.6;
      S.y += Math.sin((S.pitch * Math.PI) / 180) * S.vz * dt * -0.6;
      a.score(Math.max(0, Math.round(1000 - S.t * 2 - (100 - S.fuel) * 3)));
      if (S.z <= 0.2) {
        const good = ok(S.x, LIMS.pos) && ok(S.y, LIMS.pos) && ok(S.vz, LIMS.rate) && ok(S.vx, LIMS.rate) && ok(S.vy, LIMS.rate) && ok(S.roll, LIMS.ang) && ok(S.pitch, LIMS.ang) && ok(S.yaw, LIMS.ang);
        S.over = true;
        const sc = good ? Math.max(100, Math.round(1000 - S.t * 2 - (100 - S.fuel) * 3)) : 0;
        D.burst(parts, a.W / 2, a.H / 2, good ? 40 : 70, good ? SYS.green : SYS.orange, good ? 120 : 260);
        setTimeout(() => a.finish({ score: sc, win: good, title: good ? '도킹 완료' : '충돌', detail: good ? `${Math.round(S.t)}초 · 연료 ${Math.round(S.fuel)}% 남음` : '정렬이 맞지 않은 채로 닿았어요. 숫자를 모두 초록으로 맞춰 봐요.' }), 1100);
      } else if (S.z > 120) { S.over = true; a.finish({ score: 0, win: false, title: '이탈', detail: '정거장에서 너무 멀어졌어요.' }); }
    },
    draw(g, W, H, a, dt) {
      if (!S) reset();
      // 우주 + 지구 가장자리
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (const [x, y, b] of stars) { g.globalAlpha = 0.3 + b * 0.7; g.fillStyle = '#fff'; g.fillRect(x * W, y * H * 0.8, 1.2, 1.2); }
      g.globalAlpha = 1;
      const earth = g.createRadialGradient(W / 2, H * 2.6, H * 1.6, W / 2, H * 2.6, H * 2.05);
      earth.addColorStop(0, '#0b3d91'); earth.addColorStop(0.9, '#1f6fd1'); earth.addColorStop(0.97, '#8fd3ff'); earth.addColorStop(1, 'rgba(143,211,255,0)');
      g.fillStyle = earth; g.fillRect(0, 0, W, H);
      // 도킹 포트(원근)
      const cx = W / 2, cy = H * 0.46, k = Math.min(W, H) * 0.9 / Math.max(0.8, S.z + 2);
      const px = cx - S.x * k * 0.9 - S.yaw * 6, py = cy + S.y * k * 0.9 + S.pitch * 6;
      g.save(); g.translate(px, py); g.rotate((-S.roll * Math.PI) / 180);
      const R = 1.1 * k;
      g.fillStyle = '#d7d9dc'; g.beginPath(); g.arc(0, 0, R * 1.9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b8bcc2'; g.beginPath(); g.arc(0, 0, R * 1.35, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7d828a'; g.lineWidth = Math.max(1, R * 0.06); g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#2b2f36'; g.beginPath(); g.arc(0, 0, R * 0.7, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 3; i++) { g.save(); g.rotate((i * Math.PI * 2) / 3); g.fillStyle = '#9aa0a8'; D.rr(g, -R * 0.12, -R * 1.25, R * 0.24, R * 0.36, R * 0.05); g.fill(); g.restore(); }
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, R * 0.05);
      g.beginPath(); g.moveTo(-R * 0.5, 0); g.lineTo(R * 0.5, 0); g.moveTo(0, -R * 0.5); g.lineTo(0, R * 0.5); g.stroke(); // 표적 십자
      g.restore();
      // 고정 조준 링(내 우주선 정렬 기준)
      const inPos = ok(S.x, LIMS.pos) && ok(S.y, LIMS.pos), inAng = ok(S.roll, LIMS.ang) && ok(S.pitch, LIMS.ang) && ok(S.yaw, LIMS.ang);
      g.strokeStyle = inPos && inAng ? SYS.green : 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(cx + dx * 42, cy + dy * 42); g.lineTo(cx + dx * 64, cy + dy * 64); g.stroke(); }
      // 원격 측정(왼쪽 위·오른쪽 위)
      const row = (x, y, label, val, unit, good, align = 'left') => {
        D.text(g, label, x, y, { size: 10, weight: 600, color: SYS.text3, align });
        D.text(g, `${val}${unit}`, x, y + 18, { size: 16, weight: 600, color: good ? SYS.green : SYS.orange, align, mono: true });
      };
      const f = (v, n = 1) => (v >= 0 ? '+' : '') + v.toFixed(n);
      const L = 18, T = 64;
      row(L, T, 'X', f(S.x), ' m', ok(S.x, LIMS.pos)); row(L, T + 44, 'Y', f(S.y), ' m', ok(S.y, LIMS.pos)); row(L, T + 88, 'Z', S.z.toFixed(1), ' m', true);
      row(L + 92, T, 'RATE X', f(S.vx, 2), '', ok(S.vx, LIMS.rate)); row(L + 92, T + 44, 'RATE Y', f(S.vy, 2), '', ok(S.vy, LIMS.rate)); row(L + 92, T + 88, 'RATE Z', f(S.vz, 2), '', ok(S.vz, LIMS.rate));
      const R0 = W - 18;
      row(R0, T, 'ROLL', f(S.roll), '°', ok(S.roll, LIMS.ang), 'right'); row(R0, T + 44, 'PITCH', f(S.pitch), '°', ok(S.pitch, LIMS.ang), 'right'); row(R0, T + 88, 'YAW', f(S.yaw), '°', ok(S.yaw, LIMS.ang), 'right');
      // 아래 가운데: 거리·접근 속도·연료
      D.text(g, 'RANGE', W / 2 - 70, H * 0.72, { size: 10, color: SYS.text3, align: 'center' });
      D.text(g, `${S.z.toFixed(1)} m`, W / 2 - 70, H * 0.72 + 22, { size: 22, weight: 600, align: 'center', mono: true });
      D.text(g, 'RATE', W / 2 + 70, H * 0.72, { size: 10, color: SYS.text3, align: 'center' });
      D.text(g, `${(-S.vz).toFixed(2)} m/s`, W / 2 + 70, H * 0.72 + 22, { size: 22, weight: 600, align: 'center', mono: true, color: ok(S.vz, LIMS.rate) ? SYS.text : SYS.orange });
      D.rr(g, W / 2 - 60, H * 0.72 + 36, 120, 4, 2); g.fillStyle = SYS.panel2; g.fill();
      D.rr(g, W / 2 - 60, H * 0.72 + 36, 120 * S.fuel / 100, 4, 2); g.fillStyle = S.fuel > 25 ? SYS.text2 : SYS.red; g.fill();
      D.text(g, `연료 ${Math.round(S.fuel)}%`, W / 2, H * 0.72 + 56, { size: 11, color: SYS.text3, align: 'center' });
      D.stepParticles(parts, dt, g);
    },
  };
}
