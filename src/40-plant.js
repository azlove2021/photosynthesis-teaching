/* =========================================================
   40 · 程序化植株（叶 / 茎 / 根 三个器官分组）
   ---------------------------------------------------------
   与上一版的差别只有一处：所有部件按器官归到三个 Group 里，
   器官级读数、点选高亮、粒子降暗都靠这三个分组定位。
   几何与材质沿用已经调好的参数，不重做。
   ========================================================= */
'use strict';

/* ---- 拾取注册表（70-pick.js 消费；自检脚本也认这三个名字） ---- */
const PICK_ROOTS = [];
const PICK_OBJ = {};
const PICK_INFO = {
  leaf: {
    name: '叶片', cat: '光合器官', color: '#12A06A',
    note: '只有含叶绿体的绿色部分能进行光合作用。叶片是这株植物唯一的固碳器官，整株的总光合全部记在叶片上。',
    tip: '问「叶片的净光合」只扣叶片自己的呼吸；问「整株」还要扣掉根和茎的。'
  },
  stem: {
    name: '茎', cat: '非光合器官', color: '#7C9E4E',
    note: '成熟茎的表皮细胞不含叶绿体，只进行呼吸，不固定 CO₂；它负责把根吸收的水和无机盐运到叶片。',
    tip: '茎的净光合永远是负值——它只消耗，不生产。'
  },
  root: {
    name: '根', cat: '非光合器官', color: '#C08457',
    note: '根在土里，没有光也没有叶绿体，只进行呼吸作用；它吸收的水分要靠茎一路运到叶片。',
    tip: '「根不进行光合作用」对，「根不进行呼吸作用」错。'
  }
};
function regPick(obj, id) {
  obj.traverse(function (o) { o.userData.pickId = id; });
  obj.userData.pickId = id;
  PICK_ROOTS.push(obj);
  PICK_OBJ[id] = obj;
}

/* ---------- 叶面贴图 ---------- */
function makeLeafTexture() {
  const W = 640, H = 1280;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a5f1f');
  bg.addColorStop(0.30, '#3a7529');
  bg.addColorStop(0.65, '#316a23');
  bg.addColorStop(1, '#214c19');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const cg = g.createLinearGradient(0, 0, W, 0);
  cg.addColorStop(0, 'rgba(18,44,16,0.42)');
  cg.addColorStop(0.22, 'rgba(255,255,220,0.05)');
  cg.addColorStop(0.5, 'rgba(255,255,225,0.11)');
  cg.addColorStop(0.78, 'rgba(255,255,220,0.05)');
  cg.addColorStop(1, 'rgba(18,44,16,0.42)');
  g.fillStyle = cg;
  g.fillRect(0, 0, W, H);

  for (let i = 0; i < 1400; i++) {
    const x = RNG() * W, y = RNG() * H;
    const r = 8 + RNG() * 54;
    g.fillStyle = RNG() > 0.52
      ? 'rgba(166,214,116,' + (0.025 + RNG() * 0.05).toFixed(3) + ')'
      : 'rgba(16,48,18,' + (0.025 + RNG() * 0.06).toFixed(3) + ')';
    g.beginPath();
    g.ellipse(x, y, r, r * (0.4 + RNG() * 0.9), RNG() * 3.14, 0, 6.2832);
    g.fill();
  }

  const midX = W / 2;
  function veinGlow(pathFn, w, col) {
    g.lineCap = 'round';
    g.beginPath(); pathFn(); g.lineWidth = w * 2.6;
    g.strokeStyle = 'rgba(150,196,104,0.14)'; g.stroke();
    g.beginPath(); pathFn(); g.lineWidth = w;
    g.strokeStyle = col; g.stroke();
  }
  for (let i = 0; i < 17; i++) {
    const y0 = 44 + i * 70;
    const signs = [1, -1];
    for (let si = 0; si < 2; si++) {
      const sign = signs[si];
      const reach = (232 + RNG() * 42);
      const drop = 92 + RNG() * 34;
      const y1 = y0 + (sign > 0 ? 0 : 34);
      veinGlow(function () {
        g.moveTo(midX, y1);
        g.quadraticCurveTo(midX + sign * reach * 0.44, y1 - drop * 0.26,
                           midX + sign * reach, y1 - drop);
      }, 2.6 - i * 0.055, 'rgba(226,246,186,0.62)');

      for (let k = 1; k <= 7; k++) {
        const tt = k / 8;
        const bx = midX + sign * reach * (tt * 0.9);
        const by = y1 - drop * (tt * 0.74);
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + sign * reach * 0.15, by - drop * 0.24);
        g.lineWidth = 1.0;
        g.strokeStyle = 'rgba(206,236,160,0.34)';
        g.stroke();
      }
    }
  }

  g.strokeStyle = 'rgba(190,228,144,0.20)';
  for (let i = 0; i < 620; i++) {
    const x = RNG() * W, y = RNG() * H;
    const a = RNG() * 6.2832, L = 10 + RNG() * 32;
    g.lineWidth = 0.6 + RNG() * 0.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L * 0.45);
    g.stroke();
  }

  for (let i = 0; i < 2200; i++) {
    const x = RNG() * W, y = RNG() * H;
    g.fillStyle = 'rgba(14,50,20,' + (0.05 + RNG() * 0.10).toFixed(3) + ')';
    g.beginPath();
    g.ellipse(x, y, 1.7, 1.0, RNG() * 3.14, 0, 6.2832);
    g.fill();
  }

  const mg = g.createLinearGradient(midX - 13, 0, midX + 13, 0);
  mg.addColorStop(0, 'rgba(120,178,84,0.20)');
  mg.addColorStop(0.34, 'rgba(206,238,166,0.52)');
  mg.addColorStop(0.5, 'rgba(238,255,206,0.82)');
  mg.addColorStop(0.66, 'rgba(206,238,166,0.52)');
  mg.addColorStop(1, 'rgba(120,178,84,0.20)');
  g.fillStyle = mg;
  g.beginPath();
  g.moveTo(midX - 11, 0);
  g.quadraticCurveTo(midX - 15, H * 0.5, midX - 3, H);
  g.lineTo(midX + 3, H);
  g.quadraticCurveTo(midX + 15, H * 0.5, midX + 11, 0);
  g.closePath();
  g.fill();

  const sh = g.createLinearGradient(0, H * 0.06, W, H * 0.5);
  sh.addColorStop(0, 'rgba(255,255,235,0)');
  sh.addColorStop(0.48, 'rgba(255,255,235,0.06)');
  sh.addColorStop(1, 'rgba(255,255,235,0)');
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H);

  return c;
}

