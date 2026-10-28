# -*- coding: utf-8 -*-
"""离线单文件课件的 headless 出图 / 取色探针。

页面自己把关注点在屏幕上的像素坐标算出来（用相机投影），
再配合 --dump-dom 取回，python 端按这些坐标取色，避免靠估。
"""
import os, sys, io, json, re, subprocess, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'photosynthesis-teaching.html')
TMP = os.path.join(tempfile.gettempdir(), 'pshot')
os.makedirs(TMP, exist_ok=True)

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

PROBE = """
<script>
(function(){
  var kv = {};
  try {
    String(location.search || '').replace(/^\\?/, '').split('&').forEach(function(p){
      var i = p.indexOf('='); if (i > 0) kv[p.slice(0, i)] = p.slice(i + 1);
    });
  } catch (e) {}
  var lostFlag = 0;
  try { glCanvas.addEventListener('webglcontextlost', function(){ lostFlag = 1; }); } catch (e) {}
  setTimeout(function(){
    var out = {};
    out.lost = lostFlag;
    try {
      if (kv.I !== undefined) setLight(parseFloat(kv.I));
      if (kv.T !== undefined) setTemp(parseFloat(kv.T));
      if (kv.whole !== undefined) setWhole(kv.whole === '1');
      Orbit.autoIdle = -1e9;
      Orbit.az = Orbit.taz = 0.34;
      Orbit.pol = Orbit.tpol = 1.255;
      Orbit.dist = Orbit.tdist = 7.30;
      /* 纵轴必须与"整株 / 只叶片"解耦：切口径时轴不能动 */
      var axW = chartRanges();
      setWhole(false);
      var axL = chartRanges();
      if (kv.whole !== '0') setWhole(true);
      out.axisWhole = [axW.yMin, axW.yMax];
      out.axisLeaf = [axL.yMin, axL.yMax];
      out.axisLocked = (axW.yMin === axL.yMin && axW.yMax === axL.yMax);
      if (kv.chem === '1' && typeof toggleChem === 'function') {
        toggleChem();
        if (typeof resizeChart === 'function') resizeChart();
      }
      out.chemOpen = !document.getElementById('chemBody').hidden;
      if (out.chemOpen) {
        var cb = document.getElementById('chemBody');
        var rr = cb.getBoundingClientRect();
        out.chemRect = [Math.round(rr.left), Math.round(rr.top),
                        Math.round(rr.width), Math.round(rr.height)];
        out.chemScroll = [cb.scrollHeight, cb.clientHeight];
        out.chemMaxH = getComputedStyle(cb).maxHeight;
      }
      /* 先记一组，再把温度拨走：用来验证"异条件实测点变灰" */
      if (kv.rec === '1' && window.__lesson) window.__lesson.record();
      if (kv.voice === '1') {
        var bv = document.getElementById('btnVoice');
        if (bv) bv.click();
      }
      if (kv.after !== undefined) setTemp(parseFloat(kv.after));
      if (kv.scroll === '1') {
        var cbs = document.getElementById('chemBody');
        if (cbs) cbs.scrollTop = cbs.scrollHeight;
      }
      for (var i = 0; i < 30; i++) window.__warmFrame(0.033);
      if (typeof drawChart === 'function') drawChart();
      out.foot = document.getElementById('chartFoot').textContent;
      out.recN = window.__lesson ? window.__lesson.recordCount() : -1;

      var r = glCanvas.getBoundingClientRect();
      function proj(v) {
        var p = v.clone().project(camera);
        return [Math.round(r.left + (p.x * 0.5 + 0.5) * r.width),
                Math.round(r.top + (-p.y * 0.5 + 0.5) * r.height)];
      }
      out.I = State.I;
      out.key = +keyLight.intensity.toFixed(3);
      out.hemi = +hemi.intensity.toFixed(3);
      out.gl = POST.w + 'x' + POST.h;
      out.stage = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
      var dpr = renderer.getPixelRatio();
      out.dpr = dpr;
      out.pts = {
        lampTube: proj(new THREE.Vector3(LAMP.x, LAMP.y, LAMP.z)),
        lampHoodTop: proj(new THREE.Vector3(LAMP.x, LAMP.y + 0.17, LAMP.z)),
        hoodInner: proj(new THREE.Vector3(LAMP.x, LAMP.y + 0.07, LAMP.z + 0.10)),
        gFront: proj(new THREE.Vector3(-0.55, 0, 0.95)),
        gRight: proj(new THREE.Vector3(0.95, 0, 0.30)),
        gBack: proj(new THREE.Vector3(0, 0, -1.30)),
        gFar: proj(new THREE.Vector3(0, 0, -3.60)),
        potBase: proj(new THREE.Vector3(0, 0, 0.36)),
        leaf: proj(new THREE.Vector3(0, 1.75, 0)),
        bgTop: [r.left + r.width - 8, r.top + 8],
        bgBot: [r.left + 8, r.top + Math.round(r.height) - 6]
      };
      out.err = renderer.getContext().getError();
    } catch (e) {
      out.x = String(e) + ' | ' + (e && e.stack ? String(e.stack).split('\\n')[1] : '');
    }
    var d = document.createElement('div');
    d.id = 'probeout';
    d.style.cssText = 'position:fixed;left:-9999px;top:0';
    d.textContent = JSON.stringify(out);
    document.body.appendChild(d);
  }, 900);
})();
</script>
</body>
"""


