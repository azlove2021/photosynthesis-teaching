/**
 * 单一数据源生成器。
 *
 *   node tools/gen-data.mjs
 *
 * 产出：
 *   courseware-data.json   —— 构建时内联进 HTML 的 <script id="courseware-data">
 *   README-table.md        —— README 的数量自检表（与上面同源，不可能不一致）
 *
 * 规则：所有速率一律由 tools/model.mjs 现算，本文件里不写任何一个结果数字。
 * 步骤里的 preset 是输入，rate 是输出。想改数值就改 preset 或 model，别改结果。
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PHYS, ORGANS, WHOLE_LABEL,
  ratesAt, organRates, compPoint, satPoint, pmaxAt
} from './model.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const r2 = v => Math.round(v * 100) / 100;
/* 显示用数字：真减号 U+2212，-0.00 归一成 0.00 */
const sn = v => {
  const t = r2(v);
  const s = (Object.is(t, -0) ? 0 : t).toFixed(2);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
};
const r0 = v => Math.round(v);

const TEXTBOOK = '必修1 第5章第3、4节';
const SCOPE = '以单株计 μmol·s⁻¹·株⁻¹';
const RATE_UNIT = 'μmol·s⁻¹·株⁻¹';

/* ---- 先算特征光强，后面步骤要用 ---- */
const P0 = { I: 0, T: 25, C: 400, O: 21 };
const COMP = compPoint(25, 400, 21);
const SAT = satPoint(25, 400, 21);
const I_COMP = Math.round(COMP);
const I_SAT = Math.ceil(SAT * 1.08);

