# P1-B 迁移测试报告

日期：2026-11-19
测试环境：Windows / Node v22.22.2 / Electron（隔离模式）。**全部测试使用隔离数据副本（os.tmpdir 或 SBW_USERDATA 指向项目内临时目录），生产 userData 零触碰。**

## 一、自动化测试结果

| 套件 | 结果 | 退出码 | 日志 |
|---|---|---|---|
| tests/schema/run.js（P1-B 新增） | **ALL PASS — 158 checks** | 0 | P1-B-schema-test-log.txt |
| tests/pricing/run-all.js（P1-A 冻结回归） | **ALL PASS — 851 checks** | 0 | P1-B-pricing-test-log.txt |

### schema 套件对任务书 §五 17 项场景的覆盖

| # | 场景 | 用例 |
|---|---|---|
| 1 | v4 正常数据迁移到 v5 | B1–B24（五类单据 fixture 全字段迁移） |
| 2 | 空数据库迁移 | I1–I4（storage empty → v5 空库保存/重载）；A6/A11（emptyV5） |
| 3 | 五种单据 QT/PI/SC/CI/PL | C1–C14（类型齐全、顺序不变、各自定价参数 null、行成本 null；PL 包装、CI hsCode 不受影响） |
| 4 | 历史成交价、历史合计完全不变 | B12–B14（手填 999.99 + customTotal 原样）、H10（250）、I13；E2E：777.77 |
| 5 | 历史 feeInPrice 保持 null | B7/B10、C2–C6、H11 |
| 6 | 历史 pricingVersion 保持 null | B7/B11、C2–C6、H11 |
| 7 | 原有未知字段不丢失 | B21–B23（单据级/顶层/行级 _unknown 与扩展键）、H9（v2 旧字段）、B4（顶层 _unknown.oldExtra） |
| 8 | sourceId、单据 ID、行 ID 不改变 | B15–B20、I11–I12 |
| 9 | 产品库和报价行新增成本字段 | B9（行）、D1–D2（产品库）、C7–C11 |
| 10 | null、0、已确认三种成本状态 | D3（0+confirmed）、D4（确认零成本）、D5（未确认 0≠已确认）、D6（显式 false） |
| 11 | 非法成本、非法定价参数拒绝写入 | E1–E18（负成本/NaN/Infinity/字符串确认/数字 specText/fx 0·负·字符串/费率超界/feeInPrice "1"·true·2/fees 非法条目/pricingVersion 数字）；I31（save 拒绝） |
| 12 | QT→PI/SC/CI 保留内部成本快照 | F1/F5–F7（costFactory=12.5）、F8–F10（specText/costConfirmed）、F11–F13（fx/feeRate/fees）、F14–F16（sourceId）、F17–F19（行身份重分配） |
| 13 | QT→PL 显式剥离成本字段 | F20（数据层 delete，六键全无）、F21（price/amount/hsCode）、F22（sourceId）、F23（包装待补）、F24（PL 合计口径） |
| 14 | 迁移失败时原始文件不变 | G1–G4（model 层纯函数零修改、异常整次停止）、I19–I22（storage 层：legacyCorrupt → migrate 失败 → v4 原文件 SHA-256 逐字节不变、未产生 v5 文件） |
| 15 | 迁移重复执行不产生重复字段/费用 | I15–I18（二次 migrate → ALREADY_V5；每键恰好出现一次；fees=[] 无重复；v4 原文件仍不变）；G1（模型层对 v5 输入拒绝） |
| 16 | v2→v3→v4→v5 完整链路 | H1–H11（model 层）、I23–I26（storage 层真实文件） |
| 17 | 原有 v4 校验测试继续通过 | A3–A5/A8–A10（validateV4 规则、v3→v4 输出 4、emptyV4=4、v4 写门走 v4 规则）；pricing 851 项全过（模型共享层无回归） |

## 二、Electron 真机隔离实测（原始数据保护日志）

目的：验证 preload→IPC→storage.js→store.js 的**真实运行链路**上 v4 数据文件被安全迁移。记录原文如下（P1-B-e2e-isolation-log.txt）：

```
准备：tmp-e2e/data/siwangbox-v4.json（emptyV4 + 1 张 QT，历史合计 777.77 ≠ 明细计算 20）
fixture sha256=63560e97161fd0e0a434ddef168505fccf8183c5aa0c61af781cd00c2e61bf6f

启动：SBW_USERDATA=<项目内临时目录> SBW_SHOT=… SBW_EVAL="…Store.status()/schemaVersion/…" SBW_CLOSE_TEST=1
（ELECTRON_RUN_AS_NODE 已 unset）

EVAL_RESULT={"status":"migrated","schemaVersion":5,"docs":[{"id":"doc-e2e-1","no":"QT-202610-0001",
  "type":"QT","grand":777.77,"feeInPrice":null,"fx":null,"costFactory":null}]}
CAPTURING
CAPTURED size=1280x860
CLOSE_TEST_DONE

迁移后核对：
  v4 原文件 sha256=63560e97…（逐字节不变）
  v5 主文件 schemaVersion=5，单据数=1，fees=[]
```

结论：真实 UI 链路上 `status=migrated`、版本 5、历史合计不变、定价参数全 null、v4 原文件未动。

## 三、冻结与只读核对

- `app/pricing.js` 与 FIX-04 交付包逐字节一致（P1-A 冻结）。
- 与原版 0.2.17 源码逐文件比对：`app/sheet.js`、`app/pages.js`、`pdf-export.cjs`、`costing-storage.js`、`license-service.cjs`、`updater.js`、`product-ai.cjs`、`main.js`、`app/product-specs.js`、`app/product-import.js` 全部零改动（见 CHANGE-VS-ORIGINAL.txt）。
- 生产 userData：全程未读写（测试仅 tmpdir 与项目内临时目录，事后已清理）。

## 四、测试中发现并修正的项（留痕）

- 测试脚本 E 段初版把非法成本误写在单据级（应在行级）、C14 统计口径按"键次数"计（5 单×9 键=45）、F24 误断 PL 有 previousGrand——均为**测试脚本**问题，实现无缺陷，已修正后 158 项全过。
- 实现侧无返工：migrateV4toV5/validateV5/转换剥离/迁移链一次通过。
