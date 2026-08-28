#!/usr/bin/env node
// 同期ロジック(drive-sync.js)と重複チェック(js/duplicate-check.js)の自動テスト。
// アプリの実ファイルをそのまま Node の vm に読み込み、localStorage / fetch(GAS) / DOM を
// スタブに差し替えて検証する。実行: node tools/sync-test/run.js
//
// 同期の設計（v21.64〜）: 端末間のデータはマージ（統合）せず、
// 「クラウドを唯一の正本とし、片方だけが変わっていれば丸ごと採用、
// 　両方が変わっていれば確認ポップアップでユーザーに選んでもらう」方式。
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

// 簡易DOM: id付き要素の innerHTML / onclick だけを再現する
function makeElements() {
  const elements = new Map();
  const getEl = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        id, _innerHTML: '', onclick: null,
        get innerHTML() { return this._innerHTML; },
        set innerHTML(html) {
          this._innerHTML = html;
          // innerHTMLの再代入で子要素は消える扱いにする(実DOMの挙動を簡易再現)
          for (const [k] of elements) {
            if (k !== id && k.startsWith(id + '::')) elements.delete(k);
          }
        },
        textContent: '',
        style: {},
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {} }
      });
    }
    return elements.get(id);
  };
  return { elements, getEl };
}

