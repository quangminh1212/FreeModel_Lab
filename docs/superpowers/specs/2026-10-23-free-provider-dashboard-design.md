# Đặc tả thiết kế: Dashboard quota miễn phí và tạo API key

**Trạng thái:** Bản cập nhật để người dùng duyệt
**Ngày:** 2026-10-23
**Repo:** FreeModel_Lab

## 1. Mục tiêu

Xây dựng một ứng dụng local phân phối qua npm, chạy trên Windows, Linux và macOS. Giao diện chính giúp người dùng:

- Xem quota miễn phí đang được provider công bố cho từng model: RPM, RPD, TPM, token/request mỗi ngày hoặc chu kỳ khác.
- Xem số quota còn lại theo tài khoản chỉ khi provider có API chính thức để đọc số liệu đó.
- Xem endpoint và nguồn chính thức của quota.
- Tạo API key bằng API chính thức hoặc hỗ trợ thao tác trên trang provider trong Chrome đã đăng nhập; lưu key vào kho bí mật của hệ điều hành.

Danh sách upstream chỉ dùng để tìm provider ứng viên. Ứng dụng chỉ đưa vào danh sách đang hoạt động khi tài liệu chính thức xác nhận provider còn quota miễn phí duy trì. Không đưa trial hoặc credit một lần vào danh sách.

## 2. Nền tảng và cách cài

- Viết ứng dụng bằng Node.js và TypeScript, đóng gói thành npm package. Không yêu cầu cài Python.
- Hỗ trợ các bản Node.js LTS đang được hỗ trợ, Chrome Stable và ba hệ điều hành Windows, macOS, Linux; ma trận phát hành tối thiểu gồm Windows x64, macOS x64/arm64 và Linux x64/arm64.
- Tên package trong ví dụ là tên làm việc; chốt tên khi triển khai.
- Chạy npx free-provider-dashboard setup để mở wizard; wizard hướng dẫn nạp extension local vào Chrome trước, sau đó đăng ký host và xác minh handshake. Tiếp theo chạy npx free-provider-dashboard start. Nếu cài toàn cục bằng npm install -g free-provider-dashboard thì dùng free-provider-dashboard setup và free-provider-dashboard start. Trong repo, nhà phát triển dùng npm install và npm run dev.
- Ứng dụng chạy local, mở giao diện trong Chrome profile người dùng đã đăng nhập. Không tạo profile Chrome mới và không truy cập cookie hay dữ liệu đăng nhập.
- Cài package không tự sửa registry, cài extension hoặc thay đổi cấu hình browser. Lệnh setup riêng đăng ký host cho tài khoản hiện tại, kiểm tra handshake và có lệnh remove chỉ xóa tài nguyên do ứng dụng tạo.
- Package chứa host executable thực sự cho từng OS/architecture được hỗ trợ; không đăng ký npm shell shim làm native host. Trên Windows đăng ký host trong HKCU; trên macOS/Linux ghi manifest vào thư mục Native Messaging của Chrome/Chromium thuộc người dùng. Đường dẫn executable phải tuyệt đối trên macOS/Linux, và extension chỉ được phép gọi host qua extension ID cố định.
- Người dùng nạp extension local vào Chrome bằng Developer mode theo hướng dẫn cài đặt. Không tải extension hoặc mã chạy động từ catalog/provider.

## 3. Quy tắc danh sách và dữ liệu quota

Một provider chỉ được liệt kê khi có nguồn chính thức gần đây xác nhận ongoing free tier và ít nhất một mức quota miễn phí. Upstream awesome-free-llm-apis là nguồn khám phá, không phải căn cứ xác minh.

Màn hình chính tập trung vào:

| Trường | Nội dung |
| --- | --- |
| Provider / model | Provider và model được tài liệu xác nhận có quota miễn phí |
| Quota miễn phí | Giới hạn được công bố, ví dụ RPM, RPD, TPM, token/ngày hoặc quota theo chu kỳ |
| Quota còn lại | Chỉ hiện số tài khoản live khi provider có API usage/quota chính thức; nếu không thì ghi “không có số live chính thức” |
| Endpoint | Endpoint API chính thức nếu provider công bố |
| Nguồn / kiểm tra | Liên kết tài liệu chính thức và ngày kiểm chứng gần nhất |

