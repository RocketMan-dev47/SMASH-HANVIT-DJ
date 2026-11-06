import { SYS, D } from '../arcade.js';

// 한빛 그랑프리(급식 레이싱) — 물리 버전
// 서킷: 세계의 상징적인 코너를 이어 붙인 약 4 km 코스(한 바퀴 1분 남짓), 2바퀴.
// 물리: 출력 제한 가속 + 공기저항 + 속도에 비례하는 다운포스 + 타이어 접지 한계(넘으면 바깥으로 밀려나요).
// 코너 도전: 코너마다 이 서킷 물리로 계산한 "레코드 페이스"(이론상 최고)를 깨 보기. 확인된 실제 F1 랩 레코드는 상식으로 함께 보여줘요.
export const SKINS = [
  { id: 'formula', name: '한빛 포뮬러', desc: '네이비 차체에 앰버 줄무늬' },
  { id: 'bag', name: '책가방 썰매', desc: '가방 타고 언덕 내려가기' },
  { id: 'tray', name: '급식판 카트', desc: '칸칸이 나뉜 은색 급식판' },
  { id: 'chair', name: '바퀴 의자', desc: '교무실 회전의자' },
  { id: 'mop', name: '청소 카트', desc: '대걸레와 양동이' },
  { id: 'slipper', name: '실내화', desc: '삼선 실내화 한 짝' },
];
export const skinStore = {
  owned() { try { return JSON.parse(localStorage.getItem('smash-skins') || '["formula"]'); } catch { return ['formula']; } },
  add(id) { const o = this.owned(); if (!o.includes(id)) { o.push(id); try { localStorage.setItem('smash-skins', JSON.stringify(o)); } catch { /* 무시 */ } } },
  sel() { try { return localStorage.getItem('smash-skin') || 'formula'; } catch { return 'formula'; } },
  set(id) { try { localStorage.setItem('smash-skin', id); } catch { /* 무시 */ } },
};

// 코스: 닫힌 다각형의 꼭짓점마다 반지름만큼 둥글게 깎아요(항상 닫히고 겹치지 않음).
// [x, y, 코너 반지름(m), 코너 묶음]. 같은 묶음이 이어지면 한 코너 도전 구간이에요.
const VERTS = [
  [700, 0, 28, 'COTA 1번 코너'], [640, -170, 90, 'COTA 1번 코너'],
  [700, -300, 70, '스즈카 에세스'], [630, -420, 70, '스즈카 에세스'], [700, -540, 70, '스즈카 에세스'], [640, -660, 80, '스즈카 에세스'],
  [660, -820, 150, '스파 오 루즈'], [620, -900, 150, '스파 오 루즈'],
  [560, -960, 60, null], [-200, -960, 50, null],
  [-260, -620, 11, '모나코 페어몬트 헤어핀'], [-150, -660, 40, null],
  [-90, -520, 110, '실버스톤 매고츠·베킷'], [-150, -400, 110, '실버스톤 매고츠·베킷'], [-90, -280, 110, '실버스톤 매고츠·베킷'],
  [-120, -60, 150, '몬차 파라볼리카'],
];
const INFO = {
  'COTA 1번 코너': '미국 오스틴 서킷 오브 디 아메리카스의 오르막 왼쪽 헤어핀',
  '스즈카 에세스': '일본 스즈카의 S자 연속 코너',
  '스파 오 루즈': '벨기에 스파-프랑코샹의 고속 오르막 꺾임',
  '모나코 페어몬트 헤어핀': '모나코 시가지 서킷의 가장 느린 헤어핀',
  '실버스톤 매고츠·베킷': '영국 실버스톤의 고속 S자 연속 코너',
  '몬차 파라볼리카': '이탈리아 몬차의 길고 넓은 마지막 코너',
};
const TRIVIA = {
  '모나코 페어몬트 헤어핀': '모나코 레이스 랩 레코드 1:12.909 · 루이스 해밀턴(2021)',
  '실버스톤 매고츠·베킷': '실버스톤 레이스 랩 레코드 1:27.097 · 막스 페르스타펜(2020)',
  '몬차 파라볼리카': '몬차 레이스 랩 레코드 1:20.901 · 랜도 노리스(2025)',
};
const RIVALS = [['1-3 김', SYS.red], ['2-5 이', SYS.teal], ['3-1 박', SYS.green], ['2-2 최', SYS.pink], ['1-7 정', SYS.yellow]];
const G = 9.81, MU = 1.7, MU_OFF = 0.55, KDF = 0.0042, PW = 930, CD = 0.00118, AMAX = 12.5, WIDTH = 14, LAPS = 2;
const MAIN = '급식실 메인 스트레이트';

