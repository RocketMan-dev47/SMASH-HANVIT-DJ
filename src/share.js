// 인스타 스토리용 세로 공유 카드(1080 × 1920)
import { hasaLogoTexture } from './hasa.js';

export function makeShareCard(shot, info) {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d1838'); grad.addColorStop(1, '#1d2f5f');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // 게임 화면(가운데를 잘라서 위쪽에)
  const sh = 1180;
  const s = Math.max(W / shot.width, sh / shot.height);
  const sw = W / s, shh = sh / s;
  g.save();
  g.beginPath(); g.roundRect(48, 120, W - 96, sh - 120, 44); g.clip();
  g.drawImage(shot, (shot.width - sw) / 2, (shot.height - shh) / 2, sw, shh, 48, 120, W - 96, sh - 120);
  g.restore();
  const F = '"Pretendard Variable", Pretendard, -apple-system, sans-serif';
  g.fillStyle = '#fff';
  g.font = `800 64px ${F}`;
  g.fillText('SMASH', 64, 92);
  g.fillStyle = '#ffc94a';
  g.fillText('한빛', 300, 92);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = `600 34px ${F}`;
  g.textAlign = 'right';
  g.fillText(info.date, W - 64, 90);
  g.textAlign = 'left';
  // 점수
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.font = `600 38px ${F}`;
  g.fillText('오늘 부순 점수', 64, sh + 110);
  g.fillStyle = '#fff';
  g.font = `800 150px ${F}`;
  g.fillText(info.score, 56, sh + 260);
  const chips = [[`${info.grade}등급`, '#ffc94a'], [`부순 정도 ${info.pct}`, '#ffffff'], [`무너진 건물 ${info.bldg}`, '#ffffff']];
  let x = 64;
  g.font = `700 40px ${F}`;
  for (const [t, col] of chips) {
    const w = g.measureText(t).width + 56;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.roundRect(x, sh + 310, w, 76, 38); g.fill();
    g.fillStyle = col;
    g.fillText(t, x + 28, sh + 362);
    x += w + 18;
  }
  if (info.edition) {
    g.fillStyle = '#ff9fc6';
    g.font = `700 40px ${F}`;
    g.fillText(info.edition, 64, sh + 460);
  }
  // HASA 로고 + 만든 사람
  const logo = hasaLogoTexture().image;
  g.drawImage(logo, 64, H - 230, 150, 150);
  g.fillStyle = '#fff';
  g.font = `700 40px ${F}`;
  g.fillText(info.school, 240, H - 168);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = `500 32px ${F}`;
  g.fillText('Made By. @eh._.p_09', 240, H - 118);
  if (info.url) g.fillText(info.url.replace(/^https?:\/\//, ''), 240, H - 72);
  return c;
}
