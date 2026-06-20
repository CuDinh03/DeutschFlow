# DeutschFlow iOS — Giải thích & Phân tích Build/Deploy

> **Ngày:** 2026-06-21 · **Cho:** chủ dự án (không cần rành iOS) để hiểu app native đang ở đâu, build/deploy ra sao, và còn vướng gì.
> 📒 **Tổng hợp toàn sáng kiến (đọc trước):** [`NATIVE_IOS_SYNTHESIS.md`](NATIVE_IOS_SYNTHESIS.md) — file này tập trung vào **build/deploy**.
> **Trạng thái chốt:** app **build xanh** (đã dùng spec **có kiểu** `application/json`) + **archive được cho deploy** (Release, máy iOS). Dừng đúng ở **cổng ký số/Apple** (không thể tự động).
> **➡️ Muốn build thử ra máy ngay:** xem **§5b — Chạy thử ra máy thật**.

---

## 1. TL;DR (đọc cái này là đủ nắm)

- App iOS native (Swift/SwiftUI) đã **dựng nền + chạy được luồng đăng nhập**, và **đóng gói (`.xcarchive`) thành công** — tức là "đã build sản phẩm tới bước sẵn sàng deploy".
- **Mình dừng ở đây** vì bước tiếp theo (ký số → upload TestFlight/App Store) **bắt buộc tài khoản Apple Developer của bạn** — máy/AI không vượt qua được.
- Bằng chứng (tự kiểm chứng, không nói suông): `xcodebuild ... archive` → `** ARCHIVE SUCCEEDED **`, ra `DeutschFlow.app` (bundle `com.deutschflow.app`, iOS 17+, đã nhúng quyền microphone).
- Việc còn lại chia 2 nhóm: **(a) code mình làm tiếp được** (các màn Phase 1–4), và **(b) cổng Apple/người phải làm** (đăng ký Developer, ký số, IAP, screenshots, nộp review).

---

## 2. Bức tranh tổng thể — tại sao có app native này

Web app + backend Java/Spring Boot đã chạy thật. App di động cũ là **Expo/React-Native** (`mobile/`) — sẽ khai tử. Ta viết lại app **native SwiftUI** (`ios/`) vì: hiệu năng/UX tốt hơn, StoreKit (IAP) chuẩn, và **dùng lại 100% backend** qua hợp đồng API (OpenAPI). Không viết lại nghiệp vụ — app chỉ là một "client" mới gọi đúng API cũ.

3 luồng công việc (3 track):
| Track | Là gì | Trạng thái |
|---|---|---|
| **Design** | ~45+ màn HTML prototype (A0→E + Lớp học + Cây học tập) | ✅ ~100% (mock, chưa phải SwiftUI) |
| **Backend (hợp đồng API)** | Mở spec `ios` + đổi `Map` "mù" → DTO **có kiểu** | ✅ phần lõi xong; nốt typed-DTO đang chạy ở **PR #127** |
| **Native iOS (code)** | Viết app SwiftUI thật | 🟡 Phase 0 xong + Phase 1 (login) — **chính là cái doc này** |

---

## 3. Kiến trúc app (giải thích từng lớp)

Cấu trúc thư mục `ios/Sources/`:
```
App/        → điểm vào + khung điều hướng
  DeutschFlowApp.swift   @main, tạo AuthSession, nạp DesignSystem
  RootView.swift         "auth-gated": chưa đăng nhập → Login; đã đăng nhập → 5 tab
  MainTabView.swift      5 tab: Hôm nay · Lộ trình · Luyện nói · Lớp học · Hồ sơ
Core/
  DesignSystem/  GaColor/GaFont/GaSpace/GaRadius/GaMotion — "đóng băng" token thiết kế GA
                 (màu vàng accent, font Newsreader+Instrument Sans, bo góc 6) thành code,
                 để code đúng pixel với prototype, không "vẽ theo cảm tính".
  Networking/    AppEnvironment (URL prod/staging/local), AuthenticationMiddleware
                 (tự gắn "Authorization: Bearer", gặp 401 thì refresh token), APIClientFactory.
  Auth/          TokenStore (actor + Keychain — lưu token an toàn, chống refresh trùng),
                 AuthSession (@Observable — trạng thái đăng nhập điều khiển RootView).
Features/
  Auth/LoginView.swift   form email/mật khẩu → gọi API login thật.
  Home/HomeView.swift    màn "Hôm nay" (hiện gọi /api/auth/me để chứng minh thông luồng).
```

**Nguyên tắc:** SwiftUI + MVVM + `@Observable` (iOS 17+), `URLSession async/await`, **không tự gõ model API** (sinh tự động — mục 4). Token để trong **Keychain** (không phải UserDefaults) — đúng chuẩn bảo mật.

