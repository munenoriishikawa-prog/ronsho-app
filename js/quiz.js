// --- 問題演習モード ---
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getStudyCountFor(e) {
  const log = studyLog[e.title];
  return (log && log.history) ? log.history.length : 0;
}
function isOverdueEntry(e) {
  if (studyLog[e.title] && studyLog[e.title].memorized) return false;
  const info = getNextReviewInfo(e.title);
  if (!info) return false;
  return info.nextDateStr <= todayStr();
}
function isStudiedToday(e) {
  const log = studyLog[e.title];
  const history = log && log.history;
  if (!history || history.length === 0) return false;
  return history[history.length - 1] === todayStr();
}
function isWeakEntry(e) {
  return !!(studyLog[e.title] && studyLog[e.title].starred);
}
function isSkippedEntry(e) {
  return !!(studyLog[e.title] && studyLog[e.title].skipped);
}
const QUIZ_CONFIDENCE_LABELS = { perfect: '◎ 完璧', good: '○ できた', unsure: '△ あやしい', bad: '✕ ダメ' };
function daysAgoLabel(dateStr) {
  const diff = Math.round((new Date(todayStr() + 'T00:00:00') - new Date(dateStr + 'T00:00:00')) / 86400000);
  if (diff === 0) return '本日';
  if (diff === 1) return '昨日';
  if (diff > 0) return diff + '日前';
  return dateStr;
}
function buildQuizLastStudyHtml(e) {
  const log = studyLog[e.title];
  const history = log && log.history;
  if (!history || history.length === 0) {
    return '<div class="quizLastStudy quizLastStudyNew">🆕 まだ学習していません</div>';
  }
  const lastDate = history[history.length - 1];
  const confLabel = QUIZ_CONFIDENCE_LABELS[log.confidence] || '';
  return '<div class="quizLastStudy">🕒 前回学習：' + escapeHtml(lastDate) + '（' + daysAgoLabel(lastDate) + '）'
    + (confLabel ? ' ／ 前回の暗記度：<strong>' + confLabel + '</strong>' : '')
    + ' ／ 通算' + history.length + '回</div>';
}
function buildQuizPool() {
  let pool = filterEntries(entries, '');
  if (quizExcludeTodayChk.checked) {
    pool = pool.filter(e => !isStudiedToday(e));
  }
  if (quizWeakOnlyChk.checked) {
    pool = pool.filter(isWeakEntry);
  }
  if (quizSkippedOnlyChk.checked) {
    pool = pool.filter(isSkippedEntry);
  } else {
    pool = pool.filter(e => !isSkippedEntry(e));
  }
  quizSequentialMode = !quizRandomChk.checked;
  quizOverdueMode = quizOverdueOnlyChk.checked;
  if (quizOverdueMode) {
    pool = pool.filter(isOverdueEntry);
    quizMinCount = 0;
    return quizSequentialMode ? pool : shuffleArray(pool);
  }
  if (!quizIncludeMemorizedChk.checked) {
    pool = pool.filter(e => !(studyLog[e.title] && studyLog[e.title].memorized));
  }
  if (pool.length === 0) {
    quizMinCount = 0;
    return [];
  }
  if (quizSequentialMode) {
    quizMinCount = 0;
    return pool;
  }
  const minCount = Math.min(...pool.map(getStudyCountFor));
  quizMinCount = minCount;
  pool = pool.filter(e => getStudyCountFor(e) === minCount);
  return shuffleArray(pool);
}
function startQuiz() {
  quizPool = buildQuizPool();
  quizIndex = 0;
  quizRevealed = false;
  quizStarted = true;
  quizComboCount = 0;
  renderQuizPage();
}
function renderQuizPage() {
  if (entries.length === 0) {
    quizPriorityNote.textContent = '';
    quizArea.innerHTML = '<div class="quizEmpty">まずはWordファイルを読み込んでください。</div>';
    return;
  }
  if (!quizStarted) {
    quizPriorityNote.textContent = '';
    quizArea.innerHTML = '<div class="quizEmpty">「スタート／やり直す」を押すと出題が始まります。</div>';
    return;
  }
  const extraNotes = [];
  if (quizExcludeTodayChk.checked) extraNotes.push('本日学習済みは除外');
  if (quizWeakOnlyChk.checked) extraNotes.push('😰苦手のみ');
  if (quizSkippedOnlyChk.checked) extraNotes.push('⏭️スキップのみ');
  const extraNote = extraNotes.length ? '（' + extraNotes.join('・') + '）' : '';
  if (quizPool.length === 0) {
    quizPriorityNote.textContent = '';
    quizArea.innerHTML = quizOverdueMode
      ? '<div class="quizEmpty">🎉 復習期限が来ている論証はありません' + extraNote + '。</div>'
      : (quizSkippedOnlyChk.checked
        ? '<div class="quizEmpty">⏭️ スキップした論証はありません。</div>'
        : '<div class="quizEmpty">出題対象の論証がありません' + extraNote + '。範囲や「暗記済みも含める」設定を見直してください。</div>');
    return;
  }
  quizPriorityNote.innerHTML = quizOverdueMode
    ? '⏰ 復習推奨日を過ぎている論点 <strong>' + quizPool.length + '件</strong>' + extraNote + ' のみを出題しています。'
    : (quizSequentialMode
      ? '📖 論証の順番通り <strong>' + quizPool.length + '件</strong>' + extraNote + ' を出題しています。'
      : '📌 学習回数が最も少ない（<strong>' + quizMinCount + '回</strong>）論点 <strong>' + quizPool.length + '件</strong>' + extraNote + ' のみを出題しています。この回数のものを一通り学習すると、次回はより多く学習した論点が対象から外れ、新しい最少回数のグループが出題されます。');
  if (quizIndex >= quizPool.length) {
    quizArea.innerHTML = '<div class="quizCard"><div class="quizFinished">🎉 全' + quizPool.length + '問終了しました！お疲れさまでした。もう一度「スタート／やり直す」を押すと出題を最初からやり直せます。</div></div>';
    return;
  }
  const e = quizPool[quizIndex];
  const idx = entries.findIndex(x => x.title === e.title);
  const isEditingThis = idx !== -1 && editingEntryTitle === e.title;
  const isSkipped = !!(studyLog[e.title] && studyLog[e.title].skipped);
  const quizMemo = (studyLog[e.title] && studyLog[e.title].memo) || '';
  let html = '<div class="quizCard">';
  html += '<div class="quizCardTools">'
    + '<span class="quizMemoBtn' + (quizMemo ? ' active' : '') + '" id="quizMemoBtn" title="' + escapeHtml(quizMemo ? ('メモ：' + quizMemo) : 'メモを追加') + '">🗒️</span>'
    + '<span class="quizSkipBtn' + (isSkipped ? ' active' : '') + '" id="quizSkipBtn" title="スキップ（問題演習から除外）">⏭️</span>'
    + '<span class="quizEditBtn' + (isEditingThis ? ' active' : '') + '" id="quizEditBtn" title="内容を編集">✏️</span>'
    + '</div>';
  html += '<div class="quizProgress">' + (quizIndex + 1) + ' / ' + quizPool.length + '問</div>';
  if (quizComboCount >= 2) {
    html += '<div class="quizCombo">🔥 ' + quizComboCount + '連続できた！</div>';
  }
  html += '<div class="quizNavRow">'
    + '<button type="button" class="quizNavBtn" id="quizPrevBtn"' + (quizIndex === 0 ? ' disabled' : '') + '>◀ 前の問題</button>'
    + '<button type="button" class="quizNavBtn" id="quizNextBtn"' + (quizIndex >= quizPool.length - 1 ? ' disabled' : '') + '>次の問題 ▶</button>'
    + '</div>';
  html += '<div class="quizMeta">' + escapeHtml(e.subject || '') + ' ｜ ' + escapeHtml(e.category || '') + '</div>';
  html += buildQuizLastStudyHtml(e);
  if (isEditingThis) {
    html += '<input type="text" class="editTitleInput" data-idx="' + idx + '" value="' + escapeHtml(e.title) + '">';
    html += buildBodyEditorHtml(e, idx);
  } else {
  html += '<div class="quizTitle">' + buildImportanceStarsHtml(e.importance) + escapeHtml(e.title) + '</div>';
  if (!quizRevealed) {
    html += '<div class="quizShowBtn" id="quizShowBtn">📖 本文を表示</div>';
  } else {
    html += '<div class="quizBody">' + e.bodyHtml + '</div>';
    html += buildEntryTagsBlockHtml(e);
    html += '<div class="quizYear">出題年：' + (buildYearHtml(e.year) || 'なし') + '</div>';
    html += '<div class="quizSource" id="quizSourceRow">出典：' + (e.source ? escapeHtml(e.source) : 'なし')
      + ' <span class="quizSourceEditBtn" id="quizSourceEditBtn" title="出典を編集">✏️</span></div>';
    const isWeak = !!(studyLog[e.title] && studyLog[e.title].starred);
    html += '<div class="quizJudgeRow">'
      + '<button type="button" class="quizPerfectBtn" id="quizPerfectBtn"><span class="quizJudgeIcon">◎</span>完璧</button>'
      + '<button type="button" class="quizGoodBtn" id="quizGoodBtn"><span class="quizJudgeIcon">○</span>できた</button>'
      + '<button type="button" class="quizUnsureBtn" id="quizUnsureBtn"><span class="quizJudgeIcon">△</span>あやしい</button>'
      + '<button type="button" class="quizBadBtn" id="quizBadBtn"><span class="quizJudgeIcon">✕</span>ダメ</button>'
      + '<button type="button" class="quizWeakBtn' + (isWeak ? ' active' : '') + '" id="quizWeakBtn"><span class="quizJudgeIcon">😰</span>苦手</button>'
      + '</div>';
  }
  }
  html += '</div>';
  quizArea.innerHTML = html;
  const showBtn = document.getElementById('quizShowBtn');
  if (showBtn) {
    showBtn.addEventListener('click', () => {
      quizRevealed = true;
      renderQuizPage();
    });
  }
  const prevBtn = document.getElementById('quizPrevBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (quizIndex <= 0) return;
    quizIndex--;
    quizRevealed = false;
    renderQuizPage();
  });
  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (quizIndex >= quizPool.length - 1) return;
    quizIndex++;
    quizRevealed = false;
    renderQuizPage();
  });
  function advanceQuiz(level, sourceEl) {
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) setConfidence(idx, level, sourceEl);
    quizComboCount = (level === 'good' || level === 'perfect') ? quizComboCount + 1 : 0;
    quizIndex++;
    quizRevealed = false;
    renderQuizPage();
  }
  const perfectBtn = document.getElementById('quizPerfectBtn');
  if (perfectBtn) perfectBtn.addEventListener('click', () => advanceQuiz('perfect', perfectBtn));
  const goodBtn = document.getElementById('quizGoodBtn');
  if (goodBtn) goodBtn.addEventListener('click', () => advanceQuiz('good', goodBtn));
  const unsureBtn = document.getElementById('quizUnsureBtn');
  if (unsureBtn) unsureBtn.addEventListener('click', () => advanceQuiz('unsure', unsureBtn));
  const badBtn = document.getElementById('quizBadBtn');
  if (badBtn) badBtn.addEventListener('click', () => advanceQuiz('bad', badBtn));
  const weakBtn = document.getElementById('quizWeakBtn');
  if (weakBtn) weakBtn.addEventListener('click', () => {
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) toggleStar(idx);
    renderQuizPage();
  });
  const memoBtn = document.getElementById('quizMemoBtn');
  if (memoBtn) memoBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) editMemo(idx);
    renderQuizPage();
  });
  const skipBtn = document.getElementById('quizSkipBtn');
  if (skipBtn) skipBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const wasSkipped = !!(studyLog[e.title] && studyLog[e.title].skipped);
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) toggleSkip(idx);
    if (!wasSkipped) {
      quizIndex++;
      quizRevealed = false;
    }
    renderQuizPage();
  });
  const sourceEditBtn = document.getElementById('quizSourceEditBtn');
  if (sourceEditBtn) sourceEditBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx !== -1) editSource(idx);
    renderQuizPage();
  });
  const quizEditBtn = document.getElementById('quizEditBtn');
  if (quizEditBtn) quizEditBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const idx = entries.findIndex(x => x.title === e.title);
    if (idx === -1) return;
    editingEntryTitle = editingEntryTitle === e.title ? null : e.title;
    renderQuizPage();
  });
  if (isEditingThis) {
    quizArea.addEventListener('mousedown', (evt) => {
      if (evt.target.closest('.editColorSwatch') || evt.target.closest('.editColorClearBtn') || evt.target.closest('.editBoldBtn')) {
        evt.preventDefault();
      }
    });
    quizArea.addEventListener('keydown', (evt) => {
      if (evt.target.closest('.editBodyArea')) handleBodyEditorKeydown(evt);
    });
    const boldBtn = quizArea.querySelector('.editBoldBtn');
    if (boldBtn) boldBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      applyBodyEditorBold();
    });
    const colorSwatches = quizArea.querySelectorAll('.editColorSwatch');
    colorSwatches.forEach(sw => sw.addEventListener('click', (evt) => {
      evt.stopPropagation();
      applyBodyEditorColor(sw.dataset.color);
    }));
    const colorClearBtn = quizArea.querySelector('.editColorClearBtn');
    if (colorClearBtn) colorClearBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      document.execCommand('removeFormat');
    });
    const editSaveBtn = quizArea.querySelector('.editSaveBtn');
    if (editSaveBtn) editSaveBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      saveEntryEdit(Number(editSaveBtn.dataset.idx));
    });
    const editCancelBtn = quizArea.querySelector('.editCancelBtn');
    if (editCancelBtn) editCancelBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      editingEntryTitle = null;
      renderQuizPage();
    });
  }
}

