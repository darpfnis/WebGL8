// main.js -- ЛР №8: проекцiйнi тiнi
//
// Алгоритм двох проходiв:
//   1. Малюємо всi об'єкти звичайним шейдером
//   2. Малюємо тiнi - та сама геометрiя, MVP = PV * shadowProj * M
//      depthMask(false) - не пишемо в depth buffer пiд час тiней
//      blending - напiвпрозорий темний колiр (завдання 4)

import { setupWebGL, createProgram, mat4 } from './webgl-utils.js';
import { GROUND, BOX1, BOX2 }              from './geometry.js';

// шейдер об'єктiв - колiр з атрибутного буфера
const VS_SCENE = `
  attribute vec3 a_Position;
  attribute vec3 a_Color;
  uniform   mat4 u_MVP;
  varying   vec3 v_Color;
  void main() {
    gl_Position = u_MVP * vec4(a_Position, 1.0);
    v_Color = a_Color;
  }
`;
const FS_SCENE = `
  precision mediump float;
  varying vec3 v_Color;
  void main() {
    gl_FragColor = vec4(v_Color, 1.0);
  }
`;

// шейдер тiней - фiксований напiвпрозорий темний колiр
const VS_SHADOW = `
  attribute vec3 a_Position;
  uniform   mat4 u_MVP;
  void main() {
    gl_Position = u_MVP * vec4(a_Position, 1.0);
  }
`;
const FS_SHADOW = `
  precision mediump float;
  uniform float u_Alpha;
  void main() {
    gl_FragColor = vec4(0.05, 0.05, 0.05, u_Alpha);
  }
`;

function upload(gl, mesh) {
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

  const colBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);

  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  return { posBuf, colBuf, idxBuf, count: mesh.count };
}

function drawScene(gl, locs, buf, mvp) {
  gl.uniformMatrix4fv(locs.uMVP, false, mvp);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.posBuf);
  gl.enableVertexAttribArray(locs.aPos);
  gl.vertexAttribPointer(locs.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.colBuf);
  gl.enableVertexAttribArray(locs.aCol);
  gl.vertexAttribPointer(locs.aCol, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idxBuf);
  gl.drawElements(gl.TRIANGLES, buf.count, gl.UNSIGNED_SHORT, 0);
}

function drawShadow(gl, locs, buf, mvp, alpha) {
  gl.uniformMatrix4fv(locs.uMVP, false, mvp);
  gl.uniform1f(locs.uAlpha, alpha);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf.posBuf);
  gl.enableVertexAttribArray(locs.aPos);
  gl.vertexAttribPointer(locs.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idxBuf);
  gl.drawElements(gl.TRIANGLES, buf.count, gl.UNSIGNED_SHORT, 0);
}

