# P1-B 迁移设计说明：丝网盒子 Schema V5 与安全迁移

日期：2026-11-19
基线：P1-A-FIX-04 交付包（SHA-256 `0825a6f9…0ba6`）同步至开发副本 `siwang-box-0.2.17-dev`
性质：数据结构、校验、迁移与转换安全。**报价公式与 app/pricing.js 冻结未动。**

## 一、设计总览

沿用丝网盒子自 v3→v4 确立的「**版本隔离文件族**」架构，不原地升级：

```
data/siwangbox-v5.json        ← 新版(v5)主数据文件，唯一权威
data/siwangbox-v5.json.bak    ← 上一次的 v5 数据（覆盖前强制快照）
data/backups-v5/              ← v5 每日备份（留最近 30 份）
data/siwangbox-v4.json        ← v4 只读迁移源（迁移后原样保留，绝不回写）
data/siwangbox-v3.json        ← v3 只读迁移源
data/siwangbox.json           ← v2 只读迁移源
```

- 启动优先级：v5 文件族（主/.bak/每日备份）→ 无任何 v5 痕迹才探测旧源（先 v4 再 v3 再 v2）→ 全无则 empty。
- v5 损坏时**绝不降级**读 v4（防止把最新数据悄悄换旧），只走备份恢复；不可恢复即只读。
- 迁移：探源 → 读 → 校验 → 原样备份旧源（`pre-v5` 审计快照，失败即停）→ 内存纯函数链 → validateV5 + validateWritable 双门 → 一次性原子落盘。**任何一步失败都在写盘之前返回，旧文件绝不改动。**

## 二、model.js 变更

| 项 | 说明 |
|---|---|
| `SCHEMA_VERSION = 5` | 主版本升 5 |
| `V4_VERSION = 4`（新增） | **明确保留**——validateV4 / migrateV3toV4 / emptyV4 全部改用 V4_VERSION，v4 校验与迁移规则一字不改 |
| `validateV5(obj)`（新增） | v5 读门：版本=5 + 集合形状 + 单据级 v5 键 + 产品库成本字段 |
| `validateV5DocKeys(d,…)`（新增） | 含全部 v4 规则 + 定价参数/fees 校验（见 §四） |
| `validateV5RowKeys(it,…)`（新增） | 行/产品同一套：specText 字符串或 null；成本有限非负或 null；costConfirmed 布尔或 null |
| `validateWritable(obj, ver)` | 按版本分派：`ver>=5` 走 v5 规则（单据级 validateV5DocKeys + 行级成本 + 产品库成本）；`ver=4` 走原 validateV4DocKeys，行为不变 |
| `validateDocumentStrict(…, v5Mode)` | v5Mode 时校验 v5 单据键与行键；v3/v4 中间产物不受影响 |
| `migrateV4toV5(v4, meta)`（新增） | 纯函数。**缺失才补** null/[]，已有值原样保留；逐条校验异常即整次停止；产物过双门 |
| `emptyV5(seedData)`（新增） | schemaVersion=5，migration `{fromV2:null, fromV3:null, fromV4:null}` |
| `buildConversionDraft` | →PL：显式 `delete` 全部成本字段（数据层剥离，不依赖 sheet.js 不渲染）；金额类目标整行克隆自然带成本快照与定价参数 |

### 迁移链（完整路径）

```
主进程 migrate()：  v4 → v5（migrateV4toV5）
                    v3 → v4 → v5（内存链，不落中间文件）
                    v2 → v3 → v4 → v5（内存链）
localStorage 链（store.js initFirstRun）：v2 → v3 → v4 → v5
导入（importText）：v5 直入；v4/v3/v2 → v5（内存链）
```

主进程通路核对：storage.js（load/probe/migrate/importText/save/restore/readSavedDocument 全部升级）；main.js 仅 `createStorage(app.getPath('userData'))` 传路径，**零改动**；preload.js 仅迁移注释文案更新；store.js localStorage 链补第三步 migrateV4toV5。

## 三、字段映射表

### 1. 单据级新增定价参数（v4→v5 迁移：缺失才补，已有值保留）

| 字段 | 类型 | 迁移默认 | 校验（null=历史未记录，绝不伪造） |
|---|---|---|---|
| `fx` | number/null | null | null 或 有限 >0 |
| `feeRate` | number/null | null | null 或 [0,1) |
| `targetMargin` | number/null | null | null 或 [0,1) |
| `commissionRate` | number/null | null | null 或 [0,1) |
| `freightMarkup` | number/null | null | null 或 ≥0 |
| `markupRate` | number/null | null | null 或 >0 |
| `feeInPrice` | 0/1/null | **null** | **只允许数字 0、1 或 null**；"1"/true/2 一律拒绝 |
| `pricingVersion` | string/null | null | null 或 非空字符串（记录 P1-A 定价引擎版本） |
| `fees` | array | **[]** | 数组；条目 `{amountCny: 非负两位小数, label?, note?, allocations?: [{sort, amountCny}] \| null}` |

