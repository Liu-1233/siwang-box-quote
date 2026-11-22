# P0 风险与实施映射报告（V2 修订版——已按审核意见写入业务决定）

日期：2026-11-19 ｜ 修订：2026-11-19（P0 审核意见）｜ 配套：P0-source-audit.md（结构）、P0-pricing-formula-review.md（公式，V2）

---

## 1. 迁移风险清单（按严重度排序，V2 更新对策）

| # | 风险 | 等级 | 依据 | 对策（V2 定案后更新） |
|---|---|---|---|---|
| R1 | schema v4→v5：ITEM_KEYS/doc 键扩列要同时改 写门 validateWritable+validateV4DocKeys+迁移函数三处，漏一处即整体只读 | 高 | store.js L87 enterBlocked('migrateFail') | 沿现迁移链新增 migrateV4toV5 纯函数；先在数据副本上演练"迁移→失败恢复→重复执行"（P1-B 验收 §5.5 全覆盖） |
| R2 | 双门校验漏新字段 → 老数据迁移失败进只读态，用户恐慌 | 高 | model.js L428-451 写门按 SCHEMA_VERSION 分支 | 新字段全部 nullable + 缺失补待补值；0.2.17 兼容测试（老单据不填新字段零变化）列为 P1-D 硬门槛 |
| R3 | 加成率三口径选错会造成全量报价偏差 | 高 | 公式报告 §2（V2） | **已定案方案 A**（润成现有算法）：markup 为主要输入，target_margin=(1−fee)×mk/(1+mk)，界面双显示（加成率+手续费后目标利润率），禁止标注为传统毛利率。P1-A 按冻结公式实现 |
| R4 | 成本数据泄露到客户纸面 | 高 | 任务书第 6 条+审核第三条 | **客户版单据一律字段白名单构建**（QT→PI/SC/CI 保留成本快照仅限内部库层；QT→PL 不传递成本字段、保留 sourceId）；sheet.js 现渲染层不渲染未知键天然安全；P1-D 增加"成本/手续费/利润/提成不泄露"专项断言（HTML+PDF 文本扫描含隐藏数据） |
| R5 | 混合单位费用摊入 | 中 | 公式报告 §4：润成无单位一致性拦截 | **审核定案**：同单位按数量平均分摊；异单位禁止自动平均；支持人工指定各行分摊金额，总额必须严格等于原始费用（舍入差额有确定分配规则）；未完成分摊显示"待分摊"，不生成正式含费用建议价；暂不做重量/体积加权。P1-A 实现并测试 |
| R6 | 装柜与 PL 两套包装通路被误当一条 | 中 | 审计 §7 | P2-E 桥接时显式区分；P1 不碰装柜。包装尺寸/净重/毛重按需填写，不作为新增产品必填项 |
| R7 | 0.2.17 无测试资产，回归基线缺失 | 中 | 审计 §1：包内无测试 | **P0 收尾补做 0.2.17 原版冒烟**（隔离 userData：老库打开/五单据纸面/PDF 导出/转换）+ 基线截图与 SHA-256 固化为"不变基线"（见 §3） |
| R8 | 转换链克隆整行会自动带成本快照到新单据 | 中（原判低，按审核上调） | 审计 §5 + 审核第三条 | **审核定案**：QT→PI/SC/CI 保留内部成本快照（仅内部）；**QT→PL 转换时显式剥离成本键**（不靠"纸面不渲染"兜底，字段层就不传），保留 sourceId；利润与提成按实际订单核算一次，转换不重复统计 |
| R9 | 丝网盒子老法/含费双口径（fee_in_price）需要界面开关 | 低 | 公式报告 §3 | P1-C 定价面板加口径开关；**新报价默认 fee_in_price=1（含费），历史兼容保留 fee_in_price=0 计算能力** |
| R10 | 成本计价单位语义混用（行总价 vs 单位成本） | 中 | 审核第五条 | 润成原始行总价（如"包装/木箱费"）**不得直接写入单位成本字段**；P1-B 适配层转换：单位成本 = 行总价 ÷ 本行数量，保留原始金额与转换依据（来源/÷数量）字段；一次性订单费用入 doc.fees[] |

## 2. P1 实际修改文件清单（行级定位）

### P1-A（定价引擎，新增为主）
| 文件 | 改动 |
|---|---|
| `app/pricing.js` | **新增**：computeQuote 移植（r2/r4/ceil2/halfUp2、成本合计、fx、denom 建议价、费用摊入、防双计、ready 门、提成 zero_on_loss）；UMD 三环境兼容（仿 sheet.js L18-21 工厂模式） |
| `tests/pricing/` | **新增**：26 项润成测试移植 + 边界新增（混合单位拦截、分摊舍入差额、null/0、NaN 防护、纸面无成本泄露断言） |

