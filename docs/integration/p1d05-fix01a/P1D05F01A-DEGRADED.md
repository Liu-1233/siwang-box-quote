# P3 · custom 状态自定义图缺失：提示 / 预览 / 纸面不一致

## 1. 问题复现（FIX-01 行为）

当产品 `realImageMode='custom'` 但 `realImageData` 为空（图被清理、数据损坏、导入缺图）：

| 层 | FIX-01 表现 | 结果 |
|---|---|---|
| 解析 `realImage.resolve()` | custom 缺图 → 回退内置图 | 纸面显示 **内置实拍** |
| 界面提示 | 仍显示「当前：自定义实物图（优先于内置图）」 | 说**自定义** |
| 预览 | `productImage(draft)` → 空 → 「不使用实物图或无可用作内置实物图」 | 说**无图** |
| 保存 | `mode='custom'`、`realImageData=''` | 状态**保持 custom** |

四处结论互不相同：提示说自定义、预览说没图、纸面却有内置图。

## 2. 修复：单一解析结果驱动全部四层

`app/real-images.js` 的 `resolve()` 增加两个字段：

```js
{ requested: 用户声明的状态, mode: 实际生效状态, data: 实际用图,
  builtIn: 内置图, degraded: 是否发生「custom 缺图」回退 }
```

- `custom` 有图 → `{mode:'custom', data:自定义图, degraded:false}`
- `custom` 无图 → `{requested:'custom', mode:'auto', data:内置图(或空), degraded:true}`
- `none` / `auto` → `degraded:false`

界面与保存改为读同一个判断：

| 层 | 修复后行为 |
|---|---|
| 提示 | 「当前：自定义实物图缺失，已回退自动匹配（预览与纸面使用内置实拍；保存后状态变为自动匹配）」；无内置图时提示「预览与纸面均为 NO IMAGE」 |
| 预览 | `productImage(draft) || productImage(auto)` —— 与纸面同图，不再显示「无图」 |
| 保存 | `custom` 且无图 → 归一为 `auto`，并清空 `realImageData` |
| 纸面 | 继续只读 `_unknown.realImage`（快照由 `resolve()` 产生），与预览同图 |

## 3. 验证

### Node 专项 `P1D05F01A-degraded.test.cjs`（11 / 11）

```
PASS A1 custom 缺图时标记 degraded
PASS A2 custom 缺图时生效状态归一为 auto
PASS A3 custom 缺图时数据回退到内置 p4
PASS A4 无内置匹配时回退为空（纸面 NO IMAGE）
PASS A5 custom 有图时不标记 degraded
PASS A6 none 不标记 degraded
PASS A7 auto 不标记 degraded
PASS B1 提示文案明确写出「缺失」与「回退」
PASS B2 预览在 custom 缺图时回退内置图（不再显示无图）
PASS B3 保存时把缺图的 custom 归一为 auto
PASS C1 归一回退后纸面输出实物图（与预览同图）
```

### Electron E2E `S5D-IMAGE-DEGRADED`（13 / 13）

流程：先存为正常自定义 → 直接把 `realImageData` 清空（状态仍 custom）→ 重开表单：

| 断言 | 结果 |
|---|---|
| 提示含「缺失」且含「回退」 | PASS |
| 预览回退到内置 p4，不再显示无图 | PASS |
| 保存后状态归一为 `auto`、不残留空图 | PASS |
| `resolve(fixed).degraded === false`，数据为 p4 | PASS |
| 纸面快照为 p4、状态 auto | PASS |
| A4 预览含 `rc-photo`（非 NO IMAGE） | PASS |
| 重开后显示「自动匹配」 | PASS |

截图：`screenshots/S5D-IMAGE-DEGRADED.png`（可见「自定义实物图缺失，已回退自动匹配」与内置图预览）。

## 4. 未改变的行为

- `custom` 有图：仍优先于内置，行为与 FIX-01 一致；
- `none`：仍永不自动带入，纸面 NO IMAGE；
- `auto`：仍按已核实关联使用内置图，未匹配为空；
- 规格图 `imageData` 与实物图 `realImageData` 仍完全分离；
- Schema V5 未升级，`realImageMode` 仍为可选字段。
