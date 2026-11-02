/* =========================================================
   20 · 数据层：把 #courseware-data 变成运行时状态
   ---------------------------------------------------------
   九步脚本、器官口径、考核题全部来自那一个 JSON 块；
   这里不复制任何数字，也不改写任何结论。
   ========================================================= */
'use strict';

const DATA = JSON.parse(document.getElementById('courseware-data').textContent);
const STAGES = DATA.stages;
const N_STEPS = STAGES.length;
const LAST = N_STEPS - 1;

const META = DATA.meta;
/* ORGANS / WHOLE_LABEL 由 10-model.js 定义（它就是器官口径的源头，
   JSON 里的 organs 是它导出的副本），这里不再声明一次。 */
const U_LIGHT = META.unit.light;
const U_RATE = META.unit.rate;

/* ---- 当前变量（滑块就是这四个） ---- */
const VARS = { I: 800, T: 25, C: 400, O: 21 };

const SLIDERS = [
  { key: 'I', name: '光强', unit: U_LIGHT, min: 0, max: 2000, step: 5, scale: ['0', '500', '1000', '2000'] },
  { key: 'T', name: '温度', unit: '℃', min: 5, max: 45, step: 0.5, scale: ['5', '15', '25', '35', '45'] },
  { key: 'C', name: 'CO₂ 浓度', unit: 'ppm', min: 0, max: 1600, step: 10, scale: ['0', '400', '800', '1600'] },
  { key: 'O', name: 'O₂ 浓度', unit: '%', min: 0, max: 100, step: 1, scale: ['0', '21', '50', '100'] }
];

/* ---- 派生量 ---- */
const LIVE = { gross: 0, resp: 0, net: 0, pmax: 0, comp: null, sat: null };

function computeLive() {
  const r = ratesAt(VARS);
  LIVE.gross = r.gross;
  LIVE.resp = r.resp;
  LIVE.net = r.net;
  LIVE.pmax = pmaxAt(VARS.T, VARS.C, VARS.O);
  LIVE.comp = compPoint(VARS.T, VARS.C, VARS.O);
  LIVE.sat = satPoint(VARS.T, VARS.C, VARS.O);
  return LIVE;
}
computeLive();

/* ---- 器官读数：卡片与速查共用 ---- */
function organRead(id) {
  return organRates(VARS, id);
}
function organSum() {
  let net = 0, resp = 0;
  Object.keys(ORGANS).forEach(function (k) {
    const o = organRates(VARS, k);
    net += o.net;
    resp += o.resp;
  });
  return { net: net, resp: resp };
}

/* ---- 文案：每步的「视角倾向」决定相机与标签 ---- */
const VIEW_LABEL = {
  'chamber-wide': '同化箱 · 全株视角',
  'chamber-dark': '同化箱 · 熄灯',
  'leaf-close': '叶片 · 局部视角',
  'comp': '叶片与曲线 · 交点',
  'sat': '叶片 · 强光',
  'temp': '全株 · 温度',
  'gas': '全株 · 气体浓度',
  'organ': '器官 · 分栏视角',
  'quiz': '同化箱 · 收束'
};

/* ---- 起始步：?t= 必须夹紧，非法值退回 0 ---- */
function initialStep() {
  const raw = parseFloat(q.get('t'));
  if (!isFinite(raw)) return 0;
  return Math.min(LAST, Math.max(0, Math.round(raw)));
}

/* ---- 预设按钮（来自数据源，不在这里写数值） ---- */
const PRESET_LIST = [
  { key: 'normal', label: '参考工况' },
  { key: 'dark', label: '黑暗' },
  { key: 'weak', label: '弱光' },
  { key: 'comp', label: '补偿点' },
  { key: 'sat', label: '饱和点' }
];

/* ---- 器官色（速查按钮的色块，同时也是 3D 高亮色） ---- */
const ORGAN_COLOR = { leaf: '#12A06A', stem: '#7C9E4E', root: '#C08457' };
const ORGAN_ORDER = ['leaf', 'stem', 'root'];
