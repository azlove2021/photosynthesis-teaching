/* =========================================================
   42 · 吊装条形日光灯
   ---------------------------------------------------------
   为什么灯必须是"实体"，而且必须与主光同源：
   浅色场景里"更亮"几乎没有余量可用（白底已经顶到 255），光强的变化
   只能靠**可见的因果**传达——灯管亮起来、灯下浮起一层暖晕、地面上
   铺开一块光池、投影的角度跟着灯走。光源如果在画面之外，学生看到的
   只是"画面整体变亮了"，那是曝光变了，不是灯变了。
   灯在画面里，因果才闭合。

   几何上有一个必须让步的地方：相机眼高 3.775，灯管在 3.385，也就是
   镜头几乎与灯**齐平**、只高出 3.2°。这种视高下，任何"罩在灯管上方、
   半径大于灯管"的反光罩都会从正面把灯管整个挡住——第一版做成
   r=0.176 的半圆槽，导出的图上只剩下一条灰色大板和底下一线暖色。
   所以灯罩压到 r=0.115（管径的 2.7 倍，接近真实灯具比例），
   并且把灯管**下移到罩口以下**：罩沿在 +0.055，灯管顶在 +0.042，
   整根管子都露在罩外，罩只负责"压在头顶"这个语义。

   反馈通道（都由归一化电平 lp 驱动，见 setLampLevel）：
     ① 灯管本体   ：冷灰玻璃 → 暖白（色温比亮度更能说明"在工作"）
     ② 灯管光晕   ：白底上加不出亮度，只能加"暖色团"，尺寸与实度一起长
     ③ 灯罩内壁   ：齐平时只看得到罩沿一线暖边，聊胜于无，但便宜
     ④ 灯下柔晕   ：极低不透明度的暖色 Sprite，给灯下一层空气感
     ⑤ 地面光池   ：由 10-scene.js 的 keyLight（SpotLight）真实投出
   ========================================================= */
'use strict';

const LAMPFIX = {
  halfLen: 0.65,      /* 灯管半长（总长 1.30，箱宽 3.0 的 43%） */
  tubeR: 0.042,
  hoodR: 0.115,       /* 再大就会在正面把灯管挡住，见文件头说明 */
  rimLift: 0.055,     /* 罩沿高出灯管中心多少 */
  capLen: 0.070
};

const lampRig = new THREE.Group();
lampRig.position.set(LAMP.x, LAMP.y, LAMP.z);
scene.add(lampRig);

/* ---- 灯管 ---- */
const C_TUBE_OFF = new THREE.Color(0x6f7d8b);
const C_TUBE_ON = new THREE.Color(0xfff4d4);
const C_HOOD_OFF = new THREE.Color(0x7c8996);
const C_HOOD_ON = new THREE.Color(0xffdfa8);

const lampTubeMat = new THREE.MeshBasicMaterial({ color: C_TUBE_OFF.clone() });
const lampTube = new THREE.Mesh(
  new THREE.CylinderGeometry(LAMPFIX.tubeR, LAMPFIX.tubeR, LAMPFIX.halfLen * 2, 20, 1, false),
  lampTubeMat
);
lampTube.rotation.z = Math.PI / 2;
lampRig.add(lampTube);

/* ---- 两端灯脚 ---- */
const lampCapMat = new THREE.MeshStandardMaterial({
  color: 0x8e9dad, roughness: 0.42, metalness: 0.62
});
[-1, 1].forEach(function (s) {
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(LAMPFIX.tubeR + 0.012, LAMPFIX.tubeR + 0.012,
      LAMPFIX.capLen, 16),
    lampCapMat
  );
  cap.rotation.z = Math.PI / 2;
  cap.position.x = s * (LAMPFIX.halfLen + LAMPFIX.capLen / 2 - 0.004);
  lampRig.add(cap);
});

/* ---- 反光罩（上半圆槽，开口朝下，整体抬到灯管之上） ----
   CylinderGeometry 的轴是 Y，theta 0..π 取 x≥0 那半边；
   rotateZ(-π/2) 把 (x,y,z) 映射成 (y,-x,z)：轴转到 X、x≥0 那半变成 y≥0。
   于是得到长度沿 X、覆盖上半、开口朝下的反光槽。 */
const hoodLen = LAMPFIX.halfLen * 2 + 0.16;
const hoodY = LAMPFIX.rimLift;

