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
    ('课　　时', '1 课时（40—45 min）'),
    ('配套课件', 'photosynthesis-teaching.html（离线单文件，双击即开）'),
    ('设计主线', '拖光强 → 三量实时变化 → 曲线生成 → 迁移与测定'),
    ('核心理念', '净光合是“被测量出来的量”，总光合是“推算出来的量”'),
]
for k, v in info:
    row = t.add_row().cells
    cell_text(row[0], k, bold=True, size=10, color=GRAY)
    cell_text(row[1], v, size=10)
t.autofit = False
fix_table_layout(t, [3.4, 10.6])

doc.add_page_break()

# ================= 一、基本信息 =================
h1('基本信息与设计意图', '一')

para('本课只解决一个问题：**学生能不能分清“总光合”与“净光合”，并且知道为什么必须分清。**'
     '常规复习课讲这一组概念，往往停在“净光合 = 总光合 − 呼吸”的公式记忆上，学生能背，但一到'
     '“密闭容器中 CO₂ 减少量代表什么”“整株植物的净光合为什么是负的”这类题就失分。')

para('失分的根子不在公式，在**实证视角的缺席**：学生没有意识到，我们在实验室里唯一能测到的是净值；'
     '总光合从来没被直接称量过，它是由“净 + 呼”推算出来的。因此本课把课件设计成一台**可操作的测量装置**：'
     '一株植物放在透明同化箱里，箱壁上挂着 CO₂ 与 O₂ 传感器，屏幕上同时给出三条流量、一条会随拖动'
     '逐步长出的曲线，以及一行随状态变化的讲解。学生拖动的不是滑杆，是实验条件。')

table(
    ['项目', '内容'],
    [
        ['课题', '光合作用与呼吸作用：总光合、呼吸与净光合'],
        ['教材位置', '人教版必修 1《分子与细胞》第 5 章；净光合速率与光补偿点、光饱和点为高考高频考点'],
        ['授课对象', '高三年级（已完成必修 1 学习，进入一轮复习）'],
        ['课时安排', '1 课时，四环节：情境引入 5 min / 三量建模 12 min / 曲线生成 15 min / 迁移测定 10 min'],
        ['教学环境', '多媒体教室，教师机投屏；课件支持完全离线运行，不依赖网络'],
        ['配套资源', '交互课件 1 份、学案 1 份、板书设计 1 套'],
    ],
    [3.2, 12.2]
)

# ================= 二、教材与学情 =================
h1('教材与学情分析', '二')

h2('2.1 教材的处理')

para('教材把光合作用与细胞呼吸分列两节，各自讲透过程；但**两者的“收支关系”**是跨节的，'
     '教材只用一段文字点出“净光合速率 = 光合速率 − 呼吸速率”，留给复习课的空间正在这里。'
     '本课不重讲光反应与暗反应的物质转化细节（那是上一节课的任务），而是把两节内容**并置到同一株植物上**，'
     '让“制造”与“消耗”在同一时间、同一空间里发生。')

para('需要向学生明确交代的术语口径：教材中的“光合作用强度”通常指**总光合速率**（也称真正光合速率），'
     '而“净光合速率”又称**表观光合速率**。课件统一使用“总光合”与“净光合”两个简称，'
     '并在附录 A 给出三者对照，避免学生换一份试卷就认不出来。')

h2('2.2 学情：四个具体的坎')

para('依据以往教学与作业反馈，学生在进入本课时普遍卡在以下四处，本课的教学动作基本围绕它们设计：')