### P1-B（schema v5）
| 文件 | 改动 |
|---|---|
| `app/model.js` L19 | SCHEMA_VERSION 4→5 |
| `app/model.js` ITEM_KEYS(L81) | + `specText,costFactory,costPacking,costInland,costOther,costConfirmed`（nullable，validateItems L573 同步） |
| `app/model.js` 产品校验 L490 | 数值键数组 + 四项成本（非负，可空） |
| `app/model.js` validateV4 家族 | 新增 validateV5（读门）+ validateWritable 分支（写门） |
| `app/model.js` L1539 后 | 新增 `migrateV4toV5`（缺字段补 null，已有值原样） |
| `app/store.js` 迁移链 L298 | 注册 v4→v5；SBW.migrate 主进程侧同步（main.js/storage.js 迁移入口） |

### P1-C（报价编辑器）
| 文件 | 改动 |
|---|---|
| `app/pages.js` QuoteEdit（L652 起） | 明细行：名称列/规格描述列独立、四项成本输入、成本状态、建议价展示+一键填入；费用面板（fees[]，区分内部/对客）；定价面板（fx/feeRate/targetMargin/加成率换算调用 pricing.js，**页面不另写公式**）；价格保护六条（§6.4） |
| `app/store.js` settings | 默认 fx/fee_rate/commission 20%（L72 seed + normalize L96） |
| `app/sheet.js` | **P1 不改**（成本字段不在其渲染路径；规格描述展示 P2-C） |

### 明确不动的文件
`product-specs.js / product-intake.js / wire-quote-rules.js`（结构化规格语义不变）、`main.js`（除迁移入口注册）、`pdf-export.cjs`（P2-C 才动）、授权/卡密全链路。

## 3. v4 基线测试结果（0.2.17 现状固化，V2 更新）

| 检查 | 结果 |
|---|---|
| 24 个 JS（main/storage/costing-storage/preload/updater/3 cjs/app 全部）语法校验 | ✅ 24/24 通过 |
| 润成 26 项定价测试真实运行 | ✅ 26/26 PASS（公式报告 §7） |
| app.asar↔安装包同源性 | ✅ 提取自安装包本体（README_提取说明.md） |
| 0.2.17 人工冒烟清单 | ✅ P0 收尾完成（隔离 userData 运行原版：老库打开/五单据纸面/PDF 导出/转换），截图与 SHA-256 见 `docs/integration/baseline-0.2.17/` |
| 包内自动化测试 | ❌ 不存在（P1 建立的 tests/ 为首个） |

## 4. 待确认事项 → 审核裁定结果（V2 全部关闭，2026-11-19）

| V1 待确认项 | 审核裁定 |
|---|---|
| 1. 加成率口径 A/B | **方案 A**（润成现有算法）。markup 主要输入；手续费默认计入；target_margin 沿用润成内部口径；界面同时显示加成率与手续费后目标利润率；不得标为传统毛利率；保留 fee_in_price=0 兼容，新报价默认 1 |
| 2. 混合单位分摊 | 同单位按数量平均摊；异单位禁止自动平均；支持人工指定各行金额且总额严格等于原始费用；未完成分摊显示"待分摊"不给正式含费用建议价；暂不做重量/体积加权 |
| 3. 成本快照随转换 | QT→PI/SC/CI 保留成本快照（内部）；**QT→PL 不传成本字段**、保留 sourceId；客户版一律字段白名单构建；利润/提成按订单核算一次不重复统计 |
| 4. 默认值 | fx 新报价默认留空（可提示上次值，须用户确认）；feeRate 默认 3% 可改；commissionRate 默认 20% 可改；提成=订单纯利润×提成率，亏损为 0 |

## 5. P0 V2 审核补充（2026-11-19，四项定案）

1. **历史报价保护**：新报价默认 fee_in_price=1；老报价不因 v4→v5 迁移改变原成交价格；缺少 fee_in_price 的历史单据不自动套用新默认值；增加 pricingVersion 机制保留计算口径。
   - 引擎层落点（P1-A 已实现）：`PRICING_VERSION` 常量（随单据快照落盘，P1-B 进 doc schema）；引擎不覆盖已存 final_price（K14i 断言）；建议价按**存储的** target_margin/fee_in_price 计算，不因迁移重算。
   - **历史语义区分（最后审核补充 §3 定案）**：
     - 润成 V3 历史数据：缺省 fee_in_price → 含费（V3 源码 L155 实证 `q.fee_in_price !== 0`），引擎 1:1 保留；
     - 丝网盒子 v4 历史数据：v4 schema 无任何定价参数，**P1-B 迁移保留空值、不自动判断报价模式**；引擎对缺 target_margin 的行为与 V3 1:1（margin||0 零加成+告警，K16a–d），历史成交价恒不被覆盖（K16b）；
     - 新建报价：明确写入 feeInPrice=1（编辑器层 P1-C 落实）；缺定价依据的历史单据在用户主动重新定价时提示确认模式（引擎已有告警，P1-C 在告警存在时不得自动填价）。
