# P1-D-05 阶段二 · 实际操作测试与全量回归报告 / Test Report

**状态**：全部通过；所有测试均在**隔离开发副本 + 隔离 userData** 中完成，
未触碰生产程序、生产 userData、生产数据库。

| 环境 | 值 |
|---|---|
| 工程根 | `E:/WorkBuddyProjects/ChatGPT/丝网盒子 2/siwang-box-p1d05-work` |
| 基线 | `siwang-box-p1d04-final-20261121.zip`（SHA-256 `f5dc992456cdac0514c08613735fbc2dc8776c747e745997899ce4a604cad3d9`） |
| 隔离 userData | `E:/CDriveMigration/Temp/p1d05/work/ud` |
| Electron 运行时 | `siwang-box-main/node_modules/electron/dist/electron.exe` |
| 日期 | 2026-11-22 |

---

## 1. 实际操作测试（Electron E2E）：74 / 74 PASS

驱动：`P1D05-e2e-driver.js` + `P1D05-e2e-runner.js` + `P1D05-e2e-scenarios.js`
结果：`P1D05-e2e-result.json`、`P1D05-e2e-full.log`
截图：`screenshots/S1…S4-*.png`（每场景 1600×1000 实拍）

| 场景 | 断言 | 覆盖验收项 |
|---|---|---|
| `S1-UI-LAYOUT` | 17 / 17 | 左栏六区顺序、顶部参数条、风险提示、两列、内部核价折叠、底部订单信息、右侧 A4 预览、保存/导出/转换按钮、三张原版实物图资源与匹配规则 |
| `S2-NEW-SAVE` | 16 / 16 | 新建 QT、产品库选择 3 个产品、p4/p1 实物图自动带入、未匹配产品无实物图、规格图快照未覆盖、数量/单位/单价/成本编辑、订单费用与分摊、保存成功 |
| `S3-REOPEN` | 11 / 11 | 新进程重开保存的 QT：单号、行数、实物图/规格图快照、数量/单位/价格、费用分摊、客户与条款、A4 预览含实物图且不含规格图 base64 |
| `S4-PI` | 7 / 7 | QT→PI 转换、实物图继承、统一 RC 版式、纸面实物图、转换后保存 |
| `S4-SC` | 7 / 7 | QT→SC 同上 |
| `S4-CI` | 7 / 7 | QT→CI 同上 |
| `S4-PL` | 9 / 9 | QT→PL 同上，并验证**不显示单价/金额/大写、不含内部成本与核价字段** |
| **合计** | **74 / 74** | FAIL 0、CRASH 0、EVAL_ERR 0 |

> 转换场景按单据类型拆成独立 Electron 进程，避免单进程内多次重建含大图 DOM
> 触发 Chromium `CAPTURE_FAIL=UnknownVizError`（实现决策，不改变业务逻辑）。

### 任务书 C 项逐条映射

| 验收项 | 结果 | 证据 |
|---|---|---|
| 新建 QT | PASS | S2 |
| 产品库选择 | PASS | S2（3 个产品） |
| 自动带入产品实物图 | PASS | S2（P01→p4、P02→p1）、S3 预览 |
| 编辑数量 / 单位 / 价格 | PASS | S2（qty 120/60/30、unit set、price 18.5/22） |
| 成本核算和费用分摊 | PASS | S2（模具费 600 按 342.86/171.43/85.71 分摊） |
| 保存后重新打开数据和图片一致 | PASS | S3 |
| PDF 导出 | PASS | 五类 PDF + `P1D05-pdf-verify.log` |
| QT 转 PI/SC/CI/PL | PASS | S4-PI/SC/CI/PL |
| PL 不泄漏内部成本和核价信息 | PASS | S4-PL + PDF 校验 `PL` 金额命中 0 |

---

## 2. 全量回归：1442 / 1442 PASS（冻结 1439 项全部保留）

| 套件 | 断言 | FAIL | 原始日志 |
|---|---|---|---|
| `tests/schema` | 194 | 0 | `P1D05-regression-schema.log` |
| `tests/p1c` | 229 | 0 | `P1D05-regression-p1c.log` |
| `tests/p1d` | 51 | 0 | `P1D05-regression-p1d.log` |
| `tests/p1d3` | 117 | 0 | `P1D05-regression-p1d3.log` |
| `tests/pricing` | 851 | 0 | `P1D05-regression-pricing.log` |
| **合计** | **1442** | **0** | `P1D05-regression-full.log` |

口径：冻结基线 1439 = 194+229+51+114+851；本轮 `p1d3` 为 117 =
原 114 项 + P1-D-05 新增 3 条「规格图绝不回退为纸面 PHOTO」专项断言（B5a/B5b/B5c）。
**没有删除或降低任何原有测试标准。**