function makeLeafBump() {
  const W = 320, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#2e2e2e';
  g.fillRect(0, 0, W, H);
  const midX = W / 2;
  g.lineCap = 'round';
  for (let i = 0; i < 17; i++) {
    const y0 = 22 + i * 35;
    const signs = [1, -1];
    for (let si = 0; si < 2; si++) {
      const sign = signs[si];
      const y1 = y0 + (sign > 0 ? 0 : 17);
      g.beginPath();
      g.moveTo(midX, y1);
      g.quadraticCurveTo(midX + sign * 51, y1 - 23, midX + sign * 117, y1 - 46);
      g.lineWidth = 2.6;
      g.strokeStyle = 'rgba(232,232,232,0.9)';
      g.stroke();
    }
  }
  g.beginPath();
  g.moveTo(midX, 0); g.lineTo(midX, H);
  g.lineWidth = 8;
  g.strokeStyle = '#fbfbfb';
  g.stroke();
  for (let i = 0; i < 900; i++) {
    const x = RNG() * W, y = RNG() * H;
    g.fillStyle = 'rgba(255,255,255,' + (0.04 + RNG() * 0.09).toFixed(3) + ')';
    g.fillRect(x, y, 1 + RNG() * 2, 1);
  }
  return c;
}

function makeStemTexture() {
  const W = 192, H = 768;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, '#26401d');
  bg.addColorStop(0.38, '#5c8a3e');
  bg.addColorStop(0.6, '#4e7a34');
  bg.addColorStop(1, '#1f3418');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  for (let i = 0; i < 220; i++) {
    const x = RNG() * W;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (RNG() - 0.5) * 14, H);
    g.lineWidth = 0.6 + RNG() * 3.0;
    g.strokeStyle = RNG() > 0.5
      ? 'rgba(158,198,116,' + (0.05 + RNG() * 0.16).toFixed(3) + ')'
      : 'rgba(12,30,10,' + (0.05 + RNG() * 0.18).toFixed(3) + ')';
    g.stroke();
  }
  for (let i = 0; i < 130; i++) {
    const x = RNG() * W, y = RNG() * H;
    g.fillStyle = 'rgba(206,228,166,' + (0.05 + RNG() * 0.14).toFixed(3) + ')';
    g.beginPath();
    g.ellipse(x, y, 1.6, 4.2, 0, 0, 6.2832);
    g.fill();
  }
  return c;
}

