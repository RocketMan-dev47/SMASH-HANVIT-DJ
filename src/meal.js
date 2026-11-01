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
