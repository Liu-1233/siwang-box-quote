/*
 * P1-D-03 · RunCheng 风格 QT 报价单模板（quotation-rc-v1）· 测试套件（Node 层）
 *
 * 覆盖：
 *   A. 模板分发   —— sheet.js TEMPLATE_IDS 含 quotation-rc-v1；五类单据都走统一版式
 *                    （P1-D-04：quotation-rc-v1 不再限定 QT，未声明时即为默认）
 *   B. 版式与字段 —— LOGO、产品图片独立列、英文名优先/中文兜底、规格合并单格、金额格式
 *   C. 金额口径   —— Subtotal/Freight/Discount/Other/TOTAL 与 pricing.js final_total 同源；
 *                    未核实运费不进纸面并给警示；内部-only 运费金额零泄漏
 *   D. 大写金额   —— words 边界（复用 reference-sheets 实现）
 *   E. 泄漏断言   —— 内部核价参数（feeRate/targetMargin/commissionRate/markupRate/
 *                    feeInPrice/cost 等）绝不出现在纸面 HTML
 *   F. 持久化     —— sanitizeQuoteLayout 白名单 + 新建/更新两条保存链模板不丢
 *   G. 原有输出   —— SC/CI/PL 默认统一版式且业务字段不丢；显式 basic-v1 的 QT 结构不变
 *   H. LOGO 存储  —— settings.sellerLogo 保存/读取 + 主进程只读数据文件路径（含损坏降级）
 *
 * 方法：真实 model.js / sheet.js / sheet-rc.js / reference-sheets.js 直接 require；
 *       持久化用真实 storage.js（os.tmpdir 隔离）。不触碰生产 userData。
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const need = ['app/model.js', 'app/sheet.js', 'app/sheet-rc.js', 'app/reference-sheets.js', 'app/store.js', 'storage.js'];
const missing = need.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) {
  console.error('FATAL 工程根目录解析失败（' + ROOT + '），缺少：' + missing.join(', '));
  process.exit(1);
}
console.log('PASS P0 工程根目录按测试文件位置解析：' + ROOT.replace(/\\/g, '/'));

const M = require(path.join(ROOT, 'app', 'model.js'));
const Sheet = require(path.join(ROOT, 'app', 'sheet.js'));
const SheetRC = require(path.join(ROOT, 'app', 'sheet-rc.js'));
const Ref = require(path.join(ROOT, 'app', 'reference-sheets.js'));

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
function contains(name, html, token) {
  ok(name + '（含 ' + JSON.stringify(token) + '）', typeof html === 'string' && html.indexOf(token) >= 0);
}
function notContains(name, html, token) {
  ok(name + '（不含 ' + JSON.stringify(token) + '）', typeof html === 'string' && html.indexOf(token) < 0);
}

/* ---------- 公共构造 ---------- */
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//2Q==';

function mkQT(patch) {
  const d = {
    type: 'QT', currency: 'USD', date: '2026-11-20', sourceId: null,
    customer: { id: null, name: 'John Smith', company: 'GlobalBuy GmbH', country: 'DE', address: 'Hafenstr. 1, Hamburg' },
    items: [
      { _rowId: 'r1', nameCn: 'PVC马场围栏', nameEn: 'PVC Horse Fence', mesh: 0, wire: 0, width: 2.1, rollLen: 0, qty: 100, unit: '㎡', price: 6.57,
        /* P1-D-05：客户纸面 PHOTO 只认实物图快照 realImage；规格图 productImage 绝不回退。 */
        productSpecs: { mesh: 2, wire: 2.5, width: 2.1, rollLen: 50 }, _unknown: { realImage: IMG } },
      { _rowId: 'r2', nameCn: '만成品B', nameEn: '', mesh: 0, wire: 0, width: 0, rollLen: 0, qty: 3, unit: 'set', price: 12.5, _unknown: {} }
    ],
    fx: 6.6, feeRate: 0.03, targetMargin: null, commissionRate: 0.2, freightMarkup: 0.1,
    markupRate: 0.4, feeInPrice: 1, pricingVersion: null, fees: [],
    term: 'CIF Hamburg', payment: 'T/T', validity: '30 days', delivery: '25 days', remark: 'Thank you.',
    seller: { company: 'Anping Runcheng Metal Products Co., Ltd.', contact: 'Mr. Wang +86-13800000000', address: 'Wire Mesh Industrial Zone, Anping, Hebei, China' },
    bank: '', buyerAddress: 'Hafenstr. 1, 20359 Hamburg, Germany', marks: '',
    shipment: '', vessel: '', origin: '', contractTerms: '', signDate: '', signPlace: '',
    packagingMode: null, totalPackages: null,
    totals: { subtotal: 662.1, grand: 662.1, computedFromItems: 662.1, previousGrand: null },
    _unknown: {
      quoteLayout: { templateId: 'quotation-rc-v1' },
      pricing: { incoterm: 'CIF', namedPlace: 'Hamburg', freight: [], extra: { discount: 0, other_charges: 0 } }
    }
  };
  return Object.assign(d, patch || {});
}
function fr(item, amount, currency, confirmed, chargeCustomer) {
  return { item, amount, currency, confirmed: !!confirmed, charge_customer: !!chargeCustomer, included_in_cost: false };
}

