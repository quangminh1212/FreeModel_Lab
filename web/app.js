/* global localStorage, fetch, document, window, navigator */

const THEME_KEY = "freemodel-theme";
const SIDEBAR_KEY = "freemodel-sidebar";
const SIDEBAR_WIDTH_KEY = "freemodel-sidebar-width";
const STALE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const state = {
  providers: [],
  candidates: [],
  view: "providers",
  activeId: null,
  openTabs: [],
  filter: "",
  catalogLoaded: false,
  catalogBusy: false,
  sourceUpdatedAt: "unknown"
};

const dom = {
  workbench: document.querySelector("#workbench"),
  editor: document.querySelector(".editor"),
  sidebarHeading: document.querySelector("#sidebar-heading"),
  sidebarList: document.querySelector("#sidebar-list"),
  sidebarFilter: document.querySelector("#sidebar-filter"),
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
  content: document.querySelector("#content"),
  refreshButton: document.querySelector("#refresh"),
  themeToggle: document.querySelector("#theme-toggle"),
  themeIcon: document.querySelector("#theme-icon"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  resizer: document.querySelector("#sidebar-resizer"),
  statusMessage: document.querySelector("#status-message"),
  statusMessageText: document.querySelector("#status-message-text"),
  statusViewLabel: document.querySelector("#status-view-label"),
  statusView: document.querySelector("#status-view"),
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

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  const dark = next === "dark";
  dom.themeToggle.setAttribute("aria-pressed", String(!dark));
  dom.themeToggle.setAttribute("aria-label", dark ? "Bật giao diện sáng" : "Bật giao diện tối");
  dom.themeToggle.title = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
  dom.themeIcon.firstElementChild.setAttribute("href", dark ? "#i-moon" : "#i-sun");
  try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* storage optional */ }
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

function treeRow({ label, sublabel, caption, iconText, id, active, metaNodes, iconName }) {
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
  row.append(text);
  const meta = el("span", "tree-meta");
  for (const node of metaNodes) meta.append(node);
  row.append(meta);
  row.addEventListener("click", () => openTarget(id, { fromSidebar: true }));
  return row;
}

function renderProviderRows() {
  const providers = state.providers.filter((provider) =>
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
    const categoryLabel = provider.category === "router" ? "Định tuyến mô hình" : "API suy luận";

    return treeRow({
      label: provider.name,
      sublabel: provider.id,
      caption: modelCount ? `${categoryLabel} · ${modelCount} model miễn phí` : categoryLabel,
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
    dom.providersList.replaceChildren(el("li", "empty-state", state.filter ? "Không có provider khớp bộ lọc." : "Danh mục đang trống."));
    return;
  }
  const list = el("div");
  for (const node of nodes) {
    const li = el("li");
    li.append(node);
    list.append(li);
  }
  dom.providersList.replaceChildren(...list.childNodes);
}

function renderCandidateRows() {
  const candidates = state.candidates.filter((provider) => matchesFilter(provider.name, provider.id, provider.category, provider.endpoint));
  dom.treeCandidatesCount.textContent = String(state.candidates.length);
  if (!state.catalogLoaded) {
    dom.candidatesList.replaceChildren(el("li", "empty-state", "Đang tải ứng viên…"));
    return;
  }
  if (!candidates.length) {
    dom.candidatesList.replaceChildren(
      el("li", "empty-state", state.filter ? "Không có ứng viên khớp bộ lọc." : "Không có ứng viên mới. Bấm biểu tượng tải lại để cập nhật.")
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const candidate of candidates) {
    const li = el("li");
    li.append(
      treeRow({
        label: candidate.name,
        sublabel: candidate.id,
        iconText: providerInitial(candidate),
        iconName: "sparkle",
        id: `candidate:${candidate.id}`,
        active: state.activeId === `candidate:${candidate.id}`,
        metaNodes: [el("span", "tag-upstream", "mới")]
      })
    );
    fragment.append(li);
  }
  dom.candidatesList.replaceChildren(fragment);
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
    dom.discoverList.replaceChildren();
    return;
  }
  const candidates = state.candidates.filter((candidate) => matchesFilter(candidate.name, candidate.id, candidate.category));
  dom.discoverStatus.textContent = candidates.length
    ? `${candidates.length} ứng viên chưa xác minh. Nguồn cập nhật: ${formatSourceDate(state.sourceUpdatedAt)}.`
    : "Không còn ứng viên mới trong danh sách upstream.";
  const fragment = document.createDocumentFragment();
  for (const candidate of candidates) {
    const li = el("li");
    li.append(
      treeRow({
        label: candidate.name,
        sublabel: candidate.endpoint,
        iconText: providerInitial(candidate),
        iconName: "sparkle",
        id: `candidate:${candidate.id}`,
        active: state.activeId === `candidate:${candidate.id}`,
        metaNodes: [el("span", "tag-upstream", candidate.category === "router" ? "router" : "hosted")]
      })
    );
    fragment.append(li);
  }
  dom.discoverList.replaceChildren(fragment);
}

function formatSourceDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "chưa rõ";
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
  if (!state.openTabs.length) {
    dom.tabs.replaceChildren(el("span", "tabs-empty", "Chưa mở tab nào"));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const targetId of state.openTabs) {
    const active = state.activeId === targetId;
    const tab = el("div", active ? "tab is-active" : "tab");
    tab.setAttribute("role", "presentation");
    const button = el("button", "tab-hit");
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    button.append(icon(iconForTarget(targetId), "ico"));
    button.append(el("span", "tab-label", labelForTarget(targetId)));
    button.addEventListener("click", () => openTarget(targetId));
    const close = el("button", "tab-close");
    close.type = "button";
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
}

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
    if (closedMobileDetail) setDetailOpen(false);
    renderAll();
    if (closedMobileDetail) focusActiveSidebarRow(targetId);
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
  head.append(el("div", "doc-mark", mark));
  const copy = el("div", "doc-title");
  copy.append(el("h2", "", title));
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
  const heading = el("h3");
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
  if (provider.keyUrl) actions.push(safeLink("Trang provider", provider.keyUrl, "button button-secondary"));
  if (provider.quotaUrl) actions.push(safeLink("Trang quota", provider.quotaUrl, "button button-secondary"));
  if (provider.sourceUrl) actions.push(safeLink("Nguồn dữ liệu", provider.sourceUrl, "button button-quiet"));
  return actions;
}

function keyForm(provider) {
  const form = el("form", "entry-form");
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
      // Reflect on the sidebar dot + status bar without rebuilding this panel,
      // which would detach the result node we just wrote to.
      const dot = document.querySelector(`.tree-row[data-target-id="${provider.id}"] .dot`);
      if (dot) dot.dataset.state = saved ? "saved" : (unknown ? "" : "missing");
      renderStatusKeys();
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
        badge(provider.category === "router" ? "Router" : "Hosted inference", "local", null)
      ].filter(Boolean),
      actions: providerActions(provider)
    })
  );

  doc.append(
    codeBlock([
      { key: "id", value: provider.id, copyable: true, copyText: provider.id },
      { key: "category", value: provider.category, plain: true },
      { key: "endpoint", value: provider.endpoint, copyable: true, copyText: provider.endpoint },
      provider.endpointNeedsAccountId ? { key: "account id", value: "cần account id trong endpoint", plain: true } : null,
      { key: "verifiedAt", value: provider.verifiedAt || "chưa rõ", plain: true },
      provider.addedAt ? { key: "addedAt", value: provider.addedAt, plain: true } : null
    ].filter(Boolean))
  );

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
          ? `Số liệu quota được rà soát ${provider.verifiedAt || "chưa rõ ngày"}. Dashboard không gửi model request để suy ra quota.`
          : "Đây là dữ liệu upstream chưa được FreeModel Lab xác minh. Mở trang provider để đối chiếu trước khi dùng."
      )
    ])
  );

  doc.append(
    section("Bảo mật", "shield", [
      el(
        "p",
        "muted",
        "FreeModel Lab lưu key trong kho credential của hệ điều hành, không trả key qua API, không ghi key vào log và không tự động xoay key. Dashboard chỉ bind 127.0.0.1."
      )
    ])
  );

  doc.append(section("Key", "key", [keyStatusPanel(provider), keyForm(provider)]));
  if (provider.provisioner) {
    doc.append(section("Tạo key", "sparkle", [provisionForm(provider)]));
  }

  doc.append(
    section("Nguồn", "link", [
      kvList([
        ["Trang provider", provider.keyUrl ? safeLink(provider.keyUrl, provider.keyUrl, "text-link", false) : ""],
        ["Trang quota", provider.quotaUrl ? safeLink(provider.quotaUrl, provider.quotaUrl, "text-link", false) : ""],
        ["Nguồn dữ liệu", provider.sourceUrl ? safeLink(provider.sourceUrl, provider.sourceUrl, "text-link", false) : ""],
        ["catalogSource", provider.catalogSource || "builtin"]
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
      badges: [badge("Ứng viên upstream", "upstream", "warn"), badge(provider.category === "router" ? "Router" : "Hosted inference", "local", null)],
      actions: keyUrl ? [safeLink("Trang provider", keyUrl, "button button-secondary")] : []
    })
  );

  doc.append(
    codeBlock([
      { key: "id", value: provider.id, copyable: true, copyText: provider.id },
      { key: "category", value: provider.category, plain: true },
      { key: "endpoint", value: provider.endpoint, copyable: true, copyText: provider.endpoint },
      { key: "verifiedAt", value: provider.verifiedAt || "chưa rõ", plain: true }
    ])
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
  const doc = el("article", "welcome");
  doc.append(el("div", "welcome-mark", "F"));
  doc.append(el("h2", "", "FreeModel Lab"));
  doc.append(el("p", "welcome-sub", "Bảng điều khiển cục bộ cho danh mục provider LLM có quota free. Chọn một provider ở thanh bên để xem quota, trạng thái key và metadata."));
  doc.append(el("h3", "", "Bắt đầu"));
  const shortcuts = el("div", "shortcut-grid");
  const rows = [
    ["Lọc provider", ["Ctrl", "B"]],
    ["Danh mục provider", ["Ctrl", "1"]],
    ["Nguồn provider mới", ["Ctrl", "2"]],
    ["Trợ giúp", ["Ctrl", "3"]],
    ["Tập trung ô lọc", ["/"]],
    ["Cập nhật danh sách upstream", ["Ctrl", "R"]]
  ];
  for (const [label, keys] of rows) {
    const row = el("div", "shortcut");
    row.append(el("span", "", label));
    const keyWrap = el("span", "shortcut-keys");
    keys.forEach((key, index) => {
      if (index) keyWrap.append(el("span", "", "+"));
      keyWrap.append(el("kbd", "", key));
    });
    row.append(keyWrap);
    shortcuts.append(row);
  }
  doc.append(shortcuts);

  const providers = state.providers.slice(0, 6);
  if (providers.length) {
    doc.append(el("h3", "", "Provider gần đây"));
    const list = el("ul", "recent-list");
    for (const provider of providers) {
      const li = el("li");
      const button = el("button");
      button.type = "button";
      button.append(icon("layers"), el("span", "", provider.name));
      button.addEventListener("click", () => openTarget(provider.id));
      li.append(button);
      list.append(li);
    }
    doc.append(list);
  }

  doc.append(
    el(
      "p",
      "welcome-scope",
      "Phạm vi: dashboard chỉ đọc danh mục, trạng thái kho bảo mật và ghi key khi bạn yêu cầu. Không gửi model request, không đọc cookie/storage/profile của Chrome, không tự động xoay key. Server chỉ bind 127.0.0.1."
    )
  );
  return doc;
}

/* ---------------------------------------------------------------- */
/* Routing                                                           */
/* ---------------------------------------------------------------- */

function openTarget(targetId, options = {}) {
  state.activeId = targetId;
  if (!options.keepTabs) openTab(targetId);
  if (targetId.startsWith("candidate:")) {
    state.view = "discover";
  } else if (targetId !== "welcome") {
    state.view = "providers";
  }
  setDetailOpen(true);
  renderAll();
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

function syncEditorInteractivity() {
  const hidden = mobileDetailQuery.matches && !dom.workbench.classList.contains("detail-open");
  dom.editor.inert = hidden;
  if (hidden && dom.editor.contains(document.activeElement)) focusActiveSidebarRow();
}

mobileDetailQuery.addEventListener("change", syncEditorInteractivity);

function renderEditor() {
  if (!state.activeId) {
    dom.content.replaceChildren(renderWelcome());
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
  dom.statusViewLabel.textContent = views[state.view] || "Danh mục";
  dom.sidebarList.hidden = state.view !== "providers";
  dom.discoverView.hidden = state.view !== "discover";
  dom.helpView.hidden = state.view !== "help";
  document.querySelectorAll(".activity-item").forEach((item) => {
    item.setAttribute("aria-pressed", String(item.dataset.view === state.view));
  });
}

function renderAll() {
  renderViewChrome();
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
  const row = document.querySelector(`.tree-row[data-target-id="${providerId}"] .dot`);
  if (row) row.dataset.state = "saved";
  renderStatusKeys();
  if (state.activeId === providerId) renderEditor();
}

async function loadProviders(showLoading = true) {
  if (showLoading) setStatus("Đang đọc quota công bố và trạng thái key trên máy này…");
  try {
    const data = await api("/api/providers");
    state.providers = data.providers || [];
    const officialProviders = state.providers.filter((provider) => provider.catalogSource !== "upstream");
    const upstreamCount = state.providers.length - officialProviders.length;
    const latest = officialProviders.map((provider) => provider.verifiedAt).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1) || "";
    dom.verifiedAt.textContent = latest || "—";
    const staleCount = state.providers.filter((provider) => Date.now() - new Date(`${provider.verifiedAt}T00:00:00Z`).getTime() > STALE_WINDOW_MS).length;
    const summary = `${officialProviders.length} chính thức${upstreamCount ? ` · ${upstreamCount} chờ xác minh` : ""}${staleCount ? ` · ${staleCount} cần rà soát` : ""}.`;
    setStatus(summary, staleCount ? "warning" : "success");
    renderAll();
  } catch (error) {
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
    const when = state.sourceUpdatedAt === "unknown" ? "chưa rõ ngày" : state.sourceUpdatedAt;
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
  try { localStorage.setItem(SIDEBAR_KEY, visible ? "open" : "closed"); } catch (error) { /* optional */ }
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
    if (Number.isFinite(parsed)) dom.workbench.style.setProperty("--sidebar-width", `${Math.min(520, Math.max(220, parsed))}px`);
  }
}

dom.sidebarToggle.addEventListener("click", () => {
  setSidebarVisible(dom.workbench.classList.contains("sidebar-hidden"));
});

function startResize(startX) {
  const current = dom.workbench.style.getPropertyValue("--sidebar-width");
  const startWidth = Number.parseInt(current, 10) || 288;
  const onMove = (event) => {
    const next = Math.min(520, Math.max(220, startWidth + (event.clientX - startX)));
    dom.workbench.style.setProperty("--sidebar-width", `${next}px`);
  };
  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    const value = dom.workbench.style.getPropertyValue("--sidebar-width");
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, value.replace("px", "")); } catch (error) { /* optional */ }
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

dom.resizer.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  startResize(event.clientX);
});

