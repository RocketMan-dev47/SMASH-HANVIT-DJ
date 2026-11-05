// 햅틱(진동): 무기·버튼마다 길이와 세기가 다른 진동 패턴. 안드로이드 크롬 등에서 동작해요(아이폰 사파리는 웹 진동을 막아 둬서 동작하지 않아요).
const P = {
  tap: 8, select: 14, toggle: [10, 30, 10],
  bomb: [35], bat: [12, 25, 45], tkd: [18, 20, 60], laser: 9, meteor: [20, 60, 90, 40, 140],
  landslide: [40, 25, 40, 25, 60], robodog: 10, flame: 7, rocket: [120, 60, 220, 60, 320], nuke: [60, 120, 300, 80, 500, 80, 800],
  collapse: [45, 30, 25], badge: [15, 60, 15, 60, 40], pet: [8, 40, 8], snow: 6, hunt: [30, 50, 30, 50, 120], error: [80, 50, 80],
};
const quake = (lv) => Array.from({ length: Math.min(14, 4 + lv) }, (_, i) => (i % 2 ? 25 : 30 + lv * 12));

// 아이폰(iOS 18 이상 사파리): 웹 진동 기능이 없어서, 진동이 나는 '스위치' 입력칸을 숨겨 두고 눌러 주는 방식으로 '톡' 진동을 내요.
// 세기·길이는 못 바꾸고, 패턴은 '톡'을 여러 번 나눠 쳐서 흉내 내요.
const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export class Haptics {
  constructor() {
    this.android = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    this.ios = !this.android && IOS && typeof document !== 'undefined';
    this.ok = this.android || this.ios;
    if (this.ios) {
      const input = document.createElement('input');
      input.type = 'checkbox'; input.id = 'hap-switch'; input.setAttribute('switch', '');
      const label = document.createElement('label');
      label.htmlFor = 'hap-switch';
      for (const el of [input, label]) { el.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'; document.body.appendChild(el); }
      this.label = label;
    }
    try { this.on = localStorage.getItem('smash-haptics') !== 'off'; } catch { this.on = true; }
    this.last = 0;
  }
  set(on) { this.on = on; try { localStorage.setItem('smash-haptics', on ? 'on' : 'off'); } catch { /* 무시 */ } }
  play(name, lv) {
    if (!this.ok || !this.on) return;
    const now = performance.now();
    // 연속 진동(레이저·화염)은 너무 잦지 않게
    if ((name === 'laser' || name === 'flame' || name === 'snow') && now - this.last < 110) return;
    this.last = now;
    const pat = name === 'quake' ? quake(lv || 7) : P[name] ?? P.tap;
    if (this.android) { try { navigator.vibrate(pat); } catch { /* 무시 */ } return; }
    // iOS: 진동 구간(짝수 칸) 수만큼 '톡'(최대 4번), 간격은 패턴 길이를 따라가요.
    const arr = Array.isArray(pat) ? pat : [pat];
    let t = 0, n = 0;
    for (let i = 0; i < arr.length && n < 4; i += 2, n++) {
      setTimeout(() => { try { this.label.click(); } catch { /* 무시 */ } }, t);
      t += Math.max(70, (arr[i] || 0) + (arr[i + 1] || 0));
    }
  }
}
