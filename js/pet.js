/* ▼▼▼ 新規追加：画面を歩き回るドット絵のペット（純粋な癒し要素。学習データには一切触れない） ▼▼▼ */
(function () {
  const GRID = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 2, 1, 1, 2, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0]
  ];
  const UNIT = 5;
  const COLORS = { 1: '#7dd3fc', 2: '#0c2340' };
  const SPRITE_W = GRID[0].length * UNIT;
  const SPRITE_H = GRID.length * UNIT;
  const MIN_STOP_MS = 1500;
  const MAX_STOP_MS = 4500;
  const SPEED_PX_PER_SEC = 45;

  const outer = document.createElement('div');
  outer.id = 'deskPet';
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

  function walkToRandom() {
    const maxX = Math.max(0, window.innerWidth - SPRITE_W);
    const targetX = Math.random() * maxX;
    const distance = Math.abs(targetX - x);
    const durationSec = Math.max(0.8, distance / SPEED_PX_PER_SEC);
    const direction = targetX >= x ? 1 : -1;
    outer.style.transform = 'scaleX(' + direction + ')';
    outer.style.transition = 'left ' + durationSec + 's linear';
    outer.classList.add('walking');
    x = targetX;
    outer.style.left = x + 'px';
    setTimeout(() => {
      outer.classList.remove('walking');
      setTimeout(walkToRandom, MIN_STOP_MS + Math.random() * (MAX_STOP_MS - MIN_STOP_MS));
    }, durationSec * 1000);
  }
  window.addEventListener('resize', () => {
    const maxX = Math.max(0, window.innerWidth - SPRITE_W);
    if (x > maxX) { x = maxX; outer.style.transition = 'none'; outer.style.left = x + 'px'; }
  });
  setTimeout(walkToRandom, 1000);
})();
/* ▲▲▲ ドット絵のペット ここまで ▲▲▲ */
