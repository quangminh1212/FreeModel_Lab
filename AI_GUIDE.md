# AI guide: quota free và API key

## Mục tiêu

Tra cứu danh mục provider free, cập nhật ứng viên từ nguồn upstream, lưu endpoint metadata cục bộ và API key trong kho credential của hệ điều hành. Khi tích hợp với công cụ khác, chỉ xuất cấu hình theo thao tác chủ động của người dùng.

## Quy trình

1. Chạy `freemodel-lab start` để khởi chạy dashboard cục bộ. Lệnh in URL và không tự mở trình duyệt; dán URL vào trình duyệt khi cần. Dashboard bind vào `127.0.0.1`, không chia sẻ trên mạng LAN.
2. Dùng nút cập nhật danh sách để tải nguồn upstream mới. Upstream chỉ cung cấp ứng viên khám phá; kiểm tra trang chính thức trước khi thêm. Chỉ coi quota đã được xác minh khi nguồn chính thức còn trong 30 ngày.
3. Dùng nút tạo key chỉ cho provider có adapter rõ ràng: Gemini, Cloudflare Workers AI hoặc OpenRouter. Xem lại quyền và chi phí, rồi xác nhận request một lần.
4. Với provider chưa có adapter đã xác minh, mở trang key chính thức, hoàn tất thao tác thủ công trong Chrome, rồi dán key vào dashboard hoặc dùng `freemodel-lab save-key <provider-id>`.
5. Dùng `freemodel-lab key-status` để xem trạng thái lưu. Dashboard và API trạng thái không đọc lại hay trả về giá trị key.
6. Dùng `freemodel-lab integration export <provider-id>` khi cần cấu hình ứng dụng khác. Lệnh này cố ý xuất key ra stdout; giữ đầu ra riêng tư và không đưa vào log, issue hoặc chat.

## Ranh giới an toàn

- Không đọc Gmail, Chrome cookies, local/session storage, history, profile database, password store hoặc file cấu hình đăng nhập.
- Không tự đăng ký account, xử lý OTP/MFA/CAPTCHA, chấp nhận điều khoản, xác nhận thanh toán hoặc cấp quyền nhạy cảm.
- Không dùng private dashboard API, không tự retry thao tác tạo key khi kết quả chưa rõ, và không tạo key thay thế ngầm.
- Không xoay key/account để né quota. Một key mới không làm quota tăng và không biến gói trả phí thành free.
- Chỉ dùng HTTPS provider endpoint và API provisioning chính thức; không gửi key ra log, telemetry, repo hoặc phản hồi dashboard.
- Lưu key bằng Windows Credential Manager, macOS Keychain hoặc Linux Secret Service. Linux không có Secret Service thì phải dừng và báo lỗi; không lưu plaintext hoặc fallback sang keyutils.
- Extension chỉ dùng `nativeMessaging`, xác thực extension origin và schema message. Key chỉ được chuyển khi người dùng bấm lưu trong dashboard.
- Dashboard chỉ nhận kết nối loopback, kiểm tra Host/Origin và session, không bật CORS rộng.

## Adapter hiện có

- **Gemini:** gcloud access token, project ID, service account email đã tồn tại; key giới hạn Gemini API.
- **Cloudflare Workers AI:** account ID, bootstrap token cấp quyền tạo account API token; token mới chỉ có Workers AI Read/Edit.
- **OpenRouter:** management key và trần chi tiêu tháng dương do người dùng chọn; model trả phí có thể phát sinh chi phí tới trần đó.
- **Groq và Mistral:** hướng dẫn tới trang key/quota chính thức; người dùng hoàn tất xác minh và lưu key.

Nếu provider đổi quota, endpoint hoặc yêu cầu tạo key, cập nhật thông tin sau khi nguồn chính thức được rà soát lại. Upstream `awesome-free-llm-apis` chỉ cung cấp ứng viên để kiểm tra, không phải nguồn có thẩm quyền cho quota. Endpoint của provider do người dùng thêm nằm trong metadata ở thư mục dữ liệu user; API key không được ghi vào tệp này.
