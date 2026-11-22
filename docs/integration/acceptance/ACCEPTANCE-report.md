# RunCheng × 丝网盒子 —— 最终整体验收与合并准备报告

**阶段**：P1-ACCEPT（整体功能验收，非开发阶段）
**基线**：`P1-D-03R`，git commit `6039277`（"P1-D-03R: page 2 starts at y=0 like the reference PDF"）
**产品版本**：siwang-box-desktop 0.2.17
**日期**：2026-11-21
**结论**：**功能面通过（175/180 断言 PASS）；发现 1 个真实缺陷（BUG-ACC-01），影响客户可见纸面，建议修复后复验再合并。本阶段未修改任何产品代码。**

---

## 一、验收口径与本轮边界

按验收任务书 10 条执行，逐条落点如下（详细证据见第四~七节）：

| # | 要求 | 结论 | 证据 |
|---|---|---|---|
| 1 | 不修改已验收的 RunCheng QT 版式 | 遵守：`app/sheet-rc.js`、`app/app.css` 零改动；QT 纸面回归通过 | §五、§六 |
| 2 | 不新增业务功能、不重构 | 遵守：210 个受版本控制文件全部未改 | §三 |
| 3 | 不修改冻结的定价引擎与 Schema V5 | 遵守：`app/pricing.js`、`app/model.js` 零改动；1439 项历史回归全绿 | §三、§四 |
| 4 | QT / PI / SC / CI / PL 五类单据完整业务测试 | 通过 | §五 S2/S3/S6/S10 |
| 5 | 新建 / 编辑 / 保存 / 重开 / 转换 / A4 预览 / PDF 导出 | 通过（PDF 导出 5 类全部走生产通道） | §五、§六 |
| 6 | 产品成本 / 订单费用 / 运费 / 汇率 / 利润 / 手续费 / 成交价保护 | **36 项断言全通过**，逐项可复算 | §五 S5 |
| 7 | 历史数据不被修改；PL 不泄漏内部核价 | 通过（含"放弃修改不落盘"与纸面洁净度） | §五 S7/S8/S9 |
| 8 | 隔离数据副本，不触碰生产数据库 | 遵守：`SBW_USERDATA` 指向独立目录，生产 `%APPDATA%` 只读未写 | §二 |
| 9 | 检查全部历史回归，生成完整测试日志 | 5 套 1439 项全绿 | §四 |
| 10 | ZIP + SHA-256 清单 + 差异报告 + 验收报告 | 本次交付 | §八 |

**未执行**：生产数据迁移、覆盖正式版本、任何代码修改（含"顺手修一下"）。

---

## 二、测试环境与隔离性

| 项 | 值 |
|---|---|
| 应用 | `siwang-box-main`，Electron 真实进程（非 jsdom 模拟） |
| 隔离 userData | `E:\CDriveMigration\Temp\acc\ud`（每轮 `rm -rf` 后重建） |
| 生产 userData | **未触碰**。测试进程以 `SBW_USERDATA` 覆盖 userData 路径，主进程逐场景打印 `USERDATA=…\acc\ud` + `ISOLATED=explicit` 确认（见 `screenshots/S*.stdout.txt` 前两行）。另：本机 `%APPDATA%\siwang*` 目录不存在（从未安装运行过正式版），因此不存在被误写的可能 |
| 数据文件 | `ud/data/siwangbox-v5.json`（Schema V5，全新库） |
| 窗口 | 1440×900，offscreen 截图模式，关闭走真实关闭路径（`SBW_CLOSE_TEST`） |
| 进程模型 | 每个场景一个独立 Electron 进程，串行执行；"保存 → 退出进程 → 新进程重开"是真实落盘往返 |

关于 `ELECTRON_RUN_AS_NODE`：本机环境默认置位该变量，会阻止 Electron 以 GUI 方式启动
（表现为 `TypeError: Cannot read properties of undefined (reading 'setPath')`）。验收脚本在
`spawn` 前显式删除该变量，属环境适配，不涉及产品代码。

---

## 三、代码冻结核验

```
$ git status --short          # 空输出
$ git log --oneline -1
6039277 P1-D-03R: page 2 starts at y=0 like the reference PDF
$ git ls-files | wc -l
210
```

- 工作树干净，无未提交改动。
- 本轮新增内容**全部在 `docs/integration/acceptance/`** 之下（验收证据与脚本），
  不进入运行时代码路径。
