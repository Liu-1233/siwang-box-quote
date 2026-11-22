# P1-D-01：RunCheng 报价系统与丝网盒子合并 —— 功能与界面映射方案

- **日期**：2026-11-20
- **基线**：siwang-box-integration-P1C-FIX02-20261120.zip（SHA-256 `e6d8b3c6…cd660`，154 条目）——本阶段临时冻结基线，工作副本 `D:/siwanghezi/siwang-box-0.2.17-dev-p1d` 由该 ZIP 解压建立。
- **定位**：P1-D 第一项交付（映射与方案），仅本文件，不含代码改动。
- **依据**：用户 P1-D 任务书（2026-11-20）；`baojia/docs/丝网盒子整合方案_2026-11-19.md`（P1-A/B/C 已落地其引擎部分）；`docs/integration/P0-pricing-formula-review.md`（公式口径权威文件）。

---

## 〇、方向定案与既有文档的关系

1. 2026-11-19 整合方案 V2 的 §四曾定「单据与模板以丝网盒子为主体」；本次 P1-D 任务书明确**升级该决策**：报价编辑体验与对外报价单版式**以 RunCheng 为准**，其余（数据层、引擎、宿主能力）仍以丝网盒子为基础。本方案按新决策执行，旧方案其余部分继续有效。
2. **架构定案**：不引入 React/Vite，不重建项目。RunCheng V3（`baojia/v3`）的 `QuoteEditor.tsx` 布局范式与 `Print.tsx` 的 QUOTATION 版式作为**体验蓝本移植**进丝网盒子 Electron 应用；丝网盒子保留：冻结定价引擎 `app/pricing.js`、Schema V5 数据层（model.js/storage.js）、Store、Electron 宿主（main/preload/pdf-export.cjs）。
3. 润成定价公式与丝网盒子已冻结公式**同源**（P1-A 即从 RunCheng 1:1 移植，`target_margin=(1−fee)×markup/(1+markup)`、feeInPrice 双口径、提成 zero_on_loss 均一致），因此「以 RunCheng 体验为主」不需要改任何公式。

---

## 一、界面映射（RunCheng QuoteEditor.tsx ↔ 丝网盒子 pages.js）

丝网盒子报价编辑现状：五类单据共用 `Pages.quoteEdit`（pages.js:1435-1627），状态/行为分离硬约定（QuoteEdit 只存状态 pages.js:664-704，Doc 挂行为）。RunCheng 编辑页为 6 卡片结构（QuoteEditor.tsx L557-967）。映射如下：

### 1.1 订单信息（RunCheng「订单信息卡」→ 丝网盒子新「订单信息卡（常用区）」）

| RunCheng（QuoteEditor.tsx） | 丝网盒子现状 | P1-D 处置 |
|---|---|---|
| 关联客户 `<select>` + `pickCustomer()` 灌 buyer 7 字段（L562-565、L329-336） | custSection 快照/手填/搜索三模式（pages.js:1483-1487、1629-1668） | **迁移**：主入口改为 RunCheng 式客户下拉（数据源 Store.customers），保留手填为后备；换客户清 buyerAddress 语义保留 |
| 买方 7 字段 contact/company/country/address/email/phone/whatsapp（BUYER_KEYS） | customer.id/name/company/country + buyerAddress | **迁移**：买方信息展开为 RunCheng 7 字段排布；V5 无对应键的字段（email/phone/whatsapp 丝网盒子客户档案已有，单据快照仍存 customer+buyerAddress）→ 单据层不加新键，显示层从客户档案补全，**不升级 Schema** |
| incoterm/named_place/fx/valid_days/deposit_ratio（L579-604） | incoterm/namedPlace/fx 在 `_unknown.pricing`；validity 字段已有；deposit_ratio 无 | **迁移**：valid_days↔validity 对应；deposit_ratio 为 PI 输出所需 → 本阶段**不入库**（列为 P1-D-03 输出模板的可选输入，来源 `_unknown`，缺失显示空），不扩 Schema |
| payment_terms/lead_time/packaging/exclusions（L605-622） | term/payment/validity/delivery/remark | **迁移**：字段对应 payment/delivery/remark；「常用字段优先、不常用进高级」按 RunCheng 分区 |
| 汇率修改提示「成本已核实复位」（L623） | markStale 令牌机制（P1-C） | **复用**：丝网盒子 pricingToken 已覆盖且更强（含失效拒绝填价），沿用 |

### 1.2 产品明细（RunCheng「产品明细卡」↔ 丝网盒子 itemRow + 成本子行）

