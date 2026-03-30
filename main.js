import { setupWebGL, createProgram, mat4 } from './webgl-utils.js';
import { ground, box1, box2 }              from './geometry.js';

const VS = `
  attribute vec3 a_Position;
  uniform mat4 u_MVP;
  void main() {
    gl_Position = u_MVP * vec4(a_Position, 1.0);
  }
`;

const FS = `
  precision mediump float;
  uniform vec4 u_Color;
  void main() {
    gl_FragColor = u_Color;
  }
`;

const VS_COL = `
  attribute vec3 a_Position;
  attribute vec3 a_Color;
  uniform mat4 u_MVP;
  varying vec3 v_Color;
  void main() {
    gl_Position = u_MVP * vec4(a_Position, 1.0);
    v_Color = a_Color;
  }
`;

const FS_COL = `
  precision mediump float;
  varying vec3 v_Color;
  void main() {
    gl_FragColor = vec4(v_Color, 1.0);
  }
`;

function uploadGeometry(gl, geo) {
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
  console.log('[upload] pos floats:', geo.pos.length, 'first 6:', Array.from(geo.pos.slice(0,6)));

  const colBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, geo.col, gl.STATIC_DRAW);
  console.log('[upload] col floats:', geo.col.length);

  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
  console.log('[upload] idx count:', geo.count, 'indices:', Array.from(geo.idx));

  return { posBuf, colBuf, idxBuf, count: geo.count };
}

function drawObject(gl, prog, buf, mvp) {
  const aPos = gl.getAttribLocation(prog, 'a_Position');
  const aCol = gl.getAttribLocation(prog, 'a_Color');
  const uMVP = gl.getUniformLocation(prog, 'u_MVP');

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.posBuf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  if (aCol >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.colBuf);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idxBuf);
  gl.uniformMatrix4fv(uMVP, false, mvp);
  gl.drawElements(gl.TRIANGLES, buf.count, gl.UNSIGNED_SHORT, 0);

  const err = gl.getError();
  if (err !== gl.NO_ERROR) console.error('[drawObject] gl.getError():', err);
}

function drawShadow(gl, prog, buf, mvp, alpha) {
  const aPos = gl.getAttribLocation(prog, 'a_Position');
  const uMVP = gl.getUniformLocation(prog, 'u_MVP');
  const uCol = gl.getUniformLocation(prog, 'u_Color');

  // вимикаємо a_Color якщо він був увімкнений попередньою програмою
  const aCol = gl.getAttribLocation(prog, 'a_Color');
  if (aCol >= 0) gl.disableVertexAttribArray(aCol);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.posBuf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idxBuf);
  gl.uniformMatrix4fv(uMVP, false, mvp);
  gl.uniform4f(uCol, 0.1, 0.1, 0.1, alpha);
  gl.drawElements(gl.TRIANGLES, buf.count, gl.UNSIGNED_SHORT, 0);

  const err = gl.getError();
  if (err !== gl.NO_ERROR) console.error('[drawShadow] gl.getError():', err);
}

// shadowProjection скоригована: WebGL mat4 — column-major,
// але multiply очікує рядки як стовпці (транспоновано).
// Перевіряємо і будуємо матрицю вручну в тому ж форматі що mat4.trans/scale
function shadowProjectionFixed(lx, ly, lz, groundY) {
  const d = ly - groundY;
  // column-major, той самий layout що і решта mat4 функцій у webgl-utils.js
  // Перевіряємо за lookAt/perspective — вони пишуть [col0row0, col0row1, ...]
  // shadow matrix (row-major form):
  // | d   0   0   0  |
  // |-lx  0  -lz  -1 |
  // | 0   0   d   0  |
  // |lx*g 0  lz*g ly |
  // В column-major (те що передається у Float32Array для gl):
  return new Float32Array([
    d,           -lx,          0,           lx * groundY,
    0,            0,           0,           0,
    0,           -lz,          d,           lz * groundY,
    0,           -1,           0,           ly,
  ]);
}

