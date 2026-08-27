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
const dupArchiveToggleBtn = document.getElementById('dupArchiveToggleBtn');
if (dupArchiveToggleBtn) dupArchiveToggleBtn.addEventListener('click', () => {
  dupArchiveListVisible = !dupArchiveListVisible;
  renderDupArchive();
});
renderDupArchive();
renderSyncConflictBanner();
if (typeof renderBackupReminderBanner === 'function') renderBackupReminderBanner();
if (typeof renderBackupLastInfo === 'function') renderBackupLastInfo();
if (typeof renderGamificationPanel === 'function') renderGamificationPanel();
if (typeof renderBadgesSection === 'function') renderBadgesSection();
if (typeof renderSummarySection === 'function') renderSummarySection();
if (typeof renderQuoteCard === 'function') renderQuoteCard();
