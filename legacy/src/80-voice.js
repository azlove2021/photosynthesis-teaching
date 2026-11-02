/* =========================================================
   80 · 语音讲解（离线）
   ---------------------------------------------------------
   课上真正的痛点：老师一边讲一边操作鼠标，手不够用；
   学生自己复习时，光看文字又抓不住重点。
   这里用浏览器**自带**的语音合成（speechSynthesis），
   不联网、不调云服务，符合"双击即开、教室断网也能用"的前提。

   设计上三条：
   ① 默认**关**。教室突然出声很尴尬，必须老师主动点开。
   ② 开启后"跟着操作走"：切题、记录、展开化学式，各自读对应的那段，
      不需要老师再去点一次播放。
   ③ 全程有字幕。一是投影时后排听不清，二是万一机器没装中文语音，
      功能降级成字幕，课照样能上——这是必须留的后路。
   ========================================================= */
'use strict';

(function () {

  /* ---------- 讲解稿 ----------
     语气按"老师当堂讲话"写，不是念课文：
     短句、有停顿、每段只推进一个结论。
     数字尽量写成口语（"两个多"），因为 TTS 念 "2.1" 常常吞掉小数点。 */
  var SCRIPT = {
    q1: '先别急着说光合作用。屏幕上其实是五条流：氧气往上飘，是叶片放出来的；'
      + '二氧化碳往下沉，被叶子吸进去；水从根沿着茎往上走；有机物从叶子往下走；'
      + '还有一条从整株往外冒的二氧化碳，那是呼吸。方向都不一样，说明这是两件事。',
    q2: '在光合，它也在呼吸。光下它一边造有机物，一边还在烧有机物，两件事同时开，谁也不停。'
      + '你把灯关掉，光合停了，呼吸不停。右边那个负号就是证据。',
    q3: '不能。传感器测到的是净值，是箱子里真正少掉的那一部分。'
      + '制造出来的总量里，有一份当场就被呼吸吃掉了，你根本看不见。要算总账，必须把被吃掉的那份加回去。',
    q4: '光也是光合的原料，没有光，光反应停，整条链子就断了，所以总光合是零。'
      + '但呼吸不靠光，它烧的是现成的有机物，所以照常进行，读数还是负的两个多。',
    q5: '对应的是箱内二氧化碳在升高。因为此刻植物放出的比吸收的多，多出来的就堆在箱子里。'
      + '负号不代表没有光合，只代表支出大于收入。',
    q6: '因为它造得还不够多。光太弱，总光合还追不上呼吸，净值仍然是负的，箱子当然继续升。'
      + '等光强越过补偿点，读数才会停住，然后往回走。',
    q7: '因为两笔账正好抵平：造多少、烧多少，一样多。植物在忙，只是进出相等，'
      + '所以传感器看不出变化。这个光强，就叫光补偿点。',
    q8: '零线附近那一小段。曲线穿过零线的地方，读数不动。注意，不是植物停了，是两件事打平了。',
    q9: '会移动。温度升到三十五度，呼吸按十度翻倍的规律涨上去，支出变大，'
      + '要更多的光才追得平，所以补偿点往右移。记住一句：补偿点由呼吸决定，呼吸由温度决定。',
    q10: '因为瓶颈换了。光已经够多，卡住它的是暗反应的速度，是酶的数量和二氧化碳的供应。'
      + '再加光，多出来的那部分用不上，只会变成热。',
    q11: '没有停。两条曲线之间的高度差一直存在，那个差就是呼吸。'
      + '你把光开到最大，呼吸还是两个多，一点没变。呼吸只看温度，不看光。',
    q12: '黑暗里总光合是零，净光合等于零减呼吸，也就是负的呼吸。'
      + '所以黑瓶测到的那个数，直接就是呼吸速率，不用换算。',
    q13: '白瓶测到的还是净值，光合减呼吸。黑瓶就算放在光下也没用，它照样只呼吸。'
      + '两个一减，呼吸被抵消掉，剩下的才是总光合。',
    q14: '没有一种方法能直接测到总光合。黑白瓶、半叶法、叶圆片上浮，测到的都是净值，'
      + '只是有的顺带把呼吸也测了，可以相减还原。总光合永远是算出来的。',
    q15: '低下去的是根和茎的呼吸。它们只呼吸、不光合，只花钱不挣钱，'
      + '所以整株的净收入一定比叶片少。差的那一块，就是这部分呼吸。',
    q16: '题干写植物，就是整株；写叶片，才是叶片。这两个数不一样，差的就是根茎呼吸。'
      + '做题时先圈出主语，再看它问的是净光合还是总光合。',

    record: '记下一组。这一点的光强和净值已经钉在曲线上了，等一下你拖到别处，它不会跟着动。'
      + '测出来的东西，不该随条件改。',
    chem: '这里可以把方程式摊开看。光合的还原氢写 NADPH，呼吸写 [H]，别混。'
      + '能量那两个数字要背：两千八百七十千焦，其中一千一百六十一千焦存进了 ATP。',
  };

  /* ---------- 状态 ---------- */
  var S = {
    on: false,
    ready: false,
    voice: null,
    rate: 0.95,
    cur: null,
    timer: 0
  };

  var synth = (typeof window !== 'undefined' && window.speechSynthesis) ? window.speechSynthesis : null;

  /* ---------- DOM ---------- */
  var btn = null, sub = null, subTx = null, subStop = null;
  var curQ = function () {
    return (typeof window.__lesson !== 'undefined' && window.__lesson.index) ? window.__lesson.index() : 0;
  };

  function buildUI() {
    btn = document.getElementById('btnVoice');
    sub = document.getElementById('vsub');
    subTx = document.getElementById('vsubTx');
    subStop = document.getElementById('vsubStop');
    if (subStop) subStop.addEventListener('click', function () { stop(); });
    /* 「记录此刻」「化学式」的朗读由 60/70 里的 sayCue 发出，
       这里不再重复挂监听，否则一次点击会被读两遍。 */
    if (btn) btn.addEventListener('click', function () {
      if (S.on) { setOn(false); }
      else if (!S.ready) {
        /* 没装中文语音时不要假装能读：说出实情，然后把字幕这条路接上。
           注意 S.on 仍然是 true —— 讲解是"开着"的，只是发声降级成字幕。 */
        setOn(true, true);
        setSub('本机没有可用的中文语音，讲解改用字幕：切题、记录、展开化学式时会显示对应讲解。');
        clearTimeout(S.timer);
        S.timer = setTimeout(function () { if (!S.cur) setSub(''); }, 6000);
      } else {
        setOn(true);
      }
    });
  }

  /* ---------- 语音选择 ---------- */
  function pickVoice() {
    if (!synth) return;
    var vs;
    try { vs = synth.getVoices() || []; } catch (e) { vs = []; }
    if (!vs.length) return;                       /* 还没有加载完，等 voiceschanged */
    var zh = [];
    for (var i = 0; i < vs.length; i++) {
      if (/^zh/i.test(vs[i].lang || '')) zh.push(vs[i]);
    }
    if (!zh.length) {
      S.ready = false;
      if (btn) {
        btn.title = '本机未安装中文语音包；讲解将以字幕形式显示';
      }
      paintBtn();
      return;
    }
    var pref = ['Xiaoxiao', 'Huihui', 'Yaoyao', 'Kangkang', 'Female', '女'];
    S.voice = zh[0];
    for (var k = 0; k < pref.length; k++) {
      for (var j = 0; j < zh.length; j++) {
        if ((zh[j].name || '').indexOf(pref[k]) >= 0) { S.voice = zh[j]; k = pref.length; break; }
      }
    }
    S.ready = true;
    if (btn) {
      btn.title = '语音讲解（V）· 当前音色：' + S.voice.name;
    }
    paintBtn();
  }
  if (synth) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
    else synth.onvoiceschanged = pickVoice;
    /* 有些实现首次 getVoices 为空，隔一会儿再试一次 */
    setTimeout(pickVoice, 400);
  }

  /* ---------- 字幕 ---------- */
  function setSub(txt) {
    if (!sub || !subTx) return;
    if (txt) {
      subTx.textContent = txt;
      sub.hidden = false;
    } else {
      sub.hidden = true;
      subTx.textContent = '';
    }
  }

  function stop() {
    if (synth) { try { synth.cancel(); } catch (e) { } }
    S.cur = null;
    clearTimeout(S.timer);
    setSub('');
    if (btn && S.on) btn.classList.remove('speaking');
  }

  /* ---------- 朗读 ---------- */
  function say(key) {
    var txt = SCRIPT[key];
    if (!txt) return;
    /* 字幕永远给：即使语音可用，后排也要看得见 */
    setSub(txt);
    S.cur = key;
    if (!S.ready || !synth) return;

    try { synth.cancel(); } catch (e) { }
    var u = new SpeechSynthesisUtterance(txt);
    u.lang = 'zh-CN';
    if (S.voice) u.voice = S.voice;
    u.rate = S.rate;
    u.pitch = 1.0;
    u.onend = function () {
      if (S.cur !== key) return;                 /* 已被新的朗读顶掉 */
      setSub('');
      S.cur = null;
      if (btn) btn.classList.remove('speaking');
    };
    u.onerror = function () {
      /* 语音报错不影响上课：字幕已经显示了 */
      if (btn) btn.classList.remove('speaking');
    };
    if (btn) btn.classList.add('speaking');
    /* 同一时刻只留一条，避免"上一句还没念完就切题"叠音 */
    setTimeout(function () { try { synth.speak(u); } catch (e) { } }, 30);
  }

  /* 按钮文字只有一个来源，免得三处各写一套、状态对不上 */
  function paintBtn() {
    if (!btn) return;
    btn.classList.toggle('on', S.on);
    btn.textContent = S.on ? (S.ready ? '讲解中' : '讲解中（字幕）')
                           : (S.ready ? '讲解' : '讲解（无中文语音）');
  }

  function setOn(v, silent) {
    S.on = !!v;
    paintBtn();
    if (!S.on) {
      /* 关掉时若正在读，直接掐掉；字幕也收起来 */
      if (S.cur) stop();
      else setSub('');
    } else if (!silent) {
      say('q' + (curQ() + 1));
    }
    try { localStorage.setItem('ps_voice_on', S.on ? '1' : '0'); } catch (e) { }
  }

  /* ---------- 把"操作"接上讲解 ----------
     早先的做法是在 window 上包一层 setQ / recordPoint / toggleChem。
     这个办法靠不住：60/70 里的按钮和键盘回调拿的是**局部函数引用**，
     外层 patch 改不到它们，于是"点按钮会读、按方向键不读"。
     现在反过来——由操作侧主动叫号（60-ui / 70-lesson 里调 window.sayCue），
     一条路径只发一次，不会叠音，也不会漏。 */
  window.sayCue = function (key) {
    if (!S.on) return;
    say(key);
  };

  /* ---------- 键位 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && ae.type !== 'range'))) return;
    var k = e.key;
    if (k === 'v' || k === 'V') {
      if (S.on) setOn(false); else setOn(true);
    }
    /* 空格在本页是"复位"，所以停止用 Esc —— 上课掐掉一句读错的话要够快 */
    else if (k === 'Escape') { if (S.cur) stop(); }
  });

  /* ---------- 启动 ---------- */
  buildUI();
  /* buildUI 之前 pickVoice 可能已经跑过一轮（那时 button 还没接上），
     这里补一次重绘，把音色名和按钮文字对齐。 */
  paintBtn();
  if (btn && S.voice) btn.title = '语音讲解（V）· 当前音色：' + S.voice.name;
  /* 上次开着就还开着：老师一般一节课都开着，不想每页都点一次 */
  try {
    if (localStorage.getItem('ps_voice_on') === '1') {
      setTimeout(function () { setOn(true, true); }, 600);
    }
  } catch (e) { }

  /* 暴露给验证脚本 */
  window.__voice = {
    on: function () { return S.on; },
    ready: function () { return S.ready; },
    voiceName: function () { return S.voice ? S.voice.name : ''; },
    say: say,
    stop: stop,
    texts: function () { return Object.keys(SCRIPT); },
    current: function () { return S.cur; }
  };
})();
