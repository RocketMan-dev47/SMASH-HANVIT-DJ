// 도전 과제 배지: 우주 임무 패치처럼 생긴 68개. 이 기기에 저장돼요.
// [id, 이름, 영문 임무명, 조건, 상징, 등급(1 브론즈·2 실버·3 골드·4 레전드), 분류(c 전투·x 탐험·l 학교생활·s 특별)]
const KEY = 'smash-badges';
const STATS = 'smash-badge-stats';

export const BADGES = [
  // ---------- 전투(c) ----------
  ['first', '첫 파괴', 'FIRST STRIKE', '건물 한 동 무너뜨리기', '💥', 1, 'c'],
  ['all', '한빛 리셋', 'TOTAL RESET', '부순 정도 100% 만들기', '🏚️', 2, 'c'],
  ['grade1', '1등급', 'TOP GRADE', '1등급 찍기', '🥇', 2, 'c'],
  ['nuke', '보라매 출격', 'BORAMAE SORTIE', 'KF-21로 핵폭탄 떨어뜨리기', '✈️', 1, 'c'],
  ['rocket', 'HASA 발사', 'FIRST LAUNCH', '로켓 발사하기', '🚀', 1, 'c'],
  ['delivery', '로켓 배송', 'ORBITAL DELIVERY', '택배차로 건물을 우주로 보내기', '📦', 2, 'c'],
  ['dog', '불 뿜는 강아지', 'HOT DOG', '로봇개로 10초 동안 화염 뿜기', '🔥', 1, 'c'],
  ['quake10', '진도 Ⅹ', 'MAGNITUDE X', '최대 진도 지진 일으키기', '🌋', 1, 'c'],
  ['jackpot', '매점 털이', 'SNACK HEIST', '매점 잭팟 터뜨리기', '🍌', 2, 'c'],
  ['combo3', '연쇄 붕괴', 'CHAIN REACTION', '10초 안에 건물 3동 무너뜨리기', '💣', 3, 'c'],
  ['speed100', '번개 리셋', 'LIGHTNING RESET', '시작 3분 안에 부순 정도 100%', '⚡', 4, 'c'],
  ['grade1fast', '속성 1등급', 'FAST TRACK', '시작 2분 안에 1등급', '🏎️', 3, 'c'],
  ['nuke3', '삼중 투하', 'TRIPLE YIELD', '한 판에 핵폭탄 3번', '☢️', 3, 'c'],
  ['rocket5', '연속 발사', 'FIVE FOR FIVE', '로켓 5번 발사(누적)', '🛰️', 2, 'c'],
  ['catch', '젓가락 포획', 'TOWER CATCH', '로켓 1단 포획까지 지켜보기', '🗼', 2, 'c'],
  ['allTools', '무기 마스터', 'ARSENAL', '모든 무기를 한 번씩 쓰기', '🛠️', 3, 'c'],
  ['quakeAll', '지진학자', 'SEISMOLOGIST', '진도 Ⅳ부터 Ⅹ까지 모두 일으키기', '📈', 3, 'c'],
  ['homerunXL', '장외 홈런', 'OUT OF THE PARK', 'XL 배트로 홈런', '⚾', 3, 'c'],
  ['nukeAll', '초토화', 'SCORCHED EARTH', '핵폭탄 한 발로 건물 3동 무너뜨리기', '🍄', 4, 'c'],
  ['soccer', '축구공 대방출', 'KICKOFF', '인재원 Ⅱ를 무너뜨려 축구공 쏟기', '⚽', 2, 'c'],
  ['harmony', '하모니 팡파레', 'GRAND FINALE', '하모니홀을 무너뜨려 음표 쏟기', '🎼', 2, 'c'],
  // ---------- 태권도(c) ----------
  ['beltYellow', '노란 띠', 'YELLOW BELT', '태권도 5번(누적)', '🟡', 1, 'c'],
  ['beltBlue', '파란 띠', 'BLUE BELT', '태권도 30번(누적)', '🔵', 2, 'c'],
  ['beltBlack', '검은 띠', 'BLACK BELT', '태권도 80번(누적) · 1단 승단', '⚫', 4, 'c'],
  ['breaker', '격파왕', 'BOARD BREAKER', '태권도로 건물 3동 무너뜨리기(누적)', '🥋', 3, 'c'],
  ['allKicks', '기술 도감', 'FULL FORM', '태권도 기술 5가지 모두 쓰기', '🦵', 2, 'c'],
  // ---------- 탐험(x) ----------
  ['tour', '신입생', 'ORIENTATION', '1인칭으로 학교 걸어 다니기', '🚶', 1, 'x'],
  ['tourAll', '캠퍼스 정복', 'CAMPUS CONQUEST', '1인칭 투어로 모든 건물 앞에 가 보기', '🧭', 3, 'x'],
  ['explorer', '학교 박사', 'SURVEYOR', '둘러보기에서 건물 6곳 정보 보기', '🗺️', 1, 'x'],
  ['turtle', '거북바위', 'TURTLE ROCK', '거북바위 찾기', '🐢', 1, 'x'],
  ['alien', '우주의 친구', 'FIRST CONTACT', '운석을 떨어뜨려 외계인 만나기', '👽', 1, 'x'],
  ['cat5', '집사 자격증', 'CAT CERTIFIED', '고양이 5번 쓰다듬기', '🐱', 1, 'x'],
  ['kitten', '아기 고양이', 'TINY PAWS', '새끼 고양이 쓰다듬기', '🍼', 1, 'x'],
  ['allCats', '고양이 가족', 'WHOLE LITTER', '고양이 5마리를 모두 쓰다듬기', '🐾', 2, 'x'],
  ['dex5', '생물 탐사', 'FIELD SURVEY', '도감 5종 발견', '🔎', 2, 'x'],
  ['dexAll', '한빛 생태학자', 'ECOLOGIST', '도감 완성', '📗', 4, 'x'],
  ['squirrel', '천연기념물', 'MOMONGA', '하늘다람쥐 발견', '🐿️', 3, 'x'],
  ['deer', '고라니 목격', 'WATER DEER', '깊은 산의 고라니 발견', '🦌', 3, 'x'],
  ['boar', '멧돼지 목격', 'WILD BOAR', '가장 깊은 산의 멧돼지 발견', '🐗', 4, 'x'],
  ['hunt', '타임캡슐', 'TIME CAPSULE', '타임캡슐 찾기 성공', '💊', 2, 'x'],
  ['hunt3', '명탐정', 'DETECTIVE', '타임캡슐을 3발 이내에 찾기', '🕵️', 3, 'x'],
  ['hunt1', '홀인원', 'HOLE IN ONE', '타임캡슐을 첫 발에 찾기', '🎯', 4, 'x'],
  ['seasons4', '사계절', 'FOUR SEASONS', '봄·여름·가을·겨울 모두 보기', '🍂', 3, 'x'],
  ['weatherAll', '기상 캐스터', 'WEATHERMAN', '날씨 6가지를 모두 골라 보기', '🌦️', 2, 'x'],
  ['timesAll', '시간 여행자', 'CHRONONAUT', '새벽·낮·노을·밤 모두 보기', '🕰️', 2, 'x'],
  ['night', '야자의 밤', 'GRAVEYARD SHIFT', '밤에 3분 머물기', '🌙', 1, 'x'],
  // ---------- 학교생활(l) ----------
  ['meal', '오늘 뭐 먹지', 'MESS HALL', '급식 메뉴 확인하기', '🍱', 1, 'l'],
  ['bus', '등굣길', 'COMMUTER', '버스 정보 확인하기', '🚌', 1, 'l'],
  ['bell', '딩동댕동', 'SCHOOL BELL', '실제 종소리 듣기', '🔔', 1, 'l'],
  ['timetable', '오늘 몇 교시?', 'SCHEDULE CHECK', '시간표 확인하기', '🗒️', 1, 'l'],
  ['dday', 'D-day 카운터', 'COUNTDOWN', '내 D-day 추가하기', '⏳', 1, 'l'],
  ['planner', '계획왕', 'MISSION PLANNER', '달력에 내 일정 추가하기', '🗓️', 1, 'l'],
  ['fortune', '운세 매니아', 'FORTUNE TELLER', '학습운세 3번 뽑기', '🔮', 1, 'l'],
  ['cheer', '응원 단장', 'CHEER CAPTAIN', '응원의 벽에 글 남기기', '💌', 1, 'l'],
  ['lost', '분실물 지킴이', 'LOST & FOUND', '분실물 지도에 핀 남기기', '📍', 1, 'l'],
  ['snowman', '눈사람 장인', 'SNOW CRAFTER', '눈사람 완성하기', '☃️', 1, 'l'],
  ['snowman3', '눈사람 공장', 'SNOW FACTORY', '눈사람 3개 만들기(누적)', '⛄', 3, 'l'],
  ['photo', '사진작가', 'PHOTOGRAPHER', '사진 모드 쓰기', '📸', 1, 'l'],
  ['share', '인싸', 'BROADCAST', '공유 카드 만들기', '✨', 1, 'l'],
  ['pacifist', '평화주의자', 'PACIFIST', '둘러보기 모드로 10분 머물기', '🕊️', 2, 'l'],
  ['marathon', '마라톤', 'MARATHON', '한 번에 30분 넘게 플레이', '⏱️', 3, 'l'],
  ['gpchamp', '월드 챔피언', 'GRAND PRIX', '한빛 그랑프리 1위', '🏁', 3, 'l'],
  ['docked', '도킹 완료', 'SOFT CAPTURE', 'HASA 도킹 성공', '🛰️', 3, 'c'],
  ['defender', '행성 방어', 'PLANETARY DEFENSE', '운석 막기 8웨이브 완주', '🛡️', 3, 'c'],
  ['lander', '정밀 착륙', 'PRECISION LANDING', '착륙 챌린지 성공', '🎯', 3, 'c'],
  ['shootout', '승부차기 승리', 'SHOOTOUT', '운동장 승부차기 이기기', '⚽', 2, 'l'],
  ['sniper', '슈팅 가드', 'SHARPSHOOTER', '60초 슛아웃 30점', '🏀', 3, 'l'],
  ['tycoon', '매점 큰손', 'STORE TYCOON', '매점 타이쿤 하루 3만 원', '💰', 2, 'l'],
  ['builder', '증축 공신', 'MASTER BUILDER', '크레인으로 벽돌 짐 50개', '🏗️', 3, 'l'],
  ['season30', '시즌 레전드', 'SEASON LEGEND', '시즌 패스 30단계', '🎖️', 4, 's'],
  ['parents', '폭닥폭닥', 'FOR MOM & DAD', '어버이날 에디션 보기', '💐', 2, 's'],
  ['letter', '마음의 쪽지', 'LOVE LETTER', '건물 속 부모님께 쓰는 쪽지 5장 모으기', '💌', 3, 's'],
  ['secbeat', '레코드 페이스', 'RECORD PACE', '한빛 그랑프리 코너 하나에서 레코드 페이스 돌파', '⏱️', 3, 'l'],
  ['campaign', '정거장 완공', 'STATION COMPLETE', 'HASA 우주정거장 캠페인 10단계 완주', '🛰️', 4, 'c'],
  ['ghostbeat', '고스트 추월', 'BEAT THE GHOST', '한빛 그랑프리에서 내 고스트보다 빠른 랩', '👻', 2, 'l'],
  ['album', '추억 저장', 'MEMORIES', '나의 한빛 앨범을 이미지로 저장', '📔', 1, 's'],
  ['lettercard', '마음 전달', 'SENT WITH LOVE', '가정의 달 편지 카드 만들기', '💐', 2, 's'],
  ['edcollect', '기념일 수집가', 'HOLIDAY HUNTER', '기념일 물건 12개 모두 모으기', '🎁', 2, 's'],
  ['online1', '첫 접속', 'HELLO HANVIT', '온라인 모드로 처음 접속', '🌐', 1, 's'],
  ['raid', '레이드 승리', 'RAID CLEAR', '협동 레이드에서 보스 본관 격파에 참여', '🛡️', 3, 'l'],
  ['rivalbeat', '전교 고스트 추월', 'RIVAL DOWN', '전교 순위 고스트보다 빠른 랩', '🏁', 3, 'l'],
  ['cinema', '사계 감독', 'DIRECTOR\'S CUT', '사계절 시네마를 끝까지 보기', '🎬', 2, 'l'],
  ['pickle', '피클볼 챔피언', 'PICKLE CHAMP', '파인홀 피클볼에서 사범님 이기기', '🏓', 3, 'l'],
  ['suggest', '한빛 개발 위원', 'DEV COUNCIL', '건의함에 의견 보내기', '📮', 1, 'l'],
  // ---------- 특별(s) ----------
  ['xmas', '메리 한빛', 'CHRISTMAS EVE', '크리스마스 에디션 보기', '🎄', 2, 's'],
  ['fireworks', '시험 끝!', 'EXAMS COMPLETE', '시험 끝 불꽃놀이 보기', '🎆', 2, 's'],
  ['suneungDay', '수능 응원단', 'D-DAY SUPPORT', '수능 날 접속하기', '🎓', 3, 's'],
  ['earlybird', '아침형 인간', 'EARLY BIRD', '실제 아침 6~7시에 접속', '🌅', 2, 's'],
  ['nightowl', '올빼미', 'NIGHT OWL', '실제 새벽 1~4시에 접속', '🦉', 3, 's'],
  ['weekend', '주말 출격', 'WEEKEND WARRIOR', '주말에 접속', '🛸', 1, 's'],
  ['streak3', '3일 연속', 'THREE-DAY STREAK', '3일 연속 접속', '📆', 2, 's'],
  ['streak7', '개근상', 'PERFECT ATTENDANCE', '7일 연속 접속', '🏆', 4, 's'],
  ['halloween', '트릭 오어 트릿', 'TRICK OR TREAT', '할로윈 에디션 보기', '🎃', 2, 's'],
  ['stickday', '11·11', 'STICK DAY', '막대과자 데이 에디션 보기', '🍫', 2, 's'],
  ['anniv', '한빛 생일', 'FOUNDERS DAY', '개교기념일 드론쇼 보기', '🎂', 2, 's'],
  ['teachers', '감사합니다', 'THANK YOU', '스승의 날 에디션 보기', '💐', 2, 's'],
  ['sports', '청백 계주', 'FIELD DAY', '체육대회 에디션 보기', '🏃', 2, 's'],
  ['festival', '축제의 밤', 'FESTIVAL NIGHT', '축제 에디션 보기', '🎤', 2, 's'],
  ['entrance', '새내기', 'FRESHMAN', '입학식 에디션 보기', '🌸', 2, 's'],
  ['graduation', '졸업 축하', 'COMMENCEMENT', '졸업식 에디션 보기', '🎓', 3, 's'],
  ['hangul', '세종대왕님', 'HANGUL DAY', '한글날 에디션 보기', 'ㄱ', 2, 's'],
  ['children', '말랑말랑', 'JELLY SCHOOL', '어린이날 에디션 보기', '🎈', 2, 's'],
  ['aprilfools', '속았지?', 'APRIL FOOLS', '만우절 에디션 보기', '🤪', 2, 's'],
  ['science', '특별 임무', 'SCIENCE DAY', '과학의 날 로켓 보기', '🔬', 3, 's'],
  ['firstsnow', '첫눈', 'FIRST SNOW', '실제 첫눈 오는 날 접속하기', '❄️', 4, 's'],
  ['blockworld', '블록 월드', 'BLOCK WORLD', '택배 상자에서 블록 월드 뽑기(낮은 확률)', '🧱', 4, 's'],
  ['legend', '레전드', 'HALL OF FAME', '배지 50개 모으기', '🌟', 4, 's'],
];

