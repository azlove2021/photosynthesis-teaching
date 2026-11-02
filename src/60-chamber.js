/* =========================================================
   60 · 同化箱 / 两只探头 / 浮尘
   ---------------------------------------------------------
   玻璃箱体不参与拾取（BackSide 的盒子会把背后的一切都挡掉），
   它只负责「这是一本封闭的账」这件事。
   ========================================================= */
'use strict';

const CHAMBER = { w: 3.00, h: 3.02, d: 2.20, cy: 1.51 };
const chamberGroup = new THREE.Group();
world.add(chamberGroup);

(function buildChamber() {
  const geo = new THREE.BoxGeometry(CHAMBER.w, CHAMBER.h, CHAMBER.d);

  /* 箱内那层白幕：BackSide 会同时画出底面、后面、侧面三层背面，
     每层都加一点白就等于箱内整天蒙雾，所以压到 3.4%。
     玻璃的存在感交给菲涅尔冷边和金属压框。 */
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdcecfa, transparent: true, opacity: 0.034,
    roughness: 0.04, metalness: 0, side: THREE.BackSide,
    depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.4
  });
  const box = new THREE.Mesh(geo, glass);
  box.position.y = CHAMBER.cy;
  box.renderOrder = 6;
  chamberGroup.add(box);

  /* 白底上不能用加法混合——往白里加什么都是白。改成正常混合的
     蓝色描边：掠射角越强蓝得越实，玻璃的「存在感」全由这圈冷边给。 */
  const rimGlass = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x2f6c96) },
      uAmt: { value: 0.26 },
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
      '  #include <encodings_fragment>',
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

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x3d7cab, transparent: true, opacity: 0.55 })
  );
  edges.position.y = CHAMBER.cy;
  chamberGroup.add(edges);

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

  /* 顶盖必须是不受光材质：灯管就在盖板上方 0.35 m，一受光就烧出
     一个椭圆白斑，像箱盖破了个洞。玻璃本来也不该「被照白」。 */
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(CHAMBER.w + 0.07, 0.016, CHAMBER.d + 0.07),
    new THREE.MeshBasicMaterial({
      map: (function () {
        const S = 256, c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        const lg = g.createLinearGradient(0, 0, 0, S);
        lg.addColorStop(0.00, 'rgba(186,214,240,0.66)');
        lg.addColorStop(0.22, 'rgba(214,232,248,0.34)');
        lg.addColorStop(0.55, 'rgba(238,247,255,0.20)');
        lg.addColorStop(1.00, 'rgba(199,224,246,0.52)');
        g.fillStyle = lg; g.fillRect(0, 0, S, S);
        const rg = g.createLinearGradient(0, S * 0.30, S, S * 0.05);
        rg.addColorStop(0.00, 'rgba(255,255,255,0)');
        rg.addColorStop(0.46, 'rgba(255,255,255,0.34)');
        rg.addColorStop(0.56, 'rgba(255,255,255,0.34)');
        rg.addColorStop(1.00, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(0, 0, S, S);
        const tx = new THREE.CanvasTexture(c);
        tx.encoding = THREE.sRGBEncoding;
        return tx;
      })(),
      transparent: true, opacity: 1, depthWrite: false
    })
  );
  lid.position.y = CHAMBER.h + 0.008;
  lid.renderOrder = 7;
  chamberGroup.add(lid);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xa9bccd, roughness: 0.34, metalness: 0.35
  });
  const fW = CHAMBER.w + 0.07, fD = CHAMBER.d + 0.07;
  const fy = CHAMBER.h + 0.020, fw = 0.030;
  [-1, 1].forEach(function (s) {
    const bx = new THREE.Mesh(new THREE.BoxGeometry(fW, fw, fw), frameMat);
    bx.position.set(0, fy, s * (fD / 2 - fw / 2));
    chamberGroup.add(bx);
    const bz = new THREE.Mesh(new THREE.BoxGeometry(fw, fw, fD - fw * 2), frameMat);
    bz.position.set(s * (fW / 2 - fw / 2), fy, 0);
    chamberGroup.add(bz);
  });
})();

/* --- 两只探头：贴壁朝内，一只测 CO₂、一只测 O₂ --- */
const sensorPods = {};
(function buildSensors() {
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x46586a, roughness: 0.42, metalness: 0.6 });
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xc6d4e0, roughness: 0.3, metalness: 0.8 });

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

    /* 探头色团：白底上加不出亮度，读数改用「色团实度 + 尺寸」编码 */
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
      blending: THREE.NormalBlending, depthWrite: false
    }));
    halo.scale.set(0.30, 0.30, 1);
    halo.position.copy(tip.position);
    g.add(halo);

    chamberGroup.add(g);

    const lamp = new THREE.PointLight(color, 0.35, 1.4, 2);
    lamp.position.copy(tip.position);
    chamberGroup.add(lamp);

    sensorPods[name] = { group: g, tip: tip, halo: halo, lamp: lamp, base: color, world: new THREE.Vector3() };
  }
  pod('co2', 1, 0xd9822b);
  pod('o2', -1, 0x18a06d);
})();

/* --- 浮尘：空气里有东西在动，箱体才不像一张纸 --- */
let dust, dustAttr, dustSeed;
(function buildDust() {
  const ND = 240;
  const pos = new Float32Array(ND * 3);
  dustSeed = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) {
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
    size: 0.020, map: DOT_TEX, color: 0x9db4c8,
    transparent: true, opacity: 0.0, depthWrite: false,
    blending: THREE.NormalBlending, sizeAttenuation: true
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
  dust.material.opacity = 0.014 + lightNorm * 0.095;
}

/* --- 探头随读数变化 --- */
function updateSensors(netSign, absNet, time) {
  const k = clamp(absNet / 10, 0, 1);
  const pulse = 0.82 + 0.18 * Math.sin((time || 0) * 3.2);
  sensorPods.co2.lamp.intensity = (0.16 + k * 0.34) * pulse;
  sensorPods.o2.lamp.intensity = (0.16 + k * 0.34) * pulse;
  sensorPods.co2.halo.material.opacity = 0.18 + k * 0.52;
  sensorPods.o2.halo.material.opacity = 0.18 + k * 0.52;
  const hs = 0.20 + k * 0.26;
  sensorPods.co2.halo.scale.set(hs, hs, 1);
  sensorPods.o2.halo.scale.set(hs, hs, 1);
  sensorPods.co2.tip.material.color.setHex(netSign > 0 ? 0xd9822b : 0x9a8a72);
  sensorPods.o2.tip.material.color.setHex(netSign > 0 ? 0x18a06d : 0x6b8d84);
  sensorPods.co2.halo.material.color.setHex(netSign > 0 ? 0xe89a3c : 0xb0a08a);
  sensorPods.o2.halo.material.color.setHex(netSign > 0 ? 0x2fb37f : 0x8aa8a0);
}
