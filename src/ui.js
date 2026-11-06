import { MissionControl } from './mission.js';
import { patchSVG, TIER_NAME, CAT_NAME } from './badges.js';
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// SpaceX 중계 화면처럼: 1단·2단 속도·고도 원형 게이지 + T+ 시계 + 이벤트 타임라인
class SpaceXTelemetry {
  constructor() {
    this.el = $('sx');
    this.rows = null;
    this.mission = new MissionControl();
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
    this.mission.start(events, t0, name);
  }

  update(t, clock, s1, s2) {
    if (this.el.hidden) return;
    this.mission.update(t, s1, s2);
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
    this.mission.end();
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
      b.title = `${t.name} (${(i + 1) % 10}) · ${t.hint}`;
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
    $('mini-grade').textContent = `${g}등급`;
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
    while (box.children.length > (this.maxToasts || 3)) box.lastChild.remove();
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

  // 기기별 화면: phone(폰), tablet(패드), desktop
  setDevice(kind) {
    document.body.dataset.device = kind;
    this.maxToasts = kind === 'phone' ? 1 : kind === 'tablet' ? 2 : 3;
  }

  dogMode(on) {
    document.body.classList.toggle('dog-on', on);
    $('dog-ui').hidden = !on;
  }

  async showDonate(cfg) {
    const ov = $('donate');
    const d = cfg.donate || {};
    $('dn-msg').textContent = d.message || '이 게임은 한빛고 학생이 직접 만든 비공식 팬 게임이에요. 재밌게 했다면 작은 응원을 보내 주세요!';
    const link = $('dn-link');
    const box = $('dn-qr');
    box.innerHTML = '';
    if (d.qr) {
      const img = new Image();
      img.src = d.qr;
      img.alt = '후원 QR 코드';
      box.appendChild(img);
    } else if (d.link) {
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
        const qrcode = mod.default || mod;
        const q = qrcode(0, 'M');
        q.addData(d.link);
        q.make();
        const n = q.getModuleCount(), cell = 6, pad = 3;
        const c = document.createElement('canvas');
        c.width = c.height = (n + pad * 2) * cell;
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#101a34';
        for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + pad) * cell, (r + pad) * cell, cell, cell);
        box.appendChild(c);
      } catch {
        box.textContent = 'QR을 만들지 못했어요. 아래 버튼을 눌러 주세요.';
      }
    } else {
      box.innerHTML = '<p class="dn-empty">아직 후원 링크가 없어요.<br>config.json의 <code>donate.link</code>에<br>토스·카카오페이 송금 링크를 넣으면 QR이 생겨요.</p>';
    }
    link.hidden = !d.link;
    if (d.link) { link.href = d.link; link.textContent = d.label || '후원하러 가기'; }
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('show'));
  }

  hideDonate() {
    const ov = $('donate');
    ov.classList.remove('show');
    setTimeout(() => { ov.hidden = true; }, 250);
  }


  setWeather(w) {
    const c = $('weather-chip');
    c.hidden = !w;
    if (w) c.innerHTML = `<b>대전 지금 ${w.temp}°</b><span>${w.name}</span>`;
  }

  modal(id, on) {
    const ov = $(id);
    if (on) { ov.hidden = false; requestAnimationFrame(() => ov.classList.add('show')); }
    else { ov.classList.remove('show'); setTimeout(() => { ov.hidden = true; }, 250); }
  }

  showMeal(dateText, meals, error) {
    $('meal-date').textContent = dateText;
    const box = $('meal-list');
    box.innerHTML = '';
    if (meals === null) box.innerHTML = '<p class="meal-empty">급식 메뉴를 불러오는 중…</p>';
    else if (error) box.innerHTML = `<p class="meal-empty">급식 정보를 불러오지 못했어요.<br><small>${error}</small></p>`;
    else if (!meals.length) box.innerHTML = '<p class="meal-empty">이 날은 급식이 없어요.<br>주말이나 방학일 수 있어요.</p>';
    else for (const m of meals) {
      const sec = document.createElement('section');
      sec.className = 'meal-item';
      sec.innerHTML = `<div class="meal-head"><b>${m.kind}</b><span>${m.cal || ''}</span></div><ul>${m.dishes.map((d) => `<li>${d}</li>`).join('')}</ul>`;
      box.appendChild(sec);
    }
    this.modal('meal', true);
  }

  showShare(canvas) {
    const img = $('share-img');
    img.src = canvas.toDataURL('image/png');
    this.shareCanvas = canvas;
    this.modal('share', true);
  }


  showInfo(f) {
    $('info-no').textContent = typeof f.no === 'number' ? `${String(f.no).padStart(2, '0')}번 건물` : '한빛 명소';
    $('info-title').textContent = f.title;
    $('info-desc').textContent = f.desc || '';
    $('info-items').innerHTML = (f.items || []).map((x) => `<li>${x}</li>`).join('');
    $('info-meal').hidden = !f.meal;
    $('info-pickle').hidden = !f.meal;
    $('info-enter').hidden = !/^본관(\s|$)/.test(f.title || '') || /증축/.test(f.title || '');
    $('info-enter').dataset.b = '본관';
    this.modal('info', true);
  }

  // 실시간 도착 정보(중계 함수가 있으면)
  setBusLive(list, err) {
    const box = $('bus-live');
    if (list === undefined) { box.innerHTML = ''; return; }
    if (list === null) { box.innerHTML = '<p class="live-tag">● 실시간 도착 정보 불러오는 중…</p>'; return; }
    if (err) { box.innerHTML = `<p class="bus-note">실시간 정보를 불러오지 못했어요(${err}). 아래는 시간표 기준이에요.</p>`; return; }
    box.innerHTML = '<p class="live-tag">● 실시간</p>' + (list.length ? list.slice(0, 6).map((b) => `<div class="bus-row"><b>${b.no}</b><span>${b.min <= 1 ? '곧 도착' : `${b.min}분 뒤`}<br><small>${b.stops}정류장 전</small></span></div>`).join('') : '<p class="bus-note">지금 오는 버스가 없어요.</p>');
  }

  showBus(bus) {
    const box = $('bus-list'), stops = bus?.stops || [];
    const TYPE = { 간선: '#2f6fe0', 지선: '#30a14e', 외곽: '#7cb518', 급행: '#e8452c', 마을: '#8e8e93' };
    if (stops.length) {
      this.busStop = this.busStop && stops.find((x) => x.id === this.busStop.id) ? this.busStop : stops[0];
      const st = this.busStop, info = bus.routeInfo || {}, seen = bus.seen?.[st.id] || {};
      $('bus-tabs').innerHTML = stops.map((x) => `<button type="button" data-id="${x.id}" class="${x.id === st.id ? 'on' : ''}">${x.label}<small>${x.ars}</small></button>`).join('');
      $('bus-tabs').hidden = false;
      for (const t of $('bus-tabs').querySelectorAll('button')) t.onclick = () => { this.busStop = stops.find((x) => x.id === t.dataset.id); this.onBusStop ? this.onBusStop() : this.showBus(bus); };
      $('bus-sub').textContent = `${st.ars} · ${st.toward}`;
      box.innerHTML = st.routes.map((no) => {
        const r = info[no] || {}, c = TYPE[r.type] || '#8e8e93', s0 = seen[no];
        return `<div class="bus-row bus-r2"><b style="--c:${c}"><i>${r.type || ''}</i>${no}</b><span>${r.ends || ''}${s0 ? `<br><small>최근 같은 요일 기록 ${s0.join(' · ')}</small>` : ''}</span></div>`;
      }).join('') + `<p class="bus-note">${bus.liveUrl ? '위쪽은 실시간 도착 정보, 아래는 정류장 노선이에요.' : '실시간 도착 정보는 공공데이터 연결 후에 떠요. 지금은 노선 안내예요.'}</p>`;
      $('bus-link').href = `https://map.kakao.com/?q=${encodeURIComponent(`한빛고교 ${st.ars}`)}`;
      this.modal('bus', true);
      return;
    }
    $('bus-tabs').hidden = true;
    const routes = bus?.routes || [];
    if (!routes.length) {
      box.innerHTML = '<p class="bus-note">아직 노선 정보가 없어요.</p>';
    } else {
      const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
      box.innerHTML = routes.map((r) => {
        const [fh, fm] = (r.first || '06:00').split(':').map(Number), [lh, lm] = (r.last || '22:30').split(':').map(Number);
        const first = fh * 60 + fm, last = lh * 60 + lm, iv = r.interval || 20;
        let next = null;
        for (let t = first; t <= last; t += iv) if (t >= mins) { next = t; break; }
        const txt = next === null ? '운행 종료' : next === mins ? '곧 도착' : `약 ${next - mins}분 뒤`;
        return `<div class="bus-row"><b>${r.no}</b><span>${txt}<br><small>배차 ${iv}분</small></span></div>`;
      }).join('');
    }
    $('bus-link').href = bus?.link || `https://map.kakao.com/?q=${encodeURIComponent('한빛고교 정류장')}`;
    this.modal('bus', true);
  }

  setHistory(list) {
    $('history-list').innerHTML = list.map(([d, t]) => `<div class="hist"><em>${d}</em><span>${t}</span></div>`).join('');
  }


  // 배지 획득: 임무 패치가 반짝이며 떠요.
  badge(b, no) {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast glass badge patch-toast';
    t.innerHTML = `${patchSVG(b, no, true)}<div><strong>임무 완수 · ${b[1]}</strong><span>${b[3]} · ${TIER_NAME[b[5]]}</span></div>`;
    box.prepend(t);
    while (box.children.length > (this.maxToasts || 3)) box.lastChild.remove();
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4200);
  }

  showBadges(list) {
    const got = list.filter((x) => x.got).length;
    $('badges-count').textContent = `${got} / ${list.length}`;
    const groups = ['c', 'x', 'l', 's'].map((c) => {
      const L = list.filter((x) => x.b[6] === c);
      return `<h3 class="bdg-cat">${CAT_NAME[c]} <em>${L.filter((x) => x.got).length}/${L.length}</em></h3><div class="bdg-grid">${L.map(({ b, no, got: g }) => `<div class="bdg ${g ? '' : 'lock'} t${b[5]}" title="${b[3]}">${patchSVG(b, no, g)}<span>${b[3]}</span></div>`).join('')}</div>`;
    }).join('');
    $('badges-grid').innerHTML = `<div class="bdg-bar"><i style="width:${(got / list.length) * 100}%"></i></div>${groups}`;
    this.modal('badges', true);
  }

  walkMode(on) {
    document.body.classList.toggle('walk-on', on);
    $('walk-ui').hidden = !on;
    if (!on) $('walk-near').hidden = true;
  }

  walkNear(b) {
    $('walk-near').hidden = !b;
    if (b) $('walk-near-name').textContent = b.name;
  }

  setSeason(name, winner) {
    $('board-season').innerHTML = `<b>${name} 시즌</b>${winner ? ` · 지난 시즌(${winner.season}) 우승 <b>${winner.grade}학년</b>` : ''}`;
  }


  hunt(h) {
    const el = $('hunt');
    el.hidden = !h;
    if (!h) return;
    if (h.done) {
      $('hunt-text').innerHTML = h.win ? `<b>타임캡슐 발견!</b><span>${h.shots}발 만에 찾았어요 · 최고 기록 ${h.best}발</span>` : `<b>아깝다!</b><span>가장 가까웠던 거리 ${Math.round(h.min)} m · 반짝이는 곳이 정답이에요</span>`;
      $('hunt-btn').textContent = '다시 하기';
    } else {
      $('hunt-text').innerHTML = `<b>타임캡슐 찾기 · 남은 탐사 ${h.shots}발</b><span>${h.msg || '어디든 눌러서 탐사 폭탄을 터뜨려요'}${h.min < Infinity ? ` · 가장 가까움 ${Math.round(h.min)} m` : ''}</span>`;
      $('hunt-btn').textContent = '그만하기';
    }
  }

  setBell(p) {
    const c = $('bell-chip');
    c.hidden = !p;
    if (!p) return;
    const u = p.until ? `${String(Math.floor(p.until / 60)).padStart(2, '0')}:${String(p.until % 60).padStart(2, '0')}까지` : '';
    c.innerHTML = `<b>🔔 ${p.label}</b><span>${u || '오늘 수업 끝'}</span>`;
  }

  showDex(entries) {
    const got = entries.filter((e) => e.at).length;
    $('dex-count').textContent = `${got} / ${entries.length}`;
    $('dex-grid').innerHTML = entries.map((e) => e.at
      ? `<div class="dex"><i>${e.emoji}</i><b>${e.name}</b><em>${e.kind}</em><span>${e.desc}</span><small>${new Date(e.at).toLocaleDateString('ko-KR')} 발견</small></div>`
      : `<div class="dex lock"><i>❔</i><b>???</b><em>미발견</em><span>힌트: ${e.hint}</span></div>`).join('');
    this.modal('dex', true);
  }

  async showCheer(wall) {
    const box = $('cheer-list');
    box.innerHTML = '<p class="meal-empty">불러오는 중…</p>';
    this.modal('cheer', true);
    const list = await wall.list();
    const cols = ['#fff3a8', '#ffd6e5', '#cdeccf', '#cfe3ff', '#ffe1c2', '#e6d9ff'];
    box.innerHTML = '';
    list.forEach((m, i) => {
      const n = document.createElement('div');
      n.className = 'note';
      n.style.background = cols[i % cols.length];
      n.style.transform = `rotate(${((i * 37) % 7) - 3}deg)`;
      n.textContent = m.text;
      if (!String(m.id).startsWith('d')) {
        const r = document.createElement('button');
        r.type = 'button';
        r.textContent = '신고';
        r.addEventListener('click', async () => { await wall.report(m); n.remove(); this.toast('신고했어요', '이 메시지는 이제 안 보여요'); });
        n.appendChild(r);
      }
      box.appendChild(n);
    });
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
