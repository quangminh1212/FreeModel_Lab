/* global localStorage, fetch, document, window, navigator */

const THEME_KEY = "freemodel-theme";
const EXPLICIT_THEME_KEY = "freemodel-theme-explicit";
const SIDEBAR_KEY = "freemodel-sidebar";
const SIDEBAR_WIDTH_KEY = "freemodel-sidebar-width";
const STALE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const state = {
  providers: [],
  candidates: [],
  view: "providers",
  activeId: null,
  openTabs: [],
  focusedTabId: null,
  filter: "",
  categoryFilter: "all",
  catalogLoaded: false,
  catalogBusy: false,
  providersLoaded: false,
  sourceUpdatedAt: "unknown"
};

const dom = {
  workbench: document.querySelector("#workbench"),
  editor: document.querySelector(".editor"),
  sidebar: document.querySelector("#sidebar"),
  sidebarHeading: document.querySelector("#sidebar-heading"),
  sidebarList: document.querySelector("#sidebar-list"),
  sidebarFilter: document.querySelector("#sidebar-filter"),
  categoryFilters: document.querySelector("#category-filters"),
  discoverView: document.querySelector("#discover-view"),
  providersList: document.querySelector("#providers"),
  candidatesList: document.querySelector("#candidates"),
  discoverList: document.querySelector("#discover-list"),
  discoverStatus: document.querySelector("#discover-status"),
  helpView: document.querySelector("#help-view"),
  treeMineCount: document.querySelector("#tree-mine-count"),
  treeCandidatesCount: document.querySelector("#tree-candidates-count"),
  catalogStatus: document.querySelector("#catalog-status"),
  tabs: document.querySelector("#tabs"),
  panel: document.querySelector("#detail-panel"),
  content: document.querySelector("#content"),
  refreshButton: document.querySelector("#refresh"),
  themeToggle: document.querySelector("#theme-toggle"),
  themeIcon: document.querySelector("#theme-icon"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  resizer: document.querySelector("#sidebar-resizer"),
  statusMessage: document.querySelector("#status-message"),
  statusMessageText: document.querySelector("#status-message-text"),
  statusKeysText: document.querySelector("#status-keys-text"),
  verifiedAt: document.querySelector("#verified-at")
};

const mobileDetailQuery = window.matchMedia("(max-width: 900px)");

/* ---------------------------------------------------------------- */
/* Small DOM helpers                                                 */
/* ---------------------------------------------------------------- */

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function icon(name, className = "ico") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function safeLink(label, href, className = "text-link", withIcon = true) {
  const link = el("a", className, label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (withIcon) link.append(icon("external"));
  return link;
}

function actionButton(label, className = "button", iconName = "") {
  const button = el("button", className);
  button.type = "submit";
  if (iconName) button.append(icon(iconName));
  button.append(el("span", "", label));
  return button;
}

function field(labelText, name, options = {}) {
  const wrap = el("div", "field");
  const label = el("label", "", labelText);
  const input = el("input");
  input.name = name;
  input.id = `field-${name}`;
  input.type = options.type || "text";
  if (options.required) input.required = true;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.step) input.step = options.step;
  if (options.min !== undefined) input.min = options.min;
  if (options.max !== undefined) input.max = options.max;
  if (options.maxLength) input.maxLength = options.maxLength;
  if (options.value) input.value = options.value;
  label.htmlFor = input.id;
  label.append(input);
  wrap.append(label);
  return { wrap, input };
}

function checkLine(labelText, name) {
  const wrap = el("label", "check-line");
  const input = el("input");
  input.type = "checkbox";
  input.name = name;
  input.id = `check-${name}`;
  wrap.htmlFor = input.id;
  wrap.append(input, el("span", "", labelText));
  return { wrap, input };
}

function setStatus(message, kind = "", target = dom.statusMessage) {
  dom.statusMessageText.textContent = message;
  dom.statusMessage.dataset.kind = kind || "";
  if (target && target !== dom.statusMessage) {
    target.textContent = message;
    target.dataset.kind = kind || "";
  }
  refreshStatusIcon();
}

function statusIcon(kind) {
  if (kind === "error") return "error";
  if (kind === "warning") return "warn";
  if (kind === "success") return "ok";
  return "info";
}

function refreshStatusIcon() {
  const kind = dom.statusMessage.dataset.kind || "";
  const old = dom.statusMessage.querySelector("svg.ico");
  const next = icon(statusIcon(kind));
  if (old) old.replaceWith(next);
  else dom.statusMessage.prepend(next);
}

/* ---------------------------------------------------------------- */
/* Theme                                                             */
/* ---------------------------------------------------------------- */

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme, persist = true) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  const dark = next === "dark";
  dom.themeToggle.setAttribute("aria-pressed", String(!dark));
  dom.themeToggle.setAttribute("aria-label", dark ? "Bật giao diện sáng" : "Bật giao diện tối");
  dom.themeToggle.title = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
  dom.themeIcon.firstElementChild.setAttribute("href", dark ? "#i-moon" : "#i-sun");
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
      localStorage.setItem(EXPLICIT_THEME_KEY, "1");
    } catch (error) { /* storage optional */ }
  }
}

dom.themeToggle.addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
});

/* ---------------------------------------------------------------- */
/* API                                                               */
/* ---------------------------------------------------------------- */

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      "x-freemodel-lab": "dashboard"
    },
    body: options.body,
    credentials: "same-origin"
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch (error) { payload = null; }
  }
  if (!response.ok) {
    const message = (payload && (payload.error || payload.message)) || `Yêu cầu ${path} thất bại (${response.status}).`;
    throw new Error(message);
  }
  return payload || {};
}

/* ---------------------------------------------------------------- */
/* Sidebar: tree rows                                                */
/* ---------------------------------------------------------------- */

function providerInitial(provider) {
  const source = (provider.name || provider.id || "?").trim();
  return source.slice(0, 1).toUpperCase() || "?";
}

function keyStateOf(provider) {
  if (provider.keySaved === true) return "saved";
  if (provider.keySaved === false) return "missing";
  return "unknown";
}

function matchesFilter(...values) {
  const needle = state.filter.trim().toLowerCase();
  if (!needle) return true;
  return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
}

function matchesCategory(provider) {
  if (state.categoryFilter === "all") return true;
  if (state.categoryFilter === "router") return provider.category === "router";
  return provider.category !== "router";
}

function treeRow({ label, sublabel, caption, summaryText, iconText, id, active, metaNodes, iconName }) {
  const row = el("button", "tree-row");
  row.type = "button";
  row.dataset.targetId = id;
  if (active) {
    row.classList.add("is-active");
    row.setAttribute("aria-current", "true");
  }
  const mark = iconName ? icon(iconName, "ico tree-icon-glyph") : el("span", "tree-icon", iconText);
  row.append(mark);
  const text = el("span", "tree-text");
  const title = el("span", "tree-label", label);
  if (sublabel) title.title = `${label} — ${sublabel}`;
  text.append(title);
  if (sublabel || caption) {
    const details = el("span", "tree-caption");
    if (sublabel) details.append(el("code", "tree-id", sublabel));
    if (sublabel && caption) details.append(el("span", "tree-caption-sep", "·"));
    if (caption) details.append(el("span", "tree-caption-copy", caption));
    text.append(details);
  }
  if (summaryText) {
    const summary = el("span", "tree-summary", summaryText);
    summary.title = summaryText;
    text.append(summary);
  }
  row.append(text);
  const meta = el("span", "tree-meta");
  for (const node of metaNodes) meta.append(node);
  row.append(meta);
  row.addEventListener("click", () => openTarget(id, { fromSidebar: true }));
  return row;
}

