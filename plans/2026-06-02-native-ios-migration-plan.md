# DeutschFlow — Kế hoạch chuyển sang Native iOS (dùng chung Backend Java)

> **Ngày:** 2026-06-02
> **Quyết định nền tảng:** Native iOS hoàn toàn (Swift/SwiftUI). **Bỏ Android.** Backend Java/Spring Boot **dùng chung 100%**, gần như không sửa.
> **Codebase bị khai tử sau khi đạt parity:** `mobile/` (Expo/RN) và `frontend/ios` (Capacitor).

---

## 0. Luận điểm cốt lõi (tại sao "dùng chung BE Java" chạy mượt)

Backend đã là **REST API stateless + JWT Bearer** (`SecurityConfig` → `SessionCreationPolicy.STATELESS`, `JwtAuthFilter`). API hoàn toàn **client-agnostic**: web React và native iOS đều chỉ cần gửi `Authorization: Bearer <jwt>` tới cùng các endpoint `/api/*`.

→ **Toàn bộ nghiệp vụ giữ nguyên**: ~78 controller, DB Postgres, FSRS/SRS, AI pipeline, payments, auth. Native iOS chỉ là **một client mới** tiêu thụ đúng hợp đồng API cũ.

→ Backend chỉ phải đụng vào **3 điểm nhỏ** (mục 9). Không có "rewrite backend".

**Tài sản lớn:** `springdoc-openapi` đã bật → có sẵn OpenAPI spec tại `/v3/api-docs`. Ta **sinh Swift client + DTO tự động** từ spec, không gõ tay model, contract luôn đồng bộ.

---

## 1. Tech stack Native iOS

| Hạng mục | Lựa chọn | Ghi chú |
|---|---|---|
| Ngôn ngữ / UI | **Swift 6 + SwiftUI** | Khai thác Liquid Glass (iOS 26) native thay vì "giả lập" như RN |
| Deployment target | **Min iOS 17** (để có `@Observable` + SwiftData), tối ưu cho iOS 26 với fallback | |
| Kiến trúc | **MVVM + Observation (`@Observable`)** + Repository pattern | Map tự nhiên từ Zustand store hiện tại; cân nhắc TCA nếu muốn cấu trúc/test chặt hơn |
| Networking | `URLSession` + `async/await`, `APIClient` có typed endpoint | |
| Client/DTO | **swift-openapi-generator** (Apple) + `swift-openapi-urlsession` | Sinh từ `/v3/api-docs`, chạy như build plugin → CI bắt drift |
| Token store | `actor TokenStore` + **Keychain** | Thay `expo-secure-store` |
| Offline / SRS | **SwiftData** (hàng đợi review) + `NWPathMonitor` để sync-back | Thay `react-native-mmkv` + `useSrsOfflineStore` |
| Audio (Speaking) | **AVFoundation** (`AVAudioRecorder`/`AVAudioEngine`, `AVAudioSession`, `AVPlayer`) | Thay `expo-av` — workstream nặng nhất |
| Push | **APNs** + `UNUserNotificationCenter` | Thay `expo-notifications` |
| Payments | **StoreKit 2 (IAP)** + server-side receipt validation | ⚠️ Rủi ro App Store — mục 8 |
| Design system | Token NativeWind → SwiftUI `Color`/`Font`/spacing constants | Giữ hướng Liquid Glass |
| Monitoring | **Sentry Cocoa** | Đã dùng Sentry RN |
| Analytics | **PostHog iOS SDK** | Giữ coverage tracking hiện có |
| Quản lý package | **Swift Package Manager** | |

---

## 2. Dùng chung vs Viết lại vs Động vào Backend

| Phân loại | Nội dung |
|---|---|
| ✅ **Dùng chung, không đổi** | Toàn bộ business logic, DB, FSRS/SRS engine, AI (speaking/grammar/vocab), payments core, JWT auth, ~78 controller |
| ✅ **Tái dùng qua codegen** | OpenAPI spec → Swift client. Hợp đồng API là "biên giới" chung |
| 🔧 **Backend đụng nhẹ (3 việc)** | (1) APNs push sender; (2) `push-token` nhận `platform`; (3) endpoint verify StoreKit receipt — mục 9 |
| 🔁 **Viết lại hoàn toàn (client)** | ~20 màn hình, navigation, state, audio, offline — toàn bộ `mobile/` |
| 🗑️ **Khai tử** | `frontend/ios` (Capacitor) ngay; `mobile/` (Expo) sau khi native đạt parity |

