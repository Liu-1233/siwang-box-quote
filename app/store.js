/* 丝网盒子桌面版 · 本地数据层
 *
 * 数据落在主进程管理的 JSON 文件里（见 storage.js）：
 *   %APPDATA%\丝网盒子\data\siwangbox-v5.json
 * 记事本能直接打开，复制走就能备份。
 *
 * 这里不再用 localStorage —— 它底层是 Chromium 的二进制库，
 * 两个进程同时开会静默降级成「只存内存」，关掉程序数据就没了。
 *
 * D3-B1 起升 v4（schemaVersion 4）：新增 delivery/seller/bank/买方地址/唛头/
 * 船运/合同条款/签订信息/包装模式/总件数等字段；PL（装箱单）是无金额单据，
 * 行上没有 price/amount，汇总只算包装四件套。本文件只管内存态与事务，
 * 规则全部走 MODEL（app/model.js），不在别处写第二份。
 *
 * P1-B 起升 v5（schemaVersion 5）：新增成本快照（specText/costFactory/costPacking/
 * costInland/costOther/costConfirmed）、单据级定价参数（fx/feeRate/targetMargin/
 * commissionRate/freightMarkup/markupRate/feeInPrice/pricingVersion）与 fees[]；
 * 历史参数一律 null（未知），绝不伪造历史值。
 *
 * D1 起的关键约定（重要，改代码前先读）：
 *   1. 写操作一律走 transact()：先备好内存快照 → 改内存 → 落盘 → 落盘失败就整体回滚。
 *      绝不能出现「界面显示成功、磁盘没写进去」或「内存已推进、磁盘还是旧值」。
 *   2. 数据坏了 / 版本不认识 / 桥不通，一律进入只读态（blocked），
 *      不 seed、不保存、不改写任何文件。只有「完全没有任何历史数据」才初始化新库。
 *   3. 单据统一存在 documents（type 区分类型）；quotes()/addQuote()/removeQuote()
 *      是给旧页面用的兼容适配层，读写都落在 documents 上，归档区只读。
 */