Mỗi quota có đơn vị, chu kỳ và múi giờ reset nếu được công bố, phạm vi áp dụng (model/project/account), URL nguồn và thời điểm kiểm chứng. Mỗi số liệu được gắn loại: quota công bố hoặc quota live theo tài khoản.

Không suy ra quota còn lại từ RPM/RPD, giá, lần gọi thử, HTTP 429 hoặc dữ liệu của provider khác. HTTP 429 chỉ được ghi nhận là giới hạn/rate limit trừ khi API quota chính thức trả riêng số dư còn lại. Không gọi API nền liên tục. Số live chỉ được làm mới theo thao tác người dùng hoặc lần mở bảng quota khi API chính thức hỗ trợ.

Metadata quota quá 30 ngày được đánh dấu cũ và không được trình bày như quota hiện tại cho đến khi xác minh lại. Nếu nguồn chính thức không còn xác nhận quota miễn phí, ẩn provider khỏi danh sách đang hoạt động. Điều kiện tài khoản, khu vực hoặc thẻ chỉ hiển thị khi cần thiết để giải thích ai được hưởng đúng quota đó.

## 4. Trải nghiệm người dùng

Bảng mặc định ưu tiên provider/model và quota miễn phí. Người dùng có thể mở chi tiết một provider để xem endpoint, nguồn, trạng thái key và nút tạo/quản lý key. Chỉ những thông tin này được đưa vào danh mục; không cần trang tổng quan riêng về mô tả dịch vụ hay giá gói trả phí.

Các thao tác:

- **Làm mới danh mục:** cập nhật danh sách ứng viên upstream và kiểm tra nguồn đã cấu hình; dữ liệu upstream chưa xác minh không xuất hiện thành quota đang hoạt động.
- **Mở nguồn:** mở tài liệu chính thức về quota hoặc trang API usage của provider.
- **Làm mới quota tài khoản:** gọi API quota chính thức, chỉ với provider hỗ trợ.
- **Tạo key:** chỉ bắt đầu khi người dùng bấm nút cho provider đó.
- **Sao chép endpoint:** sao chép endpoint công khai nếu người dùng yêu cầu.

Không chạy kiểm tra kết nối hoặc gọi model ngầm. Không tuyên bố quota live chỉ vì key hoạt động.

## 5. Kiến trúc

1. **Node.js local service:** phục vụ UI/API tại loopback, điều phối registry, quota API, provider adapters và kho bí mật; chạy bằng Node.js LTS còn được hỗ trợ.
2. **Local web UI:** chạy trong Chrome hiện có của người dùng. Bảo vệ API local bằng token phiên ngẫu nhiên, xác minh Origin/CSRF và không bật CORS rộng.
3. **Chrome extension:** chỉ xin quyền host theo domain provider đang được xử lý. Khi cần UI automation, thao tác trên tab provider đang hiển thị trong profile người dùng.
4. **Native Messaging host:** host executable theo OS/architecture, được phân phối cùng package npm hoặc optional package tương ứng, làm cầu nối extension với service/kho bí mật. Host chỉ cho phép extension ID được khai báo; kiểm tra origin và schema từng message.
5. **Provider registry:** metadata quota đã xác minh, endpoint, nguồn, verified_at và capability cho quota live/key provisioning. Đồng bộ upstream chỉ tạo ứng viên, không ghi đè dữ liệu đã xác minh.
6. **Quota adapters:** đọc quota tài khoản qua API chính thức nếu có; chuẩn hóa giới hạn, đơn vị, chu kỳ và thời điểm đo.
7. **Key provisioning adapters:** dùng API provisioning chính thức khi provider hỗ trợ; nếu không, dùng Chrome flow đã được kiểm chứng hoặc hướng dẫn thủ công.

Luồng chính:

    Dashboard local trong Chrome
      -> Node.js service
        -> registry quota đã xác minh
        -> API quota chính thức (nếu có)
        -> API provisioning chính thức (nếu có)
      -> Chrome extension trong profile đã đăng nhập
        -> Native Messaging host
          -> kho bí mật của hệ điều hành

