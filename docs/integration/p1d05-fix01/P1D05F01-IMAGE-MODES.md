# P2：产品实物图三态（自动 / 自定义 / 不使用）

## 1. 状态模型

新增**可选**产品字段 `realImageMode`，取值 `auto | custom | none`：

| 状态 | 含义 | 纸面 PHOTO | `realImageData` |
|---|---|---|---|
| `auto`（默认，缺省即此态） | 按已核实的原版关联使用内置实拍 | 有匹配→内置图；无匹配→`NO IMAGE` | 保存时清空 |
| `custom` | 用户上传/明确选定的实物图，优先于内置 | 用户图 | 保存用户图（base64，≤1000100） |
| `none` | 用户明确不使用 | 固定 `NO IMAGE`，**永不自动带入** | 保存时清空 |

## 2. 单一解析口径（`app/real-images.js`）

```js
modeOf(p):
  显式合法 realImageMode → 该值
  否则若存在 realImageData（阶段二旧数据） → 'custom'   // 兼容，保持「自定义优先」
  否则 → 'auto'

resolve(p):
  none   → {mode:'none',  data:''}
  custom 且 realImageData → {mode:'custom', data:realImageData}
  custom 但图缺失 → 回退内置（不留空白）
  auto   → {mode:'auto', data: forProduct(p)}   // 未匹配即空
```

阶段二及更早数据（有图无状态字段）**不会被静默改成自动匹配**，仍按自定义优先解析。

## 3. 校验与持久化

| 位置 | 行为 |
|---|---|
| `app/model.js` | `realImageMode` 非空且不在枚举内 → 校验错误（不升级 Schema V5，字段可选） |
| `app/store.js` | 同上，写入前拒绝非法状态 |
| `app/product-import.js` | 产品包带 `realImageMode` 时按枚举校验并保留；无该字段视为 auto（兼容旧包） |
| `app/pages.js` `Prod.save()` | 写 `realImageMode`；`custom` 才写 `realImageData`，auto/none 清空自定义数据 |
| `app/pages.js` `Doc.pickProduct()` | 快照写 `_unknown.realImage`（解析结果）+ `_unknown.realImageMode`，重开/转换后一致 |
| `app/sheet-rc.js` | 纸面 PHOTO **只读** `_unknown.realImage`；规格图 `productImage` / `imageData` 绝不回退 |

规格图 `imageData` 与实物图 `realImageData` 始终分离，历史单据的
`_unknown.productImage` 快照原样保留。

## 4. 界面

产品表单「产品实物图」区提供三个并列入口：

- **上传自定义实物图** → `custom`
- **恢复默认实物图** → `auto`（并清空自定义图）
- **不使用实物图** → `none`（并清空自定义图）

上方实时显示当前状态：
`当前：自动匹配（使用原版内置实拍）` /
`当前：自动匹配（该产品无已核实内置实拍，纸面 NO IMAGE）` /
`当前：自定义实物图（优先于内置图）` /
`当前：不使用实物图（客户纸面显示 NO IMAGE，且不会自动带入内置图）`

截图：`compare/IMAGE-MODES-3STATES.png`（三态并列）。

## 5. 验证

`P1D05F01-image-modes.test.cjs`（Node，20 项）全通过：
状态枚举、缺省 auto、非法值回落、旧数据等价 custom、P01→p4 / P02→p1、
未匹配为空、none 优先于残留数据、custom 覆盖内置、custom 缺图回退、
纸面 none→NO IMAGE、纸面代码只读 realImage、表单入口齐备、校验层枚举。

Electron E2E 新增三场景（34 项）：

| 场景 | 断言 | 关键验证 |
|---|---|---|
| `S5C-IMAGE-NONE` | 13 | 三按钮齐备、切到不使用、保存后 `realImageMode=none` 且无图数据、纸面快照为空、A4 显示 NO IMAGE、重开仍为不使用 |
| `S5B-IMAGE-CUSTOM` | 11 | 自定义预览、保存为 custom、图已落库、内置 `forProduct` 未被覆盖、解析自定义优先、纸面快照用自定义图、规格图快照独立、重开一致 |
| `S5A-IMAGE-AUTO` | 10 | 恢复默认、保存为 auto、清空自定义数据、解析回内置 p4、纸面快照回 p4、重开仍为自动 |

顺序安排为「不使用 → 自定义 → 自动」，最终产品回到 auto，保证后续五类 PDF 仍使用内置实拍。
