"use strict";

const EXTENSION_ID = "jamdobbdcddmkpgfpajpbnmfgobfjgca";
const providerRoot = document.querySelector("#providers");
const statusLine = document.querySelector("#status");
const refreshButton = document.querySelector("#refresh");
let session = null;

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function field(labelText, name, options = {}) {
  const wrap = el("div", "field");
  const input = document.createElement("input");
  input.name = name;
  input.type = options.type || "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.required = options.required !== false;
  input.placeholder = options.placeholder || "";
  if (options.step) input.step = options.step;
  if (options.min) input.min = options.min;
  if (options.maxLength) input.maxLength = options.maxLength;
  const label = el("label", "", labelText);
  label.append(input);
  wrap.append(label);
  return { wrap, input };
}

function checkLine(labelText, name) {
  const wrap = el("label", "check-line");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  const text = el("span", "", labelText);
  wrap.append(input, text);
  return { wrap, input };
}

function actionButton(label, className = "button button-primary button-small") {
  const button = el("button", className, label);
  button.type = "submit";
  return button;
}

function safeLink(label, href, className = "text-link") {
  const anchor = el("a", className, label);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function setStatus(message, kind = "") {
  statusLine.textContent = message;
  statusLine.dataset.kind = kind;
}

function markProviderSaved(providerId) {
  const card = [...providerRoot.querySelectorAll(".provider-card")].find((item) => item.dataset.providerId === providerId);
  const chip = card?.querySelector(".key-chip");
  if (chip) {
    chip.textContent = "Key đã lưu";
    chip.dataset.saved = "true";
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function modelList(models) {
  if (!models?.length) return null;
  const list = el("div", "model-list");
  for (const model of models) list.append(el("span", "model-chip", model));
  return list;
}

function quotaDetails(provider, stale) {
  const block = el("section", "quota-block");
  block.append(el("p", "quota-label", stale ? "Quota đã công bố · nguồn cần xác minh lại" : "Quota free hiện tại"));
  block.append(el("p", "quota-summary", provider.quota.summary));
  const meta = el("div", "quota-meta");
  for (const [label, value] of [["Phạm vi", provider.quota.scope], ["Chu kỳ", provider.quota.reset]]) {
    const row = el("div", "meta-row");
    row.append(el("strong", "", label), el("span", "", value));
    meta.append(row);
  }
  const liveRow = el("div", "meta-row");
  liveRow.append(el("strong", "", "Quota còn lại"), el("span", "", "App không đọc số dư live; mở trang quota chính thức của provider."));
  meta.append(liveRow);
  block.append(meta);
  const models = modelList(provider.quota.models);
  if (models) block.append(models);
  for (const note of provider.quota.notes || []) block.append(el("p", "quota-note", note));
  return block;
}

function addSaveForm(card, provider) {
  const panel = document.createElement("details");
  panel.className = "details-panel";
  const summary = el("summary", "", "Lưu key đã tạo trên trang provider");
  const form = document.createElement("form");
  form.className = "entry-form";
  const keyField = field("API key (chỉ giữ trong bộ nhớ khi gửi)", "secret", { type: "password", maxLength: 16_384 });
  keyField.input.required = true;
  keyField.input.autocomplete = "new-password";
  keyField.input.placeholder = "Dán key từ trang chính thức";
  const replace = checkLine("Thay key đang lưu trên máy này. Key cũ ở provider sẽ không bị thu hồi.", "overwrite");
  const hint = el("p", "form-hint", "Key được lưu vào kho credential của hệ điều hành. Nếu extension Native Messaging đã cài, thao tác sẽ đi qua extension; nếu chưa, dashboard lưu trực tiếp qua kết nối loopback.");
  const result = el("p", "form-result");
  const submit = actionButton("Lưu an toàn");
  form.append(keyField.wrap, replace.wrap, hint, submit, result);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const secret = keyField.input.value;
    submit.disabled = true;
    result.textContent = "Đang lưu vào kho credential…";
    result.dataset.kind = "";
    try {
      let saved = false;
      if (session && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        try {
          const reply = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(EXTENSION_ID, {
              version: 1,
              action: "save-key",
              providerId: provider.id,
              secret,
              overwrite: replace.input.checked,
              sessionToken: session.sessionToken,
              port: session.port
            }, (response) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve(response);
            });
          });
          saved = Boolean(reply && reply.ok);
        } catch { /* Use the same-origin loopback route as a local fallback. */ }
      }
      if (!saved) {
        await api(`/api/keys/${encodeURIComponent(provider.id)}`, {
          method: "POST",
          body: JSON.stringify({ secret, overwrite: replace.input.checked })
        });
      }
      keyField.input.value = "";
      result.textContent = "Đã lưu key vào kho credential của hệ điều hành. Giá trị key không được hiển thị lại.";
      result.dataset.kind = "success";
      markProviderSaved(provider.id);
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "Không thể lưu key.";
      result.dataset.kind = "error";
    } finally {
      submit.disabled = false;
    }
  });
  panel.append(summary, form);
  card.append(panel);
}

