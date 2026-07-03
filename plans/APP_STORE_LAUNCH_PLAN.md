# Kế hoạch phát hành DeutschFlow lên App Store (v1.0)

Kế hoạch tổng (master) cho việc đưa ứng dụng **DeutschFlow** (Expo `mobile/`) từ TestFlight lên App Store công khai theo **Hướng B — Full monetization**: bản v1.0 phát hành trọn gói **free + quảng cáo AdMob + subscription tự động gia hạn "DeutschFlow Pro"**.

Tài liệu này là checklist điều hành duy nhất. Chi tiết kỹ thuật, nội dung store và văn bản pháp lý nằm trong các tài liệu con tại `plans/appstore/` (liên kết ở từng mục).

> **Quyết định chiến lược đã chốt: Hướng B.** Phát hành đủ monetization ngay ở v1.0. (Hướng A — ra mắt bản free trước rồi bổ sung Pro/ads ở v1.1 — là phương án nhanh hơn nhưng đã không chọn.)

**Tài liệu con liên quan:**
- [appstore/README.md](appstore/README.md) — mục lục bộ tài liệu App Store
- [appstore/MONETIZATION_TECH_PLAN.md](appstore/MONETIZATION_TECH_PLAN.md) — kế hoạch kỹ thuật IAP + Ads
- [appstore/STUDENT_PLANS_REVIEW.md](appstore/STUDENT_PLANS_REVIEW.md) — rà soát tier/pricing gói học viên
- [appstore/PRIVACY_POLICY.md](appstore/PRIVACY_POLICY.md) — Chính sách quyền riêng tư (EN + VI)
- [appstore/TERMS_OF_USE.md](appstore/TERMS_OF_USE.md) — Điều khoản sử dụng / EULA (EN + VI)
- [appstore/STORE_COPY.md](appstore/STORE_COPY.md) — Nội dung store (name/subtitle/keywords/description EN + VI)
- [appstore/SCREENSHOTS_ICON_SPEC.md](appstore/SCREENSHOTS_ICON_SPEC.md) — quy cách icon + screenshot

---

## 0. Bối cảnh & trạng thái đã xác minh

Ứng dụng phát hành là app **Expo** trong `mobile/` (không phải bản SwiftUI native hay Capacitor cũ). Nền tảng và cấu hình build đã sẵn sàng; công việc còn lại là monetization + tài khoản/hợp đồng + tài sản store.

| Hạng mục | Trạng thái |
|---|---|
| Nền tảng | Expo **SDK 54**, React Native **0.81.5**, **New Architecture** (`newArchEnabled: true`), expo-router |
| Bundle ID iOS | `com.cudinh.mydeutschflow` |
| Android package | `com.deutschflow.app` |
| Apple Team ID | `4M3CU3X9SS` (đã cấu hình trong `mobile/eas.json`) |
| Version marketing | `1.0.0`; `appVersionSource: remote` + `autoIncrement` (buildNumber tự tăng ở profile production) |
| Runtime version | policy `fingerprint` (expo-updates 29) |
| Export compliance | `ITSAppUsesNonExemptEncryption: false` — đã set trong `app.json`, không cần khai thêm |
| supportsTablet | **`false`** ⇒ **KHÔNG cần screenshot iPad** |
| Analytics | **PostHog** (key thật ở `app.json` → `extra.posthogKey`, host US) |
| Sentry | **KHÔNG hoạt động** (`extra.sentryDsn` rỗng, không có package `@sentry/*`) ⇒ **tuyệt đối không khai Sentry** trong App Privacy labels |
| Xóa tài khoản (Guideline 5.1.1(v)) | ✅ **ĐÃ CÓ, wired end-to-end** (xem §2) |
| Icon marketing 1024 | ✅ `mobile/assets/icon.png` đã là 1024×1024, không alpha → dùng trực tiếp |

