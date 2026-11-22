# P1-A-FIX-04 修复报告：CNY 客户收费运费缺少汇率时阻断最终总额

日期：2026-11-19
基线：P1-A-FIX-03 交付包 `siwang-box-integration-P1A-FIX03-20261119.zip`（SHA-256 `7c8e6961…233e`，解压后核对一致）
性质：独立验收发现的 BUG-11 定点修复。不重写定价引擎，不改冻结公式，不进入 P1-B。

## 一、缺陷复现（修复前）

输入：产品成交价 100 USD（final_price 手填）、客户承担国内运费 500 CNY（confirmed=1、charge_customer=1）、fx=null。

修复前实际输出：

| 字段 | 修复前 | 问题 |
|---|---|---|
| freight_charged_usd | null | 该笔 CNY 运费未折算（fx 缺失） |
| final_total | **100** | ❌ 客户应付总额仍显示为有效金额——500 CNY 运费被静默漏收 |
| order_profit | null | 正确（freightConfirmedAll 已置 false） |
| ready | false | 正确（!!fx 门） |

根因：客户收费分支（`fr.charge_customer`）中，合法 CNY 行在 `fxv` 缺失时落入 `else if (fxv)` 之后的空白路径——既不加 `chargeFreight`，也不设置任何"客户收费总额不完整"标记，`finalTotal` 照常计算。BUG-10 的 `chargedFreightInvalid` 只覆盖**金额/币种非法**的情形，未覆盖**金额合法但无法折算**的情形。

## 二、修复内容（仅 app/pricing.js + tests/pricing/run-all.js）

### pricing.js（客户收费分支补一个 else）

```
} else if (fr.currency === 'USD') { … }        // USD 不依赖 fx，不变
else if (fxv) { chargeFreight += …; … }        // 正常 CNY 折算，不变
else {                                          // BUG-11 新增：
  chargedFreightInvalid = true;                 //   标记客户收费总额不完整
  warnings.push('汇率缺失，向客户收取的人民币运费无法折算，客户应付总额暂不可用');
}
```

效果链路（复用既有门，未新增机制）：
- 不进入 `chargeFreight` / `packingChargedUsd` / `quotedFreight`（原空白分支本就不累加）
- `chargedFreightInvalid=true` → **final_total=null**（既有 BUG-10 门）
- `freightConfirmedAll=false`（已确认分支既有逻辑）→ **order_profit=null**
- **ready=false**（`!!fx` 门 + freightConfirmedAll 门）
- USD 行不受影响（不依赖 fx，`H13d/e` 断言 300 USD 仍全额计入）
- fxv 清洗已有：fx 为 null/0/NaN/Infinity/负数 → fxv=null，全部落入新分支

### tests/pricing/run-all.js（新增 H13，12 项 ×3 环境 = 36）

| 用例 | 断言 |
|---|---|
| H13a | CNY 客户收费 + fx=null → final_total=null |
| H13b | 同场景 order_profit=null |
| H13c | 同场景 ready=false |
| H13d | USD 客户收费 300 不因缺汇率丢失：freight_charged_usd=300 且 final_total 有限正值 |
| H13e | 同场景 freight_actual_usd=300（USD 直接用美元） |
| H13f–i | fx=0 / NaN / Infinity / −6.6 → final_total=null、order_profit=null、ready=false |
| H13g | fx=null 时 freight_charged_usd=null（不进入客户收费合计） |
| H13h | fx=null 时 freight_actual_usd=0（不进入实际运费合计） |
| H13i | fx=null 手填成交价 100 保留（amount=100，历史成交价保护；注：suggested_price 依赖 fx 折算成本，此时为 null，不属于保护对象） |

均为实际 PASS/FAIL 断言（check/checkTrue），无空跑。

## 三、回归验证

- **851 checks ALL PASS，EXIT=0**：原始 78（26×3，预期值一字未改）+ K 210 + F 177 + G 195 + H12 及之前 117 + **H13 新增 36** + 一致性 2
- 三环境（Node require / VM / Renderer global）全过
- **润成对账 8/8 PARITY PASS**（结果与 FIX-03 一致）
- 历史成交价保护、分摊守恒、防双计、手续费模式无退化（既有 K/F/G/H 用例全过）
- 原版 0.2.17 业务文件零改动（`diff -rq` 与 SHA-256 全量比对：仅 app/pricing.js 为新增文件）

## 四、修改文件清单

| 文件 | 变更 |
|---|---|
| app/pricing.js | 客户收费分支新增 else（BUG-11）；头注释补 BUG-11 条目。约 +12 行 |
| tests/pricing/run-all.js | 新增 H13 共 12 项断言 |
| docs/integration/P1-A-FIX-04-report.md | 本报告（新增） |
| docs/integration/SHA256-diff-vs-FIX03.txt | 与 FIX-02→03 同规格的逐文件差异（新增） |
| README-交付说明.md / tests/pricing/README.md | 更新至 FIX-04 状态 |
| docs/integration/P1-A-test-log.txt | 更新（含 `[EXIT=0]` 行） |
| docs/integration/P1-A-parity-log.txt | 重新生成（8/8 PASS，内容与 FIX-03 一致） |
| CHANGE-VS-ORIGINAL.txt / SHA256SUMS.txt | 重新生成 |

model.js、store.js、pages.js、sheet.js、main.js、pdf-export.cjs、授权系统：**未修改**。

## 五、交付

- ZIP：`siwang-box-integration-P1A-FIX04-20261119.zip`（SHA-256 见 SHA256SUMS 同级记录与交付说明）
- 独立解压实测：两个全新临时目录解压后运行 `node tests/pricing/run-all.js`，均 `ALL PASS — 851 checks`、EXIT=0
- 阶段状态：**已编码、待独立验收；验收通过前不进入 P1-B。**
