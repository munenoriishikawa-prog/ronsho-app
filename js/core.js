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
const tagTabsStudy = document.getElementById('tagTabsStudy');
const tagTabsMemorized = document.getElementById('tagTabsMemorized');
const tagTabsQuiz = document.getElementById('tagTabsQuiz');
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
const quizOrderSequentialRadio = document.getElementById('quizOrderSequentialRadio');
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
let selectedTag = 'all';
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
let quizSequentialMode = false;
let quizComboCount = 0;
let trendMode = 'week';
let editingEntryIdx = null;
let compareList = [];
let compareModalOpen = false;
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function todayStr() {
  return formatLocalDate(new Date());
}
function heatmapLevelOf(count) {
  return count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;
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
      let content = (r.bold && r.color) ? '<b>' + escaped + '</b>' : escaped;
      if (r.color) {
        content = '<span style="color:' + r.color + ';">' + content + '</span>';
      }
      lineHtml += content;
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
      const boldEls = r.getElementsByTagName('w:b');
      const bold = boldEls.length > 0 && boldEls[0].getAttribute('w:val') !== '0' && boldEls[0].getAttribute('w:val') !== 'false';
      runList.push({ text: text, color: color, bold: bold });
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
  const tagHtml = renderTagTabsHtml();
  if (tagTabsStudy) tagTabsStudy.innerHTML = tagHtml;
  if (tagTabsMemorized) tagTabsMemorized.innerHTML = tagHtml;
  if (tagTabsQuiz) tagTabsQuiz.innerHTML = tagHtml;
}
function getUniqueTags() {
  const seen = [];
  entries.forEach(e => {
    (e.tags || []).forEach(t => { if (t && !seen.includes(t)) seen.push(t); });
  });
  return seen.sort((a, b) => a.localeCompare(b, 'ja'));
}
function getRelatedEntries(e) {
  const tags = e.tags || [];
  if (tags.length === 0) return [];
  return entries.filter(other => other !== e && (other.tags || []).some(t => tags.includes(t)));
}
function jumpToEntryByTitle(title) {
  const tabBtn = document.querySelector('.tabBtn[data-page="studyPage"]');
  if (tabBtn && !tabBtn.classList.contains('active')) tabBtn.click();
  selectedTag = 'all';
  searchQueryStudy = title;
  if (searchInputStudy) searchInputStudy.value = title;
  renderSubjectTabs();
  renderStudyTable(entries);
}
function renderTagTabsHtml() {
  const tags = getUniqueTags();
  if (tags.length === 0) return '';
  let html = '<button type="button" class="tagFilterBtn' + (selectedTag === 'all' ? ' active' : '') + '" data-tag="all">🏷 タグすべて</button>';
  tags.forEach(t => {
    html += '<button type="button" class="tagFilterBtn' + (selectedTag === t ? ' active' : '') + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
  });
  return html;
}
function filterEntries(data, searchQuery) {
  let result = data;
  if (selectedSubject !== 'all') {
    result = result.filter(e => (e.subject || 'その他') === selectedSubject);
  }
  if (selectedCategory !== 'all') {
    result = result.filter(e => (e.category || '未分類') === selectedCategory);
  }
  if (selectedTag !== 'all') {
    result = result.filter(e => (e.tags || []).includes(selectedTag));
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
  renderCompareBar();
  renderSyncConflictBanner();
  if (typeof renderGamificationPanel === 'function') renderGamificationPanel();
  if (typeof renderBadgesSection === 'function') renderBadgesSection();
 
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
