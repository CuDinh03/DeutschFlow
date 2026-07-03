# DeutschFlow — App Store Launch Doc Set / Bộ tài liệu ra mắt App Store

Chỉ mục cho toàn bộ tài liệu chuẩn bị đưa **DeutschFlow** (Expo SDK 54, bundle `com.cudinh.mydeutschflow`) từ TestFlight lên App Store. Mỗi tài liệu bên dưới đứng độc lập; trang này chỉ nói **từng tài liệu để làm gì, khi nào dùng, đọc theo thứ tự nào**, và gom **danh sách placeholder phải điền trước khi nộp**.

Index for every document that takes **DeutschFlow** (Expo SDK 54, bundle `com.cudinh.mydeutschflow`) from TestFlight to the App Store. Each doc below stands on its own; this page only states **what each is for, when to use it, and in what order to read** — plus a consolidated **placeholders-to-fill** list.

---

## Trạng thái / Status snapshot

Chiến lược **ĐÃ CHỐT: Hướng B — full monetization ở v1.0** (free + quảng cáo AdMob + subscription tự động gia hạn "DeutschFlow Pro"); cần **Paid Applications Agreement + W-8BEN + ngân hàng Active**. Phát hiện lớn: **backend Apple IAP đã có sẵn và trưởng thành** (commit `635edbc`, migration `V189`, package `com.deutschflow.payment.*` — `/api/payments/apple/verify|sync|notifications|account-token|products`, verify JWS StoreKit 2, ledger `user_subscriptions`) ⇒ backend gần như **0 code**, chỉ cần **config + 1 migration**. Quyết định IAP: dùng **`expo-iap` → backend sẵn có (KHÔNG RevenueCat)**, để backend là nguồn sự thật entitlement duy nhất. Quyết định ads: **v1.0 non-personalized, bỏ ATT** (ATT là lựa chọn kinh doanh, không phải gate của Apple). Icon marketing 1024 **đã sẵn sàng** (`mobile/assets/icon.png` = `1024×1024`, `hasAlpha: no`). Còn **2 blocker mở** cho mọi hướng: host **Privacy Policy URL** + **Support URL** công khai. Ngoài ra 2 blocker CONFIG (không phải code) trước khi bật IAP: env `APPLE_BUNDLE_ID` (default `com.deutschflow.app` sai) và align `apple_products.product_id` với App Store Connect (Flyway V242).

Strategy **DECIDED: Path B — full monetization at v1.0** (free + AdMob ads + auto-renewable "DeutschFlow Pro"); requires Paid Applications Agreement + W-8BEN + Active banking. Big finding: the **Apple IAP backend already exists and is mature** ⇒ backend ≈0 code, only config + 1 migration. IAP: **`expo-iap` → existing backend, not RevenueCat**. Ads: **non-personalized, skip ATT for v1.0**. Icon 1024 is ready. Two open launch blockers remain: a public **Privacy Policy URL** and **Support URL**.

---

## Thứ tự đọc đề xuất / Suggested reading order

1. **[../APP_STORE_LAUNCH_PLAN.md](../APP_STORE_LAUNCH_PLAN.md)** — bức tranh tổng thể & checklist end-to-end (đọc trước để nắm bối cảnh).
2. **[MONETIZATION_TECH_PLAN.md](MONETIZATION_TECH_PLAN.md)** — con đường kỹ thuật monetization; chứa 2 blocker CONFIG và trình tự build.
3. **[STUDENT_PLANS_REVIEW.md](STUDENT_PLANS_REVIEW.md)** — hiểu đúng gói/tier trước khi bán IAP (những gì phải chốt trước khi bật IAP iOS).
4. **[PRIVACY_POLICY.md](PRIVACY_POLICY.md)** + **[TERMS_OF_USE.md](TERMS_OF_USE.md)** — host công khai, lấy URL (gỡ 2 blocker mở).
5. **[STORE_COPY.md](STORE_COPY.md)** — dán vào App Store Connect (tên/subtitle/description/keywords/review notes).
6. **[SCREENSHOTS_ICON_SPEC.md](SCREENSHOTS_ICON_SPEC.md)** — chuẩn bị icon + bộ screenshot 6.9″ ngay trước khi nộp.

---

## Từng tài liệu / Each document

