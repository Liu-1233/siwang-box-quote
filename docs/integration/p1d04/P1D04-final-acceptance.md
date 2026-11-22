# P1-D-04 最终验收核对表（交付前逐项核实）

**阶段**：P1-D-04 最终验收准备 + 交付修正 + **分页还原**（本轮只处理 PDF 分页，业务功能未扩范围）
**基线**：`siwang-box-fix-BUGACC01-20261121.zip`
**工程**：`siwang-box-main/`，产品版本 siwang-box-desktop 0.2.17
**日期**：2026-11-21

> 相对基线包，代码改动仍只有 P1-D-04 的 9 个文件（+301 / −169；本轮只在 `app/app.css` 内
> 删除 `break-before:page` 与 `page-break-before:always` 两个分页属性）。
> 本轮新增的全部是分页/回归证据与重算后的交付物，见 `P1D04-pagination.md` 与 `CHANGE-VS-BUGACC01.txt`。

---

## 一、交付物索引（对应你要求的 6 项）

| # | 要求 | 交付物 | 位置 |
|---|---|---|---|
| 1 | 完整工程 ZIP 和 SHA-256 | `siwang-box-p1d04-20261121.zip`（**365 条目**）+ 侧车 `…zip.sha256`；包内另有全包清单 `SHA256SUMS.txt`（**364 条**，`sha256sum -c` 全 OK） | 工程根 |
| 2 | QT/PI/SC/CI/PL 五份实际导出 PDF | `pdf-samples/QT-QT-202611-0001.pdf` 等 5 份（生产导出通道产出；**分页还原后各 1 页**，尾段与明细表同页） | `docs/integration/p1d04/pdf-samples/` |
| 3 | 1439 项回归原始日志 | `P1D04-regression-full.log`（含各套件原始汇总行）+ `P1D04-regression-{schema,p1c,p1d,p1d3,pricing}.log`（五套逐条输出） | `docs/integration/p1d04/` |
| 4 | 180 项 Electron E2E 原始日志 | `P1D04-e2e-full.log`（10 个场景全量输出）+ `P1D04-e2e-result.json`（机器可读逐条断言，去时钟戳） | `docs/integration/p1d04/` |
| 5 | 五类页面截图 + 几何验收记录 | `screenshots/preview-{QT,PI,SC,CI,PL}.png`（应用内 A4 预览，复跑后逐字节未变）、`pdf-*-p1.png`（5 张）、`pagination-{before,long,ref-original}-*.png`（改前/自然分页/原版对照）、`format-uniform-five-types-p1.png`；`P1D04-geometry.txt` | `docs/integration/p1d04/` |
| 6 | 完整代码差异清单 | `P1D04-code-diff.patch`（统一 diff，含本轮 `app.css` 改动）+ `CHANGE-VS-BUGACC01.txt` | `docs/integration/p1d04/`、工程根 |
| + | **分页还原验收** | `P1D04-pagination.md`（改前/改后/自然分页/原版对照）、`P1D04-pagination.json`、`P1D04-verify-pagination.py`、`pagination/QT-LONG-8ITEMS.pdf`（8 行自然分页样张） | `docs/integration/p1d04/` |

---

## 二、七项核实结论

### ① 五类单据均默认使用 RunCheng 统一版式 ✅

**方法**：在真实应用内（隔离 userData）对五类各调用 `Doc.newDraft()`，读「声明模板 / 生效模板 / 编辑器下拉首项」，
再逐张检查已落库单据的纸面 `data-template`。证据：`P1D04-verify-default-template.json`（18 项断言，0 失败）。

| 类型 | 新建声明 | 生效模板 | 编辑器下拉首项 | 下拉完整列表 |
|---|---|---|---|---|
| QT | `quotation-rc-v1` | `quotation-rc-v1` | `quotation-rc-v1` | 统一版式 / 基础单据版 / 贸易版 |
| PI | `quotation-rc-v1` | `quotation-rc-v1` | `quotation-rc-v1` | 统一版式 / 基础单据版 / 参考文件：JR形式发票 / 旧贸易版 |
| SC | `quotation-rc-v1` | `quotation-rc-v1` | `quotation-rc-v1` | 统一版式 / 基础单据版 / 贸易版 |
| CI | `quotation-rc-v1` | `quotation-rc-v1` | `quotation-rc-v1` | 统一版式 / 基础单据版 / 贸易版 |
| PL | `quotation-rc-v1` | `quotation-rc-v1` | `quotation-rc-v1` | 统一版式 / 基础装箱单 / 参考文件：装箱单 / 参考文件：唛头 |

