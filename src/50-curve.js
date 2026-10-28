/* =========================================================
   50 · 曲线面板：净光合曲线 + 总光合曲线 + 关键点标注

   配色统一走 CH 调色板。暗底版本里大量用到"半透明白"，
   在浅底上等于隐身，所以整组颜色必须按"纸面"重配：
   网格浅灰蓝、文字深灰、三条语义色（净=蓝 / 总=绿 / 呼吸=橙）加深。
   ========================================================= */
'use strict';

const chartCanvas = document.getElementById('chart');
const cctx = chartCanvas.getContext('2d');
let chartW = 300, chartH = 200, chartDPR = 1;

/* 语义色：净光合=蓝，总光合=绿，呼吸=橙，负值=红。
   与 CSS 变量、HUD 图例、粒子流保持一致，全站只有这一套色。 */
const CH = {
  grid: 'rgba(22,34,46,0.075)',
  axis: 'rgba(47,108,150,0.36)',
  zero: 'rgba(22,34,46,0.30)',
  tick: '#5b7183',
  axisLab: '#8398a9',
  negArea: 'rgba(217,69,58,0.065)',
  ghost: 'rgba(96,140,180,0.30)',
  ghostLab: '#93a6b6',
  gross: 'rgba(16,150,99,0.80)',
  net0: '#1f6fd0',
  net1: '#3d94e8',
  net2: '#63b3ff',
  netGlow: 'rgba(63,148,232,0.30)',
  resp: 'rgba(196,116,18,0.85)',
  respLab: '#b06a10',
  neg: '#d9453a',
  negLab: '#c93a2e',
  sat: 'rgba(16,150,99,0.95)',
  satLab: '#0e8a5c',
  dotFill: 'rgba(255,255,255,0.95)',
  cross: 'rgba(22,34,46,0.16)',
  note: '#8398a9'
};

function resizeChart() {
  const box = chartCanvas.getBoundingClientRect();
  chartDPR = Math.min(window.devicePixelRatio || 1, 2);
  chartW = Math.max(180, box.width);
  chartH = Math.max(120, box.height);
  chartCanvas.width = Math.round(chartW * chartDPR);
  chartCanvas.height = Math.round(chartH * chartDPR);
  cctx.setTransform(chartDPR, 0, 0, chartDPR, 0, 0);
  /* 重建画布会清空内容，必须立刻重绘一次，否则会留下一块空白 */
  if (typeof drawChart === 'function') drawChart();
}

const CP = { l: 50, r: 18, t: 24, b: 38 };

function netOf(I, T, C, O, whole) {
  return grossAt(I, T, C, O) - respAt(T, whole);
}

function chartRanges() {
  let pmax = 1, rd = 1;
  const temps = [15, 25, 35, State.T];
  for (let i = 0; i < temps.length; i++) {
    pmax = Math.max(pmax, pmaxAt(temps[i], State.C, State.O));
    rd = Math.max(rd, respAt(temps[i], State.whole));
  }
  const yMax = Math.ceil(pmax * 1.10 / 5) * 5;
  const yMin = -Math.ceil(Math.max(rd * 1.55, 3.6) / 2) * 2;
  return { yMax: yMax, yMin: yMin };
}

