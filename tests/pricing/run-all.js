/*
 * P1-A 定价引擎测试（tests/pricing/run-all.js）
 *
 * ① 26 项润成原始回归：从润成 V3 src/pricing.test.ts 1:1 移植，**预期值一字未改**
 * ② 新增边界测试（P0 审核定案）：
 *    K 组——基准算例（方案 A 冻结公式）、加成率往返换算、传统毛利率参照、
 *          同单位数量分摊+舍入差额守恒、混合单位拦截、人工分摊严格相等、
 *          待分摊门、null/0 语义、NaN/Infinity 防护、手填价 0 保护、亏损提成 0、USD 采购成本换算
 *    F 组——P1-A-FIX-01 缺陷回归（BUG-01～05，F36 断言已在 P1-A-FIX-02 补齐）
 *    G 组——P1-A-FIX-02 专项回归（BUG-06 手续费模式严格校验 / BUG-07 分摊原始金额精度 /
 *          BUG-08 原始明细 sort 唯一性 / BUG-09 费用缺失与零值语义）
 * ③ 三环境验证：Node require（主进程）/ node:vm（测试模式）/ window 全局（渲染进程模拟）
 *
 * 运行：node tests/pricing/run-all.js   （退出码 0 = 全部通过）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', '..', 'app', 'pricing.js');

/* ---------- 三种环境加载 ---------- */
// ① 主进程 / Node：require
const P_node = require(SRC);

// ② VM 测试模式：context 内提供 module
function loadAsVm() {
  const ctx = { module: { exports: {} }, console, setTimeout, Date, Math, JSON, Object, Array, Number, String, isFinite, RegExp, Error };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'app/pricing.js' });
  return ctx.module.exports;
}

// ③ 渲染进程模拟：无 module，window/self 全局
function loadAsRenderer() {
  const sandbox = { console, setTimeout, Date, Math, JSON, Object, Array, Number, String, isFinite, RegExp, Error };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'app/pricing.js' });
  return sandbox.Pricing;
}

const P_vm = loadAsVm();
const P_renderer = loadAsRenderer();
const IMPLS = [['node-require', P_node], ['vm', P_vm], ['renderer-global', P_renderer]];

/* ---------- 断言工具（与润成原测试同一输出格式） ---------- */
let bad = 0;
let total = 0;
function check(name, got, expect, tol = 0.02) {
  total++;
  const ok = typeof got === 'number' && Math.abs(got - expect) <= tol;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + `  got=${got} expect=${expect}`);
  if (!ok) bad++;
}
function checkWarn(name, warnings, keyword, expectPresent) {
  total++;
  const hit = warnings.some((w) => w.includes(keyword));
  const ok = hit === expectPresent;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  warnings=${JSON.stringify(warnings)}`));
  if (!ok) bad++;
}
function checkEq(name, got, expect) {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(expect);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  got=${JSON.stringify(got)} expect=${JSON.stringify(expect)}`));
  if (!ok) bad++;
}
function checkTrue(name, got) {
  total++;
  const ok = got === true;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) bad++;
}

/* ---------- 润成原始 26 项（fixture 与预期值 1:1 移植自 src/pricing.test.ts） ---------- */
const baseHeader = {
  id: 1, quote_no: 'RC-Q-1', pi_no: 'RC-PI-1', status: 'draft',
  customer_id: null, quote_date: '2026-11-17', valid_days: 7,
  fx: 6.7, fee_rate: 0.03, target_margin: 0.175, commission_rate: 0.2,
  freight_markup: 0, incoterm: 'CIF', named_place: 'Nassau, Bahamas',
  payment_terms: '30% T/T deposit, balance before shipment',
  lead_time: '25 days', packaging: '2 plywood crates', exclusions: '',
  deposit_ratio: null, buyer_contact: 'James Lin', buyer_company: 'Nassau Fencing Ltd',
  buyer_country: '', buyer_address: '', buyer_email: '', buyer_phone: '', buyer_whatsapp: '',
  fee_in_price: 1,
};
const item = {
  sort: 0, product_id: null, supplier_quote_id: null,
  name_en: 'Privacy Fence', spec: 'PVC, Height 6 ft, 31 sets', image_file: '',
  qty: 31, unit: 'set', cost_factory: 225, cost_packing: 29.4,
  cost_inland: 0, cost_other: 0, cost_confirmed: 1, final_price: null,
  purchase_currency: 'CNY', purchase_price: null, purchase_units_per_sale: 1,
  unit_conversion_confirmed: 0,
};
const freight = [
  { item: 'forwarder', amount: 1124, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 },
  { item: 'insurance', amount: 0, currency: 'USD', confirmed: 1, charge_customer: 0, included_in_cost: 0 },
];

