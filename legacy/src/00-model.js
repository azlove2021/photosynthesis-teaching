/* =========================================================
   00 · 生理模型与全局状态
   数值以「教学可信」为准：形态正确、量级合理、趋势符合教材
   ========================================================= */
'use strict';

const PHYS = {
  alpha: 0.050,      // 表观量子效率（初始斜率）
  pmax25: 27.0,      // 25℃ / 400ppm / 21%O2 / 光饱和时的总光合 μmol CO2 m-2 s-1
  theta: 0.90,       // 直角双曲线凸度
  rd25: 2.15,        // 25℃ 呼吸速率 μmol CO2 m-2 s-1
  q10: 2.0,          // 呼吸的温度系数
  tOpt: 28,          // 光合最适温
  tSigma: 14.0,      // 光合温度响应宽度
  kmCO2: 340,        // CO2 半饱和常数 ppm
  cRef: 400,
  oRef: 21,
  o2Penalty: 0.0062, // 每超出 1% O2，光呼吸导致的下降比例
  /* 判定光饱和的阈值。0.92 时标注点落在曲线还在明显上爬的位置，
     学生看图会觉得"明明还在升，怎么就说饱和了"。抬到 0.94 之后
     标注点移到 I≈1300，曲线在那里已经基本压平，与"加光不再增益"对得上。 */
  satFrac: 0.94,
  iMax: 2000
};

/* ---- 各因子 ---- */
function fTemp(T) {
  const d = T - PHYS.tOpt;
  return Math.exp(-(d * d) / (2 * PHYS.tSigma * PHYS.tSigma));
}
function fCO2(C) {
  const km = PHYS.kmCO2;
  return (C / (C + km)) / (PHYS.cRef / (PHYS.cRef + km));
}
function fO2(O) {
  return Math.max(0.35, 1 - PHYS.o2Penalty * Math.max(0, O - PHYS.oRef));
}

/* ---- 总光合：光响应直角双曲线 ---- */
function pmaxAt(T, C, O) {
  return PHYS.pmax25 * fTemp(T) * fCO2(C) * fO2(O);
}
function grossAt(I, T, C, O) {
  const p = pmaxAt(T, C, O);
  if (p <= 0.001) return 0;
  const aI = PHYS.alpha * Math.max(0, I);
  const th = PHYS.theta;
  const disc = aI + p;
  const sq = Math.sqrt(Math.max(0, disc * disc - 4 * th * aI * p));
  return Math.max(0, (disc - sq) / (2 * th));
}

/* ---- 呼吸：只跟温度走（光照下照常进行） ---- */
function respAt(T, whole) {
  const base = PHYS.rd25 * Math.pow(PHYS.q10, (T - 25) / 10);
  return base * (whole ? 1.0 : 0.78);
}

/* ---- 三量 ---- */
function ratesAt(s) {
  const gross = grossAt(s.I, s.T, s.C, s.O);
  const resp = respAt(s.T, s.whole);
  return { gross: gross, resp: resp, net: gross - resp };
}

/* ---- 光补偿点（二分法） ---- */
function compPoint(T, C, O, whole) {
  const rd = respAt(T, whole);
  const p = pmaxAt(T, C, O);
  if (p <= rd) return null;
  let lo = 0, hi = PHYS.iMax;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (grossAt(mid, T, C, O) - rd < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ---- 光饱和点 ---- */
function satPoint(T, C, O) {
  const p = pmaxAt(T, C, O);
  if (p <= 0.001) return null;
  const target = PHYS.satFrac * p;
  let lo = 0, hi = PHYS.iMax * 1.4;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (grossAt(mid, T, C, O) < target) lo = mid; else hi = mid;
  }
  const v = (lo + hi) / 2;
  return v > PHYS.iMax ? null : v;
}

/* ---- 全局状态 ---- */
const State = {
  I: 800,
  T: 25,
  C: 400,
  O: 21,
  whole: true,
  mode: 'demo',
  maxI: 800,          // 拖到过的最大光强，用于曲线“生长”
  chamberCO2: 400,
  chamberO2: 20.9,
  t: 0,
  rates: { gross: 0, resp: 0, net: 0 },
  shown: { gross: 0, resp: 0, net: 0 },
  comp: null,
  sat: null,
  vis: { gross: 0, resp: 0, net: 0 }
};

const DEFAULT_STATE = { I: 800, T: 25, C: 400, O: 21, whole: true };

/* 实验记录：学生手动存下的实测点。曲线靠它才有「测得」的分量，
   而不只是程序算出来的函数图像。绘制在 50-curve.js，写入在 70-lesson.js。 */
const REC = { pts: [], max: 12 };

function recompute() {
  State.rates = ratesAt(State);
  State.comp = compPoint(State.T, State.C, State.O, State.whole);
  State.sat = satPoint(State.T, State.C, State.O);
}

/* ---- 确定性随机 ----
   xorshift32。植株形态完全由种子决定：每次打开、每台机器的截图
   逐像素一致，课堂演示不会“今天这株和昨天不一样”。 */
let _rngState = 0x2f6e2b1;
function RNG() {
  _rngState ^= _rngState << 13;
  _rngState ^= _rngState >>> 17;
  _rngState ^= _rngState << 5;
  return (_rngState >>> 0) / 4294967296;
}
function seedRNG(s) { _rngState = (s >>> 0) || 0x2f6e2b1; }

/* ---- 小工具 ---- */
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const fmt = (v, d) => (v >= 0 ? '' : '−') + Math.abs(v).toFixed(d === undefined ? 1 : d);
