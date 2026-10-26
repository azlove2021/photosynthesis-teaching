/* =========================================================
   30 · 粒子系统（五套流量）
   发射速率全部由生理模型驱动；使用自定义着色器逐粒子控制
   大小与透明度，避免加色混合把颜色叠成白色
   ========================================================= */
'use strict';

function makeDotTexture() {
  const S = 96;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.30, 'rgba(255,255,255,0.86)');
  rg.addColorStop(0.62, 'rgba(255,255,255,0.28)');
  rg.addColorStop(0.86, 'rgba(255,255,255,0.06)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, 6.2832);
  g.fill();
  return new THREE.CanvasTexture(c);
}
const DOT_TEX = makeDotTexture();

/* 视口相关的点尺寸换算 */
const PT_UNIFORMS = {
  uMap: { value: DOT_TEX },
  uScale: { value: 1200 }
};
function updatePointScale() {
  const h = renderer.domElement.height;
  PT_UNIFORMS.uScale.value = h / (2 * Math.tan(camera.fov * Math.PI / 360));
}

const PT_VERT = [
  'attribute float aSize;',
  'attribute float aAlpha;',
  'attribute vec3 aColor;',
  'varying vec3 vColor;',
  'varying float vAlpha;',
  'uniform float uScale;',
  'void main() {',
  '  vColor = aColor;',
  '  vAlpha = aAlpha;',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  float ps = aSize * uScale / max(0.001, -mv.z);',
  '  gl_PointSize = clamp(ps, 1.0, 90.0);',
  '  gl_Position = projectionMatrix * mv;',
  '}'
].join('\n');

const PT_FRAG = [
  'uniform sampler2D uMap;',
  'varying vec3 vColor;',
  'varying float vAlpha;',
  'void main() {',
  '  vec4 t = texture2D(uMap, gl_PointCoord);',
  '  if (t.a < 0.01) discard;',
  '  gl_FragColor = vec4(vColor, t.a * vAlpha);',
  '}'
].join('\n');

/* ---------- 单个粒子流 ---------- */
function Stream(cfg) {
  this.max = cfg.max;
  this.color = new THREE.Color(cfg.color);
  this.speed = cfg.speed || 0.6;
  this.life = cfg.life || 2.0;
  this.size = cfg.size || 0.05;
  this.jitter = cfg.jitter === undefined ? 0.1 : cfg.jitter;
  this.hasTgt = !!cfg.hasTgt;
  this.swirl = cfg.swirl || 0;
  this.fadePow = cfg.fadePow || 1.4;
  this.sizeVar = cfg.sizeVar === undefined ? 0.35 : cfg.sizeVar;

  this.n = 0;
  this.px = new Float32Array(this.max);
  this.py = new Float32Array(this.max);
  this.pz = new Float32Array(this.max);
  this.vx = new Float32Array(this.max);
  this.vy = new Float32Array(this.max);
  this.vz = new Float32Array(this.max);
  this.tx = new Float32Array(this.max);
  this.ty = new Float32Array(this.max);
  this.tz = new Float32Array(this.max);
  this.age = new Float32Array(this.max);
  this.lifeArr = new Float32Array(this.max);
  this.seed = new Float32Array(this.max);
  this.sz = new Float32Array(this.max);

  const geo = new THREE.BufferGeometry();
  this.posAttr = new THREE.BufferAttribute(new Float32Array(this.max * 3), 3);
  this.colAttr = new THREE.BufferAttribute(new Float32Array(this.max * 3), 3);
  this.szAttr = new THREE.BufferAttribute(new Float32Array(this.max), 1);
  this.alAttr = new THREE.BufferAttribute(new Float32Array(this.max), 1);
  [this.posAttr, this.colAttr, this.szAttr, this.alAttr].forEach(function (a) {
    a.setUsage(THREE.DynamicDrawUsage);
  });
  geo.setAttribute('position', this.posAttr);
  geo.setAttribute('aColor', this.colAttr);
  geo.setAttribute('aSize', this.szAttr);
  geo.setAttribute('aAlpha', this.alAttr);
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.4, 0), 7);

  const mat = new THREE.ShaderMaterial({
    uniforms: PT_UNIFORMS,
    vertexShader: PT_VERT,
    fragmentShader: PT_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });

  this.points = new THREE.Points(geo, mat);
  this.points.frustumCulled = false;
  this.geo = geo;
  world.add(this.points);
}

