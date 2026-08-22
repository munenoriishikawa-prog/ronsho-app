/* ▼▼▼ 新規追加：学習モチベーション向上機能（既存の変数・関数名と一切重複しない名前空間で実装） ▼▼▼
   レベル/XP・今日の目標リング・実績バッジ・学習ヒートマップ。
   既存の entries / studyLog には一切書き込まず、既存データから導出するだけ。
   保存先は専用のキー 'ronshoDailyGoalV1' のみを使用する。 */

const DAILY_GOAL_KEY = 'ronshoDailyGoalV1';
const DEFAULT_DAILY_GOAL = 10;
function loadDailyGoal() {
  const raw = localStorage.getItem(DAILY_GOAL_KEY);
  const n = Number(raw);
  return (raw && n > 0) ? n : DEFAULT_DAILY_GOAL;
}
function saveDailyGoal(n) {
  localStorage.setItem(DAILY_GOAL_KEY, String(n));
}

function computeTotalStudyCount() {
  let total = 0;
  Object.values(studyLog).forEach(log => { total += (log.history || []).length; });
  return total;
}
function computeMemorizedCount() {
  return entries.filter(e => studyLog[e.title] && studyLog[e.title].memorized).length;
}
function computeXp() {
  return computeTotalStudyCount() * 10 + computeMemorizedCount() * 50;
}
function getLevelInfo(xp) {
  let level = 1;
  let threshold = 0;
  let need = 100;
  while (xp >= threshold + need) {
    threshold += need;
    level++;
    need = level * 100;
  }
  return { level: level, xpIntoLevel: xp - threshold, xpForThisLevel: need, xp: xp };
}
function getTodayStudiedCount() {
  const today = todayStr();
  return entries.filter(e => {
    const log = studyLog[e.title];
    return !!(log && log.history && log.history.includes(today));
  }).length;
}

function renderGamificationPanel() {
  const wrap = document.getElementById('gamificationRow');
  if (!wrap) return;
  if (entries.length === 0) {
    wrap.innerHTML = '';
    return;
  }
  const info = getLevelInfo(computeXp());
  const levelPct = info.xpForThisLevel > 0 ? Math.round((info.xpIntoLevel / info.xpForThisLevel) * 100) : 0;
  const todayCount = getTodayStudiedCount();
  const goal = loadDailyGoal();
  const goalPct = goal > 0 ? Math.min(100, Math.round((todayCount / goal) * 100)) : 0;
  wrap.innerHTML = '<div class="gamiCard gamiLevelCard">'
    + '<div class="gamiCardTitle">🏆 LV.' + info.level + '</div>'
    + '<div class="gamiBarOuter"><div class="gamiBarInner" style="width:' + levelPct + '%;"></div></div>'
    + '<div class="gamiCardSub">XP ' + info.xpIntoLevel + ' / ' + info.xpForThisLevel + '</div>'
    + '</div>'
    + '<div class="gamiCard gamiGoalCard" id="dailyGoalRing" title="クリックして今日の目標を変更">'
    + '<div class="gamiRing" style="background: conic-gradient(#0057e7 ' + goalPct + '%, #e6edf7 ' + goalPct + '% 100%);"><div class="gamiRingInner">' + todayCount + ' / ' + goal + '</div></div>'
    + '<div class="gamiCardTitle">🎯 今日の目標</div>'
    + '</div>';
}
document.getElementById('gamificationRow') && document.getElementById('gamificationRow').addEventListener('click', (e) => {
  const ring = e.target.closest('#dailyGoalRing');
  if (!ring) return;
  const input = prompt('今日の目標問題数を入力してください', String(loadDailyGoal()));
  if (input === null) return;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) { alert('1以上の数値を入力してください。'); return; }
  saveDailyGoal(Math.round(n));
  renderGamificationPanel();
});

