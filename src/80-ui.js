/* =========================================================
   80 · 七区渲染与交互
   ---------------------------------------------------------
   顶栏 / 因果链 / 步骤条 / 左栏本步 / 中央 3D / 右栏中控台 / 底栏
   启动函数 boot() 放在最后一个文件末尾调用，
   这样语音与考核的状态已经就绪，不会踩到 TDZ。
   ========================================================= */
'use strict';

/* 每步落在因果链的哪一格：链条是「光 → 固碳 → 呼吸 → 相抵 → 推算」 */
const CHIP_OF_STEP = [0, 2, 3, 3, 1, 2, 1, 3, 4];

/* 方程式卡：每步一行公式 + 一句条件（文字，不含结果数字） */
const EQB = [
  ['箱内 ΔCO₂ 速率 = 净光合速率', '条件：密闭、恒温、只有这一株'],
  ['总光合 = 0，只剩呼吸', '黑暗：光反应停，呼吸照常'],
  ['总光合 < 呼吸 ⇒ 净光合 < 0', '弱光：固碳还不够抵呼吸'],
  ['总光合 = 呼吸 ⟺ 净光合 = 0', '光补偿点：两条曲线相交'],
  ['总光合 ≈ Pmax，加光不再增益', '光饱和点：限制因素换成了 CO₂'],
  ['呼吸 = Rd₂₅ × Q₁₀^((T−25)/10)', '升温：呼吸涨得比光合快'],
  ['CO₂↑ → 总光合↑　O₂↑ → 总光合↓', 'O₂ 高时光呼吸增强，净光合被压'],
  ['Σ 各器官净光合 = 整株净光合', '叶片产、根茎耗，相加才闭合'],
  ['净光合 + 呼吸 = 总光合', '可测的只有净值，总值只能推']
];

/* 三个单元色：装置与净值 / 机制 / 器官与考核 */
function stepUnit(i) {
  if (i <= 3) return { uc: '#2F6BFF', ucs: '#1E4FD6', uh: 'rgba(47,107,255,.08)' };
  if (i <= 6) return { uc: '#0D7A8C', ucs: '#0B6979', uh: 'rgba(13,122,140,.10)' };
  if (i === 7) return { uc: '#057A55', ucs: '#046A4A', uh: 'rgba(5,122,85,.10)' };
  return { uc: '#9333EA', ucs: '#7C2BC4', uh: 'rgba(147,51,234,.10)' };
}

/* ---------------- 构建：因果链 ---------------- */
function buildChain() {
  const box = $('#chain');
  box.innerHTML = '';
  DATA.chips.forEach(function (c, i) {
    if (i > 0) box.appendChild(el('span', 'arw'));
    const n = el('div', 'chip');
    n.dataset.chip = String(i);
    n.innerHTML = '<i class="dot"></i><span class="cw"><span class="cn">' + c.name +
      '</span><span class="cx">' + c.note + '</span></span>';
    box.appendChild(n);
  });
}
function syncChain() {
  const cur = CHIP_OF_STEP[MICRO.step];
  $$('#chain .chip').forEach(function (n) {
    const i = +n.dataset.chip;
    n.classList.toggle('on', i === cur);
    n.classList.toggle('done', i < cur);
  });
}

/* ---------------- 构建：步骤条 ---------------- */
function buildSteps() {
  const box = $('#steps');
  box.innerHTML = '';
  STAGES.map(function (st, i) {
    const n = el('button', 'step');
    n.dataset.i = String(i);
    n.innerHTML = '<span class="n">' + (i + 1) + '</span>' + st.short;
    n.onclick = function () { goStep(i); };
    box.appendChild(n);
    if (i < STAGES.length - 1) box.appendChild(el('span', 'line'));
  });
}
function syncSteps() {
  $$('#steps .step').forEach(function (n) {
    const i = +n.dataset.i;
    n.classList.toggle('on', i === MICRO.step);
    n.classList.toggle('done', i < MICRO.step || (MICRO.visited[i] && i !== MICRO.step));
  });
}

