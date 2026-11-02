/* =========================================================
   90 · 语音五态机 + 考核
   ---------------------------------------------------------
   语音不用布尔值：pending / speaking / ended / error 必须分开，
   否则「正在加载」「已经讲完」「引擎报错」在代码里长得一模一样，
   切步时会一边显示下一段一边念上一段。
   本课件离线单文件，没有外挂音频，只能用系统 TTS；
   系统没装中文语音时静默降级为字幕。
   ========================================================= */
'use strict';

let voiceState = 'idle';   /* idle | pending | speaking | ended | error */
let voiceToken = 0;
let voiceUtter = null;
let voiceOn = FLAG.voice && !!window.speechSynthesis;
let voiceSubTimer = 0;

/* 字幕兜底：TTS 不可用或用户关掉语音时，旁白仍然读得到 */
let subEl = null;
function ensureSub() {
  if (subEl) return subEl;
  subEl = el('div', 'sub');
  document.getElementById('stage3d').appendChild(subEl);
  return subEl;
}
function showSub(text, holdMs) {
  const s = ensureSub();
  s.textContent = text;
  s.classList.add('on');
  clearTimeout(voiceSubTimer);
  voiceSubTimer = setTimeout(function () { s.classList.remove('on'); }, holdMs || 9000);
}
function hideSub() {
  if (subEl) subEl.classList.remove('on');
}

function pickZhVoice() {
  const list = window.speechSynthesis.getVoices() || [];
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (/zh[-_]CN/i.test(v.lang) || /Chinese|普通话|中文/i.test(v.name)) return v;
  }
  return null;
}

function initVoice() {
  /* 顶栏加一枚语音开关，随时静音——教室里突然出声很尴尬 */
  const bar = document.querySelector('.hd-right');
  if (bar) {
    const b = el('button', 'btn', '🔊');
    b.id = 'btnVoice';
    b.title = '旁白开关';
    b.onclick = function () {
      if (voiceOn) {
        cancelVoice();
        voiceOn = false;
        b.textContent = '🔇';
        b.classList.remove('on');
        toast('旁白已关闭，字幕仍在');
      } else if (window.speechSynthesis) {
        voiceOn = true;
        b.textContent = '🔊';
        b.classList.add('on');
        speakStage(STAGES[MICRO.step]);
      } else {
        toast('这台机器的浏览器不支持语音合成');
      }
    };
    if (voiceOn) b.classList.add('on');
    bar.insertBefore(b, document.getElementById('btnQuiz'));
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () { /* 触发一次加载，不做别的 */ };
  }
  ensureSub();

  /* 首次自动朗读常常被浏览器拦（没装中文语音或需要用户激活）。
     第一次点击/按键时补念一次，课堂上老师随便点一下就恢复了。 */
  let armed = false;
  const retry = function () {
    armed = true;
    document.removeEventListener('pointerdown', retry, true);
    document.removeEventListener('keydown', retry, true);
    if (voiceOn && voiceState === 'error') speakStage(STAGES[MICRO.step]);
  };
  document.addEventListener('pointerdown', retry, true);
  document.addEventListener('keydown', retry, true);
  void armed;
}

function cancelVoice() {
  voiceToken++;
  if (window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
  }
  voiceUtter = null;
  voiceState = 'idle';
  document.body.classList.remove('speaking');
}

