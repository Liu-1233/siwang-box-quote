// P1-A 移植对账：润成 V3 原版 TS 实现 vs 丝网盒子移植版 JS 实现（P1-A-FIX-01 起不再硬编码本机路径）
//
// 用法（环境变量配置两个目录，未配置时明确报错退出）：
//   RUNCHENG_V3_DIR=... SIWANG_BOX_DEV_DIR=... \
//     node <tsx cli> tests/pricing/parity-check.ts
//   例：cd $RUNCHENG_V3_DIR && RUNCHENG_V3_DIR=$PWD SIWANG_BOX_DEV_DIR=../siwang-box-0.2.17-dev \
//     node node_modules/tsx/dist/cli.mjs ../siwang-box-0.2.17-dev/tests/pricing/parity-check.ts
import { createRequire } from 'module'
import { resolve } from 'path'
import { existsSync } from 'fs'

const require = createRequire(import.meta.url)

const rcDir = process.env.RUNCHENG_V3_DIR
const sbDir = process.env.SIWANG_BOX_DEV_DIR
if (!rcDir || !sbDir) {
  console.error('缺少路径配置：请设置环境变量 RUNCHENG_V3_DIR（润成 V3 源码目录）与 SIWANG_BOX_DEV_DIR（丝网盒子开发目录）')
  console.error('示例：RUNCHENG_V3_DIR=D:/siwanghezi/baojia/v3 SIWANG_BOX_DEV_DIR=D:/siwanghezi/siwang-box-0.2.17-dev node <tsx> tests/pricing/parity-check.ts')
  process.exit(2)
}
const rcPricing = resolve(rcDir, 'src/pricing')
const sbPricingJs = resolve(sbDir, 'app/pricing.js')
if (!existsSync(rcPricing + '.ts')) { console.error('润成 V3 目录无效：' + rcPricing + '.ts 不存在'); process.exit(2) }
if (!existsSync(sbPricingJs)) { console.error('丝网盒子开发目录无效：' + sbPricingJs + ' 不存在'); process.exit(2) }

const rc: any = require(rcPricing) // tsx 运行时支持 require 加载 TS 模块
const rcCompute = rc.computeQuote
const sb: any = require(sbPricingJs)
const sbCompute = sb.computeQuote

// 场景输入全部显式提供 fee_in_price（P1-A-FIX-01 起引擎对 null/undefined 按未知态阻断，
// 与润成 V3 源码缺省语义的差异由调用方适配层负责——对账场景使用显式合法输入，比较纯计算路径）。
const baseHeader: any = {
  id: 1, quote_no: 'RC-Q-1', pi_no: 'RC-PI-1', status: 'draft',
  customer_id: null, quote_date: '2026-11-17', valid_days: 7,
  fx: 6.7, fee_rate: 0.03, target_margin: 0.175, commission_rate: 0.2,
  freight_markup: 0, incoterm: 'CIF', named_place: 'Nassau, Bahamas',
  payment_terms: '30% T/T deposit, balance before shipment',
  lead_time: '25 days', packaging: '2 plywood crates', exclusions: '',
  deposit_ratio: null, buyer_contact: 'James Lin', buyer_company: 'Nassau Fencing Ltd',
  buyer_country: '', buyer_address: '', buyer_email: '', buyer_phone: '', buyer_whatsapp: '',
  fee_in_price: 1,
}
const item: any = {
  sort: 0, product_id: null, supplier_quote_id: null,
  name_en: 'Privacy Fence', spec: 'PVC, Height 6 ft, 31 sets', image_file: '',
  qty: 31, unit: 'set', cost_factory: 225, cost_packing: 29.4,
  cost_inland: 0, cost_other: 0, cost_confirmed: 1, final_price: null,
  purchase_currency: 'CNY', purchase_price: null, purchase_units_per_sale: 1,
  unit_conversion_confirmed: 0,
}
const freight: any[] = [
  { item: 'forwarder', amount: 1124, currency: 'USD', confirmed: 1, charge_customer: 1, included_in_cost: 0 },
  { item: 'insurance', amount: 0, currency: 'USD', confirmed: 1, charge_customer: 0, included_in_cost: 0 },
]

