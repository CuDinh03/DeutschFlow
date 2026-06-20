# DeutschFlow iOS (native SwiftUI) — Kế hoạch phát hành App Store

> **Vai trò:** Release engineer · **Ngày:** 2026-06-20 · **Phạm vi:** App **student** native SwiftUI, dùng chung backend Java/Spring Boot. Teacher KHÔNG nằm trong app native (ở lại web).
> **Nguồn sự thật (đã đọc, trích dẫn, KHÔNG bịa):** `plans/2026-06-02-native-ios-migration-plan.md`, `plans/2026-06-02-native-ios-payments-iap-design.md`, `plans/2026-06-20-openapi-coverage-audit.md`, `plans/2026-06-20-native-handoff-contract.md`, `plans/2026-06-20-native-handoff-phase0.md`, `plans/2026-06-20-roadmap-tree-web-map.md`, `docs/UI_2.0_LEARNING_TREE_DESIGN.md` + `_UPGRADE.md`, `plans/2026-06-20-native-design-batch-prompts.md` + `-remaining-flows.md`; và trạng thái thật của repo (git branch, `backend/.../AppleIapController.java`, `ProfileController.java`, `OpenApiConfig`, `mobile/`).

---

## TL;DR — 3 sự thật cốt lõi (không tô hồng)

1. 🔴 **App native CHƯA TỒN TẠI.** Phase 0 (scaffold) **chưa bắt đầu**. Trong repo chỉ có app **Expo/React-Native** (`mobile/`, sẽ khai tử) + một Xcode project **stub do RN sinh ra** (`mobile/ios/DeutschFlow.xcodeproj`, chỉ có `noop-file.swift`). **Không có một dòng SwiftUI nào.** Đây là blocker tuyệt đối lớn nhất tới App Store.
2. 🟢 **Backend gần như SẴN SÀNG.** Spec OpenAPI cho iOS (P0) đã mở; **IAP StoreKit 2 đã làm thật** (verify JWS bằng SDK chính chủ của Apple + App Store Server Notifications V2 + 20 unit test xanh); **xoá tài khoản** (`DELETE /api/profile/me`) và **push-token có field `platform`** đều đã có. **Không có social login** → **không bị buộc** Sign in with Apple.
3. 🟢 **Design 100%.** ~45+ màn student (A0→E + Lớp học + Cây học tập v2) đã dựng xong dạng **HTML mock** (chưa phải SwiftUI), đủ 3 trạng thái + điều hướng + token GA.

> **Hệ quả:** việc còn lại **chủ yếu là VIẾT app iOS từ 0** (Swift/SwiftUI, ~20 màn + audio + offline + StoreKit client), **không phải sửa backend**. "Blocker IAP" mà kế hoạch gốc lo ngại — **phần backend đã xong**; phần còn lại của IAP là **client StoreKit + cấu hình App Store Connect** (Phase 5).

---

## Bước 2 — Trạng thái theo 3 track

### Track 1 — Design (prototype HTML) · **~100% scope**

| Batch | Màn (ví dụ) | Trạng thái | Ghi chú |
|---|---|---|---|
| A0 — Splash/Welcome | Splash, Welcome, Get Started, Chọn hướng | ✅ done | 4 màn, có loading/lỗi-mạng |
| A — Auth & Onboarding | Đăng ký/Đăng nhập, Quên MK, Onboarding goal/level | ✅ done | nối điều hướng đầy đủ |
| B — Ngữ pháp/Bài học/Từ vựng | Grammar Hub, Lesson, Practice, Review, Node Detail, Vocabulary | ✅ done | 3 trạng thái mỗi màn |
| C — Thi & Tiến độ | Mock Exam Packs, Exam, Results, Assessment, Progress, Achievements | ✅ done | |
| D — Paywall & IAP | Paywall, Quản lý gói, Trạng thái trial | ✅ done | thiết kế theo StoreKit |
| E — Hồ sơ & Cài đặt | Profile Edit, Gói, AI Limits, Goals, Notifications, Ngôn ngữ, TTS, Help, **Xoá tài khoản** | ✅ done | 9 màn |
| Lớp học (Classroom) | B2B có lớp vs B2C tự học (Tweaks) | ✅ done | |
| Cây học tập v2 (Learning Tree) | level→branch→shoot→node + level-up | ✅ done | renderer web đã live-verify |

