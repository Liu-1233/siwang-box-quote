# BUG-ACC-01 修复报告（第 2 轮 · 定点修复定稿）

**阶段**：P1-ACCEPT-FIX（单缺陷定点修复）
**基线**：`P1-D-03R` / `P1-ACCEPT`（git commit `6039277`，产品版本 siwang-box-desktop 0.2.17）
**验收依据**：P1-ACCEPT 交付包（`siwang-box-acceptance-P1ACCEPT-20261121.zip`）
**日期**：2026-11-21
**结论**：缺陷已修复。回归 **1439/1439**、E2E **180/180**、5 类 PDF 机器校验 **0 问题**；
QT 版式（P1-D-03R）无回退；未迁移数据、未改定价引擎与 Schema V5、未重构编辑器。

---

## 一、缺陷复述

由 RunCheng 模板报价单转换出来的 PI / SC / CI / PL，在 **A4 预览**与 **PDF 导出**里出现两处客户可见问题：

| 症状 | 表现 | 修复前实测 |
|---|---|---|
| ① 内部注记入纸 | 纸面第一行印出 `（quotation-rc-v1 仅适用于报价单 QT，本单按基础版 basic-v1 渲染）` | 4 张转换件全部命中 |
| ② 页边距被压成 0 | 转换件按 RC 版式的 0 边距排版，内容贴到纸张边缘并横向溢出，右侧表头与标题被裁切 | PI 左边距 **0.0 mm**、上边距 0.7 mm；`AMOUNT` 列与 `PROFORMA INVOICE` 标题被右缘切掉 |

症状 ② 与 ① 同一根因，一并修复（未扩大改动面，见 §四）。

---

## 二、根因（四处叠加，缺一不成立）

1. **`app/model.js:1186 buildConversionDraft()`** —— 转换时 `draft = clone(src)`，源单
   `_unknown.quoteLayout.templateId = 'quotation-rc-v1'` 被整体带到目标单据。
   这是 model.js「扩展字段不丢」的既定纪律，本身不改；但它让非 QT 单据长期存着一个
   「不适用于本类型」的模板声明。
2. **`app/sheet.js:99 templateFor()`** —— **不按单据类型设门**，直接把存着的模板标识当生效模板。
3. **`app/sheet.js:337`** —— `build()` 写作 `opts.templateId || templateFor(doc)`，
   **调用方显式传入模板 ID 时完全绕过模板判定**，只能靠下游 `SheetRC.build()` 对非 QT
   返回 `null` 兜底——属「下游碰巧拦住」，不是设计上的门。
4. **`app/sheet.js:358`** —— `SheetRC.build()` 返回 `null`（正常分支）后，代码把内部诊断注记
   `rcNote`（`<div class="q-tpl-note">…</div>`）拼进纸面 HTML 再回落基础版。原意是「绝不静默」，
   结果把内部提示交给了客户。

症状 ② 的来源：`pdf-export.cjs:17` 用 `Sheet.templateFor(doc)` 判定是否 RC 版式来决定页边距
（`rc ? 0 : '12mm 12mm 16mm'`）。第 2 点让转换件被误判为 RC，页边距被设成 0，而纸面实际渲染的
是基础版（没有 `.rc-sheet` 的内边距补偿）——内容贴纸边。

**为什么原有回归没抓到**：`tests/p1d3` 只验 QT 纸面；E2E 的 S7 泄漏扫描只扫了「直接新建、
templateId 为 null」的那张 PL，恰好绕过转换件。P1-ACCEPT 新增的 S9（逐张扫全部单据）+ S10
（真实预览层）才把它暴露出来。

---

## 三、修复方案（两层防线 + 一处契约同步）

设计原则：**渲染层必须自己不依赖数据干净**（存量单据不迁移也安全），**数据层负责让新单据源头干净**。
两层互不依赖，任一单独成立都能挡住缺陷。

### 3.1 渲染层：单一判定点 `gateTemplate()`，两条入口共用

