import { SYS, D } from '../arcade.js';

// 매점 타이쿤(HV STORE): 쉬는 시간 60초 동안 몰려드는 주문을 맞춰 팔아요. 하루가 끝나면 번 돈으로 업그레이드하고 다음 날로.
const ITEMS = [
  { id: 'milk', name: '바나나우유', price: 1500, color: '#ffe066' },
  { id: 'pie', name: '초코파이', price: 1000, color: '#8b5a2b' },
  { id: 'kimbap', name: '삼각김밥', price: 1800, color: '#2f2f2f' },
  { id: 'ramen', name: '컵라면', price: 2000, color: '#e8452c' },
  { id: 'ice', name: '아이스크림', price: 1200, color: '#8fd3ff' },
  { id: 'jelly', name: '젤리', price: 1300, color: '#ff6fae' },
];
const UPS = [
  { id: 'patience', name: '친절한 인사', desc: '손님이 25% 더 기다려 줘요', cost: 6000 },
  { id: 'tip', name: '포인트 적립', desc: '팁이 두 배', cost: 9000 },
  { id: 'menu', name: '진열대 확장', desc: '젤리를 팔 수 있어요', cost: 7000 },
  { id: 'speed', name: '바코드 스캐너', desc: '계산 0.4초 단축', cost: 8000 },
];
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export function tycoon() {
  let S, P = load('smash-tycoon', { day: 1, cash: 0, ups: [] });
  const menu = () => ITEMS.filter((it) => it.id !== 'jelly' || P.ups.includes('menu'));
  const newCust = () => {
    const n = 1 + Math.floor(Math.random() * Math.min(3, 1 + P.day / 2));
    const want = Array.from({ length: n }, () => menu()[Math.floor(Math.random() * menu().length)].id);
    const pat = (8.5 - Math.min(4, P.day * 0.45)) * (P.ups.includes('patience') ? 1.25 : 1);
    return { want, got: [], pat, max: pat, face: ['🙂', '😀', '😐'][Math.floor(Math.random() * 3)], x: 0 };
  };
  const reset = () => { S = { t: 60, queue: [newCust()], next: 2, earned: 0, served: 0, lost: 0, combo: 0, msg: '', msgT: 0, btn: [], busy: 0 }; };
  return {
    id: 'tycoon', title: '매점 타이쿤', light: true, place: 'HV STORE · 쉬는 시간 60초',
    icon: '<svg viewBox="0 0 48 48"><rect x="8" y="16" width="32" height="24" rx="4" fill="#ffc94a"/><path d="M8 16l4-8h24l4 8" fill="#ff9f0a"/><rect x="20" y="26" width="8" height="14" rx="2" fill="#1c1c1e"/></svg>',
    desc: '쉬는 시간 종이 치면 매점에 줄이 서요. 주문을 정확히 맞춰 많이 팔아 보세요.',
    how: ['맨 앞 손님의 말풍선을 보고 아래 상품을 눌러 담아요.', '다 담으면 자동으로 계산돼요. 빨리 맞출수록 팁이 붙어요.', '하루가 끝나면 번 돈으로 업그레이드를 사요. 날마다 손님이 늘어요.'],
    fmt: (v) => `${v.toLocaleString('ko-KR')}원`,
    extra() {
      return `<p class="arc-x-t">${P.day}일째 · 모은 돈 ${P.cash.toLocaleString('ko-KR')}원</p><div class="arc-ups">${UPS.map((u) => `<button type="button" data-u="${u.id}" ${P.ups.includes(u.id) || P.cash < u.cost ? 'disabled' : ''}><b>${u.name}</b><span>${P.ups.includes(u.id) ? '구매함' : `${u.desc} · ${u.cost.toLocaleString('ko-KR')}원`}</span></button>`).join('')}</div>`;
    },
    bindExtra(box, a) {
      for (const b of box.querySelectorAll('button[data-u]')) b.addEventListener('click', () => {
        const u = UPS.find((x) => x.id === b.dataset.u);
        if (!u || P.cash < u.cost || P.ups.includes(u.id)) return;
        P.cash -= u.cost; P.ups.push(u.id); save('smash-tycoon', P);
        a.hap?.play('badge');
        box.innerHTML = this.extra(); this.bindExtra(box, a);
      });
    },
    start() { P = load('smash-tycoon', P); reset(); },
    down(x, y, e) {
      if (S.busy > 0) return;
      const b = S.btn.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h);
      const c = S.queue[0];
      if (!b || !c) return;
      const need = c.want.filter((w, i) => !c.got[i]);
      const idx = c.want.findIndex((w, i) => w === b.id && !c.got[i]);
      if (idx < 0) { S.combo = 0; S.msg = '그건 안 시켰어요'; S.msgT = 1; this.a?.hap?.play('error'); return; }
      c.got[idx] = true;
      this.a?.hap?.play('tap');
      if (need.length === 1) {
        const base = c.want.reduce((s, id) => s + ITEMS.find((it) => it.id === id).price, 0);
        const tip = Math.round((c.pat / c.max) * 500 * (P.ups.includes('tip') ? 2 : 1) / 100) * 100;
        S.combo++;
        S.earned += base + tip + (S.combo >= 3 ? 300 : 0);
        S.served++;
        S.msg = tip ? `+${(base + tip).toLocaleString('ko-KR')}원 (팁 ${tip.toLocaleString('ko-KR')})` : `+${base.toLocaleString('ko-KR')}원`; S.msgT = 1.2;
        S.busy = P.ups.includes('speed') ? 0.15 : 0.55;
        S.queue.shift();
        this.a?.hap?.play('select');
      }
    },
    update(dt, a) {
      this.a = a;
      S.t -= dt; S.busy -= dt; S.msgT -= dt;
      S.next -= dt;
      if (S.next <= 0 && S.queue.length < 6) { S.queue.push(newCust()); S.next = Math.max(0.9, 2.6 - P.day * 0.22) * (0.6 + Math.random() * 0.8); }
      for (const c of S.queue) c.pat -= dt * (c === S.queue[0] ? 1 : 0.5);
      if (S.queue[0] && S.queue[0].pat <= 0) { S.queue.shift(); S.lost++; S.combo = 0; S.msg = '손님이 그냥 갔어요'; S.msgT = 1.2; a.hap?.play('error'); }
      a.score(S.earned);
      if (S.t <= 0) {
        P.cash += S.earned; P.day++; save('smash-tycoon', P);
        a.finish({ score: S.earned, win: S.served >= 12, title: `${P.day - 1}일째 장사 끝`, detail: `${S.served}명에게 팔고 ${S.lost}명을 놓쳤어요 · 모은 돈 ${P.cash.toLocaleString('ko-KR')}원` });
      }
    },
    draw(g, W, H, a) {
      if (!S) reset();
      g.fillStyle = '#f2f2f7'; g.fillRect(0, 0, W, H);
      // 계산대
      g.fillStyle = '#ffffff'; g.fillRect(0, H * 0.52, W, H);
      g.fillStyle = '#e5e5ea'; g.fillRect(0, H * 0.52, W, 2);
      D.text(g, 'HV STORE', 20, 76, { size: 13, weight: 800, color: '#1c1c1e' });
      D.text(g, `${Math.max(0, Math.ceil(S.t))}초`, W - 20, 76, { size: 13, weight: 700, color: S.t < 10 ? SYS.red : '#3a3a3c', align: 'right', mono: true });
      // 줄 선 손님
      S.queue.forEach((c, k) => {
        const tx = W / 2 - k * Math.min(90, W / 7), y = H * 0.4;
        c.x = c.x ? D.lerp(c.x, tx, 0.15) : tx + 200;
        const x = c.x, sc = k ? 0.8 : 1;
        g.globalAlpha = k ? 0.75 : 1;
        g.fillStyle = '#3a3d43'; D.rr(g, x - 22 * sc, y - 10 * sc, 44 * sc, 60 * sc, 14 * sc); g.fill(); // 교복
        g.fillStyle = '#f08848'; g.beginPath(); g.arc(x, y - 28 * sc, 20 * sc, 0, Math.PI * 2); g.fill(); // 주황 머리
        // 기다림 막대
        D.rr(g, x - 22 * sc, y + 56 * sc, 44 * sc, 4, 2); g.fillStyle = '#e5e5ea'; g.fill();
        D.rr(g, x - 22 * sc, y + 56 * sc, 44 * sc * Math.max(0, c.pat / c.max), 4, 2); g.fillStyle = c.pat / c.max > 0.35 ? SYS.green : SYS.red; g.fill();
        g.globalAlpha = 1;
        if (k === 0) {
          // 주문 말풍선
          const bw = 40 + c.want.length * 46, bx = x - bw / 2, by = y - 118;
          D.rr(g, bx, by, bw, 58, 16); g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(0,0,0,0.12)'; g.shadowBlur = 12; g.fill(); g.shadowBlur = 0;
          c.want.forEach((id, i) => {
            const it = ITEMS.find((q) => q.id === id), ix = bx + 30 + i * 46;
            g.globalAlpha = c.got[i] ? 0.25 : 1;
            g.fillStyle = it.color; D.rr(g, ix - 15, by + 14, 30, 30, 8); g.fill();
            D.text(g, it.name.slice(0, 2), ix, by + 34, { size: 10, weight: 700, color: id === 'milk' || id === 'ice' ? '#1c1c1e' : '#fff', align: 'center' });
            g.globalAlpha = 1;
          });
        }
      });
      // 상품 버튼(2줄)
      const list = menu(), cols = 3, pad = 12, bw = (W - pad * (cols + 1)) / cols, bh = Math.min(74, (H * 0.4 - pad * 3) / 2);
      S.btn = list.map((it, i) => ({ id: it.id, x: pad + (i % cols) * (bw + pad), y: H * 0.56 + Math.floor(i / cols) * (bh + pad), w: bw, h: bh, it }));
      for (const b of S.btn) {
        D.rr(g, b.x, b.y, b.w, b.h, 16); g.fillStyle = '#f2f2f7'; g.fill();
        g.fillStyle = b.it.color; D.rr(g, b.x + 14, b.y + b.h / 2 - 16, 32, 32, 9); g.fill();
        D.text(g, b.it.name, b.x + 56, b.y + b.h / 2 - 2, { size: 14, weight: 600, color: '#1c1c1e' });
        D.text(g, `${b.it.price.toLocaleString('ko-KR')}원`, b.x + 56, b.y + b.h / 2 + 16, { size: 11, color: '#8e8e93' });
      }
      if (S.msgT > 0) { g.globalAlpha = Math.min(1, S.msgT * 2); D.text(g, S.msg, W / 2, H * 0.5, { size: 14, weight: 700, color: S.msg.startsWith('+') ? SYS.green : SYS.red, align: 'center' }); g.globalAlpha = 1; }
      if (S.combo >= 3) D.text(g, `${S.combo}연속 정확`, 20, 98, { size: 12, weight: 700, color: SYS.orange });
    },
  };
}
