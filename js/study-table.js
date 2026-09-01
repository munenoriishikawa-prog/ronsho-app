function buildRowHtml(e, idx, showUndo, collapseBody, searchQuery) {
  const log = studyLog[e.title] || {};
  const history = log.history || [];
  const savedDate = history.length ? history[history.length - 1] : '';
  const memorizedSaved = log.memorized || false;
  const starred = log.starred || false;
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
  const memoTitle = memo ? ('メモ：' + memo) : 'メモを追加';
  const memoHtml = '<span class="memoToggle' + (memo ? ' active' : '') + '" data-idx="' + idx + '" title="' + escapeHtml(memoTitle) + '">🗒️</span>';
  const skipped = !!log.skipped;
  // 問題演習の⏭️ボタンでスキップにした論証は、通常の出題からは除外され続けるが、
  // これまでホーム画面側には表示も解除手段も無く、一度スキップすると
  // 気づかないまま二度と出題されなくなってしまっていた。ここに表示・解除の
  // 手段を用意する
  const skipHtml = '<span class="skipToggle' + (skipped ? ' active' : '') + '" data-idx="' + idx + '" title="' + (skipped ? 'スキップ中（問題演習から除外）。クリックで解除' : 'クリックで問題演習から除外') + '">⏭️</span>';
  const isEditing = editingEntryTitle === e.title;
  const editToggleHtml = '<span class="editToggle' + (isEditing ? ' active' : '') + '" data-idx="' + idx + '" title="内容を編集">✏️</span>';
  const isCompareSelected = compareList.includes(e.title);
  const compareToggleHtml = '<span class="compareToggle' + (isCompareSelected ? ' active' : '') + '" data-title="' + escapeHtml(e.title) + '" title="比較に追加／解除">⚖️</span>';
  const titleCellContent = isEditing
    ? '<input type="text" class="editTitleInput" data-idx="' + idx + '" value="' + escapeHtml(e.title) + '">'
    : '<div class="titleCellWrap"><div class="titleIconsRow">' + starHtml + memoHtml + compareToggleHtml + editToggleHtml + skipHtml + '</div><div class="titleText">' + titleHtml + '</div></div>';
  let bodyCellContent;
  if (isEditing) {
    bodyCellContent = buildBodyEditorHtml(e, idx);
  } else if (collapseBody && !expandedBodySet.has(e.title)) {
    bodyCellContent = '<div class="bodyCellArea collapsedState" data-idx="' + idx + '">📝 タップして表示</div>' + buildEntryTagsBlockHtml(e);
  } else if (collapseBody) {
    bodyCellContent = '<div class="bodyCellArea" data-idx="' + idx + '">' + highlightSearch(e.bodyHtml, searchQuery) + '</div>' + buildEntryTagsBlockHtml(e);
  } else {
    bodyCellContent = highlightSearch(e.bodyHtml, searchQuery) + buildEntryTagsBlockHtml(e);
  }
  return '<tr class="entryRow' + (overdue ? ' overdueRow' : '') + (starred ? ' starredRow' : '') + '" data-idx="' + idx + '">'
    + '<td class="checkCell">' + buildConfidenceGroupHtml(idx, log.confidence || null) + '</td>'
    + '<td class="verticalCol subjectCell" data-idx="' + idx + '" title="タップして科目を編集">' + escapeHtml(e.subject || '未設定') + '</td>'
    + '<td class="verticalCol">' + escapeHtml(e.category || (studyLog[e.title] && studyLog[e.title].category) || '') + '</td>'
    + '<td>' + titleCellContent + '</td>'
    + '<td>' + bodyCellContent + '</td>'
    + '<td>' + buildYearHtml(e.year) + '</td>'
    + '<td class="countCell">' + history.length + undoBtn + '</td>'
    + '<td>' + (savedDate || '-') + '</td>'
    + '<td>' + reviewCell + '</td>'
    + '</tr>';
}
const TABLE_PAGE_SIZE = 50;
let studyTableVisibleCount = TABLE_PAGE_SIZE;
let studyTableFilterKey = '';
function currentFilterKey(searchQuery) {
  return [selectedSubject, selectedCategory, selectedTag, starFilterMode, selectedImportance, minYearFrequency, sortByFrequency, searchQuery].join('|');
}
// 論証数が多い端末（特にiPad等の非力な端末）で描画が重くならないよう、
// 一度に描画する行数を制限し「もっと見る」で追加表示する。
// フィルタ条件が変わったときだけ表示件数をリセットする。
function renderStudyTable(data) {
  // 「すべて表示」の場合は暗記済みも含めて表示する（暗記済みを除きたい場合は
  // 「🙈 暗記済みを除く」を選ぶ。以前は常に未暗記のみに絞っていたが、
  // 明示的に選べるようにした）
  const filtered = filterEntries(data, searchQueryStudy);
  const filterKey = currentFilterKey(searchQueryStudy);
  if (filterKey !== studyTableFilterKey) {
    studyTableFilterKey = filterKey;
    studyTableVisibleCount = TABLE_PAGE_SIZE;
  }
  const total = filtered.length;
  const visible = filtered.slice(0, studyTableVisibleCount);
  let html = '<table>' + ENTRY_TABLE_COLGROUP + '<thead><tr><th>暗記度</th><th>科目</th><th>分野</th><th>タイトル</th><th>本文</th><th>出題年</th><th>学習回数</th><th>最終学習日</th><th>復習推奨日</th></tr></thead><tbody>';
  visible.forEach((e) => {
    const idx = entries.indexOf(e);
    html += buildRowHtml(e, idx, false, true, searchQueryStudy);
  });
  html += '</tbody></table>';
  if (total > studyTableVisibleCount) {
    html += '<div class="loadMoreRow"><button type="button" id="studyLoadMoreBtn">もっと見る（残り' + (total - studyTableVisibleCount) + '件）</button></div>';
  }
  if (total === 0 && starFilterMode === 'hideMemorized') {
    html = '<div class="reviewList"><div class="reviewItem">🎉 未暗記の論証はありません。すべて暗記済みです。</div></div>';
  } else if (total === 0 && starFilterMode === 'memorizedOnly') {
    html = '<div class="reviewList"><div class="reviewItem">暗記済みの論証はまだありません。◎完璧または○できたを押すとここに表示されます。</div></div>';
  } else if (total === 0) {
    html = '<div class="reviewList"><div class="reviewItem">該当する論証がありません。</div></div>';
  }
  tableWrap.innerHTML = html;
  searchCountStudy.textContent = searchQueryStudy ? total + '件見つかりました' : '';
  renderProgressSummary();
}
function getCsvFilteredEntries() {
  const unmemorized = entries.filter(e => !(studyLog[e.title] && studyLog[e.title].memorized));
  if (selectedCsvSubject === 'all') return unmemorized;
  return unmemorized.filter(e => (e.subject || 'その他') === selectedCsvSubject);
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
let categoryTotalListVisible = false;
let reviewListVisible = false;
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
// 週次/月次の各バケットのラベルと、バケットの最終日(当日を含む週・月は本日)を返す。
// 学習回数の推移(期間ごとの合計)にも、暗記率の推移(期間末時点の値)にも使う
function getTrendBuckets(mode) {
  const today = new Date();
  const buckets = [];
  if (mode === 'week') {
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - (w * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      buckets.push({
        label: (weekStart.getMonth() + 1) + '/' + weekStart.getDate(),
        start: weekStart, end: weekEnd
      });
    }
  } else {
    for (let m = 11; m >= 0; m--) {
      const target = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      buckets.push({
        label: target.getFullYear() + '/' + (target.getMonth() + 1),
        start: target, end: monthEnd
      });
    }
  }
  return buckets;
}
// 折れ線グラフのSVGを組み立てる共通処理。学習回数(左軸)・暗記率(右軸)の
// 単位が違う2本の線を、1つのグラフに重ねて表示する（rightSeriesを渡さなければ
// 学習回数だけの単軸グラフになる）
function buildTrendSvg(labels, leftSeries, rightSeries) {
  const w = 680, h = 200, padL = 40, padR = 40, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : innerW;
  function mapPoints(series) {
    const maxVal = Math.max(1, ...series.values);
    return { maxVal, points: series.values.map((v, i) => ({
      x: padL + i * stepX,
      y: padT + innerH - (v / maxVal) * innerH,
      v, label: labels[i]
    })) };
  }
  function pathOf(points) {
    return points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  }
  const left = mapPoints(leftSeries);
  let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="max-width:720px;">';
  svg += '<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + leftSeries.color + '" stop-opacity="0.2"/><stop offset="100%" stop-color="' + leftSeries.color + '" stop-opacity="0"/></linearGradient></defs>';
  const leftPathD = pathOf(left.points);
  const leftAreaD = leftPathD + ' L' + left.points[left.points.length - 1].x.toFixed(1) + ',' + (padT + innerH) + ' L' + left.points[0].x.toFixed(1) + ',' + (padT + innerH) + ' Z';
  svg += '<path d="' + leftAreaD + '" fill="url(#trendGrad)" stroke="none"/>';
  svg += '<path d="' + leftPathD + '" fill="none" stroke="' + leftSeries.color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  left.points.forEach(p => {
    svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.2" fill="' + leftSeries.color + '"><title>' + escapeHtml(p.label) + '：' + leftSeries.formatValue(p.v) + '</title></circle>';
  });
  svg += '<text x="4" y="' + (padT + 4) + '" font-size="9" fill="' + leftSeries.color + '">' + leftSeries.formatValue(left.maxVal) + '</text>';
  if (rightSeries) {
    const right = mapPoints(rightSeries);
    const rightPathD = pathOf(right.points);
    svg += '<path d="' + rightPathD + '" fill="none" stroke="' + rightSeries.color + '" stroke-width="2.5" stroke-dasharray="5,4" stroke-linejoin="round" stroke-linecap="round"/>';
    right.points.forEach(p => {
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.2" fill="' + rightSeries.color + '"><title>' + escapeHtml(p.label) + '：' + rightSeries.formatValue(p.v) + '</title></circle>';
    });
    svg += '<text x="' + (w - 4) + '" y="' + (padT + 4) + '" font-size="9" fill="' + rightSeries.color + '" text-anchor="end">' + rightSeries.formatValue(right.maxVal) + '</text>';
  }
  labels.forEach((label, i) => {
    if (i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1) {
      const x = padL + i * stepX;
      svg += '<text x="' + x.toFixed(1) + '" y="' + (h - 8) + '" font-size="9" fill="#4a6a90" text-anchor="middle">' + escapeHtml(label) + '</text>';
    }
  });
  svg += '</svg>';
  return svg;
}
// 「今日の伸びしろ」機能が日々記録しているdailyStats（各日の暗記済み件数の
// スナップショット）を再利用し、記録がある日を最新のものから遡って引き継ぐ
// (株価チャートのように、記録の無い日は直前の記録値をそのまま延ばす)ことで
// 週次・月次の各期間末時点の暗記率(%)を求める。母数(全論証数)は現在の件数を
// 使うため、大きく論証数が増減した場合は目安になる（学習推移と同じ考え方）
function getMemorizedPctSeries() {
  const stats = loadDailyStats();
  const total = entries.length;
  const dates = Object.keys(stats).sort();
  const pctByDate = {};
  dates.forEach(d => {
    const v = stats[d];
    const memorized = (typeof v === 'number') ? v : ((v && v.memorized) || 0);
    pctByDate[d] = total > 0 ? (memorized / total) * 100 : 0;
  });
  return { dates, pctByDate };
}
function pctAtOrBefore(dates, pctByDate, targetDateStr) {
  let result = null;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] <= targetDateStr) result = pctByDate[dates[i]];
    else break;
  }
  return result;
}
// バケット(週/月)ごとの期間末時点の暗記率を求める。最初の記録より前の
// バケットは、最初に記録された値をそのまま延長する（学習推移の折れ線と
// 長さ・並びを揃え、1つのグラフに重ねて表示できるようにするため）
function buildAlignedMemorizedPctValues(buckets) {
  const { dates, pctByDate } = getMemorizedPctSeries();
  if (dates.length === 0) return null;
  const raw = buckets.map(b => pctAtOrBefore(dates, pctByDate, formatLocalDate(b.end)));
  const firstKnownIdx = raw.findIndex(v => v != null);
  if (firstKnownIdx === -1) return null;
  for (let i = 0; i < firstKnownIdx; i++) raw[i] = raw[firstKnownIdx];
  return raw.map(v => Math.round(v * 10) / 10);
}
// --- 学習推移・暗記率の推移グラフ（1つのグラフにまとめて表示） ---
function renderTrendChart() {
  if (!trendWrap) return;
  const dailyCounts = getDailyStudyCounts();
  const buckets = getTrendBuckets(trendMode);
  const labels = [];
  const countValues = [];
  buckets.forEach(b => {
    let sum = 0;
    if (trendMode === 'week') {
      for (let d = 0; d < 7; d++) {
        const day = new Date(b.start);
        day.setDate(b.start.getDate() + d);
        sum += dailyCounts[formatLocalDate(day)] || 0;
      }
    } else {
      Object.keys(dailyCounts).forEach(dateStr => {
        const dd = new Date(dateStr + 'T00:00:00');
        if (dd.getFullYear() === b.start.getFullYear() && dd.getMonth() === b.start.getMonth()) sum += dailyCounts[dateStr];
      });
    }
    labels.push(b.label);
    countValues.push(sum);
  });
  const total = countValues.reduce((a, b) => a + b, 0);
  const avg = countValues.length ? Math.round((total / countValues.length) * 10) / 10 : 0;
  const pctValues = buildAlignedMemorizedPctValues(buckets);

  const modeLabel = trendMode === 'week' ? '週次（直近8週間）' : '月次（直近12ヶ月）';
  const leftSeries = { values: countValues, color: '#0057e7', formatValue: v => v + '件' };
  let svg, pctSummaryHtml, legendHtml;
  if (pctValues) {
    const rightSeries = { values: pctValues, color: '#00a86b', formatValue: v => v + '%' };
    svg = buildTrendSvg(labels, leftSeries, rightSeries);
    const latestPct = pctValues[pctValues.length - 1];
    const diffPct = Math.round((latestPct - pctValues[0]) * 10) / 10;
    pctSummaryHtml = ' ／ 暗記率 現在 ' + latestPct + '%（期間内で' + (diffPct >= 0 ? '+' : '') + diffPct + 'pt）';
    legendHtml = '<div class="trendLegend">'
      + '<span class="trendLegendItem"><span class="trendLegendSwatch" style="background:#0057e7;"></span>学習回数（左軸）</span>'
      + '<span class="trendLegendItem"><span class="trendLegendSwatch trendLegendSwatchDashed" style="border-top-color:#00a86b;"></span>暗記率（右軸）</span>'
      + '</div>';
  } else {
    svg = buildTrendSvg(labels, leftSeries);
    pctSummaryHtml = '';
    legendHtml = '<div class="trendSummary">暗記率の記録はまだありません。日をまたいでアプリを開くと少しずつ記録されます。</div>';
  }
  trendWrap.innerHTML = '<div class="trendCard">'
    + '<div class="trendHeader">'
    + '<div class="trendTitle">📈 学習・暗記率の推移（' + modeLabel + '）</div>'
    + '<div class="trendToggle">'
    + '<button type="button" class="trendToggleBtn' + (trendMode === 'week' ? ' active' : '') + '" data-trend="week">週次</button>'
    + '<button type="button" class="trendToggleBtn' + (trendMode === 'month' ? ' active' : '') + '" data-trend="month">月次</button>'
    + '</div>'
    + '</div>'
    + legendHtml
    + '<div class="trendSummary">学習回数 期間合計 ' + total + '件 ／ 平均 ' + avg + '件' + pctSummaryHtml + '</div>'
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
    const heatLevel = (typeof heatmapLevelOf === 'function') ? heatmapLevelOf(count) : 0;
    html += '<div class="calCell calHeatLevel' + heatLevel + ' calDayClickable' + (isSelected ? ' selectedDay' : '') + '" data-date="' + dateStr + '" style="cursor:pointer;">'
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
  html += '<h3>分野別 学習回数（全期間合計）</h3>';
  html += '<span class="speechDictToggle" id="categoryTotalToggleBtn">' + (categoryTotalListVisible ? '▼ 一覧を隠す' : '▶ 一覧を表示する') + '（' + Object.keys(categoryTotal).length + '件）</span>';
  html += '<div class="reviewList" id="categoryTotalListWrap" style="display:' + (categoryTotalListVisible ? '' : 'none') + ';">';
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
  const upcoming = reviewItems.filter(r => r.overdue || r.nextDate <= addDays(today, 7));
  html += '<h3>復習が推奨される論点（忘却曲線ベース）</h3>';
  html += '<span class="speechDictToggle" id="reviewListToggleBtn">' + (reviewListVisible ? '▼ 一覧を隠す' : '▶ 一覧を表示する') + '（' + upcoming.length + '件）</span>';
  html += '<div class="reviewList" id="reviewListWrap" style="display:' + (reviewListVisible ? '' : 'none') + ';">';
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
  // 「ダメ」を選んだ場合も、他の暗記度と同様に学習履歴には今日の日付を
  // 追加するだけにする（以前は履歴を今日1件だけに巻き戻していたため、
  // 正直に「ダメ」と答えて復習しただけで学習回数・経験値が減ってしまい、
  // 学習したのに後退したように見えていた）。次回の復習日を早める効果は
  // getNextReviewInfo()側でconfidence==='bad'のときに間隔を1日にする形で
  // 別途担っているため、履歴を巻き戻さなくても「明日また復習」は変わらない
  const hist = studyLog[title].history;
  if (hist[hist.length - 1] !== today) hist.push(today);
  const wasMemorized = !!studyLog[title].memorized;
  studyLog[title].confidence = level;
  studyLog[title].memorized = (level === 'good' || level === 'perfect');
  studyLog[title].category = ent.category || studyLog[title].category || '';
  studyLog[title].subject = ent.subject || studyLog[title].subject || '';
  saveStudyLog();
  // 暗記度に応じてXPを加算する（どの暗記度でも必ず増える）。
  // 新たに暗記済みになった回だけボーナスXPも加える
  if (typeof awardXp === 'function') {
    awardXp(level);
    if (!wasMemorized && studyLog[title].memorized && typeof awardMemorizedBonusXp === 'function') {
      awardMemorizedBonusXp();
    }
  }
  const xpGained = XP_BY_CONFIDENCE[level] || 0;
  if (level === 'perfect') {
    if (sourceEl) triggerFireworkLevelUp(sourceEl);
    status.textContent = '🎉 「' + title + '」を暗記済み一覧に移動しました！（完璧！ +' + xpGained + 'XP）';
  } else if (level === 'good') {
    if (sourceEl) triggerFireworkLevelUp(sourceEl);
    status.textContent = '🎉 「' + title + '」を暗記済み一覧に移動しました！（+' + xpGained + 'XP）';
  } else if (level === 'unsure') {
    status.textContent = '「' + title + '」を「あやしい」に設定しました。復習間隔を短縮します。（+' + xpGained + 'XP）';
  } else {
    status.textContent = '「' + title + '」を「ダメ」に設定しました。明日また復習しましょう。（+' + xpGained + 'XP）';
  }
  renderStudyTable(entries);
  renderCalendar();
  renderTrendChart();
  // ホーム上部の全体カード・科目別学習回数・レベル/今日の目標は、問題演習からの
  // 回答も含めてここで更新しないと、答えても学習回数が増えていないように見えてしまう
  renderProgressSummary();
  if (typeof renderGamificationPanel === 'function') renderGamificationPanel();
  if (typeof renderSummarySection === 'function') renderSummarySection();
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
  status.textContent = studyLog[title].skipped ? '⏭️ 「' + title + '」をスキップしました（問題演習から除外）。' : '「' + title + '」のスキップを解除しました。';
  renderStudyTable(entries);
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
}
function editSource(idx) {
  const ent = entries[idx];
  if (!ent) return;
  const input = prompt('「' + ent.title + '」の出典（教材名・ページ数など）を入力してください', ent.source || '');
  if (input === null) return;
  const trimmed = input.trim();
  ent.source = trimmed;
  saveEntries();
  status.textContent = trimmed ? '📚 「' + ent.title + '」の出典を保存しました。' : '「' + ent.title + '」の出典を削除しました。';
  renderStudyTable(entries);
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
  wrapEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.editColorSwatch') || e.target.closest('.editColorClearBtn') || e.target.closest('.editBoldBtn')) {
      e.preventDefault();
    }
  });
  wrapEl.addEventListener('keydown', (e) => {
    if (e.target.closest('.editBodyArea')) handleBodyEditorKeydown(e);
  });
  wrapEl.addEventListener('click', (e) => {
    const editToggle = e.target.closest('.editToggle');
    if (editToggle) {
      e.stopPropagation();
      const idx = Number(editToggle.dataset.idx);
      const ent = entries[idx];
      if (!ent) return;
      editingEntryTitle = editingEntryTitle === ent.title ? null : ent.title;
      renderStudyTable(entries);
      return;
    }
    const boldBtn = e.target.closest('.editBoldBtn');
    if (boldBtn) {
      e.stopPropagation();
      applyBodyEditorBold();
      return;
    }
    const colorSwatch = e.target.closest('.editColorSwatch');
    if (colorSwatch) {
      e.stopPropagation();
      applyBodyEditorColor(colorSwatch.dataset.color);
      return;
    }
    const colorClearBtn = e.target.closest('.editColorClearBtn');
    if (colorClearBtn) {
      e.stopPropagation();
      document.execCommand('removeFormat');
      return;
    }
    const editSaveBtn = e.target.closest('.editSaveBtn');
    if (editSaveBtn) {
      e.stopPropagation();
      saveEntryEdit(Number(editSaveBtn.dataset.idx));
      return;
    }
    const editCancelBtn = e.target.closest('.editCancelBtn');
    if (editCancelBtn) {
      e.stopPropagation();
      editingEntryTitle = null;
      renderStudyTable(entries);
      return;
    }
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
    const memoToggle = e.target.closest('.memoToggle');
    if (memoToggle) {
      e.stopPropagation();
      editMemo(Number(memoToggle.dataset.idx));
      return;
    }
    const skipToggle = e.target.closest('.skipToggle');
    if (skipToggle) {
      e.stopPropagation();
      toggleSkip(Number(skipToggle.dataset.idx));
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
document.addEventListener('change', (e) => {
  const subjectTabSelect = e.target.closest('.subjectTabSelect');
  if (subjectTabSelect) {
    selectedSubject = subjectTabSelect.value;
    selectedCategory = 'all';
    renderSubjectTabs();
    renderStudyTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const categoryTabSelect = e.target.closest('.categoryTabSelect');
  if (categoryTabSelect) {
    selectedCategory = categoryTabSelect.value;
    renderSubjectTabs();
    renderStudyTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
});
document.addEventListener('click', (e) => {
  const studyLoadMoreBtn = e.target.closest('#studyLoadMoreBtn');
  if (studyLoadMoreBtn) {
    studyTableVisibleCount += TABLE_PAGE_SIZE;
    renderStudyTable(entries);
    return;
  }
  const trendToggleBtn = e.target.closest('.trendToggleBtn');
  if (trendToggleBtn) {
    trendMode = trendToggleBtn.dataset.trend;
    renderTrendChart();
    return;
  }
  const starTabBtn = e.target.closest('.starFilterBtn[data-star]');
  if (starTabBtn) {
    starFilterMode = starTabBtn.dataset.star;
    renderSubjectTabs();
    renderStudyTable(entries);
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
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const freqTabBtn = e.target.closest('.starFilterBtn[data-freq]');
  if (freqTabBtn) {
    minYearFrequency = Number(freqTabBtn.dataset.freq);
    renderSubjectTabs();
    renderStudyTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const freqSortBtn = e.target.closest('#freqSortBtn');
  if (freqSortBtn) {
    sortByFrequency = !sortByFrequency;
    renderSubjectTabs();
    renderStudyTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const tagFilterBtn = e.target.closest('.tagFilterBtn');
  if (tagFilterBtn) {
    selectedTag = tagFilterBtn.dataset.tag;
    renderSubjectTabs();
    renderStudyTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const relatedEntryLink = e.target.closest('.relatedEntryLink');
  if (relatedEntryLink) {
    jumpToEntryByTitle(relatedEntryLink.dataset.title);
    return;
  }
  const tagChip = e.target.closest('.entryTagChip');
  if (tagChip) {
    selectedTag = tagChip.dataset.tag;
    renderSubjectTabs();
    renderStudyTable(entries);
    quizStarted = false;
    renderQuizPage();
    return;
  }
  const compareToggle = e.target.closest('.compareToggle');
  if (compareToggle) {
    toggleCompare(compareToggle.dataset.title);
    return;
  }
  const compareOpenBtn = e.target.closest('#compareOpenBtn');
  if (compareOpenBtn) {
    openCompareModal();
    return;
  }
  const compareClearBtn = e.target.closest('#compareClearBtn');
  if (compareClearBtn) {
    compareList = [];
    renderCompareBar();
    renderStudyTable(entries);
    return;
  }
  const compareModalCloseBtn = e.target.closest('#compareModalCloseBtn');
  if (compareModalCloseBtn) {
    closeCompareModal();
    return;
  }
  if (e.target.id === 'compareModalOverlay') {
    closeCompareModal();
    return;
  }
  const syncConflictResolveBtn = e.target.closest('#syncConflictResolveBtn');
  if (syncConflictResolveBtn) {
    const tabBtn = document.querySelector('.tabBtn[data-page="csvPage"]');
    if (tabBtn) tabBtn.click();
    const checkBtn = document.getElementById('checkDuplicatesBtn');
    if (checkBtn) checkBtn.click();
    return;
  }
  const syncConflictDismissBtn = e.target.closest('#syncConflictDismissBtn');
  if (syncConflictDismissBtn) {
    const banner = document.getElementById('syncConflictBanner');
    if (banner) { banner.innerHTML = ''; banner.classList.remove('visible'); }
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
  const categoryTotalToggleBtn = e.target.closest('#categoryTotalToggleBtn');
  if (categoryTotalToggleBtn) {
    categoryTotalListVisible = !categoryTotalListVisible;
    renderCalendar();
    return;
  }
  const reviewListToggleBtn = e.target.closest('#reviewListToggleBtn');
  if (reviewListToggleBtn) {
    reviewListVisible = !reviewListVisible;
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
  const filtered = getCsvFilteredEntries();
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
    const confLabel = log.confidence === 'perfect' ? '完璧' : (log.confidence === 'good' ? 'できた' : (log.confidence === 'unsure' ? 'あやしい' : (log.confidence === 'bad' ? 'ダメ' : '')));
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