```js
/* BUG-ACC-01：quotation-rc-v1 只允许报价单 QT 使用。
   两道入口都要拦——单据里存着的声明值（templateFor）与调用方显式传入的模板标识（build 的 opts.templateId）。 */
function gateTemplate(id, doc) {
  if (id === 'quotation-rc-v1' && (doc && doc.type) !== 'QT') return TEMPLATE_ID;
  return id;
}
function templateFor(doc) {
  var id = doc && doc._unknown && doc._unknown.quoteLayout && doc._unknown.quoteLayout.templateId;
  var resolved = TEMPLATE_IDS.indexOf(id) >= 0 ? id : TEMPLATE_ID;
  return gateTemplate(resolved, doc);          /* 存量声明值路径 */
}
// build(doc, opts)
var resolved = gateTemplate(opts.templateId || templateFor(doc), doc);   /* 显式传入路径 */
var activeTemplate = TEMPLATE_IDS.indexOf(opts.templateId) >= 0 ? gateTemplate(opts.templateId, doc) : templateFor(doc);
```

- **只拦 `quotation-rc-v1`**；`trade-v1` / `jr-pi-v1` / `packing-ref-v1` / `shipping-mark-v1`
  本身是跨类型模板，行为完全不变（探针 `L1-其他模板` 已验证：PI/SC 显式传 `trade-v1` 仍生效）。
- 因为 `pdf-export.cjs` 复用 `templateFor`，**一处设门同时修掉症状 ① 和 ②**，不需要改 `pdf-export.cjs`。
- 显式传入越界 ID 时连 `SheetRC` 分支都不进入（探针 `L1-显式` / `L1-非法` 覆盖五类单据）。

### 3.2 渲染层：纸面不再有任何内部模板注记的挂载位

- 删掉 `rcNote` 变量与它的注入（`SheetRC.build()` 返回 `null` 是正常分支，静默回落即可）。
- 删掉 `tplNote` 变量**本身**（上一轮已让它恒为空串），连拼装点 `+ tplNote +` 一并删除。
- 结果：纸面 HTML 里不再存在能承载「内部模板诊断」的结构，从根上杜绝复发。
  面向用户的「模板不适用于本单据类型」提示只留在编辑器界面（`app/pages.js`）。

### 3.3 数据层：转换时不把不适用的模板声明带过去（本轮新增，对应要求的「可选」项）

```js
/* 目标不是 QT 时，源单残留的 RunCheng 版式声明不再适用——在转换数据层就清掉 */
if (toType !== 'QT') {
  var qlay = isObj(draft._unknown) ? draft._unknown.quoteLayout : null;
  if (isObj(qlay) && qlay.templateId === 'quotation-rc-v1') {
    delete qlay.templateId;
    if (typeof qlay.templateName === 'string') delete qlay.templateName;
  }
}
```

- **只清这一对声明**：`templateId` 与其配套的 `templateName`（名字脱离版式没有意义，留着会让编辑器
  「当前模板」显示「RunCheng 报价版」而纸面走基础版）。
- **保留其他有效扩展字段**：`columns`（自定义列）、`hiddenColumns`（隐藏列）、用户自有的其他
  `_unknown` 键一律原样保留；不清空整个 `quoteLayout` 对象（探针 `L2-保留列` / `L2-保留隐藏列` /
  `L2-保留自有键`）。
- **不误清**：跨类型模板声明（`trade-v1` / `packing-ref-v1`）不动；同类 `QT→QT` 复制保留 rc
  （探针 `L2-同类`）。
- **不污染源单**：`draft` 是深拷贝，源单对象不被修改（探针 `L2-不污染源单`）。
- **不做数据迁移**：存量里已有的越界声明原样保留，由 3.1 的渲染门兜住（见 §5.4 存量样本 PDF 验证）。

### 3.4 `app/reference-editor.js` —— 分离「声明模板」与「生效模板」（1 行 + 注释）

