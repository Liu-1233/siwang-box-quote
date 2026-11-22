/*
 * P1-C 报价编辑器集成 · 测试套件（Node 层）
 *
 * 覆盖（P1-C 任务书 §10.2）：
 *   A. 成本管理    —— null/0 三态、确认态、未确认不 ready、产品库快照带入、不反写产品库
 *   B. 定价        —— 双模式、模式切换重算、手续费后利润率、汇率/费率阻断、加成率联动
 *   C. 费用分摊    —— 自动/人工/混合单位拦截/总额守恒/多笔合并/行增删排序不串
 *   D. 价格保护    —— 手动价保留、0 价非空、一键填入、历史价不自动重算、历史参数不补默认
 *   E. 保存        —— 新建/修改/重开/_unknown.pricing/fees/失败草稿保留/未知字段保留/PL 拒收
 *   F. 单据隔离    —— QT ready、PI/SC/CI 快照、PL 零内部数据
 *   G. FIX-01 专项 —— 六项验收缺陷（费用阻断/运费静默修正/成本未确认/失效令牌/PL 剥离/独立解压）
 *   H. FIX-02 专项 —— BUG-07：费用金额任何修改（含留空/非法）都必须失效旧核价并标记 dirty
 *
 * 方法：真实 storage.js（os.tmpdir 隔离）+ mock 渲染桥 + VM 加载真实 pages.js 取 P1C/Doc。
 *       全程不触碰生产 userData，不修改任何冻结文件。
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const os = require('os');
const path = require('path');

/* P1-C-FIX-01 BUG-06：工程根目录按**本测试文件所在位置**解析（tests/p1c/run.js → 上两级），
   只加载当前解压目录里的源码，不依赖开发机原始目录；原样解压后 node tests/p1c/run.js 必须成功。 */
const ROOT = path.resolve(__dirname, '..', '..');
const DEV = ROOT;
okRoot();
function okRoot() {
  const need = ['app/model.js', 'app/pricing.js', 'app/pages.js', 'app/store.js', 'storage.js'];
  const missing = need.filter(f => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) {
    console.error('FATAL 工程根目录解析失败（' + ROOT + '），缺少：' + missing.join(', '));
    process.exit(1);
  }
  /* 断言被加载源码路径属于当前测试根目录（不得借开发目录里的另一份源码冒充独立解压验收） */
  const loaded = ['app/model.js', 'app/pricing.js', 'storage.js'].map(f =>
    require.resolve(path.join(ROOT, f)).replace(/\\/g, '/'));
  const rootNorm = ROOT.replace(/\\/g, '/');
  for (const p of loaded) {
    if (!p.startsWith(rootNorm + '/')) {
      console.error('FATAL 加载路径不在测试根目录内：' + p);
      process.exit(1);
    }
  }
  console.log('PASS G0 工程根目录按测试文件位置解析：' + rootNorm);
  console.log('PASS G0b 被加载源码（model/pricing/storage）全部位于当前测试根目录内');
}
const M = require(path.join(ROOT, 'app', 'model.js'));
const Pricing = require(path.join(ROOT, 'app', 'pricing.js'));

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

/* ---------- 环境：真实 storage + mock 桥 ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-p1c-'));
const storage = require(DEV + '/storage.js').createStorage(tmp);
global.window = {
  SBModel: M,
  SBW: {
    load() { return storage.load(); },
    save(db) { return storage.save(db); },
    paths() { return storage.paths(); }
  }
};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const Store = new Function(fs.readFileSync(DEV + '/app/store.js', 'utf8') + '\nreturn Store;').call(global.window);

/* ---------- VM 加载真实 pages.js（取 P1C / Doc / QuoteEdit） ---------- */
const toasts = [];
const confirms = [];
const ctx = {
  window: global.window, localStorage: global.localStorage, Store, MODEL: M, Pricing,
  document: {
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {} })
  },
  esc: s => String(s == null ? '' : s), money: (v, c) => String(v), jid: s => String(s), jidq: s => String(s),
  UI: {
    toast(m) { toasts.push(String(m)); },
    confirm(title, msg, cb) { confirms.push({ title, msg }); if (cb) cb(); },
    render() {}, go() {}, current: '', closeModal() {}
  },
  Prod: { priceSummary: () => 'x' }, DocsFilter: { type: 'ALL' }, setTimeout: f => f(),
  console, Math, JSON, Date, Number, isFinite, Object, Array, String, parseInt, parseFloat
};
ctx.global = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(DEV + '/app/pages.js', 'utf8') + ';this.__X={P1C,Doc,QuoteEdit,Pages,Settings};', ctx, { filename: 'pages.js' });
const P1C = ctx.__X.P1C, Doc = ctx.__X.Doc, QuoteEdit = ctx.__X.QuoteEdit;
ok('VM 加载真实 pages.js 并取到 P1C/Doc/QuoteEdit', !!P1C && !!Doc && !!QuoteEdit);

/* ---------- 公共构造 ---------- */
function freightAllConfirmed() {
  return P1C.FREIGHT_KEYS().map(k => ({
    item: k, amount: 0, currency: (Pricing.FREIGHT_ITEMS[k] || ['', 'USD'])[1],
    confirmed: true, charge_customer: false, included_in_cost: false
  }));
}
function mkDoc(over) {
  const d = {
    type: 'QT', currency: 'USD', date: '2026-11-19', sourceId: null,
    customer: { id: null, name: 'N', company: 'C', country: '', address: '' },
    /* 成本三态：factory=10 实数；packing/inland/other 明确 0（零成本）；确认态 true */
    items: [{ _rowId: 'r1', nameCn: '产品A', nameEn: 'A', qty: 10, unit: '㎡', price: null, costFactory: 10, costPacking: 0, costInland: 0, costOther: 0, costConfirmed: true }],
    fx: 6.6, feeRate: 0.03, targetMargin: Pricing.marginFromMarkupForMode(0.4, 0.03, 1),
    commissionRate: 0.2, freightMarkup: 0, markupRate: 0.4, feeInPrice: 1, pricingVersion: null,
    fees: [], payment: 'T/T',
    _unknown: { pricing: { incoterm: 'EXW', namedPlace: 'Anping', freight: freightAllConfirmed(), extra: { discount: 0, other_charges: 0 } } }
  };
  return Object.assign(d, over || {});
}

