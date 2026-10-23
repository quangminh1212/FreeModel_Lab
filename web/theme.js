"use strict";

(() => {
  let theme = null;
  try {
    theme = localStorage.getItem("freemodel-theme");
  } catch { /* Use the system preference when storage is unavailable. */ }

  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
