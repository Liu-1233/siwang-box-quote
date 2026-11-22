(function () {
  'use strict';
  var editingId = '';
  var $ = function (id) { return document.getElementById(id); };
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function fields() { return { en:$('wbEn').value, zh:$('wbZh').value, ph:$('wbPh').value, pos:$('wbPos').value, ex:$('wbEx').value, exZh:$('wbExZh').value, tip:$('wbTip').value }; }
  function setStatus(message, bad) { $('wbStatus').textContent = message || ''; $('wbStatus').className = 'wb-status' + (bad ? ' bad' : ''); }
  function reset() { editingId=''; $('wbForm').reset(); $('wbFormTitle').textContent='添加新单词'; $('wbSave').textContent='保存到单词库'; $('wbCancel').hidden=true; setStatus(''); $('wbEn').focus(); }
  function list() { return window.SWCustomWords.list(); }
  function render() {
    var words=list(), q=$('wbSearch').value.trim().toLowerCase();
    var filtered=words.filter(function(w){return !q || w.en.toLowerCase().includes(q) || w.zh.toLowerCase().includes(q);});
    $('wbCount').textContent=words.length+' / '+window.SWCustomWords.maxWords;
    if(!filtered.length){$('wbItems').innerHTML='<div class="wb-empty">'+(words.length?'没有找到匹配的词。':'还没有自己添加的词。<br>先把今天遇到的新词记下来。')+'</div>';return;}
    $('wbItems').innerHTML=filtered.map(function(w){return '<article class="wb-item" data-id="'+esc(w.id)+'"><div class="wb-line"><span class="wb-en">'+esc(w.en)+'</span>'+(w.ph?'<span class="wb-ph">'+esc(w.ph)+'</span>':'')+(w.pos?'<span class="wb-pos">'+esc(w.pos)+'</span>':'')+'</div><div class="wb-zh">'+esc(w.zh)+'</div>'+(w.ex?'<div class="wb-ex">'+esc(w.ex)+(w.exZh?'<br>'+esc(w.exZh):'')+'</div>':'')+(w.tip?'<div class="wb-ex">备注：'+esc(w.tip)+'</div>':'')+'<div class="wb-item-actions"><button class="wb-mini" data-action="edit">编辑</button><button class="wb-mini danger" data-action="remove">删除</button></div></article>';}).join('');
  }
  $('wbForm').addEventListener('submit',function(e){e.preventDefault();try{window.SWCustomWords.save(fields(),editingId);setStatus(editingId?'单词已更新，并同步到练习。':'已经加入单词库和拼写练习。');editingId='';$('wbForm').reset();$('wbFormTitle').textContent='添加新单词';$('wbSave').textContent='保存到单词库';$('wbCancel').hidden=true;render();}catch(err){setStatus(err.message,true);}});
  $('wbCancel').addEventListener('click',reset); $('wbSearch').addEventListener('input',render);
  $('wbItems').addEventListener('click',function(e){var b=e.target.closest('button'),row=e.target.closest('[data-id]');if(!b||!row)return;var id=row.dataset.id,w=list().find(function(x){return x.id===id;});if(!w)return;if(b.dataset.action==='edit'){editingId=id;['En','Zh','Ph','Pos','Ex','ExZh','Tip'].forEach(function(k){$('wb'+k).value=w[k.charAt(0).toLowerCase()+k.slice(1)]||'';});$('wbFormTitle').textContent='编辑单词';$('wbSave').textContent='保存修改';$('wbCancel').hidden=false;setStatus('');window.scrollTo({top:0,behavior:'smooth'});$('wbEn').focus();}else if(b.dataset.action==='remove'&&confirm('删除“'+w.en+'”？学习进度不会影响其他单词。')){try{window.SWCustomWords.remove(id);if(editingId===id)reset();setStatus('单词已删除。');render();}catch(err){setStatus(err.message,true);}}});
  render();
})();