### [../APP_STORE_LAUNCH_PLAN.md](../APP_STORE_LAUNCH_PLAN.md) — Kế hoạch tổng / Master launch plan
Tài liệu gốc (ở thư mục cha `plans/`). Ghi lại quyết định Hướng B, bối cảnh repo đã xác minh (bundle/Team ID/version/SDK 54), 7 mục checklist từ hợp đồng Apple → compliance trong app → App Store Connect → tài sản → build/submit → review, và timeline ước tính. **Dùng khi:** cần theo dõi tiến độ toàn cục hoặc nhớ "còn thiếu gì để nộp". Trang README này là chỉ mục cho các tài liệu con mà kế hoạch tổng tham chiếu.

### [MONETIZATION_TECH_PLAN.md](MONETIZATION_TECH_PLAN.md) — Kế hoạch kỹ thuật monetization (IAP + Ads + ATT)
Thiết kế kỹ thuật cho toàn bộ freemium. Khẳng định **backend Apple IAP đã sẵn** (nên backend ≈0 code), chốt **`expo-iap` thay vì RevenueCat**, và **ads non-personalized bỏ ATT** cho v1.0. Nêu **2 blocker CONFIG bắt buộc**: (1) env `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow` (default `com.deutschflow.app` sai → verify JWS reject khi bật), (2) align `apple_products.product_id` với ID tạo ở ASC qua Flyway **V242**. Chia thành Workstream A (IAP), B (Ads), C (ATT — chỉ Hướng personalized) + trình tự build **1 native build duy nhất** (`runtimeVersion.policy="fingerprint"` ⇒ không mảng nào OTA được). **Dùng khi:** bắt tay code IAP/ads, cấu hình backend provider, hoặc lên lịch phases/build/submit.

### [STUDENT_PLANS_REVIEW.md](STUDENT_PLANS_REVIEW.md) — Rà soát gói/tier của role STUDENT
Audit các tier student (DEFAULT / FREE / PRO / ULTRA / INTERNAL + ghost PREMIUM). Kết luận: hạn mức thật **chỉ đo bằng token AI/ngày** theo tier, `features_json` là config chết; bề mặt gói **không nhất quán** (web 3-tier, mobile 2-tier, Apple catalog 4 gói đang ngủ). Liệt kê **14 vấn đề đã xác nhận** (1 HIGH: Stripe web là mua-1-lần không auto-renew; 3 MEDIUM; các LOW) và **§5 "phải sửa TRƯỚC khi bật IAP iOS"** (chốt kỳ ULTRA, 2-tier hay 3-tier trên mobile, fresh-replay ULTRA=0 token, product-ID alignment). **Dùng khi:** thiết kế paywall/catalog IAP hoặc quyết định v1.0 bán những gói nào (khuyến nghị: v1.0 chỉ PRO).

### [PRIVACY_POLICY.md](PRIVACY_POLICY.md) — Chính sách quyền riêng tư (EN + VI)
Bản nháp Privacy Policy song ngữ để **host công khai**; sau khi host, dán URL vào App Store Connect (App Privacy + App Information → Privacy Policy URL). Bao trùm dữ liệu thu thập (tài khoản, nội dung học, tiến độ/analytics PostHog, push token, mua hàng Apple, quảng cáo AdMob), quyền thiết bị (micro/camera-ảnh/thông báo), sub-processor (Apple, AdMob, PostHog US, Expo/EAS, AWS), xóa dữ liệu (Hồ sơ → Xóa tài khoản), quyền GDPR/CCPA/PDPD. Ghi rõ tracking/IDFA **chỉ khi đồng ý ATT** — với v1.0 non-personalized thì không có ATT. **Dùng khi:** cần URL Privacy để nộp (một trong 2 blocker mở). Điền `[[…]]` trước khi host.

### [TERMS_OF_USE.md](TERMS_OF_USE.md) — Điều khoản sử dụng / EULA (EN + VI)
EULA song ngữ, **bắt buộc khi app có subscription tự động gia hạn**. Có thể dùng Standard EULA của Apple cho phần license chung, nhưng **công bố subscription ở §4 vẫn phải xuất hiện** (tên/thời hạn/giá, tính phí Apple ID, tự động gia hạn, quản lý/hủy, không hoàn tiền một phần, Restore Purchases, hoàn tiền do Apple). Kèm điều khoản quảng cáo (mặc định non-personalized), sử dụng hợp lệ, sở hữu trí tuệ, miễn trừ, luật áp dụng Việt Nam. **Dùng khi:** cần URL EULA để nộp + dán §4 vào phần Description/tại điểm bán. Điền `[[…]]` (kể cả `[[privacy-policy-url]]`) trước khi host.

