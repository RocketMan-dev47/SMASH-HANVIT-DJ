// 익명 사용 통계(HASA 텔레메트리).
// 모으는 것: 무작위 세션 번호, 기기 종류(폰·패드·PC), 쓴 기능·무기, 점수, 오류, 프레임 속도.
// 모으지 않는 것: 이름·학번·연락처·정확한 위치·입력한 글(응원·분실물 내용) 등 개인을 알 수 있는 정보.
// 끄기: 후원 카드의 "익명 통계" 스위치(이 기기에 저장).
const LOCAL = 'smash-tlog';
const OFF = 'smash-telemetry';
const MAX_LOCAL = 3000;

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export class Telemetry {
  constructor(cfg) {
    this.url = (cfg.supabaseUrl || '').replace(/\/$/, '');
    this.key = cfg.supabaseKey || '';
    this.online = !!(this.url && this.key) && cfg.telemetry !== false;
    try { this.enabled = localStorage.getItem(OFF) !== 'off'; } catch { this.enabled = true; }
    this.sid = rid();
    this.queue = [];
    this.counts = {};
    this.t0 = Date.now();
    this.frames = 0;
    this.fpsT = 0;
    this.errors = 0;
    if (this.enabled) this.hookErrors();
    setInterval(() => this.flush(), 15000);
    addEventListener('pagehide', () => this.flush(true));
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(true); });
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(OFF, on ? 'on' : 'off'); } catch { /* 무시 */ }
    if (!on) this.queue = [];
  }

  hookErrors() {
    addEventListener('error', (e) => {
      if (this.errors++ > 30) return;
      const file = (e.filename || '').split('/').pop();
      this.track('error', { msg: String(e.message || '').slice(0, 160), at: `${file}:${e.lineno || 0}:${e.colno || 0}` });
    });
    addEventListener('unhandledrejection', (e) => {
      if (this.errors++ > 30) return;
      this.track('error', { msg: String(e.reason?.message || e.reason || '').slice(0, 160), at: 'promise' });
    });
  }

  // 세션 시작: 기기 종류와 화면 크기(대략), 들어온 경로(도메인만)
  start(info) {
    const w = Math.round(innerWidth / 100) * 100, h = Math.round(innerHeight / 100) * 100;
    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* 무시 */ }
    this.track('session_start', { ...info, screen: `${w}x${h}`, lang: navigator.language, ref, standalone: matchMedia('(display-mode: standalone)').matches });
  }

  track(name, data = {}) {
    if (!this.enabled) return;
    this.counts[name] = (this.counts[name] || 0) + 1;
    const ev = { s: this.sid, n: name, d: data, t: new Date().toISOString() };
    this.queue.push(ev);
    // 이 기기 기록(관제센터의 "이 기기" 보기)
    try {
      const L = JSON.parse(localStorage.getItem(LOCAL) || '[]');
      L.push(ev);
      localStorage.setItem(LOCAL, JSON.stringify(L.slice(-MAX_LOCAL)));
    } catch { /* 무시 */ }
    if (this.queue.length >= 40) this.flush();
  }

  // 프레임 속도: 1분마다 평균을 남겨요(느린 기기 찾기용).
  frame(dt) {
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 60) { this.track('fps', { avg: Math.round(this.frames / this.fpsT) }); this.frames = 0; this.fpsT = 0; }
  }

  async flush(final = false) {
    if (!this.online || !this.enabled || !this.queue.length) return;
    const batch = this.queue.splice(0, 50);
    try {
      await fetch(`${this.url}/rest/v1/rpc/log_events`, {
        method: 'POST', keepalive: final,
        headers: { apikey: this.key, ...(String(this.key).startsWith('sb_') ? {} : { Authorization: `Bearer ${this.key}` }), 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_events: batch.map((e) => ({ session: e.s, name: e.n, data: e.d, at: e.t })) }),
      });
    } catch { this.queue.unshift(...batch.slice(0, 20)); }
  }

  end(extra = {}) {
    if (this.ended) return;
    this.ended = true;
    this.track('session_end', { sec: Math.round((Date.now() - this.t0) / 1000), events: Object.values(this.counts).reduce((a, b) => a + b, 0), ...extra });
    this.flush(true);
  }
}

export function localLog() {
  try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { return []; }
}
