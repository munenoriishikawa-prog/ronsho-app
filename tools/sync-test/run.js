#!/usr/bin/env node
// 同期ロジック(drive-sync.js)と重複チェック(js/duplicate-check.js)の自動テスト。
// アプリの実ファイルをそのまま Node の vm に読み込み、localStorage / fetch(GAS) を
// スタブに差し替えて検証する。実行: node tools/sync-test/run.js
// 環境変数 RONSHO_CLOUD_JSON にクラウドデータ(JSONファイル)のパスを渡すと、
// 実データを使った追加試験も実行する(実データはリポジトリにコミットしないこと)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const driveSyncCode = fs.readFileSync(path.join(ROOT, 'drive-sync.js'), 'utf8');
const dupCheckCode = fs.readFileSync(path.join(ROOT, 'js', 'duplicate-check.js'), 'utf8');

const deepCopy = x => JSON.parse(JSON.stringify(x));
let failures = 0;
function check(label, cond, detail) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + label + (detail != null ? ' — ' + detail : ''));
  if (!cond) failures++;
}

// ---- スタブ ----
function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => { m.clear(); }
  };
}

// GAS(コード.gs)の doGet / doPost を忠実に再現したモック
function makeMockGas(initial) {
  const gas = {
    store: initial ? deepCopy(initial) : { revision: 0, updatedAt: '2026-08-25T00:00:00.000Z', data: {} },
    failNextPost: 0,
    conflictWithoutLatestOnce: false
  };
  gas.fetchImpl = async (url, opts) => {
    if (!opts || opts.method !== 'POST') {
      return { ok: true, json: async () => deepCopy(gas.store) };
    }
    if (gas.failNextPost > 0) { gas.failNextPost--; return { ok: false, json: async () => ({}) }; }
    const req = JSON.parse(opts.body);
    if (gas.conflictWithoutLatestOnce) {
      gas.conflictWithoutLatestOnce = false;
      return { ok: true, json: async () => ({ ok: false, reason: 'conflict' }) };
    }
    if (req.revision !== gas.store.revision) {
      return { ok: true, json: async () => ({ ok: false, reason: 'conflict', latest: deepCopy(gas.store) }) };
    }
    gas.store = { revision: gas.store.revision + 1, updatedAt: '2026-08-25T00:00:00.000Z', data: deepCopy(req.data) };
    return { ok: true, json: async () => ({ ok: true, result: deepCopy(gas.store) }) };
  };
  return gas;
}

// drive-sync.js を1つの「端末」として読み込む
function loadDevice(gas) {
  const storage = makeStorage();
  const sandbox = {
    console,
    localStorage: storage,
    window: { addEventListener: () => {} },
    document: { getElementById: () => null, addEventListener: () => {}, visibilityState: 'hidden' },
    fetch: gas ? gas.fetchImpl : (async () => { throw new Error('fetch未設定'); }),
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => {}
  };
  vm.createContext(sandbox);
  vm.runInContext(driveSyncCode, sandbox, { filename: 'drive-sync.js' });
  const api = sandbox.window.__ronshoSyncTest;
  const setLocal = (key, value) => storage.setItem(key, JSON.stringify(value));
  const getLocal = (key, dflt) => { const v = storage.getItem(key); return v == null ? dflt : JSON.parse(v); };
  return { api, storage, setLocal, getLocal };
}

const K = {
  entries: 'ronshoEntries',
  studyLog: 'ronshoStudyLog',
  dupArchive: 'ronshoDupArchiveV1',
  revision: 'ronshoSyncRevisionV1'
};

const tombKeyOf = e => [e && e.title, e && e.body].join('|');
const archiveKeyOf = x => tombKeyOf(x && x.entry);
const timeOf = s => { const t = Date.parse(s || ''); return isNaN(t) ? 0 : t; };
const isActive = x => timeOf(x && x.deletedAt) > timeOf(x && x.revokedAt);

