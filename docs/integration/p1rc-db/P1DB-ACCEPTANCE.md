# P1-RC-DB · 独立验收报告

**结论**：数据底座完成，只改 2 个文件（`app/model.js`、`app/store.js`），
未动 UI / 定价 / PDF / Schema 版本。全量回归 1442 项 + 新增 73 项 + 真实数据 22 项全部通过。

## 1. 基线核对（先排除"用错包"的风险）

| 项 | 结果 |
|---|---|
| 起点 ZIP | `siwang-box-p1d05-fix01a-20261122.zip` |
| SHA-256 | `4296c2e0aa445fca308fb3f30ce601c377aacc775d9478011eb335acac017ea0` ✅ 与既定值一致 |
| 解压 | 563 文件，包内根清单 **562/562 OK** |
| 与生产一致性 | 生产 `siwang-box-latest/resources/app/package.json` = 0.2.18（同一 fix01a） |

**fix01 → fix01a 差异复核**（证明未丢失已上线修复）：

| 检查 | 结果 |
|---|---|
| 相对 fix01 修改文件 | 9 个（含 `app/pages.js`、`app/real-images.js`、`main.js`、3 个 E2E 脚本、3 个清单） |
| `real-images.js` degraded 回退 | 存在 ✅ |
| `pages.js` custom 缺图归一化 | 存在 ✅ |
| `main.js` `SBW_PICK_FILE` 测试钩子 | 存在 ✅ |
| `app/pricing.js` 是否被 fix01a 改动 | **未改动** ✅ |

## 2. 本轮改动

| 文件 | 变更 |
|---|---|
| `app/model.js` | 新增产品多图/扩展文本、客户扩展、供应商结构的校验（读门 + 写门共用），并导出新常量与函数 |
| `app/store.js` | 新增 `productImagesOf`、`suppliers/addSupplier`、`supplierQuotes/addSupplierQuote`、`settingsProfile/saveSettingsProfile`；`profileValid` 接入新校验 |
| `tests/p1db/run.js` | 新增 73 项数据底座测试 |

差异统计（对 fix01a 基线）：**修改 2 / 新增 11 / 删除 0 / 未修改 560**，受保护文件全部一致。
详见 `CHANGE-VS-FIX01A.txt`、`P1DB-changes.list`、`P1DB-file-manifest.json`。

## 3. 测试结果

| 套件 | 断言 | 结果 | 日志 |
|---|---|---|---|
| `tests/schema` | 194 | PASS 194 / FAIL 0 | `P1DB-regression-schema.log` |
| `tests/p1c` | 229 | PASS 229 / FAIL 0 | `P1DB-regression-p1c.log` |
| `tests/p1d` | 51 | PASS 51 / FAIL 0 | `P1DB-regression-p1d.log` |
| `tests/p1d3` | 117 | PASS 117 / FAIL 0 | `P1DB-regression-p1d3.log` |
| `tests/pricing` | 851 | PASS 851 / FAIL 0 | `P1DB-regression-pricing.log` |
| **原有合计** | **1442** | **全部通过** | — |
| **`tests/p1db`（新增）** | **73** | **PASS 73 / FAIL 0** | `P1DB-regression-p1db.log` |
| **真实生产数据副本往返** | **22** | **PASS 22 / FAIL 0** | `P1DB-realdata-result.json` |

### 新增测试覆盖（73 项）

| 组 | 覆盖点 |
|---|---|
| A 产品多图（18） | 三类型、排序、说明、上限 12、非法类型/数据/说明/sort 拒绝、旧数据合成、不写回、旧字段不被改写 |
| B 扩展文本（4） | 写入重开、超长/非字符串拒绝、旧产品兼容 |
| C 客户（9） | 六字段落库、重开、旧客户兼容、局部更新不丢字段、非法日期/类型拒绝、历史单据快照不变 |
| D 供应商（15） | 新增/重开、采购价字段完整、按产品过滤、**只增不改**（同参数两条）、无 update/delete、负价/未知币种/产品不存在/供应商不存在/空名拒绝、仍在 `_unknown` |
| E 设置（12） | 公司 8 项 / 银行 5 项 / 默认 5 项、重开一致、**不覆盖旧配置**、四项非法默认值拒绝、旧设置读取回退 |
| F 兼容（7） | Schema 仍 5、历史单据 JSON 完全未变、counters 未变、产品客户未丢、`.bak` 生成、运行全程 `pricing.js` 未变 |
| G 模型门（7） | `validateV5` / `validateWritable` 接受新结构、拒绝非法多图/未知币种、常量导出、版本仍 5 |