// GAS(コード.gs)の doGet / doPost を忠実に再現したモック
function makeMockGas(initial) {
  const gas = {
    store: initial ? deepCopy(initial) : { revision: 0, updatedAt: '2026-08-25T00:00:00.000Z', data: {} },
    failNextPost: 0,
    conflictWithoutLatestOnce: false,
    postCount: 0
  };
  gas.fetchImpl = async (url, opts) => {
    if (!opts || opts.method !== 'POST') {
      return { ok: true, json: async () => deepCopy(gas.store) };
    }
    gas.postCount++;
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

// drive-sync.js を1つの「端末」として読み込む。withDom=true で確認ポップアップの検証もできる
function loadDevice(gas, opts) {
  opts = opts || {};
  const storage = makeStorage();
  const { elements, getEl } = makeElements();
  let confirmReturn = !!opts.confirmReturnsUseCloud;
  const sandbox = {
    console,
    localStorage: storage,
    window: { addEventListener: () => {} },
    document: {
      getElementById: opts.withDom === false ? (() => null) : getEl,
      addEventListener: () => {}, visibilityState: 'hidden'
    },
    status: { after: () => {} },
    confirm: (msg) => { sandbox.__lastConfirmMsg = msg; return confirmReturn; },
    // 実アプリのjs/core.jsのsaveEntries()を模したスタブ。applyRemoteData()内から
    // 呼ばれた際に、都度同期フックが誤って反応しないかを検証するために使う
    saveEntries: () => { if (typeof sandbox.window.ronshoSyncNotifyChange === 'function') sandbox.window.ronshoSyncNotifyChange(); },
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
  return { api, storage, elements, getEl, setLocal, getLocal, sandbox, setConfirmReturnsUseCloud: v => { confirmReturn = v; } };
}

const K = {
  entries: 'ronshoEntries',
  studyLog: 'ronshoStudyLog',
  dupArchive: 'ronshoDupArchiveV1',
  revision: 'ronshoSyncRevisionV1'
};

const mkEntry = (title, body, subject) => ({ title, body, subject });

function makeCloudStore(entries, revision) {
  return {
    revision: revision || 10,
    updatedAt: '2026-08-25T00:00:00.000Z',
    data: { schemaVersion: 4, entries, studyLog: {}, manualLog: {}, pastExamLogs: [], countdowns: [], dupArchive: [], dupResolved: [], speechDict: [], dailyStats: {}, dailyGoal: null }
  };
}

console.log('=== 同期フロー(E2E)試験: マージせず「片方だけ変更なら採用／両方変更なら確認」方式 ===');

async function e2e() {
  console.log('\n■ E0: 真っさらな端末が既にデータのあるクラウドに初めて繋いだ場合、競合ポップアップを出さずそのまま採用する');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法'), mkEntry('民法B', '本文B', '民法')], 10);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas);
    // setLocalを一切呼ばない＝この端末は本当に何も持っていない（revision=0, last=''）
    await dev.api.pullFromCloud(true);
    check('確認ポップアップは表示されない', dev.getEl('driveSyncConflictModal').innerHTML === '');
    check('クラウドの内容がそのまま反映される', dev.getLocal(K.entries, []).length === 2);
    check('revisionがクラウドに追従する', dev.api.getRevision() === 10);
  }

  console.log('\n■ E1: 通常のpush（誰とも競合していない）で revision が進み、クラウドが端末の内容で上書きされる');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法')], 10);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法'), mkEntry('民法B', '本文B', '民法')]);
    dev.api.setRevision(cloud.revision);
    await dev.api.pushToCloud();
    check('push成功でrevisionが進む', dev.api.getRevision() === cloud.revision + 1, `revision=${dev.api.getRevision()}`);
    check('クラウドが端末の内容で丸ごと上書きされる', gas.store.data.entries.length === 2);
  }

  console.log('\n■ E2: クラウド・端末ともに変更なし → 何もしない');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法')], 10);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, cloud.data.entries);
    dev.api.setRevision(cloud.revision);
    dev.api.markSynced(dev.api.snapshot());
    await dev.api.pullFromCloud(false);
    check('revisionは変わらない', dev.api.getRevision() === cloud.revision);
    check('クラウドへのpushは発生しない', gas.store.revision === cloud.revision);
  }

  console.log('\n■ E3: クラウドだけが更新されている（この端末は無変更）→ そのままクラウドを採用する');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法'), mkEntry('民法C（他端末で追加）', '本文C', '民法')], 11);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas);
    // この端末は revision=10 時点の状態のまま何も変えていない
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法')]);
    dev.api.setRevision(10);
    dev.api.markSynced(dev.api.snapshot());
    await dev.api.pullFromCloud(false);
    check('revisionがクラウドに追従する', dev.api.getRevision() === 11);
    check('クラウドの内容がそのまま反映される', dev.getLocal(K.entries, []).some(e => e.title === '民法C（他端末で追加）'));
  }

  console.log('\n■ E4: 両方で変更＝本当の競合 → 自動統合せず確認ポップアップを出す');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法'), mkEntry('クラウド側の新規', '本文cloud', '民法')], 11);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法')]);
    dev.api.setRevision(10);
    dev.api.markSynced(dev.api.snapshot());
    // この端末側でオフライン中に変更（同期前）
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法'), mkEntry('端末側の新規', '本文local', '民法')]);
    await dev.api.pullFromCloud(false);
    const modalHtml = dev.getEl('driveSyncConflictModal').innerHTML;
    check('確認ポップアップが表示される', modalHtml.includes('この端末のデータを使う') && modalHtml.includes('クラウドのデータを使う'));
    check('まだ自動では上書きされない（revisionは据え置き）', dev.api.getRevision() === 10);

    console.log('\n  ▶ E4-a: 「この端末のデータを使う」を選ぶ → 端末の内容でクラウドを上書き');
    const localBtn = dev.getEl('driveSyncKeepLocalBtn');
    await localBtn.onclick();
    check('revisionがクラウドに確定する', dev.api.getRevision() === gas.store.revision);
    check('クラウドが端末側の内容になる', gas.store.data.entries.some(e => e.title === '端末側の新規') && !gas.store.data.entries.some(e => e.title === 'クラウド側の新規'));
  }

  console.log('\n■ E4b: 論証・学習記録は同じでも、他の項目（カウントダウン等）が違う場合はそれを案内する（「違いなし」と誤解させない）');
  {
    const dev = loadDevice(null);
    const sameEntries = [mkEntry('民法A', '本文A', '民法')];
    const sameLog = { '民法A': { memorized: true, history: ['2026-08-20'] } };
    const local = { entries: sameEntries, studyLog: sameLog, countdowns: [{ id: 'c1', label: '予備試験', date: '2027-05-01' }], manualLog: {}, pastExamLogs: [], dupArchive: [], dupResolved: [], speechDict: [], dailyGoal: null };
    const remote = { entries: sameEntries, studyLog: sameLog, countdowns: [], manualLog: {}, pastExamLogs: [], dupArchive: [], dupResolved: [], speechDict: [], dailyGoal: null };
    const diff = dev.api.computeSyncDiff(local, remote);
    check('論証・学習記録のグループは無い', diff.groups.length === 0);
    check('カウントダウンの差は検出される', diff.otherFieldLabels.some(l => l.includes('カウントダウン')));
  }

  console.log('\n■ E5: 競合ポップアップで「クラウドのデータを使う」を選ぶ → 端末側がクラウドの内容で上書きされる');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法'), mkEntry('クラウド側の新規', '本文cloud', '民法')], 11);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法')]);
    dev.api.setRevision(10);
    dev.api.markSynced(dev.api.snapshot());
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法'), mkEntry('端末側の新規', '本文local', '民法')]);
    await dev.api.pullFromCloud(false);
    const cloudBtn = dev.getEl('driveSyncKeepCloudBtn');
    cloudBtn.onclick();
    check('端末側の未同期の変更は破棄され、クラウドの内容になる', dev.getLocal(K.entries, []).some(e => e.title === 'クラウド側の新規') && !dev.getLocal(K.entries, []).some(e => e.title === '端末側の新規'));
    check('revisionがクラウドに追従する', dev.api.getRevision() === 11);
  }

  console.log('\n■ E6: push時のレース（送信直前に他がpush済み）でも自動統合せず確認ポップアップを出す');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法')], 10);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas);
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法'), mkEntry('端末側の新規', '本文local', '民法')]);
    dev.api.setRevision(9); // 古いrevisionのまま(直前に別の変更がpushされていた状況)
    await dev.api.pushToCloud();
    check('クラウドは上書きされない', gas.store.revision === cloud.revision, `cloud.revision=${gas.store.revision}`);
    check('確認ポップアップが表示される', dev.getEl('driveSyncConflictModal').innerHTML.includes('driveSyncConflictBox'));
  }

  console.log('\n■ E7: DOM（ポップアップ用の要素）が無い環境でも confirm() にフォールバックして動作する');
  {
    const cloud = makeCloudStore([mkEntry('民法A', '本文A', '民法'), mkEntry('クラウド側の新規', '本文cloud', '民法')], 11);
    const gas = makeMockGas(cloud);
    const dev = loadDevice(gas, { withDom: false, confirmReturnsUseCloud: true });
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法')]);
    dev.api.setRevision(10);
    dev.api.markSynced(dev.api.snapshot());
    dev.setLocal(K.entries, [mkEntry('民法A', '本文A', '民法'), mkEntry('端末側の新規', '本文local', '民法')]);
    await dev.api.pullFromCloud(false);
    check('confirm()でクラウド優先を選ぶとクラウドの内容が反映される', dev.getLocal(K.entries, []).some(e => e.title === 'クラウド側の新規'));
  }

  console.log('\n■ E8: 配列の並び順だけが違うデータは「未同期の変更あり」と誤検知しない（並び順だけの違いで競合ポップアップが出ないようにする）');
  {
    const dev = loadDevice(null);
    dev.setLocal(K.entries, [mkEntry('A', '本文A', '民法'), mkEntry('B', '本文B', '民法')]);
    dev.api.markSynced(dev.api.snapshot());
    // 中身は同じだが、entries配列の並びだけを入れ替える（同期時の再取り込み等で起こりうる）
    dev.setLocal(K.entries, [mkEntry('B', '本文B', '民法'), mkEntry('A', '本文A', '民法')]);
    check('entries配列の並び順だけの違いは「変更あり」と判定しない', dev.api.hasUnsyncedLocalChanges() === false);
  }

  console.log('\n■ E8b: dupResolved（Setから復元される配列）の並び順だけの違いは「差がある項目」として案内しない');
  {
    const dev = loadDevice(null);
    const base = { entries: [], studyLog: {}, countdowns: [], manualLog: {}, pastExamLogs: [], dupArchive: [], speechDict: [], dailyGoal: null };
    const local = { ...base, dupResolved: ['sigA', 'sigB', 'sigC'] };
    const remote = { ...base, dupResolved: ['sigC', 'sigA', 'sigB'] };
    const diff = dev.api.computeSyncDiff(local, remote);
    check('並び順だけの違いはotherFieldLabelsに含まれない', diff.otherFieldLabels.length === 0, JSON.stringify(diff.otherFieldLabels));
  }

  console.log('\n■ E8c: 並び順ではなく実際に中身が違う場合は、引き続き正しく検知する');
  {
    const dev = loadDevice(null);
    const base = { entries: [], studyLog: {}, manualLog: {}, pastExamLogs: [], dupArchive: [], dupResolved: [], speechDict: [], dailyGoal: null };
    const local = { ...base, countdowns: [{ id: 'c1', label: 'X', date: '2027-01-01' }] };
    const remote = { ...base, countdowns: [] };
    const diff = dev.api.computeSyncDiff(local, remote);
    check('実際に中身が違う場合はotherFieldLabelsで検知される', diff.otherFieldLabels.some(l => l.includes('カウントダウン')));
  }
}