function hoodShell(r, len) {
  const g = new THREE.CylinderGeometry(r, r, len, 30, 1, true, Math.PI, Math.PI);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/* 外壁：正面渲染，从下方看不见 */
const lampHoodOutMat = new THREE.MeshStandardMaterial({
  color: 0xdae5f0, roughness: 0.34, metalness: 0.5, side: THREE.FrontSide
});
const hoodOut = new THREE.Mesh(hoodShell(LAMPFIX.hoodR, hoodLen), lampHoodOutMat);
hoodOut.position.y = hoodY;
lampRig.add(hoodOut);

/* 内壁：略缩一圈、背面渲染。这一层被自己的灯管照亮，交给场景灯算不出来 */
const lampHoodInMat = new THREE.MeshBasicMaterial({
  color: C_HOOD_OFF.clone(), side: THREE.BackSide
});
const hoodIn = new THREE.Mesh(hoodShell(LAMPFIX.hoodR - 0.007, hoodLen - 0.012), lampHoodInMat);
hoodIn.position.y = hoodY;
lampRig.add(hoodIn);

/* 两端封板 */
const lampPlateMat = new THREE.MeshStandardMaterial({
  color: 0xcfdbe7, roughness: 0.38, metalness: 0.45, side: THREE.DoubleSide
});
[-1, 1].forEach(function (s) {
  const pg = new THREE.CircleGeometry(LAMPFIX.hoodR, 20, 0, Math.PI);
  pg.rotateY(Math.PI / 2);
  const plate = new THREE.Mesh(pg, lampPlateMat);
  plate.position.set(s * (hoodLen / 2), hoodY, 0);
  lampRig.add(plate);
});

/* ---- 吊杆（伸出画面，说明"这盏灯挂在天花板上"） ---- */
const lampRodMat = new THREE.MeshStandardMaterial({
  color: 0xafbdcc, roughness: 0.32, metalness: 0.7
});
[-0.44, 0.44].forEach(function (x) {
  const rodTop = hoodY + LAMPFIX.hoodR;
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0105, 0.0105, 1.80, 8), lampRodMat);
  rod.position.set(x, rodTop + 0.90, 0);
  lampRig.add(rod);
  const nut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.030, 12), lampCapMat);
  nut.position.set(x, rodTop + 0.012, 0);
  lampRig.add(nut);
});

/* ---- 光晕 / 灯下柔晕 ---- */
function softBlob(stops) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(function (s) { rg.addColorStop(s[0], s[1]); });
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

const HALO_TEX = softBlob([
  [0.00, 'rgba(255,255,255,0.96)'],
  [0.30, 'rgba(255,255,255,0.60)'],
  [0.58, 'rgba(255,255,255,0.22)'],
  [0.80, 'rgba(255,255,255,0.06)'],
  [1.00, 'rgba(255,255,255,0)']
]);

const lampHalo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: HALO_TEX, color: 0xffb84d, transparent: true, opacity: 0,
  blending: THREE.NormalBlending, depthWrite: false, fog: false
}));
lampHalo.scale.set(1.55, 0.34, 1);
lampRig.add(lampHalo);

const lampHaze = new THREE.Sprite(new THREE.SpriteMaterial({
  map: HALO_TEX, color: 0xffd79a, transparent: true, opacity: 0,
  blending: THREE.NormalBlending, depthWrite: false, fog: false
}));
lampHaze.scale.set(3.00, 1.90, 1);
lampHaze.position.set(0, -0.66, 0.08);
lampRig.add(lampHaze);

/* ---- 由 60-ui.js 每帧调用 ---- */
function setLampLevel(lp) {
  const k = clamp(lp, 0, 1);
  const k2 = k * k;

  lampTubeMat.color.copy(C_TUBE_OFF).lerp(C_TUBE_ON, k);
  lampHoodInMat.color.copy(C_HOOD_OFF).lerp(C_HOOD_ON, k);

  /* 白底上加不出亮度，只能加暖色团；尺寸与实度一起长，
     "灯开得更足"这件事才有可读的幅度 */
  lampHalo.material.opacity = 0.84 * k2;
  lampHalo.scale.set(1.48 + k * 1.15, 0.30 + k * 0.52, 1);

  lampHaze.material.opacity = 0.10 * k2;
  lampHaze.scale.set(2.80 + k * 0.95, 1.75 + k * 0.65, 1);
}

setLampLevel(0);