2. **两种报价模式分别处理**：fee_in_price=1 → target_margin=(1−fee)×markup/(1+markup)；fee_in_price=0 → target_margin=markup/(1+markup)（40% 加成 → 成本×1.4）；切换模式必须重新换算，不得沿用另一模式换算值。
   - P1-A 已实现：`marginFromMarkupForMode / markupFromMarginForMode / afterFeeMarginFromMode`（双模式）+ K14b–h、K15a–k 断言（含审核四指标对照表逐格断言）。
   - **显示语义（最后审核补充 §2 定案）**：mode1 手续费后利润率=target_margin（27.71%）；mode0 引擎 target_margin=28.57% 但手续费后利润率=target_margin−fee=25.57%，**界面不得把 mode0 的 28.57% 显示为手续费后利润率**（`afterFeeMarginFromMode` 供界面调用，K15h 断言）。四指标对照：含费 售价144.33/27.71%/27.71%/30.71%；不含费 售价140.00/28.57%/25.57%/28.57%。
3. **补齐 v5 数据模型字段（P1-B 完整清单，最后审核补充 §4 定案）**：
   - product：`specText / costFactory / costPacking / costInland / costOther / costConfirmed`
   - item：`specText / costFactory / costPacking / costInland / costOther / costConfirmed`
   - doc：`fx / feeRate / targetMargin / markupRate / feeInPrice / pricingVersion / commissionRate / fees`
   - 全部字段必须同时进入 model.js 校验、store.js 读写白名单与迁移链（漏一处即整体只读，见 R1/R2 对策）。
   - **字段类型校验要求（最后审核补充 §3 定案，P1-B 校验器按此实现）**：
     - `costConfirmed`（product/item）：布尔语义，仅允许 `0 | 1 | null`（迁移对 v4/润成缺失值保留 null=未确认；禁字符串/其他数值）；
     - `feeInPrice`（doc）：仅允许 `0 | 1 | null`——**null 是未知状态，不等于 1**；迁移不得给 v4 历史单补默认值；润成来源历史数据按其源码缺省语义（含费）在编辑器层标注、DB 值仍保持 null；
     - `pricingVersion`（doc）：字符串或 null；历史单（v4/润成导入）保留 null，新建报价写入引擎导出的 `Pricing.PRICING_VERSION`；
     - `fees[]`（doc）：数组或 null；元素结构 `{ item, amount, currency, confirmed, chargeCustomer, includedInCost, allocations? }`，其中 amount 非负有限数、currency 在允许集、allocations 存在时须通过引擎 `validateManualAllocation`（Σ 严格等于原始费用）；
     - 数值字段（fx/feeRate/targetMargin/markupRate/commissionRate）：null 或 [0,1) 区间有限数（fx 为正有限数）；
     - 迁移链对以上字段一律"缺失保留 null"，不做隐式转换；写入白名单与校验同步更新三处（validateWritable / validateV4DocKeys→v5 / migrateV4toV5）。
4. **测试阶段划分**：P1-A 验证引擎输出与内部成本数据结构隔离（已完成：内部成本/利润/提成只出现在 computeQuote 返回对象，无任何纸面渲染依赖）；P1-D 验证真实五类客户单据 HTML/PDF/隐藏内容不泄露成本、手续费、利润及提成。

## 6. 结论与 P1-A 真实实施状态（最后审核补充 §5 校准）

P0 收尾完成（报告修订+冒烟基线+开发副本哈希核对）。**P1-A 实际状态：已完成编码与测试，标记为「待验收」**——真实产物：`siwang-box-0.2.17-dev/app/pricing.js`（UMD 纯函数）+ `tests/pricing/`（run-all.js 281 checks ALL PASS + parity-check.ts 8/8），日志见 `P1-A-test-log.txt` / `P1-A-parity-log.txt`，SHA-256 见交付包 `SHA256SUMS.txt`。原有业务文件（model.js/store.js/pages.js/sheet.js/main.js/pdf-export.cjs）与原版逐字节相同（CHANGE-VS-ORIGINAL.txt 为空）。**等待独立审核，验收前不进入 P1-B。**
