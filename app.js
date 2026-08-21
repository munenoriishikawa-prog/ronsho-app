const drop = document.getElementById('drop');
const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');
const tableWrap = document.getElementById('tableWrap');
const memorizedTableWrap = document.getElementById('memorizedTableWrap');
const csvTableWrap = document.getElementById('csvTableWrap');
const csvSubjectFilter = document.getElementById('csvSubjectFilter');
const calendarWrap = document.getElementById('calendarWrap');
const trendWrap = document.getElementById('trendWrap');
const downloadBtn = document.getElementById('downloadBtn');
const downloadLogBtn = document.getElementById('downloadLogBtn');
const subjectTabsStudy = document.getElementById('subjectTabsStudy');
const subjectTabsMemorized = document.getElementById('subjectTabsMemorized');
const subjectTabsQuiz = document.getElementById('subjectTabsQuiz');
const categoryTabsStudy = document.getElementById('categoryTabsStudy');
const categoryTabsMemorized = document.getElementById('categoryTabsMemorized');
const categoryTabsQuiz = document.getElementById('categoryTabsQuiz');
const starTabsStudy = document.getElementById('starTabsStudy');
const starTabsMemorized = document.getElementById('starTabsMemorized');
const starTabsQuiz = document.getElementById('starTabsQuiz');
const importanceTabsStudy = document.getElementById('importanceTabsStudy');
const importanceTabsMemorized = document.getElementById('importanceTabsMemorized');
const importanceTabsQuiz = document.getElementById('importanceTabsQuiz');
const freqTabsStudy = document.getElementById('freqTabsStudy');
const freqTabsMemorized = document.getElementById('freqTabsMemorized');
const searchInputStudy = document.getElementById('searchInputStudy');
const searchInputMemorized = document.getElementById('searchInputMemorized');
const searchCountStudy = document.getElementById('searchCountStudy');
const searchCountMemorized = document.getElementById('searchCountMemorized');
const quizArea = document.getElementById('quizArea');
const quizPriorityNote = document.getElementById('quizPriorityNote');
const quizIncludeMemorizedChk = document.getElementById('quizIncludeMemorizedChk');
const quizOverdueOnlyChk = document.getElementById('quizOverdueOnlyChk');
const quizExcludeTodayChk = document.getElementById('quizExcludeTodayChk');
const quizWeakOnlyChk = document.getElementById('quizWeakOnlyChk');
const quizSkippedOnlyChk = document.getElementById('quizSkippedOnlyChk');
const ENTRIES_STORAGE_KEY = 'ronshoEntries';
const ENTRY_TABLE_COLGROUP = '<colgroup>'
  + '<col style="width:6%;">'
  + '<col style="width:5%;">'
  + '<col style="width:5%;">'
  + '<col style="width:19%;">'
  + '<col style="width:37%;">'
  + '<col style="width:10%;">'
  + '<col style="width:6%;">'
  + '<col style="width:6%;">'
  + '<col style="width:6%;">'
  + '</colgroup>';
