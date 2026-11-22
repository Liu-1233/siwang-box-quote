/* ============================================================
 * 丝网盒子 · 丝网英语学习 —— 学习页逻辑
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var qs = new URLSearchParams(location.search);
  var courseId = qs.get('c') || 'koudai';
  var course = (window.SW_COURSES && window.SW_COURSES.list[courseId]) || null;

  if (!course) {
    $('.ln-main').innerHTML = '<div class="empty">没找到这门课。<br><br><a href="index.html">← 回到课程中心</a></div>';
    return;
  }

  /* ---------- 展平成一维，方便上一句 / 下一句 ---------- */
  var flat = [];
  course.units.forEach(function (u, ui) {
    u.items.forEach(function (it, ii) { flat.push({ ui: ui, ii: ii, item: it }); });
  });

  var total = flat.length;
  var cur = 0;
  var progress = {};
  var favs = {};
  var voice = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 浏览器朗读（免费，不用后端） ---------- */
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    var vs = window.speechSynthesis.getVoices() || [];
    var en = vs.filter(function (v) { return /^en/i.test(v.lang); });
    if (!en.length) return;
    var prefer = ['Google US English', 'Microsoft Aria', 'Microsoft Zira', 'Samantha', 'Karen'];
    for (var i = 0; i < prefer.length; i++) {
      for (var j = 0; j < en.length; j++) {
        if (en[j].name.indexOf(prefer[i]) > -1) { voice = en[j]; return; }
      }
    }
    voice = en[0];
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, slow) {
    if (!('speechSynthesis' in window)) {
      alert('这个浏览器不支持朗读，换 Chrome 或 Edge 试试。');
      return;
    }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = slow ? 0.62 : 0.9;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }

  /* ---------- 渲染 ---------- */
  function unitDoneCount(ui) {
    var n = 0;
    course.units[ui].items.forEach(function (it) { if (progress[it.id]) n++; });
    return n;
  }

  function renderChips() {
    var html = '';
    course.units.forEach(function (u, i) {
      var done = unitDoneCount(i);
      var all = u.items.length > 0 && done === u.items.length;
      html += '<button class="unit-chip' + (i === flat[cur].ui ? ' on' : '') + '" data-ui="' + i + '">'
        + esc(u.name) + (all ? '<i class="dot"></i>' : '') + '</button>';
    });
    var box = $('#unit-bar-in');
    box.innerHTML = html;
    var on = box.querySelector('.unit-chip.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function renderCard() {
    var it = flat[cur].item;
    var unit = course.units[flat[cur].ui];
    var idxInUnit = flat[cur].ii + 1;
    var isWord = course.type === 'word';
    var isFav = !!favs[it.id];
    var isDone = !!progress[it.id];

    var favBtn = '<button class="btn-speak' + (isFav ? ' star' : '') + '" data-fav="'
      + esc(it.id) + '">' + (isFav ? '已收藏' : '收藏') + '</button>';

    var body = '<div class="card-pos">' + esc(unit.name) + ' · ' + idxInUnit + ' / ' + unit.items.length + '</div>';

    if (isWord) {
      body += '<div class="word-line">'
        + '<span class="word-en">' + esc(it.en) + '</span>'
        + (it.ph ? '<span class="word-ph">' + esc(it.ph) + '</span>' : '')
        + (it.pos ? '<span class="word-pos">' + esc(it.pos) + '</span>' : '')
        + '</div>';
      body += '<div class="zh-line">' + esc(it.zh) + '</div>';
      body += '<div class="speak-row">'
        + '<button class="btn-speak" id="btn-speak" data-say="' + esc(it.en) + '">读单词</button>'
        + (it.ex ? '<button class="btn-speak" data-say="' + esc(it.ex) + '">读例句</button>' : '')
        + '<button class="btn-speak" data-copy="' + esc(it.en) + '">复制</button>'
        + favBtn
        + '</div>';
      if (it.ex) {
        body += '<div class="ex-box"><span class="en">' + esc(it.ex) + '</span><br>' + esc(it.exZh || '') + '</div>';
      }
    } else {
      body += '<div class="en-line">' + esc(it.en) + '</div>';
      body += '<div class="zh-line">' + esc(it.zh) + '</div>';
      body += '<div class="speak-row">'
        + '<button class="btn-speak" id="btn-speak" data-say="' + esc(it.en) + '">读给客户听</button>'
        + '<button class="btn-speak" data-say="' + esc(it.en) + '" data-slow="1">慢速跟读</button>'
        + '<button class="btn-speak" data-copy="' + esc(it.en) + '">复制这句</button>'
        + favBtn
        + '</div>';
      if (it.tip) body += '<div class="tip-box"><b>什么时候用：</b>' + esc(it.tip) + '</div>';
    }

    $('#card-box').innerHTML = body;

    var main = $('#btn-mark');
    main.textContent = isDone ? '已掌握' : '我记住了';
    main.className = 'ab-btn main' + (isDone ? ' done' : '');
    $('#btn-prev').disabled = cur === 0;
    $('#btn-next').disabled = cur === total - 1;

    var doneAll = Object.keys(progress).length;
    $('#ln-title').textContent = course.title;
    $('#ln-count').textContent = doneAll + ' / ' + total;
    $('#ln-bar').style.width = (total ? (doneAll / total * 100) : 0) + '%';
  }

  function render() { renderChips(); renderCard(); }

  function go(n) {
    if (n < 0 || n >= total) return;
    cur = n;
    history.replaceState(null, '', 'learn.html?c=' + courseId + '&u=' + flat[cur].ui);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('.unit-chip');
    if (chip) {
      var ui = +chip.dataset.ui;
      var first = -1;
      for (var i = 0; i < flat.length; i++) { if (flat[i].ui === ui) { first = i; break; } }
      if (first >= 0) go(first);
      return;
    }

    var fb = e.target.closest('[data-fav]');
    if (fb) {
      var fid = fb.dataset.fav;
      SWStore.toggleFav(courseId, fid).then(function (on) {
        if (on) favs[fid] = 1; else delete favs[fid];
        renderCard();
      });
      return;
    }

    var sp = e.target.closest('.btn-speak');
    if (sp) {
      if (sp.dataset.copy !== undefined) {
        var txt = sp.dataset.copy;
        var done = function () {
          var old = sp.textContent;
          sp.textContent = '已复制';
          setTimeout(function () { sp.textContent = old; }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(done).catch(function () { alert('复制失败，手动选一下文字'); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = txt; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (err) { alert('复制失败，手动选一下文字'); }
          document.body.removeChild(ta);
        }
      } else if (sp.dataset.say) {
        speak(sp.dataset.say, sp.dataset.slow === '1');
      }
      return;
    }
  });

  $('#btn-prev').addEventListener('click', function () { go(cur - 1); });
  $('#btn-next').addEventListener('click', function () { go(cur + 1); });

  $('#btn-mark').addEventListener('click', function () {
    var id = flat[cur].item.id;
    if (progress[id]) {
      delete progress[id];
      SWStore.setDone(courseId, id, false).then(render);
    } else {
      progress[id] = 1;
      SWStore.markLearned(courseId, id).then(function () {
        render();
        if (cur < total - 1) setTimeout(function () { go(cur + 1); }, 280);
        else setTimeout(function () {
          alert('这门课全部学完了。\n\n去「我的收藏」复习一下，或者换门课继续。');
        }, 260);
      });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') go(cur - 1);
    if (e.key === 'ArrowRight') go(cur + 1);
    if (e.key === ' ') { e.preventDefault(); var b = $('#btn-speak'); if (b) speak(b.dataset.say); }
  });

  var tx = 0, ty = 0;
  document.addEventListener('touchstart', function (e) {
    tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      go(dx < 0 ? cur + 1 : cur - 1);
    }
  }, { passive: true });

  /* ---------- 启动 ---------- */
  Promise.all([SWStore.getProgress(courseId), SWStore.getFavs(courseId)]).then(function (r) {
    progress = r[0] || {};
    favs = r[1] || {};

    var ui = qs.get('u');
    if (ui !== null && course.units[+ui]) {
      cur = 0;
      for (var i = 0; i < flat.length; i++) { if (flat[i].ui === +ui) { cur = i; break; } }
    } else {
      var firstUndone = -1;
      for (var j = 0; j < flat.length; j++) { if (!progress[flat[j].item.id]) { firstUndone = j; break; } }
      cur = firstUndone >= 0 ? firstUndone : 0;
    }
    render();
    history.replaceState(null, '', 'learn.html?c=' + courseId + '&u=' + flat[cur].ui);
  });
})();
