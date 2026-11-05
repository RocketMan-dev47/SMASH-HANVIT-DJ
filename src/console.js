// HASA 관제센터(개발자용 텔레메트리 대시보드)
import { localLog } from './telemetry.js';

const $ = (id) => document.getElementById(id);
const KEY = 'hasa-admin-key';
const TOOL = { bomb: '폭탄', bat: '배트', laser: '레이저', meteor: '운석', quake: '지진', landslide: '산사태', robodog: '로봇개', rocket: '로켓', nuke: '핵폭탄' };
const OPEN = { meal: '급식', bus: '버스', tt: '시간표', dday: 'D-day', 'lost-form': '분실물 등록', 'lost-view': '분실물 보기', cheer: '응원의 벽', dex: '도감', badges: '배지', info: '시설 안내', share: '공유 카드', fortune: '학습운세' };
const COLORS = ['#8fd3ff', '#ffc94a', '#ff9f43', '#34c759', '#ff6fae', '#bf8cff', '#5ac8fa', '#ff453a', '#a0e75a', '#ffd479'];

let cfg = {};
let rows = [];
let source = 'server';
let days = 7;
let timer = null;

async function loadConfig() {
  try { cfg = await (await fetch('config.json', { cache: 'no-store' })).json(); } catch { cfg = {}; }
}

const online = () => !!(cfg.supabaseUrl && cfg.supabaseKey);

async function fetchServer() {
  const key = localStorage.getItem(KEY);
  if (!key) throw new Error('nokey');
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const r = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/admin_events`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseKey, ...(String(cfg.supabaseKey).startsWith('sb_') ? {} : { Authorization: `Bearer ${cfg.supabaseKey}` }), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: key, p_since: since }),
  });
  if (r.status === 401 || r.status === 403 || r.status === 400) throw new Error('badkey');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).map((x) => ({ s: x.session, n: x.name, d: x.data || {}, t: x.at }));
}

function fetchLocal() {
  const since = Date.now() - days * 86400000;
  return localLog().filter((e) => Date.parse(e.t) >= since);
}

function status(text, on = true) {
  $('status').className = on ? '' : 'off';
  $('status').querySelector('span').textContent = text;
}

// 건의함(서버는 관리자 키, 아니면 이 기기)
async function loadSuggestions() {
  let list = [];
  if (source === 'server' && online()) {
    try {
      const r = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/admin_suggestions`, { method: 'POST', headers: { apikey: cfg.supabaseKey, ...(String(cfg.supabaseKey).startsWith('sb_') ? {} : { Authorization: `Bearer ${cfg.supabaseKey}` }), 'Content-Type': 'application/json' }, body: JSON.stringify({ p_key: localStorage.getItem(KEY) || '' }) });
      if (r.ok) list = (await r.json()).map((x) => ({ kind: x.kind, text: x.text, grade: x.grade, at: x.created_at }));
    } catch { /* 무시 */ }
  } else {
    try { list = JSON.parse(localStorage.getItem('smash-suggest') || '[]').reverse(); } catch { list = []; }
  }
  const K = { feature: '기능', place: '학교 사물', bug: '버그', etc: '기타' };
  $('sgCount').textContent = `${list.length}건`;
  $('tSuggest').innerHTML = list.length
    ? `<tr><th>날짜</th><th>종류</th><th>학년</th><th>내용</th></tr>${list.map((x) => `<tr><td>${new Date(x.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td><span class="tag ${x.kind === 'bug' ? 'error' : 'badge'}">${K[x.kind] || x.kind}</span></td><td>${x.grade ? `${x.grade}학년` : '-'}</td><td>${esc(x.text)}</td></tr>`).join('')}`
    : '<tr><td class="empty">아직 건의가 없어요</td></tr>';
}

async function load() {
  try {
    if (source === 'server') {
      if (!online()) { status('서버 미설정 · 이 기기 기록을 보여줘요', false); source = 'local'; segOn('src', 'local'); }
    }
    rows = source === 'server' ? await fetchServer() : fetchLocal();
    $('gate').hidden = true;
    $('dash').hidden = false;
    status(`${source === 'server' ? '서버' : '이 기기'} · 이벤트 ${rows.length.toLocaleString('ko-KR')}개 · ${new Date().toLocaleTimeString('ko-KR')} 갱신`);
    render();
    loadSuggestions();
  } catch (e) {
    if (e.message === 'nokey' || e.message === 'badkey') {
      $('dash').hidden = true;
      $('gate').hidden = false;
      $('gateMsg').textContent = e.message === 'badkey' ? '키가 맞지 않아요.' : '';
      status('잠김', false);
    } else status(`불러오기 실패: ${e.message}`, false);
  }
}

// ---------- 집계 ----------
const count = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (k === undefined || k === null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };

function sessions() {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.s)) m.set(r.s, { id: r.s, events: [], start: null, end: null, info: {}, sum: {} });
    const s = m.get(r.s);
    s.events.push(r);
    if (r.n === 'session_start') s.info = r.d;
    if (r.n === 'session_end') s.sum = r.d;
  }
  for (const s of m.values()) {
    s.events.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    s.start = Date.parse(s.events[0].t);
    s.end = Date.parse(s.events[s.events.length - 1].t);
    s.sec = s.sum.sec || Math.round((s.end - s.start) / 1000);
  }
  return [...m.values()].sort((a, b) => b.start - a.start);
}

