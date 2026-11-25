// 아이코 캐릭터: 모델 불러오기, 이동, 충돌, 동작(코드로 구동하는 관절 애니메이션)
// 모델 교체 방법: assets/aiko/aiko.glb 를 같은 노드 이름(Hips, Torso, Head, ArmL ...)을 가진 GLB 로 바꾸면 된다.
// 뼈대 애니메이션이 들어 있는 GLB 로 바꿀 때는 README 의 "아이코 모델 교체" 절을 참고.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const JOINTS = ['Hips', 'Torso', 'Head', 'EyeL', 'EyeR', 'ArmL', 'ForearmL', 'ArmR', 'ForearmR', 'LegL', 'ShinL', 'LegR', 'ShinR'];
const SCALE = 1.25;                 // 아이코 키 약 1.25 m
export const PLAYER_RADIUS = 0.36;

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.pos = this.group.position;
    this.yaw = 0;
    this.speed = 0;
    this.phase = 0;
    this.time = 0;
    this.emote = null; this.emoteT = 0;
    this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    this.j = {}; this.rest = {}; this.cur = {};
    this.restHipY = 0;
  }

  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.scale.setScalar(SCALE);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) { m.map.anisotropy = 4; } if (m.transparent) { m.depthWrite = false; m.alphaTest = 0.02; } });
      }
    });
    for (const n of JOINTS) {
      const o = model.getObjectByName(n);
      if (!o) continue;
      this.j[n] = o; this.rest[n] = o.quaternion.clone(); this.cur[n] = new THREE.Vector3();
    }
    if (this.j.Hips) this.restHipY = this.j.Hips.position.y;
    this.group.add(model);
    this.model = model;
  }

  play(name, dur = 1.8) { this.emote = name; this.emoteT = dur; }

  /** move: 입력 방향(카메라 기준으로 이미 변환된 월드 xz 벡터, 길이 0~1), run: 달리기 */
  update(dt, move, run, colliders, lockYaw = false, sign = 1) {
    if (Math.hypot(move.x, move.z) > 0.05) this.animSign = sign;
    this.time += dt;
    const len = Math.hypot(move.x, move.z);
    const target = len > 0.05 ? (sign < 0 ? 2.2 : run ? 6.2 : 3.3) * Math.min(1, len) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (len > 0.05 && this.emote) this.emote = null;
    if (len > 0.05 && !lockYaw) {
      const want = Math.atan2(move.x, move.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 11);
      if (this.emote) { this.emote = null; }
    }
    if (this.speed > 0.02) {
      // 키를 뗀 뒤 남은 속도는 직전에 가던 방향(전진/후진)으로 흐른다
      if (len > 0.05) this.lastSign = sign;
      const k = this.lastSign || 1;
      const nx = len > 0.05 ? move.x / len : Math.sin(this.yaw) * k;
      const nz = len > 0.05 ? move.z / len : Math.cos(this.yaw) * k;
      this.pos.x += nx * this.speed * dt;
      this.pos.z += nz * this.speed * dt;
      resolve(this.pos, PLAYER_RADIUS, colliders);
    }
    this.group.rotation.y = this.yaw;
    this.animate(dt);
  }

  animate(dt) {
    const s = this.speed, t = this.time;
    const T = {}; for (const n of JOINTS) T[n] = [0, 0, 0];
    let bob = 0;
    const moving = s > 0.25;
    if (moving) {
      const run = THREE.MathUtils.clamp((s - 3.3) / 2.9, 0, 1);
      this.phase += dt * (6.5 + s * 1.5) * (this.animSign || 1);
      const p = this.phase, A = 0.55 + run * 0.35;
      T.LegL[0] = -Math.sin(p) * A; T.LegR[0] = Math.sin(p) * A;
      T.ShinL[0] = Math.max(0, Math.cos(p)) * (0.7 + run * 0.5); T.ShinR[0] = Math.max(0, -Math.cos(p)) * (0.7 + run * 0.5);
      T.ArmL[0] = Math.sin(p) * (0.6 + run * 0.5); T.ArmR[0] = -Math.sin(p) * (0.6 + run * 0.5);
      T.ForearmL[0] = -0.35 - run * 0.7; T.ForearmR[0] = -0.35 - run * 0.7;
      T.Torso[0] = 0.06 + run * 0.16; T.Torso[1] = Math.sin(p) * 0.06;
      T.Head[0] = -0.03 - run * 0.08; T.Head[2] = Math.sin(p) * 0.03;
      bob = Math.abs(Math.sin(p)) * (0.02 + run * 0.025);
    } else {
      // 대기: 숨쉬기, 고개 살짝, 팔 흔들림
      bob = Math.sin(t * 2.0) * 0.006;
      T.Head[2] = Math.sin(t * 0.9) * 0.035; T.Head[1] = Math.sin(t * 0.5) * 0.08;
      T.ArmL[2] = Math.sin(t * 2.0) * 0.03; T.ArmR[2] = -Math.sin(t * 2.0) * 0.03;
      T.Torso[0] = Math.sin(t * 2.0) * 0.012;
    }
    if (this.emote && !moving) {
      this.emoteT -= dt;
      const e = this.emote;
      if (e === 'wave') { T.ArmR[2] = -2.5; T.ForearmR[2] = -0.5 + Math.sin(t * 11) * 0.45; T.Head[2] = 0.12; }
      else if (e === 'observe') { T.Torso[0] = 0.22; T.Head[0] = 0.1; T.ArmR[0] = -1.0; T.ForearmR[0] = -1.1; T.Head[1] = Math.sin(t * 2) * 0.12; }
      else if (e === 'surprise') { T.ArmL[2] = 2.3; T.ArmR[2] = -2.3; T.Torso[0] = -0.12; T.Head[0] = -0.15; bob = Math.max(0, Math.sin((1.8 - this.emoteT) * 9)) * 0.12; }
      else if (e === 'explain') { T.ArmL[0] = -1.2; T.ArmL[2] = 0.3; T.ForearmL[0] = -0.5 + Math.sin(t * 5) * 0.25; T.Head[1] = Math.sin(t * 2.5) * 0.1; T.Head[2] = Math.sin(t * 3) * 0.05; }
      else if (e === 'cheer') { T.ArmL[2] = 2.7; T.ArmR[2] = -2.7; T.ForearmL[2] = Math.sin(t * 12) * 0.3; T.ForearmR[2] = -Math.sin(t * 12) * 0.3; bob = Math.abs(Math.sin(t * 9)) * 0.14; T.Head[0] = -0.12; }
      if (this.emoteT <= 0) this.emote = null;
    }
    const k = Math.min(1, dt * 14);
    for (const n of JOINTS) {
      const o = this.j[n]; if (!o) continue;
      const c = this.cur[n];
      c.x += (T[n][0] - c.x) * k; c.y += (T[n][1] - c.y) * k; c.z += (T[n][2] - c.z) * k;
      E.set(c.x, c.y, c.z, 'XYZ'); Q.setFromEuler(E);
      o.quaternion.copy(this.rest[n]).multiply(Q);
    }
    if (this.j.Hips) this.j.Hips.position.y = this.restHipY + bob;
    // 눈 깜빡임
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.14; this.blinkT = 2.2 + Math.random() * 3.5; }
    if (this.blink > 0) this.blink -= dt;
    const sy = this.blink > 0 ? 0.12 : 1;
    for (const n of ['EyeL', 'EyeR']) if (this.j[n]) this.j[n].scale.y += (sy - this.j[n].scale.y) * Math.min(1, dt * 40);
  }
}

