# P1 · SHA256SUMS 清单生成顺序修复

## 1. 缺陷（FIX-01 遗留，已在交付包中复现）

沿交付包逐目录校验，发现：

| 清单 | FIX-01 包内结果 |
|---|---|
| `docs/integration/p1d04/P1D04-SHA256SUMS.txt` | 62 / 62 OK |
| **`docs/integration/p1d05/SHA256SUMS.txt`** | **74 OK / 3 FAILED** |
| `docs/integration/p1d05-fix01/SHA256SUMS.txt` | 69 / 69 OK |
| 包根 `SHA256SUMS.txt` | 517 / 517 OK |

失效的 3 条正是 FIX-01 改动过的 E2E 脚本：

```
P1D05-e2e-driver.js: FAILED
P1D05-e2e-runner.js: FAILED
P1D05-e2e-scenarios.js: FAILED
```

**原因**：FIX-01 只重算了新建的 `p1d05-fix01/` 目录清单与包根清单，
没有重算被改动的 `p1d05/` 目录清单；也就是说「子清单 → 根清单」的先后关系
只对新建目录生效，对已存在目录没有强制，导致包内出现自校验失败的清单。

## 2. 修复

新增 `P1D05F01A-make-sums.py`，规则写死在脚本里：

1. **作用域按叶子 → 上层 → 包根排序**，包根最后写，因此根清单一定记录子清单的**最终**哈希；
2. 每个清单自身不计入本清单，但计入上层清单；
3. 生成后**立即逐条复算校验**（OK/FAIL/MISS）；
4. **断言包根清单包含每个子清单路径，且哈希等于子清单当前文件**；
5. 任一校验失败 → 退出码 1，不静默通过。

生效作用域：`docs/integration/p1d05`、`docs/integration/p1d05-fix01`、
`docs/integration/p1d05-fix01a`，最后包根。

> 历史目录（`p1d04/`、`acceptance/`、`fix-BUG-ACC-01/`、`p1d05/stage1/evidence/`）
> 的清单路径基准不同（分别相对包根 / stage1 目录），内容未被本轮改动，
> 保持原样不动，避免改写历史证据。

## 3. 验证结果

```
WRITE docs/integration/p1d05/SHA256SUMS.txt           77 entries
WRITE docs/integration/p1d05-fix01/SHA256SUMS.txt     69 entries
WRITE docs/integration/p1d05-fix01a/SHA256SUMS.txt     N entries
WRITE SHA256SUMS.txt                                  N entries

---- 生成后自校验 ----
docs/integration/p1d05/SHA256SUMS.txt          OK=77  FAIL=0 MISS=0
docs/integration/p1d05-fix01/SHA256SUMS.txt    OK=69  FAIL=0 MISS=0
docs/integration/p1d05-fix01a/SHA256SUMS.txt   OK=.. FAIL=0 MISS=0
SHA256SUMS.txt                                 OK=.. FAIL=0 MISS=0
ROOT 包含子清单且哈希一致: docs/integration/p1d05/SHA256SUMS.txt
ROOT 包含子清单且哈希一致: docs/integration/p1d05-fix01/SHA256SUMS.txt
ROOT 包含子清单且哈希一致: docs/integration/p1d05-fix01a/SHA256SUMS.txt
结论：PASS
```

`docs/integration/p1d05/SHA256SUMS.txt` 由 **74 OK / 3 FAILED → 77 OK / 0 FAILED**。

## 4. 复现

```bash
python docs/integration/p1d05-fix01a/P1D05F01A-make-sums.py   # 生成 + 自校验
cd docs/integration/p1d05 && sha256sum -c SHA256SUMS.txt      # 目录级
cd ../../../.. && sha256sum -c SHA256SUMS.txt                 # 包根
```