* 已落库 9 张单据（含 4 张转换件）`stored / effective / paperTemplate` **三者全为 `quotation-rc-v1`**。
* 存量未声明模板的单据也不回落基础版（`P1D04-verify-fields.json` §⑤：删掉 `_unknown` 后仍出 `data-template="quotation-rc-v1"`）。
* 「基础单据版」显式选择能力未被剥夺（同文件 `explicitBasicStillWorks=true`）。

### ② 使用真正的 RunCheng LOGO ✅

**方法**：把模板内嵌的 `DEFAULT_LOGO` 与你提供的原版 PDF `Mexico-fernando_saldana-马场围栏-QUOTATION-20261119.pdf`
里的图片逐张做 SHA-256 比对；再把本轮导出 PDF 里的 LOGO 与原版做像素比对。证据：`P1D04-verify-logo.json`。

| 对象 | 字节数 | SHA-256 |
|---|---|---|
| 模板 `app/sheet-rc.js` 内嵌 `DEFAULT_LOGO` | 21,033 | `e75a8bb71cfb9e51f388aeb0c51116390ebc0560ab49c1a567e98b0171810627` |
| 你提供的原版 PDF 内 `IM8.jpg` | 21,033 | **同上（逐字节相同）** |
| 本轮导出 QT PDF 内 `X4.jpg` | 21,029 | `f5e7de18…`，638×401，与原版**最大通道差 7/255、显著差异像素 0 个（0.000%）** |

* 结论：模板用的就是**你原版 PDF 里那张 LOGO 的原始字节**；导出时的 4 字节差异来自 Chromium `printToPDF` 对 JPEG 的重编码，
  像素层面无可见差异（不是换了图）。
* 排除占位图干扰：隔离库 `settings.sellerLogo` 为空字符串 → 本轮样张的 LOGO **只可能**来自模板内嵌原版 JPEG。
* 未重新制作 LOGO、未使用任何占位图（`tests/p1d3` H11a/H11b 同向断言也通过）。

### ③ 各类单据内容和字段没有混用 ✅

**方法（两层）**：
1. **渲染层**：用同一份数据渲染五类，逐类断言「该有的都在」（must）＋「别类的都不许出现」（mustNot）。
   证据 `P1D04-verify-fields.json` §①：QT 11+12 项、PI 9+8 项、SC 11+6 项、CI 12+5 项、PL 12+11 项，**全部 OK**。
2. **PDF 层**：对 5 份真实 PDF 抽取文本做同样断言。证据 `P1D04-pdf-verify.json`：五份的
   `missing` 与 `unexpected` 均为空。

| 类型 | 必须有（示例） | 必须没有（示例） |
|---|---|---|
| QT | QUOTATION、UNIT PRICE、AMOUNT、TOTAL AMOUNT、Amount in Words、Production Lead Time | HS CODE、PACKAGES、CBM、Shipment、Vessel、Contract Terms、Sign Place、Packing & Shipping、Bank Details |
| PI | PROFORMA INVOICE、PI No.、Bank Details、Validity | HS CODE、CBM、Shipment、Vessel、Contract Terms、Sign Place、Packing & Shipping |
| SC | SALES CONTRACT、Contract No.、Sign Date/Place、HS CODE、Terms & Conditions、Bank Details | CBM、Shipment、Vessel、Port of Origin、Packing & Shipping |
| CI | COMMERCIAL INVOICE、Invoice No.、HS CODE、Shipment、Vessel / Voyage、Port of Origin、Bank Details | CBM、Contract Terms、Sign Place、Packing & Shipping |
| PL | PACKING LIST、PL No.、PACKAGES、N.W.(KG)、G.W.(KG)、CBM、Packing Mode、Shipping Marks | UNIT PRICE、AMOUNT、TOTAL AMOUNT、Amount in Words、HS CODE、Bank Details、Contract Terms、Shipment、Vessel |

### ④ 产品图片 / 客户信息 / 银行信息来自实际数据，不是写死 ✅