const E = new THREE.Euler(), Q = new THREE.Quaternion();

/** 원(캐릭터)과 축 정렬 상자(벽·설비)의 충돌을 풀어 준다. colliders: {minX,maxX,minZ,maxZ} */
export function resolve(pos, r, colliders) {
  for (let it = 0; it < 3; it++) {
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2); pos.x = cx + dx / d * r; pos.z = cz + dz / d * r;
      } else {
        // 상자 안쪽에 들어온 경우: 가장 가까운 면으로 밀어낸다
        const l = pos.x - c.minX, rr = c.maxX - pos.x, b = pos.z - c.minZ, f = c.maxZ - pos.z;
        const m = Math.min(l, rr, b, f);
        if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r; else if (m === b) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
      }
    }
    if (!hit) break;
  }
}

const TILT0 = 0.17;   // 기본 시선 각도(가장 아래)
/** 어깨 너머 3인칭 카메라. 항상 아이코 바로 뒤에 붙어 있어 앞모습은 보이지 않는다.
 *  아이코는 화면 가로 정중앙, 아래쪽 가장자리에 붙어 보인다(1인칭 느낌의 3인칭). */
export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.dist = 3.1; this.tilt = TILT0; this.curRatio = 1;
    this.dragging = false;
    this.focus = new THREE.Vector3(); this.yaw = 0;
  }
  /** 화면 드래그: 좌우는 아이코가 몸을 돌리고(카메라는 따라온다), 상하는 시선 높이 */
  rotate(dx, dy, player) {
    player.yaw -= dx * 0.005;
    // 시선은 기본 높이보다 아래로 내려가지 않는다(위로만 올릴 수 있다)
    this.tilt = THREE.MathUtils.clamp(this.tilt + dy * 0.003, -0.14, TILT0);
  }
  zoom(f) { this.dist = THREE.MathUtils.clamp(this.dist * f, 2.0, 4.6); }
  snapBehind(player) { this.yaw = player.yaw; this.focus.copy(player.pos); this.curRatio = 1; }

  update(dt, player, colliders) {
    // 카메라 방향은 아이코가 보는 방향과 항상 같다
    let d = player.yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 16);
    this.focus.lerp(player.pos, Math.min(1, dt * 16));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const pivot = V3.set(this.focus.x, 1.2, this.focus.z);
    const camH = 1.72 + (this.dist - 2.7) * 0.42;
    const want = V4.set(this.focus.x - fx * this.dist, camH, this.focus.z - fz * this.dist);
    const ray = V5.copy(want).sub(pivot); const rl = ray.length(); ray.divideScalar(rl);
    const free = THREE.MathUtils.clamp(rayBoxes(pivot, ray, rl, colliders), 0.5, 1);
    this.curRatio += (free - this.curRatio) * Math.min(1, dt * (free < this.curRatio ? 18 : 4));
    const r = this.curRatio;
    // 설비에 막히면 가까이 붙되 위로 올라가서, 머리 속으로 파고들지 않게 한다
    this.camera.position.copy(pivot).addScaledVector(ray, rl * r);
    this.camera.position.y += (1 - r) * 1.5;
    const down = this.tilt + (1 - r) * 0.55;
    const c = this.camera.position;
    this.camera.lookAt(c.x + fx * 10, c.y - Math.tan(down) * 10, c.z + fz * 10);
  }
}
const V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), V5 = new THREE.Vector3();

/** 광선이 상자에 막히기 전까지 갈 수 있는 비율(0~1) */
function rayBoxes(o, d, len, colliders) {
  let best = 1;
  for (const c of colliders) {
    if (c.noCam) continue;
    const y0 = c.y0 ?? 0, y1 = c.y1 ?? 3;
    let tmin = 0, tmax = len, ok = true;
    for (const [oo, dd, a, b] of [[o.x, d.x, c.minX - 0.15, c.maxX + 0.15], [o.y, d.y, y0, y1 + 0.15], [o.z, d.z, c.minZ - 0.15, c.maxZ + 0.15]]) {
      if (Math.abs(dd) < 1e-6) { if (oo < a || oo > b) { ok = false; break; } continue; }
      let t1 = (a - oo) / dd, t2 = (b - oo) / dd; if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) { ok = false; break; }
    }
    if (ok && tmin > 0) best = Math.min(best, tmin / len);
    else if (ok && tmin <= 0) best = Math.min(best, 0.25);
  }
  return best;
}