table(
    ['学生的典型表现', '背后的真实误解', '本课对应的处理'],
    [
        ['“净光合就是光合作用的强度”',
         '把“测量到的量”与“实际发生的量”混为一谈，缺少“测量口径”意识',
         '先给黑暗态，让净光合为负；再让箱内读数反向变化，用现象逼出“净值”概念'],
        ['“白天只光合，晚上才呼吸”',
         '把两个过程当成时间上互斥的事件，而非同时进行的两个方向',
         '呼吸粒子在全株常驻，光照下不停；熄灯瞬间只停绿色流，橙色流照旧'],
        ['“O₂ 释放量、CO₂ 吸收量、有机物积累量是一回事”',
         '不知道净光合有三种测定口径，也不知道三者近似等值有前提',
         '课件三条读数并列，并在附录中注明“呼吸商 RQ≈1 时近似等值”'],
        ['“整株净光合”与“叶片净光合”混用',
         '默认植物全身都光合，忽略根、茎、成熟果实只呼吸',
         '设置“只看叶片 / 整株”开关，一键切换对比'],
    ],
    [4.4, 5.6, 5.4]
)

h2('2.3 教学起点与终点')

para('**起点**：学生会写光合与呼吸的总反应式，会背“净 = 总 − 呼”。'
     '**终点**：学生能在一条曲线上指出“哪一段净光合为负、哪一点为零、哪一点之后加光无用”，'
     '并能解释“为什么黑暗中的读数就是呼吸速率”。')

# ================= 三、教学目标 =================
h1('教学目标（核心素养四维）', '三')

para('**1. 生命观念**　以“物质与能量的收支”统摄光合与呼吸：植物在光下同时进行制造与消耗，'
     '净积累量才是它真正“长出来”的部分。能据此解释温室栽培中补光与增施 CO₂ 的农学意义。')

para('**2. 科学思维**　能由“净光合 = 总光合 − 呼吸”进行双向推算：给出两者求第三者；'
     '能解读光强—速率曲线上的三个特征点（纵轴截距、穿零点、拐平点），并说明其生物学含义；'
     '能判断温度、CO₂ 浓度变化时曲线的移动方向。')

para('**3. 科学探究**　能说出黑白瓶法、半叶法、叶圆片上浮法三种测定总光合（或净光合）的方案，'
     '指明每种方案“测的是哪个量、用什么作对照、误差从哪来”。')

para('**4. 社会责任**　理解“补光不是越强越好、增施 CO₂ 有饱和上限”背后的成本与效益，'
     '能对“大棚夜间补光”这类说法作出基于本课证据的评价。')

# ================= 四、重难点 =================
h1('教学重点与难点', '四')

para('**教学重点**')
bullet('总光合、呼吸、净光合三者的数量关系与各自的测定口径。')
bullet('光补偿点与光饱和点的含义，以及它们在曲线上的位置。')

para('**教学难点**', space_before=6)
bullet('**方法论难点**：总光合不可直接测量，只能由“净 + 呼”推算——学生缺少这一层“测量意识”。')
bullet('**观念难点**：光照下呼吸作用照常进行，只是被光合“掩盖”，不是被“关闭”。')
bullet('**范围难点**：整株植物的净光合与叶片的净光合不是同一个量，根茎只呼吸不光合。')

para('突破策略：三者都不靠讲授突破，而靠**让学生先看到反常现象，再回头解释**。'
     '例如先问“黑暗中净光合为什么是负数”，学生必须先承认“有东西在消耗”，才能接受呼吸的独立性。')

# ================= 五、教学方法 =================
h1('教学方法与媒体设计', '五')

para('**主线：图像主线。**　全课只有一条时间线——光强从 0 拖到 2000。'
     '随着滑杆移动，植物、粒子、三条读数、曲线、箱内传感器读数、底部讲解条**同时**响应。'
     '曲线不是课前画好贴上去的结论，而是学生自己拖出来的轨迹；光补偿点不是老师指出来的一个点，'
     '而是曲线穿过零轴的那一瞬间。')

para('**双模式。**　课件分两个状态，用右上角切换：')
bullet('**演示态**：只保留光强滑杆与温度三档（15 / 25 / 35 ℃），画面信息量最小，适合投屏讲解。'
       '同屏还会叠出另两条温度的淡色对照曲线，直接呈现“饱和点整体位移”。')
