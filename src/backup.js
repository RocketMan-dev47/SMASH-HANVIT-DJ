// 데이터 백업·복원: 배지·도감·내 일정·D-day·설정 등(smash-로 시작하는 기록)을 코드 하나로 묶어요.
// 압축(deflate) → base64url. 새 기기에서 QR을 찍거나 코드를 붙여 넣으면 그대로 옮겨져요.
const SKIP = ['smash-tlog', 'smash-telemetry', 'smash-hint-meal', 'smash-tele-notice'];

const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, Stream) {
  const s = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function exportCode() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('smash-') && !SKIP.includes(k) && !k.startsWith('smash-sn-')) data[k] = localStorage.getItem(k);
  }
  const raw = new TextEncoder().encode(JSON.stringify({ v: 1, at: Date.now(), data }));
  const packed = typeof CompressionStream !== 'undefined' ? await pipe(raw, CompressionStream) : raw;
  return `${typeof CompressionStream !== 'undefined' ? 'z' : 'p'}${b64(packed)}`;
}

export async function importCode(code) {
  const c = String(code || '').trim().replace(/^.*#restore=/, '');
  if (!c) throw new Error('empty');
  const bytes = unb64(c.slice(1));
  const raw = c[0] === 'z' ? await pipe(bytes, DecompressionStream) : bytes;
  const obj = JSON.parse(new TextDecoder().decode(raw));
  if (!obj || obj.v !== 1 || typeof obj.data !== 'object') throw new Error('format');
  let n = 0;
  for (const [k, v] of Object.entries(obj.data)) if (k.startsWith('smash-')) { localStorage.setItem(k, v); n++; }
  return { n, at: obj.at };
}

// QR(링크) 그리기: qrcode-generator(CDN)
export async function drawQR(canvas, text) {
  const mod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
  const qrcode = mod.default || mod;
  const q = qrcode(0, 'L');
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), cell = Math.max(2, Math.floor(240 / (n + 6))), pad = 3;
  canvas.width = canvas.height = (n + pad * 2) * cell;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#101a34';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + pad) * cell, (r + pad) * cell, cell, cell);
}
