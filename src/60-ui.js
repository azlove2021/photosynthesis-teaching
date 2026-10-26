/* =========================================================
   60 · UI 绑定、旁白、任务、主循环
   ========================================================= */
'use strict';

const $ = id => document.getElementById(id);

const el = {
  sldLight: $('sldLight'), outLight: $('outLight'),
  sldTemp: $('sldTemp'), outTemp: $('outTemp'),
  sldCO2: $('sldCO2'), outCO2: $('outCO2'),
  sldO2: $('sldO2'), outO2: $('outO2'),
  tempWrap: $('tempWrap'), tempPills: $('tempPills'),
  tgWhole: $('tgWhole'),
  vGross: $('vGross'), vResp: $('vResp'), vNet: $('vNet'),
  bpFill: $('bpFill'), ledgerNote: $('ledgerNote'),
  ledgerSub: $('ledgerSub'),
  co2Val: $('co2Val'), o2Val: $('o2Val'),
  co2Trend: $('co2Trend'), o2Trend: $('o2Trend'),
  nrTag: $('nrTag'), nrText: $('nrText'),
  chartFoot: $('chartFoot'),
  taskPanel: $('taskPanel'), taskList: $('taskList'),
  modeSeg: $('modeSeg'),
  ctlLabNodes: document.querySelectorAll('.ctl-lab')
};

/* ---------- 滑杆填充色 ---------- */
function paintRange(input) {
  const p = (input.value - input.min) / (input.max - input.min) * 100;
  input.style.setProperty('--p', p.toFixed(1) + '%');
}

/* ---------- 演示态 / 探究态 ---------- */
function setMode(m) {
  State.mode = m;
  el.modeSeg.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === m));
  const lab = m === 'lab';
  el.ctlLabNodes.forEach(n => { n.style.display = lab ? '' : 'none'; });
  el.tempWrap.style.display = lab ? '' : 'none';
  el.tempPills.style.display = lab ? 'none' : '';
  el.taskPanel.hidden = !lab;
  $('chartSub').textContent = lab
    ? '实线 净光合 · 虚线 总光合'
    : '实线 净光合 · 虚线 总光合 · 淡线 温度对照';
  if (lab) el.nrTag.textContent = '探究';
  requestAnimationFrame(resizeChart);
}

/* ---------- 读数与旁白 ---------- */
function updateReadouts(dt) {
  const r = State.rates;
  State.shown.gross = damp(State.shown.gross, r.gross, 9, dt);
  State.shown.resp = damp(State.shown.resp, r.resp, 9, dt);
  State.shown.net = damp(State.shown.net, r.net, 9, dt);

  el.vGross.textContent = fmt(State.shown.gross, 1);
  el.vResp.textContent = fmt(State.shown.resp, 1);
  el.vNet.textContent = fmt(State.shown.net, 1);
  el.vNet.parentNode.classList.toggle('neg', State.shown.net < -0.05);

  const span = Math.max(12, pmaxAt(State.T, State.C, State.O) * 1.05);
  const w = clamp(Math.abs(r.net) / span, 0, 1) * 50;
  if (r.net >= 0) {
    el.bpFill.style.left = '50%';
    el.bpFill.style.width = w + '%';
    el.bpFill.style.background = '#7eb6ff';
  } else {
    el.bpFill.style.left = (50 - w) + '%';
    el.bpFill.style.width = w + '%';
    el.bpFill.style.background = '#ff7a6b';
  }

  el.ledgerSub.textContent = State.T + ' ℃ · ' + State.C + ' ppm · ' + State.O + '% O₂';

  /* 箱内读数 */
  const cO2 = Math.round(State.chamberCO2);
  el.co2Val.textContent = cO2;
  el.o2Val.textContent = State.chamberO2.toFixed(2);

  if (Math.abs(r.net) < 0.25) {
    el.co2Trend.textContent = '→ 不变'; el.co2Trend.className = 'strend';
    el.o2Trend.textContent = '→ 不变'; el.o2Trend.className = 'strend';
  } else if (r.net > 0) {
    el.co2Trend.textContent = '↓ 下降'; el.co2Trend.className = 'strend down';
    el.o2Trend.textContent = '↑ 上升'; el.o2Trend.className = 'strend down';
  } else {
    el.co2Trend.textContent = '↑ 上升'; el.co2Trend.className = 'strend up';
    el.o2Trend.textContent = '↓ 下降'; el.o2Trend.className = 'strend up';
  }

  /* 对账提示 */
  if (r.net > 0.3) {
    el.ledgerNote.textContent = '净光合为正：总光合中超出呼吸的那部分，才是真正积累下来的';
  } else if (r.net < -0.3) {
    el.ledgerNote.textContent = '净光合为负：呼吸消耗大于光合制造，箱内 CO₂ 仍在升高';
  } else {
    el.ledgerNote.textContent = '总光合恰等于呼吸 —— 净光合为 0，箱内浓度停止变化';
  }
}

