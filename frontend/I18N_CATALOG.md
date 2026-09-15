# Catalog i18n — hình dạng, đường đi tới trình duyệt, và bốn cổng canh

Tài liệu này nói về **cơ chế**: catalog nằm ở đâu, phần nào tới được trình duyệt, và phép kiểm nào
bắt lỗi gì. Tiến độ dịch từng màn nằm ở [`I18N_V2_PROGRESS.md`](I18N_V2_PROGRESS.md).

Đọc trước khi: thêm một khu (`area`) mới, thêm `useTranslations` vào component dùng chéo khu, đổi
`messagesForV2Areas` của một layout, hay dọn chuỗi trong `messages/`.

---

## 1. Hai tầng catalog

| Tầng | Tệp | Vai trò |
|---|---|---|
| **gốc** | `messages/{vi,en,de}.json` | tàn dư thời v1. Sau đợt dọn 07/09/2026 chỉ còn **`nav`, `learn`, `speaking`** — đúng ba namespace còn call site. |
| **/v2** | `messages/v2/<area>.<locale>.json` | catalog thật của sản phẩm hiện tại, chia theo khu. Danh sách khu là `V2_AREAS` trong `src/i18n/request.ts`. |

`request.ts` nạp tệp gốc + **mọi** area rồi merge: `{ ...base, v2: {…mọi area…} }`. Lưu ý hình dạng
`chrome.<locale>.json` được merge **phẳng** vào gốc `v2` — **không tồn tại node `v2.chrome`**; các
nhóm `nav`, `shell`, `common`, `error`, `ui`, `maintenance`, `notif`, `inbox`, `system` nằm ngang
hàng với `student`, `teacher`…

## 2. Từ catalog tới trình duyệt: provider theo khu

next-intl serialize messages của `NextIntlClientProvider` vào **payload HTML của từng trang**. Nếu
mọi provider mang trọn catalog thì mỗi lượt tải trang cõng cả những khu người dùng không bao giờ mở.

Vì vậy mỗi khu có provider riêng, khai phần mình cần qua `messagesForV2Areas`
([`src/i18n/pickV2Messages.ts`](src/i18n/pickV2Messages.ts)):

| Layout | Khai báo |
|---|---|
| `src/app/layout.tsx` | `auth`, `onboarding`, `account`, `org.accept`, `landing`, `student.micGuide`, `base:nav` |
| `src/app/v2/student/layout.tsx` | `student`, `base:learn`, `base:speaking` |
| `src/app/v2/teacher/layout.tsx` | `teacher` |
| `src/app/v2/org/layout.tsx` | `org` |
| `src/app/v2/admin/layout.tsx` | `adminOps`, `adminContent`, `student.examSpeaking` |

Ba quy tắc của hàm này:

1. **Lõi chrome luôn có** ở mọi provider — suy ra từ chính `chrome.vi.json`, không chép tay.
2. **Đường dẫn sâu** kéo đúng nhánh con: `student.micGuide` cấp một nhánh nhỏ chứ không phải cả 76KB
   của khu student. Dùng khi một component render chéo khu.
3. **Catalog gốc phải khai tường minh** bằng tiền tố `base:`; không khai thì không có.

Provider bên trong **đè** provider bên ngoài, nên layout khu phải tự đủ — helper luôn thêm lõi chrome
chính vì lý do đó.

## 3. Bốn cổng, mỗi cổng một lớp lỗi

| Cổng | Câu hỏi nó trả lời | Chạy ở đâu |
|---|---|---|
| `scripts/check-i18n-v2.js` | vi / en / de có khớp nhau không? | `npm run check:i18n` |
| `scripts/check-i18n-usage.js` | source xin khoá nào mà catalog không có? và catalog gốc có namespace nào **không ai gọi**? | `npm run check:i18n` |
| `scripts/check-i18n-providers.mjs` | provider của khu có cấp **đủ** namespace mà cây import của khu đó dùng? | `npm run check:i18n` |
| `src/__tests__/catalogNoEmoji.test.ts` | chuỗi dịch có mang emoji không? | `npm test` |

CI frontend chạy `npm run check:i18n` và `npm test`, nên cả bốn đều gác PR.

