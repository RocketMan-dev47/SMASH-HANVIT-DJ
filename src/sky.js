import * as THREE from 'three';

// 하루 시간대: 새벽 → 낮 → 노을 → 밤. 시각(0~24)을 넣으면 하늘·안개·빛 색을 섞어서 돌려줘요.
const C = (h) => new THREE.Color(h);
const NIGHT = { top: C('#0a1734'), bottom: C('#2c3a5c'), fog: C('#202b47'), hemi: 0.55, hemiC: C('#9db2e0'), sun: 0.8, sunC: C('#aabcff'), exp: 1.2 };
const DAWN = { top: C('#5d7fb8'), bottom: C('#f2b48a'), fog: C('#d9b9a6'), hemi: 0.95, hemiC: C('#e8d0c0'), sun: 1.7, sunC: C('#ffb27a'), exp: 1.1 };
const DAY = { top: C('#7fb0de'), bottom: C('#e8eef2'), fog: C('#dde6eb'), hemi: 1.35, hemiC: C('#d4e6ff'), sun: 3.1, sunC: C('#fff0d8'), exp: 1.05 };
const SUNSET = { top: C('#4a5f9e'), bottom: C('#ff9a5c'), fog: C('#e2a07a'), hemi: 1.0, hemiC: C('#ffd2b0'), sun: 2.0, sunC: C('#ff8a4a'), exp: 1.12 };
const DUSK = { top: C('#1b2550'), bottom: C('#6b4a6e'), fog: C('#3e3550'), hemi: 0.7, hemiC: C('#b0a0d0'), sun: 0.9, sunC: C('#c0a0ff'), exp: 1.15 };
const KEYS = [[0, NIGHT], [5.2, NIGHT], [6.3, DAWN], [8, DAY], [16.6, DAY], [18.3, SUNSET], [19.4, DUSK], [20.3, NIGHT], [24, NIGHT]];

export const PRESETS = { dawn: 6.3, day: 12.5, sunset: 18.3, night: 22 };
export const PRESET_NAME = { sync: '실시간', dawn: '새벽', day: '낮', sunset: '노을', night: '밤' };

export function isNightHour(h) { return h < 5.7 || h > 19.9; }

export function skyAt(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1];
  const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
  const s = t * t * (3 - 2 * t);
  const mix = (x, y) => x.clone().lerp(y, s);
  // 해: 6시 동쪽에서 떠서 19시 서쪽으로 져요(남쪽 하늘을 지나요). 밤에는 달빛 방향.
  const u = (h - 6) / 13;
  const day = u > -0.06 && u < 1.08;
  const el = day ? Math.max(0.08, Math.sin(Math.min(1, Math.max(0, u)) * Math.PI)) : 0.7;
  const az = day ? u * Math.PI : 0.6 * Math.PI;
  const dir = new THREE.Vector3(Math.cos(az) * Math.sqrt(1 - el * el), el, Math.sin(az) * 0.6 * Math.sqrt(1 - el * el) + 0.25).normalize();
  return {
    top: mix(a.top, b.top), bottom: mix(a.bottom, b.bottom), fog: mix(a.fog, b.fog),
    hemi: a.hemi + (b.hemi - a.hemi) * s, hemiC: mix(a.hemiC, b.hemiC),
    sun: a.sun + (b.sun - a.sun) * s, sunC: mix(a.sunC, b.sunC), exp: a.exp + (b.exp - a.exp) * s,
    dir, night: isNightHour(h),
  };
}