function narrate() {
  const r = State.rates;
  const comp = State.comp, sat = State.sat;
  let tag = '当前状态', cls = '', text = '';

  const gTxt = fmt(r.gross, 1), rTxt = fmt(r.resp, 1), nTxt = fmt(r.net, 1);

  if (State.I < 1) {
    tag = '黑暗'; cls = 'neg';
    text = '没有光照：总光合 = 0。整株仍在进行呼吸作用，净光合 = −呼吸 = ' + nTxt +
      '。箱内 CO₂ 持续升高、O₂ 持续下降。';
  } else if (comp !== null && State.I < comp * 0.97) {
    tag = '弱光'; cls = 'neg';
    text = '光强 ' + Math.round(State.I) + ' 低于光补偿点 ' + Math.round(comp) +
      '：光合制造的有机物 < 呼吸消耗的，净光合为负（' + nTxt +
      '）。注意——呼吸并没有停，只是被光合抵消了一部分。';
  } else if (comp !== null && Math.abs(State.I - comp) <= Math.max(6, comp * 0.03)) {
    tag = '光补偿点'; cls = 'warn';
    text = '光强 ≈ 光补偿点：总光合 = 呼吸，净光合 = 0。此刻箱内 CO₂ 与 O₂ 浓度都停止变化——一个"看起来什么都没发生"的临界点。';
  } else if (sat !== null && State.I >= sat * 0.97) {
    tag = '光饱和'; cls = 'neutral';
    text = '光已饱和：再增加光强，总光合也不再上升（受暗反应、CO₂ 供应与酶的限制）。此时净光合 ' + nTxt +
      ' 已接近这株植物的上限。';
  } else {
    tag = '正积累'; cls = '';
    text = '光强已越过补偿点：总光合 ' + gTxt + ' > 呼吸 ' + rTxt + '，净光合 ' + nTxt +
      '。多出来的这一段，才是有机物真正积累的量，也是箱内 CO₂ 下降的原因。';
  }

  if (State.T >= 34 || State.T <= 15) {
    text += ' 温度 ' + State.T + ' ℃ 使呼吸速率变为 ' + rTxt +
      '（Q₁₀≈2），光补偿点随之移到 ' +
      (comp === null ? '测不出' : Math.round(comp)) + '。';
  }

  if (!State.whole) {
    text += ' 当前只计叶片；切回整株，根与茎只呼吸不光合，净光合会进一步降低。';
  }

  el.nrTag.textContent = tag;
  el.nrTag.className = 'nr-tag' + (cls ? ' ' + cls : '');
  el.nrText.textContent = text;
}

/* ---------- 任务卡 ---------- */
const TASKS = [
  {
    id: 'dark', title: '把光关掉，量出呼吸速率',
    desc: '光强拖到 0，总光合为 0，此时净光合 = −呼吸。屏幕上的读数直接就是这株植物的呼吸速率（μmol CO₂·m⁻²·s⁻¹）。',
    apply: () => setLight(0)
  },
  {
    id: 'gross', title: '总光合测不到，怎么办？',
    desc: '传感器只能测"净"：箱内 CO₂ 减少了多少、O₂ 增加了多少。总光合必须推算。① 黑白瓶法：黑瓶只呼吸、白瓶净光合，白 − 黑 = 总光合。② 半叶法：对称半叶一半遮光，烘干称重之差即总光合积累量。③ 叶圆片上浮法：真空抽气使叶圆片下沉，光照后上浮数量反映净光合。',
    apply: () => { setLight(900); }
  },
  {
    id: 'whole', title: '整株 ≠ 叶片，差在哪？',
    desc: '把「计入根茎呼吸」从"整株"切成"只看叶片"，看净光合读数怎么变。根、茎、成熟果实只呼吸不光合，所以同一时刻整株的净光合总是更低——这是高考题最爱设的陷阱。',
    apply: () => setWhole(false)
  }
];

let taskDone = {};

function renderTasks() {
  el.taskList.innerHTML = '';
  TASKS.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'task' + (taskDone[t.id] ? ' done' : '');
    d.innerHTML = '<span class="tn">0' + (i + 1) + '</span>' +
      '<div><div class="tt">' + t.title + '</div>' +
      '<div class="td" hidden>' + t.desc + '</div></div>';
    d.addEventListener('click', () => {
      const td = d.querySelector('.td');
      td.hidden = !td.hidden;
      if (!td.hidden) {
        taskDone[t.id] = true;
        d.classList.add('done');
        t.apply();
      }
    });
    el.taskList.appendChild(d);
  });
}

/* ---------- 控件绑定 ---------- */
function setLight(v) {
  State.I = clamp(Math.round(v), 0, PHYS.iMax);
  el.sldLight.value = State.I;
  paintRange(el.sldLight);
  el.outLight.innerHTML = State.I + ' <i>μmol·m⁻²·s⁻¹</i>';
  if (State.I > State.maxI) State.maxI = State.I;
  recompute();
}

function setTemp(v) {
  State.T = v;
  el.sldTemp.value = v;
  paintRange(el.sldTemp);
  el.outTemp.innerHTML = v + ' <i>℃</i>';
  el.tempPills.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', Math.abs(+b.dataset.t - v) < 0.5));
  recompute();
}

