// HASA 앱 보관함: 좁은 화면에서는 버튼을 전부 접어 두고, 런처를 누르면
// 분류별 카드가 런처 버튼에서 튀어나오듯(스프링) 펼쳐져요. 기존 버튼을 대신 눌러 주는 방식이라 기능은 그대로예요.
const $ = (id) => document.getElementById(id);
const S = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  'life-tt': S('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9h16M9 9v11"/>'),
  'life-dday': S('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 1.5M9 3h6"/>'),
  'life-lost': S('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/><path d="M11 8.5v2.5h2"/>'),
  'life-cheer': S('<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3z"/><path d="M12 13s-3-1.8-3-3.6A1.6 1.6 0 0 1 12 8.5a1.6 1.6 0 0 1 3 .9c0 1.8-3 3.6-3 3.6z"/>'),
  'g-race': S('<path d="M4 18h16"/><rect x="9" y="4" width="6" height="12" rx="2.5"/><path d="M7 5h10M7 15h10"/>'),
  'g-soccer': S('<circle cx="12" cy="12" r="8"/><path d="M12 8l3 2-1 4h-4l-1-4z"/>'),
  'g-basketball': S('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4v16M6.5 6.5q5 5.5 0 11M17.5 6.5q-5 5.5 0 11"/>'),
  'g-tycoon': S('<path d="M4 9l2-4h12l2 4"/><rect x="4" y="9" width="16" height="11" rx="2"/><path d="M10 20v-5h4v5"/>'),
  'g-crane': S('<path d="M6 21V4M6 5h14M17 5v6"/><rect x="14.5" y="11" width="5" height="3" rx=".5"/>'),
  'g-meteor': S('<circle cx="15" cy="9" r="3.5"/><path d="M12.5 11.5L5 19"/><path d="M3 21h18"/>'),
  'g-landing': S('<rect x="10.5" y="3" width="3" height="12" rx="1.2"/><path d="M12 15v3M4 21h16M5 14h4M15 14h4"/>'),
  'g-campaign': S('<circle cx="12" cy="12" r="2.5"/><path d="M3 12h6M15 12h6M12 3v6M12 15v6"/><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/>'),
  'g-docking': S('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  'life-snow': S('<circle cx="12" cy="16" r="5"/><circle cx="12" cy="7.5" r="3.2"/><path d="M5 12l-2-1M19 12l2-1"/>'),
  block: S('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
};

export const GROUPS = [
  { id: 'play', name: '플레이', grad: ['#ff9a52', '#e8452c'], items: [['btn-reset', '다시 짓기'], ['btn-home', '처음 시점'], ['btn-follow', '따라가기'], ['btn-photo', '사진 모드'], ['btn-game', '타임캡슐'], ['btn-pickle', '피클볼'], ['btn-cinema', '사계 시네마'], ['block', '블록 월드']] },
  { id: 'games', name: '게임', grad: ['#5ac8fa', '#0a64d8'], items: [['g-race', '급식 레이싱'], ['g-soccer', '승부차기'], ['g-basketball', '농구'], ['g-tycoon', '매점 타이쿤'], ['g-crane', '증축 도우미'], ['g-meteor', '운석 막기'], ['g-landing', '착륙 챌린지'], ['g-docking', 'HASA 도킹'], ['g-campaign', '정거장 캠페인'], ['btn-pass', '시즌 패스']] },
  { id: 'life', name: '학교생활', grad: ['#4cd98a', '#178f74'], items: [['life-tt', '시간표'], ['life-dday', 'D-day'], ['btn-calendar', '달력'], ['btn-fortune', '학습운세'], ['life-lost', '분실물'], ['life-cheer', '응원의 벽'], ['btn-letter', '편지 카드'], ['life-snow', '눈사람']] },
  { id: 'collect', name: '모음', grad: ['#8a8cff', '#5a3df0'], items: [['btn-dex', '도감'], ['btn-badges', '배지'], ['btn-album', '나의 앨범'], ['btn-share', '공유 카드']] },
  { id: 'settings', name: '설정', grad: ['#a3abb8', '#5d6573'], items: [['btn-settings', '모든 설정'], ['btn-sound', '소리'], ['btn-night', '시간·날씨'], ['btn-suggest', '건의함'], ['btn-donate', '후원'], ['btn-teacher', '선생님']] },
];

export class Launcher {
  constructor({ hap, blockUnlocked, onBlock, blockOn, onGame }) {
    this.onGame = onGame;
    this.hap = hap;
    this.blockUnlocked = blockUnlocked;
    this.onBlock = onBlock;
    this.blockOn = blockOn;
    this.el = $('launcher');
    this.btn = $('launcher-btn');
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); this.isOpen ? this.close() : this.open(); });
    this.el.addEventListener('click', (e) => { if (e.target === this.el || e.target.classList.contains('lx-wrap')) this.close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen) this.close(); });
    // 아래로 쓸어내리면 닫혀요.
    let y0 = null;
    this.el.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
    this.el.addEventListener('pointerup', (e) => { if (y0 !== null && e.clientY - y0 > 90) this.close(); y0 = null; });
  }

  render() {
    const wrap = this.el.querySelector('.lx-wrap');
    wrap.innerHTML = `<header class="lx-head"><b>HASA 앱 보관함</b><span>아래로 쓸어내리면 닫혀요</span></header><div class="lx-grid">${GROUPS.map((g, gi) => {
      const items = g.items.filter(([id]) => id !== 'block' || this.blockUnlocked());
      return `<section class="lx-card" style="--gi:${gi}"><h3>${g.name}</h3><div class="lx-tiles">${items.map(([id, name], ti) => {
        const src = document.getElementById(id);
        const svg = ICON[id] || src?.querySelector('svg')?.outerHTML || '';
        const pressed = id === 'block' ? this.blockOn() : src?.getAttribute('aria-pressed') === 'true';
        // 켜짐·꺼짐 점은 진짜 스위치에만(시간·날씨는 창을 여는 버튼이라 제외)
        const toggle = id === 'block' || (id !== 'btn-night' && src?.hasAttribute('aria-pressed'));
        // g-* 타일은 게임 바로 열기(원래 버튼 없음)
        return `<button type="button" class="lx-tile" data-t="${id}" style="--ti:${ti};--a:${g.grad[0]};--b:${g.grad[1]}" aria-label="${name}${toggle ? (pressed ? ' 켜짐' : ' 꺼짐') : ''}"><i>${svg}${toggle ? `<em class="${pressed ? 'on' : ''}"></em>` : ''}</i><span>${name}</span></button>`;
      }).join('')}</div></section>`;
    }).join('')}</div>`;
    for (const t of wrap.querySelectorAll('.lx-tile')) {
      t.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = t.dataset.t;
        this.hap?.play('select');
        this.close(true);
        // 런처가 닫히는 모션 뒤에 원래 버튼을 눌러 줘요.
        setTimeout(() => { if (id === 'block') this.onBlock(); else if (id.startsWith('g-')) this.onGame?.(id.slice(2)); else document.getElementById(id)?.click(); }, 160);
      });
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.render();
    // 카드가 런처 버튼 자리에서 날아오도록 출발점을 알려 줘요.
    const r = this.btn.getBoundingClientRect();
    this.el.hidden = false;
    for (const card of this.el.querySelectorAll('.lx-card')) {
      const c = card.getBoundingClientRect();
      card.style.setProperty('--dx', `${r.left + r.width / 2 - (c.left + c.width / 2)}px`);
      card.style.setProperty('--dy', `${r.top + r.height / 2 - (c.top + c.height / 2)}px`);
    }
    this.btn.classList.add('open');
    this.hap?.play('toggle');
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.add('open')));
  }

  close(fast = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.btn.classList.remove('open');
    this.el.classList.remove('open');
    this.el.classList.add('closing');
    setTimeout(() => { this.el.hidden = true; this.el.classList.remove('closing'); }, fast ? 220 : 340);
  }
}
