# AI guide: tạo và lưu API credential

## Mục tiêu

Tra cứu endpoint công khai và hỗ trợ người dùng tạo credential theo API chính
thức của provider. Credential thuộc tài khoản của người dùng tại provider tương
ứng. Endpoint thường do provider công bố; repo chỉ đọc từ catalog. Cloudflare
Workers AI là trường hợp cần điền Account ID vào URL mẫu.

## Quy trình

1. Chạy `python provider_helper.py capabilities` để xem adapter provisioning
   hiện có.
2. Với Google Gemini, OpenRouter hoặc Cloudflare Workers AI, dùng lệnh
   `python provider_helper.py provision "<provider>"` theo tham số trong README.
   Lệnh chỉ tạo một credential cho provider được chọn; không tạo tài khoản.
3. Nhập management/bootstrap key chỉ tại prompt ẩn của lệnh. Gemini dùng
   `gcloud auth print-access-token` sau khi người dùng đã đăng nhập bằng
   `gcloud auth login`.
4. Với provider chưa có adapter đã xác minh, mở link HTTPS từ catalog, kiểm tra
   domain chính thức, hướng dẫn người dùng tự tạo key, rồi chạy
   `python provider_helper.py save-key "<provider>"` trên máy của họ.
5. Dùng `key-status` để xác nhận trạng thái mà không hiển thị key. Chỉ báo lại
   endpoint và trạng thái lưu, không yêu cầu người dùng dán key vào chat.

## Điều kiện và giới hạn

- Google Gemini cần Cloud project, service account đã tồn tại, API Keys API và
  Gemini API được bật, cùng quyền IAM để tạo và bind authorization key.
- Cloudflare Workers AI cần account ID và token bootstrap có quyền Account API
  Tokens Write. Repo tạo token với quyền Workers AI Read/Edit trong đúng account.
- OpenRouter cần management key đã tạo trong dashboard. Repo bắt buộc đặt mức
  chi tiêu dương theo tháng cho key mới; key vẫn có thể dùng dịch vụ tính phí
  đến mức trần đã chọn.
- Provider còn lại đang dùng hướng dẫn dashboard và `save-key`; trạng thái này
  chỉ có nghĩa repo chưa xác minh/triển khai API provisioning chính thức.
- Kilo Code được catalog ghi là không cần key cho đường free hiện tại.
- `provision --overwrite` thay credential đang lưu cục bộ nhưng không thu hồi key
  cũ ở provider. Người dùng cần thu hồi key cũ riêng nếu muốn thay thế.
- Tạo key không làm tăng quota miễn phí, không đảm bảo dịch vụ liên tục và không
  bỏ giới hạn hay điều khoản của provider.

## Không được làm

- Không trích xuất credential từ Gmail, browser cookies, local storage,
  clipboard, profile, file cấu hình hay ảnh chụp màn hình.
- Không tự đăng ký tài khoản, vượt xác minh, chấp nhận điều khoản/thanh toán thay
  người dùng, hoặc xoay key/tài khoản để né quota.
- Không gọi dashboard private API hay tự động hóa UI để giả thao tác đăng nhập.
- Không in key, ghi key vào repo/log, hoặc gửi key ra ngoài. Dùng prompt ẩn và
  Windows Credential Locker.
- Chỉ gọi API provisioning công khai đúng provider, dùng đúng quyền đã yêu cầu
  và cho biết rõ khi thao tác sẽ tạo credential trên tài khoản thật.

Tài liệu adapter: [Google Cloud API keys](https://docs.cloud.google.com/docs/authentication/api-keys), [Cloudflare create tokens via API](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/), [Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [OpenRouter create API key](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key).