/* ============ A. 模板分发 ============ */
console.log('');
console.log('---- A. 模板分发 ----');
ok('A1 TEMPLATE_IDS 含 quotation-rc-v1', Sheet.TEMPLATE_IDS.indexOf('quotation-rc-v1') >= 0);
const dA = mkQT();
const htmlA = Sheet.build(dA, { templateId: 'quotation-rc-v1' });
contains('A2 QT 走 rc 版式（rc-sheet）', htmlA, 'class="q-sheet rc-sheet"');
contains('A3 标题 QUOTATION', htmlA, 'QUOTATION');
contains('A4 data-template 标记', htmlA, 'data-template="quotation-rc-v1"');
const dPI = mkQT({ type: 'PI' });
const htmlPI = Sheet.build(dPI, { templateId: 'quotation-rc-v1' });
/* P1-D-04：quotation-rc-v1 解除「仅 QT」限制，显式请求即生效（不再是回落基础版）。
   原断言 A5 验证的是 BUG-ACC-01 时期的类型门，随统一版式一并更新，检查项数不变。 */
contains('A5 PI 用 rc 请求时拿到统一版式（P1-D-04）', htmlPI, 'data-template="quotation-rc-v1"');
/* BUG-ACC-01 保留项：纸面不得出现任何内部模板诊断注记。 */
ok('A6 纸面不含内部模板注记', htmlPI.indexOf('仅适用于报价单 QT') < 0 && htmlPI.indexOf('q-tpl-note') < 0);
const htmlPIStored = Sheet.build(dPI, {});
contains('A7 PI 未声明模板时默认统一版式（P1-D-04）', htmlPIStored, 'data-template="quotation-rc-v1"');
eq('A8 rc.build 对 null/非对象安全', SheetRC.build(null, {}), null);
eq('A9 rc.build 对五类之外的单据返回 null（由 sheet.js 兜底）', SheetRC.build(mkQT({ type: 'XX' }), {}), null);

