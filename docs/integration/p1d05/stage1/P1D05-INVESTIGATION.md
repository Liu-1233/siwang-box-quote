# P1-D-05 阶段一：只读调查结论与差异清单（Read-Only Investigation Report）

**状态 / Status**：调查完成，**按任务书要求先报告、暂停，未进入实施**（No implementation performed）
**日期 / Date**：2026-11-22
**范围 / Scope**：仅执行任务书「执行顺序」第 1、2 步（检查原版与现状 → 确认图片字段与取图规则）
**基线 / Baseline**：P1-D-04 正式上线版 `siwang-box-golive-0.2.17-20261121.zip`
（`f580d262f32b745cd736265d7e25b079283a45c08719e1fc79ea2e129a076810`）

---

## 0. 本轮遵守的约束 / Constraints honoured

| 约束 / Constraint | 状态 |
|---|---|
| 未修改任何业务代码、样式、PDF 模板 | ✅ 本轮 0 处源码改动 |
| 未修改 `app/pricing.js` / 冻结定价公式 / Schema V5 / 数据迁移 | ✅ 未触碰 |
| 未覆盖生产程序 `siwang-box-latest`、未操作生产 userData | ✅ 全程只读 |
| 未删除/覆盖/新增任何产品图片、未改历史报价单图片快照 | ✅ 未触碰 |
| 所有测试/截图使用隔离数据副本 | ✅ 隔离 UD：`E:/CDriveMigration/Temp/p1d05/ui/ud` |
| 未擅自用规格图冒充实物图 | ✅ 已识别并报告（见 §3） |

只读数据来源（Read-only sources）：
- 生产数据**备份**（非生产本体）：`GoLive-20261121/backups/prod-userdata/data/siwangbox-v4.json`
  （SHA-256 `eb48b3edda91742bc397e9490fb79ac3a3ba3900aa04c6bd0fb8e3cb0ea0a286`）
- 原版正式库：`baojia/release-data/v2-20261103_235436/runcheng.db`（SQLite，只读 `PRAGMA` / SELECT）
- 原版源码：`baojia/releases/v2-p1-candidate-20261104_070900/`

---

## 1. 原版 RunCheng 系统定位 / Original system identified

依据 `baojia/active-release.json`：

```json
{
  "version": "RunCheng V2 P1 20261104_070900",
  "port": 18786,
  "release_dir": "baojia/releases/v2-p1-candidate-20261104_070900",
  "database": "baojia/release-data/v2-20261103_235436/runcheng.db"
}
```

技术形态 / Stack：Python FastAPI + SQLite + 原生 JS/HTML/CSS 单页 Web MVP。
前端主文件 `static/index.html`、`static/app.js`、`static/style.css`；后端 `server.py`、
`quotation_render.py`、`customer_management.py`、`profit_parameters.py`。

**不是**参考截图，是用户以前实际使用的正式版本源码与数据库。本轮所有「原版」结论均出自此处，
未凭理解重新设计。

---

## 2. 结论一：录入界面差异 / UI differences (summary)

原版是**单页全宽 Workbench**；当前丝网盒子是**左栏编辑 + 右栏 A4 实时预览**双栏骨架。
两者不是「字段顺序不同」，而是区域顺序与信息组织方式整体不同。详见 `P1D05-UI-DIFF.md`。