function renderProviderRows() {
  const providers = state.providers.filter((provider) =>
    matchesCategory(provider) &&
    matchesFilter(provider.name, provider.id, provider.category, provider.endpoint, provider.quota && provider.quota.summary)
  );
  dom.treeMineCount.textContent = String(state.providers.length);
  const nodes = providers.map((provider) => {
    const keyState = keyStateOf(provider);
    const keyStatus = el("span", "key-state-chip", {
      saved: "Key đã lưu",
      missing: "Chưa có key",
      unknown: "Kho key chưa sẵn sàng"
    }[keyState]);
    keyStatus.dataset.state = keyState;
    keyStatus.title = "Trạng thái key trong kho credential cục bộ";
    const modelCount = Array.isArray(provider.quota && provider.quota.models)
      ? provider.quota.models.length
      : 0;
    const categoryLabel = providerCategoryLabel(provider.category);
    const quotaSummary = provider.quota && provider.quota.summary;

    return treeRow({
      label: provider.name,
      sublabel: provider.id,
      caption: modelCount ? `${categoryLabel} · ${modelCount} model tham khảo` : categoryLabel,
      summaryText: quotaSummary || "Chưa có thông tin quota công bố.",
      iconText: providerInitial(provider),
      id: provider.id,
      active: state.activeId === provider.id && state.view === "providers",
      metaNodes: [
        provider.catalogSource === "upstream" ? el("span", "tag-upstream", "Chờ xác minh") : null,
        keyStatus
      ].filter(Boolean)
    });
  });
  if (!nodes.length) {
    replaceTreeListChildren(
      dom.providersList,
      el("li", "empty-state", state.filter ? "Không có provider khớp bộ lọc." : "Danh mục đang trống.")
    );
    return;
  }
  const list = el("div");
  for (const node of nodes) {
    const li = el("li");
    li.append(node);
    list.append(li);
  }
  replaceTreeListChildren(dom.providersList, ...list.childNodes);
}

function replaceTreeListChildren(list, ...children) {
  const focused = document.activeElement instanceof HTMLElement
    ? document.activeElement.closest(".tree-row")
    : null;
  const focusedTargetId = focused && list.contains(focused)
    ? focused.dataset.targetId
    : null;

  list.replaceChildren(...children);
  if (!focusedTargetId) return;

  const replacement = Array.from(list.querySelectorAll(".tree-row"))
    .find((row) => row.dataset.targetId === focusedTargetId);
  if (replacement) {
    replacement.focus({ preventScroll: true });
    return;
  }

  if (
    list.getClientRects().length &&
    !dom.sidebar.inert &&
    !dom.workbench.classList.contains("sidebar-hidden")
  ) {
    dom.sidebarFilter.focus({ preventScroll: true });
  }
}

function renderCandidateRows() {
  const candidates = state.candidates.filter((provider) =>
    matchesCategory(provider) && matchesFilter(provider.name, provider.id, provider.category, provider.endpoint)
  );
  dom.treeCandidatesCount.textContent = String(state.candidates.length);
  if (!state.catalogLoaded) {
    replaceTreeListChildren(dom.candidatesList, el("li", "empty-state", "Đang tải ứng viên…"));
    return;
  }
  if (!candidates.length) {
    replaceTreeListChildren(
      dom.candidatesList,
      el("li", "empty-state", state.filter ? "Không có ứng viên khớp bộ lọc." : "Không có ứng viên mới. Bấm biểu tượng tải lại để cập nhật.")
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const candidate of candidates) {
    const li = el("li");
    li.append(treeRow({
      label: candidate.name,
      sublabel: candidate.id,
      iconText: providerInitial(candidate),
      iconName: "sparkle",
      id: `candidate:${candidate.id}`,
      active: state.activeId === `candidate:${candidate.id}`,
      metaNodes: [el("span", "tag-upstream", "mới")]
    }));
    fragment.append(li);
  }
  replaceTreeListChildren(dom.candidatesList, fragment);
}

function renderSidebar() {
  renderProviderRows();
  renderCandidateRows();
}

/* ---------------------------------------------------------------- */
/* Discover view                                                     */
/* ---------------------------------------------------------------- */

function renderDiscoverView() {
  if (!state.catalogLoaded) {
    dom.discoverStatus.textContent = "Chưa tải nguồn upstream.";
    replaceTreeListChildren(dom.discoverList);
    return;
  }
  const candidates = state.candidates.filter((candidate) =>
    matchesCategory(candidate) && matchesFilter(candidate.name, candidate.id, candidate.category)
  );
  dom.discoverStatus.textContent = candidates.length
    ? `${candidates.length} ứng viên · cập nhật ${formatSourceDate(state.sourceUpdatedAt)}`
    : "Không tìm thấy nguồn phù hợp.";
  const fragment = document.createDocumentFragment();
  for (const candidate of candidates) {
    const li = el("li");
    li.append(
      treeRow({
        label: candidate.name,
        caption: providerCategoryLabel(candidate.category),
        iconText: providerInitial(candidate),
        iconName: "sparkle",
        id: `candidate:${candidate.id}`,
        active: state.activeId === `candidate:${candidate.id}`,
        metaNodes: [el("span", "tag-upstream", "Chưa xác minh")]
      })
    );
    fragment.append(li);
  }
  replaceTreeListChildren(dom.discoverList, fragment);
}

function formatSourceDate(value) {
  const match = (value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "chưa rõ";
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "chưa rõ";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function providerCategoryLabel(category) {
  return category === "router" ? "Định tuyến mô hình" : "API suy luận";
}

/* ---------------------------------------------------------------- */
/* Tabs                                                              */
/* ---------------------------------------------------------------- */

function labelForTarget(targetId) {
  if (targetId === "welcome") return "Chào mừng";
  if (targetId.startsWith("candidate:")) {
    const id = targetId.slice("candidate:".length);
    const candidate = state.candidates.find((item) => item.id === id);
    return candidate ? candidate.name : id;
  }
  const provider = state.providers.find((item) => item.id === targetId);
  return provider ? provider.name : targetId;
}

function iconForTarget(targetId) {
  if (targetId === "welcome") return "layers";
  return targetId.startsWith("candidate:") ? "sparkle" : "layers";
}

function renderTabs() {
  const focusedControl = document.activeElement instanceof HTMLElement && dom.tabs.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusedTab = focusedControl && focusedControl.closest(".tab");
  const focusedTargetId = focusedTab && focusedTab.dataset.targetId;
  const focusKind = focusedControl && focusedControl.classList.contains("tab-close")
    ? "close"
    : (focusedControl && focusedControl.classList.contains("tab-hit") ? "tab" : null);
  const focusedIndex = Number.parseInt(focusedTab && focusedTab.dataset.tabIndex, 10);

  if (!state.openTabs.length) {
    dom.tabs.hidden = true;
    dom.tabs.replaceChildren();
    state.focusedTabId = null;
    dom.panel.setAttribute("role", "region");
    dom.panel.setAttribute("aria-label", state.view === "discover" ? "Nguồn provider mới" : state.view === "help" ? "Trợ giúp FreeModel Lab" : "Danh mục provider");
    dom.panel.removeAttribute("aria-labelledby");
    return;
  }

  dom.tabs.hidden = false;
  dom.panel.setAttribute("role", "tabpanel");
  dom.panel.setAttribute("aria-label", "Nội dung chi tiết");

  if (focusKind) {
    state.focusedTabId = state.openTabs.includes(focusedTargetId)
      ? focusedTargetId
      : state.openTabs[Math.min(Math.max(Number.isInteger(focusedIndex) ? focusedIndex : 0, 0), state.openTabs.length - 1)];
  } else if (!state.openTabs.includes(state.focusedTabId)) {
    state.focusedTabId = state.activeId;
  }
  const rovingTargetId = state.openTabs.includes(state.focusedTabId) ? state.focusedTabId : state.activeId;

  const fragment = document.createDocumentFragment();
  for (const [index, targetId] of state.openTabs.entries()) {
    const active = state.activeId === targetId;
    const tab = el("div", active ? "tab is-active" : "tab");
    tab.setAttribute("role", "presentation");
    tab.dataset.targetId = targetId;
    tab.dataset.tabIndex = String(index);
    const button = el("button", "tab-hit");
    button.type = "button";
    button.id = `editor-tab-${index}`;
    button.dataset.targetId = targetId;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(active));
    button.setAttribute("aria-controls", "detail-panel");
    button.tabIndex = targetId === rovingTargetId ? 0 : -1;
    button.append(icon(iconForTarget(targetId), "ico"));
    button.append(el("span", "tab-label", labelForTarget(targetId)));
    button.addEventListener("click", () => openTarget(targetId));
    const close = el("button", "tab-close");
    close.type = "button";
    close.dataset.targetId = targetId;
    close.dataset.tabIndex = String(index);
    close.title = "Đóng tab";
    close.setAttribute("aria-label", `Đóng tab ${labelForTarget(targetId)}`);
    close.append(icon("close"));
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(targetId);
    });
    tab.append(button, close);
    fragment.append(tab);
  }
  dom.tabs.replaceChildren(fragment);
  if (focusKind) {
    const selector = focusKind === "close" ? ".tab-close" : ".tab-hit";
    const focusTarget = Array.from(dom.tabs.querySelectorAll(selector))
      .find((item) => item.dataset.targetId === state.focusedTabId);
    focusTarget?.focus();
  }
  const activeIndex = state.openTabs.indexOf(state.activeId);
  if (activeIndex >= 0) dom.panel.setAttribute("aria-labelledby", `editor-tab-${activeIndex}`);
  else dom.panel.removeAttribute("aria-labelledby");
}