### 2. 行级 / 产品库新增字段（同一套校验）

| 字段 | 类型 | 迁移默认 | 校验 |
|---|---|---|---|
| `specText` | string/null | null | null（未填写）或字符串 |
| `costFactory` | number/null | null | null（未填写）或 有限 ≥0 |
| `costPacking` | number/null | null | 同上（单位包装成本，按每个销售单位） |
| `costInland` | number/null | null | 同上 |
| `costOther` | number/null | null | 同上 |
| `costConfirmed` | true/false/null | null | null=未知（**绝不当作已确认**）；true=已确认；false=明确未确认 |

成本快照语义：报价明细行保存**转换/创建当时**的单位成本，产品库后续修改不影响历史单据。明确确认的零成本（0 + costConfirmed=true）合法；未确认的 0 只是"填了 0"。

### 3. 特别禁止项的实现方式

- 不填 6.6 / 3% / 20%：迁移对全部新键只写 `null` / `fees:[]`；`feeInPrice` 历史恒 null（未知≠含费），与 P1-A BUG-01 严格模式一致。
- 不重算历史成交价：迁移不触碰 `totals`、行 `amount/price`；测试断言手填合计 999.99/777.77 原样保留。
- 新报价默认参数由 P1-C 编辑器负责：store.js 的 `withV4DocDefaults` 对新单据补 null/[]（显式"未记录"），不设业务默认值。

## 四、转换规则变更（buildConversionDraft）

| 目标 | 行为 |
|---|---|
| →PI / →SC / →CI（金额类） | 整行克隆自然携带 specText + 四项成本 + costConfirmed（内部成本快照延续）；单据级定价参数与 fees[] 随 draft 克隆保留；sourceId 指直接源；行身份 _rowId 重新分配 |
| →PL（含 PL→PL 复制） | **显式删除** specText/costFactory/costPacking/costInland/costOther/costConfirmed（数据层剥离，不依赖 sheet.js 不渲染）；price/amount/hsCode 照旧剥离；包装四件套规则不变（金额类→PL 一律待补 null；同类复制原样带）；sourceId 保留 |

## 五、storage.js 变更清单

| 入口 | 变更 |
|---|---|
| 文件族 | 主文件 `siwangbox-v5.json`、备份 `backups-v5/`、每日备份前缀 `siwangbox-v5-`；新增 v4 只读迁移源 `siwangbox-v4.json` |
| `load()` | 优先 v5 族；无痕迹才探 v4→v3→v2；读门 validateV5；>5 unsupported 只读 |
| `probeLegacySource` | 支持 v4（validateV4）/v3（validateV3）/v2（validateV2）；损坏/不可读即停止不换源 |
| `migrate()` | 按源版本走对应链；`pre-v5` 强制快照；双门校验后才原子落盘；已存在 v5 → `ALREADY_V5` 拒绝重复迁移 |
| `save()` | 写门 validateWritable（v5 规则）；v4 数据直接拒绝（走导入迁移） |
| `restore()`/`backups()` | 仅接受/列出 v5 备份；v4 旧备份走「导入」迁移通道 |
| `inspectText`/`importText` | v4 分支：validateV4 + needsMigration + 迁移到 v5 |
| `readSavedDocument` | 读门 validateV5 |

## 六、修改文件清单

| 文件 | 变更类型 | 内容 |
|---|---|---|
| `app/model.js` | 修改 | SCHEMA_VERSION=5/V4_VERSION、v5 校验族、migrateV4toV5、emptyV5、buildConversionDraft 成本剥离 |
| `storage.js` | 修改 | v5 文件族、v4 迁移源、全入口升级（§五） |
| `app/store.js` | 修改 | seed/normalize/fromV4 标记、localStorage 链 +migrateV4toV5、V5_DOC_DEFAULTS、文案 |
| `preload.js` | 修改 | 仅迁移注释文案（v2/v3/v4 → v5） |
| `package.json` | 修改（**P0 阶段遗留，本轮未再改动**） | 开发副本为隔离 Electron 冒烟添加 `devDependencies.electron`；非业务代码 |
| `tests/schema/run.js` | 新增 | 158 项测试（§五 17 场景全覆盖） |
| `docs/integration/P1-B-*` | 新增 | 设计说明/字段映射/测试报告/日志 |
| `main.js` | **零改动** | 迁移通路全部在 storage.js，无需改动 |
| `app/pricing.js` | **零改动** | P1-A 定价引擎冻结（SHA-256 与 FIX-04 一致） |
| `app/pages.js`/`app/sheet.js`/`pdf-export.cjs`/`costing-storage.js`/`license-*`/`updater.js`/`product-ai.cjs`/`app/product-specs.js`/`app/product-import.js` | **零改动** | 与原版 0.2.17 逐字节一致（见 CHANGE-VS-ORIGINAL.txt） |
