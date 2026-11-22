/* D5: this trusted local frame uses the parent's transactional JSON storage. */
(function(){
 'use strict';
 const allowed=['siwang-english-v1','sw-spell-mastered','sw-spell-wrong','sw-custom-words-v1'];
 const native=window.localStorage;
 window.nativeLearningRecords=function(){const out={};allowed.forEach(k=>{const v=native.getItem(k);if(v!==null)out[k]=v;});return out;};
 function fail(error){
  let el=document.getElementById('desktop-learning-status');
  if(!el){el=document.createElement('div');el.id='desktop-learning-status';el.setAttribute('role','alert');el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#fff0e8;color:#a53b21;padding:12px;font:13px sans-serif';document.body.appendChild(el);}
  el.textContent='学习记录未保存：'+error.message+'。请检查桌面数据状态，先不要关闭此页。';
  try{parent.DesktopLearning.notice('学习记录未保存：'+error.message);}catch(_){}
 }
 const storage={getItem(k){if(!allowed.includes(k))return null;try{return parent.DesktopLearning.get(k);}catch(e){fail(e);throw e;}},
  setItem(k,v){if(!allowed.includes(k))throw Error('不支持的学习记录');try{parent.DesktopLearning.set(k,String(v));}catch(e){fail(e);throw e;}},
  removeItem(k){try{parent.DesktopLearning.set(k,null);}catch(e){fail(e);throw e;}}};
 Object.defineProperty(window,'localStorage',{value:storage,configurable:false});
 document.addEventListener('click',e=>{
  const a=e.target.closest('a');if(!a)return;
  const url=new URL(a.href,location.href);
  const name=url.pathname.split('/').pop();
  if(name==='index.html'){e.preventDefault();parent.DesktopLearning.home();return;}
  if(!['learn.html','favs.html','spell.html','spell-sentence.html','wordbook.html'].includes(name)){e.preventDefault();parent.DesktopLearning.notice('请从左侧菜单进入其他工具');}
 });
 window.addEventListener('unhandledrejection',e=>fail(e.reason instanceof Error?e.reason:Error(String(e.reason))));
 // Missing voices are visible and never block keyboard practice.
 function voiceNote(){if(!('speechSynthesis' in window)||!speechSynthesis.getVoices().some(v=>/^en/i.test(v.lang))){
  let n=document.getElementById('voice-note');if(!n){n=document.createElement('p');n.id='voice-note';n.className='desktop-voice-note';n.textContent='未检测到英语朗读音色，仍可正常练习；可在系统语音设置安装英语音色后重试。';document.body.appendChild(n);}
 }}
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b || !(['spSpeak','ss2Speak'].includes(b.id)||b.classList.contains('btn-speak')))return;
  if(!window.speechSynthesis || !speechSynthesis.getVoices().some(v=>/^en/i.test(v.lang)))parent.DesktopLearning.notice('未检测到英语朗读音色，可继续练习；请在系统语音设置安装英语音色');
 },true);
 setTimeout(voiceNote,1200);
})();
