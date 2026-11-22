/* User-maintained vocabulary. Stored through the desktop transactional bridge. */
(function () {
  'use strict';
  var KEY = 'sw-custom-words-v1';
  var UNIT_NAME = '我的单词';
  var MAX_WORDS = 500;

  function clean(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
  function normalized(value) { return clean(value, 120).toLowerCase().replace(/\s+/g, ' '); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function read() {
    var raw = localStorage.getItem(KEY);
    if (!raw) return [];
    var value = JSON.parse(raw);
    if (!Array.isArray(value)) throw Error('自定义单词数据无法识别');
    return value;
  }

  function write(words) {
    localStorage.setItem(KEY, JSON.stringify(words));
    applyToCourse(words);
    window.dispatchEvent(new CustomEvent('sw-custom-words-change', { detail: { count: words.length } }));
  }

  function builtInDuplicate(en) {
    var course = window.SW_COURSES && window.SW_COURSES.list && window.SW_COURSES.list.words;
    if (!course) return null;
    var key = normalized(en), found = null;
    course.units.forEach(function (unit) {
      if (unit.name === UNIT_NAME) return;
      unit.items.forEach(function (item) { if (!found && normalized(item.en) === key) found = item; });
    });
    return found;
  }

  function applyToCourse(words) {
    var course = window.SW_COURSES && window.SW_COURSES.list && window.SW_COURSES.list.words;
    if (!course) return;
    course.units = course.units.filter(function (unit) { return unit.name !== UNIT_NAME; });
    if (words.length) course.units.push({ name: UNIT_NAME, items: clone(words) });
  }

  function validateDraft(draft) {
    var word = {
      en: clean(draft.en, 120), zh: clean(draft.zh, 200), ph: clean(draft.ph, 120),
      pos: clean(draft.pos, 40), ex: clean(draft.ex, 500), exZh: clean(draft.exZh, 500), tip: clean(draft.tip, 500)
    };
    if (!word.en) throw Error('请填写英文单词或词组');
    if (!word.zh) throw Error('请填写中文释义');
    if (!/^[A-Za-z][A-Za-z0-9 .,'’()\-\/&+]*$/.test(word.en)) throw Error('英文内容含不支持的字符');
    return word;
  }

  function save(draft, editingId) {
    var words = read(), value = validateDraft(draft), key = normalized(value.en);
    var duplicate = builtInDuplicate(value.en);
    if (duplicate) throw Error('固定词库里已经有“' + duplicate.en + '”');
    var other = words.find(function (item) { return item.id !== editingId && normalized(item.en) === key; });
    if (other) throw Error('我的单词里已经有“' + other.en + '”');
    var now = new Date().toISOString();
    if (editingId) {
      var index = words.findIndex(function (item) { return item.id === editingId; });
      if (index < 0) throw Error('要编辑的单词不存在');
      words[index] = Object.assign({}, words[index], value, { updatedAt: now });
    } else {
      if (words.length >= MAX_WORDS) throw Error('我的单词最多保存 ' + MAX_WORDS + ' 条');
      value.id = 'cw-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      value.createdAt = now; value.updatedAt = now;
      words.unshift(value);
    }
    write(words);
    return editingId || value.id;
  }

  function remove(id) {
    var words = read(), next = words.filter(function (item) { return item.id !== id; });
    if (next.length === words.length) return false;
    write(next);
    cleanupReferences(id);
    return true;
  }

  function cleanupReferences(id) {
    var raw, data, changed;
    raw = localStorage.getItem('siwang-english-v1');
    if (raw) {
      data = JSON.parse(raw); changed = false;
      ['progress','favs'].forEach(function (group) {
        if (data[group] && data[group].words && Object.prototype.hasOwnProperty.call(data[group].words, id)) {
          delete data[group].words[id]; changed = true;
        }
      });
      if (changed) localStorage.setItem('siwang-english-v1', JSON.stringify(data));
    }
    raw = localStorage.getItem('sw-spell-mastered');
    if (raw) {
      data = JSON.parse(raw);
      if (Array.isArray(data) && data.indexOf(id) >= 0) localStorage.setItem('sw-spell-mastered', JSON.stringify(data.filter(function (x) { return x !== id; })));
    }
    raw = localStorage.getItem('sw-spell-wrong');
    if (raw) {
      data = JSON.parse(raw);
      if (data && Object.prototype.hasOwnProperty.call(data, id)) { delete data[id]; localStorage.setItem('sw-spell-wrong', JSON.stringify(data)); }
    }
  }

  var initial = read();
  applyToCourse(initial);
  window.SWCustomWords = {
    key: KEY, unitName: UNIT_NAME, maxWords: MAX_WORDS,
    list: function () { return clone(read()); }, save: save, remove: remove,
    refresh: function () { var words = read(); applyToCourse(words); return clone(words); }
  };
})();