bullet('**探究态**：开放光强、温度、CO₂ 浓度、O₂ 浓度四个滑杆，并显示三张探究任务卡，'
       '适合学生一人一机或小组操作。')

para('**一个必须记住的键：空格。**　任何时刻按空格，页面回到“教材标准状态”'
     '（800 μmol·m⁻²·s⁻¹、25 ℃、400 ppm CO₂、21% O₂）。课堂演示被拨乱时，这一下就能救回来。')

table(
    ['画面元素', '在课上承担的作用', '什么时候用'],
    [
        ['3D 同化箱 + 双传感器', '提供“可测”的物理载体，让净光合有读数依据', '全课常驻'],
        ['五套粒子流', '把“三条量”变成可数的方向：向上=释放，向内=吸收，向外=呼吸', '讲三量关系时'],
        ['三量对账面板', '总光合 − 呼吸 = 净光合，数字随拖动实时变化', '每次改变条件后让学生读数'],
        ['光强—速率曲线', '把瞬时读数变成函数关系，承载补偿点与饱和点', '环节三'],
        ['底部讲解条', '随状态变化的旁白，投屏时不用回头翻讲义', '学生沉默时读出来'],
        ['探究任务卡', '把“测不到总光合”的方法论变成可完成的任务', '环节四'],
    ],
    [3.6, 8.2, 3.6]
)

# ================= 六、流程总览 =================
h1('教学流程总览', '六')

table(
    ['环节', '时间', '教师活动', '学生活动', '核心落点'],
    [
        ['一　情境引入', '5 min', '不讲解，先让学生看 20 秒；抛出三个问题',
         '观察并尝试描述看到的现象', '把“测不到总光合”变成全课悬念'],
        ['二　建立三量', '12 min', '依次按“黑暗 / 弱光 / 光补偿点”三个快捷位置',
         '读三个数字，解释负号对应的现象', '净 = 总 − 呼，且呼吸独立存在'],
        ['三　曲线生成', '15 min', '从 0 缓慢拖到 2000；切温度看位移',
         '盯住曲线长出来，标记三个特征点', '补偿点、饱和点、负值区的含义'],
        ['四　迁移测定', '10 min', '开放探究态，发放三张任务卡',
         '完成任务卡，说明三种测定方法', '方法论：总光合只能推算'],
    ],
    [2.6, 1.7, 4.4, 4.0, 4.2]
)

# ================= 七、环节一 =================
h1('环节一　情境引入：一株植物，三个问题（5 min）', '七')

para('**教师操作。**　课件打开后停在标准状态（800 μmol、25 ℃），**什么都不说，让学生看满 20 秒**。'
     '这 20 秒里画面是活的：叶片在轻微摆动，蓝绿色的点从叶面不断逸出上升，琥珀色的点从箱壁向叶面汇聚，'
     '橙色的点从叶片、茎、甚至盆土下的根系持续飘出，右侧曲线在缓慢生长，箱壁上的传感器指示灯在呼吸般明暗。')

para('**为什么先不讲话。**　学生此刻的注意力在“这是什么”，一旦教师开口解释，注意力就转到“记什么”。'
     '这 20 秒换来的是一整节课的问题意识。')

h2('提问脚本')

quote('Q1　“屏幕上这些点，是从哪儿出来的、又往哪儿去？”')
para('预设回答：绿色的从叶子里冒出来往上走，橙黄色的从箱壁往叶子里钻，'
     '橙红色的到处都有。教师不必纠正措辞，只需要把它们分别写到黑板上并命名。', first_indent=True)

quote('Q2　“这株植物此刻在光合作用，那它在呼吸吗？”')
para('这是全课第一个认知冲突点。相当一部分学生会答“光合的时候不呼吸”或“白天不呼吸”。'
     '**先不评判**，只说“我们待会儿把它关灯看看”，把答案留到环节二。')

