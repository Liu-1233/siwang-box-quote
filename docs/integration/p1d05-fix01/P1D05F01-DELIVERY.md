# P1-D-05 FIX-01 · 验收问题修正交付报告

**结论**：四项验收问题已定点修正，全部测试通过，生成候选版本
`siwang-box-p1d05-fix01-20261122.zip`。**交付后停止，等待 ChatGPT 独立验收；
未覆盖生产版本、未迁移生产数据、未更新正式快捷方式。**

| 项 | 值 |
|---|---|
| 起点 | `siwang-box-p1d05-20261122.zip`（SHA-256 `4d1ec0fb…1e09ce`，已校验） |
| 基线 | `siwang-box-p1d04-final-20261121.zip`（`f5dc9924…cad3d9`，与任务书一致） |
| 工程副本 | `siwang-box-p1d05-fix01-work/`（由交付 ZIP 全新解压，包内两级清单 446/446、77/77 校验通过） |
| 交付包 | `siwang-box-p1d05-fix01-20261122.zip` + 包外 `.sha256` |

---

## 1. P1 · SC 合同 PDF 空白第二页

**实测根因**（真实打印媒体下逐块测量，见 `P1D05F01-SC-PAGINATION.md`）：
SC 纸面高 1159.41px，A4 页高 1122.52px，溢出 36.89px（9.76mm）。两个叠加因素：

1. SC 把 `Sign Date` / `Sign Place` 同时印在标题行右上与 DOCUMENT INFO，重复 2 行＝**30px**；
2. SC 九列（多 HS CODE）使 SPEC 列变窄、长规格行更高，明细区比 QT 高 **63px**。

叠加后签名区越过页底；`.rc-sign` 是 flex 容器，Chromium 对 flex 的 `break-inside:avoid`
支持不完整，签名被拆开，**只有页脚落到第二页**。

**修正**（三层，不删页/不藏页脚/不裁正文）：

| 层 | 改动 | 效果 |
|---|---|---|
| 内容去重 | `sheet-rc.js` `titleBlock()` 去掉 SC 重复的签期/签地 | −30px，信息仍在 DOCUMENT INFO |
| 结构保护 | 新增 `.rc-tail`（签名+页脚）`break-inside:avoid` | 签名与页脚同页进出，结构上排除孤立页脚 |
| 尾部留白 | `.rc-sign` 27→24、`.rc-sign-space` 48→42、`.rc-foot` 12→10 | −11px，只动留白 |

**结果**：SC 1118.41px，单页，余量 4.11px；五类全部 1 页；8 行样本 2 页且每页有正文；
`P1D05F01-verify-pagination.py` 检出「孤立页脚页 = 0」。
修正前/后 PDF 与对照图：`pdf-before/`、`pdf/`、`compare/SC-BEFORE-AFTER.png`。

## 2. P2 · 实物图三态

新增可选字段 `realImageMode ∈ {auto,custom,none}`，统一由 `real-images.js` 的
`modeOf()` / `resolve()` 解析（全系统单一口径），**不升级 Schema V5**：

- `auto`：按已核实关联使用原版内置实拍；未匹配为空 → 纸面 `NO IMAGE`；
- `custom`：用户图优先于内置；保存/重开/转换后一致；
- `none`：明确不使用，**永不自动带入**；纸面固定 `NO IMAGE`。

界面三个并列入口：**上传自定义实物图 / 恢复默认实物图 / 不使用实物图**，
并实时显示当前状态。规格图 `imageData` 与实物图 `realImageData` 始终分离，
纸面 PHOTO 只读 `_unknown.realImage`，历史快照未动。

兼容性：阶段二「有自定义图、无状态字段」的旧数据按 `custom` 解析，不会被静默改成自动匹配；
导入旧产品包（无该字段）视为 `auto`。

验证：三态专项 **20/20**；E2E 新增 **34 项**（13+11+10）全通过；三态截图见
`compare/IMAGE-MODES-3STATES.png`、`screenshots/S5{C,B,A}-*.png`。

## 3. P3 · 完整代码差异审计

`P1D05F01-make-diff.py` 对**真实 P1-D-04 基线 ZIP**（先校验 SHA-256 与任务书一致）
逐文件比较，文本给完整 unified diff（**无截断**），二进制只比 SHA-256：

| 统计 | 值 |
|---|---|
| 基线文件 / 当前文件 | 366 / 513 |
| 新增 | 147 |
| 修改 | **9** |
| 删除 | 0 |
| 未修改 | 357 |
| 受保护文件 | **全部一致**（pricing.js / sheet.js / reference-sheets.js / storage.js / preload.js / pdf-export.cjs / tests 四套） |

修改的 9 个文件：
`app/app.css`、`app/index.html`、`app/model.js`、`app/pages.js`、`app/product-import.js`、
`app/sheet-rc.js`、`app/store.js`、`main.js`（仅测试钩子新增 CDP 截图分支）、`tests/p1d3/run.js`。

