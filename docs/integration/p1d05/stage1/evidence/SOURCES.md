# P1-D-05 阶段一 · 只读调查数据来源与取证方法 / Sources & Methods

本文件记录本轮全部取证来源与命令，**证明所有结论来自真实原版/真实数据，而非推测或参考截图**。
本轮未修改任何业务代码、数据库、产品图片、生产程序或生产 userData。

---

## 1. 基线 / Baseline

| 项 | 值 |
|---|---|
| 正式上线版本 | `siwang-box-golive-0.2.17-20261121.zip` |
| SHA-256 | `f580d262f32b745cd736265d7e25b079283a45c08719e1fc79ea2e129a076810` |
| P1-D-04 候选包 | `siwang-box-p1d04-final-20261121.zip`（`f5dc992456cdac0514c08613735fbc2dc8776c747e745997899ce4a604cad3d9`） |
| 开发源码副本 | `siwang-box-main/`（本轮**只读**） |

---

## 2. 原版 RunCheng（用户以前实际使用的正式版本）

定位依据 `baojia/active-release.json`：

```json
{
  "version": "RunCheng V2 P1 20261104_070900",
  "port": 18786,
  "release_dir": "baojia/releases/v2-p1-candidate-20261104_070900",
  "database": "baojia/release-data/v2-20261103_235436/runcheng.db"
}
```

只读检查过的文件：

| 文件 | 用途 |
|---|---|
| `static/index.html` | 应用入口，6 项导航 |
| `static/app.js` | `quoteEditor()` 119–280；`itemCard()`；`addProduct()` 295–305 / 668–678；产品图片区 782 |
| `static/style.css` | 215 行 `.qi-thumb img{object-fit:cover}`；128 行 `.thumb` |
| `server.py` | 38–44 建表 `product_images`；498–506 上传；965 客户文档选图；1057 PI 渲染 |
| `quotation_render.py` | 98 纸面取图与回退；198 `.items .image img{object-fit:contain}`；261 表头 `No./Photo/...` |
| `release-data/v2-20261103_235436/runcheng.db` | SQLite 只读查询 `product_images`；共 4 行，全 `img_type='main'` |
| `release-data/v2-20261103_235436/images/` | 4 张图片，人工逐张判读类型 |
| `docs/acceptance_2026-11-02_complete/screenshots/04_details_1440.png` | **真实录入界面全页长图**（1440×3026） |
| `docs/p0_20261104_exec/evidence/shot_print_quotation_q3.png` | 原版 Quotation 打印预览，PHOTO 栏真实场景照片 |
| `docs/p0_20261104_exec/evidence/shot_quote19.png` | 报价**列表页**（已确认不是录入编辑器，未当界面依据） |

---

## 3. 当前丝网盒子（只读）

| 文件 | 关键行 / 结论 |
|---|---|
| `app/pages.js` | 1562–1563 分区注释；1601 `rc_order_card`；1636 `rc_items_card`；986 `it._unknown.productImage = p.imageData`；3889 `productImage()` 校验 |
| `app/sheet-rc.js` | 243 `Ref.image(it._unknown && it._unknown.productImage)`；248 `<img class="rc-photo">` |
| `app/app.css` | 544 `.rc-sheet .rc-photo{width:79px;height:66.5px;object-fit:cover}`；`.rc-items tbody tr{height:93px}` |
| `app/reference-sheets.js` | `Ref.image()` 仅正则 + 长度校验 |
| `app/model.js` | 85 `ITEM_KEYS` 含顶层 `productImage`（实现实际用 `_unknown`）；`validateV5` 对 `imageData` 的校验 |
| `app/local-image.cjs` | 图片选取/压缩，丢弃原文件名 |
| `main.js` / `preload.js` / `storage.js` / `pdf-export.cjs` | `product:pickImage` IPC；图片内联 JSON；预览与 PDF 同源 |

---

## 4. 数据备份（生产数据的只读副本，非生产本体）

