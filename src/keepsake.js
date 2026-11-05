// 간직하기: 나의 한빛 앨범(졸업 앨범) · 가정의 달 편지 카드. 둘 다 이미지로 저장·공유할 수 있어요.
import { patchSVG } from './badges.js';

const $ = (id) => document.getElementById(id);
const F = '"Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif';
const HAND = '"Gaegu", "Nanum Pen Script", "Pretendard Variable", sans-serif';

// 캔버스를 이미지로 공유(지원 안 되면 내려받기)
export async function shareCanvas(cv, name, title) {
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title }); return 'shared'; } catch { /* 취소 */ } }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}

const wrap = (g, text, x, y, maxW, lh) => {
  let line = '', yy = y;
  for (const ch of text) { const t = line + ch; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = ch; yy += lh; } else line = t; }
  if (line) g.fillText(line, x, yy);
  return yy + lh;
};

// ---------- 나의 한빛 앨범 ----------
export class Album {
  constructor({ gather, onSave }) {
    this.gather = gather; this.onSave = onSave;
    $('album-close').addEventListener('click', () => this.close());
    $('album').addEventListener('click', (e) => { if (e.target.id === 'album') this.close(); });
    $('album-save').addEventListener('click', async () => { const r = await shareCanvas(this.render(), 'hanvit-album.png', '나의 한빛 앨범'); this.onSave?.(r); });
  }
  close() { $('album').classList.remove('show'); setTimeout(() => { $('album').hidden = true; }, 250); }

  open() {
    const d = this.data = this.gather();
    const grad = d.graduation;
    $('album-title').textContent = grad ? `${d.year}년 졸업 앨범` : '나의 한빛 앨범';
    const pages = [
      `<section class="al-p al-cover"><p class="al-k">${grad ? 'GRADUATION' : 'MY HANVIT'}</p><h3>${grad ? '졸업을 축하해요' : '한빛에서 보낸 시간'}</h3><p>${d.first} 처음 들어온 날부터<br>${d.days}일을 함께했어요</p></section>`,
      `<section class="al-p"><p class="al-k">배지</p><h3>${d.badges.length}개의 임무 완수</h3><div class="al-patches">${d.badges.slice(-12).map(([b, no]) => patchSVG(b, no, true)).join('')}</div></section>`,
      `<section class="al-p"><p class="al-k">기록</p><h3>내가 세운 기록</h3><ul class="al-rec">${d.records.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('') || '<li><span>아직 기록이 없어요</span><b>-</b></li>'}</ul></section>`,
      `<section class="al-p"><p class="al-k">함께한 것들</p><h3>도감 ${d.dex}/11 · 정거장 ${d.station}/10</h3><ul class="al-rec"><li><span>시즌 패스</span><b>${d.season}</b></li><li><span>모은 쪽지</span><b>${d.notes.length}장</b></li><li><span>태권도</span><b>${d.belt}</b></li><li><span>가장 좋아한 무기</span><b>${d.favTool}</b></li></ul></section>`,
      `<section class="al-p al-notes"><p class="al-k">마음</p><h3>${d.notes.length ? '주워 모은 쪽지' : '아직 쪽지가 없어요'}</h3>${d.notes.slice(0, 3).map((n) => `<p class="al-note">${n}</p>`).join('')}<p class="al-end">${grad ? '3년 동안 정말 수고 많았어요. 어디서든 반짝일 거예요.' : '앨범은 계속 채워져요. 3학년 졸업식 즈음엔 졸업 앨범이 돼요.'}</p></section>`,
    ];
    $('album-pages').innerHTML = pages.join('');
    $('album-pages').scrollLeft = 0;
    $('album').hidden = false;
    requestAnimationFrame(() => $('album').classList.add('show'));
  }

  // 한 장짜리 요약 이미지(1080×1350)
  render() {
    const d = this.data, cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1350;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, '#0b1a33'); bg.addColorStop(1, '#1f3f7a');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 90; i++) g.fillRect((i * 173) % 1080, (i * 97) % 600, 2, 2);
    g.fillStyle = '#ffc94a'; g.font = `700 30px ${F}`; g.fillText(d.graduation ? 'GRADUATION ALBUM' : 'MY HANVIT ALBUM', 80, 130);
    g.fillStyle = '#fff'; g.font = `800 84px ${F}`; g.fillText(d.graduation ? `${d.year} 졸업 앨범` : '나의 한빛 앨범', 80, 230);
    g.font = `500 34px ${F}`; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText(`${d.first}부터 ${d.days}일 · 대전한빛고등학교`, 80, 290);
    const tiles = [['배지', `${d.badges.length}`], ['도감', `${d.dex}/11`], ['정거장', `${d.station}/10`], ['쪽지', `${d.notes.length}장`], ['시즌', d.season], ['태권도', d.belt]];
    tiles.forEach(([k, v], i) => {
      const x = 80 + (i % 3) * 315, y = 360 + Math.floor(i / 3) * 190;
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(x, y, 290, 160, 28); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `600 28px ${F}`; g.fillText(k, x + 28, y + 52);
      g.fillStyle = '#fff'; g.font = `800 52px ${F}`; g.fillText(v, x + 28, y + 122);
    });
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `600 28px ${F}`; g.fillText('내가 세운 기록', 80, 790);
    g.font = `500 32px ${F}`;
    d.records.slice(0, 6).forEach(([k, v], i) => { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText(k, 80, 850 + i * 56); g.fillStyle = '#ffc94a'; g.textAlign = 'right'; g.fillText(v, 1000, 850 + i * 56); g.textAlign = 'left'; });
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.font = `500 26px ${F}`; g.fillText('SMASH 한빛 · @eh._.p_09', 80, 1290);
    return cv;
  }
}

