# AI guide: quota free và API key

## Mục tiêu

Tra cứu quota free từ nguồn provider chính thức, mở trang quản lý trong Chrome đang đăng nhập, tạo key bằng API provisioning công khai khi adapter đã được xác minh, và lưu key trong kho credential của hệ điều hành.

## Quy trình

1. Chạy `freemodel-lab start` để mở dashboard cục bộ trong Chrome. Dashboard bind vào `127.0.0.1`, không chia sẻ trên mạng LAN.
2. Chỉ coi số quota là hiện tại khi ngày xác minh của nguồn chưa quá 30 ngày. Nếu quota phụ thuộc model/tài khoản, mở trang quota chính thức của provider.
3. Dùng nút tạo key chỉ cho provider có adapter rõ ràng: Gemini, Cloudflare Workers AI hoặc OpenRouter. Xem lại quyền và chi phí, rồi xác nhận request một lần.
4. Với provider chưa có adapter đã xác minh, mở trang key chính thức, hoàn tất thao tác thủ công trong Chrome, rồi dán key vào dashboard hoặc dùng `freemodel-lab save-key <provider-id>`.
5. Dùng `freemodel-lab key-status` để xem trạng thái lưu. Không đọc lại hay in giá trị key.

## Ranh giới an toàn

- Không đọc Gmail, Chrome cookies, local/session storage, history, profile database, password store hoặc file cấu hình đăng nhập.
- Không tự đăng ký account, xử lý OTP/MFA/CAPTCHA, chấp nhận điều khoản, xác nhận thanh toán hoặc cấp quyền nhạy cảm.
- Không dùng private dashboard API, không tự retry thao tác tạo key khi kết quả chưa rõ, và không tạo key thay thế ngầm.
- Không xoay key/account để né quota. Một key mới không làm quota tăng và không biến gói trả phí thành free.
- Chỉ dùng HTTPS provider endpoint và API provisioning chính thức; không gửi key ra log, telemetry, repo, clipboard tự động hoặc phản hồi dashboard.
- Lưu key bằng Windows Credential Manager, macOS Keychain hoặc Linux Secret Service. Linux không có Secret Service thì phải dừng và báo lỗi; không lưu plaintext hoặc fallback sang keyutils.
- Extension chỉ dùng `nativeMessaging`, xác thực extension origin và schema message. Key chỉ được chuyển khi người dùng bấm lưu trong dashboard.
- Dashboard chỉ nhận kết nối loopback, kiểm tra Host/Origin và session, không bật CORS rộng.

## Adapter hiện có

- **Gemini:** gcloud access token, project ID, service account email đã tồn tại; key giới hạn Gemini API.
- **Cloudflare Workers AI:** account ID, bootstrap token cấp quyền tạo account API token; token mới chỉ có Workers AI Read/Edit.
- **OpenRouter:** management key và trần chi tiêu tháng dương do người dùng chọn; model trả phí có thể phát sinh chi phí tới trần đó.
- **Groq và Mistral:** hướng dẫn tới trang key/quota chính thức; người dùng hoàn tất xác minh và lưu key.

Nếu provider đổi quota, endpoint hoặc yêu cầu tạo key, cập nhật registry chỉ sau khi nguồn chính thức được rà soát lại. Upstream `awesome-free-llm-apis` chỉ cung cấp ứng viên để kiểm tra, không phải nguồn có thẩm quyền cho quota.
