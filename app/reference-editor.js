'use strict';
const ReferenceEditor={
  /* P1-D-04：RunCheng 黑白版式（quotation-rc-v1）不再是 QT 专属——五类单据都可选，
     并且排在第一位作为默认项；各类型的参考文件模板/旧版式仍保留在列表里，能力不减。 */
  choices(type){return type==='PL'?[['quotation-rc-v1','RunCheng 统一版式'],['basic-v1','基础装箱单'],['packing-ref-v1','参考文件：装箱单'],['shipping-mark-v1','参考文件：SHIPPING MARK唛头']]:type==='PI'?[['quotation-rc-v1','RunCheng 统一版式'],['basic-v1','基础单据版'],['jr-pi-v1','参考文件：JR形式发票'],['trade-v1','旧贸易版（保留）']]:[['quotation-rc-v1','RunCheng 统一版式'],['basic-v1','基础单据版'],['trade-v1','贸易版']];},
  set(key,value){if(!ReferenceSheets.fields.includes(key)||!QuoteEdit.draft)return;const d=QuoteEdit.draft;d._unknown=d._unknown||{};d._unknown.referenceFields=d._unknown.referenceFields||{};d._unknown.referenceFields[key]=String(value||'').slice(0,4000);Doc.markDirty();Doc.refresh();},
  card(d){const id=Sheet.templateFor(d);if(!ReferenceSheets.ids.includes(id))return '';const r=ReferenceSheets.ref(d);
    const list=id==='shipping-mark-v1'?[['labelProduct','PRODUCT NAME 产品名称'],['labelSpecs','SPECIFICATION 规格'],['labelQty','QUANTITY 本包数量及单位'],['labelNet','NET WEIGHT 本包净重（kg）'],['labelGross','GROSS WEIGHT 本包毛重（kg）'],['labelConsignee','CONSIGNEE 收货人'],['labelOrigin','ORIGIN 原产地']]:id==='packing-ref-v1'?[['contractNo','S/C No. 合同编号'],['packageKind','包装单位（如 PALLETS / CARTONS）']]:[['sellerContact','卖方联系人'],['sellerTel','卖方电话'],['sellerEmail','卖方邮箱'],['buyerTel','买方电话'],['buyerEmail','买方邮箱'],['packageText','Package 包装约定']];
    return '<div class="card qe-card"><div class="card-h">参考模板专用字段</div>'+(id==='shipping-mark-v1'?'<p class="t-sub">这里是一包货物的标签，请手填本包数量、净重、毛重；不从整行重量猜每箱。原产地由你确认。可先存草稿，完整填写后导出。</p>':'')+list.map(([key,label])=>'<div class="form-row"><label>'+label+'</label><textarea class="inp" rows="2" maxlength="4000" oninput="ReferenceEditor.set(\''+key+'\',this.value)">'+Sheet.esc(r[key]||'')+'</textarea></div>').join('')+'</div>';
  }
};
/* P1-D-04：五类单据统一 RunCheng 黑白版式后，「声明模板」与「生效模板」不再分叉
   （BUG-ACC-01 时期的「非 QT 声明 RC 会被降级」前提已取消）。编辑器下拉与名称统一切到
   Sheet.templateFor 的生效口径，避免下拉显示值与纸面渲染不一致。 */