Native Messaging có cấu hình theo hệ điều hành: Chrome dùng registry trên Windows và thư mục manifest theo browser trên macOS/Linux. Đường dẫn, quyền thực thi và handshake được kiểm tra ở bước setup. Host dùng giao thức JSON UTF-8 có tiền tố độ dài trên stdin/stdout; stdout chỉ dành cho frame giao thức, log và chẩn đoán đi qua stderr. Không dùng Chrome remote debugging/CDP.

## 6. Tạo và lưu API key

- Chỉ dùng endpoint API provisioning chính thức hoặc domain dashboard chính thức của provider.
- API provisioning có thể yêu cầu bootstrap token/quyền mà người dùng cấp trước. Không tự lấy credential từ Chrome.
- Với dashboard flow, extension mở đúng domain trong profile đã đăng nhập và chỉ thao tác sau khi người dùng yêu cầu tạo key.
- Khi gặp MFA, CAPTCHA, xác nhận điều khoản, xác nhận thanh toán hoặc quyền nhạy cảm, dừng để người dùng tự xử lý trong Chrome. Không tự tạo tài khoản, nhập/lưu mật khẩu, lấy OTP hoặc vượt cơ chế bảo vệ.
- Chỉ đọc key vừa tạo từ kết quả UI đã xác định rõ rồi chuyển thẳng qua Native Messaging vào kho bí mật. Nếu selector hoặc kết quả không chắc chắn, dừng và đưa hướng dẫn thủ công.
- Không tự tạo lại key sau lỗi mạng hoặc lỗi lưu; tránh tạo nhiều key ngoài ý muốn. Ghi đè key cũ cần xác nhận riêng.
- Nếu provider có đường dùng miễn phí không cần key, thể hiện rõ trong chi tiết provider.
- Không xoay key/tài khoản để né quota. Không hứa hẹn miễn phí không giới hạn.

## 7. Lưu trữ bí mật đa nền tảng

Dùng abstraction cho kho thông tin xác thực của hệ điều hành:

- Windows: Windows Credential Manager.
- macOS: Keychain.
- Linux: Secret Service có backend tương thích, như GNOME Keyring hoặc KWallet. Cấu hình thư viện phải yêu cầu Secret Service và báo lỗi nếu không có; không âm thầm rơi về keyutils chỉ lưu trong bộ nhớ kernel.
- Có thể đánh giá @napi-rs/keyring làm thư viện nền, nhưng phải xác nhận binary/package support và hành vi trên ma trận hệ điều hành trước khi chốt dependency.

Key không được ghi vào file catalog, localStorage, database dashboard, log, telemetry, exception, clipboard tự động hoặc giao diện sau khi lưu. Nếu kho bí mật không sẵn sàng, không lưu key dạng rõ; báo cách bật/cài keyring rồi cho người dùng thử lưu lại.

## 8. Ranh giới tự động hóa và quyền riêng tư

- Không đọc cookie, localStorage/sessionStorage, database profile hoặc file cấu hình đăng nhập Chrome.
- Không xin quyền extension cookies/debugger. Chỉ cấp host permission đúng domain provider cho thao tác người dùng yêu cầu.
- Không tự xử lý MFA/CAPTCHA, điều khoản, thanh toán hay đăng nhập.
- Không gọi quota/model liên tục hoặc retry khi bị giới hạn. Tôn trọng điều khoản và rate limit từng provider.
- Chỉ bind local service vào 127.0.0.1; xác minh Origin/CSRF và token phiên; extension và host xác minh origin/message.
- Chẩn đoán không bao giờ chứa giá trị key, header Authorization hoặc response body nhạy cảm.

## 9. Lỗi và trạng thái không chắc chắn