**Backend Apple IAP — ĐÃ CÓ SẴN & trưởng thành (phát hiện quan trọng):** toàn bộ hạ tầng xác minh mua hàng đã tồn tại từ commit `635edbc` (migration `V189`, package `com.deutschflow.payment.*`). `AppleIapController` (`@RequestMapping("/api/payments/apple")`, `AppleIapController.java:26`) cung cấp `POST /verify` (`:51`), `POST /sync` (restore, `:59`), `POST /notifications` (ASSN V2, `:72`), `GET /account-token` (`:90`), `GET /products` (`:98`). JWS StoreKit2 được xác minh và ghi vào ledger `user_subscriptions` (cùng nguồn với Stripe/MoMo/SePay). ⇒ **backend code ≈ 0**, chỉ cần **config + 1 migration** (xem §2 và [MONETIZATION_TECH_PLAN.md](appstore/MONETIZATION_TECH_PLAN.md)).

**Hai blocker còn hở (phải xử lý trước khi submit):**
1. **Privacy Policy URL** công khai — nội dung đã soạn ([PRIVACY_POLICY.md](appstore/PRIVACY_POLICY.md)), còn phải host lên `[[PRIVACY_URL]]`.
2. **Support URL** công khai — còn phải host lên `[[SUPPORT_URL]]`.

---

## 1. Tài khoản & hợp đồng

Hướng B (có IAP) **bắt buộc** ký Paid Applications Agreement. Đây thường là đường tới hạn dài nhất (chờ Apple xác nhận thuế/ngân hàng), nên làm sớm song song với code.

- [ ] Apple Developer Program còn hiệu lực (99 USD/năm), tài khoản có quyền **Admin / App Manager**.
- [ ] App Store Connect → **Agreements, Tax, and Banking**:
  - [ ] Chấp nhận **Apple Developer Program License Agreement** (free apps).
  - [ ] Ký **Paid Applications Agreement** — bắt buộc vì có subscription IAP.
  - [ ] Điền **thông tin thuế** (cá nhân VN: form **W-8BEN**).
  - [ ] Thêm **tài khoản ngân hàng** nhận tiền; chờ trạng thái **Active** cho cả hợp đồng lẫn banking.
- [ ] Xác nhận đã có **App record** cho `com.cudinh.mydeutschflow` (thường tạo sẵn khi đẩy TestFlight).

---

## 2. Compliance kỹ thuật trong app (chống bị reject)

### Nền tảng — bắt buộc cho mọi bản
- [ ] Build bằng **Xcode 26 / iOS 26 SDK** trở lên (bắt buộc từ 28/04/2026). Với EAS: profile `production` dùng image Xcode 26 mới nhất. (Deployment target vẫn có thể để iOS 16/17.)
- [x] **Xóa tài khoản trong app** (Guideline 5.1.1(v)) — ✅ đã wired end-to-end: `mobile/app/(student)/profile.tsx` → `confirmDeleteAccount()` (`profile.tsx:46`, Alert xác nhận) → `api.delete('/profile/me')` (`profile.tsx:57`); backend `ProfileController` `@DeleteMapping("/me")` (`ProfileController.java:101`, base path `/api/profile`).
- [ ] App **không crash, không màn hình trắng, không nội dung placeholder / "coming soon"**.
- [ ] Mọi link trong app (hỗ trợ, chính sách, EULA) hoạt động.
- [ ] Nhúng **Privacy Policy URL** công khai (bắt buộc cho mọi app).

### Subscription "DeutschFlow Pro" (IAP)
Dùng **`expo-iap`** (họ react-native-iap): app gửi JWS StoreKit2 đã ký lên `POST /api/payments/apple/verify` của backend sẵn có. **KHÔNG dùng RevenueCat** (sẽ tạo nguồn entitlement thứ 2 + phí ~1%). Backend giữ vai trò nguồn chân lý duy nhất; mobile đọc trạng thái Pro qua `usePlanStore.fetchPlan()` → `GET /auth/me/plan` (`isPro` = tier PRO hoặc ULTRA).

