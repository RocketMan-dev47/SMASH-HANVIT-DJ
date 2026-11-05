// 수능 날 첫 화면: 네잎클로버가 그려지고 → 옆으로 비켜서면 → 접힌 편지지가 펼쳐져요.
// 편지에는 응원의 벽 메시지 몇 개와 HASA의 인사가 담겨요. 하루에 한 번 자동으로, 그 뒤엔 에디션 칩을 눌러 다시 볼 수 있어요.
const $ = (id) => document.getElementById(id);

const CLOVER = `<svg viewBox="0 0 200 200" class="sn-clover" aria-hidden="true">
  <defs><linearGradient id="snl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ee07a"/><stop offset="1" stop-color="#2f9e44"/></linearGradient></defs>
  <g transform="translate(100 96)">
    ${[0, 90, 180, 270].map((a, i) => `<path class="leaf" style="--i:${i}" transform="rotate(${a})" d="M0 0 C -6 -18, -44 -30, -40 -56 C -37 -76, -10 -78, 0 -60 C 10 -78, 37 -76, 40 -56 C 44 -30, 6 -18, 0 0 Z" fill="url(#snl)" stroke="#1f6b3a" stroke-width="2.5"/>`).join('')}
    <path class="leaf vein" d="M0 0 L0 -50 M0 0 L50 0 M0 0 L0 50 M0 0 L-50 0" stroke="#d7f5c9" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
    <path class="stem" d="M0 8 C 6 40, 22 62, 40 84" fill="none" stroke="#2f7a3a" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>`;

export class SuneungLetter {
  constructor() {
    this.el = $('sn');
    $('sn-close').addEventListener('click', () => this.close());
  }

  async open({ cheer, year }) {
    let notes = [];
    try { notes = (await cheer.list()).filter((m) => m.text).slice(0, 6).map((m) => m.text); } catch { /* 무시 */ }
    $('sn-art').innerHTML = CLOVER;
    $('sn-to').textContent = `To. ${year}학년도 수능을 보는 3학년 선배님들께`;
    $('sn-notes').innerHTML = notes.map((t) => `<li>“${t.replace(/[<>&]/g, '')}”</li>`).join('');
    this.el.hidden = false;
    this.el.className = '';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.el.classList.add('s1'); // 클로버 그리기
      clearTimeout(this.t1); clearTimeout(this.t2);
      this.t1 = setTimeout(() => this.el.classList.add('s2'), 1500); // 클로버가 비켜서고 편지 펼치기
      this.t2 = setTimeout(() => this.el.classList.add('s3'), 2300); // 글씨 나타나기
    }));
  }

  close() {
    this.el.classList.add('out');
    setTimeout(() => { this.el.hidden = true; this.el.className = ''; }, 500);
  }
}
