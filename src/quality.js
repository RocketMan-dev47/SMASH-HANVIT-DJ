// 화질 자동 조절: 1초마다 프레임 속도를 재서, 느리면 한 단계씩 내리고 여유로우면 다시 올려요.
// 단계: 2(높음) → 1(보통) → 0(낮음). '자동'이 아니면 고른 단계로 고정해요.
export const LEVELS = [
  { name: '낮음', ratio: 1, shadows: false, fall: 0.35 },
  { name: '보통', ratio: 1.5, shadows: true, fall: 0.7 },
  { name: '높음', ratio: 2, shadows: true, fall: 1 },
];

export class Quality {
  constructor({ renderer, sun, seasons, onChange }) {
    this.r = renderer; this.sun = sun; this.seasons = seasons; this.onChange = onChange;
    let saved = null;
    try { saved = localStorage.getItem('smash-quality'); } catch { /* 무시 */ }
    this.mode = saved || 'auto';
    // 처음 단계: 코어 수·메모리·폰 여부로 미리 짐작
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4, phone = Math.min(innerWidth, innerHeight) < 600;
    this.level = this.mode === 'auto' ? (cores >= 8 && mem >= 8 && !phone ? 2 : cores >= 4 && mem >= 4 ? 1 : 0) : Number(this.mode);
    this.frames = 0; this.acc = 0; this.low = 0; this.high = 0;
  }

  set(mode) {
    this.mode = mode;
    try { localStorage.setItem('smash-quality', mode); } catch { /* 무시 */ }
    if (mode !== 'auto') this.apply(Number(mode));
  }

  apply(level) {
    this.level = Math.max(0, Math.min(2, level));
    const L = LEVELS[this.level];
    if (!document.body.classList.contains('blockworld')) this.r.setPixelRatio(Math.min(devicePixelRatio || 1, L.ratio));
    this.r.shadowMap.enabled = L.shadows;
    this.sun.castShadow = L.shadows;
    this.seasons?.setDensity?.(L.fall);
    this.onChange?.(this.level);
  }

  tick(dt) {
    this.frames++; this.acc += dt;
    if (this.acc < 1) return;
    const fps = this.frames / this.acc;
    this.frames = 0; this.acc = 0;
    if (this.mode !== 'auto' || document.hidden) return;
    if (fps < 40) { this.low++; this.high = 0; } else if (fps > 57) { this.high++; this.low = 0; } else { this.low = 0; this.high = 0; }
    if (this.low >= 4 && this.level > 0) { this.low = 0; this.apply(this.level - 1); }
    if (this.high >= 12 && this.level < 2) { this.high = 0; this.apply(this.level + 1); }
  }
}
