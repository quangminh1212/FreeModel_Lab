(function () {
  var THEME_KEY = "freemodel-theme";
  var EXPLICIT_THEME_KEY = "freemodel-theme-explicit";
  var STYLE_KEY = "freemodel-style";

  var root = document.documentElement;

  function read(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function write(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (error) { /* storage is optional */ }
  }

  /* ---- Theme (dark / light) ------------------------------------------- */

  var storedTheme = read(THEME_KEY);
  var explicitTheme = read(EXPLICIT_THEME_KEY) === "1";

  /* ---- Style (visual identity) ---------------------------------------- */

  /*
   * Styles are opt-in: no data-style attribute means the built-in VS Code
   * Dark Modern look. The list below is the single source of truth for the
   * picker; it mirrors the blocks generated into style.css by
   * scripts/gen-styles.js (which reads docs/ui-catalog/index.html).
   *
   * app.js owns data-theme only, so writing data-style here is safe.
   */
  var STYLES = [
    { id: "", name: "Mặc định", light: false },
    { id: "vscode-dark-modern", name: "VS Code Dark Modern", light: false },
    { id: "vscode-light-modern", name: "VS Code Light Modern", light: true },
    { id: "github-primer", name: "GitHub Primer", light: false },
    { id: "catppuccin-mocha", name: "Catppuccin Mocha", light: false },
    { id: "catppuccin-latte", name: "Catppuccin Latte", light: true },
    { id: "nord", name: "Nord", light: false },
    { id: "one-dark", name: "One Dark", light: false },
    { id: "gruvbox-dark", name: "Gruvbox Dark", light: false },
    { id: "kanagawa", name: "Kanagawa", light: false },
    { id: "rose-pine", name: "Rosé Pine", light: false },
    { id: "rose-pine-dawn", name: "Rosé Pine Dawn", light: true },
    { id: "solarized-dark", name: "Solarized Dark", light: false },
    { id: "solarized-light", name: "Solarized Light", light: true },
    { id: "terminal-green", name: "Terminal Green", light: false },
    { id: "high-contrast", name: "High Contrast", light: false },
    { id: "linear", name: "Linear", light: false },
    { id: "vercel-geist", name: "Vercel Geist", light: false },
    { id: "shadcn-neutral", name: "shadcn/ui Neutral", light: false },
    { id: "tailwind-slate", name: "Tailwind Slate", light: false },
    { id: "notion", name: "Notion", light: true },
    { id: "supabase", name: "Supabase", light: false },
    { id: "fluent-2", name: "Fluent 2", light: false },
    { id: "carbon", name: "Carbon", light: false },
    { id: "atlassian", name: "Atlassian", light: false },
    { id: "material-3", name: "Material 3", light: false },
    { id: "polaris", name: "Polaris", light: true },
    { id: "neon-cyber", name: "Neon Cyber", light: false },
    { id: "sunset-warm", name: "Sunset Warm", light: false },
    { id: "forest", name: "Forest", light: false },
    { id: "paper-ink", name: "Paper Ink", light: true },
    { id: "mono-paper", name: "Mono Paper", light: true },
    { id: "pico", name: "Pico", light: true },
    { id: "water", name: "Water", light: true },
    { id: "simple-css", name: "Simple.css", light: true },
    { id: "mvp-css", name: "MVP.css", light: true },
    { id: "tufte", name: "Tufte", light: true },
     { id: "dracula", name: "Dracula", light: false },
     { id: "tokyo-night", name: "Tokyo Night", light: false },
     { id: "monokai", name: "Monokai", light: false },
     { id: "radix-slate", name: "Radix Slate", light: true },
     { id: "chakra-teal", name: "Chakra UI Teal", light: true },
     { id: "ant-design", name: "Ant Design", light: true },
     { id: "mantine-indigo", name: "Mantine Indigo", light: true },
     { id: "gitlab-pajamas", name: "GitLab Pajamas", light: true },
     { id: "everforest-light", name: "Everforest Light", light: true },
      { id: "daisyui-corporate", name: "DaisyUI Corporate", light: true },
      { id: "solarized-sepia", name: "Solarized Sepia", light: true }
  ];

  var known = {};
  STYLES.forEach(function (entry) { if (entry.id) known[entry.id] = entry; });

  var current = read(STYLE_KEY) || "";
  if (current && !known[current]) current = "";

  var validStoredTheme = storedTheme === "light" || storedTheme === "dark";
  var theme = explicitTheme && validStoredTheme
    ? storedTheme
    : (current && known[current]
      ? (known[current].light ? "light" : "dark")
      : (validStoredTheme ? storedTheme : "dark"));
  root.dataset.theme = theme;

  function applyStyle(id) {
    if (id && known[id]) root.dataset.style = id;
    else {
      delete root.dataset.style;
      id = "";
    }
    write(STYLE_KEY, id);

    var select = document.getElementById("style-select");
    if (select && select.value !== id) select.value = id;

    /*
     * A style implies a polarity until the user explicitly toggles light/dark.
     * Paired CSS variants let that choice remain effective with any style.
     * app.js re-applies data-theme on boot from the same storage key.
     */
    if (id && read(EXPLICIT_THEME_KEY) !== "1") {
      var wanted = known[id].light ? "light" : "dark";
      if (root.dataset.theme !== wanted) {
        root.dataset.theme = wanted;
        var toggle = document.getElementById("theme-toggle");
        if (toggle) {
          var dark = wanted === "dark";
          toggle.setAttribute("aria-pressed", String(!dark));
          toggle.setAttribute("aria-label", dark ? "Bật giao diện sáng" : "Bật giao diện tối");
          toggle.title = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
          var icon = document.getElementById("theme-icon");
          if (icon && icon.firstElementChild) {
            icon.firstElementChild.setAttribute("href", dark ? "#i-moon" : "#i-sun");
          }
        }
      }
    }
    if (read(EXPLICIT_THEME_KEY) !== "1") write(THEME_KEY, root.dataset.theme);
  }

  function mountPicker() {
    var select = document.getElementById("style-select");
    if (!select || select.dataset.ready === "1") return;

    STYLES.forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name;
      select.appendChild(option);
    });

    select.value = current;
    select.dataset.ready = "1";

    select.addEventListener("change", function () {
      current = select.value;
      applyStyle(current);
    });

    /* Let [ and ] step through styles without opening the dropdown. */
    select.addEventListener("keydown", function (event) {
      if (event.key !== "[" && event.key !== "]") return;
      var ids = STYLES.map(function (entry) { return entry.id; });
      var index = ids.indexOf(select.value);
      if (index < 0) index = 0;
      index += event.key === "]" ? 1 : -1;
      if (index < 0) index = ids.length - 1;
      if (index >= ids.length) index = 0;
      event.preventDefault();
      select.value = ids[index];
      current = select.value;
      applyStyle(current);
    });
  }

  applyStyle(current);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPicker);
  } else {
    mountPicker();
  }
})();