### [STORE_COPY.md](STORE_COPY.md) — Nội dung trang App Store (EN + VI)
Toàn bộ copy dán vào App Store Connect, **mỗi trường có đếm ký tự**: App name `DeutschFlow` (11/30); Subtitle EN "Learn German, pass Goethe" (25/30) / VI "Học tiếng Đức & luyện thi" (25/30); Promotional text, Keywords (97/100 EN · 99/100 VI), Description (~1780 EN · ~1850 VI), What's New v1.0, và **App Review Information** (demo account + review notes mô tả walkthrough, ads non-personalized/không ATT, subscription sandbox, xóa tài khoản). **Dùng khi:** điền tab App Store → locale và phần App Review Information lúc Submit. Điền `[[…]]` (support/marketing URL, privacy/terms URL, demo account).

### [SCREENSHOTS_ICON_SPEC.md](SCREENSHOTS_ICON_SPEC.md) — Đặc tả icon + screenshot
Bộ tài sản hình ảnh. **Icon 1024** = dùng trực tiếp `mobile/assets/icon.png` (đã xác minh `1024×1024`, `hasAlpha: no`), không cần export riêng. **Screenshots iPhone**: bắt buộc bộ **6.9″ = `1320×2868`** (chụp trên iPhone 16 Pro Max, verify từng ảnh bằng `sips`, lệch 1px là bị từ chối); gợi ý 6–8 màn (Home/Cây học tập, AI Speaking, Mock exam, Lesson, SRS, Stats, **Pro paywall bắt buộc cho review**). Vì `supportsTablet: false` ⇒ **không cần và không nhận screenshot iPad**. Lưu ý điều kiện: màn paywall (`mobile/lib/paywall.ts` đặt `PAYWALL_ENABLED = Platform.OS !== 'ios'`) phải được bật iOS trước khi chụp ảnh #7. **Dùng khi:** chụp và verify bộ ảnh ngay trước khi nộp.

---

## Placeholder phải điền trước khi ra mắt / Placeholders to fill before launch

Các mục `[[…]]` rải trong bộ tài liệu, gom về đây:

**Pháp lý & liên hệ / Legal & contact**
- `[[Tên pháp lý / nhà phát triển]]` — tên nhà phát triển (Privacy Policy, Terms).
- `[[support@your-domain]]` / **Support email** — email hỗ trợ chính (dự phòng: `dinhhuycu0305@gmail.com`).
- `[[support-contact-name]]` + `[[phone]]` — người liên hệ & số điện thoại cho App Review Information.

**URL phải host công khai / Public URLs (2 blocker mở)**
- `[[privacy-policy-url]]` — nơi host [PRIVACY_POLICY.md](PRIVACY_POLICY.md).
- `[[terms-url]]` — nơi host [TERMS_OF_USE.md](TERMS_OF_USE.md) (EULA).
- `[[https://your-domain/support]]` — **Support URL** (bắt buộc trong App Store Connect).
- `[[https://your-domain]]` — Marketing URL (tùy chọn).

**Tài khoản review / Review**
- `[[demo-email]]` / `[[demo-password]]` — tài khoản demo (role student, đã seed dữ liệu học) cho App Review.

**Monetization config (từ MONETIZATION_TECH_PLAN §8)**
- **AdMob App ID iOS** (`~`-style) + **ad unit IDs** (`/`-style) — tạo dưới bundle `com.cudinh.mydeutschflow`.
- `APPLE_APP_APPLE_ID` — numeric App Store id (bắt buộc cho Production verify).
- Thư mục **Apple Root CA `.cer`** cho `APPLE_ROOT_CERT_DIR` (bật verification JWS).
- **Product ID scheme chuẩn** (đề xuất `com.cudinh.mydeutschflow.pro.{monthly,yearly}`) + **giá từng gói/quốc gia** — tạo ở ASC rồi update `apple_products.product_id` qua Flyway V242.

**Screenshots / caption**
- Cặp caption EN/VI (nếu ghép device frame) — có sẵn trong [SCREENSHOTS_ICON_SPEC.md](SCREENSHOTS_ICON_SPEC.md) §2.2.
