# P1-D-04 实施与验收报告 —— 五类单据统一 RunCheng 黑白输出格式

**阶段**：P1-D-04（只做输出格式统一，不加功能、不扩范围）
**基线**：`siwang-box-fix-BUGACC01-20261121.zip`（P1-ACCEPT + BUG-ACC-01 定点修复，产品版本 siwang-box-desktop 0.2.17）
**日期**：2026-11-21
**结论**：QT / PI / SC / CI / PL 五类单据已统一到同一套 RunCheng 黑白商务表格版式（`quotation-rc-v1`），
**格式统一、业务内容各自不同**。回归 **1439/1439**、E2E **180/180**、5 份真实 PDF 机器校验 **0 问题**、
几何记录五类完全一致（left 3.7mm / top 4.9mm / 右余量 3.4mm）。
**分页还原（本轮）**：取消 `.rc-bottom` 的强制分页后，2 行明细样张五类均为 **1 页**，条款/汇总/大写/签名/页脚紧接明细表；
8 行明细的自然分页仍为 2 页，第 2 页 top **0.0mm**（与 RunCheng 原版一致）。
QT 的 P1-D-03R 版式无回退；未改定价引擎、未改 Schema V5、未迁移生产数据、未重构编辑器。

---

## 一、目标与判据

| 项 | 要求 | 本轮落地 |
|---|---|---|
| 格式统一 | 五类共用同一套纸面骨架 | 抬头 / 标题行 / 买方+单据信息双栏 / 明细表 / 条款+汇总 / 双签名 / 页脚，五类完全同构 |
| 内容各异 | 只换业务内容，不是复制 QT 内容、也不是只改标题 | 标题、单据信息行、明细列、条款行、汇总口径按类型切换（见 §三） |
| LOGO | 复用既有 RunCheng 原版 LOGO，不重做、不换占位图 | 继续走 `SheetRC.logoFor` / `logoFromUserDataDir`，`DEFAULT_LOGO` 原样未动 |
| 视觉基准 | 用户提供的 RunCheng 原版 QUOTATION 截图 | 仍用 P1-D-03R 已验收的黑白版式参数（字体/字号/边框/列宽/图片位/留白/分页） |
| 不做的事 | 不新建复杂模板系统、不重构编辑器 | 仍是同一个 `quotation-rc-v1`，只把「仅 QT」的类型门拆掉 |
| 保护项 | 产品库/客户快照/核价引擎/成交价保护/五类增删改存/PDF 导出 | 全部未触碰（`pricing.js` 0 改动、Schema V5 0 改动） |

---

## 二、代码改动（9 个文件，+301 / −169）

明细见 `P1D04-code-diff.patch`；文件级清单见工程根 `CHANGE-VS-BUGACC01.txt`。

### 1. `app/sheet-rc.js`（核心，主要改动）

原来 `build()` 第一行是 `if(!doc||doc.type!=='QT')return null;`——非 QT 一律打回基础版。
本轮把这段改成「五类共用骨架 + 按类型换内容」：

* 新增模块级常量：`TITLES`（五类标题）、`FOOT_LABELS`（页脚单据名）、`NO_LABELS`（单据号标签）、`PACK_MODES`。
* 新增 8 个渲染块工厂函数，**骨架部分五类完全同一份代码**：
  `headBlock` / `titleBlock` / `infoBlock` / `itemsBlock` / `bottomBlock` / `signBlock` / `footBlock`；
* `colPlan(type)` 决定明细列：QT/PI 八列、SC/CI 九列（+HS CODE）、PL 十列（+PACKAGES/N.W./G.W./CBM，无价格）；
* `termsRows(type)` 决定条款行：PI 带 Bank Details、SC 带合同条款与签署、CI 带 Shipment/Vessel/Port of Origin + Bank、PL 换成 PACKING & SHIPPING；
* `bottomBlock`：金额类仍是 Subtotal/Freight/Discount/Other/TOTAL + Amount in Words；PL 右侧换成
  Total Packages / Total N.W. / Total G.W. / Total CBM（`Model.packagingTotals`），**整张纸没有单价与金额**。
* 两处取值口径修正（避免「同一份单据两处数字打架」）：
  * PL 的 `DOCUMENT INFO · Total Packages` 改为与右下汇总表同源（分开包装时用行汇总值，不再显示「—」）；
  * SC/CI 补回 `Bank Details` 行——基础版本来会印银行信息，统一版式不能把这项业务字段弄丢。

