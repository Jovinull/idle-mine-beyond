// Applies the saved color theme before first paint to avoid a flash.
// Kept as a file (not inline) so the Content-Security-Policy stays strict.
(function () {
  try {
    var theme = localStorage.getItem("imb-site-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    // Storage can be blocked; the system theme applies.
  }
})();
