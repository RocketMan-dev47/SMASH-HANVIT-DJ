// 학년 대항. config.json에 supabaseUrl과 supabaseKey(공개 키)를 넣으면 모든 사람 점수가 모이고,
// 비워 두면 이 기기 기록만 보여요.
const LOCAL = 'smash-grade-board';
const GRADE = 'smash-grade';

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class GradeBoard {
  constructor(cfg) {
    this.url = (cfg.supabaseUrl || '').replace(/\/$/, '');
    this.key = cfg.supabaseKey || '';
    this.online = !!(this.url && this.key);
    try { this.grade = Number(localStorage.getItem(GRADE)) || 0; } catch { this.grade = 0; }
    this.asked = (() => { try { return localStorage.getItem(GRADE) !== null; } catch { return false; } })();
    this.rows = this.localRows();
    this.newRun();
  }

  headers() {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' };
  }

  setGrade(g) {
    this.finishRun();
    this.grade = g;
    this.asked = true;
    try { localStorage.setItem(GRADE, String(g)); } catch { /* 무시 */ }
    this.newRun();
  }

  newRun() {
    this.runId = uuid();
    this.runScore = 0;
    this.sent = 0;
  }

  setScore(score) {
    this.runScore = score;
  }

  localRows() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(LOCAL) || '{}'); } catch { /* 무시 */ }
    return [1, 2, 3].map((g) => ({ grade: g, total: data[g]?.total || 0, runs: data[g]?.runs || 0, best: data[g]?.best || 0 }));
  }

  // 한 판이 끝났을 때(다시 짓기, 창 닫기) 기록을 더합니다.
  finishRun() {
    if (!this.grade || this.runScore <= 0) return;
    if (this.online) {
      this.send(true);
    } else {
      let data = {};
      try { data = JSON.parse(localStorage.getItem(LOCAL) || '{}'); } catch { /* 무시 */ }
      const r = data[this.grade] || { total: 0, runs: 0, best: 0 };
      r.total += this.runScore; r.runs += 1; r.best = Math.max(r.best, this.runScore);
      data[this.grade] = r;
      try { localStorage.setItem(LOCAL, JSON.stringify(data)); } catch { /* 무시 */ }
      this.rows = this.localRows();
    }
    this.newRun();
  }

  // 같은 판 번호로 여러 번 보내도 서버는 가장 높은 점수만 남겨요.
  async send(final = false) {
    if (!this.online || !this.grade || this.runScore <= this.sent) return;
    this.sent = this.runScore;
    try {
      await fetch(`${this.url}/rest/v1/rpc/submit_run`, {
        method: 'POST', headers: this.headers(), keepalive: final,
        body: JSON.stringify({ p_run: this.runId, p_grade: this.grade, p_score: Math.round(this.runScore) }),
      });
    } catch { /* 연결이 안 되면 다음에 다시 */ }
  }

  async refresh() {
    if (!this.online) { this.rows = this.localRows(); return this.rows; }
    try {
      const r = await fetch(`${this.url}/rest/v1/grade_board?select=*`, { headers: this.headers() });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      this.rows = [1, 2, 3].map((g) => {
        const row = data.find((d) => Number(d.grade) === g) || {};
        return { grade: g, total: Number(row.total) || 0, runs: Number(row.runs) || 0, best: Number(row.best) || 0 };
      });
    } catch { /* 이전 값 유지 */ }
    return this.rows;
  }
}
