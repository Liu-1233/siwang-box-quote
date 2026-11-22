# P2 · 产品实物图真实上传链路测试

## 1. 要验证的真实链路

```
渲染进程 Prod.pickRealImage()
  → preload.js  SBW.pickProductImage()          （contextBridge，不暴露任意路径）
  → IPC         'product:pickImage'
  → 主进程      createImagePicker(app/local-image.cjs)
  → dialog.showOpenDialog                       （系统文件对话框）
  → 读取文件 → 8MB 限制 → PNG/JPEG 魔数校验
  → nativeImage 解码 → 像素上限 → 长边 >1000 自动缩放
  → toJPEG(85) → 体积上限 → data:image/jpeg;base64,…
  → 渲染进程写入 realImageDraft → 保存 → 重开
  → 单据快照 _unknown.realImage → A4 预览 → 导出 PDF
```

FIX-01 的三态测试是直接给 `realImageDraft` 赋值的，**没有经过上面这条链路**。
本轮补的是「真实上传」：必须让 IPC 与主进程处理器真正跑一遍。

## 2. 测试钩子（仅测试模式）

`main.js` 注册图片选择器时：

```js
const pickDialog = (OFFSCREEN && process.env.SBW_PICK_FILE)
  ? {showOpenDialog: async () => ({canceled:false, filePaths:[process.env.SBW_PICK_FILE]})}
  : dialog;
ipcMain.handle('product:pickImage', createImagePicker({dialog:pickDialog,...}));
```

- 只替换「系统文件对话框」这一步，**其余全部是生产代码**：IPC、来源校验、
  文件读取、大小/魔数校验、nativeImage 解码、缩放、JPEG 转码。
- 仅 `OFFSCREEN`（截图/测试）且显式设置 `SBW_PICK_FILE` 时生效；
  正常运行不设该变量，行为与基线完全一致。

测试素材：`TestAsset-upload-640x480.png`（640×480 PNG，画面带文字便于识别）。

## 3. E2E 场景 `S6-UPLOAD-REAL`（19 项断言，全通过）

| 断言 | 验证点 |
|---|---|
| 上传前为自动匹配 / 预览为内置图 | 起点状态正确 |
| 上传返回非空图片（length > 100） | IPC 链路有返回 |
| **返回值为 `data:image/jpeg`（源文件是 PNG）** | 证明确实经过 nativeImage 解码 + toJPEG 转码，而非直接透传 |
| 上传图与内置 p4 不同 | 未被内置图顶替 |
| 上传后状态 custom、预览即为上传图 | 界面即时一致 |
| 产品保存成功、状态持久化 custom、上传图已落库 | 落盘 |
| **规格图 `imageData` 未被改动** | 规格图与实物图分离 |
| 纸面快照使用上传图、记录 custom | 快照 |
| A4 预览 HTML 含上传图 base64 | 纸面预览 |
| 新建 QT 保存成功、单据快照保持上传图 | 单据落盘 |
| 重开仍为自定义、预览仍为上传图 | 重开一致 |

## 4. PDF 级验证（纸面最终产物）

对 S6 生成的单据（`QT-202611-0003`）走生产导出通道导出：
`pdf-upload/QT-upload.pdf`（1 页，128,466 bytes）。

内嵌图像尺寸：

```
img 638 x 401  /DCTDecode   ← LOGO
img 640 x 480  /DCTDecode   ← 上传的测试图（与源文件 640×480 完全一致）
```

内置图尺寸分别为 638×401 / 900×900 / 672×671，**640×480 只可能来自本次上传**，
证明上传图确实进入了 PDF 纸面 PHOTO 列，而不是被内置图替换。

渲染图：`pdf-render/UPLOAD-QT-p1.png`；界面截图：`screenshots/S6-UPLOAD-REAL.png`
（可见三个按钮、「当前：自定义实物图」与蓝色测试图预览）。

## 5. 复跑

```bash
SBW_SHOT_CDP=1 SBW_ROOT="$PWD" SBW_E2E_DIR=/tmp/e2e SBW_E2E_SEED=/path/to/ud \
SBW_E2E_PICK_IMAGE="$PWD/docs/integration/p1d05-fix01a/TestAsset-upload-640x480.png" \
SBW_ELECTRON=/path/to/electron \
node docs/integration/p1d05/P1D05-e2e-runner.js
```
