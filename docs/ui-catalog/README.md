# Catalog phong cách UI — FreeModel Lab

Tài liệu này là bản viết của catalog trực quan ở [`index.html`](./index.html).
Mỗi phong cách đều có **mẫu render thật** (không phải ảnh chụp) dựng từ đúng
design token của phong cách đó, trên cùng một mẫu mô phỏng dashboard:
titlebar, sidebar, editor, statusbar.

**Có 47 phong cách, chia 6 nhóm.** Mỗi cái đều dùng được trong dashboard thật
mà không phá vỡ ràng buộc kỹ thuật bên dưới.

## Ràng buộc kỹ thuật (quan trọng)

Dashboard hiện tại là HTML/CSS/JS thuần, phục vụ qua loopback HTTP với CSP rất chặt.
Mọi phong cách trong catalog này đều được chọn để thoả các điều kiện sau:

| Ràng buộc | Hệ quả |
|---|---|
| Chỉ phục vụ đúng **4 file tĩnh** (`/`, `/theme.js`, `/app.js`, `/style.css`) | Không được thêm file `.css`/`.js`/font/ảnh mới vào `web/` |
| CSP chặt, không có `unsafe-inline` | Không inline `<script>`, `<style>`, `style="..."` |
| Không CDN, không font ngoài | Chỉ dùng font hệ thống |
| Markup và JavaScript | Đồng bộ selector, nhãn điều khiển và tên truy cập khi thay đổi DOM |
| Server loopback | Giữ kiểm tra Host/Origin và chỉ thay đổi API khi cần cho bảo mật hoặc hành vi đã công bố |

Vì vậy **mọi phong cách ở đây đều triển khai được chỉ bằng cách sửa `style.css`**
(cộng thêm thuộc tính `data-style` trên `<html>` nếu muốn nhiều bộ theme song song).
Đây là lý do các phong cách nặng JS/animation phụ thuộc thư viện đã bị loại.

## Cách xem

Mở trực tiếp [`index.html`](./index.html) bằng trình duyệt. Trang tự chứa,
không cần chạy server, không cần mạng. Dùng hàng nút lọc để xem theo nhóm.

## Cách đọc điểm "Công sức"

| Điểm | Nghĩa |
|---|---|
| 1/5 | Chỉ đổi biến CSS màu — sửa ~20 dòng `:root` |
| 2/5 | Đổi màu + bo góc + vài chi tiết viền/đổ bóng |
| 3/5 | Cần đổi cả cấu trúc nhịp điệu: mật độ, cỡ chữ, khoảng cách |
| 4–5/5 | Cần viết lại layout (không có trong catalog này — quá rủi ro với `app.js`) |

## Nguồn gốc màu

Các bảng màu sau được lấy **trực tiếp từ file nguồn của repo gốc** trên
`raw.githubusercontent.com` và đã đối chiếu từng mã hex, không phải pha tay:

- **Catppuccin** — `catppuccin/palette` → `palette.json`
- **Nord** — `nordtheme/nord` → `src/nord.scss`
- **Rosé Pine** — `rose-pine/neovim` → `lua/rose-pine/palette.lua`
- **Kanagawa** — `rebelot/kanagawa.nvim` → `lua/kanagawa/colors.lua`
- **One Dark** — `navarasu/onedark.nvim` → `lua/onedark/palette.lua`
- **Gruvbox** — `morhetz/gruvbox` → `colors/gruvbox.vim`
- **Solarized** — `altercation/solarized`
- **Everforest** — `sainnhe/everforest`

Các phong cách "Sáng tác riêng" (Phosphor Terminal, Neon Cyber, Sunset Warm,
High Contrast, Paper & Ink) được dựng theo nguyên tắc thiết kế đã biết,
không sao chép bảng màu của ai.

## Danh mục

_Nhóm, thứ tự và mô tả dưới đây được sinh trực tiếp từ dữ liệu của catalog,
nên luôn khớp với những gì bạn thấy trong `index.html`._
## Editor / IDE

_Phong cách công cụ lập trình — dashboard đang mô phỏng VS Code._