/* ================= A. 成本管理 ================= */
{
  const d = mkDoc({ items: [mkDoc().items[0]] });
  d.items[0].costPacking = 2;      /* 每销售单位 2 CNY */
  const eng = P1C.engineItems(d);
  eq('A1 成本字段映射 cost_factory', eng[0].cost_factory, 10);
  /* §3.4 专项：costPacking 每单位 → 引擎本行总额（×qty，仅计算层一次） */
  eq('A2 §3.4 costPacking×qty：每单位2×数量10=引擎总额20', eng[0].cost_packing, 20);
  const d5 = mkDoc({ items: [Object.assign({}, d.items[0], { qty: 5 })] });
  eq('A2b 同一 costPacking=2、qty=5 → 引擎总额 10（不重复乘）', P1C.engineItems(d5)[0].cost_packing, 10);
  /* null 不转 0 */
  const dn = mkDoc({ items: [Object.assign({}, mkDoc().items[0], { costPacking: null, costInland: null, costOther: null, costConfirmed: null })] });
  eq('A3 costPacking=null → 引擎 null（不静默转 0）', P1C.engineItems(dn)[0].cost_packing, null);
  eq('A3b costFactory=10、其余 null → inland/other null', P1C.engineItems(dn)[0].cost_inland === null && P1C.engineItems(dn)[0].cost_other === null, true);
  /* 明确 0 是零成本 */
  const dz = mkDoc({ items: [Object.assign({}, d.items[0], { costOther: 0 })] });
  eq('A4 明确 0 = 零成本（引擎收 0）', P1C.engineItems(dz)[0].cost_other, 0);
  /* 确认态三态 */
  const dc = mkDoc({ items: [Object.assign({}, d.items[0], { costConfirmed: false })] });
  eq('A5 costConfirmed=false → 引擎 cost_confirmed=false', P1C.engineItems(dc)[0].cost_confirmed, false);
  eq('A5b costConfirmed=null → 引擎 cost_confirmed=false', P1C.engineItems(dn)[0].cost_confirmed, false);
  /* 未确认成本不 ready */
  const du = mkDoc({ items: [Object.assign({}, d.items[0], { costConfirmed: null })] });
  QuoteEdit.draft = du;
  const ru = P1C.run(du);
  eq('A6 未确认成本 → ready=false', ru.ready, false);
  ok('A6b 未确认成本产生引擎警告', ru.warnings.some(w => w.indexOf('未确认') >= 0));
  /* 产品库快照带入 + 不反写 */
  Store.addProduct({ nameCn: '焊网P1C测试', unit: '㎡', mesh: 100, wire: 0.1, width: 1.22, price: 5.88,
    specText: '浸塑 1.5mm', costFactory: 8.5, costPacking: 0.5, costInland: 0, costOther: null, costConfirmed: true });
  const pRec = Store.products().find(p => p.nameCn === '焊网P1C测试');
  ok('A7 产品库可携带 V5 成本扩展字段', !!pRec && !!pRec.id);
  const pid = pRec.id;
  QuoteEdit.draft = { type: 'QT', currency: 'USD', items: [{ _rowId: 'rx', nameCn: '', qty: 3, unit: '' }] };
  Doc.pickProduct(0, pid);
  const row = QuoteEdit.draft.items[0];
  eq('A8 pickProduct 带入规格描述快照', row.specText, '浸塑 1.5mm');
  eq('A8b 带入出厂成本', row.costFactory, 8.5);
  eq('A8c 带入包装成本', row.costPacking, 0.5);
  eq('A8d 明确 0 原样带入（inland=0 不是 null）', row.costInland, 0);
  eq('A8e 产品库未填的 other → null（不转 0）', row.costOther, null);
  eq('A8f 带入确认态', row.costConfirmed, true);
  const pAfter = Store.products().find(p => p.id === pid);
  ok('A9 带入不反写产品库（成本字段原样）', pAfter.costFactory === 8.5 && pAfter.specText === '浸塑 1.5mm');
  QuoteEdit.draft.items[0].costFactory = 99;
  ok('A9b 改本单成本不影响产品库', Store.products().find(p => p.id === pid).costFactory === 8.5);
}

/* ================= B. 定价 ================= */
{
  /* B1 含费模式完整核价（全条件满足 → ready） */
  const d = mkDoc();
  QuoteEdit.draft = d;
  const r = P1C.run(d);
  const expected = Pricing.ceil2((10 / 6.6) / (1 - 0.03 - Pricing.marginFromMarkupForMode(0.4, 0.03, 1)));
  eq('B1 含费建议价 = ceil2(cost_usd/(1−fee−margin))', r.items[0].suggested_price, expected);
  eq('B1b 全条件满足 ready=true', r.ready, true);
  eq('B1c 订单提成 = halfUp2(利润×20%)', r.totals.order_commission, Pricing.halfUp2(r.totals.order_profit * 0.2));
  eq('B1d 公司利润 = 利润 − 提成', r.totals.company_profit, Pricing.r2(r.totals.order_profit - r.totals.order_commission));
  /* B2 不含费模式 */
  const d0 = mkDoc({ feeInPrice: 0, targetMargin: Pricing.marginFromMarkupForMode(0.4, 0.03, 0) });
  const r0 = P1C.run(d0);
  const exp0 = Pricing.ceil2((10 / 6.6) / (1 - 0 - Pricing.marginFromMarkupForMode(0.4, 0.03, 0)));
  eq('B2 不含费建议价 = 成本×(1+加成)÷fx 口径', r0.items[0].suggested_price, exp0);
  eq('B2b 引擎 fee_in_price=false', r0.totals.fee_in_price, false);
  ok('B2c 不含费产生老法提示', r0.warnings.some(w => w.indexOf('老法') >= 0));
  eq('B2d 手续费后实际利润率 = margin−fee（原始精度）', Pricing.afterFeeMarginFromMode(d0.targetMargin, 0.03, 0), d0.targetMargin - 0.03);
  /* B3 模式切换重新换算（走真实 setPricingParam） */
  QuoteEdit.draft = mkDoc();
  P1C.setPricingParam('feeInPrice', '0');
  eq('B3 切换不含费后 targetMargin 重算 = mk/(1+mk)', QuoteEdit.draft.targetMargin, Pricing.marginFromMarkupForMode(0.4, 0.03, 0));
  eq('B3b 与含费模式值不同（不沿用）', QuoteEdit.draft.targetMargin !== Pricing.marginFromMarkupForMode(0.4, 0.03, 1), true);
  P1C.setPricingParam('feeInPrice', '1');
  eq('B3c 切回含费再重算', QuoteEdit.draft.targetMargin, Pricing.marginFromMarkupForMode(0.4, 0.03, 1));
  /* B4 双显示 */
  eq('B4 含费模式手续费后利润率=targetMargin（引擎原值原样）', Pricing.afterFeeMarginFromMode(0.277142857142857, 0.03, 1), 0.277142857142857);
  eq('B4b mode0 引擎 margin 不等于手续费后利润率', Pricing.afterFeeMarginFromMode(0.2857142857, 0.03, 0) !== 0.2857142857, true);
  /* B5 汇率缺失阻断 */
  const dfx = mkDoc({ fx: null });
  const rfx = P1C.run(dfx);
  ok('B5 汇率缺失 → 阻断告警', rfx.warnings.some(w => w.indexOf('汇率') >= 0));
  eq('B5b 汇率缺失 → ready=false', rfx.ready, false);
  eq('B5c 汇率缺失 → 成本 USD 为 null', rfx.items[0].cost_usd, null);
  /* B6 非法费率阻断 */
  const df = mkDoc({ feeRate: 1.0, targetMargin: 0.1 });
  const rf = P1C.run(df);
  ok('B6 feeRate=1 → 引擎阻断', rf.warnings.some(w => w.indexOf('须填写') >= 0 || w.indexOf('100%') >= 0));
  eq('B6b ready=false', rf.ready, false);
  /* B7 加成率变化后建议价更新 */
  QuoteEdit.draft = mkDoc();
  P1C.setPricingParam('markupRate', '50');
  const r50 = P1C.run(QuoteEdit.draft);
  ok('B7 加成率 40%→50% 后建议价上升', r50.items[0].suggested_price > r.items[0].suggested_price);
  eq('B7b targetMargin 同步换算', QuoteEdit.draft.targetMargin, Pricing.marginFromMarkupForMode(0.5, 0.03, 1));
  /* B8 币种边界：CNY 单据停用自动核价 */
  const dcn = mkDoc({ currency: 'CNY' });
  const rcn = P1C.run(dcn);
  eq('B8 CNY 单据 ready=false（不冒充 USD 结果）', rcn.ready, false);
  ok('B8b 明确提示仅支持 USD', rcn.warnings.some(w => w.indexOf('USD') >= 0));
  ok('B8c 未调用引擎（items 建议价全 null）', rcn.items.every(i => i.suggested_price == null));
  /* B9 pricingVersion 在使用引擎后记录 */
  QuoteEdit.draft = mkDoc({ pricingVersion: null });
  P1C.startPricing();
  eq('B9 核价后记录引擎版本', QuoteEdit.draft.pricingVersion, Pricing.PRICING_VERSION);
}

