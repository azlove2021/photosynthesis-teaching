/* =========================================================
   30 · 渲染器 / 相机状态机 / 灯光 / 地面
   ---------------------------------------------------------
   与上一版的关键差别：**去掉后期管线**。
   浅色主题下泛光只会把白底糊成雾，而直接渲到 CSS 的浅蓝渐变上
   反而更干净；顺带省掉整条 RT 链路，教室里的核显笔记本更稳。
   代价是要自己管色彩：outputEncoding = sRGB，自定义着色器
   里补 #include <encodings_fragment>（见 50-particles.js）。
   ========================================================= */
'use strict';

const glCanvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({
  canvas: glCanvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.9));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 120);

/* ---- 相机状态机：自动取景 vs 用户接管 ----
   规则：切步一定回预设；用户一旦拖拽/滚轮，本步内不再抢镜。 */
const view = { auto: true };
const vDes = { theta: 0.30, phi: 1.28, r: 7.20, tx: 0, ty: 1.50, tz: 0 };
const vCur = { theta: 0.30, phi: 1.28, r: 7.20, tx: 0, ty: 1.50, tz: 0 };
const LIM = { minR: 3.0, maxR: 14.0, minPhi: 0.22, maxPhi: 1.50 };

const camTgt = new THREE.Vector3(0, 1.50, 0);
const _v = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

function applySpherical() {
  const sp = Math.sin(vCur.phi);
  camera.position.set(
    vCur.tx + vCur.r * sp * Math.sin(vCur.theta),
    vCur.ty + vCur.r * Math.cos(vCur.phi),
    vCur.tz + vCur.r * sp * Math.cos(vCur.theta)
  );
  camTgt.set(vCur.tx, vCur.ty, vCur.tz);
  camera.lookAt(camTgt);
}

function syncView() {
  const off = camera.position.clone().sub(camTgt);
  const len = off.length() || 1;
  vCur.r = vDes.r = clamp(len, LIM.minR, LIM.maxR);
  vCur.theta = vDes.theta = Math.atan2(off.x, off.z);
  vCur.phi = vDes.phi = clamp(Math.acos(clamp(off.y / len, -1, 1)), LIM.minPhi, LIM.maxPhi);
  vCur.tx = vDes.tx = camTgt.x;
  vCur.ty = vDes.ty = camTgt.y;
  vCur.tz = vDes.tz = camTgt.z;
}

/* 回到本步预设：不瞬移，交给阻尼飞过去 */
function resumeAuto(instant) {
  const cam = STAGES[MICRO.step].cam;
  vDes.theta = cam.theta;
  vDes.phi = clamp(cam.phi, LIM.minPhi, LIM.maxPhi);
  vDes.r = clamp(cam.r, LIM.minR, LIM.maxR);
  vDes.ty = cam.ty;
  vDes.tx = 0;
  vDes.tz = 0;
  view.auto = true;
  if (instant) {
    vCur.theta = vDes.theta; vCur.phi = vDes.phi; vCur.r = vDes.r;
    vCur.tx = vDes.tx; vCur.ty = vDes.ty; vCur.tz = vDes.tz;
    applySpherical();
  }
}

function updateViewCamera(dt) {
  const k = 1 - Math.pow(0.0016, Math.min(0.1, dt));
  vCur.theta += (vDes.theta - vCur.theta) * k;
  vCur.phi += (vDes.phi - vCur.phi) * k;
  vCur.r += (vDes.r - vCur.r) * k;
  vCur.tx += (vDes.tx - vCur.tx) * k;
  vCur.ty += (vDes.ty - vCur.ty) * k;
  vCur.tz += (vDes.tz - vCur.tz) * k;
  applySpherical();
}

/* ---- 指针：旋转 / 平移 / 缩放 ----
   pointerdown 只登记，不判定点击；点击与否在 70-pick.js 里按
   位移 < 6px 且 < 600ms 判定，这样拖拽不会被误判成点选。 */
const DRAG = { on: false, pan: false, x: 0, y: 0, x0: 0, y0: 0, t0: 0 };

function markTakeover() { view.auto = false; }

glCanvas.addEventListener('pointerdown', function (e) {
  DRAG.on = true;
  DRAG.pan = (e.button === 2) || e.shiftKey;
  DRAG.x = DRAG.x0 = e.clientX;
  DRAG.y = DRAG.y0 = e.clientY;
  DRAG.t0 = performance.now();
  glCanvas.setPointerCapture && glCanvas.setPointerCapture(e.pointerId);
  markTakeover();
  MICRO.pressT = performance.now();
  document.getElementById('stage3d').classList.add('pressing');
});

glCanvas.addEventListener('pointermove', function (e) {
  if (!DRAG.on) return;
  const dx = e.clientX - DRAG.x;
  const dy = e.clientY - DRAG.y;
  DRAG.x = e.clientX;
  DRAG.y = e.clientY;
  if (DRAG.pan) {
    _right.setFromMatrixColumn(camera.matrix, 0);
    _up.setFromMatrixColumn(camera.matrix, 1);
    const s = vCur.r * 0.0016;
    vDes.tx = clamp(vDes.tx - _right.x * dx * s + _up.x * dy * s, -2.2, 2.2);
    vDes.ty = clamp(vDes.ty - _right.y * dx * s + _up.y * dy * s, 0.2, 3.2);
    vDes.tz = clamp(vDes.tz - _right.z * dx * s + _up.z * dy * s, -2.2, 2.2);
  } else {
    vDes.theta -= dx * 0.0062;
    vDes.phi = clamp(vDes.phi - dy * 0.0050, LIM.minPhi, LIM.maxPhi);
  }
});