// ---------- 가정의 달 편지 카드 ----------
export class LetterCard {
  constructor({ notes, clean, onSave }) {
    this.notes = notes; this.clean = clean; this.onSave = onSave;
    $('lc-close').addEventListener('click', () => this.close());
    $('letter').addEventListener('click', (e) => { if (e.target.id === 'letter') this.close(); });
    for (const id of ['lc-to', 'lc-line', 'lc-from']) $(id).addEventListener('input', () => this.preview());
    $('lc-save').addEventListener('click', async () => {
      const r = await shareCanvas(this.render(), 'to-mom-dad.png', '부모님께');
      this.onSave?.(r);
    });
  }
  close() { $('letter').classList.remove('show'); setTimeout(() => { $('letter').hidden = true; }, 250); }

  open() {
    const got = this.notes();
    $('lc-picks').innerHTML = got.length ? got.map((n, i) => `<label><input type="checkbox" value="${i}" ${i < 2 ? 'checked' : ''}><span>${n}</span></label>`).join('') : '<p class="lc-empty">아직 모은 쪽지가 없어요. 5월에 건물을 부수면 쪽지가 나와요. 아래에 직접 써도 돼요.</p>';
    for (const c of $('lc-picks').querySelectorAll('input')) c.addEventListener('change', () => { const on = [...$('lc-picks').querySelectorAll('input:checked')]; if (on.length > 3) c.checked = false; this.preview(); });
    $('letter').hidden = false;
    requestAnimationFrame(() => $('letter').classList.add('show'));
    this.preview();
  }

  lines() {
    const got = this.notes();
    const picked = [...$('lc-picks').querySelectorAll('input:checked')].map((c) => got[Number(c.value)]);
    const mine = this.clean($('lc-line').value.trim());
    return { to: this.clean($('lc-to').value.trim()) || '사랑하는 엄마 아빠께', lines: [...picked, ...(mine ? [mine] : [])], from: this.clean($('lc-from').value.trim()) || '' };
  }

  render() {
    const { to, lines, from } = this.lines();
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff6f8'; g.fillRect(0, 0, 1080, 1350);
    // 솜뭉치 구름
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 ? 'rgba(255,214,226,0.55)' : 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc((i * 211) % 1080, 60 + ((i * 89) % 160), 46 + (i % 4) * 14, 0, Math.PI * 2); g.fill(); }
    // 카네이션
    const flower = (x, y, s) => { g.strokeStyle = '#5a9a4a'; g.lineWidth = 8 * s; g.beginPath(); g.moveTo(x, y + 30 * s); g.lineTo(x, y + 150 * s); g.stroke(); for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#ff8fb1' : '#e8456f'; g.beginPath(); g.arc(x + Math.cos(k) * 26 * s, y + Math.sin(k * 1.7) * 16 * s, 30 * s, 0, Math.PI * 2); g.fill(); } };
    flower(930, 250, 0.9); flower(1005, 290, 0.6); // 오른쪽 위(글씨와 안 겹치게)
    // 줄 공책
    g.strokeStyle = '#f1d6dd'; g.lineWidth = 2; for (let y = 420; y < 1180; y += 64) { g.beginPath(); g.moveTo(90, y); g.lineTo(990, y); g.stroke(); }
    g.fillStyle = '#c0567e'; g.font = `800 34px ${F}`; g.fillText('가정의 달 · 5월', 90, 300);
    g.fillStyle = '#4a3b2f'; g.font = `700 56px ${HAND}`; g.fillText(`To. ${to}`, 90, 380);
    g.font = `500 44px ${HAND}`; g.fillStyle = '#4a3b2f';
    let y = 470;
    for (const l of lines.length ? lines : ['늘 고마워요. 사랑해요.']) y = wrap(g, `· ${l}`, 90, y, 780, 64) + 8;
    g.font = `700 46px ${HAND}`; g.textAlign = 'right'; g.fillStyle = '#c0567e'; g.fillText(from ? `From. ${from}` : 'From. 한빛고에서', 990, 1240); g.textAlign = 'left';
    g.fillStyle = 'rgba(74,59,47,0.35)'; g.font = `500 22px ${F}`; g.fillText('SMASH 한빛', 90, 1300);
    return cv;
  }

  preview() {
    const c = $('lc-preview'), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(this.render(), 0, 0, c.width, c.height);
  }
}
