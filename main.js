const { app, BrowserWindow, Menu, shell, ipcMain, dialog, session, nativeImage, safeStorage } = require('electron');
const { createProductAI } = require('./product-ai.cjs');
const { createLicenseService } = require('./license-service.cjs');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createStorage } = require('./storage');
const { createCostingStorage } = require('./costing-storage');
const updater = require('./updater');

/* 优先使用系统正常的 GPU/ANGLE 路径。
 * 不再强制 SwiftShader：在部分 Windows 显卡驱动上它会出现 DOM 已加载、
 * 但整个窗口合成层不绘制的白屏。需要兼容模式时由启动参数
 * --disable-gpu --disable-gpu-compositing 降级，页面仍保留 SVG 装柜回放。 */
// Keep Chromium's sandbox enabled, including the isolated PDF renderer.

const SHOT_PATH = process.env.SBW_SHOT;
const OFFSCREEN = !!SHOT_PATH;
/* 隔离模式下的「窗口关闭保护」实测：开启后 offscreen 也走真实的 close 拦截路径 */
const CLOSE_TEST = !!process.env.SBW_CLOSE_TEST;
/* 隔离模式下的打印 PDF 产物（验证实际打印不截断） */
const PDF_PATH = process.env.SBW_PDF || '';
/* 隔离模式下模拟 Windows 125% 缩放（页面 zoom 1.25，视口等效缩小 20%） */
const ZOOM = process.env.SBW_ZOOM ? +process.env.SBW_ZOOM : 0;
/* 隔离模式下指定窗口大小，如 1280x720 */
const WIN_SIZE = (process.env.SBW_WIN_SIZE || '').match(/^(\d+)x(\d+)$/);
/* 隔离模式下的截图时机（毫秒，默认 2600）：需要拍到 toast / 弹窗的后续状态时调大 */
const SHOT_DELAY = process.env.SBW_SHOT_DELAY ? +process.env.SBW_SHOT_DELAY : 2600;
/* 显示模式（截图/测试）下 userData 必须显式指定，且必须落在隔离目录里。
 * 以前默认写 os.tmpdir()，跑到哪个盘不确定；D1 起要求调用方明确给出路径。 */
const USERDATA_DIR = process.env.SBW_USERDATA || '';

if (OFFSCREEN) {
  if (USERDATA_DIR) {
    app.setPath('userData', USERDATA_DIR);
  } else {
    // 没给隔离路径就退回到独立临时目录，但会在日志里警告
    app.setPath('userData', path.join(os.tmpdir(), 'siwang-box-shot-' + process.pid));
  }
  console.log('USERDATA=' + app.getPath('userData'));
  console.log('ISOLATED=' + (USERDATA_DIR ? 'explicit' : 'tmp-fallback'));
}

/*
 * 单实例锁
 * 没有它，用户双击两次就会出现两个窗口同时读写同一份数据。
 * 实测后果：后开的那个窗口写入的数据不会落盘，关掉就全没了，而且没有任何提示。
 * 这里保证任何时候只有一个实例；重复启动会把已有窗口拉到前面。
 */
if (!OFFSCREEN && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  bootstrap();
}

let store = null;          // 数据持久层
let costingStore = null;   // 内部核价独立文件；绝不交给客户纸面/PDF
let mainWindow = null;
let productAI = null;
let licenseService = null;

/* 维护模式标记与维护码：标记文件在本机 userData 下，不打进安装包。
   维护码只用于在本机打开模型/密钥配置，改了也拿不到任何密钥。 */
const OWNER_CODE = 'SWB-2610-OWNER';
function ownerFile() { return path.join(app.getPath('userData'), 'owner.mode'); }

/* ===== 发布方内置 AI 配置 =====
   客户机不显示任何模型/密钥输入，靠这里下发的配置跑 AI。
   文件 ai-builtin.json 与主进程同目录（打包后在 resources/app 里）：
     { provider, baseUrl, model, keyIv, keyTag, keyCipher }
   密钥用 AES-256-GCM 加密，密钥材料来自 SBW_AI_SALT（构建时写死）+ 本机无关常量，
   目的是让人直接在 asar 里 grep 不到明文 Key。它不是强防护：能反编译主进程的人仍可还原。
   真要彻底安全，只能改成自建中转接口，把 Key 留在服务器上。 */
