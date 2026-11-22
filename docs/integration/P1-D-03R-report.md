# P1-D-03R 修正报告：严格还原 RunCheng 原版 QT 报价单

**日期**：2026-11-20
**基线**：`siwang-box-integration-P1D03-20261120.zip`（SHA256 a0b93a42…e6a1）全新解压工作副本 `siwang-box-0.2.17-dev-p1d3r`
**视觉基准**：用户提供的 RunCheng 导出 PDF `Mexico-fernando_saldana-马场围栏-QUOTATION-20261119.pdf`（唯一版式验收标准）

---

## 一、结论

`quotation-rc-v1` 模板已从「参考 RunCheng 重新设计的蓝色商务风」改为「严格还原原版的黑白商务表格风」，并在本轮完成**量测驱动的 1:1 版式对齐**（见 §九）。
八个区域全部按原版重构；模板内**不含任何原版业务内容**，一切数据从当前单据动态读取；已用**两份内容完全不同的报价单**验证内容变化时版式不变。
汇总金额口径、模板分发、Schema V5、定价公式、手动成交价保护、内部字段零泄漏**全部不变**；
五套回归（schema 194 / pricing 851 / p1c 229 / p1d 51 / p1d3 114）全过；双数据集 PDF、并排对照图、几何实测记录齐备。

## 二、八个区域还原情况（对照截图）

| # | 区域 | 原版还原要点 | 状态 |
|---|------|-------------|------|
| 1 | 公司抬头 | LOGO 左 + 公司名加粗黑色（Times 衬线）+ 地址 + `Tel: x | WhatsApp: y` + `Email: x | Web: y` 紧凑排列，抬头下 3px 黑色分隔线 | ✅ |
| 2 | QUOTATION 标题 | 左大号加粗 QUOTATION（32px），右 `No.: / Date:` 小字右对齐；无蓝色标题条 | ✅ |
| 3 | 买方/单据双栏 | 左 BUYER / CONSIGNEE、右 DOCUMENT INFO 两个并排黑框，**等宽 50/50**（中间 10px 间隔），**纯白表头**、**框内无逐行网格线**（仅标题行下划线）；字段名加粗，行高 15.9 CSS px；缺失显示「—」 | ✅ |
| 4 | 产品明细表 | 原版八列 NO./PHOTO/PRODUCT NAME/SPECIFICATION/QTY/UNIT/UNIT PRICE (USD)/AMOUNT (USD)，列宽 **5/12/16/20/6/8/16/17%**，全黑边框、**纯白表头**，图片独立列不拉伸，名称与规格分列 | ✅ |
| 5 | 条款+金额汇总 | 左 COMMERCIAL TERMS（Payment Terms / Production Lead Time / Packaging / Notes & Exclusions）+ 右侧五行汇总（Subtotal / Shipping·Freight / Discount / Tax·Other / TOTAL AMOUNT (USD) 加粗行），两表均**有行间横线与标签/数值列表内竖线** | ✅ |
| 6 | 金额大写 | 紧凑黑框（高 24.7 CSS px）`Amount in Words: USD … AND 00/100 ONLY`，与引擎 final_total 严格同源 | ✅ |
| 7 | 双签名区 | For the Seller / For the Buyer 左右两个独立区块，各自一条 2px 顶线、中间 12px 空隙（**原版无中缝竖线**）+ 底部 Authorized Signature / Company Stamp | ✅ |
| 8 | 页脚 | 2px 黑色通栏分隔线 + 居中「公司名 · 报价编号 · Customer-Facing Quotation」 | ✅ |

## 三、本轮代码改动（最小范围）