---

## 3. Bản đồ tính năng → API (đã có sẵn ở backend)

App native phải đạt parity với các route `mobile/app/(student|auth)/*` hiện tại:

| Màn hình native | Endpoint backend dùng chung |
|---|---|
| Auth (login/register/onboarding/reset) | `/api/auth/*`, `/api/onboarding`, `/api/auth/me` |
| Home / Today | `/api/today`, `/api/student`, `/api/progress`, `/api/xp` |
| SRS (review queue) | `/api/srs` |
| Vocabulary | `/api/vocabulary`, `/api/words`, `/api/tags` |
| Grammar | `/api/grammar`, `/api/grammar/ai`, `/api/grammar/syllabus` |
| Speaking (AI / weekly) | `/api/ai-speaking`, `/api/ai-speaking/weekly`, `/api/speaking`, `/api/speaking/tts` |
| Roadmap / Curriculum | `/api/roadmap`, `/api/curriculum`, `/api/skill-tree`, `/api/phase` |
| Exam / Mock | `/api/mock-exams`, `/api/assessment` |
| Stats / Progress | `/api/progress`, `/api/ability`, `/api/achievements` |
| Notifications | `/api/notifications` (+ APNs) |
| Profile | `/api/profile/me`, `/api/profile/me/learning` |
| Upgrade / Paywall | `/api/payments/*` → **chuyển sang StoreKit IAP** (mục 8) |

---

## 4. Cấu trúc module (Swift, theo feature)

```text
DeutschFlow.xcodeproj  (SPM-based)
├── App/                      # @main, root routing, DI composition
├── Core/
│   ├── Networking/           # APIClient, OpenAPI client, AuthInterceptor, TokenStore (actor)
│   ├── Persistence/          # SwiftData models, offline queue
│   ├── DesignSystem/         # Colors, Typography, Spacing, LiquidGlass components
│   ├── Push/                 # APNs registration, UNUserNotificationCenter
│   ├── Audio/                # AVAudioSession manager, Recorder, Player
│   └── Analytics/            # PostHog + Sentry wrappers
├── Features/
│   ├── Auth/                 # View + @Observable ViewModel + Repository
│   ├── Onboarding/
│   ├── Home/  (Today)
│   ├── SRS/
│   ├── Vocabulary/
│   ├── Grammar/
│   ├── Speaking/
│   ├── Roadmap/
│   ├── Exam/
│   ├── Stats/
│   ├── Notifications/
│   ├── Profile/
│   └── Paywall/
└── Generated/                # swift-openapi-generator output (DTO + client)
```

Mỗi feature = `View` (SwiftUI) + `ViewModel` (`@Observable`) + `Repository` (gọi APIClient). Map 1-1 với `app/(student)/*`.

---

## 5. Các luồng kỹ thuật then chốt

**Auth + refresh**
1. Login → nhận access + refresh token → lưu Keychain.
2. `AuthInterceptor` gắn `Bearer` vào mọi request.
3. Gặp `401` → gọi `/api/auth/refresh` → retry; refresh fail → đẩy về Login.
4. `actor TokenStore` đảm bảo refresh concurrency-safe (tránh nhiều request refresh song song).

**Offline SRS** — Native hoá `useSrsOfflineStore`: review khi offline ghi vào SwiftData queue → `NWPathMonitor` phát hiện có mạng → POST `/api/srs` sync-back, xử lý conflict idempotent.

**Speaking/Audio (nặng nhất)** — Xin quyền mic (`NSMicrophoneUsageDescription`), `AVAudioSession` cấu hình record+playback, ghi âm → upload `/api/ai-speaking/*`, phát TTS từ `/api/speaking/tts`. Cần xử lý interruption (cuộc gọi đến), route đổi (tai nghe), background audio.

---

## 6. Navigation & Design
- `TabView` cho tab học viên + `NavigationStack` mỗi tab; root **auth-gated** theo trạng thái `TokenStore`.
- Deep link qua Universal Links (thay `expo-linking`) — cần `apple-app-site-association` host trên backend/CDN.
- Design system: trích token từ `mobile/lib/theme` + Tailwind config → hằng số SwiftUI. Liquid Glass dùng `.glassEffect`/material native (iOS 26) với fallback `.ultraThinMaterial`.

---