dom.tabs.addEventListener("focusin", (event) => {
  const control = event.target instanceof HTMLElement ? event.target : null;
  const tabHit = control?.closest(".tab-hit");
  const closeButton = control?.closest(".tab-close");
  const targetId = tabHit?.dataset.targetId || closeButton?.dataset.targetId;
  if (!targetId || !state.openTabs.includes(targetId)) return;
  state.focusedTabId = targetId;
  dom.tabs.querySelectorAll(".tab-hit").forEach((tab) => {
    tab.tabIndex = tab.dataset.targetId === targetId ? 0 : -1;
  });
});

function openTab(targetId) {
  if (!state.openTabs.includes(targetId)) state.openTabs = [targetId, ...state.openTabs].slice(0, 8);
}

function closeTab(targetId) {
  const index = state.openTabs.indexOf(targetId);
  if (index === -1) return;
  state.openTabs = state.openTabs.filter((item) => item !== targetId);
  if (state.activeId === targetId) {
    const next = state.openTabs[Math.min(index, state.openTabs.length - 1)];
    if (next) {
      openTarget(next, { keepTabs: true });
      return;
    }
    state.activeId = null;
    const closedMobileDetail = mobileDetailQuery.matches;
    if (closedMobileDetail) {
      setSidebarVisible(true);
      setDetailOpen(false);
    }
    renderAll();
    focusAfterTabClose(targetId);
  } else {
    renderTabs();
  }
}

/* ---------------------------------------------------------------- */
/* Editor rendering                                                  */
/* ---------------------------------------------------------------- */

function breadcrumb(parts) {
  const nav = el("nav", "breadcrumb");
  nav.setAttribute("aria-label", "Đường dẫn");
  parts.forEach((part, index) => {
    if (index) nav.append(icon("chevron-right"));
    nav.append(el("span", index === parts.length - 1 ? "crumb-current" : "", part));
  });
  return nav;
}

function docHead({ title, subtitle, mark, badges, actions }) {
  const head = el("header", "doc-head");
  const back = el("button", "detail-back");
  back.type = "button";
  back.setAttribute("aria-label", "Quay lại danh sách");
  back.title = "Quay lại danh sách";
  back.append(icon("chevron-left"));
  back.addEventListener("click", () => {
    if (mobileDetailQuery.matches) setSidebarVisible(true);
    setDetailOpen(false);
    focusActiveSidebarRow();
  });
  head.append(back);
  head.append(el("div", "doc-mark", mark));
  const copy = el("div", "doc-title");
  copy.append(el("h1", "", title));
  if (subtitle) copy.append(el("p", "doc-sub", subtitle));
  if (badges && badges.length) {
    const row = el("div", "doc-actions");
    for (const badge of badges) row.append(badge);
    copy.append(row);
  }
  head.append(copy);
  if (actions && actions.length) {
    const row = el("div", "doc-actions");
    for (const action of actions) row.append(action);
    head.append(row);
  }
  return head;
}

function badge(text, kind, iconName) {
  const node = el("span", "badge", text);
  node.dataset.kind = kind || "";
  if (iconName) node.prepend(icon(iconName));
  return node;
}

function codeBlock(rows) {
  const block = el("div", "code-block");
  for (const row of rows) {
    const line = el("div", "code-line");
    line.append(el("span", "code-key", row.key));
    const value = el("span", `code-val${row.plain ? " is-plain" : ""}${row.muted ? " is-muted" : ""}`, row.value);
    line.append(value);
    if (row.copyable && row.copyText) {
      const copy = el("button", "code-copy");
      copy.type = "button";
      copy.title = "Sao chép";
      copy.setAttribute("aria-label", `Sao chép ${row.key}`);
      copy.append(icon("copy"));
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(row.copyText);
          copy.title = "Đã sao chép";
          setStatus(`Đã sao chép ${row.key}.`, "success");
        } catch (error) {
          setStatus("Trình duyệt chặn clipboard. Hãy chọn và sao chép thủ công.", "warning");
        }
      });
      line.append(copy);
    } else {
      line.append(el("span"));
    }
    block.append(line);
  }
  return block;
}

function section(title, iconName, children) {
  const wrap = el("section", "doc-section");
  const heading = el("h2");
  heading.append(icon(iconName), el("span", "", title));
  wrap.append(heading);
  for (const child of [].concat(children)) {
    if (child) wrap.append(child);
  }
  return wrap;
}