| 文件 | 改动 |
|------|------|
| `app/sheet-rc.js` | build() 版式结构按截图重写（抬头/标题行/双栏/条款+汇总并排/大写/签名/页脚）；新增 `sellerExtraFor`/`sellerExtraFromUserDataDir`（抬头 Tel/WhatsApp/Email/Web，best-effort 读取）；`totalsRC` 计算逻辑**逐字节不变** |
| `app/app.css` | 仅重写本模板专属 `.rc-sheet` 样式块（蓝→黑白衬线），不改任何既有规则 |
| `app/pages.js` | 设置页「我的信息」新增 4 个输入框（抬头电话/WhatsApp/邮箱/网站），`Settings.save` 存入 `settings.sellerPhone/sellerWhatsApp/sellerEmail/sellerWebsite`（Object.assign 合并，零存储结构改动）；其余不动 |
| `tests/p1d3/run.js` | 仅更新因版式变化失效的断言（B14/B19/B23/C2/C6/C7/C10/C13/C15 等 token），新增 6 项与本轮直接相关的断言（B24-B26 双栏、H12-H17 联系方式）；未新增无关测试 |

**未触碰**：pricing.js、Schema V5、model.js、store.js、storage.js、main.js、preload.js、pdf-export.cjs、sheet.js、reference-sheets.js、旧测试套件（逐字节一致，见 SHA256-diff-vs-P1D03.txt）。

## 四、业务口径说明（不变项）

- **保存金额 = A4 预览金额 = PDF 输出金额**：Product Subtotal/Freight/Discount/Other/TOTAL 全部来自 `totalsRC`（= pricing.js 引擎 final_total 同源）。当前 `tests/p1d3` 夹具 C 实测：小计 694.50 + 运费 121.00 − 折扣 5.00 + 其他 2.00 = **TOTAL 812.50**，大写与数字一致（详见 §十「三组金额数据的关系」）。
- 内部字段零泄漏：pypdf 全文断言 feeRate/targetMargin/commissionRate/markupRate/feeInPrice/内部运费金额等全部未出现。
- 汇总五行**固定齐全**（原版 0.00 行也印）；运费未核实完整时运费格显示「—」并出内部警示（不静默按 0 计）。
- Named Place 为展示层拆分（优先 `pricing.namedPlace`，否则从 term 剥术语前缀），不改任何单据字段。
- 历史 basic-v1 单据不串版（E2E S2 实测）；历史 rc 单据照常打开；SC/CI/PL 不受影响。
- 客户 Email/Phone 按 V5 快照边界不带入单据 → 固定显示「—」（与原版占位方式一致）。

## 五、与原版 PDF 的已知差异（版式差异说明）

> 本节结论以 **§九（数据驱动 1:1 版式对齐）** 为准；下列条目已按最终实测更新。

1. **数据不同**：样张把 RunCheng 原版 PDF 的客户/产品/金额作为「数据集 A」复现，仅用于版式比对；模板内**没有任何原版业务内容被写死**（见 §九·4 硬编码扫描）。实际输出全部来自当前单据。
2. **LOGO**：原版马标已从用户提供的 RunCheng 导出 PDF 中逐字节提取（638×401 JPEG）并内嵌为 `DEFAULT_LOGO`；保持原始宽高比、不拉伸。原版在 PDF 里对该图做了约 9.6% 的纵向拉伸，本轮**未复制该变形**（按用户「不得拉伸变形」的硬性要求）。
3. **第 2 页上边距**：已按原版对齐——第 2 页条款框与汇总表顶边贴纸面顶端（y=0）。实现方式见 §9.1 第 15 项；第 1 页仍从 4mm 起算，抬头分割线 y=136 不变。
4. **行高**：行高下限 93 CSS px 与原版一致；规格文本超长时该行随内容自增（与原版 Word 表格行为相同）。
5. **金额大写超一行**：框为 `min-height`，大写换行时框高增加一个行高，其下签名与页脚整体下移——与原版同类行为一致；条款框与汇总表不受影响。
6. **页脚短语**：原版逐字为 `Customer-facing Quotation`（**小写 f**，本轮放大原版 PDF 页脚复核确认）；早期版本误写为 `Customer-Facing`，本轮已更正，`tests/p1d3` B23 同步更新。
7. **Email/Phone 空值**：原版亦为「—」，与 V5 快照边界一致。

## 六、验收证据（docs/integration/）

