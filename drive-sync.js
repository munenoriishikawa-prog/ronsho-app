(() => {
  const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyB-3irASAEN6amf2QIN74WQNhF4winF8LwO_gfYDFkW4JLw0cTHTUyOHfoPis7Sof5/exec';
  const REVISION_KEY = 'ronshoSyncRevisionV1';
  const LAST_SYNCED_KEY = 'ronshoSyncLastSnapshotV1';
  const ENTRY_KEY = 'ronshoEntries';
  const STUDYLOG_KEY = 'ronshoStudyLog';
  const MANUALLOG_KEY = 'ronshoManualLog';
  const PASTEXAM_KEY = 'ronshoPastExamLogs_v1';
  const COUNTDOWN_KEY = 'ronshoCountdowns_v1';
  const DUPARCHIVE_KEY = 'ronshoDupArchiveV1';
  const DUPRESOLVED_KEY = 'ronshoDupResolvedV1';
  const SPEECHDICT_KEY = 'ronshoSpeechDictV1';
  const DAILYSTATS_KEY = 'ronshoDailyStatsV1';
  const DAILYGOAL_KEY = 'ronshoDailyGoalV1';

  let revision = Number(localStorage.getItem(REVISION_KEY) || 0);
  // 「最後に同期が完了した時点のローカルの状態」。ページを再読み込みしても
  // 正しく「未同期の変更があるか」を判定できるよう、localStorageに永続化する
  let last = localStorage.getItem(LAST_SYNCED_KEY) || '';
  let timer;
  let syncInFlight = false;
  let syncSuspended = false;
  let lastPullAttempt = 0;
  window.ronshoSuspendSync = (v) => { syncSuspended = !!v; };

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)) } catch (_) { return d } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const getEntries = () => read(ENTRY_KEY, []);
  const state = t => { const e = document.getElementById('driveSyncState'); if (e) e.textContent = t };

  const snapshot = () => ({
    schemaVersion: 4,
    entries: getEntries(),
    studyLog: read(STUDYLOG_KEY, {}),
    manualLog: read(MANUALLOG_KEY, {}),
    pastExamLogs: read(PASTEXAM_KEY, []),
    countdowns: read(COUNTDOWN_KEY, []),
    dupArchive: read(DUPARCHIVE_KEY, []),
    dupResolved: read(DUPRESOLVED_KEY, []),
    speechDict: read(SPEECHDICT_KEY, []),
    dailyStats: read(DAILYSTATS_KEY, {}),
    dailyGoal: read(DAILYGOAL_KEY, null)
  });

  const hasLocalData = () => {
    const e = getEntries();
    const sl = read(STUDYLOG_KEY, {});
    return (e && e.length > 0) || Object.keys(sl).length > 0;
  };
  // dailyStatsは、ホーム画面を開くたびに「今日の暗記済み件数」が自動で
  // 記録される統計で、実際の学習操作が無くても毎日変化する。これを比較に
  // 含めると、何も編集していない端末でも常に「未同期の変更あり」と誤判定
  // されてしまうため、競合検出の比較対象からは除外する
  const withoutVolatileFields = (snap) => { const { dailyStats, ...rest } = snap; return rest; };
  const markSynced = (snap) => {
    last = JSON.stringify(withoutVolatileFields(snap));
    localStorage.setItem(LAST_SYNCED_KEY, last);
  };
  // 前回の同期完了時点から、この端末でデータが変わっているか
  const hasUnsyncedLocalChanges = () => JSON.stringify(withoutVolatileFields(snapshot())) !== last;

  function applyRemoteData(data) {
    data = data || {};
    write(ENTRY_KEY, data.entries || []);
    write(STUDYLOG_KEY, data.studyLog || {});
    write(MANUALLOG_KEY, data.manualLog || {});
    write(PASTEXAM_KEY, data.pastExamLogs || []);
    write(COUNTDOWN_KEY, data.countdowns || []);
    write(DUPARCHIVE_KEY, data.dupArchive || []);
    write(DUPRESOLVED_KEY, data.dupResolved || []);
    write(SPEECHDICT_KEY, data.speechDict || []);
    write(DAILYSTATS_KEY, data.dailyStats || {});
    if (data.dailyGoal != null) write(DAILYGOAL_KEY, data.dailyGoal);
    try { entries = data.entries || [] } catch (_) {}
    try { studyLog = data.studyLog || {} } catch (_) {}
    try { manualLog = data.manualLog || {} } catch (_) {}
    try { dupArchiveList = data.dupArchive || [] } catch (_) {}
    try { dupResolvedSet = new Set(data.dupResolved || []) } catch (_) {}
    try { speechDict = data.speechDict || [] } catch (_) {}
    if (typeof saveEntries === 'function') saveEntries();
    if (typeof renderAll === 'function') renderAll(true);
    if (typeof renderCountdownCard === 'function') renderCountdownCard();
    if (typeof renderDupArchive === 'function') renderDupArchive();
    if (typeof renderSpeechDictList === 'function') renderSpeechDictList();
  }

  // クラウド側のデータをそのまま採用する（この端末に未同期の変更が無いときのみ安全）
  function adoptRemoteWholesale(remoteData, remoteRevision) {
    revision = remoteRevision;
    localStorage.setItem(REVISION_KEY, String(revision));
    applyRemoteData(remoteData);
    markSynced(snapshot());
  }

  // --- 競合確認ポップアップ ---
  // 「この端末」と「クラウド」の両方でデータが変わっている場合のみ表示する。
  // 統合(マージ)はせず、ユーザーが選んだ方をまるごと採用する単純な方式にしている。
  function entryCountOf(data) { return (data && data.entries && data.entries.length) || 0; }
  function memorizedCountOf(data) {
    const sl = (data && data.studyLog) || {};
    return Object.values(sl).filter(v => v && v.memorized).length;
  }
  // グローバルのescapeHtml（js/core.js）に頼らず、この端末単体でも安全に動くようにする
  const escHtml = (typeof escapeHtml === 'function')
    ? escapeHtml
    : (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const entryKeyOf = e => [e && e.title, e && e.body].filter(Boolean).join('|') || JSON.stringify(e);
  function formatUpdatedAt(iso) {
    if (!iso) return '不明';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '不明';
    return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  // 「この端末」と「クラウド」の何がどう違うのかを具体的に洗い出す。
  // 件数が同じでも中身が違うケース（タイトルの入れ替わり・暗記フラグの違いなど）を
  // 見落とさないよう、論証の追加/削除と学習記録の差分を個別に数える
  function computeSyncDiff(localData, remoteData) {
    const localEntries = (localData && localData.entries) || [];
    const remoteEntries = (remoteData && remoteData.entries) || [];
    const localByTitle = new Map(localEntries.map(e => [e.title, e]));
    const remoteByTitle = new Map(remoteEntries.map(e => [e.title, e]));

    // 同じタイトルで本文だけが違う論証は「編集された1件」として扱い、
    // 「片方にしかない論証」の集計からは除外する（二重に数えて分かりにくくなるのを防ぐ）
    const editedTitles = new Set();
    localByTitle.forEach((le, title) => {
      const re = remoteByTitle.get(title);
      if (re && (re.body || '') !== (le.body || '')) editedTitles.add(title);
    });

    const localMap = new Map(localEntries.filter(e => !editedTitles.has(e.title)).map(e => [entryKeyOf(e), e]));
    const remoteMap = new Map(remoteEntries.filter(e => !editedTitles.has(e.title)).map(e => [entryKeyOf(e), e]));
    const onlyLocalTitles = [...localMap.keys()].filter(k => !remoteMap.has(k)).map(k => localMap.get(k).title);
    const onlyRemoteTitles = [...remoteMap.keys()].filter(k => !localMap.has(k)).map(k => remoteMap.get(k).title);

    const localLog = (localData && localData.studyLog) || {};
    const remoteLog = (remoteData && remoteData.studyLog) || {};
    const allLogTitles = new Set([...Object.keys(localLog), ...Object.keys(remoteLog)]);
    const memorizedDiffTitles = [], historyDiffTitles = [];
    allLogTitles.forEach(t => {
      const a = localLog[t] || {}, b = remoteLog[t] || {};
      if (!!a.memorized !== !!b.memorized) memorizedDiffTitles.push(t);
      if ((a.history || []).length !== (b.history || []).length) historyDiffTitles.push(t);
    });

    return {
      localByTitle, remoteByTitle, localLog, remoteLog,
      groups: [
        { kind: 'onlyLocal', icon: '📱', label: 'この端末にしかない論証', titles: onlyLocalTitles },
        { kind: 'onlyRemote', icon: '☁️', label: 'クラウドにしかない論証', titles: onlyRemoteTitles },
        { kind: 'edited', icon: '✏️', label: '同じタイトルで本文の内容が違う論証', titles: [...editedTitles] },
        { kind: 'memorized', icon: '✅', label: '暗記済みフラグが違う論証', titles: memorizedDiffTitles },
        { kind: 'history', icon: '📊', label: '学習回数が違う論証', titles: historyDiffTitles }
      ].filter(g => g.titles.length > 0)
    };
  }
  const DIFF_ROWS_SHOWN_MAX = 20;
  function diffSummaryHtml(diff) {
    if (diff.groups.length === 0) {
      return '<div class="driveSyncConflictDiffEmpty">論証の内容に違いは見つかりませんでした（学習記録以外の項目で差がある可能性があります）。</div>';
    }
    return diff.groups.map(g => {
      const shown = g.titles.slice(0, DIFF_ROWS_SHOWN_MAX);
      const rows = shown.map(t => '<div class="driveSyncDiffRow" data-diff-kind="' + g.kind + '" data-diff-title="' + escHtml(t) + '">'
        + '<span class="driveSyncDiffCaret">▶</span> ' + escHtml(t || '(タイトルなし)')
        + '</div><div class="driveSyncDiffDetail" hidden></div>').join('');
      const more = g.titles.length > shown.length ? '<div class="driveSyncDiffMoreNote">他' + (g.titles.length - shown.length) + '件</div>' : '';
      return '<div class="driveSyncConflictDiffGroup">'
        + '<div class="driveSyncConflictDiffGroupTitle">' + g.icon + ' ' + g.label + ': <strong>' + g.titles.length + '件</strong>（クリックで内容を表示）</div>'
        + rows + more
        + '</div>';
    }).join('');
  }
  function entryDetailHtml(label, entry) {
    if (!entry) return '<div class="driveSyncDiffDetailSide"><div class="driveSyncDiffDetailLabel">' + label + '</div><div class="driveSyncDiffDetailNone">論証なし</div></div>';
    return '<div class="driveSyncDiffDetailSide">'
      + '<div class="driveSyncDiffDetailLabel">' + label + '</div>'
      + '<div class="driveSyncDiffDetailMeta">' + escHtml(entry.subject || '未設定') + ' ／ ' + escHtml(entry.category || '') + '</div>'
      + '<div class="driveSyncDiffDetailText">' + escHtml(entry.body || '(本文なし)') + '</div>'
      + '</div>';
  }
  function logDetailHtml(label, log) {
    const l = log || {};
    return '<div class="driveSyncDiffDetailSide">'
      + '<div class="driveSyncDiffDetailLabel">' + label + '</div>'
      + '<div class="driveSyncDiffDetailMeta">暗記済み: ' + (l.memorized ? '○' : '×') + ' ／ 学習回数: ' + ((l.history || []).length) + '回'
      + (l.history && l.history.length ? '（直近: ' + l.history[l.history.length - 1] + '）' : '') + '</div>'
      + '</div>';
  }
  function renderDiffDetail(diff, kind, title) {
    if (kind === 'onlyLocal') {
      return '<div class="driveSyncDiffDetailCols">' + entryDetailHtml('📱 この端末', diff.localByTitle.get(title)) + '</div>';
    }
    if (kind === 'onlyRemote') {
      return '<div class="driveSyncDiffDetailCols">' + entryDetailHtml('☁️ クラウド', diff.remoteByTitle.get(title)) + '</div>';
    }
    if (kind === 'edited') {
      return '<div class="driveSyncDiffDetailCols">'
        + entryDetailHtml('📱 この端末', diff.localByTitle.get(title))
        + entryDetailHtml('☁️ クラウド', diff.remoteByTitle.get(title))
        + '</div>';
    }
    // memorized / history
    return '<div class="driveSyncDiffDetailCols">'
      + logDetailHtml('📱 この端末', diff.localLog[title])
      + logDetailHtml('☁️ クラウド', diff.remoteLog[title])
      + '</div>';
  }
  function hideSyncConflictModal() {
    const root = document.getElementById('driveSyncConflictModal');
    if (root) root.innerHTML = '';
  }
  function showSyncConflictModal(remoteData, remoteRevision, remoteUpdatedAt) {
    const root = document.getElementById('driveSyncConflictModal');
    if (!root) {
      // モーダル用の要素が無い場合はやむを得ず確認ダイアログで代替する
      const useCloud = confirm('この端末とクラウドの両方でデータが更新されています。\nクラウド側の内容を使いますか？\n（OK＝クラウドを優先／キャンセル＝この端末を優先）');
      if (useCloud) resolveConflictKeepCloud(remoteData, remoteRevision);
      else resolveConflictKeepLocal();
      return;
    }
    const localData = snapshot();
    const diff = computeSyncDiff(localData, remoteData);
    root.innerHTML = '<div class="driveSyncConflictOverlay">'
      + '<div class="driveSyncConflictBox">'
      + '<div class="driveSyncConflictHeader">⚠️ 同期の競合</div>'
      + '<div class="driveSyncConflictBody">'
      + '<p>この端末とクラウドの両方でデータが更新されているため、自動では統合できません。どちらのデータを使うか選んでください。</p>'
      + '<div class="driveSyncConflictDiffTitle">🔍 主な違い</div>'
      + diffSummaryHtml(diff)
      + '<div class="driveSyncConflictCols">'
      + '<div class="driveSyncConflictCol">'
      + '<div class="driveSyncConflictColTitle">📱 この端末</div>'
      + '<div class="driveSyncConflictColMeta">論証 ' + entryCountOf(localData) + '件 ／ 暗記済み ' + memorizedCountOf(localData) + '件</div>'
      + '<div class="driveSyncConflictColMeta">今この端末の状態</div>'
      + '<button type="button" id="driveSyncKeepLocalBtn">この端末のデータを使う</button>'
      + '</div>'
      + '<div class="driveSyncConflictCol">'
      + '<div class="driveSyncConflictColTitle">☁️ クラウド</div>'
      + '<div class="driveSyncConflictColMeta">論証 ' + entryCountOf(remoteData) + '件 ／ 暗記済み ' + memorizedCountOf(remoteData) + '件</div>'
      + '<div class="driveSyncConflictColMeta">最終更新: ' + formatUpdatedAt(remoteUpdatedAt) + '</div>'
      + '<button type="button" id="driveSyncKeepCloudBtn">クラウドのデータを使う</button>'
      + '</div>'
      + '</div>'
      + '<div class="driveSyncConflictHint">選んだ方の内容で、もう片方が上書きされます（学習記録・論証データともに）。あとで「重複チェック」から個別に復元することもできます。</div>'
      + '<span class="driveSyncConflictLaterBtn" id="driveSyncConflictLaterBtn">あとで決める</span>'
      + '</div>'
      + '</div>'
      + '</div>';
    document.getElementById('driveSyncKeepLocalBtn').onclick = () => resolveConflictKeepLocal();
    document.getElementById('driveSyncKeepCloudBtn').onclick = () => resolveConflictKeepCloud(remoteData, remoteRevision);
    document.getElementById('driveSyncConflictLaterBtn').onclick = () => hideSyncConflictModal();
    // 差分の各行をクリックすると、その論証・学習記録の中身を開閉できるようにする
    root.onclick = (e) => {
      const row = e.target.closest ? e.target.closest('.driveSyncDiffRow') : null;
      if (!row) return;
      const detail = row.nextElementSibling;
      if (!detail) return;
      const opening = detail.hasAttribute('hidden');
      if (opening) {
        detail.innerHTML = renderDiffDetail(diff, row.getAttribute('data-diff-kind'), row.getAttribute('data-diff-title'));
        detail.removeAttribute('hidden');
      } else {
        detail.setAttribute('hidden', '');
      }
      const caret = row.querySelector('.driveSyncDiffCaret');
      if (caret) caret.textContent = opening ? '▼' : '▶';
    };
  }
  async function resolveConflictKeepCloud(remoteData, remoteRevision) {
    adoptRemoteWholesale(remoteData, remoteRevision);
    hideSyncConflictModal();
    state('☁️ クラウドのデータを優先しました（' + new Date().toLocaleTimeString() + '）');
  }
  async function resolveConflictKeepLocal() {
    try {
      // 選択の間に更に更新されている可能性があるため、最新のrevisionを取り直してから上書きする
      const r = await fetch(SYNC_URL, { cache: 'no-store' });
      const remote = await r.json();
      const data = snapshot();
      const r2 = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ revision: remote.revision || 0, data })
      });
      const result = await r2.json();
      if (result.ok) {
        revision = result.result.revision;
        localStorage.setItem(REVISION_KEY, String(revision));
        markSynced(data);
        hideSyncConflictModal();
        state('📱 この端末のデータを優先しました（' + new Date().toLocaleTimeString() + '）');
      } else if (result.latest) {
        showSyncConflictModal(result.latest.data, result.latest.revision || 0, result.latest.updatedAt);
      }
    } catch (e) {
      state('保存に失敗しました: ' + e.message);
    }
  }

  async function pushToCloud() {
    const data = snapshot();
    const r = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ revision, data })
    });
    if (!r.ok) throw new Error('保存に失敗しました');
    const result = await r.json();
    if (!result.ok && result.reason === 'conflict') {
      if (result.latest) showSyncConflictModal(result.latest.data, result.latest.revision || 0, result.latest.updatedAt);
      state('⚠️クラウド側で更新があるため、確認が必要です（' + new Date().toLocaleTimeString() + '）');
      return;
    }
    if (!result.ok) throw new Error('保存に失敗しました');
    revision = result.result.revision;
    localStorage.setItem(REVISION_KEY, String(revision));
    markSynced(data);
    state('同期しました（' + new Date().toLocaleTimeString() + '）');
  }

  async function pullFromCloud(isInitial) {
    const r = await fetch(SYNC_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error('クラウドからの取得に失敗しました');
    const remote = await r.json();
    const remoteRevision = remote.revision || 0;
    if (isInitial && remoteRevision === 0 && hasLocalData()) {
      // クラウドが未使用（初回）かつ端末側にデータがある場合は、こちらのデータを送る
      await syncNow();
      return;
    }
    if (remoteRevision === revision) {
      // クラウド側は変わっていない。この端末の変更があれば送る
      if (hasUnsyncedLocalChanges()) { await syncNow(); }
      else { state('同期済み（' + new Date().toLocaleTimeString() + '）'); }
      return;
    }
    if (!hasUnsyncedLocalChanges()) {
      // クラウド側だけが更新されている（この端末はまだ何も変えていない）→ そのまま採用してよい
      adoptRemoteWholesale(remote.data, remoteRevision);
      state('☁️ クラウドの更新を取り込みました（' + new Date().toLocaleTimeString() + '）');
      return;
    }
    // 両方で変わっている＝本当の競合。自動統合はせず、ユーザーに選んでもらう
    showSyncConflictModal(remote.data, remoteRevision, remote.updatedAt);
  }

  async function syncNow() {
    if (syncInFlight) return;
    syncInFlight = true;
    state('同期中…');
    try {
      await pushToCloud();
    } finally {
      syncInFlight = false;
    }
  }

  // インポート処理などデータ変更中は自動同期を一時停止し、
  // 変更が確定する前の状態で上書き保存されるのを防ぐ（syncSuspendedはwindow.ronshoSuspendSyncで制御）
  const queue = () => {
    if (syncSuspended) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow().catch(e => state(e.message)), 1200);
  };

  const AUTO_PULL_INTERVAL_MS = 5 * 60 * 1000;
  const MIN_PULL_GAP_MS = 20 * 1000;
  const LOCAL_CHANGE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
  function maybePullIfIdle() {
    if (syncSuspended || syncInFlight) return;
    if (hasUnsyncedLocalChanges()) return; // 未同期のローカル変更があれば、こちらからは取得しない
    const now = Date.now();
    if (now - lastPullAttempt < MIN_PULL_GAP_MS) return;
    lastPullAttempt = now;
    pullFromCloud(false).catch(() => {});
  }

  // 同期ロジックの自動テスト(tools/sync-test)から直接検証するための公開。アプリの動作には影響しない
  window.__ronshoSyncTest = {
    pushToCloud, pullFromCloud, snapshot, applyRemoteData, adoptRemoteWholesale,
    hasUnsyncedLocalChanges,
    getRevision: () => revision,
    setRevision: (v) => { revision = v; localStorage.setItem(REVISION_KEY, String(v)); },
    getLast: () => last,
    markSynced
  };

  window.addEventListener('load', () => {
    const old = document.getElementById('driveSyncPanel');
    if (old) old.remove();
    const p = document.createElement('div');
    p.id = 'driveSyncPanel';
    p.className = 'driveSyncPanel';
    p.innerHTML = '<button id="driveSyncBtn" type="button">🔄 今すぐ同期</button> <span id="driveSyncState">起動時に自動で同期します</span>'
      + '<button id="pageReloadBtn" type="button" title="このページを最新の状態に読み込み直します">🔄 ページ読込</button>';
    const slot = document.getElementById('driveSyncPanelSlot');
    const row = document.getElementById('topStatusRow');
    if (slot) slot.appendChild(p);
    else if (row) row.appendChild(p);
    else status.after(p);
    document.getElementById('driveSyncBtn').onclick = () => {
      syncNow().catch(e => state(e.message));
    };
    document.getElementById('pageReloadBtn').onclick = () => {
      if (confirm('ページを読み込み直します。保存していない編集内容は失われますが、よろしいですか？')) location.reload();
    };

    pullFromCloud(true).catch(e => state('オフラインで動作中（' + e.message + '）'));

    // ローカル変更を検知したら短い遅延で自動アップロード
    // （タブが非表示の間はスキップし、iPad等での不要なCPU消費を抑える）
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        if (hasUnsyncedLocalChanges()) queue();
      }
    }, LOCAL_CHANGE_CHECK_INTERVAL_MS);

    // 変更が無いときに限り、数分おきに他端末の更新を取り込む安全策
    setInterval(maybePullIfIdle, AUTO_PULL_INTERVAL_MS);

    // タブを再度開いた／フォーカスした直後にも、変更が無ければ最新状態を取り込む
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') maybePullIfIdle();
    });
    window.addEventListener('focus', maybePullIfIdle);
  });
})();
