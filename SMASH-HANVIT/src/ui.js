const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// SpaceX 중계 화면처럼: 1단·2단 속도·고도 원형 게이지 + T+ 시계 + 이벤트 타임라인
class SpaceXTelemetry {
  constructor() {
    this.el = $('sx');
    this.rows = null;
  }

  gauge(id, value, max, text) {
    const arc = $(id);
    const C = 2 * Math.PI * 30 * 0.75; // 270도짜리 호
    arc.style.strokeDasharray = `${C * Math.min(1, value / max)} 999`;
    $(`${id}-v`).textContent = text;
  }

  show(events, t0, t1, name) {
    this.events = events; this.t0 = t0; this.t1 = t1;
    $('sx-name').textContent = name;
    const ul = $('sx-events');
    ul.innerHTML = '';
    this.marks = events.map((e) => {
      const li = document.createElement('li');
      li.style.left = `${((e.t - t0) / (t1 - t0)) * 100}%`;
      li.innerHTML = `<i></i><span>${e.label}</span>`;
      ul.appendChild(li);
      return li;
    });
    this.el.hidden = false;
    document.body.classList.add('sx-on');
    requestAnimationFrame(() => this.el.classList.add('show'));
  }

  update(t, clock, s1, s2) {
    if (this.el.hidden) return;
    $('sx-clock').textContent = clock;
    const f = Math.max(0, Math.min(1, (t - this.t0) / (this.t1 - this.t0)));
    $('sx-progress').style.width = `${f * 100}%`;
    this.events.forEach((e, i) => this.marks[i].classList.toggle('done', t >= e.t));
    this.gauge('sx1-spd', s1.spd, 1600, Math.round(s1.spd));
    this.gauge('sx1-alt', s1.alt, 400, Math.round(s1.alt));
    $('sx2').classList.toggle('off', !s2);
    if (s2) {
      this.gauge('sx2-spd', s2.spd, 1600, Math.round(s2.spd));
      this.gauge('sx2-alt', s2.alt, 400, Math.round(s2.alt));
    }
  }

  hide() {
    this.el.classList.remove('show');
    document.body.classList.remove('sx-on');
    setTimeout(() => { if (!this.el.classList.contains('show')) this.el.hidden = true; }, 400);
  }
}

