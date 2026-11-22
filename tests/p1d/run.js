/*
 * P1-D-02 报价编辑界面 RunCheng 化 · 测试套件（Node 层）
 *
 * 覆盖：
 *   A. 字段完整性 —— 原 quoteEdit 全部可编辑字段在新卡片布局中逐项可达（五类单据）
 *   B. 卡片结构   —— 订单信息/产品明细与成本/费用/运费分组/高级参数/核价汇总卡；PL 隔离
 *   C. 简洁入口   —— 客户下拉（快照语义不变）、产品卡片搜索（走 addRow+pickProduct 同一校验链）
 *   D. 保护要求   —— 客户快照不含 live-read 字段；「填入建议价」按钮保留；fx/incoterm 唯一入口
 *
 * 方法：与 tests/p1c 相同——真实 storage.js（os.tmpdir 隔离）+ mock 渲染桥 + VM 加载真实
 *       pages.js 渲染 Pages.quoteEdit，对产物 HTML 做真实断言。不触碰生产 userData。
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEV = ROOT;
const need = ['app/model.js', 'app/pricing.js', 'app/pages.js', 'app/store.js', 'storage.js', 'app/sheet.js'];
const missing = need.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) {
  console.error('FATAL 工程根目录解析失败（' + ROOT + '），缺少：' + missing.join(', '));
  process.exit(1);
}
console.log('PASS P0 工程根目录按测试文件位置解析：' + ROOT.replace(/\\/g, '/'));

const M = require(path.join(ROOT, 'app', 'model.js'));
const Pricing = require(path.join(ROOT, 'app', 'pricing.js'));
const Sheet = require(path.join(ROOT, 'app', 'sheet.js'));

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}
function eq(name, a, b) {
  const c = typeof b === 'number' ? Math.abs(+a - b) < 1e-9 : a === b;
  if (c) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + ' —— 期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a)); }
}

/* ---------- 环境：真实 storage + mock 桥（与 tests/p1c 相同口径） ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-p1d-'));
const storage = require(path.join(ROOT, 'storage.js')).createStorage(tmp);
global.window = {
  SBModel: M,
  SBW: {
    load() { return storage.load(); },
    save(db) { return storage.save(db); },
    paths() { return storage.paths(); }
  }
};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const Store = new Function(fs.readFileSync(path.join(DEV, 'app', 'store.js'), 'utf8') + '\nreturn Store;').call(global.window);

const toasts = [];
const ctx = {
  window: global.window, localStorage: global.localStorage, Store, MODEL: M, Pricing, Sheet,
  document: {
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {} })
  },
  esc: s => String(s == null ? '' : s), money: (v, c) => String(v), jid: s => String(s), jidq: s => String(s),
  UI: {
    toast(m) { toasts.push(String(m)); },
    confirm(t, m, cb) { if (cb) cb(); },
    render() {}, go() {}, current: '', closeModal() {}
  },
  Prod: { priceSummary: () => 'x' }, DocsFilter: { type: 'ALL' }, setTimeout: f => f(),
  console, Math, JSON, Date, Number, isFinite, Object, Array, String, parseInt, parseFloat
};
ctx.global = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(DEV, 'app', 'pages.js'), 'utf8') + ';this.__X={P1C,Doc,QuoteEdit,Pages};',
  ctx, { filename: 'pages.js' }
);
const P1C = ctx.__X.P1C, Doc = ctx.__X.Doc, QuoteEdit = ctx.__X.QuoteEdit, Pages = ctx.__X.Pages;
ok('VM 加载真实 pages.js 并取到 P1C/Doc/QuoteEdit/Pages', !!P1C && !!Doc && !!QuoteEdit && !!Pages);

/* ---------- 公共构造（与 tests/p1c mkDoc 同形状） ---------- */
function freightAllConfirmed() {
  return P1C.FREIGHT_KEYS().map(k => ({
    item: k, amount: 0, currency: (Pricing.FREIGHT_ITEMS[k] || ['', 'USD'])[1],
    confirmed: true, charge_customer: false, included_in_cost: false
  }));
}
function mkDoc(type) {
  return {
    type: type || 'QT', currency: 'USD', date: '2026-11-20', sourceId: null,
    customer: { id: null, name: 'N', company: 'C', country: '', address: '' },
    items: [{ _rowId: 'r1', nameCn: '产品A', nameEn: 'A', qty: 10, unit: '㎡', price: null,
      costFactory: 10, costPacking: 0, costInland: 0, costOther: 0, costConfirmed: true }],
    fx: 6.6, feeRate: 0.03, targetMargin: Pricing.marginFromMarkupForMode(0.4, 0.03, 1),
    commissionRate: 0.2, freightMarkup: 0, markupRate: 0.4, feeInPrice: 1, pricingVersion: null,
    fees: type === 'PL' ? undefined : [{ label: '模具费', note: '', amountCny: 100, allocations: null }],
    payment: 'T/T', term: 'FOB Tianjin', validity: '30 days', delivery: '', remark: '',
    bank: (type === 'PI' || type === 'SC' || type === 'CI') ? 'Bank' : undefined,
    shipment: type === 'CI' ? 'By Sea' : undefined, vessel: type === 'CI' ? 'V1' : undefined, origin: type === 'CI' ? 'China' : undefined,
    signDate: type === 'SC' ? '2026-11-20' : undefined, signPlace: type === 'SC' ? 'Anping' : undefined, contractTerms: type === 'SC' ? 'terms' : undefined,
    marks: type === 'PL' ? 'marks' : undefined,
    packagingMode: type === 'PL' ? 'mixed' : undefined,   /* 混装态才渲染整单总件数输入 */
    _unknown: (type === 'PL') ? {} : { pricing: { incoterm: 'EXW', namedPlace: 'Anping', freight: freightAllConfirmed(), extra: { discount: 0, other_charges: 0 } } }
  };
}
function renderFor(d) {
  QuoteEdit.draft = d;
  QuoteEdit.id = null;
  QuoteEdit.dirty = false;
  QuoteEdit.invalid = {};
  QuoteEdit.costInvalid = {};
  QuoteEdit.pricingResult = null;
  QuoteEdit.pricingStale = false;
  QuoteEdit.custMode = 'pick';
  QuoteEdit.custQuery = '';
  QuoteEdit.prodQuery = '';
  QuoteEdit.feeAllocOpen = null;
  QuoteEdit.hints = [];
  return Pages.quoteEdit();
}