| RunCheng | 丝网盒子现状 | P1-D 处置 |
|---|---|---|
| 产品库搜索卡片式添加（前 6 条，L630-652） | pickProduct 按值快照带入规格/成本（pages.js:957-1033） | **迁移 UI**：改卡片式搜索选择；快照机制保留 |
| final_price 留空=用建议价，placeholder 显示建议价（L714-717） | 建议价展示 + 「填入建议价」按钮（P1C） | **迁移**：改为 RunCheng 的留空=建议价交互；**保留 P1-C 的失效令牌+确认弹窗保护**（价格保护不允许因界面简化削弱） |
| 行内成本区 cost_factory/cost_packing/cost_other + cost_confirmed（L758-801） | 成本子行 costFactory/costPacking/costInland/costOther + costConfirmed 三态 | **融合**：采用 RunCheng 行布局；costInland 保留（丝网盒子 V5 行键，RunCheng 已废弃该项——显示清零引导同 RunCheng） |
| 供应商报价引用 select + 单位换算（L143-166、737-755） | 无（RunCheng 独有） | **暂不迁移**：依赖 suppliers/supplier_quotes 表，V5 无此概念；列为 P1-D 之后可选阶段，先不阻塞 |
| 规格字段：spec 自由文本 | specText + 结构化 mesh/wire/width/rollLen | **保留丝网盒子结构化字段**（产品资料库/装柜/CI 依赖），RunCheng spec 展示位映射 specText |
| 图片上传 | productImage 快照 | **复用** |

### 1.3 费用 / 运费 / 定价参数

| RunCheng | 丝网盒子现状 | P1-D 处置 |
|---|---|---|
| 运费 8 项 FREIGHT_ITEMS + REQUIRED_FREIGHT 按 incoterm 阻断（pricing.ts L11-28、L404-414） | P1C freightPanel 运费明细行（pages.js:3302-3346） | **复用+对齐 UI**：引擎侧 P1-A 已含同等校验（冻结不动）；界面按 RunCheng 分组展示（国内三项/国际五项） |
| freight_markup + 「补回 3% 收款费」按钮（L957-964） | freightMarkup 参数 | **迁移 UI**（按钮为纯前端换算，不触引擎） |
| packing 按数量摊入成本（pricing.ts L188-226）+ 防双计告警 | P1C 费用面板 fees[] + 自动/人工分摊（3188-3233） | **复用**：两套分摊语义不同（RunCheng=packing 摊入单位成本；丝网盒子=fees 逐笔分摊进引擎），引擎冻结不动，界面**并列展示、各自标注口径**，禁止互相回写 |
| 智能报价参数区 markup/fee/commission/fx/fee_in_price（L841-898，内部区） | P1C pricingPanel（2984-3035） | **迁移分区**：挪入「高级/内部参数」卡，字段不变 |
| 折扣/其他收费 extra.discount/other_charges | setExtra（P1C） | **复用** |
| 汇总卡（订单收入/运费/手续费/纯利润/提成/公司利润）+ 告警卡 | P1C resultHTML（3036-3079） | **迁移 UI**：按 RunCheng 卡片布局重排，数据全部来自现有 run() 结果 |
| confirmQuote 不可变更快照（L488-503） | 无（save+导出预检替代） | **暂不迁移**：会改变单据生命周期语义，涉及 model.js（冻结），列为后续独立提案 |

### 1.4 其他界面要素

| 项 | 处置 |
|---|---|
| 卖方信息 | RunCheng 编辑页无卖方表单（来自 settings，打印时读取）→ **沿用丝网盒子设置页快照**，编辑页内卖方区保留只读卡（sheet.js 铁律：抬头只读 seller 快照） |
| 右侧 A4 实时预览 | 丝网盒子独有且用户依赖 → **保留**，预览内容随 P1-D-03 新版式切换 |
| 纸面模板/自定义列/唛头（_unknown.quoteLayout） | **保留**，归入「高级设置」区 |
| PL 编辑（包装方式/唛头/四件套） | 不变（RunCheng 无 PL） |
| 页面路由 | 复用 `quoteEdit` 键与 `UI.go` 机制，不新增路由 |

---

## 二、报价单输出映射（RunCheng Print.tsx ↔ 丝网盒子 sheet.js）

