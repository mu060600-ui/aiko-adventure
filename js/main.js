// 게임 실행부: 렌더러, 입력, 화면 UI, 미션·도감·저장
import * as THREE from 'three';
import { Player, FollowCamera } from './player.js';
import { World, buildCampus } from './world.js';
import { UI } from '../data/i18n.js';
import { EQUIP, CATEGORIES, INQUIRY_URL } from '../data/equipment.js';
import { PRODUCTS } from '../data/products.js';
import { LEVELS } from '../data/levels.js';
import { SIMS, SIM_NOTE } from './sim.js';

// ------------------------------------------------------------------ 저장 (LocalStorage, 로그인 없음)
const KEY = 'aiko_adventure_v1';
const DEF = { lang: 'ko', tutorialDone: false, visited: [], found: [], missions: [], badges: [], xp: 0, cleared: [], settings: { quality: 'high' } };
let save = { ...DEF };
try { save = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; save.settings = { ...DEF.settings, ...save.settings }; } catch (e) { /* 저장 불가 환경 */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 무시 */ } };

const $ = (s) => document.querySelector(s);
const t = (k) => UI[save.lang][k] ?? k;
const L = (o) => (o ? o[save.lang] ?? o.ko : '');
function applyLang() {
  document.documentElement.lang = save.lang;
  document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = t(e.dataset.t); });
  $('#p-inquiry').href = INQUIRY_URL;
  buildModes(); if (state.level) { refreshHud(); if (state.panelEquip) openPanel(state.panelEquip, state.panelTab); }
}

// ------------------------------------------------------------------ 렌더러
const canvas = $('#view');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('#loading').classList.add('hidden'); $('#nowebgl').classList.remove('hidden'); document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); }); throw e; }
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd6ee);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);