**Vì sao "auth-gated" + actor TokenStore?** App tự quyết hiển thị Login hay nội dung dựa trên có token hay không; `actor` đảm bảo khi nhiều request cùng gặp 401, chỉ refresh **một lần** (không "bão refresh").

---

## 4. Pipeline hợp đồng API (phần "ăn tiền" — codegen tự động)

Đây là điểm hay nhất: **không gõ tay một dòng model/HTTP nào**. Backend tự mô tả chính nó (OpenAPI), app tự sinh code client từ mô tả đó.

```
Backend Spring Boot
  └─ springdoc-openapi  →  /v3/api-docs/ios   (JSON mô tả 150 endpoint student/auth + kiểu DTO)
                                  │  (mình "pin" 1 bản về repo: ios/openapi/openapi.json)
                                  ▼
  swift-openapi-generator (chạy như BUILD PLUGIN của Xcode khi build)
                                  │  đọc openapi.json → sinh:
                                  ▼
  Client (các hàm như client.login(), client.me2()) + Types (struct AuthResponse, …)
                                  │
                                  ▼
  App gọi client.login(...) → nhận struct AuthResponse có kiểu (không phải "dict mờ")
```

**Lợi ích:** mỗi khi backend đổi API, build lại → code client tự cập nhật; CI bắt được "lệch hợp đồng" (drift). Không lo gõ sai tên field.

### 🔑 Phát hiện quan trọng khi build (đã sửa **và đã áp dụng**)
Lúc build thật, lộ ra: **springdoc khai báo kiểu nội dung trả về là `*/*`** (mặc định cho controller không ghi `produces`). Hệ quả: bộ sinh code coi **mọi** response là "byte thô" (`HTTPBody`) thay vì struct có kiểu → **mất hết typing** dù schema đã đúng.
→ Đã sửa ở **PR #127** bằng 1 dòng cấu hình: `springdoc.default-produces-media-type: application/json` (commit `f4f362a8`). **Đã pin lại spec** (`ios/openapi/openapi.json`, nay **150 path**, response `application/json`) và **đổi cả 2 chỗ (Login, Home) sang body có kiểu `try ok.body.json`** — bỏ hết giải mã thủ công. Build lại **xanh** với spec mới. *Đây là ví dụ điển hình "build mới phát hiện được lỗi hợp đồng".*

---

## 5. Pipeline build & deploy (và mình dừng ở đâu)

iOS không commit file project `.xcodeproj` (dễ xung đột). Dùng **XcodeGen**: mô tả project bằng `project.yml` → sinh ra `.xcodeproj`.

```
project.yml ──(xcodegen generate)──► DeutschFlow.xcodeproj
                                         │
        ┌────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                  ▼
  Debug build (Simulator)          Release ARCHIVE (máy iOS)          [Ký số + Upload]
  xcodebuild ... build             xcodebuild ... archive             ── CỔNG APPLE ──
  ✅ BUILD SUCCEEDED               ✅ ARCHIVE SUCCEEDED               ⛔ DỪNG Ở ĐÂY
  (đã verify)                      → DeutschFlow.app (.xcarchive)     (cần Apple Dev acct)
```

- **"Build sản phẩm để deploy"** = tạo `.xcarchive` (gói Release cho máy thật). **Đã đạt** (`ARCHIVE SUCCEEDED`, bundle `com.deutschflow.app`, iOS 17+).
- Mình build **không ký** (`CODE_SIGNING_ALLOWED=NO`) vì chưa có chứng chỉ Apple. Đây đúng là "tới bước build để deploy thì dừng".
- **Vượt cổng này cần:** tài khoản Apple Developer ($99/năm) → tạo signing certificate + provisioning profile → `xcodebuild -exportArchive` ra `.ipa` đã ký → upload TestFlight/App Store. **Toàn bộ bước này AI/máy không tự làm được** (cần đăng nhập Apple ID của bạn + thẩm định).

### Lệnh để build lại / verify (trên máy Mac có Xcode)
```bash
brew install xcodegen                                   # 1 lần
curl -s <backend>/v3/api-docs/ios -o ios/openapi/openapi.json   # pin spec (backend chạy profile local hoặc token ADMIN)
cd ios && xcodegen generate
# build chạy thử trên simulator:
xcodebuild -project DeutschFlow.xcodeproj -scheme DeutschFlow \
  -destination 'platform=iOS Simulator,name=iPhone 16' -skipPackagePluginValidation build
# build sản phẩm để deploy (archive) — bản chưa ký:
xcodebuild -project DeutschFlow.xcodeproj -scheme DeutschFlow -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/DeutschFlow.xcarchive \
  -skipPackagePluginValidation CODE_SIGNING_ALLOWED=NO archive
```