window.onload = function () {
  const gl = setupWebGL('main-canvas');
  if (!gl) return;

  console.log('[lab8] WebGL ok');

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const progScene  = createProgram(gl, VS_SCENE,  FS_SCENE);
  const progShadow = createProgram(gl, VS_SHADOW, FS_SHADOW);

  console.log('[lab8] programs compiled');

  const sceneLocs = {
    uMVP: gl.getUniformLocation(progScene,  'u_MVP'),
    aPos: gl.getAttribLocation(progScene,   'a_Position'),
    aCol: gl.getAttribLocation(progScene,   'a_Color'),
  };
  const shadowLocs = {
    uMVP:   gl.getUniformLocation(progShadow, 'u_MVP'),
    uAlpha: gl.getUniformLocation(progShadow, 'u_Alpha'),
    aPos:   gl.getAttribLocation(progShadow,  'a_Position'),
  };

  console.log('[lab8] scene locs aPos=' + sceneLocs.aPos + ' aCol=' + sceneLocs.aCol);
  console.log('[lab8] shadow locs aPos=' + shadowLocs.aPos);

  const groundBuf = upload(gl, GROUND);
  const box1Buf   = upload(gl, BOX1.mesh);
  const box2Buf   = upload(gl, BOX2.mesh);

  console.log('[lab8] buffers ok, box1 count=' + BOX1.mesh.count + ' box2 count=' + BOX2.mesh.count);

  const aspect = gl.canvas.width / gl.canvas.height;
  const P  = mat4.perspective(45, aspect, 0.1, 30);
  const V  = mat4.lookAt([0, 4.5, 6], [0, 0, 0], [0, 1, 0]);
  const PV = mat4.multiply(P, V);

  const M1 = mat4.trans(BOX1.x, BOX1.y, BOX1.z);
  const M2 = mat4.trans(BOX2.x, BOX2.y, BOX2.z);

  // y=0.001 щоб уникнути z-fighting мiж тiнню i землею
  const GROUND_Y = 0.001;

  function getAlpha() {
    return parseFloat(document.getElementById('ctrl-alpha')?.value ?? 0.5);
  }

  // плавна тiнь через кiлька шарiв з рiзною прозорiстю
  function drawSoftShadow(gl, locs, buf, baseMVP, alpha) {
    // малюємо 3 шари зi зменшеним alpha - iмiтує м'який край
    const layers = [
      { scale: 1.00, a: alpha },
      { scale: 1.15, a: alpha * 0.35 },
      { scale: 1.30, a: alpha * 0.12 },
    ];
    for (const layer of layers) {
      const S = mat4.scale(layer.scale, 1.0, layer.scale);
      const mvp = mat4.multiply(baseMVP, S);
      drawShadow(gl, locs, buf, mvp, layer.a);
    }
  }

  let lightAngle = 0, last = null, frames = 0;

  function render(ts) {
    const dt = last !== null ? (ts - last) * 0.001 : 0;
    last = ts;
    frames++;

    const moving = document.getElementById('ctrl-move')?.checked ?? true;
    if (moving) lightAngle += dt * 0.7;

    const lx = 4.0 * Math.cos(lightAngle);
    const ly = 6.0;
    const lz = 4.0 * Math.sin(lightAngle);
    const alpha = getAlpha();

    const SP   = mat4.shadowProjection(lx, ly, lz, GROUND_Y);
    const sh1  = mat4.multiply(PV, mat4.multiply(SP, M1));
    const sh2  = mat4.multiply(PV, mat4.multiply(SP, M2));
    const mvp1 = mat4.multiply(PV, M1);
    const mvp2 = mat4.multiply(PV, M2);

    gl.clearColor(0.165, 0.153, 0.145, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // крок 1: малюємо землю i фiгури
    gl.useProgram(progScene);
    drawScene(gl, sceneLocs, groundBuf, PV);
    drawScene(gl, sceneLocs, box1Buf,   mvp1);
    drawScene(gl, sceneLocs, box2Buf,   mvp2);

    // крок 2: тiнi поверх землi
    // depthMask(false) - завдання 3: depth test увiмкнено для перевiрки
    // але запис вимкнено щоб тiнi не закривали однi одних
    gl.useProgram(progShadow);
    gl.depthMask(false);
    drawSoftShadow(gl, shadowLocs, box1Buf, sh1, alpha);
    drawSoftShadow(gl, shadowLocs, box2Buf, sh2, alpha);
    gl.depthMask(true);

    if (frames === 1) {
      console.log('[lab8] first frame ok, gl.getError()=' + gl.getError());
    }

    const el = document.getElementById('status-info');
    if (el) {
      el.textContent =
        `light(${lx.toFixed(1)}, ${ly.toFixed(1)}, ${lz.toFixed(1)})` +
        `  alpha: ${alpha.toFixed(2)}  frame: ${frames}`;
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  const slider = document.getElementById('ctrl-alpha');
  const label  = document.getElementById('val-alpha');
  if (slider && label) {
    label.textContent = parseFloat(slider.value).toFixed(2);
    slider.addEventListener('input', () => {
      label.textContent = parseFloat(slider.value).toFixed(2);
    });
  }
};
