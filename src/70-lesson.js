/* =========================================================
   70 · 课堂层：问题串导航 / 实验记录 / 键位 / 纯净投影
   与教学设计讲义 Q1–Q16 逐题对应。这一层不改动任何生理模型，
   只负责把"演示器"变成"能按教案走完一节课的教具"。
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   问题串
   setup：跳到该问题时把场景摆到对应状态。教师仍可自由拖动，
   只是每次切题会把位置复位到这一问的起点。
   --------------------------------------------------------- */
const STAGE_NAME = ['环节一 · 看见三条流', '环节二 · 净光合是测出来的',
                    '环节三 · 曲线上的两个临界点', '环节四 · 总光合怎么得到'];

function toComp() { setLight(State.comp === null ? 60 : State.comp); }
function toWeak() { setLight(State.comp ? Math.max(8, State.comp * 0.55) : 30); }

const QUESTIONS = [
  /* 环节一 */
  { s: 0, q: '屏幕上这些点，是从哪儿出来的、又往哪儿去？',
    setup: () => { setTemp(25); setWhole(true); setLight(800); } },
  { s: 0, q: '这株植物此刻在光合作用，那它在呼吸吗？',
    setup: () => { setTemp(25); setWhole(true); setLight(800); } },
  { s: 0, q: '如果我只告诉你箱子里 CO₂ 少了多少，你能算出它一共制造了多少有机物吗？',
    setup: () => { setTemp(25); setWhole(true); setLight(800); } },

  /* 环节二 */
  { s: 1, q: '总光合为什么是 0，呼吸为什么不是 0？',
    setup: () => { setTemp(25); setWhole(true); setLight(0); } },
  { s: 1, q: '净光合的 −2.1，这个负号在箱子里对应什么现象？',
    setup: () => { setTemp(25); setWhole(true); setLight(0); } },
  { s: 1, q: '已经有光合了，为什么箱内 CO₂ 还在升？',
    setup: () => { setTemp(25); setWhole(true); toWeak(); } },
  { s: 1, q: '此刻植物在光合吗？在呼吸吗？那为什么箱子里的读数一动不动？',
    setup: () => { setTemp(25); setWhole(true); toComp(); } },

  /* 环节三 */
  { s: 2, q: '曲线上哪一段是"看起来什么都没发生"的？',
    setup: () => { setTemp(25); setWhole(true); toComp(); } },
  { s: 2, q: '光补偿点会移动吗？把温度切到 35 ℃ 再看。',
    setup: () => { setWhole(true); setTemp(35); toComp(); } },
  { s: 2, q: '为什么高光强下再加光也没用？这时候限制光合的是谁？',
    setup: () => { setTemp(25); setWhole(true); setLight(2000); } },
  { s: 2, q: '把光拖到最亮，呼吸停了吗？你怎么证明？',
    setup: () => { setTemp(25); setWhole(true); setLight(2000); } },

  /* 环节四 */
  { s: 3, q: '为什么黑暗中的净光合读数，就等于呼吸速率？',
    setup: () => { setTemp(25); setWhole(true); setLight(0); } },
  { s: 3, q: '如果黑瓶和白瓶都放在光下，白瓶测到的还是净光合吗？',
    setup: () => { setTemp(25); setWhole(true); setLight(800); } },
  { s: 3, q: '三种方法里，哪一种真正测到了总光合？',
    setup: () => { setTemp(25); setWhole(true); setLight(800); } },
  { s: 3, q: '同一时刻，整株的净光合比叶片低，低下去的那部分是什么？',
    setup: () => { setTemp(25); setLight(800); setWhole(true); } },
  { s: 3, q: '题目里说"某植物的净光合速率"，你默认它指的是叶片还是整株？',
    setup: () => { setTemp(25); setLight(800); setWhole(false); } }
];

let qIndex = 0;