`app/reference-editor.js:10` 把 `Doc.templateId` 覆盖成 `Sheet.templateFor(QuoteEdit.draft)`。
而 `Doc.templateId()` 是编辑器「当前声明模板」的唯一取值来源，`pages.js` 的提示靠它判断：

```js
${!isQT && cur === 'quotation-rc-v1' ? '<div class="t-sub">本单模板为 quotation-rc-v1，但该版式仅适用于报价单（QT）…' : ''}
```

`templateFor` 加了类型门后，若 `Doc.templateId` 继续复用它，带 rc 的存量单据 `cur` 会变成
`basic-v1`，**提示永远不显示**——纸面静默会退化成「用户毫不知情」。故拆开：

| 概念 | 取值 | 用途 |
|---|---|---|
| 声明模板 | `Doc.ensureQuoteLayout().templateId`（单据里存的原值） | 编辑器下拉框 + 适用范围提示 |
| 生效模板 | `Sheet.templateFor(doc)`（已过类型门） | 纸面渲染 + PDF 页边距 |

```js
Doc.templateId = function(){ return Doc.ensureQuoteLayout().templateId || 'basic-v1'; };
```

全仓 `Doc.templateId()` 仅 2 处调用：`pages.js:1709`（下拉框当前值 + 提示判断，正是本意）、
`pages.js:1920`（`Doc.templateName` 兜底，已被 `reference-editor.js:17` 覆盖，死代码）。
纸面渲染与 PDF 导出都不使用它。

### 3.5 `tests/p1d3/run.js` —— 更新 1 条过期断言（检查项数不变，仍 114）

`A6` 原本断言「回落**带**注记」，验证的正是本次要消除的旧契约，改为断言相反契约：

```js
ok('A6 回落不把内部模板注记写进纸面', htmlPI.indexOf('仅适用于报价单 QT') < 0 && htmlPI.indexOf('q-tpl-note') < 0);
```

同一 `ok()` 覆盖两个 token（中文文案 + DOM 类名），检查项数保持 1 项，套件仍 114，全量仍 1439。
`A5`（**显式传 rc 时回落基础版**）与 `A7`（存量 rc 模板同样回落）原样保留——`A5` 恰好就是本轮
「显式传 ID 也不得用 RC」那条要求，无需新增检查项。

---

## 四、改动范围（严格受控）

```
$ git diff --stat
 app/model.js            | 15 +++++++++++++++
 app/reference-editor.js |  8 +++++++-
 app/sheet.js            | 37 +++++++++++++++++++++++------------
 tests/p1d3/run.js       |  6 ++++--
 4 files changed, 49 insertions(+), 17 deletions(-)
```

| 文件 | 性质 | 改动 | 为什么必须动 |
|---|---|---|---|
| `app/sheet.js` | 产品代码 | 23+/14− | 类型门（两条入口）+ 纸面彻底去掉内部注记 |
| `app/model.js` | 产品代码 | 15+/0− | 转换时清理不适用模板声明（要求里的「可选」项，本轮已做） |
| `app/reference-editor.js` | 产品代码 | 7+/1− | 保住编辑器提示；不改则提示失效 |
| `tests/p1d3/run.js` | 测试 | 4+/2− | 原断言验证旧契约，不改则 1439 无法全绿 |

**未改动，逐项确认**：`app/pricing.js`、`app/sheet-rc.js`、`app/app.css`、`pdf-export.cjs`、
`app/pages.js`、`app/store.js`、`storage.js`、`main.js`、`preload.js`、`package.json`。
Schema V5（版本号、校验、写门、迁移）未动；报价计算 / 利润 / 手续费 / 费用分摊 / 成交价保护未动。
编辑器未重构、未加功能。

**没有做数据迁移**：存量单据里的 `templateId=quotation-rc-v1` 原样保留，靠渲染期类型门消除影响；
历史单据一字不改（S8「只读打开不写库」「放弃修改不落库」通过）。

