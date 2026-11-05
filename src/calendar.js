// 달력과 특별 에디션. 날짜를 옮기면 그날에 맞는 에디션이 펼쳐져요.
const $ = (id) => document.getElementById(id);
const key2 = (d) => key(d);
export const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

const ICON = {
  newyear: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="22" r="4" fill="#ffd700"/><path d="M24 6v8M24 30v8M8 22h8M32 22h8M13 11l5 5M30 28l5 5M35 11l-5 5M18 28l-5 5" stroke="#ff6b6b" stroke-width="3" stroke-linecap="round"/></svg>',
  seollal: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 18h20l-3 22H17z" fill="#d63a4a"/><path d="M16 18q8-8 16 0" fill="none" stroke="#f3b33d" stroke-width="3"/><circle cx="24" cy="29" r="4" fill="#f3b33d"/></svg>',
  chuseok: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="22" r="14" fill="#ffe08a"/><circle cx="19" cy="18" r="3" fill="#f5cf6a"/><circle cx="29" cy="26" r="2" fill="#f5cf6a"/><path d="M8 42h32" stroke="#7a4a12" stroke-width="3"/></svg>',
  valentine: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 40L9 25a8 8 0 0 1 15-9 8 8 0 0 1 15 9z" fill="#ff5d8f"/></svg>',
  whiteday: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="10" fill="#e8f3ff" stroke="#2f6fe0" stroke-width="2"/><path d="M14 24l-8-5v10zM34 24l8-5v10z" fill="#bfe3ff"/></svg>',
  samil: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="12" width="36" height="24" rx="2" fill="#fff" stroke="#ccc"/><circle cx="24" cy="24" r="6" fill="#c8102e"/><path d="M18 24a6 6 0 0 0 12 0z" fill="#1f3d8a"/></svg>',
  gwangbok: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="12" width="36" height="24" rx="2" fill="#fff" stroke="#ccc"/><circle cx="24" cy="24" r="6" fill="#c8102e"/><path d="M18 24a6 6 0 0 0 12 0z" fill="#1f3d8a"/><path d="M24 4v6" stroke="#ffd700" stroke-width="3"/></svg>',
  arbor: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 42V24" stroke="#7a5230" stroke-width="3"/><path d="M24 26c-10 0-12-10-12-14 8 0 12 6 12 14zM24 22c0-8 6-14 14-14 0 6-4 14-14 14z" fill="#4caf50"/></svg>',
  earth: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="#3a8fd6"/><path d="M14 18c4-2 6 2 10 0s4 6 0 8-8 0-10-2zM28 30c3 0 6 2 6 4" fill="#5ac85a" stroke="#5ac85a" stroke-width="2"/></svg>',
  students: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 8v32" stroke="#555" stroke-width="3"/><path d="M12 10h26l-6 7 6 7H12z" fill="#1f3d8a"/><path d="M12 15h20" stroke="#ffc94a" stroke-width="3"/></svg>',
  dongji: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 10a14 14 0 1 0 8 22A12 12 0 0 1 30 10z" fill="#5a4d9e"/><circle cx="16" cy="36" r="5" fill="#9b2f2f"/><circle cx="24" cy="38" r="4" fill="#b84040"/></svg>',
  parents: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 40V26" stroke="#3f8a3a" stroke-width="3"/><circle cx="24" cy="18" r="10" fill="#ff8fb1"/><circle cx="19" cy="15" r="5" fill="#ffc2d4"/><circle cx="29" cy="15" r="5" fill="#ffc2d4"/><circle cx="24" cy="22" r="5" fill="#ffc2d4"/><circle cx="12" cy="34" r="6" fill="#fff" opacity=".9"/><circle cx="36" cy="34" r="6" fill="#fff" opacity=".9"/></svg>',
  halloween: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="28" rx="16" ry="13" fill="#ff8a1f"/><path d="M24 15c0-4 2-7 5-8" stroke="#3f8a3a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M15 25l5-3 1 5zM33 25l-5-3-1 5zM16 32q8 6 16 0l-3 1-2-2-3 2-3-2-2 2z" fill="#2a1600"/></svg>',
  stickday: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="6" width="6" height="36" rx="3" fill="#e9c58b"/><rect x="13" y="6" width="6" height="24" rx="3" fill="#6b3a1e"/><rect x="29" y="6" width="6" height="36" rx="3" fill="#e9c58b"/><rect x="29" y="6" width="6" height="24" rx="3" fill="#6b3a1e"/></svg>',
  hangul: '<svg viewBox="0 0 48 48" aria-hidden="true"><text x="24" y="33" text-anchor="middle" font-size="24" font-weight="800" fill="#fff">한</text><rect x="6" y="6" width="36" height="36" rx="8" fill="none" stroke="#ffc94a" stroke-width="2.5"/></svg>',
  teachers: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 40V24" stroke="#3f8a3a" stroke-width="3"/><circle cx="24" cy="18" r="9" fill="#e8344a"/><circle cx="20" cy="16" r="4" fill="#ff6b7d"/><circle cx="28" cy="16" r="4" fill="#ff6b7d"/><circle cx="24" cy="21" r="4" fill="#ff6b7d"/><path d="M24 32c-4-4-9-3-10 0 3 1 7 1 10 0z" fill="#3f8a3a"/></svg>',
  anniv: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="22" width="28" height="18" rx="3" fill="#ffc94a"/><rect x="10" y="22" width="28" height="5" fill="#ff8fb1"/><path d="M18 22v-6M24 22v-6M30 22v-6" stroke="#fff" stroke-width="2.5"/><path d="M18 14c1-2 1-3 0-5M24 14c1-2 1-3 0-5M30 14c1-2 1-3 0-5" stroke="#ff8a1f" stroke-width="2.5" fill="none"/></svg>',
  science: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="4" fill="#ffc94a"/><g fill="none" stroke="#8fd3ff" stroke-width="2.4"><ellipse cx="24" cy="24" rx="17" ry="7"/><ellipse cx="24" cy="24" rx="17" ry="7" transform="rotate(60 24 24)"/><ellipse cx="24" cy="24" rx="17" ry="7" transform="rotate(-60 24 24)"/></g></svg>',
  entrance: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#ffb7cf"><circle cx="24" cy="14" r="6"/><circle cx="14" cy="22" r="6"/><circle cx="34" cy="22" r="6"/><circle cx="18" cy="33" r="6"/><circle cx="30" cy="33" r="6"/></g><circle cx="24" cy="24" r="4" fill="#fff3a8"/></svg>',
  graduation: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 18l20-9 20 9-20 9z" fill="#1d2433" stroke="#ffc94a" stroke-width="1.5"/><path d="M13 23v8c6 5 16 5 22 0v-8" fill="#1d2433"/><path d="M40 19v12" stroke="#ffc94a" stroke-width="2.5"/><circle cx="40" cy="33" r="2.5" fill="#ffc94a"/></svg>',
  sports: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 12q18 10 36 0" stroke="#fff" stroke-width="1.5" fill="none"/><path d="M10 14l3 7 3-5zM18 17l3 7 3-6zM26 17l3 6 3-7zM34 15l3 6 2-8z" fill="#ffc94a"/><path d="M14 30h20" stroke="#e8452c" stroke-width="4" stroke-linecap="round"/><path d="M14 38h20" stroke="#2f6fe0" stroke-width="4" stroke-linecap="round"/></svg>',
  festival: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 40h32v-6H8z" fill="#8a5cf0"/><path d="M14 34L6 8M24 34V6M34 34l8-26" stroke="#ff6fae" stroke-width="2.5" stroke-linecap="round" opacity=".9"/><circle cx="24" cy="24" r="3" fill="#fff"/></svg>',
  children: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="17" cy="17" rx="8" ry="10" fill="#ff6b7d"/><ellipse cx="31" cy="15" rx="8" ry="10" fill="#5ac8fa"/><path d="M17 27l3 15M31 25l-3 17" stroke="#fff" stroke-width="1.5"/></svg>',
  aprilfools: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="#ffc94a"/><circle cx="18" cy="20" r="2.5" fill="#2a1600"/><path d="M28 20h5" stroke="#2a1600" stroke-width="2.5" stroke-linecap="round"/><path d="M16 29q8 7 16 0" stroke="#2a1600" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M27 31q2 6 6 2" fill="#ff6b7d"/></svg>',
  firstsnow: '<svg viewBox="0 0 48 48" aria-hidden="true"><g stroke="#e8f4ff" stroke-width="2.6" stroke-linecap="round"><path d="M24 6v36M8.4 15l31.2 18M8.4 33l31.2-18"/><path d="M20 9l4 4 4-4M20 39l4-4 4 4"/></g></svg>',
  xmas: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l3 6 6 1-4.5 4 1 6.5L24 18l-5.5 3.5 1-6.5L15 11l6-1z" fill="#ffd34d"/><path d="M24 16l-9 12h5l-8 10h24l-8-10h5z" fill="#2f9e44"/><rect x="21" y="38" width="6" height="6" rx="1" fill="#8a5a3c"/><circle cx="20" cy="30" r="1.8" fill="#ff3b30"/><circle cx="28" cy="34" r="1.8" fill="#ffd60a"/><circle cx="27" cy="25" r="1.5" fill="#0a84ff"/></svg>',
  party: '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke-width="2.4" stroke-linecap="round"><g stroke="#ffc94a"><path d="M24 6v8M24 34v8M6 24h8M34 24h8"/></g><g stroke="#ff6fae"><path d="M11 11l5.5 5.5M31.5 31.5L37 37"/></g><g stroke="#5ac8fa"><path d="M37 11l-5.5 5.5M16.5 31.5L11 37"/></g><circle cx="24" cy="24" r="3.5" fill="#fff" stroke="none"/></svg>',
  suneung: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6h20v14a10 10 0 0 1-20 0z" fill="#ffc94a"/><path d="M14 10H8a6 6 0 0 0 6 8M34 10h6a6 6 0 0 1-6 8" fill="none" stroke="#ffc94a" stroke-width="2.5"/><rect x="21" y="29" width="6" height="7" fill="#e0a82e"/><rect x="15" y="36" width="18" height="5" rx="1.5" fill="#ffc94a"/><path d="M24 11l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff"/></svg>',
  exam: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="6" width="28" height="36" rx="4" fill="#fff" opacity=".9"/><path d="M16 16h16M16 23h16M16 30h10" stroke="#1d2b4f" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

export const EDITIONS = {
  halloween: { title: 'Halloween Edition', sub: '한빛에 호박등이 켜졌어요', icon: ICON.halloween, desc: '길가의 잭오랜턴, 떠다니는 유령, 보랏빛 밤, 폭탄에서 사탕' },
  stickday: { title: '11·11 막대과자 데이', sub: '고마운 친구에게 하나씩', icon: ICON.stickday, desc: '운동장의 거대한 막대과자 11, 폭탄에서 막대과자' },
  anniv: { title: '개교기념일', sub: '한빛의 생일을 축하해요', icon: ICON.anniv, desc: '밤하늘 드론 300대가 한빛 → 주년 → 하트로 변신' },
  teachers: { title: '스승의 날', sub: '선생님 감사합니다', icon: ICON.teachers, desc: '본관 창가 카네이션, 응원의 벽이 감사 편지 벽으로' },
  sports: { title: '한빛 체육대회', sub: '오늘은 학년 대항 점수 2배!', icon: ICON.sports, desc: '운동장 만국기, 학년 대항 점수 2배' },
  festival: { title: '한빛 축제', sub: '무대 조명이 켜졌어요', icon: ICON.festival, desc: '문화관 쪽 무대, 밤하늘 레이저 쇼' },
  entrance: { title: '입학식', sub: '새내기 여러분 환영해요', icon: ICON.entrance, desc: '정문 벚꽃 아치와 흩날리는 꽃잎' },
  graduation: { title: '졸업식', sub: '졸업을 진심으로 축하해요', icon: ICON.graduation, desc: '운동장에서 학사모가 하늘로 날아올라요' },
  hangul: { title: '한글날', sub: '우리 글자를 기려요', icon: ICON.hangul, desc: '이름표가 명조체로, 폭발하면 자음·모음 블록' },
  newyear: { title: '새해 첫날', sub: '새해 복 많이 받으세요', icon: ICON.newyear, desc: '금빛 꽃가루와 수시로 터지는 불꽃' },
  seollal: { title: '설날', sub: '연 날리고 복주머니 챙기기', icon: ICON.seollal, desc: '하늘을 나는 연, 복주머니, 색동 꽃가루' },
  chuseok: { title: '추석', sub: '풍성한 한가위', icon: ICON.chuseok, desc: '커다란 보름달과 길가의 청사초롱' },
  valentine: { title: '발렌타인데이', sub: '달콤한 하루', icon: ICON.valentine, desc: '하트가 흩날려요' },
  whiteday: { title: '화이트데이', sub: '사탕 같은 하루', icon: ICON.whiteday, desc: '알록달록 사탕이 흩날려요' },
  samil: { title: '삼일절', sub: '대한독립 만세', icon: ICON.samil, desc: '길을 따라 태극기' },
  gwangbok: { title: '광복절', sub: '빛을 되찾은 날', icon: ICON.gwangbok, desc: '길을 따라 태극기' },
  arbor: { title: '식목일', sub: '나무 한 그루', icon: ICON.arbor, desc: '운동장 둘레의 묘목과 초록 잎' },
  earth: { title: '지구의 날', sub: '지구를 위한 하루', icon: ICON.earth, desc: '초록 잎이 흩날려요' },
  students: { title: '학생의 날', sub: '학생독립운동기념일', icon: ICON.students, desc: '길을 따라 한빛 깃발' },
  dongji: { title: '동지', sub: '일 년 중 가장 긴 밤', icon: ICON.dongji, desc: '팥알처럼 붉은 알갱이와 깊은 밤' },
  parents: { title: '어버이날', sub: '폭닥폭닥, 고마운 마음을 전해요', icon: ICON.parents, desc: '솜뭉치 구름과 동물 가족 행렬, 건물 속 부모님께 쓰는 쪽지' },
  children: { title: '어린이날', sub: '오늘은 학교도 말랑말랑', icon: ICON.children, desc: '젤리처럼 출렁이는 건물과 풍선' },
  aprilfools: { title: '만우절', sub: '오늘 학교는 젤리로 지었대요', icon: ICON.aprilfools, desc: '말랑말랑 출렁이는 학교' },
  science: { title: '과학의 날', sub: 'HASA 특별 임무 발사', icon: ICON.science, desc: 'HASA 로켓이 특별 미션 패치를 달고 자동 발사' },
  firstsnow: { title: '첫눈', sub: '올겨울 첫눈이 와요', icon: ICON.firstsnow, desc: '실제 대전에 첫눈이 오면 열려요 · 눈사람 2배' },
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
  // config.json의 events: [{ "date": "2026-12-08", "end": "2026-12-11", "name": "기말고사", "kind": "exam" }]
  for (const e of cfg.events || []) {
    const s0 = parse(e.date), e0 = parse(e.end || e.date);
    // kind가 sports·festival·graduation·entrance면 그날은 특별 에디션도 열려요.
    const special = ['sports', 'festival', 'graduation', 'entrance'].includes(e.kind);
    for (let d = s0; d <= e0; d = addDays(d, 1)) {
      put(d, { kind: e.kind === 'exam' ? 'exam' : 'school', label: e.name });
      if (special) put(d, { kind: e.kind, label: e.name, ed: true });
    }
  }
  const y = new Date().getFullYear();
  for (const yy of [y - 1, y, y + 1, y + 2]) {
    put(new Date(yy, 11, 24), { kind: 'xmas', label: '크리스마스 이브' });
    put(new Date(yy, 11, 25), { kind: 'xmas', label: '크리스마스' });
  }
  // 해마다 같은 날 열리는 에디션
  const yearly = [['10-31', 'halloween', '할로윈'], ['11-11', 'stickday', '막대과자 데이'], ['10-09', 'hangul', '한글날'], ['05-15', 'teachers', '스승의 날'], ['05-05', 'children', '어린이날'], ['05-08', 'parents', '어버이날'], ['04-01', 'aprilfools', '만우절'], ['04-21', 'science', '과학의 날'], ['01-01', 'newyear', '새해 첫날'], ['02-14', 'valentine', '발렌타인데이'], ['03-14', 'whiteday', '화이트데이'], ['03-01', 'samil', '삼일절'], ['08-15', 'gwangbok', '광복절'], ['04-05', 'arbor', '식목일'], ['04-22', 'earth', '지구의 날'], ['11-03', 'students', '학생의 날'], ['12-22', 'dongji', '동지'], [cfg.founding || cfg.anniversary || '04-08', 'anniv', '개교기념일'], [cfg.entrance || '03-02', 'entrance', '입학식']];
  if (cfg.graduation) yearly.push([cfg.graduation, 'graduation', '졸업식']);
  if (cfg.sportsDay) yearly.push([cfg.sportsDay, 'sports', '체육대회']);
  if (cfg.festival) yearly.push([cfg.festival, 'festival', '한빛 축제']);
  for (const [md, kind, label] of yearly) {
    const [m, d] = md.slice(-5).split('-').map(Number);
    for (const yy of [y - 1, y, y + 1, y + 2]) put(new Date(yy, m - 1, d), { kind, label, ed: true });
  }
  // 설날·추석(음력이라 해마다 달라요): 확인된 날짜만
  for (const [ds, kind, label] of [['2026-02-16', 'seollal', '설날'], ['2026-02-17', 'seollal', '설날'], ['2026-02-18', 'seollal', '설날'], ['2026-09-24', 'chuseok', '추석'], ['2026-09-25', 'chuseok', '추석'], ['2026-09-26', 'chuseok', '추석'], ['2027-02-06', 'seollal', '설날'], ['2027-02-07', 'seollal', '설날'], ['2027-02-08', 'seollal', '설날'], ['2027-02-09', 'seollal', '설날'], ['2027-09-14', 'chuseok', '추석'], ['2027-09-15', 'chuseok', '추석'], ['2027-09-16', 'chuseok', '추석'], ...(cfg.lunarEditions || [])]) {
    const [yy, mm, dd] = ds.split('-').map(Number);
    put(new Date(yy, mm - 1, dd), { kind, label, ed: true });
  }
  for (const a of cfg.anniversaries || []) {
    const [m, d] = a.date.split('-').map(Number);
    for (const yy of [y - 1, y, y + 1, y + 2]) put(new Date(yy, m - 1, d), { kind: 'anniv', label: a.name });
  }
  return map;
}

export function editionFor(events, date) {
  const evs = events.get(key(date)) || [];
  for (const k of ['xmas', 'party', 'suneung', 'halloween', 'stickday', 'anniv', 'teachers', 'sports', 'festival', 'entrance', 'graduation', 'hangul', 'parents', 'children', 'aprilfools', 'science', 'seollal', 'chuseok', 'newyear', 'samil', 'gwangbok', 'students', 'arbor', 'earth', 'valentine', 'whiteday', 'dongji']) if (evs.some((e) => e.kind === k)) return k;
  return null;
}

// 다음 수능까지 남은 날
export function nextSuneung(cfg, today) {
  const t = day0(today);
  const list = (cfg.suneung || []).map(parse).filter((d) => d >= t).sort((a, b) => a - b);
  if (!list.length) return null;
  return Math.round((list[0] - t) / 86400000);
}

const MINE = 'smash-my-events';
export function loadMine() { try { return JSON.parse(localStorage.getItem(MINE) || '[]'); } catch { return []; } }
function saveMine(list) { try { localStorage.setItem(MINE, JSON.stringify(list)); } catch { /* 무시 */ } }

export class CalendarUI {
  constructor({ cfg, events, getDate, onTravel, loadSchool, onAdd, loadTeacher, addTeacher }) {
    this.onAdd = onAdd;
    this.loadTeacher = loadTeacher;
    this.addTeacher = addTeacher;
    this.cfg = cfg;
    this.loadSchool = loadSchool;
    this.loaded = new Set();
    this.mine = loadMine();
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
    $('cal-add').addEventListener('click', () => this.addMine());
    try { $('ct-key').value = localStorage.getItem('hasa-teacher-key') || ''; } catch { /* 무시 */ }
    $('ct-add').addEventListener('click', async () => {
      const name = $('ct-name').value.trim(), key = $('ct-key').value.trim();
      if (!name || !key) { $('cal-status').textContent = '일정 이름과 마스터키를 넣어 주세요'; return; }
      const d = this.sel, end = $('ct-end').value;
      try {
        await this.addTeacher(key, { date: key2(d), end: end || null, name, kind: $('ct-kind').value });
        try { localStorage.setItem('hasa-teacher-key', key); } catch { /* 무시 */ }
        $('ct-name').value = '';
        $('cal-status').textContent = '전교 일정으로 등록했어요';
        this.teacherLoaded = false;
        await this.fetchTeacher();
        this.render();
      } catch (e) {
        $('cal-status').textContent = e.message === 'key' ? '마스터키가 맞지 않아요' : e.message === 'offline' ? '온라인 저장소(Supabase)를 연결해야 쓸 수 있어요' : '등록하지 못했어요';
      }
    });
    $('cal-new-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addMine(); });
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

  // 선생님이 올린 전교 일정(📢)
  async fetchTeacher() {
    if (!this.loadTeacher || this.teacherLoaded) return;
    this.teacherLoaded = true;
    const list = await this.loadTeacher();
    for (const arr of this.events.values()) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].kind === 'teacher') arr.splice(i, 1);
    for (const e of list) {
      const s0 = parse(e.date), e0 = parse(e.end || e.date);
      for (let d = s0; d <= e0; d = addDays(d, 1)) {
        const k = key(d);
        if (!this.events.has(k)) this.events.set(k, []);
        this.events.get(k).push({ kind: 'teacher', label: `📢 ${e.name}`, id: e.id, tkind: e.kind });
      }
    }
  }

  open() {
    this.fetchTeacher().then(() => { if (!this.el.hidden) this.render(); });
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
      const evs = this.eventsOn(k);
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
    this.fetchMonth(v);
  }

  // 그 날의 일정: 기본(시험·수능·기념일) + 학사일정 + 내가 넣은 일정
  eventsOn(k) {
    return [...(this.events.get(k) || []), ...this.mine.filter((m) => m.date === k).map((m) => ({ kind: 'mine', label: `${m.type} · ${m.title}`, id: m.id }))];
  }

  async fetchMonth(v) {
    const mk = `${v.getFullYear()}-${v.getMonth()}`;
    if (!this.loadSchool || this.loaded.has(mk)) return;
    this.loaded.add(mk);
    $('cal-status').textContent = '학사일정 불러오는 중…';
    try {
      const list = await this.loadSchool(v.getFullYear(), v.getMonth());
      for (const e of list) {
        if (!this.events.has(e.date)) this.events.set(e.date, []);
        const arr = this.events.get(e.date);
        if (!arr.some((x) => x.label === e.label)) arr.push({ kind: 'school', label: e.label });
      }
      $('cal-status').textContent = list.length ? '학사일정: 나이스 교육정보 개방 포털' : '';
      if (this.view.getFullYear() === v.getFullYear() && this.view.getMonth() === v.getMonth()) this.render();
    } catch {
      this.loaded.delete(mk);
      $('cal-status').textContent = '학사일정을 불러오지 못했어요';
    }
  }

  addMine() {
    const title = $('cal-new-title').value.trim();
    if (!title) return;
    this.mine.push({ id: Date.now(), date: key(this.sel), title, type: $('cal-new-type').value });
    saveMine(this.mine);
    this.onAdd?.();
    $('cal-new-title').value = '';
    this.render();
  }

  removeMine(id) {
    this.mine = this.mine.filter((m) => m.id !== id);
    saveMine(this.mine);
    this.render();
  }

  renderDetail() {
    const d = this.sel;
    const evs = this.eventsOn(key(d));
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
      if (e.kind === 'mine') {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'ev-x';
        x.textContent = '✕';
        x.setAttribute('aria-label', '일정 지우기');
        x.addEventListener('click', () => this.removeMine(e.id));
        li.appendChild(x);
      }
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
