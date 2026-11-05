// 시즌 패스: 학기마다 새로 시작해요. 게임·배지·출석·랜덤 이벤트로 경험치(XP)를 모아 30단계 보상을 받아요.
const PER = 250; // 단계당 XP
export const REWARDS = [
  [1, 'title', '새내기 레이서'], [3, 'xp', '보너스 XP 100'], [5, 'skin', 'bag'], [7, 'title', '매점 단골'], [9, 'xp', '보너스 XP 150'],
  [10, 'title', '도킹 관제사'], [12, 'skin', 'tray'], [14, 'title', '운석 요격수'], [16, 'xp', '보너스 XP 200'], [18, 'skin', 'chair'],
  [20, 'title', '크레인 장인'], [22, 'title', '승부차기의 신'], [24, 'skin', 'mop'], [26, 'title', '슈팅 가드'], [28, 'skin', 'slipper'],
  [30, 'title', '한빛 레전드'],
];
const SKIN_NAME = { bag: '책가방 썰매', tray: '급식판 카트', chair: '바퀴 의자', mop: '청소 카트', slipper: '실내화' };

// 학기 이름(예: 2026-2학기): 3~8월 17일 1학기, 8월 18일~2월 2학기
export function seasonKey(d = new Date()) {
  const m = d.getMonth() + 1, y = d.getFullYear();
  if (m >= 3 && (m < 8 || (m === 8 && d.getDate() < 18))) return { id: `${y}-1`, name: `${y}학년도 1학기` };
  const sy = m <= 2 ? y - 1 : y;
  return { id: `${sy}-2`, name: `${sy}학년도 2학기` };
}

export class SeasonPass {
  constructor({ onReward, toast }) {
    this.onReward = onReward; this.toast = toast;
    this.key = seasonKey();
    try { this.s = JSON.parse(localStorage.getItem('smash-pass') || 'null'); } catch { this.s = null; }
    if (this.s && this.s.id !== this.key.id) {
      // 지난 학기 기록은 앨범용으로 남겨요
      try { const h = JSON.parse(localStorage.getItem('smash-pass-history') || '[]'); h.push({ id: this.s.id, xp: this.s.xp, level: Math.min(30, Math.floor(this.s.xp / PER)) }); localStorage.setItem('smash-pass-history', JSON.stringify(h.slice(-8))); } catch { /* 무시 */ }
    }
    if (!this.s || this.s.id !== this.key.id) this.s = { id: this.key.id, xp: 0, claimed: [], days: [] };
    this.save();
    // 하루 첫 접속 +30
    const today = new Date().toDateString();
    if (!this.s.days.includes(today)) { this.s.days.push(today); this.s.days = this.s.days.slice(-200); this.add(30, '오늘 첫 접속'); }
  }

  save() { try { localStorage.setItem('smash-pass', JSON.stringify(this.s)); } catch { /* 무시 */ } }
  level() { return Math.min(30, Math.floor(this.s.xp / PER)); }
  title() { const got = REWARDS.filter(([lv, k]) => k === 'title' && this.s.claimed.includes(lv)); return got.length ? got[got.length - 1][2] : ''; }

  add(xp, why) {
    const before = this.level();
    this.s.xp += Math.round(xp);
    this.save();
    const after = this.level();
    for (let lv = before + 1; lv <= after; lv++) this.claim(lv, true);
    return after > before;
  }

  claim(lv, auto) {
    const r = REWARDS.find(([l]) => l === lv);
    if (!r || this.s.claimed.includes(lv)) return;
    this.s.claimed.push(lv); this.save();
    const [, kind, val] = r;
    if (kind === 'xp') this.s.xp += Number(val.replace(/\D/g, '')) || 0;
    this.onReward?.(kind, val, lv);
    if (auto) this.toast?.(`시즌 ${lv}단계`, kind === 'skin' ? `차 스킨 “${SKIN_NAME[val]}” 획득` : kind === 'title' ? `칭호 “${val}” 획득` : val);
    this.save();
  }

  render(box) {
    const lv = this.level(), into = this.s.xp - lv * PER;
    box.innerHTML = `
      <div class="sp-head">
        <div class="sp-ring" style="--p:${lv >= 30 ? 1 : into / PER}"><b>${lv}</b><span>단계</span></div>
        <div><p class="sp-season">${this.key.name} 시즌</p><p class="sp-xp">${this.s.xp.toLocaleString('ko-KR')} XP${lv < 30 ? ` · 다음 단계까지 ${PER - into} XP` : ' · 최고 단계'}</p>${this.title() ? `<p class="sp-title">칭호 ${this.title()}</p>` : ''}</div>
      </div>
      <p class="sp-how">미니게임 한 판 40 XP(이기면 120) · 배지 50 · 랜덤 이벤트 목격 30 · 하루 첫 접속 30</p>
      <ol class="sp-list">${REWARDS.map(([l, k, v]) => `<li class="${this.s.claimed.includes(l) ? 'got' : l <= lv ? 'ready' : ''}"><span class="sp-lv">${l}</span><span class="sp-r">${k === 'skin' ? `차 스킨 · ${SKIN_NAME[v]}` : k === 'title' ? `칭호 · ${v}` : v}</span><span class="sp-st">${this.s.claimed.includes(l) ? '받음' : l <= lv ? '' : '잠김'}</span></li>`).join('')}</ol>`;
  }
}
