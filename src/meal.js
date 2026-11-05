// 급식 메뉴(나이스 교육정보 개방 포털). 미래관(급식실)을 꾹 누르면 그날 메뉴가 나와요.
const BASE = 'https://open.neis.go.kr/hub';

async function schoolCode(atpt, name) {
  const key = `neis:${atpt}:${name}`;
  try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) return c; } catch { /* 무시 */ }
  const r = await fetch(`${BASE}/schoolInfo?Type=json&ATPT_OFCDC_SC_CODE=${atpt}&SCHUL_NM=${encodeURIComponent(name)}`);
  const d = await r.json();
  const row = d.schoolInfo?.[1]?.row?.[0];
  if (!row) throw new Error('학교를 찾지 못했어요');
  const code = { atpt: row.ATPT_OFCDC_SC_CODE, school: row.SD_SCHUL_CODE };
  try { localStorage.setItem(key, JSON.stringify(code)); } catch { /* 무시 */ }
  return code;
}

// 알레르기 번호 "(1.2.5)" 같은 것은 지우고 줄마다 나눠요.
const clean = (s) => s.split(/<br\s*\/?>/i).map((x) => x.replace(/\([\d.\s]+\)/g, '').replace(/[*#]/g, '').trim()).filter(Boolean);

export async function fetchMeals(cfg, date) {
  const atpt = cfg.neis?.atpt || 'G10';
  const name = cfg.neis?.name || cfg.school || '대전한빛고등학교';
  const code = await schoolCode(atpt, name);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const r = await fetch(`${BASE}/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${code.atpt}&SD_SCHUL_CODE=${code.school}&MLSV_YMD=${ymd}`);
  const d = await r.json();
  const rows = d.mealServiceDietInfo?.[1]?.row || [];
  return rows.map((x) => ({ kind: x.MMEAL_SC_NM, dishes: clean(x.DDISH_NM || ''), cal: x.CAL_INFO }));
}

// 학사일정(나이스): 한 달치. 인증키가 없으면 5개씩 여러 번 나눠 받아요.
export async function fetchSchedule(cfg, year, month) {
  const atpt = cfg.neis?.atpt || 'G10';
  const name = cfg.neis?.name || cfg.school || '대전한빛고등학교';
  const code = await schoolCode(atpt, name);
  const from = `${year}${String(month + 1).padStart(2, '0')}01`;
  const to = `${year}${String(month + 1).padStart(2, '0')}${new Date(year, month + 1, 0).getDate()}`;
  const key = cfg.neis?.key ? `&KEY=${cfg.neis.key}` : '';
  const size = cfg.neis?.key ? 100 : 5;
  const rows = [];
  for (let page = 1; page <= (cfg.neis?.key ? 2 : 12); page++) {
    const r = await fetch(`${BASE}/SchoolSchedule?Type=json${key}&pIndex=${page}&pSize=${size}&ATPT_OFCDC_SC_CODE=${code.atpt}&SD_SCHUL_CODE=${code.school}&AA_FROM_YMD=${from}&AA_TO_YMD=${to}`);
    const d = await r.json();
    const got = d.SchoolSchedule?.[1]?.row || [];
    rows.push(...got);
    if (got.length < size) break;
  }
  return rows
    .filter((x) => x.EVENT_NM && !/토요휴업일/.test(x.EVENT_NM))
    .map((x) => ({ date: `${x.AA_YMD.slice(0, 4)}-${x.AA_YMD.slice(4, 6)}-${x.AA_YMD.slice(6, 8)}`, label: x.EVENT_NM.trim() }));
}

// 반별 시간표(나이스): 그날 교시별 과목
export async function fetchTimetable(cfg, date, grade, cls) {
  const atpt = cfg.neis?.atpt || 'G10';
  const name = cfg.neis?.name || cfg.school || '대전한빛고등학교';
  const code = await schoolCode(atpt, name);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const key = cfg.neis?.key ? `&KEY=${cfg.neis.key}` : '';
  const rows = [];
  for (let page = 1; page <= (cfg.neis?.key ? 1 : 3); page++) {
    const size = cfg.neis?.key ? 30 : 5;
    const r = await fetch(`${BASE}/hisTimetable?Type=json${key}&pIndex=${page}&pSize=${size}&ATPT_OFCDC_SC_CODE=${code.atpt}&SD_SCHUL_CODE=${code.school}&ALL_TI_YMD=${ymd}&GRADE=${grade}&CLASS_NM=${cls}`);
    const d = await r.json();
    const got = d.hisTimetable?.[1]?.row || [];
    rows.push(...got);
    if (got.length < size) break;
  }
  const seen = new Set();
  return rows
    .map((x) => ({ period: Number(x.PERIO), subject: (x.ITRT_CNTNT || '').replace(/^-/, '').trim() }))
    .filter((x) => x.subject && !seen.has(x.period) && seen.add(x.period))
    .sort((a, b) => a.period - b.period);
}
