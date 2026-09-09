/* ▼▼▼ 新規追加：判例一覧機能（既存の変数・関数名と一切重複しない名前空間で実装）
   既存の entries / studyLog / manualLog などには一切触れていません。
   保存先も専用のキー 'ronshoPrecedentsV1' のみを使用します。 */
const PRECEDENT_KEY = 'ronshoPrecedentsV1';
let precedents = [];
function loadPrecedents() {
  try {
    const raw = localStorage.getItem(PRECEDENT_KEY);
    precedents = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('判例の読み込みに失敗しました:', e);
    precedents = [];
  }
}
function savePrecedents() {
  try {
    localStorage.setItem(PRECEDENT_KEY, JSON.stringify(precedents));
    if (typeof window !== 'undefined' && typeof window.ronshoSyncNotifyChange === 'function') window.ronshoSyncNotifyChange();
  } catch (e) {
    console.error('判例の保存に失敗しました:', e);
  }
}
loadPrecedents();

// 判例名が未入力の場合は判決日を見出しとして使うため、表示用のタイトルを
// 一箇所にまとめて算出する（一覧・カードの両方から使う）
function precedentDisplayTitle(p) {
  const name = (p.name || '').trim();
  if (name) return name;
  const date = (p.date || '').trim();
  return date || '(タイトル未入力)';
}

let precedentIndex = 0;
let precedentRevealed = false;
let precedentSubjectFilter = 'all';
let precedentEditingId = null;

function precedentFilteredList() {
  let list = precedents.slice();
  if (precedentSubjectFilter !== 'all') {
    list = list.filter(p => (p.subject || '未設定') === precedentSubjectFilter);
  }
  return list;
}