| # | Phong cách | Nguồn | Accent | Nền | Bo góc | Công sức | Mô tả |
|---|---|---|---|---|---|---|---|
| 1 | **VS Code Dark Modern** `vscode-dark-modern` | Design system | `#0078d4` | `#1f1f1f` | 4px | 1/5 | Hiện tại của dashboard. Nền xám trung tính, accent xanh Microsoft, mật độ dày đặc kiểu IDE. |
| 2 | **VS Code Light Modern** `vscode-light-modern` | Design system | `#005fb8` | `#ffffff` | 4px | 1/5 | Bản sáng của VS Code. Trắng tuyệt đối cho editor, xám nhạt cho chrome, viền rất nhẹ. |
| 3 | **GitHub Primer** `github-primer` | Design system | `#238636` | `#0d1117` | 6px | 2/5 | Design system của GitHub. Nền xanh-đen, viền rõ, accent xanh lá, cảm giác 'dev tool chính thống'. |
| 4 | **Catppuccin Mocha** `catppuccin-mocha` | Color theme | `#89b4fa` | `#1e1e2e` | 6px | 1/5 | Pastel trên nền tối. Rất phổ biến trong giới dev, mềm mại, dễ nhìn lâu, cá tính rõ. |
| 5 | **Catppuccin Latte** `catppuccin-latte` | Color theme | `#1e66f5` | `#eff1f5` | 6px | 1/5 | Bản sáng của Catppuccin. Trắng ấm, pastel dịu — dễ chịu hơn nhiều so với trắng tuyệt đối. |
| 6 | **Nord** `nord` | Color theme | `#88c0d0` | `#2e3440` | 4px | 1/5 | Bảng màu Bắc Âu: xanh slate lạnh, ít bão hoà, cực kỳ tĩnh và chuyên nghiệp. |
| 7 | **One Dark** `one-dark` | Color theme | `#61afef` | `#282c34` | 5px | 1/5 | Atom One Dark kinh điển. Xám xanh, accent xanh dương + tím, cân bằng giữa màu và trung tính. |
| 8 | **Kanagawa** `kanagawa` | Color theme | `#7e9cd8` | `#1f1f28` | 4px | 1/5 | Lấy cảm hứng từ tranh thuỷ mặc Nhật. Sumi ink xanh-đen, màu trầm, rất sang và tĩnh. |
| 9 | **Rosé Pine** `rose-pine` | Color theme | `#c4a7e7` | `#191724` | 6px | 1/5 | Tím-hồng dịu trên nền mận. Rất 'aesthetic', nổi bật mà vẫn đọc tốt. |
| 10 | **Rosé Pine Dawn** `rose-pine-dawn` | Color theme | `#907aa9` | `#faf4ed` | 6px | 1/5 | Bản sáng của Rosé Pine. Kem ấm, chữ tím than, rất dịu mắt cho người ghét nền trắng. |

## Tối giản

_Bỏ hết trang trí, chỉ giữ typography và màu. Nhanh, nhẹ, không phân tâm._

| # | Phong cách | Nguồn | Accent | Nền | Bo góc | Công sức | Mô tả |
|---|---|---|---|---|---|---|---|
| 1 | **Pico CSS** `pico` | Open source | `#1095c1` | `#13171f` | 5px | 2/5 | Semantic-first micro-framework. Viền mảnh, bo góc nhẹ, spacing thoáng — 'đúng' mà không cần class. |
| 2 | **Water.css** `water` | Open source | `#1f6feb` | `#202b38` | 4px | 1/5 | Classless stylesheet, tối giản gần như không trang trí. Chỉ typography + màu, không shadow. |
| 3 | **Simple.css** `simple-css` | Open source | `#3b82f6` | `#1d1f21` | 3px | 1/5 | Cực nhẹ, gần như không có 'design'. Đẹp ở chỗ không phô trương, hợp dashboard nội bộ. |
| 4 | **MVP.css** `mvp-css` | Open source | `#2b6fb0` | `#111318` | 2px | 1/5 | Classless với hệ thống spacing rõ ràng, viền mảnh, không bo góc nhiều. Rất 'wireframe sạch'. |
| 5 | **Tufte CSS** `tufte` | Open source | `#a00000` | `#fffff8` | 0px | 3/5 | Kiểu sách in của Edward Tufte: serif, nền kem, không viền, chú thích lề. Rất học thuật. |

