// D-day 위젯: 수능·시험은 자동, 내 D-day는 직접 추가. 하나를 화면에 고정할 수 있어요.
const KEY = 'smash-ddays';
const PIN = 'smash-dday-pin';
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export class DDays {
  constructor(cfg) {
    this.cfg = cfg;
    try { this.mine = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { this.mine = []; }
    try { this.pin = localStorage.getItem(PIN) || 'suneung'; } catch { this.pin = 'suneung'; }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.mine)); localStorage.setItem(PIN, this.pin); } catch { /* 무시 */ }
  }

  // 오늘 기준으로 남은 날짜를 붙인 목록(가까운 순)
  list(today = new Date()) {
    const t = day0(today);
    const out = [];
    const sun = (this.cfg.suneung || []).map(parse).find((d) => d >= t);
    if (sun) out.push({ id: 'suneung', name: '수능', date: sun, auto: true });
    for (const e of this.cfg.exams || []) { const d = parse(e.date); if (parse(e.end || e.date) >= t) out.push({ id: `exam-${e.date}`, name: e.name, date: d, auto: true }); }
    for (const m of this.mine) out.push({ ...m, date: parse(m.date) });
    return out
      .map((e) => ({ ...e, days: Math.round((day0(e.date) - t) / 86400000) }))
      .sort((a, b) => a.days - b.days);
  }

  add(name, date) {
    if (!name.trim() || !date) return false;
    const id = `m${Date.now()}`;
    this.mine.push({ id, name: name.trim().slice(0, 20), date });
    this.pin = id;
    this.save();
    return true;
  }

  remove(id) {
    this.mine = this.mine.filter((m) => m.id !== id);
    if (this.pin === id) this.pin = 'suneung';
    this.save();
  }

  setPin(id) { this.pin = id; this.save(); }

  pinned(today) { const L = this.list(today); return L.find((e) => e.id === this.pin) || L[0] || null; }
}

export const dLabel = (n) => (n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`);
