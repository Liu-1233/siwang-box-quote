/* 丝网盒子桌面版 · 主控（路由 / 弹窗 / 时钟） */
const UI = {
  current: 'dashboard',

  titles: {
    dashboard: '工作台', customerDetail:'客户详情', customers: '客户管理', products: '产品资料',
    docs: '单据中心', quoteEdit: '编辑报价单', tools: '计算工具', meshCalculators: '行业计算器', gratingCalculator: '钢格板计算器', rollCalculator: '电焊网卷计算器', wovenCalculator: '平纹编织网计算器', chainCalculator: '勾花网计算器', wireCalculator: '金属丝计算器', marketData: '行情参考', directory: '厂家与货站', industryTools: '行业工具', loadPlanner: '装柜预排', standards: '标准速查',
    english: '学习中心', learningPractice:'丝网英语练习', englishReference:'术语与句子速查', settings: '设置'
  },

  go(page) {
    if(UI.modalGuard && !UI.closeModal())return;
    if (!Pages[page]) page = 'dashboard';
    /* 报价编辑器有未保存改动时，切页面必须先问（保存 / 放弃 / 继续编辑） */
    if (page !== UI.current && UI.current === 'quoteEdit' && typeof QuoteEdit !== 'undefined'
        && QuoteEdit.draft && !Doc.allowLeave(page)) return;
    if (UI.current === 'loadPlanner' && page !== 'loadPlanner' && window.LoadPlanner3D) window.LoadPlanner3D.dispose();
    UI.current = page;
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.page === (['learningPractice','englishReference'].includes(page)?'english':page==='customerDetail'?'customers':page));
    });
    const t = document.getElementById('pageTitle');
    if (t) t.textContent = UI.titles[page] || page;
    /* 编辑器标题跟单据类型走（B2 五类共用一页，不能再一律写「编辑报价单」） */
    if (page === 'quoteEdit' && t && typeof QuoteEdit !== 'undefined' && QuoteEdit.draft && typeof Doc !== 'undefined') {
      t.textContent = (QuoteEdit.id ? '编辑' : '新建') + (Doc.TYPE_CN[QuoteEdit.draft.type] || '单据');
    }
    UI.render();
  },

  render() {
    const box = document.getElementById('content');
    if (!box) return;
    // 页面本身出错时不要让整个界面变白屏
    let html;
    try {
      html = Pages[UI.current]();
    } catch (err) {
      html = `<div class="card"><div class="card-h" style="color:#b42318">这一页出错了</div>
        <div class="t-sub">${esc(err && err.message ? err.message : String(err))}</div>
        <div class="t-sub" style="margin-top:8px">其他页面的数据没有受影响，可以切换到别的页面继续用。</div></div>`;
      console.error(err);
    }
    box.innerHTML = UI.blockHTML() + UI.noticeHTML() + html;
    box.scrollTop = 0;
    if (UI.current === 'tools') setTimeout(() => { Tools.calc(); Tools.reverse(); Tools.container(); Tools.quote(); }, 0);
    /* 报价编辑器：双栏 / 窄窗口单栏切换，渲染后量一次宽度 */
    if (UI.current === 'quoteEdit' && typeof Doc !== 'undefined') setTimeout(() => Doc.layout(), 0);
    if (UI.current === 'loadPlanner' && typeof LoadPlanner !== 'undefined' && LoadPlanner.result) {
      setTimeout(() => { if (window.LoadPlanner3D) window.LoadPlanner3D.mount(LoadPlanner.result); }, 0);
    }
  },

  /* 只读态（数据损坏 / 版本不支持 / 桥不通）必须在每个页面最上面说清楚，
     否则用户会以为改动保存成功了。 */
  blockHTML() {
    let b = false, why = '';
    try { b = Store.blocked(); why = Store.blockReason() || ''; } catch (e) { b = false; }
    if (!b) return '';
    return `<div class="notice-bar"><div class="notice-item n-error">
      <b>数据只读：这次不会写入任何文件，请不要在这里录入重要数据。</b>
      <div style="margin-top:6px;font-size:12.5px;line-height:1.7">${esc(why)}</div>
    </div></div>`;
  },

  /* 保存失败、数据从备份恢复等情况必须让用户看到，不能悄悄过去 */
  noticeHTML() {
    let ns = [];
    try { ns = Store.notices() || []; } catch (e) { ns = []; }
    if (!ns.length) return '';
    return `<div class="notice-bar">${ns.map((n, i) => `
      <div class="notice-item n-${esc(n.level || 'info')}">
        <b>${esc(n.message)}</b>
        <button class="notice-close" title="知道了" onclick="UI.dismissNotice(${i})">✕</button>
      </div>`).join('')}</div>`;
  },

  dismissNotice(i) {
    Store.dismissNotice(i);
    UI.render();
  },

  openModal(title, body, buttons, wide) {
    if(UI.modalGuard && !UI.closeModal())return false;
    const m = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    // 按钮的动作历史上两种写法都出现过（onclick / fn），这里统一兼容，
    // 否则会渲染成 onclick="undefined"，点了毫无反应。
    document.getElementById('modalFoot').innerHTML = (buttons || []).map(b =>
      `<button class="btn ${b.cls || ''}" onclick="${b.onclick || b.fn || 'UI.closeModal()'}">${b.text}</button>`).join('');
    const box = m.querySelector('.modal-box');
    if (box) box.classList.toggle('wide', !!wide);
    m.classList.add('show');
    const first = m.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
  },

  guardModal() {
    const body=document.getElementById('modalBody');
    UI.modalGuard=()=>JSON.stringify(Array.from(body.querySelectorAll('input,textarea,select')).map(el=>[el.id,el.value]));
    UI.modalBaseline=UI.modalGuard();
  },
  closeModal(force) {
    if(force!==true && UI.modalGuard && UI.modalGuard()!==UI.modalBaseline && !window.confirm('内容尚未保存，确定放弃这次编辑吗？'))return false;
    UI.modalGuard=null;
    document.getElementById('modal').classList.remove('show');return true;
  },

  confirm(title, msg, cb) {
    window.__confirmCb = cb;
    UI.openModal(title,
      `<div style="font-size:14px;line-height:1.9;color:var(--ink)">${msg}</div>`,
      [
        { text: '取消', cls: 'ghost', onclick: 'UI.closeModal()' },
        { text: '确定', cls: 'danger', onclick: 'UI.runConfirm()' }
      ]);
  },

  runConfirm() {
    const cb = window.__confirmCb;
    window.__confirmCb = null;
    UI.closeModal(true);
    if (typeof cb === 'function') cb();
  },

  toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:36px;background:rgba(18,36,31,.92);color:#fff;padding:10px 20px;border-radius:9px;font-size:13.5px;z-index:99;transition:opacity .25s;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 1600);
  }
};