/* ---------- 叶片轮廓 ---------- */
function widthProfile(s) {
  const t = clamp(s, 0, 1);
  const base = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.74)), 0.82);
  const serr = 1 + 0.030 * Math.sin(t * 96.0) + 0.016 * Math.sin(t * 41.0 + 1.1);
  return base * serr;
}

function makeLeafGeometry(len, wid, foldDepth, droop, twist) {
  const NV = 34, NU = 24;
  const pos = [], uv = [], idx = [];
  for (let iv = 0; iv <= NV; iv++) {
    const s = iv / NV;
    const wp = widthProfile(s);
    const halfW = 0.5 * wid * wp;
    const tw = twist * s;
    const ctw = Math.cos(tw), stw = Math.sin(tw);
    for (let iu = 0; iu <= NU; iu++) {
      const t = (iu / NU) * 2 - 1;
      const x0 = t * halfW;
      const y = s * len;
      const fold = foldDepth * Math.pow(Math.abs(t), 1.5) * halfW * 2.0;
      const bend = -droop * Math.pow(s, 2.0) * len;
      const ripple = 0.0045 * len * Math.sin(s * 11.0 + t * 2.4) * wp;
      const z = fold + bend + ripple;
      const xr = x0 * ctw - z * stw;
      const zr = x0 * stw + z * ctw;
      pos.push(xr, y, zr);
      uv.push((t + 1) / 2, s);
    }
  }
  for (let iv = 0; iv < NV; iv++) {
    for (let iu = 0; iu < NU; iu++) {
      const a = iv * (NU + 1) + iu;
      const b = a + 1;
      const c2 = a + NU + 1;
      const d = c2 + 1;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ---------- 材质 ---------- */
const leafTex = new THREE.CanvasTexture(makeLeafTexture());
leafTex.encoding = THREE.sRGBEncoding;
leafTex.anisotropy = 8;

const leafBumpTex = new THREE.CanvasTexture(makeLeafBump());

const stemTex = new THREE.CanvasTexture(makeStemTexture());
stemTex.encoding = THREE.sRGBEncoding;
stemTex.wrapS = stemTex.wrapT = THREE.RepeatWrapping;
stemTex.repeat.set(1.2, 2.4);

const plant = new THREE.Group();
world.add(plant);

const organGroups = {
  leaf: new THREE.Group(),
  stem: new THREE.Group(),
  root: new THREE.Group()
};
plant.add(organGroups.leaf, organGroups.stem, organGroups.root);

const leafRecords = [];
const respireRecords = [];

/* 叶片透光：逆光下叶子是一片死黑剪影，掠射角边缘补一点自发光，
   成本只有一个 pow()，叶子立刻「有厚度」 */
const LEAF_TRANS = {
  uTransColor: { value: new THREE.Color(0x8ad98e) },
  uTransAmt: { value: 0.018 }
};

function withLeafGlow(mat) {
  mat.onBeforeCompile = function (shader) {
    shader.uniforms.uTransColor = LEAF_TRANS.uTransColor;
    shader.uniforms.uTransAmt = LEAF_TRANS.uTransAmt;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform vec3 uTransColor;\nuniform float uTransAmt;')
      .replace('#include <dithering_fragment>', [
        '#include <dithering_fragment>',
        '{',
        '  vec3 vdir = normalize(vViewPosition);',
        '  float edge = 1.0 - clamp(abs(dot(normalize(normal), vdir)), 0.0, 1.0);',
        '  float rim = pow(edge, 2.4);',
        '  gl_FragColor.rgb += uTransColor * uTransAmt * rim * diffuseColor.rgb * 2.2;',
        '}'
      ].join('\n'));
  };
  mat.customProgramCacheKey = function () { return 'leafGlow'; };
  return mat;
}

/* --- 花盆（不属于任何器官，点不到） --- */
(function buildPot() {
  const potMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0f2, transparent: true, opacity: 0.14,
    roughness: 0.06, metalness: 0, side: THREE.DoubleSide,
    depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.06
  });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.33, 0.52, 60, 1, true), potMat);
  pot.position.y = 0.26;
  plant.add(pot);

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x8fa8bf, transparent: true, opacity: 0.72,
    roughness: 0.2, metalness: 0.25, side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.009, 8, 60), rimMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.52;
  plant.add(ring);

  const base = new THREE.Mesh(
    new THREE.CircleGeometry(0.332, 48),
    new THREE.MeshStandardMaterial({ color: 0xb9cee2, roughness: 0.5, metalness: 0.05 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.016;
  base.receiveShadow = true;
  plant.add(base);

  const soilC = document.createElement('canvas');
  soilC.width = soilC.height = 256;
  const sg = soilC.getContext('2d');
  sg.fillStyle = '#5d4630';
  sg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = RNG() * 256, y = RNG() * 256;
    sg.fillStyle = RNG() > 0.5
      ? 'rgba(126,98,66,' + (0.18 + RNG() * 0.5).toFixed(2) + ')'
      : 'rgba(46,32,20,' + (0.18 + RNG() * 0.5).toFixed(2) + ')';
    sg.fillRect(x, y, 1 + RNG() * 3, 1 + RNG() * 3);
  }
  const soilTex = new THREE.CanvasTexture(soilC);
  soilTex.encoding = THREE.sRGBEncoding;
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.405, 0.405, 0.08, 52),
    new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1, metalness: 0 })
  );
  soil.position.y = 0.485;
  soil.receiveShadow = true;
  plant.add(soil);
})();