// 주간 서킷 로테이션: ISO 주차 % 4 → 정방향 · 역방향 · 미러 · 미러 역방향
export const CIRCUITS = [
  { id: 'gp', name: '그랑프리 서킷', desc: '원래 방향 · 시계 방향' },
  { id: 'rev', name: '리버스 서킷', desc: '같은 코스를 거꾸로 · 코너 순서가 뒤집혀요' },
  { id: 'mir', name: '미러 서킷', desc: '좌우 반전 · 왼쪽·오른쪽 코너가 바뀌어요' },
  { id: 'mrev', name: '미러 리버스 서킷', desc: '좌우 반전 + 거꾸로' },
];
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
}
export function weeklyCircuit(d = new Date()) { const w = isoWeek(d); return { ...CIRCUITS[w.week % 4], key: `${w.year}-W${w.week}` }; }

function build(cid = 'gp') {
  let V = VERTS.map((v) => v.slice());
  if (cid === 'mir' || cid === 'mrev') V = V.map(([x, y, r, g]) => [-x, y, r, g]);
  if (cid === 'rev' || cid === 'mrev') V = V.reverse();
  const n = V.length, fil = [];
  for (let i = 0; i < n; i++) {
    const P = V[i], A = V[(i - 1 + n) % n], B = V[(i + 1) % n];
    const da = Math.hypot(A[0] - P[0], A[1] - P[1]), db = Math.hypot(B[0] - P[0], B[1] - P[1]);
    const ux = (A[0] - P[0]) / da, uy = (A[1] - P[1]) / da, vx = (B[0] - P[0]) / db, vy = (B[1] - P[1]) / db;
    const ang = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    const t = Math.min(P[2] / Math.tan(ang / 2), da * 0.45, db * 0.45), r = t * Math.tan(ang / 2);
    let bx = ux + vx, by = uy + vy; const bl = Math.hypot(bx, by); bx /= bl; by /= bl;
    const cd = r / Math.sin(ang / 2);
    fil.push({ pin: [P[0] + ux * t, P[1] + uy * t], pout: [P[0] + vx * t, P[1] + vy * t], C: [P[0] + bx * cd, P[1] + by * cd], r, g: P[3] });
  }
  let pts = [], names = [];
  for (let i = 0; i < n; i++) {
    const f = fil[i], nx = fil[(i + 1) % n];
    let a0 = Math.atan2(f.pin[1] - f.C[1], f.pin[0] - f.C[0]), d = Math.atan2(f.pout[1] - f.C[1], f.pout[0] - f.C[0]) - a0;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const k = Math.max(3, Math.ceil((Math.abs(d) * f.r) / 5));
    for (let j = 0; j <= k; j++) { const a = a0 + (d * j) / k; pts.push([f.C[0] + Math.cos(a) * f.r, f.C[1] + Math.sin(a) * f.r]); names.push(f.g); }
    const L = Math.hypot(nx.pin[0] - f.pout[0], nx.pin[1] - f.pout[1]), m = Math.max(1, Math.ceil(L / 6));
    const key = (a, b) => [a, b].map((v) => `${Math.abs(v[0])},${v[1]}`).sort().join('|');
    const kk = key(V[i], V[(i + 1) % n]);
    const sname = f.g && nx.g === f.g ? f.g : kk === key([120, -60], [700, 0]) ? MAIN : kk === key([560, -960], [200, -960]) ? '영암 백스트레이트' : null;
    for (let j = 1; j < m; j++) { pts.push([f.pout[0] + ((nx.pin[0] - f.pout[0]) * j) / m, f.pout[1] + ((nx.pin[1] - f.pout[1]) * j) / m]); names.push(sname); }
  }
  // 출발선을 메인 스트레이트 가운데로
  let s0 = 0, bd = 1e9;
  const sx = cid === 'mir' || cid === 'mrev' ? -300 : 300;
  pts.forEach((p, i) => { if (names[i] === MAIN) { const d = Math.hypot(p[0] - sx, p[1] + 30); if (d < bd) { bd = d; s0 = i; } } });
  pts = pts.slice(s0).concat(pts.slice(0, s0)); names = names.slice(s0).concat(names.slice(0, s0));
  const N = pts.length;
  const seg = pts.map((p, i) => Math.hypot(pts[(i + 1) % N][0] - p[0], pts[(i + 1) % N][1] - p[1]));
  const head = pts.map((p, i) => { const q = pts[(i + 2) % N]; return Math.atan2(q[0] - p[0], -(q[1] - p[1])); });
  // 곡률 → 다운포스 포함 최고 코너 속도 → 브레이크·가속 한계로 다듬은 레코드 페이스 속도
  const vmax = pts.map((p, i) => {
    const a = pts[(i - 4 + N) % N], b = pts[(i + 4) % N];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), ap = Math.hypot(p[0] - a[0], p[1] - a[1]), pb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const area = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (p[1] - a[1])) / 2;
    const R = area > 1e-3 ? (ab * ap * pb) / (4 * area) : 1e6;
    const den = 1 - MU * KDF * R;
    return den <= 0.02 ? 95 : Math.min(95, Math.sqrt((MU * G * R) / den));
  });
  const prof = vmax.slice();
  for (let pass = 0; pass < 3; pass++) for (let k = N - 1; k >= 0; k--) { const j = (k + 1) % N, dec = MU * (G + KDF * prof[j] ** 2) * 0.9; prof[k] = Math.min(prof[k], Math.sqrt(prof[j] ** 2 + 2 * dec * seg[k])); }
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < N; i++) { const j = (i + 1) % N, acc = Math.min(AMAX, PW / Math.max(1, prof[i])) - CD * prof[i] ** 2; prof[j] = Math.min(prof[j], Math.sqrt(prof[i] ** 2 + 2 * Math.max(0, acc) * seg[i])); }
  const sectors = [];
  for (let i = 0; i < N; i++) if (names[i] && names[i] !== MAIN && names[i] !== '영암 백스트레이트' && (!i || names[i - 1] !== names[i])) sectors.push({ name: names[i], a: i });
  for (const s of sectors) { let b = s.a; while (names[(b + 1) % N] === s.name) b++; s.b = b; s.pace = 0; for (let i = s.a; i <= b; i++) s.pace += seg[i] / prof[i]; s.info = INFO[s.name] || ''; }
  const lapPace = seg.reduce((acc, L, i) => acc + L / prof[i], 0);
  return { pts, names, N, seg, head, prof, sectors, lapPace, total: seg.reduce((p, q) => p + q, 0) };
}

