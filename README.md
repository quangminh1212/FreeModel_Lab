# FreeModel Lab

Danh mục cục bộ để cập nhật nguồn provider có quota free, xem endpoint và lưu API key an toàn để đưa vào công cụ khác. Dự án chạy bằng Node.js/npm trên Windows, macOS và Linux; không cần Python.

Repo upstream [`mnfst/awesome-free-llm-apis`](https://github.com/mnfst/awesome-free-llm-apis) được tải khi mở dashboard và khi bấm **Cập nhật danh sách free**. App chỉ đưa ứng viên vào kho sau khi bạn chủ động chọn **Thêm vào danh mục**. Dữ liệu upstream được ghi nhãn chưa xác minh; hãy mở nguồn provider để đối chiếu quota và điều kiện hiện tại. Danh mục có sẵn bên dưới được kiểm tra riêng với tài liệu chính thức.

## Provider trong registry

| Provider | Quota miễn phí công bố | Endpoint | Trang xem quota |
| --- | --- | --- | --- |
| Google Gemini API | Free tier cho một số model; RPM/TPM/RPD khác nhau theo model, project và tài khoản | `https://generativelanguage.googleapis.com/v1beta` | [AI Studio](https://aistudio.google.com/) |
| Cloudflare Workers AI | 10.000 Neurons/ngày trên Workers Free; reset 00:00 UTC; một số model cần Workers Paid | `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}` | [Cloudflare dashboard](https://dash.cloudflare.com/) |
| GroqCloud | Free plan có giới hạn theo model; xem Free Plan Limits và số hiện tại trong account Limits | `https://api.groq.com/openai/v1` | [Groq Limits](https://console.groq.com/settings/limits) |
| Mistral AI Studio | Free mode gồm usage hàng tháng trong hạn mức; quota và rate theo tổ chức/model | `https://api.mistral.ai/v1` | [Mistral Usage & Limits](https://docs.mistral.ai/admin/billing-usage/usage-limits) |
| OpenRouter | 50 requests/ngày ở Free plan cho free-model access; model miễn phí và capacity thay đổi | `https://openrouter.ai/api/v1` | [OpenRouter pricing](https://openrouter.ai/pricing/) |

Mỗi dòng có nguồn và ngày kiểm tra/cập nhật. Sau 30 ngày, dashboard gắn nhãn nguồn cần kiểm tra lại. App không gửi model request để suy ra quota còn lại. Khi provider chỉ công bố giới hạn trong account, hãy mở link quota chính thức để xem giá trị của tài khoản bạn.

Provider bạn thêm từ upstream và endpoint của chúng được lưu trong thư mục dữ liệu riêng của user; tệp này chỉ chứa metadata, không chứa API key. API key vẫn nằm trong Credential Manager, Keychain hoặc Linux Secret Service.

## Cài từ repo

Cần Node.js 24 trở lên và npm.

```sh
git clone https://github.com/quangminh1212/FreeModel_Lab.git
cd FreeModel_Lab
npm install
npm run build
npm link
```

## Chạy dự án với tự động reload

Trên Windows, mở `run.bat` để tự chuyển vào thư mục dự án, kiểm tra Node.js 24 trở lên, cài dependency và khởi chạy dashboard ở chế độ phát triển. Có thể chạy tương tự trên Windows, macOS và Linux bằng `npm install` rồi `npm run dev`.

Chế độ phát triển theo dõi `src/` và `web/`: sửa TypeScript sẽ tự build lại và restart server; sửa HTML, CSS hoặc JavaScript sẽ tự refresh tab dashboard hiện tại. Dùng `Ctrl+C` để dừng.

Mở dashboard trong Chrome đã đăng nhập:

```sh
freemodel-lab start
```

Lệnh mở URL loopback trong Chrome. Nếu Chrome không mở được tự động, chép URL được in ra vào profile Chrome bạn muốn dùng. Dừng bằng `Ctrl+C`. Dùng `freemodel-lab start --no-open` nếu muốn tự mở trình duyệt.

## Extension và Native Messaging

Extension chỉ nhận quyền `nativeMessaging`; không có quyền cookies, history, debugger hoặc host access tới trang provider. Việc cài đặt host chỉ áp dụng cho user hiện tại.

```sh
freemodel-lab chrome install
```

Trong Chrome, bật **Developer mode** tại `chrome://extensions`, chọn **Load unpacked**, rồi mở đúng thư mục extension mà CLI in ra. Ghim **FreeModel Lab Bridge** và bấm extension để kiểm tra host. Để gỡ host:

```sh
freemodel-lab chrome remove
```

Chrome yêu cầu extension được nạp unpacked thủ công; app không cài extension từ Chrome Web Store. Dashboard vẫn có thể lưu key trực tiếp qua kết nối loopback nếu extension chưa cài.

## Tạo và lưu key

Dashboard có adapter tạo key qua API chính thức cho Gemini, Cloudflare và OpenRouter. Mỗi lần chỉ tạo cho provider bạn chọn; trước khi gửi request phải xác nhận rõ trong giao diện.

- **Gemini:** cần `gcloud auth login`, Google Cloud project, service account đã tồn tại và quyền IAM phù hợp. Key được giới hạn vào Gemini API.
- **Cloudflare:** cần account ID và bootstrap token có quyền tạo account token. App tạo token chỉ có quyền Workers AI Read/Edit, và không lưu bootstrap token.
- **OpenRouter:** cần management key và trần chi tiêu hàng tháng dương. Trần này cho phép phát sinh phí nếu chọn model trả phí; chỉ dùng model free để giữ chi phí ở mức $0.
- **Groq và Mistral:** mở trang key chính thức bằng Chrome, tự hoàn tất xác minh nếu có, rồi dán key vào biểu mẫu trong dashboard.

MFA, CAPTCHA, điều khoản, thanh toán hoặc cấp quyền nhạy cảm luôn do bạn xử lý trong Chrome. App không đọc cookie hay thông tin đăng nhập trong profile, không tự tạo tài khoản, không thu thập OTP và không xoay key/tài khoản để né quota.

Key được lưu trong kho credential native của hệ điều hành: Windows Credential Manager, macOS Keychain hoặc Linux Secret Service. Trên Linux phải có Secret Service như GNOME Keyring/KWallet; app báo lỗi nếu không có, không ghi key vào file hay fallback sang keyutils. `key-status` chỉ báo trạng thái, không hiển thị key.

## Tích hợp với ứng dụng khác

Lệnh sau xuất endpoint và key đã lưu thành JSON để nhập vào ứng dụng hỗ trợ provider đó:

```sh
freemodel-lab integration export groq
freemodel-lab integration export cloudflare-workers-ai --account-id 0123456789abcdef0123456789abcdef
```

JSON được in ra `stdout` có chứa API key. Chỉ chạy lệnh khi bạn định cấu hình ứng dụng đích; không dán kết quả vào chat, issue, log hoặc tệp chia sẻ. Các ứng dụng dùng OpenAI-compatible API thường cần `endpoint` làm base URL, `apiKey` làm API key và một model ID được provider hỗ trợ. Provider khác có thể cần SDK hoặc cách cấu hình riêng.

```sh
freemodel-lab list
freemodel-lab guide gemini
freemodel-lab key-status
freemodel-lab integration export groq
freemodel-lab save-key groq
freemodel-lab save-key groq --replace
freemodel-lab provision gemini --project my-project --service-account-email key-user@my-project.iam.gserviceaccount.com
freemodel-lab provision cloudflare-workers-ai --account-id 0123456789abcdef0123456789abcdef
freemodel-lab provision openrouter --limit-usd 1.00
```

Các key bootstrap của CLI được nhập trong prompt ẩn. Dùng `--replace` chỉ thay key cục bộ; nó không thu hồi key cũ trên provider. Nếu provider đã nhận yêu cầu tạo key nhưng app không thể lưu key, hãy thu hồi key mới trong dashboard provider trước khi thử lại.

## Nguồn quota chính thức

- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) và [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) và [models requiring Workers Paid](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Mistral usage and limits](https://docs.mistral.ai/admin/billing-usage/usage-limits)
- [OpenRouter pricing](https://openrouter.ai/pricing/) và [free models](https://openrouter.ai/collections/free-models/)

Quota miễn phí là quyền sử dụng có giới hạn, không phải dịch vụ vô hạn hay cam kết uptime. Kiểm tra nguồn trong dashboard trước khi đưa vào ứng dụng cần độ tin cậy cao.
