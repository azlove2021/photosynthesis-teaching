/* =========================================================
   15 · 合成管线（浅色教学主题）
   线性场景 → 中性色调曲线 → 显示域调色 → 冷边收口 → sRGB

   为什么不再是 ACES + 泛光：
   ACES 会把线性 1.0 映射到 0.8 左右，纯白底板会被压成灰，
   整套"白+蓝"的教学底色立刻发脏；
   而加法泛光在白底上没有"更亮"可去，只会把边缘糊成一团雾。
   所以浅色主题走中性肩部曲线（0.86 以下严格线性，保住底板纯白），
   泛光默认关闭，需要时用 ?bloom=0.2 单独打开。
   ========================================================= */
'use strict';

/* ---------------------------------------------------------
   视觉参数：按感知角色分组（曝光 / 光晕 / 色调 / 氛围）
   --------------------------------------------------------- */
const LOOK = {
  /* 曝光。浅色主题下曝光恒定，不再做暗态补偿——
     暗态本身要靠"光柱消失 + 读数"表达，不靠把画面压黑 */
  exposure: 1.00,
  adaptDark: 1.00,
  adaptUp: 1.9,
  adaptDown: 0.55,

  /* 泛光：白底上默认关闭 */
  bloomOn: false,
  bloomThreshold: 1.30,
  bloomKnee: 0.50,
  bloomStrength: 0.16,
  bloomRadius: 1.0,
  bloomLevels: 3,

  /* 色调曲线：'neutral' 保白，'aces' 仅作对照 */
  tonemap: 'neutral',
  tmShoulder: 0.855,   /* 这条线以下严格线性，正好是底板的线性值 */

  /* 调色 */
  gradeOn: true,
  contrast: 1.045,
  saturation: 1.10,
  lift: [0.0, 0.0, 0.0],
  gain: [1.0, 1.0, 1.0],

  /* 氛围：白底不做暗角，改成向浅蓝"收边"，像纸张边缘 */
  vignette: 0.42,
  edge: [0.815, 0.868, 0.930],

  /* 诊断：0 正常 / 1 仅泛光 / 2 无后期基线 / 3 亮度阈值 */
  debug: 0
};

/* 手动解析查询串（file:// 下不依赖 URLSearchParams） */
(function readURLLook() {
  let q = '';
  try { q = String(location.search || '').replace(/^\?/, ''); } catch (e) { q = ''; }
  if (!q) return;
  const kv = {};
  q.split('&').forEach(function (pair) {
    const i = pair.indexOf('=');
    if (i > 0) kv[pair.slice(0, i)] = pair.slice(i + 1);
  });
  if (kv.post === '0') { LOOK.bloomOn = false; LOOK.gradeOn = false; }
  if (kv.bloom === '0') LOOK.bloomOn = false;
  if (kv.bloom) { LOOK.bloomOn = true; LOOK.bloomStrength = parseFloat(kv.bloom); }
  if (kv.exp) LOOK.exposure = parseFloat(kv.exp);
  if (kv.vig) LOOK.vignette = parseFloat(kv.vig);
  if (kv.tm === 'aces') LOOK.tonemap = 'aces';
  if (kv.debug) LOOK.debug = parseInt(kv.debug, 10) || 0;
})();

/* ---------------------------------------------------------
   渲染目标
   --------------------------------------------------------- */
const POST = {
  rtScene: null,
  lv0a: null, lv0b: null,   /* 1/2 */
  lv1a: null, lv1b: null,   /* 1/4 */
  lv2a: null, lv2b: null,   /* 1/8 */
  w: 2, h: 2,
  hw: 2, hh: 2, qw: 2, qh: 2, ew: 2, eh: 2,
  exposure: LOOK.exposure,
  bloomLevel: 0
};

const IS_GL2 = renderer.capabilities.isWebGL2;

function makeRT(w, h, withDepth) {
  const opts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: !!withDepth,
    stencilBuffer: false
  };
  if (withDepth && IS_GL2) opts.samples = 4;   /* 半浮点 + MSAA 抗锯齿 */
  return new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), opts);
}

POST.rtScene = makeRT(2, 2, true);
POST.lv0a = makeRT(2, 2, false);
POST.lv0b = makeRT(2, 2, false);
POST.lv1a = makeRT(2, 2, false);
POST.lv1b = makeRT(2, 2, false);
POST.lv2a = makeRT(2, 2, false);
POST.lv2b = makeRT(2, 2, false);

/* ---------------------------------------------------------
   全屏 pass 基础设施
   --------------------------------------------------------- */
const FS_VERT = [
  'varying vec2 vUv;',
  'void main() {',
  '  vUv = uv;',
  '  gl_Position = vec4(position.xy, 0.0, 1.0);',
  '}'
].join('\n');

