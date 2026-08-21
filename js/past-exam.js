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