quote('Q3　“如果我只告诉你箱子里 CO₂ 少了多少，你能算出它一共制造了多少有机物吗？”')
para('这是本课的总悬念，也是难点所在。学生的直觉是“能”，因为“少了多少就是用了多少”。'
     '教师追问一句：“那它自己呼吸产生的 CO₂，跑到哪儿去了？”——教室通常会安静两秒。'
     '这节课剩下的三十五分钟，就是在回答这两秒的安静。')

para('**设计意图**　三个问题分别锚定三个教学落点：Q1 建立“三条流”的直觉，Q2 埋伏“呼吸不停”的观念冲突，'
     'Q3 抛出方法论缺口。全课不给出任何提前的结论。')

# ================= 八、环节二 =================
h1('环节二　建立三量：从负号开始（12 min）', '八')

para('**教师操作。**　依次点击底部“快捷位置”的三个按钮：**黑暗 → 弱光 → 光补偿点**，每一步停留 40 秒以上，'
     '让学生看清楚数字怎么变、粒子怎么变、箱内读数怎么变。')

h2('8.1 第一步：黑暗（约 4 min）')

para('点击“黑暗”后，绿色与琥珀色粒子全部停掉，只剩橙红色的呼吸粒子在全株持续飘出；'
     '三量面板变成 `总光合 0.0　−　呼吸 2.1　=　净光合 −2.1`，净光合显示为红色；'
     '箱内读数从“↓下降”翻转为“↑上升”。')

quote('Q4　“总光合为什么是 0，呼吸为什么不是 0？”')
quote('Q5　“净光合的 −2.1，这个负号在箱子里对应什么现象？”')
para('引导到：CO₂ 在上升、O₂ 在下降。**负号不是数学符号，是箱子里正在发生的事实。**'
     '这一句要让学生自己说出来，教师不要代说。')

h2('8.2 第二步：弱光（约 3 min）')

para('点击“弱光”（约为补偿点的 50%）。绿色粒子出现了，但稀疏；总光合升到 1 点几，仍小于呼吸，'
     '净光合依然是负的，箱内 CO₂ 仍在上升。')

quote('Q6　“已经有光合了，为什么箱内 CO₂ 还在升？”')
para('这个问题用来打通“有光合 ≠ 有净积累”。学生必须把两个方向**同时**放在脑子里，'
     '而不是二选一。此时可以点开“只看叶片 / 整株”开关做一次快速对比：'
     '只看叶片时净光合是 −1.6，切回整株变成 −2.1，差的 0.5 就是根与茎的呼吸。')

h2('8.3 第三步：光补偿点（约 3 min）')

para('点击“光补偿点”。三量面板变成 `总光合 2.1　−　呼吸 2.1　=　净光合 0.0`，'
     '箱内两个读数同时显示“→ 不变”，底部讲解条弹出：“此刻箱内 CO₂ 与 O₂ 浓度都停止变化——'
     '一个看起来什么都没发生’的临界点”。')

quote('Q7　“此刻植物在光合吗？在呼吸吗？那为什么箱子里的读数一动不动？”')
para('这是本环节的收口。答案是：两个过程都在进行，速率恰好相等，所以净交换为零。'
     '**“什么都没发生”的观测背后，是两个方向都发生了。**')

h2('8.4 板书与结论')

para('在黑板中央写下本课唯一需要背的关系式，并在下方补一行小字：')

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(4); p.paragraph_format.space_after = Pt(2)
r = p.add_run('净光合速率 ＝ 总光合速率 − 呼吸速率')
r.bold = True; r.font.size = Pt(14); r.font.color.rgb = ACCENT; cnfont(r, '黑体')

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(8)
r = p.add_run('净光合可测（表观）　·　总光合需推算（真正）　·　呼吸在光下照常进行')
r.font.size = Pt(9.5); r.font.color.rgb = GRAY

para('**设计意图**　三量关系不靠讲授建立，而是靠三次状态切换逼出来：'
     '先让学生承认“黑暗里也有消耗”，再承认“有光合也可能净亏”，最后承认“观测为零不等于过程为零”。'
     '三个台阶走完，公式只是对已有经验的追认。')