/* ---------------- 构建：单元 tab ---------------- */
let UNIT_TABS = [];
function buildUnits() {
  const seen = [];
  STAGES.forEach(function (st, i) {
    if (seen.length && seen[seen.length - 1].group === st.group) return;
    if (seen.some(function (s) { return s.group === st.group; })) return;
    seen.push({ group: st.group, at: i });
  });
  UNIT_TABS = seen.slice(0, 4);
  const box = $('#units');
  box.innerHTML = '';
  UNIT_TABS.forEach(function (u, i) {
    const b = el('button', 'u', '<i></i>' + u.group);
    b.onclick = function () { goStep(u.at); };
    box.appendChild(b);
  });
}
function syncUnits() {
  $$('#units .u').forEach(function (b, i) {
    b.classList.toggle('on', UNIT_TABS[i] && UNIT_TABS[i].at === MICRO.step);
  });
}

/* ---------------- 构建：滑块 ---------------- */
function buildSliders() {
  const box = $('#sliders');
  box.innerHTML = '';
  SLIDERS.forEach(function (s) {
    const wrap = el('div', 'sl');
    wrap.innerHTML =
      '<div class="top"><span>' + s.name + '</span><span><b id="v' + s.key + '">' +
      VARS[s.key] + '</b><span class="u">' + s.unit + '</span></span></div>' +
      '<input type="range" id="r' + s.key + '" min="' + s.min + '" max="' + s.max +
      '" step="' + s.step + '" value="' + VARS[s.key] + '">' +
      '<div class="scale">' + s.scale.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>';
    box.appendChild(wrap);
    const input = wrap.querySelector('input');
    input.addEventListener('input', function () {
      VARS[s.key] = parseFloat(input.value);
      onVarsChanged();
    });
  });
}

function syncSliderValues() {
  SLIDERS.forEach(function (s) {
    const inp = document.getElementById('r' + s.key);
    if (inp) inp.value = String(VARS[s.key]);
    const lab = document.getElementById('v' + s.key);
    if (lab) lab.textContent = (s.key === 'T' && VARS.T % 1 !== 0) ? VARS.T.toFixed(1) : String(Math.round(VARS[s.key]));
  });
}

/* ---------------- 构建：预设 / 速查 ---------------- */
function buildPresets() {
  const box = $('#presets');
  box.innerHTML = '';
  PRESET_LIST.forEach(function (p) {
    const b = el('button', 'btn', p.label);
    if (p.key === 'normal') b.classList.add('pri');
    b.onclick = function () {
      const pre = DATA.presets[p.key];
      if (!pre) return;
      Object.assign(VARS, pre);
      onVarsChanged();
      toast('已切到「' + p.label + '」');
    };
    box.appendChild(b);
  });
}

function buildStruct() {
  const box = $('#stList');
  box.innerHTML = '';
  ORGAN_ORDER.forEach(function (id) {
    const o = ORGANISMS(id);
    const b = el('button', 'st');
    b.dataset.pick = id;
    b.innerHTML = '<i style="background:' + ORGAN_COLOR[id] + '"></i>' + o.name + '<em>—</em>';
    b.onclick = function () {
      selectPick(id, null);
      focusPick(id);
    };
    box.appendChild(b);
  });
}
function ORGANISMS(id) { return ORGANS[id]; }

function syncStructBtns() {
  $$('#stList .st').forEach(function (b) {
    const id = b.dataset.pick;
    b.classList.toggle('on', MICRO.pick === id);
    const o = organRead(id);
    const em = b.querySelector('em');
    if (em) em.textContent = fmt(o.net, 2);
  });
}

/* ---------------- 读到变化：3D + 数字 + 曲线 ---------------- */
function applyLive() {
  applyLightLevel(VARS.I);
  setLampLevel(clamp(VARS.I / 1600, 0, 1));
}

function onVarsChanged() {
  computeLive();
  applyLive();
  syncSliderValues();
  updateReadouts();
  drawMini();
  syncStructBtns();
  refreshPickCard();
}

function updateReadouts() {
  /* 三个读数统一两位小数。原先总光合/净光合只留 1 位（23.2 / 21.0），
     学生在「器官速查」里把 21.51 − 0.15 − 0.32 加起来正好是 21.04，
     却被显示成 21.0，闭合关系看着就不成立了。 */
  $('#roGross').textContent = fmt(LIVE.gross, 2);
  $('#roResp').textContent = fmt(LIVE.resp, 2);
  $('#roNet').textContent = fmt(LIVE.net, 2);
  $('#roNet').parentNode.classList.toggle('r', LIVE.net < 0);
}

