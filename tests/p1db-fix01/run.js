/*
 * P1-RC-DB-FIX-01 · 独立验收问题回归测试
 *
 * BUG-01 V5 读取门缺少客户/供应商校验 —— 读门与写门对同一非法数据必须同时拒绝
 * BUG-02 saveSettingsProfile 局部更新清空其他字段 —— 未提交键保持原值，显式 null/'' 才清除
 * BUG-03 productImagesOf 空数组语义 —— images 字段存在即按其内容（含 []），不存在才合成
 *
 * 方法：真实 storage.js（os.tmpdir 隔离）+ 真实 app/store.js / app/model.js；不触碰生产数据。
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const need = ['app/model.js', 'app/store.js', 'storage.js'];
const missing = need.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) { console.error('FATAL 缺少：' + missing.join(', ')); process.exit(1); }

const M = require(path.join(ROOT, 'app', 'model.js'));
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const IMG2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//2Q==';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (d === undefined ? '' : ' —— ' + JSON.stringify(d))); } };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), { expect: b, actual: a });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-p1dbfix01-'));
const storage = require(path.join(ROOT, 'storage.js')).createStorage(tmp);

function makeStore() {
  global.window = { SBModel: M, SBW: {
    load: () => storage.load(), save: db => storage.save(db), paths: () => storage.paths(), backups: () => storage.backups() } };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  return new Function(fs.readFileSync(path.join(ROOT, 'app', 'store.js'), 'utf8') + '\nreturn Store;').call(global.window);
}

/* ---------- 种子：合法旧数据 + 合法新结构 ---------- */
function seed() {
  return {
    schemaVersion: 5,
    counters: { QT: {}, PI: {}, SC: {}, CI: {}, PL: {} },
    migration: { version: 5, at: '2026-11-20T00:00:00.000Z' },
    customers: [
      { id: 'c-old', name: 'Old Buyer', company: 'Old Buyer Co.', country: 'US', amount: 0 },
      { id: 'c-new', name: 'New Buyer', company: 'New Buyer Co.', country: 'DE',
        whatsapp: '+49 170', website: 'https://x.de', customerType: '经销商', source: '阿里', notes: '', archivedAt: '' }
    ],
    products: [
      { id: 'p-old', sku: 'OLD-1', category: '马场围栏', nameCn: '旧产品', nameEn: 'Old', unit: 'set',
        price: 10, mesh: 0, wire: 0, width: 0, rollLen: 0,
        imageData: IMG2, realImageData: IMG, realImageMode: 'custom',
        costFactory: 5, costPacking: 0, costInland: 0, costOther: 0, costConfirmed: true },
      { id: 'p-new', sku: 'NEW-1', category: '马场围栏', nameCn: '新产品', nameEn: 'New', unit: 'set',
        price: 20, mesh: 0, wire: 0, width: 0, rollLen: 0, color: 'White', accessories: '五金', remarks: '备注',
        images: [{ data: IMG, type: 'main', sort: 1, caption: '主图' }, { data: IMG2, type: 'spec', sort: 0 }] }
    ],
    documents: [{
      id: 'd1', no: 'QT-202611-0001', type: 'QT', date: '2026-11-21',
      customer: { id: 'c-old', name: 'Old Buyer', company: 'Old Buyer Co.', country: 'US', address: '' },
      items: [{ _rowId: 'r1', productId: 'p-old', nameCn: '旧产品', nameEn: 'Old', qty: 1, unit: 'set',
        price: 10, amount: 10, costFactory: 5, costPacking: 0, costInland: 0, costOther: 0, costConfirmed: true }],
      currency: 'USD', term: 'FOB', payment: 'T/T', validity: '30 days', delivery: '25 days', remark: '',
      totals: { subtotal: 10, grand: 10, computedFromItems: 10, previousGrand: null },
      fx: 6.6, feeRate: 0.03, targetMargin: 0.25, commissionRate: 0.2, freightMarkup: 0,
      markupRate: null, feeInPrice: 1, pricingVersion: null, fees: [],
      seller: { company: '', contact: '', address: '' }, bank: '', buyerAddress: '', marks: '',
      shipment: '', vessel: '', origin: '', contractTerms: '', signDate: '', signPlace: '',
      packagingMode: null, totalPackages: null, _unknown: {},
      createdAt: '2026-11-21T00:00:00.000Z', updatedAt: '2026-11-21T00:00:00.000Z'
    }],
    communications: [], quotesArchive: [], checkins: [],
    settings: {
      company: '润成（legacy）', contact: 'Vance（legacy）', sellerAddress: '安平（legacy）',
      defaultCurrency: 'USD', ai: { provider: 'deepseek', enabled: false },
      pricingDefaults: { feeRate: 0.03, commissionRate: 0.2 }
    },
    _unknown: {
      suppliers: [{ id: 'sup-1', name: '合法供应商', contact: 'Li', remarks: '', createdAt: '2026-11-20T00:00:00.000Z' }],
      supplierQuotes: [{ id: 'sq-1', supplierId: 'sup-1', supplierName: '合法供应商', productId: 'p-old',
        currency: 'CNY', price: 9.5, unit: 'panel', moq: 'MOQ 10', quoteDate: '2026-11-20',
        validUntil: '2026-12-20', sourceFile: 'a.pdf', createdAt: '2026-11-20T00:00:00.000Z' }]
    }
  };
}

