# DeutschFlow — KẾ HOẠCH THỰC THI 2 mốc phát hành (Web v2 → Native iOS)

> **Vai trò:** Delivery lead · **Ngày:** 2026-06-21 (đặt tên theo cohort `2026-06-20-*`)
> **Đầu vào:** dựa trên `plans/2026-06-20-v2-cutover-and-deploy-readiness.md` (audit) + xác minh code/git ở phiên này.
> **Nguyên tắc:** trung thực với trạng thái thật; chỗ chưa chắc ghi `cần xác minh`, **không bịa**.

### Quy ước
- **Track:** `W#` = Web-FE · `M#` = Native iOS (mobile) · `B#` = Backend chung.
- **Mốc/Milestone:** **Mốc 0–7** (= M0–M7 trong brief). *(Dùng "Mốc x" cho milestone, "M x" cho task iOS để khỏi lẫn.)*
- **Ước lượng:** S (≤1 ngày) · M (2–4 ngày) · L (≥1 tuần).
- **Ưu tiên:** 🔴 critical-path · 🟡 song song · 🟢 nice-to-have/hoãn được.
- **Quyết định đã CHỐT (ràng buộc):** (1) Web v2 trước, iOS sau. (2) Web cutover đủ 4 vai trò gồm B2B. (3) iOS payments = StoreKit IAP (StoreKit 2 + verify receipt, tái dùng provisioning sub; **không cổng web trong app**). (4) iOS v1 = MVP gọn.

---

## ⏱️ Nhật ký thực thi (cập nhật realtime)

> **Quy tắc tự động:** chỉ tự làm task **thuần code/đọc, không phụ thuộc ngoài**; task cần hành động ngoài (Apple enroll, deploy prod qua SSH đang bị chặn, quyết định PM) để lại cho người dùng — xem mục 7 + ghi chú cuối.

