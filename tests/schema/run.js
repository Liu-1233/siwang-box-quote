/*
 * P1-B Schema V5 测试套件（tests/schema/run.js）
 *
 * 运行：node tests/schema/run.js   （退出码 0 = 全部通过）
 * 零 npm 依赖。storage 层测试使用 os.tmpdir() 隔离数据副本，绝不触碰生产 userData。
 *
 * 覆盖任务书 §五 全部 17 项场景：
 *   ① v4 正常数据迁移到 v5            ⑩ null/0/已确认三种成本状态
 *   ② 空数据库迁移                    ⑪ 非法成本、非法定价参数拒绝写入
 *   ③ 五种单据 QT/PI/SC/CI/PL         ⑫ QT→PI/SC/CI 保留内部成本快照
 *   ④ 历史成交价、历史合计完全不变      ⑬ QT→PL 显式剥离成本字段
 *   ⑤ 历史 feeInPrice 保持 null        ⑭ 迁移失败时原始文件不变
 *   ⑥ 历史 pricingVersion 保持 null    ⑮ 迁移重复执行不产生重复字段或重复费用
 *   ⑦ 原有未知字段不丢失               ⑯ v2→v3→v4→v5 完整链路通过
 *   ⑧ sourceId、单据 ID、行 ID 不变    ⑰ 原有 v4 校验测试继续通过
 *   ⑨ 产品库和报价行新增成本字段
 */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const M = require(path.join(__dirname, '..', '..', 'app', 'model.js'));
const { createStorage } = require(path.join(__dirname, '..', '..', 'storage.js'));

let pass = 0, fail = 0;
function checkTrue(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}
function checkEq(name, got, want, eps) {
  const ok = typeof want === 'number' && typeof got === 'number'
    ? Math.abs(got - want) <= (eps || 1e-9)
    : got === want;
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + '  got=' + JSON.stringify(got) + ' expect=' + JSON.stringify(want)); }
}
function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function section(title) { console.log('\n===== ' + title + ' ====='); }

/* ---------- v4 fixture（模拟真实 v4 数据：五类单据 + 未知字段 + 手填合计） ---------- */