// ---- 合成フィクスチャ ----
// 時系列: 8/1 取込み → 8/23 誤削除(完全一致ペアの片方削除で87件相当を2件に縮約) → 8/25 掃除+再取込み
const T_IMPORT0 = '2026-08-01T00:00:00.000Z';
const T_DELETE = '2026-08-23T01:30:00.000Z';
const T_REVOKE = '2026-08-25T13:00:00.000Z';
const T_REIMPORT = '2026-08-25T14:00:00.000Z';

const mkEntry = (title, body, subject, importedAt) => {
  const e = { title, body, subject };
  if (importedAt) e.importedAt = importedAt;
  return e;
};

function makeSyntheticCloud() {
  // 生きている論証
  const alive = [
    mkEntry('民法A', '本文A', '民法', T_IMPORT0),
    mkEntry('民法B', '本文B', '民法', T_IMPORT0),
    mkEntry('民訴・生存1', '本文S1', '民事訴訟法', T_IMPORT0)
  ];
  // 誤削除された民訴論証(完全一致ペアの片方削除の巻き添えで現存しない)
  const victims = [
    mkEntry('民訴X', '本文X', ''),
    mkEntry('民訴Y', '本文Y', '')
  ];
  // 意図的に削除された論証(現存せず、復活してはいけない)
  const deliberate = [mkEntry('労働Z', '本文Z', '労働法', T_IMPORT0)];
  const dupArchive = [
    ...victims.map(v => ({ entry: deepCopy(v), deletedAt: T_DELETE, reason: '🏷️ タイトル完全一致・📄 本文完全一致' })),
    ...deliberate.map(v => ({ entry: deepCopy(v), deletedAt: '2026-08-20T01:37:00.000Z', reason: '🔍 類似度91%' }))
  ];
  return {
    revision: 100,
    updatedAt: '2026-08-25T00:00:00.000Z',
    data: { schemaVersion: 4, entries: alive, studyLog: {}, manualLog: {}, pastExamLogs: [], countdowns: [], dupArchive, dupResolved: [], speechDict: [], dailyStats: {}, dailyGoal: null }
  };
}

// 掃除(誤削除記録の取り消し)+民訴 Word 再取込み後のローカル状態を作る
function cleanedArchive(archive) {
  return deepCopy(archive).map(x => ((x.entry || {}).subject ? x : { ...x, revokedAt: T_REVOKE }));
}
function reimportedEntries(cloudEntries, victims) {
  const imported = victims.map(v => ({ ...deepCopy(v), subject: '民事訴訟法', importedAt: T_REIMPORT }));
  return deepCopy(cloudEntries).filter(e => e.subject !== '民事訴訟法').concat(
    deepCopy(cloudEntries).filter(e => e.subject === '民事訴訟法').map(e => ({ ...e, importedAt: T_REIMPORT })),
    imported
  );
}

const CLOUD = makeSyntheticCloud();
const VICTIMS = CLOUD.data.dupArchive.filter(x => !(x.entry || {}).subject).map(x => deepCopy(x.entry));
const minsoCount = list => list.filter(e => e.subject === '民事訴訟法').length;

console.log('=== 合成データ: reconcile ロジック試験 ===');

console.log('\n■ T1: 掃除+再取込み後、再取込み分が同期で消えない(不具合の修正)');
{
  const dev = loadDevice(null);
  dev.setLocal(K.entries, reimportedEntries(CLOUD.data.entries, VICTIMS));
  dev.setLocal(K.dupArchive, cleanedArchive(CLOUD.data.dupArchive));
  const r = dev.api.reconcile(deepCopy(CLOUD.data));
  check('民訴が3件(再取込み2+既存1)残る', minsoCount(r.entries) === 3, `民訴=${minsoCount(r.entries)}`);
  check('意図的に削除した論証は復活しない', !r.entries.some(e => e.title === '労働Z'));
  check('有効な削除記録は意図的削除の1件のみ', r.dupArchive.filter(isActive).length === 1, `有効=${r.dupArchive.filter(isActive).length}`);
}