/* ================= C. 费用分摊 ================= */
{
  const twoRows = [
    { _rowId: 'r1', nameCn: 'A', nameEn: 'A', qty: 1, unit: '㎡', price: null, costFactory: 10, costPacking: 0, costInland: 0, costOther: 0, costConfirmed: true },
    { _rowId: 'r2', nameCn: 'B', nameEn: 'B', qty: 3, unit: '㎡', price: null, costFactory: 10, costPacking: 0, costInland: 0, costOther: 0, costConfirmed: true }
  ];
  /* C1 同单位自动分摊 + 摊入成本 */
  const d = mkDoc({ items: twoRows.map(x => Object.assign({}, x)), fees: [{ label: '模具费', note: '', amountCny: 100, allocations: null }] });
  QuoteEdit.draft = d;
  const rBefore = P1C.run(d);
  eq('C1 未分摊 → feePending=true', rBefore.feePending, true);
  ok('C1b 未分摊 → 引擎阻断正式建议价', rBefore.warnings.some(w => w.indexOf('分摊') >= 0));
  eq('C1c 未分摊 → suggested_price=null', rBefore.items[0].suggested_price, null);
  P1C.autoAllocateFee(0);
  eq('C1d 自动分摊总额守恒（25+75=100）', Pricing.r2(d.fees[0].allocations.reduce((s, a) => s + a.amountCny, 0)), 100);
  ok('C1e 分摊带 rowId 稳定身份', d.fees[0].allocations.every(a => typeof a.rowId === 'string'));
  const rAfter = P1C.run(d);
  eq('C1f 分摊完成 → feePending=false', rAfter.feePending, false);
  eq('C1g 行1摊入 25/1=每件25 → 总成本 35', rAfter.items[0].cost_total_cny, 35);
  eq('C1h 行2摊入 75/3=每件25 → 总成本 35', rAfter.items[1].cost_total_cny, 35);
  ok('C1i ready 恢复 true', rAfter.ready === true);
  /* C2 混合单位禁止自动 */
  const dm = mkDoc({ items: [Object.assign({}, twoRows[0]), Object.assign({}, twoRows[1], { unit: 'set' })], fees: [{ label: 'F', note: '', amountCny: 100, allocations: null }] });
  QuoteEdit.draft = dm;
  toasts.length = 0;
  P1C.autoAllocateFee(0);
  eq('C2 混合单位自动分摊被拒（allocations 仍 null）', dm.fees[0].allocations, null);
  ok('C2b 明确提示禁止自动', toasts.some(t => t.indexOf('禁止自动') >= 0));
  /* C3 人工分摊成功 */
  QuoteEdit.manualAlloc = { 0: '30', 1: '70' };
  P1C.applyManualFee(0);
  ok('C3 人工分摊保存（带 rowId）', Array.isArray(dm.fees[0].allocations) && dm.fees[0].allocations.length === 2 && dm.fees[0].allocations.every(a => a.rowId));
  eq('C3b 总额守恒', Pricing.r2(dm.fees[0].allocations.reduce((s, a) => s + a.amountCny, 0)), 100);
  const rm = P1C.run(dm);
  eq('C3c 人工分摊 → feePending=false', rm.feePending, false);
  eq('C3d 行分摊进入成本（30/1=30 → 40）', rm.items[0].cost_total_cny, 40);
  /* C4 总额不一致阻断 */
  const dm2 = mkDoc({ items: [Object.assign({}, twoRows[0]), Object.assign({}, twoRows[1], { unit: 'set' })], fees: [{ label: 'F', note: '', amountCny: 100, allocations: null }] });
  QuoteEdit.draft = dm2;
  QuoteEdit.manualAlloc = { 0: '30', 1: '69' };
  toasts.length = 0;
  P1C.applyManualFee(0);
  eq('C4 总额不一致 → 分摊不保存', dm2.fees[0].allocations, null);
  ok('C4b 明确报错（含总额对比）', toasts.some(t => t.indexOf('101') >= 0 || t.indexOf('严格') >= 0));
  /* C5 多笔费用正确汇总 */
  const dmul = mkDoc({
    items: [Object.assign({}, twoRows[0]), Object.assign({}, twoRows[1])],
    fees: [
      { label: 'F1', note: '', amountCny: 100, allocations: null },
      { label: 'F2', note: '', amountCny: 50, allocations: null }
    ]
  });
  QuoteEdit.draft = dmul;
  P1C.autoAllocateFee(0);
  P1C.autoAllocateFee(1);
  const rMul = P1C.run(dmul);
  eq('C5 两笔费用合并后行1总成本 = 10 + (100/4) + (50/4) = 47.5', rMul.items[0].cost_total_cny, 47.5);
  eq('C5b 行2 = 10 + (75/3) + (37.5/3) = 47.5', rMul.items[1].cost_total_cny, 47.5);
  eq('C5c 合并无 pending', rMul.feePending, false);
  /* C5d 零金额费用状态 none 且不影响 */
  const dz2 = mkDoc({ fees: [{ label: 'Z', note: '', amountCny: 0, allocations: null }] });
  const rz2 = P1C.run(dz2);
  eq('C5d 零费用 → feePending=false', rz2.feePending, false);
  ok('C5e 零费用状态 none', rz2.feeStates.every(s => s.status === 'none'));
  /* C7 行删除/重排后不错误关联 */
  const dd = mkDoc({ items: [Object.assign({}, twoRows[0]), Object.assign({}, twoRows[1])], fees: [{ label: 'F', note: '', amountCny: 100, allocations: null }] });
  QuoteEdit.draft = dd;
  P1C.autoAllocateFee(0);
  const delSt = P1C.feeStatusOf(dd.fees[0], dd);
  dd.items.splice(0, 1);                       /* 删除第 1 行（其 rowId=r1 在分摊记录里） */
  const stDel = P1C.feeStatusOf(dd.fees[0], dd);
  eq('C7 删行后旧分摊不对位 → pending（不猜不串）', stDel.status, 'pending');
  ok('C7b 明确说明原因', (stDel.reason || '').indexOf('重新分摊') >= 0);
  const rDel = P1C.run(dd);
  eq('C7c 删行后整体 pending（不给正式建议价）', rDel.feePending, true);
  eq('C7d 删行后建议价=null', rDel.items[0].suggested_price, null);
  /* C7e 重排后分摊跟随 rowId（费用跟着行走） */
  const dr = mkDoc({ items: [Object.assign({}, twoRows[0]), Object.assign({}, twoRows[1], { costFactory: 20 })], fees: [{ label: 'F', note: '', amountCny: 100, allocations: null }] });
  QuoteEdit.draft = dr;
  P1C.autoAllocateFee(0);
  const rPre = P1C.run(dr);
  const c0pre = rPre.items[0].cost_total_cny;   /* row0: 10 + 25/1 */
  const c1pre = rPre.items[1].cost_total_cny;   /* row1: 20 + 75/3 */
  dr.items.reverse();                            /* 整体重排 */
  const rPost = P1C.run(dr);
  eq('C7e 重排后 row0 成本 = 原 row1（费用跟行走）', rPost.items[0].cost_total_cny, c1pre);
  eq('C7f 重排后 row1 成本 = 原 row0', rPost.items[1].cost_total_cny, c0pre);
}

