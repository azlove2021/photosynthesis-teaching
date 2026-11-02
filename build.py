# -*- coding: utf-8 -*-
"""把 src 下的模板、样式、脚本、数据与 three.js 打包成一个可离线双击打开的 HTML。

    python build.py

产物：
    photosynthesis-cockpit.html   单文件，零外链
    index.html                    同内容副本（GitHub Pages 与自检脚本都认这个名字）
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'photosynthesis-cockpit.html')
OUT_INDEX = os.path.join(ROOT, 'index.html')

# 加载顺序即依赖顺序（拼进同一个 <script>，共享顶层作用域）
JS_FILES = [
    '10-model.js',     # 生理模型（由 tools/gen-data.mjs 从 tools/model.mjs 生成）
    '15-util.js',      # 数学工具 / URL 参数 / 微状态
    '20-data.js',      # 读 #courseware-data，派生运行时数据
    '30-scene.js',     # 渲染器 / 相机状态机 / 灯光
    '40-plant.js',     # 程序化植株 + 器官分组 + 拾取注册
    '50-particles.js', # 五套物质流 + 器官聚焦
    '60-chamber.js',   # 同化箱 / 探头 / 浮尘
    '65-lamp.js',      # 吊装日光灯
    '70-pick.js',      # 拾取 + 白手套光标 + 器官读数卡
    '80-ui.js',        # 七区渲染、步骤流、中控台、迷你图、面板折叠
    '90-quiz.js',      # 语音五态机 + 考核
]


def read(path):
    with io.open(path, 'r', encoding='utf-8') as f:
        return f.read()


def main():
    missing = [f for f in JS_FILES if not os.path.exists(os.path.join(SRC, f))]
    if missing:
        raise SystemExit('缺少源文件：%s' % ', '.join(missing))

    html = read(os.path.join(SRC, 'index.html'))
    css = read(os.path.join(SRC, 'style.css'))
    three = read(os.path.join(ROOT, 'libs', 'three.min.js'))
    data = read(os.path.join(ROOT, 'courseware-data.json'))

    app_parts = []
    for name in JS_FILES:
        app_parts.append('/* ==================== %s ==================== */' % name)
        app_parts.append(read(os.path.join(SRC, name)))
    app = '\n'.join(app_parts)

    # 数据必须以 JSON 块留在文档里：既是唯一数据源，也方便人工核对
    data_block = ('<script type="application/json" id="courseware-data">\n'
                  + data.strip() + '\n</script>')

    for name, blob in (('three.min.js', three), ('app', app), ('css', css), ('data', data)):
        if '</script' in blob.lower():
            raise SystemExit('!! %s 含有 </script 字面量，会截断内联脚本' % name)

    html = html.replace('/*__CSS__*/', css)
    html = html.replace('/*__THREE__*/', three)
    html = html.replace('<!--__DATA__-->', data_block)
    html = html.replace('/*__APP__*/', app)

    for path in (OUT, OUT_INDEX):
        # newline='\n'：Windows 上默认会把 \n 翻成 \r\n，而 git 提交时又会翻回 \n，
        # 于是「本地双击的那份」和「Pages 上线的那份」字节不同，没法逐字节核对。
        # 统一写成 LF，两边就是同一份文件。
        with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(html)

    print('OK ->', OUT)
    print('OK ->', OUT_INDEX)
    print('size: %.2f MB' % (os.path.getsize(OUT) / 1048576.0))


if __name__ == '__main__':
    main()
