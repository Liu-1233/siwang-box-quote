# P1-C 报价编辑器集成实施报告

日期：2026-11-19
基线：siwang-box-integration-P1B-FIX01-20261119.zip
性质：界面集成（不重写定价引擎、不改冻结公式、不改 Schema Version）

## 一、修改文件（均在任务书允许清单内）

| 文件 | 修改内容 |
|---|---|
| app/model.js | patchDocument 最小范围补充：V5 单据级定价九键白名单（fx/feeRate/targetMargin/commissionRate/freightMarkup/markupRate/feeInPrice/pricingVersion/fees）+ `_unknown.pricing` 受控合并（incoterm/namedPlace/freight/extra 白名单键）。未触碰迁移/校验逻辑，V4→V5 链路零改动。 |
| app/store.js | 新报价默认定价参数：settings() 暴露 pricingDefaults（feeInPrice=1、feeRate=0.03、commissionRate=0.20、fx=null、markupRate=null、freightMarkup=null）；保存设置页对应字段。 |
| app/pages.js | P1-C 主体（详见下文 §二）。 |
| tests/p1c/run.js | 新增 P1-C 测试套件 137 项。 |

冻结文件（app/pricing.js、tests/pricing/run-all.js、storage.js、main.js、preload.js、app/sheet.js、pdf-export.cjs、costing-storage.js、授权/卡密/更新、装柜/规格/导入）逐字节零改动（见 SHA256-diff-vs-P1BFIX01.txt）。

## 二、pages.js P1-C 主体

1. **引擎脚本注入**：index.html 未引入 app/pricing.js（渲染进程无 Pricing 全局）。采用 pages.js 解析阶段 `document.write('<script src="pricing.js"></script>')` 注入（index.html 位于 app/ 目录内），不触碰 index.html 与 main.js。
2. **数据适配层 P1C**：
   - engineItems：V5 camelCase → 引擎 snake_case；costPacking×qty 单次转换（§3.4 专项测试锁死不重复乘）；costConfirmed 三态直传；不写回数据库。
   - engineQuote：fx/feeRate/targetMargin/commissionRate/freightMarkup/feeInPrice 映射；incoterm/named_place 取自 `_unknown.pricing`（不猜测、不用 delivery 冒充交货地）。
   - engineFreight：读取 `_unknown.pricing.freight`；运费项目来自 Pricing.FREIGHT_ITEMS 常量；extra 显式提供 discount/other_charges 数字（零费用传 0）。
   - engineFee：fees[] → opts.fee 适配。逐笔判态（无费用/金额非法或未填/待分摊/已完成）；按 sort 汇总各笔分摊；任一笔正金额费用未完成分摊 → 整体 pending（fee.allocations=null 传引擎阻断正式建议价）；金额守恒、不重复摊入；原始费用记录不破坏。
3. **明细行成本区域**：规格描述 specText、四项成本（null=未填、0=明确零成本）、成本确认下拉（未确认/已确认/明确未确认）；建议价展示。产品库选择带入快照（含成本），不反写产品库。
4. **订单费用面板**：新增/修改/删除费用；同单位自动分摊（Pricing.allocateByQty）；混合单位禁自动、人工分摊（Pricing.validateManualAllocationFor）；待分摊/自动分摊/人工分摊/无费用四态显示。
5. **定价参数面板**：fx（>0）、feeRate、markupRate、targetMargin（引擎换算）、freightMarkup（允许明确 0）、commissionRate、feeInPrice 双模式；模式切换重新换算（marginFromMarkupForMode / markupFromMarginForMode）；同时展示引擎目标利润率与手续费后实际利润率（afterFeeMarginFromMode），不含费模式明确提示二者不等。
6. **核价展示**：单位总成本(CNY)/单位成本(USD)/建议售价/当前售价/订单收入/实际运费/客户承担运费/手续费/订单纯利润/利润率/个人提成/公司利润；ready=false 显示阻断原因与引擎 warnings，不显示为已核价。
7. **价格保护**：手动价不被自动覆盖；建议价须点「填入建议价」；已有成交价时弹确认（UI.confirm）；final_price=0 不当空值；非法输入不静默转 0；历史单据打开不自动重算（无定价参数时核价面板提示补参，不自动填建议价）。
8. **单据隔离**：PL 编辑器不渲染费用/定价/运费/成本面板，无建议售价；QT/PI/SC/CI 正常。
9. **历史保护**：打开历史单据不写入任何定价参数；历史 feeInPrice=null 保持未知。

## 三、贸易术语与币种边界

- incoterm 仅允许引擎支持值（EXW/FOB/CIF 等，来自引擎校验），named_place 为明确输入字段；term 纸面字段继续服务客户单据。
- 依 P1-A 实算路径核实：引擎正式报价币种仅 USD。P1-C 自动定价限 USD；CNY/EUR 等保留手动报价并明确提示。

## 四、测试结果（docs/integration/P1-C-test-logs.txt）

| 项目 | 结果 |
|---|---|
| Schema V5（原 194 项） | 194/194 PASS（预期一字未改） |
| P1-A 定价回归 | 851/851 PASS |
| 润成对账 parity | 8/8 PASS |
| P1-C 新增套件 | 137/137 PASS（A 成本/B 定价/C 分摊/D 价格保护/E 保存/F 隔离） |
| 全部 JS 语法检查 | 全部 PASS |
| Electron 隔离实测 | 12 张截图 + 全部 EVAL 钩子断言通过（P1-C-e2e-isolation-log.txt） |

## 五、Electron 隔离实测

数据副本：SBW_USERDATA=D:/siwanghezi/tmp-e2e-p1c（隔离目录，生产 userData 未触碰；截图右下"我的数据在哪"可见）。
截图（docs/integration/screenshots/）：01 编辑器全貌、02 成本录入、03 自动分摊、04 混合单位人工分摊、05 含费模式、06 切不含费重算、07 核价结果（ready=true）、08 替换成交价确认弹窗、09 确认后填入建议价、10 保存重开（费用名称/分摊完整）、11 PL 隔离（无任何定价面板/成本行）、12 设置页默认参数卡片。

## 六、已知边界与披露

1. 历史单据（docC 型）：打开不自动定价、参数保持 null；用户主动补参后才可核价。
2. 保存后 price=null 行经既有 D2 口径落盘为 0，引擎如实阻断「成交单价必须大于零」——属既有行为，P1-C 未改写门。
3. `_unknown.pricing.freight` 中未确认运费会使 ready=false（引擎 confirmed 要求），界面明示。
4. patchDocument 对 fees 采用整组替换（编辑草稿含完整 fees[]），不做逐笔合并，避免部分更新产生半分摊状态。

## 七、执行纪律核对

- 未修改冻结文件、未改 Schema Version、未重跑迁移设计、未重建项目。
- 定价公式全部调用 pricing.js，页面无第二套公式。
- 未触碰生产 userData；测试全部在隔离目录。
- 完成后停止，等待 ChatGPT 独立验收；未进入 P1-D。
