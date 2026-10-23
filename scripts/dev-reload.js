"use strict";

(() => {
  let currentVersion = null;

  async function checkForChanges() {
    try {
      const response = await fetch("/__dev/version", { cache: "no-store" });
      if (!response.ok) return;
      const { version } = await response.json();
      if (currentVersion !== null && version !== currentVersion) {
        window.location.reload();
        return;
      }
      currentVersion = version;
    } catch { /* The dev server may be rebuilding and restarting. */ }
  }

  void checkForChanges();
  window.setInterval(checkForChanges, 700);
})();
