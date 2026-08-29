/* ▼▼▼ 新規追加：重複チェック機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼ */
const DUP_FUZZY_THRESHOLD = 0.7;
const DUP_TITLE_SIM_THRESHOLD = 0.7;
const DUP_TITLE_SIM_BODY_FLOOR = 0.3;
const DUP_SUBJECT_BUCKET_LIMIT = 1000;
const DUP_RESOLVED_KEY = 'ronshoDupResolvedV1';
const DUP_DIFF_MAX_CELLS = 4000000;
const DUP_SIG_SEP = String.fromCharCode(1);
let dupCheckPairs = [];
let dupResolvedSet = new Set();

function loadDupResolved() {
  try {
    const raw = localStorage.getItem(DUP_RESOLVED_KEY);
    dupResolvedSet = new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    dupResolvedSet = new Set();
  }
}
function saveDupResolved() {
  localStorage.setItem(DUP_RESOLVED_KEY, JSON.stringify([...dupResolvedSet]));
  if (typeof window !== 'undefined' && typeof window.ronshoSyncNotifyChange === 'function') window.ronshoSyncNotifyChange();
}
function dupEntrySignature(e) {
  return (e.title || '') + DUP_SIG_SEP + (e.body || '');
}
function dupPairSignature(a, b) {
  const sa = dupEntrySignature(a), sb = dupEntrySignature(b);
  return sa < sb ? sa + DUP_SIG_SEP + sb : sb + DUP_SIG_SEP + sa;
}
loadDupResolved();

const DUP_ARCHIVE_KEY = 'ronshoDupArchiveV1';
let dupArchiveList = [];
function loadDupArchive() {
  try {
    const raw = localStorage.getItem(DUP_ARCHIVE_KEY);
    dupArchiveList = raw ? JSON.parse(raw) : [];
  } catch (e) {
    dupArchiveList = [];
  }
}
function saveDupArchive() {
  localStorage.setItem(DUP_ARCHIVE_KEY, JSON.stringify(dupArchiveList));
  if (typeof window !== 'undefined' && typeof window.ronshoSyncNotifyChange === 'function') window.ronshoSyncNotifyChange();
}
loadDupArchive();
function dupArchiveEntry(target, reasonLabel) {
  dupArchiveList.unshift({ entry: target, deletedAt: new Date().toISOString(), reason: reasonLabel || '' });
  saveDupArchive();
}
function dupTimeOf(s) { const t = Date.parse(s || ''); return isNaN(t) ? 0 : t; }
// 取り消し済み(復元済み・不活性)の削除記録は一覧に表示しない
function dupIsVisibleArchiveItem(item) { return dupTimeOf(item && item.deletedAt) > dupTimeOf(item && item.revokedAt); }
function dupVisibleArchiveItems() {
  const out = [];
  dupArchiveList.forEach((item, idx) => { if (dupIsVisibleArchiveItem(item)) out.push({ item, idx }); });
  return out;
}
let dupArchiveListVisible = false;
function renderDupArchiveToggle() {
  const btn = document.getElementById('dupArchiveToggleBtn');
  if (!btn) return;
  btn.textContent = (dupArchiveListVisible ? '▼ アーカイブ一覧を隠す' : '▶ アーカイブ一覧を表示する') + '（' + dupVisibleArchiveItems().length + '件）';
}
function renderDupArchive() {
  const wrap = document.getElementById('dupArchiveWrap');
  if (!wrap) return;
  wrap.style.display = dupArchiveListVisible ? '' : 'none';
  renderDupArchiveToggle();
  const visibleItems = dupVisibleArchiveItems();
  if (visibleItems.length === 0) {
    wrap.innerHTML = '<div class="dupCheckEmpty">アーカイブされた論証はありません。</div>';
    return;
  }
  const html = visibleItems.map(({ item, idx }) => {
    const e = item.entry;
    return '<div class="dupArchiveRow" data-archive-idx="' + idx + '">'
      + '<div class="dupArchiveInfo">'
      + '<div class="dupArchiveTitle">' + escapeHtml(e.title) + '</div>'
      + '<div class="dupArchiveMeta">' + escapeHtml(e.subject || '未設定') + ' ／ 削除理由: ' + escapeHtml(item.reason) + ' ／ 削除日時: ' + formatImportedAt(item.deletedAt) + '</div>'
      + '</div>'
      + '<div class="dupArchiveActions">'
      + '<button type="button" class="dupArchiveRestoreBtn" data-archive-idx="' + idx + '">↩️ 復元</button>'
      + '<button type="button" class="dupArchivePurgeBtn" data-archive-idx="' + idx + '">🗑 完全に削除</button>'
      + '</div>'
      + '</div>';
  }).join('');
  wrap.innerHTML = '<div class="dupCheckSummary">' + visibleItems.length + '件のアーカイブがあります。</div>' + html;
}
function dupRestoreArchivedEntry(idx) {
  const item = dupArchiveList[idx];
  if (!item) return;
  const now = new Date().toISOString();
  // 記録を splice で消すのではなく「取り消し済み」の印を付けて残す。
  // 消してしまうと、他端末やクラウドに残った同じ削除記録が同期で戻ってきて、
  // 復元した論証がまた削除されてしまう。restoredAt は同期時に削除記録より
  // 復元の方が新しいことを示す証拠になる
  item.revokedAt = now;
  entries.push({ ...item.entry, restoredAt: now });
  saveEntries();
  saveDupArchive();
  renderDupArchive();
  renderAll();
  status.textContent = '↩️ 「' + item.entry.title + '」を復元しました。';
}
function dupPurgeArchivedEntry(idx) {
  const item = dupArchiveList[idx];
  if (!item) return;
  if (!confirm('「' + item.entry.title + '」をアーカイブから完全に削除しますか？（元に戻せません）')) return;
  dupArchiveList.splice(idx, 1);
  saveDupArchive();
  renderDupArchive();
}

