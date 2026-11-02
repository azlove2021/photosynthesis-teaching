# -*- coding: utf-8 -*-
"""生成教师讲义（Word）。

    python make_docx.py

所有数字都从 courseware-data.json 读，和课件同源；本文件里不抄任何一个结果数字。
"""
import io
import json
import os

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(io.open(os.path.join(ROOT, 'courseware-data.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, '光合作用-课堂讲义.docx')

INK = RGBColor(0x0E, 0x1A, 0x2B)
BLUE = RGBColor(0x2F, 0x6B, 0xFF)
DEEP = RGBColor(0x1B, 0x3A, 0x6B)
GREY = RGBColor(0x56, 0x62, 0x7A)
WARN = RGBColor(0x9A, 0x45, 0x07)

SONG = '宋体'
HEI = '黑体'


# ---------------------------------------------------------------- 基础排版
def set_run(run, name=SONG, size=10.5, bold=False, color=None, italic=False):
    run.font.name = 'Times New Roman'
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color is not None:
        run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rpr.append(rf)
    rf.set(qn('w:eastAsia'), name)
    rf.set(qn('w:ascii'), 'Times New Roman')
    rf.set(qn('w:hAnsi'), 'Times New Roman')
    return run


def para(doc_or_cell, text='', size=10.5, bold=False, color=None, name=SONG,
         align=None, before=0, after=4, indent=0, first=0, line=1.35, italic=False):
    p = doc_or_cell.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    if indent:
        pf.left_indent = Cm(indent)
    if first:
        pf.first_line_indent = Cm(first)
    if align is not None:
        p.alignment = align
    if text:
        set_run(p.add_run(text), name=name, size=size, bold=bold, color=color, italic=italic)
    return p


def h1(doc, text, num=''):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(16)
    pf.space_after = Pt(8)
    pf.keep_with_next = True
    if num:
        set_run(p.add_run(num + '  '), name=HEI, size=16, bold=True, color=BLUE)
    set_run(p.add_run(text), name=HEI, size=15, bold=True, color=DEEP)
    # 下划一条浅蓝细线
    pPr = p._element.get_or_add_pPr()
    bdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '8')
    bottom.set(qn('w:space'), '3')
    bottom.set(qn('w:color'), 'C9DAF8')
    bdr.append(bottom)
    pPr.append(bdr)
    return p


def h2(doc, text, num=''):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(11)
    pf.space_after = Pt(5)
    pf.keep_with_next = True
    if num:
        set_run(p.add_run(num + '  '), name=HEI, size=12.5, bold=True, color=GREY)
    set_run(p.add_run(text), name=HEI, size=12.5, bold=True, color=DEEP)
    return p


def shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)


def cell_text(cell, text, size=9.5, bold=False, color=None, name=SONG, align=None):
    cell.text = ''
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.line_spacing = 1.25
    if align is not None:
        p.alignment = align
    set_run(p.add_run(text), name=name, size=size, bold=bold, color=color)


def no_split(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:cantSplit')
    trPr.append(el)


def keep_together(table):
    """让整张表不在分页处被切断。
    做法：除最后一行外，所有单元格段落设 keep_with_next。"""
    for row in table.rows[:-1]:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.paragraph_format.keep_with_next = True


def set_widths(table, widths):
    """统一列宽。必须同时写 gridCol（t.columns）和每个 tcW，
    否则 LibreOffice / WPS 会按等宽平均分配，列宽形同虚设。
    注意：只改宽，不要手工往 tblPr 里塞 tblLayout/tblW——会写出重复节点、
    变成非法 OOXML，Word 会「修复」、LibreOffice 会直接丢掉表格边框。"""
    table.autofit = False
    for j, w in enumerate(widths):
        table.columns[j].width = Cm(w)
        for row in table.rows:
            row.cells[j].width = Cm(w)


def num(x, nd=2):
    """统一数字写法：真减号 U+2212，且 -0.00 归一成 0.00。"""
    if abs(x) < 10 ** (-nd) / 2:
        x = 0.0
    s = ('%.*f' % (nd, x))
    if s.startswith('-'):
        s = '\u2212' + s[1:]
    return s


def add_page_number_footer(section):
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run(p.add_run('光合作用与呼吸作用 · 总光合与净光合　·　'), size=8.5, color=GREY)
    r = p.add_run()
    fld = OxmlElement('w:fldSimple')
    fld.set(qn('w:instr'), 'PAGE')
    r._element.addnext(fld)
    r2 = OxmlElement('w:r')
    t = OxmlElement('w:t')
    t.text = '1'
    r2.append(t)
    fld.append(r2)


# ---------------------------------------------------------------- 文档
def build():
    doc = Document()

    # 默认样式
    st = doc.styles['Normal']
    st.font.name = 'Times New Roman'
    st.font.size = Pt(10.5)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), SONG)

    sec = doc.sections[0]
    sec.page_height = Cm(29.7)
    sec.page_width = Cm(21.0)
    sec.top_margin = Cm(2.0)
    sec.bottom_margin = Cm(1.9)
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(2.2)
    add_page_number_footer(sec)

    meta = DATA['meta']
    stages = DATA['stages']
    quiz = DATA['quiz']
    marks = DATA['marks']

    # ---------------- 封面 ----------------
    para(doc, '', after=10)
    para(doc, '高中生物 · 高三一轮复习 · 1 课时', size=9.5, color=GREY, after=14)
    para(doc, '光合作用与呼吸作用', size=30, bold=True, color=DEEP, name=HEI, after=2, line=1.1)
    para(doc, '总光合 · 呼吸 · 净光合：一株植物上的三个量', size=15, bold=True, color=BLUE, name=HEI, after=12, line=1.2)
    para(doc, meta['subtitle'], size=11.5, color=GREY, after=20, line=1.5)

    t = doc.add_table(rows=4, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.autofit = False
    rows = [
        ('教材依据', meta['textbook'] + '　' + meta['chapter']),
        ('统计口径', '器官级加总 ≡ 整株；叶 / 茎 / 根呼吸占比 0.78 / 0.07 / 0.15'),
        ('单位', '速率 ' + meta['unit']['rate'] + '；光强 ' + meta['unit']['light']),
        ('配套课件', 'photosynthesis-cockpit.html（单文件离线，双击即开）'),
    ]
    for i, (k, v) in enumerate(rows):
        cell_text(t.rows[i].cells[0], k, size=9.5, bold=True, color=GREY)
        cell_text(t.rows[i].cells[1], v, size=9.5, color=INK)
        shade(t.rows[i].cells[0], 'F3F7FF')
        no_split(t.rows[i])
    set_widths(t, [3.2, 13.4])

    para(doc, '', after=18)
    para(doc, '本文档是本课件的教师讲义：左边怎么讲、哪一步做什么、学生应该看到什么，'
              '以及每一步的结论、考点与易错点。所有读数与课件同源，改一处不会出现两份数字。',
         size=9.5, color=GREY, line=1.6)

    doc.add_page_break()

    # ---------------- 一、这节课要解决什么 ----------------
    h1(doc, '这节课要解决什么', '一')

    para(doc, '主线问题', size=10.5, bold=True, color=BLUE, before=2, after=3)
    para(doc, meta['mainQuestion'], size=12, bold=True, color=INK, after=8, line=1.5)

    para(doc, '学生真正的困难不是记不住公式，而是三件事混在一起：', size=10.5, after=4)
    for i, s in enumerate([
        '把箱子里测到的 CO₂ 变化直接当成光合速率（净值当总值）；',
        '分不清「叶片」和「整株」两个口径，扣呼吸时多扣或少扣；',
        '以为光补偿点是「光合停止」，而不是「光合与呼吸相等」。',
    ]):
        para(doc, '（%d）%s' % (i + 1, s), size=10.5, indent=0.5, after=3, line=1.45)

    para(doc, '走完这九步，学生要能自己说出：净值可测，总值只能推。', size=10.5, bold=True,
         color=DEEP, before=6, after=6)

    t = doc.add_table(rows=5, cols=2)
    t.style = 'Table Grid'
    t.autofit = False
    head = [('第 1—4 步', '建立净值：装置 → 黑暗 → 弱光 → 补偿点'),
            ('第 5—7 步', '机制与变量：饱和点 → 温度 → CO₂ 与 O₂'),
            ('第 8 步', '口径迁移：整株 ≠ 叶片，靠器官闭合相加'),
            ('第 9 步', '考核：三道题覆盖前八步'),
            ('贯穿全课', '主线问题：箱里那两只表，到底测到的是哪一项')]
    for i, (k, v) in enumerate(head):
        cell_text(t.rows[i].cells[0], k, bold=True, color=DEEP, size=9.5)
        cell_text(t.rows[i].cells[1], v, size=9.5)
        shade(t.rows[i].cells[0], 'F3F7FF')
        no_split(t.rows[i])
    set_widths(t, [3.4, 13.2])

    # ---------------- 二、九步走位表 ----------------
    h1(doc, '九步走位与读数', '二')
    para(doc, '下表每一行就是课件里的一屏。速率以单株计，单位 ' + meta['unit']['rate'] + '。',
         size=9.5, color=GREY, after=6)

    cols = ['步', '场景', '光强', '温度', 'CO₂', 'O₂', '总光合', '呼吸', '净光合']
    t = doc.add_table(rows=len(stages) + 2, cols=len(cols))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    widths = [1.0, 3.4, 1.6, 1.3, 1.4, 1.2, 2.2, 2.0, 2.5]
    for j, c in enumerate(cols):
        cell_text(t.rows[0].cells[j], c, size=9, bold=True, color=DEEP,
                  align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(t.rows[0].cells[j], 'E8F0FE')
    for i, s in enumerate(stages):
        r = t.rows[i + 1]
        p = s['preset']
        vals = [str(s['idx'] + 1), s['short'], str(p['I']), str(p['T']), str(p['C']),
                '%d%%' % p['O'], num(s['rate']['gross']), num(s['rate']['resp']),
                num(s['rate']['net'])]
        for j, v in enumerate(vals):
            cell_text(r.cells[j], v, size=9,
                      align=WD_ALIGN_PARAGRAPH.CENTER if j != 1 else None)
        no_split(r)
    last = t.rows[len(stages) + 1]
    merged = last.cells[0].merge(last.cells[len(cols) - 1])
    cell_text(merged,
              '25 ℃、400 ppm、21%% O₂ 下：光补偿点 ≈ %d μmol·m⁻²·s⁻¹，光饱和点 ≈ %d μmol·m⁻²·s⁻¹。'
              % (marks['comp'], marks['sat']), size=9, color=GREY)
    shade(merged, 'F8FAFF')
    set_widths(t, widths)
    keep_together(t)

    # ---------------- 三、逐步骤讲稿 ----------------
    h1(doc, '逐步讲稿', '三')
    para(doc, '每一块的固定顺序是：问句 → 动手 → 应该看到 → 结论 → 要点 → 考点 → 易错。'
              '每块上方那句斜体是建议的口头表达，可以照读也可以换成自己的话。',
         size=9.5, color=GREY, after=8)

    TIP = {
        0: '先别急着给公式。让学生盯住箱子里那两只表，问一句：这数字是谁在变？',
        1: '这一步只需要一件事：承认「黑着也有 CO₂ 出来」。承认了，呼吸就立住了。',
        2: '弱光下净值是负的，学生最容易喊「光合停了」。停在补偿点之前不等于停。',
        3: '补偿点是两条曲线相交，不是其中一条消失。这里的 0 是差值，不是速率。',
        4: '加光不再增益，说明限制因素换了人。这一步是后面 CO₂ 与温度的前置。',
        5: '升温时呼吸涨得比光合快，所以净值反而掉。别把「温度高长得快」带进这一格。',
        6: 'CO₂ 和 O₂ 是反方向的：一个给原料，一个掀起光呼吸。滑杆比讲解更有说服力。',
        7: '这一步是全课收口：叶片产、根茎耗，加起来的才是整株。让学生自己点两张卡。',
        8: '三题问的其实是同一件事：你测到的到底是哪一层。答错先回到第②步。',
    }

    for s in stages:
        h2(doc, s['name'])
        pt = para(doc, TIP.get(s['idx'], ''), size=9.5, italic=True, color=GREY, after=5)
        pt.paragraph_format.keep_with_next = True

        t = doc.add_table(rows=7, cols=2)
        t.style = 'Table Grid'
        t.autofit = False
        rows = [
            ('问句', s['question'], INK, False),
            ('动手', s['action'], INK, False),
            ('应该看到', s['expect'], RGBColor(0x24, 0x3B, 0x63), False),
            ('结论', s['conclusion'], DEEP, True),
            ('要点', s['point'], INK, False),
            ('考点', s['exam'], INK, False),
            ('易错', s['warning'], WARN, False),
        ]
        for i, (k, v, col, bold) in enumerate(rows):
            cell_text(t.rows[i].cells[0], k, size=9.5, bold=True, color=GREY)
            cell_text(t.rows[i].cells[1], v, size=10, bold=bold, color=col)
            shade(t.rows[i].cells[0], 'F3F7FF')
            if k == '结论':
                shade(t.rows[i].cells[1], 'EEF4FF')
            if k == '易错':
                shade(t.rows[i].cells[1], 'FFF8EC')
            no_split(t.rows[i])
        set_widths(t, [2.6, 14.0])
        keep_together(t)

        p = s['preset']
        para(doc, '本步读数：光强 %d · 温度 %d ℃ · CO₂ %d ppm · O₂ %d%%　→　'
                  '总光合 %s · 呼吸 %s · 净光合 %s'
             % (p['I'], p['T'], p['C'], p['O'], num(s['rate']['gross']),
                num(s['rate']['resp']), num(s['rate']['net'])),
             size=9, color=GREY, before=4, after=2)

    # ---------------- 四、器官口径 ----------------
    h1(doc, '器官口径：为什么整株 ≠ 叶片', '四')
    para(doc, '课件里点一片叶子、点一次根，两张卡的读数相加正好等于右栏的整株读数。'
              '这不是巧合，是把三个器官的呼吸占比定成 0.78 / 0.07 / 0.15 的结果——'
              '三者之和恰为 1.00，所以「各器官净光合之和 ≡ 整株净光合」。',
         size=10, after=8, line=1.55)

    organ_stage = [x for x in stages if x.get('organs')][0]
    organs = organ_stage['organs']
    names = {'leaf': '叶片', 'stem': '茎', 'root': '根'}
    notes = {'leaf': '唯一的固碳器官，总光合全在这里', 'stem': '不含叶绿体，只呼吸',
             'root': '在土里，无光无叶绿体，只呼吸'}
    t = doc.add_table(rows=5, cols=6)
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    head = ['器官', '总光合', '呼吸', '净光合', '说明', '呼吸占比']
    for j, c in enumerate(head):
        cell_text(t.rows[0].cells[j], c, size=9, bold=True, color=DEEP,
                  align=WD_ALIGN_PARAGRAPH.CENTER)
        shade(t.rows[0].cells[j], 'E8F0FE')
    share = {'leaf': '0.78', 'stem': '0.07', 'root': '0.15'}
    for i, k in enumerate(['leaf', 'stem', 'root']):
        r = t.rows[i + 1]
        o = organs[k]
        for j, v in enumerate([names[k], num(o['gross']), num(o['resp']),
                               num(o['net']), notes[k], share[k]]):
            cell_text(r.cells[j], v, size=9, align=WD_ALIGN_PARAGRAPH.CENTER if 0 < j < 4 or j == 5 else None)
        no_split(r)

    whole = organ_stage['rate']
    sum_net = sum(organs[k]['net'] for k in organs)
    sum_resp = sum(organs[k]['resp'] for k in organs)
    r = t.rows[4]
    cell_text(r.cells[0], '整株', size=9, bold=True, color=DEEP, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r.cells[1], num(whole['gross']), size=9, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r.cells[2], num(whole['resp']), size=9, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r.cells[3], num(whole['net']), size=9, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r.cells[4], '三器官之和，与上行逐项闭合', size=9)
    cell_text(r.cells[5], '1.00', size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    for j in range(6):
        shade(r.cells[j], 'F3F7FF')
    no_split(r)
    set_widths(t, [1.8, 2.0, 1.8, 2.0, 6.4, 2.6])
    keep_together(t)

    para(doc, '验算：%s \u2212 %s \u2212 %s = %s（整株净光合）；'
              '%s + %s + %s = %s（整株呼吸）。'
         % (num(organs['leaf']['net']), num(-organs['stem']['net']), num(-organs['root']['net']),
            num(sum_net),
            num(organs['leaf']['resp']), num(organs['stem']['resp']), num(organs['root']['resp']),
            num(sum_resp)),
         size=9.5, color=DEEP, before=6, after=4)

    para(doc, '课堂上只需要问一句：叶片净光合 %s，为什么整株只有 %s？'
              '差的那一点，就是茎和根在消耗。学生自己点两张卡就能看见。'
         % (num(organs['leaf']['net']), num(whole['net'])),
         size=10, after=4, line=1.55)

    # ---------------- 五、板书与曲线 ----------------
    h1(doc, '板书与三条曲线', '五')
    para(doc, '板书只写四行，写多了学生记不住：', size=10, after=5)
    for s in [
        '总光合　＝　净光合　＋　呼吸',
        '箱内 ΔCO₂ 速率　＝　净光合速率（可测的只有它）',
        '光补偿点：两条曲线相交，光合 = 呼吸，两者都不为零',
        'Σ 各器官净光合　＝　整株净光合',
    ]:
        para(doc, s, size=11, bold=True, color=DEEP, indent=0.6, after=4, line=1.5)

    para(doc, '右栏那条迷你曲线要带着学生看三个地方：', size=10, before=6, after=4)
    for s in [
        '起点：光强为 0 时总光合为 0，净光合是负的——负的那一截长度就是呼吸。',
        '交点：绿线与橙线（呼吸）相交处对应光强约 %d，此后净值才转正。' % marks['comp'],
        '平台：光强过 %d 之后绿线基本压平，限制因素换成了 CO₂ 与温度。' % marks['sat'],
    ]:
        para(doc, '· ' + s, size=10, indent=0.6, after=3, line=1.5)

    # ---------------- 六、考核 ----------------
    h1(doc, '随堂考核与解析', '六')
    p0 = para(doc, '第⑨步会自动开卷，答错立刻给解析。三题分别对应：净值口径、补偿点含义、整株与叶片。',
              size=9.5, color=GREY, after=8)
    p0.paragraph_format.keep_with_next = True
    for i, item in enumerate(quiz):
        block = []
        block.append(para(doc, '%d. %s' % (i + 1, item['q']), size=10.5, bold=True, color=INK,
                          after=3, line=1.5))
        for k, op in enumerate(item['options']):
            mark = 'ABCD'[k]
            right = (k == item['answer'])
            block.append(para(doc, '　%s. %s%s' % (mark, op, '　✔' if right else ''),
                              size=10, color=RGBColor(0x05, 0x73, 0x5A) if right else INK,
                              bold=right, after=2, line=1.45))
        block.append(para(doc, '解析：' + item['why'], size=9.5, color=GREY, indent=0.4,
                          after=10, line=1.5))
        # 一道题（题干 + 四个选项 + 解析）不许被分页切开
        for p in block[:-1]:
            p.paragraph_format.keep_with_next = True

    # ---------------- 七、简化声明 ----------------
    h1(doc, '示意与简化声明', '七')
    para(doc, '上课前对学生说明这几条，可以省掉一半的追问：', size=10, after=5)
    for i, s in enumerate(meta['simplifications']):
        para(doc, '（%d）%s' % (i + 1, s), size=10, indent=0.4, after=3, line=1.5)

    # ---------------- 八、操作提醒 ----------------
    h1(doc, '课件操作与课堂提醒', '八')
    tips = [
        ('打开', '双击 photosynthesis-cockpit.html，断网也能用，不需要装任何东西。'),
        ('翻步', '→ / Space 下一步，← 上一步，数字 1—9 直接跳步。'),
        ('变量', '右栏四个滑块：光强、温度、CO₂、O₂。切步会把变量拉回本步设定；'
                 '想让学生自己乱拖，点顶栏「玩法」进入自由探究。'),
        ('标定视角', 'R 复位视角；双击结构可以聚焦；右键拖拽是平移。'),
        ('投影', 'F 进影院模式（只留顶部胶囊和视角条），Shift+F 让浏览器全屏，Esc 退出。'),
        ('白手套', '鼠标移进画面就变成卡通白手套：点叶片看三者关系，点根看「只有呼吸」。'),
        ('语音', '旁白用系统语音，没有中文语音包时自动变成字幕，不影响讲课；顶栏喇叭键可随时静音。'),
        ('一屏', '不要缩放页面（Ctrl+滚轮）。版式按 1600×900 设计，缩到 125% 左栏会变抽屉。'),
    ]
    for k, v in tips:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.5
        set_run(p.add_run(k + '　'), size=10, bold=True, color=BLUE)
        set_run(p.add_run(v), size=10, color=INK)

    para(doc, '', after=6)
    para(doc, '设计语言参考铜匠实验室（lab.tongjiang.app，CC BY-NC 4.0）：只借鉴布局、配色与组件语言，'
              '课件代码、素材与本文档文案均为自研。', size=8.5, color=GREY, line=1.5)

    doc.save(OUT)
    print('OK ->', OUT)
    print('段落数 %d，表格 %d' % (len(doc.paragraphs), len(doc.tables)))


if __name__ == '__main__':
    build()
