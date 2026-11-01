// data/campus.json이 아직 없을 때 보여 줄 연습용 가상 학교(산 중턱 학교).
function rect(cx, cz, w, d, a = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [
    +(cx + x * c - z * s).toFixed(2), +(cz + x * s + z * c).toFixed(2),
  ]);
}

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function makeDemoCampus() {
  const x0 = -170, z0 = -150, w = 340, d = 300, sp = 4;
  const nx = w / sp + 1, nz = d / sp + 1;
  const h = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * sp, z = z0 + j * sp;
      const v = 20 * smooth(-10, -150, z)
        + 7 * Math.exp(-((x + 130) ** 2 + (z + 40) ** 2) / (2 * 45 ** 2))
        + 2.2 * Math.sin(x * 0.031) * Math.cos(z * 0.027);
      h.push(+(v + 3).toFixed(2));
    }
  }
  const mainWing = [[-60, -92], [40, -92], [40, -76], [-44, -76], [-44, -48], [-60, -48]];
  return {
    version: 1,
    name: '연습용 가상 학교',
    demo: true,
    boundary: [[-115, -105], [112, -105], [118, 88], [-112, 92]],
    buildings: [
      { id: 'demo-main', name: '본관', levels: 5, poly: mainWing },
      { id: 'demo-culture', name: '문화관', levels: 3, poly: rect(62, -52, 34, 22, 0.08) },
      { id: 'demo-dorm', name: '기숙사', levels: 6, poly: rect(-88, -20, 18, 46, 0) },
      { id: 'demo-cafe', name: '식당', levels: 2, poly: rect(78, 8, 30, 20, 0.08) },
      { id: 'demo-gym', name: '체육관', levels: 3, poly: rect(-80, 52, 34, 28, 0) },
      { id: 'demo-annex', name: '별관', levels: 4, poly: rect(8, -45, 36, 14, 0) },
    ],
    roads: [
      { kind: 'tertiary', w: 8, pts: [[30, 150], [26, 120], [14, 98], [10, 84]] },
      { kind: 'service', w: 5, pts: [[10, 84], [-40, 84], [-58, 74], [-58, 20], [-60, -10], [-70, -36]] },
      { kind: 'service', w: 5, pts: [[10, 84], [60, 82], [92, 60], [96, 30], [96, -20], [84, -40]] },
      { kind: 'footway', w: 2.5, pts: [[-40, 0], [-10, -6], [20, -10], [55, -10], [84, -40]] },
      { kind: 'footway', w: 2.5, pts: [[-10, -6], [-12, -30], [-30, -46]] },
      { kind: 'tertiary', w: 8, pts: [[-170, 125], [-60, 118], [30, 150]] },
    ],
    areas: [
      { kind: 'pitch', surface: 'artificial_turf', poly: [[-36, 8], [52, 8], [52, 70], [-36, 70]] },
      { kind: 'forest', poly: [[-170, -150], [170, -150], [170, -112], [-170, -116]] },
      { kind: 'forest', poly: [[-170, -116], [-122, -112], [-124, 60], [-170, 80]] },
      { kind: 'parking', poly: [[70, 48], [100, 48], [100, 72], [70, 72]] },
    ],
    trees: [],
    terrain: { x0, z0, w, d, nx, nz, h },
  };
}
