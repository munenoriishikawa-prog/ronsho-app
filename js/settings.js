/* ▼▼▼ 新規追加：タブ切り替えショートカットキー機能 ここから ▼▼▼ */
// タブ一覧はindex.htmlの.tabBtnと同じdata-page/ラベルを手動で対応させる。
// このタブ自身（settingsPage）にも割り当てられるようにしておく。
const SHORTCUT_PAGE_LIST = [
  { id: 'studyPage', label: '🏠 ホーム' },
  { id: 'entryListPage', label: '📚 論証一覧' },
  { id: 'quizPage', label: '📝 問題演習' },
  { id: 'speechPage', label: '🔊 読み上げ' },
  { id: 'calendarPage', label: '📅 カレンダー' },
  { id: 'csvPage', label: '📥 データ' },
  { id: 'pastExamPage', label: '📝 過去問ログ' },
  { id: 'settingsPage', label: '⚙️ その他' }
];
const SHORTCUT_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DEFAULT_TAB_SHORTCUTS = {
  '1': 'studyPage',
  '2': 'entryListPage',
  '3': 'quizPage',
  '4': 'speechPage',
  '5': 'calendarPage',
  '6': 'csvPage',
  '7': 'pastExamPage',
  '8': 'settingsPage'
};
// 同期対象ではなく、この端末だけのローカル設定として保存する
// （キーボード配列は端末ごとに違いうるため、他端末と揃える意味が薄い）。
const TAB_SHORTCUTS_KEY = 'ronshoTabShortcutsV1';
function loadTabShortcuts() {
  try {
    const saved = JSON.parse(localStorage.getItem(TAB_SHORTCUTS_KEY));
    if (saved && typeof saved === 'object') return saved;
  } catch (e) {}
  return { ...DEFAULT_TAB_SHORTCUTS };
}
function saveTabShortcuts(map) {
  localStorage.setItem(TAB_SHORTCUTS_KEY, JSON.stringify(map));
}
function renderShortcutSettings() {
  const wrap = document.getElementById('shortcutSettingsWrap');
  if (!wrap) return;
  const shortcuts = loadTabShortcuts();
  let html = '<table class="shortcutSettingsTable"><thead><tr><th>タブ</th><th>ショートカットキー</th></tr></thead><tbody>';
  SHORTCUT_PAGE_LIST.forEach(page => {
    const assigned = Object.keys(shortcuts).find(k => shortcuts[k] === page.id) || '';
    html += '<tr><td>' + page.label + '</td><td>'
      + '<select class="shortcutKeySelect" data-page-id="' + page.id + '">'
      + '<option value=""' + (assigned === '' ? ' selected' : '') + '>未設定</option>'
      + SHORTCUT_DIGITS.map(d => '<option value="' + d + '"' + (assigned === d ? ' selected' : '') + '>' + d + '</option>').join('')
      + '</select></td></tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('.shortcutKeySelect').forEach(sel => {
    sel.addEventListener('change', () => {
      const pageId = sel.dataset.pageId;
      const shortcuts = loadTabShortcuts();
      Object.keys(shortcuts).forEach(k => { if (shortcuts[k] === pageId) delete shortcuts[k]; });
      if (sel.value) shortcuts[sel.value] = pageId;
      saveTabShortcuts(shortcuts);
      renderShortcutSettings();
      status.textContent = sel.value
        ? '⌨️ 「' + (SHORTCUT_PAGE_LIST.find(p => p.id === pageId) || {}).label + '」に数字キー「' + sel.value + '」を割り当てました。'
        : '⌨️ 「' + (SHORTCUT_PAGE_LIST.find(p => p.id === pageId) || {}).label + '」のショートカットキーを未設定に戻しました。';
    });
  });
}
document.getElementById('resetShortcutsBtn').addEventListener('click', () => {
  saveTabShortcuts({ ...DEFAULT_TAB_SHORTCUTS });
  renderShortcutSettings();
  status.textContent = '⌨️ ショートカットキーを初期設定に戻しました。';
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderShortcutSettings);
/* ▼▼▼ 新規追加：デスクトップペット設定 ここから ▼▼▼ */
function renderPetSettings() {
  const wrap = document.getElementById('petSettingsWrap');
  if (!wrap || !window.ronshoPetControl) return;
  const control = window.ronshoPetControl;
  const enabled = control.isEnabled();
  const speciesIdx = control.getSpeciesIndex();
  const bubbleMs = control.getBubbleDurationMs();
  let html = '<label class="petEnableLabel"><input type="checkbox" id="petEnabledChk"' + (enabled ? ' checked' : '') + '> ペットを表示する</label>';
  html += '<div class="petSpeciesRow"><span>キャラクター：</span><select id="petSpeciesSelect"' + (enabled ? '' : ' disabled') + '>'
    + control.SPECIES_LABELS.map((label, idx) => '<option value="' + idx + '"' + (idx === speciesIdx ? ' selected' : '') + '>' + label + '</option>').join('')
    + '</select></div>';
  html += '<div class="petSpeciesRow"><span>吹き出しの表示時間：</span><select id="petBubbleDurationSelect"' + (enabled ? '' : ' disabled') + '>'
    + control.BUBBLE_DURATION_OPTIONS_MS.map(ms => '<option value="' + ms + '"' + (ms === bubbleMs ? ' selected' : '') + '>' + (ms / 1000) + '秒</option>').join('')
    + '</select></div>';
  wrap.innerHTML = html;
  document.getElementById('petEnabledChk').addEventListener('change', (evt) => {
    control.setEnabled(evt.target.checked);
    renderPetSettings();
    status.textContent = evt.target.checked ? '🐾 ペットを表示しました。' : '🐾 ペットを非表示にしました。';
  });
  document.getElementById('petSpeciesSelect').addEventListener('change', (evt) => {
    control.setSpeciesIndex(Number(evt.target.value));
    status.textContent = '🐾 キャラクターを「' + control.SPECIES_LABELS[Number(evt.target.value)] + '」に変更しました。';
  });
  document.getElementById('petBubbleDurationSelect').addEventListener('change', (evt) => {
    control.setBubbleDurationMs(Number(evt.target.value));
    status.textContent = '🐾 吹き出しの表示時間を' + (Number(evt.target.value) / 1000) + '秒に変更しました。';
  });
}
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderPetSettings);
/* ▲▲▲ 新規追加：デスクトップペット設定 ここまで ▲▲▲ */
/* ▼▼▼ 新規追加：読み上げのデフォルト設定 ここから ▼▼▼ */
function renderSpeechRateSettings() {
  const rateSel = document.getElementById('speechDefaultRateSelect');
  if (rateSel && typeof loadSpeechDefaultRate === 'function') rateSel.value = loadSpeechDefaultRate();
  const importanceSel = document.getElementById('speechDefaultImportanceSelect');
  if (importanceSel && typeof loadSpeechDefaultImportance === 'function') importanceSel.value = loadSpeechDefaultImportance();
  const loopSel = document.getElementById('speechDefaultLoopSelect');
  if (loopSel && typeof loadSpeechDefaultLoop === 'function') loopSel.value = loadSpeechDefaultLoop();
  const includeMemorizedChk = document.getElementById('speechDefaultIncludeMemorizedChk');
  if (includeMemorizedChk && typeof loadSpeechDefaultIncludeMemorized === 'function') includeMemorizedChk.checked = loadSpeechDefaultIncludeMemorized();
}
document.getElementById('speechDefaultRateSelect').addEventListener('change', (evt) => {
  saveSpeechDefaultRate(evt.target.value);
  const liveSel = document.getElementById('speechRateSelect');
  if (liveSel) liveSel.value = evt.target.value;
  status.textContent = '🔊 読み上げのデフォルトの速さを「' + evt.target.value + '倍」にしました。';
});
document.getElementById('speechDefaultImportanceSelect').addEventListener('change', (evt) => {
  saveSpeechDefaultImportance(evt.target.value);
  const liveSel = document.getElementById('speechImportanceSelect');
  if (liveSel) liveSel.value = evt.target.value;
  status.textContent = '🔊 読み上げのデフォルトの重要度の絞り込みを変更しました。';
});
document.getElementById('speechDefaultLoopSelect').addEventListener('change', (evt) => {
  saveSpeechDefaultLoop(evt.target.value);
  const liveSel = document.getElementById('speechLoopSelect');
  if (liveSel) liveSel.value = evt.target.value;
  status.textContent = '🔊 読み上げのデフォルトのループ設定を変更しました。';
});
document.getElementById('speechDefaultIncludeMemorizedChk').addEventListener('change', (evt) => {
  saveSpeechDefaultIncludeMemorized(evt.target.checked);
  const liveChk = document.getElementById('speechIncludeMemorizedChk');
  if (liveChk) liveChk.checked = evt.target.checked;
  status.textContent = '🔊 読み上げのデフォルトの「暗記済みも含める」を' + (evt.target.checked ? 'ONにしました。' : 'OFFにしました。');
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderSpeechRateSettings);
/* ▲▲▲ 新規追加：読み上げのデフォルト設定 ここまで ▲▲▲ */
/* ▼▼▼ 新規追加：問題演習のデフォルト設定 ここから ▼▼▼ */
const QUIZ_SETTINGS_CHK_MAP = {
  quizDefaultRandomChk: 'random',
  quizDefaultHideMemorizedChk: 'hideMemorized',
  quizDefaultOverdueOnlyChk: 'overdueOnly',
  quizDefaultExcludeTodayChk: 'excludeToday',
  quizDefaultWeakOnlyChk: 'weakOnly',
  quizDefaultSkippedOnlyChk: 'skippedOnly'
};
function renderQuizDefaultFilterSettings() {
  if (typeof loadQuizDefaultFilters !== 'function') return;
  const defaults = loadQuizDefaultFilters();
  Object.keys(QUIZ_SETTINGS_CHK_MAP).forEach(id => {
    const chk = document.getElementById(id);
    if (chk) chk.checked = defaults[QUIZ_SETTINGS_CHK_MAP[id]];
  });
}
const QUIZ_SETTINGS_LIVE_CHK_ID = {
  random: 'quizRandomChk',
  hideMemorized: 'quizHideMemorizedChk',
  overdueOnly: 'quizOverdueOnlyChk',
  excludeToday: 'quizExcludeTodayChk',
  weakOnly: 'quizWeakOnlyChk',
  skippedOnly: 'quizSkippedOnlyChk'
};
Object.keys(QUIZ_SETTINGS_CHK_MAP).forEach(id => {
  const chk = document.getElementById(id);
  if (!chk) return;
  chk.addEventListener('change', () => {
    const field = QUIZ_SETTINGS_CHK_MAP[id];
    const defaults = loadQuizDefaultFilters();
    defaults[field] = chk.checked;
    saveQuizDefaultFilters(defaults);
    const liveChk = document.getElementById(QUIZ_SETTINGS_LIVE_CHK_ID[field]);
    if (liveChk) liveChk.checked = chk.checked;
    status.textContent = '📝 問題演習のデフォルト設定を変更しました。';
  });
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderQuizDefaultFilterSettings);
/* ▲▲▲ 新規追加：問題演習のデフォルト設定 ここまで ▲▲▲ */
/* ▼▼▼ 新規追加：ホーム・問題演習の絞り込みのデフォルト設定 ここから ▼▼▼ */
function renderStarFilterDefaultSettings() {
  const sel = document.getElementById('starFilterDefaultSelect');
  if (!sel || typeof loadStarFilterDefault !== 'function') return;
  sel.value = loadStarFilterDefault();
}
document.getElementById('starFilterDefaultSelect').addEventListener('change', (evt) => {
  saveStarFilterDefault(evt.target.value);
  starFilterMode = evt.target.value;
  renderSubjectTabs();
  renderStudyTable(entries);
  status.textContent = '🏠 絞り込みのデフォルトを変更しました。';
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderStarFilterDefaultSettings);
/* ▲▲▲ 新規追加：ホーム・問題演習の絞り込みのデフォルト設定 ここまで ▲▲▲ */
/* ▼▼▼ 新規追加：過去問ログのデフォルト種別設定 ここから ▼▼▼ */
function renderPastExamDefaultTypeSettings() {
  const sel = document.getElementById('pastExamDefaultTypeSelect');
  if (!sel || typeof loadPastExamDefaultType !== 'function') return;
  sel.value = loadPastExamDefaultType();
}
document.getElementById('pastExamDefaultTypeSelect').addEventListener('change', (evt) => {
  savePastExamDefaultType(evt.target.value);
  const liveSel = document.getElementById('pastExamTypeSelect');
  if (liveSel) liveSel.value = evt.target.value;
  status.textContent = '📝 過去問ログのデフォルトの種別を「' + evt.target.value + '」にしました。';
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderPastExamDefaultTypeSettings);
/* ▲▲▲ 新規追加：過去問ログのデフォルト種別設定 ここまで ▲▲▲ */
/* ▼▼▼ 新規追加：バックアップのお知らせ日数設定 ここから ▼▼▼ */
function renderBackupReminderDaysSettings() {
  const input = document.getElementById('backupReminderDaysInput');
  if (!input || typeof loadBackupReminderDays !== 'function') return;
  input.value = loadBackupReminderDays();
}
document.getElementById('backupReminderDaysInput').addEventListener('change', (evt) => {
  const days = Math.min(90, Math.max(1, Math.round(Number(evt.target.value)) || 7));
  evt.target.value = days;
  saveBackupReminderDays(days);
  if (typeof renderBackupReminderBanner === 'function') renderBackupReminderBanner();
  status.textContent = '📦 バックアップのお知らせ日数を' + days + '日にしました。';
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderBackupReminderDaysSettings);
/* ▲▲▲ 新規追加：バックアップのお知らせ日数設定 ここまで ▲▲▲ */
/* ▼▼▼ 新規追加：今日の目標設定 ここから ▼▼▼ */
function renderDailyGoalSettings() {
  const input = document.getElementById('dailyGoalInput');
  if (!input || typeof loadDailyGoal !== 'function') return;
  input.value = loadDailyGoal();
}
document.getElementById('dailyGoalInput').addEventListener('change', (evt) => {
  const n = Math.min(999, Math.max(1, Math.round(Number(evt.target.value)) || 10));
  evt.target.value = n;
  saveDailyGoal(n);
  if (typeof renderGamificationPanel === 'function') renderGamificationPanel();
  status.textContent = '🎯 今日の目標を' + n + '問にしました。';
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderDailyGoalSettings);
/* ▲▲▲ 新規追加：今日の目標設定 ここまで ▲▲▲ */
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return !!el.closest('[contenteditable="true"]');
}
document.addEventListener('keydown', (evt) => {
  if (evt.ctrlKey || evt.altKey || evt.metaKey) return;
  if (!SHORTCUT_DIGITS.includes(evt.key)) return;
  if (isTypingTarget(evt.target)) return;
  if (compareModalOpen) return;
  const conflictModal = document.getElementById('driveSyncConflictModal');
  if (conflictModal && conflictModal.innerHTML.trim() !== '') return;
  const pageId = loadTabShortcuts()[evt.key];
  if (!pageId) return;
  const tabBtn = document.querySelector('.tabBtn[data-page="' + pageId + '"]');
  if (!tabBtn) return;
  evt.preventDefault();
  tabBtn.click();
});
/* ▲▲▲ 新規追加：タブ切り替えショートカットキー機能 ここまで ▲▲▲ */
