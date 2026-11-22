# P1-B-FIX-01 修复报告：V5 读取校验收紧 + QT→PL 单据级内部数据剥离

日期：2026-11-19（含同日收尾修正轮）
基线：siwang-box-integration-P1B-20261119.zip（SHA-256 d27e649145fce2dc7acba4cd89965155e014416cf4dc55e2e8ddbd3f1e4a4ff7，103 条目）
性质：独立验收发现的两个问题定点修复 + 收尾交付资料修正。**不进入 P1-C，不改 app/pricing.js，不改 PDF 模板，不触碰生产 userData，不改冻结定价公式，不改 app/model.js 已验收业务逻辑与 storage.js / app/store.js。**

---

## 一、修改范围（逐文件 SHA-256 对照见 SHA256-diff-vs-P1B.txt）

**业务修复轮（FIX-01 代码）**：

| 文件 | 改动 |
|---|---|
| app/model.js | BUG-01 + BUG-02 全部代码修复（5 处定点修改） |
| tests/schema/run.js | 新增 36 项缺陷测试（158 → 194） |

**收尾修正轮（本轮，仅交付证据，不扩大业务修改）**：

| 文件 | 改动 |
|---|---|
| tests/schema/run.js | F36 标签与注释口径修正（见 §四.4） |
| README-交付说明.md | 统一更新 FIX-01 交付状态（194/851、BUG-01/BUG-02、实际修改文件清单、冻结确认），消除旧版 158 项与旧修改清单 |
| CHANGE-VS-ORIGINAL.txt | 追加 FIX-01 修改说明（业务修复轮已完成） |
| SHA256SUMS.txt | 重新生成 |
| docs/integration/ 5 个新文档 | 报告 / 测试日志 / 两份 diff / SHA-256 对照 |

**相对 P1-B 基线的最终实际差异（逐文件列出见 SHA256-diff-vs-P1B.txt）**：
完全一致 98 个、修改 5 个（app/model.js、tests/schema/run.js、CHANGE-VS-ORIGINAL.txt、SHA256SUMS.txt、README-交付说明.md）、新增 5 个、删除 0 个。

> 口径说明：任务书引用的"99 一致 / 4 修改 / 5 新增"是对收尾修正前交付包（README 尚未更新时）的比对结果，当时已逐文件复核确认无误；本轮按任务书 §二.2 更新 README-交付说明.md 后，README 成为第 5 个修改文件，实际差异如实记录为 98/5/5/0。CHANGE-VS-ORIGINAL.txt 与 SHA256SUMS.txt 在对照表中单独列示、不遗漏。

**冻结文件零改动**：app/pricing.js、app/pages.js、app/sheet.js、pdf-export.cjs、main.js、preload.js、storage.js、app/store.js、costing-storage.js、license-*、updater.js、product-ai.cjs、装柜/规格/导入全部逐字节与 P1-B 基线一致（SHA-256 对照表逐文件核验）。

## 二、BUG-01：QT→PL 未剥离单据级内部定价数据

**位置**：app/model.js `buildConversionDraft`。

**修复**：目标为 PL 时，在行级成本字段剥离（原有 V5_ROW_KEYS 剥离不变）之外，显式删除 9 个单据级字段：
fx、feeRate、targetMargin、commissionRate、freightMarkup、markupRate、feeInPrice、pricingVersion、fees。

规则确认：
- sourceId 显式保留（在剥离之前已赋值）；
- 行级 6 个成本字段继续剥离（原 F20 规则不变）；
- PL 原有包装四件套规则不变：跨类→PL 一律 null 待补，PL→PL 同类复制原样带；
- QT→PI/SC/CI 的快照延续不受影响（九键与行级成本快照全部保留）；
- PL→PL 复制同样执行九键剥离。

**落盘语义披露**：转换草稿剥离九键后，经 Store.addDocument 真实链路落盘时，store.js 既有的 writeDocument→withV4DocDefaults 默认值机制（**本轮禁止修改 store.js，保持原样**）会把缺失键补齐——定价键补为 null（"待补"语义，不是内部数据）、fees 补为 []。即：**剥离发生在转换数据层（草稿不含任何内部定价数据），落盘后的 PL 单据定价键均为 null、无任何泄漏值**——Store 层冒烟验证 S8/S9 实测确认。