# ================= 九、环节三 =================
h1('环节三　让曲线长出来：三个特征点（15 min）', '九')

para('**教师操作。**　回到标准状态，把光强滑杆**从 0 开始缓慢拖到 2000**，全程约 40 秒，不要快。'
     '曲线会随拖过的最大光强逐步“长出来”，而不是一次性画好。学生的视线会跟着当前工作点移动。')

h2('9.1 三个必须停下来的位置')

table(
    ['位置', '页面上的样子', '要说清的一句话'],
    [
        ['纵轴截距（光强 = 0）', '净光合曲线从 −2.1 起步',
         '曲线不是从原点出发的。这个截距的绝对值，就是呼吸速率'],
        ['穿零点（光补偿点）', '曲线穿过零轴，红点标记“光补偿点”',
         '总光合恰好等于呼吸，净积累为零；这是“能活下去”的最低光强'],
        ['拐平点（光饱和点）', '曲线变平，绿点标记“光饱和点”',
         '再加光，总光合也不再上升——限制因素已经从光照换成了 CO₂ 或酶'],
    ],
    [3.6, 5.6, 6.2]
)

quote('Q8　“曲线上哪一段是‘看起来什么都没发生’的？”')
para('学生指向穿零点。追一句：“除了这一点，还有哪一段是净光合为负的？”'
     '引导学生注意到零轴以下的整个区段——负值区是曲线的一部分，不是错误。')

quote('Q9　“光补偿点会移动吗？把温度切到 35 ℃ 再看。”')
para('点温度三档中的 35 ℃。三条温度对照曲线会同时显示：温度升高，呼吸上升得更快（Q₁₀≈2），'
     '补偿点因此右移，饱和点略微左移、峰值下降。**“点”是会走的，这就是复习课和习题课的分界。**')

quote('Q10　“为什么高光强下再加光也没用？这时候限制光合的是谁？”')
para('引导学生从三条流里找证据：绿色粒子不再变密，琥珀色（CO₂）粒子成为瓶颈。'
     '由此推出：光饱和后，限制因素是 CO₂ 浓度与酶的活性，而不是光照。')

h2('9.2 一个必须纠正的画面')

para('很多学生心里的图像是“白天光合、晚上呼吸”，本质是把两个过程当成了**时间上互斥的事件**。'
     '课件在这一环节要反复利用一件事：**无论光多强，橙红色的呼吸粒子从来没有消失过。**'
     '教师可以让学生数一数——在最亮的状态下，从根、茎、叶上飘出的橙色点有多少条路径。')

quote('Q11　“把光拖到最亮，呼吸停了吗？你怎么证明？”')
para('学生答“没停，橙色粒子还在”。这就是证据链：现象 → 判断 → 结论，而不是教师宣布结论。')

para('**设计意图**　把“点”教成“过程”。补偿点、饱和点在卷面上是两个空，在课上应该是两次“拖动后看见的变化”。'
     '特别是温度三档的对照，让学生第一次直观看到“整条曲线在动”，为二轮复习中的多因素图像题打底。')

# ================= 十、环节四 =================
h1('环节四　迁移与测定：总光合测不到怎么办（10 min）', '十')

para('**教师操作。**　切到“探究态”，右下出现三张任务卡。建议按顺序做，每张卡 3 分钟。')

h2('10.1 任务一：把光关掉，量出呼吸速率')

para('学生点开卡片，页面自动跳到光强 0。读数显示净光合 = −呼吸。')

quote('Q12　“为什么黑暗中的净光合读数，就等于呼吸速率？”')
para('引导学生表述：此时总光合为零，净光合 = 0 − 呼吸 = −呼吸，绝对值即呼吸速率。'
     '这是所有测定实验的**基准线**：不知道呼吸，就永远算不出总光合。')

h2('10.2 任务二：三种测定方法')

para('这是本课方法论的核心。卡片展开后逐条讲，每条都要回答三个问题：**测的是哪个量、对照是什么、误差从哪来**。')

