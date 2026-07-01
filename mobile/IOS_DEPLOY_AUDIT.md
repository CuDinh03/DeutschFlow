# DeutschFlow Mobile — Audit deploy iOS (App Store + TestFlight)

**Ngày:** 2026-06-27 · **Phạm vi:** Toàn diện app `mobile/` (Expo / React Native) · **Mục tiêu:** iOS trước (TestFlight → App Store)
**Stack:** Expo SDK **52.0.49** · React Native 0.76.9 · Expo Router 4 · New Architecture bật · React Query + Zustand · NativeWind
**Quy mô:** 32 route · 48 UI component · 30 lib module · 0 TODO/FIXME còn sót

---

## 1. Kết luận nhanh

App được viết **rất tốt về kỹ thuật** (kiến trúc sạch, bảo mật token chuẩn, đã chủ động né lỗi paywall iOS, có xóa tài khoản, icon đúng chuẩn). Tuy nhiên **chưa thể submit App Store ở trạng thái hiện tại** vì vướng **3 blocker P0** — quan trọng nhất là **Expo SDK 52 không còn được Apple chấp nhận** (từ 28/4/2026 bắt buộc build bằng Xcode 26 / iOS 26 SDK, chỉ Expo SDK 54 đáp ứng).

**Đánh giá:** Chưa sẵn sàng. Cần xử lý P0 + P1 trước khi build production. Ước tính ~1–2 tuần kỹ thuật (chưa tính làm lại giao diện v2 — xem mục 6).

| Mức | Số lượng | Ý nghĩa |
|-----|----------|---------|
| 🔴 **P0 — Blocker** | 3 | Upload sẽ bị từ chối / tính năng hỏng. Bắt buộc fix. |
| 🟠 **P1 — Cao** | 5 | Khả năng cao bị Apple reject, hoặc là metadata bắt buộc. |
| 🟡 **P2 — Trung bình** | 7 | Hoàn thiện / giảm rủi ro. Không chặn submit. |
| 🟢 **Điểm mạnh** | — | Không cần làm gì, giữ nguyên. |

---

## 2. 🔴 P0 — Blocker (bắt buộc xử lý trước khi build)

### P0-1. Expo SDK 52 không đáp ứng yêu cầu Apple → phải nâng lên SDK 54
Từ **28/4/2026**, mọi bản upload lên App Store Connect **bắt buộc build bằng Xcode 26 / iOS 26 SDK** trở lên. EAS Build với SDK 52 dùng Xcode cũ → App Store Connect **từ chối ngay ở bước upload**. Chỉ **Expo SDK 54** mặc định Xcode 26 / iOS 26 SDK.

- **Việc cần làm:** Nâng cấp `mobile/` từ SDK 52 → **54** (đi tuần tự 52 → 53 → 54 theo hướng dẫn Expo). RN 0.76 → ~0.81.
- **Rủi ro tương thích cần kiểm tra:** `nativewind`, `moti`, `react-native-reanimated`, `@gorhom/bottom-sheet`, `react-native-mmkv`, `react-native-svg`, `posthog-react-native`, `lucide-react-native` — đều còn maintain và có bản hợp SDK 54, nhưng cần `npx expo install --fix` + test New Architecture kỹ.
- **Đây là blocker lớn nhất và tốn công nhất.** Mọi thứ khác phụ thuộc vào việc này xong trước.

### P0-2. `projectId` EAS vẫn là placeholder
Trong `app.json`: `extra.eas.projectId = "YOUR_EAS_PROJECT_ID"`. Hệ quả:
- `eas build` không link đúng project.
- **Push notification chết** — `hooks/usePushNotifications.ts` trả `null` ngay khi gặp placeholder, nên token không bao giờ gửi lên `/profile/me/push-token`.
- EAS Update (OTA) không dùng được.
- **Việc cần làm:** chạy `eas init` để gán `projectId` thật, rồi cập nhật `app.json`.