console.log('\n■ T2: 掃除前は従来どおり削除される(掃除が必要という仕様の確認)');
{
  const dev = loadDevice(null);
  dev.setLocal(K.entries, reimportedEntries(CLOUD.data.entries, VICTIMS));
  dev.setLocal(K.dupArchive, deepCopy(CLOUD.data.dupArchive));
  const r = dev.api.reconcile(deepCopy(CLOUD.data));
  check('掃除前の再取込みは削除される(民訴=1)', minsoCount(r.entries) === 1, `民訴=${minsoCount(r.entries)}`);
}

console.log('\n■ T3: 休眠端末の復帰(削除前コピー保持)でも巻き戻らない【レビュー指摘 高-1】');
{
  // 掃除+再取込み済みのクラウド
  const cleanDev = loadDevice(null);
  cleanDev.setLocal(K.entries, reimportedEntries(CLOUD.data.entries, VICTIMS));
  cleanDev.setLocal(K.dupArchive, cleanedArchive(CLOUD.data.dupArchive));
  const cleanCloud = cleanDev.api.reconcile(deepCopy(CLOUD.data));
  // 端末C: 8/23 の削除前から同期停止。科目なしの古いコピーを保持、削除記録は持たない
  const devC = loadDevice(null);
  devC.setLocal(K.entries, deepCopy(CLOUD.data.entries).concat(VICTIMS.map(deepCopy)));
  devC.setLocal(K.dupArchive, []);
  const rC = devC.api.reconcile(deepCopy(cleanCloud));
  check('端末C復帰後も民訴3件が維持される', minsoCount(rC.entries) === 3, `民訴=${minsoCount(rC.entries)}`);
  const x = rC.entries.find(e => e.title === '民訴X');
  check('科目なしの古いコピーではなく再取込み版(科目つき)が残る', x && x.subject === '民事訴訟法' && x.importedAt === T_REIMPORT);
  // 端末D: 削除後・掃除前で停止。コピーも有効な削除記録も保持
  const devD = loadDevice(null);
  devD.setLocal(K.entries, deepCopy(CLOUD.data.entries).concat(VICTIMS.map(deepCopy)));
  devD.setLocal(K.dupArchive, deepCopy(CLOUD.data.dupArchive));
  const rD = devD.api.reconcile(deepCopy(cleanCloud));
  check('端末D復帰後も民訴3件が維持される', minsoCount(rD.entries) === 3, `民訴=${minsoCount(rD.entries)}`);
  check('再流入した削除記録は取り消し済みのまま(有効=1)', rD.dupArchive.filter(isActive).length === 1, `有効=${rD.dupArchive.filter(isActive).length}`);
  // 冪等性
  const devE = loadDevice(null);
  devE.setLocal(K.entries, rD.entries);
  devE.setLocal(K.dupArchive, rD.dupArchive);
  const rE = devE.api.reconcile(deepCopy(rD));
  check('もう一周しても結果が安定', minsoCount(rE.entries) === 3 && rE.dupArchive.filter(isActive).length === 1);
}

console.log('\n■ T4: 「読込日時をリセット」後でも消えない【レビュー指摘 中-2】');
{
  const cleanDev = loadDevice(null);
  cleanDev.setLocal(K.entries, reimportedEntries(CLOUD.data.entries, VICTIMS));
  cleanDev.setLocal(K.dupArchive, cleanedArchive(CLOUD.data.dupArchive));
  const cleanCloud = cleanDev.api.reconcile(deepCopy(CLOUD.data));
  const dev = loadDevice(null);
  const resetEntries = deepCopy(cleanCloud.entries).map(e => { const c = { ...e }; delete c.importedAt; return c; });
  dev.setLocal(K.entries, resetEntries);
  dev.setLocal(K.dupArchive, deepCopy(cleanCloud.dupArchive));
  // クラウド側はまだ掃除前の削除記録を持つ最悪ケース
  const r = dev.api.reconcile({ entries: deepCopy(CLOUD.data.entries), dupArchive: deepCopy(CLOUD.data.dupArchive) });
  check('リセット後も民訴3件が残る(取り消しは共有記録側で保持)', minsoCount(r.entries) === 3, `民訴=${minsoCount(r.entries)}`);
}