**一处已知的无害残留**：`app/app.css:356` 的 `.q-tpl-note` 规则现已无人引用（纸面不再产出该节点）。
因「不修改 app.css」的约束保留未删，属死样式，不影响任何输出。

---

## 五、验收结果

### 5.1 历史回归：1439 项，全 PASS

日志：`FIX-regression-full.log`（1539 行原始输出，`PASS ` 行 1446，`FAIL ` 行 **0**）

| 套件 | 检查项 | 结果 |
|---|---|---|
| tests/schema | 194 | PASS 194 / FAIL 0 |
| tests/pricing | 851 | PASS 851 / FAIL 0 |
| tests/p1c | 229 | PASS 229 / FAIL 0 |
| tests/p1d | 51 | PASS 51 / FAIL 0 |
| tests/p1d3 | 114 | PASS 114 / FAIL 0 |
| **合计** | **1439** | **FAIL 0** |

### 5.2 端到端：180 项断言，180/180 PASS

日志：`FIX-e2e-full.log`　机器可读：`FIX-e2e-result.json`
本轮**清空隔离 userData 重新播种**（`ud/` 全部单据由本次代码新建），因此下表反映的是本轮代码的真实落盘状态。

| 场景 | 断言 | 结果 |
|---|---|---|
| S1-seed | 7 | PASS |
| S2-five-docs-create | 18 | PASS |
| S3-reopen | 32 | PASS |
| S4-convert | 23 | PASS |
| S5-pricing | 36 | PASS |
| S6-preview-a4 | 24 | PASS |
| S7-pl-no-leak | 8 | PASS |
| S8-history-readonly | 4 | PASS |
| **S9-paper-cleanliness** | **19** | **PASS** |
| **S10-preview-a4-ui** | **9** | **PASS** |
| **合计** | **180** | **180 PASS / 0 FAIL** |

S9 逐张单实测（9 张全扫，含 4 张转换件）：

| 单据 | 类型 | 库里存的 templateId | 纸面注记 | 内部字段 |
|---|---|---|---|---|
| QT-202611-0001 | QT（新建） | `quotation-rc-v1` | 无 | 无 |
| PI-202611-0002 | PI（**转换**） | **`null`** ← 数据层已清 | 无 | 无 |
| SC-202611-0002 | SC（**转换**） | **`null`** | 无 | 无 |
| CI-202611-0002 | CI（**转换**） | **`null`** | 无 | 无 |
| PL-202611-0002 | PL（**转换**） | **`null`** | 无 | 无 |
| PI/SC/CI/PL-202611-0001 | 直接新建 | `null` | 无 | 无 |

S10 真实预览层：QT 用 `quotation-rc-v1`、纸面宽 210mm；四类转换件均为 `basic-v1`、
均可打开预览、均无内部注记（`leakTypes: []`）。

### 5.3 PDF 导出与机器校验：5 类，0 问题

导出走生产通道（`createPdfExporter` → `readSavedDocument` → `validateForExport` → `buildHtml`
→ 沙箱隐藏窗口 → `printToPDF` → 原子落盘），仅替换保存对话框（`FIX-pdf-export-raw.json`：5/5 ok、5 个窗口、5 次 finished）。

**PI / SC / CI / PL 全部使用本次转换生成的单据**（`sourceId` 非空，见 `FIX-pdf-targets.txt`）：

| 单据 | 来源 | 页数 | 页面 | 上边距 | 左边距 | 内部标识 | 关键文案 |
|---|---|---|---|---|---|---|---|
| QT-202611-0001 | 新建 | 2 | A4 | 4.9 mm | 3.7 mm | 无 | 齐全 |
| PI-202611-0002 | 转换 | 1 | A4 | 12.9 mm | 11.8 mm | **无** | 齐全 |
| SC-202611-0002 | 转换 | 1 | A4 | 12.7 mm | 11.8 mm | **无** | 齐全 |
| CI-202611-0002 | 转换 | 1 | A4 | 12.9 mm | 11.8 mm | **无** | 齐全 |
| PL-202611-0002 | 转换 | 1 | A4 | 12.9 mm | 11.8 mm | **无** | 齐全 |

