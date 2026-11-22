# P1-D-05 · 附件 B：产品图片字段映射、取图与裁切规则 / Image Field Mapping

**结论先行**：当前丝网盒子**没有独立「产品实物图」字段**，且产品库现有 16 张图**全部是
产品目录单页 / 规格参数表**，不是实物展示照片；纸面还用了与原版相反的 `object-fit:cover`
裁切。因此「优先显示实物图」无法靠改代码自动完成 —— 必须先确定实物图**内容来源**。
本文件只做调查与最小方案，**不改任何数据、字段或图片**。

---

## 1. 四类图片的定义（任务书要求明确区分）/ Four image categories

| 类别 / Category | 定义 | 判定特征 |
|---|---|---|
| **产品实物图 / Product photo (real-life)** | 真实拍摄的产品在应用场景中的照片 | 实景、无参数表格、无尺寸线、无部件标注 |
| **产品展示图 / Product display (hero)** | 以产品主体为画面的展示图（白底/场景棚拍） | 主体为产品本身，可带少量文案，无技术标注 |
| **产品规格图 / Spec sheet / catalog page** | 产品目录单页、规格参数表 | 含参数表格、型号列表、尺寸表、水印、多图拼排 |
| **产品结构图 / Structure diagram** | 带技术标注的构造/分解示意图 | 部件名称、尺寸线、剖面、爆炸图、结构分解 |

**不能仅因某张图片存在就当产品主图。** 当前 `imageData` 有值 ≠ 它是实物图。

---

## 2. 原版 RunCheng V2 取图链路 / Original image pipeline

### 2.1 存储结构

`server.py:38–44`：

```sql
CREATE TABLE product_images(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  file TEXT NOT NULL,
  img_type TEXT DEFAULT 'main',   -- 设计值: main / spec / accessory
  sort INTEGER DEFAULT 0,
  caption TEXT DEFAULT ''
)
```

上传接口 `server.py:498–506`：`POST /api/products/{pid}/images`，表单含 `img_type`、`caption`。
**字段层面具备「实物主图 / 规格图 / 配件图」的语义区分能力。**

### 2.2 客户纸面选图（本次任务关注，最权威）

`server.py:965`（`build_client_doc()`）：

```python
imgs = [r["file"] for r in con.execute(
    "SELECT file FROM product_images WHERE product_id=? AND img_type='main' ORDER BY sort LIMIT 1",
    (it["product_id"],))] if it["product_id"] else ([it["image_file"]] if it["image_file"] else [])
```

- 正常产品：**只取 `img_type='main'` 且 `sort` 最小的一张**；无 main 图 → `images=[]`。
- 仅**临时产品**（无 `product_id`）才回退到 `quote_items.image_file`。

### 2.3 纸面渲染与回退

`quotation_render.py:98`（Quotation）：

```python
embedded = item.get("image_data") or []
images = item.get("images") or []
source = embedded[0] if embedded else ("/api/images/" + str(images[0]) if images else "")
```

`server.py:1057`（PI）：`(it.get("image_data") or [""])[0] or (/api/images/{images[0]})`。
两者消费的都是 §2.2 已按 `main` 过滤后的 `images`，故**不会退到 spec/accessory 图**；
无图时输出 `No Image`。

`quotation_render.py:198`（**裁切规则**）：

```css
.items .image img { width: 100%; height: 72px; object-fit: contain; display: block; }
```

→ **等比完整显示、不拉伸、不裁切，单元格内可留白**。
`screenshots/RUNCHENG-quotation-print-PHOTO.png` 实证：PHOTO 栏为真实马场围栏场景照片，
完整显示、上下留白。

### 2.4 工作台 / 编辑器缩略图（与纸面规则不同，须区分）

`static/app.js:301, 672, 733, 748`：

```js
const main = imgs.find(x => x.img_type === "main") || imgs[0];
```