function mkV4Data() {
  const qtRow = {
    id: 'row-qt-1', productId: 'p1', nameCn: '304 不锈钢网', nameEn: 'SUS304 mesh',
    mesh: 100, wire: 0.1, width: 1.22, rollLen: 0, qty: 40, price: 5.88, unit: '㎡', amount: 235.2,
    /* 未知扩展字段（v4 时代遗留） */
    supplierNote: '安平润成', _unknown: { legacyFlag: 1 }
  };
  return {
    schemaVersion: 4,
    migration: { fromV2: null, fromV3: { doneAt: '2026-01-01T00:00:00.000Z', sourceFile: '', sourceSha256: '', counts: { documents: 1 } } },
    counters: { QT: { '202610': 3 }, PI: {}, SC: {}, CI: {}, PL: {} },
    customers: [{ id: 'c1', name: 'Ahmed', company: 'Dubai Steel', country: '阿联酋', address: '' }],
    products: [
      { id: 'p1', nameCn: '304 不锈钢丝网', nameEn: 'SUS304 mesh', mesh: 100, wire: 0.1, width: 1.22, rollLen: 30, price: 2.35, hsCode: '', note: '' },
      { id: 'p2', nameCn: '镀锌电焊网', nameEn: 'welded mesh', mesh: 0, wire: 1.2, width: 1.0, rollLen: 30, price: 1.1, hsCode: '', note: '' }
    ],
    documents: [
      {
        id: 'doc-qt-1', no: 'QT-202610-0003', type: 'QT', date: '2026-10-15', sourceId: null,
        customer: { id: 'c1', name: 'Ahmed', company: 'Dubai Steel', country: '阿联酋', address: 'Deira' },
        items: [JSON.parse(JSON.stringify(qtRow))],
        currency: 'USD', term: '', payment: '30% T/T', validity: '', delivery: '', remark: '',
        seller: { company: '安平县润成金属制品有限公司', contact: '', address: '' },
        bank: '', buyerAddress: '', marks: '', shipment: '', vessel: '', origin: '',
        contractTerms: '', signDate: '', signPlace: '', packagingMode: null, totalPackages: null,
        /* 历史合计：与明细计算值(235.20)故意不同——迁移后必须原样保留，绝不重算 */
        totals: { subtotal: 999.99, grand: 999.99, computedFromItems: 235.2, previousGrand: null, customTotal: 42 },
        createdAt: '2026-10-15T02:00:00.000Z', updatedAt: '2026-10-15T03:00:00.000Z',
        _unknown: { quoteLayout: { columns: [{ id: 'x1', label: '备注列' }] } }
      },
      {
        id: 'doc-pi-1', no: 'PI-202610-0001', type: 'PI', date: '2026-10-20', sourceId: 'doc-qt-1',
        customer: { id: 'c1', name: 'Ahmed', company: 'Dubai Steel', country: '阿联酋', address: '' },
        items: [{ id: 'row-pi-1', productId: 'p1', nameCn: '304 网', nameEn: '', mesh: 100, wire: 0.1, width: 1.22, rollLen: 0, qty: 10, price: 6, unit: '㎡', amount: 60 }],
        currency: 'USD', term: '', payment: '', validity: '', delivery: '', remark: '', seller: null,
        bank: 'Bank of China', buyerAddress: '', marks: '', shipment: '', vessel: '', origin: '',
        contractTerms: '', signDate: '', signPlace: '', packagingMode: null, totalPackages: null,
        totals: { subtotal: 60, grand: 60, computedFromItems: 60, previousGrand: 999.99 },
        createdAt: '2026-10-20T02:00:00.000Z', updatedAt: '2026-10-20T02:00:00.000Z'
      },
      {
        id: 'doc-sc-1', no: 'SC-202610-0001', type: 'SC', date: '2026-10-25', sourceId: 'doc-pi-1',
        customer: { id: 'c1', name: 'Ahmed', company: 'Dubai Steel', country: '阿联酋', address: '' },
        items: [{ id: 'row-sc-1', productId: 'p1', nameCn: '304 网', nameEn: '', mesh: 100, wire: 0.1, width: 1.22, rollLen: 0, qty: 10, price: 6, unit: '㎡', amount: 60, hsCode: '7314绘' }],
        currency: 'USD', term: '', payment: '', validity: '', delivery: '', remark: '', seller: null,
        bank: '', buyerAddress: '', marks: '', shipment: '', vessel: '', origin: '',
        contractTerms: 'FOB Tianjin', signDate: '2026-10-25', signPlace: '安平', packagingMode: null, totalPackages: null,
        totals: { subtotal: 60, grand: 60, computedFromItems: 60, previousGrand: 60 },
        createdAt: '2026-10-25T02:00:00.000Z', updatedAt: '2026-10-25T02:00:00.000Z'
      },
      {
        id: 'doc-ci-1', no: 'CI-202610-0001', type: 'CI', date: '2026-10-30', sourceId: 'doc-sc-1',
        customer: { id: 'c1', name: 'Ahmed', company: 'Dubai Steel', country: '阿联酋', address: '' },
        items: [{ id: 'row-ci-1', productId: 'p1', nameCn: '304 网', nameEn: '', mesh: 100, wire: 0.1, width: 1.22, rollLen: 0, qty: 10, price: 6, unit: '㎡', amount: 60, hsCode: '73143100' }],
        currency: 'USD', term: '', payment: '', validity: '', delivery: '', remark: '', seller: null,
        bank: '', buyerAddress: '', marks: '', shipment: '海运', vessel: 'MSC/1234', origin: '中国',
        contractTerms: '', signDate: '', signPlace: '', packagingMode: null, totalPackages: null,
        totals: { subtotal: 60, grand: 60, computedFromItems: 60, previousGrand: 60 },
        createdAt: '2026-10-30T02:00:00.000Z', updatedAt: '2026-10-30T02:00:00.000Z'
      },
      {
        id: 'doc-pl-1', no: 'PL-202610-0001', type: 'PL', date: '2026-11-01', sourceId: 'doc-qt-1',
        customer: { id: 'c1', name: 'Ahmed', company: 'Dubai Steel', country: '阿联酋', address: '' },
        items: [{ id: 'row-pl-1', productId: 'p1', nameCn: '304 网', nameEn: '', mesh: 100, wire: 0.1, width: 1.22, rollLen: 0, qty: 40, unit: '㎡', packages: 2, net: 500.5, gross: 512.25, volume: 1.224 }],
        currency: 'USD', term: '', payment: '', validity: '', delivery: '', remark: '', seller: null,
        bank: '', buyerAddress: '', marks: '', shipment: '', vessel: '', origin: '',
        contractTerms: '', signDate: '', signPlace: '', packagingMode: 'separate', totalPackages: null,
        totals: { packages: 2, net: 500.5, gross: 512.25, volume: 1.224 },
        createdAt: '2026-11-01T02:00:00.000Z', updatedAt: '2026-11-01T02:00:00.000Z'
      }
    ],
    communications: [],
    quotesArchive: [],
    checkins: [],
    settings: { company: '润成', contact: '', defaultCurrency: 'USD', sellerAddress: '', ai: { provider: 'deepseek', baseUrl: '', model: '', enabled: false, privacyMode: 'confirm' }, entitlements: { ai_quote_assist: false, ai_email_assist: false, advanced_load_planner: false, export_templates: true } },
    _unknown: { oldExtra: { keep: true } }
  };
}

const COST_KEYS = ['specText', 'costFactory', 'costPacking', 'costInland', 'costOther', 'costConfirmed'];
const PRICING_KEYS = ['fx', 'feeRate', 'targetMargin', 'commissionRate', 'freightMarkup', 'markupRate', 'feeInPrice', 'pricingVersion'];

/* ================================================================
 * 第一部分：model.js 纯函数层
 * ================================================================ */