type Case = [string, any, any[], any[], { discount: number | null; other_charges: number | null }]
const cases: Case[] = [
  ['A 建议价', baseHeader, [item], freight, { discount: 0, other_charges: 0 }],
  ['B 手工抹零', baseHeader, [{ ...item, final_price: 47.7 }], freight, { discount: 0, other_charges: 0 }],
  ['C 木箱双计', baseHeader, [{ ...item, final_price: 47.7 }], freight.concat([{ item: 'packing', amount: 911.4, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }]), { discount: 0, other_charges: 0 }],
  ['E 老法', { ...baseHeader, fx: 6.6, target_margin: 0.25, fee_in_price: 0, incoterm: 'EXW', named_place: '', payment_terms: '30% T/T' }, [{ ...item, cost_factory: 100, cost_packing: 0, qty: 1 }], [], { discount: 0, other_charges: 0 }],
  ['F 含费', { ...baseHeader, fx: 6.6, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', named_place: '', payment_terms: '30% T/T' }, [{ ...item, cost_factory: 100, cost_packing: 0, qty: 1 }], [], { discount: 0, other_charges: 0 }],
  ['I 摊入', { ...baseHeader, fx: 6.6, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', freight_markup: 0 }, [
    { ...item, name_en: 'A', cost_factory: 100, cost_packing: 0, qty: 1 },
    { ...item, sort: 1, name_en: 'B', cost_factory: 300, cost_packing: 0, qty: 1 },
  ], [{ item: 'packing', amount: 260, currency: 'CNY', confirmed: 1, charge_customer: 1, included_in_cost: 0 }], { discount: 0, other_charges: 0 }],
  ['J 行总价摊入', { ...baseHeader, incoterm: 'EXW' }, [{ ...item, cost_factory: 236.68, cost_packing: 500, qty: 40 }], [], { discount: 0, other_charges: 0 }],
  ['K 亏损+手填', { ...baseHeader, fx: 6.6, target_margin: 0.25, fee_in_price: 1, incoterm: 'EXW', named_place: '', payment_terms: '30% T/T' }, [{ ...item, cost_factory: 100, cost_packing: 0, qty: 1, final_price: 5 }], [], { discount: 0, other_charges: 0 }],
]

let bad = 0
for (const [name, q, its, fr, ex] of cases) {
  const a: any = rcCompute(q, its, fr, ex)
  const b: any = sbCompute(q, its.map((x) => ({ ...x })), fr.map((x) => ({ ...x })), { ...ex })
  /* 逐字段比较（明确列出比较字段，不宣称全对象比较）：
     items：cost_total_cny / cost_usd / suggested_price / used_price / packing_per_unit_cny /
            item_margin / quoted_margin / markup_on_cost / amount
     totals：revenue / purchase_usd / freight_actual_usd / freight_charged_usd / sales_fee /
             final_total / order_profit / order_margin / order_commission / company_profit
     + warnings 全文、ready 布尔。 */
  const pick = (d: any) => JSON.stringify({
    items: d.items.map((i: any) => [i.cost_total_cny, i.cost_usd, i.suggested_price, i.used_price, i.packing_per_unit_cny, i.item_margin, i.quoted_margin, i.markup_on_cost, i.amount]),
    totals: [d.totals.revenue, d.totals.purchase_usd, d.totals.freight_actual_usd, d.totals.freight_charged_usd, d.totals.sales_fee, d.totals.final_total, d.totals.order_profit, d.totals.order_margin, d.totals.order_commission, d.totals.company_profit],
    warnings: d.warnings, ready: d.ready,
  })
  const ok = pick(a) === pick(b)
  console.log((ok ? 'PASS ' : 'FAIL ') + name)
  if (!ok) { bad++; console.log('  RC :', pick(a)); console.log('  SB :', pick(b)) }
}
console.log(bad === 0 ? '\nPARITY PASS（8 场景比较字段全部一致）' : `\n${bad} PARITY FAIL`)
process.exit(bad ? 1 : 0)