const base = seed();
const baseDocs = JSON.stringify(base.documents);
const baseLegacy = JSON.stringify({
  company: base.settings.company, contact: base.settings.contact,
  sellerAddress: base.settings.sellerAddress, pricingDefaults: base.settings.pricingDefaults
});
storage.save(base);
let Store = makeStore();

/* ================= BUG-01：两门同权 ================= */
function bothGates(db) {
  const r = M.validateV5(db), w = M.validateWritable(db);
  return { r, w, both: r.ok === false && w.ok === false };
}

const badArchived = JSON.parse(JSON.stringify(base));
badArchived.customers[0].archivedAt = '2026/11/22';
let g = bothGates(badArchived);
ok('B1-1 非法 archivedAt：读取门拒绝', g.r.ok === false, g.r.errors.slice(0, 2));
ok('B1-2 非法 archivedAt：写入门拒绝', g.w.ok === false, g.w.errors.slice(0, 2));
ok('B1-3 两门结论一致（均拒绝）', g.both);
ok('B1-4 错误定位含 customers[0] 与 archivedAt',
  g.r.errors.some(e => e.indexOf('customers[0]') >= 0 && e.indexOf('archivedAt') >= 0), g.r.errors);
ok('B1-5 写门错误定位与读门同源',
  g.w.errors.some(e => e.indexOf('customers[0]') >= 0 && e.indexOf('archivedAt') >= 0), g.w.errors);

const badCurrency = JSON.parse(JSON.stringify(base));
badCurrency._unknown.supplierQuotes[0].currency = 'EUR';
g = bothGates(badCurrency);
ok('B1-6 非法 supplier currency：读取门拒绝', g.r.ok === false);
ok('B1-7 非法 supplier currency：写入门拒绝', g.w.ok === false);
ok('B1-8 两门结论一致', g.both);
ok('B1-9 错误定位含 supplierQuotes[0].currency',
  g.r.errors.some(e => e.indexOf('supplierQuotes[0]') >= 0 && e.indexOf('currency') >= 0), g.r.errors);

const badStruct = JSON.parse(JSON.stringify(base));
badStruct._unknown.suppliers = { not: 'array' };
g = bothGates(badStruct);
ok('B1-10 非法 suppliers 结构：读取门拒绝', g.r.ok === false);
ok('B1-11 非法 suppliers 结构：写入门拒绝', g.w.ok === false);
ok('B1-12 两门结论一致', g.both);
ok('B1-13 错误定位含 _unknown.suppliers',
  g.r.errors.some(e => e.indexOf('_unknown.suppliers') >= 0), g.r.errors);

const badQuote = JSON.parse(JSON.stringify(base));
delete badQuote._unknown.supplierQuotes[0].price;
g = bothGates(badQuote);
ok('B1-14 供应商报价缺 price：两门均拒绝', g.both);

const badUnknown = JSON.parse(JSON.stringify(base));
badUnknown._unknown = [];
g = bothGates(badUnknown);
ok('B1-15 _unknown 非对象：两门均拒绝', g.both, { r: g.r.errors.slice(0, 2) });

ok('B1-16 合法旧客户（无扩展字段）两门均通过',
  M.validateV5(base).ok === true && M.validateWritable(base).ok === true);