## Terminal / Retro

_Cảm giác dòng lệnh và màn hình cũ. Cá tính mạnh._

| # | Phong cách | Nguồn | Accent | Nền | Bo góc | Công sức | Mô tả |
|---|---|---|---|---|---|---|---|
| 1 | **Gruvbox Dark** `gruvbox-dark` | Color theme | `#fabd2f` | `#282828` | 3px | 1/5 | Retro ấm, nâu-vàng. Rất 'máy tính cũ', đầm và dễ chịu, tương phản mạnh nhưng không gắt. |
| 2 | **Phosphor Terminal** `terminal-green` | Sáng tác riêng | `#33ff66` | `#0b0f0b` | 0px | 2/5 | Màn hình CRT xanh lá đơn sắc. Cực cá tính, gần như không dùng được cho dữ liệu nhiều màu. |
| 3 | **Solarized Dark** `solarized-dark` | Color theme | `#268bd2` | `#002b36` | 3px | 1/5 | Ethan Schoonover thiết kế năm 2011, tối ưu độ tương phản có chủ đích. Xanh mòng két trầm. |
| 4 | **Solarized Light** `solarized-light` | Color theme | `#268bd2` | `#fdf6e3` | 3px | 1/5 | Bản sáng của Solarized: nền be ấm #fdf6e3, cực dịu, được thiết kế cho đọc lâu. |
| 5 | **Mono Paper** `mono-paper` | Sáng tác riêng | `#111111` | `#ffffff` | 0px | 1/5 | Đen trắng tuyệt đối, không màu nhấn. Cực kỳ tinh giản — chỉ dùng 1 accent khi cần cảnh báo. |

## SaaS / Product

_Chuẩn thiết kế web app hiện đại 2024: bo góc lớn, viền mờ, tương phản cao._

| # | Phong cách | Nguồn | Accent | Nền | Bo góc | Công sức | Mô tả |
|---|---|---|---|---|---|---|---|
| 1 | **Linear** `linear` | Design system | `#7c6cf0` | `#101014` | 8px | 3/5 | Chuẩn mực SaaS hiện đại 2024: nền tím-than, viền mờ, bo góc lớn, chữ nhỏ gọn, gradient tinh tế. |
| 2 | **Vercel / Geist** `vercel-geist` | Design system | `#ffffff` | `#000000` | 6px | 2/5 | Đen tuyệt đối, tương phản cực mạnh, viền trắng mờ. Rất 'cool' nhưng dễ mỏi mắt nếu dùng lâu. |
| 3 | **shadcn/ui Neutral** `shadcn-neutral` | Open source | `#fafafa` | `#0a0a0a` | 8px | 2/5 | De-facto standard của React 2024. Trung tính, bo góc 8px, viền 1px rõ, không màu thừa. |
| 4 | **Tailwind Slate** `tailwind-slate` | Open source | `#3b82f6` | `#0f172a` | 6px | 2/5 | Bảng màu slate của Tailwind — lạnh, trung tính, sạch. Nền tảng an toàn cho mọi dashboard. |
| 5 | **Notion** `notion` | Design system | `#2383e2` | `#ffffff` | 4px | 2/5 | Tối giản kiểu văn phòng phẩm số: nền trắng ấm, chữ đen, viền gần như vô hình, không màu nhấn. |
| 6 | **Supabase** `supabase` | Design system | `#3ecf8e` | `#121212` | 8px | 2/5 | Xanh lá neon trên nền tối, bo góc lớn, cảm giác hạ tầng hiện đại & năng động. |

## Enterprise

_Design system của các công ty lớn: lưới chặt, ít màu, rõ ràng._