function renderPrecedentSubjectFilter() {
  const sel = document.getElementById('precedentSubjectFilter');
  if (!sel) return;
  const subjects = [...new Set(precedents.map(p => (p.subject || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
  const prev = precedentSubjectFilter;
  sel.innerHTML = '<option value="all">科目：すべて（' + precedents.length + '件）</option>'
    + subjects.map(s => {
      const count = precedents.filter(p => (p.subject || '').trim() === s).length;
      return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '（' + count + '件）</option>';
    }).join('');
  sel.value = subjects.includes(prev) || prev === 'all' ? prev : 'all';
  precedentSubjectFilter = sel.value;
}

/* ▼▼▼ 新規追加：AIの要約を貼り付けて自動入力
   ChatGPTやGoogleのAI概要などで作った「判例名（判決日）」の見出し行＋
   「事案」「判旨」「規範」などの箇条書き形式のテキストを解析し、判例名・
   判決日・事案の概要・判旨の各欄に振り分けるだけの補助機能。専用のデータは
   持たず、既存の入力欄に値を流し込むだけなので、保存前に必ず内容を確認・
   修正できる（自動保存はしない） */
const PRECEDENT_PASTE_SUMMARY_LABELS = ['事案の概要', '事案'];
const PRECEDENT_PASTE_HOLDING_LABELS = ['判旨', '判決要旨', '要旨'];
const PRECEDENT_PASTE_NORM_LABELS = ['規範', '法理'];
const PRECEDENT_PASTE_CONCLUSION_LABELS = ['結論'];
const PRECEDENT_PASTE_FEATURE_LABELS = ['特徴', '百選的理由', 'ポイント'];
// コピー元サイトの脚注・引用元表記（例："wikipedia+1"）が文末にそのまま
// くっついてくることがあるため、その部分だけ取り除く
function stripPrecedentCitationArtifacts(line) {
  return line.replace(/[A-Za-z][A-Za-z0-9]{1,}\+\d+\s*$/, '').trim();
}
function precedentPasteLabelToField(label) {
  if (PRECEDENT_PASTE_SUMMARY_LABELS.some(k => label.includes(k))) return { field: 'summary', prefix: '' };
  if (PRECEDENT_PASTE_HOLDING_LABELS.some(k => label.includes(k))) return { field: 'holding', prefix: '' };
  if (PRECEDENT_PASTE_NORM_LABELS.some(k => label.includes(k))) return { field: 'holding', prefix: '【規範】' };
  if (PRECEDENT_PASTE_CONCLUSION_LABELS.some(k => label.includes(k))) return { field: 'conclusion', prefix: '' };
  if (PRECEDENT_PASTE_FEATURE_LABELS.some(k => label.includes(k))) return { field: 'feature', prefix: '' };
  return null;
}
function parsePrecedentPasteText(text) {
  const rawLines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (rawLines.length === 0) return null;
  let name = '', date = '';
  // 1行目は「判例名（判決日）」の見出しを想定し、括弧内を判決日として分離する
  const titleMatch = rawLines[0].match(/^(.*?)[（(]\s*(.+?)\s*[）)]\s*$/);
  if (titleMatch) {
    name = titleMatch[1].trim();
    date = titleMatch[2].trim();
  } else {
    name = rawLines[0];
  }
  const fields = { summary: [], holding: [], conclusion: [], feature: [] };
  let currentField = null;
  for (let i = 1; i < rawLines.length; i++) {
    const line = stripPrecedentCitationArtifacts(rawLines[i]);
    if (!line) continue;
    // 箇条書き記号（*・-など）が付いている行はそれを取り除いてからラベルを
    // 探すが、コピー元によっては記号が付かずに貼り付けられることもあるため、
    // 記号の有無にかかわらず「ラベル：内容」の形になっていれば認識する
    const bulletMatch = line.match(/^[*・･\-•▪]\s*(.+)$/);
    const bulletBody = bulletMatch ? bulletMatch[1] : line;
    const labelMatch = bulletBody.match(/^([^\s:：]{1,12})\s*[:：]\s*([\s\S]*)$/);
    if (labelMatch) {
      const mapped = precedentPasteLabelToField(labelMatch[1]);
      if (mapped) {
        currentField = mapped.field;
        const content = (mapped.prefix ? mapped.prefix + ' ' : '') + labelMatch[2].trim();
        if (content) fields[currentField].push(content);
        continue;
      }
    }
    // ラベルの無い続きの行は、直前のフィールドの続きとして扱う
    if (currentField) fields[currentField].push(line);
  }
  return {
    name,
    date,
    summary: fields.summary.join('\n'),
    holding: fields.holding.join('\n'),
    conclusion: fields.conclusion.join('\n'),
    feature: fields.feature.join('\n')
  };
}
function initPrecedentPasteFeature() {
  const parseBtn = document.getElementById('precedentPasteParseBtn');
  const pasteInput = document.getElementById('precedentPasteInput');
  if (!parseBtn || !pasteInput) return;
  parseBtn.addEventListener('click', () => {
    const parsed = parsePrecedentPasteText(pasteInput.value);
    if (!parsed) {
      alert('貼り付けたテキストから判例名・判決日などを読み取れませんでした。「判例名（判決日）」の見出し行があるか確認してください。');
      return;
    }
    document.getElementById('precedentNameInput').value = parsed.name;
    document.getElementById('precedentDateInput').value = parsed.date;
    if (parsed.summary) document.getElementById('precedentSummaryInput').value = parsed.summary;
    if (parsed.holding) document.getElementById('precedentHoldingInput').value = parsed.holding;
    if (parsed.conclusion) document.getElementById('precedentConclusionInput').value = parsed.conclusion;
    if (parsed.feature) document.getElementById('precedentFeatureInput').value = parsed.feature;
    status.textContent = '📋 貼り付けた内容から自動入力しました。内容を確認してから保存してください。';
  });
}
/* ▲▲▲ 新規追加：AIの要約を貼り付けて自動入力 ここまで ▲▲▲ */

function resetPrecedentForm() {
  precedentEditingId = null;
  document.getElementById('precedentNameInput').value = '';
  document.getElementById('precedentDateInput').value = '';
  document.getElementById('precedentSubjectInput').value = '';
  document.getElementById('precedentSummaryInput').value = '';
  document.getElementById('precedentHoldingInput').value = '';
  document.getElementById('precedentConclusionInput').value = '';
  document.getElementById('precedentFeatureInput').value = '';
  const pasteInputEl = document.getElementById('precedentPasteInput');
  if (pasteInputEl) pasteInputEl.value = '';
  document.getElementById('precedentSaveBtn').textContent = '保存する';
  document.getElementById('precedentCancelEditBtn').style.display = 'none';
}

function openPrecedentFormForEdit(p) {
  const form = document.getElementById('precedentForm');
  const addToggleBtn = document.getElementById('precedentAddToggleBtn');
  const pasteBlock = document.getElementById('precedentPasteBlock');
  if (form && !form.classList.contains('pastLogFormOpen')) {
    if (pasteBlock) pasteBlock.classList.add('pastLogFormOpen');
    form.classList.add('pastLogFormOpen');
    document.getElementById('precedentFormBody').classList.add('pastLogFormOpen');
    document.getElementById('precedentFormActions').classList.add('pastLogFormOpen');
    if (addToggleBtn) addToggleBtn.textContent = '－ 閉じる';
  }
  precedentEditingId = p.id;
  document.getElementById('precedentNameInput').value = p.name || '';
  document.getElementById('precedentDateInput').value = p.date || '';
  document.getElementById('precedentSubjectInput').value = p.subject || '';
  document.getElementById('precedentSummaryInput').value = p.summary || '';
  document.getElementById('precedentHoldingInput').value = p.holding || '';
  document.getElementById('precedentConclusionInput').value = p.conclusion || '';
  document.getElementById('precedentFeatureInput').value = p.feature || '';
  document.getElementById('precedentSaveBtn').textContent = '更新する';
  document.getElementById('precedentCancelEditBtn').style.display = 'inline-block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPrecedentPage() {
  renderPrecedentSubjectFilter();
  const progressEl = document.getElementById('precedentProgress');
  const area = document.getElementById('precedentArea');
  if (!area) return;
  const list = precedentFilteredList();
  if (precedentIndex >= list.length) precedentIndex = Math.max(0, list.length - 1);

  if (precedents.length === 0) {
    if (progressEl) progressEl.textContent = '';
    area.innerHTML = '<div class="quizEmpty">まだ判例が登録されていません。「＋ 判例を追加」から登録してください。</div>';
    return;
  }
  if (list.length === 0) {
    if (progressEl) progressEl.textContent = '';
    area.innerHTML = '<div class="quizEmpty">この科目に該当する判例はありません。</div>';
    return;
  }
  if (progressEl) progressEl.textContent = (precedentIndex + 1) + ' / ' + list.length + '件';

  const p = list[precedentIndex];
  let html = '<div class="quizCard">';
  html += '<div class="quizCardTools">'
    + '<span class="quizEditBtn" id="precedentEditBtn" title="内容を編集">✏️</span>'
    + '<span class="quizDeleteBtn" id="precedentDeleteBtn" title="この判例を削除">🗑️</span>'
    + '</div>';
  html += '<div class="quizNavRow">'
    + '<button type="button" class="quizNavBtn" id="precedentPrevBtn"' + (precedentIndex === 0 ? ' disabled' : '') + '>◀ 前の判例</button>'
    + '<button type="button" class="quizNavBtn" id="precedentNextBtn"' + (precedentIndex >= list.length - 1 ? ' disabled' : '') + '>次の判例 ▶</button>'
    + '</div>';
  html += '<div class="quizMeta">' + escapeHtml(p.subject || '未設定') + (p.date && p.name ? ' ｜ ' + escapeHtml(p.date) : '') + '</div>';
  html += '<div class="quizTitle">' + escapeHtml(precedentDisplayTitle(p)) + '</div>';
  if (!precedentRevealed) {
    html += '<div class="quizShowBtn" id="precedentShowBtn">📖 内容を表示</div>';
  } else {
    html += '<div class="quizBody"><strong>【事案の概要】</strong><br>' + (escapeHtml(p.summary || '（未入力）').replace(/\n/g, '<br>')) + '</div>';
    html += '<div class="quizBody"><strong>【判旨】</strong><br>' + (escapeHtml(p.holding || '（未入力）').replace(/\n/g, '<br>')) + '</div>';
    // 結論・特徴（百選的理由）は任意項目のため、入力済みのときだけ表示する
    // （既存の判例には無い項目なので、常に表示すると「（未入力）」だらけになってしまう）
    if (p.conclusion) html += '<div class="quizBody"><strong>【結論】</strong><br>' + escapeHtml(p.conclusion).replace(/\n/g, '<br>') + '</div>';
    if (p.feature) html += '<div class="quizBody"><strong>【特徴・百選的理由】</strong><br>' + escapeHtml(p.feature).replace(/\n/g, '<br>') + '</div>';
  }
  html += '</div>';
  area.innerHTML = html;

  const showBtn = document.getElementById('precedentShowBtn');
  if (showBtn) showBtn.addEventListener('click', () => { precedentRevealed = true; renderPrecedentPage(); });
  const prevBtn = document.getElementById('precedentPrevBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (precedentIndex <= 0) return;
    precedentIndex--;
    precedentRevealed = false;
    renderPrecedentPage();
  });
  const nextBtn = document.getElementById('precedentNextBtn');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (precedentIndex >= list.length - 1) return;
    precedentIndex++;
    precedentRevealed = false;
    renderPrecedentPage();
  });
  const editBtn = document.getElementById('precedentEditBtn');
  if (editBtn) editBtn.addEventListener('click', () => openPrecedentFormForEdit(p));
  const deleteBtn = document.getElementById('precedentDeleteBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    if (!confirm('「' + precedentDisplayTitle(p) + '」を削除しますか？（元に戻せません）')) return;
    precedents = precedents.filter(x => x.id !== p.id);
    savePrecedents();
    precedentRevealed = false;
    renderPrecedentPage();
    status.textContent = '🗑️ 「' + precedentDisplayTitle(p) + '」を削除しました。';
  });
}

