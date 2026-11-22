# P0 源码审计报告：丝网盒子 0.2.17

日期：2026-11-19 ｜ 审计方式：逐文件实读 + 基线哈希 + 真实测试运行
本报告只读审计，未修改任何业务代码。

---

## 1. 目录与版本基线

| 项 | 状态 |
|---|---|
| `D:\siwanghezi\siwang-box-0.2.17-src` | ✅ 存在，package.json version=**0.2.17**，与方案一致；原始来源=安装包 app.asar 解包（与安装包逐字节同源） |
| `D:\siwanghezi\baojia\v3` | ✅ 存在，润成 V3 源码工程（npm/tsx 可运行） |
| `D:\siwanghezi\siwang-box-0.2.17-dev` | ❌ 尚不存在（P1 创建，创建时须核对文件数/哈希/版本） |
| 未提交修改 | 两个原始目录均无 git 仓；以 sha256 基线代替（见 §8） |
| 数据库文件 | 丝网盒子数据经主进程 `storage.js` 读写本地 JSON 数据文件（非 SQLite）；润成 V3 用云端 Postgres，本地版用 SQLite（`v3local/server/data/`，与本整合无关） |
| 其他运行实例 | 无（5218/8686 是润成侧端口，与丝网盒子无冲突） |
| 测试入口 | **丝网盒子 0.2.17 包内无测试套件**（0.2.16 源码同样没有；sheet.js 注释提到 vm 测试但文件未随包）。基线测试只能以"人工冒烟 + 语法校验"为起点，P1 新建的 `tests/pricing/` 将是首个测试资产 |

## 2. schema v4 结构（实际校验代码）

- `SCHEMA_VERSION = 4`（model.js L19）
- 顶层：`schemaVersion / settings / customers / products / documents / communications / quotesArchive / checkins / migration / learningRecords`（validateV2/V3/V4 三级校验，读写双门：读门 `validateV4`，写门 `validateWritable`）
- 明细行 `ITEM_KEYS`（v4，17 个）：`productId, nameCn, nameEn, mesh, wire, width, rollLen, qty, price, unit, amount, productImage, hsCode, packages, net, gross, volume`
- PL 行包装四件套独立键：`packages/net/gross/volume`（null=待补，填了必须合法）
- 单据核心键：`type/no/date/currency/items/seller/customer/buyerAddress/term/payment/validity/delivery/bank/remark/shipment/vessel/origin/contractTerms/signDate/signPlace/marks/packagingMode/totalPackages/totals/sourceId/_unknown{quoteLayout,customCells,productImage}`
- settings：`company/contact/defaultCurrency/sellerAddress/ai/entitlements/stations/factories/marketQuotes` 等——**无 fx/fee_rate/成本任何字段**
- 产品：自由对象 + `profileValid` 数值校验（mesh/wire/width/rollLen/price/尺寸/包装 13 个数值键），已有 `productSpecs`（结构化规格）、`specOptions`、`imageData`、`pitch/hsCode/salesPitch/note`——**无 specText、无成本字段**

## 3. 迁移机制（v5 必须沿用的通路）

- 主进程 `SBW.migrate()` → `migrateV2toV3` → `migrateV3toV4`，**纯函数、不写盘**
- 原则（写死在代码注释里）：缺字段才补待补值；已有值原样保留并校验；未知字段/行身份/来源关系/历史合计**一律原样延续**；逐条校验，异常整次停止并报位置；产物必须过 validateV4+validateWritable 双门，否则整体失败
- 失败行为：`enterBlocked('migrateFail')` → 程序进入**只读状态**，旧数据文件未被修改（store.js L298-313）
- 迁移报告字段：sourceVersion/legacyFormat/anomalies/duplicates/totalsDifferFromItems/addedDefaults
- **v5 结论**：沿此链新增 `migrateV4toV5` 纯函数即可，机制完备，无需自建

## 4. 报价明细真实数据流