**方法 A（反向：模板源码零硬编码）**：在 `app/sheet-rc.js` 里扫 16 个具体业务字面量——
客户名 `Fernando` / `Saldana` / `Fence Solutions`、银行 `Bank of China` / `BKCHCNBJ`、HS `3925900000`、
单价 `14.13` / `26.79`、总额 `55.05`、地址 `Reforma`、港口 `Manzanillo`、船名 `MSC ARIES`、
卖方全称与邮箱电话——**命中 0 个**。唯一允许的图片字面量是 `DEFAULT_LOGO`（原版 LOGO 本体）。
证据 `P1D04-verify-fields.json` §③。

**方法 B（正向：改写即变化）**：同一份单据改 5 个字段后重新渲染，纸面必须跟着变且旧值消失：
客户公司名、银行信息、规格、单据号、第 1 行产品图——`customerSwapped / bankSwapped / specSwapped /
docNoSwapped / imageSwapped` **全部 true**，HTML SHA-256 由 `3385216377e7ca1a` 变为 `f5ad6f2e31e75d74`。
证据同上 §②。

**方法 C（PDF 层溯源）**：导出 PDF 里的两张产品图与单据数据里的 `productImage` 原图做像素比对：
`img3.jpg (495×432) → X9.jpg` 最大通道差 **3**；`img2.jpg (451×451) → X11.jpg` 最大通道差 **4**，
同一张图（JPEG 重编码容差内）。证据 `P1D04-verify-logo.json` `productImages`。

**客户/银行字段的落库形态**：客户只走单据快照（`doc.customer`）与 `doc.buyerAddress`；银行走 `doc.bank` 多行文本，
纸面按单据快照印，**不读设置页、不读客户库实时值**——所以历史单据不会随客户资料变化（P1-D-02 既定边界，未改）。

### ⑤ PL 不显示单价和金额 ✅

**方法（三层）**：
1. 渲染层可见文本扫 `UNIT PRICE / AMOUNT / TOTAL AMOUNT / Amount in Words / $ / USD / ¥ / €` → **命中 0**，
   且纸面不含任何行金额（`14.13` / `28.26` 均不出现）。证据 `P1D04-verify-fields.json` §④。
2. PDF 层：`P1D04-pdf-verify.json` 中 PL 的 `unexpected: []`（`UNIT PRICE`、`AMOUNT` 等为 must_not 项）。
3. 结构层：PL 明细为十列 `NO. / PHOTO / PRODUCT NAME / SPECIFICATION / QTY / UNIT / PACKAGES / N.W.(KG) / G.W.(KG) / CBM`，
   右侧汇总为 `Total Packages / Total N.W. / Total G.W. / Total CBM`，**没有金额汇总，也没有 Amount in Words**。

### ⑥ 定价 / 利润 / 费用分摊 / 成交价保护没有回归 ✅

| 层面 | 证据 | 结果 |
|---|---|---|
| 引擎单测 | `tests/pricing/run-all.js` 851 项（26 项原始 ×3 环境 + 一致性 + 边界 ×3 环境） | ALL PASS |
| 应用集成 | `tests/p1c/run.js` 229 项（核价集成 / 费用分摊 / 九键剥离 / 成交价） | ALL PASS |
| 真机 E2E | S5 场景 **36 项**断言全过（见下） | 36/36 |

S5 关键断言原文：`S5-7 手改成交价不被覆盖`、`S5-7b 手改后 used_price 仍为成交价`、
`S5-7c 手改后建议价仍按成本计算（不反向污染）`、`S5-2c 订单费用降低纯利润 35.5/7.1`、
`S5-6c 提成 = 纯利润 × 提成率`、`S5-6d 公司利润 = 纯利润 − 提成`、
`S5-13 费用分摊随单落盘（按 rowId 对位）`、`S5-3 实际运费 = 213/7.1 + 40 = 70.00`、
`S5-8 成本未确认 → 不放行正式核价`、`S5-11 非 USD 币种停用自动核价`。

`app/pricing.js` 相对基线包 **0 改动**（`CHANGE-VS-BUGACC01.txt` 中无此文件）。

---

## 三、关键数字