**Tổng:** ~45+ màn, **Done = đủ 3 trạng thái + aria-label + nối điều hướng, không nút ngõ cụt, sẵn sàng design-to-code** (`native-design-batch-prompts.md:128`). Token khoá theo **GA (`galerie.css`)**, KHÔNG dùng `mobile/lib/theme/tokens.ts`.
**→ Không chặn phát hành.** Đây là tài sản đã hoàn tất; rủi ro chỉ là công sức chuyển HTML → SwiftUI.

### Track 2 — Backend (hợp đồng API) · **~85% cho slice native, phần chặn đã xong**

| Hạng mục | Trạng thái | Bằng chứng | Chặn? |
|---|---|---|---|
| **P0** — nhóm `ios` `/v3/api-docs/ios` (24 path-prefix, 143 path) + 3 server URL + `bearerAuth` JWT | ✅ DONE | `openapi-coverage-audit.md`; `IosOpenApiContractTest` xanh | — |
| **P1** typed-DTO: Progress(2), Srs(2), MockExam(9, 43→0), GrammarSyllabus(6), Certificate(3) | ✅ DONE | byte-equivalence tests; live `getTopics`→200 | — |
| **P1 còn nợ (free-form ~37 endpoint):** AIVocabulary(7), AIGrammar(6), AISpeaking(4), Tts(binary), LearningPlan(2, chưa trong nhóm `ios`), AppleIap `/verify`+`/sync` (`ResponseEntity<?>`) | 🔧 đang/chưa | `openapi-coverage-audit.md` | **Không chặn** (nợ kỹ thuật, sửa theo batch) |
| Dropped: PracticeNode(8), SkillTree(17) | ⛔ bỏ | dùng RoadmapTree thay thế | — |
| **IAP StoreKit 2 — backend** (verify/sync/notifications) | ✅ DONE thật | `AppleIapController` + `payment/apple` (8 lớp, `AppleJwsVerifier` dùng `app-store-server-library`), V189, 20 test | — |
| `GET /products` + `GET /account-token` (cho paywall iOS) | ✅ typed | `AppleProductResponse`, `AppleAccountTokenResponse` | — |
| **Xoá tài khoản** `DELETE /api/profile/me` + `AccountDeletionService` (cascade) | ✅ DONE | `ProfileController:101` | — |
| **Push-token** `POST /api/profile/me/push-token` nhận `platform ∈ {ios,android}` | ✅ DONE | `ProfileController:83-94` `@Pattern("ios|android")` | — |
| **ApnsPushSenderService** (gửi push tới APNs native bằng `.p8`) | 🟡 **cần kiểm chứng / nhiều khả năng CHƯA** | migration §9 liệt kê là `[ ]`; Expo hiện dùng Expo Push, chưa thấy service gửi APNs | Không chặn submit (push có thể bật sau) |
| Learning Tree: `RoadmapTreeController /api/roadmap/tree` (TreeDto typed) + V219 seed 48 topic/144 node + state machine 19 test | ✅ DONE | `UI_2.0_LEARNING_TREE_DESIGN.md §7` | — |

**→ Phần backend CHẶN phát hành (IAP verify, account-deletion, spec auth slice) đều đã xong.** Phần còn lại là **nợ kỹ thuật không chặn** (typed-DTO cho AI/Tts/LearningPlan) + 1 việc cần kiểm chứng (APNs sender).

### Track 3 — Native iOS (code) · **0% — chưa khởi động**

Đối chiếu lộ trình **Phase 0–7** trong `native-ios-migration-plan.md §10` (kế hoạch nêu "lộ trình theo phase"; bảng §10 liệt kê Phase 0–7 = 8 phase):