// ---------- 그리기 ----------
function ctx(id) {
  const c = $(id), dpr = Math.min(2, devicePixelRatio || 1);
  const W = c.clientWidth, H = Number(c.getAttribute('height'));
  c.width = W * dpr; c.height = H * dpr; c.style.height = `${H}px`;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.font = '600 11px Pretendard Variable, sans-serif';
  return { g, W, H };
}

function hbars(id, data, fmt = (v) => v.toLocaleString('ko-KR')) {
  const { g, W, H } = ctx(id);
  if (!data.length) { g.fillStyle = 'rgba(238,243,255,0.45)'; g.fillText('기록 없음', 8, 20); return; }
  const top = data.slice(0, 10), max = top[0][1], rowH = Math.min(24, (H - 4) / top.length), lw = 92;
  top.forEach(([k, v], i) => {
    const y = 4 + i * rowH;
    g.fillStyle = 'rgba(238,243,255,0.75)';
    g.fillText(String(k).slice(0, 12), 0, y + rowH * 0.65);
    g.fillStyle = COLORS[i % COLORS.length];
    const w = Math.max(2, ((W - lw - 46) * v) / max);
    g.beginPath(); g.roundRect(lw, y + 3, w, rowH - 8, 4); g.fill();
    g.fillStyle = 'rgba(238,243,255,0.9)';
    g.fillText(fmt(v), lw + w + 6, y + rowH * 0.65);
  });
}

