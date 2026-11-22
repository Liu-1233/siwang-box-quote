# P1-C-FIX-02 修复报告：费用编辑后旧建议价未失效（BUG-07）

日期：2026-11-20
基线：siwang-box-integration-P1C-FIX01-20261120.zip（SHA-256 `46d38ee69c0ff52eccdef57fe08665efc14999a152d7d16fdf7eb98346efc716`，141 条目）
状态：**P1-C-FIX-02：已编码，待 ChatGPT 独立验收。** 通过前不进入 P1-D、不覆盖生产版本、不迁移生产数据、不合并到正式版本。

## 一、问题回顾

独立复测发现：`app/pages.js` → `P1C.setFeeField()` 在金额分支中，**空串**与**非法输入**（负数 / NaN / 超两位小数）两条路径提前 `return`，绕过了函数末尾的 `P1C.markStale()` 与 `Doc.markDirty()`：

| 操作 | 修复前实际结果 |
|---|---|
| 清空费用金额 / 输入 -1 / 输入 1.234 | 输入本身成功写入 |
| pricingStale | false（错误，应为 true） |
| dirty | false（错误，应为 true） |
| 点击「填入建议价」 | 旧建议价可成功填入（错误，必须拒绝） |
| Doc.markDirty | 未执行，单据未标记已修改 |

这是影响实际报价安全的问题：费用已变、建议价已失效，但价格保护没有触发。

## 二、修复内容（最小范围）

**只改 `app/pages.js` 的 `setFeeField()` 一个函数**（差异全文见 `P1-C-FIX-02-pages.diff`）：

- 去掉两个提前 `return`，把金额分支重排为：空串 → 原样保存空串；非法（负数/NaN/超精度）→ 原样保留文本；合法 → 按原规则四舍五入到分并清空旧分摊。
- 三个分支汇合后统一执行 `P1C.markStale()` + `Doc.markDirty()`——**费用字段任何修改（含留空与非法输入）都使旧核价失效并标记单据已修改**，无任何绕过路径。
- 行为保持：空值不转 0；非法输入不四舍五入、不静默修正；合法金额处理逻辑一字未改；不影响用户手动成交价。

填价保护链本身（`applySuggestedPrice` 的 ready 门 → pricingStale 门 → 令牌门）在 P1-C-FIX-01 已冻结完好，本轮不改动；本轮只是把「费用修改」重新接回这道保护链。

## 三、冻结确认

本轮修改仅 2 个文件（逐文件 SHA-256 对照见 `SHA256-diff-vs-P1CFIX01.txt`）：

| 文件 | 分类 |
|---|---|
| `app/pages.js` | 任务书允许 |
| `tests/p1c/run.js` | 任务书允许 |

冻结文件核对结果：基线 141 个文件中 139 个与开发副本逐字节一致；2 个 README 按内容配对一致（ZIP 内文件名为历史打包编码格式，FIX-01 验收时已存在）；实际差异仅上述 2 个允许修改文件，**0 个意外差异，0 个删除**。`app/pricing.js`（851 项回归原值）、`app/model.js`、`app/store.js`、`storage.js`、`main.js`、`preload.js`、`app/sheet.js`、`pdf-export.cjs`、Schema V5、授权/装柜/规格/产品导入模块全部零改动。定价公式（方案 A）与手续费/利润率口径未触碰。

## 四、新增自动化测试（H 段，39 项）

`tests/p1c/run.js` 新增 H 段 BUG-07 专项回归，每场景按任务书固定顺序执行：创建合法报价单 → 成本已确认 → 完成费用分摊 → 核价 ready=true → 记录原建议价/手动成交价 → 修改费用金额 → 验收失效保护与成交价保护。全部为真实断言（无函数存在性空跑）：

| 编号 | 场景 | 结果 |
|---|---|---|
| T01 | 清空费用金额 | stale=true、dirty=true、空串原样保留（不转 0）✅ |
| T02 | 输入 -1 | stale=true、dirty=true、负数原样保留 ✅ |
| T03 | 输入 1.234 | stale=true、dirty=true、三位小数原样保留（不舍入）✅ |
| T04 | 输入合法金额 80 | stale=true、dirty=true、数值 80、旧分摊清空待重摊 ✅ |
| T05 | 修改后填入旧建议价 | 被拒绝（「重新核价」提示，price 未写入）✅ |
| T06 | 非法金额（-1 / 1.234 / 留空）重新核价 | ready=false、正式建议价全 null ✅ |
| T07 | 合法金额 80 重摊重核 | ready=true、新建议价 4.38→新值、stale 解除可填 ✅ |
| T08 | 已有手动成交价 3.5 时修改费用 | stale=true、填价被拒、3.5 全程不变 ✅ |
| T09 | 费用名称修改（回归） | stale=true、dirty=true（FIX-01 行为不回退）✅ |