Doc.templateId=function(){return Sheet.templateFor(QuoteEdit.draft||{});};
Doc.templateName=function(){const d=QuoteEdit.draft||{};return Doc.ensureQuoteLayout().templateName||(ReferenceEditor.choices(d.type).find(x=>x[0]===Sheet.templateFor(d))||['','基础单据版'])[1];};
Doc.setTemplate=function(id){const d=QuoteEdit.draft;if(!d||!ReferenceEditor.choices(d.type).some(x=>x[0]===id))return;Doc.ensureQuoteLayout().templateId=id;delete d.templateId;Doc.markDirty();UI.render();};
const beforeReferencePreview=Doc.previewCommit;
Doc.previewCommit=function(el){const key=el&&el.dataset.editPath||'',match=key.match(/^reference\.([A-Za-z]+)$/);if(match){ReferenceEditor.set(match[1],el.textContent);return;}
  const spec=key.match(/^specification\.(\d+)$/);if(spec){const row=QuoteEdit.draft.items[+spec[1]];if(row){row._unknown=row._unknown||{};row._unknown.specificationOverride=String(el.textContent||'').slice(0,8000);Doc.markDirty();Doc.refresh();}return;}
  beforeReferencePreview.call(Doc,el);
};
const beforeReferenceQuote=Pages.quoteEdit;
Pages.quoteEdit=function(){let html=beforeReferenceQuote();const d=QuoteEdit.draft;if(!d)return html;const id=Sheet.templateFor(d);
  const select=/<select class="inp" onchange="Doc\.setTemplate\(this\.value\)">[\s\S]*?<\/select>/;
  html=html.replace(select,'<select class="inp" onchange="Doc.setTemplate(this.value)">'+ReferenceEditor.choices(d.type).map(([key,label])=>'<option value="'+key+'"'+(id===key?' selected':'')+'>'+label+'</option>').join('')+'</select>');
  html=html.replace('<div class="qe-pane" data-pane="edit">','<div class="qe-pane" data-pane="edit">'+ReferenceEditor.card(d));return html;
};
const beforeCatalogForm=Prod.openForm;
Prod.openForm=function(id){beforeCatalogForm.call(Prod,id);const body=document.getElementById('modalBody');if(!body||document.getElementById('p_catalog_specs'))return;const p=Store.products().find(x=>x.id===id);body.insertAdjacentHTML('beforeend','<div class="form-row"><label>目录可选规格 / 产品说明</label><textarea class="inp" id="p_catalog_specs" rows="6" maxlength="8000">'+Sheet.esc(p&&p.catalogSpecs||'')+'</textarea><div class="t-sub">目录系列有多种组合，开单前请确定具体规格；本段可带入PI的独立规格区。</div></div>');};
function seriesCard(p){
  const hasOptions=p&&p.specOptions&&Object.keys(p.specOptions).length;
  if(!hasOptions&&!(p&&p.catalogSpecs))return '';
  const S=typeof SBProductSpecs!=='undefined'?SBProductSpecs:null;
  const specs=(p&&p.specs)||{};
  let body='';
  if(hasOptions&&S){
    const keys=Object.keys(p.specOptions).filter(k=>S.fields[k]);
    const picked=keys.filter(k=>Number(specs[k])>0).length;
    const rows=keys.map(k=>{
      const u=S.unitFor(specs,k);
      const btns=p.specOptions[k].map(v=>{
        const on=Number(specs[k])===v;
        return '<button class="btn'+(on?'':' ghost')+'" style="margin:2px 4px;padding:3px 10px;font-size:12px" onclick="Prod.pickSpec(\''+k+'\','+v+')">'+Sheet.esc(S.displayValue(v,u))+' '+u+'</button>';
      }).join('');
      return '<div style="margin:8px 0 2px"><b style="font-size:13px">'+Sheet.esc(S.fields[k][0])+'</b><div>'+btns+'</div></div>';
    }).join('');
    body='<p class="t-sub">目录系列：'+keys.length+' 项共 '+keys.reduce((n,k)=>n+p.specOptions[k].length,0)+' 个可选值，已选 '+picked+' 项。点一下写入产品规格，再点同一个值取消；未选定的项不会进入报价。</p>'+rows+(picked?'<div style="margin-top:8px"><button class="btn ghost" onclick="Prod.clearSpecs()">清除已选规格</button></div>':'');
    const summary=S.summary(specs);
    if(summary)body='<div style="margin:6px 0;padding:8px 10px;background:#f3f8fb;border-radius:8px"><b style="font-size:13px">当前规格</b><div class="t-sub" style="margin-top:4px">'+Sheet.esc(summary)+'</div></div>'+body;
  }else if(!S){
    body='<p class="t-sub">规格模块未加载，暂时只能查看目录原文。</p>';
  }else{
    body='<p class="t-sub">这条产品没有可选规格清单，直接按实际规格录入。</p>';
  }
  const text=p.catalogSpecs?'<details style="margin-top:8px"><summary class="t-sub">目录原文</summary><p style="white-space:pre-wrap;margin-top:6px">'+Sheet.esc(p.catalogSpecs)+'</p></details>':'';
  return '<div class="product-section" style="padding:14px"><b>目录可选规格</b>'+body+text+'</div>';
}
const beforeCatalogPage=Pages.products;
Pages.products=function(){let html=beforeCatalogPage();const all=Store.products(),p=all.find(x=>x.id===ProductView.selectedId)||all[0];if(p)html=html.replace('<nav class="product-tabs">',seriesCard(p)+'<nav class="product-tabs">');return html;};