- 冻结模块确认零改动：`app/pricing.js`（定价引擎）、`app/model.js`（Schema V5）、
  `app/sheet-rc.js`（QT 版式）、`app/app.css`（含 `.rc-*` 样式块）、`app/sheet.js`、
  `pdf-export.cjs`。
- 验收脚本本身通过公开 API 驱动（`Doc.*` / `Store.*` / `P1C.*` / `Pricing.*`），
  不 patch、不 monkey-patch 任何产品函数，因此测到的是真实行为。

---

## 四、历史回归：5 套 1439 项，全部 PASS

日志：`ACCEPTANCE-regression-full.log`（1539 行，完整原始输出）

| 套件 | 检查项 | 结果 | 覆盖 |
|---|---|---|---|
| `tests/schema`（P1-B Schema V5） | 194 | PASS 194 / FAIL 0 | v3→v4→v5 迁移、写门、非法数据拒绝、幂等、损坏文件保护 |
| `tests/pricing`（P1-A 定价） | 851 | PASS 851 / FAIL 0 | 润成 26 项原始口径 ×3 环境（node-require / vm / renderer-global）+ 三环境一致性 + 边界 ×3 |
| `tests/p1c`（P1-C 核价与费用） | 229 | PASS 229 / FAIL 0 | 费用分摊、汇率、运费、成本确认、建议价、成交价保护、stale 门 |
| `tests/p1d`（P1-D 版面选择） | 51 | PASS 51 / FAIL 0 | 模板分发与纸面选择 |
| `tests/p1d3`（P1-D-03R 版式） | 114 | PASS 114 / FAIL 0 | QT 1:1 版式、双栏、八列、条款、大写、签名、页脚、LOGO 与联系方式三级来源 |
| **合计** | **1439** | **全 PASS** | — |

> 三环境一致性（node-require / vm / renderer-global）同时全绿，说明引擎在渲染进程内
> 与 Node 内的计算结果逐字节一致——这是 E2E 断言可信的前提。

---

## 五、端到端业务验收：10 场景 180 项断言

日志：`ACCEPTANCE-e2e-full.log`；机器可读：`ACCEPTANCE-e2e-result.json`
脚本：`ACCEPTANCE-e2e-scenarios.js` / `ACCEPTANCE-e2e-driver.js` / `ACCEPTANCE-e2e-runner.js`
截图：`screenshots/S1..S10-*.png`（含每场景主进程原始输出 `*.stdout.txt`）

| 场景 | 断言 | PASS | FAIL | 耗时 ms | 覆盖点 |
|---|---|---|---|---|---|
| S1-seed | 7 | 7 | 0 | 4484 | 清演示数据、公司抬头、产品库、客户库、核价默认值 |
| S2-five-docs-create | 18 | 18 | 0 | 9442 | 五类单据新建+保存+自动单号+行数+模板不串 |
| S3-reopen | 32 | 32 | 0 | 8386 | **新进程**重开：单号/行数/客户/合计/卖方快照/PL 包装 |
| S4-convert | 23 | 23 | 0 | 9352 | QT→PI→SC→CI 链式转换 + QT→PL，sourceId 指向、金额不带入 PL |
| S5-pricing | 36 | 36 | 0 | 11433 | 核价七要素 + 成交价保护（明细见 §5.1） |
| S6-preview-a4 | 24 | 24 | 0 | 7357 | 五类纸面 HTML 渲染、RC 版式节点、页脚大小写、金额大写同源 |
| S7-pl-no-leak | 8 | 8 | 0 | 6369 | PL 纸面无 18 个内部字段、无单价/汇总/大写；QT 对照组有 |
| S8-history-readonly | 4 | 4 | 0 | 7689 | 只读打开不写库、放弃修改不落盘、历史合计自洽 |
| S9-paper-cleanliness | 19 | 15 | **4** | 8682 | 全部 9 张单纸面洁净度 → **命中 BUG-ACC-01** |
| S10-preview-a4-ui | 9 | 8 | **1** | 8705 | 真实 `Doc.print()` 预览层：A4 宽度、导出按钮、五类可预览 → **同 BUG** |
| **合计** | **180** | **175** | **5** | — | **5 个 FAIL 全部来自同一个缺陷** |

### 5.1 核价七要素逐项复算（S5，36/36 PASS）

