# FreeModel Lab

Công cụ tra cứu endpoint và hướng dẫn thiết lập API key cho các provider trong [awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis).

Repo lấy **metadata công khai** từ upstream `data.json`: provider, base URL, trang thiết lập key, model và quota được liệt kê. Nó không tự đăng nhập vào nhà cung cấp hoặc đọc cookie/phiên trình duyệt.

API key được tạo trên trang chính thức của từng provider. Trên Windows, `save-key` nhận key bằng prompt ẩn rồi lưu vào Windows Credential Locker thông qua `keyring`. Key không được in ra, ghi vào file hay gửi lên repo.

## Chạy

Cần Python 3.10 trở lên.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Lệnh

```powershell
# Lấy metadata mới nhất về cache cục bộ
python .\provider_helper.py sync

# Liệt kê endpoint và trang thiết lập key
python .\provider_helper.py list

# Xem hướng dẫn cho một provider
python .\provider_helper.py guide "Google Gemini"

# Sau khi tự tạo key trên trang chính thức, nhập key bằng prompt ẩn
python .\provider_helper.py save-key "Google Gemini"

# Chỉ kiểm tra key đã lưu hay chưa; không hiển thị key
python .\provider_helper.py key-status "Google Gemini"
```

Metadata cache nằm trong `.cache/providers.json`. Chạy `sync` để cập nhật. Endpoint, model và quota có thể đổi; kiểm tra lại thông tin ở provider trước khi dùng.

## Gmail và quyền truy cập

Gmail có thể dùng để đăng nhập Google AI Studio nếu provider hỗ trợ đăng nhập Google. Điều đó chỉ vào tài khoản của provider đó; mỗi provider cấp key và quyền riêng. [AI_GUIDE.md](AI_GUIDE.md) hướng dẫn AI chỉ người dùng tạo key trên trang chính thức rồi lưu vào Credential Locker.

Không lấy key qua cookie, token phiên, hồ sơ trình duyệt, clipboard hoặc mật khẩu đã lưu. Không tự tạo nhiều tài khoản hay xoay key để vượt quota. Repo không bảo đảm hạn mức miễn phí dùng liên tục.

## Nguồn dữ liệu

- Catalog: [`mnfst/awesome-free-llm-apis/data.json`](https://github.com/mnfst/awesome-free-llm-apis/blob/main/data.json)
- Upstream gắn giấy phép CC0-1.0 cho danh sách. Nội dung do upstream duy trì và có thể lỗi thời.