---

## 5b. 📱 Chạy thử ra máy thật (làm trên Mac có Xcode 16)

> Mục tiêu: cắm iPhone vào Mac → bấm Run → app chạy trên máy. **Apple ID miễn phí là đủ** để chạy thử trên máy của chính bạn (chưa cần $99 — cái đó chỉ để TestFlight/App Store).

**Bước 1 — chuẩn bị (1 lần):**
```bash
brew install xcodegen          # nếu chưa có
cd ios && xcodegen generate    # sinh DeutschFlow.xcodeproj từ project.yml
open DeutschFlow.xcodeproj      # mở bằng Xcode
```
Spec API đã **pin sẵn** trong repo (`ios/openapi/openapi.json`) → **không cần backend chạy** để build.

**Bước 2 — chọn Team ký số (trong Xcode):**
1. Cây trái chọn project **DeutschFlow** → target **DeutschFlow** → tab **Signing & Capabilities**.
2. Tích **Automatically manage signing**.
3. Ở ô **Team**, chọn Apple ID của bạn (bấm *Add an Account…* nếu chưa có — đăng nhập Apple ID thường, miễn phí).
4. Nếu báo *"bundle identifier is not available"* (vì `com.deutschflow.app` đã đăng ký): đổi **Bundle Identifier** thành cái riêng, ví dụ `com.<tên-bạn>.deutschflow`.

**Bước 3 — chạy:**
1. Cắm iPhone bằng cáp → trên iPhone bấm **Trust** máy Mac.
2. Trên thanh trên cùng Xcode, đổi đích chạy thành **iPhone của bạn** (thay cho simulator).
3. Bấm **▶ Run** (`Cmd+R`).
4. Lần đầu iPhone chặn "Untrusted Developer": vào **Settings → General → VPN & Device Management → [Apple ID của bạn] → Trust**, rồi mở lại app.

**App nối backend nào?** Mặc định **production** (`https://api.mydeutschflow.com` — xem `AppEnvironment.current`). Cứ đăng nhập tài khoản thật → màn "Hôm nay" gọi `/api/auth/me`. (Trỏ backend khác: sửa `AppEnvironment.current` sang `.local`/`.staging`.)

**Lưu ý quan trọng:**
- **App này đang ở Phase 0–1:** vào app có luồng **đăng nhập thật** + tab "Hôm nay" (nút gọi `/api/auth/me` chứng minh thông backend). Các tab khác còn là khung (placeholder) — sẽ làm ở Phase 1–4.
- **Free provisioning:** app ký bằng Apple ID **miễn phí** chỉ chạy được **7 ngày** rồi hết hạn → bấm Run lại để gia hạn. Có $99 thì hết giới hạn.
- **Caveat tên hàm sinh tự động:** bộ sinh code đặt tên hàm theo path; nhiều path cùng kết thúc `/me` (auth/me, plan/me, profile/me…) nên thêm hậu tố số (`me`, `me2`…) **có thể đổi khi spec thêm path**. Hiện `GET /api/auth/me` = `client.me2()` (đã ghi chú ngay trong `HomeView.swift`). Muốn tên **ổn định** thì backend thêm `operationId` cho từng endpoint (khuyến nghị, không bắt buộc để build).

---

## 6. Đã làm gì (đều đã verify bằng `xcodebuild`)

| Mốc | Nội dung | Bằng chứng | Commit |
|---|---|---|---|
| Phase 0 scaffold | project.yml, DesignSystem, Networking/Auth, khung 5 tab | xcodegen generate ok | `281a05c4` |
| Phase 0 codegen | pin spec 143 path + sinh client; sửa lỗi plugin "target membership" | **BUILD SUCCEEDED** | `1a3b43c6` |
| Phase 0 Hello API | `HomeView` gọi `client.me1()` → /api/auth/me | **BUILD SUCCEEDED** | `79331d73` |
| Phase 1 Login | form thật → `client.login()` → lưu token → vào app | **BUILD SUCCEEDED** | `2f828982` |
| Typed `.json` | pin lại spec 150-path + Login/Home dùng `try ok.body.json` (bỏ giải mã thủ công); `me1`→`me2` | **BUILD SUCCEEDED** | (commit này) |
| Signing cho device | `CODE_SIGN_STYLE: Automatic` + hướng dẫn chạy ra máy (§5b) | — | (commit này) |
| **Deploy-build** | **Release archive (chưa ký) cho máy iOS** | **ARCHIVE SUCCEEDED** | (artifact, chưa commit) |
| Backend fix | spec `*/*` → `application/json` cho codegen có kiểu | trên PR #127 | `f4f362a8` |