/* ================= D. 价格保护 ================= */
{
  const d = mkDoc({ items: [Object.assign({}, mkDoc().items[0], { price: 2.5 })] });
  QuoteEdit.draft = d;
  const priceBefore = d.items[0].price;
  P1C.run(d);
  eq('D1 核价不覆盖手动成交价', d.items[0].price, priceBefore);
  /* D2 0 价不是空值：引擎如实保留 used_price=0；但 0 价行使 ready=false（成交单价必须大于零），
     P1-C-FIX-01 BUG-03 定案：ready 门不满足时不允许填入建议价（旧行为靠不查 ready 绕过，已修正）。
     确认弹窗+替换流程由 D3（合法手动价）覆盖。 */
  const dz = mkDoc({ items: [Object.assign({}, mkDoc().items[0], { price: 0 })] });
  QuoteEdit.draft = dz;
  P1C.startPricing();
  eq('D2 0 成交价 → 引擎 used_price=0（不当空值）', P1C.run(dz).items[0].used_price, 0);
  ok('D2b 0 价行 → ready=false（成交单价必须大于零，不静默修正）', QuoteEdit.pricingResult.ready === false);
  toasts.length = 0;
  P1C.applySuggestedPrice(0);
  ok('D2c BUG-03：ready=false 时填建议价被拒绝且 0 价原样保留', dz.items[0].price === 0 && toasts.some(t => t.indexOf('不能填入建议价') >= 0));
  /* D3 手动价 + 填入建议价 */
  const d3 = mkDoc({ items: [Object.assign({}, mkDoc().items[0], { price: 3.88 })] });
  QuoteEdit.draft = d3;
  P1C.startPricing();
  confirms.length = 0;
  P1C.applySuggestedPrice(0);
  ok('D3 已有手动价 → 弹确认', confirms.length === 1);
  eq('D3b 确认后替换为建议价', d3.items[0].price, Pricing.ceil2(QuoteEdit.pricingResult.items[0].suggested_price));
  /* D4 stale 保护：改参数后未重新核价不能填入 */
  const d4 = mkDoc();
  QuoteEdit.draft = d4;
  P1C.startPricing();
  QuoteEdit.pricingStale = true;
  toasts.length = 0;
  P1C.applySuggestedPrice(0);
  ok('D4 结果过期 → 拒绝填入并提示重新核价', toasts.some(t => t.indexOf('重新核价') >= 0));
  eq('D4b 手动价未被写入', d4.items[0].price, null);
  /* D5 历史单据：feeInPrice=null → 引擎阻断，不自动补默认 */
  const dh = mkDoc({ feeInPrice: null });
  const rh = P1C.run(dh);
  ok('D5 feeInPrice=null → 引擎明确阻断', rh.warnings.some(w => w.indexOf('手续费模式未知') >= 0));
  eq('D5b 建议价=null', rh.items[0].suggested_price, null);
  eq('D5c ready=false', rh.ready, false);
}

/* ================= E. 保存链路 ================= */
{
  /* E1 新建 QT（newDraft 默认定价参数）走真实保存 */
  const draft = JSON.parse(JSON.stringify(Doc.newDraft('QT')));
  draft.customer = { id: null, name: '', company: '保存测试客户', country: '', address: '' };
  draft.items = [{ _rowId: 'r1', nameCn: '产品X', nameEn: 'X', mesh: 100, wire: 0.1, width: 1.2, rollLen: 0, qty: 10, unit: '㎡', price: 5.88,
    specText: '规格快照', costFactory: 10, costPacking: 1, costInland: 0, costOther: null, costConfirmed: false }];
  draft.fx = 6.6; draft.feeRate = 0.03; draft.commissionRate = 0.2; draft.markupRate = 0.4;
  draft.targetMargin = Pricing.marginFromMarkupForMode(0.4, 0.03, 1);
  draft._unknown.myLegacy = { keep: true };      /* 模拟历史/其他来源的未知字段，验证更新不清除 */
  const created = Store.addDocument(draft);
  ok('E1 新建 QT 保存成功（含 V5 定价键 + 行成本快照）', !!created);
  const doc1 = Store.getDocument(created.id);
  eq('E1b 新报价默认 feeInPrice=1', doc1.feeInPrice, 1);
  eq('E1c 新报价默认 feeRate=0.03', doc1.feeRate, 0.03);
  eq('E1d 新报价默认 commissionRate=0.2', doc1.commissionRate, 0.2);
  eq('E1e fx=草稿值 6.6 原样保存（新建默认 null 的断言在 F4b）', doc1.fx, 6.6);
  ok('E1f fees=[] 数组', Array.isArray(doc1.fees));
  eq('E1g 行成本快照保留 costFactory', doc1.items[0].costFactory, 10);
  eq('E1h 行成本快照保留 costPacking', doc1.items[0].costPacking, 1);
  eq('E1i 明确 0 保留（inland=0）', doc1.items[0].costInland, 0);
  eq('E1j null 保留（other=null）', doc1.items[0].costOther, null);
  eq('E1k specText 保留', doc1.items[0].specText, '规格快照');
  eq('E1l 确认态 false 保留', doc1.items[0].costConfirmed, false);
  eq('E1m pricingVersion 保留（核价草稿带过来了）', doc1.pricingVersion, null);
  ok('E1n _unknown.pricing 种子保存（extra 显式 0）', doc1._unknown && doc1._unknown.pricing && doc1._unknown.pricing.extra && doc1._unknown.pricing.extra.discount === 0);

  /* E2/E3/E4 修改保存 + 关闭重开 + 内部扩展字段 */
  const d2 = Store.getDocument(created.id);
  d2.fx = 7.2;
  d2.fees = [{ label: '检测费', note: 'SGS', amountCny: 500, allocations: null }];
  d2._unknown.pricing = {
    incoterm: 'FOB', namedPlace: 'Qingdao',
    freight: [{ item: 'forwarder', amount: 300, currency: 'USD', confirmed: true, charge_customer: true, included_in_cost: false },
              { item: 'handling', amount: 0, currency: 'CNY', confirmed: true, charge_customer: false, included_in_cost: false }],
    extra: { discount: 20.5, other_charges: 0 },
    rogueKey: '应当被受控合并丢弃'
  };
  const spec2 = JSON.parse(JSON.stringify(d2));
  ok('E2 修改保存成功（fx+fees+_unknown.pricing）', Store.updateDocument(created.id, spec2) === true);
  const doc2 = Store.getDocument(created.id);
  eq('E2b fx 更新到 7.2', doc2.fx, 7.2);
  eq('E2c fees 更新', doc2.fees.length === 1 && doc2.fees[0].amountCny === 500, true);
  eq('E2d targetMargin/markupRate 未被本次修改破坏', doc2.markupRate, 0.4);
  eq('E3 重开后参数完整（id/no/sourceId 不变）', doc2.id === doc1.id && doc2.no === doc1.no && doc2.sourceId === doc1.sourceId, true);
  eq('E4 _unknown.pricing.incoterm 保存', doc2._unknown.pricing.incoterm, 'FOB');
  eq('E4b namedPlace 保存', doc2._unknown.pricing.namedPlace, 'Qingdao');
  eq('E4c freight 完整保存（2 行）', doc2._unknown.pricing.freight.length === 2 && doc2._unknown.pricing.freight[0].amount === 300, true);
  eq('E4d extra 完整保存（20.5/0）', doc2._unknown.pricing.extra.discount === 20.5 && doc2._unknown.pricing.extra.other_charges === 0, true);
  eq('E4e 受控合并丢弃 rogueKey', 'rogueKey' in doc2._unknown.pricing, false);

  /* E5 fees 分摊记录完整保存（含 rowId） */
  const d5 = Store.getDocument(created.id);
  d5.fees[0].allocations = [{ sort: 0, amountCny: 500, rowId: 'r1' }];
  ok('E5 分摊记录保存成功', Store.updateDocument(created.id, JSON.parse(JSON.stringify(d5))) === true);
  const doc5 = Store.getDocument(created.id);
  ok('E5b 重开后分摊完整（sort/amountCny/rowId）', doc5.fees[0].allocations && doc5.fees[0].allocations[0].rowId === 'r1' && doc5.fees[0].allocations[0].amountCny === 500);

  /* E6 保存失败草稿保留：非法 fees 被写门拒绝，原单据不受影响 */
  const d6 = Store.getDocument(created.id);
  const badPatch = JSON.parse(JSON.stringify(d6));
  badPatch.fees = [{ label: '坏数据', note: '', amountCny: null, allocations: null }];
  ok('E6 非法 fees → 保存失败（写门拒绝）', Store.updateDocument(created.id, badPatch) === false);
  const doc6 = Store.getDocument(created.id);
  ok('E6b 原单据未被破坏（fees 仍是合法分摊记录）', doc6.fees[0].allocations && doc6.fees[0].allocations[0].amountCny === 500);
  ok('E6c 草稿对象未被落盘过程改写', badPatch.fees[0].amountCny === null);
  const badFx = JSON.parse(JSON.stringify(Store.getDocument(created.id)));
  badFx.fx = -1;
  ok('E6d 非法 fx=-1 → 保存失败', Store.updateDocument(created.id, badFx) === false);

  /* E7 历史/其他未知字段不被清除（myLegacy 在 E1 创建时已随单据入库） */
  const d7 = Store.getDocument(created.id);
  ok('E7 自定义未知字段保留', d7._unknown.myLegacy && d7._unknown.myLegacy.keep === true);
  d7._unknown.quoteLayout = { templateId: 'trade-v1', columns: [{ id: 'c1', label: '备注列' }] };
  Store.updateDocument(created.id, JSON.parse(JSON.stringify(d7)));
  const doc7 = Store.getDocument(created.id);
  ok('E7 自定义未知字段保留', doc7._unknown.myLegacy && doc7._unknown.myLegacy.keep === true);
  ok('E7b quoteLayout 保留', doc7._unknown.quoteLayout && doc7._unknown.quoteLayout.templateId === 'trade-v1');

  /* E8 PL 拒收定价键 */
  const plConv = M.buildConversionDraft(doc7, 'PL');
  ok('E8 QT→PL 转换成功', plConv.ok);
  const plDoc = Store.addDocument(plConv.draft);
  ok('E8b PL 保存成功', !!plDoc);
  const plId = plDoc.id;
  const plNow = Store.getDocument(plId);
  const plPatch = JSON.parse(JSON.stringify(plNow));
  plPatch.fx = 6.6; plPatch.fees = [{ label: 'x', note: '', amountCny: 1, allocations: null }];
  Store.updateDocument(plId, plPatch);
  const plAfter = Store.getDocument(plId);
  ok('E8c PL 更新不接受定价键（fx 不存在或 null）', !('fx' in plAfter) || plAfter.fx === null);
  ok('E8d PL 更新不接受 fees（无费用或空）', !Array.isArray(plAfter.fees) || plAfter.fees.length === 0);
  ok('E8e PL 行无成本键', ['specText', 'costFactory', 'costPacking', 'costInland', 'costOther', 'costConfirmed'].every(k => !(k in plAfter.items[0])));
}

