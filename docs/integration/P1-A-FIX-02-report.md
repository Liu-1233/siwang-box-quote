# P1-A-FIX-02 修复报告（第三轮定点修复）

日期：2026-11-19
基线：P1-A-FIX-01 交付包 `siwang-box-integration-P1A-FIX-20261119.zip`
（SHA-256 `a5659ede…f1f55`，解压核对一致后作为本轮唯一开发基线）
性质：独立验收发现的缺陷定点修复。**不重写引擎、不改已确认定价公式、不进入 P1-B。**

## 一、修改范围声明

本轮仅修改 2 个代码/测试文件，其余全部为交付文档与日志：

| 文件 | 变更类型 |
|---|---|
| `app/pricing.js` | BUG-06～09 定点修复 |
| `tests/pricing/run-all.js` | F36 断言补齐 + G 段（BUG-06～09 专项）新增 |
| `README-交付说明.md`、`tests/pricing/README.md` | 交付说明更新 |
| `docs/integration/P1-A-FIX-02-report.md`（本文件） | 新增 |
| `docs/integration/P1A-FIX-repro-pre.log` / `repro-post.log` | **本轮实际打入 ZIP**（FIX-01 README 已列出但包内缺失，见 §五） |
| `docs/integration/P1-A-test-log.txt`、`P1-A-parity-log.txt` | 本轮实测日志 |
| `SHA256SUMS.txt`、`SHA256-diff-vs-FIX01.txt`、`CHANGE-VS-ORIGINAL.txt` | 清单重算 |

model.js / store.js / pages.js / sheet.js / main.js / pdf-export.cjs / 授权系统：**零改动**（SHA-256 与 FIX-01 完全一致，见差异对照）。

## 二、BUG-06：手续费模式辅助函数严格校验

涉及：`marginFromMarkupForMode`、`markupFromMarginForMode`、`afterFeeMarginFromMode`（新增内部助手 `isValidFeeMode` / `isValidFeeRate`）。

修复前：`feeInPrice === 0` 判断 + `+fee || 0`——`"1"`、`true`、`null` 等一律被当作含费模式；手续费 NaN/Infinity/负数被 `|| 0` 静默转为 0。

修复后规则：

1. **模式**：只有数值类型的 `0` 和 `1` 合法（严格相等判定，字符串 `"1"`/`"0"`、`true`/`false`、`null`/`undefined`、其他数值均返回 `null`），不得自动转换成含费模式。
2. **手续费参数**：必须为有限数值且 `0 ≤ fee < 1`；NaN/Infinity/负数/≥1/字符串一律返回 `null`，不得静默转 0。
3. `computeQuote` 的 fee_in_price 严格识别（BUG-01，FIX-01 已修）保持不变，本轮未触碰。

测试：G1a–G5c、G6a–G6d、G7a–G7e，共 25 项 ×3 环境。

## 三、BUG-07：分摊原始金额精度校验

涉及：`allocateByQty`、`validateManualAllocation`、`validateManualAllocationFor`、`allocationStatus`（新增内部助手 `isValidRawAmount`）。

修复前：`allocateByQty` 先 `r2(amountCny)` 再检查——原始 `1.234` 被舍入成 `1.23` 放行、`100.001` 舍入成 `100.00` 放行、`0.004` 舍入成 `0` 被当零费用；`-0.004` 舍入成 `-0` 也能放行。可能出现"原始费用 1.234 元实际只摊 1.23 元但 ready=true"。

修复后规则（在 **r2 舍入之前**检查原始金额）：

1. 金额必须是非负、有限、最多两位小数的数字；`1.234`/`100.001`/`0.004`/`-0.004` 一律拒绝（auto 返回 null、人工校验 ok=false、状态 pending）。
2. 明确输入 `0` → 按零费用处理（auto 摊入 0、人工零分摊合法、status='none'）。
3. 自动分摊与人工分摊均保持总额严格守恒（容差 1e-9；差额归末行规则不变）。

测试：G8a–G14d，共 16 项 ×3 环境（含守恒断言 G10b/G13）。

## 四、BUG-08：产品原始明细 sort 唯一性校验

涉及：`allocateByQty`、`validateManualAllocationFor`、`allocationStatus`、`computeQuote`（新增并导出 `checkSortsForAllocation`）。

修复前：只校验人工分摊数组的 sort；原始产品明细 sort 重复/缺失/非法时，自动分摊照常执行、人工分摊可被 `seen` 表误放行——两条 sort 同为 0 的产品行 + 100 元费用可经 `feeAllocBySort` 映射造成实际摊入 200 元。

修复后规则（参与分摊的产品行 = qty>0 的明细行）：

1. sort 必须存在、为合法数字、且在参与行中唯一；每条产品行只对应一笔分摊金额。
2. 原始明细 sort 非法 → 禁止自动分摊（allocateByQty 返回 null）、禁止人工分摊通过（validateManualAllocationFor ok=false）、状态标记 pending、阻断正式建议价（suggested=null）、ready=false。
3. 特别场景：两条产品行 sort 均为 0、原始费用 100 元 → 系统阻断，两行成本保持原值，**实际摊入合计 0（绝非 200）**（G18a–G18c）。

