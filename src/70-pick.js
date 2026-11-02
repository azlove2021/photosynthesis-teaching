/* =========================================================
   70 · 拾取 / 白手套光标 / 器官读数卡 / 聚焦
   ---------------------------------------------------------
   三件事在这里合流：
     ① Raycaster 判定「点到谁」，并用位移与时长把拖拽排除在外；
     ② 光标换成三态白手套（常态张开手掌 / 悬停食指 / 按下）；
     ③ 弹出一张器官级读数卡，把「总光合 − 呼吸 = 净光合」当场算给学生看。
   ========================================================= */
'use strict';

/* ---------------- 白手套光标 ----------------
   不引外部图片：三段 SVG 在运行时拼出来，转成 data URI 塞进 CSS 变量。
   画法上有个偷懒但很有效的技巧——先画四根手指和白手掌，
   手掌用「不闭合的轮廓」填白后再描边：填充会盖住手指根部，
   描边又不会横穿掌口，手指就像从掌沿长出来的。 */
function gloveSVG(kind) {
  const ST = '#22364E';
  const FILL = '#FFFFFF';
  const sw = 1.5;
  const finger = function (x, y, w, h) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (w / 2) + '" fill="' + FILL + '" stroke="' + ST + '" stroke-width="' + sw + '"/>';
  };
  const thumb = function (x, y, w, h, rot, cx, cy) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (w / 2) + '" fill="' + FILL + '" stroke="' + ST + '" stroke-width="' + sw +
      '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
  };
  /* 掌：底部圆角、顶部开口（不画横线） */
  const palmOpen = '<path d="M7.7 15.4 V22.1 c0 4 3.2 7.2 7.2 7.2 h4.2 c4 0 7.2-3.2 7.2-7.2 v-6.7" ' +
    'fill="' + FILL + '" stroke="' + ST + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
  const fist = function (top) {
    return '<path d="M8.4 ' + top + ' h17.2 v6.6 c0 4-3.2 7.2-7.2 7.2 h-2.8 c-4 0-7.2-3.2-7.2-7.2 z" ' +
      'fill="' + FILL + '" stroke="' + ST + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
  };

  let body = '';
  if (kind === 'idle') {
    body = finger(8.6, 9.6, 4.5, 14.5) + finger(13.4, 6.6, 4.5, 17.5) +
      finger(18.2, 7.0, 4.5, 17.1) + finger(23.0, 10.2, 4.5, 13.9) +
      thumb(3.9, 15.6, 4.3, 9.2, -26, 6, 20) + palmOpen;
  } else if (kind === 'point') {
    body = finger(13.2, 4.2, 5.0, 16) +
      '<path d="M8.4 15.0 h17.2 v6.8 c0 4-3.2 7.2-7.2 7.2 h-2.8 c-4 0-7.2-3.2-7.2-7.2 z" ' +
      'fill="' + FILL + '" stroke="' + ST + '" stroke-width="' + sw + '" stroke-linejoin="round"/>' +
      thumb(4.3, 16.4, 4.3, 8.6, -34, 6.4, 20.6);
  } else {
    /* 按下：整只手下沉 1px、食指缩短 2px */
    body = finger(13.2, 6.2, 5.0, 14) + fist(16.4) + thumb(4.3, 17.6, 4.3, 8.4, -34, 6.4, 21.4);
  }

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 34 34">' +
    '<g stroke-linejoin="round">' + body + '</g>' +
    '<path d="M11.6 20.2 h9.8" stroke="rgba(34,54,78,.20)" stroke-width="1.2" stroke-linecap="round"/>' +
    '</svg>';
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}

(function installGloves() {
  const root = document.documentElement;
  /* 热区落在食指尖：点哪儿指哪儿 */
  root.style.setProperty('--cur-idle', gloveSVG('idle') + ' 11 9');
  root.style.setProperty('--cur-point', gloveSVG('point') + ' 15 5');
  root.style.setProperty('--cur-press', gloveSVG('press') + ' 15 7');
  document.body.classList.add('glove');
})();