| # | Phong cách | Nguồn | Accent | Nền | Bo góc | Công sức | Mô tả |
|---|---|---|---|---|---|---|---|
| 1 | **Fluent 2 (Microsoft)** `fluent-2` | Design system | `#2b88d8` | `#1f1f1f` | 4px | 3/5 | Microsoft Fluent 2: acrylic mờ, bo góc 4px, accent xanh, rất quen với người dùng Windows. |
| 2 | **IBM Carbon** `carbon` | Design system | `#0f62fe` | `#161616` | 0px | 3/5 | IBM Carbon: lưới 8px nghiêm ngặt, góc vuông hoàn toàn, typography chặt. Rất 'doanh nghiệp lớn'. |
| 3 | **Atlassian Design** `atlassian` | Design system | `#0c66e4` | `#1d2125` | 5px | 2/5 | Jira/Confluence: xanh dương đậm đặc trưng, bo góc vừa, bố cục chắc chắn, thân thiện. |
| 4 | **Material 3** `material-3` | Design system | `#d0bcff` | `#1c1b1f` | 12px | 3/5 | Google Material You: bo góc lớn (12–16px), màu tonal, accent indigo, cảm giác 'app Android'. |
| 5 | **Shopify Polaris** `polaris` | Design system | `#008060` | `#1a1a1a` | 8px | 2/5 | Polaris: nền xám xanh, bo góc 8px, accent xanh lá Shopify. Thân thiện, thương mại. |

## Cá tính mạnh

_Khác hoàn toàn lối mòn: nền màu, neon, giấy mực, tương phản cao._

| # | Phong cách | Nguồn | Accent | Nền | Bo góc | Công sức | Mô tả |
|---|---|---|---|---|---|---|---|
| 1 | **Neon Cyber** `neon-cyber` | Sáng tác riêng | `#ff2d95` | `#0a0612` | 2px | 3/5 | Nền tối hut + accent hồng neon. Rất nổi nhưng dễ gây mỏi mắt. |
| 2 | **Sunset Warm** `sunset-warm` | Sáng tác riêng | `#ff8a4c` | `#211513` | 6px | 2/5 | Nền nâu-đỏ ấm, accent cam. Khác biệt hoàn toàn với các dashboard xanh lạnh thông thường. |
| 3 | **Deep Forest** `forest` | Sáng tác riêng | `#a7c080` | `#232a2e` | 5px | 2/5 | Xanh rêu đậm + accent vàng lá. Rất êm mắt, gợi tự nhiên, ít dashboard dùng. |
| 4 | **High Contrast** `high-contrast` | Sáng tác riêng | `#ffff00` | `#000000` | 0px | 2/5 | Đen tuyệt đối + vàng/vàng cyan, viền 2px. Tùy chọn tương phản cao; chưa được kiểm toán WCAG. |
| 5 | **Paper & Ink** `paper-ink` | Sáng tác riêng | `#b3261e` | `#f7f3e9` | 2px | 3/5 | Serif cho tiêu đề, nền kem, accent đỏ mực. Cảm giác tài liệu in, rất khác biệt với dev tool. |

## Ghi chú khi triển khai

1. **Dark là mặc định**, light là bản chuyển đổi. Mọi phong cách phải có cả hai.
2. Khi đổi markup, đồng bộ selector, label và trạng thái truy cập trong `app.js`.
3. Giữ Host/Origin loopback, CSP và cách ly key trong credential store khi sửa backend.
4. `npm run check:web` là chẩn đoán tham chiếu asset; nó không thay thế build, kiểm tra trực quan hay đánh giá WCAG.
5. GitHub Actions build và kiểm tra cú pháp JavaScript; kiểm tra giao diện bằng tab trình duyệt do Orca quản lý.

## Đề xuất của tôi

Xem hết 36 cái rồi chọn. Nếu bạn muốn tôi quyết luôn:

- **An toàn nhất, gần VS Code nhất:** `vscode-dark-modern` (đang dùng) hoặc
  `github-primer` — cả hai đều 2/5 công sức, đã quen mắt.
- **Đẹp và hiện đại hơn hẳn:** `linear` — nền tối trung tính, accent tím,
  bo góc 8px, thoáng hơn VS Code nhiều. Đây là cái tôi khuyên nếu bạn thấy
  UI hiện tại "chán".
- **Sáng, sạch, dễ đọc:** `notion` hoặc `paper-ink`.
- **Cá tính:** `sunset-warm` (nâu đỏ ấm) — khác hoàn toàn mọi dashboard xanh
  thông thường mà vẫn dễ nhìn.

Nói tên hoặc số thứ tự là tôi triển khai.
---

## Đã áp dụng (2026-10-23)