### 2. `app/sheet.js`

* 新增 `DEFAULT_TEMPLATE_ID = 'quotation-rc-v1'`：**没声明模板就用统一版式**（存量单据因此也自动统一）。
* **删除 `gateTemplate()` 与「按单据类型设门」的逻辑**：`templateFor(doc)` 现在是「声明了就用声明值，没声明就用默认统一版式」。
* `build()` 入口改为 `var resolved = opts.templateId || templateFor(doc);`；显式 `basic-v1` / `trade-v1` / 参考文件模板仍按声明渲染（手动选择能力保留）。
* 保留 BUG-ACC-01 的成果：**回落过程不产出任何内部模板诊断注记**（`tplNote` / `q-tpl-note` 仍为 0）。

### 3. `app/model.js`

* 删除 BUG-ACC-01 时期的「转换时清掉不适用于非 QT 的 `quoteLayout.templateId`」块。
  前提已取消（同一版式对目标单据同样适用），继续清会让转换件丢失版式声明。
  链接：QT → PI → SC → CI 与 QT → PL 转换后 `storedTpl` 均为 `quotation-rc-v1`（见 `P1D04-pdf-targets.json`）。

### 4. `app/pages.js`

* `Doc.newDraft`：五类新建草稿都写入 `quoteLayout.templateId='quotation-rc-v1'`（原来只有 QT）。
* `Doc.templateSelectHTML`：下拉固定为「RunCheng 统一版式 / 基础单据版 / 贸易报价版」，不再按类型隐藏 RC，**「仅适用于报价单」提示整段删除**。
* `Doc.templateId / templateName / setTemplate`：统一到 `Sheet.templateFor` 的「生效模板」口径；`setTemplate` 去掉「RC 只给 QT」的拦截。

### 5. `app/reference-editor.js`

* `ReferenceEditor.choices()`：五类都把 `quotation-rc-v1` 排在第一位；PL 的参考文件模板（packing-ref / shipping-mark）、PI 的 jr-pi、旧 trade 版全部保留。
* `Doc.templateId / templateName` 改为读生效模板（不再区分「声明 / 生效」两套语义——统一后二者不会分叉）。

### 6. `pdf-export.cjs`

* `exportPdf` 里的 `rc` 判据从 `doc.templateId` 改为 `Sheet.templateFor(doc)`，与 `buildHtml` 同一口径。
  否则「未声明模板的存量单据」会出现「RC 正文 + 基础版 12mm 边距 + 页面页脚」的错配。

### 7. `app/app.css`

* `.rc-title` 加 `white-space:nowrap`（`PROFORMA INVOICE` / `COMMERCIAL INVOICE` 长标题不折行）；
* 新增 `.rc-packs`（PL 包装汇总表标签左对齐，与金额汇总同一套黑框语言）；
* 九列/十列不裁切：`col{min-width:0}` + 名称/规格列允许任意位置折行；数字列**不加** nowrap（固定列宽下会挤到相邻单元格）。

### 8. 测试同步（`tests/p1d3/run.js`、`tests/p1c/run.js`）

契约反转必须同步，否则回归会「红得合理」：

| 断言 | 旧契约（BUG-ACC-01） | 新契约（P1-D-04） |
|---|---|---|
| A5 | PI 显式请求 RC → 回落 `basic-v1` | PI 显式请求 RC → 得到 RC |
| A7 | PI 未声明 → `basic-v1` | PI 未声明 → 默认 RC |
| A9 | `SheetRC.build(PL)` 返回 null | 五类之外才返回 null |
| G1/G3/G5 | SC/CI/PL 默认 `basic-v1` | SC/CI/PL 默认 RC |
| G2/G4 | SC 条款 `Terms & Conditions:`、CI `HS Code` | RC 列头为大写/转义形态：`Terms &amp; Conditions`、`HS CODE` |
| p1c F4 | 新建 PL 的 `_unknown` 必须为空 | 允许 `_unknown.quoteLayout`（版式声明），仍禁止 `_unknown.pricing` |

断言条数不变：`tests/p1d3` 仍 114 项、`tests/p1c` 仍 229 项，全量仍是 **1439**。

---

## 三、五类单据：哪些相同、哪些不同

### 完全相同（骨架，同一份代码）

