# P1-A 第二轮修复报告（P1-A-FIX-01）

日期：2026-11-19 ｜ 性质：已有代码定点修复（第一轮独立审核发现的五类缺陷）｜ 状态：**待独立验收**

---

## 1. 修复前后缺陷对照表

| 编号 | 缺陷 | 修复前行为（FAIL 日志：P1A-FIX-repro-pre.log，11/12 FAIL） | 修复后行为（P1A-FIX-repro-post.log，12/12 PASS） | 修改位置 |
|---|---|---|---|---|
| BUG-01 | 历史报价手续费模式识别错误：`fee_in_price !== 0` 把 null/undefined 自动转含费 | fee_in_price=null/undefined → 引擎按含费计算、ready=true、totals.fee_in_price=true | 1=含费 / 0=不含费 / **null·undefined·非法类型=未知态**：阻断+告警、不给建议价、ready=false、totals.fee_in_price=null；润成含费默认改由调用方适配层显式传 1（K13c 断言与 V3 一致）；v4 历史单保留未知（K16） | computeQuote 头部模式解析；`marginFromMarkupForMode/markupFromMarginForMode/afterFeeMarginFromMode` 对非 0/1 返回 null |
| BUG-02 | 人工分摊只验证金额合计，不验证 sort 归属 | sort=99/重复 sort/缺 sort/漏行全部放行（ready=true） | 新增 `validateManualAllocationFor`：sort 必须存在、唯一、合法数字、**完整覆盖数量>0 的全部明细行**；金额非负两位小数；Σ 严格等于原始费用；任何失败 → pending → 阻断不 ready（F06–F12） | 新增校验函数；allocationStatus 人工分支改用严格版 |
| BUG-03 | 旧木箱费通路绕过混合单位检查（freight 面板 packing 直接全单数量平均） | set+m 混装 90 元 → 每行各摊 30（误摊） | packing 费用统一走分摊机制：同单位自动按数量平均（与旧通路数值一致，parity C/I 场景不变）；混合单位仅接受人工分摊 `opts.packingFeeAllocations`（P1-A 临时参数，README 已说明接口）；未完成/非法 → pending 阻断；总额守恒；防双计机制不变（F13–F18、F36–F40） | computeQuote packing 收集段重写；明细摊入改 packingAllocBySort |
| BUG-04 | 非法费用被 `\|\| 0` 静默转零 | discount=NaN → 静默忽略（ready=true）；fee 金额 NaN → 当 0（'none'）跳过；packing 金额 NaN → 静默跳过 | 全部费用先做有效性检查（NaN/±Infinity/负数/超两位小数/缺失/非法币种）→ 明确阻断；**只有明确输入的数字 0 代表零费用**；allocationStatus 对金额非法返回 pending（F19–F24、F35） | allocateByQty/validateManualAllocation 严格化；packing/extra/freight 校验补齐 |
| BUG-05 | 采购成本换算和成本确认校验错误 | 采购 15 USD 换算 99 元但原始 cost_factory=null 误判阻断；purchase_price=NaN 静默 NaN 链 | 采购输入先校验（NaN/±Infinity/负数/非法币种/USD 但汇率缺失 → 阻断）；换算成功以**最终计算成本**为校验对象（F25 四断言）；NaN 不进成本/利润/建议价（cost_usd/suggested/amount 全部加有限性守卫）；成本未确认仍不能 ready（F26–F32） | 采购换算段重写；成本校验改查最终计算成本；cost_usd/amount NaN 守卫 |

## 2. 修改的函数清单（仅 app/pricing.js，业务文件零改动）

| 函数 | 修改 |
|---|---|
| `computeQuote` | 头部手续费模式严格解析（BUG-01）；packing 费用统一分摊通路（BUG-03）；采购输入校验+最终成本校验（BUG-05）；extra/freight 有效性校验（BUG-04）；cost_usd/suggested/amount 有限性守卫 |
| `allocateByQty` | 金额非法拒绝（不静默归零） |
| `validateManualAllocation` | 金额非法拒绝；保留原签名兼容 |
| `validateManualAllocationFor` | **新增**：人工分摊 sort 归属严格校验 |
| `allocationStatus` | 金额非法 → pending；人工分支改用严格版校验 |
| `marginFromMarkupForMode / markupFromMarginForMode / afterFeeMarginFromMode` | 非法模式参数（非 0/1）返回 null |

**未修改**：model.js / store.js / pages.js / sheet.js / main.js / pdf-export.cjs / entitlements（CHANGE-VS-ORIGINAL.txt 证实业务文件与原版逐字节相同）。

## 3. 测试统计（分开统计，不沿用修复前的 281）

| 分段 | checks | 结果 |
|---|---|---|
| **润成 26 项原始回归 ×3 环境** | 78 | ✅ 全 PASS，**预期值一字未改** |
| P1-A 第一轮边界测试（K 段）×3 环境 | 210 | ✅ 全 PASS（K13/K16 按新语义重写：缺省=未知态） |
| **P1-A-FIX 新增缺陷回归（F 段）×3 环境** | **165** | ✅ 全 PASS（F01–F40 覆盖五类缺陷 + 守恒/防双计） |
| 三环境一致性 | 2 | ✅ 逐字节一致 |
| **run-all.js 合计** | **455** | **ALL PASS，EXIT=0** |
| 移植对账（8 场景，独立脚本） | 8 | ✅ PARITY PASS（比较字段：items 9 项 + totals 10 项 + warnings 全文 + ready，非全对象比较） |

## 4. 修复后验证结果

- ✅ 自动化测试：`node tests/pricing/run-all.js` → 455 checks ALL PASS，EXIT=0，三环境（node require / vm / renderer global）一致
- ✅ 复现对照：修复前 11/12 FAIL（P1A-FIX-repro-pre.log）→ 修复后 12/12 PASS（P1A-FIX-repro-post.log）
- ✅ 原版对账：8 场景全部一致（parity-check.ts 已改环境变量配置，无硬编码本机路径；未配置时明确报错 exit 2）
- ✅ ZIP 独立解压：见 §5
- ✅ 原版完整性：见 §5
- **遗留问题**：无阻断项。已知边界：① 采购输入非法但 cost_factory 有效时，建议价仍从有效成本计算（与其他 blocker 路径行为一致，单据不 ready）；② P1-B 才能解决的问题：feeInPrice/pricingVersion/fees[] 落库 schema（已记录于实施映射 §5.3，本轮未动）

## 5. ZIP 独立解压测试与原版完整性

见交付包内 `README-交付说明.md` 与 `SHA256SUMS.txt`；独立解压实测结果与本节同源（解压到全新临时目录运行 `node tests/pricing/run-all.js`，EXIT=0 / ALL PASS 455）。

原版完整性核对（SHA-256 对照）：
- `siwang-box-0.2.17-src`：与 P0 基线 `baseline-0.2.17/SHA256-baseline-0.2.17-src.txt` 一致 ✅
- `siwang-box-0.2.17-dev` 业务文件：与原版逐字节相同（CHANGE-VS-ORIGINAL.txt 仅多一行新增 app/pricing.js）✅
- 润成 V3 源码：只读未动（对账脚本只 require）✅