const crypto = require('crypto');
function builtinAIFile() { return path.join(__dirname, 'ai-builtin.json'); }
function builtinAI() {
  try {
    const file = builtinAIFile();
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    let key = '';
    if (raw.keyCipher) {
      try {
        const material = crypto.createHash('sha256')
          .update(String(raw.salt || '') + '|siwang-box-ai-v1').digest();
        const decipher = crypto.createDecipheriv('aes-256-gcm', material, Buffer.from(raw.keyIv, 'base64'));
        decipher.setAuthTag(Buffer.from(raw.keyTag, 'base64'));
        key = Buffer.concat([decipher.update(Buffer.from(raw.keyCipher, 'base64')), decipher.final()]).toString('utf8');
      } catch (e) { key = ''; }
    }
    return {
      provider: raw.provider || 'deepseek',
      baseUrl: raw.baseUrl || '',
      model: raw.model || '',
      key: key || '',
      enabled: raw.enabled !== false
    };
  } catch (e) { return null; }
}

function bootstrap() {
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    store = createStorage(app.getPath('userData'));
    costingStore = createCostingStorage(app.getPath('userData'));
    licenseService = createLicenseService({userData:app.getPath('userData')});
    productAI = createProductAI({
      userData:app.getPath('userData'),
      safeStorage,
      getLicenseStatus:()=>licenseService.status(),
      /* 本机设置优先；客户机没有设置过，就回落到发布方内置配置 */
      getConfig:()=>{
        const loaded=store.load();
        const saved=(loaded.ok&&loaded.data&&loaded.data.settings&&loaded.data.settings.ai)||{};
        const builtin=builtinAI();
        if(!builtin)return saved;
        return {
          provider: saved.provider || builtin.provider,
          baseUrl: saved.baseUrl || builtin.baseUrl,
          model: saved.model || builtin.model,
          enabled: typeof saved.enabled === 'boolean' ? saved.enabled : builtin.enabled
        };
      },
      getBuiltinKey:()=>{const b=builtinAI();return b?b.key:'';}
    });
    registerIpc();
    createWindow();
    if (!OFFSCREEN) updater.init(() => mainWindow);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

/* ============ 主进程 IPC：数据读写与文件对话框 ============ */
function registerIpc() {
  ipcMain.handle('license:status',()=>{try{return licenseService.status();}catch(e){return {ok:false,error:'无法读取授权状态'};}});
  ipcMain.handle('license:activate',(_e,code)=>{try{return licenseService.activate(code);}catch(e){return {ok:false,error:'授权记录保存失败，请检查磁盘权限'};}});
  /* 维护模式：只有本机存在 owner.mode 才开放 AI 服务配置。
     下载安装的客户机器上没有这个文件，窗口里看不到模型/密钥模块。 */
  ipcMain.handle('owner:status',()=>{try{return {ok:true,owner:fs.existsSync(ownerFile())};}catch(e){return {ok:true,owner:false};}});
  ipcMain.handle('owner:enable',(_e,code)=>{
    try{
      if(String(code||'').trim().toUpperCase()!==OWNER_CODE)return {ok:false,error:'维护码不正确'};
      fs.mkdirSync(path.dirname(ownerFile()),{recursive:true});
      fs.writeFileSync(ownerFile(),JSON.stringify({enabledAt:new Date().toISOString()}));
      return {ok:true};
    }catch(e){return {ok:false,error:'维护模式写入失败，请检查磁盘权限'};}
  });
  ipcMain.handle('owner:disable',()=>{try{if(fs.existsSync(ownerFile()))fs.unlinkSync(ownerFile());return {ok:true};}catch(e){return {ok:false,error:'关闭维护模式失败'};}});
  ipcMain.handle('productAI:status', () => productAI.status());
  ipcMain.handle('productAI:saveKey', (_e, value) => {try{return productAI.saveKey(value);}catch(error){return {ok:false,error:error.message};}});
  ipcMain.handle('productAI:extract', (_e, input) => productAI.extract(input));
  const { createPdfExporter } = require('./pdf-export.cjs');
  const exportPdf = createPdfExporter({BrowserWindow, dialog, session, store,
    getMainWindow: () => mainWindow,
    styles: fs.readFileSync(path.join(__dirname, 'app', 'app.css'), 'utf8')});
  ipcMain.handle('doc:exportPdf', exportPdf);
  const {createImagePicker}=require('./app/local-image.cjs');
  /* 测试专用：SBW_PICK_FILE 指定图片时跳过系统文件对话框，直接返回该路径，
     让「渲染进程 → preload → IPC → 校验/缩放/JPEG 转码」整条真实链路可自动化验证。
     仅 OFFSCREEN（截图/测试）模式且显式设置该变量时生效；正常运行行为不变。 */
  const pickDialog = (OFFSCREEN && process.env.SBW_PICK_FILE)
    ? {showOpenDialog: async () => ({canceled: false, filePaths: [process.env.SBW_PICK_FILE]})}
    : dialog;
  ipcMain.handle('product:pickImage',createImagePicker({dialog:pickDialog,nativeImage,getMainWindow:()=>mainWindow}));
  ipcMain.on('db:load', (e) => { e.returnValue = store.load(); });
  ipcMain.on('db:save', (e, data) => { e.returnValue = store.save(data); });
  ipcMain.on('db:paths', (e) => { e.returnValue = store.paths(); });
  ipcMain.on('db:backups', (e) => { e.returnValue = store.backups(); });
  ipcMain.on('db:restore', (e, f) => { e.returnValue = store.restore(f); });
  ipcMain.on('db:legacyInfo', (e) => { e.returnValue = store.legacyInfo(); });
  /* 旧数据迁移：整个迁移在主进程完成（读旧源 → 备份 → 构造 v4 → 一次性原子落盘） */
  ipcMain.on('db:migrate', (e) => { e.returnValue = store.migrate(); });
  /* 受控权威读取（B3 受控 PDF 预检用）：只读磁盘上已保存的单据，
     不触发恢复、不降级、无副作用。B1 只接通链路，界面未接。 */
  ipcMain.handle('db:getDocument', async (e, id) => {
    try { return store.readSavedDocument(id); } catch (err) { return { ok: false, error: err.message }; }
  });
  /* 内部核价独立通道。PDF 导出器只持有 store，不持有 costingStore。 */
  ipcMain.on('costing:get', (e, documentId) => {
    try { e.returnValue = { ok: true, record: costingStore.get(documentId) }; }
    catch (err) { e.returnValue = { ok: false, error: err.message }; }
  });
  ipcMain.on('costing:save', (e, record) => {
    try { e.returnValue = costingStore.save(record); }
    catch (err) { e.returnValue = { ok: false, error: err.message }; }
  });
  ipcMain.on('costing:remove', (e, documentId) => {
    try { e.returnValue = costingStore.remove(documentId); }
    catch (err) { e.returnValue = { ok: false, error: err.message }; }
  });
  ipcMain.on('app:info', (e) => {
    e.returnValue = {
      version: app.getVersion(),
      dataDir: store.paths().dataDir,
      file: store.paths().file,
      legacyFile: store.paths().legacyFile,
      v3File: store.paths().v3File,
      costingFile: costingStore.paths().file
    };
  });

  // 导出：由主进程弹保存对话框，用户明确知道文件存哪了
  ipcMain.handle('db:export', async (e, text, defaultName) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const r = await dialog.showSaveDialog(win, {
      title: '导出数据备份',
      defaultPath: path.join(app.getPath('documents'), defaultName || 'siwangbox-backup.json'),
      filters: [{ name: 'JSON 数据文件', extensions: ['json'] }]
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try {
      fs.writeFileSync(r.filePath, text, 'utf8');
      return { ok: true, filePath: r.filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* 导入分两步：先选文件并检查（只读，不改数据），确认后再真正替换。
     这样界面上能明确告诉用户"将会替换掉什么"，取消则原状不变。 */
  ipcMain.handle('db:importInspect', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const r = await dialog.showOpenDialog(win, {
      title: '选择要导入的数据文件',
      properties: ['openFile'],
      filters: [{ name: 'JSON 数据文件', extensions: ['json'] }]
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    try {
      return store.inspectFile(r.filePaths[0]);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:importApply', async (e, filePath) => {
    if (!filePath) return { ok: false, error: '没有指定要导入的文件' };
    try {
      return store.importFile(filePath);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shell:openDataDir', async () => {
    const dir = store.paths().dataDir;
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    const err = await shell.openPath(dir);
    return err ? { ok: false, error: err } : { ok: true, dir };
  });

  /* ---- 软件更新 ---- */
  ipcMain.on('update:state', (e) => { e.returnValue = updater.state(); });
  ipcMain.handle('update:check', async () => await updater.check(false));
  ipcMain.handle('update:install', async () => updater.install());
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: '丝网盒子',
    icon: path.join(__dirname, 'app', 'icon.png'),
    backgroundColor: '#f6f8f7',
    autoHideMenuBar: true,
    show: !OFFSCREEN,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      /* CI/offscreen screenshots run from a restricted workspace whose ACL is
         unreadable to AppContainer. Normal user windows keep sandbox=true. */
      sandbox: !OFFSCREEN,
      preload: path.join(__dirname, 'preload.js'),
      offscreen: OFFSCREEN
    }
  });
  mainWindow = win;

  /* 关闭窗口前的未保存确认（真实 Electron 路径，不靠 beforeunload）：
     X 按钮 / Alt+F4 / win.close() 都会先进这里，拦截后问渲染进程，
     渲染进程弹「保存 / 放弃 / 继续编辑」，决定经 app:close-decision 回来。
     渲染进程挂了（崩溃）就放行关闭，不会把用户困在关不掉的窗口里。 */
  win.on('close', (e) => {
    if (OFFSCREEN && !CLOSE_TEST) return;          /* 截图收尾用 app.quit，不拦截 */
    if (win.__sbwAllowClose) return;
    if (win.webContents.isCrashed() || win.webContents.isDestroyed()) return;
    e.preventDefault();
    try {
      win.webContents.send('app:before-close');
      console.log('CLOSE_ASKED');
    } catch (err) {
      win.__sbwAllowClose = true;
      win.close();
    }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  if (CLOSE_TEST) {
    /* 与真实点 X 同一条路径：主进程主动关窗口 */
    ipcMain.on('app:testClose', () => { if (mainWindow) mainWindow.close(); });
  }
  ipcMain.on('app:close-decision', (e, decision) => {
    console.log('CLOSE_DECISION=' + decision);
    if (decision === 'discard' || decision === 'saved' || decision === 'clean') {
      win.__sbwAllowClose = true;
      win.close();
    }
    /* 取消（继续编辑）：什么都不做，窗口保持打开 */
  });

  win.webContents.on('did-fail-load', (e, code, desc) => console.log('FAIL_LOAD=' + code + ' ' + desc));
  win.webContents.on('render-process-gone', (e, d) => console.log('RENDER_GONE=' + JSON.stringify(d)));
  win.webContents.on('console-message', (e, lvl, msg) => console.log('CONSOLE[' + lvl + '] ' + msg));

  // 只放行 http/https，避免自定义协议或 file:// 被系统直接打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  if (OFFSCREEN) {
    if (WIN_SIZE) {
      win.setSize(+WIN_SIZE[1], +WIN_SIZE[2]);
      console.log('WIN_SIZE=' + WIN_SIZE[1] + 'x' + WIN_SIZE[2]);
    }
    if (ZOOM > 0) {
      win.webContents.on('did-finish-load', () => {
        try { win.webContents.zoomFactor = ZOOM; console.log('ZOOM=' + ZOOM); } catch (e) { console.log('ZOOM_FAIL=' + e.message); }
      });
    }
    let armed = false;
    let saved = false;
    const save = (img) => {
      if (saved || !img) return;
      saved = true;
      try { fs.writeFileSync(SHOT_PATH, img.toPNG()); } catch (e) {}
      console.log('SHOT_SAVED=' + SHOT_PATH);
      if (!CLOSE_TEST) app.quit();
    };
    /* 测试专用：save() 只写第一帧，离屏窗口滚动/弹窗后的画面会被首次绘制帧抢先写死。
     * SBW_SHOT_CDP=1 时改用 CDP Page.captureScreenshot 强制抓取当前画面（仅测试模式生效）。 */
    const savePng = (buf) => {
      if (saved || !buf) return;
      saved = true;
      try { fs.writeFileSync(SHOT_PATH, buf); } catch (e) {}
      console.log('SHOT_SAVED=' + SHOT_PATH);
      if (!CLOSE_TEST) app.quit();
    };
    /* 实际打印产物：把当前打印视图（printToPDF 走 @media print 规则）写成 PDF 文件 */
    const dumpPdf = async () => {
      if (!PDF_PATH) return;
      try {
        await new Promise(r => setTimeout(r, 400));   /* 等打印视图渲染完 */
        const data = await win.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true
        });
        fs.writeFileSync(PDF_PATH, data);
        console.log('PDF_SAVED=' + PDF_PATH + ' bytes=' + data.length);
      } catch (e) {
        console.log('PDF_FAIL=' + e.message);
      }
      app.exit(0);
    };
    // 看门狗：20s 内必须出图或退出，避免进程挂死
    setTimeout(() => {
      if (!saved) { console.log('WATCHDOG_TIMEOUT'); app.exit(0); }
    }, 20000);
    win.webContents.once('did-finish-load', () => {
      console.log('DID_FINISH_LOAD');
      if (process.env.SBW_PAGE) {
        win.webContents.executeJavaScript('UI.go(' + JSON.stringify(process.env.SBW_PAGE) + ')')
          .then(() => console.log('NAV_OK'))
          .catch(err => console.log('NAV_FAIL=' + err.message));
      }
      /* 测试钩子：在页面里求值一段表达式并打印结果，用于验证 preload→IPC→数据层 的真实链路。
         仅隔离模式（SBW_SHOT）下生效，正常使用不会设置这个变量。 */
      if (process.env.SBW_EVAL) {
        win.webContents.executeJavaScript('(async function(){ try { var v = await (' + process.env.SBW_EVAL + '); return JSON.stringify(v); } catch (e) { return "EVAL_ERR:" + (((e && e.message) || e) + ""); } })()')
          .then(v => console.log('EVAL_RESULT=' + v))
          .catch(err => console.log('EVAL_FAIL=' + err.message));
      }
      if (PDF_PATH) dumpPdf();
      setTimeout(async () => {
        armed = true;
        console.log('CAPTURING');
        if (process.env.SBW_SHOT_CDP === '1') {
          try {
            if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3');
            const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', {format: 'png'});
            const buf = Buffer.from(shot.data, 'base64');
            console.log('CDP_CAPTURED size=' + buf.length);
            savePng(buf);
            if (CLOSE_TEST) setTimeout(() => { console.log('CLOSE_TEST_DONE'); app.exit(0); }, 2200);
            return;
          } catch (e) {
            console.log('CDP_CAPTURE_FAIL=' + e.message);
          }
        }
        try {
          const img = await win.webContents.capturePage();
          console.log('CAPTURED size=' + (img ? img.getSize().width + 'x' + img.getSize().height : 'null'));
          save(img);
          if (CLOSE_TEST) setTimeout(() => { console.log('CLOSE_TEST_DONE'); app.exit(0); }, 2200);
        } catch (e) {
          console.log('CAPTURE_FAIL=' + e.message);
          app.exit(0);
        }
      }, SHOT_DELAY);
    });
    win.webContents.on('paint', (event, dirty, image) => { if (armed) save(image); });
  }
}