### P0-3. Thiếu entitlement push (`aps-environment`) dù app có đăng ký remote push
`ios/DeutschFlow/DeutschFlow.entitlements` đang **rỗng** (`<dict/>`), nhưng app gọi `getExpoPushTokenAsync()` và gửi token lên backend → cần capability **Push Notifications**.
- **Việc cần làm:** đảm bảo sau khi prebuild (với plugin `expo-notifications`) entitlements có `aps-environment` (`development` cho TestFlight dev, `production` cho release), và tạo **APNs Key** trong Apple Developer + nạp vào EAS (`eas credentials`). Hiện file commit rỗng nên capability đang thiếu.

---

## 3. 🟠 P1 — Cao (dễ bị reject hoặc là metadata bắt buộc)

### P1-1. Khai báo quyền Camera nhưng app không hề dùng camera
`NSCameraUsageDescription` có trong `app.json` và `Info.plist`, nhưng **không có** `expo-camera` / `ImagePicker` / `CameraView` ở bất kỳ đâu (chỉ là tên biến trong SVG nhân vật). Apple Guideline 5.1.1/2.5.1 — khai quyền không dùng là **lý do reject phổ biến**.
- **Việc cần làm:** xóa `NSCameraUsageDescription` khỏi `app.json > ios.infoPlist` và khỏi `Info.plist`.

### P1-2. Privacy Manifest khai thiếu dữ liệu thu thập (PostHog)
`PrivacyInfo.xcprivacy` có `NSPrivacyCollectedDataTypes` = **rỗng**, nhưng PostHog đang chạy với `captureScreens: true` (thu thập Product Interaction / Usage Data, thường kèm device/user ID). Khai báo không khớp → rủi ro reject hoặc email cảnh báo sau review.
- **Việc cần làm:** khai đúng loại dữ liệu PostHog thu thập trong `PrivacyInfo.xcprivacy` **và** điền mục App Privacy trong App Store Connect cho khớp. `NSPrivacyTracking=false` giữ nguyên là đúng (không dùng IDFA/ATT).

### P1-3. `eas submit` chưa cấu hình
`eas.json > submit.production` đang `{}` rỗng — thiếu `ascAppId`, `appleId`, `appleTeamId`. Bạn đã có Apple Developer Team nên điền được ngay.
- **Việc cần làm:** thêm 3 trường trên để chạy `eas submit -p ios`.

### P1-4. Chưa có crash reporting + chưa có Error Boundary
`initObservability()` là no-op (Sentry DSN rỗng trong `app.json`), và `app/_layout.tsx` **không có React Error Boundary**. Một lỗi render khi Apple review → app crash → reject theo Guideline 2.1; sau launch thì "mù" lỗi production.
- **Việc cần làm:** cấu hình Sentry DSN (hoặc Expo crash reporting) + thêm `ErrorBoundary` (Expo Router hỗ trợ export `ErrorBoundary` ở `_layout`).

### P1-5. Thiếu Privacy Policy URL & Support URL
Không thấy link Privacy Policy / Terms / Support trong app (hàng "Hướng dẫn sử dụng" chỉ trỏ tới guide nội bộ). **Privacy Policy URL và Support URL là bắt buộc trong App Store Connect.**
- **Việc cần làm:** chuẩn bị trang Privacy Policy + Support **đang sống (public)**, khai trong App Store Connect; nên thêm link trong app (mục Hồ sơ) và ở bước đăng ký.

---

## 4. 🟡 P2 — Trung bình (hoàn thiện, không chặn submit)