/* ================= F. 单据隔离 ================= */
{
  const src = Store.documents('QT')[0];
  ok('F1 QT 存在且可核价（ready 路径已在 B1 验证）', !!src);
  const conv = t => M.buildConversionDraft(src, t);
  const pi = conv('PI'), sc = conv('SC'), ci = conv('CI');
  ok('F2 QT→PI/SC/CI 转换成功', pi.ok && sc.ok && ci.ok);
  const KEYS = ['fx', 'feeRate', 'targetMargin', 'commissionRate', 'freightMarkup', 'markupRate', 'feeInPrice', 'pricingVersion', 'fees'];
  ok('F2b PI 保留定价快照', KEYS.every(k => k in pi.draft) && pi.draft.fx === 7.2);
  ok('F2c SC 保留定价快照', sc.draft.fx === 7.2);
  ok('F2d CI 保留定价快照', ci.draft.fx === 7.2);
  ok('F2e PI/SC/CI 行成本快照延续', ['specText', 'costFactory', 'costPacking'].every(k => k in pi.draft.items[0]));
  const pl = conv('PL');
  ok('F3 QT→PL 九个定价键剥离', KEYS.every(k => !(k in pl.draft)));
  ok('F3b PL 行成本键剥离', ['specText', 'costFactory', 'costPacking', 'costInland', 'costOther', 'costConfirmed'].every(k => !(k in pl.draft.items[0])));
  ok('F3c PL sourceId 保留', pl.draft.sourceId === src.id);
  /* F4 新建 PL 草稿无定价键（Doc.newDraft PL 分支）
     P1-D-04：五类单据新建时都会写入 _unknown.quoteLayout 版式声明（quotation-rc-v1），
     所以这里不能再用「_unknown 整体为空」判定；改为判定「无核价种子 _unknown.pricing」。 */
  const plNew = Doc.newDraft('PL');
  ok('F4 新建 PL 无定价键', KEYS.every(k => !(k in plNew)) && !(plNew._unknown && plNew._unknown.pricing));
  const qtNew = Doc.newDraft('QT');
  ok('F4b 新建 QT 默认键齐全（含费模式 + fees=[]）', qtNew.feeInPrice === 1 && qtNew.feeRate === 0.03 && qtNew.commissionRate === 0.2 && Array.isArray(qtNew.fees) && qtNew.fx === null);
  ok('F4c 新建 QT 带 _unknown.pricing 种子', qtNew._unknown && qtNew._unknown.pricing && qtNew._unknown.pricing.extra.discount === 0 && qtNew._unknown.pricing.extra.other_charges === 0);
  /* F5 历史单据（无定价键）打开 → run 不阻断保存也不补默认 */
  const legacy = Store.addDocument({
    type: 'QT', date: '2026-10-01', sourceId: null,
    customer: { id: null, name: '', company: '历史客户', country: '', address: '' },
    items: [{ nameCn: '旧产品', nameEn: '', mesh: 0, wire: 0, width: 0, rollLen: 0, qty: 2, unit: '㎡', price: 3.5 }],
    currency: 'USD', term: '', payment: '', validity: '', delivery: '', remark: '',
    seller: null, bank: '', buyerAddress: '', marks: '', shipment: '', vessel: '', origin: '',
    contractTerms: '', signDate: '', signPlace: '', packagingMode: null, totalPackages: null,
    totals: {}
  });
  ok('F5 历史 v5 单据（无定价键）保存成功（默认值补齐为 null）', !!legacy);
  const legacyDoc = Store.getDocument(legacy.id);
  ok('F5b 历史 feeInPrice=null 保持未知（不自动变 1）', legacyDoc.feeInPrice === null && legacyDoc.feeRate === null && legacyDoc.commissionRate === null);
  QuoteEdit.draft = legacyDoc;
  const rl = P1C.run(legacyDoc);
  ok('F5c 历史单据核价被阻断（模式未知）', rl.warnings.some(w => w.indexOf('手续费模式未知') >= 0));
  /* 原样保存一次历史单据 → 未知态不丢 */
  ok('F5d 历史单据原样保存仍成功', Store.updateDocument(legacy.id, JSON.parse(JSON.stringify(legacyDoc))) === true);
  ok('F5e 保存后 feeInPrice 仍为 null（不被补默认）', Store.getDocument(legacy.id).feeInPrice === null);
}

