# 0.2.17 原版基线冒烟测试记录（P0 收尾）

日期：2026-11-19 ｜ 执行：Workbuddy ｜ 方式：原版自带隔离测试钩子（SBW_USERDATA/SBW_SHOT/SBW_PAGE/SBW_EVAL/SBW_PDF），**正式数据库未触碰**（数据目录指向 baseline 本地副本）

## 环境

- 运行目录：`D:\siwanghezi\siwang-box-0.2.17-dev`（原版哈希副本 + 仅新增 electron@44.7.0 devDependency 运行时）
- 隔离 userData：`baseline-0.2.17/userdata/`，内含正式老数据库 `siwangbox-v4.json` 的**副本**（schemaVersion=4，3 产品，0 单据）
- 正式数据 `%APPDATA%\丝网盒子` 全程只读未动

## 测试矩阵与结果

| # | 场景 | 钩子 | 结果 | 证据 |
|---|---|---|---|---|
| S1 | 老库打开（v4 迁移链） | SBW_SHOT + SBW_EVAL | ✅ 3 产品加载、无授权拦截、界面正常 | shots/S1-dashboard.png、logs/S1-open-old-db.log |
| S2 | 真实保存链路建 QT（preload→IPC→store 事务） | SBW_EVAL→Store.addDocument | ✅ QT-202611-0001；另验证**写门拦截**：wire/width 传字符串被拒（"不是有效数字"） | logs/S2-add-qt.log |
| S3 | QT 纸面预览 + PDF 导出 | Doc.print + SBW_PDF | ✅ 1 页 65KB，合计 843.65（10×21.865+50×12.5 与手算一致） | pdf/QT-202611-0001.pdf |
| S4 | 转换矩阵 QT→PI/SC/CI/PL | SBW_EVAL→MODEL.buildConversionDraft + Store.addDocument | ✅ 四类全部转换成功落盘（PI/SC/CI/PL-202611-0001）；**PL 行价格字段已剥离、包装四件套为 null 待补**；sourceId 正确指向 QT | logs/S5-conversions.log |
| S5 | PI 纸面 + PDF | 同 S3 | ✅ 1 页 65.8KB，合计 843.65 | pdf/PI-202611-0001.pdf |
| S6 | PL 纸面 + PDF（包装待补态） | 同 S3 | ✅ 1 页 61.8KB，无金额（PL 不按数量估算，符合设计） | pdf/PL-202611-0001.pdf |
| S7 | 页面渲染：产品/客户/单据中心 | SBW_PAGE | ✅ 三页正常，单据中心五类单据齐全 | shots/S8-*.png |

## PDF 文本扫描（pypdf）

- QT/PI：grand 843.65 存在 ✅；内部字段（costFactory/手续费后/目标利润率/提成）**未泄露** ✅（v4 本无成本字段，此为 P1-D 专项断言的基线对照组）

## 基线哈希

- `SHA256-baseline-0.2.17-src.txt`：原版 0.2.17 全部 31 个 JS 文件（不含 node_modules）的 SHA-256
- `after-smoke-userdata-snapshot.json`：冒烟落盘后的隔离库快照（5 单据 + 造单数据）

## 过程中发现的问题（均为测试脚本问题，非应用问题）

1. 会话环境预置 `ELECTRON_RUN_AS_NODE=1`，启动时须 unset，否则 electron 按纯 Node 跑 main.js 报 app undefined
2. S7 首跑 EVAL 字符串内含单引号截断 bash 引号导致 JS 语法错，修正后通过——与 0.2.17 应用无关

## 结论

0.2.17 原版功能基线健康：老库打开、保存写门、纸面渲染、PDF 导出、五类转换全部正常。**此基线作为 P1 "不变基线"对照组固化。**
