# P1-D-04 分页还原 · 验收记录

**轮次**：P1-D-04 最终修正（只处理 PDF 分页，不改业务代码/定价/Schema/LOGO）
**日期**：2026-11-21
**结论**：取消 `.rc-bottom` 的强制分页后，2 行明细的五类样张全部 **1 页**，
商业条款 / 金额汇总 / 金额大写 / 双签名 / 页脚**紧接产品明细表**，
纵向顺序与原版 RunCheng 一致；8 行明细时**自然分页**为 2 页，第 2 页仍从纸顶 Y=0 开始，条款块完整不拆半。
回归 1439/1439、E2E 180/180、5 份 PDF 机器校验 0 问题，A4 预览截图逐字节未变。

---

## 一、改动（只动 `app/app.css` 一行）

```diff
-/* 5. 条款（左）+ 金额汇总（右）并排；左右比例与间隔按原版实测 403:351 + 11px */
-.rc-sheet .rc-bottom { display: flex; gap: 11px; margin-top: 0; align-items: flex-start; break-before: page; page-break-before: always; }
+/* 5. 条款（左）+ 金额汇总（右）并排；左右比例与间隔按原版实测 403:351 + 11px。
+ * P1-D-04 分页还原：不强制另起一页——条款/汇总/大写/签名/页脚随明细表正常文档流排布，
+ * 内容能容纳时与明细表同页；仅当块整体放不下时由 break-inside:avoid 自然推到下一页。 */
+.rc-sheet .rc-bottom { display: flex; gap: 11px; margin-top: 0; align-items: flex-start; }
```

* **保留**的防拆分规则：`app/app.css:618` 的
  `.rc-sheet .rc-items tr, .rc-sheet .rc-total tr, .rc-sheet .rc-terms tr, .rc-sheet .rc-info tr,`
  `.rc-sheet .rc-sign, .rc-sheet .rc-words, .rc-sheet .rc-bottom { break-inside: avoid; }`
  以及 `.rc-sheet .rc-items thead { display: table-header-group; }`（跨页重复表头）。
* 全工程其它强制分页点：`app/app.css:451` 的 `.q-sign { break-before: avoid; }` 属于**基础版**（`.q-sign`，非 RC），
  且 `avoid` 不是强制断页；RC 版式现在**没有任何 `break-before: page` / `page-break-before: always`**。
* 本轮**未改**：定价公式、业务数据、客户快照、Schema V5、LOGO、`sheet-rc.js` 的 HTML 结构、签名/页脚样式。
  完整差异见 `P1D04-code-diff.patch` 与根 `CHANGE-VS-BUGACC01.txt`。

---

## 二、改前 / 改后（同一份 5 类样张，生产导出通道重新导出）

| 类型 | 改前页数 | 改后页数 | 改后第 1 页里包含的尾段 | 条款块距明细表头 |
|---|---|---|---|---|
| QT | 2 | **1** | Commercial Terms / 金额汇总 / Amount in Words / 双签名 / 页脚 | 210 CSS px |
| PI | 2 | **1** | 同上（含 Bank Details） | 210 CSS px |
| SC | 2 | **1** | 同上（含 Terms & Conditions / HS CODE） | 209 CSS px |
| CI | 2 | **1** | 同上（含 Shipment / Vessel / Bank Details） | 210 CSS px |
| PL | 2 | **1** | PACKING & SHIPPING / 包装汇总 / 双签名 / 页脚（**无金额、无大写**） | 210 CSS px |

> 209–210 CSS px 正好等于 2 行明细（行高 93px × 2 + 表头）的高度，说明条款块**紧贴**明细表，
> 中间没有空白、也没有被强制推到下一页。纵向顺序由 `P1D04-pagination.json` 逐项断言：
> `PRODUCT NAME → 条款块 → 汇总 → Amount in Words（PL 无）→ For the Seller → 页脚`，严格递增。

**改前对照截图**：`screenshots/pagination-before-QT-p1.png` / `-p2.png`（第 2 页只有尾段，第 1 页大量留白）。
**改后截图**：`screenshots/pdf-{QT,PI,SC,CI,PL}-p1.png`、`screenshots/format-uniform-five-types-p1.png`。

### 五类改后几何（`P1D04-geometry.txt`）

| 类型 | 页数 | A4 | left | top | 右余量 | 页脚下方留白 |
|---|---|---|---|---|---|---|
| QT / PI / SC / CI / PL | 各 1 | 209.9×297.0 mm | 3.7 mm | 4.9 mm | 3.4 mm | 108–378 CSS px |

每页首行墨迹、左列墨迹、右余量与改前**完全一致**（版式骨架未动，只是尾段回到第 1 页）；
页脚均在纸内，未裁切、未溢出。

---

## 三、自然分页验证（真实内容超过一页时允许）

为验证「不是把强制分页换成硬塞一页」，在同一隔离库副本里把 QT 明细从 2 行扩到 **8 行**
（与原版 RunCheng 报价单同为 8 行），走**同一个生产导出通道**导出
`pagination/QT-LONG-8ITEMS.pdf`（仅测试用，不是交付的业务单据）：