这里**会**回退到第一张（可能是 spec/accessory），但仅用于编辑器缩略图与
`quote_items.image_file`，**不是客户纸面**。编辑器缩略图 CSS `static/style.css:215` 为
`object-fit:cover`。

> **原版真实回退规则（客户纸面）**：无 `main` 图 → `No Image`，**绝不退化显示规格图**。
> 只有工作台缩略图与临时产品才回退到第一张/临时图。

### 2.5 原版正式库实际数据

`baojia/release-data/v2-20261103_235436/runcheng.db` → `product_images` **共 4 行，全部 `img_type='main'`**：

| 文件 | 类别 | 内容 |
|---|---|---|
| `p1_f79bdef0.png` | ✅ 产品实物图 | 白色 PVC 隐私围栏 · 住宅车库场景 |
| `p2_8abe2466.jpg` | ✅ 产品实物图 | 白色 PVC 隐私围栏 · 蓝屋场景 |
| `p4_3f44e127.jpg` | ✅ 产品实物图 | 白色马场围栏 + 骑手与马 |
| `p7_191a4bfe.png` | ❌ 产品结构/规格图 | 带部件名称、尺寸标注、结构分解 |

诚实说明：原版数据里也把一张结构图登记成了 `main`；但**它至少有字段能区分**，
而丝网盒子连这个字段都没有。

---

## 3. 当前 丝网盒子 取图链路 / Current image pipeline

| 环节 | 代码 | 行为 |
|---|---|---|
| 产品库存储 | `data/siwangbox-v5.json`（`storage.js` JSON 文本） | 产品对象唯一图片字段 `imageData` = base64 JPEG data URI；**无 `img_type` / `sort` / `caption`，无独立图片目录或 blobs** |
| 图片录入 | `app/local-image.cjs` → `main.js:172` `product:pickImage` → `preload.js:54` | PNG/JPEG 校验、魔数、≤8MB、≤3600 万像素、最长边 >1000 缩放、`toJPEG(85)`、≤750000 字节；**原文件名/路径完全丢弃**，无法从字段判断图片类型 |
| 产品库 Schema | `app/model.js` `validateV5` | `imageData` ≤1000100 且匹配 `data:image/(png\|jpeg);base64,` |
| 带入单据 | `app/pages.js:986` `Doc.pickProduct()` | `it._unknown.productImage = (p.imageData 合法) ? p.imageData : ''` |
| 编辑器明细行 | `app/pages.js` `Doc.itemRowHTML()` | **无图片列、无图片选择/上传控件** |
| 纸面校验 | `app/reference-sheets.js` `Ref.image()` | 仅正则 + 长度校验，**不做实物图/规格图语义判断** |
| RC 纸面输出 | `app/sheet-rc.js:243,248` | `const img = Ref.image(it._unknown && it._unknown.productImage);` → `<img class="rc-photo">` 或 `NO IMAGE` |
| **RC 纸面裁切** | `app/app.css:544` | `.rc-sheet .rc-photo { width:79px; height:66.5px; max-width:100%; object-fit:cover; }` → **裁切填充**；`.rc-items tbody tr { height:93px }` |
| 另一版式 | `app/sheet.js:202` | `q-trade-photo` 为 `object-fit:contain`（非当前 RC 生效版式） |
| A4 预览 / PDF | `Sheet.build()` + `app/app.css` | 预览与 `pdf-export.cjs` **同源**；CSP `img-src data:`，图片只能来自 data URI |

`app/app.css` 中相关注释假设「源图为正方形 451×451，原版按固定框裁切填充」——
与实测数据（竖版 1414×1920 / 1280×1737 目录页）及原版 `contain` 规则均不符。

---

## 4. 字段映射表 / Field mapping