| 项 | 数值 |
|---|---|
| 回归 | **1439 / 1439**（schema 194 / p1c 229 / p1d 51 / p1d3 114 / pricing 851），FAIL 行 0 |
| E2E | **180 / 180**（S1–S10，全新隔离 userData 重新播种） |
| 五份 PDF | **各 1 页 A4**（分页还原后，2 行明细完全容纳）；left **3.7mm** / top **4.9mm** / 右余量 **3.4mm**；页脚下方仍有 108–378 CSS px 留白 |
| 分页还原 | 条款/汇总距明细表头仅 **209–210 CSS px**；纵向顺序 明细→条款/汇总→大写→签名→页脚；8 行明细**自然分页** 2 页，第 2 页 top **0.0mm**（与原版一致） |
| 泄漏扫描 | 20 个内部核价字段 + 11 个模板字样，5 份 PDF 命中 **0** |
| 代码改动 | 9 文件，+301 / −169；本轮只在 `app.css` 删除 2 个强制分页属性；`pricing.js` / Schema V5 / `main.js` / `preload.js` / `storage.js` 未改 |
| 包内容 | **365 条目**（364 内容 + 清单自身）；相对基线包（300 条目）**287 项字节相同、10 项变化、68 项新增、3 项删除**（删除的 3 项即改名前的乱码 README，同内容以 ASCII 新名重新入包） |

---

## 四、如何复跑（评审用）

```bash
# 0) 解包
unzip siwang-box-p1d04-20261121.zip -d p1d04 && cd p1d04
sha256sum -c SHA256SUMS.txt                       # 364 条应全 OK，无告警
(cd docs/integration/p1d04 && sha256sum -c P1D04-SHA256SUMS.txt)   # 目录级 61 条

# 1) 1439 项回归（只需 node）
node tests/schema/run.js && node tests/p1c/run.js && node tests/p1d/run.js \
  && node tests/p1d3/run.js && node tests/pricing/run-all.js

# 2) 六项核实 —— 在交付目录内直接跑，脚本按自身位置定位工程根与 pdf-samples，不依赖固定盘符
cd docs/integration/p1d04
node P1D04-verify-fields.js      # 字段互斥 / 数据驱动 / 模板零硬编码 / PL 无金额 / 未声明模板
node P1D04-smoke-five-types.js   # 五类渲染冒烟
python P1D04-verify-pagination.py  # 分页专项：五类 1 页 + 8 行自然分页（本轮新增）
python P1D04-verify-logo.py      # LOGO 与产品图溯源（需 pypdf + Pillow）
python P1D04-verify-pdf.py       # 5 份 PDF 机器校验（需 pypdf + pypdfium2 + Pillow）
```

* `P1D04-verify-logo.py` 默认读本目录 `pdf-samples/` 与 `img2.jpg`/`img3.jpg`；**原版 PDF 默认路径在你本机桌面**，
  不存在时自动跳过「与原件字节比对」（其余检查照跑），可用 `P1D04_ORIG_PDF=<路径>` 指定。
* `P1D04-verify-pdf.py` 默认读本目录 `pdf-samples/`，可用 `P1D04_PDFDIR=<目录>` 覆盖。
* `P1D04-verify-default-template.js`（应用内默认版式核实）需要 E2E 驱动 `P1D04-e2e-driver.js` 与 Electron 工程本体，
  其结论已固化在 `P1D04-verify-default-template.json` / `.log`，评审可直接看结果。

---

## 五、边界与已知事项（如实披露，未擅自处理）

1. **SC/CI 的 HS CODE 在转换链上初始为空**：QT/PI 纸面没有 HS 列，转换按既有规则 `delete row.hsCode`，
   所以 QT→PI→SC→CI 传下来的 HS 是空值，纸面显示 `—`（不编造）。样张为便于验收由真实编辑器在隔离副本补值，
   属导出前置数据准备（`P1D04-prep-content.js`），不计入 180 项 E2E。
2. **A4 预览是连续纸面**：预览层不分页，五类内容紧接显示。**本轮取消 `break-before:page` 后，PDF 也改为按内容自然分页**：
   2 行明细样张 5 份均为 1 页，8 行明细才自然分成 2 页（第 2 页顶 0）。预览截图复跑后与改前**逐字节相同**，
   说明本轮 CSS 改动只作用于打印/分页，不影响屏幕预览。
