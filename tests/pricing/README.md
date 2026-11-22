# P1-A 定价引擎测试套件（tests/pricing/）

## 独立运行（零依赖，解压 ZIP 后即可）

```bash
node tests/pricing/run-all.js
```

要求：Node.js ≥ 14（仅用原生模块，无 npm 依赖）。预期输出末行 `ALL PASS — 851 checks`，退出码 0。

## 测试构成（分开统计，P1-A-FIX-04）

| 分段 | 每环境 | ×3 环境 | 说明 |
|---|---|---|---|
| 润成 26 项原始回归 | 26 | 78 | 预期值与润成 V3 `pricing.test.ts` 一字未改 |
| K 段边界测试（第一轮） | 70 | 210 | K1–K16（基准算例/分摊守恒/混合单位拦截/人工分摊/待分摊门/null-0 语义/NaN 防护/手填价保护/亏损提成/双手续费模式/四指标对照/v4 历史单保护） |
| F 段缺陷回归（第二轮 FIX-01） | 59 | 177 | F01–F40（BUG-01～05 回归；F36a–d 断言已在 FIX-02 补齐） |
| G 段专项回归（第三轮 FIX-02） | 65 | 195 | G1–G28（BUG-06 手续费模式严格校验 / BUG-07 分摊原始金额精度 / BUG-08 原始明细 sort 唯一性 / BUG-09 费用缺失与零值语义；G27 预期按 FIX-03 BUG-10 定案更新，代码内留痕） |
| **H 段专项回归（第四轮 FIX-03）** | **51** | **153** | H1–H12（BUG-10A 统一运费有效性校验 / BUG-10B 非法木箱费阻断建议价；覆盖任务书 12 项场景） |
| **H13 专项回归（第五轮 FIX-04）** | **12** | **36** | BUG-11：合法 CNY 客户收费运费 + fx 缺失/无效（null/0/NaN/Infinity/负数）→ final_total=null、order_profit=null、ready=false；USD 行不依赖 fx 不受影响；手填成交价保留 |
| 三环境一致性对照 | — | 2 | 三环境（node require / Node VM / 渲染进程全局挂载）计算结果逐字节一致（对照打印 4 行） |
| **合计** | | **851** | |

## 三环境加载方式

- `node-require`：`require('../app/pricing.js')`（UMD module.exports 分支）
- `vm`：源码文本在 `node:vm` 中执行后取全局挂载（模拟渲染进程脚本注入）
- `renderer-global`：`vm` + 模拟 `window` 全局（UMD root 分支）

## P1-A 临时计算参数接口（P1-A-FIX-01 引入，P1-B 由 doc.fees[] 落库替代）

`computeQuote(q, items, freight, extra, supplierUnitById, opts)` 第 6 参 `opts`：

| 参数 | 类型 | 说明 |
|---|---|---|
| `opts.fee` | `{ amountCny, allocations } \| null` | 一次性订单费用（doc.fees[] 的临时入口）。amountCny 必须为非负有限**两位小数**数字（缺失/NaN/Infinity/三位小数 → pending 阻断，0=明确零费用）；allocations 为 null → pending；为自动结果 → auto；人工合法（sort 合法/唯一/完整覆盖数量>0 的行、Σ 严格等于 amountCny）→ manual。pending 时不给正式建议价、ready=false。**整体缺省（不传 opts.fee）= 本单无一次性费用，合法**（唯一缺省例外，见 P1-A-FIX-02 报告 §五） |
| `opts.packingFeeAllocations` | `[{sort, amountCny}] \| null` | 运费面板「木箱及包装费」（charge_customer 且 confirmed）的人工分摊。未提供且明细单位一致 → 自动按数量平均（与旧通路数值一致）；未提供且混合单位 → pending 阻断；提供 → 走与 fee 相同的严格校验（含原始明细 sort 校验）。**整体缺省 + 无 packing 运费行 = 无该费用，合法** |

纯函数设计：两参数只影响计算输出，不修改任何输入对象、不落库、不写文件。

## 费用录入零值语义（BUG-09 定案）

明确输入**数字 0** 才代表零费用。`extra.discount`、`extra.other_charges`、运费金额、木箱金额、`opts.fee.amountCny`：缺失/null/NaN/Infinity/负数/三位以上小数一律阻断或 pending，不存在 `|| 0` 静默降级。分摊金额在 r2 舍入**之前**校验（0.004 不被舍入成零费用放行）。

## 运费统一有效性校验（BUG-10 定案，P1-A-FIX-03）

运费行有效 = amount 有限非负、最多两位小数、currency ∈ {CNY, USD}。非法运费（负数/EUR 等/三位小数/NaN/Infinity）：

- 产生明确 blocker，`freightConfirmedAll=false`；
- 不进入 freightUsd / profitInputFreight / chargeFreight / packingChargedUsd，不参与 quotedFreight，不按其他币种折算（USD=直接美元、CNY=÷fx）；
- 非法**已确认客户收费** → `final_total=null`；非法**内部实际运费** → `order_profit=null`；
- 非法**已确认客户收费 packing** → `pendingAllocation=true`，正式建议价 `suggested_price=null`（BUG-10B，不依赖 packingFeeObj 是否形成）。

## 汇率缺失时的客户收费运费（BUG-11 定案，P1-A-FIX-04）

金额与币种均合法的 **CNY 客户收费运费**，在 fx 缺失/无效（null/0/NaN/Infinity/负数 → fxv=null）时无法折算成美元：不进入 chargeFreight / packingChargedUsd / quotedFreight，并标记客户收费总额不完整 → `final_total=null`（不得静默漏收显示有效总额）；`order_profit=null`（freightConfirmedAll=false）、`ready=false`（!!fx 门）。**USD 运费不依赖 fx**，缺汇率时美元金额照常计入。

## 跨实现对账（可选，不属 851 项）

`parity-check.ts` 需在润成 V3 工程内用 tsx 运行（依赖其原版 `src/pricing.ts`），路径用环境变量配置（不再硬编码）：

```bash
RUNCHENG_V3_DIR=<润成V3目录> SIWANG_BOX_DEV_DIR=<丝网盒子开发目录> \
  node <tsx cli> tests/pricing/parity-check.ts
```

未配置时明确报错退出（exit 2）。8 场景比较字段见脚本内注释（items 9 字段 + totals 10 字段 + warnings 全文 + ready；非全对象比较）。

## 测试中发现并修正的项（审计留痕）

- 第一轮：测试预期修正 3 处（K4a 差额归末行注释、K7d 建议价基数、K7h auto/manual 判定顺序）；实现侧修正 1 处真缺陷（allocationStatus 先 manual 后 auto 导致 auto 分支不可达）
- 第二轮（FIX-01）：F26/F31/F37b 断言口径修正（行总额守恒 vs 每件成本）；BUG-01～05 实现修复
- 第三轮（FIX-02）：F36 补齐有效断言（此前只创建计算结果未断言）；新增 G 段 65 项专项——**26 项原始预期值与 K/F 段既有预期值从未改动**
- 第四轮（FIX-03）：G27 预期按 BUG-10 定案更新（非法客户收费 → final_total=null，代码内注释留痕，非原始 26 项预期）；新增 H 段 51 项专项
- 第五轮（FIX-04）：新增 H13 共 12 项专项（BUG-11）——**26 项原始预期值与 K/F/G/H 段既有预期值从未改动**