/* 种子客户与产品 */
Store.addCustomer({ name: '张三', company: 'ACME Ltd', country: 'US', address: '1 Main St', email: 'z@acme.com', phone: '123', whatsapp: '456' });
Store.addCustomer({ name: '李四', company: 'GlobalBuy GmbH', country: 'DE', address: 'Hafenstr. 7', email: 'l@gb.de', phone: '789', whatsapp: '012' });
Store.addProduct({ nameCn: '电焊网D2', unit: '㎡', mesh: 100, wire: 0.1, width: 1.22, price: 5.88,
  specText: '浸塑', costFactory: 8.5, costPacking: 0.5, costInland: 0, costOther: null, costConfirmed: true });

/* ================= A. 字段完整性（五类单据逐项断言） ================= */
/* 说明：标记 = 渲染产物中必须出现的写入链调用（id/handler 字符串）。
   每个标记对应原编辑页一个可编辑入口，一个不删。 */
const COMMON_MARKS = [
  'Doc.requestLeave()', 'Doc.save()', 'Doc.exportPdf(',                          /* 顶部 */
  'Doc.custDropdown(', 'Doc.pickCust(', 'Doc.manualCust(',                       /* 客户三入口 */
  "Doc.termField('buyerAddress'", 'Doc.refreshSeller()',                          /* 买方地址/卖方 */
  "Doc.termField('term'", "Doc.termField('currency'", "Doc.termField('payment'",
  "Doc.termField('validity'", "Doc.termField('delivery'", "Doc.termField('remark'",
  'Doc.setTemplate(', 'Doc.openTemplateEditor()',                                 /* 模板（高级区） */
  'Doc.addRow()', 'Doc.removeRow(0)', 'Doc.pickProduct(0,',                       /* 明细行 */
  "Doc.setField(0, 'qty'", "Doc.setField(0, 'unit'", "Doc.setField(0, 'nameCn'",
  "Doc.setField(0, 'nameEn'", "Doc.setField(0, 'mesh'", "Doc.setField(0, 'wire'",
  "Doc.setField(0, 'width'", "Doc.setField(0, 'rollLen'",
  'qe_bad_0'                                                                      /* 行校验提示 */
];
const AMOUNT_MARKS = [
  "Doc.setField(0, 'price'", 'qe_total',                                          /* 成交单价/金额合计（PL 无金额） */
  'P1C.setSpecText(0,', "P1C.setCostField(0, 'costFactory'", "P1C.setCostField(0, 'costPacking'",
  "P1C.setCostField(0, 'costInland'", "P1C.setCostField(0, 'costOther'",
  'P1C.setCostConfirmed(0,', 'P1C.applySuggestedPrice(0)',                        /* 成本融合区+填价保护 */
  'P1C.addFee()', 'P1C.setFeeField(', 'P1C.autoAllocateFee(', 'P1C.removeFee(',   /* 费用管理 */
  "P1C.setPricingParam('fx'", "P1C.setPricingParam('feeInPrice'",
  "P1C.setPricingParam('feeRate'", "P1C.setPricingParam('markupRate'",
  "P1C.setPricingParam('freightMarkup'", "P1C.setPricingParam('commissionRate'",  /* 定价参数 */
  'P1C.startPricing()',                                                           /* 核价 */
  'P1C.setIncoterm(', 'P1C.setNamedPlace(',                                        /* 贸易术语（订单卡） */
  "P1C.setFreightRow('forwarder'", "P1C.setFreightRow('inland'", "P1C.setFreightRow('packing'",
  "P1C.setFreightRow('insurance'", "P1C.setFreightRow('handling'", "P1C.setFreightRow('duty'",
  "P1C.setFreightRow('lastmile'", "P1C.setFreightRow('other'",                    /* 运费八项 */
  "P1C.setExtra('discount'", "P1C.setExtra('other_charges'"                       /* 折扣/其他 */
];
const PL_MARKS = [
  'Doc.setPackagingMode(', 'Doc.setTotalPackages(',
  "Doc.setField(0, 'packages'", "Doc.setField(0, 'net'", "Doc.setField(0, 'gross'", "Doc.setField(0, 'volume'",
  "Doc.termField('marks'"
];
const TYPE_EXTRA = {
  PI: ["Doc.termField('bank'"],
  SC: ["Doc.termField('bank'", "Doc.termField('signDate'", "Doc.termField('signPlace'", "Doc.termField('contractTerms'", "Doc.setField(0, 'hsCode'"],
  CI: ["Doc.termField('bank'", "Doc.termField('shipment'", "Doc.termField('vessel'", "Doc.termField('origin'", "Doc.setField(0, 'hsCode'"],
  PL: PL_MARKS
};