console.log('\n■ T5: 削除時刻がずれても「新しい方の操作」が勝つ【レビュー指摘 中-3】');
{
  const e = mkEntry('二重削除', '本文W', '刑法');
  // リモート: 8/20 に削除。ローカル: 8/10 に取込みで生存(8/5 の古い削除記録は取り消し済み)
  const dev = loadDevice(null);
  dev.setLocal(K.entries, [{ ...deepCopy(e), importedAt: '2026-08-10T00:00:00.000Z' }]);
  dev.setLocal(K.dupArchive, [{ entry: deepCopy(e), deletedAt: '2026-08-05T00:00:00.000Z', revokedAt: '2026-08-10T00:00:00.000Z' }]);
  const r = dev.api.reconcile({ entries: [], dupArchive: [{ entry: deepCopy(e), deletedAt: '2026-08-20T00:00:00.000Z' }] });
  check('新しい削除(8/20) > 古い取り消し(8/10) → 削除が勝つ', !r.entries.some(x => x.title === '二重削除'), `残存=${r.entries.filter(x => x.title === '二重削除').length}`);
  check('削除記録は deletedAt=8/20 で有効', r.dupArchive.length === 1 && isActive(r.dupArchive[0]) && r.dupArchive[0].deletedAt === '2026-08-20T00:00:00.000Z');
}

console.log('\n■ T6: 意図的に削除した論証は Word 再取込みでも復活しない(v21.56 の趣旨を維持)');
{
  const dev = loadDevice(null);
  // 労働Z を含む Word を再取込み(取込みは取り消し扱いにしない設計)
  dev.setLocal(K.entries, deepCopy(CLOUD.data.entries).concat([{ ...mkEntry('労働Z', '本文Z', '労働法'), importedAt: T_REIMPORT }]));
  dev.setLocal(K.dupArchive, deepCopy(CLOUD.data.dupArchive));
  const r = dev.api.reconcile(deepCopy(CLOUD.data));
  check('労働Z は再取込みでも復活しない', !r.entries.some(e => e.title === '労働Z'));
  check('労働Z の削除記録は有効なまま', r.dupArchive.some(x => (x.entry || {}).title === '労働Z' && isActive(x)));
}

console.log('\n■ T7: キーのエッジケース(本文なし・両方なし)');
{
  const noBody = { title: 'タイトルのみ', body: '', subject: '憲法', importedAt: T_IMPORT0 };
  const dev = loadDevice(null);
  dev.setLocal(K.entries, [deepCopy(noBody)]);
  dev.setLocal(K.dupArchive, [{ entry: { title: 'タイトルのみ', body: '' }, deletedAt: T_DELETE }]);
  const r = dev.api.reconcile({ entries: [], dupArchive: [] });
  check('本文なしの論証も削除記録と正しく照合される', !r.entries.some(e => e.title === 'タイトルのみ'), `残存=${r.entries.length}`);
  const dev2 = loadDevice(null);
  dev2.setLocal(K.entries, [deepCopy(noBody)]);
  dev2.setLocal(K.dupArchive, []);
  const r2 = dev2.api.reconcile({ entries: [], dupArchive: [] });
  check('削除記録がなければ本文なしでも普通に残る', r2.entries.length === 1);
}

