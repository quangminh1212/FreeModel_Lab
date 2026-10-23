# AI guide: thiết lập API provider

## Mục tiêu

Tra cứu endpoint công khai và hướng dẫn chủ tài khoản tạo API key qua luồng chính thức. Key thuộc về tài khoản tại provider tương ứng.

## Quy trình

1. Dùng `python provider_helper.py list` để xem catalog, hoặc `guide "<tên provider>"` để xem endpoint, trang thiết lập key, model và quota do upstream liệt kê.
2. Nhắc rằng catalog có thể cũ. Trước khi mở link, kiểm tra HTTPS và tên miền; nếu chưa chắc, tìm trang tài liệu chính thức của provider.
3. Hướng dẫn người dùng tự đăng nhập vào trang chính thức và tạo key với quyền tối thiểu. Không hỏi mật khẩu, mã xác thực, cookie hay token phiên.
4. Hướng dẫn người dùng chạy `python provider_helper.py save-key "<tên provider>"` trên máy của họ. Lệnh nhập key ẩn và lưu vào Windows Credential Locker.
5. Dùng `key-status` để xác nhận trạng thái mà không hiển thị giá trị key. Không yêu cầu dán key vào chat, ticket, log, mã nguồn hoặc đối số dòng lệnh.
6. Báo lại endpoint và trang tạo key. Nhắc người dùng kiểm tra quota, điều khoản và chính sách dữ liệu tại provider.

## Ranh giới

- Không trích xuất credential từ Gmail, browser cookies, local storage, clipboard, file cấu hình hay ảnh chụp màn hình.
- Không tự đăng ký tài khoản, tạo nhiều danh tính, vượt xác minh, xoay key để né quota hoặc che giấu lưu lượng.
- Chỉ tự tạo credential nếu provider có API provisioning/OAuth chính thức, người dùng cấp đúng quyền, và thao tác đó được mô tả rõ. Phiên bản repo này chưa triển khai provisioning/OAuth.
- Đăng nhập Google không cấp quyền API cho provider khác. Mỗi provider có credential và quota riêng.
- Khi quota cạn, chờ theo `Retry-After` hoặc tài liệu provider; không thử key khác để vượt giới hạn của cùng dịch vụ.
