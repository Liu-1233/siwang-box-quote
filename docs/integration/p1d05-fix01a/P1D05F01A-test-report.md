# P1-D-05 FIX-01A · 测试报告

所有测试在隔离副本 + 隔离 userData 内完成；未触碰生产程序、生产 userData、生产数据库。

| 项 | 值 |
|---|---|
| 工程副本 | `siwang-box-p1d05-fix01a-work`（由 `siwang-box-p1d05-fix01-20261122.zip` 全新解压） |
| 起点包 SHA-256 | `fb7363f665e816726d541aa8df2021681ac2b6414650943f92fbd60b32b61080`（已校验） |
| 基线 | `siwang-box-p1d04-final-20261121.zip`（`f5dc9924…cad3d9`） |
| 隔离 userData | `E:/CDriveMigration/Temp/p1d05fix01a/e2e/ud`（由 `SBW_E2E_SEED` 复制） |

## 1. 全量回归（保留全部原有测试）

| 套件 | 断言 | FAIL | 日志 |
|---|---|---|---|
| `tests/schema` | 194 | 0 | `P1D05F01A-regression-schema.log` |
| `tests/p1c` | 229 | 0 | `P1D05F01A-regression-p1c.log` |
| `tests/p1d` | 51 | 0 | `P1D05F01A-regression-p1d.log` |
| `tests/p1d3` | 117 | 0 | `P1D05F01A-regression-p1d3.log` |
| `tests/pricing` | 851 | 0 | `P1D05F01A-regression-pricing.log` |
| **合计** | **1442** | **0** | 与 FIX-01 同口径 |

## 2. 专项测试

| 测试 | 结果 | 日志 |
|---|---|---|
| 图片链路探针（22） | **22 / 22** | `P1D05F01A-image-probe.log` |
| 实物图三态（20） | **20 / 20** | `P1D05F01A-image-modes.log` |
| **降级一致性（新增 11）** | **11 / 11** | `P1D05F01A-degraded.log` |
| 分页专项（含孤立页脚检测） | **0 问题** | `P1D05F01A-pagination.log/.json` |

## 3. Electron E2E：140 / 140

| 场景 | 断言 | 变化 |
|---|---|---|
| S1-UI-LAYOUT | 17 | 原样 |
| S2-NEW-SAVE | 16 | 原样 |
| S3-REOPEN | 11 | 原样 |
| S4-PI / SC / CI / PL | 7 / 7 / 7 / 9 | 原样 |
| S5C-IMAGE-NONE | 13 | 原样 |
| S5B-IMAGE-CUSTOM | 11 | 原样 |
| S5A-IMAGE-AUTO | 10 | 原样 |
| **S5D-IMAGE-DEGRADED** | **13** | 新增（custom 缺图一致性） |
| **S6-UPLOAD-REAL** | **19** | 新增（真实上传链路） |

日志：`P1D05F01A-e2e-full.log`、`P1D05F01A-e2e-result.json`；
截图：`screenshots/S5D-IMAGE-DEGRADED.png`、`screenshots/S6-UPLOAD-REAL.png`。

## 4. 五类 PDF 与上传链路 PDF

| 项 | 结果 |
|---|---|
| 五类正式 PDF（QT/PI/SC/CI/PL） | 各 1 页、A4、无孤立页脚、双签名齐全 → **5/5 PASS** |
| 8 行自然分页（QT / SC） | 各 2 页，每页有正文，末页含签名与页脚 |
| SC 修正前后对照 | 修正前 2 页（第 2 页仅页脚）→ 修正后 1 页 |
| **上传单据 PDF** | 1 页；内嵌图像 **638×401（LOGO）+ 640×480（上传测试图）** |

上传 PDF：`pdf-upload/QT-upload.pdf`，渲染图 `pdf-render/UPLOAD-QT-p1.png`。
内置图尺寸为 638×401 / 900×900 / 672×671，**640×480 仅可能来自本次上传**。

## 5. 清单完整性（本轮修复项）

| 清单 | 修复前 | 修复后 |
|---|---|---|
| `docs/integration/p1d05/SHA256SUMS.txt` | 74 OK / **3 FAILED** | **77 / 77 OK** |
| `docs/integration/p1d05-fix01/SHA256SUMS.txt` | 69 / 69 OK | 69 / 69 OK |
| `docs/integration/p1d05-fix01a/SHA256SUMS.txt` | — | 新建并自校验通过 |
| 包根 `SHA256SUMS.txt` | 517 / 517 OK | 全部 OK，且**包含上述三个子清单** |

## 6. 保护约束核对

| 约束 | 结果 |
|---|---|
| 定价公式 / `app/pricing.js` | 未改，与基线逐字节一致 `390ef0a6…` |
| Schema V5 / 数据库结构 | 未升级、未改结构 |
| RunCheng 录入界面 | 未改布局与字段顺序（仅实物图区文案与状态归一） |
| 五类 PDF 版式 | 未改（本轮未动 `sheet-rc.js` / 版式 CSS） |
| SC 分页修复（`.rc-tail`） | 未改，分页专项仍 0 问题 |
| 生产程序 / 生产数据 | 全程未触碰 |
| 新增功能 | 无，仅三项修复 |