/* ---- 九步：只写输入(preset)与文案，不写结果 ---- */
const STAGES = [
  {
    id: 'device',
    name: '① 认识同化箱',
    short: '装置',
    group: '装置与量纲',
    summary: '同化箱只能记到净值',
    preset: { I: 800, T: 25, C: 400, O: 21 },
    question: '这两只表测的是什么？为什么要装在箱子里？',
    action: '拖动旋转看箱体，滚轮推近两只探头',
    expect: '两只探头贴壁朝内，一只测 CO₂、一只测 O₂；箱内数值随植株状态变化',
    conclusion: '同化箱是一本封闭的账，只能记到净值——箱内 CO₂ 的变化率',
    point: '密闭容器中 CO₂ 下降速率 = 净光合速率',
    exam: '为什么不能把箱内 CO₂ 的下降直接当作光合速率',
    warning: '把净值当总值：箱里的变化是光合与呼吸相抵之后剩下的那一点。',
    narration: '先看装置。这是一个密闭的同化箱，左边探头的数字是箱内的二氧化碳浓度，右边是氧气浓度。箱子封起来，外面的空气进不来，里面的变化就只可能来自这株植物。请转一转视角，看看两只探头是不是都朝着箱内。',
    visualState: 'chamber-wide',
    cam: { theta: 0.30, phi: 1.300, r: 7.40, ty: 1.55 },
    highlight: []
  },
  {
    id: 'dark',
    name: '② 黑暗：净值先变负',
    short: '黑暗',
    group: '净值登场',
    summary: '呼吸不依赖光，昼夜不停',
    preset: { I: 0, T: 25, C: 400, O: 21 },
    question: '熄灯以后，箱里的 CO₂ 还在变吗？',
    action: '点右栏「黑暗」预设，把光强拖到 0',
    expect: '总光合 0.0，呼吸不为 0，净光合为负；箱内 CO₂ 上升、O₂ 下降；只剩橙红的呼吸粒子在动',
    conclusion: '呼吸不依赖光，日夜不停；黑暗中测到的就是呼吸速率',
    point: '黑暗下 CO₂ 释放速率 = 呼吸速率',
    exam: '为什么黑暗中测到的正好是呼吸速率',
    warning: '「晚上才呼吸」是错的：白天也在呼吸，只是被光合盖住了。',
    narration: '现在把灯关掉。注意看，绿色的光合粒子消失了，橙红色的呼吸粒子还在源源不断往外冒——根、茎、叶，全株都在呼吸。箱里的二氧化碳开始上升，读数变成负的。这个负值，就是呼吸速率。',
    visualState: 'dark-resp-only',
    cam: { theta: 0.30, phi: 1.300, r: 6.40, ty: 1.45 },
    highlight: []
  },
  {
    id: 'weak',
    name: '③ 弱光：三股流同时出现',
    short: '弱光',
    group: '净值登场',
    summary: '光合与呼吸同时进行',
    /* 必须落在补偿点(≈43)以下，否则「净值仍为负」这个结论不成立。
       30 对应净光合约 −0.7，是能看出「有光合但抵不过呼吸」的最小可信光强。 */
    preset: { I: 30, T: 25, C: 400, O: 21 },
    question: '给一点光，为什么箱内 CO₂ 还在升？',
    action: '把光强拖到约 30，停在补偿点左边',
    expect: '三条流同时出现；总光合仍小于呼吸，净值还是负的',
    conclusion: '光合与呼吸同时进行，净值是两者相抵的结果',
    point: '有光就有光合，但净光合仍可能为负',
    exam: '弱光下植物是否在进行光合作用',
    warning: '「有光就一定净积累」是错的：补偿点之前，光合吃掉的还抵不过呼吸放出的。',
    narration: '先给一点点光，只到三十。看，绿色的粒子回来了，但它比橙红色的少得多——光合确实在进行，只是还抵不过呼吸。所以箱里的二氧化碳仍在缓慢上升，净值仍然是负的。记住这句话：光合和呼吸是同时发生的，净值只是它们相减的结果。',
    visualState: 'weak-both-streams',
    cam: { theta: 0.10, phi: 1.280, r: 6.00, ty: 1.45 },
    highlight: []
  },
  {
    id: 'comp',
    name: '④ 光补偿点：净流归零',
    short: '补偿点',
    group: '曲线成形',
    summary: '总光合恰好抵消呼吸',
    preset: { I: I_COMP, T: 25, C: 400, O: 21 },
    question: '光强加到多少，箱内 CO₂ 恰好不再变？',
    action: '把光强拖到净流指示条归零，看曲线穿过零轴',
    expect: '净光合降到 0 附近，总光合与呼吸相等；曲线与零轴的交点被标红',
    conclusion: '光补偿点 = 总光合恰好抵消呼吸的光强',
    point: '补偿点时光合仍在进行，只是净积累为零',
    exam: '光补偿点时叶肉细胞是否还在进行光合作用',
    warning: '补偿点不等于光合停止：那一瞬间光合和呼吸都在跑，只是刚好相等。',
    narration: '继续加光，注意看曲线。当它穿过零轴的那一瞬间，箱里的二氧化碳不再变化了——这一点的光强，叫光补偿点。这时候总光合和呼吸刚好相等。但请记住，相等不等于停止，两边都还在跑得飞快。',
    visualState: 'compensation-point',
    cam: { theta: -0.20, phi: 1.340, r: 7.00, ty: 1.45 },
    highlight: []
  },
  {
    id: 'sat',
    name: '⑤ 光饱和点：限制因子换人',
    short: '饱和点',
    group: '曲线成形',
    summary: '光不再是限制因子',
    preset: { I: I_SAT, T: 25, C: 400, O: 21 },
    question: '继续加光，为什么曲线不再涨了？',
    action: '把光强推过饱和点（约 950）',
    expect: '曲线趋平，饱和点被标绿；再加光读数几乎不动',
    conclusion: '饱和之后光不再是限制因子，接棒的是 CO₂ 浓度、温度和酶的量',
    point: '限制因子的转移',
    exam: '光饱和后继续增强光照，光合速率为什么不再提高',
    warning: '光合速率不会随光强无限增长，饱和之后是别的因素在卡着。',
    narration: '再往上加光，曲线几乎不动了。这一点叫光饱和点。为什么？因为光已经不是瓶颈了，真正卡住速度的是二氧化碳浓度、温度和酶的数量。理解这一条，你就理解了限制因子会换人。',
    visualState: 'saturation-point',
    cam: { theta: -0.20, phi: 1.340, r: 7.00, ty: 1.45 },
    highlight: []
  },
  {
    id: 'temp',
    name: '⑥ 温度：只动呼吸的那只手',
    short: '温度',
    group: '变量与限制',
    summary: '呼吸近似按 Q₁₀ 翻倍',
    preset: { I: 800, T: 35, C: 400, O: 21 },
    question: '只升温，为什么呼吸涨得比总光合快？',
    action: '在 15 / 25 / 35 ℃ 三档之间切换',
    expect: '呼吸近乎按 Q₁₀≈2 翻倍；总光合在 28 ℃ 附近达峰后回落；补偿点整体右移',
    conclusion: '呼吸是纯粹的酶促反应；光合受多因子共同限制，高温下酶失活与光呼吸同时加重',
    point: '净光合的最适温度低于总光合的最适温度',
    exam: '为什么净光合的最适温度往往低于光合酶的最适温度',
    warning: '别把「净光合最适温度」当成「光合酶最适温度」：呼吸也在随温度上涨，把净值往下拽。',
    narration: '现在温度调到三十五度。看呼吸，它几乎翻了一倍，因为呼吸就是一个纯粹的酶促反应，温度每升十度速率乘二。光合也会涨一点，但很快就回落——高温下酶开始失活。所以净光合的最适温度，比光合的最适温度要低。',
    visualState: 'temperature-shift',
    cam: { theta: 0.55, phi: 1.240, r: 5.80, ty: 1.40 },
    highlight: []
  },
  {
    id: 'co2',
    name: '⑦ CO₂ 与 O₂：方向相反',
    short: 'CO₂·O₂',
    group: '变量与限制',
    summary: '底物与竞争者',
    preset: { I: 800, T: 25, C: 1000, O: 21 },
    question: '加 CO₂ 和加 O₂，为什么读数朝相反方向走？',
    action: '先把 CO₂ 拖到 1000，再把 O₂ 从 21% 拖到 30%',
    expect: 'CO₂ 升高抬总光合并逐渐饱和；O₂ 升高压低总光合',
    conclusion: 'CO₂ 是底物；O₂ 与 CO₂ 争同一个酶位点，O₂ 高则光呼吸强',
    point: '光呼吸使总光合的表观速率下降',
    exam: '为什么温室大棚里提高 CO₂ 能增产，而 O₂ 浓度升高反而抑制光合',
    warning: 'O₂ 不只跟呼吸有关：它还是光合的抑制剂。',
    narration: '二氧化碳提到一千，总光合明显上涨，但涨到一定程度又平了，因为它也饱和。现在把氧气从二十一拖到三十，看读数反向掉下来。氧气会和二氧化碳抢同一个酶的位点，抢赢了就走光呼吸，白白消耗能量。',
    visualState: 'co2-o2-opposed',
    cam: { theta: 0.55, phi: 1.240, r: 5.80, ty: 1.40 },
    highlight: []
  },
  {
    id: 'organ',
    name: '⑧ 整株 ≠ 叶片',
    short: '整株·叶片',
    group: '口径辨析',
    summary: '绿色器官才有总光合',
    preset: { I: 800, T: 25, C: 400, O: 21 },
    question: '点一片叶和点一条根，读数为什么不一样？',
    action: '用白手套光标点叶片，再点根部，最后看右栏整株汇总',
    expect: '叶片卡有总光合；根卡总光合为 0、净光合为负；两张卡相加正好等于右栏整株',
    conclusion: '绿色器官才有总光合；非绿色器官只呼吸；整株净光合等于各器官净光合之和',
    point: '整株净光合小于叶片净光合，因为要扣掉茎与根的呼吸',
    exam: '同一植株的「叶片净光合速率」与「整株净光合速率」为什么不同',
    warning: '这是高考最常见的失分点：题目说「植株」时不能用叶片的值，反之亦然。',
    narration: '这一步必须动手。用鼠标去点一片叶子，卡片上总光合是正的；再点一条根，总光合直接是零，净光合是负的——根不光合，只呼吸。把两张卡加起来，正好等于右栏那个整株的数。整株净光合永远小于叶片净光合，差的那部分就是茎和根吃掉的。',
    visualState: 'organ-compare',
    /* 这一步要看清叶/茎/根，机位比其他步近；但 5.20 会把箱体上沿切出画外，
       看着像场景缺了一块，退到 5.85、视点抬到 1.42 兼顾「整株」与器官可点。 */
    cam: { theta: 0.35, phi: 1.300, r: 5.85, ty: 1.42 },
    highlight: ['leaf', 'stem', 'root']
  },
  {
    id: 'quiz',
    name: '⑨ 考核',
    short: '考核',
    group: '闭环',
    summary: '三道题回到主线问题',
    preset: { I: 800, T: 25, C: 400, O: 21 },
    question: '回到最初的问题：那两只表，测的到底是哪一项？',
    action: '完成三道选择题，答错会给解析',
    expect: '得分出现在顶栏',
    conclusion: '表只测得到净值；总光合必须用净值加上呼吸才能推出来',
    point: '净光合可测，总光合需推算',
    exam: '给出任意一组净光合与呼吸数据，求总光合',
    warning: '答题时先确认口径：是叶片还是整株。',
    narration: '最后三道题。请先看清每一题问的是叶片还是整株——这决定了你要不要扣掉根和茎的呼吸。',
    visualState: 'quiz',
    cam: { theta: 0.34, phi: 1.280, r: 6.40, ty: 1.45 },
    highlight: []
  }
];

