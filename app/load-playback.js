/* 回放控件兼容 WebGL 与 SVG，兼容视图也保留播放、暂停和进度条。 */
/* ES module 通过 window 访问宿主；顶层 const 不会自动成为 window 属性。 */
window.LoadPlanner=LoadPlanner;
const LoadReplay={
  fallback:false,count:0,timer:null,
  stop(){if(this.timer){clearInterval(this.timer);this.timer=null;}},
  engine(){return !this.fallback&&window.LoadPlanner3D;},
  total(){return LoadPlanner.result&&LoadPlanner.result.placements.length||0;},
  sync(){
    const total=this.total(),n=this.count;
    const progress=document.getElementById('lp3dProgress'),label=document.getElementById('lp3dProgressText'),button=document.getElementById('lp3dPlayBtn'),badge=document.getElementById('lp3dBadge');
    if(progress){progress.max=String(total);progress.value=String(n);}if(label)label.textContent=n+' / '+total+' 箱';
    if(button){button.disabled=!total;button.textContent=this.timer?'Ⅱ 暂停':'▶ 播放摆放';}if(badge)badge.textContent='兼容视图 · 已摆放 '+n+' / '+total+' 箱';
  },
  paint(){const host=document.getElementById('loadPlanner3d');if(!host||!LoadPlanner.result){this.stop();return;}LoadPlanner.view.revealed=this.count;host.innerHTML=LoadPlanner.legacySvg.call(LoadPlanner);this.sync();},
  togglePlay(){
    const engine=this.engine();if(engine){engine.togglePlay();return;}
    if(this.timer){this.stop();this.sync();return;}
    const total=this.total();if(!total){UI.toast('先生成有货物装入的预排方案');return;}
    if(this.count>=total)this.count=0;this.paint();
    const result=LoadPlanner.result;
    this.timer=setInterval(()=>{if(UI.current!=='loadPlanner'||LoadPlanner.result!==result||!document.getElementById('loadPlanner3d')){this.stop();return;}this.count=Math.min(total,this.count+Math.max(1,Math.ceil(total/120)));if(this.count>=total)this.stop();this.paint();},180);this.sync();
  },
  seek(v){const e=this.engine();if(e){e.seek(v);return;}this.stop();this.count=Math.max(0,Math.min(this.total(),Math.round(Number(v)||0)));this.paint();},
  next(){const e=this.engine();if(e){e.next();return;}this.seek(this.count+1);},
  previous(){const e=this.engine();if(e){e.previous();return;}this.seek(this.count-1);},
  setView(kind){const e=this.engine();if(e){e.setView(kind);return;}LoadPlanner.view.yaw=kind==='door'?1.35:0.55;LoadPlanner.view.pitch=kind==='top'?0.8:0.28;this.paint();}
};
const loadViewBeforeReplay=LoadPlanner.svg;
LoadPlanner.svg=function(){LoadReplay.stop();LoadReplay.fallback=false;return loadViewBeforeReplay.call(this).replace(/LoadPlanner3D\./g,'LoadReplay.');};
LoadPlanner.showLegacy3D=function(reason){
  if(window.LoadPlanner3D)window.LoadPlanner3D.dispose();
  LoadReplay.stop();LoadReplay.fallback=true;LoadReplay.count=this.result?this.result.placements.length:0;LoadReplay.paint();
  const host=document.getElementById('loadPlanner3d');if(host){host.style.height='auto';host.title='兼容模式：'+String(reason||'WebGL 不可用');}
};
const paintBeforeReplay=LoadPlanner.paintVisual;
LoadPlanner.paintVisual=function(){if(LoadReplay.fallback){LoadReplay.paint();return;}paintBeforeReplay.call(this);};
/* 把三维图提到逐箱明细之前，生成后直接定位到播放区。 */
const loadPageBeforeReplay=Pages.loadPlanner;
Pages.loadPlanner=function(){
  let html=loadPageBeforeReplay();
  const view=html.indexOf('<div class="card lp3d-card"');
  const summary=html.indexOf('<div class="card" style="margin-top:14px"><div class="card-h">预排结果');
  if(view>=0&&summary>=0&&view>summary)html=html.slice(0,summary)+html.slice(view)+html.slice(summary,view);
  return html;
};
const runBeforeReplay=LoadPlanner.run;
LoadPlanner.run=function(){runBeforeReplay.call(this);setTimeout(()=>{const el=document.querySelector('.lp3d-card');if(el)el.scrollIntoView({block:'start'});},80);};
document.addEventListener('DOMContentLoaded',()=>{if(!window.LoadPlanner3D){window.LoadPlanner3D={mount:()=>{LoadPlanner.showLegacy3D('三维模块未就绪');return false;},dispose:()=>LoadReplay.stop()};}});
