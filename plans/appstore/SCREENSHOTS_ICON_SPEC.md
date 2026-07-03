# DeutschFlow — Screenshots & Icon Spec (App Store)

Tài liệu này xác định bộ tài sản hình ảnh cần chuẩn bị để upload lên App Store Connect: **app icon** và **screenshots iPhone**. Vì app đặt `supportsTablet: false`, **không cần và không được thêm screenshot iPad** — App Store Connect sẽ không yêu cầu tab iPad.

This document defines the visual assets required for the App Store Connect submission: the **app icon** and the **iPhone screenshots**. Because the app ships `supportsTablet: false`, **no iPad screenshots are needed or accepted** — App Store Connect will not surface an iPad tab.

---

## 1. App icon (marketing 1024×1024)

Icon marketing đã sẵn sàng, không cần dựng lại. / The marketing icon is ready as-is — no rework needed.

| Yêu cầu Apple / Apple requirement | Trạng thái / Status |
|---|---|
| 1024×1024 px, PNG | ✅ `mobile/assets/icon.png` verified `pixelWidth: 1024`, `pixelHeight: 1024` |
| Không alpha / không trong suốt (no alpha channel) | ✅ verified `hasAlpha: no` |
| Góc vuông đặc — Apple tự bo (square, Apple masks the corners) | ✅ (no alpha ⇒ nền đặc, Apple bo góc khi hiển thị) |
| Không viền/bóng giả, không chữ bị cắt sát mép | Kiểm tra bằng mắt trước khi nộp / eye-check before submit |

➡️ **Dùng trực tiếp `mobile/assets/icon.png` cho App Store icon.** Icon hiển thị trên Store được lấy từ chính build đã submit, nên chỉ cần đảm bảo file này đã nằm trong build (nó là icon nguồn của app). Không cần export bản riêng cho App Store Connect. Chỉ dựng lại nếu chủ động muốn refresh branding (gold `#FFCD00` / red `#DA291C`).

➡️ **Use `mobile/assets/icon.png` directly.** The Store icon is pulled from the submitted build, so as long as this file is the app's source icon (it is), nothing extra needs uploading. Rebuild only if intentionally refreshing branding.