**配套说明（新建单据默认值路径）**：BUG-02 收紧后"fees 缺失"被写门拒绝，而新建报价单兼容路径 `quoteToDocument`（Store.addQuote 用）不经 writeDocument/withV4DocDefaults，故在 quoteToDocument 产物中显式补 9 个默认键（定价参数 null + fees=[]）。这正是任务书"新建单据由默认值负责补齐"的落点。

## 三、BUG-02：V5 读取校验不够严格

**位置**：app/model.js。全部 3 类修改：

1. **validateV5 非对象明细报错**：明细遍历中非对象条目从"静默跳过"改为 `documents[i].items[j] 不是对象` 报错（与写门 validateDocumentStrict 同一口径）。
2. **validateV5DocKeys fees 三态收紧**（读门与写门共用同一份代码，规则自动一致）：
   - fees 缺失 → 拒绝（历史迁移负责补 []，新建单据由默认值补齐）；
   - fees=null → 拒绝（"未知"不等于"空费用清单"）；
   - fees 非数组 → 拒绝；数组合法 → 条目逐个过 validateFeeEntry。
3. **migrateV4toV5 迁移来源非法 fees 明确报错**：来源单据已带 fees 且不是数组时，整次迁移失败，报错指明 `documents[i].fees` 并声明"不静默删除、不覆盖原始数据，原文件未改动"（原有"仅缺失才补 []，已有值原样保留"原则不变）。

**损坏 v5 主文件不加载、不降级**（任务书 §二.6）：该行为在 P1-B 的 storage.js load() 已实现——validateV5 校验失败 → status='invalid' 只读，绝不探测旧 v4 源；JSON 损坏 → status='corrupt'，不初始化空库、不迁移。本轮**未改 storage.js**，新增 L 段测试实测锁死该行为（fees=null 的 v5 主文件 + v4 文件并存 → invalid，v4 文件逐字节未动；JSON 损坏 → corrupt；迁移来源 fees=null → migrate 失败且原文件不变）。

## 四、测试与回归结果（完整日志：P1-B-FIX-01-test-logs.txt）

| 项目 | 结果 |
|---|---|
| P1-B Schema 测试（tests/schema/run.js） | **194 / 194 ALL PASS**（原 158 项预期一字未改 + 新增 36 项） |
| P1-A 定价测试（tests/pricing/run-all.js） | **851 / 851 ALL PASS**（预期值不变，pricing.js 零改动） |
| 润成对账 parity（parity-check.ts） | **8/8 场景 PASS** |
| QT→PI/SC/CI/PL 转换回归 | F 段 26 项 + F+ 段 11 项全过 |
| v4 原文件 SHA-256 不变 | I9/I18/I21 + L3/L10 实测逐字节不变 |
| Store.addDocument / addQuote 冒烟验证 | **16/16 ALL PASS**（与 F36 分开记录，见 §四.5） |
| 独立解压测试 | 全新临时目录解压 + SHA256SUMS 逐条核验 + 解压目录内重跑 194/851 全过，EXIT=0 |
| 全部 JS 语法检查 | 34 个文件 node --check 全过 |

### 新增测试清单（36 项，计入 194）

**F+ 段（BUG-01，11 项）**：F26 QT→PL 九个单据级字段全部不存在；F27 行级六个成本字段全部不存在；F28 sourceId 保留；F29/F30 QT→PI/SC/CI 保留规则不变；F31–F35 PL→PL 复制同样剥离九键/行级成本、sourceId 保留、包装四件套原样带；F36 写门验证（口径见 §四.4）。

**K 段（BUG-02 model 层，14 项）**：K2 items=[null] validateV5 拒绝；K3 items=[123] 拒绝；K4 报错指明位置；K5/K6 fees=null 读门+写门均拒绝；K7/K8 fees 缺失读门+写门均拒绝；K9 fees=[] 通过；K10 PL 单据 fees 缺失同样拒绝；K11–K14 迁移来源 fees=null / 非数组 → 整次迁移失败、报错指向 fees、入参原样。