/* ---------------- 迷你光响应曲线 ---------------- */
function drawMini() {
  const cv = $('#miniC');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  /* 画布内部分辨率必须跟着 CSS 盒子走。
     以前固定 620×186，被 width:100% 压到约 300px 显示，11px 的轴文字实际只剩 5px，
     投影上看就是一团黑点。现在按 CSS 盒 × dpr 建后备缓冲，下面所有坐标都用 CSS 像素。 */
  const W = Math.max(180, Math.round(cv.clientWidth || 300));
  const H = Math.max(76, Math.round(cv.clientHeight || 96));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const PL = 28, PR = 9, PT = 17, PB = 15;
  const x0 = PL, x1 = W - PR, y0 = PT, y1 = H - PB;
  ctx.clearRect(0, 0, W, H);

  const series = curveSeries({ T: VARS.T, C: VARS.C, O: VARS.O }, 61);
  let maxY = 1;
  series.forEach(function (p) { maxY = Math.max(maxY, p.gross); });
  maxY = Math.max(maxY, LIVE.resp) * 1.16;

  const X = function (I) { return x0 + (x1 - x0) * clamp(I / PHYS.iMax, 0, 1); };
  const Y = function (v) { return y1 - (y1 - y0) * clamp(v / maxY, 0, 1); };

  /* 网格 */
  ctx.strokeStyle = 'rgba(14,26,43,.07)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 3; k++) {
    const yy = y0 + ((y1 - y0) * k) / 3;
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
  }
  /* 零线（净光合为负时才有意义） */
  if (LIVE.resp > 0) {
    ctx.strokeStyle = 'rgba(14,26,43,.16)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* 图例：三条线不标名字，学生分不清哪条是总光合、哪条是净光合。
     画在绘图区上方的留白里（y < y0），从右往左排，右对齐。 */
  ctx.font = '9px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let lx = x1;
  [['#F59E0B', '呼吸'], ['#2F6BFF', '净光合'], ['#12A06A', '总光合']].forEach(function (it) {
    const tw = ctx.measureText(it[1]).width;
    lx -= tw;
    ctx.fillStyle = it[0];
    ctx.fillText(it[1], lx, y0 - 8);
    lx -= 7;
    ctx.beginPath(); ctx.arc(lx, y0 - 8, 2.4, 0, 6.2832); ctx.fill();
    lx -= 10;
  });
  ctx.textBaseline = 'alphabetic';

  /* 总光合 */
  ctx.strokeStyle = '#12A06A';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  series.forEach(function (p, i) {
    const px = X(p.I), py = Y(p.gross);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();

  /* 净光合 */
  ctx.strokeStyle = '#2F6BFF';
  ctx.beginPath();
  series.forEach(function (p, i) {
    const px = X(p.I), py = Y(p.net);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();

  /* 呼吸：一条水平线 */
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(x0, Y(LIVE.resp)); ctx.lineTo(x1, Y(LIVE.resp)); ctx.stroke();
  ctx.setLineDash([]);

  /* 补偿点 / 饱和点 */
  if (LIVE.comp != null) {
    const cx = X(LIVE.comp);
    ctx.strokeStyle = 'rgba(245,158,11,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); ctx.stroke();
  }
  if (LIVE.sat != null) {
    const sx = X(LIVE.sat);
    ctx.strokeStyle = 'rgba(18,160,106,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, y0); ctx.lineTo(sx, y1); ctx.stroke();
  }

  /* 当前工况点 */
  const px = X(VARS.I);
  ctx.fillStyle = '#2F6BFF';
  ctx.beginPath(); ctx.arc(px, Y(LIVE.gross), 3.2, 0, 6.2832); ctx.fill();
  ctx.fillStyle = LIVE.net < 0 ? '#EF4444' : '#0E7C4A';
  ctx.beginPath(); ctx.arc(px, Y(LIVE.net), 3.2, 0, 6.2832); ctx.fill();

  /* 坐标文字 */
  ctx.fillStyle = 'rgba(86,98,122,.92)';
  ctx.font = '9.5px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('光强 μmol·m⁻²·s⁻¹', (x0 + x1) / 2, H - 3);
  ctx.textAlign = 'left';
  ctx.fillText('0', x0 - 1, y1 + 10);
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.round(maxY)), x0 - 3, y0 + 8);

  const mark = $('#miniMarks');
  if (mark) {
    mark.innerHTML = '补偿点 <b>' + (LIVE.comp == null ? '—' : Math.round(LIVE.comp)) +
      '</b> · 饱和点 <b>' + (LIVE.sat == null ? '—' : Math.round(LIVE.sat)) + '</b>';
  }
}

/* ---------------- 左栏 ---------------- */
function renderStepPanel(st) {
  $('#sIdx').textContent = (st.idx + 1 < 10 ? '0' : '') + (st.idx + 1);
  $('#sName').textContent = st.name;
  $('#sQ').textContent = st.question;
  $('#sScene').textContent = '画面：' + (VIEW_LABEL[st.visualState] || st.group) +
    '　口径：' + st.scope;
  $('#sAct').textContent = st.action;
  $('#sExpect').textContent = st.expect;
  $('#sConcl').textContent = st.conclusion;
  $('#sPoint').textContent = st.point;
  $('#sExam').textContent = st.exam;
  $('#sWarn').textContent = st.warning;

  const chip = $('#tryChip');
  const done = !!MICRO.visited[st.idx] && MICRO.reveal;
  chip.className = 'chip small' + (done ? ' done' : '');
  chip.innerHTML = '<i class="dot"></i>' + (done ? '已完成' : '还没做');

  const vb = $('#sVerdict');
  vb.hidden = !MICRO.reveal;

  const rb = $('#btnReveal');
  if (MICRO.reveal) {
    rb.textContent = '结论已揭示';
    rb.classList.remove('pri');
    rb.classList.add('done');
  } else {
    rb.textContent = '揭示结论';
    rb.classList.add('pri');
    rb.classList.remove('done');
  }
}

function doReveal() {
  if (MICRO.reveal) return;
  MICRO.reveal = true;
  $('#sVerdict').hidden = false;
  const st = STAGES[MICRO.step];
  renderStepPanel(st);
  const chip = $('#tryChip');
  chip.className = 'chip small done';
  chip.innerHTML = '<i class="dot"></i>已完成';
  const vb = $('#sVerdict');
  vb.style.animation = 'none';
  void vb.offsetWidth;
  vb.style.animation = '';
}

/* ---------------- 3D 浮动标签 ---------------- */
let TAG_LIST = [];
function buildTags() {
  const defs = [
    { id: 'lamp', text: '日光灯', color: '#F59E0B' },
    { id: 'co2', text: 'CO₂ 探头', color: '#D9822B' },
    { id: 'o2', text: 'O₂ 探头', color: '#18A06D' },
    { id: 'leaf', text: '叶片 · 唯一固碳器官', color: '#12A06A' },
    { id: 'stem', text: '茎 · 只呼吸', color: '#7C9E4E' },
    { id: 'root', text: '根 · 只呼吸', color: '#C08457' }
  ];
  const box = $('#tags');
  box.innerHTML = '';
  const anchors = {
    lamp: LAMP_ANCHOR.clone(),
    co2: new THREE.Vector3(),
    o2: new THREE.Vector3(),
    leaf: new THREE.Vector3(),
    stem: new THREE.Vector3(0.07, 1.22, -0.06),
    root: new THREE.Vector3(0.05, 0.30, 0.06)
  };
  sensorPods.co2.tip.getWorldPosition(anchors.co2);
  sensorPods.o2.tip.getWorldPosition(anchors.o2);
  const rec = leafRecords[Math.min(9, leafRecords.length - 1)];
  rec.mesh.getWorldPosition(anchors.leaf);
  anchors.leaf.y += 0.16;

  TAG_LIST = defs.map(function (d) {
    const n = el('div', 'tag', '<i style="background:' + d.color + '"></i>' + d.text);
    box.appendChild(n);
    return { id: d.id, node: n, anchor: anchors[d.id] };
  });
}

const _proj = new THREE.Vector3();
function updateTags() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  for (let i = 0; i < TAG_LIST.length; i++) {
    const t = TAG_LIST[i];
    _proj.copy(t.anchor).project(camera);
    const vis = _proj.z < 1 && Math.abs(_proj.x) < 1.25 && Math.abs(_proj.y) < 1.25;
    t.node.style.opacity = vis ? '' : '0';
    if (!vis) continue;
    t.node.style.left = ((_proj.x * 0.5 + 0.5) * w).toFixed(1) + 'px';
    t.node.style.top = ((-_proj.y * 0.5 + 0.5) * h).toFixed(1) + 'px';
    const dim = MICRO.pick && MICRO.pick !== t.id &&
      (t.id === 'leaf' || t.id === 'stem' || t.id === 'root');
    t.node.classList.toggle('dim', !!dim);
  }
}

/* ---------------- 步进 ---------------- */
function goStep(i, opts) {
  opts = opts || {};
  i = clamp(i | 0, 0, LAST);
  MICRO.step = i;
  MICRO.reveal = !!opts.reveal;
  MICRO.visited[i] = true;
  const st = STAGES[i];

  /* 跟随脚本时，切步把变量拉回本步设定；自由探究时不碰 */
  if (!MICRO.explore && st.preset) {
    VARS.I = st.preset.I; VARS.T = st.preset.T;
    VARS.C = st.preset.C; VARS.O = st.preset.O;
    computeLive();
  }
  applyLive();
  syncSliderValues();
  updateReadouts();
  drawMini();
  syncStructBtns();

  if (!MICRO.explore) resumeAuto(opts.instant);

  /* 单元色 */
  const u = stepUnit(i);
  const root = document.documentElement.style;
  root.setProperty('--uc', u.uc);
  root.setProperty('--ucs', u.ucs);
  root.setProperty('--uh', u.uh);

  renderStepPanel(st);
  syncSteps();
  syncChain();
  syncUnits();

  const eqb = $('#eqb');
  const e = EQB[i] || ['', ''];
  eqb.innerHTML = '<span class="eq">' + e[0] + '</span><span class="cond">' + e[1] + '</span>';

  $('#footPos').textContent = '第 ' + (i + 1) + ' / ' + N_STEPS + ' 步 · ' + st.short;
  $('#cbName').textContent = '第 ' + (i + 1) + ' 步 · ' + st.short;

  clearPick();

  $('#prev').classList.toggle('done', false);
  $('#next').textContent = (i === LAST) ? '回到第 1 步 ↺' : '下一步 ›';

  speakStage(st);

  if (i === LAST) openQuiz(); else closeQuiz();
}

function nextStep() {
  if (MICRO.step >= LAST) { goStep(0); return; }
  goStep(MICRO.step + 1);
}
function prevStep() {
  if (MICRO.step <= 0) { toast('已经是第一步了'); return; }
  goStep(MICRO.step - 1);
}

/* ---------------- 面板三档折叠 ---------------- */
function togglePanel(side) {
  const b = document.body;
  if (matchMedia('(max-width:1180px)').matches) {
    b.classList.toggle('show-' + side);
    b.classList.remove('show-' + (side === 'l' ? 'r' : 'l'));
  } else {
    b.classList.toggle('hide-' + side);
  }
  syncPanelBtns();
  /* 面板宽度过渡 0.24s，结束后重画迷你曲线，否则画布会被横向拉扁 */
  setTimeout(function () { resize(); drawMini(); }, 280);
}

function syncPanelBtns() {
  $('#tgLeft').classList.toggle('on', document.body.classList.contains('hide-l') ||
    document.body.classList.contains('show-l'));
  $('#tgRight').classList.toggle('on', document.body.classList.contains('hide-r') ||
    document.body.classList.contains('show-r'));
  $('#tgCinema').classList.toggle('on', document.body.classList.contains('cinema'));
}

function toggleCinema() {
  document.body.classList.toggle('cinema');
  syncPanelBtns();
  setTimeout(function () { resize(); drawMini(); }, 300);
}

function exitCinema() {
  if (document.body.classList.contains('cinema')) {
    document.body.classList.remove('cinema');
    syncPanelBtns();
    setTimeout(function () { resize(); drawMini(); }, 300);
    return true;
  }
  return false;
}

function toggleFull() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(function () {
      toast('这个浏览器不允许全屏，试试 F11');
    });
  } else {
    toast('这个浏览器不支持全屏，试试 F11');
  }
}

