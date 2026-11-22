/*
 * 渲染进程与主进程之间的安全桥
 * contextIsolation 保持开启，渲染页面只能看到这里显式暴露的方法，
 * 拿不到 Node 的 fs / child_process。
 */
const { contextBridge, ipcRenderer } = require('electron');

/*
 * 测试专用钩子：在页面脚本执行之前，把一段内容写进旧版 localStorage 键。
 * 只用于隔离环境的回归验证（验证"旧数据损坏时不初始化、不写演示数据"这段逻辑），
 * 正常使用不会设置 SBW_LS_PRESET，因此对用户没有任何影响。
 */
try {
  if (process.env.SBW_LS_PRESET) {
    window.localStorage.setItem('siwangbox-desktop-v1', process.env.SBW_LS_PRESET);
    console.log('LS_PRESET_WRITTEN len=' + process.env.SBW_LS_PRESET.length);
  }
} catch (e) {
  console.log('LS_PRESET_FAIL=' + ((e && e.message) || e));
}

contextBridge.exposeInMainWorld('SBW', {
  licenseStatus: () => ipcRenderer.invoke('license:status'),
  licenseActivate: (code) => ipcRenderer.invoke('license:activate', code),
  /* 维护模式：只有本机打了 owner 标记才开放 AI 模型/密钥配置 */
  ownerStatus: () => ipcRenderer.invoke('owner:status'),
  ownerEnable: (code) => ipcRenderer.invoke('owner:enable', code),
  ownerDisable: () => ipcRenderer.invoke('owner:disable'),
  productAIStatus: () => ipcRenderer.invoke('productAI:status'),
  productAIKeySave: (value) => ipcRenderer.invoke('productAI:saveKey', value),
  productAIExtract: (input) => ipcRenderer.invoke('productAI:extract', input),
  /* ---- 数据读写（同步，保持 store.js 原有 API 不变） ---- */
  load: () => ipcRenderer.sendSync('db:load'),
  save: (data) => ipcRenderer.sendSync('db:save', data),

  /* ---- 数据文件位置与备份 ---- */
  paths: () => ipcRenderer.sendSync('db:paths'),
  backups: () => ipcRenderer.sendSync('db:backups'),
  restore: (file) => ipcRenderer.sendSync('db:restore', file),
  legacyInfo: () => ipcRenderer.sendSync('db:legacyInfo'),

  /* ---- 旧数据迁移（v2/v3/v4 → v5，主进程整体完成） ---- */
  migrate: () => ipcRenderer.sendSync('db:migrate'),

  /* ---- 受控权威读取（B3 导出预检用）：只读磁盘上已保存的单据 ---- */
  getDocument: (id) => ipcRenderer.invoke('db:getDocument', id),

  /* ---- 内部核价：独立文件、独立 IPC，不进入客户单据与 PDF ---- */
  costingGet: (documentId) => ipcRenderer.sendSync('costing:get', documentId),
  costingSave: (record) => ipcRenderer.sendSync('costing:save', record),
  costingRemove: (documentId) => ipcRenderer.sendSync('costing:remove', documentId),

  /* ---- 文件对话框（主进程弹，路径真实可写） ---- */
  pickProductImage: () => ipcRenderer.invoke('product:pickImage'),
  exportPdf: (documentId) => ipcRenderer.invoke('doc:exportPdf', { documentId }),
  exportToFile: (text, defaultName) => ipcRenderer.invoke('db:export', text, defaultName),
  importInspect: () => ipcRenderer.invoke('db:importInspect'),
  importApply: (filePath) => ipcRenderer.invoke('db:importApply', filePath),
  openDataDir: () => ipcRenderer.invoke('shell:openDataDir'),

  /* ---- 应用信息 ---- */
  info: () => ipcRenderer.sendSync('app:info'),

  /* ---- 关闭窗口前的未保存确认 ----
     主进程 win.on('close') 拦截后发 app:before-close；页面弹三选一，
     然后用 finishClose 把决定告诉主进程：'discard'（放弃改动直接关）、
     'saved'（已保存，关）、'clean'（没有未保存改动，关）。取消则不调用。 */
  onBeforeClose: (cb) => ipcRenderer.on('app:before-close', () => cb()),
  finishClose: (decision) => ipcRenderer.send('app:close-decision', decision),
  /* 仅隔离关闭测试用：走主进程 win.close()，与点标题栏 X 是同一条真实路径 */
  testClose: () => ipcRenderer.send('app:testClose'),

  /* ---- 软件更新 ---- */
  updateState: () => ipcRenderer.sendSync('update:state'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install')
});
