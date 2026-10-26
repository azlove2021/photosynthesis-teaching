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
scene.fog = new THREE.Fog(0x030807, 10.5, 22);

const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);

/* ---- 自建轨道控制（不引入 OrbitControls，保持单文件） ---- */
const Orbit = {
  az: 0.34, pol: 1.255, dist: 5.45,
  taz: 0.34, tpol: 1.255, tdist: 5.45,
  target: new THREE.Vector3(0, 1.50, 0),
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
  Orbit.taz = 0.34; Orbit.tpol = 1.255; Orbit.tdist = 5.45;
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

/* ---- 灯光 ---- */
const hemi = new THREE.HemisphereLight(0xa9e6cd, 0x0d1a16, 0.5);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1d8, 2.2);
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

const rim = new THREE.DirectionalLight(0x6fb2ff, 0.88);
rim.position.set(-4.6, 2.6, -3.8);
scene.add(rim);

const fillPoint = new THREE.PointLight(0x2f7a66, 0.55, 14, 2);
fillPoint.position.set(0, 1.1, -3.0);
scene.add(fillPoint);

const rootGlow = new THREE.PointLight(0xff8a3d, 0.0, 3.4, 2);
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
  const rg = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  /* 地面是一片摄影棚式的暗色衰减：中心留一点可读的绿，
     边缘迅速压到黑，这样 ACES 的暗部抬升不会把整块地抬成亮青色 */
  rg.addColorStop(0, '#16281f');
  rg.addColorStop(0.28, '#0b1713');
  rg.addColorStop(0.55, '#050c0a');
  rg.addColorStop(1, '#000000');
  g.fillStyle = rg;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.98, metalness: 0 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.02;
  disc.receiveShadow = true;
  scene.add(disc);
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