// ---- duplicate-check.js の関数試験 ----
const T_DELETE = '2026-08-23T01:30:00.000Z';
const T_REVOKE = '2026-08-25T13:00:00.000Z';
const timeOf = s => { const t = Date.parse(s || ''); return isNaN(t) ? 0 : t; };
const isActive = x => timeOf(x && x.deletedAt) > timeOf(x && x.revokedAt);

function loadDupCheck(initialArchive, initialEntries) {
  const storage = makeStorage();
  storage.setItem('ronshoDupArchiveV1', JSON.stringify(initialArchive || []));
  const { getEl } = makeElements();
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

console.log('\n■ D1: 「これだけ削除」— 完全一致ペアでは削除記録を作らない');
{
  const a = { title: '双子', body: '本文T', subject: '民法' };
  const b = { title: '双子', body: '本文T', subject: '民法' };
  const env = loadDupCheck([], [a, b]);
  const r = env.sandbox.dupDeleteOneFromPair({ a, b, reasons: new Set(['title', 'body']), score: 1 }, b, a);
  check('sameKeyと判定され記録は作られない', r.sameKey === true && JSON.parse(env.storage.getItem('ronshoDupArchiveV1')).length === 0);
  check('対象の1件だけが削除される', env.sandbox.entries.length === 1);
  const c = { title: 'キーK', body: '', subject: '刑法' };
  const d2 = { title: 'キーK', subject: '刑法' };
  const env2 = loadDupCheck([], [c, d2]);
  const r2 = env2.sandbox.dupDeleteOneFromPair({ a: c, b: d2, reasons: new Set(['title']), score: 1 }, d2, c);
  check('body空とフィールド無しもsameKey扱い', r2.sameKey === true && JSON.parse(env2.storage.getItem('ronshoDupArchiveV1')).length === 0);
  const e1 = { title: '類似A', body: '本文1', subject: '商法' };
  const e2 = { title: '類似A(修正)', body: '本文2', subject: '商法' };
  const env3 = loadDupCheck([], [e1, e2]);
  const r3 = env3.sandbox.dupDeleteOneFromPair({ a: e1, b: e2, reasons: new Set(['fuzzy']), score: 0.9 }, e2, e1);
  const saved3 = JSON.parse(env3.storage.getItem('ronshoDupArchiveV1'));
  check('非完全一致ペアは有効な削除記録を作る', r3.sameKey === false && saved3.length === 1 && isActive(saved3[0]));
}

console.log('\n■ D2: 復元は記録を取り消しつつrestoredAtを付けて論証を戻す');
{
  const archived = [{ entry: { title: '復元対象', body: '本文R', subject: '商法' }, deletedAt: T_DELETE, reason: 'x' }];
  const { sandbox, storage } = loadDupCheck(archived, []);
  sandbox.loadDupArchive();
  sandbox.dupRestoreArchivedEntry(0);
  check('entriesにrestoredAt付きで戻る', sandbox.entries.length === 1 && !!sandbox.entries[0].restoredAt);
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

(async () => {
  await e2e();
  console.log('\n' + (failures === 0 ? '🎉 全チェック合格' : `⚠️ ${failures}件のチェックが不合格`));
  process.exit(failures === 0 ? 0 : 1);
})();