const Store = (function () {
  const KEY = 'siwangbox-desktop-v1';        // 老版本的 localStorage 键，仅用于一次性迁移
  const HAVE_BRIDGE = typeof window !== 'undefined' && !!window.SBW;
  const MODEL = (typeof window !== 'undefined' && window.SBModel)
    ? window.SBModel
    : (typeof SBModel !== 'undefined' ? SBModel : null);

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(d) {
    const x = d || new Date();
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }
  function todayPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dayKey(d);
  }
  function nowMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  /* 唯一 ID：以前用 Date.now()，同一毫秒连续新增会撞号，改成 UUID */
  function uid() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2, 10);
  }

  function seed() {
    const t = Date.now();
    void t;
    return {
      schemaVersion: MODEL ? MODEL.SCHEMA_VERSION : 5,
      migration: { fromV2: null, fromV3: null, fromV4: null },
      counters: { QT: {}, PI: {}, SC: {}, CI: {}, PL: {} },
      customers: [
        { id: 'seed-1', name: 'Demo Contact A', company: 'Demo Trading Co. A', country: '阿联酋', address: '', stage: '价格谈判', amount: 8600, next: todayPlus(1), note: '示例：304 不锈钢网 100 目 × 0.10mm', created: todayPlus(-12), demo: true },
        { id: 'seed-2', name: 'Demo Contact B', company: 'Demo Filter Co. B', country: '俄罗斯', address: '', stage: '已报价', amount: 12400, next: todayPlus(3), note: '示例：过滤网，316L', created: todayPlus(-20), demo: true },
        { id: 'seed-3', name: 'Demo Contact C', company: 'Demo Filtros Co. C', country: '巴西', address: '', stage: '样品阶段', amount: 5200, next: todayPlus(6), note: '示例：已寄样品', created: todayPlus(-7), demo: true }
      ],
      products: [
        { id: 'seed-p1', nameCn: '304 不锈钢丝网', nameEn: 'SUS304 stainless steel wire mesh', mesh: 100, wire: 0.1, width: 1.22, rollLen: 30, price: 2.35, hsCode: '', note: '平纹编织', demo: true,
          specText: null, costFactory: null, costPacking: null, costInland: null, costOther: null, costConfirmed: null },
        { id: 'seed-p2', nameCn: '镀锌电焊网', nameEn: 'galvanized welded wire mesh', mesh: 0, wire: 1.2, width: 1.0, rollLen: 30, price: 1.1, hsCode: '', note: '孔径 12.7mm', demo: true,
          specText: null, costFactory: null, costPacking: null, costInland: null, costOther: null, costConfirmed: null }
      ],
      documents: [],
      communications: [],
      quotesArchive: [],
      checkins: [],
      settings: { company: '', contact: '', defaultCurrency: 'USD', sellerAddress: '', ai: { provider: 'deepseek', baseUrl: '', model: '', enabled: false, privacyMode: 'confirm' }, entitlements: { ai_quote_assist: false, ai_email_assist: false, advanced_load_planner: false, export_templates: true } },
      _unknown: {}
    };
  }

  let db = null;
  let notices = [];         // 需要让用户看到的重要提示
  let saveError = null;     // 最近一次保存失败的原因
  let blocked = true;       // 默认不可写，bootstrap 成功后才放开
  let blockReason = '';     // 只读原因（展示给用户）
  let state = 'init';       // ok | recovered | migrated | empty | corrupt | unsupported | invalid | error | readOnly
  let migrationReport = null;

  function notice(level, message) { notices.push({ level, message }); }

  function enterBlocked(status, reason) {
    blocked = true;
    state = status;
    blockReason = reason || '';
    db = null;
    notice('error', reason || '数据不可用，已进入只读状态。');
  }

  /* 把缺字段补齐，而不是整个丢给 seed() 覆盖用户数据 */
  function normalize(d) {
    d = d || {};
    ['customers', 'products', 'documents', 'communications', 'quotesArchive', 'checkins'].forEach(k => {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    if (!d.settings || typeof d.settings !== 'object') d.settings = {};
    if (!d.settings.defaultCurrency) d.settings.defaultCurrency = 'USD';
    /* v4 新增的卖方地址（与单据级 seller 快照分开：这是"我"的默认地址） */
    if (!('sellerAddress' in d.settings)) d.settings.sellerAddress = '';
    if (!d.settings.ai || typeof d.settings.ai !== 'object') d.settings.ai = { provider: 'deepseek', baseUrl: '', model: '', enabled: false, privacyMode: 'confirm' };
    if (!d.settings.entitlements || typeof d.settings.entitlements !== 'object') d.settings.entitlements = { ai_quote_assist: false, ai_email_assist: false, advanced_load_planner: false, export_templates: true };
    if (!d.counters || typeof d.counters !== 'object') d.counters = {};
    MODEL.DOC_TYPES.forEach(t => {
      if (!d.counters[t] || typeof d.counters[t] !== 'object' || Array.isArray(d.counters[t])) d.counters[t] = {};
    });
    if (!d.migration || typeof d.migration !== 'object') d.migration = { fromV2: null, fromV3: null, fromV4: null };
    /* v4/v5 迁移标记：v3→v4、v4→v5 的来源信息；没有就是 null，不伪造历史 */
    if (!('fromV3' in d.migration)) d.migration.fromV3 = null;
    if (!('fromV4' in d.migration)) d.migration.fromV4 = null;
    if (!d._unknown || typeof d._unknown !== 'object') d._unknown = {};
    /* 到这里的数据一定是 load()/migrate()/restore()/import() 校验过的 v5；
       这句是兜底声明，不是版本判定（判定在主进程 storage.js）。 */
    d.schemaVersion = MODEL ? MODEL.SCHEMA_VERSION : 5;
    return d;
  }

  /* v4 单据级新键的默认值（仅"缺失才补"，已有值一律不动） */
  const V4_DOC_DEFAULTS = {
    delivery: '', seller: null, bank: '', buyerAddress: '', marks: '',
    shipment: '', vessel: '', origin: '', contractTerms: '', signDate: '', signPlace: '',
    packagingMode: null, totalPackages: null
  };
  /* v5 单据级定价参数的默认值（仅"缺失才补"）：null = 未记录/待补，
     新报价的具体默认参数由 P1-C 编辑器负责，这里不伪造任何历史值或业务默认值。 */
  const V5_DOC_DEFAULTS = {
    fx: null, feeRate: null, targetMargin: null, commissionRate: null,
    freightMarkup: null, markupRate: null, feeInPrice: null, pricingVersion: null, fees: []
  };
  function withV4DocDefaults(doc) {
    Object.keys(V4_DOC_DEFAULTS).forEach(k => { if (!(k in doc)) doc[k] = V4_DOC_DEFAULTS[k]; });
    Object.keys(V5_DOC_DEFAULTS).forEach(k => { if (!(k in doc)) doc[k] = k === 'fees' ? [] : V5_DOC_DEFAULTS[k]; });
    return doc;
  }

  /*
   * 读旧版 localStorage 数据 —— 必须分类，不能"读不出来就当没有"。
   *
   * 为什么重要：如果旧键存在但内容坏了，而我们把它当成"没有历史数据"，
   * 程序就会 seed 演示数据并写盘，用户看到的是"数据变 3 条演示客户"，
   * 而他真正的旧数据还在那个坏键里，等于被悄悄盖掉了一层线索。
   * 所以：键不存在 → none；其余任何异常 → 一律阻止初始化，进只读态让人处理。
   *
   * 返回 { status, data?, raw?, sha256?, error? }
   *   status: 'none' | 'readError' | 'parseError' | 'future' | 'invalid' | 'ok'
   */
  function readLegacyLocalStorage() {
    let raw;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      return { status: 'readError', error: (e && e.message) || String(e) };
    }
    if (raw === null || raw === undefined) return { status: 'none' };
    if (typeof raw !== 'string' || raw.trim() === '') return { status: 'parseError', raw: String(raw) };

    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      return { status: 'parseError', raw, error: (e && e.message) || String(e) };
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { status: 'invalid', raw };

    const v = MODEL.detectVersion(obj);
    if (v === null) return { status: 'invalid', raw };
    if (v > MODEL.SCHEMA_VERSION) return { status: 'future', raw, version: v };

    const val = MODEL.validateV2(obj);
    if (!val.ok) return { status: 'invalid', raw, errors: val.errors };
    return { status: 'ok', raw, data: obj, sha256: fingerprint(raw) };
  }

  /* 旧数据的指纹（优先用 crypto.subtle 之外的同步实现，避免异步） */
  function fingerprint(text) {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        /* 说明：渲染层没有同步 sha256；这里用长度+简单校验和作为"指纹"，够用于报告留痕 */
        let h = 0;
        for (let i = 0; i < text.length; i++) { h = ((h << 5) - h + text.charCodeAt(i)) | 0; }
        return 'len' + text.length + '-sum' + (h >>> 0).toString(16);
      }
    } catch (e) {}
    return 'len' + text.length;
  }

  /*
   * 事务：内存改动与磁盘写入要么一起成功，要么一起回滚。
   * fn 返回 false 表示业务校验失败（回滚）；抛异常也回滚。
   */
  function transact(fn) {
    if (blocked || !db) {
      notice('error', '当前数据处于只读状态（' + (blockReason || '数据不可用') + '），这次改动没有保存。');
      return false;
    }
    const snapshot = JSON.stringify(db);
    let r;
    try {
      r = fn(db);
    } catch (e) {
      db = JSON.parse(snapshot);
      notice('error', '操作未完成：' + (e && e.message ? e.message : String(e)) + '。已回滚到操作前的状态。');
      return false;
    }
    if (r === false) { db = JSON.parse(snapshot); return false; }
    if (!save()) { db = JSON.parse(snapshot); return false; }
    return true;
  }

  function save() {
    if (blocked || !db) {
      saveError = '数据处于只读状态';
      return false;
    }
    if (!HAVE_BRIDGE) {
      saveError = '数据桥未就绪';
      return false;
    }
    let r;
    try { r = window.SBW.save(db); } catch (e) { r = { ok: false, error: e.message }; }
    if (!r || !r.ok) {
      saveError = (r && r.error) || '未知错误';
      notice('error', '数据保存失败：' + saveError + '。这次改动没有落到磁盘上，请勿关闭程序，先检查磁盘空间或权限。');
      return false;
    }
    saveError = null;
    /* 主数据写成功、但每日备份失败：只给提醒，不回滚内存（否则内存会与磁盘不一致） */
    if (r.warning) notice('warn', r.warning);
    return true;
  }

  /* ---------- 启动 ---------- */

  function bootstrap() {
    if (!HAVE_BRIDGE) {
      enterBlocked('error', '数据通道未就绪（window.SBW 不存在），已进入只读状态。');
      return;
    }

    let r = null;
    try { r = window.SBW.load(); } catch (e) { r = { ok: false, status: 'error', message: (e && e.message) || String(e) }; }
    if (!r || !r.status) { enterBlocked('error', '读取数据失败：' + ((r && r.message) || '无返回')); return; }

    switch (r.status) {
      case 'ok':
        db = r.data ? normalize(r.data) : null;
        blocked = false;
        state = 'ok';
        break;

      case 'recovered':
        db = normalize(r.data);
        blocked = false;
        state = 'recovered';
        if (r.message) notice('warn', r.message);
        break;

      case 'needsMigration':
        runMigration();
        break;

      case 'empty':
        initFirstRun();
        break;

      case 'unsupported':
        enterBlocked('unsupported', r.message);
        break;

      /* v4 不存在且无痕迹，但旧源（v3/v2）读不出来或已损坏：
         按 D3-B1 铁律"停止，不换更旧源、不初始化空库"，只读等用户处理。 */
      case 'legacyUnreadable':
        enterBlocked('legacyUnreadable', r.message);
        break;

      case 'legacyCorrupt':
        enterBlocked('legacyCorrupt', r.message);
        break;

      /* 主文件读不出来（权限 / IO / 目标是目录等）：
         这不是"内容坏了"，所以既不 seed、也不自动恢复，进只读态等用户处理。 */
      case 'unreadable':
        enterBlocked('unreadable', r.message);
        break;

      case 'corrupt':
        enterBlocked('corrupt', r.message);
        break;

      case 'invalid':
        enterBlocked('invalid', r.message);
        break;

      case 'error':
      default:
        enterBlocked('error', r.message || ('未知的数据状态：' + r.status));
        break;
    }
  }

  /* 迁移：主进程负责读旧文件 → 备份 → 构造 v4 → 一次性原子落盘；成功后这里才切换内存 */
  function runMigration() {
    let r = null;
    try { r = window.SBW.migrate(); } catch (e) { r = { ok: false, error: (e && e.message) || String(e) }; }
    if (!r || !r.ok) {
      enterBlocked('migrateFail', '旧数据迁移未完成：' + ((r && r.error) || '未知错误') + '。旧数据文件没有被修改，程序进入只读状态。');
      return;
    }
    db = normalize(r.data);
    blocked = false;
    state = 'migrated';
    migrationReport = r.report || null;
    const srcV = r.report && r.report.sourceVersion ? ('v' + r.report.sourceVersion) : '旧版';
    notice('info', '已把' + srcV + '数据迁移到新版数据文件（v5）。旧文件已原样备份，未被修改。' +
      (r.report && r.report.chainNote ? r.report.chainNote : ''));

    if (r.report) {
      if (r.report.legacyFormat && r.report.legacyFormat.length) {
        notice('info', '有 ' + r.report.legacyFormat.length + ' 张历史单据沿用旧编号，已原样保留（新单据改用新编号规则，不会冲突）。');
      }
      if (r.report.anomalies && r.report.anomalies.length) {
        notice('warn', '迁移发现 ' + r.report.anomalies.length + ' 处单号格式异常，已原样保留未改写，详见迁移报告。');
      }
      if (r.report.duplicates && r.report.duplicates.length) {
        notice('warn', '迁移发现 ' + r.report.duplicates.length + ' 组重复单号，已原样保留未改写，详见迁移报告。');
      }
      if (r.report.totalsDifferFromItems) {
        notice('warn', '有 ' + r.report.totalsDifferFromItems + ' 张历史报价的合计与明细计算值不一致，已按原合计保留，未静默改写。');
      }
      if (r.report.addedDefaults) {
        const a = r.report.addedDefaults;
        const parts = [];
        if (a.docs) parts.push(a.docs + ' 张单据');
        if (a.rows) parts.push(a.rows + ' 个明细行');
        if (a.products) parts.push(a.products + ' 个产品');
        if (a.customers) parts.push(a.customers + ' 个客户');
        if (a.settings) parts.push('设置');
        if (parts.length) {
          const isV5 = r.report.sourceVersion >= 4;
          notice('info', (isV5 ? 'v5 新增的字段（规格描述、成本快照、定价参数等）在' : '新版新增的字段（交期、卖方、银行、唛头、包装信息等）在') + parts.join('、') +
            '上按"待补/未记录"处理，原有数据一字未改；用到时候在单据里补上即可。');
        }
      }
    }
  }

  /*
   * 只有「完全没有任何历史数据」才允许初始化新库。
   * 有历史痕迹但读不了（旧键坏了）时，必须阻止初始化 —— 不能 seed 演示数据。
   */
  function initFirstRun() {
    const legacy = readLegacyLocalStorage();

    if (legacy.status === 'readError') {
      enterBlocked('legacyUnreadable',
        '检测到旧版本数据，但读取失败：' + (legacy.error || '未知原因') +
        '。为避免把旧数据当成"没有数据"而初始化一份空库，程序已进入只读状态，不会写入任何文件。');
      return;
    }
    if (legacy.status === 'parseError') {
      enterBlocked('legacyCorrupt',
        '检测到旧版本数据，但内容已损坏（不是合法 JSON）。程序不会把它当作"首次使用"，' +
        '也不会写入演示数据，已进入只读状态。原始内容仍保存在旧版数据里，请联系处理或从备份恢复。');
      return;
    }
    if (legacy.status === 'future') {
      enterBlocked('legacyFuture',
        '检测到旧版本数据由更新版本创建（v' + legacy.version + '），本程序拒绝迁移，已进入只读状态。');
      return;
    }
    if (legacy.status === 'invalid') {
      enterBlocked('legacyInvalid',
        '检测到旧版本数据，但结构无法识别' + (legacy.errors && legacy.errors.length ? '（' + legacy.errors.join('；') + '）' : '') +
        '。程序不会覆盖它，也不会写入演示数据，已进入只读状态。');
      return;
    }

    if (legacy.status === 'ok') {
      /* localStorage 链：v2 → v3 → v4 → v5（与主进程 migrate 同一套纯函数）。
         不能只迁到中途就 save —— storage.save 的写门要求 v5，会整体拒绝。 */
      const m1 = MODEL.migrateV2toV3(legacy.data, {
        sourceFile: 'localStorage:' + KEY,
        sourceSha256: legacy.sha256 || '',
        doneAt: new Date().toISOString()
      });
      if (!m1.ok) {
        enterBlocked('migrateFail', '旧版本数据迁移失败：' + m1.error + '。原始数据未被删除，程序进入只读状态。');
        return;
      }
      const m2 = MODEL.migrateV3toV4(m1.data, {
        sourceFile: 'localStorage:' + KEY,
        sourceSha256: legacy.sha256 || '',
        doneAt: new Date().toISOString()
      });
      if (!m2.ok) {
        enterBlocked('migrateFail', '旧版本数据迁移到 v4 失败：' + m2.error + '。原始数据未被删除，程序进入只读状态。');
        return;
      }
      const m3 = MODEL.migrateV4toV5(m2.data, {
        sourceFile: 'localStorage:' + KEY,
        sourceSha256: legacy.sha256 || '',
        doneAt: new Date().toISOString()
      });
      if (!m3.ok) {
        enterBlocked('migrateFail', '旧版本数据迁移到 v5 失败：' + m3.error + '。原始数据未被删除，程序进入只读状态。');
        return;
      }
      db = normalize(m3.data);
      blocked = false;
      state = 'migrated';
      migrationReport = {
        source: 'localStorage:' + KEY,
        sourceVersion: 2,
        sourceSha256: legacy.sha256 || '',
        counts: m3.report.counts,
        addedDefaults: m3.report.addedDefaults,
        v2toV3: {
          unknownTopKeys: m1.report.unknownTopKeys,
          duplicates: m1.report.duplicates,
          anomalies: m1.report.anomalies,
          legacyFormat: m1.report.legacyFormat,
          totalsDifferFromItems: m1.report.totalsDifferFromItems
        }
      };
      const saved = save();
      if (!saved) {
        enterBlocked('migrateFail', '把旧版本数据写入新版数据文件失败，已停止（原始数据未删除）。');
        return;
      }
      notice('info', '已把旧版本里的数据迁移到新版数据文件（' + (m2.report.counts.quotesArchived || 0) + ' 张历史单据），以后可以在「设置」里直接看到文件。');
      return;
    }

    /* status === 'none'：确认无任何历史数据，才允许初始化 */
    db = seed();
    blocked = false;
    state = 'empty';
    if (!save()) {
      blocked = true;
      state = 'error';
      blockReason = '首次初始化数据文件写入失败';
      notice('error', '初始化数据文件失败：' + (saveError || '未知错误') + '。请检查磁盘空间或权限。');
      return;
    }
    notice('info', '当前是 3 条演示客户，用来试手感的。正式用之前可以在「设置 → 数据」里一键清空。');
  }

  bootstrap();

  /* ---------- 单据服务层 ---------- */

  /* 分配单号（只读计算，真正推进计数器在 addDocument 的事务里） */
  function allocate(type, dateStr) {
    if (!db) return null;
    const r = MODEL.allocateNo(db, type, dateStr || dayKey());
    if (!r.ok) { notice('error', '单号分配失败：' + r.error); return null; }
    return r;
  }

  /*
   * 新建单据的写入前处理（在 transact 事务内调用，不单独落盘）。
   * 按类型分支：
   *   · QT/PI/SC/CI（金额类）：行校验 → finalizeItems → documentTotals；
   *   · PL（装箱单，无金额）：行上没有 price/amount，汇总走 MODEL.packagingTotals
   *     （件数/净重/毛重/体积，缺项为 null 待补），历史/自定义 totals 键不猜不删。
   */
  function writeDocument(doc) {
    if (!db) return false;
    withV4DocDefaults(doc);
    if (doc._unknown && doc._unknown.quoteLayout !== undefined && MODEL.sanitizeQuoteLayout) {
      doc._unknown.quoteLayout = MODEL.sanitizeQuoteLayout(doc._unknown.quoteLayout);
    }
    const r = MODEL.validateItems(doc.items, doc.type);
    if (!r.ok) { notice('error', '单据数据有问题：' + r.error + '（未保存）'); return false; }
    /* 与更新路径同一套行合并：编辑副本里带的扩展字段不被校验重建丢掉 */
    doc.items = MODEL.finalizeItems(doc.items, r.items, null);
    if (doc.type === 'PL') {
      /* 包装汇总唯一实现在 MODEL.packagingTotals（separate/mixed/null 三态） */
      const p = MODEL.packagingTotals(doc.items, doc.packagingMode, doc.totalPackages);
      doc.totals = { packages: p.packages, net: p.net, gross: p.gross, volume: p.volume };
    } else {
      /* 合计只认 model.js 的统一口径（行金额先舍入到分，合计再舍入到分）。
         previousGrand：由**转换**带过来的源单原合计（留证用，转换矩阵 §4 / 验收案例 B1）。
         普通新建单没有来源，记 null——不拿它冒充历史值，也不在落盘时把它丢掉。 */
      const t = MODEL.documentTotals(r.items);
      const prev = (doc.totals && doc.totals.previousGrand != null && isFinite(+doc.totals.previousGrand))
        ? +doc.totals.previousGrand : null;
      doc.totals = Object.assign({}, doc.totals || {}, { subtotal: t.subtotal, grand: t.grand, computedFromItems: t.grand, previousGrand: prev });
    }
    doc.updatedAt = new Date().toISOString();
    if (!doc.createdAt) doc.createdAt = doc.updatedAt;
    db.documents.unshift(doc);
    return true;
  }

  function validDay(value) {
    if(value==='')return true;
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===value;
  }
  function profileValid(p,type) {
    if(type==='product'&&p&&p.specs!=null){const error=typeof SBProductSpecs!=='undefined'?SBProductSpecs.validate(p.specs):'产品参数模块未加载';if(error){notice('error',error);return false;}}
    if(!p || !String(type==='customer' ? p.name||p.company||'' : p.nameCn||'').trim()) {notice('error','请填写客户名称或产品品名');return false;}
    const keys=type==='customer'?['amount']:['mesh','wire','width','rollLen','price','productLength','productWidth','productHeight','productWeight','packageLength','packageWidth','packageHeight','unitsPerCarton','netWeight','grossWeight'];
    for(const k of keys)if(p[k]!==undefined && (typeof p[k]!=='number' || !Number.isFinite(p[k]) || p[k]<0)) {notice('error','金额、规格须为有限非负数');return false;}
    if(type==='product' && p.unitsPerCarton !== undefined && p.unitsPerCarton !== 0 && !Number.isInteger(p.unitsPerCarton)) {notice('error','每箱装件数须为正整数或留空');return false;}
    if(type==='product' && p.netWeight > 0 && p.grossWeight > 0 && p.grossWeight < p.netWeight) {notice('error','单箱毛重不能小于单箱净重');return false;}
    if(type==='customer' && p.next!==undefined && !validDay(p.next)){notice('error','跟进日期无效');return false;}
    if(type==='product' && p.imageData && (typeof p.imageData!=='string' || p.imageData.length>1000100 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.imageData))) {notice('error','图片格式无效');return false;}
    /* P1-D-05：独立可选实物图与规格图同一套格式/长度约束，字段不强制存在。 */
    if(type==='product' && p.realImageData && (typeof p.realImageData!=='string' || p.realImageData.length>1000100 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.realImageData))) {notice('error','实物图格式无效');return false;}
    /* P1-D-05-FIX-01：实物图三态字段校验（可选，缺省=auto；不升级 Schema V5）。 */
    if(type==='product' && p.realImageMode!=null && p.realImageMode!=='' && ['auto','custom','none'].indexOf(p.realImageMode)<0) {notice('error','实物图状态无效');return false;}
    /* P1-RC-DB：产品多图与扩展文本（可选）。与模型读门/写门同一份规则。 */
    if(type==='product' && MODEL){
      const e1=[]; if(MODEL.validateProductImages) MODEL.validateProductImages(p,'',e1);
      if(MODEL.validateProductExtraText) MODEL.validateProductExtraText(p,'',e1);
      if(e1.length){notice('error','产品资料未保存：'+e1[0]);return false;}
    }
    /* P1-RC-DB：客户扩展字段（可选）。 */
    if(type==='customer' && MODEL){
      const e2=[]; if(MODEL.validateCustomerExtras) MODEL.validateCustomerExtras(p,'',e2);
      if(e2.length){notice('error','客户资料未保存：'+e2[0]);return false;}
    }
    return true;
  }

  return {
    /* ---- 基础 ---- */
    get() { return db || {}; },
    raw() { return db; },
    save,
    uid,
    notices() { return notices; },
    clearNotices() { notices = []; },
    dismissNotice(i) { notices.splice(i, 1); },
    saveError() { return saveError; },
    status() { return state; },
    blocked() { return blocked; },
    blockReason() { return blockReason; },
    migrationReport() { return migrationReport; },
    dayKey,
    monthKey: nowMonthKey,
    todayPlus,

    /* D4: profiles and communications use the same rollback transaction as documents. */
    customers() { return db ? JSON.parse(JSON.stringify(db.customers)) : []; },
    addCustomer(c) {
      if (!profileValid(c, 'customer')) return false;
      const next = Object.assign({}, c, {id:uid(),created:dayKey()});
      return transact(d => { d.customers.unshift(next); return true; });
    },
    updateCustomer(c) {
      if (!profileValid(c, 'customer')) return false;
      return transact(d => {
        const i=d.customers.findIndex(x=>x.id===c.id);
        if(i<0) { notice('error','客户不存在，请重新打开列表'); return false; }
        d.customers[i]=Object.assign({},d.customers[i],c);return true;
      });
    },
    customerLinks(id) {
      return {documents:this.documents().filter(x=>x.customer && x.customer.id===id),
        communications:this.communications(id)};
    },
    removeCustomer(id) {
      return transact(d=>{
        if(d.documents.some(x=>x.customer && x.customer.id===id) || d.communications.some(x=>x.customerId===id)) {
          notice('error','客户仍有关联单据或沟通记录，保留档案；可改为已流失。不会级联删除历史。');return false;
        }
        const i=d.customers.findIndex(x=>x.id===id);if(i<0)return false;
        d.customers.splice(i,1);return true;
      });
    },
    products() { return db ? JSON.parse(JSON.stringify(db.products)) : []; },
    addProduct(p) {
      if(!profileValid(p,'product'))return false;
      return transact(d=>{d.products.unshift(Object.assign({},p,{id:uid()}));return true;});
    },
    importProducts(products) {
      if(!Array.isArray(products)||!products.length||products.length>500)return false;
      if(products.some(p=>!profileValid(p,'product')))return false;
      return transact(d=>{const seen=new Set(d.products.map(p=>String(p.sku||'').trim().toLowerCase()).filter(Boolean));
        const incoming=products.filter(p=>{const key=String(p.sku||'').trim().toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;});
        if(!incoming.length)return false;d.products.unshift(...incoming.map(p=>Object.assign({},p,{id:uid()})));return true;});
    },
    updateProduct(p) {
      if(!profileValid(p,'product'))return false;
      return transact(d=>{const i=d.products.findIndex(x=>x.id===p.id);if(i<0)return false;
        d.products[i]=Object.assign({},d.products[i],p);return true;});
    },
    removeProduct(id) { return transact(d=>{const i=d.products.findIndex(x=>x.id===id);if(i<0)return false;d.products.splice(i,1);return true;}); },

    /* ---------- P1-RC-DB：产品多图 ----------
     * P1-RC-DB-FIX-01 BUG-03：语义按"字段是否存在"判定，而不是"数组是否非空"。
     *   · 没有 images 字段      → 兼容合成（realImageData→main、imageData→spec），只读不写回；
     *   · 有 images（哪怕 []）  → 直接按它读取，**空数组就是"用户明确清空"**，不得再回退合成。
     * 两种情况都不修改 imageData / realImageData / realImageMode。 */
    productImagesOf(id) {
      const p = db && db.products.find(x => x.id === id);
      if (!p) return [];
      if (Object.prototype.hasOwnProperty.call(p, 'images')) {
        const list = Array.isArray(p.images) ? p.images : [];
        return JSON.parse(JSON.stringify(list)).sort((a, b) => (+a.sort || 0) - (+b.sort || 0));
      }
      const out = [];
      if (p.realImageData) out.push({ data: p.realImageData, type: 'main', sort: 0, caption: '' });
      if (p.imageData) out.push({ data: p.imageData, type: 'spec', sort: 1, caption: '' });
      return out;
    },

    /* ---------- P1-RC-DB：供应商与供应商报价（_unknown 受控结构） ----------
     * 历史采购价只增不改：这里只有 add，没有 update/delete；
     * 同一产品同一供应商再次录入 = 新增一条，旧记录永久保留。 */
    suppliers() {
      const u = (db && db._unknown) || {};
      return JSON.parse(JSON.stringify(Array.isArray(u.suppliers) ? u.suppliers : []));
    },
    addSupplier(s) {
      const src = s || {};
      const rec = {
        id: uid(),
        name: String(src.name == null ? '' : src.name).trim(),
        contact: String(src.contact == null ? '' : src.contact),
        remarks: String(src.remarks == null ? '' : src.remarks),
        createdAt: new Date().toISOString()
      };
      const errs = [];
      if (MODEL && MODEL.validateSuppliers) MODEL.validateSuppliers({ _unknown: { suppliers: [rec] } }, errs);
      if (errs.length) { notice('error', '供应商未保存：' + errs[0]); return false; }
      const ok = transact(d => {
        if (!d._unknown || typeof d._unknown !== 'object' || Array.isArray(d._unknown)) d._unknown = {};
        if (!Array.isArray(d._unknown.suppliers)) d._unknown.suppliers = [];
        d._unknown.suppliers.push(rec);
        return true;
      });
      return ok ? JSON.parse(JSON.stringify(rec)) : false;
    },
    supplierQuotes(productId) {
      const u = (db && db._unknown) || {};
      const list = Array.isArray(u.supplierQuotes) ? u.supplierQuotes : [];
      const out = productId === undefined ? list : list.filter(x => x && x.productId === productId);
      return JSON.parse(JSON.stringify(out)).sort((a, b) => String(b.quoteDate || '').localeCompare(String(a.quoteDate || '')));
    },
    addSupplierQuote(q) {
      const src = q || {};
      const rec = {
        id: uid(),
        supplierId: src.supplierId ? String(src.supplierId) : null,
        supplierName: String(src.supplierName == null ? '' : src.supplierName).trim(),
        productId: String(src.productId == null ? '' : src.productId),
        currency: src.currency,
        price: typeof src.price === 'number' ? src.price : Number(src.price),
        unit: String(src.unit == null ? '' : src.unit).trim(),
        moq: String(src.moq == null ? '' : src.moq),
        quoteDate: src.quoteDate || '',
        validUntil: src.validUntil || '',
        sourceFile: String(src.sourceFile == null ? '' : src.sourceFile),
        createdAt: new Date().toISOString()
      };
      const errs = [];
      if (MODEL && MODEL.validateSuppliers) MODEL.validateSuppliers({ _unknown: { supplierQuotes: [rec] } }, errs);
      if (errs.length) { notice('error', '采购价未保存：' + errs[0]); return false; }
      if (!db.products.some(x => x.id === rec.productId)) { notice('error', '采购价未保存：产品不存在'); return false; }
      const sups = this.suppliers();
      if (rec.supplierId && !sups.some(s => s.id === rec.supplierId)) { notice('error', '采购价未保存：供应商不存在'); return false; }
      const ok = transact(d => {
        if (!d._unknown || typeof d._unknown !== 'object' || Array.isArray(d._unknown)) d._unknown = {};
        if (!Array.isArray(d._unknown.supplierQuotes)) d._unknown.supplierQuotes = [];
        /* 同一条记录永远新增，不覆盖历史（只增不改） */
        d._unknown.supplierQuotes.push(rec);
        return true;
      });
      return ok ? JSON.parse(JSON.stringify(rec)) : false;
    },

    /* ---------- P1-RC-DB：设置扩展（公司/银行/默认参数） ----------
     * 新容器 companyProfile / bank / defaults；
     * 读取时兼容旧 company / contact / sellerAddress / pricingDefaults，
     * 但保存只写新容器，**不覆盖**任何已有用户配置。 */
    settingsProfile() {
      const s = (db && db.settings) || {};
      const cp = (s.companyProfile && typeof s.companyProfile === 'object') ? s.companyProfile : {};
      const bk = (s.bank && typeof s.bank === 'object') ? s.bank : {};
      const df = (s.defaults && typeof s.defaults === 'object') ? s.defaults : {};
      const pd = (s.pricingDefaults && typeof s.pricingDefaults === 'object') ? s.pricingDefaults : {};
      const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
      const first = (a, b) => (a !== null && a !== undefined && a !== '') ? a : (b !== null && b !== undefined ? b : '');
      return {
        companyProfile: {
          nameEn: first(cp.nameEn, ''), nameCn: first(cp.nameCn, first(s.company, '')),
          contact: first(cp.contact, first(s.contact, '')), email: first(cp.email, ''),
          phone: first(cp.phone, ''), whatsapp: first(cp.whatsapp, ''),
          website: first(cp.website, ''), addressEn: first(cp.addressEn, first(s.sellerAddress, ''))
        },
        bank: {
          name: first(bk.name, ''), accountName: first(bk.accountName, ''),
          accountNumber: first(bk.accountNumber, ''), swift: first(bk.swift, ''),
          address: first(bk.address, '')
        },
        defaults: {
          fx: num(df.fx) !== null ? num(df.fx) : num(pd.fx),
          feeRate: num(df.feeRate) !== null ? num(df.feeRate) : num(pd.feeRate),
          targetMargin: num(df.targetMargin) !== null ? num(df.targetMargin) : num(pd.targetMargin),
          commissionRate: num(df.commissionRate) !== null ? num(df.commissionRate) : num(pd.commissionRate),
          lossPolicy: df.lossPolicy === 'zero_on_loss' ? 'zero_on_loss' : 'zero_on_loss'
        },
        hasStoredProfile: !!(s.companyProfile || s.bank || s.defaults)
      };
    },
    saveSettingsProfile(patch) {
      /* P1-RC-DB-FIX-01 BUG-02：**按"提交了哪些键"局部更新**。
         未提交的键一律保持原值；显式 null 才是"清除"；显式空串允许清空文本。
         旧版把未提交字段写成 ''/null，导致保存"只改公司中文名"会把其余七项清空。
         公司/银行/默认参数三个容器分别合并，且只写这三个新容器，
         绝不触碰 legacy 的 company / contact / sellerAddress / pricingDefaults。 */
      const p = patch || {};
      const cur = (db && db.settings) || {};
      const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
      const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

      function mergeText(stored, src, maxes) {
        const out = Object.assign({}, isObj(stored) ? stored : {});
        let touched = false;
        Object.keys(maxes).forEach(function (k) {
          if (!has(src, k)) return;
          touched = true;
          const v = src[k];
          if (v === null) { delete out[k]; return; }
          out[k] = String(v).slice(0, maxes[k]);
        });
        return touched ? out : null;
      }

      const clean = {};
      if (isObj(p.companyProfile)) {
        const merged = mergeText(cur.companyProfile, p.companyProfile, {
          nameEn: 200, nameCn: 200, contact: 200, email: 200,
          phone: 100, whatsapp: 100, website: 300, addressEn: 1000
        });
        if (merged) clean.companyProfile = merged;
      }
      if (isObj(p.bank)) {
        const merged = mergeText(cur.bank, p.bank, {
          name: 200, accountName: 200, accountNumber: 100, swift: 50, address: 500
        });
        if (merged) clean.bank = merged;
      }
      if (isObj(p.defaults)) {
        const d = p.defaults;
        const stored = isObj(cur.defaults) ? cur.defaults : {};
        const out = Object.assign({}, stored);
        let touched = false;
        const rateKeys = ['feeRate', 'targetMargin', 'commissionRate'];
        if (has(d, 'fx')) {
          touched = true;
          if (d.fx === null || d.fx === '') out.fx = null;
          else {
            const n = Number(d.fx);
            if (!isFinite(n) || n <= 0) { notice('error', '默认汇率须大于零'); return false; }
            out.fx = n;
          }
        }
        for (const k of rateKeys) {
          if (!has(d, k)) continue;
          touched = true;
          const v = d[k];
          if (v === null || v === '') { out[k] = null; continue; }
          const n = Number(v);
          const tag = k === 'feeRate' ? '默认费率' : (k === 'targetMargin' ? '默认目标毛利率' : '默认提成比例');
          if (!isFinite(n) || n < 0 || n >= 1) { notice('error', tag + '须在 [0,100%) 内'); return false; }
          out[k] = n;
        }
        if (has(d, 'lossPolicy')) {
          touched = true;
          if (d.lossPolicy !== null && d.lossPolicy !== '' && d.lossPolicy !== 'zero_on_loss') {
            notice('error', '亏损提成规则只支持 zero_on_loss'); return false;
          }
          /* null/'' = 回到默认口径（唯一受支持策略），不存在"未设置"状态 */
          out.lossPolicy = 'zero_on_loss';
        }
        if (touched) {
          /* 合并后的有效值组合校验（不是只看本次提交的两个数） */
          if (out.fx !== null && out.fx !== undefined && (!isFinite(out.fx) || out.fx <= 0)) {
            notice('error', '默认汇率须大于零'); return false;
          }
          if (typeof out.feeRate === 'number' && typeof out.targetMargin === 'number' && out.feeRate + out.targetMargin >= 1) {
            notice('error', '默认费率 + 目标毛利率必须小于 100%'); return false;
          }
          clean.defaults = out;
        }
      }

      if (!Object.keys(clean).length) return false;
      return transact(d => {
        d.settings = d.settings || {};
        if (clean.companyProfile) d.settings.companyProfile = clean.companyProfile;
        if (clean.bank) d.settings.bank = clean.bank;
        if (clean.defaults) d.settings.defaults = clean.defaults;
        return true;
      });
    },
    communications(customerId) {
      const list=db ? db.communications : [];
      return JSON.parse(JSON.stringify(list.filter(x=>customerId===undefined || x.customerId===customerId)))
        .sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
    },
    saveCommunication(entry, nextFollowup) {
      if(!entry || !String(entry.text||'').trim() || String(entry.text).length>20000 ||
         !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d/.test(entry.at||'') || !validDay(String(entry.at||'').slice(0,10)) || !Number.isFinite(Date.parse(entry.at))) {
        notice('error','请填写沟通内容和有效日期时间');return false;
      }
      if(nextFollowup!==undefined && !validDay(nextFollowup)) {notice('error','下次跟进日期无效');return false;}
      return transact(d=>{
        const c=d.customers.find(x=>x.id===entry.customerId);if(!c){notice('error','客户不存在');return false;}
        const i=entry.id ? d.communications.findIndex(x=>x.id===entry.id) : -1;
        if(entry.id && (i<0 || d.communications[i].customerId!==entry.customerId))return false;
        const old=i<0 ? {} : d.communications[i];
        const row=Object.assign({},old,{id:old.id||uid(),customerId:c.id,text:String(entry.text).trim(),
          at:entry.at,channel:String(entry.channel||''),updatedAt:new Date().toISOString()});
        if(i<0)d.communications.unshift(row);else d.communications[i]=row;
        if(nextFollowup!==undefined)c.next=nextFollowup;
        return true;
      });
    },
    removeCommunication(id) {
      return transact(d=>{const i=d.communications.findIndex(x=>x.id===id);if(i<0)return false;d.communications.splice(i,1);return true;});
    },
    workbench() {
      const customers=this.customers(), docs=this.documents(), today=dayKey(), month=nowMonthKey();
      const active=customers.filter(c=>!['已成交','已流失'].includes(c.stage));
      const due=active.filter(c=>validDay(c.next) && c.next && c.next<=today).sort((a,b)=>a.next.localeCompare(b.next));
      const quotes=docs.filter(d=>d.type==='QT'), monthly=quotes.filter(d=>String(d.date||'').slice(0,7)===month);
      const amounts={};monthly.forEach(d=>{const n=d.totals && d.totals.grand;
        if(typeof n==='number' && Number.isFinite(n)) {const cur=d.currency||'未填币种';amounts[cur]=(amounts[cur]||0)+n;}});
      return {customers:customers.length,products:this.products().length,documents:docs.length,
        due,monthlyQuotes:monthly.length,quotes:quotes.length,amounts,
        recentDocuments:docs.sort((a,b)=>String(b.updatedAt||b.createdAt||b.date||'').localeCompare(String(a.updatedAt||a.createdAt||a.date||''))).slice(0,6),
        recentCommunications:this.communications().slice(0,5),demo:customers.some(c=>c.demo)||this.products().some(p=>p.demo)};
    },

    /* ---- 单据（统一存 documents，type 区分） ---- */
    /* 读取一律返回深拷贝：页面拿到的永远是独立副本，
       不可能出现"先改 Store.get()/getDocument() 返回的活动对象再保存"这种暗改。
       要落盘必须走 addDocument / updateDocument（事务 + 校验 + 原子写）。 */
    documents(type) {
      if (!db) return [];
      const src = type ? db.documents.filter(d => d.type === type) : db.documents;
      return src.map(d => JSON.parse(JSON.stringify(d)));
    },
    getDocument(id) {
      const d = db ? (db.documents.find(x => x.id === id) || null) : null;
      return d ? JSON.parse(JSON.stringify(d)) : null;
    },
    /* 供 D2/D3 使用：带编号分配与客户端校验的通用写入 */
    addDocument(spec) {
      if (blocked || !db) { notice('error', '当前数据只读，无法新建单据。'); return false; }
      const type = spec.type || 'QT';
      const date = spec.date || dayKey();
      /* 来源必须指向一张真实存在的单据（转换矩阵 §3：sourceId 指直接源）。
         源单后来被删除不影响已生成的单——这里只在新建这一刻校验，历史单不去回溯。 */
      if (spec.sourceId && !db.documents.some(x => x.id === spec.sourceId)) {
        notice('error', '来源单据不存在了，不能新建（未取号、未保存）');
        return false;
      }
      const alloc = allocate(type, date);
      if (!alloc) return false;
      const doc = Object.assign({}, spec, { id: uid(), no: alloc.no, type, date, sourceId: spec.sourceId || null });
      const ok = transact(d => {
        if (!d.counters[type]) d.counters[type] = {};
        d.counters[type][alloc.ym] = alloc.seq;         /* 先占号，同一次落盘 */
        return writeDocument(doc);
      });
      return ok ? doc : false;
    },
    removeDocument(id) { return transact(d => { d.documents = d.documents.filter(x => x.id !== id); return true; }); },

    /*
     * 更新已有单据（D2 编辑闭环的唯一保存入口）。
     * 规则：
     *   · patch 应来自「独立编辑副本」（UI 从 getDocument 拿深拷贝改），这里不碰任何活动对象；
     *   · 合并逻辑全在 MODEL.patchDocument：ID/单号/类型/来源/创建日期不动，未知字段保留，
     *     totals 按统一口径重算，updatedAt 刷新，行级未知字段按索引带回；
     *   · 事务内按原下标原地替换：不重排、不改写其他单据、不重新分号；
     *   · 校验不过 / 只读 / 落盘失败一律返回 false 并留下 notice，调用方的草稿自行保留待重试。
     */
    updateDocument(id, patch) {
      return transact(d => {
        const i = d.documents.findIndex(x => x.id === id);
        if (i < 0) { notice('error', '要改的单据不存在（可能已被删除），这次修改没有保存。'); return false; }
        const r = MODEL.patchDocument(d.documents[i], patch);
        if (!r.ok) { notice('error', '单据没有保存：' + r.error); return false; }
        d.documents[i] = r.doc;
        return true;
      });
    },

    /*
     * 导出阶段校验（B3 受控 PDF 的预检口；B1 只预留接口，界面不接）。
     * 与"保存级校验"的区别：保存允许 PL 包装四件套留 null（草稿待补），
     * 导出不允许 —— PL 缺包装/缺模式/混装缺 totalPackages 是硬错误，
     * CI/SC 缺 HS/运输/签订信息、缺卖方/银行进 warnings 清单。
     * 数据不走内存草稿：经主进程 db:getDocument 从磁盘权威读取已存单据，
     * 读失败如实返回，不降级、不拿备份顶替（storage.readSavedDocument 的约定）。
     */
    async exportCheck(id) {
      let r = null;
      try { r = await window.SBW.getDocument(id); } catch (e) { r = { ok: false, error: (e && e.message) || String(e) }; }
      if (!r || !r.ok) {
        return { ok: false, error: (r && r.error) || '读取已保存单据失败', code: (r && r.code) || '' };
      }
      try {
        return MODEL.validateForExport(r.document);
      } catch (e) {
        return { ok: false, error: '导出校验出错：' + ((e && e.message) || e) };
      }
    },

    /* ---- 兼容适配层：旧页面的 quotes()/addQuote()/removeQuote() ---- */
    quotes() {
      if (!db) return [];
      return db.documents.filter(d => d.type === 'QT').map(MODEL.documentToQuote).filter(Boolean);
    },
    addQuote(q) {
      if (blocked || !db) { notice('error', '当前数据只读，无法新建报价单。'); return false; }
      const date = q.date || dayKey();
      const alloc = allocate('QT', date);
      if (!alloc) return false;
      const built = MODEL.quoteToDocument(q, alloc.no, uid());
      if (!built.ok) { notice('error', '报价单数据有问题：' + built.error + '（未保存）'); return false; }
      const doc = built.doc;
      const ok = transact(d => {
        if (!d.counters.QT) d.counters.QT = {};
        d.counters.QT[alloc.ym] = alloc.seq;             /* 号码占用与数据同一次落盘 */
        d.documents.unshift(doc);
        return true;
      });
      if (!ok) return false;
      q.id = doc.id;                                     /* 回填，调用方仍可按老方式取 id */
      q.no = doc.no;
      return doc.id;
    },
    removeQuote(id) { return transact(d => { d.documents = d.documents.filter(x => x.id !== id); return true; }); },

    /* ---- 沟通记录（D1 只建结构与校验，界面留 D4） ---- */
    // Legacy write alias delegates to D4; never redefine the filtered reader.
    addCommunication(c) {
      return this.saveCommunication(Object.assign({},c,{at:c.at||c.createdAt||new Date().toISOString()}));
    },

    /* ---- 归档（只读） ---- */
    quotesArchive() { return db ? db.quotesArchive : []; },

    /* ---- 打卡 ---- */
    checkins() { return db && db.checkins ? db.checkins : []; },
    addCheckin(k) {
      if (db && db.checkins && db.checkins.includes(k)) return true;
      return transact(d => {
        if (!d.checkins) d.checkins = [];
        if (!d.checkins.includes(k)) d.checkins.push(k);
        return true;
      });
    },

    /* ---- D5 learning: one authoritative JSON store, same rollback semantics ---- */
    learningRecords() {
      if(blocked || !db)throw Error('数据只读或不可用');
      const records=db.settings.learningRecords===undefined?{}:db.settings.learningRecords;
      const valid=MODEL.validateLearningRecords(records);if(!valid.ok)throw Error(valid.errors.join('；'));
      return JSON.parse(JSON.stringify(records));
    },
    learningGet(key) {
      const records=this.learningRecords();return Object.hasOwn(records,key)?records[key]:null;
    },
    learningSet(key,value) {
      let records;try{records=this.learningRecords();}catch(e){notice('error',e.message);return false;}
      if(!['siwang-english-v1','sw-spell-mastered','sw-spell-wrong','sw-custom-words-v1'].includes(key))return false;
      if(value===null)delete records[key];else records[key]=value;
      return this.replaceLearningRecords(records);
    },
    replaceLearningRecords(records) {
      const valid=MODEL.validateLearningRecords(records);
      if(!valid.ok){notice('error','学习记录未保存：'+valid.errors.join('；'));return false;}
      return transact(d=>{d.settings.learningRecords=JSON.parse(JSON.stringify(records));return true;});
    },

    /* ---- 设置 ---- */
    settings() { return (db && db.settings) || {}; },
    saveSettings(s) {
      return transact(d => { d.settings = Object.assign({}, d.settings, s); return true; });
    },

    /* ---- P1-C：新报价默认定价参数（§5.1）----
       设置里可调的只有 feeRate / commissionRate；fx=null、加成率/运费加价率=null（用户输入），
       feeInPrice=1（含费）是任务书定死的新报价默认。历史单据不受影响——这里只服务于 newDraft。 */
    pricingDefaults() {
      const s = (db && db.settings && db.settings.pricingDefaults) || {};
      const rate = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v < hi) ? v : null;
      return {
        feeInPrice: 1,
        fx: null, markupRate: null, targetMargin: null, freightMarkup: null,
        feeRate: rate(s.feeRate, 0, 1) != null ? rate(s.feeRate, 0, 1) : 0.03,
        commissionRate: rate(s.commissionRate, 0, 1.0001) != null ? rate(s.commissionRate, 0, 1.0001) : 0.20
      };
    },
    savePricingDefaults(patch) {
      const clean = {};
      if ('feeRate' in patch) {
        if (!(typeof patch.feeRate === 'number' && isFinite(patch.feeRate) && patch.feeRate >= 0 && patch.feeRate < 1)) {
          notice('error', '销售手续费率须在 [0,100%) 内'); return false;
        }
        clean.feeRate = patch.feeRate;
      }
      if ('commissionRate' in patch) {
        if (!(typeof patch.commissionRate === 'number' && isFinite(patch.commissionRate) && patch.commissionRate >= 0 && patch.commissionRate <= 1)) {
          notice('error', '个人提成率须在 [0,100%] 内'); return false;
        }
        clean.commissionRate = patch.commissionRate;
      }
      return transact(d => {
        d.settings = Object.assign({}, d.settings, {});
        d.settings.pricingDefaults = Object.assign({}, (d.settings && d.settings.pricingDefaults) || {}, clean);
        return true;
      });
    },

    /* ---- 演示数据 ---- */
    hasDemo() {
      if (!db) return false;
      return (db.customers || []).some(c => c.demo) || (db.products || []).some(p => p.demo);
    },
    clearDemo() {
      return transact(d => {
        const used=new Set(d.documents.filter(x=>x.customer).map(x=>x.customer.id).concat(d.communications.map(x=>x.customerId)));
        const protectedCount=d.customers.filter(c=>c.demo && used.has(c.id)).length;
        d.customers=d.customers.filter(c=>!c.demo || used.has(c.id));
        if(protectedCount)notice('info','保留了'+protectedCount+'个有关联单据或沟通记录的演示客户，避免断开历史。');
        d.products = d.products.filter(p => !p.demo);
        return true;
      });
    },

    /* ---- 备份 / 恢复 / 导入导出 ---- */
    exportAll() {
      if (!db) return '';
      return JSON.stringify(db, null, 2);
    },
    paths() { try { return window.SBW.paths(); } catch (e) { return {}; } },
    legacyInfo() { try { return window.SBW.legacyInfo(); } catch (e) { return { exists: false }; } },
    backups() { try { return window.SBW.backups(); } catch (e) { return []; } },
    /*
     * 从备份恢复。
     * 失败时除了把结果返回给界面，还在这里记一条 notice ——
     * 目标不可读这类问题的说明较长（含"这一步没有改动任何文件"等引导），
     * toast 显示不全，需要顶部横幅让用户看到完整原因。
     */
    async restore(file) {
      let r;
      try { r = window.SBW.restore(file); } catch (e) { r = { ok: false, error: (e && e.message) || String(e) }; }
      if (r && r.ok) {
        db = normalize(r.data); notices = []; blocked = false; state = 'ok';
      } else if (r && !r.canceled) {
        notice('error', '恢复未完成：' + (r.error || '未知错误') + (r.code ? '（错误码 ' + r.code + '）' : ''));
      }
      return r;
    },
    /* 第一步：选文件并检查（只读，不改任何数据） */
    async pickImportFile() {
      let r;
      try { r = await window.SBW.importInspect(); } catch (e) { r = { ok: false, error: (e && e.message) || String(e) }; }
      if (r && !r.ok && !r.canceled) {
        notice('error', '导入前的检查未通过：' + (r.error || '未知错误') + (r.code ? '（错误码 ' + r.code + '）' : ''));
      }
      return r;
    },
    /* 第二步：确认后真正导入（主进程先备份当前 v4，再迁移/校验/原子替换） */
    async applyImport(filePath) {
      let r;
      try { r = await window.SBW.importApply(filePath); } catch (e) { r = { ok: false, error: (e && e.message) || String(e) }; }
      if (r && r.ok) {
        db = normalize(r.data); notices = []; blocked = false; state = 'ok';
      } else if (r && !r.canceled) {
        notice('error', '导入未完成：' + (r.error || '未知错误') + (r.code ? '（错误码 ' + r.code + '）' : ''));
      }
      return r;
    },
    resetAll() {
      return transact(d => {
        const fresh = seed();
        Object.keys(fresh).forEach(k => { d[k] = fresh[k]; });
        return true;
      });
    }
  };
})();