夹具可直接复算：2 行产品，qty 2 + 1；单件成本 CNY 60+5+3+1 = 69 与 120+8+4+2 = 134；
基础成本 272 CNY；fx = 7.1；订单费用 35.50 CNY；运费 handling 142 + inland 71 CNY、forwarder 40 USD。

| 要素 | 断言 | 实测 | 期望 | 结论 |
|---|---|---|---|---|
| ① 产品成本 | 行1 单件成本 | 80.835 | 69 + 23.67/2 | 一致 |
| ① 产品成本 | 行2 单件成本 | 145.83 | 134 + 11.83/1 | 一致 |
| ① 产品成本 | 基础成本折 USD | 43.31 | 272/7.1 + 35.5/7.1 = 38.31 + 5.00 | 一致 |
| ② 订单费用 | 分摊状态 | `auto`（23.67 / 11.83） | 按数量自动分摊 | 一致 |
| ② 订单费用 | 去掉费用后纯利润差 | 12.99 − 7.99 = 5.00 | 35.5/7.1 | 一致 |
| ③ 运费 | 实际运费 | 70.00 | 213/7.1 + 40 | 一致 |
| ③ 运费 | forwarder 未核实 | 30.00，且 `ready=false` | 不计入、不放行 | 一致 |
| ③ 运费 | 加价率 10% | 客户运费 = 实际 × 1.10 | — | 一致 |
| ④ 汇率 | fx 7.1→6.5 | 成本 43.31→47.31，建议价 16.44→17.95 | 同向放大 | 一致 |
| ④ 汇率 | fx=null | `ready=false` 且建议价全 null | 阻断 | 一致 |
| ⑤ 利润 | 加成 40%→20% | 建议价 16.44→14.09 | 单调下降 | 一致 |
| ⑤ 利润 | targetMargin=null | `ready=false` | 阻断 | 一致 |
| ⑥ 手续费 | feeRate 3%→6% | 销售手续费 3.75→7.50，建议价 16.44→17.18 | 含费模式同向 | 一致 |
| ⑥ 提成 | 纯利润 7.99 | 提成 1.60，公司利润 6.39 | 1.598 / 6.390 | 一致 |
| ⑦ 成交价保护 | 手改 99.99 | 价格保持 99.99，`used_price=99.99`，建议价仍 16.44 | 不被覆盖、不被反向污染 | 一致 |

边界补充（均 PASS）：费用金额缺失 → 阻断且不按 0 处理；分摊 rowId 失配 → pending 阻断；
成本未确认 → 不放行正式核价并出「采购成本未确认」告警；非 USD 币种 → 停用自动核价并给出中文说明。

### 5.2 历史数据与 PL 隔离（S7 / S8）

- S7：PL 纸面扫 18 个内部字段（`costFactory`/`costPacking`/`markupRate`/`targetMargin`/
  `commissionRate`/`feeRate`/`suggested_price`/`采购价`/`底价`/`毛利`/`供应商` 等）**零命中**；
  且不含 `UNIT PRICE`、`TOTAL AMOUNT`、`Amount in Words`；含包装列。
  同一套扫描在 QT 上命中（`UNIT PRICE`、`TOTAL AMOUNT`、`costFactory`），证明扫描不是全否误判。
- S8：只读打开编辑器 + 渲染纸面 + 查询单据，前后 `Store.raw()` JSON 逐字节相同；
  改动 `remark` 后 `Doc.discard()`，库内容仍与快照相同；历史合计与明细自算值一致（55.05）。

---

## 六、PDF 导出：走生产通道，5 类全部产出

导出器不是"重现一份 HTML"，而是调用产品真实函数链：
`createPdfExporter` → `store.readSavedDocument` → `Model.validateForExport` → `buildHtml`
→ 沙箱隐藏窗口（`javascript:false`）→ `printToPDF({preferCSSPageSize:true, margins:0})` → 原子落盘。
仅把 `dialog.showSaveDialog` 换成固定路径，其余零改动。

样本：`pdf-samples/`　机器校验：`ACCEPTANCE-pdf-verify.json`（脚本 `ACCEPTANCE-verify-pdf.py`，pypdf + pypdfium2）

