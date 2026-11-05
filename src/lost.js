import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// 분실물 지도: 잃어버린 곳(빨강)·주운 곳(초록)을 핀으로 남겨요.
// Supabase를 설정하면 모두가 같은 지도를 보고, 아니면 이 기기에만 저장돼요.
const LOCAL = 'smash-lost';
const BAD = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '좆', 'ㅈㄴ', '존나', '닥쳐', '꺼져', '죽어', 'fuck', 'shit'];

export class LostFound {
  constructor(world, cfg) {
    this.w = world;
    this.url = (cfg.supabaseUrl || '').replace(/\/$/, '');
    this.key = cfg.supabaseKey || '';
    this.online = !!(this.url && this.key);
    this.group = new THREE.Group();
    this.group.visible = false;
    world.scene.add(this.group);
    this.items = [];
    this.pins = [];
  }

  headers() { return { apikey: this.key, ...(String(this.key).startsWith('sb_') ? {} : { Authorization: `Bearer ${this.key}` }), 'Content-Type': 'application/json' }; }

  // 전화번호·주소 같은 개인정보는 지워요.
  clean(text, max) {
    let t = (text || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/g, '(번호 지움)').replace(/\d{6}[\s-]?\d{7}/g, '(지움)');
    t = t.slice(0, max);
    const plain = t.replace(/[\s.\-_*]/g, '').toLowerCase();
    if (BAD.some((w) => plain.includes(w))) return null;
    return t;
  }

  async load() {
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { /* 무시 */ }
    let shared = [];
    if (this.online) {
      try {
        const r = await fetch(`${this.url}/rest/v1/lost_board?select=*&order=created_at.desc&limit=100`, { headers: this.headers() });
        if (r.ok) shared = (await r.json()).map((m) => ({ id: `s${m.id}`, sid: m.id, kind: m.kind, name: m.name, note: m.note, x: m.x, z: m.z, at: Date.parse(m.created_at) }));
      } catch { /* 무시 */ }
    }
    this.items = [...mine, ...shared];
    this.draw();
    return this.items;
  }

  async add({ kind, name, note, x, z }) {
    const n = this.clean(name, 24), d = this.clean(note, 80);
    if (!n) return { ok: false, why: '물건 이름을 고운 말로 적어 주세요' };
    if (d === null) return { ok: false, why: '설명을 고운 말로 적어 주세요' };
    const item = { id: `m${Date.now()}`, kind, name: n, note: d, x, z, at: Date.now(), mine: true };
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { /* 무시 */ }
    mine.unshift(item);
    try { localStorage.setItem(LOCAL, JSON.stringify(mine.slice(0, 60))); } catch { /* 무시 */ }
    if (this.online) {
      try { await fetch(`${this.url}/rest/v1/rpc/add_lost`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ p_kind: kind, p_name: n, p_note: d, p_x: x, p_z: z }) }); } catch { /* 무시 */ }
    }
    await this.load();
    return { ok: true };
  }

  async resolve(item) {
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { /* 무시 */ }
    mine = mine.filter((m) => m.id !== item.id);
    try { localStorage.setItem(LOCAL, JSON.stringify(mine)); } catch { /* 무시 */ }
    if (this.online && item.sid) {
      try { await fetch(`${this.url}/rest/v1/rpc/resolve_lost`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ p_id: item.sid }) }); } catch { /* 무시 */ }
    }
    await this.load();
  }

  draw() {
    for (const p of this.pins) this.group.remove(p.g);
    this.pins = [];
    const T = this.w.terrain;
    for (const it of this.items) {
      const g = new THREE.Group();
      const col = it.kind === 'found' ? 0x34c759 : 0xff453a;
      const y = T.heightAt(it.x, it.z);
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.4 });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3, 16).rotateX(Math.PI), mat);
      cone.position.y = 1.5;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), mat);
      ball.position.y = 3.6;
      g.add(cone, ball);
      const el = document.createElement('div');
      el.className = `lost-label ${it.kind}`;
      el.textContent = `${it.kind === 'found' ? '주웠어요' : '찾아요'} · ${it.name}`;
      const label = new CSS2DObject(el);
      label.position.y = 6;
      g.add(label);
      g.position.set(it.x, y, it.z);
      this.group.add(g);
      this.pins.push({ g, it, label });
    }
    this.setVisible(this.group.visible);
  }

  setVisible(on) {
    this.group.visible = on;
    for (const p of this.pins) p.label.visible = on;
  }

  // 화면에서 가까운 핀
  pickScreen(x, y, camera, rect) {
    if (!this.group.visible) return null;
    let best = null, bd = 40;
    const v = new THREE.Vector3();
    for (const p of this.pins) {
      v.copy(p.g.position).add(new THREE.Vector3(0, 3, 0)).project(camera);
      if (v.z > 1) continue;
      const d = Math.hypot(rect.left + ((v.x + 1) / 2) * rect.width - x, rect.top + ((1 - v.y) / 2) * rect.height - y);
      if (d < bd) { bd = d; best = p.it; }
    }
    return best;
  }

  update(t) {
    if (!this.group.visible) return;
    for (const p of this.pins) p.g.children[1].position.y = 3.6 + Math.sin(t * 2 + p.g.position.x) * 0.3;
  }
}