console.log('\n■ T8: 意図的な削除は、後から完全一致ペアを整理しても打ち消されない【レビュー指摘】');
{
  const x = mkEntry('論証X', '本文X', '刑法');
  const oldTomb = { entry: deepCopy(x), deletedAt: '2026-08-20T00:00:00.000Z', reason: '🔍 類似度91%' };
  // 8/25 に Word 再取込みで X のコピーが2件入り、完全一致ペアの片方を削除した直後の状態。
  // 修正後は削除記録が作られないため、残った1件は 8/20 の有効な削除記録どおり消える(=意図的削除が維持される)
  const dev = loadDevice(null);
  dev.setLocal(K.entries, [{ ...deepCopy(x), importedAt: T_REIMPORT }]);
  dev.setLocal(K.dupArchive, [deepCopy(oldTomb)]);
  const r = dev.api.reconcile({ entries: [], dupArchive: [deepCopy(oldTomb)] });
  check('論証X は復活しない', !r.entries.some(e => e.title === '論証X'));
  check('8/20 の削除記録は有効なまま', r.dupArchive.length === 1 && isActive(r.dupArchive[0]));
}

console.log('\n=== モックGAS: 同期フロー(E2E)試験 ===');

async function e2e() {
  console.log('\n■ E1: 通常の push と revision 確定');
  {
    const gas = makeMockGas(CLOUD);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, deepCopy(CLOUD.data.entries));
    dev.api.setRevision(CLOUD.revision);
    await dev.api.pushToCloud();
    check('push 成功で revision が進む', dev.api.getRevision() === CLOUD.revision + 1, `revision=${dev.api.getRevision()}`);
    check('クラウドが更新される', gas.store.revision === CLOUD.revision + 1);
  }

  console.log('\n■ E2: 競合 → 統合 → 再push');
  {
    const gas = makeMockGas(CLOUD);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, deepCopy(CLOUD.data.entries).concat([mkEntry('新規A', '本文N', '刑法', T_REIMPORT)]));
    dev.api.setRevision(CLOUD.revision - 5); // 古い revision で push → conflict
    await dev.api.pushToCloud();
    const titles = gas.store.data.entries.map(e => e.title);
    check('競合後にクラウドへ統合結果が保存される', titles.includes('新規A') && titles.includes('民法A'), `クラウド件数=${gas.store.data.entries.length}`);
    check('revision が確定する', dev.api.getRevision() === gas.store.revision);
  }

  console.log('\n■ E3: push 失敗時に revision が進まない(丸ごと上書きの防止)【レビュー指摘 高-2】');
  {
    const gas = makeMockGas(CLOUD);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, deepCopy(CLOUD.data.entries).concat([mkEntry('端末限定B', '本文L', '商法', T_REIMPORT)]));
    dev.api.setRevision(CLOUD.revision - 5); // 古い revision の端末
    gas.failNextPost = 1; // pull 中の push が一度失敗する(オフライン等)
    let threw = false;
    try { await dev.api.pullFromCloud(false); } catch (e) { threw = true; }
    check('push 失敗はエラーとして扱われる', threw);
    check('revision が進んでいない(旧: 挙動では進んでしまっていた)', dev.api.getRevision() === CLOUD.revision - 5, `revision=${dev.api.getRevision()}`);
    // その後の編集 → push は conflict になり、統合されてから保存される(素通り上書きしない)
    dev.setLocal(K.entries, dev.getLocal(K.entries, []).concat([mkEntry('編集C', '本文E', '憲法', T_REIMPORT)]));
    await dev.api.pushToCloud();
    const titles = gas.store.data.entries.map(e => e.title);
    check('クラウド側の既存データが失われていない', titles.includes('民法A') && titles.includes('民訴・生存1'));
    check('端末側の編集も反映されている', titles.includes('端末限定B') && titles.includes('編集C'));
    check('削除記録も維持されている', gas.store.data.dupArchive.length === CLOUD.data.dupArchive.length, `dupArchive=${gas.store.data.dupArchive.length}`);
  }

  console.log('\n■ E4: conflict 応答に latest が無くてもクラッシュしない【レビュー指摘 低-5】');
  {
    const gas = makeMockGas(CLOUD);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, deepCopy(CLOUD.data.entries));
    dev.api.setRevision(CLOUD.revision - 1);
    gas.conflictWithoutLatestOnce = true;
    let msg = '';
    try { await dev.api.pushToCloud(); } catch (e) { msg = e.message; }
    check('TypeError ではなく通常のエラーになる', msg === '保存に失敗しました', `message=${msg}`);
  }

  console.log('\n■ E5: 競合リトライを使い切っても復元・取り消しが失われない【レビュー指摘】');
  {
    // 常に conflict を返す GAS(他端末が高頻度で書き込んでいる状況を模す)
    const remoteArchive = [{ entry: { title: '復元済み', body: '本文R', subject: '商法' }, deletedAt: T_DELETE, reason: 'x' }];
    const remoteStore = { revision: 500, updatedAt: '2026-08-25T00:00:00.000Z', data: { entries: [mkEntry('リモートA', '本文RA', '民法', T_IMPORT0)], dupArchive: deepCopy(remoteArchive) } };
    const gas = {
      fetchImpl: async (url, opts) => {
        if (!opts || opts.method !== 'POST') return { ok: true, json: async () => deepCopy(remoteStore) };
        return { ok: true, json: async () => ({ ok: false, reason: 'conflict', latest: deepCopy(remoteStore) }) };
      }
    };
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, [{ title: '復元済み', body: '本文R', subject: '商法', restoredAt: T_REVOKE }]);
    dev.setLocal(K.dupArchive, [{ ...deepCopy(remoteArchive[0]), revokedAt: T_REVOKE }]);
    dev.api.setRevision(490);
    await dev.api.pushToCloud();
    const localEntries = dev.getLocal(K.entries, []);
    const localArchive = dev.getLocal(K.dupArchive, []);
    check('復元した論証がローカルに残る', localEntries.some(e => e.title === '復元済み'));
    check('リモート側の論証も統合されている', localEntries.some(e => e.title === 'リモートA'));
    check('取り消し(revokedAt)が保持される', localArchive.length === 1 && !isActive(localArchive[0]));
    check('revision はリモートに整合する', dev.api.getRevision() === 500);
  }
}