| 原版字段 / 概念 | 当前字段 | 是否等价 | 说明 |
|---|---|---|---|
| `product_images.img_type='main'` | **无** | ❌ | 当前无语义区分，是本次核心缺口 |
| `product_images.sort` | **无** | ❌ | 当前单图，无排序 |
| `product_images.caption` | **无** | ❌ | — |
| `product_images.file`（磁盘文件） | `product.imageData`（base64 内联 JSON） | ⚠️ 部分 | 存储形态不同 |
| `quote_items.image_file`（工作台缩略图） | `it._unknown.productImage`（单据快照） | ⚠️ 部分 | 当前纸面直接用这个快照，不做二次选图 |
| `item.image_data`（打印时嵌入） | `it._unknown.productImage` | ⚠️ 部分 | 当前内联 data URI，无预嵌入步骤 |
| `build_client_doc()` 的 `img_type='main'` SQL 过滤 | **无**（`Ref.image()` 只校验格式） | ❌ | 没有「只取实物主图」的过滤 |
| `.items .image img { object-fit:contain }` | `.rc-photo { object-fit:cover }` | ❌ | **方向相反** |

---

## 5. 实际数据判读 / Actual data (人工逐张核对，非推测)

### 5.1 当前产品库（只读 v4 备份，18 个产品）

- 16 个有 `imageData`，2 个无图（#16 未命名产品、#17「304 不锈钢丝网」）。
- 16 张**全部属于「产品规格图 / 目录单页」**：顶部一小块应用场景照片 + 中间参数表格 +
  底部尺寸/结构示意图 + 水印；#15 是带网页界面的丝网产品截图。
  **没有一张是独立的「产品实物图」或「产品展示图」文件。**
- 尺寸以 `1414×1920` / `1280×1737` 竖版为主，#15 为 `1000×563`。
- 来源确认：`资料分析/产品目录_20261028/` 下 16 个 JPG 与 `imageData` 解码字节完全一致
  （例 `P01_马场围栏_Horse-Fence.jpg` 422259 bytes）。
- `baojia/reference/lin/fence_media/` 11 张为零散型材/配件实拍与结构图，
  **不是按 18 个产品一一对应的实物图集合**。
- 5 张历史单据中 **2 行明细带非空 `_unknown.productImage` 快照**（必须保持不动）。

证据：`screenshots/IMG-SIWANG-16-products.jpg`、`IMG-RUNCHENG-4-images.jpg`。

### 5.2 因此

| 任务书要求 | 现状能否满足 |
|---|---|
| 优先显示产品实物图 | ❌ 无字段、无素材 |
| 不把规格尺寸示意图当实物图 | ❌ 当前纸面**正在**把规格图当主图显示 |
| 图片比例/尺寸/裁切/位置还原原版 | ❌ 当前 `cover` 与原版 `contain` 相反 |
| 不改变原始产品图片 | ✅ 本轮未改；实施时须继续保证 |
| 不删除原规格图、不覆盖已有图片 | ✅ 本轮未动 |
| 不影响历史报价单图片快照 | ✅ 本轮未动 |

---

## 6. 裁切规则对照 / Cropping rule

| | 原版 Quotation PHOTO | 当前 RC PHOTO |
|---|---|---|
| CSS | `width:100%; height:72px; object-fit:contain` | `width:79px; height:66.5px; object-fit:cover` |
| 效果 | 等比完整显示、可留白、不裁切、不拉伸 | 填满固定框、四边裁切 |
| 适合 | 实物场景照片 | 正方形主体图（与现有竖版目录页不匹配） |
| 证据 | `screenshots/RUNCHENG-quotation-print-PHOTO.png` | `screenshots/SIWANG-editor-current.png` 右栏 A4 预览 |

> 把 `cover` 改成 `contain` 是**纯 CSS 一行修复**、与原版完全对齐，且不动数据、
> 不动 `sheet-rc.js`、不改 RC 五类 PDF 版式结构。但它只解决「呈现方式」：
> 改完后纸面上会**完整显示那张目录规格页**，并不会把它变成实物图。

---

## 7. 最小改造方案 / Minimal change proposal（未实施）

