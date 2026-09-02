/* ▼▼▼ 新規追加：ダークモード切り替え ▼▼▼ */
(function () {
  const THEME_KEY = 'ronshoThemeV1';

  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved === 'light' || saved === 'dark') ? saved : 'system';
  }
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
  function saveTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      localStorage.setItem(THEME_KEY, theme);
    } else {
      localStorage.removeItem(THEME_KEY);
    }
    applyTheme(theme);
  }

  // index.htmlの<head>内インラインスクリプトで、CSS読み込み前に既に
  // data-theme属性を適用済み。ここではlocalStorageとDOM属性の状態を
  // 一致させておくだけでよい（読み込み直後の見た目には影響しない）
  applyTheme(loadTheme());

  window.ronshoThemeControl = {
    getTheme: loadTheme,
    setTheme: saveTheme
  };
})();
/* ▲▲▲ ダークモード切り替え ここまで ▲▲▲ */