table(
    ['方法', '测到的量', '对照设计', '推算关系'],
    [
        ['黑白瓶法', '黑瓶：呼吸耗氧量；白瓶：净产氧量', '同一水样、同深度、同时间，仅遮光不同',
         '总光合产氧量 = 白瓶 − 黑瓶'],
        ['半叶法（改良）', '对称半叶中有机物的积累量', '同一片叶，一半遮光一半曝光',
         '总光合 = 曝光半叶增重 + 遮光半叶减重'],
        ['叶圆片上浮法', '净产氧量（反映净光合）', '同一批叶圆片，改变光强或 CO₂ 浓度',
         '上浮数量 ∝ 净光合；需先真空抽气使下沉'],
    ],
    [3.0, 4.6, 4.0, 4.0]
)

quote('Q13　“如果黑瓶和白瓶都放在光下，白瓶测到的还是净光合吗？”')
para('会。黑瓶的作用是提供“同等条件下的呼吸基准”，所以黑瓶必须与白瓶**同样处理、只是遮光**。'
     '这一问用来防止学生把“黑瓶法”误解成“黑暗处理”。')

quote('Q14　“三种方法里，哪一种真正测到了总光合？”')
para('一种都没有。三种方法测到的都是净值或耗量，总光合**始终是算出来的**。'
     '这句话建议原样写在黑板上，它比公式更难被记住，也更值得被记住。')

h2('10.3 任务三：整株 ≠ 叶片')

para('点开第三张卡，把“计入根茎呼吸”从“整株”切成“只看叶片”，净光合读数会立刻上升。')

quote('Q15　“同一时刻，整株的净光合比叶片低，低下去的那部分是什么？”')
para('是根、茎、成熟果实等非绿色部分的呼吸消耗。**注意**：整株净光合为负，并不等于这株植物在“亏损”——'
     '可能只是此刻光太弱；但如果长期为负，整株确实无法积累有机物。')

quote('Q16　“题目里说‘某植物的净光合速率’，你默认它指的是叶片还是整株？”')
para('这是收口的一问。答案是：**看题干给的是什么装置**。密闭容器测整株，叶圆片测叶片，'
     '两者不能混用。高考题的陷阱大多埋在这句话里。')

# ================= 十一、板书 =================
h1('板书设计', '十一')

para('黑板分三栏，从左到右依次是“三量关系”“曲线三特征点”“测定方法”。板书只写关键词，不抄课件文字。')

table(
    ['左栏：三量关系', '中栏：曲线三特征点', '右栏：测定方法'],
    [
        ['净光合 = 总光合 − 呼吸\n\n总光合：真正光合，推算\n净光合：表观光合，可测\n呼吸：光下照常进行',
         '纵轴截距 = −呼吸\n穿零点 = 光补偿点（净 = 0）\n拐平点 = 光饱和点（受 CO₂ / 酶限制）',
         '黑白瓶：白 − 黑\n半叶法：对称半叶对照\n叶圆片上浮：净产氧\n\n总光合始终是算出来的'],
    ],
    [5.0, 5.4, 5.0]
)

para('板书的“留白”设计：中栏曲线图在课上由师生共同画出，教师只画坐标轴，曲线留给学生上台补——'
     '补错了正好是教学资源。')

# ================= 十二、作业 =================
h1('作业与学案', '十二')

h2('12.1 基础层（面向全体，巩固读数）')
bullet('某植物在 25 ℃、黑暗条件下，密闭容器中 CO₂ 每小时增加 12 mg。该植物的呼吸速率是多少？'
       '若光照下每小时 CO₂ 减少 48 mg，其总光合速率是多少？（提示：先用“净 + 呼”）')
bullet('画出光强—净光合速率曲线草图，标出纵轴截距、光补偿点、光饱和点，并用一句话说明各点含义。')