/* ---------------- 键盘 ---------------- */
function onKey(e) {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key;
  if (k === 'ArrowRight') { e.preventDefault(); nextStep(); return; }
  if (k === 'ArrowLeft') { e.preventDefault(); prevStep(); return; }
  if (k === ' ' || k === 'Enter') {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault(); doReveal(); return;
  }
  if (/^[1-9]$/.test(k)) { goStep(parseInt(k, 10) - 1); return; }
  const low = k.toLowerCase();
  if (low === 'h') { togglePanel('l'); return; }
  if (low === 'j') { togglePanel('r'); return; }
  if (low === 'f') {
    if (e.shiftKey) toggleFull(); else toggleCinema();
    return;
  }
  if (low === 'r') { resumeAuto(); toast('视角已复位'); return; }
  if (low === 'q') { goStep(LAST); return; }
  if (k === 'Escape') {
    if (exitCinema()) return;
    if (MICRO.quizOpen) { closeQuiz(); return; }
    clearPick();
  }
}

/* ---------------- 启动 ---------------- */
function boot() {
  /* 标题与主线问题 */
  document.title = META.title + '（教学驾驶舱）';
  $('#cTitle').textContent = META.title.replace(' · ', '｜');
  $('#cSub').textContent = META.subtitle;
  $('#mqText').textContent = META.mainQuestion;
  $('#footPos').textContent = '第 1 / ' + N_STEPS + ' 步';

  buildChain();
  buildSteps();
  buildUnits();
  buildSliders();
  buildPresets();
  buildStruct();
  buildTags();

  /* 顶栏按钮 */
  $('#next').onclick = nextStep;
  $('#prev').onclick = prevStep;
  $('#btnReveal').onclick = doReveal;
  $('#btnReset').onclick = function () {
    const st = STAGES[MICRO.step];
    if (st.preset) { Object.assign(VARS, st.preset); onVarsChanged(); }
    clearPick();
    resumeAuto();
    toast('已复位到本步设定');
  };
  $('#tgLeft').onclick = function () { togglePanel('l'); };
  $('#tgRight').onclick = function () { togglePanel('r'); };
  $('#tgCinema').onclick = toggleCinema;
  $('#cbExit').onclick = exitCinema;
  $('#btnFull').onclick = toggleFull;
  $('#btnHome').onclick = function () { resumeAuto(); toast('视角已复位'); };
  $('#pcX').onclick = clearPick;
  $('#btnExplore').onclick = function () {
    MICRO.explore = !MICRO.explore;
    $('#btnExplore').classList.toggle('on', MICRO.explore);
    toast(MICRO.explore ? '自由探究：切步不再改动你的变量' : '已回到脚本模式：切步会拉回本步设定');
  };
  $('#btnQuiz').onclick = function () { goStep(LAST); };

  /* 空面板点击：关掉读数卡 */
  stageEl.addEventListener('pointerdown', function (e) {
    if (e.target === glCanvas && MICRO.pick) {
      const t = performance.now();
      setTimeout(function () {
        if (performance.now() - t > 40 && MICRO.pick && !selBox.visible) clearPick();
      }, 50);
    }
  });

  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', function () {
    setTimeout(resize, 30);
    setTimeout(drawMini, 40);
  });

  resize();
  applyLive();
  setOrganFocus(null);
  initVoice();
  resumeAuto(true);
  goStep(initialStep(), { instant: true });
  showGloveTipOnce();
  syncPanelBtns();
  requestAnimationFrame(frame);
}

/* 主循环 */
let _last = performance.now();
let _fpsAcc = 0, _fpsN = 0, _lowChecked = false;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - _last) / 1000));
  _last = now;
  const time = now / 1000;

  updateViewCamera(dt);
  updatePlant(dt, time, clamp(LIVE.gross / 27, 0, 1.15));
  emitParticles(dt);
  updateParticles(dt);
  updateDust(dt, time, clamp(VARS.I / 2000, 0, 1));
  updateSensors(LIVE.net, Math.abs(LIVE.net), time);
  updateSelBox();
  updateTags();

  renderer.render(scene, camera);

  /* 低帧率降级：前 90 帧平均超过 26ms 就关掉毛玻璃 */
  if (!_lowChecked) {
    _fpsAcc += dt; _fpsN++;
    if (_fpsN >= 90) {
      _lowChecked = true;
      if (_fpsAcc / _fpsN > 0.026) document.body.classList.add('lowfps');
    }
  }
  requestAnimationFrame(frame);
}