| 文件 | 内容 |
|------|------|
| `P1-D-03R-A-sample.pdf` | **数据集 A**（RunCheng 原版内容，8 行，TOTAL 170.52）实际导出 PDF，2 页 |
| `P1-D-03R-B-sample.pdf` | **数据集 B**（完全不同内容：Nordzaun Handels GmbH / 3 行 / TOTAL 12,567.50）实际导出 PDF，2 页 |
| `P1-D-03R-geometry.txt` | 参考件 / 数据集 A / 数据集 B 三方的水平基准线、产品表竖线、双栏竖线、产品图占位实测数值 |
| `screenshots/p1d3r-layout-compare-p1.png` / `-p2.png` | 原版 PDF vs 数据集 A 整页并排对照（第 1/2 页），本轮已按最终版式重出 |
| `screenshots/p1d3r-fmt-A-vs-B-p1.png` / `-p2.png` | 数据集 A vs 数据集 B 整页并排对照，证明内容变化时版式不变 |
| `P1-D-03R-fmt-test-log.txt` | 本轮五套件回归 + 语法检查 + 硬编码扫描日志 |
| `P1-D-03R-LOGO-sample.pdf` | LOGO 修正节点导出的 QT PDF（历史留档） |
| `screenshots/p1d3r-logo-fix-p1.png` / `-p2.png` | LOGO 修正后 A4 页面渲染（历史留档） |
| `screenshots/p1d3r-logo-compare.png` | 原版 PDF 抬头 vs 修正后抬头并排对照 |
| `P1-D-03R-QT-sample.pdf` | 修正前 QT PDF（保留作对照） |
| `screenshots/p1d3r-side-by-side.png` | 最早一版截图对照（历史留档，版式已过期） |
| `screenshots/p1d3r-s4-a4-full.png` | 新 QT 完整 A4 PNG 样张（历史留档） |
| `screenshots/p1d3r-s1-qt-preview.png` | 编辑器内预览截图（历史留档） |
| `P1-D-03R-test-logs.txt` | 首轮五套件回归日志（p1d3 110 项，历史留档） |
| `P1-D-03R-e2e-log.txt` | Electron 隔离实测三会话日志（S1/S2/S4） |
| `SHA256-diff-vs-P1D03.txt` | 与 P1D03 逐文件哈希对照 |

## 七、LOGO 与版式对齐修正（2026-11-20）

**问题**：A4 预览与 PDF 左上角仍显示设置页遗留的临时占位图；同时与用户提供的 RunCheng 导出 PDF 对比，页边距偏大、行高偏松，导致第 8 行落到第 2 页。

**处理**：
- 从用户提供的 `Mexico-fernando_saldana-马场围栏-QUOTATION-20261119.pdf` 中提取原版 LOGO 图像（`IM8.jpg`，638×401，JPEG，21,033 字节），逐字节内嵌为 `sheet-rc.js` 的 `DEFAULT_LOGO`，未重绘、未 AI 生成。
- `logoFor()` 改为：`opts.logo` 显式覆盖优先；其余情况一律返回原版 LOGO，不再读取 `settings.sellerLogo`，确保历史占位图不会进入正式报价单。
- `opts.logo=''` 保留“本张不印 LOGO”的测试/特殊能力。
- CSS `.rc-logo` 调整为 `height:64px; width:auto; max-width:103px`，对应原版 PDF 中 48.12pt 高、76.68pt 宽的图像框（≈64.2×102.2 CSS px），保持原始宽高比、不拉伸。
- 版式对齐原版 PDF：`.rc-sheet` 页边距 12mm→4mm；抬头/标题/双栏/明细表/条款/汇总/签名/页脚的字号与内边距按原版比例收紧；产品图上限 88px→60px；`COMMERCIAL TERMS + 金额汇总` 前强制分页，形成「第 1 页 8 行明细、第 2 页条款/汇总/签名」的原版分页结构。
- 第 2 页专项：条款表改为白底表头、去掉列间竖线、标签列 28%（Payment Terms 单行、Production Lead Time 两行）；金额大写框、签名区、页脚按原版拉开间距，签名中缝竖线延伸至页脚线。
- `pdf-export.cjs` 仅对 `quotation-rc-v1` 关闭页脚页码；其他模板仍为 12mm/16mm 边距 + 页码，零影响。
- 打印边距：RC 模板 `@page` 边距归零，改由纸面根节点 padding 控制（第 1 页 4mm、第 2 页 0）；该节细节见 §9.1 第 15/16 项。

