# Runbook — Build & nộp lại **MyDeutschFlow** v1.0 (build 9)

> Xử lý reject **3.1.1** (06/07/2026, submission ec05409d, build 1.0(8)) + **đổi tên app → MyDeutschFlow**.
> Chiến lược: **Hướng A — iOS free thật** (monetize để v1.1). Copy paste-ready cho Apple ở `APPLE_REPLY_3.1.1_2026-07-07.md`.
> Ký hiệu: ✅ = mình đã làm trong repo · ⬜ = việc owner (cần credentials Apple/EAS hoặc thao tác ASC).

---

## 0. Tóm tắt trạng thái

| Nhóm | Trạng thái |
|---|---|
| Chẩn đoán 3.1.1 + audit free-mode | ✅ Code sau PR #201 đã sạch; 0 bề mặt PRO/upgrade/trial reachable trên iOS |
| Metadata scrub (bỏ "Pro"/trial/upgrade) | ✅ `STORE_COPY.md` (Description EN+VI + Review Notes) |
| Reply Apple + Review Notes mới | ✅ `APPLE_REPLY_3.1.1_2026-07-07.md` §A/§B |
| Đổi tên → MyDeutschFlow (app + i18n + metadata + docs) | ✅ 13 file (xem §1) |
| Build 1.0(9) + submit + ASC + reply | ⬜ **§2–§6 bên dưới** |

---

## 1. ✅ Đổi tên đã làm trong repo (để build 9 mang tên mới)

`ios/` bị gitignore (managed/prebuild) ⇒ **`app.json` `name` là nguồn sự thật**; EAS tự prebuild lại native với tên mới. Đã đổi **chuỗi hiển thị** `DeutschFlow → MyDeutschFlow` (case-sensitive, KHÔNG đụng định danh):

