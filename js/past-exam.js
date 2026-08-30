/* ▼▼▼ 新規追加：過去問ログ機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼
   既存の entries / studyLog / manualLog / renderStudyTable などには一切触れていません。
   保存先も専用のキー 'ronshoPastExamLogs_v1' のみを使用します。 */
const PAST_EXAM_LOG_KEY = 'ronshoPastExamLogs_v1';
// 「過去問ログ」タブを開いたときに最初から選ばれている種別を、設定画面
// (js/settings.js)から変更できるようにする。この端末だけのローカル設定
const PAST_EXAM_DEFAULT_TYPE_KEY = 'ronshoPastExamDefaultTypeV1';
const PAST_EXAM_TYPE_OPTIONS = ['予備試験', '新司法試験'];
function loadPastExamDefaultType() {
  const raw = localStorage.getItem(PAST_EXAM_DEFAULT_TYPE_KEY);
  return PAST_EXAM_TYPE_OPTIONS.includes(raw) ? raw : '予備試験';
}
function savePastExamDefaultType(v) {
  localStorage.setItem(PAST_EXAM_DEFAULT_TYPE_KEY, v);
}
(() => {
  const sel = document.getElementById('pastExamTypeSelect');
  if (sel) sel.value = loadPastExamDefaultType();
})();

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
    const examType = l.examType || '予備試験';
    // 以前は 種別+科目+年度+回数 のみをキーにしていたため、同じ回数のまま
    // 解答日だけ変えて記録すると上書きされてしまっていた。解答日もキーに
    // 含めることで、日付が違えば別のログとして残せるようにする
    const key = examType + '|' + l.subject + '|' + l.year + '|' + l.round + '|' + (l.date || '');
    if (l.examType && l.key === key) return l;
    migrated = true;
    return { ...l, examType: examType, key: key };
  });
  if (migrated) savePastExamLogs(logs);
  return logs;
}

