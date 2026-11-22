/* ============================================================
 * 丝网盒子 · 单词拼写练习（整词输入流）
 * ------------------------------------------------------------
 * 数据来源：window.SW_COURSES.list.words（丝网规格高频单词课）
 * 交互：看中文 → 输入框直接打英文，按 Enter 提交。
 * 进度：localStorage（sw-spell-mastered / sw-spell-wrong）
 * ============================================================ */
(function () {
  'use strict';
  if (!window.SW_COURSES || !window.SW_COURSES.list.words) { return; }

  var WORDS = [];
  window.SW_COURSES.list.words.units.forEach(function (u) {
    u.items.forEach(function (it) {
      WORDS.push({ id: it.id, en: it.en, ph: it.ph || '', zh: it.zh, pos: it.pos || '', ex: it.ex || '', exZh: it.exZh || '', unit: u.name });
    });
  });

  var KEY_MASTERED = 'sw-spell-mastered';
  var KEY_WRONG = 'sw-spell-wrong';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function cleanVal(v) {
    return String(v).trim().toLowerCase().replace(/\s+/g, ' ').replace(/^[^a-z]+/, '').replace(/[^a-z/'-]+$/, '');
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }

  var mastered = load(KEY_MASTERED, []);   // [id]
  var wrongMap = load(KEY_WRONG, {});      // id -> 次数

  var state = {
    queue: [], idx: 0,
    locked: false,       // 反馈中，锁输入
    right: 0, wrong: 0, wrongIds: []
  };

  function current() { return state.queue[state.idx]; }
  function answerOf(w) { return w.en.toLowerCase(); }

  function speak(text) {
    if (!('speechSynthesis' in window)) { return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  function startSession(list) {
    state.queue = list;
    state.idx = 0;
    state.right = 0;
    state.wrong = 0;
    state.wrongIds = [];
    $('spDone').hidden = true;
    $('spPlay').hidden = false;
    renderQuestion();
    updateBar();
  }

  function updateBar() {
    var total = state.queue.length;
    $('spBar').style.width = (total ? state.idx / total * 100 : 0) + '%';
    $('spCount').textContent = Math.min(state.idx + 1, total) + ' / ' + total;
    var answered = state.right + state.wrong;
    $('spRate').textContent = answered ? ('正确率 ' + Math.round(state.right / answered * 100) + '%') : '';
    $('spMastered').textContent = mastered.length;
    $('spTotal').textContent = WORDS.length;
  }

  function renderQuestion() {
    var w = current();
    if (!w) { return; }
    state.locked = false;
    $('spZh').textContent = w.zh;
    $('spPos').textContent = w.pos;
    var ph = $('spPh');
    ph.textContent = w.ph ? w.ph : '（无音标）';
    ph.classList.add('hidden');
    $('spNote').innerHTML = '📖 <b>' + esc(w.unit) + '</b> · 共 ' + WORDS.length + ' 词 · 已掌握 <b>' + mastered.length + '</b>';
    $('spInput').value = '';
    $('spInput').className = 'sp-input';
    $('spInput').disabled = false;
    $('spSend').disabled = false;
    var fb = $('spFb');
    fb.className = 'sp-feedback';
    fb.innerHTML = '';
    updateBar();
    focusInput();
  }

  function focusInput() {
    var el = $('spInput');
    if (el && !el.disabled) { try { el.focus(); } catch (e) {} }
  }

  function submit() {
    if (state.locked) { return; }
    var w = current();
    var ans = answerOf(w);
    var input = $('spInput');
    var val = input.value;
    if (!val.trim()) { return; }
    var ok = cleanVal(val) === ans;
    state.locked = true;
    $('spInput').disabled = true;
    $('spSend').disabled = true;
    $('spPh').classList.remove('hidden');

    if (ok) {
      state.right++;
      if (mastered.indexOf(w.id) === -1) { mastered.push(w.id); save(KEY_MASTERED, mastered); }
      input.className = 'sp-input good';
      $('spFb').className = 'sp-feedback good show';
      $('spFb').innerHTML = '<b>✓ 拼对了</b>' + (w.ex ? '<span class="ex">' + esc(w.ex) + '<br>' + esc(w.exZh) + '</span>' : '');
      speak(w.en);
    } else {
      state.wrong++;
      state.wrongIds.push(w.id);
      wrongMap[w.id] = (wrongMap[w.id] || 0) + 1; save(KEY_WRONG, wrongMap);
      var mi = mastered.indexOf(w.id); if (mi !== -1) { mastered.splice(mi, 1); save(KEY_MASTERED, mastered); }
      input.className = 'sp-input err';
      $('spFb').className = 'sp-feedback bad show';
      $('spFb').innerHTML = '<b>✗ 拼错了</b>，正确拼写是 <b>' + esc(w.en) + '</b>' + (w.ex ? '<span class="ex">' + esc(w.ex) + '<br>' + esc(w.exZh) + '</span>' : '');
    }
    updateBar();
    setTimeout(next, ok ? 1500 : 2800);
  }

  function next() {
    state.idx++;
    if (state.idx >= state.queue.length) { finish(); return; }
    renderQuestion();
  }

  function finish() {
    $('spPlay').hidden = true;
    $('spDone').hidden = false;
    $('spDoneTitle').textContent = state.wrong === 0 ? '全对，这一轮漂亮' : '这一轮练完了';
    $('spDoneSum').innerHTML = '共 <b>' + state.queue.length + '</b> 词 · 拼对 <b>' + state.right + '</b> · 拼错 <b>' + state.wrong + '</b><br>累计掌握 <b>' + mastered.length + '</b> / ' + WORDS.length + ' 词';
    var wl = $('spWrongList');
    if (state.wrongIds.length) {
      wl.hidden = false;
      var byId = {};
      WORDS.forEach(function (w) { byId[w.id] = w; });
      wl.innerHTML = '本轮错词：' + state.wrongIds.map(function (id) { return '<b>' + esc(byId[id].en) + '</b> ' + esc(byId[id].zh); }).join('、');
      $('spAgainWrong').hidden = false;
    } else {
      wl.hidden = true;
      $('spAgainWrong').hidden = true;
    }
  }

  /* ---------- 输入框 ---------- */
  $('spInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  $('spSend').addEventListener('click', function () { submit(); focusInput(); });

  /* ---------- 工具栏 ---------- */
  $('spSpeak').addEventListener('click', function () {
    speak(current().en);
    focusInput();
  });
  $('spHint').addEventListener('click', function () {
    if (state.locked) { return; }
    var w = current();
    $('spPh').classList.remove('hidden');
    // 填入第一个字母（已有内容则不覆盖）
    if (!$('spInput').value) { $('spInput').value = w.en[0]; }
    focusInput();
  });
  $('spSkip').addEventListener('click', function () {
    if (state.locked) { return; }
    var w = current();
    state.locked = true;
    $('spInput').disabled = true;
    $('spSend').disabled = true;
    $('spInput').value = w.en;
    $('spInput').className = 'sp-input err';
    $('spPh').classList.remove('hidden');
    state.wrong++;
    state.wrongIds.push(w.id);
    wrongMap[w.id] = (wrongMap[w.id] || 0) + 1; save(KEY_WRONG, wrongMap);
    var mi = mastered.indexOf(w.id); if (mi !== -1) { mastered.splice(mi, 1); save(KEY_MASTERED, mastered); }
    $('spFb').className = 'sp-feedback bad show';
    $('spFb').innerHTML = '<b>正确答案：' + esc(w.en) + '</b>' + (w.ex ? '<span class="ex">' + esc(w.ex) + '<br>' + esc(w.exZh) + '</span>' : '');
    updateBar();
    setTimeout(next, 2600);
  });

  /* ---------- 完成页 ---------- */
  $('spAgainAll').addEventListener('click', function () { startSession(shuffle(WORDS)); });
  $('spAgainWrong').addEventListener('click', function () {
    var byId = {};
    WORDS.forEach(function (w) { byId[w.id] = w; });
    startSession(shuffle(state.wrongIds.map(function (id) { return byId[id]; })));
  });

  /* ---------- 点页面任意处回到输入框 ---------- */
  document.addEventListener('click', function (e) {
    if ($('spPlay').hidden) { return; }
    if (e.target && /INPUT|TEXTAREA|BUTTON|A/.test(e.target.tagName)) { return; }
    focusInput();
  });

  /* ---------- 开练 ---------- */
  startSession(shuffle(WORDS));
})();
