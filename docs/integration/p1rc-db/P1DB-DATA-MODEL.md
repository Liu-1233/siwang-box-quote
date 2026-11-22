# P1-RC-DB · 数据模型变更说明

**Schema 仍为 V5。所有新增字段均为可选；不覆盖任何既有字段，不改任何历史单据。**

## 1. 变更总览

| 区域 | 变更 | 存放位置 | 是否必填 |
|---|---|---|---|
| 产品 | 多图 `images[]` | `products[].images` | 可选（≤12 张） |
| 产品 | `color` / `accessories` / `remarks` | 产品对象顶层 | 可选（≤2000 字） |
| 客户 | `whatsapp` / `website` / `customerType` / `source` / `notes` / `archivedAt` | 客户对象顶层 | 可选 |
| 供应商 | `suppliers[]` | `_unknown.suppliers` | 可选 |
| 供应商报价 | `supplierQuotes[]` | `_unknown.supplierQuotes` | 可选（只增不改） |
| 设置 | 公司信息 8 项 | `settings.companyProfile` | 可选 |
| 设置 | 银行信息 5 项 | `settings.bank` | 可选 |
| 设置 | 默认参数 5 项 | `settings.defaults` | 可选 |

未新增任何顶层集合（`db.suppliers` / `db.supplierQuotes` 都不存在），因此 Schema V5 读门/写门、
`counters`、`documents` 结构完全不动。

## 2. 产品多图 `images[]`

```jsonc
"images": [
  { "id": "可选 ≤64 字符", "data": "data:image/png;base64,…", "type": "main|spec|accessory",
    "sort": 0, "caption": "可选 ≤200 字" }
]
```

| 约束 | 规则 |
|---|---|
| 数量 | 最多 **12** 张（`PRODUCT_IMAGE_MAX`） |
| 数据 | 仅 `data:image/png` / `data:image/jpeg` 的 base64，长度 ≤ 1,000,100（与现有产品图/实物图同一白名单） |
| 类型 | 仅 `main`（实物主图）/ `spec`（规格图）/ `accessory`（配件图） |
| 排序 | `sort` 必须是非负整数；读取按 `sort` 升序 |
| 说明 | `caption` 可选，≤200 字 |
| 主图语义 | 客户纸面 PHOTO 仍只认 **现有** `realImageData` / `realImageMode`；`images[]` 不参与纸面口径 |

### 与既有字段的关系（不覆盖）

| 既有字段 | 本阶段处理 |
|---|---|
| `imageData`（规格图） | 原样保留，不读不写；`images[]` 存在时两者并存 |
| `realImageData`（实物图） | 原样保留；客户纸面继续只认它 |
| `realImageMode`（auto/custom/none） | 原样保留 |

**旧数据读兼容**：`Store.productImagesOf(id)` 在没有 `images[]` 时，
用 `realImageData` 合成 `main`、`imageData` 合成 `spec`（只读、**不写回**磁盘），
所以历史产品无需迁移即可被新 UI 正常展示。

## 3. 产品扩展文本

| 字段 | 类型 | 上限 | 说明 |
|---|---|---|---|
| `color` | string | 2000 | 颜色（原版 `products.color`） |
| `accessories` | string | 2000 | 包含配件/报价范围（原版 `products.accessories`） |
| `remarks` | string | 2000 | 备注（原版 `products.remarks`，与现有 `note` 并存） |

## 4. 客户扩展字段

| 字段 | 类型 | 约束 |
|---|---|---|
| `whatsapp` | string | ≤2000 |
| `website` | string | ≤2000 |
| `customerType` | string | ≤2000（如 终端 / 经销商 / 工程商） |
| `source` | string | ≤2000（如 阿里 / 展会 / 转介绍） |
| `notes` | string | ≤2000 |
| `archivedAt` | string | `YYYY-MM-DD` 或空串；空=未归档 |

历史买方快照（`documents[].customer`）**不受影响**：客户档案更新不会回写历史单据。

## 5. 供应商与供应商报价（`_unknown` 受控结构）

```jsonc
"_unknown": {
  "suppliers": [
    { "id": "s-…", "name": "安平XX丝网", "contact": "李", "remarks": "", "createdAt": "ISO" }
  ],
  "supplierQuotes": [
    { "id": "q-…", "supplierId": "s-…", "supplierName": "安平XX丝网",
      "productId": "p-…", "currency": "CNY|USD", "price": 97.5, "unit": "panel",
      "moq": "MOQ 100 panels", "quoteDate": "2026-11-20", "validUntil": "2026-12-20",
      "sourceFile": "报价单20261120.pdf", "createdAt": "ISO" }
  ]
}
```

| 规则 | 说明 |
|---|---|
| 只增不改 | 数据层只提供 `addSupplier` / `addSupplierQuote`，**没有 update/delete**；同参数重复录入 = 新增一条，历史永久保留 |
| 校验 | 名称非空；币种仅 CNY/USD；价格有限非负；产品必须存在；`supplierId` 提供时必须存在；日期 `YYYY-MM-DD` |
| 关联 | `supplierQuotes[].productId` 指向 `products[].id`（字符串） |
| 后续 | P2/P3 的供应商 UI 与编辑器引用直接读这两个数组；是否升 V6 由评审决定 |

## 6. 设置扩展

```jsonc
"settings": {
  "companyProfile": { "nameEn": "", "nameCn": "", "contact": "", "email": "",
                      "phone": "", "whatsapp": "", "website": "", "addressEn": "" },
  "bank": { "name": "", "accountName": "", "accountNumber": "", "swift": "", "address": "" },
  "defaults": { "fx": null, "feeRate": null, "targetMargin": null,
                "commissionRate": null, "lossPolicy": "zero_on_loss" }
}
```

| 规则 | 说明 |
|---|---|
| 不覆盖旧配置 | 保存只写 `companyProfile` / `bank` / `defaults`；现有 `company` / `contact` / `sellerAddress` / `pricingDefaults` / `ai` 一个字节都不动 |
| 读取回退 | `companyProfile.nameCn` 缺省时回退 `settings.company`；`contact` 回退 `settings.contact`；`addressEn` 回退 `settings.sellerAddress` |
| 默认值校验 | `fx > 0`；费率/毛利率/提成 ∈ [0,100%)；费率+毛利率 < 100%；亏损规则只允许 `zero_on_loss` |
| 与定价关系 | `defaults` 只是"新报价的默认值"，**不进入定价公式**；历史单据不读它 |

## 7. 校验门（同一份规则，三处共用）

| 门 | 位置 | 覆盖 |
|---|---|---|
| 读门 | `model.validateV5` | 产品多图/扩展文本、客户扩展、供应商结构 |
| 写门 | `model.validateWritable` | 同上（落盘前最终防线） |
| 界面前校验 | `store.profileValid` | 产品/客户保存前提示具体原因 |

新增导出：`PRODUCT_IMAGE_TYPES`、`PRODUCT_IMAGE_MAX`、`validateProductImages`、
`validateProductExtraText`、`validateCustomerExtras`、`validateSuppliers`、`isDataImage`。

## 8. 明确不做（本阶段）

- 不改任何 UI（`app/pages.js`、`app/app.css`、`index.html` 与基线逐字节一致）；
- 不迁移历史数据（P6 才做）；
- 不改 `pricing.js`、五类 PDF 模板、`sheet-rc.js`；
- 不升 Schema V6、不改数据库结构。
