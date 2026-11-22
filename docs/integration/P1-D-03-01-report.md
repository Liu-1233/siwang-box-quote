# P1-D-03-01 前置审查报告：RunCheng 输出模板整合（只读分析）

日期：2026-11-20
性质：**只读分析，未修改任何业务代码、数据与配置**。分析对象：RunCheng（v2 / v3）与丝网盒子最新工作副本 `siwang-box-0.2.17-dev-p1d`（P1-D-02c 状态，交付 ZIP SHA-256 64ab78e4…d5bad）。

---

## 〇、执行摘要

1. **关键事实（影响整个整合方案）**：QT/PI/SC/CI/PL 五单据体系属于丝网盒子（`app/model.js` L22-23 `DOC_TYPES`）；**RunCheng 只有 QT 与 PI 两种单据输出，没有 SC/CI/PL**。因此整合的正确形态是：**以 RunCheng 的 QT/PI 版式为参考，在丝网盒子模板层新增 RunCheng 风格模板；SC/CI/PL 保留丝网盒子现有版式**（阶段内不强行套用）。
2. **模板分发机制已预留**：`sheet.js` L37-38 `TEMPLATE_IDS` 白名单、L99-102 `templateFor()`、L330-332 build() 分发（含 reference-sheets 委托）。新增模板 ID 即可挂载，符合 P1-D-01 已拍板的「sheet.js build() ≤10 行分发开口」。
3. **一处冻结文件需拍板**：`model.js` L121 `sanitizeQuoteLayout` 的模板 ID 白名单也是硬编码；不把它加入白名单，`quotation-rc-v1` 会在保存时被剥离、重开后回落 `basic-v1`。两种处置方案见 §3，需 ChatGPT 拍板。
4. **pdf-export.cjs 可零改动**：它引用 `Sheet.TEMPLATE_IDS` 做校验、注入 `app.css` 全文、CSP 已放行 `data:` 图片——新模板与 LOGO/产品图片可自动获得导出能力。
5. **内部字段隔离天然安全**：sheet.js 渲染白名单从不引用 fx/feeRate/targetMargin/commissionRate/markupRate/feeInPrice/fees/_unknown.pricing；核价原始数据在独立 costingStore，PDF 链路不接触。新模板沿用同一纪律。

---

## 一、两套系统五种单据功能对照表

### 1.1 总体对照

| 单据 | RunCheng V2（Python+静态） | RunCheng V3（React） | 丝网盒子（sheet.js 同一引擎） | 整合结论 |
|---|---|---|---|---|
| **QT 报价单** | ✅ 蓝风单栏（`server.py` L729-810，QT/PI 共用模板） | ✅ 黑框商务风（`Print.tsx` QuotationDoc L238-355，含 PHOTO 列、双面板、大写金额、双签名） | ✅ basic-v1（丝网规格 10 列）+ trade-v1（Photo 列 7 列） | **本轮主目标**：新增 `quotation-rc-v1` |
| **PI 形式发票** | ✅ 蓝风（含银行表+订金行） | ✅ 蓝风继承版式（Salesperson、Deposit 百分比+金额） | ✅ basic-v1 + trade-v1（蓝底 FROM/TO）+ jr-pi-v1 参考（含大写金额） | 可复用 quotation-rc-v1 同族（**待拍板是否本阶段做**） |
| **SC 销售合同** | ❌ 无 | ❌ 无 | ✅ basic-v1（HS Code 列、Sign Date/Place、合同条款整段、双方签名） | 保留丝网盒子版式 |
| **CI 商业发票** | ❌ 无 | ❌ 无 | ✅ basic-v1（HS Code 列、Shipment/Vessel/Voyage/Origin） | 保留丝网盒子版式 |
| **PL 装箱单** | ❌ 无 | ❌ 无 | ✅ basic-v1（零金额，包装四件套汇总）+ packing-ref-v1 参考 | 保留丝网盒子版式 |

### 1.2 版式要素对照（重点检查项核对）

