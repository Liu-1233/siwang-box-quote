# P1-D-05 · 录入界面字段与操作入口对应说明 / UI Field Map

对照标准：**原版 RunCheng V2 真实录入界面**（`P1-D-05/screenshots/RUNCHENG-editor-full.png`），
不是参考截图、不是重新设计。改造方式：**重排 + 卡片化 + 折叠**，不新增业务输入项。

并排证据：
- `compare/UI-COMPARE-original-vs-new.png`（原版全页 vs 改造后）
- `compare/UI-COMPARE-old-vs-new.png`（改造前 vs 改造后）
- `screenshots/S1-UI-LAYOUT.png`（改造后隔离副本实拍，首屏）
- `P1-D-05/screenshots/UI-COMPARE-firstscreen.png`（阶段一原版 vs 改造前首屏对照）

---

## 1. 区域顺序对照

| 序 | 原版 RunCheng V2 | P1-D-05 改造后（左栏 kids 顺序） | 说明 |
|---|---|---|---|
| 0 | 顶部操作条 | 页面 head：`qe_save` / 导出 PDF / 打印 / 复制转换 / 单号与日期 | **保留现有保存按钮**（用户明确要求） |
| 1 | 报价计算参数条 | `rc_params_card`「报价计算参数」 | FX、目标毛利率、销售费率、提成、亏损规则、加成率、IncoTerm、Named Place |
| 2 | ⚠ 风险提示 | `rc_risk_bar`「风险提示」 | `hintsBar` + `differNote` 并入，页面级不再重复输出 |
| 3 | 产品明细卡片 A/B/C/D | `rc_items_card`「产品明细与成本」 | 卡片式行；B 内部成本用 `<details class="qe-cost-fold">` **默认收起** |
| 4 | 两列：整单汇总 + 其他折扣 / 运费 | `rc-cols`：左列汇总/折扣费用/一次性费用，右列 `p1c_freight_panel` 运费 | 不改变写入链 |
| 5 | （原版无独立复杂核算区） | `rc-internal`「内部核价」折叠区 | 复杂内部核算细节折叠收纳，符合任务书授权 |
| 6 | 底部订单信息（客户 Buyer 在此） | `rc_order_card`「订单信息」置于页面底部 | 客户、条款、贸易术语从最顶移回底部 |
| — | 单页全宽 Workbench | 左栏编辑 + **右侧 A4 实时预览 `qe_preview`** | 用户明确要求保留右侧预览 |

> 原版是 250ms 防抖 PUT 隐式保存、无保存按钮；本阶段**按用户要求保留现有保存按钮**，
> 不改动既有保存链路（不扩大范围）。

---

## 2. 字段与操作入口逐项对应

| 区域 | 字段 / 入口 | 原版 | P1-D-05 改造后 | 写入链（未改） |
|---|---|---|---|---|
| 参数条 | 报价汇率 FX | ✔ | ✔ 唯一入口 | `P1C.setPricingParam('fx', …)` |
| 参数条 | 目标毛利率 | ✔ | ✔ 只读派生展示，不新增可写字段 | 由既有 `pricing` 结果派生 |
| 参数条 | 销售费率 feeRate | ✔ | ✔ | `P1C.setPricingParam('feeRate', …)` |
| 参数条 | 提成 commissionRate | ✔ | ✔ | `P1C.setPricingParam('commissionRate', …)` |
| 参数条 | 亏损规则 | ✔ | ✔ 固定只读口径（zero_on_loss），不新增输入 | 既有规则，不在本阶段修改 |
| 参数条 | 产品加成率 markupRate | ✔ | ✔ | `P1C.setPricingParam('markupRate', …)` |
| 参数条 | IncoTerm / Named Place | ✔ | ✔ `incoterm` 唯一入口 | `P1C.setIncoterm(…)` |
| 风险提示 | 未确认成本 / 未核实运费 / 过期核价提示 | ✔ | ✔ 汇总到 `rc_risk_bar` | 既有 `hintsBar` |
| 产品卡片 | 产品库选择与信息带入 | ✔ | ✔ `qe_prodSearch` + `Doc.pickProduct()` | 未改；新增实物图快照带入 |
| 产品卡片 | 名称 / 规格 / 数量 / 单位 / 单价 | ✔ | ✔ 全部保留 | `Doc.setField(…)` |
| 产品卡片 | 内部成本 / 建议价 / 成本确认 | ✔ 默认收起 | ✔ **默认收起**，`<details>` 点开编辑 | 未改 |
| 产品卡片 | 状态 / 内部核价快照 | ✔ | ✔ | 未改 |
| 两列左 | 订单汇总 / 折扣 / 其他费用 / 一次性费用 | ✔ | ✔ `p1c_fees_panel` + 折扣其他费用卡 | `P1C.setExtra('discount'/'other_charges', …)` |
| 两列右 | 国内费用（工厂侧）/ 出口与国际费用 | ✔ | ✔ `p1c_freight_panel` | 未改 |
| 内部核价 | 手续费模式、运费加价率、模板选择、核价汇总 | 原版简化 | ✔ 折叠到 `p1c_pricing_panel` / `p1c_result_card` | 未改 |
| 底部订单卡 | 客户 Buyer / 公司 / 国家 / 地址 | ✔ 在底部 | ✔ 移回底部 `rc_order_card` | 未改 |
| 底部订单卡 | 付款、交期、有效期、备注、贸易条款 | ✔ | ✔ | 未改 |
| 底部订单卡 | FX / IncoTerm 唯一入口 | ✔ | ✔ 各仅 1 处（强断言 B8/B9） | 未改 |
| 右栏 | A4 实时预览 | 原版无（纸面另出） | ✔ 保留 `qe_preview` / `.qe-preview-scroll` | 与 PDF 同一 `Sheet.build()` |
| 顶部 | 保存 / 导出 PDF / 打印 / 五类转换 | ✔ | ✔ 全部保留 | 未改 |

---

## 3. 保留能力清单（任务书要求）

- 产品库选择及信息带入、成本录入、成本确认、订单费用及分摊、国内/国际运费；
- 定价参数、自动核价、手动成交价与成交价保护；
- 历史报价编辑、五类单据 QT → PI / SC / CI / PL 转换；
- 保存、重开、A4 预览、PDF 导出；
- 右侧 A4 实时预览。

## 4. 未改动项（强约束核对）

- `app/pricing.js` 与定价公式：逐字节未变；
- Schema V5：未升级、未迁移；
- `app/sheet.js` 模板分发、`app/sheet-rc.js` 纸面骨架（除 PHOTO 取值）、
  LOGO、分页、签名、金额汇总：未改；
- `tests/p1d/run.js` 的强断言（B1/B2/B8/B9 / 各面板 id / 写入链字符串）全部保持通过：
  `PASS 51 / FAIL 0`；
- 生产程序、生产 userData、历史数据：全程未触碰。

## 5. 自动化验证

`P1D05-e2e-scenarios.js` 的 `S1-UI-LAYOUT` 场景对左栏顺序做 17 项断言，
实测 kids = `["rc_params_card","rc_risk_bar","rc_items_card","rc-cols","rc-internal","rc_order_card"]`，
全部 PASS（见 `P1D05-e2e-result.json`）。
