/* 分类参数和资料识别。识别结果先进入表单，用户保存后才登记为产品。 */
/* AI 通道开关：暂不对外开放，只保留本地文字提取。要开就改成 true。 */
const AI_INTAKE_VISIBLE=false;
const ProductIntake={
  image:'',busy:false,session:0,
  collect(){
    const type=document.getElementById('sp_type');if(!type)return undefined;
    const out={type:type.value,displayUnits:{}};
    for(const key of Object.keys(SBProductSpecs.fields)){const el=document.getElementById('sp_'+key),select=document.getElementById('sp_unit_'+key),u=select?select.value:'mm';if(select)out.displayUnits[key]=u;out[key]=!el||!el.value.trim()?null:Number(el.value)*(key==='railCount'?1:SBProductSpecs.units[u]);}
    for(const key of ['finish','color','accessories','installation'])out[key]=(document.getElementById('sp_'+key)||{}).value||'';
    return out;
  },
  changeUnit(key,select){
    const input=document.getElementById('sp_'+key);if(!input)return;
    const old=select.dataset.previous||'mm',next=select.value;
    if(input.value.trim()&&Number.isFinite(Number(input.value)))input.value=SBProductSpecs.displayValue(Number(input.value)*SBProductSpecs.units[old],next);
    select.dataset.previous=next;
  },
  changeType(){
    const type=(document.getElementById('sp_type')||{}).value||'general';
    const fence=['fence','horse','privacy'].includes(type);
    const all=!!(document.getElementById('sp_all')||{}).checked;
    const groups={woven:['wireDiameter','openingWidth','openingHeight'],welded:['panelLength','panelHeight','wireDiameter','openingWidth','openingHeight'],fence:['panelLength','panelHeight','wireDiameter','openingWidth','openingHeight','panelThickness','postHeight','postWidth','postDepth','postThickness','embedDepth','frameWidth','frameThickness'],horse:['panelLength','panelHeight','panelThickness','postHeight','postWidth','postDepth','postThickness','railWidth','railHeight','railThickness','railCount','embedDepth'],privacy:['panelLength','panelHeight','panelThickness','postHeight','postWidth','postDepth','postThickness','railWidth','railHeight','railThickness','railCount','picketWidth','picketThickness','embedDepth']};
    document.querySelectorAll('[data-spec-key]').forEach(el=>{const k=el.dataset.specKey;el.style.display=!all&&groups[type]&&!groups[type].includes(k)?'none':'';});
    for(const id of ['p_mesh','p_roll']){const el=document.getElementById(id),row=el&&el.closest('.form-row');if(row)row.style.display=fence?'none':'';}
  },
  open(){
    if(this.busy)return;
    this.image='';this.session++;
    const AI_UI_VISIBLE=AI_INTAKE_VISIBLE;
    const consentRow=AI_UI_VISIBLE?'<div class="form-row" style="margin-top:12px"><label><input type="checkbox" id="pi_consent"> 使用 AI 时，将本次文字和所选图片发送至 AI 服务（由发布方统一提供）</label></div>':'';
    const statusText=AI_UI_VISIBLE?'本地提取适合格式明确的中文参数；AI 可整理自然语言，图片识别需要支持图片的模型。结果将打开为可编辑草稿。':'本地提取适合格式明确的中文参数，例如“网片长度2.5m，高度1.5m，丝径3mm”。结果会打开成可编辑草稿，核对后再保存。';
    const buttons=[{text:'取消',cls:'ghost',fn:'UI.closeModal()'}];
    if(AI_UI_VISIBLE)buttons.push({text:'本地文字提取',cls:'ghost',fn:'ProductIntake.extract(false)'},{text:'AI 识别并填表',fn:'ProductIntake.extract(true)'});
    else buttons.push({text:'提取并填表',fn:'ProductIntake.extract(false)'});
    UI.openModal('识别登记产品',`<div class="form-row"><label>粘贴厂家资料、聊天文字或产品参数</label><textarea class="inp" id="pi_text" rows="7" maxlength="20000" placeholder="例如：PVC马场围栏，网片长度2.5m，网片高度1.5m，板厚2mm，立柱高度2m，立柱厚度3mm，横梁数量3"></textarea></div>
      <div class="quick"><button class="btn ghost" onclick="ProductIntake.pickImage()">选择参数图片 / 聊天截图</button><button class="btn ghost" onclick="ProductIntake.clearImage()">移除图片</button><span id="pi_image_state">未选择图片</span></div>
      ${consentRow}
      <div class="t-sub" id="pi_status">${statusText}</div>`,buttons,true);
    UI.guardModal();
  },
  async pickImage(){
    if(this.busy)return;const token=this.session;
    try{const r=await window.SBW.pickProductImage();if(token!==this.session||!document.getElementById('pi_text'))return;if(r.ok){this.image=r.imageData;document.getElementById('pi_image_state').textContent='已选择图片（仅在点击 AI 时发送）';}else if(!r.canceled)UI.toast(r.error||'图片导入失败');}catch(e){UI.toast(e.message);}
  },
  clearImage(){this.image='';const el=document.getElementById('pi_image_state');if(el)el.textContent='未选择图片';},
  async extract(useAI){
    if(this.busy)return;
    const textEl=document.getElementById('pi_text');if(!textEl)return;
    const text=textEl.value,status=document.getElementById('pi_status'),consent=document.getElementById('pi_consent');
    if(!text.trim()&&!this.image){UI.toast('请粘贴资料或选择图片');return;}
    if(useAI&&!(consent&&consent.checked)){UI.toast('请勾选本次发送确认');return;}
    if(!useAI&&!text.trim()){UI.toast('图片请使用 AI 图片识别，本地提取需要文字');return;}
    let product;
    if(useAI){
      this.busy=true;if(status)status.textContent='正在识别，请稍候…';
      const token=this.session;
      try{if(!window.SBW||!window.SBW.productAIExtract)throw Error('请更新到支持 AI 识别的桌面版本');const auth=await window.SBW.productAIStatus();if(!auth.configured)throw Error('AI 识别暂未开放，可先用“本地文字提取”');if(!auth.authorized)throw Error(auth.error||'请先使用卡密激活 AI');const r=await window.SBW.productAIExtract({text,image:this.image,confirmed:true});if(token!==this.session||document.getElementById('pi_text')!==textEl)return;if(!r.ok)throw Error(r.error);product=r.product;}
      catch(error){if(status&&status.isConnected)status.textContent='识别失败：'+error.message;return;}
      finally{this.busy=false;}
    }else product=SBProductSpecs.parseText(text);
    if(!product)return;
    const image=this.image;UI.closeModal(true);Prod.openForm();
    for(const pair of [['p_cn','nameCn'],['p_en','nameEn'],['p_material','material'],['p_category','category'],['p_note','note'],['p_unit','unit']]){const el=document.getElementById(pair[0]);if(el&&product[pair[1]])el.value=product[pair[1]];}
    const specs=SBProductSpecs.normalize(product.specs);
    for(const key of ['type',...Object.keys(SBProductSpecs.fields),'finish','color','accessories','installation']){const el=document.getElementById('sp_'+key),select=document.getElementById('sp_unit_'+key);if(select){const u=SBProductSpecs.unitFor(specs,key);select.value=u;select.dataset.previous=u;}if(el)el.value=specs[key]==null?'':(select?SBProductSpecs.displayValue(specs[key],select.value):String(specs[key]));}
    if(image){Prod.imageDraft=image;const inp=document.getElementById('p_image');if(inp)inp.value=image;Prod.previewImage();}
    this.changeType();UI.toast('已填入草稿，请核对参数和单位后保存');
  },
  async saveKey(){
    const el=document.getElementById('s_ai_key');if(!el||!el.value.trim()){UI.toast('请填写 API Key');return;}
    try{const r=await window.SBW.productAIKeySave(el.value);if(!r.ok)throw Error(r.error);el.value='';UI.toast('密钥已加密保存，请同时保存并启用 AI 设置');}catch(e){UI.toast(e.message);}
  }
};
const productFormBeforeSpecs=Prod.openForm;
Prod.openForm=function(id){
  productFormBeforeSpecs.call(this,id);
  const body=document.getElementById('modalBody');if(!body||document.getElementById('sp_type'))return;
  const p=id?Store.products().find(x=>x.id===id):null;
  const specs=p&&p.specs||{type:p&&/护栏|围栏/.test(p.category||'')?'fence':'general'};
  body.insertAdjacentHTML('afterbegin',`<section class="card" style="padding:12px;margin-bottom:14px">
    <div class="card-h">规格（英文，印在客户单上）</div>
    <div class="form-row"><textarea class="inp" id="p_spec_text" rows="3" placeholder="像润成一样直接写文本，例如：1.5×2.5m 三横梁，2.5mm 加厚，White">${esc(p && p.specText ? p.specText : '')}</textarea></div>
    <div class="t-sub" style="margin-bottom:6px">这一栏就是客户看到的规格。结构化参数（下面折叠区）是选填，用于内部记录与 AI 识别登记，不影响纸面。</div>
    <details class="p2-spec-adv"><summary>高级：结构化参数（可选，默认收起）</summary>
    <div class="card-h" style="margin-top:10px">按产品类型登记参数</div>
    <div class="form-row"><label>产品类型</label><select class="inp" id="sp_type" onchange="ProductIntake.changeType()">${Object.keys(SBProductSpecs.types).map(key=>`<option value="${key}"${key===specs.type?' selected':''}>${esc(SBProductSpecs.types[key])}</option>`).join('')}</select></div>
    <div class="t-sub" style="margin-bottom:8px">长度、高度默认用 m，丝径和壁厚默认用 mm；可按客户要求选择 cm、ft（英尺）、in（英寸）。切换单位会自动换算。运输包装和计价单位另填。</div><label style="display:block;margin-bottom:8px"><input id="sp_all" type="checkbox" onchange="ProductIntake.changeType()"> 显示全部可选参数</label>
    <div class="form-2">${Object.keys(SBProductSpecs.fields).map(key=>{const u=SBProductSpecs.unitFor(specs,key);return `<div class="form-row" data-spec-key="${key}"><label>${esc(SBProductSpecs.fields[key][0])}${key==='railCount'?'（根）':''}</label><div style="display:flex;gap:6px"><input class="inp num" style="min-width:0" id="sp_${key}" type="number" min="0" step="${key==='railCount'?'1':'any'}" value="${specs[key]==null?'':esc(key==='railCount'?specs[key]:SBProductSpecs.displayValue(specs[key],u))}" placeholder="待确认">${key==='railCount'?'':`<select class="inp" style="width:90px;flex-shrink:0" id="sp_unit_${key}" data-previous="${u}" aria-label="${esc(SBProductSpecs.fields[key][0])}单位" onchange="ProductIntake.changeUnit('${key}',this)">${Object.keys(SBProductSpecs.units).map(x=>`<option value="${x}"${x===u?' selected':''}>${x}</option>`).join('')}</select>`}</div></div>`;}).join('')}</div>
    <div class="form-row"><label>安装方式 / 安装说明</label><input class="inp" id="sp_installation" list="sp_install_options" value="${esc(specs.installation||'')}" placeholder="可选择常用方式，也可自行填写"><datalist id="sp_install_options"><option value="埋地安装 / 埋入式立柱"><option value="底板安装 / 膨胀螺栓固定"><option value="法兰安装"><option value="墙面固定"><option value="夹具 / 卡扣固定"><option value="移动底座 / 免打孔"></datalist></div>
    ${[['finish','表面处理'],['color','颜色'],['accessories','配件 / 组合说明']].map(([key,label])=>`<div class="form-row"><label>${label}</label><input class="inp" id="sp_${key}" value="${esc(specs[key]||'')}"></div>`).join('')}
    </details></section>`);
  /* P2-01：目数/丝径/幅宽/卷长 属于旧的结构化规格，收进「高级」折叠区，
     字段与写入链不动（保存时照常读取），只是默认不占版面。 */
  try {
    const adv = body.querySelector('.p2-spec-adv');
    if (adv) {
      ['p_mesh', 'p_wire', 'p_width', 'p_roll'].forEach(function (id) {
        const el = document.getElementById(id);
        const row = el && el.closest ? el.closest('.form-row') : null;
        if (row && adv.contains(row) === false) adv.appendChild(row);
      });
    }
  } catch (e) { /* 无 DOM 环境（测试）忽略 */ }
  ProductIntake.changeType();Prod.priceMode();UI.guardModal();
};
const productSaveBeforeSpecs=Prod.save;
Prod.save=function(){const specs=ProductIntake.collect();if(specs){const error=SBProductSpecs.validate(specs);if(error){UI.toast(error);return false;}}return productSaveBeforeSpecs.call(this);};
const productsBeforeIntake=Pages.products;
Pages.products=function(){
  let html=productsBeforeIntake();
  const list=Store.products(),p=list.find(x=>x.id===ProductView.selectedId)||list[0];
  html='<div class="quick" style="margin-bottom:12px"><button class="btn" onclick="ProductIntake.open()">'+(AI_INTAKE_VISIBLE?'✦ AI / 识别登记':'✦ 识别登记')+'</button><span class="t-sub">'+(AI_INTAKE_VISIBLE?'粘贴资料或识别截图，核对后保存':'粘贴厂家资料或聊天文字，自动提取参数后核对保存')+'</span></div>'+html;
  if(p&&p.specs){const content=SBProductSpecs.summary(p.specs);html=html.replace('<nav class="product-tabs">',`<div class="product-section" style="padding:14px"><b>${esc(SBProductSpecs.types[p.specs.type]||'产品参数')}</b><p class="d4-text">${esc(content||'尚未填写结构参数')}</p><p>${esc([p.specs.finish,p.specs.color,p.specs.accessories].filter(Boolean).join(' · '))}</p></div><nav class="product-tabs">`);}
  if(p){html=html.replace('参考单价</span><b>'+money(p.price),'参考售价</span><b>'+esc(Prod.priceSummary(p)));html=html.replace('计价币种</span><b>USD','计价币种</span><b>'+esc(p.pricing&&p.pricing.currency||'USD'));}
  return html;
};
