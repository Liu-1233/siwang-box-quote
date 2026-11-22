# P1-D-05 FIX-01 · 测试报告

所有测试均在**隔离副本 + 隔离 userData** 内完成；未触碰生产程序、生产 userData、生产数据库。

| 项 | 值 |
|---|---|
| 工程根 | `siwang-box-p1d05-fix01-work`（由 `siwang-box-p1d05-20261122.zip` 全新解压） |
| 基线 | `siwang-box-p1d04-final-20261121.zip`（`f5dc9924…cad3d9`，已校验） |
| 隔离 userData | `E:/CDriveMigration/Temp/p1d05fix01/e2e/ud`（由 `SBW_E2E_SEED` 复制） |
| 日期 | 2026-11-22 |

## 1. 全量回归

| 套件 | 断言 | FAIL | 日志 |
|---|---|---|---|
| `tests/schema` | 194 | 0 | `P1D05F01-regression-schema.log` |
| `tests/p1c` | 229 | 0 | `P1D05F01-regression-p1c.log` |
| `tests/p1d` | 51 | 0 | `P1D05F01-regression-p1d.log` |
| `tests/p1d3` | 117 | 0 | `P1D05F01-regression-p1d3.log` |
| `tests/pricing` | 851 | 0 | `P1D05F01-regression-pricing.log` |
| **合计** | **1442** | **0** | 与阶段二同口径（原 1439 + 3 条规格图不回退断言） |

## 2. 专项测试

| 测试 | 结果 | 日志 |
|---|---|---|
| 图片链路探针（阶段二 22 项） | **22 / 22** | `P1D05F01-image-probe.log` |
| 实物图三态（新增 20 项） | **20 / 20** | `P1D05F01-image-modes.log` |
| 分页专项（含 SC 空白页检测） | **0 问题** | `P1D05F01-pagination.log` / `.json` |
| Electron 实际操作 E2E | **108 / 108** | `P1D05F01-e2e-full.log` |
| E2E 换路径复跑（可移植性） | **108 / 108** | `P1D05F01-e2e-fresh-copy.log` |

## 3. E2E 场景明细（108 项）

| 场景 | 断言 | 说明 |
|---|---|---|
| S1-UI-LAYOUT | 17 | 六区顺序、参数条、风险提示、折叠、A4 预览、按钮、内置实物图资源 |
| S2-NEW-SAVE | 16 | 新建 QT、选 3 个产品、实物图带入、规格图快照不覆盖、编辑、费用分摊、保存 |
| S3-REOPEN | 11 | 新进程重开：单号/行数/图片快照/数量价格/费用/条款/预览 |
| S4-PI | 7 | QT→PI 转换、实物图继承、统一版式、纸面含图、保存 |
| S4-SC | 7 | 同上（SC） |
| S4-CI | 7 | 同上（CI） |
| S4-PL | 9 | 同上（PL）+ 金额/内部字段零泄漏 |
| **S5C-IMAGE-NONE** | 13 | 三态按钮齐备、切到不使用、持久化 none、纸面 NO IMAGE、重开一致 |
| **S5B-IMAGE-CUSTOM** | 11 | 自定义优先、落库、内置未被覆盖、快照用自定义图、重开一致 |
| **S5A-IMAGE-AUTO** | 10 | 恢复默认、清空自定义、解析回内置、快照回 p4、重开一致 |

## 4. 五类 PDF

重新用生产 `createPdfExporter` 通道导出（`P1D05F01-pdf-runner.cjs`，路径全部由环境变量给出）：

| 类型 | 文件 | 页数 | A4 | 内嵌图 | 孤立页脚 | 金额 | 结论 |
|---|---|---|---|---|---|---|---|
| QT | `QT-QT-202611-0002.pdf` | 1 | ✔ | 3 | 无 | 正常 | PASS |
| PI | `PI-PI-202611-0002.pdf` | 1 | ✔ | 3 | 无 | 正常 | PASS |
| SC | `SC-SC-202611-0002.pdf` | 1 | ✔ | 3 | 无 | 正常 | PASS |
| CI | `CI-CI-202611-0002.pdf` | 1 | ✔ | 3 | 无 | 正常 | PASS |
| PL | `PL-PL-202611-0002.pdf` | 1 | ✔ | 3 | 无 | **0 命中** | PASS |

- 3 张内嵌图 = LOGO + 2 张实物图；第三行（未匹配产品）`NO IMAGE`；
- 8 行样本：QT / SC 各 2 页，**每页均有正文**，末页含双签名与页脚；
- SC 修正前样本（`pdf-before/SC-SC-202611-0001.pdf`）2 页且第 2 页仅页脚 → 对照成立。

## 5. 保护约束核对

| 约束 | 结果 |
|---|---|
| 不修改 `pricing.js` / 定价公式 | 与基线逐字节一致 `390ef0a6…` |
| 不升级 Schema V5 | 未升级；`realImageMode` 为可选字段 |
| 不修改历史报价快照 | `_unknown.productImage` / `realImage` 原样保留 |
| 不改变五类 PDF 骨架 / LOGO / 签名 / 金额汇总 | 仅 SC 去重与尾部留白 11px，骨架未变 |
| 不覆盖生产程序 / 生产 userData | 全程隔离，生产程序 11-22 零修改 |
| 不增加无关功能 | 仅 P1–P4 四项 |