const QE = {
  prev: document.getElementById('qPrev'),
  next: document.getElementById('qNext'),
  stage: document.getElementById('qStage'),
  no: document.getElementById('qNo'),
  text: document.getElementById('qText'),
  chips: document.getElementById('deriveChips')
};

/* 每道题解锁到哪一步推导 */
const UNLOCK_AT = { 1: 2, 2: 11, 3: 13 };   /* 0 基索引：Q3 / Q12 / Q14 */

function paintChips() {
  QE.chips.querySelectorAll('.chip').forEach(function (c) {
    const step = +c.dataset.step;
    const need = UNLOCK_AT[step];
    c.classList.toggle('on', qIndex >= need);
  });
}

function setQ(i, silent) {
  qIndex = clamp(i, 0, QUESTIONS.length - 1);
  const item = QUESTIONS[qIndex];
  if (!silent) item.setup();

  QE.stage.textContent = STAGE_NAME[item.s];
  QE.no.textContent = 'Q' + (qIndex + 1) + ' / ' + QUESTIONS.length;
  QE.text.textContent = item.q;
  QE.prev.disabled = qIndex === 0;
  QE.next.disabled = qIndex === QUESTIONS.length - 1;
  paintChips();
}

function stepQ(d) { setQ(qIndex + d); }

QE.prev.addEventListener('click', function () { stepQ(-1); });
QE.next.addEventListener('click', function () { stepQ(1); });

/* ---------------------------------------------------------
   实验记录
   --------------------------------------------------------- */
const RECE = {
  strip: document.querySelector('.recstrip'),
  body: document.getElementById('recBody'),
  count: document.getElementById('recCount'),
  add: document.getElementById('btnRecord'),
  clear: document.getElementById('btnRecClear')
};

function renderRec() {
  RECE.count.textContent = REC.pts.length + ' 组';
  if (RECE.strip) RECE.strip.classList.toggle('empty', !REC.pts.length);
  if (!REC.pts.length) {
    RECE.body.innerHTML =
      '<div class="rec-empty">拖到一个光强，点「记录此刻」存一组数据。<br>' +
      '实测点会标在曲线上——曲线不是画出来的，是测出来的。</div>';
    return;
  }
  let h = '<table class="rec-table"><thead><tr>' +
    '<th>#</th><th>光强</th><th>净光合</th><th>总光合</th><th>呼吸</th>' +
    '</tr></thead><tbody>';
  for (let i = 0; i < REC.pts.length; i++) {
    const p = REC.pts[i];
    h += '<tr><td>' + (i + 1) + '</td><td>' + p.I + '</td>' +
      '<td class="' + (p.net >= 0 ? 'po' : 'ng') + '">' + fmt(p.net, 1) + '</td>' +
      '<td>' + fmt(p.gross, 1) + '</td><td>' + fmt(p.resp, 1) + '</td></tr>';
  }
  h += '</tbody></table>';
  RECE.body.innerHTML = h;
}

function recordPoint() {
  if (REC.pts.length >= REC.max) {
    RECE.count.textContent = REC.max + ' 组（已满）';
    return;
  }
  /* 同一光强、同一套条件附近不重复记，免得表格被连点灌满 */
  for (let i = 0; i < REC.pts.length; i++) {
    const q = REC.pts[i];
    if (Math.abs(q.I - State.I) < 12 && q.T === State.T &&
        q.C === State.C && q.O === State.O && q.whole === State.whole) {
      RECE.count.textContent = REC.pts.length + ' 组 · 该点已记';
      return;
    }
  }
  /* C / O 也要一起存：它们一变，曲线整条都在动，
     只记 T 和口径会让"同条件"的判断出错。 */
  REC.pts.push({
    I: Math.round(State.I),
    net: State.rates.net,
    gross: State.rates.gross,
    resp: State.rates.resp,
    T: State.T,
    C: State.C,
    O: State.O,
    whole: State.whole
  });
  renderRec();
  drawChart();
}

