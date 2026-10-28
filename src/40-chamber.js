/* =========================================================
   40 · 同化箱、传感器探头、光柱、浮尘
   ========================================================= */
'use strict';

const CHAMBER = { w: 3.00, h: 3.02, d: 2.20, cy: 1.51 };

const chamberGroup = new THREE.Group();
world.add(chamberGroup);

/* --- 玻璃箱体 --- */
(function buildChamber() {
  const geo = new THREE.BoxGeometry(CHAMBER.w, CHAMBER.h, CHAMBER.d);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdcecfa,
    transparent: true,
    opacity: 0.062,
    roughness: 0.04,
    metalness: 0,
    side: THREE.BackSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.4
  });
  const box = new THREE.Mesh(geo, glass);
  box.position.y = CHAMBER.cy;
  box.renderOrder = 6;
  chamberGroup.add(box);

  /* 菲涅尔边缘。白底上不能再用加法混合——往白色里加什么都是白，
     箱体会彻底消失。改成正常混合的蓝色描边：掠射角越强蓝得越实，
     玻璃的"存在感"全部由这圈冷边提供。 */
  const rimGlass = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x2f6c96) },
      uAmt: { value: 0.30 },
      uPow: { value: 5.2 }
    },
    vertexShader: [
      'varying vec3 vN;',
      'varying vec3 vV;',
      'void main() {',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vN = normalize(normalMatrix * normal);',
      '  vV = normalize(-mv.xyz);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uColor;',
      'uniform float uAmt;',
      'uniform float uPow;',
      'varying vec3 vN;',
      'varying vec3 vV;',
      'void main() {',
      '  float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), uPow);',
      '  gl_FragColor = vec4(uColor, f * uAmt);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide
  });
  const shell = new THREE.Mesh(geo, rimGlass);
  shell.position.y = CHAMBER.cy;
  shell.renderOrder = 8;
  chamberGroup.add(shell);

  /* 棱线 */
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x2b6a9c, transparent: true, opacity: 0.62 })
  );
  edges.position.y = CHAMBER.cy;
  chamberGroup.add(edges);

  /* 四角立柱 */
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xa9c2d6, roughness: 0.28, metalness: 0.42,
    transparent: true, opacity: 0.5
  });
  const hx = CHAMBER.w / 2, hz = CHAMBER.d / 2;
  [[hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]].forEach(function (p) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, CHAMBER.h, 8), postMat);
    post.position.set(p[0], CHAMBER.cy, p[1]);
    chamberGroup.add(post);
  });

  /* 顶盖 */
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(CHAMBER.w + 0.07, 0.035, CHAMBER.d + 0.07),
    new THREE.MeshStandardMaterial({
      color: 0xc9dcee, roughness: 0.2, metalness: 0.3,
      transparent: true, opacity: 0.42
    })
  );
  lid.position.y = CHAMBER.h + 0.017;
  chamberGroup.add(lid);
})();

/* --- 传感器探头（贴壁安装，探杆指向箱内） --- */
const sensorPods = {};
(function buildSensors() {
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x46586a, roughness: 0.42, metalness: 0.6
  });
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0xc6d4e0, roughness: 0.3, metalness: 0.8
  });

  function pod(name, side, color) {
    const g = new THREE.Group();
    const wx = side * (CHAMBER.w / 2 - 0.012);
    const py = 2.58, pz = 0.30;

    const house = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.15, 0.10), housingMat);
    house.position.set(wx, py, pz);
    g.add(house);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.26, 10), rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(wx - side * 0.15, py, pz);
    g.add(rod);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.035, 12), housingMat);
    collar.rotation.z = Math.PI / 2;
    collar.position.set(wx - side * 0.275, py, pz);
    g.add(collar);

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.023, 14, 12),
      new THREE.MeshBasicMaterial({ color: color })
    );
    tip.position.set(wx - side * 0.300, py, pz);
    g.add(tip);

    /* 探头光晕：白底上加法无效，改成正常混合的柔和色团，
       读数越大色团越实、越大，本质仍是"示数的视觉编码" */
    const sc = document.createElement('canvas');
    sc.width = sc.height = 64;
    const sg = sc.getContext('2d');
    const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,0.90)');
    rg.addColorStop(0.4, 'rgba(255,255,255,0.26)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = rg; sg.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(sc),
      color: color, transparent: true,
      blending: THREE.NormalBlending, depthWrite: false, fog: false
    }));
    halo.scale.set(0.30, 0.30, 1);
    halo.position.copy(tip.position);
    g.add(halo);

    chamberGroup.add(g);

    const lamp = new THREE.PointLight(color, 0.35, 1.4, 2);
    lamp.position.copy(tip.position);
    chamberGroup.add(lamp);

    sensorPods[name] = { group: g, tip: tip, halo: halo, lamp: lamp, base: color };
  }
  pod('co2', 1, 0xd9822b);
  pod('o2', -1, 0x18a06d);
})();

