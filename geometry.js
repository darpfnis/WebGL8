// geometry.js - геометрiя сцени

// плаский прямокутник в площинi XZ на висотi y
// повертає { positions, colors, indices, count }
export function makeGround(w, d, y, color) {
  const hw = w / 2, hd = d / 2;
  const [r, g, b] = color;
  return {
    positions: new Float32Array([
      -hw, y, -hd,
       hw, y, -hd,
       hw, y,  hd,
      -hw, y,  hd,
    ]),
    colors: new Float32Array([
      r,g,b,  r,g,b,  r,g,b,  r,g,b,
    ]),
    indices: new Uint16Array([0,1,2, 0,2,3]),
    count: 6,
  };
}

// куб заданого розмiру -- кожна грань окремi вершини з нормальним затiненням
export function makeBox(w, h, d, color) {
  const [r, g, b] = color;
  const hw = w/2, hh = h/2, hd = d/2;

  // 8 унiкальних кутiв
  const c = [
    [-hw,-hh, hd], [ hw,-hh, hd], [ hw, hh, hd], [-hw, hh, hd],
    [-hw,-hh,-hd], [ hw,-hh,-hd], [ hw, hh,-hd], [-hw, hh,-hd],
  ];

  // 6 граней: [i0,i1,i2,i3, shade]
  const faces = [
    [0,1,2,3, 1.00],  // front
    [5,4,7,6, 0.65],  // back
    [3,2,6,7, 0.90],  // top
    [4,5,1,0, 0.70],  // bottom
    [4,0,3,7, 0.78],  // left
    [1,5,6,2, 0.85],  // right
  ];

  const pos = [], col = [], idx = [];
  let base = 0;

  for (const [a,b2,cc,d2, s] of faces) {
    pos.push(...c[a], ...c[b2], ...c[cc], ...c[d2]);
    col.push(
      r*s,g*s,b*s, r*s,g*s,b*s,
      r*s,g*s,b*s, r*s,g*s,b*s,
    );
    idx.push(base, base+1, base+2, base, base+2, base+3);
    base += 4;
  }

  return {
    positions: new Float32Array(pos),
    colors:    new Float32Array(col),
    indices:   new Uint16Array(idx),
    count:     idx.length,
  };
}

// земля - велика м'ятна платформа
export const GROUND = makeGround(6, 5, 0, [0.718, 0.898, 0.792]);

// перший прямокутник - рожевий
export const BOX1 = {
  mesh: makeBox(0.7, 1.2, 0.7, [0.957, 0.761, 0.761]),
  x: -1.0,
  y:  0.6,  // половина висоти 1.2
  z:  0.3,
};

// другий прямокутник - блакитний
export const BOX2 = {
  mesh: makeBox(0.5, 0.9, 0.5, [0.690, 0.831, 0.957]),
  x:  0.9,
  y:  0.45, // половина висоти 0.9
  z: -0.4,
};
