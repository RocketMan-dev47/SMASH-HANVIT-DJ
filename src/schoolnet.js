// 학교 공용 기능(Supabase): 선생님 일정(마스터키), 건의함, 실시간 버스. Supabase가 없으면 이 기기에만 저장돼요.
const BAD = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '좆', 'ㅈㄴ', '존나', '닥쳐', '꺼져', '죽어', 'fuck', 'shit'];
const clean = (t, max) => {
  let s = String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);
  s = s.replace(/01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/g, '(번호 지움)');
  const plain = s.replace(/[\s.\-_*]/g, '').toLowerCase();
  return BAD.some((w) => plain.includes(w)) ? null : s;
};

export class SchoolNet {
  constructor(cfg) {
    this.cfg = cfg;
    this.url = (cfg.supabaseUrl || '').replace(/\/$/, '');
    this.key = cfg.supabaseKey || '';
    this.online = !!(this.url && this.key);
  }

  h() { return { apikey: this.key, ...(String(this.key).startsWith('sb_') ? {} : { Authorization: `Bearer ${this.key}` }), 'Content-Type': 'application/json' }; }
  async rpc(fn, body) {
    const r = await fetch(`${this.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: this.h(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.status === 400 || r.status === 401 ? 'key' : `HTTP ${r.status}`);
    return r.status === 204 ? null : r.json().catch(() => null);
  }

  // ---------- 선생님 일정(전교 공지) ----------
  async teacherEvents() {
    if (!this.online) return [];
    try {
      const r = await fetch(`${this.url}/rest/v1/school_board?select=*&order=date.asc`, { headers: this.h() });
      return r.ok ? r.json() : [];
    } catch { return []; }
  }

  async addTeacherEvent(key, { date, end, name, kind }) {
    if (!this.online) throw new Error('offline');
    const n = clean(name, 40);
    if (!n) throw new Error('name');
    return this.rpc('add_school_event', { p_key: key, p_date: date, p_end: end || null, p_name: n, p_kind: kind });
  }

  async removeTeacherEvent(key, id) { return this.rpc('remove_school_event', { p_key: key, p_id: id }); }

  // ---------- 전교 공지 · 응원의 벽 관리(선생님) ----------
  async notice() {
    if (!this.online) return null;
    try { const r = await fetch(`${this.url}/rest/v1/notice_board?select=*`, { headers: this.h() }); const L = r.ok ? await r.json() : []; return L[0] || null; } catch { return null; }
  }
  async setNotice(key, text, until) { if (!this.online) throw new Error('offline'); return this.rpc('set_notice', { p_key: key, p_text: text || '', p_until: until || null }); }
  async teacherCheers(key) { if (!this.online) throw new Error('offline'); return this.rpc('teacher_cheers', { p_key: key }); }
  async setCheerHidden(key, id, hidden) { return this.rpc('set_cheer_hidden', { p_key: key, p_id: id, p_hidden: hidden }); }

  // ---------- 건의함 ----------
  async suggest({ kind, text, grade }) {
    const t = clean(text, 300);
    if (!t) return { ok: false, why: '고운 말로 적어 주세요' };
    if (t.length < 4) return { ok: false, why: '조금만 더 자세히 적어 주세요' };
    const item = { kind, text: t, grade: grade || 0, at: new Date().toISOString() };
    try {
      const L = JSON.parse(localStorage.getItem('smash-suggest') || '[]');
      L.push(item);
      localStorage.setItem('smash-suggest', JSON.stringify(L.slice(-100)));
    } catch { /* 무시 */ }
    if (this.online) {
      try { await this.rpc('add_suggestion', { p_kind: kind, p_text: t, p_grade: grade || 0 }); } catch { return { ok: true, local: true }; }
    }
    return { ok: true, local: !this.online };
  }

  // ---------- 실시간 버스(중계 함수가 있을 때) ----------
  async busLive(ars) {
    const u0 = this.cfg.bus?.liveUrl;
    if (!u0) return null;
    const u = ars ? `${u0}${u0.includes('?') ? '&' : '?'}stop=${encodeURIComponent(ars)}` : u0;
    // 중계 함수는 키 없이 부르는 공개 함수(--no-verify-jwt)라 머리글 없이 보내요. 머리글을 붙이면 브라우저 사전 확인(CORS) 때문에 막힐 수 있어요
    const r = await fetch(u);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json(); // [{ no, min, stops, low }]
  }
}

export function localSuggestions() { try { return JSON.parse(localStorage.getItem('smash-suggest') || '[]'); } catch { return []; } }