// ---- duplicate-check.js の関数試験 ----
function loadDupCheck(initialArchive, initialEntries) {
  const storage = makeStorage();
  storage.setItem('ronshoDupArchiveV1', JSON.stringify(initialArchive || []));
  const elements = new Map();
  const getEl = id => {
    if (!elements.has(id)) {
      elements.set(id, { id, innerHTML: '', textContent: '', style: {}, addEventListener: () => {} });
    }
    return elements.get(id);
  };
  const sandbox = {
    console,
    localStorage: storage,
    document: { getElementById: getEl, addEventListener: () => {} },
    entries: initialEntries || [],
    studyLog: {},
    status: { textContent: '' },
    saveEntries: () => {},
    saveStudyLog: () => {},
    renderAll: () => {},
    confirm: () => true,
    escapeHtml: s => String(s == null ? '' : s),
    formatLocalDate: () => '2026-08-25',
    buildYearHtml: () => '',
    getYearTokensPlain: () => []
  };
  vm.createContext(sandbox);
  vm.runInContext(dupCheckCode, sandbox, { filename: 'duplicate-check.js' });
  return { sandbox, storage, getEl };
}

console.log('\n=== duplicate-check.js: アーカイブ・復元の試験 ===');

console.log('\n■ D1: 「これだけ削除」— 完全一致ペアでは削除記録を作らない【レビュー指摘】');
{
  const a = { title: '双子', body: '本文T', subject: '民法' };
  const b = { title: '双子', body: '本文T', subject: '民法' };
  const env = loadDupCheck([], [a, b]);
  const r = env.sandbox.dupDeleteOneFromPair({ a, b, reasons: new Set(['title', 'body']), score: 1 }, b, a);
  check('sameKey と判定され記録は作られない', r.sameKey === true && JSON.parse(env.storage.getItem('ronshoDupArchiveV1')).length === 0);
  check('対象の1件だけが削除される', env.sandbox.entries.length === 1);
  // body が ''(空文字) とフィールド無しの組み合わせも、同期キー上は同一なので道連れ削除を防ぐ
  const c = { title: 'キーK', body: '', subject: '刑法' };
  const d2 = { title: 'キーK', subject: '刑法' };
  const env2 = loadDupCheck([], [c, d2]);
  const r2 = env2.sandbox.dupDeleteOneFromPair({ a: c, b: d2, reasons: new Set(['title']), score: 1 }, d2, c);
  check('body 空とフィールド無しも sameKey 扱い', r2.sameKey === true && JSON.parse(env2.storage.getItem('ronshoDupArchiveV1')).length === 0);
  // 本文が違う類似ペアは従来どおり有効な記録を作る
  const e1 = { title: '類似A', body: '本文1', subject: '商法' };
  const e2 = { title: '類似A(修正)', body: '本文2', subject: '商法' };
  const env3 = loadDupCheck([], [e1, e2]);
  const r3 = env3.sandbox.dupDeleteOneFromPair({ a: e1, b: e2, reasons: new Set(['fuzzy']), score: 0.9 }, e2, e1);
  const saved3 = JSON.parse(env3.storage.getItem('ronshoDupArchiveV1'));
  check('非完全一致ペアは有効な削除記録を作る', r3.sameKey === false && saved3.length === 1 && isActive(saved3[0]));
}