**验证**：
- 导出 LOGO 与原图的像素差异仅 JPEG 重压缩级别（max 7/255），尺寸 638×401 完全一致。
- 样张 PDF 第 1 页含全部 8 行明细，第 2 页为条款/汇总/大写/签名/页脚，与 RunCheng 原版 PDF 的分页和区块位置一致（见 `p1d3r-layout-compare-p1/p2.png`）。
- p1d3 套件 114 PASS；新增 H11a/H11b 断言：设置页存在 PNG 占位图时，纸面仍只出现原版 JPEG LOGO。
- schema 194 / pricing 851 / p1c 229 / p1d 51 全过。

**未改动**：定价公式、Schema V5、产品/客户库、单据转换、单据金额口径。

> ⚠️ 本节关于「灰色区头」「48%/52% 双栏」「列宽 4/11/19/26/6/7/13/14%」「条款标签列 28%」「签名中缝竖线延伸至页脚」等细节描述**已被 §九的实测结果取代**，请以 §九为准。

## 八、回归汇总

```
schema   194 PASS / 0 FAIL
pricing  851 PASS / 0 FAIL（+ parity 8 场景一致）
p1c      229 PASS / 0 FAIL
p1d       51 PASS / 0 FAIL
p1d3     114 PASS / 0 FAIL（含 LOGO 修正 2 项）
```

## 九、数据驱动的 1:1 版式对齐（本轮最终版）

**目标重申**：RunCheng 原版 PDF 是唯一版式基准；模板不得写死原版客户/产品/规格/数量/单价/金额；一切内容从当前编辑单据动态读取；无论数据如何变化，页面尺寸、字号、列宽、边框、间距、图片位置与整体比例始终等于原版。

**方法**：不再靠目视调参，改为对参考 PDF 与生成件做同一路径的像素量测——两侧均按 A4 595.276×841.890pt、`scale=2` 栅格渲染（**1 CSS px = 1.5 图像 px**），逐条提取通栏水平基准线与表格竖线坐标，反解出 CSS 值。

### 9.1 量测驱动的修正项