/* ---- 把输入算成结果 ---- */
const stages = STAGES.map((st, i) => {
  const s = st.preset;
  const rate = ratesAt(s);
  const pmax = pmaxAt(s.T, s.C, s.O);
  /* 补偿点这一步：预设光强是把真实补偿点取整得到的，
     所以读数不会是恰好 0。把差额写进「应该看到」，别让标题和读数打架。 */
  let expect = st.expect;
  if (st.id === 'comp' && Math.abs(r2(rate.net)) > 0) {
    expect = `净光合降到 0 附近（取整到 ${s.I} 还剩 ${sn(rate.net)}；精确点 ${COMP.toFixed(2)}）；`
      + '总光合与呼吸相等；交点被标红';
  }
  return {
    idx: i,
    id: st.id,
    name: st.name,
    short: st.short,
    group: st.group,
    summary: st.summary,
    question: st.question,
    action: st.action,
    expect,
    conclusion: st.conclusion,
    point: st.point,
    exam: st.exam,
    warning: st.warning,
    narration: st.narration,
    events: [st.summary, expect, st.conclusion].slice(0, 3),
    rate: { gross: r2(rate.gross), resp: r2(rate.resp), net: r2(rate.net) },
    pmax: r2(pmax),
    /* 四类指标：九步的 key 集合必须完全一致，否则自检脚本判为不一致。
       value 是数字，unit 只是给人看的，不参与比对。 */
    metrics: [
      { key: 'gross', label: '总光合', value: r2(rate.gross), unit: RATE_UNIT },
      { key: 'resp', label: '呼吸', value: r2(rate.resp), unit: RATE_UNIT },
      { key: 'net', label: '净光合', value: r2(rate.net), unit: RATE_UNIT },
      { key: 'pmax', label: 'Pmax', value: r2(pmax), unit: RATE_UNIT }
    ],
    scope: SCOPE,
    source: TEXTBOOK,
    visualState: st.visualState,
    preset: s,
    cam: st.cam,
    highlight: st.highlight,
    /* 第⑧步额外附器官级读数，供卡片直接取用 */
    organs: st.id === 'organ'
      ? Object.fromEntries(
          Object.keys(ORGANS).map(k => {
            const o = organRates(s, k);
            return [k, { gross: r2(o.gross), resp: r2(o.resp), net: r2(o.net) }];
          })
        )
      : undefined
  };
});