window.onload = function () {
  const gl = setupWebGL('main-canvas');
  if (!gl) { console.error('[init] WebGL не ініціалізовано'); return; }
  console.log('[init] WebGL OK, canvas:', gl.canvas.width, 'x', gl.canvas.height);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let progCol, progShadow;
  try {
    progCol    = createProgram(gl, VS_COL, FS_COL);
    progShadow = createProgram(gl, VS,     FS);
    console.log('[init] шейдери скомпільовано');
  } catch(e) {
    console.error('[init] помилка шейдерів:', e);
    return;
  }

  const groundBuf = uploadGeometry(gl, ground);
  const buf1      = uploadGeometry(gl, box1.geo);
  const buf2      = uploadGeometry(gl, box2.geo);

  const aspect = gl.canvas.width / gl.canvas.height;
  const P  = mat4.perspective(45, aspect, 0.1, 30);
  const V  = mat4.lookAt([0, 4.5, 6], [0, 0, 0], [0, 1, 0]);
  const PV = mat4.multiply(P, V);
  console.log('[init] PV matrix:', Array.from(PV).map(x => x.toFixed(3)));

  const groundMVP = mat4.multiply(PV, mat4.identity());
  const GROUND_Y  = 0.001;

  function getParams() {
    return {
      lightAngle:  parseFloat(document.getElementById('ctrl-light')?.value  ?? 0),
      shadowAlpha: parseFloat(document.getElementById('ctrl-alpha')?.value  ?? 0.45),
    };
  }

  let rotY = 0, last = null, frameCount = 0;

  function render(ts) {
    const dt = last !== null ? (ts - last) * 0.001 : 0;
    last = ts;
    rotY += dt * 0.3;
    frameCount++;

    const p  = getParams();
    const la = rotY * 0.6 + p.lightAngle;
    const lx = 4.0 * Math.cos(la);
    const ly = 5.0;
    const lz = 4.0 * Math.sin(la);

    if (frameCount <= 3) {
      console.log(`[frame ${frameCount}] light=(${lx.toFixed(2)}, ${ly}, ${lz.toFixed(2)}) alpha=${p.shadowAlpha}`);
    }

    const SP = shadowProjectionFixed(lx, ly, lz, GROUND_Y);
    const M1 = mat4.trans(box1.tx, box1.ty, box1.tz);
    const M2 = mat4.trans(box2.tx, box2.ty, box2.tz);

    if (frameCount === 1) {
      console.log('[frame 1] M1:', Array.from(M1).map(x=>x.toFixed(2)));
      const mvp1 = mat4.multiply(PV, M1);
      console.log('[frame 1] MVP box1:', Array.from(mvp1).map(x=>x.toFixed(3)));
    }

    gl.clearColor(0.165, 0.153, 0.145, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(progCol);
    drawObject(gl, progCol, groundBuf, groundMVP);

    gl.depthMask(false);
    gl.useProgram(progShadow);
    const shadow1MVP = mat4.multiply(PV, mat4.multiply(SP, M1));
    const shadow2MVP = mat4.multiply(PV, mat4.multiply(SP, M2));
    drawShadow(gl, progShadow, buf1, shadow1MVP, p.shadowAlpha);
    drawShadow(gl, progShadow, buf2, shadow2MVP, p.shadowAlpha);
    gl.depthMask(true);

    gl.useProgram(progCol);
    drawObject(gl, progCol, buf1, mat4.multiply(PV, M1));
    drawObject(gl, progCol, buf2, mat4.multiply(PV, M2));

    const el = document.getElementById('status-info');
    if (el) {
      el.textContent =
        `light(${lx.toFixed(1)}, ${ly.toFixed(1)}, ${lz.toFixed(1)})` +
        ` · shadow alpha: ${p.shadowAlpha.toFixed(2)}`;
    }

    updateLightMarker(lx, ly, lz, P, V);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  [['ctrl-alpha', 'val-alpha', v => parseFloat(v).toFixed(2)]].forEach(([sid, did, fmt]) => {
    const s = document.getElementById(sid);
    const d = document.getElementById(did);
    if (!s || !d) return;
    d.textContent = fmt(s.value);
    s.addEventListener('input', () => { d.textContent = fmt(s.value); });
  });
};

function updateLightMarker(lx, ly, lz, P, V) {
  const ov = document.getElementById('light-overlay');
  if (!ov) return;
  const ctx = ov.getContext('2d');
  ctx.clearRect(0, 0, ov.width, ov.height);

  const PV   = multiplyJS(P, V);
  const clip = transformPoint(PV, [lx, ly, lz]);
  if (clip[3] <= 0) return;

  const nx = (clip[0] / clip[3]) * 0.5 + 0.5;
  const ny = 1 - ((clip[1] / clip[3]) * 0.5 + 0.5);
  const px = nx * ov.width;
  const py = ny * ov.height;

  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '11px DM Mono, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('light', px + 12, py + 4);
}

function multiplyJS(a, b) {
  const o = new Array(16).fill(0);
  for (let r=0;r<4;r++)
    for (let c=0;c<4;c++)
      for (let k=0;k<4;k++) o[r+c*4] += a[r+k*4]*b[k+c*4];
  return o;
}

function transformPoint(m, p) {
  const [x,y,z] = p;
  return [
    m[0]*x+m[4]*y+m[8]*z+m[12],
    m[1]*x+m[5]*y+m[9]*z+m[13],
    m[2]*x+m[6]*y+m[10]*z+m[14],
    m[3]*x+m[7]*y+m[11]*z+m[15],
  ];
}