function daily(id, sess) {
  const { g, W, H } = ctx(id);
  const n = Math.min(days, 30), today = new Date(); today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: n }, (_, i) => ({ d: new Date(today.getTime() - (n - 1 - i) * 86400000), c: 0, sec: 0 }));
  for (const s of sess) {
    const i = Math.floor((s.start - buckets[0].d.getTime()) / 86400000);
    if (i >= 0 && i < n) { buckets[i].c++; buckets[i].sec += s.sec; }
  }
  const max = Math.max(1, ...buckets.map((b) => b.c)), maxM = Math.max(1, ...buckets.map((b) => (b.c ? b.sec / b.c / 60 : 0)));
  const bw = (W - 20) / n, base = H - 22;
  buckets.forEach((b, i) => {
    const h = ((base - 10) * b.c) / max, x = 10 + i * bw;
    g.fillStyle = '#8fd3ff';
    g.beginPath(); g.roundRect(x + bw * 0.15, base - h, bw * 0.7, h, 3); g.fill();
    if (n <= 14 || i % 3 === 0) { g.fillStyle = 'rgba(238,243,255,0.5)'; g.fillText(`${b.d.getMonth() + 1}/${b.d.getDate()}`, x + 2, H - 6); }
    if (b.c && n <= 14) { g.fillStyle = '#fff'; g.fillText(b.c, x + bw * 0.35, base - h - 4); }
  });
  g.strokeStyle = '#ffc94a'; g.lineWidth = 2; g.beginPath();
  buckets.forEach((b, i) => { const m = b.c ? b.sec / b.c / 60 : 0, x = 10 + i * bw + bw / 2, y = base - ((base - 10) * m) / maxM; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
}

function donut(id, legendId, data) {
  const { g, W, H } = ctx(id);
  const total = data.reduce((a, [, v]) => a + v, 0);
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 8;
  let a = -Math.PI / 2;
  data.forEach(([, v], i) => {
    const da = total ? (v / total) * Math.PI * 2 : 0;
    g.fillStyle = COLORS[i % COLORS.length];
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a, a + da); g.fill();
    a += da;
  });
  g.fillStyle = '#071330'; g.beginPath(); g.arc(cx, cy, R * 0.58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '800 22px Pretendard Variable, sans-serif'; g.textAlign = 'center';
  g.fillText(total, cx, cy + 4); g.font = '600 11px Pretendard Variable, sans-serif'; g.fillStyle = 'rgba(238,243,255,0.5)'; g.fillText('세션', cx, cy + 20); g.textAlign = 'left';
  $(legendId).innerHTML = data.map(([k, v], i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${k} ${total ? Math.round((v / total) * 100) : 0}%</span>`).join('');
}

function heat(id, sess) {
  const { g, W, H } = ctx(id);
  const D = ['일', '월', '화', '수', '목', '금', '토'];
  const m = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const s of sess) { const d = new Date(s.start); m[d.getDay()][d.getHours()]++; }
  const max = Math.max(1, ...m.flat()), cw = (W - 26) / 24, ch = (H - 18) / 7;
  for (let d = 0; d < 7; d++) {
    g.fillStyle = 'rgba(238,243,255,0.5)'; g.fillText(D[d], 2, 12 + d * ch + ch / 2);
    for (let h = 0; h < 24; h++) {
      const v = m[d][h] / max;
      g.fillStyle = v ? `rgba(143,211,255,${0.12 + v * 0.88})` : 'rgba(255,255,255,0.04)';
      g.beginPath(); g.roundRect(24 + h * cw + 1, 2 + d * ch + 1, cw - 2, ch - 2, 3); g.fill();
    }
  }
  g.fillStyle = 'rgba(238,243,255,0.45)';
  for (const h of [0, 6, 12, 18, 23]) g.fillText(`${h}시`, 24 + h * cw, H - 2);
}

function fpsHist(id) {
  const vals = rows.filter((r) => r.n === 'fps').map((r) => r.d.avg || 0);
  const b = [['<20', 0], ['20-30', 0], ['30-45', 0], ['45-55', 0], ['55+', 0]];
  for (const v of vals) b[v < 20 ? 0 : v < 30 ? 1 : v < 45 ? 2 : v < 55 ? 3 : 4][1]++;
  const { g, W, H } = ctx(id);
  const max = Math.max(1, ...b.map((x) => x[1])), bw = W / 5;
  const col = ['#ff453a', '#ff9f43', '#ffc94a', '#a0e75a', '#34c759'];
  b.forEach(([k, v], i) => {
    const h = ((H - 40) * v) / max;
    g.fillStyle = col[i]; g.beginPath(); g.roundRect(i * bw + bw * 0.18, H - 24 - h, bw * 0.64, h, 4); g.fill();
    g.fillStyle = 'rgba(238,243,255,0.6)'; g.fillText(k, i * bw + bw * 0.25, H - 8);
    if (v) { g.fillStyle = '#fff'; g.fillText(v, i * bw + bw * 0.42, H - 28 - h); }
  });
  return vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : null;
}

// ---------- 화면 ----------
function render() {
  const sess = sessions();
  const by = (n) => rows.filter((r) => r.n === n);
  const avgMin = sess.length ? sess.reduce((a, s) => a + s.sec, 0) / sess.length / 60 : 0;
  const errs = by('error');
  const fpsAvg = fpsHist('cFps');
  const scores = sess.map((s) => s.sum.score).filter((v) => v > 0);
  $('span').textContent = `최근 ${days >= 3650 ? '전체' : `${days}일`}`;
  const kpi = [
    ['세션', sess.length, `오늘 ${sess.filter((s) => new Date(s.start).toDateString() === new Date().toDateString()).length}`],
    ['평균 플레이', `${avgMin.toFixed(1)}분`, `최장 ${Math.round(Math.max(0, ...sess.map((s) => s.sec)) / 60)}분`],
    ['무기 사용', by('tool').length.toLocaleString('ko-KR'), `세션당 ${sess.length ? (by('tool').length / sess.length).toFixed(1) : 0}회`],
    ['무너진 건물', by('collapse').length.toLocaleString('ko-KR'), ''],
    ['최고 점수', scores.length ? Math.max(...scores).toLocaleString('ko-KR') : '-', scores.length ? `평균 ${Math.round(scores.reduce((a, v) => a + v, 0) / scores.length).toLocaleString('ko-KR')}` : ''],
    ['배지 획득', by('badge').length, ''],
    ['도감 발견', by('dex').length, ''],
    ['오류', errs.length, errs.length ? '아래 로그 확인' : '깨끗해요'],
    ['평균 FPS', fpsAvg ?? '-', ''],
  ];
  $('kpis').innerHTML = kpi.map(([k, v, s]) => `<div class="kpi"><span>${k}</span><b>${v}</b><small>${s}</small></div>`).join('');
  daily('cDaily', sess);
  donut('cDevice', 'lDevice', count(sess, (s) => ({ phone: '폰', tablet: '패드', desktop: 'PC' }[s.info.device] || '알 수 없음')));
  heat('cHeat', sess);
  hbars('cTools', count(by('tool'), (r) => TOOL[r.d.id] || r.d.id));
  hbars('cOpen', count(by('open'), (r) => OPEN[r.d.id] || r.d.id));
  hbars('cBldg', count(by('collapse'), (r) => r.d.b));
  hbars('cBadge', count(by('badge'), (r) => r.d.id));
  hbars('cDex', count(by('dex'), (r) => r.d.id));
  hbars('cPref', [
    ...count(by('mode'), (r) => (r.d.smash ? '→ SMASH' : '→ 둘러보기')),
    ...count(by('sky'), (r) => (r.d.time ? `시간 ${r.d.time}` : `날씨 ${r.d.weather}`)),
    ...count(by('interact'), (r) => `모드 ${r.d.m}`),
  ].sort((a, b) => b[1] - a[1]));
  // 오류(같은 메시지·위치끼리 묶기)
  const eg = new Map();
  for (const e of errs) { const k = `${e.d.msg}|${e.d.at}`; const x = eg.get(k) || { msg: e.d.msg, at: e.d.at, c: 0, last: 0, sess: new Set() }; x.c++; x.last = Math.max(x.last, Date.parse(e.t)); x.sess.add(e.s); eg.set(k, x); }
  $('errCount').textContent = `${errs.length}건`;
  $('tErr').innerHTML = errs.length
    ? `<tr><th>메시지</th><th>위치</th><th>횟수</th><th>세션</th><th>마지막</th></tr>${[...eg.values()].sort((a, b) => b.c - a.c).map((x) => `<tr><td><code>${esc(x.msg)}</code></td><td><code>${esc(x.at)}</code></td><td>${x.c}</td><td>${x.sess.size}</td><td>${new Date(x.last).toLocaleString('ko-KR')}</td></tr>`).join('')}`
    : '<tr><td class="empty">오류가 없어요 🎉</td></tr>';
  // 세션 목록
  $('tSess').innerHTML = `<tr><th>시작</th><th>기기</th><th>시간</th><th>이벤트</th><th>점수</th><th>등급</th></tr>${sess.slice(0, 200).map((s) => `<tr class="click" data-s="${s.id}"><td>${new Date(s.start).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td>${s.info.device || '-'}</td><td>${Math.round(s.sec / 60)}분</td><td>${s.events.length}</td><td>${(s.sum.score || 0).toLocaleString('ko-KR')}</td><td>${s.sum.grade || '-'}</td></tr>`).join('')}`;
  for (const tr of $('tSess').querySelectorAll('tr.click')) tr.addEventListener('click', () => openSession(sess.find((s) => s.id === tr.dataset.s)));
  // 실시간 이벤트
  const live = [...rows].sort((a, b) => Date.parse(b.t) - Date.parse(a.t)).slice(0, 150);
  $('tLive').innerHTML = `<tr><th>시각</th><th>세션</th><th>이벤트</th><th>내용</th></tr>${live.map((r) => `<tr class="click" data-s="${r.s}"><td>${new Date(r.t).toLocaleTimeString('ko-KR')}</td><td><code>${r.s.slice(0, 6)}</code></td><td><span class="tag ${r.n}">${r.n}</span></td><td><code>${esc(JSON.stringify(r.d))}</code></td></tr>`).join('')}`;
  for (const tr of $('tLive').querySelectorAll('tr.click')) tr.addEventListener('click', () => openSession(sess.find((s) => s.id === tr.dataset.s)));
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function openSession(s) {
  if (!s) return;
  $('dTitle').textContent = `세션 ${s.id.slice(0, 8)}`;
  $('dSub').textContent = `${new Date(s.start).toLocaleString('ko-KR')} · ${s.info.device || '-'} · ${s.info.screen || ''} · ${Math.round(s.sec / 60)}분 · 이벤트 ${s.events.length}개`;
  $('dTable').innerHTML = `<tr><th>+시간</th><th>이벤트</th><th>내용</th></tr>${s.events.map((r) => `<tr><td>+${Math.round((Date.parse(r.t) - s.start) / 1000)}초</td><td><span class="tag ${r.n}">${r.n}</span></td><td><code>${esc(JSON.stringify(r.d))}</code></td></tr>`).join('')}`;
  $('drawer').classList.add('open');
}

function csv() {
  const lines = ['time,session,event,data', ...rows.map((r) => [r.t, r.s, r.n, JSON.stringify(r.d).replace(/"/g, '""')].map((v, i) => (i === 3 ? `"${v}"` : v)).join(','))];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv' }));
  a.download = `hasa-telemetry-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function segOn(id, v) { for (const b of $(id).querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === String(v)); }

function wire() {
  for (const b of $('src').querySelectorAll('button')) b.addEventListener('click', () => { source = b.dataset.v; segOn('src', source); load(); });
  for (const b of $('range').querySelectorAll('button')) b.addEventListener('click', () => { days = Number(b.dataset.v); segOn('range', days); load(); });
  $('refresh').addEventListener('click', load);
  $('csv').addEventListener('click', csv);
  $('logout').addEventListener('click', () => { localStorage.removeItem(KEY); source = 'server'; segOn('src', 'server'); load(); });
  $('keyGo').addEventListener('click', () => { localStorage.setItem(KEY, $('key').value.trim()); $('key').value = ''; load(); });
  $('key').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('keyGo').click(); });
  $('useLocal').addEventListener('click', () => { source = 'local'; segOn('src', 'local'); load(); });
  $('drawerClose').addEventListener('click', () => $('drawer').classList.remove('open'));
  $('auto').addEventListener('change', () => setAuto($('auto').checked));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') $('drawer').classList.remove('open'); });
  addEventListener('resize', () => { if (!$('dash').hidden) render(); });
}

function setAuto(on) { clearInterval(timer); if (on) timer = setInterval(load, 30000); }

await loadConfig();
wire();
setAuto(true);
load();
