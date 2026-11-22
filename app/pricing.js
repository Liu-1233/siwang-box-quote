/*
 * 丝网盒子 · 定价引擎（P1-A，纯函数 / UMD，不碰 fs、不碰 window、不改任何数据）
 *
 * 来源：润成报价 V3 src/pricing.ts computeQuote 1:1 移植（2026-11-19 P0 审核 定案方案 A）。
 * 口径规则不得改动：
 *   · 老法（fee_in_price=0）售价 = 成本 × (1+加成) ÷ 汇率，费率只从利润扣；
 *   · 含费（=1，新报价默认）售价 = 成本 ÷ (1 − 费率 − target_margin)；
 *   · target_margin = (1−fee)×markup/(1+markup)（润成内部口径），
 *     界面必须同时显示"成本加成率"与"手续费后目标利润率"，禁止标注为传统毛利率；
 *   · 木箱/包装费摊入只发生在计算层，不回写成本字段（防二次摊入）；
 *   · 引擎只给建议价，绝不覆盖用户手填价（final_price 优先）。
 *
 * 三处共用（与 sheet.js 同一 UMD 模式）：
 *   · 主进程 / Node 测试：require('./app/pricing.js')
 *   · 渲染进程：<script src="app/pricing.js"> → root.Pricing
 *   · VM 测试：vm.runInContext 加载真实文件
 *
 * P1-A 新增（P0 审核定案，§费用分摊最终决定）：
 *   · 同单位产品允许按数量平均分摊（allocateByQty，舍入差额有确定分配规则、总额严格守恒）
 *   · 不同单位产品禁止自动按数量平均分摊（checkUnitsForAllocation 拦截）
 *   · 人工指定各行分摊金额（validateManualAllocation，总额必须严格等于原始费用）
 *   · 未完成分摊 → allocationStatus 返回 'pending'；pendingAllocation 门下不给正式含费用建议价
 *   · 暂不实现重量/体积加权分摊
 *
 * P1-A-FIX-02 新增（第三轮定点修复，公式不变）：
 *   · BUG-06：手续费模式辅助函数（marginFromMarkupForMode / markupFromMarginForMode /
 *     afterFeeMarginFromMode）严格校验——仅数值 0/1 为合法模式，其余（含 "1"/true/null）返回 null；
 *     手续费参数拒绝 NaN/Infinity/负数/非法比例静默转 0
 *   · BUG-07：分摊原始金额先于 r2 校验（非负/有限/≤两位小数），0.004 不被舍入成零费用；
 *     明确输入 0 按零费用处理；auto/manual 均总额严格守恒
 *   · BUG-08：参与分摊的产品行原始 sort 必须存在/合法数字/唯一（checkSortsForAllocation），
 *     原始明细 sort 非法 → 禁止自动与人工分摊、状态 pending、阻断正式建议价
 *   · BUG-09：费用缺失与零值语义严格化——明确数字 0 才是零费用；extra.discount /
 *     other_charges 缺失/null/非法一律阻断（无历史缺省例外）；运费/木箱金额非法
 *     不得经 `|| 0` 静默进入合计；opts.fee.amountCny 缺失/非法 → pending
 *
 * P1-A-FIX-03 新增（BUG-10 定点修复，公式不变）：
 *   · BUG-10A：统一运费有效性校验（isFreightRowValid：amount 有限非负 ≤两位小数、
 *     币种仅 CNY/USD）——非法运费不进入 freightUsd/profitInputFreight/chargeFreight/
 *     packingChargedUsd/quotedFreight，不得让 freightConfirmedAll 保持 true，不按其他币种折算；
 *     非法已确认客户收费 → final_total=null；非法内部运费 → order_profit=null
 *   · BUG-11（P1-A-FIX-04）：合法 CNY 客户收费运费 + fx 缺失/无效 → 不折算、不进入
 *     chargeFreight，标记客户收费总额不完整 → final_total=null（不得静默漏收）；
 *   · BUG-10B：已确认、向客户收取的非法 packing 费用一律 pendingAllocation=true
 *     （不再依赖 packingFeeObj 是否形成），阻断正式建议价
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FREIGHT_ITEMS = {
    forwarder: ['货代运输费 Forwarder Freight', 'USD'],
    inland: ['国内陆运 Inland Freight', 'CNY'],
    packing: ['木箱及包装费 Packing & Crating', 'CNY'],
    insurance: ['保险费 Insurance', 'USD'],
    handling: ['国内港杂及出口操作费 China Handling', 'CNY'],
    duty: ['DDP 进口税费 Import Duty & Tax', 'USD'],
    lastmile: ['末端派送费 Last-mile Delivery', 'USD'],
    other: ['其他核实费用 Other Verified', 'USD'],
  };
  var DOMESTIC_FREIGHT_ITEMS = ['inland', 'handling', 'packing'];

  var REQUIRED_FREIGHT = {
    EXW: [],
    FOB: ['handling'],
    CIF: ['forwarder', 'insurance'],
    DDP: ['forwarder', 'duty', 'lastmile'],
  };

  var INCOTERMS = ['EXW', 'FOB', 'CIF', 'DDP'];

  function canonicalUnit(value) {
    var v = (value || '').toLowerCase().trim();
    if (v.indexOf('set') === 0 || v === '套' || v === '节') return 'set';
    if (['m', 'meter', 'metre', 'meters', 'metres', '米'].indexOf(v) >= 0) return 'm';
    return v;
  }

  function r2(n) { return Math.round(n * 100) / 100; }
  function r4(n) { return Math.round(n * 10000) / 10000; }
  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }
  /* ROUND_CEILING 保留两位（建议售价）；ROUND_HALF_UP 保留两位（提成） */
  function ceil2(n) { return Math.ceil(n * 100 - 1e-9) / 100; }
  function halfUp2(n) { return Math.sign(n) * Math.floor(Math.abs(n) * 100 + 0.5 + 1e-9) / 100; }

  /* ==================== 加成率换算（P0 审核定案 §2 冻结公式） ==================== */

  /* target_margin = (1−fee)×markup/(1+markup) —— 润成内部口径，非传统毛利率 */
  function marginFromMarkup(markup, fee) {
    var mk = +markup, f = +fee || 0;
    if (!isFiniteNum(mk) || mk <= 0) return null;
    if (!isFiniteNum(f) || f < 0 || f >= 1) return null;
    return (1 - f) * mk / (1 + mk);
  }

  /* 反算：由存储的 target_margin 还原加成率（界面双显示用；数学一致性验证用）
     由 margin = (1-f)*mk/(1+mk) ⇒ mk = margin / (1-f-margin)，要求 margin < 1-f */
  function markupFromMargin(margin, fee) {
    var m = +margin, f = +fee || 0;
    if (!isFiniteNum(m) || m <= 0 || m >= 1) return null;
    if (!isFiniteNum(f) || f < 0 || f >= 1) return null;
    var denom = 1 - f - m;
    if (denom <= 0) return null;
    return m / denom;
  }

  /* 传统毛利率（按实际售价计）：(P−C)/P，P=C×(1+mk)/(1−fee) ⇒ = 1 − (1−fee)/(1+mk)
     仅用于界面参照显示，禁止与 target_margin 混淆 */
  function grossMarginFromMarkup(markup, fee) {
    var mk = +markup, f = +fee || 0;
    if (!isFiniteNum(mk) || mk <= 0) return null;
    if (!isFiniteNum(f) || f < 0 || f >= 1) return null;
    return 1 - (1 - f) / (1 + mk);
  }

  /* ==================== 双手续费模式换算（P0 V2 审核补充 §2 定案） ==================== */

  /* 引擎版本标识：随单据快照落盘（doc.pricingVersion，P1-B 进 schema），
     用于区分历史单据计算口径——引擎按存储的 target_margin/fee_in_price 计算，
     不因迁移重算历史成交价 */
  var PRICING_VERSION = 'runcheng-v3-mode-1.0';

  /* 按手续费模式换算加成率 → 目标利润率（切换模式必须重算，不得沿用另一模式换算值）：
     fee_in_price=1（含费，新报价默认）：margin = (1−fee)×mk/(1+mk) ⇒ 售价 = 成本×(1+mk)÷(1−fee)
     fee_in_price=0（老法）：margin = mk/(1+mk) ⇒ 售价 = 成本×(1+mk)（40% 加成 → 成本×1.4）
     数学验证：mode0 时 denom = 1 − 0 − mk/(1+mk) = 1/(1+mk)，suggested = cost_usd×(1+mk) ✅

     BUG-06 修复（P1-A-FIX-02）：严格校验——
     · 模式：只有数值类型的 0 / 1 合法；null/undefined/字符串 "1"/"0"/true/false/其他非法值
       一律返回 null，不得自动转换成含费模式；
     · 手续费参数：NaN/Infinity/负数/≥1（非法比例）/非数值类型一律返回 null，不得静默转 0。 */
  function isValidFeeMode(v) {
    return v === 0 || v === 1;
  }
  function isValidFeeRate(f) {
    return isFiniteNum(f) && f >= 0 && f < 1;
  }
  function marginFromMarkupForMode(markup, fee, feeInPrice) {
    if (!isValidFeeMode(feeInPrice)) return null;
    var mk = +markup;
    if (!isFiniteNum(mk) || mk <= 0) return null;
    if (!isValidFeeRate(fee)) return null;
    return feeInPrice === 0 ? mk / (1 + mk) : (1 - fee) * mk / (1 + mk);
  }

  /* 反算（双模式）：由存储的 target_margin 还原加成率。
     mode1：mk = m/(1−f−m)；mode0：由 m = mk/(1+mk) ⇒ mk = m/(1−m)
     BUG-06 修复：模式与手续费参数严格校验（同 marginFromMarkupForMode）。 */
  function markupFromMarginForMode(margin, fee, feeInPrice) {
    if (!isValidFeeMode(feeInPrice)) return null;
    var m = +margin;
    if (!isFiniteNum(m) || m <= 0 || m >= 1) return null;
    if (!isValidFeeRate(fee)) return null;
    if (feeInPrice === 0) return m / (1 - m);
    var denom = 1 - fee - m;
    return denom > 0 ? m / denom : null;
  }

  /* 界面显示用：手续费后目标利润率（禁止把 mode0 的引擎 target_margin 直接当手续费后利润率显示）
     mode1（含费）：手续费后目标利润率 = target_margin（引擎口径已含手续费）
     mode0（不含费）：实际手续费后利润率 = target_margin − fee（引擎 target_margin 未扣手续费）
     例：40% 加成、3% 手续费 → mode1 显示 27.71%；mode0 引擎 target_margin=28.57%，手续费后显示 25.57%
     BUG-06 修复：模式与手续费参数严格校验（同 marginFromMarkupForMode）。 */
  function afterFeeMarginFromMode(targetMargin, fee, feeInPrice) {
    if (!isValidFeeMode(feeInPrice)) return null;
    var m = +targetMargin;
    if (!isFiniteNum(m) || m <= 0 || m >= 1) return null;
    if (!isValidFeeRate(fee)) return null;
    return feeInPrice === 0 ? m - fee : m;
  }

  /* ==================== 费用分摊（P0 审核定案：同单位数量平均 / 异单位拦截 / 人工指定） ==================== */

  /* 明细行单位归一检查：全部行（qty>0）单位一致才允许自动按数量平均分摊 */
  function checkUnitsForAllocation(items) {
    var units = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!(isFiniteNum(it.qty) && it.qty > 0)) continue;
      var u = canonicalUnit(it.unit || '');
      units[u] = (units[u] || 0) + 1;
    }
    var keys = Object.keys(units);
    return { ok: keys.length === 1, units: keys };
  }

  /* BUG-08 修复（P1-A-FIX-02）：参与分摊的产品行原始 sort 校验——
     sort 必须存在、为合法数字、且在参与行中唯一（每条产品行只能对应一笔分摊金额）。
     重复 sort / 缺失 sort / 非法 sort → ok=false（禁止自动分摊、禁止人工分摊通过、状态 pending）。 */
  function checkSortsForAllocation(items) {
    var seen = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!(isFiniteNum(it.qty) && it.qty > 0)) continue;
      if (!isFiniteNum(it.sort)) return { ok: false, error: '参与分摊的产品明细 sort 缺失或非法' };
      if (seen[it.sort]) return { ok: false, error: '参与分摊的产品明细 sort 重复：' + it.sort };
      seen[it.sort] = 1;
    }
    return { ok: true };
  }

  /* BUG-07 修复（P1-A-FIX-02）：原始金额校验——必须在 r2 舍入【之前】检查：
     非负、有限、最多两位小数。1.234 / 100.001 / 0.004（会被舍入成 0.00）等一律拒绝，
     不得出现"原始 1.234 实际只摊 1.23 但 ready=true"；明确输入 0 按零费用处理。 */
  function isValidRawAmount(v) {
    return isFiniteNum(v) && v >= 0 && Math.abs(v * 100 - Math.round(v * 100)) <= 1e-6;
  }

  /* BUG-10 修复（P1-A-FIX-03）：运费行统一有效性校验——
     amount 为有限数字、非负、最多两位小数；currency 仅 CNY 或 USD（EUR 等其他币种阻断，
     不参与任何折算与合计）。所有运费合计（freightUsd / profitInputFreight / chargeFreight /
     packingChargedUsd / quotedFreight）只累加通过本校验的行。 */
  function isFreightRowValid(fr) {
    return isFiniteNum(fr.amount) && fr.amount >= 0 &&
      Math.abs(fr.amount * 100 - Math.round(fr.amount * 100)) <= 1e-6 &&
      (fr.currency === 'CNY' || fr.currency === 'USD');
  }

  /* 按数量平均分摊：舍入差额（halfUp2 逐行）全部归最后一行，保证 Σ 分摊额 === 原始费用。
     amountCny 为两位小数金额。返回 [{sort, amountCny}] 或 null（不满足前提）。
     BUG-04 修复：NaN/Infinity/负数/缺失一律拒绝，不得静默按 0 处理。
     BUG-07 修复：r2 之前校验原始金额（非负/有限/≤两位小数）。
     BUG-08 修复：参与行原始 sort 必须存在/合法/唯一，否则拒绝自动分摊。 */
  function allocateByQty(items, amountCny) {
    if (!isValidRawAmount(amountCny)) return null;
    var amt = r2(amountCny);
    var check = checkUnitsForAllocation(items);
    if (!check.ok) return null;
    if (!checkSortsForAllocation(items).ok) return null;
    var rows = [];
    var totalQty = 0;
    for (var i = 0; i < items.length; i++) {
      if (isFiniteNum(items[i].qty) && items[i].qty > 0) { totalQty += items[i].qty; rows.push(items[i]); }
    }
    if (totalQty <= 0 || !rows.length) return null;
    var out = [];
    var allocated = 0;
    for (var j = 0; j < rows.length; j++) {
      if (j < rows.length - 1) {
        var v = halfUp2(amt * rows[j].qty / totalQty);
        allocated = r2(allocated + v);
        out.push({ sort: rows[j].sort, amountCny: v });
      } else {
        /* 最后一行兜差额：总额严格等于原始费用 */
        out.push({ sort: rows[j].sort, amountCny: r2(amt - allocated) });
      }
    }
    return out;
  }

  /* 人工分摊校验（基础版）：各行金额两位小数、非负，Σ 必须严格等于原始费用（容差 1e-9）。
     BUG-04 修复：金额缺失/NaN/Infinity 不再静默按 0 处理，一律判非法。
     BUG-07 修复：原始费用金额先于 r2 校验（非负/有限/≤两位小数），明确 0 按零费用处理。 */
  function validateManualAllocation(rows, amountCny) {
    if (!isValidRawAmount(amountCny)) return { ok: false, error: '原始费用金额非法（须为非负且最多两位小数的数字）' };
    var amt = r2(amountCny);
    if (!Array.isArray(rows) || !rows.length) return { ok: false, error: '未提供分摊明细' };
    var sum = 0;
    for (var i = 0; i < rows.length; i++) {
      var v = rows[i] && rows[i].amountCny;
      if (!isFiniteNum(v) || v < 0) return { ok: false, error: '第 ' + (i + 1) + ' 行分摊金额非法（须为非负数字）' };
      if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-6) return { ok: false, error: '第 ' + (i + 1) + ' 行分摊金额须为两位小数' };
      sum = r2(sum + v);
    }
    if (Math.abs(sum - amt) > 1e-9) return { ok: false, error: '分摊总额 ' + sum + ' ≠ 原始费用 ' + amt + '，须严格相等' };
    return { ok: true, sum: sum };
  }

  /* 人工分摊校验（严格版，BUG-02 修复，P1-A-FIX-01）：在基础校验之上，验证分摊行归属——
     1) 每个 sort 必须对应实际明细行（不允许不存在的 sort，如 sort=99）；
     2) sort 必须唯一（不允许重复 sort）；
     3) sort 必须为合法数字（不允许缺失/非法值）；
     4) 不允许遗漏应参与分摊的产品行（= 数量>0 的全部明细行）；
     5) 金额有限、非负、最多两位小数；Σ 严格等于原始费用。
     BUG-07 修复（P1-A-FIX-02）：原始费用金额先于 r2 校验（非负/有限/≤两位小数）。
     BUG-08 修复（P1-A-FIX-02）：同时校验【原始产品明细】的 sort——存在/合法数字/唯一，
     原始明细 sort 非法时人工分摊不得通过（防"两行 sort 同为 0 却各摊一笔=双倍摊入"）。
     任何一项失败 → pending。 */
  function validateManualAllocationFor(items, allocations, amountCny) {
    if (!isValidRawAmount(amountCny)) return { ok: false, error: '原始费用金额非法（须为非负且最多两位小数的数字）' };
    var amt = r2(amountCny);
    var sk = checkSortsForAllocation(items);
    if (!sk.ok) return { ok: false, error: sk.error };
    if (!Array.isArray(allocations) || !allocations.length) return { ok: false, error: '未提供分摊明细' };
    var partSorts = [];
    for (var i = 0; i < items.length; i++) {
      if (isFiniteNum(items[i].qty) && items[i].qty > 0) partSorts.push(items[i].sort);
    }
    var seen = {};
    var sum = 0;
    for (var j = 0; j < allocations.length; j++) {
      var a = allocations[j];
      var s = a ? a.sort : undefined;
      if (!isFiniteNum(s)) return { ok: false, error: '第 ' + (j + 1) + ' 行分摊 sort 缺失或非法' };
      if (seen[s]) return { ok: false, error: '分摊行 sort 重复：' + s };
      seen[s] = 1;
      var v = a.amountCny;
      if (!isFiniteNum(v) || v < 0) return { ok: false, error: '第 ' + (j + 1) + ' 行分摊金额非法（须为非负数字）' };
      if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-6) return { ok: false, error: '第 ' + (j + 1) + ' 行分摊金额须为两位小数' };
      sum = r2(sum + v);
    }
    for (var k = 0; k < partSorts.length; k++) {
      if (!seen[partSorts[k]]) return { ok: false, error: '遗漏应参与分摊的产品行 sort=' + partSorts[k] };
    }
    for (var key in seen) {
      var found = false;
      for (var m = 0; m < partSorts.length; m++) {
        if (partSorts[m] === +key) { found = true; break; }
      }
      if (!found) return { ok: false, error: '分摊 sort=' + key + ' 不存在于明细行' };
    }
    if (Math.abs(sum - amt) > 1e-9) return { ok: false, error: '分摊总额 ' + sum + ' ≠ 原始费用 ' + amt + '，须严格相等' };
    return { ok: true, sum: sum };
  }

  /* 分摊状态：'none'（无费用）、'pending'（有费用未完成分摊——不得生成正式含费用建议价）、
     'auto'（逐行与按数量平均分摊结果完全一致）、'manual'（人工分摊且总额严格等于原始费用）
     判定顺序：先 auto（更严格）后 manual，否则 auto 分支不可达（auto 结果恒满足总额相等）
     BUG-04 修复：费用对象存在但金额缺失/NaN/Infinity → pending（不得当 0 → 'none'）
     BUG-07 修复：原始金额在 r2 之前校验精度（0.004 不得被舍入成 0 后按零费用放行）
     BUG-08 修复：原始产品明细 sort 非法 → 一律 pending */
  function allocationStatus(items, fee) {
    if (!fee) return 'none';
    if (!isFiniteNum(fee.amountCny)) return 'pending';
    if (fee.amountCny < 0) return 'pending';
    if (!isValidRawAmount(fee.amountCny)) return 'pending';
    var amt = r2(fee.amountCny);
    if (!(amt > 0)) return 'none';
    if (!checkSortsForAllocation(items).ok) return 'pending';
    if (!fee.allocations || !Array.isArray(fee.allocations) || !fee.allocations.length) return 'pending';
    /* 自动分摊：逐行等于按数量摊入结果 → auto */
    var auto = allocateByQty(items, amt);
    if (auto && auto.length === fee.allocations.length) {
      var same = true;
      for (var i = 0; i < auto.length; i++) {
        if (auto[i].sort !== fee.allocations[i].sort || Math.abs(auto[i].amountCny - fee.allocations[i].amountCny) > 1e-9) { same = false; break; }
      }
      if (same) return 'auto';
    }
    /* BUG-02 修复：人工分摊走严格版校验（sort 合法/唯一/完整 + 金额 + 总额守恒） */
    var v = validateManualAllocationFor(items, fee.allocations, amt);
    if (v.ok) return 'manual';
    return 'pending';
  }

  /* ==================== computeQuote（润成 1:1 移植，26 项回归口径） ==================== */

  function computeQuote(q, items, freight, extra, supplierUnitById, opts) {
    opts = opts || {};
    var warnings = [];
    var blockers = [];
    var fx = q.fx;
    var fee = q.fee_rate || 0;
    var margin = q.target_margin || 0;
    /* BUG-01 修复（P1-A-FIX-01）：手续费模式严格识别——
       1=明确含费；0=明确不含费；null/undefined/其他=未知。
       未知不得自动转成含费：阻断 + 告警 + 不给建议价 + ready=false，totals.fee_in_price 保留 null。
       润成 V3 历史数据的含费默认由调用方适配层显式传 1；v4 历史单保留未知；新报价默认 1 由 P1-C 编辑器负责。 */
    var feeModeRaw = q.fee_in_price;
    var fee_in_price; /* true=含费 / false=不含费 / null=未知 */
    if (feeModeRaw === 1) fee_in_price = true;
    else if (feeModeRaw === 0) fee_in_price = false;
    else {
      fee_in_price = null;
      blockers.push('手续费模式未知（feeInPrice 为 null/undefined）：须由调用方确认含费（1）或不含费（0）后才能定价');
    }
    var price_fee = fee_in_price === true ? fee : 0.0;

    var fxv = fx;
    if (!isFiniteNum(fx) || fx <= 0) {
      blockers.push('报价汇率必须大于零');
      fxv = null;
    }
    if (
      !isFiniteNum(q.fee_rate) || !(q.fee_rate >= 0 && q.fee_rate < 1) ||
      !isFiniteNum(q.target_margin) || !(q.target_margin >= 0 && q.target_margin < 1) ||
      price_fee + margin >= 1
    ) {
      blockers.push('销售费率和目标毛利率须填写且在 0–100% 内，两者之和须小于 100%');
    }
    if (!isFiniteNum(q.freight_markup) || q.freight_markup < 0) {
      blockers.push('运费加价率不得为负数');
    }
    var cr = q.commission_rate;
    if (cr !== null && cr !== undefined && (!isFiniteNum(cr) || cr < 0 || cr > 1)) {
      blockers.push('个人提成比例须在 0–100% 内（留空表示未设置）');
    }
    if (
      !(q.buyer_contact || '').trim() &&
      !(q.buyer_company || '').trim() &&
      !q.customer_id
    ) {
      warnings.push('买方信息未填写：可保存内部草稿，生成正式客户文件前需补充');
    }

    /* P0 审核新增门：费用未完成分摊 → 阻断正式含费用建议价（只影响建议价，不影响成本/利润核算） */
    var pendingAllocation = false;
    var feeAllocBySort = null;   /* 分摊完成时：{sort → 本行分摊总额 CNY}（行额÷行数量摊入每件成本） */
    if (opts.fee) {
      var stFee = allocationStatus(items, opts.fee);
      if (stFee === 'pending') { pendingAllocation = true; blockers.push('费用尚未完成分摊，不能生成正式含费用建议价'); }
      else if (stFee === 'auto' || stFee === 'manual') {
        feeAllocBySort = {};
        for (var fa = 0; fa < opts.fee.allocations.length; fa++) {
          feeAllocBySort[opts.fee.allocations[fa].sort] = opts.fee.allocations[fa].amountCny;
        }
      }
    }

    var outItems = [];
    // 木箱/包装费摊入成本（2026-11-18 业务确认）：运费面板中向客户收取且已核实的「木箱及包装费」
    // 按数量摊入每件成本，走定价引擎（建议价=成本÷(1−费率−毛利率)），不再单列运费行。
    // 摊入只发生在计算层，不回写 cost_packing，避免保存后二次摊入。
    // BUG-03 修复（P1-A-FIX-01）：不再直接按全单数量平均——与新费用同一套分摊机制：
    //   同单位 → 自动按数量平均（allocateByQty，单位检查+总额守恒）；混合单位 → 仅接受人工分摊
    //   （opts.packingFeeAllocations，P1-A 临时参数，P1-B 由 doc.fees[] 落库替代）；
    //   人工未完成/输入非法 → pending，不给正式建议价。防双计机制保持不变。
    var packingChargeTotalCny = 0;
    var packingInputInvalid = false;
    for (var fi = 0; fi < freight.length; fi++) {
      var fr0 = freight[fi];
      if (fr0.item === 'packing' && fr0.charge_customer && fr0.confirmed) {
        /* BUG-04 修复：非法金额/币种不再静默跳过——明确阻断
           BUG-09 修复（P1-A-FIX-02）：补充两位小数精度校验（缺失/NaN/Infinity/负数/非法精度均阻断，不静默转 0） */
        if (!isFiniteNum(fr0.amount) || fr0.amount < 0 || Math.abs(fr0.amount * 100 - Math.round(fr0.amount * 100)) > 1e-6) {
          blockers.push('木箱/包装费金额非法（须为非负且最多两位小数的数字）');
          packingInputInvalid = true;
        } else if (fr0.currency === 'CNY') {
          packingChargeTotalCny += fr0.amount;
        } else if (fr0.currency === 'USD') {
          if (!fxv) {
            blockers.push('汇率缺失，木箱/包装费（USD）无法折算');
            packingInputInvalid = true;
          } else {
            packingChargeTotalCny += fxv * fr0.amount;
          }
        } else {
          blockers.push('木箱/包装费币种非法（须为 CNY 或 USD）');
          packingInputInvalid = true;
        }
      }
    }
    var packingFeeObj = packingChargeTotalCny > 0
      ? { amountCny: r2(packingChargeTotalCny), allocations: opts.packingFeeAllocations || null }
      : null;
    /* 同单位且未提供人工分摊 → 自动按数量平均（与旧行为数值一致，保持 1:1）；
       混合单位且未提供人工分摊 → 保持无 allocations，由 allocationStatus 判 pending */
    if (packingFeeObj && !packingFeeObj.allocations && !packingInputInvalid && checkUnitsForAllocation(items).ok) {
      packingFeeObj = { amountCny: packingFeeObj.amountCny, allocations: allocateByQty(items, packingFeeObj.amountCny) };
    }
    var packingStatus = packingFeeObj && !packingInputInvalid ? allocationStatus(items, packingFeeObj) : 'none';
    /* BUG-10B 修复（P1-A-FIX-03）：非法 packing（金额/币种非法）不再依赖 packingFeeObj 是否存在——
       只要存在已确认、向客户收取的非法 packing 费用，一律 pendingAllocation=true，
       阻断正式建议价（suggested_price=null、ready=false）；此前 packingChargeTotalCny 未形成
       正数时 packingFeeObj=null 导致门失效，建议价仍可生成。 */
    if (packingFeeObj && packingStatus === 'pending') {
      pendingAllocation = true;
      blockers.push('木箱/包装费尚未完成分摊（混合单位须人工指定各行金额），不能生成正式含费用建议价');
    } else if (packingInputInvalid) {
      pendingAllocation = true;
    }
    var packingAllocBySort = null;
    if (packingFeeObj && !packingInputInvalid && (packingStatus === 'auto' || packingStatus === 'manual')) {
      packingAllocBySort = {};
      for (var pa = 0; pa < packingFeeObj.allocations.length; pa++) {
        packingAllocBySort[packingFeeObj.allocations[pa].sort] = packingFeeObj.allocations[pa].amountCny;
      }
    }
    for (var ii = 0; ii < items.length; ii++) {
      var it = items[ii];
      var o = JSON.parse(JSON.stringify(it));
      var factoryExact = it.cost_factory || 0;
      var sqUnit = it.supplier_quote_id ? ((supplierUnitById && supplierUnitById[it.supplier_quote_id]) != null ? supplierUnitById[it.supplier_quote_id] : '') : '';
      var mismatch = !!(sqUnit && canonicalUnit(sqUnit) !== canonicalUnit(it.unit));
      // 换算数量未填时：单位一致视为 1（正常情况），单位不一致才视为未填（阻断确认）
      var factor = it.purchase_units_per_sale != null ? it.purchase_units_per_sale : (mismatch ? 0 : 1);
      if (mismatch && (factor <= 0 || !it.unit_conversion_confirmed)) {
        blockers.push('第' + (it.sort + 1) + '行采购单位 ' + sqUnit + ' 与销售单位 ' + it.unit + ' 不同，须填写并核实换算数量');
      }
      if (!mismatch && factor !== 1) {
        blockers.push('第' + (it.sort + 1) + '行相同计价单位的换算数量须为 1');
      }
      if (it.purchase_price !== null && it.purchase_price !== undefined) {
        /* BUG-05 修复（P1-A-FIX-01）：采购价输入先校验再换算——
           NaN/Infinity/负数/非法币种/USD 但汇率缺失，均明确阻断，不得让 NaN 进入成本链 */
        if (!isFiniteNum(it.purchase_price) || it.purchase_price < 0) {
          blockers.push('第' + (it.sort + 1) + '行采购价必须为非负有限数');
        } else if (['CNY', 'USD'].indexOf(it.purchase_currency) < 0) {
          blockers.push('第' + (it.sort + 1) + '行采购币种非法（须为 CNY 或 USD）');
        } else if (it.purchase_currency === 'USD' && !fxv) {
          blockers.push('第' + (it.sort + 1) + '行汇率缺失，USD 采购价无法折算');
        } else {
          factoryExact =
            it.purchase_price *
            (it.purchase_currency === 'USD' ? fxv : 1) *
            (mismatch ? factor : 1);
          o.cost_factory = r2(factoryExact);
        }
      }
      // 包装/木箱费为本行总价（2026-11-18 业务确认）：按本行数量平均摊入每件成本
      var packingLineTotal = it.cost_packing || 0;
      var packingPerPiece = isFiniteNum(it.qty) && it.qty > 0 ? packingLineTotal / it.qty : 0;
      /* P0 审核 §费用分摊：一次性订单费用（doc.fees[]，P1-B 落库）分摊完成时按行摊入——
         行分摊额 ÷ 本行数量 = 每件摊入，与 packing 行同口径；摊入只发生在计算层，不回写成本字段 */
      var feePerPiece = 0;
      if (feeAllocBySort && isFiniteNum(it.qty) && it.qty > 0 && feeAllocBySort[it.sort] != null) {
        feePerPiece = feeAllocBySort[it.sort] / it.qty;
      }
      /* BUG-03 修复：木箱/包装费按分摊结果摊入（auto=同单位数量平均，manual=人工指定行额÷行数量），
         替代旧的"全单数量平均"通路；两者在同单位场景数值一致，混合单位场景不再误摊 */
      var packingAllocPerPiece = 0;
      if (packingAllocBySort && isFiniteNum(it.qty) && it.qty > 0 && packingAllocBySort[it.sort] != null) {
        packingAllocPerPiece = packingAllocBySort[it.sort] / it.qty;
      }
      o.cost_total_cny =
        factoryExact + packingPerPiece +
        (it.cost_inland || 0) + (it.cost_other || 0) +
        packingAllocPerPiece + feePerPiece;
      o.packing_per_unit_cny = packingPerPiece + packingAllocPerPiece + feePerPiece;
      var exactUsd = fxv ? o.cost_total_cny / fxv : null;
      if (!it.cost_confirmed) {
        warnings.push('第' + (it.sort + 1) + '行「' + (it.name_en || '未命名产品') + '」采购成本未确认');
      }
      if (fxv && fxv > 0 && isFiniteNum(o.cost_total_cny)) {
        o.cost_usd = r4(o.cost_total_cny / fxv);
      } else {
        o.cost_usd = null;
        warnings.push('报价汇率未填写');
      }
      if (!isFiniteNum(it.qty) || it.qty <= 0) {
        blockers.push('第' + (it.sort + 1) + '行数量必须大于零');
      }
      /* BUG-05 修复：成本校验改为检查"最终计算成本"——
         采购换算成功时以换算后的出厂成本为准（原始 cost_factory=null 不再误判）；
         换算失败（采购输入非法）时 blocker 已在上方产生。 */
      var costKeys = ['cost_packing', 'cost_inland', 'cost_other'];
      var badCost = false;
      for (var ck = 0; ck < costKeys.length; ck++) {
        var cv = it[costKeys[ck]];
        /* 与润成 1:1：null/undefined/非有限数均视为非法（null 不降级为 0）——
           "0=明确确认零、null=未填写"由 cost_confirmed 字段区分，数值层 null 必须阻断 */
        if (!isFiniteNum(cv) || cv < 0) { badCost = true; break; }
      }
      if (o.cost_factory === null || o.cost_factory === undefined || !isFiniteNum(o.cost_factory) || o.cost_factory < 0) {
        badCost = true;
      }
      /* 最终计算成本必须为有限正数（NaN/Infinity 一并拦截） */
      if (!(o.cost_total_cny > 0) || badCost) {
        blockers.push('第' + (it.sort + 1) + '行成本必须非负且合计大于零');
      }
      var denom = 1 - price_fee - margin;
      /* BUG-01 修复：手续费模式未知（fee_in_price=null）时不得生成正式建议价 */
      if (o.cost_usd !== null && o.cost_total_cny > 0 && denom > 0 && !pendingAllocation && fee_in_price !== null) {
        o.suggested_price = ceil2(exactUsd / denom);
      } else {
        o.suggested_price = null;
        if (denom <= 0 && (price_fee || margin)) {
          warnings.push('费率+毛利率 ≥ 100%，无法反推建议价');
        }
        if (pendingAllocation) warnings.push('存在待分摊费用：建议价仅作内部参考，不作为正式报价依据');
      }
      o.used_price = it.final_price !== null && it.final_price !== undefined ? it.final_price : o.suggested_price;
      if (o.used_price && o.cost_usd !== null && isFiniteNum(exactUsd)) {
        o.item_margin = r4((o.used_price - exactUsd - o.used_price * fee) / o.used_price);
        o.quoted_margin = r4((o.used_price - exactUsd) / o.used_price);
        o.markup_on_cost = exactUsd > 0 ? r4((o.used_price - exactUsd) / exactUsd) : null;
      } else {
        o.item_margin = null;
        o.quoted_margin = null;
        o.markup_on_cost = null;
      }
      if (!isFiniteNum(o.used_price) || o.used_price <= 0) {
        blockers.push('第' + (it.sort + 1) + '行成交单价必须大于零');
      }
      /* NaN 防护：used_price 非法时金额必须为 null，不得让 NaN 进入合计 */
      o.amount = isFiniteNum(o.used_price) && o.used_price > 0 ? r2(it.qty * o.used_price) : null;
      outItems.push(o);
    }

    // 运费
    var freightUsd = 0;
    var freightConfirmedAll = true;
    var chargeFreight = 0;
    var profitInputFreight = 0;
    var packingChargedUsd = 0;
    var freightDetail = [];
    var chargedFreightInvalid = false; /* BUG-10：存在非法的已确认客户收费运费行 */
    for (var fj = 0; fj < freight.length; fj++) {
      var fr = freight[fj];
      /* BUG-10 修复（P1-A-FIX-03）：统一运费有效性校验（替代 FIX-02 的分散校验）——
         校验失败：明确 blocker + freightConfirmedAll=false + 不得进入任何财务合计。
         BUG-04 修复（FIX-01）的统一文案保留。 */
      var frValid = isFreightRowValid(fr);
      if (!frValid) {
        blockers.push('运费须为非负、最多两位小数且币种为 CNY 或 USD');
      }
      if (fr.confirmed) {
        /* BUG-09 修复（P1-A-FIX-02）+ BUG-10 修复（P1-A-FIX-03）：
           非法运费（负数/NaN/Infinity/三位小数/非法币种）一律不进入合计——
           不得经 `|| 0` 或按其他币种静默折算。币种转换明确区分：
           USD 直接用美元金额；CNY = 人民币金额 ÷ fx（fx 缺失 → 不折算 + 告警）。 */
        var usd = null;
        if (!frValid) {
          freightConfirmedAll = false; /* BUG-10：非法运费不得让 freightConfirmedAll 保持 true */
        } else if (fr.currency === 'USD') {
          usd = fr.amount;
        } else if (fxv) {
          usd = fr.amount / fxv;
        } else {
          freightConfirmedAll = false;
          warnings.push('汇率缺失，含人民币运费项无法折算');
        }
        if (usd !== null) {
          freightUsd += usd;
          // 向客户收取的木箱费已按数量平均摊入明细成本，这里不再扣一次（防双计）
          if (!fr.included_in_cost && !(fr.item === 'packing' && fr.charge_customer)) profitInputFreight += usd;
        }
      } else {
        freightConfirmedAll = false;
      }
      if (fr.charge_customer) {
        if (!fr.confirmed) {
          warnings.push('运费项「' + ((FREIGHT_ITEMS[fr.item] || [fr.item, ''])[0]) + '」单独向客户收取但未确认金额');
        } else if (!frValid) {
          /* BUG-10：非法客户收费不进入 chargeFreight/packingChargedUsd/quotedFreight，
             且 final_total 置 null（客户应付总额不得显示为完整有效金额） */
          chargedFreightInvalid = true;
        } else if (fr.currency === 'USD') {
          chargeFreight += fr.amount;
          if (fr.item === 'packing') packingChargedUsd += fr.amount;
        } else if (fxv) {
          chargeFreight += fr.amount / fxv;
          if (fr.item === 'packing') packingChargedUsd += fr.amount / fxv;
        } else {
          /* BUG-11 修复（P1-A-FIX-04）：金额与币种均合法的 CNY 客户收费运费，fx 缺失/无效
             （null/0/NaN/Infinity → fxv=null）时无法折算成美元——不得静默漏收：
             不进入 chargeFreight/packingChargedUsd（上方分支已保证），并标记客户收费
             总额不完整 → final_total=null（否则客户应付总额看似有效、实际少收该笔运费）。
             order_profit=null（freightConfirmedAll 已在已确认分支置 false）、ready=false（!!fx 门）。 */
          chargedFreightInvalid = true;
          warnings.push('汇率缺失，向客户收取的人民币运费无法折算，客户应付总额暂不可用');
        }
      }
      freightDetail.push(Object.assign({}, fr, { label: (FREIGHT_ITEMS[fr.item] || [fr.item, ''])[0] }));
    }
    freightUsd = r2(freightUsd);
    // 木箱/包装费改为摊入产品单价：总价表不再单列该行（含加价率一并摊入，客户总支出不变）
    var quotedFreight = r2((chargeFreight - packingChargedUsd) * (1 + (q.freight_markup || 0)));

    // EXW：国内段不告警（业务确认常规做法），国际段才提示
    var exwIntlCharged = freight
      .filter(function (f) { return f.charge_customer && f.confirmed && DOMESTIC_FREIGHT_ITEMS.indexOf(f.item) < 0; })
      .map(function (f) { return f.item; });
    if (q.incoterm === 'EXW' && exwIntlCharged.length) {
      var labels = exwIntlCharged.map(function (k) { return (FREIGHT_ITEMS[k] || [k, ''])[0]; }).join('、');
      warnings.push('EXW 条款下向客户收取了国际段费用（' + labels + '），请核对贸易责任划分');
    }
    if (['FOB', 'CIF', 'DDP'].indexOf(q.incoterm) >= 0 && !freight.some(function (f) { return f.confirmed; })) {
      warnings.push(q.incoterm + ' 条款需要按责任核实费用，当前尚无已核实费用');
    }
    if (q.incoterm === 'DDP' && !freight.some(function (f) { return f.item === 'duty' && f.confirmed; })) {
      warnings.push('DDP 条款需核实并录入进口税费');
    }
    // 重复计算防护（与润成 V2 三条一致）
    var itemInland = items.reduce(function (s, i) { return s + (i.cost_inland || 0); }, 0);
    var itemPacking = items.reduce(function (s, i) { return s + (i.cost_packing || 0); }, 0);
    var freightHandling = freight.reduce(function (s, f) { return s + (f.item === 'handling' && f.confirmed ? f.amount || 0 : 0); }, 0);
    var freightInland = freight.reduce(function (s, f) { return s + (f.item === 'inland' && f.confirmed ? f.amount || 0 : 0); }, 0);
    var freightPacking = freight.reduce(function (s, f) { return s + (f.item === 'packing' && f.confirmed ? f.amount || 0 : 0); }, 0);
    if (itemInland > 0 && freightHandling > 0) {
      warnings.push('产品单价内已含国内运费，运费面板又录入了国内港杂费，请核对避免重复计算');
    }
    if (itemInland > 0) {
      warnings.push('产品单价内仍含「国内运输」成本：如需整批单独报国内陆运，请清零 B 栏旧运输并改填运费面板「国内陆运」');
    }
    if (freightInland > 0 && itemInland > 0) {
      warnings.push('国内陆运已在运费面板单独收取，产品单价内又计入国内运输，请核对避免重复计算');
    }
    if (itemPacking > 0 && freightPacking > 0) {
      warnings.push('明细内已填包装/木箱费（本行总价），运费面板又单列了木箱包装费，请二选一避免重复计算');
    }

    // 木箱/包装费已按数量平均摊入明细成本，运费行不再单列该费用
    var revenue = r2(outItems.reduce(function (s, i) { return s + (i.amount || 0); }, 0));
    /* NaN 防护：成本合计仅累加有限值 */
    var purchaseCny = outItems.reduce(function (s, i) { return s + (isFiniteNum(i.cost_total_cny) && isFiniteNum(i.qty) ? i.cost_total_cny * i.qty : 0); }, 0);
    var purchaseUsd = fxv ? r2(purchaseCny / fxv) : null;
    /* BUG-04 修复：extra 折扣/其他费用 NaN/Infinity/负数/超两位小数必须阻断。
       BUG-09 修复（P1-A-FIX-02）：零值语义严格化——明确输入数字 0 才代表零费用；
       缺失（undefined）/null/NaN/Infinity/负数/非法精度一律阻断，不得经 `|| 0` 静默转 0。
       （extra.discount / extra.other_charges 为必填数字字段，无历史缺省例外：
        润成 V3 界面恒显式提供 0 默认值；26 项原始回归与 8 个对账场景均显式传入 0。） */
    var extraDiscRaw = extra ? extra.discount : undefined;
    var extraOthRaw = extra ? extra.other_charges : undefined;
    var extraInvalid = false;
    var discount = 0;
    var otherCharges = 0;
    if (extraDiscRaw === null || extraDiscRaw === undefined) {
      blockers.push('折扣金额未填写（须明确数字，0 表示零费用）');
      extraInvalid = true;
    } else if (!isFiniteNum(extraDiscRaw) || extraDiscRaw < 0 || Math.abs(extraDiscRaw * 100 - Math.round(extraDiscRaw * 100)) > 1e-6) {
      blockers.push('折扣金额非法（须为非负且最多两位小数）');
      extraInvalid = true;
    } else discount = r2(extraDiscRaw);
    if (extraOthRaw === null || extraOthRaw === undefined) {
      blockers.push('其他费用金额未填写（须明确数字，0 表示零费用）');
      extraInvalid = true;
    } else if (!isFiniteNum(extraOthRaw) || extraOthRaw < 0 || Math.abs(extraOthRaw * 100 - Math.round(extraOthRaw * 100)) > 1e-6) {
      blockers.push('其他费用金额非法（须为非负且最多两位小数）');
      extraInvalid = true;
    } else otherCharges = r2(extraOthRaw);
    var finalTotalRaw = revenue + quotedFreight - discount + otherCharges;
    /* BUG-10 修复（P1-A-FIX-03）：存在非法的已确认客户收费运费行 → final_total=null，
       客户应付总额不得显示为完整有效金额（非法金额已不参与合计，但总额也不得照常展示）。 */
    var finalTotal = !extraInvalid && !chargedFreightInvalid && outItems.some(function (i) { return i.amount; }) ? r2(finalTotalRaw) : null;
    var salesFee = finalTotal !== null && fee ? r2(finalTotal * fee) : 0;
    if (fee_in_price === false && fee && finalTotal !== null) {
      warnings.push('本单为老法口径：' + (fee * 100).toFixed(2) + '% 收款费率未计入售价，将直接从利润扣除约 ' + salesFee.toFixed(2) + ' USD');
    }
    profitInputFreight = r2(profitInputFreight);
    var orderProfit = null;
    var orderMargin = null;
    if (finalTotal !== null && purchaseUsd !== null && freightConfirmedAll) {
      orderProfit = r2(finalTotal - purchaseUsd - profitInputFreight - otherCharges - salesFee);
      orderMargin = finalTotal > 0 ? r4(orderProfit / finalTotal) : null;
    }

    // 利润分配（zero_on_loss 规则，2026-11-04 管理层批准；亏损时提成为 0）
    var crv = q.commission_rate;
    var orderCommission = null;
    var companyProfit = null;
    if (orderProfit !== null) {
      if (crv === null || crv === undefined) {
        orderCommission = null;
        companyProfit = null;
      } else if (orderProfit < 0) {
        orderCommission = 0.0;
        companyProfit = halfUp2(orderProfit);
      } else if (orderProfit === 0) {
        orderCommission = 0.0;
        companyProfit = 0.0;
      } else {
        orderCommission = halfUp2(orderProfit * crv);
        companyProfit = halfUp2(orderProfit - orderCommission);
      }
    }

    // 目标比较用产品口径（运费是转嫁项不进分母）
    var prodMargin = null;
    if (revenue && purchaseUsd !== null) {
      prodMargin = (revenue - purchaseUsd - revenue * fee) / revenue;
    }
    if (fee_in_price !== null && prodMargin !== null && q.target_margin) {
      var effTarget = fee_in_price === true ? q.target_margin : Math.max(0, q.target_margin - (fee || 0));
      if (prodMargin < effTarget - 1e-9) {
        warnings.push('产品毛利率 ' + (prodMargin * 100).toFixed(1) + '% 低于目标 ' + (effTarget * 100).toFixed(0) + '%，需审批');
      }
    }
    if (!items.length) warnings.push('尚未添加任何产品');
    if (q.incoterm !== 'EXW' && !q.named_place) warnings.push('交货地点（Named Place）未填写');
    if (!q.payment_terms) warnings.push('付款条款未填写');

    if (INCOTERMS.indexOf(q.incoterm) < 0) blockers.push('不支持的贸易术语');
    if (q.incoterm !== 'EXW' && !(q.named_place || '').trim()) blockers.push('交货地点（Named Place）未填写');
    if (!(q.payment_terms || '').trim()) blockers.push('付款条款未填写');
    if (q.incoterm === 'DDP' && !freight.some(function (f) { return f.item === 'duty' && f.confirmed; })) {
      blockers.push('DDP 条款需核实并录入进口税费');
    }
    var reqF = REQUIRED_FREIGHT[q.incoterm] || [];
    for (var rk = 0; rk < reqF.length; rk++) {
      var kind = reqF[rk];
      if (!freight.some(function (f) { return f.item === kind && f.confirmed; })) {
        blockers.push(q.incoterm + ' 必须核实费用项：' + FREIGHT_ITEMS[kind][0] + '（零金额也须核实）');
      }
    }
    warnings = warnings.concat(blockers);

    return {
      quote: q,
      items: outItems,
      freight: freightDetail,
      extra: { discount: discount, other_charges: otherCharges },
      totals: {
        revenue: revenue,
        purchase_usd: purchaseUsd,
        freight_actual_usd: freightUsd,
        freight_charged_usd: quotedFreight || null,
        sales_fee: salesFee,
        final_total: finalTotal,
        fee_in_price: fee_in_price,
        order_profit: orderProfit,
        order_margin: orderMargin,
        order_commission: orderCommission,
        company_profit: companyProfit,
        commission_rate: crv == null ? null : crv,
      },
      warnings: uniqueSorted(warnings),
      ready:
        blockers.length === 0 &&
        items.length > 0 &&
        items.every(function (i) { return i.cost_confirmed; }) &&
        !!fx &&
        freightConfirmedAll &&
        (q.incoterm === 'EXW' || freight.some(function (f) { return f.confirmed; })),
    };
  }

  function uniqueSorted(arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); }
    }
    return out.sort();
  }

  return {
    FREIGHT_ITEMS: FREIGHT_ITEMS,
    DOMESTIC_FREIGHT_ITEMS: DOMESTIC_FREIGHT_ITEMS,
    REQUIRED_FREIGHT: REQUIRED_FREIGHT,
    INCOTERMS: INCOTERMS,
    canonicalUnit: canonicalUnit,
    r2: r2,
    r4: r4,
    ceil2: ceil2,
    halfUp2: halfUp2,
    marginFromMarkup: marginFromMarkup,
    markupFromMargin: markupFromMargin,
    grossMarginFromMarkup: grossMarginFromMarkup,
    PRICING_VERSION: PRICING_VERSION,
    marginFromMarkupForMode: marginFromMarkupForMode,
    markupFromMarginForMode: markupFromMarginForMode,
    afterFeeMarginFromMode: afterFeeMarginFromMode,
    checkUnitsForAllocation: checkUnitsForAllocation,
    checkSortsForAllocation: checkSortsForAllocation,
    allocateByQty: allocateByQty,
    validateManualAllocation: validateManualAllocation,
    validateManualAllocationFor: validateManualAllocationFor,
    allocationStatus: allocationStatus,
    computeQuote: computeQuote,
  };
});