let entries = [];
let studyLog = {};
let manualLog = {};
let selectedDay = null;
let selectedSubject = 'all';
let selectedCsvSubject = 'all';
let selectedCategory = 'all';
let starOnlyFilter = false;
let bookmarkOnlyFilter = false;
let minYearFrequency = 0;
let sortByFrequency = false;
let selectedImportance = 'all';
let expandedBodySet = new Set();
let searchQueryStudy = '';
let searchQueryMemorized = '';
let quizPool = [];
let quizIndex = 0;
let quizRevealed = false;
let quizStarted = false;
let quizMinCount = 0;
let quizOverdueMode = false;
let trendMode = 'week';
let editingEntryIdx = null;
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function todayStr() {
  return formatLocalDate(new Date());
}
const SUBJECT_EMOJI = { '民法': '⚖️', '刑法': '🚨', '憲法': '📜', '商法': '💼', '民事訴訟法': '🧑\u200d⚖️', '刑事訴訟法': '🚓', '行政法': '🏛️', '労働法': '👷', '実務基礎民事': '📄', '実務基礎刑事': '🚔' };
function getSubjectEmoji(subject) {
  return SUBJECT_EMOJI[subject] || '📘';
}
const CATEGORY_TO_SUBJECT = { '団体的労使関係法': '労働法', '個別的労働関係法': '労働法', '労働組合法': '労働法' };
function inferSubjectFromCategory(category) {
  return CATEGORY_TO_SUBJECT[category] || '';
}
const STUDY_COUNT_BUCKETS = ['0', '1', '2', '3', '4+'];
const STUDY_COUNT_LABELS = { '0': '未学習', '1': '1回', '2': '2回', '3': '3回', '4+': '4回以上' };
const STUDY_COUNT_COLORS = { '0': '#94a3b8', '1': '#38bdf8', '2': '#34d399', '3': '#fbbf24', '4+': '#a855f7' };
function getStudyCount(title) {
  const log = studyLog[title];
  return (log && log.history) ? log.history.length : 0;
}
function getStudyCountBuckets(list) {
  const buckets = { '0': 0, '1': 0, '2': 0, '3': 0, '4+': 0 };
  list.forEach(e => {
    const cnt = getStudyCount(e.title);
    buckets[cnt >= 4 ? '4+' : String(cnt)]++;
  });
  return buckets;
}
function buildStudyCountBarHtml(list) {
  const buckets = getStudyCountBuckets(list);
  const total = list.length;
  const segHtml = STUDY_COUNT_BUCKETS.map(b => {
    const w = total > 0 ? (buckets[b] / total * 100) : 0;
    if (w <= 0) return '';
    return '<div class="studyCountSeg" style="width:' + w + '%;background:' + STUDY_COUNT_COLORS[b] + ';" title="' + STUDY_COUNT_LABELS[b] + '：' + buckets[b] + '件"></div>';
  }).join('');
  const legendHtml = STUDY_COUNT_BUCKETS.map(b => {
    return '<span class="studyCountLegendItem"><span class="studyCountDot" style="background:' + STUDY_COUNT_COLORS[b] + ';"></span>' + STUDY_COUNT_LABELS[b] + ' ' + buckets[b] + '件</span>';
  }).join('');
  return '<div class="studyCountBarOuter">' + segHtml + '</div>'
    + '<div class="studyCountLegend">' + legendHtml + '</div>';
}
let expandedProgressSubjects = new Set();
function getSubjectCategoryStats(st) {
  const order = [];
  const stats = {};
  st.entries.forEach(e => {
    const c = e.category || '未分類';
    if (!stats[c]) { stats[c] = { total: 0, memorized: 0, studied: 0 }; order.push(c); }
    stats[c].total++;
    const log = studyLog[e.title];
    if (log && log.memorized) stats[c].memorized++;
    if (log && log.history && log.history.length > 0) stats[c].studied++;
  });
  return order.map(c => ({ name: c, total: stats[c].total, memorized: stats[c].memorized, studied: stats[c].studied }));
}
function buildSubjectItemHtml(s, st, compact) {
  const p = st.total > 0 ? Math.round((st.memorized / st.total) * 100) : 0;
  const categories = getSubjectCategoryStats(st);
  const isExpanded = expandedProgressSubjects.has(s);
  const chipsHtml = categories.length > 1
    ? '<div class="subjectCatChips">' + categories.map(c => {
        const cp = c.total > 0 ? Math.round((c.memorized / c.total) * 100) : 0;
        const sp = c.total > 0 ? Math.round((c.studied / c.total) * 100) : 0;
        return '<span class="subjectCatChip"><span class="subjectCatChipName">' + escapeHtml(c.name) + '</span><span class="subjectCatChipPct">暗記' + cp + '%</span><span class="subjectCatChipStudyPct">学習' + sp + '%</span></span>';
      }).join('') + '</div>'
    : '';
  const detailHtml = categories.length > 1
    ? '<div class="subjectCatDetail">' + categories.map(c => {
        const cp = c.total > 0 ? Math.round((c.memorized / c.total) * 100) : 0;
        const sp = c.total > 0 ? Math.round((c.studied / c.total) * 100) : 0;
        return '<div class="subjectCatDetailRow">'
          + '<span class="subjectCatDetailName">' + escapeHtml(c.name) + '</span>'
          + '<span class="subjectCatDetailCounts">' + c.total + '件 ／ 暗記' + c.memorized + '件 ／ 学習' + c.studied + '件</span>'
          + '<div class="subjectCatDetailBarWrap"><div class="studyCountBarOuter thin"><div class="studyCountSeg" style="width:' + cp + '%;background:linear-gradient(135deg,#10b981,#00c2ff);"></div><div class="studyCountSeg" style="width:' + (100 - cp) + '%;background:#f1f5f9;"></div></div></div>'
          + '<span class="subjectCatDetailPct">暗記' + cp + '% ／ 学習' + sp + '%</span>'
          + '</div>';
      }).join('') + '</div>'
    : '';
  return '<div class="subjectProgressItem' + (compact ? ' compact' : '') + '">'
    + '<div class="subjectProgressHeader">'
    + '<div class="subjectProgressName' + (categories.length > 1 ? ' clickable' : '') + '" data-subject="' + escapeHtml(s) + '" title="' + (categories.length > 1 ? 'クリックで分野別の内訳を表示' : '') + '">' + getSubjectEmoji(s) + ' ' + escapeHtml(s) + (categories.length > 1 ? '<span class="subjectCatCaret">' + (isExpanded ? '▼' : '▶') + '</span>' : '') + '</div>'
    + '<div class="subjectProgressCounts">合計' + st.total + '件 ／ 暗記' + st.memorized + '件</div>'
    + '<div class="subjectProgressPct">' + p + '%</div>'
    + '</div>'
    + buildStudyCountBarHtml(st.entries)
    + (isExpanded ? detailHtml : chipsHtml)
    + '</div>';
}
function renderProgressSummary() {
  const el = document.getElementById('progressSummary');
  const overallEl = document.getElementById('overallProgressCardWrap');
  if (!el) return;
  if (entries.length === 0) {
    el.innerHTML = '';
    if (overallEl) overallEl.innerHTML = '';
    return;
  }
  const filtered = filterEntries(entries, '');
  const total = filtered.length;
  const memorizedCount = filtered.filter(e => studyLog[e.title] && studyLog[e.title].memorized).length;
  const pct = total > 0 ? Math.round((memorizedCount / total) * 100) : 0;

  const subjectStats = {};
  entries.forEach(e => {
    const s = e.subject || 'その他';
    if (!subjectStats[s]) {
      subjectStats[s] = { total: 0, memorized: 0, entries: [] };
    }
    subjectStats[s].total++;
    subjectStats[s].entries.push(e);
    if (studyLog[e.title] && studyLog[e.title].memorized) subjectStats[s].memorized++;
  });
  const subjectOrderList = getUniqueSubjects();
  const subjectRows = [];
  for (let i = 0; i < subjectOrderList.length; i += 2) {
    const pair = subjectOrderList.slice(i, i + 2);
    if (pair.length === 2) {
      subjectRows.push('<div class="subjectProgressGroupRow">' + pair.map(s => buildSubjectItemHtml(s, subjectStats[s], true)).join('') + '</div>');
    } else {
      subjectRows.push(buildSubjectItemHtml(pair[0], subjectStats[pair[0]], false));
    }
  }
  const subjectHtml = subjectRows.join('');
  if (overallEl) {
    overallEl.innerHTML = '<div class="progressCard">'
      + '<div class="progressBigPct">' + pct + '%</div>'
      + '<div class="progressBarSection">'
      + '<div class="progressLabel">合計' + total + '件 ／ 暗記済み' + memorizedCount + '件</div>'
      + buildStudyCountBarHtml(filtered)
      + '</div>'
      + '</div>';
  }
  el.innerHTML = '<div class="subjectProgressCard">'
    + '<div class="subjectProgressTitle">📚 科目別 暗記完了率・学習回数</div>'
    + subjectHtml
    + '</div>';
}
document.getElementById('progressSummary').addEventListener('click', (e) => {
  const nameEl = e.target.closest('.subjectProgressName.clickable');
  if (!nameEl) return;
  const s = nameEl.dataset.subject;
  if (expandedProgressSubjects.has(s)) expandedProgressSubjects.delete(s);
  else expandedProgressSubjects.add(s);
  renderProgressSummary();
});
// --- 花火×LEVEL UP演出 ---
function triggerFireworkLevelUp(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#0057e7', '#00c2ff', '#54a0ff', '#7c3aed', '#22c55e', '#ff9ff3'];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'fwParticle';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.background = colors[i % colors.length];
    const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.3;
    const dist = 45 + Math.random() * 30;
    p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1050);
  }
  setTimeout(() => {
    const badge = document.createElement('div');
    badge.className = 'levelUpBadge';
    badge.textContent = '🎉 LEVEL UP!';
    badge.style.left = cx + 'px';
    badge.style.top = (cy - 20) + 'px';
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 1150);
  }, 200);
}
function loadStudyLog() {
  try {
    const raw = localStorage.getItem('ronshoStudyLog');
    studyLog = raw ? JSON.parse(raw) : {};
  } catch (e) {
    studyLog = {};
  }
}
function saveStudyLog() {
  localStorage.setItem('ronshoStudyLog', JSON.stringify(studyLog));
}
function loadManualLog() {
  try {
    const raw = localStorage.getItem('ronshoManualLog');
    manualLog = raw ? JSON.parse(raw) : {};
  } catch (e) {
    manualLog = {};
  }
}
function saveManualLog() {
  localStorage.setItem('ronshoManualLog', JSON.stringify(manualLog));
}
function loadEntries() {
  try {
    const raw = localStorage.getItem(ENTRIES_STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch (e) {
    entries = [];
  }
  let migrated = false;
  entries = entries.map(e => {
    if (e.subject === '刑法総論' || e.subject === '刑法各論') {
      migrated = true;
      return { ...e, subject: '刑法', category: e.subject };
    }
    const resolvedCategory = resolveKeihoCategory(e.subject, e.category);
    if (resolvedCategory !== e.category) { migrated = true; return { ...e, category: resolvedCategory }; }
    if (!e.subject) {
      const inferred = inferSubjectFromCategory(e.category);
      if (inferred) { migrated = true; return { ...e, subject: inferred }; }
    }
    return e;
  });
  if (migrated) saveEntries();
}
function saveEntries() {
  try {
    localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('読み込みデータの保存に失敗しました:', e);
  }
}
document.getElementById('clearEntriesBtn').addEventListener('click', () => {
  if (!confirm('読み込んだWordデータを削除しますか？（学習記録・暗記度・苦手フラグなどは削除されません）')) return;
  entries = [];
  localStorage.removeItem(ENTRIES_STORAGE_KEY);
  selectedSubject = 'all';
  selectedCsvSubject = 'all';
  selectedCategory = 'all';
  starOnlyFilter = false;
  bookmarkOnlyFilter = false;
  minYearFrequency = 0;
  sortByFrequency = false;
  selectedImportance = 'all';
  expandedBodySet = new Set();
  tableWrap.innerHTML = '';
  memorizedTableWrap.innerHTML = '';
  csvTableWrap.innerHTML = '';
  csvSubjectFilter.innerHTML = '';
  calendarWrap.innerHTML = '';
  trendWrap.innerHTML = '';
  document.getElementById('progressSummary').innerHTML = '';
  downloadBtn.style.display = 'none';
  downloadLogBtn.style.display = 'none';
  status.textContent = '読み込みデータを削除しました。新しくWordファイルを読み込んでください。';
});
document.getElementById('deleteTitleBtn').addEventListener('click', () => {
  const input = document.getElementById('deleteTitleInput');
  const target = input.value.trim();
  if (!target) {
    alert('削除する論証のタイトルを入力してください。');
    return;
  }
  const matches = entries.filter(e => e.title === target);
  if (matches.length === 0) {
    alert('「' + target + '」というタイトルの論証は見つかりませんでした。タイトルは完全一致で入力してください。');
    return;
  }
  const subjectsLabel = Array.from(new Set(matches.map(e => e.subject || 'その他'))).join('・');
  if (!confirm('「' + target + '」というタイトルの論証が' + matches.length + '件見つかりました（' + subjectsLabel + '）。削除しますか？（学習記録・暗記度・苦手フラグなどは削除されません）')) return;
  entries = entries.filter(e => e.title !== target);
  saveEntries();
  input.value = '';
  renderAll();
  status.textContent = '🗑 「' + target + '」を削除しました（' + matches.length + '件）。';
});

/* ▼▼▼ 新規追加：重複チェック機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼ */
const DUP_FUZZY_THRESHOLD = 0.8;
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
}
loadDupArchive();
function dupArchiveEntry(target, reasonLabel) {
  dupArchiveList.unshift({ entry: target, deletedAt: new Date().toISOString(), reason: reasonLabel || '' });
  saveDupArchive();
}
function renderDupArchive() {
  const wrap = document.getElementById('dupArchiveWrap');
  if (!wrap) return;
  if (dupArchiveList.length === 0) {
    wrap.innerHTML = '<div class="dupCheckEmpty">アーカイブされた論証はありません。</div>';
    return;
  }
  const html = dupArchiveList.map((item, idx) => {
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
  wrap.innerHTML = '<div class="dupCheckSummary">' + dupArchiveList.length + '件のアーカイブがあります。</div>' + html;
}
function dupRestoreArchivedEntry(idx) {
  const item = dupArchiveList[idx];
  if (!item) return;
  entries.push(item.entry);
  dupArchiveList.splice(idx, 1);
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
  bySubject.forEach(list => {
    if (list.length > DUP_SUBJECT_BUCKET_LIMIT) return;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const score = dupCombinedScore(list[i], list[j]);
        if (score >= DUP_FUZZY_THRESHOLD) addPair(list[i], list[j], 'fuzzy', score);
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
  const idx = entries.indexOf(target);
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
function dupRemovePairsReferencing(target) {
  dupCheckPairs = dupCheckPairs.filter(p => p.a !== target && p.b !== target);
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
    const isExactMatch = pair.reasons.has('title') || pair.reasons.has('body');
    const carried = dupMergeStudyLogInto(kept, target);
    dupArchiveEntry(target, dupReasonLabel(pair));
    dupDeleteEntry(target);
    saveEntries();
    if (isExactMatch) {
      dupResolvedSet.add(dupPairSignature(pair.a, pair.b));
      saveDupResolved();
    }
    dupRemovePairsReferencing(target);
    renderDuplicateResults();
    renderDupArchive();
    renderAll();
    status.textContent = carried
      ? '🗑 「' + target.title + '」を削除し、学習記録を「' + kept.title + '」に引き継ぎました（アーカイブに保管済み）。'
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
document.getElementById('exportLogBtn').addEventListener('click', () => {
  const payload = { studyLog: studyLog, manualLog: manualLog };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '学習記録_' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
document.getElementById('importLogBtn').addEventListener('click', () => {
  document.getElementById('importLogInput').click();
});
document.getElementById('importLogInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    let importedStudyLog, importedManualLog;
    if (imported && (imported.studyLog || imported.manualLog)) {
      importedStudyLog = imported.studyLog || {};
      importedManualLog = imported.manualLog || {};
    } else {
      importedStudyLog = imported || {};
      importedManualLog = {};
    }
    const merged = Object.assign({}, studyLog);
    Object.keys(importedStudyLog).forEach(title => {
      const incoming = importedStudyLog[title];
      if (!merged[title]) {
        merged[title] = incoming;
      } else {
        const existingHistory = merged[title].history || [];
        const incomingHistory = incoming.history || [];
        const mergedHistorySet = new Set([...existingHistory, ...incomingHistory]);
        merged[title].history = Array.from(mergedHistorySet).sort();
        merged[title].memorized = incoming.memorized || merged[title].memorized || false;
        merged[title].confidence = incoming.confidence || merged[title].confidence || null;
        merged[title].memo = merged[title].memo || incoming.memo || '';
        merged[title].starred = merged[title].starred || incoming.starred || false;
        merged[title].category = merged[title].category || incoming.category || '';
        merged[title].subject = merged[title].subject || incoming.subject || '';
      }
    });
    studyLog = merged;
    saveStudyLog();
    Object.keys(importedManualLog).forEach(dateStr => {
      if (!manualLog[dateStr]) manualLog[dateStr] = [];
      manualLog[dateStr] = manualLog[dateStr].concat(importedManualLog[dateStr]);
    });
    saveManualLog();
    renderAll();
    status.textContent = '学習記録を読み込み、既存の記録と統合しました。';
  } catch (err) {
    status.textContent = '学習記録の読み込みに失敗しました: ' + err.message;
  }
  e.target.value = '';
});
document.querySelectorAll('.tabBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'calendarPage') { renderCalendar(); renderTrendChart(); }
    if (btn.dataset.page === 'quizPage') renderQuizPage();
    if (btn.dataset.page === 'speechPage') {
      renderSpeechSubjectSelect();
      speechQueue = buildSpeechQueue();
      speechIndex = 0;
      renderSpeechCurrentCard();
    } else if (speechIsPlaying) {
      stopSpeech();
    }
  });
});
drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
});
fileInput.addEventListener('change', e => {
  if (e.target.files.length) handleFiles(Array.from(e.target.files));
});
searchInputStudy.addEventListener('input', () => {
  searchQueryStudy = searchInputStudy.value.trim();
  renderStudyTable(entries);
});
searchInputMemorized.addEventListener('input', () => {
  searchQueryMemorized = searchInputMemorized.value.trim();
  renderMemorizedTable(entries);
});
document.getElementById('searchClearStudy').addEventListener('click', () => {
  searchInputStudy.value = '';
  searchQueryStudy = '';
  renderStudyTable(entries);
});
document.getElementById('searchClearMemorized').addEventListener('click', () => {
  searchInputMemorized.value = '';
  searchQueryMemorized = '';
  renderMemorizedTable(entries);
});
document.getElementById('quizStartBtn').addEventListener('click', () => {
  startQuiz();
});
csvSubjectFilter.addEventListener('change', () => {
  selectedCsvSubject = csvSubjectFilter.value;
  renderCsvTable(getCsvFilteredEntries());
});
function runListToText(runList) {
  return runList.map(r => r.text).join('');
}
function isTitleLine(runList) {
  return /^[★☆]+/.test(runListToText(runList).trim());
}
const SECTION_STOP_WORDS = ['サブ', '今後追加', '暗記'];
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function buildBodyHtml(bodyRunLines) {
  return bodyRunLines.map(runList => {
    let lineHtml = '';
    let isFirstRun = true;
    for (const r of runList) {
      const text = isFirstRun ? r.text.replace(/^[\s\u3000]+/, '') : r.text;
      const escaped = escapeHtml(text);
      if (r.color) {
        lineHtml += '<span style="color:' + r.color + '; font-weight:bold;">' + escaped + '</span>';
      } else {
        lineHtml += escaped;
      }
      isFirstRun = false;
    }
    return lineHtml;
  }).join('<br>');
}
function buildYearHtml(yearStr) {
  if (!yearStr) return '';
  const tokens = yearStr.split(';').filter(Boolean);
  return tokens.map(tokStr => {
    const [text, color] = tokStr.split('|');
    const escaped = escapeHtml(text);
    return color ? '<span style="color:' + color + '; font-weight:bold;">' + escaped + '</span>' : escaped;
  }).join(', ');
}
function yearStrToPlainText(yearStr) {
  if (!yearStr) return '';
  return yearStr.split(';').filter(Boolean).map(tokStr => tokStr.split('|')[0]).join(',');
}
function getYearTokensPlain(yearStr) {
  if (!yearStr) return [];
  return yearStr.split(';').filter(Boolean).map(tokStr => tokStr.split('|')[0]).filter(Boolean);
}
function getYearFrequency(e) {
  return getYearTokensPlain(e.year).length;
}
function extractEntries(paraRuns) {
  const out = [];
  let i = 0;
  const n = paraRuns.length;
  let currentSubject = '';
  let currentCategory = '';
  while (i < n) {
    const lineText = runListToText(paraRuns[i]).trim();
    if (SECTION_STOP_WORDS.includes(lineText)) break;
    const combinedMatch = lineText.match(/^(.+?)[\s\u3000]*[<＜]([^>＞]+)[>＞]$/);
    if (combinedMatch) {
      const maybeSubject = combinedMatch[1].replace(/[\s\u3000]/g, '').trim();
      const maybeCategory = combinedMatch[2].replace(/[\s\u3000]/g, '').trim();
      if (isSubjectLine(maybeSubject)) currentSubject = maybeSubject;
      if (maybeCategory) currentCategory = maybeCategory;
      i++;
      continue;
    }
    if (/^[<＜](.+)[>＞]$/.test(lineText)) {
      const m = lineText.match(/^[<＜](.+)[>＞]$/);
      currentCategory = m[1].replace(/[\s\u3000]/g, '').trim();
      i++;
      continue;
    }
    if (isPlainCategoryLine(lineText)) {
      currentCategory = lineText.replace(/[\s\u3000]/g, '').trim();
      i++;
      continue;
    }
    if (isSubjectLine(lineText.replace(/[\s\u3000]/g, '').trim())) {
      currentSubject = lineText.replace(/[\s\u3000]/g, '').trim();
      i++;
      continue;
    }
    if (isTitleLine(paraRuns[i])) {
      const { title, yearTokensColored, importance } = parseTitleLineRuns(paraRuns[i]);
      const yearStr = buildFilteredYearStr(yearTokensColored);
      i++;
      let bodyLines = [];
      let bodyRunLines = [];
      while (i < n) {
        const nxtText = runListToText(paraRuns[i]).trim();
        if (nxtText === '') { i++; continue; }
        if (isTitleLine(paraRuns[i])) break;
        if (SECTION_STOP_WORDS.includes(nxtText)) break;
        if (/^[<＜].+[>＞]$/.test(nxtText)) break;
        if (isPlainCategoryLine(nxtText) || isSubjectLine(nxtText)) break;
        const cleaned = nxtText.replace(/^[\s\u3000]+/, '').trim();
        bodyLines.push(cleaned);
        bodyRunLines.push(paraRuns[i]);
        i++;
      }
      const body = bodyLines.join('\n');
      const bodyHtml = buildBodyHtml(bodyRunLines);
      const resolvedSubject = currentSubject || inferSubjectFromCategory(currentCategory);
      out.push({ title: title, body: body, bodyHtml: bodyHtml, year: yearStr, category: currentCategory, subject: resolvedSubject, importance: importance });
      continue;
    }
    i++;
  }
  return out;
}
function isSubjectLine(text) {
  if (!text || /[。、]/.test(text) || text.length > 10) return false;
  return ['民法','刑法','憲法','商法','民事訴訟法','刑事訴訟法','行政法','労働法','実務基礎民事','実務基礎刑事'].includes(text);
}
function isPlainCategoryLine(text) {
  if (!text) return false;
  const t = text.replace(/[\s　]/g, '').trim();
  if (!t || /[。、]/.test(t) || t.length > 20) return false;
  const known = ['総則','物権','担保物権','債権総論','債権各論','親族','相続','人権','統治','総論','各論','財産犯','生命身体に対する罪','文書罪'];
  return known.includes(t);
}
function parseTitleLineRuns(runList) {
  const chars = [];
  for (const r of runList) {
    for (const ch of r.text) {
      chars.push({ ch: ch, color: r.color });
    }
  }
  while (chars.length && /[\s　]/.test(chars[0].ch)) chars.shift();
  let idx = 0;
  let importance = 0;
  while (idx < chars.length && (chars[idx].ch === '★' || chars[idx].ch === '☆')) { importance++; idx++; }
  const segments = [];
  let current = [];
  for (; idx < chars.length; idx++) {
    if (chars[idx].ch === '\u3000') {
      segments.push(current);
      current = [];
    } else {
      current.push(chars[idx]);
    }
  }
  if (current.length) segments.push(current);
  const title = segments.length > 0 ? segments[0].map(c => c.ch).join('').trim() : '';
  const yearTokensColored = [];
  for (let s = 1; s < segments.length; s++) {
    const seg = segments[s];
    const segText = seg.map(c => c.ch).join('').trim();
    const groupIsSu = segText.startsWith('ス');
    let tokChars = [];
    const flushToken = () => {
      if (tokChars.length === 0) return;
      const text = tokChars.map(c => c.ch).join('').trim();
      if (text === '') { tokChars = []; return; }
      const coloredChar = tokChars.find(c => c.color) || tokChars[0];
      yearTokensColored.push({ text: text, color: coloredChar.color || null, groupIsSu: groupIsSu });
      tokChars = [];
    };
    for (const c of seg) {
      if (c.ch === ',' || c.ch === '\uFF0C') {
        flushToken();
      } else {
        tokChars.push(c);
      }
    }
    flushToken();
  }
  return { title, yearTokensColored, importance };
}
function buildFilteredYearStr(yearTokensColored) {
  const kept = yearTokensColored.filter(t => {
    if (t.groupIsSu) return false;
    if (isOldBarExamColor(t.color)) return false;
    return true;
  });
  return kept.map(t => t.text + '|' + (t.color || '')).join(';');
}
function isOldBarExamColor(color) {
  if (!color) return false;
  const c = color.toLowerCase();
  return c === '#ff9900' || c === '#ff950e';
}
function isNewBarExamColor(color) {
  if (!color) return false;
  return color.toLowerCase() === '#2fff2e';
}
function isYobiShikenColor(color) {
  if (!color) return false;
  const c = color.toLowerCase();
  return c === '#00ccff' || c === '#00dcff';
}
function inferSubjectFromFilename(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('min-fa') || n.includes('民法')) return '民法';
  if (n.includes('kei-ho') || n.includes('刑法')) return '刑法';
  if (n.includes('ken-po') || n.includes('xian-fa') || n.includes('憲法')) return '憲法';
  if (n.includes('商法')) return '商法';
  if (n.includes('民事訴訟法') || n.includes('民訴')) return '民事訴訟法';
  if (n.includes('刑事訴訟法') || n.includes('刑訴')) return '刑事訴訟法';
  if (n.includes('行政法')) return '行政法';
  if (n.includes('労働法')) return '労働法';
  if (n.includes('実務基礎民事')) return '実務基礎民事';
  if (n.includes('実務基礎刑事')) return '実務基礎刑事';
  return '';
}
function resolveKeihoCategory(subject, category) {
  if (subject !== '刑法') return category;
  if (category === '総論') return '刑法総論';
  if (category === '各論' || category === '財産犯' || category === '生命身体に対する罪' || category === '文書罪') return '刑法各論';
  return category;
}
async function parseSingleFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = await zip.file('word/document.xml').async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, 'application/xml');
  const paragraphs = xmlDoc.getElementsByTagName('w:p');
  const paraRuns = [];
  for (let p of paragraphs) {
    const runs = p.getElementsByTagName('w:r');
    const runList = [];
    for (let r of runs) {
      const texts = r.getElementsByTagName('w:t');
      let text = '';
      for (let t of texts) text += t.textContent;
      if (text === '') continue;
      let color = null;
      const colorEls = r.getElementsByTagName('w:color');
      if (colorEls.length > 0) {
        const v = colorEls[0].getAttribute('w:val');
        if (v && v.toLowerCase() !== '000000' && v.toLowerCase() !== 'auto') {
          color = '#' + v;
        }
      }
      runList.push({ text: text, color: color });
    }
    paraRuns.push(runList);
  }
  const subjectFromName = inferSubjectFromFilename(file.name);
  const parsed = extractEntries(paraRuns).map(e => {
    const subject = subjectFromName || e.subject || '';
    return { ...e, subject: subject, category: resolveKeihoCategory(subject, e.category) };
  });
  return parsed;
}
async function handleFiles(files) {
  status.textContent = '読み込み中...';
  tableWrap.innerHTML = '';
  memorizedTableWrap.innerHTML = '';
  csvTableWrap.innerHTML = '';
  calendarWrap.innerHTML = '';
  downloadBtn.style.display = 'none';
  downloadLogBtn.style.display = 'none';
  try {
    let newEntries = [];
    for (const file of files) {
      const parsed = await parseSingleFile(file);
      newEntries = newEntries.concat(parsed);
    }
    const importedAt = new Date().toISOString();
    newEntries.forEach(e => { e.importedAt = importedAt; });
    const touchedSubjects = new Set(newEntries.map(e => e.subject || 'その他'));
    const keptEntries = entries.filter(e => !touchedSubjects.has(e.subject || 'その他'));
    entries = keptEntries.concat(newEntries);
    saveEntries();
    selectedSubject = 'all';
    selectedCategory = 'all';
    starOnlyFilter = false;
    bookmarkOnlyFilter = false;
    minYearFrequency = 0;
    sortByFrequency = false;
    selectedImportance = 'all';
    expandedBodySet = new Set();
    searchQueryStudy = '';
    searchQueryMemorized = '';
    searchInputStudy.value = '';
    searchInputMemorized.value = '';
    quizPool = [];
    quizStarted = false;
    renderAll();
    const touchedLabel = Array.from(touchedSubjects).map(s => s === 'その他' ? s : s).join('・');
    status.textContent = '✨ ' + newEntries.length + '件の論証を抽出しました（' + touchedLabel + 'を更新）。読み込みファイル数: ' + files.length + '件／全体 ' + entries.length + '件（次回起動時も自動で復元されます）';
    downloadBtn.style.display = 'inline-block';
    downloadLogBtn.style.display = 'inline-block';
  } catch (err) {
    status.textContent = 'エラーが発生しました: ' + err.message;
    console.error(err);
  }
}
const SUBJECT_ORDER = ['憲法', '民法', '刑法', '行政法', '商法', '民事訴訟法', '刑事訴訟法'];
function getUniqueSubjects() {
  const seen = [];
  entries.forEach(e => {
    const s = e.subject || 'その他';
    if (!seen.includes(s)) seen.push(s);
  });
  seen.sort((a, b) => {
    const ia = SUBJECT_ORDER.indexOf(a);
    const ib = SUBJECT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return seen;
}
function getUniqueCategories() {
  const scoped = selectedSubject === 'all' ? entries : entries.filter(e => (e.subject || 'その他') === selectedSubject);
  const seen = [];
  scoped.forEach(e => {
    const c = e.category || '未分類';
    if (!seen.includes(c)) seen.push(c);
  });
  return seen;
}
function renderSubjectTabsHtml() {
  const subjects = getUniqueSubjects();
  if (subjects.length <= 1) return '';
  let html = '<select class="subjectTabSelect">';
  html += '<option value="all"' + (selectedSubject === 'all' ? ' selected' : '') + '>📚 すべて</option>';
  subjects.forEach(s => {
    html += '<option value="' + escapeHtml(s) + '"' + (selectedSubject === s ? ' selected' : '') + '>' + getSubjectEmoji(s) + ' ' + escapeHtml(s) + '</option>';
  });
  html += '</select>';
  return html;
}
function renderCategoryTabsHtml() {
  const categories = getUniqueCategories();
  if (categories.length <= 1) return '';
  let html = '<button type="button" class="categoryTabBtn' + (selectedCategory === 'all' ? ' active' : '') + '" data-category="all">すべての分野</button>';
  categories.forEach(c => {
    html += '<button type="button" class="categoryTabBtn' + (selectedCategory === c ? ' active' : '') + '" data-category="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
  });
  return html;
}
function renderStarTabsHtml() {
  let html = '<button type="button" class="starFilterBtn' + (!starOnlyFilter && !bookmarkOnlyFilter ? ' active' : '') + '" data-star="all">すべて表示</button>';
  html += '<button type="button" class="starFilterBtn' + (starOnlyFilter ? ' active' : '') + '" data-star="only">😰 苦手のみ</button>';
  html += '<button type="button" class="starFilterBtn' + (bookmarkOnlyFilter ? ' active' : '') + '" data-star="bookmark">🔖 要修正のみ</button>';
  return html;
}
function renderImportanceTabsHtml() {
  let html = '<button type="button" class="starFilterBtn' + (selectedImportance === 'all' ? ' active' : '') + '" data-importance="all">重要度すべて</button>';
  html += '<button type="button" class="starFilterBtn' + (selectedImportance === 2 ? ' active' : '') + '" data-importance="2">⭐⭐</button>';
  html += '<button type="button" class="starFilterBtn' + (selectedImportance === 1 ? ' active' : '') + '" data-importance="1">⭐</button>';
  html += '<button type="button" class="starFilterBtn' + (selectedImportance === 0 ? ' active' : '') + '" data-importance="0">なし</button>';
  return html;
}
function renderFreqTabsHtml() {
  let html = '<button type="button" class="starFilterBtn' + (minYearFrequency === 0 ? ' active' : '') + '" data-freq="0">出題頻度すべて</button>';
  html += '<button type="button" class="starFilterBtn' + (minYearFrequency === 2 ? ' active' : '') + '" data-freq="2">2回以上出題</button>';
  html += '<button type="button" class="starFilterBtn' + (minYearFrequency === 3 ? ' active' : '') + '" data-freq="3">3回以上出題</button>';
  html += '<button type="button" class="starFilterBtn' + (sortByFrequency ? ' active' : '') + '" id="freqSortBtn">🔥頻出順に並び替え</button>';
  return html;
}
function renderSubjectTabs() {
  const html = renderSubjectTabsHtml();
  subjectTabsStudy.innerHTML = html;
  subjectTabsMemorized.innerHTML = html;
  subjectTabsQuiz.innerHTML = html;
  const catHtml = renderCategoryTabsHtml();
  categoryTabsStudy.innerHTML = catHtml;
  categoryTabsMemorized.innerHTML = catHtml;
  categoryTabsQuiz.innerHTML = catHtml;
  const starHtml = renderStarTabsHtml();
  starTabsStudy.innerHTML = starHtml;
  starTabsMemorized.innerHTML = starHtml;
  starTabsQuiz.innerHTML = starHtml;
  const importanceHtml = renderImportanceTabsHtml();
  importanceTabsStudy.innerHTML = importanceHtml;
  importanceTabsMemorized.innerHTML = importanceHtml;
  importanceTabsQuiz.innerHTML = importanceHtml;
  const freqHtml = renderFreqTabsHtml();
  freqTabsStudy.innerHTML = freqHtml;
  freqTabsMemorized.innerHTML = freqHtml;
}
function filterEntries(data, searchQuery) {
  let result = data;
  if (selectedSubject !== 'all') {
    result = result.filter(e => (e.subject || 'その他') === selectedSubject);
  }
  if (selectedCategory !== 'all') {
    result = result.filter(e => (e.category || '未分類') === selectedCategory);
  }
  if (starOnlyFilter) {
    result = result.filter(e => studyLog[e.title] && studyLog[e.title].starred);
  }
  if (bookmarkOnlyFilter) {
    result = result.filter(e => studyLog[e.title] && studyLog[e.title].bookmarked);
  }
  if (selectedImportance !== 'all') {
    result = result.filter(e => (e.importance || 0) === selectedImportance);
  }
  if (minYearFrequency > 0) {
    result = result.filter(e => getYearFrequency(e) >= minYearFrequency);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(e => (e.title || '').toLowerCase().includes(q) || (e.body || '').toLowerCase().includes(q));
  }
  if (sortByFrequency) {
    result = result.slice().sort((a, b) => getYearFrequency(b) - getYearFrequency(a));
  }
  return result;
}
function highlightSearch(html, query) {
  if (!query) return html;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(' + escapedQuery + ')', 'ig');
  return html.replace(re, '<mark class="searchHit">$1</mark>');
}
function renderAll(preserveQuiz) {
  renderSubjectTabs();
  renderStudyTable(entries);
  renderMemorizedTable(entries);
  renderCsvSubjectFilter();
  renderCsvTable(getCsvFilteredEntries());
  renderSpeechSubjectSelect();
  renderCalendar();
  renderTrendChart();
  renderProgressSummary();
  if (!preserveQuiz) {
    quizStarted = false;
  }
  renderQuizPage();
  renderPastLogs();
}
function getNextReviewInfo(title) {
  const log = studyLog[title] || {};
  const history = log.history || [];
  if (history.length === 0) return null;
  const lastDateStr = history[history.length - 1];
  const count = history.length;
  let intervalDays = 1;
  if (count === 1) intervalDays = 1;
  else if (count === 2) intervalDays = 3;
  else if (count === 3) intervalDays = 7;
  else if (count === 4) intervalDays = 14;
  else if (count === 5) intervalDays = 30;
  else intervalDays = 60;
  if (log.confidence === 'unsure') intervalDays = Math.max(1, Math.round(intervalDays / 2));
  if (log.confidence === 'bad') intervalDays = 1;
  const d = new Date(lastDateStr + 'T00:00:00');
  d.setDate(d.getDate() + intervalDays);
  const nextDateStr = formatLocalDate(d);
  return { lastDateStr, count, intervalDays, nextDateStr };
}
function buildImportanceStarsHtml(importance) {
  const n = importance || 0;
  if (n <= 0) return '';
  return '<span class="importanceStars">' + '⭐'.repeat(n) + '</span>';
}
function buildConfidenceGroupHtml(idx, confidence) {
  return '<div class="confidenceGroup" data-idx="' + idx + '">'
    + '<span class="confBtn confGood' + (confidence === 'good' ? ' active' : '') + '" data-level="good" data-idx="' + idx + '" title="バッチリ">○</span>'
    + '<span class="confBtn confUnsure' + (confidence === 'unsure' ? ' active' : '') + '" data-level="unsure" data-idx="' + idx + '" title="あやしい">△</span>'
    + '<span class="confBtn confBad' + (confidence === 'bad' ? ' active' : '') + '" data-level="bad" data-idx="' + idx + '" title="ダメ">✕</span>'
    + '</div>';
}
/* ▼▼▼ 新規追加：論証の直接編集機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼ */
function getExistingBodyColors() {
  const colors = new Set();
  entries.forEach(en => {
    if (!en.bodyHtml) return;
    for (const m of en.bodyHtml.matchAll(/color:\s*(#[0-9A-Fa-f]{3,8})/g)) colors.add(m[1].toLowerCase());
  });
  return [...colors];
}
function editRgbToHex(str) {
  if (!str) return null;
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const h = n => Number(n).toString(16).padStart(2, '0');
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  }
  if (/^#/.test(str)) return str.toLowerCase();
  return null;
}
function sanitizeEditedBodyHtml(container, allowedColors) {
  let out = '';
  container.childNodes.forEach(child => {
    if (child.nodeType === 3) {
      out += escapeHtml(child.nodeValue || '');
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') { out += '<br>'; return; }
      const inner = sanitizeEditedBodyHtml(child, allowedColors);
      if (tag === 'div' || tag === 'p') {
        out += (out ? '<br>' : '') + inner;
        return;
      }
      const hex = child.style ? editRgbToHex(child.style.color) : null;
      const fw = child.style ? child.style.fontWeight : '';
      const isBold = tag === 'b' || tag === 'strong' || fw === 'bold' || Number(fw) >= 700;
      if (hex && allowedColors.has(hex)) {
        out += '<span style="color:' + hex + '; font-weight:bold;">' + inner + '</span>';
      } else if (isBold) {
        out += '<b>' + inner + '</b>';
      } else {
        out += inner;
      }
    }
  });
  return out;
}
function bodyHtmlToPlainText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
  return tmp.textContent || '';
}
function buildBodyEditorHtml(e, idx) {
  const colors = getExistingBodyColors();
  const swatches = colors.map(c => '<span class="editColorSwatch" data-color="' + c + '" style="background:' + c + ';" title="' + c + '"></span>').join('');
  return '<div class="editBodyWrap">'
    + '<div class="editColorToolbar"><span class="editBoldBtn" title="太字">B</span>' + swatches + '<span class="editColorClearBtn" title="文字色をクリア">色なし</span></div>'
    + '<div class="editBodyArea" contenteditable="true" data-idx="' + idx + '">' + (e.bodyHtml || escapeHtml(e.body || '')) + '</div>'
    + '<div class="editActionsRow">'
    + '<button type="button" class="editSaveBtn" data-idx="' + idx + '">💾 保存</button>'
    + '<button type="button" class="editCancelBtn" data-idx="' + idx + '">✖ キャンセル</button>'
    + '</div>'
    + '</div>';
}
function applyBodyEditorColor(color) {
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('foreColor', false, color);
}
function applyBodyEditorBold() {
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('bold');
}
function saveEntryEdit(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const titleInput = document.querySelector('.editTitleInput[data-idx="' + idx + '"]');
  const bodyArea = document.querySelector('.editBodyArea[data-idx="' + idx + '"]');
  if (!titleInput || !bodyArea) return;
  const newTitle = titleInput.value.trim();
  if (!newTitle) { alert('タイトルを入力してください。'); return; }
  const allowedColors = new Set(getExistingBodyColors());
  const newBodyHtml = sanitizeEditedBodyHtml(bodyArea, allowedColors);
  const newBodyText = bodyHtmlToPlainText(newBodyHtml);
  const oldTitle = ent.title;
  ent.title = newTitle;
  ent.body = newBodyText;
  ent.bodyHtml = newBodyHtml;
  if (oldTitle !== newTitle) {
    if (studyLog[oldTitle]) {
      if (studyLog[newTitle]) {
        const a = studyLog[newTitle], b = studyLog[oldTitle];
        studyLog[newTitle] = {
          ...a,
          history: dupMergeHistoryArrays(a.history, b.history),
          memorized: !!(a.memorized || b.memorized),
          starred: !!(a.starred || b.starred),
          bookmarked: !!(a.bookmarked || b.bookmarked),
          skipped: !!(a.skipped || b.skipped),
          confidence: a.confidence || b.confidence || null,
          memo: a.memo || b.memo || ''
        };
      } else {
        studyLog[newTitle] = studyLog[oldTitle];
      }
      delete studyLog[oldTitle];
    }
    if (expandedBodySet.has(oldTitle)) {
      expandedBodySet.delete(oldTitle);
      expandedBodySet.add(newTitle);
    }
  }
  saveEntries();
  saveStudyLog();
  editingEntryIdx = null;
  status.textContent = '✏️ 「' + newTitle + '」を更新しました。';
  renderAll(true);
}
/* ▲▲▲ 新規追加：論証の直接編集機能 ここまで ▲▲▲ */
function buildRowHtml(e, idx, showUndo, collapseBody, searchQuery) {
  const log = studyLog[e.title] || {};
  const history = log.history || [];
  const savedDate = history.length ? history[history.length - 1] : '';
  const memorizedSaved = log.memorized || false;
  const starred = log.starred || false;
  const bookmarked = log.bookmarked || false;
  const memo = log.memo || '';
  const reviewInfo = getNextReviewInfo(e.title);
  const today = todayStr();
  let reviewCell = '-';
  let overdue = false;
  if (!memorizedSaved && reviewInfo) {
    overdue = reviewInfo.nextDateStr <= today;
    reviewCell = '<span style="' + (overdue ? 'color:#d32f2f;font-weight:bold;' : '') + '">' + reviewInfo.nextDateStr + '</span>';
  }
  const undoBtn = (showUndo && history.length > 0)
    ? '<span class="undoLastBtn2" data-idx="' + idx + '">直前を取消</span>'
    : '';
  const titleHtml = buildImportanceStarsHtml(e.importance) + highlightSearch(escapeHtml(e.title), searchQuery);
  const starHtml = '<span class="starToggle' + (starred ? ' active' : '') + '" data-idx="' + idx + '" title="苦手フラグ">😰</span>';
  const bookmarkHtml = '<span class="bookmarkToggle' + (bookmarked ? ' active' : '') + '" data-idx="' + idx + '" title="要修正ブックマーク">🔖</span>';
  const memoTitle = memo ? ('メモ：' + memo) : 'メモを追加';
  const memoHtml = '<span class="memoToggle' + (memo ? ' active' : '') + '" data-idx="' + idx + '" title="' + escapeHtml(memoTitle) + '">🗒️</span>';
  const isEditing = editingEntryIdx === idx;
  const editToggleHtml = '<span class="editToggle' + (isEditing ? ' active' : '') + '" data-idx="' + idx + '" title="内容を編集">✏️</span>';
  const titleCellContent = isEditing
    ? '<input type="text" class="editTitleInput" data-idx="' + idx + '" value="' + escapeHtml(e.title) + '">'
    : '<div class="titleCellWrap">' + starHtml + bookmarkHtml + memoHtml + editToggleHtml + '<div class="titleText">' + titleHtml + '</div></div>';
  let bodyCellContent;
  if (isEditing) {
    bodyCellContent = buildBodyEditorHtml(e, idx);
  } else if (collapseBody && !expandedBodySet.has(e.title)) {
    bodyCellContent = '<div class="bodyCellArea collapsedState" data-idx="' + idx + '">📝 タップして表示</div>';
  } else if (collapseBody) {
    bodyCellContent = '<div class="bodyCellArea" data-idx="' + idx + '">' + highlightSearch(e.bodyHtml, searchQuery) + '</div>';
  } else {
    bodyCellContent = highlightSearch(e.bodyHtml, searchQuery);
  }
  return '<tr class="entryRow' + (overdue ? ' overdueRow' : '') + (starred ? ' starredRow' : '') + (bookmarked ? ' bookmarkedRow' : '') + '" data-idx="' + idx + '">'
    + '<td class="checkCell">' + buildConfidenceGroupHtml(idx, log.confidence || null) + '</td>'
    + '<td class="verticalCol subjectCell" data-idx="' + idx + '" title="タップして科目を編集">' + escapeHtml(e.subject || '未設定') + '</td>'
    + '<td class="verticalCol">' + escapeHtml(e.category || (studyLog[e.title] && studyLog[e.title].category) || '') + '</td>'
    + '<td>' + titleCellContent + '</td>'
    + '<td>' + bodyCellContent + '</td>'
    + '<td>' + buildYearHtml(e.year) + '</td>'
    + '<td class="countCell">' + history.length + undoBtn + '</td>'
    + '<td>' + (savedDate || '-') + '</td>'
    + '<td>' + reviewCell + '</td>'
    + '</tr>';
}
function renderStudyTable(data) {
  const filtered = filterEntries(data, searchQueryStudy);
  let html = '<table>' + ENTRY_TABLE_COLGROUP + '<thead><tr><th>暗記度</th><th>科目</th><th>分野</th><th>タイトル</th><th>本文</th><th>出題年</th><th>学習回数</th><th>最終学習日</th><th>復習推奨日</th></tr></thead><tbody>';
  let count = 0;
  filtered.forEach((e) => {
    const idx = entries.indexOf(e);
    const log = studyLog[e.title] || {};
    if (log.memorized) return;
    html += buildRowHtml(e, idx, false, true, searchQueryStudy);
    count++;
  });
  html += '</tbody></table>';
  if (count === 0 && filtered.length > 0) {
    html = '<div class="reviewList"><div class="reviewItem">🎉 未暗記の論証はありません。すべて暗記済み一覧に移動済みです。</div></div>';
  } else if (filtered.length === 0) {
    html = '<div class="reviewList"><div class="reviewItem">該当する論証がありません。</div></div>';
  }
  tableWrap.innerHTML = html;
  searchCountStudy.textContent = searchQueryStudy ? count + '件見つかりました' : '';
  renderProgressSummary();
}
function renderMemorizedTable(data) {
  const filtered = filterEntries(data, searchQueryMemorized);
  let html = '<table>' + ENTRY_TABLE_COLGROUP + '<thead><tr><th>暗記度</th><th>科目</th><th>分野</th><th>タイトル</th><th>本文</th><th>出題年</th><th>学習回数</th><th>最終学習日</th><th>復習推奨日</th></tr></thead><tbody>';
  let count = 0;
  filtered.forEach((e) => {
    const idx = entries.indexOf(e);
    const log = studyLog[e.title] || {};
    if (!log.memorized) return;
    html += buildRowHtml(e, idx, true, false, searchQueryMemorized);
    count++;
  });
  html += '</tbody></table>';
  if (count === 0) {
    html = '<div class="reviewList"><div class="reviewItem">暗記済みの論証はまだありません。○バッチリを押すとここに移動します。</div></div>';
  }
  memorizedTableWrap.innerHTML = html;
  searchCountMemorized.textContent = searchQueryMemorized ? count + '件見つかりました' : '';
  renderProgressSummary();
}
function getCsvFilteredEntries() {
  const unmemorized = entries.filter(e => !(studyLog[e.title] && studyLog[e.title].memorized));
  if (selectedCsvSubject === 'all') return unmemorized;
  return unmemorized.filter(e => (e.subject || 'その他') === selectedCsvSubject);
}
function renderCsvSubjectFilter() {
  if (!csvSubjectFilter) return;
  const subjects = getUniqueSubjects();
  let html = '<option value="all"' + (selectedCsvSubject === 'all' ? ' selected' : '') + '>📚 すべて</option>';
  subjects.forEach(s => {
    html += '<option value="' + escapeHtml(s) + '"' + (selectedCsvSubject === s ? ' selected' : '') + '>' + getSubjectEmoji(s) + ' ' + escapeHtml(s) + '</option>';
  });
  csvSubjectFilter.innerHTML = html;
}
function renderCsvTable(data) {
  let html = '<table><colgroup><col style="width:14%;"><col style="width:26%;"><col style="width:46%;"><col style="width:14%;"></colgroup><thead><tr><th>Subject（科目）</th><th>FrontText（タイトル）</th><th>BackText（本文）</th><th>Comment（出題年）</th></tr></thead><tbody>';
  data.forEach(e => {
    html += '<tr><td>' + escapeHtml(e.subject || '') + '</td><td>' + escapeHtml(e.title) + '</td><td>' + escapeHtml(e.body) + '</td><td>' + buildYearHtml(e.year) + '</td></tr>';
  });
  html += '</tbody></table>';
  csvTableWrap.innerHTML = html;
}
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();
function getAllStudyDates() {
  const map = {};
  Object.keys(studyLog).forEach(title => {
    const log = studyLog[title];
    if (!log.history) return;
    log.history.forEach(dateStr => {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push({ title: title, category: log.category || '', subject: log.subject || '' });
    });
  });
  return map;
}
function getCombinedDaySummary(dateStr, dateMap) {
  const autoItems = (dateMap || getAllStudyDates())[dateStr] || [];
  const manualItems = manualLog[dateStr] || [];
  const catCounts = {};
  autoItems.forEach(it => {
    const c = (it.subject || '未分類') + ' / ' + (it.category || '未分類');
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  manualItems.forEach(it => {
    const c = (it.subject || '未分類') + ' / ' + (it.category || '未分類');
    catCounts[c] = (catCounts[c] || 0) + (Number(it.count) || 1);
  });
  const totalCount = autoItems.length + manualItems.reduce((s, it) => s + (Number(it.count) || 1), 0);
  return { autoItems, manualItems, catCounts, totalCount };
}
function getDailyStudyCounts() {
  const dateMap = getAllStudyDates();
  const counts = {};
  Object.keys(dateMap).forEach(d => { counts[d] = (counts[d] || 0) + dateMap[d].length; });
  Object.keys(manualLog).forEach(d => {
    const c = manualLog[d].reduce((s, it) => s + (Number(it.count) || 1), 0);
    counts[d] = (counts[d] || 0) + c;
  });
  return counts;
}
// --- 学習推移グラフ ---
function renderTrendChart() {
  if (!trendWrap) return;
  const dailyCounts = getDailyStudyCounts();
  const today = new Date();
  let labels = [];
  let values = [];
  if (trendMode === 'week') {
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - (w * 7));
      let sum = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const key = formatLocalDate(day);
        sum += dailyCounts[key] || 0;
      }
      const label = (weekStart.getMonth() + 1) + '/' + weekStart.getDate();
      labels.push(label);
      values.push(sum);
    }
  } else {
    for (let m = 11; m >= 0; m--) {
      const target = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const y = target.getFullYear();
      const mo = target.getMonth();
      let sum = 0;
      Object.keys(dailyCounts).forEach(dateStr => {
        const dd = new Date(dateStr + 'T00:00:00');
        if (dd.getFullYear() === y && dd.getMonth() === mo) sum += dailyCounts[dateStr];
      });
      labels.push(y + '/' + (mo + 1));
      values.push(sum);
    }
  }
  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length ? Math.round((total / values.length) * 10) / 10 : 0;

  const w = 680, h = 180, padL = 36, padR = 16, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxVal = Math.max(1, ...values);
  const stepX = values.length > 1 ? innerW / (values.length - 1) : innerW;
  const points = values.map((v, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - (v / maxVal) * innerH;
    return { x, y, v, label: labels[i] };
  });
  const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const areaD = pathD + ' L' + points[points.length - 1].x.toFixed(1) + ',' + (padT + innerH) + ' L' + points[0].x.toFixed(1) + ',' + (padT + innerH) + ' Z';
  let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="max-width:720px;">';
  svg += '<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0057e7" stop-opacity="0.25"/><stop offset="100%" stop-color="#0057e7" stop-opacity="0"/></linearGradient></defs>';
  svg += '<path d="' + areaD + '" fill="url(#trendGrad)" stroke="none"/>';
  svg += '<path d="' + pathD + '" fill="none" stroke="#0057e7" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  points.forEach((p, i) => {
    svg += '<circle class="trendPoint" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="#0057e7"><title>' + escapeHtml(p.label) + '：' + p.v + '件</title></circle>';
    if (i % Math.ceil(points.length / 8) === 0 || i === points.length - 1) {
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (h - 8) + '" font-size="9" fill="#4a6a90" text-anchor="middle">' + escapeHtml(p.label) + '</text>';
    }
  });
  svg += '<text x="' + padL + '" y="' + (padT + 4) + '" font-size="9" fill="#4a6a90">' + maxVal + '</text>';
  svg += '</svg>';
  const modeLabel = trendMode === 'week' ? '週次（直近8週間）' : '月次（直近12ヶ月）';
  trendWrap.innerHTML = '<div class="trendCard">'
    + '<div class="trendHeader">'
    + '<div class="trendTitle">📈 学習推移（' + modeLabel + '）</div>'
    + '<div class="trendToggle">'
    + '<button type="button" class="trendToggleBtn' + (trendMode === 'week' ? ' active' : '') + '" data-trend="week">週次</button>'
    + '<button type="button" class="trendToggleBtn' + (trendMode === 'month' ? ' active' : '') + '" data-trend="month">月次</button>'
    + '</div>'
    + '</div>'
    + '<div class="trendSummary">期間合計 ' + total + '件 ／ 平均 ' + avg + '件</div>'
    + '<div class="trendSvgWrap">' + svg + '</div>'
    + '</div>';
}
function buildDayDetailHtml(dateStr) {
  const summary = getCombinedDaySummary(dateStr);
  let html = '<div class="reviewList"><h4>' + dateStr + ' の学習項目（合計 ' + summary.totalCount + '件）</h4>';
  if (summary.autoItems.length === 0 && summary.manualItems.length === 0) {
    html += '<div class="reviewItem">この日の学習記録はまだありません。</div>';
  } else {
    summary.autoItems.forEach((it) => {
      html += '<div class="reviewItem">'
        + escapeHtml(it.subject || '') + ' ｜ ' + escapeHtml(it.category || '') + ' ｜ ' + escapeHtml(it.title)
        + ' <button type="button" class="deleteDayItemBtn" data-date="' + dateStr + '" data-title="' + escapeHtml(it.title) + '" style="margin-left:10px;color:#d32f2f;">削除</button>'
        + '</div>';
    });
    summary.manualItems.forEach((it, mi) => {
      html += '<div class="reviewItem">'
        + '[手動] ' + escapeHtml(it.subject || '') + ' ｜ ' + escapeHtml(it.category || '') + ' ｜ ' + (Number(it.count) || 1) + '件'
        + ' <button type="button" class="deleteManualItemBtn" data-date="' + dateStr + '" data-index="' + mi + '" style="margin-left:10px;color:#d32f2f;">削除</button>'
        + '</div>';
    });
  }
  html += '<div class="manualForm" style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;">'
    + '<strong>手動で記録を追加</strong><br>'
    + '<input type="text" id="manualSubjectInput" placeholder="科目（例：民法）" list="subjectSuggestions">'
    + '<input type="text" id="manualCategoryInput" placeholder="分野（例：総則）">'
    + '<input type="number" id="manualCountInput" placeholder="学習数" value="1" min="1" style="width:70px;">'
    + '<button type="button" id="manualAddBtn" data-date="' + dateStr + '">追加</button>'
    + '</div>';
  html += '</div>';
  return html;
}
function renderCalendar() {
  const dateMap = getAllStudyDates();
  const firstDay = new Date(calViewYear, calViewMonth, 1);
  const lastDay = new Date(calViewYear, calViewMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  let html = '<div class="monthNav">'
    + '<button id="prevMonthBtn">← 前月</button>'
    + '<strong>' + calViewYear + '年' + (calViewMonth + 1) + '月</strong>'
    + '<button id="nextMonthBtn">次月 →</button>'
    + '</div>';
  html += '<div class="calWeekRow">';
  ['日','月','火','水','木','金','土'].forEach(d => {
    html += '<div class="calWeekday">' + d + '</div>';
  });
  html += '</div>';
  html += '<div class="calGrid">';
  for (let i = 0; i < startWeekday; i++) html += '<div class="calCell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = calViewYear + '-' + String(calViewMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const summary = getCombinedDaySummary(dateStr, dateMap);
    const count = summary.totalCount;
    const catSummary = Object.keys(summary.catCounts).map(c => c + ':' + summary.catCounts[c]).join(' / ');
    const isSelected = (dateStr === selectedDay);
    html += '<div class="calCell calDayClickable' + (isSelected ? ' selectedDay' : '') + '" data-date="' + dateStr + '" style="cursor:pointer;">'
      + '<div class="calDate">' + d + '</div>'
      + (count > 0 ? '<div class="calCount">' + count + '件</div><div style="font-size:11px;color:#555;">' + escapeHtml(catSummary) + '</div>' : '')
      + '</div>';
  }
  html += '</div>';
  html += '<div id="dayDetailPanel">' + (selectedDay ? buildDayDetailHtml(selectedDay) : '') + '</div>';
  const categoryTotal = {};
  Object.values(dateMap).forEach(items => {
    items.forEach(it => {
      const c = (it.subject || '未分類') + ' / ' + (it.category || '未分類');
      categoryTotal[c] = (categoryTotal[c] || 0) + 1;
    });
  });
  Object.values(manualLog).forEach(items => {
    items.forEach(it => {
      const c = (it.subject || '未分類') + ' / ' + (it.category || '未分類');
      categoryTotal[c] = (categoryTotal[c] || 0) + (Number(it.count) || 1);
    });
  });
  html += '<h3>分野別 学習回数（全期間合計）</h3><div class="reviewList">';
  if (Object.keys(categoryTotal).length === 0) {
    html += '<div class="reviewItem">まだ学習記録がありません。</div>';
  } else {
    Object.keys(categoryTotal).sort((a,b) => categoryTotal[b] - categoryTotal[a]).forEach(c => {
      html += '<div class="reviewItem">' + escapeHtml(c) + '：' + categoryTotal[c] + '回</div>';
    });
  }
  html += '</div>';
  const today = todayStr();
  const reviewItems = [];
  entries.forEach(e => {
    if (studyLog[e.title] && studyLog[e.title].memorized) return;
    const info = getNextReviewInfo(e.title);
    if (info) {
      reviewItems.push({ title: e.title, subject: e.subject, category: e.category, nextDate: info.nextDateStr, overdue: info.nextDateStr <= today });
    }
  });
  reviewItems.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  html += '<h3>復習が推奨される論点（忘却曲線ベース）</h3><div class="reviewList">';
  const upcoming = reviewItems.filter(r => r.overdue || r.nextDate <= addDays(today, 7));
  if (upcoming.length === 0) {
    html += '<div class="reviewItem">現在、復習が近い論点はありません。</div>';
  } else {
    upcoming.slice(0, 30).forEach(r => {
      html += '<div class="reviewItem">' + escapeHtml(r.subject || '') + ' ｜ ' + escapeHtml(r.category || '') + ' ｜ ' + escapeHtml(r.title)
        + ' ｜ 推奨日: ' + r.nextDate
        + (r.overdue ? '<span class="overdueTag">復習推奨（期限超過）</span>' : '')
        + '</div>';
    });
  }
  html += '</div>';
  calendarWrap.innerHTML = html;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}
function recordStudy(idx, sourceEl) {
  const ent = entries[idx];
  if (!ent) return;
  const title = ent.title;
  const today = todayStr();
  if (!studyLog[title]) studyLog[title] = { history: [] };
  if (!studyLog[title].history) studyLog[title].history = [];
  studyLog[title].history.push(today);
  studyLog[title].category = ent.category || '';
  studyLog[title].subject = ent.subject || studyLog[title].subject || '';
  saveStudyLog();
  const newCount = studyLog[title].history.length;
  if (sourceEl) {
    sourceEl.classList.add('justClicked');
    setTimeout(() => { sourceEl.classList && sourceEl.classList.remove('justClicked'); }, 500);
  }
  status.textContent = '✅ 「' + title + '」を本日の学習として記録しました（学習回数：' + newCount + '回）';
  renderStudyTable(entries);
  renderMemorizedTable(entries);
  renderCalendar();
  renderTrendChart();
}
function undoLastStudy(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const title = ent.title;
  if (studyLog[title] && studyLog[title].history && studyLog[title].history.length > 0) {
    studyLog[title].history.pop();
    saveStudyLog();
    const newCount = studyLog[title].history.length;
    status.textContent = '「' + title + '」の直前の学習記録を取り消しました（学習回数：' + newCount + '回）';
    renderStudyTable(entries);
    renderMemorizedTable(entries);
    renderCalendar();
    renderTrendChart();
  }
}
function setConfidence(idx, level, sourceEl) {
  const ent = entries[idx];
  if (!ent) return;
  const title = ent.title;
  const today = todayStr();
  if (!studyLog[title]) studyLog[title] = { history: [] };
  if (!studyLog[title].history) studyLog[title].history = [];
  if (level === 'bad') {
    studyLog[title].history = [today];
  } else {
    const hist = studyLog[title].history;
    if (hist[hist.length - 1] !== today) hist.push(today);
  }
  studyLog[title].confidence = level;
  studyLog[title].memorized = (level === 'good');
  studyLog[title].category = ent.category || studyLog[title].category || '';
  studyLog[title].subject = ent.subject || studyLog[title].subject || '';
  saveStudyLog();
  if (level === 'good') {
    if (sourceEl) triggerFireworkLevelUp(sourceEl);
    status.textContent = '🎉 「' + title + '」を暗記済み一覧に移動しました！';
  } else if (level === 'unsure') {
    status.textContent = '「' + title + '」を「あやしい」に設定しました。復習間隔を短縮します。';
  } else {
    status.textContent = '「' + title + '」を「ダメ」に設定しました。明日また復習しましょう。';
  }
  renderStudyTable(entries);
  renderMemorizedTable(entries);
  renderCalendar();
  renderTrendChart();
}
function toggleStar(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const title = ent.title;
  if (!studyLog[title]) studyLog[title] = { history: [] };
  studyLog[title].starred = !studyLog[title].starred;
  studyLog[title].category = ent.category || studyLog[title].category || '';
  studyLog[title].subject = ent.subject || studyLog[title].subject || '';
  saveStudyLog();
  status.textContent = studyLog[title].starred ? '😰 「' + title + '」を苦手フラグに追加しました。' : '「' + title + '」の苦手フラグを外しました。';
  renderStudyTable(entries);
  renderMemorizedTable(entries);
}
function toggleBookmark(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const title = ent.title;
  if (!studyLog[title]) studyLog[title] = { history: [] };
  studyLog[title].bookmarked = !studyLog[title].bookmarked;
  studyLog[title].category = ent.category || studyLog[title].category || '';
  studyLog[title].subject = ent.subject || studyLog[title].subject || '';
  saveStudyLog();
  status.textContent = studyLog[title].bookmarked ? '🔖 「' + title + '」を要修正としてブックマークしました。' : '「' + title + '」のブックマークを外しました。';
  renderStudyTable(entries);
  renderMemorizedTable(entries);
}
function toggleSkip(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const title = ent.title;
  if (!studyLog[title]) studyLog[title] = { history: [] };
  studyLog[title].skipped = !studyLog[title].skipped;
  studyLog[title].category = ent.category || studyLog[title].category || '';
  studyLog[title].subject = ent.subject || studyLog[title].subject || '';
  saveStudyLog();
  status.textContent = studyLog[title].skipped ? '⏭️ 「' + title + '」をスキップしました（ランダム出題から除外）。' : '「' + title + '」のスキップを解除しました。';
  renderStudyTable(entries);
  renderMemorizedTable(entries);
}
function editSubject(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const knownSubjects = ['民法','刑法','憲法','商法','民事訴訟法','刑事訴訟法','行政法','労働法','実務基礎民事','実務基礎刑事'];
  const input = prompt('科目を入力してください（例：' + knownSubjects.join('、') + '）', ent.subject || '');
  if (input === null) return;
  const trimmed = input.trim();
  ent.subject = trimmed;
  if (studyLog[ent.title]) studyLog[ent.title].subject = trimmed;
  saveEntries();
  saveStudyLog();
  status.textContent = '「' + ent.title + '」の科目を「' + (trimmed || '未設定') + '」に変更しました。';
  renderStudyTable(entries);
  renderMemorizedTable(entries);
}
function editMemo(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const current = (studyLog[ent.title] && studyLog[ent.title].memo) || '';
  const input = prompt('「' + ent.title + '」のメモ（間違えたポイントなど）を入力してください', current);
  if (input === null) return;
  const trimmed = input.trim();
  if (!studyLog[ent.title]) studyLog[ent.title] = { history: [] };
  studyLog[ent.title].memo = trimmed;
  studyLog[ent.title].category = ent.category || studyLog[ent.title].category || '';
  studyLog[ent.title].subject = ent.subject || studyLog[ent.title].subject || '';
  saveStudyLog();
  status.textContent = trimmed ? '📝 「' + ent.title + '」にメモを保存しました。' : '「' + ent.title + '」のメモを削除しました。';
  renderStudyTable(entries);
  renderMemorizedTable(entries);
}
function toggleBodyExpand(idx) {
  const ent = entries[idx];
  if (!ent) return;
  if (expandedBodySet.has(ent.title)) {
    expandedBodySet.delete(ent.title);
  } else {
    expandedBodySet.add(ent.title);
  }
  renderStudyTable(entries);
}
function attachTableClickHandler(wrapEl) {
  wrapEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.editColorSwatch') || e.target.closest('.editColorClearBtn') || e.target.closest('.editBoldBtn')) {
      e.preventDefault();
    }
  });
  wrapEl.addEventListener('click', (e) => {
    const editToggle = e.target.closest('.editToggle');
    if (editToggle) {
      e.stopPropagation();
      const idx = Number(editToggle.dataset.idx);
      editingEntryIdx = editingEntryIdx === idx ? null : idx;
      renderStudyTable(entries);
      renderMemorizedTable(entries);
      return;
    }
    const boldBtn = e.target.closest('.editBoldBtn');
    if (boldBtn) {
      e.stopPropagation();
      applyBodyEditorBold();
      return;
    }
    const colorSwatch = e.target.closest('.editColorSwatch');
    if (colorSwatch) {
      e.stopPropagation();
      applyBodyEditorColor(colorSwatch.dataset.color);
      return;
    }
    const colorClearBtn = e.target.closest('.editColorClearBtn');
    if (colorClearBtn) {
      e.stopPropagation();
      document.execCommand('removeFormat');
      return;
    }
    const editSaveBtn = e.target.closest('.editSaveBtn');
    if (editSaveBtn) {
      e.stopPropagation();
      saveEntryEdit(Number(editSaveBtn.dataset.idx));
      return;
    }
    const editCancelBtn = e.target.closest('.editCancelBtn');
    if (editCancelBtn) {
      e.stopPropagation();
      editingEntryIdx = null;
      renderStudyTable(entries);
      renderMemorizedTable(entries);
      return;
    }
    const confBtn = e.target.closest('.confBtn');
    if (confBtn) {
      e.stopPropagation();
      setConfidence(Number(confBtn.dataset.idx), confBtn.dataset.level, confBtn);
      return;
    }
    const starToggle = e.target.closest('.starToggle');
    if (starToggle) {
      e.stopPropagation();
      toggleStar(Number(starToggle.dataset.idx));
      return;
    }
    const bookmarkToggle = e.target.closest('.bookmarkToggle');
    if (bookmarkToggle) {
      e.stopPropagation();
      toggleBookmark(Number(bookmarkToggle.dataset.idx));
      return;
    }
    const memoToggle = e.target.closest('.memoToggle');
    if (memoToggle) {
      e.stopPropagation();
      editMemo(Number(memoToggle.dataset.idx));
      return;
    }
    const subjectCell = e.target.closest('.subjectCell');
    if (subjectCell) {
      e.stopPropagation();
      editSubject(Number(subjectCell.dataset.idx));
      return;
    }
    const bodyArea = e.target.closest('.bodyCellArea');
    if (bodyArea) {
      e.stopPropagation();
      const idx = Number(bodyArea.dataset.idx);
      const ent = entries[idx];
      const wasCollapsed = !!(ent && !expandedBodySet.has(ent.title));
      toggleBodyExpand(idx);
      if (wasCollapsed) {
        recordStudy(idx, bodyArea);
      }
      return;
    }
    const undoBtn = e.target.closest('.undoLastBtn2');
    if (undoBtn) {
      e.stopPropagation();
      undoLastStudy(Number(undoBtn.dataset.idx));
      return;
    }
    // 本文の「タップして表示」以外の余白をクリックしても学習回数には反映しない
  });
}
attachTableClickHandler(tableWrap);
attachTableClickHandler(memorizedTableWrap);
document.addEventListener('change', (e) => {
  const subjectTabSelect = e.target.closest('.subjectTabSelect');
  if (subjectTabSelect) {
    selectedSubject = subjectTabSelect.value;
    selectedCategory = 'all';
    renderSubjectTabs();
    renderStudyTable(entries);
    renderMemorizedTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
});
document.addEventListener('click', (e) => {
  const trendToggleBtn = e.target.closest('.trendToggleBtn');
  if (trendToggleBtn) {
    trendMode = trendToggleBtn.dataset.trend;
    renderTrendChart();
    return;
  }
  const categoryTabBtn = e.target.closest('.categoryTabBtn');
  if (categoryTabBtn) {
    selectedCategory = categoryTabBtn.dataset.category;
    renderSubjectTabs();
    renderStudyTable(entries);
    renderMemorizedTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const starTabBtn = e.target.closest('.starFilterBtn[data-star]');
  if (starTabBtn) {
    starOnlyFilter = (starTabBtn.dataset.star === 'only');
    bookmarkOnlyFilter = (starTabBtn.dataset.star === 'bookmark');
    renderSubjectTabs();
    renderStudyTable(entries);
    renderMemorizedTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const importanceTabBtn = e.target.closest('.starFilterBtn[data-importance]');
  if (importanceTabBtn) {
    const v = importanceTabBtn.dataset.importance;
    selectedImportance = (v === 'all') ? 'all' : Number(v);
    renderSubjectTabs();
    renderStudyTable(entries);
    renderMemorizedTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const freqTabBtn = e.target.closest('.starFilterBtn[data-freq]');
  if (freqTabBtn) {
    minYearFrequency = Number(freqTabBtn.dataset.freq);
    renderSubjectTabs();
    renderStudyTable(entries);
    renderMemorizedTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const freqSortBtn = e.target.closest('#freqSortBtn');
  if (freqSortBtn) {
    sortByFrequency = !sortByFrequency;
    renderSubjectTabs();
    renderStudyTable(entries);
    renderMemorizedTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const delBtn = e.target.closest('.deleteDayItemBtn');
  if (delBtn) {
    const d = delBtn.dataset.date;
    const t = delBtn.dataset.title;
    if (studyLog[t] && studyLog[t].history) {
      const idx = studyLog[t].history.indexOf(d);
      if (idx !== -1) {
        studyLog[t].history.splice(idx, 1);
        saveStudyLog();
        renderStudyTable(entries);
        renderMemorizedTable(entries);
        renderCalendar();
        renderTrendChart();
      }
    }
    return;
  }
  const deleteManualBtn = e.target.closest('.deleteManualItemBtn');
  if (deleteManualBtn) {
    const d = deleteManualBtn.dataset.date;
    const idx = Number(deleteManualBtn.dataset.index);
    if (manualLog[d]) {
      manualLog[d].splice(idx, 1);
      if (manualLog[d].length === 0) delete manualLog[d];
      saveManualLog();
      renderCalendar();
      renderTrendChart();
    }
    return;
  }
  const manualAddBtn = e.target.closest('#manualAddBtn');
  if (manualAddBtn) {
    const d = manualAddBtn.dataset.date;
    const subjectInput = document.getElementById('manualSubjectInput');
    const categoryInput = document.getElementById('manualCategoryInput');
    const countInput = document.getElementById('manualCountInput');
    const subject = subjectInput ? subjectInput.value.trim() : '';
    const category = categoryInput ? categoryInput.value.trim() : '';
    const count = Math.max(1, parseInt(countInput ? countInput.value : '1', 10) || 1);
    if (!subject) {
      alert('科目を入力してください。');
      return;
    }
    if (!manualLog[d]) manualLog[d] = [];
    manualLog[d].push({ subject: subject, category: category, count: count });
    saveManualLog();
    renderCalendar();
    renderTrendChart();
    return;
  }
  const prevBtn = e.target.closest('#prevMonthBtn');
  if (prevBtn) {
    calViewMonth--;
    if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
    selectedDay = null;
    renderCalendar();
    return;
  }
  const nextBtn = e.target.closest('#nextMonthBtn');
  if (nextBtn) {
    calViewMonth++;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    selectedDay = null;
    renderCalendar();
    return;
  }
  const dayCell = e.target.closest('.calDayClickable');
  if (dayCell) {
    const d = dayCell.dataset.date;
    selectedDay = (selectedDay === d) ? null : d;
    renderCalendar();
    return;
  }
});
function toCsv(data) {
  const header = ['Subject','FrontText','BackText','Comment','FrontTextLanguage','BackTextLanguage'];
  const rows = data.map(e => [e.subject || '', e.title, e.body, yearStrToPlainText(e.year), 'ja-JP', 'ja-JP']);
  const escapeCsv = v => {
    if (v == null) v = '';
    v = String(v);
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      v = '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  const lines = [header.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  return lines.join('\r\n');
}
downloadBtn.addEventListener('click', () => {
  const filtered = getCsvFilteredEntries();
  const csv = toCsv(filtered);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '論証集_WordHolic.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  const subjectLabel = selectedCsvSubject === 'all' ? '全科目' : selectedCsvSubject;
  status.textContent = subjectLabel + '（暗記済み除外）で' + filtered.length + '件をCSV出力しました。';
});
downloadLogBtn.addEventListener('click', () => {
  const header = ['科目', '分野', 'タイトル', '学習回数', '最終学習日', '次回推奨復習日', '暗記度', '苦手フラグ'];
  const rows = entries.map(e => {
    const log = studyLog[e.title] || {};
    const history = log.history || [];
    const lastDate = history.length ? history[history.length - 1] : '';
    const info = getNextReviewInfo(e.title);
    const confLabel = log.confidence === 'good' ? 'バッチリ' : (log.confidence === 'unsure' ? 'あやしい' : (log.confidence === 'bad' ? 'ダメ' : ''));
    return [e.subject || '', e.category || '', e.title, history.length, lastDate, info ? info.nextDateStr : '', confLabel, log.starred ? '😰' : ''];
  });
  const escapeCsv = v => {
    if (v == null) v = '';
    v = String(v);
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      v = '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  const lines = [header.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  const csv = lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '学習ログ.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
// --- ランダム出題モード ---
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getStudyCountFor(e) {
  const log = studyLog[e.title];
  return (log && log.history) ? log.history.length : 0;
}
function isOverdueEntry(e) {
  if (studyLog[e.title] && studyLog[e.title].memorized) return false;
  const info = getNextReviewInfo(e.title);
  if (!info) return false;
  return info.nextDateStr <= todayStr();
}
function isStudiedToday(e) {
  const log = studyLog[e.title];
  const history = log && log.history;
  if (!history || history.length === 0) return false;
  return history[history.length - 1] === todayStr();
}
function isWeakEntry(e) {
  return !!(studyLog[e.title] && studyLog[e.title].starred);
}
function isSkippedEntry(e) {
  return !!(studyLog[e.title] && studyLog[e.title].skipped);
}
function buildQuizPool() {
  let pool = filterEntries(entries, '');
  if (quizExcludeTodayChk.checked) {
    pool = pool.filter(e => !isStudiedToday(e));
  }
  if (quizWeakOnlyChk.checked) {
    pool = pool.filter(isWeakEntry);
  }
  if (quizSkippedOnlyChk.checked) {
    pool = pool.filter(isSkippedEntry);
  } else {
    pool = pool.filter(e => !isSkippedEntry(e));
  }
  quizOverdueMode = quizOverdueOnlyChk.checked;
  if (quizOverdueMode) {
    pool = pool.filter(isOverdueEntry);
    quizMinCount = 0;
    return shuffleArray(pool);
  }
  if (!quizIncludeMemorizedChk.checked) {
    pool = pool.filter(e => !(studyLog[e.title] && studyLog[e.title].memorized));
  }
  if (pool.length === 0) {
    quizMinCount = 0;
    return [];
  }
  const minCount = Math.min(...pool.map(getStudyCountFor));
  quizMinCount = minCount;
  pool = pool.filter(e => getStudyCountFor(e) === minCount);
  return shuffleArray(pool);
}
function startQuiz() {
  quizPool = buildQuizPool();
  quizIndex = 0;
  quizRevealed = false;
  quizStarted = true;
  renderQuizPage();
}
function renderQuizPage() {
  if (entries.length === 0) {
    quizPriorityNote.textContent = '';
    quizArea.innerHTML = '<div class="quizEmpty">まずはWordファイルを読み込んでください。</div>';
    return;
  }
  if (!quizStarted) {
    quizPriorityNote.textContent = '';
    quizArea.innerHTML = '<div class="quizEmpty">「スタート／シャッフルし直す」を押すと出題が始まります。</div>';
    return;
  }
  const extraNotes = [];
  if (quizExcludeTodayChk.checked) extraNotes.push('本日学習済みは除外');
  if (quizWeakOnlyChk.checked) extraNotes.push('😰苦手のみ');
  if (quizSkippedOnlyChk.checked) extraNotes.push('⏭️スキップのみ');
  const extraNote = extraNotes.length ? '（' + extraNotes.join('・') + '）' : '';
  if (quizPool.length === 0) {
    quizPriorityNote.textContent = '';
    quizArea.innerHTML = quizOverdueMode
      ? '<div class="quizEmpty">🎉 復習期限が来ている論証はありません' + extraNote + '。</div>'
      : (quizSkippedOnlyChk.checked
        ? '<div class="quizEmpty">⏭️ スキップした論証はありません。</div>'
        : '<div class="quizEmpty">出題対象の論証がありません' + extraNote + '。範囲や「暗記済みも含める」設定を見直してください。</div>');
    return;
  }
  quizPriorityNote.innerHTML = quizOverdueMode
    ? '⏰ 復習推奨日を過ぎている論点 <strong>' + quizPool.length + '件</strong>' + extraNote + ' のみを出題しています。'
    : '📌 学習回数が最も少ない（<strong>' + quizMinCount + '回</strong>）論点 <strong>' + quizPool.length + '件</strong>' + extraNote + ' のみを出題しています。この回数のものを一通り学習すると、次回はより多く学習した論点が対象から外れ、新しい最少回数のグループが出題されます。';
  if (quizIndex >= quizPool.length) {
    quizArea.innerHTML = '<div class="quizCard"><div class="quizFinished">🎉 全' + quizPool.length + '問終了しました！お疲れさまでした。もう一度「スタート／シャッフルし直す」を押すと、更新された学習回数に基づいて次の優先グループが出題されます。</div></div>';
    return;
  }
  const e = quizPool[quizIndex];
  const idx = entries.findIndex(x => x.title === e.title);
  const isEditingThis = idx !== -1 && editingEntryIdx === idx;
  const isBookmarked = !!(studyLog[e.title] && studyLog[e.title].bookmarked);
  const isSkipped = !!(studyLog[e.title] && studyLog[e.title].skipped);
  const quizMemo = (studyLog[e.title] && studyLog[e.title].memo) || '';
  let html = '<div class="quizCard">';
  html += '<div class="quizCardTools">'
    + '<span class="quizMemoBtn' + (quizMemo ? ' active' : '') + '" id="quizMemoBtn" title="' + escapeHtml(quizMemo ? ('メモ：' + quizMemo) : 'メモを追加') + '">🗒️</span>'
    + '<span class="quizBookmarkBtn' + (isBookmarked ? ' active' : '') + '" id="quizBookmarkBtn" title="内容修正が必要な論証としてブックマーク">🔖</span>'
    + '<span class="quizSkipBtn' + (isSkipped ? ' active' : '') + '" id="quizSkipBtn" title="スキップ（ランダム出題から除外）">⏭️</span>'
    + '<span class="quizEditBtn' + (isEditingThis ? ' active' : '') + '" id="quizEditBtn" title="内容を編集">✏️</span>'
    + '</div>';
  html += '<div class="quizProgress">' + (quizIndex + 1) + ' / ' + quizPool.length + '問</div>';
  html += '<div class="quizMeta">' + escapeHtml(e.subject || '') + ' ｜ ' + escapeHtml(e.category || '') + '</div>';
  if (isEditingThis) {
    html += '<input type="text" class="editTitleInput" data-idx="' + idx + '" value="' + escapeHtml(e.title) + '">';
    html += buildBodyEditorHtml(e, idx);
  } else {
  html += '<div class="quizTitle">' + buildImportanceStarsHtml(e.importance) + escapeHtml(e.title) + '</div>';
  if (!quizRevealed) {
    html += '<div class="quizShowBtn" id="quizShowBtn">📖 本文を表示</div>';
  } else {
    html += '<div class="quizBody">' + e.bodyHtml + '</div>';
    html += '<div class="quizYear">出題年：' + (buildYearHtml(e.year) || 'なし') + '</div>';
    const isWeak = !!(studyLog[e.title] && studyLog[e.title].starred);
    html += '<div class="quizJudgeRow">'
      + '<button type="button" class="quizGoodBtn" id="quizGoodBtn"><span class="quizJudgeIcon">○</span>バッチリ</button>'
      + '<button type="button" class="quizUnsureBtn" id="quizUnsureBtn"><span class="quizJudgeIcon">△</span>あやしい</button>'
      + '<button type="button" class="quizBadBtn" id="quizBadBtn"><span class="quizJudgeIcon">✕</span>ダメ</button>'
      + '<button type="button" class="quizWeakBtn' + (isWeak ? ' active' : '') + '" id="quizWeakBtn"><span class="quizJudgeIcon">😰</span>苦手</button>'
      + '</div>';
  }
  }
  html += '</div>';
  quizArea.innerHTML = html;
  const showBtn = document.getElementById('quizShowBtn');
  if (showBtn) {
    showBtn.addEventListener('click', () => {
      quizRevealed = true;
      renderQuizPage();
    });
  }
  function advanceQuiz(level, sourceEl) {
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) setConfidence(idx, level, sourceEl);
    quizIndex++;
    quizRevealed = false;
    renderQuizPage();
  }
  const goodBtn = document.getElementById('quizGoodBtn');
  if (goodBtn) goodBtn.addEventListener('click', () => advanceQuiz('good', goodBtn));
  const unsureBtn = document.getElementById('quizUnsureBtn');
  if (unsureBtn) unsureBtn.addEventListener('click', () => advanceQuiz('unsure', unsureBtn));
  const badBtn = document.getElementById('quizBadBtn');
  if (badBtn) badBtn.addEventListener('click', () => advanceQuiz('bad', badBtn));
  const weakBtn = document.getElementById('quizWeakBtn');
  if (weakBtn) weakBtn.addEventListener('click', () => {
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) toggleStar(idx);
    renderQuizPage();
  });
  const bookmarkBtn = document.getElementById('quizBookmarkBtn');
  if (bookmarkBtn) bookmarkBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) toggleBookmark(idx);
    renderQuizPage();
  });
  const memoBtn = document.getElementById('quizMemoBtn');
  if (memoBtn) memoBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) editMemo(idx);
    renderQuizPage();
  });
  const skipBtn = document.getElementById('quizSkipBtn');
  if (skipBtn) skipBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const wasSkipped = !!(studyLog[e.title] && studyLog[e.title].skipped);
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) toggleSkip(idx);
    if (!wasSkipped) {
      quizIndex++;
      quizRevealed = false;
    }
    renderQuizPage();
  });
  const quizEditBtn = document.getElementById('quizEditBtn');
  if (quizEditBtn) quizEditBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx === -1) return;
    editingEntryIdx = editingEntryIdx === idx ? null : idx;
    renderQuizPage();
  });
  if (isEditingThis) {
    quizArea.addEventListener('mousedown', (evt) => {
      if (evt.target.closest('.editColorSwatch') || evt.target.closest('.editColorClearBtn') || evt.target.closest('.editBoldBtn')) {
        evt.preventDefault();
      }
    });
    const boldBtn = quizArea.querySelector('.editBoldBtn');
    if (boldBtn) boldBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      applyBodyEditorBold();
    });
    const colorSwatches = quizArea.querySelectorAll('.editColorSwatch');
    colorSwatches.forEach(sw => sw.addEventListener('click', (evt) => {
      evt.stopPropagation();
      applyBodyEditorColor(sw.dataset.color);
    }));
    const colorClearBtn = quizArea.querySelector('.editColorClearBtn');
    if (colorClearBtn) colorClearBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      document.execCommand('removeFormat');
    });
    const editSaveBtn = quizArea.querySelector('.editSaveBtn');
    if (editSaveBtn) editSaveBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      saveEntryEdit(Number(editSaveBtn.dataset.idx));
    });
    const editCancelBtn = quizArea.querySelector('.editCancelBtn');
    if (editCancelBtn) editCancelBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      editingEntryIdx = null;
      renderQuizPage();
    });
  }
}