扫描 token：`仅适用于报价单`、`quotation-rc-v1`、`basic-v1`，以及 18 个核价字段
（`costFactory` / `markupRate` / `suggested_price` / `采购价` / `毛利` …）——**全部 0 命中**
（`FIX-pdf-verify.json`：`ok: true`、`problems: []`）。

QT 第二页首行墨迹 `0.0` CSS px（P1-D-03R 版式无回退）。

### 5.4 存量数据（不迁移）也安全 —— 补充样本

为验证「生产库里已有的转换件即使仍带 `quotation-rc-v1` 也不会出问题」，在隔离库中构造了一张
**模拟存量单据** `PI-202611-9001`（直接写入 `_unknown.quoteLayout.templateId='quotation-rc-v1'`，
模拟本轮之前转换并落盘的形态），走同一条生产导出通道：

| 单据 | 库内声明 | 页数 | A4 | 上边距 | 左边距 | 内部标识 | 结论 |
|---|---|---|---|---|---|---|---|
| PI-202611-9001（存量模拟） | `quotation-rc-v1` | 1 | 是 | 12.9 mm | 11.8 mm | **0 命中** | 渲染门兜住，无需迁移数据 |

证据：`legacy-samples/PI-LEGACY-stored-rc.pdf`、`FIX-pdf-verify-legacy.json`（`ok: true`）。
该样本不计入「五类 PDF 样张」，也不计入 180 项 E2E。

### 5.5 补充探针（不计入 1439 / 180 基线）

| 探针 | 覆盖 | 结果 |
|---|---|---|
| `FIX-probe-model.js` → `FIX-probe-model.json` | 渲染门（5 类 × 存量/显式/非法/跨类型模板）+ 转换清理（4 类目标）+ 其他扩展字段保留 + 源单不被污染 | **63 / 63 PASS** |
| `FIX-probe-editor.js.src` → `FIX-probe-editor.json` | 编辑器提示与纸面静默的 4 组用例（新转换件 / 存量遗留件 / 强制 `Doc.setTemplate` / QT 对照） | **16 / 16 PASS** |

关键取证（编辑器侧）：

```json
A 新转换件 PI-202611-0002: storedInDb=null, editorHintShown=false, paperTemplateId="basic-v1", paperHasNote=false
B 存量遗留件（内存注入 rc）: editorHintShown=true,
  editorHintText="本单模板为 quotation-rc-v1，但该版式仅适用于报价单（QT），本单纸面将按基础版渲染。",
  paperTemplateId="basic-v1", paperHasNote=false, paperHasRcNodes=false
C Doc.setTemplate('quotation-rc-v1') 强制指定: paperTemplateId="basic-v1", paperHasNote=false
D QT 对照: paperTemplateId="quotation-rc-v1", paperHasRcNodes=true, paperHasNote=false
```

### 5.6 修复前后对比

| 指标 | 修复前 | 修复后 |
|---|---|---|
| PI 纸面首行 | `（quotation-rc-v1 仅适用于报价单 QT…）` | 公司抬头 `Anping County Runcheng Metal Products Co., Ltd.` |
| PI 上边距 / 左边距 | 0.7 mm / **0.0 mm** | 12.9 mm / 11.8 mm |
| 左右裁切 | 表头 `AMOUNT`、标题 `PROFORMA INVOICE` 被纸张右缘裁掉 | 完整显示，左右各留 11.8 mm |
| 转换件库内 `templateId` | `quotation-rc-v1` | `null`（数据层清理；存量靠渲染门） |
| QT 第二页首行墨迹 | 0.0 CSS px | **0.0 CSS px（无回退）** |
| E2E 断言 | 175 / 180（P1-ACCEPT 实测） | **180 / 180** |

