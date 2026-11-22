# P1-D-05 · 图片字段映射说明（阶段二实施版）/ Image Field Mapping

阶段一调查见 `P1-D-05/P1D05-IMAGE-MAPPING.md`（只读）。
本文件记录**阶段二实际落地**的字段链路、取图规则与裁切规则。

---

## 1. 四类图片定义（任务书要求明确区分）

| 类别 | 判定 | 本阶段处理 |
|---|---|---|
| 产品实物图 / real-life photo | 真实场景实拍，无参数表格、无尺寸线、无标注 | ✅ 唯一允许进入客户纸面 PHOTO 的类别 |
| 产品展示图 / hero | 白底/棚拍主体图 | 可作为用户后续自行上传的实物图来源 |
| 产品规格图 / spec sheet | 产品目录单页、规格参数表、尺寸表、水印 | ❌ 保留在产品库，绝不作为纸面主图 |
| 产品结构图 / structure diagram | 部件标注、尺寸线、剖面、爆炸图 | ❌ 明确排除（原版 p7 即此类） |

**不能仅因某张图片存在就当产品主图。**

---

## 2. 字段链路（修改前 → 修改后）

### 修改前（P1-D-04 基线）

```
产品库 p.imageData (base64 JPEG，16 张全是规格页)
   └─ Doc.pickProduct() → it._unknown.productImage  (单据明细快照)
        └─ sheet-rc.js itemsBlock() → Ref.image() → <img class="rc-photo">
             └─ app.css .rc-photo { object-fit: cover }   ← 裁切填充，与原版相反
```

### 修改后（P1-D-05）

```
【规格图链路：完全保留，不删不覆盖】
产品库 p.imageData → it._unknown.productImage → 仅在工作台/产品库使用，不进客户纸面

【实物图链路：新增独立可选字段】
产品库 p.realImageData (可选，用户上传/内置选择)
  或 app/real-images.js 内置三张原版实拍（按 sku+品名族双重匹配）
   └─ Doc.pickProduct() → it._unknown.realImage  (单据明细快照)
        └─ sheet-rc.js itemsBlock() → Ref.image() → <img class="rc-photo">
             └─ app.css .rc-photo { object-fit: contain } ← 等比完整显示，不裁切不拉伸
无 realImage → 纸面输出 NO IMAGE（虚线框），绝不回退规格图
```

### 字段清单

| 字段 | 位置 | 语义 | 是否新增 | 是否可选 | 校验 |
|---|---|---|---|---|---|
| `imageData` | 产品库 | 规格图 / 目录页 | 原有 | 原有 | bounded PNG/JPEG ≤1000100 |
| `realImageData` | 产品库 | **实物图** | ✅ 新增 | ✅ 可选，缺省不写 | 与 `imageData` 同一套 bounded PNG/JPEG 校验 |
| `_unknown.productImage` | 单据明细 | 规格图快照 | 原有 | 原有 | 历史单据快照原样保留 |
| `_unknown.realImage` | 单据明细 | **实物图快照** | ✅ 新增 | ✅ 可为空 | `Ref.image()` 格式/长度校验 |

新增字段**不升级 Schema V5**：`model.js validateV5RowKeys()` 不拒绝产品未知字段，
`store.js updateProduct()` 用 `Object.assign` 合并，`Prod.save()` 仅在实物图表单打开时才写
`realImageData`，因此老产品数据与历史单据均不受影响。

---

## 3. 客户纸面选图规则（对齐原版 `WHERE img_type='main'`）

| 情况 | 原版 RunCheng | P1-D-05 |
|---|---|---|
| 有 main 实物图 | 显示该图 | 显示 `_unknown.realImage` |
| 无 main，但有 spec/accessory | `No Image`，**绝不退化** | `NO IMAGE`，**绝不读取 `productImage` / `imageData`** |
| 临时产品（无 product_id） | 才回退 `quote_items.image_file` | 不适用（当前无此通道） |

`sheet-rc.js itemsBlock()` 只读取 `_unknown.realImage`；
`p1d3/run.js` 新增 3 条专项断言（B5a/B5b/B5c）锁定「规格图绝不回退为纸面 PHOTO」，
`P1D05-image-probe.cjs` 另有 C2/C3/C4/C5 四条同类断言。

---

## 4. 裁切与比例

| 项 | 修改前 | 修改后 | 原版 |
|---|---|---|---|
| CSS | `object-fit: cover` | `object-fit: contain` | `object-fit: contain` |
| 框尺寸 | 79 × 66.5 px | 79 × 66.5 px（未改盒模型，不影响行高/分页） | width:100%; height:72px |
| 效果 | 裁切填充，规格页被切掉参数表 | 等比完整显示，留白居中，不拉伸变形 | 等比完整显示 |

> 只改 `object-fit` 取值，不改宽高、列宽、行高、分页 CSS，因此 P1-D-04 已验收的
> 分页骨架不受影响（P1-D-04 基准 5 份 PDF 各 1 页；本轮 4 份 1 页，
> SC 因 E2E 数据含 3 行超长规格 + HS CODE 列自然溢出第 2 页，见 `P1D05-pdf-verify.log`）。

---

## 5. 三张实物图来源与匹配

见 `P1D05-REAL-IMAGE-MATCH.md`：p1/p2 → 隐私围栏族，p4 → 马场围栏族；
p7 结构图排除；`app/real-images.js` 内嵌三张原版实拍（只读资源，不依赖运行时文件系统）。

---

## 6. 保护清单

| 保护项 | 状态 |
|---|---|
| 原规格图 `imageData` | 保留，不覆盖、不删除 |
| 历史报价单图片快照 `_unknown.productImage` | 不修改 |
| 产品库原有图片引用 | 不影响 |
| 历史报价金额 / 定价公式 / Schema V5 | 未改（`pricing.js` SHA-256 与基线一致） |
| 五类 PDF 骨架、LOGO、分页、签名、金额汇总 | 未改 |
| 生产程序 / 生产 userData | 全程未触碰 |
| AI 生成图片 / 用规格图冒充实物图 | 未使用 |
| 用户重新录入全部产品资料 | 未要求 |

## 7. 证据文件

- `compare/IMG-COMPARE-before-after.png`：修改前后对照
- `compare/PREVIEW-VS-PDF-QT.png`：A4 预览与实际 PDF 对照
- `compare/IMG-REAL-3.png`、`REAL-p1/p2/p4.png`：三张原版实物图
- `pdf/` 五类正式 PDF、`pdf-render/` 五张页面渲染图
- `P1D05-pdf-verify.json` / `.log`：5/5 PASS
- `P1D05-image-probe.log`：22/22 PASS
