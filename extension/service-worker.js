"use strict";

const HOST_NAME = "com.freemodel.lab.bridge";
const DASHBOARD_HOST = "127.0.0.1";

function validateExternalMessage(message, sender) {
  if (!sender.url) return false;
  let senderUrl;
  try { senderUrl = new URL(sender.url); } catch { return false; }
  if (senderUrl.protocol !== "http:" || senderUrl.hostname !== DASHBOARD_HOST) return false;
  if (!message || message.version !== 1 || message.action !== "save-key") return false;
  if (typeof message.providerId !== "string" || !/^[a-z0-9-]{1,64}$/.test(message.providerId)) return false;
  if (typeof message.secret !== "string" || message.secret.length < 1 || message.secret.length > 16_384) return false;
  if (typeof message.sessionToken !== "string" || !/^[A-Za-z0-9_-]{40,64}$/.test(message.sessionToken)) return false;
  if (!Number.isInteger(message.port) || message.port < 1 || message.port > 65_535) return false;
  if (typeof message.overwrite !== "boolean") return false;
  return true;
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!validateExternalMessage(message, sender)) {
    sendResponse({ ok: false, error: "This message is not allowed." });
    return false;
  }
  const { version, action, providerId, secret, sessionToken, port, overwrite } = message;
  chrome.runtime.sendNativeMessage(HOST_NAME, {
    version, action, providerId, secret, sessionToken, port, overwrite
  }, (response) => {
    if (chrome.runtime.lastError) sendResponse({ ok: false, error: "Native Messaging host is unavailable." });
    else sendResponse(response || { ok: false, error: "Native Messaging host returned no status." });
  });
  return true;
});
