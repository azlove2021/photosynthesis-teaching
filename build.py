# -*- coding: utf-8 -*-
"""把 src 下的模板、样式、脚本与 three.js 打包成一个可离线双击打开的 HTML。"""
import os, io

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'photosynthesis-teaching.html')

JS_FILES = ['00-model.js', '10-scene.js', '20-plant.js',
            '30-particles.js', '40-chamber.js', '50-curve.js', '60-ui.js']

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

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

with io.open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

print('OK ->', OUT)
print('size: %.2f MB' % (os.path.getsize(OUT) / 1048576.0))
