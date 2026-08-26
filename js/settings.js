/* ▼▼▼ 新規追加：タブ切り替えショートカットキー機能 ここから ▼▼▼ */
// タブ一覧はindex.htmlの.tabBtnと同じdata-page/ラベルを手動で対応させる。
// このタブ自身（settingsPage）にも割り当てられるようにしておく。
const SHORTCUT_PAGE_LIST = [
  { id: 'studyPage', label: '🏠 ホーム' },
  { id: 'memorizedPage', label: '✅ 暗記済み一覧' },
  { id: 'quizPage', label: '📝 問題演習' },
  { id: 'speechPage', label: '🔊 読み上げ' },
  { id: 'calendarPage', label: '📅 学習カレンダー・復習予定' },
  { id: 'csvPage', label: '📥📤 データ読込み・出力' },
  { id: 'pastExamPage', label: '📝 過去問ログ' },
  { id: 'settingsPage', label: '⚙️ その他' }
];
const SHORTCUT_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DEFAULT_TAB_SHORTCUTS = {
  '1': 'studyPage',
  '2': 'memorizedPage',
  '3': 'quizPage',
  '4': 'speechPage',
  '5': 'calendarPage',
  '6': 'csvPage',
  '7': 'pastExamPage'
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
