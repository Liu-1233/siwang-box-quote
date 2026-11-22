(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SBW_WIRE_QUOTE_RULES = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRICING_UNITS = ['kg', '㎡', 'roll', 'sheet', 'm', 'pcs', 'set'];
  var CATEGORIES = {
    woven: { name: '编织网', fields: ['material', 'mesh', 'wire', 'aperture', 'width', 'rollLength', 'weave', 'edge'] },
    welded: { name: '电焊网/网卷', fields: ['material', 'opening', 'wire', 'width', 'length', 'finish', 'edge'] },
    fence: { name: '护栏/网片', fields: ['material', 'height', 'width', 'wire', 'opening', 'bends', 'post', 'finish', 'color'] },
    grating: { name: '钢格板', fields: ['material', 'bearingBar', 'crossBar', 'spacing', 'width', 'length', 'finish'] },
    perforated: { name: '冲孔网', fields: ['material', 'holeShape', 'holeSize', 'pitch', 'thickness', 'width', 'length'] },
    expanded: { name: '钢板网', fields: ['material', 'swd', 'lwd', 'strandWidth', 'thickness', 'width', 'length'] },
    gabion: { name: '石笼网', fields: ['material', 'meshSize', 'wire', 'selvedgeWire', 'lacingWire', 'coating', 'size'] },
    chainlink: { name: '勾花网', fields: ['material', 'opening', 'wire', 'height', 'rollLength', 'edge', 'coating'] },
    wire: { name: '金属丝', fields: ['material', 'diameter', 'coilWeight', 'tensileStrength', 'coating', 'packing'] },
    general: { name: '通用产品/配件', fields: ['material', 'model', 'size', 'finish', 'color', 'packing'] }
  };
  var CLIENT_ITEM_KEYS = ['_rowId', 'productId', 'nameCn', 'nameEn', 'sku', 'hsCode', 'category', 'specText', 'imageData', 'qty', 'unit', 'price'];
  var TEMPLATE_COLUMNS = ['no', 'photo', 'name', 'spec', 'qty', 'unit', 'unitPrice', 'amount'];
  var TEMPLATE_BLOCKS = ['seller', 'buyer', 'items', 'charges', 'terms', 'remark', 'signature'];
  var DEFAULT_TEMPLATE_CONFIG = {
    name: '带图报价模板', language: 'en', accent: '#1687a7', showPhoto: true,
    photoSize: 'medium', specMode: 'both',
    columns: TEMPLATE_COLUMNS.slice(), blocks: TEMPLATE_BLOCKS.slice(), labels: {}
  };

  function safeChoice(value, choices, fallback) {
    value = String(value == null ? '' : value);
    return choices.indexOf(value) >= 0 ? value : fallback;
  }
  function uniqueAllowed(list, allowed, fallback) {
    if (!Array.isArray(list)) return fallback.slice();
    var seen = {};
    var out = list.filter(function (one) {
      one = String(one || '');
      if (allowed.indexOf(one) < 0 || seen[one]) return false;
      seen[one] = true; return true;
    });
    return out.length ? out : fallback.slice();
  }
  function sanitizeTemplateConfig(input) {
    var src = input && typeof input === 'object' ? input : {};
    var labels = {};
    var allowedLabels = ['quotation', 'from', 'to', 'date', 'validUntil', 'product', 'specification', 'quantity', 'unitPrice', 'amount', 'total', 'notes'];
    if (src.labels && typeof src.labels === 'object') allowedLabels.forEach(function (key) {
      if (src.labels[key] != null) labels[key] = String(src.labels[key]).replace(/[<>]/g, '').slice(0, 80);
    });
    return {
      name: String(src.name || DEFAULT_TEMPLATE_CONFIG.name).replace(/[<>]/g, '').slice(0, 80),
      language: safeChoice(src.language, ['en', 'es', 'custom'], 'en'),
      accent: /^#[0-9a-f]{6}$/i.test(String(src.accent || '')) ? String(src.accent) : DEFAULT_TEMPLATE_CONFIG.accent,
      showPhoto: src.showPhoto !== false,
      photoSize: safeChoice(src.photoSize, ['small', 'medium', 'large'], 'medium'),
      specMode: safeChoice(src.specMode, ['rows', 'free', 'both'], 'both'),
      columns: uniqueAllowed(src.columns, TEMPLATE_COLUMNS, DEFAULT_TEMPLATE_CONFIG.columns),
      blocks: uniqueAllowed(src.blocks, TEMPLATE_BLOCKS, DEFAULT_TEMPLATE_CONFIG.blocks),
      labels: labels
    };
  }

  function clientItemSnapshot(source) {
    var src = source && typeof source === 'object' ? source : {};
    var out = {};
    CLIENT_ITEM_KEYS.forEach(function (key) {
      if (src[key] !== undefined) out[key] = src[key];
    });
    return out;
  }

  function category(code) { return CATEGORIES[code] || CATEGORIES.general; }
  function supportsUnit(unit) { return PRICING_UNITS.indexOf(String(unit || '').trim()) >= 0; }

  return {
    PRICING_UNITS: PRICING_UNITS,
    CATEGORIES: CATEGORIES,
    CLIENT_ITEM_KEYS: CLIENT_ITEM_KEYS,
    TEMPLATE_COLUMNS: TEMPLATE_COLUMNS,
    TEMPLATE_BLOCKS: TEMPLATE_BLOCKS,
    DEFAULT_TEMPLATE_CONFIG: DEFAULT_TEMPLATE_CONFIG,
    category: category,
    supportsUnit: supportsUnit,
    clientItemSnapshot: clientItemSnapshot,
    sanitizeTemplateConfig: sanitizeTemplateConfig
  };
});
