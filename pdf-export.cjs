'use strict';
// Main-process-only PDF service. Never accepts HTML, filenames or paths over IPC.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Model = require('./app/model.js');
const Sheet = require('./app/sheet.js');

function safeName(doc) {
  const no = String(doc.no || doc.id).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100);
  return doc.type + '-' + (no || 'document') + '.pdf';
}
function buildHtml(doc, css) {
  /* 边距必须跟"实际渲染的模板"同源：正文用的是 Sheet.templateFor(doc)，
   * 这里不能再拿 doc.templateId 另判一次，否则两处不一致时会出现
   * 「RC 边距 + 基础版正文」或「基础版边距 + RC 正文」的错配。 */
  const tpl = Sheet.templateFor(doc);
  const rc = tpl === 'quotation-rc-v1';
  /* RC 模板：@page 边距归零，改为在纸面根节点上用 padding 控制。
   * 分页时 padding-top 只作用于第一片纸，因此第 1 页仍从 4mm 开始，
   * 第 2 页内容直接贴纸面顶端（与 RunCheng 原版一致）。 */
  const pageMargin = rc ? '0' : '12mm 12mm 16mm';
  const rcSheetPad = rc ? '.q-sheet.rc-sheet{padding:4mm 3.7mm 0;box-sizing:border-box}' : '';
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">' +
    '<style>' + css + '\nhtml,body{margin:0;overflow:visible!important;background:white!important}' +
    '.q-sheet{width:auto;min-height:0;padding:0;box-shadow:none;margin:0}' +
    '@page{size:A4;margin:' + pageMargin + '}thead{display:table-header-group}' + rcSheetPad + '</style></head><body>' +
    Sheet.build(doc, {templateId: tpl}) + '</body></html>';
}
function createPdfExporter({BrowserWindow, dialog, session, store, getMainWindow, styles, onAudit = () => {}}) {
  let busy = false;
  return async function exportPdf(event, payload) {
    const parent = getMainWindow();
    if (!parent || parent.isDestroyed() || event.sender !== parent.webContents ||
        event.senderFrame !== parent.webContents.mainFrame) return {ok:false, code:'FORBIDDEN', error:'不允许的导出来源'};
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).length !== 1 || typeof payload.documentId !== 'string' ||
        !payload.documentId.trim() || payload.documentId.length > 512 || /[\x00-\x1f]/.test(payload.documentId)) {
      return {ok:false, code:'BAD_REQUEST', error:'导出参数只能包含单据 ID'};
    }
    if (busy) return {ok:false, code:'BUSY', error:'另一份 PDF 正在导出，请稍候'};
    busy = true;
    let win = null, ses = null, tmp = '', timer;
    try {
      const loaded = store.readSavedDocument(payload.documentId);
      if (!loaded.ok) return loaded;
      const doc = loaded.document;
      /* P1-D-04：页边距/页眉页脚开关必须跟 buildHtml 用同一个判据（Sheet.templateFor），
         否则未声明模板的历史单据会出现「RC 正文 + 基础版页边距 + 页面页脚」的错配。 */
      const rc = Sheet.templateFor(doc) === 'quotation-rc-v1';
      if (!Model.DOC_TYPES.includes(doc.type)) return {ok:false, code:'INVALID', error:'不支持的单据类型'};
      if (doc.templateId && !Sheet.TEMPLATE_IDS.includes(doc.templateId)) return {ok:false, code:'TEMPLATE', error:'该单据使用的模板尚未安装，请先核对模板'};
      const check = Model.validateForExport(doc);
      if (!check.ok) return {ok:false, code:'INCOMPLETE', error:check.errors.join('；')};
      if (check.warnings.length) {
        const answer = await dialog.showMessageBox(parent, {type:'warning', title:'导出前核对',
          message:'以下信息尚待核对，PDF 会如实显示待补内容：', detail:check.warnings.join('\n'),
          buttons:['取消','确认并导出'], defaultId:0, cancelId:0, noLink:true});
        if (answer.response !== 1) return {ok:false, canceled:true};
      }
      const target = await dialog.showSaveDialog(parent, {title:'导出 '+doc.type+' 单据 PDF',
        defaultPath:safeName(doc), filters:[{name:'PDF 文件',extensions:['pdf']}],
        properties:['showOverwriteConfirmation']});
      if (target.canceled || !target.filePath) return {ok:false, canceled:true};
      const html = buildHtml(doc, styles);
      const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      ses = session.fromPartition('swb-pdf-'+crypto.randomUUID(), {cache:false});
      ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
      ses.setPermissionCheckHandler(()=>false);
      ses.webRequest.onBeforeRequest((details, callback) => {
        const allowed = (details.url === url && details.resourceType === 'mainFrame') || (details.resourceType==='image' && details.url.length<=1000100 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(details.url));
        onAudit({event:'request', allowed, url:details.url});
        callback({cancel:!allowed});
      });
      win = new BrowserWindow({show:false,width:900,height:1000,webPreferences:{
        session:ses, sandbox:true, contextIsolation:true, nodeIntegration:false,
        nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,
        javascript:false,images:true,webgl:false,plugins:false,devTools:false
      }});
      onAudit({event:'window-created', sandbox:true, javascript:false});
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      win.webContents.on('will-navigate',e=>e.preventDefault());
      win.webContents.on('will-frame-navigate',e=>e.preventDefault());
      const work = async () => {
        await win.loadURL(url);
        return win.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true,
          displayHeaderFooter:!rc,headerTemplate:'<span></span>',
          footerTemplate:rc?'<span></span>':'<div style="font:9px Arial;width:100%;text-align:center;color:#666">'+
            Sheet.esc(doc.no || '')+' · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          margins:rc?{top:0,bottom:0,left:0,right:0}
                    :{top:12/25.4,bottom:16/25.4,left:12/25.4,right:12/25.4}});
      };
      const pdf = await Promise.race([work(), new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(new Error('PDF 生成超时，请重试')),15000);
      })]);
      clearTimeout(timer);
      if (!Buffer.isBuffer(pdf) || pdf.subarray(0,5).toString() !== '%PDF-') throw new Error('PDF 生成结果无效');
      // Same-directory temporary file; the save dialog has confirmed replacement.
      tmp = path.join(path.dirname(target.filePath), '.'+path.basename(target.filePath)+'.tmp-'+crypto.randomUUID());
      const fd = fs.openSync(tmp,'wx');
      try {fs.writeFileSync(fd,pdf);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
      fs.renameSync(tmp,target.filePath); tmp='';
      return {ok:true,path:target.filePath,documentId:doc.id};
    } catch(e) {
      return {ok:false,code:e.code || 'PDF_ERROR',error:e.message || String(e)};
    } finally {
      clearTimeout(timer);
      if (win && !win.isDestroyed()) win.destroy();
      if (ses) ses.webRequest.onBeforeRequest(null);
      if (tmp) {try {fs.unlinkSync(tmp);} catch(_) {}}
      busy=false;
      onAudit({event:'finished',windowDestroyed:!win || win.isDestroyed()});
    }
  };
}
module.exports = {createPdfExporter,safeName,buildHtml};