**L 段（BUG-02 storage 层，11 项）**：L1 损坏 v5（fees=null）→ invalid 不降级读 v4；L2 报错提及 fees；L3 v4 原文件逐字节未动；L4 invalid 目标拒绝普通写入（TARGET_INVALID）；L5 v5 主文件 JSON 损坏 → corrupt（不当正常数据、不降级迁移 v4）；L6/L7 v4 与 v5 文件均逐字节未动；L8–L11 迁移来源 fees=null → migrate 失败、报错指向 fees、v4 原文件 SHA 不变、未产生 v5 主文件。

### §四.4 F36 测试口径（收尾修正）

F36 **仅验证"默认值补齐后的写门"**：在测试内手动把 fees=[] 补进 PL 草稿再过 validateWritable，**不等于、也不声称是**真实 Store.addDocument 保存链路测试（真实链路走 writeDocument→withV4DocDefaults）。测试标签与代码注释均已按此口径修正，194 项总数不变。

### §四.5 Store.addDocument / Store.addQuote 冒烟验证（与 F36 分开记录）

一次性冒烟脚本（未纳入交付包，避免新增项目文件）：mock 渲染层桥（window.SBW.load/save）+ **真实 storage.js**（os.tmpdir 隔离目录）+ 真实 app/store.js（不修改 store.js 本身），完整结果见 P1-B-FIX-01-test-logs.txt 的冒烟段。要点：

- S1 bootstrap 空库经真实 storage 落盘初始化成功；
- S2/S3 Store.addQuote 真实链路落盘成功，新建 QT 九个单据级默认键齐全（fx…pricingVersion=null、fees=[]）；
- S5–S12 QT→PL 转换草稿（九键已剥离）经 Store.addDocument 真实链路保存成功；磁盘 PL 单据 fees=[]（默认值补齐）、八个定价键不存在或为 null（**无任何内部定价数据泄漏**）、行级成本键不存在、sourceId 保留、price/amount/hsCode 不存在；
- S13–S15 QT→PI 经同一真实链路落盘后保留九个单据级键（快照延续）与 previousGrand 留证；
- S16 全部 3 次以上落盘均通过真实 storage.js 写门。

### 测试修正披露（非预期值变更）

- F36 首稿误把单张单据直接喂给 validateWritable（该门校验的是整个库对象），改为"草稿入合法 v5 库 + 默认值补 fees=[]"后通过；收尾修正轮进一步明确其口径为"仅验证默认值补齐后的写门"。原有 158 项预期值无任何改动；E14"fees 非数组"等原断言在新规则下继续成立。

## 五、禁止事项核对

- app/pricing.js：SHA-256 与 P1-B 基线一致，零改动 ✔
- app/model.js 业务逻辑：收尾修正轮未触碰（仅 tests/schema/run.js 的 F36 标签/注释）✔
- storage.js / app/store.js：零改动 ✔
- PDF 模板 / pages.js / sheet.js：零改动 ✔
- 冻结定价公式（方案 A）：未触碰 ✔
- 生产 userData：全部测试为 Node 纯函数 + os.tmpdir() 隔离目录 + mock 渲染桥，未运行 Electron、未触碰生产数据 ✔
- 未重建项目、未进入 P1-C、未增加无关功能 ✔

## 六、交付物

1. 完整 ZIP：siwang-box-integration-P1B-FIX01-20261119.zip（正斜杠相对路径打包，108 条目，含 SHA256SUMS 全覆盖清单）
2. SHA-256 清单：SHA256SUMS.txt（包内 107 个文件全覆盖）+ ZIP 总 SHA（见同目录 .sha256.txt 侧车文件）
3. 修改文件差异：docs/integration/P1-B-FIX-01-model.diff、P1-B-FIX-01-tests.diff、SHA256-diff-vs-P1B.txt
4. 新增缺陷测试日志：docs/integration/P1-B-FIX-01-test-logs.txt（Schema 194 / 定价 851 / parity 8 / 语法 34 / Store 冒烟 16 五段）
5. 本报告：docs/integration/P1-B-FIX-01-report.md
6. 独立解压测试：全新临时目录解压 + SHA256SUMS 逐条核验 + 解压目录内重跑 Schema 194 与定价 851 全过，EXIT=0

**完成后立即停止，等待 ChatGPT 独立验收。未经独立验收，不进入 P1-C。**
