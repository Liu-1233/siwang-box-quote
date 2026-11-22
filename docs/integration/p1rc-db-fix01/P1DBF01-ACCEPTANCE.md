# P1-RC-DB-FIX-01 · 独立验收报告

**结论**：ChatGPT 验收提出的 3 个问题（BUG-01/02/03）全部修复；原有 1442 项全通过，
新增 73 + 59 + 20 项全通过；仅改 `app/model.js`、`app/store.js` 两个文件，
`pricing.js`、`pages.js`、五类 PDF 模板、Schema V5 全部未动。

## 1. 基线与版本核查

| 项 | 结果 |
|---|---|
| 起点 ZIP | `siwang-box-p1rc-db-20261122.zip`（`b1732dab…380ff9`，已校验） |
| 解压 | 578 文件，包内根清单 **577/577 OK** |
| 版本核查 | 见 `P1DBF01-VERSION-AUDIT.md`（源码 0.2.17 / 生产 0.2.18，同一套代码两个标签） |
| 版本动作 | **未升级任何版本号**（按任务书要求先提交核查） |

## 2. 修复内容

### BUG-01 · V5 读取门缺少客户与供应商校验

**问题**：`validateV5` 只校验产品多图与产品扩展字段；客户扩展与 `_unknown` 供应商结构只在
`validateWritable` 校验 → 坏数据可能"能读不能写"。

**修复**（`app/model.js`，`validateV5`）：

```js
if (isArr(obj.customers)) {
  obj.customers.forEach(function (c, ci) { validateCustomerExtras(c, 'customers[' + ci + '].', errors); });
}
validateSuppliers(obj, errors);
```

- 与写门调用**同一组函数**，错误文案与定位（`customers[0].archivedAt`、`_unknown.supplierQuotes[0].currency`）完全一致；
- 未改任何既有错误信息格式。

### BUG-02 · saveSettingsProfile 局部更新清空其他字段

**问题**：原实现从 `patch` 重建整个容器，未提交的键被写成 `''` 或 `null`，
"只改公司中文名"会把其余七项清空。

**修复**（`app/store.js`，重写 `saveSettingsProfile`）：

| 语义 | 新行为 |
|---|---|
| 未提交键 | 保持原值（基于已存容器合并） |
| 显式 `''` | 允许清空该文本字段 |
| 显式 `null` | 删除该键（文本）/ 置 `null`（默认参数） |
| 默认参数 | 只改提交的键；`null`/`''` 表示清除 |
| 组合校验 | 用**合并后**的 `feeRate + targetMargin` 判断，而不是只看本次提交值 |
| legacy 设置 | 只写 `companyProfile` / `bank` / `defaults` 三个新容器，
`company` / `contact` / `sellerAddress` / `pricingDefaults` 逐字节不动 |
| 空 patch | 返回 `false`，不写库 |

### BUG-03 · 产品多图空数组语义（P2 前置）

**修复**（`app/store.js`，`productImagesOf`）：按**字段是否存在**判断，而不是"数组是否非空"。

| 情况 | 行为 |
|---|---|
| `images` 字段不存在 | 合成旧图：`realImageData → main`、`imageData → spec`（只读不写回） |
| `images` 存在（含 `[]`） | 直接按它读取；**空数组 = 用户明确清空**，不再回退合成 |
| 两种情况 | `imageData` / `realImageData` / `realImageMode` 均不改写 |

## 3. 测试结果

| 套件 | 断言 | 结果 | 日志 |
|---|---|---|---|
| Schema | 194 | PASS 194 / FAIL 0 | `P1DBF01-schema.log` |
| P1-C | 229 | PASS 229 / FAIL 0 | `P1DBF01-p1c.log` |
| P1-D | 51 | PASS 51 / FAIL 0 | `P1DBF01-p1d.log` |
| P1-D-03 | 117 | PASS 117 / FAIL 0 | `P1DBF01-p1d3.log` |
| Pricing | 851 | PASS 851 / FAIL 0 | `P1DBF01-pricing.log` |
| **原有合计** | **1442** | **全部通过** | — |
| P1-RC-DB（上一轮） | 73 | PASS 73 / FAIL 0 | `P1DBF01-p1db.log` |
| **P1-RC-DB-FIX-01（新增）** | **59** | **PASS 59 / FAIL 0** | `P1DBF01-fix01.log` |
| 真实生产数据副本验证 | 20 | PASS 20 / FAIL 0 | `P1DBF01-realdata-result.json` |