| RunCheng 版式 | 丝网盒子现状 | P1-D 处置 |
|---|---|---|
| QuotationDoc 黑框商务风：①LOGO+卖方抬头 ②QUOTATION 标题条+No./Date ③BUYER/CONSIGNEE+DOCUMENT INFO（Quote No/Date/Salesperson/Currency/Trade Term/Named Place/Valid Until）④产品表 NO./PHOTO/NAME/SPEC(+HS)/QTY/UNIT/UNIT PRICE/AMOUNT ⑤COMMERCIAL TERMS+Amount in Words+汇总表 ⑥双签字区 ⑦页脚（Print.tsx L238-355） | basic-v1/trade-v1（sheet.js:37-38、327-394）：抬头/TO 块/明细表/汇总/条款块/签署 | **P1-D-03 新增模板 `quotation-rc-v1`**：逐区块移植 QuotationDoc 版式；实现为独立 UMD 模块（仿 reference-sheets.js 模式）+ 在 `Sheet.build` 加模板分发注册。**basic-v1/trade-v1 保留**供历史单据选择，默认模板切为 quotation-rc-v1 仅对新单生效 |
| Amount in Words 英文大写（amountInWords L51-63） | 无 | **迁移**：纯函数进新模板模块 |
| LOGO base64 内嵌 | 无 LOGO | **迁移**：logo 放入模板模块常量（来源设置页 seller 或内置默认） |
| PiDoc 蓝色 PI 版（银行信息五行为/Deposit 行，L358-444） | jr-pi-v1（reference-sheets.js） | **PI 输出暂保持原样**（任务书 §三.5）；PiDoc 版式列为后续可选提案 |
| 纯前端 window.print() + @page A4 | 三链路：sheet.js（唯一纸面实现）+ pdf-export.cjs（受控 PDF）+ Doc.print（#printView @media print） | **复用丝网盒子三链路**：新模板走 Sheet.build 分发后，PDF 导出（pdf-export.cjs 零改动）与打印自动一致；**一致性验收**＝编辑数据→预览→打印→PDF 四处同源 Sheet.build |
| 数据一致性 | MODEL.validateForExport 预检 + save 后导出 | **复用** |

**关键约束实现方式**：pdf-export.cjs 冻结不动（它调用 `Sheet.build` 且内嵌 app.css——新模板自带全部样式、不依赖 app.css，故宿主与导出器均零改动）。

---

## 三、功能处置汇总（直接复用 / 迁移 / 保留 / 暂缓）

### 直接复用（零改动）
- 定价引擎 `app/pricing.js`（851 项冻结回归）、公式口径、feeInPrice 双口径、提成 zero_on_loss。
- 数据层：Schema V5、model.js 写门/转换矩阵、storage.js、Store 全部操作、_unknown 受控合并。
- 宿主：SBW 数据通道、受控 PDF 导出、关闭守卫三态协议、授权/维护模式、内部核价独立存储。
- 独有模块：装柜预排、产品 AI 导入、计算器、客户 7 阶段管理、学习中心。
- P1-C 全部能力：费用管理、自动/人工分摊、失效令牌价格保护、QT→PL 隔离。

### 迁移（RunCheng → 丝网盒子，本阶段主体工作）
1. 报价编辑界面布局：6 卡片分区（订单信息常用区/产品明细/运费面板/高级内部参数/汇总卡/告警卡）。
2. 客户关联下拉选择交互。
3. final_price 留空=建议价交互（保留令牌保护）。
4. 运费分组展示 + freight_markup 补回按钮。
5. 报价单输出模板 quotation-rc-v1（含 Amount in Words、LOGO）。

### 保留但重排（功能不变、只动界面位置）
- 定价参数面板、费用面板、结果汇总 → 按上表归入对应卡片。
- 纸面模板/自定义列/唛头 → 高级设置区。

### 暂缓（明确不进 P1-D，避免扩 Schema/改冻结文件）
- 供应商报价库（suppliers/supplier_quotes）、confirmQuote 确认快照工作流、deposit_ratio 入库、PiDoc 版式替换、客户档案页增强、RunCheng 云端多用户。

### 不允许发生
- 删除任何 V5 字段/计算能力/历史数据；历史报价（含无 v5 定价键的旧单）读取零变化；PI/SC/CI/PL 编辑与输出流程改动。

---

## 四、需要修改的文件与风险

### 4.1 各阶段允许触碰的文件

| 阶段 | 允许修改 | 明确冻结 |
|---|---|---|
| P1-D-02 编辑界面 | `app/pages.js`（quoteEdit 区块重排）、`app/app.css`（新增卡片样式类，不动既有类语义）、`app/index.html`（如需引新模块） | app/pricing.js、model.js、store.js、storage.js、main.js、preload.js、pdf-export.cjs、sheet.js、reference-sheets.js |
| P1-D-03 输出模板 | 新增 `app/sheet-rc.js`（quotation-rc-v1 UMD 模块）、`app/sheet.js`（**仅限** build() 内模板分发注册 ≤10 行，其余逐字节不动）、`app/index.html`（script 引入）、`app/pages.js`（模板下拉加入新项） | pdf-export.cjs、reference-sheets.js（jr-pi-v1 等）、model.js、app/pricing.js |
| P1-D-04 收尾回归 | 上述文件的收尾修正 + tests | 同上 |

**说明**：sheet.js 在 P1-C 系列被冻结；P1-D-03 需要它在 build() 分发新模板，此为不可避免的最小开口——按惯例**先报告再动**，改动行数与 diff 单独出具，其余部分逐字节不变，提请任务书确认后执行。

