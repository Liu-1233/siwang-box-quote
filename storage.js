/*
 * 丝网盒子 · 数据持久层（主进程）
 *
 * 为什么不继续用 localStorage：
 *   localStorage 底层是 Chromium 的 LevelDB 二进制库，一旦两个进程同时开，
 *   或者写入被中断，它会「静默降级成只存内存」——界面一切正常，关掉程序数据全丢。
 *   用户既看不到自己的数据，也没法手工备份。
 *
 * D1 起改为「版本隔离文件」；D3-B1 起升 v4；P1-B 起升 v5：
 *   data/siwangbox-v5.json        ← 新版(v5)主数据文件，本程序唯一权威
 *   data/siwangbox-v5.json.bak    ← 上一次的 v5 数据（覆盖前的强制快照）
 *   data/backups-v5/              ← v5 每日备份（留最近 30 份；例行冗余，可为 best-effort）
 *   data/siwangbox-v4.json        ← 上一版(v4)数据文件：对 v5 而言是【只读迁移源】，迁移后原样保留
 *   data/siwangbox-v3.json        ← 更旧版(v3)数据文件：同样只读迁移源
 *   data/siwangbox.json           ← 最旧版(v0.2.1, schemaVersion 2)数据文件：同样只读迁移源
 *
 * 为什么要版本隔离而不是原地升级：
 *   已经发出去的旧 exe 里没有任何版本判断，我们没法给它加保护。
 *   唯一能让旧程序不破坏新数据的办法，是让它根本碰不到新版本文件。
 *   代价是两边数据不自动同步；回退运行旧版无需删除/改名新文件，重新升级后仍读原来的文件。
 *
 * ★ D3-B1 版本优先级（Codex 复审第 1 条，改这个文件前务必先读；P1-B 延续到 v5）：
 *   1. 正常启动**先探测 v5 文件族**；v5 存在/曾存在但损坏、不可读或未来版本，
 *      **不能自动降级**读 v4/v3/v2（v5 坏了去读 v4 会把用户最新数据悄悄换旧）。
 *   2. 只有 v5 真正不存在且无痕迹（无主文件、无 .bak、无每日备份）时，
 *      才探测独立的旧源文件：**先 v4 再 v3 再 v2**；旧源不可读/损坏时**停止**，不偷偷换更旧源。
 *   3. v5 主文件里出现旧版内容 ≠ "自动迁移旧源"的正常入口：按异常处理（只读），
 *      或走显式导入，不原地猜升级。
 *
 * ★ D1 修复轮收紧的几条铁律（继续有效）：
 *   1. **写之前先问磁盘**：所有会替换主文件的入口（save / restore / import / migrate）
 *      都必须先检查目标文件当前的真实状态。磁盘 >4 拒写；读不了的目标不许当空库覆盖。
 *   2. **读取失败要分类**：EACCES/EIO 这类是"环境/权限问题"，绝不能当成"文件坏了"
 *      而拿旧备份去覆盖——那会把用户刚写的新数据换掉。只有确认是非法 JSON 或文件缺失，
 *      才允许走恢复，而且必须先成功留证原文件，留证失败就停止覆盖。
 *   3. **写前校验**：JSON.stringify 会把 NaN/Infinity 静默写成 null，
 *      所以序列化之前必须过 model.validateWritable()。持久层不能只指望界面校验。
 *   4. **备份分两类**：覆盖前的 .bak / 迁移前的 pre-v4 / 导入前的 pre-import 是
 *      **强制保护快照**，失败必须停止替换并报错；每日备份是**例行冗余**，
 *      失败只给警告，但不能让内存回滚到与已写磁盘不一致。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const model = require('./app/model.js');

const MAX_BACKUPS = 30;
const SCHEMA_VERSION = model.SCHEMA_VERSION;   /* 5（P1-B） */
const V4_VERSION = model.V4_VERSION;           /* 4 */
const V3_VERSION = model.V3_VERSION;           /* 3 */

/* 读取失败码里属于"环境/权限"一类：这类失败不能触发自动恢复 */
const READ_ENV_CODES = ['EACCES', 'EPERM', 'EIO', 'EBUSY', 'EROFS', 'ELOOP', 'EMFILE', 'ENFILE', 'EISDIR'];

let seqCounter = 0;   /* 同一毫秒内的快照命名序号，避免同秒覆盖前一份 */

