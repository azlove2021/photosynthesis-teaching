/* =========================================================
   10 · 渲染器 / 相机 / 灯光 / 自建轨道控制
   ========================================================= */
'use strict';

const glCanvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({
  canvas: glCanvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
/* 材质不做色调映射、不做 sRGB 编码：场景以线性 HDR 渲进浮点缓冲，
   曝光 / ACES / 调色 / 编码统一由 15-post.js 的合成阶段负责。
   两边都做一遍是本项目最容易踩的坑。 */
renderer.outputEncoding = THREE.LinearEncoding;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
/* 浅色教学底板：取值是**线性**的（材质与清屏色都不做 sRGB 转换，见上），
   经 15-post.js 的中性曲线后落回约 #eef4fb —— 与 CSS 舞台底色对齐，
   画布边界才不会露出来。 */
scene.background = new THREE.Color(0.855, 0.905, 0.958);
scene.fog = new THREE.Fog(scene.background.clone(), 13.5, 30);

const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);

/* ---- 自建轨道控制（不引入 OrbitControls，保持单文件） ---- */
const Orbit = {
  az: 0.34, pol: 1.255, dist: 6.90,
  taz: 0.34, tpol: 1.255, tdist: 6.90,
  target: new THREE.Vector3(0, 1.45, 0),
  autoIdle: 0,
  dragging: false,
  lastX: 0, lastY: 0
};

function applyCamera() {
  const sp = Math.sin(Orbit.pol), cp = Math.cos(Orbit.pol);
  camera.position.set(
    Orbit.target.x + Orbit.dist * sp * Math.sin(Orbit.az),
    Orbit.target.y + Orbit.dist * cp,
    Orbit.target.z + Orbit.dist * sp * Math.cos(Orbit.az)
  );
  camera.lookAt(Orbit.target);
}

function resetCamera() {
  Orbit.taz = 0.34; Orbit.tpol = 1.255; Orbit.tdist = 6.90;
}

glCanvas.addEventListener('pointerdown', e => {
  Orbit.dragging = true; Orbit.lastX = e.clientX; Orbit.lastY = e.clientY;
  Orbit.autoIdle = -1e9;
  glCanvas.setPointerCapture(e.pointerId);
});
glCanvas.addEventListener('pointermove', e => {
  if (!Orbit.dragging) return;
  const dx = e.clientX - Orbit.lastX, dy = e.clientY - Orbit.lastY;
  Orbit.lastX = e.clientX; Orbit.lastY = e.clientY;
  Orbit.taz -= dx * 0.0062;
  Orbit.tpol = clamp(Orbit.tpol - dy * 0.0052, 0.42, 1.60);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
  glCanvas.addEventListener(ev, () => { Orbit.dragging = false; Orbit.autoIdle = 0; })
);
glCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  Orbit.tdist = clamp(Orbit.tdist + e.deltaY * 0.0042, 3.4, 12.5);
  Orbit.autoIdle = 0;
}, { passive: false });
glCanvas.addEventListener('dblclick', resetCamera);

/* ---- 灯光 ----
   浅底场景的照明逻辑与暗场相反：环境光必须托住"地板"，否则
   光强拉到 0 时植株会变成白底上的一块黑影，学生看不清结构。
   所以 hemi 的底噪拉高，太阳光的动态范围收窄。 */
const hemi = new THREE.HemisphereLight(0xffffff, 0xcbdbea, 0.95);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff7ec, 2.0);
sun.position.set(3.6, 6.8, 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -3.2;
sun.shadow.camera.right = 3.2;
sun.shadow.camera.top = 4.2;
sun.shadow.camera.bottom = -0.6;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 16;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.022;
scene.add(sun);
scene.add(sun.target);
sun.target.position.set(0, 1.5, 0);

/* 蓝色补边：白底上靠冷边把植株轮廓从背景里"切"出来 */
const rim = new THREE.DirectionalLight(0x9dc8f5, 0.72);
rim.position.set(-4.6, 2.6, -3.8);
scene.add(rim);

const fillPoint = new THREE.PointLight(0xcfe2f4, 0.40, 14, 2);
fillPoint.position.set(0, 1.1, -3.0);
scene.add(fillPoint);

const rootGlow = new THREE.PointLight(0xffa860, 0.0, 3.4, 2);
rootGlow.position.set(0, 0.42, 0);
scene.add(rootGlow);

/* ---- 场景根 ---- */
const world = new THREE.Group();
scene.add(world);

/* ---- 地面 ---- */
(function buildGround() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(256, 256, 20, 256, 256, 250);
  /* 摄影棚式无边地面：中心纯白，向外渐变成和背景同一个浅蓝。
     最外圈必须落在背景色上，否则圆盘边缘会留一道弧线。 */
  rg.addColorStop(0, '#ffffff');
  rg.addColorStop(0.34, '#f7fbfe');
  rg.addColorStop(0.66, '#edf3fa');
  rg.addColorStop(1, '#e7eff8');
  g.fillStyle = rg;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.97, metalness: 0 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.02;
  disc.receiveShadow = true;
  scene.add(disc);
})();

/* ---- 接地阴影 ----
   浅底场景的关键一步。白底上的花盆如果只有真实投影，会被地面的
   高光淹没，整株看着是"浮"在纸上的。这里垫一片柔和的接地暗影，
   半径略大于盆口、偏向背光侧，植物才真正站在地上。 */
(function buildContactShadow() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(26,40,54,0.62)');
  rg.addColorStop(0.34, 'rgba(26,40,54,0.38)');
  rg.addColorStop(0.66, 'rgba(26,40,54,0.13)');
  rg.addColorStop(1, 'rgba(26,40,54,0)');
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

/* ---- 尺寸自适应 ---- */
function resize() {
  const stage = document.getElementById('stage');
  const w = Math.max(2, stage.clientWidth);
  const h = Math.max(2, stage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.05 ? 46 : 36;
  camera.updateProjectionMatrix();
  applyCamera();
  if (typeof updatePointScale === 'function') updatePointScale();
  if (typeof resizePost === 'function') resizePost();
}
window.addEventListener('resize', resize);
