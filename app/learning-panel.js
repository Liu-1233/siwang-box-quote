/* D5 · course navigation and explicit learning-record transfer. */
const DesktopLearning={
 home(){UI.go('english');},
 notice(message){UI.toast(message);},
 get(key){return Store.learningGet(key);},
 set(key,value){if(!Store.learningSet(key,value))throw Error(Store.saveError()||'写入失败或数据只读');}
};
window.DesktopLearning=DesktopLearning;
const Learning={
 page:'spell.html',
 open(page,course){
  if(!['spell.html','spell-sentence.html','learn.html','favs.html','wordbook.html'].includes(page))return;
  if(course && !Object.hasOwn(window.SW_COURSES.list,course))return;
  Learning.page=page+(course?'?c='+encodeURIComponent(course):'');UI.go('learningPractice');
 },
 async export(){
  try{const records=Store.learningRecords();const r=await window.SBW.exportToFile(JSON.stringify({app:'siwang-desktop-learning',version:1,records},null,2),'siwang-desktop-learning.json');
   UI.toast(r.ok?'学习备份已保存：'+r.filePath:r.canceled?'已取消备份':'备份未保存：'+r.error);
  }catch(e){UI.toast('备份失败：'+e.message);}
 },
 async import(input){
  const file=input.files[0];if(!file)return;
  try{if(file.size>2200000)throw Error('文件过大');const data=JSON.parse(await file.text());
   let records;
   if(data.app==='siwang-learning'&&data.version===1){records=Object.assign({},Store.learningRecords(),{'siwang-english-v1':JSON.stringify(data.data)});}
   else if(data.app==='siwang-desktop-learning'&&data.version===1)records=data.records;
   else throw Error('请选择丝网英语学习备份');
   const valid=MODEL.validateLearningRecords(records);if(!valid.ok)throw Error(valid.errors.join('；'));
   UI.confirm('导入学习记录','会替换桌面端对应学习记录，建议先导出备份。网站备份只替换课程进度/收藏/打卡，保留桌面错词记录。',()=>{
    if(Store.replaceLearningRecords(records)){UI.toast('学习记录已导入');UI.render();}else UI.toast('导入失败，原记录保留');
   });
  }catch(e){UI.toast('导入失败：'+e.message);}finally{input.value='';}
 },
 importLegacy(){
  const f=document.getElementById('learningFrame');
  try{if(!f||!f.contentWindow.nativeLearningRecords){UI.toast('请先打开任意练习页，再导入旧桌面记录');return;}
   const records=f.contentWindow.nativeLearningRecords();if(!Object.keys(records).length){UI.toast('未找到此桌面来源的旧练习记录；网站记录请用文件导入');return;}
   const valid=MODEL.validateLearningRecords(records);if(!valid.ok)throw Error(valid.errors.join('；'));
   UI.confirm('导入旧桌面练习记录','导入会替换本机JSON中对应学习记录；原localStorage保留，不会删除。',()=>{if(Store.replaceLearningRecords(Object.assign({},Store.learningRecords(),records))){UI.toast('旧记录已导入，原记录仍保留');UI.render();}else UI.toast('导入失败，原记录保留');});
  }catch(e){UI.toast('旧记录未导入：'+e.message);}
 }
};
const englishReference=Pages.english;
Pages.englishReference=function(){return '<div class="toolbar"><button class="btn ghost" onclick="UI.go(\'english\')">← 学习中心</button></div>'+englishReference().replace(/<h3[^>]*>课程（6 门）<\/h3>[\s\S]*?(?=<div class="card" style="margin-top:14px">)/,'');};
Pages.english=function(){
 const C=window.SW_COURSES;let data={progress:{},favs:{},checkins:{}};
 const value=Store.learningGet('siwang-english-v1');if(value)data=JSON.parse(value);
 const count=map=>Object.values(map).reduce((sum,x)=>sum+Object.values(x).filter(Boolean).length,0);
 const spelling=JSON.parse(Store.learningGet('sw-spell-mastered')||'[]').length;
 const customWords=JSON.parse(Store.learningGet('sw-custom-words-v1')||'[]').length;
 const days=new Set(Store.checkins().concat(Object.keys(data.checkins).filter(k=>data.checkins[k]))).size;
 return `<div class="mesh-hero"><div><div class="mesh-caption">WIRE MESH · DAILY PRACTICE</div><h2>把丝网英语，练成顺手的表达。</h2><p>规格单词 · 业务句子 · 客户沟通，每天练一小段。</p></div><button class="btn" onclick="Learning.open('spell.html')">开始拼写练习 →</button></div>
  <div class="learn-stats"><span><b>${count(data.progress)}</b>课程掌握</span><span><b>${spelling}</b>拼写掌握</span><span><b>${count(data.favs)}</b>收藏</span><span><b>${days}</b>学习天数</span></div>
  <div class="learn-grid"><button class="learn-course" onclick="Learning.open('wordbook.html')"><span class="learn-tag">MY WORDS / 我的词库</span><h3>自己添加单词</h3><p>遇到新词随手保存，立即进入单词课程和拼写练习。</p><small>${customWords} 个自定义词 · 管理词库 →</small></button><button class="learn-course" onclick="Learning.open('spell.html')"><span class="learn-tag">SPELLING / 单词</span><h3>丝网单词拼写</h3><p>看中文，直接输入英文；Enter提交，错词可重练。</p><small>键盘输入 →</small></button>
  <button class="learn-course" onclick="Learning.open('spell-sentence.html')"><span class="learn-tag">SENTENCES / 句子</span><h3>业务句子输入流</h3><p>空格推进单词，Enter提交；数字与符号自动跳过。</p><small>选择句子课程 →</small></button>
  <button class="learn-course" onclick="UI.go('englishReference')"><span class="learn-tag">REFERENCE / 速查</span><h3>丝网术语与常用句</h3><p>目数、丝径、材质和业务表达，做单时随手查。</p><small>打开速查 →</small></button>
  ${C.order.map(id=>{const c=C.list[id],n=c.units.reduce((sum,u)=>sum+u.items.length,0);return `<button class="learn-course" onclick="Learning.open('learn.html','${jid(id)}')"><span class="learn-tag">${esc(c.tag||'课程')}</span><h3>${esc(c.title)}</h3><p>${esc(c.desc||'')}</p><small>${n}条内容 · 进入课程 →</small></button>`;}).join('')}</div>
  <div class="card" style="margin-top:20px"><div class="card-h">我的学习记录</div><p class="learn-note">课程进度、自定义单词和错词记录保存在本机JSON中，新增单词会立即同步到本机课程与拼写练习，并随完整备份和学习记录备份保存。网站与其他电脑目前不会自动联网同步；可用备份文件迁移。</p><div class="quick"><button class="btn ghost" onclick="Learning.open('wordbook.html')">我的单词库</button><button class="btn ghost" onclick="Learning.open('favs.html')">我的收藏</button><button class="btn ghost" onclick="Learning.export()">备份学习记录</button><label class="btn ghost" for="learningImport">导入学习备份</label><input hidden type="file" accept=".json,application/json" id="learningImport" onchange="Learning.import(this)"></div></div>`;
};
Pages.learningPractice=function(){return `<div class="toolbar"><button class="btn ghost" onclick="UI.go('english')">← 学习中心</button><div class="grow"></div><button class="btn ghost" onclick="Learning.importLegacy()">导入旧桌面练习记录</button></div><iframe class="learning-frame" id="learningFrame" title="丝网英语练习" src="learning/${Learning.page}"></iframe>`;};
const dashboardD4=Pages.dashboard;
Pages.dashboard=function(){return `<div class="mesh-hero"><div><div class="mesh-caption">SIWANG BOX / WORKSPACE</div><h2>丝网业务，今天从这里开始。</h2><p>记客户、管规格、开单据，把每一步都留在手边。</p></div><button class="btn" onclick="Doc.openEditor(null,'QT')">＋ 新建报价单</button></div>`+dashboardD4();};