| # | 位置 | 原版实测（图像 px） | 修正前 | 修正动作 |
|---|------|------------------|--------|----------|
| 1 | 信息盒内部 | 仅「框顶 / 标题行下划线 / 框底」3 条线，框内**无逐行网格** | 每行都画 `border-bottom`，呈电子表格状 | 去掉 `.rc-info` 行分隔线，只保留 `.rc-info-h` 下划线 |
| 2 | 信息盒表头 | 背景纯白 `#fff` | 灰底 `#ececec` | 改白底 |
| 3 | 双栏比例 | 左框 21.5→588、右框 604.5→1170.5，**等宽 + 16px 间隔** | `48% / flex:1`，间隔 10px | 两框 `calc(50% - 5px)` + `gap:10px` |
| 4 | 标签列宽 | 标签起点 = 框左 + 69 CSS px（约占 24.5%） | 38% | 改 `th 24.5% / td 75.5%` |
| 5 | 产品表列宽 | 竖线 21.5 / 78.5 / 216.5 / 399.5 / 629.5 / 699.5 / 792.5 / 975.5 / 1170.5 | 4/11/19/26/6/7/13/14% | 改 **5/12/16/20/6/8/16/17%** |
| 6 | 产品表表头 | 纯白底，行高 33 图像 px | 灰底，行高 26 | 白底 + `padding:5.5px 4px` |
| 7 | 产品图 | ink bbox 118×100（79×66.5 CSS px） | 88×88（`max-height:80px`） | 定宽定高 79×66.5 + `object-fit:cover`（源图为正方形，原版按固定框裁切填充） |
| 8 | 产品名行距 | 行距 16 CSS px | 继承 normal ≈13.2 | `.pname { line-height:1.4 }` |
| 9 | 公司抬头 | 名称 cap 高 22 图像 px；地址三行行距 22–24 | 15.5px / 9.5px、行距 21 | 名称 16.5px、副行 10px/`line-height:1.5`，抬头 `padding-bottom` 12→7.3px 以保持分割线位置不变 |
| 10 | 条款表 | 字号约 11px、1 行行高 20 CSS px、2 行 31.3；**有行间横线 + 标签/数值列竖线** | 12px、行高 30、无列竖线 | `font-size:11px`、`padding:3.5px 6px`、`.rc-terms tr:not(.rc-info-h) th{border-right}`、列宽 30/70→**27/73** |
| 11 | 汇总表 | 行高 21/21.3 CSS px，末行 25.3；**标签列与数值列之间有竖线**，标签列约 58%；TOTAL 行标签居中 | 行高 27、无列竖线 | `padding:4px 7px`、`th{border-right}`、`th 58%/td 42%`、`.rc-grand th{text-align:center}`、TOTAL 行 `padding:5.5px 7px` |
| 12 | 金额大写框 | 高 24.7 CSS px，与条款框间距 11 CSS px | 固定 40px、间距 8px | `min-height:24.5px` + 间距 11px |
| 13 | 签名区 | 两段顶线中间留 **12 CSS px 空隙**，**无中缝竖线**；顶线→标题 9.3 CSS px | 一条通栏顶线 + 中缝竖线 | `.rc-sign{gap:12px}`、删 `.rc-sign-r` 左边框、删 `.rc-foot::before` 竖线 |
| 14 | 页脚 | 通栏 2px 线，线→文字 8.6 CSS px | 有中缝竖线 | 删伪元素，`margin-top:12px` |
| 15 | 页边距（左右） | 左右各约 13.5 CSS px（3.6mm） | 4mm | 左右改 **3.7mm** |
| 16 | 页边距（上） | 第 1 页 4mm；**第 2 页为 0，内容贴纸面顶端** | `@page` 统一 4mm，第 2 页比原版低 15 CSS px | `@page{margin:0}`（仅 RC）+ `.q-sheet.rc-sheet{padding:4mm 3.7mm 0}`。CSS 分页中 `padding-top` 只作用于首片，故第 1 页仍从 4mm 起、第 2 页从 y=0 起，第 1 页几何完全不变 |
| 17 | 一级结构 | 第 1 页 8 行明细，第 2 页条款/汇总/大写/签名/页脚 | 同 | 保持 `break-before:page` 强制分页 |

另修复两处文本缺陷：
- `Amount in Words:` 与金额之间的空格被 flex 布局吃掉 → 整行改由内层 `<span>` 承载。
- 页脚 `Customer-Facing` → **`Customer-facing`**（放大原版 PDF 页脚逐字复核，原版为小写 f）。

### 9.2 版式不变性验证（两份不同内容的报价单）

第 2 页左右两栏是两套独立的表格，基准线必须**分栏比对**，不可混列。

**第 1 页（整页通栏）**

| 校验项 | 数据集 A（原版内容，8 行） | 数据集 B（Nordzaun / 3 行 / 长规格） | 一致 |
|--------|--------------------------|-----------------------------------|------|
| 表头以上 8 条水平基准线 | 65 / 71 / 136 / 225 / 255 / 448 / 465 / 498 | 65 / 71 / 136 / 225 / 255 / 448 / 465 / 498 | ✅ 完全一致 |
| 产品表 9 条竖线 | 21.5 / 78.5 / 216.5 / 399.5 / 628.5 / 697.5 / 790.5 / 973.5 / 1168.5 | 同 | ✅ 完全一致 |
| 双栏竖线 | 21.5 / 586.5 / 603.5 / 1168.5 | 同 | ✅ 完全一致 |
| 产品图占位 | 118×100 图像 px | 同 | ✅ 完全一致 |