| # | 原版 RunCheng V2 | 当前 丝网盒子 0.2.17 |
|---|---|---|
| 1 | 顶部操作条 + ⚠ 风险提示条 | 顶部操作条 + 三条迁移/数据提示（非风险提示） |
| 2 | **顶部独立「报价计算参数 / Pricing Parameters」条**（FX、目标毛利率、销售费率、提成、亏损规则集中且常驻） | 无独立参数条；参数散在「高级 / 内部参数」卡，仅 FX / incoterm 上移到订单信息卡 |
| 3 | **产品明细为卡片式**（A 产品信息 / B 内部成本 / C 智能报价 / D 状态操作），成本明细**默认收起** | 产品明细为**表格行内编辑**，成本/建议价常驻每行 |
| 4 | 明细下方右列「整单汇总 / Order Summary」+「其他 / Discount & Charges」，左下运费面板 | 「订单费用」「运费明细」「核价汇总」三张独立卡片顺序排列 |
| 5 | **客户 / 订单信息在页面底部**（Order Info 卡，含 Buyer、贸易条款、付款、交期） | **客户 / 订单信息在最顶部**（`rc_order_card`） |
| 6 | 无实时 A4 预览（打印走独立预览页） | 右栏常驻可编辑 A4 预览（丝网盒子增强能力） |
| 7 | 保存 = 250ms 防抖 PUT 隐式保存，无「保存」按钮 | 显式「保存修改」按钮 |

补充：当前代码中已存在 `rc_order_card` / `rc_items_card` 与「RunCheng 常用区口径」注释
（`app/pages.js:1560` 附近），说明历史上做过局部靠拢，但**整体骨架仍与原版不同**。
证据图：`screenshots/UI-COMPARE-firstscreen.png`（首屏并排）、`RUNCHENG-editor-full.png`（原版全页）、
`SIWANG-editor-current.png`（当前实拍）。

---

## 3. 结论二：产品图片 —— 关键阻塞点 / Image finding — BLOCKER

### 3.1 两侧取图链路（完整映射见 `P1D05-IMAGE-MAPPING.md`）

| 环节 | 原版 RunCheng V2 | 当前 丝网盒子 |
|---|---|---|
| 存储 | `product_images` 表，`img_type` 字段（设计值 `main/spec/accessory`）+ `sort` + `caption` | 产品对象唯一字段 `imageData`（base64 JPEG data URI），**无图片类型语义** |
| 选图 | 客户文档 `SELECT file FROM product_images WHERE product_id=? AND img_type='main' ORDER BY sort LIMIT 1`（`server.py:965`）；工作台 `imgs.find(x=>x.img_type==='main') \|\| imgs[0]`（`app.js:301/672/733/748`） | `Doc.pickProduct()` → `it._unknown.productImage = p.imageData`（`pages.js:986`）→ `Ref.image()` → `<img class="rc-photo">`（`sheet-rc.js:243,248`） |
| 校验 | `img_type='main'` 语义过滤 | 仅 `data:image/(png\|jpeg);base64,` 正则 + 长度 ≤1000100（`reference-sheets.js`） |
| 纸面 CSS | `.items .image img { width:100%; height:72px; object-fit:contain; }`（`quotation_render.py:198`）等比完整显示 | `.rc-sheet .rc-photo { width:79px; height:66.5px; object-fit:cover; }`（`app.css:544`）**裁切填充** |
| 回退 | 无 `main` 图 → `No Image`（`quotation_render.py:98`），**不会退到 spec 图** | 无图 → `NO IMAGE`；有图就显示，不区分是实物图还是规格图 |

### 3.2 实际数据判读（人工逐张核对，非推测）

**原版正式库 `product_images` 共 4 行，全部 `img_type='main'`**：

| 文件 | 类型 | 内容 |
|---|---|---|
| `p1_f79bdef0.png` | ✅ 实物/应用场景照片 | 白色 PVC 隐私围栏 · 住宅车库场景 |
| `p2_8abe2466.jpg` | ✅ 实物/应用场景照片 | 白色 PVC 隐私围栏 · 蓝屋场景 |
| `p4_3f44e127.jpg` | ✅ 实物/应用场景照片 | 白色马场围栏 + 骑手与马 |
| `p7_191a4bfe.png` | ❌ 规格/结构图 | 带部件名称、尺寸标注、结构分解，非实物照片 |

`screenshots/RUNCHENG-quotation-print-PHOTO.png`（原版 Quotation 打印预览）确认：PHOTO 栏显示
`p4` 真实场景照片，在单元格内**等比完整显示、有留白**，与 `object-fit:contain` 一致。