- [ ] Bật paywall trên iOS: hiện `mobile/lib/paywall.ts` có `PAYWALL_ENABLED = Platform.OS !== 'ios'` (`paywall.ts:13`) — đang **tắt trên iOS**; cần bật khi IAP sẵn sàng (paywall ở `mobile/app/(student)/upgrade.tsx`).
- [ ] Loại sản phẩm: **Auto-Renewable Subscription**, chu kỳ tối thiểu 7 ngày (monthly/yearly).
- [ ] Trước khi mua hiển thị rõ: **giá, chu kỳ gia hạn, cách hủy**.
- [ ] Có nút **Restore Purchases** → gọi `POST /api/payments/apple/sync`.
- [ ] Trong app có link tới **Terms of Use (EULA)** + **Privacy Policy** (bắt buộc với subscription).
- [ ] Test bằng **Sandbox tester** (App Store Connect → Users and Access → Sandbox) và/hoặc **StoreKit config file** (test được cả trên simulator).

> **2 blocker CRITICAL về CONFIG (không phải code):**
> 1. **`APPLE_BUNDLE_ID`** mặc định `com.deutschflow.app` (`application.yml:529`) nhưng bundle iOS là `com.cudinh.mydeutschflow`. Khi bật JWS verify, mọi lượt verify sẽ bị từ chối. ⇒ **đặt `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow`** trong môi trường backend.
> 2. **Product IDs**: `V189` seed `apple_products.product_id = com.deutschflow.app.{pro,ultra}.{monthly,yearly}` (placeholder). Product ID phải **khớp tuyệt đối** với ID tạo trong App Store Connect. ⇒ chọn scheme chuẩn (vd `com.cudinh.mydeutschflow.pro.monthly`…), **tạo trong ASC**, rồi viết **migration Flyway V242** `UPDATE apple_products.product_id`.
>
> Ngoài ra, JWS verify chỉ bật khi cấu hình `payment.apple.root-cert-dir`. Chi tiết đầy đủ ở [MONETIZATION_TECH_PLAN.md](appstore/MONETIZATION_TECH_PLAN.md).

### Quảng cáo (AdMob)
Khuyến nghị v1.0 = **AdMob non-personalized, BỎ ATT**. Personalized/ATT là **lựa chọn**, không phải gate của Apple: ads non-personalized chạy với `NSPrivacyTracking: false`, không cần ATT prompt và vẫn qua review.

- [ ] Cài `react-native-google-mobile-ads` **16.x** (New-Arch compatible). Nếu config-plugin báo lỗi, chạy `expo install --fix` (không cần pin 16.4.0 — đây là lỗi giả trên cả dòng 16.x).
- [ ] GMA SDK ≥ 11.2.0 tự kèm `PrivacyInfo.xcprivacy`; Xcode tự gộp ⇒ **KHÔNG** liệt kê lại domain quảng cáo Google trong app-level privacy manifest.
- [ ] Giữ `NSPrivacyTracking: false` (non-personalized) ⇒ **không** thêm `NSUserTrackingUsageDescription`, **không** dùng `expo-tracking-transparency`.
- [ ] Khai **AdMob App ID** `[[ADMOB_APP_ID]]` trong app config; ad unit IDs `[[ADMOB_UNIT_IDS]]`.
- [ ] **Gate ads trên `isPro`** (Pro không thấy quảng cáo). **KHÔNG** đặt ads trên màn: speaking, exam-attempt, auth, paywall.

> Tất cả 3 tính năng monetization đều là **native** ⇒ cần **1 bản production build mới + `eas submit`**, KHÔNG dùng OTA (do runtime `fingerprint`).

---

## 3. Cấu hình App Store Connect