/* ▼▼▼ 新規追加：論証の読み上げ機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼
   既存の entries / studyLog などには一切触れていません。ブラウザ標準の音声合成（Web Speech API）を使用します。 */
let speechQueue = [];
let speechIndex = 0;
let speechIsPlaying = false;

const SPEECH_DICT_KEY = 'ronshoSpeechDictV1';
const SPEECH_DICT_DEFAULT = [
  { word: '瑕疵', reading: 'かし' },
  { word: '相殺', reading: 'そうさい' },
  { word: '幇助', reading: 'ほうじょ' },
  { word: '教唆', reading: 'きょうさ' },
  { word: '心裡留保', reading: 'しんりりゅうほ' },
  { word: '表見代理', reading: 'ひょうけんだいり' },
  { word: '既判力', reading: 'きはんりょく' },
  { word: '不当利得', reading: 'ふとうりとく' },
  { word: '詐害行為', reading: 'さがいこうい' },
  { word: '帰責事由', reading: 'きせきじゆう' }
];
let speechDict = [];
function loadSpeechDict() {
  try {
    const raw = localStorage.getItem(SPEECH_DICT_KEY);
    speechDict = raw ? JSON.parse(raw) : SPEECH_DICT_DEFAULT.slice();
  } catch (e) {
    speechDict = SPEECH_DICT_DEFAULT.slice();
  }
}
function saveSpeechDict() {
  localStorage.setItem(SPEECH_DICT_KEY, JSON.stringify(speechDict));
}
loadSpeechDict();
function applySpeechDict(text) {
  if (!text) return '';
  const sorted = [...speechDict].sort((a, b) => b.word.length - a.word.length);
  let out = text;
  sorted.forEach(({ word, reading }) => {
    if (!word) return;
    out = out.split(word).join(reading);
  });
  return out;
}
let speechDictListVisible = false;
function renderSpeechDictToggle() {
  const btn = document.getElementById('speechDictToggleBtn');
  if (!btn) return;
  btn.textContent = (speechDictListVisible ? '▼ 登録一覧を隠す' : '▶ 登録一覧を表示する') + '（' + speechDict.length + '件）';
}
function renderSpeechDictList() {
  const wrap = document.getElementById('speechDictListWrap');
  if (!wrap) return;
  wrap.style.display = speechDictListVisible ? '' : 'none';
  renderSpeechDictToggle();
  if (speechDict.length === 0) {
    wrap.innerHTML = '<div class="speechDictEmpty">登録された読み方はありません。</div>';
    return;
  }
  wrap.innerHTML = speechDict.map((d, idx) =>
    '<div class="speechDictRow" data-idx="' + idx + '">'
    + '<span class="speechDictWord">' + escapeHtml(d.word) + '</span>'
    + '<span class="speechDictArrow">→</span>'
    + '<span class="speechDictReading">' + escapeHtml(d.reading) + '</span>'
    + '<span class="speechDictDeleteBtn" data-idx="' + idx + '">🗑</span>'
    + '</div>'
  ).join('');
}
document.getElementById('speechDictAddBtn').addEventListener('click', () => {
  const wordInput = document.getElementById('speechDictWordInput');
  const readingInput = document.getElementById('speechDictReadingInput');
  const word = wordInput.value.trim();
  const reading = readingInput.value.trim();
  if (!word || !reading) {
    alert('表記と読みの両方を入力してください。');
    return;
  }
  const existingIdx = speechDict.findIndex(d => d.word === word);
  if (existingIdx !== -1) speechDict[existingIdx].reading = reading;
  else speechDict.push({ word, reading });
  saveSpeechDict();
  wordInput.value = '';
  readingInput.value = '';
  renderSpeechDictList();
});
document.getElementById('speechDictListWrap').addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.speechDictDeleteBtn');
  if (!deleteBtn) return;
  const idx = Number(deleteBtn.dataset.idx);
  speechDict.splice(idx, 1);
  saveSpeechDict();
  renderSpeechDictList();
});
document.getElementById('speechDictToggleBtn').addEventListener('click', () => {
  speechDictListVisible = !speechDictListVisible;
  renderSpeechDictList();
});
renderSpeechDictList();

