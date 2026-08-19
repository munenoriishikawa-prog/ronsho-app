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
function renderProgressSummary() {
  const el = document.getElementById('progressSummary');
  if (!el) return;
  if (entries.length === 0) { el.innerHTML = ''; return; }
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
  const subjectHtml = subjectOrderList.map(s => {
    const st = subjectStats[s];
    const p = st.total > 0 ? Math.round((st.memorized / st.total) * 100) : 0;
    return '<div class="subjectProgressItem">'
      + '<div class="subjectProgressHeader">'
      + '<div class="subjectProgressName">' + getSubjectEmoji(s) + ' ' + escapeHtml(s) + '</div>'
      + '<div class="subjectProgressCounts">合計' + st.total + '件 ／ 暗記' + st.memorized + '件</div>'
      + '<div class="subjectProgressPct">' + p + '%</div>'
      + '</div>'
      + buildStudyCountBarHtml(st.entries)
      + '</div>';
  }).join('');
  el.innerHTML = '<div class="progressCard">'
    + '<div class="progressBigPct">' + pct + '%</div>'
    + '<div class="progressBarSection">'
    + '<div class="progressLabel">合計' + total + '件 ／ 暗記済み' + memorizedCount + '件</div>'
    + buildStudyCountBarHtml(filtered)
    + '</div>'
    + '</div>'
    + '<div class="subjectProgressCard">'
    + '<div class="subjectProgressTitle">📚 科目別 暗記完了率・学習回数</div>'
    + subjectHtml
    + '</div>';
}
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
  let bodyCellContent;
  if (collapseBody && !expandedBodySet.has(e.title)) {
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
    + '<td><div class="titleCellWrap">' + starHtml + bookmarkHtml + memoHtml + '<div class="titleText">' + titleHtml + '</div></div></td>'
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
  if (selectedCsvSubject === 'all') return entries;
  return entries.filter(e => (e.subject || 'その他') === selectedCsvSubject);
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
  wrapEl.addEventListener('click', (e) => {
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
  const filtered = getCsvFilteredEntries().filter(e => !(studyLog[e.title] && studyLog[e.title].memorized));
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
  const isBookmarked = !!(studyLog[e.title] && studyLog[e.title].bookmarked);
  const isSkipped = !!(studyLog[e.title] && studyLog[e.title].skipped);
  const quizMemo = (studyLog[e.title] && studyLog[e.title].memo) || '';
  let html = '<div class="quizCard">';
  html += '<div class="quizCardTools">'
    + '<span class="quizMemoBtn' + (quizMemo ? ' active' : '') + '" id="quizMemoBtn" title="' + escapeHtml(quizMemo ? ('メモ：' + quizMemo) : 'メモを追加') + '">🗒️</span>'
    + '<span class="quizBookmarkBtn' + (isBookmarked ? ' active' : '') + '" id="quizBookmarkBtn" title="内容修正が必要な論証としてブックマーク">🔖</span>'
    + '<span class="quizSkipBtn' + (isSkipped ? ' active' : '') + '" id="quizSkipBtn" title="スキップ（ランダム出題から除外）">⏭️</span>'
    + '</div>';
  html += '<div class="quizProgress">' + (quizIndex + 1) + ' / ' + quizPool.length + '問</div>';
  html += '<div class="quizMeta">' + escapeHtml(e.subject || '') + ' ｜ ' + escapeHtml(e.category || '') + '</div>';
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
}

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
