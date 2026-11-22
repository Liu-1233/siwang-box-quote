/*
 * 丝网盒子 · 数据模型与迁移（纯函数，不碰 fs、不碰 window）
 *
 * 这个文件被两处使用：
 *   · 主进程：require('./app/model.js')  —— 迁移、校验、编号，落盘由 storage.js 决定
 *   · 渲染进程：index.html 里 <script src="model.js"> —— 内存态编号分配与写入前校验
 *
 * 之所以做成两边共用：迁移和编号规则只能有一份实现，
 * 否则「主进程迁移出来的数据」和「界面自己算的单号」迟早对不上。
 *
 * 约定：本文件里所有函数都不修改入参，返回新对象或明确的 {ok:false, error}。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* P1-B：SCHEMA_VERSION 升到 5；V4_VERSION 明确保留为 4——
     validateV4 / migrateV3toV4 / emptyV4 继续按 v4 规则工作（历史校验与迁移逻辑
     不得被"顺手"改成 v5），v5 的新校验只写在 validateV5 / validateV5DocKeys。 */
  var SCHEMA_VERSION = 5;
  var V4_VERSION = 4;
  var V3_VERSION = 3;
  var LEGACY_VERSION = 2;
  var DOC_TYPES = ['QT', 'PI', 'SC', 'CI', 'PL'];
  var DOC_TYPE_NAMES = { QT: '报价单', PI: '形式发票', SC: '销售合同', CI: '商业发票', PL: '装箱单' };
  /* 金额类单据（有单价/金额/合计）；PL 是包装事实单据，无金额 */
  var AMOUNT_TYPES = ['QT', 'PI', 'SC', 'CI'];
  /* 包装混装模式：separate=各行包装不重叠；mixed=存在混装（总件数以 totalPackages 为准）；null=未知待定 */
  var PACKAGING_MODES = ['separate', 'mixed'];

  /* 新单号：TYPE-YYYYMM-NNNN（至少 4 位序号，超过 9999 不截断） */
  var NO_RE = /^([A-Z]{2})-(\d{6})-(\d{4,})$/;

  /* 数值边界（新写入校验用，不是历史数据的清洗规则） */
  var LIMITS = {
    mesh: { min: 0, max: 10000 },
    wire: { min: 0, max: 100 },
    width: { min: 0, max: 100 },
    rollLen: { min: 0, max: 100000 },
    qty: { min: 0, max: 100000000 },
    price: { min: 0, max: 1000000 }
  };

  /* v3 已知的顶层键；不在 KNOWN_TOP_KEYS 也不在 LEGACY_TOP_KEYS 里的旧字段
     会被原样收进 _unknown，绝不丢 */
  var KNOWN_TOP_KEYS = [
    'schemaVersion', 'migration', 'counters', 'customers', 'products',
    'documents', 'communications', 'quotesArchive', 'checkins', 'settings', '_unknown'
  ];
  /* 旧版(v2)本来就有、且已被迁移覆盖的键：不算"未知"，不再塞进 _unknown */
  var LEGACY_TOP_KEYS = ['schemaVersion', 'customers', 'products', 'quotes', 'checkins', 'settings'];

  /*
   * v3 模型自己使用的键名。
   * 旧 v2 文件里如果也出现了这些名字（例如老版本某次改版留下的 documents / counters /
   * migration），内容是旧格式的、不能拿来当 v3 数据用，但也**绝不能因为"名字认识"就丢掉**。
   * 这类内容统一原样收进 legacySections，只读留存并在迁移报告里点名。
   */
  var V3_MODEL_KEYS = [
    'documents', 'communications', 'quotesArchive', 'counters', 'migration', '_unknown'
  ];

  /* counters 的月份键：YYYYMM，且月份必须是 01~12 */
  var YM_RE = /^\d{4}(0[1-9]|1[0-2])$/;

  /* ---------- v4 新增键清单（D3-A 定稿，D3-B1 落地） ---------- */

  /* 单据级已知键（v4）：v3 的 15 个 + 本次新增 13 个。
     patchDocument 只列名这些键；未列名的键（含 _unknown）原样保留。 */
  var V4_DOC_KEYS = [
    'id', 'no', 'type', 'date', 'sourceId', 'customer', 'items', 'currency',
    'term', 'payment', 'validity', 'delivery', 'remark', 'totals', 'createdAt', 'updatedAt',
    'seller', 'bank', 'buyerAddress', 'marks', 'shipment', 'vessel', 'origin',
    'contractTerms', 'signDate', 'signPlace', 'packagingMode', 'totalPackages'
  ];
  /* 单据级字符串字段（给了就必须是字符串；迁移时缺失补 ''） */
  var V4_DOC_STRING_KEYS = ['currency', 'term', 'payment', 'validity', 'delivery', 'remark',
    'bank', 'buyerAddress', 'marks', 'shipment', 'vessel', 'origin', 'contractTerms', 'signPlace'];
  /* 可空待补字段：null/缺失 = 待补，不是"已填 0"（A5/复审第 3 条） */
  var V4_DOC_NULLABLE_KEYS = ['seller', 'packagingMode', 'totalPackages'];

  /* 行级已知键（v4）：v3 的 11 个 + 新增 5 个 */
  var ITEM_KEYS = ['productId', 'nameCn', 'nameEn', 'mesh', 'wire', 'width', 'rollLen', 'qty', 'price', 'unit', 'amount', 'productImage',
    'hsCode', 'packages', 'net', 'gross', 'volume'];
  /* PL 行包装四件套：null/缺失 = 待补草稿；填了就必须合法 */
  var PL_PACKAGING_KEYS = ['packages', 'net', 'gross', 'volume'];

  /* ---------- v5 新增键清单（P1-B 定稿） ---------- */

  /* 行/产品级 v5 新增键：规格描述 + 单位成本快照四项 + 成本确认态。
     成本允许 null（未填写）；costConfirmed 允许 null（未知/未确认）、true、false。
     注意：这些键**不加入** ITEM_KEYS——finalizeItems/patchDocument 的扩展字段保留机制
     （extrasOf）会原样带回它们，编辑保存不会丢；加入反而会因 validateItems 不产出而清空。 */
  var V5_ITEM_COST_KEYS = ['costFactory', 'costPacking', 'costInland', 'costOther'];
  var V5_ROW_KEYS = ['specText'].concat(V5_ITEM_COST_KEYS).concat(['costConfirmed']);

  /* 单据级 v5 新增定价参数键：null = 历史未记录/待补（绝不伪造 6.6 汇率、3% 手续费、20% 提成）。
     feeInPrice 只允许 0 / 1 / null；fees[] 保存一次性订单费用，不与产品单位成本混用。 */
  var V5_DOC_PRICING_KEYS = ['fx', 'feeRate', 'targetMargin', 'commissionRate', 'freightMarkup', 'markupRate', 'feeInPrice', 'pricingVersion'];
  var V5_DOC_KEYS = V4_DOC_KEYS.concat(V5_DOC_PRICING_KEYS).concat(['fees']);

  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  /* 读取失败里属于"环境/权限"一类：这类失败绝不能当成"文件坏了"去恢复覆盖 */
  var READ_ENV_ERRORS = ['EACCES', 'EPERM', 'EIO', 'EBUSY', 'EROFS', 'ELOOP', 'EMFILE', 'ENFILE', 'UNKNOWN'];

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  /* 客户报价自定义列：只保存受控的 id/label，最多 6 列；内部核价字段不允许进入
     客户纸面。该结构放在 document._unknown.quoteLayout，保持 v4 主 schema 不升版。 */
  function sanitizeQuoteLayout(layout) {
    var out = { columns: [] };
    if (isObj(layout) && ['basic-v1','trade-v1','jr-pi-v1','packing-ref-v1','shipping-mark-v1','quotation-rc-v1'].indexOf(layout.templateId)>=0) out.templateId = layout.templateId;   /* P1-D-03：+quotation-rc-v1（RunCheng 风格 QT 模板，保证保存/重开不丢模板） */
    if (isObj(layout) && typeof layout.templateName === 'string') out.templateName = layout.templateName.replace(/[<>]/g, '').trim().slice(0, 40);
    if (isObj(layout) && isArr(layout.hiddenColumns)) out.hiddenColumns = layout.hiddenColumns.map(function (id) { return String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); }).filter(Boolean).slice(0, 6);
    var cols = layout && isArr(layout.columns) ? layout.columns : [];
    var seen = {};
    cols.slice(0, 6).forEach(function (c) {
      if (!isObj(c)) return;
      var id = String(c.id == null ? '' : c.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
      var label = String(c.label == null ? '' : c.label).replace(/[<>]/g, '').trim().slice(0, 30);
      if (!id || !label || seen[id]) return;
      if (/(成本|底价|采购价|利润|毛利|供应商|厂家|进货|cost|profit|margin|supplier|purchase)/i.test(label)) return;
      seen[id] = 1; out.columns.push({ id: id, label: label });
    });
    return out;
  }
  /* 金额舍入口径：一律 Math.round(x*100)/100，四舍五入到「分」。
     注意这是二进制浮点运算：像 1.005 这种无法精确表示的数，其实际存储值略小于 1.005，
     所以 3×1.005 得 3.01 而不是 3.02。报价单的单价正常是两位小数，不受影响；
     如果以后要改成"十进制精确舍入"，只改这一个函数即可。 */
  function round2(v) { return Math.round((+v || 0) * 100) / 100; }
  function finite(v) { return typeof v === 'number' && isFinite(v); }

  /* 本地日期 → YYYY-MM-DD（不用 toISOString，避免东八区错一天） */
  function dayKey(d) {
    var x = (d instanceof Date) ? d : new Date();
    return x.getFullYear() + '-' + pad(x.getMonth() + 1, 2) + '-' + pad(x.getDate(), 2);
  }
  /* YYYY-MM-DD → YYYYMM */
  function ymFromDate(dateStr) {
    var s = String(dateStr || '');
    var m = /^(\d{4})-(\d{2})/.exec(s);
    if (m) return m[1] + m[2];
    var x = new Date();
    return x.getFullYear() + pad(x.getMonth() + 1, 2);
  }

  /* ---------- 版本识别 ---------- */

  function detectVersion(obj) {
    if (!isObj(obj)) return null;
    if (typeof obj.schemaVersion === 'number' && isFinite(obj.schemaVersion)) return obj.schemaVersion;
    /* 老版本（含 localStorage 时代的数据）没有 schemaVersion，但一定有 customers 数组 */
    if (isArr(obj.customers)) return LEGACY_VERSION;
    return null;
  }

  /* ---------- 校验 ---------- */

  /* 旧格式（v2）能认出来的最低要求 */
  function validateV2(obj) {
    var errors = [];
    if (!isObj(obj)) return { ok: false, errors: ['不是一个对象'] };
    if (!isArr(obj.customers)) errors.push('缺少 customers 数组');
    ['products', 'quotes', 'checkins'].forEach(function (k) {
      if (obj[k] != null && !isArr(obj[k])) errors.push(k + ' 不是数组');
    });
    if (obj.settings != null && !isObj(obj.settings)) errors.push('settings 不是对象');
    return { ok: errors.length === 0, errors: errors };
  }

  /* v3 的结构校验：每次读取和每次保存都要过一遍，不靠迁移标记跳过。
     注意：这里判的是 V3_VERSION（3）——本程序主版本已是 v4，v3 只作为迁移源被读。 */
  function validateV3(obj) {
    var errors = [];
    if (!isObj(obj)) return { ok: false, errors: ['不是一个对象'] };
    if (obj.schemaVersion !== V3_VERSION) errors.push('schemaVersion 必须为 ' + V3_VERSION + '，实际为 ' + obj.schemaVersion);
    ['customers', 'products', 'documents', 'communications', 'quotesArchive', 'checkins'].forEach(function (k) {
      if (!isArr(obj[k])) errors.push('缺少数组 ' + k);
    });
    if (!isObj(obj.counters)) errors.push('缺少 counters 对象');
    if (!isObj(obj.migration)) errors.push('缺少 migration 对象');
    if (!isObj(obj.settings)) errors.push('缺少 settings 对象');
    /* 单据自身的必备字段 */
    if (isArr(obj.documents)) {
      for (var i = 0; i < obj.documents.length; i++) {
        var d = obj.documents[i];
        if (!isObj(d)) { errors.push('documents[' + i + '] 不是对象'); continue; }
        if (!d.id) errors.push('documents[' + i + '] 缺少 id');
        if (!d.type) errors.push('documents[' + i + '] 缺少 type');
        else if (DOC_TYPES.indexOf(d.type) < 0) errors.push('documents[' + i + '] 类型未知：' + d.type);
        if (!isArr(d.items)) errors.push('documents[' + i + '] 缺少 items 数组');
        if (errors.length > 12) { errors.push('（错误过多，已截断）'); break; }
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /* v4 结构校验（读取门）：版本必须是 4（V4_VERSION——v5 时代继续作为 v4 文件
     的读门与迁移源校验），各集合形状正确，单据级 v4 新键类型正确。
     与 validateV3 同级别：回答"这个文件能不能被本程序读"。 */
  function validateV4(obj) {
    var errors = [];
    if (!isObj(obj)) return { ok: false, errors: ['不是一个对象'] };
    if (obj.schemaVersion !== V4_VERSION) errors.push('schemaVersion 必须为 ' + V4_VERSION + '，实际为 ' + obj.schemaVersion);
    ['customers', 'products', 'documents', 'communications', 'quotesArchive', 'checkins'].forEach(function (k) {
      if (!isArr(obj[k])) errors.push('缺少数组 ' + k);
    });
    if (!isObj(obj.counters)) errors.push('缺少 counters 对象');
    if (!isObj(obj.migration)) errors.push('缺少 migration 对象');
    if (!isObj(obj.settings)) errors.push('缺少 settings 对象');
    if (isArr(obj.documents)) {
      for (var i = 0; i < obj.documents.length; i++) {
        var d = obj.documents[i];
        if (!isObj(d)) { errors.push('documents[' + i + '] 不是对象'); continue; }
        if (!d.id) errors.push('documents[' + i + '] 缺少 id');
        if (!d.type) errors.push('documents[' + i + '] 缺少 type');
        else if (DOC_TYPES.indexOf(d.type) < 0) errors.push('documents[' + i + '] 类型未知：' + d.type);
        if (!isArr(d.items)) errors.push('documents[' + i + '] 缺少 items 数组');
        else validateV4DocKeys(d, 'documents[' + i + ']', errors);
        if (errors.length > 12) { errors.push('（错误过多，已截断）'); break; }
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /* counters 结构：类型键 -> { YYYYMM: 非负安全整数 } */
  function validateCounters(counters, errors) {
    errors = errors || [];
    if (!isObj(counters)) { errors.push('counters 不是对象'); return errors; }
    Object.keys(counters).forEach(function (type) {
      var perMonth = counters[type];
      if (!isObj(perMonth)) { errors.push('counters.' + type + ' 不是对象'); return; }
      Object.keys(perMonth).forEach(function (ym) {
        if (!YM_RE.test(ym)) { errors.push('counters.' + type + ' 的月份键不合法：' + ym + '（应为 YYYYMM，月份 01~12）'); return; }
        var v = perMonth[ym];
        if (!finite(v)) { errors.push('counters.' + type + '.' + ym + ' 不是有限数字'); return; }
        if (!Number.isInteger(v) || v < 0) { errors.push('counters.' + type + '.' + ym + ' 必须是非负整数，实际为 ' + v); return; }
        if (v > Number.MAX_SAFE_INTEGER) errors.push('counters.' + type + '.' + ym + ' 超出安全整数范围');
      });
    });
    return errors;
  }

  /* communications 结构：本轮只建结构与校验（界面留 D4），每条必须可定位 */
  function validateCommunications(list, errors) {
    errors = errors || [];
    if (!isArr(list)) { errors.push('communications 不是数组'); return errors; }
    list.forEach(function (c, i) {
      if (!isObj(c)) { errors.push('communications[' + i + '] 不是对象'); return; }
      if (!c.id || typeof c.id !== 'string') errors.push('communications[' + i + '] 缺少字符串 id');
      if (c.customerId != null && typeof c.customerId !== 'string') errors.push('communications[' + i + '] customerId 必须是字符串或空');
      if (c.text != null && typeof c.text !== 'string') errors.push('communications[' + i + '] text 必须是字符串');
      if (c.at != null && typeof c.at !== 'string') errors.push('communications[' + i + '] at 必须是字符串');
    });
    return errors;
  }

  /* 单据的数值字段必须是有限数（写入口专用） */
  var NUM_FIELDS = ['mesh', 'wire', 'width', 'rollLen', 'qty', 'price', 'amount'];

  /* PL 行包装字段的单项校验：null/缺失 = 待补（合法草稿）；填了就必须合法。
     返回错误串或 ''。NaN/Infinity 永远非法，不能变 null 蒙混（复审第 3 条）。 */
  function checkPackagingField(field, v, label, errors) {
    if (v == null) return;                                   /* 待补，允许 */
    if (!finite(v)) { errors.push(label + field + ' 必须是有限数字，实际为 ' + JSON.stringify(v)); return; }
    if (v <= 0) { errors.push(label + field + ' 必须大于 0（待补请留空，不要填 0 伪装已填）'); return; }
    if (v > 1e12) { errors.push(label + field + ' 超出允许范围（≤1e12）'); return; }
    if (field === 'packages' && !Number.isInteger(v)) { errors.push(label + 'packages 必须是整数件数'); return; }
  }

  /*
   * PL 一行的包装校验（唯一实现：渲染侧 validateItems 与写门 validateDocumentStrict 共用）。
   *   · 四件套 null/缺失/'' = 待补草稿，合法；填了就必须合法（有限、>0、件数整数）；
   *   · 毛重不能小于净重（两项都填了才比较；待补不拦）；
   *   · NaN/Infinity 永远非法，不能靠"写成 null"蒙混（复审第 3 条）。
   */
  function validatePlRowPackaging(it, label, errors) {
    PL_PACKAGING_KEYS.forEach(function (f) {
      var raw = it[f];
      if (raw == null || raw === '') return;                 /* 待补，合法 */
      checkPackagingField(f, +raw, label, errors);
    });
    var net = it.net, gross = it.gross;
    if (net != null && net !== '' && gross != null && gross !== '' && finite(+net) && finite(+gross) && +gross < +net) {
      errors.push(label + '毛重不能小于净重（毛重 ' + gross + ' < 净重 ' + net + '）');
    }
  }

  /*
   * v4 单据级新键的类型校验（读/写都用）：
   *   · 字符串键：给了就必须是字符串
   *   · seller：null 或 { company/contact/address 均为字符串 } 的对象
   *   · packagingMode：null 或 'separate'/'mixed'
   *   · totalPackages：null 或正整数
   *   · signDate：合法 YYYY-MM-DD 或空串
   * 历史数据里的异常值在这里报出来，由调用方决定（读 = 只读态；写 = 拒绝）。
   */
  function validateV4DocKeys(d, tag, errors) {
    V4_DOC_STRING_KEYS.forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(d, k)) return;
      if (d[k] == null) return;                              /* 迁移默认值允许缺省 */
      if (typeof d[k] !== 'string') errors.push(tag + '.' + k + ' 必须是字符串，实际为 ' + JSON.stringify(d[k]));
    });
    if (d.signDate != null && d.signDate !== '' && (typeof d.signDate !== 'string' || !DATE_RE.test(d.signDate))) {
      errors.push(tag + '.signDate 必须是 YYYY-MM-DD 或空，实际为 ' + JSON.stringify(d.signDate));
    }
    if (d.seller != null) {
      if (!isObj(d.seller)) { errors.push(tag + '.seller 必须是对象或 null'); }
      else ['company', 'contact', 'address'].forEach(function (k) {
        if (d.seller[k] != null && typeof d.seller[k] !== 'string') errors.push(tag + '.seller.' + k + ' 必须是字符串');
      });
    }
    if (d.packagingMode != null && PACKAGING_MODES.indexOf(d.packagingMode) < 0) {
      errors.push(tag + '.packagingMode 必须是 separate/mixed 或 null，实际为 ' + JSON.stringify(d.packagingMode));
    }
    if (d.totalPackages != null) {
      if (!Number.isInteger(d.totalPackages) || d.totalPackages <= 0) {
        errors.push(tag + '.totalPackages 必须是正整数或 null，实际为 ' + JSON.stringify(d.totalPackages));
      }
    }
  }

  /* ---------- v5 校验（P1-B） ---------- */

  /*
   * 成本字段单项校验（v5）：null/缺失 = 未填写（合法）；给了就必须是有限非负数字。
   * 明确确认的零成本（0 + costConfirmed=true）合法；未确认的零值只是"填了 0"，
   * 不会被任何逻辑当成已确认——确认语义在 costConfirmed 上，这里只管数值合法性。
   */
  function checkCostField(f, v, label, errors) {
    if (v === null || v === undefined) return;               /* 未填写，合法 */
    if (!finite(v)) { errors.push(label + f + ' 必须是有限数字或 null（未填写），实际为 ' + JSON.stringify(v)); return; }
    if (v < 0) errors.push(label + f + ' 不能为负，实际为 ' + v);
  }

  /*
   * v5 行/产品级新增键校验（字段校验产品库与报价行保持一致）：
   *   · specText：null/缺失 = 未填写；给了必须是字符串；
   *   · costFactory/costPacking/costInland/costOther：null/缺失 = 未填写；给了必须有限非负；
   *   · costConfirmed：null/缺失 = 未知（不得当作已确认）；给了必须是 true/false。
   */
  function validateV5RowKeys(it, label, errors) {
    if (!isObj(it)) return;
    if (Object.prototype.hasOwnProperty.call(it, 'specText') && it.specText != null && typeof it.specText !== 'string') {
      errors.push(label + 'specText 必须是字符串或 null（未填写），实际为 ' + JSON.stringify(it.specText));
    }
    V5_ITEM_COST_KEYS.forEach(function (f) {
      if (!Object.prototype.hasOwnProperty.call(it, f)) return;
      checkCostField(f, it[f], label, errors);
    });
    if (Object.prototype.hasOwnProperty.call(it, 'costConfirmed') && it.costConfirmed != null && typeof it.costConfirmed !== 'boolean') {
      errors.push(label + 'costConfirmed 必须是 true/false 或 null（未确认），实际为 ' + JSON.stringify(it.costConfirmed));
    }
  }

  /* ---------- P1-RC-DB（数据底座）：产品多图 / 客户扩展 / 供应商报价 ----------
   * 全部为**可选**字段，不升级 Schema（仍为 V5），不覆盖既有 imageData/realImageData/realImageMode。
   * 读门与写门共用下面同一份校验，避免"能读不能写"或"能写不能读"。
   */
  var PRODUCT_IMAGE_TYPES = ['main', 'spec', 'accessory'];
  var PRODUCT_IMAGE_MAX = 12;
  var PRODUCT_IMAGE_CAPTION_MAX = 200;
  var DATA_IMAGE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

  function isDataImage(v) {
    return typeof v === 'string' && v.length > 0 && v.length <= 1000100 && DATA_IMAGE_RE.test(v);
  }

  /* 产品多图：images[] = [{id?, data, type, sort, caption?}]
   * data 必须是受限 PNG/JPEG base64（与产品图/实物图同一白名单），type 三选一，sort 非负整数。 */
  function validateProductImages(p, label, errors) {
    if (!isObj(p) || !Object.prototype.hasOwnProperty.call(p, 'images')) return;
    if (p.images === null) { errors.push(label + 'images 必须是数组或省略，null 不被接受'); return; }
    if (!isArr(p.images)) { errors.push(label + 'images 必须是数组'); return; }
    if (p.images.length > PRODUCT_IMAGE_MAX) {
      errors.push(label + 'images 最多 ' + PRODUCT_IMAGE_MAX + ' 张，实际 ' + p.images.length + ' 张');
      return;
    }
    p.images.forEach(function (im, i) {
      var tag = label + 'images[' + i + ']';
      if (!isObj(im)) { errors.push(tag + ' 不是对象'); return; }
      if (!isDataImage(im.data)) errors.push(tag + '.data 必须是受限本地 PNG/JPEG base64（≤1000100 字符）');
      if (PRODUCT_IMAGE_TYPES.indexOf(im.type) < 0) {
        errors.push(tag + '.type 只能是 main/spec/accessory，实际为 ' + JSON.stringify(im.type));
      }
      if (!(typeof im.sort === 'number' && isFinite(im.sort) && im.sort >= 0 && Math.floor(im.sort) === im.sort)) {
        errors.push(tag + '.sort 必须是非负整数');
      }
      if (im.caption != null && (typeof im.caption !== 'string' || im.caption.length > PRODUCT_IMAGE_CAPTION_MAX)) {
        errors.push(tag + '.caption 必须是不超过 ' + PRODUCT_IMAGE_CAPTION_MAX + ' 字的字符串或省略');
      }
      if (im.id != null && (typeof im.id !== 'string' || im.id.length > 64)) {
        errors.push(tag + '.id 必须是不超过 64 字符的字符串或省略');
      }
    });
  }

  /* 产品扩展文本字段：color / accessories / remarks（可选，空串允许） */
  var PRODUCT_EXTRA_TEXT_KEYS = ['color', 'accessories', 'remarks'];
  var PRODUCT_EXTRA_TEXT_MAX = 2000;
  function validateProductExtraText(p, label, errors) {
    if (!isObj(p)) return;
    PRODUCT_EXTRA_TEXT_KEYS.forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(p, k) || p[k] == null) return;
      if (typeof p[k] !== 'string') { errors.push(label + k + ' 必须是字符串或省略'); return; }
      if (p[k].length > PRODUCT_EXTRA_TEXT_MAX) errors.push(label + k + ' 超过 ' + PRODUCT_EXTRA_TEXT_MAX + ' 字');
    });
  }

  /* 客户扩展字段：whatsapp / website / customerType / source / notes / archivedAt（均可选） */
  var CUSTOMER_EXTRA_TEXT_KEYS = ['whatsapp', 'website', 'customerType', 'source', 'notes'];
  var CUSTOMER_EXTRA_TEXT_MAX = 2000;
  function validateCustomerExtras(c, label, errors) {
    if (!isObj(c)) return;
    CUSTOMER_EXTRA_TEXT_KEYS.forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(c, k) || c[k] == null) return;
      if (typeof c[k] !== 'string') { errors.push(label + k + ' 必须是字符串或省略'); return; }
      if (c[k].length > CUSTOMER_EXTRA_TEXT_MAX) errors.push(label + k + ' 超过 ' + CUSTOMER_EXTRA_TEXT_MAX + ' 字');
    });
    if (Object.prototype.hasOwnProperty.call(c, 'archivedAt') && c.archivedAt != null && c.archivedAt !== '') {
      if (typeof c.archivedAt !== 'string' || !DATE_RE.test(c.archivedAt)) {
        errors.push(label + 'archivedAt 必须是 YYYY-MM-DD 或空');
      }
    }
  }

  /* ---------- 供应商（第一阶段暂存于 _unknown，受控结构） ----------
   * _unknown.suppliers[]      = {id, name, contact, remarks, createdAt}
   * _unknown.supplierQuotes[] = {id, supplierId, supplierName, productId, currency, price,
   *                              unit, moq, quoteDate, validUntil, sourceFile, createdAt}
   * 历史采购价只增不改：数据层不提供更新/删除接口；同一组合再次录入等于新增一条。
   */
  var SUPPLIER_KEYS_MAX = 2000;
  var SUPPLIER_QUOTE_CURRENCIES = ['CNY', 'USD'];

  function textOrEmpty(v, tag, max, errors) {
    if (v == null || v === '') return '';
    if (typeof v !== 'string') { errors.push(tag + ' 必须是字符串或省略'); return ''; }
    if (v.length > max) { errors.push(tag + ' 超过 ' + max + ' 字'); return ''; }
    return v;
  }

  function validateSuppliers(obj, errors) {
    if (!isObj(obj)) return;
    if (obj._unknown != null && !isObj(obj._unknown)) { errors.push('_unknown 必须是对象'); return; }
    var u = isObj(obj._unknown) ? obj._unknown : {};
    ['suppliers', 'supplierQuotes'].forEach(function (k) {
      if (u[k] == null) return;
      if (!isArr(u[k])) errors.push('_unknown.' + k + ' 必须是数组或省略');
    });
    if (isArr(u.suppliers)) {
      u.suppliers.forEach(function (s, i) {
        var tag = '_unknown.suppliers[' + i + ']';
        if (!isObj(s)) { errors.push(tag + ' 不是对象'); return; }
        if (!s.id || typeof s.id !== 'string' || s.id.length > 64) errors.push(tag + '.id 必须是 ≤64 字符的字符串');
        var name = textOrEmpty(s.name, tag + '.name', 200, errors);
        if (!String(name || '').trim()) errors.push(tag + '.name 不能为空');
        textOrEmpty(s.contact, tag + '.contact', 200, errors);
        textOrEmpty(s.remarks, tag + '.remarks', SUPPLIER_KEYS_MAX, errors);
      });
    }
    if (isArr(u.supplierQuotes)) {
      u.supplierQuotes.forEach(function (q, i) {
        var tag = '_unknown.supplierQuotes[' + i + ']';
        if (!isObj(q)) { errors.push(tag + ' 不是对象'); return; }
        if (!q.id || typeof q.id !== 'string' || q.id.length > 64) errors.push(tag + '.id 必须是 ≤64 字符的字符串');
        if (q.supplierId != null && (typeof q.supplierId !== 'string' || q.supplierId.length > 64)) {
          errors.push(tag + '.supplierId 必须是 ≤64 字符的字符串或省略');
        }
        var sname = textOrEmpty(q.supplierName, tag + '.supplierName', 200, errors);
        if (!String(sname || '').trim() && q.supplierId == null) errors.push(tag + '.supplierName 不能为空（或提供 supplierId）');
        if (!q.productId || typeof q.productId !== 'string' || q.productId.length > 64) {
          errors.push(tag + '.productId 必须是 ≤64 字符的字符串');
        }
        if (SUPPLIER_QUOTE_CURRENCIES.indexOf(q.currency) < 0) {
          errors.push(tag + '.currency 只能是 CNY 或 USD，实际为 ' + JSON.stringify(q.currency));
        }
        if (!(typeof q.price === 'number' && isFinite(q.price) && q.price >= 0)) {
          errors.push(tag + '.price 必须是有限非负数');
        }
        var unit = textOrEmpty(q.unit, tag + '.unit', 50, errors);
        if (!String(unit || '').trim()) errors.push(tag + '.unit 不能为空');
        textOrEmpty(q.moq, tag + '.moq', 100, errors);
        if (q.quoteDate != null && q.quoteDate !== '' && (typeof q.quoteDate !== 'string' || !DATE_RE.test(q.quoteDate))) {
          errors.push(tag + '.quoteDate 必须是 YYYY-MM-DD 或空');
        }
        if (q.validUntil != null && q.validUntil !== '' && (typeof q.validUntil !== 'string' || !DATE_RE.test(q.validUntil))) {
          errors.push(tag + '.validUntil 必须是 YYYY-MM-DD 或空');
        }
        textOrEmpty(q.sourceFile, tag + '.sourceFile', 200, errors);
      });
    }
  }

  /* 一次性订单费用条目校验（v5 fees[]）：金额有限非负、最多两位小数；
     allocations 可选（null 或 [{sort, amountCny}]），与 P1-A 定价引擎入参同形。 */  function validateFeeEntry(entry, tag, errors) {
    if (!isObj(entry)) { errors.push(tag + ' 不是对象'); return; }
    var a = entry.amountCny;
    if (!Object.prototype.hasOwnProperty.call(entry, 'amountCny') || a === null) {
      errors.push(tag + '.amountCny 缺失（一次性费用必须有明确金额，0 表示零费用）');
    } else if (!finite(a) || a < 0 || Math.abs(a * 100 - Math.round(a * 100)) > 1e-6) {
      errors.push(tag + '.amountCny 必须是非负且最多两位小数的有限数字，实际为 ' + JSON.stringify(a));
    }
    if (entry.label != null && typeof entry.label !== 'string') errors.push(tag + '.label 必须是字符串');
    if (entry.note != null && typeof entry.note !== 'string') errors.push(tag + '.note 必须是字符串');
    if (entry.allocations !== undefined && entry.allocations !== null) {
      if (!isArr(entry.allocations)) { errors.push(tag + '.allocations 必须是数组或 null'); return; }
      entry.allocations.forEach(function (al, ai) {
        if (!isObj(al)) { errors.push(tag + '.allocations[' + ai + '] 不是对象'); return; }
        if (!finite(al.sort)) errors.push(tag + '.allocations[' + ai + '].sort 必须是数字');
        var av = al.amountCny;
        if (!finite(av) || av < 0 || Math.abs(av * 100 - Math.round(av * 100)) > 1e-6) {
          errors.push(tag + '.allocations[' + ai + '].amountCny 必须是非负且最多两位小数的有限数字，实际为 ' + JSON.stringify(av));
        }
      });
    }
  }

  /*
   * v5 单据级新键校验（含全部 v4 规则，读/写都用）：
   *   · 定价参数：null = 历史未记录/待补（合法）；给了就必须合法——
   *     fx 有限且 >0；feeRate/targetMargin/commissionRate ∈ [0,1)；freightMarkup ≥0；
   *     markupRate >0；feeInPrice 只允许数字 0/1/null（"1"/true 一律拒绝）；
   *     pricingVersion null 或非空字符串；
   *   · fees：数组，条目见 validateFeeEntry；缺失与 null 一律拒绝
   *     （P1-B-FIX-01 BUG-02：历史迁移负责补 []，新建单据由默认值补齐）。
   * 历史数据里的异常值在这里报出来，由调用方决定（读 = 只读态；写 = 拒绝）。
   */
  function validateV5DocKeys(d, tag, errors) {
    validateV4DocKeys(d, tag, errors);
    if (d.fx != null && (!finite(d.fx) || d.fx <= 0)) {
      errors.push(tag + '.fx 必须是大于 0 的有限数字或 null（未记录），实际为 ' + JSON.stringify(d.fx));
    }
    [['feeRate', 'feeRate'], ['targetMargin', 'targetMargin'], ['commissionRate', 'commissionRate']].forEach(function (p) {
      var v = d[p[0]];
      if (v != null && (!finite(v) || v < 0 || v >= 1)) {
        errors.push(tag + '.' + p[0] + ' 必须在 [0,1) 内或 null（未记录），实际为 ' + JSON.stringify(v));
      }
    });
    if (d.freightMarkup != null && (!finite(d.freightMarkup) || d.freightMarkup < 0)) {
      errors.push(tag + '.freightMarkup 必须是非负有限数字或 null（未记录），实际为 ' + JSON.stringify(d.freightMarkup));
    }
    if (d.markupRate != null && (!finite(d.markupRate) || d.markupRate <= 0)) {
      errors.push(tag + '.markupRate 必须是大于 0 的有限数字或 null（未记录），实际为 ' + JSON.stringify(d.markupRate));
    }
    if (Object.prototype.hasOwnProperty.call(d, 'feeInPrice') && d.feeInPrice !== null) {
      if (d.feeInPrice !== 0 && d.feeInPrice !== 1) {
        errors.push(tag + '.feeInPrice 只允许 0、1 或 null（未知），实际为 ' + JSON.stringify(d.feeInPrice));
      }
    }
    if (d.pricingVersion != null && (typeof d.pricingVersion !== 'string' || !d.pricingVersion.trim())) {
      errors.push(tag + '.pricingVersion 必须是非空字符串或 null（未记录），实际为 ' + JSON.stringify(d.pricingVersion));
    }
    /* v5（P1-B-FIX-01 BUG-02）：fees 三态收紧——
       · 缺失 = 拒绝（历史迁移负责补成 []，新建单据由默认值负责补齐，读取与写入门都不猜）；
       · null = 拒绝（"未知/未记录"不等于"空费用清单"，v5 单据必须显式携带数组）；
       · 只有数组合法，条目逐个过 validateFeeEntry。
       本函数同时服务读门（validateV5）与写门（validateDocumentStrict→validateWritable），
       两处规则由同一份代码保证一致。 */
    if (!Object.prototype.hasOwnProperty.call(d, 'fees')) {
      errors.push(tag + '.fees 缺失 —— v5 单据必须显式携带 fees 数组（历史迁移负责补 []，新建单据由默认值补齐）');
    } else if (d.fees === null) {
      errors.push(tag + '.fees 必须是数组，null 被拒绝（"未知"不等于"空费用清单"）');
    } else if (!isArr(d.fees)) {
      errors.push(tag + '.fees 必须是数组，实际为 ' + JSON.stringify(d.fees));
    } else {
      d.fees.forEach(function (f, fi) { validateFeeEntry(f, tag + '.fees[' + fi + ']', errors); });
    }
  }

  /* v5 结构校验（读取门）：版本必须是 5，各集合形状正确，单据级 v5 键类型正确，
     产品库成本字段合法。v4 文件由 validateV4 读，v3/v2 由各自的读门读。 */
  function validateV5(obj) {
    var errors = [];
    if (!isObj(obj)) return { ok: false, errors: ['不是一个对象'] };
    if (obj.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion 必须为 ' + SCHEMA_VERSION + '，实际为 ' + obj.schemaVersion);
    ['customers', 'products', 'documents', 'communications', 'quotesArchive', 'checkins'].forEach(function (k) {
      if (!isArr(obj[k])) errors.push('缺少数组 ' + k);
    });
    if (!isObj(obj.counters)) errors.push('缺少 counters 对象');
    if (!isObj(obj.migration)) errors.push('缺少 migration 对象');
    if (!isObj(obj.settings)) errors.push('缺少 settings 对象');
    if (isArr(obj.products)) {
      obj.products.forEach(function (p, pi) {
        if (!isObj(p)) { errors.push('products[' + pi + '] 不是对象'); return; }
        validateV5RowKeys(p, 'products[' + pi + '].', errors);
        validateProductImages(p, 'products[' + pi + '].', errors);
        validateProductExtraText(p, 'products[' + pi + '].', errors);
      });
    }
    /* P1-RC-DB-FIX-01 BUG-01：读门必须与写门同权——
       客户扩展字段与 _unknown 供应商结构在"读"和"写"两侧都要拒绝同一份非法数据，
       否则坏数据能被加载却在保存时才报错（或反之）。 */
    if (isArr(obj.customers)) {
      obj.customers.forEach(function (c, ci) {
        validateCustomerExtras(c, 'customers[' + ci + '].', errors);
      });
    }
    validateSuppliers(obj, errors);
    if (isArr(obj.documents)) {
      for (var i = 0; i < obj.documents.length; i++) {
        var d = obj.documents[i];
        if (!isObj(d)) { errors.push('documents[' + i + '] 不是对象'); continue; }
        if (!d.id) errors.push('documents[' + i + '] 缺少 id');
        if (!d.type) errors.push('documents[' + i + '] 缺少 type');
        else if (DOC_TYPES.indexOf(d.type) < 0) errors.push('documents[' + i + '] 类型未知：' + d.type);
        if (!isArr(d.items)) errors.push('documents[' + i + '] 缺少 items 数组');
        else {
          validateV5DocKeys(d, 'documents[' + i + ']', errors);
          d.items.forEach(function (it, j) {
            /* v5（P1-B-FIX-01 BUG-02）：非对象明细必须报错，不允许静默跳过——
               跳过等于"坏行不存在"，损坏数据会被当成正常库加载。 */
            if (isObj(it)) validateV5RowKeys(it, 'documents[' + i + '].items[' + j + '].', errors);
            else errors.push('documents[' + i + '].items[' + j + '] 不是对象');
          });
        }
        if (errors.length > 12) { errors.push('（错误过多，已截断）'); break; }
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function validateDocumentStrict(d, i, errors, v5Mode) {
    var tag = 'documents[' + i + ']';
    if (!isObj(d)) { errors.push(tag + ' 不是对象'); return; }
    if (!d.id) errors.push(tag + ' 缺少 id');
    if (!d.no || typeof d.no !== 'string') errors.push(tag + ' 缺少单号');
    if (!d.type) errors.push(tag + ' 缺少 type');
    else if (DOC_TYPES.indexOf(d.type) < 0) errors.push(tag + ' 类型未知：' + d.type);
    if (d.date != null && typeof d.date !== 'string') errors.push(tag + ' date 必须是字符串');
    /* 版本分派（P1-B）：v5 走 validateV5DocKeys（含全部 v4 规则 + 定价参数/fees）；
       v4 及以下维持原 validateV4DocKeys 行为不变。 */
    if (v5Mode) validateV5DocKeys(d, tag, errors);
    else validateV4DocKeys(d, tag, errors);
    if (!isArr(d.items)) { errors.push(tag + ' 缺少 items 数组'); return; }
    var isPL = d.type === 'PL';
    d.items.forEach(function (it, j) {
      var t2 = tag + '.items[' + j + ']';
      if (!isObj(it)) { errors.push(t2 + ' 不是对象'); return; }
      if (typeof it.nameCn !== 'string' || !it.nameCn.trim()) errors.push(t2 + ' 品名不能为空');
      if (it.hsCode != null && typeof it.hsCode !== 'string') errors.push(t2 + '.hsCode 必须是字符串');
      NUM_FIELDS.forEach(function (f) {
        /* 字段不存在 = 未涉及，允许；一旦存在就必须是有限数。
           null 尤其要拦：JSON.stringify 会把 NaN/Infinity 静默变成 null，
           磁盘上出现 null 就是"曾经写出过非法数"的痕迹，不能放过去。
           ★ 例外（v4/A5）：PL 行包装四件套允许 null = 待补草稿。 */
        if (!Object.prototype.hasOwnProperty.call(it, f)) return;
        var v = it[f];
        if (v === null) {
          if (isPL && PL_PACKAGING_KEYS.indexOf(f) >= 0) return;   /* 待补，合法 */
          errors.push(t2 + '.' + f + ' 为 null —— 这通常是 NaN/Infinity 被写入后的痕迹，必须修正');
          return;
        }
        if (!finite(v)) { errors.push(t2 + '.' + f + ' 必须是有限数字，实际为 ' + JSON.stringify(v)); return; }
        if (isPL && PL_PACKAGING_KEYS.indexOf(f) >= 0) {
          checkPackagingField(f, v, t2 + '.', errors);
          return;
        }
        var lim = LIMITS[f];
        if (lim && v >= 0 && (v < lim.min || v > lim.max)) errors.push(t2 + '.' + f + ' 超出允许范围 ' + lim.min + '~' + lim.max);
        if (v < 0 && f !== 'amount') errors.push(t2 + '.' + f + ' 不能为负');
      });
      /* PL 行包装四件套不在 NUM_FIELDS 里（金额类单据不涉及这些键），
         单独过同一套校验：待补 null 合法、填了必须合法、毛重不小于净重。 */
      if (isPL) validatePlRowPackaging(it, t2 + '.', errors);
      /* v5 行级新增键（成本快照/规格描述/成本确认态）——仅 v5 模式校验，
         缺失/null 语义见 validateV5RowKeys；产品库与报价行同一套规则。 */
      if (v5Mode) validateV5RowKeys(it, t2 + '.', errors);
    });
    if (d.totals != null) {
      if (!isObj(d.totals)) errors.push(tag + '.totals 不是对象');
      /* 金额类合计键 + PL 包装汇总键都要过有限数检查（D1-F4：NaN/Infinity
         会被 JSON.stringify 静默写成 null，写门必须在序列化之前拦住）。
         null 只对 PL 包装汇总键合法（待补草稿）。 */
      else ['subtotal', 'grand', 'computedFromItems', 'packages', 'net', 'gross', 'volume'].forEach(function (f) {
        if (!Object.prototype.hasOwnProperty.call(d.totals, f)) return;
        var v = d.totals[f];
        if (v === null) {
          /* PL 汇总缺项时是 null（待补），合法；金额类合计出现 null 不放行 */
          if (isPL && PL_PACKAGING_KEYS.indexOf(f) >= 0) return;
          errors.push(tag + '.totals.' + f + ' 为 null —— 通常是 NaN/Infinity 被写入后的痕迹，必须修正');
          return;
        }
        if (!finite(v)) errors.push(tag + '.totals.' + f + ' 必须是有限数字，实际为 ' + JSON.stringify(v));
      });
    }
  }

  /*
   * ★ 写入口校验（save / 导入 / 恢复 都用它，不能只靠渲染层）
   *
   * 为什么必须有：JSON.stringify 会把 NaN / Infinity 静默写成 null，
   * 于是"金额变成空"这种事会毫无提示地落到磁盘上。所以必须在序列化之前拦住。
   * 这里比 validateV4（结构校验，用于"能不能读"）严格：
   *   · 数值必须有限、非负（金额除外）、在边界内
   *   · counters 必须是非负安全整数、月份键合法
   *   · communications 必须有 id
   *   · v4 单据级新键类型正确；PL 行包装四件套 null=待补合法、填了就必须合法
   * version 参数供迁移链使用：v2→v3 的中间产物按 v3 规则校验（不落盘，只做内存把关）。
   */
  /* Optional D5 settings.learningRecords; no migration or legacy record deletion. */
  function validateLearningRecords(records) {
    var errors=[];
    if(!isObj(records))return {ok:false,errors:['学习记录必须是对象']};
    var keys=['siwang-english-v1','sw-spell-mastered','sw-spell-wrong','sw-custom-words-v1'];
    var total=0;
    function safeTree(v,depth){
      depth=depth||0;if(depth>24)return false;
      if(v && typeof v==='object')return Object.keys(v).every(function(k){return !['__proto__','constructor','prototype','hasOwnProperty'].includes(k) && safeTree(v[k],depth+1);});
      return true;
    }
    Object.keys(records).forEach(function(k){
      var raw=records[k];
      if(keys.indexOf(k)<0 || typeof raw!=='string' || raw.length>1800000){errors.push('不支持或过大的学习记录');return;}
      total+=raw.length;
      var d;try{d=JSON.parse(raw);}catch(e){errors.push('学习记录不是JSON');return;}
      if(!safeTree(d)){errors.push('学习记录含不安全键名');return;}
      function flags(map){return isObj(map)&&Object.keys(map).every(function(id){var v=map[id];return typeof v==='boolean'||(typeof v==='number'&&isFinite(v)&&v>=0);});}
      if(k==='siwang-english-v1'){
        if(!isObj(d)||!isObj(d.progress)||!isObj(d.favs)||!flags(d.checkins))errors.push('课程进度结构不正确');
        else ['progress','favs'].forEach(function(p){if(!Object.keys(d[p]).every(function(c){return flags(d[p][c]);}))errors.push('课程条目结构不正确');});
      }else if(k==='sw-custom-words-v1'){
        var wordFields=['id','en','zh','ph','pos','ex','exZh','tip','createdAt','updatedAt'];
        if(!isArr(d)||d.length>500){errors.push('自定义单词结构不正确');return;}
        var ids={};
        d.forEach(function(w){
          if(!isObj(w)||Object.keys(w).some(function(x){return wordFields.indexOf(x)<0;})||
            typeof w.id!=='string'||!/^cw-[A-Za-z0-9-]{6,80}$/.test(w.id)||ids[w.id]||
            typeof w.en!=='string'||!w.en.trim()||w.en.length>120||
            typeof w.zh!=='string'||!w.zh.trim()||w.zh.length>200||
            ['ph','pos','ex','exZh','tip','createdAt','updatedAt'].some(function(x){return w[x]!==undefined&&(typeof w[x]!=='string'||w[x].length>500);})){
            errors.push('自定义单词条目不正确');
          }else ids[w.id]=1;
        });
      }else if(k==='sw-spell-mastered'){
        if(!isArr(d)||!d.every(function(id){return typeof id==='string'&&id.length<200;}))errors.push('已掌握单词结构不正确');
      }else if(!flags(d))errors.push('错词记录结构不正确');
    });
    if(total>2000000)errors.push('学习记录总大小超过2MB');
    return {ok:errors.length===0,errors:errors};
  }

  function validateWritable(obj, version) {
    var ver = version || SCHEMA_VERSION;
    var v5Mode = ver >= 5;                                  /* P1-B：按版本分派 v4/v5 规则 */
    var errors = [];
    if (!isObj(obj)) return { ok: false, errors: ['不是一个对象'] };
    if (obj.schemaVersion !== ver) errors.push('schemaVersion 必须为 ' + ver + '，实际为 ' + obj.schemaVersion);
    ['customers', 'products', 'documents', 'communications', 'quotesArchive', 'checkins'].forEach(function (k) {
      if (!isArr(obj[k])) errors.push('缺少数组 ' + k);
    });
    if (!isObj(obj.settings)) errors.push('缺少 settings 对象');
    if (!isObj(obj.migration)) errors.push('缺少 migration 对象');
    validateCounters(obj.counters, errors);
    validateCommunications(obj.communications, errors);
    if(isObj(obj.settings) && obj.settings.learningRecords!==undefined)errors=errors.concat(validateLearningRecords(obj.settings.learningRecords).errors);
    if(isArr(obj.products))obj.products.forEach(function(p,i){
      if(p && p.imageData!=null && p.imageData!=='' && (typeof p.imageData!=='string' || p.imageData.length>1000100 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.imageData)))errors.push('products['+i+'] 图片必须是受限本地PNG/JPEG');
      /* P1-D-05：独立可选实物图字段（不升级 Schema V5，沿用产品图片同一套白名单约束）。 */
      if(p && p.realImageData!=null && p.realImageData!=='' && (typeof p.realImageData!=='string' || p.realImageData.length>1000100 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.realImageData)))errors.push('products['+i+'] 实物图必须是受限本地PNG/JPEG');
      /* P1-D-05-FIX-01：实物图三态字段（可选）。缺省=auto，兼容阶段二及更早数据，不升级 Schema。 */
      if(p && p.realImageMode!=null && p.realImageMode!=='' && ['auto','custom','none'].indexOf(p.realImageMode)<0)errors.push('products['+i+'] 实物图状态只能是 auto/custom/none');
      /* v5：产品库成本字段与报价行同一套校验（规格描述/单位成本/成本确认态） */
      if (v5Mode && isObj(p)) validateV5RowKeys(p, 'products[' + i + '].', errors);
      /* P1-RC-DB：产品多图与扩展文本（可选，不升级 Schema） */
      validateProductImages(p, 'products[' + i + '].', errors);
      validateProductExtraText(p, 'products[' + i + '].', errors);
    });
    /* P1-RC-DB：客户扩展字段（可选） */
    if (isArr(obj.customers)) {
      obj.customers.forEach(function (c, i) { validateCustomerExtras(c, 'customers[' + i + '].', errors); });
    }
    /* P1-RC-DB：供应商与供应商报价（_unknown 受控结构，可选） */
    validateSuppliers(obj, errors);

    if (isArr(obj.documents)) {
      for (var i = 0; i < obj.documents.length; i++) {
        validateDocumentStrict(obj.documents[i], i, errors, v5Mode);
        if (errors.length > 20) { errors.push('（错误过多，已截断）'); break; }
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }


  function parseNo(no) {
    var m = NO_RE.exec(String(no || ''));
    if (!m) return null;
    return { type: m[1], ym: m[2], seq: parseInt(m[3], 10) };
  }

  /* 旧式单号（例如 SB+年月+3位）：不是异常，只是"不是新格式"，保留不改写 */
  var LEGACY_NO_RE = /^[A-Z]{2,}[0-9]{6,}$/;

  function classifyNo(no) {
    if (no == null || String(no).trim() === '') return 'empty';
    var s = String(no);
    if (parseNo(s)) return 'new';
    if (LEGACY_NO_RE.test(s)) return 'legacy';
    return 'odd';
  }

  /*
   * 单号体检。两个要点：
   *   1. 重复只在"同一个集合内部"判定 —— 同一张单既在 documents 又在 quotesArchive，
   *      跨集合比对会把每一张都算成重复。
   *   2. 区分"旧格式"和"异常"：SB202609001 是有意为之的旧编号，保留即可；
   *      含中文/空格之类的才是真异常，需要人工看。
   */
  function collectNoIssues(data) {
    /* 先在各自集合内部判重，再把同一个单号的结论合并成一条（记录出现在哪些集合里），
       避免"同一张单在 documents 与 quotesArchive 各算一次重复"这种噪音。 */
    var byNo = {};
    ['documents', 'quotesArchive'].forEach(function (key) {
      var src = (data && isArr(data[key])) ? data[key] : [];
      var seen = {};
      src.forEach(function (d) {
        var n = d && d.no;
        if (n == null || String(n).trim() === '') return;
        var k = String(n);
        seen[k] = (seen[k] || 0) + 1;
      });
      Object.keys(seen).forEach(function (k) {
        if (seen[k] <= 1) return;
        if (!byNo[k]) byNo[k] = { no: k, count: 0, in: [] };
        if (seen[k] > byNo[k].count) byNo[k].count = seen[k];
        if (byNo[k].in.indexOf(key) < 0) byNo[k].in.push(key);
      });
    });
    var duplicates = Object.keys(byNo).map(function (k) { return byNo[k]; });

    var anomalies = [];
    var legacyFormat = [];
    var seenCat = {};
    var all = [];
    if (data && isArr(data.documents)) all = all.concat(data.documents.map(function (d) { return d && d.no; }));
    if (data && isArr(data.quotesArchive)) all = all.concat(data.quotesArchive.map(function (d) { return d && d.no; }));
    all.forEach(function (no) {
      var c = classifyNo(no);
      var key = c + '|' + String(no);
      if (seenCat[key]) return;
      seenCat[key] = 1;
      if (c === 'odd') anomalies.push(String(no));
      else if (c === 'empty') anomalies.push('（空单号）');
      else if (c === 'legacy') legacyFormat.push(String(no));
    });

    return { duplicates: duplicates, anomalies: anomalies, legacyFormat: legacyFormat };
  }

  /*
   * 分配新单号。
   * 规则：counters[type][YYYYMM] 持久计数；月份来自单据日期；
   *       已分配序号不因删除回收，允许跳号；
   *       分配前对「现存全部历史单号 + 已有单据」做全量冲突检查，不假设旧号都是某个前缀。
   * 返回 {ok, no, type, ym, seq}；不修改入参（调用方拿到 seq 后自行写 counters）。
   */
  function allocateNo(data, type, dateStr) {
    if (DOC_TYPES.indexOf(type) < 0) return { ok: false, error: '未知单据类型：' + type };
    var ym = ymFromDate(dateStr || dayKey());

    var taken = {};
    if (data && isArr(data.documents)) data.documents.forEach(function (d) { if (d && d.no != null) taken[String(d.no)] = 1; });
    if (data && isArr(data.quotesArchive)) data.quotesArchive.forEach(function (d) { if (d && d.no != null) taken[String(d.no)] = 1; });

    var seq = 0;
    if (data && isObj(data.counters) && isObj(data.counters[type]) && finite(data.counters[type][ym])) {
      seq = data.counters[type][ym];
    }
    /* 现存同类型同月份的历史号可能比 counters 更大（比如手工导入过），抬高下限 */
    Object.keys(taken).forEach(function (no) {
      var p = parseNo(no);
      if (p && p.type === type && p.ym === ym && p.seq > seq) seq = p.seq;
    });

    var guard = 0;
    do {
      seq += 1;
      guard += 1;
      if (guard > 1000000) return { ok: false, error: '单号分配连续冲突，已停止' };
    } while (taken[type + '-' + ym + '-' + pad(seq, 4)]);

    return { ok: true, no: type + '-' + ym + '-' + pad(seq, 4), type: type, ym: ym, seq: seq };
  }

  /* ---------- 新单据构造与校验 ---------- */

  function checkNum(name, v, label, errors) {
    if (v == null || v === '') return;              /* 空值按 0 处理，不算错 */
    if (!finite(+v)) { errors.push(label + '不是有效数字（' + name + '）'); return; }
    var lim = LIMITS[name];
    var n = +v;
    if (lim && (n < lim.min || n > lim.max)) errors.push(label + '超出允许范围 ' + lim.min + '~' + lim.max + '（' + name + '）');
  }

  /*
   * 校验一批明细（新写入用）。返回 {ok, error, items}，items 为规范化后的副本。
   * type 决定分支（v4/D3-A）：
   *   · 金额类（QT/PI/SC/CI，默认）：单价/金额参与校验与计算；hsCode 仅 CI/SC 落入；
   *   · PL：**不产出 price/amount**（纸面无金额列，转换时也不把价格带进 PL）；
   *     qty/unit 仍必填；包装四件套 null/空 = 待补草稿，填了就必须合法
   *     （正整数/>0/≥net/非有限拒，0 视为"伪装已填"）。
   */
  function validateItems(items, type) {
    var errors = [];
    if (!isArr(items) || !items.length) return { ok: false, error: '至少要有一行明细' };
    var isPL = type === 'PL';
    var withHs = type === 'CI' || type === 'SC';
    var out = [];
    items.forEach(function (it, i) {
      if (!isObj(it)) { errors.push('第 ' + (i + 1) + ' 行不是对象'); return; }
      var label = '第 ' + (i + 1) + ' 行 ';
      checkNum('mesh', it.mesh, label + '目数', errors);
      checkNum('wire', it.wire, label + '丝径', errors);
      checkNum('width', it.width, label + '幅宽', errors);
      checkNum('rollLen', it.rollLen, label + '卷长', errors);
      checkNum('qty', it.qty, label + '数量', errors);
      if (!isPL) checkNum('price', it.price, label + '单价', errors);
      if (isPL) validatePlRowPackaging(it, label, errors);
      var nameCn = String(it.nameCn != null ? it.nameCn : (it.desc != null ? it.desc : '')).trim();
      if (!nameCn) errors.push(label + '品名不能为空');
      var qty = +it.qty || 0, price = isPL ? 0 : (+it.price || 0);
      var row = {
        productId: it.productId || null,
        nameCn: nameCn,
        nameEn: String(it.nameEn || ''),
        mesh: +it.mesh || 0,
        wire: +it.wire || 0,
        width: +it.width || 0,
        rollLen: +it.rollLen || 0,
        qty: qty,
        /* D2-F3：单位不再默认 ㎡——没有就留空，由界面明确提示"待补全"，
           避免把未知单位的行当成按平方米计价显示/打印 */
        unit: String(it.unit == null ? '' : it.unit)
      };
      if (withHs) row.hsCode = String(it.hsCode == null ? '' : it.hsCode);
      if (isPL) {
        /* 包装四件套：null = 待补；PL 不算金额 */
        PL_PACKAGING_KEYS.forEach(function (f) {
          var raw = it[f];
          row[f] = (raw == null || raw === '') ? null : +raw;
        });
      } else {
        row.price = price;
        row.amount = round2(qty * price);
      }
      out.push(row);
    });
    return { ok: errors.length === 0, error: errors.join('；'), items: out };
  }

  /* ============================================================
   * 编辑合并：只替换用户明确改过的字段，其余一律保留
   * （D2-F1：行/客户/合计的直接扩展键与 _unknown 都曾被打散重建后丢掉）
   * ============================================================ */
  var CUSTOMER_KEYS = ['id', 'name', 'company', 'country', 'address'];
  var TOTALS_KEYS = ['subtotal', 'grand', 'computedFromItems', 'previousGrand'];
  var PACKAGING_TOTALS_KEYS = ['packages', 'net', 'gross', 'volume'];

  /* 取出"已知键之外"的扩展字段（_unknown 单独处理，不在这里） */
  function extrasOf(obj, keys) {
    var out = {};
    if (!isObj(obj)) return out;
    Object.keys(obj).forEach(function (k) {
      if (keys.indexOf(k) >= 0 || k === '_unknown') return;
      out[k] = clone(obj[k]);
    });
    return out;
  }
  /* over 覆盖 base（编辑副本优先于当前值） */
  function mergeExtras(base, over) {
    var out = {};
    if (isObj(base)) Object.keys(base).forEach(function (k) { out[k] = clone(base[k]); });
    if (isObj(over)) Object.keys(over).forEach(function (k) { out[k] = clone(over[k]); });
    return out;
  }
  /* 行身份：优先 id / _rowId，其次"规格签名"（能正确处理重排），都匹配不上就当新行，
     宁可不带，也不能按索引把别行的扩展内容带错。 */
  function rowIdentity(it) {
    if (!isObj(it)) return null;
    if (typeof it.id === 'string' && it.id) return 'id:' + it.id;
    if (typeof it._rowId === 'string' && it._rowId) return 'id:' + it._rowId;
    return null;
  }
  function rowSignature(it) {
    if (!isObj(it)) return '';
    return ['productId', 'nameCn', 'nameEn', 'mesh', 'wire', 'width', 'rollLen', 'unit']
      .map(function (k) { return String(it[k] == null ? '' : it[k]); }).join('|');
  }
  /* 草稿行 → 当前行 的配对结果（未配到为 null） */
  function matchRows(curItems, srcItems) {
    var cur = isArr(curItems) ? curItems : [];
    var src = isArr(srcItems) ? srcItems : [];
    var byId = {}, sigQ = {};
    cur.forEach(function (it, i) {
      var id = rowIdentity(it);
      if (id && byId[id] === undefined) byId[id] = i;
      var sg = rowSignature(it);
      if (sg) (sigQ[sg] = sigQ[sg] || []).push(i);
    });
    var taken = {};
    return src.map(function (s) {
      var idx = null;
      var id = rowIdentity(s);
      if (id && byId[id] !== undefined && !taken[byId[id]]) idx = byId[id];
      if (idx === null) {
        var sg = rowSignature(s);
        if (sg && sigQ[sg]) {
          while (sigQ[sg].length && taken[sigQ[sg][0]]) sigQ[sg].shift();
          /* D2-R2：签名歧义时不猜配——同一规格有多条现存行、本行又没有稳定身份，
             配到哪一条都是猜；逆序/增删后会互相把扩展字段串到对方行上。
             宁可不配（完整草稿自带全部字段，base=null 时按草稿自身保留），
             也不能按排队顺序错配。 */
          if (sigQ[sg].length === 1) idx = sigQ[sg].shift();
        }
      }
      if (idx !== null) taken[idx] = true;
      return idx === null ? null : cur[idx];
    });
  }
  /*
   * 把校验后的行与来源行的扩展字段合并：
   *   base（当前行，仅身份可确认时） → src（编辑副本） → 已知字段（规范化后的值）
   * curItems 传 null 表示新建路径（没有"当前行"可参照）。
   */
  function finalizeItems(srcItems, validated, curItems) {
    var bases = curItems ? matchRows(curItems, srcItems) : [];
    return (validated || []).map(function (row, i) {
      var src = isArr(srcItems) ? srcItems[i] : null;
      var base = bases[i] || null;
      var merged = mergeExtras(extrasOf(base, ITEM_KEYS), extrasOf(src, ITEM_KEYS));
      ITEM_KEYS.forEach(function (k) { if (row[k] !== undefined) merged[k] = row[k]; });
      var unk = mergeExtras(base && base._unknown, src && src._unknown);
      if (Object.keys(unk).length) merged._unknown = unk;
      return merged;
    });
  }
  /* 客户快照：同一客户（id 都为空或相等）才并入当前快照的扩展字段；
     客户被明确切换时，旧客户的扩展信息一律不带过去（不能把上一客户的地址拼到新客户上）。
     D2-R1：_unknown 与直接扩展同一套规则——同一客户才把旧快照的未知字段（含嵌套对象）
     并回来；明确切换客户时连旧快照的 _unknown 一并清除（编辑器切换客户本就会重建
     客户快照，不含未知字段；宁可不带，也不能把上一个客户的未知数据混到新客户上）。 */
  function finalizeCustomer(curCust, patchCust) {
    if (patchCust === null) return { id: null, name: '', company: '', country: '', address: '' };
    var cid = (patchCust.id == null || patchCust.id === '') ? null : String(patchCust.id);
    var cur = isObj(curCust) ? curCust : {};
    var curId = (cur.id == null || cur.id === '') ? null : String(cur.id);
    var same = (cid && curId && cid === curId) || (!cid && !curId);
    var kept = same ? extrasOf(cur, CUSTOMER_KEYS) : {};
    var over = extrasOf(patchCust, CUSTOMER_KEYS);
    /* address（B2 新增）：草稿没带这一栏时沿用原客户的地址，不因为保存把它清成空 */
    var addr = (patchCust.address !== undefined) ? String(patchCust.address == null ? '' : patchCust.address)
      : (same ? String(cur.address == null ? '' : cur.address) : '');
    var out = {
      id: cid,
      name: String(patchCust.name || ''),
      company: String(patchCust.company || ''),
      country: String(patchCust.country || ''),
      address: addr
    };
    Object.keys(kept).forEach(function (k) { out[k] = kept[k]; });
    Object.keys(over).forEach(function (k) { out[k] = over[k]; });
    var unk = same ? mergeExtras(cur._unknown, patchCust._unknown) : {};
    if (Object.keys(unk).length) out._unknown = unk;
    return out;
  }
  /* 合计：重算四个已知键，其余（如历史留下的自定义合计字段）原样保留。
     D2-R1：_unknown 一并保留（含嵌套对象）——重算只动 subtotal/grand/computedFromItems/
     previousGrand 四个键，历史留在合计里的未知数据不因保存而丢失；
     草稿显式带了 totals._unknown 时以草稿为准（与行/客户的"草稿优先"同一口径）。 */
  function finalizeTotals(curTotals, next, prevGrand, patchTotals) {
    var out = extrasOf(isObj(curTotals) ? curTotals : null, TOTALS_KEYS);
    var unk = mergeExtras(isObj(curTotals) ? curTotals._unknown : null, isObj(patchTotals) ? patchTotals._unknown : null);
    if (Object.keys(unk).length) out._unknown = unk;
    out.subtotal = next.subtotal;
    out.grand = next.grand;
    out.computedFromItems = next.grand;
    out.previousGrand = prevGrand;
    return out;
  }

  /*
   * PL 汇总口径的保留策略（v4）：
   *   · 重算四个包装汇总键（packages/net/gross/volume），缺项为 null（待补）；
   *   · 历史遗留的金额键（subtotal/grand 等，迁移来的旧 PL 单可能有）**原样保留不删除**，
   *     也不重算——纸面不印它们，但磁盘上不静默丢原值（复审第 3 条）；
   *   · 自定义键与 _unknown 同 D2-R1 规则保留。
   */
  function finalizePackagingTotals(curTotals, summary) {
    var out = extrasOf(isObj(curTotals) ? curTotals : null, TOTALS_KEYS.concat(PACKAGING_TOTALS_KEYS));
    var unk = mergeExtras(isObj(curTotals) ? curTotals._unknown : null, null);
    if (Object.keys(unk).length) out._unknown = unk;
    PACKAGING_TOTALS_KEYS.forEach(function (k) { out[k] = summary[k]; });
    return out;
  }

  /*
   * 合计的统一口径（全桌面只有这一处实现：新建、编辑、预览、持久化都走它）。
   * 顺序：先按行 round2(qty × price) 得到行金额，再对行金额求和后 round2 得合计。
   * 边界样例：3 × 1.005 = 3.01（二进制浮点下 1.005 实际存的是略小的数，不是 3.02）。
   */
  function documentTotals(items) {
    var grand = round2((isArr(items) ? items : []).reduce(function (s, it) {
      return s + (isObj(it) ? (+it.amount || 0) : 0);
    }, 0));
    return { subtotal: grand, grand: grand };
  }

  /* 体积汇总保留 3 位、重量保留 2 位（与纸面 toFixed 口径一致，D3-A 装箱规则 §2） */
  function round3(v) { return Math.round((+v || 0) * 1000) / 1000; }

  /*
   * ★ PL 包装汇总（全桌面唯一实现：新建、编辑、预览、导出都走它）。
   * 规则（D3-A A5 + 复审第 4 条 + D3-B1 修复 R1）：
   *   · separate（各行包装不重叠）：总件数 = Σ 行 packages；混装时逐行求和会重复计数，禁用；
   *   · mixed（存在混装）：总件数 = 单据级 totalPackages（用户确认录入），行 packages 不参加总件数；
   *   · 模式未知（null）：**总件数 = null（待确认）**，绝不按 separate 口径自动相加冒充已确认；
   *     草稿可存，但导出前必须选定模式；
   *   · 净重/毛重/体积：逐行是该行货物合计，**输入齐全才汇总**，任一行待补 → 该项 null（待补）；
   *     与包装模式无关，模式未定也可独立汇总；
   *   · 不做"每箱净重"这类派生值。
   * 返回 { packages, net, gross, volume }，缺项为 null。
   */
  function packagingTotals(items, mode, totalPackages) {
    var rows = (isArr(items) ? items : []).filter(isObj);
    function allHave(f) { return rows.length > 0 && rows.every(function (r) { return r[f] != null && finite(+r[f]) && +r[f] > 0; }); }
    function sum(f, rnd) {
      if (!allHave(f)) return null;
      return rnd(rows.reduce(function (s, r) { return s + (+r[f] || 0); }, 0));
    }
    var packages = null;
    if (mode === 'mixed') {
      /* 混装：以用户确认的整单件数为准；未填/不合法 = null 待补，不猜 */
      packages = (totalPackages != null && Number.isInteger(+totalPackages) && +totalPackages > 0) ? +totalPackages : null;
    } else if (mode === 'separate') {
      /* 各行包装不重叠才允许逐行求和 */
      packages = allHave('packages') ? rows.reduce(function (s, r) { return s + (+r.packages || 0); }, 0) : null;
    } else {
      /* 模式未知（null 或其它未识别值）：总件数一律 null，不能自动相加冒充已确认（R1） */
      packages = null;
    }
    return {
      packages: packages,
      net: sum('net', round2),
      gross: sum('gross', round2),
      volume: sum('volume', round3)
    };
  }

  /*
   * 导出阶段校验（B3 受控 PDF 与 B2 导出按钮共用）。
   * 返回 { ok, errors, warnings }：
   *   · errors   = 不许导出（PL 包装不齐/模式未选/混装缺总件数/基础校验不过）
   *   · warnings = 缺项清单（CI/SC 的 HS/运输/签订信息、卖方快照、银行资料等），
   *                纸面对应位置如实印"（待补）"，由用户确认后决定是否导出。
   * PL 规则按包装模式区分（D3-A A5 + 复审第 4 条 + D3-B1 修复 R2）：
   *   · separate：每行 packages/net/gross/volume 四项必填；
   *   · mixed：每行 net/gross/volume 必填、packages 可待补（不进总件数），
   *     整单 totalPackages 必须是正整数；
   *   · null（未选模式）：一律拒绝正式导出，不猜总件数；
   *   · 填了的值仍过基础校验（有限/>0/整数/毛重≥净重），不给确认框绕过。
   */
  function validateForExport(doc) {
    var errors = [];
    var warnings = [];
    if (!isObj(doc)) return { ok: false, errors: ['单据不是对象'], warnings: warnings };
    /* 基础校验（保存级）：先过一遍，不让非法数据进纸面 */
    var base = validateDocument(doc, 'export');
    base.errors.forEach(function (e) { errors.push(e); });
    var selected=doc._unknown&&doc._unknown.quoteLayout&&doc._unknown.quoteLayout.templateId;
    if(selected==='shipping-mark-v1'){
      var label=doc._unknown&&doc._unknown.referenceFields||{};
      ['labelProduct','labelSpecs','labelQty','labelNet','labelGross','labelConsignee','labelOrigin'].forEach(function(k){if(typeof label[k]!=='string'||!label[k].trim())errors.push('唛头缺少 '+k);});
      var net=Number(label.labelNet),gross=Number(label.labelGross);
      if(!isFinite(net)||net<=0||!isFinite(gross)||gross<net)errors.push('唛头净重与毛重请填kg数字，净重须大于0，毛重不能小于净重');
      return {ok:errors.length===0,errors:errors,warnings:warnings};
    }

    var type = doc.type;
    if (type === 'PL') {
      var rows = isArr(doc.items) ? doc.items : [];
      if (!rows.length) errors.push('装箱单至少要有一行明细');
      var mode = doc.packagingMode;
      /* 模式未定（null）：不允许正式导出——总件数不能靠猜（D3-B1 修复 R1/R2） */
      if (mode == null) {
        errors.push('还没有选择包装模式（各行包装不重叠 / 存在混装）——导出前必须明确');
      }
      rows.forEach(function (it, i) {
        var label = '第 ' + (i + 1) + ' 行';
        /* 净重/毛重/体积：两种模式都必填（混装只豁免逐行件数） */
        ['net', 'gross', 'volume'].forEach(function (f) {
          if (it[f] == null) errors.push(label + '缺少' + ({ net: '净重', gross: '毛重', volume: '体积' })[f] + '（待补，导出前必须填实际值）');
        });
        /* 件数：separate 逐行必填（各行包装不重叠，Σ 行件数即总件数）；
           mixed 以整单 totalPackages 为准，行 packages 可待补、不进总件数（R2） */
        if (mode === 'separate' && it.packages == null) {
          errors.push(label + '缺少包装件数（各行包装不重叠，导出前必须填实际件数）');
        }
      });
      /* 混装：整单总件数必须是用户确认的正整数（R2） */
      if (mode === 'mixed' && (doc.totalPackages == null || !Number.isInteger(+doc.totalPackages) || +doc.totalPackages <= 0)) {
        errors.push('混装单必须填写整单总包装件数（totalPackages，正整数，用户确认值）');
      }
    }
    if (type === 'CI' || type === 'SC') {
      var missHs = (isArr(doc.items) ? doc.items : []).some(function (it) { return !it || it.hsCode == null || String(it.hsCode).trim() === ''; });
      if (missHs) warnings.push('有明细行缺少 HS 编码（清关需要，请按实际税则填写）');
    }
    if (type === 'CI') {
      ['shipment', 'vessel', 'origin'].forEach(function (k) {
        if (doc[k] == null || String(doc[k]).trim() === '') warnings.push('缺少' + ({ shipment: '运输方式', vessel: '船名/航次', origin: '原产地声明' })[k] + '（纸面将标注待补）');
      });
    }
    if (type === 'SC') {
      if (doc.signDate == null || doc.signDate === '') warnings.push('缺少签订日期（纸面将标注待补）');
      if (doc.signPlace == null || doc.signPlace === '') warnings.push('缺少签订地点（纸面将标注待补）');
      if (doc.contractTerms == null || String(doc.contractTerms).trim() === '') warnings.push('合同条款还是空的（双方约定内容需自行录入）');
    }
    if (type === 'PI' || type === 'CI' || type === 'SC') {
      if (doc.bank == null || String(doc.bank).trim() === '') warnings.push('银行资料未填（Beneficiary / Bank / Account / SWIFT）');
    }
    if (!isObj(doc.seller) || !doc.seller) warnings.push('卖方信息快照缺失（纸面抬头将标注待补）');
    else if (!String(doc.seller.company || '').trim()) warnings.push('卖方快照缺少公司名');
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  /*
   * 单单据保存级校验（save/导入/恢复与导出前基础检查共用）。
   * stage: 'save' | 'export' —— 本期两者规则一致；保留参数是为将来
   * "保存放宽、导出收紧"的分阶段语义留口（复审第 3 条）。
   */
  function validateDocument(doc, stage) {
    var errors = [];
    void stage;
    validateDocumentStrict(doc, 0, errors);
    return { ok: errors.length === 0, errors: errors };
  }

  /*
   * 由旧式报价对象构造 v3 单据（新写入路径）。
   * 客户信息按值快照进单据，后续改客户/产品不会反向改动历史单据。
   */
  function quoteToDocument(q, no, id) {
    var v = validateItems(q.items);
    if (!v.ok) return { ok: false, error: v.error };
    var items = v.items;
    var t = documentTotals(items);
    var cust = q.customer && typeof q.customer === 'object' ? q.customer : null;
    return {
      ok: true,
      doc: {
        id: id,
        no: no,
        type: 'QT',
        date: q.date || dayKey(),
        sourceId: q.sourceId || null,
        customer: {
          id: cust && cust.id ? cust.id : null,
          name: cust ? String(cust.name || '') : String(q.attn || ''),
          company: cust ? String(cust.company || '') : String(q.customer || ''),
          country: cust ? String(cust.country || '') : String(q.country || ''),
          address: cust ? String(cust.address || '') : ''
        },
        items: items,
        currency: q.currency || 'USD',
        term: q.term || '',
        payment: q.payment || '',
        validity: q.validity || '',
        /* v4 新键：QT 新建时显式落默认值（待补/空），B2 编辑器再按类型显隐 */
        delivery: q.delivery || '',
        remark: q.remark || '',
        seller: isObj(q.seller) ? {
          company: String(q.seller.company == null ? '' : q.seller.company),
          contact: String(q.seller.contact == null ? '' : q.seller.contact),
          address: String(q.seller.address == null ? '' : q.seller.address)
        } : null,
        bank: q.bank || '',
        buyerAddress: q.buyerAddress || '',
        marks: q.marks || '',
        shipment: q.shipment || '',
        vessel: q.vessel || '',
        origin: q.origin || '',
        contractTerms: q.contractTerms || '',
        signDate: q.signDate || '',
        signPlace: q.signPlace || '',
        packagingMode: null,
        totalPackages: null,
        /* v5（P1-B-FIX-01）：新建单据由默认值补齐定价参数（null=未记录）与 fees=[]。
           BUG-02 收紧后写门拒绝"fees 缺失"，addQuote 兼容路径不经 writeDocument
           （不走 withV4DocDefaults），必须在这里显式落默认值，否则新建报价单会被误拦。 */
        fx: null, feeRate: null, targetMargin: null, commissionRate: null,
        freightMarkup: null, markupRate: null, feeInPrice: null, pricingVersion: null,
        fees: [],
        totals: { subtotal: t.subtotal, grand: t.grand },
        createdAt: q.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  /*
   * ================================================================
   * 复制 / 转换（D3-A 转换矩阵补正版；B2 落地）
   *
   * 硬规则（证据/D3-A/转换矩阵.md）：
   *   · 点击「复制 / 转换」只构造**未保存草稿**：不取号、不写库、不占 counters；
   *     首次保存才走 Store.addDocument（事务内取号 + 占号 + 原子落盘）；
   *   · sourceId 指向**直接**来源单；行身份 _rowId 重新分配（新单是独立对象）；
   *   · 源单一个字节都不动——本函数不修改任何入参；
   *   · 金额类（QT/PI/SC/CI）两两之间任意互转 + 各自→PL + 五类同类复制；
   *   · PL→金额类本轮**不提供**（PL 无单价/金额，缺价格来源——产品范围限制）；
   *   · 工具不声称状态：转换不赋予"已签署/已发货/已收款"含义。
   * ================================================================ */
  var CONVERSION_MATRIX = {
    QT: ['QT', 'PI', 'SC', 'CI', 'PL'],
    PI: ['QT', 'PI', 'SC', 'CI', 'PL'],
    SC: ['QT', 'PI', 'SC', 'CI', 'PL'],
    CI: ['QT', 'PI', 'SC', 'CI', 'PL'],
    PL: ['PL']
  };
  function conversionTargets(fromType) {
    var list = CONVERSION_MATRIX[fromType];
    return list ? list.slice() : [];
  }
  function canConvert(fromType, toType) {
    return conversionTargets(fromType).indexOf(toType) >= 0;
  }
  /* 转换/复制时行身份重新分配（D3-A 关键决定 2：不复用源行身份） */
  function newRowId() {
    return 'row-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  /*
   * 按转换矩阵把来源单构造成目标类型的**未保存草稿**。
   * 返回 { ok, draft, from, to } 或 { ok:false, error }。
   * 逐字段映射规则见矩阵 §3/§4：同语义扩展无损、目标不适用的键回到空默认、
   * SC 签订日期地点清空、CI 运输三项空待补、→PL 剥价格并清包装待补。
   */
  function buildConversionDraft(src, toType) {
    if (!isObj(src)) return { ok: false, error: '来源单据不是对象' };
    var from = src.type;
    if (DOC_TYPES.indexOf(from) < 0) return { ok: false, error: '来源单据类型未知：' + from };
    if (DOC_TYPES.indexOf(toType) < 0) return { ok: false, error: '目标类型未知：' + toType };
    if (!canConvert(from, toType)) {
      if (from === 'PL') return { ok: false, error: '装箱单没有单价和金额，不能直接转换成金额类单据——请回到上游的报价单/发票/合同上改' };
      return { ok: false, error: '本轮不提供 ' + from + ' → ' + toType + ' 的转换' };
    }
    if (!isArr(src.items) || !src.items.length) return { ok: false, error: '来源单据没有明细行，没法转换' };

    var sameType = from === toType;
    var toPL = toType === 'PL';
    var now = new Date().toISOString();

    /* 行：标识/规格/数量原样带；按目标类型决定 price/amount/hsCode/包装四件套的去留 */
    var items = [];
    if (src.items.some(function (it) { return !isObj(it); })) {
      return { ok: false, error: '来源单据存在异常明细，已停止转换，不会跳过该行' };
    }
    src.items.forEach(function (it) {
      var row = clone(it);
      row._rowId = newRowId();
      delete row.id;
      if (toPL) {
        delete row.price; delete row.amount; delete row.hsCode;
        /* v5（P1-B）：成本快照与规格描述**显式剥离**，不允许成本字段随整行克隆进入 PL——
           在转换数据层剥掉，不依赖 sheet.js 不渲染未知字段来保护。 */
        V5_ROW_KEYS.forEach(function (f) { delete row[f]; });
        if (!sameType) {
          /* 金额类→PL：包装事实只能来自实际装箱，严禁从 qty 猜——一律待补 */
          row.packages = null; row.net = null; row.gross = null; row.volume = null;
        }
        /* 同类 PL 复制：包装四件套原样带（编辑器提示重新核对实际装箱） */
      } else {
        delete row.packages; delete row.net; delete row.gross; delete row.volume;
        if (toType === 'QT' || toType === 'PI') delete row.hsCode;   /* QT/PI 纸面无 HS 列 */
        /* v5（P1-B）：金额类目标（QT/PI/SC/CI）整行克隆自然带成本快照与 specText——
           转换是"历史快照延续"，产品库后续修改不影响已转出的单据行。 */
      }
      items.push(row);
    });

    var draft = clone(src);
    draft.id = null;
    draft.no = '';
    draft.type = toType;
    draft.date = dayKey();
    draft.sourceId = (src.id == null || src.id === '') ? null : String(src.id);
    draft.createdAt = now;
    draft.updatedAt = now;
    draft.items = items;

    /* 卖方快照：复制/转换沿用源快照（编辑器里可显式刷新，见字段表 §6.1） */
    draft.seller = isObj(src.seller) ? clone(src.seller) : null;
    /* 客户与买方地址：同一买方延续——转换不是"切换客户"，D2 切换规则不适用 */
    draft.customer = isObj(src.customer) ? clone(src.customer) : { id: null, name: '', company: '', country: '', address: '' };
    if (src.buyerAddress != null) draft.buyerAddress = String(src.buyerAddress);
    /* 通用文本字段逐字段延续（validity 与 delivery 各自独立，不互转——A1） */
    ['currency', 'term', 'payment', 'validity', 'delivery', 'remark'].forEach(function (k) {
      draft[k] = src[k] == null ? '' : String(src[k]);
    });

    /* 银行（§3.5 同类复制原样带 + 编辑器核对提示；§4.1 跨类仅 PI/SC/CI 目标"源有则带"；PL 不使用） */
    if (toPL) {
      draft.bank = '';
    } else if (sameType || toType === 'PI' || toType === 'SC' || toType === 'CI') {
      draft.bank = src.bank == null ? '' : String(src.bank);
    } else {
      draft.bank = '';
    }
    /* 唛头：PL 使用；同类 PL 复制原样带，其余一律空待补（唛头通常发货前才定） */
    draft.marks = (toPL && sameType && src.marks != null) ? String(src.marks) : '';
    /* 运输三项：仅 CI；同类 CI 复制原样带，跨类一律空——运输事实不能从上游单据猜 */
    if (toType === 'CI' && sameType) {
      draft.shipment = src.shipment == null ? '' : String(src.shipment);
      draft.vessel = src.vessel == null ? '' : String(src.vessel);
      draft.origin = src.origin == null ? '' : String(src.origin);
    } else {
      draft.shipment = ''; draft.vessel = ''; draft.origin = '';
    }
    /* 合同条款与签订信息：仅 SC；同类 SC 复制条款显式带入、签订日期地点清空（新单是待签草稿）；
       跨类转 SC 只认源 SC 的显式条款，不套任何默认法律模板 */
    if (toType === 'SC') {
      draft.contractTerms = (from === 'SC' && src.contractTerms != null) ? String(src.contractTerms) : '';
      draft.signDate = '';
      draft.signPlace = '';
    } else {
      draft.contractTerms = ''; draft.signDate = ''; draft.signPlace = '';
    }
    /* 包装模式与整单总件数：仅 PL；同类 PL 复制原样带，跨类一律 null 待补 */
    if (toPL) {
      draft.packagingMode = (sameType && src.packagingMode != null) ? src.packagingMode : null;
      draft.totalPackages = (sameType && src.totalPackages != null) ? src.totalPackages : null;
    } else {
      draft.packagingMode = null;
      draft.totalPackages = null;
    }

    /* 合计：金额类按明细重算并留证源单原合计（previousGrand）；PL 只有包装汇总，无金额总计 */
    if (toPL) {
      var psum = packagingTotals(items, draft.packagingMode, draft.totalPackages);
      draft.totals = { packages: psum.packages, net: psum.net, gross: psum.gross, volume: psum.volume };
    } else {
      /* documentTotals 吃的是**行金额**（amount），不能直接喂 qty/price——先按统一口径算行金额 */
      var t = documentTotals(items.map(function (it) {
        return { amount: round2((+it.qty || 0) * (+it.price || 0)) };
      }));
      var prevGrand = (isObj(src.totals) && finite(src.totals.grand)) ? src.totals.grand : null;
      draft.totals = finalizeTotals(src.totals, t, prevGrand, src.totals);
    }

    /* v5（P1-B-FIX-01 BUG-01）：目标为 PL 时，除行级成本字段外，单据级内部定价数据
       **显式剥离**——fx/feeRate/targetMargin/commissionRate/freightMarkup/markupRate/
       feeInPrice/pricingVersion/fees 九个键一并删除。PL 是无金额单据，定价参数与
       装箱事实无关，不能随整单克隆悄悄带进 PL；同类 PL→PL 复制同样执行。
       sourceId 在上方已显式赋值，不在剥离之列；QT→PI/SC/CI 的快照延续不受影响。 */
    if (toPL) {
      V5_DOC_PRICING_KEYS.forEach(function (k) { delete draft[k]; });
      delete draft.fees;
      /* P1-C-FIX-01 BUG-05：内部核价扩展字段（_unknown.pricing：内部运费/折扣/other_charges/
         incoterm/namedPlace）一并剥离——PL 是无金额装箱单，不能把核价内部数据随整单克隆带进来；
         QT→PI/SC/CI 与 PL→PL 同样执行。其余 _unknown 历史扩展键（如 quoteLayout、
         referenceFields、用户自有键）原样保留；sourceId 与包装字段不在剥离之列。 */
      if (isObj(draft._unknown) && draft._unknown.pricing !== undefined) {
        delete draft._unknown.pricing;
        if (!Object.keys(draft._unknown).length) delete draft._unknown;
      }
    }

    /* P1-D-04：五类单据统一使用 RunCheng 黑白版式后，转换不再清理 quoteLayout.templateId——
       源单的版式声明对目标单据同样适用（同一版式，只是业务内容不同），随整单克隆原样延续。
       BUG-ACC-01 时期这里曾清掉「不适用于非 QT」的 quotation-rc-v1；该前提已随 P1-D-04 取消，
       故删除该清理逻辑，避免转换后的单据丢失版式声明。 */
    return { ok: true, draft: draft, from: from, to: toType };
  }

  /* P1-C（报价编辑器集成）：单据内部定价扩展字段（document._unknown.pricing）受控合并。
     白名单键：incoterm（引擎贸易术语，字符串）/ namedPlace（交货地点）/ freight（运费行数组）/
     extra（折扣与其他费用）。其余内部键一律不放行——不得通过放开任意未知字段写入口解决。
     freight 行结构受控：item（运费项目标识）/ amount（有限非负数字）/ currency（CNY|USD）/
     confirmed / charge_customer / included_in_cost（布尔）。语义校验（两位小数、必核实行等）
     属定价引擎职责，数据层只保证结构安全、不伪造数值：非法数值原样保留为 null 交给引擎阻断。
     extra.discount / other_charges：合法数字保留；其余归 null（"未填写"，由引擎阻断，不静默转 0）。 */
  var P1C_FREIGHT_ROW_KEYS = ['item', 'amount', 'currency', 'confirmed', 'charge_customer', 'included_in_cost'];
  function sanitizePricingExt(p) {
    var out = {};
    if (!isObj(p)) return out;
    if (p.incoterm !== undefined) out.incoterm = (typeof p.incoterm === 'string') ? p.incoterm.toUpperCase().slice(0, 16) : null;
    if (p.namedPlace !== undefined) out.namedPlace = (typeof p.namedPlace === 'string') ? p.namedPlace.slice(0, 200) : null;
    if (p.freight !== undefined) {
      out.freight = isArr(p.freight) ? p.freight.slice(0, 32).map(function (fr) {
        if (!isObj(fr) || typeof fr.item !== 'string' || !fr.item) return null;
        var row = { item: fr.item.slice(0, 40) };
        row.amount = (finite(fr.amount) && fr.amount >= 0) ? fr.amount : null;
        row.currency = (fr.currency === 'CNY' || fr.currency === 'USD') ? fr.currency : null;
        row.confirmed = fr.confirmed === true;
        row.charge_customer = fr.charge_customer === true;
        row.included_in_cost = fr.included_in_cost === true;
        return row;
      }).filter(Boolean) : [];
    }
    if (p.extra !== undefined) {
      var e = isObj(p.extra) ? p.extra : {};
      var num = function (v) { return (finite(v) && v >= 0 && Math.abs(v * 100 - Math.round(v * 100)) <= 1e-6) ? v : null; };
      out.extra = { discount: num(e.discount), other_charges: num(e.other_charges) };
    }
    return out;
  }

  /*
   * 编辑用：把一份「编辑草稿」合并进现有单据（D2 报价编辑闭环的核心纯函数）。
   *
   * 硬规则（对应 D2 任务书第 3 条）：
   *   · 原 ID、单号、类型、来源(sourceId)、日期、创建日期(createdAt) 一律不动 —— 编辑不重新分号；
   *   · 单据级未知字段（_unknown 及一切没被本函数列名的键）原样保留 —— 删字段只能是用户明确操作；
   *   · items 整体替换（增删行都是编辑器里的明确操作），每一行都过 validateItems；
   *   · 行级字段按行身份从草稿合并（id/_rowId 优先，规格签名唯一时兜底，签名歧义不猜配），
   *     重排/增删/改规格都不会把别行的扩展字段串过来（D2-R2）；
   *   · totals 用 documentTotals 统一口径重算，并留下 previousGrand 供留证对比；
   *     totals 的 _unknown 与自定义键原样保留（D2-R1）；
   *   · customer 快照只在草稿显式带了该字段时更新；customer/totals 的 _unknown 与
   *     直接扩展同一套规则保留，明确切换客户时旧客户的未知字段一律清除（D2-R1）；
   *   · term/payment 等同理，没带的键不动；
   *   · updatedAt 刷新；返回新对象，不修改任何入参（调用方在事务里原地替换）。
   */
  function patchDocument(current, patch) {
    if (!isObj(current)) return { ok: false, error: '原单据不是对象，无法更新' };
    if (!isObj(patch)) return { ok: false, error: '更新内容不是对象，无法更新' };
    if (patch.items == null) return { ok: false, error: '缺少商品明细，不能保存一张没有行的报价单' };

    var type = current.type || 'QT';
    var isPL = type === 'PL';

    /* items 按 type 分支过校验：PL 行不产 price/amount、包装四件套可空待补；
       金额类维持 D2 规则（有限数/单位/舍入）。 */
    var v = validateItems(patch.items, type);
    if (!v.ok) return { ok: false, error: v.error };

    var next = clone(current);   // 单据级未知字段 / 未被列名的键全部原样保留

    /* 预览模板的受控自定义列允许显式增删/改名/排序；其他未知字段仍按原规则保留。
       这样不会为了布局功能打开任意顶层字段覆盖口子。 */
    if (isObj(patch._unknown) && patch._unknown.quoteLayout !== undefined) {
      next._unknown = isObj(next._unknown) ? next._unknown : {};
      next._unknown.quoteLayout = sanitizeQuoteLayout(patch._unknown.quoteLayout);
    }
    if(isObj(patch._unknown)&&isObj(patch._unknown.referenceFields)){
      next._unknown=isObj(next._unknown)?next._unknown:{};next._unknown.referenceFields={};
      ['sellerContact','sellerTel','sellerEmail','buyerTel','buyerEmail','packageText','contractNo','packageKind','labelProduct','labelSpecs','labelQty','labelNet','labelGross','labelConsignee','labelOrigin'].forEach(function(k){if(typeof patch._unknown.referenceFields[k]==='string')next._unknown.referenceFields[k]=patch._unknown.referenceFields[k].slice(0,4000);});
    }

    /* P1-C：单据内部定价扩展字段受控合并（_unknown.pricing）。
       编辑器显式带了 pricing 才更新；白名单见 sanitizePricingExt，其余内部键不放行。
       历史单据的其他 _unknown 键不受影响（上方 clone 已原样保留）。 */
    if (isObj(patch._unknown) && patch._unknown.pricing !== undefined) {
      next._unknown = isObj(next._unknown) ? next._unknown : {};
      next._unknown.pricing = sanitizePricingExt(patch._unknown.pricing);
    }

    /* P1-C：单据级 V5 定价字段编辑保存白名单（§八 保存链路补齐）。
       只接受显式给出的键（undefined = 这一栏没改），合并后用 v5 校验把关——
       非法值整次保存失败并给出明确错误，不做静默修正、不放开任意写入口。
       PL 不接受这些键：P1-B-FIX-01 已保证 PL 无内部定价数据，编辑器也不会为 PL 发送。 */
    if (!isPL) {
      V5_DOC_PRICING_KEYS.forEach(function (k) {
        if (patch[k] !== undefined) next[k] = clone(patch[k]);
      });
      if (patch.fees !== undefined) next.fees = clone(patch.fees);
      var p1cErrors = [];
      validateV5DocKeys(next, 'documents', p1cErrors);
      if (p1cErrors.length) return { ok: false, error: p1cErrors.join('；') };
    }

    /* 行：只替换用户明确改过的字段，其余（含直接扩展键与 _unknown）按行身份带回，
       重排/删行不会把别行的内容串过来 */
    var items = finalizeItems(patch.items, v.items, isArr(current.items) ? current.items : null);
    next.items = items;

    /* 客户快照：显式给了才更新（null = 明确清空；对象 = 用新快照覆盖） */
    if (patch.customer !== undefined) {
      if (patch.customer === null) {
        next.customer = { id: null, name: '', company: '', country: '', address: '' };
      } else if (isObj(patch.customer)) {
        next.customer = finalizeCustomer(current.customer, patch.customer);
      } else {
        return { ok: false, error: '客户快照格式不正确（应为对象或 null）' };
      }
    }

    /* 文本字段：显式给了才覆盖，undefined 表示"这栏没改"。
       v4 起含 delivery（交期，与 validity 分槽）、bank/buyerAddress/marks/
       shipment/vessel/origin/contractTerms/signPlace。 */
    V4_DOC_STRING_KEYS.forEach(function (k) {
      if (patch[k] !== undefined) next[k] = String(patch[k] == null ? '' : patch[k]);
    });

    /* 签订日期：合法日期或空 */
    if (patch.signDate !== undefined) {
      var sd = patch.signDate == null ? '' : String(patch.signDate);
      if (sd !== '' && !DATE_RE.test(sd)) return { ok: false, error: '签订日期格式不正确（应为 YYYY-MM-DD）' };
      next.signDate = sd;
    }
    /* 卖方快照：显式给了才更新（对象 = 新快照；null = 明确置为待补） */
    if (patch.seller !== undefined) {
      if (patch.seller === null) {
        next.seller = null;
      } else if (isObj(patch.seller)) {
        next.seller = Object.assign({}, clone(patch.seller), {
          company: String(patch.seller.company == null ? '' : patch.seller.company),
          contact: String(patch.seller.contact == null ? '' : patch.seller.contact),
          address: String(patch.seller.address == null ? '' : patch.seller.address)
        });
      } else {
        return { ok: false, error: '卖方快照格式不正确（应为对象或 null）' };
      }
    }
    /* 包装模式与混装总件数（PL；separate=各行不重叠，mixed=总件数以 totalPackages 为准） */
    if (patch.packagingMode !== undefined) {
      var pm = patch.packagingMode == null ? null : String(patch.packagingMode);
      if (pm !== null && PACKAGING_MODES.indexOf(pm) < 0) return { ok: false, error: '包装模式必须是 separate/mixed 或空（未知）' };
      next.packagingMode = pm;
    }
    if (patch.totalPackages !== undefined) {
      var tp = patch.totalPackages;
      if (tp != null && tp !== '') {
        tp = +tp;
        if (!Number.isInteger(tp) || tp <= 0) return { ok: false, error: '整单总包装件数必须是正整数（混装时由用户确认录入）' };
      } else {
        tp = null;
      }
      next.totalPackages = tp;
    }

    /* 合计：按 type 分支。
       金额类：统一口径重算；previousGrand 留证（历史原合计可能是旧数据保留值）。
       合计里的 _unknown 与自定义键一并保留（D2-R1），草稿显式带的以草稿为准。
       PL：包装汇总口径（缺项 null 待补；历史金额键保留不重算——复审第 3 条）。 */
    if (isPL) {
      var summary = packagingTotals(items, next.packagingMode, next.totalPackages);
      next.totals = finalizePackagingTotals(current.totals, summary);
    } else {
      var prevGrand = (isObj(current.totals) && finite(current.totals.grand)) ? current.totals.grand : null;
      var t = documentTotals(items);
      next.totals = finalizeTotals(current.totals, t, prevGrand, patch.totals);
    }

    next.updatedAt = new Date().toISOString();
    /* id / no / type / sourceId / date / createdAt 一律不碰 */
    var result = { ok: true, doc: next };
    if (isPL) result.totals = next.totals;
    else result.totals = { subtotal: next.totals.subtotal, grand: next.totals.grand, previousGrand: prevGrand };
    return result;
  }

  /* 单据 → 旧式报价形状（给现有页面用的兼容适配，只读投影） */
  function documentToQuote(d) {
    if (!isObj(d)) return null;
    var c = isObj(d.customer) ? d.customer : {};
    var totals = isObj(d.totals) ? d.totals : {};
    var total = (totals.grand != null) ? totals.grand : totals.subtotal;
    if (total == null && isArr(d.items)) total = round2(d.items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0));
    return {
      id: d.id,
      no: d.no,
      date: d.date,
      customer: c.company || c.name || '',
      attn: c.name || '',
      country: c.country || '',
      items: (isArr(d.items) ? d.items : []).map(function (it) {
        return {
          desc: it.nameCn || '',
          mesh: it.mesh || 0, wire: it.wire || 0, width: it.width || 0,
          rollLen: it.rollLen || 0, qty: it.qty || 0, price: it.price || 0
        };
      }),
      term: d.term || '', payment: d.payment || '', validity: d.validity || '', remark: d.remark || '',
      currency: d.currency || 'USD',
      total: +total || 0
    };
  }

  /* ---------- 空库与迁移 ---------- */

  function emptyV3(seedData) {
    return {
      schemaVersion: V3_VERSION,
      migration: { fromV2: null },
      counters: { QT: {}, PI: {}, SC: {}, CI: {}, PL: {} },
      customers: seedData && isArr(seedData.customers) ? seedData.customers : [],
      products: seedData && isArr(seedData.products) ? seedData.products : [],
      documents: [],
      communications: [],
      quotesArchive: [],
      checkins: seedData && isArr(seedData.checkins) ? seedData.checkins : [],
      settings: seedData && isObj(seedData.settings) ? seedData.settings : { company: '', contact: '', defaultCurrency: 'USD' },
      _unknown: {},
      /* v2 源里用了 v3 模型键名、但内容是旧格式的片段：原样留存，只读，绝不当成 v3 数据用 */
      legacySections: {}
    };
  }

  /*
   * 迁移用：把数值字段严格解析出来。
   * 返回 { value, missing, bad }：
   *   · 字段不存在        → missing=true，value=0（补 0 并上报）
   *   · 存在但是有限数字  → value=原值
   *   · 存在但不是有限数  → bad=true（调用方据此停止整次迁移，不静默当 0/null）
   */
  function readNumeric(raw, present) {
    if (!present) return { value: 0, missing: true, bad: false };
    if (raw === null || raw === '') return { value: 0, missing: true, bad: false };
    var n = typeof raw === 'number' ? raw : Number(raw);
    if (!isFinite(n)) return { value: null, missing: false, bad: true };
    return { value: n, missing: false, bad: false };
  }

  /*
   * v2 → v3 迁移。纯函数，不写盘。
   *
   * 原则（D1 修复轮按验收意见收紧）：
   *   · 逐条校验旧报价与明细：任一条目不是对象、或缺关键字段、或数值字段不可用，
   *     **停止整次迁移**并报出下标 —— 绝不允许"迁移成功但少了几条"。
   *   · 旧单号原样保留，绝不自动改写；格式异常只报告。
   *   · quotes 全量原样进 quotesArchive（原字段、原值、原未知字段）。
   *   · 客户关联只保留原有文本快照，不按名字猜配当前客户。
   *   · 未知顶层字段进 _unknown；用了 v3 模型键名的旧片段进 legacySections。
   *   · 原合计原样保留，不按明细重算覆盖（差异只记录）。
   *   · 缺失的数值字段补 0 并上报；重复/缺失 id 明确处理后上报，不制造冲突。
   */
  function migrateV2toV3(v2, meta) {
    meta = meta || {};
    var val = validateV2(v2);
    if (!val.ok) return { ok: false, error: '旧数据结构无法识别：' + val.errors.join('；') };

    /* ---- 顶层内容划分：真未知 vs. 与 v3 键名撞车的旧片段 ---- */
    var unknown = {};
    var legacySections = {};
    Object.keys(v2).forEach(function (k) {
      if (LEGACY_TOP_KEYS.indexOf(k) >= 0) return;            /* 已被迁移覆盖，不重复留存 */
      if (V3_MODEL_KEYS.indexOf(k) >= 0) {
        legacySections[k] = clone(v2[k]);                     /* 名字认识但内容是旧格式：原样留存 */
        return;
      }
      if (KNOWN_TOP_KEYS.indexOf(k) >= 0) return;
      unknown[k] = clone(v2[k]);
    });

    var out = emptyV3(v2);
    out._unknown = unknown;
    out.legacySections = legacySections;
    out.counters = { QT: {}, PI: {}, SC: {}, CI: {}, PL: {} };

    var quotes = isArr(v2.quotes) ? v2.quotes : [];
    var totalsDiffer = 0;
    var missingFields = [];       /* 缺失的数值字段（已补 0 并上报） */
    var idIssues = [];            /* 重复/缺失 id 的处理记录 */
    var seenIds = {};

    for (var qi = 0; qi < quotes.length; qi++) {
      var q = quotes[qi];

      /* ---- 逐条校验：不能安全映射就整次停止 ---- */
      if (!isObj(q)) {
        return { ok: false, error: '旧数据第 ' + (qi + 1) + ' 条报价（索引 ' + qi + '）不是一个对象，无法安全映射。迁移已停止，原文件未改动。' };
      }
      if (q.items != null && !isArr(q.items)) {
        return { ok: false, error: '旧数据第 ' + (qi + 1) + ' 条报价（索引 ' + qi + '）的 items 不是数组，无法安全映射。迁移已停止，原文件未改动。' };
      }
      var rawItems = isArr(q.items) ? q.items : [];
      for (var ii = 0; ii < rawItems.length; ii++) {
        if (!isObj(rawItems[ii])) {
          return { ok: false, error: '旧数据第 ' + (qi + 1) + ' 条报价的明细第 ' + (ii + 1) + ' 行（索引 ' + qi + '.' + ii + '）不是对象，无法安全映射。迁移已停止，原文件未改动。' };
        }
      }

      /* 归档：原样，含所有未知字段 */
      out.quotesArchive.push(clone(q));

      var items = [];
      var badField = '';
      for (var j = 0; j < rawItems.length; j++) {
        var it = rawItems[j];
        var row = {
          productId: null,                                    /* 不猜产品关联 */
          nameCn: String(it.desc != null ? it.desc : (it.nameCn != null ? it.nameCn : '')),
          nameEn: String(it.nameEn != null ? it.nameEn : ''),
          /* 同上：迁移也不替历史数据编一个 ㎡，缺单位就留空、界面标"待补全" */
          unit: String(it.unit == null ? '' : it.unit)
        };
        var nums = ['mesh', 'wire', 'width', 'rollLen', 'qty', 'price'];
        for (var ni = 0; ni < nums.length; ni++) {
          var f = nums[ni];
          var r = readNumeric(it[f], Object.prototype.hasOwnProperty.call(it, f));
          if (r.bad) {
            badField = '明细第 ' + (j + 1) + ' 行的 ' + f + '（原值 ' + JSON.stringify(it[f]) + '）';
            break;
          }
          if (r.missing) missingFields.push({ quoteIndex: qi, itemIndex: j, field: f });
          row[f] = r.value;
        }
        if (badField) break;
        row.amount = round2(row.qty * row.price);
        row._unknown = (function (src) {
          var u = {};
          Object.keys(src).forEach(function (k) {
            if (['desc', 'nameCn', 'nameEn', 'mesh', 'wire', 'width', 'rollLen', 'qty', 'price', 'unit', 'productId'].indexOf(k) < 0) u[k] = clone(src[k]);
          });
          return u;
        })(it);
        items.push(row);
      }
      if (badField) {
        return { ok: false, error: '旧数据第 ' + (qi + 1) + ' 条报价的' + badField + '不是有效数字，无法安全映射（不会当作 0 或 null）。迁移已停止，原文件未改动。' };
      }

      var computed = round2(items.reduce(function (s, it2) { return s + it2.amount; }, 0));
      var tl = readNumeric(q.total, Object.prototype.hasOwnProperty.call(q, 'total'));
      if (tl.bad) {
        return { ok: false, error: '旧数据第 ' + (qi + 1) + ' 条报价的合计 total（原值 ' + JSON.stringify(q.total) + '）不是有效数字，无法安全映射。迁移已停止，原文件未改动。' };
      }
      if (tl.missing) missingFields.push({ quoteIndex: qi, itemIndex: null, field: 'total' });
      var legacyTotal = tl.missing ? null : tl.value;
      if (legacyTotal != null && Math.abs(legacyTotal - computed) > 0.005) totalsDiffer++;

      /* ---- id：明确处理缺失与重复，不静默改原值、也不制造冲突 ---- */
      var id = q.id;
      if (id == null || String(id).trim() === '') {
        id = 'migrated-qt-' + (qi + 1);
        idIssues.push({ index: qi, issue: 'missing', from: q.id == null ? null : String(q.id), to: id });
      } else {
        id = String(id);
        if (seenIds[id]) {
          var n = seenIds[id] + 1;
          seenIds[id] = n;
          var newId = id + '-dup' + n;
          idIssues.push({ index: qi, issue: 'duplicate', from: id, to: newId });
          id = newId;
        } else {
          seenIds[id] = 1;
        }
      }

      var doc = {
        id: id,
        no: q.no != null ? String(q.no) : '',                 /* 原样保留，不改写 */
        type: 'QT',
        date: typeof q.date === 'string' ? q.date : (q.date != null ? String(q.date) : ''),
        sourceId: null,
        /* 旧数据只有文本，没有客户 id —— 不猜配 */
        customer: {
          id: null,
          name: String(q.attn != null ? q.attn : ''),
          company: String(q.customer != null ? q.customer : ''),
          country: String(q.country != null ? q.country : '')
        },
        items: items,
        currency: q.currency || 'USD',
        term: q.term || '',
        payment: q.payment || '',
        validity: q.validity || '',
        remark: q.remark || '',
        /* 原合计原样保留；同时记录按明细算的值，差异不静默覆盖 */
        totals: {
          subtotal: legacyTotal != null ? legacyTotal : computed,
          grand: legacyTotal != null ? legacyTotal : computed,
          computedFromItems: computed,
          legacyTotalPreserved: legacyTotal != null
        },
        _unknown: (function () {
          var u = {};
          Object.keys(q).forEach(function (k) {
            if (['id', 'no', 'date', 'customer', 'attn', 'country', 'items', 'currency', 'term', 'payment', 'validity', 'remark', 'total'].indexOf(k) < 0) u[k] = clone(q[k]);
          });
          return u;
        })(),
        createdAt: q.createdAt || (meta.doneAt || new Date().toISOString()),
        updatedAt: meta.doneAt || new Date().toISOString()
      };
      out.documents.push(doc);

      /* counters 初始化：只认新格式号；旧号（SB 等）不进 counters，靠冲突检查兜底 */
      var p = parseNo(doc.no);
      if (p && out.counters[p.type]) {
        var cur = out.counters[p.type][p.ym] || 0;
        if (p.seq > cur) out.counters[p.type][p.ym] = p.seq;
      }
    }

    /* 条数必须对得上：迁移是"全量映射"，少一条都算失败 */
    if (out.quotesArchive.length !== out.documents.length) {
      return { ok: false, error: '迁移条数不一致（归档 ' + out.quotesArchive.length + ' 条，单据 ' + out.documents.length + ' 条）。迁移已停止，原文件未改动。' };
    }

    out.migration = {
      fromV2: {
        doneAt: meta.doneAt || new Date().toISOString(),
        sourceFile: meta.sourceFile || '',
        sourceSha256: meta.sourceSha256 || '',
        counts: {
          customers: out.customers.length,
          products: out.products.length,
          checkins: out.checkins.length,
          quotesArchived: out.quotesArchive.length,
          documentsCreated: out.documents.length
        }
      }
    };

    var issues = collectNoIssues(out);
    var val3 = validateV3(out);
    if (!val3.ok) return { ok: false, error: '迁移结果未通过校验：' + val3.errors.join('；') };
    /* 迁移产物也必须过写入口校验（按 v3 规则——它是 v2→v3 的产物；
       若要落 v4 盘，由调用方再走 migrateV3toV4 + v4 写入校验），否则等于把不合格数据写进主文件 */
    var valW = validateWritable(out, V3_VERSION);
    if (!valW.ok) return { ok: false, error: '迁移结果未通过写入校验：' + valW.errors.slice(0, 5).join('；') };

    return {
      ok: true,
      data: out,
      report: {
        counts: out.migration.fromV2.counts,
        unknownTopKeys: Object.keys(unknown),
        legacySectionKeys: Object.keys(legacySections),
        duplicates: issues.duplicates,
        anomalies: issues.anomalies,
        legacyFormat: issues.legacyFormat,
        totalsDifferFromItems: totalsDiffer,
        missingNumericFields: missingFields,
        idIssues: idIssues
      }
    };
  }

  /* ---------- v4 空库 ---------- */

  function emptyV4(seedData) {
    var out = emptyV3(seedData);
    out.schemaVersion = V4_VERSION;         /* P1-B：v4 空库明确用 V4_VERSION，不随 SCHEMA_VERSION 升 5 */
    out.migration = { fromV2: null, fromV3: null };
    if (isObj(out.settings) && !('sellerAddress' in out.settings)) out.settings.sellerAddress = '';
    if (isObj(out.settings) && !isObj(out.settings.ai)) out.settings.ai = { provider: 'deepseek', baseUrl: '', model: '', enabled: false, privacyMode: 'confirm' };
    if (isObj(out.settings) && !isObj(out.settings.entitlements)) out.settings.entitlements = { ai_quote_assist: false, ai_email_assist: false, advanced_load_planner: false, export_templates: true };
    return out;
  }

  /*
   * v3 → v4 迁移（纯函数，不写盘）。D3-B1 核心。
   *
   * 原则（Codex 复审第 1/2/3 条 + D3-A 兼容与迁移.md）：
   *   · **缺字段才补待补值**：原 seller/delivery/包装四件套/行 hsCode 等**已有值就原样保留并校验**，
   *     绝不按表格一律设 null/'' 覆盖；
   *   · 单据级补：seller=null、delivery/bank/buyerAddress/marks/shipment/vessel/origin/
   *     contractTerms/signPlace=''、packagingMode=null、totalPackages=null（仅缺失时）；
   *   · 行级按类型补：CI/SC 行补 hsCode=''；PL 行补 packages/net/gross/volume=null（仅缺失时）；
   *   · 客户库补 address=''、产品库补 hsCode=''、settings 补 sellerAddress=''（仅缺失时）；
   *   · 未知字段、行身份（id/_rowId）、来源关系（sourceId）、历史 ID/单号/日期/合计
   *     一律原样延续；不重算历史合计、不伪造历史卖方/交期/包装信息；
   *   · 逐条校验：异常条目整次停止并报位置；
   *   · 产物必须过 validateV4（读门）+ validateWritable（写门），否则整体失败。
   */
  function migrateV3toV4(v3, meta) {
    meta = meta || {};
    var val = validateV3(v3);
    if (!val.ok) return { ok: false, error: 'v3 数据结构无法识别：' + val.errors.join('；') };

    var out = clone(v3);
    out.schemaVersion = V4_VERSION;         /* P1-B：v3→v4 产物仍明确是 v4 */
    out.migration = isObj(v3.migration) ? clone(v3.migration) : { fromV2: null };
    if (!('fromV3' in out.migration)) out.migration.fromV3 = null;

    var added = { docs: 0, rows: 0, customers: 0, products: 0, settings: 0 };
    var kept = { seller: 0, delivery: 0, packaging: 0, hsCode: 0 };

    /* ---- 设置 ---- */
    if (isObj(out.settings)) {
      if (!('sellerAddress' in out.settings)) { out.settings.sellerAddress = ''; added.settings++; }
    }

    /* ---- 客户库 / 产品库（可选字段，缺失才补空） ---- */
    (isArr(out.customers) ? out.customers : []).forEach(function (c) {
      if (!isObj(c)) return;
      if (!('address' in c)) { c.address = ''; added.customers++; }
    });
    (isArr(out.products) ? out.products : []).forEach(function (p) {
      if (!isObj(p)) return;
      if (!('hsCode' in p)) { p.hsCode = ''; added.products++; }
    });

    /* ---- 单据 ---- */
    var docs = isArr(out.documents) ? out.documents : [];
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (!isObj(d)) {
        return { ok: false, error: 'documents[' + i + '] 不是对象，无法安全迁移。迁移已停止，原文件未改动。' };
      }
      if (DOC_TYPES.indexOf(d.type) < 0) {
        return { ok: false, error: 'documents[' + i + '] 类型未知（' + JSON.stringify(d.type) + '），无法安全迁移。迁移已停止，原文件未改动。' };
      }
      if (!isArr(d.items)) {
        return { ok: false, error: 'documents[' + i + '] 缺少 items 数组，无法安全迁移。迁移已停止，原文件未改动。' };
      }

      /* 单据级：缺失才补 */
      if ('seller' in d) { if (d.seller != null) kept.seller++; } else { d.seller = null; added.docs++; }
      if ('delivery' in d) { if (d.delivery != null && d.delivery !== '') kept.delivery++; } else { d.delivery = ''; added.docs++; }
      ['bank', 'buyerAddress', 'marks', 'shipment', 'vessel', 'origin', 'contractTerms', 'signPlace'].forEach(function (k) {
        if (!(k in d)) { d[k] = ''; added.docs++; }
      });
      if (!('signDate' in d)) { d.signDate = ''; added.docs++; }
      if ('packagingMode' in d) { if (d.packagingMode != null) kept.packaging++; } else { d.packagingMode = null; added.docs++; }
      if (!('totalPackages' in d)) { d.totalPackages = null; added.docs++; }

      /* 行级：按类型补 */
      for (var j = 0; j < d.items.length; j++) {
        var it = d.items[j];
        if (!isObj(it)) {
          return { ok: false, error: 'documents[' + i + '].items[' + j + '] 不是对象，无法安全迁移。迁移已停止，原文件未改动。' };
        }
        if (d.type === 'CI' || d.type === 'SC') {
          if ('hsCode' in it) { if (it.hsCode != null && it.hsCode !== '') kept.hsCode++; }
          else { it.hsCode = ''; added.rows++; }
        }
        if (d.type === 'PL') {
          PL_PACKAGING_KEYS.forEach(function (f) {
            if (f in it) { if (it[f] != null) kept.packaging++; }
            else { it[f] = null; added.rows++; }
          });
        }
      }
    }

    out.migration.fromV3 = {
      doneAt: meta.doneAt || new Date().toISOString(),
      sourceFile: meta.sourceFile || '',
      sourceSha256: meta.sourceSha256 || '',
      counts: {
        customers: (isArr(out.customers) ? out.customers : []).length,
        products: (isArr(out.products) ? out.products : []).length,
        documents: docs.length,
        quotesArchived: (isArr(out.quotesArchive) ? out.quotesArchive : []).length,
        checkins: (isArr(out.checkins) ? out.checkins : []).length
      }
    };

    var val4 = validateV4(out);
    if (!val4.ok) return { ok: false, error: '迁移结果未通过 v4 结构校验：' + val4.errors.join('；') };
    var valW = validateWritable(out, V4_VERSION);
    if (!valW.ok) return { ok: false, error: '迁移结果未通过写入校验：' + valW.errors.slice(0, 5).join('；') };

    return {
      ok: true,
      data: out,
      report: {
        counts: out.migration.fromV3.counts,
        addedDefaults: added,
        keptExisting: kept,
        unknownTopKeys: isObj(out._unknown) ? Object.keys(out._unknown) : [],
        legacySectionKeys: isObj(out.legacySections) ? Object.keys(out.legacySections) : [],
        noIssues: collectNoIssues(out)
      }
    };
  }

  /* ---------- v5 空库与 v4→v5 迁移（P1-B） ---------- */

  function emptyV5(seedData) {
    var out = emptyV4(seedData);
    out.schemaVersion = SCHEMA_VERSION;
    out.migration = { fromV2: null, fromV3: null, fromV4: null };
    return out;
  }

  /*
   * v4 → v5 迁移（纯函数，不写盘）。P1-B 核心。
   *
   * 原则（任务书 §三.3 / §四）：
   *   · **缺字段才补待补值**：v5 新键历史数据一律 null/[]（未知 ≠ 0/1/6.6/3%/20%），
   *     已有值（v4 文件里不应有，出现则视为数据本身）原样保留并交由 v5 校验把关；
   *   · 绝不自动重新计算历史成交价格、不改历史金额/合计/单号/日期/来源关系；
   *   · 单据级补：fx/feeRate/targetMargin/commissionRate/freightMarkup/markupRate/
   *     feeInPrice/pricingVersion=null、fees=[]（仅缺失时）；
   *   · 行级与产品库补：specText/costFactory/costPacking/costInland/costOther/
   *     costConfirmed=null（仅缺失时；PL 行同样补 null，未填写语义一致）；
   *   · 未知字段、行身份、sourceId、历史 ID/单号/日期/合计一律原样延续；
   *   · 逐条校验：异常条目整次停止并报位置；
   *   · 产物必须过 validateV5（读门）+ validateWritable（写门 v5），否则整体失败。
   */
  function migrateV4toV5(v4, meta) {
    meta = meta || {};
    var val = validateV4(v4);
    if (!val.ok) return { ok: false, error: 'v4 数据结构无法识别：' + val.errors.join('；') };

    var out = clone(v4);
    out.schemaVersion = SCHEMA_VERSION;
    out.migration = isObj(v4.migration) ? clone(v4.migration) : { fromV2: null, fromV3: null };
    if (!('fromV4' in out.migration)) out.migration.fromV4 = null;

    var added = { docs: 0, rows: 0, products: 0 };
    var kept = { fx: 0, feeRate: 0, feeInPrice: 0, cost: 0, specText: 0 };

    var V5_DOC_DEFAULTS = {
      fx: null, feeRate: null, targetMargin: null, commissionRate: null,
      freightMarkup: null, markupRate: null, feeInPrice: null, pricingVersion: null, fees: []
    };

    /* ---- 单据级 + 行级：缺失才补 null/[]，已有值原样保留 ---- */
    var docs = isArr(out.documents) ? out.documents : [];
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (!isObj(d)) {
        return { ok: false, error: 'documents[' + i + '] 不是对象，无法安全迁移。迁移已停止，原文件未改动。' };
      }
      if (DOC_TYPES.indexOf(d.type) < 0) {
        return { ok: false, error: 'documents[' + i + '] 类型未知（' + JSON.stringify(d.type) + '），无法安全迁移。迁移已停止，原文件未改动。' };
      }
      if (!isArr(d.items)) {
        return { ok: false, error: 'documents[' + i + '] 缺少 items 数组，无法安全迁移。迁移已停止，原文件未改动。' };
      }
      Object.keys(V5_DOC_DEFAULTS).forEach(function (k) {
        if (!(k in d)) { d[k] = k === 'fees' ? [] : V5_DOC_DEFAULTS[k]; added.docs++; }
        else if (k === 'fx' && d[k] != null) kept.fx++;
        else if (k === 'feeRate' && d[k] != null) kept.feeRate++;
        else if (k === 'feeInPrice' && d[k] !== null) kept.feeInPrice++;
      });
      /* v5（P1-B-FIX-01 BUG-02）：迁移来源中出现非法 fees 数据必须明确报错——
         绝不静默删除、也绝不覆盖原始数据。迁移整体停止，原文件未改动。 */
      if (Object.prototype.hasOwnProperty.call(d, 'fees') && !isArr(d.fees)) {
        return { ok: false, error: 'documents[' + i + '].fees 在迁移来源中存在非法数据（必须是数组，实际为 ' +
          JSON.stringify(d.fees) + '）。迁移已停止：不静默删除、不覆盖原始数据，原文件未改动。' };
      }
      for (var j = 0; j < d.items.length; j++) {
        var it = d.items[j];
        if (!isObj(it)) {
          return { ok: false, error: 'documents[' + i + '].items[' + j + '] 不是对象，无法安全迁移。迁移已停止，原文件未改动。' };
        }
        V5_ROW_KEYS.forEach(function (f) {
          if (!(f in it)) { it[f] = null; added.rows++; }
          else if (f === 'specText' && it[f] != null) kept.specText++;
          else if (V5_ITEM_COST_KEYS.indexOf(f) >= 0 && it[f] != null) kept.cost++;
        });
      }
    }

    /* ---- 产品库：同一套字段，缺失才补 ---- */
    (isArr(out.products) ? out.products : []).forEach(function (p) {
      if (!isObj(p)) {
        return; /* 产品条目形状由读门把关；这里只对对象条目补字段 */
      }
      V5_ROW_KEYS.forEach(function (f) {
        if (!(f in p)) { p[f] = null; added.products++; }
      });
    });

    out.migration.fromV4 = {
      doneAt: meta.doneAt || new Date().toISOString(),
      sourceFile: meta.sourceFile || '',
      sourceSha256: meta.sourceSha256 || '',
      counts: {
        documents: docs.length,
        products: (isArr(out.products) ? out.products : []).length,
        customers: (isArr(out.customers) ? out.customers : []).length,
        quotesArchived: (isArr(out.quotesArchive) ? out.quotesArchive : []).length,
        checkins: (isArr(out.checkins) ? out.checkins : []).length
      }
    };

    var val5 = validateV5(out);
    if (!val5.ok) return { ok: false, error: '迁移结果未通过 v5 结构校验：' + val5.errors.join('；') };
    var valW = validateWritable(out);
    if (!valW.ok) return { ok: false, error: '迁移结果未通过写入校验：' + valW.errors.slice(0, 5).join('；') };

    return {
      ok: true,
      data: out,
      report: {
        counts: out.migration.fromV4.counts,
        addedDefaults: added,
        keptExisting: kept,
        unknownTopKeys: isObj(out._unknown) ? Object.keys(out._unknown) : [],
        legacySectionKeys: isObj(out.legacySections) ? Object.keys(out.legacySections) : [],
        noIssues: collectNoIssues(out)
      }
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    V4_VERSION: V4_VERSION,
    V3_VERSION: V3_VERSION,
    LEGACY_VERSION: LEGACY_VERSION,
    DOC_TYPES: DOC_TYPES,
    DOC_TYPE_NAMES: DOC_TYPE_NAMES,
    AMOUNT_TYPES: AMOUNT_TYPES,
    PACKAGING_MODES: PACKAGING_MODES,
    V4_DOC_KEYS: V4_DOC_KEYS,
    V5_DOC_KEYS: V5_DOC_KEYS,
    V5_DOC_PRICING_KEYS: V5_DOC_PRICING_KEYS,
    V5_ROW_KEYS: V5_ROW_KEYS,
    PRODUCT_IMAGE_TYPES: PRODUCT_IMAGE_TYPES,
    PRODUCT_IMAGE_MAX: PRODUCT_IMAGE_MAX,
    validateProductImages: validateProductImages,
    validateProductExtraText: validateProductExtraText,
    validateCustomerExtras: validateCustomerExtras,
    validateSuppliers: validateSuppliers,
    isDataImage: isDataImage,
    ITEM_KEYS: ITEM_KEYS,
    LIMITS: LIMITS,
    pad: pad,
    round2: round2,
    round3: round3,
    dayKey: dayKey,
    ymFromDate: ymFromDate,
    detectVersion: detectVersion,
    validateV2: validateV2,
    validateV3: validateV3,
    validateV4: validateV4,
    validateV5: validateV5,
    validateV5DocKeys: validateV5DocKeys,
    validateV5RowKeys: validateV5RowKeys,
    validateLearningRecords: validateLearningRecords,
    validateWritable: validateWritable,
    validateDocument: validateDocument,
    validateForExport: validateForExport,
    validateCounters: validateCounters,
    validateCommunications: validateCommunications,
    parseNo: parseNo,
    classifyNo: classifyNo,
    collectNoIssues: collectNoIssues,
    allocateNo: allocateNo,
    validateItems: validateItems,
    sanitizeQuoteLayout: sanitizeQuoteLayout,
    documentTotals: documentTotals,
    packagingTotals: packagingTotals,
    /* 复制 / 转换（D3-A 转换矩阵；B2 落地）：只构造未保存草稿，取号与落盘在保存时 */
    conversionTargets: conversionTargets,
    canConvert: canConvert,
    buildConversionDraft: buildConversionDraft,
    patchDocument: patchDocument,
    /* 新建路径也用同一套行合并（编辑副本带的扩展字段不会被校验重建时丢掉） */
    finalizeItems: finalizeItems,
    quoteToDocument: quoteToDocument,
    documentToQuote: documentToQuote,
    emptyV3: emptyV3,
    emptyV4: emptyV4,
    emptyV5: emptyV5,
    migrateV2toV3: migrateV2toV3,
    migrateV3toV4: migrateV3toV4,
    migrateV4toV5: migrateV4toV5
  };
});