3. **买方 `Email` / `Phone` 印 `—`**：Schema V5 的客户快照只有 company/contact/address/country，
   不含 email/phone；本轮未扩 Schema（守住「不改 Schema V5」）。
4. **导出 PDF 的 LOGO 与原版差 4 字节**：Chromium `printToPDF` 会重编码 JPEG，像素无可见差异（见 §二②）。
5. **本轮新增文件全部是分页/回归证据与重算后的交付物**：相对上一版只多了
   `P1D04-pagination.{md,json}`、`P1D04-verify-pagination.py`、5 份 `P1D04-regression-*.log`、
   6 张 `screenshots/pagination-*.png`、`pagination/QT-LONG-8ITEMS.pdf`；
   同时移除 5 张已作废的 `pdf-*-p2.png`（2 行样张不再有第 2 页）。业务功能代码零改动。
6. **包内文件集不含 `node_modules/`、`.git/`**，也不含 `docs/integration/fix-BUG-ACC-01/screenshots/` 下 7 张
   上一轮（BUG-ACC-01）冻结截图——它们属于上一轮目录，未纳入 P1-D-04 包的文件集。除此之外
   「解包后目录树」与 `siwang-box-main/` 工作树一致，可逐文件对拍。

---

## 六、交付修正记录（独立验收后的 4 点）

本轮**未改任何业务代码**，只修交付物自身的问题：

| # | 问题 | 根因 | 处理 | 复验 |
|---|---|---|---|---|
| 1 | 文档里的文件数量写错（341 / 340 / 40 / 350 / 48） | 数字手写，未随重打包同步 | 当时按实测改为 355 条目 / 根清单 354 条 / 目录清单 51 条；**本轮分页还原后为 365 / 364 / 61**，一律以清单头部为准 | 见 §三 与两个清单头部「文件数」 |
| 2 | `P1D04-SHA256SUMS.txt` 中 `P1D04-verify-fields.json` 哈希对不上 | 该脚本每次运行都写入 `generatedAt` 时间戳并**覆盖**结果文件，于是「解包 → 跑脚本 → 校验」必然失配 | 去掉时钟戳（输出确定）＋默认不落盘（`P1D04_WRITE=1` 才写），并重算全部清单 | 解包后跑脚本再校验：文件哈希不变；连跑两次 `P1D04_WRITE=1` 生成字节一致 |
| 3 | `P1D04-verify-logo.py` 硬编码 `E:/WorkBuddyProjects/...` | 调试期写死本机路径 | 改为从脚本自身位置向上查找含 `app/sheet-rc.js` 的目录（`P1D04_ROOT` 可覆盖），原版 PDF 缺失时自动跳过字节比对 | 换工作目录运行仍能定位工程根、读到内嵌 LOGO 字节 |
| 4 | 3 个 README 文件名是乱码，跨平台可能解包失败 | 历史遗留：UTF-8 字节被按 CP936 解码后又存成 UTF-8（双重编码） | 改为纯 ASCII 名（`README-DELIVERY-P1D03.md` / `README-SOURCE-0.2.17.md` / `docs/integration/baseline-0.2.17/README-baseline-0.2.17-smoke.md`），**内容逐字节未变**，旧名对照记入 `RENAME-README-MAP.txt` | 全工程非 ASCII 文件名 = 0；内容哈希与改名前的清单条目一致 |

修正后重新生成并复验：完整 ZIP、侧车 SHA-256、包根 `SHA256SUMS.txt`、`docs/integration/p1d04/P1D04-SHA256SUMS.txt`
全部重算；解包后两级 `sha256sum -c` 全 OK 无告警；1439 项回归与 5 份 PDF 机器校验结果与修正前**完全一致**。

> ZIP 自身的 SHA-256 只写在侧车文件 `siwang-box-p1d04-20261121.zip.sha256` 里：它若写进包内任何文档都会形成自指
> （文档 → 清单 → 包字节 → 包哈希 → 文档），无法自洽。侧车与包并列存放，评审可比对后自行留存。

---

## 七、本轮（分页还原）追加复验