| 检查项 | RunCheng V2 | RunCheng V3 | 丝网盒子现状 |
|---|---|---|---|
| **LOGO** | 固定 `static/logo.png`，头部 img 高 72px；**无上传界面** | `logo-data.ts` base64 内嵌（64px/56px）；**无设置界面** | **完全没有 LOGO**（无字段、无输出）；CSP `img-src data:`（index.html L11、pdf-export.cjs L15）已留好 base64 通道 |
| **产品图片** | 内嵌 Product 单元格 64×64 | QT 独立 PHOTO 列 12%（max-height:72px，无图印 `NO IMAGE`）；PI 内嵌 52×52 | basic-v1 全部无图；**trade-v1 有 Photo 列**（`_unknown.productImage` base64，≤1MB，app.css L385-387）；jr-pi-v1 有 Image 列 |
| **表格宽度** | `width:100%; border-collapse:collapse` | QT 8 列固定布局（5/12/16/20/6/8/16/17%）；PI 8 列（4/28/24/8/10/10/12/7%） | `table.q-tb width:100%`；PL 列宽 fixed（app.css L445-449） |
| **页边距** | `@media print body{margin:10mm}`，无 `@page` | `@page{size:A4;margin:0}` + 容器 padding（QT 12mm/11mm/18mm；PI 14mm/12mm/18mm） | 预览 `.q-sheet padding:14mm`；导出 `@page{margin:12mm 12mm 16mm}`；系统打印 `@page{margin:12mm}` |
| **分页** | **无处理** | `thead{display:table-header-group}`（表头跨页重复）+ `tr{break-inside:avoid}` + 双面板/合计/签名防断 | `thead{table-header-group}`（pdf-export.cjs L18 注入）+ `tr{break-inside:avoid}`（app.css L336）+ 签名/合计防断（L450-453）+ SC 条款区明确可跨页（L391-393） |
| **合计金额** | Subtotal→Freight→Discount→Tax/Other→TOTAL（QT/PI 措辞略异）；无大写金额 | 同左 + QT 有 **Amount in Words** 英文大写框（L332，算法 L19-63） | 仅 `TOTAL: 金额` 一行 + 历史不一致核对警示；**无分项、无大写金额**（jr-pi-v1 参考模板有 `TOTAL SAY`） |
| **打印效果** | window.print()，浏览器默认纸张 | window.print() + `@page A4` + `document.title` 控制另存 PDF 文件名 | Electron printToPDF（页脚「单号 · x/y 页」）+ 系统打印两条链路 |
| **签名栏** | 无 | QT 双签名框（Seller/Buyer）；PI 无 | QT/PI/SC/CI 双栏签名；PL 仅 Seller 一行 |
| **中文** | 页脚中文按钮；单据内容英文 | 单据全英文 | 标题中英双语（q-title-cn/en），正文英文为主 |

### 1.3 RunCheng V2 与 V3 的关系

- V3 是 V2 版式的 React 重写（`Print.tsx` L2 注释「版式照搬 V2」），QT 在 V3 有明显升级（黑框风、PHOTO 列、双面板、大写金额、双签名），PI 基本同版式微增强。
- v3local 与 v3 的 `Print.tsx` 逐字节一致。
- **本任务书指定「RunCheng V2 作为正式文档输出的参考标准」**，故 quotation-rc-v1 以 V2 版式为基准；V3 的增强要素作为可选拍板项（见 §4）。

---

## 二、字段映射表

### 2.1 单据级字段