for (const type of ['QT', 'PI', 'SC', 'CI', 'PL']) {
  const html = renderFor(mkDoc(type));
  const marks = COMMON_MARKS.concat(type === 'PL' ? [] : AMOUNT_MARKS).concat(TYPE_EXTRA[type] || []);
  const miss = marks.filter(m => html.indexOf(m) < 0);
  ok('A/' + type + ' 字段完整性：' + marks.length + ' 个可编辑入口全部可达' + (miss.length ? '（缺：' + miss.join(' | ') + '）' : ''), miss.length === 0);
}

/* ================= B. 卡片结构 ================= */
{
  const html = renderFor(mkDoc('QT'));
  ok('B1 订单信息卡存在', html.indexOf('id="rc_order_card"') >= 0 && html.indexOf('>订单信息<') >= 0);
  ok('B2 产品明细与成本卡存在（含卡片搜索）', html.indexOf('id="rc_items_card"') >= 0 && html.indexOf('qe_prodSearch') >= 0);
  ok('B3 费用卡存在', html.indexOf('id="p1c_fees_panel"') >= 0);
  ok('B4 运费卡存在且按 RunCheng 分组', html.indexOf('id="p1c_freight_panel"') >= 0
    && html.indexOf('国内费用（工厂侧）') >= 0 && html.indexOf('出口与国际费用') >= 0);
  ok('B5 高级/内部参数卡存在', html.indexOf('id="p1c_pricing_panel"') >= 0 && html.indexOf('高级 / 内部参数') >= 0);
  ok('B6 核价汇总卡存在', html.indexOf('id="p1c_result_card"') >= 0 && html.indexOf('>核价汇总<') >= 0);
  ok('B7 右侧 A4 预览保留', html.indexOf('id="qe_preview"') >= 0 && html.indexOf('qe-preview-scroll') >= 0);
  ok('B8 fx 唯一入口（订单卡 1 处，参数卡不再重复）', html.split("P1C.setPricingParam('fx'").length - 1 === 1);
  ok('B9 incoterm 唯一入口（订单卡 1 处）', html.split('P1C.setIncoterm(').length - 1 === 1);
  ok('B10 客户快照卡与手填路径共存', html.indexOf('qe-cust-card') >= 0 || html.indexOf('qe_custSearch') >= 0);

  const pl = renderFor(mkDoc('PL'));
  ok('B11 PL 零内部核价界面（无定价/费用/运费卡）', pl.indexOf('id="p1c_fees_panel"') < 0
    && pl.indexOf('id="p1c_freight_panel"') < 0 && pl.indexOf('id="p1c_pricing_panel"') < 0
    && pl.indexOf('id="p1c_result_card"') < 0 && pl.indexOf('qe_prodSearch') < 0);
  ok('B12 PL 包装方式卡保留', pl.indexOf('Doc.setPackagingMode(') >= 0 && pl.indexOf('包装方式') >= 0);
}

