// 점수와 등급. 연달아 부수면 9등급에서 1등급으로 올라가고, 손을 놓으면 서서히 내려갑니다.
export class Score {
  constructor() { this.reset(); }

  reset() {
    this.bonus = this.bonus || 1;
    this.score = 0;
    this.heat = 0;
    this.idle = 0;
    this.bestGrade = 9;
    this.lastTool = null;
  }

  grade() { return Math.max(1, 9 - Math.floor(this.heat)); }

  mult() { return (1 + (9 - this.grade()) * 0.25) * this.bonus; }

  setBonus(b) { this.bonus = b; }

  add(points) {
    const p = Math.round(points * this.mult());
    this.score += p;
    return p;
  }

  hit({ volume, rubble, collapses }, tool, weight = 1) {
    const nc = collapses.length;
    if (volume <= 0 && rubble <= 0 && !nc) return 0;
    let w = (0.35 + Math.min(1.4, volume / 900) + Math.min(0.3, rubble * 0.02)) * weight + Math.min(0.6, nc * 0.4);
    if (weight >= 0.5) {
      if (this.lastTool && tool !== this.lastTool) w += 0.4; // 도구를 바꿔 쓰면 보너스
      this.lastTool = tool;
    }
    this.heat = Math.min(8.99, this.heat + w);
    this.idle = 0;
    const m = this.mult();
    const pts = Math.round((volume * 1.4 + rubble * 15) * m + nc * 900 * m);
    this.score += pts;
    this.bestGrade = Math.min(this.bestGrade, this.grade());
    return pts;
  }

  update(dt) {
    this.idle += dt;
    if (this.idle > 1.8) this.heat = Math.max(0, this.heat - dt * (0.45 + this.heat * 0.07));
  }
}
