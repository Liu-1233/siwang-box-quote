# P1-A 定价引擎迁移报告（**第一轮已交付；第二轮缺陷修复见 P1-A-fix-report.md，状态：待独立验收**）

日期：2026-11-19 ｜ 前置：P0 三报告（V2 修订版）已按审核意见修订并定案方案 A ｜ 开发目录：`D:\siwanghezi\siwang-box-0.2.17-dev`（原 `siwang-box-0.2.17-src` 全程只读）

> **P1-A-FIX-01（第二轮）**：第一轮独立审核发现五类缺陷（手续费模式识别/人工分摊归属/packing 绕过单位检查/非法费用静默归零/采购换算校验），已定点修复并新增 F01–F40 回归（165 checks ×3 环境）。修复后合计 **455 checks ALL PASS**，详见 `P1-A-fix-report.md`。本文档保留第一轮内容作为基线记录。

**实施状态声明（按最后审核补充 §5 要求如实校准）**：本阶段代码**已实际编码并通过全部测试**（非计划或设计描述）。真实证据：`app/pricing.js` 与 `tests/pricing/` 源码、`P1-A-test-log.txt`（281 checks ALL PASS，EXIT=0）、`P1-A-parity-log.txt`（8/8）、交付包 SHA256SUMS.txt。**待独立审核验收。**

**交付 ZIP**：`D:\siwanghezi\siwang-box-integration-P1A-20261119.zip`（908,497 字节）
SHA-256：`B1A37B808BE075A6F95A31494E6CD49B867143EA0110308BE62497FAED91D64D`
解压后独立运行测试：`node tests/pricing/run-all.js`（零 npm 依赖，已在打包前于包内副本实测 EXIT=0 / ALL PASS 281）。

---

## 1. 交付物清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `app/pricing.js` | 新增 | 定价引擎 UMD 纯函数模块（约 470 行），主进程/渲染进程/VM 三环境可用 |
| `tests/pricing/run-all.js` | 新增 | 测试套件：26 项原始回归 ×3 环境 + 三环境一致性 + 边界测试 ×3 环境（**281 checks**，含双手续费模式段 K14、四指标对照表 K15、v4 历史单保护 K16） |
| `tests/pricing/parity-check.ts` | 新增 | 移植对账脚本：润成 V3 原版 TS 实现 vs 移植版，8 个代表性场景深度对比 |
| `docs/integration/P1-A-test-log.txt` | 日志 | run-all.js 完整运行日志（ALL PASS，209 checks） |
| `docs/integration/P1-A-parity-log.txt` | 日志 | 对账日志（PARITY PASS 8/8） |
| `docs/integration/P0-pricing-formula-review.md` | 修订 | V2：更正 15.13→21.865 USD、28.57%→30.71% 等基准算例错误；公式定案冻结 |
| `docs/integration/P0-risk-and-implementation-map.md` | 修订 | V2：审核决定全部写入（R3/R4/R5/R8/R10 对策更新、§4 裁定表） |
| `docs/integration/baseline-0.2.17/` | 归档 | 0.2.17 原版冒烟：7 场景截图/PDF/日志 + SHA256-baseline + README |

## 2. 实现说明

### 2.1 computeQuote（润成 1:1 移植）

- 全部计算路径 1:1：r2/r4/ceil2/halfUp2、成本合计（出厂+包装÷数量+内陆+其他+面板摊入）、fx 折算、含费/老法双口径（fee_in_price）、运费面板摊入与防双计、EXW/FOB/CIF/DDP 必核费用项、目标比较口径、提成 zero_on_loss、ready 门
- **警告/阻断文案、告警去重排序、null 语义（数值 null 直接阻断，不降级 0）均与润成逐行一致**
- 26 项原始测试预期值一字未改，三环境全过；8 场景深度对账与原版 TS 实现输出完全一致（含 warnings 顺序）

### 2.2 P0 审核定案的新增能力