### 真实数据往返（22 项）

以生产 userData **备份副本**为输入：加载 18 产品 / 10 单据 → 写入多图/客户扩展/供应商/设置 →
落盘 → 重开 → 断言：

- 历史单据 JSON **完全未变**（`documentsUnchanged = true`）；
- 产品仍 18 个、原 `imageData`/`realImageData`/`realImageMode` 未改写；
- 供应商采购价 2 条（只增不改）；设置读取一致；
- 顶层未新增 `suppliers`/`supplierQuotes`；`validateV5` 与 `validateWritable` 均通过。

## 4. 保护要求逐项核对

| # | 要求 | 结果 |
|---|---|---|
| 1 | Schema 保持 V5 | `schemaVersion = 5`，`model.SCHEMA_VERSION === 5` ✅ |
| 2 | `pricing.js` 禁止修改 | SHA-256 `390ef0a65789d680…` 与基线**逐字节一致** ✅ |
| 3 | 不改定价公式 | 未触碰 `pricing.js` / 计算路径 ✅ |
| 4 | 不改五类 PDF 模板 | `sheet.js`/`sheet-rc.js`/`pdf-export.cjs` 与基线一致 ✅ |
| 5 | 不改历史单据金额与快照 | 往返测试 JSON 深比较相等 ✅ |
| 6 | 不删除现有产品/客户/图片 | 产品 18、客户保留；图片字段原样 ✅ |
| 7 | 不修改生产 userData | 全程只用**副本**；生产 `siwangbox-v5.json` 哈希仍 `1b80a96b…` ✅ |
| 8 | 不覆盖正式运行程序 | `siwang-box-latest` 未改动（0 文件变更） ✅ |
| 9 | 保留装柜/计算工具/AI 导入 | 未改 `pages.js`/相关模块，相关回归全绿 ✅ |
| 10 | 不执行 P6 历史迁移 | 未写任何迁移脚本、未导入历史数据 ✅ |

## 5. 交付物

| # | 要求 | 位置 |
|---|---|---|
| 1 | 完整工程 ZIP | `siwang-box-p1rc-db-20261122.zip` |
| 2 | SHA-256 | 同名 `.sha256` |
| 3 | 修改文件清单 | `docs/integration/p1rc-db/P1DB-changes.list` |
| 4 | 完整代码差异 | `CHANGE-VS-FIX01A.txt`（不截断）+ `P1DB-file-manifest.json` |
| 5 | 新增测试原始日志 | `P1DB-regression-p1db.log`、`P1DB-realdata-result.json` |
| 6 | 全量回归日志 | `P1DB-regression-{schema,p1c,p1d,p1d3,pricing}.log` |
| 7 | 数据模型变更说明 | `P1DB-DATA-MODEL.md` |
| 8 | 独立验收报告 | 本文件 |

## 6. 如实说明

1. **本阶段只做数据与存储底座**：新字段/新接口已可用，但界面尚未接入（P2/P3 才做 UI）；
2. 供应商数据暂存 `_unknown`，**未升 V6**；是否升版待评审（见调查报告 `08` Q1）；
3. 新测试为"合成旧数据 + 真实生产副本"双路验证；合成数据不含 `specs`，
   真实副本路径额外加载 `product-specs.js` 以覆盖结构化参数产品；
4. `productImagesOf` 对旧产品的合成图**只读不写回**，避免未经确认地批量改写产品库；
5. 生产程序与生产数据全程未写入；所有构建与测试在 `P1-DataBase-20261122/` 隔离副本内完成。