对照图（同一张转换件 PI-202611-0002 第 1 页）：
`screenshots/fix-PI-BEFORE-p1.png`（取自 P1-ACCEPT 归档的旧 PDF）↔ `screenshots/fix-PI-AFTER-p1.png`（本次导出）。

### 5.7 本轮验收要求逐条对照

| 要求 | 结论 |
|---|---|
| ① 原有 1439 项历史回归全部通过 | 是，1439/1439，FAIL 行 0（§5.1） |
| ② 原有 180 项 E2E 全部通过（180/180） | 是，断言总数仍 180，PASS 180（§5.2） |
| ③ QT、PI、SC、CI、PL 五种 PDF 重新导出 | 5/5 导出成功，A4、0 泄漏（§5.3） |
| ④ QT 保持原版 RunCheng 格式 | 模板仍 `quotation-rc-v1`，2 页，第二页顶位 0；`sheet-rc.js` 未改（§5.3） |
| ⑤ PI/SC/CI/PL 不再出现任何内部模板提示 | 三个 token 全扫 0 命中；纸面 HTML 已无 `q-tpl-note` 挂载位（§5.3 / §5.5） |
| ⑥ 转换后重新打开、预览、导出均正常 | S3 重开 32 项、S9 纸面 19 项、S10 预览 9 项、5 份 PDF 全通过 |

---

## 六、风险与影响面

- **影响面**：只有纸面渲染、PDF 页边距、以及转换草稿的 `_unknown.quoteLayout` 一对键。
  金额、合计、核价结果、费用分摊、成交价保护不经过本次改动路径（S5 的 36 项断言全通过为证）。
- **QT 未受影响**：`gateTemplate` 对 QT 直接放行；`sheet-rc.js` 未改；PDF 仍 2 页、第二页顶部 y=0；
  S9/S10 均显示 QT 的 `templateId` 与 `data-template` 仍是 `quotation-rc-v1`。
- **历史数据一字未改**：`Store.raw()` 前后逐字节相同的断言（S8）通过；本轮转换清理只作用于
  未保存草稿。
- **行为变化（正向）**：新转换件的 PDF 从「0 边距」变为「标准 12mm 边距」，观感与直接新建单据一致。
- **接口语义**：`Doc.templateId()` 由「生效模板」改为「声明模板」，全仓 2 处调用，纸面与导出不使用。
- **回滚**：`git checkout -- app/sheet.js app/model.js app/reference-editor.js tests/p1d3/run.js`；
  无数据变更，无需数据回滚（本轮转换生成的单据只存在于隔离测试库）。

---

## 七、遗留与后续建议（本轮未做，供后续排期）

1. **测试固化**：建议把「转换件纸面洁净度 + 转换不携带越界模板声明」固化进 `tests/p1d3`
   （目前由 E2E 的 S9 与两支探针覆盖）。因本轮要求 1439 项数量不变，未新增检查项。
2. **死样式**：`app/app.css:356` `.q-tpl-note` 已无人引用，可在允许改 app.css 的轮次删除。
3. **存量数据可选清理**：若将来要彻底清除库里的越界 `templateId`，需一次性的数据整理任务
   （需单独评审，本轮明确不做）。
4. **仓库卫生（历史遗留，与本缺陷无关）**：根目录 `SHA256SUMS.txt` 已过期（缺若干 P1-D-03R 文件、
   部分路径为 git quotepath 转义）；两个 README 文件名为历史乱码命名。均未改动以免产生无关差异。

---

## 八、交付物

