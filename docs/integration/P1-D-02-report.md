# P1-D-02 修复/实施报告：报价编辑界面 RunCheng 化

- **日期**：2026-11-20
- **基线**：P1-C-FIX-02 交付 ZIP（`e6d8b3c6…cd660`，154 条目）；工作副本 `D:/siwanghezi/siwang-box-0.2.17-dev-p1d`
- **依据**：P1-D-01 映射方案（审核通过）+ 用户 P1-D-02 任务书（含两项重点保护要求与六项正式决策）
- **状态**：已编码，全部回归通过，待 ChatGPT 独立验收。通过前不进入 P1-D-03。

## 一、实施范围（严格按任务书 §四）

修改仅 2 个文件，全部在允许清单内：

| 文件 | 改动性质 |
|---|---|
| `app/pages.js` | 编辑区模板重排为 RunCheng 卡片布局；`QuoteEdit` 新增 1 个纯状态键 `prodQuery`；纯新增行为函数 4 个（`Doc.custDropdown / prodSearch / addProductFromLibrary / prodSearchHTML`、`Doc.templateSelectHTML`）；`P1C.pricingPanelHTML` 拆为 `advancedParamsHTML` + `pricingResultCardHTML`；`freightPanelHTML` 分组化（新渲染函数 `freightRowsHTML`）。**全部 oninput/onchange 写入链原样复用，零新增写入口**（tests/p1d D4 断言） |
| `app/app.css` | 文件尾追加 rc- 前缀样式块（`.rc-card/.rc-sep/.rc-prod-grid/.rc-prod-opt/.rc-group-h`），只新增、不改既有类（app.css 兼 PDF 样式源） |

新增（非代码业务文件）：`tests/p1d/run.js`（40 项）、本轮交付文档与截图。

## 二、卡片布局（对齐 P1-D-01 映射表）

1. **订单信息卡**：客户下拉（RunCheng 主入口形态）+ 原客户区三模式（快照卡/手填/搜索）全保留 + 卖方快照卡 + 贸易条款/币种/付款/有效期/交货期/备注；**fx 与 incoterm/namedPlace 从内部参数/运费面板上移至此**（写入函数不变，fx/incoterm 唯一入口由测试断言）。
2. **产品明细与成本卡**（原「商品明细」）：顶部新增**产品库卡片式搜索**（命中前 6 条卡片，点击 = `Doc.addRow()+Doc.pickProduct()` 同一校验链；行内下拉与手填保留）；成本录入融合在每行内（specText + 四项成本 + 确认态 + 建议价 + 填入建议价）。
3. **订单一次性费用卡**：内容不变（自动/人工分摊、状态、删除全保留）。
4. **运费明细卡**：按 RunCheng 分组——「国内费用（工厂侧）」（inland/handling/packing，取 `Pricing.DOMESTIC_FREIGHT_ITEMS`）与「出口与国际费用」；折扣/其他收费保留。
5. **高级 / 内部参数卡**：feeInPrice/feeRate/markupRate/freightMarkup/commissionRate + 双显示换算 + 纸面模板选择（五类单据共用，PL 也在订单卡保留模板入口）。
6. **核价汇总卡**：开始核价按钮 + 过期提示 + 结果表 + 收入/运费/手续费/纯利润/利润率/提成/公司利润。
7. 右侧 A4 可编辑预览原样保留；PL：包装方式卡 + 产品明细卡（无金额）+ 订单卡（含唛头/模板），零内部核价界面（测试 B11 断言）。

## 三、两项重点保护要求的落实