Xác minh lại bất cứ lúc nào / re-verify anytime:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha mobile/assets/icon.png
# expect: pixelWidth 1024 / pixelHeight 1024 / hasAlpha no
```

---

## 2. Screenshots iPhone

### 2.1 Kích thước & số lượng / Dimensions & count

- **Bắt buộc: 6.9″ = `1320×2868` px, portrait.** Đây là kích thước duy nhất App Store Connect thực sự đòi cho iPhone hiện nay; nộp bộ lớn nhất này là đủ, Apple tự dùng lại cho các máy nhỏ hơn.
- Thiết bị tạo đúng `1320×2868`: **iPhone 16 Pro Max** (simulator hoặc máy thật). Không dùng máy khác vì kích thước sẽ lệch.
- Tối thiểu **1** ảnh, tối đa **10** ảnh cho mỗi ngôn ngữ hiển thị.
- **Pixel phải khớp tuyệt đối** — lệch dù 1px là bị từ chối khi upload. Luôn verify bằng `sips` (mục 2.4).

- **Required: 6.9″ = `1320×2868` px, portrait.** This is the only iPhone size App Store Connect currently demands; submitting this largest set is sufficient and Apple reuses it for smaller devices.
- Device that produces exactly `1320×2868`: **iPhone 16 Pro Max** (simulator or physical). Do not use another model — the pixel size will differ.
- Minimum **1**, maximum **10** images per displayed locale.
- **Pixels must match exactly** — even a 1px mismatch is rejected on upload. Always verify with `sips` (§2.4).

### 2.2 Bộ 6–8 màn đề xuất / Suggested 6–8 screen set

Thứ tự trong bảng = thứ tự hiển thị trên Store. **Ảnh 1–2 quan trọng nhất** (hiện ngay ở kết quả tìm kiếm). Tất cả route nằm dưới `mobile/app/(student)/` và đã được xác minh tồn tại.

Table order = Store display order. **Screens 1–2 matter most** (shown directly in search results). All routes live under `mobile/app/(student)/` and are verified to exist.

| # | Màn / Screen | Route | Vì sao chọn / Why | Caption EN | Caption VI |
|---|---|---|---|---|---|
| 1 | Cây học tập / Home | `index.tsx` (hoặc `roadmap.tsx`) | Ấn tượng đầu; thể hiện lộ trình A1→B1 | Your path from A1 to B1 | Lộ trình A1 → B1 của bạn |
| 2 | AI Speaking | `speaking.tsx` | Tính năng khác biệt nhất | Speak German, get instant feedback | Nói tiếng Đức, phản hồi tức thì |
| 3 | Thi thử Goethe / Mock exam | `exam.tsx` (list) hoặc `exam-attempt.tsx` (đang thi) | Đúng nhu cầu "pass Goethe" | Full mock Goethe exams | Thi thử Goethe đầy đủ |
| 4 | Bài học / Lesson node | `learn.tsx` hoặc `node.tsx` | Học qua thực hành, ngắn gọn | Bite-size lessons that stick | Bài học ngắn, nhớ lâu |
| 5 | SRS / Từ vựng | `srs.tsx` hoặc `vocabulary.tsx` | Điểm mạnh ghi nhớ ngắt quãng | Smart spaced repetition | Lặp lại ngắt quãng thông minh |
| 6 | Tiến độ / Stats | `stats.tsx` | Tạo động lực, cho thấy tiến bộ | See your mastery grow | Theo dõi tiến bộ mỗi ngày |
| 7 | DeutschFlow Pro (paywall) | `upgrade.tsx` | **Bắt buộc cho review subscription** — reviewer phải thấy paywall rõ giá + chu kỳ + điều khoản | Unlock everything with Pro | Mở khóa tất cả với Pro |
| 8 *(tùy chọn)* | Lớp học / Chat | `classes/index.tsx` hoặc `class-chat/` | Nếu muốn nhấn tính năng lớp học B2B | Learn with your class | Học cùng lớp của bạn |

> **Quảng cáo (Hướng B):** **không** chụp màn có quảng cáo AdMob — ads không phải điểm bán và không cần trưng bày. **Bắt buộc chụp màn Pro (`upgrade.tsx`)** để bộ phận review đánh giá được auto-renewable subscription; ảnh paywall phải thể hiện rõ **giá, chu kỳ gia hạn, và điều khoản**.
>
> **Ads (Strategy B):** do **not** screenshot the AdMob ad surface — ads aren't a selling point. The Pro paywall (`upgrade.tsx`) **must** be included so review can assess the auto-renewable subscription; the paywall image must clearly show **price, renewal period, and terms**.

> ⚠️ **Điều kiện để chụp được paywall trên iOS:** hiện `mobile/lib/paywall.ts:13` đặt `PAYWALL_ENABLED = Platform.OS !== 'ios'`, nên trên iOS màn `upgrade.tsx` đang bị vô hiệu hóa. Trước khi chụp ảnh #7, phải bật paywall iOS (đây cũng là điều kiện của bản build monetization). Nếu chưa bật kịp, dùng bản build đã bật IAP để chụp, không chụp từ build đang tắt paywall.
>
> ⚠️ **Precondition for the iOS paywall shot:** `mobile/lib/paywall.ts:13` currently sets `PAYWALL_ENABLED = Platform.OS !== 'ios'`, so `upgrade.tsx` is disabled on iOS. Screenshot #7 requires the iOS paywall to be enabled first (also a prerequisite of the monetization build). Capture it from an IAP-enabled build, not from a paywall-disabled one.

### 2.3 Cách chụp bằng simulator / Capture via simulator

```bash
# 1. Chạy app trên iPhone 16 Pro Max / run on iPhone 16 Pro Max
cd mobile
npx expo run:ios --device "iPhone 16 Pro Max"
# (hoặc mở dev-client / bản build đã cài rồi chọn simulator "iPhone 16 Pro Max")

# 2. Điều hướng tới từng màn, rồi chụp (ảnh xuất ra file đúng 1320×2868):
#    navigate to each screen, then capture (file comes out at 1320×2868):
xcrun simctl io booted screenshot ~/Desktop/deutschflow-ss-01.png
xcrun simctl io booted screenshot ~/Desktop/deutschflow-ss-02.png
# ... lặp lại cho từng màn / repeat per screen: -03, -04, ...
```

### 2.4 Xác minh kích thước (bắt buộc) / Verify size (mandatory)

```bash
# Mỗi ảnh phải in ĐÚNG pixelWidth 1320 / pixelHeight 2868:
for f in ~/Desktop/deutschflow-ss-*.png; do
  echo "$f"; sips -g pixelWidth -g pixelHeight "$f"