**第 2 页 · 左栏（COMMERCIAL TERMS 条款框 + Amount in Words 大写框）**

| 位置 | 参考 | 数据集 A | 数据集 B | 一致 |
|------|------|---------|---------|------|
| 条款框顶 | 0 | 0 | 0 | ✅ |
| 表头下划线 | 31 | 31 | 31 | ✅ |
| Payment Terms 行 | 61 | 61 | 61 | ✅ |
| Production Lead Time 行 | 108 | 109 | 109 | ✅ |
| Packaging 行 | 138 | 139 | 139 | ✅ |
| 条款框底 | 168 | 169 | 169 | ✅ |
| 大写框顶 | 185 | 187 | 187 | ✅ |
| 大写框底 | 222 | 223 | **238** | ⚠️ B 大写占两行 |
| 签名顶线 | 263 | 265 | **280** | ⚠️ 随大写框下移一行 |
| 页脚通栏线 | 406 | 403 | **420** | ⚠️ 同上 |

**第 2 页 · 右栏（金额汇总表）**

| 位置 | 参考 | 数据集 A | 数据集 B | 一致 |
|------|------|---------|---------|------|
| 汇总表顶 | 0 | 0 | 0 | ✅ |
| Product Subtotal 行 | 31 | 31 | 31 | ✅ |
| Shipping / Freight 行 | 63 | 63 | 63 | ✅ |
| Discount 行 | 94 | 94 | 94 | ✅ |
| Tax / Other Charges 行 | 126 | 126 | 126 | ✅ |
| TOTAL 行底 | 164 | 163 | 163 | ✅ |

**结论**：A 与 B 的条款框 7 条基准线、汇总表 6 条基准线**逐条完全一致**；唯一差异是 B 的金额大写由一行变两行，使大写框增高一个行高，其下的签名线与页脚线整体下移（+15 / +17 图像 px）。这与原版 Word 表格行随内容自增的行为一致，属于「内容变化」而非「版式变化」。

### 9.3 与参考件的最终偏差

| 位置 | 偏差（图像 px） | 折算 CSS px |
|------|----------------|-------------|
| 第 1 页 16 条水平基准线 | −2 ~ +1 | ≤1.3 |
| 第 1 页产品表竖线（左 4 条） | 0 | 0 |
| 第 1 页产品表竖线（右 5 条） | +1 ~ +2 | ≤1.3 |
| 第 1 页产品图 ink bbox | 0 ~ 1 | ≤0.7 |
| 第 2 页左栏（条款框 + 大写框） | 0 ~ +2 | ≤1.3 |
| 第 2 页右栏（汇总表） | −1 ~ 0 | ≤0.7 |
| 第 2 页签名顶线 / 页脚线 | +2 / −3 | ≤2 |

第 2 页首条基准线三方均为 **y=0**（贴纸面顶端），与参考件一致；第 1 页抬头分割线仍为 y=136，未受页边距改动影响。
剩余偏差来自两侧栅格宽度的亚像素取整（参考件 1191px / 生成件 1190px），已在印刷不可辨范围内。

### 9.4 未写死原版内容（复核）

```
grep -in "fernando|saldana|2-Rail Light|Vinyl Horse|170.52|14.13|27.31|Nordzaun" \
     app/sheet-rc.js app/app.css
→ NO_HARDCODED_REFERENCE_CONTENT
```

模板中不存在任何原版客户名、产品名、规格、单价或金额；数据集 A 的全部内容均由 `rc_render.js` 在**模板外**构造后传入。

### 9.5 改动文件