export class UI {
  constructor(tools, onTool) {
    this.sx = new SpaceXTelemetry();
    this.shown = 0;
    this.target = 0;
    this.grade = 9;
    this.dock = $('dock');
    this.buttons = new Map();
    tools.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.dataset.id = t.id;
      b.innerHTML = `${t.icon}<span>${t.name}</span>`;
      b.title = `${t.name} (${i + 1}) · ${t.hint}`;
      b.setAttribute('aria-label', `${t.name}: ${t.hint}`);
      b.addEventListener('click', () => onTool(t.id));
      this.dock.appendChild(b);
      this.buttons.set(t.id, b);
    });
  }

  setSchool(name) { $('school').textContent = name; }

  setLogo(src) {
    const img = $('emblem');
    if (!src) return;
    img.src = src;
    img.hidden = false;
    for (const el of document.querySelectorAll('.sheet-emblem')) { el.src = src; el.hidden = false; }
  }

  setTool(id) {
    for (const [k, b] of this.buttons) {
      b.classList.toggle('on', k === id);
      b.setAttribute('aria-pressed', String(k === id));
      if (k === id) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  addScore(total) { this.target = total; }

  setGrade(g, mult) {
    $('mult').textContent = `×${mult.toFixed(2)}`;
    if (g === this.grade) return;
    const up = g < this.grade;
    this.grade = g;
    const badge = $('grade-badge');
    $('grade-num').textContent = g;
    badge.dataset.g = g;
    if (up) {
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }
  }

  setPercent(f) {
    const p = Math.min(100, f * 100);
    $('bar-fill').style.width = `${p}%`;
    $('pct').textContent = `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
  }

  toast(title, sub, kind = '') {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = `toast glass ${kind}`;
    const a = document.createElement('strong');
    a.textContent = title;
    t.appendChild(a);
    if (sub) { const b = document.createElement('span'); b.textContent = sub; t.appendChild(b); }
    box.prepend(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
    while (box.children.length > 3) box.lastChild.remove();
  }

  notice(html) {
    const n = $('notice');
    n.innerHTML = html;
    n.hidden = !html;
  }

  telemetry(...parts) {
    const el = $('telemetry');
    if (parts[0] === null) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = parts.map((p, i) => `<span class="${i === 0 ? 't-main' : ''}">${p}</span>`).join('');
  }

  flash() {
    const f = $('flash');
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  setExam(label, bonus) {
    const c = $('exam-chip');
    c.hidden = !label;
    c.innerHTML = label ? `<b>${label}</b>${bonus > 1 ? `<span>점수 ×${bonus.toFixed(2)}</span>` : ''}` : '';
  }

  setGradeChip(g) {
    $('grade-chip').innerHTML = g ? `<b>${g}학년</b><span>대표로 참가 중</span>` : '<b>학년 대항</b><span>참가하기</span>';
  }

  setMission(text, progress, done) {
    $('mission-text').textContent = text;
    $('mission-bar').style.width = `${Math.round(progress * 100)}%`;
    const card = $('mission');
    card.classList.toggle('done', !!done);
    $('mission-state').textContent = done ? '완료' : `${Math.floor(progress * 100)}%`;
  }

  setBoard(rows, myGrade, note) {
    const max = Math.max(1, ...rows.map((r) => r.total));
    const ol = $('board-rows');
    ol.innerHTML = '';
    for (const r of [...rows].sort((a, b) => b.total - a.total)) {
      const li = document.createElement('li');
      if (r.grade === myGrade) li.className = 'me';
      li.innerHTML = `<span class="g">${r.grade}학년</span><span class="track"><i style="width:${(r.total / max) * 100}%"></i></span><span class="n">${fmt(r.total)}</span>`;
      ol.appendChild(li);
    }
    $('board-note').textContent = note;
  }

  openSheet(current, onPick) {
    const sheet = $('sheet');
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('show'));
    for (const b of sheet.querySelectorAll('[data-grade]')) {
      b.classList.toggle('on', Number(b.dataset.grade) === current);
      b.onclick = () => {
        onPick(Number(b.dataset.grade));
        sheet.classList.remove('show');
        setTimeout(() => { sheet.hidden = true; }, 300);
      };
    }
    sheet.querySelector('[data-grade="1"]').focus({ preventScroll: true });
  }

  // 도구별 설정: 지진 진도(Ⅳ~Ⅹ), 배트 크기(S~XL)
  showOptions(kind, value, onChange) {
    const box = $('tool-options');
    if (kind !== 'quake' && kind !== 'bat') { box.hidden = true; return; }
    box.hidden = false;
    const input = $('opt-range');
    const ROM = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];
    const cfg = kind === 'quake'
      ? { label: '지진 진도', min: 4, max: 10, lo: 'Ⅳ 약함', hi: 'Ⅹ 최대', show: (v) => ROM[v], desc: (v) => this.quakeText[v] }
      : { label: '배트 크기', min: 1, max: 4, lo: 'S', hi: 'XL', show: (v) => this.batSizes[v - 1].name, desc: (v) => `길이 ${this.batSizes[v - 1].len} m · 맞는 범위 ${this.batSizes[v - 1].R} m` };
    $('opt-label').textContent = cfg.label;
    $('opt-min').textContent = cfg.lo;
    $('opt-max').textContent = cfg.hi;
    input.min = cfg.min; input.max = cfg.max; input.step = 1; input.value = value;
    input.setAttribute('aria-label', cfg.label);
    const paint = (v) => {
      $('opt-value').textContent = cfg.show(v);
      $('opt-desc').textContent = cfg.desc(v);
      input.style.setProperty('--fill', `${((v - cfg.min) / (cfg.max - cfg.min)) * 100}%`);
    };
    paint(Number(value));
    input.oninput = () => { const v = Number(input.value); paint(v); onChange(v); };
  }

  setBatSizes(b) { this.batSizes = b; }

  // 지구시스템과학 메모: 지진 관측 카드 + 지진계 기록
  quakeInfo(q) {
    const box = $('quake-info');
    box.hidden = false;
    $('qi-mag').textContent = `규모 ${q.M.toFixed(1)}`;
    const f = (x, u, d = 1) => `${x.toFixed(d)} ${u}`;
    $('qi-int').textContent = `진도 ${q.roman}`;
    $('qi-depth').textContent = f(q.depth, 'km');
    $('qi-delta').textContent = f(q.delta, 'km');
    $('qi-D').textContent = f(q.D, 'km');
    $('qi-p').textContent = f(q.tP, '초');
    $('qi-s').textContent = f(q.tS, '초');
    $('qi-ps').textContent = f(q.tS - q.tP, '초');
    $('qi-note').innerHTML = `오모리 공식 <b>D = k × PS시</b> → ${q.k.toFixed(1)} × ${(q.tS - q.tP).toFixed(1)} ≈ <b>${(q.k * (q.tS - q.tP)).toFixed(1)} km</b> (P파 ${q.vp} km/s, S파 ${q.vs} km/s)`;
    const c = $('qi-seis');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.clientWidth || 240, H = c.clientHeight || 64;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tMax = q.tS * 1.7;
    const play = Math.max(2.5, q.dur + 1.5);
    const t0 = performance.now();
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    const amp = (t) => {
      let a = 0.05;
      if (t > q.tP) a += 0.32 * Math.exp(-(t - q.tP) / (q.tS * 0.5));
      if (t > q.tS) a += 1.0 * Math.exp(-(t - q.tS) / (q.tS * 0.45)) * (0.4 + q.I / 10);
      return a;
    };
    const X = (t) => 6 + (t / tMax) * (W - 12);
    cancelAnimationFrame(this.qiRaf);
    clearTimeout(this.qiHide);
    const draw = () => {
      const now = (performance.now() - t0) / 1000;
      const tt = Math.min(tMax, (now / play) * tMax);
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      for (const [t, label, col] of [[q.tP, 'P', '#5ac8fa'], [q.tS, 'S', '#ff6fae']]) {
        if (tt < t) continue;
        g.strokeStyle = col; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(X(t), 4); g.lineTo(X(t), H - 4); g.stroke(); g.setLineDash([]);
        g.fillStyle = col; g.font = '700 10px Pretendard, sans-serif'; g.fillText(label, X(t) + 3, 12);
      }
      if (tt >= q.tS) {
        g.strokeStyle = '#ffc94a'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(q.tP), H - 6); g.lineTo(X(q.tS), H - 6); g.stroke();
        g.fillStyle = '#ffc94a'; g.font = '700 9.5px Pretendard, sans-serif';
        g.fillText('PS시', (X(q.tP) + X(q.tS)) / 2 - 10, H - 9);
      }
      seed = 11;
      g.strokeStyle = '#fff'; g.lineWidth = 1.2;
      g.beginPath();
      for (let t = 0; t <= tt; t += tMax / 420) {
        const y = H / 2 + rnd() * amp(t) * (H * 0.8);
        t === 0 ? g.moveTo(X(t), y) : g.lineTo(X(t), y);
      }
      g.stroke();
      if (now < play) this.qiRaf = requestAnimationFrame(draw);
    };
    draw();
    this.qiHide = setTimeout(() => { box.hidden = true; }, (play + 7) * 1000);
  }

  setSuneung(days) {
    const c = $('suneung-chip');
    c.hidden = days === null;
    if (days !== null) c.innerHTML = days === 0 ? '<b>수능 D-DAY</b><span>힘내세요!</span>' : `<b>수능 D-${days}</b><span>2027학년도 수능</span>`;
  }

  setTravel(text) {
    const c = $('travel-chip');
    c.hidden = !text;
    if (text) c.innerHTML = `<b>${text}</b><span>오늘로 돌아가기</span>`;
  }

  // 특별 에디션: 가운데 카드로 크게 보여 준 뒤 칩으로 남아요.
  showEdition(ed, E) {
    document.body.dataset.edition = ed || '';
    const chip = $('edition-chip');
    chip.hidden = !ed;
    if (!ed) return;
    chip.innerHTML = `<i>${E.icon}</i><span><b>${E.title}</b><span>특별 에디션</span></span>`;
    const ov = $('edition');
    $('ed-icon').innerHTML = E.icon;
    $('ed-title').textContent = E.title;
    $('ed-sub').textContent = E.sub;
    ov.className = `ed-${ed}`;
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('show'));
    clearTimeout(this.edT);
    this.edT = setTimeout(() => {
      ov.classList.remove('show');
      ov.classList.add('leave');
      setTimeout(() => { ov.hidden = true; ov.classList.remove('leave'); }, 700);
    }, 2800);
  }

  showFortune(f, dateText) {
    const ov = $('fortune');
    $('ft-date').textContent = dateText;
    $('ft-stars').innerHTML = '★'.repeat(f.stars) + '<span>' + '★'.repeat(5 - f.stars) + '</span>';
    $('ft-msg').textContent = f.message;
    $('ft-subject').textContent = f.subject;
    $('ft-place').textContent = f.place;
    $('ft-item').textContent = f.item;
    $('ft-mood').textContent = `${f.mood} ${f.moodScore}%`;
    ov.hidden = false;
    const card = ov.querySelector('.ft-card');
    card.classList.remove('flip');
    void card.offsetWidth;
    card.classList.add('flip');
    requestAnimationFrame(() => ov.classList.add('show'));
  }

  hideFortune() {
    const ov = $('fortune');
    ov.classList.remove('show');
    setTimeout(() => { ov.hidden = true; }, 250);
  }

  setQuakeText(t) { this.quakeText = t; }

  setStats(collapsed, total, trees, best) {
    $('st-bldg').textContent = `${collapsed}/${total}`;
    $('st-tree').textContent = trees.toLocaleString('ko-KR');
    $('st-best').textContent = `${best}등급`;
  }

  // 나침반 눈금과 동서남북 글자
  buildCompass() {
    const g = $('compass-dial');
    const ns = 'http://www.w3.org/2000/svg';
    for (let a = 0; a < 360; a += 15) {
      const major = a % 90 === 0;
      const r1 = 34, r2 = major ? 28 : 31;
      const rad = ((a - 90) * Math.PI) / 180;
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', 40 + Math.cos(rad) * r1); l.setAttribute('y1', 40 + Math.sin(rad) * r1);
      l.setAttribute('x2', 40 + Math.cos(rad) * r2); l.setAttribute('y2', 40 + Math.sin(rad) * r2);
      l.setAttribute('class', major ? 'tick major' : 'tick');
      g.appendChild(l);
    }
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => {
      const rad = ((a - 90) * Math.PI) / 180;
      const tx = document.createElementNS(ns, 'text');
      tx.setAttribute('x', 40 + Math.cos(rad) * 21);
      tx.setAttribute('y', 40 + Math.sin(rad) * 21);
      if (t === 'N') tx.setAttribute('class', 'n');
      tx.textContent = t;
      g.appendChild(tx);
    });
  }

  setHeading(deg) {
    $('compass-dial').setAttribute('transform', `rotate(${-deg} 40 40)`);
    $('compass-deg').textContent = `${Math.round((deg + 360) % 360)}°`;
  }

  ready() {
    const l = $('loading');
    l.classList.add('gone');
    setTimeout(() => l.remove(), 700);
  }

  update(dt) {
    if (this.shown !== this.target) {
      const d = this.target - this.shown;
      this.shown += Math.abs(d) < 2 ? d : d * Math.min(1, dt * 9);
      $('score').textContent = fmt(this.shown);
    }
  }

  reset() {
    this.target = 0; this.shown = 0; $('score').textContent = '0';
    this.grade = 0; this.setGrade(9, 1);
    this.setPercent(0);
  }
}