| 版块 | 内容 |
|---|---|
| 抬头 | 左 RunCheng 原版 LOGO（64px 高）+ 右公司名/地址/`Tel | WhatsApp`/`Email | Web`，底部 2px 黑线 |
| 标题行 | 左大号加粗标题（28px）+ 右 No./Date 小字右对齐 |
| 双栏 | 左 `BUYER / CONSIGNEE`（Company/Contact/Address/Country/Email/Phone）+ 右 `DOCUMENT INFO`，1.2px 黑框、标题行下划线 |
| 明细表 | 全黑边框、独立 `PHOTO` 列（79×66.5）、固定行高 93px、表头 9.5px |
| 条款区 | 左侧黑框表格（标题行跨两列）、标签列 27% 竖线分隔 |
| 签名区 | `For the Seller` / `For the Buyer` 双区块，各自 2px 顶线 |
| 页脚 | 通栏 2px 黑线 + 居中「公司 · 单号 · 单据全称」 |
| 分页 | 第 1 页 `padding:4mm 3.7mm 0`，第 2 页起顶部 0；**不再强制另起一页**（本轮取消 `.rc-bottom` 的 `break-before:page`）；表头跨页重复；行/汇总/签名/大写/条款块 `break-inside:avoid` 不拆行 |

### 各自不同（业务内容）

| 类型 | 标题 | 单据信息（右栏） | 明细列 | 条款行 | 汇总区 |
|---|---|---|---|---|---|
| QT | QUOTATION | Quote No. / Date / Salesperson / Currency / Trade Term / Named Place / Valid Until | NO. PHOTO PRODUCT NAME SPECIFICATION QTY UNIT UNIT PRICE AMOUNT | Payment Terms / Production Lead Time / Packaging / Notes | Subtotal→TOTAL + 大写 |
| PI | PROFORMA INVOICE | PI No. … 同上 | 同 QT（八列） | + Delivery / Validity / **Bank Details** | 同上 |
| SC | SALES CONTRACT | Contract No. … + **Sign Date / Sign Place**（标题行也带） | **九列**（+HS CODE） | + **Terms & Conditions**（合同条款原文）+ Bank | 同上 |
| CI | COMMERCIAL INVOICE | Invoice No. … 同上 | **九列**（+HS CODE） | + **Shipment / Vessel / Port of Origin** + Bank | 同上 |
| PL | PACKING LIST | PL No. … / **Packing Mode / Total Packages**（无 Currency、无 Valid Until） | **十列**：…PACKAGES N.W.(KG) G.W.(KG) CBM，**无 UNIT PRICE / AMOUNT** | 换成 **PACKING & SHIPPING**：Shipping Marks / Packing Mode / Notes | **包装汇总**：Total Packages / N.W. / G.W. / CBM，**无金额、无大写** |

---

## 四、验收（对应任务书「六、验收标准」8 条）

样张全部由**生产导出通道**产出：`createPdfExporter → readSavedDocument → Model.validateForExport → buildHtml → 沙箱隐藏窗口 → printToPDF → 原子落盘`。隔离 userData 为 `E:/CDriveMigration/Temp/acc/ud`，生产数据零接触。

