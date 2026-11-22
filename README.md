# 丝网盒子 · 外贸报价桌面系统

面向安平丝网行业的外贸报价与单据工具（Electron 桌面应用）。核心是一套"报价 → 核价 → 五类单据"的本地数据流：
产品资料库、客户资料、报价编辑器（成本 / 建议价 / 运费 / 折扣）、Quotation / PI / SC / CI / PL 输出与 A4 PDF。

## 功能概览

- **产品资料库**：文本规格（客户单直接印）、尺寸重量、外箱包装、产品图片、成本快照
- **客户资料库**：公司 / 联系人 / 国家 / 邮箱 / 电话 / WhatsApp / 地址，跟进沟通记录
- **报价编辑器**：客户 → 产品 → 报价参数 → 明细卡片（A 产品 / B 内部成本 / C 智能报价）→ 汇总与运费 → 订单条款
- **核价引擎**：汇率、目标毛利率、销售手续费、个人提成、运费加价；建议价与最终价分离，人工价不被重算覆盖
- **五类单据**：QT / PI / SC / CI / PL 统一版式，A4 预览 + PDF 导出
- **辅助工具**：丝网计算器、装柜预排、标准速查、学习中心
- **数据安全**：本地 JSON 原子写 + `.bak` 备份 + 导入导出，全程离线

## 目录结构

```
app/            页面与业务（pages.js 界面、pricing.js 核价、store.js 数据、model.js Schema 校验、sheet*.js 纸面）
tests/          Node 测试套件（schema / p1c / p1d / p1d3 / pricing / p1db / p1db-fix01）
docs/           设计与验收文档（Markdown）
main.js         主进程入口
preload.js      安全桥（contextBridge）
storage.js      本地存储（原子写、备份、迁移）
pdf-export.cjs  PDF 导出
```

## 运行

```bash
npm install          # 安装 Electron 与 electron-updater
npx electron .       # 开发模式启动
```

打包由内部构建脚本完成（本仓库不含安装包与发布产物）。

## 测试

```bash
node tests/schema/run.js
node tests/p1c/run.js
node tests/p1d/run.js
node tests/p1d3/run.js
node tests/pricing/run-all.js
node tests/p1db/run.js
node tests/p1db-fix01/run.js
```

## 数据与隐私

- 本仓库**不包含**任何真实客户数据、生产数据文件、API 密钥或发布安装包；
- 源码内的演示种子数据均为虚构示例（Demo Trading Co. 等）；
- 运行时数据保存在用户目录（`%APPDATA%/丝网盒子/data/`），不进仓库。

## 版本

源码版本 `0.2.17`（发布构建另行打版本号）。当前处于报价工作台界面重构阶段（P2）。

## 许可

内部项目，未声明开源许可；如需引用请先联系作者。