| 单据 | 页数 | 页面尺寸 | 关键文案 | 内部字段泄漏 | 结果 |
|---|---|---|---|---|---|
| QT-202611-0001 | 2 | 594.96×841.92 pt（A4） | 全部齐全 | 无 | **通过** |
| PI-202611-0002 | 1 | A4 | 齐全 | **命中** | **失败（BUG-ACC-01）** |
| SC-202611-0002 | 1 | A4 | 齐全 | **命中** | **失败（BUG-ACC-01）** |
| CI-202611-0002 | 1 | A4 | 齐全 | **命中** | **失败（BUG-ACC-01）** |
| PL-202611-0001 | 1 | A4 | 齐全 | 无 | **通过** |

**QT 第二页顶部起点回归**（P1-D-03R 已验收项）：栅格化后第一行墨迹在 **第 0 像素**
（scale=2，1 CSS px = 1.5 image px），即 CSS y=0，与 RunCheng 原版一致。本轮未回退。

**负例（导出前置校验有效）**：对包装信息不完整的 `PL-202611-0002` 调用导出，
被 `validateForExport` 正确拒绝，返回 `code=INCOMPLETE` 并逐项列出缺项——包装模式未选、
2 行的净重/毛重/体积均缺，共 7 条。未产生任何文件（`ok=false`, `size=0`）。
说明 PL 不会带着空包装数据流到客户手里。

---

## 七、缺陷清单

### BUG-ACC-01（阻断合并建议级）内部模板诊断注记被印进客户纸面

| 项 | 内容 |
|---|---|
| 严重度 | 中（客户可见；不损坏数据、不影响金额计算） |
| 状态 | **已定位、未修复**（按验收纪律「不擅自扩大修改范围」） |
| 影响面 | 由 RunCheng 模板 QT 转换出的 **PI / SC / CI / PL**；A4 预览与 PDF 导出**同时**受影响 |
| 受影响断言 | S9 的 4 项 + S10 的 1 项 = 5 项 FAIL（同一个缺陷） |

**现象**：这些单据的纸面第一行印出一行中文内部提示：

```
（quotation-rc-v1 仅适用于报价单 QT，本单按基础版 basic-v1 渲染）
```

它出现在 A4 预览层顶部与导出 PDF 的第一行，向客户暴露了内部模板标识
（`quotation-rc-v1`、`basic-v1`）。

**复现步骤**（全部在隔离副本中完成，无需改数据）：

1. 新建报价单 QT，确认纸面模板为 RunCheng 版式（`quotation-rc-v1`），保存 → 得到 `QT-202611-0001`。
2. 单据中心 → 该 QT → 「转换成「形式发票」」→ 保存 → 得到 `PI-202611-0002`。
   （同理转 SC / CI / PL）
3. 打开该 PI 的 A4 预览，或「导出 PDF」。
4. 纸面/PDF 第一行即为上述中文注记。

**根因链（三处，均已核对代码）**：

1. `app/model.js:1186 buildConversionDraft()` 转换时把源单 `_unknown`（含
   `_unknown.quoteLayout.templateId = 'quotation-rc-v1'`）整体带到目标单。
   实测落库结果：
   ```
   PL-202611-0002  templateId= quotation-rc-v1
   CI-202611-0002  templateId= quotation-rc-v1
   SC-202611-0002  templateId= quotation-rc-v1
   PI-202611-0002  templateId= quotation-rc-v1
   QT-202611-0001  templateId= quotation-rc-v1   ← 只有这张是合法的
   ```
2. `app/sheet.js:99 templateFor()` **不按单据类型设门**，直接把存着的
   `templateId` 返回给非 QT 单据。
3. `app/sheet.js:337`：`SheetRC.build()` 对非 QT 返回 `null`（正确），随后代码把
   内部注记 `rcNote`（`<div class="q-tpl-note">…</div>`）**拼进纸面 HTML** 再回落基础版——
   即"绝不静默"的提示被放进了客户文件。

**为什么现有回归没抓到**：`tests/p1d3` 只验 QT 纸面；`S7` 的泄漏扫描只跑 PL-0001
（S2 直接新建、templateId 为 null 的那张），恰好绕过了转换件。

**建议修复方向（两处，均为小改动，本轮未做）**：

- `Sheet.templateFor(doc)` 增加类型门：`doc.type !== 'QT'` 时直接返回基础版模板 id。
  这一处即可同时修掉预览与导出。
- `Sheet.build()` 的 `rcNote` 不要进纸面 HTML；编辑器侧已有面向用户的提示
  （`app/pages.js:1718`，橙色文字"本单模板为 quotation-rc-v1，但该版式仅适用于报价单（QT）"），
  保留那处即可，纸面应当完全静默回落到基础版。