function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
let speechWakeLock = null;
async function acquireSpeechWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    speechWakeLock = await navigator.wakeLock.request('screen');
    speechWakeLock.addEventListener('release', () => { speechWakeLock = null; });
  } catch (e) {
    speechWakeLock = null;
  }
}
function releaseSpeechWakeLock() {
  if (speechWakeLock) {
    speechWakeLock.release().catch(() => {});
    speechWakeLock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && speechIsPlaying && !speechWakeLock) {
    acquireSpeechWakeLock();
  }
});
function renderSpeechSubjectSelect() {
  const sel = document.getElementById('speechSubjectSelect');
  if (!sel) return;
  const subjects = getUniqueSubjects();
  const current = sel.value || 'all';
  let html = '<option value="all">📚 すべて</option>';
  subjects.forEach(s => {
    html += '<option value="' + escapeHtml(s) + '">' + getSubjectEmoji(s) + ' ' + escapeHtml(s) + '</option>';
  });
  sel.innerHTML = html;
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
  renderSpeechCategorySelect();
}
function getSpeechCategories(subject) {
  const scoped = subject === 'all' ? entries : entries.filter(e => (e.subject || 'その他') === subject);
  const seen = [];
  scoped.forEach(e => {
    const c = e.category || '未分類';
    if (!seen.includes(c)) seen.push(c);
  });
  return seen;
}
function renderSpeechCategorySelect() {
  const sel = document.getElementById('speechCategorySelect');
  const subjectSel = document.getElementById('speechSubjectSelect');
  if (!sel) return;
  const subject = subjectSel ? subjectSel.value : 'all';
  const categories = getSpeechCategories(subject);
  const current = sel.value || 'all';
  let html = '<option value="all">すべての分野</option>';
  categories.forEach(c => {
    html += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
  });
  sel.innerHTML = html;
  sel.value = [...sel.options].some(o => o.value === current) ? current : 'all';
}
function buildSpeechQueue() {
  const sel = document.getElementById('speechSubjectSelect');
  const subject = sel ? sel.value : 'all';
  const catSel = document.getElementById('speechCategorySelect');
  const category = catSel ? catSel.value : 'all';
  const includeMemorized = document.getElementById('speechIncludeMemorizedChk').checked;
  return entries.filter(e => {
    if (subject !== 'all' && (e.subject || 'その他') !== subject) return false;
    if (category !== 'all' && (e.category || '未分類') !== category) return false;
    if (!includeMemorized && studyLog[e.title] && studyLog[e.title].memorized) return false;
    return true;
  });
}
function renderSpeechStatus(text) {
  const el = document.getElementById('speechStatus');
  if (el) el.textContent = text;
}
function renderSpeechCurrentCard() {
  const el = document.getElementById('speechCurrentCard');
  if (!el) return;
  if (speechQueue.length === 0) {
    el.innerHTML = '<div class="speechEmpty">対象の論証がありません。科目や「暗記済みも含める」の設定を見直してください。</div>';
    return;
  }
  const e = speechQueue[speechIndex];
  el.innerHTML = '<div class="speechProgress">' + (speechIndex + 1) + ' / ' + speechQueue.length + '問</div>'
    + '<div class="speechMeta">' + escapeHtml(e.subject || '') + ' ｜ ' + escapeHtml(e.category || '') + '</div>'
    + '<div class="speechTitle">' + escapeHtml(e.title) + '</div>'
    + '<div class="speechBody">' + (e.bodyHtml || escapeHtml(e.body || '')) + '</div>';
}
function speakCurrentEntry() {
  if (!speechSupported()) {
    renderSpeechStatus('お使いのブラウザは読み上げ機能に対応していません。');
    return;
  }
  if (speechQueue.length === 0) return;
  const e = speechQueue[speechIndex];
  renderSpeechCurrentCard();
  window.speechSynthesis.cancel();
  const rateSel = document.getElementById('speechRateSelect');
  const rate = rateSel ? Number(rateSel.value) || 1 : 1;
  const spokenText = applySpeechDict(e.title) + '。' + applySpeechDict(e.body);
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = 'ja-JP';
  utterance.rate = rate;
  utterance.onend = () => {
    if (!speechIsPlaying) return;
    const loopSel = document.getElementById('speechLoopSelect');
    const loopMode = loopSel ? loopSel.value : 'none';
    if (loopMode === 'one') {
      speakCurrentEntry();
    } else if (speechIndex < speechQueue.length - 1) {
      speechIndex++;
      speakCurrentEntry();
    } else if (loopMode === 'all') {
      speechIndex = 0;
      speakCurrentEntry();
    } else {
      speechIsPlaying = false;
      releaseSpeechWakeLock();
      renderSpeechStatus('🎉 すべて読み上げが終了しました。');
    }
  };
  utterance.onerror = () => {
    speechIsPlaying = false;
    releaseSpeechWakeLock();
    renderSpeechStatus('読み上げ中にエラーが発生しました。');
  };
  renderSpeechStatus('🔊 読み上げ中… (' + (speechIndex + 1) + ' / ' + speechQueue.length + ')');
  window.speechSynthesis.speak(utterance);
}
function startSpeech() {
  if (!speechSupported()) {
    renderSpeechStatus('お使いのブラウザは読み上げ機能に対応していません。');
    return;
  }
  acquireSpeechWakeLock();
  if (window.speechSynthesis.paused && speechQueue.length > 0) {
    window.speechSynthesis.resume();
    speechIsPlaying = true;
    renderSpeechStatus('🔊 読み上げ中… (' + (speechIndex + 1) + ' / ' + speechQueue.length + ')');
    return;
  }
  if (speechQueue.length === 0) {
    speechQueue = buildSpeechQueue();
    speechIndex = 0;
  } else {
    speechIndex = Math.min(speechIndex, speechQueue.length - 1);
  }
  speechIsPlaying = true;
  renderSpeechCurrentCard();
  speakCurrentEntry();
}
function pauseSpeech() {
  if (!speechSupported()) return;
  window.speechSynthesis.pause();
  releaseSpeechWakeLock();
  renderSpeechStatus('⏸ 一時停止中');
}
function stopSpeech() {
  if (!speechSupported()) return;
  speechIsPlaying = false;
  window.speechSynthesis.cancel();
  releaseSpeechWakeLock();
  renderSpeechStatus('⏹ 停止しました');
}
function speechStep(delta) {
  if (speechQueue.length === 0) return;
  const wasPlaying = speechIsPlaying;
  speechIsPlaying = false;
  window.speechSynthesis.cancel();
  speechIndex = Math.min(Math.max(speechIndex + delta, 0), speechQueue.length - 1);
  renderSpeechCurrentCard();
  if (wasPlaying) {
    speechIsPlaying = true;
    speakCurrentEntry();
  }
}
document.getElementById('speechPlayBtn').addEventListener('click', startSpeech);
document.getElementById('speechPauseBtn').addEventListener('click', pauseSpeech);
document.getElementById('speechStopBtn').addEventListener('click', stopSpeech);
document.getElementById('speechNextBtn').addEventListener('click', () => speechStep(1));
document.getElementById('speechPrevBtn').addEventListener('click', () => speechStep(-1));
document.getElementById('speechSubjectSelect').addEventListener('change', () => {
  stopSpeech();
  renderSpeechCategorySelect();
  speechQueue = buildSpeechQueue();
  speechIndex = 0;
  renderSpeechCurrentCard();
  renderSpeechStatus('');
});
document.getElementById('speechCategorySelect').addEventListener('change', () => {
  stopSpeech();
  speechQueue = buildSpeechQueue();
  speechIndex = 0;
  renderSpeechCurrentCard();
  renderSpeechStatus('');
});
document.getElementById('speechIncludeMemorizedChk').addEventListener('change', () => {
  stopSpeech();
  speechQueue = buildSpeechQueue();
  speechIndex = 0;
  renderSpeechCurrentCard();
  renderSpeechStatus('');
});
/* ▲▲▲ 新規追加：論証の読み上げ機能 ここまで ▲▲▲ */

