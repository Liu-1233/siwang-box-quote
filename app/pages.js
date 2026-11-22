/* 丝网盒子桌面版 · 各模块页面 */

/* 数据模型：model.js 以 UMD 挂到 window.SBModel（主进程则 require 同一文件）。
   注意 store.js 里的 MODEL 是闭包内的，页面这里自己取一份，
   保证「编辑预览 / 列表 / 持久化」用的都是同一份纯函数实现。 */
const MODEL = (typeof window !== 'undefined' && window.SBModel) ? window.SBModel : null;

/* ============ 小工具 ============ */
function money(v, cur) {
  cur = cur || 'USD';
  const n = (+v || 0);
  const sym = cur === 'CNY' ? '¥' : (cur === 'USD' ? '$' : '');
  return sym + n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + (sym ? '' : ' ' + cur);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
/* 把 id 安全地塞进 onclick="foo('...')" 里的单引号字符串。
   注意：id 现在是 UUID 字符串，直接写 onclick="foo(${id})" 会被浏览器当成表达式解析，
   报 ReferenceError，按钮点了完全没反应（旧的数字 id 才歪打正着能跑）。 */
function jid(id) {
  return esc(String(id == null ? '' : id).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}
function stagePill(stage) {
  const map = {
    '需求确认': 'gray', '已报价': 'blue', '价格谈判': 'amber', '样品阶段': 'blue',
    '待付款': 'green', '已成交': 'green', '已流失': 'red'
  };
  return `<span class="pill ${map[stage] || 'gray'}">${esc(stage || '未定')}</span>`;
}
const STAGES = ['需求确认', '已报价', '价格谈判', '样品阶段', '待付款', '已成交', '已流失'];

const Pages = {};

/* ============ 仪表盘 ============ */
Pages.dashboard = function () {
  const wb=Store.workbench();
  const cs = Store.customers();
  const qs = Store.quotes();
  const mk = Store.monthKey();
  // 注意：必须用本地日期。用 toISOString() 取的是 UTC，在东八区每天 0:00-8:00 会算成昨天，
  // 导致「今日待跟进」漏客户、报价单日期错一天。
  const today = Store.dayKey();
  const due = wb.due;
  const monthQuotes = qs.filter(q => String(q.date || '').slice(0, 7) === mk);
  const totalAmount = cs.reduce((s, c) => s + (+c.amount || 0), 0);
  const recent = cs.slice(0, 5);

  const stats = `
    <div class="grid g4" style="margin-bottom:14px">
      <div class="card stat-card accent">
        <div class="card-h">客户总数</div>
        <div class="stat-v">${cs.length}<small>家</small></div>
        <div class="stat-sub">预估采购 ${money(totalAmount)}（非成交额）</div>
      </div>
      <div class="card stat-card">
        <div class="card-h">今日待跟进</div>
        <div class="stat-v" style="color:${due.length ? 'var(--warn)' : 'var(--ink)'}">${due.length}<small>家</small></div>
        <div class="stat-sub">${due.length ? '该联系了' : '今天没有到期的'}</div>
      </div>
      <div class="card stat-card">
        <div class="card-h">本月报价</div>
        <div class="stat-v">${monthQuotes.length}<small>份</small></div>
        <div class="stat-sub">历史累计 ${qs.length} 份</div>
      </div>
      <div class="card stat-card">
        <div class="card-h">产品资料</div>
        <div class="stat-v">${Store.products().length}<small>个</small></div>
        <div class="stat-sub">常用规格已存档</div>
      </div>
    </div>`;

  const fx = `
    <div class="card fx-card">
      <div class="card-h"><span>实时汇率</span><span class="todo-badge" id="fxTime">读取中…</span></div>
      <div id="fxBody"><div class="fx-row"><span class="fx-name">正在获取…</span></div></div>
      <div class="fx-meta">数据源 open.er-api.com</div>
    </div>`;

  const quick = `
    <div class="card">
      <div class="card-h">快捷操作</div>
      <div class="quick">
        <button class="btn" onclick="Cust.openForm()">＋ 新建客户</button>
        <button class="btn ghost" onclick="UI.go('tools')">规格换算</button>
        <button class="btn ghost" onclick="UI.go('docs')">开报价单</button>
        <button class="btn ghost" onclick="UI.go('products')">产品资料</button>
      </div>
    </div>`;

  const dueList = due.length ? `
    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>今日该跟进的客户</span><span class="todo-badge">${due.length} 家</span></div>
      ${due.map(c => `
        <div class="fx-row">
          <span><button class="btn ghost" onclick="Cust.detail('${jid(c.id)}')">${esc(c.name)}</button> <span class="fx-name">· ${esc(c.company || '')}</span></span>
          <span class="fx-val" style="color:var(--accent-deep)">${esc(c.next || '')}</span>
        </div>`).join('')}
    </div>` : '';

  const recentBlock = `
    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>最近客户</span><button class="btn ghost" style="padding:4px 12px;font-size:12.5px" onclick="UI.go('customers')">全部客户</button></div>
      ${recent.length ? recent.map(c => `
        <div class="fx-row">
          <span>
            <b class="t-main">${esc(c.name)}</b>
            <div class="t-sub">${esc(c.company || '')} ${c.country ? '· ' + esc(c.country) : ''}</div>
          </span>
          <span style="text-align:right">
            ${stagePill(c.stage)}
            <div class="t-sub num">${money(c.amount)}（预估）</div>
          </span>
        </div>`).join('') : '<div class="empty"><b>还没有客户</b>点上面的「新建客户」开始记录</div>'}
    </div>`;

  setTimeout(loadFx, 0);
  const activity=`<div class="grid g2" style="margin-top:14px"><div class="card"><div class="card-h">本月报价金额 · 按币种</div>${Object.keys(wb.amounts).map(cur=>`<div class="fx-row"><span>${esc(cur)}</span><b>${money(wb.amounts[cur],cur)}</b></div>`).join('')||'<div class="empty">本月还没有报价</div>'}<div class="t-sub">是报价金额，不代表已成交；不同币种不混加。</div></div><div class="card"><div class="card-h">最近单据 · 共 ${wb.documents} 份</div>${wb.recentDocuments.map(d=>`<div class="fx-row"><button class="btn ghost" onclick="Doc.openEditor('${jid(d.id)}')">${esc(d.no||d.id)}</button><span>${esc(d.type)} · ${esc(d.date)}</span></div>`).join('')||'<div class="empty">还没有单据</div>'}</div></div>`;
  const sample=wb.demo?'<div class="notice-bar">包含标为演示的客户/产品，统计也包含它们；可在设置中清理演示数据。</div>':'';
  return sample+stats + `<div class="grid g2">${fx}${quick}</div>` + dueList + activity + recentBlock;
};

function loadFx() {
  fetch('https://open.er-api.com/v6/latest/USD')
    .then(r => r.json())
    .then(j => {
      const body = document.getElementById('fxBody');
      const t = document.getElementById('fxTime');
      if (!body || !j || !j.rates) return;
      const r = j.rates;
      const rows = [
        ['USD / CNY', r.CNY],
        ['EUR / CNY', r.CNY / r.EUR],
        ['GBP / CNY', r.CNY / r.GBP],
        ['AED / CNY', r.CNY / r.AED],
        ['RUB / CNY', r.CNY / r.RUB],
        ['BRL / CNY', r.CNY / r.BRL]
      ];
      body.innerHTML = rows.map(([n, v]) =>
        `<div class="fx-row"><span class="fx-name">${n}</span><span class="fx-val">${(+v).toFixed(4)}</span></div>`).join('');
      if (t) t.textContent = '更新 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    })
    .catch(() => {
      const body = document.getElementById('fxBody');
      const t = document.getElementById('fxTime');
      if (body) body.innerHTML = '<div class="fx-row"><span class="fx-name">汇率获取失败（不影响其他功能）</span></div>';
      if (t) t.textContent = '离线';
    });
}

/* ============ 客户管理 ============ */
let custQuery = '';

Pages.customers = function () {
  const all = Store.customers();
  const q = custQuery.trim().toLowerCase();
  const list = q ? all.filter(c =>
    (c.name + ' ' + (c.company || '') + ' ' + (c.country || '') + ' ' + (c.note || '')).toLowerCase().includes(q)
  ) : all;

  const rows = list.map(c => `
    <tr>
      <td>
        <button class="btn ghost" onclick="Cust.detail('${jid(c.id)}')">${esc(c.name)}</button>
        <div class="t-sub">建档 ${esc(c.created || '')}</div>
      </td>
      <td>
        <div>${esc(c.company || '—')}</div>
        <div class="t-sub">${esc(c.country || '')}</div>
      </td>
      <td>${stagePill(c.stage)}</td>
      <td class="num">${money(c.amount)}</td>
      <td class="num">${esc(c.next || '—')}</td>
      <td style="max-width:260px">
        <div class="t-sub" style="margin:0">${esc(c.note || '')}</div>
      </td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="编辑" onclick="Cust.openForm('${jid(c.id)}')">✎</button>
        <button class="icon-btn" title="删除" onclick="Cust.remove('${jid(c.id)}')">🗑</button>
      </td>
    </tr>`).join('');

  return `
    <div class="toolbar">
      <div class="grow">
        <input class="inp" id="custSearch" placeholder="搜客户名 / 公司 / 国家 / 备注" value="${esc(custQuery)}"
               oninput="Cust.search(this.value)">
      </div>
      <button class="btn" onclick="Cust.openForm()">＋ 新建客户</button>
    </div>
    ${list.length ? `
      <table class="tb">
        <tr>
          <th>客户</th><th>公司 / 国家</th><th>阶段</th><th>预估金额</th><th>下次跟进</th><th>备注</th><th></th>
        </tr>
        ${rows}
      </table>` : `
      <div class="empty">
        <b>${q ? '没搜到匹配的客户' : '还没有客户记录'}</b>
        ${q ? '换个关键词试试' : '点右上角「新建客户」，把询盘的人记下来——这就是装在客户端里的意义'}
      </div>`}
  `;
};

const Cust = {
  search(v) {
    custQuery = v;
    const el = document.getElementById('content');
    el.innerHTML = Pages.customers();
    const inp = document.getElementById('custSearch');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  },
  openForm(id) {
    if(UI.closeModal && UI.closeModal()===false)return;
    const c = id ? Store.customers().find(x => x.id === id) : null;
    UI.openModal(c ? '编辑客户' : '新建客户', `
      <div class="form-2">
        <div class="form-row"><label>客户姓名</label><input class="inp" id="f_name" value="${esc(c ? c.name : '')}"></div>
        <div class="form-row"><label>国家 / 地区</label><input class="inp" id="f_country" value="${esc(c ? c.country : '')}" placeholder="如 阿联酋"></div>
      </div>
      <div class="form-2"><div class="form-row"><label>电话 / WhatsApp</label><input class="inp" id="f_phone" value="${esc(c && c.phone || '')}"></div><div class="form-row"><label>邮箱</label><input class="inp" id="f_email" value="${esc(c && c.email || '')}"></div></div>
      <div class="form-row"><label>公司名称</label><input class="inp" id="f_company" value="${esc(c ? c.company : '')}"></div>
      <div class="form-row"><label>地址（可选）</label>
        <textarea class="inp" id="f_address" rows="2" placeholder="客户收货/公司地址。存了之后开单据选这个客户可以一键带入买方地址（还能再改）">${esc(c ? c.address : '')}</textarea></div>
      <div class="form-2">
        <div class="form-row"><label>当前阶段</label>
          <select class="inp" id="f_stage">
            ${c && c.stage && !STAGES.includes(c.stage) ? `<option selected>${esc(c.stage)}</option>` : ''}${STAGES.map(s => `<option${c && c.stage === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>预估采购金额（USD）</label><input class="inp num" id="f_amount" type="number" value="${c && c.amount ? c.amount : ''}"></div>
      </div>
      <div class="form-row"><label>下次跟进</label><input class="inp" id="f_next" type="date" value="${esc(c && c.next ? c.next : '')}"></div>
      <div class="form-row"><label>备注（规格、顾虑、报价要点）</label>
        <textarea class="inp" id="f_note" rows="3">${esc(c ? c.note : '')}</textarea>
      </div>
    `, [
      { text: '取消', cls: 'ghost', fn: 'UI.closeModal()' },
      { text: '保存', cls: '', fn: `Cust.save('${jid(id || '')}')` }
    ]);
    if(UI.guardModal)UI.guardModal();
  },
  save(id) {
    const v = k => (document.getElementById(k) || {}).value || '';
    const data = {
      name: v('f_name').trim() || '未命名客户',
      company: v('f_company').trim(),
      country: v('f_country').trim(),
      address: v('f_address').trim(),
      stage: v('f_stage') || '需求确认',
      amount: v('f_amount').trim()===''?0:Number(v('f_amount')),
      next: v('f_next'),
      note: v('f_note').trim()
    };
    data.phone=v('f_phone').trim();data.email=v('f_email').trim();
    let ok;if(id){data.id=id;ok=Store.updateCustomer(data);}else ok=Store.addCustomer(data);
    if(!ok){UI.toast(Store.saveError()||'没有保存，请检查输入和数据状态');return false;}
    UI.closeModal(true);UI.render();return true;
  },
  remove(id) {
    const c = Store.customers().find(x => x.id === id);
    if (!c) return;
    UI.confirm('删除客户', `确定删除「${esc(c.name)}」档案吗？有关联单据或沟通记录时不会删除；建议改为已流失。`, () => {
      if(!Store.removeCustomer(id))UI.toast('未删除：客户仍有关联记录，或写入失败');
      UI.render();
    });
  }
};

/* ============ 产品资料 ============ */
Pages.products = function () {
  const list = Store.products();
  if (!list.length) {
    return `<div class="empty"><b>还没有产品资料</b>把常做的规格存下来，开报价单时直接选</div>
      <div style="text-align:center"><button class="btn" onclick="Prod.openForm()">＋ 新增产品</button></div>`;
  }
  const RI = (typeof SBRealImages !== 'undefined' && SBRealImages) ? SBRealImages : null;
  const rows = list.map(p => {
    const ap = p.mesh > 0 ? (25.4 / p.mesh - p.wire) : 0;
    /* P1-D-05 工作台缩略图：原版工作台是「main 优先、无 main 回落第一张图」；
       这里保持原有规格图缩略图行为不变，只有确认了实物图的产品才优先显示实物图。
       客户纸面（sheet-rc.js）是另一条更严格的口径：只看实物图，无则 NO IMAGE。 */
    /* P1-D-05-FIX-01：实物图三态（auto/custom/none）统一由 SBRealImages.resolve 解析。
       none 时缩略图自然回落规格图，但客户纸面 PHOTO 仍是 NO IMAGE。 */
    const realResolved = (RI && typeof RI.resolve === 'function') ? RI.resolve(p) : {data: p.realImageData || ''};
    const realThumb = productImage(realResolved.data);
    const thumb = realThumb || productImage(p.imageData);
    return `<tr>
      <td>${thumb?`<img class="d4-thumb" src="${thumb}" alt="${realThumb?'产品实物图':'产品图片'}">`:""}<div class="t-main">${esc(p.nameCn)}</div><div class="t-sub">${esc(p.nameEn || '')}</div></td>
      <td class="num">${p.mesh > 0 ? esc(p.mesh) + ' 目' : '—'}</td>
      <td class="num">${esc(p.wire)} mm</td>
      <td class="num">${ap > 0 ? ap.toFixed(3) + ' mm' : '—'}</td>
      <td class="num">${esc(p.width)} m × ${esc(p.rollLen)} m</td>
      <td class="num">${money(p.price)}</td>
      <td class="num">${String(p.hsCode || '').trim() ? esc(p.hsCode) : '<span class="todo-badge">未填</span>'}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="编辑" onclick="Prod.openForm('${jid(p.id)}')">✎</button>
        <button class="icon-btn" title="删除" onclick="Prod.remove('${jid(p.id)}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
  return `
    <div class="toolbar"><div class="grow"></div>
      <button class="btn" onclick="Prod.openForm()">＋ 新增产品</button>
    </div>
    <table class="tb">
      <tr><th>产品</th><th>目数</th><th>丝径</th><th>孔径（自动）</th><th>幅宽 × 卷长</th><th>单价</th><th>HS 编码（可选）</th><th></th></tr>
      ${rows}
    </table>`;
};

const ProductView = { selectedId: null, tab: 'size', query: '' };
Pages.products = function () {
  const list=Store.products();
  if(!list.length)return `<div class="product-empty card"><div class="mesh-sample-mark"></div><h2>先建一件能真正使用的产品</h2><p>不只存名称和单价，还要有外箱、毛净重、包装方式，才能直接拿去开单和装柜。</p><div class="quick"><button class="btn" onclick="Prod.createSample()">生成丝网样板产品</button><button class="btn ghost" onclick="Prod.openForm()">自己新建</button></div></div>`;
  const filtered=list.filter(p=>!ProductView.query||[p.nameCn,p.nameEn,p.sku,p.category].join(' ').toLowerCase().includes(ProductView.query.toLowerCase()));
  if(!list.some(p=>p.id===ProductView.selectedId))ProductView.selectedId=list[0].id;
  const p=list.find(x=>x.id===ProductView.selectedId)||list[0],ap=p.mesh>0?(25.4/p.mesh-p.wire):0,cbm=p.packageLength>0&&p.packageWidth>0&&p.packageHeight>0?p.packageLength*p.packageWidth*p.packageHeight/1000000:0;
  const catalog=filtered.map(x=>`<button class="product-list-item${x.id===p.id?' active':''}" onclick="Prod.select('${jid(x.id)}')"><span class="product-cube">◇</span><span><b>${esc(x.nameCn||'未命名产品')}</b><small>${esc(x.sku||'未设置 SKU')} · ${x.packageLength>0?'包装已录':'包装待补'}</small></span><i>›</i></button>`).join('')||'<div class="t-sub" style="padding:16px">没有匹配的产品</div>';
  const sizeTab=`<div class="product-metrics"><div><span>产品尺寸</span><b>${p.productLength||'—'} × ${p.productWidth||'—'} × ${p.productHeight||'—'} cm</b></div><div><span>单品重量</span><b>${p.productWeight>0?p.productWeight+' kg':'—'}</b></div><div><span>外箱尺寸</span><b>${p.packageLength||'—'} × ${p.packageWidth||'—'} × ${p.packageHeight||'—'} cm</b></div><div><span>单箱 CBM</span><b>${cbm?cbm.toFixed(4)+' m³':'—'}</b></div></div><div class="product-section"><h3>单品参数</h3><div class="product-field-grid"><div><span>目数</span><b>${p.mesh>0?p.mesh+' 目':'不按目数'}</b></div><div><span>丝径</span><b>${p.wire||'—'} mm</b></div><div><span>孔径（自动）</span><b>${ap>0?ap.toFixed(3)+' mm':'—'}</b></div><div><span>幅宽 × 卷长</span><b>${p.width||'—'} m × ${p.rollLen||'—'} m</b></div></div></div><div class="product-section"><h3>外箱套装</h3><div class="product-field-grid"><div><span>每箱装件数</span><b>${p.unitsPerCarton||'—'}</b></div><div><span>单箱净重</span><b>${p.netWeight>0?p.netWeight+' kg':'—'}</b></div><div><span>单箱毛重</span><b>${p.grossWeight>0?p.grossWeight+' kg':'—'}</b></div><div><span>体积重</span><b>${cbm?(cbm*200).toFixed(2)+' kg':'—'}</b></div></div><div class="product-note"><span>包装方式</span>${esc(p.packagingMethod||'待补')}</div><div class="product-note"><span>外箱唛头</span>${esc(p.cartonMark||'待补')}</div></div>`;
  const baseTab=`<div class="product-section"><h3>基础资料</h3><div class="product-field-grid"><div><span>SKU</span><b>${esc(p.sku||'待补')}</b></div><div><span>分类</span><b>${esc(p.category||'待补')}</b></div><div><span>材质</span><b>${esc(p.material||p.note||'待补')}</b></div><div><span>HS 编码</span><b>${esc(p.hsCode||'待补')}</b></div><div><span>参考单价</span><b>${money(p.price)} / ${esc(p.unit||'待补')}</b></div><div><span>计价币种</span><b>USD</b></div></div></div><div class="product-section"><h3>规格（客户单显示）</h3><p class="d4-text">${esc(p.specText||'待补：点「编辑产品」写一段文本规格，例如 1.5×2.5m 三横梁，2.5mm 加厚')}</p></div><div class="product-section"><h3>备注</h3><p class="d4-text">${esc(p.note||'暂无备注')}</p></div>`;
  const talkTab=`<div class="product-section"><h3>产品卖点</h3><p class="d4-text">${esc(p.salesPitch||'可在编辑产品时补充：材质、工艺、使用场景和客户最常问的问题。')}</p></div><div class="product-section"><h3>快速问答</h3><div class="product-qa"><b>这份数据可以直接装柜吗？</b><span>${p.packageLength>0&&p.packageWidth>0&&p.packageHeight>0&&p.grossWeight>0?'可以，外箱和单箱毛重已完整。':'还不行，请先补齐外箱长宽高和单箱毛重。'}</span></div></div>`;
  const detail=ProductView.tab==='base'?baseTab:ProductView.tab==='talk'?talkTab:sizeTab;
  return `<div class="product-page-head"><div><div class="mesh-caption">PRODUCT MATERIAL LIBRARY</div><h2>产品管理</h2><p>尺寸、重量、包装与报价资料统一归档</p></div><div class="product-count"><b>${list.length}</b><span>产品</span></div><button class="btn ghost" onclick="Prod.createSample()">生成样板</button><button class="btn" onclick="Prod.openForm()">＋ 新增产品</button></div><div class="product-workspace"><aside class="product-catalog"><div class="product-search">⌕ <input value="${esc(ProductView.query)}" placeholder="搜索名称 / SKU" onchange="Prod.setQuery(this.value)"></div><div class="product-catalog-title"><b>产品目录</b><span>${filtered.length} / ${list.length}</span></div><div class="product-list">${catalog}</div></aside><section class="product-detail"><header><div><small>${esc(p.sku||'SKU 待补')}</small><h2>${esc(p.nameCn||'未命名产品')}</h2><p>${esc(p.nameEn||'')}</p></div><div class="quick"><button class="btn ghost" onclick="Prod.toLoadPlanner('${jid(p.id)}')">加入装柜</button><button class="btn" onclick="Prod.openForm('${jid(p.id)}')">编辑产品</button><button class="icon-btn" title="删除" onclick="Prod.remove('${jid(p.id)}')">🗑</button></div></header><nav class="product-tabs"><button class="${ProductView.tab==='size'?'active':''}" onclick="Prod.setTab('size')">尺寸重量</button><button class="${ProductView.tab==='base'?'active':''}" onclick="Prod.setTab('base')">基础资料</button><button class="${ProductView.tab==='talk'?'active':''}" onclick="Prod.setTab('talk')">话术问答</button></nav><div class="product-detail-body">${detail}</div></section><aside class="product-assets"><h3>产品素材</h3><div class="asset-types"><span>实拍 <b>${productImage(p.imageData)?1:0}</b></span><span>供应商 <b>0</b></span><span>包装 <b>0</b></span><span>视频 <b>0</b></span><span>文件 <b>0</b></span></div><div class="asset-preview">${productImage(p.imageData)?`<img src="${productImage(p.imageData)}" alt="产品实拍">`:'<div class="mesh-sample-mark"></div><b>暂无实拍图</b><span>编辑产品后可上传本地图片</span>'}</div></aside></div>`;
};

const Prod = {
  openForm() {
    const current = arguments[0] ? Store.products().find(x => x.id === arguments[0]) : null;
    const draft = !current && window.MeshCalcDraft ? window.MeshCalcDraft : null;
    if (draft) window.MeshCalcDraft = null;
    this.editId = current ? current.id : null;
    this.imageDraft = current ? (current.imageData || '') : '';
    UI.openModal(current ? '编辑产品' : '新增产品', `
      <div class="form-2">
        <div class="form-row"><label>中文品名</label><input class="inp" id="p_cn" placeholder="304 不锈钢丝网"></div>
        <div class="form-row"><label>英文品名</label><input class="inp" id="p_en" placeholder="SUS304 stainless steel wire mesh"></div>
      </div>
      <div class="form-2"><div class="form-row"><label>SKU / 产品编号</label><input class="inp" id="p_sku" placeholder="SW-304-100M"></div><div class="form-row"><label>产品分类</label><input class="inp" id="p_category" placeholder="不锈钢编织网"></div></div>
      <div class="form-row"><label>材质</label><input class="inp" id="p_material" placeholder="SUS304"></div>
      <div class="form-2">
        <div class="form-row"><label>目数（填 0 表示不按目数）</label><input class="inp num" id="p_mesh" type="number" placeholder="100"></div>
        <div class="form-row"><label>丝径 mm</label><input class="inp num" id="p_wire" type="number" step="0.01" placeholder="0.10"></div>
      </div>
      <div class="form-2">
        <div class="form-row"><label>幅宽 m</label><input class="inp num" id="p_width" type="number" step="0.01" placeholder="1.22"></div>
        <div class="form-row"><label>卷长 m</label><input class="inp num" id="p_roll" type="number" placeholder="30"></div>
      </div>
      <div class="card" style="margin:12px 0 0;padding:12px;background:var(--paper)">
        <div class="card-h">包装资料（装柜使用）</div>
        <div class="t-sub" style="margin-bottom:10px">填写实际运输外箱数据；系统不会从丝网规格猜包装尺寸或重量。</div>
        <div class="form-2">
          <div class="form-row"><label>单品长 cm</label><input class="inp num" id="p_pl" type="number" min="0" step="0.1" placeholder="可选"></div>
          <div class="form-row"><label>单品宽 cm</label><input class="inp num" id="p_pw" type="number" min="0" step="0.1" placeholder="可选"></div>
        </div>
        <div class="form-2">
          <div class="form-row"><label>单品高 cm</label><input class="inp num" id="p_ph" type="number" min="0" step="0.1" placeholder="可选"></div>
          <div class="form-row"><label>单品重量 kg</label><input class="inp num" id="p_pwt" type="number" min="0" step="0.001" placeholder="可选"></div>
        </div>
        <div class="form-2">
          <div class="form-row"><label>外箱长 cm</label><input class="inp num" id="p_kl" type="number" min="0" step="0.1" placeholder="装柜必填"></div>
          <div class="form-row"><label>外箱宽 cm</label><input class="inp num" id="p_kw" type="number" min="0" step="0.1" placeholder="装柜必填"></div>
        </div>
        <div class="form-2">
          <div class="form-row"><label>外箱高 cm</label><input class="inp num" id="p_kh" type="number" min="0" step="0.1" placeholder="装柜必填"></div>
          <div class="form-row"><label>每箱装件数</label><input class="inp num" id="p_upc" type="number" min="0" step="1" placeholder="正整数"></div>
        </div>
        <div class="form-2">
          <div class="form-row"><label>单箱净重 kg</label><input class="inp num" id="p_nw" type="number" min="0" step="0.001" placeholder="装柜参考"></div>
          <div class="form-row"><label>单箱毛重 kg</label><input class="inp num" id="p_gw" type="number" min="0" step="0.001" placeholder="装柜必填"></div>
        </div>
        <div class="form-row"><label>包装方式</label><input class="inp" id="p_pack" placeholder="如：纸箱、托盘、编织袋"></div>
        <div class="form-row"><label>外箱唛头</label><textarea class="inp" id="p_mark" rows="2" placeholder="可选：客户要求的箱唛"></textarea></div>
      </div>
      <div class="form-2">
        <div class="form-row"><label>定价方式</label><select class="inp" id="p_price_mode" onchange="Prod.priceMode()"><option value="fixed">固定单价</option><option value="range">区间定价</option><option value="tiered">按数量阶梯定价</option></select></div>
        <div class="form-row"><label>报价币种</label><select class="inp" id="p_currency">${['USD','CNY','EUR','GBP','AUD','NZD','CAD'].map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="form-row"><label>最小起订量（按计价单位）</label><input class="inp num" id="p_moq" type="number" min="0" step="any"></div>
        <div class="form-row" data-pricing="fixed"><label>固定参考单价</label><input class="inp num" id="p_price" type="number" step="0.01" min="0" placeholder="待填写"></div>
        <div class="form-row" data-pricing="range"><label>参考价区间（最低价 / 最高价）</label><div class="form-2"><input class="inp" type="number" id="p_price_min" min="0" step="any" aria-label="最低价"><input class="inp" type="number" id="p_price_max" min="0" step="any" aria-label="最高价"></div></div>
        <div class="form-row" data-pricing="tiered"><label>数量阶梯（每行：起始数量, 单价）</label><textarea class="inp" id="p_price_tiers" rows="4" placeholder="100, 20&#10;500, 18&#10;1000, 16"></textarea></div>
        <div class="form-row"><label>计价单位（报价时按它带入，留空则报价行要手动选）</label>
          <select class="inp" id="p_unit">${['㎡', 'roll', 'sheet', 'm', 'kg', 'pcs', 'set'].map(u => `<option value="${u}">${u}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-2">
        <div class="form-row"><label>备注</label><input class="inp" id="p_note" placeholder="平纹编织"></div>
        <div class="form-row"><label>HS 编码（可选）</label><input class="inp" id="p_hs" placeholder="如 7314.49——清关用，请按实际税则自行核对"></div>
      </div>
      <div class="form-row"><label>产品卖点 / 常用介绍</label><textarea class="inp" id="p_pitch" rows="3" placeholder="方便报价和跟客户沟通时快速查看"></textarea></div>
      <div class="t-sub">HS 编码只是<b>方便你开单时带入</b>；带入后仍需在单据上按实际税则核对，系统不核实、不代查。</div>
    `, [
      { text: '取消', cls: 'ghost', fn: 'UI.closeModal()' },
      { text: '保存', cls: '', fn: 'Prod.save()' }
    ]);
    if (current) {
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value == null || value === 0 ? (value === 0 ? '0' : '') : String(value); };
      set('p_cn', current.nameCn); set('p_en', current.nameEn);
      set('p_sku', current.sku); set('p_category', current.category); set('p_material', current.material);
      set('p_mesh', current.mesh); set('p_wire', current.wire); set('p_width', current.width); set('p_roll', current.rollLen);
      set('p_pl', current.productLength); set('p_pw', current.productWidth); set('p_ph', current.productHeight); set('p_pwt', current.productWeight);
      set('p_kl', current.packageLength); set('p_kw', current.packageWidth); set('p_kh', current.packageHeight); set('p_upc', current.unitsPerCarton);
      set('p_nw', current.netWeight); set('p_gw', current.grossWeight); set('p_pack', current.packagingMethod); set('p_mark', current.cartonMark);
      set('p_price', current.price); set('p_unit', current.unit); set('p_hs', current.hsCode); set('p_note', current.note); set('p_pitch', current.salesPitch);
      const pricing=current.pricing||{};set('p_price_mode',pricing.mode||'fixed');set('p_currency',pricing.currency||'USD');set('p_moq',pricing.moq);set('p_price_min',pricing.min);set('p_price_max',pricing.max);set('p_price_tiers',(pricing.tiers||[]).map(t=>t.minQty+', '+t.price).join('\n'));
    } else if (draft) {
      const set = (id, value) => { const el = document.getElementById(id); if (el && value != null) el.value = String(value); };
      set('p_cn', draft.nameCn); set('p_material', draft.material); set('p_width', draft.width); set('p_roll', draft.rollLen); set('p_wire', draft.wire); set('p_note', draft.note);
    }
  },
  priceSummary(p) {
    const r=p.pricing||{mode:'fixed',currency:'USD',fixed:p.price};
    return r.currency+' '+(r.mode==='range'?r.min+'–'+r.max:r.mode==='tiered'?(r.tiers||[]).map(t=>t.minQty+'起：'+t.price).join('；'):(r.fixed==null?'待填':r.fixed));
  },
  priceMode() {
    const mode=document.getElementById('p_price_mode')?.value||'fixed';
    document.querySelectorAll('[data-pricing]').forEach(el=>el.style.display=el.dataset.pricing===mode?'':'none');
  },
  collectPricing() {
    const v=id=>String(document.getElementById(id)?.value||'').trim(),number=id=>v(id)===''?null:Number(v(id));
    const mode=v('p_price_mode')||'fixed',currency=v('p_currency')||'USD',moq=number('p_moq');
    if(moq!==null&&(!Number.isFinite(moq)||moq<=0))throw Error('最小起订量应大于零，未确定可留空');
    const pricing={mode,currency,moq};
    if(mode==='fixed'){const n=number('p_price');if(n!==null&&(!Number.isFinite(n)||n<0))throw Error('固定单价不能为负数');pricing.fixed=n;}
    if(mode==='range'){pricing.min=number('p_price_min');pricing.max=number('p_price_max');if(!Number.isFinite(pricing.min)||!Number.isFinite(pricing.max)||pricing.min<=0||pricing.max<pricing.min)throw Error('区间需要填写正数最低价和最高价，最高价不能低于最低价');}
    if(mode==='tiered'){pricing.tiers=v('p_price_tiers').split('\n').filter(x=>x.trim()).map(line=>{const pair=line.trim().split(/[,，\s]+/);return {minQty:pair.length===2?Number(pair[0]):NaN,price:pair.length===2?Number(pair[1]):NaN};}).sort((a,b)=>a.minQty-b.minQty);if(!pricing.tiers.length||pricing.tiers.some((t,i)=>!Number.isFinite(t.minQty)||t.minQty<=0||!Number.isFinite(t.price)||t.price<=0||(i>0&&t.minQty===pricing.tiers[i-1].minQty)))throw Error('阶梯每行填“起始数量, 单价”，两者须为正数，数量不能重复');if(moq!==null&&pricing.tiers[0].minQty>moq)throw Error('首档数量不能高于最小起订量');}
    return pricing;
  },
  save() {
    const v = k => (document.getElementById(k) || {}).value || '';
    let pricing;try{pricing=Prod.collectPricing();}catch(e){UI.toast(e.message);return false;}
    if(this.imageBusy){UI.toast('请等图片处理完成');return false;}
    const data={
      nameCn: v('p_cn').trim() || '未命名产品',
      nameEn: v('p_en').trim(),
      sku: v('p_sku').trim(), category: v('p_category').trim(), material: v('p_material').trim(),
      mesh: v('p_mesh').trim()===''?0:Number(v('p_mesh')),
      wire: v('p_wire').trim()===''?0:Number(v('p_wire')),
      width: v('p_width').trim()===''?0:Number(v('p_width')),
      rollLen: v('p_roll').trim()===''?0:Number(v('p_roll')),
      productLength: v('p_pl').trim()===''?0:Number(v('p_pl')),
      productWidth: v('p_pw').trim()===''?0:Number(v('p_pw')),
      productHeight: v('p_ph').trim()===''?0:Number(v('p_ph')),
      productWeight: v('p_pwt').trim()===''?0:Number(v('p_pwt')),
      packageLength: v('p_kl').trim()===''?0:Number(v('p_kl')),
      packageWidth: v('p_kw').trim()===''?0:Number(v('p_kw')),
      packageHeight: v('p_kh').trim()===''?0:Number(v('p_kh')),
      unitsPerCarton: v('p_upc').trim()===''?0:Number(v('p_upc')),
      netWeight: v('p_nw').trim()===''?0:Number(v('p_nw')),
      grossWeight: v('p_gw').trim()===''?0:Number(v('p_gw')),
      packagingMethod: v('p_pack').trim(),
      cartonMark: v('p_mark').trim(),
      price: pricing.mode==='fixed'?(pricing.fixed||0):0,
      pricing: pricing,
      unit: v('p_unit').trim(),
      hsCode: v('p_hs').trim(),
      note: v('p_note').trim(), salesPitch: v('p_pitch').trim(),
      catalogSpecs: v('p_catalog_specs').trim(),
      /* P2-01：产品规格改为润成式纯文本（客户单直接印）；结构化 specs 原样保留，不被文本覆盖 */
      specText: v('p_spec_text').trim() === '' ? null : v('p_spec_text').trim().slice(0, 2000),
      specs: typeof ProductIntake !== 'undefined' ? ProductIntake.collect() : undefined
    };
    data.imageData=this.imageDraft||'';                    /* 规格图：原样保留，不覆盖 */
    /* P1-D-05-FIX-01：实物图三态持久化。
       auto / none 不保留自定义图数据（避免以后误复活）；只有 custom 才写 realImageData。
       P1-D-05-FIX-01A：custom 但自定义图缺失时归一为 auto，使「提示 / 预览 / 纸面 / 落库」一致。
       未打开实物图表单时不写这两个字段，updateProduct 合并保留原值。 */
    if (this.realImageModeDraft !== undefined) {
      const rawMode = this.realImageModeDraft || 'auto';
      const effMode = (rawMode === 'custom' && !productImage(this.realImageDraft)) ? 'auto' : rawMode;
      data.realImageMode = effMode;
      data.realImageData = (effMode === 'custom') ? (this.realImageDraft || '') : '';
    } else if (this.realImageDraft !== undefined) {
      data.realImageData = this.realImageDraft || '';
    }
    let ok;if(this.editId){data.id=this.editId;ok=Store.updateProduct(data);}else ok=Store.addProduct(data);
    if(!ok){UI.toast(Store.saveError()||'没有保存，请检查规格与价格');return false;}
    UI.closeModal(true);UI.render();return true;
  },
  remove(id) {
    UI.confirm('删除产品', '只删除产品库资料；历史单据的品名、规格与价格快照完整保留。', () => { if(!Store.removeProduct(id))UI.toast('删除失败'); UI.render(); });
  }
};

Prod.select=function(id){ProductView.selectedId=id;UI.render();};
Prod.setTab=function(tab){ProductView.tab=['size','base','talk'].includes(tab)?tab:'size';UI.render();};
Prod.setQuery=function(value){ProductView.query=String(value||'').trim();UI.render();};
Prod.toLoadPlanner=function(id){LoadPlanner.addProduct(id);UI.go('loadPlanner');};
Prod.createSample=function(){
  const existing=Store.products().find(p=>p.sampleKey==='wire-mesh-demo-v1');
  if(existing){ProductView.selectedId=existing.id;ProductView.tab='size';UI.render();UI.toast('样板产品已经在产品目录里');return;}
  const ok=Store.addProduct({sampleKey:'wire-mesh-demo-v1',demo:true,sku:'SW-304-100M',category:'不锈钢编织网',material:'SUS304',nameCn:'304 不锈钢丝网（装柜样板）',nameEn:'SUS304 Stainless Steel Wire Mesh',mesh:100,wire:0.1,width:1.22,rollLen:30,price:2.35,unit:'㎡',hsCode:'7314.14',productLength:125,productWidth:32,productHeight:32,productWeight:18.6,packageLength:130,packageWidth:70,packageHeight:70,unitsPerCarton:4,netWeight:74.4,grossWeight:82,packagingMethod:'每卷防潮膜 + 编织袋，4 卷/木箱',cartonMark:'SIWANG / SW-304-100M / 4 ROLLS',note:'演示数据，请按实际包装、过磅结果和税则修改。平纹编织。',salesPitch:'100 目细密过滤用网，SUS304 材质；卷材尺寸与木箱包装分开记录，报价、单据和装柜可以共用同一份资料。'});
  if(!ok){UI.toast(Store.saveError()||'样板生成失败');return;}const created=Store.products().find(p=>p.sampleKey==='wire-mesh-demo-v1');ProductView.selectedId=created?created.id:null;ProductView.tab='size';UI.render();UI.toast('已生成一件完整的丝网样板产品');
};

/* ============ 装柜预排 P2（第一版：可解释的单柜几何预排） ============ */
const LoadPlanner = {
  cargo: [], result: null, state: { container: '20GP', gap: 0 }, view: { yaw: 0.55, pitch: 0.28, zoom: 1, selected: -1 },
  containers: {
    '20GP': { name: '20GP', length: 589, width: 235, height: 239, maxWeight: 28200 },
    '40HQ': { name: '40HQ', length: 1203, width: 235, height: 269, maxWeight: 26700 }
  },
  addProduct(id) {
    const p = Store.products().find(x => x.id === id);
    if (!p) return;
    const old = this.cargo.find(x => x.productId === id);
    if (old) old.quantity += 1;
    else this.cargo.push({ productId:id, name:p.nameCn || '未命名产品', length:+p.packageLength||0, width:+p.packageWidth||0, height:+p.packageHeight||0, weight:+p.grossWeight||0, quantity:1, rotation:'upright' });
    this.result = null; UI.render();
  },
  addDemo() {
    let p=Store.products().find(x=>x.sampleKey==='wire-mesh-demo-v1');
    if(!p){Prod.createSample();p=Store.products().find(x=>x.sampleKey==='wire-mesh-demo-v1');}
    if(!p){UI.toast('演示产品生成失败');return;}
    const old=this.cargo.find(x=>x.productId===p.id);
    if(old)old.quantity=Math.max(24,old.quantity||0);
    else this.cargo.push({productId:p.id,name:p.nameCn||'装柜演示货物',length:+p.packageLength||0,width:+p.packageWidth||0,height:+p.packageHeight||0,weight:+p.grossWeight||0,quantity:24,rotation:'upright'});
    this.result=null;UI.render();UI.toast('已加入 24 箱演示货物，点击“生成预排方案”即可查看');
  },
  remove(id) { this.cargo = this.cargo.filter(x => x.productId !== id); this.result = null; UI.render(); },
  update(id, key, raw) { const x=this.cargo.find(c=>c.productId===id); if(!x)return; x[key]=key==='rotation'?raw:Math.max(0, Number(raw)||0); this.result=null; },
  orientations(row) {
    const base=[[row.length,row.width,row.height,'保持竖直']];
    if(row.rotation!=='free') return base;
    const all=[[row.length,row.width,row.height,'原方向'],[row.length,row.height,row.width,'侧放'],[row.width,row.length,row.height,'旋转90°'],[row.width,row.height,row.length,'旋转'],[row.height,row.length,row.width,'旋转'],[row.height,row.width,row.length,'旋转']];
    const seen=new Set(); return all.filter(a=>{const k=a.slice(0,3).join('/');if(seen.has(k))return false;seen.add(k);return true;});
  },
  run() {
    const started=performance.now();
    const el = id => document.getElementById(id);
    const type = el('lp_container') ? el('lp_container').value : '20GP';
    const gap = Math.max(0, Number(el('lp_gap') && el('lp_gap').value) || 0);
    this.state = { container: type, gap };
    const c = this.containers[type];
    const items=[]; const unpacked=[]; let totalWeight=0;
    this.cargo.forEach(row => {
      const qty=Math.floor(Number(row.quantity)||0);
      if (!qty) return;
      if (!(row.length>0&&row.width>0&&row.height>0&&row.weight>0)) { unpacked.push({name:row.name,quantity:qty,reason:'外箱尺寸或单箱毛重未填写'}); return; }
      const accepted=Math.min(qty,5000-items.length);
      for(let n=1;n<=accepted;n++) items.push({row,n});
      if(accepted<qty)unpacked.push({name:row.name,quantity:qty-accepted,reason:'单次预排最多计算 5000 箱，请拆分方案'});
    });
    let x=0,y=0,z=0,rowDepth=0,layerHeight=0;
    for(const item of items){
      const r=item.row;
      if (totalWeight+r.weight>c.maxWeight) { unpacked.push({name:r.name,quantity:1,reason:'超过柜型最大载货重量'}); continue; }
      const candidate=this.orientations(r).find(a=>a[0]<=c.length&&a[1]<=c.width&&a[2]<=c.height&&x+a[0]<=c.length) || this.orientations(r).find(a=>a[0]<=c.length&&a[1]<=c.width&&a[2]<=c.height);
      if (!candidate) { unpacked.push({name:r.name,quantity:1,reason:'外箱尺寸或摆放方向超过柜内尺寸'}); continue; }
      const [L,W,H,rotation]=candidate;
      if (x+L>c.length) { x=0; y+=rowDepth+gap; rowDepth=0; }
      if (y+W>c.width) { x=0; y=0; z+=layerHeight+gap; rowDepth=0; layerHeight=0; }
      if (z+H>c.height) { unpacked.push({name:r.name,quantity:1,reason:'本方案剩余空间不足'}); continue; }
      this._placements = this._placements || [];
      this._placements.push({name:r.name,serial:item.n,x,y,z,length:L,width:W,height:H,weight:r.weight,rotation});
      x+=L+gap; rowDepth=Math.max(rowDepth,W); layerHeight=Math.max(layerHeight,H); totalWeight+=r.weight;
    }
    const placements=this._placements||[]; this._placements=[];
    this.result={container:c,gap,placements,unpacked,totalWeight,total:items.length,loaded:placements.length,elapsedMs:Math.round((performance.now()-started)*10)/10};
    UI.render();
  },
  svg() {
    const r=this.result; if(!r)return '';
    const c=r.container, W=720, H=390, ox=42, oy=330, sx=590/c.length*this.view.zoom, sy=78/c.width*this.view.zoom, sz=255/c.height*this.view.zoom;
    const yaw=this.view.yaw, pitch=this.view.pitch, cy=Math.cos(yaw), syaw=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
    const project=(x,y,z)=>{const a=x*cy-y*syaw,b=x*syaw+y*cy;return {x:ox+(a*sx),y:oy-(z*sz*cp+b*0.42*cp)+b*sp};};
    const drawLimit=220,step=Math.max(1,Math.ceil(r.placements.length/drawLimit)),indices=[];
    for(let i=0;i<r.placements.length;i+=step)if(this.view.revealed==null||i<this.view.revealed)indices.push(i);
    if(this.view.selected>=0&&!indices.includes(this.view.selected))indices.push(this.view.selected);
    const boxes=indices.map(i=>{const p=r.placements[i];
      const q=project(p.x,p.y,p.z), q2=project(p.x,p.y,p.z+p.height), px=q.x, py=q.y, top=q2.y;
      const w=Math.max(2,p.length*sx), h=Math.max(2,p.height*sz), d=Math.max(2,p.width*sy);
      const col=['#0f8b8d','#2673b8','#c47d20','#6c55a3','#3c8d55'][i%5], opacity=this.view.selected<0||this.view.selected===i?'.9':'.28';
      return `<g onclick="LoadPlanner.select(${i})" style="cursor:pointer"><title>${esc(p.name)} #${p.serial} · ${p.x},${p.y},${p.z} cm</title><path d="M ${px} ${py} l ${d} ${-d*0.42} v ${top-py} l ${-d} ${d*0.42} z" fill="${col}" opacity=".72"/><rect x="${px}" y="${top}" width="${w}" height="${Math.max(2,py-top)}" rx="2" fill="${col}" opacity="${opacity}"/><path d="M ${px} ${top} l ${d} ${-d*0.42} h ${w} l ${-d} ${d*0.42} z" fill="${col}" opacity=".55"/><text x="${px+3}" y="${top+14}" font-size="10" fill="#fff">${i+1}</text></g>`;
    }).join('');
    const p0=project(0,0,0), px1=project(c.length,0,0), py1=project(0,c.width,0), pz1=project(0,0,c.height);
    return `<div class="card" style="margin-top:14px"><div class="card-h">柜内摆放示意 <span class="todo-badge">可旋转</span></div><div class="quick" style="margin-bottom:8px"><button class="btn ghost" onclick="LoadPlanner.rotate(-0.22)">↶ 左转</button><button class="btn ghost" onclick="LoadPlanner.rotate(0.22)">右转 ↷</button><button class="btn ghost" onclick="LoadPlanner.tilt(-0.08)">俯视 −</button><button class="btn ghost" onclick="LoadPlanner.tilt(0.08)">俯视 +</button><button class="btn ghost" onclick="LoadPlanner.zoom(-0.1)">缩小</button><button class="btn ghost" onclick="LoadPlanner.zoom(0.1)">放大</button></div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:390px;background:#f5f8fa;border:1px solid var(--line);border-radius:8px"><path d="M ${p0.x} ${p0.y} L ${px1.x} ${px1.y} L ${project(c.length,c.width,0).x} ${project(c.length,c.width,0).y} L ${py1.x} ${py1.y} Z" fill="#e8eef2" stroke="#7b8d99"/><path d="M ${p0.x} ${p0.y} L ${pz1.x} ${pz1.y} L ${project(0,c.width,c.height).x} ${project(0,c.width,c.height).y} L ${py1.x} ${py1.y}" fill="none" stroke="#9aaab3"/>${boxes}<text x="20" y="375" font-size="12" fill="#52636d">${esc(c.name)} · ${c.length} × ${c.width} × ${c.height} cm · 点击箱体查看详情</text></svg>${this.view.selected>=0&&r.placements[this.view.selected]?`<div class="t-sub" style="margin-top:8px">已选：<b>${esc(r.placements[this.view.selected].name)}</b> · 箱号 ${r.placements[this.view.selected].serial} · 坐标 (${r.placements[this.view.selected].x}, ${r.placements[this.view.selected].y}, ${r.placements[this.view.selected].z}) cm · ${r.placements[this.view.selected].weight} kg</div>`:''}<div class="t-sub">示意图用于查看摆放位置，不能代表现场装载顺序、承重或加固方案。</div></div>`;
  },
  paintVisual(){const svg=document.querySelector('#content svg[viewBox="0 0 720 390"]'),old=svg&&svg.closest('.card');if(old)old.outerHTML=this.svg();else UI.render();},
  rotate(delta){this.view.yaw+=delta;this.paintVisual();},
  tilt(delta){this.view.pitch=Math.max(-0.7,Math.min(0.9,this.view.pitch+delta));this.paintVisual();},
  zoom(delta){this.view.zoom=Math.max(.65,Math.min(1.45,this.view.zoom+delta));this.paintVisual();},
  select(i){this.view.selected=i;this.paintVisual();},
  exportJson() {
    if(!this.result){UI.toast('请先生成预排方案');return;}
    const payload={version:1,container:this.state.container,gap:this.state.gap,cargo:this.cargo,result:this.result,createdAt:new Date().toISOString()};
    if(window.SBW&&window.SBW.exportToFile) window.SBW.exportToFile(JSON.stringify(payload,null,2),'丝网盒子-装柜方案.json').then(r=>{if(r&&r.ok)UI.toast('方案已导出');});
  },
  exportCsv() {
    if(!this.result){UI.toast('请先生成预排方案');return;}
    const rows=[['序号','货物名称','箱号','X(cm)','Y(cm)','Z(cm)','长(cm)','宽(cm)','高(cm)','毛重(kg)','摆放方式']].concat(this.result.placements.map((p,i)=>[i+1,p.name,p.serial,p.x,p.y,p.z,p.length,p.width,p.height,p.weight,p.rotation]));
    const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    if(window.SBW&&window.SBW.exportToFile) window.SBW.exportToFile(csv,'丝网盒子-装柜明细.csv').then(r=>{if(r&&r.ok)UI.toast('装柜明细已导出，可用 Excel 打开');});
  },
  importJson(input) {
    const f=input&&input.files&&input.files[0]; if(!f)return;
    const reader=new FileReader(); reader.onload=()=>{try{const p=JSON.parse(reader.result);if(!p||!Array.isArray(p.cargo)||!p.container)throw Error('格式不对');this.state.container=p.container;this.state.gap=Number(p.gap)||0;this.cargo=p.cargo;this.result=p.result||null;UI.render();UI.toast('已恢复装柜方案');}catch(e){UI.toast('方案文件无法读取：'+e.message);}}; reader.readAsText(f); input.value='';
  },
  clear(){this.cargo=[];this.result=null;this.state={container:'20GP',gap:0};UI.render();}
};

/* Three.js viewer replaces the old DOM-heavy SVG renderer. The original
   function stays above as an offline fallback, but is no longer mounted. */
LoadPlanner.legacySvg=LoadPlanner.svg;
LoadPlanner.svg=function(){
  const r=this.result;if(!r)return '';
  return `<div class="card lp3d-card" style="margin-top:14px"><div class="lp3d-head"><div><div class="card-h" style="margin:0">三维装柜视图 <span class="todo-badge">Three.js</span></div><div class="t-sub">左键拖动旋转 · 滚轮缩放 · 右键平移 · 点击箱体看坐标</div></div><div class="quick"><span class="lp3d-badge" id="lp3dBadge">准备三维场景…</span><button class="btn ghost" onclick="LoadPlanner3D.setView('iso')">立体</button><button class="btn ghost" onclick="LoadPlanner3D.setView('top')">俯视</button><button class="btn ghost" onclick="LoadPlanner3D.setView('door')">柜门</button></div></div><div class="lp3d-playbar"><button class="btn ghost" onclick="LoadPlanner3D.previous()">上一步</button><button class="btn" id="lp3dPlayBtn" onclick="LoadPlanner3D.togglePlay()">▶ 播放摆放</button><button class="btn ghost" onclick="LoadPlanner3D.next()">下一步</button><input id="lp3dProgress" type="range" min="0" max="${r.placements.length}" value="${r.placements.length}" oninput="LoadPlanner3D.seek(this.value)"><span id="lp3dProgressText">${r.placements.length} / ${r.placements.length} 箱</span></div><div id="loadPlanner3d" class="lp3d-host"><div class="lp3d-loading">正在建立三维柜体…</div></div><div class="lp3d-foot"><span id="lp3dSelected">点击箱体可查看坐标和重量</span><span>播放只演示摆放结果，不代表现场叉车和人工装载顺序。</span></div></div>`;
};
LoadPlanner.paintVisual=function(){if(window.LoadPlanner3D&&this.result)window.LoadPlanner3D.mount(this.result);else UI.render();};
LoadPlanner.showLegacy3D=function(reason){const host=document.getElementById('loadPlanner3d'),card=host&&host.closest('.lp3d-card');if(card){card.outerHTML=`<div class="notice-item n-warn"><b>当前电脑无法建立 WebGL 场景，已切换到兼容示意图。</b>${reason?`<span>${esc(reason)}</span>`:''}</div>`+this.legacySvg.call(this);}};

Pages.loadPlanner = function () {
  const ps=Store.products(); const r=LoadPlanner.result; const c=r ? r.container : LoadPlanner.containers[LoadPlanner.state.container];
  const productRows=ps.map(p=>`<tr><td>${esc(p.nameCn||'未命名产品')}<div class="t-sub">${esc(p.packageLength||0)} × ${esc(p.packageWidth||0)} × ${esc(p.packageHeight||0)} cm · ${esc(p.grossWeight||0)} kg/箱</div></td><td><button class="btn ghost" onclick="LoadPlanner.addProduct('${jid(p.id)}')">加入</button></td></tr>`).join('') || '<tr><td colspan="2">还没有产品资料，请先录入外箱尺寸和单箱毛重。</td></tr>';
  const cargoRows=LoadPlanner.cargo.map(x=>`<tr><td>${esc(x.name)}<div class="t-sub">${x.length} × ${x.width} × ${x.height} cm · ${x.weight} kg/箱</div></td><td><input class="inp num" style="width:80px" type="number" min="1" step="1" value="${x.quantity}" oninput="LoadPlanner.update('${jid(x.productId)}','quantity',this.value)"></td><td><select class="inp" onchange="LoadPlanner.update('${jid(x.productId)}','rotation',this.value)"><option value="upright"${x.rotation!=='free'?' selected':''}>保持竖直</option><option value="free"${x.rotation==='free'?' selected':''}>允许侧放</option></select></td><td><button class="icon-btn" onclick="LoadPlanner.remove('${jid(x.productId)}')">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="t-sub">从右侧产品库加入货物。</td></tr>';
  const detailRows=r?r.placements.slice(0,120).map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)}</td><td>${p.serial}</td><td>${p.x}, ${p.y}, ${p.z}</td><td>${p.length} × ${p.width} × ${p.height}</td><td>${p.weight}</td><td>${esc(p.rotation)}</td></tr>`).join(''):'';
  const resultHtml=r?`<div class="card" style="margin-top:14px"><div class="card-h">预排结果 <span class="todo-badge">几何预排</span></div><div class="grid g4"><div><b>${r.loaded}</b><div class="t-sub">已装入箱数</div></div><div><b>${r.total}</b><div class="t-sub">计划箱数</div></div><div><b>${r.totalWeight.toFixed(3)} kg</b><div class="t-sub">装入毛重</div></div><div><b>${((r.loaded/(r.total||1))*100).toFixed(1)}%</b><div class="t-sub">箱数装入率</div></div></div>${r.unpacked.length?'<div class="notice-item n-error" style="margin-top:12px"><b>未装入</b>'+r.unpacked.map(x=>'<div>'+esc(x.name)+' × '+x.quantity+'：'+esc(x.reason)+'</div>').join('')+'</div>':'<div class="notice-item n-ok" style="margin-top:12px">当前货物全部进入本次预排方案。</div>'}<div class="quick" style="margin-top:12px"><button class="btn ghost" onclick="LoadPlanner.exportJson()">导出方案 JSON</button><button class="btn ghost" onclick="LoadPlanner.exportCsv()">导出装柜明细（Excel）</button><label class="btn ghost">恢复方案 JSON<input type="file" accept="application/json,.json" style="display:none" onchange="LoadPlanner.importJson(this)"></label></div><div class="card-h" style="margin-top:16px">逐箱明细</div><div style="overflow:auto"><table class="tb"><tr><th>#</th><th>货物</th><th>箱号</th><th>坐标 cm</th><th>尺寸 cm</th><th>毛重 kg</th><th>方向</th></tr>${detailRows}</table></div><div class="t-sub" style="margin-top:10px">坐标原点在柜内前左下角。结果只表示几何预排，不代表现场装载顺序、承重、重心或加固方案。</div></div>${LoadPlanner.svg()}`:'';
  return `<div class="toolbar"><div><div class="t-sub">LOAD PLANNER / P2</div><h2 style="margin:2px 0">装柜预排</h2></div><div class="grow"></div><button class="btn ghost" onclick="LoadPlanner.addDemo()">一键加入演示货物</button><button class="btn ghost" onclick="LoadPlanner.clear()">清空货物</button></div><div class="notice-item n-info lp-how" style="margin-bottom:14px"><b>怎么生成三维装柜：</b><span>① 产品资料填写外箱长宽高和单箱毛重 → ② 在右侧点“加入”并设置箱数 → ③ 点“生成预排方案” → ④ 在三维图点“播放摆放”。第一次体验可直接点右上角“一键加入演示货物”。</span></div><div class="grid g2"><div class="card"><div class="card-h">柜型与参数</div><div class="form-2"><div class="form-row"><label>柜型</label><select class="inp" id="lp_container" onchange="LoadPlanner.state.container=this.value;LoadPlanner.result=null"><option value="20GP"${LoadPlanner.state.container==='20GP'?' selected':''}>20GP · 589 × 235 × 239 cm</option><option value="40HQ"${LoadPlanner.state.container==='40HQ'?' selected':''}>40HQ · 1203 × 235 × 269 cm</option></select></div><div class="form-row"><label>箱间预留 cm</label><input class="inp num" id="lp_gap" type="number" min="0" max="20" step="0.1" value="${LoadPlanner.state.gap}"></div></div><div class="t-sub">最大载货重量：${c.maxWeight} kg。预排使用外箱尺寸和单箱毛重。</div><div class="card-h" style="margin-top:16px">本次货物</div><table class="tb"><tr><th>货物</th><th>箱数</th><th>摆放</th><th></th></tr>${cargoRows}</table><button class="btn" style="margin-top:12px" onclick="LoadPlanner.run()">生成预排方案</button></div><div class="card"><div class="card-h">产品资料库</div><div class="t-sub" style="margin-bottom:10px">只有外箱长宽高和单箱毛重都大于 0 的产品才适合装柜。</div><table class="tb"><tr><th>产品</th><th></th></tr>${productRows}</table></div></div>${resultHtml}`;
};

/* ============ 单据中心（五类） ============ */
const DOCS_KINDS = [
  ['QT', '报价单', 'Quotation', '选客户和产品，自动算金额，可打印'],
  ['PI', '形式发票', 'Proforma Invoice', '收定金前发给客户确认（带银行资料）'],
  ['PL', '装箱单', 'Packing List', '按箱数、毛净重、体积出单（无金额）'],
  ['CI', '商业发票', 'Commercial Invoice', '清关用（带 HS 编码与运输信息）'],
  ['SC', '销售合同', 'Sales Contract', '签单用（条款自行录入，无预设模板）']
];
const DocsFilter = { type: 'ALL' };

Pages.docs = function () {
  const docs = Store.documents(DocsFilter.type === 'ALL' ? null : DocsFilter.type);
  const rows = docs.length ? docs.map(d => {
    const differ = Doc.totalsDiffer(d);
    const isPL = d.type === 'PL';
    const sum = isPL
      ? ((d.totals && d.totals.packages != null) ? d.totals.packages + ' 件' : '<span class="todo-badge">包装待补</span>')
      : money(d.totals && d.totals.grand, d.currency || 'USD');
    return `
    <tr>
      <td><div class="t-main">${esc(d.no || '')}</div><div class="t-sub">${esc(Doc.TYPE_CN[d.type] || d.type)} · ${esc(d.date || '')}</div></td>
      <td>${esc(d.customer && d.customer.company || '')}<div class="t-sub">${esc((d.customer && d.customer.name) || '')}${d.customer && d.customer.country ? ' · ' + esc(d.customer.country) : ''}</div></td>
      <td class="t-sub" style="margin:0">${(d.items || []).map(it => esc(it.nameCn || '')).join('、') || '—'}</td>
      <td class="num">${(d.items || []).length} 项</td>
      <td class="num">${sum}
        ${differ ? '<div class="t-sub" style="color:#b45309">原合计与明细计算不一致</div>' : ''}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" title="编辑 / 重开修改" onclick="Doc.openEditor('${jid(d.id)}')">✎</button>
        <button class="icon-btn" data-export-pdf title="导出 PDF" onclick="Doc.exportPdf('${jid(d.id)}')">PDF</button>
        <button class="icon-btn" title="打印 / 另存为 PDF（系统打印）" onclick="Doc.print('${jid(d.id)}')">🖨</button>
        <button class="icon-btn" title="复制 / 转换成新单据" onclick="Doc.askConvert('${jid(d.id)}')">⇄</button>
        <button class="icon-btn" title="删除" onclick="Doc.remove('${jid(d.id)}')">🗑</button>
      </td>
    </tr>`;
  }).join('') : '';

  const tabs = ['ALL'].concat(DOCS_KINDS.map(k => k[0])).map(t => `
    <button class="seg-btn${DocsFilter.type === t ? ' on' : ''}" onclick="Doc.setDocsFilter('${t}')">${t === 'ALL' ? '全部' : (Doc.TYPE_CN[t] || t)}</button>`).join('');

  return `
    <div class="grid g3">
      ${DOCS_KINDS.map(([type, cn, en, desc]) => `
        <div class="card">
          <div class="card-h"><span>${cn}</span><span class="todo-badge">${en}</span></div>
          <div style="font-size:13px;color:var(--ink-soft);margin-bottom:12px">${desc}</div>
          <button class="btn" onclick="Doc.openEditor(null,'${type}')">开一份${cn}</button>
        </div>`).join('')}
    </div>
    <h3 style="font-size:14px;margin:22px 0 10px;color:var(--ink-soft)">已生成的单据</h3>
    <div class="doc-tabs">${tabs}</div>
    ${docs.length ? `<table class="tb"><tr><th>单号</th><th>客户</th><th>明细</th><th>项数</th><th>${DocsFilter.type === 'PL' ? '包装' : '金额 / 包装'}</th><th></th></tr>${rows}</table>`
      : `<div class="empty"><b>还没有${DocsFilter.type === 'ALL' ? '' : (Doc.TYPE_CN[DocsFilter.type] || '')}单据</b>用上面的按钮开一份</div>`}`;
};

/* ============ 报价编辑（D2：整页编辑器 + 双栏 A4 预览） ============
 *
 * 设计要点（对应 D2 任务书）：
 *   · 草稿永远是「独立副本」（Store.getDocument 返回深拷贝），绝不直接改库里的活动对象；
 *   · 保存只有两个入口：Store.addDocument（新建）/ Store.updateDocument（修改），
 *     都走事务 + 校验 + 原子落盘；失败时草稿留着，页面不假称成功；
 *   · 客户按值快照进单据（id + 名称/公司/国家），改客户主资料不影响已存单据；
 *   · 产品选择只是把产品资料填进行里，改价只影响本单，不写回产品库；
 *   · 金额计算统一走 MODEL（validateItems 的行金额 + documentTotals 的合计）；
 *   · 历史原合计与明细计算不一致时明确提示；打开/取消不重算落盘，
 *     修改后保存采用「明确展示并确认」的明细计算结果。
 */
/* 报价编辑器分成两半，命名是硬约定（改名前先看这里）：
   · QuoteEdit 只存状态（id / draft / dirty / pane / custMode …），不挂任何方法；
   · Doc 挂全部行为（openEditor / setField / save / askLeave / refresh …）。
   页面 onclick、askLeave 弹窗按钮、app.js 的离开与关闭守卫，一律写 Doc.xxx()。
   （曾经把行为定义在 Doc 却用 QuoteEdit 打点调用，一输入就 refresh is not a function，
     D2 隔离实测暴露，已统一并加回归测试。） */
const QuoteEdit = {
  id: null,        // 正在编辑的单据 id；null = 新建（含转换来的未保存草稿）
  draft: null,     // 独立编辑副本（v4 单据形状）
  dirty: false,
  saving: false,
  /* 转换/复制的**独立**在途标志：构造草稿阶段与保存是两件事，
     不能用 saving 顶替——saving 只覆盖保存动作，挡不住连点「转换」（转换矩阵 §5）。 */
  converting: false,
  exporting: false,
  hints: [],       // 复制/转换带来的核对提示（银行/包装/运输等），展示在编辑器顶部
  pane: 'edit',    // 窄窗口时显示哪个面板（edit / preview）
  previewZoom: 0.62, // 纸面预览缩放；只影响查看和编辑，不改变打印尺寸
  custMode: 'pick',// pick | manual | card
  custQuery: '',
  prodQuery: '',   // P1-D-02：产品库卡片搜索的查询词（只存状态；添加动作走 Doc.addProductFromLibrary → addRow+pickProduct）
  /* 输入层的无效状态：键 "行号:字段名" → {raw, msg, kind}
     kind: empty（还没填）/ invalid（不是有效数字、负数、太大）。
     有内容就不能保存，绝不把无效输入悄悄变成 0。 */
  invalid: {},
  /* P1-C 内部核价状态：
     · costInvalid：成本输入层的无效标记（键 "行号:字段" → {raw,msg}）——与纸面金额的
       invalid 分开管理，成本是内部核价字段，不该挡住纸面合计的展示；
     · pricingResult：最近一次「开始核价」的引擎输出（只读展示，绝不写回草稿）；
     · feeAllocOpen：正在展开人工分摊的费用下标；manualAlloc：展开面板的草稿输入。 */
  costInvalid: {},
  pricingResult: null,
  pricingStale: false,
  /* P1-C-FIX-01 BUG-04：核价结果失效令牌——markStale 每次递增，「开始核价」写入新令牌；
     确认弹窗回调执行前比对令牌，防止"点填价 → 改成本 → 再确认"把过期价写进成交单价。 */
  pricingToken: 0,
  feeAllocOpen: null,
  manualAlloc: null,
  pendingGo: null, // 未保存离开时的目标页面
  pendingOpen: null,
  pendingConversion: null
};

const Doc = {
  /* 历史原合计 vs 按明细计算：有差异就提示（旧数据原样保留，不静默改写） */
  totalsDiffer(d) {
    if (!d || !d.totals) return false;
    const g = +d.totals.grand || 0;
    const c = d.totals.computedFromItems;
    if (c == null || !isFinite(+c)) return false;
    return Math.abs(g - (+c)) > 0.005;
  },

  /* 空行按类型建：PL 行**没有** price（无金额单据），带包装四件套（null = 待补）；
     CI/SC 行带 hsCode。计价单位留空：不替用户按 ㎡ 假定，界面上明确待补全。
     新行也带稳定身份（_rowId）：与旧行同规格时也不会被误配上（D2-R2）。 */
  emptyItem(type) {
    type = type || (QuoteEdit.draft && QuoteEdit.draft.type) || 'QT';
    const it = { _rowId: Doc.newRowId(), productId: null, nameCn: '', nameEn: '', mesh: 0, wire: 0, width: 0, rollLen: 0, qty: 0, unit: '' };
    if (type === 'PL') {
      /* 包装事实只能来自实际装箱：null/空 = 待补，绝不填 0 冒充已填（A5） */
      it.packages = null; it.net = null; it.gross = null; it.volume = null;
    } else {
      it.price = 0;
      if (type === 'CI' || type === 'SC') it.hsCode = '';
    }
    return it;
  },

  /* ---------- 稳定行身份（D2-R2） ----------
     旧单据的行可能没有 id/_rowId。首次进入编辑时给每一行建立 _rowId（只改草稿，
     不写库、不置脏），之后重排/增删/改规格都按身份配对，不会把别行的扩展字段串过来。
     保存后 _rowId 随行落盘，下次重开继续按身份配对。 */
  newRowId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'row-' + crypto.randomUUID();
    } catch (e) {}
    return 'row-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  },
  ensureRowIds() {
    const items = (QuoteEdit.draft && QuoteEdit.draft.items) || [];
    items.forEach(it => {
      if (!it || typeof it !== 'object') return;
      if ((typeof it.id === 'string' && it.id) || (typeof it._rowId === 'string' && it._rowId)) return;
      it._rowId = Doc.newRowId();
    });
  },

  /* ---------- 数字输入口径（D2-F2） ----------
     合法：能解析成有限数、非负、不超过 1e12。
     清空 / 输入中间态 → 待填；NaN / Infinity / 超大指数 / 负数 → 无效。
     一律保留原输入文本，绝不改成 0（0 价报价是能直接发出去的）。 */
  NUM_FIELDS: ['mesh', 'wire', 'width', 'rollLen', 'qty', 'price'],
  /* 必填 vs 选填：数量和单价必须填；目数等规格留空按 0 处理（电焊网本来就填 0） */
  REQUIRED_NUM: ['qty', 'price'],
  NUM_LABEL: { mesh: '目数', wire: '丝径', width: '幅宽', rollLen: '卷长', qty: '数量', price: '单价' },

  /* ---------- PL 包装四件套（A5：null/空 = 待补，填了必须合法，绝不填 0 冒充） ---------- */
  PL_FIELDS: ['packages', 'net', 'gross', 'volume'],
  PL_LABEL: { packages: '包装件数', net: '净重', gross: '毛重', volume: '体积' },
  /* 返回错误串；'' = 合法（含待补） */
  checkPackaging(f, v, row) {
    const label = Doc.PL_LABEL[f] || f;
    if (v == null || String(v).trim() === '') return '';       /* 待补 */
    const n = Number(String(v).trim());
    if (!isFinite(n)) return label + '不是有效数字';
    if (n <= 0) return label + '必须大于 0（还没定就留空，不要填 0 冒充已填）';
    if (n > 1e12) return label + '数字太大';
    if (f === 'packages' && !Number.isInteger(n)) return '包装件数必须是整数件数';
    /* 毛重 ≥ 净重：两项都填了才比较（A5） */
    if (f === 'gross' && row && row.net != null && String(row.net).trim() !== '' && isFinite(+row.net) && n < (+row.net)) {
      return '毛重不能小于净重';
    }
    return '';
  },
  checkNumber(field, raw, required) {
    const s = String(raw == null ? '' : raw).trim();
    const label = Doc.NUM_LABEL[field] || field;
    const req = required == null ? (Doc.REQUIRED_NUM.indexOf(field) >= 0) : !!required;
    if (s === '') return req ? { state: 'empty', msg: label + '还没填' } : { state: 'ok', value: 0 };
    const n = Number(s);
    if (!isFinite(n)) return { state: 'invalid', msg: label + '不是有效数字' };
    if (n < 0) return { state: 'invalid', msg: label + '不能是负数' };
    if (n > 1e12) return { state: 'invalid', msg: label + '数字太大' };
    return { state: 'ok', value: n };
  },
  invalidList() {
    const m = QuoteEdit.invalid || {};
    return Object.keys(m).map(k => {
      const p = k.split(':');
      return Object.assign({ row: +p[0], field: p[1] }, m[k]);
    }).sort((a, b) => (a.row - b.row) || (a.field < b.field ? -1 : 1));
  },
  rowIssues(i) { return Doc.invalidList().filter(x => x.row === i); },

  /*
   * 新草稿（五类共用，v4 形状）。
   * ★ 不预填任何"看起来像约定"的默认值：贸易条款、付款方式、备注一律空
   *   （A1：空 term 不准默认印 FOB Tianjin；A3：SC 条款默认空，不预设法律措辞）。
   *   QT 的报价有效期可预填建议值 30 days（字段表 §2 允许，可改可清）。
   * ★ 卖方：新单从设置页**建立快照**（company/contact/sellerAddress）；
   *   设置页没填就是 null，纸面显示"（待补：卖方信息）"，不猜补（字段表 §6.1）。
   */
  newDraft(type) {
    type = type || 'QT';
    const s = Store.settings() || {};
    const hasSeller = String(s.company || '').trim() || String(s.contact || '').trim() || String(s.sellerAddress || '').trim();
    /* P1-C §5.4：新报价默认定价参数（feeInPrice=1 含费、feeRate 3%、commissionRate 20%、fx=null）。
       只作用于新建草稿；历史单据打开时保持原值（含 null 的未知态），绝不自动补默认。 */
    const pd = (type !== 'PL' && Store.pricingDefaults) ? Store.pricingDefaults() : null;
    const base = {
      id: null, no: '', type: type, date: Store.dayKey(), sourceId: null,
      customer: { id: null, name: '', company: '', country: '', address: '' },
      items: [Doc.emptyItem(type)],
      currency: s.defaultCurrency || 'USD',
      term: '', payment: '', validity: (type === 'QT' ? '30 days' : ''), delivery: '', remark: '',
      seller: hasSeller ? { company: String(s.company || ''), contact: String(s.contact || ''), address: String(s.sellerAddress || '') } : null,
      bank: '', buyerAddress: '', marks: '',
      shipment: '', vessel: '', origin: '',
      contractTerms: '', signDate: '', signPlace: '',
      packagingMode: null, totalPackages: null,
      totals: {}
    };
    if (pd) {
      /* 金额类单据：V5 单据级定价键 + 内部定价扩展字段种子。
         extra 的零费用显式传数字 0（§6.2），不用 null/undefined 代替。 */
      base.fx = null; base.feeRate = pd.feeRate; base.targetMargin = null;
      base.commissionRate = pd.commissionRate; base.freightMarkup = null;
      base.markupRate = null; base.feeInPrice = pd.feeInPrice; base.pricingVersion = null;
      base.fees = [];
      base._unknown = { pricing: { incoterm: '', namedPlace: '', freight: [], extra: { discount: 0, other_charges: 0 } } };
    }
    if (['QT', 'PI', 'SC', 'CI', 'PL'].indexOf(type) >= 0) {
      /* P1-D-04 拍板：五类单据统一使用 RunCheng 黑白版式（quotation-rc-v1），新建即写入声明，
         使「编辑器显示的模板」与「纸面实际生效的模板」完全一致，不再有新版式回落基础版的分叉。
         只影响新建草稿；历史单据的模板声明原样保留（未声明的按默认版式渲染，见 sheet.templateFor）。 */
      base._unknown = base._unknown || {};
      base._unknown.quoteLayout = { templateId: 'quotation-rc-v1' };
    }
    return base;
  },

  openEditor(id, type) {
    /* 正在编辑别的单据且有未保存改动：先问，不直接丢 */
    if (UI.current === 'quoteEdit' && QuoteEdit.dirty && QuoteEdit.id !== id) {
      QuoteEdit.pendingOpen = id;
      Doc.askLeave('nav');
      return;
    }
    QuoteEdit.hints = [];
    QuoteEdit.id = id || null;
    QuoteEdit.draft = id ? Store.getDocument(id) : Doc.newDraft(type || 'QT');
    /* 旧单据首次进入编辑：给没有稳定身份的行建立 _rowId（只改草稿，不写库、不置脏）。
       之后重排/增删/改规格都按身份配对，不会把别行的扩展字段串过来（D2-R2）。 */
    Doc.ensureRowIds();
    QuoteEdit.dirty = false;
    /* P1-C：打开编辑器不自动定价（§5.4）——核价结果与输入标记全部清空，
       历史单据保持未知态（feeInPrice=null 等），由用户主动操作后才进入定价。 */
    QuoteEdit.costInvalid = {};
    QuoteEdit.pricingResult = null;
    QuoteEdit.pricingStale = false;
    QuoteEdit.feeAllocOpen = null;
    QuoteEdit.manualAlloc = null;
    QuoteEdit.invalid = {};
    const d0 = QuoteEdit.draft;
    const isPL = d0.type === 'PL';
    (d0.items || []).forEach((it, i) => {
      /* 数量：五类都必填（PL 的数量是货物计量数量，与包装件数是两回事） */
      const chkQ = Doc.checkNumber('qty', it.qty, true);
      if (chkQ.state !== 'ok') QuoteEdit.invalid[i + ':qty'] = { raw: String(it.qty == null ? '' : it.qty), msg: chkQ.msg, kind: chkQ.state };
      if (!isPL) {
        /* 金额类：单价必填 */
        const chkP = Doc.checkNumber('price', it.price, true);
        if (chkP.state !== 'ok') QuoteEdit.invalid[i + ':price'] = { raw: String(it.price == null ? '' : it.price), msg: chkP.msg, kind: chkP.state };
      } else {
        /* PL：包装四件套 null/空 = 待补（不报错）；填了必须合法（A5） */
        Doc.PL_FIELDS.forEach(f => {
          const msg = Doc.checkPackaging(f, it[f], it);
          if (msg) QuoteEdit.invalid[i + ':' + f] = { raw: String(it[f] == null ? '' : it[f]), msg: msg, kind: 'invalid' };
        });
      }
      /* 规格类：空按 0，但负数/非数字仍是问题 */
      ['mesh', 'wire', 'width', 'rollLen'].forEach(f => {
        const chk = Doc.checkNumber(f, it[f], false);
        if (chk.state !== 'ok') QuoteEdit.invalid[i + ':' + f] = { raw: String(it[f] == null ? '' : it[f]), msg: chk.msg, kind: chk.state };
      });
      if (!String(it.unit == null ? '' : it.unit).trim()) {
        QuoteEdit.invalid[i + ':unit'] = { raw: '', msg: '计价单位还没选', kind: 'empty' };
      }
    });
    QuoteEdit.custQuery = '';
    QuoteEdit.custMode = id ? 'card' : 'pick';
    QuoteEdit.pane = 'edit';
    UI.go('quoteEdit');
  },

  /* ---------- 草稿字段 ---------- */
  setField(i, f, v) {
    const it = QuoteEdit.draft && QuoteEdit.draft.items[i];
    if (!it) return;
    const key = i + ':' + f;
    if (Doc.PL_FIELDS.indexOf(f) >= 0 && QuoteEdit.draft.type === 'PL') {
      /* PL 包装四件套：留空 = null（待补，可保存）；填了必须合法，非法就留在界面上并记问题 */
      const raw = String(v == null ? '' : v).trim();
      if (raw === '') {
        it[f] = null;
        delete QuoteEdit.invalid[key];
      } else {
        it[f] = raw;
        const msg = Doc.checkPackaging(f, raw, it);
        if (msg) QuoteEdit.invalid[key] = { raw: raw, msg: msg, kind: 'invalid' };
        else {
          it[f] = Number(raw);
          delete QuoteEdit.invalid[key];
          /* 净重改动后，同一行的毛重校验结论可能变（毛重≥净重） */
          if (f === 'net' && it.gross != null && String(it.gross).trim() !== '') {
            const gm = Doc.checkPackaging('gross', it.gross, it);
            if (gm) QuoteEdit.invalid[i + ':gross'] = { raw: String(it.gross), msg: gm, kind: 'invalid' };
            else delete QuoteEdit.invalid[i + ':gross'];
          }
        }
      }
      Doc.refresh();
      return;
    }
    if (Doc.NUM_FIELDS.indexOf(f) >= 0) {
      const chk = Doc.checkNumber(f, v);
      if (chk.state === 'ok') {
        it[f] = chk.value;
        delete QuoteEdit.invalid[key];
      } else {
        /* 保留原输入文本：用户能看到自己填了什么，也不会被当成 0 算钱 */
        it[f] = String(v == null ? '' : v);
        QuoteEdit.invalid[key] = { raw: String(v == null ? '' : v), msg: chk.msg, kind: chk.state };
      }
    } else {
      it[f] = v;
      /* 单位补上了就撤掉"待补全"标记 */
      if (f === 'unit') {
        const noUnit = !String(v == null ? '' : v).trim();
        if (noUnit) QuoteEdit.invalid[key] = { raw: '', msg: '计价单位还没选', kind: 'empty' };
        else delete QuoteEdit.invalid[key];
      }
    }
    Doc.refresh();
  },
  addRow() {
    QuoteEdit.draft.items.push(Doc.emptyItem(QuoteEdit.draft.type));
    Doc.markDirty();
    P1C.markStale();                                  /* BUG-04：行增删 → 核价结果过期 */
    UI.render();
  },
  removeRow(i) {
    const items = QuoteEdit.draft.items;
    if (items.length <= 1) { UI.toast('至少要留一行明细'); return; }
    items.splice(i, 1);
    Doc.markDirty();
    P1C.markStale();                                  /* BUG-04：行增删 → 核价结果过期 */
    UI.render();
  },
  /* 已有行切产品：替换行为要明确——用新产品资料覆盖规格与参考单价，数量保留 */
  pickProduct(i, pid) {
    const it = QuoteEdit.draft.items[i];
    if (!it) return;
    if (!pid) {
      if (it.productId) {
        it.productId = null;
        Doc.markDirty();
        UI.toast('已解除产品关联，这一行已填的内容保留');
        UI.render();
      }
      return;
    }
    const p = Store.products().find(x => String(x.id) === String(pid));
    if (!p) return;
    const fill = () => {
      const prevUnit = String(it.unit == null ? '' : it.unit).trim();
      it.productId = p.id;
      it.nameCn = p.nameCn || '';
      it.nameEn = p.nameEn || '';
      it.productSpecs = p.specs ? JSON.parse(JSON.stringify(p.specs)) : null;
      it._unknown = it._unknown || {};
      /* 规格图 / 产品目录页快照：字段名与历史语义保持原样，不删、不改名、不覆盖。 */
      it._unknown.productImage = (typeof p.imageData === 'string' && p.imageData.length <= 1000100) ? p.imageData : '';
      /* P1-D-05-FIX-01：三态快照。auto→内置实拍（未匹配为空）；custom→用户图；
         none→空且永不自动带入。纸面只读 realImage，规格图绝不回退。
         同时记录 realImageMode，重开/转换/导出后状态一致。 */
      const RI = (typeof SBRealImages !== 'undefined' && SBRealImages) ? SBRealImages : null;
      const realResolved = (RI && typeof RI.resolve === 'function')
        ? RI.resolve(p)
        : {mode: 'auto', data: (typeof p.realImageData === 'string' && p.realImageData.length <= 1000100) ? p.realImageData : ''};
      it._unknown.realImage = realResolved.data || '';
      it._unknown.realImageMode = realResolved.mode || 'auto';
      it._unknown.catalogSpecs = p.catalogSpecs || '';
      it._unknown.productSku = p.sku || '';
      it.mesh = p.mesh || 0;
      it.wire = p.wire || 0;
      it.width = p.width || 0;
      it.rollLen = p.rollLen || 0;
      it.price = p.price || 0;
      /* P1-C §3.3 产品库联动：规格描述 + 四项成本 + 确认态按值带入**单据快照**。
         带入后与产品库不再实时绑定；修改本单不反写产品库，也不影响历史单据。
         产品库没填成本就是 null（未填写），绝不把 null 自动转成 0。 */
      it.specText = (typeof p.specText === 'string') ? p.specText : null;
      ['costFactory', 'costPacking', 'costInland', 'costOther'].forEach(k => {
        it[k] = (typeof p[k] === 'number' && isFinite(p[k]) && p[k] >= 0) ? p[k] : null;
      });
      it.costConfirmed = (p.costConfirmed === true || p.costConfirmed === false) ? p.costConfirmed : null;
      const pricing=p.pricing;
      if(pricing && QuoteEdit.draft.type!=='PL'){
        it._unknown.pricingReference=JSON.parse(JSON.stringify(pricing));
        if(pricing.mode!=='fixed'||pricing.currency!==(QuoteEdit.draft.currency||'USD')||(pricing.moq&&it.qty<pricing.moq)){
          it.price=0;
          QuoteEdit.invalid[i+':price']={raw:'',msg:'请按本单数量、币种和产品定价确认具体单价',kind:'empty'};
          setTimeout(()=>UI.toast('产品定价参考：'+Prod.priceSummary(p)+'；请填写本单明确单价（不会自动换汇）'),0);
        }
      }
      /* D2-F3：计价单位按产品库带入；产品库没填就留空并标记待补全，不替用户假定 ㎡ */
      it.unit = String(p.unit == null ? '' : p.unit).trim();
      if (!it.unit) QuoteEdit.invalid[i + ':unit'] = { raw: '', msg: '计价单位还没选', kind: 'empty' };
      else delete QuoteEdit.invalid[i + ':unit'];
      /* A3：CI/SC 行带入产品库的 HS 编码**仅作录入参考**（提示核对），
         不称已核实；单据上的改动绝不反向写回产品库。 */
      let hsBrought = false;
      if ((QuoteEdit.draft.type === 'CI' || QuoteEdit.draft.type === 'SC') && String(p.hsCode || '').trim()) {
        it.hsCode = String(p.hsCode || '');
        hsBrought = true;
      }
      Doc.markDirty();
      P1C.markStale();                                /* BUG-04：产品切换（成本/单位随之变化）→ 核价结果过期 */
      UI.render();
      if (hsBrought) UI.toast('HS 编码已从产品库带入作参考，请按实际税则核对（改这里不会改产品库）');
      const nu = String(it.unit || '').trim();
      if (!nu) {
        UI.toast('这个产品在产品库里没填计价单位，请在这一行选一个（不自动按 ㎡ 计算）');
      } else if (prevUnit && prevUnit !== nu) {
        UI.toast('计价单位从「' + prevUnit + '」变成「' + nu + '」：数量 ' + (it.qty || 0) + ' 的含义变了，请核对数量与单价');
      } else {
        UI.toast('已按产品资料填入规格、参考单价与计价单位（改价只影响这张单）');
      }
    };
    const hasContent = it.productId || it.nameCn || it.mesh || it.wire || it.width || it.rollLen || it.price;
    if (hasContent && it.productId !== p.id) {
      UI.confirm('切换产品', `会用「${esc(p.nameCn || '')}」的资料覆盖本行的品名、规格、计价单位和参考单价（数量保留）。确定吗？`, fill);
    } else {
      fill();
    }
  },

  /* ---------- 客户 ---------- */
  searchCust(v) {
    QuoteEdit.custQuery = v;
    QuoteEdit.custMode = 'pick';
    UI.render();
    const inp = document.getElementById('qe_custSearch');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  },
  pickCust(id) {
    const c = Store.customers().find(x => String(x.id) === String(id));
    if (!c) return;
    QuoteEdit.draft.customer = { id: c.id, name: c.name || '', company: c.company || '', country: c.country || '', address: String(c.address || '') };
    /* 换客户：先清掉上一个客户的买方地址，绝不把旧地址串到新客户身上（A3） */
    QuoteEdit.draft.buyerAddress = '';
    /* P2-01：V2 买方有 6 项 + 地址。邮箱/电话/WhatsApp 存进单据扩展字段
       （不改 schema、不进 customer 快照），换客户时一并带入。 */
    QuoteEdit.draft._unknown = QuoteEdit.draft._unknown || {};
    QuoteEdit.draft._unknown.buyerContact = {
      email: c.email || '', phone: c.phone || '', whatsapp: c.whatsapp || ''
    };
    QuoteEdit.custMode = 'card';
    QuoteEdit.custQuery = '';
    Doc.markDirty();
    UI.render();
    UI.toast('已把客户当前资料快照进这张单；之后改客户资料不影响它');
  },
  manualCust() {
    QuoteEdit.draft.customer = { id: null, name: '', company: '', country: '', address: '' };
    QuoteEdit.custMode = 'manual';
    Doc.markDirty();
    UI.render();
    const inp = document.getElementById('qe_custCompany');
    if (inp) setTimeout(() => inp.focus(), 30);
  },
  changeCust() {
    QuoteEdit.custMode = 'pick';
    UI.render();
  },
  /* 刷新快照：显式操作 + 可取消（确认框就是"取消"的机会） */
  refreshCust() {
    const cur = QuoteEdit.draft.customer;
    const c = Store.customers().find(x => String(x.id) === String(cur.id));
    if (!c) { UI.toast('客户库里找不到这条了，只能手填'); return; }
    UI.confirm('刷新客户快照', `会用「${esc(c.company || c.name || '')}」的当前资料覆盖单据里的客户快照。<br>已保存的其他单据不受影响；单据上的买方地址不会被这次刷新改写。确定刷新吗？`, () => {
      QuoteEdit.draft.customer = { id: c.id, name: c.name || '', company: c.company || '', country: c.country || '', address: String(c.address || '') };
      Doc.markDirty();
      UI.render();
      UI.toast('客户快照已刷新（还没保存，保存后生效）');
    });
  },
  custField(field, v) {
    const d = QuoteEdit.draft;
    if (!d) return;
    /* P2-01：V2 买方 6 项里的邮箱/电话/WhatsApp 存单据扩展字段 _unknown.buyerContact，
       沿用本 setter 的 `buyerContact.xxx` 前缀写入——不新增写入口、不升级 Schema、
       也不污染 customer 快照（快照仍只有 id/name/company/country/address）。 */
    if (String(field).indexOf('orderInfo.') === 0) {
      const k2 = String(field).slice('orderInfo.'.length);
      if (['depositRatio', 'packaging'].indexOf(k2) < 0) return;
      d._unknown = d._unknown || {};
      const cur2 = (d._unknown.orderInfo && typeof d._unknown.orderInfo === 'object') ? d._unknown.orderInfo : {};
      cur2[k2] = v;
      d._unknown.orderInfo = cur2;
      Doc.markDirty(); return;
    }
    if (String(field).indexOf('buyerContact.') === 0) {
      const k = String(field).slice('buyerContact.'.length);
      if (['email', 'phone', 'whatsapp'].indexOf(k) < 0) return;
      d._unknown = d._unknown || {};
      const cur = (d._unknown.buyerContact && typeof d._unknown.buyerContact === 'object') ? d._unknown.buyerContact : {};
      cur[k] = v;
      d._unknown.buyerContact = cur;
      Doc.markDirty(); Doc.refresh(); return;
    }
    d.customer[field] = v;
    Doc.markDirty();
  },
  orderExtOf(k) {
    const d = QuoteEdit.draft || {};
    const o = (d._unknown && d._unknown.orderInfo) || {};
    const v = o[k];
    return (v == null || v === '') ? '' : v;
  },
  buyerContactOf() {
    const d = QuoteEdit.draft || {};
    const c = (d._unknown && d._unknown.buyerContact) || {};
    return { email: c.email || '', phone: c.phone || '', whatsapp: c.whatsapp || '' };
  },

  /* ---------- 计算（与落盘同一套口径） ---------- */
  /* 有无效/待填的行时，合计不算出一个"看起来有效"的数：rows 对应位置为 null，grand 为 null */
  computeTotals() {
    const items = (QuoteEdit.draft && QuoteEdit.draft.items) || [];
    const bad = {};
    Doc.invalidList().forEach(b => { bad[b.row] = true; });
    const rows = items.map((it, i) => bad[i] ? null : MODEL.round2((+it.qty || 0) * (+it.price || 0)));
    if (Object.keys(bad).length) return { rows, grand: null, blocked: true };
    return { rows, grand: MODEL.round2(rows.reduce((s, a) => s + a, 0)), blocked: false };
  },

  /* ---------- 保存 ---------- */
  save(opts) {
    opts = opts || {};
    const silent = !!opts.silent;
    if (QuoteEdit.saving) return false;
    if (QuoteEdit.converting) return false;      /* 转换构造中：不接受保存（独立在途标志） */
    const d = QuoteEdit.draft;
    if (!d) return false;
    if (Store.blocked()) {
      UI.toast('数据只读，不能保存（原因见页面顶部提示）');
      return false;
    }
    /* 输入层的问题先说清楚（D2-F2/F3）：无效数字、待填、缺计价单位一律拦住，
       不丢给 validateItems 去猜，也不把无效值当成 0 算出一个假合计 */
    const bad = Doc.invalidList();
    if (bad.length) {
      UI.toast('第 ' + (bad[0].row + 1) + '行' + bad[0].msg + '——先改好再保存（这次什么都没存）');
      return false;
    }
    /* P1-C：成本/费用输入层的非法值先拦住（非法输入不得静默转 0，也不丢给 v5 写门去猜） */
    const badCost = P1C.inputInvalidList();
    if (badCost.length) {
      UI.toast('第 ' + (badCost[0].row + 1) + '行' + badCost[0].msg + '——先改好再保存（这次什么都没存）');
      return false;
    }
    const noUnit = (d.items || []).findIndex(it => !String(it.unit == null ? '' : it.unit).trim());
    if (noUnit >= 0) {
      UI.toast('第 ' + (noUnit + 1) + '行还没选计价单位，先选一个再保存（不自动按 ㎡ 计算）');
      return false;
    }
    /* 收集期校验：与落盘同一套规则，提前把问题说清楚。
       必须带 type——PL 行没有 price/amount（不按金额类校验），CI/SC 才落 hsCode。 */
    const v = MODEL.validateItems(d.items, d.type);
    if (!v.ok) { UI.toast('还没法保存：' + v.error); return false; }
    if (!String((d.customer && (d.customer.company || d.customer.name)) || '').trim()) {
      UI.toast('先选个客户，或者用「手填客户信息」');
      return false;
    }
    const finish = (ok) => {
      if (!ok) return false;
      if (opts.close) { try { window.SBW.finishClose('saved'); } catch (e) {} }
      if (opts.leave) Doc.exit();
      return true;
    };
    /* 历史原合计与明细不一致：保存前明确展示并确认计算结果 */
    if (QuoteEdit.id) {
      const cur = Store.getDocument(QuoteEdit.id);
      if (cur && Doc.totalsDiffer(cur)) {
        const t = MODEL.documentTotals(v.items);
        UI.confirm('合计会按明细重算',
          `这张单的原合计是 <b>${money(cur.totals.grand, cur.currency || 'USD')}</b>，按现在的明细算是 <b>${money(t.grand, d.currency || 'USD')}</b>。<br>保存后合计采用明细计算值，原合计留档在 previousGrand。确定保存吗？`,
          () => finish(Doc.commit(v, true)));
        return false;
      }
    }
    return finish(Doc.commit(v, silent));
  },

  /* 真正落盘：新建走 addDocument，修改走 updateDocument；都返回布尔 */
  commit(v, silent) {
    QuoteEdit.saving = true;
    const d = QuoteEdit.draft;
    let ok = false, created = null;
    try {
      /* v4 全字段：复制/转换来的草稿也走这一条（type 由草稿决定，不是写死 QT）。
       PL 的 packagingMode/totalPackages 与包装四件套在这里一并落盘；
       金额类不带包装键（validateItems 会按 type 剥离）。 */
    const spec = Object.assign({}, JSON.parse(JSON.stringify(d)), {
      type: d.type || 'QT',
      date: d.date || Store.dayKey(),
      sourceId: (d.sourceId == null || d.sourceId === '') ? null : d.sourceId,
      items: d.items,               /* 草稿行（带 _rowId 稳定身份），行级字段按身份合并带回 */
      customer: d.customer,
      currency: d.currency, term: d.term, payment: d.payment, validity: d.validity,
      delivery: d.delivery, remark: d.remark,
      seller: (d.seller == null) ? null : d.seller,
      bank: d.bank || '', buyerAddress: d.buyerAddress || '', marks: d.marks || '',
      shipment: d.shipment || '', vessel: d.vessel || '', origin: d.origin || '',
      contractTerms: d.contractTerms || '', signDate: d.signDate || '', signPlace: d.signPlace || '',
      packagingMode: (d.packagingMode == null) ? null : d.packagingMode,
      totalPackages: (d.totalPackages == null) ? null : d.totalPackages
    });
    /* 只在新建时把草稿的 totals 带过去：转换带来的 previousGrand（源单原合计）要在落盘时留下，
       合计本身仍由 writeDocument 按明细重算，草稿里的旧合计不会盖掉重算值。 */
    if (!QuoteEdit.id && d.totals && typeof d.totals === 'object') spec.totals = d.totals;
    if (QuoteEdit.id) {
        ok = Store.updateDocument(QuoteEdit.id, spec);
      } else {
        created = Store.addDocument(spec);
        ok = !!created;
      }
    } finally {
      QuoteEdit.saving = false;
    }
    if (!ok) {
      UI.toast(silent ? '保存失败，没有离开：草稿还在，请看页面顶部提示' : '没有保存成功，请看页面顶部提示（草稿还在，可以重试）');
      return false;
    }
    if (created) {
      QuoteEdit.id = created.id;
      QuoteEdit.draft = Store.getDocument(created.id);   /* 用落盘后的版本继续（带上单号） */
    }
    QuoteEdit.dirty = false;
    if (!silent) UI.toast(created ? '已保存，单号 ' + created.no : '已保存');
    UI.render();
    return true;
  },

  /* ---------- 离开保护 ---------- */
  markDirty() {
    if (QuoteEdit.dirty) return;
    QuoteEdit.dirty = true;
    const el = document.getElementById('qe_dirty');
    if (el) { el.textContent = '● 有未保存的修改'; el.classList.add('on'); }
  },
  askLeave(mode) {   /* mode: nav | close */
    UI.openModal('还没保存', `
      <div style="font-size:14px;line-height:1.9;color:var(--ink)">
        这张单据还没保存。<br>
        <span class="t-sub">保存失败时不会关闭页面，草稿会留着让你重试。</span>
      </div>`, [
      { text: '继续编辑', cls: 'ghost', onclick: 'Doc.cancelLeave()' },
      { text: '放弃修改', cls: 'danger', onclick: mode === 'close' ? 'Doc.discardAndClose()' : 'Doc.discard()' },
      { text: '保存并离开', cls: '', onclick: mode === 'close' ? 'Doc.saveThenClose()' : 'Doc.saveThenLeave()' }
    ]);
  },
  cancelLeave() {
    QuoteEdit.pendingGo = null;
    QuoteEdit.pendingOpen = null;
    QuoteEdit.pendingConversion = null;
    UI.closeModal();
  },
  allowLeave(next) {
    if (!QuoteEdit.dirty) return true;
    QuoteEdit.pendingGo = next;
    Doc.askLeave('nav');
    return false;
  },
  requestLeave() {
    if (QuoteEdit.dirty) Doc.askLeave('nav');
    else Doc.exit();
  },
  discard() {
    QuoteEdit.dirty = false;
    Doc.exit();
  },
  discardAndClose() {
    QuoteEdit.dirty = false;
    try { window.SBW.finishClose('discard'); } catch (e) {}
  },
  saveThenLeave() {
    /* 保存成功由 finish→exit 离开；失败（含等确认）则留在编辑器，草稿不丢 */
    Doc.save({ silent: true, leave: true });
  },
  saveThenClose() {
    Doc.save({ silent: true, close: true });
  },
  exit() {
    UI.closeModal();
    QuoteEdit.dirty = false;
    if (QuoteEdit.pendingConversion) {
      const next = QuoteEdit.pendingConversion;
      QuoteEdit.pendingConversion = null;
      QuoteEdit.pendingGo = null;
      QuoteEdit.pendingOpen = null;
      Doc.startConvert(next.id, next.type);
      return;
    }
    if (QuoteEdit.pendingGo) { const p = QuoteEdit.pendingGo; QuoteEdit.pendingGo = null; UI.go(p); return; }
    if (QuoteEdit.pendingOpen) { const id = QuoteEdit.pendingOpen; QuoteEdit.pendingOpen = null; Doc.openEditor(id); return; }
    UI.go('docs');
  },

  /* ---------- 窄窗口布局 ---------- */
  layout() {
    const split = document.querySelector('.qe-split');
    if (!split) return;
    /* P2-01：默认**单栏**。填参数时不该被预览挤窄；要看纸面就点顶部「预览」切过去。
       这样编辑区拿到整行宽度，一格一格的输入不再挤在一起。 */
    const single = true;
    split.classList.toggle('single', !!single);
    split.querySelectorAll('.qe-pane').forEach(p => {
      p.classList.toggle('hidden', !!single && p.dataset.pane !== QuoteEdit.pane);
    });
    const seg = document.getElementById('qe_seg');
    if (seg) seg.style.display = single ? 'flex' : 'none';
    const be = document.getElementById('qe_seg_edit');
    const bp = document.getElementById('qe_seg_preview');
    if (be) be.classList.toggle('active', QuoteEdit.pane === 'edit');
    if (bp) bp.classList.toggle('active', QuoteEdit.pane === 'preview');
  },
  setPane(p) { QuoteEdit.pane = p; Doc.layout(); },
  previewZoom(delta) {
    const step = delta == null ? 0.1 : (+delta || 0);
    QuoteEdit.previewZoom = Math.max(0.45, Math.min(1.2, +(QuoteEdit.previewZoom + step).toFixed(2)));
    const host = document.getElementById('qe_preview');
    if (host) host.style.setProperty('--qe-preview-zoom', QuoteEdit.previewZoom);
    const label = document.getElementById('qe_zoom_label');
    if (label) label.textContent = Math.round(QuoteEdit.previewZoom * 100) + '%';
  },
  resetPreviewZoom() {
    QuoteEdit.previewZoom = 0.62;
    Doc.previewZoom(0);
  },

  /* ---------- 轻量刷新（不重渲页面，输入不失焦） ---------- */
  refresh() {
    Doc.markDirty();
    /* P1-C：任何编辑都让上一次核价结果过期（价格保护：修改后必须重新核价才能填入建议价） */
    if (QuoteEdit.pricingResult && !QuoteEdit.pricingStale) {
      QuoteEdit.pricingStale = true;
      P1C.showStaleMark();   /* P1-D-02c：轻量刷新（数量/单价等）翻过期态时，提示同步出现 */
    }
    const t = Doc.computeTotals();
    const d = QuoteEdit.draft;
    const isPL = d.type === 'PL';
    /* 标红范围按类型分：金额类看 qty/price，装箱单看包装四件套 */
    const redFields = isPL ? Doc.PL_FIELDS.concat(['qty', 'unit']) : Doc.NUM_FIELDS.concat(['unit']);
    (d.items || []).forEach((it, i) => {
      const issues = Doc.rowIssues(i);
      const el = document.getElementById('qe_amt_' + i);
      if (el) {
        if (issues.length) {
          el.textContent = '待修正';
          el.classList.add('bad');
          el.title = issues.map(x => x.msg).join('；');
        } else {
          el.textContent = money(t.rows[i], d.currency || 'USD');
          el.classList.remove('bad');
          el.title = '';
        }
      }
      /* 有问题的输入框标红，行内给出可理解的原因（不重渲，输入不失焦） */
      redFields.forEach(f => {
        const inp = document.getElementById('qe_f_' + i + '_' + f);
        if (!inp) return;
        const one = issues.filter(x => x.field === f)[0];
        if (one) inp.classList.add('bad'); else inp.classList.remove('bad');
      });
      const bad = document.getElementById('qe_bad_' + i);
      if (bad) {
        if (issues.length) {
          bad.innerHTML = '⚠ ' + esc(issues.map(x => x.msg).join('；')) + '——改好才能保存';
          bad.style.display = '';
        } else {
          bad.innerHTML = '';
          bad.style.display = 'none';
        }
      }
    });
    if (isPL) {
      /* 装箱单汇总只有一处口径（MODEL.packagingTotals）：未知一律"待补"，不显示上一次的残留值 */
      const pl = document.getElementById('qe_plsum');
      if (pl) pl.outerHTML = Doc.plSumHTML(d);
    } else {
      const tot = document.getElementById('qe_total');
      if (tot) {
        if (t.blocked) { tot.textContent = '待修正'; tot.classList.add('bad'); }
        else { tot.textContent = money(t.grand, d.currency || 'USD'); tot.classList.remove('bad'); }
      }
    }
    const pv = document.getElementById('qe_preview');
    if (pv) pv.innerHTML = Doc.sheetHTML(d, true);
  },

  /* 装箱单汇总块（渲染与轻量刷新共用一处实现，避免两处口径走偏） */
  plSumHTML(d) {
    const p = MODEL.packagingTotals(d.items, d.packagingMode, d.totalPackages);
    const mode = d.packagingMode === 'mixed'
      ? '存在混装——总件数取下面填的「整单总件数」，逐行件数不进汇总'
      : (d.packagingMode === 'separate'
        ? '各行包装不重叠——总件数 = 各行件数相加'
        : '还没选包装模式——总件数保持「待补」，不按行件数猜');
    return `<div class="qe-total" id="qe_plsum">
          <div class="qe-total-num">总件数 <b>${p.packages == null ? '待补' : p.packages + ' 件'}</b>
            · 净重 ${p.net == null ? '待补' : p.net + ' kg'}
            · 毛重 ${p.gross == null ? '待补' : p.gross + ' kg'}
            · 体积 ${p.volume == null ? '待补' : p.volume + ' m³'}</div>
          <div class="t-sub">口径：${mode}；净重/毛重/体积是每行货物的合计值，不是每箱值。</div>
        </div>`;
  },

  /* ---------- 专用 PDF 导出 / 系统打印 / 全屏预览（共用受控纸面 app/sheet.js） ---------- */
  async exportPdf(id) {
    if (QuoteEdit.exporting) return false;
    if (!id || (UI.current === 'quoteEdit' && QuoteEdit.dirty)) {
      UI.toast('请先保存或放弃修改后再导出 PDF'); return false;
    }
    if (!window.SBW || typeof window.SBW.exportPdf !== 'function') {
      UI.toast('PDF 导出通道未就绪，请重启程序'); return false;
    }
    QuoteEdit.exporting = true;
    document.querySelectorAll('[data-export-pdf]').forEach(b => { b.disabled = true; });
    try {
      const result = await window.SBW.exportPdf(id);
      if (result && result.ok) UI.toast('PDF 已导出：' + result.path);
      else if (result && result.canceled) UI.toast('已取消导出，没有生成文件');
      else UI.toast('PDF 未导出：' + ((result && result.error) || '未知错误'));
      return !!(result && result.ok);
    } catch (e) { UI.toast('PDF 未导出：' + e.message); return false; }
    finally {
      QuoteEdit.exporting = false;
      document.querySelectorAll('[data-export-pdf]').forEach(b => { b.disabled = false; });
    }
  },
  print(id) {
    const d = Store.getDocument(id);
    if (!d) { UI.toast('单据不存在了'); return; }
    document.getElementById('printView').innerHTML = Doc.sheetHTML(d, false) + `
      <div class="print-toolbar">
        <button class="btn" data-export-pdf onclick="Doc.exportPdf('${jid(d.id)}')">导出 PDF</button>
        <button class="btn" onclick="window.print()">打印 / 另存为 PDF（系统打印）</button>
        <button class="btn ghost" onclick="Doc.closePrint()">关闭预览</button>
      </div>`;
    document.body.classList.add('preview-print');
  },
  closePrint() {
    document.body.classList.remove('preview-print');
  },
  remove(id) {
    UI.confirm('删除单据', '确定删除这条单据记录吗？删了没法恢复。', () => { Store.removeQuote(id); UI.render(); });
  },

  /* ---------- A4 纸面（预览 / 打印 / B3 导出共用 app/sheet.js 的受控模板） ----------
     这里不再自己拼一版纸面：抬头只读单据里的 seller 快照（A2，不再读当前 settings），
     用户字符串统一转义，PL 不印金额，汇总按 MODEL 口径——纸面只有 sheet.js 一处实现。
     草稿把输入层问题传进去，纸面标"待修正 / 待补"，不拿算出来的数冒充有效。 */
  sheetHTML(d, isDraft) {
    const S = (typeof Sheet !== 'undefined') ? Sheet : ((typeof window !== 'undefined') ? window.Sheet : null);
    if (!S || typeof S.build !== 'function') {
      /* 受控纸面模块没加载：宁可说明白，也不在这儿拼一版可能与它不一致的纸面 */
      return '<div class="q-sheet"><div class="q-todo">（纸面模块 sheet.js 未加载，无法生成预览）</div></div>';
    }
    const issues = isDraft ? Doc.invalidList().map(b => ({ row: b.row, field: b.field, msg: b.msg })) : [];
    return S.build(d, { isDraft: !!isDraft, editable: !!isDraft, rowIssues: issues, templateId: S.templateFor(d) });
  }
};

/* 编辑器页面（整页，双栏：左编辑 / 右 A4 预览；窄窗口可切换） */
/* 编辑器页面（整页，双栏：左编辑 / 右 A4 预览；窄窗口可切换）
 * 五类共用这一页，字段组按 type 显隐（字段表 §5.4）：
 *   QT 基础；PI + 银行；CI + HS 列 / 运输三项；SC + 条款与签订；PL 包装交互且无金额。 */
Pages.quoteEdit = function () {
  const d = QuoteEdit.draft;
  if (!d) {
    return `<div class="card"><div class="card-h">没有正在编辑的单据</div>
      <div class="t-sub" style="margin-bottom:12px">可能是刚打开程序。回到单据中心重新选一份。</div>
      <button class="btn" onclick="UI.go('docs')">去单据中心</button></div>`;
  }
  const blocked = Store.blocked();
  const isNew = !QuoteEdit.id;
  const type = d.type || 'QT';
  const isPL = type === 'PL';
  const ps = Store.products();
  const t = Doc.computeTotals();
  const typeName = Doc.TYPE_CN[type] || type;

  /* 顶部信息条 */
  const head = `
    <div class="qe-head">
      <div class="qe-head-l">
        <button class="btn ghost" onclick="Doc.requestLeave()">← 单据中心</button>
        <span class="qe-no">${isNew ? '新' + typeName + '（保存后分配单号）' : esc(d.no || '') + ' · ' + esc(typeName)}</span>
        <span class="qe-dirty" id="qe_dirty">${QuoteEdit.dirty ? '● 有未保存的修改' : '已保存'}</span>
      </div>
      <div class="qe-head-r">
        <span class="qe-date">日期 ${esc(d.date || '')}</span>
        <button class="btn ghost" data-export-pdf onclick="Doc.exportPdf('${isNew ? '' : jid(d.id)}')">导出 PDF</button>
        <button class="btn ghost" onclick="${isNew || QuoteEdit.dirty ? 'UI.toast(\'先保存再打印\')' : `Doc.print('${jid(d.id)}')`}">打印 / PDF</button>
        ${isNew ? '' : `<button class="btn ghost" onclick="Doc.askConvert('${jid(d.id)}')">复制 / 转换</button>`}
        <button class="btn" id="qe_save" onclick="Doc.save()" ${blocked ? 'disabled style="opacity:.55;cursor:default"' : ''}>${isNew ? '保存' + typeName : '保存修改'}</button>
      </div>
    </div>`;

  /* 复制/转换带来的核对提示（银行/包装/运输/条款） */
  const hintsBar = (QuoteEdit.hints && QuoteEdit.hints.length) ? `
    <div class="notice-bar"><div class="notice-item n-warn">
      <b>这份草稿是从别的单据带过来的，请核对：</b><br>${QuoteEdit.hints.map(h => '· ' + esc(h)).join('<br>')}
    </div></div>` : '';

  /* 历史合计差异提示（打开与取消都不重算落盘；PL 无金额不涉及） */
  const curDoc = isNew ? null : Store.getDocument(QuoteEdit.id);
  const differNote = (!isPL && curDoc && Doc.totalsDiffer(curDoc)) ? `
    <div class="notice-bar"><div class="notice-item n-warn">
      <b>这张单的原合计 ${money(curDoc.totals.grand, curDoc.currency || 'USD')} 与按明细计算的 ${money(MODEL.documentTotals((curDoc.items || []).map(it => ({ amount: MODEL.round2((+it.qty || 0) * (+it.price || 0)) }))).grand, curDoc.currency || 'USD')} 不一致（旧数据原样保留）。只是打开或取消不会改它；修改后保存会按明细重算，保存前会再跟你确认一次。</b>
    </div></div>` : '';

  /* 客户区 + 买方地址 */
  const cust = Doc.custSectionHTML(d);
  const custAddr = `
    <div class="form-row"><label>买方地址 / 联系人</label>
      <textarea class="inp" rows="2" placeholder="收货或联系地址；换客户会清空（不串到下一个客户）" oninput="Doc.termField('buyerAddress', this.value)">${esc(d.buyerAddress || '')}</textarea></div>
    ${(d.customer && d.customer.id && String(d.customer.address || '').trim()) ? `<div class="t-sub" style="margin-top:6px">客户库里有这个客户的地址：<button class="btn ghost" style="padding:4px 10px;font-size:12.5px" onclick="Doc.importCustAddress()">带入这一单</button>（带上后仍可改，不反写客户库）</div>` : ''}`;

  /* 卖方快照区（A2：纸面只读单据快照；设置页改动不追溯历史单） */
  const s = d.seller || null;
  const sellerCard = s && (String(s.company || '').trim() || String(s.contact || '').trim() || String(s.address || '').trim())
    ? `<div class="qe-cust-card"><div>
        <div class="t-main">${esc(s.company || '（未填公司名）')}</div>
        <div class="t-sub">${esc(s.contact || '')}${String(s.address || '').trim() ? ' · ' + esc(s.address) : ''} · 已存进这张单的快照</div>
      </div>
      <div class="qe-cust-btns"><button class="btn ghost" onclick="Doc.refreshSeller()">刷新卖方信息</button></div></div>`
    : `<div class="qe-cust-card"><div>
        <div class="t-main" style="color:#b45309">卖方信息待补</div>
        <div class="t-sub">纸面抬头会印「（待补：卖方信息）」，不会编造地址。在「设置」填好公司/联系方式/地址后，点右边按钮写入这张单。</div>
      </div>
      <div class="qe-cust-btns"><button class="btn ghost" onclick="Doc.refreshSeller()">从设置页带入卖方信息</button></div></div>`;

  /* 明细行 + 汇总 */
  const itemRows = (d.items || []).map((it, i) => Doc.itemRowHTML(it, i, ps, d)).join('');
  const sumBlock = isPL ? Doc.plSumHTML(d) : `
        <div class="qe-total">
          <div class="qe-total-num">合计 <b id="qe_total">${t.blocked ? '待修正' : money(t.grand, d.currency || 'USD')}</b></div>
          <div class="t-sub">计算口径：行金额 = 数量 × 单价，四舍五入到分；合计 = 各行金额相加后再舍入到分。边界样例：3 × 1.005 = 3.01。</div>
        </div>`;

  /* PL：包装模式三态（系统不替用户判断是否混装） */
  const packBlock = isPL ? `
      <div class="card qe-card">
        <div class="card-h"><span>包装方式</span><span class="todo-badge">系统不替你判断，按实际装箱选</span></div>
        <div class="form-row"><label>本单是否存在混装</label>
          <select class="inp" onchange="Doc.setPackagingMode(this.value)">
            <option value=""${d.packagingMode == null ? ' selected' : ''}>（待确认）</option>
            <option value="separate"${d.packagingMode === 'separate' ? ' selected' : ''}>各行包装不重叠（总件数 = 各行件数相加）</option>
            <option value="mixed"${d.packagingMode === 'mixed' ? ' selected' : ''}>存在混装（多行货同箱，总件数按整单填）</option>
          </select>
        </div>
        ${d.packagingMode === 'mixed' ? `
        <div class="form-row"><label>整单总包装件数</label>
          <input class="inp num" type="number" min="1" step="1" placeholder="正整数，例如 58" value="${d.totalPackages == null ? '' : d.totalPackages}" oninput="Doc.setTotalPackages(this.value)">
        </div>
        <div class="t-sub">混装时逐行件数只作参考、不进总件数；总件数以这里填的为准。</div>` : ''}
        <div class="t-sub">每行的净重 / 毛重 / 体积填的是<b>这一行货物的合计</b>，不是每箱多少；留空 = 待补（草稿可以存），填 0 或负数会被拒，不按数量估算。</div>
      </div>` : '';

  /* 条款区：公共四项 + 类型特有 */
  const bankBlock = (type === 'PI' || type === 'SC' || type === 'CI') ? `
        <div class="form-row"><label>银行资料</label>
          <textarea class="inp" rows="3" placeholder="Beneficiary / Bank / Account / SWIFT——只作填写提示，真实资料由你自己录入；空着纸面就不印这一块" oninput="Doc.termField('bank', this.value)">${esc(d.bank || '')}</textarea></div>` : '';
  const shipBlock = (type === 'CI') ? `
        <div class="form-2">
          <div class="form-row"><label>运输方式</label><input class="inp" value="${esc(d.shipment || '')}" placeholder="如 By Sea / By Air（待补留空）" oninput="Doc.termField('shipment', this.value)"></div>
          <div class="form-row"><label>船名 / 航次</label><input class="inp" value="${esc(d.vessel || '')}" placeholder="未知就留空，纸面印（待补）" oninput="Doc.termField('vessel', this.value)"></div>
        </div>
        <div class="form-row"><label>原产地声明</label><input class="inp" value="${esc(d.origin || '')}" placeholder="你填什么纸面印什么，系统不核实也不生成" oninput="Doc.termField('origin', this.value)"></div>` : '';
  const scBlock = (type === 'SC') ? `
        <div class="form-2">
          <div class="form-row"><label>签订日期</label><input class="inp" type="date" value="${esc(d.signDate || '')}" oninput="Doc.termField('signDate', this.value)"></div>
          <div class="form-row"><label>签订地点</label><input class="inp" value="${esc(d.signPlace || '')}" oninput="Doc.termField('signPlace', this.value)"></div>
        </div>
        <div class="form-row"><label>合同条款</label>
          <textarea class="inp" rows="6" placeholder="按双方约定自行录入。可参考分条写：质量约定 / 付款约定 / 交付约定 / 其他约定。本工具不预设法院、责任或保证等法律措辞，也不替你审定。" oninput="Doc.termField('contractTerms', this.value)">${esc(d.contractTerms || '')}</textarea></div>
        <div class="t-sub">条款区为空时纸面印「（待补：未填写合同条款）」，不套任何默认模板。</div>` : '';
  const marksBlock = isPL ? `
        <div class="form-row"><label>唛头 / 包装说明</label>
          <textarea class="inp" rows="2" placeholder="Shipping Marks；通常发货前才定，留空纸面印（待补）" oninput="Doc.termField('marks', this.value)">${esc(d.marks || '')}</textarea></div>` : '';

  /* ---- P1-D-05：按原版 RunCheng V2 单页 Workbench 重排 ----
   * 自上而下：①顶部操作栏（head，页面级）②报价计算参数 ③风险提示 ④产品明细卡片
   * ⑤明细下方两列（左：订单汇总 / 折扣及其他费用 / 一次性费用；右：运费面板）
   * ⑥底部客户信息与订单条款；复杂内部核算折叠到「内部核价」区。右侧 A4 实时预览保留。
   * 铁律：全部可编辑字段与写入链一个不删、不新增（fx / incoterm 仍各只有一个入口），
   * 只是移动位置；卡片 id / 标题保持不变，五类单据转换与成交价保护不受影响。 */
  const custList = Store.customers();
  const curCustId = (d.customer && d.customer.id) ? String(d.customer.id) : '';
  const custDD = `
        <div class="form-row"><label>关联客户（选一下就好；资料按值快照进单据，之后改客户库不影响这张单）</label>
          <select class="inp" onchange="Doc.custDropdown(this.value)">
            <option value=""${!curCustId && QuoteEdit.custMode !== 'manual' ? ' selected' : ''}>（选择客户…）</option>
            ${custList.map(x => `<option value="${jid(x.id)}"${curCustId === String(x.id) ? ' selected' : ''}>${esc(x.company || x.name || '（未命名客户）')}${x.country ? ' · ' + esc(x.country) : ''}</option>`).join('')}
            <option value="__manual"${QuoteEdit.custMode === 'manual' ? ' selected' : ''}>✎ 手填客户信息（不关联客户库）</option>
          </select>
        </div>`;

  /* P2-01：客户第一步 —— 选中客户后把资料**填进可编辑表单**（润成式：先选，再在表里改）。
     可编辑仅限单据快照字段（公司/联系人/国家/地址）；邮箱/电话/WhatsApp 只作参考显示，
     不进单据快照（P1-D-02 保护要求）。 */
  const custLib = (d.customer && d.customer.id) ? Store.customers().find(function (x) { return x.id === d.customer.id; }) : null;
  const cc = d.customer || {};
  const bc = Doc.buyerContactOf ? Doc.buyerContactOf() : { email: '', phone: '', whatsapp: '' };
  const custStep = `
    <div class="card qe-card rc-card p2-step-card" id="rc_customer_card">
      <div class="card-h">
        <span><b class="p2-step-no">1</b> 选择客户 Buyer</span>
        <span class="todo-badge">先选客户，资料自动填进下面；没有的项自己补。保存的是本单快照，之后改客户库不影响这张单</span>
      </div>
      ${custDD}
      <div class="p2-cust-two">
        <div class="p2-cust-form">
          <div class="form-row"><label>公司名称 Company</label>
            <input class="inp" value="${esc(cc.company || '')}" placeholder="选客户后自动带入，也可以直接填" oninput="Doc.custField('company', this.value)"></div>
          <div class="form-2">
            <div class="form-row"><label>联系人 Contact</label>
              <input class="inp" value="${esc(cc.name || '')}" placeholder="如 Tom" oninput="Doc.custField('name', this.value)"></div>
            <div class="form-row"><label>国家 / 地区 Country</label>
              <input class="inp" value="${esc(cc.country || '')}" placeholder="如 United States" oninput="Doc.custField('country', this.value)"></div>
          </div>
          <div class="form-2">
            <div class="form-row"><label>邮箱 Email</label>
              <input class="inp" value="${esc(bc.email)}" placeholder="如 buyer@example.com" oninput="Doc.custField('buyerContact.email', this.value)"></div>
            <div class="form-row"><label>电话 Phone</label>
              <input class="inp" value="${esc(bc.phone)}" placeholder="如 +971 50 123 4567" oninput="Doc.custField('buyerContact.phone', this.value)"></div>
            <div class="form-row"><label>WhatsApp</label>
              <input class="inp" value="${esc(bc.whatsapp)}" placeholder="如 +971 50 123 4567" oninput="Doc.custField('buyerContact.whatsapp', this.value)"></div>
          </div>
          <div class="form-row"><label>买方地址 / 收货信息 Address</label>
            <textarea class="inp" rows="2" placeholder="收货或联系地址；换客户会清空" oninput="Doc.termField('buyerAddress', this.value)">${esc(d.buyerAddress || '')}</textarea></div>
        </div>
        <div class="p2-cust-side">
          <div class="p2-side-t">客户档案</div>
          ${custLib ? `
            <div class="p2-kv-row"><span>类型 / 来源</span><b>${esc((custLib.customerType || '—') + (custLib.source ? ' · ' + custLib.source : ''))}</b></div>
            <div class="p2-kv-row"><span>网站</span><b>${esc(custLib.website || '—')}</b></div>
            <div class="p2-kv-row"><span>备注</span><b>${esc(custLib.notes || '—')}</b></div>
            <button class="btn ghost" style="margin-top:8px;padding:5px 12px;font-size:12.5px" onclick="Doc.viewCustomer()">查看完整客户资料</button>`
            : `<div class="t-sub" style="padding:6px 0">还没有关联客户档案（手填或未选择）。可以从上面下拉选一个已有客户。</div>`}
          <div class="t-sub" style="margin-top:8px">买方 6 项 + 地址按 V2 口径；邮箱/电话/WhatsApp 存在本单扩展字段，<b>不写回客户库</b>。</div>
        </div>
      </div>
      <details class="p2-cust-more">
        <summary>搜索其他客户 / 手填客户信息</summary>
        <div style="margin-top:8px">${Doc.custSectionHTML(d)}</div>
      </details>
    </div>`;

  /* ② 顶部报价计算参数条（PL 无定价参数，按原样隐藏）。 */
  const paramsBar = isPL ? '' : P1C.pricingParamsBarHTML(d);
  /* 订单信息卡也要读 IncoTerm / 交货地点（与参数条同源，只读引用） */
  const po = isPL ? { incoterm: '', namedPlace: '' } : P1C.pricingExtView(d);

  /* ③ 风险提示区域：只读派生状态 + 原有的转换 / 合计差异提示，不新增任何写入口。 */
  const riskItems = (() => {
    const its = (d.items || []).filter(x => x && typeof x === 'object');
    const unconfirmed = isPL ? 0 : its.filter(x => x.costConfirmed !== true).length;
    const noReal = its.filter(x => !(x._unknown && x._unknown.realImage)).length;
    const bits = ['· 明细 ' + its.length + ' 行' + (isPL ? '（PL 不做成本 / 核价）' : '，成本未确认 ' + unconfirmed + ' 行')];
    if (!isPL && d.currency && d.currency !== 'USD') bits.push('· 币种 ' + esc(d.currency) + '：定价引擎仅支持 USD，自动核价停用');
    if (!isPL && QuoteEdit.pricingStale) bits.push('· 参数或明细改过，核价结果已过期，请重新核价');
    if (noReal) bits.push('· ' + noReal + ' 行未设置实物图：客户纸面 PHOTO 将显示 NO IMAGE（绝不拿规格图冒充）');
    if (!isPL) bits.push('· 亏损订单个人提成为 0（zero_on_loss），由定价引擎固定执行');
    if (hintsBar) bits.push('· 转换草稿的银行 / 包装 / 运输 / 条款已在上方逐项列出');
    return bits.join('<br>');
  })();
  const riskBar = `
    <div class="card qe-card rc-risk" id="rc_risk_bar">
      <div class="card-h"><span>⚠ 风险提示</span><span class="todo-badge">只读状态汇总；系统不自动改数据</span></div>
      <div class="rc-risk-list">
        ${hintsBar}
        ${differNote}
        <div class="rc-risk-row">${riskItems}</div>
      </div>
    </div>`;

  /* ⑤ 明细下方两列：左订单汇总 / 折扣及其他费用 / 一次性费用，右运费面板（PL 全无）。 */
  const bottomCols = isPL ? '' : `
    <div class="rc-cols">
      <div class="rc-col">
        ${sumBlock}
        ${P1C.extraPanelHTML(d)}
        ${P1C.feesPanelHTML(d)}
      </div>
      <div class="rc-col">
        ${P1C.freightPanelHTML(d)}
      </div>
    </div>`;

  /* 复杂内部核算细节统一折叠：高级参数 + 核价汇总（PL 不渲染，保持零内部核价界面）。 */
  const internalBlock = isPL ? '' : `
    <details class="rc-internal">
      <summary>内部核价（高级参数 / 核价汇总，默认收起）</summary>
      ${P1C.advancedParamsHTML(d)}
      ${P1C.pricingResultCardHTML(d)}
    </details>`;

  const editor = `
    <div class="qe-pane" data-pane="edit">
      ${custStep}
      ${riskBar}
      ${paramsBar}

      <div class="card qe-card rc-card" id="rc_items_card">
        <div class="card-h"><span>产品明细与成本</span><span class="todo-badge">${isPL ? '包装四件套按实际装箱填，留空=待补' : '从产品库选规格加入，或行内手填；每行内部成本默认收起'}</span></div>
        ${isPL ? '' : Doc.productPickerHTML(ps)}
        <div class="qe-items">${itemRows}</div>
        <button class="btn ghost" style="margin-top:10px;padding:6px 14px;font-size:13px" onclick="Doc.addRow()">＋ 添加一行</button>
        ${isPL ? sumBlock : ''}
      </div>

      ${packBlock}

      ${bottomCols}
      ${internalBlock}

      <div class="card qe-card rc-card" id="rc_order_card">
        <div class="card-h"><span>订单信息</span><span class="todo-badge">客户信息及订单条款放在页面底部（原版 RunCheng 口径）</span></div>
        ${sellerCard}
        <div class="rc-sep"></div>
        <div class="form-2">
          <div class="form-row"><label>贸易条款 / 港口</label>
            <input class="inp" list="qe_terms" value="${esc(d.term || '')}" placeholder="空着纸面印（待补），不默认 FOB Tianjin" oninput="Doc.termField('term', this.value)">
            <datalist id="qe_terms"><option>FOB Tianjin</option><option>FOB Qingdao</option><option>CIF Dubai</option><option>CFR Jebel Ali</option><option>EXW Anping</option></datalist>
          </div>
          <div class="form-row"><label>币种</label>
            <select class="inp" onchange="Doc.termField('currency', this.value)">
              ${['USD', 'CNY', 'EUR'].map(c => `<option${d.currency === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-2">
          <div class="form-row"><label>贸易术语 IncoTerm</label>
            <select class="inp" onchange="P1C.setIncoterm(this.value)">
              <option value=""${po.incoterm ? '' : ' selected'}>（待选择）</option>
              ${P1C.TERMS().map(t => `<option value="${t}"${po.incoterm === t ? ' selected' : ''}>${t}</option>`).join('')}
            </select></div>
          <div class="form-row"><label>交货地点 Named Place</label>
            <input class="inp" placeholder="${po.incoterm === 'EXW' ? '如 Anping（EXW 也建议填写）' : (po.incoterm ? '如 Ningbo / Shanghai' : '选择术语后填写')}" value="${esc(po.namedPlace)}" oninput="P1C.setNamedPlace(this.value)"></div>
        </div>
        <div class="form-2">
          <div class="form-row"><label>运费加价率 Freight Markup（0.1 = 10%）</label>
            <input class="inp num" type="number" min="0" step="0.01" placeholder="留空=不加价" value="${d.freightMarkup == null ? '' : d.freightMarkup}" oninput="P1C.setPricingParam('freightMarkup', this.value)"></div>
          <div class="form-row"><label>订金比例 Deposit Ratio（0.3 = 30%）</label>
            <input class="inp num" type="number" min="0" max="1" step="0.05" placeholder="如 0.3" value="${esc(Doc.orderExtOf('depositRatio'))}" oninput="Doc.custField('orderInfo.depositRatio', this.value)"></div>
        </div>
        <div class="form-row"><label>包装要求 Packaging</label>
          <input class="inp" placeholder="如 每片独立气泡膜 + 木箱；纸面 Packaging 栏按此印刷" value="${esc(Doc.orderExtOf('packaging'))}" oninput="Doc.custField('orderInfo.packaging', this.value)"></div>
        <div class="form-2">
          <div class="form-row"><label>付款方式</label><input class="inp" value="${esc(d.payment || '')}" oninput="Doc.termField('payment', this.value)"></div>
          <div class="form-row"><label>报价有效期</label><input class="inp" value="${esc(d.validity || '')}" placeholder="只表示报价有效期" oninput="Doc.termField('validity', this.value)"></div>
        </div>
        <div class="form-row"><label>交货期 / 交付约定</label><input class="inp" value="${esc(d.delivery || '')}" placeholder="与「有效期」分开存、分开印；不从有效期反推" oninput="Doc.termField('delivery', this.value)"></div>
        ${shipBlock}
        ${bankBlock}
        ${scBlock}
        ${marksBlock}
        <div class="form-row"><label>备注及不含项目 Exclusions / Notes</label><textarea class="inp" rows="2" oninput="Doc.termField('remark', this.value)">${esc(d.remark || '')}</textarea></div>
        ${isPL ? '<div class="rc-sep"></div>' + Doc.templateSelectHTML() : ''}
      </div>
    </div>

    <div class="qe-pane preview" data-pane="preview">
      <div class="qe-preview-bar">
        <span class="t-sub">可编辑 A4 预览：点击虚线框直接修改，回车确认；金额和孔径自动计算</span>
        <span class="qe-zoom-tools"><button class="btn ghost" onclick="Doc.previewZoom(-0.1)" title="缩小预览">−</button><b id="qe_zoom_label">${Math.round(QuoteEdit.previewZoom * 100)}%</b><button class="btn ghost" onclick="Doc.previewZoom(0.1)" title="放大预览">＋</button><button class="btn ghost" onclick="Doc.resetPreviewZoom()">适合窗口</button></span>
        <button class="btn ghost" style="padding:5px 12px;font-size:12.5px" onclick="${isNew || QuoteEdit.dirty ? 'UI.toast(\'先保存再全屏打印\')' : `Doc.print('${jid(d.id)}')`}">全屏预览 / 打印</button>
      </div>
      <div class="qe-preview-scroll"><div id="qe_preview" style="--qe-preview-zoom:${QuoteEdit.previewZoom}">${Doc.sheetHTML(d, true)}</div></div>
    </div>`;

  /* P1-D-05：hintsBar / differNote 已并入左栏「风险提示」区，页面级只留操作栏。 */
  return head + `
    <div class="qe-seg" id="qe_seg">
      <button class="seg-btn" id="qe_seg_edit" onclick="Doc.setPane('edit')">编辑</button>
      <button class="seg-btn" id="qe_seg_preview" onclick="Doc.setPane('preview')">预览</button>
    </div>
    <div class="qe-split">${editor}</div>`;
};
/* 编辑器附属：客户区 / 明细行 / 条款字段（挂在 Doc 上保持 pages.js 结构清晰） */
Doc.custSectionHTML = function (d) {
  const c = d.customer || {};
  if (QuoteEdit.custMode === 'card' && (c.company || c.name)) {
    return `<div class="qe-cust-card">
      <div>
        <div class="t-main">${esc(c.company || c.name || '（未填写）')}</div>
        <div class="t-sub">${esc(c.name || '')}${c.country ? ' · ' + esc(c.country) : ''}${c.id ? ' · 已关联客户库' : ' · 手填快照（未关联）'}</div>
      </div>
      <div class="qe-cust-btns">
        ${c.id ? `<button class="btn ghost" onclick="Doc.refreshCust()">刷新为客户当前资料</button>` : ''}
        <button class="btn ghost" onclick="Doc.changeCust()">更换客户</button>
      </div>
    </div>`;
  }
  if (QuoteEdit.custMode === 'manual') {
    return `<div class="qe-cust-manual">
      <div class="t-sub" style="margin-bottom:10px">手填的客户信息只存进这张单据，不进客户库。</div>
      <div class="form-row"><label>公司名称</label><input class="inp" id="qe_custCompany" value="${esc(c.company || '')}" oninput="Doc.custField('company', this.value)"></div>
      <div class="form-2">
        <div class="form-row"><label>联系人</label><input class="inp" value="${esc(c.name || '')}" oninput="Doc.custField('name', this.value)"></div>
        <div class="form-row"><label>国家 / 地区</label><input class="inp" value="${esc(c.country || '')}" oninput="Doc.custField('country', this.value)"></div>
      </div>
      <button class="btn ghost" style="margin-top:4px;padding:6px 14px;font-size:13px" onclick="Doc.changeCust()">从客户库选一个</button>
    </div>`;
  }
  /* 选择器 */
  const q = QuoteEdit.custQuery.trim().toLowerCase();
  const all = Store.customers();
  const list = q ? all.filter(x => (x.name + ' ' + (x.company || '') + ' ' + (x.country || '') + ' ' + (x.note || '')).toLowerCase().includes(q)) : all;
  return `
    <input class="inp" id="qe_custSearch" placeholder="搜客户名 / 公司 / 国家，点一下选进来" value="${esc(QuoteEdit.custQuery)}" oninput="Doc.searchCust(this.value)">
    <div class="qe-cust-list">
      ${list.slice(0, 8).map(x => `
        <div class="qe-cust-opt" onclick="Doc.pickCust('${jid(x.id)}')">
          <b>${esc(x.company || x.name)}</b>
          <span class="t-sub">${esc(x.name || '')}${x.country ? ' · ' + esc(x.country) : ''}</span>
        </div>`).join('') || '<div class="t-sub" style="padding:10px 4px">没匹配的客户，可以先「手填客户信息」</div>'}
      <div class="qe-cust-opt manual" onclick="Doc.manualCust()">✎ 手填客户信息（不关联客户库，只存进这张单）</div>
    </div>`;
};

/* 纸面模板选择（P1-D-02：从原「条款与备注」卡提取；五类单据共用，PL 也不可少）
   P1-D-04：五类单据统一为 RunCheng 黑白版式（quotation-rc-v1）并作为默认值，
   因此下拉里不再按单据类型显示/隐藏 RC 选项，也不再提示「仅适用于报价单」。 */
Doc.templateSelectHTML = function () {
  const cur = Doc.templateId();
  return `
        <div class="form-row"><label>纸面模板（对外输出版式）</label>
          <select class="inp" onchange="Doc.setTemplate(this.value)">
            <option value="quotation-rc-v1"${cur === 'quotation-rc-v1' ? ' selected' : ''}>RunCheng 统一版式（quotation-rc-v1，五类单据通用）</option>
            <option value="basic-v1"${cur === 'basic-v1' ? ' selected' : ''}>基础单据版（basic-v1）</option>
            <option value="trade-v1"${cur === 'trade-v1' ? ' selected' : ''}>贸易报价版（trade-v1）</option>
          </select>
          <button class="btn ghost" style="margin-top:8px" onclick="Doc.openTemplateEditor()">筛选 / 修改模板</button>
          <div class="t-sub">当前模板：${esc(Doc.templateName())}。可以隐藏自定义列并修改模板名称；模板只改变纸面布局，不改变金额和数据规则。</div>
        </div>`;
};

/* ---------- P1-D-02：RunCheng 式简洁入口（纯新增，不改任何既有写入链） ----------
 * · 客户下拉：RunCheng QuoteEditor 的主入口形态。选中 → Doc.pickCust（快照语义/清地址/确认弹窗链全部照旧）；
 *   「手填」选项 → Doc.manualCust。原搜索选择器与卡片/手填三模式全部保留，互不替代。
 * · 产品卡片搜索：RunCheng 的「从产品库添加」形态。添加 = Doc.addRow() + Doc.pickProduct(新行, pid)，
 *   与逐行下拉写入同一条校验链；不绕过成本快照、markStale 或保存校验。
 * · 客户快照边界（P1-D-02 保护要求一）：单据快照只存 id/name/company/country/address
 *   （V5 既有结构）。email/phone/whatsapp 等客户库字段**不**带入单据显示——单据层没有
 *   这些快照键，界面上显示只能实时读客户库，会让历史单随客户资料变化；不升级 Schema，
 *   故维持原有字段方式（如实披露于 P1-D-02 报告）。 */
Doc.custDropdown = function (v) {
  if (v === '__manual') { Doc.manualCust(); return; }
  if (v) Doc.pickCust(v);
};
Doc.prodSearch = function (v) {
  QuoteEdit.prodQuery = String(v == null ? '' : v);
  UI.render();
  const inp = document.getElementById('qe_prodSearch');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
};
Doc.addProductFromLibrary = function (pid) {
  const d = QuoteEdit.draft;
  if (!d || !pid) return;
  Doc.addRow();
  Doc.pickProduct(d.items.length - 1, pid);
  QuoteEdit.prodQuery = '';
};
Doc.prodSearchHTML = function (ps) {
  const q = String(QuoteEdit.prodQuery || '').trim().toLowerCase();
  if (!q) return `<input class="inp" id="qe_prodSearch" placeholder="搜产品库快速添加：名称 / 编码 / 类别 / 目数（也可以直接在下方行内手填或用行内下拉）" value="" oninput="Doc.prodSearch(this.value)">`;
  const hits = ps.filter(p => ((p.nameCn || '') + ' ' + (p.nameEn || '') + ' ' + (p.sku || '') + ' ' + (p.category || '') + ' ' + String(p.mesh || '')).toLowerCase().includes(q)).slice(0, 6);
  return `
    <input class="inp" id="qe_prodSearch" placeholder="搜产品库快速添加：名称 / 编码 / 类别 / 目数" value="${esc(QuoteEdit.prodQuery || '')}" oninput="Doc.prodSearch(this.value)">
    <div class="rc-prod-grid">
      ${hits.map(p => `
        <div class="rc-prod-opt" onclick="Doc.addProductFromLibrary('${jid(p.id)}')" title="添加一行并带入产品资料（规格/成本/单价快照，不反写产品库）">
          <div class="t-main">${esc(p.nameCn || '（未命名产品）')}</div>
          <div class="t-sub">${p.mesh ? esc(String(p.mesh)) + '目 · ' : ''}${p.price ? esc(money(p.price)) + '/' + esc(String(p.unit || '单位待补')) : '单价待补'}${p.sku ? ' · ' + esc(p.sku) : ''}</div>
        </div>`).join('') || '<div class="t-sub" style="padding:8px 4px">没匹配的产品——可以直接在下方行内手填，或先去「产品资料」建产品</div>'}
    </div>`;
};

/* ---------- P2-01：产品选择卡片（图片网格 + 分类筛选 + 规格/颜色/材质/型号） ----------
 * 复用既有写入链：Doc.addProductFromLibrary → addRow + pickProduct（成本快照 / 校验 / markStale 全不动）。
 * 颜色/材质/型号合并写进该行 specText（规格描述），不新增 Schema 字段、不反写产品库。 */
Doc.prodCatPick = function (c) {
  QuoteEdit.prodCat = String(c == null ? '' : c);
  UI.render();
};
Doc.productPickerHTML = function (ps) {
  const q = String(QuoteEdit.prodQuery || '').trim().toLowerCase();
  const cat = String(QuoteEdit.prodCat || '');
  const cats = Array.from(new Set(ps.map(function (p) { return String(p.category || '').trim(); }).filter(Boolean)));
  const matched = ps.filter(function (p) {
    if (cat && String(p.category || '').trim() !== cat) return false;
    if (!q) return true;
    const hay = ((p.nameCn || '') + ' ' + (p.nameEn || '') + ' ' + (p.sku || '') + ' ' + String(p.mesh || '') + ' ' + (p.category || '')).toLowerCase();
    return hay.indexOf(q) >= 0;
  });
  /* P2-01：首屏只展示一屏能看全的数量，避免网格把明细区推到很下面；
     搜索或选分类时放宽到 12 个。 */
  const LIMIT = (q || cat) ? 12 : 8;
  const list = matched.slice(0, LIMIT);
  const thumbOf = function (p) {
    try {
      const arr = (typeof Store.productImagesOf === 'function') ? Store.productImagesOf(p.id) : [];
      return (arr && arr[0] && arr[0].data) ? arr[0].data : (p.imageData || p.realImageData || '');
    } catch (e) { return p.imageData || ''; }
  };
  return `
    <div class="p2-pick">
      <div class="p2-pick-head">
        <input class="inp" id="qe_prodSearch" placeholder="搜索产品：名称 / 编码 / 分类 / 目数" value="${esc(QuoteEdit.prodQuery || '')}" oninput="Doc.prodSearch(this.value)">
        <button class="btn ghost" onclick="Doc.addRow()">＋ 临时产品</button>
      </div>
      <div class="p2-cats">
        <button class="p2-cat${cat ? '' : ' on'}" onclick="Doc.prodCatPick('')">全部分类</button>
        ${cats.map(function (c) { return `<button class="p2-cat${cat === c ? ' on' : ''}" onclick="Doc.prodCatPick('${esc(c).replace(/'/g, '&#39;')}')">${esc(c)}</button>`; }).join('')}
      </div>
      ${!q && !cat ? '<div class="t-sub" style="padding:4px 2px 2px">输入产品名称 / 编码，或点上面的分类，才会列出产品卡片（和润成一样，不搜索时不铺网格）。</div>' : ''}
      ${(!q && !cat) ? '' : (list.length ? `<div class="p2-grid">${list.map(function (p) {
        const th = thumbOf(p);
        return `<div class="p2-card" onclick="Doc.openProductAdd('${jid(p.id)}')" title="点击选择规格并加入报价">
          <div class="p2-thumb">${th ? `<img src="${th}" alt="">` : '<span>无图</span>'}</div>
          <div class="p2-card-name">${esc(p.nameCn || p.nameEn || '（未命名）')}</div>
          <div class="p2-card-meta">${esc(p.sku || '')}${p.unit ? ' · ' + esc(p.unit) : ''}${p.price ? ' · ' + money(p.price) : ''}</div>
          <div class="p2-card-add">选择规格 →</div>
        </div>`;
      }).join('')}</div>` : '<div class="t-sub" style="padding:10px 4px">没有匹配的产品；可以点「＋ 临时产品」手填，或去「产品资料」新建。</div>')}
      <div class="t-sub" style="margin-top:8px">选中产品后可填颜色 / 材质 / 型号 / 数量 / 单位；只写进本行规格，不反写产品库。${matched.length > list.length ? `　·　共匹配 ${matched.length} 个，先显示 ${list.length} 个，可用搜索或分类缩小范围` : ''}</div>
    </div>`;
};
Doc.openProductAdd = function (pid) {
  const p = Store.products().find(function (x) { return x.id === pid; });
  if (!p) { UI.toast('产品不存在，请重新搜索'); return; }
  const cur = String(p.specText || '');
  UI.openModal('加入报价：' + (p.nameCn || p.nameEn || ''), `
    <div class="p2-add-head">
      ${(function () { try { const a = Store.productImagesOf(p.id); return (a[0] && a[0].data) ? `<img src="${a[0].data}">` : ''; } catch (e) { return ''; } })()}
      <div><div class="t-main">${esc(p.nameCn || '')}</div>
      <div class="t-sub">${esc(p.sku || '')}${p.category ? ' · ' + esc(p.category) : ''}${p.price ? ' · 参考 ' + money(p.price) : ''}</div></div>
    </div>
    <div class="form-2">
      <div class="form-row"><label>颜色</label><input class="inp" id="p2_color" value="${esc(p.color || '')}" placeholder="如 White / 双色"></div>
      <div class="form-row"><label>材质</label><input class="inp" id="p2_material" value="${esc(p.material || '')}" placeholder="如 PVC / WPC"></div>
    </div>
    <div class="form-row"><label>型号 / 规格</label><input class="inp" id="p2_spec" value="${esc(cur)}" placeholder="如 1.5×2.5m 三横梁"></div>
    <div class="form-2">
      <div class="form-row"><label>数量</label><input class="inp num" id="p2_qty" type="number" min="0" step="1" value="1"></div>
      <div class="form-row"><label>单位</label><input class="inp" id="p2_unit" value="${esc(p.unit || '')}" placeholder="set / panel / m"></div>
    </div>
    <div class="form-row"><label>成交单价（可留空）</label><input class="inp num" id="p2_price" type="number" min="0" step="0.01" placeholder="留空 = 由系统建议价决定"></div>
    <div class="t-sub">颜色/材质/型号会合并写进这一行的「规格描述」；成本仍走内部成本区，不在这里填。</div>`,
    [{ text: '取消', cls: 'ghost', onclick: 'UI.closeModal()' },
     { text: '加入报价', onclick: "Doc.confirmProductAdd('" + jid(p.id) + "')" }]);
};
Doc.confirmProductAdd = function (pid) {
  const val = function (id) { const el = document.getElementById(id); return el ? String(el.value == null ? '' : el.value) : ''; };
  const color = val('p2_color').trim();
  const material = val('p2_material').trim();
  const spec = val('p2_spec').trim();
  const qty = val('p2_qty').trim();
  const unit = val('p2_unit').trim();
  const price = val('p2_price').trim();
  Doc.addProductFromLibrary(pid);
  const d = QuoteEdit.draft;
  const i = (d.items || []).length - 1;
  if (i < 0) { UI.closeModal(); return; }
  const parts = [material, color, spec].filter(Boolean);
  if (parts.length) Doc.setField(i, 'specText', parts.join(' / '));
  if (unit) Doc.setField(i, 'unit', unit);
  if (qty !== '') Doc.setField(i, 'qty', qty);
  if (price !== '') Doc.setField(i, 'price', price);
  UI.closeModal();
  UI.render();
  UI.toast('已加入报价：' + ((d.items[i] && (d.items[i].nameCn || d.items[i].nameEn)) || ''));
  /* 加入后自动定位到这一行，省得用户往下翻找 */
  setTimeout(function () {
    const el = document.getElementById('qe_f_' + i + '_qty');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }, 60);
};
Doc.viewCustomer = function () {
  const d = QuoteEdit.draft;
  const c = (d && d.customer) || {};
  const lib = c.id ? Store.customers().find(function (x) { return x.id === c.id; }) : null;
  const rows = [
    ['公司', (lib && lib.company) || c.company],
    ['联系人', (lib && lib.name) || c.name],
    ['国家 / 地区', (lib && lib.country) || c.country],
    ['邮箱', lib && lib.email], ['电话', lib && lib.phone],
    ['WhatsApp', lib && lib.whatsapp], ['网站', lib && lib.website],
    ['客户类型', lib && lib.customerType], ['来源', lib && lib.source],
    ['备注', lib && lib.notes]
  ].filter(function (r) { return String(r[1] == null ? '' : r[1]).trim(); });
  UI.openModal('客户资料（只读）',
    '<div class="p2-kv">' + (rows.map(function (r) {
      return `<div class="p2-kv-row"><span>${esc(r[0])}</span><b>${esc(String(r[1]))}</b></div>`;
    }).join('') || '<div class="t-sub">没有可显示的客户资料</div>') + '</div>' +
    '<div class="t-sub" style="margin-top:10px">这里只是查看；要修改请到「客户管理」。本单保存的是当时的快照，不会跟着变。</div>',
    [{ text: '关闭', cls: 'ghost', onclick: 'UI.closeModal()' }]);
};

/* 常用计价单位；不在表里的值也会被保留成选项（手填过的单位不丢） */
const UNITS = ['㎡', 'roll', 'sheet', 'm', 'kg', 'pcs', 'set'];
Doc.unitOptions = function (cur) {
  const u = String(cur == null ? '' : cur).trim();
  const list = (u && UNITS.indexOf(u) < 0) ? [u].concat(UNITS) : UNITS;
  return '<option value=""' + (u ? '' : ' selected') + '>（待补全）</option>' +
    list.map(x => `<option value="${esc(x)}"${u === x ? ' selected' : ''}>${esc(x)}</option>`).join('');
};

/*
 * 明细行（按类型：PL 显示包装四件套且没有单价/金额；CI/SC 多一个 HS 编码输入）。
 * 包装四件套留空 = 待补（存草稿合法），填 0/负数/非整数会被标红并拦住保存（A5）。
 */
Doc.itemRowHTML = function (it, i, ps, d) {
  const u = String(it.unit == null ? '' : it.unit).trim();
  const isPL = d.type === 'PL';
  const showHs = (d.type === 'CI' || d.type === 'SC');
  const p = ps.find(function (x) { return x.id === it.productId; }) || null;
  const thumb = (function () {
    try { const arr = Store.productImagesOf(it.productId); return (arr && arr[0] && arr[0].data) || ''; } catch (e) { return ''; }
  })();
  const pr = QuoteEdit.pricingResult && QuoteEdit.pricingResult.items && QuoteEdit.pricingResult.items[i];
  const sug = (pr && pr.suggested_price != null) ? Pricing.ceil2(pr.suggested_price).toFixed(2) : null;
  const margin = (pr && pr.item_margin != null) ? (pr.item_margin * 100).toFixed(2) + '%' : '—';
  const costTotal = (+it.costFactory || 0) + (+it.costPacking || 0) + (+it.costInland || 0) + (+it.costOther || 0);
  const fx = +d.fx || 0;
  const costUsd = (fx > 0 && costTotal > 0) ? (costTotal / fx) : null;
  const pctOf = function (v) { return (v == null || !isFinite(v)) ? '' : String(+(v * 100).toFixed(4)); };
  const qty = `<input class="inp num" id="qe_f_${i}_qty" type="number" min="0" step="1" placeholder="数量 Qty" value="${it.qty == null ? '' : it.qty}" oninput="Doc.setField(${i}, 'qty', this.value)">`;
  const unit = `<select class="inp unit" id="qe_f_${i}_unit" title="计价单位" onchange="Doc.setField(${i}, 'unit', this.value)">${Doc.unitOptions(u)}</select>`;
  const price = `<input class="inp num" id="qe_f_${i}_price" type="number" min="0" step="0.01" placeholder="${sug ? sug : '最终单价'}" value="${it.price == null ? '' : it.price}" oninput="Doc.setField(${i}, 'price', this.value)">`;
  const amount = `<b class="qe-item-amt num" id="qe_amt_${i}">${money(MODEL.round2((+it.qty || 0) * (+it.price || 0)), d.currency || 'USD')}</b>`;
  const pk = (f) => `<input class="inp num" id="qe_f_${i}_${f}" type="number" min="0" step="${f === 'packages' ? '1' : '0.01'}" placeholder="${esc(Doc.PL_LABEL[f])}" value="${it[f] == null ? '' : it[f]}" oninput="Doc.setField(${i}, '${f}', this.value)">`;

  /* ---- A 区：产品与规格（润成：英文名 → 英文规格 → 单位/数量 → 供应商参考） ---- */
  const extraSpec = `
    <details class="qi-more">
      <summary>更多规格（目数 / 丝径 / 幅宽 / 卷长${showHs ? ' / HS' : ''}）</summary>
      <label class="fld" style="margin-top:6px"><span>关联产品（换产品会带出规格与成本快照，不反写产品库）</span>
        <select class="inp" onchange="Doc.pickProduct(${i}, this.value)">
          <option value="">（手填 / 不关联产品）</option>
          ${ps.map(function (x) { return `<option value="${jid(x.id)}"${it.productId === x.id ? ' selected' : ''}>${esc(x.nameCn || '')}${x.mesh ? ' · ' + x.mesh + '目' : ''}</option>`; }).join('')}
        </select></label>
      <div class="qi-line2" style="margin-top:6px">
        <label class="fld"><span>目数</span><input class="inp num" id="qe_f_${i}_mesh" type="number" min="0" placeholder="留空=不适用" value="${it.mesh == null ? '' : it.mesh}" oninput="Doc.setField(${i}, 'mesh', this.value)"></label>
        <label class="fld"><span>丝径 mm</span><input class="inp num" id="qe_f_${i}_wire" type="number" min="0" step="0.01" placeholder="留空=不适用" value="${it.wire == null ? '' : it.wire}" oninput="Doc.setField(${i}, 'wire', this.value)"></label>
        <label class="fld"><span>幅宽 m</span><input class="inp num" id="qe_f_${i}_width" type="number" min="0" step="0.01" placeholder="留空=不适用" value="${it.width == null ? '' : it.width}" oninput="Doc.setField(${i}, 'width', this.value)"></label>
        <label class="fld"><span>卷长 m</span><input class="inp num" id="qe_f_${i}_rollLen" type="number" min="0" placeholder="留空=不适用" value="${it.rollLen == null ? '' : it.rollLen}" oninput="Doc.setField(${i}, 'rollLen', this.value)"></label>
        ${showHs ? `<label class="fld"><span>HS 编码</span><input class="inp" placeholder="如 3925900000，请自行核对" value="${esc(it.hsCode || '')}" oninput="Doc.setField(${i}, 'hsCode', this.value)"></label>` : ''}
      </div>
    </details>`;
  const zoneA = `
    <div class="qi-zone zone-a">
      <div class="qi-thumb">${thumb ? `<img src="${thumb}" alt="">` : '<span>无产品图片<br>No image</span>'}</div>
      <div class="qi-a-fields">
        <label class="qi-name-wrap">
          <input class="inp qi-name" placeholder="产品英文名称 Name (EN)" value="${esc(it.nameEn || '')}" oninput="Doc.setField(${i}, 'nameEn', this.value)">
        </label>
        <input class="inp qi-cn" placeholder="中文品名（内部用）" value="${esc(it.nameCn || '')}" oninput="Doc.setField(${i}, 'nameCn', this.value)">
        <textarea class="inp qi-spec" rows="2" placeholder="英文规格 Spec（印在客户文件上）" oninput="P1C.setSpecText(${i}, this.value)">${esc(it.specText == null ? '' : it.specText)}</textarea>
        <div class="qi-line2">
          <label class="fld"><span>计价单位 Unit</span>${unit}</label>
          <label class="fld"><span>数量 Qty</span>${qty}</label>
          ${isPL ? pk('packages') + pk('net') + pk('gross') + pk('volume') : ''}
        </div>
        ${extraSpec}
        <label class="fld"><span>参考供应商报价 Supplier Quote</span>
          <div class="qi-sup-empty">供应商报价库将在 P2-02 接入；当前成本按手工录入</div>
        </label>
      </div>
    </div>`;

  /* ---- B 区：内部成本（折叠编辑 + 成本合计 + 折算美元） ---- */
  let zoneB = '';
  if (!isPL) {
    const costBad = function (f) { return QuoteEdit.costInvalid[i + ':' + f] ? 'border-color:#dc2626;background:#fef2f2' : ''; };
    zoneB = `
      <div class="qi-zone zone-b">
        <div class="zone-t">B 内部成本 <em>CNY / ${esc(u || '单位待补')}</em></div>
        <div class="cost-brief"><b>¥ ${money(MODEL.round2(costTotal))}</b><span class="t-sub"> / ${esc(u || '单位')}</span></div>
        <div class="cost-break">工厂 ${money(it.costFactory || 0)} · 包装 ${money(it.costPacking || 0)} · 运输 ${money(it.costInland || 0)} · 其他 ${money(it.costOther || 0)}</div>
        <details class="qe-cost-fold">
          <summary>编辑明细 ▾</summary>
          <div class="cost-grid" id="p1c_cost_${i}">
            ${P1C.COST_FIELDS.map(function (c) {
              return `<label class="fld"><span>${c.label}</span><input class="inp num" type="number" min="0" step="0.01" style="${costBad(c.key)}" value="${it[c.key] == null ? '' : it[c.key]}" oninput="P1C.setCostField(${i}, '${c.key}', this.value)"></label>`;
            }).join('')}
            <label class="fld"><span>成本状态</span>
              <select class="inp" onchange="P1C.setCostConfirmed(${i}, this.value)">
                <option value=""${it.costConfirmed == null ? ' selected' : ''}>未确认</option>
                <option value="1"${it.costConfirmed === true ? ' selected' : ''}>已确认</option>
                <option value="0"${it.costConfirmed === false ? ' selected' : ''}>明确未确认</option>
              </select></label>
          </div>
        </details>
        <div class="calc-line"><span>折算美元成本</span><b>${costUsd == null ? '—' : '$ ' + costUsd.toFixed(2)}</b></div>
      </div>`;
  }

  /* ---- C 区：智能报价（行内 FX/毛利率/费率 + 建议价 + 最终价 + 利润率 + 金额） ---- */
  const zoneC = isPL ? '' : `
      <div class="qi-zone zone-c">
        <div class="zone-t">C 智能报价 <em>${esc(d.currency || 'USD')}</em></div>
        <div class="qi-quick-params">
          <span class="qi-mini-kv">FX <b>${d.fx == null ? '—' : d.fx}</b></span>
          <span class="qi-mini-kv">毛利率 <b>${pctOf(d.targetMargin) || '—'}%</b></span>
          <span class="qi-mini-kv">费率 <b>${pctOf(d.feeRate) || '—'}%</b></span>
          <span class="t-sub">（在顶部「报价计算参数」里改，保证只有一处入口）</span>
        </div>
        <div class="sug-msg ${sug ? 'ok' : 'bad'}">${sug ? '按当前汇率与参数计算；改成本或参数会自动重算，已填最终价不被覆盖。' : (fx > 0 ? '成本未填或未确认，暂不出建议价。' : '整单汇率未填，无法计算建议价。')}</div>
        <div class="hero">
          <div class="hero-l">系统建议单价 Suggested</div>
          <div class="hero-v" id="qe_sug_${i}">${sug ? '$ ' + sug : '$ —'}<span style="font-size:12px;font-weight:400"> / ${esc(u || '单位')}</span></div>
        </div>
        <label class="fld"><span>最终美元单价 Final（可人工调整，重算不覆盖）</span>${price}</label>
        <div class="calc-line"><span>预计产品利润率</span><b>${margin}</b></div>
        <div class="calc-line total"><span>产品报价总额</span>${amount}</div>
        <button class="btn ghost" style="margin-top:6px;padding:4px 10px;font-size:12px" onclick="P1C.applySuggestedPrice(${i})">填入建议价</button>
      </div>`;

  return `
    <article class="qi">
      <div class="qi-head">
        <span class="qi-idx">${i + 1}</span>
        <span class="qi-sku">${esc((p && p.sku) || '临时产品 TEMP')}</span>
        <span class="qi-cat">${esc((p && p.category) || '手工录入')}</span>
        <span class="spacer"></span>
        <span class="qi-state ${it.costConfirmed ? 'ok' : 'warn'}">${it.costConfirmed ? '成本已确认' : '成本待确认'}</span>
        <span class="qi-state">手工成本</span>
      </div>
      <div class="qi-body">
        ${zoneA}
        ${zoneB}
        ${zoneC}
      </div>
      <div class="qi-foot">
        <label class="chk"><input type="checkbox" ${it.costConfirmed ? 'checked' : ''} onchange="P1C.setCostConfirmed(${i}, this.checked ? '1' : '')"> 本次采购成本已确认</label>
        <span class="t-sub">价格来源：手工录入成本，无供应商档案</span>
        ${(() => {
          const chips = [];
          if (!fx) chips.push(['整单未设汇率', 1]);
          if (costTotal <= 0) chips.push(['成本为 0，不出建议价', 1]);
          if (!it.costConfirmed) chips.push(['成本未确认', 0]);
          if (it.price != null && fx > 0 && costTotal > 0 && (+it.price) < (costTotal / fx)) chips.push(['售价低于成本', 1]);
          return chips.slice(0, 3).map(function (r) { return `<span class="risk-chip ${r[1] ? 'bad' : ''}">${r[0]}</span>`; }).join('');
        })()}
        <span class="spacer"></span>
        <button class="icon-btn" title="删掉这行" onclick="Doc.removeRow(${i})">✕</button>
      </div>
      <div class="qe-item-bad" id="qe_bad_${i}" style="display:none"></div>
      ${u ? '' : '<div class="qe-item-hint">计价单位还没选——选产品会按产品库带入，也可以在这里直接选</div>'}
    </article>`;
};

/*
 * 单据级字段写入（白名单：只放行 v4 单据上的文本/日期键）。
 * 白名单之外的键一律不写——避免界面上随手加的字段静默进库。
 * validity 与 delivery 分槽，互不相干（A1）。
 */
const DOC_TEXT_FIELDS = ['currency', 'term', 'payment', 'validity', 'delivery', 'remark',
  'bank', 'buyerAddress', 'marks', 'shipment', 'vessel', 'origin', 'contractTerms', 'signDate', 'signPlace'];
Doc.termField = function (f, v) {
  if (DOC_TEXT_FIELDS.indexOf(f) < 0) return;
  QuoteEdit.draft[f] = v;
  Doc.markDirty();
  Doc.refresh();
};

/* ---------- A4 预览直接编辑 ----------
 * 预览只负责采集文本，仍然回到既有 setField/termField 校验链；不能绕过数字、单位、
 * PL 包装和保存校验。正式打印/PDF 调 sheetHTML(..., false)，不会生成编辑节点。 */
Doc.previewKey = function (event, el) {
  if (!event || event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  if (el && typeof el.blur === 'function') el.blur();
};
Doc.previewCommit = function (el) {
  if (!el || !QuoteEdit.draft) return;
  const path = String(el.dataset.editPath || '');
  const value = String(el.textContent == null ? '' : el.textContent).replace(/\u00a0/g, ' ').trim();
  const customCell = path.match(/^items\.(\d+)\.custom\.([A-Za-z0-9_-]{1,40})$/);
  if (customCell) {
    const i = +customCell[1], id = customCell[2], item = QuoteEdit.draft.items[i];
    if (!item || !Doc.customColumns().some(c => c.id === id)) return;
    item._unknown = item._unknown || {};
    item._unknown.customCells = item._unknown.customCells || {};
    item._unknown.customCells[id] = value.slice(0, 500);
    Doc.markDirty(); Doc.refresh(); return;
  }
  const customLabel = path.match(/^customColumns\.([A-Za-z0-9_-]{1,40})\.label$/);
  if (customLabel) {
    const col = Doc.customColumns().find(c => c.id === customLabel[1]);
    if (!col) return;
    if (!value || Doc.isSensitiveColumn(value)) { UI.toast('列名不能为空，也不能是成本、利润、底价或供应商等内部字段'); UI.render(); return; }
    col.label = value.slice(0, 30);
    Doc.markDirty(); Doc.refresh(); return;
  }
  const itemMatch = path.match(/^items\.(\d+)\.([A-Za-z][A-Za-z0-9]*)$/);
  if (itemMatch) {
    const i = +itemMatch[1], field = itemMatch[2];
    const allowed = ['nameCn', 'nameEn', 'mesh', 'wire', 'width', 'rollLen', 'qty', 'unit', 'price', 'hsCode', 'packages', 'net', 'gross', 'volume'];
    if (allowed.indexOf(field) >= 0) Doc.setField(i, field, value);
    return;
  }
  const partyMatch = path.match(/^(seller|customer)\.(company|contact|address|name|country)$/);
  if (partyMatch) {
    const group = partyMatch[1], field = partyMatch[2];
    if (group === 'seller') {
      QuoteEdit.draft.seller = QuoteEdit.draft.seller || { company: '', contact: '', address: '' };
      if (['company', 'contact', 'address'].indexOf(field) < 0) return;
    } else {
      QuoteEdit.draft.customer = QuoteEdit.draft.customer || { id: null, name: '', company: '', country: '', address: '' };
      if (['company', 'name', 'country'].indexOf(field) < 0) return;
    }
    QuoteEdit.draft[group][field] = value;
    Doc.markDirty();
    Doc.refresh();
    return;
  }
  if (DOC_TEXT_FIELDS.indexOf(path) >= 0) Doc.termField(path, value);
};
Doc.previewAddRow = function () { Doc.addRow(); };
Doc.previewRemoveRow = function (i) { Doc.removeRow(+i); };
Doc.ensureQuoteLayout = function () {
  const d = QuoteEdit.draft;
  d._unknown = d._unknown && typeof d._unknown === 'object' ? d._unknown : {};
  d._unknown.quoteLayout = d._unknown.quoteLayout && typeof d._unknown.quoteLayout === 'object' ? d._unknown.quoteLayout : {};
  d._unknown.quoteLayout.columns = Array.isArray(d._unknown.quoteLayout.columns) ? d._unknown.quoteLayout.columns : [];
  return d._unknown.quoteLayout;
};
Doc.templateId = function () {
  /* P1-D-04：编辑器下拉显示「生效模板」（= Sheet.templateFor 的同一口径），
     这样未声明模板的历史单据也会显示 RunCheng 统一版式，不会出现
     「下拉写着基础版、纸面印的是 RunCheng 版式」的错配。 */
  return Sheet.templateFor(QuoteEdit.draft || {});
};
Doc.templateName = function () {
  const n = Doc.ensureQuoteLayout().templateName;
  if (String(n || '').trim()) return String(n).trim();
  const id = Sheet.templateFor(QuoteEdit.draft || {});
  if (id === 'quotation-rc-v1') return 'RunCheng 统一版式';
  return id === 'trade-v1' ? '贸易报价版' : '基础单据版';
};
Doc.setTemplate = function (id) {
  if (!['basic-v1', 'trade-v1', 'quotation-rc-v1'].includes(id)) return;
  /* P1-D-04：quotation-rc-v1 已解除「仅 QT」限制，五类单据都可选用同一套统一版式 */
  Doc.ensureQuoteLayout().templateId = id;
  QuoteEdit.draft.templateId = id;
  Doc.markDirty();
  Doc.refresh();
};
Doc.openTemplateEditor = function () {
  const layout = Doc.ensureQuoteLayout();
  const hidden = Array.isArray(layout.hiddenColumns) ? layout.hiddenColumns : [];
  const cols = Doc.customColumns();
  const checks = cols.length ? cols.map(c => `<label style="display:flex;gap:8px;align-items:center;margin:7px 0"><input type="checkbox" class="qe_tpl_col" value="${esc(c.id)}"${hidden.includes(c.id) ? '' : ' checked'}> 显示「${esc(c.label)}」</label>`).join('') : '<div class="t-sub">当前还没有自定义列。添加列后可以在这里筛选显示。</div>';
  UI.openModal('筛选 / 修改模板', `<div class="form-row"><label>模板名称</label><input class="inp" id="qe_tpl_name" maxlength="40" value="${esc(Doc.templateName())}"></div><div class="t-sub" style="margin-bottom:8px">取消勾选的自定义列会从本单据纸面和 PDF 中隐藏，数据仍保留，之后可以重新显示。</div><div>${checks}</div>`, [{text:'取消',cls:'ghost',onclick:'UI.closeModal()'},{text:'保存模板',onclick:'Doc.saveTemplateEditor()'}]);
  UI.guardModal();
};
Doc.saveTemplateEditor = function () {
  const layout = Doc.ensureQuoteLayout();
  const name = String(document.getElementById('qe_tpl_name')?.value || '').trim();
  if (!name) { UI.toast('模板名称不能为空'); return; }
  layout.templateName = name.slice(0, 40);
  layout.hiddenColumns = Array.from(document.querySelectorAll('.qe_tpl_col')).filter(el => !el.checked).map(el => el.value).slice(0, 6);
  Doc.markDirty(); UI.closeModal(true); UI.render(); UI.toast('模板设置已保存，保存单据后生效');
};
Doc.customColumns = function () { return Doc.ensureQuoteLayout().columns; };
Doc.isSensitiveColumn = function (label) {
  return /(成本|底价|采购价|利润|毛利|供应商|厂家|进货|cost|profit|margin|supplier|purchase)/i.test(String(label || ''));
};
Doc.openAddColumn = function () {
  if (Doc.customColumns().length >= 6) { UI.toast('A4 纸面最多添加 6 个自定义列，避免内容被挤得看不清'); return; }
  UI.openModal('添加报价列', `
    <div class="form-row"><label>常用列</label><select class="inp" id="qe_col_preset" onchange="document.getElementById('qe_col_name').value=this.value">
      <option value="">自定义</option><option>图片</option><option>材质</option><option>表面处理</option><option>颜色</option><option>包装方式</option><option>客户备注</option>
    </select></div>
    <div class="form-row"><label>列名</label><input class="inp" id="qe_col_name" maxlength="30" placeholder="例如：立柱规格"></div>
    <div class="t-sub">新增列会存入本张单据，每行都可以在预览里填写。内部成本、利润和供应商字段不能加到客户报价。</div>`, [
      { text: '取消', cls: 'ghost', onclick: 'UI.closeModal()' },
      { text: '添加', onclick: 'Doc.addCustomColumn()' }
    ]);
  UI.guardModal();
};
Doc.addCustomColumn = function () {
  const input = document.getElementById('qe_col_name');
  const label = String(input && input.value || '').trim();
  if (!label) { UI.toast('请填写列名'); return; }
  if (Doc.isSensitiveColumn(label)) { UI.toast('内部成本、利润、底价和供应商信息不能加入客户报价列'); return; }
  const cols = Doc.customColumns();
  if (cols.length >= 6) { UI.toast('最多添加 6 个自定义列'); return; }
  if (cols.some(c => String(c.label).toLowerCase() === label.toLowerCase())) { UI.toast('已经有同名列了'); return; }
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  cols.push({ id, label: label.slice(0, 30) });
  (QuoteEdit.draft.items || []).forEach(it => { it._unknown = it._unknown || {}; it._unknown.customCells = it._unknown.customCells || {}; it._unknown.customCells[id] = ''; });
  Doc.markDirty(); UI.closeModal(true); UI.render(); UI.toast('已添加列「' + label + '」');
};
Doc.moveCustomColumn = function (id, direction) {
  const cols = Doc.customColumns(), from = cols.findIndex(c => c.id === id), to = from + (+direction || 0);
  if (from < 0 || to < 0 || to >= cols.length) return;
  const one = cols.splice(from, 1)[0]; cols.splice(to, 0, one); Doc.markDirty(); UI.render();
};
Doc.removeCustomColumn = function (id) {
  const col = Doc.customColumns().find(c => c.id === id); if (!col) return;
  UI.confirm('删除自定义列', '确定删除「' + esc(col.label) + '」列以及本单据中这一列已填写的内容吗？', () => {
    const cols = Doc.customColumns(), index = cols.findIndex(c => c.id === id); if (index >= 0) cols.splice(index, 1);
    (QuoteEdit.draft.items || []).forEach(it => { if (it._unknown && it._unknown.customCells) delete it._unknown.customCells[id]; });
    Doc.markDirty(); UI.render();
  });
};

/* ---------- PL：包装模式与整单总件数（三态，系统不替用户判断） ---------- */
Doc.setPackagingMode = function (mode) {
  const d = QuoteEdit.draft;
  if (d.type !== 'PL') return;
  d.packagingMode = (mode === 'separate' || mode === 'mixed') ? mode : null;
  if (d.packagingMode !== 'mixed') d.totalPackages = null;   /* 只有混装才用整单件数 */
  Doc.markDirty();
  UI.render();
};
Doc.setTotalPackages = function (v) {
  const d = QuoteEdit.draft;
  if (d.type !== 'PL') return;
  const raw = String(v == null ? '' : v).trim();
  if (raw === '') { d.totalPackages = null; Doc.markDirty(); UI.render(); return; }
  const n = Number(raw);
  if (!isFinite(n) || !Number.isInteger(n) || n <= 0) {
    UI.toast('整单总包装件数要填正整数（还没定就留空，别填 0 冒充）');
    UI.render();
    return;
  }
  d.totalPackages = n;
  Doc.markDirty();
  UI.render();
};

/* ---------- 卖方快照刷新（字段表 §6.1：显式、可取消、只改本单草稿） ---------- */
Doc.refreshSeller = function () {
  const s = Store.settings() || {};
  const has = String(s.company || '').trim() || String(s.contact || '').trim() || String(s.sellerAddress || '').trim();
  if (!has) { UI.toast('设置页还没填卖方公司/联系方式/地址，先去「设置」补上'); return; }
  UI.confirm('刷新卖方信息',
    `会用当前设置页的卖方信息<b>覆盖本张单据</b>已保存的卖方快照。<br>` +
    `只影响这一张单（保存后才落盘），其他已保存单据不受影响。确定刷新吗？`,
    () => {
      QuoteEdit.draft.seller = { company: String(s.company || ''), contact: String(s.contact || ''), address: String(s.sellerAddress || '') };
      Doc.markDirty();
      UI.render();
      UI.toast('卖方快照已刷新（还没保存，保存后生效）');
    });
};

/* ---------- 买方地址：客户库显式带入；换客户先清空（A3） ---------- */
Doc.importCustAddress = function () {
  const cur = QuoteEdit.draft.customer;
  const c = Store.customers().find(x => String(x.id) === String(cur && cur.id));
  if (!c || !String(c.address || '').trim()) { UI.toast('这个客户在客户库里没有地址，可以手填'); return; }
  QuoteEdit.draft.buyerAddress = String(c.address || '');
  Doc.markDirty();
  UI.render();
  UI.toast('已带入客户资料里的地址，可改（不反写客户库）');
};

/* ---------- 复制 / 转换（转换矩阵 §5：点击只构造未保存草稿） ---------- */
Doc.TYPE_CN = { QT: '报价单', PI: '形式发票', SC: '销售合同', CI: '商业发票', PL: '装箱单' };
Doc.askConvert = function (id) {
  const src = Store.getDocument(id);
  if (!src) { UI.toast('这张单据不存在了'); return; }
  const targets = MODEL.conversionTargets(src.type) || [];
  if (!targets.length) { UI.toast('本轮不提供这种单据的复制/转换'); return; }
  UI.openModal('复制 / 转换成新单据', `
    <div style="font-size:14px;line-height:1.9">
      来源：<b>${esc(src.no || '')}</b>（${esc(Doc.TYPE_CN[src.type] || src.type)}）<br>
      点一下只是<b>生成一份未保存的草稿</b>供你修改——<b>不会立刻占用单号</b>，
      只有你点「保存」时才生成新单号并落盘；取消就什么都不发生。
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
        ${targets.map(t => `
          <button class="btn ${t === src.type ? 'ghost' : ''}" onclick="Doc.startConvert('${jid(id)}','${t}')">
            ${t === src.type ? '复制一份同样的' : '转换成'}「${esc(Doc.TYPE_CN[t] || t)}」
          </button>`).join('')}
      </div>
      ${src.type === 'PL' ? '<div class="t-sub" style="margin-top:10px">装箱单没有单价和金额，本轮不提供转成报价单/发票/合同——需要的话请回到上游那张单。</div>' : ''}
    </div>`,
    [{ text: '取消', cls: 'ghost', onclick: 'UI.closeModal()' }]);
};
/*
 * 构造草稿：独立在途标志 converting（不能用 saving 顶替），
 * 连点直接被拒；构造完打开目标编辑器，dirty=false（用户还没改任何东西）。
 */
Doc.startConvert = function (id, toType) {
  if (QuoteEdit.converting) return;
  if (QuoteEdit.saving) return;
  /* 有未保存草稿时先按离开保护走（D2 三选一），不直接丢弃 */
  if (UI.current === 'quoteEdit' && QuoteEdit.dirty) {
    UI.closeModal();
    QuoteEdit.pendingOpen = null;
    QuoteEdit.pendingGo = null;
    QuoteEdit.pendingConversion = { id, type: toType };
    Doc.askLeave('nav');
    return;
  }
  const src = Store.getDocument(id);
  if (!src) { UI.toast('这张单据不存在了'); return; }
  QuoteEdit.converting = true;
  let r = null;
  try {
    r = MODEL.buildConversionDraft(src, toType);
  } finally {
    QuoteEdit.converting = false;
  }
  if (!r.ok) { UI.toast(r.error || '这次转换没能生成草稿'); return; }
  try { UI.closeModal(); } catch (e) {}
  /* 提示：银行/包装/运输等按矩阵带入后需要人工核对（A4/A5） */
  const hints = [];
  if (String(r.draft.bank || '').trim()) hints.push('银行资料是从源单带过来的，请确认是否仍有效');
  if (toType === 'PL') hints.push('箱数、净重、毛重、体积请按实际装箱填写——系统不按数量估算');
  if (toType === 'PL' && r.from === 'PL') hints.push('包装值是复制过来的初稿，请按本次实际装箱重新核对');
  if (toType === 'CI') hints.push('运输方式/船名/原产地是运输事实，请按实际补（不从上游单据猜）');
  if (toType === 'SC') hints.push('签订日期与地点已清空（新单是待签草稿），条款请自行录入');
  QuoteEdit.hints = hints;
  QuoteEdit.id = null;                 /* 未保存草稿：保存时才取号 */
  QuoteEdit.draft = r.draft;
  Doc.ensureRowIds();
  QuoteEdit.dirty = true;              /* 转换结果是未保存内容，离开/关窗也必须保护 */
  QuoteEdit.invalid = {};
  /* 载入时把已存在的问题标出来（与重开编辑同一口径） */
  (QuoteEdit.draft.items || []).forEach((it, i) => {
    const chkQ = Doc.checkNumber('qty', it.qty, true);
    if (chkQ.state !== 'ok') QuoteEdit.invalid[i + ':qty'] = { raw: String(it.qty == null ? '' : it.qty), msg: chkQ.msg, kind: chkQ.state };
    if (QuoteEdit.draft.type !== 'PL') {
      const chkP = Doc.checkNumber('price', it.price, true);
      if (chkP.state !== 'ok') QuoteEdit.invalid[i + ':price'] = { raw: String(it.price == null ? '' : it.price), msg: chkP.msg, kind: chkP.state };
    } else {
      Doc.PL_FIELDS.forEach(f => {
        const msg = Doc.checkPackaging(f, it[f], it);
        if (msg) QuoteEdit.invalid[i + ':' + f] = { raw: String(it[f] == null ? '' : it[f]), msg: msg, kind: 'invalid' };
      });
    }
    if (!String(it.unit == null ? '' : it.unit).trim()) {
      QuoteEdit.invalid[i + ':unit'] = { raw: '', msg: '计价单位还没选', kind: 'empty' };
    }
  });
  QuoteEdit.custMode = 'card';
  QuoteEdit.pane = 'edit';
  UI.go('quoteEdit');
  UI.toast('已生成「' + (Doc.TYPE_CN[toType] || toType) + '」草稿，还没保存——改完点保存才生成单号');
};

/* ============ 计算工具 ============ */
const DENSITY = { '304': 7.93, '316': 7.98, '镀锌铁': 7.85, '低碳钢': 7.85, '铜': 8.96, '铝': 2.70 };

Pages.industryTools = function () {
  const cards = [
    ['mesh', '丝网计算', '规格换算、孔径、开孔率、理论网重', 'H2 计算器工作台', 'meshCalculators'],
    ['raw', '原材料计算', '盘条、丝径、重量与成本口径', 'H2 首批计算器', 'meshCalculators'],
    ['load', '装柜预排', '按外箱尺寸和毛重做单柜几何预排', '已支持 20GP / 40HQ', 'loadPlanner'],
    ['market', '行情参考', '世界时间与参考汇率，标明数据时效', 'H3 已接入', 'marketData'],
    ['factory', '我的厂家', '管理自己的合作厂家与联系人', 'H4 已接入', 'directory'],
    ['station', '我的货站', '管理常用货站、线路与配送备注', 'H4 已接入', 'directory']
  ];
  return `<div class="industry-head"><div><div class="t-sub">INDUSTRY TOOLBOX / H1</div><h2 style="margin:2px 0">行业工具</h2><p class="t-sub">把计算、产品资料、装柜和行情放在同一条工作流里。</p></div><div class="industry-count"><b>6</b><span>个入口</span></div></div><div class="industry-grid">${cards.map(([icon,title,desc,status,page]) => `<button class="industry-card ${page?'':'planned'}" ${page?`onclick="UI.go('${page}')"`:''}><span class="industry-icon">${icon==='load'?'▣':icon==='market'?'◷':icon==='factory'?'♙':icon==='station'?'⌂':'＋'}</span><span class="industry-card-main"><b>${title}</b><small>${desc}</small></span><span class="industry-status">${status}</span><span class="industry-arrow">${page?'→':'待接入'}</span></button>`).join('')}</div><div class="notice-item n-ok" style="margin-top:16px"><b>联动原则</b><span>产品资料中的外箱长宽高、单箱毛重和包装信息，只有在你点击“加入装柜”或“带入计算”后才会进入工具；计算结果不会静默覆盖产品，回填前会再次确认。</span></div>`;
};

const MarketData = {
  list(){ const s=Store.settings()||{}; return Array.isArray(s.marketQuotes)?s.marketQuotes:[]; },
  save(list){ const ok=Store.saveSettings({marketQuotes:list}); if(ok)UI.render(); else UI.toast(Store.saveError()||'行情保存失败'); return ok; },
  add(){ const v=id=>(document.getElementById(id)||{}).value||''; const row={id:'mq-'+Date.now().toString(36),date:v('mq_date')||new Date().toISOString().slice(0,10),supplier:v('mq_supplier').trim(),grade:v('mq_grade').trim(),diameter:v('mq_diameter').trim(),price:Number(v('mq_price'))||0,change:v('mq_change').trim(),source:v('mq_source').trim(),operator:v('mq_operator').trim(),note:v('mq_note').trim(),status:v('mq_status')||'待审核',updatedAt:new Date().toISOString()}; if(!row.supplier||!row.grade||!(row.price>0)){UI.toast('厂家、牌号和价格为必填');return;} const list=this.list();list.unshift(row);this.save(list);UI.toast('行情已保存到本机'); },
  remove(id){this.save(this.list().filter(x=>x.id!==id));},
  importJson(input){const f=input&&input.files&&input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);const rows=Array.isArray(x)?x:(x&&Array.isArray(x.marketQuotes)?x.marketQuotes:[]);if(!rows.length)throw Error('没有找到行情数组');const clean=rows.map((q,i)=>({id:q.id||'mq-'+Date.now().toString(36)+'-'+i,date:String(q.date||''),supplier:String(q.supplier||''),grade:String(q.grade||''),diameter:String(q.diameter||''),price:Number(q.price)||0,change:String(q.change||''),source:String(q.source||''),operator:String(q.operator||''),note:String(q.note||''),status:String(q.status||'待审核'),updatedAt:new Date().toISOString()})).filter(q=>q.supplier&&q.grade&&q.price>0);if(!clean.length)throw Error('没有有效记录');this.save(clean.concat(this.list()));UI.toast('行情导入完成：'+clean.length+' 条');}catch(e){UI.toast('行情导入失败：'+e.message);}};r.readAsText(f);input.value='';},
  exportJson(){const payload={version:1,marketQuotes:this.list(),exportedAt:new Date().toISOString()};if(window.SBW&&window.SBW.exportToFile)window.SBW.exportToFile(JSON.stringify(payload,null,2),'丝网盒子-行情数据.json').then(x=>x&&x.ok&&UI.toast('行情已导出'));}
};
Pages.marketData=function(){const rows=MarketData.list();const today=Date.now();const body=rows.map(q=>{const age=Math.max(0,Math.floor((today-new Date(q.date).getTime())/86400000));return `<tr><td>${esc(q.date)}<div class="t-sub">${age>30?'数据已过期':'距今天 '+age+' 天'}</div></td><td>${esc(q.supplier)}<div class="t-sub">${esc(q.grade)}${q.diameter?' · '+esc(q.diameter):''}</div></td><td class="num"><b>${Number(q.price).toFixed(2)}</b></td><td>${esc(q.change||'—')}</td><td>${esc(q.source||'未填写')}</td><td><span class="todo-badge">${esc(q.status||'待审核')}</span></td><td><button class="icon-btn" onclick="MarketData.remove('${jid(q.id)}')">🗑</button></td></tr>`}).join('')||'<tr><td colspan="7" class="t-sub">还没有行情记录。先录入一条你自己核验过的盘条/原材料价格。</td></tr>';return `<div class="toolbar"><div><div class="t-sub">MARKET DATA / H3</div><h2 style="margin:2px 0">行情参考</h2><p class="t-sub">人工录入和导入优先，明确来源与时效，不伪装实时行情。</p></div><div class="grow"></div><button class="btn ghost" onclick="MarketData.exportJson()">导出 JSON</button><label class="btn ghost">导入 JSON<input type="file" accept="application/json,.json" style="display:none" onchange="MarketData.importJson(this)"></label></div><div class="card"><div class="card-h">新增行情记录</div><div class="grid g4"><div class="form-row"><label>日期</label><input class="inp" id="mq_date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="form-row"><label>厂家</label><input class="inp" id="mq_supplier" placeholder="你核验过的厂家"></div><div class="form-row"><label>牌号 / 材料</label><input class="inp" id="mq_grade" placeholder="如 Q195 / 304"></div><div class="form-row"><label>直径 mm</label><input class="inp" id="mq_diameter" placeholder="可选"></div></div><div class="grid g4"><div class="form-row"><label>价格（元/吨）</label><input class="inp num" id="mq_price" type="number" min="0" step="0.01"></div><div class="form-row"><label>涨跌</label><input class="inp" id="mq_change" placeholder="如 +50 / -20"></div><div class="form-row"><label>来源</label><input class="inp" id="mq_source" placeholder="电话、报价单、公开网站"></div><div class="form-row"><label>录入人</label><input class="inp" id="mq_operator" placeholder="可选"></div></div><div class="form-row"><label>备注</label><input class="inp" id="mq_note" placeholder="地区、含税/不含税、有效期等"></div><div class="quick"><select class="inp" id="mq_status" style="width:130px"><option>待审核</option><option>已审核</option><option>已过期</option></select><button class="btn" onclick="MarketData.add()">保存行情</button></div></div><div class="card" style="margin-top:14px"><div class="card-h"><span>行情记录</span><span class="todo-badge">共 ${rows.length} 条 · 趋势可按日期筛选</span></div><div style="overflow:auto"><table class="tb"><tr><th>日期</th><th>厂家 / 牌号</th><th>价格 元/吨</th><th>涨跌</th><th>来源</th><th>状态</th><th></th></tr>${body}</table></div><div class="t-sub" style="margin-top:10px">数据缺失、来源不明或超过 30 天未更新时，页面只提示风险，不自动补值。</div></div>`;};

const Directory = {
  mode:'factory', list(){const s=Store.settings()||{};const key=this.mode==='station'?'stations':'factories';return Array.isArray(s[key])?s[key]:[];}, key(){return this.mode==='station'?'stations':'factories';}, save(list){const patch={};patch[this.key()]=list;const ok=Store.saveSettings(patch);if(ok)UI.render();else UI.toast(Store.saveError()||'通讯录保存失败');return ok;}, add(){const v=id=>(document.getElementById(id)||{}).value||'';const row={id:'dir-'+Date.now().toString(36),name:v('dir_name').trim(),contact:v('dir_contact').trim(),phone:v('dir_phone').trim(),wechat:v('dir_wechat').trim(),address:v('dir_address').trim(),scope:v('dir_scope').trim(),note:v('dir_note').trim(),updatedAt:new Date().toISOString()};if(!row.name){UI.toast('名称为必填');return;}const list=this.list();list.unshift(row);this.save(list);UI.toast((this.mode==='station'?'货站':'厂家')+'已保存到本机');},remove(id){this.save(this.list().filter(x=>x.id!==id));},importJson(input){const f=input&&input.files&&input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result),key=this.key(),rows=Array.isArray(x)?x:(x&&Array.isArray(x[key])?x[key]:[]);if(!rows.length)throw Error('没有找到对应数组');const clean=rows.map((q,i)=>({id:q.id||'dir-'+Date.now().toString(36)+'-'+i,name:String(q.name||q.company||''),contact:String(q.contact||''),phone:String(q.phone||''),wechat:String(q.wechat||''),address:String(q.address||''),scope:String(q.scope||q.route||''),note:String(q.note||''),updatedAt:new Date().toISOString()})).filter(q=>q.name);if(!clean.length)throw Error('没有有效记录');this.save(clean.concat(this.list()));UI.toast('导入完成：'+clean.length+' 条');}catch(e){UI.toast('导入失败：'+e.message);}};r.readAsText(f);input.value='';},exportJson(){const p={version:1};p[this.key()]=this.list();if(window.SBW&&window.SBW.exportToFile)window.SBW.exportToFile(JSON.stringify(p,null,2),'丝网盒子-'+(this.mode==='station'?'货站':'厂家')+'.json').then(x=>x&&x.ok&&UI.toast('已导出'));}
};
Pages.directory=function(){const rows=Directory.list();const title=Directory.mode==='station'?'我的货站':'我的厂家';const body=rows.map(q=>`<tr><td><b>${esc(q.name)}</b><div class="t-sub">${esc(q.scope||'')}</div></td><td>${esc(q.contact||'')}<div class="t-sub">${esc(q.phone||'')} ${esc(q.wechat||'')}</div></td><td>${esc(q.address||'')}</td><td>${esc(q.note||'')}</td><td><button class="icon-btn" onclick="Directory.remove('${jid(q.id)}')">🗑</button></td></tr>`).join('')||`<tr><td colspan="5" class="t-sub">还没有${title}记录。可以手工录入，也可以导入你自己的 JSON 数据。</td></tr>`;return `<div class="toolbar"><div><div class="t-sub">DIRECTORY / H4</div><h2 style="margin:2px 0">${title}</h2><p class="t-sub">只管理你自己的合作对象和常用线路；不自动抓取或复制第三方私有数据库。</p></div><div class="grow"></div><button class="btn ghost" onclick="Directory.exportJson()">导出 JSON</button><label class="btn ghost">导入 JSON<input type="file" accept="application/json,.json" style="display:none" onchange="Directory.importJson(this)"></label></div><div class="quick" style="margin-bottom:14px"><button class="btn ${Directory.mode==='factory'?'':'ghost'}" onclick="Directory.mode='factory';UI.render()">我的厂家</button><button class="btn ${Directory.mode==='station'?'':'ghost'}" onclick="Directory.mode='station';UI.render()">我的货站</button></div><div class="card"><div class="card-h">新增${title}记录</div><div class="grid g4"><div class="form-row"><label>${Directory.mode==='station'?'货站名称':'厂家名称'}</label><input class="inp" id="dir_name" placeholder="名称"></div><div class="form-row"><label>联系人</label><input class="inp" id="dir_contact"></div><div class="form-row"><label>电话</label><input class="inp" id="dir_phone"></div><div class="form-row"><label>微信</label><input class="inp" id="dir_wechat"></div></div><div class="grid g2"><div class="form-row"><label>地址</label><input class="inp" id="dir_address"></div><div class="form-row"><label>${Directory.mode==='station'?'线路 / 配送范围':'产品分类 / 供货范围'}</label><input class="inp" id="dir_scope"></div></div><div class="form-row"><label>备注</label><input class="inp" id="dir_note"></div><button class="btn" onclick="Directory.add()">保存记录</button></div><div class="card" style="margin-top:14px"><div class="card-h"><span>${title}目录</span><span class="todo-badge">共 ${rows.length} 条</span></div><div style="overflow:auto"><table class="tb"><tr><th>名称 / 范围</th><th>联系人</th><th>地址</th><th>备注</th><th></th></tr>${body}</table></div></div>`;};

const MeshCalc = {
  read() {
    const n = id => Number((document.getElementById(id) || {}).value) || 0;
    return { opening: n('wm_opening'), wire: n('wm_wire'), width: n('wm_width'), length: n('wm_length'), qty: Math.max(0, Math.floor(n('wm_qty'))), density: n('wm_density') || 7.93 };
  },
  calc() {
    const v = this.read(); const out = document.getElementById('wm_out'); if (!out) return null;
    if (!(v.opening > 0 && v.wire > 0 && v.width > 0 && v.length > 0 && v.qty > 0)) { out.innerHTML = '<div class="calc-out-row">请填写孔距、丝径、网片尺寸和数量</div>'; return null; }
    const pitch = v.opening + v.wire;
    // 截面用 mm²、密度输入 g/cm³；换算到 kg/m² 的组合因子为 1e-3。
    const kgm2 = 2 * (1000 / pitch) * (Math.PI * v.wire * v.wire / 4) * v.density * 1e-3;
    const areaEach = v.width * v.length; const totalArea = areaEach * v.qty; const totalKg = kgm2 * totalArea;
    const result = { ...v, pitch, kgm2, areaEach, totalArea, totalKg };
    out.innerHTML = `<div class="calc-out-row"><span>理论网重</span><b>${kgm2.toFixed(3)} kg/㎡</b></div><div class="calc-out-row"><span>单片面积</span><b>${areaEach.toFixed(3)} ㎡</b></div><div class="calc-out-row"><span>总面积 / 理论总重</span><b>${totalArea.toFixed(3)} ㎡ / ${totalKg.toFixed(2)} kg</b></div><div class="fx-meta">中心距 ${pitch.toFixed(3)} mm · ${v.qty} 片 · 未计焊点、切边、公差和表面处理增重</div>`;
    this.last = result; return result;
  },
  copy() {
    const r = this.last || this.calc(); if (!r) return;
    const text = `电焊网片理论结果\n孔距 ${r.opening} mm，丝径 ${r.wire} mm\n尺寸 ${r.width} × ${r.length} m，数量 ${r.qty} 片\n理论网重 ${r.kgm2.toFixed(3)} kg/㎡\n总面积 ${r.totalArea.toFixed(3)} ㎡，理论总重 ${r.totalKg.toFixed(2)} kg`;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => UI.toast('结果已复制')).catch(() => UI.toast('当前环境不允许自动复制，请手动记录结果'));
  },
  toProduct() {
    const r = this.last || this.calc(); if (!r) return;
    window.MeshCalcDraft = { nameCn: '电焊网片（计算结果）', material: '按实际材质填写', width: r.width, rollLen: r.length, wire: r.wire, note: `孔距 ${r.opening} mm；理论网重 ${r.kgm2.toFixed(3)} kg/㎡，仅作参考` };
    UI.go('products'); UI.toast('已带入产品资料草稿，请确认后再保存');
  }
};

Pages.meshCalculators = function () {
  return `<div class="toolbar"><div><div class="t-sub">INDUSTRY CALCULATORS / H2-A</div><h2 style="margin:2px 0">行业计算器</h2><p class="t-sub">先统一字段和公式口径，再逐步增加六类丝网计算。</p></div><div class="grow"></div><button class="btn ghost" onclick="UI.go('industryTools')">返回行业工具</button></div><div class="industry-grid" style="margin-bottom:16px"><button class="industry-card"><span class="industry-icon">01</span><span class="industry-card-main"><b>电焊网片</b><small>当前可用：孔距、丝径、尺寸、数量、材质 → 理论网重</small></span><span class="industry-status">已完成</span></button><button class="industry-card" onclick="UI.go('gratingCalculator')"><span class="industry-icon">02</span><span class="industry-card-main"><b>钢格板</b><small>扁钢、横杆、尺寸与理论重量</small></span><span class="industry-status">已完成</span></button><button class="industry-card" onclick="UI.go('rollCalculator')"><span class="industry-icon">03</span><span class="industry-card-main"><b>电焊网卷</b><small>幅宽、卷长、卷数和理论重量</small></span><span class="industry-status">已完成</span></button><button class="industry-card" onclick="UI.go('wovenCalculator')"><span class="industry-icon">04</span><span class="industry-card-main"><b>平纹编织网</b><small>目数、丝径、幅宽与卷重</small></span><span class="industry-status">已完成</span></button><button class="industry-card" onclick="UI.go('chainCalculator')"><span class="industry-icon">05</span><span class="industry-card-main"><b>勾花网</b><small>菱形孔、丝径、尺寸与理论重量</small></span><span class="industry-status">已完成</span></button><button class="industry-card" onclick="UI.go('wireCalculator')"><span class="industry-icon">06</span><span class="industry-card-main"><b>金属丝</b><small>直径、长度、数量与理论重量</small></span><span class="industry-status">已完成</span></button></div><div class="card"><div class="card-h"><span>电焊网片理论重量</span><span class="todo-badge">理论值，不替代过磅</span></div><div class="grid g4"><div class="form-row"><label>孔距 mm</label><input class="inp num" id="wm_opening" type="number" min="0" step="0.01" value="50" oninput="MeshCalc.calc()"></div><div class="form-row"><label>丝径 mm</label><input class="inp num" id="wm_wire" type="number" min="0" step="0.01" value="3.0" oninput="MeshCalc.calc()"></div><div class="form-row"><label>幅宽 m</label><input class="inp num" id="wm_width" type="number" min="0" step="0.01" value="2" oninput="MeshCalc.calc()"></div><div class="form-row"><label>长度 m</label><input class="inp num" id="wm_length" type="number" min="0" step="0.01" value="3" oninput="MeshCalc.calc()"></div></div><div class="grid g4"><div class="form-row"><label>数量（片）</label><input class="inp num" id="wm_qty" type="number" min="1" step="1" value="10" oninput="MeshCalc.calc()"></div><div class="form-row"><label>材质密度 g/cm³</label><select class="inp" id="wm_density" onchange="MeshCalc.calc()"><option value="7.85">低碳钢 / 镀锌铁 · 7.85</option><option value="7.93" selected>304 · 7.93</option><option value="7.98">316 · 7.98</option></select></div></div><div class="calc-out" id="wm_out"></div><div class="quick"><button class="btn ghost" onclick="MeshCalc.copy()">复制结果</button><button class="btn ghost" onclick="MeshCalc.toProduct()">带入产品资料</button><button class="btn" onclick="UI.go('quoteEdit')">进入报价</button></div><div class="fx-meta" style="margin-top:12px">公式：kg/㎡ = 2 × (1000 ÷ (孔距 + 丝径)) × π × 丝径² ÷ 4 × 密度 × 10⁻³（密度按 g/cm³ 输入）。结果为理论值，实际请以材质、焊点、切边和过磅结果复核。</div></div>`;
};

const GratingCalc = {
  read() { const n=id=>Number((document.getElementById(id)||{}).value)||0; return { bw:n('gr_bw'), bt:n('gr_bt'), bs:n('gr_bs'), cw:n('gr_cw'), cs:n('gr_cs'), width:n('gr_width'), length:n('gr_length'), qty:Math.max(0,Math.floor(n('gr_qty'))), density:n('gr_density')||7.85}; },
  calc() {
    const v=this.read(), out=document.getElementById('gr_out'); if(!out)return null;
    if(!(v.bw>0&&v.bt>0&&v.bs>0&&v.cw>0&&v.cs>0&&v.width>0&&v.length>0&&v.qty>0)){out.innerHTML='<div class="calc-out-row">请填写扁钢、横杆、尺寸和数量</div>';return null;}
    const bearingCount=Math.floor(v.width*1000/v.bs)+1, crossCount=Math.floor(v.length*1000/v.cs)+1;
    const bearingKg=bearingCount*v.bw*v.bt*v.length*v.density*1e-3;
    const crossKg=crossCount*(Math.PI*v.cw*v.cw/4)*v.width*v.density*1e-3;
    const each=bearingKg+crossKg, total=each*v.qty, result={...v,bearingCount,crossCount,bearingKg,crossKg,each,total}; this.last=result;
    out.innerHTML=`<div class="calc-out-row"><span>承载扁钢数量 / 重量</span><b>${bearingCount} 根 / ${bearingKg.toFixed(2)} kg</b></div><div class="calc-out-row"><span>横杆数量 / 重量</span><b>${crossCount} 根 / ${crossKg.toFixed(2)} kg</b></div><div class="calc-out-row"><span>单块理论重量 / 总重量</span><b>${each.toFixed(2)} kg / ${total.toFixed(2)} kg</b></div><div class="fx-meta">按理论根数计算；未计焊点、包边、切边、公差及表面处理增重。</div>`; return result;
  },
  copy(){const r=this.last||this.calc();if(!r)return;const t=`钢格板理论结果\n尺寸 ${r.width} × ${r.length} m，数量 ${r.qty}\n承载扁钢 ${r.bw}×${r.bt} mm，间距 ${r.bs} mm\n横杆直径 ${r.cw} mm，间距 ${r.cs} mm\n单块理论重量 ${r.each.toFixed(2)} kg，总重量 ${r.total.toFixed(2)} kg`; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>UI.toast('结果已复制')).catch(()=>UI.toast('当前环境不允许自动复制，请手动记录结果'));}
};

Pages.gratingCalculator = function(){
  return `<div class="toolbar"><div><div class="t-sub">INDUSTRY CALCULATORS / H2-B</div><h2 style="margin:2px 0">钢格板计算器</h2><p class="t-sub">按承载扁钢和横杆的理论用钢量估算，不替代厂家图纸与过磅。</p></div><div class="grow"></div><button class="btn ghost" onclick="UI.go('meshCalculators')">返回计算器</button></div><div class="card"><div class="card-h"><span>钢格板理论重量</span><span class="todo-badge">理论值</span></div><div class="grid g4"><div class="form-row"><label>扁钢宽 mm</label><input class="inp num" id="gr_bw" type="number" min="0" step="1" value="30" oninput="GratingCalc.calc()"></div><div class="form-row"><label>扁钢厚 mm</label><input class="inp num" id="gr_bt" type="number" min="0" step="0.1" value="3" oninput="GratingCalc.calc()"></div><div class="form-row"><label>扁钢间距 mm</label><input class="inp num" id="gr_bs" type="number" min="0" step="1" value="30" oninput="GratingCalc.calc()"></div><div class="form-row"><label>横杆直径 mm</label><input class="inp num" id="gr_cw" type="number" min="0" step="0.1" value="6" oninput="GratingCalc.calc()"></div></div><div class="grid g4"><div class="form-row"><label>横杆间距 mm</label><input class="inp num" id="gr_cs" type="number" min="0" step="1" value="100" oninput="GratingCalc.calc()"></div><div class="form-row"><label>宽度 m</label><input class="inp num" id="gr_width" type="number" min="0" step="0.01" value="1" oninput="GratingCalc.calc()"></div><div class="form-row"><label>长度 m</label><input class="inp num" id="gr_length" type="number" min="0" step="0.01" value="1" oninput="GratingCalc.calc()"></div><div class="form-row"><label>数量（块）</label><input class="inp num" id="gr_qty" type="number" min="1" step="1" value="1" oninput="GratingCalc.calc()"></div></div><div class="form-row" style="max-width:260px"><label>材质密度 g/cm³</label><select class="inp" id="gr_density" onchange="GratingCalc.calc()"><option value="7.85" selected>低碳钢 / 镀锌铁 · 7.85</option><option value="7.93">304 · 7.93</option></select></div><div class="calc-out" id="gr_out"></div><div class="quick"><button class="btn ghost" onclick="GratingCalc.copy()">复制结果</button><button class="btn" onclick="UI.go('quoteEdit')">进入报价</button></div><div class="fx-meta" style="margin-top:12px">扁钢重量 = 扁钢根数 × 宽 × 厚 × 长 × 密度；横杆重量 = 横杆根数 × π × 直径² ÷ 4 × 宽 × 密度。根数采用 floor(尺寸 ÷ 间距)+1。</div></div>`;
};

const RollCalc = {
  read(){const n=id=>Number((document.getElementById(id)||{}).value)||0;return{opening:n('rw_opening'),wire:n('rw_wire'),width:n('rw_width'),length:n('rw_length'),qty:Math.max(0,Math.floor(n('rw_qty'))),density:n('rw_density')||7.85};},
  calc(){const v=this.read(),out=document.getElementById('rw_out');if(!out)return null;if(!(v.opening>0&&v.wire>0&&v.width>0&&v.length>0&&v.qty>0)){out.innerHTML='<div class="calc-out-row">请填写孔距、丝径、幅宽、卷长和卷数</div>';return null;}const pitch=v.opening+v.wire,kgm2=2*(1000/pitch)*(Math.PI*v.wire*v.wire/4)*v.density*1e-3,area=v.width*v.length,each=kgm2*area,total=each*v.qty;const r={...v,pitch,kgm2,area,each,total};this.last=r;out.innerHTML=`<div class="calc-out-row"><span>理论网重</span><b>${kgm2.toFixed(3)} kg/㎡</b></div><div class="calc-out-row"><span>单卷面积 / 理论重量</span><b>${area.toFixed(2)} ㎡ / ${each.toFixed(2)} kg</b></div><div class="calc-out-row"><span>总面积 / 总理论重量</span><b>${(area*v.qty).toFixed(2)} ㎡ / ${total.toFixed(2)} kg</b></div><div class="fx-meta">中心距 ${pitch.toFixed(3)} mm · 不含卷芯、包装、焊点、切边和实际过磅差异</div>`;return r;},
  copy(){const r=this.last||this.calc();if(!r)return;const t=`电焊网卷理论结果\n孔距 ${r.opening} mm，丝径 ${r.wire} mm\n幅宽 ${r.width} m，卷长 ${r.length} m，卷数 ${r.qty}\n理论网重 ${r.kgm2.toFixed(3)} kg/㎡\n单卷 ${r.each.toFixed(2)} kg，总理论重量 ${r.total.toFixed(2)} kg`;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>UI.toast('结果已复制')).catch(()=>UI.toast('当前环境不允许自动复制，请手动记录结果'));}
};

Pages.rollCalculator=function(){return `<div class="toolbar"><div><div class="t-sub">INDUSTRY CALCULATORS / H2-C</div><h2 style="margin:2px 0">电焊网卷计算器</h2><p class="t-sub">按双向焊网理论口径估算卷材重量，不把卷芯和包装猜进去。</p></div><div class="grow"></div><button class="btn ghost" onclick="UI.go('meshCalculators')">返回计算器</button></div><div class="card"><div class="card-h"><span>电焊网卷理论重量</span><span class="todo-badge">理论值</span></div><div class="grid g4"><div class="form-row"><label>孔距 mm</label><input class="inp num" id="rw_opening" type="number" min="0" step="0.01" value="50" oninput="RollCalc.calc()"></div><div class="form-row"><label>丝径 mm</label><input class="inp num" id="rw_wire" type="number" min="0" step="0.01" value="3" oninput="RollCalc.calc()"></div><div class="form-row"><label>幅宽 m</label><input class="inp num" id="rw_width" type="number" min="0" step="0.01" value="2" oninput="RollCalc.calc()"></div><div class="form-row"><label>每卷长度 m</label><input class="inp num" id="rw_length" type="number" min="0" step="0.01" value="30" oninput="RollCalc.calc()"></div></div><div class="grid g4"><div class="form-row"><label>卷数</label><input class="inp num" id="rw_qty" type="number" min="1" step="1" value="10" oninput="RollCalc.calc()"></div><div class="form-row"><label>材质密度 g/cm³</label><select class="inp" id="rw_density" onchange="RollCalc.calc()"><option value="7.85" selected>低碳钢 / 镀锌铁 · 7.85</option><option value="7.93">304 · 7.93</option><option value="7.98">316 · 7.98</option></select></div></div><div class="calc-out" id="rw_out"></div><div class="quick"><button class="btn ghost" onclick="RollCalc.copy()">复制结果</button><button class="btn" onclick="UI.go('quoteEdit')">进入报价</button></div><div class="fx-meta" style="margin-top:12px">公式与电焊网片一致：kg/㎡ = 2 × (1000 ÷ (孔距 + 丝径)) × π × 丝径² ÷ 4 × 密度 × 10⁻³。</div></div>`;};

const WovenCalc = {
  read(){const n=id=>Number((document.getElementById(id)||{}).value)||0;return{mesh:n('ww_mesh'),wire:n('ww_wire'),width:n('ww_width'),length:n('ww_length'),qty:Math.max(0,Math.floor(n('ww_qty'))),density:n('ww_density')||7.93};},
  calc(){const v=this.read(),out=document.getElementById('ww_out');if(!out)return null;if(!(v.mesh>0&&v.wire>0&&v.width>0&&v.length>0&&v.qty>0)){out.innerHTML='<div class="calc-out-row">请填写目数、丝径、幅宽、长度和数量</div>';return null;}const pitch=25.4/v.mesh,ap=pitch-v.wire,kgm2=2*(1000/pitch)*(Math.PI*v.wire*v.wire/4)*v.density*1e-3,area=v.width*v.length,each=kgm2*area,total=each*v.qty;const r={...v,pitch,ap,kgm2,area,each,total};this.last=r;out.innerHTML=`<div class="calc-out-row"><span>理论孔径 / 网重</span><b>${ap>0?ap.toFixed(3):'—'} mm / ${kgm2.toFixed(3)} kg/㎡</b></div><div class="calc-out-row"><span>单卷面积 / 理论重量</span><b>${area.toFixed(2)} ㎡ / ${each.toFixed(2)} kg</b></div><div class="calc-out-row"><span>总面积 / 总理论重量</span><b>${(area*v.qty).toFixed(2)} ㎡ / ${total.toFixed(2)} kg</b></div><div class="fx-meta">节距 ${pitch.toFixed(3)} mm · 未计卷芯、包装、切边和实际过磅差异</div>`;return r;},
  copy(){const r=this.last||this.calc();if(!r)return;const t=`平纹编织网理论结果\n${r.mesh} 目，丝径 ${r.wire} mm，孔径 ${r.ap.toFixed(3)} mm\n幅宽 ${r.width} m，长度 ${r.length} m，数量 ${r.qty}\n理论网重 ${r.kgm2.toFixed(3)} kg/㎡\n单卷 ${r.each.toFixed(2)} kg，总理论重量 ${r.total.toFixed(2)} kg`;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>UI.toast('结果已复制')).catch(()=>UI.toast('当前环境不允许自动复制，请手动记录结果'));}
};

Pages.wovenCalculator=function(){return `<div class="toolbar"><div><div class="t-sub">INDUSTRY CALCULATORS / H2-D</div><h2 style="margin:2px 0">平纹编织网计算器</h2><p class="t-sub">按目数和丝径估算孔径、网重及卷材总重。</p></div><div class="grow"></div><button class="btn ghost" onclick="UI.go('meshCalculators')">返回计算器</button></div><div class="card"><div class="card-h"><span>平纹编织网理论重量</span><span class="todo-badge">理论值</span></div><div class="grid g4"><div class="form-row"><label>目数 mesh</label><input class="inp num" id="ww_mesh" type="number" min="0" step="1" value="100" oninput="WovenCalc.calc()"></div><div class="form-row"><label>丝径 mm</label><input class="inp num" id="ww_wire" type="number" min="0" step="0.001" value="0.1" oninput="WovenCalc.calc()"></div><div class="form-row"><label>幅宽 m</label><input class="inp num" id="ww_width" type="number" min="0" step="0.01" value="1.22" oninput="WovenCalc.calc()"></div><div class="form-row"><label>长度 m</label><input class="inp num" id="ww_length" type="number" min="0" step="0.01" value="30" oninput="WovenCalc.calc()"></div></div><div class="grid g4"><div class="form-row"><label>数量（卷/件）</label><input class="inp num" id="ww_qty" type="number" min="1" step="1" value="1" oninput="WovenCalc.calc()"></div><div class="form-row"><label>材质密度 g/cm³</label><select class="inp" id="ww_density" onchange="WovenCalc.calc()"><option value="7.93" selected>304 · 7.93</option><option value="7.98">316 · 7.98</option><option value="7.85">低碳钢 / 镀锌铁 · 7.85</option></select></div></div><div class="calc-out" id="ww_out"></div><div class="quick"><button class="btn ghost" onclick="WovenCalc.copy()">复制结果</button><button class="btn" onclick="UI.go('quoteEdit')">进入报价</button></div><div class="fx-meta" style="margin-top:12px">节距 = 25.4 ÷ 目数；孔径 = 节距 − 丝径。理论网重按经纬双向钢丝估算，实际规格以客户确认和过磅为准。</div></div>`;};

const ChainCalc = {
  read(){const n=id=>Number((document.getElementById(id)||{}).value)||0;return{opening:n('ch_opening'),wire:n('ch_wire'),width:n('ch_width'),length:n('ch_length'),qty:Math.max(0,Math.floor(n('ch_qty'))),density:n('ch_density')||7.85};},
  calc(){const v=this.read(),out=document.getElementById('ch_out');if(!out)return null;if(!(v.opening>0&&v.wire>0&&v.width>0&&v.length>0&&v.qty>0)){out.innerHTML='<div class="calc-out-row">请填写菱形孔、丝径、网片尺寸和数量</div>';return null;}const pitch=v.opening+v.wire,wireLen=2*Math.SQRT2*(1000/pitch),kgm2=wireLen*(Math.PI*v.wire*v.wire/4)*v.density*1e-3,area=v.width*v.length,each=kgm2*area,total=each*v.qty;const r={...v,pitch,wireLen,kgm2,area,each,total};this.last=r;out.innerHTML=`<div class="calc-out-row"><span>理论网重</span><b>${kgm2.toFixed(3)} kg/㎡</b></div><div class="calc-out-row"><span>单片面积 / 理论重量</span><b>${area.toFixed(2)} ㎡ / ${each.toFixed(2)} kg</b></div><div class="calc-out-row"><span>总面积 / 总理论重量</span><b>${(area*v.qty).toFixed(2)} ㎡ / ${total.toFixed(2)} kg</b></div><div class="fx-meta">按菱形网几何展开长度估算：每㎡钢丝长度约 ${wireLen.toFixed(1)} m；实际勾花机节距、边框和卷边需按订单复核。</div>`;return r;},
  copy(){const r=this.last||this.calc();if(!r)return;const t=`勾花网理论结果\n菱形孔 ${r.opening} mm，丝径 ${r.wire} mm\n尺寸 ${r.width} × ${r.length} m，数量 ${r.qty}\n理论网重 ${r.kgm2.toFixed(3)} kg/㎡\n单片 ${r.each.toFixed(2)} kg，总理论重量 ${r.total.toFixed(2)} kg`;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>UI.toast('结果已复制')).catch(()=>UI.toast('当前环境不允许自动复制，请手动记录结果'));}
};
Pages.chainCalculator=function(){return `<div class="toolbar"><div><div class="t-sub">INDUSTRY CALCULATORS / H2-E</div><h2 style="margin:2px 0">勾花网计算器</h2><p class="t-sub">按菱形孔与丝径估算钢丝展开长度和理论重量。</p></div><div class="grow"></div><button class="btn ghost" onclick="UI.go('meshCalculators')">返回计算器</button></div><div class="card"><div class="card-h"><span>勾花网理论重量</span><span class="todo-badge">几何估算</span></div><div class="grid g4"><div class="form-row"><label>菱形孔 mm</label><input class="inp num" id="ch_opening" type="number" min="0" step="1" value="50" oninput="ChainCalc.calc()"></div><div class="form-row"><label>丝径 mm</label><input class="inp num" id="ch_wire" type="number" min="0" step="0.1" value="3" oninput="ChainCalc.calc()"></div><div class="form-row"><label>宽度 m</label><input class="inp num" id="ch_width" type="number" min="0" step="0.01" value="2" oninput="ChainCalc.calc()"></div><div class="form-row"><label>长度 m</label><input class="inp num" id="ch_length" type="number" min="0" step="0.01" value="3" oninput="ChainCalc.calc()"></div></div><div class="grid g4"><div class="form-row"><label>数量（片/卷）</label><input class="inp num" id="ch_qty" type="number" min="1" step="1" value="1" oninput="ChainCalc.calc()"></div><div class="form-row"><label>材质密度 g/cm³</label><select class="inp" id="ch_density" onchange="ChainCalc.calc()"><option value="7.85" selected>低碳钢 / 镀锌铁 · 7.85</option><option value="7.93">304 · 7.93</option></select></div></div><div class="calc-out" id="ch_out"></div><div class="quick"><button class="btn ghost" onclick="ChainCalc.copy()">复制结果</button><button class="btn" onclick="UI.go('quoteEdit')">进入报价</button></div><div class="fx-meta" style="margin-top:12px">说明：本工具采用菱形网几何展开的理论估算，不替代勾花机参数、边框/卷边、张力和实际过磅。</div></div>`;};

const WireCalc = {
  read(){const n=id=>Number((document.getElementById(id)||{}).value)||0;return{diameter:n('mw_diameter'),length:n('mw_length'),qty:Math.max(0,Math.floor(n('mw_qty'))),density:n('mw_density')||7.85};},
  calc(){const v=this.read(),out=document.getElementById('mw_out');if(!out)return null;if(!(v.diameter>0&&v.length>0&&v.qty>0)){out.innerHTML='<div class="calc-out-row">请填写丝径、长度和数量</div>';return null;}const area=Math.PI*v.diameter*v.diameter/4,each=area*v.length*v.density*1e-3,total=each*v.qty;const r={...v,area,each,total};this.last=r;out.innerHTML=`<div class="calc-out-row"><span>截面积</span><b>${area.toFixed(4)} mm²</b></div><div class="calc-out-row"><span>单根理论重量 / 总重量</span><b>${each.toFixed(3)} kg / ${total.toFixed(3)} kg</b></div><div class="fx-meta">未计镀层、油膜、盘条弯曲和包装差异；长度单位为 m。</div>`;return r;},
  copy(){const r=this.last||this.calc();if(!r)return;const t=`金属丝理论结果\n丝径 ${r.diameter} mm，长度 ${r.length} m，数量 ${r.qty}\n截面积 ${r.area.toFixed(4)} mm²\n单根 ${r.each.toFixed(3)} kg，总重量 ${r.total.toFixed(3)} kg`;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>UI.toast('结果已复制')).catch(()=>UI.toast('当前环境不允许自动复制，请手动记录结果'));}
};
Pages.wireCalculator=function(){return `<div class="toolbar"><div><div class="t-sub">INDUSTRY CALCULATORS / H2-F</div><h2 style="margin:2px 0">金属丝计算器</h2><p class="t-sub">按圆丝直径、长度、数量和材质密度估算理论重量。</p></div><div class="grow"></div><button class="btn ghost" onclick="UI.go('meshCalculators')">返回计算器</button></div><div class="card"><div class="card-h"><span>金属丝理论重量</span><span class="todo-badge">理论值</span></div><div class="grid g4"><div class="form-row"><label>丝径 mm</label><input class="inp num" id="mw_diameter" type="number" min="0" step="0.001" value="3" oninput="WireCalc.calc()"></div><div class="form-row"><label>长度 m</label><input class="inp num" id="mw_length" type="number" min="0" step="0.01" value="100" oninput="WireCalc.calc()"></div><div class="form-row"><label>数量（根/卷）</label><input class="inp num" id="mw_qty" type="number" min="1" step="1" value="1" oninput="WireCalc.calc()"></div><div class="form-row"><label>材质密度 g/cm³</label><select class="inp" id="mw_density" onchange="WireCalc.calc()"><option value="7.85" selected>低碳钢 / 镀锌铁 · 7.85</option><option value="7.93">304 · 7.93</option><option value="8.96">铜 · 8.96</option><option value="2.70">铝 · 2.70</option></select></div></div><div class="calc-out" id="mw_out"></div><div class="quick"><button class="btn ghost" onclick="WireCalc.copy()">复制结果</button><button class="btn" onclick="UI.go('quoteEdit')">进入报价</button></div><div class="fx-meta" style="margin-top:12px">公式：重量 = π × 丝径² ÷ 4 × 长度 × 密度 × 10⁻³；密度按 g/cm³ 输入。</div></div>`;};

Pages.tools = function () {
  return `
    <div class="grid g2">
      <div class="card">
        <div class="card-h"><span>规格换算</span><span class="todo-badge">孔径 · 开孔率 · 网重</span></div>
        <div class="calc">
          <div class="calc-field"><label>目数 mesh</label><input class="inp num" id="c_mesh" type="number" value="100" oninput="Tools.calc()"></div>
          <div class="calc-field"><label>丝径 mm</label><input class="inp num" id="c_wire" type="number" step="0.01" value="0.10" oninput="Tools.calc()"></div>
        </div>
        <div class="form-row" style="margin-top:14px"><label>材质（影响网重）</label>
          <select class="inp" id="c_mat" onchange="Tools.calc()">
            ${Object.keys(DENSITY).map(k => `<option value="${k}">${k}</option>`).join('')}
          </select>
        </div>
        <div class="calc-out" id="c_out"></div>
        <div class="fx-meta">孔径 = 25.4 ÷ 目数 − 丝径　｜　开孔率 = [孔径 ÷ (孔径 + 丝径)]²</div>
      </div>

      <div class="card">
        <div class="card-h"><span>反推丝径</span><span class="todo-badge">已知目数 + 目标孔径</span></div>
        <div class="calc">
          <div class="calc-field"><label>目数 mesh</label><input class="inp num" id="r_mesh" type="number" value="200" oninput="Tools.reverse()"></div>
          <div class="calc-field"><label>目标孔径 mm</label><input class="inp num" id="r_ap" type="number" step="0.001" value="0.075" oninput="Tools.reverse()"></div>
        </div>
        <div class="calc-out" id="r_out"></div>
        <div class="fx-meta">丝径 d = 25.4 ÷ 目数 − 孔径。同目数可有多种丝径，孔径和开孔率才决定过滤精度，报价前务必和客户确认丝径。</div>
      </div>
    </div>

      <div class="card">
        <div class="card-h"><span>装柜估算</span><span class="todo-badge">丝网按卷算</span></div>
        <div class="calc">
          <div class="calc-field"><label>卷外径 mm</label><input class="inp num" id="k_od" type="number" value="300" oninput="Tools.container()"></div>
          <div class="calc-field"><label>每卷长度 m</label><input class="inp num" id="k_len" type="number" value="30" oninput="Tools.container()"></div>
        </div>
        <div class="calc" style="margin-top:14px">
          <div class="calc-field"><label>幅宽 m</label><input class="inp num" id="k_w" type="number" step="0.01" value="1.22" oninput="Tools.container()"></div>
          <div class="calc-field"><label>卷数</label><input class="inp num" id="k_n" type="number" value="200" oninput="Tools.container()"></div>
        </div>
        <div class="calc-out" id="k_out"></div>
        <div class="fx-meta">按 20GP≈28m³ / 40HQ≈68m³ 可用容积估算，实际以装箱为准</div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>外贸防亏报价</span><span class="todo-badge">含退税 · 自动折算 FOB 美元</span></div>
      <div class="grid g4">
        <div class="form-row"><label>材料 / 原丝成本（元）</label><input class="inp num" id="p_mat" type="number" value="10000" oninput="Tools.quote()"></div>
        <div class="form-row"><label>加工费（元）</label><input class="inp num" id="p_lab" type="number" value="3000" oninput="Tools.quote()"></div>
        <div class="form-row"><label>包装费（元）</label><input class="inp num" id="p_pack" type="number" value="500" oninput="Tools.quote()"></div>
        <div class="form-row"><label>国内运费 + 报关杂费（元）</label><input class="inp num" id="p_dom" type="number" value="1500" oninput="Tools.quote()"></div>
      </div>
      <div class="grid g4">
        <div class="form-row"><label>其他费用（质检等，元）</label><input class="inp num" id="p_other" type="number" value="0" oninput="Tools.quote()"></div>
        <div class="form-row"><label>目标利润率 %</label><input class="inp num" id="p_profit" type="number" value="10" step="0.5" oninput="Tools.quote()"></div>
        <div class="form-row"><label>汇率 1 USD = ? CNY</label><input class="inp num" id="p_fx" type="number" value="7.10" step="0.01" oninput="Tools.quote()"></div>
        <div class="form-row"><label>退税率 %（填 0 不计）</label><input class="inp num" id="p_rebate" type="number" value="13" step="0.5" oninput="Tools.quote()"></div>
      </div>
      <div class="calc-out" id="p_out"></div>
      <div class="fx-meta">进项税率按 13% 计；未含海运费，CIF 报价请加运费后重新折算</div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>常用不锈钢网规格速查表</span><span class="todo-badge">304 · 理论值</span></div>
      <div class="tbl-wrap">
        <table class="ref">
          <tr><th>目数 Mesh</th><th>丝径 (mm)</th><th>孔径 (mm)</th><th>开孔率</th><th>网重 (kg/㎡)</th></tr>
          ${REF_TABLE.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}
        </table>
      </div>
      <div class="fx-meta">同一目数常有多种丝径规格（如 100 目有 0.08 / 0.09 / 0.10 / 0.12mm），上表为常见搭配，接单前以客户具体规格为准。</div>
    </div>`;
};

/* 常用规格速查（304，理论值） */
const REF_TABLE = [
  ['10', '0.60', '1.94', '58.2%', '2.79'],
  ['20', '0.35', '0.92', '52.2%', '2.11'],
  ['30', '0.25', '0.60', '49.6%', '1.53'],
  ['40', '0.20', '0.44', '47.3%', '1.31'],
  ['50', '0.15', '0.36', '50.3%', '0.92'],
  ['60', '0.15', '0.27', '41.3%', '1.10'],
  ['80', '0.12', '0.20', '38.3%', '0.94'],
  ['100', '0.10', '0.154', '36.7%', '0.82'],
  ['120', '0.09', '0.122', '33.3%', '0.80'],
  ['150', '0.065', '0.104', '37.6%', '0.52'],
  ['180', '0.055', '0.086', '37.0%', '0.45'],
  ['200', '0.053', '0.074', '33.8%', '0.46'],
  ['250', '0.040', '0.062', '36.9%', '0.33'],
  ['300', '0.035', '0.050', '34.5%', '0.30'],
  ['350', '0.030', '0.043', '33.6%', '0.26'],
  ['400', '0.025', '0.039', '36.9%', '0.21']
];

const Tools = {
  calc() {
    const g = id => +(document.getElementById(id) || {}).value || 0;
    const mesh = g('c_mesh'), wire = g('c_wire');
    const mat = (document.getElementById('c_mat') || {}).value || '304';
    const out = document.getElementById('c_out');
    if (!out) return;
    if (mesh <= 0) { out.innerHTML = '<div class="calc-out-row">请输入目数</div>'; return; }
    const ap = 25.4 / mesh - wire;
    const open = ap > 0 ? Math.pow(ap / (ap + wire), 2) * 100 : 0;
    const rho = DENSITY[mat] || 7.93;
    const weight = 0.0618 * rho * wire * wire * mesh;   // kg/m²（rho: g/cm³）
    const rollW = weight * 36.6;
    out.innerHTML = `
      <div class="calc-out-row"><span>孔径 aperture</span><b>${ap > 0 ? ap.toFixed(3) : '—'} mm</b></div>
      <div class="calc-out-row"><span>开孔率 open area</span><b>${open.toFixed(1)} %</b></div>
      <div class="calc-out-row"><span>网重（每平米）</span><b>${weight.toFixed(3)} kg/㎡</b></div>
      <div class="calc-out-row"><span>每卷重量（30m × 1.22m）</span><b>${rollW > 0 ? rollW.toFixed(1) : '—'} kg</b></div>`;
  },
  reverse() {
    const g = id => +(document.getElementById(id) || {}).value || 0;
    const n = g('r_mesh'), ap = g('r_ap');
    const out = document.getElementById('r_out');
    if (!out) return;
    if (!(n > 0 && ap > 0)) { out.innerHTML = '<div class="calc-out-row">请填目数和目标孔径</div>'; return; }
    const d = 25.4 / n - ap;
    if (d <= 0) {
      out.innerHTML = '<div class="calc-out-row" style="color:#d97706">⚠ 此孔径大于 25.4 ÷ 目数，丝径算出为负，请检查输入</div>';
      return;
    }
    const open = Math.pow(ap / (ap + d), 2) * 100;
    const weight = 0.0618 * (DENSITY['304']) * d * d * n;
    out.innerHTML = `
      <div class="calc-out-row"><span>所需丝径</span><b>${d.toFixed(3)} mm（${(d * 1000).toFixed(0)} μm）</b></div>
      <div class="calc-out-row"><span>该组合开孔率</span><b>${open.toFixed(1)} %</b></div>
      <div class="calc-out-row"><span>对应网重（304）</span><b>${weight.toFixed(3)} kg/㎡</b></div>`;
  },
  container() {
    const g = id => +(document.getElementById(id) || {}).value || 0;
    const od = g('k_od'), len = g('k_len'), w = g('k_w'), n = g('k_n');
    const out = document.getElementById('k_out');
    if (!out) return;
    const d = (od || 0) / 1000;                    // 卷外径 mm → m
    const width = w > 0 ? w : 1;                   // 幅宽 = 卷的轴向长度（不是卷长！）
    const volPer = Math.PI * Math.pow(d / 2, 2) * width;   // 单卷圆柱体积
    const VOID = 1.27;                             // 圆卷堆码空隙系数 ≈ 1 ÷ (π/4)
    const need = volPer * n * VOID;                // 实占容积
    const gp20 = 28, hq40 = 68;
    const fit = cbm => Math.floor(cbm / (volPer * VOID));
    const area = len * width * n;                  // 总面积 m²
    out.innerHTML = `
      <div class="calc-out-row"><span>单卷体积（Ø${od || 0}mm × ${width}m）</span><b>${volPer.toFixed(4)} m³</b></div>
      <div class="calc-out-row"><span>${n} 卷实占容积（含堆码空隙）</span><b>${need.toFixed(2)} m³</b></div>
      <div class="calc-out-row"><span>总面积（${len || 0}m × ${width}m × ${n}卷）</span><b>${area > 0 ? area.toFixed(1) + ' ㎡' : '—'}</b></div>
      <div class="calc-out-row"><span>占 20GP（28m³）</span><b>${(need / gp20 * 100).toFixed(1)} %　可装约 ${fit(gp20)} 卷</b></div>
      <div class="calc-out-row"><span>占 40HQ（68m³）</span><b>${(need / hq40 * 100).toFixed(1)} %　可装约 ${fit(hq40)} 卷</b></div>`;
  },
  quote() {
    const g = id => +(document.getElementById(id) || {}).value || 0;
    const out = document.getElementById('p_out');
    if (!out) return;
    const cost = g('p_mat') + g('p_lab') + g('p_pack') + g('p_dom') + g('p_other');
    if (cost <= 0) { out.innerHTML = '<div class="calc-out-row"><span>先填一下成本</span></div>'; return; }
    const fx = g('p_fx') || 7;
    const margin = g('p_profit') / 100;
    const rmb = v => '¥' + v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
    const usd = v => '$' + v.toFixed(2);

    const pricePlain = cost * (1 + margin);
    const fobPlain = pricePlain / fx;
    const rebateRate = g('p_rebate') / 100;

    let html = `
      <div class="calc-out-row"><span>总成本</span><b>${rmb(cost)}</b></div>
      <div class="calc-out-row"><span>保本价（零利润）</span><b>¥${cost.toFixed(0)} ≈ ${usd(cost / fx)} FOB</b></div>
      <div class="calc-out-row"><span>报价（含 ${g('p_profit')}% 利润 · 不计退税）</span><b>${rmb(pricePlain)} ≈ ${usd(fobPlain)} FOB</b></div>`;

    if (rebateRate > 0) {
      const net = cost / 1.13;
      const refund = net * rebateRate;
      const costAfter = cost - refund;
      const priceRebate = costAfter * (1 + margin);
      const fobRebate = priceRebate / fx;
      html += `
        <div class="calc-out-row" style="margin-top:6px"><span>退税收入（退税率 ${g('p_rebate')}%）</span><b style="color:#0b7d57">+${rmb(refund)}</b></div>
        <div class="calc-out-row"><span>摊薄后实际成本</span><b>${rmb(costAfter)}</b></div>
        <div class="calc-out-row"><span>同利润率下可报</span><b>${rmb(priceRebate)} ≈ ${usd(fobRebate)} FOB</b></div>
        <div class="calc-out-row"><span>比不退税可让利</span><b style="color:#0b7d57">${usd(fobPlain - fobRebate)} / 批</b></div>`;
    }
    out.innerHTML = html;
  }
};

/* ============ 标准速查 ============ */
const GB = [
  {
    t: '不锈钢丝 GB/T 4240—2019',
    s: '现行 · 替代 GB/T 4240—2009，2020-01-01 实施',
    d: '规定不锈钢丝的分类与牌号、尺寸、外形与技术要求。丝网用原丝的核心标准。',
    tables: [
      {
        h: ['交货状态', '公称尺寸范围', '说明'],
        r: [
          ['软态 soft', '0.05 ~ 16.0 mm', '光亮热处理，或处理后酸洗去氧化皮'],
          ['轻拉 lightly drawn', '0.30 ~ 16.0 mm', '热处理后以较小减面率拉拔到成品尺寸'],
          ['冷拉 cold drawn', '0.10 ~ 12.0 mm', '常温模拉/辊拉成型，丝网行业常用']
        ]
      },
      {
        title: '常用牌号新老对照（标准附录 A：本标准 / ASTM / JIS / EN）',
        h: ['新牌号（国标）', '通用叫法', 'ASTM', 'JIS', 'EN / 数字牌号'],
        r: [
          ['12Cr18Ni9', '302', 'S30200', 'SUS302', 'X10CrNi18-8 / 1.4310'],
          ['06Cr19Ni10', '304', 'S30400', 'SUS304', 'X5CrNi18-10 / 1.4301'],
          ['022Cr19Ni10', '304L', 'S30403', 'SUS304L', 'X2CrNi19-11 / 1.4306'],
          ['06Cr17Ni12Mo2', '316', 'S31600', 'SUS316', 'X5CrNiMo17-12-2 / 1.4401'],
          ['022Cr17Ni12Mo2', '316L', 'S31603', 'SUS316L', 'X2CrNiMo17-12-2 / 1.4404'],
          ['06Cr17Ni12Mo2Ti', '316Ti', 'S31635', 'SUS316Ti', 'X6CrNiMoTi17-12-2 / 1.4571'],
          ['06Cr18Ni11Ti', '321', 'S32100', 'SUS321', 'X6CrNiTi18-10 / 1.4541'],
          ['06Cr25Ni20', '310S', 'S31008', 'SUS310S', 'X6CrNi25-20'],
          ['10Cr17', '430', 'S43000', 'SUS430', 'X6Cr17 / 1.4016'],
          ['12Cr13', '410', 'S41000', 'SUS410', 'X12Cr13 / 1.4006'],
          ['20Cr13', '420', 'S42000', 'SUS420J1', '—']
        ]
      }
    ],
    note: '客户口中的「304 丝」「316L 丝」就是上表的通用叫法；签合同建议写新牌号，避免歧义。'
  },
  {
    t: '工程机编钢丝网用钢丝 YB/T 4221—2016',
    s: '行业标准 · 石笼网 / 格宾网专用',
    d: '镀层类别：镀锌、锌-5%铝-混合稀土、锌-10%铝-混合稀土。',
    tables: [
      {
        title: '镀层钢丝公称直径及允许偏差',
        h: ['公称直径 d (mm)', '允许偏差 I 组', '允许偏差 II 组'],
        r: [
          ['1.80 &lt; d &lt; 2.00', '±0.05', '±0.06'],
          ['2.00 &lt; d &lt; 3.00', '±0.06', '±0.07'],
          ['d ≥ 3.00', '±0.07', '±0.08']
        ]
      },
      {
        title: '覆塑钢丝公称直径及偏差',
        h: ['公称直径 d (mm)', '允许偏差'],
        r: [
          ['2.20 &lt; d &lt; 3.00', '±0.10'],
          ['3.00 &lt; d &lt; 4.00', '±0.15'],
          ['4.00 &lt; d &lt; 6.00', '±0.20']
        ]
      },
      {
        title: '镀层重量要求（g/m²，不小于）',
        h: ['镀层钢丝直径 d (mm)', 'I 组', 'II 组'],
        r: [
          ['1.80 &lt; d &lt; 2.20', '215', '430'],
          ['2.20 &lt; d &lt; 2.50', '230', '460'],
          ['2.50 &lt; d &lt; 2.80', '245', '490'],
          ['2.80 &lt; d &lt; 3.20', '255', '510'],
          ['3.20 &lt; d &lt; 3.80', '265', '530'],
          ['3.80 &lt; d &lt; 4.40', '275', '550'],
          ['d ≥ 4.40', '280', '560']
        ]
      }
    ],
    note: '石笼网出口常被客户要求 II 组高镀层，报价前先确认镀层重量组别——这直接决定成本。'
  },
  {
    t: '钢筋焊接网 GB/T 1499.3—2022',
    s: '现行 · 替代 GB/T 1499.3—2010',
    d: '建筑用焊接网片的现行标准。',
    tables: [
      {
        h: ['项目', '标准要求'],
        r: [
          ['钢筋公称直径', '5 mm ~ 18 mm（其他直径需双方协议）'],
          ['纵向钢筋间距', '宜为 50 mm 的整倍数'],
          ['横向钢筋间距', '宜为 25 mm 的整倍数'],
          ['最小间距', '宜采用 100 mm'],
          ['间距允许偏差', '±10 mm 与规定间距 ±5% 中的较大值'],
          ['网片长宽允许偏差', '±25 mm 与规定尺寸 ±0.5% 中的较大值'],
          ['对角线差', '规定对角线的 ±0.5%'],
          ['开焊限制', '开焊点 ≤ 交叉点总数 1%，单根钢筋开焊 ≤ 其交叉点一半，最外边钢筋交叉点不应开焊'],
          ['焊点抗剪力', '不小于受拉钢筋规定屈服力值的 0.3 倍'],
          ['重量偏差', '实际重量与理论重量偏差 ±4%（理论重量按钢密度 7.85 g/cm³ 计算）']
        ]
      }
    ],
    note: '型号示例：A10-CRB550×CRB550-4800mm×2400mm。出口建筑项目的焊接网，验收重点通常是开焊率和对角线差。'
  },
  {
    t: '钢格栅板 GB/T 4001.1—2019',
    s: '现行 · 平台 / 走道 / 沟盖',
    d: '由承载扁钢与横杆按一定间距正交组合固定而成。',
    tables: [
      {
        h: ['术语', '含义'],
        r: [
          ['承载扁钢', '钢格板中承受荷载的扁钢'],
          ['横杆', '固定于承载扁钢上的扭绞方钢、圆钢或扁钢'],
          ['承载扁钢中心间距', '相邻两条承载扁钢中心到中心的距离（型号核心参数）'],
          ['横杆中心间距', '相邻两条横杆中心到中心的距离'],
          ['压焊钢格板', '交点处压力电阻焊固定，横杆通常为扭绞方钢或圆钢'],
          ['压锁钢格板', '横杆压入预先开槽的承载扁钢中固定']
        ]
      }
    ],
    note: '承载扁钢采用碳素结构钢、低合金高强度结构钢（GB/T 700、GB/T 1591）。2019 版放宽了原材料范围，报价时问清扁钢材质与表面处理（热镀锌 / 冷镀锌 / 不处理）。'
  },
  {
    t: '丝网相关标准清单（19 本）',
    s: '原丝 · 网片 · 格栅 · 网布',
    d: '',
    tables: [
      {
        h: ['标准号', '名称', '用途'],
        r: [
          ['GB/T 4240—2019', '不锈钢丝', '不锈钢丝通用（丝网原丝核心标准）'],
          ['YB/T 096—2015', '高碳铬不锈钢丝', '耐磨耐蚀零部件用'],
          ['GB/T 4356—2025', '不锈钢盘条', '不锈钢丝上游原料'],
          ['GB/T 4226—2009', '不锈钢冷加工钢棒', '冷加工钢棒'],
          ['YB/T 4221—2016', '工程机编钢丝网用钢丝', '石笼网/格宾网用镀层、覆塑钢丝'],
          ['GB/T 4190—2018', '工程用机编钢丝网及组合体', '石笼网及网箱组合体'],
          ['GB/T 1499.3—2022', '钢筋混凝土用钢 第3部分：钢筋焊接网', '建筑用焊接网片'],
          ['GB/T 1499.1—2024', '钢筋混凝土用钢 第1部分：热轧光圆钢筋', '盘条/圆钢筋原料'],
          ['GB/T 1499.2—2024', '钢筋混凝土用钢 第2部分：热轧带肋钢筋', '带肋钢筋原料'],
          ['GB/T 13788—2024', '冷轧带肋钢筋', '冷轧带肋钢筋（CRB 系列）'],
          ['GB/T 4001.1—2019', '钢格栅板及配套件 第1部分：钢格栅板', '平台走道沟盖钢格板'],
          ['GB/T 2518—2019', '连续热镀锌和锌合金镀层钢板及钢带', '镀锌板原料'],
          ['GB/T 709—2019', '热轧钢板和钢带的尺寸、外形、重量及允许偏差', '钢板尺寸偏差'],
          ['GB/T 3274—2017', '碳素结构钢和低合金结构钢热轧钢板和钢带', '普通结构钢板'],
          ['GB/T 1432.1—2022', '公路工程土工合成材料 第1部分：土工格栅', '土工格栅（公路工程）'],
          ['GB/T 173—2005', '玻璃纤维防虫网布', '玻纤防虫网'],
          ['GB/T 561.1—2006', '增强用玻璃纤维网布 第1部分：树脂砂轮用', '玻纤增强网布'],
          ['GB/T 2000—2017', '塑料经编遮阳网', '遮阳网'],
          ['GB/T 2408—2021', '塑料燃烧性能的测定 水平法和垂直法', '塑料类网材阻燃检测']
        ]
      }
    ],
    note: '数据摘自现行国标 / 行标正式文本，以标准原文为准。需要哪本全文，可以从线上端（丝网盒子网页版）加微信索取。'
  }
];

Pages.standards = function () {
  return GB.map(g => `
    <div class="card" style="margin-bottom:14px">
      <div class="sec-h">${g.t}<small>${g.s}</small></div>
      ${g.d ? `<div class="t-sub" style="margin-bottom:12px;font-size:13px">${g.d}</div>` : ''}
      ${g.tables.map(tb => `
        ${tb.title ? `<div style="font-size:13px;font-weight:600;margin:12px 0 8px">${tb.title}</div>` : ''}
        <div style="overflow-x:auto">
          <table class="ref">
            <tr>${tb.h.map(h => `<th>${h}</th>`).join('')}</tr>
            ${tb.r.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
          </table>
        </div>`).join('')}
      ${g.note ? `<div class="note">${g.note}</div>` : ''}
    </div>`).join('');
};

/* ============ 丝网英语 ============ */
const TERMS = [
  ['不锈钢丝网', 'stainless steel wire mesh'], ['镀锌铁丝网', 'galvanized iron wire mesh'],
  ['电焊网', 'welded wire mesh'], ['勾花网', 'chain link fence'],
  ['轧花网', 'crimped wire mesh'], ['六角网', 'hexagonal wire netting'],
  ['钢板网', 'expanded metal mesh'], ['冲孔网', 'perforated metal sheet'],
  ['护栏网', 'fence mesh'], ['窗纱', 'window screen'],
  ['过滤网', 'filter mesh'], ['筛网', 'sieve mesh'],
  ['石笼网', 'gabion box'], ['钢格栅', 'steel grating'],
  ['目数', 'mesh count'], ['丝径', 'wire diameter'],
  ['孔径', 'aperture'], ['开孔率', 'open area'],
  ['幅宽', 'width'], ['卷长', 'roll length'],
  ['平纹编织', 'plain weave'], ['斜纹编织', 'twill weave'],
  ['热镀锌', 'hot-dip galvanized'], ['电镀锌', 'electro galvanized'],
  ['现货', 'in stock'], ['交期', 'lead time'],
  ['离岸价', 'FOB'], ['到岸价', 'CIF']
];

Pages.english = function () {
  const ck = checkinState();
  const half = Math.ceil(TERMS.length / 2);
  const col = arr => arr.map(([cn, en]) =>
    `<div class="fx-row"><span class="t-main">${cn}</span><span class="fx-val" style="font-weight:500;color:var(--accent-deep)">${en}</span></div>`).join('');
  return `
    <div class="grid g2">
      <div class="card">
        <div class="card-h"><span>术语对照（1/2）</span><span class="todo-badge">产品 · 规格</span></div>
        ${col(TERMS.slice(0, half))}
      </div>
      <div class="card">
        <div class="card-h"><span>术语对照（2/2）</span><span class="todo-badge">工艺 · 贸易</span></div>
        ${col(TERMS.slice(half))}
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>常用句子</span><span class="todo-badge">可直接复制给客户</span></div>
      <div style="font-size:13.5px;line-height:2;color:var(--ink)">
        Thanks for your inquiry about our stainless steel wire mesh. May I know the mesh count, wire diameter and roll size you need?<br>
        <span style="color:var(--ink-faint)">感谢询盘，方便告知所需目数、丝径和卷的规格吗？</span><br><br>
        We are a manufacturer in Anping, the wire mesh capital of China.<br>
        <span style="color:var(--ink-faint)">我们是安平的厂家，中国丝网之乡。</span><br><br>
        The price is valid for 30 days due to the fluctuating nickel price.<br>
        <span style="color:var(--ink-faint)">因镍价波动，报价有效期 30 天。</span><br><br>
        Your target price is below our cost. Could you consider SUS201 instead of 304?<br>
        <span style="color:var(--ink-faint)">你的目标价低于我们成本，能否考虑用 201 代替 304？</span>
      </div>
    </div>

    <h3 style="font-size:14px;margin:22px 0 12px;color:var(--ink-soft)">课程（6 门）</h3>
    <div class="grid g3">
      ${COURSES.map(c => `
        <div class="course-card">
          <span class="tag-sm${c.on ? '' : ' off'}">${c.tag}</span>
          <h4>${c.t}</h4>
          <p>${c.d}</p>
        </div>`).join('')}
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>学习打卡</span><span class="todo-badge">记录保存在本机</span></div>
      <div class="streak">累计打卡 <b>${ck.list.length}</b> 天 · 连续 <b>${ck.streak}</b> 天</div>
      <div class="quick" style="margin-top:12px">
        <button class="btn" onclick="doCheckin()"${ck.done ? ' disabled style="opacity:.55;cursor:default"' : ''}>${ck.done ? '✓ 今天已打卡' : '✓ 打卡今天的丝网英语'}</button>
      </div>
      <div class="t-sub" style="margin-top:12px">${ck.recent.length ? '最近：' + ck.recent.join(' · ') : '还没有记录，从今天开始'}</div>
    </div>`;
};

const COURSES = [
  { t: '丝网术语与实用句子速查', tag: '已上线', on: true, d: '丝网品类术语、规格术语（目数、丝径、孔径、编织方式），配询盘、报价、催款、装运实战句子。本页上方即是。' },
  { t: '安平档口开口一百句', tag: '筹备中', on: false, d: '给门店、档口和展会卖家准备的 100 句极简英语：招呼客户、介绍产品、报价议价、确认订单、收款发货。不抠语法，先把生意谈下去。' },
  { t: 'WhatsApp 沟通一百句', tag: '筹备中', on: false, d: '客户不回怎么办、怎么催单不尴尬、怎么报涨价客户能接受。100 句真实聊天场景，原话 + 克制版商务表达各来一遍。' },
  { t: '丝网规格高频单词课', tag: '筹备中', on: false, d: '目数、丝径、孔径、编织、材质、镀层……按产品、规格、检测、包装、物流分类，每个词配释义、搭配和业务例句。' },
  { t: '30 天丝网外贸句子实战', tag: '规划中', on: false, d: '每天 25 句，按真实业务流程排序：开发 → 需求确认 → 报价谈判 → 订单交付 → 售后维护。' },
  { t: '30 天丝网成交话术实战', tag: '规划中', on: false, d: '每天 5–9 句成交话术：价格异议、付款催促、交期风险、样品确认。练会就能直接发客户。' }
];

/* 打卡记录也统一存进数据文件，不再单独用 localStorage */
function dateKey(d) {
  return Store.dayKey(d);
}
function loadCheckins() {
  try { return Store.checkins() || []; } catch (e) { return []; }
}
function checkinState() {
  const list = loadCheckins();
  const today = dateKey(new Date());
  const set = new Set(list);
  let streak = 0;
  const d = new Date();
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  for (;;) {
    if (!set.has(dateKey(d))) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { list, streak, done: set.has(today), recent: [...list].sort().reverse().slice(0, 12) };
}
function doCheckin() {
  const ok = Store.addCheckin(dateKey(new Date()));
  if (!ok) UI.toast('打卡保存失败，请看页面顶部提示');
  UI.render();
}

/* ============ P1-C 报价编辑器集成（定价引擎接入 / 内部核价工作台） ============
 *
 * 渲染进程引擎装载：index.html 没有直接引入 app/pricing.js（P1-C 之前页面不需要引擎）。
 * 这里在 pages.js 解析阶段同步注入一次引擎脚本——parser 插入的 script 会在后续脚本
 * （app.js）与任何 UI 渲染之前执行完毕，UMD 检测到非 module 环境会挂到 window.Pricing。
 * 只装一次；装载失败时核价面板会显示明确错误，不影响其余编辑器功能。
 */
(function () {
  if (typeof self === 'undefined' || self.Pricing) return;
  try {
    document.write('<script src="pricing.js"></script>');
  } catch (e) { /* 引擎不可用时 P1C 面板会在渲染时报错并提示，不静默假装可用 */ }
})();

/*
 * 硬约定（P1-C 任务书）：
 *   · 所有计算调用 app/pricing.js（Pricing，P1-A 冻结引擎），页面不写任何报价公式；
 *   · V5 camelCase ↔ 引擎 snake_case 只在 P1C 适配层转换，不改数据库字段名；
 *   · §3.4 特别注意：V5 costPacking 按每销售单位存储，引擎 cost_packing 收本行总额并
 *     内部÷数量——适配时 engine.cost_packing = doc.costPacking × qty，只在计算层转换一次，
 *     绝不回写数据库（专项测试防包装成本算错）；
 *   · fees[] 多笔费用按 rowId 重新对位后合并成引擎单笔 opts.fee；任一正金额费用未完成
 *     分摊 → 整体 pending，不得静默忽略（费用明细仍分别保存）；
 *   · 手动成交价保护：核价绝不覆盖 price；只有「填入建议价」按钮在明确确认后写入；
 *     final_price=0 不是空值；非法输入不静默转 0；
 *   · 引擎输出只进内部核价面板，绝不写入客户纸面 totals/amount（sheet.js/PDF 零改动）；
 *   · 历史单据保护：打开不自动定价；feeInPrice=null 保持未知；重新定价必须明确选模式；
 *     缺参数不自动填建议价；
 *   · PL 隔离：不渲染任何定价/成本/费用面板（P1-B-FIX-01 剥离规则继续生效）。
 */
const P1C = {
  /* ---------- 常量 ---------- */
  COST_FIELDS: [
    { key: 'costFactory', label: '出厂成本' },
    { key: 'costPacking', label: '包装成本' },
    { key: 'costInland', label: '国内运费' },
    { key: 'costOther', label: '其他成本' }
  ],
  /* 贸易术语/运费项目一律读引擎常量，不复制独立规则（§6.2/§6.3） */
  TERMS() { return Pricing.INCOTERMS; },
  FREIGHT_KEYS() { return Object.keys(Pricing.FREIGHT_ITEMS); },

  /* ---------- 输入层（成本/规格/确认态） ---------- */
  setSpecText(i, v) {
    const it = QuoteEdit.draft && QuoteEdit.draft.items[i];
    if (!it) return;
    const s = String(v == null ? '' : v);
    /* 留空 = null（未填写），不是空串假填 */
    it.specText = s.trim() === '' ? null : s.slice(0, 2000);
    Doc.markDirty();
  },
  setCostField(i, f, v) {
    const it = QuoteEdit.draft && QuoteEdit.draft.items[i];
    if (!it || P1C.COST_FIELDS.every(c => c.key !== f)) return;
    const key = i + ':' + f;
    const raw = String(v == null ? '' : v).trim();
    if (raw === '') {
      it[f] = null;                                  /* 留空 = 未填写（null），绝不自动转 0 */
      delete QuoteEdit.costInvalid[key];
    } else {
      const n = Number(raw);
      if (!isFinite(n) || n < 0 || n > 1e12) {
        it[f] = raw;                                 /* 保留原输入文本，不猜 */
        QuoteEdit.costInvalid[key] = { raw, msg: P1C.COST_FIELDS.find(c => c.key === f).label + '不是有效数字或为负数', row: i };
      } else {
        it[f] = n;
        delete QuoteEdit.costInvalid[key];
      }
    }
    Doc.markDirty();
    P1C.markStale();                                  /* BUG-04：成本修改 → 核价结果过期 */
    P1C.renderRowCostState(i);
  },
  setCostConfirmed(i, v) {
    const it = QuoteEdit.draft && QuoteEdit.draft.items[i];
    if (!it) return;
    /* '' = 未确认（null，未知）；1 = 已确认；0 = 明确未确认——三态显式，不自动升级 */
    it.costConfirmed = v === '1' ? true : (v === '0' ? false : null);
    Doc.markDirty();
    P1C.markStale();                                  /* BUG-04：成本确认变化 → 核价结果过期 */
    Doc.refresh();
  },
  inputInvalidList() {
    return Object.keys(QuoteEdit.costInvalid || {}).map(k => {
      const p = k.split(':');
      return Object.assign({ row: +p[0], field: p[1] }, QuoteEdit.costInvalid[k]);
    }).sort((a, b) => (a.row - b.row) || (a.field < b.field ? -1 : 1));
  },
  renderRowCostState(i) {
    const el = document.getElementById('qe_sug_' + i);
    const t = QuoteEdit.pricingResult;
    if (el && t && t.items && t.items[i] && t.items[i].suggested_price != null) {
      el.textContent = Pricing.ceil2(t.items[i].suggested_price).toFixed(2);
    }
  },
  /* ---------- 价格保护（§七） ---------- */
  applySuggestedPrice(i) {
    const d = QuoteEdit.draft, it = d && d.items[i];
    const r = QuoteEdit.pricingResult;
    /* P1-C-FIX-01 BUG-03：整个核价结果必须 ready=true 才允许填价——
       存在 blocker、待分摊、成本未确认或其他正式核价条件不满足时，
       即使结果对象里带着 suggested_price 也不能绕过 ready 门。 */
    if (!r || r.ready !== true) { UI.toast('核价结果未达到正式条件（存在阻断项、待分摊或成本未确认）——不能填入建议价'); return; }
    const sug = r && r.items && r.items[i] && r.items[i].suggested_price;
    if (sug == null || !(sug > 0)) { UI.toast('这一行还没有可用的建议价：先点「开始核价」，等所有阻断条件解除'); return; }
    if (QuoteEdit.pricingStale) { UI.toast('参数或明细改过之后还没重新核价——先点「开始核价」刷新，再填入'); return; }
    const v = Pricing.ceil2(sug);
    const token = QuoteEdit.pricingToken;                 /* BUG-04：回调执行前再次核实结果仍有效 */
    const writeIn = () => {
      /* 确认弹窗期间用户可能又改了成本/费用/参数：令牌对不上或已过期 → 拒绝写入 */
      if (QuoteEdit.pricingStale || QuoteEdit.pricingToken !== token) {
        UI.toast('核价结果已经过期（参数或明细改过）——请重新核价后再填入，这次没有写入');
        UI.render();
        return;
      }
      it.price = v;                                   /* 只有这一条路径允许把建议价写进成交单价 */
      delete QuoteEdit.invalid[i + ':price'];
      Doc.markDirty();
      UI.toast('已填入建议价 ' + v.toFixed(2) + '（可继续手改，改动不会再被自动覆盖）');
      UI.render();
    };
    const cur = it.price;
    /* 已有成交价（含 0——0 价报价是能直接发出去的，不是空值）：必须明确确认才替换 */
    if (cur != null && String(cur).trim() !== '') {
      UI.confirm('替换已有成交价',
        `这一行已有成交单价 <b>${esc(String(cur))}</b>，要替换成建议价 <b>${v.toFixed(2)}</b> 吗？<br>手动成交价不会被自动覆盖；只有你在确认后才会替换。`,
        writeIn);
    } else {
      writeIn();
    }
  },

  /* ---------- V5 → 引擎适配层（§6.1/§6.2/§6.4/§6.5） ---------- */
  numOrNull(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; },
  rowIdOf(it) {
    return (it && typeof it._rowId === 'string' && it._rowId) ? it._rowId
      : ((it && typeof it.id === 'string' && it.id) ? it.id : null);
  },
  engineItems(d) {
    return (d.items || []).map((it, i) => ({
      sort: i,
      name_en: it.nameEn || it.nameCn || '',
      qty: (+it.qty || 0),
      unit: String(it.unit == null ? '' : it.unit),
      cost_factory: P1C.numOrNull(it.costFactory),
      /* §3.4：每销售单位 → 本行总额，转换只发生这一次；引擎内部再÷数量还原每件。
         null 原样传 null（引擎按"成本未填写"阻断），不静默转 0。 */
      cost_packing: P1C.numOrNull(it.costPacking) == null ? null : it.costPacking * (+it.qty || 0),
      cost_inland: P1C.numOrNull(it.costInland),
      cost_other: P1C.numOrNull(it.costOther),
      cost_confirmed: it.costConfirmed === true,
      final_price: (it.price == null || String(it.price).trim() === '' || !isFinite(+it.price)) ? null : +it.price
    }));
  },
  /* 分摊记录按 rowId 重新对位到当前行下标；行被删了 → broken（pending，不猜不串） */
  mapFeeAllocations(fee, d) {
    const items = d.items || [];
    const allocs = Array.isArray(fee && fee.allocations) ? fee.allocations : null;
    if (!allocs || !allocs.length) return { allocations: null };
    const out = [];
    for (let i = 0; i < allocs.length; i++) {
      const a = allocs[i];
      if (!a || typeof a !== 'object') return { broken: true };
      let sort = null;
      if (typeof a.rowId === 'string' && a.rowId) {
        const idx = items.findIndex(it => P1C.rowIdOf(it) === a.rowId);
        if (idx < 0) return { broken: true };           /* 产品行增删后旧分摊不再对位 → 待重新分摊 */
        sort = idx;
      } else if (typeof a.sort === 'number' && isFinite(a.sort)) {
        sort = a.sort;                                  /* 旧格式无 rowId：按存储 sort 原样使用 */
      } else {
        return { broken: true };
      }
      out.push({ sort: sort, amountCny: a.amountCny });
    }
    out.sort((x, y) => x.sort - y.sort);
    return { allocations: out };
  },
  /* fees[] → 引擎单笔 opts.fee（§4.5 适配函数）：
     汇总所有有效费用、按 sort 合并各行分摊金额；任一正金额费用未完成分摊 → 整体 pending。
     零金额费用（amountCny=0）按引擎语义是 'none'，不参与合并但状态如实显示。
     P1-C-FIX-01 BUG-01：金额缺失/非法/负数/超两位小数 → invalid——绝不转成零费用传引擎
     （引擎把 0 当"没有费用"，会误放行正式建议价）；此时适配层不给引擎任何费用对象，
     由 run() 以 dataIssue 形式把 ready 压成 false 并清空建议价。 */
  validFeeAmount(f) {
    if (!f || typeof f !== 'object') return null;
    const a = f.amountCny;
    if (typeof a !== 'number' || !isFinite(a) || a < 0) return null;
    if (Math.abs(a * 100 - Math.round(a * 100)) > 1e-6) return null;   /* >2 位小数：非法，不自动舍入 */
    return a;
  },
  twoDecimals(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) <= 1e-6; },
  engineFee(d, engItems) {
    const fees = Array.isArray(d.fees) ? d.fees : [];
    const states = [];
    let total = 0, pendingSum = 0, anyPending = false, anyInvalid = false;
    const bySort = {};
    fees.forEach(f => {
      const amt = P1C.validFeeAmount(f);
      if (amt === null) { states.push({ fee: f, status: 'pending', reason: '金额未填写或非法（不按零费用处理）' }); anyInvalid = true; return; }
      if (amt === 0) { states.push({ fee: f, status: 'none' }); return; }
      const mapped = P1C.mapFeeAllocations(f, d);
      const status = Pricing.allocationStatus(engItems, { amountCny: amt, allocations: mapped.allocations });
      states.push({ fee: f, status: status, reason: mapped.broken ? '明细行已变化，原分摊不再对位' : '' });
      if (status === 'pending') { anyPending = true; pendingSum = Math.round((pendingSum + amt) * 100) / 100; return; }
      total = Math.round((total + amt) * 100) / 100;
      (mapped.allocations || []).forEach(a => {
        bySort[a.sort] = Math.round(((bySort[a.sort] || 0) + a.amountCny) * 100) / 100;
      });
    });
    /* BUG-01：任一费用金额缺失/非法 → 整体按"数据不完整"阻断；给引擎的费用对象为 null
       （不是 0），pending 同步置真——P1C.run 的状态与费用分摊状态保持一致。 */
    if (anyInvalid) return { fee: null, states, pending: true, invalid: true };
    /* 任一正金额费用未完成分摊：整体保持 pending——必须把 pending 信号传给引擎
       （即使没有已完成的费用可汇总，也要传无分摊的费用对象让引擎阻断正式建议价） */
    if (anyPending) return { fee: { amountCny: total || pendingSum, allocations: null }, states, pending: true, invalid: false };
    if (!(total > 0)) return { fee: null, states, pending: false, invalid: false };
    const allocations = Object.keys(bySort).map(Number).sort((a, b) => a - b).map(s => ({ sort: s, amountCny: bySort[s] }));
    return { fee: { amountCny: total, allocations: allocations }, states, pending: false, invalid: false };
  },
  /* 单据内部定价扩展字段视图（不落草稿）：历史单据没有 _unknown.pricing 时给种子视图，
     打开/渲染绝不改历史数据；只有用户在面板里明确编辑后才写入草稿。 */
  pricingExtView(d) {
    const p = d && d._unknown && typeof d._unknown === 'object' ? d._unknown.pricing : null;
    const src = (p && typeof p === 'object') ? p : {};
    return {
      incoterm: typeof src.incoterm === 'string' ? src.incoterm : '',
      namedPlace: typeof src.namedPlace === 'string' ? src.namedPlace : '',
      freight: Array.isArray(src.freight) ? src.freight : [],
      extra: (src.extra && typeof src.extra === 'object') ? src.extra : { discount: 0, other_charges: 0 },
      persisted: !!p
    };
  },
  build(d) {
    const engItems = P1C.engineItems(d);
    const pe = P1C.pricingExtView(d);
    const fee = P1C.engineFee(d, engItems);
    const q = {
      fx: P1C.numOrNull(d.fx),
      fee_rate: P1C.numOrNull(d.feeRate),
      target_margin: P1C.numOrNull(d.targetMargin),
      commission_rate: P1C.numOrNull(d.commissionRate),
      freight_markup: P1C.numOrNull(d.freightMarkup),
      fee_in_price: (d.feeInPrice === 0 || d.feeInPrice === 1) ? d.feeInPrice : null,
      incoterm: pe.incoterm || '',
      named_place: pe.namedPlace || '',
      payment_terms: d.payment || '',
      buyer_company: (d.customer && d.customer.company) || '',
      buyer_contact: (d.customer && d.customer.name) || '',
      customer_id: (d.customer && d.customer.id) || null
    };
    /* 运费行读引擎 FREIGHT_ITEMS 常量逐项成行；未录入的行显式 amount=0 + 未确认
       （引擎语义：零金额也须核实；ready 要求全部行已确认）。
       P1-C-FIX-01 BUG-02：已录入的行不再静默修正——金额缺失保持 null（不转 0）、
       币种非法保持 null（不换成默认币种）、超两位小数原样保留（不四舍五入）；
       这些都会进 dataIssues，由 run() 压成 ready=false。 */
    const dataIssues = [];
    const freight = P1C.FREIGHT_KEYS().map(k => {
      const row = pe.freight.find(x => x && x.item === k);
      const cur = (Pricing.FREIGHT_ITEMS[k] || ['', 'USD'])[1];
      if (!row) return { item: k, amount: 0, currency: cur, confirmed: false, charge_customer: false, included_in_cost: false };
      const amt = P1C.numOrNull(row.amount);
      if (amt === null) dataIssues.push('运费「' + ((Pricing.FREIGHT_ITEMS[k] || [k])[0]) + '」金额未填写或不是有效数字（不按零运费处理）');
      else if (amt < 0) dataIssues.push('运费「' + ((Pricing.FREIGHT_ITEMS[k] || [k])[0]) + '」金额为负数');
      else if (!P1C.twoDecimals(amt)) dataIssues.push('运费「' + ((Pricing.FREIGHT_ITEMS[k] || [k])[0]) + '」金额 ' + row.amount + ' 超过两位小数——请修正，系统不会自动舍入');
      const curOk = row.currency === 'CNY' || row.currency === 'USD';
      if (!curOk) dataIssues.push('运费「' + ((Pricing.FREIGHT_ITEMS[k] || [k])[0]) + '」币种未填写或非法（不会自动替换成默认币种）');
      return {
        item: k,
        amount: amt,
        currency: curOk ? row.currency : null,
        confirmed: row.confirmed === true,
        charge_customer: row.charge_customer === true,
        included_in_cost: row.included_in_cost === true
      };
    });
    const ex = pe.extra || {};
    const extraVal = k => (typeof ex[k] === 'number' && isFinite(ex[k])) ? ex[k] : null;
    /* BUG-02.3：null（未填写）与明确数字 0 区分——null 进 dataIssues，不静默转 0 */
    ['discount', 'other_charges'].forEach(k => {
      const v = extraVal(k);
      if (v === null) dataIssues.push((k === 'discount' ? '整单折扣' : '其他费用') + '未填写（留空=未核实，不按零处理）');
      else if (v < 0) dataIssues.push((k === 'discount' ? '整单折扣' : '其他费用') + '为负数');
      else if (!P1C.twoDecimals(v)) dataIssues.push((k === 'discount' ? '整单折扣' : '其他费用') + ' ' + v + ' 超过两位小数——请修正，系统不会自动舍入');
    });
    /* 给引擎的 extra 须为数字（引擎口径）；数据不完整时传 0 仅为引擎稳定运行，
       核价状态由 dataIssues 强制 ready=false，不会产生可正式填入的建议价。 */
    const extra = {
      discount: extraVal('discount') == null ? 0 : extraVal('discount'),
      other_charges: extraVal('other_charges') == null ? 0 : extraVal('other_charges')
    };
    return { q, engItems, freight, extra, fee, dataIssues };
  },
  /* 核价入口（§6.4 币种边界 + §6.5 实时展示）：只算不写；
     pricingVersion 在用户实际使用引擎（点「开始核价」）后记录。 */
  run(d) {
    d = d || QuoteEdit.draft;
    if (!d) return null;
    if ((d.currency || 'USD') !== 'USD') {
      return { ready: false, currencyBlocked: true,
        warnings: ['定价引擎当前仅支持 USD 报价：本单币种是 ' + (d.currency || '（未填）') +
          '，自动核价已停用；可继续手动报价，或把本单币种改为 USD 后再核价。'],
        blockers: [], items: (d.items || []).map(() => ({ suggested_price: null, used_price: null })), totals: {} };
    }
    const input = P1C.build(d);
    const r = Pricing.computeQuote(input.q, input.engItems, input.freight, input.extra, null, { fee: input.fee.fee });
    r.feeStates = input.fee.states;
    r.feePending = input.fee.pending;
    r.dataIssues = input.dataIssues.slice();
    /* P1-C-FIX-01 BUG-01/BUG-02：费用缺失或非法、运费/折扣未填写或非法 → 统一压成
       ready=false、清空全部建议价——不产生可正式填入的建议价，状态与费用分摊状态一致。 */
    if (input.fee.invalid || input.dataIssues.length) {
      const msgs = [];
      if (input.fee.invalid) msgs.push('存在金额缺失或非法的费用——不按零费用处理，请补全合法金额或删除该费用');
      if (input.dataIssues.length) msgs.push.apply(msgs, input.dataIssues);
      r.ready = false;
      r.blockers = (r.blockers || []).concat(msgs);
      r.warnings = (r.warnings || []).concat(msgs);
      (r.items || []).forEach(x => { x.suggested_price = null; });
    }
    return r;
  },
  startPricing() {
    const d = QuoteEdit.draft;
    if (!d) return;
    if (d.type === 'PL') { UI.toast('装箱单没有金额，不参与核价'); return; }
    QuoteEdit.pricingResult = P1C.run(d);
    QuoteEdit.pricingStale = false;
    QuoteEdit.pricingToken = (QuoteEdit.pricingToken || 0) + 1;   /* BUG-04：新结果 → 新令牌（旧的确认回调全部失效） */
    P1C.hideStaleMark();                                          /* P1-D-02c：重新核价 → 过期提示立即消失（render 会按新状态重渲，双保险） */
    /* 实际使用定价引擎后才记录引擎版本（§5.4）；这是草稿编辑，不自动落盘 */
    if (d.pricingVersion !== Pricing.PRICING_VERSION) {
      d.pricingVersion = Pricing.PRICING_VERSION;
      Doc.markDirty();
    }
    UI.render();
    const r = QuoteEdit.pricingResult;
    if (r && !r.ready) {
      const first = (r.blockers && r.blockers.length) ? r.blockers[0] : ((r.warnings && r.warnings[0]) || '');
      UI.toast('未达到正式核价条件' + (first ? '：' + first : '') + '——明细见面板（引擎输出仅供参考，不会写进单据）');
    }
  },
  markStale() {
    /* P1-C-FIX-01 BUG-04：所有影响核价的操作统一走这里——成本/确认态/数量单位/产品切换/
       行增删/成交价/费用/运费/汇率/手续费/加成率/币种/贸易术语修改后，现有结果一律过期，
       禁止填价，直到用户重新核价且 ready=true。无结果时也递增令牌（无害，防漏标）。 */
    QuoteEdit.pricingStale = true;
    QuoteEdit.pricingToken = (QuoteEdit.pricingToken || 0) + 1;
    /* P1-D-02c：过期提示实时显示——直接更新核价汇总卡内的提示，不调 UI.render()（避免输入框失焦）。
       页面还没渲染出提示节点（或 Node 测试环境无 DOM）时静默跳过，渲染时按 pricingStale 呈现。 */
    P1C.showStaleMark();
  },
  /* P1-D-02c：过期提示的直接 DOM 更新（只切显示态，不动其他节点）。 */
  showStaleMark() {
    try {
      const el = document.getElementById('p1c_stale_mark');
      if (el) el.style.display = 'inline';
    } catch (e) { /* 无 document 环境（Node VM 测试）静默 */ }
  },
  hideStaleMark() {
    try {
      const el = document.getElementById('p1c_stale_mark');
      if (el) el.style.display = 'none';
    } catch (e) { /* 无 document 环境（Node VM 测试）静默 */ }
  },

  /* ---------- 定价参数面板（§5） ---------- */
  setPricingParam(f, raw) {
    const d = QuoteEdit.draft;
    if (!d || d.type === 'PL') return;
    const s = String(raw == null ? '' : raw).trim();
    if (f === 'feeInPrice') {
      /* 模式必须由用户明确选择：含费=1 / 不含费=0；历史单据保持未知直到用户选 */
      const mode = s === '' ? null : +s;
      d.feeInPrice = (mode === 0 || mode === 1) ? mode : null;
      /* 切换模式必须重新换算（§5.2）：以加成率为主要输入重新推导，不沿用另一模式的值 */
      if (d.markupRate != null && d.feeInPrice != null && d.feeRate != null) {
        const m = Pricing.marginFromMarkupForMode(d.markupRate, d.feeRate, d.feeInPrice);
        d.targetMargin = (m == null) ? null : m;
      }
    } else if (f === 'fx') {
      d.fx = (s !== '' && isFinite(+s) && +s > 0 && +s <= 1e6) ? +s : null;
      if (s !== '' && d.fx == null) UI.toast('汇率必须是大于 0 的数字（已按未填写处理，不会自动猜）');
    } else if (f === 'freightMarkup') {
      /* 运费加价率允许明确填写 0 */
      d.freightMarkup = (s !== '' && isFinite(+s) && +s >= 0 && +s < 10) ? +s : null;
      if (s !== '' && d.freightMarkup == null) UI.toast('运费加价率须为非负数字（已按未填写处理）');
    } else {
      /* feeRate / markupRate / commissionRate：百分数输入 → 小数存储 */
      const pct = (s !== '' && isFinite(+s) && +s >= 0 && +s < 100) ? Math.round((+s / 100) * 10000) / 10000 : null;
      d[f] = pct;
      if (f === 'markupRate' && s === '') d.targetMargin = null;   /* 加成率清空 → 目标利润率不再有效 */
      if (s !== '' && pct == null) UI.toast('比率须在 0–100 之间（已按未填写处理）');
      /* 加成率变化后重新换算目标利润率 */
      if (d.markupRate != null && d.feeRate != null && d.feeInPrice != null) {
        const m = Pricing.marginFromMarkupForMode(d.markupRate, d.feeRate, d.feeInPrice);
        d.targetMargin = (m == null) ? null : m;
      }
    }
    P1C.markStale();
    Doc.markDirty();
    /* P1-D-02c：不再每次输入整页 UI.render()（避免输入框失焦）——
       过期提示由 markStale→showStaleMark 直接更新；
       模式/换算说明两个纯文本块（不含输入框）定向更新，焦点保持。 */
    P1C.renderParamNotes();
  },
  /* P1-D-02c：高级参数卡的纯文本说明块定向更新（不含任何输入元素，更新不失焦）。 */
  renderParamNotes() {
    const d = QuoteEdit.draft;
    if (!d || d.type === 'PL') return;
    try {
      const modeEl = document.getElementById('p1c_param_mode');
      if (modeEl) modeEl.innerHTML = P1C.paramModeHTML(d);
      const noteEl = document.getElementById('p1c_param_mode_note');
      if (noteEl) noteEl.innerHTML = P1C.paramModeNoteHTML(d);
      const convEl = document.getElementById('p1c_param_conv');
      if (convEl) convEl.innerHTML = P1C.paramConvHTML(d);
    } catch (e) { /* 无 document 环境（Node VM 测试）静默 */ }
  },
  paramModeHTML(d) {
    const modeTxt = d.feeInPrice === 1 ? '含费（手续费计入售价）' : d.feeInPrice === 0 ? '不含费（老法，费率从利润扣）' : '未知（历史单据，重新定价前必须明确选择）';
    return '当前模式：' + esc(modeTxt) + ' · 引擎版本快照：' + esc(d.pricingVersion || '未使用（核价后记录）');
  },
  paramModeNoteHTML(d) {
    return d.feeInPrice == null
      ? '<div class="t-sub" style="color:#b45309">这张单的手续费模式未知（历史数据）。系统不会自动套用新模式；要重新定价请先在下面明确选择含费或不含费。</div>'
      : '';
  },
  paramConvHTML(d) {
    if (!(d.markupRate != null && d.feeRate != null && (d.feeInPrice === 0 || d.feeInPrice === 1))) return '';
    const tm = Pricing.marginFromMarkupForMode(d.markupRate, d.feeRate, d.feeInPrice);
    const af = Pricing.afterFeeMarginFromMode(tm, d.feeRate, d.feeInPrice);
    return `<div class="t-sub" style="margin-top:6px">
      引擎目标利润率（内部口径，非传统毛利率）：<b>${tm == null ? '无法换算' : (tm * 100).toFixed(2) + '%'}</b>
      ${` · 手续费后实际目标利润率：<b>${af == null ? '无法换算' : (af * 100).toFixed(2) + '%'}</b>`}
      ${d.feeInPrice === 0 ? '<br>不含费模式下引擎目标利润率<b>没有扣手续费</b>，两者不同，请勿混用。' : ''}
    </div>`;
  },
  /* P1-D-05：顶部「报价计算参数」条 —— 按原版 RunCheng V2 顺序把常用定价参数上移。
     只移动既有输入，不新增任何写入链 / 数据字段；目标毛利率与亏损规则是引擎派生只读口径
     （pricing.js 未改动、Schema V5 未升级）。 */
  pricingParamsBarHTML(d) {
    const pct = v => (v == null ? '' : String(Math.round(v * 10000) / 100));
    const pe = P1C.pricingExtView(d);
    const ic = pe.incoterm || '';
    const named = ic && ic !== 'EXW';
    return `
    <div class="card qe-card rc-card" id="rc_params_card">
      <div class="card-h"><span>报价计算参数</span><span class="todo-badge">原版口径：FX / 目标毛利率 / 销售费率 / 提成 / 亏损规则</span></div>
      <div class="rc-params-grid">
        <div class="rc-param-cell"><label>报价汇率 fx（1 USD = ? CNY）</label>
          <input class="inp num" type="number" min="0" step="0.0001" placeholder="必须大于 0；留空=未填写" value="${d.fx == null ? '' : d.fx}" oninput="P1C.setPricingParam('fx', this.value)"></div>
        <div class="rc-param-cell"><div class="rc-param-k">目标毛利率（引擎派生，只读）</div>
          <div class="rc-param-readonly" id="p1c_param_conv">${P1C.paramConvHTML(d) || '<span class="t-sub">填全加成率 / 手续费率 / 手续费模式后显示换算值</span>'}</div>
          <div class="t-sub">由产品加成率经 pricing.js 换算，不是独立写入字段。</div></div>
        <div class="rc-param-cell"><label>销售手续费率 feeRate（%）</label>
          <input class="inp num" type="number" min="0" max="100" step="0.01" placeholder="%" value="${pct(d.feeRate)}" oninput="P1C.setPricingParam('feeRate', this.value)"></div>
        <div class="rc-param-cell"><label>个人提成率 commissionRate（%）</label>
          <input class="inp num" type="number" min="0" max="100" step="0.01" placeholder="%" value="${pct(d.commissionRate)}" oninput="P1C.setPricingParam('commissionRate', this.value)"></div>
        <div class="rc-param-cell"><label>产品加成率 markupRate（%）</label>
          <input class="inp num" type="number" min="0" max="100" step="0.01" placeholder="%（主要输入；留空=未填写）" value="${pct(d.markupRate)}" oninput="P1C.setPricingParam('markupRate', this.value)"></div>
        <div class="rc-param-cell"><div class="rc-param-k">亏损规则（引擎固定口径，只读）</div>
          <div class="rc-param-readonly">亏损订单个人提成为 0（zero_on_loss）</div>
          <div class="t-sub">2026-11-04 管理层批准，固化在 app/pricing.js；本阶段不改引擎。</div></div>
      </div>
      <div class="t-sub" style="margin-top:8px">费用分摊、运费明细、核价汇总等内部核算细节折叠在下方「内部核价」区；以上参数不会出现在客户纸面。</div>
    </div>`;
  },
  /* P1-D-05：常用定价参数已上移到顶部参数条，本卡只留手续费模式 / 运费加价率 / 模板选择
     等内部细节；字段与写入链零删减，卡片 id 与标题保持不变。 */
  advancedParamsHTML(d) {
    const pct = v => (v == null ? '' : String(Math.round(v * 10000) / 100));
    const cur = d.currency || 'USD';
    const usd = cur === 'USD';
    return `
    <div class="card qe-card" id="p1c_pricing_panel">
      <div class="card-h"><span>高级 / 内部参数</span><span class="todo-badge">内部核价用；纸面单据不受影响</span></div>
      ${usd ? '' : `<div class="notice-item n-warn" style="margin-bottom:10px"><b>定价引擎当前仅支持 USD 报价。</b>本单币种是 ${esc(cur)}：自动核价停用，可继续手动报价；把币种改成 USD 后再核价。</div>`}
      <div class="form-2">
        <div class="form-row"><label>手续费模式 feeInPrice</label>
          <select class="inp" onchange="P1C.setPricingParam('feeInPrice', this.value)">
            <option value=""${d.feeInPrice == null ? ' selected' : ''}>未知（历史单据）</option>
            <option value="1"${d.feeInPrice === 1 ? ' selected' : ''}>含费（新报价默认）</option>
            <option value="0"${d.feeInPrice === 0 ? ' selected' : ''}>不含费（老法）</option>
          </select>
        </div>
        <div class="form-row"><label>运费加价率 freightMarkup</label>
          <input class="inp num" type="number" min="0" step="0.01" placeholder="%（可明确填 0；留空=待填写）" value="${pct(d.freightMarkup)}" oninput="P1C.setPricingParam('freightMarkup', this.value)"></div>
      </div>
      <div class="t-sub" style="margin-top:4px" id="p1c_param_mode">${P1C.paramModeHTML(d)}</div>
      <div id="p1c_param_mode_note">${P1C.paramModeNoteHTML(d)}</div>
      <div class="rc-sep"></div>
      ${Doc.templateSelectHTML()}
    </div>`;
  },
  pricingResultCardHTML(d) {
    const r = QuoteEdit.pricingResult;
    const resultHTML = r ? P1C.resultHTML(d, r) : `<div class="t-sub">点「开始核价」后在这里显示成本、建议售价与利润核算（只算不写，结果仅供内部核价使用；不会出现在给客户的纸面上）。</div>`;
    return `
    <div class="card qe-card" id="p1c_result_card">
      <div class="card-h"><span>核价汇总</span><span class="todo-badge">只算不写；正式价格以每行成交单价为准</span></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn" onclick="P1C.startPricing()">开始核价 / 刷新</button>
        <!-- P1-D-02c：过期提示常驻 DOM + 稳定 id（p1c_stale_mark），markStale 直接更新显示态，
             成本/运费/参数修改走轻量刷新时提示立即出现，不整页 render（输入框不失焦） -->
        <span id="p1c_stale_mark" style="color:#b45309;font-size:12.5px;display:${QuoteEdit.pricingStale ? 'inline' : 'none'}">● 参数或明细改过，结果已过期</span>
      </div>
      <div style="margin-top:10px">${resultHTML}</div>
    </div>`;
  },
  resultHTML(d, r) {
    const money2 = (v, c) => (v == null || !isFinite(+v)) ? '—' : money(Pricing.r2(+v), c || 'USD');
    const pctTxt = (v, digits) => (v == null || !isFinite(+v)) ? '—' : (+(+v * 100).toFixed(digits == null ? 2 : digits)) + '%';
    const t = r.totals || {};
    const head = r.ready
      ? '<span style="color:#15803d"><b>已达到正式核价条件</b></span>'
      : '<span style="color:#b45309"><b>未达到正式核价条件</b>（以下结果仅供参考，不能作为正式报价依据）</span>';
    if (r.currencyBlocked) {
      return `<div class="t-sub">${head}</div><ul style="margin:6px 0 0 18px;font-size:12.5px">${(r.warnings || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
    }
    const itemRows = (r.items || []).map((it, i) => {
      const src = (d.items || [])[i] || {};
      return `<tr><td>${i + 1}</td><td>${esc(String(src.nameCn || '').slice(0, 16) || '—')}</td>
        <td class="num">${it.cost_total_cny == null ? '—' : Pricing.r2(it.cost_total_cny).toFixed(2)}</td>
        <td class="num">${it.cost_usd == null ? '—' : Pricing.r4(it.cost_usd).toFixed(4)}</td>
        <td class="num">${it.suggested_price == null ? '—' : Pricing.ceil2(it.suggested_price).toFixed(2)}</td>
        <td class="num">${it.used_price == null ? '—' : Pricing.ceil2(it.used_price).toFixed(2)}</td>
        <td class="num">${pctTxt(it.item_margin, 1)}</td>
        <td class="num">${pctTxt(it.markup_on_cost, 1)}</td></tr>`;
    }).join('');
    const warnList = (r.warnings || []).length
      ? `<ul style="margin:6px 0 0 18px;font-size:12.5px;color:#b45309">${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '';
    const feeStateList = (r.feeStates || []).length
      ? `<div class="t-sub" style="margin-top:6px">费用状态：${r.feeStates.map(s => {
          const label = String((s.fee && s.fee.label) || '未命名费用');
          const txt = s.status === 'auto' ? '自动分摊' : s.status === 'manual' ? '人工分摊' : s.status === 'none' ? '零费用' : '待分摊';
          return `「${esc(label.slice(0, 12))}」${txt}` + (s.reason ? '（' + esc(s.reason) + '）' : '');
        }).join('；')}</div>` : '';
    return `
      <div class="t-sub">${head}${r.feePending ? ' · <b style="color:#b45309">存在待分摊费用：不给正式含费用建议价</b>' : ''}</div>
      <table class="tb" style="margin-top:8px"><tr><th>#</th><th>品名</th><th>单位总成本 CNY</th><th>单位成本 USD</th><th>建议售价</th><th>当前售价</th><th>实际利润率</th><th>加成率</th></tr>${itemRows}</table>
      <div class="form-2" style="margin-top:10px;font-size:12.5px">
        <div class="fx-row"><span class="fx-name">订单收入</span><span class="fx-val">${money2(t.revenue)}</span></div>
        <div class="fx-row"><span class="fx-name">实际运费</span><span class="fx-val">${money2(t.freight_actual_usd)}</span></div>
        <div class="fx-row"><span class="fx-name">客户承担运费</span><span class="fx-val">${money2(t.freight_charged_usd)}</span></div>
        <div class="fx-row"><span class="fx-name">销售手续费</span><span class="fx-val">${money2(t.sales_fee)}</span></div>
        <div class="fx-row"><span class="fx-name">订单纯利润</span><span class="fx-val">${money2(t.order_profit)}</span></div>
        <div class="fx-row"><span class="fx-name">订单利润率</span><span class="fx-val">${pctTxt(t.order_margin)}</span></div>
        <div class="fx-row"><span class="fx-name">个人提成</span><span class="fx-val">${money2(t.order_commission)}</span></div>
        <div class="fx-row"><span class="fx-name">公司利润</span><span class="fx-val">${money2(t.company_profit)}</span></div>
      </div>
      ${feeStateList}
      ${warnList}`;
  },

  /* ---------- 订单费用面板（§四） ---------- */
  feeStatusOf(f, d) {
    const engItems = P1C.engineItems(d);
    const amt = P1C.numOrNull(f.amountCny);
    if (amt == null || amt < 0) return { status: 'pending', reason: '金额未填写或非法' };
    if (amt === 0) return { status: 'none' };
    const mapped = P1C.mapFeeAllocations(f, d);
    const status = Pricing.allocationStatus(engItems, { amountCny: amt, allocations: mapped.allocations });
    return { status: status, reason: mapped.broken ? '明细行已变化，原分摊不再对位，请重新分摊' : '' };
  },
  feesPanelHTML(d) {
    const fees = Array.isArray(d.fees) ? d.fees : [];
    const engItems = P1C.engineItems(d);
    const units = Pricing.checkUnitsForAllocation(engItems);
    const rows = fees.map((f, fi) => {
      const st = P1C.feeStatusOf(f, d);
      const stTxt = st.status === 'auto' ? '<span style="color:#15803d">自动分摊 ✓</span>'
        : st.status === 'manual' ? '<span style="color:#15803d">人工分摊 ✓</span>'
        : st.status === 'none' ? '<span style="color:var(--ink-soft)">零费用（0）</span>'
        : `<span style="color:#b45309">待分摊</span>${st.reason ? '（' + esc(st.reason) + '）' : ''}`;
      let allocBlock = '';
      if (QuoteEdit.feeAllocOpen === fi) {
        const part = (d.items || []).map((it, i) => ({ it, i })).filter(x => (+x.it.qty || 0) > 0);
        const inputs = part.map(x => {
          const a = (Array.isArray(f.allocations) ? f.allocations : []).find(y => y && (y.rowId ? y.rowId === P1C.rowIdOf(x.it) : y.sort === x.i));
          const v = a && a.amountCny != null ? a.amountCny : '';
          return `<div class="form-2" style="align-items:center"><div class="form-row" style="margin:2px 0"><label>第 ${x.i + 1} 行 · ${esc(String(x.it.nameCn || '').slice(0, 12))}（${esc(String(x.it.unit || '单位待补'))} × ${esc(String(x.it.qty))}）</label>
            <input class="inp num" type="number" min="0" step="0.01" value="${v}" oninput="P1C.setManualAlloc(${x.i}, this.value)"></div></div>`;
        }).join('');
        const sum = QuoteEdit.manualAlloc ? Pricing.r2(Object.keys(QuoteEdit.manualAlloc).reduce((s, k) => s + (+QuoteEdit.manualAlloc[k] || 0), 0)) : 0;
        allocBlock = `<div style="background:#fafafa;border:1px solid var(--line,#e5e7eb);border-radius:8px;padding:8px 10px;margin-top:6px">
          <div class="t-sub" style="margin-bottom:6px">人工分摊：每一行都必填（允许 0），合计必须严格等于 ${Pricing.r2(f.amountCny).toFixed(2)} CNY。当前合计：<b>${sum.toFixed(2)}</b></div>
          ${inputs}
          <button class="btn ghost" style="margin-top:6px" onclick="P1C.applyManualFee(${fi})">应用人工分摊</button>
        </div>`;
      }
      return `<div style="border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:8px 10px;margin-bottom:8px" id="p1c_fee_${fi}">
        <div class="form-2">
          <div class="form-row"><label>费用名称</label><input class="inp" placeholder="如：模具费 / 检测费" value="${esc(f.label || '')}" oninput="P1C.setFeeField(${fi}, 'label', this.value)"></div>
          <div class="form-row"><label>金额（CNY 总额）</label><input class="inp num" type="number" min="0" step="0.01" placeholder="0=明确零费用；留空将阻断" value="${f.amountCny == null ? '' : f.amountCny}" oninput="P1C.setFeeField(${fi}, 'amountCny', this.value)"></div>
        </div>
        <div class="form-row"><label>费用说明</label><input class="inp" placeholder="备注（可选）" value="${esc(f.note || '')}" oninput="P1C.setFeeField(${fi}, 'note', this.value)"></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
          <span style="font-size:12.5px">状态：${stTxt}</span>
          <button class="btn ghost" style="padding:4px 10px;font-size:12px" onclick="P1C.autoAllocateFee(${fi})">自动分摊（按数量平均）</button>
          <button class="btn ghost" style="padding:4px 10px;font-size:12px" onclick="P1C.toggleManualFee(${fi})">${QuoteEdit.feeAllocOpen === fi ? '收起人工分摊' : '人工分摊'}</button>
          <button class="btn ghost" style="padding:4px 10px;font-size:12px;color:#b91c1c" onclick="P1C.removeFee(${fi})">删除费用</button>
        </div>
        ${units.ok ? '' : '<div class="t-sub" style="color:#b45309;margin-top:4px">本单各行计价单位不一致：禁止自动按数量平均，请用人工分摊逐行指定。</div>'}
        ${allocBlock}
      </div>`;
    }).join('');
    return `
    <div class="card qe-card" id="p1c_fees_panel">
      <div class="card-h"><span>订单一次性费用</span><span class="todo-badge">保存到 fees[]；未完成分摊不给正式含费用建议价</span></div>
      ${fees.length ? rows : '<div class="t-sub">还没有费用。模具费、检验费这类整单一次性费用在这里录入，按数量摊进各产品成本。</div>'}
      <button class="btn ghost" style="margin-top:6px" onclick="P1C.addFee()">＋ 新增费用</button>
      <div class="t-sub" style="margin-top:6px">自动分摊遵循引擎规则：同计价单位才允许按数量平均；舍入差额全部归最后一行；分摊总额必须严格等于原始费用。混合单位用人工分摊。费用改过、行增删排序后，状态会重新核对，不会静默沿用旧分摊。</div>
    </div>`;
  },
  addFee() {
    const d = QuoteEdit.draft;
    if (!d || d.type === 'PL') return;
    d.fees = Array.isArray(d.fees) ? d.fees : [];
    d.fees.push({ label: '', note: '', amountCny: 0, allocations: null });
    Doc.markDirty();
    P1C.markStale();                                  /* BUG-04：费用增删改 → 核价结果过期 */
    UI.render();
  },
  removeFee(fi) {
    const d = QuoteEdit.draft;
    if (!d || !Array.isArray(d.fees) || !d.fees[fi]) return;
    UI.confirm('删除费用', `删除费用「${esc(d.fees[fi].label || '未命名费用')}」？分摊记录一并删除。`, () => {
      d.fees.splice(fi, 1);
      if (QuoteEdit.feeAllocOpen === fi) { QuoteEdit.feeAllocOpen = null; QuoteEdit.manualAlloc = null; }
      P1C.markStale();
      Doc.markDirty();
      UI.render();
    });
  },
  setFeeField(fi, f, v) {
    const d = QuoteEdit.draft, f0 = d && Array.isArray(d.fees) && d.fees[fi];
    if (!f0) return;
    const s = String(v == null ? '' : v);
    if (f === 'amountCny') {
      const raw = s.trim();
      if (raw === '') {
        f0.amountCny = raw;                               /* 空串=未填写（非法态，v5 门会拦）；不静默转 0 */
      } else {
        const n = Number(raw);
        if (!isFinite(n) || n < 0 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
          f0.amountCny = raw;                             /* 保留原文本，交由核价校验阻断；不四舍五入不静默修正 */
        } else {
          f0.amountCny = Math.round(n * 100) / 100;
          /* 金额变化后旧分摊总额不再守恒：清掉待重新分摊（明确动作，不静默沿用） */
          if (n > 0) f0.allocations = null;
        }
      }
    } else {
      f0[f] = s.slice(0, 200);
    }
    /* P1-C-FIX-02 BUG-07：费用字段任何修改（含留空、负数、超精度等非法输入）都必须
       使旧核价结果失效并标记单据已修改——不允许任何提前 return 绕过这道保护。
       旧建议价在重新核价且 ready=true 之前一律禁止填入。 */
    P1C.markStale();
    Doc.markDirty();
  },
  autoAllocateFee(fi) {
    const d = QuoteEdit.draft, f = d && Array.isArray(d.fees) && d.fees[fi];
    if (!f) return;
    const amt = P1C.numOrNull(f.amountCny);
    if (amt == null || !(amt > 0)) { UI.toast('先填一个大于 0 的费用金额（0 费用不需要分摊）'); return; }
    const engItems = P1C.engineItems(d);
    const units = Pricing.checkUnitsForAllocation(engItems);
    if (!units.ok) { UI.toast('各行计价单位不一致（' + units.units.join(' / ') + '）：禁止自动按数量平均，请用人工分摊'); return; }
    const allocs = Pricing.allocateByQty(engItems, amt);
    if (!allocs) { UI.toast('自动分摊没有完成：请检查各行数量、计价单位是否有效'); return; }
    /* 摊入记录带 rowId 稳定身份：之后行增删/重排都能重新对位，不串行 */
    f.allocations = allocs.map(a => ({ sort: a.sort, amountCny: a.amountCny, rowId: P1C.rowIdOf(d.items[a.sort]) }));
    P1C.markStale();
    Doc.markDirty();
    UI.render();
    UI.toast('已按数量自动分摊：总额 ' + Pricing.r2(amt).toFixed(2) + ' CNY，舍入差额归最后一行');
  },
  toggleManualFee(fi) {
    if (QuoteEdit.feeAllocOpen === fi) { QuoteEdit.feeAllocOpen = null; QuoteEdit.manualAlloc = null; }
    else { QuoteEdit.feeAllocOpen = fi; QuoteEdit.manualAlloc = {}; }
    UI.render();
  },
  setManualAlloc(sort, v) {
    if (!QuoteEdit.manualAlloc) QuoteEdit.manualAlloc = {};
    const s = String(v == null ? '' : v).trim();
    if (s === '') delete QuoteEdit.manualAlloc[sort];
    else QuoteEdit.manualAlloc[sort] = s;                  /* 保留原文本；应用时统一校验 */
  },
  applyManualFee(fi) {
    const d = QuoteEdit.draft, f = d && Array.isArray(d.fees) && d.fees[fi];
    if (!f) return;
    const amt = P1C.numOrNull(f.amountCny);
    if (amt == null || !(amt > 0)) { UI.toast('先填一个大于 0 的费用金额'); return; }
    const engItems = P1C.engineItems(d);
    const inputs = QuoteEdit.manualAlloc || {};
    const rows = Object.keys(inputs).map(k => ({ sort: +k, amountCny: Number(inputs[k]) }));
    const chk = Pricing.validateManualAllocationFor(engItems, rows, amt);
    if (!chk.ok) { UI.toast('人工分摊没有通过：' + (chk.error || '分摊总额必须严格等于原始费用')); return; }
    f.allocations = rows.sort((a, b) => a.sort - b.sort).map(r => ({ sort: r.sort, amountCny: r.amountCny, rowId: P1C.rowIdOf(d.items[r.sort]) }));
    QuoteEdit.feeAllocOpen = null;
    QuoteEdit.manualAlloc = null;
    P1C.markStale();
    Doc.markDirty();
    UI.render();
    UI.toast('人工分摊已应用：总额严格等于 ' + Pricing.r2(amt).toFixed(2) + ' CNY');
  },

  /* ---------- 运费面板（§6.2/§6.3） ---------- */
  ensurePricingExt(d) {
    d._unknown = (d._unknown && typeof d._unknown === 'object') ? d._unknown : {};
    const pe = P1C.pricingExtView(d);
    d._unknown.pricing = {
      incoterm: pe.incoterm, namedPlace: pe.namedPlace, freight: pe.freight.slice(),
      extra: { discount: pe.extra.discount, other_charges: pe.extra.other_charges }
    };
    return d._unknown.pricing;
  },
  setIncoterm(v) {
    const d = QuoteEdit.draft;
    if (!d || d.type === 'PL') return;
    const pe = P1C.ensurePricingExt(d);
    /* 只接受引擎实际支持的贸易术语（Pricing.INCOTERMS），不从字符串猜（§6.3） */
    pe.incoterm = Pricing.INCOTERMS.indexOf(v) >= 0 ? v : '';
    if (pe.incoterm === 'EXW') pe.namedPlace = pe.namedPlace || '';   /* EXW 也要 named place（Anping） */
    P1C.markStale();
    Doc.markDirty();
    UI.render();
  },
  setNamedPlace(v) {
    const d = QuoteEdit.draft;
    if (!d || d.type === 'PL') return;
    P1C.ensurePricingExt(d).namedPlace = String(v == null ? '' : v).slice(0, 200);
    P1C.markStale();
    Doc.markDirty();
  },
  setFreightRow(item, f, v) {
    const d = QuoteEdit.draft;
    if (!d || d.type === 'PL') return;
    const pe = P1C.ensurePricingExt(d);
    let row = pe.freight.find(x => x && x.item === item);
    if (!row) { row = { item: item, amount: 0, currency: (Pricing.FREIGHT_ITEMS[item] || ['', 'USD'])[1], confirmed: false, charge_customer: false, included_in_cost: false }; pe.freight.push(row); }
    if (f === 'amount') {
      const s = String(v == null ? '' : v).trim();
      const n = s === '' ? null : Number(s);
      /* P1-C-FIX-01 BUG-02：非法 → null（引擎阻断）；合法数字**原样保留不四舍五入**，
         超两位小数由核价时明确报错，不得先舍入再放行 */
      row.amount = (n !== null && isFinite(n) && n >= 0) ? n : null;
    } else if (f === 'currency') {
      row.currency = (v === 'CNY' || v === 'USD') ? v : null;
    } else {
      row[f] = v === '1' || v === true;
    }
    P1C.markStale();
    Doc.markDirty();
    P1C.renderFreightRow(item);
  },
  renderFreightRow(item) {
    /* 复选框/下拉不需要重渲染整页；金额变化等重量级操作走 UI.render */
    const r = QuoteEdit.pricingResult;
    if (r) QuoteEdit.pricingStale = true;
  },
  setExtra(field, v) {
    const d = QuoteEdit.draft;
    if (!d || d.type === 'PL') return;
    const pe = P1C.ensurePricingExt(d);
    const s = String(v == null ? '' : v).trim();
    /* 留空 = null（未填写，核价时明确阻断）；0 = 明确零费用。
       P1-C-FIX-01 BUG-02：合法数字原样保留不四舍五入，超两位小数由核价时明确报错。 */
    pe.extra = pe.extra && typeof pe.extra === 'object' ? pe.extra : { discount: 0, other_charges: 0 };
    const n = s === '' ? null : Number(s);
    pe.extra[field] = (n !== null && isFinite(n) && n >= 0) ? n : null;
    P1C.markStale();
    Doc.markDirty();
  },
  /* P1-D-02：运费按 RunCheng 分组展示（国内三项 / 出口与国际其余项）。
     行内输入与写入链（P1C.setFreightRow）与 P1-C 完全一致；贸易术语与交货地点
     上移到「订单信息」卡，本面板只留运费明细 + 折扣/其他收费。 */
  freightRowsHTML(d, keys, incoterm) {
    const pe = P1C.pricingExtView(d);
    /* P2-01：每组前面加一行表头，说明三列勾选框到底是什么，避免"一排空格不知道勾哪个" */
    const head = `<tr class="fr-head"><td>费用项</td><td>金额</td><td>币种</td><td>已核实</td><td>向客户收取</td><td>已计入成本</td></tr>`;
    return head + keys.map(k => {
      const row = pe.freight.find(x => x && x.item === k) || { amount: null, currency: (Pricing.FREIGHT_ITEMS[k] || ['', 'USD'])[1], confirmed: false, charge_customer: false, included_in_cost: false };
      const required = (Pricing.REQUIRED_FREIGHT[incoterm] || []).indexOf(k) >= 0;
      return `<tr>
        <td>${esc((Pricing.FREIGHT_ITEMS[k] || [k])[0])}${required ? ' <b style="color:#b45309">*</b>' : ''}</td>
        <td><input class="inp num" type="number" min="0" step="0.01" style="width:110px" placeholder="留空=未核实" value="${row.amount == null ? '' : row.amount}" oninput="P1C.setFreightRow('${k}', 'amount', this.value)"></td>
        <td><select class="inp" style="width:80px" onchange="P1C.setFreightRow('${k}', 'currency', this.value)">
          <option value="CNY"${row.currency === 'CNY' ? ' selected' : ''}>CNY</option>
          <option value="USD"${row.currency === 'USD' ? ' selected' : ''}>USD</option>
        </select></td>
        <td><label class="fr-chk" title="这笔费用已经核实过（零金额也要勾）"><input type="checkbox" ${row.confirmed ? 'checked' : ''} onchange="P1C.setFreightRow('${k}', 'confirmed', this.checked ? '1' : '')"><span>已核实</span></label></td>
        <td><label class="fr-chk" title="这笔费用单独向客户收取（只影响收入，不抵成本）"><input type="checkbox" ${row.charge_customer ? 'checked' : ''} onchange="P1C.setFreightRow('${k}', 'charge_customer', this.checked ? '1' : '')"><span>收客户</span></label></td>
        <td><label class="fr-chk" title="这笔费用已经摊进产品单价成本，核利润时不再扣一次"><input type="checkbox" ${row.included_in_cost ? 'checked' : ''} onchange="P1C.setFreightRow('${k}', 'included_in_cost', this.checked ? '1' : '')"><span>计入成本</span></label></td>
      </tr>`;
    }).join('');
  },
  /* P1-D-05：整单折扣 / 其他费用独立成卡，放到明细下方左列（原版「订单汇总 / 折扣及其他费用」）。
     写入链 P1C.setExtra 原样复用，不新增任何字段。 */
  extraPanelHTML(d) {
    const ex = (P1C.pricingExtView(d).extra) || {};
    return `
    <div class="card qe-card" id="p1c_extra_panel">
      <div class="card-h"><span>整单折扣 / 其他费用</span><span class="todo-badge">USD；留空会阻断核价</span></div>
      <div class="form-2">
        <div class="form-row"><label>整单折扣 discount（USD）</label>
          <input class="inp num" type="number" min="0" step="0.01" placeholder="0=明确零折扣；留空阻断核价" value="${ex.discount == null ? '' : ex.discount}" oninput="P1C.setExtra('discount', this.value)"></div>
        <div class="form-row"><label>其他费用 other charges（USD）</label>
          <input class="inp num" type="number" min="0" step="0.01" placeholder="0=明确零费用；留空阻断核价" value="${ex.other_charges == null ? '' : ex.other_charges}" oninput="P1C.setExtra('other_charges', this.value)"></div>
      </div>
    </div>`;
  },
  freightPanelHTML(d) {
    const pe = P1C.pricingExtView(d);
    const incoterm = pe.incoterm || '';
    const keys = P1C.FREIGHT_KEYS();
    const dom = keys.filter(k => (Pricing.DOMESTIC_FREIGHT_ITEMS || []).indexOf(k) >= 0);
    const intl = keys.filter(k => dom.indexOf(k) < 0);
    return `
    <div class="card qe-card" id="p1c_freight_panel">
      <div class="card-h"><span>运费明细（内部核价）</span><span class="todo-badge">存进单据内部扩展字段；重开不丢</span></div>
      <div class="t-sub" style="margin-bottom:6px">贸易术语与交货地点在上方「订单信息」卡。标 <b style="color:#b45309">*</b> 项是当前贸易术语必须核实的费用（零金额也须勾「已核实」）。向客户收取的「木箱及包装费」会按数量摊进产品成本（防双计）。</div>
      <div class="rc-group-h">国内费用（工厂侧）</div>
      <table class="tb fr-table">${P1C.freightRowsHTML(d, dom, incoterm)}</table>
      <div class="rc-group-h">出口与国际费用</div>
      <table class="tb fr-table">${P1C.freightRowsHTML(d, intl, incoterm)}</table>
    </div>`;
  }
};

/* ============ 设置 ============ */
Pages.settings = function () {
  const s = Store.settings();
  const db = Store.get();
  const p = Store.paths() || {};
  const demo = Store.hasDemo();
  const info = (typeof window !== 'undefined' && window.SBW && window.SBW.info) ? (window.SBW.info() || {}) : {};
  const ver = info.version || '桌面版';
  return `
    <div class="grid g2">
      <div class="card">
        <div class="card-h">我的信息</div>
        <div class="form-row"><label>公司 / 档口名称</label>
          <input class="inp" id="s_company" value="${esc(s.company || '')}" placeholder="如：安平XX丝网制品"></div>
        <div class="form-row"><label>联系方式</label>
          <input class="inp" id="s_contact" value="${esc(s.contact || '')}" placeholder="姓名 / 电话 / 邮箱"></div>
        <div class="form-row"><label>卖方地址（印在单据抬头）</label>
          <textarea class="inp" id="s_addr" rows="2" placeholder="如：河北省衡水市安平县XX路XX号。留空则纸面抬头这块空着，不会替你编一个">${esc(s.sellerAddress || '')}</textarea></div>
        <div class="t-sub" style="margin:-4px 0 10px">这一栏只在<b>新建</b>单据时写入那张单的卖方快照；改这里<b>不会改已保存的单据</b>（历史单抬头保持原样）。</div>
        <div class="form-2">
          <div class="form-row"><label>抬头电话（Tel）</label>
            <input class="inp" id="s_phone" value="${esc(s.sellerPhone || '')}" placeholder="如：+86-318-7526xxx"></div>
          <div class="form-row"><label>WhatsApp</label>
            <input class="inp" id="s_whatsapp" value="${esc(s.sellerWhatsApp || '')}" placeholder="如：+86-138xxxxxxxx"></div>
          <div class="form-row"><label>抬头邮箱（Email）</label>
            <input class="inp" id="s_email" value="${esc(s.sellerEmail || '')}" placeholder="如：sales@yourdomain.com"></div>
          <div class="form-row"><label>网站（Web）</label>
            <input class="inp" id="s_web" value="${esc(s.sellerWebsite || '')}" placeholder="如：https://..."></div>
        </div>
        <div class="t-sub" style="margin:-4px 0 10px">这四栏不进单据快照、只存本机设置；只在 RunCheng 报价版（quotation-rc-v1）纸面抬头按原版样式印「Tel | WhatsApp / Email | Web」，留空的栏不印。基础版单据不受影响。</div>
        <div class="form-row"><label>公司 LOGO（RunCheng 报价版纸面抬头用）</label>
          <div style="display:flex;gap:12px;align-items:center">
            <span style="display:inline-flex;width:120px;height:52px;border:1px dashed var(--line,#e5e7eb);border-radius:8px;align-items:center;justify-content:center;overflow:hidden;background:#fff">
              ${s.sellerLogo ? `<img src="${esc(s.sellerLogo)}" alt="LOGO 预览" style="max-height:48px;max-width:110px;object-fit:contain">` : '<span class="t-sub">未设置</span>'}
            </span>
            <input type="file" id="s_logo_file" accept="image/png,image/jpeg" style="display:none" onchange="Settings.logoChosen(this)">
            <button class="btn ghost" onclick="document.getElementById('s_logo_file').click()">上传 / 更换 LOGO</button>
            ${s.sellerLogo ? '<button class="btn ghost" onclick="Settings.logoClear()">清除</button>' : ''}
          </div>
          <div class="t-sub">建议透明底 PNG；上传后自动压到 128px 高再保存，只存本机数据文件。只在 RunCheng 报价版（quotation-rc-v1）纸面抬头显示，基础版单据不受影响。</div>
        </div>
        <div class="form-row"><label>默认货币</label>
          <select class="inp" id="s_cur">
            ${['USD', 'CNY', 'EUR'].map(c => `<option${s.defaultCurrency === c ? ' selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <button class="btn" onclick="Settings.save()">保存</button>
        <div style="margin-top:14px;border-top:1px dashed var(--line,#e5e7eb);padding-top:12px">
          <div class="card-h" style="padding:0 0 8px">新报价默认定价参数（P1-C）</div>
          ${(() => { const pd = (Store.pricingDefaults && Store.pricingDefaults()) || {}; return `
          <div class="form-2">
            <div class="form-row"><label>默认销售手续费率</label>
              <input class="inp num" id="s_pfee" type="number" min="0" max="100" step="0.01" value="${pd.feeRate == null ? '' : Math.round(pd.feeRate * 10000) / 100}"></div>
            <div class="form-row"><label>默认个人提成率</label>
              <input class="inp num" id="s_pcomm" type="number" min="0" max="100" step="0.01" value="${pd.commissionRate == null ? '' : Math.round(pd.commissionRate * 10000) / 100}"></div>
          </div>
          <div class="t-sub" style="margin:6px 0 8px">只作用于<b>新建</b>的金额类单据（含费模式、汇率留空待填）。历史单据保持原样：feeInPrice=未知、参数=null，打开绝不自动补默认。</div>
          <button class="btn ghost" onclick="Settings.savePricingDefaults()">保存默认定价参数</button>`; })()}
        </div>
      </div>

      <div class="card">
        <div class="card-h">我的数据在哪</div>
        <div class="t-sub" style="margin-bottom:12px">
          所有数据（客户、产品、单据）都保存在你自己的电脑上，不上传、不联网。<br>
          就是一个普通 JSON 文件，<b>记事本能打开，复制走就是备份</b>。
        </div>
        ${Store.blocked() ? `
        <div class="notice-item n-error" style="margin-bottom:12px">
          <b>当前数据处于只读状态，改动不会被保存。</b>
          <div class="t-sub" style="margin-top:6px">${esc(Store.blockReason() || '')}</div>
        </div>` : ''}
        <div class="path-box">${esc(p.file || '（未知）')}</div>
        <div class="quick" style="margin-top:12px">
          <button class="btn ghost" onclick="Settings.openDir()">打开数据文件夹</button>
        </div>
        <div class="fx-row" style="margin-top:14px"><span class="fx-name">客户</span><span class="fx-val">${(db.customers || []).length} 条</span></div>
        <div class="fx-row"><span class="fx-name">产品</span><span class="fx-val">${(db.products || []).length} 条</span></div>
        <div class="fx-row"><span class="fx-name">单据</span><span class="fx-val">${Store.documents().length} 条</span></div>
        <div class="fx-row"><span class="fx-name">历史报价归档</span><span class="fx-val">${Store.quotesArchive().length} 条</span></div>
        <div class="fx-row"><span class="fx-name">自动备份</span><span class="fx-val">${Store.backups().length} 份</span></div>
        ${p.legacyFile || p.v3File ? `<div class="t-sub" style="margin-top:10px">旧版数据文件（只读留存，不再写入，升级到 v4 后原样保留）：<br>${p.v3File ? `<code style="word-break:break-all">${esc(p.v3File)}</code><br>` : ''}${p.legacyFile ? `<code style="word-break:break-all">${esc(p.legacyFile)}</code>` : ''}</div>` : ''}
      </div>
    </div>

    ${demo ? `
    <div class="card" style="margin-top:14px;border-color:#fde9b8;background:#fffdf5">
      <div class="card-h" style="color:#b45309">这里还有演示数据</div>
      <div class="t-sub" style="margin-bottom:12px">
        客户 <b>Ahmed（迪拜）</b>、<b>Ivan Petrov（俄罗斯）</b>、<b>Carlos（巴西）</b> 和 2 条产品是<b>假的</b>，用来给你试手感的。<br>
        正式用之后建议清掉，免得报价单发错人。
      </div>
      <button class="btn" onclick="Settings.clearDemo()">清理未关联的演示客户与产品</button>
    </div>` : ''}

    <div class="card" style="margin-top:14px">
      <div class="card-h">备份与恢复</div>
      <div class="t-sub" style="margin-bottom:12px">
        程序每天第一次保存时会自动留一份备份，保留最近 30 份。
      </div>
      <div class="quick">
        <button class="btn ghost" onclick="Settings.exportData()">导出备份到文件…</button>
        <button class="btn ghost" onclick="Settings.importData()">从备份文件导入…</button>
        <button class="btn ghost" onclick="Settings.showRestore()">从自动备份恢复…</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-h">关于与更新</div>
      <div class="t-sub" style="margin-bottom:12px">
        当前版本 <b>v${esc(ver)}</b>。<br>
        软件会自己检查更新：发现新版本先安静地在后台下载，下好了才问你一句要不要现在重启。不打扰你，也不会因为更新把软件卡住。
      </div>
      <div class="quick">
        <button class="btn ghost" onclick="Settings.checkUpdate()">检查更新</button>
        <button class="btn ghost" onclick="Settings.installUpdate()">重启并安装更新</button>
      </div>
      <div class="t-sub" id="upd_status" style="margin-top:10px"></div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-h" style="color:#b42318">危险操作</div>
      <div class="t-sub" style="margin-bottom:12px">下面这个操作会清掉你现在所有数据，换成 3 条演示客户。</div>
      <button class="btn danger" onclick="Settings.reset()">恢复演示数据（清空全部）</button>
    </div>`;
};

const Settings = {
  save() {
    const v = k => (document.getElementById(k) || {}).value || '';
    /* 这里不再写 ai：AI 服务商/模型/密钥只走「AI 卡密」页的维护模式，
       客户机上没有这些输入框，避免把已有配置覆盖成空值。 */
    const ok = Store.saveSettings({
      company: v('s_company'), contact: v('s_contact'),
      sellerAddress: v('s_addr'), defaultCurrency: v('s_cur'),
      /* P1-D-03R：抬头联系方式（RunCheng 报价版纸面用，settings 键 Object.assign 合并） */
      sellerPhone: v('s_phone'), sellerWhatsApp: v('s_whatsapp'),
      sellerEmail: v('s_email'), sellerWebsite: v('s_web')
    });
    UI.toast(ok ? '已保存' : '保存失败，请看顶部提示');
  },

  /* P1-D-03：LOGO 上传（RunCheng 报价版纸面抬头）。复用 Store.saveSettings 现有机制
     （settings.sellerLogo 键，Object.assign 合并，不新增存储结构）；canvas 压到 128px 高。 */
  async logoChosen(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { UI.toast('只支持 PNG / JPG 图片'); input.value = ''; return; }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('文件读取失败'));
        r.readAsDataURL(f);
      });
      const small = await Settings._shrinkLogo(dataUrl);
      const ok = Store.saveSettings({ sellerLogo: small });
      if (ok) { UI.toast('LOGO 已保存（RunCheng 报价版纸面抬头生效）'); UI.render(); }
      else UI.toast(Store.saveError() ? Store.saveError() : '保存失败，请看顶部提示');
    } catch (e) { UI.toast('LOGO 处理失败：' + ((e && e.message) || e)); }
    input.value = '';
  },

  _shrinkLogo(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        try {
          const H = 128, W = Math.max(1, Math.round(img.width * H / img.height));
          const cv = document.createElement('canvas');
          cv.width = W; cv.height = H;
          cv.getContext('2d').drawImage(img, 0, 0, W, H);
          let out = cv.toDataURL('image/png');
          if (out.length > 200000) out = cv.toDataURL('image/jpeg', 0.85);
          if (out.length > 1000000) { rej(new Error('图片过大（超 1MB），请换一张更小的')); return; }
          res(out);
        } catch (e) { rej(e); }
      };
      img.onerror = () => rej(new Error('图片解析失败'));
      img.src = dataUrl;
    });
  },

  logoClear() {
    const ok = Store.saveSettings({ sellerLogo: '' });
    if (ok) { UI.toast('已清除 LOGO'); UI.render(); }
    else UI.toast('保存失败，请看顶部提示');
  },

  savePricingDefaults() {
    const v = k => (document.getElementById(k) || {}).value || '';
    const pf = v('s_pfee').trim(), pc = v('s_pcomm').trim();
    const num = (s, lo, hi) => { const n = Number(s); return (s !== '' && isFinite(n) && n >= lo && n <= hi) ? Math.round(n / 100 * 10000) / 10000 : null; };
    const patch = {};
    if (pf !== '') { const r = num(pf, 0, 99.99); if (r == null) { UI.toast('手续费率须在 0–100 之间'); return; } patch.feeRate = r; }
    if (pc !== '') { const r = num(pc, 0, 100); if (r == null) { UI.toast('提成率须在 0–100 之间'); return; } patch.commissionRate = r; }
    const ok = Store.savePricingDefaults(patch);
    UI.toast(ok ? '默认定价参数已保存（只影响之后新建的单据）' : '保存失败');
  },

  async openDir() {
    const r = await window.SBW.openDataDir();
    if (!r || !r.ok) UI.toast('打不开文件夹：' + ((r && r.error) || '未知错误'));
  },

  async exportData() {
    const name = '丝网盒子-数据备份-' + Store.dayKey() + '.json';
    const r = await window.SBW.exportToFile(Store.exportAll(), name);
    if (r && r.canceled) return;
    if (r && r.ok) UI.toast('已导出到：' + r.filePath);
    else UI.toast('导出失败：' + ((r && r.error) || '未知错误'));
  },

  async importData() {
    /* 两步走：先只读检查文件（不改任何数据），确认后才真正替换 */
    const ins = await Store.pickImportFile();
    if (ins.canceled) return;
    if (!ins.ok) {
      UI.toast('无法导入，请看页面顶部提示');
      UI.render();          /* 让 store 记下的失败原因显示在顶部横幅里 */
      return;
    }
    const c = ins.counts || {};
    const msg = `文件格式：<b>${esc(c.kind || '未知')}</b><br>` +
      `客户 ${c.customers || 0} 条 · 产品 ${c.products || 0} 条 · 单据 ${c.documents || 0} 条<br><br>` +
      `导入会<b>替换当前全部数据</b>（替换前会自动把当前数据备份一份）。确定继续吗？`;
    UI.confirm('确认导入数据', msg, async () => {
      const r = await Store.applyImport(ins.filePath);
      if (!r || !r.ok) {
        UI.toast('导入失败，请看页面顶部提示');
        UI.render();
        return;
      }
      UI.toast('已导入' + (r.migrated ? '（旧格式已按新结构迁移）' : '') + '：客户 ' + (Store.get().customers || []).length + ' 条');
      UI.render();
    });
  },

  showRestore() {
    const list = Store.backups();
    if (!list.length) { UI.toast('还没有自动备份'); return; }
    const body = `
      <div class="t-sub" style="margin-bottom:12px">选一份恢复。当前数据会先被覆盖。</div>
      <div class="bk-list">
        ${list.map(b => `
          <div class="bk-row">
            <div>
              <b>${esc(b.name)}</b>
              <span class="bk-meta">客户 ${b.customers} 条 · 单据 ${b.quotes} 份</span>
            </div>
            <button class="btn ghost" style="padding:6px 14px;font-size:13px"
              onclick="Settings.restore('${esc(b.file).replace(/\\/g, '\\\\')}')">恢复这份</button>
          </div>`).join('')}
      </div>`;
    UI.openModal('从自动备份恢复', body, [
      { text: '取消', cls: 'ghost', onclick: 'UI.closeModal()' }
    ], true);
  },

  async restore(file) {
    const r = await Store.restore(file);
    UI.closeModal();
    if (!r || !r.ok) {
      UI.toast('恢复失败，请看页面顶部提示');
      UI.render();
      return;
    }
    UI.toast('已恢复');
    UI.render();
  },

  clearDemo() {
    UI.confirm('清理演示数据', '清理标为演示的产品与未关联客户；有关联单据或沟通记录的客户会保留。自己录入的资料不受影响。', () => {
      const ok=Store.clearDemo();
      UI.render();
      UI.toast(ok?'演示资料已清理；有关联历史的客户会保留':'没有清理成功，请查看数据状态');
    });
  },

  /* ---- 软件更新 ---- */
  async checkUpdate() {
    const el = document.getElementById('upd_status');
    const say = (t) => { if (el) el.textContent = t; };
    if (!window.SBW || !window.SBW.checkUpdate) { say('网页版不需要更新，桌面版会自动检查。'); return; }
    say('正在检查更新…');
    let r;
    try { r = await window.SBW.checkUpdate(); } catch (e) { r = { status: 'error', error: e.message }; }
    if (r && r.supported === false) { say('当前是开发模式，不检查更新。'); UI.toast('开发模式跳过更新'); return; }
    if (!r) { say('检查失败，请稍后再试。'); return; }
    if (r.status === 'latest') { say('已是最新版本 v' + (r.version || '（当前版本）')); UI.toast('已是最新版本'); return; }
    if (r.status === 'ready') { say('新版本 v' + (r.version || '') + ' 已下载完成，点上面「重启并安装更新」即可。'); UI.toast('更新已就绪'); return; }
    if (r.status === 'available' || r.status === 'downloading' || r.status === 'checking') {
      say('发现新版本，正在后台下载…');
      Settings.watchDownload();
      return;
    }
    if (r.status === 'error') { say('检查失败（可能是网络问题），稍后再试。重启软件也会自动重试。'); return; }
    say('已是最新版本。');
  },

  watchDownload() {
    const el = document.getElementById('upd_status');
    const say = (t) => { if (el) el.textContent = t; };
    let n = 0;
    const t = setInterval(() => {
      n++;
      const s = window.SBW.updateState();
      if (!s || n > 60) { clearInterval(t); return; }
      if (s.status === 'downloading') { say('正在后台下载新版本 v' + (s.version || '') + ' … ' + s.progress + '%'); }
      if (s.status === 'ready') {
        clearInterval(t);
        say('新版本 v' + (s.version || '') + ' 已下载完成，点上面「重启并安装更新」即可。');
        UI.toast('更新已下载完成');
      }
      if (s.status === 'error') { clearInterval(t); say('下载失败（可能是网络问题），下次启动会自动重试。'); }
    }, 1000);
  },

  async installUpdate() {
    if (!window.SBW || !window.SBW.installUpdate) { UI.toast('网页版不需要安装更新'); return; }
    const s = window.SBW.updateState();
    if (!s || s.status !== 'ready') {
      UI.toast('暂时没有已下载的新版本，先点「检查更新」');
      return;
    }
    UI.confirm('重启并安装更新', '软件会先关闭，装上 v' + (s.version || '新版本') + ' 后自动重新打开。你的数据不受影响。', async () => {
      const r = await window.SBW.installUpdate();
      if (!r || !r.ok) UI.toast('安装失败：' + ((r && r.error) || '未知错误'));
    });
  },

  reset() {
    UI.confirm('恢复演示数据', '会清掉你现在所有数据，换成 3 条演示客户。确定吗？', () => {
      Store.resetAll();
      UI.render();
      UI.toast('已重置');
    });
  }
};

/* ============ D4 · 客户详情、沟通与产品图片 ============ */
let customerDetailId=null;
Pages.customerDetail=function(){
 const c=Store.customers().find(x=>x.id===customerDetailId);
 if(!c)return '<div class="empty">客户已不存在。<button class="btn" onclick="UI.go(\'customers\')">返回客户列表</button></div>';
 const links=Store.customerLinks(c.id), communications=links.communications;
 return `<div class="toolbar"><button class="btn ghost" onclick="UI.go('customers')">← 客户列表</button><div class="grow"></div>
  <button class="btn ghost" onclick="Cust.openForm('${jid(c.id)}')">编辑资料</button>
  <button class="btn" onclick="Cust.newQuote('${jid(c.id)}')">为客户开报价单</button></div>
  <div class="card"><div class="card-h">${esc(c.company||c.name)} ${stagePill(c.stage)}</div>
  <div class="grid g2"><div>联系人：${esc(c.name)}<br>国家：${esc(c.country||'未填')}<br>电话 / WhatsApp：${esc(c.phone||'未填')}<br>邮箱：${esc(c.email||'未填')}</div>
  <div>地址：${esc(c.address||'未填')}<br>下次跟进：${esc(c.next||'未安排')}<br>预估采购：${money(c.amount)}（预估值，不是成交额）</div></div>
  <div class="d4-text">${esc(c.note||'暂无备注')}</div></div>
  <div class="grid g2" style="margin-top:14px"><div class="card"><div class="card-h"><span>沟通记录 · ${communications.length}</span>
  <button class="btn" onclick="Cust.openCommunication('${jid(c.id)}')">＋ 记录沟通</button></div>
  ${communications.map(e=>`<article class="d4-entry"><div class="fx-row"><b>${esc(e.at||'未填时间')} · ${esc(e.channel||'未填渠道')}</b><span>
  <button class="icon-btn" onclick="Cust.openCommunication('${jid(c.id)}','${jid(e.id)}')">编辑</button>
  <button class="icon-btn" onclick="Cust.removeCommunication('${jid(e.id)}')">删除</button></span></div><div class="d4-text">${esc(e.text)}</div></article>`).join('')||'<div class="empty">还没有沟通记录</div>'}</div>
  <div class="card"><div class="card-h">关联单据 · ${links.documents.length}</div>
  <div class="t-sub">按客户ID关联；资料变化不改历史单据快照。金额按各单原币种显示，不合并为成交额。</div>
  ${links.documents.map(d=>`<div class="fx-row"><button class="btn ghost" onclick="Doc.openEditor('${jid(d.id)}')">${esc(d.no||d.id)}</button>
  <span>${esc(d.type)} · ${esc(d.date)}<br>${d.type==='PL'?'装箱资料':money(d.totals && d.totals.grand,d.currency)}</span></div>`).join('')||'<div class="empty">还没有关联单据</div>'}</div></div>`;
};
Object.assign(Cust,{
 detail(id){if(UI.closeModal && UI.closeModal()===false)return;customerDetailId=id;UI.go('customerDetail');},
 newQuote(id){Doc.openEditor(null,'QT');Doc.pickCust(id);},
 openCommunication(customerId,id){
  if(UI.closeModal && UI.closeModal()===false)return;
  const c=Store.customers().find(x=>x.id===customerId);if(!c)return;
  const entry=id ? Store.communications(customerId).find(x=>x.id===id) : null;
  if(id&&!entry)return;
  const now=new Date(), local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  UI.openModal(entry?'编辑沟通记录':'记录沟通',`<div class="form-2"><div class="form-row"><label>时间</label><input class="inp" id="cm_at" type="datetime-local" value="${esc(entry&&entry.at||local)}"></div>
   <div class="form-row"><label>渠道</label><input class="inp" id="cm_channel" value="${esc(entry&&entry.channel||'')}" placeholder="电话 / WhatsApp / 邮件"></div></div>
   <div class="form-row"><label>沟通内容</label><textarea class="inp" id="cm_text" rows="6" maxlength="20000">${esc(entry&&entry.text||'')}</textarea></div>
   <div class="form-row"><label>下次跟进（同时更新客户档案，清空表示不安排）</label><input class="inp" id="cm_next" type="date" value="${esc(c.next||'')}"></div>`,
   [{text:'取消',cls:'ghost',fn:'UI.closeModal()'},{text:'保存',fn:`Cust.saveCommunication('${jid(customerId)}','${jid(id||'')}')`}]);
  if(UI.guardModal)UI.guardModal();
 },
 saveCommunication(customerId,id){
  const v=k=>(document.getElementById(k)||{}).value||'';
  const ok=Store.saveCommunication({id:id||undefined,customerId,at:v('cm_at'),channel:v('cm_channel'),text:v('cm_text')},v('cm_next'));
  if(!ok){UI.toast(Store.saveError()||'未保存，请检查时间、内容和数据状态');return false;}
  UI.closeModal(true);UI.render();return true;
 },
 removeCommunication(id){UI.confirm('删除沟通记录','只删除这一条沟通记录，不改客户、跟进日期或历史单据。',()=>{if(!Store.removeCommunication(id))UI.toast('删除失败');UI.render();});}
});

// Only bounded embedded PNG/JPEG is displayed; never fetch a product's remote URL.
function productImage(value){return typeof value==='string' && value.length<=1000100 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';}
const d4ProductForm=Prod.openForm;
Prod.openForm=function(id){
 if(UI.closeModal && UI.closeModal()===false)return;
 this.editId=id||null;this.imageDraft='';this.imageBusy=false;
 this.realImageDraft='';this.realImageModeDraft='auto';this.realImageAuto='';this.realImageBusy=false;   /* P1-D-05-FIX-01：三态草稿 */
 d4ProductForm.call(this,id);
 const p=id?Store.products().find(x=>x.id===id):null;
 if(id&&!p){UI.closeModal(true);return;}
 if(p){
  const title=document.getElementById('modalTitle');if(title)title.textContent='编辑产品';
  const fields={p_cn:'nameCn',p_en:'nameEn',p_mesh:'mesh',p_wire:'wire',p_width:'width',p_roll:'rollLen',p_price:'price',p_unit:'unit',p_note:'note',p_hs:'hsCode'};
  const unit=document.getElementById('p_unit');
  if(unit && p.unit && !Array.from(unit.options).some(o=>o.value===p.unit))unit.insertAdjacentHTML('beforeend', '<option value="'+esc(p.unit)+'">'+esc(p.unit)+'</option>');
  Object.keys(fields).forEach(k=>{const el=document.getElementById(k);if(el)el.value=p[fields[k]]==null?'':p[fields[k]];});
  this.imageDraft=productImage(p.imageData);
  /* P1-D-05-FIX-01：读取三态（auto/custom/none）；规格图与实物图始终分离。 */
  const RIe=(typeof SBRealImages!=='undefined' && SBRealImages)?SBRealImages:null;
  this.realImageModeDraft=(RIe && typeof RIe.modeOf==='function')?RIe.modeOf(p):'auto';
  this.realImageDraft=productImage(p.realImageData);
  this.realImageAuto=(RIe && typeof RIe.forProduct==='function')?productImage(RIe.forProduct(p)):'';
 }
 /* P1-D-05-FIX-01：实物图三态操作区（自动匹配 / 自定义 / 不使用）。
    内置图只对「按 product_images 关联能确认匹配」的产品开放，且绝不使用规格图。 */
 const RI=(typeof SBRealImages!=='undefined' && SBRealImages)?SBRealImages:null;
 const builtIn=(RI && typeof RI.optionsForProduct==='function')?RI.optionsForProduct(p):[];
 const builtInOpts=builtIn.length?`<div class="form-row"><label>或直接选用原版内置实物图（等同自定义选择）</label>
   <select class="inp" onchange="Prod.pickBuiltInReal(this.value)">
     <option value="">（不选用）</option>
     ${builtIn.map(o=>`<option value="${esc(o.key)}">${esc(o.label)}</option>`).join('')}
   </select><div class="t-sub">来自原版 RunCheng V2 正式库的真实场景实拍。</div></div>`:'';
 const realImageSection=`<div class="form-row"><label>产品实物图（仅用于客户纸面 PHOTO；与上方规格图完全独立）</label>
   <div class="t-sub" id="realImageModeLabel"></div>
   <div class="quick">
     <button class="btn ghost" id="realImagePick" onclick="Prod.pickRealImage()">上传自定义实物图</button>
     <button class="btn ghost" onclick="Prod.useAutoRealImage()">恢复默认实物图</button>
     <button class="btn ghost" onclick="Prod.disableRealImage()">不使用实物图</button>
   </div>
   ${builtInOpts}
   <input id="p_real_image" type="hidden" value="${esc(this.realImageDraft)}">
   <input id="p_real_image_mode" type="hidden" value="${esc(this.realImageModeDraft)}">
   <div id="realImagePreview"></div>
   <div class="t-sub">自动：按已核实关联使用内置实拍，未匹配则 NO IMAGE；自定义：优先于内置；不使用：永久禁用，纸面固定 NO IMAGE、不再自动带入。原有规格图完整保留。</div></div>`;
 const body=document.getElementById('modalBody');
 if(body)body.insertAdjacentHTML('beforeend',`<div class="form-row"><label>本地产品图片（规格图 / 目录页，PNG/JPEG，原图≤8MB）</label><div class="quick"><button class="btn ghost" id="imagePick" onclick="Prod.pickImage()">选择图片</button><button class="btn ghost" onclick="Prod.clearImage()">移除图片</button></div>
  <input id="p_image" type="hidden" value="${esc(this.imageDraft)}"><div id="productImagePreview"></div><div class="t-sub">保存时图片一并写入本机数据，导出JSON备份也包含图片。取消编辑不改资料。</div></div>
  ${realImageSection}`);
 this.previewImage();this.previewRealImage();if(UI.guardModal)UI.guardModal();
};
Prod.previewImage=function(){const el=document.getElementById('productImagePreview');if(el)el.innerHTML=this.imageDraft?`<img class="d4-product-image" alt="本地产品图片" src="${productImage(this.imageDraft)}">`:'<span class="t-sub">暂无图片</span>';};
Prod.pickImage=async function(){
 if(this.imageBusy)return;const input=document.getElementById('p_image');if(!input)return;
 if(!window.SBW || !window.SBW.pickProductImage){UI.toast('图片通道未就绪，请重启程序');return;}
 this.imageBusy=true;const button=document.getElementById('imagePick');if(button)button.disabled=true;
 try{const r=await window.SBW.pickProductImage();
  // An old dialog result must not modify a later product form.
  if(document.getElementById('p_image')!==input)return;
  if(r.ok&&productImage(r.imageData)){this.imageDraft=r.imageData;input.value=r.imageData;this.previewImage();}
  else if(!r.canceled)UI.toast(r.error||'图片未导入');
 }catch(e){UI.toast('图片未导入：'+e.message);}finally{this.imageBusy=false;if(button)button.disabled=false;}
};
Prod.clearImage=function(){this.imageDraft='';const el=document.getElementById('p_image');if(el)el.value='';this.previewImage();};
/* ---------- P1-D-05-FIX-01：实物图三态表单（规格图链路一行未动） ----------
 * 三态：auto 自动匹配 / custom 自定义优先 / none 明确不使用（永不自动带入）。
 * realImageData 只在 custom 下写入；auto 与 none 保存时清空，避免日后误复活。 */
Prod.realImageStateText=function(){
 const m=this.realImageModeDraft||'auto';
 if(m==='none')return '当前：不使用实物图（客户纸面显示 NO IMAGE，且不会自动带入内置图）';
 if(m==='custom'){
   if(productImage(this.realImageDraft))return '当前：自定义实物图（优先于内置图）';
   /* P1-D-05 FIX-01A：自定义图缺失时明确提示已回退，保存后状态自动归一为「自动匹配」，
      与预览、纸面保持同一结果。 */
   return this.realImageAuto
     ? '当前：自定义实物图缺失，已回退自动匹配（预览与纸面使用内置实拍；保存后状态变为自动匹配）'
     : '当前：自定义实物图缺失，且该产品无内置实拍（预览与纸面均为 NO IMAGE；保存后状态变为自动匹配）';
 }
 return this.realImageAuto?'当前：自动匹配（使用原版内置实拍）':'当前：自动匹配（该产品无已核实内置实拍，纸面 NO IMAGE）';
};
Prod.realImageDisplay=function(){
 const m=this.realImageModeDraft||'auto';
 if(m==='none')return '';
 /* 与 resolve() 一致：custom 缺图时回退内置图，预览不再显示「无图」。 */
 if(m==='custom')return productImage(this.realImageDraft)||productImage(this.realImageAuto);
 return productImage(this.realImageAuto);
};
Prod.previewRealImage=function(){
 const label=document.getElementById('realImageModeLabel');if(label)label.textContent=this.realImageStateText();
 const mi=document.getElementById('p_real_image_mode');if(mi)mi.value=this.realImageModeDraft||'auto';
 const el=document.getElementById('realImagePreview');if(!el)return;
 const d=this.realImageDisplay();
 el.innerHTML=d?`<img class="d4-product-image" alt="产品实物图" src="${d}">`:'<span class="t-sub">不使用实物图或无可用的内置实物图：客户纸面显示 NO IMAGE</span>';
};
Prod.setRealImageDraft=function(v){this.realImageDraft=v||'';const el=document.getElementById('p_real_image');if(el)el.value=this.realImageDraft;this.previewRealImage();};
Prod.setRealImageMode=function(mode){
 this.realImageModeDraft=(mode==='custom'||mode==='none')?mode:'auto';
 if(this.realImageModeDraft!=='custom')this.realImageDraft='';
 const el=document.getElementById('p_real_image');if(el)el.value=this.realImageDraft;
 this.previewRealImage();
};
Prod.pickRealImage=async function(){
 if(this.realImageBusy)return;const input=document.getElementById('p_real_image');if(!input)return;
 if(!window.SBW || !window.SBW.pickProductImage){UI.toast('图片通道未就绪，请重启程序');return;}
 this.realImageBusy=true;const button=document.getElementById('realImagePick');if(button)button.disabled=true;
 try{const r=await window.SBW.pickProductImage();
  // An old dialog result must not modify a later product form.
  if(document.getElementById('p_real_image')!==input)return;
  if(r.ok&&productImage(r.imageData)){this.realImageModeDraft='custom';this.setRealImageDraft(r.imageData);}
  else if(!r.canceled)UI.toast(r.error||'图片未导入');
 }catch(e){UI.toast('图片未导入：'+e.message);}finally{this.realImageBusy=false;if(button)button.disabled=false;}
};
Prod.useAutoRealImage=function(){this.setRealImageMode('auto');if(UI.toast)UI.toast('已恢复默认实物图（自动匹配）');};
Prod.disableRealImage=function(){this.setRealImageMode('none');if(UI.toast)UI.toast('已设为不使用实物图，纸面将显示 NO IMAGE');};
Prod.clearRealImage=function(){this.useAutoRealImage();};   /* 兼容旧入口：移除自定义即恢复自动 */
Prod.pickBuiltInReal=function(key){
 if(!key)return;const RI=(typeof SBRealImages!=='undefined'&&SBRealImages&&typeof SBRealImages.dataOf==='function')?SBRealImages:null;
 const d=RI?RI.dataOf(key):'';
 if(productImage(d)){this.realImageModeDraft='custom';this.setRealImageDraft(d);}
 else UI.toast('这张内置实物图不可用');
};
