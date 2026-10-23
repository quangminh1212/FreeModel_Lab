"use strict";

const HOST_NAME = "com.freemodel.lab.bridge";
const status = document.querySelector("#status");
const button = document.querySelector("#check");

function checkHost() {
  status.dataset.ok = "false";
  status.textContent = "Đang kiểm tra Native Messaging…";
  chrome.runtime.sendNativeMessage(HOST_NAME, { version: 1, action: "ping" }, (reply) => {
    if (chrome.runtime.lastError || !reply?.ok) {
      status.textContent = "Chưa kết nối được host. Chạy `freemodel-lab chrome install`, rồi nạp extension theo đường dẫn CLI in ra.";
      return;
    }
    status.dataset.ok = "true";
    status.textContent = "Native Messaging host đang hoạt động. Key chỉ được gửi khi bạn chủ động lưu trong dashboard.";
  });
}

button.addEventListener("click", checkHost);
checkHost();