function clearRec() {
  REC.pts.length = 0;
  renderRec();
  drawChart();
}

RECE.add.addEventListener('click', recordPoint);
RECE.clear.addEventListener('click', clearRec);

/* ---------------------------------------------------------
   纯净投影 / 全屏
   --------------------------------------------------------- */
let pureOn = false;
function setPure(v) {
  pureOn = !!v;
  document.body.classList.toggle('pure', pureOn);
  const btn = document.getElementById('btnPure');
  if (btn) btn.textContent = pureOn ? '退出纯净' : '纯净';
  /* 隐藏面板后画布尺寸变了，必须重排 */
  setTimeout(function () { resize(); resizeChart(); }, 40);
}
function togglePure() { setPure(!pureOn); }

function toggleFull() {
  try {
    if (!document.fullscreenElement) {
      const r = document.documentElement.requestFullscreen();
      if (r && r.catch) r.catch(function () {});
    } else {
      document.exitFullscreen();
    }
  } catch (e) { /* 某些环境禁用了全屏，忽略 */ }
}

document.getElementById('btnPure').addEventListener('click', togglePure);
document.getElementById('btnFull').addEventListener('click', toggleFull);

/* ---------------------------------------------------------
   键位
   ← → 切题（等同翻页）  ↑ ↓ 调光强（Shift 大步）
   R 记录  H 纯净  F 全屏  空格（在 60-ui.js 里）复位
   --------------------------------------------------------- */
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT' && ae.type !== 'range') return;
  if (ae && ae.tagName === 'TEXTAREA') return;

  /* 滑杆拿到焦点后方向键会去拨滑杆，这里主动交还控制权 */
  const onRange = !!(ae && ae.tagName === 'INPUT');
  const k = e.key;

  if (k === 'ArrowRight') { e.preventDefault(); if (onRange) ae.blur(); stepQ(1); }
  else if (k === 'ArrowLeft') { e.preventDefault(); if (onRange) ae.blur(); stepQ(-1); }
  else if (k === 'ArrowUp') {
    e.preventDefault(); if (onRange) ae.blur();
    setLight(State.I + (e.shiftKey ? 150 : 25));
  } else if (k === 'ArrowDown') {
    e.preventDefault(); if (onRange) ae.blur();
    setLight(State.I - (e.shiftKey ? 150 : 25));
  } else if (k === 'r' || k === 'R') { recordPoint(); }
  else if (k === 'c' || k === 'C') { if (typeof toggleChem === 'function') toggleChem(); }
  else if (k === 'h' || k === 'H') { togglePure(); }
  else if (k === 'f' || k === 'F') { toggleFull(); }
});

/* ---------------------------------------------------------
   启动
   --------------------------------------------------------- */
renderRec();
setQ(0);

/* 投影场景常直接开一个"只剩植株"的地址，省得课前手忙脚乱。
   ?pure=1 进纯净态，?q=7 直接落到第 7 问。 */
(function readURL() {
  let q = '';
  try { q = String(location.search || '').replace(/^\?/, ''); } catch (e) { q = ''; }
  if (!q) return;
  const kv = {};
  q.split('&').forEach(function (pair) {
    const i = pair.indexOf('=');
    if (i > 0) kv[pair.slice(0, i)] = pair.slice(i + 1);
  });
  if (kv.q) {
    const n = parseInt(kv.q, 10);
    if (n >= 1 && n <= QUESTIONS.length) setQ(n - 1);   /* 必须跑 setup，场景要跟着走 */
  }
  if (kv.pure === '1') setPure(true);
})();

/* 暴露给验证脚本 */
window.__lesson = {
  questions: QUESTIONS,
  setQ: setQ,
  index: function () { return qIndex; },
  record: recordPoint,
  recordCount: function () { return REC.pts.length; },
  pure: function () { return pureOn; },
  setPure: setPure
};