console.log('\n■ D2: 復元は記録を取り消しつつ restoredAt を付けて論証を戻す');
{
  const archived = [{ entry: { title: '復元対象', body: '本文R', subject: '商法' }, deletedAt: T_DELETE, reason: 'x' }];
  const { sandbox, storage } = loadDupCheck(archived, []);
  sandbox.loadDupArchive();
  sandbox.dupRestoreArchivedEntry(0);
  check('entries に restoredAt 付きで戻る', sandbox.entries.length === 1 && !!sandbox.entries[0].restoredAt);
  const saved = JSON.parse(storage.getItem('ronshoDupArchiveV1'));
  check('記録は残るが取り消し済みになる', saved.length === 1 && !isActive(saved[0]));
  check('取り消しが削除より新しい', timeOf(saved[0].revokedAt) > timeOf(saved[0].deletedAt));
}

console.log('\n■ D3: アーカイブ一覧は有効な記録だけを表示し、ボタンの添字は元配列を指す');
{
  const archived = [
    { entry: { title: '有効1', body: 'b1', subject: '民法' }, deletedAt: T_DELETE, reason: 'x' },
    { entry: { title: '取消済', body: 'b2', subject: '民法' }, deletedAt: T_DELETE, revokedAt: T_REVOKE, reason: 'x' },
    { entry: { title: '有効2', body: 'b3', subject: '民法' }, deletedAt: T_DELETE, reason: 'x' }
  ];
  const { sandbox, getEl } = loadDupCheck(archived, []);
  sandbox.loadDupArchive();
  sandbox.dupArchiveListVisible = true;
  sandbox.renderDupArchive();
  const html = getEl('dupArchiveWrap').innerHTML;
  check('有効な2件だけが表示される', html.includes('有効1') && html.includes('有効2') && !html.includes('取消済'));
  check('復元ボタンの添字が元配列の位置(0,2)を指す', html.includes('data-archive-idx="0"') && html.includes('data-archive-idx="2"') && !html.includes('data-archive-idx="1"'));
  check('件数表示は2件', html.includes('2件のアーカイブ'));
}

