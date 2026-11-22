# P4：E2E 测试路径可移植化

## 1. 问题

阶段二的 `P1D05-e2e-driver.js` 顶部写死了：

```js
const ROOT = 'E:/WorkBuddyProjects/ChatGPT/丝网盒子 2/siwang-box-p1d05-work';
const ELECTRON = 'E:/WorkBuddyProjects/ChatGPT/丝网盒子 2/siwang-box-main/node_modules/electron/dist/electron.exe';
const ACC = 'E:/CDriveMigration/Temp/p1d05/work';
```

换机器、换盘符、换用户名或换解压目录后无法直接复跑，也不满足「独立复现」。

## 2. 修正后解析规则

| 变量 | 解析顺序 | 说明 |
|---|---|---|
| `ROOT` | `SBW_ROOT` → 由本文件位置上溯三级（`docs/integration/p1d05` → 工程根） | 任何解压目录都能自动定位 |
| `ELECTRON` | `SBW_ELECTRON` → 工程内 `node_modules/electron/dist` → 同级 `siwang-box-main/node_modules/electron/dist` → 上级 `node_modules/electron/dist` → `require('electron')` 解析目录 → PATH | 找不到时**明确报错退出**，不静默用错二进制 |
| `ACC` | `SBW_E2E_DIR` → `os.tmpdir()/siwang-p1d05fix01-e2e` | 不再依赖固定盘符 |
| 隔离数据 | `SBW_E2E_SEED` 指向一份 userData，首次运行自动复制到 `ACC/ud` | 可指定种子；已存在则沿用 |

代码中不再出现任何 `E:/`、`C:/`、用户名或固定目录。

## 3. 附带修正：离屏截图取帧

`main.js` 的测试钩子 `save()` 只写第一帧，离屏窗口滚动/弹窗后的画面会被首次绘制帧抢先写死，
导致「三态操作截图」拍不到实物图区域。新增 `SBW_SHOT_CDP=1` 时改用
`Page.captureScreenshot` 强制抓当前画面（**仅测试模式生效，正常运行路径不受影响**）。
三态场景另加「等弹窗布局稳定后滚到底」再截图。

## 4. 验证

| 验证 | 结果 |
|---|---|
| 原路径 `siwang-box-p1d05-fix01-work` | 108 / 108 断言通过 |
| **换路径副本** `E:/CDriveMigration/Temp/p1d05fix01/freshcopy`（整目录复制，模拟全新解压） | **108 / 108 断言通过** |
| 隔离 userData | 由 `SBW_E2E_SEED` 自动复制，未触碰生产 |

日志：`P1D05F01-e2e-full.log`（原路径）、`P1D05F01-e2e-fresh-copy.log`（换路径）、
对应 `P1D05F01-e2e-result.json` / `P1D05F01-e2e-fresh-result.json`。

## 5. 复跑方式

```bash
# 任意解压目录内
SBW_ROOT="$PWD" \
SBW_E2E_DIR=/tmp/swb-e2e \
SBW_E2E_SEED=/path/to/isolated-userdata \
SBW_ELECTRON=/path/to/electron \
SBW_SHOT_CDP=1 \
node docs/integration/p1d05/P1D05-e2e-runner.js
```

未设置 `SBW_ELECTRON` 时按上述顺序自动查找；找不到会打印
`FATAL 未找到 Electron 运行时：请设置 SBW_ELECTRON …` 并退出码 2。