const fsScene = new THREE.Scene();
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
fsQuad.frustumCulled = false;
fsScene.add(fsQuad);

function renderQuad(mat, target) {
  fsQuad.material = mat;
  renderer.setRenderTarget(target);
  renderer.render(fsScene, fsCam);
}

function passMat(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    blending: THREE.NoBlending
  });
}

/* ---- 亮部提取：软膝（soft knee）----
   硬阈值会让泛光边缘出现一圈突兀的切断；软膝把阈值附近
   平滑过渡，光晕才有自然的外扩感。 */
const brightMat = passMat([
  'uniform sampler2D tSrc;',
  'uniform float uThresh;',
  'uniform float uKnee;',
  'varying vec2 vUv;',
  'void main() {',
  '  vec3 c = texture2D(tSrc, vUv).rgb;',
  '  float br = max(c.r, max(c.g, c.b));',
  '  float knee = uThresh * uKnee + 1e-4;',
  '  float soft = clamp(br - uThresh + knee, 0.0, 2.0 * knee);',
  '  soft = soft * soft / (4.0 * knee + 1e-4);',
  '  float w = max(soft, br - uThresh) / max(br, 1e-4);',
  '  gl_FragColor = vec4(max(c * w, vec3(0.0)), 1.0);',
  '}'
].join('\n'), {
  tSrc: { value: null },
  uThresh: { value: LOOK.bloomThreshold },
  uKnee: { value: LOOK.bloomKnee }
});

/* ---- 分离高斯：5 抽头，等效 9 抽头权重 ---- */
const blurMat = passMat([
  'uniform sampler2D tSrc;',
  'uniform vec2 uDir;',
  'varying vec2 vUv;',
  'void main() {',
  '  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;',
  '  c += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;',
  '  c += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;',
  '  c += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;',
  '  c += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;',
  '  gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n'), {
  tSrc: { value: null },
  uDir: { value: new THREE.Vector2(0, 0) }
});

