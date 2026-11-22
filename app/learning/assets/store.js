/* ============================================================
 * 丝网盒子 · 丝网英语学习 —— 数据存储层
 * ------------------------------------------------------------
 * 当前实现：浏览器本地存储（localStorage），数据存在你自己的
 * 浏览器里。换电脑 / 换手机 / 清缓存会看不到，这是本地版的
 * 固有限制。
 *
 * 对外接口全部返回 Promise —— 这是刻意设计：将来若要接云端
 * 账号（跨设备同步），只需要替换本文件内部的实现，所有页面
 * 代码一行都不用改。
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'siwang-english-v1';
  var listeners = [];

  function blank() {
    return { progress: {}, favs: {}, checkins: {} };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var d = JSON.parse(raw) || {};
      return {
        progress: d.progress || {},
        favs: d.favs || {},
        checkins: d.checkins || {}
      };
    } catch (e) {
      // Desktop adapter already shows the persistence error; never treat it as an empty record.
      throw e;
    }
  }

  function write(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {
      // Desktop writes are transactional; callers must observe failure.
      throw e;
    }
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](d); } catch (e) {}
    }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function shiftDay(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }

  // ---------- 进度 ----------
  function pSet(courseId, itemId, on) {
    var d = read();
    if (!d.progress[courseId]) d.progress[courseId] = {};
    if (on) d.progress[courseId][itemId] = 1;
    else delete d.progress[courseId][itemId];
    write(d);
    return on;
  }

  function pGet(courseId) {
    return read().progress[courseId] || {};
  }

  // ---------- 收藏 ----------
  function fToggle(courseId, itemId) {
    var d = read();
    if (!d.favs[courseId]) d.favs[courseId] = {};
    var now;
    if (d.favs[courseId][itemId]) {
      delete d.favs[courseId][itemId];
      now = false;
    } else {
      d.favs[courseId][itemId] = 1;
      now = true;
    }
    write(d);
    return now;
  }

  // ---------- 打卡 ----------
  function markToday() {
    var d = read();
    var k = dateKey();
    if (!d.checkins[k]) {
      d.checkins[k] = 1;
      write(d);
      return true;
    }
    return false;
  }

  function streak(dates) {
    var n = 0;
    // 今天没学，从昨天开始算；今天学了就从今天算
    var start = dates[dateKey()] ? 0 : -1;
    for (var i = start; i > -400; i--) {
      if (dates[shiftDay(i)]) n++;
      else break;
    }
    return n;
  }

  var api = {
    ready: function () { return Promise.resolve(); },

    /* ---- 学习进度 ---- */
    getProgress: function (courseId) {
      return Promise.resolve(pGet(courseId));
    },
    getAllProgress: function () {
      return Promise.resolve(read().progress);
    },
    isDone: function (courseId, itemId) {
      return Promise.resolve(!!pGet(courseId)[itemId]);
    },
    setDone: function (courseId, itemId, on) {
      return Promise.resolve(pSet(courseId, itemId, on !== false));
    },
    // 标记掌握；若开启则自动打卡
    markLearned: function (courseId, itemId) {
      pSet(courseId, itemId, true);
      markToday();
      return Promise.resolve(true);
    },
    // 某课程已完成条数
    countDone: function (courseId) {
      return Promise.resolve(Object.keys(pGet(courseId)).length);
    },
    // 全部已完成条数
    countAllDone: function () {
      var p = read().progress, n = 0;
      for (var c in p) if (p.hasOwnProperty(c)) n += Object.keys(p[c]).length;
      return Promise.resolve(n);
    },
    resetCourse: function (courseId) {
      var d = read();
      delete d.progress[courseId];
      write(d);
      return Promise.resolve(true);
    },
    clearAll: function () {
      write(blank());
      return Promise.resolve(true);
    },

    /* ---- 收藏 ---- */
    isFav: function (courseId, itemId) {
      var f = read().favs[courseId] || {};
      return Promise.resolve(!!f[itemId]);
    },
    toggleFav: function (courseId, itemId) {
      return Promise.resolve(fToggle(courseId, itemId));
    },
    getFavs: function (courseId) {
      return Promise.resolve(read().favs[courseId] || {});
    },
    // 返回 [{ course, item }]
    listFavs: function () {
      var f = read().favs, out = [];
      for (var c in f) {
        if (!f.hasOwnProperty(c)) continue;
        for (var i in f[c]) {
          if (f[c].hasOwnProperty(i)) out.push({ course: c, item: i });
        }
      }
      return Promise.resolve(out);
    },
    countFavs: function () {
      return api.listFavs().then(function (l) { return l.length; });
    },

    /* ---- 打卡 ---- */
    checkinToday: function () { return Promise.resolve(markToday()); },
    getCheckins: function () { return Promise.resolve(read().checkins); },
    hasCheckin: function (dateStr) {
      return Promise.resolve(!!read().checkins[dateStr || dateKey()]);
    },
    getStreak: function () { return Promise.resolve(streak(read().checkins)); },
    countCheckins: function () {
      return Promise.resolve(Object.keys(read().checkins).length);
    },

    /* ---- 工具 ---- */
    todayKey: dateKey,
    dayKey: function (offset) { return shiftDay(offset); },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };

  // Preserve the Promise API even if a synchronous bridge read/write throws.
  Object.keys(api).forEach(function(name){
    if(['todayKey','dayKey','onChange'].indexOf(name)>=0)return;
    var original=api[name];
    api[name]=function(){var args=arguments;return Promise.resolve().then(function(){return original.apply(api,args);});};
  });
  window.SWStore = api;
})();