| RunCheng（v2 `build_client_doc` / v3 QuoteHeader） | 丝网盒子 document（V4_DOC_KEYS） | 纸面呈现位置（RunCheng → 丝网盒子） | 映射评估 |
|---|---|---|---|
| `no`（quote_no/pi_no） | `doc.no` | 头部 No. → q-head No.: | ✅ 直接映射 |
| `date` | `doc.date` | Date → Date | ✅ 直接映射 |
| `trade_term` + `named_place`（结构化） | `doc.term`（自由文本）；结构化值在 `_unknown.pricing.incoterm/namedPlace`（内部） | Trade Term KV | ⚠️ 语义对应但形态不同：RunCheng=`CIF Ningbo` 结构化拼接；丝网盒子=自由文本。**建议纸面继续用 `doc.term`**，结构化值仅作 datalist 提示（现状已如此） |
| `currency` | `doc.currency` | Currency KV / 列头 | ✅ 直接映射 |
| `buyer{contact,company,country,address,email,phone,whatsapp}` | `doc.customer{id,name,company,country,address}`（V5 快照）+ `doc.buyerAddress` | BUYER/CONSIGNEE 面板 | ⚠️ 快照少 email/phone/whatsapp 三键（V5 不升级 Schema），新模板客户块少三行 |
| `seller{company,address,contact,email,website,phone,whatsapp}` | `doc.seller{company,contact,address}` | 头部公司行 | ⚠️ 少 email/website/phone/whatsapp；如需 RunCheng 式联系方式行，**LOGO 与联系方式属设置页扩充**（P1-D-01 已拍板「LOGO 设置页优先」） |
| `freight`（纸面分项） | 无纸面字段；运费在内部 `_unknown.pricing.freight[]`，合计进 `totals.grand` | Shipping / Freight 汇总行 | ⚠️ **映射缺口**：新模板要显示 Freight 分项须只读 `_unknown.pricing.freight` 合计（设计决策见 §6 风险 3） |
| `discount` | `_unknown.pricing.extra.discount` | Discount 行（负号） | ⚠️ 同上 |
| `other_charges` | `_unknown.pricing.extra.other_charges` | Tax / Other Charges 行 | ⚠️ 同上 |
| `total`（`totals.final_total`） | `totals.grand` | TOTAL 行 | ✅ 映射；分项相加必须与 grand 同源一致 |
| `payment_terms` | `doc.payment` | Payment Terms | ✅ |
| `lead_time` | `doc.delivery`（语义近似） | Production Lead Time | ⚠️ 键名不同、语义近似；纸面标签需决定沿用哪套措辞 |
| `packaging` | 无（仅 PL 有 packagingMode） | Packaging KV | ⚠️ 金额类单据无包装字段 → 缺口 |
| `validity` / `valid_until` | `doc.validity`（文本） | Price Validity | ✅ 形态不同（文本 vs 日期），按文本呈现 |
| `notes` | `doc.remark` | Notes / Remark | ✅ |
| `bank{bank_name,account_name,account_number,swift,bank_address}` | `doc.bank` | Bank Information 表（PI/SC/CI） | ✅ 空则整块不印（两套一致） |
| `deposit_ratio` | **无**（P1-D-01 已拍板：不入库） | PI Deposit 行 | ⚠️ 若做 PI RunCheng 化需数据来源拍板（模板常量或设置项） |
| `salesperson`（v3） | 无 | Salesperson | ⚠️ 缺口（设置项或留空） |
| `exclusions` | 无 | Notes 附加 | ⚠️ 可并入 remark |

### 2.2 明细行字段

| RunCheng items[] | 丝网盒子 ITEM_KEYS | 评估 |
|---|---|---|
| `name` | `nameCn`（+`nameEn`） | ✅ 新模板建议「中文名 + 英文名」或仅英文名（客户单据英文规范）——**拍板项** |
| `spec`（自由文本） | `mesh/wire/width/rollLen` 结构化 + `productSpecs` 摘要（Aperture=25.4/mesh−wire 现算） | ⚠️ **形态差异最大处**：RunCheng 是一段 spec 文本；丝网盒子是丝网规格专列。见 §6 风险 5 |
| `qty` / `unit` | `qty` / `unit` | ✅ |
| `price`（v3 `used_price`） | `price` | ✅ |
| `amount` | `amount` | ✅（口径同源 MODEL.documentTotals/round2） |
| `hs_code` | `hsCode`（现仅 CI/SC 列显示） | ✅ 新 QT 模板是否加 HS Code 列 → 拍板项 |
| `origin`（恒 China） | 无 | ✅ 模板常量 `China` |
| `images[]/image_file` | `item._unknown.productImage`（base64 data:image png/jpeg，≤100KB 写入、≤1MB 导出白名单） | ✅ 通路齐备，新模板直接复用 |
| —（无自定义列概念） | `customColumns`（≤6 列，存 `_unknown.quoteLayout.columns`，标签含成本/利润词自动拒收） | ⚠️ 新模板是否支持自定义列 → 拍板项（建议首版不支持，保持版式可控） |

