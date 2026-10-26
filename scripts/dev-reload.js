"use strict";

(() => {
  let currentVersion = null;
  let checking = false;
  let reloading = false;

  async function checkForChanges() {
    if (checking || reloading) return;
    checking = true;
    try {
      const response = await fetch("/__dev/version", { cache: "no-store" });
      if (!response.ok) return;
      const { version } = await response.json();
      if (currentVersion !== null && version !== currentVersion) {
        // Reload this browsing context in place; never ask Chrome to open a tab.
        reloading = true;
        window.location.reload();
        return;
      }
      currentVersion = version;
    } catch { /* The dev server may be rebuilding and restarting. */ }
    finally { checking = false; }
  }

  void checkForChanges();
  window.setInterval(checkForChanges, 700);
})();