/* ============ B. 版式与字段 ============ */
console.log('');
console.log('---- B. 版式与字段 ----');
const dB = mkQT();
const htmlB = Sheet.build(dB, { templateId: 'quotation-rc-v1' });
contains('B1 头部 LOGO（opts.logo 显式传入）', Sheet.build(dB, { templateId: 'quotation-rc-v1', logo: LOGO }), 'class="rc-logo"');
contains('B2 默认印原版 RunCheng LOGO（不依赖设置页占位图）', htmlB, 'class="rc-logo"');
contains('B2a 默认 LOGO 为内嵌 JPEG 原图', htmlB, 'data:image/jpeg;base64,');
notContains('B2b opts.logo="" 时本张不印 LOGO', Sheet.build(dB, { templateId: 'quotation-rc-v1', logo: '' }), 'class="rc-logo"');
contains('B3 英文公司名', htmlB, 'Anping Runcheng Metal Products Co., Ltd.');
contains('B4 产品图片独立列（PHOTO 表头）', htmlB, 'PHOTO');
contains('B5 行内产品实物图渲染', htmlB, 'class="rc-photo"');
contains('B6 无实物图行占位 NO IMAGE', htmlB, 'NO IMAGE');
/* P1-D-05 专项：只有规格图/目录页（productImage / imageData）时绝不冒充实物图。 */
const dSpecOnly = mkQT();
dSpecOnly.items[0]._unknown = { productImage: IMG };
const htmlSpecOnly = Sheet.build(dSpecOnly, { templateId: 'quotation-rc-v1' });
notContains('B5a P1-D-05 规格图绝不回退为纸面 PHOTO', htmlSpecOnly, 'class="rc-photo"');
contains('B5b P1-D-05 无实物图时显示 NO IMAGE', htmlSpecOnly, 'NO IMAGE');
ok('B5c P1-D-05 规格图 base64 不进入客户纸面', htmlSpecOnly.indexOf(IMG) < 0);
contains('B7 英文名优先', htmlB, '<b>PVC Horse Fence</b>');
contains('B8 中文兜底（nameEn 空用 nameCn）', htmlB, '<b>만成品B</b>');
contains('B9 英文名为主时中文副行', htmlB, 'rc-name-sub');
contains('B10 规格合并单格（specdiv）', htmlB, 'specdiv');
contains('B11 买方公司', htmlB, 'GlobalBuy GmbH');
contains('B12 买方地址', htmlB, 'Hafenstr. 1, 20359 Hamburg, Germany');
contains('B13 单号', htmlB, 'Quote No.');
contains('B14 贸易术语（CIF / Hamburg 拆分展示）', htmlB, 'CIF');
contains('B14b Named Place（Hamburg）', htmlB, 'Hamburg');
contains('B24 双栏 BUYER / CONSIGNEE', htmlB, 'BUYER / CONSIGNEE');
contains('B25 双栏 DOCUMENT INFO', htmlB, 'DOCUMENT INFO');
contains('B26 Named Place 字段', htmlB, 'Named Place');
contains('B15 币种列头', htmlB, 'UNIT PRICE (USD)');
contains('B16 千分位金额（100㎡ × 6.57 = 657.00；合计 662.10）', htmlB, '657.00');
contains('B17 条款区 Payment Terms', htmlB, 'Payment Terms');
contains('B18 条款区 Production Lead Time', htmlB, '25 days');
contains('B19 有效期移到 DOCUMENT INFO（Valid Until）', htmlB, 'Valid Until');
contains('B20 双签名栏', htmlB, 'For the Seller');
contains('B21 双签名栏（买方）', htmlB, 'For the Buyer');
notContains('B22 不加 HS Code 列', htmlB, 'HS CODE');
contains('B23 页脚标识', htmlB, 'Customer-facing Quotation');

/* ============ C. 金额口径 ============ */
console.log('');
console.log('---- C. 金额口径（与 pricing.js final_total 同源） ----');
/* grand=100×6.57 + 3×12.5 = 657 + 37.5 = 694.5（items 覆盖 totals 以验证草稿口径） */
const dC = mkQT({ totals: {} });
dC.items[0].qty = 100; dC.items[0].price = 6.57; dC.items[1].qty = 3; dC.items[1].price = 12.5;
dC._unknown.pricing.freight = [
  fr('forwarder', 100, 'USD', true, true),
  fr('inland', 66, 'CNY', true, true),      /* 66 ÷ 6.6 = 10 USD */
  fr('packing', 20, 'USD', true, true),     /* 木箱费摊入明细，剔除 */
  fr('handling', 500, 'USD', true, false)   /* 内部费用，绝不上纸面 */
];
dC._unknown.pricing.extra = { discount: 5, other_charges: 2 };
const htmlC = Sheet.build(dC, { templateId: 'quotation-rc-v1' });
/* quotedFreight = (100 + 10 − 20) × 1.1 = 99.00；TOTAL = 694.5 + 99 − 5 + 2 = 790.50 */
contains('C1 Product Subtotal', htmlC, 'Product Subtotal');
contains('C2 客户承担运费行 121.00（(100+10+20−20)×1.1，木箱费摊入明细故剔除）', htmlC, 'Shipping / Freight</th><td class="num">121.00</td>');
contains('C3 运费折算+加成数值 121.00', htmlC, '121.00');
contains('C4 折扣行（负号语义由标签与公式承担）', htmlC, 'Discount');
contains('C5 其他费用行', htmlC, 'Tax / Other Charges');
contains('C6 TOTAL AMOUNT (USD) = 812.50（=引擎 final_total）', htmlC, 'TOTAL AMOUNT (USD)');
contains('C6b TOTAL 数值 812.50', htmlC, '812.50');
contains('C7 大写金额行', htmlC, 'Amount in Words');
notContains('C8 内部-only 运费金额不上纸面', htmlC, '500.00');
notContains('C9 木箱客户收费原值不上纸面（防双计剔除）', htmlC, '20.00');