附加：
- `P1D05-image-probe.cjs` 图片链路探针 **22 / 22 PASS**（`P1D05-image-probe.log`）；
- **Parity 8**：沿用 P1-A 冻结日志 `evidence/P1D05-parity-frozen.log`（8 场景字段全一致）。
  本轮未复跑，因为复跑所需的润成 V3 源码目录（含 `src/pricing.ts`）与 tsx 运行时
  **不在本工作区**；不伪造结果。依据：`app/pricing.js` 与 P1-D-04 基线
  **逐字节一致**（`390ef0a65789d680da992758b9ce6077682957a291ae50832a18a6cb10732a00`），
  定价计算路径未发生任何变更，故 Parity 8 结论保持不变。

---

## 3. 五类正式 PDF：5 / 5 PASS

导出通道：`P1D05-pdf-runner.cjs` 调用生产 `createPdfExporter`
（`readSavedDocument → validateForExport → buildHtml → 沙箱隐藏窗口 → printToPDF`）。
校验：`P1D05-verify-pdf.py`（`pypdfium2` 字符框 / 页面渲染 + `pypdf` XObject 检查）。

| 类型 | 文件 | 页数 | A4 | 内嵌图像 | NO IMAGE | 金额命中 | 内部字段 | 结论 |
|---|---|---|---|---|---|---|---|---|
| QT | `QT-QT-202611-0001.pdf` | 1 | ✔ | 3 | ✔ | 正常 | 0 | PASS |
| PI | `PI-PI-202611-0001.pdf` | 1 | ✔ | 3 | ✔ | 正常 | 0 | PASS |
| SC | `SC-SC-202611-0001.pdf` | 2 | ✔ | 3 | ✔ | 正常 | 0 | PASS（自然分页） |
| CI | `CI-CI-202611-0001.pdf` | 1 | ✔ | 3 | ✔ | 正常 | 0 | PASS |
| PL | `PL-PL-202611-0001.pdf` | 1 | ✔ | 3 | ✔ | **0** | 0 | PASS |

- 3 张内嵌图像 = LOGO + 两张实物图（p4、p1）；第三行无实物图显示 `NO IMAGE`；
- PL 纸面 `UNIT PRICE / TOTAL AMOUNT / Amount in Words / USD / $` 命中均为 0；
- 所有纸面内部核价字段命中 0；
- 页面渲染图见 `pdf-render/*-page1.png`；A4 预览对照见 `compare/PREVIEW-VS-PDF-QT.png`。

### 观察项：SC 自然分页 2 页

第 1 页含完整商业条款、金额汇总、大写、双方签名；第 2 页仅页脚
（`SC-202611-0001 · Sales Contract`）。原因：本轮 E2E 实操数据为 3 行产品且规格文本很长，
SC 表格额外多 `HS CODE` 列，内容自然超出一页。任务书明确允许「若真实内容超过一页，允许自然分页」；
本轮**未改任何分页 CSS**（`app/app.css` 只改了 `.rc-photo` 的 `object-fit`，不改盒模型）。
P1-D-04 基准 5 份 PDF（`docs/integration/p1d04/pdf-samples/`，短规格测试数据）各 1 页，
可对照证明分页骨架未变。此项如实记录，不跳过、不掩盖。

---

## 4. 保护约束核对

| 约束 | 核对结果 |
|---|---|
| 不修改 `pricing.js` / 定价公式 | 与基线 SHA-256 逐字节一致 |
| 不升级 Schema V5 / 不迁移数据 | 未升级；新增字段为可选，沿用同类校验 |
| 不修改历史报价图片快照 | `_unknown.productImage` 原样保留 |
| 不删除现有产品图片 | `imageData` 保留 |
| 不改五类 PDF 骨架 / LOGO / 分页 / 签名 / 金额汇总 | 仅 PHOTO 取值与 `object-fit` 变化 |
| 不覆盖生产程序 / 不触碰生产 userData | 全程隔离副本，未覆盖 |
| 不增加新功能、不扩大范围 | 仅两项改造 + 交付证据 |

---

## 5. 复现命令

```bash
cd siwang-box-p1d05-work
node tests/schema/run.js && node tests/p1c/run.js && node tests/p1d/run.js \
  && node tests/p1d3/run.js && node tests/pricing/run-all.js
node docs/integration/p1d05/P1D05-image-probe.cjs
node docs/integration/p1d05/P1D05-e2e-runner.js          # 需隔离 userData
python docs/integration/p1d05/P1D05-verify-pdf.py
python docs/integration/p1d05/P1D05-make-diff.py
```