1. **客户信息快照**：核实现有结构——单据快照键仅 `id/name/company/country/address`（按值快照）。V5 单据层没有 email/phone/whatsapp 键；若界面显示这些字段只能实时读客户库，会导致历史单随客户资料变化。**不升级 Schema，因此不引入这些字段的显示**，维持原有字段方式（映射方案 §1.1 已披露）。测试 C5 断言快照不含 live-read 字段；C1-C4 断言下拉选择走 pickCust 原快照语义。
2. **成交价留空机制**：不可安全实现——model.js 写门把行成交价 `null` 归一为 `0`（既有口径，文件冻结），「留空=用建议价」无法与「明确 0 价」区分；改语义必须动 model.js/Schema，违反冻结。**按任务书预案保留「填入建议价」按钮**，且 ready 门/pricingStale/pricingToken/确认弹窗全链路原样保留。测试 D1/D3 + E2E 场景 02 实测：清空费用 → stale+dirty → 填价被拒 → 手动价 3.5 不变 → 重摊重核 3.72 → 确认写入。

## 四、正式决策的落地情况（任务书 §一）

1. RunCheng 为界面/版式参考 ✅（P1-D-03 落地输出版式）；2. 产品库/成本/费用/运费/引擎/历史单据全保留 ✅（回归零变化）；3. sheet.js 本轮未动 ✅（P1-D-03 才做最小分发）；4. LOGO 属 P1-D-03；5. deposit_ratio 未入库 ✅；6. 默认模板切换属 P1-D-03。

## 五、测试结果（原有预期值零修改）

| 套件 | 结果 | 退出码 |
|---|---|---|
| Schema V5 | ALL PASS — 194 | 0 |
| P1-A 定价冻结回归 | ALL PASS — 851 | 0 |
| P1-C（FIX-01 G 段 + FIX-02 H 段） | ALL PASS — 229 | 0 |
| **P1-D-02 界面专项（新）** | **ALL PASS — 40**（A 字段完整性 60-65 入口×5 类 / B 卡片结构 12 / C 简洁入口 18 / D 保护 4） | 0 |
| 润成 parity | 8 场景全部一致 | 0 |
| 语法检查（11 个 JS 文件） | 全部 OK | 0 |

## 六、Electron 隔离实测（SBW_USERDATA 独立临时目录，4 会话）

- **seed**：建客户/产品/QT 单（QT-202611-0001），成本/费用/运费/术语齐备。
- **01 卡片布局+产品卡片搜索**：8 张卡片断言全真（fx/incoterm 唯一入口）；搜索命中卡片 → 卡片添加 → 行数 2、dirty、stale、成本快照 8.5。
- **02 价格保护**：核价 ready（建议 4.16）→ 手动价 3.5（used=3.5）→ 真实清空费用金额 → stale+dirty → 填价被拒、价格不变 → 费用 80 重摊重核 ready（建议 3.72）→ 确认弹窗 → 写入成功；纸面预览 Unit Price 3.72 / TOTAL $37.20 与编辑数据一致。
- **03 五类单据**：PI/SC/CI/PL 各自打开渲染无异常；PI/SC/CI 具备全部卡片与银行字段；PL 无任何核价面板、包装方式卡在、模板入口在。
- 截图 4 张 + 日志 `P1-D-02-e2e-log.txt`。

## 七、冻结核对（vs P1-C-FIX-02 基线 154 文件）

152 个文件逐字节一致；修改仅 `app/pages.js`、`app/app.css`（允许清单）；0 删除；定价公式、Schema V5、model/store/storage/main/preload/sheet/pdf-export、tests/pricing、tests/schema、tests/p1c 全部零改动（SHA-256 对照见 `SHA256-diff-vs-P1CFIX02.txt`，代码差异 `P1-D-02-pages.diff` 308 行 / `P1-D-02-css.diff` 28 行）。

## 八、如实披露

1. E2E 诊断中发现 p1d 工作副本无 node_modules（交付 ZIP 本就不含），已从 FIX-02 状态开发副本复制仅作测试环境（node_modules 不进交付 ZIP）。
2. `UI.confirm` 的 modal 容器节点常驻 DOM，E2E 用「价格未变」作为拒绝判据、用 `UI.runConfirm()` 作为确认路径，判据注明在日志中。
3. 客户下拉选中同一客户时 onchange 不触发（HTML select 固有行为）；重复选择走「更换客户」按钮路径，功能不受限。
