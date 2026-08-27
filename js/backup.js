/* ▼▼▼ 新規追加：全データバックアップ機能 ここから ▼▼▼ */
// クラウド同期とは別に、ブラウザにファイルとして保存しておく手動バックアップ。
// ブラウザの仕様上、確認なしで自動的にファイル保存を繰り返すことはできないため、
// 「最後にバックアップしてから一定日数経ったらお知らせする」形の
// 半自動（催促＋ワンタップ書き出し）として実装している。
const BACKUP_LAST_AT_KEY = 'ronshoLastBackupAtV1';
const BACKUP_SNOOZE_AT_KEY = 'ronshoBackupSnoozeAtV1';
const BACKUP_REMINDER_DAYS = 7;

function buildBackupPayload() {
  const snap = (typeof window.ronshoBuildBackupSnapshot === 'function')
    ? window.ronshoBuildBackupSnapshot()
    : { entries: entries, studyLog: studyLog, manualLog: manualLog };
  return Object.assign({ exportedAt: new Date().toISOString() }, snap);
}
function downloadFullBackup() {
  const json = JSON.stringify(buildBackupPayload(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '論証集バックアップ_' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  localStorage.setItem(BACKUP_LAST_AT_KEY, todayStr());
  localStorage.removeItem(BACKUP_SNOOZE_AT_KEY);
  renderBackupLastInfo();
  renderBackupReminderBanner();
  status.textContent = '📦 バックアップをダウンロードしました。';
}
function daysSince(dateStr) {
  return Math.round((new Date(todayStr() + 'T00:00:00') - new Date(dateStr + 'T00:00:00')) / 86400000);
}
function renderBackupLastInfo() {
  const el = document.getElementById('backupLastInfo');
  if (!el) return;
  const last = localStorage.getItem(BACKUP_LAST_AT_KEY);
  el.textContent = last ? ('最終バックアップ：' + last + '（' + daysSince(last) + '日前）') : 'まだバックアップを取っていません。';
}
function renderBackupReminderBanner() {
  const banner = document.getElementById('backupReminderBanner');
  if (!banner) return;
  const last = localStorage.getItem(BACKUP_LAST_AT_KEY);
  const overdue = last ? daysSince(last) >= BACKUP_REMINDER_DAYS : entries.length > 0;
  const snoozedToday = localStorage.getItem(BACKUP_SNOOZE_AT_KEY) === todayStr();
  if (!overdue || snoozedToday) {
    banner.innerHTML = '';
    banner.classList.remove('visible');
    return;
  }
  banner.classList.add('visible');
  const message = last
    ? '📦 最後のバックアップから<strong>' + daysSince(last) + '日</strong>経っています。念のためバックアップを取っておきましょう。'
    : '📦 まだ一度もバックアップを取っていません。念のため取っておきましょう。';
  banner.innerHTML = message
    + '<button type="button" id="backupReminderDownloadBtn">📦 今すぐバックアップ</button>'
    + '<span class="backupReminderDismissBtn" id="backupReminderDismissBtn">✖</span>';
}
document.getElementById('downloadBackupBtn').addEventListener('click', downloadFullBackup);
document.getElementById('backupReminderBanner').addEventListener('click', (e) => {
  if (e.target.closest('#backupReminderDownloadBtn')) {
    downloadFullBackup();
    return;
  }
  if (e.target.closest('#backupReminderDismissBtn')) {
    localStorage.setItem(BACKUP_SNOOZE_AT_KEY, todayStr());
    renderBackupReminderBanner();
  }
});
document.querySelector('.tabBtn[data-page="settingsPage"]').addEventListener('click', renderBackupLastInfo);
/* ▲▲▲ 新規追加：全データバックアップ機能 ここまで ▲▲▲ */