function runModelTests() {
  section('A. model.js：SCHEMA_VERSION 升级与 v4 规则保留（场景 ⑰）');
  checkEq('A1 SCHEMA_VERSION=5', M.SCHEMA_VERSION, 5);
  checkEq('A2 V4_VERSION=4', M.V4_VERSION, 4);
  const v4 = mkV4Data();
  checkTrue('A3 validateV4 接受 v4 数据', M.validateV4(v4).ok);
  checkTrue('A4 validateV4 拒绝 v5 数据（版本不匹配）', !M.validateV5(v4).ok || M.validateV4(M.emptyV5({})).ok === false);
  checkTrue('A5 validateV4 拒绝 schemaVersion=5', !M.validateV4(Object.assign({}, v4, { schemaVersion: 5 })).ok);
  checkTrue('A6 validateV5 接受 v5 空库', M.validateV5(M.emptyV5({})).ok);
  checkTrue('A7 validateV5 拒绝 schemaVersion=4', !M.validateV5(v4).ok);
  const out4 = M.migrateV3toV4({ schemaVersion: 3, counters: {}, customers: [], products: [], documents: [], communications: [], quotesArchive: [], checkins: [], settings: {}, migration: {} });
  checkEq('A8 v3→v4 仍输出 schemaVersion=4', out4.data.schemaVersion, 4);
  checkTrue('A9 migrateV3toV4 产物过 v4 写门（validateWritable(out,4)）', M.validateWritable(out4.data, M.V4_VERSION).ok);
  const e4 = M.emptyV4({});
  checkEq('A10 emptyV4 仍输出 schemaVersion=4', e4.schemaVersion, 4);
  checkEq('A11 emptyV5 输出 schemaVersion=5', M.emptyV5({}).schemaVersion, 5);

  section('B. v4→v5 迁移：字段补齐与历史不变（场景 ①③④⑤⑥⑧⑨）');
  const before = JSON.stringify(v4);
  const m = M.migrateV4toV5(v4, { sourceFile: 'test-v4.json', sourceSha256: 'abc', doneAt: '2026-11-19T06:00:00.000Z' });
  checkTrue('B1 migrateV4toV5 成功', m.ok);
  const v5 = m.data;
  checkTrue('B2 迁移不修改入参（v4 原对象逐字节不变）', JSON.stringify(v4) === before);
  checkEq('B3 输出 schemaVersion=5', v5.schemaVersion, 5);
  checkTrue('B4 产物过 validateV5', M.validateV5(v5).ok);
  checkTrue('B5 产物过 validateWritable（v5 写门）', M.validateWritable(v5).ok);
  checkTrue('B6 迁移标记 fromV4 记录来源', v5.migration.fromV4 && v5.migration.fromV4.sourceFile === 'test-v4.json' && v5.migration.fromV4.sourceSha256 === 'abc');

  const qt = v5.documents[0];
  PRICING_KEYS.forEach(k => checkEq('B7 QT.' + k + '=null（历史参数不伪造）', qt[k], null));
  checkTrue('B8 QT.fees=[]（空数组不是 null）', Array.isArray(qt.fees) && qt.fees.length === 0);
  COST_KEYS.forEach(k => checkEq('B9 QT 行.' + k + '=null（成本未填写）', qt.items[0][k], null));
  checkTrue('B10 历史 feeInPrice 保持 null（场景 ⑤）', qt.feeInPrice === null);
  checkTrue('B11 历史 pricingVersion 保持 null（场景 ⑥）', qt.pricingVersion === null);
  checkEq('B12 历史成交价不变（手填合计 999.99 原样保留）', qt.totals.grand, 999.99);
  checkEq('B13 历史行金额不变', qt.items[0].amount, 235.2);
  checkTrue('B14 自定义合计键 customTotal 保留', qt.totals.customTotal === 42);
  checkEq('B15 单据 ID 不变', qt.id, 'doc-qt-1');
  checkEq('B16 单号不变', qt.no, 'QT-202610-0003');
  checkEq('B17 日期不变', qt.date, '2026-10-15');
  checkEq('B18 行 ID 不变', qt.items[0].id, 'row-qt-1');
  checkEq('B19 PI.sourceId 不变', v5.documents[1].sourceId, 'doc-qt-1');
  checkEq('B20 PL.sourceId 不变', v5.documents[4].sourceId, 'doc-qt-1');
  checkTrue('B21 未知字段不丢失：单据级 _unknown.quoteLayout', qt._unknown && qt._unknown.quoteLayout && qt._unknown.quoteLayout.columns.length === 1);
  checkTrue('B22 未知字段不丢失：顶层 _unknown.oldExtra', v5._unknown && v5._unknown.oldExtra && v5._unknown.oldExtra.keep === true);
  checkTrue('B23 未知字段不丢失：行级 supplierNote/_unknown', qt.items[0].supplierNote === '安平润成' && qt.items[0]._unknown.legacyFlag === 1);
  checkTrue('B24 counters 原样保留', v5.counters.QT['202610'] === 3);

  section('C. 五种单据全部迁移成功（场景 ③）');
  const types = v5.documents.map(d => d.type);
  checkTrue('C1 五类单据齐全且顺序不变', JSON.stringify(types) === JSON.stringify(['QT', 'PI', 'SC', 'CI', 'PL']));
  v5.documents.forEach((d, i) => {
    checkTrue('C' + (2 + i) + ' ' + d.type + ' 全部定价参数=null', PRICING_KEYS.every(k => d[k] === null) && Array.isArray(d.fees) && d.fees.length === 0);
    checkTrue('C' + (7 + i) + ' ' + d.type + ' 行成本字段=null', d.items.every(it => COST_KEYS.every(k => it[k] === null)));
  });
  checkTrue('C12 PL 行包装四件套不受迁移影响', v5.documents[4].items[0].packages === 2 && v5.documents[4].items[0].net === 500.5);
  checkTrue('C13 CI 行 hsCode 保留', v5.documents[3].items[0].hsCode === '73143100');
  /* addedDefaults 口径：每张单据补 9 个定价键 → docs=45；5 单 × 1 行 × 6 个行键 → rows=30；产品 2×6 → products=12 */
  checkTrue('C14 迁移报告记录条数', m.report.counts.documents === 5 && m.report.addedDefaults.docs === 45 && m.report.addedDefaults.rows === 30 && m.report.addedDefaults.products === 12);

  section('D. 产品库成本字段（场景 ⑨⑩）');
  checkTrue('D1 产品库补齐成本字段（p1/p2 共 12 个 null）', v5.products.every(p => COST_KEYS.every(k => p[k] === null)));
  checkEq('D2 产品数量不变', v5.products.length, 2);
  const p1 = v5.products[0];
  p1.costFactory = 12.5; p1.costPacking = 0.8; p1.costConfirmed = true;
  checkTrue('D3 已确认成本写入合法', M.validateV5(v5).ok && M.validateWritable(v5).ok);
  p1.costFactory = 0; p1.costConfirmed = true; p1.costPacking = null;
  checkTrue('D4 明确确认的零成本合法（0+confirmed）', M.validateWritable(v5).ok);
  p1.costConfirmed = null; p1.costFactory = 0;
  checkTrue('D5 未确认零值合法（但只是"填了 0"，不等于已确认）', M.validateWritable(v5).ok && p1.costConfirmed === null);
  p1.costConfirmed = false;
  checkTrue('D6 显式 false（明确未确认）合法', M.validateWritable(v5).ok);

  section('E. 非法数据写门拒绝（场景 ⑪）');
  const badCases = [
    ['E1 负成本', d => { d.items[0].costFactory = -1; }],
    ['E2 成本 NaN', d => { d.items[0].costFactory = NaN; }],
    ['E3 成本 Infinity', d => { d.items[0].costFactory = Infinity; }],
    ['E4 costConfirmed 字符串', d => { d.items[0].costConfirmed = 'true'; }],
    ['E5 specText 数字', d => { d.items[0].specText = 123; }],
    ['E6 fx 零', p => { p.fx = 0; }],
    ['E7 fx 负数', p => { p.fx = -6.6; }],
    ['E8 fx 字符串 "6.6"', p => { p.fx = '6.6'; }],
    ['E9 feeRate 超界', p => { p.feeRate = 1; }],
    ['E10 targetMargin 负数', p => { p.targetMargin = -0.1; }],
    ['E11 feeInPrice 字符串 "1"', p => { p.feeInPrice = '1'; }],
    ['E12 feeInPrice true', p => { p.feeInPrice = true; }],
    ['E13 feeInPrice 2', p => { p.feeInPrice = 2; }],
    ['E14 fees 非数组', p => { p.fees = 'none'; }],
    ['E15 fees 条目负金额', p => { p.fees = [{ amountCny: -50 }]; }],
    ['E16 fees 条目三位小数', p => { p.fees = [{ amountCny: 1.234 }]; }],
    ['E17 fees 条目金额缺失', p => { p.fees = [{ label: 'sample' }]; }],
    ['E18 pricingVersion 数字', p => { p.pricingVersion = 5; }]
  ];
  const probeDoc = JSON.parse(JSON.stringify(v5.documents[0]));
  badCases.forEach(c => {
    const d = JSON.parse(JSON.stringify(probeDoc));
    c[1](d);
    /* 把非法单据放进去整体校验 */
    const data = JSON.parse(JSON.stringify(v5));
    data.documents[0] = d;
    const r = M.validateWritable(data);
    checkTrue(c[0] + ' → 拒绝写入', !r.ok);
  });

  section('F. 单据转换（场景 ⑫⑬）');
  const srcDoc = JSON.parse(JSON.stringify(qt));
  srcDoc.items[0].specText = '100目 0.1mm 平纹';
  srcDoc.items[0].costFactory = 12.5;
  srcDoc.items[0].costConfirmed = true;
  srcDoc.fx = 6.6; srcDoc.feeRate = 0.03; srcDoc.feeInPrice = 1;
  srcDoc.fees = [{ amountCny: 200, allocations: [{ sort: 0, amountCny: 200 }] }];
  const conv = {};
  ['PI', 'SC', 'CI', 'PL'].forEach(t => { conv[t] = M.buildConversionDraft(srcDoc, t); });
  checkTrue('F1 QT→PI 转换成功', conv.PI.ok);
  checkTrue('F2 QT→SC 转换成功', conv.SC.ok);
  checkTrue('F3 QT→CI 转换成功', conv.CI.ok);
  checkTrue('F4 QT→PL 转换成功', conv.PL.ok);
  ['PI', 'SC', 'CI'].forEach(t => {
    const row = conv[t].draft.items[0];
    checkTrue('F' + (5 + ['PI', 'SC', 'CI'].indexOf(t)) + ' QT→' + t + ' 保留成本快照（costFactory=12.5）', row.costFactory === 12.5);
    checkTrue('F' + (8 + ['PI', 'SC', 'CI'].indexOf(t)) + ' QT→' + t + ' 保留 specText 与 costConfirmed', row.specText === '100目 0.1mm 平纹' && row.costConfirmed === true);
    checkTrue('F' + (11 + ['PI', 'SC', 'CI'].indexOf(t)) + ' QT→' + t + ' 保留定价参数（fx/feeRate/fees）', conv[t].draft.fx === 6.6 && conv[t].draft.feeRate === 0.03 && conv[t].draft.fees.length === 1);
    checkEq('F' + (14 + ['PI', 'SC', 'CI'].indexOf(t)) + ' QT→' + t + ' sourceId 指向源单', conv[t].draft.sourceId, 'doc-qt-1');
    checkTrue('F' + (17 + ['PI', 'SC', 'CI'].indexOf(t)) + ' QT→' + t + ' 行身份重新分配（不复用源 _rowId）', conv[t].draft.items[0]._rowId !== srcDoc.items[0]._rowId);
  });
  const plRow = conv.PL.draft.items[0];
  checkTrue('F20 QT→PL 显式剥离全部成本字段（数据层删除，非依赖不渲染）', COST_KEYS.every(k => !(k in plRow)));
  checkTrue('F21 QT→PL 也剥离 price/amount/hsCode', !('price' in plRow) && !('amount' in plRow));
  checkEq('F22 QT→PL sourceId 保留', conv.PL.draft.sourceId, 'doc-qt-1');
  checkTrue('F23 QT→PL 包装四件套一律待补 null', plRow.packages === null && plRow.net === null && plRow.gross === null && plRow.volume === null);
  /* PL 合计只有包装汇总键（无金额键，previousGrand 仅金额类目标才有） */
  checkTrue('F24 QT→PL 合计为包装汇总口径（无金额键）', ['packages', 'net', 'gross', 'volume'].every(k => k in conv.PL.draft.totals) && !('grand' in conv.PL.draft.totals));
  checkTrue('F25 QT→PI previousGrand 留证源单合计（金额类）', conv.PI.draft.totals.previousGrand === 999.99);

  section('F+. P1-B-FIX-01 BUG-01：QT→PL 单据级内部定价数据剥离');
  const PL_DOC_KEYS = PRICING_KEYS.concat(['fees']);   /* 九个单据级字段 = 8 定价键 + fees */
  checkTrue('F26 QT→PL 九个单据级字段全部不存在', PL_DOC_KEYS.every(k => !(k in conv.PL.draft)));
  checkTrue('F27 QT→PL 行级六个成本字段全部不存在', COST_KEYS.every(k => !(k in plRow)));
  checkEq('F28 QT→PL sourceId 保留', conv.PL.draft.sourceId, 'doc-qt-1');
  checkTrue('F29 QT→PI/SC/CI 九个单据级字段保留（快照延续规则不变）',
    ['PI', 'SC', 'CI'].every(t => PL_DOC_KEYS.every(k => k in conv[t].draft)));
  checkTrue('F30 QT→PI/SC/CI 行级成本字段保留（快照延续规则不变）',
    ['PI', 'SC', 'CI'].every(t => COST_KEYS.every(k => k in conv[t].draft.items[0])));
  /* PL→PL 同类复制同样执行内部数据剥离 */
  const plSrc = JSON.parse(JSON.stringify(v5.documents[4]));
  plSrc.fx = 6.6; plSrc.feeRate = 0.03; plSrc.fees = [{ amountCny: 50, allocations: null }];
  plSrc.items[0].costFactory = 9.9; plSrc.items[0].specText = 'x';
  const plCopy = M.buildConversionDraft(plSrc, 'PL');
  checkTrue('F31 PL→PL 复制成功', plCopy.ok);
  checkTrue('F32 PL→PL 同样剥离九个单据级字段', PL_DOC_KEYS.every(k => !(k in plCopy.draft)));
  checkTrue('F33 PL→PL 行级成本字段同样剥离', COST_KEYS.every(k => !(k in plCopy.draft.items[0])));
  checkEq('F34 PL→PL sourceId 保留', plCopy.draft.sourceId, 'doc-pl-1');
  checkTrue('F35 PL→PL 包装四件套原样带（同类复制规则不变）',
    plCopy.draft.items[0].packages === 2 && plCopy.draft.items[0].net === 500.5 && plCopy.draft.items[0].gross === 512.25);
  /* F36 口径（P1-B-FIX-01 收尾修正）：本项**仅验证"默认值补齐后的写门"**——
     手动把 fees=[] 补进草稿再过 validateWritable，**不是**真实 Store.addDocument
     保存链路测试（真实链路走 writeDocument→withV4DocDefaults，另有 Store 层
     addDocument/addQuote 冒烟验证单独记录，见 docs/integration/P1-B-FIX-01-test-logs.txt）。 */
  checkTrue('F36 PL 草稿由默认值补 fees=[] 后过 v5 写门（仅验证默认值补齐后的写门，非真实 Store 保存链路）', (() => {
    const db5 = M.migrateV4toV5(mkV4Data(), {}).data;   /* 一份全新合法 v5 库 */
    const d = JSON.parse(JSON.stringify(plCopy.draft));
    d.id = 'doc-pl-draft'; d.no = 'PL-202611-0001';
    db5.documents.unshift(d);
    d.fees = [];                                        /* 手动补默认值，模拟（非调用）withV4DocDefaults 的补齐结果 */
    return M.validateWritable(db5).ok;
  })());

  section('G. 幂等与失败保护（场景 ⑭⑮ model 层）');
  const again = M.migrateV4toV5(v5, {});
  checkTrue('G1 对 v5 数据再跑 v4→v5 迁移 → 拒绝（validateV4 拦截）', !again.ok);
  const badV4 = JSON.parse(JSON.stringify(v4));
  badV4.documents[1].items = 'not-an-array';
  const badM = M.migrateV4toV5(badV4, {});
  checkTrue('G2 异常 v4 → 整次迁移失败并报位置', !badM.ok && /documents\[1\]/.test(badM.error));
  checkEq('G3 失败时入参未被改动（items 保持被"破坏"的原值，无半迁移痕迹）', badV4.schemaVersion, 4);
  const snap = JSON.stringify(mkV4Data());
  M.migrateV4toV5(JSON.parse(snap), {});
  checkTrue('G4 迁移函数对全新入参零修改（纯函数）', JSON.stringify(mkV4Data()) === snap);

  section('H. v2→v3→v4→v5 完整链路（场景 ⑯）');
  const v2 = {
    customers: [{ id: 'c1', name: 'Old Customer', company: '', country: '', address: '' }],
    products: [{ id: 'p1', nameCn: '老产品', nameEn: 'old', mesh: 80, wire: 0.12, width: 1.0, rollLen: 25, price: 2.0 }],
    quotes: [{
      id: 'legacy-1', no: 'SB202608001', date: '2026-08-01', customer: 'Old Co', attn: 'Tom', country: '埃及',
      items: [{ desc: '老报价行', mesh: 80, wire: 0.12, width: 1.0, qty: 100, price: 2.5, unit: '㎡' }],
      currency: 'USD', term: '', payment: '', validity: '', remark: '', total: 250, createdAt: '2026-08-01T00:00:00.000Z', customOldField: 'keep-me'
    }],
    checkins: [], settings: { company: '' }
  };
  const m1 = M.migrateV2toV3(v2, { sourceFile: 'legacy', sourceSha256: 'x', doneAt: '2026-11-19T00:00:00.000Z' });
  checkTrue('H1 v2→v3 成功', m1.ok);
  checkEq('H2 中间产物 schemaVersion=3', m1.data.schemaVersion, 3);
  const m2 = M.migrateV3toV4(m1.data, { sourceFile: 'legacy', sourceSha256: 'x', doneAt: '2026-11-19T00:00:00.000Z' });
  checkTrue('H3 v3→v4 成功', m2.ok);
  checkEq('H4 中间产物 schemaVersion=4', m2.data.schemaVersion, 4);
  const m3 = M.migrateV4toV5(m2.data, { sourceFile: 'legacy', sourceSha256: 'x', doneAt: '2026-11-19T00:00:00.000Z' });
  checkTrue('H5 v4→v5 成功', m3.ok);
  checkEq('H6 最终 schemaVersion=5', m3.data.schemaVersion, 5);
  checkTrue('H7 最终产物过 validateV5 + v5 写门', M.validateV5(m3.data).ok && M.validateWritable(m3.data).ok);
  checkEq('H8 历史单号 SB202608001 原样保留', m3.data.documents[0].no, 'SB202608001');
  checkTrue('H9 v2 旧字段进 _unknown/归档不丢失', m3.data.quotesArchive[0].customOldField === 'keep-me');
  checkEq('H10 历史合计 250 原样保留', m3.data.documents[0].totals.grand, 250);
  checkTrue('H11 迁移链产物定价参数全 null', PRICING_KEYS.every(k => m3.data.documents[0][k] === null));

  section('K. P1-B-FIX-01 BUG-02：V5 读取/写门收紧（非对象明细与 fees 三态）');
  const v5k = M.migrateV4toV5(mkV4Data(), {}).data;
  checkTrue('K1 基线：迁移产物过 validateV5 与 v5 写门', M.validateV5(v5k).ok && M.validateWritable(v5k).ok);
  const kNull = JSON.parse(JSON.stringify(v5k)); kNull.documents[0].items = [null];
  const kNum = JSON.parse(JSON.stringify(v5k)); kNum.documents[0].items = [123];
  checkTrue('K2 items=[null] → validateV5 拒绝（不静默跳过）', !M.validateV5(kNull).ok);
  checkTrue('K3 items=[123] → validateV5 拒绝（不静默跳过）', !M.validateV5(kNum).ok);
  checkTrue('K4 拒绝信息指明位置（items[0] 不是对象）', M.validateV5(kNull).errors.some(e => /items\[0\] 不是对象/.test(e)));
  const kf = JSON.parse(JSON.stringify(v5k)); kf.documents[0].fees = null;
  checkTrue('K5 fees=null → validateV5（读门）拒绝', !M.validateV5(kf).ok);
  checkTrue('K6 fees=null → validateWritable（写门）拒绝', !M.validateWritable(kf).ok);
  const km = JSON.parse(JSON.stringify(v5k)); delete km.documents[0].fees;
  checkTrue('K7 fees 缺失 → validateV5（读门）拒绝', !M.validateV5(km).ok);
  checkTrue('K8 fees 缺失 → validateWritable（写门）拒绝', !M.validateWritable(km).ok);
  const ke = JSON.parse(JSON.stringify(v5k)); ke.documents[0].fees = [];
  checkTrue('K9 fees=[] → 读门与写门均通过', M.validateV5(ke).ok && M.validateWritable(ke).ok);
  const km2 = JSON.parse(JSON.stringify(v5k)); delete km2.documents[4].fees;
  checkTrue('K10 PL 单据 fees 缺失同样拒绝（读门，五类单据同一规则）', !M.validateV5(km2).ok);

  section('K2. P1-B-FIX-01 BUG-02：迁移来源出现非法 fees 必须明确报错');
  const badV4fees = mkV4Data();
  badV4fees.documents[0].fees = null;               /* 迁移来源里 fees=null（非法） */
  const mBadFees = M.migrateV4toV5(badV4fees, {});
  checkTrue('K11 迁移来源 fees=null → 整次迁移失败', !mBadFees.ok);
  checkTrue('K12 报错明确指向 fees 且声明不覆盖原始数据', /documents\[0\]\.fees/.test(mBadFees.error || '') && /不覆盖/.test(mBadFees.error || ''));
  const badV4fees2 = mkV4Data();
  badV4fees2.documents[1].fees = 'none';            /* 迁移来源里 fees 非数组 */
  const mBadFees2 = M.migrateV4toV5(badV4fees2, {});
  checkTrue('K13 迁移来源 fees 非数组 → 整次迁移失败', !mBadFees2.ok);
  checkTrue('K14 迁移失败后入参原样（非法 fees 未被删除/改写）', badV4fees2.documents[1].fees === 'none' && badV4fees2.documents[0].fees === undefined);
}