/* ================= C. 简洁入口行为（走既有校验链） ================= */
{
  /* 客户下拉：pickCust 快照语义（按值快照、清地址、card 模式） */
  const d = mkDoc('QT');
  QuoteEdit.draft = d; QuoteEdit.invalid = {}; QuoteEdit.costInvalid = {}; QuoteEdit.pricingResult = null;
  const c = Store.customers().find(x => x.company === 'ACME Ltd');
  Doc.custDropdown(String(c.id));
  eq('C1 客户下拉 → 快照 id', d.customer.id, c.id);
  eq('C2 快照按值复制 company', d.customer.company, 'ACME Ltd');
  eq('C3 快照按值复制 address', d.customer.address, '1 Main St');
  eq('C4 pickCust 后 custMode=card', QuoteEdit.custMode, 'card');
  ok('C5 客户库 email/phone/whatsapp 未进单据快照（保护要求一）',
    d.customer.email === undefined && d.customer.phone === undefined && d.customer.whatsapp === undefined);
  /* C6 真实断言：预置非空旧买方地址 → 执行客户切换 → 断言被清空（不得串到新客户） */
  d.buyerAddress = 'No.88 Old Street, Previous Buyer';   /* 模拟上一个客户留下的买方地址 */
  const c2 = Store.customers().find(x => x.company === 'GlobalBuy GmbH');
  Doc.custDropdown(String(c2.id));
  eq('C6 换客户清空旧买方地址（预置非空 → 切换 → 清空，A3 语义）', d.buyerAddress, '');
  eq('C6b 换客户后快照指向新客户', d.customer.company, 'GlobalBuy GmbH');

  /* 客户下拉 → 手填 */
  Doc.custDropdown('__manual');
  eq('C7 手填模式切换', QuoteEdit.custMode, 'manual');
  eq('C8 手填客户不关联客户库', d.customer.id, null);

  /* 产品卡片搜索：添加 = addRow + pickProduct（同一校验链） */
  const p = Store.products()[0];
  const d2 = mkDoc('QT');
  QuoteEdit.draft = d2; QuoteEdit.invalid = {}; QuoteEdit.costInvalid = {};
  QuoteEdit.pricingResult = null; QuoteEdit.pricingStale = false; QuoteEdit.prodQuery = '电焊网';
  const htmlHits = Doc.prodSearchHTML(Store.products());
  ok('C9 卡片搜索命中产品并渲染 rc-prod-opt', htmlHits.indexOf('rc-prod-opt') >= 0 && htmlHits.indexOf('电焊网D2') >= 0);
  const n0 = d2.items.length;
  Doc.addProductFromLibrary(String(p.id));
  eq('C10 添加后行数 +1', d2.items.length, n0 + 1);
  eq('C11 新行带入产品 id', d2.items[n0].productId, p.id);
  eq('C12 成本快照按值带入 costFactory', d2.items[n0].costFactory, 8.5);
  eq('C13 规格描述快照带入 specText', d2.items[n0].specText, '浸塑');
  eq('C14 成本确认态带入', d2.items[n0].costConfirmed, true);
  eq('C15 搜索词已复位', QuoteEdit.prodQuery, '');
  ok('C16 添加触发核价失效（markStale 链保持）', QuoteEdit.pricingStale === true);
  ok('C17 添加触发 dirty', QuoteEdit.dirty === true);

  /* 未确认成本的产品：null 不转 0 */
  Store.addProduct({ nameCn: '无成本产品D2', unit: 'roll', price: 3 });
  const p2 = Store.products().find(x => x.nameCn === '无成本产品D2');
  const d3 = mkDoc('QT');
  QuoteEdit.draft = d3; QuoteEdit.invalid = {}; QuoteEdit.costInvalid = {}; QuoteEdit.pricingStale = false;
  Doc.addProductFromLibrary(String(p2.id));
  const last = d3.items[d3.items.length - 1];
  ok('C18 产品库无成本 → 快照保持 null（不静默转 0）',
    last.costFactory === null && last.costPacking === null && last.costConfirmed === null);
}