Thêm một phép đo ở runtime: ca `không màn nào in khoá i18n thô…` trong
`tests/e2e/v2-smoke.spec.ts` mở landing + dashboard học viên + dashboard giáo viên và soi text.

**Vì sao cần nhiều cổng đến vậy:** ba câu hỏi trên độc lập nhau. Parity vẫn cân khi cả ba locale
cùng thừa một namespace chết; chiều xuôi vẫn xanh khi không ai hỏi tới nó; và cả hai đều mù trước
việc provider thiếu nhánh — mà **next-intl không ném lỗi trong trường hợp đó**: nó in thẳng đường
dẫn khoá ra màn hình người dùng (`v2.shell.logout` đã ra prod đúng như vậy).

## 4. Công thức

**Thêm một area mới**

1. Tạo `messages/v2/<area>.{vi,en,de}.json`.
2. Thêm tên area vào `V2_AREAS` (`src/i18n/request.ts`) — thiếu bước này thì area **không được nạp**
   dù tệp có trên đĩa.
3. Khai area đó trong `messagesForV2Areas` của layout khu sẽ dùng.
4. `npm run check:i18n`.

**Thêm `useTranslations` vào một component dùng chéo khu**

`check-i18n-providers.mjs` sẽ chỉ ra khu nào còn thiếu. Cấp nhánh nhỏ nhất đủ dùng
(`student.micGuide`) thay vì cả khu.

**Dọn chuỗi chết**

Xoá ở cả ba locale cùng lúc, rồi `npm run check:i18n`. Cổng namespace mồ côi chỉ soi **cấp 1 của
catalog gốc** — khoá chết nằm sâu bên trong một namespace còn sống (như 19 khoá `personaName*`)
không cổng nào thấy; phải grep tay.

## 5. Emoji

Chính sách (chốt 02/09/2026, mở rộng sang tầng catalog 07/09): **`GaIcon` là nguồn icon duy nhất
trong `/v2`**; emoji không được đóng vai icon ở bất kỳ tầng nào — JSX, chuỗi dịch, hay cột dữ liệu
(`skill_tree_nodes.emoji` dịch qua `emojiIconMap` → `GaGlyph`).

Emoji chỉ còn ở chỗ nó là **nội dung**: cờ quốc gia, avatar mentor/persona và lời chào persona
(`lib/personas.ts`), tranh SVG nhân vật + motif Lernbaum, huy hiệu thành tích. Trong catalog `/v2`
có đúng bốn khoá miễn trừ, liệt kê trong `catalogNoEmoji.test.ts`; catalog gốc **không có ngoại lệ**.

## 6. Bẫy đã cắn

- **Payload là thứ đo được, không phải thứ đoán.** Đo bằng `curl <trang> | wc -c` trên bản dựng
  production (`next build && next start`), đừng đo trên dev server. Trong ngày 07/09/2026, ba đợt dọn
  đưa HTML `/` từ 179.024 xuống 110.026 byte và `/v2/login/` từ 138.746 xuống 69.748.
- **Chuỗi không hiển thị vẫn tốn tiền.** 25 namespace v1 mồ côi (72% tệp gốc) không màn nào đọc,
  nhưng vẫn đi theo từng lượt tải trang — và là chỗ emoji trốn được hai đợt quét trước đó.
- **Quét mã nguồn bằng regex bỏ sót chuỗi đi qua biến.** Sau khi quét ký tự phải grep thêm
  `\.emoji\b` / `\.icon\b`.
- **Bỏ comment phải bằng máy trạng thái, không phải regex.** `/\/\*[\s\S]*?\*\//` nuốt nhầm 150 dòng
  của `(public)/org/accept/client-page.tsx` vì một comment `//` ở đó nhắc đường dẫn `/v2/` kèm dấu
  sao — phép kiểm im lặng kết luận sai "không ai cần `org.accept`". Xem `stripComments` trong
  `check-i18n-usage.js` / `check-i18n-providers.mjs`.
- **`tsconfig.json` không đặt `target`** ⇒ ES5 ⇒ regex cờ `u` là lỗi biên dịch TS1501. Vitest chạy
  được (Vite tự transpile) và `next build` không type-check tệp test, nên chỉ `tsc --noEmit` bắt
  được — chạy nó **sau** khi thêm tệp test.