/* --- 根系 --- */
const rootMat = new THREE.MeshStandardMaterial({
  color: 0x6b4a28, roughness: 0.92, metalness: 0,
  transparent: true, opacity: 0.92,
  emissive: new THREE.Color(0xff9a4d), emissiveIntensity: 0
});
(function buildRoots() {
  const NROOT = 11;
  for (let i = 0; i < NROOT; i++) {
    const a = (i / NROOT) * Math.PI * 2 + 0.25;
    const spread = 0.09 + RNG() * 0.22;
    const pts = [];
    const depth = 0.28 + RNG() * 0.16;
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const r = spread * t;
      pts.push(new THREE.Vector3(
        Math.cos(a + t * 0.9) * r,
        0.475 - depth * t * (0.7 + RNG() * 0.3),
        Math.sin(a + t * 0.9) * r
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const root = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.0125 - i * 0.0005, 6, false), rootMat);
    organGroups.root.add(root);
    respireRecords.push({ type: 'root', organ: 'root', obj: organGroups.root, local: pts[2].clone() });
  }
})();

/* --- 主茎 --- */
const STEM = { y0: 0.49, h: 2.12 };
const stemMat = new THREE.MeshStandardMaterial({
  map: stemTex, roughness: 0.74, metalness: 0.02, color: 0xdceccb,
  emissive: new THREE.Color(0x9ad06a), emissiveIntensity: 0
});

function stemOffset(y) {
  const t = clamp((y - STEM.y0) / STEM.h, 0, 1);
  return { x: 0.105 * Math.pow(t, 1.65), z: -0.062 * Math.pow(t, 1.65) };
}

(function buildStem() {
  const H = STEM.h;
  const geo = new THREE.CylinderGeometry(0.021, 0.056, H, 20, 48, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = clamp((y + H / 2) / H, 0, 1);
    const bendX = 0.105 * Math.pow(t, 1.65);
    const bendZ = -0.062 * Math.pow(t, 1.65);
    const wob = 0.010 * Math.sin(t * 8.0) * t;
    p.setXYZ(i, x + bendX + wob, y, z + bendZ);
  }
  geo.computeVertexNormals();
  const stem = new THREE.Mesh(geo, stemMat);
  stem.position.y = STEM.y0 + H / 2;
  stem.castShadow = true;
  stem.receiveShadow = true;
  organGroups.stem.add(stem);

  const nodeMat = new THREE.MeshStandardMaterial({
    color: 0x6f9b4e, roughness: 0.8,
    emissive: new THREE.Color(0x9ad06a), emissiveIntensity: 0
  });
  for (let k = 0; k < 9; k++) {
    const t = 0.06 + k * 0.105;
    const y = STEM.y0 + H * t;
    const off = stemOffset(y);
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), nodeMat);
    node.scale.set(1, 0.55, 1);
    node.position.set(off.x, y, off.z);
    organGroups.stem.add(node);
  }

  for (let k = 0; k < 5; k++) {
    const t = 0.12 + k * 0.18;
    const y = STEM.y0 + H * t;
    const off = stemOffset(y);
    respireRecords.push({
      type: 'stem', organ: 'stem', obj: organGroups.stem,
      local: new THREE.Vector3(off.x, y, off.z)
    });
  }
})();