/* 器官读数在非第⑧步也要能算（卡片是任意步都能点的），所以单独存一份基准 */
const organBase = Object.fromEntries(
  Object.keys(ORGANS).map(k => [k, ORGANS[k]])
);

const DATA = {
  meta: {
    title: '光合作用与呼吸作用 · 总光合与净光合',
    subtitle: '一株植物上的三个量：净值可测，总值只能推',
    textbook: '人教版 2019',
    chapter: '必修1 第5章第3、4节',
    type: 'process',
    mainQuestion: '同化箱里那两只表，到底测到的是哪一项？为什么总光合不能直接测？',
    unit: { light: 'μmol·m⁻²·s⁻¹', rate: 'μmol·s⁻¹·株⁻¹' },
    scope: SCOPE,
    simplifications: [
      '植株、箱体、细胞器均为示意，非真实比例',
      '速率为课件设定值，以单株计，不是实测数据',
      '颜色仅用于区分物质来源与器官，不代表真实光谱或浓度',
      '光呼吸与叶片内部结构简化为单一系数，只表达「O₂ 升高抑制总光合」这一趋势',
      '器官呼吸占比 0.78 / 0.07 / 0.15 为设定值，用于让「各器官净光合之和 = 整株净光合」严格闭合'
    ]
  },
  model: PHYS,
  organs: organBase,
  wholeLabel: WHOLE_LABEL,
  chips: [
    { key: 'light', name: '光能驱动', note: '光强决定能捕获多少能量' },
    { key: 'fix', name: '叶片固碳', note: '只有绿色器官在固定 CO₂' },
    { key: 'resp', name: '全株呼吸', note: '根茎叶昼夜不停释放 CO₂' },
    { key: 'cancel', name: '相抵成净值', note: '箱内变化是两者之差' },
    { key: 'infer', name: '总光合只能推', note: '净 + 呼吸 = 总光合' }
  ],
  marks: {
    comp: r0(COMP),
    sat: r0(SAT),
    compExact: r2(COMP),
    satExact: r2(SAT)
  },
  presets: {
    dark: { I: 0, T: 25, C: 400, O: 21 },
    weak: { I: 30, T: 25, C: 400, O: 21 },
    comp: { I: I_COMP, T: 25, C: 400, O: 21 },
    sat: { I: I_SAT, T: 25, C: 400, O: 21 },
    normal: { I: 800, T: 25, C: 400, O: 21 }
  },
  stages,
  quiz: [
    {
      q: '密闭容器中，光照条件下 CO₂ 浓度下降的速率表示什么？',
      options: ['总光合速率', '净光合速率', '呼吸速率', '光呼吸速率'],
      answer: 1,
      why: '箱内 CO₂ 的下降是光合吸收与呼吸释放相抵之后的结果，所以它只能表示净光合速率。'
    },
    {
      q: '光补偿点时，叶肉细胞内的真实情况是：',
      options: ['光合已经停止', '光合速率大于呼吸速率', '光合速率等于呼吸速率，且两者都不为零', '光合速率等于零而呼吸正常'],
      answer: 2,
      why: '补偿点是两条曲线相交那一点，光合与呼吸都在进行，速率正好相等，所以净积累为零。'
    },
    {
      q: '同一植株，叶片净光合为 21.5、整株净光合为 21.0，差值主要来自：',
      options: ['根与茎的呼吸消耗', '叶片的光呼吸', '箱体的漏气', '测量的偶然误差'],
      answer: 0,
      why: '根和茎不含叶绿体，只进行呼吸不进行光合，因此整株净值要在叶片净值的基础上再扣掉它们的呼吸。'
    }
  ]
};

