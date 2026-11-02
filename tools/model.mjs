/**
 * 生理模型 —— 全项目唯一的公式来源。
 *
 * 这个文件同时被两处消费：
 *   1. tools/gen-data.mjs  生成 courseware-data.json 与 README 数量表
 *   2. src/ 里的运行时（构建时把这份模型顺手内联进 HTML）
 *
 * 所以不允许在 HTML 或 Python 校验脚本里再抄一份公式。读数、曲线、
 * README 表全部走这里，三处不可能漂移。
 *
 * 单位：光强 μmol·m⁻²·s⁻¹；速率 μmol·s⁻¹·株⁻¹（以单株计）。
 */

export const PHYS = {
  alpha: 0.050,      // 表观量子产额
  pmax25: 27.0,      // 25 ℃ 且 400 ppm / 21% O₂ 时的最大总光合速率
  theta: 0.90,       // 直角双曲线的凸度
  rd25: 2.15,        // 25 ℃ 整株呼吸
  q10: 2.0,          // 呼吸的温度系数
  tOpt: 28,          // 总光合最适温
  tSigma: 14.0,      // 温度响应宽度
  kmCO2: 340,        // CO₂ 半饱和（ppm）
  cRef: 400,         // 参考 CO₂ 浓度
  oRef: 21,          // 参考 O₂ 浓度（%）
  o2Penalty: 0.0062, // O₂ 每升高 1% 总光合下降的相对量（光呼吸）
  satFrac: 0.92,     // 达到 pmax 的这个比例即记为“饱和”
  iMax: 2000
};

/**
 * 器官口径。
 * respShare 三者之和必须为 1.00 —— 这是 Σ各器官净光合 ≡ 整株净光合 的前提，
 * 第⑧步「整株≠叶片」的加法题靠它闭合。这组数是设定值，不是教材数据。
 */
export const ORGANS = {
  leaf: { id: 'leaf', name: '叶片', label: '叶片（局部）', grossShare: 1.00, respShare: 0.78, pick: true },
  stem: { id: 'stem', name: '茎', label: '茎（局部）', grossShare: 0.00, respShare: 0.07, pick: true },
  root: { id: 'root', name: '根', label: '根（局部）', grossShare: 0.00, respShare: 0.15, pick: true }
};

export const WHOLE_LABEL = '整株（汇总）';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** 温度 × CO₂ × O₂ 联合决定的最大总光合速率 */
export function pmaxAt(T, C, O) {
  const fT = Math.exp(-Math.pow(T - PHYS.tOpt, 2) / (2 * PHYS.tSigma * PHYS.tSigma));
  const fC = (C / (C + PHYS.kmCO2)) / (PHYS.cRef / (PHYS.cRef + PHYS.kmCO2));
  const fO = 1 - PHYS.o2Penalty * (O - PHYS.oRef);
  return PHYS.pmax25 * fT * fC * Math.max(0, fO);
}

/** 直角双曲线：总光合速率 */
export function grossAt(I, T, C, O) {
  const p = pmaxAt(T, C, O);
  const aI = PHYS.alpha * Math.max(0, I);
  const s = aI + p;
  const disc = s * s - 4 * PHYS.theta * aI * p;
  return Math.max(0, (s - Math.sqrt(Math.max(0, disc))) / (2 * PHYS.theta));
}

/** 整株呼吸：只随温度变，与光无关 */
export function respAt(T) {
  return PHYS.rd25 * Math.pow(PHYS.q10, (T - 25) / 10);
}

export function ratesAt(s) {
  const gross = grossAt(s.I, s.T, s.C, s.O);
  const resp = respAt(s.T);
  return { gross, resp, net: gross - resp };
}

/** 某器官的三项速率（器官级口径） */
export function organRates(s, organId) {
  const o = ORGANS[organId];
  if (!o) throw new Error('unknown organ: ' + organId);
  const g = grossAt(s.I, s.T, s.C, s.O) * o.grossShare;
  const r = respAt(s.T) * o.respShare;
  return { gross: g, resp: r, net: g - r };
}

/** 光补偿点：总光合 = 呼吸 的光强（二分） */
export function compPoint(T, C, O) {
  let lo = 0, hi = PHYS.iMax;
  const f = I => grossAt(I, T, C, O) - respAt(T);
  if (f(hi) < 0) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 光饱和点：达到 satFrac × Pmax 的光强（二分） */
export function satPoint(T, C, O) {
  const target = pmaxAt(T, C, O) * PHYS.satFrac;
  let lo = 0, hi = PHYS.iMax;
  const f = I => grossAt(I, T, C, O) - target;
  if (f(hi) < 0) return PHYS.iMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 曲线上取点，供迷你图与 2D 曲线派生，避免写死数组 */
export function curveSeries(s, n = 61) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const I = (PHYS.iMax * i) / (n - 1);
    out.push({ I, gross: grossAt(I, s.T, s.C, s.O), net: grossAt(I, s.T, s.C, s.O) - respAt(s.T) });
  }
  return out;
}

export { clamp };