**当前丝网盒子产品库（v4 备份，18 个产品）**：
- 16 个有 `imageData`，2 个无图；全部为 `data:image/jpeg;base64,`。
- 16 张**全部是产品目录单页 / 规格参数表**：顶部一小块应用场景照片 + 中间参数表格 +
  底部尺寸/结构示意图 + 水印；#15 是带网页界面的丝网产品截图。
  **没有一张是独立的产品实物展示照片。**
- 来源已确认：`资料分析/产品目录_20261028/` 下 16 个 JPG 与 `imageData` 解码字节完全一致
  （例：`P01_马场围栏_Horse-Fence.jpg` 422259 bytes）。
- `baojia/reference/lin/fence_media/` 11 张为零散型材/配件实拍与结构图，**不是按产品一一对应
  的实物图集合**。
- 5 张历史单据中 2 行明细带非空 `_unknown.productImage` 快照（必须保持不动）。

证据拼图：`screenshots/IMG-SIWANG-16-products.jpg`、`IMG-RUNCHENG-4-images.jpg`。

### 3.3 阻塞点陈述 / Blocker

任务书要求「**优先显示产品实物图，不把规格尺寸示意图当实物图**」，同时禁止：
升级数据库 / 覆盖原有图片 / 删除规格图 / 改动历史快照 / AI 生成图片 / 用规格图冒充实物图。

而现状是：**既没有独立实物图字段，也没有可用的实物图素材集**。
因此「优先显示实物图」在**数据内容层面无法自动达成**；本阶段能确定完成的是
「呈现规则与取值逻辑的修正」，**实物图的内容来源必须由用户决定**。

按任务书「如果当前产品库没有独立实物图字段，先提出最小改造方案，不直接升级数据库或覆盖原有图片」
与「无法确认时先报告，不擅自用规格图冒充实物图」，本轮到此暂停，不进入实施。

---

## 4. 建议的最小改造方案 / Proposed minimal changes (NOT yet implemented)

### 4.1 无需决策、可直接实施（不涉及数据内容）

| 编号 | 改动 | 文件 | 影响面 |
|---|---|---|---|
| A1 | `.rc-sheet .rc-photo` 由 `object-fit:cover` → `object-fit:contain`，固定框内等比完整显示、不裁切不拉伸 | `app/app.css` 1 行 | 纯 CSS；不动数据、不动 `sheet-rc.js`、不动 RC 五类 PDF 版式结构 |
| A2 | 按 `P1D05-UI-DIFF.md` 重排左栏录入界面区域顺序与卡片形态 | `app/pages.js` + `app/app.css` | 仅界面/样式；不碰 `pricing.js`、Schema V5、`sheet-rc.js`、PDF 模板 |
| A3 | 产品明细新增「实物图 / 规格图」语义选择的最小字段与取值顺序（**新增字段，不改 `imageData`**） | `app/pages.js`、`app/sheet-rc.js`、`app/reference-sheets.js` | 新增可选字段；旧数据全部按回退规则处理，零迁移 |

> A1 与原版 `quotation_render.py:198` 完全对齐，是本轮最确定、风险最低的修复。
> 但请注意：**把 `cover` 改成 `contain` 只会让现有的「规格参数表」在纸面上完整显示出来，
> 并不会把它变成实物图** —— 它解决「呈现方式」，不解决「图片取错」的内容问题。

### 4.2 需要用户决策后才能实施（实物图来源）