function provisionForm(provider) {
  const panel = document.createElement("details");
  panel.className = "details-panel";
  panel.open = false;
  const summary = el("summary", "", "Tạo key qua API chính thức");
  const form = document.createElement("form");
  form.className = "entry-form";
  const name = field("Tên key", "name", { required: false, maxLength: 120 });
  name.input.value = `FreeModel Lab ${provider.name}`;
  form.append(name.wrap);
  const fields = {};
  const add = (label, key, options) => {
    const item = field(label, key, options);
    fields[key] = item.input;
    form.append(item.wrap);
  };
  if (provider.id === "gemini") {
    add("Google Cloud project ID", "project");
    add("Service account email đã tồn tại", "serviceAccountEmail");
    form.append(el("p", "form-hint", "Cần gcloud đã đăng nhập và quyền IAM để tạo key giới hạn cho Gemini API."));
  } else if (provider.id === "cloudflare-workers-ai") {
    add("Cloudflare account ID (32 ký tự hex)", "accountId", { maxLength: 32 });
    add("Bootstrap token có quyền Account API Tokens Write", "bootstrapToken", { type: "password", maxLength: 16_384 });
    fields.bootstrapToken.autocomplete = "new-password";
    add("Hết hạn (ISO-8601 UTC, tùy chọn)", "expiresOn", { required: false, placeholder: "2030-01-01T00:00:00Z" });
  } else if (provider.id === "openrouter") {
    add("Management key", "managementKey", { type: "password", maxLength: 16_384 });
    fields.managementKey.autocomplete = "new-password";
    add("Trần chi tiêu hàng tháng (USD)", "monthlyLimitUsd", { type: "number", min: "0.01", step: "0.01" });
    form.append(el("p", "form-hint form-warning", "Mức trần dương cho phép phát sinh phí nếu chọn model trả phí. Chỉ dùng model free nếu bạn muốn duy trì $0."));
  }
  const replace = checkLine("Thay key đã lưu nếu có. Key cũ ở provider không bị thu hồi.", "overwrite");
  const confirm = checkLine("Tôi xác nhận tạo credential trên tài khoản provider.", "confirm");
  confirm.input.required = true;
  const result = el("p", "form-result");
  const submit = actionButton("Xác nhận tạo và lưu key");
  form.append(replace.wrap, confirm.wrap, submit, result);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!confirm.input.checked) return;
    const body = {
      name: name.input.value,
      overwrite: replace.input.checked,
      ...(provider.id === "gemini" ? {
        project: fields.project.value,
        serviceAccountEmail: fields.serviceAccountEmail.value
      } : {}),
      ...(provider.id === "cloudflare-workers-ai" ? {
        accountId: fields.accountId.value,
        bootstrapToken: fields.bootstrapToken.value,
        expiresOn: fields.expiresOn.value || undefined
      } : {}),
      ...(provider.id === "openrouter" ? {
        managementKey: fields.managementKey.value,
        monthlyLimitUsd: Number(fields.monthlyLimitUsd.value)
      } : {})
    };
    submit.disabled = true;
    result.textContent = "Đang gửi yêu cầu một lần tới API chính thức…";
    try {
      const response = await api(`/api/provision/${encodeURIComponent(provider.id)}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      form.reset();
      name.input.value = `FreeModel Lab ${provider.name}`;
      result.textContent = response.message || "Đã tạo và lưu key.";
      result.dataset.kind = "success";
      const endpoint = card.querySelector(".endpoint-value");
      if (endpoint && typeof response.endpoint === "string") endpoint.textContent = response.endpoint;
      markProviderSaved(provider.id);
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "Tạo key thất bại.";
      result.dataset.kind = "error";
    } finally {
      if (fields.bootstrapToken) fields.bootstrapToken.value = "";
      if (fields.managementKey) fields.managementKey.value = "";
      submit.disabled = false;
    }
  });
  panel.append(summary, form);
  return panel;
}

function renderProvider(provider) {
  const card = el("article", "provider-card");
  card.dataset.providerId = provider.id;
  const header = el("header", "card-head");
  const row = el("div", "provider-title-row");
  row.append(el("div", "provider-icon", provider.name.slice(0, 1)));
  const copy = el("div", "provider-title-wrap");
  copy.append(el("h2", "", provider.name));
  copy.append(el("p", "provider-type", provider.category === "router" ? "Model router" : "Hosted inference API"));
  const ageMs = Date.now() - new Date(`${provider.verifiedAt}T00:00:00Z`).getTime();
  const stale = !Number.isFinite(ageMs) || ageMs > 30 * 24 * 60 * 60 * 1000;
  const chipText = provider.keySaved === null ? "Kho key chưa sẵn sàng" : provider.keySaved ? "Key đã lưu" : "Chưa có key";
  const keyChip = el("span", "key-chip", chipText);
  keyChip.dataset.saved = provider.keySaved === true ? "true" : "false";
  const chips = el("div", "chip-group");
  chips.append(keyChip);
  if (stale) chips.append(el("span", "key-chip key-chip-stale", "Quota cần xác minh"));
  row.append(copy, chips);
  header.append(row);
  card.append(header, quotaDetails(provider, stale));

  const endpoint = el("div", "endpoint-box");
  endpoint.append(el("p", "endpoint-label", "API endpoint"), el("code", "endpoint-value", provider.endpoint));
  card.append(endpoint);

  const actions = el("div", "card-actions");
  actions.append(safeLink("Trang tạo key ↗", provider.keyUrl), safeLink("Quota trên provider ↗", provider.quotaUrl));
  card.append(actions);
  addSaveForm(card, provider);
  if (provider.provisioner) card.append(provisionForm(provider));

  const source = el("footer", "source-line");
  source.append(document.createTextNode("Nguồn quota: "), safeLink("tài liệu chính thức ↗", provider.sourceUrl, ""));
  source.append(document.createTextNode(" · Xác minh "));
  source.append(el("time", "", provider.verifiedAt));
  card.append(source);
  return card;
}

async function loadProviders(showLoading = true) {
  if (showLoading) setStatus("Đang đọc quota công bố và trạng thái key trên máy này…");
  refreshButton.disabled = true;
  try {
    const [sessionInfo, data] = await Promise.all([api("/api/session"), api("/api/providers")]);
    session = sessionInfo;
    providerRoot.replaceChildren(...data.providers.map(renderProvider));
    const latest = data.providers.reduce((value, provider) => provider.verifiedAt > value ? provider.verifiedAt : value, "");
    document.querySelector("#verified-at").textContent = latest || "—";
    const staleCount = data.providers.filter((provider) => Date.now() - new Date(`${provider.verifiedAt}T00:00:00Z`).getTime() > 30 * 24 * 60 * 60 * 1000).length;
    setStatus(`${data.providers.length} provider có quota free trong registry. Quota công bố được xác minh ${latest || "chưa rõ ngày"}; ${staleCount ? `${staleCount} nguồn đã quá 30 ngày, hãy kiểm tra lại` : "các nguồn còn trong hạn rà soát"}. Dashboard không gửi model request để suy ra quota.`, staleCount ? "warning" : "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Không tải được dashboard.", "error");
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", () => loadProviders());
loadProviders();