### 4.2 风险清单

| # | 风险 | 缓解 |
|---|---|---|
| R1 | app.css 既是 UI 样式也是 PDF 样式源（main.js:170）——改 UI 样式可能波及旧版式导出 | 新增样式全部用独立类名前缀（如 `.rc-`）；导出回归用旧模板单据做前后对比 |
| R2 | 界面重排可能遗漏原有字段入口 → 「因简化而丢字段」 | 映射表逐字段核对（本文档 §一）；P1-D-02 验收含「字段清点断言」：现 quoteEdit 全部可编辑字段在新界面均可达 |
| R3 | 留空=建议价与手动成交价保护冲突 | 交互改为 RunCheng 式，但**保留** markStale/令牌/确认弹窗全链路；P1-C 229 项不回归为硬门 |
| R4 | 新模板与 PDF 链路数据不一致 | 单一数据源 Sheet.build；四链路一致性专项测试（同单据预览/打印/PDF 内容断言） |
| R5 | deposit_ratio、email/phone/whatsapp 等显示性差异引入隐性 Schema 改动 | 硬约束：SCHEMA_VERSION 不变、model.js 不动；所有新显示数据来自现有键或客户档案，不入单据库 |
| R6 | RunCheng 双分摊语义（packing 摊入 vs fees[]）被用户误解混用 | 界面并列分区+口径标注；引擎不动；文档说明 |
| R7 | 历史单据打开新界面 | 兼容规则：v5 键缺失照旧补默认（store.js:137-140 既有行为），新布局只影响呈现 |

---

## 五、P1-D 分阶段实施与验收标准

### P1-D-02：报价编辑界面 RunCheng 化
- **范围**：§一映射的全部界面迁移/重排；只改 pages.js + app.css（新增类）+ 必要的 index.html。
- **验收标准**：
  1. 回归：schema 194、pricing 851、P1-C 229、parity 8、语法检查——全部通过，预期值零修改。
  2. 字段清点：现编辑页全部可编辑字段在新界面可达（自动化断言）。
  3. 保护链：改成本/费用/运费/参数后旧建议价拒绝填入（P1-C H 段语义在真实界面复测）。
  4. Electron 隔离实测：新建报价→RunCheng 式流程走通（选客户→选产品→填成本→确认→分摊→核价→留空价保存→PDF）；截图对照 RunCheng 卡片分区。
  5. PL/PI/SC/CI 编辑功能回归：五类单据编辑、转换、保存全部正常。
- **交付**：ZIP + SHA256SUMS + 差异报告 + 截图 + 独立解压实测。

### P1-D-03：报价单输出模板 quotation-rc-v1
- **范围**：§二映射；新增 sheet-rc.js + sheet.js 最小分发开口 + 模板选项。
- **验收标准**：
  1. 版式对照：QuotationDoc 七区块逐项对照清单全部一致（抬头/标题条/BUYER+DOCUMENT INFO/产品表/条款+大写金额+汇总/双签字/页脚）。
  2. 一致性：同一单据的预览、打印、PDF 三处内容一致（自动化断言 + 截图）。
  3. 回归：旧模板 basic-v1/trade-v1 输出逐字节不变（对历史单据做前后 diff）；PI/SC/CI/PL 输出零改动；pdf-export.cjs/main.js 零改动证明（SHA 对照）。
  4. validateForExport 预检链路照旧生效。
- **交付**：同 P1-D-02 规格。

### P1-D-04：合并收尾与全量验收
- **范围**：两阶段联调问题修复、默认模板切换策略落地（新单默认 quotation-rc-v1，历史单保持原模板）、README 与交付文档更新。
- **验收标准**：全量回归 + 独立解压实测 + 完整差异报告（vs P1-C-FIX-02 基线）+ 日常使用走查清单（建单→核价→确认→打印→PDF→转 PI/PL 全链）。
- **阶段控制**：每阶段完成后停止，标记「已编码，待 ChatGPT 独立验收」；未验收不进入下一阶段；不覆盖生产版本、不迁移生产数据。

---

## 六、待确认事项（随 P1-D-02 任务书一并发回）

1. sheet.js 的 build() 最小分发开口（P1-D-03）是否接受——不接受则改为：新模板完全旁路 Sheet.build 自建导出入口，代价是 pdf-export.cjs 必须改动（打破其冻结），二选一。
2. LOGO 来源：内置默认（RunCheng logo-data.ts）还是读取设置页自定义图片？
3. deposit_ratio 本阶段不入库（PI 输出如需订金行，用固定占位或暂缺）——是否接受。
4. 默认模板切换：仅新建单据默认 quotation-rc-v1，历史单据保持其已存模板——是否接受。
