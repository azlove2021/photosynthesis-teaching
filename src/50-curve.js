/* =========================================================
   50 · 曲线面板：净光合曲线 + 总光合曲线 + 关键点标注

   配色统一走 CH 调色板。暗底版本里大量用到"半透明白"，
   在浅底上等于隐身，所以整组颜色必须按"纸面"重配：
   网格浅灰蓝、文字深灰、三条语义色（净=蓝 / 总=绿 / 呼吸=橙）加深。
   ========================================================= */
'use strict';

const chartCanvas = document.getElementById('chart');
const cctx = chartCanvas.getContext('2d');
/* 图下那行小字：由 drawChart 按"有没有跨条件的实测点"改写 */
const chartFootEl = document.getElementById('chartFoot');
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
  respLine: 'rgba(196,116,18,0.62)',
  respLab: '#a8620d',
  neg: '#d9453a',
  negLab: '#c93a2e',
  sat: 'rgba(16,150,99,0.95)',
  satLab: '#0e8a5c',
  dotFill: 'rgba(255,255,255,0.95)',
  offDot: 'rgba(126,145,163,0.58)',
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

/* 边距按"投影可读"重新配：刻度 12px、轴标题 10.5px，左边要放得下两位数字 */
const CP = { l: 62, r: 22, t: 30, b: 48 };

function netOf(I, T, C, O, whole) {
  return grossAt(I, T, C, O) - respAt(T, whole);
}

/* 纵轴的取值原则：**轴是尺子，不跟口径走**。
   曾经的写法把 max over 温度 的呼吸按当前口径取值，于是"整株 → 只看叶片"
   时纵轴下界从 −8 收到 −6、跨度从 38 收到 36：曲线在 I=800 处实际位移
   0 像素，零线却下移 8.8 像素，学生看到的是"净光合变高了"——一个纯由
   坐标轴制造的假象。真实差值只有 0.47（整株 2.15 − 叶片 1.68）。
   所以这里恒按整株取呼吸，让轴只随**温度、CO₂、O₂**这些真正的实验条件变；
   口径切换时整条曲线平移，幅度就是那 0.47，读数区另有分解说明。 */
function chartRanges() {
  let pmax = 1, rd = 1;
  const temps = [15, 25, 35, State.T];
  for (let i = 0; i < temps.length; i++) {
    pmax = Math.max(pmax, pmaxAt(temps[i], State.C, State.O));
    rd = Math.max(rd, respAt(temps[i], true));
  }
  const yMax = Math.ceil(pmax * 1.10 / 5) * 5;
  const yMin = -Math.ceil(Math.max(rd * 1.55, 3.6) / 2) * 2;
  return { yMax: yMax, yMin: yMin };
}

/* 画布上的文字一律先描一圈白边再填字。
   曲线、鬼影线、网格都会从标签底下穿过去，浅底上不加白边就糊成一团——
   "光补偿点"尤其明显，它正好落在曲线起步的位置。 */