### 7.1 A 组：确定可做，无需用户决策（不涉及图片内容）

| 编号 | 改动 | 文件 | 保护项 |
|---|---|---|---|
| A1 | `.rc-sheet .rc-photo` `object-fit:cover` → `contain` | `app/app.css`（1 行） | 不动数据、不动 `sheet-rc.js`、不动 PDF 版式骨架 |
| A2 | 产品明细/产品编辑页提供「实物图」与「规格图」**语义区分的最小新增字段**（例如 `realImageData`），**新增而非替换** `imageData` | `app/pages.js`、`app/reference-sheets.js` | 旧 `imageData` 原样保留；无新字段的产品按 §7.3 回退 |
| A3 | 纸面取值顺序：`realImageData`（实物图）→ 无则按原版回退规则，且**绝不退化取 `imageData` 规格图** | `app/sheet-rc.js` 取值表达式 | 不动 `build()` 骨架、不动列宽/分页/LOGO/签名/汇总 |

### 7.2 B 组：需要用户决策（实物图内容来源）

| 选项 | 内容 | 影响 |
|---|---|---|
| **① 用户提供实物照片（推荐）** | 每个常报价产品提供 1 张实物/应用场景照片；开发侧填入 §7.1 A2 的新增字段 | 零数据库升级、零覆盖；`imageData` 与历史快照全部保留 |
| **② 授权复用原版 3 张实拍照片** | `p1/p2/p4`（隐私围栏 ×2、马场围栏 ×1），需用户指定「照片 ↔ 产品」映射 | 覆盖面小（原版仅 3 张实拍，且不与 18 产品一一对应）；需明确授权 |
| **③ 本阶段只修规则，实物图留空** | 完成 A1+A2+A3 与回退规则；无实物图的产品纸面显示 `NO IMAGE` | 交付时纸面产品图会变少/为空，需用户接受 |

### 7.3 建议采用的回退规则（严格照原版客户纸面）

```
实物图字段有值  → 显示实物图（contain）
实物图字段无值  → 显示 NO IMAGE
                  ✗ 不退化显示 imageData（规格图 / 目录页）
                  ✗ 不用结构图冒充
                  ✗ 不 AI 生成、不拉伸、不裁切
```

依据 §2.2/§2.3：原版客户文档强制 `img_type='main'`，无 main 图即 `No Image`，
**不退到 spec/accessory**。工作台缩略图的「退到第一张」规则**不适用于客户纸面**。

---

## 8. 历史数据保护清单 / Data safeguards

- ❌ 不删除、不覆盖任何现有 `imageData`（16 张规格图全部原样保留）。
- ❌ 不改 5 张历史单据的 `_unknown.productImage` 快照（含 2 行非空快照）。
- ❌ 不改产品库原有图片引用、不要求用户重新录入全部产品资料。
- ❌ 不升级 Schema V5、不做数据迁移、不改 `validateV5` 的既有 `imageData` 校验。
- ❌ 不改 `app/pricing.js`、定价公式、冻结报价、成交价保护。
- ❌ 不改 `sheet-rc.js` 的 RC 五类纸面骨架（LOGO、分页、签名、汇总金额、条款区）。
- ✅ 新增字段为**可选**：旧数据无该字段时全部按 §7.3 回退，等于「不填就不显示」。
- ✅ 全部测试在隔离 userData 副本进行，不触碰生产 userData、不覆盖 `siwang-box-latest`。

---

## 9. 待确认 / Open questions

1. **§7.2 三选一**：实物图内容来源（推荐 ①）。
2. **§7.3 回退口径**：确认「无实物图 → `NO IMAGE`，绝不退化显示规格图」。
3. 若选 ②，请提供 3 张照片与 18 个产品的对应关系（或明确只映射哪几个产品）。

**在收到确认前，不修改任何业务代码、不新建/覆盖任何产品图片、不进入实施。**