P1-C 套件总计：原 190 项 + H 段 39 项 = **229 项全部通过，退出码 0**。

## 五、Electron 隔离实测

`SBW_USERDATA=D:/siwanghezi/tmp-e2e-p1cf2/ud` 独立临时目录，生产 userData 未触碰；每场景一次全新 Electron 会话；操作全部走真实界面（input 事件触发 `oninput`、按钮 `click()`、确认弹窗走 `UI.runConfirm()`）。日志与截图见 `P1-C-FIX-02-e2e-log.txt` 与 `screenshots/p1cf2-*.png`：

| 场景 | 实测结果 |
|---|---|
| seed | 种子单据落盘成功（V5 全键，费用 100 待分摊） |
| 01 清空费用（真实界面清空输入框） | 核价 ready=true、建议价 4.38、手动价 3.5 → 清空后 stale=true、dirty=true、金额为空串 → 点「填入建议价」被拒（「参数或明细改过之后还没重新核价」）、成交价保持 3.5 |
| 02 输入 -1 重新核价 | stale=true、dirty=true、'-1' 原样保留 → ready=false、feePending=true、建议价 null、blocker「存在金额缺失或非法的费用——不按零费用处理」 |
| 03 费用改 80 重摊重核 | staleAfterEdit=true → 自动分摊成功 → ready=true、新建议价 3.94（≠旧价 4.38）→ 填价弹确认框 → 确认后写入 3.94 |
| 04 手动成交价保护 | ready=true（price 3.5）→ 清空费用 → stale=true → 填价被拒 → priceFinal=3.5 原样保留 |

备注：实测中发现两点与本轮修复无关的既有行为，如实披露不修改——① 磁盘写门把行成交价 null 归一为 0（`model.js` 行归一 `price: it.price || 0`，P1-B 既有口径），故 E2E 场景以真实界面填入手动价 3.5 建立核价前置；② `Doc.newDraft` 的运费/贸易条款种子为未核实态，正式核价前需在界面上补齐（种子数据已按完整口径预置）。

## 六、回归测试汇总（全部通过，原有预期值一字未改）

| 套件 | 结果 | 退出码 |
|---|---|---|
| Schema V5（tests/schema/run.js） | ALL PASS — 194 checks | 0 |
| P1-A 定价冻结回归（tests/pricing/run-all.js） | ALL PASS — 851 checks | 0 |
| P1-C（含 FIX-01 G 段 + FIX-02 H 段） | ALL PASS — 229 checks | 0 |
| 润成 parity | 8 场景全部一致 | 0 |
| JavaScript 语法检查（10 个文件） | 全部 OK | 0 |

完整日志（含退出码）见 `P1-C-FIX-02-test-logs.txt`。

## 七、独立解压实测

交付 ZIP 在两个全新临时目录独立解压，各自解压内重跑 Node 测试（G0 断言确认加载源码位于当前解压目录），全部通过、EXIT=0。记录见 `P1-C-FIX-02-report.md` 第七节与 `P1-C-FIX-02-test-logs.txt` 末段。

## 八、交付清单

- `siwang-box-integration-P1C-FIX02-20261120.zip`（完整工程）
- `siwang-box-integration-P1C-FIX02-20261120.zip.sha256.txt`（ZIP SHA-256）
- 包内 `SHA256SUMS.txt`（全部交付文件清单，本文件自身除外）
- `CHANGE-VS-P1C-FIX01.txt`（与基线逐文件对照，含清单自引用口径说明）
- 本报告、`P1-C-FIX-02-test-logs.txt`、`P1-C-FIX-02-e2e-log.txt`、`P1-C-FIX-02-pages.diff`、`P1-C-FIX-02-tests.diff`、`SHA256-diff-vs-P1CFIX01.txt`、6 张实测截图
