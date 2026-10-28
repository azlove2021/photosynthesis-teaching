# -*- coding: utf-8 -*-
"""把 src 下的模板、样式、脚本与 three.js 打包成一个可离线双击打开的 HTML。"""
import os, io

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'photosynthesis-teaching.html')

JS_FILES = ['00-model.js', '10-scene.js', '15-post.js', '20-plant.js',
            '30-particles.js', '40-chamber.js', '42-lamp.js', '50-curve.js',
            '60-ui.js', '70-lesson.js']

def read(p):
    # newline='' 保留源文件原始换行，再统一归一化。
    # 部分源文件本身是 CRLF（历史遗留），只改写出模式是压不住的。
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read().replace('\r\n', '\n').replace('\r', '\n')

html = read(os.path.join(SRC, 'index.html'))
css = read(os.path.join(SRC, 'style.css'))
three = read(os.path.join(ROOT, 'vendor', 'three.min.js'))
app = '\n'.join('/* ---- %s ---- */\n' % f + read(os.path.join(SRC, f)) for f in JS_FILES)

for name, blob in (('three.min.js', three), ('app', app), ('css', css)):
    if '</script' in blob.lower():
        raise SystemExit('!! %s 含有 </script 字面量，会截断内联脚本' % name)

html = html.replace('/*__CSS__*/', css)
html = html.replace('/*__THREE__*/', three)
html = html.replace('/*__APP__*/', app)

# 换行统一写 LF。Windows 文本模式下 Python 会把 '\n' 翻译成 '\r\n'，
# 于是本地产物是 CRLF、git 提交时再归一化成 LF——同一份文件本地和线上
# 字节数不同（751385 / 747662），md5 也对不上，排查时很容易误判成内容不一致。
# 显式指定 newline 之后两边逐字节相同。
with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)

print('OK ->', OUT)
print('size: %.2f MB' % (os.path.getsize(OUT) / 1048576.0))
