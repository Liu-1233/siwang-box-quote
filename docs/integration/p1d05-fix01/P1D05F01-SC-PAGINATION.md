# P1：SC 合同 PDF 空白第二页 · 根因与修正

## 1. 实测定位（不靠截图猜测）

用 `P1D05F01-diag-pagination.cjs` 在**真实打印媒体**（`Emulation.setEmulatedMedia=print`）下
加载生产 `buildHtml` 产物，读取各块 `getBoundingClientRect()`：

| 单据 | 纸面总高(px) | A4 页高(px) | 溢出 |
|---|---|---|---|
| QT | 990.03 | 1122.52 | −35.05mm（余量充足） |
| PI | 1018.03 | 1122.52 | −27.65mm |
| **SC** | **1159.41** | **1122.52** | **+9.76mm（36.89px）** |
| CI | 1101.03 | 1122.52 | −5.69mm |
| PL | 1029.28 | 1122.52 | −24.67mm |

SC 分块高度（修正前）：

```
.rc-head        15.1 → 88.4
.rc-title-row  102.9 → 162.9   ← 60px（其它四类均为 30px）
.rc-info2      174.9 → 361.4   ← 186.5px（其它四类 150.1px）
.rc-items      371.4 → 825.9   ← 454.5px（SC 九列，SPEC 列更窄→行更高）
.rc-bottom     825.9 → 1025.9
.rc-sign      1052.9 → 1133.4  ← 已越过页底 1122.52
.rc-foot      1145.4 → 1159.4
```

## 2. 根因（两个叠加因素）

1. **重复元数据 30px**：`titleBlock()` 在 SC 标题行右上又印了一次
   `Sign Date` / `Sign Place`，而同一信息已在 `infoBlock()` 的 DOCUMENT INFO 中完整显示。
   这使标题行从 30px 变成 60px。
2. **SC 表格更高**：SC 为九列（多 `HS CODE`），SPEC 列变窄、长规格折行更多，
   明细区比 QT 高 63px；尾部（签名/页脚）已经被推到页底之外。

叠加后整页 1159.41px，超出 36.89px。由于 `.rc-sign` 是 **flex 容器**，
Chromium 对 flex 的 `break-inside: avoid` 支持不完整，签名区被从中间拆开，
最终只有页脚单独落到第二页 → 「空白第二页」。

## 3. 修正（三层，均不掩盖问题）

| 层 | 改动 | 作用 |
|---|---|---|
| 内容去重 | `app/sheet-rc.js` `titleBlock()` 移除 SC 重复的 Sign Date / Sign Place | −30px；信息仍在 DOCUMENT INFO 显示，五类标题行高度统一 |
| 结构保护 | 签名 + 页脚包成 `<div class="rc-tail">`，CSS `break-inside:avoid` | 签名与页脚**同页进出**，结构上不可能再出现「只有页脚的页」 |
| 尾部留白 | `.rc-sign` 上边距 27→24、`.rc-sign-space` 48→42、`.rc-foot` 上边距 12→10 | −11px；只动留白，不动边框/字号/列宽/行高 |

修正后 SC = **1118.41px**，页内余量 4.11px；五类全部 1 页。

> 未采用的做法：删第二页、隐藏页脚、裁切正文、缩小字号、改列宽。
> 若未来内容确实超过一页，`.rc-tail` 会整体后移，第二页必然带签名块（真实正文），
> 不会再出现孤立页脚。

## 4. 回归验证

`P1D05F01-verify-pagination.py`（逐页文本 + 正文标记 + 孤立页脚判定）：

```
[QT] 1页 每页正文[True] 孤立页脚=无 双签名=True
[PI] 1页 每页正文[True] 孤立页脚=无 双签名=True
[SC] 1页 每页正文[True] 孤立页脚=无 双签名=True
[CI] 1页 每页正文[True] 孤立页脚=无 双签名=True
[PL] 1页 每页正文[True] 孤立页脚=无 双签名=True
[8行] QT-8rows 2页 每页正文[True,True] 孤立页脚=无
[8行] SC-8rows 2页 每页正文[True,True] 孤立页脚=无
[SC 修正前] 2页 孤立页脚=[2]
[SC 修正后] 1页 孤立页脚=无
汇总：官方 5 份；孤立页脚页 0；问题 0
```

- 8 行自然分页：QT/SC 均 2 页，**每一页都有正文**，末页含签名与页脚；
- 五类 PDF 仍为统一 RC 版式、LOGO、金额汇总、大写、双签名、页脚齐全；
- 三张内嵌图（LOGO + 2 张实物图）与 `NO IMAGE` 行均保留。

证据文件：

- `compare/SC-BEFORE-AFTER.png` —— 修正前第 1/2 页与修正后单页三栏对照
- `pdf/` —— 修正后五类正式 PDF；`pdf-before/` —— 修正前 SC 样本
- `pdf-render/` —— 五类页面渲染图（含 SC 修正前后）
- `multipage/` —— 8 行自然分页样本（QT / SC）
- `P1D05F01-pagination.json`、`P1D05F01-pagination.log` —— 机器结果与原始日志