export function drawSkin(g, id, len, color = '#0b3d91') {
  const w = len * 0.42;
  g.save();
  const wheels = () => { g.fillStyle = '#111'; for (const [x, y] of [[-w / 2, -len * 0.32], [w / 2, -len * 0.32], [-w / 2, len * 0.28], [w / 2, len * 0.28]]) { D.rr(g, x - w * 0.13, y - len * 0.09, w * 0.26, len * 0.18, Math.min(3, len * 0.05)); g.fill(); } };
  if (id === 'formula') {
    wheels();
    g.fillStyle = '#0b2a5e'; D.rr(g, -w * 0.3, -len / 2, w * 0.6, len, w * 0.3); g.fill();
    g.fillStyle = '#ffc94a'; g.fillRect(-w * 0.05, -len / 2, w * 0.1, len);
    g.fillStyle = '#0b2a5e'; g.fillRect(-w / 2, -len / 2, w, len * 0.09); g.fillRect(-w * 0.55, len / 2 - len * 0.11, w * 1.1, len * 0.11);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, len * 0.02, w * 0.13, 0, Math.PI * 2); g.fill();
  } else if (id === 'bag') {
    g.fillStyle = '#2f6fe0'; D.rr(g, -w * 0.5, -len * 0.45, w, len * 0.9, w * 0.35); g.fill();
    g.fillStyle = '#1f4fa8'; D.rr(g, -w * 0.38, -len * 0.05, w * 0.76, len * 0.36, w * 0.2); g.fill();
    g.strokeStyle = '#ffc94a'; g.lineWidth = len * 0.04; g.beginPath(); g.moveTo(-w * 0.3, -len * 0.4); g.lineTo(-w * 0.3, len * 0.4); g.moveTo(w * 0.3, -len * 0.4); g.lineTo(w * 0.3, len * 0.4); g.stroke();
  } else if (id === 'tray') {
    g.fillStyle = '#c9ced6'; D.rr(g, -w * 0.55, -len / 2, w * 1.1, len, len * 0.1); g.fill();
    g.fillStyle = '#9aa1ab'; for (const [x, y, ww, hh] of [[-0.45, -0.45, 0.4, 0.3], [0.05, -0.45, 0.4, 0.3], [-0.45, -0.08, 0.9, 0.22], [-0.45, 0.2, 0.42, 0.25], [0.07, 0.2, 0.38, 0.25]]) { D.rr(g, x * w, y * len, ww * w, hh * len, len * 0.05); g.fill(); }
  } else if (id === 'chair') {
    g.fillStyle = '#222'; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * w * 0.5, Math.sin(a) * w * 0.5, len * 0.06, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#3a3d43'; g.beginPath(); g.arc(0, 0, w * 0.45, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b5f66'; D.rr(g, -w * 0.4, len * 0.12, w * 0.8, len * 0.2, len * 0.1); g.fill();
  } else if (id === 'mop') {
    g.fillStyle = '#ffd60a'; D.rr(g, -w * 0.5, -len * 0.35, w, len * 0.7, len * 0.1); g.fill();
    g.fillStyle = '#5ac8fa'; g.beginPath(); g.arc(0, -len * 0.1, w * 0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8b5a2b'; g.lineWidth = len * 0.05; g.beginPath(); g.moveTo(w * 0.2, len * 0.3); g.lineTo(w * 0.1, -len * 0.55); g.stroke();
  } else if (id === 'slipper') {
    g.fillStyle = '#f2f2f2'; D.rr(g, -w * 0.42, -len / 2, w * 0.84, len, w * 0.42); g.fill();
    g.fillStyle = '#1f4fa8'; for (const x of [-0.24, 0, 0.24]) g.fillRect(x * w - len * 0.035, -len * 0.42, len * 0.07, len * 0.38);
  } else { wheels(); g.fillStyle = color; D.rr(g, -w * 0.3, -len / 2, w * 0.6, len, w * 0.3); g.fill(); g.fillRect(-w / 2, -len / 2, w, len * 0.09); g.fillRect(-w * 0.55, len / 2 - len * 0.11, w * 1.1, len * 0.11); }
  g.restore();
}

