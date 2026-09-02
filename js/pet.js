/* ▼▼▼ 新規追加：画面を歩き回るドット絵のペット（純粋な癒し要素。学習データには一切触れない） ▼▼▼ */
(function () {
  const SPECIES = [
    { label: 'スライム', grid: [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
      ], colors: { 1: '#7dd3fc', 2: '#0c2340' } },
    { label: 'ひよこ', grid: [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 3, 3, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
      ], colors: { 1: '#ffd93d', 2: '#3a2e00', 3: '#ff8c00' } },
    { label: 'ねこ', grid: [
        [1, 0, 1, 1, 1, 1, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 3, 3, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
      ], colors: { 1: '#f4e3c1', 2: '#2e7d32', 3: '#e08ea0' } },
    { label: 'おばけ', grid: [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 1, 1, 1, 1, 0, 1],
        [0, 1, 0, 1, 1, 0, 1, 0]
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
  const UNIT = 5;
  const MIN_STOP_MS = 1200;
  const MAX_STOP_MS = 4000;
  const SPEED_PX_PER_SEC = 45;
  const PET_SPECIES_KEY = 'ronshoPetSpeciesV1';
  const PET_ENABLED_KEY = 'ronshoPetEnabledV1';
  const PET_BUBBLE_DURATION_KEY = 'ronshoPetBubbleDurationV1';
  const BUBBLE_DURATION_DEFAULT_MS = 8000;
  const BUBBLE_DURATION_OPTIONS_MS = [4000, 8000, 12000, 16000, 20000];

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

  let speciesIndex = loadSpeciesIndex();
  let outer = null, inner = null, x = 0, pendingTimer = null;
  let bubble = null, bubbleHideTimer = null;

  function hideBubble() {
    clearTimeout(bubbleHideTimer);
    if (bubble) { bubble.remove(); bubble = null; }
  }
  function showBubble(text) {
    if (!outer) return;
    hideBubble();
    bubble = document.createElement('div');
    bubble.className = 'deskPetBubble';
    bubble.textContent = text;
    document.body.appendChild(bubble);
    const rect = outer.getBoundingClientRect();
    bubble.style.left = (rect.left + rect.width / 2) + 'px';
    bubble.style.top = rect.top + 'px';
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

  function spriteSize(idx) {
    const g = SPECIES[idx].grid;
    return { w: g[0].length * UNIT, h: g.length * UNIT };
  }
  function buildBoxShadow(idx) {
    const s = SPECIES[idx];
    const shadow = [];
    s.grid.forEach((row, y) => row.forEach((cell, colX) => {
      if (cell) shadow.push(colX * UNIT + 'px ' + y * UNIT + 'px 0 0 ' + s.colors[cell]);
    }));
    return shadow.join(',');
  }
  // box-shadowの各ピクセルは要素自身と同じ大きさの四角がコピーされる仕組み
  // なので、1ピクセル分(UNIT×UNIT)の大きさのまま複数配置する。ただし
  // 見た目(box-shadow)は要素自身のレイアウト上の高さには含まれず、outer側の
  // 高さもUNIT分のままだと、position:fixedのbottom基準位置がスプライトの
  // 上端付近になってしまい、大部分が画面外にはみ出して見えなくなる。
  // outer側にスプライト全体のサイズを明示的に与え、innerはその左上(0,0)に
  // 絶対配置することで正しい位置に収める
  function applySpecies(idx) {
    speciesIndex = idx;
    localStorage.setItem(PET_SPECIES_KEY, String(idx));
    if (!inner) return;
    const { w, h } = spriteSize(idx);
    inner.style.boxShadow = buildBoxShadow(idx);
    outer.style.width = w + 'px';
    outer.style.height = h + 'px';
  }

  function scheduleNext(delayMs) {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(chooseNextAction, delayMs);
  }
  // 左右に歩くだけでなく、その場でジャンプしたり、立ち止まって
  // ひと息ついたりと、いくつかの動きをランダムに織り交ぜる
  function chooseNextAction() {
    const r = Math.random();
    if (r < 0.55) {
      walkToRandom();
    } else if (r < 0.75) {
      maybeSpeak();
      jumpInPlace();
    } else {
      maybeSpeak();
      idlePause();
    }
  }
  function walkToRandom() {
    hideBubble();
    const { w } = spriteSize(speciesIndex);
    const maxX = Math.max(0, window.innerWidth - w);
    const targetX = Math.random() * maxX;
    const distance = Math.abs(targetX - x);
    const durationSec = Math.max(0.8, distance / SPEED_PX_PER_SEC);
    const direction = targetX >= x ? 1 : -1;
    outer.style.transform = 'scaleX(' + direction + ')';
    outer.style.transition = 'left ' + durationSec + 's linear';
    inner.classList.add('walking');
    x = targetX;
    outer.style.left = x + 'px';
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
    const { w } = spriteSize(speciesIndex);
    const maxX = Math.max(0, window.innerWidth - w);
    if (x > maxX) { x = maxX; outer.style.transition = 'none'; outer.style.left = x + 'px'; }
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
    inner.style.width = UNIT + 'px';
    inner.style.height = UNIT + 'px';
    outer.appendChild(inner);
    document.body.appendChild(outer);
    applySpecies(speciesIndex);
    const { w } = spriteSize(speciesIndex);
    x = Math.random() * Math.max(0, window.innerWidth - w);
    outer.style.left = x + 'px';
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
    setBubbleDurationMs: saveBubbleDurationMs
  };
})();
/* ▲▲▲ ドット絵のペット ここまで ▲▲▲ */