| 选项 | 说明 | 代价 / 影响 |
|---|---|---|
| **① 用户提供实物照片（推荐 / Recommended）** | 用户按产品提供 1 张实物/应用场景照片（可只覆盖常报价的产品）；开发侧在产品上新增独立字段 `realImageData`（或等价命名），纸面优先取它，无则按原版回退规则 | 需用户整理素材；零数据库升级、零覆盖、`imageData` 与历史快照全部原样保留 |
| **② 授权复用原版 3 张真实场景照片** | 使用 `p1/p2/p4`（隐私围栏 ×2、马场围栏 ×1）作为对应产品实物图，其余产品按回退规则；需用户指定「照片 ↔ 产品」映射 | 原版 4 张与丝网盒子 18 个产品不是一一对应，覆盖面很小；需明确授权与映射 |
| **③ 本阶段只修规则，实物图留空** | 完成 A1+A2+A3 的结构与回退规则，纸面在无实物图时按原版规则显示 `NO IMAGE`，**绝不退化显示规格图**；后续补录素材 | 交付时纸面产品图会变少/为空，需用户接受 |

### 4.3 需要用户确认的 2 个口径

1. **回退规则**：原版客户文档强制 `img_type='main'`，无 main 图即 `No Image`，**不会退到 spec 图**。
   建议严格照此：**无实物图 → NO IMAGE，绝不把规格图当实物图显示**。请确认。
2. **右栏 A4 预览是否保留**：原版没有实时 A4 预览；丝网盒子有，且任务书要求「保留…编辑能力」。
   建议**保留**（它属于编辑能力、不属于纸面输出），仅在左栏还原原版录入组织。请确认。

---

## 5. 实施前将遵守的保护项 / Safeguards for implementation

- 不删除、不覆盖任何现有 `imageData`（规格图）；新增字段与旧字段并存。
- 不改 5 张历史单据的 `_unknown.productImage` 快照；不改产品库原有图片引用。
- 不要求用户重新录入全部产品资料；无实物图的产品按回退规则显示。
- 不改 `app/pricing.js`、冻结定价公式、Schema V5、数据迁移、历史金额。
- 不改 `sheet-rc.js` 的 RC 五类纸面骨架（LOGO、分页、签名、汇总金额、条款区）。
- 不覆盖生产程序 `siwang-box-latest`、不操作生产 userData；全部在隔离副本测试。
- 回归基线保持：Schema V5 194 / Pricing 851 / P1-C 229 / P1-D 51 / P1-D-03 114 / Parity 8 = **1439 项**，
  另 Electron E2E 180 项；不删除、不降低标准。

---

## 6. 证据索引 / Evidence index

| 文件 | 说明 |
|---|---|
| `screenshots/UI-COMPARE-firstscreen.png` | 原版 vs 当前录入界面首屏并排对照 |
| `screenshots/RUNCHENG-editor-full.png` | 原版真实录入界面全页长图（11-02 验收截图，1440×3026） |
| `screenshots/SIWANG-editor-current.png` | 当前录入界面实拍（隔离 UD，QT-202610-0001，1600×1000） |
| `screenshots/RUNCHENG-quotation-print-PHOTO.png` | 原版 Quotation 打印预览，PHOTO 栏真实场景照片 + contain |
| `screenshots/IMG-RUNCHENG-4-images.jpg` | 原版 4 张产品图拼图（3 实拍 + 1 结构图） |
| `screenshots/IMG-SIWANG-16-products.jpg` | 当前 16 张产品图拼图（全部为目录单页/规格图） |
| `P1D05-UI-DIFF.md` | 录入界面逐区差异清单与最小改造方向 |
| `P1D05-IMAGE-MAPPING.md` | 图片字段映射、取图/裁切规则、回退规则 |
| `evidence/SOURCES.md` | 只读数据来源、命令与哈希 |
| `evidence/SHA256SUMS.txt` | 本交付目录文件级哈希清单 |

---

## 7. 下一步 / Next step

**等待用户对 §4.2（实物图来源 ①②③）与 §4.3（回退口径、A4 预览保留）作出选择。**
收到确认后再执行任务书「执行顺序」第 3–5 步：建立隔离工作副本 → 最小修改 → 界面/PDF/实操/回归测试 →
完整 ZIP 交付。在此之前不修改任何业务代码、不覆盖正式版本。