h2('12.2 提升层（面向多数，迁移图像）')
bullet('同一植物在 15 ℃、25 ℃、35 ℃ 下分别测得光强—净光合曲线。说明三条曲线的补偿点与饱和点如何移动，'
       '并解释原因（提示：从呼吸的 Q₁₀ 与酶活性两个角度）。')
bullet('将 CO₂ 浓度从 400 ppm 提高到 800 ppm，光饱和点向哪个方向移动？光补偿点基本不变还是明显移动？为什么？')

h2('12.3 挑战层（面向学有余力，方法设计）')
bullet('现有一株盆栽植物、一个透明密闭箱、CO₂ 传感器、遮光布。请设计一个方案，测出该植物在某光强下的'
       '总光合速率，并说明如何控制变量、如何减少误差（至少写出两项误差来源）。')

para('**参考答案要点**（教师用）：基础层强调“先求呼吸再算总”；提升层强调“呼吸随温度上升更快，'
     '故补偿点右移”；挑战层关键在“间隔遮光法”或“先测呼吸、再测净光合”，误差来源包括箱体漏气、'
     '温度波动导致呼吸改变、传感器响应滞后。', space_before=4)

# ================= 附录 A =================
doc.add_page_break()
h1('附录 A　数值模型与交互逻辑说明', '')

para('这一节是给教师自己看的：万一学生在课堂上追问“这个 23.2 是怎么来的”，这里能接住。'
     '课件的数值不追求实验精度，只追求**形态正确、量级合理、趋势符合教材**。')

h2('A.1 总光合的光响应')

para('采用直角双曲线（非矩形），这是光合光响应曲线的标准函数形式：')

p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(3); p.paragraph_format.space_after = Pt(3)
r = p.add_run('Pg = [ αI + Pmax − √( (αI + Pmax)² − 4θαI·Pmax ) ] / (2θ)')
r.font.name = 'Cambria Math'; r.font.size = Pt(10.5); cnfont(r, '宋体')

para('其中 I 为光强，α 为初始斜率（表观量子效率），Pmax 为光饱和时的最大总光合速率，θ 为曲线凸度。'
     '取 θ = 0.90 时，曲线在约 1500 μmol·m⁻²·s⁻¹ 处趋于平缓，与常见阳生植物的实测形态接近。')

h2('A.2 三个环境因子的作用')

para('Pmax 随温度、CO₂ 与 O₂ 变化，采用因子连乘：`Pmax = 27 × f(T) × f(C) × f(O)`')
bullet('**温度** f(T)：以 28 ℃ 为最适温的高斯型响应，15 ℃ 约为 0.65 倍，35 ℃ 约为 0.88 倍。'
       '这解释了为什么高温下曲线的**峰值下降**。')
bullet('**CO₂** f(C)：米氏型饱和，K_m ≈ 340 ppm，以 400 ppm 归一。'
       '这解释了为什么增施 CO₂ 能**抬高**饱和点。')
bullet('**O₂** f(O)：O₂ 升高促进光呼吸，使总光合下降，每升高 1% 约降 0.6%。')

h2('A.3 呼吸')

para('呼吸只随温度变化，不随光强变化——这正是“光下呼吸照常进行”在模型上的体现：')
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(2); p.paragraph_format.space_after = Pt(3)
r = p.add_run('Rd = 2.15 × 2^((T − 25)/10)')
r.font.name = 'Cambria Math'; r.font.size = Pt(10.5); cnfont(r, '宋体')

para('Q₁₀ = 2，即温度每升 10 ℃，呼吸速率约翻一倍。25 ℃ 时为 2.15 μmol CO₂·m⁻²·s⁻¹。')

h2('A.4 三个典型工况的读数')

table(
    ['工况', '光强', '总光合', '呼吸', '净光合', '箱内 CO₂'],
    [
        ['黑暗', '0', '0.0', '2.1', '−2.1', '持续升高'],
        ['光补偿点', '约 60', '2.1', '2.1', '0.0', '停止变化'],
        ['标准状态', '800', '23.2', '2.1', '21.0', '持续下降'],
        ['光饱和', '≥1500', '约 25.0', '2.1', '约 22.9', '下降最快'],
    ],
    [2.6, 2.4, 2.6, 2.4, 2.6, 4.0]
)