Nhánh: `feat/native-ios-phase0` (đã push). Backend typed-DTO: `feat/native-openapi-typing` / **PR #127** (đang được hoàn tất song song).

---

## 7. Còn lại + các cổng chặn

**Code mình làm tiếp được (tự động, có build verify):**
- Phase 1 nốt: Đăng ký, Quên mật khẩu, Onboarding, màn Hôm nay thật (`/api/today` + `/api/student` + `/api/progress` + `/api/xp`).
- Phase 2–4: SRS + Từ vựng, Luyện nói (mic/audio), Cây học tập (`/api/roadmap/tree`), Thi (Mock Exam).
- ✅ Spec `application/json` **đã pin** → các màn mới cứ dùng body **có kiểu** (`try ok.body.json`), không còn giải mã thủ công.

**⛔ Cổng Apple/người — KHÔNG tự động được (đây là lý do dừng):**
1. Đăng ký **Apple Developer Program** ($99/năm) + tạo **certificate/provisioning** (ký số).
2. **App Store Connect**: tạo app record, 4 sản phẩm IAP (`com.deutschflow.app.{pro,ultra}.{monthly,yearly}`), metadata, screenshots mọi kích cỡ, App Privacy labels, tài khoản demo cho reviewer.
3. **StoreKit sandbox** test mua hàng (Phase 5) + test trên **máy thật**.
4. **Nộp App Store** + xử lý phản hồi review.
5. Chạy app thật trên simulator/máy (dán token → thấy user) — cần thao tác UI hoặc XCUITest.

**Việc dọn dẹp git (nhờ bạn):** PR #127 đang có worktree riêng; ngoài ra working tree main có vài thay đổi backend (AppleIap/Tts) **chưa commit, không phải của mình** — nên commit vào nhánh typing hoặc bỏ.

---

## 8. Phân tích & khuyến nghị

**Rủi ro lớn nhất tới App Store (không phải kỹ thuật build):**
- **IAP (Guideline 3.1.1)** 🔴: nội dung số phải mua qua StoreKit, **cấm** mở cổng web (Stripe/MoMo) trong app. Backend IAP **đã làm thật** (StoreKit 2 verify, 20 test) → phần còn lại là **client StoreKit (Phase 5) + cấu hình ASC**. App phải tuyệt đối không lộ màn thanh toán web.
- **Account deletion (5.1.1v)** 🟡: backend `DELETE /api/profile/me` đã có → cần **UI xoá tài khoản** (đã có stub ở tab Hồ sơ).
- **Sign in with Apple (4.8)** 🟢: **không cần** vì app chỉ email/mật khẩu, không có social login.
- **Privacy** 🟡: đã nhúng `NSMicrophoneUsageDescription`; cần quyết ATT (do dùng PostHog) + Privacy Policy URL + khai App Privacy.

**Quyết định kiến trúc (đã chốt, tốt):** SwiftUI + codegen từ OpenAPI = ít gõ tay, chống lệch hợp đồng; Keychain cho token; tách DesignSystem theo token GA; iOS 17 tối thiểu.

**Đánh giá tiến độ:** nền móng (cái khó nhất về kỹ thuật: scaffold + codegen + build + archive) **đã thông**. Từ đây về sau, viết thêm màn là việc "nhân bản theo mẫu" + cổng Apple. Tức là **đường đã mở**, phần còn lại là khối lượng + thủ tục Apple.

**Khuyến nghị thứ tự:**
1. ✅ **Đã pin spec có kiểu + đổi Login/Home sang `try ok.body.json`** (build xanh). Còn lại: **merge PR #127 → `main`** để lần pin spec sau lấy bản typed chính thức.
2. **Bạn build thử ra máy** theo **§5b** (Apple ID miễn phí là chạy được).
3. Mình build tiếp Phase 1–4 (các màn) — tự động + verify.
4. **Bạn** mở Apple Developer + App Store Connect (cổng A/E trong `plans/2026-06-20-appstore-release-plan.md`) → mở khoá Phase 5 (IAP) + nộp.
4. Khi có chứng chỉ: ký + upload TestFlight → external beta → submit → phased release → khai tử Expo.

> Tham chiếu chi tiết App Store: `plans/2026-06-20-appstore-release-plan.md`. Tham chiếu hợp đồng API: `plans/2026-06-20-openapi-coverage-audit.md` + `plans/2026-06-20-native-handoff-phase0.md`.
