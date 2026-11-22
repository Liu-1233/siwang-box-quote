/*
 * 丝网盒子 · 受控纸面（纯函数 / UMD，不碰 fs、不碰 window、不含任何脚本）
 *
 * 这个文件被三处共用（D3-B2 起的唯一纸面实现）：
 *   · 渲染进程：index.html 里 <script src="sheet.js"> —— 编辑器预览与打印视图
 *   · 主进程（B3）：require('./app/sheet.js') —— 受控 PDF 导出
 *   · 测试：vm 里加载真实实现跑断言
 *
 * 铁律（D3-A 复审第 2/5 条、PDF方案 §2）：
 *   · 抬头与卖方信息**只读单据里的 seller 快照**，绝不读当前 settings 去改写历史抬头；
 *     缺就印"（待补：卖方信息）"，不再有写死的安平地址/宣传语。
 *   · 所有用户字符串统一 esc() 转义，不支持用户 HTML —— 用户填 <img src=http://...>
 *     只会看到字面文本，不会被解析。
 *   · PL 纸面**没有**单价/金额/金额合计，只有包装汇总（A4/A5）。
 *   · 金额与包装汇总一律由 MODEL 计算（round2 / packagingTotals），这里不另算一套。
 *   · 产物不含 <script>（B3 会再断言一次，这里是构造层的保证）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sheet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* MODEL：主进程 require（本文件在 app/ 下），渲染进程与 vm 取 window.SBModel。
     拿不到 MODEL 时纸面仍可渲染，但汇总会标待补——不静默自造一套计算口径。 */
  var MODEL = null;
  if (typeof module === 'object' && module.exports) {
    try { MODEL = require('./model.js'); }
    catch (e) { try { MODEL = require('./app/model.js'); } catch (e2) { MODEL = null; } }
  } else if (typeof window !== 'undefined' && window.SBModel) {
    MODEL = window.SBModel;
  } else if (typeof SBModel !== 'undefined') {
    MODEL = SBModel;
  }

  /* 基础纸面模板标识：仍需保留（个别单据可显式选择基础版，也用于模板不可用时的兜底） */
  var TEMPLATE_ID = 'basic-v1';
  /* P1-D-04：五类单据统一默认 RunCheng 黑白版式——没有声明模板时不再回退到基础版 */
  var DEFAULT_TEMPLATE_ID = 'quotation-rc-v1';
  var TEMPLATE_IDS = ['basic-v1', 'trade-v1', 'jr-pi-v1', 'packing-ref-v1', 'shipping-mark-v1', 'quotation-rc-v1'];   /* P1-D-03：+RunCheng 风格模板 */

  var TYPE_META = {
    QT: { cn: '报价单', en: 'QUOTATION', money: true },
    PI: { cn: '形式发票', en: 'PROFORMA INVOICE', money: true },
    SC: { cn: '销售合同', en: 'SALES CONTRACT', money: true },
    CI: { cn: '商业发票', en: 'COMMERCIAL INVOICE', money: true },
    PL: { cn: '装箱单', en: 'PACKING LIST', money: false }
  };

  /* ---------- 转义与格式化 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* 多行文本：先转义再折行（不引入标签以外的东西） */
  function escLines(s) {
    return esc(s).replace(/\r?\n/g, '<br>');
  }
  function todo(txt) { return '<span class="q-todo">' + esc(txt || '（待补）') + '</span>'; }
  function val(s, txt) {
    var t = String(s == null ? '' : s).trim();
    return t ? esc(t) : todo(txt);
  }
  function sym(cur) { return cur === 'CNY' ? '¥' : (cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '')); }
  function money(v, cur) {
    if (v == null || !isFinite(+v)) return todo('（待补）');
    var n = (+v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (sym(cur) ? sym(cur) + ' ' : '') + n + (!sym(cur) ? ' ' + esc(cur || '') : '');
  }
  function num(v, digits) {
    if (v == null || !isFinite(+v)) return '—';
    return (+v).toFixed(digits == null ? 2 : digits);
  }
  function qty(v) {
    if (v == null || !isFinite(+v)) return '—';
    return (+v).toLocaleString('zh-CN');
  }
  function unitTxt(u) { return String(u == null ? '' : u).trim() ? esc(u) : todo('待补全'); }
  function round2(v) { return MODEL ? MODEL.round2(v) : Math.round((+v || 0) * 100) / 100; }
  /* 草稿预览里的直接编辑入口。只写入 data-edit-path，真正的数据校验和落盘仍由
     pages.js 的 Doc.previewCommit 统一处理；正式预览/PDF 不生成这些属性。 */
  function direct(opts, path, value, placeholder, cls) {
    if (!(opts && opts.editable)) return String(value == null || value === '' ? todo(placeholder || '（待补）') : esc(value));
    var empty = value == null || String(value).trim() === '';
    return '<span class="q-direct-edit' + (empty ? ' is-empty' : '') + (cls ? ' ' + esc(cls) : '') + '"' +
      ' contenteditable="true" spellcheck="false" data-edit-path="' + esc(path) + '"' +
      ' data-placeholder="' + esc(placeholder || '点击填写') + '" onblur="Doc.previewCommit(this)" onkeydown="Doc.previewKey(event,this)">' + (empty ? '' : esc(value)) + '</span>';
  }
  function editableOr(opts, path, value, placeholder, formalHtml) {
    return (opts && opts.editable) ? direct(opts, path, value, placeholder) : formalHtml;
  }
  function customColumns(doc) {
    var raw = doc && doc._unknown && doc._unknown.quoteLayout && doc._unknown.quoteLayout.columns;
    if (!Array.isArray(raw)) return [];
    var hidden = doc && doc._unknown && doc._unknown.quoteLayout && Array.isArray(doc._unknown.quoteLayout.hiddenColumns) ? doc._unknown.quoteLayout.hiddenColumns : [];
    return raw.slice(0, 6).filter(function (c) { return c && typeof c.id === 'string' && typeof c.label === 'string' && hidden.indexOf(c.id) < 0; })
      .map(function (c) { return { id: c.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), label: c.label.slice(0, 30) }; })
      .filter(function (c) { return c.id && c.label; });
  }
  /* P1-D-04：RunCheng 黑白版式（quotation-rc-v1）不再限定 QT——五类单据共用同一版式，
     因此这里没有「按单据类型设门」的逻辑：声明了就用，没声明就用默认的 RC 版式。
     · 存量单据（本轮之前落库、_unknown.quoteLayout 为空）→ 直接走 RC，实现「统一输出格式」；
     · 显式声明 basic-v1/trade-v1 等仍按声明渲染（保留手动选择能力，不强制迁移数据）；
     · 未知标识回落默认版式，不把内部模板诊断写进纸面（BUG-ACC-01 保留项）。 */
  function templateFor(doc) {
    var id = doc && doc._unknown && doc._unknown.quoteLayout && doc._unknown.quoteLayout.templateId;
    return TEMPLATE_IDS.indexOf(id) >= 0 ? id : DEFAULT_TEMPLATE_ID;
  }
  function productSpecsHTML(it) {
    if (!it || !it.productSpecs) return '';
    var specsModule = typeof SBProductSpecs !== 'undefined' ? SBProductSpecs : null;
    if (!specsModule && typeof module === 'object' && module.exports) { try { specsModule = require('./product-specs.js'); } catch (e) {} }
    var text = specsModule ? specsModule.summary(it.productSpecs) : '';
    return text ? '<div class="q-desc-en">' + esc(text) + '</div>' : '';
  }

  /* ---------- 行金额/合计（与落盘同一口径） ---------- */
  function rowAmount(it) { return round2((+it.qty || 0) * (+it.price || 0)); }
  function docTotals(items) {
    if (MODEL) return MODEL.documentTotals(items.map(function (it) { return { amount: rowAmount(it) }; }));
    var g = round2(items.reduce(function (s, it) { return s + rowAmount(it); }, 0));
    return { subtotal: g, grand: g };
  }
  /* 草稿里还没改好的行：纸面标"待修正"，绝不用一个算出来的数冒充有效 */
  function issueMap(opts) {
    var m = {};
    var list = (opts && opts.rowIssues) || [];
    list.forEach(function (b) {
      if (b == null) return;
      var r = b.row == null ? -1 : +b.row;
      (m[r] = m[r] || []).push(b);
    });
    return m;
  }
  function fieldIssue(map, i, f) {
    var list = map[i] || [];
    for (var k = 0; k < list.length; k++) if (list[k].field === f) return list[k];
    return null;
  }

  /* ---------- 明细表列（按类型） ---------- */
  function customHeads(cols, opts) {
    return (cols || []).map(function (c) {
      if (!(opts && opts.editable)) return '<th>' + esc(c.label) + '</th>';
      return '<th class="q-custom-head">' + direct(opts, 'customColumns.' + c.id + '.label', c.label, '列名') +
        '<span class="q-col-tools"><button type="button" onclick="event.preventDefault();event.stopPropagation();Doc.moveCustomColumn(\'' + esc(c.id) + '\',-1)" title="左移">‹</button>' +
        '<button type="button" onclick="event.preventDefault();event.stopPropagation();Doc.moveCustomColumn(\'' + esc(c.id) + '\',1)" title="右移">›</button>' +
        '<button type="button" onclick="event.preventDefault();event.stopPropagation();Doc.removeCustomColumn(\'' + esc(c.id) + '\')" title="删除列">×</button></span></th>';
    }).join('');
  }
  function headCells(type, opts, cols) {
    if (type === 'PL') {
      return ['No.', 'Description', 'Unit', 'Qty', 'Packages', 'N.W.(kg)', 'G.W.(kg)', 'CBM'].map(function (c, i) { return '<th' + (i > 1 ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') + customHeads(cols, opts) + ((opts && opts.editable) ? '<th class="q-edit-action">操作</th>' : '');
    }
    if (opts && opts.templateId === 'trade-v1') {
      return ['No.', 'Photo', 'Product Name', 'Specifications', 'Order Qty', 'Unit Price', 'Amount'].map(function (c, i) { return '<th' + (i >= 4 ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') + customHeads(cols, opts) + ((opts && opts.editable) ? '<th class="q-edit-action">操作</th>' : '');
    }
    var baseCols = ['No.', 'Description'];
    if (type === 'CI' || type === 'SC') baseCols.push('HS Code');
    baseCols = baseCols.concat(['Mesh', 'Wire Dia.', 'Aperture', 'Width', 'Roll', 'Qty', 'Unit Price', 'Amount']);
    return baseCols.map(function (c) {
      var numeric = c !== 'No.' && c !== 'Description' && c !== 'HS Code';
      return '<th' + (numeric ? ' class="num"' : '') + '>' + esc(c) + '</th>';
    }).join('') + customHeads(cols, opts) + ((opts && opts.editable) ? '<th class="q-edit-action">操作</th>' : '');
  }

  function customCells(cols, it, i, opts) {
    var values = it && it._unknown && it._unknown.customCells && typeof it._unknown.customCells === 'object' ? it._unknown.customCells : {};
    return (cols || []).map(function (c) {
      var value = values[c.id] == null ? '' : String(values[c.id]);
      return '<td>' + editableOr(opts, 'items.' + i + '.custom.' + c.id, value, '点击填写', (value ? esc(value) : '—')) + '</td>';
    }).join('');
  }
  function rowCells(type, it, i, map, cur, opts, cols) {
    if (type === 'PL') {
      var bad = (map[i] || []).length > 0;
      function pv(f, digits, label) {
        var one = fieldIssue(map, i, f);
        if (one) return todo('待补');
        var v = it[f];
        if (v == null || String(v).trim() === '') return todo('待补');
        if (!isFinite(+v)) return todo('待修正');
        return num(v, digits);
      }
      var plCells = [
        '<td>' + (i + 1) + '</td>',
        '<td class="q-desc"><div>' + editableOr(opts, 'items.' + i + '.nameCn', it.nameCn, '中文品名', esc(it.nameCn || '')) + '</div>' +
          ((opts && opts.editable) || String(it.nameEn || '').trim() ? '<div class="q-desc-en">' + editableOr(opts, 'items.' + i + '.nameEn', it.nameEn, 'English name', esc(it.nameEn || '')) + '</div>' : '') + productSpecsHTML(it) + '</td>',
        '<td class="num">' + editableOr(opts, 'items.' + i + '.unit', it.unit, '单位', unitTxt(it.unit)) + '</td>',
        '<td class="num">' + editableOr(opts, 'items.' + i + '.qty', it.qty, '数量', (fieldIssue(map, i, 'qty') ? todo('待修正') : (qty(it.qty) + ' ' + unitTxt(it.unit)))) + '</td>',
        '<td class="num">' + editableOr(opts, 'items.' + i + '.packages', it.packages, '件数', pv('packages', 0)) + '</td>',
        '<td class="num">' + editableOr(opts, 'items.' + i + '.net', it.net, '净重', pv('net', 2)) + '</td>',
        '<td class="num">' + editableOr(opts, 'items.' + i + '.gross', it.gross, '毛重', pv('gross', 2)) + '</td>',
        '<td class="num">' + editableOr(opts, 'items.' + i + '.volume', it.volume, '体积', pv('volume', 3)) + '</td>'
      ];
      var plHtml = plCells.join('') + customCells(cols, it, i, opts);
      if (opts && opts.editable) plHtml += '<td class="q-edit-action"><button type="button" onclick="Doc.previewRemoveRow(' + i + ')" title="删除本行">×</button></td>';
      return plHtml + (bad ? '' : '');
    }
    if (opts && opts.templateId === 'trade-v1') {
      var image = it && it._unknown && typeof it._unknown.productImage === 'string' && /^data:image\/(png|jpeg);base64,/.test(it._unknown.productImage) ? '<img class="q-trade-photo" src="' + esc(it._unknown.productImage) + '" alt="product">' : '<span class="q-trade-photo-empty">—</span>';
      var specs = productSpecsHTML(it) || (it.nameEn ? '<div class="q-desc-en">' + esc(it.nameEn) + '</div>' : todo('（待补规格）'));
      return '<td>' + (i + 1) + '</td><td class="q-trade-photo-cell">' + image + '</td><td class="q-desc">' + editableOr(opts, 'items.' + i + '.nameCn', it.nameCn, '产品名称', esc(it.nameCn || '')) + '</td><td class="q-desc">' + specs + '</td><td class="num">' + (qty(it.qty) + ' ' + unitTxt(it.unit)) + '</td><td class="num">' + money(it.price, cur) + '</td><td class="num">' + ((map[i] || []).length ? todo('待修正') : money(rowAmount(it), cur)) + '</td>' + customCells(cols, it, i, opts) + ((opts && opts.editable) ? '<td class="q-edit-action"><button type="button" onclick="Doc.previewRemoveRow(' + i + ')">×</button></td>' : '');
    }
    var ap = (+it.mesh > 0) ? (25.4 / (+it.mesh) - (+it.wire || 0)) : 0;
    function nv(f, txt) {
      var one = fieldIssue(map, i, f);
      if (one) return todo('待修正');
      return esc(txt);
    }
    var cells = [
      '<td>' + (i + 1) + '</td>',
      '<td class="q-desc"><div>' + editableOr(opts, 'items.' + i + '.nameCn', it.nameCn, '中文品名', esc(it.nameCn || '')) + '</div>' +
        ((opts && opts.editable) || String(it.nameEn || '').trim() ? '<div class="q-desc-en">' + editableOr(opts, 'items.' + i + '.nameEn', it.nameEn, 'English name', esc(it.nameEn || '')) + '</div>' : '') + productSpecsHTML(it) + '</td>'
    ];
    if (type === 'CI' || type === 'SC') {
      var hs = String(it.hsCode == null ? '' : it.hsCode).trim();
      cells.push('<td class="num">' + editableOr(opts, 'items.' + i + '.hsCode', hs, 'HS Code', (hs ? esc(hs) : todo('待补'))) + '</td>');
    }
    cells = cells.concat([
      '<td class="num">' + editableOr(opts, 'items.' + i + '.mesh', it.mesh || '', '目数', nv('mesh', (+it.mesh ? it.mesh + ' mesh' : '—'))) + '</td>',
      '<td class="num">' + editableOr(opts, 'items.' + i + '.wire', it.wire || '', '丝径', nv('wire', (+it.wire ? it.wire + ' mm' : '—'))) + '</td>',
      '<td class="num">' + (ap > 0 ? ap.toFixed(3) + ' mm' : '—') + '</td>',
      '<td class="num">' + editableOr(opts, 'items.' + i + '.width', it.width || '', '幅宽', nv('width', (+it.width ? it.width + ' m' : '—'))) + '</td>',
      '<td class="num">' + editableOr(opts, 'items.' + i + '.rollLen', it.rollLen || '', '卷长', nv('rollLen', (+it.rollLen ? it.rollLen + ' m' : '—'))) + '</td>',
      '<td class="num">' + ((opts && opts.editable) ? '<span class="q-edit-pair">' + direct(opts, 'items.' + i + '.qty', it.qty, '数量') + ' ' + direct(opts, 'items.' + i + '.unit', it.unit, '单位') + '</span>' : (fieldIssue(map, i, 'qty') ? todo('待修正') : (qty(it.qty) + ' ' + unitTxt(it.unit)))) + '</td>',
      '<td class="num">' + editableOr(opts, 'items.' + i + '.price', it.price, '单价', nv('price', (+it.price || 0).toFixed(2))) + '</td>',
      '<td class="num">' + ((map[i] || []).length ? todo('待修正') : money(rowAmount(it), cur)) + '</td>'
    ]);
    var html = cells.join('') + customCells(cols, it, i, opts);
    if (opts && opts.editable) html += '<td class="q-edit-action"><button type="button" onclick="Doc.previewRemoveRow(' + i + ')" title="删除本行">×</button></td>';
    return html;
  }

  /* ---------- 汇总行 ---------- */
  function summaryHTML(d, items, cur, opts) {
    if (d.type === 'PL') {
      var p = MODEL
        ? MODEL.packagingTotals(items, d.packagingMode == null ? null : d.packagingMode, d.totalPackages)
        : { packages: null, net: null, gross: null, volume: null };
      var modeTxt = d.packagingMode === 'mixed'
        ? '（混装：总件数以整单录入值为准）'
        : (d.packagingMode === 'separate' ? '（各行包装不重叠：Σ 行件数）' : '（包装模式待确认）');
      var seg = [
        p.packages == null ? todo('待补') : (p.packages + ' packages'),
        'N.W. ' + (p.net == null ? todo('待补') : num(p.net, 2) + ' kg'),
        'G.W. ' + (p.gross == null ? todo('待补') : num(p.gross, 2) + ' kg'),
        (p.volume == null ? todo('待补') : num(p.volume, 3) + ' m³')
      ].join(' · ');
      return '<div class="q-total">Total: <span>' + seg + '</span></div>' +
        '<div class="q-total-note t-sub">' + esc(modeTxt) + '</div>';
    }
    var t = docTotals(items);
    var blocked = (opts && opts.rowIssues && opts.rowIssues.length) > 0;
    /* 已保存的历史单：纸面按保存值印；与明细不一致时附核对提示，不静默改写 */
    var stored = (d.totals && d.totals.grand != null && !(opts && opts.isDraft)) ? +d.totals.grand : t.grand;
    var note = '';
    if (!(opts && opts.isDraft) && d.totals && d.totals.grand != null && Math.abs((+d.totals.grand) - t.grand) > 0.005) {
      note = '<div class="q-warn">注：原合计 ' + money(d.totals.grand, cur) + ' 与按明细计算值 ' + money(t.grand, cur) +
        ' 不一致，发出前请核对。</div>';
    }
    return '<div class="q-total">TOTAL: <span>' +
      (blocked ? todo('待修正（有行还没改好）') : money(stored, cur)) + '</span></div>' + note;
  }

  /* ---------- 条款/特有区块 ---------- */
  function blocksHTML(d, opts) {
    var out = [];
    var common = [
      ['Trade Terms', d.term, '（待补）'],
      ['Payment', d.payment, '（待补）'],
      ['Validity（报价有效期）', d.validity, '（待补）'],
      ['Delivery（交货期）', d.delivery, '（待补）']
    ];
    if (d.type === 'PL') {
      out.push('<div><b>Shipping Marks / Packing:</b>' + editableOr(opts, 'marks', d.marks, '点击填写', val(d.marks, '（待补）')) + '</div>');
      out.push('<div><b>Remark:</b>' + editableOr(opts, 'remark', d.remark, '点击填写', val(d.remark, '（待补）')) + '</div>');
      return '<div class="q-terms">' + out.join('') + '</div>';
    }
    common.forEach(function (p) {
      var key = ['term', 'payment', 'validity', 'delivery'][common.indexOf(p)];
      out.push('<div><b>' + esc(p[0]) + ':</b>' + editableOr(opts, key, p[1], '点击填写', val(p[1], p[2])) + '</div>');
    });
    if (d.type === 'PI' || d.type === 'SC' || d.type === 'CI') {
      /* 银行：空则整块不印（不印空标题），有值按单据快照印（设置页改动不追溯历史单） */
      if (String(d.bank || '').trim()) {
        out.push('<div class="q-bank"><b>Bank Details:</b><div>' + escLines(d.bank) + '</div></div>');
      }
    }
    if (d.type === 'CI') {
      out.push('<div><b>Shipment:</b>' + val(d.shipment, '（待补）') + '</div>');
      out.push('<div><b>Vessel / Voyage:</b>' + val(d.vessel, '（待补）') + '</div>');
      out.push('<div><b>Origin:</b>' + val(d.origin, '（待补）') + '</div>');
    }
    if (d.type === 'SC') {
      out.push('<div><b>Remark:</b>' + editableOr(opts, 'remark', d.remark, '点击填写', val(d.remark, '（待补）')) + '</div>');
      /* 合同条款：用户录入内容原样折行，可跨页；无默认法律模板 */
      var terms = String(d.contractTerms || '').trim();
      var hint = '<div class="q-terms-hint">（条款由双方自行约定：可参考「质量约定 / 付款约定 / 交付约定 / 其他约定」分条填写，本工具不预设法律措辞）</div>';
      out.push('<div class="q-ct"><b>Terms & Conditions:</b>' +
        (terms ? '<div>' + escLines(d.contractTerms) + '</div>' : todo('（待补：未填写合同条款）')) +
        (terms ? '' : hint) + '</div>');
    } else {
      out.push('<div><b>Remark:</b>' + editableOr(opts, 'remark', d.remark, '点击填写', val(d.remark, '（待补）')) + '</div>');
    }
    return '<div class="q-terms">' + out.join('') + '</div>';
  }

  function signHTML(d) {
    if (d.type === 'PL') {
      /* 发货事实单据：保留卖方一行即可，不假装双方签署 */
      return '<div class="q-sign"><div>Seller: ' +
        (d.seller && (d.seller.company || d.seller.contact) ? esc(d.seller.company || d.seller.contact) : todo('（待补：卖方信息）')) +
        ' / Date</div></div>';
    }
    if (d.type === 'SC') {
      return '<div class="q-sign">' +
        '<div>Buyer\'s Signature / Date</div>' +
        '<div>Seller\'s Signature / Date</div>' +
        '</div>';
    }
    return '<div class="q-sign"><div>Buyer\'s Signature / Date</div><div>Seller\'s Signature / Date</div></div>';
  }

  /* ---------- 主入口 ---------- */
  /*
   * build(doc, opts)
   *   opts.isDraft    = 草稿预览（未保存）：合计按明细算，未改好的行标待修正
   *   opts.rowIssues  = [{ row, field, msg }]（草稿的输入层问题）
   *   opts.templateId = 期望的模板标识；缺失时用默认版式（P1-D-04 起为 quotation-rc-v1）；
   *                     显式 basic-v1 等仍按声明渲染；未知标识回落默认版式，
   *                     且不把任何内部模板诊断注记写进纸面（BUG-ACC-01 保留项）
   */
  function build(doc, opts) {
    opts = opts || {};
    if (!doc || typeof doc !== 'object') return '<div class="q-sheet"><div class="q-todo">（没有单据内容）</div></div>';
    var resolved = opts.templateId || templateFor(doc);
    var reference = typeof ReferenceSheets !== 'undefined' ? ReferenceSheets : (typeof module === 'object' && module.exports ? require('./reference-sheets.js') : null);
    if(reference && reference.ids.indexOf(resolved)>=0)return reference.build(doc,Object.assign({},opts,{templateId:resolved}));
    /* P1-D-04：RunCheng 黑白版式分发。五类单据共用同一版式（sheet-rc.js 内部按类型切内容）；
       只有「单据对象不可渲染」时才静默回落基础版——BUG-ACC-01 保留项：回落过程不产出任何
       客户可见的内部模板诊断注记，客户纸面始终是正式文件外观。 */
    var rcMod = resolved === 'quotation-rc-v1' ? (typeof SheetRC !== 'undefined' ? SheetRC : (typeof module === 'object' && module.exports ? require('./sheet-rc.js') : null)) : null;
    if (rcMod) { var rcHtml = rcMod.build(doc, Object.assign({}, opts, { templateId: resolved })); if (rcHtml) return rcHtml; opts = Object.assign({}, opts, { templateId: TEMPLATE_ID }); }
    var type = doc.type || 'QT';
    var meta = TYPE_META[type] || TYPE_META.QT;
    var items = Array.isArray(doc.items) ? doc.items.filter(function (x) { return x && typeof x === 'object'; }) : [];
    var cols = customColumns(doc);
    var cur = doc.currency || 'USD';
    var map = issueMap(opts);
    var isDraft = !!opts.isDraft;

    /* 卖方抬头：只读单据快照（A2） */
    var s = doc.seller || null;
    var sellerBlock = s && (String(s.company || '').trim() || String(s.contact || '').trim() || String(s.address || '').trim())
      ? '<div class="q-co-name">' + editableOr(opts, 'seller.company', s.company, '卖方公司', esc(s.company || '')) + '</div>' +
        '<div class="q-co-sub">' + editableOr(opts, 'seller.contact', s.contact, '卖方联系方式', esc(s.contact || '')) + '<br>' + editableOr(opts, 'seller.address', s.address, '卖方地址', esc(s.address || '')) + '</div>'
      : (opts && opts.editable
        ? '<div class="q-co-name">' + direct(opts, 'seller.company', '', '（待补：卖方信息）') + '</div>' +
          '<div class="q-co-sub">' + direct(opts, 'seller.contact', '', '卖方联系方式') + '<br>' + direct(opts, 'seller.address', '', '卖方地址') + '</div>'
        : '<div class="q-co-name">' + todo('（待补：卖方信息）') + '</div>' +
          '<div class="q-co-sub">在「设置」里填卖方公司/联系方式/地址后，可用编辑器的「刷新卖方信息」写入本单</div>');

    var activeTemplate = TEMPLATE_IDS.indexOf(opts.templateId) >= 0 ? opts.templateId : templateFor(doc);
    var titleMeta = '<div class="q-meta">No.: ' + (String(doc.no || '').trim() ? esc(doc.no) : (isDraft ? '（保存后分配）' : '—')) + '</div>' +
      '<div class="q-meta">Date: ' + esc(doc.date || '') + '</div>';
    if (type === 'SC') {
      titleMeta += '<div class="q-meta">Sign Date: ' + (String(doc.signDate || '').trim() ? esc(doc.signDate) : '（待补）') + '</div>' +
        '<div class="q-meta">Sign Place: ' + (String(doc.signPlace || '').trim() ? esc(doc.signPlace) : '（待补）') + '</div>';
    }

    var c = doc.customer || {};
    var toBlock = (opts && opts.editable)
      ? '<div><b>TO:</b> ' + direct(opts, 'customer.company', c.company || c.name, '客户公司') + '</div>' +
        '<div><b>Attn:</b> ' + direct(opts, 'customer.name', c.name, '联系人') + ' &nbsp;|&nbsp; ' + direct(opts, 'customer.country', c.country, '国家/地区') + '</div>' +
        '<div><b>Address:</b> ' + direct(opts, 'buyerAddress', doc.buyerAddress, '买方地址') + '</div>'
      : '<div><b>TO:</b> ' + val(c.company || c.name, '（未指定客户）') + '</div>' +
        '<div><b>Attn:</b> ' + val(c.name, '—') + (String(c.country || '').trim() ? ' &nbsp;|&nbsp; ' + esc(c.country) : '') + '</div>' +
        (String(doc.buyerAddress || '').trim()
          ? '<div><b>Address:</b> ' + escLines(doc.buyerAddress) + '</div>'
          : '<div><b>Address:</b> ' + todo('（待补：买方地址）') + '</div>');

    var rows = items.map(function (it, i) {
      return '<tr>' + rowCells(type, it, i, map, cur, opts, cols) + '</tr>';
    }).join('');

    var table = items.length
      ? '<table class="q-tb"><thead><tr>' + headCells(type, opts, cols) + '</tr></thead><tbody>' + rows + '</tbody></table>' +
        ((opts && opts.editable) ? '<div class="q-preview-add"><button type="button" onclick="Doc.previewAddRow()">＋ 添加一行</button><button type="button" onclick="Doc.openAddColumn()">＋ 添加一列</button></div>' : '')
      : '<div class="q-empty">（还没有明细行）</div>';

    var head = activeTemplate === 'trade-v1'
      ? '<div class="q-trade-head"><div class="q-trade-company">' + sellerBlock + '</div><div class="q-trade-title"><div class="q-title-cn">' + esc(meta.en === 'PROFORMA INVOICE' ? 'PROFORMA INVOICE' : meta.en) + '</div><div class="q-title-en">' + esc(meta.cn) + '</div>' + titleMeta + '</div></div><div class="q-trade-parties"><div><b>FROM</b>' + sellerBlock + '</div><div><b>TO</b>' + toBlock.replace(/^<div><b>TO:<\/b> /, '').replace(/<\/div>$/, '') + '</div></div>'
      : '<div class="q-head"><div>' + sellerBlock + '</div><div class="q-title"><div class="q-title-cn">' + esc(meta.cn) + '</div><div class="q-title-en">' + esc(meta.en) + '</div>' + titleMeta + '</div></div><div class="q-to">' + toBlock + '</div>';
    return '<div class="q-sheet q-template-' + esc(activeTemplate) + '" data-type="' + esc(type) + '" data-template="' + esc(activeTemplate) + '">' + head +
      table +
      summaryHTML(doc, items, cur, opts) +
      blocksHTML(doc, opts) +
      signHTML(doc) +
      '</div>';
  }

  return {
    TEMPLATE_ID: TEMPLATE_ID,
    TEMPLATE_IDS: TEMPLATE_IDS,
    templateFor: templateFor,
    TYPE_META: TYPE_META,
    esc: esc,
    build: build
  };
});