/* ---------------- 拾取 ---------------- */
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.06;
raycaster.params.Points.threshold = 0.05;
const ndc = new THREE.Vector2();
const stageEl = document.getElementById('stage3d');
const pickCardEl = document.getElementById('pickCard');

let pickMesh = null;   /* 真正被点中的那个网格，用于画选中框 */

function chainVisible(o) {
  let n = o;
  while (n) {
    if (n.visible === false) return false;
    n = n.parent;
  }
  return true;
}

function pickAt(x, y, select) {
  const r = glCanvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(PICK_ROOTS, true);
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (!chainVisible(h.object)) continue;
    let o = h.object, id = null;
    while (o) {
      if (o.userData.pickId) { id = o.userData.pickId; break; }
      o = o.parent;
    }
    if (!id) continue;
    if (select) selectPick(id, h.object);
    return id;
  }
  if (select) clearPick();
  return null;
}

/* 悬停：只在没有拖拽时跑，节流 70ms（射线对整棵植株不算便宜） */
let hoverT = 0;
function updateHover(x, y) {
  const now = performance.now();
  if (now - hoverT < 70) return;
  hoverT = now;
  const id = pickAt(x, y, false);
  if (id !== MICRO.hover) {
    MICRO.hover = id;
    stageEl.classList.toggle('can-pick', !!id);
    if (id && !MICRO.pick) hideGloveTip();
  }
}

glCanvas.addEventListener('pointermove', function (e) {
  if (DRAG.on) return;
  updateHover(e.clientX, e.clientY);
});
glCanvas.addEventListener('pointerleave', function () {
  MICRO.hover = null;
  stageEl.classList.remove('can-pick');
});

/* 点击判定：位移 < 6px 且 < 600ms，否则算拖拽 */
glCanvas.addEventListener('pointerup', function (e) {
  if (e.button !== 0) return;
  const dx = e.clientX - DRAG.x0;
  const dy = e.clientY - DRAG.y0;
  const dt = performance.now() - DRAG.t0;
  if (Math.hypot(dx, dy) > 6 || dt > 600) return;
  pickAt(e.clientX, e.clientY, true);
});

glCanvas.addEventListener('dblclick', function (e) {
  /* 双击＝聚焦。先取到 id 再飞过去，取不到就回本步预设 */
  const id = pickAt(e.clientX, e.clientY, false);
  if (id) { selectPick(id, null); focusPick(id); }
  else resumeAuto();
});

/* ---------------- 选中反馈三件套 ---------------- */
const selBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0x2F6BFF, transparent: true, opacity: 0.85 })
);
selBox.visible = false;
selBox.renderOrder = 12;
scene.add(selBox);

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _ctr = new THREE.Vector3();

function updateSelBox() {
  if (!selBox.visible || !pickMesh) return;
  _box.setFromObject(pickMesh);
  if (_box.isEmpty()) { selBox.visible = false; return; }
  _box.getCenter(_ctr);
  _box.getSize(_size);
  selBox.position.copy(_ctr);
  selBox.scale.set(
    Math.max(0.14, _size.x) * 1.16,
    Math.max(0.14, _size.y) * 1.16,
    Math.max(0.14, _size.z) * 1.16
  );
}

let _selAt = 0;
function selectPick(id, mesh) {
  if (!PICK_INFO[id]) return;
  MICRO.pick = id;
  pickMesh = mesh || PICK_OBJ[id];
  selBox.visible = true;
  updateSelBox();
  glowOrgan(id, 1);
  setOrganFocus(id);
  renderPickCard(id);
  pickCardEl.classList.add('on');
  syncStructBtns();
  hideGloveTip();
  _selAt = performance.now();
  /* 选根的时候把相机稍微压下去一点，不然根被盆沿挡住 */
  if (id === 'root' && view.auto) {
    vDes.ty = 0.95;
    vDes.phi = Math.max(vDes.phi, 1.22);
  }
}