/* 讲一段：token 保证只有最后一段的声音会落地 */
function speak(text, opt) {
  opt = opt || {};
  const token = ++voiceToken;
  if (!text) { voiceState = 'idle'; return; }

  if (!voiceOn || !window.speechSynthesis) {
    showSub(text, opt.hold || 9000);
    voiceState = 'ended';
    return;
  }

  showSub(text, 12000);
  try { window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 1.02;
  u.pitch = 1.0;
  const v = pickZhVoice();
  if (v) { u.voice = v; } else { u.lang = 'zh-CN'; }
  u.onstart = function () {
    if (token !== voiceToken) return;
    voiceState = 'speaking';
    document.body.classList.add('speaking');
  };
  u.onend = function () {
    if (token !== voiceToken) return;
    voiceState = 'ended';
    document.body.classList.remove('speaking');
    clearTimeout(voiceSubTimer);
    voiceSubTimer = setTimeout(hideSub, 1400);
  };
  u.onerror = function () {
    if (token !== voiceToken) return;
    voiceState = 'error';
    document.body.classList.remove('speaking');
    /* 引擎报错不再重试：重试只会反复失败，课堂里听感更糟 */
    showSub(text, 12000);
  };
  voiceUtter = u;
  voiceState = 'pending';
  window.speechSynthesis.speak(u);
}

function speakStage(st) {
  if (!st || !st.narration) return;
  speak(st.narration);
}

/* 「讲完再进下一步」：正在讲就跳过再走。
   不把按钮做成 disabled——投影时点不动会以为课件卡死。 */
const __nextStep = nextStep;
nextStep = function () {
  if (voiceState === 'speaking' || voiceState === 'pending') {
    cancelVoice();
    toast('旁白已跳过');
  }
  __nextStep();
};

/* =========================================================
   考核
   ========================================================= */
const QZ = { at: 0, picked: {}, open: false };

function quizScore() {
  let s = 0;
  DATA.quiz.forEach(function (item, i) {
    if (QZ.picked[i] === item.answer) s++;
  });
  return s;
}

function openQuiz() {
  QZ.open = true;
  MICRO.quizOpen = true;
  document.getElementById('quizWrap').classList.add('on');
  renderQuiz();
}
function closeQuiz() {
  QZ.open = false;
  MICRO.quizOpen = false;
  document.getElementById('quizWrap').classList.remove('on');
}

function renderQuiz() {
  const items = DATA.quiz;
  const i = QZ.at;
  const item = items[i];
  const picked = QZ.picked[i];

  document.getElementById('qProg').textContent = '第 ' + (i + 1) + ' / ' + items.length + ' 题';
  const body = document.getElementById('qBody');

  let html = '<div class="q-text">' + item.q + '</div><div class="q-opts">';
  item.options.forEach(function (op, k) {
    let cls = 'opt';
    if (picked !== undefined) {
      if (k === item.answer) cls += ' right';
      else if (k === picked) cls += ' wrong';
    }
    html += '<button class="' + cls + '" data-opt="' + k + '"' +
      (picked !== undefined ? ' disabled' : '') + '>' +
      '<span class="i">' + 'ABCD'[k] + '</span><span>' + op + '</span></button>';
  });
  html += '</div>';
  if (picked !== undefined) {
    html += '<div class="q-why"><b>' + (picked === item.answer ? '答对了。' : '再想一步。') +
      '</b>' + item.why + '</div>';
  }
  body.innerHTML = html;

  body.querySelectorAll('.opt').forEach(function (b) {
    b.onclick = function () { answerQuiz(i, +b.dataset.opt); };
  });

  document.getElementById('qPrev').disabled = (i === 0);
  const last = (i === items.length - 1);
  document.getElementById('qNext').textContent = last ? '交卷' : '下一题';
  document.getElementById('score').textContent = String(quizScore());
}

function answerQuiz(i, k) {
  if (QZ.picked[i] !== undefined) return;
  QZ.picked[i] = k;
  const item = DATA.quiz[i];
  document.getElementById('score').textContent = String(quizScore());
  renderQuiz();
  if (k !== item.answer) {
    /* 答错立刻给解析，不再等交卷 */
    toast('答错了，看下面的解析');
  }
}

function gotoQuiz(i) {
  const items = DATA.quiz;
  if (i >= items.length) { finishQuiz(); return; }
  QZ.at = clamp(i, 0, items.length - 1);
  renderQuiz();
}

function finishQuiz() {
  const items = DATA.quiz;
  const s = quizScore();
  MICRO.score = s;
  document.getElementById('score').textContent = String(s);
  const body = document.getElementById('qBody');
  let line = '把「净值可测、总值只能推」再走一遍：先看口径，再决定要不要减呼吸。';
  if (s === items.length) line = '全对。这三题问的其实是同一件事：你测到的到底是哪一层。';
  else if (s >= 2) line = '基本到位。剩下那一题的失分点，多半是叶片与整株的口径混了。';
  else if (s >= 1) line = '先回到第②步：黑暗中测到的就是呼吸，这一步通了，后面都顺。';
  else line = '别急着记结论，先分清「箱内变化」和「叶肉里发生的事」。';
  body.innerHTML =
    '<div class="qdone"><div class="big">' + s + ' / ' + items.length + '</div>' +
    '<p>' + line + '</p></div>';
  document.getElementById('qPrev').disabled = true;
  document.getElementById('qNext').textContent = '重做';
  document.getElementById('qNext').onclick = function () {
    QZ.picked = {};
    QZ.at = 0;
    document.getElementById('qNext').onclick = qNextHandler;
    renderQuiz();
  };
  document.getElementById('qProg').textContent = '已完成';
}

function qNextHandler() {
  const items = DATA.quiz;
  const i = QZ.at;
  if (QZ.picked[i] === undefined) {
    toast('先选一个选项');
    return;
  }
  if (i === items.length - 1) finishQuiz();
  else gotoQuiz(i + 1);
}

document.addEventListener('DOMContentLoaded', function () { /* 已在 boot 里处理 */ });

/* 顶栏与考核的接线放在最后，保证所有函数都已就绪 */
(function wireQuiz() {
  document.getElementById('qX').onclick = closeQuiz;
  document.getElementById('qPrev').onclick = function () { gotoQuiz(QZ.at - 1); };
  document.getElementById('qNext').onclick = qNextHandler;
  document.getElementById('quizWrap').addEventListener('click', function (e) {
    if (e.target === this) closeQuiz();
  });
})();

/* ---- 真正开跑 ---- */
boot();