function haloText(txt, x, y) {
  cctx.lineJoin = 'round';
  cctx.lineWidth = 3.2;
  cctx.strokeStyle = 'rgba(255,255,255,0.94)';
  cctx.strokeText(txt, x, y);
  cctx.fillText(txt, x, y);
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
  /* 刻度密度跟着可用高度走。
     12px 的刻度字号在 1440×900 上 5 一格正好；换到 1280×800 的投影仪，
     画布只有百来像素高，5 一格就挤成一条黑杠（实测数字互相压住）。
     这里按"每格至少 15px"反推步长，小屏自动变成 10 一格。 */
  let yStep = 5;
  while (yStep < 20 && plotH / ((yMax - yMin) / yStep) < 15) yStep += 5;
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
  cctx.font = '12px ui-monospace,Consolas,monospace';
  cctx.textAlign = 'right'; cctx.textBaseline = 'middle';
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    if (Math.abs(v) < 0.01) continue;
    cctx.fillText(String(v), plotL - 9, yOf(v));
  }
  cctx.fillText('0', plotL - 9, yZero);

  cctx.font = '12px ui-monospace,Consolas,monospace';
  cctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const xp = plotL + (i / 4) * plotW;
    cctx.textAlign = i === 0 ? 'left' : (i === 4 ? 'right' : 'center');
    cctx.fillText(String(Math.round(PHYS.iMax * i / 4)), xp, plotB + 8);
  }
  cctx.textAlign = 'center';
  cctx.fillStyle = CH.axisLab;
  cctx.font = '10.5px "PingFang SC","Microsoft YaHei",sans-serif';
  cctx.fillText('光照强度 μmol·m⁻²·s⁻¹', (plotL + plotR) / 2, plotB + 28);

  cctx.textAlign = 'left'; cctx.textBaseline = 'top';
  cctx.fillStyle = CH.axisLab;
  cctx.fillText('μmol CO₂·m⁻²·s⁻¹', plotL + 2, 4);

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
      cctx.font = '11px ui-monospace,Consolas,monospace';
      cctx.textAlign = 'right'; cctx.textBaseline = 'middle';
      haloText(T + '℃', plotR - 2, yOf(vEnd) + (T > State.T ? 9 : -9));
    }
  }

  /* --- 曲线绘制（裁剪到已探索光强） --- */
  const revealX = xOf(clamp(State.maxI, 24, PHYS.iMax));
  cctx.save();
  cctx.beginPath();
  cctx.rect(plotL - 2, plotT - 8, revealX - plotL + 2, plotH + 16);
  cctx.clip();

  /* 采样点数：三条线共用，保证带子和描边严丝合缝 */
  const N = 110;

  /* 总光合（虚线） */
  cctx.beginPath();
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

  /* --- 呼吸值：一条贯穿全图的水平虚线 ---
     全图最容易误读的地方就在这里。呼吸速率只由温度决定，与光强毫无关系，
     所以在这张"速率—光强"图上它是一条水平线，而不是一条随光强上升的曲线。
     以前只在当前光强处标了一段两曲线间距（一个竖线 + "呼吸"），
     学生（和听课的老师）会把它读成"呼吸随光强在变大"。
     画出水平线之后，"呼吸只随温度变"这件事才有参照物。
     附带一个很好用的课堂巧合：这条线在 I 略大于 40 处穿过绿虚线，
     而那正是光补偿点——总光合刚好追平呼吸的地方，三者同一个横坐标。 */
  const respNow = respAt(State.T, State.whole);
  const yResp = yOf(respNow);
  if (yResp > plotT + 2 && yResp < plotB - 2) {
    cctx.strokeStyle = CH.respLine;
    cctx.lineWidth = 1.6;
    cctx.setLineDash([5, 5]);
    cctx.beginPath();
    cctx.moveTo(plotL, yResp); cctx.lineTo(plotR, yResp);
    cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = CH.respLab;
    cctx.font = '11px "PingFang SC",sans-serif';
    cctx.textAlign = 'right'; cctx.textBaseline = 'bottom';
    haloText('呼吸 ' + fmt(respNow, 1) + '（只随温度变）', plotR - 4, yResp - 3);
  }

  /* 工作点只留竖十字与圆点。
     这里曾经还有一个"间距双箭头 + 呼吸"的小标注：2.1 在这根轴上只有约 11 px，
     而圆点直径 12 px，箭头被整个吃掉；把引线挪到圆点左边之后又读成一个小方块。
     信息已经由上面那条水平虚线（值和"只随温度变"）＋ 右栏的三量对账
     （总光合 − 呼吸 = 净光合）两处承担，图上不再重复。 */
  const curI = State.I;
  const gNow = grossAt(curI, State.T, State.C, State.O);
  const nNow = gNow - respNow;

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
    cctx.font = '11.5px "PingFang SC",sans-serif';
    /* 补偿点几乎都贴着左边（≈40），标签放在零点线**下方**——那里是负值区的
       空白，曲线不经过；放上方会和起步段的曲线压在一起。 */
    cctx.textAlign = 'left'; cctx.textBaseline = 'top';
    haloText('光补偿点', Math.min(x + 9, plotR - 46), y + 6);
  }

  /* --- 光饱和点 --- */
  if (State.sat !== null && State.sat <= State.maxI) {
    const x = xOf(State.sat), y = yOf(grossAt(State.sat, State.T, State.C, State.O));
    cctx.beginPath();
    cctx.arc(x, y, 3.2, 0, 6.2832);
    cctx.fillStyle = CH.sat;
    cctx.fill();
    cctx.fillStyle = CH.satLab;
    cctx.font = '11.5px "PingFang SC",sans-serif';
    cctx.textAlign = 'center';
    const above = y > plotT + 42;
    cctx.textBaseline = above ? 'bottom' : 'top';
    haloText('光饱和点', x, above ? y - 7 : y + 8);
  }

  /* --- 实测点：学生自己记下来的数据 ---
     空心圆 + 序号，和工作点（实心）区分开。
     曲线上有实测点，"这条线是怎么来的"才讲得通。

     每个点都停在**它被测出来的那个高度**上（p.net），不按当前条件重画——
     重画就等于伪造了一次测量。条件对不上的点变灰、不编号，老老实实待在
     原位；它反而成了"这条曲线是随温度、随 CO₂ 动的"最直接的证据。 */
  let offCond = 0;
  if (REC.pts.length) {
    for (let i = 0; i < REC.pts.length; i++) {
      const p = REC.pts[i];
      const same = p.whole === State.whole &&
        Math.abs(p.T - State.T) < 0.01 &&
        p.C === State.C && p.O === State.O;
      if (!same) offCond++;
      const px = xOf(p.I), py = yOf(p.net);
      cctx.beginPath();
      cctx.arc(px, py, 4.0, 0, 6.2832);
      cctx.fillStyle = same ? CH.dotFill : 'rgba(255,255,255,0.78)';
      cctx.fill();
      cctx.beginPath();
      cctx.arc(px, py, 4.0, 0, 6.2832);
      cctx.strokeStyle = same ? (p.net >= 0 ? CH.net0 : CH.neg) : CH.offDot;
      cctx.lineWidth = 1.7;
      cctx.stroke();
      if (same && REC.pts.length <= 8) {
        cctx.fillStyle = CH.note;
        cctx.font = '9.5px "PingFang SC",sans-serif';
        cctx.textAlign = 'center'; cctx.textBaseline = 'bottom';
        cctx.fillText(String(i + 1), px, py - 6);
      }
    }
  }

  /* 脚注：把"点为什么不动、灰点是什么"一句话说清 */
  if (offCond) {
    cctx.fillStyle = CH.ghostLab;
    cctx.font = '10px "PingFang SC",sans-serif';
    cctx.textAlign = 'right'; cctx.textBaseline = 'bottom';
    cctx.fillText('灰点 = 其他条件测得', plotR - 2, plotT - 4);
  }
  if (typeof chartFootEl !== 'undefined' && chartFootEl) {
    chartFootEl.textContent = offCond
      ? '灰点是在别的温度 / 口径 / 浓度下测的，所以没跟着曲线动——条件一变，曲线才会动'
      : (REC.pts.length ? '空心点 = 你测得的；实心点 = 当前工作点' : '曲线随拖动逐步生成，记录数据后实测点会标在线上');
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
    cctx.fillStyle = 'rgba(201,58,46,0.78)';
    cctx.font = '10.5px "PingFang SC",sans-serif';
    cctx.textAlign = 'left'; cctx.textBaseline = 'middle';
    cctx.fillText('净光合 < 0', plotL + 6, yZero + 12);
  }
  if (State.sat !== null) {
    cctx.fillStyle = 'rgba(14,138,92,0.85)';
    cctx.font = '10.5px "PingFang SC",sans-serif';
    /* 靠右上角独立成一行：这一带（25 以上、饱和点右侧）是全图唯一常年空着的区域，
       放在曲线下方会和"呼吸"那条水平线的标签撞在一起。 */
    cctx.textAlign = 'right'; cctx.textBaseline = 'top';
    if (plotR - xOf(State.sat) > 60) haloText('加光不再增益', plotR - 2, plotT + 2);
  }
}
