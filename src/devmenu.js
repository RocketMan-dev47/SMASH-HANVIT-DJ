// 개발자 메뉴(명령 팔레트): Control + Shift + K. 검색하고 ↑ ↓ Enter로 실행해요.
// 일반 사용자에겐 보이지 않아요(주소 뒤 ?dev 를 붙이면 폰에서도 작은 DEV 버튼이 생겨요).
const $ = (id) => document.getElementById(id);

export class DevMenu {
  constructor(commands, { toast }) {
    this.cmds = commands; // [{ group, label, hint, run }]
    this.toast = toast;
    this.el = $('dev');
    this.q = $('dev-q');
    this.list = $('dev-list');
    this.sel = 0;
    this.q.addEventListener('input', () => { this.sel = 0; this.render(); });
    this.q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.sel = Math.min(this.sel + 1, this.shown.length - 1); this.render(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.sel = Math.max(this.sel - 1, 0); this.render(); }
      if (e.key === 'Enter') { e.preventDefault(); this.exec(this.shown[this.sel]); }
      if (e.key === 'Escape') this.close();
    });
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
    addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyK') { e.preventDefault(); this.el.hidden ? this.open() : this.close(); } });
    if (new URLSearchParams(location.search).has('dev')) { const b = $('dev-btn'); b.hidden = false; b.addEventListener('click', () => this.open()); }
  }

  open() { this.el.hidden = false; this.q.value = ''; this.sel = 0; this.render(); requestAnimationFrame(() => { this.el.classList.add('show'); this.q.focus(); }); }
  close() { this.el.classList.remove('show'); setTimeout(() => { this.el.hidden = true; }, 200); }

  exec(c) {
    if (!c) return;
    this.close();
    setTimeout(() => { try { const msg = c.run(); this.toast('개발자', msg || c.label); } catch (err) { this.toast('개발자 · 실패', String(err.message || err)); } }, 160);
  }

  render() {
    const q = this.q.value.trim().toLowerCase();
    this.shown = this.cmds.filter((c) => !q || `${c.group} ${c.label} ${c.hint || ''}`.toLowerCase().includes(q));
    let html = '', g = '';
    this.shown.forEach((c, i) => {
      if (c.group !== g) { g = c.group; html += `<li class="dev-g">${g}</li>`; }
      html += `<li class="dev-i ${i === this.sel ? 'on' : ''}" data-i="${i}"><span>${c.label}</span>${c.hint ? `<em>${c.hint}</em>` : ''}</li>`;
    });
    this.list.innerHTML = html || '<li class="dev-g">찾는 명령이 없어요</li>';
    for (const li of this.list.querySelectorAll('.dev-i')) li.addEventListener('click', () => this.exec(this.shown[Number(li.dataset.i)]));
    this.list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }
}
