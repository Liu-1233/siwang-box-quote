/*
 * P1-RC-DB 数据底座 · 测试套件
 *
 * 覆盖：
 *   A 产品多图 images[]（main/spec/accessory、排序、说明、旧数据合成、不覆盖旧字段）
 *   B 产品扩展文本 color / accessories / remarks
 *   C 客户扩展字段 whatsapp / website / customerType / source / notes / archivedAt
 *   D 供应商与供应商报价（_unknown 受控结构、只增不改、非法数据拒绝）
 *   E 设置扩展（公司 8 项 / 银行 5 项 / 默认参数 5 项、不覆盖旧配置、重开一致）
 *   F 兼容与往返（旧数据读取保存、历史单据零变化、Schema 仍 V5、备份可用）
 *   G 模型读写门（同一份规则、非法多图/供应商拒绝）
 *
 * 方法：真实 storage.js（os.tmpdir 隔离）+ mock 渲染桥 + 真实 app/store.js / app/model.js。
 *       全程不触碰生产 userData；不加载 pages.js，不涉及 UI。
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const need = ['app/model.js', 'app/store.js', 'storage.js', 'app/pricing.js'];
const missing = need.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) {
  console.error('FATAL 工程根目录解析失败（' + ROOT + '），缺少：' + missing.join(', '));
  process.exit(1);
}

const M = require(path.join(ROOT, 'app', 'model.js'));
const PRICING_SHA = require('crypto').createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, 'app', 'pricing.js'))).digest('hex');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail === undefined ? '' : ' —— ' + JSON.stringify(detail))); }
};
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), { expect: b, actual: a });

/* 1×1 PNG（真实 PNG 头，满足受限 base64 白名单） */
const IMG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const IMG_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//2Q==';

/* ---------- 隔离环境 ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-p1db-'));
const storage = require(path.join(ROOT, 'storage.js')).createStorage(tmp);

function makeStore() {
  global.window = {
    SBModel: M,
    SBW: {
      load() { return storage.load(); },
      save(db) { return storage.save(db); },
      paths() { return storage.paths(); },
      backups() { return storage.backups(); }
    }
  };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const src = fs.readFileSync(path.join(ROOT, 'app', 'store.js'), 'utf8') + '\nreturn Store;';
  return new Function(src).call(global.window);
}

/* ---------- 造一份"旧数据"：没有任何 P1 新字段 ---------- */
function legacyBase() {
  return {
    schemaVersion: 5,
    counters: { QT: {}, PI: {}, SC: {}, CI: {}, PL: {} },
    migration: { version: 5, at: '2026-11-20T00:00:00.000Z' },
    customers: [{
      id: 'c-old-1', name: 'Miller Ranch Supply LLC', company: 'Miller Ranch Supply LLC',
      country: 'US', contact: 'Tom', amount: 0, created: '2026-11-01'
    }],
    products: [
      {
        id: 'p-old-1', sku: 'RC-CAT-P01', category: '马场围栏', nameCn: '马场围栏', nameEn: 'Horse Fence',
        unit: 'set', price: 20, mesh: 0, wire: 0, width: 0, rollLen: 0,
        imageData: IMG_JPEG, realImageData: IMG_PNG, realImageMode: 'custom',
        costFactory: 50, costPacking: 2, costInland: 1, costOther: 0, costConfirmed: true
      },
      {
        id: 'p-old-2', sku: 'RC-PF-6X6', category: '隐私围挡', nameCn: 'PVC 隐私围栏 6×6',
        nameEn: 'Privacy Fence 6x6', unit: 'set', price: 30, mesh: 0, wire: 0, width: 0, rollLen: 0
      }
    ],
    documents: [{
      id: 'd-old-1', no: 'QT-202611-0001', type: 'QT', date: '2026-11-21',
      customer: { id: 'c-old-1', name: 'Miller Ranch Supply LLC', company: 'Miller Ranch Supply LLC', country: 'US', address: '' },
      items: [{
        _rowId: 'r1', productId: 'p-old-1', nameCn: '马场围栏', nameEn: 'Horse Fence',
        qty: 10, unit: 'set', price: 20, amount: 200,
        costFactory: 50, costPacking: 2, costInland: 1, costOther: 0, costConfirmed: true
      }],
      currency: 'USD', term: 'FOB', payment: 'T/T', validity: '30 days', delivery: '25 days',
      remark: '', totals: { subtotal: 200, grand: 200, computedFromItems: 200, previousGrand: null },
      fx: 6.6, feeRate: 0.03, targetMargin: 0.25, commissionRate: 0.2, freightMarkup: 0,
      markupRate: null, feeInPrice: 1, pricingVersion: null, fees: [],
      seller: { company: '', contact: '', address: '' }, bank: '', buyerAddress: '',
      marks: '', shipment: '', vessel: '', origin: '', contractTerms: '', signDate: '', signPlace: '',
      packagingMode: null, totalPackages: null, _unknown: {},
      createdAt: '2026-11-21T00:00:00.000Z', updatedAt: '2026-11-21T00:00:00.000Z'
    }],
    communications: [], quotesArchive: [], checkins: [],
    settings: {
      company: '安平县润成金属制品有限公司', contact: 'Vance',
      sellerAddress: '河北省衡水市安平县', defaultCurrency: 'USD',
      ai: { provider: 'deepseek', baseUrl: '', model: '', enabled: false },
      pricingDefaults: { feeRate: 0.03, commissionRate: 0.2 }
    },
    _unknown: {}
  };
}

