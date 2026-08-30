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
   専用のデータは持たず、上の詳細ログ（loadPastExamLogs/savePastExamLogs）を
   そのまま読み書きすることで、一覧のマスと詳細ログを常に連動させています。
   ・詳細ログを記録/削除する → このマスの色が自動的に変わる
   ・このマスをクリックする → 詳細ログに新しい行が自動的に追加される
   色は js/core.js の STUDY_COUNT_COLORS（ホーム画面の学習回数の色）を
   そのまま流用します。 */
const PAST_EXAM_MATRIX_SUBJECTS = [
  { name: '憲法',         abbr: '憲' },
  { name: '民法',         abbr: '民' },
  { name: '刑法',         abbr: '刑' },
  { name: '行政法',       abbr: '行' },
  { name: '商法',         abbr: '商' },
  { name: '民事訴訟法',   abbr: '民訴' },
  { name: '刑事訴訟法',   abbr: '刑訴' },
  { name: '労働法',       abbr: '労' },
  { name: '実務基礎民事', abbr: '実民' },
  { name: '実務基礎刑事', abbr: '実刑' }
];
const PAST_EXAM_MATRIX_YEARS = [1, 2, 3, 4, 5, 6, 7];
function pastMatrixYearFullLabel(y) { return y === 1 ? '令和元年' : '令和' + y + '年'; }
function pastMatrixYearShortLabel(y) { return 'R' + y; }
// タブ（種別）を切り替えても表の列構成が変わらないよう、科目は常に全10科目分の
// 列を出す。対象外の科目・年度は pastMatrixApplicable() 側でマスを「・」にする
function pastMatrixSubjectsFor(examType) {
  return PAST_EXAM_MATRIX_SUBJECTS;
}
function pastMatrixApplicable(examType, subjName, year) {
  if ((subjName === '実務基礎民事' || subjName === '実務基礎刑事') && examType !== '予備試験') return false;
  if (subjName === '労働法' && examType === '予備試験' && year < 4) return false;
  return true;
}
// 詳細ログの年度欄は自由入力（例：「令和7年（2025）」）なので、そこから
// 「令和何年か」だけを緩く読み取ってマスの年度と対応付ける
function pastMatrixParseYearNum(yearText) {
  const m = String(yearText || '').match(/令和\s*(元|[0-9]+)\s*年/);
  if (!m) return null;
  const n = m[1] === '元' ? 1 : Number(m[1]);
  return (n >= 1 && n <= 7) ? n : null;
}
// 詳細ログ一覧から「種別＋科目＋年度」ごとの最大回数を集計する
function computePastMatrixRounds(examType) {
  const map = {};
  loadPastExamLogs().forEach(l => {
    if ((l.examType || '予備試験') !== examType) return;
    const yearNum = pastMatrixParseYearNum(l.year);
    if (!yearNum) return;
    const subj = (l.subject || '').trim();
    const k = subj + '|' + yearNum;
    const r = Number(l.round) || 0;
    if (!map[k] || map[k] < r) map[k] = r;
  });
  return map;
}
function pastMatrixBucket(round) { return round >= 4 ? '4+' : String(round); }
function pastMatrixCellHtml(round) {
  const bucket = pastMatrixBucket(round);
  if (round === 0) return '<span class="pastMatrixCellInner pastMatrixCellEmpty"></span>';
  return '<span class="pastMatrixCellInner" style="background:' + STUDY_COUNT_COLORS[bucket] + ';">' + (round >= 4 ? '4+' : round) + '</span>';
}
// 過去問ログ保存フォーム（保存ボタン）とマスのクリックの両方から使う、
// 共通の「1件追加/上書き」処理
function upsertPastExamLogEntry(examType, subject, year, round, date) {
  const logs = loadPastExamLogs();
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
  if (existingIdx >= 0) logs[existingIdx] = newItem; else logs.push(newItem);
  savePastExamLogs(logs);
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
  const examType = pastMatrixCurrentType;
  const subjects = pastMatrixSubjectsFor(examType);
  const roundMap = computePastMatrixRounds(examType);

  let html = '<table class="pastMatrixTable"><thead><tr><th></th>'
    + subjects.map(s => '<th class="pastMatrixSubjHead" title="' + escapeHtml(s.name) + '">' + escapeHtml(s.abbr) + '</th>').join('')
    + '</tr></thead><tbody>';

  PAST_EXAM_MATRIX_YEARS.forEach(y => {
    html += '<tr><th class="pastMatrixYearHead" title="' + pastMatrixYearFullLabel(y) + '">' + pastMatrixYearShortLabel(y) + '</th>';
    subjects.forEach(s => {
      const applicable = pastMatrixApplicable(examType, s.name, y);
      if (!applicable) {
        html += '<td class="pastMatrixCell pastMatrixNa"><span class="pastMatrixNaMark">・</span></td>';
        return;
      }
      const round = roundMap[s.name + '|' + y] || 0;
      const bucket = pastMatrixBucket(round);
      const title = s.name + ' ' + pastMatrixYearFullLabel(y) + '：' + STUDY_COUNT_LABELS[bucket];
      html += '<td class="pastMatrixCell" data-subj="' + escapeHtml(s.name) + '" data-year="' + y + '" title="' + escapeHtml(title) + '">' + pastMatrixCellHtml(round) + '</td>';
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

  // マスをクリックすると、その回の演習を今日の日付で詳細ログに1件追加し
  // （既に記録済みなら回数を1つ増やして追加）、一覧の色も詳細ログの表も
  // その場で更新する。回数を減らしたい／間違えて増やした場合は、下の詳細
  // ログ側から該当の行を削除すれば、このマスにも自動的に反映される
  wrap.addEventListener('click', (e) => {
    const td = e.target.closest('td.pastMatrixCell:not(.pastMatrixNa)');
    if (!td) return;
    const examType = pastMatrixCurrentType;
    const subject = td.dataset.subj;
    const year = Number(td.dataset.year);
    const currentRound = computePastMatrixRounds(examType)[subject + '|' + year] || 0;
    const nextRound = currentRound + 1;
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    upsertPastExamLogEntry(examType, subject, pastMatrixYearFullLabel(year), nextRound, dateStr);
    renderPastMatrixTable();
    renderPastLogs();
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

    // 種別＋科目＋年度＋回数＋解答日が全て一致する場合のみ上書きする
    // （同じ回数のまま予習・復習で日付を変えて記録した場合は別のログにする）
    upsertPastExamLogEntry(examType, subject, year, round, date);
    renderPastLogs();
    renderPastMatrixTable();
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
    renderPastMatrixTable();
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