function savePastExamLogs(logs) {
  try {
    localStorage.setItem(PAST_EXAM_LOG_KEY, JSON.stringify(logs));
    if (typeof window !== 'undefined' && typeof window.ronshoSyncNotifyChange === 'function') window.ronshoSyncNotifyChange();
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
    if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
    return (a.date || '').localeCompare(b.date || '');
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

/* ▼▼▼ 新規追加：過去問ログ「年度×科目 一覧」マトリクス
   詳細ログ（上記のkey/logs）とは別の専用キーのみを使用し、既存のロジックには
   一切影響しません。色は js/core.js の STUDY_COUNT_COLORS（ホーム画面の
   学習回数の色）をそのまま流用します。 */
const PAST_EXAM_MATRIX_KEY = 'ronshoPastExamMatrixV1';
const PAST_EXAM_MATRIX_SUBJECTS = [
  { key: 'con',   name: '憲法',         abbr: '憲法' },
  { key: 'adm',   name: '行政法',       abbr: '行政' },
  { key: 'civ',   name: '民法',         abbr: '民法' },
  { key: 'com',   name: '商法',         abbr: '商法' },
  { key: 'civP',  name: '民事訴訟法',   abbr: '民訴' },
  { key: 'crim',  name: '刑法',         abbr: '刑法' },
  { key: 'crimP', name: '刑事訴訟法',   abbr: '刑訴' },
  { key: 'labor', name: '労働法',       abbr: '労働' },
  { key: 'pracC', name: '実務基礎(民事)', abbr: '実務民', onlyYobi: true },
  { key: 'pracK', name: '実務基礎(刑事)', abbr: '実務刑', onlyYobi: true }
];
const PAST_EXAM_MATRIX_YEARS = [1, 2, 3, 4, 5, 6, 7];
function pastMatrixYearFullLabel(y) { return y === 1 ? '令和元年' : '令和' + y + '年'; }
function pastMatrixYearShortLabel(y) { return 'R' + y; }
function pastMatrixSubjectsFor(examType) {
  return PAST_EXAM_MATRIX_SUBJECTS.filter(s => !s.onlyYobi || examType === '予備試験');
}
function pastMatrixApplicable(examType, subjKey, year) {
  if (subjKey === 'labor' && examType === '予備試験' && year < 4) return false;
  return true;
}
function loadPastExamMatrix() {
  try {
    const raw = localStorage.getItem(PAST_EXAM_MATRIX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('過去問一覧マトリクスの読み込みに失敗しました:', e);
    return {};
  }
}
function savePastExamMatrix(matrix) {
  try {
    localStorage.setItem(PAST_EXAM_MATRIX_KEY, JSON.stringify(matrix));
    if (typeof window !== 'undefined' && typeof window.ronshoSyncNotifyChange === 'function') window.ronshoSyncNotifyChange();
  } catch (e) {
    console.error('過去問一覧マトリクスの保存に失敗しました:', e);
  }
}
function pastMatrixCellKey(examType, subjKey, year) { return examType + '|' + subjKey + '|' + year; }
function pastMatrixRoundOf(matrix, examType, subjKey, year) {
  return matrix[pastMatrixCellKey(examType, subjKey, year)] || 0;
}
function pastMatrixBucket(round) { return round >= 4 ? '4+' : String(round); }
function pastMatrixCellHtml(round) {
  const bucket = pastMatrixBucket(round);
  if (round === 0) return '<span class="pastMatrixCellInner pastMatrixCellEmpty"></span>';
  return '<span class="pastMatrixCellInner" style="background:' + STUDY_COUNT_COLORS[bucket] + ';">' + (round >= 4 ? '4+' : round) + '</span>';
}

let pastMatrixCurrentType = loadPastExamDefaultType();

function renderPastMatrixLegend() {
  const legendEl = document.getElementById('pastMatrixLegend');
  if (!legendEl) return;
  legendEl.innerHTML = STUDY_COUNT_BUCKETS.map(b => {
    return '<span class="pastMatrixLegendDot"><span class="pastMatrixLegendSwatch" style="background:' + STUDY_COUNT_COLORS[b] + ';"></span>' + STUDY_COUNT_LABELS[b] + '</span>';
  }).join('');
}

function renderPastMatrixTable() {
  const wrap = document.getElementById('pastMatrixTableWrap');
  if (!wrap) return;
  const matrix = loadPastExamMatrix();
  const examType = pastMatrixCurrentType;
  const subjects = pastMatrixSubjectsFor(examType);

  let html = '<table class="pastMatrixTable"><thead><tr><th></th>'
    + subjects.map(s => '<th class="pastMatrixSubjHead" title="' + escapeHtml(s.name) + '">' + escapeHtml(s.abbr) + '</th>').join('')
    + '</tr></thead><tbody>';

  PAST_EXAM_MATRIX_YEARS.forEach(y => {
    html += '<tr><th class="pastMatrixYearHead" title="' + pastMatrixYearFullLabel(y) + '">' + pastMatrixYearShortLabel(y) + '</th>';
    subjects.forEach(s => {
      const applicable = pastMatrixApplicable(examType, s.key, y);
      if (!applicable) {
        html += '<td class="pastMatrixCell pastMatrixNa"><span class="pastMatrixNaMark">・</span></td>';
        return;
      }
      const round = pastMatrixRoundOf(matrix, examType, s.key, y);
      const bucket = pastMatrixBucket(round);
      const title = s.name + ' ' + pastMatrixYearFullLabel(y) + '：' + STUDY_COUNT_LABELS[bucket];
      html += '<td class="pastMatrixCell" data-subj="' + s.key + '" data-year="' + y + '" title="' + escapeHtml(title) + '">' + pastMatrixCellHtml(round) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function initPastExamMatrixFeature() {
  const tabsEl = document.getElementById('pastMatrixTabs');
  const wrap = document.getElementById('pastMatrixTableWrap');
  if (!tabsEl || !wrap) return;

  PAST_EXAM_TYPE_OPTIONS.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pastMatrixTabBtn' + (t === pastMatrixCurrentType ? ' active' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => {
      pastMatrixCurrentType = t;
      tabsEl.querySelectorAll('.pastMatrixTabBtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPastMatrixTable();
    });
    tabsEl.appendChild(btn);
  });

  wrap.addEventListener('click', (e) => {
    const td = e.target.closest('td.pastMatrixCell:not(.pastMatrixNa)');
    if (!td) return;
    const matrix = loadPastExamMatrix();
    const key = pastMatrixCellKey(pastMatrixCurrentType, td.dataset.subj, td.dataset.year);
    const round = ((matrix[key] || 0) + 1) % 5;
    if (round === 0) delete matrix[key]; else matrix[key] = round;
    savePastExamMatrix(matrix);
    td.innerHTML = pastMatrixCellHtml(round);
    const s = PAST_EXAM_MATRIX_SUBJECTS.find(x => x.key === td.dataset.subj);
    const bucket = pastMatrixBucket(round);
    td.title = s.name + ' ' + pastMatrixYearFullLabel(Number(td.dataset.year)) + '：' + STUDY_COUNT_LABELS[bucket];
  });

  renderPastMatrixLegend();
  renderPastMatrixTable();
}
initPastExamMatrixFeature();
/* ▲▲▲ 新規追加：過去問ログ「年度×科目 一覧」マトリクス ここまで ▲▲▲ */

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
    // 種別＋科目＋年度＋回数＋解答日が全て一致する場合のみ上書きする
    // （同じ回数のまま予習・復習で日付を変えて記録した場合は別のログにする）
    const key = examType + '|' + subject + '|' + year + '|' + round + '|' + date;
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

