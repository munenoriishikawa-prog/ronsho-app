/* ▼▼▼ 新規追加：画面を歩き回るドット絵のペット（純粋な癒し要素。学習データには一切触れない） ▼▼▼ */
(function () {
  // 16列×12行の高解像度ドット絵（旧8列×6行の倍の密度）。BASE_UNITを
  // その分小さくしているので、画面上の実寸は旧デザインとほぼ同じまま、
  // 輪郭が滑らかに・目や模様も描き込めるようになっている
  const SPECIES = [
    { label: 'スライム', grid: [
        [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
      ], colors: { 1: '#7dd3fc', 2: '#0c2340', 4: '#bfe9fd' } },
    { label: 'ひよこ', grid: [
        [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
      ], colors: { 1: '#ffd93d', 2: '#3a2e00', 3: '#ff8c00', 4: '#fff3b0' } },
    { label: 'ねこ', grid: [
        [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
        [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
      ], colors: { 1: '#f4e3c1', 2: '#2e7d32', 3: '#e08ea0' } },
    { label: 'おばけ', grid: [
        [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
        [1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1],
        [0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0]
      ], colors: { 1: '#b39ddb', 2: '#1a1a2e' } }
  ];
  const SPECIES_LABELS = SPECIES.map(s => s.label);
  // ペットがたまに話す豆知識・学習のコツ（間違った条文解釈と誤解されないよう、
  // あくまで軽い雑学・励ましのトーンに留めている）
  const PET_LINES = [
    '豆知識：「善意」は知らないこと、「悪意」は知っていることを意味するよ（日常語とは逆！）',
    '「即時」と「遅滞なく」、実は求められる速さの目安が違うんだって',
    '六法全書の「六法」は憲法・民法・商法・刑法・民訴法・刑訴法が由来なんだよ',
    '「善管注意義務」の「善管」は「善良な管理者」の略なんだ',
    '未成年者の契約は原則取り消せるけど、婚姻による成年擬制だと話が変わるよ',
    '「錯誤」は勘違い、「詐欺」はだまされること。似てるけど効果は違うんだ',
    '「善意無過失」って言葉、法律の世界だとよく出てくるコンビなんだよ',
    '「対抗要件」は「これがないと第三者に主張できないよ」という意味なんだって',
    '憲法改正には国民投票が必要って知ってた？',
    '商法と会社法、実は昔はひとつの法律だったんだよ',
    '「時効」には取得時効と消滅時効の2種類があるよ',
    '「代理」と「使者」、似てるようで法律上の意味は全然違うんだって',
    '「瑕疵」は「かし」って読むよ。傷や欠陥という意味なんだ',
    '刑事訴訟の「推定無罪」、疑わしきは被告人の利益に、なんだって',
    '「善意」でも重過失があると保護されないことがあるんだよ',
    '論証は書いて覚えるより「人に説明できるか」で確認するといいよ',
    '苦手な論証ほど、寝る前に一回読むと定着しやすいんだって',
    'たまには休憩も大事だよ。無理しすぎないでね',
    '過去問を解くときは、まず自分の言葉で結論だけ言ってみるのがおすすめ',
    '論証は丸暗記より「なぜそうなるか」の流れを掴むと忘れにくいよ',
    '今日も少しずつでいいから、続けることが一番の近道だよ',
    '一度に完璧を目指すより、何度も繰り返す方が記憶に残るんだって',
    '「催告」は相手に行動を促すこと。放っておくと不利になることもあるよ',
    '判例を読むときは、まず結論とその理由づけを分けて整理すると分かりやすいよ'
  ];
  // gridを16列×12行に高解像度化した分、1マスのサイズは半分にして
  // 画面上の実寸（見え方の大きさ）は旧デザインとほぼ揃えている
  const BASE_UNIT = 2.5;
  // レベルが上がるにつれてペットは大きくなるだけでなく、見た目のドット絵
  // そのものも段階的に変化する（頬の赤み→冠の飾り→キラキラ）。
  // 学習データそのものには一切影響しない、見た目だけの演出
  const PET_GROWTH_STAGES = [
    { minLevel: 1, scale: 1 },
    { minLevel: 5, scale: 1.2 },
    { minLevel: 10, scale: 1.45 },
    { minLevel: 20, scale: 1.75 }
  ];
  // 全種族共通で使う成長演出の色（各種族のgrid内では1〜3番台の色番号しか
  // 使っていないため、7〜9番台を使えば衝突しない）
  const GROWTH_BLUSH_COLOR = '#ff9eb5';
  const GROWTH_CROWN_COLOR = '#ffd700';
  const GROWTH_SPARKLE_COLOR = '#00e5ff';
  // ステージごとに、種族本来のgridへ演出用のピクセルを重ねて返す。
  // 元のSPECIES側のgrid/colorsは書き換えない（毎回コピーしてから加工する）
  function buildGrowthGrid(baseGrid, baseColors, stageIdx) {
    let grid = baseGrid.map(row => row.slice());
    const colors = Object.assign({}, baseColors);
    const cols = grid[0].length;
    if (stageIdx >= 1) {
      colors[9] = GROWTH_BLUSH_COLOR;
      const cheekRow = grid[grid.length - 2];
      // 列数に関わらず輪郭の内側に収まるよう、幅に対する割合で頬の位置を決める
      const cheekL = Math.max(1, Math.round(cols * 0.2));
      const cheekR = cols - 1 - cheekL;
      if (cheekRow) {
        cheekRow[cheekL] = 9;
        cheekRow[cheekR] = 9;
      }
    }
    if (stageIdx >= 2) {
      colors[8] = GROWTH_CROWN_COLOR;
      const crownRow = new Array(cols).fill(0);
      // 左右対称になるよう、中央の2マスと左右それぞれ1マスの計4マスを
      // 王冠の突起として置く（列数が偶数の場合、中央は1マスに揃えられない）
      const mid = cols / 2;
      const spike = Math.max(1, Math.round(cols * 0.15));
      crownRow[spike] = 8;
      crownRow[cols - 1 - spike] = 8;
      crownRow[Math.floor(mid) - 1] = 8;
      crownRow[Math.floor(mid)] = 8;
      grid = [crownRow].concat(grid);
    }
    if (stageIdx >= 3) {
      colors[7] = GROWTH_SPARKLE_COLOR;
      grid[0][0] = 7;
      grid[0][grid[0].length - 1] = 7;
    }
    return { grid, colors };
  }
  function currentLevel() {
    if (typeof getLevelInfo !== 'function' || typeof loadXp !== 'function') return 1;
    try { return getLevelInfo(loadXp()).level; } catch (e) { return 1; }
  }
  function growthStageForLevel(level) {
    let stage = PET_GROWTH_STAGES[0];
    PET_GROWTH_STAGES.forEach(s => { if (level >= s.minLevel) stage = s; });
    return stage;
  }
  let currentUnit = BASE_UNIT;
  let currentStageIdx = 0;
  let lastGrowthStageIndex = -1;
  const MIN_STOP_MS = 1200;
  const MAX_STOP_MS = 4000;
  const SPEED_PX_PER_SEC = 45;
  const PET_SPECIES_KEY = 'ronshoPetSpeciesV1';
  const PET_ENABLED_KEY = 'ronshoPetEnabledV1';
  const PET_BUBBLE_DURATION_KEY = 'ronshoPetBubbleDurationV1';
  const BUBBLE_DURATION_DEFAULT_MS = 8000;
  const BUBBLE_DURATION_OPTIONS_MS = [4000, 8000, 12000, 16000, 20000];
  const PET_BUBBLE_ENABLED_KEY = 'ronshoPetBubbleEnabledV1';
  const BOTTOM_MARGIN_PX = 6;

  function loadSpeciesIndex() {
    // Number(null)は0になってしまう(NaNにならない)ため、未保存(null)を
    // 明示的に区別しないと、保存し忘れたまま常に0番目に固定されてしまう
    const raw = localStorage.getItem(PET_SPECIES_KEY);
    let idx = raw === null ? NaN : Number(raw);
    if (!Number.isInteger(idx) || idx < 0 || idx >= SPECIES.length) {
      idx = Math.floor(Math.random() * SPECIES.length);
      localStorage.setItem(PET_SPECIES_KEY, String(idx));
    }
    return idx;
  }
  function loadEnabled() {
    return localStorage.getItem(PET_ENABLED_KEY) !== '0'; // 未設定時はデフォルトで表示する
  }
  function loadBubbleDurationMs() {
    const raw = Number(localStorage.getItem(PET_BUBBLE_DURATION_KEY));
    return BUBBLE_DURATION_OPTIONS_MS.includes(raw) ? raw : BUBBLE_DURATION_DEFAULT_MS;
  }
  function saveBubbleDurationMs(ms) {
    localStorage.setItem(PET_BUBBLE_DURATION_KEY, String(ms));
  }
  function loadBubbleEnabled() {
    return localStorage.getItem(PET_BUBBLE_ENABLED_KEY) !== '0'; // 未設定時はデフォルトで表示する
  }
  function saveBubbleEnabled(enabled) {
    localStorage.setItem(PET_BUBBLE_ENABLED_KEY, enabled ? '1' : '0');
  }

  let speciesIndex = loadSpeciesIndex();
  let outer = null, inner = null, x = 0, y = 0, pendingTimer = null;
  let bubble = null, bubbleHideTimer = null, bubbleFollowRaf = null;

  // ペットの移動中も吹き出しの位置が追従するよう、表示中は毎フレーム座標を更新する
  // 吹き出しの位置は「ペットの真上中央」を基準にしつつ、画面端では
  // 中身がはみ出して潰れて見えないよう、吹き出し自体は画面内に収まる位置へ
  // ずらす。その代わり、矢印(::after)だけをペットの実際の位置に向けて
  // ずらすことで、見た目上はペットを指し続けているようにする
  const BUBBLE_SCREEN_MARGIN = 8;
  const BUBBLE_ARROW_SAFE_MARGIN = 14;
  function followBubble() {
    if (!bubble || !outer) { bubbleFollowRaf = null; return; }
    const rect = outer.getBoundingClientRect();
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const petCenterX = rect.left + rect.width / 2;
    const minX = bw / 2 + BUBBLE_SCREEN_MARGIN;
    const maxX = Math.max(minX, window.innerWidth - bw / 2 - BUBBLE_SCREEN_MARGIN);
    const anchorX = Math.min(Math.max(petCenterX, minX), maxX);
    const minY = bh + BUBBLE_SCREEN_MARGIN;
    const maxY = Math.max(minY, window.innerHeight - BUBBLE_SCREEN_MARGIN);
    const anchorY = Math.min(Math.max(rect.top, minY), maxY);
    bubble.style.left = anchorX + 'px';
    bubble.style.top = anchorY + 'px';
    const arrowSafe = Math.max(bw / 2 - BUBBLE_ARROW_SAFE_MARGIN, 0);
    const arrowOffset = Math.min(Math.max(petCenterX - anchorX, -arrowSafe), arrowSafe);
    bubble.style.setProperty('--bubbleArrowLeft', 'calc(50% + ' + arrowOffset + 'px)');
    bubbleFollowRaf = requestAnimationFrame(followBubble);
  }
  function hideBubble() {
    clearTimeout(bubbleHideTimer);
    if (bubbleFollowRaf) { cancelAnimationFrame(bubbleFollowRaf); bubbleFollowRaf = null; }
    if (bubble) { bubble.remove(); bubble = null; }
  }
  function showBubble(text) {
    if (!outer || !loadBubbleEnabled()) return;
    hideBubble();
    bubble = document.createElement('div');
    bubble.className = 'deskPetBubble';
    bubble.textContent = text;
    document.body.appendChild(bubble);
    followBubble();
    bubbleHideTimer = setTimeout(() => {
      if (!bubble) return;
      bubble.classList.add('fadeOut');
      setTimeout(hideBubble, 350);
    }, loadBubbleDurationMs());
  }
  // 移動・ジャンプ・小休止の合間に、ランダムでときどき豆知識をつぶやく
  function maybeSpeak() {
    if (Math.random() >= 0.3) return;
    const text = PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
    showBubble(text);
  }

  function effectiveSprite(idx) {
    const s = SPECIES[idx];
    return buildGrowthGrid(s.grid, s.colors, currentStageIdx);
  }
  function spriteSize(idx) {
    const g = effectiveSprite(idx).grid;
    return { w: g[0].length * currentUnit, h: g.length * currentUnit };
  }
  function buildBoxShadow(idx) {
    const { grid, colors } = effectiveSprite(idx);
    const shadow = [];
    grid.forEach((row, y) => row.forEach((cell, colX) => {
      if (cell) shadow.push(colX * currentUnit + 'px ' + y * currentUnit + 'px 0 0 ' + colors[cell]);
    }));
    return shadow.join(',');
  }
  // box-shadowの各ピクセルは要素自身と同じ大きさの四角がコピーされる仕組み
  // なので、1ピクセル分(currentUnit×currentUnit)の大きさのまま複数配置する。
  // ただし見た目(box-shadow)は要素自身のレイアウト上の高さには含まれず、
  // outer側の高さもその分のままだと、position:fixedのbottom基準位置が
  // スプライトの上端付近になってしまい、大部分が画面外にはみ出して見えなくなる。
  // outer側にスプライト全体のサイズを明示的に与え、innerはその左上(0,0)に
  // 絶対配置することで正しい位置に収める
  function applySpecies(idx) {
    speciesIndex = idx;
    localStorage.setItem(PET_SPECIES_KEY, String(idx));
    if (!inner) return;
    const { w, h } = spriteSize(idx);
    inner.style.width = currentUnit + 'px';
    inner.style.height = currentUnit + 'px';
    inner.style.boxShadow = buildBoxShadow(idx);
    outer.style.width = w + 'px';
    outer.style.height = h + 'px';
  }
  // レベルに応じてペットの大きさ・アクセサリーを更新する。学習操作のたびに
  // 呼ばれるわけではないので、移動の切り替わりのタイミングで都度チェックする
  function refreshPetGrowth(announce) {
    if (!outer) return;
    const stage = growthStageForLevel(currentLevel());
    const stageIdx = PET_GROWTH_STAGES.indexOf(stage);
    const changed = stageIdx !== lastGrowthStageIndex;
    currentUnit = BASE_UNIT * stage.scale;
    currentStageIdx = stageIdx;
    applySpecies(speciesIndex);
    if (changed && announce && lastGrowthStageIndex !== -1 && stageIdx > lastGrowthStageIndex) {
      showBubble('🎉 レベルアップでペットが成長したよ！');
    }
    lastGrowthStageIndex = stageIdx;
  }

  function scheduleNext(delayMs) {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(chooseNextAction, delayMs);
  }
  // 左右に歩くだけでなく、その場でジャンプしたり、立ち止まって
  // ひと息ついたりと、いくつかの動きをランダムに織り交ぜる
  function chooseNextAction() {
    refreshPetGrowth(true);
    const r = Math.random();
    // 吹き出しは歩行中も表示され続けるようになったので、動きの種類に関わらず話しかけられる
    maybeSpeak();
    if (r < 0.55) {
      walkToRandom();
    } else if (r < 0.75) {
      jumpInPlace();
    } else {
      idlePause();
    }
  }
  function walkToRandom() {
    const { w, h } = spriteSize(speciesIndex);
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h - BOTTOM_MARGIN_PX);
    const targetX = Math.random() * maxX;
    const targetY = Math.random() * maxY;
    const distance = Math.hypot(targetX - x, targetY - y);
    const durationSec = Math.max(0.8, distance / SPEED_PX_PER_SEC);
    const direction = targetX >= x ? 1 : -1;
    outer.style.transform = 'scaleX(' + direction + ')';
    outer.style.transition = 'left ' + durationSec + 's linear, top ' + durationSec + 's linear';
    inner.classList.add('walking');
    x = targetX;
    y = targetY;
    outer.style.left = x + 'px';
    outer.style.top = y + 'px';
    setTimeout(() => {
      inner.classList.remove('walking');
      scheduleNext(MIN_STOP_MS + Math.random() * (MAX_STOP_MS - MIN_STOP_MS));
    }, durationSec * 1000);
  }
  function jumpInPlace() {
    inner.classList.add('jumping');
    setTimeout(() => {
      inner.classList.remove('jumping');
      scheduleNext(MIN_STOP_MS + Math.random() * (MAX_STOP_MS - MIN_STOP_MS));
    }, 600);
  }
  function idlePause() {
    inner.classList.add('idleSway');
    const waitMs = MIN_STOP_MS + Math.random() * (MAX_STOP_MS - MIN_STOP_MS);
    setTimeout(() => {
      inner.classList.remove('idleSway');
      scheduleNext(200);
    }, waitMs);
  }
  function onClickReact() {
    inner.classList.remove('jumping', 'idleSway');
    inner.classList.add('reacting');
    setTimeout(() => inner.classList.remove('reacting'), 500);
    const rect = outer.getBoundingClientRect();
    const heart = document.createElement('div');
    heart.className = 'deskPetHeart';
    heart.textContent = ['💖', '✨', '😊'][Math.floor(Math.random() * 3)];
    heart.style.left = (rect.left + rect.width / 2) + 'px';
    heart.style.top = rect.top + 'px';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 900);
  }
  function onResize() {
    if (!outer) return;
    const { w, h } = spriteSize(speciesIndex);
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h - BOTTOM_MARGIN_PX);
    let changed = false;
    if (x > maxX) { x = maxX; changed = true; }
    if (y > maxY) { y = maxY; changed = true; }
    if (changed) {
      outer.style.transition = 'none';
      outer.style.left = x + 'px';
      outer.style.top = y + 'px';
    }
  }

  function createPet() {
    if (outer) return;
    outer = document.createElement('div');
    outer.id = 'deskPet';
    outer.title = 'なでてみる';
    outer.style.pointerEvents = 'auto';
    outer.style.cursor = 'pointer';
    inner = document.createElement('div');
    inner.className = 'deskPetSprite';
    inner.style.position = 'absolute';
    inner.style.top = '0';
    inner.style.left = '0';
    outer.appendChild(inner);
    document.body.appendChild(outer);
    refreshPetGrowth(false);
    const { w, h } = spriteSize(speciesIndex);
    x = Math.random() * Math.max(0, window.innerWidth - w);
    y = Math.max(0, window.innerHeight - h - BOTTOM_MARGIN_PX);
    outer.style.left = x + 'px';
    outer.style.top = y + 'px';
    outer.addEventListener('click', onClickReact);
    scheduleNext(1000);
  }
  function destroyPet() {
    clearTimeout(pendingTimer);
    hideBubble();
    if (outer) { outer.remove(); outer = null; inner = null; }
  }

  window.addEventListener('resize', onResize);
  if (loadEnabled()) createPet();

  // 「その他」タブの設定画面(js/settings.js)から、表示のON/OFF・
  // キャラクターの変更を行うための公開。ペットの内部動作には影響しない
  window.ronshoPetControl = {
    SPECIES_LABELS: SPECIES_LABELS,
    isEnabled: loadEnabled,
    setEnabled: (enabled) => {
      localStorage.setItem(PET_ENABLED_KEY, enabled ? '1' : '0');
      if (enabled) createPet(); else destroyPet();
    },
    getSpeciesIndex: () => speciesIndex,
    setSpeciesIndex: (idx) => applySpecies(idx),
    say: (text) => showBubble(text),
    BUBBLE_DURATION_OPTIONS_MS: BUBBLE_DURATION_OPTIONS_MS,
    getBubbleDurationMs: loadBubbleDurationMs,
    setBubbleDurationMs: saveBubbleDurationMs,
    isBubbleEnabled: loadBubbleEnabled,
    setBubbleEnabled: (enabled) => { saveBubbleEnabled(enabled); if (!enabled) hideBubble(); },
    getGrowthStage: () => growthStageForLevel(currentLevel()),
    refreshGrowth: () => refreshPetGrowth(false)
  };
})();
/* ▲▲▲ ドット絵のペット ここまで ▲▲▲ */