| Phase | Nội dung | Trạng thái |
|---|---|---|
| **0 — Foundation** | Xcode project SwiftUI (min iOS 17), SPM modules, `swift-openapi-generator` plugin, Core Networking + `actor TokenStore`(Keychain) + AuthInterceptor 401→refresh, DesignSystem từ `galerie.css`, app skeleton auth-gated 5 tab | ❌ **CHƯA** |
| **1 — Vertical slice Auth → Hôm nay** | Auth (login/register/forgot/reset) → Onboarding → Home (today/stats/xp/progress), login thật trên thiết bị | ❌ CHƯA |
| 2 — Core loop | SRS + Vocabulary | ❌ CHƯA |
| 3 — Speaking/Audio | AVFoundation, mic, pronunciation, TTS | ❌ CHƯA |
| 4 — Roadmap/Exam | Cây học tập + Mock Exam | ❌ CHƯA |
| 5 — Systems | **APNs + Paywall (StoreKit 2 client)** | ❌ CHƯA |
| 6 — Polish | Liquid Glass, a11y, offline | ❌ CHƯA |
| 7 — Release | TestFlight → App Store, khai tử Expo | ❌ CHƯA |

**Ground truth:** branch hiện tại `feat/native-openapi-typing` (việc đang làm = typed-DTO backend); `mobile/app.json` = Expo, bundle id `com.deutschflow.app`; **không có** `Package.swift` / Generated client / DesignSystem SwiftUI. **→ Toàn bộ Track 3 CHẶN phát hành.** Đây là khối lượng công việc lớn nhất còn lại.

---

## Bước 3 — Phân tích GAP tới App Store (🔴 chặn / 🟡 phải xử lý / 🟢 ổn)

### 3.1 IAP — Guideline 3.1.1 (nội dung/đăng ký số phải dùng StoreKit)
- **Backend: 🟢 SẴN SÀNG.** `AppleIapController` verify JWS StoreKit 2 thật, Notifications V2, ánh xạ `productId→planCode→user_subscriptions` (nguồn chân lý), idempotent theo `transactionId`. Product IDs đã seed: `com.deutschflow.app.{pro,ultra}.{monthly,yearly}`.
- **iOS client: 🔴 CHƯA CÓ** (Phase 5). Phải dựng màn mua bằng **StoreKit 2** (`Product.purchase()` → gửi JWS lên `/verify`), restore bằng `/sync`.
- **Anti-steering 3.1.3 + cấm cổng web: 🟡 PHẢI ĐẢM BẢO.** Backend có `StripePaymentController`, `MomoPaymentController`, `SepayWebhookController`. **App iOS TUYỆT ĐỐI không được mở các màn/endpoint này**, không link "mua trên web". Paywall iOS chỉ gọi `/api/payments/apple/*` + đọc entitlement chéo từ `/api/auth/me/plan` (đã honor Stripe/MoMo "thầm lặng").
- **Quyết định còn mở (chốt trước submit):** bán `yearly` ngay hay chỉ `monthly`; giữ trial-server 7 ngày hay dùng intro-offer của Apple; xung đột đa-provider "latest-wins"; UX refund (`iap-design.md` §13).

### 3.2 Sign in with Apple — Guideline 4.8
- **🟢 KHÔNG CẦN.** Backend chỉ có **email/password** (`AuthController`), **không có** Google/Facebook/social login (grep xác nhận; "google" chỉ là Google Slides + Gemini AI, không phải auth). Vì không cung cấp đăng nhập bên thứ ba → **không kích hoạt** yêu cầu Sign in with Apple. *(Nếu sau này thêm Google login → BẮT BUỘC kèm Sign in with Apple.)*

### 3.3 Xoá tài khoản trong app — Guideline 5.1.1(v)
- **Backend 🟢:** `DELETE /api/profile/me` + `AccountDeletionService` cascade.
- **iOS 🟡:** cần **UI xoá tài khoản** trong app (màn E đã thiết kế) gọi endpoint trên + xác nhận. Bắt buộc có trước review.

### 3.4 Privacy
- **NSMicrophoneUsageDescription 🟡:** tính năng luyện nói/chấm phát âm/TTS là **thật** (`PronunciationController`, `TtsController`, `AISpeakingController`). Info.plist của app **Expo** đã có key này + `NSSpeechRecognitionUsageDescription`, nhưng **app SwiftUI mới phải tự khai lại**.
- **ATT (App Tracking Transparency) 🟡:** dự án dùng **PostHog** analytics → xác định có "tracking" theo định nghĩa Apple không; nếu có → cần `NSUserTrackingUsageDescription` + ATT prompt, hoặc cấu hình PostHog không-tracking để tránh.
- **App Privacy "nutrition labels" 🟡** (admin khai trong ASC) + **Privacy Policy URL 🟡** (bắt buộc) + bản đồ dữ liệu thu thập (email, học liệu, audio, thanh toán).

