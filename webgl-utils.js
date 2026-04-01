// webgl-utils.js

export function setupWebGL(id) {
  const canvas = document.getElementById(id);
  const gl = canvas.getContext('webgl');
  if (!gl) { alert('WebGL не пiдтримується'); return null; }
  gl.viewport(0, 0, canvas.width, canvas.height);
  return gl;
}

export function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

export function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER,   vs));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

export const mat4 = {
  identity: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),

  multiply(a, b) {
    const o = new Float32Array(16);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[r+k*4] * b[k+c*4];
        o[r+c*4] = s;
      }
    return o;
  },

  rotY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]);
  },

  rotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
  },

  scale: (x,y,z) => new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]),
  trans: (x,y,z) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]),

  perspective(fovDeg, aspect, near, far) {
    const t  = Math.tan(fovDeg * Math.PI / 360);
    const pa = 1 / (aspect * t);
    const pb = 1 / t;
    const pc = -(far + near) / (far - near);
    const pd = -(2 * far * near) / (far - near);
    return new Float32Array([pa,0,0,0, 0,pb,0,0, 0,0,pc,-1, 0,0,pd,0]);
  },

  lookAt(eye, at, up) {
    const norm = v => { const l = Math.hypot(...v); return v.map(x => x/l); };
    const sub   = (a,b) => a.map((v,i) => v - b[i]);
    const cross  = (a,b) => [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0],
    ];
    const dot = (a,b) => a.reduce((s,v,i) => s + v*b[i], 0);
    const f = norm(sub(at, eye));
    const r = norm(cross(f, up));
    const u = cross(r, f);
    return new Float32Array([
       r[0],  u[0], -f[0], 0,
       r[1],  u[1], -f[1], 0,
       r[2],  u[2], -f[2], 0,
      -dot(r,eye), -dot(u,eye), dot(f,eye), 1,
    ]);
  },

  // матриця проекції тiнi на горизонтальну площину y=groundY
  // lx,ly,lz - позицiя джерела свiтла
  // column-major: col0=[d,0,0,0], col1=[-lx,-g,-lz,-1], col2=[0,0,d,0], col3=[lx*g,g*ly,lz*g,ly]
  // row1 (y): [0,-g,0,g*ly] -> y/w = g*ly / (ly-Py) ... * (1/1) => y_proj = groundY завжди
  shadowProjection(lx, ly, lz, groundY) {
    const d = ly - groundY, g = groundY;
    return new Float32Array([
      d,    0,    0,   0,      // col 0
     -lx,  -g,  -lz,  -1,     // col 1
      0,    0,    d,   0,      // col 2
      lx*g, g*ly, lz*g, ly,   // col 3
    ]);
  },
};