| Ngày | Task | Kết quả |
|---|---|---|
| 2026-06-21 | **W1.1** route-in cờ `galerie-v2` | ✅ **Code xong** `frontend/src/app/login/page.tsx`: `identify` trước → `resolveGalerieV2()` bounded 700ms (fallback **legacy** an toàn, không hang) → `homeFor(role,v2)`; **native loại trừ**; redirect-map khớp middleware (`/v2/admin/users` · `/v2/teacher` · `/v2/student/dashboard`). **tsc + eslint sạch.** ⏳ Verify runtime 4 vai cần bật flag PostHog (ở W2.2/W2.3). ⚠️ Phạm vi = redirect **sau login**; user đã đăng nhập + bookmark legacy **chưa** bị kéo vào v2 → follow-up (V2RouteIn trên legacy home / edge Phase 3). |
| 2026-06-21 | **B0.2** trạng thái #127/#128 | ✅ **Đã xác minh.** #128 **MERGED→main** (`467403b6`): phần lớn ios typed contract + **một phần** AppleIap. #127 **OPEN nhưng base=`feat/student-coin-currency`** (KHÔNG phải main) → không tự về main. Khối uncommitted (AppleIap R5 đầy đủ + Tts + DTO mới) = **increment CHƯA có ở main** (main `AppleActivationResult`×1/`Tts`×0 vs working ×6/×3). ⇒ **B0.1 phải commit khối này lên nhánh off-main + PR mới** (không chờ #127). Khi về main ⇒ phần IAP/Tts của **B3.3/B3.4 hoàn tất** (DTO MVP khác + nhóm `ios` đã ở main qua #128). |
| 2026-06-21 | **W0.1 + B0.1** git hygiene | ✅ Tách nhánh sạch off main: `feat/web-v2-cutover` = `ec608eb3`(docs)+`3e1c6c09`(W1.1); `feat/native-iap-tts-typed` = `d5a9c04c`(IAP/Tts R5). `feat/native-ios-phase0` nguyên vẹn (`df1aab8f`). 2 stash sẵn có = của branch khác (onboarding/phase1) — KHÔNG đụng. ⏳ chưa push/PR. |
| 2026-06-21 | **B1.1/B1.2** org-detail BE | ✅ `GET /api/org/classes/{id}` (`OrgClassDetailDto`: tên GV + roster + `skill_*`) & `GET /api/org/students/{id}` (`OrgStudentDetailDto`: membership + lớp lọc theo org). Org-admin gated + **IDOR-safe (404 nếu khác org)**. 4 DTO + service + controller + `OrgServiceDetailTest` (5 case). **Maven compile + test XANH.** Commit `d7bb94ca` trên `feat/web-v2-cutover`. ⏳ còn FE 2 màn (W1.4). |
| 2026-06-21 | **PR #129 + #130** | ✅ Push + mở PR: [#129](https://github.com/CuDinh03/DeutschFlow/pull/129) IAP/Tts (ready) · [#130](https://github.com/CuDinh03/DeutschFlow/pull/130) web-v2-cutover (draft WIP). **CI cả 2 PR xanh** (Backend+Frontend+Security). |
| 2026-06-21 | **B0.3** CI | ✅ **Billing Actions HẾT lỗi** (run 06-21 đều success). ⚠️ `main` IT (Testcontainers) fail pre-existing → **Deploy-to-EC2 skipped** → deploy thủ công là đường đúng. |
| 2026-06-21 | **B2.1/W2.1/W2.2 + B6.1** | ✅ Viết **runbook turnkey** `plans/2026-06-20-deploy-ops-runbook.md` (verified): deploy prod (§1) + env Amplify (§2) + cờ PostHog (§3) + thứ tự go-live (§4) + Apple-register-later (§5). ⏸ **3 việc hạ tầng chờ BẠN chạy** (ssh chặn với tôi / Amplify+PostHog dashboard). |
| 2026-06-21 | **B2.1 DEPLOY** ✅ | Bạn mở SSH → tôi chạy `deploy-backend.sh` → **prod UP** `{"status":"UP"}` trên `467403b6` (tree V219/V220 + curriculum + audit). Blue-green 258s (GREEN healthy 50s, DB warm-up 5/5, promote 8080). exit 1 = cleanup-prompt cosmetic. Verify độc lập `curl .../actuator/health = UP`. (org-detail B1.1/B1.2 lên prod khi #130 merge.) |
| 2026-06-21 | **W1.4** org-detail FE ✅ | 2 màn teal mirror DETAIL setter: `/v2/org/classes/[id]` (roster + skill_*) + `/v2/org/students/[id]` (membership + lớp); `orgApi` + types; wire row→detail. **tsc + eslint sạch.** ⏳ visual QA ở W1.6. |

---

## 1. Tóm tắt 2 mốc + ranh giới MVP

### Release 1 — WEB v2 go-live (Mốc 0 → 2)
Đưa UI 2.0 "Galerie" thành bản web chính cho **đủ 4 vai trò: học viên · giáo viên · admin · quản lý trung tâm (B2B)**. Hiện code ~89% phạm vi manifest đã LOCK nhưng **0% user đang thấy** vì **chưa có cơ chế đẩy user vào `/v2`** (xem audit §2.5). Đây là việc #1.

### Release 2 — NATIVE iOS MVP (Mốc 3 → 7)
App Swift native, tái dùng backend qua OpenAPI codegen. Hiện Phase 0 xong + Phase 1 mới có Login. Phát hành **bản MVP gọn** lên App Store.

### Ranh giới MVP iOS v1 (IN / OUT) — CHỐT

| Trong v1 (IN) | Hoãn bản sau (OUT) |
|---|---|
| ✅ Auth (login/register/forgot) + Onboarding tối giản | ❌ Thi / MockExam (UI + `MockExamController`) |
| ✅ "Hôm nay" (Today/Dashboard) | ❌ Luyện nói AI (`AISpeaking`), Ngữ pháp AI (`AIGrammar`), Từ vựng AI (`AIVocabulary`) |
| ✅ Cây học tập (RoadmapTree) | ❌ Chứng chỉ, Assessment/Placement nâng cao |
| ✅ Từ vựng + SRS (+offline) | ❌ Speaking history, Weekly speaking |
| ✅ Paywall + StoreKit IAP (verify receipt) | ❌ Push nâng cao (bật sau khi `ApnsPushSenderService` xong — không chặn submit) |
| ✅ Hồ sơ + Xoá tài khoản (compliance) | ❌ Messaging, Lớp học/Assignment chi tiết |

> **Lý do ranh giới khớp backend:** controller MVP (Auth/Today/Dashboard/RoadmapTree/Vocabulary/Word/Srs/Profile/AppleIap) **đã sạch kiểu hoặc đã typed** trong `/v3/api-docs/ios`; phần OUT (`MockExam`, `AISpeaking`, `AIGrammar`, `AIVocab`) là nơi tập trung nợ typed-DTO đã được dọn ở PR #127 nhưng **không cần cho v1** (`plans/2026-06-20-openapi-coverage-audit.md`).

### Trạng thái thật đã xác minh (phiên này)
- **Git:** nhánh `feat/native-ios-phase0` = **+7 commit so với `main`, 0 commit sau** (ios Phase 0–1). File `AppleIapController.java`(+54/-…) & `TtsController.java`(+21/-…) **đang sửa, CHƯA commit, và KHÔNG có trong main** (diff vs main = diff working) → **trùng nội dung R5 của PR #127 (OPEN)** ⇒ phải đối chiếu trước khi commit. `cần xác minh` trạng thái merge #127/#128.
- **Backend MVP có sẵn:** `TodayController`, `StudentDashboardController`, `RoadmapTreeController`(typed `TreeDto`), gói `srs/*`, `VocabularyController`/`WordController`, `AppleIapController`+`AppleIapService`, `ProfileController#/me/push-token` (đã có discriminator platform) — **đều tồn tại**.
- **APNs:** chỉ có `ExpoPushSenderService`; **`ApnsPushSenderService` KHÔNG tồn tại** (grep = 0) → M3 là việc thật.
- **OpenAPI:** `OpenApiConfig` có nhóm `w2` + nhóm `ios`; `/v3/api-docs/ios` = 150 path, 0 free-form (P0 + P1 R1–R10 done) — nhưng **R5 (IAP/Tts) nằm ở PR #127 OPEN**, `cần xác minh` đã vào main chưa.

---

## 2. Phạm vi cutover web theo vai trò (route-diff + B2B)

**Đếm route (đã xác minh):** legacy `116` route `page.tsx` (ngoài `/v2`) vs `57` route `/v2`. v2 là bản **gộp + thu hẹp**, không 1:1.

| Vai trò | % manifest đã LOCK | % phủ bề mặt legacy | Màn còn legacy / chưa v2 (phải xử lý ở Mốc 1) |
|---|---|---|---|
| Học viên | ~71% | ~45% | game, leaderboard, weekly-speaking, assessment, interviews, certificates, lesson-player, practice (đa số ⏸/launcher) |
| Giáo viên | ~85% | ~80% | `teacher/media`, `teacher/reports`, student-detail, schedule (⏸ no-BE) |
| **Quản lý TT (B2B)** | ~70% (OWNER/ADMIN) | ~86% | **class-detail, student-detail (cần endpoint)**; settings, schedule, roles-editor (⏸) |
| Admin | ~100% *manifest* | **~48%** | analytics, classes, reports×4, settings, marketing, mock-exam-packs, training-dataset, weekly-speaking — `cần xác minh` cố ý ngoài v2 hay phải migrate |
| Auth/Public | ~75% | — | onboarding (⏸→giữ legacy), welcome, messages, LP marketing + token public (giữ legacy) |

### Soi mô hình B2B (xác minh code)
- **Roles trong org (`OrgMember.role`):** `OWNER · ADMIN · TEACHER · STUDENT`. Gating: `OrgGuard.assertMember`(cả 4) · `assertOrgAdmin`(OWNER/ADMIN) · `assertOrgFinance`(OWNER/ADMIN/ACCOUNTANT — **ACCOUNTANT chưa có trong enum**, `cần xác minh`). Middleware chặn `/org/*` & `/v2/org/*` theo `orgRole ∈ {OWNER,ADMIN}`.
- **Phủ v2 theo actor B2B:**
  - **OWNER** → `/v2/org/*` + `/v2/teacher/*` ✅ đủ.
  - **ADMIN** → `/v2/org/*` (finance/roles gating ở controller `cần xác minh`) + `/v2/teacher/*` ✅.
  - **org TEACHER** → `/v2/teacher/*` ✅ **nhưng KHÔNG thấy bối cảnh org** (bị bounce khỏi `/v2/org`) → `cần xác minh` có cần view org read-only không.
  - **org STUDENT** → `/v2/student/*` ✅ đủ.
- **v2 org đã có (10):** dashboard, invitations, teachers, students, classes, billing, analytics(🟠 no time-series), finance(🟠 reskin billing), roles(🟠 read-only), root.
- **B2B còn THIẾU v2 (chặn drill-down):** `org-class-detail` + `org-student-detail` (**cần endpoint** `GET /api/org/classes/{id}`, `GET /api/org/students/{id}`); **hoãn được:** settings, schedule, roles-editor, analytics-trends (`docs/UI_2.0_BACKEND_SPEC.md`).

---

## 3. Bảng task theo Mốc

### Mốc 0 — Checkpoint (commit/branch/CI) · Gate: cây sạch, CI xanh, chiến lược nhánh rõ

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| B0.1 | Đối chiếu + commit khối uncommitted `AppleIapController`/`TtsController` + DTO/test mới; so với PR #127 (R5) tránh trùng/xung đột | BE | — | M | 🔴 | Cây làm việc sạch; test BE xanh; xác nhận không nhân đôi #127; quyết đưa vào main qua PR nào |
| B0.2 | Xác minh trạng thái merge PR #127 (R5–R10 IAP/Tts/AI) vs #128; chốt nhánh nào chứa typed-contract cho prod | BE | B0.1 | S | 🟡 | Văn bản 1 đoạn: cái gì đã ở main, cái gì còn ở #127 |
| W0.1 | Chiến lược nhánh: tách `feat/web-v2-cutover` **từ main** (độc lập nhánh ios); ios tiếp tục ở `feat/native-ios-phase0` | tech-lead | — | S | 🔴 | Nhánh web tạo từ main; ghi rõ ranh giới 2 nhánh |
| B0.3 | Xác minh CI xanh; kiểm tra lại sự cố GitHub Actions billing (memory) còn không | DevOps | — | S | 🟡 | CI chạy được hoặc nêu rõ blocker billing `cần xác minh` |

### Mốc 1 — Đóng parity-gap web v2 cho MỌI vai trò · Gate: 4 vai trò có surface dùng được + route-in chạy + 0 bug reskin critical

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| W1.1 | **Xây cơ chế "route-in"** cờ `galerie-v2`: sau login (`login/page.tsx`) nếu `useGalerieV2()===true` → đẩy `v2RoleHome(role)`; chốt redirect-map (ADMIN→/v2/admin/users, org OWNER→/v2/org, TEACHER→/v2/teacher, STUDENT→/v2/student/dashboard) | web-FE | W0.1 | M | 🔴 | User bật cờ login → vào /v2 đúng vai; user tắt cờ → ở legacy; verify 4 vai |
| W1.2 | Đóng punch-list P0/P1 fidelity (`CUTOVER_READINESS_AUDIT §7`): `GaPageHdr accentColor`, dedup hex→token (VIOLET×13/#2F6FC9×39/TEAL×6), a11y focus-ring + `DataTable` keyboard/`aria-sort`, fix 404 `companions/hannie.png` | web-FE | W0.1 | M | 🟡 | `next build` 0 warning cây /v2; 10 mục §7 đóng |
| W1.3 | Đóng top QA_GAPS buildable: admin-orgs financial modal, `GaOrgEmpty`, personas A/B, teacher dashboard "cần chấm" dạng list, grading waveform, admin-vocab Duyệt/Từ chối, grade-image zoom | web-FE + design | — | M | 🟡 | Mỗi gap: build hoặc defer-có-ký |
| W1.4 | **B2B drill-down:** wire `org-class-detail` + `org-student-detail` vào v2 khi có endpoint (B1.1/B1.2); nếu hoãn → stub graceful + ghi deferred | web-FE | B1.1, B1.2 | M | 🟡 | OWNER/ADMIN hoàn tất luồng lõi; 2 màn detail build hoặc deferred-có-ký |
| W1.5 | **Quyết B2B visibility:** org TEACHER có cần view org read-only? (hiện bị bounce) | PM/design | — | S | 🟡 | Quyết định ghi lại; nếu cần → tạo task build |
| W1.6 | Smoke-test runtime 57 màn /v2 (0 console error/warning) đủ 4 vai trò trên staging | QA | W1.1 | M | 🟡 | Báo cáo pass theo vai |
| W1.7 | **Quyết 12 màn admin legacy** (analytics/classes/reports×4/settings/marketing/mock-exam-packs/training-dataset/weekly-speaking): cố ý ngoài v2 (vẫn vào qua `/admin/*` legacy) hay phải migrate? | PM/tech-lead | — | S | 🔴 | Quyết định/từng màn; nếu "giữ legacy" → ghi rõ admin dùng SONG SONG 2 surface sau cutover |
| W1.8 | **Quyết launcher legacy** (speaking/exam/mock-exam trỏ engine legacy) chấp nhận cho GA? (nếu có → legacy speaking/exam phải sống tiếp) | PM/tech-lead | — | S | 🔴 | Quyết định ghi lại |
| B1.1 | `GET /api/org/classes/{id}` → `OrgClassDetailDto` (giáo viên, sĩ số, roster) | BE | — | M | 🟡 | Endpoint + DTO + test; gắn vào W1.4 (hoãn được nếu chốt defer) |
| B1.2 | `GET /api/org/students/{id}` → `OrgStudentDetailDto` (xp, level, CEFR, lớp, lastActive) | BE | — | M | 🟡 | Endpoint + DTO + test (hoãn được nếu chốt defer) |

### Mốc 2 — Cutover web (go-live #1) · Gate: web prod xanh mọi vai trò

**2a — Bật v2 cho user (đây là "go-live #1" thực sự, legacy làm fallback):**

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| B2.1 | **Deploy backend prod** (`deploy-backend.sh`): migration `V219/V220` + module `curriculum` + `/api/roadmap/tree*` + `GET /api/admin/audit` (+ B1.1/B1.2 nếu làm). `cần xác minh` các thứ này đã ở main (PR #123/#128) | BE/DevOps | M0 | M | 🔴 | Health UP; migration applied; endpoint 200 trên prod |
| W2.1 | Đặt env Amplify: `JWT_RSA_PUBLIC_KEY` **hoặc** `JWT_SECRET` (guard `amplify.yml:26-30`), `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_CLOUDFRONT_URL`, `NEXT_PUBLIC_POSTHOG_KEY/HOST` | DevOps | — | S | 🔴 | Build Amplify qua guard; prod nhận đúng env |
| W2.2 | Cấu hình PostHog cờ `galerie-v2` (+`student-coins-v1` nếu liên quan): bật nội bộ trước | web-FE/PM | W1.1 | S | 🔴 | Cờ tồn tại; cohort nội bộ set |
| W2.3 | Chạy rollout theo `CUTOVER_RUNBOOK`: nội bộ → 10% → 50% → 100% (legacy fallback); theo dõi error-rate/CWV/ticket mỗi nấc | tech-lead | B2.1,W1.1,W1.6,W2.1,W2.2 | L | 🔴 | Mỗi nấc đạt tiêu chí; 100% ổn định ≥ vài ngày |
| W2.4 | Diễn tập rollback: test `GALERIE_V2_DISABLED=true` ở staging 1 lần | DevOps | — | S | 🟡 | Kill-switch bounce /v2→legacy verified |

**2b — Cố định cutover (CHỈ sau khi 2a ổn định 100% — destructive, cần duyệt riêng):**

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| W2.5 | Swap route `/v2`→canonical; thêm redirect bookmark cũ (legacy→canonical/v2) | web-FE | W2.3 (100% ổn) | M | 🟢 | Canonical phục vụ v2; bookmark cũ redirect đúng |
| W2.6 | Gỡ UI cũ **trừ phần phải giữ** (launcher speaking/exam, LP marketing, token public, 12 màn admin legacy nếu W1.7 chốt giữ); gỡ cờ + `V2Gate` + kill-switch | web-FE | W2.5 | M | 🟢 | Legacy đã port bị xoá; phần giữ lại documented; build xanh |

> **Lưu ý trung thực:** brief gộp "swap/redirect/gỡ UI cũ" vào go-live #1; runbook + audit khuyến nghị làm **sau** khi 100% ổn (Phase D). Vì vậy tách 2a (launch thật) / 2b (cố định). Gate "web prod xanh mọi vai trò" áp cho **2a**.

### Mốc 3 — Backend cho mobile MVP · Gate: `/v3/api-docs/ios` typed đủ màn MVP + verify-receipt + APNs deployable

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| B3.1 | **`ApnsPushSenderService`** (HTTP/2 token-based, `.p8`) + định tuyến theo `platform` (ios→APNs, android→Expo legacy) | BE | B6.x(.p8 key) | M | 🔴 | Gửi tới token iOS sandbox OK; routing theo platform test |
| B3.2 | `POST /api/profile/me/push-token` discriminator platform — **ĐÃ CÓ** (`ProfileController:88`) → chỉ verify | BE | — | S | 🟢 | Test ios|android lưu đúng |
| B3.3 | Verify receipt StoreKit — `AppleIapController#/verify` **ĐÃ CÓ**; đảm bảo typed-contract (R5) vào main + deploy | BE | B0.1,B0.2 | S | 🔴 | `/api/payments/apple/verify` ở prod, typed trong `/v3/api-docs/ios` |
| B3.4 | Đảm bảo nhóm `ios` + DTO màn MVP (Auth/Today/RoadmapTree/Vocab/Srs/Profile/AppleIap) đã ở **main**; merge phần IAP/Tts của #127 nếu thiếu | BE | B0.2 | M | 🔴 | `/v3/api-docs/ios` cho path MVP = typed trên main |
| B3.5 | Cấu hình webhook App Store Server Notifications V2 → `<backend>/api/payments/apple/notifications` (handler đã có) | BE/admin | B6.1 | S | 🟡 | ASC trỏ webhook; handler nhận test notification |

### Mốc 4 — Native iOS Phase 0–1 · Gate: slice Auth→Onboarding→Hôm nay chạy thật end-to-end

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| M4.1 | Phase 0 (Xcode+SPM, codegen, Networking, TokenStore+Keychain, DesignSystem) — **ĐÃ XONG** → verify build xanh | iOS | — | S | 🟢 | `xcodebuild` SUCCEEDED (đã đạt) |
| M4.2 | Màn Register + Forgot/Reset password (endpoint thật) | iOS | B3.4 | M | 🔴 | Register→session; forgot→email gửi |
| M4.3 | Onboarding tối giản (quyết: port rút gọn hay đường ngắn nhất tới Today) | iOS/design | — | M | 🔴 | User mới hoàn tất onboarding → vào Today |
| M4.4 | "Hôm nay" wire `/api/today` + `/api/dashboard` dữ liệu thật (bỏ placeholder) | iOS | B3.4 | M | 🔴 | Dữ liệu thật render; pull-to-refresh |
| M4.5 | Tab shell + điều hướng cho MVP (Today · Cây · Từ vựng · Hồ sơ/Paywall) | iOS | — | S | 🟡 | Nav 4 tab chạy |

### Mốc 5 — Native MVP các màn · Gate: màn MVP chạy + sandbox IAP mua + restore verified

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| M5.1 | **Cây học tập (RoadmapTree)**: `GET /api/roadmap/tree` (typed `TreeDto`) + complete node; canvas native | iOS | M4.4 | L | 🔴 | Cây render, trạng thái node, complete cập nhật |
| M5.2 | **Từ vựng + SRS**: list `/api/vocabulary`,`/api/words` + review `/api/srs` (flip flashcard + grade) | iOS | M4.4 | L | 🔴 | Phiên review chạy end-to-end |
| M5.3 | **Offline SRS** (SwiftData queue + sync-back) | iOS | M5.2 | M | 🔴 | Review offline xếp hàng + đồng bộ khi online · *có thể hạ xuống online-only cho v1 nếu chạy gấp — cần quyết* |
| M5.4 | **Paywall + StoreKit 2 client**: `Product.purchase()`→JWS→`POST /verify`→entitlement; restore qua `/sync` | iOS | B3.3, B6.x | L | 🔴 | Sandbox mua kích hoạt entitlement; restore chạy |

### Mốc 6 — App Store compliance · Gate: ASC listing đủ + compliance pass + build ký được

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| B6.1 | **(Ngoài)** Apple Developer Program ($99) + App ID (bật Push + In-App Purchase) + 4 sản phẩm IAP `com.deutschflow.app.{pro,ultra}.{monthly,yearly}` + cert/provisioning | admin | — | M | 🔴 | ASC app record + 4 IAP product + signing sẵn sàng |
| M6.1 | IAP 3.1.1: chỉ đường StoreKit + verify (M5.4); **không có cổng web trong app** | iOS | M5.4 | S | 🔴 | App không có link mua web; chỉ StoreKit |
| M6.2 | Sign in with Apple — **KHÔNG CẦN** (không có social login) → ghi N/A | iOS | — | S | 🟢 | Văn bản N/A (re-check nếu thêm Google sau) |
| M6.3 | UI xoá tài khoản → `DELETE /api/profile/me` (endpoint đã có) | iOS | M4.4 | S | 🔴 | Luồng xoá + confirm + logout |
| M6.4 | Privacy: App Privacy labels (ASC) + quyết **ATT** (PostHog=tracking?) + `NSMicrophoneUsageDescription` (đã khai `project.yml`) + `NSCamera` (`cần xác minh` có dùng) | iOS/admin | — | M | 🔴 | Labels điền; ATT implement-hoặc-khai-none; Info.plist đủ string |
| M6.5 | Icon + launch screen + assets thương hiệu | design/iOS | — | S | 🟡 | Đủ size icon + launch |
| M6.6 | Metadata VI/DE + screenshots (đủ size) + demo account cho reviewer + privacy policy URL | admin/iOS | B6.1 | M | 🟡 | ASC listing đầy đủ |

### Mốc 7 — Phát hành mobile · Gate: live App Store

| ID | Task | Owner | blockedBy | Ước | Ưu tiên | DoD |
|---|---|---|---|---|---|---|
| M7.1 | Quyết **bundle id**: khai tử Expo & tái dùng `com.deutschflow.app`, HAY id mới chạy song song beta | PM/iOS | — | S | 🔴 | Quyết + cấu hình project |
| M7.2 | TestFlight internal (archive + upload) | iOS | Mốc 5, Mốc 6 | M | 🔴 | Internal tester cài được |
| M7.3 | TestFlight external (beta review Apple) | iOS | M7.2 | M | 🟡 | External tester nhận build |
| M7.4 | Fix review feedback → Submit App Review → phased release | iOS/PM | M7.2, B6.1 | M | 🔴 | App được duyệt + live |
| M7.5 | Khai tử Expo + Capacitor (gỡ `mobile/`, nhánh `feat/capacitor-mobile`, Expo push) | mobile/BE | M7.4 | M | 🟡 | Repo dọn; push hoàn toàn qua APNs |

---

## 4. Bảng phụ thuộc chéo (cross-track)

| Phụ thuộc | Track A cần | ← chờ Track B | Ghi chú |
|---|---|---|---|
| Web rollout có nghĩa | W2.3 (rollout) | W1.1 (route-in) | Không có route-in, bật cờ 100% vẫn 0 user vào v2 |
| Màn v2 backed chạy prod | W2.3 | B2.1 (deploy tree/audit) | Tree/audit/org-detail trống nếu BE chưa deploy |
| B2B drill-down | W1.4 | B1.1, B1.2 | Hoãn được nếu chốt defer |
| iOS codegen MVP | M4.2/M4.4/M5.x | B3.4 (ios DTO ở main) | Slice Auth→Today đã sạch sẵn; cần nhóm `ios` ở main |
| iOS Paywall | M5.4 | B3.3 (verify typed+deploy) + B6.1 (IAP products) | StoreKit client cần endpoint verify + product ASC |
| iOS Push (sau) | (post-v1) | B3.1 (`ApnsPushSenderService`) + B6.1 (.p8) | Không chặn submit v1 |
| Khai tử Expo | M7.5 | M7.4 (live) + M7.1 (bundle id) | Tránh trùng bundle id khi còn beta |
| Commit typed-contract | B3.3/B3.4 | B0.1/B0.2 (reconcile #127) | Khối IAP/Tts đang uncommitted, trùng #127 |

---

## 5. CHECKLIST [ ] theo Mốc (copy dùng ngay)

### Mốc 0 — Checkpoint
- [x] B0.1 ✅ Committed trên `feat/native-iap-tts-typed` (`d5a9c04c`) off main; ⏳ chưa push/PR (#127 base=coin → nhánh này là đường về main đúng)
- [x] B0.2 ✅ #128 MERGED→main (phần lớn typed contract); #127 OPEN base=coin (không về main); khối uncommitted = increment IAP/Tts R5 chưa ở main
- [x] W0.1 ✅ `feat/web-v2-cutover` off main (`ec608eb3` docs + `3e1c6c09` W1.1)
- [x] B0.3 ✅ CI billing HẾT lỗi (PR #129/#130 xanh); main IT fail pre-existing → auto-deploy skipped → deploy thủ công

### Mốc 1 — Parity-gap mọi vai trò
- [x] 🔴 W1.1 ✅ Code xong (`login/page.tsx`, tsc+eslint sạch); ⏳ verify runtime 4 vai cần flag PostHog (W2.2/2.3)
- [ ] 🟡 W1.2 Punch-list P0/P1 fidelity + fix 404 hannie
- [ ] 🟡 W1.3 Top QA_GAPS buildable
- [x] 🟡 W1.4 ✅ BE (B1.1/B1.2) + FE 2 màn org-detail (tsc+eslint sạch); ⏳ visual QA ở W1.6
- [ ] 🟡 W1.5 Quyết org TEACHER visibility
- [ ] 🟡 W1.6 Smoke-test runtime 57 màn × 4 vai
- [ ] 🔴 W1.7 Quyết 12 màn admin legacy (giữ/migrate)
- [ ] 🔴 W1.8 Quyết launcher legacy speaking/exam cho GA
- [x] 🟡 B1.1 ✅ `GET /api/org/classes/{id}` — compile+test xanh (`d7bb94ca`)
- [x] 🟡 B1.2 ✅ `GET /api/org/students/{id}` — compile+test xanh (`d7bb94ca`)

### Mốc 2 — Cutover web (go-live #1)
- [x] 🔴 B2.1 ✅ DEPLOYED — prod `{"status":"UP"}` trên `467403b6` (tree/audit); blue-green 258s
- [ ] 🔴 W2.1 ⏸ **bạn set** env Amplify — runbook §2 (bảng biến đầy đủ)
- [ ] 🔴 W2.2 ⏸ **bạn cấu hình** cờ PostHog — runbook §3 (⚠️ cần W1.1 ở prod trước)
- [ ] 🔴 W2.3 Rollout nội bộ→10%→50%→100% (runbook §3)
- [ ] 🟡 W2.4 Diễn tập rollback kill-switch (runbook §2)
- [ ] 🟢 W2.5 (sau khi 100% ổn) swap /v2→canonical + redirect bookmark
- [ ] 🟢 W2.6 (sau) gỡ UI legacy trừ phần phải giữ + gỡ cờ/V2Gate/kill-switch

### Mốc 3 — Backend mobile MVP
- [ ] 🔴 B3.1 `ApnsPushSenderService` + routing platform
- [ ] 🟢 B3.2 Verify push-token endpoint (đã có)
- [ ] 🔴 B3.3 Verify receipt typed + deploy
- [ ] 🔴 B3.4 Nhóm `ios` + DTO MVP ở main (merge IAP/Tts #127 nếu thiếu)
- [ ] 🟡 B3.5 Cấu hình webhook ASSN V2

### Mốc 4 — iOS Phase 0–1
- [ ] 🟢 M4.1 Verify Phase 0 build xanh
- [ ] 🔴 M4.2 Register + Forgot/Reset
- [ ] 🔴 M4.3 Onboarding tối giản
- [ ] 🔴 M4.4 "Hôm nay" dữ liệu thật
- [ ] 🟡 M4.5 Tab shell MVP

### Mốc 5 — iOS MVP screens
- [ ] 🔴 M5.1 Cây học tập (RoadmapTree)
- [ ] 🔴 M5.2 Từ vựng + SRS
- [ ] 🔴 M5.3 Offline SRS (hoặc hạ online-only — cần quyết)
- [ ] 🔴 M5.4 Paywall + StoreKit IAP + verify/restore

### Mốc 6 — App Store compliance
- [⏸] 🔴 B6.1 HOÃN theo yêu cầu — docs "đăng ký sau" ở `deploy-ops-runbook.md §5`
- [ ] 🔴 M6.1 Chỉ StoreKit, không cổng web
- [ ] 🟢 M6.2 Sign in with Apple = N/A
- [ ] 🔴 M6.3 UI xoá tài khoản (`DELETE /api/profile/me`)
- [ ] 🔴 M6.4 Privacy labels + ATT + mic/camera string
- [ ] 🟡 M6.5 Icon + launch + assets
- [ ] 🟡 M6.6 Metadata VI/DE + screenshots + demo account + privacy URL

### Mốc 7 — Phát hành mobile
- [ ] 🔴 M7.1 Quyết bundle id (Expo vs mới)
- [ ] 🔴 M7.2 TestFlight internal
- [ ] 🟡 M7.3 TestFlight external
- [ ] 🔴 M7.4 Submit App Review → phased release
- [ ] 🟡 M7.5 Khai tử Expo + Capacitor

---

## 6. Critical path + rủi ro

**🔴 Critical path → WEB go-live #1:**
`W0.1 (nhánh) → W1.1 (route-in) → [B2.1 deploy BE ∥ W2.1 env ∥ W2.2 cờ] → W1.6 (smoke 4 vai) → W2.3 (rollout 100%)`. *(W1.2/W1.3 fidelity chạy song song; W2.5/2.6 canonical-swap làm sau khi 100% ổn.)*

**🔴 Critical path → APP STORE:**
`B0.1/B0.2 (commit+reconcile #127) → B3.3/B3.4 (verify typed + ios DTO ở main) → [B6.1 Apple enroll+IAP products — bắt đầu SỚM, lead-time dài] → M4.2–M4.4 (hoàn tất slice) → M5.1/M5.2/M5.4 (Cây+Vocab/SRS+Paywall) → M6.3/M6.4 (xoá TK + privacy) → M7.2 (TestFlight) → M7.4 (submit → phased)`.

**Top rủi ro 🔴:**
1. **Route-in chưa có** → bật cờ mà "không ai thấy v2". (W1.1 là gốc.)
2. **Backend deploy thủ công treo** (`deploy-backend.sh`; sự cố CI billing trong memory) → màn v2 backed trống trên prod. (B2.1.)
3. **Khối IAP/Tts uncommitted trùng PR #127** → xung đột/nhân đôi khi đưa vào main. (B0.1/B0.2.)
4. **B2B per-entity endpoint thiếu** → org admin không drill-down được; phải chốt build (B1.1/B1.2) hay defer (W1.4).
5. **iOS 5/8 phase chưa code**; offline SRS + StoreKit là rủi ro cao nhất; chu kỳ review Apple bất định → mốc App Store khó chắc.
6. **Bundle id `com.deutschflow.app` trùng Expo** → kẹt TestFlight nếu không quyết sớm (M7.1).
7. **Admin chỉ ~48% phủ legacy** → nếu W1.7 chốt "migrate" thì phát sinh khối việc lớn ngoài plan hiện tại (`cần xác minh`).

---

## 7. Bắt đầu từ đâu — 3–5 task khởi động SONG SONG (không phụ thuộc)

| # | Task | Owner | Vì sao khởi động ngay |
|---|---|---|---|
| 1 | **W1.1** Route-in cờ `galerie-v2` | web-FE | Gốc của toàn bộ web go-live; không phụ thuộc gì ngoài W0.1 (tạo nhánh, vài phút) |
| 2 | **B6.1** Apple Developer + App ID + IAP products | admin | Lead-time ngoài tầm kiểm soát (Apple) — bắt đầu sớm nhất có thể; chặn cả Paywall lẫn TestFlight |
| 3 | **B0.1/B0.2** Reconcile + commit khối IAP/Tts (đối chiếu #127) | BE | Dọn nợ uncommitted; mở đường cho B3.3/B3.4 |
| 4 | **W1.2** Punch-list fidelity + fix 404 hannie | web-FE | Song song W1.1, hạ rủi ro QA trước rollout |
| 5 | **Quyết định PM** (W1.7 admin-legacy · W1.8 launcher · W1.5 org-teacher · M5.3 offline-in-v1) | PM/tech-lead | Toàn quyết định, không cần code; mở khoá phạm vi Mốc 1 & 5 |

> **Ghi chú phụ thuộc chéo cho người điều phối:** Web (Mốc 0–2) và iOS (Mốc 3–7) **chạy song song được** ngay từ đầu — chỉ giao nhau ở backend chung: B2.1 (deploy cho web) độc lập với B3.x (typed-contract cho iOS), nhưng cả hai cùng đội BE nên cần xếp thứ tự: **ưu tiên B2.1 trước (web go-live #1), B3.x ngay sau.**
