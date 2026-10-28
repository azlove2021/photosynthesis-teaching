# -*- coding: utf-8 -*-
"""生成《光合作用与呼吸作用——总光合与净光合》高三复习课教学设计 .docx"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'teaching-design.docx')

INK = RGBColor(0x1a, 0x1a, 0x1a)
ACCENT = RGBColor(0x1f, 0x6e, 0x52)
GRAY = RGBColor(0x5f, 0x5f, 0x5f)
RED = RGBColor(0xa3, 0x2d, 0x2d)

doc = Document()

# ---------- 页面 ----------
sec = doc.sections[0]
sec.page_width = Cm(21.0)
sec.page_height = Cm(29.7)
sec.top_margin = Cm(2.2)
sec.bottom_margin = Cm(2.2)
sec.left_margin = Cm(2.4)
sec.right_margin = Cm(2.4)

# ---------- 基础样式 ----------
st = doc.styles['Normal']
st.font.name = 'Times New Roman'
st.font.size = Pt(10.5)
st.font.color.rgb = INK
st.element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
pf = st.paragraph_format
pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
pf.space_before = Pt(0)
pf.space_after = Pt(4)


def cnfont(run, name='宋体'):
    run.font.name = 'Times New Roman'
    run._element.rPr.rFonts.set(qn('w:eastAsia'), name)


def para(text='', size=10.5, bold=False, color=None, align=None,
         first_indent=True, space_after=4, space_before=0, line=1.5, font='宋体'):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    p.paragraph_format.first_line_indent = Cm(0.74) if first_indent else Cm(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = line
    if text:
        add_rich(p, text, size=size, bold=bold, color=color, font=font)
    return p


def add_rich(p, text, size=10.5, bold=False, color=None, font='宋体'):
    """支持 **粗体** 与 `代码` 两种行内标记"""
    i = 0
    while i < len(text):
        if text.startswith('**', i):
            j = text.find('**', i + 2)
            if j < 0:
                j = len(text) - 2
            r = p.add_run(text[i + 2:j])
            r.bold = True
            r.font.size = Pt(size)
            if color:
                r.font.color.rgb = color
            cnfont(r, font)
            i = j + 2
        elif text.startswith('`', i):
            j = text.find('`', i + 1)
            if j < 0:
                j = len(text) - 1
            r = p.add_run(text[i + 1:j])
            r.font.name = 'Consolas'
            r._element.rPr.rFonts.set(qn('w:eastAsia'), 'Consolas')
            r.font.size = Pt(size - 0.5)
            r.font.color.rgb = ACCENT
            i = j + 1
        else:
            nxt = len(text)
            for mark in ('**', '`'):
                k = text.find(mark, i)
                if k >= 0:
                    nxt = min(nxt, k)
            r = p.add_run(text[i:nxt])
            r.bold = bold
            r.font.size = Pt(size)
            if color:
                r.font.color.rgb = color
            cnfont(r, font)
            i = nxt


def h1(text, num=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(7)
    p.paragraph_format.keep_with_next = True
    r = p.add_run((num + '  ' if num else '') + text)
    r.bold = True
    r.font.size = Pt(14)
    r.font.color.rgb = ACCENT
    cnfont(r, '黑体')
    # 下边框
    pPr = p._p.get_or_add_pPr()
    pbdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '3')
    bottom.set(qn('w:color'), '1F6E52')
    pbdr.append(bottom)
    pPr.append(pbdr)
    return p


def h2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(11.5)
    cnfont(r, '黑体')
    return p


def bullet(text, size=10.5):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.74)
    p.paragraph_format.first_line_indent = Cm(-0.37)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.5
    r = p.add_run('· ')
    r.font.size = Pt(size)
    cnfont(r)
    add_rich(p, text, size=size)
    return p


def quote(text):
    """课堂提问脚本样式"""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.9)
    p.paragraph_format.right_indent = Cm(0.5)
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.45
    pPr = p._p.get_or_add_pPr()
    pbdr = OxmlElement('w:pBdr')
    left = OxmlElement('w:left')
    left.set(qn('w:val'), 'single')
    left.set(qn('w:sz'), '18')
    left.set(qn('w:space'), '8')
    left.set(qn('w:color'), 'B9D8CC')
    pbdr.append(left)
    pPr.append(pbdr)
    add_rich(p, text, size=10, color=RGBColor(0x2a, 0x2a, 0x2a))
    return p


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear')
    sh.set(qn('w:color'), 'auto')
    sh.set(qn('w:fill'), hexcolor)
    tcPr.append(sh)


def cell_text(cell, text, bold=False, size=9.5, color=None, align=None):
    cell.text = ''
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.line_spacing = 1.25
    if align is not None:
        p.alignment = align
    add_rich(p, text, size=size, bold=bold, color=color, font='宋体')


def fix_table_layout(t, widths):
    """强制固定列宽（Word 需要 tblLayout=fixed + tblGrid 的 gridCol 宽度），并禁止行跨页断开"""
    tbl = t._tbl
    tblPr = tbl.tblPr
    layout = OxmlElement('w:tblLayout')
    layout.set(qn('w:type'), 'fixed')
    tblPr.append(layout)
    tblW = OxmlElement('w:tblW')
    tblW.set(qn('w:type'), 'dxa')
    tblW.set(qn('w:w'), str(int(sum(widths) * 567)))
    tblPr.append(tblW)
    grid = tbl.find(qn('w:tblGrid'))
    if grid is not None:
        for gc, w in zip(grid.findall(qn('w:gridCol')), widths):
            gc.set(qn('w:w'), str(int(w * 567)))
    for row in t.rows:
        trPr = row._tr.get_or_add_trPr()
        cs = OxmlElement('w:cantSplit')
        trPr.append(cs)
    for i, w in enumerate(widths):
        for c in t.columns[i].cells:
            c.width = Cm(w)


def table(headers, rows, widths, head_fill='1F6E52', zebra='F2F7F4'):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    hdr = t.rows[0]
    for i, h in enumerate(headers):
        shade(hdr.cells[i], head_fill)
        cell_text(hdr.cells[i], h, bold=True, size=9.5,
                  color=RGBColor(0xff, 0xff, 0xff),
                  align=WD_ALIGN_PARAGRAPH.CENTER)
    trPr = hdr._tr.get_or_add_trPr()
    th = OxmlElement('w:tblHeader')
    th.set(qn('w:val'), 'true')
    trPr.append(th)
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, val in enumerate(row):
            if ri % 2 == 1:
                shade(cells[i], zebra)
            cell_text(cells[i], val, size=9.5)
    fix_table_layout(t, widths)
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(2)
    sp.paragraph_format.line_spacing = 1.0
    return t


def add_page_number_footer():
    footer = sec.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('')
    fld1 = OxmlElement('w:fldChar'); fld1.set(qn('w:fldCharType'), 'begin')
    instr = OxmlElement('w:instrText'); instr.set(qn('xml:space'), 'preserve')
    instr.text = ' PAGE '
    fld2 = OxmlElement('w:fldChar'); fld2.set(qn('w:fldCharType'), 'end')
    r._r.append(fld1); r._r.append(instr); r._r.append(fld2)
    r.font.size = Pt(9)
    r.font.color.rgb = GRAY


add_page_number_footer()
# 封面不显示页码
try:
    sec.different_first_page_header_footer = True
except Exception:
    pass

# ================= 封面 =================
for _ in range(3):
    doc.add_paragraph()

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(6)
r = p.add_run('光合作用与呼吸作用')
r.bold = True; r.font.size = Pt(28); r.font.color.rgb = ACCENT
cnfont(r, '黑体')

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(20)
r = p.add_run('总光合与净光合的交互式教学')
r.bold = True; r.font.size = Pt(17); r.font.color.rgb = INK
cnfont(r, '黑体')

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(4)
r = p.add_run('Teaching Design for Gross & Net Photosynthesis')
r.font.size = Pt(10.5); r.font.color.rgb = GRAY
r.italic = True

for _ in range(4):
    doc.add_paragraph()

t = doc.add_table(rows=0, cols=2)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
info = [
    ('课　　题', '光合作用与呼吸作用：总光合、呼吸与净光合'),
    ('课　　型', '高三一轮复习课 · 概念建构 + 图像分析'),
    ('课　　时', '1 课时（45 min）'),
    ('教材依据', '人教版《生物学·必修1·分子与细胞》第 5 章'),
    ('配套课件', 'photosynthesis-teaching.html（离线单文件，双击即开）'),
    ('设计主线', '拖光强 → 三量实时变化 → 曲线由实测点长出来 → 迁移与测定'),
    ('核心理念', '净光合是"被测量出来的量"，总光合是"推算出来的量"'),
    ('文档版本', '省级公开课版 · 含课堂评价量表、学生学案与应急方案'),
]
for k, v in info:
    row = t.add_row().cells
    cell_text(row[0], k, bold=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    shade(row[0], 'EDF5F1')
    cell_text(row[1], v, size=10)
fix_table_layout(t, [3.6, 11.6])

for _ in range(5):
    doc.add_paragraph()

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('本教案共 16 个课堂问题，与课件中的 Q1—Q16 逐题对应；')
r.font.size = Pt(9.5); r.font.color.rgb = GRAY
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('课件内按 ← → 即可切换问题，无须记题号。')
r.font.size = Pt(9.5); r.font.color.rgb = GRAY

doc.add_page_break()

# ================= 一、基本信息 =================
h1('课前一页速览', '一')

para('这一页给听课教师与评委看：这节课到底解决什么问题、凭什么这样解决、'
     '在哪一刻能看见学生真的懂了。翻过这一页才是详细教案。')

h2('1.1　一节课只解决一件事')
para('学生真正的困难不是"不知道光合作用有净值和总值之分"，而是**默认自己看到的读数就是光合作⽤本身**。'
     '因此本课的靶心只有一句话：**传感器能测到的永远是净值，总光合必须由净值加回呼吸才能得到。**'
     '全课 16 个问题全部围绕这一句展开，不旁生枝节。')

h2('1.2　三个可观测的"懂了的证据"')
table(['时刻', '可观测证据', '对应问题'],
      [['上课约 10 min', '学生能自己说出"黑暗里那个负号，量的就是呼吸"', 'Q4—Q5'],
       ['上课约 28 min', '学生能在曲线上指出"净光合为 0"的那一点，并解释箱子为什么没变化', 'Q7—Q8'],
       ['上课约 40 min', '学生面对陌生情境题时，先追问"这个净光合是叶片的还是整株的"', 'Q15—Q16']],
      [3.4, 9.2, 2.6])

h2('1.3　技术只做三件事')
bullet('**把看不见的变可见**：物质流、呼吸的持续性、箱内浓度变化，原本都是抽象的。')
bullet('**把测不到的可操作**：学生可以真的"测"出一组数据点，看着曲线被自己测出来。')
bullet('**把不可逆的变可回退**：任何一步拨乱了，按空格即回到教材标准状态，课堂不会失控。')

# ================= 二、设计理念 =================
h1('设计理念', '二')

h2('2.1　从"讲结论"到"逼出结论"')
para('常规上法是先给公式：总光合 = 净光合 + 呼吸，再举例、再练习。这条路径的问题在于——'
     '公式一旦提前给出，后面所有现象都变成了"验证已知"，学生的思维强度会立刻降到最低。'
     '本课把公式**藏到最后**：先用黑暗态逼出负值，再用补偿点逼出"零"，'
     '最后让学生自己发现"要得到总光合，只能把呼吸加回去"。')

h2('2.2　一条主线：让曲线自己长出来')
para('整节课只有一个视觉主对象——一株植物在密闭同化箱里。'
     '教师每一次拖动光强，植物体表的物质流、箱内两个传感器的读数、右侧的曲线、'
     '底部的三量对账同时响应。**学生看到的不是四个割裂的图表，而是同一件事的四个侧面。**')

h2('2.3　一条暗线：谁在被测量，谁在被推算')
para('这条暗线决定了本课的方法论高度。课堂上反复出现的追问是"这个数字是怎么来的"：'
     '净光合来自传感器（可测），呼吸来自黑暗态（可测），总光合只能相加（推算）。'
     '当学生能对任何一个数字说清它的来源，这节课的方法论目标就达成了。')

# ================= 三、教材与内容分析 =================
h1('教材与内容分析', '三')

h2('3.1　本节在教材中的地位')
para('人教版必修 1 第 5 章第 4 节以光合作用的过程与影响因素为主，'
     '净光合与总光合的区分并未单独成节，却在高考试题中高频出现，'
     '且几乎总是以"隐含条件"的形式出现——题干给一个"净光合速率"，'
     '学生必须自己判断口径。因此本节复习课的价值不在补充新知识，'
     '而在于**把一个隐含的区分显性化、可操作化**。')

h2('3.2　内容结构')
para('本课把教材中分散在三处的知识收拢为一条因果链：')
table(['层次', '内容', '在本课中的落点'],
      [['事实层', '光合作用与呼吸作用的物质与能量变化', '植物体上的五条物质流'],
       ['概念层', '总光合 / 呼吸 / 净光合三量的关系', '三量对账面板与光强—速率曲线'],
       ['方法层', '净光合如何测、总光合如何算', '同化箱传感器 + 黑暗态 + 黑白瓶法'],
       ['迁移层', '题干中"净光合"的口径判断', '整株 / 叶片开关 + 情境题']],
      [2.6, 7.6, 5.0])

# ================= 四、学情分析 =================
h1('学情分析', '四')

h2('4.1　学生已有基础')
para('高三学生已完成新授课学习，能写出光合作用与呼吸作用的总反应式，'
     '能背诵光反应与暗反应的场所与产物，也做过光强—光合速率曲线的题目。'
     '也就是说，**知识本身不是障碍，障碍在于这些知识是彼此孤立的**。')

h2('4.2　四个具体的坎')
para('这四个坎不是凭经验想象的，而是在前测与作业中反复出现的四类错误。'
     '本课的每一个环节都对应其中一个坎。')
table(['坎', '学生的真实表现', '成因', '本课的应对'],
      [['坎一\n净=总',
        '"净光合 21，说明它一共制造了 21。"',
        '从未意识到自己看到的读数是"扣过账"的',
        'Q4—Q5 先给黑暗态，让净值变负，负数没法解释成"制造量"'],
       ['坎二\n白天才呼吸',
        '"白天光合强，呼吸可以忽略。"',
        '把呼吸当成只在夜间发生的独立过程',
        '呼吸粒子全株常驻、光越强也不停；Q11 拖到最亮再问一次'],
       ['坎三\n总能测得到',
        '"测出来就是真的，算出来的不算。"',
        '缺少对"可测量"与"可推算"的区分',
        'Q3 先挖坑：只给 CO₂ 减少量；Q13—Q14 再给三条测定路径'],
       ['坎四\n叶株混用',
        '"题目说净光合，那当然是叶片的。"',
        '不知道整株要额外扣掉根茎的呼吸',
        'Q15—Q16 用开关实时切换，同一时刻两个读数并置']],
      [2.4, 4.4, 3.6, 4.8])

# ================= 五、教学目标 =================
h1('教学目标（核心素养四维）', '五')

h2('5.1　生命观念')
bullet('能说明净光合是"总光合扣除呼吸后真正积累的部分"，并据此解释植物在弱光下生长受抑、'
       '在光补偿点附近干重不增不减的原因。')

h2('5.2　科学思维')
bullet('能由"黑暗态净光合为负"推出呼吸速率，再由"净值 + 呼吸 = 总值"完成演绎推理。')
bullet('能识别题干中净光合的口径（叶片／整株），并对结论作出相应修正。')

h2('5.3　科学探究')
bullet('能在同化箱情境中，通过改变单一变量（光强）记录多组数据，'
       '并在坐标图上描出净光合随光强变化的趋势。')
bullet('能评价黑白瓶法、半叶法、叶圆片上浮法三种方案的测量对象与误差来源，'
       '指出哪一步真正获得了总光合。')

h2('5.4　社会责任')
bullet('能将该模型迁移到温室补光、密闭舱室栽培等真实情境，'
       '说明补光强度为何存在经济上限。')

# ================= 六、重点难点 =================
h1('教学重点与难点', '六')

h2('6.1　教学重点')
bullet('三量关系：总光合 = 净光合 + 呼吸，且三者在同一时刻、同一口径下成立。')
bullet('光强—速率曲线的两个临界点：光补偿点（净光合为 0）与光饱和点（加光不再增益）。')

h2('6.2　教学难点')
bullet('**难点一**：理解"呼吸在全过程中持续进行且不随光强改变"，'
       '因而净光合曲线与总光合曲线之间始终存在一段恒定间距。')
bullet('**难点二**：理解"总光合无法直接测量"，只能由净值加回呼吸或由黑白瓶差值获得。')

h2('6.3　难点突破策略')
table(['难点', '突破手段', '为什么有效'],
      [['呼吸的持续性',
        '呼吸粒子在全株常驻，光强拉到 2000 仍不停；把净光合曲线与总光合曲线用同一坐标并置，中间那段间距随时间不变',
        '把"恒定差值"变成可见的、有厚度的带状区域，学生看得见"它没变"'],
       ['总光合不可测',
        '先只给箱内 CO₂ 减少量（净值），让学生自己想"制造了多少"，卡住之后再给三条路径',
        '先制造认知失衡，再提供工具，接受度远高于直接讲授'],
       ['口径混用',
        '「只看叶片 / 整株」开关实时切换，同一时刻两个读数并排',
        '把抽象的口径差异变成一个开关，差异立刻可量化']],
      [2.8, 7.6, 4.8])

# ================= 七、教学方法与媒体 =================
h1('教学方法、媒体与技术说明', '七')

h2('7.1　教法与学法')
bullet('**情境驱动**：整节课固定在一个同化箱情境中，不切换场景，降低认知负荷。')
bullet('**问题链推进**：16 个问题首尾相接，每一问的答案都是下一问的前提。')
bullet('**可视化建模**：把三量关系从文字公式变成可拖动的对象与可生长的曲线。')
bullet('**数据实证**：学生自己记录的数据点标在曲线上，结论由数据支撑而非教师断言。')

h2('7.2　为什么必须是离线单文件')
para('公开课最怕的是"课件打不开"。本课件把三维引擎一并内联进单个 HTML 文件（约 0.7 MB），'
     '**不依赖任何网络请求**：断网、校园网限速、U 盘拷贝到陌生机器、'
     '甚至从未联网的录播教室机器，双击即可运行。'
     '这不是技术炫技，而是把"现场事故概率"压到零的必要设计。')

h2('7.3　技术融合的三个层次')
table(['层次', '做法', '教学意义'],
      [['替代', '用虚拟同化箱替代真实装置', '真实实验需 30 min 且受光照条件限制，课堂无法完成'],
       ['增强', '把 CO₂ 吸收、O₂ 释放、呼吸三条流可视化', '分子层面的物质流原本不可见，学生只能背结论'],
       ['重构', '学生自记数据点生成曲线，并实时切换口径', '把"验证已知结论"重构为"由数据生成结论"，改变认知路径']],
      [2.2, 6.8, 6.2])

h2('7.4　画面语言：为什么是白 + 蓝')
para('课件的配色不是审美选择，而是三个约束条件解出来的唯一结果。', first_indent=True)
bullet('**和纸面同色系。** 讲义、板书、学生学案都是白纸黑字，'
       '屏幕若用深色底，学生在纸上记下的颜色和屏幕对不上，'
       '每次指认"蓝线是净光合"都要多绕一次转换。白底 + 蓝主色让屏幕与纸面共享同一套色彩记忆。')
bullet('**抗环境光。** 公开课教室通常只关前半段灯，屏幕上有环境光反射。'
       '深色底在偏亮的投影上会整体发灰、暗部糊成一片；'
       '浅色底即使偏亮，也只是对比度下降，结构仍然清楚。'
       '代价是"发光"这种表达手段不能再用了，所以强度改由读数承担（见下）。')
bullet('**全站只有一套语义色。** 绿＝总光合 / O₂ 释放，琥珀＝呼吸 / CO₂，'
       '蓝＝净光合 / H₂O 上行，红＝负值。粒子流、曲线图、图例、三个数字、推导 chips '
       '共用这一套色，学生只需要记一次。任何地方出现第二套色，都是认知负担。')
para('由此产生一条设计红线：**强度不能用亮度表达，必须用读数表达。**'
     '白底上"更亮"没有去处，所以舞台右上角常驻一张「实验条件」卡片，'
     '光照与温度一直显示——按 H 进入纯净投影时，所有面板都隐藏，'
     '这张卡片仍然在，学生随时知道自己看到的是哪个条件。', first_indent=True)

# ================= 八、流程总览 =================
h1('教学流程总览', '八')

table(['环节', '时间', '核心问题', '学生活动', '素养落点'],
      [['一 · 看见三条流', '8 min', 'Q1—Q3：这些点从哪来、到哪去',
        '观察并描述三条物质流；尝试只用净值反推总产值',
        '生命观念'],
       ['二 · 净光合是测出来的', '12 min', 'Q4—Q7：为什么会有负值、为什么停在零',
        '读黑暗态读数并推出呼吸；在补偿点解释"什么都测不到"',
        '科学思维'],
       ['三 · 曲线上的两个临界点', '12 min', 'Q8—Q11：补偿点会动吗、饱和后限制是谁',
        '记录 5 组数据点描曲线；切 35 ℃ 观察补偿点位移',
        '科学探究'],
       ['四 · 总光合怎么得到', '10 min', 'Q12—Q16：三种测法、整株还是叶片',
        '评价三种方案；切换口径比较读数；完成情境题',
        '科学思维\n社会责任'],
       ['小结', '3 min', '一句话说清三个量的关系',
        '口头复述并完成板书填空', '—']],
      [3.2, 1.8, 4.0, 4.2, 2.0])

para('说明：表中时间是按 45 min 设计的基准值。若课堂进度偏慢，'
     '可压缩环节四的 Q13（三种测法）为课后阅读，其余问题不可删——'
     '删掉任何一问都会使后一问失去前提。', first_indent=True, size=9.5, color=GRAY)

# ================= 九、教学过程详案 =================
h1('教学过程详案', '九')

para('以下每题按"问题 — 学生预期 — 教师行为 — 设计意图"四段呈现。'
     '课件内按 ← → 切换，题号与本节完全一致。')

# ---------- 环节一 ----------
h2('环节一　看见三条流（8 min）')
para('开场不解释概念，先让学生看。屏幕上五条颜色不同的粒子流同时运行，'
     '教师只说一句："先别管它们叫什么，告诉我你看到了什么。"',
     first_indent=True)

quote('Q1　"屏幕上这些点，是从哪儿出来的、又往哪儿去？"')
para('**学生预期**：能描述出绿色点从叶片向外飘、橙色点从外向内、'
     '蓝色点沿茎向上、金黄色点向下。少数学生会把呼吸的橙红点也算进"光合"。',
     first_indent=False)
para('**教师行为**：不纠正，顺着学生的描述把图例点开，让五条流的名字浮出来。'
     '特别指出：橙红那一组是从**所有部位**冒出来的，包括根和茎。', first_indent=False)
para('**设计意图**：先建立"多流并存"的直觉，为后面"抵消"埋下伏笔。'
     '此刻不给任何数值，避免学生过早进入计算。', first_indent=False)

quote('Q2　"这株植物此刻在光合作用，那它在呼吸吗？"')
para('**学生预期**：多数回答"在，但很弱"或"白天以光合为主"。'
     '这正是坎二——把呼吸当成可被压制的次要过程。', first_indent=False)
para('**教师行为**：把光强从 800 拉到 2000，问"现在呼吸停了吗"；'
     '再按 ↓ 键拉回 0，问"现在光合停了吗，呼吸呢"。'
     '让学生自己发现：**光合可以归零，呼吸不能**。', first_indent=False)
para('**设计意图**：用一次极值往返打破"白天不呼吸"的错误图景，'
     '且用学生自己操作的对比而不是教师陈述来完成。', first_indent=False)

quote('Q3　"如果我只告诉你箱子里 CO₂ 少了多少，你能算出它一共制造了多少有机物吗？"')
para('**学生预期**：大部分学生会直接用减少量当制造量。', first_indent=False)
para('**教师行为**：不评判，只说"先记着这个答案，下课前我们再回来看它"。'
     '把这个问题写在黑板右侧，标注"待解决"。', first_indent=False)
para('**设计意图**：**这是全课最重要的一次挖坑**。方法论缺口必须在学生自己身上产生，'
     '教师说出来就成了别人家的问题。', first_indent=False)

# ---------- 环节二 ----------
h2('环节二　净光合是测出来的（12 min）')
para('本环节是全课的认知转折点，节奏要慢，允许沉默。')

quote('Q4　"总光合为什么是 0，呼吸为什么不是 0？"')
para('（按 Q4，光强自动归零。）', first_indent=False, size=9.5, color=GRAY)
para('**学生预期**："因为没有光，光合不能进行。" 这是完整且正确的回答，教师应明确肯定。',
     first_indent=False)
para('**教师行为**：追问"那这三行数字里，哪一行还能测？"。'
     '引导学生注意到：总光合为 0，但净光合是 −2.1，而呼吸仍是 2.1。', first_indent=False)
para('**设计意图**：让"黑暗"成为一个**可用的测量条件**，而不只是一个极端状态。', first_indent=False)

quote('Q5　"净光合的 −2.1，这个负号在箱子里对应什么现象？"')
para('**学生预期**："说明植物在消耗"，"说明箱子里 CO₂ 变多了"。'
     '第二种回答更接近物理事实，应被放大。', first_indent=False)
para('**教师行为**：指左上角传感器读数——CO₂ 正在上升、O₂ 正在下降，'
     '两个箭头同向运动说明这是**同一件事的两个侧面**。'
     '然后写出：净光合 = −2.1，呼吸 = 2.1，所以总光合 = 0。', first_indent=False)
para('**设计意图**：把"负号"从数学符号翻译成实验现象。'
     '学生一旦能把负号和"箱子里的 CO₂ 在涨"对应起来，'
     '净值概念就落地了。', first_indent=False)

quote('Q6　"已经有光合了，为什么箱内 CO₂ 还在升？"')
para('（按 Q6，光强自动切到弱光区，约 24。）', first_indent=False, size=9.5, color=GRAY)
para('**学生预期**："光合太弱了"，"产生的没有消耗的多"。', first_indent=False)
para('**教师行为**：把这个回答翻译成数量关系——制造的少于消耗的，所以箱子还在涨。'
     '强调：**光合确实在进行，总光合不为零**，只是还没追上呼吸。', first_indent=False)
para('**设计意图**：卡三的核心难点。学生最容易在这里把"净光合为负"误解成"没有光合"，'
     '必须明确区分"总光合小"和"总光合为零"。', first_indent=False)

quote('Q7　"此刻植物在光合吗？在呼吸吗？那为什么箱子里的读数一动不动？"')
para('（按 Q7，光强自动跳到光补偿点，约 43。）', first_indent=False, size=9.5, color=GRAY)
para('**学生预期**：沉默，或"刚好相等"。', first_indent=False)
para('**教师行为**：等。这一步的沉默是有价值的。'
     '等到有学生说出"制造的正好等于消耗的"，再把三量对账上的"−""="'
     '指给他看：总光合 2.1，呼吸 2.1，净光合 0.0。', first_indent=False)
para('**设计意图**：**全课的高光时刻**。"什么都没发生"其实是"两件事正好抵消"，'
     '这个反直觉的结论必须由学生自己说出来。', first_indent=False)

# ---------- 环节三 ----------
h2('环节三　曲线上的两个临界点（12 min）')
para('从这一环节开始引入坐标图。**注意：曲线不是一上来就画好的**，'
     '它随着学生记录的数据点逐步长出来。')

quote('Q8　"曲线上哪一段是\'看起来什么都没发生\'的？"')
para('**学生预期**：能指向曲线与零轴的交点。', first_indent=False)
para('**教师行为**：让学生用鼠标把光强从 0 缓慢拖到 2000，'
     '观察工作点如何沿曲线移动、在何处穿过零轴。'
     '然后按 R 键记录几组数据，指出：**这些空心圆是你们自己测的**，'
     '曲线在这里不是被画出来的，是被测出来的。', first_indent=False)
para('**设计意图**：把"图像"从教师给的结论，变成学生操作产生的产物。'
     '这是本课科学探究素养的主要落点。', first_indent=False)

quote('Q9　"光补偿点会移动吗？把温度切到 35 ℃ 再看。"')
para('**学生预期**："应该不会吧，补偿点是植物的特性。"', first_indent=False)
para('**教师行为**：切到 35 ℃，补偿点从约 43 移到约 88。'
     '追问"为什么"。引导到：温度升高 → 呼吸增强 → 需要更多光才能追上。', first_indent=False)
para('**设计意图**：打破"补偿点是常数"的静态认知，'
     '把它变成"由呼吸速率决定的可变量"。这一问也顺带复习了温度对酶的影响。', first_indent=False)

quote('Q10　"为什么高光强下再加光也没用？这时候限制光合的是谁？"')
para('**学生预期**："光太多了"，"叶子受不了"。属于典型的错误归因。', first_indent=False)
para('**教师行为**：把光强拉到 2000，总光合稳定在约 23。'
     '提示："现在光不是限制因素了，那限制在哪里？"'
     '引导到暗反应、CO₂ 供应、酶数量。'
     '在探究态下把 CO₂ 从 400 拉到 1200，看曲线整体抬高——**换一个限制因素，上限就变了**。',
     first_indent=False)
para('**设计意图**：从"单一限制因素"走向"限制因素会转移"，'
     '这是高考实验题的高频考点。', first_indent=False)

quote('Q11　"把光拖到最亮，呼吸停了吗？你怎么证明？"')
para('**学生预期**："没停"，但说不出证明方式。', first_indent=False)
para('**教师行为**：这正是回扣 Q2 的地方。'
     '证明方式是——把光瞬间拉到 0，净光合立刻等于 −呼吸，'
     '而呼吸数值与刚才高温下的数值一致。**呼吸从来没有变过。**', first_indent=False)
para('**设计意图**：让"呼吸与光强无关"从一句断言变成一次可复现的验证。', first_indent=False)

# ---------- 环节四 ----------
h2('环节四　总光合怎么得到（10 min）')
para('回到开场那个坑。教师开场第一句："现在我们回来看看 Q3。"')

quote('Q12　"为什么黑暗中的净光合读数，就等于呼吸速率？"')
para('**学生预期**："因为光合是零，所以净值全是呼吸贡献的。"', first_indent=False)
para('**教师行为**：概括为一句可迁移的规则——**当其中一项为零时，净值就等于另一项**。'
     '这句话是后面所有测定方法的共同逻辑基础。', first_indent=False)
para('**设计意图**：从一个具体读数提炼出一条通用方法，为三种测法做好铺垫。', first_indent=False)

quote('Q13　"如果黑瓶和白瓶都放在光下，白瓶测到的还是净光合吗？"')
para('**学生预期**：多数会答"是"。', first_indent=False)
para('**教师行为**：拆解黑白瓶法——黑瓶只呼吸，测得呼吸；'
     '白瓶光照下测得净光合；**两者的差值才是总光合**。'
     '所以白瓶测到的从来不是总光合。', first_indent=False)
para('**设计意图**：把"零项法"从黑暗态推广到对照实验设计，'
     '完成从现象到方法的抽象。', first_indent=False)

quote('Q14　"三种方法里，哪一种真正测到了总光合？"')
para('**教师行为**：给出三条路径并逐条追问"它测的是哪一项"：', first_indent=False)
table(['方法', '直接测到的量', '如何得到总光合', '主要误差来源'],
      [['黑白瓶法', '黑瓶：呼吸；白瓶：净光合', '白 − 黑', '两瓶初始条件不完全一致'],
       ['半叶法', '对称半叶的光合产物积累量之差', '光照半叶 − 遮光半叶', '叶片左右差异、烘干损失'],
       ['叶圆片上浮法', '一定时间内上浮的叶片数', '只能反映净光合，无法得总值', '受叶片厚度与气孔差异影响']],
      [2.8, 4.6, 4.0, 3.8])
para('**结论**：**没有一种方法直接测到总光合**。三种方法的本质都是'
     '"先测出其中一项，再用差值或求和把另一项还原出来"。'
     '这句话应写在板书正中央。', first_indent=False)

quote('Q15　"同一时刻，整株的净光合比叶片低，低下去的那部分是什么？"')
para('（按 Q15 为整株，再按 Q16 自动切到只看叶片，让学生看着数字跳变。）',
     first_indent=False, size=9.5, color=GRAY)
para('**学生预期**："根和茎的呼吸"。', first_indent=False)
para('**教师行为**：切到"只看叶片"，净光合从 21.0 变为约 21.5，'
     '差值正是根茎的呼吸。强调：**根、茎、成熟果实只呼吸不光合**，'
     '所以在同一时刻，整株的净值一定更低。', first_indent=False)
para('**设计意图**：把抽象的口径差异变成一个可量化的差值。', first_indent=False)

quote('Q16　"题目里说\'某植物的净光合速率\'，你默认它指的是叶片还是整株？"')
para('**学生预期**：含糊，或答"叶片"。', first_indent=False)
para('**教师行为**：明确规则——题干未特别说明时，'
     '**"植物"通常指整株，"叶片"会单独写出**。'
     '并给出情境题：温室补光时，若按叶片净值估算产量，会系统性高估，'
     '因为忽略了根茎的持续消耗。', first_indent=False)
para('**设计意图**：把本课从概念课推向应用课。'
     '同时呼应社会责任目标——补光强度存在经济上限。', first_indent=False)

# ---------- 小结 ----------
h2('课堂小结（3 min）')
para('不重复讲，改为填空。教师写板书左栏，学生补右栏：')
quote('总光合 = ＿＿ + ＿＿　　；　　净光合为 0 的点叫 ＿＿　　；　　'
      '呼吸速率随 ＿＿ 变化，不随 ＿＿ 变化。')
para('答案依次为：净光合、呼吸、光补偿点、温度、光强。'
     '最后一句是整节课的"钉子"，应让全班齐答。', first_indent=False)

# ================= 十、板书 =================
h1('板书设计', '十')

para('板书分三栏，左栏随课推进逐步填写，中栏是全课结论，右栏是开场留下的"待解决"问题。'
     '下课时三栏刚好填满，形成完整的知识结构。', first_indent=True)

t = doc.add_table(rows=1, cols=3)
t.style = 'Table Grid'
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
cells = t.rows[0].cells
blocks = [
    ('左栏　三量与临界点',
     '① 五条流\n　　O₂ ↑　CO₂ ↓　H₂O ↑\n　　有机物 ↓　呼吸 CO₂ ↑\n\n'
     '② 三量关系\n　　总光合 23.2\n　− 呼吸　 2.1\n　= 净光合 21.0\n\n'
     '③ 两个临界点\n　　光补偿点 ≈ 43\n　　光饱和点 ≈ 943\n\n'
     '④ 呼吸只随温度变\n　　25 ℃ → 2.1\n　　35 ℃ → 4.3'),
    ('中栏　全课结论',
     '\n\n总光合\n\n　　＝\n\n净光合　＋　呼吸\n\n'
     '\n\n测不到\n\n　　↓\n\n只能还原\n\n（白 − 黑 / 光 − 暗）'),
    ('右栏　待解决 → 已解决',
     '\n\nQ3 提出的问题：\n\n"只给 CO₂ 减少量，\n能算出制造量吗？"\n\n'
     '\n　　　↓\n\n不能。\n\n必须加回呼吸，\n或用黑白瓶差值。'),
]
for i in range(3):
    c = cells[i]
    c.text = ''
    p0 = c.paragraphs[0]
    r = p0.add_run(blocks[i][0])
    r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = ACCENT
    cnfont(r, '黑体')
    p0.paragraph_format.space_after = Pt(6)
    for line in blocks[i][1].split('\n'):
        pp = c.add_paragraph()
        pp.paragraph_format.space_after = Pt(0)
        pp.paragraph_format.line_spacing = 1.15
        rr = pp.add_run(line if line else ' ')
        rr.font.size = Pt(9.5)
        cnfont(rr)
    if i == 1:
        shade(c, 'F2F7F4')
fix_table_layout(t, [5.4, 4.4, 5.4])

para('板书要点：中栏的"＝"和"＋"用红笔写，是全课视觉重心；'
     '右栏的"不能"二字最后写，写完即下课，留下最强的记忆锚点。',
     size=9.5, color=GRAY)

# ================= 十一、评价量表 =================
h1('课堂评价量表', '十一')

para('建议由听课教师或学生同桌互评使用。每项三档，以"能否独立完成"为分界。', first_indent=True)

table(['观测点', '水平一（合格）', '水平二（良好）', '水平三（优秀）'],
      [['三量关系',
        '能复述"总光合 = 净光合 + 呼吸"',
        '能在给定两个量时算出第三个',
        '能解释该关系成立的前提是同口径、同时刻'],
       ['负值的意义',
        '知道净光合可以为负',
        '能说出负值对应箱内 CO₂ 上升',
        '能由负值的绝对值直接读出呼吸速率'],
       ['呼吸的持续性',
        '知道呼吸昼夜进行',
        '能指出呼吸不随光强变化',
        '能设计一次操作来证明呼吸未被光强影响'],
       ['临界点',
        '能指出补偿点位置',
        '能解释补偿点处箱内浓度不变的原因',
        '能预测温度或 CO₂ 改变后补偿点的移动方向并说明理由'],
       ['测定方法',
        '知道有三种常用方法',
        '能说出每种方法测的是净值还是总值',
        '能比较三种方法的误差来源并选择合适方案'],
       ['口径判断',
        '知道叶片与整株不同',
        '能算出两者的差值',
        '在陌生情境中主动追问题干口径']],
      [2.4, 4.0, 4.2, 4.6])

# ================= 十二、作业 =================
h1('分层作业', '十二')

h2('12.1　基础层（全体必做，约 8 min）')
bullet('某植物在黑暗中释放 CO₂ 的速率为 2.0 μmol·m⁻²·s⁻¹，'
       '在光强 800 时吸收 CO₂ 的速率为 21.0 μmol·m⁻²·s⁻¹。'
       '求该光强下的总光合速率。')
bullet('在上题条件下，若光强降为 20 μmol·m⁻²·s⁻¹ 时净光合为 −1.0，'
       '此时总光合是多少？说明箱内 CO₂ 的变化方向。')

h2('12.2　提升层（选做，约 10 min）')
bullet('把温度由 25 ℃ 升到 35 ℃，呼吸速率翻倍。'
       '在同一坐标图上定性画出两条净光合曲线，并标出补偿点的移动方向。')
bullet('某同学说"叶圆片上浮法测到的就是总光合"，请指出其错误并给出修正方案。')

h2('12.3　拓展层（学有余力，约 15 min）')
bullet('密闭温室夜间温度由 15 ℃ 升至 20 ℃，白天补光不变。'
       '预测一昼夜后植株干重的变化方向，并用本课的三量关系加以论证。')
bullet('设计一个方案：仅用一台 CO₂ 传感器，测出某叶片在某一光强下的总光合速率。'
       '要求写明至少两个关键操作及其理由。')

# ================= 十三、反思 =================
h1('教学反思（预设）', '十三')

para('以下三点是本节最可能出问题的地方，课前应先想清楚。', first_indent=True)

h2('13.1　Q7 的沉默可能过长')
para('光补偿点这一问依赖学生自己说出"正好相等"。若班级基础较弱，'
     '沉默超过 20 秒应主动降阶：先问"箱子里的读数变了吗"，'
     '再问"那光合和呼吸谁多"，最后才问"那它们是什么关系"。'
     '**降阶不等于给答案**，这条线要守住。')

h2('13.2　技术故障的兜底')
para('课件为离线单文件，理论上不会因网络失败。若遇设备异常，'
     '应立即切换到备用方案：用板书画出三量关系与曲线，'
     '把 Q5、Q7、Q11 三个关键读数口头给出，其余环节照常推进。'
     '**这节课的核心是问题链，不是动画**——动画没了，课还在。')

h2('13.3　时间最容易超在哪')
para('环节三的 Q10（限制因素转移）容易展开过度，'
     '一旦学生追问到光呼吸、CO₂ 补偿点，就会挤占环节四。'
     '处理原则：把超出范围的问题写在"停车场"（黑板右上角），'
     '课后答复，不在课上展开。')

# ================= 附录 A =================
doc.add_page_break()
h1('附录 A　数值模型与量级说明', 'A')

para('课件中的数值由一组显式参数生成，取"形态正确、量级合理、趋势符合教材"，'
     '不追求实验精度。教师若被学生追问具体数字，可按下面说明回答。')

h2('A.1　总光合：直角双曲线')
para('Pg = [ αI + Pmax − √( (αI + Pmax)² − 4θαI·Pmax ) ] / (2θ)', first_indent=False, font='Consolas')
bullet('α = 0.050（初始斜率，反映弱光利用效率）')
bullet('θ = 0.90（曲线凸度，越接近 1 越"折角"）')
bullet('Pmax = 27 × f(T) × f(C) × f(O)，其中温度取 28 ℃ 为最适的高斯响应，'
       'CO₂ 取米氏型（K_m ≈ 340 ppm），O₂ 升高促进光呼吸、每升高 1% 约降 0.6%')

h2('A.2　呼吸：Q₁₀ = 2')
para('Rd = 2.15 × 2^((T−25)/10)', first_indent=False, font='Consolas')
bullet('只随温度变化，与光强无关——这正是本课反复强调的那一点')
bullet('整株系数 1.00，仅叶片系数 0.78（根茎占比约 22%）')

h2('A.3　典型工况数值')
table(['工况', '光强', '总光合', '呼吸', '净光合', '备注'],
      [['黑暗', '0', '0.0', '2.1', '−2.1', '暗读数 = 呼吸'],
       ['弱光', '24', '1.0', '2.1', '−1.1', '箱子仍在升 CO₂'],
       ['光补偿点', '≈ 43', '2.1', '2.1', '0.0', '读数不变'],
       ['教材标准态', '800', '23.2', '2.1', '21.0', '本课基准'],
       ['光饱和', '≈ 943', '23.0', '2.1', '20.9', '加光不再增益'],
       ['35 ℃ 补偿点', '≈ 88', '4.3', '4.3', '0.0', '呼吸翻倍，补偿点上移']],
      [2.6, 1.8, 2.0, 1.8, 2.0, 5.0])

para('单位统一为 μmol CO₂·m⁻²·s⁻¹。表中数值与课件读数一致，可直接用于命题。',
     size=9.5, color=GRAY)

# ================= 附录 B =================
h1('附录 B　学生高频错误与应对', 'B')

table(['错误说法', '错在哪', '一句话应对'],
      [['"净光合就是光合作用强度"', '把净值当总值，忽略了已扣掉的呼吸', '"你测到的是扣过账的，账本上还有一笔在支出"'],
       ['"白天不呼吸"', '把呼吸当成可被光抑制的独立过程', '"把光关掉，呼吸数值变了吗"'],
       ['"弱光下没有光合"', '把净值为负等同于总值为零', '"总光合不为零，只是还没追上呼吸"'],
       ['"补偿点处植物不活动"', '把净值为零误解为过程停止', '"两件事正好抵消，不是都没发生"'],
       ['"叶圆片上浮测得总光合"', '混淆净光合与总光合', '"上浮是净值，要用黑白瓶差值才有总值"'],
       ['"题目没说就是叶片"', '口径默认错误', '"题干写\'植物\'就是整株，写\'叶片\'才是叶片"']],
      [4.8, 5.2, 5.2])

# ================= 附录 C =================
h1('附录 C　操作速查与课堂应急', 'C')

h2('C.1　键位速查')
table(['按键', '作用', '课堂上什么时候用'],
      [['← →', '上一题 / 下一题（Q1—Q16）', '按教案推进，等同于翻页'],
       ['↑ ↓', '调光强；按住 Shift 走大步', '讲课时不必去够滑杆'],
       ['R', '记录此刻读数', '环节三让学生自己采点'],
       ['H', '纯净模式，隐藏全部面板', '只想让学生看植株时'],
       ['F', '全屏', '课前准备'],
       ['空格', '回到教材标准状态（800、25 ℃、400 ppm、21% O₂）', '任何一步拨乱了就按它'],
       ['双击画面', '视角复位', '学生把视角转乱之后']],
      [2.2, 7.4, 5.6])

h2('C.2　三种应急方案')
para('**方案一：三维画面卡顿。** 按 H 进入纯净模式可降低负载；'
     '若仍卡顿，说明机器性能不足，改走方案二。', first_indent=False)
para('**方案二：完全无法运行。** 打开讲义附录 A 的数值表，用板书画曲线，'
     'Q5、Q7、Q11 的关键读数直接口述。问题链不受影响。', first_indent=False)
para('**方案三：投影偏亮或偏白。** 课件是白 + 蓝的浅色版式，'
     '投影亮度过高时整屏层次会被压平。建议把投影调到"演示 / 标准"模式（对比度略高、亮度适中），'
     '避免强侧光直射屏幕；正午反光严重时可拉上前排半扇窗帘。'
     '不要自行把页面改成深色——浅色底是为了让屏幕、讲义、板书三者色一致，'
     '改了之后学生在纸上记的颜色就和屏幕对不上了。', first_indent=False)

# ================= 附录 D =================
doc.add_page_break()
h1('附录 D　学生学案（可裁下发放）', 'D')

para('以下内容可直接打印发放。建议双面印，正面为任务，背面为本课结论区。',
     size=9.5, color=GRAY)

h2('D.1　课堂任务单')
table(['题号', '任务', '我的记录'],
      [['Q1', '写出你看到的物质流及其方向（至少三条）', ''],
       ['Q4', '黑暗时三个读数分别是多少？据此求出呼吸速率', '总 ___　呼吸 ___　净 ___'],
       ['Q6', '弱光时箱内 CO₂ 为什么还在升高？', ''],
       ['Q7', '补偿点时读数为什么不动？', '补偿点 ≈ ______'],
       ['Q8', '记录 5 组（光强，净光合）数据并描点', ''],
       ['Q9', '温度升到 35 ℃，补偿点如何变化？为什么？', '新补偿点 ≈ ______'],
       ['Q13', '黑白瓶法中各瓶分别测到什么？', '黑 ___　白 ___'],
       ['Q15', '整株与叶片的净值差，差的是什么？', '差值 = ______']],
      [1.6, 7.8, 5.8])

h2('D.2　结论区（课尾填写）')
para('1. 三量关系：总光合 = ______________________________', first_indent=False,
     line=2.0)
para('2. 净光合为 0 的光强称为 ____________________________', first_indent=False,
     line=2.0)
para('3. 呼吸速率随 ____________ 变化，不随 ____________ 变化。',
     first_indent=False, line=2.0)
para('4. 为什么不能用"箱内 CO₂ 减少量"直接代表总光合？', first_indent=False, line=2.0)
para('   ______________________________________________________', first_indent=False,
     line=2.0)
para('   ______________________________________________________', first_indent=False,
     line=2.0)

h2('D.3　课后一问（带走的问题）')
quote('如果一台 CO₂ 传感器只能测箱内浓度，'
      '你要怎样在 20 min 内测出这株植物在某一光强下的总光合速率？'
      '写出你的步骤，并说明每一步在测什么。')

# ================= 结尾 =================
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('— 教案结束 —')
r.font.size = Pt(9.5); r.font.color.rgb = GRAY

doc.save(OUT)
print('OK ->', OUT)
print('段落数：', len(doc.paragraphs))