- **P2-1. `NSSpeechRecognitionUsageDescription` có lẽ thừa** — app chỉ dùng `expo-speech` (TTS), không dùng framework Speech recognition. Cân nhắc bỏ (cùng nguyên tắc với camera, rủi ro thấp hơn).
- **P2-2. `NSFaceIDUsageDescription` dùng chuỗi mặc định tiếng Anh** ("Allow $(PRODUCT_NAME) to access your Face ID...") trong khi các quyền khác đã tiếng Việt. Nếu không thực sự dùng Face ID thì bỏ; nếu có (SecureStore) thì viết lý do tiếng Việt cho nhất quán.
- **P2-3. iPad: `supportsTablet: true` + bật xoay ngang trên iPad** nhưng app thiết kế dọc, ưu tiên iPhone. Apple **sẽ test bản iPad**; layout vỡ ở landscape → reject. **Đề xuất v1 để `supportsTablet: false` (chỉ iPhone)**, hoặc QA kỹ iPad.
- **P2-4. `screenProtection.ts` định nghĩa nhưng chưa wire** vào các màn PII/nhạy cảm (profile, settings, exam) như chú thích thiết kế. Hardening tùy chọn — hoặc áp dụng, hoặc bỏ.
- **P2-5. certPinning & deviceIntegrity là scaffold tắt có chủ đích** — OK cho launch (hardening tùy chọn, Apple không bắt buộc). Chỉ cần biết hiện là no-op, đừng tưởng pinning đang bật.
- **P2-6. `runtimeVersion` / EAS Update chưa cấu hình** — nếu muốn vá JS nhanh sau launch không cần review lại (rất nên có), set `expo-updates` + `runtimeVersion`.
- **P2-7. Nút "Xoá tài khoản" rất mờ** (caption faint cuối trang Hồ sơ) — đúng chuẩn Apple 5.1.1(v) và chạy được (`DELETE /profile/me`), nhưng nên làm dễ thấy hơn.

---

## 5. 🟢 Điểm mạnh (giữ nguyên)

- **Lưu token chuẩn:** `expo-secure-store` với `WHEN_UNLOCKED_THIS_DEVICE_ONLY` → không sync iCloud, không lọt qua backup. Rất tốt.
- **Đã né lỗi IAP 3.1.1:** paywall tắt trên iOS (`PAYWALL_ENABLED = Platform.OS !== 'ios'`), màn Nâng cấp render bản trung tính, không giá/không nút mua/không link web. Tài khoản đã PRO (mua trên web) vẫn tự mở khóa.
- **Có xóa tài khoản trong app** (Apple 5.1.1(v)).
- **Icon 1024×1024, không alpha** — đúng tuyệt đối yêu cầu Apple. Splash 1284×2778 ổn.
- **Safe-area chuẩn:** `SafeAreaProvider` + component `Screen` xử lý insets theo edge (notch / Dynamic Island ổn).
- **ATS bật** (`NSAllowsArbitraryLoads: false`), API toàn HTTPS, `ITSAppUsesNonExemptEncryption: false` (né khai báo export compliance).
- **Kiến trúc tốt:** React Query, Zustand (selector slices), typed routes, refresh token single-flight, privacy manifest required-reason API đầy đủ, 0 TODO/FIXME.
- **Token refresh & xử lý 401** chắc tay; có offline SRS sync.

---

## 6. Giao diện v2 mới ("Native Student – Galerie") — phân tích & ảnh hưởng

Link bạn gửi là một **prototype thiết kế dạng HTML/JSX trong Claude design** (3 trang, gallery), **không phải code React Native**. Nó thiết kế lại ~15 màn học viên, map gần như 1:1 với route RN hiện có:

> Hôm nay · Lộ trình · Từ vựng · Ôn tập SRS (flashcard) · Luyện nói (Chọn HR / Phỏng vấn / Kết quả) · Lớp học + Chi tiết bài tập / Thông báo / Nhắn GV / Tham gia · Hồ sơ · Thông báo · Nâng cấp Pro

**Điểm mấu chốt:** prototype HTML **không deploy lên App Store được**. Muốn launch với v2, phải **port thiết kế v2 vào các component RN** (`mobile/components/ui` + các màn `app/(student)/*.tsx`). Vì v2 phủ đúng tập tính năng hiện có, đây là việc **restyle**, không phải làm tính năng mới — nhưng vẫn cần đụng phần lớn UI và QA lại toàn bộ.

**Quyết định cần chọn (ảnh hưởng tiến độ):**

- **Phương án A — Ra App Store nhanh nhất:** ship UI RN *hiện tại* (đã native, đủ tính năng, chỉ cần xong P0+P1), tung v2 ở bản cập nhật sau (có thể qua OTA nếu bật EAS Update). → Lên store sớm nhất.
- **Phương án B — Launch cùng v2:** implement v2 trong RN trước rồi mới deploy. Ấn tượng đầu đẹp hơn nhưng chậm hơn ~2–4 tuần.
- **Gợi ý:** Vì **bắt buộc nâng SDK 52 → 54** (đã đụng nhiều file + QA toàn bộ), nếu ưu tiên trải nghiệm thì gộp **SDK upgrade + restyle v2** làm một đợt rồi submit. Nếu ưu tiên lên store sớm để chạy TestFlight, đi Phương án A trước.