| 能力 | 实现 | 对应测试 |
|---|---|---|
| 方案 A 换算 | `marginFromMarkup(mk,fee)=(1−fee)mk/(1+mk)`；`markupFromMargin` 反算；`grossMarginFromMarkup` 传统毛利率参照（仅显示，禁止与 target_margin 混淆） | K1a–e、K2a–c |
| 同单位按数量平均分摊 | `allocateByQty`：前 n−1 行 halfUp2，**合计差额归末行，总额严格守恒** | K4a–d |
| 混合单位拦截 | `checkUnitsForAllocation`（set/Set/套 归一）；混合→ allocateByQty 返回 null | K5a–c |
| 人工分摊 | `validateManualAllocation`：非负、两位小数、**Σ 严格等于原始费用（1e-9 容差）** | K6a–d |
| 待分摊门 | `allocationStatus`→ none/pending/auto/manual（先 auto 后 manual）；computeQuote 第 6 参 `opts.fee`：pending 时建议价置空+阻断；完成分摊（auto/manual）时按 行额÷行数量 摊入每件成本（计算层，不回写） | K7a–h |
| null/0 语义 | 数值 null 阻断；0+cost_confirmed=明确零；未确认→告警+不 ready | K8a–d |
| NaN/Infinity 防护 | qty=Infinity、cost=NaN 全部阻断，不产生非法数 | K9a–c |
| 手动价格保护 | final_price=0 保留（不被建议价覆盖）+ 成交单价阻断；final_price 有值恒优先（I7） | K10a–b |
| 提成 zero_on_loss | 亏损单提成 0、公司承担全额亏损 | K11a–c |
| **双手续费模式（P0 V2 审核补充 §2）** | `marginFromMarkupForMode(mk,fee,feeInPrice)`：mode1 → (1−fee)mk/(1+mk)，mode0 → mk/(1+mk)（40% 加成 → 成本×1.4）；`markupFromMarginForMode` 反算；切换模式必须重算不得沿用 | K14b–h |
| **双模式显示语义（最后审核补充 §2）** | `afterFeeMarginFromMode(tm,fee,feeInPrice)`：mode1 手续费后利润率=target_margin（27.71%）；mode0=target_margin−fee（25.57%），界面不得把 mode0 引擎 target_margin（28.57%）当手续费后利润率显示；审核四指标对照表逐格断言（含费 144.33/27.71%/27.71%/30.71%，不含费 140.00/28.57%/25.57%/28.57%，USD 售价按币种精度 ceil2：21.87/21.22） | K15a–k |
| **pricingVersion + 历史兼容（最后审核补充 §3）** | `PRICING_VERSION` 常量（P1-B 随 doc schema 落盘）；历史单保护：润成 V3 历史缺省 fee_in_price 按其源码语义视为含费（L155 实证，非套新默认）；丝网盒子 v4 历史单无定价参数 → 引擎与 V3 1:1（margin||0 零加成+缺参告警，成交价 21.5 恒不被覆盖；P1-B 迁移对 v4 缺失定价参数**保留空值不判模式**）；编辑器层 P1-C 在缺参告警存在时不得自动填价 | K14a/i、K16a–d、K13、I7 |
| **测试阶段划分（P0 V2 审核补充 §4）** | P1-A：引擎输出与内部成本数据结构隔离（内部成本/利润/提成仅存在于 computeQuote 返回对象，无纸面渲染依赖）；P1-D：五类真实单据 HTML/PDF/隐藏内容不泄露成本、手续费、利润、提成 | 见 §5 边界 |
| 币种转换 | USD 采购价×fx 折出厂成本 | K12a–c |
| fee_in_price 兼容 | 缺省视为含费口径（历史单兼容）；=0 走老法（E 组） | K13、E1–E2 |

### 2.3 UMD 三环境

与 sheet.js 相同工厂模式：`module.exports`（主进程/Node）→ `root.Pricing`（渲染进程）。测试用三种方式加载同一份真实文件（require / vm+module / vm+window），**三环境输出逐字节一致**（crossCheck）。

## 3. 测试结果汇总

| 套件 | checks | 结果 |
|---|---|---|
| **润成 26 项原始回归 ×3 环境**（node-require / vm / renderer-global，预期值未改） | 78 | ✅ 全 PASS |
| **P1-A 新增边界测试 ×3 环境**（K1–K16：方案 A 基准、分摊守恒、混合单位拦截、人工分摊、待分摊门、null/0、NaN 防护、手动价保护、提成、USD 采购换算、缺省含费、双模式换算、四指标对照表、v4 历史单保护） | 201 | ✅ 全 PASS |
| 三环境一致性对照（3 行环境比对 + 1 行聚合断言） | 2 | ✅ 逐字节一致 |
| 移植对账 vs 润成原版 TS（8 场景全字段，独立脚本） | 8 | ✅ PARITY PASS |
| **合计（run-all.js）** | **281** | **ALL PASS，EXIT=0**（日志 P1-A-test-log.txt） |

> 统计口径（最后审核补充 §4）：**原始 26 项（78 checks）与 P1-A 新增（201 checks）分开统计**，上表独立成行；对账脚本（8 场景）为跨实现验证，不计入 run-all.js 的 281。

测试过程中修正过 3 处**测试用例预期**（K4a 差额归末行的规则注释、K7d 建议价基数、K7h auto/manual 判定顺序），实现侧修正 1 处真缺陷（allocationStatus 先 manual 后 auto 导致 auto 分支不可达）。**26 项原始预期值从未改动。**

## 4. 修改文件清单与 SHA-256

- 新增：`app/pricing.js`、`tests/pricing/run-all.js`、`tests/pricing/parity-check.ts`
- package.json/package-lock.json：`npm install --save-dev electron@44.7.0`（仅 P0 冒烟所需运行时，业务代码零关联）
- **未修改任何业务文件**：model.js / store.js / pages.js / sheet.js / main.js / pdf-export.cjs 等与原版逐字节相同（见 SHA256 对比）
- 完整清单：交付包内 `SHA256SUMS.txt`

## 5. P1 边界遵守情况

- 未动 model.js / store.js / pages.js / sheet.js（任务书 §七）✅
- 未实现 P1-B（schema v5）/ P1-C（编辑器）/ P2 任何内容 ✅
- 原始目录 `siwang-box-0.2.17-src`、正式安装包、已安装 0.2.16、润成 V3/V2/云端数据全程只读 ✅
- entitlements 未触碰 ✅

## 6. 已知问题 / 待 P1-B 衔接

1. `opts.fee` 是 doc.fees[] 的临时入口（第 6 参），v5 落库后 P1-C 从单据字段直接传入
2. 混合单位目前整体拦截；若未来需要"按行内单位分别分摊"，需扩展 allocateByQty（审核决定暂不做）
3. `grossMarginFromMarkup` 仅供界面参照显示，不得参与定价
