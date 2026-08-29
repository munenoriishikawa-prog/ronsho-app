/* ▼▼▼ 新規追加：画面を歩き回るドット絵のペット（純粋な癒し要素。学習データには一切触れない） ▼▼▼ */
(function () {
  // 複数のキャラクターから、この端末では1匹だけをランダムに選んで固定する
  // （毎回変わるより「自分のペット」感が出るよう、localStorageに保存する）
  const SPECIES = [
    { // スライム
      grid: [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
      ],
      colors: { 1: '#7dd3fc', 2: '#0c2340' }
    },
    { // ひよこ
      grid: [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 3, 3, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
      ],
      colors: { 1: '#ffd93d', 2: '#3a2e00', 3: '#ff8c00' }
    },
    { // ねこ
      grid: [
        [1, 0, 1, 1, 1, 1, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 3, 3, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
      ],
      colors: { 1: '#f4e3c1', 2: '#2e7d32', 3: '#e08ea0' }
    },
    { // おばけ
      grid: [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 2, 1, 1, 2, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 1, 1, 1, 1, 0, 1],
        [0, 1, 0, 1, 1, 0, 1, 0]
      ],
      colors: { 1: '#b39ddb', 2: '#1a1a2e' }
    }
  ];
  const PET_SPECIES_KEY = 'ronshoPetSpeciesV1';
  function pickSpeciesIndex() {
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
  const species = SPECIES[pickSpeciesIndex()];
  const GRID = species.grid;
  const COLORS = species.colors;
  const UNIT = 5;
  const SPRITE_W = GRID[0].length * UNIT;
  const SPRITE_H = GRID.length * UNIT;
  const MIN_STOP_MS = 1200;
  const MAX_STOP_MS = 4000;
  const SPEED_PX_PER_SEC = 45;

  const outer = document.createElement('div');
  outer.id = 'deskPet';
  outer.title = 'なでてみる';
  const inner = document.createElement('div');
  inner.className = 'deskPetSprite';
  const shadow = [];
  GRID.forEach((row, y) => row.forEach((cell, x) => {
    if (cell) shadow.push(x * UNIT + 'px ' + y * UNIT + 'px 0 0 ' + COLORS[cell]);
  }));
  // box-shadowの各ピクセルは要素自身と同じ大きさの四角がコピーされる
  // 仕組みなので、1ピクセル分(UNIT×UNIT)の大きさのまま複数配置する。
  // ただし見た目(box-shadow)は要素自身のレイアウト上の高さには含まれず、
  // outer側の高さもUNIT分のままだと、position:fixedのbottom基準位置が
  // スプライトの上端付近になってしまい、大部分が画面外にはみ出して
  // 見えなくなる。outer側にスプライト全体のサイズを明示的に与え、
  // innerはその左上(0,0)に絶対配置することで正しい位置に収める
  inner.style.position = 'absolute';
  inner.style.top = '0';
  inner.style.left = '0';
  inner.style.width = UNIT + 'px';
  inner.style.height = UNIT + 'px';
  inner.style.boxShadow = shadow.join(',');
  outer.style.width = SPRITE_W + 'px';
  outer.style.height = SPRITE_H + 'px';
  outer.appendChild(inner);
  document.body.appendChild(outer);

  let x = Math.random() * Math.max(0, window.innerWidth - SPRITE_W);
  outer.style.left = x + 'px';
  let pendingTimer = null;

  function scheduleNext(delayMs) {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(chooseNextAction, delayMs);
  }
  // 左右に歩くだけでなく、その場でジャンプしたり、立ち止まって
  // ひと息ついたりと、いくつかの動きをランダムに織り交ぜる
  function chooseNextAction() {
    const r = Math.random();
    if (r < 0.55) walkToRandom();
    else if (r < 0.75) jumpInPlace();
    else idlePause();
  }
  function walkToRandom() {
    const maxX = Math.max(0, window.innerWidth - SPRITE_W);
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

  // クリック（タップ）すると、その場で嬉しそうに跳ねてハートを飛ばす
  outer.style.pointerEvents = 'auto';
  outer.style.cursor = 'pointer';
  outer.addEventListener('click', () => {
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
  });

  window.addEventListener('resize', () => {
    const maxX = Math.max(0, window.innerWidth - SPRITE_W);
    if (x > maxX) { x = maxX; outer.style.transition = 'none'; outer.style.left = x + 'px'; }
  });
  scheduleNext(1000);
})();
/* ▲▲▲ ドット絵のペット ここまで ▲▲▲ */