### 2.3 金额与格式化函数

- 丝网盒子纸面格式化在 `sheet.js` L63-76（`sym/money/qty`，千分位 + 币种符号）；合计口径统一 `MODEL.documentTotals/round2`。新模板必须复用同一组函数，不得自写舍入。
- RunCheng 大写金额算法在 `v3/src/pages/Print.tsx` L19-63（英文 number-to-words），可移植到新模板模块（附单测）。

---

## 三、文件修改范围建议（P1-D-03-02 实施）

| 文件 | 改动 | 说明 |
|---|---|---|
| `app/sheet-rc.js`（**新增**） | quotation-rc-v1 模板实现（纯函数，UMD，与 sheet.js 同纪律：只读展示白名单、全转义、无 `<script>`） | 主体工作量所在 |
| `app/sheet.js` | **≤10 行分发开口**：① `TEMPLATE_IDS` 增加 `'quotation-rc-v1'`；② build() 头部按 `activeTemplate === 'quotation-rc-v1'` 委托 SheetRC（同 reference-sheets 委托模式，L332 现成先例） | 符合 P1-D-01 拍板 |
| `app/model.js` | **方案 A（推荐）**：L121 白名单数组 + `'quotation-rc-v1'` 一词——使模板选择可按单持久化；**方案 B**：不改 model.js，把 `sheet.js` `TEMPLATE_ID` 默认常量改为 `'quotation-rc-v1'`（新单默认即新模板，但不做按单切换，历史单不受影响） | **冻结文件，需拍板**；两案均不触 Schema/数据结构 |
| `app/app.css` | 文末追加 `rc-` 前缀样式块（只增不改，沿用 P1-D-02 先例） | 蓝风主题、@page、分页防断 |
| `app/pages.js` | ① 模板下拉（L1904-1916 `Doc.templateId` 白名单、L1702-1711 选择器）放开 `quotation-rc-v1`（可限 QT 专属）；② 设置页「我的信息」新增 LOGO 上传（base64）与联系方式字段（P1-D-01 拍板项） | |
| `app/index.html` | 如 sheet-rc.js 以独立 script 引入则 +1 行；若由 sheet.js 内部 require/挂载则零改动 | |
| `pdf-export.cjs` | **零改动**（校验引用 `Sheet.TEMPLATE_IDS` 自动放行；CSS 注入 app.css 全文自动生效；CSP 已放行 data: 图片） | |
| `main.js / preload.js / store.js / storage.js` | **零改动** | |
| 测试 | 新增 `tests/p1d3/`（模板快照断言 + 字段白名单断言 + 大写金额单测）；既有四套件**一字不改** | |

---

## 四、QT 报价单目标版式方案（quotation-rc-v1）

**基准**：RunCheng V2 `server.py print_view`（L729-810）蓝风版式（任务书指定 V2 为参考标准），纸张 A4 竖版。