| 项 | 结果 |
|---|---|
| 页数 | **2 页**（自然溢出，不是强制断页） |
| 第 1 页 | 8 行明细全部可见，表格底边完整画出，无条款块 |
| 第 2 页 | `COMMERCIAL TERMS` 整块从纸顶开始，其后依次金额汇总 / Amount in Words / 双签名 / 页脚 |
| 第 2 页顶部 | 首行墨迹 **0 px = 0.0 mm**（与原版一致） |
| 第 2 页区块距本页顶 | 条款 15.5 / 汇总 102.5 / 大写 165.5 / 签名 220.5 / 页脚 305.5 CSS px，顺序严格递增 |
| 左 / 右几何 | left 3.7 mm / right_gap 3.5 mm |

截图：`screenshots/pagination-long-QT-p1.png`、`screenshots/pagination-long-QT-p2.png`。

---

## 四、与原版 RunCheng 对照

原版 `Mexico-fernando_saldana-马场围栏-QUOTATION-20261119.pdf` 本身是 **2 页**，
原因是它有 **8 行明细**恰好填满第 1 页，条款/汇总/大写/签名/页脚自然溢到第 2 页，
且第 2 页顶部从 Y=0 开始——**不是强制断页**。参考截图：
`screenshots/pagination-ref-original-p1.png`、`-p2.png`。

| 项 | 原版 | 本轮改后 2 行样张 | 本轮 8 行自然分页 |
|---|---|---|---|
| 页数 | 2（8 行明细自然溢出） | 1（内容容纳得下） | 2（自然溢出） |
| 第 1 页 top | 4.6 mm | 4.9 mm | 4.9 mm |
| 第 2 页 top | 0.0 mm | 无第 2 页 | **0.0 mm** |
| 条款块位置 | 第 2 页纸顶 | 第 1 页紧贴明细表 | 第 2 页纸顶 |

即：**能放下就同页，放不下才自然分页**，这正是本轮要还原的行为。

---

## 五、回归与交付物复验

| 项 | 结果 |
|---|---|
| Schema V5 | **194 / 194** ALL PASS |
| Pricing | **851 / 851** ALL PASS |
| P1-C | **229 / 229** ALL PASS |
| P1-D | **51 / 51** ALL PASS |
| P1-D-03 | **114 / 114** ALL PASS |
| 合计 | **1439 / 1439**，FAIL 0（`P1D04-regression-full.log` + 5 份逐条日志） |
| Electron E2E | **180 / 180**（S1–S10，全新隔离 userData 重新播种，`P1D04-e2e-full.log` / `-result.json`） |
| 5 份 PDF 机器校验 | `ok=true`、`problems=[]`、pages 均为 1、left/top/right 一致（`P1D04-pdf-verify.json`） |
| 分页专项校验 | `ok=true`、`problems=[]`（`P1D04-pagination.json`，脚本 `P1D04-verify-pagination.py`） |
| LOGO 溯源 | `ok=true`，模板内嵌 LOGO 与原版 `IM8.jpg` 逐字节相同（`P1D04-verify-logo.json`） |
| A4 预览未变 | 5 张 `screenshots/preview-*.png` 复跑后与改前**逐字节相同**（CSS 改动只作用于打印/分页，屏幕预览不受影响） |
| 业务代码保护 | `app/pricing.js`、`main.js`、`preload.js`、`storage.js`、`store.js` 与基线包逐字节相同；Schema V5、LOGO、定价公式零改动 |

---

## 六、复跑方式

```bash
cd docs/integration/p1d04
python P1D04-verify-pagination.py     # 分页专项（需 pypdf + pypdfium2 + Pillow）
python P1D04-verify-pdf.py            # 五份 PDF 通用机器校验
python P1D04-verify-logo.py           # LOGO 溯源（原版 PDF 可用 P1D04_ORIGINAL_PDF / P1D04_ORIG_PDF 指定）
```

* `P1D04-verify-pagination.py` 默认读本目录 `pdf-samples/` 与 `pagination/QT-LONG-8ITEMS.pdf`；
  可用 `P1D04_PDFDIR`、`P1D04_LONG_PDF` 覆盖。脚本输出确定（无时钟戳），默认参数下与包内
  `P1D04-pagination.json` 逐字节一致；指定 `P1D04_ORIGINAL_PDF=<原版 PDF>` 时会在 `reference` 段
  附带原版第 2 页顶部测量（默认不带，因为原版 PDF 不在交付包内；其几何数据已固化在 `P1D04-geometry.txt`）。
* 五份正式 PDF 与 8 行分页样张均由 `P1D04-pdf-runner.cjs`（生产导出通道）产出；
  8 行样张是在隔离 userData 副本里扩行生成，未改动交付的 5 份业务单据，也不计入 E2E 断言。
* E2E 日志与结果 JSON 为冻结产物：复跑需 E2E 驱动与 Electron 本体，会生成新的耗时/时间戳，
  验收请以包内文件为准；复跑后请重算 `P1D04-SHA256SUMS.txt`。