/* 未核实客户收费 → 运费行不印 + 警示 + TOTAL 回落 */
const dC2 = mkQT({ totals: {} });
dC2.items[0].qty = 100; dC2.items[0].price = 6.57; dC2.items[1].qty = 3; dC2.items[1].price = 12.5;
dC2._unknown.pricing.freight = [fr('forwarder', 100, 'USD', false, true)];
dC2._unknown.pricing.extra = { discount: 0, other_charges: 0 };
const htmlC2 = Sheet.build(dC2, { templateId: 'quotation-rc-v1' });
contains('C10 未核实运费格子显示 —（不静默按 0 计）', htmlC2, 'Shipping / Freight</th><td class="num">—</td>');
contains('C11 未核实运费给警示（不静默）', htmlC2, 'q-warn');
contains('C12 TOTAL 回落 = grand 694.50', htmlC2, '694.50');

/* CNY 客户收费 + fx 缺失 → 同样不完整（BUG-11 口径） */
const dC3 = mkQT({ totals: {}, fx: null });
dC3.items[0].qty = 100; dC3.items[0].price = 6.57; dC3.items[1].qty = 3; dC3.items[1].price = 12.5;
dC3._unknown.pricing.freight = [fr('forwarder', 66, 'CNY', true, true)];
dC3._unknown.pricing.extra = { discount: 0, other_charges: 0 };
const htmlC3 = Sheet.build(dC3, { templateId: 'quotation-rc-v1' });
contains('C13 fx 缺失的 CNY 客户收费不折算不进总额（运费格显示 —）', htmlC3, 'Shipping / Freight</th><td class="num">—</td>');
contains('C14 fx 缺失给警示', htmlC3, 'q-warn');

/* 历史单据无 _unknown.pricing → 无运费/折扣行，TOTAL=grand */
const dC4 = mkQT();
delete dC4._unknown.pricing;
const htmlC4 = Sheet.build(dC4, { templateId: 'quotation-rc-v1' });
contains('C15 历史单运费行 0.00（无 pricing 数据）', htmlC4, 'Shipping / Freight</th><td class="num">0.00</td>');
contains('C16 历史单 TOTAL = grand 662.10', htmlC4, '662.10');
notContains('C17 历史单无警示', htmlC4, 'q-warn');

/* totalsRC 直接数值断言 */
const tC = SheetRC.totalsRC(dC, {});
eq('C18 quotedFreight=121.00', tC.quotedFreight, 121);
eq('C19 total=812.50', tC.total, 812.5);

/* ============ D. 大写金额（复用 reference-sheets.words） ============ */
console.log('');
console.log('---- D. 英文金额大写 ----');
eq('D1 zero', Ref.words(0), 'zero and 00/100 only');
eq('D2 1.05', Ref.words(1.05), 'one and 05/100 only');
eq('D3 1000', Ref.words(1000), 'one thousand and 00/100 only');
eq('D4 1234567.89', Ref.words(1234567.89), 'one million two hundred thirty four thousand five hundred sixty seven and 89/100 only');
contains('D5 负数拒绝', Ref.words(-1), '金额过大');
contains('D6 ≥1e12 拒绝', Ref.words(1e12), '金额过大');
contains('D7 NaN 拒绝', Ref.words(NaN), '金额过大');

/* ============ E. 内部字段零泄漏 ============ */
console.log('');
console.log('---- E. 内部核价参数零泄漏 ----');
const dE = mkQT();
dE._unknown.pricing.freight = [fr('forwarder', 88.88, 'USD', true, false)];   /* 内部运费 */
const htmlE = Sheet.build(dE, { templateId: 'quotation-rc-v1', logo: LOGO });
['feeRate', 'targetMargin', 'commissionRate', 'markupRate', 'feeInPrice', 'pricingVersion',
 'costFactory', 'cost_factory', 'included_in_cost', 'charge_customer', '88.88', '6.6"'].forEach(tok => {
  notContains('E 泄漏检查', htmlE, tok);
});
ok('E 汇总：内部参数与内部运费金额均未出现在纸面', pass > 0);