```
┌──────────────────────────────────────────────────────┐
│ [LOGO 72px]  公司英文名                               │  头部：LOGO + 公司名
│              Address · Contact · Email · Website      │  （数据源：doc.seller 快照
│ ─────────────────────────────────────── 蓝色分隔线    │   + 设置页新增联系方式）
│                 QUOTATION（#1a5fa8 居中加粗）          │
│ Quote No. QT-202611-0001 │ Date │ Trade Term │ Currency │  KV 信息表两列
│ Buyer: company / contact │ Address: buyerAddress      │
├──────────────────────────────────────────────────────┤
│ No.│Photo│Product│Specification│Qty│U/P (USD)│Amount│HS│  明细 8-9 列
│    │64px│中英文名│mesh/wire/…  │    │  6.57   │38.10 │  │  （见下方拍板项）
├──────────────────────────────────────────────────────┤
│ Product Subtotal                    $ …               │  合计区（右对齐小表）
│ Shipping / Freight                  $ …               │
│ Discount（负号）/ Tax · Other Charges                 │
│ TOTAL QUOTATION (USD)               $ 38.10           │
│ [拍板项] Amount in Words: SAY US DOLLARS … ONLY      │  ← 移植 v3 L19-63 算法
├──────────────────────────────────────────────────────┤
│ Payment Terms │ Production Lead Time │ Price Validity │  条款 KV 区
│ Notes                                           │
│ [拍板项] For the Seller ─── / For the Buyer ─── 签名框 │
└──────────────────────────────────────────────────────┘
页脚：Customer-facing quotation — QT-202611-0001（灰色 9px）
```

**版式细则（V2 既有值）**：字体 `'Segoe UI',Arial`；正文 13px、表格 11-12px；主色 `#1a5fa8`、表头底 `#eaf1fa`；`@page{size:A4}` + 打印 margin 12mm；`thead{display:table-header-group}`、`tr{break-inside:avoid}`、合计区防断（借 V3 的分页纪律补 V2 缺口）。

**需 ChatGPT 拍板的版式选项**（默认推荐 A）：
| # | 选项 | 推荐 |
|---|---|---|
| L1 | 明细列形态：A=RunCheng 8 列（Photo/Product/spec 文本） vs B=RunCheng 布局内保留丝网规格专列（Mesh/Wire/Aperture/Width/Roll 合并为 Specification 单元格内分行） | **B**（丝网行业属性强，规格数据已有结构化通路；spec 单元格内多行呈现，接近 RunCheng 观感又不丢列） |
| L2 | 是否含独立 Photo 列 | **是**（复用 `_unknown.productImage`，无图印 `NO IMAGE` 虚线框，同 V3） |
| L3 | 是否含 Amount in Words | **是**（v3 算法移植 + 单测；成交友好） |
| L4 | 是否含双签名栏 | **是**（与丝网盒子现有一致，向 V3 对齐） |
| L5 | HS Code 列（QT 现状不显示） | **否**（维持丝网盒子现状：仅 CI/SC 显示） |
| L6 | 品名显示中文+英文 or 仅英文 | **仅英文优先、中文兜底**（客户单据英文规范；nameEn 空时回退 nameCn） |
| L7 | Freight/Discount/Tax 分项行是否显示 | **是，但仅当值非空且与 grand 同源核对一致**；取自 `_unknown.pricing` 只读，不新增存储字段 |

---

## 五、PDF 与打印流程分析

### 5.1 丝网盒子两条输出链路（现状，均无需改动主体）

1. **受控 PDF 导出**（`doc:exportPdf` → `pdf-export.cjs`）：
   防伪校验（仅主窗口、仅 `{documentId}`、busy 互斥）→ `store.readSavedDocument` 读已保存单据 → `DOC_TYPES`/`TEMPLATE_IDS`/`validateForExport` 三重校验 → 警告确认框 → 保存对话框（`QT-单号.pdf`）→ 隔离沙箱窗口（`session.fromPartition` + webRequest 白名单只放行 data: 图片 ≤1MB）→ `printToPDF({pageSize:'A4', printBackground:true, preferCSSPageSize:true, displayHeaderFooter:true, 页脚=单号·页码})` → 15s 超时 + `%PDF-` 魔数校验 + 临时文件原子 rename。
   **新模板自动获得支持的原因**：模板校验引用 `Sheet.TEMPLATE_IDS`（sheet.js 内 +1 即过）；CSS 从 app.css 全文注入（rc- 样式随包生效）；图片白名单已放行 base64（LOGO/产品图零改造）。