const base = legacyBase();
const baseDocsJson = JSON.stringify(base.documents);
const baseCounters = JSON.stringify(base.counters);
let sr = storage.save(base);
if (!sr || sr.ok === false) { console.error('FATAL 种子数据保存失败：' + JSON.stringify(sr)); process.exit(1); }
let Store = makeStore();
ok('G0 种子库加载成功（schemaVersion 5）', Store.get().schemaVersion === 5);

/* ================= A 产品多图 ================= */
const NEW_PRODUCT = {
  sku: 'RC-HF-TEST-IMG', category: '马场围栏', nameCn: '多图测试产品', nameEn: 'Multi Image Test',
  unit: 'set', price: 99, mesh: 0, wire: 0, width: 0, rollLen: 0,
  color: 'White', accessories: '立柱 4 根 / 五金 1 套', remarks: 'P1 数据底座测试',
  costFactory: 60, costPacking: 3, costInland: 2, costOther: 0, costConfirmed: true,
  images: [
    { data: IMG_PNG, type: 'main', sort: 2, caption: '实拍主图' },
    { data: IMG_JPEG, type: 'spec', sort: 0, caption: '规格图' },
    { data: IMG_PNG, type: 'accessory', sort: 1, caption: '配件图' }
  ]
};
ok('A1 新建带 3 张图的产品成功', Store.addProduct(NEW_PRODUCT) === true);
const np = Store.products().find(p => p.sku === 'RC-HF-TEST-IMG');
ok('A2 产品已落库且 id 生成', !!np && !!np.id);
eq('A3 三张图完整保存', np.images.length, 3);
ok('A4 三种类型都在', ['main', 'spec', 'accessory'].every(t => np.images.some(i => i.type === t)));
eq('A5 图片说明保留', np.images.find(i => i.type === 'main').caption, '实拍主图');

Store = makeStore();
const np2 = Store.products().find(p => p.sku === 'RC-HF-TEST-IMG');
eq('A6 重开后图片仍在（3 张）', np2.images.length, 3);
const sorted = Store.productImagesOf(np2.id);
eq('A7 productImagesOf 按 sort 升序', sorted.map(i => i.type), ['spec', 'accessory', 'main']);
eq('A8 扩展文本持久化', [np2.color, np2.accessories, np2.remarks], ['White', '立柱 4 根 / 五金 1 套', 'P1 数据底座测试']);

/* 旧产品：无 images，靠 imageData / realImageData 合成，不写回 */
const oldP = Store.products().find(p => p.id === 'p-old-1');
const synth = Store.productImagesOf('p-old-1');
eq('A9 旧产品合成 main+spec 两张', synth.map(i => i.type), ['main', 'spec']);
eq('A10 合成图取自 realImageData / imageData', [synth[0].data === IMG_PNG, synth[1].data === IMG_JPEG], [true, true]);
ok('A11 旧产品磁盘上仍没有 images 字段（未写回）', Store.products().find(p => p.id === 'p-old-1').images === undefined);
eq('A12 旧字段 imageData 未被改写', Store.products().find(p => p.id === 'p-old-1').imageData, IMG_JPEG);
eq('A13 旧字段 realImageMode 未被改写', Store.products().find(p => p.id === 'p-old-1').realImageMode, 'custom');