function initPrecedentFeature() {
  const addToggleBtn = document.getElementById('precedentAddToggleBtn');
  const form = document.getElementById('precedentForm');
  const formBody = document.getElementById('precedentFormBody');
  const formActions = document.getElementById('precedentFormActions');
  const pasteBlock = document.getElementById('precedentPasteBlock');
  const saveBtn = document.getElementById('precedentSaveBtn');
  const cancelEditBtn = document.getElementById('precedentCancelEditBtn');
  const subjectFilterSel = document.getElementById('precedentSubjectFilter');
  if (!addToggleBtn || !form || !saveBtn) return;

  addToggleBtn.addEventListener('click', () => {
    const open = form.classList.toggle('pastLogFormOpen');
    if (pasteBlock) pasteBlock.classList.toggle('pastLogFormOpen', open);
    formBody.classList.toggle('pastLogFormOpen', open);
    formActions.classList.toggle('pastLogFormOpen', open);
    addToggleBtn.textContent = open ? '－ 閉じる' : '＋ 判例を追加';
    if (!open) resetPrecedentForm();
  });

  saveBtn.addEventListener('click', () => {
    const name = document.getElementById('precedentNameInput').value.trim();
    const date = document.getElementById('precedentDateInput').value.trim();
    const subject = document.getElementById('precedentSubjectInput').value.trim();
    const summary = document.getElementById('precedentSummaryInput').value.trim();
    const holding = document.getElementById('precedentHoldingInput').value.trim();
    const conclusion = document.getElementById('precedentConclusionInput').value.trim();
    const feature = document.getElementById('precedentFeatureInput').value.trim();
    if (!date && !name) {
      alert('判例名か判決日のどちらかは入力してください。');
      return;
    }
    if (precedentEditingId) {
      const idx = precedents.findIndex(p => p.id === precedentEditingId);
      if (idx !== -1) {
        precedents[idx] = { ...precedents[idx], name, date, subject, summary, holding, conclusion, feature };
      }
      status.textContent = '✏️ 判例を更新しました。';
    } else {
      precedents.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        name, date, subject, summary, holding, conclusion, feature,
        createdAt: new Date().toISOString()
      });
      status.textContent = '⚖️ 判例を追加しました。';
    }
    savePrecedents();
    resetPrecedentForm();
    form.classList.remove('pastLogFormOpen');
    if (pasteBlock) pasteBlock.classList.remove('pastLogFormOpen');
    formBody.classList.remove('pastLogFormOpen');
    formActions.classList.remove('pastLogFormOpen');
    addToggleBtn.textContent = '＋ 判例を追加';
    precedentRevealed = false;
    renderPrecedentPage();
  });

  cancelEditBtn.addEventListener('click', () => {
    resetPrecedentForm();
  });

  if (subjectFilterSel) subjectFilterSel.addEventListener('change', () => {
    precedentSubjectFilter = subjectFilterSel.value;
    precedentIndex = 0;
    precedentRevealed = false;
    renderPrecedentPage();
  });

  renderPrecedentPage();
}
initPrecedentFeature();
initPrecedentPasteFeature();
/* ▲▲▲ 新規追加：判例一覧機能 ここまで ▲▲▲ */
