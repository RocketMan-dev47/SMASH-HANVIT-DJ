import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

// 배치 도우미: 주소 끝에 ?edit 를 붙이면 켜져요.
// 땅을 눌러 모서리를 찍고 '건물로 저장'을 누르면 config.json에 붙여 넣을 내용이 만들어져요.
export class Editor {
  constructor(world, cfg) {
    this.w = world;
    this.cfg = cfg;
    this.pts = [];
    this.buildings = [...(cfg.extraBuildings || [])];
    this.flag = cfg.flag ? { ...cfg.flag } : null;
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.dotGeo = new THREE.SphereGeometry(0.7, 12, 8);
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0xffc94a, depthTest: false });
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xffc94a, depthTest: false });
    $('editor').hidden = false;
    $('ed-save').addEventListener('click', () => this.save());
    $('ed-undo').addEventListener('click', () => { this.pts.pop(); this.draw(); });
    $('ed-clear').addEventListener('click', () => { this.pts = []; this.draw(); });
    $('ed-flag').addEventListener('click', () => this.setFlag());
    $('ed-copy').addEventListener('click', () => this.copy());
    this.out();
  }

  add(P) {
    this.pts.push([Math.round(P.x * 10) / 10, Math.round(P.z * 10) / 10]);
    this.draw();
  }

  draw() {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    const T = this.w.terrain;
    const v = this.pts.map(([x, z]) => new THREE.Vector3(x, T.heightAt(x, z) + 0.6, z));
    for (const p of v) {
      const d = new THREE.Mesh(this.dotGeo, this.dotMat);
      d.position.copy(p);
      d.renderOrder = 20;
      this.group.add(d);
    }
    if (v.length >= 2) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v.length >= 3 ? [...v, v[0]] : v), this.lineMat);
      line.renderOrder = 20;
      this.group.add(line);
    }
    $('ed-count').textContent = `찍은 점 ${this.pts.length}개`;
  }

  save() {
    if (this.pts.length < 3) { this.w.ui.toast('점이 3개 이상 필요해요', '건물 모서리를 차례로 눌러 주세요'); return; }
    const name = $('ed-name').value.trim() || `건물 ${this.buildings.length + 1}`;
    const levels = Math.max(1, Math.min(30, Number($('ed-levels').value) || 3));
    const style = $('ed-style').value;
    this.buildings.push({ name, levels, style, poly: this.pts });
    this.pts = [];
    this.draw();
    this.out();
    this.w.ui.toast(`${name} 저장`, '아래 내용을 config.json에 붙여 넣고 새로고침하면 생겨요');
  }

  setFlag() {
    const p = this.pts[this.pts.length - 1];
    if (!p) { this.w.ui.toast('먼저 땅을 한 번 눌러 주세요', '그 자리에 국기게양대가 서요'); return; }
    this.flag = { at: p, height: 35, size: [8, 5.3] };
    this.pts.pop();
    this.draw();
    this.out();
    this.w.ui.toast('국기게양대 위치 저장', '높이 35 m, 태극기 8 × 5.3 m');
  }

  out() {
    const parts = [];
    if (this.buildings.length) {
      parts.push(`"extraBuildings": [\n${this.buildings.map((b) => `    ${JSON.stringify(b)}`).join(',\n')}\n  ]`);
    }
    if (this.flag) parts.push(`"flag": ${JSON.stringify(this.flag)}`);
    $('ed-out').value = parts.length ? `  ${parts.join(',\n  ')},` : '';
  }

  copy() {
    const t = $('ed-out');
    t.select();
    try { navigator.clipboard.writeText(t.value); } catch { document.execCommand('copy'); }
    this.w.ui.toast('복사했어요', 'config.json의 "buildings" 바로 위에 붙여 넣으세요');
  }
}
