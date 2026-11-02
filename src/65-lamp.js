/* =========================================================
   65 · 吊装条形日光灯
   ---------------------------------------------------------
   浅色场景里「更亮」几乎没有余量，光强的变化只能靠可见的因果：
   灯管亮起来、灯罩内壁被烤暖、地面浮出光池、投影角度跟着灯走。
   光源如果在画面之外，学生看到的只是「曝光变了」，不是「灯变了」。
   ========================================================= */
'use strict';

const LAMPFIX = {
  halfLen: 0.65, tubeR: 0.042, hoodR: 0.115, rimLift: 0.055, capLen: 0.070
};

const lampRig = new THREE.Group();
lampRig.position.set(LAMP.x, LAMP.y, LAMP.z);
scene.add(lampRig);

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

const lampCapMat = new THREE.MeshStandardMaterial({
  color: 0x8e9dad, roughness: 0.42, metalness: 0.62
});
[-1, 1].forEach(function (s) {
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(LAMPFIX.tubeR + 0.012, LAMPFIX.tubeR + 0.012, LAMPFIX.capLen, 16),
    lampCapMat
  );
  cap.rotation.z = Math.PI / 2;
  cap.position.x = s * (LAMPFIX.halfLen + LAMPFIX.capLen / 2 - 0.004);
  lampRig.add(cap);
});

/* 反光罩：CylinderGeometry 轴为 Y，theta π..2π 取 x≥0 半边，
   rotateZ(-π/2) 把轴转到 X，得到「长度沿 X、覆盖上半、开口朝下」的槽。
   罩半径必须压到灯管直径的 2.7 倍——相机眼高几乎与灯齐平，
   再大就会从正面把整根灯管挡住。 */
const hoodLen = LAMPFIX.halfLen * 2 + 0.16;
const hoodY = LAMPFIX.rimLift;

function hoodShell(r, len) {
  const g = new THREE.CylinderGeometry(r, r, len, 30, 1, true, Math.PI, Math.PI);
  g.rotateZ(-Math.PI / 2);
  return g;
}

const lampHoodOutMat = new THREE.MeshStandardMaterial({
  color: 0xdae5f0, roughness: 0.34, metalness: 0.5, side: THREE.FrontSide
});
const hoodOut = new THREE.Mesh(hoodShell(LAMPFIX.hoodR, hoodLen), lampHoodOutMat);
hoodOut.position.y = hoodY;
lampRig.add(hoodOut);

const lampHoodInMat = new THREE.MeshBasicMaterial({
  color: C_HOOD_OFF.clone(), side: THREE.BackSide
});
const hoodIn = new THREE.Mesh(hoodShell(LAMPFIX.hoodR - 0.007, hoodLen - 0.012), lampHoodInMat);
hoodIn.position.y = hoodY;
lampRig.add(hoodIn);

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

const lampRodMat = new THREE.MeshStandardMaterial({
  color: 0xafbdcc, roughness: 0.32, metalness: 0.7
});
[-0.44, 0.44].forEach(function (x) {
  const rodTop = hoodY + LAMPFIX.hoodR;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 1.80, 8), lampRodMat);
  rod.position.set(x, rodTop + 0.90, 0);
  lampRig.add(rod);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.030, 12), lampCapMat);
  nut.position.set(x, rodTop + 0.012, 0);
  lampRig.add(nut);
});

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
  blending: THREE.NormalBlending, depthWrite: false
}));
lampHalo.scale.set(1.55, 0.34, 1);
lampRig.add(lampHalo);

const lampHaze = new THREE.Sprite(new THREE.SpriteMaterial({
  map: HALO_TEX, color: 0xffd79a, transparent: true, opacity: 0,
  blending: THREE.NormalBlending, depthWrite: false
}));
lampHaze.scale.set(3.00, 1.90, 1);
lampHaze.position.set(0, -0.66, 0.08);
lampRig.add(lampHaze);

function setLampLevel(lp) {
  const k = clamp(lp, 0, 1);
  const k2 = k * k;
  lampTubeMat.color.copy(C_TUBE_OFF).lerp(C_TUBE_ON, k);
  lampHoodInMat.color.copy(C_HOOD_OFF).lerp(C_HOOD_ON, k);
  lampHalo.material.opacity = 0.80 * k2;
  lampHalo.scale.set(1.48 + k * 1.15, 0.30 + k * 0.52, 1);
  lampHaze.material.opacity = 0.09 * k2;
  lampHaze.scale.set(2.80 + k * 0.95, 1.75 + k * 0.65, 1);
}

setLampLevel(0);

/* 灯的浮动标签锚点 */
const LAMP_ANCHOR = new THREE.Vector3(0, LAMP.y + 0.24, LAMP.z);