function kvList(entries) {
  const dl = el("dl", "kv");
  for (const [term, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    const row = el("div");
    row.append(el("dt", "", term));
    const dd = el("dd");
    if (value instanceof Node) dd.append(value);
    else dd.textContent = String(value);
    row.append(dd);
    dl.append(row);
  }
  return dl;
}

function chipList(values, emptyLabel) {
  if (!values || !values.length) return el("p", "muted", emptyLabel);
  const list = el("ul", "chip-list");
  for (const value of values) {
    const li = el("li");
    li.append(el("span", "chip", value));
    list.append(li);
  }
  return list;
}

/* ---------------------------------------------------------------- */
/* Provider detail                                                   */
/* ---------------------------------------------------------------- */

function keyStatusLabel(provider) {
  if (provider.keySaved === true) return "Đã lưu key";
  if (provider.keySaved === false) return "Chưa lưu key";
  return "Không đọc được trạng thái key";
}

function providerActions(provider) {
  const actions = [];
  const keyButton = el("button", "button", provider.keySaved === true ? "Quản lý API key" : "Lưu API key");
  keyButton.type = "button";
  keyButton.addEventListener("click", () => {
    const keySection = dom.content.querySelector(".doc-section[data-key-section]");
    if (!keySection) return;
    keySection.scrollIntoView({ block: "start", behavior: "auto" });
    keySection.querySelector("h2")?.focus({ preventScroll: true });
  });
  actions.push(keyButton);
  if (provider.keyUrl) actions.push(safeLink("Trang provider", provider.keyUrl, "button button-secondary"));
  if (provider.quotaUrl) actions.push(safeLink("Trang quota", provider.quotaUrl, "button button-secondary"));
  if (provider.sourceUrl) actions.push(safeLink("Nguồn dữ liệu", provider.sourceUrl, "button button-quiet"));
  return actions;
}

function keyForm(provider) {
  const form = el("form", "entry-form");
  form.dataset.keyEntryForm = "";
  form.append(el("h3", "", "Lưu API key"));
  const secret = field("API key", `secret-${provider.id}`, {
    type: "password",
    required: true,
    placeholder: "Dán key của bạn — không hiển thị lại sau khi lưu",
    maxLength: 512
  });
  const overwrite = checkLine("Ghi đè key đã có trong kho bảo mật của hệ điều hành", `overwrite-${provider.id}`);
  const hint = el("p", "form-hint", "Key đi thẳng vào credential store của Windows. Dashboard không đọc lại, không ghi log và không hiển thị giá trị key.");
  const result = el("p", "form-result");
  result.setAttribute("role", "status");
  const actions = el("div", "form-actions");
  actions.append(actionButton("Lưu vào kho bảo mật", "button", "shield"));
  form.append(secret.wrap, overwrite.wrap, hint, actions, result);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    result.textContent = "Đang lưu key…";
    result.dataset.kind = "";
    try {
      const payload = await api(`/api/keys/${encodeURIComponent(provider.id)}`, {
        method: "POST",
        body: JSON.stringify({ secret: secret.input.value, overwrite: overwrite.input.checked })
      });
      result.textContent = payload.message || "Đã lưu key vào kho bảo mật của hệ điều hành.";
      result.dataset.kind = "success";
      secret.input.value = "";
      markProviderSaved(provider.id);
      setStatus(`${provider.name}: ${result.textContent}`, "success");
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "Không lưu được key.";
      result.dataset.kind = "error";
      setStatus(`${provider.name}: ${result.textContent}`, "error");
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}

function provisionForm(provider) {
  const form = el("form", "entry-form");
  form.append(el("h3", "", "Tạo API key qua API chính thức"));

  const fields = {};
  const secretInputs = [];
  const addField = (key, label, options) => {
    fields[key] = field(label, `${key}-${provider.id}`, options);
    if (options.secret) {
      fields[key].input.autocomplete = "new-password";
      fields[key].input.autocapitalize = "off";
      fields[key].input.spellcheck = false;
      secretInputs.push(fields[key].input);
    }
    form.append(fields[key].wrap);
  };

  addField("name", "Tên key (tuỳ chọn)", {
    placeholder: "FreeModel Lab",
    maxLength: provider.provisioner === "gemini" ? 63 : 120
  });

  let warning = "Yêu cầu chỉ tạo API key trong tài khoản provider bạn đã đăng nhập. FreeModel Lab không tạo tài khoản, không đọc cookie và không tự động đăng ký dịch vụ.";
  if (provider.provisioner === "gemini") {
    addField("project", "Google Cloud project ID", {
      required: true,
      maxLength: 30,
      placeholder: "my-project-123"
    });
    addField("serviceAccountEmail", "Email service account đã có", {
      type: "email",
      required: true,
      placeholder: "service-account@my-project.iam.gserviceaccount.com"
    });
    warning = "Cần đăng nhập gcloud và service account đã tồn tại trong project. Key được giới hạn vào Gemini API; ứng dụng không tạo tài khoản hoặc service account.";
  } else if (provider.provisioner === "cloudflare") {
    addField("accountId", "Cloudflare account ID", {
      required: true,
      maxLength: 32,
      placeholder: "32 ký tự hex"
    });
    addField("bootstrapToken", "Bootstrap API token", {
      type: "password",
      secret: true,
      required: true,
      maxLength: 16_384,
      placeholder: "Token có quyền Account API Tokens Write"
    });
    addField("expiresOn", "Hết hạn (tuỳ chọn)", {
      type: "datetime-local"
    });
    warning = "Bootstrap token chỉ được dùng để yêu cầu token Workers AI với quyền tối thiểu cần thiết; token này không được lưu. Hãy đặt thời hạn nếu phù hợp.";
  } else if (provider.provisioner === "openrouter") {
    addField("managementKey", "OpenRouter management key", {
      type: "password",
      secret: true,
      required: true,
      maxLength: 16_384,
      placeholder: "Nhập management key từ tài khoản của bạn"
    });
    addField("monthlyLimitUsd", "Trần chi tiêu hàng tháng (USD)", {
      type: "number",
      required: true,
      min: "0.01",
      step: "0.01",
      placeholder: "1.00"
    });
    warning = "Tạo key có trần chi tiêu dương. Provider có thể tính phí nếu bạn chọn model trả phí; chỉ chọn model free nếu muốn tránh khoản phí đó.";
  }

  const hint = el("p", "form-hint form-warning", warning);
  const overwrite = checkLine("Cho phép thay key đang lưu trong kho bảo mật", `provision-overwrite-${provider.id}`);
  const consent = checkLine("Tôi xác nhận gửi yêu cầu tạo key đến API chính thức của provider", `provision-consent-${provider.id}`);
  consent.input.required = true;
  const result = el("p", "form-result");
  result.setAttribute("role", "status");
  const actions = el("div", "form-actions");
  actions.append(actionButton("Tạo và lưu key", "button button-secondary", "sparkle"));
  form.append(hint, overwrite.wrap, consent.wrap, actions, result);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    result.textContent = "Đang gửi yêu cầu tạo key…";
    result.dataset.kind = "";
    try {
      const body = {
        name: fields.name.input.value,
        overwrite: overwrite.input.checked
      };
      if (provider.provisioner === "gemini") {
        body.project = fields.project.input.value;
        body.serviceAccountEmail = fields.serviceAccountEmail.input.value;
      } else if (provider.provisioner === "cloudflare") {
        body.accountId = fields.accountId.input.value;
        body.bootstrapToken = fields.bootstrapToken.input.value;
        body.expiresOn = fields.expiresOn.input.value
          ? new Date(fields.expiresOn.input.value).toISOString()
          : "";
      } else if (provider.provisioner === "openrouter") {
        body.managementKey = fields.managementKey.input.value;
        body.monthlyLimitUsd = Number(fields.monthlyLimitUsd.input.value);
      }
      const payload = await api(`/api/provision/${encodeURIComponent(provider.id)}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      result.textContent = [payload.message, payload.endpoint ? `Endpoint: ${payload.endpoint}` : ""]
        .filter(Boolean)
        .join(" ");
      result.dataset.kind = "success";
      markProviderSaved(provider.id);
      setStatus(`${provider.name}: ${result.textContent}`, "success");
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "Không tạo được API key.";
      result.dataset.kind = "error";
      setStatus(`${provider.name}: ${result.textContent}`, "error");
    } finally {
      for (const input of secretInputs) input.value = "";
      submit.disabled = false;
    }
  });
  return form;
}

function keyStatusPanel(provider) {
  const wrap = el("div", "entry-form");
  wrap.dataset.keyStatusPanel = "";
  wrap.append(el("h3", "", "Trạng thái key"));
  const result = el("p", "form-result");
  result.setAttribute("role", "status");
  const actions = el("div", "form-actions");
  const checkButton = el("button", "button button-secondary");
  checkButton.type = "button";
  checkButton.append(icon("key"), el("span", "", "Kiểm tra key"));
  actions.append(checkButton);
  wrap.append(el("p", "form-hint", keyStatusLabel(provider)), actions, result);
  checkButton.addEventListener("click", async () => {
    checkButton.disabled = true;
    result.textContent = "Đang kiểm tra kho bảo mật…";
    result.dataset.kind = "";
    try {
      // The server exposes authoritative key state through GET /api/providers
      // (keySaved comes straight from the OS credential store); there is no
      // separate status route, so re-read the provider list to refresh state.
      const data = await api("/api/providers");
      const fresh = (data.providers || []).find((item) => item.id === provider.id);
      if (fresh) provider.keySaved = fresh.keySaved === true ? true : (fresh.keySaved === false ? false : provider.keySaved);
      const saved = provider.keySaved === true;
      const unknown = provider.keySaved !== true && provider.keySaved !== false;
      result.textContent = saved
        ? "Key đã có trong kho bảo mật."
        : (unknown ? "Không đọc được trạng thái key." : "Chưa tìm thấy key cho provider này.");
      result.dataset.kind = saved ? "success" : (unknown ? "" : "error");
      // Refresh the sidebar and header badge without rebuilding this panel,
      // which would detach the result node we just wrote to.
      renderSidebar();
      renderStatusKeys();
      syncProviderKeyBadge(provider);
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "Không đọc được trạng thái key.";
      result.dataset.kind = "error";
    } finally {
      checkButton.disabled = false;
    }
  });
  return wrap;
}

function renderProvider(provider) {
  const doc = el("article", "doc");
  const official = provider.catalogSource !== "upstream";
  doc.append(breadcrumb(["FreeModel Lab", "Danh mục", provider.name]));
  doc.append(
    docHead({
      title: provider.name,
      subtitle: provider.id,
      mark: providerInitial(provider),
      badges: [
        badge(official ? "Nguồn chính thức" : "Upstream chưa xác minh", official ? "official" : "upstream", official ? "ok" : "warn"),
        provider.keySaved === true ? badge("Key đã lưu", "saved", "key") : null,
        badge(providerCategoryLabel(provider.category), "local", null)
      ].filter(Boolean),
      actions: providerActions(provider)
    })
  );

  const metadata = codeBlock([
    { key: "Mã provider", value: provider.id, copyable: true, copyText: provider.id },
    { key: "Loại", value: providerCategoryLabel(provider.category), plain: true },
    { key: "Endpoint", value: provider.endpoint, copyable: true, copyText: provider.endpoint },
    provider.endpointNeedsAccountId ? { key: "Account ID", value: "Cần account ID trong endpoint", plain: true } : null,
    { key: "Ngày xác minh", value: formatSourceDate(provider.verifiedAt), plain: true },
    provider.addedAt ? { key: "Ngày thêm", value: formatSourceDate(provider.addedAt), plain: true } : null
  ].filter(Boolean));

  const quota = provider.quota || {};
  doc.append(
    section("Quota công bố", "checklist", [
      el("p", "", quota.summary || "Provider chưa công bố quota free."),
      kvList([
        ["Phạm vi", quota.scope],
        ["Chu kỳ đặt lại", quota.reset],
        ["Model free", quota.models && quota.models.length ? chipList(quota.models) : ""],
        ["Ghi chú", quota.notes && quota.notes.length ? quota.notes.join(" ") : ""]
      ]),
      el(
        "p",
        "muted",
        official
          ? `Số liệu quota được rà soát ${formatSourceDate(provider.verifiedAt)}. Dashboard không gửi model request để suy ra quota.`
          : "Đây là dữ liệu upstream chưa được FreeModel Lab xác minh. Mở trang provider để đối chiếu trước khi dùng."
      )
    ])
  );

  const keySection = section("Bảo mật và API key", "shield", [
    keyStatusPanel(provider),
    keyForm(provider),
    el("p", "muted security-note", "Dashboard chỉ bind 127.0.0.1. Key không được trả qua API hoặc ghi vào log.")
  ]);
  keySection.dataset.keySection = "";
  keySection.querySelector("h2").tabIndex = -1;
  doc.append(keySection);
  if (provider.provisioner) {
    doc.append(section("Tạo key", "sparkle", [provisionForm(provider)]));
  }

  doc.append(section("Thông tin kỹ thuật", "info", [metadata]));

  doc.append(
    section("Nguồn", "link", [
      kvList([
        ["Trang provider", provider.keyUrl ? safeLink(provider.keyUrl, provider.keyUrl, "text-link", false) : ""],
        ["Trang quota", provider.quotaUrl ? safeLink(provider.quotaUrl, provider.quotaUrl, "text-link", false) : ""],
        ["Nguồn dữ liệu", provider.sourceUrl ? safeLink(provider.sourceUrl, provider.sourceUrl, "text-link", false) : ""],
        ["Nguồn danh mục", provider.catalogSource === "upstream" ? "Nguồn upstream" : "Tích hợp sẵn"]
      ])
    ])
  );
  return doc;
}

/* ---------------------------------------------------------------- */
/* Candidate detail                                                  */
/* ---------------------------------------------------------------- */

function renderCandidate(provider) {
  const doc = el("article", "doc");
  const keyUrl = provider.keyUrl;
  doc.append(breadcrumb(["FreeModel Lab", "Nguồn provider mới", provider.name]));
  doc.append(
    docHead({
      title: provider.name,
      subtitle: provider.id,
      mark: providerInitial(provider),
      badges: [badge("Ứng viên upstream", "upstream", "warn"), badge(providerCategoryLabel(provider.category), "local", null)],
      actions: keyUrl ? [safeLink("Trang provider", keyUrl, "button button-secondary")] : []
    })
  );

  const quota = provider.quota || {};
  doc.append(
    section("Thông tin upstream", "info", [
      el("p", "", quota.summary || "Upstream chưa mô tả quota cho provider này."),
      kvList([
        ["Phạm vi", quota.scope],
        ["Chu kỳ đặt lại", quota.reset],
        ["Model free", quota.models && quota.models.length ? chipList(quota.models) : ""],
        ["Ghi chú", quota.notes && quota.notes.length ? quota.notes.join(" ") : ""]
      ]),
      el("p", "muted", "Ứng viên chưa được FreeModel Lab xác minh độc lập. Chỉ thêm vào danh mục sau khi bạn tự kiểm tra trang provider.")
    ])
  );

  doc.append(
    section("Thông tin kỹ thuật", "info", [
      codeBlock([
        { key: "Mã provider", value: provider.id, copyable: true, copyText: provider.id },
        { key: "Loại", value: providerCategoryLabel(provider.category), plain: true },
        { key: "Endpoint", value: provider.endpoint, copyable: true, copyText: provider.endpoint },
        { key: "Ngày xác minh", value: formatSourceDate(provider.verifiedAt), plain: true }
      ])
    ])
  );

  const form = el("form", "entry-form");
  form.append(el("h3", "", "Thêm vào danh mục"));
  const result = el("p", "form-result");
  result.setAttribute("role", "status");
  const actions = el("div", "form-actions");
  const importButton = actionButton("Thêm vào danh mục", "button", "plus");
  actions.append(importButton);
  if (keyUrl) actions.append(safeLink("Mở trang provider", keyUrl, "button button-secondary"));
  form.append(el("p", "form-hint", "Endpoint được lưu ở metadata cục bộ. API key vẫn phải lưu riêng trong kho bảo mật của hệ điều hành."), actions, result);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    importButton.disabled = true;
    result.textContent = "Đang thêm provider…";
    result.dataset.kind = "";
    try {
      await api(`/api/providers/import/${encodeURIComponent(provider.id)}`, { method: "POST", body: "{}" });
      result.textContent = `${provider.name} đã được thêm. Endpoint lưu ở metadata cục bộ; API key có thể lưu trong kho bảo mật của hệ điều hành.`;
      result.dataset.kind = "success";
      state.openTabs = state.openTabs.filter((tab) => tab !== `candidate:${provider.id}`);
      state.activeId = provider.id;
      await loadProviders(false);
      openTab(provider.id);
      setStatus(`${provider.name} đã được thêm vào danh mục.`, "success");
      renderAll();
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "Không thêm được provider.";
      result.dataset.kind = "error";
      setStatus(error instanceof Error ? error.message : "Không thêm được provider.", "error");
    } finally {
      importButton.disabled = false;
    }
  });
  doc.append(section("Nhập vào danh mục", "plus", [form]));
  doc.append(section("Nguồn", "link", [kvList([["Nguồn upstream", provider.sourceUrl ? safeLink(provider.sourceUrl, provider.sourceUrl, "text-link", false) : ""]])]));
  return doc;
}

/* ---------------------------------------------------------------- */
/* Welcome                                                           */
/* ---------------------------------------------------------------- */

function renderWelcome() {
  const visibleProviders = state.providers.filter((provider) =>
    matchesCategory(provider) &&
    matchesFilter(provider.name, provider.id, provider.category, provider.endpoint, provider.quota && provider.quota.summary)
  );
  const officialCount = state.providers.filter((provider) => provider.catalogSource !== "upstream").length;
  const pendingCount = state.providers.length - officialCount;
  const doc = el("article", "welcome catalog-home");
  doc.append(catalogIntro(
    "DANH MỤC LLM",
    "Provider LLM miễn phí",
    "Đọc quota free đã công bố, phạm vi, model, endpoint và nguồn. Số dư tài khoản chỉ hiển thị sau lần làm mới do bạn yêu cầu."
  ));
  doc.append(catalogSectionHeading("Nhà cung cấp", `${visibleProviders.length} kết quả`));
  doc.append(renderCatalogGrid(
    visibleProviders,
    "provider",
    state.providersLoaded ? "Không tìm thấy provider phù hợp." : "Đang tải danh mục provider…"
  ));
  doc.append(catalogSafetyNote(
    "Quota phụ thuộc model và tài khoản provider. Dashboard không gửi yêu cầu tới model; API key chỉ được lưu khi bạn chủ động yêu cầu."
  ));
  return doc;
}

function catalogIntro(eyebrow, title, description) {
  const intro = el("header", "catalog-intro");
  intro.append(el("p", "catalog-eyebrow", eyebrow));
  intro.append(el("h1", "", title));
  intro.append(el("p", "catalog-intro-copy", description));
  return intro;
}

function catalogStats(items) {
  const sectionNode = el("section", "catalog-stats");
  sectionNode.setAttribute("aria-label", "Tổng quan");
  for (const [value, label] of items) {
    const stat = el("div", "catalog-stat");
    stat.append(el("span", "catalog-stat-value", value));
    stat.append(el("span", "catalog-stat-label", label));
    sectionNode.append(stat);
  }
  return sectionNode;
}

function catalogSectionHeading(title, count) {
  const heading = el("div", "catalog-section-heading");
  heading.append(el("h2", "", title));
  const resultCount = el("p", "catalog-result-count", count);
  resultCount.setAttribute("aria-live", "polite");
  heading.append(resultCount);
  return heading;
}

function renderCatalogGrid(items, kind, emptyMessage) {
  const list = el("ul", "catalog-grid");
  if (!items.length) {
    const empty = el("li", "catalog-empty", emptyMessage);
    empty.setAttribute("role", "status");
    list.append(empty);
    return list;
  }
  for (const item of items) {
    const listItem = el("li", "catalog-grid-item");
    listItem.append(renderCatalogCard(item, kind));
    list.append(listItem);
  }
  return list;
}

function renderCatalogCard(provider, kind) {
  const candidate = kind === "candidate";
  const unverified = candidate || provider.catalogSource === "upstream";
  const quota = provider.quota || {};
  const card = el("article", candidate ? "catalog-card is-candidate" : "catalog-card");
  card.dataset.category = provider.category || "inference";
  card.dataset.providerId = provider.id;

  const top = el("div", "catalog-card-top");
  const mark = el("span", "catalog-mark", providerInitial(provider));
  mark.setAttribute("aria-hidden", "true");
  top.append(mark);
  top.append(unverified
    ? badge("Chờ xác minh", "upstream", "warn")
    : badge("Nguồn chính thức", "official", "shield"));
  card.append(top);

  card.append(el("h2", "catalog-card-title", provider.name));
  card.append(el("code", "catalog-card-id", provider.id));

  const meta = el("div", "catalog-card-meta");
  meta.append(el("span", "catalog-type", providerCategoryLabel(provider.category)));
  const modelCount = Array.isArray(provider.quota && provider.quota.models)
    ? provider.quota.models.length
    : 0;
  if (modelCount) {
    meta.append(el("span", "catalog-model-count", `${modelCount} model tham khảo`));
  }
  card.append(meta);

  const quotaPanel = el("section", "catalog-card-quota");
  quotaPanel.setAttribute("aria-label", unverified ? "Quota đang chờ xác minh" : `Quota công bố của ${provider.name}`);
  const quotaHeading = el("div", "catalog-card-quota-heading");
  quotaHeading.append(el("span", "catalog-card-quota-label", unverified ? "Quota chưa xác minh" : "Quota công bố"));
  if (!unverified) quotaHeading.append(el("span", "catalog-card-live-note", "Sử dụng hiện tại: chưa đọc"));
  quotaPanel.append(quotaHeading);
  quotaPanel.append(el("p", "catalog-card-quota-summary", quota.summary || (unverified
    ? "Chưa có thông tin quota được đối chiếu với nguồn chính thức."
    : "Provider chưa công bố mức quota miễn phí cụ thể.")));
  if (unverified) {
    quotaPanel.append(el("p", "catalog-card-unverified-note", "Đối chiếu điều kiện miễn phí và quota trên tài liệu chính thức trước khi sử dụng."));
  }

  const quotaFacts = el("div", "catalog-card-facts");
  if (quota.scope) quotaFacts.append(catalogCardFact("Phạm vi", quota.scope));
  if (quota.reset) quotaFacts.append(catalogCardFact("Chu kỳ", quota.reset));
  quotaFacts.append(catalogCardFact("Nguồn", catalogSourceHost(provider)));
  if (quotaFacts.childElementCount) quotaPanel.append(quotaFacts);

  if (Array.isArray(quota.models) && quota.models.length) {
    const modelSection = el("div", "catalog-card-models");
    modelSection.append(el("span", "catalog-card-detail-label", "Model được nêu"));
    const modelList = el("ul", "catalog-card-model-list");
    for (const model of quota.models.slice(0, 3)) {
      const item = el("li", "catalog-card-model");
      item.append(el("code", "", model));
      modelList.append(item);
    }
    if (quota.models.length > 3) {
      const more = el("li", "catalog-card-model-more", `+${quota.models.length - 3} model trong chi tiết`);
      modelList.append(more);
    }
    modelSection.append(modelList);
    quotaPanel.append(modelSection);
  }

  if (provider.endpoint) {
    const endpoint = el("div", "catalog-card-endpoint");
    endpoint.append(el("span", "catalog-card-detail-label", "Endpoint"));
    const endpointValue = el("code", "catalog-card-endpoint-value", provider.endpoint);
    endpointValue.title = provider.endpoint;
    endpoint.append(endpointValue);
    quotaPanel.append(endpoint);
  }
  card.append(quotaPanel);

  const footer = el("div", "catalog-card-footer");
  const statusGroup = el("div", "catalog-card-status-group");
  const keyStatus = el("span", "catalog-card-status");
  const keyState = unverified ? "pending" : keyStateOf(provider);
  keyStatus.dataset.state = keyState;
  keyStatus.textContent = unverified
    ? "Chờ xác minh"
    : ({ saved: "Key đã lưu", missing: "Chưa có key", unknown: "Kho key chưa sẵn sàng" }[keyState]);
  statusGroup.append(keyStatus);

  const verification = el("span", "catalog-card-verified");
  if (unverified) {
    verification.textContent = "Nguồn cộng đồng · chưa đối chiếu";
  } else if (provider.verifiedAt) {
    const verifiedDate = new Date(`${provider.verifiedAt}T00:00:00Z`);
    const isStale = Number.isFinite(verifiedDate.getTime()) && Date.now() - verifiedDate.getTime() > STALE_WINDOW_MS;
    const time = el("time", "", `${isStale ? "Cần rà soát · " : "Rà soát "}${formatSourceDate(provider.verifiedAt)}`);
    time.dateTime = provider.verifiedAt;
    if (isStale) time.dataset.stale = "true";
    verification.append(time);
  } else {
    verification.textContent = "Chưa có ngày rà soát";
  }
  statusGroup.append(verification);
  footer.append(statusGroup);

  const action = el("button", "catalog-card-action");
  action.type = "button";
  action.setAttribute("aria-label", `${candidate ? "Xem ứng viên" : "Mở chi tiết"} ${provider.name}`);
  action.append(el("span", "", candidate ? "Kiểm tra nguồn" : "Xem chi tiết"), icon("chevron-right"));
  action.addEventListener("click", () => openTarget(candidate ? `candidate:${provider.id}` : provider.id));
  footer.append(action);
  card.append(footer);
  return card;
}

function catalogCardFact(label, value) {
  const fact = el("div", "catalog-card-fact");
  fact.append(el("span", "catalog-card-detail-label", label));
  fact.append(el("span", "catalog-card-fact-value", value));
  return fact;
}

function catalogSourceHost(provider) {
  try {
    return new URL(provider.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Chưa có nguồn công khai";
  }
}

function catalogSafetyNote(message, kind = "info") {
  const note = el("aside", `catalog-safety-note is-${kind}`);
  note.append(icon(kind === "warning" ? "warn" : "shield"));
  note.append(el("p", "", message));
  return note;
}

function renderDiscoverWelcome() {
  const candidates = state.candidates.filter((candidate) =>
    matchesCategory(candidate) && matchesFilter(candidate.name, candidate.id, candidate.category)
  );
  const doc = el("article", "welcome catalog-home discover-home");
  doc.append(catalogIntro(
    "NGUỒN CỘNG ĐỒNG",
    "Ứng viên provider",
    "Danh sách từ nguồn upstream. Đối chiếu quota và điều kiện sử dụng trên trang provider trước khi thêm vào danh mục."
  ));
  doc.append(catalogStats([
    [String(state.candidates.length), "ứng viên upstream"],
    [formatSourceDate(state.sourceUpdatedAt), "ngày cập nhật nguồn"],
    [String(state.candidates.length), "chưa xác minh độc lập"]
  ]));
  doc.append(catalogSectionHeading("Nguồn mới", `${candidates.length} kết quả`));
  doc.append(renderCatalogGrid(
    candidates,
    "candidate",
    state.catalogBusy ? "Đang tải danh sách ứng viên…" : "Không tìm thấy ứng viên phù hợp."
  ));
  doc.append(catalogSafetyNote(
    "Ứng viên upstream chưa được xác minh. Chỉ thêm provider sau khi kiểm tra quota, endpoint và điều khoản của nhà cung cấp.",
    "warning"
  ));
  return doc;
}

function renderHelpWelcome() {
  const doc = el("article", "welcome help-home");
  doc.append(catalogIntro(
    "HƯỚNG DẪN",
    "Thiết lập provider an toàn",
    "Dùng nguồn chính thức để kiểm tra quota và tạo API key. FreeModel Lab không đăng nhập thay bạn và không gửi yêu cầu tới model."
  ));
  const steps = el("ol", "help-steps");
  const entries = [
    ["01", "Kiểm tra nguồn", "Xem ngày xác minh, quota được công bố và các giới hạn theo model/tài khoản."],
    ["02", "Lưu API key", "Nhập key do bạn tự tạo. Key được chuyển vào kho bảo mật của hệ điều hành."],
    ["03", "Kết nối endpoint", "Sao chép endpoint và mã provider để cấu hình ứng dụng của bạn."]
  ];
  for (const [number, title, description] of entries) {
    const step = el("li", "help-step");
    step.append(el("span", "help-step-number", number));
    step.append(el("h2", "", title));
    step.append(el("p", "", description));
    steps.append(step);
  }
  doc.append(steps);
  doc.append(catalogSafetyNote(
    "API key không được đọc lại để hiển thị, ghi vào log hay gửi tới dashboard API. Server chỉ lắng nghe trên 127.0.0.1."
  ));
  return doc;
}

/* ---------------------------------------------------------------- */
/* Routing                                                           */
/* ---------------------------------------------------------------- */

function openTarget(targetId, options = {}) {
  state.activeId = targetId;
  if (!options.keepTabs) openTab(targetId);
  if (state.openTabs.includes(targetId)) state.focusedTabId = targetId;
  if (targetId.startsWith("candidate:")) {
    state.view = "discover";
  } else if (targetId !== "welcome") {
    state.view = "providers";
  }
  if (options.fromSidebar && mobileDetailQuery.matches) setSidebarVisible(false);
  setDetailOpen(true);
  renderAll();
  if (options.fromSidebar || mobileDetailQuery.matches) {
    const tab = Array.from(dom.tabs.querySelectorAll(".tab-hit"))
      .find((item) => item.dataset.targetId === targetId);
    tab?.focus();
  }
  if (options.fromSidebar && window.matchMedia("(max-width: 900px)").matches) {
    dom.content.scrollIntoView({ block: "start" });
  }
}

function setDetailOpen(open) {
  dom.workbench.classList.toggle("detail-open", open);
  syncEditorInteractivity();
}

function focusActiveSidebarRow(targetId = state.activeId) {
  const row = Array.from(document.querySelectorAll(".tree-row"))
    .find((item) => item.dataset.targetId === targetId);
  row?.focus();
}

function focusAfterTabClose(targetId) {
  const row = Array.from(document.querySelectorAll(".tree-row"))
    .find((item) => item.dataset.targetId === targetId);
  if (row && !row.closest("[hidden]") && !dom.workbench.classList.contains("sidebar-hidden")) {
    row.focus();
    return;
  }
  const activeView = Array.from(document.querySelectorAll(".view-tab"))
    .find((item) => item.getAttribute("aria-pressed") === "true");
  if (activeView) activeView.focus();
  else dom.sidebarFilter.focus();
}

function syncEditorInteractivity() {
  const mobile = mobileDetailQuery.matches;
  const detailOpen = dom.workbench.classList.contains("detail-open");
  const hidden = mobile && !detailOpen;
  const sidebarCovered = mobile && detailOpen;
  const focusWasInSidebar = dom.sidebar.contains(document.activeElement);
  const focusWasInEditor = dom.editor.contains(document.activeElement);

  dom.editor.inert = hidden;
  if (sidebarCovered && focusWasInSidebar) dom.editor.focus({ preventScroll: true });
  dom.sidebar.inert = sidebarCovered;
  document.body.classList.toggle("mobile-detail-open", sidebarCovered);

  if (hidden && focusWasInEditor) focusActiveSidebarRow();
}

mobileDetailQuery.addEventListener("change", () => {
  if (mobileDetailQuery.matches) {
    setSidebarVisible(false);
    setDetailOpen(true);
  } else {
    restoreSidebar();
    setDetailOpen(false);
  }
});

function renderEditor() {
  if (!state.activeId) {
    const welcomeByView = {
      providers: renderWelcome,
      discover: renderDiscoverWelcome,
      help: renderHelpWelcome
    };
    dom.content.replaceChildren((welcomeByView[state.view] || renderWelcome)());
    return;
  }
  if (state.activeId.startsWith("candidate:")) {
    const id = state.activeId.slice("candidate:".length);
    const candidate = state.candidates.find((item) => item.id === id);
    dom.content.replaceChildren(candidate ? renderCandidate(candidate) : renderWelcome());
    return;
  }
  const provider = state.providers.find((item) => item.id === state.activeId);
  dom.content.replaceChildren(provider ? renderProvider(provider) : renderWelcome());
}

function renderStatusKeys() {
  const saved = state.providers.filter((provider) => provider.keySaved === true).length;
  dom.statusKeysText.textContent = `Key ${saved}/${state.providers.length}`;
}

function renderViewChrome() {
  const views = { providers: "Danh mục nhà cung cấp", discover: "Nguồn provider mới", help: "Trợ giúp" };
  dom.sidebarHeading.textContent = views[state.view] || "Chi tiết";
  dom.sidebarList.hidden = state.view !== "providers";
  dom.discoverView.hidden = state.view !== "discover";
  dom.helpView.hidden = state.view !== "help";
  dom.categoryFilters.hidden = state.view === "help";
  document.querySelectorAll(".activity-item, .view-tab").forEach((item) => {
    item.setAttribute("aria-pressed", String(item.dataset.view === state.view));
  });
}

function renderCategoryFilters() {
  dom.categoryFilters.querySelectorAll("[data-category-filter]").forEach((button) => {
    const active = button.dataset.categoryFilter === state.categoryFilter;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  });
}

function renderAll() {
  renderViewChrome();
  renderCategoryFilters();
  renderSidebar();
  renderDiscoverView();
  renderTabs();
  renderEditor();
  renderStatusKeys();
}

function setView(view) {
  state.view = view;
  if (view === "discover") {
    state.activeId = state.activeId && state.activeId.startsWith("candidate:") ? state.activeId : state.activeId;
  }
  renderAll();
  if (view === "discover" && !state.catalogLoaded && !state.catalogBusy) refreshCatalog();
}

/* ---------------------------------------------------------------- */
/* Data loading                                                      */
/* ---------------------------------------------------------------- */

function markProviderSaved(providerId) {
  const provider = state.providers.find((item) => item.id === providerId);
  if (provider) provider.keySaved = true;
  renderSidebar();
  renderStatusKeys();
  if (provider) syncProviderKeyBadge(provider);
}

function syncProviderKeyBadge(provider) {
  if (state.activeId !== provider.id) return;
  const badges = dom.content.querySelector(".doc-head .doc-title .doc-actions");
  if (!badges) return;
  let keyBadge = badges.querySelector(".provider-key-badge");
  if (provider.keySaved === true) {
    if (!keyBadge) {
      keyBadge = badge("Key đã lưu", "saved", "key");
      keyBadge.classList.add("provider-key-badge");
      badges.append(keyBadge);
    }
  } else {
    keyBadge?.remove();
  }
}

async function loadProviders(showLoading = true) {
  if (showLoading) setStatus("Đang đọc quota công bố và trạng thái key trên máy này…");
  try {
    const data = await api("/api/providers");
    state.providers = data.providers || [];
    state.providersLoaded = true;
    const officialProviders = state.providers.filter((provider) => provider.catalogSource !== "upstream");
    const upstreamCount = state.providers.length - officialProviders.length;
    const latest = officialProviders.map((provider) => provider.verifiedAt)
      .filter((date) => formatSourceDate(date) !== "chưa rõ")
      .sort()
      .at(-1) || "";
    dom.verifiedAt.textContent = latest ? formatSourceDate(latest) : "—";
    if (latest) dom.verifiedAt.setAttribute("datetime", latest);
    else dom.verifiedAt.removeAttribute("datetime");
    const staleCount = state.providers.filter((provider) => Date.now() - new Date(`${provider.verifiedAt}T00:00:00Z`).getTime() > STALE_WINDOW_MS).length;
    const summary = `${officialProviders.length} chính thức${upstreamCount ? ` · ${upstreamCount} chờ xác minh` : ""}${staleCount ? ` · ${staleCount} cần rà soát` : ""}.`;
    setStatus(summary, staleCount ? "warning" : "success");
    renderAll();
  } catch (error) {
    state.providersLoaded = true;
    setStatus(error instanceof Error ? error.message : "Không tải được dashboard.", "error");
  }
}

function setCatalogBusy(busy) {
  state.catalogBusy = busy;
  dom.refreshButton.disabled = busy;
  dom.refreshButton.classList.toggle("is-busy", busy);
}

function renderCatalogStatus(message, kind) {
  dom.catalogStatus.textContent = message;
  dom.catalogStatus.dataset.kind = kind || "";
}

async function refreshCatalog() {
  setCatalogBusy(true);
  renderCatalogStatus("Đang tải danh sách provider free từ upstream…");
  if (state.view === "discover") dom.discoverStatus.textContent = "Đang tải danh sách provider free từ upstream…";
  try {
    const data = await api("/api/catalog/refresh", { method: "POST", body: "{}" });
    state.candidates = data.candidates || [];
    state.catalogLoaded = true;
    state.sourceUpdatedAt = data.sourceUpdatedAt || "unknown";
    const displayDate = formatSourceDate(state.sourceUpdatedAt);
    const when = displayDate === "chưa rõ" ? "chưa rõ ngày" : displayDate;
    renderCatalogStatus(
      state.candidates.length ? `${state.candidates.length} ứng viên mới · nguồn cập nhật ${when}` : `Không có ứng viên mới · nguồn cập nhật ${when}`,
      "success"
    );
    renderAll();
  } catch (error) {
    state.catalogLoaded = true;
    const message = error instanceof Error ? error.message : "Không tải được danh sách upstream.";
    renderCatalogStatus(message, "error");
    if (state.view === "discover") dom.discoverStatus.textContent = message;
  } finally {
    setCatalogBusy(false);
  }
}

/* ---------------------------------------------------------------- */
/* Chrome: sidebar toggle, resizer, shortcuts                        */
/* ---------------------------------------------------------------- */

function setSidebarVisible(visible) {
  dom.workbench.classList.toggle("sidebar-hidden", !visible);
  dom.sidebarToggle.setAttribute("aria-pressed", String(visible));
  dom.sidebarToggle.classList.toggle("is-off", !visible);
  if (!mobileDetailQuery.matches) {
    try { localStorage.setItem(SIDEBAR_KEY, visible ? "open" : "closed"); } catch (error) { /* optional */ }
  }
}

function restoreSidebar() {
  let stored = null;
  let width = null;
  try {
    stored = localStorage.getItem(SIDEBAR_KEY);
    width = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  } catch (error) { /* optional */ }
  if (window.matchMedia("(min-width: 901px)").matches) setSidebarVisible(stored !== "closed");
  if (width) {
    const parsed = Number.parseInt(width, 10);
    if (Number.isFinite(parsed)) setSidebarWidth(parsed);
  }
  updateResizerAria();
}

dom.sidebarToggle.addEventListener("click", () => {
  const sidebarVisible = !dom.workbench.classList.contains("sidebar-hidden");
  setSidebarVisible(!sidebarVisible);
  if (mobileDetailQuery.matches) setDetailOpen(sidebarVisible);
});

function currentSidebarWidth() {
  const inlineWidth = dom.workbench.style.getPropertyValue("--sidebar-width");
  const themeWidth = window.getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width");
  const parsed = Number.parseInt(inlineWidth || themeWidth, 10);
  return Math.min(520, Math.max(220, Number.isFinite(parsed) ? parsed : 320));
}

function updateResizerAria() {
  const width = currentSidebarWidth();
  dom.resizer.setAttribute("aria-valuenow", String(width));
  dom.resizer.setAttribute("aria-valuetext", `${width} px`);
}

function setSidebarWidth(width) {
  const next = Math.min(520, Math.max(220, Math.round(Number(width))));
  dom.workbench.style.setProperty("--sidebar-width", `${next}px`);
  updateResizerAria();
}

function persistSidebarWidth() {
  try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(currentSidebarWidth())); } catch (error) { /* optional */ }
}

function startResize(startX) {
  const startWidth = currentSidebarWidth();
  const onMove = (event) => {
    const next = Math.min(520, Math.max(220, startWidth + (event.clientX - startX)));
    setSidebarWidth(next);
  };
  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    persistSidebarWidth();
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

dom.resizer.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  startResize(event.clientX);
});

dom.resizer.addEventListener("keydown", (event) => {
  const current = currentSidebarWidth();
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const next = Math.min(520, Math.max(220, current + (event.key === "ArrowRight" ? 16 : -16)));
    setSidebarWidth(next);
    persistSidebarWidth();
  }
});

document.querySelectorAll(".activity-item, .view-tab").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

dom.sidebarFilter.addEventListener("input", (event) => {
  state.filter = event.target.value;
  renderSidebar();
  renderDiscoverView();
  if (!state.activeId) renderEditor();
});

dom.categoryFilters.addEventListener("click", (event) => {
  const button = event.target instanceof Element
    ? event.target.closest("[data-category-filter]")
    : null;
  if (!button) return;
  state.categoryFilter = button.dataset.categoryFilter;
  renderCategoryFilters();
  renderSidebar();
  renderDiscoverView();
  if (!state.activeId) renderEditor();
});

dom.sidebarFilter.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    dom.sidebarFilter.value = "";
    state.filter = "";
    renderSidebar();
    renderDiscoverView();
    if (!state.activeId) renderEditor();
    dom.sidebarFilter.blur();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mobileDetailQuery.matches && dom.workbench.classList.contains("detail-open")) {
    event.preventDefault();
    setSidebarVisible(true);
    setDetailOpen(false);
    focusActiveSidebarRow();
  }
});

/* ---------------------------------------------------------------- */
/* Roving keyboard navigation                                       */
/*                                                                  */
/* Adds arrow/Home/End focus movement for the activity bar, the     */
/* sidebar tree rows, and the editor tabs. Activation (Enter/Space) */
/* is left to the native button click handlers, which already call  */
/* setView() / openTarget() — so aria-pressed / aria-selected stay  */
/* in sync without duplicating state. Browser shortcuts remain native. */
/* ---------------------------------------------------------------- */

function isFormField(node) {
  return node instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

function focusByOffset(items, current, offset) {
  const index = items.indexOf(current);
  if (index === -1 || !items.length) return;
  const next = (index + offset + items.length) % items.length;
  items[next].focus();
}

function siblingTreeRows(row) {
  const list = row.closest("ul.tree-items");
  if (!list) return [];
  return Array.from(list.querySelectorAll(".tree-row"));
}

document.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  if (isFormField(active)) return; // never hijack typing in the key form / filter

  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (mobileDetailQuery.matches && dom.workbench.classList.contains("detail-open")) setDetailOpen(false);
    if (dom.workbench.classList.contains("sidebar-hidden")) setSidebarVisible(true);
    if (state.view !== "providers") setView("providers");
    dom.sidebarFilter.focus();
    dom.sidebarFilter.select();
    return;
  }

  if (active instanceof HTMLElement && active.classList.contains("activity-item")) {
    const items = Array.from(document.querySelectorAll(".activity-item"));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusByOffset(items, active, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      const target = event.key === "Home" ? items[0] : items[items.length - 1];
      if (target) { event.preventDefault(); target.focus(); }
    }
    return; // Enter/Space activate via the native click → setView()
  }

  if (active instanceof HTMLElement && active.classList.contains("tree-row")) {
    const rows = siblingTreeRows(active);
    if (event.key === "ArrowDown") { event.preventDefault(); focusByOffset(rows, active, 1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); focusByOffset(rows, active, -1); return; }
    if (event.key === "Home") { event.preventDefault(); if (rows[0]) rows[0].focus(); return; }
    if (event.key === "End") { event.preventDefault(); if (rows[rows.length - 1]) rows[rows.length - 1].focus(); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); openTarget(active.dataset.targetId, { fromSidebar: true }); return; }
    return; // Enter/Space open via the native click → openTarget()
  }

  if (active instanceof HTMLElement && active.classList.contains("tab-hit")) {
    const tabs = Array.from(dom.tabs.querySelectorAll(".tab-hit"));
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      focusByOffset(tabs, active, event.key === "ArrowRight" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      const target = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
      if (target) { event.preventDefault(); target.focus(); }
    }
    return; // Enter/Space activate via the native click → openTarget()
  }
});

dom.refreshButton.addEventListener("click", () => refreshCatalog());

/* Keep the status icon in sync whenever kind changes. */
const statusObserver = new MutationObserver(() => refreshStatusIcon());
statusObserver.observe(dom.statusMessage, { attributes: true, attributeFilter: ["data-kind"] });

/* ---------------------------------------------------------------- */
/* Boot                                                              */
/* ---------------------------------------------------------------- */

applyTheme(currentTheme(), false);
restoreSidebar();
if (mobileDetailQuery.matches) {
  setSidebarVisible(false);
  dom.workbench.classList.add("detail-open");
}
syncEditorInteractivity();
renderAll();
loadProviders();
refreshCatalog();