---

## 7. Checklist deploy iOS (TestFlight → App Store)

### A. Trước khi build (kỹ thuật)
- [ ] **P0-1** Nâng Expo SDK 52 → 54 (`npx expo install expo@^54 --fix`, sửa breaking changes, test New Arch).
- [ ] **P0-2** `eas init` → gán `projectId` thật vào `app.json`.
- [ ] **P0-3** Tạo APNs Key (Apple Developer) + `eas credentials` cho push; xác nhận `aps-environment` có trong entitlements sau prebuild.
- [ ] **P1-1** Xóa `NSCameraUsageDescription` (app.json + Info.plist).
- [ ] **P1-2** Cập nhật `PrivacyInfo.xcprivacy` khai dữ liệu PostHog.
- [ ] **P1-4** Cấu hình Sentry DSN + thêm `ErrorBoundary`.
- [ ] **P2-1/2-2** Dọn quyền Speech/Face ID nếu không dùng.
- [ ] **P2-3** `supportsTablet: false` cho v1 (hoặc QA iPad).

### B. App Store Connect (metadata)
- [ ] Tạo app, **Bundle ID `com.deutschflow.app`**, đúng Apple Team của bạn.
- [ ] **P1-5** Khai Privacy Policy URL + Support URL (trang phải sống).
- [ ] Điền **App Privacy** (Data Collection) khớp PostHog (P1-2).
- [ ] Mô tả, từ khóa, ảnh chụp màn hình (6.7" + 6.1"... theo yêu cầu hiện hành), icon 1024 (đã có).
- [ ] **Age rating**, danh mục (Education).
- [ ] **Sign in to review:** cấp **tài khoản học viên demo** (app chặn giáo viên/admin) + ghi chú reviewer "app chỉ dành cho học viên".
- [ ] Export compliance: chọn "no" (đã set `ITSAppUsesNonExemptEncryption=false`).

### C. Build & TestFlight
- [ ] **P1-3** Điền `eas.json > submit.production` (`ascAppId`, `appleId`, `appleTeamId`).
- [ ] `eas build -p ios --profile production` → `eas submit -p ios`.
- [ ] Test TestFlight nội bộ trên **thiết bị thật** (push token chỉ có trên device thật): login, speaking (mic), notifications, xóa tài khoản, refresh token, offline.
- [ ] Kiểm tra crash sạch (Sentry) trước khi mời external testers / submit review.

### D. Submit App Store
- [ ] Gửi review; chuẩn bị phản hồi nếu hỏi về quyền mic/speech và mô hình monetization (giải thích iOS không bán trong app).

---

## 8. Lộ trình đề xuất (thứ tự)

1. **Tuần 1:** P0-1 nâng SDK 54 (lớn nhất) → P0-2 `eas init` → P0-3 push/APNs. Mục tiêu: ra được 1 build EAS chạy trên device thật.
2. **Tuần 1–2:** P1-1→P1-5 (dọn quyền, privacy manifest, Sentry+ErrorBoundary, submit config, Privacy/Support URL) + P2-3 iPad.
3. **Song song / quyết định:** chọn Phương án A (ship UI hiện tại) hay B (restyle v2 trước) ở mục 6.
4. **Trước submit:** chạy bộ test, QA TestFlight trên thiết bị thật, dọn nốt P2.

---

## Nguồn (yêu cầu Apple / Expo, tra ngày 2026-06-27)
- Apple — Upcoming Requirements (Xcode 26 / iOS 26 SDK bắt buộc từ 28/4/2026): https://developer.apple.com/news/upcoming-requirements/
- Expo — App Store Connect minimum SDK 26: https://expo.dev/blog/app-store-connect-minimum-sdk-26
- Expo — SDK 54 (mặc định Xcode 26): https://expo.dev/changelog/sdk-54
- Expo — Upgrade Expo SDK walkthrough: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
