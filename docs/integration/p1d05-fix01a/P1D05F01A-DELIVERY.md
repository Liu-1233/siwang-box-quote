# P1-D-05 FIX-01A · 最终收尾交付报告

**结论**：三项收尾问题已修复并验证，生成候选版本
`siwang-box-p1d05-fix01a-20261122.zip`。**交付后停止，等待 ChatGPT 独立验收；
未覆盖生产、未迁移数据、未发布。**

| 项 | 值 |
|---|---|
| 起点包 | `siwang-box-p1d05-fix01-20261122.zip`（`fb7363f6…b61080`，已校验） |
| 基线 | `siwang-box-p1d04-final-20261121.zip`（`f5dc9924…cad3d9`） |
| 工程副本 | `siwang-box-p1d05-fix01a-work/`（由起点包全新解压，包内清单 517/517、69/69 通过） |
| 本轮改动 | **修改 6 个文件 / 新增 40 个文件 / 删除 0**（相对 FIX-01 包） |

## 1. P1 · SHA256SUMS 生成顺序

**缺陷**：FIX-01 包内 `docs/integration/p1d05/SHA256SUMS.txt` 已失效
（74 OK / **3 FAILED**，失效项为 FIX-01 改过的 E2E driver/runner/scenarios）。
原因：只重算了新建目录与包根，未重算被改动目录，且未强制「根包含子」。

**修复**：`P1D05F01A-make-sums.py` 按「叶子 → 上层 → 包根」顺序生成，
生成后逐条复算并断言根清单包含每个子清单且哈希一致，失败即退出码 1。

**结果**：p1d05 清单 **77/77 OK**；fix01 69/69；fix01a 新建并通过；
包根包含三个子清单。详见 `P1D05F01A-SUMS-FIX.md`。

## 2. P2 · 真实上传链路测试

补 `S6-UPLOAD-REAL`（19 项）：走 **preload → IPC → 主进程选择器 → 校验/缩放/JPEG** 全链路，
而不是直接给草稿赋值。关键证据：

- 源文件是 PNG，链路返回 `data:image/jpeg;base64,…` → 证明真的经过 nativeImage + toJPEG；
- 产品保存、重开、单据快照、A4 预览全部使用同一张上传图；
- 导出 PDF 内嵌 **640×480** 图像（内置图为 638×401 / 900×900 / 672×671），证明进入纸面。

测试钩子仅在 `OFFSCREEN + SBW_PICK_FILE` 时替换系统文件对话框，其余为生产代码。
详见 `P1D05F01A-UPLOAD-CHAIN.md`。

## 3. P3 · custom 缺图一致性

**缺陷**：`custom` 但图缺失时，提示说「自定义」、预览说「无图」、纸面却显示内置图。

**修复**：`resolve()` 输出 `requested / mode / data / degraded` 四元组，
界面提示、预览、保存归一化、纸面快照全部读同一结果：
提示明确写「缺失，已回退自动匹配」，预览显示回退图，保存把状态归一为 `auto`。

**结果**：Node 专项 11/11；E2E `S5D-IMAGE-DEGRADED` 13/13。详见 `P1D05F01A-DEGRADED.md`。

## 4. 测试结果

| 测试 | 结果 |
|---|---|
| Schema / P1-C / P1-D / P1-D-03 / Pricing | 194+229+51+117+851 = **1442 / 1442** |
| 图片链路探针 | **22 / 22** |
| 实物图三态 | **20 / 20** |
| 降级一致性（新增） | **11 / 11** |
| Electron E2E | **140 / 140**（原 108 全保留，新增 32） |
| 五类 PDF / 8 行分页 | 5/5、0 问题 |
| 上传单据 PDF | 640×480 上传图已进入纸面 |
| 清单完整性 | 子清单与包根全部 OK，根含全部子清单 |

## 5. 改动清单（相对 FIX-01）

**修改 6 个：**

| 文件 | 说明 |
|---|---|
| `app/real-images.js` | `resolve()` 增加 `requested/degraded`，缺图统一回退 |
| `app/pages.js` | 降级提示文案、预览回退、保存归一化 |
| `main.js` | 新增 `SBW_PICK_FILE` 测试钩子（仅 OFFSCREEN 生效） |
| `docs/integration/p1d05/P1D05-e2e-driver.js` | 支持 `pickFile` |
| `docs/integration/p1d05/P1D05-e2e-runner.js` | 透传 `pickFile` |
| `docs/integration/p1d05/P1D05-e2e-scenarios.js` | 新增 S5D / S6 场景 |

**新增 40 个**：`docs/integration/p1d05-fix01a/` 下文档、脚本、日志、截图、PDF，以及清单。

相对 P1-D-04 基线：改 9 / 增 187 / 删 0，受保护文件（pricing.js、sheet.js、
reference-sheets.js、storage.js、preload.js、pdf-export.cjs、四套 tests）**全部一致**。

差异报告：`CHANGE-VS-FIX01.txt`（本轮增量）、`CHANGE-VS-P1D04-FULL.txt`（对基线全量）。

## 6. 交付物

| 项 | 位置 |
|---|---|
| ZIP | `siwang-box-p1d05-fix01a-20261122.zip` |
| ZIP 外部 SHA-256 | 同名 `.sha256` |
| 包根清单 | `SHA256SUMS.txt` |
| 目录清单 | `docs/integration/p1d05/SHA256SUMS.txt`、`.../p1d05-fix01/SHA256SUMS.txt`、`.../p1d05-fix01a/SHA256SUMS.txt` |
| 差异报告 | `docs/integration/p1d05-fix01a/CHANGE-VS-FIX01.txt`、`CHANGE-VS-P1D04-FULL.txt` |
| 修改清单 | `P1D05F01A-changes.list` |
| 五类 PDF / 上传 PDF | `docs/integration/p1d05-fix01a/pdf/`、`pdf-upload/`、`pdf-render/` |
| 截图 | `docs/integration/p1d05-fix01a/screenshots/` |
| 测试日志 | `docs/integration/p1d05-fix01a/P1D05F01A-*.log`、`P1D05F01A-e2e-result.json` |

## 7. 如实说明

1. 本轮**未改动** `pricing.js`、Schema V5、数据库结构、`sheet-rc.js`、
   已验收的录入界面布局与五类 PDF 版式、SC 分页 `.rc-tail` 逻辑。
2. `main.js` 的改动仅为测试钩子（`SBW_PICK_FILE`），生产运行路径不变。
3. 上传测试通过环境变量替换系统文件对话框，其余环节均为生产代码；
   上传图在 PDF 中为 640×480，与测试素材一致。
4. 历史目录清单（p1d04 / acceptance / fix-BUG-ACC-01 / p1d05/stage1/evidence）
   路径基准不同且内容未被本轮改动，保持原样未重写。

**状态：已停止，等待独立验收。**
