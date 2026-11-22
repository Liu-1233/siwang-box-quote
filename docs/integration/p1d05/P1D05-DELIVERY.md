# P1-D-05 阶段二 · 交付报告 / Delivery Report

**结论**：录入界面还原与产品实物图修正两项改造已完成；全部测试通过；
**交付后立即停止，等待 ChatGPT 独立验收，未自行覆盖生产版本。**

| 项 | 值 |
|---|---|
| 阶段 | P1-D-05 阶段二（正式实施） |
| 隔离开发副本 | `siwang-box-p1d05-work/`（从 `siwang-box-p1d04-final-20261121.zip` 全新解压） |
| 基线 SHA-256 | `f5dc992456cdac0514c08613735fbc2dc8776c747e745997899ce4a604cad3d9` |
| 交付 ZIP | `siwang-box-p1d05-20261122.zip` |
| 交付 ZIP SHA-256 | 包外侧车 `siwang-box-p1d05-20261122.zip.sha256`（ZIP 内不含自身哈希，避免自指） |
| 生产程序 / 生产 userData | **全程未触碰、未覆盖** |

---

## 1. 本阶段完成的两项改造

### ① 还原原版 RunCheng V2 录入界面

按原版真实界面（非参考截图）重排左栏，不新增业务输入项：

```
顶部报价操作栏（保存 / 导出 PDF / 打印 / 转换）
  → rc_params_card   报价计算参数（FX / 目标毛利率 / 销售费率 / 提成 / 亏损规则 / 加成率 / IncoTerm / Named Place）
  → rc_risk_bar      风险提示
  → rc_items_card    产品明细卡片（内部成本 <details> 默认收起，点开编辑）
  → rc-cols          左：订单汇总 / 折扣 / 其他费用 / 一次性费用；右：运费面板
  → rc-internal      内部核价折叠区
  → rc_order_card    页面底部：客户信息及订单条款
右侧 A4 实时预览 qe_preview 保留
```

字段与操作入口逐项对应见 `P1D05-UI-FIELD-MAP.md`；并排截图见 `compare/UI-COMPARE-*.png`。

### ② 修复产品图片来源与显示方式

- 新增独立可选实物图字段 `realImageData` / `_unknown.realImage`，**不覆盖** `imageData` / `_unknown.productImage`；
- 内嵌原版 RunCheng 三张真实场景实拍 p1 / p2 / p4（`app/real-images.js`），p7 结构图明确排除；
- 客户纸面 PHOTO **只读实物图**，无实物图按原版口径 `NO IMAGE`，**绝不回退规格图**；
- `object-fit: cover` → `contain`，等比完整显示、不裁切、不拉伸；
- 三张图与原版 DB 关联、与当前产品匹配见 `P1D05-REAL-IMAGE-MATCH.md`；
- 完整字段链路与规则见 `P1D05-IMAGE-FIELD-MAPPING.md`。

---

## 2. 验收要求逐项对照

| # | 验收要求 | 交付物 |
|---|---|---|
| 1 | 新旧录入界面并排截图 | `compare/UI-COMPARE-original-vs-new.png`、`compare/UI-COMPARE-old-vs-new.png`、`screenshots/S1-UI-LAYOUT.png` |
| 2 | 三张实物图与产品匹配表 | `P1D05-REAL-IMAGE-MATCH.md`、`evidence/P1D05-original-db-images.json`、`compare/IMG-REAL-3.png` |
| 3 | 产品图片修改前后对照 | `compare/IMG-COMPARE-before-after.png`、`compare/REAL-p1/p2/p4.png` |
| 4 | A4 预览和 PDF 实际效果 | `compare/PREVIEW-VS-PDF-QT.png`、`pdf/` 五份正式 PDF、`pdf-render/` 五张渲染图、`P1D05-pdf-verify.log` |
| 5 | 新建、编辑、保存、重开测试 | `P1D05-test-report.md` §1、`P1D05-e2e-result.json`（74/74）、`screenshots/S2/S3/S4-*.png` |
| 6 | 原有全量回归测试 | `P1D05-regression-full.log`（1442/1442）、五份原始日志、`P1D05-image-probe.log`（22/22）、`evidence/P1D05-parity-frozen.log` |
| 7 | 完整工程 ZIP 和 SHA-256 | `siwang-box-p1d05-20261122.zip` + `.sha256` + 包根 `SHA256SUMS.txt` + `docs/integration/p1d05/SHA256SUMS.txt` |

另按「交付要求」提供：
- 修改文件清单：`P1D05-file-manifest.json`
- 修改前后差异报告：`CHANGE-VS-P1D04.txt`（含逐文件 unified diff）
- 图片字段映射说明：`P1D05-IMAGE-FIELD-MAPPING.md`
- 实际操作测试报告：`P1D05-test-report.md`
- 全量回归结果：`P1D05-regression-full.log`

---

## 3. 与基线的差异摘要

| 类别 | 数量 | 说明 |
|---|---|---|
| 修改的业务文件 | 7 | `app/app.css`、`app/index.html`、`app/model.js`、`app/pages.js`、`app/product-import.js`、`app/sheet-rc.js`、`app/store.js` |
| 修改的测试文件 | 1 | `tests/p1d3/run.js`（新增 3 条专项断言，原有 114 项保留） |
| 新增业务文件 | 1 | `app/real-images.js`（三张原版实物图只读资源，约 1.0 MB） |
| 新增交付证据 | 75 | `docs/integration/p1d05/` 下文档、脚本、日志、截图、PDF、渲染图；`stage1/` 阶段一调查证据；包根 `DELIVERY-P1D05.md` |
| 删除文件 | 0 | — |
| 未改文件 | 358 | 含全部受保护文件 |