// ---- 実データ試験(任意) ----
async function realDataSuite(cloudPath) {
  const real = JSON.parse(fs.readFileSync(cloudPath, 'utf8'));
  const d = real.data;
  const noSubj = d.dupArchive.filter(x => !((x.entry || {}).subject));
  const minso = list => list.filter(e => e.subject === '民事訴訟法');
  console.log(`\n=== 実データ試験 (${path.basename(cloudPath)}: entries=${d.entries.length} dupArchive=${d.dupArchive.length} 科目なし記録=${noSubj.length}) ===`);

  // 掃除(87件へ revokedAt 付与)+民訴再取込みの状態
  const cleaned = deepCopy(d.dupArchive).map(x => (((x.entry || {}).subject) ? x : { ...x, revokedAt: T_REVOKE }));
  const imported = noSubj.map(t => ({ ...deepCopy(t.entry), subject: '民事訴訟法', importedAt: T_REIMPORT }));
  const localEntries = deepCopy(d.entries).filter(e => e.subject !== '民事訴訟法')
    .concat(deepCopy(d.entries).filter(e => e.subject === '民事訴訟法').map(e => ({ ...e, importedAt: T_REIMPORT })))
    .concat(imported);

  console.log('\n■ R1: 掃除+再取込みで民訴が回復し、以後の同期で消えない');
  const dev = loadDevice(null);
  dev.setLocal(K.entries, localEntries);
  dev.setLocal(K.dupArchive, cleaned);
  const clean = dev.api.reconcile(deepCopy(d));
  const expectedMinso = minso(deepCopy(d.entries)).length + imported.length;
  check(`民訴が${expectedMinso}件になる`, minso(clean.entries).length === expectedMinso, `民訴=${minso(clean.entries).length}`);
  check('民訴以外の件数は変わらない', clean.entries.length - minso(clean.entries).length === d.entries.length - minso(d.entries).length);

  console.log('\n■ R2: 休眠端末(全アーカイブ済み論証のコピー保持)が復帰しても被害ゼロ【全件総当たり】');
  const devZ = loadDevice(null);
  devZ.setLocal(K.entries, deepCopy(d.entries).concat(d.dupArchive.map(x => deepCopy(x.entry))));
  devZ.setLocal(K.dupArchive, deepCopy(d.dupArchive));
  const rZ = devZ.api.reconcile(deepCopy(clean));
  const activeKeys = new Set(rZ.dupArchive.filter(isActive).map(archiveKeyOf));
  const zombies = rZ.entries.filter(e => activeKeys.has(tombKeyOf(e)));
  check('有効な削除記録に一致する論証は1件も復活しない', zombies.length === 0, `復活=${zombies.length}`);
  check('民訴は維持される', minso(rZ.entries).length === expectedMinso, `民訴=${minso(rZ.entries).length}`);
  const revokedKeys = new Set(rZ.dupArchive.filter(x => !isActive(x)).map(archiveKeyOf));
  const wrongSubject = rZ.entries.filter(e => revokedKeys.has(tombKeyOf(e)) && minso([e]).length === 0 && !(e.subject));
  check('取り消し済みキーの論証が科目なしコピーに上書きされていない', wrongSubject.length === 0, `科目なし=${wrongSubject.length}`);

  console.log('\n■ R3: 有効な削除記録の総当たり(掃除後60件が全て削除として機能)');
  const activeCount = clean.dupArchive.filter(isActive).length;
  const aliveActive = clean.entries.filter(e => new Set(clean.dupArchive.filter(isActive).map(archiveKeyOf)).has(tombKeyOf(e)));
  check(`有効な記録は${d.dupArchive.length - noSubj.length}件`, activeCount === d.dupArchive.length - noSubj.length, `有効=${activeCount}`);
  check('有効な記録と一致する論証は存在しない', aliveActive.length === 0, `一致=${aliveActive.length}`);
}

(async () => {
  await e2e();
  const cloudPath = process.env.RONSHO_CLOUD_JSON;
  if (cloudPath && fs.existsSync(cloudPath)) {
    await realDataSuite(cloudPath);
  } else {
    console.log('\n(実データ試験はスキップ: RONSHO_CLOUD_JSON 未指定)');
  }
  console.log('\n' + (failures === 0 ? '🎉 全チェック合格' : `⚠️ ${failures}件のチェックが不合格`));
  process.exit(failures === 0 ? 0 : 1);
})();