/* ---- 把模型本身也发给浏览器 ----
   model.mjs 是唯一真相。这里去掉 ESM 的 export 语法，生成浏览器可用的
   经典脚本 src/10-model.js，避免在 HTML 里再手抄一份公式。 */
mkdirSync(join(ROOT, 'src'), { recursive: true });
const modelSrc = readFileSync(join(ROOT, 'tools', 'model.mjs'), 'utf8');
const modelJs = [
  '/* 自动生成，勿改。源文件：tools/model.mjs */',
  modelSrc
    .replace(/^export\s+\{[^}]*\};\s*$/gm, '')   // 去掉结尾的批量导出
    .replace(/^export\s+/gm, '')                  // 去掉逐条 export 前缀
    .trimEnd()
].join('\n') + '\n';
writeFileSync(join(ROOT, 'src', '10-model.js'), modelJs, 'utf8');

/* ---- 写出 ---- */
writeFileSync(join(ROOT, 'courseware-data.json'), JSON.stringify(DATA, null, 2) + '\n', 'utf8');

const rows = stages.map(s => {
  const p = s.preset;
  /* 保留一位小数时会冒出 "-0.0"，读起来像负值，压成 0.0 */
  const f1 = v => (Math.abs(v) < 0.05 ? '0.0' : v.toFixed(1));
  return `| ${s.idx + 1} | ${s.short} | ${p.I} | ${p.T} | ${p.C} | ${p.O}% | ${s.rate.gross.toFixed(1)} | ${s.rate.resp.toFixed(2)} | ${f1(s.rate.net)} | ${s.scope} | ${s.source} |`;
});
const table = [
  '| # | 步骤 | 光强 | 温度 | CO₂ | O₂ | 总光合 | 呼吸 | 净光合 | 统计口径 | 教材依据 |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  `光补偿点 ≈ ${r0(COMP)} μmol·m⁻²·s⁻¹；光饱和点 ≈ ${r0(SAT)} μmol·m⁻²·s⁻¹（25 ℃、400 ppm、21% O₂）。`,
  ''
].join('\n');
writeFileSync(join(ROOT, 'README-table.md'), table, 'utf8');

/* ---- 控制台自检 ---- */
const o = DATA.stages.find(s => s.id === 'organ').organs;
const sumNet = o.leaf.net + o.stem.net + o.root.net;
const sumResp = o.leaf.resp + o.stem.resp + o.root.resp;
const whole = DATA.stages.find(s => s.id === 'organ').rate;
console.log('生成完毕');
console.log('  光补偿点 =', r0(COMP), ' 光饱和点 =', r0(SAT));
console.log('  器官净光合之和 =', sumNet.toFixed(2), ' 整株净光合 =', whole.net.toFixed(2),
  Math.abs(sumNet - whole.net) < 0.02 ? '✔ 闭合' : '✘ 不闭合');
console.log('  器官呼吸之和   =', sumResp.toFixed(2), ' 整株呼吸   =', whole.resp.toFixed(2),
  Math.abs(sumResp - whole.resp) < 0.002 ? '✔ 闭合' : '✘ 不闭合');
console.log('  阶段数 =', stages.length, ' 考核题 =', DATA.quiz.length);