2. **系统打印**（`Doc.print` → `#printView` → `window.print()`）：`@media print`（app.css L399-410）+ `@page{margin:12mm}`；脏草稿先强制保存。
3. **A4 预览**：编辑器双栏 `zoom:0.62`（0.45–1.2 可调），只影响查看不影响打印；草稿态支持 contenteditable 直改（`Doc.previewCommit`），正式预览/PDF 关闭该通路——新模板须同样实现 `editable` 参数区分。

### 5.2 RunCheng 打印方式（参考）

V2/V3 均为 `window.print()` + 内联 `@media print`；V3 额外用 `document.title` 控制「另存为 PDF」默认文件名、`@page{margin:0}`+容器 padding。丝网盒子的 printToPDF 链路更可控（页脚页码、防伪、原子写），**保留丝网盒子机制、仅换模板内容**，不引入浏览器打印依赖。

### 5.3 边距与分页注意事项

- printToPDF `margins:{top:12/25.4,bottom:16/25.4,...}` 与注入的 `@page{margin:12mm 12mm 16mm}` + `preferCSSPageSize:true` 并存，现状输出正常；新模板沿用同一注入段即可，**不要在 rc 样式里重复声明 @page**，避免双重边距叠加。
- LOGO base64 建议 ≤128px 高内嵌（同 v3 做法），确保 ≤1MB 导出白名单；产品图现有 ≤100KB 写入限制与导出白名单兼容。

---

## 六、潜在兼容性风险

| # | 风险 | 等级 | 处置建议 |
|---|---|---|---|
| R1 | `model.js sanitizeQuoteLayout` 白名单需 +1 词——**触碰冻结文件** | 高（流程） | 提交 ChatGPT 拍板方案 A/B（§3）；改动仅一词、不动 Schema 与数据 |
| R2 | 若走方案 B 或白名单漏改：templateId 保存时被剥离，重开回落 basic-v1，用户感知「模板丢失」 | 高 | 采用方案 A；测试加「保存→重开→templateId 保留」断言 |
| R3 | 新模板显示 Freight/Discount/Tax 分项与 `totals.grand` 口径不一致（分项来自 `_unknown.pricing` 只读，而 grand 由 MODEL 计算） | 中 | 模板渲染时复用 `MODEL.documentTotals` 同源核对，不一致时沿用现有 `q-warn` 警示，不静默改写 |
| R4 | 客户/卖方快照字段少于 RunCheng（无 email/phone/website/whatsapp），头部联系方式行不完整 | 低 | 设置页新增联系方式（存 settings，不动 Schema V5）；快照仍按值落单据 |
| R5 | spec 形态差异（RunCheng 自由文本 vs 丝网结构化规格列）导致版式取舍 | 中 | 按 §4 L1 推荐方案 B：RunCheng 布局 + spec 单元格内多行规格 |
| R6 | 大写金额函数移植错误（千/百万/billion 边界、负数、0） | 中 | 移植 v3 算法 + 独立单测（≥15 边界用例）；仅在金额有限时输出 |
| R7 | PL/SC/CI 无 RunCheng 版式可参考，若强行统一会破坏现有已验收输出 | 低 | 阶段内明确只做 QT（PI 视拍板），其余单据不动 |
| R8 | LOGO 存储位置：settings 新键是否触发 storage 校验/迁移 | 低 | 只增键不改既有键；storage.js 零改动前提下验证 settings 读写回归 |
| R9 | 字体差异：新模板用 Segoe UI（Windows 自带）而 app.css 既有 PingFang/雅黑；PDF 渲染字体回退差异 | 低 | rc- 样式块内独立 font-family；导出前实测一次 PDF |
| R10 | customColumns 与新模板并存（列宽固定布局下自定义列挤爆版式） | 中 | 首版 quotation-rc-v1 不支持自定义列（§4 拍板项），模板注记说明 |
| R11 | deposit_ratio 不入库既定决策 vs PI RunCheng 版式需订金行 | 低 | 本阶段若做 PI，订金行以模板常量/设置项呈现，不入库 |
| R12 | 历史单据（0.2.17 以前）无 `_unknown.pricing`，分项行缺数据 | 低 | 分项行仅值存在才渲染（空则整行省略），TOTAL 恒可算 |

