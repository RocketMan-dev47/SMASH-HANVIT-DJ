import * as THREE from 'three';

const ease = (u) => u * u * (3 - 2 * u);
const KEY = 'smash-follow';

// 무기를 따라가는 시네마틱 카메라. shot(t, dt)가 {pos, look}을 돌려주는 동안 따라가고,
// null을 돌려주면 원래 보던 자리로 부드럽게 돌아갑니다. 화면을 누르면 건너뛰어요.
export class Director {
  constructor(camera, controls) {
    this.cam = camera;
    this.controls = controls;
    this.look = new THREE.Vector3();
    this.shot = null;
    this.ret = null;
    try { this.enabled = localStorage.getItem(KEY) !== 'off'; } catch { this.enabled = true; }
  }

  get busy() { return !!(this.shot || this.ret); }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* 무시 */ }
    if (!on) this.skip();
  }

  play(shot) {
    if (!this.enabled) return;
    if (!this.shot && !this.ret) {
      this.saved = { pos: this.cam.position.clone(), target: this.controls.target.clone() };
      this.look.copy(this.controls.target);
    }
    this.ret = null;
    this.shot = shot;
    this.lastKey = null;
    this.t = 0;
    this.controls.enabled = false;
  }

  skip() {
    if (this.shot) { this.shot = null; this.startReturn(); }
  }

  startReturn() {
    // 아주 먼 곳(발사장)에서 돌아올 때는 바로 넘겨요.
    if (this.cam.position.distanceTo(this.saved.pos) > 700) {
      this.cam.position.copy(this.saved.pos);
      this.look.copy(this.saved.target);
    }
    this.ret = { t: 0, fromPos: this.cam.position.clone(), fromLook: this.look.clone() };
  }

  // 카메라를 움직였으면 true (그때는 OrbitControls를 건너뜁니다)
  update(dt) {
    if (this.shot) {
      this.t += dt;
      const r = this.shot(this.t, dt);
      if (!r) {
        this.shot = null;
        this.startReturn();
      } else {
        // key가 바뀌면서 cut이면 장면을 바로 넘겨요(멀리 떨어진 발사장 등).
        if (r.cut && r.key !== this.lastKey) { this.cam.position.copy(r.pos); this.look.copy(r.look); }
        this.lastKey = r.key;
        this.cam.position.lerp(r.pos, 1 - Math.exp(-dt * (r.snap ?? 4)));
        this.look.lerp(r.look, 1 - Math.exp(-dt * (r.lookSnap ?? 7)));
        this.cam.lookAt(this.look);
        return true;
      }
    }
    if (this.ret) {
      this.ret.t += dt / 1.1;
      const u = ease(Math.min(1, this.ret.t));
      this.cam.position.lerpVectors(this.ret.fromPos, this.saved.pos, u);
      this.look.lerpVectors(this.ret.fromLook, this.saved.target, u);
      this.cam.lookAt(this.look);
      if (u >= 1) {
        this.ret = null;
        this.controls.target.copy(this.saved.target);
        this.controls.enabled = true;
        this.controls.update();
      }
      return true;
    }
    return false;
  }
}

// 카메라가 있던 쪽(수평)을 가리키는 단위 벡터. 연출이 플레이어가 보던 방향에서 크게 벗어나지 않게 해요.
export function sideFrom(camera, P) {
  const v = new THREE.Vector3(camera.position.x - P.x, 0, camera.position.z - P.z);
  if (v.lengthSq() < 1) v.set(0, 0, 1);
  return v.normalize();
}