/* --- 叶片 --- */
function addLeaf(pivotPos, azimuth, tilt, len, wid, seed) {
  const pivot = new THREE.Group();
  pivot.position.copy(pivotPos);
  pivot.rotation.y = azimuth;
  organGroups.leaf.add(pivot);

  const pet = 0.09 + RNG() * 0.08;
  const petiole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0082, pet, 6, 1),
    new THREE.MeshStandardMaterial({ color: 0x5a8a3c, roughness: 0.8 })
  );
  petiole.position.y = pet / 2;
  petiole.castShadow = true;
  pivot.add(petiole);

  const leafPivot = new THREE.Group();
  leafPivot.position.y = pet;
  leafPivot.rotation.x = -tilt;
  leafPivot.rotation.z = (RNG() - 0.5) * 0.30;
  pivot.add(leafPivot);

  const geo = makeLeafGeometry(len, wid, 0.15, 0.26, (RNG() - 0.5) * 0.5);
  const mat = withLeafGlow(new THREE.MeshStandardMaterial({
    map: leafTex,
    bumpMap: leafBumpTex,
    bumpScale: 0.018,
    roughness: 0.46 + RNG() * 0.14,
    metalness: 0.0,
    side: THREE.DoubleSide,
    color: new THREE.Color().setHSL(
      0.250 + (RNG() - 0.5) * 0.022,
      0.40 + RNG() * 0.16,
      0.60 + RNG() * 0.13
    ),
    emissive: new THREE.Color(0x2f8a4e),
    emissiveIntensity: 0.0
  }));
  const leaf = new THREE.Mesh(geo, mat);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  leafPivot.add(leaf);

  leafRecords.push({
    pivot: pivot, leafPivot: leafPivot, mesh: leaf, mat: mat,
    baseX: leafPivot.rotation.x,
    baseZ: leafPivot.rotation.z,
    phase: seed * 6.2832,
    freq: 0.5 + RNG() * 0.4,
    nodeY: pivotPos.y,
    flex: 0.55 + clamp((pivotPos.y - 0.7) / 2.0, 0, 1) * 0.85,
    len: len, wid: wid
  });
  respireRecords.push({
    type: 'leaf', organ: 'leaf', obj: leaf,
    local: new THREE.Vector3(0, len * 0.45, 0)
  });
}

(function buildBranches() {
  const BR = [
    { h: 1.02, az: 0.35, tilt: 1.02, len: 0.50 },
    { h: 1.34, az: 2.45, tilt: 0.92, len: 0.46 },
    { h: 1.62, az: 4.35, tilt: 0.86, len: 0.40 }
  ];
  const brMat = new THREE.MeshStandardMaterial({
    map: stemTex, roughness: 0.78, metalness: 0.02, color: 0xd8e8c6,
    emissive: new THREE.Color(0x9ad06a), emissiveIntensity: 0
  });

  BR.forEach(function (b) {
    const base = stemOffset(b.h);
    const baseV = new THREE.Vector3(base.x, b.h, base.z);
    const dir = new THREE.Vector3(
      Math.sin(b.tilt) * Math.cos(b.az),
      Math.cos(b.tilt),
      Math.sin(b.tilt) * Math.sin(b.az)
    );
    const mid = baseV.clone().add(dir.clone().multiplyScalar(b.len / 2));
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.020, b.len, 12, 8), brMat);
    cyl.position.copy(mid);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cyl.castShadow = true;
    organGroups.stem.add(cyl);

    for (let i = 0; i < 4; i++) {
      const d = b.len * (0.32 + i * 0.21);
      const nodeP = baseV.clone().add(dir.clone().multiplyScalar(d));
      const az = b.az + i * 1.72 + RNG() * 0.9;
      const len = 0.44 + RNG() * 0.18 - i * 0.02;
      addLeaf(nodeP, az, 0.86 + RNG() * 0.62, len, len * 0.60, RNG());
    }
  });

  const NL = 9;
  const golden = 2.39996;
  for (let i = 0; i < NL; i++) {
    const t = i / (NL - 1);
    const y = 0.72 + t * 1.74;
    const off = stemOffset(y);
    const len = 0.38 + (1 - t) * 0.24 + RNG() * 0.12;
    addLeaf(new THREE.Vector3(off.x, y, off.z), i * golden + 0.6 + RNG() * 0.5,
      0.88 + (1 - t) * 0.46 + RNG() * 0.34,
      len, len * 0.60, RNG());
  }

  const top = stemOffset(STEM.y0 + STEM.h - 0.02);
  for (let i = 0; i < 2; i++) {
    addLeaf(new THREE.Vector3(top.x, STEM.y0 + STEM.h - 0.03, top.z),
      1.2 + i * 2.6, 0.55 + i * 0.2, 0.24, 0.14, RNG());
  }

  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xf5f2e2, roughness: 0.6, metalness: 0, side: THREE.DoubleSide
  });
  for (let f = 0; f < 2; f++) {
    const off2 = stemOffset(1.55 + f * 0.30);
    const flower = new THREE.Group();
    flower.position.set(off2.x + (f ? 0.10 : -0.09), 1.55 + f * 0.30, off2.z + (f ? 0.06 : -0.05));
    flower.rotation.set(-0.6 + f * 0.5, f * 1.6, 0.25);
    for (let k = 0; k < 5; k++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.030, 8, 6), petalMat);
      petal.scale.set(1, 1.75, 0.26);
      const a = (k / 5) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.030, Math.sin(a) * 0.030, 0.010);
      petal.rotation.z = a;
      petal.castShadow = true;
      flower.add(petal);
    }
    flower.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe6c356, roughness: 0.6 })
    ));
    plant.add(flower);
  }
})();