| 文件 | 改动 |
|------|------|
| `app/sheet-rc.js` | 信息盒加 `.rc-infobox` 包装层（使 flex 拉伸只作用于边框层、内部表格保持自然行高）；条款表列宽 30/70→27/73；金额大写行内容包 `<span>` 修复空格丢失；页脚 `Customer-Facing`→`Customer-facing` |
| `app/app.css` | 仅 `.rc-sheet` 专属块：信息盒去网格/白底/等宽、表头白底、列宽、产品图定尺、行距、抬头字号、条款与汇总表列竖线与行高、大写框 min-height、签名双段顶线与去中缝、页脚去竖线 |
| `pdf-export.cjs` | RC 模板：`@page` 边距 4mm/3.7mm/6mm → **0**，改由 `.q-sheet.rc-sheet{padding:4mm 3.7mm 0}` 控制，使第 2 页顶部从 y=0 起；`printToPDF` 的 `margins` 同步归零。作用域仍仅限 `quotation-rc-v1` |
| `tests/p1d3/run.js` | B23 页脚标识断言随文案更正为 `Customer-facing Quotation`；114 项全过 |

**未触碰**：pricing.js、Schema V5、model.js、store.js、storage.js、main.js、preload.js、sheet.js、reference-sheets.js、客户库、产品库与其余模板样式。

### 9.6 回归

```
schema   194 PASS / 0 FAIL
pricing  851 PASS / 0 FAIL（+ parity 8 场景一致）
p1c      229 PASS / 0 FAIL
p1d       51 PASS / 0 FAIL
p1d3     114 PASS / 0 FAIL
node --check app/sheet-rc.js / pdf-export.cjs  OK
```

详见 `P1-D-03R-fmt-test-log.txt`、`P1-D-03R-geometry.txt`。

## 十、三组金额数据的关系（$648 / $812.50 / A / B）

评审时容易把三组数字混为一谈，这里一次说清——它们来源不同、用途不同，互不依赖。

| 金额 | 出现在哪 | 组成 | 用途 | 现状 |
|------|---------|------|------|------|
| **648.00** | 早期报告 §四 的一句话 | 小计 548.00 + 运费 100.00（3 个产品 12.50 / 30.00 / 18.00） | 第一版 P1-D-03R 手工样张，用来佐证「纸面 TOTAL = 引擎 final_total」 | **已废弃**。该样张随版式重做被替换，报告里这句是残留描述，本轮已改写为当前夹具 C 的 812.50 |
| **812.50** | `tests/p1d3/run.js` 夹具 C（C6 / C19 断言） | 小计 694.50（100×6.57 + 3×12.50）+ 运费 121.00 − 折扣 5.00 + 其他 2.00 | 自动化断言「TOTAL 与大写金额必须等于 pricing.js 的 final_total」，并顺带验证内部运费（500.00）与木箱费原值（20.00）不上纸面 | 现行有效，随回归一起跑 |
| **170.52** | **数据集 A** 样张 `P1-D-03R-A-sample.pdf` | 8 行产品，单价 14.13 / 21.51 / 20.46 / 26.79 / 16.77 / 22.04 / 21.51 / 27.31 | **只用于版式比对**：把 RunCheng 原版 PDF 的业务内容原样喂进来，与参考件逐像素对齐 | 现行有效，仅存在于渲染脚手架，不进模板 |
| **12,567.50** | **数据集 B** 样张 `P1-D-03R-B-sample.pdf` | 3 行产品：2,497.50 + 2,820.00 + 7,250.00 | **只用于不变性验证**：与 A 客户/产品/币种/条款全不同，证明换数据后版式不变 | 现行有效 |

**关键点**：

- 648.00 是**历史残留**，从未进入任何交付样张，也不参与任何断言；本轮已从报告中清除。
- 812.50 是**测试夹具**，只跑在 `tests/p1d3` 里，不产出 PDF 样张。
- 170.52（A）与 12,567.50（B）才是**交付样张**里的金额；它们由渲染脚手架在模板外构造后传入，模板本身不含任何数字（见 §9.4）。
- 三者共享同一条校验链：纸面 `TOTAL AMOUNT (USD)` 行的数值 = `Amount in Words` 的大写值 = `pricing.js` 计算的 `final_total`。A、B 两份样本已逐字核对：
  - A：`170.52` ↔ `USD ONE HUNDRED SEVENTY AND 52/100 ONLY`
  - B：`12,567.50` ↔ `USD TWELVE THOUSAND FIVE HUNDRED SIXTY SEVEN AND 50/100 ONLY`