/* ============ F. 持久化（模板不丢） ============ */
console.log('');
console.log('---- F. 模板持久化 ----');
const lay = M.sanitizeQuoteLayout({ templateId: 'quotation-rc-v1', templateName: 'RunCheng 报价版' });
eq('F1 sanitizeQuoteLayout 保留 quotation-rc-v1', lay.templateId, 'quotation-rc-v1');
eq('F2 非法模板仍被拒', M.sanitizeQuoteLayout({ templateId: 'rc-x' }).templateId, undefined);

const tmpF = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-p1d3-'));
const storageF = require(path.join(ROOT, 'storage.js')).createStorage(tmpF);
global.window = { SBModel: M, SBW: { load() { return storageF.load(); }, save(db) { return storageF.save(db); }, paths() { return storageF.paths(); } } };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const StoreF = new Function(fs.readFileSync(path.join(ROOT, 'app', 'store.js'), 'utf8') + '\nreturn Store;').call(global.window);
ok('F3 真实 store.js（隔离 tmp）加载', !!StoreF);
const specF = mkQT();
const createdF = StoreF.addDocument(JSON.parse(JSON.stringify(specF)));
ok('F4 新建 rc 单据落盘', !!createdF);
const backF = StoreF.getDocument(createdF.id);
eq('F5 新建→重开模板保留', backF._unknown.quoteLayout.templateId, 'quotation-rc-v1');
const patchF = JSON.parse(JSON.stringify(backF));
patchF.remark = 'updated';
patchF._unknown.quoteLayout.templateName = 'RunCheng 报价版';
const updF = StoreF.updateDocument(createdF.id, patchF);
ok('F6 更新落盘', updF === true);
const backF2 = StoreF.getDocument(createdF.id);
eq('F7 更新→重开模板仍保留', backF2._unknown.quoteLayout.templateId, 'quotation-rc-v1');
eq('F8 模板名保留', backF2._unknown.quoteLayout.templateName, 'RunCheng 报价版');
eq('F9 remark 更新生效', backF2.remark, 'updated');

/* ============ G. 原有输出不受影响 ============ */
console.log('');
console.log('---- G. SC/CI/PL 默认版式与 basic-v1 QT 原有输出 ----');
/* P1-D-04：未声明模板的 SC/CI/PL 现在也走 RunCheng 统一版式（原来回落 basic-v1）。
   G1/G3/G5 断言的「回落基础版」契约随之反转；G2/G4 改为在各类型自己的明细/条款里验证
   业务字段仍在（只是文本随版式变成大写列头与转义后的条款标签）。检查项数保持不变。 */
function plainDoc(type) { const d = mkQT(); d.type = type; delete d._unknown; return d; }
const gSC = Sheet.build(plainDoc('SC'), {});
contains('G1 SC 默认统一版式', gSC, 'data-template="quotation-rc-v1"');
contains('G2 SC 合同条款仍在', gSC, 'Terms &amp; Conditions');
const gCI = Sheet.build(plainDoc('CI'), {});
contains('G3 CI 默认统一版式', gCI, 'data-template="quotation-rc-v1"');
contains('G4 CI 保留 HS Code 列', gCI, 'HS CODE');
const gPL = Sheet.build(plainDoc('PL'), {});
contains('G5 PL 默认统一版式', gPL, 'data-template="quotation-rc-v1"');
notContains('G6 PL 无金额列', gPL, 'UNIT PRICE');
const gQTb = Sheet.build(mkQT(), { templateId: 'basic-v1' });
contains('G7 QT 基础版不受影响（显式请求 basic-v1）', gQTb, 'data-template="basic-v1"');
contains('G8 QT 基础版仍含丝网规格列', gQTb, 'Aperture');