/* 三个器官注册为可拾取对象 */
regPick(organGroups.leaf, 'leaf');
regPick(organGroups.stem, 'stem');
regPick(organGroups.root, 'root');

/* --- 叶面取点（粒子发射用） --- */
function sampleLeafPoint(rec, out) {
  const s = 0.10 + Math.random() * 0.82;
  const t = (Math.random() * 2 - 1) * 0.9;
  const wp = widthProfile(s);
  const halfW = 0.5 * rec.wid * wp;
  out.set(t * halfW, s * rec.len, 0.15 * Math.pow(Math.abs(t), 1.5) * halfW * 2.0);
  rec.mesh.localToWorld(out);
  return out;
}

/* --- 风场：包络（全局）+ 相位波（沿株高）+ 方向投影（每片叶） --- */
const WIND = {
  dir: 0.72, calm: 0.016, gust: 0.034, speed: 0.40, wave: 2.3, flutter: 0.0055
};
let windGust = 0;

function windEnvelope(time) {
  const a = Math.sin(time * WIND.speed);
  const b = Math.sin(time * WIND.speed * 2.17 + 1.31);
  return clamp(a * 0.62 + b * 0.38, -1, 1);
}

/* 器官高亮：0 = 无，1 = 满。叶片的每帧自发光在下面叠加。 */
const FOCUS = { organ: null, amt: 0 };

function glowOrgan(id, amt) {
  const a = clamp(amt, 0, 1);
  rootMat.emissiveIntensity = (id === 'root') ? a * 0.55 : 0;
  stemMat.emissiveIntensity = (id === 'stem') ? a * 0.30 : 0;
  FOCUS.organ = id;
  FOCUS.amt = a;
  rootGlow.intensity = (id === 'root') ? 0.20 + a * 0.55 : 0;
}

/* --- 每帧 --- */
function updatePlant(dt, time, grossNorm) {
  windGust = windEnvelope(time);
  const amp = WIND.calm + WIND.gust * (0.5 + 0.5 * windGust);
  const leafBoost = (FOCUS.organ === 'leaf') ? FOCUS.amt * 0.20 : 0;

  for (let i = 0; i < leafRecords.length; i++) {
    const r = leafRecords[i];
    const ang = WIND.dir + r.pivot.rotation.y;
    const cw = Math.cos(ang);
    const sw = Math.sin(ang);
    const ph = time * WIND.wave - r.nodeY * 2.35;
    const bend = Math.sin(ph) * amp * r.flex;

    r.leafPivot.rotation.z = r.baseZ - cw * bend;
    r.leafPivot.rotation.x = r.baseX - sw * bend * 0.5
      + Math.sin(ph * 1.9 + r.phase) * WIND.flutter * r.flex;

    r.mat.emissiveIntensity = 0.010 + grossNorm * 0.072 + leafBoost;
  }

  LEAF_TRANS.uTransAmt.value = 0.016 + grossNorm * 0.020;
}
