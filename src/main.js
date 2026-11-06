import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Director } from './camera.js';
import { NukePad } from './nukepad.js';
import { Terrain } from './terrain.js';
import { GroundPainter } from './ground.js';
import { BuildingSystem } from './buildings.js';
import { Effects } from './fx.js';
import { Trees } from './trees.js';
import { Sound } from './sound.js';
import { Score } from './score.js';
import { UI } from './ui.js';
import { Tools, TOOL_DEFS, quakeParams, QUAKE_TEXT, BAT_SIZES } from './tools.js';
import { RocketSystem } from './rocket.js';
import { GolfCart, findCartPath } from './cart.js';
import { Missions } from './missions.js';
import { GradeBoard } from './board.js';
import { nextExam, examBonus, examLabel } from './exams.js';
import { XmasTheme } from './xmas.js';
import { CalendarUI, buildEvents, editionFor, nextSuneung, EDITIONS } from './calendar.js';
import { drawFortune } from './fortune.js';
import { FlagPole } from './flag.js';
import { skyAt, PRESETS, PRESET_NAME } from './sky.js';
import { Badges, BADGES } from './badges.js';
import { Walk } from './walk.js';
import { Wildlife, Dex, DEX } from './wildlife.js';
import { TreasureHunt } from './treasure.js';
import { CheerWall } from './cheer.js';
import { periodAt, DEFAULT_PERIODS } from './bell.js';
import { Seasons, seasonOf } from './seasons.js';
import { Canopies } from './props.js';
import { buildStands, buildFence, buildTurtleRock, buildFossil, pickStandEdge, standFootprint, standSteps, Stream, carveStands, Recycling, Floodlights, buildBusStop } from './campusprops.js';
import { Delivery } from './delivery.js';
import { FACILITIES, HISTORY } from './school.js';
import { fetchSchedule } from './meal.js';
import { RoboDog } from './robodog.js';
import { Cats } from './cats.js';
import { Extras, storeSign } from './extras.js';
import { fetchWeather } from './weather.js';
import { fetchMeals, fetchTimetable } from './meal.js';
import { Snowmen } from './snowman.js';
import { Telemetry } from './telemetry.js';
import { Taekwondo, KICKS } from './tkd.js';
import { Haptics } from './haptics.js';
import { Launcher } from './launcher.js';
import { Obstacles } from './obstacles.js';
import { Presence, REACTIONS } from './presence.js';
import { Pickleball } from './pickleball.js';
import { SuneungLetter } from './suneung.js';
import { SchoolNet } from './schoolnet.js';
import { Celebrations } from './celebrations.js';
import { Onboard } from './onboard.js';
import { Quality, LEVELS } from './quality.js';
import { exportCode, importCode, drawQR } from './backup.js';
import { Construction, planSite } from './construction.js';
import { ParkedCars } from './parking.js';
import { planTerrace, shapeTerrace, buildTerrace } from './terrace.js';
import { DevMenu } from './devmenu.js';
import { Visuals } from './visual.js';
import { Interior } from './interior.js';
import { Online, EMOTES } from './online.js';
import { campaign, STAGES, stationSVG } from './campaign.js';
import { Album, LetterCard } from './keepsake.js';
import { makeAvatar, animateAvatar, uniformFor } from './avatars.js';
import { Cinema } from './cinema.js';
import { Arcade, contextPill } from './arcade.js';
import { SeasonPass } from './seasonpass.js';
import { race, skinStore, SKINS } from './games/race.js';
import { soccer } from './games/soccer.js';
import { basketball } from './games/basketball.js';
import { tycoon } from './games/tycoon.js';
import { crane, craneProgress } from './games/crane.js';
import { meteor } from './games/meteor.js';
import { landing } from './games/landing.js';
import { docking } from './games/docking.js';
import { BlockWorld, BlockUnlock } from './blockworld.js';
import { LostFound } from './lost.js';
import { DDays, dLabel } from './dday.js';
import { makeShareCard } from './share.js';
import { pointInPolygon, distToPolygonEdge } from './geom.js';
import { Editor } from './editor.js';
import { Fireworks } from './fireworks.js';
import { makeDemoCampus } from './demo.js';
import { cleanPolygon, centroid, signedArea, hashString, orientedBox } from './geom.js';
import { setAnisotropy, STYLES } from './textures.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function start() {
  let cfg = {};
  try { cfg = await loadJSON('config.json'); } catch { /* 설정이 없으면 기본값 */ }
  // 학사일정·보충 시간표(data/schedule.json): config.json을 고치지 않아도 자동으로 합쳐져요.
  try {
    const sc = await loadJSON('data/schedule.json');
    if (sc.exams?.length) cfg.exams = sc.exams;
    cfg.events = [...(cfg.events || []), ...(sc.events || [])];
    cfg.supplement = { ...(sc.supplement || {}), ...(cfg.supplement || {}) };
    for (const k of ['entrance', 'founding', 'graduation', 'sportsDay', 'festival']) if (sc[k] && !cfg[k]) cfg[k] = sc[k];
  } catch { /* 없으면 그대로 */ }
  // 2.0 베타: 초대 코드(data/beta.json) · 건물 내부(data/interiors.json)
  try { cfg.beta = await loadJSON('data/beta.json'); } catch { cfg.beta = null; }
  try { cfg.interiors = await loadJSON('data/interiors.json'); } catch { cfg.interiors = {}; }
  if (cfg.beta?.code) {
    let ok = false; try { ok = localStorage.getItem('smash-beta-ok') === cfg.beta.code; } catch { /* 무시 */ }
    const gate = document.getElementById('beta-gate');
    if (!ok) {
      gate.hidden = false;
      const tryCode = () => { const v = document.getElementById('beta-code').value.trim().toLowerCase(); if (v === String(cfg.beta.code).toLowerCase()) { try { localStorage.setItem('smash-beta-ok', cfg.beta.code); } catch { /* 무시 */ } gate.classList.add('out'); setTimeout(() => { gate.hidden = true; }, 400); } else { document.getElementById('beta-msg').textContent = '코드가 맞지 않아요'; } };
      document.getElementById('beta-go').addEventListener('click', tryCode);
      document.getElementById('beta-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryCode(); });
    }
  }
  // 버스 정류장 2곳(data/bus.json)
  try { const bj = await loadJSON('data/bus.json'); cfg.bus = { ...(cfg.bus || {}), stops: bj.stops, routeInfo: bj.routes, seen: bj.seen }; } catch { /* 없으면 그대로 */ }
  let campus;
  try { campus = await loadJSON('data/campus.json'); } catch { campus = makeDemoCampus(); }

  const coarse = matchMedia('(pointer: coarse)').matches;
  const quality = cfg.quality || (coarse || Math.min(screen.width, screen.height) < 700 ? 'low' : 'high');
  const floorH = cfg.floorHeight || 3.6;

  // ---------- 그리기 준비 ----------
  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // 그림자는 한 프레임 걸러(초당 30번) 다시 그려요
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);
  setAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const labels = new CSS2DRenderer();
  labels.setSize(innerWidth, innerHeight);
  labels.domElement.className = 'labels';
  stage.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const DAY = { top: new THREE.Color('#7fb0de'), bottom: new THREE.Color('#e8eef2'), fog: new THREE.Color('#dde6eb') };
  const NIGHT = { top: new THREE.Color('#0a1734'), bottom: new THREE.Color('#2c3a5c'), fog: new THREE.Color('#202b47') };
  const skyU = { top: { value: DAY.top.clone() }, bottom: { value: DAY.bottom.clone() }, space: { value: 0 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      // 높이 올라갈수록(우주) 하늘이 검게 변하고, 아래쪽 지평선에만 푸른 빛이 남아요.
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float space; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.15,0.,1.); vec3 c = mix(bottom, top, h); vec3 sp = mix(vec3(0.16,0.32,0.62), vec3(0.008,0.012,0.03), smoothstep(-0.25, 0.25, vP.y)); gl_FragColor = vec4(mix(c, sp, space), 1.); }',
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(DAY.fog.clone(), 500, 1700);

  // ---------- 땅 ----------
  let tsrc = campus.terrain;
  if (!tsrc) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of campus.buildings) for (const [x, z] of b.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    if (!isFinite(x0)) { x0 = z0 = -150; x1 = z1 = 150; }
    tsrc = Terrain.flat(x0 - 70, z0 - 70, x1 - x0 + 140, z1 - z0 + 140);
  }
  const terrain = new Terrain(tsrc, quality === 'high' ? 2 : 3);

  // ---------- 건물 정리 ----------
  const over = cfg.buildings || {};
  // 지도에 없는 건물(배치 도우미로 그린 것)
  // poly 대신 center·size·angle(도)로 적어도 돼요.
  const rectPoly = ({ center: [cx, cz], size: [w, d], angle = 0 }) => {
    const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
  };
  // 본관 증축동: 완공일(기본 2026-11-10) 이후엔 공사장이 아니라 부술 수 있는 완성 건물로 넣어요.
  //   주소 뒤 ?built=1 이면 완공 미리 보기, ?built=0 이면 공사 중 보기
  const builtQ = new URLSearchParams(location.search).get('built');
  const extBuilt = cfg.construction !== false && (builtQ === '1' || (builtQ !== '0' && new Date() >= new Date(`${cfg.constructionDone || '2026-11-04'}T00:00:00`)));
  if (extBuilt) {
    const nm = (b) => cfg.buildings?.[b.id]?.name || b.name || '';
    const mb = campus.buildings.find((b) => /^본관/.test(nm(b))), db = campus.buildings.find((b) => /^인재원(\s*Ⅰ)?$/.test(nm(b)));
    const pp = (campus.areas || []).filter((a) => a.kind === 'pitch').map((a) => cleanPolygon(a.poly)).sort((a, b) => signedArea(b) - signedArea(a))[0];
    if (mb) {
      const plan = planSite({ poly: cleanPolygon(mb.poly) }, db ? { poly: cleanPolygon(db.poly) } : null, pp ? orientedBox(pp) : null, campus.roads || []);
      campus.buildings.push({ id: 'ext-main', name: '본관 증축동', levels: 3, style: 'annex', roof: '#3a3d42', poly: (cfg.construction?.poly) || plan.poly });
    }
  }
  (cfg.extraBuildings || []).forEach((b, i) => campus.buildings.push({ id: `x${i + 1}`, name: b.name, levels: b.levels, style: b.style, roof: b.roof, shape: b.shape, poly: b.poly || rectPoly(b) }));
  const styleNames = ['cream', 'white', 'cream', 'gray', 'brick'];
  const bdata = [];
  for (const b of campus.buildings) {
    const o = over[b.id] || (b.name && over[b.name]) || {};
    if (o.hide) continue;
    const poly = cleanPolygon(b.poly);
    if (poly.length < 3 || signedArea(poly) < 10) continue;
    let levels = o.levels ?? b.levels ?? (b.height ? b.height / floorH : 3);
    levels = Math.max(1, Math.min(30, Math.round(levels)));
    const style = STYLES[o.style] ? o.style : STYLES[b.style] ? b.style : (cfg.defaultStyle && STYLES[cfg.defaultStyle] ? cfg.defaultStyle : styleNames[hashString(String(b.id)) % styleNames.length]);
    const hs = poly.map(([x, z]) => terrain.heightAt(x, z));
    const base = hs.reduce((a, v) => a + v, 0) / hs.length;
    bdata.push({ id: b.id, name: o.name ?? b.name ?? '', poly, levels, floorH, style, roof: o.roof || b.roof || cfg.roofColor || '#a9adb1', shape: o.shape || b.shape, base });
  }
  // 산 중턱 학교처럼 건물·운동장 자리를 계단식으로 다집니다.
  for (const d of bdata) terrain.flatten(d.poly, d.base, 6);
  for (const a of campus.areas || []) {
    if (a.kind !== 'pitch' && a.kind !== 'track') continue;
    const poly = cleanPolygon(a.poly);
    if (poly.length < 3) continue;
    const hs = poly.map(([x, z]) => terrain.heightAt(x, z));
    terrain.flatten(poly, hs.reduce((s, v) => s + v, 0) / hs.length, 8);
  }
  // 운동장에서 본관 쪽 높이까지 올라가는 스탠드: 자리를 운동장 높이로 파고, 계단이 뒤쪽 땅 높이까지 올라가요.
  const bigPitch = (campus.areas || []).filter((a) => a.kind === 'pitch').map((a) => cleanPolygon(a.poly)).sort((a, b) => signedArea(b) - signedArea(a))[0];
  const mainB = bdata.find((b) => b.name === '본관') || [...bdata].sort((a, b) => signedArea(b.poly) - signedArea(a.poly))[0];
  const standEdge = bigPitch && mainB ? pickStandEdge(bigPitch, mainB.poly) : null;
  let stand = null;
  if (standEdge) {
    const pcen = centroid(bigPitch);
    const fieldY = terrain.heightAt(pcen[0], pcen[1]);
    const backY = terrain.heightAt(standEdge.mx + standEdge.nx * 24, standEdge.mz + standEdge.nz * 24);
    const N = standSteps(fieldY, backY);
    stand = { e: standEdge, fieldY, N, poly: standFootprint(standEdge, N) };
    carveStands(terrain, standEdge, fieldY, N);
  }
  // 길을 따라 높이를 부드럽게(골프 카트·택배차가 덜컹거리지 않게)
  terrain.smoothRoads(campus.roads || [], 3);
  for (const d of bdata) terrain.flatten(d.poly, d.base, 3.5); // 경계를 완만하게(톱니 경사 없애기)
  // 본관 앞 옹벽·계단: 본관은 앞길보다 3~4 m 높은 단 위에 있어요. 비탈 대신 실제처럼 옹벽으로.
  let terracePlan = null;
  if (mainB && cfg.terrace !== false) {
    const toward = standEdge ? [-standEdge.nx, -standEdge.nz] : (() => { const c = centroid(mainB.poly), q = bigPitch ? centroid(bigPitch) : [c[0], c[1] + 1], L = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1; return [(q[0] - c[0]) / L, (q[1] - c[1]) / L]; })();
    terracePlan = planTerrace(terrain, mainB, toward);
    if (terracePlan) {
      shapeTerrace(terrain, terracePlan);
      for (const d of bdata) if (d !== mainB) terrain.flatten(d.poly, d.base, 0.5); // 옆 건물(증축동 등) 바닥은 그대로
    }
  }

  const painter = new GroundPainter(terrain, quality === 'high' ? 4096 : 2048);
  painter.paint(campus, bdata);
  scene.add(terrain.build(painter.texture), terrain.skirt);
  if (terracePlan) buildTerrace(scene, terracePlan);

  // ---------- 빛 ----------
  const hemi = new THREE.HemisphereLight(0xd4e6ff, 0x6b5a45, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1);
  const span = Math.max(terrain.w, terrain.d);
  const cx = terrain.x0 + terrain.w / 2, cz = terrain.z0 + terrain.d / 2;
  sun.position.set(cx - 180, 330, cz + 120);
  sun.target.position.set(cx, 0, cz);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024); // 4096은 GPU에 너무 무거워요
  const sc = sun.shadow.camera;
  sc.left = -span * 0.62; sc.right = span * 0.62; sc.top = span * 0.62; sc.bottom = -span * 0.62;
  sc.near = 50; sc.far = 1100;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.08;
  scene.add(sun, sun.target);

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({ length: 1500 }, () => {
        const u = Math.random() * Math.PI * 2, v = Math.random() * 0.45 + 0.08;
        return [Math.cos(u) * Math.cos(v) * 2500, Math.sin(v) * 2500, Math.sin(u) * Math.cos(v) * 2500];
      }).flat(), 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }),
  );
  stars.visible = false;
  scene.add(stars);

  // ---------- 세상 ----------
  const sound = new Sound();
  const fx = new Effects(scene, terrain, quality);
  const buildings = new BuildingSystem({ scene, terrain, fx, sound });
  for (const d of bdata) buildings.add(d);
  const trees = new Trees(scene, terrain, fx);
  // 차양막 자리에는 나무를 심지 않아요.
  const canopySpots = (cfg.canopies || []).map((c) => ({ poly: rectPoly(c) }));
  // 스탠드 자리(운동장에서 본관을 바라보는 변)도 비워 둬요.
  if (stand) canopySpots.push({ poly: stand.poly });
  // 물길 자리도 비워요.
  for (const [x, z] of cfg.stream?.path || []) canopySpots.push({ poly: [[x - 3.5, z - 3.5], [x + 3.5, z - 3.5], [x + 3.5, z + 3.5], [x - 3.5, z + 3.5]] });
  trees.plan(campus, [...bdata, ...canopySpots], quality === 'high' ? 2200 : 1000, quality === 'high' ? 480 : 240, quality === 'high' ? 900 : 380);
  trees.build();
  const score = new Score();
  const cartPath = cfg.golfCart === false ? null : findCartPath(campus, terrain);
  const cart = cartPath ? new GolfCart(scene, terrain, fx, cartPath) : null;

  // ---------- 카메라 ----------
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 6000);
  const focus = campus.boundary ? centroid(campus.boundary) : [0, 0];
  const fy = terrain.heightAt(focus[0], focus[1]);
  // 기본 시점: 운동장 쪽 하늘에서 본관 정면을 바라봐요(학교 정면 사진처럼). 세로 화면은 조금 더 멀리.
  const home = (() => {
    const mb = bdata.find((b) => b.name === '본관'), bp = bigPitch;
    if (!mb || !bp) return { target: new THREE.Vector3(focus[0], fy, focus[1]), pos: new THREE.Vector3(focus[0] - span * 0.32, fy + span * 0.48, focus[1] + span * 0.62) };
    const mc = centroid(mb.poly), pc = centroid(bp), L = Math.hypot(pc[0] - mc[0], pc[1] - mc[1]) || 1, nx = (pc[0] - mc[0]) / L, nz = (pc[1] - mc[1]) / L;
    const tx = mc[0] + nx * L * 0.45, tz = mc[1] + nz * L * 0.45, ty = terrain.heightAt(tx, tz);
    const far = span * (innerWidth < innerHeight ? 0.95 : 0.7);
    return { target: new THREE.Vector3(tx, ty, tz), pos: new THREE.Vector3(tx + nx * far - nz * far * 0.12, ty + far * 0.55, tz + nz * far + nx * far * 0.12) };
  })();
  camera.position.copy(home.pos);
  const controls = new MapControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = 1.36;
  controls.minDistance = 18;
  controls.maxDistance = span * 1.6;
  controls.zoomToCursor = true;
  controls.update();

  // ---------- 화면 ----------
  let tool = TOOL_DEFS[0];
  const ui = new UI(TOOL_DEFS, (id) => selectTool(id));
  const schoolName = cfg.school || campus.name || '우리 학교';
  ui.setSchool(schoolName);
  if (cfg.showLogo !== false) ui.setLogo(cfg.logo || 'assets/emblem.svg');
  document.title = `${cfg.title || 'SMASH 한빛'} · ${schoolName}`;
  if (campus.demo) {
    ui.notice('지금은 <b>연습용 가상 학교</b>예요. <code>python3 tools/fetch_campus.py</code>로 우리 학교 데이터를 만들면 그 학교로 바뀌어요.');
  }

  // 날짜(달력으로 옮길 수 있어요)에 따라 시험·수능 D-day와 점수 보너스가 바뀌어요.
  cfg.suneung = cfg.suneung || ['2026-11-19', '2027-11-18'];
  const events = buildEvents(cfg);
  let simDate = new Date();
  let ddayReady = false;
  let edNow = null; // 지금 에디션(world보다 먼저 쓰여서 따로 둬요)
  const updateDates = () => {
    const exam = nextExam(cfg.exams, simDate);
    const bonus = examBonus(exam);
    score.setBonus(bonus * (edNow === 'sports' ? 2 : 1));
    ui.setExam(examLabel(exam), bonus);
    ui.setSuneung(nextSuneung(cfg, simDate));
    const real = new Date();
    const same = simDate.toDateString() === real.toDateString();
    ui.setTravel(same ? '' : `${simDate.getMonth() + 1}월 ${simDate.getDate()}일로 이동 중`);
    if (ddayReady) renderDDayChip();
  };
  updateDates();

  const biggest = [...buildings.list].sort((a, b) => b.totalVolume - a.totalVolume)[0];
  const missions = new Missions({ biggest, hasCart: !!cart });

  const board = new GradeBoard(cfg);
  const badges = new Badges(ui);
  {
    const b0 = ui.badge.bind(ui);
    ui.badge = (b, no) => { b0(b, no); world.hap?.play('badge'); world.pass?.add(50, 'badge'); };
  }
  // 익명 사용 통계: 창 열기·배지는 길목에서 한 번에 기록해요.
  const tele = new Telemetry(cfg);
  {
    const give0 = badges.give.bind(badges);
    badges.give = (id) => { const had = badges.has(id); give0(id); if (!had && badges.has(id)) tele.track('badge', { id }); };
    const modal0 = ui.modal.bind(ui);
    ui.modal = (id, on) => { if (on) tele.track('open', { id }); modal0(id, on); };
  }
  ui.setGradeChip(board.grade);
  const renderBoard = () => {
    const rows = board.rows.map((r) => ({ ...r }));
    const mine = rows.find((r) => r.grade === board.grade);
    if (mine) mine.total += board.online ? Math.max(0, board.runScore - board.sent) : board.runScore;
    ui.setBoard(rows, board.grade, board.online ? '전교 실시간' : '이 기기 기록');
  };
  board.refresh().then(renderBoard);
  const pickGrade = () => ui.openSheet(board.grade, (g) => {
    board.setGrade(g);
    ui.setGradeChip(g);
    renderBoard();
    if (g) ui.toast(`${g}학년 대표로 참가해요`, '부순 점수가 학년 총점에 더해져요');
  });
  document.getElementById('grade-chip').addEventListener('click', pickGrade);

  // 조준 표시(바닥 원)
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false }),
  );
  reticle.renderOrder = 10;
  reticle.visible = false;
  scene.add(reticle);

  // ---------- 세상 묶음 ----------
  const director = new Director(camera, controls);
  const world = { scene, camera, terrain, painter, buildings, fx, trees, sound, ui, cart, missions, explode, director, focus, edition: null };
  const tools = new Tools(world);
  world.tools = tools;
  // 로켓은 학교에서 1.5 km 떨어진 발사장에서 날아와요(config의 launchSite로 바꿀 수 있어요).
  const siteXZ = Array.isArray(cfg.launchSite) ? cfg.launchSite : [focus[0] + 0.8 * 1500, focus[1] - 0.6 * 1500];
  world.rocket = new RocketSystem(world, siteXZ, 0);

  // 시험이 끝난 다음 날에는 운동장에서 불꽃놀이
  const pitches = (campus.areas || []).filter((a) => a.kind === 'pitch').map((a) => cleanPolygon(a.poly)).filter((p) => p.length >= 3);
  const showAt = pitches.length ? centroid(pitches.sort((a, b) => signedArea(b) - signedArea(a))[0]) : focus;
  const fireworks = new Fireworks(world, showAt);
  const xmas = new XmasTheme(world, { showAt });
  // 국기게양대(높이 35 m, 태극기 8 × 5.3 m). 위치는 config의 flag.at, 없으면 운동장 모서리.
  let flagAt = cfg.flag?.at;
  if (!flagAt && pitches.length) {
    // 기본은 운동장의 북서쪽 모서리(한빛고 실제 위치). config의 flag.corner로 'ne','se','sw'도 고를 수 있어요.
    const corner = cfg.flag?.corner || 'nw';
    const dir = { nw: [-1, -1], ne: [1, -1], se: [1, 1], sw: [-1, 1] }[corner] || [-1, -1];
    const pc = centroid(pitches[0]);
    const v = pitches[0].reduce((best, p) => ((p[0] - pc[0]) * dir[0] + (p[1] - pc[1]) * dir[1] > (best[0] - pc[0]) * dir[0] + (best[1] - pc[1]) * dir[1] ? p : best));
    const dx = v[0] - pc[0], dz = v[1] - pc[1], L = Math.hypot(dx, dz) || 1;
    flagAt = [v[0] + (dx / L) * 4, v[1] + (dz / L) * 4];
  }
  const flagPole = flagAt ? new FlagPole(scene, terrain, flagAt, cfg.flag || {}) : null;
  const editor = location.search.includes('edit') ? new Editor(world, cfg) : null;
  // 운동장 골대
  if (pitches.length) {
    const b = orientedBox(pitches[0]);
    if (b.L > 30) {
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
      for (const sgn of [-1, 1]) {
        const goal = new THREE.Group();
        const post = new THREE.CylinderGeometry(0.07, 0.07, 2.44, 8);
        for (const z of [-3.66, 3.66]) { const m = new THREE.Mesh(post, white); m.position.set(0, 1.22, z); goal.add(m); }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.32, 8).rotateX(Math.PI / 2), white);
        bar.position.y = 2.44;
        goal.add(bar);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44), netMat);
        back.rotation.y = Math.PI / 2;
        back.position.set(sgn * 1.6, 1.22, 0);
        goal.add(back);
        goal.traverse((o) => { o.castShadow = true; });
        const gx = b.cx + Math.cos(b.angle) * sgn * (b.L / 2 - 1.5), gz = b.cz + Math.sin(b.angle) * sgn * (b.L / 2 - 1.5);
        goal.position.set(gx, terrain.heightAt(gx, gz), gz);
        goal.rotation.y = -b.angle;
        scene.add(goal);
      }
    }
  }
  const seasons = new Seasons(world);
  // 운동장 스탠드·그물, 거북바위, 지층 화석
  if (stand) buildStands(scene, stand.e, stand.fieldY, stand.N);
  if (bigPitch) buildFence(scene, terrain, bigPitch, standEdge ? standEdge.i : null);
  const stream = cfg.stream?.path ? new Stream(scene, terrain, fx, cfg.stream) : null;
  const robodog = new RoboDog(world);
  const walk = new Walk(world);
  const recycling = cfg.recycling ? new Recycling(scene, terrain, fx, cfg.recycling) : null;
  const flood = bigPitch ? new Floodlights(scene, terrain, orientedBox(bigPitch)) : null;
  const busAt = cfg.bus?.at || null;
  // ---------- 주차장(주차칸·주차된 차·멈춤턱·가로등) ----------
  const parked = (() => {
    const ps = (campus.areas || []).filter((a) => a.kind === 'parking').map((a) => cleanPolygon(a.poly)).filter((p) => p.length >= 3);
    try { return ps.length ? new ParkedCars(world, ps) : null; } catch (e) { console.warn('주차장', e); return null; }
  })();
  // ---------- 본관 증축 공사장 ----------
  let site = null;
  {
    const mainB = buildings.list.find((b) => /^본관/.test(b.name));
    const dorm = buildings.list.find((b) => /^인재원(\s*Ⅰ)?$/.test(b.name)) || buildings.list.find((b) => /인재원/.test(b.name) && !/Ⅱ/.test(b.name));
    if (mainB && cfg.construction !== false && !extBuilt) {
      try { site = new Construction(world, { mainB, dorm, pitch: bigPitch ? orientedBox(bigPitch) : null, cart, override: cfg.construction, roads: campus.roads || [] }); } catch (e) { console.warn('공사장', e); }
    }
  }
  // 이름표가 서로 겹치면 작은 건물 이름표를 잠시 숨겨요(0.5초마다)
  {
    let t = 0; const v = new THREE.Vector3();
    world.declutter = (dt) => {
      t -= dt; if (t > 0) return; t = 0.5;
      const shown = [], W = innerWidth, H = innerHeight;
      for (const b of [...buildings.list].sort((a, c) => c.totalVolume - a.totalVolume)) {
        const el = b.label?.element; if (!el || !b.label.visible) continue;
        v.copy(b.label.position); b.label.parent?.localToWorld?.(v); v.project(camera);
        const x = ((v.x + 1) / 2) * W, y = ((1 - v.y) / 2) * H, w = (b.name || '').length * 13 + 22, h = 26;
        const hit = shown.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < h);
        el.classList.toggle('lb-hide', hit);
        if (!hit) shown.push({ x, y, w });
      }
    };
  }
  // ---------- 2.0 비주얼 ----------
  const visuals = new Visuals({ renderer, scene, camera, controls, sky, sun, terrain, roads: campus.roads || [] });
  world.visuals = visuals;
  // ---------- 2.0 한빛 인사이드(건물 안) ----------
  let insideSaved = null;
  const interior = new Interior({ renderer, hap: null, toast: (a, b) => ui.toast(a, b), onExit: () => { controls.enabled = true; if (insideSaved) { camera.position.copy(insideSaved.p); controls.target.copy(insideSaved.t); } ui.toast('밖으로 나왔어요', ''); } });
  world.enterBuilding = (name, floor = '1F') => {
    const data = cfg.interiors?.[name]?.[floor];
    if (!data) { ui.toast('아직 안을 볼 수 없어요', `${name} 층 안내도를 받으면 열려요`); return; }
    const today = (typeof ttRows !== 'undefined' && ttRows?.length) ? ttRows.map((r) => `${r.period}교시 ${r.subject}`).slice(0, 4).join(' · ') : '';
    if (interior.name !== name || interior.floor !== floor) interior.build(name, floor, data, { blackboard: today });
    insideSaved = { p: camera.position.clone(), t: controls.target.clone() };
    controls.enabled = false; ui.modal('info', false);
    interior.enter(); tele.track('inside', { name, floor });
  };
  // ---------- 기념일 에디션 연출 ----------
  const CELEB = ['halloween', 'stickday', 'anniv', 'teachers', 'sports', 'festival', 'entrance', 'graduation', 'hangul', 'parents', 'children', 'aprilfools', 'science', 'firstsnow', 'newyear', 'seollal', 'chuseok', 'valentine', 'whiteday', 'samil', 'gwangbok', 'arbor', 'earth', 'students', 'dongji'];
  world.seasons = seasons;
  const celebrate = new Celebrations(world, {
    pitch: bigPitch ? orientedBox(bigPitch) : null,
    mainB: buildings.list.find((b) => b.name === '본관') || buildings.list[0],
    buildings, roads: campus.roads || [], busAt, flood,
    foundingYear: Number(String(cfg.foundingYear || 2000)),
  });
  let forceEd = new URLSearchParams(location.search).get('edition');
  world.forceEdition = (k) => { forceEd = k; applyEdition(true); };
  if (busAt) buildBusStop(scene, terrain, busAt, ((cfg.bus.yaw || 0) * Math.PI) / 180);
  const delivery = new Delivery(world, cfg.delivery?.path || [[110, -88], [85, -58], [61, -27], [46, -46], [37, -58]]);
  world.onLaunched = (b) => {
    const p = score.add(Math.round(b.totalVolume * 3));
    ui.toast(`${b.name || '건물'} 배송 완료`, `우주로 슝 +${fmt(p)}`);
    missions.onCollapse?.(b, 'rocket');
  };
  setInterval(() => delivery.schedule(), 10000);
  delivery.schedule();

  // 고양이(흰 엄마 + 새끼 3, 치즈), 매점 잭팟, 시험지 눈보라
  const extras = new Extras(world);
  const whiteAt = stand
    ? [stand.e.mx + stand.e.nx * (1.6 + stand.N * 1.2 + 6), stand.e.mz + stand.e.nz * (1.6 + stand.N * 1.2 + 6)]
    : [focus[0] + 10, focus[1]];
  const pondEnd = cfg.stream?.path?.[cfg.stream.path.length - 1];
  const cheeseAt = pondEnd ? [pondEnd[0] + 3, pondEnd[1] + 4] : [focus[0] - 10, focus[1]];
  const cats = new Cats(world, { white: whiteAt, cheese: cheeseAt });
  const catMeshes = cats.meshes();
  // 본관 1층 매점: 운동장에서 본관을 바라볼 때 왼쪽 끝
  let store = null;
  if (mainB && bigPitch) {
    const pc = centroid(bigPitch), mc = centroid(mainB.poly);
    const fx0 = mc[0] - pc[0], fz0 = mc[1] - pc[1], fl = Math.hypot(fx0, fz0);
    const left = [fz0 / fl, -fx0 / fl];
    let best = null;
    for (let i = 0; i < mainB.poly.length; i++) {
      const a = mainB.poly[i], b = mainB.poly[(i + 1) % mainB.poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 6) continue;
      let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if ((mx - mc[0]) * nx + (mz - mc[1]) * nz < 0) { nx = -nx; nz = -nz; }
      if (nx * -fx0 / fl + nz * -fz0 / fl < 0.5) continue; // 운동장을 바라보는 벽만
      const endA = a[0] * left[0] + a[1] * left[1], endB = b[0] * left[0] + b[1] * left[1];
      const far = endA > endB ? a : b, near = endA > endB ? b : a;
      const score = Math.max(endA, endB);
      if (!best || score > best.score) best = { far, near, L, nx, nz, score };
    }
    if (best) {
      const t = Math.min(0.5, 5 / best.L);
      const px = best.far[0] + (best.near[0] - best.far[0]) * t, pz = best.far[1] + (best.near[1] - best.far[1]) * t;
      store = new THREE.Vector3(px + best.nx * 0.35, mainB.base + 2.8, pz + best.nz * 0.35);
      storeSign(scene, store, Math.atan2(best.nx, best.nz));
    }
  }
  let jackpotDone = false;
  const examPeriod = () => { const e = nextExam(cfg.exams, simDate); return !!e && (e.during || e.days <= 14); };
  const shrine = bdata.find((b) => b.name === '세심정');
  const turtleAt = cfg.turtleRock?.at || (shrine ? [centroid(shrine.poly)[0] - 20, centroid(shrine.poly)[1] + 18] : null);
  const turtle = turtleAt ? buildTurtleRock(scene, terrain, turtleAt, shrine ? centroid(shrine.poly) : focus) : null;
  buildFossil(scene, terrain);

  // 한빛 동물들 + 도감
  const dex = new Dex();
  const dorm = bdata.find((b) => b.name === '인재원 Ⅰ');
  const treeSpots = (trees.items?.pine || []).filter((t) => { const d = Math.hypot(t.x - focus[0], t.z - focus[1]); return d > 70 && d < 130; }).slice(0, 30).map((t) => [t.x, t.z]);
  const wildlife = new Wildlife(world, {
    focus, pond: pondEnd, shrine: shrine ? centroid(shrine.poly) : null, dorm: dorm ? centroid(dorm.poly) : null, spots: treeSpots,
  });
  // 타임캡슐 찾기, 응원 벽, 종소리·학생들
  const campusArea = campus.boundary && campus.boundary.length > 2 ? cleanPolygon(campus.boundary) : bigPitch || [[-50, -50], [50, -50], [50, 50], [-50, 50]];
  const hunt = new TreasureHunt(world, campusArea);
  world.onHuntWin = (shots) => {
    tele.track('hunt', { win: true, shots }); badges.give('hunt'); hap.play('hunt');
    if (shots <= 3) badges.give('hunt3');
    if (shots <= 1) badges.give('hunt1'); ui.toast('타임캡슐 발견!', `${shots}발 만에 찾았어요`, 'gold'); };
  const cheer = new CheerWall(cfg);
  {
    const add0 = cheer.add.bind(cheer), list0 = cheer.list.bind(cheer);
    const thanks = () => world.edition === 'teachers';
    cheer.add = (t) => add0(thanks() ? `💐 ${t}`.slice(0, 60) : t);
    cheer.list = async () => (await list0()).filter((m) => (thanks() ? String(m.text).startsWith('💐') : !String(m.text).startsWith('💐')));
  }
  // 태권도 · 햅틱
  const taekwondo = new Taekwondo(world);
  world.taekwondo = taekwondo;
  const hap = new Haptics();
  world.hap = hap;
  // ---------- 블록 월드(숨은 모드) · 앱 보관함 ----------
  world.sunLight = sun;
  const blockWorld = new BlockWorld(world, { renderer, painter, trees, terrain, sky });
  function setBlock(on) {
    if (on) blockWorld.enable(); else blockWorld.disable();
    BlockUnlock.set(on ? 'on' : 'unlocked');
    document.getElementById('btn-block').setAttribute('aria-pressed', String(on));
    tele.track('block', { on });
  }
  function toggleBlock() {
    if (!BlockUnlock.has()) { ui.toast('잠긴 모드예요', 'HASA 택배차에서 아주 가끔 나와요'); return; }
    setBlock(!blockWorld.active);
    ui.toast(blockWorld.active ? '🧱 블록 월드' : '원래 세상', blockWorld.active ? '세상이 블록으로 바뀌었어요' : '다시 매끈해졌어요');
  }
  function unlockBlock() {
    if (BlockUnlock.has()) { ui.toast('이미 갖고 있어요', '앱 보관함에서 켜고 끌 수 있어요'); return; }
    BlockUnlock.set('unlocked');
    document.getElementById('btn-block').hidden = false;
    badges.give('blockworld');
    hap.play('hunt');
    sound.jackpot?.();
    tele.track('unlock', { item: 'blockworld' });
    ui.toast('🧱 희귀 아이템 획득!', '택배 상자에서 블록 월드 모드가 나왔어요. 앱 보관함(⋯)에서 켜고 끌 수 있어요', 'gold');
  }
  document.getElementById('btn-block').hidden = !BlockUnlock.has();
  document.getElementById('btn-block').addEventListener('click', toggleBlock);
  const launcher = new Launcher({ hap, blockUnlocked: () => BlockUnlock.has(), blockOn: () => blockWorld.active, onBlock: toggleBlock, onGame: (id) => world.openGame?.(id),
    online: () => !!world.onlineMode,
    onAvatar: () => world.pickAvatar?.(),
    onOnline: () => {
      world.setOnline?.(!world.onlineMode).then((on) => { tele.track('online', { on }); launcher.render?.(); });
    } });
  // ---------- 학교 공용 기능 · 함께 보기 · 피클볼 · 수능 편지 ----------
  const net = new SchoolNet(cfg);
  const presence = new Presence(cfg);
  const pickle = new Pickleball({ hap, sound, onEnd: (win, a, b) => { tele.track('pickle', { win, a, b }); if (win) badges.give('pickle'); } });
  const snLetter = new SuneungLetter();
  // 버튼을 누를 때마다 아주 짧게 '톡'
  document.addEventListener('pointerdown', (e) => { if (e.target.closest?.('button, label, .tool')) hap.play('tap'); }, { capture: true });
  // ---------- 어려운 배지 조건 ----------
  const t0 = performance.now();
  let tourTime = 0;
  const elapsed = () => (performance.now() - t0) / 1000;
  const collapseTimes = [];
  const namedCount = bdata.filter((b) => b.name).length;
  world.onBelt = (b, n) => { ui.toast(`🥋 ${b[1]} 승급!`, `태권도 ${n}번째 기술`, 'gold'); hap.play('badge'); };
  world.onKick = (K, n) => {
    if (n >= 5) badges.give('beltYellow');
    if (n >= 30) badges.give('beltBlue');
    if (n >= 80) badges.give('beltBlack');
    if (badges.mark('kicks5', K.id) >= KICKS.length) badges.give('allKicks');
    tele.track('kick', { k: K.id, n });
  };
  world.onHomerun = (size) => { if (size === 'XL') badges.give('homerunXL'); };
  world.onCatch = () => { badges.give('catch'); setTimeout(() => world.pill?.(innerWidth / 2, innerHeight * 0.66, { icon: '🎯', text: '이번엔 직접 내려 볼까요?', action: '착륙 챌린지', onGo: () => world.openGame?.('landing') }), 2500); };
  {
    // 접속 시각·요일·연속 접속·수능 날
    const now = new Date(), h = now.getHours();
    if (h >= 6 && h < 7) badges.give('earlybird');
    if (h >= 1 && h < 4) badges.give('nightowl');
    if (now.getDay() === 0 || now.getDay() === 6) badges.give('weekend');
    const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    badges.mark('days', key(now));
    const days = new Set(badges.stats.days || []);
    let streak = 0;
    for (let d = new Date(now); days.has(key(d)); d.setDate(d.getDate() - 1)) streak++;
    if (streak >= 3) badges.give('streak3');
    if (streak >= 7) badges.give('streak7');
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if ((cfg.suneung || []).includes(ymd)) badges.give('suneungDay');
  }
  const periods = cfg.bell?.periods || DEFAULT_PERIODS;
  const cafeteria = bdata.find((b) => b.name === '미래관');
  // 교정을 돌아다니던 학생들은 없앴어요(부수기 게임이라 사람은 등장하지 않아요).
  let lastPeriod = '';
  // 눈사람 · 분실물 지도 · D-day
  const snow = new Snowmen(world);
  const lost = new LostFound(world, cfg);
  const ddays = new DDays(cfg);
  let interact = null; // 'lost' | 'snow'
  let snowDrag = false, lostAt = null, lostItem = null;
  const canopies = new Canopies(scene, terrain, fx, cfg.canopies);
  const forceParty = location.search.includes('fireworks');
  const forceXmas = location.search.includes('xmas');

  const nukePad = new NukePad({ world, campus, R: 38, onLaunch: (P) => {
    badges.give('nuke'); badges.count('nuke3', 3); tele.track('tool', { id: 'nuke' }); hap.play('nuke');
    if (badges.mark('tools', 'nuke') >= TOOL_DEFS.length) badges.give('allTools');
    tools.nuke(P);
  } });
  ui.buildCompass();
  const btnFollow = document.getElementById('btn-follow');
  btnFollow.setAttribute('aria-pressed', String(director.enabled));
  btnFollow.addEventListener('click', () => {
    director.setEnabled(!director.enabled);
    btnFollow.setAttribute('aria-pressed', String(director.enabled));
    ui.toast(director.enabled ? '무기 따라가기 켬' : '무기 따라가기 끔', director.enabled ? '운석·핵폭탄·로켓을 카메라가 따라가요' : '');
  });

  // 터진 자리에서 떠오르는 점수
  const pops = [];
  function popup(P, pts, sub, big = false) {
    const el = document.createElement('div');
    el.className = big ? 'score-pop big' : 'score-pop';
    el.innerHTML = `+${fmt(pts)}${sub ? `<small>${sub}</small>` : ''}`;
    const o = new CSS2DObject(el);
    o.position.copy(P).add(new THREE.Vector3(0, 4, 0));
    scene.add(o);
    pops.push({ o, t: 1.4 });
  }
  const quietAcc = { pts: 0, P: new THREE.Vector3(), t: 0 };

  ui.setQuakeText(QUAKE_TEXT);
  ui.setBatSizes(BAT_SIZES);
  const toolRadius = (t) => (t.id === 'quake' ? quakeParams(tools.intensity).R : t.id === 'bat' ? BAT_SIZES[tools.batSize - 1].R : t.R);
  function selectTool(id) {
    world.online?.setTool(id);
    tools.holdEnd();
    world.hap?.play('select');
    if (typeof robodog !== 'undefined' && robodog.active && id !== 'robodog') robodog.stop(camera);
    tool = TOOL_DEFS.find((t) => t.id === id) || TOOL_DEFS[0];
    ui.setTool(tool.id);
    reticle.scale.setScalar(toolRadius(tool));
    if (tool.id === 'nuke') nukePad.open(); else nukePad.close();
    ui.showOptions(tool.options, tool.id === 'bat' ? tools.batSize : tools.intensity, (v) => {
      if (tool.id === 'bat') tools.setBatSize(v); else tools.setIntensity(v);
      reticle.scale.setScalar(toolRadius(tool));
    });
    // 레이저는 한 손가락(왼쪽 버튼)으로 쏘고, 화면 이동은 오른쪽 버튼·두 손가락으로 해요.
    controls.mouseButtons.LEFT = tool.hold ? -1 : THREE.MOUSE.PAN;
    controls.touches.ONE = tool.hold ? -1 : THREE.TOUCH.PAN;
  }
  selectTool('bomb');

  let gradeOneDone = false;
  let lastRes = { volume: 0 };
  const stats = { trees: 0 };
  function explode(P, o) {
    const R = o.R, power = o.power;
    const res = buildings.blast(P, R, power);
    lastRes = res;
    celebrate.burst(P, R);
    parked?.blast(P, R);
    const treesDown = trees.blast(P, R * 1.1);
    const cartHit = cart ? cart.blast(P, R, power) : false;
    canopies?.blast(P, R);
    cats.scare(P, R);
    snow.blast(P, R);
    wildlife.scare(P, R);
    if (store && !jackpotDone && P.distanceTo(store) < R + 4) {
      jackpotDone = true;
      badges.give('jackpot');
      extras.jackpot(store);
      sound.jackpot();
      const p = score.add(5000);
      ui.toast('매점 털었다!', `바나나우유·초코파이 잭팟 +${fmt(p)}`, 'gold');
    }
    if (lastRes.volume > (o.quiet ? 120 : 20) && examPeriod()) extras.examPapers(P, lastRes.volume);
    if (o.fx !== false) fx.explosion(P, R, { flash: o.flash ?? 1 });
    if (world.edition === 'xmas' && (o.tool === 'bomb' || o.tool === 'meteor' || (o.tool === 'rocket' && R > 10))) xmas.gifts.burst(P, R > 12 ? 18 : 10);
    const g = terrain.heightAt(P.x, P.z);
    const ground = terrain.inside(P.x, P.z) && P.y - g < R * 0.45;
    if (ground && o.crater !== false) {
      terrain.crater(P.x, P.z, R * (o.craterR ?? 0.6), R * (o.craterD ?? 0.28));
      blockWorld?.refresh(P, R * 1.2);
      trees.settle(P, R);
      buildings.wake(P, R * 1.3);
      fx.debris.wake(P, R * 1.3);
      if (o.fx !== false) fx.debrisBurst(new THREE.Vector3(P.x, g + 0.5, P.z), [R * 0.3, 0.5, R * 0.3], new THREE.Vector3(P.x, g - 2, P.z), power * 0.7, R > 12 ? 22 : 10, new THREE.Color('#7a6248'));
    }
    if (ground && o.scorch !== false) painter.scorch(P.x, P.z, R * (o.scorchR ?? 1.15));
    if (o.sound !== false) sound.boom(R / 9);

    const before = score.score;
    score.hit(res, o.tool, o.weight ?? 1);
    if (cartHit) {
      const p = score.add(1500);
      ui.toast('골프 카트가 날아갔어요!', `특별 점수 +${fmt(p)}`, 'gold');
    }
    missions.onHit(res, o.tool, { trees: treesDown, cart: cartHit, quakeId: o.quakeId });
    stats.trees += treesDown;
    ui.addScore(score.score);
    const gained = score.score - before;
    if (gained > 0) {
      if (o.quiet) { quietAcc.pts += gained; quietAcc.P.copy(P); }
      else popup(P, gained, res.collapses.length ? `${res.collapses.map((b) => b.name || '건물').join(', ')} 무너짐` : '', res.collapses.length > 0 || gained >= 3000);
    }
    for (const b of res.collapses) ui.toast(`${b.name || '건물'} 무너짐`, `+${fmt(900 * score.mult())}`);
    if (res.collapses.length) {
      badges.give('first');
      hap.play('collapse');
      const now = performance.now();
      for (const b of res.collapses) collapseTimes.push([now, o.tool]);
      while (collapseTimes.length && now - collapseTimes[0][0] > 12000) collapseTimes.shift();
      if (collapseTimes.filter(([t]) => now - t <= 10000).length >= 3) badges.give('combo3');
      if (collapseTimes.filter(([, tl]) => tl === 'nuke').length >= 3) badges.give('nukeAll');
      if (o.tool === 'tkd' && badges.inc('tkdCollapse', res.collapses.length) >= 3) badges.give('breaker');
    }
    for (const b of res.collapses) {
      tele.track('collapse', { b: b.name || b.id, tool: o.tool });
      const C = new THREE.Vector3(b.c2[0], b.base + 4, b.c2[1]);
      visuals.dust(C, Math.min(26, 8 + (b.levels || 3) * 3));
      if (b.name === '인재원 Ⅱ') { extras.soccer(C); badges.give('soccer'); ui.toast('⚽ 축구공 대방출!', '축구부 기숙사에서 공이 쏟아져요'); }
      // 부모님께 쓰는 쪽지: 어버이날엔 매번, 가정의 달(5월)엔 10%
      if (world.edition === 'parents' || (simDate.getMonth() === 4 && Math.random() < 0.1)) setTimeout(() => world.showNote?.(), 900);
      if (b.name === '하모니홀') { extras.music(C); sound.fanfare?.(); badges.give('harmony'); ui.toast('🎼 하모니 팡파레', '하모니홀에서 음표가 쏟아져요'); }
    }
    if (buildings.destroyedFraction() > 0.995) { badges.give('all'); if (elapsed() < 180) badges.give('speed100'); }
    if (!o.quiet && !res.collapses.length && score.score - before >= 2000) ui.toast('참 잘했어요', `+${fmt(score.score - before)}`);
    if (score.grade() === 1 && !gradeOneDone) {
      gradeOneDone = true;
      badges.give('grade1');
      if (elapsed() < 120) badges.give('grade1fast');
      ui.toast('1등급 달성', '종이 울립니다', 'gold');
      sound.bell(Array.isArray(cfg.bell) ? cfg.bell : undefined);
    }
    return res;
  }

  // ---------- 입력 ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function terrainHit(r) {
    const o = r.origin, d = r.direction;
    const step = 1.5;
    let prevT = 0, prevAbove = true;
    for (let t = 0; t < 4000; t += step) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (!terrain.inside(x, z)) { prevAbove = true; prevT = t; continue; }
      const above = y > terrain.heightAt(x, z);
      if (!above && prevAbove && t > 0) {
        let a = prevT, b = t;
        for (let i = 0; i < 14; i++) {
          const m = (a + b) / 2;
          if (o.y + d.y * m > terrain.heightAt(o.x + d.x * m, o.z + d.z * m)) a = m; else b = m;
        }
        return b;
      }
      prevAbove = above; prevT = t;
    }
    return Infinity;
  }
  function pick(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(buildings.pickables(), false)[0];
    const tt = terrainHit(ray.ray);
    if (hit && hit.distance <= tt) return hit.point.clone();
    if (tt < Infinity) return ray.ray.at(tt, new THREE.Vector3());
    return null;
  }

  const dom = renderer.domElement;
  let longTimer = null, longPressed = false;
  let smashMode = true;
  let wauTaps = [], wauInfo = null;
  function registerDex(id) {
    const e = DEX.find((d) => d.id === id);
    if (!e) return;
    tele.track('dex', { id });
    if (dex.add(id)) {
      ui.toast(`📗 도감 등록: ${e.name}`, e.desc, 'badge');
      if (id === 'squirrel') badges.give('squirrel');
      if (id === 'deer') badges.give('deer');
      if (id === 'boar') badges.give('boar');
      if (dex.count() >= 5) badges.give('dex5');
      if (dex.count() >= DEX.length) badges.give('dexAll');
    } else ui.toast(`${e.emoji} ${e.name}`, e.desc);
  }
  function updateBell() {
    const today = simDate.toDateString() === new Date().toDateString();
    const p = today && timeMode === 'sync' ? periodAt(new Date(), periods) : null;
    ui.setBell(p && p.kind !== 'off' ? p : null);
    const key = p ? `${p.label}-${p.until || ''}` : '';
    if (p && lastPeriod && key !== lastPeriod && p.kind !== 'off') {
      const n = parseInt(p.label, 10);
      const subj = p.kind === 'class' && ttRows ? ttRows.find((r) => r.period === n)?.subject : '';
      if (world.autoSound()) sound.bell();
      badges.give('bell');
      ui.toast('딩동댕동', `${p.label}${p.kind === 'class' ? ' 시작' : ''}${subj ? ` · ${subj}` : ''}`);
      if (p.kind === 'lunch') setTimeout(() => world.pill?.(innerWidth / 2, innerHeight * 0.62, { icon: '🏁', text: '점심시간! 급식실까지', action: '레이싱', onGo: () => world.openGame?.('race') }), 1200);
    }
    lastPeriod = key;
  }
  const seenPlaces = new Set();
  // 둘러보기: 누른 곳의 건물·차양·명소 안내
  function showPlaceInfo(P) {
    const b = buildingAt(P);
    if (b) {
      const key = Object.keys(FACILITIES).find((k) => b.name && (b.name === k || b.name.replace(/\s/g, '') === k.replace(/\s/g, '')));
      if (key) { seenPlaces.add(key); if (seenPlaces.size >= 6) badges.give('explorer'); return ui.showInfo(FACILITIES[key]); }
      return ui.showInfo({ title: b.name || '건물', desc: '', items: [] });
    }
    for (const c of cfg.canopies || []) if (Math.hypot(P.x - c.center[0], P.z - c.center[1]) < 8 && FACILITIES[c.name]) return ui.showInfo(FACILITIES[c.name]);
    if (turtle && P.distanceTo(turtle.group.position) < 8) { badges.give('turtle'); return ui.showInfo(FACILITIES['거북바위']); }
    if (busAt && Math.hypot(P.x - busAt[0], P.z - busAt[1]) < 7) return ui.showBus(cfg.bus);
  }
  const buildingAt = (P) => {
    for (const b of buildings.list) if (pointInPolygon([P.x, P.z], b.poly)) return b;
    let best = null, bd = 3;
    for (const b of buildings.list) { const d = distToPolygonEdge([P.x, P.z], b.poly); if (d < bd) { bd = d; best = b; } }
    return best;
  };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  async function openMeal() {
    const t = `${simDate.getMonth() + 1}월 ${simDate.getDate()}일 ${WEEK[simDate.getDay()]}요일 급식`;
    ui.showMeal(t, null);
    badges.give('meal');
    try { ui.showMeal(t, await fetchMeals(cfg, simDate)); } catch (err) { ui.showMeal(t, [], err.message || '인터넷 연결을 확인해 주세요'); }
  }
  const pointers = new Set();
  let down = null;
  let hover = null;
  let holding = false;
  let walkDrag = null;
  dom.addEventListener('pointerdown', (e) => {
    if (photoMode) return;
    if (walk.active) { walkDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
    if (interact === 'snow' && e.isPrimary) {
      const P = pick(e.clientX, e.clientY);
      if (P) { snow.begin(P); snowDrag = true; return; }
    }
    if (robodog.active) return;
    if (director.busy) { director.skip(); down = null; return; }
    pointers.add(e.pointerId);
    if (pointers.size > 1) { down = null; if (holding) { tools.holdEnd(); holding = false; } return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button };
    // 꾹 누르기(0.65초): 미래관(급식실)이면 급식 메뉴
    clearTimeout(longTimer);
    const d0 = down;
    longTimer = setTimeout(() => {
      if (down !== d0 || holding) return;
      const P = pick(d0.x, d0.y);
      const b = P && buildingAt(P);
      if (b && /미래관|식당|급식/.test(b.name)) { longPressed = true; down = null; openMeal(); return; }
      if (b && /^본관/.test(b.name)) { longPressed = true; down = null; showSupplement(); return; }
      if (P && world.placeGame) {
        const gm = world.placeGame(P);
        if (gm) { longPressed = true; down = null; world.pill(d0.x, d0.y, gm); return; }
      }
      if (P && busAt && Math.hypot(P.x - busAt[0], P.z - busAt[1]) < 7) { longPressed = true; down = null; ui.showBus(cfg.bus); badges.give('bus'); }
    }, 650);
    if (tool.hold && e.button === 0) {
      const P = pick(e.clientX, e.clientY);
      if (P) { sound.ensure(); tools.holdStart(P); holding = true; }
    }
  });
  dom.addEventListener('pointermove', (e) => {
    if (snowDrag) { const P = pick(e.clientX, e.clientY); if (P) snow.move(P); return; }
    if (walk.active && walkDrag && e.pointerId === walkDrag.id) { walk.look(e.clientX - walkDrag.x, e.clientY - walkDrag.y); walkDrag.x = e.clientX; walkDrag.y = e.clientY; return; }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) clearTimeout(longTimer);
    if (e.pointerType === 'mouse') hover = [e.clientX, e.clientY];
    if (holding) tools.holdMove(pick(e.clientX, e.clientY));
  });
  dom.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId);
    if (walk.active) { walkDrag = null; return; }
    if (snowDrag) {
      snowDrag = false;
      const r = snow.end();
      if (r === 'done') { ui.toast('☃️ 눈사람 완성!', '목도리까지 둘러 줬어요'); badges.give('snowman'); sound.pop?.(); hap.play('badge'); if (badges.inc('snowmen', world.edition === 'firstsnow' ? 2 : 1) >= 3) badges.give('snowman3'); }
      else if (r === 'base') ui.toast('몸통 완성', '이번엔 작은 눈덩이를 굴려서 위에 올려 보세요');
      down = null;
      return;
    }
    clearTimeout(longTimer);
    if (longPressed) { longPressed = false; down = null; return; }
    if (holding) { tools.holdEnd(); holding = false; down = null; return; }
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (down.b === 0 && moved < 8 && performance.now() - down.t < 450 && !tool.hold) {
      sound.ensure();
      const rect = renderer.domElement.getBoundingClientRect();
      // 분실물 지도: 핀을 누르면 보기, 땅을 누르면 등록
      if (interact === 'lost') {
        down = null;
        const it = lost.pickScreen(e.clientX, e.clientY, camera, rect);
        if (it) { openLostView(it); return; }
        const Pl = pick(e.clientX, e.clientY);
        if (Pl) { lostAt = Pl; document.getElementById('lost-name').value = ''; document.getElementById('lost-note').value = ''; ui.modal('lost-form', true); }
        return;
      }
      if (interact === 'snow') { down = null; return; }
      // 고양이를 누르면 쓰다듬어요(무기는 안 나가요). 화면에서 넉넉하게 찾아요.
      const cat = cats.pickScreen(e.clientX, e.clientY, camera, rect);
      if (cat) {
        tele.track('pet', { cat: cat.dex });
        hap.play('pet');
        if (badges.mark('cats', cat.dex) >= 5) badges.give('allCats');
        cats.pet(cat); badges.count('cat5', 5); if (cat.scale < 2.5) badges.give('kitten');
        if (cat.dex) registerDex(cat.dex);
        down = null; return;
      }
      const animal = wildlife.pickScreen(e.clientX, e.clientY, camera, rect);
      if (animal) { sound.animal(animal.id); registerDex(animal.id); down = null; return; }
      if (celebrate.pickScreen(e.clientX, e.clientY, camera, rect)) { down = null; return; }
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // 택배차
      if (delivery.hit(ray)) {
        down = null;
        // 택배 상자 뽑기: 방문마다 한 번, 8% 확률로 블록 월드
        if (!delivery.rolled) {
          delivery.rolled = true;
          if (!BlockUnlock.has() && Math.random() < (cfg.blockChance ?? 0.08)) unlockBlock();
          else if (Math.random() < (cfg.skinChance ?? 0.12)) world.unlockSkin?.();
        }
        if (smashMode && delivery.rocketDelivery()) { delivery.leave(); badges.give('delivery'); tele.track('delivery'); }
        else if (!smashMode) ui.toast('HASA 택배', 'SMASH 모드에서 누르면 특별 배송이 시작돼요');
        return;
      }
      const P = pick(e.clientX, e.clientY);
      // 와우관(3학년관) 연타 → 응원 메시지 벽
      const wb = P && buildingAt(P);
      if (wb && wb.name === '와우관') {
        const now = performance.now();
        wauTaps = wauTaps.filter((t) => now - t < 2500);
        wauTaps.push(now);
        if (wauTaps.length >= (smashMode ? 5 : 3)) { wauTaps = []; clearTimeout(wauInfo); ui.showCheer(cheer); down = null; return; }
        if (!smashMode) { clearTimeout(wauInfo); wauInfo = setTimeout(() => showPlaceInfo(P), 450); down = null; return; }
      }
      // 둘러보기 모드: 건물·명소 정보
      if (!smashMode) {
        down = null;
        if (P) showPlaceInfo(P);
        return;
      }
      // 타임캡슐 찾기 중에는 탐사 폭탄
      if (hunt.active && P) { hunt.fire(P); down = null; return; }
      if (P && tool.id === 'robodog') { tele.track('tool', { id: 'robodog' }); hap.play('robodog'); if (badges.mark('tools', 'robodog') >= TOOL_DEFS.length) badges.give('allTools'); sound.ensure(); director.skip(); robodog.start(P, controls, camera); ui.toast('로봇개 조종 시작', device === 'desktop' ? 'WASD로 움직이고 Space로 화염, Esc로 나가요' : '왼쪽 조이스틱으로 움직이고 화염 버튼을 눌러요'); }
      else if (P && editor) editor.add(P);
      else if (P && tool.id === 'nuke') nukePad.setTarget(P);
      else if (P) {
        if (tool.id === 'meteor') setTimeout(() => badges.give('alien'), 1600);
        if (tool.id === 'meteor' && badges.count('meteorPill', 3) === 3) setTimeout(() => world.pill?.(innerWidth / 2, innerHeight * 0.3, { icon: '☄️', text: '운석이 계속 떨어지네요', action: '막으러 가기', onGo: () => world.openGame?.('meteor') }), 2200);
        if (tool.id === 'rocket' && !world.dockPilled) { world.dockPilled = true; setTimeout(() => world.pill?.(innerWidth / 2, innerHeight * 0.3, { icon: '🛰️', text: '2단 궤도 진입', action: '정거장 도킹', onGo: () => world.openGame?.('docking') }), 26000); }
        if (tool.id === 'rocket') badges.give('rocket');
        if (tool.id === 'quake' && tools.intensity >= 10) badges.give('quake10');
        tele.track('tool', { id: tool.id, ...(tool.id === 'quake' ? { lv: tools.intensity } : {}), ...(tool.id === 'bat' ? { size: tools.batSize } : {}) });
        hap.play(tool.id, tools.intensity);
        if (badges.mark('tools', tool.id) >= TOOL_DEFS.length) badges.give('allTools');
        if (tool.id === 'quake' && badges.mark('quakes', tools.intensity) >= 7) badges.give('quakeAll');
        if (tool.id === 'rocket' && badges.inc('rockets') >= 5) badges.give('rocket5');
        tools.fire(tool, P);
      }
    }
    down = null;
  });
  dom.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); down = null; if (holding) { tools.holdEnd(); holding = false; } });
  dom.addEventListener('pointerleave', () => { hover = null; reticle.visible = false; });
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    // 개발자 전용: Ctrl + Shift + H → HASA 관제센터(텔레메트리)
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyH') { e.preventDefault(); tele.flush(true); location.href = 'hasa.html'; return; }
    // 개발자 전용: Ctrl + Shift + B → 블록 월드 바로 얻기(테스트용)
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') { e.preventDefault(); unlockBlock(); return; }
    // 개발자 전용: Ctrl + Shift + D → 택배차 바로 호출
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); delivery.arrive(); ui.toast('개발자 모드', '택배차를 불렀어요'); return; }
    if (photoMode && e.code === 'Escape') { setPhoto(false); return; }
    if (interact && e.code === 'Escape') { setInteract(null); return; }
    if (walk.active) {
      if (e.code === 'Escape') { walk.stop(camera); return; }
      if (walk.key(e.code, true)) e.preventDefault();
      return;
    }
    if (robodog.active) {
      if (e.code === 'Escape') { robodog.stop(camera); return; }
      if (robodog.key(e.code, true)) e.preventDefault();
      return;
    }
    if (!document.getElementById('sheet').hidden) return;
    const i = e.key === '0' ? 9 : Number(e.key) - 1;
    if (TOOL_DEFS[i]) selectTool(TOOL_DEFS[i].id);
    if (e.key === 'n' || e.key === 'N') toggleNight();
    if (e.key === 'Enter' && tool.id === 'nuke') nukePad.launch();
    if (e.key === 'Escape') director.skip();
  });

  addEventListener('keyup', (e) => { if (robodog.active) robodog.key(e.code, false); if (walk.active) walk.key(e.code, false); });

  // ---------- 1인칭 신입생 투어 ----------
  {
    const near0 = ui.walkNear.bind(ui);
    ui.walkNear = (b) => { near0(b); if (b && walk.active && badges.mark('tourSeen', b.name) >= namedCount) badges.give('tourAll'); };
  }
  {
    const stick = document.getElementById('walk-stick'), knob = document.getElementById('walk-knob');
    let sid = null;
    const moveStick = (e) => {
      const r = stick.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      knob.style.transform = `translate(${x * r.width * 0.3}px, ${y * r.height * 0.3}px)`;
      walk.stick.x = Math.abs(x) > 0.15 ? x : 0;
      walk.stick.y = Math.abs(y) > 0.15 ? -y : 0;
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); moveStick(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; walk.stick.x = walk.stick.y = 0; };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    document.getElementById('walk-exit').addEventListener('click', () => walk.stop(camera));
    document.getElementById('walk-near-info').addEventListener('click', () => { if (walk.near) showPlaceInfo(new THREE.Vector3(walk.near.c2[0], walk.near.base, walk.near.c2[1])); });
    const guide = document.getElementById('walk-guide');
    for (const b of buildings.list) {
      if (!b.name) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.name;
      btn.addEventListener('click', () => walk.goTo(b));
      guide.appendChild(btn);
    }
    document.getElementById('btn-walk').addEventListener('click', () => {
      const P = new THREE.Vector3(focus[0], 0, focus[1]);
      const gate = cfg.bus?.at ? new THREE.Vector3(cfg.bus.at[0] - 6, 0, cfg.bus.at[1]) : P;
      walk.start(gate, camera, controls);
      tele.track('walk');
      walk.yaw = Math.atan2(focus[0] - gate.x, focus[1] - gate.z);
      badges.give('tour');
      ui.toast('신입생 투어', device === 'desktop' ? 'WASD로 걷고, 마우스를 끌어서 둘러봐요' : '왼쪽 조이스틱으로 걷고, 화면을 끌어서 둘러봐요');
    });
  }

  // ---------- 사진 모드 ----------
  let photoMode = false;
  function setPhoto(on) {
    photoMode = on;
    document.body.classList.toggle('photo', on);
    document.getElementById('photo-ui').hidden = !on;
    controls.autoRotate = on;
    controls.autoRotateSpeed = 0.5;
    if (on) badges.give('photo');
    visuals.photoDOF(on);
  }
  document.getElementById('btn-photo').addEventListener('click', () => setPhoto(true));
  document.getElementById('photo-exit').addEventListener('click', () => setPhoto(false));
  document.getElementById('photo-save').addEventListener('click', () => {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png');
    a.download = `smash-hanvit-photo-${Date.now()}.png`;
    a.click();
  });

  // ---------- 게임: 타임캡슐 찾기 ----------
  document.getElementById('btn-game').addEventListener('click', () => {
    if (!smashMode) setMode(true); // 타임캡슐은 폭탄이 필요해서 SMASH 모드로 바꿔요
    sound.ensure();
    hunt.start();
  });
  document.getElementById('hunt-btn').addEventListener('click', () => { if (hunt.active) hunt.stop(); else hunt.start(); });

  // ---------- 도감 · 응원 벽 ----------
  document.getElementById('btn-dex').addEventListener('click', () => ui.showDex(dex.entries()));
  document.getElementById('dex-close').addEventListener('click', () => ui.modal('dex', false));
  document.getElementById('dex').addEventListener('click', (e) => { if (e.target.id === 'dex') ui.modal('dex', false); });
  document.getElementById('cheer-close').addEventListener('click', () => ui.modal('cheer', false));
  document.getElementById('cheer').addEventListener('click', (e) => { if (e.target.id === 'cheer') ui.modal('cheer', false); });
  const sendCheer = async () => {
    const inp = document.getElementById('cheer-input');
    const r = await cheer.add(inp.value);
    if (!r.ok) { ui.toast('붙이지 못했어요', r.why); return; }
    inp.value = '';
    badges.give('cheer');
    ui.showCheer(cheer);
  };
  document.getElementById('cheer-send').addEventListener('click', sendCheer);
  document.getElementById('cheer-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCheer(); });

  // ---------- 학교생활: 시간표 · D-day · 분실물 · 응원의 벽 · 눈사람 ----------
  const snowy = () => seasons.season === 'winter' || wx?.kind === 'snow' || !!world.xmasOn;
  function setInteract(m) {
    if (m) tele.track('interact', { m });
    interact = m;
    snowDrag = false;
    document.body.classList.toggle('interact', !!m);
    document.getElementById('mode-bar').hidden = !m;
    document.getElementById('mode-bar-text').textContent = m === 'lost' ? '🔍 분실물 지도 · 땅을 눌러 등록하고, 핀을 눌러 확인해요' : m === 'snow' ? '☃️ 눈사람 만들기 · 땅을 끌어 굴리고, 작은 눈덩이를 몸통 위에 놓아요' : '';
    controls.enableRotate = m !== 'snow';
    lost.setVisible(m === 'lost');
    if (m === 'lost') lost.load();
    lostPresence(m === 'lost');
    reticle.visible = false;
  }
  const lifeMenu = document.getElementById('life-menu');
  document.getElementById('btn-life').addEventListener('click', (e) => {
    e.stopPropagation();
    lifeMenu.hidden = !lifeMenu.hidden;
    document.getElementById('life-snow').classList.toggle('off', !snowy());
  });
  dom.addEventListener('pointerdown', () => { lifeMenu.hidden = true; });
  const closeLife = () => { lifeMenu.hidden = true; };
  document.getElementById('life-cheer').addEventListener('click', () => { closeLife(); ui.showCheer(cheer); });
  document.getElementById('life-lost').addEventListener('click', () => { closeLife(); setInteract(interact === 'lost' ? null : 'lost'); });
  document.getElementById('life-snow').addEventListener('click', () => {
    closeLife();
    if (!snowy()) { ui.toast('눈이 있어야 만들 수 있어요', '겨울·눈 오는 날·크리스마스에 해 보세요(날씨를 "눈"으로 바꿔도 돼요)'); return; }
    setInteract(interact === 'snow' ? null : 'snow');
  });
  document.getElementById('mode-bar-exit').addEventListener('click', () => setInteract(null));
  // 분실물 등록·보기
  const openLostView = (it) => {
    lostItem = it;
    document.getElementById('lost-view-kind').textContent = it.kind === 'found' ? '주웠어요' : '찾고 있어요';
    document.getElementById('lost-view-name').textContent = it.name;
    document.getElementById('lost-view-note').textContent = it.note || '';
    document.getElementById('lost-view-date').textContent = it.at ? new Date(it.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' 등록' : '';
    ui.modal('lost-view', true);
  };
  document.getElementById('lost-save').addEventListener('click', async () => {
    if (!lostAt) return;
    const kind = document.querySelector('input[name="lost-kind"]:checked').value;
    const r = await lost.add({ kind, name: document.getElementById('lost-name').value, note: document.getElementById('lost-note').value, x: lostAt.x, z: lostAt.z });
    if (!r.ok) { ui.toast('등록하지 못했어요', r.why); return; }
    ui.modal('lost-form', false);
    badges.give('lost');
    presence.send('lost', 'new');
    ui.toast('📍 등록했어요', kind === 'found' ? '주인이 찾아가길!' : '꼭 찾길 바라요!');
  });
  document.getElementById('lost-resolve').addEventListener('click', async () => { if (lostItem) await lost.resolve(lostItem); ui.modal('lost-view', false); ui.toast('해결!', '핀을 지웠어요'); });
  for (const id of ['lost-form', 'lost-view']) {
    document.getElementById(`${id}-close`).addEventListener('click', () => ui.modal(id, false));
    document.getElementById(id).addEventListener('click', (e) => { if (e.target.id === id) ui.modal(id, false); });
  }
  // D-day
  function renderDDayChip() {
    const e = ddays.pinned(simDate);
    const c = document.getElementById('dday-chip');
    c.hidden = !e || e.id === 'suneung';
    if (e && e.id !== 'suneung') c.innerHTML = `<b>${dLabel(e.days)}</b><span>${e.name}</span>`;
  }
  function renderDDays() {
    const ul = document.getElementById('dday-list');
    ul.innerHTML = '';
    for (const e of ddays.list(simDate)) {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="pin ${ddays.pin === e.id ? 'on' : ''}" aria-label="고정">★</button><span>${e.name}<br><small>${e.date.getMonth() + 1}월 ${e.date.getDate()}일</small></span><b>${dLabel(e.days)}</b>${e.auto ? '<i></i>' : '<button type="button" class="del" aria-label="지우기">✕</button>'}`;
      li.querySelector('.pin').addEventListener('click', () => { ddays.setPin(e.id); renderDDays(); renderDDayChip(); updateDates(); });
      li.querySelector('.del')?.addEventListener('click', () => { ddays.remove(e.id); renderDDays(); renderDDayChip(); });
      ul.appendChild(li);
    }
  }
  const openDDay = () => { renderDDays(); ui.modal('dday', true); };
  document.getElementById('life-dday').addEventListener('click', () => { closeLife(); openDDay(); });
  document.getElementById('dday-chip').addEventListener('click', openDDay);
  document.getElementById('dday-close').addEventListener('click', () => ui.modal('dday', false));
  document.getElementById('dday').addEventListener('click', (e) => { if (e.target.id === 'dday') ui.modal('dday', false); });
  document.getElementById('dday-add').addEventListener('click', () => {
    if (ddays.add(document.getElementById('dday-name').value, document.getElementById('dday-date').value)) {
      document.getElementById('dday-name').value = '';
      badges.give('dday');
      renderDDays(); renderDDayChip();
    } else ui.toast('이름과 날짜를 넣어 주세요', '');
  });
  ddayReady = true;
  renderDDayChip();
  // 시간표(나이스)
  const ttGrade = document.getElementById('tt-grade'), ttClass = document.getElementById('tt-class');
  for (let i = 1; i <= 12; i++) ttClass.insertAdjacentHTML('beforeend', `<option value="${i}">${i}반</option>`);
  try { ttGrade.value = localStorage.getItem('smash-tt-grade') || String(board.grade || 1); ttClass.value = localStorage.getItem('smash-tt-class') || '1'; } catch { /* 무시 */ }
  let ttRows = null;
  const classPeriods = () => periods.filter((p) => p[0] !== '점심');
  async function loadTT() {
    const list = document.getElementById('tt-list');
    const d = simDate;
    document.getElementById('tt-date').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 · ${ttGrade.value}학년 ${ttClass.value}반`;
    list.innerHTML = '<li><span></span><span>불러오는 중…</span></li>';
    try { localStorage.setItem('smash-tt-grade', ttGrade.value); localStorage.setItem('smash-tt-class', ttClass.value); } catch { /* 무시 */ }
    try {
      ttRows = await fetchTimetable(cfg, d, ttGrade.value, ttClass.value);
      const now = periodAt(new Date(), periods);
      const today = d.toDateString() === new Date().toDateString();
      list.innerHTML = ttRows.length ? '' : '<li><span></span><span>이 날은 시간표가 없어요(주말·방학·시험 기간일 수 있어요)</span></li>';
      for (const r of ttRows) {
        const p = classPeriods()[r.period - 1];
        const li = document.createElement('li');
        if (today && now.label === `${r.period}교시`) li.className = 'now';
        li.innerHTML = `<em>${r.period}교시</em><span>${r.subject}</span><small>${p ? `${p[1]}~${p[2]}` : ''}</small>`;
        list.appendChild(li);
      }
    } catch {
      list.innerHTML = '<li><span></span><span>시간표를 불러오지 못했어요</span></li>';
    }
  }
  const openTT = () => { ui.modal('tt', true); loadTT(); badges.give('timetable'); };
  document.getElementById('life-tt').addEventListener('click', () => { closeLife(); openTT(); });
  document.getElementById('bell-chip').addEventListener('click', openTT);
  ttGrade.addEventListener('change', loadTT);
  ttClass.addEventListener('change', loadTT);
  document.getElementById('tt-close').addEventListener('click', () => ui.modal('tt', false));
  document.getElementById('tt').addEventListener('click', (e) => { if (e.target.id === 'tt') ui.modal('tt', false); });

  // ---------- 부모님께 쓰는 쪽지(이스터에그) ----------
  {
    const NOTES = world.NOTES = [
      '엄마, 아침마다 깨워 줘서 고마워요. 내일은 한 번에 일어나 볼게요.',
      '아빠, 학원 끝나고 데리러 와 줘서 고마워요. 차 안에서 같이 듣던 노래 좋아요.',
      '시험 망쳤다고 했을 때 괜찮다고 해 줘서, 사실 엄청 힘이 됐어요.',
      '도시락 대신 급식이지만, 집밥이 제일 맛있다는 건 비밀이에요.',
      '잔소리라고 투덜댔지만 다 맞는 말이었어요. 고마워요.',
      '제가 꿈을 바꿀 때마다 응원해 줘서 고마워요. 이번 꿈은 오래 갈 것 같아요.',
      '늦게 들어와도 거실 불 켜 두고 기다려 줘서 고마워요.',
      '사랑한다는 말은 잘 못 하지만, 이 쪽지로 대신할게요. 사랑해요.',
    ];
    world.showNote = () => {
      let got = []; try { got = JSON.parse(localStorage.getItem('smash-notes') || '[]'); } catch { /* 무시 */ }
      const left = NOTES.map((_, i) => i).filter((i) => !got.includes(i));
      const i = left.length ? left[Math.floor(Math.random() * left.length)] : Math.floor(Math.random() * NOTES.length);
      if (!got.includes(i)) { got.push(i); try { localStorage.setItem('smash-notes', JSON.stringify(got)); } catch { /* 무시 */ } }
      if (got.length >= 5) badges.give('letter');
      document.getElementById('note-text').textContent = NOTES[i];
      document.getElementById('note-count').textContent = `쪽지 ${got.length}/${NOTES.length}`;
      ui.modal('note', true); hap.play('pet');
    };
    document.getElementById('note-close').addEventListener('click', () => ui.modal('note', false));
    document.getElementById('note-card').addEventListener('click', () => { ui.modal('note', false); setTimeout(() => world.openLetter?.(), 250); });
    document.getElementById('note').addEventListener('click', (e) => { if (e.target.id === 'note') ui.modal('note', false); });
  }

  // ---------- 보충(8·9교시) 반 알파벳: 본관을 꾹 ----------
  function showSupplement() {
    const S = cfg.supplement || {};
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = ymd(simDate);
    let day = S[today] ? today : Object.keys(S).sort().find((k) => k > today);
    hap.play('select');
    tele.track('open', { id: 'supplement' });
    if (!day) { ui.toast('보충 일정이 없어요', 'data/schedule.json에 새 보충표를 넣으면 나와요'); return; }
    const [a, b] = S[day];
    const [y, m, d] = day.split('-').map(Number);
    const wd = '일월화수목금토'[new Date(y, m - 1, d).getDay()];
    const label = day === today ? '오늘' : `${m}월 ${d}일(${wd})`;
    if (!/^[A-Z]$/.test(a)) ui.toast(`📚 ${label} 보충`, `${a} · 보충 수업 없어요`, 'gold');
    else ui.toast(`📚 ${label} 보충`, `8교시 ${a}반 · 9교시 ${b}반`, 'gold');
  }

  // 자동 소리(실제 교시 종소리·택배차 경적): 설정에서 켜요. 기본은 꺼짐
  world.autoSound = () => { try { return localStorage.getItem('smash-autosound') === 'on'; } catch { return false; } };
  {
    const box = document.getElementById('set-autosound');
    if (box) { box.checked = world.autoSound(); box.addEventListener('change', () => { try { localStorage.setItem('smash-autosound', box.checked ? 'on' : 'off'); } catch { /* 무시 */ } }); }
  }
  world.cats = world.cats || cats;
  {
    const seg = document.getElementById('set-gender');
    const cur = () => { try { return localStorage.getItem('smash-gender') || ''; } catch { return ''; } };
    const paint = () => { for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.g === cur()); };
    world.setGender = (gv) => {
      try { localStorage.setItem('smash-gender', gv); } catch { /* 무시 */ }
      presence.me.g = gv; paint(); world.online?.refreshLooks(true);
      ui.toast('아바타', gv === 'f' ? '여학생으로 바꿨어요 · 1인칭 투어에서 보여요' : '남학생으로 바꿨어요 · 1인칭 투어에서 보여요');
    };
    world.hasGender = () => !!cur();
    for (const b of seg.querySelectorAll('button')) b.addEventListener('click', () => world.setGender(b.dataset.g));
    // 고르기 창
    const pick = document.getElementById('av-pick');
    world.pickAvatar = () => { for (const b of pick.querySelectorAll('[data-g]')) b.classList.toggle('on', b.dataset.g === cur()); ui.modal('av-pick', true); };
    for (const b of pick.querySelectorAll('[data-g]')) b.addEventListener('click', () => { world.setGender(b.dataset.g); ui.modal('av-pick', false); });
    document.getElementById('av-close').addEventListener('click', () => ui.modal('av-pick', false));
    if (cur()) presence.me.g = cur();
    paint();
  }

  // ---------- 미니게임 · 시즌 패스 ----------
  const pass = new SeasonPass({
    toast: (a, b) => ui.toast(a, b, 'gold'),
    onReward: (kind, val, lv) => { if (kind === 'skin') skinStore.add(val); if (lv >= 30) badges.give('season30'); },
  });
  world.pass = pass;
  const GAMES = { race: () => { const g = race(); g.onSector = () => badges.give('secbeat'); g.onGhost = () => badges.give('ghostbeat'); g.onRival = () => badges.give('rivalbeat');
    g.onLap = (t, samples) => { if (world.onlineMode) online.submitGhost(g.circuit, g.week, t, samples, presence.me.nick); };
    g.onRank = async (box) => {
      if (!box || !online.available) return;
      box.innerHTML = '<p class="arc-x-t">이번 주 전교 순위 불러오는 중…</p>';
      const rows = await online.weeklyTop(g.circuit, g.week);
      const fmt = (ms) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`;
      box.innerHTML = rows.length ? `<p class="arc-x-t">이번 주 전교 순위</p><ol class="gp-rank">${rows.map((r, i) => `<li><b>${i + 1}</b><span>${r.name}${r.grade ? ` · ${r.grade}학년` : ''}</span><em>${fmt(r.lap_ms)}</em>${i < 3 ? `<button type="button" data-c="${r.client}">고스트와 달리기</button>` : ''}</li>`).join('')}</ol>` : '<p class="arc-x-t">이번 주 전교 기록이 아직 없어요. 온라인을 켜고 달리면 첫 기록이 돼요</p>';
      for (const b of box.querySelectorAll('button[data-c]')) b.addEventListener('click', async () => { b.textContent = '불러오는 중…'; const gh = await online.ghost(g.circuit, g.week, b.dataset.c); g.setRival(gh); b.textContent = gh ? '✓ 고스트 준비됨' : '불러오지 못했어요'; });
    };
    return g; }, soccer, basketball, tycoon, crane, meteor, landing, docking };
  const arcade = new Arcade({
    hap, sound,
    onResult: (id, r, better) => {
      pass.add(r.win ? 120 : 40, id);
      tele.track('game', { id, score: r.score, win: !!r.win, best: !!better });
      const B = { race: r.win && 'gpchamp', docking: r.win && 'docked', meteor: r.win && 'defender', landing: r.win && 'lander', soccer: r.win && 'shootout', basketball: r.score >= 32 && 'sniper', tycoon: r.score >= 30000 && 'tycoon' };
      if (B[id]) badges.give(B[id]);
      // 캠페인 단계 성공 → 모듈 장착
      if (arcade.game?.campaign !== undefined && r.win && campaign.win(arcade.game.campaign)) {
        const st = STAGES[arcade.game.campaign];
        ui.toast(`🛰️ ${st.mod} 장착`, `우주정거장 ${campaign.done()}/10 · 다음 단계가 열렸어요`, 'gold');
        if (campaign.done() >= STAGES.length) badges.give('campaign');
      }
      if (id === 'crane') { const n = craneProgress.add(r.score); site?.setProgress(n); if (n >= 50) badges.give('builder'); }
    },
  });
  celebrate.onCollect = (got, total, label, kind) => {
    sound.pop?.(); hap.play('tap');
    ui.toast(`${label} ${got}/${total}`, got === total ? '전부 모았어요! 시즌 +100 XP' : '', got === total ? 'gold' : undefined);
    if (got === total) { badges.give('edcollect'); pass.add(100, `collect-${kind}`); tele.track('edcollect', { kind }); }
  };
  // ---------- 온라인 모드(2.0) ----------
  const online = new Online({ cfg, presence, world, ui, hap, grade: () => board.grade || 0, onBadge: (b) => badges.give(b), onXP: (x) => pass.add(x, 'raid') });
  world.online = online;
  const emoteBar = document.getElementById('emote-bar');
  emoteBar.innerHTML = EMOTES.map((e) => `<button type="button" data-e="${e}" aria-label="${e} 보내기">${e}</button>`).join('');
  for (const b of emoteBar.querySelectorAll('button')) b.addEventListener('click', () => online.emote(b.dataset.e));
  world.uniformNow = () => {
    const today = simDate.toDateString() === new Date().toDateString();
    return uniformFor(today && !wx?.manual ? wx?.temp : undefined, simDate.getMonth() + 1);
  };
  world.setOnline = async (on) => { const r = await online.setOn(on); world.onlineMode = r; emoteBar.hidden = !r; document.body.classList.toggle('is-online', r); if (r && !world.hasGender?.()) setTimeout(() => world.pickAvatar?.(), 500); return r; };
  world.openGame = (id) => {
    if (id === 'campaign') { launcher.close(true); return openCampaign(); }
    if (!GAMES[id]) return; launcher.close(true); arcade.open(GAMES[id]());
  };
  // ---------- HASA 우주정거장 건설 캠페인 ----------
  function openCampaign() {
    const n = campaign.done();
    document.getElementById('camp-count').textContent = `${n}/${STAGES.length}`;
    document.getElementById('camp-art').innerHTML = stationSVG(n);
    const list = document.getElementById('camp-list');
    list.innerHTML = STAGES.map((st, i) => `<li><button type="button" data-i="${i}" class="${i < n ? 'done' : i === n ? 'next' : ''}" ${i > n ? 'disabled' : ''}><b>${i < n ? '✓' : i + 1}</b><span>${st.name}<em>${st.type === 'docking' ? '도킹' : '운석 요격'} · ${st.story}</em></span><b>${i > n ? '잠김' : i === n ? '도전' : '다시'}</b></button></li>`).join('');
    for (const b of list.querySelectorAll('button')) b.addEventListener('click', () => { ui.modal('camp', false); arcade.open(campaign.game(Number(b.dataset.i))); });
    ui.modal('camp', true);
  }
  document.getElementById('camp-close').addEventListener('click', () => ui.modal('camp', false));
  document.getElementById('camp').addEventListener('click', (e) => { if (e.target.id === 'camp') ui.modal('camp', false); });
  world.pill = (x, y, o) => contextPill(x, y, o);
  site?.setProgress(craneProgress.get());
  // 장소별 게임(꾹 누르기): 축구장·농구장·매점·공사장
  {
    const areas = (campus.areas || []).filter((a) => a.kind === 'pitch').map((a) => cleanPolygon(a.poly)).sort((a, b) => signedArea(b) - signedArea(a));
    const inPoly = (P, poly) => !!poly && pointInPolygon([P.x, P.z], poly);
    world.placeGame = (P) => {
      if (inPoly(P, areas[0])) return { icon: '⚽', text: '축구장', action: '승부차기', onGo: () => world.openGame('soccer') };
      if (areas[1] && inPoly(P, areas[1])) return { icon: '🏀', text: '농구장', action: '60초 슛아웃', onGo: () => world.openGame('basketball') };
      if (store && Math.hypot(P.x - store.x, P.z - store.z) < 7) return { icon: '🛒', text: 'HV STORE', action: '매점 타이쿤', onGo: () => world.openGame('tycoon') };
      if (site && (inPoly(P, site.site.poly) || inPoly(P, site.site.yard) || Math.hypot(P.x - site.crane.at.x, P.z - site.crane.at.z) < 6)) return { icon: '🏗️', text: '증축 현장', action: '크레인 조종', onGo: () => world.openGame('crane') };
      return null;
    };
  }
  world.unlockSkin = () => {
    const own = skinStore.owned(), left = SKINS.filter((k) => !own.includes(k.id));
    if (!left.length) return;
    const k = left[Math.floor(Math.random() * left.length)];
    skinStore.add(k.id);
    hap.play('hunt'); sound.jackpot?.();
    tele.track('unlock', { item: `skin-${k.id}` });
    ui.toast('🏁 새 차 스킨!', `택배 상자에서 “${k.name}”이 나왔어요. 급식 레이싱에서 골라 타요`, 'gold');
  };
  document.getElementById('btn-arcade').addEventListener('click', () => { document.body.classList.remove('more-open'); launcher.open(); });
  document.getElementById('btn-pass').addEventListener('click', () => { pass.render(document.getElementById('pass-body')); ui.modal('pass', true); });
  document.getElementById('pass-close').addEventListener('click', () => ui.modal('pass', false));
  document.getElementById('pass').addEventListener('click', (e) => { if (e.target.id === 'pass') ui.modal('pass', false); });
  document.getElementById('meal-race').addEventListener('click', () => { ui.modal('meal', false); world.openGame('race'); });

  // ---------- 나의 한빛 앨범(졸업 앨범) ----------
  try { if (!localStorage.getItem('smash-first')) localStorage.setItem('smash-first', new Date().toISOString().slice(0, 10)); } catch { /* 무시 */ }
  const clean = (t) => { const s0 = String(t || '').replace(/[<>]/g, '').slice(0, 80); return /시발|씨발|ㅅㅂ|병신|좆|존나|fuck|shit/i.test(s0.replace(/\s/g, '')) ? '' : s0; };
  const album = new Album({
    gather: () => {
      const L = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
      const first = (localStorage.getItem('smash-first') || '').replace(/-/g, '.');
      const got = badges.list().filter((x) => x.got).map((x) => [x.b, x.no]);
      const fmtT = (v) => `${Math.floor(v / 60000)}:${((v % 60000) / 1000).toFixed(2).padStart(5, '0')}`;
      const best = (id, f) => { const v = Number(localStorage.getItem(`smash-best-${id}`) || 0); return v ? f(v) : null; };
      const records = [
        ['한빛 그랑프리', best('race', fmtT)], ['도킹', best('docking', (v) => `${v}점`)], ['운석 요격', best('meteor', (v) => `${v}점`)], ['착륙', best('landing', (v) => `${v}점`)],
        ['슛아웃', best('basketball', (v) => `${v}점`)], ['매점', best('tycoon', (v) => `${v.toLocaleString('ko-KR')}원`)], ['크레인', best('crane', (v) => `${v}개`)],
      ].filter(([, v]) => v);
      const tools = L('smash-badge-stats', {}).tools || [];
      const notes = L('smash-notes', []).map((i) => world.NOTES?.[i]).filter(Boolean);
      const hist = L('smash-pass-history', []);
      const isGrad = (board.grade === 3 || cfg.forceGraduation) && (() => { const g = cfg.graduation ? new Date(`${simDate.getMonth() >= 8 ? simDate.getFullYear() + 1 : simDate.getFullYear()}-${cfg.graduation}`) : null; return g && simDate >= new Date(g - 21 * 86400000); })();
      return {
        first: first || '오늘', days: (badges.stats.days || []).length || 1, badges: got, records, dex: Object.keys(L('smash-dex', {}) || {}).length, station: campaign.done(),
        season: `${pass.level()}단계${hist.length ? ` (지난 학기 ${hist.map((h) => h.level).join('·')})` : ''}`, notes, belt: (taekwondo.belt?.() || ['', '흰 띠'])[1], favTool: tools.length ? `${tools.length}종 써 봄` : '-',
        graduation: !!isGrad, year: simDate.getFullYear() + (simDate.getMonth() >= 8 ? 1 : 0),
      };
    },
    onSave: () => badges.give('album'),
  });
  document.getElementById('btn-album').addEventListener('click', () => { document.body.classList.remove('more-open'); album.open(); });
  // ---------- 가정의 달 편지 카드 ----------
  const letter = new LetterCard({
    notes: () => { try { return JSON.parse(localStorage.getItem('smash-notes') || '[]').map((i) => world.NOTES?.[i]).filter(Boolean); } catch { return []; } },
    clean, onSave: () => { badges.give('lettercard'); tele.track('lettercard'); },
  });
  world.openLetter = () => letter.open();
  document.getElementById('btn-letter').addEventListener('click', () => { document.body.classList.remove('more-open'); letter.open(); });

  // ---------- 보충 알림 위젯 ----------
  {
    const chip = document.getElementById('sup-chip');
    const T8 = (cfg.supplementTimes && cfg.supplementTimes[0]) || '16:00';
    const box = document.getElementById('set-supnote');
    try { box.checked = localStorage.getItem('smash-supnote') === 'on'; } catch { /* 무시 */ }
    box.addEventListener('change', async () => {
      if (box.checked && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* 무시 */ } }
      try { localStorage.setItem('smash-supnote', box.checked ? 'on' : 'off'); } catch { /* 무시 */ }
      ui.toast(box.checked ? '보충 알림 켬' : '보충 알림 끔', box.checked ? `8교시(${T8}) 10분 전에 알려 줘요 · 앱이 열려 있을 때만` : '');
    });
    chip.addEventListener('click', () => showSupplement());
    let notified = '';
    const tick = () => {
      const now = new Date(), ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const sup = cfg.supplement?.[ymd];
      const show = sup && /^[A-Z]$/.test(sup[0]) && simDate.toDateString() === now.toDateString();
      chip.hidden = !show;
      if (!show) return;
      chip.innerHTML = `<b>보충 ${sup[0]} · ${sup[1]}</b><span>8교시 ${T8}</span>`;
      const [h, m] = T8.split(':').map(Number), at = new Date(now); at.setHours(h, m - 10, 0, 0);
      if (box.checked && notified !== ymd && now >= at && now < new Date(at.getTime() + 15 * 60000)) {
        notified = ymd;
        ui.toast('📚 곧 보충 시작', `8교시 ${sup[0]}반 · 9교시 ${sup[1]}반`, 'gold'); hap.play('badge');
        if ('Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker?.ready.then((r) => r.showNotification('곧 보충 시작', { body: `8교시 ${sup[0]}반 · 9교시 ${sup[1]}반`, icon: 'assets/icons/icon-192.png', tag: `sup-${ymd}` })).catch(() => { try { new Notification('곧 보충 시작', { body: `8교시 ${sup[0]}반 · 9교시 ${sup[1]}반` }); } catch { /* 무시 */ } });
        }
      }
    };
    tick(); setInterval(tick, 30000);
  }

  // ---------- 랜덤 이벤트(3~6분마다 하나) ----------
  {
    let next = 150 + Math.random() * 150;
    const evs = [
      { id: 'shower', ok: () => !night && seasons.season !== 'winter', run: () => { seasons.setWeather('rain'); setTimeout(() => applyWeather(), 45000); return ['🌧️ 소나기', '갑자기 소나기가 쏟아져요. 45초 뒤 그쳐요']; } },
      { id: 'rush', ok: () => delivery.state === 'off', run: () => { delivery.arrive(); delivery.rolled = false; return ['📦 택배 폭주', 'HASA 택배차가 예정에 없이 왔어요. 눌러 보세요(뽑기 기회!)']; } },
      { id: 'rainbow', ok: () => !night, run: () => { rainbow(true); setTimeout(() => rainbow(false), 60000); return ['🌈 무지개', '운동장 너머로 무지개가 떴어요']; } },
      { id: 'meteors', ok: () => night, run: () => { meteorShower(); return ['🌠 유성우', '밤하늘에 별똥별이 쏟아져요']; } },
      { id: 'outage', ok: () => night, run: () => { buildings.setNight(false, () => false); flood?.set(false); setTimeout(() => { buildings.setNight(true, (b) => /인재원|문화관|와우관|미래관/.test(b.name)); flood?.set(true); }, 20000); return ['🔌 정전', '학교 불이 잠깐 모두 꺼졌어요. 20초 뒤 돌아와요']; } },
    ];
    let rb = null;
    function rainbow(on) {
      if (on && !rb) {
        const c = new THREE.Vector3(...(bigPitch ? [centroid(bigPitch)[0], 0, centroid(bigPitch)[1]] : [0, 0, 0]));
        const geo = new THREE.TorusGeometry(220, 9, 8, 64, Math.PI);
        const cols = [];
        const pos = geo.attributes.position;
        const hues = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#5e5ce6'];
        for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); const k = Math.max(0, Math.min(6, Math.floor(((r - 211) / 18) * 7))); const col = new THREE.Color(hues[k]); cols.push(col.r, col.g, col.b); }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        rb = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false, fog: false }));
        rb.position.set(c.x, terrain.heightAt(c.x, c.z) - 20, c.z - 260);
        scene.add(rb);
      }
      if (rb) rb.visible = on;
    }
    function meteorShower() {
      for (let i = 0; i < 22; i++) setTimeout(() => {
        const a = new THREE.Vector3((Math.random() - 0.5) * 600, 240 + Math.random() * 80, (Math.random() - 0.5) * 600);
        const b = a.clone().add(new THREE.Vector3(-60 - Math.random() * 40, -40, 30));
        const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, a.clone()]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false }));
        scene.add(ln);
        let t = 0;
        const step = () => {
          t += 0.016;
          const k = Math.min(1, t / 0.5), head = a.clone().lerp(b, k), tail = a.clone().lerp(b, Math.max(0, k - 0.35));
          ln.geometry.setFromPoints([tail, head]);
          ln.material.opacity = 0.9 * (1 - Math.max(0, (t - 0.5) / 0.4));
          if (t < 0.9) requestAnimationFrame(step); else { scene.remove(ln); ln.geometry.dispose(); }
        };
        step();
      }, i * 900 + Math.random() * 600);
    }
    world.runEvent = (id) => { const e = evs.find((x) => x.id === id); if (!e) return '없는 이벤트'; const [t, d] = e.run(); ui.toast(t, d, 'gold'); return `${t} 실행`; };
    world.events = evs.map((e) => e.id);
    world.happen = (dt) => {
      next -= dt;
      if (next > 0 || cinema.active || document.body.classList.contains('arc-on')) return;
      next = 180 + Math.random() * 180;
      const can = evs.filter((e) => e.ok());
      if (!can.length) return;
      const e = can[Math.floor(Math.random() * can.length)];
      const [t, d] = e.run();
      ui.toast(t, `${d} · 시즌 +30 XP`, 'gold');
      pass.add(30, `event-${e.id}`);
      tele.track('event', { id: e.id });
    };
  }

  // ---------- 피클볼 ----------
  const openPickle = () => { ui.modal('info', false); pickle.open(); tele.track('open', { id: 'pickle' }); };
  document.getElementById('btn-pickle').addEventListener('click', openPickle);
  document.getElementById('info-pickle').addEventListener('click', openPickle);
  document.getElementById('info-enter').addEventListener('click', () => world.enterBuilding(document.getElementById('info-enter').dataset.b));

  // ---------- 건의함 ----------
  {
    const txt = document.getElementById('sg-text');
    txt.addEventListener('input', () => { document.getElementById('sg-count').textContent = `${txt.value.length}/300`; });
    document.getElementById('btn-suggest').addEventListener('click', () => { ui.modal('suggest', true); setTimeout(() => txt.focus(), 300); });
    document.getElementById('suggest-close').addEventListener('click', () => ui.modal('suggest', false));
    document.getElementById('suggest').addEventListener('click', (e) => { if (e.target.id === 'suggest') ui.modal('suggest', false); });
    document.getElementById('sg-send').addEventListener('click', async () => {
      const kind = document.querySelector('input[name="sg-kind"]:checked').value;
      const r = await net.suggest({ kind, text: txt.value, grade: Number(document.getElementById('sg-grade').value) });
      if (!r.ok) { ui.toast('보내지 못했어요', r.why); return; }
      txt.value = ''; document.getElementById('sg-count').textContent = '0/300';
      ui.modal('suggest', false);
      badges.give('suggest');
      tele.track('suggest', { kind });
      ui.toast('📮 건의 고마워요!', r.local ? '이 기기에 저장했어요(온라인 연결 후 개발자에게 전달돼요)' : '개발자에게 전달했어요');
    });
  }

  // ---------- 실시간 버스 ----------
  {
    const showBus0 = ui.showBus.bind(ui);
    let busTimer = 0;
    ui.showBus = async (bus) => {
      bus = { ...bus, liveUrl: cfg.bus?.liveUrl, temp: wx?.manual ? undefined : wx?.temp };
      showBus0(bus);
      ui.onBusStop = () => ui.showBus(bus);
      clearInterval(busTimer);
      if (!cfg.bus?.liveUrl) return;
      const load = async () => {
        if (document.getElementById('bus').hidden) { clearInterval(busTimer); return; }
        try { ui.setBusLive(await net.busLive(ui.busStop?.ars)); } catch (e) { ui.setBusLive([], e.message); }
      };
      await load();
      busTimer = setInterval(load, 20000); // 열려 있는 동안 20초마다
    };
  }

  // ---------- 함께 보기: 응원의 벽 ----------
  {
    const floatEmoji = (emoji, x, y) => {
      const el = document.createElement('div');
      el.className = 'float-emoji';
      el.textContent = emoji;
      el.style.left = `${x}px`; el.style.top = `${y}px`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1700);
    };
    const people = (boxId, list) => {
      const box = document.getElementById(boxId);
      const L = list.slice(0, 8);
      box.innerHTML = L.map((p) => `<span class="av ${p.self ? 'self' : ''}" style="--c:${p.color}" title="${p.nick}">${p.emoji}</span>`).join('') +
        `<em>${presence.online ? (list.length > 1 ? `지금 ${list.length}명이 함께 보고 있어요` : '지금은 혼자 보고 있어요') : '함께 보기는 온라인 연결 후에 켜져요'}</em>`;
    };
    const react = document.getElementById('cheer-react');
    react.innerHTML = REACTIONS.map((e) => `<button type="button" data-e="${e}" aria-label="${e} 보내기">${e}</button>`).join('');
    for (const b of react.querySelectorAll('button')) {
      b.addEventListener('click', () => {
        const r = b.getBoundingClientRect();
        floatEmoji(b.dataset.e, r.left + r.width / 2 - 13, r.top - 10);
        presence.send('cheer', 'react', { e: b.dataset.e });
        hap.play('pet');
      });
    }
    const showCheer0 = ui.showCheer.bind(ui);
    ui.showCheer = async (wall) => {
      await showCheer0(wall);
      presence.join('cheer', {
        onPeople: (L) => people('cheer-people', L),
        onEvent: (type, p) => {
          if (type === 'react') { const box = document.getElementById('cheer-list').getBoundingClientRect(); floatEmoji(p.e, box.left + Math.random() * box.width * 0.8, box.top + 40 + Math.random() * 120); }
          if (type === 'new') { showCheer0(cheer); ui.toast('새 응원이 붙었어요', `${p.from?.nick || '누군가'}의 한마디`); }
        },
      });
    };
    const leaveCheer = () => presence.leave('cheer');
    document.getElementById('cheer-close').addEventListener('click', leaveCheer);
    document.getElementById('cheer').addEventListener('click', (e) => { if (e.target.id === 'cheer') leaveCheer(); });
    document.getElementById('cheer-send').addEventListener('click', () => setTimeout(() => presence.send('cheer', 'new'), 600));
  }

  // ---------- 함께 보기: 분실물 지도(다른 친구가 보고 있는 곳에 동물 아바타) ----------
  const peerPins = new Map();
  // 아바타를 치울 때 이름표(화면 위 글자)도 같이
  const dropAvatar = (o) => { o.traverse((c) => c.element?.remove()); scene.remove(o); };
  let lostTimer = null;
  function lostPresence(on) {
    clearInterval(lostTimer);
    if (!on) {
      presence.leave('lost');
      for (const o of peerPins.values()) dropAvatar(o);
      peerPins.clear();
      // CSS2D 이름표도 같이 사라지게
      document.querySelectorAll('.av-name').forEach((e) => e.remove());
      document.getElementById('lost-people').textContent = '';
      return;
    }
    const where = () => ({ x: Math.round(controls.target.x), z: Math.round(controls.target.z) });
    presence.join('lost', {
      state: where(),
      onPeople: (L) => {
        document.getElementById('lost-people').textContent = presence.online ? `${L.map((p) => p.emoji).slice(0, 6).join('')} ${L.length}명` : '';
        const seen = new Set();
        for (const p of L) {
          if (p.self || p.x === undefined) continue;
          seen.add(p.id);
          let o = peerPins.get(p.id);
          const uni = uniformFor(wx?.manual ? undefined : wx?.temp, simDate.getMonth() + 1);
          if (o && o.userData.season !== uni) { dropAvatar(o); peerPins.delete(p.id); o = null; } // 날씨 바뀌면 동·하복 갈아입기
          if (!o) {
            o = makeAvatar(p, uni);
            o.scale.setScalar(2.4);
            const el = document.createElement('div');
            el.className = 'av-name';
            el.style.setProperty('--c', p.color);
            el.textContent = `${p.emoji} ${p.nick}`;
            const tag = new CSS2DObject(el);
            tag.position.y = 2.15;
            o.add(tag);
            scene.add(o);
            peerPins.set(p.id, o);
          }
          o.position.set(p.x, terrain.heightAt(p.x, p.z), p.z);
          o.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
        }
        for (const [id, o] of peerPins) if (!seen.has(id)) { dropAvatar(o); peerPins.delete(id); }
      },
      onEvent: (type, p) => { if (type === 'new') { lost.load(); ui.toast('📍 새 분실물 핀', `${p.from?.nick || '누군가'}가 남겼어요`); } },
    });
    lostTimer = setInterval(() => presence.update('lost', where()), 2500);
  }

  // ---------- 배지 ----------
  document.getElementById('btn-badges').addEventListener('click', () => ui.showBadges(badges.list()));
  document.getElementById('badges-close').addEventListener('click', () => ui.modal('badges', false));
  document.getElementById('badges').addEventListener('click', (e) => { if (e.target.id === 'badges') ui.modal('badges', false); });

  // ---------- 로봇개 조이스틱·화염 버튼 ----------
  {
    const stick = document.getElementById('dog-stick'), knob = document.getElementById('dog-knob'), fire = document.getElementById('dog-fire');
    let sid = null;
    const moveStick = (e) => {
      const r = stick.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      knob.style.transform = `translate(${x * r.width * 0.3}px, ${y * r.height * 0.3}px)`;
      robodog.input.x = Math.abs(x) > 0.15 ? x : 0;
      robodog.input.y = Math.abs(y) > 0.15 ? -y : 0;
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); moveStick(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
    const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; robodog.input.x = robodog.input.y = 0; };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    fire.addEventListener('pointerdown', (e) => { fire.setPointerCapture(e.pointerId); fire.classList.add('on'); robodog.setFlame(true); });
    const endFire = () => { fire.classList.remove('on'); robodog.setFlame(false); };
    fire.addEventListener('pointerup', endFire);
    fire.addEventListener('pointercancel', endFire);
    document.getElementById('dog-exit').addEventListener('click', () => robodog.stop(camera));
  }

  // ---------- 밤 ----------
  let night = false;
  world.isNight = () => night;
  let wx = null;
  let skyTick = 0, bellTick = 0;
  let nightT = 0, lateNight = false;
  // ---------- 시간대·날씨: 실시간 동기화 또는 직접 선택 ----------
  const load = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  let timeMode = load('smash-time', 'sync');
  let wxMode = load('smash-wx', 'sync');
  let skyNow = null;
  let lastBucket = '';
  let dispHour = null;
  const targetHour = () => {
    if (timeMode === 'sync') { const n = new Date(); return n.getHours() + n.getMinutes() / 60; }
    return PRESETS[timeMode] ?? 12.5;
  };
  // 비·흐림·안개면 해가 약해져요.
  function setLights() {
    if (!skyNow) return;
    const k = wx?.kind;
    const dim = k && /rain|storm|fog|cloud|snow/.test(k) ? (k === 'cloud' ? 0.7 : 0.45) : 1;
    hemi.intensity = skyNow.hemi * (0.6 + 0.4 * dim);
    sun.intensity = skyNow.sun * dim;
  }
  function onNightChange() {
    nightT = 0; lateNight = false;
    buildings.setNight(night, (b) => /인재원|문화관|와우관|미래관/.test(b.name));
    flood?.set(night);
    wildlife?.setConditions({ night, month: simDate.getMonth() + 1 });
    document.getElementById('btn-night').setAttribute('aria-pressed', String(night));
  }
  function applySky(h) {
    skyNow = skyAt(h);
    {
      const hh = ((h % 24) + 24) % 24;
      const bucket = hh >= 5.2 && hh < 8 ? 'dawn' : hh >= 8 && hh < 17 ? 'day' : hh >= 17 && hh < 19.9 ? 'sunset' : 'night';
      if (bucket !== lastBucket) { lastBucket = bucket; if (badges.mark('times', bucket) >= 4) badges.give('timesAll'); }
    }
    skyU.top.value.copy(skyNow.top);
    skyU.bottom.value.copy(skyNow.bottom);
    scene.fog.color.copy(skyNow.fog);
    if (wx?.kind === 'fog' || wx?.kind === 'rain' || wx?.kind === 'storm') scene.fog.color.lerp(new THREE.Color('#9aa3ab'), night ? 0.15 : 0.45);
    hemi.color.copy(skyNow.hemiC);
    sun.color.copy(skyNow.sunC);
    renderer.toneMappingExposure = skyNow.exp;
    sun.position.copy(sun.target.position).addScaledVector(skyNow.dir, 420);
    setLights();
    if (skyNow.night !== night) { night = skyNow.night; onNightChange(); }
  }
  function setTimeMode(m, { save = true } = {}) {
    if (save) tele.track('sky', { time: m });
    timeMode = m;
    if (save) { try { localStorage.setItem('smash-time', m); } catch { /* 무시 */ } }
    renderSkyPanel();
  }
  async function setWeatherMode(m) {
    tele.track('sky', { weather: m });
    if (badges.mark('weathers', m) >= 6) badges.give('weatherAll');
    wxMode = m;
    try { localStorage.setItem('smash-wx', m); } catch { /* 무시 */ }
    renderSkyPanel();
    await applyWeather();
  }
  // 이번 겨울 첫눈이 '오늘' 왔는지
  function firstSnowToday() {
    const d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    try { return localStorage.getItem(`smash-firstsnow-${y}`) === d.toDateString(); } catch { return false; }
  }
  async function applyWeather() {
    const today = simDate.toDateString() === new Date().toDateString();
    wx = null;
    if (wxMode !== 'sync') {
      const names = { clear: '맑음', cloud: '흐림', rain: '비', snow: '눈', fog: '안개' };
      wx = { kind: wxMode, name: names[wxMode], manual: true };
    } else if (today && cfg.weather !== false) {
      try { wx = await fetchWeather(campus.origin?.lat ?? 36.2808, campus.origin?.lon ?? 127.3733); } catch { wx = null; }
    }
    ui.setWeather(wx);
    if (wx && !wx.manual && wx.kind === 'snow') {
      const y = simDate.getMonth() >= 6 ? simDate.getFullYear() : simDate.getFullYear() - 1;
      const k = `smash-firstsnow-${y}`;
      try { if (!localStorage.getItem(k)) { localStorage.setItem(k, simDate.toDateString()); if (!world.edition) applyEdition(true); } } catch { /* 무시 */ }
    }
    seasons.setWeather(wx?.kind === 'clear' || wx?.kind === 'cloud' ? null : wx?.kind || null);
    visuals.setWeather(wx?.kind);
    visuals.refreshEnv(true);
    if (dispHour !== null) applySky(dispHour);
  }
  function renderSkyPanel() {
    const mk = (box, items, cur, fn) => {
      box.innerHTML = '';
      for (const [id, name] of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = name;
        b.className = id === cur ? 'on' : '';
        b.addEventListener('click', () => fn(id));
        box.appendChild(b);
      }
    };
    mk(document.getElementById('sky-time'), Object.entries(PRESET_NAME), timeMode, (id) => setTimeMode(id));
    mk(document.getElementById('sky-weather'), [['sync', '실시간'], ['clear', '맑음'], ['cloud', '흐림'], ['rain', '비'], ['snow', '눈'], ['fog', '안개']], wxMode, (id) => setWeatherMode(id));
    const hr = document.getElementById('sky-hap-row');
    hr.hidden = !world.hap?.ok;
    if (world.hap?.ok) mk(document.getElementById('sky-hap'), [['on', '켜기'], ['off', '끄기']], world.hap.on ? 'on' : 'off', (id) => { world.hap.set(id === 'on'); world.hap.play('toggle'); renderSkyPanel(); });
  }
  // 'N' 키: 낮↔밤 빠르게
  function toggleNight() { setTimeMode(night ? 'day' : 'night'); }
  // ---------- 다시 짓기(접히는 화면 전환) ----------
  function rebuild() {
    board.finishRun();
    tools.reset();
    nukePad.reset?.();
    buildings.clear();
    terrain.reset();
    for (const d of bdata) buildings.add(d);
    painter.reset();
    fx.clear();
    trees.reset();
    blockWorld?.rebuilt();
    cart?.reset();
    xmas.rebuilt();
    canopies.reset();
    if (robodog.active) robodog.stop(camera);
    robodog.reset();
    extras.clear();
    snow.clear();
    taekwondo.clear();
    celebrate.clearBursts();
    parked?.reset();
    cats.reset();
    jackpotDone = false;
    delivery.reset();
    if (hunt.active) hunt.stop();
    if (night) { nightT = 0; lateNight = false; buildings.setNight(true, (b) => /인재원|문화관|와우관|미래관/.test(b.name)); }
    score.reset();
    missions.reset?.();
    stats.trees = 0;
    gradeOneDone = false;
    buildings.setLabels(document.getElementById('btn-labels').getAttribute('aria-pressed') !== 'false');
  }
  let folding = false;
  function foldRebuild(after) {
    if (folding) return;
    folding = true;
    const img = document.getElementById('fold');
    renderer.render(scene, camera);
    img.src = renderer.domElement.toDataURL('image/jpeg', 0.85);
    img.classList.remove('go');
    img.hidden = false;
    const go = () => {
      rebuild();
      if (after) after();
      void img.offsetWidth;
      img.classList.add('go');
      stage.classList.remove('fold-in');
      void stage.offsetWidth;
      stage.classList.add('fold-in');
      sound.whoosh(0.8);
      setTimeout(() => { img.hidden = true; img.classList.remove('go'); stage.classList.remove('fold-in'); folding = false; }, 1050);
    };
    if (img.complete) requestAnimationFrame(go); else img.onload = () => requestAnimationFrame(go);
  }
  document.getElementById('btn-reset').addEventListener('click', () => foldRebuild());

  let autoNight = false;
  function applyEdition(intro) {
    let ed = editionFor(events, simDate);
    if (!ed && forceParty) ed = 'party';
    if (!ed && forceXmas) ed = 'xmas';
    if (!ed && firstSnowToday() && simDate.toDateString() === new Date().toDateString()) ed = 'firstsnow';
    if (forceEd && (EDITIONS[forceEd])) ed = forceEd; // 미리 보기: 주소 뒤 ?edition=halloween
    const prevEd = world.edition;
    world.edition = ed;
    edNow = ed;
    if (ed === 'xmas') xmas.enable(); else xmas.disable();
    world.xmasOn = ed === 'xmas';
    seasons.apply(seasonOf(simDate), { quiet: !intro || !!ed, noFall: ed === 'xmas' });
    if (badges.mark('seasons', seasonOf(simDate)) >= 4) badges.give('seasons4');
    if (ed === 'party') fireworks.start(); else fireworks.stop();
    // 크리스마스와 불꽃놀이는 밤이 예뻐서 자동으로 밤이 돼요.
    const wantNight = ['xmas', 'party', 'halloween', 'anniv', 'festival'].includes(ed);
    if (wantNight && !night && !autoNight) { autoNight = timeMode; setTimeMode('night', { save: false }); }
    if (!wantNight && autoNight) { setTimeMode(autoNight, { save: false }); autoNight = false; }
    updateDates();
    ui.showEdition(ed, ed ? EDITIONS[ed] : null);
    wildlife.setConditions({ night, month: simDate.getMonth() + 1 });
    if (ed === 'xmas') badges.give('xmas');
    if (ed === 'party') badges.give('fireworks');
    if (CELEB.includes(ed)) { if (ed !== prevEd || !celebrate.kind) celebrate.enable(ed); badges.give(ed); }
    else if (celebrate.kind) celebrate.disable();
    seasons.special({ suneung: 'clover', halloween: 'halloween', entrance: 'spring' }[ed] || null);
    document.getElementById('cheer-title').textContent = ed === 'teachers' ? '💐 선생님께 감사 편지 벽' : '3학년 응원 메시지 벽';
    document.getElementById('cheer-input').placeholder = ed === 'teachers' ? '선생님께 감사 한마디 (60자)' : '선배님들께 응원 한마디 (60자)';
    if (intro && ed === 'science') setTimeout(() => {
      if (world.edition !== 'science' || !bigPitch) return;
      const pc = centroid(bigPitch);
      if (world.rocket.launch(new THREE.Vector3(pc[0], terrain.heightAt(pc[0], pc[1]), pc[1]))) ui.toast('🔬 HASA 특별 임무 SD-421', '과학의 날 기념 로켓이 발사됐어요', 'gold');
    }, 4500);
    if (intro && ed === 'aprilfools') {
      document.body.classList.add('flip');
      setTimeout(() => { document.body.classList.remove('flip'); ui.toast('🤪 만우절 장난이에요', '오늘 학교는 젤리로 지었대요'); }, 2600);
    }
    if (intro && ed === 'firstsnow') ui.toast('❄️ 첫눈이 와요!', '오늘은 눈사람이 두 배로 빨리 쌓여요', 'gold');
    suneungBanner(ed === 'suneung');
    if (ed === 'suneung' && intro) {
      const k = `smash-sn-${simDate.toDateString()}`;
      let seen = false;
      try { seen = !!localStorage.getItem(k); localStorage.setItem(k, '1'); } catch { /* 무시 */ }
      if (!seen) setTimeout(() => snLetter.open({ cheer, year: simDate.getFullYear() + 1 }), 3300);
    }
  }
  // 수능 날: 와우관(3학년관)에 응원 현수막
  let snBanner = null;
  function suneungBanner(on) {
    if (on && !snBanner) {
      const w = bdata.find((b) => b.name === '와우관');
      if (!w || !bigPitch) return;
      const pc = centroid(bigPitch);
      let best = null;
      for (let i = 0; i < w.poly.length; i++) {
        const a = w.poly[i], b = w.poly[(i + 1) % w.poly.length];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 10) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = Math.hypot(mx - pc[0], mz - pc[1]);
        if (!best || d < best.d) best = { a, b, L, mx, mz, d };
      }
      if (!best) return;
      let nx = (best.b[1] - best.a[1]) / best.L, nz = -(best.b[0] - best.a[0]) / best.L;
      const wc = centroid(w.poly);
      if ((best.mx - wc[0]) * nx + (best.mz - wc[1]) * nz < 0) { nx = -nx; nz = -nz; }
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 200;
      const g = c.getContext('2d');
      g.fillStyle = '#fff6d6'; g.fillRect(0, 0, 1024, 200);
      g.fillStyle = '#2f9e44'; g.fillRect(0, 0, 1024, 14); g.fillRect(0, 186, 1024, 14);
      g.fillStyle = '#c0392b'; g.font = '800 84px "Pretendard Variable", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🍀 수능 대박! 3학년 화이팅 🍀', 512, 104);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const L = Math.min(best.L * 0.8, 26);
      snBanner = new THREE.Mesh(new THREE.PlaneGeometry(L, L * 0.2), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
      snBanner.position.set(best.mx + nx * 0.4, w.base + w.levels * w.floorH * 0.72, best.mz + nz * 0.4);
      snBanner.rotation.y = Math.atan2(nx, nz);
      scene.add(snBanner);
    }
    if (snBanner) snBanner.visible = on;
  }
  function travel(date) {
    setTimeout(() => world.online?.refreshLooks(), 1200);
    tele.track('travel', { to: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` });
    simDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    foldRebuild(() => { applyEdition(true); applyWeather(); });
  }
  const calendar = new CalendarUI({ cfg, events, getDate: () => simDate, onTravel: travel, loadSchool: (y, m) => fetchSchedule(cfg, y, m), onAdd: () => badges.give('planner'), loadTeacher: () => net.teacherEvents(), addTeacher: (k, ev) => net.addTeacherEvent(k, ev) });
  for (const id of ['btn-calendar', 'exam-chip', 'suneung-chip']) document.getElementById(id).addEventListener('click', () => calendar.open());
  document.getElementById('edition-chip').addEventListener('click', () => { if (world.edition === 'suneung') snLetter.open({ cheer, year: simDate.getFullYear() + 1 }); else calendar.open(); });
  document.getElementById('travel-chip').addEventListener('click', () => travel(new Date()));

  // ---------- 오늘의 학습운세 ----------
  const fortuneDate = () => `${simDate.getMonth() + 1}월 ${simDate.getDate()}일`;
  document.getElementById('btn-fortune').addEventListener('click', () => { sound.ensure(); sound.pop(); badges.count('fortune', 3); ui.showFortune(drawFortune(world.edition, { date: simDate, examDays: nextExam(cfg.exams, simDate)?.days }), fortuneDate()); });
  document.getElementById('ft-again').addEventListener('click', () => { sound.pop(); badges.count('fortune', 3); ui.showFortune(drawFortune(world.edition, { date: simDate, examDays: nextExam(cfg.exams, simDate)?.days }), fortuneDate()); });
  document.getElementById('ft-close').addEventListener('click', () => ui.hideFortune());
  document.getElementById('fortune').addEventListener('click', (e) => { if (e.target.id === 'fortune') ui.hideFortune(); });
  const toggle = (id, fn) => {
    const b = document.getElementById(id);
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      fn(on);
    });
  };
  toggle('btn-labels', (on) => { buildings.setLabels(on); if (turtle) turtle.label.visible = on; });
  toggle('btn-sound', (on) => { sound.setOn(on); if (on) sound.ensure(); });
  // 달 버튼: 시간·날씨 패널
  document.getElementById('btn-night').addEventListener('click', (e) => {
    e.stopPropagation();
    const p = document.getElementById('sky-panel');
    p.hidden = !p.hidden;
    if (!p.hidden) renderSkyPanel();
  });
  dom.addEventListener('pointerdown', () => { document.getElementById('sky-panel').hidden = true; });
  document.getElementById('btn-home').addEventListener('click', () => {
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
  });
  addEventListener('pagehide', () => board.finishRun());

  // ---------- 기기별 화면 ----------
  let device = 'desktop';
  const applyDevice = () => {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const short = Math.min(innerWidth, innerHeight);
    device = short < 600 ? 'phone' : (coarse || innerWidth < 1100) ? 'tablet' : 'desktop';
    ui.setDevice(device);
    // 넓은 PC 화면(1440 이상)이 아니면 버튼을 앱 보관함으로 접어 둬요.
    document.body.classList.toggle('compact', device !== 'desktop' || innerWidth < 1440);
    if (!document.body.classList.contains('compact')) launcher?.close();
  };
  applyDevice();
  addEventListener('resize', applyDevice);
  document.getElementById('btn-panel').addEventListener('click', () => document.body.classList.toggle('panel-open'));
  document.getElementById('btn-more').addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.toggle('more-open'); });
  // ⋯ 메뉴에서 하나 고르면 메뉴는 닫혀요.
  document.getElementById('more-pop').addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(() => document.body.classList.remove('more-open'), 0); });
  dom.addEventListener('pointerdown', () => document.body.classList.remove('panel-open', 'more-open'));

  // ---------- 후원 ----------
  document.getElementById('btn-donate').addEventListener('click', () => ui.showDonate(cfg));
  document.getElementById('dn-close').addEventListener('click', () => ui.hideDonate());
  document.getElementById('donate').addEventListener('click', (e) => { if (e.target.id === 'donate') ui.hideDonate(); });
  document.getElementById('meal-close').addEventListener('click', () => ui.modal('meal', false));
  document.getElementById('info-close').addEventListener('click', () => ui.modal('info', false));
  document.getElementById('info').addEventListener('click', (e) => { if (e.target.id === 'info') ui.modal('info', false); });
  document.getElementById('info-meal').addEventListener('click', () => { ui.modal('info', false); openMeal(); });
  document.getElementById('bus-close').addEventListener('click', () => ui.modal('bus', false));
  document.getElementById('bus').addEventListener('click', (e) => { if (e.target.id === 'bus') ui.modal('bus', false); });

  // ---------- SMASH 모드 / 둘러보기 모드 ----------
  ui.setHistory(cfg.history || HISTORY);
  const modeBtn = document.getElementById('mode-toggle');
  const setMode = (on) => {
    smashMode = on;
    tele.track('mode', { smash: on });
    modeBtn.setAttribute('aria-pressed', String(on));
    modeBtn.querySelector('span').textContent = on ? 'SMASH' : '둘러보기';
    document.body.classList.toggle('tour', !on);
    document.getElementById('history').hidden = on;
    reticle.visible = false;
    if (!on && robodog.active) robodog.stop(camera);
    ui.toast(on ? 'SMASH 모드' : '둘러보기 모드', on ? '마음껏 부숴 보세요!' : '건물을 누르면 시설 안내가 나와요');
    try { localStorage.setItem('smash-mode', on ? '1' : '0'); } catch { /* 무시 */ }
  };
  modeBtn.addEventListener('click', () => setMode(!smashMode));
  try { if (localStorage.getItem('smash-mode') === '0') setMode(false); } catch { /* 무시 */ }
  document.getElementById('meal').addEventListener('click', (e) => { if (e.target.id === 'meal') ui.modal('meal', false); });

  // ---------- 인스타 공유 카드 ----------
  document.getElementById('btn-share').addEventListener('click', () => {
    renderer.render(scene, camera);
    const shot = document.createElement('canvas');
    shot.width = renderer.domElement.width; shot.height = renderer.domElement.height;
    shot.getContext('2d').drawImage(renderer.domElement, 0, 0);
    const card = makeShareCard(shot, {
      score: fmt(score.score), grade: score.bestGrade, pct: `${Math.round(buildings.destroyedFraction() * 100)}%`,
      bldg: `${buildings.list.filter((b) => b.collapsed || b.lostFraction() > 0.9).length}/${buildings.list.length}`,
      date: `${simDate.getFullYear()}.${simDate.getMonth() + 1}.${simDate.getDate()}`,
      edition: world.edition ? EDITIONS[world.edition].title : '', school: schoolName, url: location.href.split('?')[0],
    });
    ui.showShare(card);
    badges.give('share');
  });
  document.getElementById('share-close').addEventListener('click', () => ui.modal('share', false));
  document.getElementById('share-save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = ui.shareCanvas.toDataURL('image/png');
    a.download = `smash-hanvit-${Date.now()}.png`;
    a.click();
  });
  document.getElementById('share-go').addEventListener('click', () => {
    ui.shareCanvas.toBlob(async (blob) => {
      const file = new File([blob], 'smash-hanvit.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'SMASH 한빛', text: `오늘 ${fmt(score.score)}점! #SMASH한빛` }); } catch { /* 취소 */ }
      } else {
        ui.toast('이 기기에선 바로 공유가 안 돼요', '이미지 저장 후 인스타그램에 올려 주세요');
      }
    }, 'image/png');
  });

  // 나침반: 누르면 북쪽이 화면 위로 오게 돌아가요.
  let spin = null;
  document.getElementById('compass').addEventListener('click', () => {
    if (director.busy) return;
    const off = camera.position.clone().sub(controls.target);
    const from = Math.atan2(off.x, off.z);
    let d = -from;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    spin = { t: 0, from, d, r: Math.hypot(off.x, off.z), y: off.y };
  });

  // ---------- 크기 ----------
  const dbs = new THREE.Vector2();
  world.onResize = () => resize();
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    labels.setSize(innerWidth, innerHeight);
    renderer.getDrawingBufferSize(dbs);
    fx.setScale(dbs.y / (2 * Math.tan((camera.fov * Math.PI) / 360)));
    seasons?.setScale(dbs.y / (2 * Math.tan((camera.fov * Math.PI) / 360)));
  }
  addEventListener('resize', resize);
  resize();

  // ---------- 매 프레임 ----------
  const clock = new THREE.Clock();
  let hoverTimer = 0, slowTimer = 0, sendTimer = 20, boardTimer = 30;
  // 20초 동안 아무 조작이 없으면 한 프레임 걸러 그려요(초당 30번) → 팬 소음·전력 줄이기
  let lastInput = performance.now(), skip = false, shadowTick = false;
  const isTouch = matchMedia('(pointer: coarse)').matches; // 폰·패드
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
  renderer.setAnimationLoop(() => {
    const idle = performance.now() - lastInput > (isTouch ? 3000 : 8000) && !cinema.active && !document.body.classList.contains('arc-on');
    skip = idle ? !skip : false;
    if (skip) return;
    shadowTick = !shadowTick; renderer.shadowMap.needsUpdate = idle || shadowTick;
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (interior.active) { interior.update(dt); if (interior.active) { interior.render(); return; } }
    if (spin) {
      spin.t = Math.min(1, spin.t + dt / 0.7);
      const u = spin.t * spin.t * (3 - 2 * spin.t);
      const a = spin.from + spin.d * u;
      camera.position.set(controls.target.x + Math.sin(a) * spin.r, controls.target.y + spin.y, controls.target.z + Math.cos(a) * spin.r);
      if (spin.t >= 1) spin = null;
    }
    tele.frame(dt);
    taekwondo.update(dt);
    celebrate.update(dt);
    world.happen?.(dt);
    gfx.tick(dt);
    blockWorld.update(dt, camera);
    if (!smashMode) { tourTime += dt; if (tourTime >= 600) badges.give('pacifist'); }
    if (elapsed() >= 1800) badges.give('marathon');
    if (tools.laser?.on) hap.play('laser');
    if (robodog.flaming && robodog.active) hap.play('flame');
    robodog.update(dt, camera);
    walk.update(dt, camera);
    if (robodog.flameTime > 10) badges.give('dog');
    if (robodog.active || walk.active) {
      // 로봇개·1인칭 투어 중에는 그쪽 카메라가 움직여요.
    } else if (!director.update(dt)) {
      controls.update();
      controls.target.x = Math.max(terrain.x0, Math.min(terrain.x0 + terrain.w, controls.target.x));
      controls.target.z = Math.max(terrain.z0, Math.min(terrain.z0 + terrain.d, controls.target.z));
    }
    nukePad.update(dt);
    fireworks.update(dt);
    flagPole?.update(dt);
    stream?.update(dt);
    cats.update(dt);
    extras.update(dt);
    wildlife.update(dt);
    hunt.update(dt);
    lost.update(performance.now() / 1000);
    if ((bellTick -= dt) <= 0) { bellTick = 5; updateBell(); }
    recycling?.update(dt);
    delivery.update(dt);
    // 시간대: 목표 시각으로 부드럽게 넘어가요(실시간이면 1초마다 갱신)
    {
      const th = targetHour();
      if (dispHour === null) { dispHour = th; applySky(dispHour); }
      let d = th - dispHour;
      if (d > 12) d -= 24;
      if (d < -12) d += 24;
      if (Math.abs(d) > 0.01) { dispHour = (dispHour + Math.sign(d) * Math.min(Math.abs(d), dt * 8) + 24) % 24; applySky(dispHour); }
      else if ((skyTick -= dt) <= 0) { skyTick = 1; dispHour = th; applySky(dispHour); }
    }
    if (night) {
      nightT += dt;
      if (nightT >= 180 && !lateNight) { lateNight = true; badges.give('night'); buildings.setNight(true, (b) => b.name === '인재원 Ⅰ'); ui.toast('밤이 깊었어요', '인재원 Ⅰ 기숙사만 불이 켜져 있어요'); }
    }
    xmas.update(dt, director.busy ? director.look : controls.target);
    seasons.update(dt * cinema.timeScale, director.busy ? director.look : controls.target);
    // 높이 올라가면 우주: 하늘이 검어지고 별이 보여요.
    {
      const alt = camera.position.y;
      const sp = THREE.MathUtils.smoothstep(alt, 500, 2600);
      skyU.space.value = sp;
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      stars.visible = night || sp > 0.02;
      stars.material.opacity = night ? 0.85 : sp * 0.95;
      const lift = Math.max(0, alt - 250);
      const fogK = wx?.kind === 'fog' ? 0.3 : wx?.kind === 'rain' || wx?.kind === 'storm' || wx?.kind === 'snow' ? 0.7 : 1;
      scene.fog.near = (500 + lift * 1.1) * fogK;
      scene.fog.far = (1700 + lift * 1.5) * fogK;
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].t -= dt;
      if (pops[i].t <= 0) { scene.remove(pops[i].o); pops.splice(i, 1); }
    }
    quietAcc.t -= dt;
    if (quietAcc.t <= 0) {
      quietAcc.t = 0.7;
      if (quietAcc.pts >= 20) popup(quietAcc.P, quietAcc.pts, '');
      quietAcc.pts = 0;
    }
    {
      const look = director.busy ? director.look : controls.target;
      ui.setHeading((Math.atan2(look.x - camera.position.x, -(look.z - camera.position.z)) * 180) / Math.PI);
    }

    tools.update(dt);
    world.rocket.update(dt);
    cart?.update(dt);
    buildings.update(dt);
    fx.update(dt * cinema.timeScale);
    site?.update(dt);
    if (peerPins.size) { const tt = performance.now() / 1000; for (const o of peerPins.values()) animateAvatar(o, tt); }
    terrain.flush();
    painter.flush(dt);
    score.update(dt);
    const pct = buildings.destroyedFraction();
    ui.setGrade(score.grade(), score.mult());
    ui.update(dt);
    board.setScore(score.score);

    const done = missions.update(dt, pct, score.bestGrade);
    if (done) {
      const p = score.add(3000);
      ui.addScore(score.score);
      ui.toast('오늘의 미션 완료', `${missions.mission.text}  +${fmt(p)}`, 'green');
      sound.bell(Array.isArray(cfg.bell) ? cfg.bell : undefined);
    }
    slowTimer -= dt;
    if (slowTimer <= 0) {
      slowTimer = 0.25;
      ui.setPercent(pct);
      ui.setStats(buildings.list.filter((b) => b.collapsed || b.lostFraction() > 0.9).length, buildings.list.length, stats.trees, score.bestGrade);
      ui.setMission(missions.mission.text, missions.progress(), missions.done || missions.doneToday);
      renderBoard();
    }
    sendTimer -= dt;
    if (sendTimer <= 0) { sendTimer = 20; board.send(); }
    boardTimer -= dt;
    if (boardTimer <= 0) { boardTimer = 30; board.refresh().then(renderBoard); }

    hoverTimer -= dt;
    if (hover && hoverTimer <= 0 && !holding && !director.busy && !robodog.active && smashMode) {
      hoverTimer = 1 / 20;
      const P = pick(hover[0], hover[1]);
      reticle.visible = !!P;
      if (P) reticle.position.set(P.x, P.y + 0.25, P.z);
    }
    if (holding || director.busy || robodog.active) reticle.visible = false;

    cinema.update(dt);
    visuals.update(dt, { skyColor: skyNow?.fog, night });
    world.declutter?.(dt);
    if (world.onlineMode) {
      const me = walk.active ? { x: walk.pos.x, z: walk.pos.z, r: walk.yaw, walking: true } : { x: controls.target.x, z: controls.target.z, r: Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) };
      me.tool = tool?.id || 'bomb';
      online.tick(dt, me);
      const boss = buildings.list.find((b) => b.name === '본관');
      if (boss) online.noteBoss(boss.lostFraction());
    }
    camera.position.add(fx.shakeOff);
    if (!visuals.render()) renderer.render(scene, camera);
    camera.position.sub(fx.shakeOff);
    labels.render(scene, camera);
  });

  // ---------- 장애물 지도(로봇개·투어·고양이·동물이 뚫고 지나가지 않게) ----------
  {
    const O = new Obstacles(buildings, terrain);
    if (stand) O.addPoly(stand.poly, 'stands');
    const sp = cfg.stream?.path || [];
    for (let i = 0; i < sp.length - 1; i++) {
      const [a, b] = [sp[i], sp[i + 1]], last = i === sp.length - 2;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      O.addPoly(rectPoly({ center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], size: [Math.max(L, last ? (cfg.stream.pond?.[0] || 6) : L) + 0.6, (last ? (cfg.stream.pond?.[1] || 3.4) : (cfg.stream.width || 2.2)) + 0.9], angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI }), 'stream');
    }
    if (cfg.recycling) O.addPoly(rectPoly({ center: cfg.recycling.center, size: [14, 9], angle: cfg.recycling.angle || 0 }), 'recycling');
    if (flagAt) O.addCircle(flagAt[0], flagAt[1], 3, 'flag');
    if (turtle) O.addCircle(turtle.group.position.x, turtle.group.position.z, 4, 'turtle');
    if (busAt) O.addCircle(busAt[0], busAt[1], 3, 'bus');
    for (const c of cfg.canopies || []) { for (const [x, z] of rectPoly(c)) O.addCircle(x, z, 0.35, 'canopy'); O.addCircle(c.center[0], c.center[1], 0.35, 'canopy'); }
    if (bigPitch) {
      const ob = orientedBox(bigPitch), co = Math.cos(ob.angle), si = Math.sin(ob.angle);
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const u = su * (ob.L / 2 + 3), v = sv * (ob.W / 2 + 3); O.addCircle(ob.cx + u * co - v * si, ob.cz + u * si + v * co, 0.6, 'flood'); }
    }
    for (const kind of ['pine', 'broad']) for (const t of trees.kinds[kind]?.items || []) { const c = O.addCircle(t.x, t.z, 0.55 * (t.s || 1), 'tree'); c.alive = () => t.alive; }
    site?.addObstacles(O);
    parked?.addObstacles(O);
    world.obstacles = O;
  }

  // ---------- 사계절 시네마 ----------
  const cinema = (() => {
    const bc = campus.boundary?.length ? centroid(campus.boundary) : [0, 0];
    let prevTime = null;
    return new Cinema({
      camera, controls, sound,
      center: new THREE.Vector3(bc[0], terrain.heightAt(bc[0], bc[1]), bc[1]),
      radius: Math.max(120, Math.min(220, Math.max(terrain.w, terrain.d) * 0.55)),
      hooks: {
        begin: () => { prevTime = timeMode; director.skip?.(); badges.give('cinema'); tele.track('open', { id: 'cinema' }); },
        scene: (S) => { seasons.apply(S.season, { quiet: true }); setTimeMode(S.time, { save: false }); seasons.setWeather(S.weather); },
        end: () => { if (prevTime) setTimeMode(prevTime, { save: false }); applyEdition(false); applyWeather(); },
      },
    });
  })();
  document.getElementById('btn-cinema').addEventListener('click', () => { document.body.classList.remove('more-open'); cinema.start(); });

  // ---------- 화질 자동 조절 ----------
  const gfx = new Quality({ renderer, sun, seasons, onChange: (lv) => { visuals.setLevel(matchMedia('(pointer: coarse)').matches ? Math.min(lv, 1) : lv); const el = document.getElementById('set-q-now'); if (el) el.textContent = `지금 ${LEVELS[lv].name}`; } });
  gfx.apply(gfx.level);
  visuals.setLevel(matchMedia('(pointer: coarse)').matches ? Math.min(gfx.level, 1) : gfx.level);

  // ---------- 첫 실행 안내 ----------
  const onboard = new Onboard();

  // ---------- 모든 설정 ----------
  const $id = (id) => document.getElementById(id);
  function syncSettings() {
    $id('set-sound').checked = sound.on;
    $id('set-hap-row').hidden = !hap.ok;
    $id('set-hap').checked = hap.on;
    $id('set-labels').checked = document.getElementById('btn-labels').getAttribute('aria-pressed') !== 'false';
    $id('set-tele').checked = tele.enabled;
    $id('set-block-row').hidden = !BlockUnlock.has();
    $id('set-block').checked = blockWorld.active;
    for (const b of $id('set-quality').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === gfx.mode);
    $id('set-q-now').textContent = `지금 ${LEVELS[gfx.level].name}`;
    $id('set-install').hidden = !installEvt;
    $id('set-ver').textContent = `SMASH 한빛 v2.0.6 · 배지 ${badges.list().filter((x) => x.got).length}/${badges.list().length}`;
  }
  $id('btn-settings').addEventListener('click', () => { syncSettings(); ui.modal('settings', true); });
  $id('set-close').addEventListener('click', () => ui.modal('settings', false));
  $id('settings').addEventListener('click', (e) => { if (e.target.id === 'settings') ui.modal('settings', false); });
  $id('set-sound').addEventListener('change', (e) => { if (e.target.checked !== sound.on) document.getElementById('btn-sound').click(); });
  $id('set-hap').addEventListener('change', (e) => { hap.set(e.target.checked); hap.play('toggle'); });
  $id('set-labels').addEventListener('change', () => document.getElementById('btn-labels').click());
  $id('set-tele').addEventListener('change', (e) => tele.setEnabled(e.target.checked));
  $id('set-block').addEventListener('change', (e) => setBlock(e.target.checked));
  for (const b of $id('set-quality').querySelectorAll('button')) b.addEventListener('click', () => { gfx.set(b.dataset.v); if (b.dataset.v === 'auto') gfx.apply(gfx.level); syncSettings(); });
  $id('set-sky').addEventListener('click', () => { ui.modal('settings', false); setTimeout(() => document.getElementById('btn-night').click(), 200); });
  $id('set-onboard').addEventListener('click', () => { ui.modal('settings', false); onboard.open(); });
  $id('set-teacher').addEventListener('click', () => { ui.modal('settings', false); setTimeout(() => document.getElementById('btn-teacher').click(), 200); });
  $id('set-wipe').addEventListener('click', () => {
    if (!confirm('이 기기의 배지·도감·내 일정·설정을 모두 지울까요? 되돌릴 수 없어요.')) return;
    for (const k of Object.keys(localStorage)) if (k.startsWith('smash-')) localStorage.removeItem(k);
    location.reload();
  });
  // 홈 화면에 설치(안드로이드·PC 크롬)
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
  $id('set-install').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => null); installEvt = null; syncSettings(); });
  // 새 버전 알림(오프라인 앱)
  addEventListener('smash-update', (e) => {
    ui.toast('새 버전이 있어요', '누르면 바로 바뀌어요', 'gold');
    const t = document.querySelector('#toasts .toast');
    if (t) { t.style.cursor = 'pointer'; t.addEventListener('click', () => { e.detail?.waiting?.postMessage('skip'); setTimeout(() => location.reload(), 300); }); }
  });

  // ---------- 데이터 백업·옮기기 ----------
  $id('set-backup').addEventListener('click', async () => {
    ui.modal('settings', false);
    ui.modal('backup', true);
    try {
      const code = await exportCode();
      $id('bk-code').value = code;
      const link = `${location.origin}${location.pathname}#restore=${code}`;
      if (link.length < 2300) await drawQR($id('bk-canvas'), link); else $id('bk-canvas').width = 0;
    } catch { $id('bk-code').value = '백업 코드를 만들지 못했어요'; }
  });
  $id('bk-close').addEventListener('click', () => ui.modal('backup', false));
  $id('bk-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($id('bk-code').value); ui.toast('복사했어요', '새 기기의 "코드로 복원"에 붙여 넣으세요'); } catch { $id('bk-code').select(); } });
  async function restoreFrom(code) {
    try {
      const r = await importCode(code);
      ui.toast('복원했어요', `기록 ${r.n}개를 옮겼어요. 다시 불러올게요`, 'green');
      setTimeout(() => { location.hash = ''; location.reload(); }, 1200);
    } catch { ui.toast('복원하지 못했어요', '코드를 끝까지 정확히 복사했는지 확인해 주세요'); }
  }
  $id('bk-restore').addEventListener('click', () => restoreFrom($id('bk-in').value));
  if (location.hash.startsWith('#restore=') && confirm('다른 기기의 기록(배지·도감·일정)을 이 기기로 옮길까요?')) restoreFrom(location.hash);

  // ---------- 선생님 대시보드 ----------
  {
    let tkey = '';
    try { tkey = localStorage.getItem('hasa-teacher-key') || ''; } catch { /* 무시 */ }
    $id('tc-key').value = tkey;
    const msg = (t) => { $id('tc-msg').textContent = t; };
    const fail = (e) => msg(e.message === 'key' ? '마스터키가 맞지 않아요' : e.message === 'offline' ? '온라인 저장소(Supabase)를 연결해야 쓸 수 있어요' : '처리하지 못했어요');
    async function loadEvents() {
      const L = await net.teacherEvents();
      $id('tc-events').innerHTML = L.length ? L.map((e) => `<li><span>${e.date}${e.end ? ` ~ ${e.end}` : ''} · ${String(e.name).replace(/[<>&]/g, '')}</span><button type="button" data-id="${e.id}">지우기</button></li>`).join('') : '<li class="empty">등록한 일정이 없어요</li>';
      for (const b of $id('tc-events').querySelectorAll('button')) b.addEventListener('click', async () => { try { await net.removeTeacherEvent(tkey, Number(b.dataset.id)); msg('지웠어요'); loadEvents(); } catch (e) { fail(e); } });
    }
    async function loadCheers() {
      const L = await net.teacherCheers(tkey);
      $id('tc-cheers').innerHTML = (L || []).map((c) => `<li class="${c.hidden ? 'off' : ''}"><span>${String(c.text).replace(/[<>&]/g, '')}${c.reports ? ` <em>신고 ${c.reports}</em>` : ''}</span><button type="button" data-id="${c.id}" data-h="${c.hidden ? 0 : 1}">${c.hidden ? '다시 보이기' : '숨기기'}</button></li>`).join('') || '<li class="empty">메시지가 없어요</li>';
      for (const b of $id('tc-cheers').querySelectorAll('button')) b.addEventListener('click', async () => { try { await net.setCheerHidden(tkey, Number(b.dataset.id), b.dataset.h === '1'); loadCheers(); } catch (e) { fail(e); } });
    }
    $id('btn-teacher').addEventListener('click', () => { ui.modal('teacher', true); msg(net.online ? '' : '온라인 저장소(Supabase)를 연결하면 쓸 수 있어요'); });
    $id('tc-close').addEventListener('click', () => ui.modal('teacher', false));
    $id('tc-login').addEventListener('click', async () => {
      tkey = $id('tc-key').value.trim();
      if (!tkey) return msg('마스터키를 넣어 주세요');
      try {
        await net.teacherCheers(tkey); // 키 확인
        try { localStorage.setItem('hasa-teacher-key', tkey); } catch { /* 무시 */ }
        $id('tc-body').hidden = false; msg('');
        loadEvents(); loadCheers();
      } catch (e) { fail(e); }
    });
    const flagBtn = (id, flag, label) => $id(id).addEventListener('click', async () => {
      const on = $id(id).getAttribute('aria-pressed') !== 'true';
      try { await online.setFlag(tkey, flag, on); $id(id).setAttribute('aria-pressed', String(on)); msg(`${label} ${on ? '켰어요' : '껐어요'}`); } catch (e) { msg(String(e.message || e)); }
    });
    flagBtn('tc-online-off', 'online_off', '온라인 전체 끄기를'); flagBtn('tc-raid-off', 'raid_off', '레이드 끄기를');
    for (const b of $id('tc-tabs').querySelectorAll('button')) b.addEventListener('click', () => {
      for (const x of $id('tc-tabs').querySelectorAll('button')) x.classList.toggle('on', x === b);
      for (const sec of $id('tc-body').querySelectorAll('section[data-tab]')) sec.hidden = sec.dataset.tab !== b.dataset.v;
    });
    $id('tc-post').addEventListener('click', async () => { try { await net.setNotice(tkey, $id('tc-notice').value, $id('tc-until').value || null); msg('공지를 올렸어요'); showNotice(); } catch (e) { fail(e); } });
    $id('tc-clear').addEventListener('click', async () => { try { await net.setNotice(tkey, '', null); msg('공지를 내렸어요'); $id('notice-banner').hidden = true; } catch (e) { fail(e); } });
  }

  // ---------- 전교 공지(맨 위 띠) ----------
  async function showNotice() {
    const n = await net.notice();
    const el = $id('notice-banner');
    if (!n) { el.hidden = true; return; }
    let closed = '';
    try { closed = localStorage.getItem('smash-notice-closed') || ''; } catch { /* 무시 */ }
    if (closed === String(n.id)) return;
    el.innerHTML = `<b>📢 학교 공지</b><span>${String(n.text).replace(/[<>&]/g, '')}</span><button type="button" aria-label="공지 닫기">✕</button>`;
    el.hidden = false;
    el.querySelector('button').addEventListener('click', () => { el.hidden = true; try { localStorage.setItem('smash-notice-closed', String(n.id)); } catch { /* 무시 */ } });
  }
  showNotice();

  // ---------- 개발자 메뉴(Control + Shift + K) ----------
  {
    const here = () => controls.target.clone();
    const C = [];
    const add = (group, label, run, hint) => C.push({ group, label, run, hint });
    for (const [id, nm] of [['squirrel', '하늘다람쥐'], ['deer', '고라니'], ['boar', '멧돼지'], ['frog', '개구리'], ['mantis', '사마귀'], ['bat', '박쥐']]) add('생물 불러오기', `${nm} 보기`, () => { wildlife.summon(id, here()); return `${nm}를 지금 보는 곳으로 불렀어요`; }, '화면 가운데로');
    add('생물 불러오기', '도감 열기', () => document.getElementById('btn-dex').click());
    for (const [k, e] of Object.entries(EDITIONS)) add('특별 에디션 미리 보기', e.title, () => { world.forceEdition(k); return `${e.title} 미리 보기`; }, k);
    add('특별 에디션 미리 보기', '에디션 끄기(오늘 날짜로)', () => { world.forceEdition(null); });
    add('특별 에디션 미리 보기', '수능 편지 열기', () => snLetter.open({ cheer, year: simDate.getFullYear() + 1 }));
    for (const id of world.events || []) add('랜덤 이벤트', { shower: '소나기', rush: '택배 폭주', rainbow: '무지개', meteors: '유성우', outage: '정전' }[id] || id, () => world.runEvent(id), '조건 무시하고 바로');
    for (const [id, nm] of [['race', '한빛 그랑프리'], ['soccer', '승부차기'], ['basketball', '60초 슛아웃'], ['tycoon', '매점 타이쿤'], ['crane', '증축 공사 도우미'], ['meteor', '운석 요격'], ['landing', '착륙 챌린지'], ['docking', 'HASA 도킹']]) add('미니게임', nm, () => world.openGame(id));
    add('미니게임', '파인홀 피클볼', () => pickle.open());
    add('미니게임', '사계절 시네마', () => cinema.start());
    add('뽑기·보상', '블록 월드 얻기', () => unlockBlock());
    add('뽑기·보상', '차 스킨 하나 얻기', () => world.unlockSkin());
    add('뽑기·보상', '차 스킨 모두 얻기', () => { for (const k of SKINS) skinStore.add(k.id); return '스킨 6종 모두'; });
    add('뽑기·보상', '시즌 패스 +1000 XP', () => { pass.add(1000, 'dev'); return `시즌 ${pass.level()}단계`; });
    add('뽑기·보상', '배지 모두 얻기', () => { for (const b of BADGES) badges.give(b[0]); return `배지 ${BADGES.length}개`; });
    add('뽑기·보상', '부모님 쪽지 보기', () => world.showNote());
    add('뽑기·보상', '쪽지 모두 모으기', () => { localStorage.setItem('smash-notes', JSON.stringify(world.NOTES.map((_, i) => i))); return `쪽지 ${world.NOTES.length}장`; });
    add('미니게임', '정거장 캠페인', () => openCampaign());
    add('미니게임', '캠페인 다음 단계 열기', () => { campaign.win(campaign.done()); return `정거장 ${campaign.done()}/10`; });
    for (const c of ['gp', 'rev', 'mir', 'mrev']) add('미니게임', `레이싱 서킷: ${{ gp: '그랑프리', rev: '리버스', mir: '미러', mrev: '미러 리버스' }[c]}`, () => arcade.open(race({ circuit: c })));
    add('학교', '나의 앨범', () => album.open());
    add('학교', '졸업 앨범 모습 보기', () => { cfg.forceGraduation = true; board.grade = 3; album.open(); });
    add('학교', '편지 카드 만들기', () => letter.open());
    add('학교', '보충 알림 미리 보기', () => { const now = new Date(); const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; const sup = cfg.supplement?.[ymd] || ['E', 'A']; ui.toast('📚 곧 보충 시작', `8교시 ${sup[0]}반 · 9교시 ${sup[1]}반`, 'gold'); });
    add('학교', '택배차 부르기', () => { delivery.arrive(); delivery.rolled = false; return '택배차 출발(뽑기 기회 포함)'; }, 'Control + Shift + D');
    add('학교', `증축동 ${extBuilt ? '공사 중 모습' : '완공 모습'} 보기`, () => { const u = new URL(location.href); u.searchParams.set('built', extBuilt ? '0' : '1'); location.href = u.toString(); }, '새로고침');
    add('학교', '크레인 진행률 +20', () => { const n = craneProgress.add(20); site?.setProgress(n); return `짐 ${n}개`; });
    add('학교', '보충 알파벳 보기', () => showSupplement());
    add('2.0 베타', '본관 1층 안으로 들어가기', () => world.enterBuilding('본관', '1F'));
    add('2.0 베타', '비 내리기(물웅덩이 확인)', () => { setWeatherMode('rain'); visuals.wet = 0.8; return '물웅덩이가 생겨요'; });
    add('2.0 베타', '노을(빛줄기 확인)', () => setTimeMode('sunset'));
    add('2.0 베타', '사진 모드(아웃포커스)', () => document.getElementById('btn-photo').click());
    add('2.0 베타', '베타 초대 코드 다시 묻기', () => { localStorage.removeItem('smash-beta-ok'); location.reload(); });
    for (const [m, nm] of [['dawn', '새벽'], ['day', '낮'], ['sunset', '노을'], ['night', '밤'], ['sync', '실시간']]) add('시간·날씨', `시간: ${nm}`, () => setTimeMode(m));
    for (const [m, nm] of [['clear', '맑음'], ['rain', '비'], ['snow', '눈'], ['fog', '안개'], ['sync', '실시간']]) add('시간·날씨', `날씨: ${nm}`, () => setWeatherMode(m));
    add('도구', 'HASA 관제센터', () => { location.href = 'hasa.html'; }, 'Control + Shift + H');
    add('도구', '진동 테스트(핵폭탄 패턴)', () => hap.play('nuke'));
    add('도구', '미니게임 최고 기록 지우기', () => { for (const k of Object.keys(localStorage)) if (k.startsWith('smash-best-') || k === 'smash-gp-sectors') localStorage.removeItem(k); return '최고 기록 초기화'; });
    add('도구', '첫 실행 안내 다시', () => onboard.open());
    new DevMenu(C, { toast: (a, b) => ui.toast(a, b) });
  }

  ui.ready();
  applyEdition(true);
  if (onboard.shouldShow()) setTimeout(() => onboard.open(), 1800);
  if (BlockUnlock.on()) setBlock(true);
  tele.start({ device, mode: smashMode ? 'smash' : 'tour', edition: world.edition || '', season: seasons.season, time: timeMode, weather: wxMode, grade: board.grade || 0, real: !!campus.terrain });
  addEventListener('pagehide', () => tele.end({ score: Math.round(score.score), grade: score.bestGrade, destroyed: Math.round(buildings.destroyedFraction() * 100) }));
  try {
    if (!localStorage.getItem('smash-tele-notice')) {
      localStorage.setItem('smash-tele-notice', '1');
      setTimeout(() => ui.toast('익명 통계 안내', '더 나은 게임을 위해 이름 없이 사용 통계를 모아요. 하트(후원) 카드에서 끌 수 있어요'), 12000);
    }
  } catch { /* 무시 */ }
  {
    const box = document.getElementById('tele-on');
    box.checked = tele.enabled;
    box.addEventListener('change', () => { tele.setEnabled(box.checked); ui.toast(box.checked ? '익명 통계 켬' : '익명 통계 끔', box.checked ? '고마워요!' : '이제 아무것도 보내지 않아요'); });
  }
  // 학년 대항 시즌: 지난 시즌 우승 학년 깃발을 국기게양대 옆에 세워요.
  board.lastWinner().then((win) => {
    ui.setSeason(board.season.name, win);
    if (win && flagAt) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 300;
      const g = c.getContext('2d');
      g.fillStyle = '#101a34'; g.fillRect(0, 0, 512, 300);
      g.fillStyle = '#ffc94a'; g.fillRect(0, 0, 512, 16); g.fillRect(0, 284, 512, 16);
      g.textAlign = 'center';
      g.font = '700 40px "Pretendard Variable", Pretendard, sans-serif'; g.fillText(`${win.season} 우승`, 256, 100);
      g.fillStyle = '#fff'; g.font = '800 110px "Pretendard Variable", Pretendard, sans-serif'; g.fillText(`${win.grade}학년`, 256, 220);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const x = flagAt[0] + 7, z = flagAt[1] + 3, y = terrain.heightAt(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd0d4d9, metalness: 0.8, roughness: 0.3 }));
      pole.position.set(x, y + 6, z);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.5), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
      banner.position.set(x + 2.15, y + 10.4, z);
      scene.add(pole, banner);
    }
  });
  applyWeather();
  setInterval(() => { if (simDate.toDateString() === new Date().toDateString()) applyWeather(); }, 15 * 60 * 1000);
  try {
    if (!localStorage.getItem('smash-hint-meal')) {
      localStorage.setItem('smash-hint-meal', '1');
      setTimeout(() => ui.toast('숨은 기능', '미래관(급식실)을 꾹 누르면 그날 급식이 나와요. 고양이도 찾아 보세요!'), 7000);
    }
  } catch { /* 무시 */ }
  stage.classList.add('fold-in');
  setTimeout(() => stage.classList.remove('fold-in'), 1100);
  if (!board.asked) setTimeout(pickGrade, 700);
}

start().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.querySelector('.load-msg').textContent = `불러오지 못했어요: ${err.message}. 터미널에서 python3 -m http.server 8000 으로 열었는지 확인해 주세요.`;
});