function endDrag() {
  DRAG.on = false;
  document.getElementById('stage3d').classList.remove('pressing');
}
['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
  glCanvas.addEventListener(ev, endDrag);
});

glCanvas.addEventListener('wheel', function (e) {
  e.preventDefault();
  markTakeover();
  vDes.r = clamp(vDes.r * Math.exp(e.deltaY * 0.0012), LIM.minR, LIM.maxR);
}, { passive: false });

glCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

/* ---- 灯光 ----
   浅底场景的照明逻辑与暗场相反：环境光必须托住地板，
   否则光强拉到 0 时植株会变成白底上的一块黑影。
   主光是吊装日光灯位置的聚光灯——光池、投影、灯具三者同源，
   滑杆一动三者一起变，学生看到的才叫「灯变了」而不是「画面变亮了」。 */
const hemi = new THREE.HemisphereLight(0xffffff, 0xcbdbea, 0.86);
scene.add(hemi);

const LAMP = { x: 0, y: 3.385, z: 0.62, aim: new THREE.Vector3(0, 1.42, -0.16) };

const keyLight = new THREE.SpotLight(0xfff0cf, 0.6, 16, 0.62, 0.35, 2.0);
keyLight.position.set(LAMP.x, LAMP.y, LAMP.z);
keyLight.target.position.copy(LAMP.aim);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1536, 1536);
keyLight.shadow.camera.near = 0.6;
keyLight.shadow.camera.far = 10;
keyLight.shadow.bias = -0.0006;
keyLight.shadow.normalBias = 0.020;
scene.add(keyLight);
scene.add(keyLight.target);

const rim = new THREE.DirectionalLight(0xa8cdf3, 0.62);
rim.position.set(-4.6, 2.6, -3.8);
scene.add(rim);

const fillPoint = new THREE.PointLight(0xcfe2f4, 0.32, 14, 2);
fillPoint.position.set(0, 1.1, -3.0);
scene.add(fillPoint);

/* 根系补光：只在根被选中/第⑧步亮起，平时为 0 */
const rootGlow = new THREE.PointLight(0xffa860, 0.0, 3.0, 2);
rootGlow.position.set(0, 0.42, 0);
scene.add(rootGlow);

/* 光强 → 灯光。以 800 为 1.0 参考点，0.55 次方让低光段的
   变化更明显（课堂上滑杆前半段最常拖） */
function applyLightLevel(I) {
  const k = clamp(Math.pow(Math.max(0, I) / 800, 0.55), 0, 2.2);
  keyLight.intensity = 0.05 + 0.56 * k;
  hemi.intensity = 0.50 + 0.36 * Math.min(k, 1.7);
  rim.intensity = 0.24 + 0.38 * Math.min(k, 1.5);
  fillPoint.intensity = 0.12 + 0.20 * Math.min(k, 1.5);
}

/* ---- 场景根 ---- */
const world = new THREE.Group();
scene.add(world);

/* ---- 地面 ----
   不用雾去藏边界：反照率 0.5 的东西怎么打光都到不了背景色，
   只有让不透明度自己归零，圆盘边缘才会真的消失。 */
(function buildGround() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, S * 0.02, S / 2, S / 2, S * 0.5);
  rg.addColorStop(0.00, 'rgba(247,250,255,1)');
  rg.addColorStop(0.28, 'rgba(240,246,254,1)');
  rg.addColorStop(0.50, 'rgba(236,243,252,0.92)');
  rg.addColorStop(0.68, 'rgba(238,245,253,0.62)');
  rg.addColorStop(0.84, 'rgba(242,247,253,0.24)');
  rg.addColorStop(1.00, 'rgba(246,250,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(9, 96),
    new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.98, metalness: 0,
      transparent: true, depthWrite: true
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.02;
  disc.receiveShadow = true;
  scene.add(disc);
})();

/* 接地阴影：白底上真实投影会被地面高光淹没，整株看着浮在纸上 */
(function buildContactShadow() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(26,44,64,0.52)');
  rg.addColorStop(0.34, 'rgba(26,44,64,0.30)');
  rg.addColorStop(0.66, 'rgba(26,44,64,0.10)');
  rg.addColorStop(1, 'rgba(26,44,64,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.05, 1.72),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(-0.13, 0.004, -0.10);
  blob.renderOrder = 1;
  scene.add(blob);
})();

/* ---- 尺寸 ---- */
function resize() {
  const stage = document.getElementById('stage3d');
  const w = Math.max(2, stage.clientWidth);
  const h = Math.max(2, stage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = (w / h < 1.05) ? 44 : 33;
  camera.updateProjectionMatrix();
  applySpherical();
  if (typeof updatePointScale === 'function') updatePointScale();
}
window.addEventListener('resize', resize);
