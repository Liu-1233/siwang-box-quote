# P1-C-FIX-01 集中修复报告

日期：2026-11-20
基线：siwang-box-integration-P1C-20261119.zip（efcfb4e2…bf40c）
对照基线（差异报告口径）：P1-B-FIX-01 ZIP（1879fe02…df716，任务书 §八）
性质：P1-C 独立验收发现的六个问题集中定点修复。不重写编辑器、不改冻结引擎、不升级 Schema。

## 一、修改文件

| 文件 | 性质 | 修改内容 |
|---|---|---|
| app/pages.js | 业务代码 | BUG-01/02/03/04 修复（详见 §二） |
| app/model.js | 业务代码（任务书允许的最小修复） | BUG-05：buildConversionDraft 目标为 PL 时剥离 `_unknown.pricing` |
| tests/p1c/run.js | 测试代码 | BUG-06：工程根按测试文件位置解析；新增 G 段 53 项专项测试；D2 按 BUG-03 定案更新 |
| docs/integration/* | 交付证据 | 报告/测试日志/E2E 日志/截图（p1cf-01~05） |
| CHANGE-VS-ORIGINAL.txt、SHA256SUMS.txt | 交付清单 | 追加 FIX-01 段落；重新生成 |

冻结文件（app/pricing.js、tests/pricing/run-all.js、storage.js、main.js、preload.js、app/sheet.js、pdf-export.cjs、costing-storage.js、授权/卡密/更新、装柜/规格/导入）逐字节零改动（见 CHANGE-VS-P1B-FIX01.txt）。Schema Version 未变。

## 二、逐项修复（修复前 → 修复后）

### BUG-01 待分摊/金额缺失费用没有真正阻断核价
- 修复前：`fees=[{amountCny:null,allocations:null}]` → engineFee 把缺失金额转成 `amountCny:0` 传引擎，引擎当"没有费用"，ready=true 且产生建议价。
- 修复后：新增 `P1C.validFeeAmount`（缺失/负数/非有限/**超两位小数**一律非法）；任一费用非法 → 引擎收到 `fee=null`（不是 0），`invalid=true`、`feePending=true`；run() 统一压 `ready=false`、blockers 明示"不按零费用处理"、全部建议价清空。明确 0 仍是合法零费用（'none'，不阻断）。

### BUG-02 非法运费与折扣被静默修正
- 修复前：已确认运费 amount=null → 引擎收 0；currency=null → 自动换默认币种；extra.discount=null → 自动转 0；运费 100.001 → 界面存 100；折扣 1.234 → 界面存 1.23。
- 修复后：build() 已录入行金额缺失保持 null（不转 0）、币种非法保持 null（不替换）、超两位小数原样保留；每项进入 `dataIssues` → run() 压 ready=false + blockers 明示；建议价全部清空。setFreightRow/setExtra 不再四舍五入（超两位小数原样保存，核价时报错）。留空与明确 0 全程区分（留空=未核实阻断；0=合法零值）。

### BUG-03 成本未确认时仍可填入建议价
- 修复前：applySuggestedPrice 只查 suggested_price 存在 + stale，不查 ready。
- 修复后：applySuggestedPrice 首先要求 `QuoteEdit.pricingResult.ready === true`；存在 blocker、待分摊、成本未确认等任一不满足即拒绝（toast"不能填入建议价"）。suggested_price 即使存在也不能绕过 ready 门；已手填成交价保留不覆盖。
- 披露：旧 D2 测试（0 价行填建议价）正是靠"不查 ready"通过——0 价行引擎如实报"成交单价必须大于零"（ready=false），按 BUG-03 定案更新为"拒绝填价、0 价原样保留"，确认弹窗+替换流程由 D3（合法手动价）继续覆盖。

### BUG-04 修改成本后旧建议价仍可填入
- 修复前：setCostField/setCostConfirmed/pickProduct/addRow/removeRow/addFee 等只 markDirty，pricingStale 仍 false，旧价可填。
- 修复后：统一失效机制——`markStale()` 置 stale + 递增 `pricingToken` 令牌；「开始核价」写入新令牌并把 stale 置 false（不会把刚算好的结果标记过期）。覆盖全部入口：成本修改/成本确认/数量与单位/产品切换/成交价（Doc.setField→refresh）/行增删/费用增删改/运费/折扣/汇率/手续费/加成率/贸易术语。**确认弹窗回调执行前再次比对令牌**：点填价 → 改成本 → 再确认 → 拒绝写入并提示过期。

### BUG-05 PL 仍保存内部核价扩展字段
- 修复前：QT→PL 已剥行级成本与顶层定价键，但 `_unknown.pricing`（内部运费/折扣/incoterm/namedPlace/extra）随整单克隆进入 PL 并落盘。
- 修复后：buildConversionDraft 目标为 PL 时（含 PL→PL 复制）剥离 `_unknown.pricing`；其余 `_unknown` 历史扩展键（quoteLayout/referenceFields/用户自有键）原样保留；sourceId、包装字段不受影响；QT→PI/SC/CI 快照延续不变。测试 G5 同时验证转换草稿与真实落盘 PL。

### BUG-06 新增测试不能独立解压运行
- 修复前：`tests/p1c/run.js` 硬编码 `D:/siwanghezi/siwang-box-0.2.17-dev`。
- 修复后：`ROOT = path.resolve(__dirname, '..', '..')`，全部源码按 ROOT 加载；启动即断言工程根可用且被加载源码（model/pricing/storage）路径位于当前测试根目录内（G0/G0b/G6）。独立解压后 `node tests/p1c/run.js` 实测成功。

## 三、测试结果（docs/integration/P1-C-FIX-01-test-logs.txt）

| 项目 | 结果 |
|---|---|
| Schema V5（原预期一字未改） | 194/194 PASS |
| P1-A 定价回归（三环境） | 851/851 PASS |
| P1-C 测试（原 137 口径 + FIX-01 专项） | 190/190 PASS（新增 G 段 53 项；D2 按 BUG-03 定案 2→3 项） |
| 润成对账 parity | 8/8 PASS |
| 全部 JS 语法检查 | 全部 PASS |
| Electron 隔离实测 | 五场景全过（见 §四） |

## 四、Electron 隔离实测（SBW_USERDATA=D:/siwanghezi/tmp-e2e-p1cf，生产 userData 未触碰；日志 P1-C-FIX-01-e2e-log.txt）

| 场景 | 结果 |
|---|---|
| F1 BUG-04 修改成本后填价：ready=true 建议价 9.60 → 改成本 500 → stale=true → 填价被拒、成交价 6.88 不变 | ✅ |
| F2 BUG-04 重新核价：新建议价 110.52 → 确认弹窗 → 写入 110.52（≠旧价 9.60） | ✅ |
| F3 BUG-01 费用金额缺失：ready=false、feePending=true、建议价=null、blocker"不按零费用处理" | ✅ |
| F4 BUG-02 运费金额缺失/币种缺失/折扣留空：ready=false，三条 blocker 如实录出，无建议价 | ✅ |
| F5 BUG-05 QT→PL 保存：`_unknown.pricing` 不在、fx=null、fees 空、sourceId 保留、PL 编辑器无任何定价/成本/费用面板 | ✅ |

截图：docs/integration/screenshots/p1cf-01~05.png（含 F3/F5 目视复核）。

## 五、差异口径（§八）

以 P1-B-FIX-01 ZIP（1879fe02…df716）为基线重新逐文件 SHA-256 比对（CHANGE-VS-P1B-FIX01.txt）：区分业务代码（model/pages/store）、测试代码（tests/）与交付清单（CHANGE-VS-ORIGINAL.txt、SHA256SUMS.txt），全部逐文件列示，自引用清单文件不写死自身哈希（以包内 SHA256SUMS.txt 条目为准）。

## 六、执行纪律

只修复验收复现的六个问题；未修改冻结引擎与公式；未升级 Schema、未重做迁移；未触碰生产 userData；所有测试隔离目录运行。完成后停止，等待独立验收；未进入 P1-D。
