/* 课堂层回归：问题串 / 记录表 / 推导 chips / 纯净模式 */
(function () {
  var errs = [];
  window.onerror = function (m, s, l, c) { errs.push(String(m) + ' @' + l + ':' + c); return false; };

  function log(extra) {
    var d = document.createElement('div');
    d.id = 'probeout';
    d.style.cssText = 'position:fixed;left:-9999px;top:0';
    d.textContent = JSON.stringify(extra);
    document.body.appendChild(d);
  }

  window.addEventListener('load', function () {
    setTimeout(function () {
      var R = { err: errs, n: 0 };
      try {
        var L = window.__lesson;
        R.n = L.questions.length;

        /* 逐题走一遍，记录每题落到的场景状态 */
        var trail = [];
        for (var i = 0; i < L.questions.length; i++) {
          L.setQ(i);
          trail.push('Q' + (i + 1) + ':' + State.I + '/' + State.T + (State.whole ? 'W' : 'L'));
        }
        R.trail = trail.join(' ');

        /* 推导 chips 解锁 */
        L.setQ(0); R.chipAfterQ1 = document.querySelectorAll('#deriveChips .chip.on').length;
        L.setQ(10); R.chipAfterQ11 = document.querySelectorAll('#deriveChips .chip.on').length;
        L.setQ(13); R.chipAfterQ14 = document.querySelectorAll('#deriveChips .chip.on').length;

        /* 记录表 */
        L.setQ(0);
        setLight(300); L.record();
        setLight(600); L.record();
        setLight(0); L.record();
        R.recCount = L.recordCount();
        R.recRows = document.querySelectorAll('#recBody tr').length;
        R.recText = document.getElementById('recCount').textContent;

        /* 纯净模式 */
        document.getElementById('btnPure').click();
        R.pureOn = L.pure() && document.body.classList.contains('pure');
        document.getElementById('btnPure').click();
        R.pureOff = !L.pure();

        /* 键位：→ 切题，↑ 调光 */
        var before = L.index();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        R.keyRight = L.index() === before + 1;
        var I0 = State.I;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        R.keyUp = State.I > I0;

        /* 16 题题文是否被单行省略号截断 */
        var ov = [];
        var qt = document.getElementById('qText');
        for (var j = 0; j < L.questions.length; j++) {
          L.setQ(j);
          if (qt.scrollWidth > qt.clientWidth + 1) ov.push('Q' + (j + 1));
        }
        R.overflow = ov.length ? ov.join(',') : 'none';
        R.qFont = getComputedStyle(qt).fontSize;

        /* --- 化学式抽屉 --- */
        var cb = document.getElementById('chemBody');
        R.chemClosed0 = cb.hidden;
        document.getElementById('btnChem').click();
        R.chemOpen = !cb.hidden;
        R.chemSections = cb.querySelectorAll('.cg').length;
        R.chemArrows = cb.querySelectorAll('.arw').length;
        R.chemSubs = cb.querySelectorAll('sub').length;
        R.chemText = cb.textContent.replace(/\s+/g, '');
        document.getElementById('btnChem').click();
        R.chemClosed1 = cb.hidden;

        /* --- 纵轴与口径解耦 --- */
        var ax1 = chartRanges();
        setWhole(false);
        var ax2 = chartRanges();
        setWhole(true);
        R.axisWhole = [ax1.yMin, ax1.yMax];
        R.axisLeaf = [ax2.yMin, ax2.yMax];
        R.axisLocked = (ax1.yMin === ax2.yMin && ax1.yMax === ax2.yMax);

        /* --- 呼吸分解行 --- */
        setLight(800); setTemp(25);
        setWhole(true); updateReadouts(0.016);
        R.splitWhole = document.getElementById('vRespSub').textContent;
        setWhole(false); updateReadouts(0.016);
        R.splitLeaf = document.getElementById('vRespSub').textContent;
        setWhole(true);

        /* --- 记录点在条件变化后应变灰 --- */
        setTemp(25); setLight(700); L.record();
        var n0 = L.recordCount();
        setTemp(35);
        R.recKeep = (L.recordCount() === n0);
        R.foot = document.getElementById('chartFoot').textContent;
        setTemp(25);

        /* --- 语音讲解 --- */
        var V = window.__voice;
        R.vExists = !!V;
        if (V) {
          R.vReady = V.ready();
          R.vVoice = V.voiceName();
          R.vTexts = V.texts().length;
          R.vOff = V.on() === false;
          var vb = document.getElementById('btnVoice');
          R.vBtn = vb ? vb.textContent : 'MISSING';
          /* 无中文语音的机器上点开不能崩，只能降级成字幕 */
          vb.click();
          R.vAfterClick = V.on();
          R.vSubShown = !document.getElementById('vsub').hidden;
          R.vSubLen = document.getElementById('vsubTx').textContent.length;
          /* 切题应换一段新稿 */
          var tx = document.getElementById('vsubTx');
          var before = tx.textContent;
          L.setQ(6);
          R.vSwitch = tx.textContent !== before;
          R.vCur = V.current();
          /* 键盘路径也要带朗读：课上老师是按键切题，不是点脚本 */
          var b2 = tx.textContent;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          R.vKeySwitch = tx.textContent !== b2;
          R.vKeyCur = V.current();
          /* 一次点击只读一次：记录按钮不应叠两条 */
          setLight(500);
          L.record();
          R.vRecCue = V.current();
          document.getElementById('vsubStop').click();
          R.vStopCleared = document.getElementById('vsub').hidden;
          vb.click();                     /* 关掉，恢复默认 */
          R.vFinalOff = V.on() === false;
        }

        R.glErr = renderer.getContext().getError();
        R.w = POST.w + 'x' + POST.h;
      } catch (e) {
        R.x = String(e) + ' | ' + (e && e.stack ? String(e.stack).split('\n')[1] : '');
      }
      log(R);
    }, 4000);
  });
})();