ok('B1-17 合法新结构两门均通过（含多图/供应商）',
  M.validateV5(Store.get()).ok === true && M.validateWritable(Store.get()).ok === true);

/* ================= BUG-02：设置局部更新 ================= */
ok('B2-0 先写入完整公司/银行/默认参数', Store.saveSettingsProfile({
  companyProfile: { nameEn: 'Runcheng EN', nameCn: '润成集团', contact: 'Vance', email: 'a@b.com',
    phone: '19503283762', whatsapp: '19503283762', website: 'https://apruncheng.en.alibaba.com/', addressEn: 'Anping' },
  bank: { name: 'Bank of China', accountName: 'Runcheng', accountNumber: '123', swift: 'BKCHCNBJ', address: 'Hengshui' },
  defaults: { fx: 7.15, feeRate: 0.03, targetMargin: 0.25, commissionRate: 0.2, lossPolicy: 'zero_on_loss' }
}) === true);
const full = Store.settingsProfile();

ok('B2-1 只改公司中文名', Store.saveSettingsProfile({ companyProfile: { nameCn: '润成金属' } }) === true);
let p1 = Store.settingsProfile().companyProfile;
eq('B2-2 中文名已更新', p1.nameCn, '润成金属');
eq('B2-3 其余七项不变',
  [p1.nameEn, p1.contact, p1.email, p1.phone, p1.whatsapp, p1.website, p1.addressEn],
  [full.companyProfile.nameEn, full.companyProfile.contact, full.companyProfile.email,
   full.companyProfile.phone, full.companyProfile.whatsapp, full.companyProfile.website, full.companyProfile.addressEn]);

ok('B2-4 只改银行名称', Store.saveSettingsProfile({ bank: { name: 'ICBC' } }) === true);
let b1 = Store.settingsProfile().bank;
eq('B2-5 银行名已更新', b1.name, 'ICBC');
eq('B2-6 其余四项不变', [b1.accountName, b1.accountNumber, b1.swift, b1.address],
  [full.bank.accountName, full.bank.accountNumber, full.bank.swift, full.bank.address]);

ok('B2-7 只改默认汇率', Store.saveSettingsProfile({ defaults: { fx: 7.33 } }) === true);
let d1 = Store.settingsProfile().defaults;
eq('B2-8 汇率已更新', d1.fx, 7.33);
eq('B2-9 其余默认参数不变',
  [d1.feeRate, d1.targetMargin, d1.commissionRate, d1.lossPolicy],
  [full.defaults.feeRate, full.defaults.targetMargin, full.defaults.commissionRate, full.defaults.lossPolicy]);

const beforeClear = Store.settingsProfile();
ok('B2-10 显式空串清空 phone', Store.saveSettingsProfile({ companyProfile: { phone: '' } }) === true);
let p2 = Store.settingsProfile().companyProfile;
eq('B2-11 phone 已清空', p2.phone, '');
eq('B2-12 清空 phone 时其他公司字段不变',
  [p2.nameCn, p2.nameEn, p2.email, p2.whatsapp, p2.website, p2.addressEn, p2.contact],
  [beforeClear.companyProfile.nameCn, beforeClear.companyProfile.nameEn, beforeClear.companyProfile.email,
   beforeClear.companyProfile.whatsapp, beforeClear.companyProfile.website, beforeClear.companyProfile.addressEn,
   beforeClear.companyProfile.contact]);

ok('B2-13 显式 null 清除银行 swift', Store.saveSettingsProfile({ bank: { swift: null } }) === true);
let b2 = Store.settingsProfile().bank;
eq('B2-14 swift 已清除（读回为空）', b2.swift, '');
eq('B2-15 清除 swift 时其他银行字段不变',
  [b2.name, b2.accountName, b2.accountNumber, b2.address],
  [beforeClear.bank.name, beforeClear.bank.accountName, beforeClear.bank.accountNumber, beforeClear.bank.address]);

const beforeNull = Store.settingsProfile().defaults;
ok('B2-16 显式 null 清除默认毛利率', Store.saveSettingsProfile({ defaults: { targetMargin: null } }) === true);
let d2 = Store.settingsProfile().defaults;
eq('B2-17 毛利率已清为 null', d2.targetMargin, null);
eq('B2-18 其他默认参数不变', [d2.fx, d2.feeRate, d2.commissionRate, d2.lossPolicy],
  [beforeNull.fx, beforeNull.feeRate, beforeNull.commissionRate, beforeNull.lossPolicy]);