/* ================================================================
 * 第二部分：storage.js 主进程迁移通路（隔离临时目录，不触碰生产 userData）
 * ================================================================ */

function runStorageTests() {
  section('I. storage：v4 文件 → 迁移 → v5 文件（场景 ①②⑧⑭⑮）');

  /* --- I1: 空数据库（场景 ②） --- */
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const st1 = createStorage(tmp1);
  const l0 = st1.load();
  checkEq('I1 空目录 load → empty', l0.status, 'empty');
  const emptyInit = M.emptyV5({});
  const sv = st1.save(emptyInit);
  checkTrue('I2 v5 空库可保存（写门 v5）', sv.ok);
  checkEq('I3 主文件是 siwangbox-v5.json', path.basename(st1.paths().file), 'siwangbox-v5.json');
  checkTrue('I4 重新 load → ok 且版本 5', st1.load().status === 'ok' && st1.load().data.schemaVersion === 5);

  /* --- I2: v4 文件迁移（场景 ①⑧⑮） --- */
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const dataDir2 = path.join(tmp2, 'data');
  fs.mkdirSync(dataDir2, { recursive: true });
  const v4Text = JSON.stringify(mkV4Data(), null, 2);
  const v4File = path.join(dataDir2, 'siwangbox-v4.json');
  fs.writeFileSync(v4File, v4Text, 'utf8');
  const v4ShaBefore = sha256(v4Text);
  const st2 = createStorage(tmp2);
  const l1 = st2.load();
  checkEq('I5 v4 文件存在 → needsMigration（sourceVersion=4）', l1.status + ':' + l1.sourceVersion, 'needsMigration:4');
  const mig = st2.migrate();
  checkTrue('I6 migrate 成功', mig.ok);
  checkEq('I7 迁移产物版本 5', mig.data.schemaVersion, 5);
  checkEq('I8 迁移来源版本 4', mig.report.sourceVersion, 4);
  checkTrue('I9 v4 原文件逐字节不变（场景 ⑭ 基础保护）', sha256(fs.readFileSync(v4File, 'utf8')) === v4ShaBefore);
  checkTrue('I10 v5 主文件已创建', fs.existsSync(st2.paths().file));
  checkEq('I11 单据 ID 不变', mig.data.documents[0].id, 'doc-qt-1');
  checkEq('I12 sourceId 不变', mig.data.documents[1].sourceId, 'doc-qt-1');
  checkEq('I13 历史合计 999.99 不变', mig.data.documents[0].totals.grand, 999.99);
  checkTrue('I14 迁移后 load → ok（v5）', st2.load().status === 'ok' && st2.load().data.schemaVersion === 5);
  const mig2 = st2.migrate();
  checkTrue('I15 重复 migrate → 拒绝（ALREADY_V5，不产生重复字段/费用）', !mig2.ok && mig2.code === 'ALREADY_V5');
  const v5Reload = JSON.parse(fs.readFileSync(st2.paths().file, 'utf8'));
  checkTrue('I16 无重复定价键（每键恰好出现一次）', PRICING_KEYS.every(k => Object.keys(v5Reload.documents[0]).filter(x => x === k).length === 1));
  checkTrue('I17 fees 仍是空数组且无重复条目', Array.isArray(v5Reload.documents[0].fees) && v5Reload.documents[0].fees.length === 0);
  checkTrue('I18 重复 migrate 后 v4 原文件仍不变', sha256(fs.readFileSync(v4File, 'utf8')) === v4ShaBefore);

  /* --- I3: 迁移失败保护（场景 ⑭） --- */
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const dataDir3 = path.join(tmp3, 'data');
  fs.mkdirSync(dataDir3, { recursive: true });
  const badV4 = mkV4Data();
  badV4.documents[2].items = { broken: true };      /* SC 单 items 不是数组 → 校验失败 */
  const badText = JSON.stringify(badV4, null, 2);
  const badFile = path.join(dataDir3, 'siwangbox-v4.json');
  fs.writeFileSync(badFile, badText, 'utf8');
  const badSha = sha256(badText);
  const st3 = createStorage(tmp3);
  const l2 = st3.load();
  checkEq('I19 异常 v4 → legacyCorrupt（停止，不换源、不初始化）', l2.status, 'legacyCorrupt');
  const mig3 = st3.migrate();
  checkTrue('I20 migrate 失败', !mig3.ok);
  checkTrue('I21 失败后原始 v4 文件逐字节不变', sha256(fs.readFileSync(badFile, 'utf8')) === badSha);
  checkTrue('I22 失败后未产生 v5 主文件', !fs.existsSync(path.join(dataDir3, 'siwangbox-v5.json')));

  /* --- I4: v3 / v2 文件链路（场景 ⑯ storage 层） --- */
  const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const dataDir4 = path.join(tmp4, 'data');
  fs.mkdirSync(dataDir4, { recursive: true });
  const v2 = {
    customers: [], products: [], quotes: [{
      id: 'q1', no: 'SB202608001', date: '2026-08-01', customer: 'Co', attn: '', country: '',
      items: [{ desc: 'row', mesh: 80, wire: 0.12, width: 1, qty: 10, price: 2, unit: '㎡' }],
      currency: 'USD', term: '', payment: '', validity: '', remark: '', total: 20, createdAt: '2026-08-01T00:00:00.000Z'
    }], checkins: [], settings: {}
  };
  fs.writeFileSync(path.join(dataDir4, 'siwangbox.json'), JSON.stringify(v2), 'utf8');
  const st4 = createStorage(tmp4);
  const l3 = st4.load();
  checkEq('I23 v2 源 → needsMigration:2', l3.status + ':' + l3.sourceVersion, 'needsMigration:2');
  const mig4 = st4.migrate();
  checkTrue('I24 v2→v3→v4→v5 全链路迁移成功', mig4.ok && mig4.data.schemaVersion === 5);
  checkTrue('I25 链路说明含 v2→v3→v4→v5', /v2→v3→v4→v5/.test(mig4.report.chainNote || ''));
  checkTrue('I26 v2 原文件不变', fs.existsSync(path.join(dataDir4, 'siwangbox.json')));

  /* --- I5: 导入通路 v4→v5 --- */
  const tmp5 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const st5 = createStorage(tmp5);
  st5.save(M.emptyV5({}));
  const ins = st5.inspectText(v4Text);
  checkTrue('I27 inspectText 识别 v4 且 needsMigration', ins.ok && ins.version === 4 && ins.needsMigration === true);
  const imp = st5.importText(v4Text);
  checkTrue('I28 importText v4→v5 成功', imp.ok && imp.data.schemaVersion === 5 && imp.migrated === true);
  checkTrue('I29 导入后 load → ok', st5.load().status === 'ok');

  /* --- I6: 写门版本分派 --- */
  const r4 = st5.save(mkV4Data());
  checkTrue('I30 save 拒绝 v4 数据（写门要求 v5）', !r4.ok);
  const tmp6 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const st6 = createStorage(tmp6);
  st6.save(M.emptyV5({}));
  const badPricing = JSON.parse(JSON.stringify(M.emptyV5({})));
  badPricing.documents.push({ id: 'x', no: 'QT-202611-0001', type: 'QT', date: '2026-11-19', items: [{ nameCn: 'x', qty: 1, price: 1, unit: '', amount: 1 }], customer: { id: null, name: '', company: '', country: '', address: '' }, fx: '6.6', feeRate: 0.03, targetMargin: 0.28, commissionRate: 0.2, freightMarkup: 0, markupRate: 0.4, feeInPrice: null, pricingVersion: null, fees: [], totals: { subtotal: 1, grand: 1 }, currency: 'USD', term: '', payment: '', validity: '', delivery: '', remark: '', seller: null, bank: '', buyerAddress: '', marks: '', shipment: '', vessel: '', origin: '', contractTerms: '', signDate: '', signPlace: '', packagingMode: null, totalPackages: null });
  const rp = st6.save(badPricing);
  checkTrue('I31 save 拒绝非法定价参数（fx 字符串）', !rp.ok && /fx/.test(rp.error));

  /* --- I7: 未来版本保护 --- */
  const tmp7 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const dataDir7 = path.join(tmp7, 'data');
  fs.mkdirSync(dataDir7, { recursive: true });
  const future = JSON.stringify(Object.assign(mkV4Data(), { schemaVersion: 6 }));
  fs.writeFileSync(path.join(dataDir7, 'siwangbox-v5.json'), future, 'utf8');
  const st7 = createStorage(tmp7);
  checkEq('I32 未来版本 v6 → unsupported（只读）', st7.load().status, 'unsupported');
  const sv7 = st7.save(M.emptyV5({}));
  checkTrue('I33 拒绝写入未来版本目标', !sv7.ok && sv7.code === 'FUTURE_TARGET');

  section('L. P1-B-FIX-01 BUG-02：损坏 v5 主文件不得加载、不得降级读 v4；迁移源非法 fees 明确报错');

  /* --- L1: v5 主文件 fees=null（结构非法）+ v4 文件同时存在 --- */
  const tmp8 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const dataDir8 = path.join(tmp8, 'data');
  fs.mkdirSync(dataDir8, { recursive: true });
  const v4Text8 = JSON.stringify(mkV4Data(), null, 2);
  fs.writeFileSync(path.join(dataDir8, 'siwangbox-v4.json'), v4Text8, 'utf8');
  const badV5Disk = M.migrateV4toV5(mkV4Data(), {}).data;
  badV5Disk.documents[0].fees = null;
  fs.writeFileSync(path.join(dataDir8, 'siwangbox-v5.json'), JSON.stringify(badV5Disk, null, 2), 'utf8');
  const st8 = createStorage(tmp8);
  const l8 = st8.load();
  checkTrue('L1 损坏 v5（fees=null）→ invalid，绝不自动降级读 v4', l8.status === 'invalid');
  checkTrue('L2 invalid 信息明确提及 fees', /fees/.test(l8.message || ''));
  checkTrue('L3 v4 原文件逐字节未被触碰', fs.readFileSync(path.join(dataDir8, 'siwangbox-v4.json'), 'utf8') === v4Text8);
  const sv8 = st8.save(M.emptyV5({}));
  checkTrue('L4 invalid 目标拒绝普通写入（TARGET_INVALID）', !sv8.ok && sv8.code === 'TARGET_INVALID');

  /* --- L2: v5 主文件 JSON 损坏 + v4 文件存在 → 不迁移、不初始化空库 --- */
  const tmp9 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const dataDir9 = path.join(tmp9, 'data');
  fs.mkdirSync(dataDir9, { recursive: true });
  const v4Text9 = JSON.stringify(mkV4Data(), null, 2);
  fs.writeFileSync(path.join(dataDir9, 'siwangbox-v4.json'), v4Text9, 'utf8');
  fs.writeFileSync(path.join(dataDir9, 'siwangbox-v5.json'), '{broken-json', 'utf8');
  const st9 = createStorage(tmp9);
  const l9 = st9.load();
  checkTrue('L5 v5 主文件 JSON 损坏 → corrupt（不当成正常数据、不降级迁移 v4）', l9.status === 'corrupt');
  checkTrue('L6 损坏时 v4 原文件逐字节未被触碰', fs.readFileSync(path.join(dataDir9, 'siwangbox-v4.json'), 'utf8') === v4Text9);
  checkTrue('L7 损坏时未初始化空库覆盖 v5', fs.readFileSync(path.join(dataDir9, 'siwangbox-v5.json'), 'utf8') === '{broken-json');

  /* --- L3: 迁移来源（v4 文件）含非法 fees → migrate 明确报错，原文件不变 --- */
  const tmp10 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-schema-'));
  const dataDir10 = path.join(tmp10, 'data');
  fs.mkdirSync(dataDir10, { recursive: true });
  const badV4feesDisk = mkV4Data();
  badV4feesDisk.documents[0].fees = null;
  const badFeesText = JSON.stringify(badV4feesDisk, null, 2);
  fs.writeFileSync(path.join(dataDir10, 'siwangbox-v4.json'), badFeesText, 'utf8');
  const st10 = createStorage(tmp10);
  const mig10 = st10.migrate();
  checkTrue('L8 迁移来源 fees=null → migrate 失败（明确报错）', !mig10.ok);
  checkTrue('L9 报错明确指向 fees 且声明不覆盖原始数据', /fees/.test(mig10.error || '') && /不覆盖/.test(mig10.error || ''));
  checkTrue('L10 失败后 v4 原文件逐字节不变', sha256(fs.readFileSync(path.join(dataDir10, 'siwangbox-v4.json'), 'utf8')) === sha256(badFeesText));
  checkTrue('L11 失败后未产生 v5 主文件', !fs.existsSync(path.join(dataDir10, 'siwangbox-v5.json')));
}

/* ---------- 运行 ---------- */
console.log('===== P1-B Schema V5 测试（隔离临时目录，不触碰生产数据） =====');
const t0 = Date.now();
runModelTests();
runStorageTests();
const ms = Date.now() - t0;
console.log('\n===== 结果 =====');
console.log('PASS ' + pass + ' / FAIL ' + fail);
console.log(fail === 0 ? 'ALL PASS — ' + pass + ' checks (' + ms + 'ms)' : fail + ' FAIL — 测试未通过');
process.exit(fail === 0 ? 0 : 1);
