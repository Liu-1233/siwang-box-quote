# P1-D-02 补充验收报告（P1-D-02b）

日期：2026-11-20　　基线：`siwang-box-integration-P1D02-20261120.zip`（SHA-256 `0b518a37…fde33`，167 条目）
性质：**仅补充验收测试**——按 ChatGPT 独立验收反馈执行 5 项补充工作，**零产品代码改动**。

## 一、本轮改动范围（冻结核查见 §六）

| 文件 | 改动 | 说明 |
|---|---|---|
| `tests/p1d/run.js` | 修改 | 第 1 项：C6 假通过修正（40→41 项） |
| `docs/integration/P1-D-02b-*` | 新增 | 本报告、测试日志、E2E 日志、PDF 样张 |
| `docs/integration/P1-D-02b-QT-sample.pdf` | 新增 | 真实导出的 PDF 证据 |
| `docs/integration/screenshots/p1d2b-*.png` | 新增 | 6 张 Electron 实测截图 |
| `CHANGE-VS-P1D02.txt`、`SHA256-diff-vs-P1D02.txt` | 新增 | 差异报告 |

产品代码（app/*、main.js、preload.js、storage.js、pdf-export.cjs）、tests/schema、tests/pricing、tests/p1c **全部逐字节未动**。

## 二、第 1 项：C6 假通过测试修正

**原状**（tests/p1d/run.js）：`ok('C6 换客户清空买方地址（A3 语义保持）', before === '' || true)` —— 恒真断言，无验证力。

**修正**：
1. 种子新增第二客户「李四 / GlobalBuy GmbH」（原种子仅 1 家）；
2. `Doc.custDropdown` 前预置非空旧买方地址 `d.buyerAddress = 'No.88 Old Street, Previous Buyer'`；
3. 执行客户切换（`Doc.custDropdown(String(c2.id))`）；
4. 真实断言：`eq('C6 换客户清空旧买方地址…', d.buyerAddress, '')` + 新增 `C6b 快照指向新客户（company === 'GlobalBuy GmbH'）`。

顺带修正两个掩盖问题的既有缺陷：`Store.customers()` 按最近创建排序（新客户在前），原 `customers()[0]`/`[1]` 索引取法在新增种子后会取错客户——改为按公司名查找。修正后 **P1-D 套件 41/41 全过**（原 40 项无回归）。

## 三、第 2 项：价格保护真实界面测试（Electron 隔离，SBW_USERDATA）

复用本轮种子单 QT-202611-0001（手动成交价 3.5），三个独立会话各走真实界面入口：

| 场景 | 修改入口 | stale | dirty | 填旧建议价 | 手动成交价 |
|---|---|---|---|---|---|
| 修改成本（costFactory 8.5→9.9） | `P1C.setCostField(0,'costFactory','9.9')` | false→**true** | false→**true** | **拒绝**（两行入口均拒） | **3.5 不变** |
| 修改运费（inland 0→50） | `P1C.setFreightRow('inland','amount','50')` | false→**true** | false→**true** | **拒绝** | **3.5 不变** |
| 修改定价参数（markupRate 40%→35%） | `P1C.setPricingParam('markupRate','35')` | false→**true** | false→**true** | **拒绝** | **3.5 不变** |

费用修改场景按反馈不重复。截图：`p1d2b-protect-cost/freight/param.png`。

## 四、第 3 项：QT 保存与 PDF 闭环（QT-202611-0002）

真实界面全流程：**新建 → 客户下拉（Accept Test Ltd）→ 卡片搜索添加产品（电焊网E1）→ 填成本（8.5/0.5/0/0）→ 确认成本 → 模具费 100 CNY 自动分摊 → 核价（fx 7.2、feeRate 3%、markupRate 40%，ready=true，建议价 3.81）→ 填入建议价（真实确认弹窗 `UI.runConfirm()`，写入 3.81）→ 保存（QT-202611-0002）→ 重开（单价/数量/成本/费用/汇率/客户全部一致）→ 打开 A4 纸面预览 → SBW_PDF 导出 PDF**。

三链路金额一致性核对（保存数据 = A4 预览 = PDF）：
- 保存数据：storePrice = 3.81，qty = 10
- A4 预览（sheetHTML）：含 3.81 与行金额 38.10
- PDF（`P1-D-02b-QT-sample.pdf`，63,599 字节，pypdf 7.1.1 文本提取）：单价 **3.81 ✓**、行金额 **38.10 ✓**、单号 QT-202611-0002 ✓、客户 Accept Test Ltd ✓、产品名 电焊网E1 ✓

如实披露（既有行为，均未改动）：新建草稿自带一行空明细，删除后输入层 `0:unit` 标记会残留（导致下一次保存被「计价单位还没选」拦截）——E2E 按真实用户等价动作（删除后重选该行计价单位下拉）处理；`Store.documents()`/`Store.customers()` 均为新单在前排序。两项与本次验收目标无关，**建议在后续阶段作为独立缺陷评估**，本轮未触碰产品代码。

## 五、第 4 项：五类单据验证（QT/PI/SC/CI/PL）

- **新建→改字段→保存→重开**：五类各建一份，备注字段「P1D-02 补充验收 ×」保存后重开**全部保留**；
- **PL 隔离**：重开的 PL 编辑页 HTML 不含 `p1c_pricing_panel` / `p1c_fees_panel` / `p1c_freight_panel`（零内部核价面板），packagingMode=mixed 落盘成功；
- **QT→PI/SC/CI/PL 转换链**：源 QT-202611-0003，`Doc.startConvert` 四个目标全部成功——type 正确、**sourceId 保留**（值=源单 id）、明细行数保留、客户快照延续。

## 六、回归与冻结核对

| 套件 | 结果 |
|---|---|
| Schema V5 | 194/194，EXIT=0 |
| P1-A 定价冻结回归 | 851/851，EXIT=0 |
| P1-C（G 段+H 段） | 229/229，EXIT=0 |
| P1-D 界面专项 | 41/41（含 C6 真实断言），EXIT=0 |
| 润成 parity | 8 场景全部一致，EXIT=0 |
| 语法检查（11 文件） | 全 OK |

vs P1-D-02 初始交付包（167 条目）：**~~166 一致 + 1 修改 + 10 新增~~（本行原统计有误，验收方复核修正如下）164 一致 + 3 修改（README-交付说明.md、SHA256SUMS.txt、tests/p1d/run.js）+ 12 新增 + 0 删除**；12 个新增文件中含 `p1d2b-five-docs.png`（本报告初版与 `SHA256-diff-vs-P1D02.txt` 初版的清单均遗漏该文件，验收方指出后已修正）。排除 SHA256SUMS.txt 自身口径：164 一致 + 2 修改 + 12 新增。冻结文件（pricing.js/model.js/store.js/storage.js/main.js/preload.js/sheet.js/pdf-export.cjs/app.css/index.html）逐字节一致。明细见 `SHA256-diff-vs-P1D02.txt`（已按修正口径重新生成）。

## 七、结论

**P1-D-02（含补充验收 0.2b）：已编码，全部补充验收项通过，待 ChatGPT 最终验收。** 通过前不进入 P1-D-03、不覆盖生产版本、不迁移生产数据。

## 八、P1-D-02c 收尾增补（2026-11-20，验收反馈两项收尾）

### 8.1 核价过期提示实时显示修复（涉及产品代码：仅 app/pages.js）

**验收方证据**：P1-D-02b Electron 日志 `panelHasStaleMark=false` 但整体 ok=true。根因：`P1C.setCostField`/`P1C.setFreightRow` 调 `markStale` 后只改状态不更新核价汇总卡 DOM（轻量刷新不整页重渲），提示永远不出现；`P1C.setPricingParam` 则每次输入整页 `UI.render()`（输入框失焦）。

**修复**（全部在 pages.js，冻结清单零触碰）：
1. 过期提示增加稳定 DOM 标识 `id="p1c_stale_mark"`（核价汇总卡内常驻节点，`display:inline/none` 切换）；
2. `P1C.markStale()` 追加 `P1C.showStaleMark()`——直接更新提示节点显示态，**不调 `UI.render()`**（无 DOM 环境静默跳过）；
3. `startPricing()` 追加 `P1C.hideStaleMark()`——开始核价后提示立即消失（UI.render 双保险）；
4. `Doc.refresh()`（数量/单价等轻量路径）翻过期态时同步 `showStaleMark()`；
5. `P1C.setPricingParam()` 不再每次输入整页 `UI.render()`：模式/换算说明三个纯文本块（`p1c_param_mode` / `p1c_param_mode_note` / `p1c_param_conv`，均不含输入元素）定向更新，焦点保持；
6. `P1C.renderFreightRow` 语义不变（其 stale 翻转仍走 `markStale` 链）。

### 8.2 Node 测试增补（tests/p1d/run.js，41 → 50 项）

新增 E 段 9 项：E1 稳定 DOM 标识常驻；E2 未过期 display:none；E3 过期 display:inline；E4 setCostField 触发 stale 且 `UI.render` 零调用；E5 setFreightRow 同；E6 setPricingParam 同（验证「不允许每次输入都调用 UI.render()」）；E7 startPricing 后 stale 复位；E8 重新核价后渲染为隐藏态；E9 Doc.refresh 轻量路径翻过期态且不整页 render。**50/50 全过，原 41 项零回归。**

### 8.3 Electron 隔离实测（6 会话，`P1-D-02c-e2e-log.txt`）

每场景两个会话（真实 Electron + SBW_USERDATA 独立临时目录；**panelHasStaleMark 纳入 ok 判定**），全部 PASS：

| 场景 | 修改入口 | 核价 ready | 修改后提示立即显示 | 整页 render 次数 | 旧建议价 | 手动成交价 | 重新核价后提示 |
|---|---|---|---|---|---|---|---|
| 成本 costFactory 20→21 | `P1C.setCostField` | ready=true | **true（立即）** | **0** | 6.57 **拒绝填入** | **3.5 不变** | **消失（false）** |
| 运费 forwarder 0→100 | `P1C.setFreightRow` | ready=true | **true（立即）** | **0** | 6.57 **拒绝填入** | **3.5 不变** | **消失（false）** |
| 加成率 40%→35% | `P1C.setPricingParam` | ready=true | **true（立即）** | **0** | 6.57 **拒绝填入** | **3.5 不变** | **消失（false）** |

三张证据截图（互不相同，SHA-256 见日志）：`p1d2c-cost-evidence.png`（成本输入 21 与提示同框）、`p1d2c-freight-evidence.png`（forwarder 100 与提示同框）、`p1d2c-param-evidence.png`（markupRate 35 与提示同框，且换算说明定向更新为 25.16% 实景可见）；另有三张 cleared 截图（重新核价后提示消失）。

### 8.4 差异报告修正与最终回归

- `SHA256-diff-vs-P1D02.txt`、`CHANGE-VS-P1D02.txt` 按验收方复核口径重新生成：02b 包 vs P1-D-02 实测 **164 一致 + 3 修改 + 12 新增（含 p1d2b-five-docs.png）+ 0 删除**；最终 0.2c 包 vs P1-D-02 的逐文件对照以重新生成的文件为准。
- 最终回归：Schema V5 194/194、定价 851/851、P1-C 229/229、P1-D 50/50、润成 parity 8/8，全部 EXIT=0（双全新临时目录独立解压实测）。
- 冻结范围：本轮仅 pages.js（提示修复）+ tests/p1d/run.js + 文档；pricing.js/model.js/store.js/storage.js/main.js/preload.js/sheet.js/pdf-export.cjs/app.css/index.html **逐字节零改动**；定价公式、Schema V5 未触碰。