---

## 七、坐标检测修正版（最终交付轮）

> 本轮**只修验收工具、只做交付**，未改任何业务代码：不动 `app/app.css`、`app/sheet-rc.js`、
> PDF 模板、`pricing.js`、Schema V5、数据库及生产数据；未重新导出 5 份 PDF、未重新设计报价单。

### 7.1 问题与根因

上一版 `P1D04-verify-pagination.py` 用 **pypdf** 的 `visitor_text(..., tm)` 回调里的 `tm[5]`
当文字纵坐标。该值是**文本矩阵的变换量，不是页面内绝对坐标**：在多页 PDF 里会跨页累加
（第 2 页曾读到 1138 / 1225 / 1428 等超出页高的数值），换一份 PDF 或换一个 pypdf 版本就给出
错误位置，导致五份样张被误报；旧脚本再用固定的 `v - PAGE_H_CSS` 人工折算第 2 页，等于用固定偏移猜坐标，同样不可靠。

### 7.2 修正方式（不写死坐标、不跳过断言、不降低标准）

全部位置改用 **pypdfium2 的真实字符边界框**：

| 项 | 实现 |
|---|---|
| 页面尺寸 | `PdfPage.get_size()`（PDF 点，A4 实测 594.96 × 841.92 pt） |
| 逐字符文本 | `PdfTextPage.count_chars()` + `get_text_range(0, n)` |
| 字符边界 | `PdfTextPage.get_charbox(i)` → `(left, bottom, right, top)`，左下原点、**页面内绝对坐标、不跨页累加** |
| 纵向换算 | `y_top_css = (page_height_pt - charbox_top) * 96/72` |
| 短语匹配 | 文本与检索词同时去空白字符，命中字符下标映射回真实边界框求并集（解决 `TOTALAMOUNT (USD)` / `TOTAL AMOUNT` 的空格差异） |
| 边距 / 纸顶 | `render(scale=2).to_pil()` 逐像素墨迹扫描，`px → mm = px / 2 / 72 * 25.4` |

输出 `method.fixed_coordinates_used=false`、`method.assertions_skipped=false`；
`GAP_EXPECT_CSS=208.5 / GAP_TOL_CSS=12.5` 只是**验收容差带**，实际坐标一律现算。
失败信息统一走 `bad(具体 PDF, 页码, 原因, 实测坐标)`，负向对照见 `P1D04-pagination-test.log` §4。

### 7.3 复验结果

| 项 | 结果 |
|---|---|
| 五类正式 PDF | 5/5：各 1 页 A4；明细→条款/包装→汇总→大写→双签名→页脚同页且顺序严格递增；PL 金额字样命中全 0 |
| 明细→条款间距 | `208.9, 208.9, 208.9, 208.9, 207.9` CSS px（容差 196.0–221.0，与原验收 208–209 一致） |
| 8 行自然分页 | 2 页；第 1 页 8 行 y=`359.1…1010.1`、行距 93.0；第 2 页 `text_top=7.4 CSS px`、首行墨迹 `0 px = 0.0mm`；尾段完整不拆分 |
| JSON 确定性 | 默认参数连跑两次 stdout 逐字节相同，SHA-256 `933596a61012390207d4560f320080f5c34a299081c0ecdba423fb6bf82c5d13`，无 `generatedAt` / 时钟戳 |
| 负向对照 | 空样张目录 / 1 页 QT 冒充 8 行样张 / 间距容差收紧到 0.1 —— 三次均 `exit=1`，且报错含具体 PDF、页码、实测坐标 |
| 业务代码 | 16 个业务代码文件与 P1-D-04 基线逐字节一致；写回证据前工作副本相对基线仅验收脚本 1 个差异，最终包逐文件明细见根 `FINAL-DIFF-VS-P1D04-BASELINE.txt` |

机器结果 `P1D04-pagination.json` 即脚本 stdout 原始字节；专项日志 `P1D04-pagination-test.log`
为确定性文本（无时钟戳、无随机临时路径）。

### 7.4 独立解压环境复跑

```bash
cd <任意独立解压目录>
sha256sum -c SHA256SUMS.txt                         # 工程根执行，366 条全 OK（清单内路径相对工程根）
cd docs/integration/p1d04
sha256sum -c P1D04-SHA256SUMS.txt                   # 本目录执行，62 条全 OK
python P1D04-verify-pagination.py > /tmp/out.json   # 需 pypdfium2 + Pillow
cmp /tmp/out.json P1D04-pagination.json             # 应逐字节一致，exit=0
```

脚本按自身位置定位 `pdf-samples/` 与 `pagination/`，不含任何本机绝对路径；
也可用 `P1D04_PDFDIR` / `P1D04_LONG_PDF` / `P1D04_ORIGINAL_PDF` 覆盖。
本轮交付包为 `siwang-box-p1d04-final-20261121.zip`，**原始 `siwang-box-p1d04-20261121.zip` 保持不变**。