function ts(d) {
  const x = d || new Date();
  const p = n => (n < 10 ? '0' + n : String(n));
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()) +
    '_' + p(x.getHours()) + p(x.getMinutes()) + p(x.getSeconds()) + '-' + p(x.getMilliseconds(), 3) + '_' + (++seqCounter);
}
function dayKey(d) {
  const x = d || new Date();
  const p = n => (n < 10 ? '0' + n : String(n));
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
}
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function createStorage(userDataDir) {
  const dataDir = path.join(userDataDir, 'data');
  const file = path.join(dataDir, 'siwangbox-v5.json');
  const bakFile = file + '.bak';
  const backupDir = path.join(dataDir, 'backups-v5');
  const legacyFile = path.join(dataDir, 'siwangbox.json');    /* v2 只读迁移源 */
  const v3File = path.join(dataDir, 'siwangbox-v3.json');     /* v3 只读迁移源 */
  const v4File = path.join(dataDir, 'siwangbox-v4.json');     /* v4 只读迁移源（P1-B） */

  function ensureDirs() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.mkdirSync(backupDir, { recursive: true });
    } catch (e) { /* 目录已存在或无权创建，后续操作会报出来 */ }
  }
  ensureDirs();

  function fail(error, code) { return { ok: false, error: error, code: code || 'ERROR' }; }

  /* ---------- 带错误分类的读取 ---------- */

  /*
   * 读文本并分类失败原因。
   * 返回 {ok:true,text} 或 {ok:false, kind:'missing'|'env'|'other', code, message}
   *   kind='missing'：文件不存在（ENOENT）
   *   kind='env'    ：EACCES/EIO 等环境或权限问题 —— 不代表文件内容坏了
   *   kind='other'  ：其它未知失败，同样不当成"内容坏了"
   */
  function readTextDetailed(p) {
    try {
      return { ok: true, text: fs.readFileSync(p, 'utf8') };
    } catch (e) {
      const code = (e && e.code) || 'UNKNOWN';
      let kind = 'other';
      if (code === 'ENOENT') kind = 'missing';
      else if (READ_ENV_CODES.indexOf(code) >= 0) kind = 'env';
      return { ok: false, kind, code, message: (e && e.message) || String(e) };
    }
  }

  /* 解析 JSON：只用于判断"内容是否合法"，不代表文件可读性 */
  function parseText(text) {
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, kind: 'shape' };
      return { ok: true, data: obj };
    } catch (e) {
      return { ok: false, kind: 'parse', message: e.message };
    }
  }

  /* 便捷读取（用于备份列表等次要场景：读不到就当没有） */
  function readJson(p) {
    const r = readTextDetailed(p);
    if (!r.ok) return null;
    const p2 = parseText(r.text);
    return p2.ok ? p2.data : null;
  }

  /* ---------- 目标状态探测（写入口的前置闸） ---------- */

  /*
   * 探测主文件（v5）当前真实状态。
   *   状态       | 含义
   *   absent     | 文件不存在，可以新建
   *   ok         | 是合法 v5，可以覆盖
   *   future     | 由更新版本创建（>5），必须拒写
   *   legacy     | 是旧格式（v2/v3/v4），不能直接覆盖（v5 路径里出现旧内容按异常处理）
   *   invalid    | 存在但结构/JSON 不合法 —— 只能走显式恢复，普通写入不许碰
   *   unreadable | 读不出来（权限/IO），无法判断内容，一律拒写
   */
  function inspectTarget() {
    if (!fs.existsSync(file)) return { state: 'absent' };
    const r = readTextDetailed(file);
    if (!r.ok) {
      if (r.kind === 'missing') return { state: 'absent' };
      return {
        state: 'unreadable',
        error: '主数据文件读取失败（' + r.code + '）：' + r.message +
          '。无法确认现有内容，已拒绝写入以免覆盖。文件：' + file
      };
    }
    const p = parseText(r.text);
    if (!p.ok) {
      return { state: 'invalid', error: '主数据文件不是合法的 JSON 对象，已拒绝普通写入，请用「从备份恢复」。文件：' + file };
    }
    const v = model.detectVersion(p.data);
    if (v === SCHEMA_VERSION) {
      const val = model.validateV5(p.data);
      if (!val.ok) return { state: 'invalid', error: '主数据文件结构校验未通过：' + val.errors.slice(0, 3).join('；') };
      return { state: 'ok', data: p.data };
    }
    if (v !== null && v > SCHEMA_VERSION) {
      return {
        state: 'future',
        error: '磁盘上的数据文件由更新版本的程序创建（v' + v + '，本程序支持 v' + SCHEMA_VERSION +
          '）。为避免损坏，已拒绝写入。文件：' + file
      };
    }
    return {
      state: 'legacy',
      error: '磁盘上的主文件是旧格式（v' + v + '）——v4 数据文件里不应出现旧版本内容，已拒绝普通写入。' +
        '如确认这是误放的旧文件，可用「从备份文件导入」显式替换。文件：' + file
    };
  }

  /*
   * ★ 所有会替换主文件的入口共用的目标闸。
   *
   * 为什么要有这一层：以前 save 拒绝 future/unreadable/invalid/legacy，
   * 而 restore / 导入只拒绝 future —— 于是"用户显式操作"就能绕过保护，
   * 在**读不出目标内容**（EACCES/EIO）的情况下把主文件覆盖掉。
   * 读不出来 ≠ 内容坏了：可能只是权限问题，文件里还是最新数据。
   * 而且读不出来就**无法确认它是不是更高版本**，更不能覆盖。
   *
   * 规则（mode: 'save' | 'restore' | 'import'）：
   *   unreadable → 所有入口一律拒写（无法确认内容/版本）
   *   future     → 所有入口一律拒写（更高版本的数据不许被旧程序顶掉）
   *   invalid    → 仅普通 save 拒绝；显式 restore / 导入允许（这是"已确认损坏"的救援路径）
   *   legacy     → 仅普通 save 拒绝；显式 restore / 导入允许
   *   absent/ok  → 允许
   */
  const TARGET_BLOCK_CODE = {
    unreadable: 'TARGET_UNREADABLE',
    future: 'FUTURE_TARGET',
    invalid: 'TARGET_INVALID',
    legacy: 'TARGET_LEGACY'
  };

  function guardTargetForWrite(mode) {
    const t = inspectTarget();
    if (t.state === 'unreadable' || t.state === 'future') {
      const code = TARGET_BLOCK_CODE[t.state];
      const hint = t.state === 'unreadable'
        ? '。这一步不会改动任何文件（包括已有备份）。请先恢复文件可读性（检查权限 / 磁盘状态），或把数据复制出来在别处处理。'
        : '。请升级到新版本后再操作。';
      return { ok: false, code, state: t.state, error: t.error + hint };
    }
    if (mode === 'save' && (t.state === 'invalid' || t.state === 'legacy')) {
      return { ok: false, code: TARGET_BLOCK_CODE[t.state], state: t.state, error: t.error };
    }
    return { ok: true, state: t.state };
  }

  /* ---------- 写入原语 ---------- */

  function writeAtomic(target, text) {
    const tmp = target + '.tmp-' + process.pid;
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, text, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, target);
  }

  /*
   * 强制保护快照（审计型）：带毫秒+序号命名，绝不与前一份撞名。
   * 用于迁移前(pre-v3)、导入前(pre-import)、恢复前(corrupt 留证)。
   * 返回 {ok, path} 或 {ok:false, error}
   */
  function snapshotAudit(source, label) {
    if (!fs.existsSync(source)) return { ok: true, path: '' };   /* 没有可保的，不算失败 */
    const target = path.join(dataDir, path.basename(source) + '.' + label + '-' + ts() + '.bak');
    try {
      fs.copyFileSync(source, target);
      return { ok: true, path: target };
    } catch (e) {
      return { ok: false, error: '保存保护快照失败（' + ((e && e.code) || '') + '）：' + ((e && e.message) || e) };
    }
  }

  /*
   * 强制保护快照（滚动型）：固定名 .bak，代表"上一次自动保存"。
   * 每次普通保存前覆盖，失败即中止保存 —— 这是"覆盖前必须留一份"的兑现。
   * （旧版本这里是 best-effort，复制失败也照写；D1 修复轮改为失败即停。）
   */
  function snapshotRolling(source) {
    if (!fs.existsSync(source)) return { ok: true, path: '' };
    try {
      fs.copyFileSync(source, bakFile);
      return { ok: true, path: bakFile };
    } catch (e) {
      return { ok: false, error: '保存「上一次自动保存」快照失败（' + ((e && e.code) || '') + '）：' + ((e && e.message) || e) };
    }
  }

  /* 例行每日备份：尽力而为；失败返回警告，但不影响已成功的主写入 */
  function dailyBackup(text) {
    try {
      const target = path.join(backupDir, 'siwangbox-v5-' + dayKey() + '.json');
      if (fs.existsSync(target)) return { ok: true, path: target, skipped: true };
      writeAtomic(target, text);
      const all = listBackups();
      all.slice(MAX_BACKUPS).forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
      return { ok: true, path: target };
    } catch (e) {
      return { ok: false, error: '每日备份写入失败：' + ((e && e.message) || e) };
    }
  }

  function listBackups() {
    try {
      return fs.readdirSync(backupDir)
        .filter(f => /^siwangbox-v5-.*\.json$/.test(f))
        .sort()
        .reverse()
        .map(f => path.join(backupDir, f));
    } catch (e) { return []; }
  }

  /*
   * 一次完整提交：目标闸 → 强制快照 → 原子写主文件 → 例行每日备份。
   * 只有在前三步都成功时才返回 ok。每日备份失败只带 warning。
   *
   * ★ 目标闸放在这里作为**最终防线**：save / restore / import 都经这个函数落盘，
   *   所以规则只有一处，不会出现"某个入口忘了检查"。
   *
   * opts.mode    'save' | 'restore' | 'import'（决定 invalid/legacy 是否放行）
   * opts.rolling=true  → 快照写进固定的 .bak（"上一次自动保存"，给界面恢复用）
   * opts.rolling=false → 快照写成 <名字>.<label>-<时间戳>.bak（审计留档，不撞名）
   */
  function commit(text, data, opts) {
    opts = opts || {};
    const mode = opts.mode || 'save';

    const g = guardTargetForWrite(mode);
    if (!g.ok) return fail(g.error, g.code);

    const snap = opts.rolling
      ? snapshotRolling(file)
      : snapshotAudit(file, opts.label || 'pre-write');
    if (!snap.ok) {
      return fail('已取消写入：' + snap.error + '。原文件未被改动。', 'SNAPSHOT_FAIL');
    }
    try {
      writeAtomic(file, text);
    } catch (e) {
      return fail('写入主数据文件失败：' + ((e && e.message) || e) + '。原文件未被替换。', 'WRITE_FAIL');
    }
    const bk = dailyBackup(text);
    const res = { ok: true, data, snapshot: snap.path, snapshotKind: opts.rolling ? 'rolling' : 'audit' };
    if (!bk.ok) res.warning = bk.error + '（主数据已保存成功，但这次没有留下每日备份，请尽快手动导出一份）';
    return res;
  }

  /* ---------- 恢复 ---------- */

  /*
   * 从 v4 自己的备份恢复。只用于"确认内容不合法 / 主文件缺失"两种情形。
   * 关键：必须先成功留证原文件；留证失败就停止覆盖。
   */
  function recoverFromBackup(reason) {
    const candidates = [bakFile].concat(listBackups());
    let sawUsable = false;
    for (const c of candidates) {
      const d = readJson(c);
      if (!d) continue;
      if (model.detectVersion(d) !== SCHEMA_VERSION) continue;
      if (!model.validateV5(d).ok) continue;
      sawUsable = true;

      /* 先留证（复制）——失败则停止，绝不继续覆盖 */
      let kept = '';
      if (fs.existsSync(file)) {
        const snap = snapshotAudit(file, 'corrupt');
        if (!snap.ok) {
          return {
            ok: false, data: null, status: 'corrupt',
            message: '主数据文件' + reason + '，找到可用备份（' + path.basename(c) + '），但保留原文件失败：' +
              snap.error + '。为避免丢失现场，已停止恢复，原文件与备份均保持原样。'
          };
        }
        kept = snap.path;
      }

      const text = JSON.stringify(d, null, 2);
      try {
        writeAtomic(file, text);
      } catch (e) {
        return {
          ok: false, data: null, status: 'corrupt',
          message: '找到可用备份（' + path.basename(c) + '），但写回主文件失败：' + ((e && e.message) || e) +
            '。数据没有被替换，原文件' + (kept ? '已留证于 ' + path.basename(kept) + '，' : '和备份') + '均保留。'
        };
      }
      const bk = dailyBackup(text);
      return {
        ok: true, data: d, status: 'recovered',
        message: '主数据文件' + reason + '，已从备份（' + path.basename(c) + '）恢复。' +
          (kept ? '原文件已留证为 ' + path.basename(kept) + '。' : '') +
          (bk.ok ? '' : '（注意：' + bk.error + '）')
      };
    }

    return {
      ok: false, data: null, status: 'corrupt',
      message: '数据文件已损坏且没有可用备份' + (sawUsable ? '（备份存在但无法完成恢复）' : '') +
        '。程序不会自动重建、也不会改用旧数据。文件已原样保留在：' + file +
        '。请不要在这里录入新数据，先联系处理。'
    };
  }

  /*
   * 旧源探测（v4 优先、v3 次之、v2 最后；不可读/损坏即停止，不偷偷换更旧源 —— 复审第 1 条）。
   * 完整模式返回 load 形状的响应（needsMigration 时附带 data/text/sha 供 migrate 复用，
   * 避免二次读文件）；infoOnly 模式只返回 { info } 供设置页展示。
   */
  function probeLegacySource(sourcePath, label, infoOnly) {
    if (!fs.existsSync(sourcePath)) return null;
    const r = readTextDetailed(sourcePath);
    if (!r.ok) {
      if (infoOnly) return { info: { exists: true, readable: false, errorKind: r.kind, errorCode: r.code, error: r.message } };
      return {
        ok: false, data: null, status: 'legacyUnreadable',
        message: '检测到旧版（' + label + '）数据文件，但读取失败（' + r.code + '）：' + r.message +
          '。程序不会换用更旧的数据文件，也不会初始化空库，已进入只读状态。请先恢复文件可读性。文件：' + sourcePath
      };
    }
    const p = parseText(r.text);
    if (!p.ok) {
      if (infoOnly) return { info: { exists: true, readable: true, parseOk: false, sha256: sha256(r.text), errorKind: p.kind } };
      return {
        ok: false, data: null, status: 'legacyCorrupt',
        message: '检测到旧版（' + label + '）数据文件，但内容不是合法 JSON。程序不会换用更旧的数据文件，' +
          '也不会初始化空库，已进入只读状态。文件已原样保留在：' + sourcePath
      };
    }
    const obj = p.data;
    const v = model.detectVersion(obj);
    const isV4 = v === V4_VERSION;
    const isV3 = v === V3_VERSION;
    const val = isV4 ? model.validateV4(obj) : isV3 ? model.validateV3(obj) : model.validateV2(obj);
    const counts = {
      customers: Array.isArray(obj.customers) ? obj.customers.length : 0,
      products: Array.isArray(obj.products) ? obj.products.length : 0,
      documents: (isV4 || isV3)
        ? (Array.isArray(obj.documents) ? obj.documents.length : 0)
        : (Array.isArray(obj.quotes) ? obj.quotes.length : 0),
      quotesArchived: (isV4 || isV3) ? (Array.isArray(obj.quotesArchive) ? obj.quotesArchive.length : 0) : 0,
      checkins: Array.isArray(obj.checkins) ? obj.checkins.length : 0
    };
    if (infoOnly) {
      return {
        info: {
          exists: true, readable: true, parseOk: true, sha256: sha256(r.text),
          bytes: Buffer.byteLength(r.text, 'utf8'), version: v, valid: val.ok, errors: val.errors, counts: counts
        }
      };
    }
    if (v !== null && v > SCHEMA_VERSION) {
      return {
        ok: false, data: null, status: 'unsupported',
        message: '旧版（' + label + '）数据文件由更新版本创建（v' + v + '），拒绝处理。文件：' + sourcePath
      };
    }
    if (!val.ok) {
      return {
        ok: false, data: null, status: 'legacyCorrupt',
        message: '检测到旧版（' + label + '）数据文件，但结构无法识别（' + val.errors.slice(0, 3).join('；') +
          '）。程序不会换用更旧的数据文件，已进入只读状态。文件：' + sourcePath
      };
    }
    return {
      ok: true, data: null, status: 'needsMigration',
      message: '检测到旧版（' + label + '）数据文件，需要先迁移到新版数据文件。',
      sourceVersion: v, sourceFile: sourcePath, sourcePath: sourcePath,
      /* 以下附带给 migrate() 复用，避免二次读取 */
      data: obj, text: r.text, sha: sha256(r.text)
    };
  }

  const api = {
    paths() {
      return { dataDir, file, backupDir, bakFile, legacyFile, v3File, v4File };
    },

    /*
     * 读取数据（v5 优先，Codex 复审第 1 条延续）。
     * status:
     *   'ok'              v5 正常，校验通过
     *   'recovered'       主文件内容非法/缺失，已用 v5 备份救回
     *   'needsMigration'  v5 无任何痕迹，存在旧版数据文件（v4/v3/v2），等待迁移
     *   'empty'           完全没有任何历史数据，可以初始化新库
     *   'unreadable'      v5 主文件读不出来（权限/IO）—— 只读，不自动恢复、不降级
     *   'unsupported'     v5 主文件由更新版本创建（>5）—— 只读，不降级
     *   'invalid'         v5 主文件存在但结构与版本不符（含 v5 路径里放着旧版本内容）
     *   'corrupt'         内容损坏且无可用备份（或留证/写回失败）
     *   'legacyUnreadable' 旧源（v4/v3/v2）读不出来 —— 停止，不换更旧源
     *   'legacyCorrupt'    旧源内容损坏 —— 停止，不换更旧源
     */
    load() {
      ensureDirs();

      /* ===== 第一优先：v5 文件族 ===== */
      if (fs.existsSync(file)) {
        const r = readTextDetailed(file);

        /* ① 读不出来：区分环境错误与内容损坏；不降级读旧源 */
        if (!r.ok) {
          if (r.kind === 'missing') return recoverFromBackup('缺失');
          return {
            ok: false, data: null, status: 'unreadable',
            message: '数据文件读取失败（' + r.code + '）：' + r.message +
              '。这通常是权限或磁盘问题，不代表文件内容坏了，所以程序不会用备份去覆盖它，也不会改用旧版数据。' +
              '请检查文件权限 / 磁盘状态后重试，或从备份显式恢复。文件：' + file
          };
        }

        /* ② 内容解析与版本判定 */
        const p = parseText(r.text);
        if (!p.ok) return recoverFromBackup('内容不是合法 JSON');

        const v = model.detectVersion(p.data);
        if (v === SCHEMA_VERSION) {
          const val = model.validateV5(p.data);
          if (val.ok) return { ok: true, data: p.data, status: 'ok' };
          return {
            ok: false, data: null, status: 'invalid',
            message: '数据文件结构校验未通过：' + val.errors.slice(0, 3).join('；') +
              '。为避免进一步损坏，程序不会写入这个文件，也不会改用旧数据。文件：' + file
          };
        }
        if (v !== null && v > SCHEMA_VERSION) {
          return {
            ok: false, data: null, status: 'unsupported',
            message: '数据文件由更新版本的程序创建（数据版本 v' + v + '，本程序支持 v' + SCHEMA_VERSION +
              '）。为避免损坏，本程序拒绝读写它，也不会自动降级去读旧版数据。请升级到新版本后再使用。文件：' + file
          };
        }
        /* v5 主文件里出现旧版本内容：不是"自动迁移旧源"的正常入口，按异常只读处理 */
        return {
          ok: false, data: null, status: 'invalid',
          message: '数据文件版本异常（v' + v + '）——这是新版数据文件（siwangbox-v5.json）的位置，' +
            '不应出现旧版本内容。程序不会把它当成迁移源自动升级（避免原地猜升级），也不会改用其它文件。' +
            '如确认这是误放的旧数据，请用「从备份文件导入」显式处理。文件：' + file
        };
      }

      /* ===== v5 主文件不存在：有 v5 痕迹就说明曾经是 v5，绝不回头读旧文件 ===== */
      const hasV5Trace = fs.existsSync(bakFile) || listBackups().length > 0;
      if (hasV5Trace) return recoverFromBackup('缺失');

      /* ===== v5 真正不存在且无痕迹：才探测独立旧源，先 v4 再 v3 再 v2 ===== */
      const legacyProbe = probeLegacySource(v4File, 'v4') || probeLegacySource(v3File, 'v3') || probeLegacySource(legacyFile, 'v2');
      if (legacyProbe) return legacyProbe;

      return { ok: true, data: null, status: 'empty' };
    },

    /* 旧数据文件探针（迁移前检查与报告用，不修改任何东西）。
       优先 v4；v4 不存在时才看 v3、v2。各处存在性信息供设置页展示。 */
    legacyInfo() {
      const out = { exists: false, v4: { exists: false }, v3: { exists: false }, v2: { exists: false } };
      const p4 = probeLegacySource(v4File, 'v4', true);
      const p3 = probeLegacySource(v3File, 'v3', true);
      const p2 = probeLegacySource(legacyFile, 'v2', true);
      out.v4 = p4 ? p4.info : { exists: false };
      out.v3 = p3 ? p3.info : { exists: false };
      out.v2 = p2 ? p2.info : { exists: false };
      /* 兼容旧字段：优先展示"最近的旧版数据文件"（v4 → v3 → v2） */
      out.exists = out.v4.exists || out.v3.exists || out.v2.exists;
      out.file = out.v4.exists ? v4File : (out.v3.exists ? v3File : (out.v2.exists ? legacyFile : ''));
      if (out.v4.readable && out.v4.parseOk) Object.assign(out, out.v4);
      else if (out.v3.readable && out.v3.parseOk) Object.assign(out, out.v3);
      else if (out.v2.readable && out.v2.parseOk) Object.assign(out, out.v2);
      return out;
    },

    /*
     * 迁移：旧源（v4 优先，其次 v3、v2）→ v5 文件。
     * 顺序固定：探源 → 读 → 校验 → 原样备份旧源(记录 SHA-256) → 构造 v5（纯函数链）
     *          → 校验 → 一次性原子落盘（数据 + counters + 来源哈希 + 迁移标记同一份对象）。
     * v3 源走 v3→v4（内存）→ v5（内存）链；v2 源走 v2→v3→v4→v5 链；
     * 只一次提交 v5，**不回写旧源**。任何一步失败都在写盘之前返回，旧文件绝不改动。
     */
    migrate() {
      ensureDirs();
      if (fs.existsSync(file)) {
        const t = inspectTarget();
        return fail('已存在 v5 数据文件（当前状态：' + t.state + '），不再重复迁移。' + (t.error ? ' ' + t.error : ''), 'ALREADY_V5');
      }

      /* 选源：先 v4 再 v3 再 v2；旧源不可读/损坏在这里就返回（不换更旧源） */
      const probe = probeLegacySource(v4File, 'v4') || probeLegacySource(v3File, 'v3') || probeLegacySource(legacyFile, 'v2');
      if (!probe) return fail('没有找到可迁移的旧数据文件。', 'NO_LEGACY');
      if (probe.status !== 'needsMigration') return probe;   /* 已是错误响应 */

      const sourcePath = probe.sourcePath;
      const sourceSha = probe.sha;
      const src = probe.data;
      const vv = probe.sourceVersion;
      const doneAt = new Date().toISOString();

      /* 1) 强制：原样备份旧源（失败则停止迁移） */
      const snap = snapshotAudit(sourcePath, 'pre-v5');
      if (!snap.ok) {
        return fail('迁移前备份旧数据失败：' + snap.error + '。已停止迁移，原文件未改动。', 'PREBACKUP_FAIL');
      }

      /* 2) 构造 v5（纯函数链，不写盘）；中间版本只存在于内存 */
      let v5 = null;
      let report = null;
      let chainNote = '';
      if (vv === V4_VERSION) {
        const m = model.migrateV4toV5(src, {
          sourceFile: path.basename(sourcePath),
          sourceSha256: sourceSha,
          doneAt: doneAt
        });
        if (!m.ok) return fail(m.error + '（旧文件已原样备份，未写入任何数据）', 'MIGRATE_FAIL');
        v5 = m.data;
        report = m.report;
      } else if (vv === V3_VERSION) {
        const m4 = model.migrateV3toV4(src, {
          sourceFile: path.basename(sourcePath),
          sourceSha256: sourceSha,
          doneAt: doneAt
        });
        if (!m4.ok) return fail(m4.error + '（旧文件已原样备份，未写入任何数据）', 'MIGRATE_FAIL');
        const m = model.migrateV4toV5(m4.data, {
          sourceFile: path.basename(sourcePath),
          sourceSha256: sourceSha,
          doneAt: doneAt
        });
        if (!m.ok) return fail(m.error + '（旧文件已原样备份，未写入任何数据）', 'MIGRATE_FAIL');
        v5 = m.data;
        report = m.report;
        chainNote = '（v3 旧数据经内存迁移链 v3→v4→v5 转换，未写入任何中间文件）';
        report.v3toV4 = {
          addedDefaults: m4.report.addedDefaults,
          keptExisting: m4.report.keptExisting,
          unknownTopKeys: m4.report.unknownTopKeys,
          legacySectionKeys: m4.report.legacySectionKeys,
          noIssues: m4.report.noIssues
        };
      } else {
        /* v2 链：内存里 v2→v3→v4→v5，只一次提交 v5 */
        const m1 = model.migrateV2toV3(src, {
          sourceFile: path.basename(sourcePath),
          sourceSha256: sourceSha,
          doneAt: doneAt
        });
        if (!m1.ok) return fail(m1.error + '（旧文件已原样备份，未写入任何数据）', 'MIGRATE_FAIL');
        const m4 = model.migrateV3toV4(m1.data, {
          sourceFile: path.basename(sourcePath),
          sourceSha256: sourceSha,
          doneAt: doneAt
        });
        if (!m4.ok) return fail(m4.error + '（旧文件已原样备份，未写入任何数据）', 'MIGRATE_FAIL');
        const m = model.migrateV4toV5(m4.data, {
          sourceFile: path.basename(sourcePath),
          sourceSha256: sourceSha,
          doneAt: doneAt
        });
        if (!m.ok) return fail(m.error + '（旧文件已原样备份，未写入任何数据）', 'MIGRATE_FAIL');
        v5 = m.data;
        report = m.report;
        chainNote = '（v2 旧数据经内存迁移链 v2→v3→v4→v5 转换，未写入任何中间文件）';
        report.v2toV3 = {
          unknownTopKeys: m1.report.unknownTopKeys,
          legacySectionKeys: m1.report.legacySectionKeys,
          duplicates: m1.report.duplicates,
          anomalies: m1.report.anomalies,
          legacyFormat: m1.report.legacyFormat,
          totalsDifferFromItems: m1.report.totalsDifferFromItems,
          missingNumericFields: m1.report.missingNumericFields,
          idIssues: m1.report.idIssues
        };
        report.v3toV4 = {
          addedDefaults: m4.report.addedDefaults,
          keptExisting: m4.report.keptExisting,
          unknownTopKeys: m4.report.unknownTopKeys,
          legacySectionKeys: m4.report.legacySectionKeys,
          noIssues: m4.report.noIssues
        };
      }

      const val5 = model.validateV5(v5);
      if (!val5.ok) return fail('迁移结果未通过 v5 结构校验：' + val5.errors.join('；') + '。未写入任何文件，旧文件未改动。', 'MIGRATE_INVALID');
      const valW = model.validateWritable(v5);
      if (!valW.ok) return fail('迁移结果未通过写入校验：' + valW.errors.slice(0, 5).join('；') + '。未写入任何文件，旧文件未改动。', 'MIGRATE_INVALID');

      /* 3) 一次性原子落盘（数据 + counters + migration 标记同一份对象） */
      const text = JSON.stringify(v5, null, 2);
      try {
        writeAtomic(file, text);
      } catch (e) {
        return fail('写入新版数据文件失败：' + ((e && e.message) || e) + '。迁移未完成，旧文件未改动，内存不会切换。', 'WRITE_FAIL');
      }
      const bk = dailyBackup(text);

      const res = {
        ok: true,
        data: v5,
        report: {
          sourceVersion: vv,
          sourceFile: path.basename(sourcePath),
          sourceSha256: sourceSha,
          backupPath: snap.path,
          chainNote: chainNote,
          counts: report.counts,
          addedDefaults: report.addedDefaults,
          keptExisting: report.keptExisting,
          unknownTopKeys: report.unknownTopKeys,
          legacySectionKeys: report.legacySectionKeys,
          duplicates: report.noIssues ? report.noIssues.duplicates : [],
          anomalies: report.noIssues ? report.noIssues.anomalies : [],
          legacyFormat: report.noIssues ? report.noIssues.legacyFormat : [],
          totalsDifferFromItems: report.v2toV3 ? report.v2toV3.totalsDifferFromItems : 0,
          missingNumericFields: report.v2toV3 ? report.v2toV3.missingNumericFields : [],
          idIssues: report.v2toV3 ? report.v2toV3.idIssues : [],
          v2toV3: report.v2toV3 || null,
          v3toV4: report.v3toV4 || null
        }
      };
      if (!bk.ok) res.warning = bk.error + '（主数据已迁移成功，但这次没有留下每日备份）';
      return res;
    },

    /*
     * 保存 v5 数据。
     * 两道闸：① 对象本身必须是合格 v5（写前校验，拦住 NaN/Infinity/非法 counters/非法定价参数）
     *         ② commit 内部的目标闸 + 强制快照（磁盘 >5 拒写、读不了拒写、旧格式拒写）
     */
    save(data) {
      ensureDirs();

      /* ① 写前校验 */
      const valW = model.validateWritable(data);
      if (!valW.ok) {
        return fail('数据校验未通过，已拒绝写入：' + valW.errors.slice(0, 5).join('；'), 'INVALID_WRITE');
      }

      /* ② 提交（commit 内部的最终防线会做目标状态检查 + 强制快照） */
      const text = JSON.stringify(data, null, 2);
      return commit(text, data, { rolling: true, mode: 'save' });
    },

    /* 列出可用备份，给「从备份恢复」用（v5 文件族；v4 旧备份走「导入」迁移通道） */
    backups() {
      ensureDirs();
      const out = [];
      if (fs.existsSync(bakFile)) {
        const d = readJson(bakFile);
        if (d && model.detectVersion(d) === SCHEMA_VERSION) {
          out.push({
            name: '上一次自动保存', file: bakFile,
            customers: (d.customers || []).length,
            documents: (d.documents || []).length,
            quotes: (d.quotesArchive || []).length
          });
        }
      }
      listBackups().forEach(f => {
        const d = readJson(f);
        if (d && model.detectVersion(d) === SCHEMA_VERSION) {
          out.push({
            name: path.basename(f).replace(/^siwangbox-v5-|\.json$/g, ''), file: f,
            customers: (d.customers || []).length,
            documents: (d.documents || []).length,
            quotes: (d.quotesArchive || []).length
          });
        }
      });
      return out;
    },

    /*
     * 从指定备份恢复（只接受 v5 备份）。
     * 与其他写入口一致地做目标状态闸：磁盘是未来版本时，不允许用旧备份把它顶掉。
     */
    restore(fromFile) {
      const r = readTextDetailed(fromFile);
      if (!r.ok) return fail('这个备份文件读取失败（' + r.code + '）：' + r.message, 'BACKUP_UNREADABLE');
      const p = parseText(r.text);
      if (!p.ok) return fail('这个备份文件不是合法 JSON。', 'BACKUP_UNREADABLE');
      const d = p.data;

      const v = model.detectVersion(d);
      if (v !== null && v > SCHEMA_VERSION) {
        return fail('该备份由更新版本创建（v' + v + '），拒绝恢复。', 'FUTURE_SCHEMA');
      }
      if (v !== SCHEMA_VERSION) {
        return fail('该备份不是 v5 数据（v' + v + '），不能直接恢复；请用「从备份文件导入」走迁移流程。', 'NEEDS_MIGRATION');
      }
      const val = model.validateV5(d);
      if (!val.ok) return fail('备份内容校验未通过：' + val.errors.slice(0, 3).join('；'), 'INVALID');
      const valW = model.validateWritable(d);
      if (!valW.ok) return fail('备份内容未通过写入校验：' + valW.errors.slice(0, 5).join('；'), 'INVALID');

      /* unreadable / future 一律拒写；已确认损坏的允许显式恢复 —— 由 commit 统一把关 */
      const text = JSON.stringify(d, null, 2);
      return commit(text, d, { rolling: true, mode: 'restore' });
    },

    /* 导入前的检查：只看不写，供界面提示"将替换什么"。v5 直接导入；v4/v3/v2 导入时迁移 */
    inspectText(text) {
      const p = parseText(text);
      if (!p.ok) return fail(p.kind === 'parse' ? '不是合法的 JSON 文件。' : '文件内容不是一个数据对象。', 'PARSE');
      const obj = p.data;
      const v = model.detectVersion(obj);
      if (v === null) return fail('无法识别的数据版本（既没有 schemaVersion，也没有 customers）。', 'UNKNOWN_VERSION');
      if (v > SCHEMA_VERSION) return fail('该文件由更新版本创建（v' + v + '），拒绝导入。', 'FUTURE_SCHEMA');

      let needsMigration = false;
      let kind = 'v5';
      if (v === SCHEMA_VERSION) {
        const val = model.validateV5(obj);
        if (!val.ok) return fail('v5 文件结构校验未通过：' + val.errors.slice(0, 3).join('；'), 'INVALID');
        const valW = model.validateWritable(obj);
        if (!valW.ok) return fail('v5 文件未通过写入校验：' + valW.errors.slice(0, 5).join('；'), 'INVALID');
      } else if (v === V4_VERSION) {
        const val = model.validateV4(obj);
        if (!val.ok) return fail('v4 文件结构校验未通过：' + val.errors.slice(0, 3).join('；'), 'INVALID');
        needsMigration = true;
        kind = 'v4（导入时迁移到 v5）';
      } else if (v === V3_VERSION) {
        const val = model.validateV3(obj);
        if (!val.ok) return fail('v3 文件结构校验未通过：' + val.errors.slice(0, 3).join('；'), 'INVALID');
        needsMigration = true;
        kind = 'v3（导入时迁移到 v5）';
      } else {
        const val = model.validateV2(obj);
        if (!val.ok) return fail('旧格式文件校验未通过：' + val.errors.join('；'), 'INVALID');
        needsMigration = true;
        kind = 'v2 旧格式（导入时经迁移链到 v5）';
      }

      /* 目标状态必须提前告警：unreadable / future 一律不可导入；
         已确认损坏（invalid）与旧格式（legacy）允许由显式导入替换。 */
      const g = guardTargetForWrite('import');
      if (!g.ok) return fail(g.error, g.code);

      return {
        ok: true,
        version: v,
        needsMigration: needsMigration,
        targetState: g.state,
        counts: {
          customers: (obj.customers || []).length,
          products: (obj.products || []).length,
          documents: (v === V3_VERSION || v === V4_VERSION)
            ? (Array.isArray(obj.documents) ? obj.documents.length : 0)
            : (Array.isArray(obj.documents) ? obj.documents.length : (Array.isArray(obj.quotes) ? obj.quotes.length : 0)),
          kind: kind
        }
      };
    },

    /*
     * 导入（原子替换 v5 主文件）。
     * 与普通保存的区别：这是用户显式发起的"整个换库"操作，因此
     *   ① 允许替换一个"内容不合法"的主文件（普通 save 不允许）；
     *   ② 但必须先成功留下 pre-import 快照，快照失败即取消；
     *   ③ 未来版本目标依然拒绝。
     * v4/v3/v2 文件：先迁移到 v5（纯函数链）再提交，只一次落盘。
     */
    importText(text) {
      const ins = api.inspectText(text);
      if (!ins.ok) return ins;

      let v5;
      if (ins.version === SCHEMA_VERSION) {
        v5 = parseText(text).data;
      } else {
        const src = parseText(text).data;
        const doneAt = new Date().toISOString();
        let m = null;
        if (ins.version === V4_VERSION) {
          m = model.migrateV4toV5(src, { sourceFile: '(import)', sourceSha256: sha256(text), doneAt: doneAt });
        } else if (ins.version === V3_VERSION) {
          const m4 = model.migrateV3toV4(src, { sourceFile: '(import)', sourceSha256: sha256(text), doneAt: doneAt });
          if (!m4.ok) return fail(m4.error + '（未导入任何数据，当前数据未改动）', 'MIGRATE_FAIL');
          m = model.migrateV4toV5(m4.data, { sourceFile: '(import)', sourceSha256: sha256(text), doneAt: doneAt });
        } else {
          const m1 = model.migrateV2toV3(src, { sourceFile: '(import)', sourceSha256: sha256(text), doneAt: doneAt });
          if (!m1.ok) return fail(m1.error + '（未导入任何数据，当前数据未改动）', 'MIGRATE_FAIL');
          const m4 = model.migrateV3toV4(m1.data, { sourceFile: '(import)', sourceSha256: sha256(text), doneAt: doneAt });
          if (!m4.ok) return fail(m4.error + '（未导入任何数据，当前数据未改动）', 'MIGRATE_FAIL');
          m = model.migrateV4toV5(m4.data, { sourceFile: '(import)', sourceSha256: sha256(text), doneAt: doneAt });
        }
        if (!m.ok) return fail(m.error + '（未导入任何数据，当前数据未改动）', 'MIGRATE_FAIL');
        const vw = model.validateWritable(m.data);
        if (!vw.ok) return fail('迁移结果未通过写入校验：' + vw.errors.slice(0, 5).join('；') + '（未导入）', 'MIGRATE_INVALID');
        v5 = m.data;
      }

      const text5 = JSON.stringify(v5, null, 2);
      /* commit 内部做目标闸 + 强制快照（pre-import），失败即返回 */
      const r = commit(text5, v5, { label: 'pre-import', mode: 'import' });
      if (!r.ok) return r;
      const out = { ok: true, data: v5, migrated: ins.needsMigration, snapshot: r.snapshot };
      if (r.warning) out.warning = r.warning;
      return out;
    },

    /*
     * 受控权威读取（B3 受控 PDF 用）：从磁盘读已保存单据快照。
     * 与 load() 的区别：**不触发任何恢复/写入副作用**——读不出来就如实返回失败，
     * 绝不拿备份覆盖主文件、绝不降级读旧源。只读，不改任何文件。
     */
    readSavedDocument(id) {
      if (!id || typeof id !== 'string') return { ok: false, error: '缺少单据 ID' };
      const r = readTextDetailed(file);
      if (!r.ok) {
        return { ok: false, error: '数据文件读取失败（' + r.code + '）：' + r.message, code: r.code };
      }
      const p = parseText(r.text);
      if (!p.ok) return { ok: false, error: '数据文件不是合法 JSON' };
      const v = model.detectVersion(p.data);
      if (v !== SCHEMA_VERSION) return { ok: false, error: '数据文件版本不是 v' + SCHEMA_VERSION + '（实际 v' + v + '）' };
      if (!model.validateV5(p.data).ok) return { ok: false, error: '数据文件结构校验未通过' };
      const docs = Array.isArray(p.data.documents) ? p.data.documents : [];
      const d = docs.find(x => x && x.id === id);
      if (!d) return { ok: false, error: '单据不存在（可能已删除）', code: 'NOT_FOUND' };
      return { ok: true, document: JSON.parse(JSON.stringify(d)) };
    },

    /* 读文件并导入（主进程用） */
    importFile(filePath) {
      const r = readTextDetailed(filePath);
      if (!r.ok) return fail('读取文件失败（' + r.code + '）：' + r.message, 'READ');
      return api.importText(r.text);
    },

    /* 读文件并只做检查（界面确认用） */
    inspectFile(filePath) {
      const r = readTextDetailed(filePath);
      if (!r.ok) return fail('读取文件失败（' + r.code + '）：' + r.message, 'READ');
      const res = api.inspectText(r.text);
      if (res.ok) res.filePath = filePath;
      return res;
    },

    /* 供测试与排障：当前目标状态（只读） */
    targetState() { try { return inspectTarget().state; } catch (e) { return 'error'; } }
  };

  return api;
}

module.exports = { createStorage, SCHEMA_VERSION, READ_ENV_CODES };