- `mobile/app.json`: `name` + 4 chuỗi permission (mic/ảnh/camera).
- UI: `app/(student)/upgrade.tsx`, `index.tsx`, `profile.tsx` (dòng version), `app/(auth)/register.tsx`, `onboarding.tsx`, `components/guide/TourOverlay.tsx` (màn chào), `components/SplashAnimated.tsx` (wordmark splash), `components/ui/BrandMark.tsx` (comment), `hooks/usePushNotifications.ts` (tên kênh thông báo Android), `lib/shareTree.ts` (text chia sẻ).
- Docs: `STORE_COPY.md` (App name 13/30, Subtitle/Description/Promo/What's New EN+VI, Review Notes) + `APPLE_REPLY_3.1.1_2026-07-07.md`.

**GIỮ NGUYÊN (định danh — đổi là gãy build/IAP/deep-link):** `slug: "deutschflow"`, `scheme: "deutschflow"`, `package: "com.deutschflow.app"`, `bundleIdentifier: "com.cudinh.mydeutschflow"`, product-id IAP `com.deutschflow.app.pro|ultra.*`, domain `mydeutschflow.com`.

⬜ **QA ảnh (không sed được — là hình):**
- [ ] Ảnh **splash tĩnh** (native, hiện trước khi JS chạy) + **app icon**: nếu có chữ "DeutschFlow" nướng sẵn trong hình → thiết kế lại thành "MyDeutschFlow". (Wordmark splash động trong `SplashAnimated.tsx` đã đổi bằng code — OK.)
- [ ] **Screenshots App Store**: nếu ảnh chụp còn hiện tên/splash cũ hoặc bất kỳ bề mặt "PRO/Nâng cấp" → chụp lại từ build 9.

---

## 2. ⬜ Backend & demo account (làm TRƯỚC khi build/submit)

- [ ] **Demo account cho reviewer** — cấp **full access vĩnh viễn + quota AI cao** (admin grant), **KHÔNG** dùng account phụ thuộc trial 7 ngày (kẻo hết hạn giữa review = rủi ro 2.1). Trên iOS free mode account này **không** hiện nhãn PRO.
  - [ ] Primary (student, có data học ~20') — để review chính.
  - [ ] Secondary (fresh) — để test **xoá tài khoản** (khỏi mất primary).
- [ ] (Nếu chưa) deploy backend bản phone-optional (fix 5.1.1 lần trước) để đăng ký bỏ trống SĐT không 400.

---

## 3. ⬜ Build 1.0(9) qua EAS

```bash
cd mobile
npx tsc --noEmit && npx jest            # gate xanh trước khi build (rename chỉ đổi string → không phá type)
eas build --platform ios --profile production
```
- `eas.json` dùng `appVersionSource: remote` + `autoIncrement` ⇒ build number tự **8 → 9**. `app.json` version giữ `1.0.0`.
- EAS chạy prebuild trên cloud → native mang tên **MyDeutschFlow** (CFBundleDisplayName). Không cần sửa Xcode tay.
- Chờ build xong (link artifact ở terminal / expo.dev).

---

## 4. ⬜ Đưa binary lên App Store Connect

```bash
eas submit --platform ios --profile production --latest
```
(hoặc tải `.ipa` bằng Transporter). Cần App Store Connect API key hoặc Apple ID đã cấu hình cho EAS.
- [ ] Vào ASC → app → version **1.0** → **Build** → chọn build **9** vừa upload.

---

## 5. ⬜ App Store Connect — metadata (nguồn: `STORE_COPY.md`)

- [ ] **App Information → Name:** đảm bảo là **MyDeutschFlow** (nếu listing còn tên cũ "DeutschFlow" thì đổi; tên phải còn trống/để mua được — bundle `…mydeutschflow` + domain `mydeutschflow.com` là của bạn nên OK).
- [ ] **Subtitle / Keywords / Promotional text** (EN + VI) — copy từ `STORE_COPY.md`.
- [ ] **Description** (EN + VI) — bản đã scrub (không còn "marked Pro"/"đánh dấu Pro").
- [ ] **What's New** (EN + VI).
- [ ] **Privacy** — theo `APP_PRIVACY_LABELS.md` (đã có); URL `mydeutschflow.com/privacy` `/terms` `/support`.
- [ ] **Screenshots** — kiểm theo §1 (không lộ tên cũ / không lộ PRO).
- [ ] **App Review Information:**
  - [ ] Primary + Secondary demo (creds ở §2), điền Contact.
  - [ ] **Notes:** dán **§B** trong `APPLE_REPLY_3.1.1_2026-07-07.md`.

---

## 6. ⬜ Reply + Resubmit

- [ ] **Messages** (trong submission): dán **§A** (reply English). *Chỉ dán khi build 9 đã gắn* — reply chỉ đúng với build 9, đừng gửi khi bản đang review vẫn là 1.0(8).
- [ ] **Kiểm thử nhanh build 9** (thiết bị/simulator) trước khi bấm submit:
  - [ ] Speaking → chạm mic → **ghi âm được** (không "cần PRO").
  - [ ] Weekly Speaking + Mock Exam → **mở thẳng** (không màn "Tính năng PRO").
  - [ ] Hồ sơ → **không** nhãn FREE/PRO, **không** card "Nâng cấp lên PRO"; dòng version đọc **"MyDeutschFlow v1.0.0 • iOS/Android"**.
  - [ ] Splash + màn chào hiển thị **MyDeutschFlow** gọn, không tràn.
  - [ ] Hết quota AI → **"Bạn đã dùng hết lượt AI hôm nay, vui lòng thử lại sau."** (không nút Nâng cấp).
- [ ] **Resubmit for Review.**

---

## 7. Sau khi nộp
- Theo dõi ASC. Thường 24–48h.
- Nếu Apple hỏi về StoreKit/`expo-iap` trong binary: giải thích không có sản phẩm IAP nào cấu hình, hoặc gỡ `expo-iap` (xem §E trong `APPLE_REPLY_3.1.1_2026-07-07.md`) rồi build lại.
- Khi được duyệt → ghi memory launch-status "APPROVED", và mở kế hoạch **IAP v1.1** (bật `IAP_ENABLED=true`, tạo 4 auto-renewable sub trên ASC, xử lý phản chiếu PRO-web theo `IOS_FREE_MODE.md` §3.9).

## 8. Bẫy cần tránh
- Đừng đổi `slug/scheme/package/bundleId/product-id/domain` (§1).
- Đừng để sót "Pro/Nâng cấp/dùng thử/upgrade" ở Description, screenshots, Promotional.
- Đừng dùng demo account trial (hết hạn giữa review).
- Đừng hứa "web PRO mở khoá trên iOS" (bẫy 3.1.1 cho v1.1).

---

### Ghi chú: web (`frontend/`) & backend còn tên "DeutschFlow" ở nhiều chỗ hiển thị (trang web, email…). KHÔNG ảnh hưởng build/submit iOS lần này. Muốn đổi nốt cho đồng bộ toàn hệ thống thì làm một pass riêng — báo mình.