- 可选加固：`buildConversionDraft` 在目标类型 ≠ QT 时把 `quoteLayout.templateId` 归零，
  避免"数据里存着一个不适用本类型的模板"这种脏状态继续传播。

**合并建议**：不阻断"合并准备"这项工作本身，但建议在正式替换旧报价系统之前修掉并复验
（复验只需重跑 S9 / S10 两个场景 + 重新导出 5 类 PDF，约 2 分钟）。

---

## 八、交付物清单

```
docs/integration/acceptance/
├─ ACCEPTANCE-report.md              ← 本报告
├─ ACCEPTANCE-regression-full.log    ← 5 套件 1439 项历史回归原始输出（1539 行）
├─ ACCEPTANCE-e2e-full.log           ← 10 场景 180 项断言原始输出（含主进程标记行）
├─ ACCEPTANCE-e2e-result.json        ← 机器可读断言结果 + 各场景实测载荷
├─ ACCEPTANCE-pdf-verify.json        ← 5 份 PDF 的页数/尺寸/文案/泄漏机器校验
├─ ACCEPTANCE-e2e-scenarios.js       ← 10 个场景定义（可重跑）
├─ ACCEPTANCE-e2e-driver.js          ← Electron 场景驱动
├─ ACCEPTANCE-e2e-runner.js          ← 串行执行 + 断言汇总 + JSON 落盘
├─ ACCEPTANCE-pdf-runner.cjs         ← 走生产导出通道的 PDF 批量导出
├─ ACCEPTANCE-verify-pdf.py          ← PDF 机器校验（pypdf + pypdfium2）
├─ ACCEPTANCE-SHA256SUMS.txt         ← 本交付包 SHA-256 清单
├─ pdf-samples/                      ← QT / PI / SC / CI / PL 各 1 份真实导出 PDF
└─ screenshots/                      ← S1..S10 界面截图 + 各场景主进程 stdtout 留档
CHANGE-VS-P1D03R.txt                 ← 差异报告（相对 P1-D-03R 基线）
```

**复现方式**（数据目录独立，可重复执行）：

```bash
cd docs/integration/acceptance
node ACCEPTANCE-e2e-runner.js        # 10 场景 E2E（约 90s），产物写入临时 userData
node ACCEPTANCE-verify-pdf.py        # PDF 机器校验
```

### 8.1 交付 ZIP

| 项 | 值 |
|---|---|
| 文件 | `siwang-box-acceptance-P1ACCEPT-20261121.zip`（与 `siwang-box-main/` 同级） |
| 自身 SHA-256 | 见同级旁注文件 `siwang-box-acceptance-P1ACCEPT-20261121.zip.sha256`（清单无法收录自身哈希） |
| 条目 | 247（246 个内容文件 + 1 个清单） |
| 内容 | `git archive HEAD`（210 个受版本控制文件，基线 `6039277`）+ 本轮验收材料 + `CHANGE-VS-P1D03R.txt` |
| 排除 | `node_modules/`、`data/`、`ud-*`、`tmp-*`、`dist/`、`out/`、`release/`（与 `.gitignore` 一致） |
| 完整性 | `zipfile.testzip()` 通过；清单内 246 条 SHA-256 全部复算一致（0 mismatch / 0 missing） |

`ACCEPTANCE-SHA256SUMS.txt` 为该 ZIP 的逐文件清单（`<sha256> *<相对路径>`，与
`sha256sum -c` 兼容），本清单自身不计入。校验方式：

```bash
cd <解压目录>
sha256sum -c docs/integration/acceptance/ACCEPTANCE-SHA256SUMS.txt
```

---

## 九、结论与建议

1. **功能面可用**：五类单据的新建/编辑/保存/重开/转换/A4 预览/PDF 导出全部跑通；
   核价七要素与成交价保护 36 项断言逐项复算一致；历史数据只读不被改写；PL 不泄漏内部核价。
2. **版式未回退**：P1-D-03R 的 QT 版式在真实 PDF 中保持——A4、2 页、第二页顶部从 y=0 起。
3. **1 个缺陷待修**：BUG-ACC-01（转换件的内部模板注记入纸）。属"内容洁净度"问题，
   不影响金额正确性与数据完整性，但对客户交付是明显瑕疵，建议合并前修复。
4. **未做的事**：没有做任何生产数据迁移，没有覆盖正式版本，没有修改一行产品代码。

等待 ChatGPT 独立验收。