/* ---- 合成：泛光 + 曝光 + 色调曲线 + 调色 + 冷边 + sRGB ---- */
const finalMat = passMat([
  'uniform sampler2D tScene;',
  'uniform sampler2D tB0;',
  'uniform sampler2D tB1;',
  'uniform sampler2D tB2;',
  'uniform float uExposure;',
  'uniform float uBloom;',
  'uniform float uContrast;',
  'uniform float uSat;',
  'uniform float uVig;',
  'uniform float uGrade;',
  'uniform float uDebug;',
  'uniform float uTM;',
  'uniform float uShoulder;',
  'uniform vec3 uLift;',
  'uniform vec3 uGain;',
  'uniform vec3 uEdge;',
  'uniform vec3 uW;',
  'varying vec2 vUv;',

  /* 中性曲线：肩部以下严格线性，所以底板的白就是白；
     肩部以上用指数衰减滚到 1.0，高光仍有层次，不会硬切。 */
  'vec3 toneNeutral(vec3 c) {',
  '  c = max(c, vec3(0.0));',
  '  float s = uShoulder;',
  '  vec3 over = max(c - s, vec3(0.0));',
  '  return min(c, vec3(s)) + (1.0 - s) * (1.0 - exp(-over / (1.0 - s)));',
  '}',

  /* three.js 同款 ACES 拟合（RRT+ODT）。浅色主题下仅作对照，
     ?tm=aces 可切回，用来判断"是不是曲线把画面压灰了"。 */
  'vec3 rrtOdt(vec3 v) {',
  '  vec3 a = v * (v + 0.0245786) - 0.000090537;',
  '  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;',
  '  return a / b;',
  '}',
  'vec3 aces(vec3 c) {',
  '  mat3 IN = mat3(',
  '    0.59719, 0.07600, 0.02840,',
  '    0.35458, 0.90834, 0.13383,',
  '    0.04823, 0.01566, 0.83777);',
  '  mat3 OUT = mat3(',
  '     1.60475, -0.10208, -0.00327,',
  '    -0.53108,  1.10813, -0.07276,',
  '    -0.07367, -0.00605,  1.07602);',
  '  c = IN * c;',
  '  c = rrtOdt(c);',
  '  c = OUT * c;',
  '  return clamp(c, 0.0, 1.0);',
  '}',
  'vec3 tonemap(vec3 c) {',
  '  return uTM > 0.5 ? aces(c) : toneNeutral(c);',
  '}',
  'vec3 toSRGB(vec3 c) {',
  '  c = clamp(c, 0.0, 1.0);',
  '  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;',
  '  return mix(c * 12.92, hi, step(vec3(0.0031308), c));',
  '}',

  'void main() {',
  '  vec3 c = texture2D(tScene, vUv).rgb;',

  '  if (uBloom > 0.0) {',
  '    vec3 bl = (texture2D(tB0, vUv).rgb * uW.x',
  '             + texture2D(tB1, vUv).rgb * uW.y',
  '             + texture2D(tB2, vUv).rgb * uW.z) / max(0.0001, uW.x + uW.y + uW.z);',
  '    c += bl * uBloom;',
  '  }',

  /* 诊断：只看泛光 */
  '  if (uDebug > 0.5 && uDebug < 1.5) {',
  '    gl_FragColor = vec4(toSRGB(tonemap(texture2D(tB0, vUv).rgb * 4.0)), 1.0);',
  '    return;',
  '  }',
  /* 诊断：无后期基线（无泛光、无调色），用来确认画面本身立得住 */
  '  if (uDebug > 1.5 && uDebug < 2.5) {',
  '    gl_FragColor = vec4(toSRGB(tonemap(texture2D(tScene, vUv).rgb * uExposure)), 1.0);',
  '    return;',
  '  }',
  /* 诊断：亮度分区，红=过曝（>1），蓝=正常 */
  '  if (uDebug > 2.5) {',
  '    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
  '    vec3 m = l > 1.0 ? vec3(1.0, 0.22, 0.10) : vec3(0.10, 0.30, 0.85);',
  '    gl_FragColor = vec4(m * clamp(l * 0.9, 0.10, 1.0), 1.0);',
  '    return;',
  '  }',

  '  c = tonemap(c * uExposure);',

  /* 调色在显示域进行，顺序固定：lift/gain → 对比 → 饱和 */
  '  c = c * uGain + uLift * (1.0 - c);',
  '  c = (c - 0.5) * mix(1.0, uContrast, uGrade) + 0.5;',
  '  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));',
  '  c = mix(vec3(luma), c, mix(1.0, uSat, uGrade));',

  /* 冷边收口：白底不能暗角（会脏），改成向浅蓝过渡，
     视觉上像一张纸的四边，画面反而更"整"。 */
  '  float vg = pow(clamp(length(vUv - vec2(0.5)) * 1.32, 0.0, 1.0), 2.5);',
  '  c = mix(c, uEdge, vg * uVig);',

  '  gl_FragColor = vec4(toSRGB(c), 1.0);',
  '}'
].join('\n'), {
  tScene: { value: null },
  tB0: { value: null },
  tB1: { value: null },
  tB2: { value: null },
  uExposure: { value: LOOK.exposure },
  uBloom: { value: LOOK.bloomOn ? LOOK.bloomStrength : 0 },
  uContrast: { value: LOOK.contrast },
  uSat: { value: LOOK.saturation },
  uVig: { value: LOOK.vignette },
  uGrade: { value: LOOK.gradeOn ? 1 : 0 },
  uDebug: { value: LOOK.debug },
  uTM: { value: LOOK.tonemap === 'aces' ? 1 : 0 },
  uShoulder: { value: LOOK.tmShoulder },
  uLift: { value: new THREE.Vector3(LOOK.lift[0], LOOK.lift[1], LOOK.lift[2]) },
  uGain: { value: new THREE.Vector3(LOOK.gain[0], LOOK.gain[1], LOOK.gain[2]) },
  uEdge: { value: new THREE.Vector3(LOOK.edge[0], LOOK.edge[1], LOOK.edge[2]) },
  uW: { value: new THREE.Vector3(0.50, 0.32, 0.18) }
});

/* ---------------------------------------------------------
   尺寸
   --------------------------------------------------------- */
function resizePost() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const w = Math.max(4, Math.floor(size.x));
  const h = Math.max(4, Math.floor(size.y));
  if (w === POST.w && h === POST.h) return;

  POST.w = w; POST.h = h;
  POST.hw = Math.max(2, w >> 1); POST.hh = Math.max(2, h >> 1);
  POST.qw = Math.max(2, w >> 2); POST.qh = Math.max(2, h >> 2);
  POST.ew = Math.max(2, w >> 3); POST.eh = Math.max(2, h >> 3);

  POST.rtScene.setSize(w, h);
  POST.lv0a.setSize(POST.hw, POST.hh);
  POST.lv0b.setSize(POST.hw, POST.hh);
  POST.lv1a.setSize(POST.qw, POST.qh);
  POST.lv1b.setSize(POST.qw, POST.qh);
  POST.lv2a.setSize(POST.ew, POST.eh);
  POST.lv2b.setSize(POST.ew, POST.eh);
}

/* ---------------------------------------------------------
   性能分级
   教室里的机器从独显台式到核显笔记本都有。开局统计前 90 帧的
   平均帧时，超过阈值就降一档：像素比压到 1.0、泛光少一级。
   这是一条有依据的降级路径，不是"卡了就少画点"。
   --------------------------------------------------------- */