- Upstream không truy cập được: giữ dữ liệu đã xác minh, báo lần đồng bộ thất bại và không nâng provider mới lên trạng thái free.
- Nguồn chính thức thiếu hoặc quá hạn: đánh dấu cần xác minh; không gọi đó là quota hiện tại.
- Không có API quota account: vẫn hiển thị quota miễn phí công bố và ghi rõ không có số live chính thức.
- API quota trả lỗi xác thực/rate limit/mạng: hiển thị nhóm lỗi, thời điểm đo và hướng xử lý; không tự retry.
- Native Messaging hoặc kho bí mật lỗi: không báo đã lưu key; giữ tiến trình tạo key ở trạng thái cần xử lý nếu có thể, không tạo lại tự động.
- Trang provider thay đổi hoặc selector không chắc chắn: dừng automation và đưa hướng dẫn thủ công.

## 10. Phạm vi bản đầu

Bao gồm:

- npm package TypeScript chạy local trên Windows, Linux và macOS.
- Dashboard quota miễn phí với nguồn, thời điểm kiểm chứng, endpoint và quota live khi provider có API chính thức.
- Registry chỉ giữ provider có ongoing free quota đã được xác minh.
- Các flow tạo key hiện có được chuyển sang Node.js hoặc viết lại, ưu tiên API provisioning chính thức; Chrome extension/Native Messaging cho dashboard flow được hỗ trợ.
- Kho bí mật native của ba hệ điều hành.
- Lệnh CLI npm để mở dashboard và hướng dẫn/quản lý key; không yêu cầu cài Python.

Không bao gồm:

- Trial-only/credit khuyến mại một lần hoặc provider không xác nhận quota free hiện tại.
- Tự tạo tài khoản, tự xử lý thông tin đăng nhập/MFA/CAPTCHA/điều khoản/thanh toán.
- Quota prediction, polling liên tục, xoay account/key hoặc quota evasion.
- Đọc private browser profile hay tạo profile Chrome riêng.
- Xác nhận quota live bằng cách suy diễn từ lần gọi thử model.

## 11. Tiêu chí chấp nhận

1. Cài/chạy từ npm trên Windows, Linux và macOS theo hướng dẫn; không cần Python.
2. Cài đặt Native Messaging cho Chrome theo user scope của từng hệ điều hành, hoàn tất handshake extension-host và có lệnh gỡ cài đặt tương ứng.
3. Danh sách đang hoạt động chỉ gồm provider có nguồn chính thức xác nhận ongoing free quota; mỗi hàng có quota, model, endpoint nếu có, nguồn và verified_at.
4. Quota công bố được phân biệt rõ với quota còn lại live. Không có API live thì UI nói rõ không có số live chính thức.
5. Dữ liệu quá hạn không được trình bày như hiện tại.
6. Khi provider hỗ trợ, người dùng có thể bấm để đọc quota account hoặc tạo key; không phát sinh gọi nền liên tục.
7. Key được lưu vào kho native của OS. Linux thiếu Secret Service thì báo lỗi rõ, không rơi về keyutils hoặc file rõ.
8. MFA/CAPTCHA/điều khoản/xác nhận thanh toán dừng để người dùng thao tác; key không xuất hiện trong log/UI sau khi lưu.
9. Nếu automation không chắc chắn, dừng an toàn và đưa fallback thủ công.

## 12. Nguồn và căn cứ thiết kế

- [Danh sách provider upstream](https://github.com/mnfst/awesome-free-llm-apis/blob/main/data.json) — chỉ dùng để khám phá ứng viên.
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases) — chọn Node.js LTS còn được hỗ trợ.
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) — cấu hình manifest và đăng ký host khác nhau theo Windows, macOS và Linux; extension phải có origin được cho phép cụ thể.
- [@napi-rs/keyring trên npm](https://www.npmjs.com/package/@napi-rs/keyring?activeTab=readme) — thư viện ứng viên cho kho bí mật native; Linux phải pin Secret Service để tránh fallback keyutils không bền vững.
- [Google API Keys create](https://docs.cloud.google.com/api-keys/docs/reference/rest/v2/projects.locations.keys/create), [Cloudflare tạo token qua API](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/), [OpenRouter tạo API key](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key) — ví dụ nguồn provisioning; adapter chỉ dùng khi quyền/token bootstrap được cấp rõ ràng.
- Mã hiện tại trong provider_helper.py, README.md, AI_GUIDE.md và requirements.txt là căn cứ để giữ lại hành vi cần thiết khi chuyển sang npm.