/* --- 关于光柱 ---
   暗场版本里那道锥形光柱是靠加法混合在近黑的底上"发"出来的。
   白底上加法无从生效，改乘算又会因为锥壳的轮廓线在画面上留下一块
   边缘生硬的暖色多边形——试过 0.25/0.45/0.75 三档，最淡的一档也还是一块脏色。

   更根本的问题是：光照强度是这个课的主变量，它的表达应当落在"读数"上，
   而不是落在体积光这种氛围元素上。所以三维光柱整段去掉，
   改由 ① 舞台右上角的 CSS 暖光角（纯装饰，不参与出图）
       ② 常驻的「实验条件」卡片（光照 / 温度，纯净投影下也看得见）
   两处共同承担。
   叶片明暗本身由 60-ui.js 的 sun/hemi 强度直接驱动，随滑杆实时变化。 */

/* --- 浮尘（空气里有东西在动，箱体才不像一张纸） --- */
let dust, dustAttr, dustSeed;
(function buildDust() {
  const N = 260;
  const pos = new Float32Array(N * 3);
  dustSeed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (RNG() - 0.5) * 3.0;
    pos[i * 3 + 1] = 0.2 + RNG() * 3.2;
    pos[i * 3 + 2] = (RNG() - 0.5) * 2.2;
    dustSeed[i * 3] = 0.3 + RNG() * 0.7;
    dustSeed[i * 3 + 1] = 0.4 + RNG() * 0.8;
    dustSeed[i * 3 + 2] = RNG() * 6.2832;
  }
  const geo = new THREE.BufferGeometry();
  dustAttr = new THREE.BufferAttribute(pos, 3);
  dustAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', dustAttr);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.7, 0), 5);
  dust = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.020,
    map: DOT_TEX,
    color: 0x9db4c8,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
    fog: false
  }));
  dust.frustumCulled = false;
  world.add(dust);
})();

function updateDust(dt, time, lightNorm) {
  const p = dustAttr.array;
  for (let i = 0; i < p.length; i += 3) {
    p[i] += Math.sin(time * dustSeed[i] + dustSeed[i + 2]) * 0.0016;
    p[i + 1] += 0.0022 * dustSeed[i + 1];
    p[i + 2] += Math.cos(time * dustSeed[i] * 0.7 + dustSeed[i + 2]) * 0.0014;
    if (p[i + 1] > 3.5) p[i + 1] = 0.15;
  }
  dustAttr.needsUpdate = true;
  dust.material.opacity = 0.018 + lightNorm * 0.105;
}

/* --- 传感器灯随读数变化 --- */
function updateSensors(netSign, absNet, time) {
  const k = clamp(absNet / 10, 0, 1);
  const pulse = 0.82 + 0.18 * Math.sin((time || 0) * 3.2);
  sensorPods.co2.lamp.intensity = (0.16 + k * 0.34) * pulse;
  sensorPods.o2.lamp.intensity = (0.16 + k * 0.34) * pulse;
  /* 白底上"更亮"没有空间可用，读数改用**色团的实度与尺寸**编码：
     净光合越大，探头外的色晕越浓越大，学生一眼能看出强弱。 */
  sensorPods.co2.halo.material.opacity = 0.18 + k * 0.52;
  sensorPods.o2.halo.material.opacity = 0.18 + k * 0.52;
  const h1 = 0.20 + k * 0.26, h2 = 0.20 + k * 0.26;
  sensorPods.co2.halo.scale.set(h1, h1, 1);
  sensorPods.o2.halo.scale.set(h2, h2, 1);
  sensorPods.co2.tip.material.color.setHex(netSign > 0 ? 0xd9822b : 0x9a8a72);
  sensorPods.o2.tip.material.color.setHex(netSign > 0 ? 0x18a06d : 0x6b8d84);
  sensorPods.co2.halo.material.color.setHex(netSign > 0 ? 0xe89a3c : 0xb0a08a);
  sensorPods.o2.halo.material.color.setHex(netSign > 0 ? 0x2fb37f : 0x8aa8a0);
}
