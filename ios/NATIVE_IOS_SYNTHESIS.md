# DeutschFlow Native iOS — Tổng hợp toàn sáng kiến

> **Ngày:** 2026-06-21 · **Cho:** chủ dự án + dev tiếp nhận. Đây là tài liệu **đọc-đầu-tiên**: gom toàn bộ công việc app native iOS (hợp đồng API + app + đường ra App Store) vào một chỗ, và trỏ tới các doc chi tiết.

---

## 0. TL;DR (3 câu)

1. **Hợp đồng API có kiểu (OpenAPI typed contract) đã vào `main`** → backend tự mô tả mình đầy đủ-kiểu, app iOS tự sinh client Swift, không gõ tay model nào.
2. **App native SwiftUI đã dựng nền + chạy luồng đăng nhập thật, build xanh + đóng gói (archive) được** cho máy iOS — dừng đúng ở **cổng ký số/Apple** (không thể tự động).
3. Còn lại = **(a) viết tiếp các màn (tự động được)** + **(b) thủ tục Apple** (đăng ký Developer, IAP, screenshots, nộp review — cần bạn).

---

## 1. Bản đồ tài liệu (đọc cái nào khi cần gì)

| Doc | Nội dung | Trạng thái |
|---|---|---|
| **`ios/NATIVE_IOS_SYNTHESIS.md`** (file này) | Tổng hợp + chỉ mục toàn sáng kiến | ✅ tracked |
| [`ios/BUILD_AND_DEPLOY.md`](BUILD_AND_DEPLOY.md) | Giải thích build/deploy + **§5b chạy thử ra máy** + phân tích App Store | ✅ tracked |
| [`ios/README.md`](README.md) | Quickstart dev (tools, pin spec, xcodegen, DoD Phase 0) | ✅ tracked |
| [`plans/2026-06-20-appstore-release-plan.md`](../plans/2026-06-20-appstore-release-plan.md) | Kế hoạch phát hành App Store: 3 track, GAP, checklist A–F | ✅ tracked |
| `plans/2026-06-20-openapi-coverage-audit.md` | Rà độ phủ OpenAPI cho codegen (24 path student) | 📝 local |
| `plans/2026-06-20-native-handoff-contract.md` | Map Màn ↔ Endpoint ↔ Shape DTO | 📝 local |
| `plans/2026-06-20-native-handoff-phase0.md` | Design-to-code handoff + Phase 0/1 slice | 📝 local |
| `plans/2026-06-20-native-design-{batch-prompts,remaining-flows}.md` | Prompt + plan dựng nốt màn design | 📝 local |
| `plans/2026-06-20-roadmap-tree-web-map.md` | Map Cây học tập theo bản web v2 | 📝 local |

📝 local = có trong thư mục làm việc nhưng chưa commit (tài liệu lập kế hoạch).

---

## 2. Vì sao có app native (bối cảnh)

Web + backend Java/Spring Boot đã chạy thật. App di động cũ là **Expo/React-Native** (`mobile/`) → sẽ khai tử. Viết lại app **native SwiftUI** (`ios/`) vì: hiệu năng/UX tốt hơn, **StoreKit (IAP) chuẩn cho App Store**, và **dùng lại 100% backend** qua hợp đồng OpenAPI. Không viết lại nghiệp vụ — app chỉ là một client mới gọi đúng API cũ.

**3 track:**
| Track | Là gì | Trạng thái |
|---|---|---|
| **Design** | ~45+ màn HTML prototype (Galerie) | ✅ ~100% scope (mock, chưa SwiftUI) |
| **Backend (hợp đồng API)** | Mở spec `ios` + đổi `Map` "mù" → DTO **có kiểu** | ✅ **xong + đã vào `main`** (mục 3) |
| **Native iOS (code)** | Viết app SwiftUI thật | 🟡 Phase 0 + Phase 1 (login) xong (mục 4) |

---

## 3. Hợp đồng API có kiểu — đã vào `main` ✅

### 3.1 Cơ chế (điểm hay nhất: không gõ tay model/HTTP)

```
Backend Spring Boot
  └─ springdoc-openapi  →  /v3/api-docs/ios   (150 path student/auth, 0 free-form, application/json)
                                  │  pin 1 bản về repo: ios/openapi/openapi.json
                                  ▼
  swift-openapi-generator (chạy như BUILD PLUGIN của Xcode)
                                  │  đọc openapi.json → sinh:
                                  ▼
  Client (client.login(), client.me2()…) + Types (struct AuthResponse…)  → app gọi struct có kiểu
```

Mỗi khi backend đổi API → build lại → client tự cập nhật; CI bắt "lệch hợp đồng".

### 3.2 Hai phát hiện then chốt (lộ ra khi build thật)