/* ================= D. 保护要求与既有保护链 ================= */
{
  const html = renderFor(mkDoc('QT'));
  ok('D1 「填入建议价」按钮保留（保护要求二：留空=建议价不可安全实现，维持按钮）',
    html.indexOf('P1C.applySuggestedPrice(0)') >= 0);
  ok('D2 pricingStale 提示入口保留', html.indexOf('P1C.startPricing()') >= 0);
  /* 费用金额改动失效链（BUG-07 语义）在卡片重构后不变：直接调用 setFeeField 走原函数 */
  const d = mkDoc('QT');
  QuoteEdit.draft = d; QuoteEdit.invalid = {}; QuoteEdit.costInvalid = {};
  QuoteEdit.pricingStale = false; QuoteEdit.dirty = false;
  P1C.setFeeField(0, 'amountCny', '');
  ok('D3 费用留空 → stale+dirty（BUG-07 保护在重构后保持）',
    QuoteEdit.pricingStale === true && QuoteEdit.dirty === true && d.fees[0].amountCny === '');
  /* 渲染层不含任何新写入口：全部 oninput/onchange 落在既有 setter + P1-D-02 新增白名单 */
  const setters = ['Doc.termField', 'Doc.custField', 'Doc.setField', 'Doc.setTemplate',
    'Doc.pickProduct', 'Doc.setPackagingMode', 'Doc.setTotalPackages',
    'P1C.setFeeField', 'P1C.setCostField', 'P1C.setPricingParam', 'P1C.setFreightRow', 'P1C.setExtra',
    'P1C.setSpecText', 'P1C.setCostConfirmed', 'P1C.setIncoterm', 'P1C.setNamedPlace', 'P1C.setManualAlloc',
    'Doc.custDropdown', 'Doc.prodSearch', 'Doc.searchCust'];
  const unknownHandlers = (html.match(/on(?:input|change)="([A-Za-z0-9_.]+)\(/g) || [])
    .map(s => s.replace(/on(?:input|change)="/, '').replace(/\($/, ''))
    .filter(h => setters.indexOf(h) < 0);
  ok('D4 渲染层没有未知写入口（全部为既有/新增白名单 setter）'
    + (unknownHandlers.length ? '（未知：' + unknownHandlers.join(' | ') + '）' : ''), unknownHandlers.length === 0);
}

/* ================= E. P1-D-02c：核价过期提示实时显示 ================= */
{
  /* E1：全新渲染（未过期）——稳定 id 常驻、display:none */
  const html = renderFor(mkDoc('QT'));
  ok('E1 核价汇总卡含稳定 DOM 标识 p1c_stale_mark（常驻）',
    html.indexOf('id="p1c_stale_mark"') >= 0);
  const spanFresh = (html.match(/<span id="p1c_stale_mark"[^>]*>/) || [''])[0];
  ok('E2 未过期时提示隐藏（display:none）', spanFresh.indexOf('display:none') >= 0);

  /* E3：过期渲染——display:inline */
  const d = mkDoc('QT');
  QuoteEdit.draft = d; QuoteEdit.invalid = {}; QuoteEdit.costInvalid = {};
  QuoteEdit.pricingResult = null; QuoteEdit.pricingStale = true;
  const htmlStale = Pages.quoteEdit();
  const spanStale = (htmlStale.match(/<span id="p1c_stale_mark"[^>]*>/) || [''])[0];
  ok('E3 过期时提示显示（display:inline）', spanStale.indexOf('display:inline') >= 0);

  /* E4：成本输入走轻量链，不整页 render（VM 环境 document.getElementById 返回 null，
     markStale→showStaleMark 静默，不得抛错、不得调 UI.render） */
  const renderCalls = [];
  ctx.UI.render = function () { renderCalls.push(1); };
  const d2 = mkDoc('QT');
  QuoteEdit.draft = d2; QuoteEdit.invalid = {}; QuoteEdit.costInvalid = {};
  QuoteEdit.pricingResult = null; QuoteEdit.pricingStale = false; QuoteEdit.dirty = false;
  P1C.setCostField(0, 'costFactory', '12');
  ok('E4 setCostField 触发 stale 且未调用 UI.render（输入不失焦）',
    QuoteEdit.pricingStale === true && renderCalls.length === 0);
  P1C.setFreightRow('forwarder', 'amount', '100');
  ok('E5 setFreightRow 同样 stale 且未调用 UI.render',
    QuoteEdit.pricingStale === true && renderCalls.length === 0);
  P1C.setPricingParam('markupRate', '35');
  ok('E6 setPricingParam stale 且未调用 UI.render',
    QuoteEdit.pricingStale === true && renderCalls.length === 0);

  /* E7：开始核价 → stale 复位（提示随之消失；startPricing 本身允许一次整页 render） */
  P1C.startPricing();
  ok('E7 startPricing 后 pricingStale 复位（过期提示消失）',
    QuoteEdit.pricingStale === false && renderCalls.length === 1);
  const htmlAfter = Pages.quoteEdit();
  const spanAfter = (htmlAfter.match(/<span id="p1c_stale_mark"[^>]*>/) || [''])[0];
  ok('E8 重新核价后渲染的提示为隐藏态', spanAfter.indexOf('display:none') >= 0);

  /* E9：Doc.refresh 轻量刷新翻过期态（数量/单价等路径）——同机制、不整页 render */
  QuoteEdit.pricingStale = false;
  QuoteEdit.pricingResult = { ready: true, items: [], warnings: [], feeStates: [] };
  const before = renderCalls.length;
  Doc.refresh();
  ok('E9 Doc.refresh 在有结果时翻过期态且未整页 render',
    QuoteEdit.pricingStale === true && renderCalls.length === before);
}