const BADGE_DEFS = [
  { id: 'first_step', icon: '🌱', name: 'はじめの一歩', desc: '論証を1回学習する', check: s => s.totalStudy >= 1 },
  { id: 'study_10', icon: '📘', name: '10問クリア', desc: '学習回数の合計が10回に到達', check: s => s.totalStudy >= 10 },
  { id: 'study_100', icon: '📗', name: '100問クリア', desc: '学習回数の合計が100回に到達', check: s => s.totalStudy >= 100 },
  { id: 'study_500', icon: '📕', name: '500問クリア', desc: '学習回数の合計が500回に到達', check: s => s.totalStudy >= 500 },
  { id: 'memorized_10', icon: '⭐', name: '暗記10件', desc: '暗記済みが10件に到達', check: s => s.memorized >= 10 },
  { id: 'memorized_50', icon: '🌟', name: '暗記50件', desc: '暗記済みが50件に到達', check: s => s.memorized >= 50 },
  { id: 'memorized_100', icon: '🏅', name: '暗記100件', desc: '暗記済みが100件に到達', check: s => s.memorized >= 100 },
  { id: 'subject_complete', icon: '🎯', name: '科目コンプリート', desc: 'いずれかの科目で暗記率100%を達成', check: s => s.hasCompleteSubject },
  { id: 'all_subjects_touched', icon: '🔥', name: '全科目に着手', desc: 'すべての科目で1件以上学習', check: s => s.allSubjectsTouched },
  { id: 'tag_user', icon: '🏷️', name: 'タグ活用', desc: 'タグを5種類以上作成', check: s => s.tagCount >= 5 }
];
function computeBadgeStats() {
  const totalStudy = computeTotalStudyCount();
  const memorized = computeMemorizedCount();
  const subjectStats = {};
  entries.forEach(e => {
    const s = e.subject || 'その他';
    if (!subjectStats[s]) subjectStats[s] = { total: 0, memorized: 0, studied: 0 };
    subjectStats[s].total++;
    if (studyLog[e.title] && studyLog[e.title].memorized) subjectStats[s].memorized++;
    if (studyLog[e.title] && (studyLog[e.title].history || []).length > 0) subjectStats[s].studied++;
  });
  const subjectList = Object.values(subjectStats);
  const hasCompleteSubject = subjectList.some(s => s.total > 0 && s.memorized === s.total);
  const allSubjectsTouched = subjectList.length > 0 && subjectList.every(s => s.studied > 0);
  const tagCount = (typeof getUniqueTags === 'function') ? getUniqueTags().length : 0;
  return { totalStudy: totalStudy, memorized: memorized, hasCompleteSubject: hasCompleteSubject, allSubjectsTouched: allSubjectsTouched, tagCount: tagCount };
}
let badgesListVisible = false;
function renderBadgesSection() {
  const wrap = document.getElementById('badgesSection');
  if (!wrap) return;
  if (entries.length === 0) {
    wrap.innerHTML = '';
    return;
  }
  const stats = computeBadgeStats();
  const earnedIds = new Set(BADGE_DEFS.filter(b => b.check(stats)).map(b => b.id));
  let html = '<div class="badgesSectionTitle">🏅 実績バッジ</div>'
    + '<span class="speechDictToggle" id="badgesToggleBtn">' + (badgesListVisible ? '▼ 一覧を隠す' : '▶ 一覧を表示する') + '（' + earnedIds.size + ' / ' + BADGE_DEFS.length + '件獲得）</span>';
  html += '<div class="badgesGrid" id="badgesGridWrap" style="display:' + (badgesListVisible ? '' : 'none') + ';">';
  BADGE_DEFS.forEach(b => {
    const earned = earnedIds.has(b.id);
    html += '<div class="badgeItem' + (earned ? ' earned' : '') + '" title="' + escapeHtml(b.desc) + '">'
      + '<div class="badgeIcon">' + b.icon + '</div>'
      + '<div class="badgeName">' + escapeHtml(b.name) + '</div>'
      + '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}
document.getElementById('badgesSection') && document.getElementById('badgesSection').addEventListener('click', (e) => {
  const btn = e.target.closest('#badgesToggleBtn');
  if (!btn) return;
  badgesListVisible = !badgesListVisible;
  renderBadgesSection();
});

function renderStudyHeatmap() {
  const wrap = document.getElementById('studyHeatmapWrap');
  if (!wrap) return;
  if (entries.length === 0) {
    wrap.innerHTML = '';
    return;
  }
  const counts = getDailyStudyCounts();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeksToShow = 12;
  const totalDays = weeksToShow * 7 + today.getDay();
  const cells = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatLocalDate(d);
    cells.push({ dateStr: dateStr, count: counts[dateStr] || 0 });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const levelOf = c => c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 9 ? 3 : 4;
  let html = '<div class="heatmapTitle">📅 学習ヒートマップ（直近12週間・クリックでカレンダーに移動）</div><div class="heatmapGrid">';
  weeks.forEach(week => {
    html += '<div class="heatmapCol">';
    week.forEach(cell => {
      const isSelected = cell.dateStr === selectedDay;
      html += '<div class="heatmapCell heatmapClickable heatmapLevel' + levelOf(cell.count) + (isSelected ? ' heatmapSelected' : '')
        + '" data-date="' + cell.dateStr + '" title="' + cell.dateStr + '：' + cell.count + '件"></div>';
    });
    html += '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}
document.getElementById('studyHeatmapWrap') && document.getElementById('studyHeatmapWrap').addEventListener('click', (e) => {
  const cell = e.target.closest('.heatmapClickable');
  if (!cell) return;
  const d = cell.dataset.date;
  const dt = new Date(d + 'T00:00:00');
  calViewYear = dt.getFullYear();
  calViewMonth = dt.getMonth();
  selectedDay = (selectedDay === d) ? null : d;
  renderCalendar();
  renderStudyHeatmap();
  const calWrap = document.getElementById('calendarWrap');
  if (calWrap) calWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
/* ▲▲▲ 新規追加：学習モチベーション向上機能 ここまで ▲▲▲ */
