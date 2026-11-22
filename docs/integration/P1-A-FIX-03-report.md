# P1-A-FIX-03 修复报告（BUG-10 定点修复：运费非法数据进入财务合计）

日期：2026-11-19
基线：P1-A-FIX-02 交付包 `siwang-box-integration-P1A-FIX02-20261119.zip`
（SHA-256 `18f2f18b…504ae`，解压核对一致后作为本轮唯一开发基线）
性质：独立验收发现的 BUG-10 定点修复。**不重写引擎、不改已冻结报价公式、不进入 P1-B。**

## 一、修改范围声明

| 文件 | 变更类型 |
|---|---|
| `app/pricing.js` | BUG-10A/10B 定点修复 |
| `tests/pricing/run-all.js` | H 段（BUG-10 专项 51 项）新增 + G27 预期按 BUG-10 定案更新（见 §四） |
| `README-交付说明.md`、`tests/pricing/README.md` | 交付说明更新 |
| `docs/integration/P1-A-FIX-03-report.md`（本文件） | 新增 |
| `docs/integration/P1-A-test-log.txt`、`P1-A-parity-log.txt` | 本轮实测日志（含退出码） |
| `SHA256SUMS.txt`、`SHA256-diff-vs-FIX02.txt`、`CHANGE-VS-ORIGINAL.txt` | 清单重算 |

model.js / store.js / pages.js / sheet.js / main.js / pdf-export.cjs / 授权系统：**零改动**（与 FIX-02 逐字节一致）。
润成原始 26 项、K 段、F 段（含 F36a–d）、G 段其余用例预期值**一字未改**。

## 二、BUG-10A：统一运费有效性校验

新增内部助手 `isFreightRowValid(fr)`——有效运费必须**同时**满足：

1. amount 为有限数字；
2. amount ≥ 0；
3. 最多两位小数；
4. currency 只能为 CNY 或 USD。

修复前问题（独立验收确认）：负数运费产生 blocker 后仍进入 freightUsd；EUR 币种在 fx 存在时被当作 CNY 折算（`else if (fxv)` 兜底分支）；三位小数运费仍进入合计；`freightConfirmedAll` 可保持 true 导致 order_profit 算出看似有效的错误值。

修复后（computeQuote 运费主循环重构）：校验失败时——

- 添加明确 blocker（「运费须为非负、最多两位小数且币种为 CNY 或 USD」）；
- `freightConfirmedAll=false`；
- **不进入** freightUsd / profitInputFreight / chargeFreight / packingChargedUsd，不参与 quotedFreight；
- 不得被当成其他币种折算（币种转换明确三分支：USD 直接用美元金额；CNY = 人民币金额 ÷ fx；其他币种 → 阻断，不参与计算）。

结果门：

- **非法已确认客户收费运费** → `chargedFreightInvalid=true` → `final_total=null`（客户应付总额不得显示为完整有效金额）；
- **非法内部实际运费** → `freightConfirmedAll=false` → `order_profit=null`（利润不得计算）。

## 三、BUG-10B：非法木箱费必须阻断建议价

修复前：packing 金额非法时虽加 blocker，但 `packingChargeTotalCny` 未形成正数 → `packingFeeObj=null` → `pendingAllocation` 门失效 → 产品建议价仍可生成。

修复后：阻断条件改为 `(packingFeeObj && packingStatus === 'pending') || packingInputInvalid`——只要存在已确认、向客户收取的非法 packing 费用（负数/NaN/三位小数/非法币种）：`packingInputInvalid=true`、`pendingAllocation=true`、`ready=false`、相关产品 `suggested_price=null`；非法金额同时被 BUG-10A 门排除在运费/客户收费/订单利润之外。不再依赖 packingFeeObj 是否存在。

## 四、G27 预期值更新披露（唯一测试预期变更，留痕）

FIX-02 的 G27 用例输入为「forwarder NaN + charge_customer + confirmed」，当时仅断言总额不含 NaN。该输入恰属 BUG-10 定案场景「非法客户收费运费 → final_total=null」，两条规则直接冲突。按新定案将 G27 断言由 `Number.isFinite(final_total)` 更新为 `final_total===null`，已在测试代码内注释留痕。此变更**不属于润成原始 26 项预期**，也不涉及 K/F 段；G26（金额缺失场景）断言未动、天然兼容。

## 五、专项回归（H 段，51 项 ×3 环境）

覆盖任务书 §四 全部 12 项场景：

| 任务书要求 | 用例 |
|---|---|
| 1. -100 CNY 运费拒绝且不进任何合计 | H1a–H1f（blocker / freightUsd=0 / charged=null / final_total=null / profit=null / ready=false） |
| 2. 100 EUR 拒绝、不当作 CNY | H2a–H2e（freightUsd=0 非 15.15） |
| 3. 100.001 CNY 拒绝 | H3a–H3e |
| 4. NaN 运费阻断不污染 | H4a–H4d |
| 5. -1 CNY 木箱费阻断 | H5a–H5e（suggested=null，BUG-10B 生效） |
| 6. 0.001 CNY 木箱费阻断 | H6a–H6c |
| 7. 非法 packing 币种 | H7a–H7d（币种非法 blocker + suggested=null） |
| 8. 非法内部运费 profit=null | H8a–H8c |
| 9. 非法客户收费 final_total=null | H9a–H9c |
| 10. 明确 0 CNY 通过 | H10a–H10c |
| 11. 明确 0 USD 通过 | H11a–H11c |
| 12. 正常 CNY/USD 计算不变 | H12a–H12g（500 CNY→75.76、300 USD→300、合法 packing 自动摊 190） |

全部为实际 PASS/FAIL 断言。

## 六、测试统计与验证结果

```
node tests/pricing/run-all.js  →  ALL PASS — 815 checks，EXIT=0（日志含退出码行）
```

| 分段 | 每环境 | ×3 环境 |
|---|---|---|
| 润成原始 26 项（预期值未改） | 26 | 78 |
| K 段边界（第一轮） | 70 | 210 |
| F 段缺陷回归（含 F36a–d） | 59 | 177 |
| G 段（FIX-02；G27 按 BUG-10 定案更新） | 65 | 195 |
| **H 段 BUG-10 专项（本轮新增）** | **51** | **153** |
| 三环境一致性对照 | — | 2 |
| **合计** | | **815** |

- 三环境（Node require / VM / Renderer global）全部通过；
- 润成对账 8 场景 PARITY PASS、EXIT=0（原有结果保留）；
- 历史 K/F/G 全部通过（无退化）；历史成交价保护、分摊守恒、木箱防双计回归通过；
- 原始 0.2.17 业务文件零改动（SHA-256 全量比对）。

## 七、阶段控制

本轮只修复 BUG-10。**状态：已编码、待独立审核；审核通过前不进入 P1-B，不扩大修改范围。**
