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
/* dist 6.90 → 7.30：吊装日光灯要在箱盖之上才成立，而当前取景的顶边
   几乎就落在相机眼高上（俯角 18°、纵向 fov 36°，顶边 ≈ 水平线），
   箱盖往上的可用画面只有几十像素。退 6% 之后灯罩顶部仍留 ~20 px，
   灯管下沿与箱盖之间留出 ~22 px 的空隙，同时地面多露一点、光池更显。 */
const Orbit = {
  az: 0.34, pol: 1.255, dist: 7.30,
  taz: 0.34, tpol: 1.255, tdist: 7.30,
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
  Orbit.taz = 0.34; Orbit.tpol = 1.255; Orbit.tdist = 7.30;
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
   所以 hemi 的底噪拉高，主光的动态范围收窄。

   主光从平行光换成了**吊装日光灯位置上的聚光灯**，原因有三条：
   ① 平行光没有位置，地面不会出现"灯下的那个光池"，光强一变只是
      整片地面一起变亮，看不出"是灯在照"；而光池是这盏灯存在的证据。
   ② 投影方向必须由灯决定。平行光的投影角度和画面上那盏灯是两套
      独立的参数，学生一拖视角就会发现影子不是从灯里出来的。
   ③ 聚光灯自带锥角与半影，光池边缘天然是软的，不用再做假的光斑贴图。
   于是光池、投影、灯具外观三者严格同源，滑杆一动三者一起变。 */
const hemi = new THREE.HemisphereLight(0xffffff, 0xcbdbea, 0.86);
scene.add(hemi);

/* 灯具位置在 42-lamp.js 里也引用同一组常量，两边不能各自写死 */
const LAMP = {
  x: 0, y: 3.385, z: 0.62,    /* 灯管中心（略偏前，主光前倾 ~22°） */
  aim: new THREE.Vector3(0, 1.42, -0.16)
};

/* distance / decay 这一对参数不能随手写成 0：
   three.js r149 的 getDistanceAttenuation 在 distance === 0 时**直接返回 1.0**，
   decay 形同虚设。第一版就是这么写的，结果地面被主光按满强度打爆回 254，
   和"降低眩光"的目标正好相反。给一个有限 distance 之后
   pow(1 - d/distance, decay) 才成立，灯下的光池才有远近衰减。 */
const keyLight = new THREE.SpotLight(0xfff0cf, 0.6, 16, 0.62, 0.35, 2.0);
keyLight.position.set(LAMP.x, LAMP.y, LAMP.z);
keyLight.target.position.copy(LAMP.aim);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.6;
keyLight.shadow.camera.far = 10;
keyLight.shadow.bias = -0.0006;
keyLight.shadow.normalBias = 0.020;
scene.add(keyLight);
scene.add(keyLight.target);

/* 蓝色补边：白底上靠冷边把植株轮廓从背景里"切"出来 */
const rim = new THREE.DirectionalLight(0xa8cdf3, 0.62);
rim.position.set(-4.6, 2.6, -3.8);
scene.add(rim);

const fillPoint = new THREE.PointLight(0xcfe2f4, 0.32, 14, 2);
fillPoint.position.set(0, 1.1, -3.0);
scene.add(fillPoint);

const rootGlow = new THREE.PointLight(0xffa860, 0.0, 3.4, 2);
rootGlow.position.set(0, 0.42, 0);
scene.add(rootGlow);

/* ---- 场景根 ---- */
const world = new THREE.Group();
scene.add(world);

/* ---- 地面 ----
   这里改的是**反照率**，不是曝光。
   旧版贴图中心是 #ffffff（线性 1.0），在 I=800 时地面线性值被推到 1.27、
   I=2000 时 1.92，两者都超过中性曲线的肩部 0.855，于是双双被压到 254——
   地面在暗态和满光下是同一种白：既刺眼，又完全不反映光强。
   把反照率压到约 0.50 线性（#bccddd）之后，地面落在 #bc(暗) ~ #dd(满光)
   这一段，主光才有了"还能更亮"的余量，灯下的光池才可能出现。
   边缘用 alpha 渐隐而不用雾去藏：地面变暗之后，靠"光照凑到背景色"
   已经不可能成立（反照率 0.5 怎么打光都到不了 #eef4fb），
   只有让不透明度自己归零，圆盘边界才会真正消失。 */
(function buildGround() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, S * 0.02, S / 2, S / 2, S * 0.5);
  rg.addColorStop(0.00, 'rgba(172,174,178,1)');
  rg.addColorStop(0.26, 'rgba(169,171,176,1)');
  rg.addColorStop(0.46, 'rgba(172,174,178,0.94)');
  rg.addColorStop(0.64, 'rgba(178,180,184,0.66)');
  rg.addColorStop(0.80, 'rgba(184,186,190,0.28)');
  rg.addColorStop(1.00, 'rgba(190,192,196,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(9, 96),
    new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.965, metalness: 0,
      transparent: true, depthWrite: true
    })
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