/* ================= G. P1-C-FIX-01 六项验收缺陷专项 ================= */
{
  /* ---- BUG-01：待分摊/金额缺失费用必须真正阻断核价 ---- */
  const g1 = mkDoc({ fees: [{ label: 'missing amount', note: '', amountCny: null, allocations: null }] });
  QuoteEdit.draft = g1;
  const r1 = P1C.run(g1);
  eq('G1 BUG-01 复现：金额缺失费用 → ready=false', r1.ready, false);
  eq('G1b 金额缺失费用 → feePending=true（状态与费用分摊一致）', r1.feePending, true);
  eq('G1c 不产生可正式填入的建议价（全部 null）', r1.items.every(x => x.suggested_price === null), true);
  ok('G1d 明确说明不按零费用处理', (r1.blockers || []).some(w => w.indexOf('不按零费用处理') >= 0));
  const ef1 = P1C.engineFee(g1, P1C.engineItems(g1));
  ok('G1e 适配层不把缺失费用转成 0（引擎收到 fee=null 而非 amountCny:0）', ef1.invalid === true && ef1.fee === null);
  /* 非法变体 */
  const g1n = mkDoc({ fees: [{ label: 'neg', note: '', amountCny: -5, allocations: null }] });
  ok('G1f 负数金额费用 → ready=false', P1C.run(g1n).ready === false);
  const g1s = mkDoc({ fees: [{ label: 'str', note: '', amountCny: 'abc', allocations: null }] });
  ok('G1g 非数字金额费用 → ready=false', P1C.run(g1s).ready === false);
  const g1p = mkDoc({ fees: [{ label: 'prec', note: '', amountCny: 100.001, allocations: null }] });
  ok('G1h 超两位小数金额费用 → ready=false（不自动舍入）', P1C.run(g1p).ready === false);
  /* 明确 0 仍是合法零费用（区分三态） */
  const g1z = mkDoc({ fees: [{ label: 'zero', note: '', amountCny: 0, allocations: null }] });
  const rz1 = P1C.run(g1z);
  ok('G1i 明确 0 = 无费用（' + 'none），不阻断 ready', rz1.ready === true && rz1.feeStates[0].status === 'none');

  /* ---- BUG-02：非法运费与折扣不得被静默修正 ---- */
  const fkBadAmt = freightAllConfirmed().map(x => Object.assign({}, x));
  fkBadAmt[0].amount = null;
  const g2 = mkDoc(); g2._unknown.pricing.freight = fkBadAmt;
  QuoteEdit.draft = g2;
  const r2 = P1C.run(g2);
  ok('G2 BUG-02 复现：已确认运费 amount=null → ready=false（不按零运费放行）', r2.ready === false && (r2.blockers || []).some(w => w.indexOf('不按零运费处理') >= 0));
  eq('G2b 适配层金额保持 null（不静默转 0）', P1C.build(g2).freight[0].amount, null);
  const fkBadCur = freightAllConfirmed().map(x => Object.assign({}, x));
  fkBadCur[1].currency = null;
  const g2c = mkDoc(); g2c._unknown.pricing.freight = fkBadCur;
  const r2c = P1C.run(g2c);
  ok('G2c currency=null → ready=false 且不自动替换默认币种', r2c.ready === false && P1C.build(g2c).freight[1].currency === null && (r2c.blockers || []).some(w => w.indexOf('币种') >= 0));
  const g2d = mkDoc(); g2d._unknown.pricing.extra = { discount: null, other_charges: 0 };
  const r2d = P1C.run(g2d);
  ok('G2d discount=null → ready=false（区分 null 与明确 0，视图层保持 null 不转 0）',
    r2d.ready === false && P1C.pricingExtView(g2d).extra.discount === null && (r2d.blockers || []).some(w => w.indexOf('折扣') >= 0));
  const g2e = mkDoc(); g2e._unknown.pricing.freight[0].amount = 100.001;
  const r2e = P1C.run(g2e);
  ok('G2e 运费 100.001 → ready=false 且原样保留不四舍五入', r2e.ready === false && P1C.build(g2e).freight[0].amount === 100.001 && (r2e.blockers || []).some(w => w.indexOf('两位小数') >= 0));
  const g2f = mkDoc(); g2f._unknown.pricing.extra = { discount: 1.234, other_charges: 0 };
  const r2f = P1C.run(g2f);
  ok('G2f 折扣 1.234 → ready=false（不得先舍入再放行）', r2f.ready === false && (r2f.blockers || []).some(w => w.indexOf('两位小数') >= 0));
  const g2g = mkDoc(); g2g._unknown.pricing.extra = { discount: 0, other_charges: 1.234 };
  ok('G2g other_charges 1.234 → ready=false', P1C.run(g2g).ready === false);
  /* 界面输入层：超两位小数原样保留（setFreightRow/setExtra 不再舍入） */
  const g2h = mkDoc();
  QuoteEdit.draft = g2h;
  P1C.setFreightRow(P1C.FREIGHT_KEYS()[0], 'amount', '100.001');
  eq('G2h setFreightRow 输入 100.001 原样保存（不再舍入成 100）', g2h._unknown.pricing.freight[0].amount, 100.001);
  P1C.setExtra('discount', '1.234');
  eq('G2i setExtra 输入 1.234 原样保存（不再舍入成 1.23）', g2h._unknown.pricing.extra.discount, 1.234);
  /* 明确 0 折扣是合法零折扣，不阻断 */
  const g2j = mkDoc(); g2j._unknown.pricing.extra = { discount: 0, other_charges: 0 };
  ok('G2j 明确 0 折扣/费用 = 合法零值，ready=true', P1C.run(g2j).ready === true);
  /* 非法数据阻断受影响的财务合计：建议价/订单合计不可作为正式结果填入 */
  ok('G2k 非法运费时建议价全 null（财务合计不作为正式结果）', r2.items.every(x => x.suggested_price === null));

  /* ---- BUG-03：成本未确认时不得填入建议价 ---- */
  const g3 = mkDoc({ items: [Object.assign({}, mkDoc().items[0], { costConfirmed: null })] });
  QuoteEdit.draft = g3;
  P1C.startPricing();
  const r3 = QuoteEdit.pricingResult;
  ok('G3 BUG-03 复现前置：成本未确认 → ready=false 且结果带建议价数字', r3.ready === false && r3.items[0].suggested_price != null);
  g3.items[0].price = null;   /* 确保没有已填成交价，走无确认分支 */
  toasts.length = 0;
  P1C.applySuggestedPrice(0);
  ok('G3b ready=false 时不执行填价（不绕过 ready 门）', g3.items[0].price === null && toasts.some(t => t.indexOf('不能填入建议价') >= 0));
  /* 已手填的成交价仍保留，不被自动覆盖 */
  const g3b = mkDoc({ items: [Object.assign({}, mkDoc().items[0], { costConfirmed: null, price: 3.5 })] });
  QuoteEdit.draft = g3b;
  P1C.startPricing();
  toasts.length = 0;
  P1C.applySuggestedPrice(0);
  eq('G3c 已手填成交价 3.5 原样保留（未确认成本下不被建议价覆盖）', g3b.items[0].price, 3.5);

  /* ---- BUG-04：修改成本后旧建议价必须失效 ---- */
  const g4 = mkDoc({ items: [Object.assign({}, mkDoc().items[0], { costFactory: 10 })] });
  QuoteEdit.draft = g4;
  P1C.startPricing();
  ok('G4 BUG-04 复现前置：核价完成 pricingStale=false', QuoteEdit.pricingStale === false && QuoteEdit.pricingResult.ready === true);
  const oldSug = Pricing.ceil2(QuoteEdit.pricingResult.items[0].suggested_price);
  P1C.setCostField(0, 'costFactory', '500');
  ok('G4b 修改成本 → pricingStale=true', QuoteEdit.pricingStale === true);
  toasts.length = 0;
  P1C.applySuggestedPrice(0);
  ok('G4c 结果过期后填价被拒绝', toasts.some(t => t.indexOf('重新核价') >= 0 || t.indexOf('过期') >= 0));
  /* 重新核价后成本 500 的新建议价，与旧价不同且可填 */
  P1C.startPricing();
  ok('G4d 重新核价后建议价随成本更新（≠旧价）', Pricing.ceil2(QuoteEdit.pricingResult.items[0].suggested_price) !== oldSug);
  /* 确认弹窗回调执行前再次核实结果有效性：已有手动价 → 点填价 → 确认前改成本 → 再确认 → 拒绝写入 */
  g4.items[0].price = 3.5;
  const origConfirm = ctx.UI.confirm;
  let deferredCb = null;
  ctx.UI.confirm = function (t, m, cb) { deferredCb = cb; };   /* 挂起回调，模拟用户未点确认 */
  P1C.applySuggestedPrice(0);
  ok('G4e 弹出替换确认（回调挂起）', typeof deferredCb === 'function');
  P1C.setCostField(0, 'costFactory', '600');                   /* 确认前又改了成本 */
  deferredCb();
  ctx.UI.confirm = origConfirm;
  ok('G4f 回调执行前令牌失效 → 拒绝写入过期建议价（手动价 3.5 保留）', toasts.some(t => t.indexOf('过期') >= 0) && g4.items[0].price === 3.5);
  /* 各编辑入口都触发失效 */
  Store.addProduct({ nameCn: 'G段产品', unit: '㎡', mesh: 100, wire: 0.1, width: 1.22, price: 5.88, specText: 'G', costFactory: 8.5, costPacking: 0.5, costInland: 0, costOther: 0, costConfirmed: true });
  const pidG = Store.products().find(p => p.nameCn === 'G段产品').id;
  P1C.startPricing();
  const staleChecks = [];
  QuoteEdit.pricingStale = false;
  P1C.setCostConfirmed(0, '0');            staleChecks.push(['setCostConfirmed', QuoteEdit.pricingStale]);
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  Doc.addRow();                            staleChecks.push(['addRow', QuoteEdit.pricingStale]);
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  Doc.removeRow(0);                        staleChecks.push(['removeRow', QuoteEdit.pricingStale]);
  QuoteEdit.draft = mkDoc({ items: [Object.assign({}, mkDoc().items[0]), Object.assign({}, mkDoc().items[0], { _rowId: 'r2' })] });
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  Doc.pickProduct(1, pidG);                staleChecks.push(['pickProduct', QuoteEdit.pricingStale]);
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  P1C.addFee();                            staleChecks.push(['addFee', QuoteEdit.pricingStale]);
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  P1C.setFreightRow(P1C.FREIGHT_KEYS()[0], 'amount', '9');
  staleChecks.push(['setFreightRow', QuoteEdit.pricingStale]);
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  P1C.setExtra('discount', '2');
  staleChecks.push(['setExtra', QuoteEdit.pricingStale]);
  /* 数量/成交价/币种走 Doc.setField → Doc.refresh */
  QuoteEdit.draft = mkDoc();
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  Doc.setField(0, 'qty', 99);              staleChecks.push(['setField qty', QuoteEdit.pricingStale]);
  P1C.startPricing(); QuoteEdit.pricingStale = false;
  Doc.setField(0, 'price', 4.44);          staleChecks.push(['setField price', QuoteEdit.pricingStale]);
  staleChecks.forEach(x => ok('G4g ' + x[0] + ' → 核价结果失效', x[1] === true));
  /* 「开始核价」本身不得把刚算好的结果标记为过期 */
  P1C.startPricing();
  ok('G4h startPricing 后结果不过期', QuoteEdit.pricingStale === false);

  /* ---- BUG-05：QT→PL 剥离 _unknown.pricing ---- */
  const g5src = mkDoc();
  g5src.fx = 6.6; g5src.feeInPrice = 1;
  g5src._unknown.myLegacy = { keep: true };
  const conv5 = M.buildConversionDraft(g5src, 'PL');
  ok('G5 BUG-05：QT→PL 草稿剥离 _unknown.pricing', conv5.ok && conv5.draft._unknown && conv5.draft._unknown.pricing === undefined);
  ok('G5b 无关历史扩展字段保留（myLegacy）', conv5.draft._unknown && conv5.draft._unknown.myLegacy && conv5.draft._unknown.myLegacy.keep === true);
  eq('G5c sourceId 保留', conv5.draft.sourceId, g5src.id == null ? null : String(g5src.id));
  ok('G5d 顶层定价键仍剥离（fx/fees 不在 PL）', !('fx' in conv5.draft) && !('fees' in conv5.draft));
  /* 实际落盘的 PL 同样无内部核价扩展字段 */
  conv5.draft.date = '2026-11-19';
  const saved5 = Store.addDocument(JSON.parse(JSON.stringify(conv5.draft)));
  ok('G5e PL 草稿落盘成功', !!saved5 && !!saved5.id);
  const onDisk5 = Store.getDocument(saved5.id);
  ok('G5f 落盘 PL 无 _unknown.pricing（内部运费/折扣/incoterm 全不在）', !(onDisk5._unknown && onDisk5._unknown.pricing));
  ok('G5g 落盘 PL 保留无关历史扩展（myLegacy）', onDisk5._unknown && onDisk5._unknown.myLegacy && onDisk5._unknown.myLegacy.keep === true);
  ok('G5h 落盘 PL 行级成本字段不存在', onDisk5.items.every(it => it.costFactory === undefined && it.specText === undefined));
  /* PL→PL 复制同样剥离 */
  const plCopy = M.buildConversionDraft(onDisk5, 'PL');
  ok('G5i PL→PL 复制不带入内部核价扩展', plCopy.ok && !(plCopy.draft._unknown && plCopy.draft._unknown.pricing) && plCopy.draft._unknown.myLegacy.keep === true);
  /* 金额类快照延续不受影响：QT→PI 保留 _unknown.pricing */
  const piCopy = M.buildConversionDraft(g5src, 'PI');
  ok('G5j QT→PI 内部快照延续（_unknown.pricing 保留）', piCopy.ok && piCopy.draft._unknown && !!piCopy.draft._unknown.pricing);

  /* ---- BUG-06：测试独立解压可运行（本文件即按 ROOT 加载，G0/G0b 已在头部断言） ---- */
  ok('G6 storage.js 也从当前测试根目录加载', require.resolve(path.join(ROOT, 'storage.js')).replace(/\\/g, '/').indexOf(ROOT.replace(/\\/g, '/') + '/') === 0);
  ok('G6b VM 加载的 pages.js 属于当前测试根目录', fs.realpathSync(path.join(ROOT, 'app', 'pages.js')) === fs.realpathSync(path.join(ROOT, 'app', 'pages.js')) && fs.existsSync(path.join(ROOT, 'app', 'pages.js')));
  ok('G6c 测试进程的 __dirname 在工程 tests/p1c 下', __dirname.replace(/\\/g, '/').indexOf(ROOT.replace(/\\/g, '/') + '/tests/p1c') === 0);
}

