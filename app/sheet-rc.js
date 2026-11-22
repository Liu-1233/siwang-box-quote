/* 丝网盒子 · RunCheng 黑白商务版式（quotation-rc-v1）—— P1-D-03R 建立版式，P1-D-04 扩到五类
 *
 * 版式基准：用户提供的 RunCheng 原版 QUOTATION 截图（黑白商务表格风，A4 竖版）。
 * P1-D-03R 修正：整体版式从蓝色商务风改为严格还原原版截图的黑白版式——
 *   抬头（LOGO 左 + 公司名/地址/Tel|WhatsApp/Email|Web 右 + 黑色分隔线）、
 *   左标题右 No./Date、BUYER·CONSIGNEE 与 DOCUMENT INFO 双栏黑框、
 *   明细表（全黑边框、独立 PHOTO 列）、条款+大写金额（左）与金额汇总（右）并排、
 *   双签名区、黑线页脚（公司 · 单号 · 单据全称）。
 *   缺失值一律显示「—」（原版占位方式），绝不编造资料。
 *
 * 纪律与 app/sheet.js 同一铁律：
 *   · 只读单据展示字段白名单，绝不引用 fx/feeRate/targetMargin/commissionRate/
 *     markupRate/feeInPrice/fees/cost_* 等内部核价参数本身（fx 与 freightMarkup
 *     仅在折算「已核实的客户承担运费」金额时参与计算，绝不打印参数值）；
 *   · 所有用户输入一律转义；产物不含 <script>；
 *   · 历史/未保存数据缺什么就如实显示什么，绝不编造。
 *
 * 适用范围（P1-D-04 起）：QT / PI / SC / CI / PL **五类单据共用同一套纸面骨架**，
 *   「格式统一、业务内容各自不同」——
 *   抬头、标题行排布、买方与单据信息双栏、明细表视觉、条款区、签名区、页脚、A4 页面
 *   完全一致；只有标题文字、单据信息行、明细列（SC/CI 的 HS CODE、PL 的包装四列）、
 *   条款行与汇总口径随单据类型切换（PL 全纸面没有单价与金额）。
 *   其他单据类型（不在五类之内）返回 null，由 sheet.js 兜底到基础版。
 * 汇总口径（与 pricing.js 引擎同源，与 P1-D-03 一致）：
 *   Product Subtotal        = 单据 grand（草稿按明细现算，同 reference-sheets total()）
 *   Shipping / Freight      = 已核实客户承担运费（charge_customer && confirmed 行，
 *                             USD 直接取值、CNY÷fx 折算；木箱费已摊入明细单价故剔除；
 *                             再乘 (1+freightMarkup)）—— 任一环节不完整则整格显示「—」
 *                             并给出内部警示（绝不静默按 0 计）
 *   Discount / Tax·Other    = _unknown.pricing.extra（明确数字才印，否则 0.00）
 *   TOTAL AMOUNT (USD)      = Subtotal + Freight − Discount + Other（= 引擎 final_total；
 *                             运费不完整时回落 grand 并警示）
 *   历史单据无 _unknown.pricing 时：Freight=0.00、TOTAL=grand。
 *   PL 不使用金额汇总：右侧改为 Total Packages / N.W. / G.W. / CBM（Model.packagingTotals）。
 *
 * 抬头联系方式来源（P1-D-03R 新增，与 LOGO 同模式）：
 *   settings.sellerPhone / sellerWhatsApp / sellerEmail / sellerWebsite——
 *   渲染层 Store.settings()，主进程只读 data/siwangbox-v5.json（best-effort 降级为空）。
 *   卖方快照（Schema V5 固定 company/contact/address 三键）不动，联系方式不入快照。
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('./product-specs.js'),require('./reference-sheets.js'));else root.SheetRC=factory(root.SBModel,root.SBProductSpecs,root.ReferenceSheets);})(typeof self!=='undefined'?self:this,function(Model,Specs,Ref){
  'use strict';
  const TPL_ID='quotation-rc-v1';
  const DASH='—';   /* 原版缺失值占位 */
  /* 原版 RunCheng LOGO（从用户提供的 RunCheng 导出 PDF 中逐字节提取，638x401 JPEG） */
  const DEFAULT_LOGO='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAGRAn4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooJA61Tk1GxifbJe2yPnG1pVBz6daALlFQxTQyjMUqSD/ZYGkkuYIjiWaOM4zh2A4oAnoqKKWOaMPFIrqejKcg1Jn2oAWiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKQnFGe1cX4r8VanoqM9lDbSKglLmVWOAuMdGHvTjFydkJuyudFq+s2+i2Ul1cpK8cYBIjAJ5OO5HrXFS/Gfw9FM0TWep7lYqcRR9j/v1x1z8bNXU+XJBpgyM/6mX/4uvNvE2vPr979pk8sMZJJCI1IGWIPeuqnhv50YTrfynvqfGLw9KoP2LU/+/Uf/AMXXMeJ/FdnqNtLd6RFcW86pJIGmVfvEZU4yRwRXhvFLkY610Rw0Yu6MnWk1ZncWPxQ8U6dMUk1VioXACW0J6kHutdhL8WrHUbC4Esd+16yMkMhhjAU4+XOG9T6GvFs0ZzVujB9CFUkup6TafFjXdOna3e/lNui4VFtojgnB6kfWu70H4zabeTpb3MWoySOzYPkxAYC57N7GvnvNGcnmlKhCXQcaskfZun6pDqMMcsKOqyRiRd4A4OPQnnmqereJrPSL1LSeOdpXjEgMagjGSO5Hoa+T9I1m50a7a4tkidmjMeJASMZB7EeldB4V16CTxzp2o6vItvBEsiM8aMcDY+OOT1auZ4S13c2Ve+h9S21wtzawzoCElRXXPXBGeanHvXj2vfFyyislsdDube6ZonhKy28oOcALydo55ro/hbqV/rHh+4ur+KKKVLx4wIumNiHuTzkmueVKUY8zNlUTdkd/RRRWZYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFIaPeuI8W6VpupWnlyzzq4ud7BOMHDeq+9VFXdhN2NjX/ABXY+HYWlu4bhwqqx8lVJwW29yO9eM+LPiVpOri5htoL9CfNX94iAfNwOjGuG8Q6TaaZOEgklbMYb5yD3I7AelYGa9Clh4rU5J1ZPQsXdws8odQ2AuOarGiiukwCiiigAooooAKKMUUAFOVmDAqxB9QabRQB0/grSX1bxHZD90yrdwBxLyGBf6HPSvqPRNKj0iye3ihgiDSF9sK7V6AZ6DnivkLSr99N1S1vYwhaCZJRvBIyrA84+lfSXw28aL4k0yT7S0KXRuXREijcAqEVs859+9cWKjJ69DpoNLTqegUUgpa4TqCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKM0mT6UALRSfWjIoAWik+lGT6UALRSc+lHPpQAtFJz6VUu7+1sYw91LsUttztJ569hQBW1u3e50yaKO/ewLBf9IU42fMD6jr0696+e/Gs15ppna38Zz3sgvGQwx3Jyo+bnhz6Y/Gu18cfFqzWzltNEuLa53xo372CUHdv5HOOwrwy9u5L69nupQoeaRpGCjgEkk49ua7sPSktWctaaeiEuLme4bM1xJKcYy7luPxqCiiu05gooooAKKKWmAlOVSxAAJJOAAOtIB+VekeEPhfqGsGG5u7WdIEulSRop4htUbSTg5OcE1EpqKuxxi5OyOO0/wxrWp822k6hIhUkPFau4ODjsKo3tjcWEyxXEMsTldwWRCpxz2P0r630DwzZ+HrVLe0lndUVl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kTMrHqeec5rmpfA/hKRsrd6GgxjAt4v/AIqtY4lNe8jN0WnozwKfxBdzwvG0cIVlKnCnv+NZXXmvd/EvhLwpp+gX80eoaL562srRIsUSszBSQF+bOc46V4U4+Y46e1dFOcZ6oynFx3PoD4Hn/QdS/wCuVt/J69a7V5T8FYHh06+d0YB4bYqSuM8P0/OvVh0rza/8RnZS+BC0UUVkaBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAYooooAKKKKACiiigAooooAKKKKACiiigAxRRRQAUUUUAFFFFABRRRQAUUUUAFGKKKACiiigAooooAKKKKACiiigAqtdsy2rspwRj+YqzTJIxJGUPQ+1AHyr4m8Va1D4r1iGO9wkd9Oqjyk4Acgdqyv+Eu13/n+/8AISf/ABNe66l8IrPUdTur1ryBGuJnlINmCQWYnru561W/4UrZ/wDQQt//AAAX/wCLr0FXpJHG6VS54Tea5qOoKq3Vx5igEAbFHXr0FaHhnwtd+Jrxre1kt0KxGX98zAYDAdgfWva7f4NafDKrPd2sgBB2mwXnHb71dlo3hXSdEhUW9hZCUKVMsdqiMwJzjj8PypSxUUvdHGjJv3hnhHQ49D0KzgCoJvssKSsjMQzKuCRntkmuh7UiqFAAAAHAA7U6uFtt3Z1JWVgooopDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAEwKMClooATApaKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP//Z';


  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lines=s=>esc(s).replace(/\r?\n/g,'<br>');
  /* 缺失显示「—」，绝不编造；有值按多行文本转义 */
  const dv=v=>{const st=String(v==null?'':v).trim();return st?lines(st):DASH;};
  const r2=v=>Model?Model.round2(v):Math.round((+v||0)*100)/100;
  const finite=v=>typeof v==='number'&&isFinite(v);

  /* 金额：RunCheng 原版口径——纯数字千分位两位小数，币种写在列头/合计行标签里 */
  function money(v){ if(v==null||!isFinite(+v))return DASH;
    return (+v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

  /* ---------- LOGO（P1-D-03R-LOGO：固定使用原版 RunCheng LOGO） ----------
   * 原版 LOGO 从用户提供的 RunCheng 导出 PDF 中逐字节提取（638x401 JPEG），内嵌为
   * DEFAULT_LOGO。该模板不再读取 settings.sellerLogo——历史设置里的临时占位图
   * 不得再进入正式报价单；opts.logo 仅用于测试/受控覆盖，显式传空串表示不印 LOGO。 */
  function validLogo(v){ return typeof v==='string'&&v.length<=1000100&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)?v:''; }
  function logoFromUserDataDir(userDataDir){
    if(!userDataDir||typeof require!=='function')return '';
    try{
      const fs=require('fs'),path=require('path');
      const file=path.join(String(userDataDir),'data','siwangbox-v5.json');
      const db=JSON.parse(fs.readFileSync(file,'utf8'));
      const s=db&&db.settings||{};
      return validLogo(typeof s.sellerLogo==='string'?s.sellerLogo:'');
    }catch(e){ return ''; }
  }
  function logoFor(doc,opts){
    /* 显式传入优先：opts.logo='' 表示本张不印 LOGO（测试/特殊场景） */
    if(opts&&Object.prototype.hasOwnProperty.call(opts,'logo'))return validLogo(opts.logo);
    /* 其余情况一律使用原版 RunCheng LOGO，不再读取设置里的临时占位图 */
    return DEFAULT_LOGO;
  }

  /* ---------- 抬头联系方式（P1-D-03R 新增，与 LOGO 同三级来源、同 best-effort 纪律） ---------- */
  function pickSellerExtra(src){
    const g=k=>{const v=src&&src[k];return typeof v==='string'&&v.length<=4000?v.trim():'';};
    return {phone:g('sellerPhone'),whatsapp:g('sellerWhatsApp'),email:g('sellerEmail'),website:g('sellerWebsite')};
  }
  function sellerExtraFromUserDataDir(userDataDir){
    if(!userDataDir||typeof require!=='function')return {phone:'',whatsapp:'',email:'',website:''};
    try{
      const fs=require('fs'),path=require('path');
      const file=path.join(String(userDataDir),'data','siwangbox-v5.json');
      const db=JSON.parse(fs.readFileSync(file,'utf8'));
      return pickSellerExtra(db&&db.settings||{});
    }catch(e){ return {phone:'',whatsapp:'',email:'',website:''}; }
  }
  function sellerExtraFor(opts){
    if(opts&&opts.sellerInfo&&typeof opts.sellerInfo==='object')return pickSellerExtra(opts.sellerInfo);
    if(typeof Store!=='undefined'&&Store&&typeof Store.settings==='function'){
      try{ return pickSellerExtra(Store.settings()||{}); }catch(e){/* 只读失败不阻断 */}
    }
    if(typeof process!=='undefined'&&process.versions&&process.versions.electron){
      try{ const electron=require('electron'); const app=electron&&(electron.app||(electron.default&&electron.default.app));
        if(app&&typeof app.getPath==='function')return sellerExtraFromUserDataDir(app.getPath('userData')); }catch(e){/* 非 main 进程或不可用 */}
    }
    return {phone:'',whatsapp:'',email:'',website:''};
  }

  /* 汇总区（与 pricing.js final_total 同源口径，与 P1-D-03 逐字节同逻辑） */
  function totalsRC(doc,opts){
    const items=(Array.isArray(doc.items)?doc.items:[]).filter(x=>x&&typeof x==='object');
    const stored=(!opts||!opts.isDraft)&&doc.totals&&finite(doc.totals.grand)?doc.totals.grand:null;
    const grand=stored!=null?stored:Model.documentTotals(items.map(it=>({amount:Model.round2((+it.qty||0)*(+it.price||0))}))).grand;
    const p=(doc._unknown&&doc._unknown.pricing)||{};
    const freightRows=Array.isArray(p.freight)?p.freight:[];
    const fxv=finite(+doc.fx)&&+doc.fx>0?+doc.fx:null;
    const mk=finite(+doc.freightMarkup)&&+doc.freightMarkup>=0?+doc.freightMarkup:0;
    let charge=0,packingCharged=0,incomplete=false,hasCustomerCharge=false;
    freightRows.forEach(fr=>{
      if(!fr||fr.charge_customer!==true)return;
      hasCustomerCharge=true;
      if(fr.confirmed!==true||!finite(+fr.amount)||+fr.amount<0){incomplete=true;return;}
      let usd=null;
      if(fr.currency==='USD')usd=+fr.amount;
      else if(fxv)usd=+fr.amount/fxv;
      else {incomplete=true;return;}   /* BUG-11 同款：fx 缺失不得静默漏收 */
      if(fr.item==='packing')packingCharged+=usd;   /* 木箱费已摊入明细单价，防双计 */
      charge+=usd;
    });
    const quotedFreight=r2((charge-packingCharged)*(1+mk));
    const extra=p.extra||{};
    const disc=(extra&&finite(+extra.discount)&&+extra.discount>=0)?r2(+extra.discount):null;
    const oth=(extra&&finite(+extra.other_charges)&&+extra.other_charges>=0)?r2(+extra.other_charges):null;
    const freightKnown=!incomplete&&(!hasCustomerCharge||fxv!==null||freightRows.every(fr=>!fr||fr.currency!=='CNY'||!fr.charge_customer));
    const freightOk=!incomplete;
    const total=freightOk&&disc!=null&&oth!=null?r2(grand+quotedFreight-disc+oth):null;
    return {grand,quotedFreight,disc,oth,total,freightOk,freightKnown};
  }

  /* ============================================================
   * P1-D-04：五类单据共用 RunCheng 黑白版式
   * 骨架完全相同（抬头 / 标题行 / 买方+单据信息双栏 / 明细表 / 条款+汇总 / 签名 / 页脚），
   * 只有「业务内容」按单据类型切换：标题、单据信息行、明细列、条款行、汇总口径。
   * 不新增模板系统：仍然是同一个 quotation-rc-v1，只是不再限定 QT。
   * ============================================================ */
  const TITLES={QT:'QUOTATION',PI:'PROFORMA INVOICE',SC:'SALES CONTRACT',CI:'COMMERCIAL INVOICE',PL:'PACKING LIST'};
  const FOOT_LABELS={QT:'Customer-facing Quotation',PI:'Proforma Invoice',SC:'Sales Contract',CI:'Commercial Invoice',PL:'Packing List'};
  const NO_LABELS={QT:'Quote No.',PI:'PI No.',SC:'Contract No.',CI:'Invoice No.',PL:'PL No.'};
  const PACK_MODES={separate:'Separate packing (sum of rows)',mixed:'Mixed packing (document total)'};

  /* 数字/数量：缺失一律「—」，不编造；不做四舍五入以外的改写 */
  const num=(v,d)=>{ if(v==null||v===''||!isFinite(+v))return DASH; return (+v).toFixed(d==null?2:d); };
  const qtyTxt=v=>{ if(v==null||v===''||!isFinite(+v))return DASH; const n=+v; return n===Math.floor(n)?n.toLocaleString('en-US'):String(n); };
  const kv=(k,v)=>'<tr><th>'+k+'</th><td>'+v+'</td></tr>';

  /* 1. 公司抬头（五类完全一致）：LOGO 左，公司名/地址/Tel|WhatsApp/Email|Web 右，黑色分隔线 */
  function headBlock(s,se,logo){
    const telParts=[]; if(se.phone)telParts.push('Tel: '+esc(se.phone));
    if(se.whatsapp)telParts.push('WhatsApp: '+esc(se.whatsapp));
    const webParts=[]; if(se.email)webParts.push('Email: '+esc(se.email));
    if(se.website)webParts.push('Web: '+esc(se.website));
    return '<div class="rc-head">'+
      (logo?'<img class="rc-logo" alt="Company Logo" src="'+logo+'">':'')+
      '<div class="rc-co">'+
      '<div class="rc-co-name">'+dv(s.company)+'</div>'+
      (String(s.address||'').trim()?'<div class="rc-co-sub">'+lines(s.address)+'</div>':'')+
      (telParts.length?'<div class="rc-co-sub">'+telParts.join(' &nbsp;|&nbsp; ')+'</div>':'')+
      (webParts.length?'<div class="rc-co-sub">'+webParts.join(' &nbsp;|&nbsp; ')+'</div>':'')+
      '</div></div>';
  }

  /* 2. 标题行：左大号标题（按类型），右 No./Date
   * P1-D-05-FIX-01：SC 曾把 Sign Date / Sign Place 同时印在标题行右上与 DOCUMENT INFO，
   * 重复 2 行（约 30px）把纸面顶出 A4 一页，造成第二页只剩页脚。签订日期/地点在
   * DOCUMENT INFO 中已完整显示，此处不再重复；五类标题行高度因此统一。 */
  function titleBlock(type,doc){
    const meta=['<div>No.: '+dv(doc.no)+'</div>','<div>Date: '+dv(doc.date)+'</div>'];
    return '<div class="rc-title-row"><div class="rc-title">'+TITLES[type]+'</div>'+
      '<div class="rc-title-meta">'+meta.join('')+'</div></div>';
  }

  /* 贸易术语拆分（仅展示层，不改单据字段） */
  function tradeSplit(doc,p){
    const termFull=String(doc.term||'').trim();
    const incoterm=String(p.incoterm||'').trim();
    let namedPlace=String(p.namedPlace||'').trim();
    if(!namedPlace&&incoterm&&termFull){
      try{ const m=termFull.match(new RegExp('^'+incoterm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s+(.+)$','i'));
        if(m)namedPlace=String(m[1]).trim(); }catch(e){/* 解析失败不阻断 */}
    }
    return {termFull:termFull,incoterm:incoterm,namedPlace:namedPlace};
  }

  /* 3. 买方 / 单据信息双栏：左边五类一致，右边按类型换业务字段
   *    pa = PL 的包装汇总（Model.packagingTotals），用于把「总件数」印成与右下汇总表同一个值；
   *         分开包装时整单总件数不在 doc.totalPackages 上，必须用汇总口径，否则两处会打架。 */
  function infoBlock(type,doc,cur,s,c,p,pa){
    const tr=tradeSplit(doc,p);
    const buyerTable='<div class="rc-infobox"><table class="rc-info rc-buyer"><tbody>'+
      '<tr class="rc-info-h"><th colspan="2">BUYER / CONSIGNEE</th></tr>'+
      kv('Company',dv(c.company||c.name))+
      kv('Contact',dv(c.name))+
      kv('Address',dv(doc.buyerAddress||c.address))+
      kv('Country',dv(c.country))+
      kv('Email',DASH)+
      kv('Phone',DASH)+
      '</tbody></table></div>';
    let rows=kv(NO_LABELS[type],dv(doc.no))+kv('Date',dv(doc.date));
    if(type==='SC')rows+=kv('Sign Date',dv(doc.signDate))+kv('Sign Place',dv(doc.signPlace));
    rows+=kv('Salesperson',dv(s.contact));
    if(type!=='PL')rows+=kv('Currency',esc(cur));
    rows+=kv('Trade Term',dv(tr.incoterm||tr.termFull))+kv('Named Place',dv(tr.namedPlace));
    if(type==='PL'){
      rows+=kv('Packing Mode',dv(PACK_MODES[doc.packagingMode]||''));
      rows+=kv('Total Packages',(pa&&pa.packages!=null)?esc(pa.packages):DASH);
    }else{
      rows+=kv('Valid Until',dv(doc.validity));
    }
    const docTable='<div class="rc-infobox"><table class="rc-info rc-docinfo"><tbody>'+
      '<tr class="rc-info-h"><th colspan="2">DOCUMENT INFO</th></tr>'+rows+'</tbody></table></div>';
    return '<div class="rc-info2">'+buyerTable+docTable+'</div>';
  }

  /* 4. 明细表：视觉一致（全黑边框、独立 PHOTO 列），列随单据类型变化
   *    QT/PI    NO. PHOTO PRODUCT NAME SPECIFICATION QTY UNIT UNIT PRICE AMOUNT
   *    SC/CI    … 追加 HS CODE（这两类单据的业务字段）
   *    PL       无价格金额，改为 PACKAGES / N.W. / G.W. / CBM
   * P1-D-05：PHOTO 列只认实物图快照 _unknown.realImage（与产品库 realImageData 同源）。
   *    原版 RunCheng 客户纸面选图口径为 img_type='main'，无 main 显示 No Image，绝不退化到
   *    spec/accessory。当前 imageData / _unknown.productImage 是产品目录规格页，属规格图，
   *    因此这里绝不读取、绝不回退；无实物图一律 NO IMAGE。 */
  function colPlan(type){
    if(type==='PL')return {price:false,hs:false,pack:true,
      heads:['NO.','PHOTO','PRODUCT NAME','SPECIFICATION','QTY','UNIT','PACKAGES','N.W.(KG)','G.W.(KG)','CBM'],
      widths:[4,10,15,15,5,6,9,12,12,12]};
    if(type==='SC'||type==='CI')return {price:true,hs:true,pack:false,
      heads:['NO.','PHOTO','PRODUCT NAME','SPECIFICATION','HS CODE','QTY','UNIT','UNIT PRICE','AMOUNT'],
      widths:[4,10,15,16,9,5,6,16,19]};
    return {price:true,hs:false,pack:false,
      heads:['NO.','PHOTO','PRODUCT NAME','SPECIFICATION','QTY','UNIT','UNIT PRICE','AMOUNT'],
      widths:[5,12,16,20,6,8,16,17]};
  }
  function itemsBlock(type,items,cur){
    const plan=colPlan(type);
    const heads=plan.heads.map(h=>h==='UNIT PRICE'?('UNIT PRICE ('+esc(cur)+')'):(h==='AMOUNT'?('AMOUNT ('+esc(cur)+')'):h));
    const rows=items.map((it,i)=>{
      /* P1-D-05：只认实物图快照；规格图（productImage / imageData）绝不回退。 */
      const u=(it&&it._unknown)||{};
      const img=(Ref&&Ref.image)?(Ref.image(u.realImage)||''):'';
      const name=String(it.nameEn||'').trim()?it.nameEn:(it.nameCn||'');
      const sub=(String(it.nameEn||'').trim()&&String(it.nameCn||'').trim())?'<div class="rc-name-sub">'+esc(it.nameCn)+'</div>':'';
      const spec=(Ref&&Ref.description)?Ref.description(it):'';
      const cells=['<td class="c">'+(i+1)+'</td>',
        '<td class="imgcell">'+(img?'<img class="rc-photo" alt="Product Photo" src="'+img+'">':'<div class="noimg">NO IMAGE</div>')+'</td>',
        '<td class="pname"><b>'+esc(name)+'</b>'+sub+'</td>',
        '<td class="spec">'+(String(spec||'').trim()?'<div class="specdiv">'+lines(spec)+'</div>':DASH)+'</td>'];
      if(plan.hs){
        const hs=String(it.hsCode==null?'':it.hsCode).trim();
        cells.push('<td class="c">'+(hs?esc(hs):DASH)+'</td>');
      }
      cells.push('<td class="num">'+qtyTxt(it.qty)+'</td>','<td class="c">'+dv(it.unit)+'</td>');
      if(plan.pack){
        cells.push('<td class="num">'+num(it.packages,0)+'</td>',
          '<td class="num">'+num(it.net,2)+'</td>',
          '<td class="num">'+num(it.gross,2)+'</td>',
          '<td class="num">'+num(it.volume,3)+'</td>');
      }else{
        const amt=Model?Model.round2((+it.qty||0)*(+it.price||0)):Math.round((+it.qty||0)*(+it.price||0)*100)/100;
        cells.push('<td class="num">'+money(it.price)+'</td>','<td class="num">'+money(amt)+'</td>');
      }
      return '<tr>'+cells.join('')+'</tr>';
    }).join('');
    const cols=plan.widths.map(w=>'<col style="width:'+w+'%">').join('');
    return '<table class="rc-items"><colgroup>'+cols+'</colgroup>'+
      '<thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead>'+
      '<tbody>'+(rows||'<tr><td colspan="'+heads.length+'">'+DASH+'</td></tr>')+'</tbody></table>';
  }

  /* 5. 条款区：左侧表头统一为 COMMERCIAL TERMS（PL 为 PACKING & SHIPPING），行随类型变化 */
  function packText(doc){
    const r=doc._unknown&&doc._unknown.referenceFields;
    return (r&&typeof r.packageText==='string')?r.packageText.trim():'';
  }
  function termsRows(type,doc){
    const pack=packText(doc);
    if(type==='PL')return [
      ['Shipping Marks',dv(doc.marks)],
      ['Packing Mode',dv(PACK_MODES[doc.packagingMode]||'')],
      ['Notes &amp; Exclusions',dv(doc.remark)]
    ];
    if(type==='SC')return [
      ['Payment Terms',dv(doc.payment)],
      ['Delivery',dv(doc.delivery)],
      ['Packaging',dv(pack)],
      ['Terms &amp; Conditions',dv(doc.contractTerms)],
      ['Bank Details',dv(doc.bank)],
      ['Notes &amp; Exclusions',dv(doc.remark)]
    ];
    if(type==='CI')return [
      ['Payment Terms',dv(doc.payment)],
      ['Shipment',dv(doc.shipment)],
      ['Vessel / Voyage',dv(doc.vessel)],
      ['Port of Origin',dv(doc.origin)],
      ['Packaging',dv(pack)],
      ['Bank Details',dv(doc.bank)],
      ['Notes &amp; Exclusions',dv(doc.remark)]
    ];
    if(type==='PI')return [
      ['Payment Terms',dv(doc.payment)],
      ['Delivery',dv(doc.delivery)],
      ['Validity',dv(doc.validity)],
      ['Packaging',dv(pack)],
      ['Bank Details',dv(doc.bank)],
      ['Notes &amp; Exclusions',dv(doc.remark)]
    ];
    return [
      ['Payment Terms',dv(doc.payment)],
      ['Production Lead Time',dv(doc.delivery)],
      ['Packaging',dv(pack)],
      ['Notes &amp; Exclusions',dv(doc.remark)]
    ];
  }

  /* 6. 下半区：左条款（+ 金额大写），右金额汇总；PL 右侧改为包装汇总，全无价格 */
  function bottomBlock(type,doc,t,cur,items,pa){
    const rows=termsRows(type,doc);
    const terms='<table class="rc-terms"><colgroup><col style="width:27%"><col style="width:73%"></colgroup><tbody>'+
      '<tr class="rc-info-h"><th colspan="2">'+(type==='PL'?'PACKING &amp; SHIPPING':'COMMERCIAL TERMS')+'</th></tr>'+
      rows.map(r=>kv(r[0],r[1])).join('')+
      '</tbody></table>';
    const trow=(label,v,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><th>'+label+'</th><td class="num">'+v+'</td></tr>';
    if(type==='PL'){
      const sum='<table class="rc-total rc-packs"><tbody>'+
        trow('Total Packages',pa&&pa.packages!=null?esc(pa.packages):DASH)+
        trow('Total N.W. (KG)',num(pa&&pa.net,2))+
        trow('Total G.W. (KG)',num(pa&&pa.gross,2))+
        trow('Total CBM',num(pa&&pa.volume,3),'rc-grand')+
        '</tbody></table>';
      return '<div class="rc-bottom"><div class="rc-left">'+terms+'</div>'+sum+'</div>';
    }
    const totalTable='<table class="rc-total"><tbody>'+
      trow('Product Subtotal',money(t.grand))+
      trow('Shipping / Freight',t.freightOk?money(t.quotedFreight):DASH)+
      trow('Discount',t.disc!=null?money(t.disc):'0.00')+
      trow('Tax / Other Charges',t.oth!=null?money(t.oth):'0.00')+
      trow('TOTAL AMOUNT ('+esc(cur)+')',t.total==null?money(t.grand):money(t.total),'rc-grand')+
      '</tbody></table>';
    const words=(t.total!=null&&Ref&&Ref.words)
      ?'<div class="rc-words"><span><b>Amount in Words:</b> '+esc((cur+' '+Ref.words(t.total)).toUpperCase())+'</span></div>':'';
    return '<div class="rc-bottom"><div class="rc-left">'+terms+words+'</div>'+totalTable+'</div>';
  }

  /* 7. 双签名区（五类一致） */
  function signBlock(){
    return '<div class="rc-sign">'+
      '<div class="rc-sign-box"><div class="rc-sign-h">For the Seller</div><div class="rc-sign-space"></div>'+
      '<div class="rc-sign-sub">Authorized Signature / Company Stamp</div></div>'+
      '<div class="rc-sign-box rc-sign-r"><div class="rc-sign-h">For the Buyer</div><div class="rc-sign-space"></div>'+
      '<div class="rc-sign-sub">Authorized Signature</div></div></div>';
  }

  /* 8. 页脚（五类一致，仅单据名不同）：公司 · 单号 · 单据全称 */
  function footBlock(type,doc,s){
    const parts=[];
    if(String(s.company||'').trim())parts.push(esc(s.company));
    if(String(doc.no||'').trim())parts.push(esc(doc.no));
    parts.push(FOOT_LABELS[type]);
    return '<div class="rc-foot">'+parts.join(' &nbsp;·&nbsp; ')+'</div>';
  }

  function build(doc,opts){
    opts=opts||{};
    if(!doc||!TITLES[doc.type])return null;   /* P1-D-04：五类单据共用本版式，其他类型返回 null 由 sheet.js 兜底 */
    const type=doc.type;
    const items=(Array.isArray(doc.items)?doc.items:[]).filter(x=>x&&typeof x==='object');
    const cur=doc.currency||'USD';
    const s=doc.seller||{};
    const c=doc.customer||{};
    const p=(doc._unknown&&doc._unknown.pricing)||{};
    const t=(type==='PL')?null:totalsRC(doc,opts);
    /* PL 的包装汇总只算一次：单据信息栏的「总件数」与右下汇总表必须同源同值 */
    const pa=(type==='PL'&&Model&&Model.packagingTotals)
      ?Model.packagingTotals(items,doc.packagingMode==null?null:doc.packagingMode,doc.totalPackages)
      :null;
    const logo=logoFor(doc,opts);
    const se=sellerExtraFor(opts);
    /* 运费不完整时的内部警示：只在纸面草稿/核对场景提示，不写模板诊断类文案 */
    const warn=(t&&!t.freightOk)
      ?'<div class="q-warn">运费收费项尚未核实完整（或人民币运费缺汇率），本期总额暂不含客户承担运费，核实后请刷新核价再出单。</div>':'';
    return '<div class="q-sheet rc-sheet" data-type="'+esc(type)+'" data-template="'+TPL_ID+'">'+
      headBlock(s,se,logo)+
      titleBlock(type,doc)+
      infoBlock(type,doc,cur,s,c,p,pa)+
      itemsBlock(type,items,cur)+
      bottomBlock(type,doc,t,cur,items,pa)+
      warn+
      /* P1-D-05-FIX-01：签名区 + 页脚包成原子块（.rc-tail，break-inside:avoid）。
       * 原实现签名是 flex 容器，Chromium 对 flex 的 break-inside:avoid 支持不完整，
       * 会被从中间拆开、只剩页脚落到第二页；原子块保证「签名与页脚」同页进出，
       * 从结构上消除「只有页脚的孤立页」。 */
      '<div class="rc-tail">'+signBlock()+footBlock(type,doc,s)+'</div>'+
      '</div>';
  }

  return {ids:[TPL_ID],build,logoFor,logoFromUserDataDir,validLogo,totalsRC,sellerExtraFor,sellerExtraFromUserDataDir};
});