function drawChart() {
  const W = chartW, H = chartH;
  cctx.clearRect(0, 0, W, H);

  const { yMax, yMin } = chartRanges();
  const plotL = CP.l, plotR = W - CP.r, plotT = CP.t, plotB = H - CP.b;
  const plotW = plotR - plotL, plotH = plotB - plotT;
  const xOf = I => plotL + (I / PHYS.iMax) * plotW;
  const yOf = v => plotT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  /* --- 负值区底纹 --- */
  const yZero = yOf(0);
  cctx.fillStyle = CH.negArea;
  cctx.fillRect(plotL, yZero, plotW, plotB - yZero);

  /* --- 网格 --- */
  cctx.strokeStyle = CH.grid;
  cctx.lineWidth = 1;
  const yStep = (yMax - yMin) > 40 ? 10 : 5;
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    const y = Math.round(yOf(v)) + 0.5;
    cctx.beginPath(); cctx.moveTo(plotL, y); cctx.lineTo(plotR, y); cctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const x = Math.round(plotL + (i / 4) * plotW) + 0.5;
    cctx.beginPath(); cctx.moveTo(x, plotT); cctx.lineTo(x, plotB); cctx.stroke();
  }

  /* --- 坐标轴 --- */
  cctx.strokeStyle = CH.axis;
  cctx.beginPath();
  cctx.moveTo(plotL + 0.5, plotT); cctx.lineTo(plotL + 0.5, plotB + 0.5);
  cctx.lineTo(plotR, plotB + 0.5);
  cctx.stroke();

  /* --- 零线 --- */
  cctx.strokeStyle = CH.zero;
  cctx.lineWidth = 1;
  cctx.beginPath();
  cctx.moveTo(plotL, Math.round(yZero) + 0.5);
  cctx.lineTo(plotR, Math.round(yZero) + 0.5);
  cctx.stroke();

  /* --- 坐标刻度 --- */
  cctx.fillStyle = CH.tick;
  cctx.font = '10px ui-monospace,Consolas,monospace';
  cctx.textAlign = 'right'; cctx.textBaseline = 'middle';
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    if (Math.abs(v) < 0.01) continue;
    cctx.fillText(String(v), plotL - 7, yOf(v));
  }
  cctx.fillText('0', plotL - 7, yZero);

  cctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const xp = plotL + (i / 4) * plotW;
    cctx.textAlign = i === 0 ? 'left' : (i === 4 ? 'right' : 'center');
    cctx.fillText(String(Math.round(PHYS.iMax * i / 4)), xp, plotB + 6);
  }
  cctx.textAlign = 'center';
  cctx.fillStyle = CH.axisLab;
  cctx.font = '9px "PingFang SC","Microsoft YaHei",sans-serif';
  cctx.fillText('光照强度 μmol·m⁻²·s⁻¹', (plotL + plotR) / 2, plotB + 20);

  cctx.textAlign = 'left'; cctx.textBaseline = 'top';
  cctx.fillStyle = CH.axisLab;
  cctx.fillText('μmol CO₂·m⁻²·s⁻¹', plotL + 2, 3);

  /* --- 温度对照鬼影线（演示态） --- */
  if (State.mode === 'demo') {
    const temps = [15, 25, 35];
    for (let k = 0; k < temps.length; k++) {
      const T = temps[k];
      if (Math.abs(T - State.T) < 0.5) continue;
      cctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const I = (i / 80) * PHYS.iMax;
        const v = netOf(I, T, State.C, State.O, State.whole);
        const x = xOf(I), y = yOf(v);
        i === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
      }
      cctx.strokeStyle = CH.ghost;
      cctx.lineWidth = 1;
      cctx.setLineDash([2, 3]);
      cctx.stroke();
      cctx.setLineDash([]);
      const vEnd = netOf(PHYS.iMax, T, State.C, State.O, State.whole);
      cctx.fillStyle = CH.ghostLab;
      cctx.font = '9px ui-monospace,Consolas,monospace';
      cctx.textAlign = 'right'; cctx.textBaseline = 'middle';
      cctx.fillText(T + '℃', plotR - 2, yOf(vEnd) + (T > State.T ? 9 : -9));
    }
  }

  /* --- 曲线绘制（裁剪到已探索光强） --- */
  const revealX = xOf(clamp(State.maxI, 24, PHYS.iMax));
  cctx.save();
  cctx.beginPath();
  cctx.rect(plotL - 2, plotT - 8, revealX - plotL + 2, plotH + 16);
  cctx.clip();

  /* 总光合（虚线） */
  cctx.beginPath();
  const N = 110;
  for (let i = 0; i <= N; i++) {
    const I = (i / N) * PHYS.iMax;
    const v = grossAt(I, State.T, State.C, State.O);
    const x = xOf(I), y = yOf(v);
    i === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
  }
  cctx.strokeStyle = CH.gross;
  cctx.lineWidth = 1.7;
  cctx.setLineDash([5, 4]);
  cctx.stroke();
  cctx.setLineDash([]);

  /* 净光合（实线） */
  cctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const I = (i / N) * PHYS.iMax;
    const v = netOf(I, State.T, State.C, State.O, State.whole);
    const x = xOf(I), y = yOf(v);
    i === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
  }
  const grad = cctx.createLinearGradient(plotL, 0, plotR, 0);
  grad.addColorStop(0, CH.net0);
  grad.addColorStop(0.55, CH.net1);
  grad.addColorStop(1, CH.net2);
  cctx.strokeStyle = grad;
  cctx.lineWidth = 2.4;
  cctx.shadowColor = CH.netGlow;
  cctx.shadowBlur = 6;
  cctx.stroke();
  cctx.shadowBlur = 0;
  cctx.restore();

  /* --- 呼吸间距标注（在当前光强处） --- */
  const curI = State.I;
  const gNow = grossAt(curI, State.T, State.C, State.O);
  const nNow = gNow - respAt(State.T, State.whole);
  if (curI > 30) {
    const x = xOf(curI);
    const y1 = yOf(nNow), y2 = yOf(gNow);
    cctx.strokeStyle = CH.resp;
    cctx.lineWidth = 1;
    cctx.setLineDash([3, 3]);
    cctx.beginPath();
    cctx.moveTo(x, y1); cctx.lineTo(x, y2);
    cctx.stroke();
    cctx.setLineDash([]);
    cctx.beginPath();
    cctx.moveTo(x - 3, y1); cctx.lineTo(x + 3, y1);
    cctx.moveTo(x - 3, y2); cctx.lineTo(x + 3, y2);
    cctx.stroke();
    if (Math.abs(y2 - y1) > 14) {
      cctx.fillStyle = CH.respLab;
      cctx.font = '9px "PingFang SC",sans-serif';
      cctx.textAlign = 'left'; cctx.textBaseline = 'middle';
      cctx.fillText('呼吸', x + 5, (y1 + y2) / 2);
    }
  }

  /* --- 光补偿点 --- */
  if (State.comp !== null && State.comp <= State.maxI) {
    const x = xOf(State.comp), y = yOf(0);
    cctx.beginPath();
    cctx.arc(x, y, 3.6, 0, 6.2832);
    cctx.fillStyle = CH.neg;
    cctx.fill();
    cctx.strokeStyle = 'rgba(217,69,58,0.45)';
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.arc(x, y, 7, 0, 6.2832);
    cctx.stroke();
    cctx.fillStyle = CH.negLab;
    cctx.font = '9.5px "PingFang SC",sans-serif';
    cctx.textAlign = 'left'; cctx.textBaseline = 'bottom';
    cctx.fillText('光补偿点', Math.min(x + 9, plotR - 44), y - 5);
  }

  /* --- 光饱和点 --- */
  if (State.sat !== null && State.sat <= State.maxI) {
    const x = xOf(State.sat), y = yOf(grossAt(State.sat, State.T, State.C, State.O));
    cctx.beginPath();
    cctx.arc(x, y, 3.2, 0, 6.2832);
    cctx.fillStyle = CH.sat;
    cctx.fill();
    cctx.fillStyle = CH.satLab;
    cctx.font = '9.5px "PingFang SC",sans-serif';
    cctx.textAlign = 'center';
    const above = y > plotT + 42;
    cctx.textBaseline = above ? 'bottom' : 'top';
    cctx.fillText('光饱和点', x, above ? y - 7 : y + 8);
  }

  /* --- 实测点：学生自己记下来的数据 ---
     空心圆 + 序号，和工作点（实心）区分开。
     曲线上有实测点，"这条线是怎么来的"才讲得通。 */
  if (REC.pts.length) {
    for (let i = 0; i < REC.pts.length; i++) {
      const p = REC.pts[i];
      const px = xOf(p.I), py = yOf(p.net);
      cctx.beginPath();
      cctx.arc(px, py, 4.0, 0, 6.2832);
      cctx.fillStyle = CH.dotFill;
      cctx.fill();
      cctx.beginPath();
      cctx.arc(px, py, 4.0, 0, 6.2832);
      cctx.strokeStyle = p.net >= 0 ? CH.net0 : CH.neg;
      cctx.lineWidth = 1.7;
      cctx.stroke();
      if (REC.pts.length <= 8) {
        cctx.fillStyle = CH.note;
        cctx.font = '8px "PingFang SC",sans-serif';
        cctx.textAlign = 'center'; cctx.textBaseline = 'bottom';
        cctx.fillText(String(i + 1), px, py - 5);
      }
    }
  }

  /* --- 当前工作点 --- */
  const cx = xOf(curI), cy = yOf(nNow);
  cctx.beginPath();
  cctx.moveTo(cx, plotT); cctx.lineTo(cx, plotB);
  cctx.strokeStyle = CH.cross;
  cctx.lineWidth = 1;
  cctx.stroke();
  cctx.beginPath();
  cctx.arc(cx, cy, 5.2, 0, 6.2832);
  cctx.fillStyle = nNow >= 0 ? CH.net0 : CH.neg;
  cctx.shadowColor = nNow >= 0 ? 'rgba(31,111,208,0.45)' : 'rgba(217,69,58,0.45)';
  cctx.shadowBlur = 9;
  cctx.fill();
  cctx.shadowBlur = 0;
  cctx.beginPath();
  cctx.arc(cx, cy, 5.2, 0, 6.2832);
  cctx.strokeStyle = '#ffffff';
  cctx.lineWidth = 1.6;
  cctx.stroke();

  /* --- 区域注释 --- */
  if (State.comp !== null && State.comp > 260) {
    cctx.fillStyle = 'rgba(201,58,46,0.70)';
    cctx.font = '9px "PingFang SC",sans-serif';
    cctx.textAlign = 'left'; cctx.textBaseline = 'middle';
    cctx.fillText('净光合 < 0', plotL + 6, yZero + 12);
  }
  if (State.sat !== null) {
    cctx.fillStyle = 'rgba(14,138,92,0.62)';
    cctx.font = '9px "PingFang SC",sans-serif';
    cctx.textAlign = 'center'; cctx.textBaseline = 'top';
    const sx = (xOf(State.sat) + plotR) / 2;
    if (plotR - xOf(State.sat) > 46) cctx.fillText('加光不再增益', sx, plotT + 2);
  }
}
