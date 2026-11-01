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
import { Seasons, seasonOf } from './seasons.js';
import { Canopies } from './props.js';
import { buildStands, buildFence, buildTurtleRock, buildFossil, pickStandEdge, standFootprint } from './campusprops.js';
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
  for (const d of bdata) terrain.flatten(d.poly, d.base, 1.5);

  const painter = new GroundPainter(terrain, quality === 'high' ? 4096 : 2048);
  painter.paint(campus, bdata);
  scene.add(terrain.build(painter.texture), terrain.skirt);

  // ---------- 빛 ----------
  const hemi = new THREE.HemisphereLight(0xd4e6ff, 0x6b5a45, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1);
  const span = Math.max(terrain.w, terrain.d);
  const cx = terrain.x0 + terrain.w / 2, cz = terrain.z0 + terrain.d / 2;
  sun.position.set(cx - 180, 330, cz + 120);
  sun.target.position.set(cx, 0, cz);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
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
  const bigPitch = (campus.areas || []).filter((a) => a.kind === 'pitch').map((a) => cleanPolygon(a.poly)).sort((a, b) => signedArea(b) - signedArea(a))[0];
  const mainB = bdata.find((b) => b.name === '본관') || [...bdata].sort((a, b) => signedArea(b.poly) - signedArea(a.poly))[0];
  const standEdge = bigPitch && mainB ? pickStandEdge(bigPitch, mainB.poly) : null;
  if (standEdge) canopySpots.push({ poly: standFootprint(standEdge) });
  trees.plan(campus, [...bdata, ...canopySpots], quality === 'high' ? 2200 : 1000, quality === 'high' ? 480 : 240, quality === 'high' ? 900 : 380);
  trees.build();
  const score = new Score();
  const cartPath = cfg.golfCart === false ? null : findCartPath(campus, terrain);
  const cart = cartPath ? new GolfCart(scene, terrain, fx, cartPath) : null;

  // ---------- 카메라 ----------
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 6000);
  const focus = campus.boundary ? centroid(campus.boundary) : [0, 0];
  const fy = terrain.heightAt(focus[0], focus[1]);
  const home = {
    target: new THREE.Vector3(focus[0], fy, focus[1]),
    pos: new THREE.Vector3(focus[0] - span * 0.32, fy + span * 0.48, focus[1] + span * 0.62),
  };
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
  const updateDates = () => {
    const exam = nextExam(cfg.exams, simDate);
    const bonus = examBonus(exam);
    score.setBonus(bonus);
    ui.setExam(examLabel(exam), bonus);
    ui.setSuneung(nextSuneung(cfg, simDate));
    const real = new Date();
    const same = simDate.toDateString() === real.toDateString();
    ui.setTravel(same ? '' : `${simDate.getMonth() + 1}월 ${simDate.getDate()}일로 이동 중`);
  };
  updateDates();

  const biggest = [...buildings.list].sort((a, b) => b.totalVolume - a.totalVolume)[0];
  const missions = new Missions({ biggest, hasCart: !!cart });

  const board = new GradeBoard(cfg);
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
      const net = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
      for (const sgn of [-1, 1]) {
        const goal = new THREE.Group();
        const post = new THREE.CylinderGeometry(0.07, 0.07, 2.44, 8);
        for (const z of [-3.66, 3.66]) { const m = new THREE.Mesh(post, white); m.position.set(0, 1.22, z); goal.add(m); }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.32, 8).rotateX(Math.PI / 2), white);
        bar.position.y = 2.44;
        goal.add(bar);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44), net);
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
  if (bigPitch && mainB) {
    buildStands(scene, terrain, bigPitch, mainB.poly);
    buildFence(scene, terrain, bigPitch, standEdge ? standEdge.i : null);
  }
  const shrine = bdata.find((b) => b.name === '세심정');
  const turtleAt = cfg.turtleRock?.at || (shrine ? [centroid(shrine.poly)[0] - 20, centroid(shrine.poly)[1] + 18] : null);
  const turtle = turtleAt ? buildTurtleRock(scene, terrain, turtleAt, shrine ? centroid(shrine.poly) : focus) : null;
  buildFossil(scene, terrain);
  const canopies = new Canopies(scene, terrain, fx, cfg.canopies);
  const forceParty = location.search.includes('fireworks');
  const forceXmas = location.search.includes('xmas');

  const nukePad = new NukePad({ world, campus, R: 38, onLaunch: (P) => tools.nuke(P) });
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
    tools.holdEnd();
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
  const stats = { trees: 0 };
  function explode(P, o) {
    const R = o.R, power = o.power;
    const res = buildings.blast(P, R, power);
    const treesDown = trees.blast(P, R * 1.1);
    const cartHit = cart ? cart.blast(P, R, power) : false;
    canopies?.blast(P, R);
    if (o.fx !== false) fx.explosion(P, R, { flash: o.flash ?? 1 });
    if (world.edition === 'xmas' && (o.tool === 'bomb' || o.tool === 'meteor' || (o.tool === 'rocket' && R > 10))) xmas.gifts.burst(P, R > 12 ? 18 : 10);
    const g = terrain.heightAt(P.x, P.z);
    const ground = terrain.inside(P.x, P.z) && P.y - g < R * 0.45;
    if (ground && o.crater !== false) {
      terrain.crater(P.x, P.z, R * (o.craterR ?? 0.6), R * (o.craterD ?? 0.28));
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
    if (!o.quiet && !res.collapses.length && score.score - before >= 2000) ui.toast('참 잘했어요', `+${fmt(score.score - before)}`);
    if (score.grade() === 1 && !gradeOneDone) {
      gradeOneDone = true;
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
  const pointers = new Set();
  let down = null;
  let hover = null;
  let holding = false;
  dom.addEventListener('pointerdown', (e) => {
    if (director.busy) { director.skip(); down = null; return; }
    pointers.add(e.pointerId);
    if (pointers.size > 1) { down = null; if (holding) { tools.holdEnd(); holding = false; } return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button };
    if (tool.hold && e.button === 0) {
      const P = pick(e.clientX, e.clientY);
      if (P) { sound.ensure(); tools.holdStart(P); holding = true; }
    }
  });
  dom.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') hover = [e.clientX, e.clientY];
    if (holding) tools.holdMove(pick(e.clientX, e.clientY));
  });
  dom.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId);
    if (holding) { tools.holdEnd(); holding = false; down = null; return; }
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (down.b === 0 && moved < 8 && performance.now() - down.t < 450 && !tool.hold) {
      sound.ensure();
      const P = pick(e.clientX, e.clientY);
      if (P && editor) editor.add(P);
      else if (P && tool.id === 'nuke') nukePad.setTarget(P);
      else if (P) tools.fire(tool, P);
    }
    down = null;
  });
  dom.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); down = null; if (holding) { tools.holdEnd(); holding = false; } });
  dom.addEventListener('pointerleave', () => { hover = null; reticle.visible = false; });
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (!document.getElementById('sheet').hidden) return;
    const i = Number(e.key) - 1;
    if (TOOL_DEFS[i]) selectTool(TOOL_DEFS[i].id);
    if (e.key === 'n' || e.key === 'N') toggleNight();
    if (e.key === 'Enter' && tool.id === 'nuke') nukePad.launch();
    if (e.key === 'Escape') director.skip();
  });

  // ---------- 밤 ----------
  let night = false;
  function toggleNight() {
    night = !night;
    const C = night ? NIGHT : DAY;
    skyU.top.value.copy(C.top);
    skyU.bottom.value.copy(C.bottom);
    scene.fog.color.copy(C.fog);
    hemi.intensity = night ? 0.55 : 1.35;
    hemi.color.set(night ? 0x9db2e0 : 0xd4e6ff);
    sun.intensity = night ? 0.8 : 3.1;
    sun.color.set(night ? 0xaabcff : 0xfff0d8);
    renderer.toneMappingExposure = night ? 1.2 : 1.05;
    buildings.setNight(night);
    document.getElementById('btn-night').setAttribute('aria-pressed', String(night));
  }

  // ---------- 버튼 ----------
  function rebuild() {
    board.finishRun();
    tools.reset();
    world.rocket.reset();
    buildings.clear();
    for (const d of bdata) buildings.add(d);
    buildings.setNight(night);
    terrain.reset();
    painter.reset();
    trees.reset();
    cart?.reset();
    xmas.rebuilt();
    canopies.reset();
    fx.clear();
    score.reset();
    ui.reset();
    missions.reset();
    gradeOneDone = false;
    stats.trees = 0;
    nukePad.reset();
    if (tool.id === 'nuke') nukePad.open();
    for (const p of pops) scene.remove(p.o);
    pops.length = 0;
    renderBoard();
  }
  // 화면을 찍어 옆으로 접듯 넘기고, 그 사이에 학교를 다시 지어 반대쪽에서 펼칩니다.
  let folding = false;
  function foldRebuild(after) {
    if (folding) return;
    folding = true;
    const img = document.getElementById('fold');
    try {
      renderer.render(scene, camera);
      img.src = renderer.domElement.toDataURL('image/jpeg', 0.82);
    } catch { img.removeAttribute('src'); }
    img.classList.remove('go');
    stage.classList.remove('fold-in');
    img.hidden = false;
    const go = () => {
      rebuild();
      if (after) after();
      void img.offsetWidth;
      img.classList.add('go');
      stage.classList.add('fold-in');
      setTimeout(() => {
        img.hidden = true;
        img.classList.remove('go');
        stage.classList.remove('fold-in');
        folding = false;
      }, 1080);
    };
    (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => requestAnimationFrame(go));
  }
  document.getElementById('btn-reset').addEventListener('click', () => foldRebuild());

  // ---------- 특별 에디션과 달력 ----------
  let autoNight = false;
  function applyEdition(intro) {
    let ed = editionFor(events, simDate);
    if (!ed && forceParty) ed = 'party';
    if (!ed && forceXmas) ed = 'xmas';
    world.edition = ed;
    if (ed === 'xmas') xmas.enable(); else xmas.disable();
    world.xmasOn = ed === 'xmas';
    seasons.apply(seasonOf(simDate), { quiet: !intro || !!ed, noFall: ed === 'xmas' });
    if (ed === 'party') fireworks.start(); else fireworks.stop();
    // 크리스마스와 불꽃놀이는 밤이 예뻐서 자동으로 밤이 돼요.
    const wantNight = ed === 'xmas' || ed === 'party';
    if (wantNight && !night) { toggleNight(); autoNight = true; }
    if (!wantNight && night && autoNight) { toggleNight(); autoNight = false; }
    updateDates();
    ui.showEdition(ed, ed ? EDITIONS[ed] : null);
    if (ed === 'suneung' && intro) setTimeout(() => ui.toast('수험생 여러분, 힘내세요!', '오늘의 학습운세도 확인해 봐요', 'gold'), 3200);
  }
  function travel(date) {
    simDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    foldRebuild(() => applyEdition(true));
  }
  const calendar = new CalendarUI({ cfg, events, getDate: () => simDate, onTravel: travel });
  for (const id of ['btn-calendar', 'exam-chip', 'suneung-chip', 'edition-chip']) document.getElementById(id).addEventListener('click', () => calendar.open());
  document.getElementById('travel-chip').addEventListener('click', () => travel(new Date()));

  // ---------- 오늘의 학습운세 ----------
  const fortuneDate = () => `${simDate.getMonth() + 1}월 ${simDate.getDate()}일`;
  document.getElementById('btn-fortune').addEventListener('click', () => { sound.ensure(); sound.pop(); ui.showFortune(drawFortune(world.edition), fortuneDate()); });
  document.getElementById('ft-again').addEventListener('click', () => { sound.pop(); ui.showFortune(drawFortune(world.edition), fortuneDate()); });
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
  document.getElementById('btn-night').addEventListener('click', toggleNight);
  document.getElementById('btn-home').addEventListener('click', () => {
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
  });
  addEventListener('pagehide', () => board.finishRun());

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
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (spin) {
      spin.t = Math.min(1, spin.t + dt / 0.7);
      const u = spin.t * spin.t * (3 - 2 * spin.t);
      const a = spin.from + spin.d * u;
      camera.position.set(controls.target.x + Math.sin(a) * spin.r, controls.target.y + spin.y, controls.target.z + Math.cos(a) * spin.r);
      if (spin.t >= 1) spin = null;
    }
    if (!director.update(dt)) {
      controls.update();
      controls.target.x = Math.max(terrain.x0, Math.min(terrain.x0 + terrain.w, controls.target.x));
      controls.target.z = Math.max(terrain.z0, Math.min(terrain.z0 + terrain.d, controls.target.z));
    }
    nukePad.update(dt);
    fireworks.update(dt);
    flagPole?.update(dt);
    xmas.update(dt, director.busy ? director.look : controls.target);
    seasons.update(dt, director.busy ? director.look : controls.target);
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
      scene.fog.near = 500 + lift * 1.1;
      scene.fog.far = 1700 + lift * 1.5;
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
    fx.update(dt);
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
    if (hover && hoverTimer <= 0 && !holding && !director.busy) {
      hoverTimer = 1 / 20;
      const P = pick(hover[0], hover[1]);
      reticle.visible = !!P;
      if (P) reticle.position.set(P.x, P.y + 0.25, P.z);
    }
    if (holding || director.busy) reticle.visible = false;

    camera.position.add(fx.shakeOff);
    renderer.render(scene, camera);
    camera.position.sub(fx.shakeOff);
    labels.render(scene, camera);
  });

  ui.ready();
  applyEdition(true);
  stage.classList.add('fold-in');
  setTimeout(() => stage.classList.remove('fold-in'), 1100);
  if (!board.asked) setTimeout(pickGrade, 700);
}

start().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.querySelector('.load-msg').textContent = `불러오지 못했어요: ${err.message}. 터미널에서 python3 -m http.server 8000 으로 열었는지 확인해 주세요.`;
});