说明：`checkUnitsForAllocation` 本身保持不变（K5c 等既有用例的合法输入不携带 sort 字段）；sort 校验作为独立门由 allocateByQty / validateManualAllocationFor / allocationStatus 调用，满足任务书"涉及"清单且不改变单位检查语义。

测试：G15a–G19，共 10 项 ×3 环境。

## 五、BUG-09：费用缺失与零值语义核查

涉及 `computeQuote`：`extra.discount`、`extra.other_charges`、`opts.fee.amountCny`、packing 金额、freight 金额。

**规则：明确输入数字 0 才代表零费用；缺失/null/NaN/Infinity/负数/非法精度必须明确区分，不得经 `|| 0` 静默处理。**

| 输入 | 修复前 | 修复后 |
|---|---|---|
| `extra.discount` = null / undefined | 静默按 0 | 阻断：「折扣金额未填写（须明确数字，0 表示零费用）」 |
| `extra.other_charges` = null / undefined | 静默按 0 | 阻断：「其他费用金额未填写（须明确数字，0 表示零费用）」 |
| `extra.*` = NaN/Infinity/负数/三位小数 | 已阻断（FIX-01 BUG-04） | 保持阻断 |
| `opts.fee.amountCny` 缺失/NaN/Infinity | pending（FIX-01 BUG-04） | 保持 pending；**新增两位小数校验**（BUG-07 联动） |
| packing 金额非法 | 阻断但无精度检查 | 阻断 + 两位小数精度校验，文案统一「木箱/包装费金额非法（须为非负且最多两位小数的数字）」 |
| freight 金额 NaN/undefined | 已阻断，但合计链路存在 `fr.amount \|\| 0` | 阻断不变；合计链路去除 `|| 0`——非法金额跳过累加（防 NaN 污染 freightUsd/chargeFreight/final_total），且不再误报「汇率缺失」 |

**历史可选字段例外规则（明确记录，配专门测试 G28/G28b）：**

唯一兼容例外是 **opts.fee / opts.packingFeeAllocations 整体缺省 = 本单没有该类费用**（合法，不属于"零费用录入"），因为这两个是 P1-A 临时调用参数而非单据字段；P1-B 落库为 doc.fees[] 后由编辑器显式录入。除此之外（extra.discount、extra.other_charges、运费金额、木箱金额、fee.amountCny）**全部无缺省例外**——必须显式数字，0 表示明确零费用。润成 V3 界面恒显式提供 extra（默认 0），26 项原始回归与 8 个对账场景均显式传入 `{discount: 0, other_charges: 0}`，故该严格化不影响原始回归与对账。

测试：G20a–G28b，共 14 项 ×3 环境。

## 六、F36 断言补齐

FIX-01 中 `dF36` 已创建但无任何断言（测试空转）。本轮补齐 4 项有效断言：

- F36a：无 packing 费用时 `packingFeeAllocations` 不生效，行1 成本 = 100+20 = 120；
- F36b：行2 = 100+30/2 = 115；
- F36c：fee 完成人工分摊且无 packing → ready=true；
- F36d：摊入守恒——(120−100)×1+(115−100)×2 = 50 = fee 总额，无重复计入。

原始 26 项测试预期值一字未改；K 段、F 段其余用例预期值未改。

## 七、测试统计与验证结果

```
node tests/pricing/run-all.js  →  ALL PASS — 662 checks，EXIT=0
```

| 分段 | 每环境 | ×3 环境 |
|---|---|---|
| 润成原始 26 项（预期值未改） | 26 | 78 |
| K 段边界（FIX-01） | 70 | 210 |
| F 段缺陷回归（含 F36 新增 4 断言） | 59 | 177 |
| **G 段 BUG-06～09 专项（本轮新增）** | **65** | **195** |
| 三环境一致性对照（含 FIX-02 严格化样例） | — | 2（打印 4 行） |
| **合计** | | **662** |

- 三环境（Node require / VM / Renderer global）全部通过，一致性样例包含模式严格化、原始金额拒绝、重复 sort 拒绝、extra=null 阻断。
- 润成对账：`parity-check.ts` 8 场景 PARITY PASS，EXIT=0（保留 FIX-01 原有结果）。
- 原始 0.2.17 业务文件零改动（SHA-256 全量比对，见 CHANGE-VS-ORIGINAL.txt）。
- 历史成交价保护回归：K14i / F05c / K16b 全部通过；分摊无超额/漏额/重复摊入（F18/F36d/F37c + G10b/G13 守恒断言）。

## 八、阶段边界声明

本轮完成后仅提交 P1-A 最终验收包。未开始 Schema v5、产品成本字段迁移、报价编辑器改造、PDF 模板改造、装柜功能改造。**状态：已编码、待 ChatGPT 独立验收；验收通过前不进入 P1-B。**