PI / SC / CI / PL 四份**全部取自转换链**（非直接新建）：`PI-202611-0002 ← QT`、`SC-202611-0002 ← PI`、`CI-202611-0002 ← SC`、`PL-202611-0002 ← QT`，四者 `storedTpl` 均为 `quotation-rc-v1`（见 `P1D04-pdf-targets.json`）。

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 五份 PDF 抬头 LOGO 一致 | ✅ 同一张原版 RunCheng JPEG（`data:image/jpeg;base64`），同一位置同一尺寸 | `pdf-*-p1.png`；校验项 `must:[公司名…]` 全通过 |
| 2 | 黑白商务风格一致 | ✅ 无绿/蓝基础版配色，五类同一字体族、同一套黑框与线宽 | `screenshots/format-uniform-five-types-p1.png` |
| 3 | 标题与字段按类型正确 | ✅ `QUOTATION` / `PROFORMA INVOICE` / `SALES CONTRACT` / `COMMERCIAL INVOICE` / `PACKING LIST`；右栏单据号标签按类型换 | `P1D04-pdf-verify.json` 的 `missing` 全为空 |
| 4 | 产品图/数量/单价/金额正确 | ✅ 两行均有实拍图与规格；金额 = qty × price（14.13×2=28.26、26.79×1=26.79，合计 55.05）；TOTAL 与大写一致（FIFTY FIVE AND 05/100 ONLY） | `screenshots/pdf-QT-p1.png`、`P1D04-pdf-verify.json` |
| 5 | **PL 无单价无金额** | ✅ 纸面文本中 `UNIT PRICE` / `AMOUNT` / `TOTAL AMOUNT` / `Amount in Words` **一次都不出现**（校验脚本按 `must_not` 断言） | `P1D04-pdf-verify.json` 中 PL 的 `unexpected: []` |
| 6 | A4 预览与 PDF 一致 | ✅ 预览纸面宽 794px = 210mm，`data-template="quotation-rc-v1"`；五类预览内容与 PDF 同源同一函数；差异仅分页（预览为连续纸面，分页由打印引擎执行，与 P1-D-03R 已验收行为一致） | `P1D04-preview-shots.json`、`screenshots/preview-*.png` |
| 7 | 无核价泄漏、无内部模板字样 | ✅ 20 个内部核价字段 + 11 个模板字样，五份 PDF 抽取文本命中 **0** | `P1D04-pdf-verify.json` 的 `leak` / `template_leak` 全为 `[]` |
| 8 | 无裁切、无溢出 | ✅ 五类几何完全一致：left **3.7mm** / top **4.9mm** / 右余量 **3.4mm**；页脚下方仍有 108–378 CSS px 留白；每页均 A4 | `P1D04-geometry.txt` |
| + | **QT 版式不得回退** | ✅ 与 P1-D-03R 同一套参数（LOGO/八列/条款+汇总并排/双签名/页脚）；8 行明细自然分页时第 2 页顶仍为 0 | `screenshots/pdf-QT-p1.png`、`screenshots/pagination-long-QT-p2.png` |
| + | **分页还原（本轮）** | ✅ 2 行明细五类各 **1 页**，条款块距明细表头仅 209–210 CSS px（= 2 行明细高度），纵向顺序 明细→条款/汇总→大写→签名→页脚；8 行明细**自然分页**为 2 页，第 1 页表格底边完整、第 2 页 top 0.0mm | `P1D04-pagination.md`、`P1D04-pagination.json`、`P1D04-geometry.txt`、`screenshots/pagination-*.png` |

### 回归与 E2E

| 套件 | 断言 | 结果 |
|---|---|---|
| tests/schema | 194 | ALL PASS |
| tests/p1c | 229 | ALL PASS |
| tests/p1d | 51 | ALL PASS |
| tests/p1d3 | 114 | ALL PASS |
| tests/pricing | 851 | ALL PASS |
| **合计** | **1439** | **1439 / 1439** |

E2E：**180 / 180**（S1–S10，隔离 userData 清空后重新播种，`P1D04-e2e-full.log`）。

E2E 中两处契约同步（与本轮反转一致，断言条数不变）：
* `S2 PI/SC/CI/PL 默认同一 RC 版式（P1-D-04）`（原「不串 RC 模板」）；
* `S9 非 QT 单据同样按统一版式渲染`（原「非 QT 一律按基础版渲染」）。

---

## 五、交付物

```
docs/integration/p1d04/
├─ P1D04-report.md                 本报告
├─ P1D04-code-diff.patch           9 文件统一 diff（+301 / −169）
├─ P1D04-regression-full.log       1439 项回归（含各套件原始汇总行）
├─ P1D04-regression-{schema,p1c,p1d,p1d3,pricing}.log  五套逐条原始输出
├─ P1D04-e2e-full.log              E2E 180/180 全量日志
├─ P1D04-e2e-result.json           E2E 机器可读结果（含每条断言）
├─ P1D04-e2e-scenarios.js          E2E 场景定义（含本轮更新的 2 条契约）
├─ P1D04-e2e-driver.js / -runner.js  E2E 驱动与运行器
├─ P1D04-pdf-verify.json           5 份 PDF 机器校验结果
├─ P1D04-verify-pdf.py             校验脚本（A4/文案/泄漏/几何/自然分页第2页顶）
├─ P1D04-pagination.md             分页还原验收记录（改前/改后/自然分页/原版对照）
├─ P1D04-pagination.json           分页专项机器校验结果
├─ P1D04-verify-pagination.py      分页专项校验脚本
├─ P1D04-geometry.txt              五类逐页几何 + 自然分页 + 原版参考
├─ P1D04-pdf-targets.json          五类导出目标与转换链
├─ P1D04-pdf-runner.cjs            生产导出通道驱动
├─ P1D04-prep-pl.js                导出前置：补齐转换版 PL 包装数据
├─ P1D04-prep-content.js           导出前置：为五类样张写入各自业务字段
├─ P1D04-smoke-five-types.js       五类渲染冒烟（模板/标题/列/无泄漏）
├─ P1D04-shot-runner.js            A4 预览截图驱动
├─ P1D04-preview-shots.json        预览截图元数据（宽 794px / RC 模板）
├─ P1D04-SHA256SUMS.txt            本目录文件哈希（作用域仅限本目录，全包清单见根 SHA256SUMS.txt）
├─ pdf-samples/                    5 份真实 PDF（QT/PI/SC/CI/PL，本轮均为 1 页）
├─ pagination/QT-LONG-8ITEMS.pdf   8 行明细的自然分页样张（2 页，测试用）
└─ screenshots/
   ├─ format-uniform-five-types-p1.png   五类首页并排对照
   ├─ preview-{QT,PI,SC,CI,PL}.png       应用内 A4 预览截图（5 张）
   ├─ pdf-{QT,PI,SC,CI,PL}-p1.png        五类正式样张逐页渲染（5 张）
   ├─ pagination-{before,long,ref-original}-QT/p-original-p{1,2}.png  改前/自然分页/原版对照
   └─ pagination-ref-original-p{1,2}.png  RunCheng 原版两页参考
```

