/* =========================================================
   40 · 同化箱、传感器探头、光柱、浮尘
   ========================================================= */
'use strict';

const CHAMBER = { w: 3.00, h: 3.30, d: 2.20, cy: 1.65 };

const chamberGroup = new THREE.Group();
world.add(chamberGroup);

/* --- 玻璃箱体 --- */
(function buildChamber() {
  const geo = new THREE.BoxGeometry(CHAMBER.w, CHAMBER.h, CHAMBER.d);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfeee0,
    transparent: true,
    opacity: 0.042,
    roughness: 0.03,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.4
  });
  const box = new THREE.Mesh(geo, glass);
  box.position.y = CHAMBER.cy;
  box.renderOrder = 6;
  chamberGroup.add(box);

  /* 棱线 */
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x8fe8d0, transparent: true, opacity: 0.30 })
  );
  edges.position.y = CHAMBER.cy;
  chamberGroup.add(edges);

  /* 四角立柱 */
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x9ee6d4, roughness: 0.25, metalness: 0.55,
    transparent: true, opacity: 0.55
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
      color: 0xa8e3d3, roughness: 0.18, metalness: 0.35,
      transparent: true, opacity: 0.30
    })
  );
  lid.position.y = CHAMBER.h + 0.017;
  chamberGroup.add(lid);
})();

/* --- 传感器探头（贴壁安装，探杆指向箱内） --- */
const sensorPods = {};
(function buildSensors() {
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x233330, roughness: 0.45, metalness: 0.7
  });
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0xb8c9c4, roughness: 0.28, metalness: 0.85
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

    /* 探头光晕 */
    const sc = document.createElement('canvas');
    sc.width = sc.height = 64;
    const sg = sc.getContext('2d');
    const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(0.4, 'rgba(255,255,255,0.28)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = rg; sg.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(sc),
      color: color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    halo.scale.set(0.30, 0.30, 1);
    halo.position.copy(tip.position);
    g.add(halo);

    chamberGroup.add(g);

    const lamp = new THREE.PointLight(color, 0.5, 1.4, 2);
    lamp.position.copy(tip.position);
    chamberGroup.add(lamp);

    sensorPods[name] = { group: g, tip: tip, halo: halo, lamp: lamp, base: color };
  }
  pod('co2', 1, 0xffb454);
  pod('o2', -1, 0x6ee7c4);
})();

/* --- 光柱 --- */
let beamMesh, sunSprite;
(function buildBeam() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,244,214,0.95)');
  gr.addColorStop(0.25, 'rgba(255,240,200,0.55)');
  gr.addColorStop(0.72, 'rgba(255,238,196,0.18)');
  gr.addColorStop(1, 'rgba(255,238,196,0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  const sunPos = new THREE.Vector3(3.6, 6.8, 2.8);
  const tgt = new THREE.Vector3(0, 1.35, 0);
  const dir = new THREE.Vector3().subVectors(tgt, sunPos);
  const h = dir.length();
  dir.normalize();

  const cone = new THREE.ConeGeometry(2.05, h, 40, 1, true);
  beamMesh = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.10,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  }));
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), dir.clone().negate()
  );
  beamMesh.quaternion.copy(q);
  beamMesh.position.copy(sunPos).add(dir.clone().multiplyScalar(h / 2));
  beamMesh.frustumCulled = false;
  beamMesh.renderOrder = 7;
  world.add(beamMesh);

  /* 光源光晕 */
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,240,1)');
  rg.addColorStop(0.22, 'rgba(255,244,205,0.55)');
  rg.addColorStop(1, 'rgba(255,240,190,0)');
  sg.fillStyle = rg;
  sg.fillRect(0, 0, 128, 128);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sc),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  }));
  sunSprite.scale.set(1.7, 1.7, 1);
  sunSprite.position.copy(sunPos);
  world.add(sunSprite);
})();

/* --- 浮尘（让光柱有体积感） --- */
let dust, dustAttr, dustSeed;
(function buildDust() {
  const N = 260;
  const pos = new Float32Array(N * 3);
  dustSeed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 3.0;
    pos[i * 3 + 1] = 0.2 + Math.random() * 3.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
    dustSeed[i * 3] = 0.3 + Math.random() * 0.7;
    dustSeed[i * 3 + 1] = 0.4 + Math.random() * 0.8;
    dustSeed[i * 3 + 2] = Math.random() * 6.2832;
  }
  const geo = new THREE.BufferGeometry();
  dustAttr = new THREE.BufferAttribute(pos, 3);
  dustAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', dustAttr);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.7, 0), 5);
  dust = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.020,
    map: DOT_TEX,
    color: 0xfff4d0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
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
  dust.material.opacity = 0.06 + lightNorm * 0.30;
}

/* --- 传感器灯随读数变化 --- */
function updateSensors(netSign, absNet, time) {
  const k = clamp(absNet / 10, 0, 1);
  const pulse = 0.82 + 0.18 * Math.sin((time || 0) * 3.2);
  sensorPods.co2.lamp.intensity = (0.3 + k * 0.85) * pulse;
  sensorPods.o2.lamp.intensity = (0.3 + k * 0.85) * pulse;
  sensorPods.co2.halo.material.opacity = 0.25 + k * 0.6;
  sensorPods.o2.halo.material.opacity = 0.25 + k * 0.6;
  const h1 = 0.22 + k * 0.20, h2 = 0.22 + k * 0.20;
  sensorPods.co2.halo.scale.set(h1, h1, 1);
  sensorPods.o2.halo.scale.set(h2, h2, 1);
  sensorPods.co2.tip.material.color.setHex(netSign > 0 ? 0xffb454 : 0x8a6a3a);
  sensorPods.o2.tip.material.color.setHex(netSign > 0 ? 0x6ee7c4 : 0x3a6a5c);
}
