/* =========================================================
   15 · 小工具、URL 参数、微状态
   ---------------------------------------------------------
   注意：clamp 已经在 10-model.js 里定义（模型与排版共用），
   这里不能再声明一次，否则整个 <script> 会因重复声明报错。
   ========================================================= */
'use strict';

const $ = function (s) { return document.querySelector(s); };
const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

const lerp = function (a, b, t) { return a + (b - a) * t; };
const damp = function (a, b, k, dt) { return lerp(a, b, 1 - Math.exp(-k * dt)); };
const easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

/* 确定性随机：植株形态由种子决定，每次打开都长得一样，
   课堂截图、讲义配图、学生对照才可能一致。 */
let _rngState = 0x2f6e2b1;
function RNG() {
  _rngState ^= _rngState << 13;
  _rngState ^= _rngState >>> 17;
  _rngState ^= _rngState << 5;
  return (_rngState >>> 0) / 4294967296;
}
function seedRNG(s) { _rngState = (s >>> 0) || 0x2f6e2b1; }

/* 数字格式：负数用真减号，避免课堂上把 -0.0 读成一个奇怪的符号 */
const MINUS = '\u2212';
function fmt(v, d) {
  const n = d === undefined ? 1 : d;
  const s = Math.abs(v).toFixed(n);
  if (Math.abs(v) < Math.pow(10, -n) * 0.5) return s;   /* -0.0 → 0.0 */
  return (v < 0 ? MINUS : '') + s;
}
function fmtSigned(v, d) {
  const n = d === undefined ? 1 : d;
  const s = fmt(v, n);
  return v > 0 ? '+' + s : s;
}

/* URL 参数：必须夹紧，非法值不能把页面带崩 */
const q = new URLSearchParams(location.search);
const FLAG = {
  voice: q.get('voice') !== '0',
  simple: q.get('simple') === '1'
};

/* 微状态：只放「界面此刻怎么了」，科学量放在 VARS / DATA 里 */
const MICRO = {
  step: 0,
  reveal: false,        /* 本步是否已揭示结论 */
  visited: {},          /* 走过的步，用于步骤条 done 态 */
  pick: null,           /* 当前点选的器官 id */
  hover: null,          /* 鼠标此刻悬在哪个器官上 */
  focus: null,          /* 3D 聚焦目标 */
  explore: false,       /* 自由探究：放开全部滑块 */
  score: 0,
  quizAt: 0,
  quizOpen: false,
  quizPicked: {},       /* 每题选过的选项，重进不丢 */
  speaking: false,
  followVoice: true,    /* 讲完才进下一步 */
  dragging: false,
  pressT: 0
};

/* 原生 Toast：短、不打断、2.2s 自动消失 */
let _toastTimer = 0;
function toast(msg, ms) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { el.classList.remove('on'); }, ms || 2200);
}

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