/* ▼▼▼ 新規追加：試験までのカウントダウン機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼
   既存の entries / studyLog などには一切触れていません。保存先も専用のキー 'ronshoCountdowns_v1' のみを使用します。 */
const COUNTDOWN_KEY = 'ronshoCountdowns_v1';

function loadCountdowns() {
  try {
    const raw = localStorage.getItem(COUNTDOWN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('カウントダウンの読み込みに失敗しました:', e);
    return [];
  }
}

function saveCountdowns(list) {
  try {
    localStorage.setItem(COUNTDOWN_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('カウントダウンの保存に失敗しました:', e);
  }
}

function getDaysUntil(dateStr) {
  const today = new Date(todayStr() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function renderCountdownCard() {
  const el = document.getElementById('countdownCard');
  if (!el) return;
  const list = loadCountdowns();
  const withDays = list.map(c => ({ ...c, days: getDaysUntil(c.date) }));
  const upcoming = withDays.filter(c => c.days >= 0).sort((a, b) => a.days - b.days);
  const past = withDays.filter(c => c.days < 0).sort((a, b) => b.days - a.days);
  const ordered = upcoming.concat(past);

  const itemsHtml = ordered.map(c => {
    const isPast = c.days < 0;
    const daysLabel = isPast ? (Math.abs(c.days) + '日経過') : (c.days === 0 ? '本日！' : 'あと' + c.days + '日');
    const urgentClass = (!isPast && c.days <= 7) ? ' countdownUrgent' : (isPast ? ' countdownPast' : '');
    return '<div class="countdownItem' + urgentClass + '">'
      + '<span class="countdownLabel">' + escapeHtml(c.label) + '</span>'
      + '<span class="countdownDays">' + daysLabel + '</span>'
      + '<span class="countdownDate">（' + escapeHtml(c.date) + '）</span>'
      + '<span class="countdownDeleteBtn" data-id="' + c.id + '" title="削除">🗑</span>'
      + '</div>';
  }).join('');

  el.innerHTML = '<div class="countdownCardInner">'
    + '<div class="countdownTitle">⏳ 試験までのカウントダウン</div>'
    + (itemsHtml || '<div class="countdownEmpty">まだ登録されていません。試験名と日付を入力して追加してください。</div>')
    + '<div class="countdownAddRow">'
    + '<input type="text" id="countdownLabelInput" placeholder="例：予備試験 論文式" style="width:170px;">'
    + '<input type="date" id="countdownDateInput">'
    + '<button type="button" id="countdownAddBtn">＋ 追加</button>'
    + '</div>'
    + '</div>';
}

function addCountdown() {
  const labelInput = document.getElementById('countdownLabelInput');
  const dateInput = document.getElementById('countdownDateInput');
  const label = (labelInput.value || '').trim();
  const date = dateInput.value;
  if (!label || !date) {
    alert('試験名と日付の両方を入力してください。');
    return;
  }
  const list = loadCountdowns();
  list.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2, 8), label, date });
  saveCountdowns(list);
  renderCountdownCard();
}

document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('#countdownAddBtn');
  if (addBtn) {
    addCountdown();
    return;
  }
  const delBtn = e.target.closest('.countdownDeleteBtn');
  if (delBtn) {
    const id = delBtn.dataset.id;
    if (!confirm('このカウントダウンを削除しますか？')) return;
    const list = loadCountdowns().filter(c => String(c.id) !== String(id));
    saveCountdowns(list);
    renderCountdownCard();
  }
});
renderCountdownCard();
/* ▲▲▲ 新規追加：試験までのカウントダウン機能 ここまで ▲▲▲ */

