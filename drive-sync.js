(() => {
  const CLIENT_ID = '1008108195377-3i95ujevlk1keuf02tcitnuikniie9al.apps.googleusercontent.com';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const NAME = 'ronsho-app-sync-v1.json';
  const DRIVE_ID = 'ronshoDriveSyncFileIdV1';
  const ENTRY_KEY = 'ronshoEntries';
  const STUDYLOG_KEY = 'ronshoStudyLog';
  const MANUALLOG_KEY = 'ronshoManualLog';
  const PASTEXAM_KEY = 'ronshoPastExamLogs_v1';
  const COUNTDOWN_KEY = 'ronshoCountdowns_v1';
  const DUPARCHIVE_KEY = 'ronshoDupArchiveV1';
  const DUPRESOLVED_KEY = 'ronshoDupResolvedV1';
  const SPEECHDICT_KEY = 'ronshoSpeechDictV1';
  const DAILYSTATS_KEY = 'ronshoDailyStatsV1';
  const CONFLICT_KEY = 'ronshoSyncConflictsV1';
  let token = '', timer, last = '';

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)) } catch (_) { return d } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const getEntries = () => read(ENTRY_KEY, []);
  const entryKey = x => x?.id || [x?.title, x?.body].filter(Boolean).join('|') || JSON.stringify(x);
  const unique = a => { const m = new Map(); for (const x of a || []) m.set(entryKey(x), x); return [...m.values()] };
  const state = t => { const e = document.getElementById('driveSyncState'); if (e) e.textContent = t };
  const updateSyncBtnLabel = () => { const b = document.getElementById('driveSyncBtn'); if (b) b.textContent = token ? '🔄 今すぐ同期' : '☁️ Google Driveに接続'; };

  const stableStringify = v => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  };
  const sameSet = (a, b) => {
    const sa = (a || []).map(stableStringify).sort();
    const sb = (b || []).map(stableStringify).sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  };
  const manualLogChanged = (merged, local) => {
    const mk = Object.keys(merged || {}), lk = Object.keys(local || {});
    if (mk.length !== lk.length) return true;
    return mk.some(k => !(k in local) || !sameSet(merged[k], local[k]));
  };

  const snapshot = () => ({
    schemaVersion: 3,
    updatedAt: new Date().toISOString(),
    entries: getEntries(),
    studyLog: read(STUDYLOG_KEY, {}),
    manualLog: read(MANUALLOG_KEY, {}),
    pastExamLogs: read(PASTEXAM_KEY, []),
    countdowns: read(COUNTDOWN_KEY, []),
    dupArchive: read(DUPARCHIVE_KEY, []),
    dupResolved: read(DUPRESOLVED_KEY, []),
    speechDict: read(SPEECHDICT_KEY, []),
    dailyStats: read(DAILYSTATS_KEY, {})
  });

  const mergeHistory = (a, b) => {
    const count = x => (x || []).reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
    const ca = count(a), cb = count(b);
    const days = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort();
    return days.flatMap(d => Array(Math.max(ca[d] || 0, cb[d] || 0)).fill(d));
  };
  const mergeLog = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b || {})) {
      const o = out[k] || {};
      out[k] = { ...o, ...v, history: mergeHistory(o.history, v.history), memorized: !!(o.memorized || v.memorized), starred: !!(o.starred || v.starred), weak: !!(o.weak || v.weak), bookmarked: !!(o.bookmarked || v.bookmarked), confidence: v.confidence || o.confidence || null, memo: v.memo || o.memo || '' };
    }
    return out;
  };

  let lastChanged = [];

  const merge = remote => {
    const local = snapshot();
    lastChanged = [];

    const archiveKey = x => [x?.entry?.title, x?.entry?.body].filter(Boolean).join('|') || JSON.stringify(x);
    const dupArchive = new Map([...(remote.dupArchive || []), ...(local.dupArchive || [])].map(x => [archiveKey(x), x]));
    const mergedDupArchive = [...dupArchive.values()];
    const deletedTitleBodySet = new Set(mergedDupArchive.map(x => [x?.entry?.title, x?.entry?.body].join('|')));

    const remoteEntries = remote.entries || Object.values(remote.fileBuckets || {}).flat();
    const mergedEntries = unique([...(remoteEntries || []), ...local.entries])
      .filter(e => !deletedTitleBodySet.has([e.title, e.body].join('|')));
    if (!sameSet(mergedEntries, local.entries)) lastChanged.push('論証データ');
    write(ENTRY_KEY, mergedEntries);

    const mergedDupResolvedEarly = [...new Set([...(remote.dupResolved || []), ...(local.dupResolved || [])])];
    const mergedDupResolvedSet = new Set(mergedDupResolvedEarly);
    const isTitleGroupFullyResolved = (title) => {
      if (typeof dupPairSignature !== 'function') return false;
      const group = mergedEntries.filter(e => e.title === title);
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (!mergedDupResolvedSet.has(dupPairSignature(group[i], group[j]))) return false;
        }
      }
      return true;
    };
    const titleCount = list => { const m = {}; (list || []).forEach(x => { m[x.title] = (m[x.title] || 0) + 1 }); return m };
    const localTitleCounts = titleCount(local.entries);
    const mergedTitleCounts = titleCount(mergedEntries);
    const stillDuplicated = new Set(Object.keys(mergedTitleCounts).filter(t => mergedTitleCounts[t] > 1));
    const newlyConflicted = Object.keys(mergedTitleCounts).filter(t => mergedTitleCounts[t] > (localTitleCounts[t] || 0) && mergedTitleCounts[t] > 1);
    const prevConflicts = read(CONFLICT_KEY, []);
    const conflictTitles = [...new Set([...prevConflicts.filter(t => stillDuplicated.has(t)), ...newlyConflicted])]
      .filter(t => !isTitleGroupFullyResolved(t));
    if (conflictTitles.length) lastChanged.push('⚠️編集競合(' + conflictTitles.length + '件)');
    write(CONFLICT_KEY, conflictTitles);
    try { entries = mergedEntries } catch (_) {}

    const study = mergeLog(remote.studyLog || {}, local.studyLog || {});
    if (stableStringify(study) !== stableStringify(local.studyLog || {})) lastChanged.push('学習記録');
    write(STUDYLOG_KEY, study);
    try { studyLog = study } catch (_) {}

    const manual = { ...(remote.manualLog || {}) };
    for (const [d, v] of Object.entries(local.manualLog || {})) manual[d] = unique([...(manual[d] || []), ...v]);
    if (manualLogChanged(manual, local.manualLog || {})) lastChanged.push('学習カレンダー記録');
    write(MANUALLOG_KEY, manual);
    try { manualLog = manual } catch (_) {}

    const exams = new Map([...(remote.pastExamLogs || []), ...(local.pastExamLogs || [])].map(x => [x.key || JSON.stringify(x), x]));
    const mergedExams = [...exams.values()];
    if (!sameSet(mergedExams, local.pastExamLogs)) lastChanged.push('過去問ログ');
    write(PASTEXAM_KEY, mergedExams);

    const countdowns = new Map([...(remote.countdowns || []), ...(local.countdowns || [])].map(x => [x.id || JSON.stringify(x), x]));
    const mergedCountdowns = [...countdowns.values()];
    if (!sameSet(mergedCountdowns, local.countdowns)) lastChanged.push('カウントダウン');
    write(COUNTDOWN_KEY, mergedCountdowns);

    if (!sameSet(mergedDupArchive, local.dupArchive)) lastChanged.push('重複チェックアーカイブ');
    write(DUPARCHIVE_KEY, mergedDupArchive);
    try { dupArchiveList = mergedDupArchive } catch (_) {}

    const mergedDupResolved = mergedDupResolvedEarly;
    if (!sameSet(mergedDupResolved, local.dupResolved)) lastChanged.push('重複チェック履歴');
    write(DUPRESOLVED_KEY, mergedDupResolved);
    try { dupResolvedSet = new Set(mergedDupResolved) } catch (_) {}

    const dictKey = x => x?.word;
    const speechDict = new Map([...(remote.speechDict || []), ...(local.speechDict || [])].map(x => [dictKey(x), x]));
    const mergedSpeechDict = [...speechDict.values()];
    if (!sameSet(mergedSpeechDict, local.speechDict)) lastChanged.push('読み方辞書');
    write(SPEECHDICT_KEY, mergedSpeechDict);
    try { speechDict = mergedSpeechDict } catch (_) {}

    const dailyStats = { ...(remote.dailyStats || {}) };
    for (const [d, c] of Object.entries(local.dailyStats || {})) dailyStats[d] = Math.max(dailyStats[d] || 0, c);
    if (stableStringify(dailyStats) !== stableStringify(local.dailyStats || {})) lastChanged.push('今日の伸びしろ記録');
    write(DAILYSTATS_KEY, dailyStats);

    if (typeof saveEntries === 'function') saveEntries();
    if (typeof renderAll === 'function') renderAll(true);
    if (typeof renderCountdownCard === 'function') renderCountdownCard();
    if (typeof renderDupArchive === 'function') renderDupArchive();
    if (typeof renderSpeechDictList === 'function') renderSpeechDictList();
    return snapshot();
  };

  async function fileId() {
    let i = localStorage.getItem(DRIVE_ID);
    if (i) return i;
    const q = encodeURIComponent("name = '" + NAME + "' and trashed = false");
    const r = await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)', { headers: { Authorization: 'Bearer ' + token } });
    const files = (await r.json()).files || [];
    i = files[0]?.id;
    if (i) localStorage.setItem(DRIVE_ID, i);
    return i;
  }

  async function push(data = snapshot()) {
    if (!token) return;
    const i = await fileId(), b = 'ronsho';
    const meta = JSON.stringify(i ? { name: NAME } : { name: NAME, mimeType: 'application/json' });
    const body = '--' + b + '\r\nContent-Type: application/json\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(data) + '\r\n--' + b + '--';
    const url = i ? 'https://www.googleapis.com/upload/drive/v3/files/' + i + '?uploadType=multipart' : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const r = await fetch(url, { method: i ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + b }, body });
    if (!r.ok) throw Error('Driveへの保存に失敗しました');
    const out = await r.json();
    localStorage.setItem(DRIVE_ID, out.id || i);
    last = JSON.stringify(snapshot());
    const time = new Date().toLocaleTimeString();
    state(lastChanged.length ? '同期しました：' + lastChanged.join('・') + '（' + time + '）' : '同期済み（' + time + '）');
  }

  async function syncMerged() {
    lastChanged = [];
    const i = await fileId();
    let data = snapshot();
    if (i) {
      const x = await fetch('https://www.googleapis.com/drive/v3/files/' + i + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
      if (x.ok) data = merge(await x.json());
    }
    await push(data);
  }

  const queue = () => { clearTimeout(timer); timer = setTimeout(() => syncMerged().catch(e => state(e.message)), 1200) };

  async function connect(prompt = 'consent') {
    if (prompt) state('Googleログインを開いています…');
    if (!window.google) {
      await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = ok; s.onerror = no; document.head.appendChild(s) });
    }
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE, callback: async r => {
        if (r.error) { if (!prompt) state('未接続'); else state('認証に失敗しました'); return }
        token = r.access_token;
        localStorage.setItem('ronshoDriveSyncAuthorizedV1', '1');
        updateSyncBtnLabel();
        try { await syncMerged() } catch (e) { state(e.message) }
      }
    }).requestAccessToken({ prompt });
  }

  const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
  const MIN_SYNC_GAP_MS = 20 * 1000;
  const isAuthorized = () => localStorage.getItem('ronshoDriveSyncAuthorizedV1') === '1';
  let lastSyncAttempt = 0;

  function periodicSync() {
    if (!isAuthorized()) return;
    const now = Date.now();
    if (now - lastSyncAttempt < MIN_SYNC_GAP_MS) return;
    lastSyncAttempt = now;
    if (token) {
      syncMerged().catch(e => state(e.message));
    } else {
      connect('').catch(() => {});
    }
  }

  window.addEventListener('load', () => {
    const old = document.getElementById('driveSyncPanel');
    if (old) old.remove();
    const p = document.createElement('div');
    p.id = 'driveSyncPanel';
    p.className = 'driveSyncPanel';
    p.innerHTML = '<button id="driveSyncBtn" type="button">☁️ Google Driveに接続</button> <span id="driveSyncState">未接続</span>'
      + '<button id="pageReloadBtn" type="button" title="このページを最新の状態に読み込み直します">🔄 ページ読込</button>';
    const slot = document.getElementById('driveSyncPanelSlot');
    const row = document.getElementById('topStatusRow');
    if (slot) slot.appendChild(p);
    else if (row) row.appendChild(p);
    else status.after(p);
    document.getElementById('driveSyncBtn').onclick = async () => {
      try {
        if (token) await syncMerged();
        else await connect('consent');
      } catch (e) { state(e.message) }
    };
    document.getElementById('pageReloadBtn').onclick = () => {
      if (confirm('ページを読み込み直します。保存していない編集内容は失われますが、よろしいですか？')) location.reload();
    };
    if (isAuthorized()) connect('').catch(() => {});

    // ローカル変更を検知したら短い遅延で自動アップロード
    setInterval(() => {
      if (token) {
        const n = JSON.stringify(snapshot());
        if (n !== last) queue();
      }
    }, 3000);

    // 変更の有無に関わらず、数分おきに他端末の更新も取り込む安全策の自動同期
    setInterval(periodicSync, AUTO_SYNC_INTERVAL_MS);

    // タブを再度開いた／フォーカスした直後にも最新状態を取り込む
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') periodicSync();
    });
    window.addEventListener('focus', periodicSync);
  });
})();