---

## 七、P1-D-03-02 实施任务书（草案，供 ChatGPT 审查修订）

### 7.1 目标
在丝网盒子模板层新增 `quotation-rc-v1`（RunCheng V2 风格 QT 模板），交付 LOGO 设置页最小实现；不改定价引擎、不升级 Schema、不动五单据既有 basic-v1 输出。

### 7.2 范围与边界
- **允许改动**：`app/sheet.js`（≤10 行分发开口 + TEMPLATE_IDS +1）、`app/model.js`（仅当拍板方案 A：白名单 +1 词）、`app/app.css`（rc- 样式只增）、`app/pages.js`（模板选择 + LOGO/联系方式设置）、`app/index.html`（如需 +1 script）、新增 `app/sheet-rc.js` 与 `tests/p1d3/`。
- **禁止改动**：`pricing.js / store.js / storage.js / main.js / preload.js / pdf-export.cjs / reference-sheets.js`、四套既有测试文件一字不改、Schema V5 与定价公式零触碰。
- **保留功能清单**（任务书第三节 10 项）全部不受影响；内部成本/利润/手续费/提成**绝不**进入新模板输出（渲染白名单纪律 + 新增专项断言）。

### 7.3 实施步骤
1. 拍板项确认（§4 L1–L7 + §3 方案 A/B + PI 是否纳入本阶段）。
2. `sheet-rc.js` 模板实现（头部/KV/明细/合计/条款/签名/页脚 + 大写金额函数 + editable 预览通路）。
3. `sheet.js` 分发开口 + `app.css` rc- 样式 + `pages.js` 模板选择与设置页。
4. `tests/p1d3/`：模板结构断言、字段白名单断言（输出 HTML 中 grep 不到 fx/feeRate/targetMargin/commissionRate/markupRate/feeInPrice/fees/cost）、大写金额单测、保存→重开 templateId 保留、PL/SC/CI 不受影响回归。
5. Electron 隔离实测：新模板 QT 新建→编辑→核价→保存→重开→A4 预览→受控 PDF 导出→pypdf 金额核对；LOGO 与产品图片渲染截图；basic-v1 历史单重开不串版。
6. 四套回归 + parity 全过；双全新目录解压实测；ZIP + SHA256SUMS + 逐文件差异对照交付。

### 7.4 验收标准
- 新 QT 模板版式要素齐备（对照 §4 方案）、分页表头重复/行防断生效；
- PDF 金额与界面/预览一致（pypdf 提取验证）；
- 输出 HTML 与 PDF 中无任何内部字段痕迹（自动断言）；
- 四套件 194/851/229/50 + parity 8 零回归；
- `pdf-export.cjs / main.js / preload.js / store.js / storage.js / pricing.js` SHA-256 与 P1D02c 交付包逐一相同。

### 7.5 待拍板项汇总
| # | 事项 | 建议 |
|---|---|---|
| D1 | model.js 白名单方案 A（按单持久化）/ 方案 B（默认常量） | A |
| D2 | PI 是否纳入 P1-D-03-02（同族模板） | 纳入（复用同一套 rc 组件，增量小）；如求最小交付可后置 |
| D3 | 明细列形态（§4 L1） | B：RunCheng 布局 + 规格并入 spec 单元格 |
| D4 | 大写金额/签名栏/Photo 列（L2-L4） | 均含 |
| D5 | HS Code 列 / 自定义列（L5、R10） | 均不进首版 |
| D6 | LOGO 存储：settings 新键 base64 | 是；≤128px 高内嵌 |

---

*本报告基于只读勘察产出；所有结论均有文件路径与行号依据（正文已标注）。分析过程中未修改任何业务代码、测试、数据或配置；未触碰生产版本与生产数据。等待 ChatGPT 独立审查确认后再进入 P1-D-03-02。*