/* ================= H. P1-C-FIX-02 BUG-07 专项：费用编辑后旧建议价未失效 ================= */
{
  /* 公共前置（任务书 §三 每个场景固定顺序）：
     1.创建合法报价单 2.成本已确认（mkDoc 默认 costConfirmed=true）
     3.完成费用分摊 4.执行核价 ready=true 5.记录原建议价/手动成交价 */
  function bug7Setup(manualPrice, tag) {
    const d = mkDoc({ fees: [{ label: '模具费', note: '', amountCny: 100, allocations: null }] });
    if (manualPrice != null) d.items[0].price = manualPrice;
    QuoteEdit.draft = d;
    QuoteEdit.dirty = false;
    QuoteEdit.pricingStale = false;
    P1C.autoAllocateFee(0);
    P1C.startPricing();
    /* 分摊/核价动作本身会置 dirty（记账行为，非缺陷）：重置后隔离被测操作，只看 setFeeField 自己的影响 */
    QuoteEdit.pricingStale = false;
    QuoteEdit.dirty = false;
    ok('H前置[' + tag + '] 核价 ready=true 且结果有效（费用 100 已分摊）',
      QuoteEdit.pricingResult && QuoteEdit.pricingResult.ready === true && QuoteEdit.pricingStale === false);
    return d;
  }

  /* T01 清空费用金额 → stale=true、dirty=true、空串原样保留（不转 0） */
  const t1 = bug7Setup(null, 'T01');
  const sug1 = Pricing.ceil2(QuoteEdit.pricingResult.items[0].suggested_price);
  ok('T01前置 原建议价已记录（' + sug1.toFixed(2) + '）', sug1 > 0);
  P1C.setFeeField(0, 'amountCny', '');
  eq('T01 清空费用 → pricingStale=true', QuoteEdit.pricingStale, true);
  eq('T01b 清空费用 → dirty=true（Doc.markDirty 已执行，无提前 return 绕过）', QuoteEdit.dirty, true);
  eq('T01c 空值保存为空串（不自动转 0）', t1.fees[0].amountCny, '');

  /* T02 输入 -1 → stale=true、dirty=true、负数原样保留 */
  const t2 = bug7Setup(null, 'T02');
  QuoteEdit.pricingStale = false; QuoteEdit.dirty = false;   /* 隔离本次操作前的状态 */
  P1C.setFeeField(0, 'amountCny', '-1');
  eq('T02 非法金额 -1 → pricingStale=true', QuoteEdit.pricingStale, true);
  eq('T02b 非法金额 -1 → dirty=true', QuoteEdit.dirty, true);
  eq('T02c 负数原样保留（不静默修正）', t2.fees[0].amountCny, '-1');

  /* T03 输入 1.234（三位小数）→ stale=true、dirty=true、原样保留 */
  const t3 = bug7Setup(null, 'T03');
  QuoteEdit.pricingStale = false; QuoteEdit.dirty = false;
  P1C.setFeeField(0, 'amountCny', '1.234');
  eq('T03 非法金额 1.234 → pricingStale=true', QuoteEdit.pricingStale, true);
  eq('T03b 非法金额 1.234 → dirty=true', QuoteEdit.dirty, true);
  eq('T03c 三位小数原样保留（不四舍五入成 1.23）', t3.fees[0].amountCny, '1.234');

  /* T04 输入合法金额 → 同样 stale=true、dirty=true（合法修改也要失效旧核价） */
  const t4 = bug7Setup(null, 'T04');
  QuoteEdit.pricingStale = false; QuoteEdit.dirty = false;
  P1C.setFeeField(0, 'amountCny', '80');
  eq('T04 合法金额修改 → pricingStale=true', QuoteEdit.pricingStale, true);
  eq('T04b 合法金额修改 → dirty=true', QuoteEdit.dirty, true);
  eq('T04c 合法金额按原规则保存为数值 80', t4.fees[0].amountCny, 80);
  ok('T04d 金额改过 → 旧分摊清空待重摊（不静默沿用）', t4.fees[0].allocations === null);

  /* T05 修改后尝试填入旧建议价 → 必须拒绝 */
  const t5 = bug7Setup(null, 'T05');
  ok('T05前置 无手动成交价（price=null）', t5.items[0].price == null);
  P1C.setFeeField(0, 'amountCny', '');        /* 修改费用（清空，非法态） */
  toasts.length = 0;
  P1C.applySuggestedPrice(0);
  ok('T05 修改费用后填入旧建议价被拒绝（price 仍为 null）',
    t5.items[0].price == null && toasts.some(t => t.indexOf('重新核价') >= 0));

  /* T06 非法金额重新核价 → ready=false，不产生正式建议价 */
  const t6 = bug7Setup(null, 'T06');
  P1C.setFeeField(0, 'amountCny', '-1');
  P1C.startPricing();
  const r6 = QuoteEdit.pricingResult;
  eq('T06 非法金额 -1 重新核价 → ready=false', r6.ready, false);
  ok('T06b 不产生正式建议价（全 null，不可填入）', r6.items.every(x => x.suggested_price === null));
  const t6b = bug7Setup(null, 'T06b');
  P1C.setFeeField(0, 'amountCny', '1.234');
  P1C.startPricing();
  eq('T06c 非法金额 1.234 重新核价 → ready=false', QuoteEdit.pricingResult.ready, false);
  const t6c = bug7Setup(null, 'T06c');
  P1C.setFeeField(0, 'amountCny', '');
  P1C.startPricing();
  eq('T06d 留空重新核价 → ready=false（金额缺失不按零费用放行）', QuoteEdit.pricingResult.ready, false);

  /* T07 修改费用后重新核价 → 生成新的有效建议价 */
  const t7 = bug7Setup(null, 'T07');
  const sug7 = Pricing.ceil2(QuoteEdit.pricingResult.items[0].suggested_price);
  P1C.setFeeField(0, 'amountCny', '80');
  P1C.autoAllocateFee(0);
  P1C.startPricing();
  const r7 = QuoteEdit.pricingResult;
  eq('T07 合法金额 80 重摊重核 → ready=true', r7.ready, true);
  ok('T07b 生成新的有效建议价（>0 且 ≠ 旧价 ' + sug7.toFixed(2) + '）',
    r7.items[0].suggested_price > 0 && Pricing.ceil2(r7.items[0].suggested_price) !== sug7);
  ok('T07c 重新核价后旧价可以填入（保护解除，stale=false）', QuoteEdit.pricingStale === false);

  /* T08 已有手动成交价时修改费用 → 原成交价不变 */
  const t8 = bug7Setup(3.5, 'T08');
  eq('T08前置 手动成交价 3.5 已填', t8.items[0].price, 3.5);
  P1C.setFeeField(0, 'amountCny', '-1');
  ok('T08b 修改费用 → stale=true（旧建议价失效）', QuoteEdit.pricingStale === true);
  eq('T08c setFeeField 本身不清除/覆盖手动成交价', t8.items[0].price, 3.5);
  toasts.length = 0;
  P1C.applySuggestedPrice(0);
  ok('T08d 过期建议价填入被拒绝，手动成交价 3.5 保持不变',
    t8.items[0].price === 3.5 && toasts.some(t => t.indexOf('重新核价') >= 0));

  /* 回归确认：费用名称/说明等非金额字段修改同样触发失效（原 FIX-01 行为不回退） */
  const t9 = bug7Setup(null, 'T09');
  QuoteEdit.pricingStale = false; QuoteEdit.dirty = false;
  P1C.setFeeField(0, 'label', '改名');
  ok('T09 费用名称修改 → stale=true 且 dirty=true', QuoteEdit.pricingStale === true && QuoteEdit.dirty === true);
}

/* ================= 汇总 ================= */
console.log('\nP1C ===== 结果 =====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
console.log(fail === 0 ? 'ALL PASS — ' + pass + ' checks (隔离 userData: ' + tmp + ')' : 'FAIL');
process.exit(fail === 0 ? 0 : 1);
