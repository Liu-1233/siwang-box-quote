(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ProductImport=factory();})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const numeric=['mesh','wire','width','rollLen','price','productLength','productWidth','productHeight','productWeight','packageLength','packageWidth','packageHeight','unitsPerCarton','netWeight','grossWeight'];
  const textLimit={catalogSpecs:8000,note:8000};
  function specsApi(){return typeof SBProductSpecs!=='undefined'?SBProductSpecs:require('./product-specs.js');}
  /* 系列可选规格：目录里一个系列有多档尺寸，产品模型只能存单值。
     导入时把选项挂在 specOptions 上，不替用户选；点选后才写入 specs。 */
  function prepareOptions(p,i){
    if(p.specOptions==null)return null;
    const S=specsApi(),fields=S.fields;
    if(typeof p.specOptions!=='object'||Array.isArray(p.specOptions))throw Error('第'+(i+1)+'条可选规格格式错误');
    const out={};
    for(const key of Object.keys(p.specOptions)){
      if(!fields[key])throw Error('第'+(i+1)+'条出现未知规格字段：'+key);
      const arr=p.specOptions[key];
      if(!Array.isArray(arr)||!arr.length||arr.length>20)throw Error('第'+(i+1)+'条 '+fields[key][0]+' 的可选值须为 1~20 个');
      const clean=[];
      for(const v of arr){
        if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>1e9)throw Error('第'+(i+1)+'条 '+fields[key][0]+' 的可选值必须为正数（按毫米填写）');
        if(key==='railCount'&&!Number.isInteger(v))throw Error('第'+(i+1)+'条横梁数量可选值须为整数');
        if(clean.indexOf(v)<0)clean.push(v);
      }
      out[key]=clean.sort((a,b)=>a-b);
    }
    return Object.keys(out).length?out:null;
  }
  function prepare(input,existing){
    if(!input||input.format!=='siwang-products-v1'||!Array.isArray(input.products)||!input.products.length||input.products.length>500)throw Error('请选择丝网盒子产品包（最多500条），不是整库备份');
    const seen=new Set((existing||[]).map(p=>String(p.sku||'').trim().toLowerCase()).filter(Boolean));let skipped=0;
    const rows=[];
    input.products.forEach((p,i)=>{
      if(!p||typeof p!=='object'||Array.isArray(p))throw Error('第'+(i+1)+'条格式错误');
      const out={};for(const key of ['nameCn','nameEn','sku','category','material','unit','hsCode','note','salesPitch','packagingMethod','cartonMark','catalogSpecs','sourceFile']){if(p[key]!=null&&typeof p[key]!=='string')throw Error('第'+(i+1)+'条文本字段错误');out[key]=String(p[key]||'').slice(0,textLimit[key]||1000);}
      if(!out.nameCn.trim()||!out.sku.trim())throw Error('第'+(i+1)+'条缺少产品名称或SKU');
      for(const key of numeric){const v=p[key];if(v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('第'+(i+1)+'条'+key+'必须为非负有限数字');out[key]=v==null?0:v;}
      const image=p.imageData||'';if(typeof image!=='string'||image.length>1000100||(image&&!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)))throw Error('第'+(i+1)+'条图片格式错误');out.imageData=image;
      /* P1-D-05：产品包里若带独立实物图，一并保留（与规格图分开校验，不互换、不冒充）。 */
      const real=p.realImageData||'';if(typeof real!=='string'||real.length>1000100||(real&&!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(real)))throw Error('第'+(i+1)+'条实物图格式错误');if(real)out.realImageData=real;
      /* P1-D-05-FIX-01：三态状态随产品包一起导入（缺省视为 auto，兼容旧包）。 */
      const rmode=p.realImageMode==null?'':String(p.realImageMode);
      if(rmode&&['auto','custom','none'].indexOf(rmode)<0)throw Error('第'+(i+1)+'条实物图状态错误');
      if(rmode)out.realImageMode=rmode;
      const specOptions=prepareOptions(p,i);if(specOptions)out.specOptions=specOptions;
      const S=specsApi();
      if(p.specs){const error=S.validate(p.specs);if(error)throw Error('第'+(i+1)+'条：'+error);}
      const inferred=S.parseText([out.nameCn,out.nameEn,out.catalogSpecs,out.note].join('\n')).specs;
      const merged=Object.assign({},inferred,p.specs||{});
      for(const key of Object.keys(S.fields)){
        if(p.specs&&p.specs[key]!=null)merged[key]=p.specs[key];
        else merged[key]=specOptions&&specOptions[key]?null:inferred[key];
      }
      merged.displayUnits=Object.assign({},inferred.displayUnits,p.specs&&p.specs.displayUnits||{});
      out.specs=S.normalize(merged);
      out.specStatus=specOptions?'series':'';
      const sku=out.sku.trim().toLowerCase();if(seen.has(sku)){skipped++;return;}seen.add(sku);rows.push(out);
    });return {rows,skipped,total:input.products.length};
  }
  function seriesSummary(row){
    const S=specsApi();
    if(!row.specOptions)return '';
    const keys=Object.keys(row.specOptions);
    return keys.map(k=>S.fields[k][0]+' '+row.specOptions[k].map(v=>S.displayValue(v,S.unitFor(row.specs||{},k))+S.unitFor(row.specs||{},k)).join(' / ')).join('；');
  }
  function statusOf(options,specs){
    const keys=Object.keys(options||{});if(!keys.length)return '';
    const picked=keys.filter(k=>Number(specs[k])>0).length;
    return picked===0?'series':picked<keys.length?'partial':'picked';
  }
  /* 用户点选一个目录规格：同一个值再点一次即取消。只在用户操作时写库。 */
  function applyPick(product,field,value){
    const S=specsApi();
    if(!S.fields[field])throw Error('未知规格字段');
    if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw Error('规格值无效');
    const list=product&&product.specOptions&&product.specOptions[field];
    if(!Array.isArray(list)||list.indexOf(value)<0)throw Error('这个值不在该产品的目录可选规格内');
    const toggle=Number(product.specs&&product.specs[field])===value;
    const specs=S.normalize(Object.assign({},product.specs,{[field]:toggle?null:value}));
    const error=S.validate(specs);if(error)throw Error(error);
    return {specs,specStatus:statusOf(product.specOptions,specs)};
  }
  const api={prepare,pending:null,seriesSummary,applyPick,statusOf,
    async choose(input){const f=input.files&&input.files[0];input.value='';if(!f)return;if(f.size>25*1024*1024){UI.toast('产品包不能超过25MB');return;}
      try{const result=prepare(JSON.parse(await f.text()),Store.products());api.pending=result;
        const series=result.rows.filter(r=>r.specOptions).length;
        UI.openModal('导入产品预览',`<p>共 ${result.total} 条，准备新增 ${result.rows.length} 条，跳过重复SKU ${result.skipped} 条。${series?'其中 '+series+' 条带目录可选规格，导入后需逐条选定具体规格才能报价。':''}</p><p>确认后只新增产品，已有客户、单据与产品不被覆盖。</p><div style="max-height:320px;overflow:auto">${result.rows.map(p=>`<p><b>${Sheet.esc(p.sku)}</b> ${Sheet.esc(p.nameCn)} · ${p.imageData?'含图片':'无图片'}${p.specOptions?' · 系列 '+Object.keys(p.specOptions).length+' 项可选':''}</p>`).join('')}</div>`,[{text:'取消',cls:'ghost',fn:'ProductImport.cancel()'},{text:'确认新增',fn:'ProductImport.commit()'}]);
      }catch(e){api.pending=null;UI.toast('未导入：'+e.message);}
    },
    cancel(){api.pending=null;UI.closeModal(true);},
    commit(){if(!api.pending)return;if(typeof window==='undefined'||!window.SBW){UI.toast('当前是直接打开的网页文件，不能写入桌面产品库。请启动“丝网盒子”桌面程序后再导入。');return;}const current=prepare({format:'siwang-products-v1',products:api.pending.rows},Store.products());if(!current.rows.length){api.cancel();UI.toast('没有需要新增的产品');return;}
      if(!Store.importProducts(current.rows)){UI.toast('未导入：'+(Store.saveError()||'保存失败，请检查数据状态'));return;}const count=current.rows.length;api.pending=null;UI.closeModal(true);UI.render();UI.toast('已新增'+count+'个产品');}
  };return api;
});
if(typeof window!=='undefined'){
  const beforeProductImport=Pages.products;
  Pages.products=function(){return '<div class="quick" style="margin-bottom:12px"><label class="btn ghost">导入产品包<input type="file" accept=".json,application/json" style="display:none" onchange="ProductImport.choose(this)"></label><span class="t-sub">先预览再确认；按SKU去重，仅新增</span></div>'+beforeProductImport();};
  /* 系列规格：点选一个值写入产品规格，再点同一个值取消。只在用户点选时写库，导入本身不替用户选规格。 */
  function currentProduct(){return Store.products().find(x=>x.id===ProductView.selectedId)||null;}
  Prod.pickSpec=function(field,value){
    const p=currentProduct();if(!p)return;
    let next;
    try{next=api.applyPick(p,field,Number(value));}
    catch(e){UI.toast(e.message);return;}
    if(!Store.updateProduct(Object.assign({},p,next))){UI.toast('没有保存：'+(Store.saveError()||'数据只读或校验未通过'));return;}
    UI.render();
  };
  Prod.clearSpecs=function(){
    const S=specsApi();const p=currentProduct();if(!p||!p.specOptions)return;
    const base={};for(const k of Object.keys(p.specOptions))base[k]=null;
    const specs=S.normalize(Object.assign({},p.specs,base));
    if(!Store.updateProduct(Object.assign({},p,{specs,specStatus:'series'}))){UI.toast('没有保存：'+(Store.saveError()||'数据只读或校验未通过'));return;}
    UI.render();UI.toast('已清除所选规格，产品回到系列状态');
  };
}