## 7. Push (backend đụng nhẹ)
1. Apple Developer: tạo **APNs Auth Key (.p8)**, bật capability Push Notifications.
2. App xin quyền → nhận **APNs device token** → `POST /api/profile/me/push-token` kèm `platform: "ios"`.
3. Backend: thêm `ApnsPushSenderService` (HTTP/2 token-based, hoặc lib `pushy`/`java-apns`); `ExpoPushSenderService` giữ lại cho tới khi Expo retire. Route theo `platform` của token.

---

## 8. ⚠️ Payments — rủi ro lớn nhất, phải chốt sớm

**App Store Guideline 3.1.1:** nội dung/đăng ký số tiêu thụ trong app **bắt buộc dùng Apple IAP** (StoreKit), Apple ăn 15–30%. Stripe/MoMo checkout in-app như hiện tại sẽ **bị từ chối review**.

**Phương án:**
- **A (chuẩn):** StoreKit 2 IAP + endpoint backend mới verify Apple receipt → tái dùng logic provisioning subscription hiện có (đã idempotent — xem trial 7 ngày). Đồng bộ trạng thái với Stripe-trên-web.
- **B:** Đưa toàn bộ mua bán ra **web** (app không có UI mua) — hẹp, dễ rủi ro UX/policy.
- **C:** External purchase link entitlement (US/một số khu vực) — phụ thuộc chính sách, không nên làm nền móng chính.

→ **Đề xuất A.** Đây là workstream riêng, không xem nhẹ.

---

## 9. Checklist thay đổi Backend (nhỏ, gói gọn)
- [ ] `ApnsPushSenderService` + định tuyến theo `platform`.
- [ ] `POST /api/profile/me/push-token` nhận discriminator `platform` (ios/expo).
- [ ] Endpoint mới: verify StoreKit receipt → provision subscription (tái dùng service hiện có).
- [ ] Rà soát DTO các endpoint mobile dùng: ổn định, versioned, đừng đổi phá vỡ trong lúc migrate.
- [ ] (Universal Links) host `apple-app-site-association`.

---

## 10. Lộ trình theo Phase

| Phase | Nội dung | Mục tiêu xong |
|---|---|---|
| **0 — Nền móng** | Xcode + SPM, pipeline OpenAPI codegen, design tokens, Core Networking + Auth, CI build | "Hello API" gọi được `/api/auth/me` thật |
| **1 — Vertical slice** | Auth + Onboarding + Home/Today | Login thật → thấy Today, chạy end-to-end với BE prod/staging |
| **2 — Vòng học lõi** | SRS + Vocabulary + Grammar + offline queue | Học + review chạy, offline sync-back OK |
| **3 — Speaking** | Audio record/playback, AI speaking, TTS, weekly | Tính năng khó nhất hoạt động ổn định |
| **4 — Lộ trình & thi** | Roadmap/Curriculum + Exam/MockExam + Stats | Parity nội dung học |
| **5 — Hệ thống** | APNs push + Notifications + Profile + **Paywall (StoreKit)** | Mua bán hợp lệ App Store |
| **6 — Polish** | Liquid Glass, animation, accessibility, E2E (XCUITest/Maestro) | Chất lượng release |
| **7 — Phát hành** | TestFlight beta → App Store; **khai tử Expo + Capacitor** | Native là client iOS duy nhất |

> Mỗi phase là một lát cắt dọc chạy thật với backend dùng chung — không "build hết rồi mới ráp".

---

## 11. Rủi ro & Quyết định

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| IAP App Store (mục 8) | 🔴 Cao | Chốt phương án A sớm, làm song song từ Phase 1 |
| Effort viết lại ~20 màn + audio + offline | 🔴 Cao | Cắt theo phase, ưu tiên vòng học lõi; chấp nhận parity từng phần |
| Kỹ năng Swift/SwiftUI của team | 🟡 TB | Đào tạo / tuyển; bắt đầu từ vertical slice nhỏ |
| Contract drift native ↔ backend | 🟡 TB | OpenAPI codegen chạy trong CI, fail khi spec đổi |
| Mất người dùng Android | 🟢 Đã chấp nhận | Theo định hướng iOS-first |
| Audio edge cases (interruption, route) | 🟡 TB | Test trên thiết bị thật sớm ở Phase 3 |

---

## 12. Bước tiếp theo đề xuất
1. **Chốt phương án payments (mục 8)** — chặn Phase 5.
2. Scaffold **Phase 0**: tạo Xcode project + SPM + pipeline `swift-openapi-generator` đọc `/v3/api-docs`, dựng Core Networking + Auth + TokenStore.
3. Dựng **vertical slice Phase 1** (Auth → Today) để chứng minh end-to-end với BE dùng chung.
