# FreeModel Lab

CLI tra cứu endpoint và tạo/lưu credential cho các provider trong
[mnfst/awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis).

## Tạo credential tự động

Repo chỉ tự tạo credential qua API chính thức khi provider công bố API quản lý
key/token. Hiện có adapter cho:

| Provider | Repo làm được | Cần chuẩn bị |
| --- | --- | --- |
| Google Gemini | Tạo authorization API key bị giới hạn vào Gemini API | Google Cloud project, service account có sẵn, `gcloud auth login`, API Keys API và Gemini API được bật, quyền IAM tương ứng |
| Cloudflare Workers AI | Tạo account API token chỉ có quyền Workers AI Read/Edit | Account ID và bootstrap token đã tạo trong dashboard với quyền `Account API Tokens Write` |
| OpenRouter | Tạo API key mới qua management API và lưu hạn mức chi tiêu theo tháng | Management key đã tạo trong dashboard và mức trần chi tiêu dương |
| Kilo Code | Luồng free được catalog ghi là không cần key | Không cần tạo key cho luồng này |
| OVHcloud AI Endpoints | Dùng trang quản lý key trong dashboard; lệnh CLI chính thức `cloud ai authorization create` chỉ bật quyền dùng dịch vụ, không tạo API key | Public Cloud project và điều kiện thanh toán theo tài liệu OVHcloud |
| Provider còn lại | Chưa có adapter provisioning được xác minh trong repo | Tạo key trên trang chính thức rồi dùng `save-key` |

Tài liệu chính thức của các adapter: [Google Cloud API keys](https://docs.cloud.google.com/docs/authentication/api-keys), [Cloudflare create tokens via API](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/) và [Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [OpenRouter create API key](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key).

OVHcloud: [hướng dẫn AI Endpoints](https://github.com/ovh/docs/blob/develop/pages/public_cloud/ai_machine_learning/endpoints_guide_01_getting_started/guide.en-sg.md), [lệnh CLI authorize](https://github.com/ovh/ovhcloud-cli/blob/main/doc/ovhcloud_cloud_ai_authorization_create.md).

Endpoint là địa chỉ API do provider công bố; repo tra cứu và lưu endpoint đó,
không tự dựng endpoint mới. Với Cloudflare, lệnh `provision` điền Account ID vào
endpoint mẫu trong catalog.

## Cài đặt

Cần Python 3.10 trở lên và Windows để lưu key vào Windows Credential Locker:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Lệnh

```powershell
# Cập nhật catalog công khai
python .\provider_helper.py sync

# Liệt kê provider, endpoint và trang tạo key
python .\provider_helper.py list

# Xem nơi repo có thể tự tạo credential
python .\provider_helper.py capabilities

# Tạo key Gemini. Service account phải tồn tại và có quyền cần thiết.
python .\provider_helper.py provision "Google Gemini" `
  --project your-google-cloud-project `
  --service-account-email key-user@your-google-cloud-project.iam.gserviceaccount.com

# Tạo Workers AI token. Lệnh sẽ hỏi bootstrap token bằng prompt ẩn.
python .\provider_helper.py provision "Cloudflare Workers AI" `
  --account-id 0123456789abcdef0123456789abcdef

# Tạo OpenRouter key có trần chi tiêu $1 mỗi tháng.
# Lệnh sẽ hỏi management key bằng prompt ẩn.
# Trần này cho phép phát sinh phí tối đa $1; chỉ chọn model free nếu không muốn trả phí.
python .\provider_helper.py provision "OpenRouter" --limit-usd 1.00

# Xem hướng dẫn cho một provider
python .\provider_helper.py guide "Cohere"

# Lưu key do bạn tự tạo trên dashboard
python .\provider_helper.py save-key "Cohere"

# Kiểm tra đã lưu key hay chưa, không hiển thị giá trị
python .\provider_helper.py key-status "Cohere"
```

`provision` không đọc Gmail, cookie hay phiên trình duyệt. Mỗi provider vẫn cần
quyền riêng của tài khoản: Gemini dùng danh tính `gcloud`, còn OpenRouter và
Cloudflare cần một management/bootstrap key ban đầu mà bạn tự tạo và nhập tại
prompt ẩn. Key mới được lưu vào Windows Credential Locker; giá trị key không
được in ra hoặc ghi vào file. `--overwrite` chỉ thay key lưu cục bộ, không thu
hồi key cũ ở provider.

Tạo key không làm tăng quota miễn phí và không bỏ giới hạn sử dụng. Quota, giá,
điều khoản, endpoint và danh sách provider có thể thay đổi; hãy kiểm tra lại ở
trang chính thức trước khi dùng.

Catalog upstream: [`data.json`](https://github.com/mnfst/awesome-free-llm-apis/blob/main/data.json).