Bảy điểm "chrome grammar" từ `docs/ui-style-catalog.md` Phần 3 (1) đã được đưa vào
`web/style.css`. Đây là thay đổi CSS/HTML thuần, **không sửa `app.js`**, không thêm
asset mới, không đổi API.

| # | Thay đổi | Trước | Sau |
|---|----------|-------|-----|
| 1 | Chiều cao title bar | 32px | 35px |
| 2 | Icon trong title bar | 16px | 20px |
| 3 | View tab đang chọn | pill nền `--hover-bg` | nền trong, gạch chân 2px `--accent` |
| 4 | Dòng danh sách | 287px, không phủ hết bề ngang | full-bleed 24px, hover/selected phủ cả dòng |
| 5 | Header mục | 11px, ls .02em | 11px/700, ls .06em, chevron `\25B8` |
| 6 | Tab tài liệu | viền trên 1px | `::before` 1px `--accent`, tab active trùng `--editor-bg` |
| 7 | Focus ring | `outline: 2px; offset: 2px` | `outline: 1px; offset: -1px` (inset, không box-shadow) |

Kết quả đo bằng headless Chromium (1440x900):

```text
titlebarH 35 | viewTab h34 + underline 2px rgb(0,120,212) | ico 20px
treeRow h24 full-bleed 287/288 | heading 11px ls 0.66px chevron "▸"
tab.is-active bg rgb(31,31,31) == editor bg, top line 1px accent
focus ring 1px solid / offset -1px
errors [] | consoleErrors [] | horizontalOverflow560 false
```

Trạng thái này được ghi lại trước khi dự án chuyển sang workbench và không phải kết quả kiểm tra hiện tại. Dùng CI build và kiểm tra giao diện hiện tại.

### Bộ chuyển phong cách trong app (2026-10-24)

Thêm một `<select id="style-select">` trong title bar, cạnh nút đổi theme. Đây là
cách duyệt 47 phong cách **ngay trong app thật** với dữ liệu thật, không cần mở
`docs/ui-catalog/index.html`.

| Thành phần | File | Ghi chú |
|------------|------|---------|
| Markup picker | `web/index.html` | `<label class="style-picker">` chèn trong `.titlebar-right`, giữ nguyên mọi id cũ |
| Logic + lưu lựa chọn | `web/theme.js` | `STYLE_KEY = "freemodel-style"`, populate `<option>`, phím `[` `]` đổi tới/lui |
| 36 khối palette | `web/style.css` | sinh tự động giữa marker BEGIN/END, nằm **sau** `:root` để thắng theo thứ tự nguồn |
| Sinh lại palette | `scripts/gen-styles.js --write` | đọc `docs/ui-catalog/index.html`, ghi thẳng vào `web/style.css` |

Quy ước quan trọng:

- Không có `data-style` (hoặc rỗng) = giao diện VS Code Dark Modern gốc, giống hệt
  trước khi thêm tính năng.
- Mỗi khối `[data-style]` tự đặt `color-scheme`, nên scrollbar và control native
  đổi sáng/tối theo.
- Picker chỉ tự đổi `data-theme` khi người dùng **chưa từng** bấm nút đổi theme,
  nên lựa chọn theme tay không bị ghi đè.
- `web/app.js` không bị sửa (sha256 `DED68CDC…0CA373`) — toàn bộ việc đổi phong
  cách nằm trong `style.css` + `theme.js`.

### Sửa lỗi dấu tiếng Việt

Georgia không có glyph dựng sẵn cho khối Latin Extended Additional, nên `ĐIỀU`
hiện thành `ĐIÊ` cộng dấu huyền rời. `scripts/gen-styles.js` loại Georgia khỏi
mọi font stack và đặt `"Times New Roman"` (serif) hoặc `"Segoe UI"` (sans/mono)
lên đầu trước từ khóa generic:

```text
--font-ui: "Times New Roman","Palatino Linotype",Palatino,"Book Antiqua",serif
--font-ui: "Times New Roman","Palatino Linotype",serif
--font-mono: Consolas,"Courier New","Segoe UI",monospace
```

Đã xác nhận bằng ảnh chụp 2× trên `paper-ink`: `Bắt đầu`, `Nguồn provider mới`,
`PROVIDER GẦN ĐÂY`, `được` đều dựng đúng dấu.