Stream.prototype.emit = function (x, y, z, vx, vy, vz, tx, ty, tz) {
  if (this.n >= this.max) return;
  const i = this.n++;
  this.px[i] = x; this.py[i] = y; this.pz[i] = z;
  this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
  this.tx[i] = tx === undefined ? 0 : tx;
  this.ty[i] = ty === undefined ? 0 : ty;
  this.tz[i] = tz === undefined ? 0 : tz;
  this.age[i] = 0;
  this.lifeArr[i] = this.life * (0.72 + Math.random() * 0.56);
  this.seed[i] = Math.random() * 6.2832;
  this.sz[i] = this.size * (1 - this.sizeVar + Math.random() * this.sizeVar * 2);
};

Stream.prototype.update = function (dt) {
  const pos = this.posAttr.array;
  const col = this.colAttr.array;
  const sz = this.szAttr.array;
  const al = this.alAttr.array;
  let n = this.n;
  let i = 0;
  while (i < n) {
    this.age[i] += dt;
    const lf = this.lifeArr[i];
    if (this.age[i] >= lf) {
      n--;
      if (i !== n) {
        this.px[i] = this.px[n]; this.py[i] = this.py[n]; this.pz[i] = this.pz[n];
        this.vx[i] = this.vx[n]; this.vy[i] = this.vy[n]; this.vz[i] = this.vz[n];
        this.tx[i] = this.tx[n]; this.ty[i] = this.ty[n]; this.tz[i] = this.tz[n];
        this.age[i] = this.age[n]; this.lifeArr[i] = this.lifeArr[n];
        this.seed[i] = this.seed[n]; this.sz[i] = this.sz[n];
      }
      continue;
    }

    if (this.hasTgt) {
      const dx = this.tx[i] - this.px[i];
      const dy = this.ty[i] - this.py[i];
      const dz = this.tz[i] - this.pz[i];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-5;
      const sp = this.speed;
      let ux = dx / d, uy = dy / d, uz = dz / d;
      if (this.swirl > 0) {
        const s = this.swirl * (1 - this.age[i] / lf);
        const nx = ux - uz * s;
        const nz = uz + ux * s;
        ux = nx; uz = nz;
        uy += Math.sin(this.seed[i] + this.age[i] * 3) * s * 0.4;
      }
      this.vx[i] = damp(this.vx[i], ux * sp, 4.0, dt);
      this.vy[i] = damp(this.vy[i], uy * sp, 4.0, dt);
      this.vz[i] = damp(this.vz[i], uz * sp, 4.0, dt);
    } else {
      this.vy[i] += dt * 0.06;
    }

    const j = this.jitter;
    this.px[i] += (this.vx[i] + Math.sin(this.age[i] * 2.1 + this.seed[i]) * j) * dt;
    this.py[i] += (this.vy[i] + Math.cos(this.age[i] * 1.7 + this.seed[i]) * j * 0.6) * dt;
    this.pz[i] += (this.vz[i] + Math.cos(this.age[i] * 2.4 + this.seed[i]) * j) * dt;

    const t = this.age[i] / lf;
    /* 出生淡入，死亡前淡出 */
    const a = Math.pow(1 - t, this.fadePow) * Math.min(1, t * 9.0);

    pos[i * 3] = this.px[i];
    pos[i * 3 + 1] = this.py[i];
    pos[i * 3 + 2] = this.pz[i];
    col[i * 3] = this.color.r;
    col[i * 3 + 1] = this.color.g;
    col[i * 3 + 2] = this.color.b;
    sz[i] = this.sz[i];
    al[i] = a;
    i++;
  }
  this.n = n;
  this.geo.setDrawRange(0, n);
  this.posAttr.needsUpdate = true;
  this.colAttr.needsUpdate = true;
  this.szAttr.needsUpdate = true;
  this.alAttr.needsUpdate = true;
};

/* ---------- 五套流 ---------- */
const stO2 = new Stream({ max: 700, color: 0x62f2c0, size: 0.072, life: 2.6, jitter: 0.10, speed: 0.80 });
const stCO2 = new Stream({ max: 560, color: 0xffb04a, size: 0.063, life: 2.2, jitter: 0.05, speed: 1.00, hasTgt: true, fadePow: 1.0 });
const stH2O = new Stream({ max: 320, color: 0x5ec4ff, size: 0.051, life: 2.1, jitter: 0.03, speed: 0.85, hasTgt: true, swirl: 0.55 });
const stSugar = new Stream({ max: 320, color: 0xffdc8a, size: 0.053, life: 2.4, jitter: 0.05, speed: 0.72, hasTgt: true, swirl: 0.25 });
const stResp = new Stream({ max: 780, color: 0xff8a4a, size: 0.057, life: 3.0, jitter: 0.20, speed: 0.34, fadePow: 1.3, sizeVar: 0.45 });

