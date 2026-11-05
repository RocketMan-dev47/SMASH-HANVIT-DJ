import { SYS, D } from '../arcade.js';

// 증축 공사 도우미: 타워크레인으로 벽돌 짐을 표시된 자리에 내려놓아요. 짐은 줄에 매달려 흔들려요(바람도 불어요).
// 성공한 짐 수가 쌓일수록 실제 공사장(3D)의 3층 벽이 조금씩 올라가요.
export const craneProgress = {
  get() { try { return Number(localStorage.getItem('smash-crane') || 0); } catch { return 0; } },
  add(n) { const v = this.get() + n; try { localStorage.setItem('smash-crane', String(v)); } catch { /* 무시 */ } return v; },
};

export function crane() {
  let S;
  const reset = (W, H) => {
    S = { trolley: W * 0.2, hook: 120, ang: 0, va: 0, wind: 0, windT: 0, loads: 0, misses: 0, drop: null, target: 0, stack: [], t: 0, over: false, in: {}, parts: [] };
    newTarget(W);
  };
  const newTarget = (W) => { S.target = W * (0.35 + Math.random() * 0.45); S.tw = Math.max(34, 66 - S.loads * 4); };
  return {
    id: 'crane', title: '증축 공사 도우미', light: true, place: '본관 증축 현장 · 타워크레인',
    icon: '<svg viewBox="0 0 48 48"><path d="M10 42V8h4v34M10 10h30" stroke="#ffd60a" stroke-width="3"/><path d="M32 10v12" stroke="#8e8e93" stroke-width="1.5"/><rect x="27" y="22" width="10" height="6" rx="1" fill="#b24e35"/></svg>',
    desc: '흔들리는 벽돌 짐을 3층 바닥의 표시된 자리에 정확히 내려놓아요.',
    how: ['◀ ▶(← →)로 트롤리를 움직이고, 내려놓기(스페이스)로 짐을 풀어요.', '짐이 흔들리니까 멈춰서 흔들림이 잦아들 때 내려놓아요. 바람도 불어요.', '10개 중 8개를 정확히 놓아야 공정 완료예요. 놓을 자리는 점점 좁아지고 바람은 세져요.'],
    fmt: (v) => `${v}개`,
    start(a) {
      reset(a.W, a.H);
      a.setPads([{ id: 'l', label: '◀', cls: 'l r2a' }, { id: 'r', label: '▶', cls: 'l r2b' }, { id: 'drop', label: '내려놓기', cls: 'r big' }], (id, v) => { S.in[id] = v; if (id === 'drop' && v) this.release(a); });
    },
    key(k, down) { if (k === 'ArrowLeft') S.in.l = down; if (k === 'ArrowRight') S.in.r = down; if (k === ' ' && down) this.release(this.a); },
    release(a) {
      if (S.drop || S.over) return;
      const L = S.hook, x = S.trolley + Math.sin(S.ang) * L, y = 90 + Math.cos(S.ang) * L;
      S.drop = { x, y, vx: Math.cos(S.ang) * S.va * L, vy: 0 };
      a?.hap?.play('tap');
    },
    update(dt, a) {
      this.a = a;
      if (S.over) return;
      S.t += dt;
      // 바람: 가끔 방향이 바뀌어요
      S.windT -= dt; if (S.windT <= 0) { S.wind = (Math.random() - 0.5) * (1.0 + S.loads * 0.12); S.windT = 3 + Math.random() * 3; }
      const acc = ((S.in.r ? 1 : 0) - (S.in.l ? 1 : 0)) * 180;
      const vPrev = S.tv || 0;
      S.tv = D.clamp(vPrev + acc * dt - vPrev * dt * 2.5, -160, 160);
      S.trolley = D.clamp(S.trolley + S.tv * dt, 60, a.W - 30);
      // 진자: 트롤리 가속도와 바람이 흔들어요
      const L = S.hook / 100;
      S.va += (-9.8 / L * Math.sin(S.ang) - ((S.tv - vPrev) / dt) / 100 / L * Math.cos(S.ang) + S.wind) * dt;
      S.va *= 1 - dt * 0.35;
      S.ang += S.va * dt;
      if (S.drop) {
        const d = S.drop, floor = a.H - 150;
        d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.y >= floor - 14) {
          const off = Math.abs(d.x - S.target), good = off < S.tw / 2 - 8;
          if (good) { S.loads++; S.stack.push(d.x); D.burst(S.parts, d.x, floor, 18, '#c9a37a', 140); a.hap?.play('select'); }
          else { S.misses++; D.burst(S.parts, d.x, floor, 26, '#8e8e93', 220); a.hap?.play('error'); }
          S.drop = null;
          a.score(S.loads);
          if (S.loads + S.misses >= 10) {
            S.over = true;
            a.finish({ score: S.loads, win: S.loads >= 8, title: S.loads >= 8 ? '오늘 공정 완료' : '공정 지연', detail: `10개 중 ${S.loads}개 정확히 · 실제 공사장에 반영돼요` });
          } else newTarget(a.W);
        }
      }
    },
    draw(g, W, H, a, dt) {
      if (!S) reset(W, H);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#9ec9f0'); sky.addColorStop(1, '#e8f1f8');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const floor = H - 150;
      // 짓고 있는 건물(붉은 벽돌 2층 + 3층 바닥)
      g.fillStyle = '#a8452f'; g.fillRect(W * 0.25, floor, W * 0.7, H - floor);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = floor + 20; y < H; y += 46) for (let x = W * 0.29; x < W * 0.9; x += 44) g.fillRect(x, y, 26, 22);
      g.fillStyle = '#b9b6ae'; g.fillRect(W * 0.24, floor - 8, W * 0.72, 8);
      // 놓을 자리 표시
      g.strokeStyle = SYS.green; g.lineWidth = 2; g.setLineDash([6, 5]); D.rr(g, S.target - S.tw / 2, floor - 30, S.tw, 22, 4); g.stroke(); g.setLineDash([]);
      // 이미 놓은 짐
      for (const x of S.stack.slice(-6)) { g.fillStyle = '#b24e35'; D.rr(g, x - 22, floor - 22, 44, 14, 2); g.fill(); }
      // 크레인
      g.fillStyle = '#ffd60a'; g.fillRect(28, 60, 10, H - 60); g.fillRect(28, 80, W - 40, 10);
      g.fillStyle = '#3a3a3c'; D.rr(g, S.trolley - 14, 88, 28, 10, 3); g.fill();
      const L = S.hook, hx = S.trolley + Math.sin(S.ang) * L, hy = 90 + Math.cos(S.ang) * L;
      g.strokeStyle = '#3a3a3c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(S.trolley, 96); g.lineTo(hx, hy); g.stroke();
      if (!S.drop) { g.save(); g.translate(hx, hy); g.rotate(-S.ang); g.fillStyle = '#b24e35'; D.rr(g, -22, 4, 44, 14, 2); g.fill(); g.restore(); }
      else { g.fillStyle = '#b24e35'; D.rr(g, S.drop.x - 22, S.drop.y, 44, 14, 2); g.fill(); }
      // 바람
      D.text(g, `바람 ${S.wind > 0 ? '→' : '←'} ${Math.abs(S.wind * 10).toFixed(1)}`, W - 20, H - 20, { size: 12, weight: 600, color: '#3a3a3c', align: 'right' });
      D.stepParticles(S.parts, dt, g, 400);
    },
  };
}