### 新增 59 项覆盖点

| 组 | 覆盖 |
|---|---|
| BUG-01（17 项） | 非法 `archivedAt`、非法 `currency`、`suppliers` 非数组、报价缺 `price`、`_unknown` 非对象 → **读门与写门同时拒绝**；错误定位保留（`customers[0]` / `supplierQuotes[0]` / `_unknown.suppliers`）；合法旧客户与合法新结构两门均通过 |
| BUG-02（28 项） | 只改公司中文名 / 只改银行名 / 只改汇率 / 显式 `''` 清空 / 显式 `null` 清除 / 合并后组合校验拒绝 / 空 patch 不写 / legacy 全程不变 / 重启后一致 |
| BUG-03（10 项） | 无 `images` 字段合成旧图、空数组不回退、空数组持久化、旧字段不被改写、恢复字段后重新合成、排序正确 |
| 不变量（4 项） | Schema 仍 5、历史单据 JSON 未变、单据总额未变、最终库两门同时通过 |

### 真实数据（20 项）

以生产 userData **副本**为输入：18 产品 / 10 单据 →
局部改公司名后其余字段不变 → 银行只改名称其余 4 项不变 → 默认参数只改汇率其余不变 →
`null` 清除毛利率其余不变 → legacy 设置未被覆盖 → 真实产品写空数组后不再合成且旧图字段不变 →
重开（新实例）全部一致、历史单据 JSON 完全未变。

## 4. 保护要求核对

| # | 要求 | 结果 |
|---|---|---|
| 1 | 不修改 `app/pricing.js` | SHA `390ef0a6…` 与基线逐字节一致 ✅ |
| 2 | 不修改 `app/pages.js` | SHA `9d23d9ab…` 与基线一致 ✅ |
| 3 | 不改五类 PDF 模板 | `sheet.js` / `sheet-rc.js` / `reference-sheets.js` / `pdf-export.cjs` 全部 SAME ✅ |
| 4 | 不升级 Schema V5 | `schemaVersion=5`、`MODEL.SCHEMA_VERSION=5` ✅ |
| 5 | 不改历史单据及快照 | 往返 JSON 深比较相等 ✅ |
| 6 | 不改生产 userData | 全程使用副本；生产哈希仍 `1b80a96b…` ✅ |
| 7 | 不覆盖正式运行程序 | `siwang-box-latest` 0 文件变更 ✅ |
| 8 | 不开始 P2/P3 | 未改 UI、未加界面入口 ✅ |
| 9 | 保留所有现有功能 | 1442 项回归全绿 ✅ |

## 5. 改动清单（对上一轮交付）

**修改 2**：`app/model.js`、`app/store.js`
**新增 12**：`tests/p1db-fix01/run.js` + `docs/integration/p1rc-db-fix01/` 下 9 份文档/日志/脚本 + 2 份结果
**删除 0**；未修改 574；受保护文件全部一致。

完整 diff：`CHANGE-VS-P1DB.txt`（不截断）、`P1DBF01-file-manifest.json`、`P1DBF01-changes.list`。

## 6. 交付物

| # | 要求 | 位置 |
|---|---|---|
| 1 | ZIP 完整交付 | `siwang-box-p1rc-db-fix01-20261122.zip` |
| 2 | SHA-256 完整清单 | `.zip.sha256` + 包内根 `SHA256SUMS.txt` + 目录清单 |
| 3 | 新增代码差异报告 | `CHANGE-VS-P1DB.txt` |
| 4 | BUG 回归测试 | `tests/p1db-fix01/run.js` + `P1DBF01-fix01.log` |
| 5 | 全量回归日志 | `P1DBF01-{schema,p1c,p1d,p1d3,pricing,p1db}.log` |
| 6 | 版本核查 | `P1DBF01-VERSION-AUDIT.md` |

## 7. 如实说明

1. BUG-02 的判定口径：**键存在即参与更新**（`null`/`''` 均为显式清除），不存在才保持原值；
   这与前端表单"只提交改动字段"的用法一致，但若将来界面整表提交，需改为提交全量而非依赖本语义。
2. `images: []` 后若用户想恢复旧图，必须显式删除 `images` 字段（当前无 UI，P2 再定交互）。
3. 供应商仍在 `_unknown`，未升 Schema V6（本轮不涉及）。
4. 版本号未改；0.2.17 与 0.2.18 的关系见版本核查报告，是否统一待评审。