包内文件哈希见 `P1D04-SHA256SUMS.txt`；最终整包见工程根 `siwang-box-p1d04-final-20261121.zip` 与同名 `.sha256`
（原始 `siwang-box-p1d04-20261121.zip` 保持未覆盖，作为本轮比对基线）。

---

## 六、明确未做的事（守住范围）

* 未新增任何业务功能、未新增模板系统、未重构编辑器；
* 未改 `app/pricing.js`、未改 Schema V5、未改定价公式与成交价保护；
* 未迁移生产数据、未覆盖生产版本（全部在隔离 userData 中完成）；
* 未重新制作 LOGO，未把占位图放进纸面；
* 未把「预览也强制分页」当成本轮任务（预览为连续纸面；本轮 PDF 也已改为按内容自然分页，不再强制断页）。

## 七、遗留说明（供独立验收判断，不擅自扩大改动）

1. **SC/CI 的 HS CODE 在转换链上初始为空**：QT/PI 纸面没有 HS 列，转换时按既有规则 `delete row.hsCode`，
   所以 QT→PI→SC→CI 传下来的 HS 是空值，纸面显示 `—`（不编造）。本轮样张为便于验收，
   通过真实编辑器在隔离副本里填入了 `3925900000`（见 `P1D04-prep-content.js`，属导出前置数据准备，不计入 E2E 断言）。
2. **A4 预览为连续纸面**：预览层不分页；**PDF 本轮已取消 `break-before:page`**，2 行明细样张五类均为 1 页，
   只在真实内容超过一页时自然分页（8 行明细 QT 为 2 页、第 2 页顶 0）。预览截图复跑后逐字节未变。
   详见 `P1D04-pagination.md`。
3. **PL 的 `Email` / `Phone` 显示 `—`**：买方快照（Schema V5）不含这两项，属于既有边界，本轮未扩 Schema。

## 八、最终交付轮：分页验收脚本坐标检测修正

分页还原后，独立验收发现 `P1D04-verify-pagination.py` 用 pypdf `tm[5]` 取纵坐标不可靠
（文本矩阵变换量、多页跨页累加，五份样张被误报）。最终轮**只修该验收工具并完成交付**：
改用 pypdfium2 `PdfTextPage.get_charbox(i)` 真实字符边界框计算位置，不写死坐标、不跳过断言、
不降低标准；五类 PDF 分页校验 5/5 PASS、8 行自然分页 PASS、间距 208.9 / 207.9 CSS px 与 208–209 一致；
`P1D04-pagination.json` 确定性输出（无时间戳，两次运行 stdout 逐字节相同），专项日志见
`P1D04-pagination-test.log`，与基线逐文件差异见根 `FINAL-DIFF-VS-P1D04-BASELINE.txt`。

本轮**未改任何业务代码**、未重新导出 5 份 PDF、未重新设计报价单、未改 Schema V5 / 定价公式 /
数据库 / 生产数据、未进入 P1-D-05；16 个业务代码文件与 P1-D-04 基线逐字节一致。
详见 `P1D04-pagination.md` §7 与 `P1D04-final-acceptance.md` §8。