1. **springdoc mặc định `produces: */*`** → bộ sinh code coi **mọi** response là "byte thô", **mất hết kiểu**. → Sửa 1 dòng: `springdoc.default-produces-media-type: application/json`. **Đã vào `main`.**
2. **Tên hàm sinh tự động đổi số khi spec thêm path:** nhiều path cùng kết thúc `/me` (auth/plan/profile…) nên có hậu tố số. Hiện `GET /api/auth/me` = `client.me2()`. Muốn tên **ổn định** → backend thêm `operationId` (khuyến nghị, không bắt buộc).

### 3.3 Quyết định #127 vs #128 (quan trọng — đọc kỹ)

Toàn bộ typed-DTO làm trên nhánh `feat/native-openapi-typing`, **xếp chồng trên nhánh coin** `feat/student-coin-currency` → [PR #127](https://github.com/CuDinh03/DeutschFlow/pull/127) **nhắm base = coin, KHÔNG phải `main`**.

→ Nếu merge #127 thẳng sẽ **kéo ~30 commit coin/audit/ui-2.0 chưa release vào `main`** (nguy hiểm). Vì vậy đã chọn **tách riêng chỉ phần typing**:

- **[PR #128](https://github.com/CuDinh03/DeutschFlow/pull/128) → đã MERGE vào `main`** (merge commit `467403b6`, 2026-06-21).
- 9 commit typing (`88f48f9f`…`fb2a8ecf`) **cherry-pick lên nhánh mới tách từ `main`** (`feat/openapi-typed-contract`).
- Chỉ **1 file đụng coin** — `MockExamController.java` (coin thêm cổng tiêu xu trial-pass + `@Transactional`) → hoà giải về **logic main + kiểu trả về `ExamStartDto`, GỠ coin**.
- **Verify:** `mvn test-compile` xanh + **56 test byte-equivalence (11 class DTO) 0-fail** + diff đã kiểm **không dính coin** (không `gamification/coin`/V221/CoinService).

> ⚠️ **Nợ kỹ thuật đã biết:** khi nhánh coin về `main` sau này, `MockExamController` sẽ cần **hoà giải nhẹ 1 lần** (main = typed-không-coin vs coin = typed-có-coin). #127 **để mở** đi theo chuỗi coin.

### 3.4 Độ phủ
`/v3/api-docs/ios` = **150 path student/auth, 0 free-form, có kiểu hoàn toàn**. Các nhóm đã typed: MockExam (43 site mù → 0), GrammarSyllabus, Certificate, AISpeaking, AIVocabulary, AIGrammar, LearningPlan, Progress, Srs, AppleIap, Tts + residual Round-10. (PracticeNode bỏ — legacy/không dùng.)

---

## 4. App native iOS (Phase 0 + Phase 1)

### 4.1 Kiến trúc (xem chi tiết ở BUILD_AND_DEPLOY §3)
SwiftUI + MVVM + `@Observable` (iOS 17+), `URLSession async/await`. `Sources/`:
- **App/** — `@main`, RootView "auth-gated", MainTabView (5 tab).
- **Core/DesignSystem** — token GA "đóng băng" thành code (Ga*).
- **Core/Networking** — AppEnvironment (prod/staging/local), AuthenticationMiddleware (tự gắn Bearer + 401→refresh), APIClientFactory.
- **Core/Auth** — TokenStore (actor + Keychain, chống bão refresh), AuthSession.
- **Features/** — Auth/LoginView (login thật), Home/HomeView (gọi `/api/auth/me`).

### 4.2 Đã verify bằng `xcodebuild`
| Mốc | Bằng chứng | Commit |
|---|---|---|
| Phase 0 scaffold + codegen | xcodegen + BUILD SUCCEEDED | `1a3b43c6` |
| Phase 0 Hello API (`/api/auth/me`) | BUILD SUCCEEDED | `79331d73` |
| Phase 1 Login thật | BUILD SUCCEEDED | `2f828982` |
| Typed `.json` (pin spec 150 + `me2`) | BUILD SUCCEEDED | `d877cb64` |
| Deploy-build (Release archive, chưa ký) | **ARCHIVE SUCCEEDED** → `DeutschFlow.app` | artifact |

Nhánh: **`feat/native-ios-phase0`** (`d877cb64`, đã push). Bundle `com.deutschflow.app`, iOS 17+.

### 4.3 Chạy thử ra máy → xem [BUILD_AND_DEPLOY.md §5b](BUILD_AND_DEPLOY.md)
Tóm tắt: `brew install xcodegen` → `cd ios && xcodegen generate && open DeutschFlow.xcodeproj` → Signing&Capabilities chọn Team (Apple ID **miễn phí** đủ chạy thử, app hết hạn sau 7 ngày) → cắm iPhone → Run. App nối **backend production** mặc định.

---

## 5. Trạng thái tổng: Done / Verified / Remaining

**✅ Đã xong + verify:**
- Hợp đồng API typed trong `main` (compile + 56 test byte-equiv).
- App Phase 0 + Phase 1 (login) — build + archive xanh.
- Doc owner-facing + device-run guide.

**🟡 Làm tiếp được (tự động, có build verify):**
- Phase 1 nốt: Đăng ký, Quên mật khẩu, Onboarding, màn Hôm nay thật (`/api/today`+`/api/student`+`/api/progress`+`/api/xp`).
- Phase 2–4: SRS+Từ vựng, Luyện nói (mic/audio), Cây học tập (`/api/roadmap/tree`), Thi (Mock Exam).
- QA từng màn vs Galerie design prototype.

**⛔ Cổng Apple/người (KHÔNG tự động — lý do dừng):** chi tiết checklist A–F trong [release-plan](../plans/2026-06-20-appstore-release-plan.md).
1. Đăng ký **Apple Developer** ($99/năm) + certificate/provisioning.
2. **App Store Connect**: app record, 4 IAP (`com.deutschflow.app.{pro,ultra}.{monthly,yearly}`), metadata, screenshots, App Privacy, tài khoản demo reviewer.
3. **StoreKit sandbox** (Phase 5) + test máy thật.
4. Nộp review + xử lý phản hồi.

---

## 6. Rủi ro App Store (xếp hạng — từ release plan §3.7)

- 🔴 **IAP (Guideline 3.1.1):** nội dung số phải mua qua StoreKit; **cấm** mở cổng web (Stripe/MoMo/SePay) trong app. Backend IAP đã làm thật (StoreKit 2 verify) → còn **client StoreKit (Phase 5) + cấu hình ASC**. App tuyệt đối không lộ màn thanh toán web.
- 🟡 **Account deletion (5.1.1v):** backend `DELETE /api/profile/me` có sẵn → cần **UI xoá tài khoản** (đã có stub tab Hồ sơ).
- 🟡 **Privacy:** đã nhúng `NSMicrophoneUsageDescription`; cần quyết ATT (PostHog) + Privacy Policy URL + khai App Privacy.
- 🟢 **Sign in with Apple (4.8):** không cần (chỉ email/mật khẩu, không social login).

---

## 7. Quyết định đã chốt (decision log)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | SwiftUI + codegen từ OpenAPI | ít gõ tay, chống lệch hợp đồng |
| D2 | iOS 17 tối thiểu, `@Observable` + actor TokenStore + Keychain | hiện đại, an toàn token |
| D3 | XcodeGen (`.xcodeproj` không commit) | tránh xung đột project file |
| D4 | `springdoc default-produces = application/json` | bắt buộc để codegen ra body có kiểu |
| D5 | **Typed contract vào `main` qua PR #128 (tách khỏi coin)**, không merge #127 | tránh kéo coin/ui-2.0 chưa release vào main |
| D6 | Drop PracticeNode khỏi P1 | legacy/không dùng |
| D7 | Dừng ở archive chưa ký (`CODE_SIGNING_ALLOWED=NO`) | ký số là cổng Apple, không tự động được |

---

## 8. Gotchas (bài học rút ra)

- **springdoc `*/*` → mất kiểu** (D4). Triệu chứng: `ok.body` không có `.json`, chỉ `.any`.
- **Tên op sinh tự động đổi số** khi spec thêm path (`me1`→`me2`). Đã ghi chú trong `HomeView.swift`. Khắc phục ổn định = backend `operationId`.
- **`openapi/` trong `project.yml` phải `buildPhase: resources`** (không `none`) nếu không plugin báo "No OpenAPI document found".
- **api-docs ADMIN-gated** trừ khi backend chạy profile `local`/`dev`/`test` → muốn pin spec từ prod cần token ADMIN.
- **Pin spec local:** backend tạm `:8081` với `SPRING_PROFILES_ACTIVE=local`, `SPRING_FLYWAY_ENABLED=false`, `ddl-auto=none`, **dummy AWS creds** (nếu không `AwsS3Config` crash).
- **Coin entanglement:** typed-DTO làm trên nhánh coin → 1 file (`MockExamController`) đụng coin khi đưa về main; phải hoà giải tay (D5).

---

## 9. Đường đi tiếp (thứ tự khuyến nghị)

1. **Bạn build thử ra máy** theo [BUILD_AND_DEPLOY §5b](BUILD_AND_DEPLOY.md) (Apple ID miễn phí).
2. Mình build tiếp **Phase 1–4** (các màn) — tự động + verify, dùng spec typed từ `main`.
3. **Bạn** mở **Apple Developer + App Store Connect** (cổng A/E trong release-plan) → mở khoá **Phase 5 (StoreKit IAP)**.
4. Có chứng chỉ → ký + upload **TestFlight** → external beta → submit → phased release → **khai tử Expo**.