1. 选品：产品库 → `QuoteEdit.draft.items[]`（行含 productId/nameCn/nameEn/mesh/wire/width/rollLen/qty/price/unit…）
2. 金额：`MODEL.documentTotals(items)` = Σ round2(qty×price)，**subtotal=grand，无任何费率/利润计算**；PL 走 `packagingTotals`（mixed/separate 两种包装模式）
3. 草稿校验：行级 issues（待修正）阻断合计显示——"绝不用算出来的数冒充有效"
4. 落盘：`Doc.previewCommit`（纸面 contenteditable 直改）→ `writeDocument`（写门校验）
5. 行快照机制已存在：单据行是产品资料的**克隆**，改产品库不影响历史单（天然满足 P1-B 快照要求，成本快照可依此模式）

## 5. 单据转换（QT↔PI↔SC↔CI↔PL）

`buildConversionDraft`（model.js L1001）：行克隆换 `_rowId`；金额类→PL 时 price/amount/hsCode 删除，**包装四件套一律置 null 待补（严禁从 qty 猜）**；PL→金额类直接拒绝；卖方快照/客户/买方地址/通用文本逐字段延续；`sourceId` 记来源。**成本快照字段加入 ITEM_KEYS 后，转换会自动随行克隆延续（克隆整行），符合"报价参数跟单走"的要求。**

## 6. PDF 导出与打印模板关系

- `pdf-export.cjs`（仅主进程）：不收 HTML/文件名/路径，只收 `documentId` → `store.readSavedDocument` → `Sheet.build(doc)` → 隐身窗口打印 PDF
- 文件名：`safeName()` = `TYPE-no.pdf`（**P2-C 文件名规则改这里一处即可**）
- 页边距：`@page{margin:12mm 12mm 16mm}`（**P2-C 润成边距方案在此对齐**）
- CSP 严格（img-src data:——LOGO base64 内嵌方案兼容）
- 纸面模板 5 套：basic-v1/trade-v1/jr-pi-v1/packing-ref-v1/shipping-mark-v1，未知模板按基础版渲染并留注记

## 7. 装柜预排取数（与 PL 的关系）

- **装柜取数来自产品库包装字段**（`packageLength/Width/Height、unitsPerCarton、grossWeight`，pages.js LoadPlanner），入口 `Prod.toLoadPlanner(productId)`；20GP/40HQ + 箱间预留，几何预排 + Three.js 三维
- **PL 行包装四件套是单据事实**（packages/net/gross/volume），与装柜取数是两条独立通路，P2-E 联动时需要在"报价确认 → PI/PL → 装柜"之间显式桥接（PL 行包装是人工核对后的实际值，装柜用产品库默认包装，两者用途不同，方案中不得混写）
- 防护注释明确：系统**不会**从丝网规格猜包装尺寸或重量——与"尺寸重量按需填写"的用户指示一致

## 8. 基线哈希（0.2.17-src 关键文件，dev 副本创建时核对）

```
23abf7b9…3781 app/app.js            3339c643…3924 app/feature-windows.js
76102c5c…5638 app/learning-panel.js  （其余 31 个 .js 全量清单在副本创建时比对）
```
全量 `find . -name "*.js" -not -path "*/node_modules/*"` 共 **31 个文件**；包内 node_modules 16 个生产依赖。

## 9. 与润成 V3 的字段映射（已核实）

| 润成 | 丝网盒子 | 备注 |
|---|---|---|
| items.name_en / spec | items.nameCn / **specText（新增）** | 名称/规格独立两字段 |
| items.cost_factory/packing/inland/other + cost_confirmed | **新增** 5 键 | cost_packing 语义=本行总价（引擎内÷qty） |
| items.final_price | items.price | 手填价保护见公式报告 §5 |
| quotes.fx/fee_rate/target_margin/commission_rate/freight_markup | **新增** doc 键 | 比例口径 0.03=3% |
| quote_freight[] | **新增** doc.fees[] | 含 charge_customer/included_in_cost/confirmed |
| products.code | products.sku | 去重键 |
| products.spec | products.specText（新增） | 自由文本，不转换 |
| buyer_* | customer + buyerAddress | 客户阶段映射 P2-D |

## 10. 审计结论

丝网盒子迁移机制（双门校验+纯函数迁移链+失败只读）和行快照机制质量很高，v5 升版技术路径无障碍；包内无测试套件是最大短板，P1-A 建立 tests/pricing/ 后需同步补丝网盒子侧冒烟脚本。
