# P1-D-05 · 三张原版实物图与产品匹配表 / Real-Image Match Table

**结论**：用户授权复用的三张原版真实场景照片，经原版 RunCheng V2 正式库的
`product_images → products` 关联核实后，只对**两类可确认匹配的产品族**设置实物图：
马场围栏（`RC-CAT-P01`）与隐私围栏（`RC-CAT-P02`）。
其余产品一律不发放实物图，客户纸面按原版口径显示 `NO IMAGE`，**绝不回退规格图**。

---

## 1. 数据来源（只读查询，未修改原版库）

| 项 | 值 |
|---|---|
| 原版正式版本 | `RunCheng V2 P1 20261104_070900`（`baojia/active-release.json`） |
| 数据库 | `baojia/release-data/v2-20261103_235436/runcheng.db` |
| 数据库 SHA-256 | `ef8e56e5e6c26d1a2bbd730f46896ceddf3603abf5eac2e19841ab08afeb4363` |
| 查询 | `SELECT * FROM product_images ORDER BY id`，再按 `product_id` 关联 `products` |
| 原始结果 | `evidence/P1D05-original-db-images.json`（逐行完整字段） |

原版 `product_images` 共 **4 行**，全部 `img_type='main'`、`sort=1`：

| id | product_id | file | 关联产品 code | 关联产品 name_cn | 品类 | 判定 | 本阶段处理 |
|---|---|---|---|---|---|---|---|
| 1 | 1 | `p1_f79bdef0.png` | `RC-PF-6X8` | PVC 隐私围栏 6×8 英尺（含立柱五金） | Privacy Fencing 隐私围挡 | **真实场景实拍** | ✅ 复用为 p1 |
| 2 | 2 | `p2_8abe2466.jpg` | `RC-PF-6X6` | PVC 隐私围栏 6×6 英尺（含立柱五金） | Privacy Fencing 隐私围挡 | **真实场景实拍** | ✅ 复用为 p2 |
| 3 | 4 | `p4_3f44e127.jpg` | `RC-HF-P1525-20` | PVC 马场围栏片 1.5×2.5m 三横梁 2.0mm | Horse Fencing 马场围栏 | **真实场景实拍** | ✅ 复用为 p4 |
| 4 | 7 | `p7_191a4bfe.png` | `RC-WPC-9020` | WPC 复合围栏整节 1.8×1.82m 全透 90×20mm | WPC Fencing WPC 复合围栏 | **带尺寸标注的结构/规格图** | ❌ 明确排除 |

> 四类图片区分口径见阶段一 `P1-D-05/P1D05-IMAGE-MAPPING.md` §1：
> 实物图 / 展示图 / 规格图 / 结构图。**不能仅因某张图片存在就当产品主图。**
> p7 虽有 `img_type='main'`，但画面是带标注的结构/规格图，用户明确要求
> 「不把规格尺寸示意图当实物图」，因此不纳入 `app/real-images.js`。

三张图逐张示例见 `compare/IMG-REAL-3.png` 与 `compare/REAL-p1.png` / `REAL-p2.png` / `REAL-p4.png`。

---

## 2. 当前产品库匹配表

当前隔离开发副本产品库共 **18 个产品**（2 个无图、16 个 `imageData` 均为产品目录单页/规格参数表）。
按「`sku` + 中/英文品名族」双重确认，只有两类族产品能与原版三张实拍建立可靠关联：

| 当前 sku | 当前品名 | material | 关联原版产品 | 内置实物图 | 默认 | 可选 |
|---|---|---|---|---|---|---|
| `RC-CAT-P01` | 马场围栏 / Horse Fence / Ranch Rail Fence | PVC围栏 | `RC-HF-P1525-20`（product_id=4） | **p4** | p4 | 仅 p4 |
| `RC-CAT-P02` | 隐私围栏 / Privacy Fence | PVC围栏 | `RC-PF-6X8`（product_id=1）、`RC-PF-6X6`（product_id=2） | **p1** | p1 | p1 / p2 |
| 其余 16 个产品 | — | — | 无可确认关联 | **无** | `NO IMAGE` | 允许用户在产品库自行上传实物图 |

匹配规则实现于 `app/real-images.js` 的 `RULES`（仅 2 条）与 `forProduct()`：
- 未匹配产品返回空字符串，`Doc.pickProduct()` 因此不写入 `_unknown.realImage`；
- `sheet-rc.js` 纸面 PHOTO 只读 `_unknown.realImage`，为空即 `NO IMAGE`；
- 用户可在产品库表单「产品实物图」区自行上传或选择内置图，写入独立可选字段
  `realImageData`，不影响 `imageData` 规格图。

---

## 3. 保护与不变项

| 保护项 | 状态 |
|---|---|
| 原版规格图 `imageData` / 历史单据 `_unknown.productImage` 快照 | 原样保留，不删、不改名、不覆盖 |
| 原版数据库 / 原版图片文件 | 只读查询，未修改 |
| `p7` 结构/规格图 | 明确排除，未作为实物图 |
| Schema V5 | 未升级；新增 `realImageData` 为可选字段，沿用同类 bounded PNG/JPEG 校验 |
| `app/pricing.js` / 定价公式 | 与 P1-D-04 基线逐字节一致 `390ef0a65789d680da992758b9ce6077682957a291ae50832a18a6cb10732a00` |
| 五类 PDF 骨架 / LOGO / 分页 / 签名 / 金额汇总 | 未改；仅 PHOTO 取值与 `object-fit` 变化 |
| 生产程序 / 生产 userData | 全程未触碰 |

---

## 4. 复现

```bash
# 原版关联查询（只读）
python -c "import sqlite3; ..."   # 结果见 evidence/P1D05-original-db-images.json

# 匹配规则与纸面选图断言（22 项）
node docs/integration/p1d05/P1D05-image-probe.cjs
```

`P1D05-image-probe.log` 记录 22/22 PASS，含
「p1→product_id 1 / p2→2 / p4→4」「p7 排除」「P01→p4」「P02→p1」
「未匹配产品不发放实物图」「规格图绝不回退为 PHOTO」等断言。