function clearPick() {
  MICRO.pick = null;
  pickMesh = null;
  selBox.visible = false;
  pickCardEl.classList.remove('on');
  glowOrgan(null, 0);
  setOrganFocus(null);
  syncStructBtns();
}

/* 聚焦：别贴脸。取「当前距离 62%」与「包围盒 1.7 倍」的较大值 */
function focusPick(id) {
  const obj = PICK_OBJ[id];
  if (!obj) return;
  _box.setFromObject(obj);
  if (_box.isEmpty()) return;
  _box.getCenter(_ctr);
  _box.getSize(_size);
  const s = Math.max(_size.x, _size.y, _size.z);
  vDes.tx = _ctr.x;
  vDes.ty = _ctr.y;
  vDes.tz = _ctr.z;
  vDes.r = clamp(Math.max(4.2, Math.max(vCur.r * 0.62, s * 1.7)), LIM.minR, LIM.maxR);
  view.auto = false;
}

/* ---------------- 读数卡 ---------------- */
function r3(v) { return fmt(v, 2); }

function rowHTML(cls, k, v, unit) {
  return '<div class="pr ' + cls + '"><span class="k">' + k + '</span>' +
    '<span class="v">' + v + '</span><span class="u">' + unit + '</span></div>';
}

function renderPickCard(id) {
  const info = PICK_INFO[id];
  const o = organRead(id);
  const sum = organSum();
  document.getElementById('pcName').textContent = info.name;
  const cat = document.getElementById('pcCat');
  cat.textContent = info.cat + ' · 器官级';

  const body = document.getElementById('pcBody');
  const foot = document.getElementById('pcFoot');

  let html = '';
  html += rowHTML('g', '总光合', r3(o.gross), U_RATE);
  html += rowHTML('r', '呼吸', r3(o.resp), U_RATE);
  html += rowHTML('n', '净光合', r3(o.net), U_RATE);
  html += '<div class="pc-eq">总光合 ' + r3(o.gross) + ' − 呼吸 ' + r3(o.resp) +
    ' = 净光合 ' + r3(o.net) + '</div>';
  html += '<div class="pc-note">' + info.note + '</div>';
  body.innerHTML = html;

  /* 页脚：把「三器官之和 = 整株」这条闭合关系当场摆出来，
     第⑧步的加法题就是靠这一行讲通的 */
  if (id === 'leaf') {
    const lf = organRead('leaf'), st = organRead('stem'), rt = organRead('root');
    foot.innerHTML = '整株 ' + r3(LIVE.net) + ' = 叶 ' + r3(lf.net) +
      ' − 茎 ' + r3(-st.net) + ' − 根 ' + r3(-rt.net) +
      ' <span class="ok">✔ 闭合</span>';
  } else {
    const who = id === 'root' ? '根' : '茎';
    foot.innerHTML = who + '不固定 CO₂：它的净光合只能是负值，整株的总光合与它无关。<br>' +
      '三器官净值之和 ' + r3(sum.net) + ' = 整株 ' + r3(LIVE.net) + ' <span class="ok">✔</span>';
  }
}

/* 滑块一动，卡片要跟着变。活着的数据不能让卡片冻在旧数上。 */
function refreshPickCard() {
  if (MICRO.pick) renderPickCard(MICRO.pick);
}

let _tipTimer = 0;
function hideGloveTip() {
  const t = document.getElementById('gloveTip');
  if (t && !t.classList.contains('gone')) {
    clearTimeout(_tipTimer);
    t.classList.add('gone');
  }
}
function showGloveTipOnce() {
  const t = document.getElementById('gloveTip');
  if (!t) return;
  _tipTimer = setTimeout(function () { t.classList.add('gone'); }, 15000);
}
