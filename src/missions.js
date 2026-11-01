import { hashString } from './geom.js';

const todayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// 오늘의 미션. 날짜로 하나를 골라서 모두가 같은 날 같은 미션을 해요.
export class Missions {
  constructor({ biggest, hasCart }) {
    const big = biggest?.name || '가장 큰 건물';
    const pool = [
      { id: 'biggest30', text: `${big} 30초 안에 무너뜨리기`, p: (s) => (s.collapsed.some((c) => c.id === biggest?.id && c.t <= 30) ? 1 : 0) },
      { id: 'meteor40', text: '운석만 써서 40% 부수기', p: (s) => (s.onlyTool('meteor') ? s.percent / 0.4 : 0) },
      { id: 'rocket2', text: '로켓으로 건물 2동 무너뜨리기', p: (s) => s.collapseBy('rocket') / 2 },
      { id: 'trees60', text: '나무와 철쭉 60그루 날리기', p: (s) => s.trees / 60 },
      { id: 'grade1', text: '1등급 찍기', p: (s) => (9 - s.bestGrade) / 8 },
      { id: 'quake2', text: '지진 한 번으로 건물 2동 무너뜨리기', p: (s) => s.quakeBest / 2 },
      { id: 'landslide1', text: '산사태로 건물 1동 무너뜨리기', p: (s) => s.collapseBy('landslide') },
      { id: 'laser800', text: '레이저로 800㎥ 녹이기', p: (s) => (s.volume.laser || 0) / 800 },
      { id: 'bat1', text: '배트로 건물 1동 무너뜨리기', p: (s) => s.collapseBy('bat') },
      { id: 'half60', text: '1분 안에 절반 부수기', p: (s) => (s.t <= 60 || s.halfAt ? (s.halfAt ? 1 : s.percent / 0.5) : 0) },
    ];
    if (hasCart) pool.push({ id: 'cart', text: '학교를 도는 골프 카트 날리기', p: (s) => (s.cart ? 1 : 0) });
    const key = todayKey();
    this.key = key;
    this.mission = pool[hashString(key) % pool.length];
    try { this.doneToday = localStorage.getItem('smash-mission') === `${key}:${this.mission.id}`; } catch { this.doneToday = false; }
    this.reset();
  }

  reset() {
    this.s = {
      t: 0, percent: 0, bestGrade: 9, trees: 0, cart: false, halfAt: 0, quakeBest: 0,
      volume: {}, used: new Set(), collapsed: [], byTool: {},
      onlyTool(id) { return this.used.size === 1 && this.used.has(id); },
      collapseBy(id) { return this.byTool[id] || 0; },
    };
    this.quakes = new Map();
    this.done = false;
  }

  onHit(res, tool, extra = {}) {
    const s = this.s;
    s.used.add(tool);
    s.volume[tool] = (s.volume[tool] || 0) + res.volume;
    for (const b of res.collapses) {
      s.collapsed.push({ id: b.id, t: s.t });
      s.byTool[tool] = (s.byTool[tool] || 0) + 1;
      if (extra.quakeId && this.quakes.has(extra.quakeId)) {
        const n = this.quakes.get(extra.quakeId) + 1;
        this.quakes.set(extra.quakeId, n);
        s.quakeBest = Math.max(s.quakeBest, n);
      }
    }
    s.trees += extra.trees || 0;
    if (extra.cart) s.cart = true;
  }

  quakeStart(id) { this.quakes.set(id, 0); }
  quakeEnd(id) { this.quakes.delete(id); }

  // 완료되는 순간에만 true를 돌려줍니다.
  update(dt, percent, bestGrade) {
    const s = this.s;
    s.t += dt;
    s.percent = percent;
    s.bestGrade = Math.min(s.bestGrade, bestGrade);
    if (!s.halfAt && percent >= 0.5 && s.t <= 60) s.halfAt = s.t;
    if (this.done) return false;
    if (this.progress() >= 1) {
      this.done = true;
      const first = !this.doneToday;
      this.doneToday = true;
      try { localStorage.setItem('smash-mission', `${this.key}:${this.mission.id}`); } catch { /* 저장 못 해도 진행 */ }
      return { first };
    }
    return false;
  }

  progress() {
    return Math.max(0, Math.min(1, this.mission.p(this.s)));
  }
}
