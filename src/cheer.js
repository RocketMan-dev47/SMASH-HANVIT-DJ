// 3학년 응원 메시지 벽(와우관을 연타하면 열려요).
// Supabase를 설정하면 모두가 같이 보고, 아니면 이 기기에만 저장돼요. 신고 3번이면 자동으로 숨겨져요.
const LOCAL = 'smash-cheer';
const HIDE = 'smash-cheer-hidden';
const BAD = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '좆', 'ㅈㄴ', '존나', '닥쳐', '꺼져', '죽어', '미친놈', '미친년', 'fuck', 'shit', 'bitch'];
export const DEFAULT_CHEERS = [
  '3학년 선배님들 수능 대박 나세요!', '지금까지 잘 해왔어요. 끝까지 화이팅!', '한빛의 빛, 선배님들이 최고예요',
  '컨디션 관리 잘하시고 원하는 대학 꼭 가세요', '찹쌀떡처럼 착 붙으세요!', '실수만 줄이면 됩니다. 응원해요!',
  '밥 잘 챙겨 드세요. 급식실이 응원합니다', '와우관 불빛 꺼질 때까지 공부하신 거 다 알아요', '수능 끝나면 운동장에서 불꽃놀이 해요!',
];

export class CheerWall {
  constructor(cfg) {
    this.url = (cfg.supabaseUrl || '').replace(/\/$/, '');
    this.key = cfg.supabaseKey || '';
    this.online = !!(this.url && this.key);
  }

  headers() { return { apikey: this.key, ...(String(this.key).startsWith('sb_') ? {} : { Authorization: `Bearer ${this.key}` }), 'Content-Type': 'application/json' }; }

  clean(text) {
    const t = text.replace(/\s+/g, ' ').trim().slice(0, 60);
    const plain = t.replace(/[\s.\-_*]/g, '').toLowerCase();
    if (!t) return { ok: false, why: '내용을 적어 주세요' };
    if (BAD.some((w) => plain.includes(w))) return { ok: false, why: '고운 말로 응원해 주세요' };
    return { ok: true, text: t };
  }

  hidden() { try { return new Set(JSON.parse(localStorage.getItem(HIDE) || '[]')); } catch { return new Set(); } }

  async list() {
    const hid = this.hidden();
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { /* 무시 */ }
    let shared = [];
    if (this.online) {
      try {
        const r = await fetch(`${this.url}/rest/v1/cheer_board?select=*&order=created_at.desc&limit=80`, { headers: this.headers() });
        if (r.ok) shared = (await r.json()).map((m) => ({ id: `s${m.id}`, sid: m.id, text: m.text }));
      } catch { /* 무시 */ }
    }
    const base = DEFAULT_CHEERS.map((text, i) => ({ id: `d${i}`, text }));
    return [...mine, ...shared, ...base].filter((m) => !hid.has(m.id));
  }

  async add(text) {
    const c = this.clean(text);
    if (!c.ok) return c;
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { /* 무시 */ }
    mine.unshift({ id: `m${Date.now()}`, text: c.text, mine: true });
    try { localStorage.setItem(LOCAL, JSON.stringify(mine.slice(0, 50))); } catch { /* 무시 */ }
    if (this.online) {
      try { await fetch(`${this.url}/rest/v1/rpc/add_cheer`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ p_text: c.text }) }); } catch { /* 무시 */ }
    }
    return c;
  }

  async report(m) {
    const hid = this.hidden();
    hid.add(m.id);
    try { localStorage.setItem(HIDE, JSON.stringify([...hid])); } catch { /* 무시 */ }
    if (this.online && m.sid) {
      try { await fetch(`${this.url}/rest/v1/rpc/report_cheer`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ p_id: m.sid }) }); } catch { /* 무시 */ }
    }
  }
}
