# -*- coding: utf-8 -*-
"""交互验收：不靠人眼，直接在页面里跑一遍点击/拖拽/滚轮/滑块/考核。

    python uitest.py            # 全流程
    python uitest.py --t 99     # 额外验证 ?t= 夹紧

注意：headless 的 --virtual-time-budget 会把定时器瞬间推完，
requestAnimationFrame 未必按 60fps 跑，所以「相机有没有动」不能只靠
等 400ms —— 这里同时断言 vDes（意图）与手动步进后的 camera（落实）。
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

TEST = r"""
<style>*{transition:none!important;animation:none!important}</style>
<script>
(function(){
  window.__errs = [];
  window.addEventListener('error', function(e){ window.__errs.push('err: ' + (e.message||'')); });
  console.error = function(){ window.__errs.push('cerr: ' + Array.prototype.join.call(arguments,' ')); };
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function key(k){ document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})); }
  function tick(n){ for (var i=0;i<n;i++) updateViewCamera(0.05); }
  async function run(){
    var R = { errs: window.__errs };

    /* rAF 在虚拟时间下是否还活着 */
    var rafN = 0;
    (function loop(){ rafN++; requestAnimationFrame(loop); })();

    var n0 = document.getElementById('sName').textContent;
    nextStep(); await wait(80);
    R.step = [MICRO.step, document.getElementById('sName').textContent,
              document.getElementById('sName').textContent !== n0];

    var rect = glCanvas.getBoundingClientRect();
    var cx = rect.left + rect.width * 0.55, cy = rect.top + rect.height * 0.45;
    var th0 = vDes.theta, r0 = vDes.r;
    var c0 = camera.position.toArray().map(function(v){ return +v.toFixed(3); });
    glCanvas.dispatchEvent(new PointerEvent('pointerdown', {clientX:cx, clientY:cy, bubbles:true, pointerId:1, button:0}));
    for (var i=1;i<=8;i++) glCanvas.dispatchEvent(new PointerEvent('pointermove',{clientX:cx+i*13, clientY:cy+i*5, bubbles:true, pointerId:1}));
    glCanvas.dispatchEvent(new PointerEvent('pointerup', {clientX:cx+104, clientY:cy+40, bubbles:true, pointerId:1, button:0}));
    tick(30);
    var c1 = camera.position.toArray().map(function(v){ return +v.toFixed(3); });
    R.drag = {
      thetaMoved: Math.abs(vDes.theta - th0) > 0.01,
      camMoved: c0.join() !== c1.join(),
      auto: view.auto
    };

    var d0 = vDes.r;
    glCanvas.dispatchEvent(new WheelEvent('wheel', {deltaY:-520, bubbles:true, cancelable:true}));
    tick(40);
    R.wheel = { rBefore: +d0.toFixed(2), rAfter: +vDes.r.toFixed(2),
                dist: +camera.position.distanceTo(camTgt).toFixed(2) };

    key('r'); tick(60);
    R.homeR = +camera.position.distanceTo(camTgt).toFixed(2);

    key('h'); await wait(450);
    R.hideL = document.body.classList.contains('hide-l');
    R.stageHidden = document.getElementById('stage3d').clientWidth;
    key('h'); await wait(450);
    R.stageShown = document.getElementById('stage3d').clientWidth;

    key('f'); await wait(120);
    R.cinema = document.body.classList.contains('cinema');
    R.cinemaStage = document.getElementById('stage3d').clientWidth;
    R.cinemaBar = getComputedStyle(document.getElementById('cineBar')).display;
    key('Escape'); await wait(120);
    R.cinemaExit = !document.body.classList.contains('cinema');

    /* 点选 + 卡片跟随滑块 */
    goStep(0, {instant:true}); await wait(200);
    tick(20);
    var hit = null;
    for (var k=0;k<leafRecords.length && !hit;k+=2){
      var rec = leafRecords[k];
      var wp = new THREE.Vector3(0, rec.len*0.45, 0); rec.mesh.localToWorld(wp);
      var pr = wp.project(camera);
      var lx = rect.left + (pr.x*.5+.5)*rect.width, ly = rect.top + (-pr.y*.5+.5)*rect.height;
      hit = pickAt(lx, ly, true);
    }
    R.pick = { id: hit, card: document.getElementById('pickCard').classList.contains('on'),
               hasNet: document.getElementById('pcBody').textContent.indexOf('净光合') >= 0 };
    var before = document.getElementById('pcBody').textContent.match(/\d+\.\d+/)[0];

    var rI = document.getElementById('rI');
    rI.value = '0'; rI.dispatchEvent(new Event('input', {bubbles:true}));
    await wait(120);
    R.dark = { gross: +LIVE.gross.toFixed(2), net: +LIVE.net.toFixed(2),
               roNet: document.getElementById('roNet').textContent,
               cardChanged: document.getElementById('pcBody').textContent.match(/\d+\.\d+/)[0] !== before,
               lamp: +lampHalo.material.opacity.toFixed(3) };

    /* O₂ 抑制：先回到标准光强再拖氧气 */
    rI.value = '800'; rI.dispatchEvent(new Event('input', {bubbles:true}));
    await wait(80);
    var g21 = LIVE.gross;
    var rO = document.getElementById('rO');
    rO.value = '60'; rO.dispatchEvent(new Event('input', {bubbles:true}));
    await wait(80);
    var g60 = LIVE.gross;
    R.o2 = { at21: +g21.toFixed(2), at60: +g60.toFixed(2), inhibited: g60 < g21 };
    rO.value = '21'; rO.dispatchEvent(new Event('input', {bubbles:true}));
    await wait(60);

    /* 考核 */
    goStep(8, {instant:true}); await wait(260);
    R.quizOpened = document.getElementById('quizWrap').classList.contains('on');
    var quiz = DATA.quiz;
    var wrong = (quiz[0].answer + 1) % quiz[0].options.length;
    document.querySelector('.opt[data-opt="' + wrong + '"]').click();
    await wait(120);
    R.quizWrong = { wrongMark: !!document.querySelector('.opt.wrong'),
                    why: !!document.querySelector('.q-why'),
                    score: document.getElementById('score').textContent };
    QZ.picked = {}; QZ.at = 0; renderQuiz();
    for (var q=0;q<quiz.length;q++){
      document.querySelector('.opt[data-opt="' + quiz[q].answer + '"]').click();
      await wait(80);
      document.getElementById('qNext').click(); await wait(140);
    }
    R.quizDone = { score: document.getElementById('score').textContent,
                   three: document.getElementById('qBody').textContent.indexOf('3 / 3') >= 0,
                   prog: document.getElementById('qProg').textContent };
    closeQuiz();

    R.elems = ['#top','#chain','#steps','#leftPanel','#stage3d','#rightPanel','.foot','#eqb','#pickCard']
      .map(function(s){ return s.replace('#','').replace('.','') + (document.querySelector(s) ? '✓' : '✗'); }).join(' ');
    R.scroll = [document.documentElement.scrollWidth, window.innerWidth,
                document.documentElement.scrollHeight, window.innerHeight];
    R.rafN = rafN;
    R.frames = renderer.info.render.frame;
    R.errs = window.__errs.slice(0, 6);
    return R;
  }
  function emit(R){
    var d = document.createElement('div');
    d.id = 'probeout'; d.style.cssText = 'position:fixed;left:-9999px;top:0';
    d.textContent = JSON.stringify(R);
    document.body.appendChild(d);
  }
  window.addEventListener('load', function(){
    setTimeout(function(){
      run().then(emit).catch(function(e){
        emit({fatal:String(e), stack:String(e.stack||'').slice(0,300), errs:window.__errs});
      });
    }, 900);
  });
})();
</script>
</body>
"""


def build():
    html = io.open(SRC, encoding='utf-8').read()
    html = html.replace('</body>', TEST)
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, '_uitest.html')
    io.open(p, 'w', encoding='utf-8').write(html)
    return p


def run(page, query=''):
    url = 'file:///' + page.replace('\\', '/') + ('?' + query if query else '')
    args = [CHROME, '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
            '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
            '--hide-scrollbars', '--force-device-scale-factor=1',
            '--window-size=1600,1000', '--virtual-time-budget=16000', '--dump-dom', url]
    r = subprocess.run(args, capture_output=True, timeout=900)
    dom = r.stdout.decode('utf-8', 'ignore')
    m = re.search(r'id="probeout"[^>]*>(.*?)</div>', dom, re.S)
    if not m:
        return None
    return json.loads(m.group(1).strip())


def main():
    page = build()
    q = ''
    if '--t' in sys.argv:
        q = 't=' + sys.argv[sys.argv.index('--t') + 1]
    R = run(page, q)
    print(json.dumps(R, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