| 项 | 结果 |
|---|---|
| 改动范围 | 仅 `app/app.css` 一行：删除 `.rc-bottom` 的 `break-before:page` / `page-break-before:always`；`break-inside:avoid` 全部保留 |
| 五类正式 PDF | 重新导出（生产通道），**2 行明细各 1 页**；条款/汇总/大写/签名/页脚与明细表同页 |
| 自然分页 | 8 行明细 QT 自然 2 页，第 1 页表格底边完整，第 2 页 top 0.0mm，条款块不被拆半 |
| 原版对照 | 原版 8 行报价单同为 2 页、第 2 页 top 0.0mm；本轮「能放下同页、放不下自然分页」与之相符 |
| 分页专项校验 | `P1D04-pagination.json`：`ok=true`、`problems=[]` |
| 回归 | 1439/1439（5 套逐条日志已补齐）；E2E 180/180（全新隔离 userData 重新播种） |
| PDF 机器校验 | `ok=true`、`problems=[]`；左/上/右几何与改前一致 |
| 保护项 | 定价公式、业务数据、客户快照、Schema V5、LOGO、`pricing.js`、`main.js`、`preload.js`、`storage.js` 均未改 |
| 交付物 | ZIP、侧车 SHA-256、两级清单、5 份 PDF、分页截图与验收记录全部重生成；解包后两级 `sha256sum -c` 全 OK |

详见 `P1D04-pagination.md`。

---

## 八、分页验收脚本坐标检测修正（最终交付轮）

**本轮唯一目标：修好验收工具，完成最终交付。** 未改任何业务代码、未重新导出 PDF、未重新设计报价单、
未进入 P1-D-05、未覆盖原始 P1-D-04 ZIP、未触碰生产 userData。

| # | 独立验收发现 | 处理 | 证据 |
|---|---|---|---|
| 1 | `P1D04-verify-pagination.py` 用 pypdf `tm[5]` 取纵坐标，是文本矩阵变换量而非页面绝对坐标，多页 PDF 跨页累加导致五份样张被误报 | 改用 **pypdfium2 `PdfTextPage.get_charbox(i)`** 真实字符边界框 + `PdfPage.get_size()`；`y_top_css=(page_height_pt-charbox_top)*96/72` | 脚本头注释、`P1D04-pagination.json` 的 `coordinateSource` / `conversion` / `method` |
| 2 | 不得靠写死坐标 / 跳过断言 / 降低标准让测试通过 | 容差带只作判据，坐标全部现算；输出 `fixed_coordinates_used=false`、`assertions_skipped=false`；负向对照三次均 `exit=1` 且点名 PDF+页码+坐标 | `P1D04-pagination-test.log` §3 / §4、`P1D04-pagination.md` §7.2 |
| 3 | JSON 需可重复、结果确定、无动态时间戳 | 默认参数连跑两次 stdout 逐字节相同，SHA-256 `933596a6…5d13`；`P1D04-pagination.json` = 脚本 stdout 原始字节 | `P1D04-pagination-test.log` §3 |
| 4 | 需证明业务代码与 P1-D-04 基线逐字节一致 | 16 个业务代码文件哈希全部一致；基线 365 条目中仅验收脚本 1 个内容差异；两级清单重算 | 根 `FINAL-DIFF-VS-P1D04-BASELINE.txt`、`P1D04-pagination-test.log` §5 |

最终复验（在独立解压目录执行）：

* 五类 PDF 分页校验 **PASS**（5/5，`ok=true`、`problems=0`）；8 行自然分页 **PASS**（2 页，第 1 页 8 行，第 2 页纸顶开始）；
* 坐标检测 **PASS**（间距 208.9 / 207.9 CSS px，与 208–209 一致）；JSON 确定性 **PASS**；
* 包根 `sha256sum -c SHA256SUMS.txt` 与目录 `sha256sum -c P1D04-SHA256SUMS.txt` 全 OK 无告警；
* 跑完脚本后再校验哈希，文件哈希不变；原始基线包 SHA-256 仍为
  `11a3016986896ef6dbee7e21fcd7d74c7aebc3efdbcded107f229399e3e49420`。

交付：`siwang-box-p1d04-final-20261121.zip` + 侧车 `.sha256`、包内两级清单、
`P1D04-verify-pagination.py`（修正版）、`P1D04-pagination.json`、`P1D04-pagination-test.log`、
`FINAL-DIFF-VS-P1D04-BASELINE.txt`（与原版逐文件差异报告）。
原始 `siwang-box-p1d04-20261121.zip` 与其侧车文件保持原样，未被覆盖。