function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })
    + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function tickWorldClocks() {
  const now = new Date();
  document.querySelectorAll('[data-world-zone]').forEach(node => {
    try { node.textContent = new Intl.DateTimeFormat('zh-CN', {timeZone:node.dataset.worldZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(now); }
    catch (e) { node.textContent = '--:--'; }
  });
}

let topFxBusy = false;
async function loadTopFx(manual) {
  const box = document.getElementById('topFx'); if (!box || topFxBusy) return;
  topFxBusy = true; if (manual) box.innerHTML = '<span>参考汇率</span><b>正在刷新…</b>';
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {cache:'no-store'}); if(!res.ok) throw Error('HTTP '+res.status);
    const rates=(await res.json()).rates||{}; if(!(rates.CNY>0&&rates.EUR>0&&rates.GBP>0))throw Error('汇率数据不完整');
    box.innerHTML='<span>参考汇率</span><b>USD/CNY '+Number(rates.CNY).toFixed(4)+'</b><b>EUR/CNY '+Number(rates.CNY/rates.EUR).toFixed(4)+'</b><b>GBP/CNY '+Number(rates.CNY/rates.GBP).toFixed(4)+'</b>';
    box.title='免费公开接口参考值；最后刷新 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  } catch(e) { box.innerHTML='<span>参考汇率</span><b>暂时无法联网</b>'; box.title='世界时间仍可离线使用；汇率需要联网'; }
  finally { topFxBusy=false; }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', () => UI.go(a.dataset.page));
  });

  const m = document.getElementById('modal');
  if (m) m.addEventListener('click', e => { if (e.target === m) UI.closeModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') UI.closeModal();
  });

  /* 窗口大小变化时重算报价编辑器的双栏/单栏 */
  window.addEventListener('resize', () => {
    if (UI.current === 'quoteEdit' && typeof Doc !== 'undefined') Doc.layout();
  });

  /* 关闭窗口前的未保存确认。
     真实路径：主进程 win.on('close') 拦截 → 发 app:before-close → 这里弹三选一
     → finishClose('discard'|'saved')；保存失败不会关，草稿保留。
     不依赖 beforeunload（那条在 Electron 里拦不住 X 按钮）。 */
  if (window.SBW && window.SBW.onBeforeClose) {
    window.SBW.onBeforeClose(() => {
      if(UI.modalGuard && !UI.closeModal())return;
      if (typeof QuoteEdit === 'undefined' || !QuoteEdit.draft || !QuoteEdit.dirty) {
        try { window.SBW.finishClose('clean'); } catch (e) {}
        return;
      }
      Doc.askLeave('close');
    });
  }

  UI.go('dashboard');
  tickClock();
  tickWorldClocks(); loadTopFx(false);
  setInterval(tickClock, 1000 * 20);
  setInterval(tickWorldClocks, 1000 * 20);
  setInterval(() => loadTopFx(false), 1000 * 60 * 10);

  /* 侧边栏版本号跟 package.json 走，别再硬编码 */
  try {
    if (window.SBW && window.SBW.info) {
      const info = window.SBW.info() || {};
      const el = document.getElementById('app-ver');
      if (el && info.version) el.textContent = '桌面版 v' + info.version;
    }
  } catch (e) {}
});