```
docs/integration/fix-BUG-ACC-01/
├─ FIX-report.md                 ← 本报告
├─ FIX-code-diff.patch           ← 完整 git diff（4 文件）
├─ FIX-regression-full.log       ← 5 套 1439 项回归原始输出（1539 行）
├─ FIX-e2e-full.log              ← 10 场景 180 项断言 + PREP-PL + PROBE-EDITOR 原始输出
├─ FIX-e2e-result.json           ← 机器可读断言与各场景实测载荷
├─ FIX-pdf-verify.json           ← 5 份 PDF 机器校验（页数/尺寸/边距/文案/泄漏）
├─ FIX-pdf-verify-legacy.json    ← 存量模拟件 PDF 校验
├─ FIX-pdf-export-raw.json       ← 导出器原始返回（含文件大小与耗时）
├─ FIX-pdf-targets.txt           ← 5 个导出目标的来源（新建/转换）与库内 templateId
├─ FIX-probe-model.json          ← 渲染门 + 转换清理 63 项取证
├─ FIX-probe-editor.json         ← 编辑器提示 / 纸面静默 16 项取证
├─ FIX-e2e-scenarios.js / FIX-e2e-driver.js / FIX-e2e-runner.js
├─ FIX-pdf-runner.cjs / FIX-verify-pdf.py / FIX-prep-pl.js
├─ FIX-probe-model.js / FIX-probe-editor.js.src
├─ FIX-SHA256SUMS.txt            ← 本交付包清单（权威）
├─ pdf-samples/                  ← 5 份真实导出 PDF（PI/SC/CI/PL 均为本次转换件）
├─ legacy-samples/               ← 存量模拟件 PDF（证明不迁移数据也安全）
└─ screenshots/                  ← S1..S10 界面截图 + 主进程 stdout + 5 类纸面渲染 + PI 修复前后对照
```

### 8.1 交付 ZIP

| 项 | 值 |
|---|---|
| 文件 | `siwang-box-fix-BUGACC01-20261121.zip`（与 `siwang-box-main/` 同级；本轮重出，取代上一版） |
| 自身 SHA-256 | 见同级旁注 `siwang-box-fix-BUGACC01-20261121.zip.sha256`（清单不收自身哈希） |
| 条目 | 300（299 个内容文件 + 1 个清单） |
| 内容 | 基线受版本控制文件（含本轮 4 个修改后的工作树版本）+ 上一轮 `acceptance/` + 本轮 `fix-BUG-ACC-01/`（含 `legacy-samples/`）+ 三份 CHANGE 报告 |
| 排除 | `node_modules/`、`data/`、`ud-*`、`tmp-*`、`dist/`、`out/`、`release/`（与 `.gitignore` 一致） |
| 完整性 | `zipfile.testzip()` 通过；`FIX-SHA256SUMS.txt` 全部复算一致；解压后 `sha256sum -c` 全 OK 且无告警 |
| 字节一致 | 包内条目与仓库工作树**逐字节相同**（哈希按原始字节计算，不做 LF/CRLF 归一化，解压后可直接与 git 工作区比对） |

### 8.2 清单归属

本包唯一权威清单是 `docs/integration/fix-BUG-ACC-01/FIX-SHA256SUMS.txt`。
`docs/integration/acceptance/ACCEPTANCE-SHA256SUMS.txt` 是 P1-ACCEPT 轮次的历史清单（246 条，冻结未改），
只用于校验 `siwang-box-acceptance-P1ACCEPT-20261121.zip`；用它校验本包时，4 个被修改的文件会报哈希不同，
属预期差异。

### 8.3 复现

```bash
node docs/integration/fix-BUG-ACC-01/FIX-e2e-runner.js              # 10 场景，180 断言（需 Electron）
node docs/integration/fix-BUG-ACC-01/FIX-probe-model.js .           # 渲染门 + 转换清理，63 项
node docs/integration/fix-BUG-ACC-01/FIX-prep-pl.js                 # 导出前置：补齐转换版 PL 包装数据
# 五类 PDF：见 FIX-pdf-runner.cjs（ACC_IDS / ACC_UD 环境变量）
python docs/integration/fix-BUG-ACC-01/FIX-verify-pdf.py            # 机器校验 5 份 PDF
```