function runOriginal26(P, tag) {
  console.log(`\n===== 润成 26 项原始回归 [${tag}] =====`);
  // A 建议价
  let d = P.computeQuote(baseHeader, [item], freight, { discount: 0, other_charges: 0 });
  check('A1 成本合计 225.95', d.items[0].cost_total_cny, 225.95);
  check('A2 建议价 42.42', d.items[0].suggested_price, 42.42);
  check('A3 折算美元成本 33.7235', d.items[0].cost_usd, 33.7235, 0.001);

  // B 手工抹零 47.70
  d = P.computeQuote(baseHeader, [Object.assign({}, item, { final_price: 47.7 })], freight, { discount: 0, other_charges: 0 });
  check('B1 产品额 1478.70', d.items[0].amount, 1478.7);
  check('B2 运费 1124.00', d.totals.freight_charged_usd, 1124.0);
  check('B3 总额 2602.70', d.totals.final_total, 2602.7);

  // C 木箱费双计告警
  d = P.computeQuote(baseHeader, [Object.assign({}, item, { final_price: 47.7 })], freight.concat([
    { item: 'packing', amount: 911.4, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 },
  ]), { discount: 0, other_charges: 0 });
  checkWarn('C1 包装费双计告警', d.warnings, '重复计算', true);

  // D 旧版国内运输提示
  d = P.computeQuote(baseHeader, [Object.assign({}, item, { cost_inland: 10, final_price: 47.7 })], freight, { discount: 0, other_charges: 0 });
  checkWarn('D1 旧运输提示', d.warnings, '国内运输', true);

  // E 老法口径：报价毛利率 m=0.25 → 售价 = (100/6.6)/(1-0.25) = 20.202 → ceil 20.21（fee 不进售价）
  d = P.computeQuote(Object.assign({}, baseHeader, { fx: 6.6, fee_rate: 0.03, target_margin: 0.25, fee_in_price: 0, incoterm: 'EXW', named_place: '', payment_terms: '30% T/T deposit' }),
    [Object.assign({}, item, { cost_factory: 100, cost_packing: 0, qty: 1, final_price: null })], [], { discount: 0, other_charges: 0 });
  check('E1 老法建议价 20.21', d.items[0].suggested_price, 20.21);
  checkWarn('E2 老法口径提醒', d.warnings, '老法口径', true);

  // F 含费口径：售价已含费率 = (100/6.6)/(1-0.03-0.25) = 21.05
  d = P.computeQuote(Object.assign({}, baseHeader, { fx: 6.6, fee_rate: 0.03, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', named_place: '', payment_terms: '30% T/T deposit' }),
    [Object.assign({}, item, { cost_factory: 100, cost_packing: 0, qty: 1, final_price: null })], [], { discount: 0, other_charges: 0 });
  check('F1 含费建议价 21.05', d.items[0].suggested_price, 21.05, 0.005);

  // G EXW 收国内陆运不告警；收货代告警
  d = P.computeQuote(Object.assign({}, baseHeader, { fx: 6.6, fee_rate: 0.03, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', named_place: '', payment_terms: '30% T/T' }),
    [Object.assign({}, item, { cost_factory: 100, cost_packing: 0, qty: 1, final_price: 21.22 })],
    [{ item: 'inland', amount: 500, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }],
    { discount: 0, other_charges: 0 });
  checkWarn('G1 EXW+国内陆运 无国际段告警', d.warnings, '国际段', false);
  d = P.computeQuote(Object.assign({}, baseHeader, { fx: 6.6, fee_rate: 0.03, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', named_place: '', payment_terms: '30% T/T' }),
    [Object.assign({}, item, { cost_factory: 100, cost_packing: 0, qty: 1, final_price: 21.22 })],
    [{ item: 'forwarder', amount: 300, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 }],
    { discount: 0, other_charges: 0 });
  checkWarn('G2 EXW+货代 国际段告警', d.warnings, '国际段', true);

  // H 付款条款为空 → 告警+阻断
  d = P.computeQuote(Object.assign({}, baseHeader, { payment_terms: '', fx: 6.6, fee_rate: 0.03, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW' }),
    [Object.assign({}, item, { cost_factory: 100, cost_packing: 0, qty: 1, final_price: 21.22 })], [], { discount: 0, other_charges: 0 });
  checkWarn('H1 付款条款缺失告警', d.warnings, '付款条款未填写', true);

  // I 木箱费按数量平均摊入成本（2026-11-18 业务确认）
  const twoItems = [
    Object.assign({}, item, { name_en: 'A', cost_factory: 100, cost_packing: 0, qty: 1, final_price: null }),
    Object.assign({}, item, { sort: 1, name_en: 'B', cost_factory: 300, cost_packing: 0, qty: 1, final_price: null }),
  ];
  d = P.computeQuote(Object.assign({}, baseHeader, { fx: 6.6, fee_rate: 0.03, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', freight_markup: 0 }),
    twoItems,
    [{ item: 'packing', amount: 260, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }],
    { discount: 0, other_charges: 0 });
  check('I1 运费行不含木箱费', d.totals.freight_charged_usd == null ? 0 : d.totals.freight_charged_usd, 0);
  check('I2 A 摊入后建议价 48.41', d.items[0].suggested_price, 48.41);
  check('I3 B 摊入后建议价 90.49', d.items[1].suggested_price, 90.49);
  check('I4 每件摊入 130 CNY', d.items[0].packing_per_unit_cny, 130);
  check('I5 总额 138.90', d.totals.final_total, 138.90, 0.02);
  check('I6 利润不双计木箱 34.73', d.totals.order_profit, 34.73, 0.02);
  d = P.computeQuote(Object.assign({}, baseHeader, { fx: 6.6, fee_rate: 0.03, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', freight_markup: 0 }),
    [Object.assign({}, item, { name_en: 'A', cost_factory: 100, cost_packing: 0, qty: 1, final_price: 100 })],
    [{ item: 'packing', amount: 260, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }],
    { discount: 0, other_charges: 0 });
  check('I7 手填单价不回写 100', d.items[0].used_price, 100);
  check('I8 单件时摊入 260 → 成本 360', d.items[0].cost_total_cny, 360);

  // J 明细包装/木箱费=本行总价，按数量平均摊入
  d = P.computeQuote(Object.assign({}, baseHeader, { incoterm: 'EXW' }),
    [Object.assign({}, item, { cost_factory: 236.68, cost_packing: 500, qty: 40, final_price: null })], [], { discount: 0, other_charges: 0 });
  check('J1 每件摊入 12.5', d.items[0].packing_per_unit_cny, 12.5);
  check('J2 成本合计 249.18', d.items[0].cost_total_cny, 249.18);
  check('J3 建议价 46.79', d.items[0].suggested_price, 46.79);
  // J4 数量为 0 → 阻断
  d = P.computeQuote(Object.assign({}, baseHeader, { incoterm: 'EXW' }),
    [Object.assign({}, item, { cost_factory: 236.68, cost_packing: 500, qty: 0, final_price: null })], [], { discount: 0, other_charges: 0 });
  checkWarn('J4 数量为 0 阻断', d.warnings, '数量必须大于零', true);
}

/* ---------- 新增边界测试（P0 审核定案） ---------- */
function runBoundary(P, tag) {
  console.log(`\n===== P1-A 新增边界测试 [${tag}] =====`);
  const exwH = Object.assign({}, baseHeader, {
    fx: 6.6, fee_rate: 0.03, target_margin: 0.2771428571, fee_in_price: 1,
    incoterm: 'EXW', named_place: '', payment_terms: '30% T/T', freight_markup: 0, commission_rate: 0.2,
  });
  const mkItem = (over) => Object.assign({}, item, { sort: 0, name_en: 'Benchmark', cost_factory: 100, cost_packing: 0, cost_inland: 0, cost_other: 0, qty: 1, unit: 'set', final_price: null }, over);

  // K1 基准算例（方案 A 冻结公式）：100 CNY、fx 6.6、加成率 40%、手续费 3%
  const mk = 0.4, fee = 0.03;
  const margin = P.marginFromMarkup(mk, fee);
  check('K1a target_margin=(1-0.03)*0.4/1.4=27.71%', margin, 0.2771428571, 0.0001);
  check('K1b 建议售价(USD)=100*1.4/0.97/6.6=21.8682', P.r4((100 / 6.6) / (1 - fee - margin)), 21.8682, 0.0005);
  check('K1c 等价式 cost*(1+mk)/(1-fee)/fx', P.r4(100 * 1.4 / 0.97 / 6.6), 21.8682, 0.0005);
  // 引擎落地值（ceil2 保留两位向上取整）
  const dK1 = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 });
  check('K1d 引擎建议价(ceil2)=21.87', dK1.items[0].suggested_price, 21.87, 0.001);
  check('K1e 传统毛利率(按实际售价)=30.71%', P.grossMarginFromMarkup(mk, fee), 0.30713, 0.0005);

  // K2 加成率往返换算一致
  const back = P.markupFromMargin(P.marginFromMarkup(0.4, 0.03), 0.03);
  check('K2 markup 往返换算 0.4', back, 0.4, 1e-9);
  const back2 = P.markupFromMargin(0.25, 0);
  check('K2b margin=0.25 无费 → 加成 1/3', back2, 1 / 3, 1e-9);
  checkTrue('K2c margin≥1-fee 时反算返回 null（不猜）', P.markupFromMargin(0.98, 0.03) === null);

  // K4 同单位按数量平均分摊 + 舍入差额守恒
  const rows3 = [
    { sort: 0, qty: 10, unit: 'set' }, { sort: 1, qty: 10, unit: 'set' }, { sort: 2, qty: 10, unit: 'set' },
  ];
  const a1 = P.allocateByQty(rows3, 100);
  /* 分配规则（定案）：前 n-1 行按 halfUp2(金额×数量占比)，合计差额归最后一行——总额严格守恒 */
  checkEq('K4a 100→[33.33,33.33,33.34]（差额归末行）', a1, [
    { sort: 0, amountCny: 33.33 }, { sort: 1, amountCny: 33.33 }, { sort: 2, amountCny: 33.34 },
  ]);
  checkTrue('K4b 分摊总额严格守恒', Math.abs(a1.reduce((s, r) => s + r.amountCny, 0) - 100) < 1e-9);
  const a2 = P.allocateByQty([{ sort: 0, qty: 1, unit: 'set' }, { sort: 1, qty: 1, unit: 'set' }], 260.01);
  checkTrue('K4c 260.01 → [130.01,130] 且守恒', Math.abs(a2[0].amountCny - 130.01) < 1e-9 && Math.abs(a2[1].amountCny - 130) < 1e-9);
  const a3 = P.allocateByQty([{ sort: 0, qty: 3, unit: 'set' }, { sort: 1, qty: 1, unit: 'set' }], 260);
  checkEq('K4d 按数量比 3:1 → [195,65]', a3, [{ sort: 0, amountCny: 195 }, { sort: 1, amountCny: 65 }]);

  // K5 混合单位拦截
  const mixed = [{ sort: 0, qty: 5, unit: 'set' }, { sort: 1, qty: 5, unit: 'm' }];
  checkTrue('K5a 混合单位 checkUnitsForAllocation 拒绝', P.checkUnitsForAllocation(mixed).ok === false);
  checkTrue('K5b 混合单位 allocateByQty 返回 null（禁止自动平均）', P.allocateByQty(mixed, 100) === null);
  checkTrue('K5c 同单位（set/set 变体/套）归一通过', P.checkUnitsForAllocation([{ qty: 1, unit: 'Set' }, { qty: 1, unit: '套' }]).ok === true);

  // K6 人工分摊：总额严格相等
  checkTrue('K6a 人工分摊 [60,40]=100 通过', P.validateManualAllocation([{ sort: 0, amountCny: 60 }, { sort: 1, amountCny: 40 }], 100).ok === true);
  const v1 = P.validateManualAllocation([{ sort: 0, amountCny: 60 }, { sort: 1, amountCny: 40.01 }], 100);
  checkTrue('K6b 差 0.01 拒绝（严格相等）', v1.ok === false);
  checkTrue('K6c 负数拒绝', P.validateManualAllocation([{ sort: 0, amountCny: -5 }, { sort: 1, amountCny: 105 }], 100).ok === false);
  checkTrue('K6d 三位小数拒绝', P.validateManualAllocation([{ sort: 0, amountCny: 33.333 }, { sort: 1, amountCny: 66.667 }], 100).ok === false);

  // K7 待分摊门：有费用未分摊 → 建议价置空 + 阻断提示
  const dK7 = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 260, allocations: null } });
  checkTrue('K7a 待分摊时建议价=null', dK7.items[0].suggested_price === null);
  checkWarn('K7b 待分摊阻断提示', dK7.warnings, '费用尚未完成分摊', true);
  checkTrue('K7c 待分摊不进 ready', dK7.ready === false);
  // 完成自动分摊后恢复建议价
  const allocOK = P.allocateByQty([{ sort: 0, qty: 1, unit: 'set' }], 260);
  const dK7b = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 260, allocations: allocOK } });
  /* 260 摊入 1 件 → 成本 360 → 360/6.6/(1-0.03-0.27714)=78.7273 → ceil2 = 78.73 */
  check('K7d 分摊完成后建议价 78.73（260 摊入 1 件，40% 加成口径）', dK7b.items[0].suggested_price, 78.73);
  // allocationStatus 状态机
  checkEq('K7e status none', P.allocationStatus([], { amountCny: 0 }), 'none');
  checkEq('K7f status pending', P.allocationStatus([{ sort: 0, qty: 1, unit: 'set' }], { amountCny: 260, allocations: null }), 'pending');
  checkEq('K7g status auto', P.allocationStatus([{ sort: 0, qty: 1, unit: 'set' }], { amountCny: 260, allocations: allocOK }), 'auto');
  /* 人工分布（[40,60]）与数量平均（[50,50]）不同但总额相等 → manual */
  checkEq('K7h status manual', P.allocationStatus([{ sort: 0, qty: 1, unit: 'set' }, { sort: 1, qty: 1, unit: 'set' }], { amountCny: 100, allocations: [{ sort: 0, amountCny: 40 }, { sort: 1, amountCny: 60 }] }), 'manual');

  // K8 null/0 语义：数值 null 必须阻断；0+已确认=明确零
  const dK8 = P.computeQuote(exwH, [mkItem({ cost_other: null })], [], { discount: 0, other_charges: 0 });
  checkWarn('K8a 成本字段 null 阻断（不降级为 0）', dK8.warnings, '成本必须非负且合计大于零', true);
  const dK8b = P.computeQuote(exwH, [mkItem({ cost_other: 0, cost_confirmed: 1 })], [], { discount: 0, other_charges: 0 });
  checkTrue('K8b 成本 0 + 已确认 = 明确零，不告警未确认', !dK8b.warnings.some((w) => w.includes('未确认')));
  const dK8c = P.computeQuote(exwH, [mkItem({ cost_confirmed: 0 })], [], { discount: 0, other_charges: 0 });
  checkWarn('K8c 未确认 → 告警', dK8c.warnings, '采购成本未确认', true);
  checkTrue('K8d 未确认 → 不 ready（任务书第 7 条）', dK8c.ready === false);

  // K9 NaN/Infinity 防护
  const dK9 = P.computeQuote(exwH, [mkItem({ qty: Infinity })], [], { discount: 0, other_charges: 0 });
  checkWarn('K9a qty=Infinity 阻断', dK9.warnings, '数量必须大于零', true);
  const dK9b = P.computeQuote(exwH, [mkItem({ cost_factory: NaN })], [], { discount: 0, other_charges: 0 });
  checkWarn('K9b cost=NaN 阻断', dK9b.warnings, '成本必须非负且合计大于零', true);
  checkTrue('K9c NaN 单不 ready', dK9b.ready === false);

  // K10 手填价 0 保护：0 是"明确填了 0"，引擎不覆盖但阻断成交单价
  const dK10 = P.computeQuote(exwH, [mkItem({ final_price: 0 })], [], { discount: 0, other_charges: 0 });
  check('K10a used_price 保持 0（不被建议价覆盖）', dK10.items[0].used_price, 0, 0);
  checkWarn('K10b 成交单价 0 阻断', dK10.warnings, '成交单价必须大于零', true);

  // K11 亏损单提成 0（zero_on_loss）
  const dK11 = P.computeQuote(exwH, [mkItem({ final_price: 5 })], [], { discount: 0, other_charges: 0 });
  checkTrue('K11a 亏损单存在（order_profit<0）', dK11.totals.order_profit < 0);
  check('K11b 亏损提成=0', dK11.totals.order_commission, 0, 0);
  checkTrue('K11c 公司承担全额亏损（company_profit=order_profit）', Math.abs(dK11.totals.company_profit - dK11.totals.order_profit) < 1e-9);

  // K12 USD 采购成本换算：purchase_price USD × fx
  const dK12 = P.computeQuote(exwH, [mkItem({ purchase_price: 15, purchase_currency: 'USD', purchase_units_per_sale: 1, unit_conversion_confirmed: 1, cost_factory: null })], [], { discount: 0, other_charges: 0 });
  check('K12a USD 采购 15×6.6=99 折出厂成本', dK12.items[0].cost_factory, 99, 0.001);
  check('K12b 成本合计 99', dK12.items[0].cost_total_cny, 99, 0.001);
  check('K12c 成本折美元 15', dK12.items[0].cost_usd, 15, 0.001);

  // K13 fee_in_price 缺省 = 未知态（P1-A-FIX-01 BUG-01 新语义：引擎不猜测，润成含费默认由调用方适配层显式传 1）
  const hNoFlag = Object.assign({}, baseHeader); delete hNoFlag.fee_in_price;
  const dK13 = P.computeQuote(hNoFlag, [mkItem()], [], { discount: 0, other_charges: 0 });
  checkTrue('K13a fee_in_price 缺省 → totals.fee_in_price=null（未知态，不得自动转含费）', dK13.totals.fee_in_price === null);
  checkTrue('K13b fee_in_price 缺省 → 阻断不给建议价（ready=false）', dK13.ready === false && dK13.items[0].suggested_price === null);
  // 润成兼容适配层语义：显式传 1 → 含费，行为与 V3 一致（21.87）
  const hAdapted = Object.assign({}, baseHeader, { fx: 6.6, fee_rate: 0.03, target_margin: 0.2771428571, fee_in_price: 1, incoterm: 'EXW', named_place: '', payment_terms: 'T/T', freight_markup: 0, commission_rate: 0.2 });
  const dK13b = P.computeQuote(hAdapted, [mkItem()], [], { discount: 0, other_charges: 0 });
  check('K13c 润成适配层显式 1 → 含费建议价 21.87（与 V3 一致）', dK13b.items[0].suggested_price, 21.87, 0.001);
  checkTrue('K13d 显式 1 → ready 可为 true', dK13b.ready === true);

  // K14 双手续费模式换算（P0 V2 审核补充 §2 定案）
  checkTrue('K14a 引擎版本标识存在', typeof P.PRICING_VERSION === 'string' && P.PRICING_VERSION.length > 0);
  // mode1（含费）：margin=(1-0.03)*0.4/1.4=27.71%
  check('K14b mode1 换算 = 27.71%', P.marginFromMarkupForMode(0.4, 0.03, 1), 0.2771428571, 0.0001);
  // mode0（老法）：margin=0.4/1.4=28.5714%，40% 加成 → 成本×1.4
  check('K14c mode0 换算 = 28.5714%', P.marginFromMarkupForMode(0.4, 0.03, 0), 0.2857142857, 0.0001);
  checkTrue('K14d 两模式换算值不得相同（切换须重算）', Math.abs(P.marginFromMarkupForMode(0.4, 0.03, 1) - P.marginFromMarkupForMode(0.4, 0.03, 0)) > 0.001);
  // mode0 端到端：fee_in_price=0 时 price_fee=0，denom=1-0-0.285714=0.714286=1/1.4 ⇒ 售价=成本×1.4
  const exwM0 = Object.assign({}, exwH, { fee_in_price: 0, target_margin: 0.2857142857 });
  const dK14 = P.computeQuote(exwM0, [mkItem()], [], { discount: 0, other_charges: 0 });
  check('K14e mode0 建议价 = 成本×1.4÷6.6 = 21.21(ceil2 21.22)', dK14.items[0].suggested_price, P.ceil2(100 * 1.4 / 6.6), 0.001);
  checkTrue('K14f mode0 单据标记 fee_in_price=false', dK14.totals.fee_in_price === false);
  // 反算一致性：mode0/mode1 各自往返还原加成率
  check('K14g mode0 反算还原 0.4', P.markupFromMarginForMode(0.2857142857, 0.03, 0), 0.4, 0.0001);
  check('K14h mode1 反算还原 0.4', P.markupFromMarginForMode(0.2771428571, 0.03, 1), 0.4, 0.0001);
  // 历史成交价保护：已存 final_price 不被引擎覆盖（含缺省 pricingVersion 的历史单）
  const dK14h = P.computeQuote(exwM0, [mkItem({ final_price: 99 })], [], { discount: 0, other_charges: 0 });
  check('K14i 历史成交价 99 不被建议价覆盖', dK14h.items[0].used_price, 99, 1e-9);

  // K15 两种模式完整计算表（P0 V2 最后审核补充 §2：40% 加成、3% 手续费、成本 100 CNY）
  // —— 审核定案四指标对照表，逐格断言
  const mk15 = 0.4, fee15 = 0.03, fx15 = 6.6;
  // 含费模式（fee_in_price=1）
  const m1 = P.marginFromMarkupForMode(mk15, fee15, 1);
  check('K15a 含费 售价(CNY)=144.33', P.ceil2(100 * 1.4 / 0.97), 144.33, 1e-9);
  check('K15b 含费 引擎 target_margin=27.71%', m1, 0.2771428571, 0.0001);
  check('K15c 含费 手续费后利润率=target_margin=27.71%', P.afterFeeMarginFromMode(m1, fee15, 1), 0.2771428571, 0.0001);
  check('K15d 含费 传统毛利率=30.71%', P.grossMarginFromMarkup(mk15, fee15), 0.3071428571, 0.0001);
  check('K15e 含费 建议售价(USD)=21.868166→币种精度 21.87', P.ceil2((100 * 1.4 / 0.97) / fx15), 21.87, 1e-9);
  // 不含费模式（fee_in_price=0）
  const m0 = P.marginFromMarkupForMode(mk15, fee15, 0);
  check('K15f 不含费 售价(CNY)=140.00', P.ceil2(100 * 1.4), 140.0, 1e-9);
  check('K15g 不含费 引擎 target_margin=28.57%', m0, 0.2857142857, 0.0001);
  check('K15h 不含费 手续费后利润率=target_margin-fee=25.57%（不得把 28.57% 当手续费后利润率显示）', P.afterFeeMarginFromMode(m0, fee15, 0), 0.2557142857, 0.0001);
  check('K15i 不含费 传统毛利率=28.57%', P.grossMarginFromMarkup(mk15, 0), 0.2857142857, 0.0001);
  check('K15j 不含费 建议售价(USD)=140/6.6→币种精度 21.22', P.ceil2(140 / fx15), 21.22, 1e-9);
  checkTrue('K15k 两模式四个指标全部不同', m1 !== m0 && P.afterFeeMarginFromMode(m0, fee15, 0) !== m0);

  // K16 丝网盒子 v4 历史单保护（P1-A-FIX-01 新语义）：v4 老单无定价参数 → 未知态，不判模式、不给建议价
  const v4Legacy = { incoterm: 'EXW', named_place: '', payment_terms: 'T/T', fx: 6.6 };
  const dK16 = P.computeQuote(v4Legacy, [mkItem({ final_price: 21.5 })], [], { discount: 0, other_charges: 0 });
  checkTrue('K16a v4 历史单（无定价参数）→ 建议价 null（不自动重算）', dK16.items[0].suggested_price === null);
  check('K16b v4 历史单成交价 21.5 原样保留', dK16.items[0].used_price, 21.5, 1e-9);
  checkTrue('K16c v4 历史单产生"模式未知/缺参"提示（用户主动重新定价时须确认模式）', dK16.warnings.some((w) => /目标|margin|利润率|模式/.test(w)));
  checkTrue('K16d v4 历史单 totals.fee_in_price=null（保留未知，不得套用润成默认）', dK16.totals.fee_in_price === null);
  checkTrue('K16e v4 历史单 ready=false', dK16.ready === false);

  /* ---------- F 段：P1-A 第二轮缺陷回归（P1-A-FIX-01，三环境执行） ---------- */
  // F01-F05 fee_in_price 严格模式（BUG-01）
  const dF1 = P.computeQuote(Object.assign({}, exwH, { fee_in_price: null }), [mkItem()], [], { discount: 0, other_charges: 0 });
  checkTrue('F01 fee_in_price=null → totals.fee_in_price=null', dF1.totals.fee_in_price === null);
  const dF2 = P.computeQuote(Object.assign({}, exwH, { fee_in_price: undefined }), [mkItem()], [], { discount: 0, other_charges: 0 });
  checkTrue('F02 fee_in_price=undefined → totals.fee_in_price=null', dF2.totals.fee_in_price === null);
  checkTrue('F03 未知模式 → ready=false（含阻断）', dF1.ready === false && dF1.warnings.some((w) => /手续费模式/.test(w)));
  checkTrue('F04 未知模式 → 不生成正式建议价', dF1.items[0].suggested_price === null && dF2.items[0].suggested_price === null);
  const dF5 = P.computeQuote(Object.assign({}, exwH, { fee_in_price: '1' }), [mkItem()], [], { discount: 0, other_charges: 0 });
  checkTrue("F05 非法类型 fee_in_price='1'（字符串）→ 未知态阻断", dF5.totals.fee_in_price === null && dF5.ready === false);
  // 润成兼容适配：调用方显式传 1 → 与 V3 含费行为一致（F05 兼容回归）
  const dF5b = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 });
  check('F05b 润成适配（显式 1）→ 建议价 21.87 与 V3 一致', dF5b.items[0].suggested_price, 21.87, 0.001);
  // 历史成交价不因未知模式改变
  const dF5c = P.computeQuote(Object.assign({}, exwH, { fee_in_price: null }), [mkItem({ final_price: 18 })], [], { discount: 0, other_charges: 0 });
  check('F05c 未知模式下历史成交价 18 不变', dF5c.items[0].used_price, 18, 1e-9);

  // F06-F12 人工分摊 sort 合法性（BUG-02）
  const rows2 = [mkItem(), mkItem({ sort: 1, qty: 2 })];
  const dF6 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 99, amountCny: 100 }] } });
  checkTrue('F06 sort=99 不存在 → pending 阻断', dF6.ready === false && dF6.warnings.some((w) => /分摊/.test(w)));
  const dF7 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 0, amountCny: 60 }, { sort: 0, amountCny: 40 }] } });
  checkTrue('F07 重复 sort=0 → pending 阻断', dF7.ready === false);
  const dF8 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ amountCny: 100 }] } });
  checkTrue('F08 缺少 sort → pending 阻断', dF8.ready === false);
  const dF9 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 'a', amountCny: 100 }] } });
  checkTrue("F09 非法 sort='a' → pending 阻断", dF9.ready === false);
  const dF10 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 0, amountCny: 100 }] } });
  checkTrue('F10 分摊行少于产品行（漏 sort=1）→ pending 阻断', dF10.ready === false);
  const dF11 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 0, amountCny: 40 }, { sort: 1, amountCny: 61 }] } });
  checkTrue('F11 合计 101≠100 → pending 阻断', dF11.ready === false);
  const dF12 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 0, amountCny: 40 }, { sort: 1, amountCny: 60 }] } });
  check('F12 合法 [40,60] → 行成本 140/130、ready 保持', dF12.items[0].cost_total_cny, 140, 1e-9);
  checkTrue('F12b 合法人工分摊 ready=true', dF12.ready === true);
  check('F12c 行2 成本 130', dF12.items[1].cost_total_cny, 130, 1e-9);

  // F13-F18 packing 费用分摊（BUG-03）
  const mixedRows = [mkItem(), mkItem({ sort: 1, qty: 2, unit: 'm' })];
  const packFr = [{ item: 'packing', amount: 90, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }];
  const dF13 = P.computeQuote(exwH, [mkItem()], packFr, { discount: 0, other_charges: 0 });
  check('F13 同单位自动摊：成本 100+90=190', dF13.items[0].cost_total_cny, 190, 1e-9);
  checkTrue('F13b 同单位自动摊 ready=true', dF13.ready === true);
  const dF14 = P.computeQuote(exwH, mixedRows, packFr, { discount: 0, other_charges: 0 });
  checkTrue('F14 混合单位（set+m）自动摊 → 阻断', dF14.ready === false);
  const dF15 = P.computeQuote(exwH, mixedRows, packFr, { discount: 0, other_charges: 0 }, {}, { packingFeeAllocations: [{ sort: 0, amountCny: 30 }, { sort: 1, amountCny: 60 }] });
  check('F15 混合单位人工分摊：行1=130 行2=130', dF15.items[0].cost_total_cny, 130, 1e-9);
  check('F15b 行2 成本 130', dF15.items[1].cost_total_cny, 130, 1e-9);
  checkTrue('F15c 混合单位人工分摊完成 ready=true', dF15.ready === true);
  const dF16 = P.computeQuote(exwH, mixedRows, packFr, { discount: 0, other_charges: 0 }, {}, { packingFeeAllocations: [{ sort: 0, amountCny: 30 }, { sort: 1, amountCny: 61 }] });
  checkTrue('F16 人工分摊总额 91≠90 → 阻断', dF16.ready === false);
  const dF17 = P.computeQuote(exwH, mixedRows, packFr, { discount: 0, other_charges: 0 }, {}, { packingFeeAllocations: [{ sort: 0, amountCny: 30 }, { sort: 1, amountCny: 60.5 }] });
  checkTrue('F17 三位小数金额 → 阻断', dF17.ready === false);
  // 守恒：同单位三行 100→[33.34,33.33,33.33]，每件成本合计摊入总额=90
  const dF18 = P.computeQuote(exwH, [mkItem({ qty: 1 }), mkItem({ sort: 1, qty: 1 }), mkItem({ sort: 2, qty: 1 })], packFr, { discount: 0, other_charges: 0 });
  const sumAlloc = (dF18.items[0].cost_total_cny - 100) + (dF18.items[1].cost_total_cny - 100) + (dF18.items[2].cost_total_cny - 100);
  check('F18 三行同单位分摊守恒（摊入合计=90）', sumAlloc, 90, 1e-9);

  // F19-F24 非法费用输入（BUG-04）
  const dF19 = P.computeQuote(exwH, [mkItem()], [], { discount: NaN, other_charges: 0 });
  checkTrue('F19 discount=NaN → 阻断', dF19.ready === false && dF19.totals.final_total === null);
  const dF20 = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: Infinity });
  checkTrue('F20 other_charges=Infinity → 阻断', dF20.ready === false);
  const dF21 = P.computeQuote(exwH, [mkItem()], [], { discount: -5, other_charges: 0 });
  checkTrue('F21 discount=-5 → 阻断', dF21.ready === false);
  const dF22 = P.computeQuote(exwH, [mkItem()], [], { discount: 10.555, other_charges: 0 });
  checkTrue('F22 discount=10.555（三位小数）→ 阻断', dF22.ready === false);
  const dF23 = P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: NaN, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkTrue('F23 packing 金额 NaN → 阻断（不静默跳过）', dF23.ready === false);
  const dF24 = P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: 90, currency: 'EUR', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkTrue('F24 packing 币种 EUR → 阻断', dF24.ready === false);
  // 明确数字 0 代表零费用（合法）
  const dF24b = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 });
  checkTrue('F24b 明确 0 折扣 → 合法不阻断', dF24b.warnings.every((w) => !/折扣金额非法/.test(w)));

  // F25-F31 USD 采购换算与非法采购价（BUG-05）
  const dF25 = P.computeQuote(exwH, [mkItem({ purchase_price: 15, purchase_currency: 'USD', purchase_units_per_sale: 1, unit_conversion_confirmed: 1, cost_factory: null })], [], { discount: 0, other_charges: 0 });
  check('F25 采购 15 USD → 出厂成本 99', dF25.items[0].cost_factory, 99, 1e-9);
  check('F25b 成本总额 99', dF25.items[0].cost_total_cny, 99, 1e-9);
  check('F25c 成本折美元 15', dF25.items[0].cost_usd, 15, 0.001);
  checkTrue('F25d 成本已确认 + 其他条件满足 → ready=true（不因原始 cost_factory=null 误判）', dF25.ready === true);
  const dF26 = P.computeQuote(exwH, [mkItem({ purchase_price: NaN, final_price: 21.5 })], [], { discount: 0, other_charges: 0 });
  checkTrue('F26 purchase_price=NaN → 阻断、ready=false', dF26.ready === false);
  checkTrue('F26b NaN 未进入建议价（有效 cost_factory 100 兜底建议价 21.87，数值有限）', Number.isFinite(dF26.items[0].suggested_price) && dF26.items[0].suggested_price === 21.87);
  const dF27 = P.computeQuote(exwH, [mkItem({ purchase_price: -15, purchase_currency: 'USD' })], [], { discount: 0, other_charges: 0 });
  checkTrue('F27 采购价 -15 → 阻断', dF27.ready === false);
  const dF28 = P.computeQuote(exwH, [mkItem({ purchase_price: Infinity, purchase_currency: 'USD' })], [], { discount: 0, other_charges: 0 });
  checkTrue('F28 采购价 Infinity → 阻断', dF28.ready === false);
  const dF29 = P.computeQuote(exwH, [mkItem({ purchase_price: 15, purchase_currency: 'EUR' })], [], { discount: 0, other_charges: 0 });
  checkTrue('F29 采购币种 EUR → 阻断', dF29.ready === false);
  const dF30 = P.computeQuote(Object.assign({}, exwH, { fx: NaN }), [mkItem({ purchase_price: 15, purchase_currency: 'USD', cost_factory: null })], [], { discount: 0, other_charges: 0 });
  checkTrue('F30 USD 采购 + 汇率无效 → 阻断', dF30.ready === false && dF30.items[0].cost_usd === null);
  const dF31 = P.computeQuote(exwH, [mkItem({ purchase_price: null, cost_factory: null })], [], { discount: 0, other_charges: 0 });
  checkTrue('F31 采购缺失 + cost_factory=null → 阻断', dF31.ready === false);
  // 最终成本必须有限非负；cost_confirmed 未确认不能 ready
  const dF31b = P.computeQuote(exwH, [mkItem({ purchase_price: NaN, cost_factory: 100 })], [], { discount: 0, other_charges: 0 });
  checkTrue('F31b NaN 未进入成本链（成本取有效 cost_factory=100，数值有限；采购非法已阻断）', Number.isFinite(dF31b.items[0].cost_total_cny) && dF31b.ready === false);
  const dF32 = P.computeQuote(exwH, [mkItem({ cost_confirmed: 0, final_price: 21.5 })], [], { discount: 0, other_charges: 0 });
  checkTrue('F32 成本未确认 → ready=false', dF32.ready === false);

  // F33-F35 非法数据不得 ready、不得生成正式建议价
  const dF33 = P.computeQuote(exwH, [mkItem({ qty: Infinity })], [], { discount: 0, other_charges: 0 });
  checkTrue('F33 qty=Infinity → 阻断', dF33.ready === false);
  const dF34 = P.computeQuote(exwH, [mkItem({ cost_packing: null })], [], { discount: 0, other_charges: 0 });
  checkTrue('F34 cost_packing=null（未填）→ 阻断', dF34.ready === false);
  const dF35 = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: NaN, allocations: null } });
  checkTrue('F35 fee 金额 NaN → pending 阻断（不得当 0→none 静默通过）', dF35.ready === false);

  // F36-F40 多费用分摊守恒与防重复计入
  // F36 修复（P1-A-FIX-02）：此前只创建 dF36 未做任何断言——现补齐有效 PASS/FAIL 断言：
  // 场景=只传 opts.fee（已完成人工分摊）+ 无效残留的 packingFeeAllocations（无 packing 运费行）
  // → packingFeeAllocations 必须不生效（防误用），fee 正常摊入。
  const dF36 = P.computeQuote(exwH, rows2, [], { discount: 0, other_charges: 0 }, {}, {
    fee: { amountCny: 50, allocations: [{ sort: 0, amountCny: 20 }, { sort: 1, amountCny: 30 }] },
    packingFeeAllocations: [{ sort: 0, amountCny: 40 }, { sort: 1, amountCny: 50 }],
  });
  check('F36a 无 packing 费用时 packingFeeAllocations 不生效：行1=100+20=120', dF36.items[0].cost_total_cny, 120, 1e-9);
  check('F36b 行2=100+30/2=115', dF36.items[1].cost_total_cny, 115, 1e-9);
  checkTrue('F36c fee 已完成人工分摊且无 packing 费用 → ready=true', dF36.ready === true);
  checkTrue('F36d 摊入守恒：仅 fee 50 摊入（(120-100)×1+(115-100)×2=50）', Math.abs(((dF36.items[0].cost_total_cny - 100) * 1 + (dF36.items[1].cost_total_cny - 100) * 2) - 50) < 1e-9);
  const packFr2 = [{ item: 'packing', amount: 90, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }];
  const dF37 = P.computeQuote(exwH, rows2, packFr2, { discount: 0, other_charges: 0 }, {}, {
    fee: { amountCny: 50, allocations: [{ sort: 0, amountCny: 20 }, { sort: 1, amountCny: 30 }] },
    packingFeeAllocations: [{ sort: 0, amountCny: 40 }, { sort: 1, amountCny: 50 }],
  });
  // 行1: 每件 100+20(fee)+40(packing)=160；行2: 每件 100+30/2+50/2=140（qty=2，行总额 280）
  check('F37 双费用人工分摊：行1 每件=160', dF37.items[0].cost_total_cny, 160, 1e-9);
  check('F37b 行2 每件=140（qty=2）', dF37.items[1].cost_total_cny, 140, 1e-9);
  checkTrue('F37c 分摊守恒：摊入合计 (160-100)×1+(140-100)×2=140 = fee50+packing90，无重复计入', dF37.ready === true && Math.abs(((dF37.items[0].cost_total_cny - 100) * 1 + (dF37.items[1].cost_total_cny - 100) * 2) - 140) < 1e-9);
  // 防双计：packing 向客户收取 → 利润输入运费不含该行；摊入成本只一次
  const dF38 = P.computeQuote(exwH, [mkItem({ final_price: 30 })], packFr2, { discount: 0, other_charges: 0 });
  const expectProfit = 30 * 1 - (190 / 6.6) - 0 - 0 - 30 * 0.03; // 手续费 3% 从利润扣
  check('F38 防双计：利润=售价-成本(含摊入)-手续费', dF38.totals.order_profit, Number(P.r4(expectProfit).toFixed(2)), 0.02);
  // 同单位 auto 与人工等价性：auto 结果可通过人工复现（守恒）
  const dF39 = P.computeQuote(exwH, rows2, packFr2, { discount: 0, other_charges: 0 }, {}, { packingFeeAllocations: P.allocateByQty(rows2, 90) });
  const dF39b = P.computeQuote(exwH, rows2, packFr2, { discount: 0, other_charges: 0 });
  checkTrue('F39 人工复现 auto 分摊 → 与自动结果一致', JSON.stringify(dF39.items.map((x) => x.cost_total_cny)) === JSON.stringify(dF39b.items.map((x) => x.cost_total_cny)));
  // fee 与 packing 双费用 pending：任一未完成分摊 → 整单不给正式建议价
  const dF40 = P.computeQuote(exwH, rows2, packFr2, { discount: 0, other_charges: 0 }, {}, {
    fee: { amountCny: 50, allocations: null },
  });
  checkTrue('F40 fee 待分摊（packing 已完成）→ 阻断', dF40.ready === false);

  /* ---------- G 段：P1-A-FIX-02 专项回归（BUG-06～09，三环境执行） ---------- */

  // G1-G7 BUG-06：手续费模式辅助函数严格校验（仅数值 0/1 合法；fee 参数拒绝非法值静默转 0）
  checkTrue('G1a marginFromMarkupForMode mode=null → null', P.marginFromMarkupForMode(0.4, 0.03, null) === null);
  checkTrue('G1b mode=undefined → null', P.marginFromMarkupForMode(0.4, 0.03, undefined) === null);
  checkTrue("G2a mode='1'（字符串）→ null", P.marginFromMarkupForMode(0.4, 0.03, '1') === null);
  checkTrue("G2b mode='0'（字符串）→ null", P.marginFromMarkupForMode(0.4, 0.03, '0') === null);
  checkTrue('G3a mode=true → null', P.marginFromMarkupForMode(0.4, 0.03, true) === null);
  checkTrue('G3b mode=false → null', P.marginFromMarkupForMode(0.4, 0.03, false) === null);
  checkTrue('G3c mode=2 → null', P.marginFromMarkupForMode(0.4, 0.03, 2) === null);
  checkTrue('G4a fee=NaN → null（不得静默转 0）', P.marginFromMarkupForMode(0.4, NaN, 1) === null);
  checkTrue('G4b fee=Infinity → null', P.marginFromMarkupForMode(0.4, Infinity, 1) === null);
  checkTrue('G4c fee=-0.03（负数）→ null', P.marginFromMarkupForMode(0.4, -0.03, 1) === null);
  checkTrue('G4d fee=1（非法比例）→ null', P.marginFromMarkupForMode(0.4, 1, 1) === null);
  checkTrue("G4e fee='0.03'（字符串）→ null", P.marginFromMarkupForMode(0.4, '0.03', 1) === null);
  checkTrue('G4f fee=null → null', P.marginFromMarkupForMode(0.4, null, 1) === null);
  check('G5a 合法 mode1 回归：仍=27.71%', P.marginFromMarkupForMode(0.4, 0.03, 1), 0.2771428571, 0.0001);
  check('G5b 合法 mode0 回归：仍=28.57%', P.marginFromMarkupForMode(0.4, 0.03, 0), 0.2857142857, 0.0001);
  check('G5c fee=0（明确零费率）合法 → 0.4/1.4', P.marginFromMarkupForMode(0.4, 0, 1), 0.4 / 1.4, 1e-9);
  checkTrue("G6a markupFromMarginForMode mode='0' → null", P.markupFromMarginForMode(0.2857, 0.03, '0') === null);
  checkTrue('G6b markupFromMarginForMode fee=NaN → null', P.markupFromMarginForMode(0.2857, NaN, 0) === null);
  checkTrue('G6c markupFromMarginForMode fee=Infinity → null', P.markupFromMarginForMode(0.2857, Infinity, 1) === null);
  check('G6d markupFromMarginForMode 合法 mode0 回归：还原 0.4', P.markupFromMarginForMode(0.2857142857, 0.03, 0), 0.4, 0.0001);
  checkTrue("G7a afterFeeMarginFromMode mode=true → null", P.afterFeeMarginFromMode(0.2771, 0.03, true) === null);
  checkTrue('G7b afterFeeMarginFromMode fee=-0.03 → null', P.afterFeeMarginFromMode(0.2771, -0.03, 1) === null);
  checkTrue('G7c afterFeeMarginFromMode mode=null → null', P.afterFeeMarginFromMode(0.2771, 0.03, null) === null);
  check('G7d afterFeeMarginFromMode 合法 mode1 回归：=target_margin', P.afterFeeMarginFromMode(0.2771428571, 0.03, 1), 0.2771428571, 1e-9);
  check('G7e afterFeeMarginFromMode 合法 mode0 回归：=m-fee', P.afterFeeMarginFromMode(0.2857142857, 0.03, 0), 0.2557142857, 1e-9);

  // G8-G14 BUG-07：分摊原始金额精度校验（r2 舍入之前检查；0=明确零费用）
  const rowsG = [{ sort: 0, qty: 10, unit: 'set' }, { sort: 1, qty: 10, unit: 'set' }, { sort: 2, qty: 10, unit: 'set' }];
  checkTrue('G8a 原始金额 1.234（三位小数）→ 拒绝', P.allocateByQty(rowsG, 1.234) === null);
  checkTrue('G8b 原始金额 100.001（三位小数）→ 拒绝', P.allocateByQty(rowsG, 100.001) === null);
  checkTrue('G8c 原始金额 0.004（舍入后为 0）→ 拒绝，不得转成零费用', P.allocateByQty(rowsG, 0.004) === null);
  checkEq('G9 明确输入 0 → 按零费用处理（各行摊入 0）', P.allocateByQty(rowsG, 0), [
    { sort: 0, amountCny: 0 }, { sort: 1, amountCny: 0 }, { sort: 2, amountCny: 0 },
  ]);
  const aG10 = P.allocateByQty(rowsG, 100.00);
  checkEq('G10 合法 100.00 → 正常分摊（差额归末行）', aG10, [
    { sort: 0, amountCny: 33.33 }, { sort: 1, amountCny: 33.33 }, { sort: 2, amountCny: 33.34 },
  ]);
  checkTrue('G10b 自动分摊总额严格守恒（Σ=100.00）', Math.abs(aG10.reduce((s, r) => s + r.amountCny, 0) - 100) < 1e-9);
  checkTrue('G11a 人工分摊原始金额 1.234 → 拒绝', P.validateManualAllocation([{ sort: 0, amountCny: 1.23 }], 1.234).ok === false);
  checkTrue('G11b 人工分摊原始金额 0.004 → 拒绝', P.validateManualAllocation([{ sort: 0, amountCny: 0 }], 0.004).ok === false);
  checkTrue('G11c 人工分摊原始金额 -0.004（舍入后为 0）→ 拒绝', P.validateManualAllocation([{ sort: 0, amountCny: 0 }], -0.004).ok === false);
  checkTrue('G11d 明确输入 0 → 人工零费用分摊合法', P.validateManualAllocation([{ sort: 0, amountCny: 0 }, { sort: 1, amountCny: 0 }], 0).ok === true);
  checkTrue('G12 人工分摊合法 100.00 → 正常通过', P.validateManualAllocation([{ sort: 0, amountCny: 60 }, { sort: 1, amountCny: 40 }], 100.00).ok === true);
  const vG13 = P.validateManualAllocationFor(rowsG, [{ sort: 0, amountCny: 33.33 }, { sort: 1, amountCny: 33.33 }, { sort: 2, amountCny: 33.34 }], 100.00);
  checkTrue('G13 validateManualAllocationFor 合法 100.00 通过且守恒（Σ=100）', vG13.ok === true && Math.abs(vG13.sum - 100) < 1e-9);
  checkEq('G14a status：原始金额 1.234 → pending（不得 ready）', P.allocationStatus(rowsG, { amountCny: 1.234, allocations: [{ sort: 0, amountCny: 1.23 }, { sort: 1, amountCny: 0 }, { sort: 2, amountCny: 0 }] }), 'pending');
  checkEq('G14b status：原始金额 0.004 → pending（不得当零费用 none）', P.allocationStatus(rowsG, { amountCny: 0.004 }), 'pending');
  checkTrue('G14c status：原始金额 -0.004 → pending', P.allocationStatus(rowsG, { amountCny: -0.004 }) === 'pending');
  checkEq('G14d status：明确 0 → none（零费用）', P.allocationStatus(rowsG, { amountCny: 0 }), 'none');

  // G15-G19 BUG-08：产品原始明细 sort 唯一性校验（auto/manual 双拦截 + 防双倍摊入）
  const dupRowsG = [{ sort: 0, qty: 1, unit: 'set' }, { sort: 0, qty: 1, unit: 'set' }];
  checkTrue('G15a 原始明细 sort 重复 → allocateByQty 拒绝自动分摊', P.allocateByQty(dupRowsG, 100) === null);
  checkEq('G15b 原始明细 sort 重复 → status pending', P.allocationStatus(dupRowsG, { amountCny: 100, allocations: [{ sort: 0, amountCny: 100 }] }), 'pending');
  checkTrue('G15c 原始明细 sort 重复 → 人工分摊不得通过', P.validateManualAllocationFor(dupRowsG, [{ sort: 0, amountCny: 100 }], 100).ok === false);
  const noSortG = [{ qty: 1, unit: 'set' }, { sort: 1, qty: 1, unit: 'set' }];
  checkTrue('G16a 原始明细缺失 sort → allocateByQty 拒绝', P.allocateByQty(noSortG, 100) === null);
  checkTrue('G16b 原始明细缺失 sort → status pending', P.allocationStatus(noSortG, { amountCny: 100, allocations: null }) === 'pending');
  checkTrue("G17 原始明细 sort='a'（非法）→ allocateByQty 拒绝", P.allocateByQty([{ sort: 'a', qty: 1, unit: 'set' }], 100) === null);
  // 特别测试：两条产品行 sort 均为 0、原始费用 100 → 不得分别摊入两行造成实际摊入 200
  const dG18 = P.computeQuote(exwH, [mkItem(), mkItem({ name_en: 'A2' })], [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 0, amountCny: 100 }] } });
  checkTrue('G18a 两行 sort 同为 0 + fee 100 → 阻断（ready=false）', dG18.ready === false);
  checkTrue('G18b 不给正式建议价（两行 suggested=null）', dG18.items[0].suggested_price === null && dG18.items[1].suggested_price === null);
  checkTrue('G18c 不得双倍摊入：两行成本仍各 100（实际摊入合计 0，非 200）', dG18.items[0].cost_total_cny === 100 && dG18.items[1].cost_total_cny === 100);
  const dG19 = P.computeQuote(exwH, [Object.assign({}, mkItem(), { sort: undefined })], [], { discount: 0, other_charges: 0 }, {}, { fee: { amountCny: 100, allocations: [{ sort: 0, amountCny: 100 }] } });
  checkTrue('G19 明细缺失 sort + fee → pending 阻断', dG19.ready === false && dG19.items[0].suggested_price === null);

  // G20-G28 BUG-09：费用缺失与零值语义核查（明确数字 0 才是零费用；无 `|| 0` 静默）
  checkTrue('G20a extra.discount=null → 阻断', P.computeQuote(exwH, [mkItem()], [], { discount: null, other_charges: 0 }).ready === false);
  checkTrue('G20b extra.discount 缺失（undefined）→ 阻断', P.computeQuote(exwH, [mkItem()], [], { other_charges: 0 }).ready === false);
  checkTrue('G20c extra.other_charges=null → 阻断', P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: null }).ready === false);
  checkTrue('G20d extra 整体缺失 → 阻断（不得静默按 0）', P.computeQuote(exwH, [mkItem()], []).ready === false);
  checkWarn('G21a discount=null 明确提示', P.computeQuote(exwH, [mkItem()], [], { discount: null, other_charges: 0 }).warnings, '折扣金额未填写', true);
  checkWarn('G21b other_charges=null 明确提示', P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: null }).warnings, '其他费用金额未填写', true);
  checkTrue('G22 明确数字 0 合法：零费用不阻断、无非法提示', (() => {
    const d = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 });
    return d.ready === true && d.warnings.every((w) => !/折扣金额|其他费用金额/.test(w));
  })());
  checkTrue('G23 fee.amountCny 缺失（undefined）→ pending 阻断，不给正式建议价', (() => {
    const d = P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 }, {}, { fee: { allocations: null } });
    return d.ready === false && d.items[0].suggested_price === null;
  })());
  checkTrue('G24 packing 金额缺失（undefined）→ 阻断', P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: undefined, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 }).ready === false);
  checkTrue('G25 packing 金额 -50（负数）→ 阻断', P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: -50, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 }).ready === false);
  checkTrue('G26 freight 金额缺失 → 阻断且运费合计不含 NaN', (() => {
    const d = P.computeQuote(exwH, [mkItem()], [{ item: 'forwarder', amount: undefined, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
    return d.ready === false && Number.isFinite(d.totals.freight_actual_usd);
  })());
  /* G27 预期值更新（P1-A-FIX-03 BUG-10 定案，非润成原始预期，留痕披露）：
     FIX-02 时仅要求总额不含 NaN；BUG-10 明确"非法客户收费运费 → final_total=null"，
     本用例输入（forwarder NaN + charge_customer + confirmed）恰属该定案场景，
     故预期由 Number.isFinite(final_total) 更新为 final_total===null。 */
  checkTrue('G27 freight 金额 NaN + 客户收费 → final_total=null（BUG-10 定案）', (() => {
    const d = P.computeQuote(exwH, [mkItem()], [{ item: 'forwarder', amount: NaN, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
    return d.ready === false && d.totals.final_total === null && Number.isFinite(d.totals.freight_actual_usd);
  })());
  // 历史可选字段例外核查（唯一例外，专门测试）：opts.fee / opts.packingFeeAllocations 整体缺省
  // = 「本单没有该类费用」（合法），与新费用录入的「0=明确零费用」规则不混淆
  checkTrue('G28 例外：opts.fee 整体缺省 → 无一次性费用，不阻断', P.computeQuote(exwH, [mkItem()], [], { discount: 0, other_charges: 0 }).ready === true);
  checkTrue('G28b 例外：opts.packingFeeAllocations 缺省 + 同单位 → 自动分摊不阻断', P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: 90, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 }).ready === true);

  /* ---------- H 段：P1-A-FIX-03 专项回归（BUG-10，三环境执行） ---------- */

  // H1 负数运费（任务书 §四.1）：拒绝，不进入任何合计
  const dH1 = P.computeQuote(exwH, [mkItem()], [{ item: 'forwarder', amount: -100, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkWarn('H1a -100 CNY → 明确 blocker', dH1.warnings, '运费须为非负', true);
  checkTrue('H1b 不进入实际运费合计（freightUsd=0，非负数）', dH1.totals.freight_actual_usd === 0);
  checkTrue('H1c 不进入客户收费（freight_charged=null，不参与 quotedFreight）', dH1.totals.freight_charged_usd === null);
  checkTrue('H1d 非法客户收费 → final_total=null', dH1.totals.final_total === null);
  checkTrue('H1e order_profit=null（非法运费不得算出利润）', dH1.totals.order_profit === null);
  checkTrue('H1f ready=false', dH1.ready === false);

  // H2 EUR 等非法币种（§四.2）：拒绝，不得当作 CNY 折算
  const dH2 = P.computeQuote(exwH, [mkItem()], [{ item: 'forwarder', amount: 100, currency: 'EUR', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkWarn('H2a 100 EUR → 明确 blocker', dH2.warnings, '运费须为非负', true);
  checkTrue('H2b 不得按 CNY 折算（freightUsd=0，非 100/6.6≈15.15）', dH2.totals.freight_actual_usd === 0);
  checkTrue('H2c final_total=null', dH2.totals.final_total === null);
  checkTrue('H2d order_profit=null', dH2.totals.order_profit === null);
  checkTrue('H2e ready=false', dH2.ready === false);

  // H3 三位小数运费（§四.3）：拒绝，不进入合计
  const dH3 = P.computeQuote(exwH, [mkItem()], [{ item: 'forwarder', amount: 100.001, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkWarn('H3a 100.001 CNY → 明确 blocker', dH3.warnings, '运费须为非负', true);
  checkTrue('H3b freightUsd=0（不得舍入后进入合计）', dH3.totals.freight_actual_usd === 0);
  checkTrue('H3c final_total=null', dH3.totals.final_total === null);
  checkTrue('H3d order_profit=null', dH3.totals.order_profit === null);
  checkTrue('H3e ready=false', dH3.ready === false);

  // H4 NaN 运费（§四.4）：阻断，不污染财务结果
  const dH4 = P.computeQuote(exwH, [mkItem()], [{ item: 'forwarder', amount: NaN, currency: 'CNY', confirmed: 1, charge_customer: 0, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkWarn('H4a NaN 运费 → 明确 blocker', dH4.warnings, '运费须为非负', true);
  checkTrue('H4b freightUsd=0（有限，无 NaN 污染）', dH4.totals.freight_actual_usd === 0);
  checkTrue('H4c 非法内部运费 → order_profit=null', dH4.totals.order_profit === null);
  checkTrue('H4d ready=false', dH4.ready === false);

  // H5 负数木箱费（§四.5）：阻断，不影响订单利润
  const dH5 = P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: -1, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkTrue('H5a -1 CNY 木箱费 → 金额非法 blocker', dH5.warnings.some((w) => /木箱\/包装费金额非法|运费须为非负/.test(w)));
  checkTrue('H5b suggested_price=null（BUG-10B：pendingAllocation 门不再依赖 packingFeeObj）', dH5.items[0].suggested_price === null);
  checkTrue('H5c order_profit=null', dH5.totals.order_profit === null);
  checkTrue('H5d final_total=null', dH5.totals.final_total === null);
  checkTrue('H5e ready=false', dH5.ready === false);

  // H6 三位小数木箱费（§四.6）：阻断，不得产生正式建议价
  const dH6 = P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: 0.001, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkWarn('H6a 0.001 CNY 木箱费 → 金额非法 blocker', dH6.warnings, '木箱/包装费金额非法', true);
  checkTrue('H6b suggested_price=null', dH6.items[0].suggested_price === null);
  checkTrue('H6c ready=false', dH6.ready === false);

  // H7 非法木箱费币种（§四.7）：阻断，不得生成正式建议价
  const dH7 = P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: 90, currency: 'EUR', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkWarn('H7a EUR 木箱费 → 币种非法 blocker', dH7.warnings, '币种非法', true);
  checkTrue('H7b suggested_price=null', dH7.items[0].suggested_price === null);
  checkTrue('H7c 不得当作 CNY 折算（freightUsd=0）', dH7.totals.freight_actual_usd === 0);
  checkTrue('H7d ready=false', dH7.ready === false);

  // H8 非法内部运费（§四.8）：order_profit=null（charge_customer=0 的已确认非法行）
  const dH8 = P.computeQuote(exwH, [mkItem()], [{ item: 'handling', amount: -5, currency: 'CNY', confirmed: 1, charge_customer: 0, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkTrue('H8a 非法内部运费 → order_profit=null（freightConfirmedAll=false）', dH8.totals.order_profit === null);
  checkTrue('H8b freightUsd=0', dH8.totals.freight_actual_usd === 0);
  checkTrue('H8c ready=false', dH8.ready === false);

  // H9 非法客户收费运费（§四.9）：final_total=null（ inland 负数场景）
  const dH9 = P.computeQuote(exwH, [mkItem()], [{ item: 'inland', amount: -5, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkTrue('H9a final_total=null（客户应付不显示完整有效金额）', dH9.totals.final_total === null);
  checkTrue('H9b freight_charged=null', dH9.totals.freight_charged_usd === null);
  checkTrue('H9c ready=false', dH9.ready === false);

  // H10 明确 0 CNY（§四.10）：正常通过零费用校验
  const dH10 = P.computeQuote(exwH, [mkItem()], [{ item: 'inland', amount: 0, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkTrue('H10a 0 CNY 无运费 blocker', dH10.warnings.every((w) => !/运费须为非负/.test(w)));
  checkTrue('H10b ready=true（零费用合法）', dH10.ready === true);
  checkTrue('H10c final_total 有限', Number.isFinite(dH10.totals.final_total));

  // H11 明确 0 USD（§四.11）：正常通过零费用校验
  const dH11 = P.computeQuote(exwH, [mkItem()], [{ item: 'forwarder', amount: 0, currency: 'USD', confirmed: 1, charge_customer: 0, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  checkTrue('H11a 0 USD 无运费 blocker', dH11.warnings.every((w) => !/运费须为非负/.test(w)));
  checkTrue('H11b ready=true', dH11.ready === true);
  checkTrue('H11c freight_actual_usd=0（有限）', dH11.totals.freight_actual_usd === 0);

  // H12 正常 CNY/USD 运费（§四.12）：原有计算结果不变
  const dH12 = P.computeQuote(exwH, [mkItem({ final_price: 21.22 })], [{ item: 'inland', amount: 500, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  check('H12a 正常 CNY 运费 500÷6.6 → 客户收费 75.76', dH12.totals.freight_charged_usd, 75.76, 0.01);
  check('H12b 实际运费折美元 75.76', dH12.totals.freight_actual_usd, 75.76, 0.01);
  checkTrue('H12c ready=true', dH12.ready === true);
  const dH12b = P.computeQuote(exwH, [mkItem({ final_price: 21.22 })], [{ item: 'forwarder', amount: 300, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  check('H12d 正常 USD 运费 300 → 客户收费 300', dH12b.totals.freight_charged_usd, 300, 0.01);
  checkTrue('H12e ready=true', dH12b.ready === true);
  // BUG-10B 回归：合法 packing 仍正常自动分摊（不因新门误伤）
  const dH12c = P.computeQuote(exwH, [mkItem()], [{ item: 'packing', amount: 90, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
  check('H12f 合法 packing 自动摊：成本 190', dH12c.items[0].cost_total_cny, 190, 1e-9);
  checkTrue('H12g 合法 packing ready=true（suggested_price 正常生成）', dH12c.ready === true && dH12c.items[0].suggested_price !== null);

  // H13 BUG-11（P1-A-FIX-04）：合法 CNY 客户收费运费 + fx 缺失/无效 → final_total=null（不得静默漏收）
  const noFxH = Object.assign({}, exwH, { fx: null });
  const h13Item = mkItem({ final_price: 100 });
  const cnyCharged = [{ item: 'inland', amount: 500, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }];
  const dH13 = P.computeQuote(noFxH, [h13Item], cnyCharged, { discount: 0, other_charges: 0 });
  checkTrue('H13a CNY 客户收费运费 + fx=null → final_total=null', dH13.totals.final_total === null);
  checkTrue('H13b 同场景 order_profit=null', dH13.totals.order_profit === null);
  checkTrue('H13c 同场景 ready=false', dH13.ready === false);
  checkTrue('H13d USD 客户收费运费不因缺汇率丢失美元金额（300 仍计入）', (() => {
    const d = P.computeQuote(noFxH, [mkItem({ final_price: 21.22 })], [{ item: 'forwarder', amount: 300, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
    return d.totals.freight_charged_usd === 300 && Number.isFinite(d.totals.final_total) && d.totals.final_total > 0;
  })());
  checkTrue('H13e 同场景实际运费 freight_actual_usd=300（USD 直接用美元）', (() => {
    const d = P.computeQuote(noFxH, [mkItem({ final_price: 21.22 })], [{ item: 'forwarder', amount: 300, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 });
    return d.totals.freight_actual_usd === 300;
  })());
  // fx=0 / NaN / Infinity 等无效汇率同 CNY 场景 → 同样阻断 final_total
  [0, NaN, Infinity, -6.6].forEach((badFx, bi) => {
    const d = P.computeQuote(Object.assign({}, exwH, { fx: badFx }), [h13Item], cnyCharged, { discount: 0, other_charges: 0 });
    checkTrue('H13f' + 'abcdefg'[bi] + ' fx=' + String(badFx) + ' → final_total=null 且 order_profit=null',
      d.totals.final_total === null && d.totals.order_profit === null && d.ready === false);
  });
  // fx 缺失时 CNY 客户收费不得进入任何合计（freight_charged_usd / freight_actual_usd 均 null/0）
  checkTrue('H13g fx=null CNY 客户收费不进入 freight_charged_usd', dH13.totals.freight_charged_usd === null);
  check('H13h fx=null CNY 客户收费不进入 freight_actual_usd', dH13.totals.freight_actual_usd, 0, 1e-9);
  // CNY 客户收费 fx 缺失 → 手填成交价 100 仍作为 used_price/amount（历史成交价保护）；
  // suggested_price 需 fx 折算成本故为 null，不属于本轮断言对象
  check('H13i fx=null 手填成交价 100 保留不被覆盖（amount=100）', dH13.items[0].amount, 100, 1e-9);
}

/* ---------- 三环境一致性对照 ---------- */
function crossCheck() {
  console.log('\n===== 三环境一致性对照 =====');
  const sample = (P) => {
    const d = P.computeQuote(baseHeader, [item], freight, { discount: 0, other_charges: 0 });
    return {
      a1: d.items[0].cost_total_cny, a2: d.items[0].suggested_price, a3: d.items[0].cost_usd,
      margin: P.marginFromMarkup(0.4, 0.03), alloc: P.allocateByQty([{ sort: 0, qty: 2, unit: 'set' }, { sort: 1, qty: 1, unit: 'set' }], 90),
      status: P.allocationStatus([{ sort: 0, qty: 1, unit: 'set' }], { amountCny: 10, allocations: null }),
      /* P1-A-FIX-02：严格模式/精度/sort 校验也纳入三环境对照 */
      modeNull: P.marginFromMarkupForMode(0.4, 0.03, null),
      modeStr: P.marginFromMarkupForMode(0.4, 0.03, '1'),
      modeFeeNaN: P.marginFromMarkupForMode(0.4, NaN, 1),
      mode0: P.marginFromMarkupForMode(0.4, 0.03, 0),
      rawReject: P.allocateByQty([{ sort: 0, qty: 1, unit: 'set' }], 1.234),
      rawZero: P.allocateByQty([{ sort: 0, qty: 1, unit: 'set' }], 0),
      dupSort: P.allocateByQty([{ sort: 0, qty: 1, unit: 'set' }, { sort: 0, qty: 1, unit: 'set' }], 100),
      statusPrec: P.allocationStatus([{ sort: 0, qty: 1, unit: 'set' }], { amountCny: 0.004 }),
      extraNull: P.computeQuote(baseHeader, [item], freight, { discount: null, other_charges: 0 }).ready,
    };
  };
  const ref = JSON.stringify(sample(P_node));
  let ok = true;
  for (const [tag, P] of IMPLS) {
    const same = JSON.stringify(sample(P)) === ref;
    console.log((same ? 'PASS ' : 'FAIL ') + `环境 [${tag}] 计算结果与基准一致`);
    if (!same) ok = false;
  }
  if (!ok) bad++;
  total++;
  checkTrue('三环境输出逐字节一致', ok);
}

/* ---------- 执行 ---------- */
console.log('P1-A 定价引擎测试 · app/pricing.js');
for (const [tag, P] of IMPLS) runOriginal26(P, tag);
crossCheck();
runBoundary(P_node, 'node-require');
runBoundary(P_vm, 'vm');
runBoundary(P_renderer, 'renderer-global');

console.log(`\n${bad === 0 ? 'ALL PASS' : bad + ' FAIL'} — ${total} checks (26 项原始 x3 环境 + 一致性 + 边界 x3 环境)`);
process.exit(bad ? 1 : 0);