const TIER = {
  1: { name: 'BRONZE', a: '#e2a46b', b: '#8a5326' },
  2: { name: 'SILVER', a: '#f1f4f8', b: '#8b95a3' },
  3: { name: 'GOLD', a: '#ffe08a', b: '#b9860f' },
  4: { name: 'LEGEND', a: '#ff9fd8', b: '#6a3df0' },
};
const FIELD = { c: ['#7a1d12', '#e8452c'], x: ['#06243f', '#1f7ab8'], l: ['#123d2c', '#2f9e66'], s: ['#2a1250', '#8a5cf0'] };
export const TIER_NAME = { 1: '브론즈', 2: '실버', 3: '골드', 4: '레전드' };
export const CAT_NAME = { c: '전투', x: '탐험', l: '학교생활', s: '특별' };

let uid = 0;
// 우주 임무 패치: 바깥 테(등급 금속색) + 안쪽 원(분류별 우주색) + 위쪽 원호 영문 임무명 + 가운데 상징 + 아래 리본(한글 이름)
export function patchSVG(b, no, got) {
  const [id, name, en, , icon, tier, cat] = b;
  const T = TIER[tier], F = FIELD[cat];
  const u = `p${uid++}`;
  const outer = {
    x: '<circle cx="60" cy="60" r="56"/>',
    l: '<path d="M60 4 L108 32 L108 88 L60 116 L12 88 L12 32 Z"/>',
    c: '<path d="M60 4 C82 10 100 12 110 14 C112 60 96 98 60 116 C24 98 8 60 10 14 C20 12 38 10 60 4 Z"/>',
    s: '<path d="M60 3 L72 22 L94 16 L92 38 L113 48 L98 64 L110 84 L88 88 L82 110 L60 100 L38 110 L32 88 L10 84 L22 64 L7 48 L28 38 L26 16 L48 22 Z"/>',
  }[cat];
  let seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const stars = Array.from({ length: 9 }, () => `<circle cx="${(28 + rnd() * 64).toFixed(1)}" cy="${(30 + rnd() * 44).toFixed(1)}" r="${(0.5 + rnd() * 0.9).toFixed(2)}" fill="#fff" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`).join('');
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="patch ${got ? '' : 'locked'}" role="img" aria-label="${name} 배지${got ? '' : '(잠김)'}">
  <defs>
    <linearGradient id="${u}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.a}"/><stop offset="0.55" stop-color="${T.b}"/><stop offset="1" stop-color="${T.a}"/></linearGradient>
    <radialGradient id="${u}f" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="${F[1]}"/><stop offset="1" stop-color="${F[0]}"/></radialGradient>
    <path id="${u}a" d="M24 62 A36 36 0 0 1 96 62"/>
  </defs>
  <g fill="url(#${u}m)" stroke="#0b1020" stroke-width="2">${outer}</g>
  <circle cx="60" cy="60" r="43" fill="#0b1020"/>
  <circle cx="60" cy="60" r="40" fill="url(#${u}f)"/>
  ${stars}
  <ellipse cx="60" cy="86" rx="38" ry="10" fill="#000" opacity="0.2"/>
  <circle cx="60" cy="60" r="40" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="0.8" stroke-dasharray="2 3"/>
  <text font-family="Helvetica, Arial, sans-serif" font-size="${en.length > 15 ? 6 : en.length > 12 ? 6.8 : 7.6}" font-weight="800" letter-spacing="${en.length > 15 ? 0.6 : 1.2}" fill="#fff"><textPath href="#${u}a" xlink:href="#${u}a" startOffset="50%" text-anchor="middle">${en}</textPath></text>
  <text x="60" y="72" text-anchor="middle" font-size="28">${got ? icon : '🔒'}</text>
  <text x="60" y="82.5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="5" font-weight="700" letter-spacing="1" fill="#fff" opacity="0.75">HASA · M-${String(no).padStart(2, '0')}</text>
  <path d="M16 86 L104 86 L97 98 L104 110 L16 110 L23 98 Z" fill="#0b1020" stroke="url(#${u}m)" stroke-width="2"/>
  <text x="60" y="102" text-anchor="middle" font-family="'Pretendard Variable', Pretendard, sans-serif" font-size="9.5" font-weight="800" fill="${T.a}">${name}</text>
</svg>`;
}

export class Badges {
  constructor(ui) {
    this.ui = ui;
    try { this.got = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { this.got = {}; }
    try { this.stats = JSON.parse(localStorage.getItem(STATS) || '{}'); } catch { this.stats = {}; }
    this.counts = {};
  }

  has(id) { return !!this.got[id]; }

  give(id) {
    if (this.got[id]) return;
    const i = BADGES.findIndex((x) => x[0] === id);
    if (i < 0) return;
    this.got[id] = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.got)); } catch { /* 무시 */ }
    this.ui.badge(BADGES[i], i + 1);
    if (Object.keys(this.got).length >= 50) this.give('legend');
  }

  // 이번 판 안에서 횟수가 차면 주는 배지
  count(id, need) {
    this.counts[id] = (this.counts[id] || 0) + 1;
    if (this.counts[id] >= need) this.give(id);
    return this.counts[id];
  }

  // 여러 판에 걸쳐 쌓이는 기록(누적 횟수 · 모은 종류)
  save() { try { localStorage.setItem(STATS, JSON.stringify(this.stats)); } catch { /* 무시 */ } }
  inc(key, n = 1) { this.stats[key] = (this.stats[key] || 0) + n; this.save(); return this.stats[key]; }
  mark(key, value) {
    const L = this.stats[key] || [];
    if (!L.includes(value)) { L.push(value); this.stats[key] = L; this.save(); }
    return L.length;
  }

  list() { return BADGES.map((b, i) => ({ b, no: i + 1, got: !!this.got[b[0]] })); }
}
