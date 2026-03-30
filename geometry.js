// geometry.js -- геометрiя сцени: земля i два прямокутники

// будує плаский прямокутник в площинi XZ на висотi y
function makeRect(w, h, y, color) {
  const hw = w / 2, hh = h / 2;
  const [r, g, b] = color;
  const pos = new Float32Array([
    -hw, y, -hh,
     hw, y, -hh,
     hw, y,  hh,
    -hw, y,  hh,
  ]);
  const col = new Float32Array([
    r,g,b, r,g,b, r,g,b, r,g,b,
  ]);
  const idx = new Uint16Array([0,1,2, 0,2,3]);
  return { pos, col, idx, count: 6 };
}

// будує вертикальний прямокутник (стовп) -- куб витягнутий по Y
function makeBox(w, h, d, color) {
  const [r,g,b] = color;
  const hw=w/2, hh=h/2, hd=d/2;
  const verts = [
    [-hw,-hh, hd],[ hw,-hh, hd],[ hw, hh, hd],[-hw, hh, hd],
    [-hw,-hh,-hd],[ hw,-hh,-hd],[ hw, hh,-hd],[-hw, hh,-hd],
  ];
  const faces = [
    [0,1,2,0,2,3],
    [5,4,7,5,7,6],
    [3,2,6,3,6,7],
    [4,5,1,4,1,0],
    [4,0,3,4,3,7],
    [1,5,6,1,6,2],
  ];
  // трохи тiнюємо бiчнi гранi для об'єму
  const shades = [1.0, 0.65, 0.85, 0.70, 0.75, 0.80];
  const pos=[], col=[], idx=[];
  let base = 0;
  faces.forEach((f, fi) => {
    const s = shades[fi];
    f.forEach(i => {
      pos.push(...verts[i]);
      col.push(r*s, g*s, b*s);
    });
    idx.push(base, base+1, base+2, base+3, base+4, base+5);
    base += 6;
  });
  return {
    pos: new Float32Array(pos),
    col: new Float32Array(col),
    idx: new Uint16Array(idx),
    count: idx.length,
  };
}

// земля: великий плаский прямокутник
export const ground = makeRect(6, 5, 0, [0.718, 0.898, 0.792]);

// два меншi прямокутники на землi (стовпи)
export const box1 = {
  geo: makeBox(0.7, 1.2, 0.7, [0.957, 0.761, 0.761]),
  tx: -1.0, ty: 0.6, tz: 0.3,
};

export const box2 = {
  geo: makeBox(0.5, 0.9, 0.5, [0.690, 0.831, 0.957]),
  tx:  0.9, ty: 0.45, tz: -0.4,
};