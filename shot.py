# -*- coding: utf-8 -*-
"""离线单文件课件的 headless 出图与自探针。

    python shot.py [t0 t2 ...] [-w 1600 -h 900]

对每一步出图，并让页面自己回答几个问题（不靠人眼猜）：
    · 有没有 JS 报错、canvas 尺寸、绘制调用数
    · 九步的读数是否与 JSON 一致
    · 射线拾取能不能点中叶片并弹出读数卡
    · 白手套光标的三个 CSS 变量是否注入成功
"""
import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'photosynthesis-cockpit.html')
OUT = os.path.join(ROOT, '_shots')
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

PROBE = r"""
<script>
(function(){
  window.__errs = [];
  window.addEventListener('error', function(e){
    window.__errs.push('error: ' + (e.message || '') + ' @' + (e.filename||'') + ':' + (e.lineno||0));
  });
  window.addEventListener('unhandledrejection', function(e){
    window.__errs.push('reject: ' + e.reason);
  });
  var origErr = console.error;
  console.error = function(){
    window.__errs.push('console.error: ' + Array.prototype.join.call(arguments, ' '));
    origErr.apply(console, arguments);
  };
  setTimeout(function(){
    var out = { errs: window.__errs.slice(0, 8) };
    try {
      var r = glCanvas.getBoundingClientRect();
      out.stage = [Math.round(r.width), Math.round(r.height)];
      out.dpr = renderer.getPixelRatio();
      out.draw = renderer.info.render.calls;
      out.tris = renderer.info.render.triangles;
      out.ctxLost = renderer.getContext().isContextLost();
      out.step = MICRO.step;
      out.sName = document.getElementById('sName').textContent;
      out.rates = {
        gross: +LIVE.gross.toFixed(2), resp: +LIVE.resp.toFixed(2), net: +LIVE.net.toFixed(2)
      };
      out.jsonRate = STAGES[MICRO.step].rate;
      out.comp = LIVE.comp == null ? null : Math.round(LIVE.comp);
      out.sat = LIVE.sat == null ? null : Math.round(LIVE.sat);
      out.eqb = document.getElementById('eqb').textContent.slice(0, 40);
      out.tags = TAG_LIST.map(function(t){
        return t.id + ':' + Math.round(parseFloat(t.node.style.left || -999)) + ',' +
               Math.round(parseFloat(t.node.style.top || -999));
      });
      /* 光标 */
      var cs = getComputedStyle(document.documentElement);
      out.cur = ['--cur-idle', '--cur-point', '--cur-press'].map(function(k){
        var v = cs.getPropertyValue(k).trim();
        return k + '=' + (v ? v.length : 0);
      }).join(' ');
      out.glove = document.body.classList.contains('glove');
      /* 真实射线：逐片叶子把叶片中点投到屏幕再 pickAt，取第一次命中 */
      var NOPICK = /[?&]np=1/.test(location.search);
      var hitId = null, lx = 0, ly = 0;
      for (var k = 0; !NOPICK && k < leafRecords.length && !hitId; k += 2) {
        var rec = leafRecords[k];
        var wp = new THREE.Vector3(0, rec.len * 0.45, 0);
        rec.mesh.localToWorld(wp);
        var pr = wp.project(camera);
        lx = r.left + (pr.x * .5 + .5) * r.width;
        ly = r.top + (-pr.y * .5 + .5) * r.height;
        if (lx < r.left + 8 || lx > r.right - 8 || ly < r.top + 8 || ly > r.bottom - 8) continue;
        hitId = pickAt(lx, ly, false);
      }
      out.leafXY = [Math.round(lx), Math.round(ly)];
      out.hitId = hitId;
      if (hitId) {
        selectPick(hitId, null);
        out.cardOn = document.getElementById('pickCard').classList.contains('on');
        out.cardName = document.getElementById('pcName').textContent;
        out.cardBody = document.getElementById('pcBody').textContent.replace(/\s+/g, ' ').slice(0, 150);
        out.cardFoot = document.getElementById('pcFoot').textContent.replace(/\s+/g, ' ').slice(0, 90);
      }
      /* 面板折叠 */
      togglePanel('l');
      out.hideL = document.body.classList.contains('hide-l');
      togglePanel('l');
      out.stageWide = Math.round(document.getElementById('stage3d').clientWidth);
      /* 考核 */
      out.quizOpen = document.getElementById('quizWrap').classList.contains('on');
      out.quizText = document.getElementById('qBody').textContent.replace(/\s+/g, ' ').slice(0, 60);
      /* 一屏内不滚动 */
      out.scroll = [document.documentElement.scrollWidth, document.documentElement.scrollHeight,
                    window.innerWidth, window.innerHeight];
      out.voiceState = (typeof voiceState === 'string') ? voiceState : 'n/a';
      out.sub = document.querySelector('.sub') ? document.querySelector('.sub').textContent.length : -1;
    } catch (e) {
      out.x = String(e) + ' | ' + (e.stack ? String(e.stack).split('\n')[1] : '');
    }
    var d = document.createElement('div');
    d.id = 'probeout';
    d.style.cssText = 'position:fixed;left:-9999px;top:0';
    d.textContent = JSON.stringify(out);
    document.body.appendChild(d);
  }, 1600);
})();
</script>
</body>
"""


def build_probe():
    with io.open(SRC, 'r', encoding='utf-8') as f:
        html = f.read()
    html = html.replace('</body>', PROBE)
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, '_probe.html')
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(html)
    return p


def shoot(page, query, tag, w, h, budget=4200, wait_ms=0):
    png = os.path.join(OUT, 'shot_%s.png' % tag)
    if os.path.exists(png):
        os.remove(png)
    url = 'file:///' + page.replace('\\', '/') + ('?' + query if query else '')
    args = [CHROME, '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
            '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
            '--hide-scrollbars', '--force-device-scale-factor=1',
            '--run-all-compositor-stages-before-draw',
            '--window-size=%d,%d' % (w, h),
            '--virtual-time-budget=%d' % budget,
            '--screenshot=' + png, '--dump-dom', url]
    r = subprocess.run(args, capture_output=True, timeout=900)
    dom = r.stdout.decode('utf-8', 'ignore')
    m = re.search(r'id="probeout"[^>]*>(.*?)</div>', dom, re.S)
    probe = None
    if m:
        try:
            probe = json.loads(m.group(1).strip())
        except Exception as e:
            probe = {'raw': m.group(1)[:300], 'parse': str(e)}
    return png, probe


def main():
    raw = sys.argv[1:]
    args = []
    skip = False
    for a in raw:
        if skip:
            skip = False
            continue
        if a in ('-w', '-h'):
            skip = True
            continue
        if not a.startswith('-'):
            args.append(a)
    w, h = 1600, 1000
    if '-w' in sys.argv:
        w = int(sys.argv[sys.argv.index('-w') + 1])
    if '-h' in sys.argv:
        h = int(sys.argv[sys.argv.index('-h') + 1])
    page = build_probe()
    steps = args or ['0', '4']
    for s in steps:
        if ':' in s:
            tag, query = s.split(':', 1)
        else:
            tag, query = 't' + s, 't=' + s
        png, probe = shoot(page, query, tag, w, h)
        if not os.path.exists(png):
            print('!! %s 没出图' % tag)
            continue
        print('== %-5s' % tag, json.dumps(probe, ensure_ascii=False) if probe else '(no probe)')
    print('dir:', OUT)


if __name__ == '__main__':
    main()
