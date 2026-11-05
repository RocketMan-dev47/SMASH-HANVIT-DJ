// 첫 실행 안내: 처음 들어온 사람에게 카드 4장(옆으로 넘기기)
const $ = (id) => document.getElementById(id);
const CARDS = [
  ['🏫', '진짜 한빛고를 그대로', '실제 지도와 지형으로 만든 우리 학교예요. 끌어서 돌리고, 두 손가락으로 확대해 보세요.'],
  ['💥', 'SMASH 모드 · 둘러보기 모드', '왼쪽 위 스위치로 바꿔요. 부수기는 아래 무기 바, 둘러보기는 건물을 누르면 시설 안내가 나와요.'],
  ['🗂️', '앱 보관함', '왼쪽 아래 네 칸 버튼에 급식·시간표·D-day·도감·배지·설정이 다 들어 있어요.'],
  ['🔍', '숨은 재미를 찾아보세요', '고양이 쓰다듬기, 미래관 꾹 누르기, 와우관 연타, 하루 두 번 오는 택배차… 배지 86개가 기다려요.'],
];

export class Onboard {
  constructor() {
    this.el = $('ob');
    this.i = 0;
    $('ob-next').addEventListener('click', () => (this.i < CARDS.length - 1 ? this.go(this.i + 1) : this.close()));
    $('ob-skip').addEventListener('click', () => this.close());
    let x0 = null;
    this.el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    this.el.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (dx < -50 && this.i < CARDS.length - 1) this.go(this.i + 1); if (dx > 50 && this.i > 0) this.go(this.i - 1); });
  }

  shouldShow() { try { return !localStorage.getItem('smash-onboarded'); } catch { return false; } }

  open() {
    $('ob-track').innerHTML = CARDS.map(([e, t, d]) => `<section class="ob-card"><i>${e}</i><h2>${t}</h2><p>${d}</p></section>`).join('');
    $('ob-dots').innerHTML = CARDS.map((_, i) => `<b class="${i ? '' : 'on'}"></b>`).join('');
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.go(0);
  }

  go(i) {
    this.i = i;
    $('ob-track').style.transform = `translateX(${-i * 100}%)`;
    [...$('ob-dots').children].forEach((d, k) => d.classList.toggle('on', k === i));
    $('ob-next').textContent = i === CARDS.length - 1 ? '시작하기' : '다음';
  }

  close() {
    try { localStorage.setItem('smash-onboarded', '1'); } catch { /* 무시 */ }
    this.el.classList.remove('show');
    setTimeout(() => { this.el.hidden = true; }, 350);
  }
}
