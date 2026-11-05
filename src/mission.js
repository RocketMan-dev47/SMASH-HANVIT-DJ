// HASA 미션 컨트롤(한빛 관제센터): 발사 전 GO/NO-GO 점검 → 교신 로그(퀸드라 톤) → 실시간 고도·속도 그래프 → 단별 상태등
const $ = (id) => document.getElementById(id);

const POLL = [
  ['RANGE', '사격장·공역 통제'], ['WX', '기상'], ['PROP', '추진'], ['GNC', '유도·항법·제어'],
  ['RECOVERY', '부스터 회수'], ['FD', '비행 감독'],
];

// 이벤트 이름 → 교신(호출 부호: 담당 → 내용)
const CALLS = {
  STARTUP: [['PROP', '엔진 점화 시퀀스 시작. 연료·산화제 압력 정상.']],
  LIFTOFF: [['FD', '발사! 한빛-1 발사대 이탈.'], ['GNC', '타워 클리어. 피치 프로그램 시작.']],
  'MAX-Q': [['GNC', 'Max-Q 통과. 기체 하중 정상 범위.']],
  MECO: [['PROP', 'MECO. 1단 엔진 정지 확인.']],
  'STAGE SEP': [['GNC', '단 분리 확인.'], ['PROP', '2단 점화… 점화 확인. 추력 정상.']],
  BOOSTBACK: [['RECOVERY', '부스터 귀환 연소 시작. 발사장으로 방향 전환.']],
  IMPACT: [['GNC', '2단 목표 지점 도달. 탑재체 임무 완료.']],
  'LANDING BURN': [['RECOVERY', '착륙 연소 시작. 하강 속도 줄이는 중.']],
  CATCH: [['RECOVERY', '젓가락 팔 포획 성공! 부스터 회수 완료.'], ['FD', '모든 팀 수고했다. 임무 성공. 🎉']],
};

export class MissionControl {
  constructor() {
    this.el = $('mc');
    this.sound = null;
    this.data = [];
  }

  start(events, t0, name) {
    this.events = events;
    this.done = new Set();
    this.data = [];
    this.t0 = t0;
    this.lastLog = -99;
    $('mc-name').textContent = name;
    $('mc-log').innerHTML = '';
    $('mc-poll').innerHTML = POLL.map(([k, n]) => `<li data-k="${k}"><b>${k}</b><span>${n}</span><em>…</em></li>`).join('');
    $('mc-poll').hidden = false;
    this.pollDone = 0;
    this.setLight('s1', 'standby'); this.setLight('s2', 'standby'); this.setLight('rng', 'go');
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.log('FD', `${name} 발사 준비. 전 팀 GO/NO-GO 점검.`, t0);
  }

  setLight(id, state) {
    const el = $(`mc-${id}`);
    el.dataset.state = state;
    el.querySelector('em').textContent = { standby: '대기', go: 'GO', nominal: '정상', burn: '연소', coast: '관성', done: '완료', safe: 'SAFE' }[state] || state;
  }

  fmt(t) {
    const s = Math.abs(t), m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `T${t < 0 ? '-' : '+'}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  // 교신 한 줄: 앞뒤로 '삐-' 퀸드라 톤(아폴로 시절 무전 신호음)
  log(who, text, t) {
    const li = document.createElement('li');
    li.innerHTML = `<time>${this.fmt(t)}</time><b>${who}</b><span>${text}</span>`;
    const ul = $('mc-log');
    ul.prepend(li);
    while (ul.children.length > 7) ul.lastChild.remove();
    $('mc-ticker').textContent = `${who} · ${text}`;
    this.sound?.quindar?.();
  }

  update(t, s1, s2) {
    if (this.el.hidden) return;
    $('mc-clock').textContent = this.fmt(t);
    // 발사 전 점검: 0.2초마다 한 팀씩 GO
    if (t < 0) {
      const k = Math.min(POLL.length, Math.floor((t - this.t0) / 0.22));
      while (this.pollDone < k) {
        const li = $('mc-poll').children[this.pollDone];
        li.classList.add('go');
        li.querySelector('em').textContent = 'GO';
        this.pollDone++;
        if (this.pollDone === POLL.length) this.log('FD', '전 팀 GO. 발사 승인.', t);
      }
    } else if (!$('mc-poll').hidden) {
      $('mc-poll').hidden = true;
    }
    for (const e of this.events) {
      if (t >= e.t && !this.done.has(e.label)) {
        this.done.add(e.label);
        (CALLS[e.label] || []).forEach(([who, txt], i) => setTimeout(() => this.log(who, txt, Math.max(t, e.t)), i * 450));
        if (e.label === 'LIFTOFF') { this.setLight('s1', 'burn'); this.setLight('s2', 'nominal'); }
        if (e.label === 'MECO') this.setLight('s1', 'coast');
        if (e.label === 'STAGE SEP') this.setLight('s2', 'burn');
        if (e.label === 'BOOSTBACK') this.setLight('s1', 'burn');
        if (e.label === 'IMPACT') this.setLight('s2', 'done');
        if (e.label === 'LANDING BURN') this.setLight('s1', 'burn');
        if (e.label === 'CATCH') { this.setLight('s1', 'done'); this.setLight('rng', 'safe'); }
      }
    }
    if (t >= 0) this.data.push([t, s1.alt, s1.spd, s2 ? s2.alt : null, s2 ? s2.spd : null]);
    this.draw();
    $('mc-alt').textContent = `${Math.round(s2 ? s2.alt : s1.alt)} m`;
    $('mc-spd').textContent = `${Math.round((s2 ? s2.spd : s1.spd) * 3.6)} km/h`;
  }

  // 고도(위)·속도(아래) 그래프: 1단 주황, 2단 하늘색
  draw() {
    const c = $('mc-chart');
    const W = c.clientWidth || 260, H = c.clientHeight || 110, dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const d = this.data;
    if (d.length < 2) return;
    const tMax = Math.max(4, d[d.length - 1][0]);
    const aMax = Math.max(50, ...d.map((r) => Math.max(r[1], r[3] || 0)));
    const vMax = Math.max(50, ...d.map((r) => Math.max(r[2], r[4] || 0)));
    const half = H / 2 - 4;
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.moveTo(0, half + 4); g.lineTo(W, half + 4); g.stroke();
    g.font = '600 9px Pretendard, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText('ALT', 4, 11); g.fillText('VEL', 4, half + 16);
    const line = (col, idx, max, y0) => {
      g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
      let first = true;
      for (const r of d) {
        if (r[idx] === null) continue;
        const x = (r[0] / tMax) * (W - 8) + 4, y = y0 + half - (r[idx] / max) * (half - 6);
        if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
      }
      g.stroke();
    };
    line('#ff9f43', 1, aMax, 0); line('#5ac8fa', 3, aMax, 0);
    line('#ff9f43', 2, vMax, half + 4); line('#5ac8fa', 4, vMax, half + 4);
  }

  end() {
    this.el.classList.remove('show');
    setTimeout(() => { if (!this.el.classList.contains('show')) this.el.hidden = true; }, 500);
  }
}