done
# pixelWidth: 1320
# pixelHeight: 2868
```

Ảnh nào không phải `1320×2868` sẽ bị App Store Connect từ chối → chụp lại đúng thiết bị iPhone 16 Pro Max.
Any file that isn't `1320×2868` will be rejected → recapture on the iPhone 16 Pro Max exactly.

### 2.5 Chuẩn bị dữ liệu trước khi chụp / Data prep before capturing

- Đăng nhập tài khoản có **dữ liệu học thật**: cây học tập đã "mọc", có streak, có điểm số, có từ vựng đến hạn → ảnh sinh động hơn hẳn màn trống. / Log in with an account that has **real learning data** (grown skill tree, streak, scores, due vocabulary) — far more convincing than empty states.
- Chụp màn Stats khi đã có tiến độ; chụp SRS khi có thẻ đến hạn; chụp Exam ở giữa một lần làm bài để thấy câu hỏi thật. / Capture Stats with progress, SRS with due cards, Exam mid-attempt showing real questions.
- Khớp ngôn ngữ app với locale của bộ ảnh: nếu định nộp cả **VI** (`vi`) và **EN** (`en-US`), chụp **hai bộ riêng**, đổi ngôn ngữ app giữa hai lần chụp. Tối thiểu một bộ. / Match app language to the screenshot locale: for both **VI** (`vi`) and **EN** (`en-US`), capture **two separate sets**, switching app language between runs. One set minimum.
- Ẩn thông tin nhạy cảm (email thật, tên thật) nếu vô tình hiển thị. / Hide any PII (real email, real name) that appears.

### 2.6 (Tùy chọn) Khung viền + caption marketing / Optional device frame + marketing caption

- Có thể ghép ảnh raw vào "device frame" và thêm caption marketing ở phần trên (nhiều app làm để đẹp hơn). Nếu làm, ảnh cuối **vẫn phải đúng `1320×2868`**. / You may compose the raw shots into a device frame with a marketing caption on top; the final image **must still be `1320×2868`**.
- Công cụ: Figma (repo có MCP Figma), hoặc giữ nguyên ảnh raw cho v1.0 để ra mắt nhanh. / Tooling: Figma (MCP available), or ship raw shots for a fast v1.0 launch.
- Nếu ghép khung, dùng cặp caption EN/VI trong bảng §2.2. / If framing, reuse the EN/VI caption pairs from §2.2.

---

## 3. (Tùy chọn) App Preview video / Optional App Preview video

- 15–30 giây, quay bằng simulator hoặc máy thật, đúng độ phân giải thiết bị 6.9″. Không bắt buộc cho v1.0 — có thể bổ sung ở bản cập nhật sau. / 15–30s, recorded on simulator or device at the 6.9″ resolution. Not required for v1.0 — can be added in a later update.
- Nếu làm: dựng flow ngắn qua Home → Speaking → Exam để thể hiện tính năng cốt lõi. / If made: a short Home → Speaking → Exam flow showcasing the core features.

---

## 4. Checklist tài sản hình ảnh / Visual asset checklist

- [ ] Icon 1024 xác nhận `1024×1024`, `hasAlpha: no` (dùng `mobile/assets/icon.png`)
- [ ] ≥6 screenshots 6.9″, mỗi ảnh verified `1320×2868` bằng `sips`
- [ ] Màn Pro/paywall (`upgrade.tsx`) có trong bộ ảnh, hiển thị rõ giá + chu kỳ + điều khoản
- [ ] iOS paywall đã được bật (`lib/paywall.ts`) trên build dùng để chụp ảnh #7
- [ ] KHÔNG có màn quảng cáo trong bộ ảnh
- [ ] Không lộ PII trong bất kỳ ảnh nào
- [ ] Caption EN + VI chuẩn bị sẵn (nếu ghép khung)
- [ ] *(Tùy chọn)* Bộ ảnh riêng cho locale `vi` và `en-US`
- [ ] *(Tùy chọn)* App Preview video 15–30s
