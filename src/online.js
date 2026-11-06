import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { makeAvatar, animateAvatar, uniformFor } from './avatars.js';

// 온라인 모드(2.0): 켠 사람끼리만 연결돼요. 끄면 아무것도 보내지 않아요.
// - 함께 걷기: 내가 보고 있는 곳(1인칭이면 내 위치)에 교복 아바타. 이름은 무작위 + 학년, 지금 쓰는 무기, 이모지 반응(채팅 없음)
// - 협동 레이드: 점심·방과 후, 보스 본관 체력을 모두 함께 깎아요(체력은 접속자 수에 맞춰 자동)
// - 레이싱 고스트 공유·주간 순위: 서버에 최고 랩만 익명으로
const TOOL_EMOJI = { bomb: '💣', bat: '🏏', laser: '🛸', meteor: '☄️', quake: '〰️', landslide: '⛰️', tkd: '🥋', robodog: '🐕', rocket: '🚀', nuke: '☢️' };
export const EMOTES = ['👋', '❤️', '🔥', '👏', '😂', '💪'];

export class Online {
  constructor({ cfg, presence, world, ui, hap, onBadge, onXP, grade }) {
    Object.assign(this, { cfg, presence, w: world, ui, hap, onBadge, onXP, grade });
    this.on = false; this.peers = new Map(); this.flags = {};
    this.group = new THREE.Group(); world.scene.add(this.group);
    this.sendT = 0; this.last = null; this.raid = null; this.raidT = 0; this.pending = 0; this.myDmg = 0;
    this.client = presence.me?.id || Math.random().toString(36).slice(2, 10);
    this.windows = cfg.raid?.windows || [['12:40', '13:30', 'lunch', '점심 레이드'], ['16:50', '17:50', 'after', '방과 후 레이드']];
  }

  get available() { return !!(this.cfg.supabaseUrl && this.cfg.supabaseKey); }