/* 非法多图 */
const bad = (over) => Store.addProduct(Object.assign({}, NEW_PRODUCT, { sku: 'BAD-' + Math.random(), images: over }));
ok('A14 非法图片类型被拒绝', bad([{ data: IMG_PNG, type: 'cover', sort: 0 }]) === false);
ok('A15 非法图片数据被拒绝', bad([{ data: 'data:image/gif;base64,AAAA', type: 'main', sort: 0 }]) === false);
ok('A16 超过 12 张被拒绝', bad(Array.from({ length: 13 }, (_, i) => ({ data: IMG_PNG, type: 'main', sort: i }))) === false);
ok('A17 说明超 200 字被拒绝', bad([{ data: IMG_PNG, type: 'main', sort: 0, caption: 'x'.repeat(201) }]) === false);
ok('A18 sort 非整数被拒绝', bad([{ data: IMG_PNG, type: 'main', sort: 1.5 }]) === false);

/* ================= B 扩展文本 ================= */
ok('B1 超长 color 被拒绝', Store.addProduct(Object.assign({}, NEW_PRODUCT, { sku: 'BAD-TXT', color: 'x'.repeat(2001) })) === false);
ok('B2 非字符串 remarks 被拒绝', Store.addProduct(Object.assign({}, NEW_PRODUCT, { sku: 'BAD-TXT2', remarks: 123 })) === false);
ok('B3 旧产品不带扩展字段仍可保存', Store.updateProduct(Object.assign({}, Store.products().find(p => p.id === 'p-old-2'), { price: 31 })) === true);
eq('B4 旧产品价格已更新且无新字段', [Store.products().find(p => p.id === 'p-old-2').price, Store.products().find(p => p.id === 'p-old-2').color], [31, undefined]);

/* ================= C 客户扩展 ================= */
const NEW_CUST = {
  name: 'Test Buyer', company: 'Test Buyer Co.', country: 'DE', contact: 'Anna',
  whatsapp: '+49 170 0000000', website: 'https://example.de', customerType: '经销商',
  source: '阿里巴巴', notes: 'P1 客户扩展测试', archivedAt: ''
};
ok('C1 新客户（含 6 个扩展字段）保存成功', Store.addCustomer(NEW_CUST) === true);
const nc = Store.customers().find(c => c.company === 'Test Buyer Co.');
eq('C2 六个扩展字段落库', [nc.whatsapp, nc.website, nc.customerType, nc.source, nc.notes, nc.archivedAt],
  ['+49 170 0000000', 'https://example.de', '经销商', '阿里巴巴', 'P1 客户扩展测试', '']);
Store = makeStore();
eq('C3 重开后客户扩展字段仍在', Store.customers().find(c => c.id === nc.id).customerType, '经销商');
ok('C4 旧客户读取正常且扩展字段缺省', Store.customers().find(c => c.id === 'c-old-1').whatsapp === undefined);
ok('C5 更新客户只改 notes 不丢 archivedAt',
  Store.updateCustomer(Object.assign({}, Store.customers().find(c => c.id === nc.id), { notes: '改过', archivedAt: '2026-11-22' })) === true);
eq('C6 更新后 whatsapp 与 archivedAt 都在',
  [Store.customers().find(c => c.id === nc.id).whatsapp, Store.customers().find(c => c.id === nc.id).archivedAt],
  ['+49 170 0000000', '2026-11-22']);
ok('C7 archivedAt 非法日期被拒绝',
  Store.updateCustomer(Object.assign({}, Store.customers().find(c => c.id === nc.id), { archivedAt: '2026/11/22' })) === false);
ok('C8 customerType 非字符串被拒绝',
  Store.updateCustomer(Object.assign({}, Store.customers().find(c => c.id === nc.id), { customerType: 1 })) === false);
eq('C9 历史单据买方快照未受影响', JSON.stringify(Store.get().documents), baseDocsJson);

/* ================= D 供应商 ================= */
ok('D1 新增供应商成功并返回记录', !!Store.addSupplier({ name: 'Anping Wire Factory', contact: 'Li', remarks: '主供应商' }).id);
const sup = Store.suppliers().find(s => s.name === 'Anping Wire Factory');
Store = makeStore();
eq('D2 供应商重开后在库（1 条）', Store.suppliers().filter(s => s.name === 'Anping Wire Factory').length, 1);