para('注：光补偿点的数值随温度、CO₂、O₂ 与“整株 / 叶片”设定而变，上课时以页面显示为准。')

h2('A.5 曲线为什么是“长出来”的')

para('曲线本身是按函数连续计算的，但绘制时会被裁剪到“学生拖到过的最大光强”。'
     '这样做的目的是保留探索的痕迹：学生拖到 800 停下，曲线就停在 800，'
     '右边还是空的，教师可以顺势问“再往右会是什么样子、要不要一起看看”。'
     '按空格重置时，裁剪宽度与最大光强一并复位。')

# ================= 附录 B =================
h1('附录 B　学生高频错误与应答', '')

table(
    ['学生的说法', '误解所在', '建议应答'],
    [
        ['“黑暗中净光合是 0”', '把“光合为 0”与“净光合为 0”混为一谈',
         '净光合 = 0 − 呼吸，所以是负值。零的是总光合，不是净值'],
        ['“光下不呼吸”', '把两个过程当成互斥事件',
         '让看橙色粒子——光越强它也没停。呼吸被“掩盖”，不是被“关闭”'],
        ['“补偿点时植物停止光合”', '把净值为零理解为过程为零',
         '两个方向都在跑，只是速率相等，所以净交换为零'],
        ['“饱和后再加光，净光合会降”', '把“不再上升”读成“下降”',
         '是趋平，不是下降。真会下降的是过高光强引起光抑制，属另一回事'],
        ['“整株净光合为负＝植物要死了”', '把瞬时净值当成长期状态',
         '瞬时为负只说明此刻光太弱；长期为负才意味着无法积累有机物'],
        ['“白瓶测的就是总光合”', '忽略黑瓶提供呼吸基准',
         '白瓶测净光合，黑瓶测呼吸，两者相减才是总光合'],
    ],
    [4.2, 4.6, 6.4]
)

# ================= 附录 C =================
h1('附录 C　课件操作速查与课堂应急', '')

table(
    ['操作', '效果'],
    [
        ['拖动底部“光照强度”', '主变量。植物、粒子、三量、曲线、箱内读数同时响应'],
        ['温度三档（演示态）', '切换 15 / 25 / 35 ℃，同屏叠出温度对照曲线'],
        ['快捷位置四按钮', '黑暗 / 弱光 / 光补偿点 / 光饱和，一键到位'],
        ['“只看叶片 / 整株”', '切换根茎是否计入呼吸，用于讲整株与叶片的差别'],
        ['演示态 / 探究态', '切换信息量与四变量开放度'],
        ['鼠标拖动 / 滚轮 / 双击', '旋转视角 / 缩放 / 回到初始视角'],
        ['空格键', '任何时刻回到教材标准状态'],
        ['右上角“?”', '打开操作说明'],
    ],
    [5.2, 10.0]
)

para('**课堂应急三条：**', space_before=6)
bullet('**断网**：课件为离线单文件，three.js 已内联，双击即开，不需要任何网络。'
       '建议课前把文件复制到教师机桌面并试开一次。')
bullet('**投影偏色**：若投影把青绿色压暗，可把教室窗帘拉上一半——画面本身是暗背景，'
       '环境光越暗，粒子与曲线越清楚。')
bullet('**性能不足**：若笔记本集成显卡掉帧，按空格重置后不要长时间停留在最高光强；'
       '粒子上限已控制在 2000 以内，正常情况下 1080p 可稳定在 45 fps 以上。')

# ================= 结尾 =================
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(18)
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('— 教学设计结束 —')
r.font.size = Pt(9.5); r.font.color.rgb = GRAY

doc.save(OUT)
print('OK ->', OUT)
print('size %.1f KB' % (os.path.getsize(OUT) / 1024.0))
