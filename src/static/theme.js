// Perdisco theme: applyTheme() plus the startup choice, shared by every page.
// Load it synchronously in <head>, after theme.css and the theme-color <meta>, so there is no white flash.
// Single place the theme is applied: page colors (data-theme) and the browser's own
// toolbar/status bar (theme-color, from the page background). Runs here, after the
// stylesheet and before first paint, so there is no white flash.
function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Resolved rgb() rather than the raw token (mobile browsers reject e.g. "#eef"), and a
  // fresh <meta> rather than editing content (some browsers, notably Safari, miss edits).
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = getComputedStyle(root).backgroundColor;
  document.querySelector('meta[name="theme-color"]').replaceWith(meta);
}
(function () {
  // A saved choice wins; otherwise follow the system.
  let theme;
  try { theme = JSON.parse(localStorage.getItem('flashcardState') || '{}').theme; } catch (e) {}
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);
})();