const PERF = { acc: 0, n: 0, done: false, tier: 0 };

function updateQuality(dt) {
  if (PERF.done) return;
  if (!isFinite(dt) || dt <= 0 || dt > 0.25) return;   /* 切后台/首帧不计入 */
  PERF.acc += dt;
  PERF.n++;
  if (PERF.n < 90) return;

  PERF.done = true;
  const avg = PERF.acc / PERF.n;
  if (avg > 0.026) {
    PERF.tier = 1;
    LOOK.bloomLevels = 2;
    if (renderer.getPixelRatio() > 1.0) {
      renderer.setPixelRatio(1.0);
      if (typeof resize === 'function') resize();
    }
  }
}

/* ---------------------------------------------------------
   一次完整出图
   --------------------------------------------------------- */
function blurPass(src, dst, dirX, dirY, srcW, srcH) {
  blurMat.uniforms.tSrc.value = src.texture;
  const r = LOOK.bloomRadius;
  blurMat.uniforms.uDir.value.set((dirX * r) / srcW, (dirY * r) / srcH);
  renderQuad(blurMat, dst);
}

function renderScene(dt) {
  updateQuality(dt);

  /* 1 · 场景 → 线性缓冲 */
  renderer.setRenderTarget(POST.rtScene);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  /* 2 · 曝光：浅色主题恒定为 1.0（adaptDark = 1.0 时不产生偏移），
     保留阻尼是为了让 ?exp= 调试时不会突变 */
  const lightNorm = clamp(State.I / PHYS.iMax, 0, 1);
  const target = LOOK.exposure * (1 + (LOOK.adaptDark - 1) * (1 - lightNorm));
  const rate = target > POST.exposure ? LOOK.adaptUp : LOOK.adaptDown;
  POST.exposure = damp(POST.exposure, target, rate, Math.max(1e-4, dt || 0.016));

  if (LOOK.bloomOn) {
    brightMat.uniforms.tSrc.value = POST.rtScene.texture;
    brightMat.uniforms.uThresh.value = LOOK.bloomThreshold;
    brightMat.uniforms.uKnee.value = LOOK.bloomKnee;
    renderQuad(brightMat, POST.lv0a);

    /* 1/2：横竖各一次 */
    blurPass(POST.lv0a, POST.lv0b, 1, 0, POST.hw, POST.hh);
    blurPass(POST.lv0b, POST.lv0a, 0, 1, POST.hw, POST.hh);

    /* 1/4：从 1/2 降采样，顺便把大范围光晕铺开 */
    blurPass(POST.lv0a, POST.lv1a, 1, 0, POST.hw, POST.hh);
    blurPass(POST.lv1a, POST.lv1b, 0, 1, POST.qw, POST.qh);

    /* 1/8：最外层那圈很淡的辉光（性能分级为 2 级时跳过，
       权重同时由 uW.z 归零，能量重新分配到前两级） */
    if (LOOK.bloomLevels >= 3) {
      blurPass(POST.lv1b, POST.lv2a, 1, 0, POST.qw, POST.qh);
      blurPass(POST.lv2a, POST.lv2b, 0, 1, POST.ew, POST.eh);
    }

    POST.bloomLevel = LOOK.bloomLevels;
  }

  /* 3 · 合成到屏幕 */
  finalMat.uniforms.tScene.value = POST.rtScene.texture;
  finalMat.uniforms.tB0.value = POST.lv0a.texture;
  finalMat.uniforms.tB1.value = POST.lv1b.texture;
  finalMat.uniforms.tB2.value = POST.lv2b.texture;
  finalMat.uniforms.uExposure.value = POST.exposure;
  finalMat.uniforms.uBloom.value = LOOK.bloomOn ? LOOK.bloomStrength : 0;
  finalMat.uniforms.uContrast.value = LOOK.contrast;
  finalMat.uniforms.uSat.value = LOOK.saturation;
  finalMat.uniforms.uVig.value = LOOK.vignette;
  finalMat.uniforms.uEdge.value.set(LOOK.edge[0], LOOK.edge[1], LOOK.edge[2]);
  finalMat.uniforms.uTM.value = LOOK.tonemap === 'aces' ? 1 : 0;
  finalMat.uniforms.uShoulder.value = LOOK.tmShoulder;
  finalMat.uniforms.uGrade.value = LOOK.gradeOn ? 1 : 0;
  finalMat.uniforms.uDebug.value = LOOK.debug;
  const lv = LOOK.bloomOn ? LOOK.bloomLevels : 3;
  finalMat.uniforms.uW.value.set(0.50, 0.32, lv >= 3 ? 0.18 : 0.0);
  renderQuad(finalMat, null);
}

/* 供诊断与截图脚本读取 */
window.__look = LOOK;
window.__post = POST;