产物：`CHANGE-VS-P1D04-FULL.txt`、`P1D05F01-file-manifest.json`、`P1D05F01-changes.list`。

## 4. P4 · E2E 路径可移植化

去掉 `E:/`、用户名等固定路径：`ROOT` 由文件位置上溯或 `SBW_ROOT`；
`ELECTRON` 多级自动查找或 `SBW_ELECTRON`（找不到明确报错）；
`ACC` 默认系统临时目录或 `SBW_E2E_DIR`；隔离数据由 `SBW_E2E_SEED` 首次复制。
测试钩子新增 `SBW_SHOT_CDP=1` 强制取当前帧（仅测试模式）。

验证：原路径 108/108；**换路径副本（整目录复制）复跑 108/108**。
说明见 `P1D05F01-E2E-PORTABILITY.md`。

---

## 5. 测试结果汇总

| 测试 | 结果 |
|---|---|
| Schema / P1-C / P1-D / P1-D-03 / Pricing | 194 + 229 + 51 + 117 + 851 = **1442 / 1442** |
| 图片链路探针（22） | **22 / 22** |
| 实物图三态（20） | **20 / 20** |
| Electron E2E（含三态 3 场景） | **108 / 108**（原 74 全保留） |
| E2E 换路径复跑 | **108 / 108** |
| 五类 PDF（含 SC 空白页专项） | **5 / 5**，孤立页脚 0 |
| 8 行自然分页 | QT / SC 各 2 页，每页有正文 |

## 6. 交付物对照（任务书 §五）

| # | 要求 | 位置 |
|---|---|---|
| 1 | ZIP | `siwang-box-p1d05-fix01-20261122.zip` |
| 2 | ZIP 外部 SHA-256 | 同名 `.sha256`（包外） |
| 3 | 包根 SHA256SUMS.txt | 包根 |
| 4 | P1-D-05 目录 SHA256SUMS.txt | `docs/integration/p1d05-fix01/SHA256SUMS.txt` |
| 5 | 完整代码差异报告 | `CHANGE-VS-P1D04-FULL.txt`、`P1D05F01-file-manifest.json` |
| 6 | SC 分页修正前后 PDF | `pdf-before/SC-…-0001.pdf`、`pdf/SC-…-0002.pdf`、`compare/SC-BEFORE-AFTER.png` |
| 7 | 五类正式 PDF | `pdf/` + `pdf-render/` + `compare/PDF-RENDER-5.png` |
| 8 | 实物图三态操作截图 | `screenshots/S5C|S5B|S5A-*.png`、`compare/IMAGE-MODES-3STATES.png` |
| 9 | E2E 原始日志 | `P1D05F01-e2e-full.log`、`P1D05F01-e2e-fresh-copy.log`、两份 result.json |
| 10 | 全量回归日志 | `P1D05F01-regression-*.log`（5 份）+ 专项日志 |
| 11 | 最终验收报告 | 本文件 + `P1D05F01-test-report.md` |
| 12 | 修改文件清单 | `P1D05F01-changes.list` |

## 7. 如实说明

1. **Parity 8** 未在本轮复跑（润成 V3 源码与 tsx 运行时不在本工作区）；`app/pricing.js`
   与基线逐字节一致，定价路径未变，结论沿用冻结日志 `docs/integration/p1d05/evidence/P1D05-parity-frozen.log`。
2. **8 行分页测试**用内存构造的 8 行样本（不写存储），QT/SC 各导出一份 2 页 PDF。
3. **`main.js` 有改动**，但仅限测试钩子：新增 `SBW_SHOT_CDP=1` 时的截图分支，
   正常运行路径（不设该变量）行为与基线一致。
4. **SC 尾部留白减少 11px**（签名上边距/签名留白/页脚上边距），五类同步生效，
   属收紧留白，未改字号、列宽、边框、行高。

## 8. 复现

```bash
cd siwang-box-p1d05-fix01-work
sha256sum -c SHA256SUMS.txt
node tests/schema/run.js && node tests/p1c/run.js && node tests/p1d/run.js \
  && node tests/p1d3/run.js && node tests/pricing/run-all.js
node docs/integration/p1d05/P1D05-image-probe.cjs
node docs/integration/p1d05-fix01/P1D05F01-image-modes.test.cjs
python docs/integration/p1d05-fix01/P1D05F01-verify-pagination.py \
  --pdf-dir docs/integration/p1d05-fix01/pdf \
  --multipage-dir docs/integration/p1d05-fix01/multipage \
  --before-dir docs/integration/p1d05-fix01/pdf-before
python docs/integration/p1d05-fix01/P1D05F01-make-diff.py
```

**状态：已停止，等待独立验收。**
