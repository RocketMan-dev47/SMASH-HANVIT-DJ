import * as THREE from 'three';

// HASA: HANVIT Aeronautics and Space Administration. NASA "미트볼" 로고를 패러디한 한빛 우주청 로고.
const BLUE = '#0b3d91';
const RED = '#fc3d21';

function drawMeatball(g, S) {
  const c = S / 2;
  g.save();
  g.beginPath(); g.arc(c, c, S * 0.47, 0, Math.PI * 2); g.fillStyle = BLUE; g.fill();
  g.clip();
  // 별
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) {
    const r = S * (0.004 + rnd() * 0.008);
    g.beginPath(); g.arc(S * (0.1 + rnd() * 0.8), S * (0.1 + rnd() * 0.8), r, 0, Math.PI * 2); g.fill();
  }
  // 궤도
  g.strokeStyle = '#fff';
  g.lineWidth = S * 0.012;
  g.beginPath(); g.ellipse(c, c * 1.02, S * 0.42, S * 0.15, -0.35, 0, Math.PI * 2); g.stroke();
  // 빨간 벡터(한빛의 '빛'처럼 위로 솟는 V)
  g.fillStyle = RED;
  g.beginPath();
  g.moveTo(S * 0.12, S * 0.78);
  g.quadraticCurveTo(S * 0.45, S * 0.52, S * 0.95, S * 0.18);
  g.lineTo(S * 0.82, S * 0.37);
  g.quadraticCurveTo(S * 0.58, S * 0.5, S * 0.3, S * 0.78);
  g.closePath();
  g.fill();
  g.restore();
  // 글자
  g.fillStyle = '#fff';
  g.font = `italic 800 ${S * 0.25}px "Pretendard Variable", Pretendard, Helvetica, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = S * 0.012;
  g.strokeStyle = BLUE;
  g.strokeText('HASA', c, c * 1.02);
  g.fillText('HASA', c, c * 1.02);
}

let logoTex = null;
export function hasaLogoTexture() {
  if (logoTex) return logoTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  drawMeatball(c.getContext('2d'), 512);
  logoTex = new THREE.CanvasTexture(c);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  return logoTex;
}

// 조립동 벽에 붙일 큰 간판(로고 + 영문 이름)
export function hasaSignTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1280;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.save();
  g.translate(112, 40);
  drawMeatball(g, 800);
  g.restore();
  g.fillStyle = '#20314f';
  g.textAlign = 'center';
  g.font = '800 92px "Pretendard Variable", Pretendard, Helvetica, Arial, sans-serif';
  g.fillText('HANVIT', 512, 1000);
  g.font = '600 46px "Pretendard Variable", Pretendard, Helvetica, Arial, sans-serif';
  g.fillText('AERONAUTICS AND', 512, 1080);
  g.fillText('SPACE ADMINISTRATION', 512, 1140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 화면(UI)에 쓰는 작은 SVG 로고
export const HASA_SVG = `<svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
<circle cx="32" cy="32" r="30" fill="${BLUE}"/>
<g fill="#fff"><circle cx="14" cy="20" r="0.9"/><circle cx="48" cy="14" r="0.8"/><circle cx="20" cy="46" r="0.8"/><circle cx="44" cy="48" r="0.9"/><circle cx="52" cy="34" r="0.7"/><circle cx="26" cy="12" r="0.6"/></g>
<ellipse cx="32" cy="33" rx="27" ry="9.6" fill="none" stroke="#fff" stroke-width="1" transform="rotate(-20 32 33)"/>
<path d="M8 50 Q29 33 61 11 L52 23 Q37 32 19 50 Z" fill="${RED}"/>
<text x="32" y="38" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-style="italic" font-weight="800" font-size="16" fill="#fff" stroke="${BLUE}" stroke-width="0.6">HASA</text>
</svg>`;
