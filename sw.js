// 오프라인 앱(서비스 워커): 한 번 열면 게임 파일을 기기에 저장해 두고, 인터넷이 없어도 켜져요.
// 새 버전을 올릴 때는 VERSION 숫자만 바꾸면 돼요(옛 저장본은 자동으로 지워져요).
const VERSION = 'smash-v1.9.4';
const CORE = ['./', 'index.html', 'hasa.html', 'manifest.json', 'config.json', 'data/campus.json', 'data/schedule.json', 'data/bus.json', 'src/arcade.js', 'src/avatars.js', 'src/backup.js', 'src/badges.js', 'src/bell.js', 'src/blockworld.js', 'src/board.js', 'src/buildings.js', 'src/calendar.js', 'src/camera.js', 'src/campaign.js', 'src/campusprops.js', 'src/cart.js', 'src/cats.js', 'src/celebrations.js', 'src/cheer.js', 'src/cinema.js', 'src/console.js', 'src/construction.js', 'src/dday.js', 'src/delivery.js', 'src/demo.js', 'src/devmenu.js', 'src/editor.js', 'src/exams.js', 'src/extras.js', 'src/fireworks.js', 'src/flag.js', 'src/fortune.js', 'src/fracture.js', 'src/fx.js', 'src/games/basketball.js', 'src/games/crane.js', 'src/games/docking.js', 'src/games/landing.js', 'src/games/meteor.js', 'src/games/race.js', 'src/games/soccer.js', 'src/games/tycoon.js', 'src/geom.js', 'src/ground.js', 'src/haptics.js', 'src/hasa.js', 'src/keepsake.js', 'src/kf21.js', 'src/launcher.js', 'src/lost.js', 'src/main.js', 'src/meal.js', 'src/mission.js', 'src/missions.js', 'src/nukepad.js', 'src/obstacles.js', 'src/onboard.js', 'src/parking.js', 'src/pickleball.js', 'src/presence.js', 'src/props.js', 'src/quality.js', 'src/robodog.js', 'src/rocket.js', 'src/school.js', 'src/schoolnet.js', 'src/score.js', 'src/seasonpass.js', 'src/seasons.js', 'src/share.js', 'src/sky.js', 'src/snowman.js', 'src/sound.js', 'src/suneung.js', 'src/telemetry.js', 'src/terrain.js', 'src/textures.js', 'src/tkd.js', 'src/tools.js', 'src/treasure.js', 'src/trees.js', 'src/ui.js', 'src/walk.js', 'src/weather.js', 'src/wildlife.js', 'src/xmas.js', 'assets/emblem.svg', 'assets/icons/apple-touch-icon.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/maskable-512.png', 'assets/wordmark.svg'];
const CDN = ['cdn.jsdelivr.net', 'fonts.gstatic.com', 'fonts.googleapis.com'];
const LIVE = ['open-meteo.com', 'open.neis.go.kr', 'supabase.co', 'apis.data.go.kr'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(CORE.map((u) => c.add(u)))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || LIVE.some((h) => url.hostname.endsWith(h))) return; // 날씨·급식·온라인 기능은 늘 새로
  if (CDN.some((h) => url.hostname.endsWith(h))) {
    // three.js·글꼴: 저장본 먼저
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })));
    return;
  }
  if (url.origin === location.origin) {
    // 우리 파일: 저장본을 바로 보여 주고, 뒤에서 새 파일로 바꿔 둬요.
    e.respondWith(caches.open(VERSION).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