/* ▼▼▼ 新規追加：過去問ログ機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼
   既存の entries / studyLog / manualLog / renderStudyTable などには一切触れていません。
   保存先も専用のキー 'ronshoPastExamLogs_v1' のみを使用します。 */
const PAST_EXAM_LOG_KEY = 'ronshoPastExamLogs_v1';

function loadPastExamLogs() {
  let logs;
  try {
    const raw = localStorage.getItem(PAST_EXAM_LOG_KEY);
    logs = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('過去問ログの読み込みに失敗しました:', e);
    return [];
  }
  let migrated = false;
  logs = logs.map(l => {
    if (l.examType) return l;
    migrated = true;
    const examType = '予備試験';
    return { ...l, examType: examType, key: examType + '|' + l.subject + '|' + l.year + '|' + l.round };
  });
  if (migrated) savePastExamLogs(logs);
  return logs;
}

function savePastExamLogs(logs) {
  try {
    localStorage.setItem(PAST_EXAM_LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('過去問ログの保存に失敗しました:', e);
  }
}

function renderPastLogs() {
  const table = document.getElementById('pastLogTable');
  const progressText = document.getElementById('pastProgressText');
  const progressBar = document.getElementById('pastProgressBar');
  if (!table || !progressText || !progressBar) return;

  const logs = loadPastExamLogs();
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  logs.sort((a, b) => {
    const typeA = a.examType || '予備試験';
    const typeB = b.examType || '予備試験';
    if (typeA !== typeB) return typeA.localeCompare(typeB, 'ja');
    const subjA = a.subject || '';
    const subjB = b.subject || '';
    if (subjA !== subjB) return subjA.localeCompare(subjB, 'ja');
    const yearA = a.year || '';
    const yearB = b.year || '';
    if (yearA !== yearB) return yearA.localeCompare(yearB, 'ja');
    return (a.round || 0) - (b.round || 0);
  });

  logs.forEach((log) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + escapeHtml(log.examType || '予備試験') + '</td>'
      + '<td>' + escapeHtml(log.subject || '') + '</td>'
      + '<td>' + escapeHtml(log.year || '') + '</td>'
      + '<td>' + log.round + '回目</td>'
      + '<td>' + escapeHtml(log.date || '') + '</td>'
      + '<td contenteditable="true" data-key="' + escapeHtml(log.key) + '" class="pastMemoCell">' + escapeHtml(log.memo || '') + '</td>'
      + '<td><button type="button" data-key="' + escapeHtml(log.key) + '" class="pastDelBtn">削除</button></td>';
    tbody.appendChild(tr);
  });

  const total = logs.length;
  progressText.textContent = '登録済み ' + total + ' 件';
  progressBar.style.width = total > 0 ? '100%' : '0%';
}