### 3.5 Push APNs
- **🟡:** cần **APNs `.p8` key** + capability Push, **xác nhận/dựng `ApnsPushSenderService`** (migration task #1, nhiều khả năng chưa có). Endpoint `push-token` đã nhận `platform:"ios"`. *(Không chặn submit bản đầu — có thể bật push sau.)*

### 3.6 Khác
- **Export compliance 🟢/🟡:** khai `ITSAppUsesNonExemptEncryption=false` trong Info.plist (chỉ dùng HTTPS chuẩn) để khỏi khai báo encryption.
- **Min iOS 🟢:** iOS 17 (đã chốt).
- **Associated Domains / AASA 🟡:** nếu dùng deep link / universal link cần `apple-app-site-association` trên domain + capability.
- **Bản địa hoá VI/DE 🟡:** UI tiếng Việt là chính; cân nhắc DE; metadata ASC nên có VI (+ EN/DE nếu nhắm thị trường Đức).

### 3.7 Bảng rủi ro xếp hạng

| # | Rủi ro | Mức | Vì sao | Việc cần |
|---|---|---|---|---|
| 1 | **Chưa có app native** (Phase 0–7 = 0%) | 🔴🔴 | Không thể submit khi không có app | Dựng Phase 0 → 1 → … |
| 2 | **IAP client StoreKit (Phase 5)** | 🔴 | 3.1.1 chặn review; backend đã sẵn | Màn mua + verify/restore |
| 3 | Cổng web Stripe/MoMo lọt vào app | 🟡 | 3.1.1/3.1.3 reject | Không build/route các màn payment web |
| 4 | UI xoá tài khoản | 🟡 | 5.1.1(v) | Màn E gọi `DELETE /me` |
| 5 | Privacy labels + Policy URL + ATT(PostHog) | 🟡 | metadata bắt buộc | Khai ASC + quyết ATT |
| 6 | Mic permission string ở app mới | 🟡 | crash/reject nếu thiếu | Thêm NSMicrophone… |
| 7 | APNs sender service | 🟡 | push chưa chạy native | Kiểm chứng/dựng (sau submit cũng được) |
| 8 | Nợ typed-DTO (AI/Tts/LearningPlan) | 🟢 | chỉ là dict mờ cho codegen | Sửa theo batch khi tới |
| 9 | Sign in with Apple | 🟢 | không có social login | Không cần (giữ nguyên) |

---

## Bước 4 — Kế hoạch phát hành theo nhóm + CHECKLIST

> Mỗi mục: `[ ]` + **owner** (iOS / BE / design / admin) + cờ **🔴 chặn review** hoặc **🟢 không chặn**.

### A. Tài khoản & ký số (admin)
- [ ] 🔴 (admin) Đăng ký/đảm bảo **Apple Developer Program** còn hiệu lực.
- [ ] 🔴 (admin) Khoá **Bundle ID** native. **Lưu ý:** `com.deutschflow.app` đang gắn app **Expo**; quyết **tái dùng** (khai tử Expo trước) hay **dùng id mới** để chạy song song giai đoạn beta.
- [ ] 🔴 (admin) **App ID + capabilities:** Push Notifications, **In-App Purchase**, Associated Domains *(nếu deep link)*. **KHÔNG bật** Sign in with Apple (không cần).
- [ ] 🔴 (admin) **APNs `.p8` key** (tải về, lưu bí mật cho BE).
- [ ] 🔴 (admin/iOS) **Certificates + Provisioning** (ưu tiên Xcode Automatic Signing / hoặc fastlane match).
- [ ] 🔴 (admin) Tạo **App Store Connect app record** (tên, ngôn ngữ chính, category).
- [ ] 🔴 (admin) Tạo **Subscription Group** + 4 sản phẩm `com.deutschflow.app.{pro,ultra}.{monthly,yearly}` (giá, localized, review screenshot). Khớp `apple_products` đã seed (V189).
- [ ] 🟢 (admin) **StoreKit Configuration file** trong Xcode để test IAP cục bộ trước khi sandbox.

### B. Tính năng bắt buộc trước review (iOS)
- [ ] 🔴 (iOS) **Paywall StoreKit 2:** load `/products`, `Product.purchase()`, gắn `appAccountToken` từ `/account-token`, gửi JWS → `POST /api/payments/apple/verify`, **Restore** → `/sync`. Đọc tier hiển thị từ `/api/auth/me/plan`.
- [ ] 🔴 (iOS) **KHÔNG** có màn/đường dẫn thanh toán web (Stripe/MoMo/SePay); không link "mua trên web" (anti-steering).
- [ ] 🔴 (iOS) **UI Xoá tài khoản** (màn E) → `DELETE /api/profile/me` + xác nhận + đăng xuất.
- [ ] 🔴 (iOS) **NSMicrophoneUsageDescription** (+ `NSSpeechRecognitionUsageDescription` nếu dùng) trong Info.plist app mới.
- [ ] 🟢 (iOS) Bỏ qua **Sign in with Apple** (không có social login).
- [ ] 🟡 (iOS) Trạng thái **offline / empty / error** cho mọi màn slice phát hành (design đã có sẵn 3 trạng thái).
- [ ] 🟡 (iOS) `ITSAppUsesNonExemptEncryption=false` trong Info.plist.

### C. Hạ tầng backend (BE)
- [ ] 🟢 (BE) **IAP verify/notifications** — ĐÃ XONG (giữ nguyên, cấu hình `payment.apple.root-cert-dir` + bundleId + appAppleId + environment cho prod).
- [ ] 🟢 (BE) **push-token `platform`** — ĐÃ XONG.
- [ ] 🟡 (BE) **`ApnsPushSenderService`** (migration task #1): kiểm chứng có chưa; nếu chưa → dựng (gửi APNs bằng `.p8`, route theo `platform`). *(Không chặn submit bản đầu.)*
- [ ] 🟡 (BE) Cấu hình **App Store Server Notifications V2 URL** (`/api/payments/apple/notifications`) trong ASC trỏ về prod.
- [ ] 🟢 (BE) Spec `ios` ổn định/versioned — pin `openapi.json` trong repo iOS; CI fail khi drift (đã có guard `IosOpenApiContractTest`).
- [ ] 🟢 (BE) JWT/CORS cho client iOS — REST stateless, Bearer; không cần CORS (native). Xác nhận rate-limit không chặn thiết bị thật.
- [ ] 🟡 (BE, nợ không chặn) Typed-DTO batch còn lại khi tới: AppleIap `/verify`+`/sync` (`ResponseEntity<?>`→`AppleActivationResult`), AIVocab/AIGrammar/AISpeaking, Tts (octet-stream), LearningPlan (+thêm `/api/plan/**` vào nhóm `ios`).

### D. Chất lượng (iOS)
- [ ] 🟡 (iOS/BE) **Sentry** (hoặc Crashlytics) — crash-free tracking; dự án đã có nhánh `feat/backend-sentry-error-tracking`.
- [ ] 🟡 (iOS) **E2E smoke** (XCUITest/Maestro) cho slice **Auth → Hôm nay → mua IAP (sandbox)**.
- [ ] 🟡 (iOS) **Accessibility:** Dynamic Type, VoiceOver, aria-label (design đã ghi chú), contrast.
- [ ] 🟢 (iOS) **Liquid Glass / polish** (Phase 6) — không chặn beta.
- [ ] 🟡 (iOS) Test trên **thiết bị thật** (audio/mic edge cases — rủi ro 🟡 trong migration §11).

### E. Metadata App Store (admin + design)
- [ ] 🔴 (admin) Tên + subtitle; **mô tả VI** (+ DE/EN nếu nhắm Đức); keywords.
- [ ] 🔴 (design) **Screenshots đủ mọi kích cỡ** (6.7"/6.5"/6.1" + iPad nếu hỗ trợ) — render từ build thật hoặc từ design.
- [ ] 🔴 (design) **App icon** (1024px) + bộ icon.
- [ ] 🔴 (admin) **Age rating**, **Category** (Education), Support URL, Marketing URL.
- [ ] 🔴 (admin) **Privacy Policy URL** + **App Privacy answers** (email, học liệu, audio mic, thanh toán, analytics PostHog).
- [ ] 🔴 (admin) **Demo account** cho reviewer (tài khoản student có sẵn dữ liệu + gói để test paywall ở sandbox).
- [ ] 🟡 (admin) Quyết **ATT**: nếu PostHog = tracking → thêm ATT; nếu không → khai "không tracking" cho khớp.

### F. Phát hành (iOS + admin)
- [ ] 🔴 (iOS) Build **TestFlight internal** (slice Auth→Hôm nay→Paywall) → kiểm thử nội bộ.
- [ ] 🟡 (admin) **TestFlight external** (beta) + Beta App Review.
- [ ] 🔴 (admin) **Submit App Store** → xử lý review feedback (đặc biệt IAP/anti-steering/account-deletion).
- [ ] 🟢 (admin) **Phased release**.
- [ ] 🟢 (admin/iOS) Sau khi ổn định: **khai tử Expo + Capacitor** (gỡ `mobile/`, nhánh `feat/capacitor-mobile`), gỡ Expo push.

---

## Đường tới phát hành (thứ tự tối thiểu)

**Blocker lớn nhất (trung thực):** **chưa có app native** — Track 3 = 0%. "Lo ngại IAP" của kế hoạch gốc thực tế **đã được giải quyết ở backend**; phần IAP còn lại là **client StoreKit + cấu hình ASC** (Phase 5). Vậy con đường là *viết app*, không phải *sửa backend*.

**Để có build TestFlight ĐẦU TIÊN (lát cắt Auth→Hôm nay):**
1. **(admin)** Apple Developer Program + Bundle ID + App ID (Push/IAP capability) + ASC app record. *(chạy song song bước 2)*
2. **(iOS) Phase 0 — Scaffold:** Xcode SwiftUI (iOS 17) + SPM + `swift-openapi-generator` trỏ `/v3/api-docs/ios` (pin `openapi.json`) → sinh client/DTO; Core Networking + `actor TokenStore`(Keychain) + AuthInterceptor 401→refresh; DesignSystem từ `galerie.css`. **DoD:** build sạch CI + gọi `/api/auth/me` ra user thật.
3. **(iOS) Phase 1 — Vertical slice:** Auth (login/register/forgot/reset) → Onboarding → Hôm nay (today/stats/xp/progress). **DoD:** login thật trên thiết bị → thấy Hôm nay dữ liệu thật.
4. **(iOS/admin)** Ký số + upload **TestFlight internal**. ✅ **Đây là build TestFlight đầu tiên.**

**Để SUBMIT App Store:**
5. **(iOS)** Phase 2–4: SRS/Vocab, Speaking (mic + NSMicrophone…), Cây học tập (`/api/roadmap/tree`), Mock Exam.
6. **(iOS) Phase 5 — IAP + APNs:** Paywall StoreKit 2 (verify/restore, KHÔNG cổng web) + **UI xoá tài khoản**. **(admin)** tạo 4 product trong ASC + Notifications V2 URL. **(BE)** kiểm chứng/dựng `ApnsPushSenderService`.
7. **(iOS)** Phase 6 polish + E2E smoke + Sentry + test thiết bị thật.
8. **(admin)** Metadata (mô tả/screenshots/icon/privacy labels/Policy URL/demo account/ATT) → **Submit** → xử lý feedback → **phased release**.
9. **(sau release)** Khai tử Expo + Capacitor.

### 👉 Việc kế tiếp cụ thể (ngay bây giờ)
**Phase 0 scaffold** — tạo Xcode project SwiftUI + pipeline `swift-openapi-generator` (spec đã sẵn ở `/v3/api-docs/ios`) + Core Networking/Auth, để đạt mốc "Hello API" gọi `/api/auth/me`. Song song, **(admin)** mở Apple Developer Program + Bundle ID/App ID. Đây là điều kiện cần trước mọi thứ khác.

---

### Phụ lục — nợ không chặn (làm dần, không cản TestFlight/submit)
- Typed-DTO: AppleIap `/verify`+`/sync` (`ResponseEntity<?>`→`AppleActivationResult`), AIVocabulary(7)/AIGrammar(6)/AISpeaking(4), Tts (octet-stream), LearningPlan(2, +nhóm `ios`). *(PR #127 đang gom các vòng typed-DTO trên nhánh `feat/native-openapi-typing`.)*
- Learning Tree polish: responsive portrait (P4), bottom-sheet preview (P2), share poster (P3) — đều "chưa implement", hậu phát hành.
- Quyết định IAP còn mở: yearly, trial vs intro-offer, multi-provider, refund UX.