const q1 = Store.addSupplierQuote({
  supplierId: sup.id, supplierName: 'Anping Wire Factory', productId: 'p-old-1',
  currency: 'CNY', price: 97.5, unit: 'panel', moq: 'MOQ 100 panels',
  quoteDate: '2026-11-20', validUntil: '2026-12-20', sourceFile: '报价单20261120.pdf'
});
ok('D3 新增采购价成功', !!q1 && !!q1.id);
const qs = Store.supplierQuotes('p-old-1');
eq('D4 采购价字段完整', [qs[0].currency, qs[0].price, qs[0].unit, qs[0].moq, qs[0].quoteDate, qs[0].validUntil, qs[0].sourceFile],
  ['CNY', 97.5, 'panel', 'MOQ 100 panels', '2026-11-20', '2026-12-20', '报价单20261120.pdf']);
eq('D5 按产品过滤只返回该产品', Store.supplierQuotes('p-old-2').length, 0);

const q2 = Store.addSupplierQuote({
  supplierId: sup.id, supplierName: 'Anping Wire Factory', productId: 'p-old-1',
  currency: 'CNY', price: 97.5, unit: 'panel', moq: 'MOQ 100 panels',
  quoteDate: '2026-11-20', validUntil: '2026-12-20', sourceFile: '报价单20261120.pdf'
});
const qs2 = Store.supplierQuotes('p-old-1');
eq('D6 只增不改：同参数再录一条 → 2 条', qs2.length, 2);
eq('D7 历史那条内容未被覆盖', qs2.map(x => x.id).sort(), [q1.id, q2.id].sort());
ok('D8 数据层没有 update/delete 供应商报价接口',
  typeof Store.updateSupplierQuote === 'undefined' && typeof Store.removeSupplierQuote === 'undefined');
ok('D9 负价格被拒绝', Store.addSupplierQuote({ supplierId: sup.id, productId: 'p-old-1', currency: 'CNY', price: -1, unit: 'set' }) === false);
ok('D10 未知币种被拒绝', Store.addSupplierQuote({ supplierId: sup.id, productId: 'p-old-1', currency: 'EUR', price: 1, unit: 'set' }) === false);
ok('D11 产品不存在被拒绝', Store.addSupplierQuote({ supplierId: sup.id, productId: 'no-such', currency: 'CNY', price: 1, unit: 'set' }) === false);
ok('D12 供应商不存在被拒绝', Store.addSupplierQuote({ supplierId: 'no-such', productId: 'p-old-1', currency: 'CNY', price: 1, unit: 'set' }) === false);
ok('D13 空供应商名被拒绝', Store.addSupplier({ name: '  ' }) === false);
Store = makeStore();
eq('D14 重开后记录仍在（2 条采购价）', Store.supplierQuotes('p-old-1').length, 2);
ok('D15 顶层没有新增 suppliers 键（仍在 _unknown）',
  Store.get().suppliers === undefined && Store.get().supplierQuotes === undefined && Array.isArray(Store.get()._unknown.supplierQuotes));

/* ================= E 设置 ================= */
const beforeSettings = JSON.stringify({
  company: Store.get().settings.company, contact: Store.get().settings.contact,
  sellerAddress: Store.get().settings.sellerAddress, pricingDefaults: Store.get().settings.pricingDefaults
});
ok('E1 保存公司信息 8 项成功', Store.saveSettingsProfile({
  companyProfile: {
    nameEn: 'Anping County Runcheng Metal Products Co., Ltd.', nameCn: '安平县润成金属制品有限公司',
    contact: 'Vance', email: 'runchengfenceob@gmail.com', phone: '19503283762',
    whatsapp: '19503283762', website: 'https://apruncheng.en.alibaba.com/',
    addressEn: '160 meters north of Dongzhenggang Road, Anping County'
  }
}) === true);
ok('E2 保存银行 5 项成功', Store.saveSettingsProfile({
  bank: { name: 'Bank of China', accountName: 'Anping Runcheng', accountNumber: '1234567890', swift: 'BKCHCNBJ', address: 'Hengshui' }
}) === true);
ok('E3 保存默认参数 5 项成功', Store.saveSettingsProfile({
  defaults: { fx: 7.15, feeRate: 0.03, targetMargin: 0.25, commissionRate: 0.2, lossPolicy: 'zero_on_loss' }
}) === true);

Store = makeStore();
const sp = Store.settingsProfile();
eq('E4 公司信息读取一致', [sp.companyProfile.nameCn, sp.companyProfile.email, sp.companyProfile.website],
  ['安平县润成金属制品有限公司', 'runchengfenceob@gmail.com', 'https://apruncheng.en.alibaba.com/']);