### App Information
- [ ] **Name**: DeutschFlow · **Subtitle** (≤30): EN "Learn German, pass Goethe" / VI "Học tiếng Đức & luyện thi".
- [ ] **Category**: chính = **Education**.
- [ ] **Content Rights** (có/không dùng nội dung bên thứ ba).

### Pricing and Availability
- [ ] Giá app: **Free** (có In-App Purchases).
- [ ] Phạm vi: **All countries/regions** (giá theo quốc gia của subscription điền ở mục Subscriptions).

### Subscriptions
- [ ] Tạo **Subscription Group** "DeutschFlow Pro".
- [ ] Tạo các gói khớp catalog Apple (PRO/ULTRA × monthly/yearly), Product ID **khớp tuyệt đối** với `apple_products` (xem §2 blocker #2).
- [ ] Mỗi gói: **display name + description** (bản địa hóa) + **ảnh review** + mô tả quyền lợi.
- [ ] Đặt **giá theo từng quốc gia** `[[PER_COUNTRY_PRICES]]`. (Tham chiếu web: PRO 299.000 VND/tháng, ULTRA 699.000 VND — xem [STUDENT_PLANS_REVIEW.md](appstore/STUDENT_PLANS_REVIEW.md) về sai lệch chu kỳ web↔Apple.)
- [ ] (Tùy chọn) Introductory offer / free trial.

### Age Rating
- [ ] Trả lời bảng câu hỏi Age Rating (app có quảng cáo → khai báo trung thực).

### App Privacy (nhãn quyền riêng tư)
- [ ] Khai dữ liệu thu thập: **push token**, **analytics PostHog** (product interaction + usage data), và **dữ liệu quảng cáo AdMob** khi bật ads.
- [ ] **KHÔNG khai Sentry** (không hoạt động — xem §0).
- [ ] Vì ads non-personalized: giữ `NSPrivacyTracking: false`, **không** khai "Tracking".
- [ ] Điền **Privacy Policy URL** `[[PRIVACY_URL]]` + **EULA/Terms URL** `[[TERMS_URL]]` (bắt buộc khi có subscription).

---

## 4. Tài sản trang App Store

Chi tiết quy cách + cách chụp ở [SCREENSHOTS_ICON_SPEC.md](appstore/SCREENSHOTS_ICON_SPEC.md); toàn bộ văn bản ở [STORE_COPY.md](appstore/STORE_COPY.md).

### Hình ảnh
- [ ] **App icon 1024×1024** — dùng trực tiếp `mobile/assets/icon.png` (đã đạt chuẩn: PNG, không alpha).
- [ ] **Screenshots iPhone**: bắt buộc bộ **6.9″ = 1320×2868 px** (hoặc chấp nhận 6.7″ = 1290×2796). Tối thiểu 1, tối đa 10; đúng pixel tuyệt đối. UI đồng nhất → chỉ cần bộ lớn nhất, Apple tự scale.
- [ ] **KHÔNG cần screenshot iPad** (`supportsTablet: false`).
- [ ] (Tùy chọn) App preview video 15–30s.

### Văn bản (EN + VI đầy đủ)
- [ ] **Name** (≤30), **Subtitle** (≤30), **Promotional text** (≤170).
- [ ] **Description** (≤4000), **Keywords** (≤100, phân tách bằng dấu phẩy).
- [ ] **Support URL** `[[SUPPORT_URL]]` (bắt buộc), **Marketing URL** (tùy chọn).
- [ ] Contact placeholder: dinhhuycu0305@gmail.com.

### Trang pháp lý phải host công khai
- [ ] **Privacy Policy** → `[[PRIVACY_URL]]` (bắt buộc).
- [ ] **Terms of Use / EULA** → `[[TERMS_URL]]` (bắt buộc khi có subscription).

---

## 5. Build & submit

- [ ] Xác nhận `version` (marketing) = **1.0.0**; buildNumber tự tăng qua EAS `autoIncrement` + `appVersionSource: remote`.
- [ ] Build production (KHÔNG dùng profile `preview` — profile đó là `ios.simulator: true`, không nộp store được):
  ```bash
  eas build -p ios --profile production
  ```
- [ ] Nộp lên App Store Connect:
  ```bash
  eas submit -p ios --profile production --latest
  ```
- [ ] Trong App Store Connect → tab **App Store** → chọn đúng **Build** vừa nộp cho phiên bản 1.0.0.

> `eas submit` là bước **thủ công**, không nằm trong CI.

---

## 6. Gửi duyệt (Submit for Review) + Review Notes

- [ ] **App Review Information**: cung cấp **tài khoản demo** `[[DEMO_ACCOUNT]]` (đăng nhập được) + ghi chú cách test.
- [ ] Review notes cho **subscription**: nêu cách mua bằng **Sandbox tester**, vị trí **Restore Purchases**, và cách xem giá/chu kỳ/điều khoản.
- [ ] Review notes cho **ads**: nêu ads là **non-personalized**, **không** dùng ATT tracking; ads chỉ hiện cho tài khoản free (Pro không có ads).
- [ ] **Export Compliance**: `ITSAppUsesNonExemptEncryption=false` đã set → không cần khai thêm.
- [ ] **Content Rights** + **IDFA/Advertising**: khai đúng theo cấu hình non-personalized (không tracking).
- [ ] Chọn cách phát hành: **Manually / Automatically / Phased Release** — khuyến nghị **Phased Release** cho v1.0.
- [ ] Nhấn **Submit for Review**.

**Rejection hay gặp — né trước:** thiếu nút xóa tài khoản (đã có ✅); subscription không rõ giá/điều khoản hoặc thiếu Restore; thiếu link Privacy/Terms; privacy label lệch cấu hình thật (đặc biệt: khai Sentry — đừng); metadata sai / link hỏng; crash/blank lúc review.

---

## 7. Sau khi được duyệt

- [ ] Theo dõi **Phased Release** (7 ngày) + đánh giá/nhận xét người dùng. (Lưu ý: crash monitoring qua Sentry **chưa bật** — không phụ thuộc vào Sentry.)
- [ ] Theo dõi **PostHog** cho hành vi kích hoạt/subscription.
- [ ] Kiểm tra dòng tiền IAP + Apple Server Notifications (`/api/payments/apple/notifications`) chảy đúng vào ledger `user_subscriptions`.
- [ ] Chuẩn bị **ASO** (tối ưu keyword/screenshot) cho các bản sau.
- [ ] **OTA (`expo-updates`)**: chỉ dùng cho sửa JS/nội dung nhỏ; mọi thay đổi native (IAP/ads/SDK) vẫn phải submit bản build mới do runtime policy `fingerprint`.

---

## Checklist rút gọn

1. [ ] Ký **Paid Applications Agreement** + W-8BEN + banking Active (làm sớm, song song code).
2. [ ] Code IAP (`expo-iap` → backend sẵn có) + bật paywall iOS + AdMob non-personalized, gate `isPro`.
3. [ ] Config backend: `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow` + Flyway **V242** align `apple_products.product_id` với ASC.
4. [ ] Host **Privacy Policy URL** + **Support URL** + **EULA URL** công khai.
5. [ ] Tạo Subscription Group + gói (Product ID khớp tuyệt đối) + giá theo quốc gia.
6. [ ] Icon 1024 (đã có) + screenshots 6.9″ + name/subtitle/keywords/description (EN + VI).
7. [ ] Điền App Info, Pricing=Free, Age Rating, App Privacy labels (KHÔNG khai Sentry).
8. [ ] `eas build -p ios --profile production` → `eas submit --latest` → chọn build.
9. [ ] Review notes (demo account + sandbox sub + ads non-personalized) → **Submit for Review** (Phased Release).