function setCO2(v) {
  State.C = v;
  el.sldCO2.value = v;
  paintRange(el.sldCO2);
  el.outCO2.innerHTML = v + ' <i>ppm</i>';
  recompute();
}

function setO2(v) {
  State.O = v;
  el.sldO2.value = v;
  paintRange(el.sldO2);
  el.outO2.innerHTML = v + ' <i>%</i>';
  recompute();
}

function setWhole(w) {
  State.whole = w;
  el.tgWhole.querySelectorAll('button').forEach(b =>
    b.classList.toggle('on', b.dataset.v === (w ? 'whole' : 'leaf')));
  recompute();
}

el.sldLight.addEventListener('input', e => setLight(+e.target.value));
el.sldTemp.addEventListener('input', e => setTemp(+e.target.value));
el.sldCO2.addEventListener('input', e => setCO2(+e.target.value));
el.sldO2.addEventListener('input', e => setO2(+e.target.value));

el.tempPills.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setTemp(+b.dataset.t);
});

el.tgWhole.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setWhole(b.dataset.v === 'whole');
});

el.modeSeg.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setMode(b.dataset.mode);
});

document.querySelectorAll('.presets button').forEach(b => {
  b.addEventListener('click', () => {
    const p = b.dataset.p;
    if (p === '0') setLight(0);
    else if (p === 'weak') setLight(State.comp ? State.comp * 0.5 : 30);
    else if (p === 'comp') setLight(State.comp || 60);
    else if (p === 'sat') setLight(State.sat || 1200);
  });
});

function resetAll() {
  setLight(DEFAULT_STATE.I);
  setTemp(DEFAULT_STATE.T);
  setCO2(DEFAULT_STATE.C);
  setO2(DEFAULT_STATE.O);
  setWhole(DEFAULT_STATE.whole);
  State.maxI = DEFAULT_STATE.I;
  State.chamberCO2 = DEFAULT_STATE.C;
  State.chamberO2 = 20.9;
  resetCamera();
}
$('btnReset').addEventListener('click', resetAll);

$('btnHelp').addEventListener('click', () => { $('helpMask').hidden = false; });
$('helpClose').addEventListener('click', () => { $('helpMask').hidden = true; });
$('helpMask').addEventListener('click', e => {
  if (e.target === $('helpMask')) $('helpMask').hidden = true;
});

window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
    e.preventDefault();
    resetAll();
  }
});

/* ---------- 主循环 ---------- */
const clock = new THREE.Clock();
let chartTimer = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.055);
  State.t += dt;

  /* 相机 */
  Orbit.autoIdle += dt;
  if (!Orbit.dragging && Orbit.autoIdle > 5) Orbit.taz += dt * 0.048;
  Orbit.az = damp(Orbit.az, Orbit.taz, 7, dt);
  Orbit.pol = damp(Orbit.pol, Orbit.tpol, 7, dt);
  Orbit.dist = damp(Orbit.dist, Orbit.tdist, 5, dt);
  applyCamera();

  /* 箱内浓度：净交换驱动的偏移 + 自动补气回落 */
  const net = State.rates.net;
  State.chamberCO2 = State.C + (State.chamberCO2 - State.C) * Math.exp(-dt / 42) - net * 0.062 * dt;
  State.chamberO2 = clamp(
    State.O + (State.chamberO2 - State.O) * Math.exp(-dt / 42) + net * 0.0009 * dt, 3, 60);

  /* 光照视觉 */
  const ln = clamp(State.I / PHYS.iMax, 0, 1);
  sun.intensity = 0.25 + ln * 1.95;
  hemi.intensity = 0.34 + ln * 0.28;
  beamMesh.material.opacity = 0.030 + ln * 0.22;
  sunSprite.material.opacity = 0.18 + ln * 0.8;
  const ss = 1.15 + ln * 0.85;
  sunSprite.scale.set(ss, ss, 1);
  rootGlow.intensity = clamp(State.rates.resp / 5, 0, 1.2) * 0.55;

  /* 植株与粒子 */
  const grossNorm = clamp(State.rates.gross / 27, 0, 1.1);
  updatePlant(dt, State.t, grossNorm);
  plant.updateMatrixWorld(true);
  emitParticles(dt);
  updateParticles(dt);
  updateDust(dt, State.t, ln);
  updateSensors(State.rates.net >= 0 ? 1 : -1, Math.abs(State.rates.net), State.t);

  /* 面板 */
  updateReadouts(dt);
  chartTimer += dt;
  if (chartTimer > 0.06) { chartTimer = 0; drawChart(); narrate(); }

  renderer.render(scene, camera);
}

/* ---------- 启动 ---------- */
function boot() {
  renderTasks();
  resize();
  resizeChart();
  setMode('demo');
  setLight(State.I);
  setTemp(State.T);
  setCO2(State.C);
  setO2(State.O);
  setWhole(State.whole);
  recompute();
  setTimeout(() => { resize(); resizeChart(); }, 120);
  frame();
}
boot();
