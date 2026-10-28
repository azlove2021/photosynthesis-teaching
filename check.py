# -*- coding: utf-8 -*-
"""课堂层回归：把 _probe3.js 注入产物，跑一遍问题串 / 记录表 / 纯净模式 / 键位。"""
import os, io, re, json, subprocess, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'photosynthesis-teaching.html')
TMP = os.path.join(tempfile.gettempdir(), 'pshot')
os.makedirs(TMP, exist_ok=True)
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def main():
    with io.open(SRC, 'r', encoding='utf-8') as f:
        html = f.read()
    with io.open(os.path.join(ROOT, '_probe3.js'), 'r', encoding='utf-8') as f:
        probe = f.read()
    html = html.replace('</body>', '<script>\n' + probe + '\n</script>\n</body>')
    page = os.path.join(TMP, '_check.html')
    with io.open(page, 'w', encoding='utf-8') as f:
        f.write(html)

    args = [CHROME, '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
            '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
            '--hide-scrollbars', '--force-device-scale-factor=1',
            '--run-all-compositor-stages-before-draw',
            '--window-size=1440,900', '--virtual-time-budget=4000',
            '--dump-dom', 'file:///' + page.replace('\\', '/')]
    r = subprocess.run(args, capture_output=True, timeout=900)
    dom = r.stdout.decode('utf-8', 'ignore')
    m = re.search(r'id="probeout"[^>]*>(.*?)</div>', dom, re.S)
    if not m:
        print('!! 没有拿到探针输出')
        print(dom[:600])
        return
    txt = m.group(1).strip()
    try:
        d = json.loads(txt)
    except Exception:
        print('raw:', txt[:800])
        return
    for k in sorted(d):
        print('%-12s %s' % (k, d[k]))


if __name__ == '__main__':
    main()