/* 合并后组合校验：已有 feeRate=0.03，提交 margin=0.98 → 合计 1.01 必须拒绝 */
ok('B2-19 合并后费率+毛利率≥100% 被拒绝', Store.saveSettingsProfile({ defaults: { targetMargin: 0.98 } }) === false);
eq('B2-20 被拒绝后默认值未被改写', Store.settingsProfile().defaults.targetMargin, null);

ok('B2-21 空对象不写库（返回 false）', Store.saveSettingsProfile({}) === false);
ok('B2-22 只含未知容器不写库', Store.saveSettingsProfile({ somethingElse: { a: 1 } }) === false);
eq('B2-23 legacy settings 全程未被覆盖', JSON.stringify({
  company: Store.get().settings.company, contact: Store.get().settings.contact,
  sellerAddress: Store.get().settings.sellerAddress, pricingDefaults: Store.get().settings.pricingDefaults
}), baseLegacy);

Store = makeStore();
const after = Store.settingsProfile();
eq('B2-24 重启后公司局部更新结果一致', [after.companyProfile.nameCn, after.companyProfile.nameEn, after.companyProfile.phone],
  ['润成金属', 'Runcheng EN', '']);
eq('B2-25 重启后银行局部更新结果一致', [after.bank.name, after.bank.swift], ['ICBC', '']);
eq('B2-26 重启后默认参数一致', [after.defaults.fx, after.defaults.targetMargin], [7.33, null]);
eq('B2-27 重启后 legacy 仍未被覆盖', JSON.stringify({
  company: Store.get().settings.company, contact: Store.get().settings.contact,
  sellerAddress: Store.get().settings.sellerAddress, pricingDefaults: Store.get().settings.pricingDefaults
}), baseLegacy);

/* ================= BUG-03：空数组语义 ================= */
eq('B3-1 旧产品（无 images 字段）合成 main+spec', Store.productImagesOf('p-old').map(x => x.type), ['main', 'spec']);
eq('B3-2 新产品按 sort 排序读取', Store.productImagesOf('p-new').map(x => x.type), ['spec', 'main']);

ok('B3-3 把 images 设为空数组', Store.updateProduct(Object.assign({}, Store.products().find(p => p.id === 'p-old'), { images: [] })) === true);
eq('B3-4 空数组直接返回 []（不再回退合成）', Store.productImagesOf('p-old').length, 0);
const oldNow = Store.products().find(p => p.id === 'p-old');
eq('B3-5 空数组不改写 imageData', oldNow.imageData, IMG2);
eq('B3-6 空数组不改写 realImageData / realImageMode',
  [oldNow.realImageData, oldNow.realImageMode], [IMG, 'custom']);

Store = makeStore();
eq('B3-7 空数组已持久化（重开仍为 0 张）', Store.productImagesOf('p-old').length, 0);
eq('B3-8 重开后旧字段仍未被改写',
  [Store.products().find(p => p.id === 'p-old').imageData,
   Store.products().find(p => p.id === 'p-old').realImageData], [IMG2, IMG]);

/* 注意：Store.products() 是深拷贝；这里要操作实时对象才能落盘 */
const liveOld = Store.get().products.find(p => p.id === 'p-old');
delete liveOld.images;
ok('B3-9a 删除 images 字段并保存成功', Store.save() === true);
Store = makeStore();
eq('B3-9b 移除 images 字段后恢复合成（兼容旧数据）', Store.productImagesOf('p-old').map(x => x.type), ['main', 'spec']);

/* ================= 汇总与不变量 ================= */
eq('R1 Schema 仍为 V5', Store.get().schemaVersion, 5);
eq('R2 历史单据 JSON 全程未变', JSON.stringify(Store.get().documents), baseDocs);
eq('R3 单据 totals 未变', Store.get().documents[0].totals.grand, 10);
ok('R4 两门对最终库仍同时通过',
  M.validateV5(Store.get()).ok === true && M.validateWritable(Store.get()).ok === true);

console.log('');
console.log('==== P1-RC-DB-FIX-01 回归：PASS ' + pass + ' / FAIL ' + fail + ' ====');
console.log('隔离目录：' + tmp);
process.exit(fail === 0 ? 0 : 1);