def build_probe():
    with io.open(SRC, 'r', encoding='utf-8') as f:
        html = f.read()
    html = html.replace('</body>', PROBE)
    out = os.path.join(TMP, '_shot.html')
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    return out


def shoot(page, query, tag, w, h, budget):
    png = os.path.join(TMP, 'pshot_%s.png' % tag)
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
            probe = {'raw': m.group(1)[:400], 'parse': str(e)}
    return png, probe


def analyse(png, probe, tag):
    from PIL import Image
    im = Image.open(png).convert('RGB')
    W, H = im.size
    px = im.load()

    def patch(x, y, r=3):
        acc = [0, 0, 0]; n = 0
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                xx = min(W - 1, max(0, int(x) + dx))
                yy = min(H - 1, max(0, int(y) + dy))
                c = px[xx, yy]
                acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; n += 1
        return tuple(v // n for v in acc)

    res = {'tag': tag, 'size': (W, H), 'probe': probe}
    if probe and 'pts' in probe:
        for k, (x, y) in probe['pts'].items():
            res[k] = patch(x, y)
    if probe and 'stage' in probe:
        L, T, SW, SH = probe['stage']
        rows = []
        for j in range(8):
            row = []
            for i in range(8):
                x = L + int(SW * (i + 0.5) / 8)
                y = T + int(SH * (j + 0.5) / 8)
                c = patch(x, y, 5)
                row.append('%3d' % int(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]))
            rows.append(' '.join(row))
        res['grid'] = rows
    return res


def main():
    page = build_probe()
    specs = sys.argv[1:] or ['800']
    w = int(os.environ.get('SHOT_W', '1440'))
    h = int(os.environ.get('SHOT_H', '900'))
    budget = 3200
    for spec in specs:
        if ':' in spec:
            tag, q = spec.split(':', 1)
        else:
            tag, q = spec, 'I=' + spec
        png, probe = shoot(page, q, tag, w, h, budget)
        if not os.path.exists(png):
            print('!! %s 没有产出图片' % tag)
            continue
        d = analyse(png, probe, tag)
        print('== %-8s %s  %s' % (tag, d['size'], probe and {k: probe[k] for k in ('I', 'key', 'hemi', 'gl', 'dpr', 'lost', 'err')}))
        if probe and 'axisLocked' in probe:
            print('   axis whole=%s leaf=%s locked=%s chemOpen=%s' %
                  (probe['axisWhole'], probe['axisLeaf'], probe['axisLocked'], probe.get('chemOpen')))
        if probe and 'chemRect' in probe:
            print('   chem rect=%s scroll/client=%s maxH=%s' %
                  (probe['chemRect'], probe['chemScroll'], probe.get('chemMaxH')))
        if probe and 'foot' in probe:
            print('   rec=%s foot=%s' % (probe.get('recN'), probe['foot']))
        if probe and 'x' in probe:
            print('   ERR', probe['x'])
        keys = ['lampHoodTop', 'lampTube', 'hoodInner', 'gFront', 'gRight',
                'gBack', 'gFar', 'potBase', 'leaf', 'bgTop', 'bgBot']
        print('   ' + '  '.join('%s=%s' % (k, d.get(k)) for k in keys))
        for r in d.get('grid', []):
            print('   |', r)
    print('dir:', TMP)


if __name__ == '__main__':
    main()
