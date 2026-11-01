// 달력과 특별 에디션. 날짜를 옮기면 그날에 맞는 에디션이 펼쳐져요.
const $ = (id) => document.getElementById(id);
export const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

const ICON = {
  xmas: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l3 6 6 1-4.5 4 1 6.5L24 18l-5.5 3.5 1-6.5L15 11l6-1z" fill="#ffd34d"/><path d="M24 16l-9 12h5l-8 10h24l-8-10h5z" fill="#2f9e44"/><rect x="21" y="38" width="6" height="6" rx="1" fill="#8a5a3c"/><circle cx="20" cy="30" r="1.8" fill="#ff3b30"/><circle cx="28" cy="34" r="1.8" fill="#ffd60a"/><circle cx="27" cy="25" r="1.5" fill="#0a84ff"/></svg>',
  party: '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke-width="2.4" stroke-linecap="round"><g stroke="#ffc94a"><path d="M24 6v8M24 34v8M6 24h8M34 24h8"/></g><g stroke="#ff6fae"><path d="M11 11l5.5 5.5M31.5 31.5L37 37"/></g><g stroke="#5ac8fa"><path d="M37 11l-5.5 5.5M16.5 31.5L11 37"/></g><circle cx="24" cy="24" r="3.5" fill="#fff" stroke="none"/></svg>',
  suneung: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6h20v14a10 10 0 0 1-20 0z" fill="#ffc94a"/><path d="M14 10H8a6 6 0 0 0 6 8M34 10h6a6 6 0 0 1-6 8" fill="none" stroke="#ffc94a" stroke-width="2.5"/><rect x="21" y="29" width="6" height="7" fill="#e0a82e"/><rect x="15" y="36" width="18" height="5" rx="1.5" fill="#ffc94a"/><path d="M24 11l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff"/></svg>',
  exam: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="6" width="28" height="36" rx="4" fill="#fff" opacity=".9"/><path d="M16 16h16M16 23h16M16 30h10" stroke="#1d2b4f" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

export const EDITIONS = {
  xmas: {
    title: 'Christmas Edition', sub: '메리 크리스마스, 한빛!', icon: ICON.xmas,
    desc: '건물마다 반짝이는 조명과 지붕 위 눈, 크리스마스 트리, 루돌프 썰매, 선물상자 폭탄, 트리 로켓',
  },
  party: {
    title: '시험 끝! 축제의 날', sub: '수고했어요, 운동장에서 불꽃놀이가 열려요', icon: ICON.party,
    desc: '운동장 하늘을 수놓는 불꽃놀이. 밤으로 보면 더 예뻐요',
  },
  suneung: {
    title: '수능 응원 에디션', sub: '수험생 여러분, 오늘 최고의 하루가 되길', icon: ICON.suneung,
    desc: '수험생을 응원하는 금빛 리본과 응원 멘트',
  },
};

// 그 해(와 앞뒤 해)의 기념일·일정
export function buildEvents(cfg) {
  const map = new Map();
  const put = (d, ev) => { const k = key(d); if (!map.has(k)) map.set(k, []); map.get(k).push(ev); };
  for (const e of cfg.exams || []) {
    const s = parse(e.date), end = parse(e.end || e.date);
    for (let d = s; d <= end; d = addDays(d, 1)) put(d, { kind: 'exam', label: e.name });
    put(addDays(end, 1), { kind: 'party', label: `${e.name} 끝 · 불꽃놀이` });
  }
  for (const s of cfg.suneung || []) put(parse(s), { kind: 'suneung', label: '대학수학능력시험' });
  const y = new Date().getFullYear();
  for (const yy of [y - 1, y, y + 1, y + 2]) {
    put(new Date(yy, 11, 24), { kind: 'xmas', label: '크리스마스 이브' });
    put(new Date(yy, 11, 25), { kind: 'xmas', label: '크리스마스' });
  }
  for (const a of cfg.anniversaries || []) {
    const [m, d] = a.date.split('-').map(Number);
    for (const yy of [y - 1, y, y + 1, y + 2]) put(new Date(yy, m - 1, d), { kind: 'anniv', label: a.name });
  }
  return map;
}

export function editionFor(events, date) {
  const evs = events.get(key(date)) || [];
  for (const k of ['xmas', 'party', 'suneung']) if (evs.some((e) => e.kind === k)) return k;
  return null;
}

// 다음 수능까지 남은 날
export function nextSuneung(cfg, today) {
  const t = day0(today);
  const list = (cfg.suneung || []).map(parse).filter((d) => d >= t).sort((a, b) => a - b);
  if (!list.length) return null;
  return Math.round((list[0] - t) / 86400000);
}

export class CalendarUI {
  constructor({ cfg, events, getDate, onTravel }) {
    this.cfg = cfg;
    this.events = events;
    this.getDate = getDate;
    this.onTravel = onTravel;
    this.el = $('calendar');
    $('cal-prev').addEventListener('click', () => { this.view = new Date(this.view.getFullYear(), this.view.getMonth() - 1, 1); this.render(); });
    $('cal-next').addEventListener('click', () => { this.view = new Date(this.view.getFullYear(), this.view.getMonth() + 1, 1); this.render(); });
    $('cal-close').addEventListener('click', () => this.close());
    $('cal-go').addEventListener('click', () => { this.close(); this.onTravel(this.sel); });
    $('cal-today').addEventListener('click', () => { this.close(); this.onTravel(day0(new Date())); });
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
    for (const b of document.querySelectorAll('[data-jump]')) {
      b.addEventListener('click', () => {
        const d = this.jumpTo(b.dataset.jump);
        if (d) { this.sel = d; this.view = new Date(d.getFullYear(), d.getMonth(), 1); this.render(); }
      });
    }
  }

  // 빠른 이동: 가장 가까운 '시험 끝난 날', '수능', '크리스마스'
  jumpTo(kind) {
    const now = day0(new Date());
    // 계절 명소: 벚꽃(4월 초), 단풍(10월 말), 눈(1월 중순)
    const peaks = { spring: [3, 5], autumn: [9, 28], winter: [0, 15] };
    if (peaks[kind]) {
      const [m, d] = peaks[kind];
      let t = new Date(now.getFullYear(), m, d);
      if (t < now) t = new Date(now.getFullYear() + 1, m, d);
      return t;
    }
    const keys = [...this.events.entries()].filter(([, evs]) => evs.some((e) => e.kind === kind)).map(([k]) => parse(k)).sort((a, b) => a - b);
    return keys.find((d) => d >= now) || keys[keys.length - 1] || null;
  }

  open() {
    const d = this.getDate();
    this.sel = day0(d);
    this.view = new Date(d.getFullYear(), d.getMonth(), 1);
    this.render();
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('show'));
  }

  close() {
    this.el.classList.remove('show');
    setTimeout(() => { this.el.hidden = true; }, 280);
  }

  render() {
    const v = this.view;
    $('cal-title').textContent = `${v.getFullYear()}년 ${v.getMonth() + 1}월`;
    const grid = $('cal-grid');
    grid.innerHTML = '';
    for (const w of WEEK) {
      const h = document.createElement('div');
      h.className = 'cal-wd';
      h.textContent = w;
      grid.appendChild(h);
    }
    const first = new Date(v.getFullYear(), v.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    const realToday = key(new Date()), simDay = key(this.getDate()), sel = key(this.sel);
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const k = key(d);
      const evs = this.events.get(k) || [];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cal-day';
      if (d.getMonth() !== v.getMonth()) b.classList.add('out');
      if (k === realToday) b.classList.add('today');
      if (k === simDay) b.classList.add('here');
      if (k === sel) b.classList.add('sel');
      if (d.getDay() === 0) b.classList.add('sun');
      if (d.getDay() === 6) b.classList.add('sat');
      const kinds = [...new Set(evs.map((e) => e.kind))];
      b.innerHTML = `<span class="n">${d.getDate()}</span><span class="marks">${kinds.map((x) => `<i class="mk-${x}"></i>`).join('')}</span>`;
      b.setAttribute('aria-label', `${d.getMonth() + 1}월 ${d.getDate()}일${evs.length ? `, ${evs.map((e) => e.label).join(', ')}` : ''}`);
      b.addEventListener('click', () => { this.sel = d; this.render(); });
      grid.appendChild(b);
    }
    this.renderDetail();
  }

  renderDetail() {
    const d = this.sel;
    const evs = this.events.get(key(d)) || [];
    const ed = editionFor(this.events, d);
    const diff = Math.round((day0(d) - day0(new Date())) / 86400000);
    $('cal-date').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
    $('cal-rel').textContent = diff === 0 ? '오늘' : diff > 0 ? `오늘부터 ${diff}일 뒤` : `${-diff}일 전`;
    const list = $('cal-events');
    list.innerHTML = '';
    const m = d.getMonth() + 1;
    const season = m >= 3 && m <= 5 ? ['spring', '봄 · 벚꽃'] : m >= 6 && m <= 8 ? ['summer', '여름'] : m >= 9 && m <= 11 ? ['autumn', '가을 · 단풍'] : ['winter', '겨울 · 눈'];
    const sl = document.createElement('li');
    sl.className = `ev-season ev-${season[0]}`;
    sl.textContent = season[1];
    list.appendChild(sl);
    for (const e of evs) {
      const li = document.createElement('li');
      li.className = `ev-${e.kind}`;
      li.textContent = e.label;
      list.appendChild(li);
    }
    const box = $('cal-edition');
    if (ed) {
      const E = EDITIONS[ed];
      box.hidden = false;
      box.className = `cal-edition ed-${ed}`;
      box.innerHTML = `<div class="ed-icon">${E.icon}</div><div><b>${E.title}</b><span>${E.desc}</span></div>`;
    } else {
      box.hidden = !evs.length;
      box.className = 'cal-edition plain';
      box.innerHTML = evs.length ? '<div><span>이 날은 특별 에디션은 없지만 일정이 있어요.</span></div>' : '';
    }
    $('cal-go').textContent = ed ? `${EDITIONS[ed].title}로 이동` : '이 날로 이동';
  }
}

export { ICON };