关键保护文件与基线**逐字节一致**：`app/pricing.js`、`app/sheet.js`、
`app/reference-sheets.js`、`main.js`、`preload.js`、`storage.js`、`pdf-export.cjs`、
`tests/schema|p1c|p1d|pricing`。逐项 SHA-256 见 `CHANGE-VS-P1D04.txt` §D。

---

## 4. 测试结果摘要

| 测试 | 结果 |
|---|---|
| Node 全量回归（1439 冻结基线 + 3 条新增断言） | **1442 / 1442 PASS** |
| P1-D-05 图片链路探针 | **22 / 22 PASS** |
| Electron 实际操作 E2E（7 场景） | **74 / 74 PASS** |
| 五类正式 PDF 校验 | **5 / 5 PASS** |
| P1-A Parity 8 | 8 / 8 一致（冻结日志；`pricing.js` 逐字节未变，未在本工作区复跑，见下文） |

详见 `P1D05-test-report.md`。

---

## 5. 如实记录的观察项（未隐瞒、未跳过断言）

1. **SC 自然分页 2 页**：第 1 页尾段完整（商业条款 / 金额汇总 / 大写 / 双方签名），
   第 2 页仅页脚。原因是 E2E 实操数据含 3 行超长规格 + SC 多一列 HS CODE，
   内容自然超出一页；任务书允许自然分页，本轮未改任何分页 CSS。
   P1-D-04 基准 5 份 PDF（同版式骨架、短规格数据）各 1 页，可对照证明分页骨架未变。
2. **Parity 8 未在本轮复跑**：复跑所需润成 V3 源码目录（含 `src/pricing.ts`）与 tsx 运行时
   不在当前工作区。不伪造结果；依据 `app/pricing.js` 与基线逐字节一致，
   定价计算路径未变，故冻结结论保持不变。冻结日志副本随包交付。
3. **实物图覆盖面**：用户授权复用原版三张实拍，经关联核实仅两类产品族可确认匹配；
   其余产品按口径显示 `NO IMAGE`，未用规格图冒充。用户可在产品库自行上传实物图。

---

## 6. 保护约束核对

| 约束 | 状态 |
|---|---|
| 先建立全新隔离开发副本 | ✅ `siwang-box-p1d05-work/` |
| 不触碰生产 userData / 不覆盖生产程序 | ✅ |
| 不修改 `pricing.js` / 定价公式 | ✅ 逐字节一致 |
| 不升级 Schema V5 | ✅ |
| 不修改历史报价图片快照 | ✅ |
| 不改变已验收五类 PDF 骨架 / LOGO / 分页 / 签名 / 金额汇总 | ✅ |
| 不删除现有产品图片 | ✅ |
| 本阶段只完成两项改造、不增加新功能 | ✅ |
| 完成后停止、等待独立验收、不自行覆盖正式版本 | ✅ |

---

## 7. 目录导览

```
docs/integration/p1d05/
├── P1D05-DELIVERY.md              ← 本文件
├── P1D05-test-report.md           实际操作 + 回归 + PDF 测试报告
├── P1D05-UI-FIELD-MAP.md          字段与操作入口对应说明
├── P1D05-REAL-IMAGE-MATCH.md      三张实物图与产品匹配表
├── P1D05-IMAGE-FIELD-MAPPING.md   图片字段链路与规则
├── CHANGE-VS-P1D04.txt            逐文件差异报告（含 unified diff）
├── P1D05-file-manifest.json       全量文件清单 + 哈希
├── P1D05-regression-full.log      回归汇总 + 5 份原始日志
├── P1D05-image-probe.cjs/.log     22 项图片链路探针
├── P1D05-e2e-*.js                 E2E 驱动 / 场景 / runner
├── P1D05-e2e-result.json          E2E 74/74 明细
├── P1D05-e2e-full.log
├── P1D05-pdf-runner.cjs           五类 PDF 生产导出通道
├── P1D05-verify-pdf.py            PDF 只读校验 + 渲染
├── P1D05-pdf-verify.json/.log
├── P1D05-make-evidence.py         对照图生成
├── P1D05-make-diff.py             差异清单生成
├── P1D05-make-sums.py             两级 SHA-256 清单生成
├── SHA256SUMS.txt                 本目录清单
├── compare/                       5 张对照图 + 3 张实物图原图
├── compare-src/                   裁剪素材 / 基准 PDF 渲染
├── evidence/                      原版 DB 关联 JSON / 冻结 parity 日志
├── stage1/                        阶段一只读调查（3 份 MD + 6 张截图 + 证据清单）
├── pdf/                           QT/PI/SC/CI/PL 五份正式 PDF
├── pdf-render/                    五张 A4 页面渲染图
└── screenshots/                   7 个 E2E 场景实拍 + stdout
```

> 清单/报告自身（`CHANGE-VS-P1D04.txt`、`P1D05-file-manifest.json`、
> `SHA256SUMS.txt`、生成脚本）不计入差异统计，避免自指；文件仍随包交付。

---

## 8. 复现与验收建议

```bash
# 解包后（隔离目录，不覆盖生产）
cd siwang-box-p1d05-20261122
sha256sum -c SHA256SUMS.txt
node tests/schema/run.js && node tests/p1c/run.js && node tests/p1d/run.js \
  && node tests/p1d3/run.js && node tests/pricing/run-all.js
node docs/integration/p1d05/P1D05-image-probe.cjs
python docs/integration/p1d05/P1D05-verify-pdf.py
python docs/integration/p1d05/P1D05-make-diff.py
```

**交付后已停止，等待 ChatGPT 独立验收；未覆盖生产版本、未迁移生产数据。**