/* ---------- 发射调度 ---------- */
const emitAcc = { o2: 0, co2: 0, h2o: 0, sugar: 0, resp: 0 };
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

const RESP_ALL = respireRecords.slice();
const RESP_LEAF_ONLY = respireRecords.filter(function (r) { return r.type === 'leaf'; });

let leafCursor = 0;
function pickLeaf() {
  leafCursor = (leafCursor + 1 + ((Math.random() * 3) | 0)) % leafRecords.length;
  return leafRecords[leafCursor];
}

function emitParticles(dt) {
  const g = State.rates.gross;
  const r = State.rates.resp;
  const gN = clamp(g / 27, 0, 1.15);

  /* O₂：叶面逸出，向上扩散 */
  emitAcc.o2 += 100 * gN * dt;
  let c = Math.min(16, Math.floor(emitAcc.o2));
  emitAcc.o2 -= c;
  for (; c > 0; c--) {
    const rec = pickLeaf();
    sampleLeafPoint(rec, _p);
    const rr = Math.sqrt(_p.x * _p.x + _p.z * _p.z) + 1e-4;
    stO2.emit(_p.x, _p.y, _p.z,
      (_p.x / rr) * (0.14 + Math.random() * 0.26),
      0.42 + Math.random() * 0.34,
      (_p.z / rr) * (0.14 + Math.random() * 0.26));
  }

  /* CO₂：箱壁 → 叶面 */
  emitAcc.co2 += 78 * gN * dt;
  c = Math.min(14, Math.floor(emitAcc.co2));
  emitAcc.co2 -= c;
  for (; c > 0; c--) {
    const rec = pickLeaf();
    sampleLeafPoint(rec, _q);
    const a = Math.random() * 6.2832;
    const rad = 1.10 + Math.random() * 0.28;
    const h = 0.45 + Math.random() * 2.20;
    stCO2.emit(Math.cos(a) * rad, h, Math.sin(a) * rad, 0, 0, 0, _q.x, _q.y, _q.z);
  }

  /* H₂O：根压驱动上行 */
  emitAcc.h2o += 40 * gN * dt;
  c = Math.min(10, Math.floor(emitAcc.h2o));
  emitAcc.h2o -= c;
  for (; c > 0; c--) {
    const rec = pickLeaf();
    sampleLeafPoint(rec, _q);
    stH2O.emit((Math.random() - 0.5) * 0.10, 0.50, (Math.random() - 0.5) * 0.10,
      0, 0.8, 0, _q.x, _q.y, _q.z);
  }

  /* 有机物：叶 → 根 */
  emitAcc.sugar += 42 * gN * dt;
  c = Math.min(10, Math.floor(emitAcc.sugar));
  emitAcc.sugar -= c;
  for (; c > 0; c--) {
    const rec = pickLeaf();
    sampleLeafPoint(rec, _p);
    stSugar.emit(_p.x, _p.y, _p.z, 0, -0.4, 0,
      (Math.random() - 0.5) * 0.12, 0.48, (Math.random() - 0.5) * 0.12);
  }

  /* 呼吸 CO₂：全株持续，永不停止 */
  emitAcc.resp += 19 * r * (State.whole ? 1.0 : 0.82) * dt;
  c = Math.min(12, Math.floor(emitAcc.resp));
  emitAcc.resp -= c;
  for (; c > 0; c--) {
    const cands = State.whole ? RESP_ALL : RESP_LEAF_ONLY;
    const rec = cands[(Math.random() * cands.length) | 0];
    if (rec.type === 'root') {
      stResp.emit(
        rec.local.x + (Math.random() - 0.5) * 0.16,
        rec.local.y,
        rec.local.z + (Math.random() - 0.5) * 0.16,
        (Math.random() - 0.5) * 0.10, -0.04, (Math.random() - 0.5) * 0.10);
    } else if (rec.type === 'stem') {
      stResp.emit(
        rec.local.x + (Math.random() - 0.5) * 0.05,
        rec.local.y,
        rec.local.z + (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.20, 0.10 + Math.random() * 0.14, (Math.random() - 0.5) * 0.20);
    } else {
      rec.obj.localToWorld(_p.copy(rec.local));
      stResp.emit(_p.x, _p.y, _p.z,
        (Math.random() - 0.5) * 0.24, 0.14 + Math.random() * 0.16, (Math.random() - 0.5) * 0.24);
    }
  }
}

function updateParticles(dt) {
  stO2.update(dt);
  stCO2.update(dt);
  stH2O.update(dt);
  stSugar.update(dt);
  stResp.update(dt);
}
