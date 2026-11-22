/* ============================================================
 * 丝网盒子 · 句子拼写练习（整句输入流）
 * ------------------------------------------------------------
 * 数据来源：window.SW_COURSES 四门句子课
 *   koudai（档口一百句）/ whatsapp / planA / planB
 * 玩法：看中文 → 输入框直接打英文，空格切下一个词，
 *       每个词当场判定；全句完成按 Enter 进入下一句。
 * ============================================================ */
(function () {
  'use strict';
  if (!window.SW_COURSES) { return; }

  var COURSES = [
    { id: 'koudai', name: '档口一百句' },
    { id: 'whatsapp', name: 'WhatsApp 一百句' },
    { id: 'planA', name: '30 天句子实战' },
    { id: 'planB', name: '30 天成交话术' }
  ];
  var $ = function (id) { return document.getElementById(id); };
  function cleanWord(w) {
    return String(w).trim().toLowerCase().replace(/\s+/g, ' ').replace(/^[^a-z]+/, '').replace(/[^a-z/'-]+$/, '');
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- 数据收集：每词带 meta ---------- */
  function collect(id) {
    var out = [];
    window.SW_COURSES.list[id].units.forEach(function (u) {
      u.items.forEach(function (it) {
        var words = it.en.split(/\s+/);
        var meta = words.map(function (w) {
          var ans = cleanWord(w);
          return { raw: w, answer: ans, auto: !ans };  // auto = 纯数字/符号，无可拼字母
        });
        out.push({ en: it.en, zh: it.zh, tip: it.tip || '', unit: u.name, words: words, meta: meta });
      });
    });
    return out;
  }

  var state = {
    courseId: 'koudai',
    list: [], idx: 0, wordIdx: 0,
    results: [],               // 每词 {ok, auto}
    rightWords: 0, wrongWords: 0, rightSent: 0, wrongSent: 0, wrongSents: [],
    sentenceDone: false,       // 本句已打完，等待进入下一句
    showCards: true
  };

  function sent() { return state.list[state.idx]; }
  function curMeta() { return sent().meta[state.wordIdx]; }

  /* ---------- 发音（浏览器内置，无需联网） ---------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) { return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  /* ---------- 课程选择 ---------- */
  function renderTabs() {
    var host = $('ss2Tabs');
    host.replaceChildren();
    COURSES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ss2-tab';
      b.textContent = c.name + '（' + collect(c.id).length + ' 句）';
      b.addEventListener('click', function () { startSession(c.id); });
      host.appendChild(b);
    });
  }

  function startSession(courseId) {
    state.courseId = courseId;
    state.list = collect(courseId);
    state.idx = 0;
    state.rightWords = 0; state.wrongWords = 0;
    state.rightSent = 0; state.wrongSent = 0; state.wrongSents = [];
    $('ss2Pick').hidden = true;
    $('ss2Done').hidden = true;
    $('ss2Play').hidden = false;
    renderSentence();
    updateBar();
  }

  /* ---------- 顶部信息 ---------- */
  function updateBar() {
    var total = state.list.length;
    $('ss2Bar').style.width = (total ? state.idx / total * 100 : 0) + '%';
    $('ss2Count').textContent = (state.idx + 1) + ' / ' + total + ' 句';
    var w = state.rightWords + state.wrongWords;
    $('ss2Rate').textContent = w ? ('词正确率 ' + Math.round(state.rightWords / w * 100) + '%') : '';
  }

  function difficulty(n) {
    if (n <= 4) { return '★☆☆ 简单'; }
    if (n <= 7) { return '★★☆ 中等'; }
    return '★★★ 困难';
  }

  /* ---------- 渲染一句 ---------- */
  function renderSentence() {
    var s = sent();
    state.wordIdx = 0;
    state.results = [];
    state.sentenceDone = false;
    $('ss2Unit').textContent = s.unit;
    $('ss2Zh').textContent = s.zh;
    $('ss2Fb').className = 'ss2-feedback';
    $('ss2Fb').innerHTML = '';
    $('ss2Input').value = '';
    $('ss2Input').className = 'ss2-input';
    $('ss2Input').disabled = false;
    $('ss2Send').disabled = false;
    $('ss2Note').innerHTML = '💬 本句 <b>' + s.words.length + '</b> 个词 · 难度 <b>' + difficulty(s.words.length) + '</b> · 纯数字符号自动跳过';
    skipAutoWords();
    renderCards();
    renderDots();
    updateBar();
    focusInput();
  }

  function skipAutoWords() {
    var s = sent();
    while (state.wordIdx < s.words.length && s.meta[state.wordIdx].auto) {
      state.results[state.wordIdx] = { ok: true, auto: true };
      state.wordIdx++;
    }
    return state.wordIdx < s.words.length;
  }

  function renderCards() {
    var host = $('ss2Cards');
    host.replaceChildren();
    var s = sent();
    s.words.forEach(function (w, i) {
      var d = document.createElement('div');
      var m = s.meta[i];
      var r = state.results[i];
      if (m.auto) {
        d.className = 'ss2-wcard auto';
        d.innerHTML = '<span class="lb">自动跳过</span><div class="wd">' + esc(m.raw) + '</div><div class="ph">' + esc(m.raw) + '</div>';
      } else if (i < state.wordIdx && r) {
        d.className = 'ss2-wcard ' + (r.ok ? 'ok' : 'bad');
        d.innerHTML = '<span class="lb">第 ' + (i + 1) + ' 词</span><div class="wd">' + esc(m.raw) + '</div>'
          + '<div class="ph">' + (r.ok ? '✓ 拼对' : '✗ ' + esc(m.answer)) + '</div>';
      } else if (i === state.wordIdx) {
        d.className = 'ss2-wcard cur';
        d.innerHTML = '<span class="lb">正在拼</span><div class="wd">' + esc(m.raw.replace(/\S/g, '·')) + '</div><div class="ph">第 ' + (i + 1) + ' / ' + s.words.length + ' 词</div>';
      } else {
        d.className = 'ss2-wcard';
        d.innerHTML = '<span class="lb">第 ' + (i + 1) + ' 词</span><div class="wd">' + esc(m.raw.replace(/\S/g, '·')) + '</div><div class="ph">待拼</div>';
      }
      host.appendChild(d);
    });
  }

  function renderDots() {
    var host = $('ss2Dots');
    host.replaceChildren();
    var s = sent();
    s.words.forEach(function (w, i) {
      var d = document.createElement('div');
      var r = state.results[i];
      var m = s.meta[i];
      if (m.auto) { d.className = 'ss2-dot ok'; }
      else if (i < state.wordIdx && r) { d.className = 'ss2-dot ' + (r.ok ? 'ok' : 'bad'); }
      else if (i === state.wordIdx) { d.className = 'ss2-dot cur'; }
      else { d.className = 'ss2-dot'; }
      host.appendChild(d);
    });
  }

  function focusInput() {
    var el = $('ss2Input');
    if (el && !el.disabled) { try { el.focus(); } catch (e) {} }
  }

  /* ---------- 提交当前词（空格 / Enter / 按钮） ---------- */
  function submitWord(forceSkip) {
    if (state.sentenceDone) { nextSentence(); return; }
    var s = sent();
    if (state.wordIdx >= s.words.length) { return; }
    var m = curMeta();
    var input = $('ss2Input');
    var val = input.value.trim();
    if (!val && !forceSkip) { return; }
    var ans = m.answer;
    var ok = forceSkip ? false : (cleanWord(val) === ans);

    state.results[state.wordIdx] = { ok: ok, auto: false };
    if (ok) {
      state.rightWords++;
      input.className = 'ss2-input good';
    } else {
      state.wrongWords++;
      input.className = 'ss2-input err';
    }
    renderCards();
    renderDots();
    updateBar();

    // 短暂停顿后进入下一词，让用户看到判定结果
    setTimeout(function () {
      state.wordIdx++;
      input.value = '';
      input.className = 'ss2-input';
      if (!skipAutoWords()) { finishSentence(); return; }
      renderCards();
      renderDots();
      focusInput();
    }, ok ? 320 : 900);
  }

  function finishSentence() {
    state.sentenceDone = true;
    var s = sent();
    var bad = state.results.filter(function (r) { return r && !r.ok && !r.auto; }).length;
    var fb = $('ss2Fb');
    $('ss2Input').disabled = true;
    $('ss2Send').disabled = true;
    if (bad === 0) {
      state.rightSent++;
      fb.className = 'ss2-feedback good show';
      fb.innerHTML = '<b>✓ 全句拼对</b>' + (s.tip ? '<span class="ex">' + esc(s.tip) + '</span>' : '');
      speak(s.en);
    } else {
      state.wrongSent++;
      state.wrongSents.push(s);
      fb.className = 'ss2-feedback bad show';
      fb.innerHTML = '<b>这句错了 ' + bad + ' 个词</b>，原句：<b>' + esc(s.en) + '</b>'
        + (s.tip ? '<span class="ex">' + esc(s.tip) + '</span>' : '');
    }
    updateBar();
    setTimeout(nextSentence, bad === 0 ? 1900 : 3200);
  }

  function nextSentence() {
    state.idx++;
    if (state.idx >= state.list.length) { finish(); return; }
    renderSentence();
  }

  function finish() {
    $('ss2Play').hidden = true;
    $('ss2Done').hidden = false;
    $('ss2DoneTitle').textContent = state.wrongSent === 0 ? '全对，这一组漂亮' : '这一组练完了';
    $('ss2DoneSum').innerHTML = '共 <b>' + state.list.length + '</b> 句 · 全对 <b>' + state.rightSent + '</b> 句 · 有错 <b>' + state.wrongSent + '</b> 句<br>拼对 <b>' + state.rightWords + '</b> 词 · 拼错 <b>' + state.wrongWords + '</b> 词';
    var wl = $('ss2WrongList');
    if (state.wrongSents.length) {
      wl.hidden = false;
      wl.innerHTML = '错句复习：' + state.wrongSents.map(function (s) {
        return '<div style="margin-bottom:6px"><b>' + esc(s.en) + '</b><br><span style="opacity:.75">' + esc(s.zh) + '</span></div>';
      }).join('');
      $('ss2AgainWrong').hidden = false;
    } else {
      wl.hidden = true;
      $('ss2AgainWrong').hidden = true;
    }
  }

  /* ---------- 输入框事件 ---------- */
  $('ss2Input').addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if ($('ss2Input').value.trim()) { submitWord(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // 空着按 Enter = 放弃当前词（算错，看答案过去）
      submitWord(!$('ss2Input').value.trim());
    }
  });
  $('ss2Send').addEventListener('click', function () {
    submitWord(!$('ss2Input').value.trim());
    focusInput();
  });

  /* ---------- 工具栏 ---------- */
  $('ss2Speak').addEventListener('click', function () {
    var s = sent();
    if (state.sentenceDone) { speak(s.en); }
    else if (state.wordIdx < s.words.length) { speak(s.words.slice(0, state.wordIdx + 1).join(' ')); }
    focusInput();
  });
  $('ss2Redo').addEventListener('click', function () {
    renderSentence();
  });
  $('ss2CardsToggle').addEventListener('click', function () {
    state.showCards = !state.showCards;
    $('ss2Cards').classList.toggle('hide', !state.showCards);
    $('ss2CardsToggle').classList.toggle('on', state.showCards);
    focusInput();
  });

  /* ---------- 完成页按钮 ---------- */
  $('ss2AgainAll').addEventListener('click', function () {
    startSession(state.courseId);
  });
  $('ss2AgainWrong').addEventListener('click', function () {
    state.list = shuffle(state.wrongSents);
    state.idx = 0;
    state.rightWords = 0; state.wrongWords = 0;
    state.rightSent = 0; state.wrongSent = 0; state.wrongSents = [];
    $('ss2Done').hidden = true;
    $('ss2Play').hidden = false;
    renderSentence();
    updateBar();
  });

  /* ---------- 全局快捷键（焦点不在输入框时） ---------- */
  document.addEventListener('keydown', function (e) {
    if ($('ss2Play').hidden) { return; }
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) { return; }
    if (e.key === 'j' || e.key === 'J') { $('ss2CardsToggle').click(); }
    else if (e.key === 'Enter') { submitWord(); }
    else if (/^[a-zA-Z/'-]$/.test(e.key)) {
      var el = $('ss2Input');
      el.value += e.key;
      focusInput();
    }
  });
  // 点页面任意处回到输入框
  document.addEventListener('click', function (e) {
    if ($('ss2Play').hidden) { return; }
    if (e.target && /INPUT|TEXTAREA|BUTTON|A/.test(e.target.tagName)) { return; }
    focusInput();
  });

  /* ---------- 启动 ---------- */
  renderTabs();
  var preset = new URLSearchParams(location.search).get('c');
  if (preset && window.SW_COURSES.list[preset]) { startSession(preset); }
})();