function initPastExamLogFeature() {
  const saveBtn = document.getElementById('pastSaveBtn');
  const table = document.getElementById('pastLogTable');
  if (!saveBtn || !table) return;

  saveBtn.addEventListener('click', () => {
    const examType = document.getElementById('pastExamTypeSelect').value;
    const subject = document.getElementById('pastSubjectInput').value.trim();
    const year = document.getElementById('pastYearInput').value.trim();
    const round = Number(document.getElementById('pastRoundSelect').value || '1');
    const date = document.getElementById('pastDateInput').value;

    if (!subject || !year || !date) {
      alert('科目・年度・解答日を入力してください。');
      return;
    }

    const logs = loadPastExamLogs();
    const key = examType + '|' + subject + '|' + year + '|' + round;
    const existingIdx = logs.findIndex(l => l.key === key);
    const newItem = {
      key: key,
      examType: examType,
      subject: subject,
      year: year,
      round: round,
      date: date,
      memo: existingIdx >= 0 ? (logs[existingIdx].memo || '') : ''
    };

    if (existingIdx >= 0) {
      logs[existingIdx] = newItem;
    } else {
      logs.push(newItem);
    }

    savePastExamLogs(logs);
    renderPastLogs();
  });

  table.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.pastDelBtn');
    if (!delBtn) return;
    const logs = loadPastExamLogs();
    const idx = logs.findIndex(l => l.key === delBtn.dataset.key);
    if (idx === -1) return;
    logs.splice(idx, 1);
    savePastExamLogs(logs);
    renderPastLogs();
  });

  table.addEventListener('blur', (e) => {
    const cell = e.target.closest('.pastMemoCell');
    if (!cell) return;
    const logs = loadPastExamLogs();
    const idx = logs.findIndex(l => l.key === cell.dataset.key);
    if (idx === -1) return;
    logs[idx].memo = cell.textContent.trim();
    savePastExamLogs(logs);
  }, true);

  renderPastLogs();
}
initPastExamLogFeature();
/* ▲▲▲ 新規追加：過去問ログ機能 ここまで ▲▲▲ */

// --- 初期化：保存データの復元（すべての関数・定数が定義された後に実行） ---
loadStudyLog();
loadManualLog();
loadEntries();
if (entries.length > 0) {
  status.textContent = '📂 前回読み込んだ ' + entries.length + '件のデータを復元しました。';
  downloadBtn.style.display = 'inline-block';
  downloadLogBtn.style.display = 'inline-block';
  renderAll();
}
renderPastLogs();
renderDupArchive();
