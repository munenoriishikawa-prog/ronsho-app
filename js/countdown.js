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

function buildCountdownPaceHtml(days) {
  if (typeof entries === 'undefined' || entries.length === 0) return '';
  const remaining = entries.filter(e => !(studyLog[e.title] && studyLog[e.title].memorized)).length;
  if (remaining === 0) return '<div class="countdownPace">🎉 未暗記の論証はありません！</div>';
  const quota = Math.ceil(remaining / Math.max(days, 1));
  return '<div class="countdownPace">📌 未暗記' + remaining + '件 ÷ 残り' + Math.max(days, 1) + '日 = 1日あたり<strong>' + quota + '問</strong>のペースが必要です。</div>';
}
function renderCountdownCard() {
  const el = document.getElementById('countdownCard');
  if (!el) return;
  const list = loadCountdowns();
  const withDays = list.map(c => ({ ...c, days: getDaysUntil(c.date) }));
  const upcoming = withDays.filter(c => c.days >= 0).sort((a, b) => a.days - b.days);
  const past = withDays.filter(c => c.days < 0).sort((a, b) => b.days - a.days);
  const ordered = upcoming.concat(past);

  const nearestUpcoming = upcoming.length > 0 ? upcoming[0] : null;
  const itemsHtml = ordered.map(c => {
    const isPast = c.days < 0;
    const daysLabel = isPast ? (Math.abs(c.days) + '日経過') : (c.days === 0 ? '本日！' : 'あと' + c.days + '日');
    const urgentClass = (!isPast && c.days <= 7) ? ' countdownUrgent' : (isPast ? ' countdownPast' : '');
    const isNearest = nearestUpcoming && c.id === nearestUpcoming.id;
    const paceHtml = isNearest ? buildCountdownPaceHtml(c.days) : '';
    return '<div class="countdownItem' + urgentClass + '">'
      + '<span class="countdownLabel">' + escapeHtml(c.label) + '</span>'
      + '<span class="countdownDays">' + daysLabel + '</span>'
      + '<span class="countdownDate">（' + escapeHtml(c.date) + '）</span>'
      + '<span class="countdownDeleteBtn" data-id="' + c.id + '" title="削除">🗑</span>'
      + paceHtml
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

