// HASA 우주정거장 건설 캠페인: 도킹과 운석 요격이 번갈아 나오는 10단계. 깰 때마다 정거장에 모듈이 하나씩 붙어요.
import { docking } from './games/docking.js';
import { meteor } from './games/meteor.js';

export const STAGES = [
  { type: 'docking', name: '핵심 모듈 도킹', mod: '핵심 모듈', story: '정거장의 첫 조각. 천천히, 정확하게.' },
  { type: 'meteor', name: '건설 궤도 정리', mod: '방어막 1', story: '건설 궤도로 들어오는 운석을 치워요.' },
  { type: 'docking', name: '태양전지판 1', mod: '태양전지판 1', story: '전력이 생기면 정거장이 살아나요.' },
  { type: 'docking', name: '실험 모듈 \u201c한빛\u201d', mod: '실험 모듈', story: '한빛고 과학실이 우주로.' },
  { type: 'meteor', name: '유성우 경보', mod: '방어막 2', story: '유성우 예보. 실험 모듈을 지켜요.' },
  { type: 'docking', name: '거주 모듈', mod: '거주 모듈', story: '첫 승무원이 머물 곳.' },
  { type: 'docking', name: '태양전지판 2', mod: '태양전지판 2', story: '전력 두 배.' },
  { type: 'meteor', name: '큰 운석 접근', mod: '방어막 3', story: '가스를 뿜는 큰 운석. 세 번 모두 맞혀야 해요.' },
  { type: 'docking', name: '로봇 팔', mod: '로봇 팔', story: '이제 정거장이 스스로 짐을 받아요.' },
  { type: 'docking', name: '귀환선 도킹', mod: '귀환선', story: '마지막 도킹. 완공 기념 비행.' },
];
const KEY = 'smash-campaign';
export const campaign = {
  done() { try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; } },
  win(i) { if (i === this.done()) { try { localStorage.setItem(KEY, String(i + 1)); } catch { /* 무시 */ } return true; } return false; },
  game(i) {
    const st = STAGES[i], o = { level: i + 1, stage: i, title: `${i + 1}단계 · ${st.name}`, place: 'HASA 우주정거장 건설 캠페인' };
    return st.type === 'docking' ? docking(o) : meteor(o);
  },
};

// 정거장 그림(SVG): 깬 단계까지 모듈이 붙어요
export function stationSVG(n) {
  const parts = [
    '<rect x="140" y="88" width="40" height="24" rx="6" fill="#d7d9dc"/>',
    '<circle cx="160" cy="100" r="40" fill="none" stroke="#64d2ff" stroke-width="1.5" stroke-dasharray="3 4"/>',
    '<rect x="40" y="92" width="96" height="16" fill="#1f4fa8" stroke="#8fd3ff"/><path d="M52 92v16M64 92v16M76 92v16M88 92v16M100 92v16M112 92v16M124 92v16" stroke="#8fd3ff" stroke-width=".6"/>',
    '<rect x="184" y="90" width="44" height="20" rx="5" fill="#f2f4f7"/><text x="206" y="104" font-size="8" text-anchor="middle" fill="#0b2a5e" font-weight="700">HANVIT</text>',
    '<circle cx="160" cy="100" r="52" fill="none" stroke="#64d2ff" stroke-width="1.5" stroke-dasharray="3 4"/>',
    '<rect x="146" y="40" width="28" height="44" rx="6" fill="#e5e5ea"/>',
    '<rect x="184" y="92" width="96" height="16" fill="#1f4fa8" stroke="#8fd3ff" transform="translate(48 0)"/>',
    '<circle cx="160" cy="100" r="64" fill="none" stroke="#64d2ff" stroke-width="1.5" stroke-dasharray="3 4"/>',
    '<path d="M174 120l20 22 18-6" stroke="#ffd60a" stroke-width="4" fill="none" stroke-linecap="round"/>',
    '<path d="M150 116l10 30 10-30z" fill="#ff9f0a"/><rect x="152" y="146" width="16" height="10" rx="3" fill="#f2f4f7"/>',
  ];
  return `<svg viewBox="0 0 320 200" class="camp-svg" aria-hidden="true"><rect width="320" height="200" fill="#000"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 73) % 320}" cy="${(i * 41) % 200}" r="${i % 3 ? 0.6 : 1}" fill="#fff" opacity=".6"/>`).join('')}${parts.slice(0, n).join('')}${n === 0 ? '<text x="160" y="104" text-anchor="middle" font-size="11" fill="#8e8e93">아직 아무것도 없어요</text>' : ''}</svg>`;
}