export function race(opts = {}) {
  const CIR = opts.circuit ? { ...CIRCUITS.find((c) => c.id === opts.circuit), key: 'custom' } : weeklyCircuit();
  const T = build(CIR.id);
  const K = (k) => `smash-gp-${CIR.id}-${k}`;
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(K(k))) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(K(k), JSON.stringify(v)); } catch { /* 저장 공간 부족 등 */ } };
  const { pts, N, seg, head, prof } = T;
  let S, rival = null;
  const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;
  const records = () => load('sectors', {});
  const nearest = (x, y, hint) => {
    let best = hint, bd = 1e12;
    for (let k = -25; k <= 40; k++) { const i = (hint + k + N) % N, d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    if (bd > (WIDTH * 3) ** 2) for (let i = 0; i < N; i++) { const d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return [best, Math.sqrt(bd)];
  };
  const reset = () => {
    const grid = (k) => { const i = 4 + (5 - k) * 4, h = head[i], side = k % 2 ? 1 : -1; let prog = 0; for (let j = 0; j < i; j++) prog += seg[j]; return { x: pts[i][0] + Math.cos(h) * side * 3.5, y: pts[i][1] + Math.sin(h) * side * 3.5, h, i, prog, vx: 0, vy: 0, sp: 0, slip: 0 }; };
    const me = { ...grid(5), name: '나', color: '#ffc94a', me: true, lap: 0, steer: 0, skin: skinStore.sel(), best: 0, lapStart: 0, done: 0 };
    const ai = RIVALS.map(([n, c], k) => ({ ...grid(k), name: n, color: c, lap: 0, pace: 0.925 + Math.random() * 0.02 - k * 0.004, done: 0 }));
    S = { cars: [me, ...ai], me, t: -4.2, lights: 0, input: { l: false, r: false, b: false }, finishOrder: [], sector: null, banner: '', bannerT: 0, rec: records(), ghost: rival || load('ghost', null), rivalGhost: rival, lapRec: [], recT: 0 };
  };
  const progress = (c) => c.lap * T.total + c.prog;
  // 차 한 대 물리(공통)
  const step = (c, dt, steer, throttle, brake) => {
    const [i, off] = nearest(c.x, c.y, c.i);
    const grass = off > WIDTH / 2 + 1.5, mu = grass ? MU_OFF : MU;
    const u = Math.hypot(c.vx, c.vy);
    const fx = Math.sin(c.h), fy = -Math.cos(c.h), rx = Math.cos(c.h), ry = Math.sin(c.h);
    let vf = c.vx * fx + c.vy * fy, vl = c.vx * rx + c.vy * ry;
    const grip = mu * (G + KDF * u * u);
    const delta = steer * Math.min(0.34, 4.6 / Math.max(6, u)); // 빠를수록 핸들 각이 작아져요
    let yaw = (vf * Math.tan(delta)) / 3.6;
    const need = Math.abs(vf * yaw);
    if (need > grip) { yaw *= grip / need; c.slip = Math.min(1, c.slip + dt * 3); } else c.slip = Math.max(0, c.slip - dt * 2);
    c.h += yaw * dt;
    const drive = throttle * Math.min(AMAX, PW / Math.max(1, vf)) * (grass ? 0.45 : 1);
    vf += (drive - CD * vf * vf - (grass ? 0.01 * vf * vf + 2.5 : 0.3) - brake * grip * 0.95) * dt;
    if (vf < 0) vf = 0;
    vl -= Math.sign(vl) * Math.min(Math.abs(vl), grip * dt * (c.slip > 0.5 ? 0.3 : 1)); // 접지 한계를 넘으면 옆으로 미끄러짐이 남아요
    const nfx = Math.sin(c.h), nfy = -Math.cos(c.h);
    c.vx = nfx * vf + Math.cos(c.h) * vl; c.vy = nfy * vf + Math.sin(c.h) * vl;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.sp = vf;
    let prog = 0; for (let k = 0; k < i; k++) prog += seg[k];
    if (c.prog > T.total * 0.8 && prog < T.total * 0.2) {
      c.lap++;
      if (c.me) {
        const lt = S.t - c.lapStart; c.best = c.best ? Math.min(c.best, lt) : lt; c.lapStart = S.t;
        const gb = S.ghost?.t;
        S.lapDone = { t: lt, s: S.lapRec.slice() };
        if (S.rivalGhost && lt < S.rivalGhost.t) S.rivalBeat = true;
        if (!gb || lt < gb) { save('ghost', { t: lt, s: S.lapRec }); S.banner = `${c.lap}랩 ${fmtT(lt)} · 고스트 갱신!`; if (gb) S.ghostBeat = true; } else S.banner = `${c.lap}랩 ${fmtT(lt)} · 고스트보다 +${(lt - gb).toFixed(2)}`;
        S.bannerT = 2.6; S.lapRec = []; S.recT = 0;
      }
    }
    else if (c.prog < T.total * 0.2 && prog > T.total * 0.8) c.lap--;
    c.prog = prog; c.i = i; c.grass = grass;
  };
  return {
    id: 'race', title: '한빛 그랑프리',
    icon: '<svg viewBox="0 0 48 48"><path d="M6 40h36" stroke="#8e8e93" stroke-width="3"/><rect x="18" y="10" width="12" height="26" rx="5" fill="#0b2a5e"/><rect x="23" y="10" width="2" height="26" fill="#ffc94a"/><rect x="14" y="10" width="20" height="4" fill="#0b2a5e"/></svg>',
    place: `이번 주 · ${CIR.name}`,
    desc: `${CIR.name}(${CIR.desc}). 세계 명물 코너를 이은 ${(T.total / 1000).toFixed(1)} km, 2바퀴 뒤 1등이면 급식 1등. 서킷은 매주 월요일에 바뀌어요.`,
    how: ['빨간불 다섯 개가 꺼지면 출발. 가속은 자동, ↓(가운데 버튼)가 브레이크예요.', '타이어 접지 한계가 있어요. 빠르게 꺾으면 바깥으로 밀리고, 잔디·자갈에선 크게 느려져요.', `코너마다 “레코드 페이스”(이 서킷 물리로 계산한 이론상 최고)에 도전해요. 한 바퀴 레코드 페이스 ${fmtT(T.lapPace)}.`],
    fmt: (v) => fmtT(v / 1000), lowerIsBetter: true,
    peek: () => ({ S, T }),
    circuit: CIR.id, week: weeklyCircuit().key,
    setRival(g) { rival = g && g.s ? g : null; },
    extra() {
      const own = skinStore.owned(), sel = skinStore.sel(), rec = records();
      const beat = T.sectors.filter((s) => rec[s.name] && rec[s.name] <= s.pace).length;
      const gh = load('ghost', null), wk = load('week', {})[weeklyCircuit().key];
      return `<p class="arc-x-t">${CIR.name} · 이번 주 최고 ${wk ? fmtT(wk) : '-'} · 고스트(최고 랩) ${gh ? fmtT(gh.t) : '없음'}</p><div id="gp-rank"></div><p class="arc-x-t">차 고르기</p><div class="arc-skins">${SKINS.map((s) => `<button type="button" data-s="${s.id}" class="${s.id === sel ? 'on' : ''}" ${own.includes(s.id) ? '' : 'disabled'} aria-label="${s.name}"><canvas width="88" height="88"></canvas><span>${own.includes(s.id) ? s.name : '잠김'}</span></button>`).join('')}</div>
        <p class="arc-x-t">코너 도전 · 레코드 페이스 돌파 ${beat}/${T.sectors.length}</p><div class="arc-secs">${T.sectors.map((s) => `<div><b>${s.name}</b><span>목표 ${s.pace.toFixed(2)}초 · 내 최고 ${rec[s.name] ? `${rec[s.name].toFixed(2)}초${rec[s.name] <= s.pace ? ' ✓' : ''}` : '-'}</span>${TRIVIA[s.name] ? `<em>${TRIVIA[s.name]}</em>` : ''}</div>`).join('')}</div>`;
    },
    bindExtra(box) {
      this.onRank?.(box.querySelector('#gp-rank'));
      for (const b of box.querySelectorAll('button[data-s]')) {
        const c = b.querySelector('canvas'), g = c.getContext('2d');
        g.translate(44, 44); g.rotate(-0.5); if (b.disabled) g.globalAlpha = 0.25; drawSkin(g, b.dataset.s, 52);
        b.addEventListener('click', () => { if (b.disabled) return; skinStore.set(b.dataset.s); for (const x of box.querySelectorAll('button')) x.classList.toggle('on', x === b); });
      }
    },
    start(a) { reset(); a.setPads([{ id: 'l', label: '◀', cls: 'l wide' }, { id: 'b', label: '브레이크', cls: 'c c2' }, { id: 'r', label: '▶', cls: 'r wide' }], (id, v) => { S.input[id] = v; }); },
    key(k, down) { if (k === 'ArrowLeft') S.input.l = down; if (k === 'ArrowRight') S.input.r = down; if (k === 'ArrowDown' || k === ' ') S.input.b = down; },
    update(dt, a) {
      S.t += dt;
      if (S.t < 0) { const n = Math.min(5, Math.floor((S.t + 4.2) / 0.7)); if (n !== S.lights) { S.lights = n; a.hap?.play('tap'); } return; }
      if (S.lights !== -1) { S.lights = -1; a.hap?.play('select'); }
      const sub = 3, h = dt / sub;
      for (let k = 0; k < sub; k++) for (const c of S.cars) {
        if (c.me) {
          const st = (S.input.r ? 1 : 0) - (S.input.l ? 1 : 0);
          c.steer = D.lerp(c.steer, st, Math.min(1, h * 6));
          step(c, h, c.steer, c.done || S.input.b ? 0 : 1, S.input.b || c.done ? 1 : 0);
        } else {
          const look = pts[(c.i + Math.max(4, Math.round(c.sp / 5))) % N];
          let dh = Math.atan2(look[0] - c.x, -(look[1] - c.y)) - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          const target = prof[(c.i + 5) % N] * c.pace;
          step(c, h, D.clamp(dh * 3, -1, 1), !c.done && c.sp < target ? 1 : 0, c.done ? 1 : c.sp > target + 1.5 ? 0.85 : 0);
        }
      }
      for (let i = 0; i < S.cars.length; i++) for (let j = i + 1; j < S.cars.length; j++) {
        const A = S.cars[i], B = S.cars[j], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
        if (d < 4 && d > 0) { const p = (4 - d) / 2; A.x -= (dx / d) * p; A.y -= (dy / d) * p; B.x += (dx / d) * p; B.y += (dy / d) * p; if (A.me || B.me) a.hap?.play('tap'); }
      }
      // 고스트 기록(이번 랩, 0.1초 간격)
      S.recT += dt;
      if (S.recT >= 0.1) { S.recT -= 0.1; S.lapRec.push([Math.round(S.me.x * 10) / 10, Math.round(S.me.y * 10) / 10, Math.round(S.me.h * 100) / 100]); }
      const me = S.me, sec = T.sectors.find((s) => me.i >= s.a && me.i <= s.b);
      if (sec && (!S.sector || S.sector.s !== sec)) S.sector = { s: sec, t0: S.t };
      if (!sec && S.sector) {
        const s = S.sector.s, tt = S.t - S.sector.t0;
        if (tt > s.pace * 0.6) {
          const prev = S.rec[s.name], beat = tt <= s.pace;
          if (!prev || tt < prev) { S.rec[s.name] = tt; save('sectors', S.rec); }
          S.banner = `${s.name} ${tt.toFixed(2)}초 · 레코드 페이스 ${s.pace.toFixed(2)}초 ${beat ? '돌파!' : `+${(tt - s.pace).toFixed(2)}`}`; S.bannerT = 2.6;
          if (beat) { a.hap?.play('badge'); this.onSector?.(s.name); }
        }
        S.sector = null;
      }
      if (S.ghostBeat) { S.ghostBeat = false; this.onGhost?.(); }
      if (S.rivalBeat) { S.rivalBeat = false; this.onRival?.(); }
      if (S.lapDone) { const L = S.lapDone; S.lapDone = null; this.onLap?.(L.t, L.s); }
      S.bannerT -= dt;
      for (const c of S.cars) if (!c.done && c.lap >= LAPS) {
        c.done = S.t; S.finishOrder.push(c);
        if (c.me) {
          const wk = weeklyCircuit().key, wb = load('week', {});
          if (!wb[wk] || S.t < wb[wk]) { wb[wk] = S.t; save('week', wb); }
        }
        if (c.me) { const pos = S.finishOrder.length, champ = pos === 1, ft = S.t; setTimeout(() => a.finish({ score: Math.round(ft * 1000), win: champ, title: champ ? '한빛 그랑프리 월드 챔피언' : `${pos}위 완주`, detail: `${fmtT(ft)} · 최고 랩 ${me.best ? fmtT(me.best) : '-'} · 레코드 페이스 ${fmtT(T.lapPace)}${champ ? ' · 급식 1등!' : ''}` }), 1600); }
      }
      a.score(Math.round(S.t * 1000), `LAP ${Math.min(LAPS, me.lap + 1)}/${LAPS}`);
    },
    draw(g, W, H) {
      if (!S) reset();
      const me = S.me, zoom = D.clamp(3.2 - me.sp / 45, 1.3, 3.2);
      g.fillStyle = '#35602f'; g.fillRect(0, 0, W, H);
      g.save();
      g.translate(W / 2, H * 0.68); g.scale(zoom, zoom); g.rotate(-me.h); g.translate(-me.x, -me.y);
      const line = (w, c, dash) => { g.lineWidth = w; g.strokeStyle = c; g.lineJoin = 'round'; g.setLineDash(dash || []); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke(); g.setLineDash([]); };
      line(WIDTH + 12, '#c8b48a'); line(WIDTH + 2.4, '#f2f2f7'); line(WIDTH + 2.4, '#ff453a', [4, 4]); line(WIDTH, '#3a3a3c'); line(0.3, 'rgba(255,255,255,0.3)', [6, 8]);
      g.save(); g.translate(pts[0][0], pts[0][1]); g.rotate(head[0]);
      for (let k = 0; k < 10; k++) for (let r = 0; r < 2; r++) { g.fillStyle = (k + r) % 2 ? '#fff' : '#111'; g.fillRect(-WIDTH / 2 + k * (WIDTH / 10), -1 + r, WIDTH / 10, 1); }
      g.restore();
      // 고스트: 내 최고 랩을 같은 시간에 맞춰 반투명으로
      if (S.ghost?.s?.length && S.t > 0) {
        const k = Math.floor((S.t - me.lapStart) / 0.1), q = S.ghost.s[Math.min(k, S.ghost.s.length - 1)];
        if (q && k < S.ghost.s.length) { g.save(); g.translate(q[0], q[1]); g.rotate(q[2]); g.globalAlpha = 0.38; drawSkin(g, 'other', 5.4, '#e5e5ea'); g.restore(); g.globalAlpha = 1; }
      }
      for (const c of [...S.cars].sort((p, q) => (p.me ? 1 : 0) - (q.me ? 1 : 0))) {
        g.save(); g.translate(c.x, c.y); g.rotate(c.h);
        g.fillStyle = 'rgba(0,0,0,0.25)'; D.rr(g, -1.1, -2.4, 2.4, 5.2, 1); g.fill();
        drawSkin(g, c.me ? c.skin : 'other', 5.4, c.color);
        g.restore();
      }
      g.restore();
      if (S.t < 0.6) {
        const n = S.lights === -1 ? 0 : S.lights;
        D.rr(g, W / 2 - 110, 70, 220, 46, 12); g.fillStyle = 'rgba(0,0,0,0.75)'; g.fill();
        for (let k = 0; k < 5; k++) { g.fillStyle = k < n ? SYS.red : '#2c2c2e'; g.beginPath(); g.arc(W / 2 - 80 + k * 40, 93, 13, 0, Math.PI * 2); g.fill(); }
      }
      const order = [...S.cars].sort((p, q) => (p.done && q.done ? p.done - q.done : (q.done ? 1 : 0) - (p.done ? 1 : 0) || progress(q) - progress(p)));
      const lead = progress(order[0]), tx = W - 150, ty = 70;
      D.rr(g, tx, ty, 136, 22 + order.length * 22, 12); g.fillStyle = 'rgba(28,28,30,0.82)'; g.fill();
      D.text(g, `LAP ${Math.min(LAPS, me.lap + 1)}/${LAPS}`, tx + 12, ty + 16, { size: 10, weight: 700, color: SYS.text3 });
      order.forEach((c, k) => {
        const y = ty + 36 + k * 22;
        D.text(g, String(k + 1), tx + 14, y, { size: 12, weight: 700, color: SYS.text2, align: 'center', mono: true });
        g.fillStyle = c.color; g.fillRect(tx + 26, y - 10, 3, 12);
        D.text(g, c.name, tx + 36, y, { size: 12, weight: c.me ? 800 : 600, color: c.me ? SYS.text : SYS.text2 });
        D.text(g, k ? `+${((lead - progress(c)) / 60).toFixed(1)}` : '선두', tx + 126, y, { size: 11, color: SYS.text3, align: 'right', mono: true });
      });
      if (S.ghost?.t) D.text(g, `${S.rivalGhost?.name ? `${S.rivalGhost.name} ` : ''}고스트 ${fmtT(S.ghost.t)}`, 24, H - 196, { size: 11, weight: 600, color: SYS.text3 });
      D.text(g, `${Math.round(me.sp * 3.6)}`, 24, H - 150, { size: 40, weight: 300, mono: true });
      D.text(g, 'km/h', 24, H - 132, { size: 11, color: SYS.text3 });
      if (me.grass) D.text(g, '코스 밖', 24, H - 112, { size: 11, weight: 700, color: SYS.red });
      else if (me.slip > 0.5) D.text(g, '접지 한계', 24, H - 112, { size: 11, weight: 700, color: SYS.orange });
      const yb = 70 + (S.t < 0.6 ? 70 : 0);
      if (S.bannerT > 0) { g.globalAlpha = Math.min(1, S.bannerT); D.text(g, S.banner, W / 2, yb, { size: 13, weight: 700, align: 'center' }); g.globalAlpha = 1; }
      else if (T.names[me.i]) D.text(g, T.names[me.i], W / 2, yb, { size: 13, weight: 600, align: 'center', color: SYS.text2 });
    },
  };
}
