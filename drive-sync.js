(() => {
  const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyB-3irASAEN6amf2QIN74WQNhF4winF8LwO_gfYDFkW4JLw0cTHTUyOHfoPis7Sof5/exec';
  const REVISION_KEY = 'ronshoSyncRevisionV1';
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
  let last = '';
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

  // --- 端末間の学習記録・論証データを安全に統合するためのマージ処理 ---
  // 「1人が同時に1台だけ使う」前提でも、複数端末を日をまたいで使い分けると
  // 各端末が独自に学習記録を積み上げる期間が生まれる。単純に新しい方で
  // 丸ごと上書きすると、片方の端末の学習成果が消えてしまうため、
  // 論証データ・学習記録は端末間で統合（マージ）してから保存する。
  const entryKeyOf = e => [e && e.title, e && e.body].filter(Boolean).join('|') || JSON.stringify(e);
  function unionEntries(a, b) {
    const m = new Map();
    (a || []).forEach(e => m.set(entryKeyOf(e), e));
    (b || []).forEach(e => m.set(entryKeyOf(e), e));
    return [...m.values()];
  }
  function mergeHistory(a, b) {
    const count = x => (x || []).reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
    const ca = count(a), cb = count(b);
    const days = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort();
    return days.flatMap(d => Array(Math.max(ca[d] || 0, cb[d] || 0)).fill(d));
  }
  function mergeStudyLog(a, b) {
    const out = { ...(a || {}) };
    for (const [title, v] of Object.entries(b || {})) {
      const o = out[title] || {};
      out[title] = {
        ...o, ...v,
        history: mergeHistory(o.history, v.history),
        memorized: !!(o.memorized || v.memorized),
        starred: !!(o.starred || v.starred),
        weak: !!(o.weak || v.weak),
        skipped: !!(o.skipped || v.skipped),
        bookmarked: !!(o.bookmarked || v.bookmarked),
        confidence: v.confidence || o.confidence || null,
        memo: v.memo || o.memo || '',
        category: v.category || o.category || '',
        subject: v.subject || o.subject || ''
      };
    }
    return out;
  }
  function mergeDailyStats(a, b) {
    const out = { ...(a || {}) };
    for (const [d, c] of Object.entries(b || {})) out[d] = Math.max(out[d] || 0, c);
    return out;
  }
  function mergeManualLog(a, b) {
    const out = { ...(a || {}) };
    for (const [d, v] of Object.entries(b || {})) out[d] = [...new Set([...(out[d] || []), ...(v || [])])];
    return out;
  }
  function mergeByKey(a, b, keyFn) {
    const m = new Map();
    (a || []).forEach(x => m.set(keyFn(x), x));
    (b || []).forEach(x => m.set(keyFn(x), x));
    return [...m.values()];
  }
  function reconcile(remoteData) {
    remoteData = remoteData || {};
    return {
      schemaVersion: 4,
      entries: unionEntries(remoteData.entries, getEntries()),
      studyLog: mergeStudyLog(remoteData.studyLog, read(STUDYLOG_KEY, {})),
      manualLog: mergeManualLog(remoteData.manualLog, read(MANUALLOG_KEY, {})),
      pastExamLogs: mergeByKey(remoteData.pastExamLogs, read(PASTEXAM_KEY, []), x => x.key || JSON.stringify(x)),
      countdowns: mergeByKey(remoteData.countdowns, read(COUNTDOWN_KEY, []), x => x.id || JSON.stringify(x)),
      dupArchive: mergeByKey(remoteData.dupArchive, read(DUPARCHIVE_KEY, []), x => [x && x.entry && x.entry.title, x && x.entry && x.entry.body].join('|')),
      dupResolved: [...new Set([...(remoteData.dupResolved || []), ...read(DUPRESOLVED_KEY, [])])],
      speechDict: mergeByKey(remoteData.speechDict, read(SPEECHDICT_KEY, []), x => x.word),
      dailyStats: mergeDailyStats(remoteData.dailyStats, read(DAILYSTATS_KEY, {})),
      dailyGoal: remoteData.dailyGoal != null ? remoteData.dailyGoal : read(DAILYGOAL_KEY, null)
    };
  }

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

  async function pushToCloud(retriesLeft = 2, overrideData = null) {
    const data = overrideData || snapshot();
    const r = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ revision, data })
    });
    if (!r.ok) throw new Error('保存に失敗しました');
    const result = await r.json();
    if (!result.ok && result.reason === 'conflict') {
      const remoteData = result.latest.data;
      const remoteRevision = result.latest.revision || 0;
      if (retriesLeft > 0) {
        const reconciled = reconcile(remoteData);
        revision = remoteRevision;
        return pushToCloud(retriesLeft - 1, reconciled);
      }
      revision = remoteRevision;
      localStorage.setItem(REVISION_KEY, String(revision));
      applyRemoteData(remoteData);
      last = JSON.stringify(snapshot());
      state('⚠️同期が競合したため最新データを読み込みました。もう一度操作をお試しください（' + new Date().toLocaleTimeString() + '）');
      return;
    }
    if (!result.ok) throw new Error('保存に失敗しました');
    revision = result.result.revision;
    localStorage.setItem(REVISION_KEY, String(revision));
    applyRemoteData(data);
    last = JSON.stringify(snapshot());
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
    if (!hasLocalData()) {
      // この端末にまだ何もない場合はマージ不要でそのまま採用
      revision = remoteRevision;
      localStorage.setItem(REVISION_KEY, String(revision));
      applyRemoteData(remote.data);
      last = JSON.stringify(snapshot());
      state('同期済み（' + new Date().toLocaleTimeString() + '）');
      return;
    }
    // 端末側とクラウド側の両方にデータがある場合は統合してから保存する
    const reconciled = reconcile(remote.data);
    revision = remoteRevision;
    await pushToCloud(2, reconciled);
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
    if (JSON.stringify(snapshot()) !== last) return; // 未同期のローカル変更があれば取得しない
    const now = Date.now();
    if (now - lastPullAttempt < MIN_PULL_GAP_MS) return;
    lastPullAttempt = now;
    pullFromCloud(false).catch(() => {});
  }

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
        const n = JSON.stringify(snapshot());
        if (n !== last) queue();
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