| 项 | 值 |
|---|---|
| 路径 | `GoLive-20261121/backups/prod-userdata/data/siwangbox-v4.json` |
| SHA-256 | `eb48b3edda91742bc397e9490fb79ac3a3ba3900aa04c6bd0fb8e3cb0ea0a286` |
| 统计 | `schemaVersion 4`；2 customers / 18 products / 5 documents / 1 quotesArchive |
| 图片 | 16 个产品有 `imageData`，2 个无图；全部 `data:image/jpeg;base64,` |

**生产本体**（`C:/Users/17796/AppData/Roaming/丝网盒子/`）与
**生产程序**（`siwang-box-latest/`）本轮**全程未写入、未读取修改**。

图片原始来源对照：`资料分析/产品目录_20261028/` 下 16 个 JPG 与 `imageData` 解码字节一致
（例 `P01_马场围栏_Horse-Fence.jpg` 422259 bytes）。
另排查 `baojia/reference/lin/fence_media/` 11 张素材，确认不是按产品一一对应的实物图集。

---

## 5. 截图取证方法 / Screenshot method

**当前录入界面实拍**（`screenshots/SIWANG-editor-current.png`）：

1. 从只读备份复制 `siwangbox-v4.json` 到全新隔离 UD：
   `E:/CDriveMigration/Temp/p1d05/ui/ud/data/`（**不包含任何生产目录**）。
2. 从 v4 只读挑一张有明细的历史单据：`QT-202610-0001`
   （id `4982e3ec-8bc3-4e52-b2b1-defa705ae723`，1 行明细）。
3. 用现有 Electron 测试钩子启动 `siwang-box-main`（**未改源码**）：

```bash
env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS \
  SBW_USERDATA="E:/CDriveMigration/Temp/p1d05/ui/ud" \
  SBW_SHOT="<out>/current-quoteEdit.png" \
  SBW_SHOT_DELAY=4000 SBW_CLOSE_TEST=1 SBW_WIN_SIZE=1600x1000 \
  SBW_EVAL="(function(){Doc.openEditor('4982e3ec-8bc3-4e52-b2b1-defa705ae723','QT');return {...};})()" \
  siwang-box-main/node_modules/electron/dist/electron.exe siwang-box-main
```

输出：`EVAL_RESULT={"page":"quoteEdit","no":"QT-202610-0001","items":1}`、
`CAPTURED size=1600x1000`、`CLOSE_TEST_DONE`。
隔离 UD 内发生的 v4→v5 迁移只作用于该副本。

**图片拼图**（只读辅助脚本，位于 `E:/CDriveMigration/Temp/p1d05/`）：
`make_contact_sheet.py`、`make_fence_sheet.py` —— 仅解码 base64 / 读取图片并拼图，不写回任何数据。

**并排对照图**：`make_ui_compare.py` 读取上述真实截图合成，中文标题用 `C:/Windows/Fonts/msyh.ttc`。
输出 `screenshots/UI-COMPARE-firstscreen.png`（2800×1046），已人工复核无裁切/黑屏/乱码。

---

## 6. 本轮产物 / Deliverables

```
P1-D-05/
├── P1D05-INVESTIGATION.md      主报告（结论 + 关键阻塞点 + 待决策）
├── P1D05-UI-DIFF.md            附件 A：录入界面差异清单
├── P1D05-IMAGE-MAPPING.md      附件 B：图片字段映射 / 取图 / 裁切 / 回退规则
├── evidence/
│   ├── SOURCES.md              本文件
│   └── SHA256SUMS.txt          本交付目录文件级哈希清单
└── screenshots/
    ├── UI-COMPARE-firstscreen.png
    ├── RUNCHENG-editor-full.png
    ├── SIWANG-editor-current.png
    ├── RUNCHENG-quotation-print-PHOTO.png
    ├── IMG-RUNCHENG-4-images.jpg
    └── IMG-SIWANG-16-products.jpg
```

---

## 7. 状态 / Status

**调查完成，按任务书「无法确认时先报告」暂停，未进入实施。**
等待用户选择实物图来源方案与确认回退口径后，再执行任务书执行顺序第 3–5 步。