// 금속 재질이 비칠 간단한 환경
{
  const env = new THREE.Scene(); env.background = new THREE.Color(0x8fa6c0);
  const mk = (c, x, y, z, s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); env.add(m); };
  mk(0xffffff, 0, 30, 0, 26); mk(0xdfeaff, 30, 8, 10, 16); mk(0x6f86a6, -30, 4, -10, 18); mk(0x46566e, 0, -30, 0, 30);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.75;
}
const hemi = new THREE.HemisphereLight(0xffffff, 0x8795a8, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(6, 12, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

function applyQuality() {
  const low = save.settings.quality === 'low';
  renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !low; sun.castShadow = !low;
  scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  resize();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ------------------------------------------------------------------ 상태
const state = { screen: 'loading', level: null, free: false, near: null, hover: null, panelEquip: null, panelTab: 'easy', detail: null, mode: 'normal', talkQ: [], talkDone: null, typing: null, mapBig: false };
const player = new Player(); scene.add(player.group);
const follow = new FollowCamera(camera);
const world = new World(scene);
let campus = null, logoTex = null;
const keys = new Set(); const joy = { x: 0, y: 0, on: false };
const steer = { key: null, target: 0 };
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('is-touch');

// ------------------------------------------------------------------ 메인 화면
function showMenu() {
  state.screen = 'menu'; state.level = null; world.dispose();
  if (!campus) { campus = buildCampus(); scene.add(campus); }
  campus.visible = true;
  scene.fog = new THREE.Fog(0xbfd6ee, 40, 120); scene.background.set(0xbfd6ee);
  player.pos.set(1.3, 0, 15.2); player.yaw = Math.PI - 0.12; player.speed = 0; player.play('wave', 4);
  sun.position.set(18, 26, 22); sun.target.position.set(0, 0, 0); setShadowBox(34);
  $('#hud').classList.add('hidden'); $('#menu').classList.remove('hidden'); closePanel(); hideTalk();
}
function setShadowBox(s) { const c = sun.shadow.camera; c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.updateProjectionMatrix(); }

// ------------------------------------------------------------------ 레벨 시작
function startLevel(id) {
  const level = LEVELS.find((l) => l.id === id); if (!level || !level.ready) return;
  state.screen = 'play'; state.level = level; state.mode = 'normal';
  if (campus) campus.visible = false;
  scene.fog = null; scene.background.set(0x1a2a40);
  world.build(level, logoTex, save.lang); exitDetail();
  player.pos.set(level.spawn[0], 0, level.spawn[1]); player.yaw = THREE.MathUtils.degToRad(level.spawn[2]); player.speed = 0;
  follow.snapBehind(player);
  sun.position.set(4, level.room.h + 9, 5); sun.target.position.set(0, 0, 0); setShadowBox(Math.min(34, Math.max(level.room.w, level.room.d) * 0.62));
  if (!save.visited.includes(id)) { save.visited.push(id); persist(); }
  $('#menu').classList.add('hidden'); closeModal(); $('#hud').classList.remove('hidden');
  buildModes(); refreshHud(); closePanel();
  const lines = [...(save.tutorialDone ? [] : t('intro')), ...L(level.talk), ...(save.tutorialDone ? [] : t('tut'))];
  player.play('wave', 3);
  say(lines, () => { save.tutorialDone = true; persist(); });
}

// ------------------------------------------------------------------ HUD
const MODES = [['normal', '👁️'], ['air', '🌬️'], ['liquid', '💧'], ['heat', '🌡️'], ['power', '⚡'], ['xray', '🔍'], ['bim', '📐']];
function buildModes() {
  $('#modes').innerHTML = MODES.map(([m, e]) => `<button data-mode="${m}" class="${state.mode === m ? 'on' : ''}"><span class="e">${e}</span>${t('mode_' + m)}</button>`).join('');
}
function setMode(m) {
  state.mode = m; world.setMode(m); buildModes();
  const n = $('#notice'); let msg = '';
  if (m === 'heat') msg = t('heat_note');
  else if ((m === 'air' || m === 'liquid' || m === 'power') && !world.hasFlow(m)) msg = t('no_flow');
  n.textContent = msg; n.classList.toggle('hidden', !msg);
}
function levelProgress(level) { const ms = level.missions || []; return ms.length ? ms.filter((m) => save.missions.includes(m.id)).length / ms.length : 0; }
function refreshHud() {
  const lv = state.level; if (!lv) return;
  $('#lv-name').textContent = L(lv.name); $('#lv-power').textContent = lv.power;
  const p = Math.round(levelProgress(lv) * 100); $('#lv-prog').textContent = p + '%'; $('#lv-bar').style.width = p + '%';
  $('#mission-list').innerHTML = lv.missions.map((m) => `<li class="${save.missions.includes(m.id) ? 'done' : ''}">${L(m.text)}</li>`).join('');
}
function toast(title, sub, ms = 2400) {
  const el = $('#toast'); el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`; el.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), ms);
}

// ------------------------------------------------------------------ 설비 살펴보기, 미션, 도감
function inspect(item) {
  if (!item) return;
  if (item.type === 'portal') { openWorldMap(); return; }
  if (item.sim) { player.yaw = Math.atan2(item.pos[0] - player.pos.x, item.pos[1] - player.pos.z); steer.key = null; openSim(item.sim); return; }
  if (!item.equip) return;
  player.play('observe', 2.2);
  // 캐릭터가 설비 쪽을 보게 한다
  player.yaw = Math.atan2(item.pos[0] - player.pos.x, item.pos[1] - player.pos.z); steer.key = null;
  openPanel(item.equip, 'easy');
  let isNew = false;
  if (!save.found.includes(item.equip)) { save.found.push(item.equip); save.xp += 10; isNew = true; }
  // 랙을 살펴보면 '서버 랙'도 함께 발견한 것으로 본다
  if (item.type === 'rack' && !save.found.includes('rack-cpu')) { save.found.push('rack-cpu'); save.xp += 10; }
  checkMissions(isNew); persist();
}
function checkMissions() {
  const lv = state.level; let got = null;
  for (const m of lv.missions) {
    if (save.missions.includes(m.id)) continue;
    if (m.need.every((k) => save.found.includes(k))) { save.missions.push(m.id); save.xp += 50; got = m; }
  }
  if (got) {
    refreshHud();
    if (levelProgress(lv) >= 1 && !save.cleared.includes(lv.id)) {
      save.cleared.push(lv.id); save.badges.push(lv.id); save.xp += 100;
      setTimeout(() => { player.play('cheer', 3); toast(`${lv.badge} ${t('level_clear')}`, `${t('badge_get')} · ${t('titles')[lv.title]}`, 3600); }, 900);
    } else { setTimeout(() => player.play('cheer', 1.6), 500); toast(`✅ ${t('mission_clear')}`, L(got.text)); }
  }
}
const TBC = () => `<span class="tbc">${save.lang === 'ko' ? '제조사 확인 필요' : 'To be confirmed with manufacturer'}</span>`;
function productHtml(id, full) {
  const p = PRODUCTS[id]; if (!p) return '';
  const v = (x) => (x == null ? TBC() : (typeof x === 'object' ? L(x) : x));
  const ko = save.lang === 'ko';
  if (!full) return `<div class="prod"><b>${L(p.name)}</b><br>${L(p.easy)}<br><a href="${p.url}" target="_blank" rel="noopener">${t('official_page')} ↗</a></div>`;
  const rows = [[ko ? '제품명' : 'Product', L(p.name)], [ko ? '모델명' : 'Model', v(p.model)], [ko ? '제조사' : 'Maker', p.maker], [ko ? '제품 유형' : 'Type', v(p.type)], [ko ? '크기' : 'Size', v(p.size)],
    ['CPU', v(p.cpu)], ['GPU', v(p.gpu)], [ko ? '메모리' : 'Memory', v(p.memory)], [ko ? '스토리지' : 'Storage', v(p.storage)], [ko ? '네트워크' : 'Network', v(p.network)],
    [ko ? '냉각 방식' : 'Cooling', v(p.cooling)], [ko ? '주요 용도' : 'Use', v(p.use)], [ko ? '사양 확인일' : 'Verified on', p.verified ?? TBC()]];
  return `<div class="prod"><table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><a href="${p.url}" target="_blank" rel="noopener">${t('official_page')} ↗</a>
    <div class="small">${ko ? '제품 이미지는 사용 승인 전이라 게임 내 교육용 3D 개념 모델로 대신 보여 줍니다.' : 'Product photos await usage approval; an educational 3D concept model is shown instead.'}</div></div>`;
}
function openPanel(key, tab = 'easy') {
  const e = EQUIP[key]; if (!e) return;
  state.panelEquip = key; state.panelTab = tab;
  $('#p-icon').textContent = e.icon; $('#p-name').textContent = L(e.name); $('#p-cat').textContent = L(CATEGORIES[e.cat]);
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const prods = e.products || [];
  $('#p-body').innerHTML = tab === 'easy'
    ? ['what', 'why', 'how', 'link', 'where'].map((k) => `<h4>${t('q_' + k)}</h4><p>${L(e[k])}</p>`).join('')
      + (prods.length ? `<h4>${t('q_products')}</h4>${prods.map((p) => productHtml(p, false)).join('')}` : '')
      + `<h4>${t('q_aik')}</h4><p>${L(e.aik)}</p>`
    : `<h4>${save.lang === 'ko' ? '기술 메모' : 'Technical note'}</h4><p>${L(e.pro)}</p>`
      + (prods.length ? `<h4>${t('q_products')}</h4>${prods.map((p) => productHtml(p, true)).join('')}` : '')
      + `<h4>${t('q_aik')}</h4><p>${L(e.aik)}</p>`;
  $('#p-body').scrollTop = 0; $('#panel').classList.remove('hidden');
  $('#p-detail').classList.toggle('hidden', !state.near || state.near.equip !== key);
}
function closePanel() { $('#panel').classList.add('hidden'); state.panelEquip = null; }

// ------------------------------------------------------------------ 말풍선 (타이핑 효과)
function say(lines, done) { state.talkQ = [...lines]; state.talkDone = done || null; nextTalk(); }
function nextTalk() {
  clearInterval(state.typing); state.typing = null;
  const line = state.talkQ.shift();
  if (line == null) { hideTalk(); const d = state.talkDone; state.talkDone = null; if (d) d(); return; }
  $('#talk').classList.remove('hidden'); const el = $('#talk-text'); el.textContent = ''; state.fullLine = line;
  let i = 0; player.play('explain', 60);
  state.typing = setInterval(() => { el.textContent = line.slice(0, ++i); if (i >= line.length) { clearInterval(state.typing); state.typing = null; } }, 28);
}
function hideTalk() { clearInterval(state.typing); state.typing = null; $('#talk').classList.add('hidden'); state.talkQ = []; if (player.emote === 'explain') player.emote = null; }
function talkNext() { if (state.typing) { clearInterval(state.typing); state.typing = null; $('#talk-text').textContent = state.fullLine; } else nextTalk(); }
function talkSkip() { const d = state.talkDone; state.talkDone = null; hideTalk(); if (d) d(); }

// ------------------------------------------------------------------ 공용 창
function openModal(title, html) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
function openWorldMap(free = state.free) {
  state.free = free;
  const cards = LEVELS.map((lv, i) => {
    const cleared = save.cleared.includes(lv.id);
    const locked = !free && i > 0 && !save.cleared.includes(LEVELS[i - 1].id);
    const off = !lv.ready || locked;
    const label = !lv.ready ? t('coming') : locked ? '🔒 ' + t('locked') : t('visit');
    return `<div class="lv-card ${off ? 'off' : ''} ${cleared ? 'cleared' : ''}"><span class="big">${lv.badge}</span><span class="pw">LEVEL ${i + 1} · ${lv.power}</span><h3>${L(lv.name)}${cleared ? ' ✅' : ''}</h3><p>${L(lv.desc)}</p>
      <button class="${off ? '' : 'primary'}" ${off ? 'disabled' : ''} data-level="${lv.id}">${label}</button></div>`;
  }).join('');
  openModal(free ? t('menu_free') : t('menu_select'), `<div class="grid">${cards}</div><p class="note" style="margin-top:12px">${t('edu_note')}</p>`);
}
function openCodex() {
  const all = Object.entries(EQUIP); const n = all.filter(([k]) => save.found.includes(k)).length;
  let html = `<div class="stat"><div><b>${n} / ${all.length}</b><span>${t('codex_progress')}</span></div></div><div class="bar" style="margin-bottom:8px"><i style="width:${Math.round(n / all.length * 100)}%"></i></div>`;
  for (const [cat, name] of Object.entries(CATEGORIES)) {
    const list = all.filter(([, e]) => e.cat === cat); if (!list.length) continue;
    html += `<div class="cx-cat">${L(name)}</div><div class="cx-grid">` + list.map(([k, e]) => (save.found.includes(k)
      ? `<div class="cx" data-codex="${k}"><span class="i">${e.icon}</span><b>${L(e.name)}</b></div>` : `<div class="cx no"><span class="i">${e.icon}</span><b>???</b></div>`)).join('') + '</div>';
  }
  openModal(t('menu_codex'), html);
}
function currentTitle() { let i = 0; for (const lv of LEVELS) if (save.cleared.includes(lv.id)) i = Math.max(i, lv.title); if (LEVELS.every((l) => save.cleared.includes(l.id))) i = 6; return t('titles')[i]; }
function openRecord() {
  const total = LEVELS.reduce((a, l) => a + (l.missions?.length || 0), 0);
  openModal(t('menu_record'), `<div class="stat"><div><b>${currentTitle()}</b><span>${t('title_now')}</span></div><div><b>${save.xp}</b><span>${t('xp')}</span></div>
    <div><b>${save.visited.length} / ${LEVELS.length}</b><span>${t('visited')}</span></div><div><b>${save.missions.length} / ${total}</b><span>${t('missions_done')}</span></div>
    <div><b>${save.badges.map((b) => LEVELS.find((l) => l.id === b)?.badge).join(' ') || '-'}</b><span>${t('badges')}</span></div></div><button data-act="reset">${t('reset')}</button>`);
}
function openHelp() {
  openModal(t('menu_help'), `<div class="help-cols"><div><h3>${t('help_pc')}</h3><ul>${['move', 'run', 'e', 'f', 'm', 'esc', 'mouse'].map((k) => `<li>${t('help_' + k)}</li>`).join('')}</ul></div>
    <div><h3>${t('help_mobile')}</h3><ul>${['joy', 'btn', 'drag'].map((k) => `<li>${t('help_' + k)}</li>`).join('')}</ul></div></div>`);
}
function openAbout() {
  openModal(t('menu_about'), `<div class="about"><p class="slogan">${t('about_slogan')}</p><p>${t('about_body')}</p><a class="inquiry" href="${INQUIRY_URL}" target="_blank" rel="noopener">${t('inquiry')}</a></div>`);
}
function openSettings() {
  const q = save.settings.quality;
  openModal(t('settings'), `<div class="row"><span>${t('quality')}</span><div><button data-quality="high" class="${q === 'high' ? 'on' : ''}">${t('q_high')}</button><button data-quality="low" class="${q === 'low' ? 'on' : ''}">${t('q_low')}</button></div></div>
    <div class="row"><span>${t('lang')}</span><div><button data-setlang="ko" class="${save.lang === 'ko' ? 'on' : ''}">한국어</button><button data-setlang="en" class="${save.lang === 'en' ? 'on' : ''}">English</button></div></div>
    <div class="row"><span>${t('menu_help')}</span><div><button data-act="help">${t('menu_help')}</button></div></div>
    <div class="row"><span>${t('title')}</span><div><button data-act="tomenu">${t('back')}</button></div></div>`);
}


// ------------------------------------------------------------------ 실험 시뮬레이터
function openSim(id) {
  const sim = SIMS[id]; if (!sim) return;
  openModal(`${sim.icon} ${L(sim.title)}`, `<div id="sim-root" class="sim"></div><p class="note" style="margin-top:14px">${L(SIM_NOTE)}</p>`);
  sim.render($('#sim-root'), L, () => {
    const key = 'sim:' + id; if (save.found.includes(key)) return;
    save.found.push(key); save.xp += 30; persist(); checkMissions();
  });
}

// ------------------------------------------------------------------ 설비 내부 상세보기 (F): 설비 주위를 돌려 보며 내부 부품을 번호로 확인
// 좌표는 설비 기준(앞면 +z). 교육용 개념 모델의 부품 위치다.
const P2 = (ko, en) => ({ ko, en });
const PARTS = {
  rack: [[[0, 2.0, 0.55], P2('상단 스위치 (ToR)', 'Top-of-rack switch')], [[0, 1.2, 0.56], P2('서버 (앞면으로 찬 공기 흡입)', 'Servers (cold air intake at front)')], [[0, 1.2, -0.56], P2('후면 팬 (더운 공기 배출)', 'Rear fans (hot air exhaust)')], [[0, 2.2, 0], P2('상부 케이블 트레이', 'Overhead cable tray')]],
  liquidRack: [[[0, 1.4, 0.56], P2('GPU 서버', 'GPU servers')], [[-0.35, 1.3, -0.62], P2('공급 매니폴드 (파랑)', 'Supply manifold (blue)')], [[0.35, 1.3, -0.62], P2('환수 매니폴드 (빨강)', 'Return manifold (red)')], [[0, 0.75, 0], P2('콜드 플레이트 (칩 위 냉각판)', 'Cold plates on the chips')], [[0, 0.3, 0.56], P2('랙 내장 CDU (NVL72)', 'In-rack CDU (NVL72)')]],
  cdu: [[[0, 1.5, 0.56], P2('제어 화면', 'Control display')], [[0, 1.2, 0], P2('판형 열교환기 (두 물이 열만 교환)', 'Plate heat exchanger')], [[-0.18, 0.4, 0.1], P2('펌프 A', 'Pump A')], [[0.18, 0.4, 0.1], P2('펌프 B (예비)', 'Pump B (standby)')], [[-0.17, 2.3, -0.3], P2('시설 쪽 공급·환수 (1차)', 'Facility supply and return (primary)')], [[0.2, 2.3, -0.3], P2('서버 쪽 공급·환수 (2차)', 'Server supply and return (secondary)')]],
  exhibit: [[[-0.6, 1.0, -0.18], P2('GPU 칩', 'GPU chip')], [[-0.2, 1.05, -0.18], P2('콜드 플레이트 (GPU 위에 밀착)', 'Cold plate pressed onto the GPU')], [[0.2, 1.1, 0.25], P2('공급 호스 (파랑, 찬 냉각수)', 'Supply hose (blue, cool coolant)')], [[0.6, 1.1, 0.25], P2('환수 호스 (빨강, 데워진 냉각수)', 'Return hose (red, warmed coolant)')], [[0, 1.1, 0.42], P2('서버 내부 공급 분배관', 'In-server supply header')], [[0, 1.1, -0.4], P2('서버 내부 환수 분배관', 'In-server return header')]],
  crac: [[[0, 2.1, 0], P2('더운 공기 흡입 (위)', 'Warm air return (top)')], [[0, 1.25, 0], P2('냉각 코일', 'Cooling coil')], [[0, 0.5, 0.48], P2('찬 공기 토출 (아래)', 'Cold air supply (bottom)')], [[0.5, 1.2, 0.48], P2('제어 화면', 'Control display')]],
  chiller: [[[0, 2.1, 0], P2('방열 팬', 'Heat rejection fans')], [[0, 0.75, 0.3], P2('증발기 (물을 차갑게)', 'Evaporator (chills the water)')], [[0, 0.75, -0.3], P2('응축기·압축기', 'Condenser and compressor')], [[1.7, 0.6, 0.4], P2('냉수 공급', 'Chilled water supply')], [[1.7, 0.6, -0.4], P2('냉수 환수', 'Chilled water return')]],
  manifold: [[[-0.3, 1.5, 0], P2('공급 관', 'Supply header')], [[0.3, 1.5, 0], P2('환수 관', 'Return header')], [[-0.3, 0.84, 0.2], P2('퀵 커플링 (물이 새지 않는 연결부)', 'Quick disconnect (drip-free)')]],
};
function partsFor(it) {
  if (it.type === 'rack') return ['hgx', 'dlc', 'nvl72'].includes(it.variant) ? PARTS.liquidRack : PARTS.rack;
  if (it.type === 'crah' || it.type === 'inrow') return PARTS.crac;
  return PARTS[it.type] || [];
}
function enterDetail(it) {
  inspect(it);
  const s = Math.max(it.height, 1.4);
  state.detail = { item: it, ang: player.yaw + Math.PI + 0.6, el: 0.45, dist: s * 1.5 + 1.0, auto: true, prevMode: state.mode, parts: partsFor(it) };
  setMode('xray'); $('#tag').classList.add('hidden'); player.group.visible = false;
  $('#detail').classList.remove('hidden'); $('#modes').classList.add('hidden'); $('#missions').classList.add('hidden');
  const ko = save.lang === 'ko';
  $('#detail-title').textContent = `${EQUIP[it.equip].icon} ${L(EQUIP[it.equip].name)}`;
  $('#detail-list').innerHTML = state.detail.parts.length ? state.detail.parts.map((p, i) => `<li><b>${i + 1}</b>${L(p[1])}</li>`).join('') : `<li>${ko ? '외장을 반투명하게 해서 내부를 보여 줍니다.' : 'The casing is made translucent to show the inside.'}</li>`;
  $('#hot').innerHTML = state.detail.parts.map((p, i) => `<i>${i + 1}</i>`).join('');
}
function exitDetail() {
  if (!state.detail) return;
  setMode(state.detail.prevMode === 'xray' ? 'normal' : state.detail.prevMode); state.detail = null; player.group.visible = true;
  $('#detail').classList.add('hidden'); $('#hot').innerHTML = ''; $('#modes').classList.remove('hidden'); $('#missions').classList.remove('hidden');
  follow.snapBehind(player);
}
const dv = new THREE.Vector3();
function updateDetail(dt) {
  const d = state.detail, it = d.item; if (d.auto) d.ang += dt * 0.35;
  const cy = it.height * 0.5, ce = Math.cos(d.el), se = Math.sin(d.el);
  camera.position.set(it.pos[0] + Math.sin(d.ang) * ce * d.dist, cy + se * d.dist, it.pos[1] + Math.cos(d.ang) * ce * d.dist);
  camera.lookAt(it.pos[0], cy, it.pos[1]);
  const els = $('#hot').children;
  d.parts.forEach((p, i) => {
    dv.set(...p[0]); it.group.localToWorld(dv); dv.project(camera);
    els[i].style.left = `${(dv.x + 1) / 2 * innerWidth}px`; els[i].style.top = `${(1 - dv.y) / 2 * innerHeight}px`; els[i].style.display = dv.z > 1 ? 'none' : '';
  });
}

// ------------------------------------------------------------------ 버튼 처리
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button, .cx, a'); if (!el) return;
  const d = el.dataset;
  if (d.mode) return setMode(d.mode);
  if (d.tab) return openPanel(state.panelEquip, d.tab);
  if (d.level) return startLevel(d.level);
  if (d.codex) { closeModal(); if (state.screen === 'play') openPanel(d.codex); else openModal(L(EQUIP[d.codex].name), `<p style="line-height:1.7">${L(EQUIP[d.codex].what)}<br><br>${L(EQUIP[d.codex].how)}</p>`); return; }
  if (d.quality) { save.settings.quality = d.quality; persist(); applyQuality(); return openSettings(); }
  if (d.setlang) { save.lang = d.setlang; persist(); applyLang(); return openSettings(); }
  switch (d.act) {
    case 'start': { const next = LEVELS.find((l) => l.ready && !save.cleared.includes(l.id)) || LEVELS[0]; state.free = false; startLevel(next.id); break; }
    case 'select': openWorldMap(false); break;
    case 'free': openWorldMap(true); break;
    case 'worldmap': openWorldMap(); break;
    case 'record': openRecord(); break;
    case 'codex': openCodex(); break;
    case 'help': openHelp(); break;
    case 'about': openAbout(); break;
    case 'settings': openSettings(); break;
    case 'lang': save.lang = save.lang === 'ko' ? 'en' : 'ko'; persist(); applyLang(); break;
    case 'modal-close': closeModal(); break;
    case 'panel-close': closePanel(); break;
    case 'detail': if (state.detail) exitDetail(); else if (state.near?.equip) enterDetail(state.near); break;
    case 'detail-exit': exitDetail(); break;
    case 'talk-next': talkNext(); break;
    case 'talk-skip': talkSkip(); break;
    case 'tomenu': closeModal(); showMenu(); break;
    case 'reset': if (confirm(t('reset_confirm'))) { save = { ...DEF, lang: save.lang, settings: save.settings, visited: [], found: [], missions: [], badges: [], cleared: [] }; persist(); openRecord(); if (state.level) refreshHud(); } break;
    default:
  }
});

// ------------------------------------------------------------------ 입력
const modalOpen = () => !$('#modal').classList.contains('hidden');
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys.add(k);
  if (e.repeat) return;
  if (k === 'escape') { if (state.detail) exitDetail(); else if (modalOpen()) closeModal(); else if (!$('#panel').classList.contains('hidden')) closePanel(); else if (state.screen === 'play') openSettings(); return; }
  if (state.screen !== 'play' || modalOpen()) return;
  if (k === 'enter' && !$('#talk').classList.contains('hidden')) return talkNext();
  if (k === 'e') inspect(state.near);
  if (k === 'f') { if (state.detail) exitDetail(); else if (state.near?.equip) enterDetail(state.near); }
  if (k === 'm') { state.mapBig = !state.mapBig; $('#minimap').classList.toggle('big', state.mapBig); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const ptrs = new Map(); let pinch = 0, downAt = null, moved = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(x, y) {
  if (!world.root) return null;
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObject(world.root, true)) {
    if (!h.object.visible || h.object.userData.sys === 'flow' || h.object.userData.sys === 'room' || h.object.userData.sys === 'outline') continue;
    const id = h.object.userData.itemId; if (id) return world.item(id);
    return null;
  }
  return null;
}
canvas.addEventListener('pointerdown', (e) => { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); downAt = { x: e.clientX, y: e.clientY }; moved = 0; follow.dragging = true; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (state.screen === 'play' && !isTouch) { state.hover = pick(e.clientX, e.clientY); canvas.style.cursor = state.hover ? 'pointer' : 'grab'; } return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  if (state.screen !== 'play') return;
  if (state.detail) { if (ptrs.size === 1) { state.detail.ang -= dx * 0.008; state.detail.el = THREE.MathUtils.clamp(state.detail.el + dy * 0.005, 0.1, 1.3); state.detail.auto = false; } return; }
  if (ptrs.size === 1) { const y0 = player.yaw; follow.rotate(dx, dy, player); steer.target += player.yaw - y0; }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) follow.zoom(pinch / dist); pinch = dist; }
});
const up = (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId); pinch = 0; if (!ptrs.size) follow.dragging = false;
  if (state.screen === 'play' && !state.detail && moved < 8 && downAt) { const it = pick(e.clientX, e.clientY); if (it) inspect(it); }
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (state.detail) state.detail.dist = THREE.MathUtils.clamp(state.detail.dist * (e.deltaY > 0 ? 1.1 : 0.9), 1.5, 14); else if (state.screen === 'play') follow.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 가상 조이스틱, 상호작용 버튼
{
  const el = $('#joy'), knob = el.querySelector('i'); let id = null;
  const set = (e) => { const r = el.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; knob.style.transform = `translate(${x * 36}px, ${y * 36}px)`; };
  el.addEventListener('pointerdown', (e) => { id = e.pointerId; try { el.setPointerCapture(id); } catch (err) { /* 일부 환경에서는 캡처 불가 */ } joy.on = true; set(e); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; joy.on = false; joy.x = joy.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  $('#act').addEventListener('click', () => { if (!$('#talk').classList.contains('hidden')) talkNext(); else inspect(state.near); });
}

// ------------------------------------------------------------------ 미니맵
function drawMinimap() {
  const cv = $('#minimap'), g = cv.getContext('2d'), lv = state.level; if (!lv) return;
  const W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  const s = Math.min((W - 16) / lv.room.w, (H - 16) / lv.room.d); const ox = W / 2, oy = H / 2;
  g.fillStyle = 'rgba(255,255,255,.10)'; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5;
  g.fillRect(ox - lv.room.w / 2 * s, oy - lv.room.d / 2 * s, lv.room.w * s, lv.room.d * s); g.strokeRect(ox - lv.room.w / 2 * s, oy - lv.room.d / 2 * s, lv.room.w * s, lv.room.d * s);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath();
  for (const [x1, z1, x2, z2] of lv.walls || []) { g.moveTo(ox + x1 * s, oy + z1 * s); g.lineTo(ox + x2 * s, oy + z2 * s); } g.stroke();
  for (const it of world.items) {
    const done = (it.equip && save.found.includes(it.equip)) || (it.sim && save.found.includes('sim:' + it.sim));
    g.fillStyle = it.type === 'portal' ? '#6fd0ff' : it.sim && !done ? '#d39bff' : it === state.near ? '#fff' : done ? '#4dff8a' : '#ffb13d';
    const r = it.type === 'rack' || it.type === 'crac' ? 4 : 3; g.fillRect(ox + it.pos[0] * s - r, oy + it.pos[1] * s - r, r * 2, r * 2);
  }
  g.save(); g.translate(ox + player.pos.x * s, oy + player.pos.z * s); g.rotate(-player.yaw); g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(0, 7); g.lineTo(-5, -5); g.lineTo(5, -5); g.closePath(); g.fill(); g.restore();
}

// ------------------------------------------------------------------ 메인 루프
const clock = new THREE.Clock(); const mv = new THREE.Vector3(); const tagPos = new THREE.Vector3();
let mmT = 0, menuT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  if (state.screen === 'menu') {
    menuT += dt;
    player.update(dt, mv.set(0, 0, 0), false, []);
    if (!player.emote && Math.floor(menuT) % 7 === 0) player.play('wave', 2.5);
    const ar = innerWidth / innerHeight; camera.position.set((ar > 1.2 ? 0.2 : 1.3) + Math.sin(menuT * 0.15) * 0.25, 1.75, 18.0); camera.lookAt(ar > 1.2 ? -0.6 : 1.3, 1.9, 0);
    campus.traverse((o) => { if (o.userData.fan) o.rotation.y += dt * 3; });
  } else if (state.screen === 'play') {
    const blocked = modalOpen() || !!state.detail;
    let ix = 0, iz = 0;
    if (!blocked) {
      if (keys.has('w') || keys.has('arrowup')) iz -= 1; if (keys.has('s') || keys.has('arrowdown')) iz += 1;
      if (keys.has('a') || keys.has('arrowleft')) ix -= 1; if (keys.has('d') || keys.has('arrowright')) ix += 1;
      if (joy.on) { ix = joy.x; iz = joy.y; }
    }
    const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
    // 조작: W A S D 로 가고 싶은 방향을 누르면 아이코가 그쪽으로 몸을 돌리고, 시점도 자동으로 따라 돈다.
    // 방향키 조합이 바뀌는 순간, 지금 보고 있는 방향을 기준으로 목표 방향을 정한다(같은 키를 누르고 있는 동안은 직진).
    let fwd = 0;
    if (iz > 0.3) {
      // S: 돌아서지 않고 그대로 뒷걸음질한다(시점 유지). A/D 를 함께 누르면 뒷걸음질하며 방향을 조금씩 튼다.
      steer.key = null; fwd = -Math.min(1, len); player.yaw -= ix * 1.6 * dt;
    } else if (len > 0.3) {
      const dirKey = Math.round(Math.atan2(-ix, -iz) / (Math.PI / 4));
      if (dirKey !== steer.key) { steer.key = dirKey; steer.target = player.yaw + dirKey * (Math.PI / 4); }
      let dy = steer.target - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const step = Math.sign(dy) * Math.min(Math.abs(dy), 4.2 * dt);
      player.yaw += step;
      // 크게 도는 동안에는 제자리에서 돌고, 거의 다 돌면 걷기 시작한다
      fwd = Math.abs(dy) > 1.0 ? 0 : Math.min(1, len) * (1 - Math.abs(dy) * 0.5);
    } else steer.key = null;
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    mv.set(fx * fwd, 0, fz * fwd);
    const run = fwd > 0 && (keys.has('shift') || (joy.on && len > 0.92));
    player.update(dt, mv, run, world.colliders, true, fwd < 0 ? -1 : 1);
    if (state.detail) updateDetail(dt); else follow.update(dt, player, world.colliders);
    world.update(dt, time);
    state.near = world.nearest(player.pos);
    world.highlight(state.detail ? null : state.near, state.detail ? null : state.hover);
    // 이름표
    const tag = $('#tag');
    if (state.near && !state.detail) {
      tagPos.set(state.near.pos[0], state.near.height + 0.35, state.near.pos[1]).project(camera);
      const e = state.near.equip ? EQUIP[state.near.equip] : state.near.sim ? { icon: SIMS[state.near.sim].icon, name: SIMS[state.near.sim].title } : { icon: '🚪', name: { ko: '월드맵으로 나가기', en: 'Exit to World Map' } };
      $('#tag-icon').textContent = e.icon; $('#tag-name').textContent = L(e.name);
      tag.style.left = `${(tagPos.x + 1) / 2 * innerWidth}px`; tag.style.top = `${(1 - tagPos.y) / 2 * innerHeight}px`;
      tag.classList.toggle('hidden', tagPos.z > 1);
    } else tag.classList.add('hidden');
    if ((mmT += dt) > 0.1) { mmT = 0; drawMinimap(); }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ 시작
(async function boot() {
  applyLang(); applyQuality();
  try {
    await player.load('assets/aiko/aiko.glb');
    logoTex = await new THREE.TextureLoader().loadAsync('assets/aikorea-logo.png'); logoTex.colorSpace = THREE.SRGBColorSpace;
  } catch (e) { console.error(e); $('#ld-text').textContent = 'Load error: ' + e.message; return; }
  showMenu();
  const ld = $('#loading'); ld.style.opacity = 0; setTimeout(() => ld.classList.add('hidden'), 500);
  requestAnimationFrame(frame);
  // 검수용 훅 (자동 테스트에서 상태를 읽는다)
  window.__game = { state, player, follow, world, camera, save: () => save, startLevel, inspect, setMode, keys, openSim, enterDetail, exitDetail, LEVELS };
})();