function dupNgrams(str) {
  const s = (str || '').replace(/\s+/g, '');
  if (s.length <= 2) return [s];
  const grams = [];
  for (let i = 0; i <= s.length - 2; i++) grams.push(s.slice(i, i + 2));
  return grams;
}
function dupJaccard(a, b) {
  const sa = new Set(dupNgrams(a));
  const sb = new Set(dupNgrams(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  sa.forEach(g => { if (sb.has(g)) inter++; });
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 1;
}
function dupYearSim(yearA, yearB) {
  const sa = new Set(getYearTokensPlain(yearA));
  const sb = new Set(getYearTokensPlain(yearB));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  sa.forEach(t => { if (sb.has(t)) inter++; });
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 1;
}
function dupCombinedScore(a, b) {
  const titleSim = dupJaccard(a.title, b.title);
  const bodySim = dupJaccard(a.body, b.body);
  const yearSim = dupYearSim(a.year, b.year);
  return titleSim * 0.3 + bodySim * 0.5 + yearSim * 0.2;
}
function findDuplicatePairs() {
  const indexOfEntry = new Map(entries.map((e, i) => [e, i]));
  const pairMap = new Map();
  const addPair = (a, b, reason, score) => {
    if (a === b) return;
    const ia = indexOfEntry.get(a), ib = indexOfEntry.get(b);
    if (ia == null || ib == null) return;
    const key = ia < ib ? ia + '-' + ib : ib + '-' + ia;
    if (!pairMap.has(key)) pairMap.set(key, { a, b, reasons: new Set(), score: 0 });
    const p = pairMap.get(key);
    p.reasons.add(reason);
    if (score != null && score > p.score) p.score = score;
  };

  const norm = s => (s || '').trim();
  const titleGroups = new Map();
  const bodyGroups = new Map();
  entries.forEach(e => {
    const t = norm(e.title);
    if (t) { if (!titleGroups.has(t)) titleGroups.set(t, []); titleGroups.get(t).push(e); }
    const b = norm(e.body);
    if (b) { if (!bodyGroups.has(b)) bodyGroups.set(b, []); bodyGroups.get(b).push(e); }
  });
  titleGroups.forEach(group => { if (group.length > 1) for (let i = 1; i < group.length; i++) addPair(group[0], group[i], 'title', 1); });
  bodyGroups.forEach(group => { if (group.length > 1) for (let i = 1; i < group.length; i++) addPair(group[0], group[i], 'body', 1); });

  const bySubject = new Map();
  entries.forEach(e => {
    const s = e.subject || 'その他';
    if (!bySubject.has(s)) bySubject.set(s, []);
    bySubject.get(s).push(e);
  });
  const DUP_TITLE_PREFIX_MIN_LEN = 6;
  bySubject.forEach(list => {
    if (list.length > DUP_SUBJECT_BUCKET_LIMIT) return;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const score = dupCombinedScore(list[i], list[j]);
        if (score >= DUP_FUZZY_THRESHOLD) addPair(list[i], list[j], 'fuzzy', score);
        // 過去の不完全なインポート等で片方のタイトルが途中で
        // 切れてしまった場合、文章として全く似ていなくても
        // 本文の類似度だけでは検出できないことがあるため、
        // タイトルの前方一致（一定の長さ以上）も重複候補として拾う
        const ta = norm(list[i].title), tb = norm(list[j].title);
        if (ta && tb && ta !== tb && (ta.startsWith(tb) || tb.startsWith(ta))) {
          const shorter = ta.length < tb.length ? ta : tb;
          if (shorter.length >= DUP_TITLE_PREFIX_MIN_LEN) {
            addPair(list[i], list[j], 'title-prefix', Math.max(score, DUP_FUZZY_THRESHOLD));
          }
        }
        // タイトルを修正・言い換えていて完全一致にはならないケースも拾う。
        // ただしタイトルだけで判定すると、無関係な論証同士が短い法律用語を
        // 共有しているだけで誤検出しやすいため、本文にも一定の類似性がある
        // ことを条件にする（本文が全く違う場合は別の論証とみなす）。
        if (ta && tb && ta !== tb) {
          const titleSim = dupJaccard(ta, tb);
          const bodySimForTitle = dupJaccard(list[i].body, list[j].body);
          if (titleSim >= DUP_TITLE_SIM_THRESHOLD && bodySimForTitle >= DUP_TITLE_SIM_BODY_FLOOR) {
            addPair(list[i], list[j], 'title-similar', Math.max(score, titleSim));
          }
        }
      }
    }
  });

  return [...pairMap.values()]
    .filter(p => !dupResolvedSet.has(dupPairSignature(p.a, p.b)))
    .sort((x, y) => y.score - x.score);
}
function dupCharDiffMarks(a, b) {
  const n = a.length, m = b.length;
  if (n === 0 && m === 0) return { aDiff: [], bDiff: [] };
  if (n * m > DUP_DIFF_MAX_CELLS) return null;
  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const aDiff = new Array(n).fill(true);
  const bDiff = new Array(m).fill(true);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      aDiff[i - 1] = false;
      bDiff[j - 1] = false;
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return { aDiff, bDiff };
}
function dupHighlightHtml(str, diffMarks) {
  if (!diffMarks || !str) return escapeHtml(str || '');
  let html = '';
  let i = 0;
  while (i < str.length) {
    const marked = diffMarks[i];
    let j = i;
    while (j < str.length && diffMarks[j] === marked) j++;
    const seg = escapeHtml(str.slice(i, j));
    html += marked ? '<span class="dupDiffMark">' + seg + '</span>' : seg;
    i = j;
  }
  return html;
}
function dupReasonLabel(pair) {
  const labels = [];
  if (pair.reasons.has('title')) labels.push('🏷️ タイトル完全一致');
  if (pair.reasons.has('body')) labels.push('📄 本文完全一致');
  if (pair.reasons.has('fuzzy')) labels.push('🔍 類似度' + Math.round(pair.score * 100) + '%');
  if (pair.reasons.has('title-prefix')) labels.push('✂️ タイトルの前方一致（片方が途中で切れている可能性）');
  if (pair.reasons.has('title-similar')) labels.push('🏷️ タイトルの部分一致（' + Math.round(pair.score * 100) + '%）');
  return labels.join('・');
}
function formatImportedAt(iso) {
  if (!iso) return '不明（旧データ）';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '不明（旧データ）';
  return formatLocalDate(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function dupEntryColHtml(e, pairIdx, side, titleMarks, bodyMarks) {
  const titleHtml = titleMarks ? dupHighlightHtml(e.title || '', titleMarks) : escapeHtml(e.title || '');
  const bodyHtmlOut = bodyMarks ? dupHighlightHtml(e.body || '', bodyMarks) : (e.bodyHtml || escapeHtml(e.body || ''));
  return '<div class="dupEntryCol">'
    + '<div class="dupEntryTitle">' + titleHtml + '</div>'
    + '<div class="dupEntryMeta">' + escapeHtml(e.subject || '未設定') + ' ／ ' + escapeHtml(e.category || '') + ' ／ 出題年: ' + (buildYearHtml(e.year) || 'なし') + '</div>'
    + '<div class="dupEntryMeta">📥 読込日時: ' + formatImportedAt(e.importedAt) + '</div>'
    + '<div class="dupEntryBody">' + bodyHtmlOut + '</div>'
    + '<button type="button" class="dupDeleteOneBtn" data-pair-idx="' + pairIdx + '" data-side="' + side + '">🗑 これだけ削除</button>'
    + '</div>';
}
function renderDuplicateResults() {
  const wrap = document.getElementById('duplicateResultsWrap');
  if (!wrap) return;
  if (dupCheckPairs.length === 0) {
    wrap.innerHTML = '<div class="dupCheckEmpty">重複は見つかりませんでした。</div>';
    return;
  }
  const html = dupCheckPairs.map((pair, idx) => {
    const titleDiff = dupCharDiffMarks(pair.a.title || '', pair.b.title || '');
    const bodyDiff = dupCharDiffMarks(pair.a.body || '', pair.b.body || '');
    return '<div class="dupPairRow" data-pair-idx="' + idx + '">'
      + '<div class="dupPairReason">' + dupReasonLabel(pair) + '</div>'
      + '<div class="dupPairEntries">'
      + dupEntryColHtml(pair.a, idx, 'a', titleDiff && titleDiff.aDiff, bodyDiff && bodyDiff.aDiff)
      + dupEntryColHtml(pair.b, idx, 'b', titleDiff && titleDiff.bDiff, bodyDiff && bodyDiff.bDiff)
      + '</div>'
      + '<div class="dupPairActions">'
      + '<button type="button" class="dupDeleteBothBtn" data-pair-idx="' + idx + '">🗑 両方削除</button>'
      + '<button type="button" class="dupKeepBothBtn" data-pair-idx="' + idx + '">✅ 両方残す</button>'
      + '</div>'
      + '</div>';
  }).join('');
  wrap.innerHTML = '<div class="dupCheckSummary">' + dupCheckPairs.length + '件の重複候補が見つかりました。</div>' + html;
}
function dupDeleteEntry(target) {
  // 重複チェック画面は開いたままになりやすく、その間に同期が走って
  // entries配列が丸ごと入れ替わる(applyRemoteData)と、target(古いオブジェクト
  // 参照)がindexOfで見つからず削除が無言で失敗する。タイトル＋本文一致に
  // フォールバックして、入れ替え後でも対象を見つけられるようにする。
  let idx = entries.indexOf(target);
  if (idx === -1) idx = entries.findIndex(x => x.title === target.title && x.body === target.body);
  if (idx === -1) idx = entries.findIndex(x => x.title === target.title);
  if (idx !== -1) entries.splice(idx, 1);
}
function dupMergeHistoryArrays(a, b) {
  const count = x => (x || []).reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
  const ca = count(a), cb = count(b);
  const days = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort();
  return days.flatMap(d => Array(Math.max(ca[d] || 0, cb[d] || 0)).fill(d));
}
function dupMergeStudyLogInto(keepEntry, dropEntry) {
  const keepTitle = keepEntry.title, dropTitle = dropEntry.title;
  if (keepTitle === dropTitle) return false;
  const dropLog = studyLog[dropTitle];
  if (!dropLog) return false;
  const keepLog = studyLog[keepTitle] || { history: [] };
  studyLog[keepTitle] = {
    ...keepLog,
    history: dupMergeHistoryArrays(keepLog.history, dropLog.history),
    memorized: !!(keepLog.memorized || dropLog.memorized),
    starred: !!(keepLog.starred || dropLog.starred),
    bookmarked: !!(keepLog.bookmarked || dropLog.bookmarked),
    skipped: !!(keepLog.skipped || dropLog.skipped),
    confidence: keepLog.confidence || dropLog.confidence || null,
    memo: keepLog.memo || dropLog.memo || '',
    category: keepLog.category || dropLog.category || keepEntry.category || '',
    subject: keepLog.subject || dropLog.subject || keepEntry.subject || ''
  };
  saveStudyLog();
  return true;
}
// ワードファイルの再読み込みでタイトルや本文が少し変わった論証も、
// 学習記録(学習回数・暗記済みフラグ等)が0件に戻ってしまわないよう、
// 重複チェックと同じ類似度判定(dupCombinedScore)を使って「同じ論証の
// 書き直し」とみなせるものを探し、学習記録を新しいタイトルへ引き継ぐ。
// タイトルが完全一致する場合はstudyLogがそのまま引き継がれるため対象外。
// 誤って別の論証に学習記録を付け替えてしまわないよう、閾値は重複チェックの
// 「重複候補」判定(DUP_FUZZY_THRESHOLD=0.7)よりやや低い程度に留め、かつ
// 同じ科目内でのみ照合する
const REIMPORT_CARRY_OVER_THRESHOLD = 0.65;
// 再読み込み時の「同じ論証の書き直し」判定は、学習記録の引き継ぎ・手動書式の
// 引き継ぎのどちらでも同じ考え方(同じ科目内でdupCombinedScoreが最も高い、
// まだ他の照合で使われていない新しい論証を選ぶ)を使うため、探索部分だけ共通化する
function findBestReimportMatch(oldE, newEntries, isNewEntryUsed) {
  let best = null, bestScore = 0;
  newEntries.forEach(newE => {
    if (isNewEntryUsed(newE)) return;
    if ((newE.subject || 'その他') !== (oldE.subject || 'その他')) return;
    const score = dupCombinedScore(oldE, newE);
    if (score > bestScore) { bestScore = score; best = newE; }
  });
  return bestScore >= REIMPORT_CARRY_OVER_THRESHOLD ? best : null;
}
function carryOverStudyLogOnReimport(oldEntries, newEntries) {
  const newTitleSet = new Set(newEntries.map(e => e.title));
  const usedNewTitles = new Set();
  let carriedCount = 0;
  oldEntries.forEach(oldE => {
    if (newTitleSet.has(oldE.title)) return; // タイトル完全一致ならそのまま引き継がれる
    const oldLog = studyLog[oldE.title];
    if (!oldLog) return; // 学習記録が無ければ引き継ぐものが無い
    const best = findBestReimportMatch(oldE, newEntries, newE => usedNewTitles.has(newE.title));
    if (!best) return;
    usedNewTitles.add(best.title);
    const newLog = studyLog[best.title];
    studyLog[best.title] = newLog ? {
      ...newLog,
      history: dupMergeHistoryArrays(newLog.history, oldLog.history),
      memorized: !!(newLog.memorized || oldLog.memorized),
      starred: !!(newLog.starred || oldLog.starred),
      bookmarked: !!(newLog.bookmarked || oldLog.bookmarked),
      skipped: !!(newLog.skipped || oldLog.skipped),
      confidence: newLog.confidence || oldLog.confidence || null,
      memo: newLog.memo || oldLog.memo || ''
    } : oldLog;
    delete studyLog[oldE.title];
    carriedCount++;
  });
  return carriedCount;
}
// ワードファイルの再読み込みで、論証の直接編集機能(entry-edit.js)を使って
// 手動で色付け・太字にした文言が消えてしまわないよう、学習記録と同じ
// 類似度判定(dupCombinedScore)で「同じ論証の書き直し」とみなせる相手を
// 見つけ、そちらへ書式を引き継ぐ。手動で編集したことがある論証
// (hasManualBodyEdit)だけを対象とする。それ以外はワード文書の色付けが
// 読み込みのたびに新しい内容から作り直されるだけなので、ここでは触らない
function bodyHtmlToStyledChars(html) {
  const chars = [];
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const walk = (node, color, bold) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        for (const ch of child.textContent) chars.push({ ch: ch, color: color, bold: bold });
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'br') { chars.push({ ch: '\n', color: null, bold: false }); return; }
        let nextColor = color, nextBold = bold;
        if (tag === 'span' && child.style && child.style.color) {
          nextColor = (typeof editRgbToHex === 'function' ? editRgbToHex(child.style.color) : null) || color;
        }
        if (tag === 'b' || tag === 'strong') nextBold = true;
        walk(child, nextColor, nextBold);
      }
    });
  };
  walk(tmp, null, false);
  return chars;
}
function styledCharsToBodyHtml(chars) {
  const lines = [];
  let current = [];
  chars.forEach(c => {
    if (c.ch === '\n') { lines.push(current); current = []; }
    else current.push(c);
  });
  lines.push(current);
  return lines.map(lineChars => {
    let html = '';
    let i = 0;
    while (i < lineChars.length) {
      const color = lineChars[i].color, bold = lineChars[i].bold;
      let j = i;
      while (j < lineChars.length && lineChars[j].color === color && lineChars[j].bold === bold) j++;
      let seg = escapeHtml(lineChars.slice(i, j).map(c => c.ch).join(''));
      if (bold) seg = '<b>' + seg + '</b>';
      if (color) seg = '<span style="color:' + color + ';">' + seg + '</span>';
      html += seg;
      i = j;
    }
    return html;
  }).join('<br>');
}
// dupCharDiffMarksと同じLCSだが、差分の位置だけでなく、一致した文字同士の
// 対応関係(どのoldの文字がどのnewの文字に対応するか)が欲しいのでpairsで返す
function computeLcsAlignment(a, b) {
  const n = a.length, m = b.length;
  if (n * m > DUP_DIFF_MAX_CELLS) return null;
  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const pairs = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  pairs.reverse();
  return pairs;
}
function reapplyManualHighlights(oldBodyHtml, newBodyHtml) {
  const oldChars = bodyHtmlToStyledChars(oldBodyHtml);
  const newChars = bodyHtmlToStyledChars(newBodyHtml);
  const oldPlain = oldChars.map(c => c.ch).join('');
  const newPlain = newChars.map(c => c.ch).join('');
  // ワード文書側で新しく色・太字が設定された場合はそちらを優先する
  // （新しい書式が既に付いている文字は上書きしない）。旧の書式は、
  // 新しい解析結果には書式が無い箇所を補う形でのみ復元する
  const hasNewStyle = c => !!(c.color || c.bold);
  if (oldPlain === newPlain) {
    let changed = false;
    for (let i = 0; i < newChars.length; i++) {
      if (hasNewStyle(newChars[i])) continue;
      if (oldChars[i].color || oldChars[i].bold) {
        newChars[i].color = oldChars[i].color;
        newChars[i].bold = oldChars[i].bold;
        changed = true;
      }
    }
    return changed ? styledCharsToBodyHtml(newChars) : null;
  }
  const pairs = computeLcsAlignment(oldPlain, newPlain);
  if (!pairs) return null;
  let changed = false;
  pairs.forEach(([oi, ni]) => {
    if (hasNewStyle(newChars[ni])) return;
    if (oldChars[oi].color || oldChars[oi].bold) {
      newChars[ni].color = oldChars[oi].color;
      newChars[ni].bold = oldChars[oi].bold;
      changed = true;
    }
  });
  if (!changed) return null;
  return styledCharsToBodyHtml(newChars);
}
function carryOverManualHighlightsOnReimport(oldEntries, newEntries) {
  const newByTitle = new Map(newEntries.map(e => [e.title, e]));
  const usedNewEntries = new Set();
  let carriedCount = 0;
  oldEntries.forEach(oldE => {
    if (!oldE.hasManualBodyEdit || !oldE.bodyHtml) return;
    let matched = newByTitle.get(oldE.title);
    if (matched && usedNewEntries.has(matched)) matched = null;
    if (!matched) matched = findBestReimportMatch(oldE, newEntries, newE => usedNewEntries.has(newE));
    if (!matched) return;
    usedNewEntries.add(matched);
    const reapplied = reapplyManualHighlights(oldE.bodyHtml, matched.bodyHtml || escapeHtml(matched.body || ''));
    if (reapplied == null) return;
    matched.bodyHtml = reapplied;
    matched.hasManualBodyEdit = true;
    carriedCount++;
  });
  return carriedCount;
}
function dupRemovePairsReferencing(target) {
  dupCheckPairs = dupCheckPairs.filter(p => p.a !== target && p.b !== target);
}
// 「これだけ削除」の本体。残す側と同期キー([タイトル, 本文])が同一の場合は削除記録を作らない。
// 同一キーの削除記録は、同期時に残した側まで道連れで消すうえ、過去に同じキーで行った
// 意図的な削除の記録まで(取り消し扱いで)打ち消してしまう。完全一致のコピーは
// 同期の統合が自動的に1件へ畳むため、復活防止の記録自体が不要
function dupDeleteOneFromPair(pair, target, kept) {
  const isExactMatch = pair.reasons.has('title') || pair.reasons.has('body');
  const sameKey = [target.title, target.body].join('|') === [kept.title, kept.body].join('|');
  const carried = dupMergeStudyLogInto(kept, target);
  if (!sameKey) dupArchiveEntry(target, dupReasonLabel(pair));
  dupDeleteEntry(target);
  saveEntries();
  if (isExactMatch) {
    dupResolvedSet.add(dupPairSignature(pair.a, pair.b));
    saveDupResolved();
  }
  dupRemovePairsReferencing(target);
  return { carried, sameKey };
}
document.getElementById('checkDuplicatesBtn').addEventListener('click', () => {
  const wrap = document.getElementById('duplicateResultsWrap');
  if (entries.length === 0) {
    wrap.innerHTML = '<div class="dupCheckEmpty">まずはWordファイルを読み込んでください。</div>';
    return;
  }
  wrap.innerHTML = '<div class="dupCheckEmpty">🔍 チェック中…</div>';
  setTimeout(() => {
    dupCheckPairs = findDuplicatePairs();
    renderDuplicateResults();
  }, 30);
});
document.getElementById('resetImportedAtBtn').addEventListener('click', () => {
  if (!confirm('読込日時をすべて「不明」に戻しますか？（実際のWord取込日時が記録されていない論証には、正確な日時の代わりに一律の日時が表示されている場合があります。このボタンでリセットすると、以後は新しく取り込んだ論証のみ正しい読込日時が表示されます）')) return;
  entries.forEach(e => { delete e.importedAt; });
  saveEntries();
  status.textContent = '🕒 読込日時をリセットしました。';
});
document.getElementById('duplicateResultsWrap').addEventListener('click', (e) => {
  const deleteOneBtn = e.target.closest('.dupDeleteOneBtn');
  if (deleteOneBtn) {
    const pairIdx = Number(deleteOneBtn.dataset.pairIdx);
    const pair = dupCheckPairs[pairIdx];
    if (!pair) return;
    const target = deleteOneBtn.dataset.side === 'a' ? pair.a : pair.b;
    const kept = target === pair.a ? pair.b : pair.a;
    const willCarryOver = target.title !== kept.title && !!studyLog[target.title];
    const confirmMsg = '「' + target.title + '」を削除しますか？'
      + (willCarryOver ? '（学習記録は「' + kept.title + '」に引き継がれます）' : '（学習記録は削除されません）');
    if (!confirm(confirmMsg)) return;
    const { carried, sameKey } = dupDeleteOneFromPair(pair, target, kept);
    renderDuplicateResults();
    renderDupArchive();
    renderAll();
    status.textContent = carried
      ? '🗑 「' + target.title + '」を削除し、学習記録を「' + kept.title + '」に引き継ぎました（アーカイブに保管済み）。'
      : sameKey
        ? '🗑 「' + target.title + '」を削除しました（同じ内容のもう1件はそのまま残ります）。'
        : '🗑 「' + target.title + '」を削除しました（アーカイブに保管済み）。';
    return;
  }
  const deleteBothBtn = e.target.closest('.dupDeleteBothBtn');
  if (deleteBothBtn) {
    const pairIdx = Number(deleteBothBtn.dataset.pairIdx);
    const pair = dupCheckPairs[pairIdx];
    if (!pair) return;
    if (!confirm('「' + pair.a.title + '」と「' + pair.b.title + '」の両方を削除しますか？（学習記録は削除されません）')) return;
    const isExactMatch = pair.reasons.has('title') || pair.reasons.has('body');
    const reasonLabel = dupReasonLabel(pair);
    dupArchiveEntry(pair.a, reasonLabel);
    dupArchiveEntry(pair.b, reasonLabel);
    dupDeleteEntry(pair.a);
    dupDeleteEntry(pair.b);
    saveEntries();
    if (isExactMatch) {
      dupResolvedSet.add(dupPairSignature(pair.a, pair.b));
      saveDupResolved();
    }
    dupRemovePairsReferencing(pair.a);
    dupRemovePairsReferencing(pair.b);
    renderDuplicateResults();
    renderDupArchive();
    renderAll();
    status.textContent = '🗑 2件を削除しました（アーカイブに保管済み）。';
    return;
  }
  const keepBothBtn = e.target.closest('.dupKeepBothBtn');
  if (keepBothBtn) {
    const pairIdx = Number(keepBothBtn.dataset.pairIdx);
    const pair = dupCheckPairs[pairIdx];
    if (pair) {
      dupResolvedSet.add(dupPairSignature(pair.a, pair.b));
      saveDupResolved();
    }
    dupCheckPairs.splice(pairIdx, 1);
    renderDuplicateResults();
  }
});
const dupArchiveWrapEl = document.getElementById('dupArchiveWrap');
if (dupArchiveWrapEl) {
  dupArchiveWrapEl.addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('.dupArchiveRestoreBtn');
    if (restoreBtn) {
      dupRestoreArchivedEntry(Number(restoreBtn.dataset.archiveIdx));
      return;
    }
    const purgeBtn = e.target.closest('.dupArchivePurgeBtn');
    if (purgeBtn) {
      dupPurgeArchivedEntry(Number(purgeBtn.dataset.archiveIdx));
      return;
    }
  });
}
/* ▲▲▲ 新規追加：重複チェック機能 ここまで ▲▲▲ */