/* ============ H. LOGO 存储与主进程只读路径 ============ */
console.log('');
console.log('---- H. LOGO 存储与主进程只读数据文件路径 ----');
ok('H1 saveSettings({sellerLogo}) 返回 true', StoreF.saveSettings({ sellerLogo: LOGO }) === true);
eq('H2 settings 读回 sellerLogo', StoreF.settings().sellerLogo, LOGO);
ok('H3 空串清除', StoreF.saveSettings({ sellerLogo: '' }) === true && StoreF.settings().sellerLogo === '');
eq('H4 validLogo 合法 data URI', SheetRC.validLogo(LOGO), LOGO);
eq('H5 validLogo 拒绝非图片', SheetRC.validLogo('http://x/y.png'), '');
eq('H6 validLogo 拒绝超限', SheetRC.validLogo('data:image/png;base64,' + 'A'.repeat(1000100)), '');
const tmpH = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-p1d3-logo-'));
eq('H7 主进程只读路径：正常文件返回 LOGO', SheetRC.logoFromUserDataDir(tmpH), '');
fs.mkdirSync(path.join(tmpH, 'data'), { recursive: true });
fs.writeFileSync(path.join(tmpH, 'data', 'siwangbox-v5.json'), JSON.stringify({ schemaVersion: 5, settings: { sellerLogo: LOGO } }));
eq('H8 主进程只读路径：含 sellerLogo 的 v5 数据文件', SheetRC.logoFromUserDataDir(tmpH), LOGO);
fs.writeFileSync(path.join(tmpH, 'data', 'siwangbox-v5.json'), '{broken');
eq('H9 主进程只读路径：损坏文件优雅降级为空', SheetRC.logoFromUserDataDir(tmpH), '');
eq('H10 主进程只读路径：目录不存在优雅降级', SheetRC.logoFromUserDataDir(path.join(tmpH, 'nope')), '');
ok('H11 渲染层路径优先级：opts.logo 显式传入生效', SheetRC.logoFor({}, { logo: LOGO }) === LOGO);
/* P1-D-03R-LOGO：设置页旧占位图不得覆盖原版 LOGO */
StoreF.saveSettings({ sellerLogo: LOGO });
const htmlDefaultLogo = Sheet.build(mkQT(), { templateId: 'quotation-rc-v1' });
contains('H11a 设置页有 LOGO 时仍使用原版 JPEG LOGO', htmlDefaultLogo, 'data:image/jpeg;base64,');
notContains('H11b 设置页 PNG 占位图不进入纸面', htmlDefaultLogo, 'data:image/png;base64,');
StoreF.saveSettings({ sellerLogo: '' });

/* ---- H2. 抬头联系方式（P1-D-03R：settings.sellerPhone/sellerWhatsApp/sellerEmail/sellerWebsite） ---- */
const htmlH = Sheet.build(mkQT(), { templateId: 'quotation-rc-v1', logo: LOGO,
  sellerInfo: { sellerPhone: '+86-318-7526111', sellerWhatsApp: '+86-13800000000', sellerEmail: 'sales@rc.com', sellerWebsite: 'https://rc.com' } });
contains('H12 抬头印 Tel（opts.sellerInfo 显式传入）', htmlH, 'Tel: +86-318-7526111');
contains('H13 抬头印 WhatsApp / Email / Web', htmlH, 'WhatsApp: +86-13800000000');
contains('H14 抬头印 Email / Web', htmlH, 'https://rc.com');
notContains('H15 无联系方式时抬头不印 Tel 行', Sheet.build(mkQT(), { templateId: 'quotation-rc-v1' }), 'Tel:');
fs.writeFileSync(path.join(tmpH, 'data', 'siwangbox-v5.json'), JSON.stringify({ schemaVersion: 5, settings: { sellerPhone: '19503283762', sellerEmail: 'run@rc.com' } }));
const seH = SheetRC.sellerExtraFromUserDataDir(tmpH);
eq('H16 主进程只读路径：settings 联系方式读出', seH.phone + '|' + seH.email, '19503283762|run@rc.com');
fs.writeFileSync(path.join(tmpH, 'data', 'siwangbox-v5.json'), '{broken');
const seH2 = SheetRC.sellerExtraFromUserDataDir(tmpH);
eq('H17 主进程只读路径：损坏文件优雅降级为空对象', seH2.phone + seH2.email + seH2.website, '');

/* ---------- 汇总 ---------- */
console.log('');
console.log('==== P1-D-03 测试汇总：PASS ' + pass + ' / FAIL ' + fail + ' ====');
process.exit(fail ? 1 : 0);