  // 서버 함수 부르기(로그인 없는 익명 키)
  async rpc(fn, args) {
    const key = this.cfg.supabaseKey;
    const r = await fetch(`${this.cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, ...(String(key).startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    if (!r.ok) throw new Error(`${fn} ${r.status}`);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }

  async setOn(on) {
    if (on === this.on) return this.on;
    if (on) {
      if (!this.available) { this.ui.toast('온라인 모드', 'Supabase를 연결하면 켤 수 있어요'); return false; }
      try { this.flags = (await this.rpc('get_flags')) || {}; } catch { this.flags = {}; }
      if (this.flags.online_off) { this.ui.toast('온라인 모드가 잠시 꺼져 있어요', '선생님이 꺼 두셨어요. 나중에 다시 켜 봐요'); return false; }
      this.on = true;
      const me = this.presence.me;
      await this.presence.join('campus', {
        state: { grade: this.grade(), tool: this.tool || 'bomb' },
        onPeople: (list) => this.sync(list),
        onEvent: (type, p) => this.event(type, p),
      });
      this.makeSelf();
      this.ui.toast('🌐 온라인 켜짐', `${me.nick}${this.grade() ? ` · ${this.grade()}학년` : ''}(으)로 접속했어요`, 'gold');
      this.onBadge?.('online1');
    } else {
      this.on = false;
      await this.presence.leave('campus');
      for (const p of this.peers.values()) this.dropPeer(p);
      this.peers.clear(); this.raid = null; this.raidUI(null);
      if (this.self) { this.dropPeer(this.self); this.self = null; }
      this.ui.toast('온라인 꺼짐', '이제 아무것도 보내지 않아요');
    }
    return this.on;
  }

  // 접속자 목록이 바뀔 때
  sync(list) {
    const ids = new Set();
    for (const p of list) {
      if (p.self) continue;
      ids.add(p.id);
      let peer = this.peers.get(p.id);
      if (!peer) {
        if (this.peers.size >= 30) continue; // 너무 많으면 30명까지만 그려요
        peer = this.addPeer(p);
      }
      peer.info = p; peer.label.element.firstChild.textContent = `${p.nick}${p.grade ? ` · ${p.grade}학년` : ''}`;
      peer.tool.textContent = TOOL_EMOJI[p.tool] || '';
    }
    for (const [id, peer] of this.peers) if (!ids.has(id)) { this.dropPeer(peer); this.peers.delete(id); }
    this.count = ids.size + 1;
  }

  addPeer(p) {
    const month = new Date().getMonth() + 1;
    const g = makeAvatar(p, uniformFor(this.w.weatherTemp ?? 15, month));
    g.scale.setScalar(this.w.cats?.real ? 1 : 2.6); // 위에서 볼 땐 잘 보이게
    const el = document.createElement('div'); el.className = 'peer-label';
    el.innerHTML = '<span></span><b></b>';
    const label = new CSS2DObject(el); label.position.set(0, 2.4, 0); g.add(label);
    const peer = { g, label, tool: el.querySelector('b'), pos: null, target: new THREE.Vector3(), info: p, t: Math.random() * 6 };
    g.visible = false;
    this.group.add(g); this.peers.set(p.id, peer);
    return peer;
  }

  makeSelf() {
    if (this.self) return;
    const me = this.presence.me, month = new Date().getMonth() + 1;
    const g = makeAvatar(me, uniformFor(this.w.weatherTemp ?? 15, month));
    const el = document.createElement('div'); el.className = 'peer-label self';
    el.innerHTML = '<span></span><b></b>';
    el.firstChild.textContent = `나 · ${me.nick}${this.grade() ? ` · ${this.grade()}학년` : ''}`;
    const label = new CSS2DObject(el); label.position.set(0, 2.4, 0); g.add(label);
    this.group.add(g);
    this.self = { g, label, tool: el.querySelector('b'), pos: null, t: 0 };
  }

  dropPeer(peer) { peer.label.element.remove(); this.group.remove(peer.g); }

  event(type, p) {
    const peer = this.peers.get(p.from?.id);
    if (type === 'pos' && peer) { peer.target.set(p.x, this.w.terrain.heightAt(p.x, p.z), p.z); peer.yaw = p.r; if (!peer.pos) { peer.pos = peer.target.clone(); peer.g.visible = true; } if (p.tool) peer.tool.textContent = TOOL_EMOJI[p.tool] || ''; }
    else if (type === 'emo' && peer && EMOTES.includes(p.e)) this.bubble(peer, p.e);
    else if (type === 'rh' && this.raid && p.id === this.raid.id) { this.raid.total = Math.min(this.raid.hp, this.raid.total + Math.min(60000, Number(p.d) || 0)); this.raidUI(this.raid); }
  }

  bubble(peer, e) {
    const el = document.createElement('div'); el.className = 'peer-emo'; el.textContent = e;
    const o = new CSS2DObject(el); o.position.set(0, 3.4, 0); peer.g.add(o);
    setTimeout(() => { el.remove(); peer.g.remove(o); }, 2200);
  }

  emote(e) {
    if (!this.on || !EMOTES.includes(e)) return;
    this.presence.send('campus', 'emo', { e });
    if (this.self) this.bubble(this.self, e);
    this.hap?.play('tap');
    this.ui.toast(e, '친구들에게 보냈어요');
  }

  setTool(tool) {
    this.tool = tool;
    if (this.on) this.presence.update('campus', { grade: this.grade(), tool });
  }

  // 매 프레임: 내 위치 보내기(0.3초마다, 움직였을 때만) · 아바타 움직이기 · 레이드
  tick(dt, me) {
    if (!this.on) return;
    this.sendT -= dt;
    if (this.sendT <= 0 && me) {
      this.sendT = 0.3;
      const moved = !this.last || Math.hypot(me.x - this.last.x, me.z - this.last.z) > 0.6 || me.tool !== this.last.tool;
      if (moved) { this.presence.send('campus', 'pos', { x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10, r: Math.round((me.r || 0) * 100) / 100, tool: me.tool }); this.last = { ...me }; }
    }
    const real = !!this.w.cats?.real;
    if (this.self && me) {
      const S = this.self, tgt = new THREE.Vector3(me.x, this.w.terrain.heightAt(me.x, me.z), me.z);
      if (!S.pos) S.pos = tgt.clone();
      const d = S.pos.distanceTo(tgt);
      if (d > 60) S.pos.copy(tgt); else S.pos.lerp(tgt, Math.min(1, dt * 3));
      if (d > 0.05) S.g.rotation.y = Math.atan2(tgt.x - S.pos.x, tgt.z - S.pos.z) || S.g.rotation.y;
      S.g.position.copy(S.pos); S.g.visible = !real; // 1인칭에선 내가 카메라라서 숨겨요
      S.g.scale.setScalar(2.6);
      S.tool.textContent = TOOL_EMOJI[me.tool] || '';
      S.t += dt * (d > 0.3 ? 1 : 0.3); animateAvatar(S.g, S.t);
    }
    for (const peer of this.peers.values()) {
      if (!peer.pos) continue;
      peer.pos.lerp(peer.target, Math.min(1, dt * 4));
      peer.g.position.copy(peer.pos);
      if (peer.yaw !== undefined) peer.g.rotation.y = peer.yaw;
      peer.g.scale.setScalar(real ? 1 : 2.6);
      peer.t += dt; animateAvatar(peer.g, peer.t);
    }
    this.raidTick(dt);
  }

  // ---------- 협동 레이드 ----------
  slotNow(d = new Date()) {
    const hm = d.getHours() * 60 + d.getMinutes(), ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const [a, b, id, name] of this.windows) {
      const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number), s = ah * 60 + am, e = bh * 60 + bm;
      if (hm >= s && hm < e) return { id: `${ymd}-${id}`, name, left: e - hm };
      if (hm >= s - 5 && hm < s) return { soon: true, name, inMin: s - hm, id: `${ymd}-${id}` };
    }
    return null;
  }

  async raidTick(dt) {
    this.raidT -= dt;
    if (this.raidT > 0) return;
    this.raidT = 2;
    const slot = this.slotNow();
    if (!slot || this.flags.raid_off || new Date().getDay() % 6 === 0) { if (this.raid) { this.raid = null; this.raidUI(null); } return; }
    if (slot.soon) { if (this.soonFor !== slot.id) { this.soonFor = slot.id; this.ui.toast(`🛡️ ${slot.inMin}분 뒤 ${slot.name}`, '보스는 본관! 다 같이 부숴요'); } return; }
    try {
      if (!this.raid || this.raid.id !== slot.id) {
        const hp = 300000 + 80000 * Math.max(1, this.count || 1);
        const r = await this.rpc('raid_start', { p_id: slot.id, p_hp: hp });
        this.raid = { ...r, name: slot.name, total: 0 }; this.myDmg = 0; this.wonShown = false;
        this.ui.toast(`🛡️ ${slot.name} 시작!`, '보스 본관의 체력을 모두 함께 깎아요', 'gold');
      }
      this.raid.left = slot.left;
      let st;
      if (this.pending >= 1) {
        const d = Math.min(60000, Math.round(this.pending)); this.pending -= d; this.myDmg += d;
        this.presence.send('campus', 'rh', { id: this.raid.id, d });
        st = await this.rpc('raid_hit', { p_id: this.raid.id, p_grade: this.grade() || 0, p_dmg: d, p_client: this.client });
      } else st = await this.rpc('raid_state', { p_id: this.raid.id });
      if (st) Object.assign(this.raid, st);
      this.raidUI(this.raid);
      if (this.raid.won && !this.wonShown) {
        this.wonShown = true;
        const top = [1, 2, 3].sort((a, b) => (this.raid[`g${b}`] || 0) - (this.raid[`g${a}`] || 0))[0];
        this.ui.toast('🏆 레이드 승리!', `보스 본관 격파 · 가장 많이 깎은 학년 ${top}학년${this.myDmg ? ' · 참여 보상 +200 XP' : ''}`, 'gold');
        if (this.myDmg > 0) { this.onBadge?.('raid'); this.onXP?.(200); }
      }
    } catch { /* 서버가 잠시 안 되면 다음에 다시 */ }
  }

  // 보스(본관)에 준 피해: 본관이 무너진 비율이 늘어난 만큼(본관 전체 = 40만)
  noteBoss(lostFraction) {
    if (!this.raid || this.raid.won) { this.lastLost = lostFraction; return; }
    const prev = this.lastLost ?? lostFraction;
    if (lostFraction > prev) this.pending += (lostFraction - prev) * 400000;
    this.lastLost = lostFraction;
  }

  raidUI(r) {
    const el = document.getElementById('raid-bar');
    if (!el) return;
    if (!r) { el.hidden = true; return; }
    const pct = Math.max(0, 1 - (r.total || 0) / (r.hp || 1)), sum = (r.g1 || 0) + (r.g2 || 0) + (r.g3 || 0) || 1;
    el.hidden = false;
    el.innerHTML = `<b>🛡️ ${r.name}</b><span class="rb-hp"><i style="width:${(pct * 100).toFixed(1)}%"></i></span><span>${r.won ? '격파!' : `${Math.round(pct * 100)}%`}</span><span class="rb-g">${[1, 2, 3].map((g) => `${g}학년 ${Math.round(((r[`g${g}`] || 0) / sum) * 100)}%`).join(' · ')}</span>${r.left ? `<span class="rb-t">${r.left}분 남음</span>` : ''}`;
  }

  // ---------- 레이싱 고스트·주간 순위 ----------
  async submitGhost(circuit, week, lap, samples, name) {
    if (!this.available) return;
    try { await this.rpc('submit_ghost', { p_circuit: circuit, p_week: week, p_client: this.client, p_name: name || this.presence.me.nick, p_grade: this.grade() || 0, p_lap: Math.round(lap * 1000), p_data: samples }); } catch { /* 무시 */ }
  }
  async weeklyTop(circuit, week) { if (!this.available) return []; try { return (await this.rpc('weekly_top', { p_circuit: circuit, p_week: week, p_limit: 10 })) || []; } catch { return []; } }
  async ghost(circuit, week, client) { try { return await this.rpc('get_ghost', { p_circuit: circuit, p_week: week, p_client: client }); } catch { return null; } }

  // 선생님: 온라인 전체 끄기·레이드 끄기
  async setFlag(key, flag, value) { await this.rpc('set_flag', { p_key: key, p_flag: flag, p_value: value }); this.flags[flag] = value; }
}
