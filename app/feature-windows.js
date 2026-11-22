const FeatureWindows={
  busy:false,
  /* 卡密是独立页面，不在设置里当配置项。 */
  async account(){
    UI.go('license');
    setTimeout(()=>{FeatureWindows.licenseStatus();if(FeatureWindows.isOwner)FeatureWindows.aiStatus();},0);
  },
  /* 维护码入口：连点侧边栏版本号 5 次打开。客户不知道也不会误触。 */
  async ownerPrompt(){
    UI.openModal('维护模式',`<p class="t-sub">维护模式只在本机打开 AI 模型与密钥配置，标记不会打进安装包。关闭后客户仍然只能看到卡密。</p>
      <div class="form-row"><label>维护码</label><input class="inp" id="own_code" type="password" autocomplete="off" placeholder="输入维护码"></div>
      <div class="t-sub" id="own_state"></div>`,[
      {text:'取消',cls:'ghost',fn:'UI.closeModal()'},
      {text:'启用',fn:'FeatureWindows.ownerOn()'}],true);
  },
  async ownerOn(){
    const code=document.getElementById('own_code'),state=document.getElementById('own_state');if(!code)return;
    try{const r=await SBW.ownerEnable(code.value.trim());if(!r.ok)throw Error(r.error);UI.closeModal(true);UI.toast('已开启本机维护模式');this.account();}
    catch(e){if(state)state.textContent='未开启：'+e.message;}
  },
  async ownerOff(){
    try{const r=await SBW.ownerDisable();if(!r||!r.ok)throw Error((r&&r.error)||'关闭失败');UI.closeModal(true);UI.toast('已关闭维护模式，AI 配置入口已隐藏');}
    catch(e){UI.toast(e.message);}
  },
  async copyDevice(){
    const el=document.getElementById('lic_device');if(!el)return;
    const text=(el.textContent||'').trim();
    if(!text||text==='读取中…'){UI.toast('设备码还在读取，稍后再试');return;}
    try{await navigator.clipboard.writeText(text);UI.toast('设备码已复制');}
    catch(e){el.select&&el.select();UI.toast('已选中设备码，按 Ctrl+C 复制');}
  },
  async ai(){return this.account();},
  async license(){return this.account();},
  async aiStatus(){
    const status=document.getElementById('aiw_status');if(!status)return;
    try{const result=await SBW.productAIStatus();if(!status.isConnected)return;
      const auth=result.authorized?'卡密授权有效':(result.error||'需要卡密激活 AI');
      const cfg=result.configured?'本机已保存密钥（留空保留）':'尚未保存 API Key';
      status.textContent='授权：'+auth+'；密钥：'+cfg;
      if(UI.modalGuard)UI.modalBaseline=UI.modalGuard();
    }catch(e){if(status.isConnected)status.textContent='AI 通道未就绪，请安装最新版本';}
  },
  async saveAI(test){
    if(this.busy)return;const v=id=>(document.getElementById(id)||{}).value||'';
    const status=document.getElementById('aiw_status');if(!status)return;    const keyInput=document.getElementById('aiw_key');
    const enabled=!!document.getElementById('aiw_enabled').checked;
    const ai={provider:v('aiw_provider'),baseUrl:v('aiw_base').trim(),model:v('aiw_model').trim(),enabled,privacyMode:'confirm'};
    if(ai.baseUrl){try{const url=new URL(ai.baseUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch(e){status.textContent='请填写有效的 HTTPS API 地址';return;}}
    if(ai.provider!=='deepseek'&&(!ai.baseUrl||!ai.model)){status.textContent='兼容服务请填写 API 地址和模型名称';return;}
    if(test&&!enabled){status.textContent='请先勾选“启用 AI 识别”再测试';return;}
    this.busy=true;status.textContent='正在保存…';
    try{
      if(keyInput.value.trim()){const saved=await SBW.productAIKeySave(keyInput.value);if(!saved.ok)throw Error(saved.error);keyInput.value='';}
      if(!Store.saveSettings({ai}))throw Error('配置没有保存，请检查数据状态');
      if(UI.current==='settings')UI.render();
      if(UI.modalGuard)UI.modalBaseline=UI.modalGuard();
      if(test){status.textContent='正在连接 AI 服务…';const result=await SBW.productAIExtract({text:'产品名称：AI连接测试样本。无尺寸，无价格。请返回产品对象。',confirmed:true});if(!result.ok)throw Error(result.error);if(status.isConnected)status.textContent='✓ 连接成功，模型返回格式正常。现在可以到产品资料使用“AI / 识别登记”。';}
      else if(status.isConnected){const auth=await SBW.productAIStatus();status.textContent='✓ 配置已保存。'+(!enabled?'AI 当前关闭':auth.authorized?'卡密有效，可以使用 AI':(auth.error||'需要卡密激活 AI'));}
    }catch(e){if(status.isConnected)status.textContent='未完成：'+e.message;}finally{this.busy=false;}
  },
  async licenseStatus(){
    const state=document.getElementById('lic_state'),device=document.getElementById('lic_device'),detail=document.getElementById('lic_detail');if(!state)return;
    try{const result=await SBW.licenseStatus();if(!state.isConnected)return;if(!result.ok)throw Error(result.error);if(device)device.textContent=result.deviceId||'读取失败';
      state.textContent=result.active?'✓ 已激活 · '+result.license.plan:'尚未激活';
      detail.textContent=result.active?'有效期：'+(result.license.expiresAt?new Date(result.license.expiresAt).toLocaleDateString('zh-CN'):'长期')+'；AI 权限：'+(result.license.features.includes('ai_product_intake')?'已开通':'未开通'):(result.error||(!result.configured?'发布方尚未配置卡密验证公钥，当前窗口可查看设备码和输入卡密；正式激活需完成发布方授权配置。':'填写卡密后点击验证并激活。'));
      if(UI.modalGuard)UI.modalBaseline=UI.modalGuard();
    }catch(e){if(state.isConnected)state.textContent='授权状态读取失败：'+e.message;}
  },
  async activate(){
    if(this.busy)return;const code=document.getElementById('lic_code'),feedback=document.getElementById('lic_feedback');if(!code||!code.value.trim()){UI.toast('请粘贴卡密');return;}
    this.busy=true;feedback.textContent='正在验证…';
    try{const result=await SBW.licenseActivate(code.value.trim());if(!feedback.isConnected)return;if(!result.ok)throw Error(result.error);feedback.textContent='✓ 激活成功';code.value='';await this.licenseStatus();this.aiStatus();}
    catch(e){if(feedback.isConnected)feedback.textContent='未激活：'+e.message;}finally{this.busy=false;}
  }
};
/* ===== 卡密页：独立入口，参考贸商盒子（左激活 / 右购买） ===== */
const LICENSE_CSS=`<style>
.lic-page{max-width:1180px}
.lic-head{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.lic-head h1{font-size:24px;margin:0;color:#14304a}
.lic-head p{margin:0;color:#5d7183;font-size:13px}
.lic-wrap{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.lic-main{flex:1 1 620px;min-width:340px;background:#fff;border:1px solid #dfe7ee;border-radius:12px;padding:22px 24px}
.lic-sec{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid #e8eef4}
.lic-no{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:#eef4fa;color:#3f7fbf;font-weight:700;font-size:13px}
.lic-sec h2{margin:0;font-size:18px;color:#14304a}
.lic-lead{color:#3f5566;font-size:13.5px;line-height:1.95;margin:14px 0}
.lic-note{background:#f1f5f9;border-radius:8px;padding:12px 14px;color:#54697a;font-size:13px;line-height:1.9;margin-bottom:16px}
.lic-plans{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.lic-plan{flex:1 1 170px;min-width:150px;border:1px solid #dfe7ee;border-radius:10px;padding:12px 14px;cursor:pointer;background:#fff;transition:.15s}
.lic-plan:hover{border-color:#9dc3e6}
.lic-plan.active{border-color:#4c8fd6;background:#eff5fc;box-shadow:0 0 0 1px #4c8fd6 inset}
.lic-plan-top{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;color:#6b8091}
.lic-plan-top s{color:#a9b7c2;font-size:11px}
.lic-plan-price{font-size:30px;font-weight:800;color:#a8792a;line-height:1.25;margin-top:2px}
.lic-plan-price.text{font-size:19px;font-weight:700;color:#8d9aa5;letter-spacing:1px;line-height:1.9}
.lic-plan-price small{font-size:13px;font-weight:700;margin-left:2px}
.lic-plan-tag{font-size:11px;color:#8a9aa8;margin-top:2px}
.lic-act{border-top:1px solid #e8eef4;padding-top:16px}
.lic-act>label{display:block;font-size:12px;color:#5d7183;margin-bottom:8px}
.lic-act-row{display:flex;gap:10px;flex-wrap:wrap}
.lic-act-row input{flex:1 1 320px;border:1px solid #cddce6;border-radius:8px;padding:11px 13px;font:inherit;font-size:13.5px;letter-spacing:.4px;color:#14304a;background:#fbfdfe}
.lic-act-row input:focus{outline:none;border-color:#4c8fd6;background:#fff}
.lic-tip{font-size:12px;color:#8a9aa8;line-height:1.9;margin-top:10px}
.lic-meta{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:12px;font-size:13px}
.lic-meta b{color:#14304a}
.lic-dev{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;color:#7b8f9e;flex-wrap:wrap}
.lic-dev code{background:#f4f8fa;border:1px solid #e3ebf2;border-radius:6px;padding:4px 8px;font-size:12px;color:#3f5566}
.lic-copy{border:1px solid #cddce6;background:#fff;border-radius:6px;padding:3px 10px;font-size:11px;color:#177d9c;cursor:pointer;font-weight:700}
.lic-detail{font-size:12px;color:#7b8f9e;margin-top:8px;line-height:1.8}
.lic-side{flex:0 0 250px;background:#fff;border:1px solid #dfe7ee;border-radius:12px;padding:20px;text-align:center}
.lic-wx{font-size:12px;color:#6b8091;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #eef3f7}
.lic-wx b{color:#14304a;font-size:13px}
.lic-side h3{margin:0 0 4px;font-size:16px;color:#14304a}
.lic-side p{margin:0;font-size:12px;color:#7b8f9e;line-height:1.8}
.lic-qr{margin:12px auto 0;width:170px;height:170px;border:1px solid #e3ebf2;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#a9b7c2;font-size:11.5px;text-align:center;padding:8px;box-sizing:border-box}
.lic-qr img{max-width:100%;max-height:100%;border-radius:4px}
.lic-qr.small{width:132px;height:132px;margin-top:10px}
.lic-tip-line{margin-top:20px;padding-top:16px;border-top:1px solid #eef3f7;font-size:12px;color:#6b8091}
.lic-pay{font-size:11px;color:#a9b7c2;margin-top:6px}
.lic-owner{margin-top:18px;padding-top:16px;border-top:1px solid #e8eef4}
.lic-owner h3{margin:0 0 8px;font-size:14px;color:#14304a}
.lic-owner label{display:block;font-size:12px;color:#5d7183;margin:10px 0 5px}
.lic-owner input,.lic-owner select{width:100%;box-sizing:border-box;border:1px solid #cddce6;border-radius:8px;padding:9px 11px;font:inherit;font-size:13px;background:#fbfdfe}
.lic-owner .lic-foot{display:flex;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap}
</style>`;
/* 价格档位：等你填真实价格后，这里就是客户看到的三档。留空显示「待定」，不编价格。 */
const LICENSE_PLANS=[
  {name:'1 年卡密',price:'待定',origin:'',tag:'首批用户限时价'},
  {name:'2 年卡密',price:'待定',origin:'',tag:'首批用户限时价'},
  {name:'永久卡密',price:'待定',origin:'',tag:'首批用户限时价'}
];
const LICENSE_CONTACT={wechat:'待填写',buyQr:'',tipQr:''};
FeatureWindows.choosePlan=function(index){
  document.querySelectorAll('.lic-plan').forEach((el,i)=>el.classList.toggle('active',i===index));
};
Pages.license=function(){
  const owner=!!FeatureWindows.isOwner;
  const config=Store.settings().ai||{};
  const plans=LICENSE_PLANS.map((p,i)=>`<div class="lic-plan${i===1?' active':''}" onclick="FeatureWindows.choosePlan(${i})">
      <div class="lic-plan-top"><span>${esc(p.name)}</span>${p.origin?'<s>'+esc(p.origin)+'</s>':''}</div>
      <div class="lic-plan-price${/^\d/.test(p.price)?'':' text'}">${esc(p.price)}${/^\d/.test(p.price)?'<small>元</small>':''}</div>
      <div class="lic-plan-tag">${esc(p.tag)}</div>
    </div>`).join('');
  const aiBlock=owner?`<section class="lic-owner">
      <h3>AI 服务（仅本机维护模式可见）</h3>
      <div class="lic-note" style="margin:0 0 6px">这段只在打了维护标记的机器上出现；客户安装后看不到，也没有模型和密钥字段。</div>
      <label>服务商</label><select id="aiw_provider"><option value="deepseek"${config.provider==='deepseek'?' selected':''}>DeepSeek（仅文字）</option><option value="openai-compatible"${config.provider==='openai-compatible'?' selected':''}>OpenAI 兼容接口 / 多模态模型</option><option value="custom"${config.provider==='custom'?' selected':''}>其他兼容服务</option></select>
      <label>API 基础地址</label><input id="aiw_base" value="${esc(config.baseUrl||'')}" placeholder="例如 https://api.deepseek.com">
      <label>模型名称</label><input id="aiw_model" value="${esc(config.model||'')}" placeholder="如 deepseek-chat；图片请填视觉模型名称">
      <label>API Key</label><input id="aiw_key" type="password" autocomplete="off" placeholder="填写新密钥；留空保留已保存密钥">
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input id="aiw_enabled" type="checkbox" style="width:auto"${config.enabled?' checked':''}> 启用 AI 识别</label>
      <div class="lic-detail" id="aiw_status">正在读取本机配置状态…</div>
      <div class="lic-foot"><span class="lic-tip">密钥加密保存在本机，不上传。</span><span><button class="btn ghost" onclick="FeatureWindows.ownerOff()">关闭维护模式</button> <button class="btn" onclick="FeatureWindows.saveAI(false)">保存配置</button> <button class="btn ghost" onclick="FeatureWindows.saveAI(true)">保存并测试</button></span></div>
    </section>`:'';
  return LICENSE_CSS+`<div class="lic-page">
    <div class="lic-head"><h1>丝网盒子 AI 卡密</h1><p>输入卡密即可解锁丝网盒子的 AI 产品识别、参数提取与产品入库草稿。</p></div>
    <div class="lic-wrap"><section class="lic-main">
      <div class="lic-sec"><span class="lic-no">01</span><h2>丝网盒子 AI 功能卡密</h2></div>
      <p class="lic-lead">解锁产品资料里的 AI 识别：粘贴规格文字或选一张产品图，自动提取品名、材质、丝径、孔径、尺寸与安装方式，确认后才写入产品库。</p>
      <div class="lic-note">丝网盒子的客户、产品、报价、单据、装柜和学习功能免费使用，不开通 AI 也能正常用。<br>AI 识别会产生实际调用费用，因此不长期免费开放。</div>
      <div class="lic-plans">${plans}</div>
      <div class="lic-act">
        <label>卡密授权</label>
        <div class="lic-act-row"><input id="lic_code" maxlength="12000" placeholder="SWB1-XXXXXX-XXXXXX-XXXXXX"><button class="btn" onclick="FeatureWindows.activate()">激活 AI 卡密</button></div>
        <div class="lic-tip">不开通 AI 也不影响软件正常使用。一张卡密首次激活后绑定当前电脑，仅限本机使用。</div>
        <div class="lic-meta"><span id="lic_state">正在读取授权状态…</span><span id="lic_feedback"></span></div>
        <div class="lic-dev"><span>本机设备码</span><code id="lic_device">读取中…</code><button class="lic-copy" onclick="FeatureWindows.copyDevice()">复制</button></div>
        <div class="lic-detail" id="lic_detail"></div>
      </div>
      ${aiBlock}
    </section>
    <aside class="lic-side">
      <div class="lic-wx">微信号 <b>${esc(LICENSE_CONTACT.wechat)}</b></div>
      <h3>开通 AI 卡密</h3>
      <p>扫码添加微信，购买卡密</p>
      <div class="lic-qr">${LICENSE_CONTACT.buyQr?'<img src="'+esc(LICENSE_CONTACT.buyQr)+'" alt="购买二维码">':'二维码待放入'}</div>
      <div class="lic-tip-line">觉得好用，支持一下</div>
      <div class="lic-qr small">${LICENSE_CONTACT.tipQr?'<img src="'+esc(LICENSE_CONTACT.tipQr)+'" alt="打赏二维码">':'打赏二维码'}</div>
      <div class="lic-pay">微信支付 · 1 分也是爱</div>
    </aside></div>
  </div>`;
};
/* 进入卡密页时：先确认本机是不是维护模式，再刷状态 */
FeatureWindows.mount=async function(){
  let owner=false;try{const r=await SBW.ownerStatus();owner=!!(r&&r.owner);}catch(e){}
  if(owner!==!!FeatureWindows.isOwner){FeatureWindows.isOwner=owner;UI.render();}
  this.licenseStatus();
  if(owner)this.aiStatus();
};
/* app.js（UI 定义处）在本文件之后加载，脚本执行阶段取不到 UI；
   DOMContentLoaded 一定在所有普通脚本跑完之后触发，在这里挂路由最稳。 */
function hookLicenseRoute(){
  if(typeof UI==='undefined'||!UI||!UI.titles)return false;
  UI.titles.license='AI 卡密';
  if(UI.go&&!UI.go.__licenseHooked){
    const goBeforeLicense=UI.go;
    UI.go=function(page){goBeforeLicense.call(UI,page);if(UI.current==='license')FeatureWindows.mount();};
    UI.go.__licenseHooked=true;
  }
  if(UI.current==='license')FeatureWindows.mount();
  return true;
}
if(document.readyState==='complete'||document.readyState==='interactive'){
  hookLicenseRoute();
}else{
  document.addEventListener('DOMContentLoaded',hookLicenseRoute);
  window.addEventListener('load',hookLicenseRoute);
}

const settingsBeforeFeatureWindows=Pages.settings;
Pages.settings=function(){return `<div class="card" style="margin-bottom:14px"><div class="card-h">卡密与授权</div><p class="t-sub">查看本机设备码、输入卡密、验证授权和查看有效期。AI 识别属于付费功能，卡密与 AI 合并为独立页面管理；客户端不开放模型与密钥设置。</p><button class="btn" onclick="UI.go('license')">打开 AI 卡密</button></div>`+settingsBeforeFeatureWindows();};
const productsBeforeFeatureWindows=Pages.products;
Pages.products=function(){return `<div class="quick" style="margin-bottom:10px"><button class="btn ghost" onclick="UI.go('license')">AI 卡密 / 授权</button></div>`+productsBeforeFeatureWindows();};

/* 维护入口：连点侧边栏版本号 5 次（1.2 秒内）打开维护码输入。 */
let ownerClicks=0,ownerTimer=null;
document.addEventListener('click',event=>{
  const el=event.target&&event.target.closest?event.target.closest('#app-ver'):null;
  if(!el)return;
  ownerClicks++;clearTimeout(ownerTimer);
  ownerTimer=setTimeout(()=>{ownerClicks=0;},1200);
  if(ownerClicks>=5){ownerClicks=0;FeatureWindows.ownerPrompt();}
});