dom.resizer.addEventListener("keydown", (event) => {
  const current = Number.parseInt(dom.workbench.style.getPropertyValue("--sidebar-width"), 10) || 288;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const next = Math.min(520, Math.max(220, current + (event.key === "ArrowRight" ? 16 : -16)));
    dom.workbench.style.setProperty("--sidebar-width", `${next}px`);
  }
});

document.querySelectorAll(".activity-item").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

dom.statusView.addEventListener("click", () => setView(state.view === "providers" ? "discover" : "providers"));

dom.sidebarFilter.addEventListener("input", (event) => {
  state.filter = event.target.value;
  renderSidebar();
  renderDiscoverView();
});

dom.sidebarFilter.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    dom.sidebarFilter.value = "";
    state.filter = "";
    renderSidebar();
    renderDiscoverView();
    dom.sidebarFilter.blur();
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
    event.preventDefault();
    setSidebarVisible(dom.workbench.classList.contains("sidebar-hidden"));
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "1") { event.preventDefault(); setView("providers"); return; }
  if ((event.ctrlKey || event.metaKey) && event.key === "2") { event.preventDefault(); setView("discover"); return; }
  if ((event.ctrlKey || event.metaKey) && event.key === "3") { event.preventDefault(); setView("help"); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r") { event.preventDefault(); refreshCatalog(); return; }
  if (event.key === "Escape" && mobileDetailQuery.matches && dom.workbench.classList.contains("detail-open")) {
    event.preventDefault();
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
/* in sync without duplicating state. Ctrl+b is already wired in    */
/* the shortcut handler above and is intentionally not duplicated.  */
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

  if (active instanceof HTMLElement && active.classList.contains("activity-item")) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusByOffset(Array.from(document.querySelectorAll(".activity-item")), active, event.key === "ArrowDown" ? 1 : -1);
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
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      focusByOffset(Array.from(dom.tabs.querySelectorAll(".tab-hit")), active, event.key === "ArrowRight" ? 1 : -1);
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

applyTheme(currentTheme());
restoreSidebar();
syncEditorInteractivity();
renderAll();
loadProviders();
refreshCatalog();