eq('E5 银行读取一致', [sp.bank.name, sp.bank.swift], ['Bank of China', 'BKCHCNBJ']);
eq('E6 默认参数读取一致', [sp.defaults.fx, sp.defaults.feeRate, sp.defaults.targetMargin, sp.defaults.commissionRate, sp.defaults.lossPolicy],
  [7.15, 0.03, 0.25, 0.2, 'zero_on_loss']);
eq('E7 未覆盖原有 company/contact/sellerAddress/pricingDefaults', JSON.stringify({
  company: Store.get().settings.company, contact: Store.get().settings.contact,
  sellerAddress: Store.get().settings.sellerAddress, pricingDefaults: Store.get().settings.pricingDefaults
}), beforeSettings);
ok('E8 默认汇率 ≤0 被拒绝', Store.saveSettingsProfile({ defaults: { fx: 0 } }) === false);
ok('E9 费率 ≥100% 被拒绝', Store.saveSettingsProfile({ defaults: { feeRate: 1 } }) === false);
ok('E10 费率+毛利率 ≥100% 被拒绝', Store.saveSettingsProfile({ defaults: { feeRate: 0.5, targetMargin: 0.5 } }) === false);
ok('E11 亏损规则非 zero_on_loss 被拒绝', Store.saveSettingsProfile({ defaults: { lossPolicy: 'share_loss' } }) === false);

/* 旧设置回退：清掉新容器后仍能从 company/contact 读到 */
const dbRaw = Store.get();
delete dbRaw.settings.companyProfile; delete dbRaw.settings.bank; delete dbRaw.settings.defaults;
Store.save();
Store = makeStore();
const sp2 = Store.settingsProfile();
eq('E12 旧设置回退到 company/contact/sellerAddress', [sp2.companyProfile.nameCn, sp2.companyProfile.contact, sp2.companyProfile.addressEn],
  ['安平县润成金属制品有限公司', 'Vance', '河北省衡水市安平县']);

/* ================= F 兼容与往返 ================= */
Store = makeStore();
const dbNow = Store.get();
eq('F1 Schema 仍为 V5', dbNow.schemaVersion, 5);
eq('F2 历史单据 JSON 完全未变', JSON.stringify(dbNow.documents), baseDocsJson);
eq('F3 counters 未变', JSON.stringify(dbNow.counters), baseCounters);
ok('F4 产品库原有两条都在', ['p-old-1', 'p-old-2'].every(id => dbNow.products.some(p => p.id === id)));
ok('F5 未删除任何原有客户', dbNow.customers.some(c => c.id === 'c-old-1'));
ok('F6 保存后产生 .bak 备份', (storage.backups() || []).length > 0);
const pricingShaNow = require('crypto').createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, 'app', 'pricing.js'))).digest('hex');
eq('F7 运行全程 pricing.js 逐字节未变', pricingShaNow, PRICING_SHA);

/* ================= G 模型门 ================= */
ok('G1 validateV5 接受新结构（含多图/供应商）', M.validateV5(Store.get()).ok === true);
ok('G2 validateWritable 接受新结构', M.validateWritable(Store.get()).ok === true);
const badDb = JSON.parse(JSON.stringify(Store.get()));
badDb.products[0].images = [{ data: 'javascript:alert(1)', type: 'main', sort: 0 }];
const vw = M.validateWritable(badDb);
ok('G3 validateWritable 拒绝非法多图', vw.ok === false && vw.errors.some(e => e.indexOf('images') >= 0), vw.errors);
const badSup = { _unknown: { supplierQuotes: [{ id: 'x', productId: 'p', currency: 'EUR', price: 1, unit: 'set' }] } };
const errsSup = []; M.validateSuppliers(badSup, errsSup);
ok('G4 validateSuppliers 拒绝未知币种', errsSup.length > 0);
eq('G5 导出图片类型常量', M.PRODUCT_IMAGE_TYPES, ['main', 'spec', 'accessory']);
eq('G6 图片上限常量', M.PRODUCT_IMAGE_MAX, 12);
ok('G7 未升级 Schema 版本常量', M.SCHEMA_VERSION === 5);

console.log('');
console.log('==== P1-RC-DB 数据底座：PASS ' + pass + ' / FAIL ' + fail + ' ====');
console.log('隔离目录：' + tmp);
process.exit(fail === 0 ? 0 : 1);
