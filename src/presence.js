// 함께 보기(실시간 접속): 응원의 벽·분실물 지도에 지금 같이 보고 있는 친구들을 작은 동물 아바타로 보여 줘요.
// - 이름 대신 무작위 별명(예: 용감한 고라니), 기기를 바꾸면 별명도 바뀌어요.
// - 대화(자유 채팅)는 없고 이모지 반응만 주고받아요(익명 공간에서 생길 수 있는 다툼·괴롭힘을 막으려고).
// - Supabase Realtime(채널·접속 상태)만 써요. 표나 기록은 남지 않아요.
const ADJ = ['용감한', '느긋한', '반짝이는', '졸린', '씩씩한', '수줍은', '날쌘', '배고픈', '똑똑한', '다정한', '엉뚱한', '행복한'];
const ANIMALS = [['고라니', '🦌'], ['하늘다람쥐', '🐿️'], ['거북이', '🐢'], ['박쥐', '🦇'], ['고양이', '🐱'], ['개구리', '🐸'], ['사마귀', '🦗'], ['멧돼지', '🐗'], ['부엉이', '🦉'], ['다람쥐', '🐹']];
const HUES = ['#ff9a52', '#4cd98a', '#8a8cff', '#ff6fae', '#5ac8fa', '#ffc94a', '#bf8cff', '#34c759'];
export const REACTIONS = ['❤️', '👏', '🔥', '🍀', '💪'];

function me() {
  let m = null;
  try { m = JSON.parse(sessionStorage.getItem('smash-me') || 'null'); } catch { /* 무시 */ }
  if (!m) {
    const [name, emoji] = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    m = { id: Math.random().toString(36).slice(2, 10), nick: `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${name}`, emoji, color: HUES[Math.floor(Math.random() * HUES.length)] };
    try { sessionStorage.setItem('smash-me', JSON.stringify(m)); } catch { /* 무시 */ }
  }
  return m;
}

export class Presence {
  constructor(cfg) {
    this.url = cfg.supabaseUrl;
    this.key = cfg.supabaseKey;
    this.online = !!(this.url && this.key) && cfg.presence !== false;
    this.me = me();
    this.rooms = {};
  }

  async client() {
    if (this.sb) return this.sb;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    this.sb = createClient(this.url, this.key, { auth: { persistSession: false } });
    return this.sb;
  }

  // room: 'cheer' | 'lost'. onPeople(list), onEvent(type, payload)
  async join(room, { onPeople, onEvent, state = {} }) {
    if (!this.online) { onPeople?.([{ ...this.me, self: true }]); return null; }
    if (this.rooms[room]) return this.rooms[room];
    try {
      const sb = await this.client();
      const ch = sb.channel(`smash-${room}`, { config: { presence: { key: this.me.id }, broadcast: { self: false } } });
      const people = () => Object.values(ch.presenceState()).map((a) => a[0]).filter(Boolean).map((p) => ({ ...p, self: p.id === this.me.id }));
      ch.on('presence', { event: 'sync' }, () => onPeople?.(people()));
      ch.on('broadcast', { event: 'ev' }, ({ payload }) => onEvent?.(payload.type, payload));
      await new Promise((res) => ch.subscribe(async (st) => { if (st === 'SUBSCRIBED') { await ch.track({ ...this.me, ...state }); res(); } }));
      this.rooms[room] = ch;
      return ch;
    } catch {
      onPeople?.([{ ...this.me, self: true }]);
      return null;
    }
  }

  // 내 상태(예: 분실물 지도에서 내가 보고 있는 곳) 갱신
  async update(room, state) {
    const ch = this.rooms[room];
    if (ch) try { await ch.track({ ...this.me, ...state }); } catch { /* 무시 */ }
  }

  send(room, type, payload = {}) {
    const ch = this.rooms[room];
    if (ch) ch.send({ type: 'broadcast', event: 'ev', payload: { type, from: this.me, ...payload } });
  }

  async leave(room) {
    const ch = this.rooms[room];
    if (!ch) return;
    delete this.rooms[room];
    try { await ch.untrack(); await this.sb.removeChannel(ch); } catch { /* 무시 */ }
  }
}
