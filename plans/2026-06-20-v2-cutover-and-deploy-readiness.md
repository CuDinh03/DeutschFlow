# DeutschFlow — Rà soát phát hành: Cutover FE v2 (UI 2.0 "Galerie") & độ sẵn sàng deploy Web + Mobile

> **Vai trò:** Tech lead rà soát phát hành · **Ngày:** 2026-06-21 (đặt tên file theo cohort `2026-06-20-*`)
> **Câu hỏi:** Dự án đã chuyển **TOÀN BỘ** sang FE v2 chưa? Cần nâng/làm gì để deploy (1) Web bản mới và (2) Mobile (native iOS) bản mới?
> **Nguyên tắc:** Mọi kết luận trích từ file/route thật. Thiếu dữ liệu → ghi `chưa rõ — cần kiểm`.

---

## 0. TL;DR — Bảng 3 cột

| Trục | % sẵn sàng | Trạng thái | Blocker lớn nhất |
|---|---|---|---|
| **WEB v2 (Galerie)** | **Scope đã build ~89%** (56/63 màn manifest đã LOCK) · **Live tới user 0%** | 🟡 Code gần xong, **chưa bật cho ai** | **Cơ chế "đẩy user vào /v2" CHƯA tồn tại** — cờ `galerie-v2` chỉ *đá user ra* khi false, không *dẫn user vào*. Login vẫn về legacy. |
| **NATIVE iOS** | **~5–10%** (Phase 0 xong, Phase 1 mới có Login) | 🔴 Mới là bộ khung | 5/8 phase chưa code (SRS, Speaking, Roadmap, **Paywall StoreKit client**, Polish, Release). Cần Apple Developer + App Store Connect. |
| **BACKEND (chung)** | **Hợp đồng API ~sẵn sàng**; **deploy đang treo** | 🟡 Code có, **chưa deploy prod** | `deploy-backend.sh` thủ công chưa chạy: migration tree V219/V220 + module `curriculum` + endpoint `/api/roadmap/tree` + `GET /api/admin/audit` chưa lên prod. |

**Một câu kết:** Web v2 **không phải** đã "chuyển toàn bộ" — nó là bản **reskin lại phần lõi đã thu hẹp phạm vi** (57 màn / 116 route legacy), **đã khoá ~89% phạm vi đó** nhưng **0% user đang thấy** và **chưa thể xoá legacy**. Native iOS mới ở vạch xuất phát. Hai lộ trình deploy **tách biệt**: Web go-live trước (vài ngày–1 tuần nếu chỉ bật cờ + vá route-in), Mobile sau (ước tính 6–9 tuần).

---

## 1. Nguồn sự thật đã đọc (Bước 1)

**Docs UI 2.0 (`docs/`):** `UI_2.0_CONTROL.md`, `UI_2.0_CUTOVER_READINESS_AUDIT_2026-06-18.md`, `UI_2.0_FIDELITY_AUDIT_2026-06-18.md`, `UI_2.0_SCREEN_CHECKLIST.md`, `UI_2.0_MIGRATION_MAP.md`, `UI_2.0_CUTOVER_RUNBOOK.md`, `UI_2.0_QA_GAPS.md`, `UI_2.0_QA_SWEEP_2026-06.md`, `UI_2.0_HANDOFF.md`, `UI_2.0_BACKEND_SPEC.md`, `UI_2.0_NEXT_SESSION.md`, `UI_2.0_LEARNING_TREE_DESIGN.md`, `UI_2.0_LEARNING_TREE_UPGRADE.md`, `ROUTING.md`.

**Native (`plans/`):** `2026-06-02-native-ios-migration-plan.md`, `2026-06-02-native-ios-payments-iap-design.md`, `2026-06-20-appstore-release-plan.md`, `2026-06-20-native-handoff-contract.md`, `2026-06-20-native-handoff-phase0.md`, `2026-06-20-openapi-coverage-audit.md`.

**Code (đọc trực tiếp):** `frontend/src/middleware.ts`, `frontend/next.config.mjs`, `frontend/src/app/v2/{V2Gate,layout}.tsx`, `frontend/src/lib/flags.ts`, `frontend/src/app/login/page.tsx`, `amplify.yml`, `ios/` (qua agent), `backend/.../AppleIapController.java` + `TtsController.java`.

**Git:** nhánh `feat/native-ios-phase0`; HEAD `df1aab8f`; thay đổi chưa commit = file backend IAP/TTS + plans native. UI 2.0 đã ở `main` qua **PR #123** (`c4373db8`, 2026-06-18).

**Độ tin cậy:**
- 🟢 **Cao (đọc code):** route count, cơ chế cutover, redirect, build/deploy config.
- 🟡 **Trung bình (đọc docs ngày 2026-06-18):** số màn LOCK, fidelity/QA gaps, backend spec.
- ⚪ **`chưa rõ — cần kiểm`:** đã đánh dấu inline ở từng chỗ.

---

## 2. So khớp route & cơ chế cutover (Bước 2-bis)

### 2.1 Đếm route thật (đọc bằng `find`)

```
frontend/src/app  —  page.tsx KHÔNG thuộc /v2 : 116
frontend/src/app/v2 — page.tsx                 :  57
```

→ Legacy có **116 route**; v2 có **57 route**. **v2 KHÔNG phải bản sao 1:1** — nó **gộp + thu hẹp** bề mặt (nhiều route lẻ legacy được gộp về 1 màn v2; một số bị bỏ; một số chưa có v2).

### 2.2 Phân loại 116 route legacy theo nhóm

| Nhóm legacy | Số route | Có v2 tương ứng (✅) | Legacy-only / chưa v2 (❌) | Cố ý giữ legacy / launcher / gộp (✂️/⏸) |
|---|---|---|---|---|
| Admin | 23 | ~11 | ~12 | personas/audit là **mới ở v2** (không có legacy) |
| Teacher | 17 | ~12 | ~3 (`media`, `reports`, `dashboard/[id]/students/[studentId]`) | schedule ⏸ |
| Teacher public (`teachers`, `teachers/[id]`) | 2 | 0 | 2 (marketplace gia sư — chưa v2) | `chưa rõ — cần kiểm` |
| Org | 7 | 6 | 0 | `org/accept` ✂️ (trang public nhận lời mời, giữ legacy) |
| Auth / Public / Marketing | 14 | ~4 (login, register, landing, payment) | — | LP marketing (`giao-vien-mien-phi`, `luyen-thi*`, `news`, `free-grade`), trang token public (`certificate/[token]`, `report/[token]`), `onboarding` ⏸, callback `payment/success` ✂️ |
| Student / Learner (gồm flat `dashboard`,`speaking`,`vocabulary`,`roadmap`,`lesson`,`game`) | 53 | ~20 (gộp) | ~25 (đuôi dài, xem 2.4) | speaking/exam/mock-exam = **launcher trỏ legacy** ✂️; lesson-player/practice/node ⏸ |

> **⚠️ Cảnh báo phương pháp:** v2 đổi namespace (vd legacy `/student/mock-exam` → `/v2/mock-exam`; flat `/speaking` → `/v2/student/speaking`), nên không thể so khớp path thuần. Bảng trên khớp theo **tính năng/persona**, có sai số. Con số "% chính xác tuyệt đối" là không khả thi — dùng 2 thước đo ở 2.3.

### 2.3 "% cutover thật" — 2 thước đo (đừng lẫn lộn)

| Thước đo | Giá trị | Ý nghĩa |
|---|---|---|
| **A. Theo manifest v2 đã định nghĩa** | **~89%** (56/63 màn buildable đã LOCK; `UI_2.0_SCREEN_CHECKLIST.md`) | "Trong phạm vi v2 **tự đặt ra**, đã xây xong gần hết." |
| **B. Theo toàn bộ bề mặt legacy (116 route)** | **~45–50%** route legacy có 1 màn v2 thay thế (`chưa rõ con số chính xác — cần kiểm`) | "Nếu xoá legacy hôm nay, ~một nửa route sẽ mất UI." |
| **C. Tỉ lệ user đang thực sự dùng v2** | **0%** | Xem 2.5 — chưa có cơ chế đẩy user vào /v2. |

→ Phát biểu trung thực: **"Đã chuyển toàn bộ sang v2" = SAI.** Đúng là: **đã reskin xong ~89% phần lõi đã thu hẹp; chưa bật cho user; chưa thể khai tử legacy.**

### 2.4 Route legacy CHƯA có v2 (legacy còn sống) — danh sách cần đối chiếu

**Admin (không có trong manifest v2 — `chưa rõ: cố ý gộp hay bỏ sót`):**
`admin/analytics`, `admin/classes`, `admin/grammar-review`, `admin/marketing`, `admin/mock-exam-packs`, `admin/reports` (+ `/grammar-feedback-coverage`, `/personalization-ruleset`, `/vocabulary-quality`), `admin/settings`, `admin/training-dataset`, `admin/weekly-speaking`. *(MIGRATION_MAP chỉ ghi `quizzes` bị DROP; 12 màn admin này không được liệt kê dropped → cần xác nhận chủ đích.)*

**Teacher:** `teacher/media`, `teacher/reports`, `teacher/dashboard/[id]/students/[studentId]` (student-detail), `teacher/schedule` (⏸ no-BE).

**Teacher public:** `teachers`, `teachers/[id]` (marketplace gia sư công khai).

**Student (đuôi dài):** `student/game` + `game`, `student/beginner`, `student/leaderboard`, `student/weekly-speaking`, `student/assessment`, `student/interviews`, `student/certificates`, `student/exercise-history`, `student/vocab-analytics`, `student/speaking-history`, `student/curriculum`, `student/article-quiz` (✂️ quiz-dropped), `student/errors`, `student/groq-usage` (⏸→`/v2/ai-usage` TODO), `student/learn/node/[nodeId]` + `lesson` + `student/practice*` (⏸ lesson-player/tree).

**Public/Marketing (giữ legacy là hợp lý, nhưng phải biết để KHÔNG xoá):** `giao-vien-mien-phi`, `luyen-thi`, `luyen-thi/[slug]`, `news`, `free-grade`, `certificate/[token]`, `report/[token]`, `onboarding/*`.

### 2.5 🔴 Cơ chế cutover — phát hiện then chốt (đọc code trực tiếp)

**Hiện trạng routing khi user đăng nhập hôm nay:** **về LEGACY**, không phải /v2.

- `frontend/src/app/login/page.tsx:118-125` — sau login: `ADMIN→/admin`, `TEACHER→/teacher`, `STUDENT→/dashboard`. **Không hề kiểm cờ, không trỏ /v2.**
- `frontend/src/middleware.ts:26-30` `roleHome()` (legacy) vs `:34-38` `v2RoleHome()` — nhưng `v2RoleHome` **chỉ dùng bên trong nhánh gate /v2** (`:237,240`), không dùng để dẫn user từ legacy vào v2.
- `frontend/next.config.mjs` — **không có `redirects()`/`rewrites()`** nào. SSR (không `output:export`), `trailingSlash:true`.

**Cờ `galerie-v2` thực chất làm gì (chỉ 1 nửa):**
- `frontend/src/app/v2/V2Gate.tsx:18-30` — khi cờ `=== false`: `router.replace` **đá user RA** legacy. Khi `true`/`undefined`: cho /v2 render. **Không có nhánh nào đẩy user VÀO /v2.**
- `frontend/src/lib/flags.ts:15-17` — helper `useGalerieV2()` tồn tại nhưng **KHÔNG có nơi nào gọi** (grep toàn `src`: 0 caller ngoài chính file).
- `frontend/src/middleware.ts:205-207` — kill-switch `GALERIE_V2_DISABLED=true` → bật là bounce **toàn bộ** /v2 → legacy (rollback tức thì). `:215-244` — edge auth gate cho /v2 (vô danh→`/v2/login`, sai vai→`v2RoleHome`). **Không có nhánh legacy→/v2.**

**Hệ quả (trung thực):** Dù chỉnh PostHog `galerie-v2` lên **100%**, **vẫn KHÔNG có user nào tự vào /v2** — vì login, mọi link điều hướng, landing đều trỏ legacy; cờ chỉ *cho phép*/*đá ra*, không *dẫn vào*. Docs (`UI_2.0_CONTROL.md`, `CUTOVER_RUNBOOK.md`) mô tả cờ như "per-user rollout" nhưng **code mới hiện thực nửa "đá ra"**. → **Phải xây nửa "dẫn vào" trước khi go-live có ý nghĩa.** Đây là **blocker bị docs nói nhẹ đi**.

---

## 3. Đã chuyển hết v2 chưa? — theo Persona × màn (Bước 3)

> Hai cột %: **(A) theo manifest v2** / **(B) phủ bề mặt legacy**. QA-gap trích `FIDELITY_AUDIT`/`QA_GAPS` (2026-06-18).

### 3.1 Student
- **Manifest:** 17/24 màn LOCK (~71%). Daily core xong: dashboard, vocabulary (flashcard SRS), grammar (error-library), lessons, review-queue, mock-exam, exam, achievements, classes(+detail+assignment), progress, tutor, roadmap (cây học tập), speaking (launcher), tuition→payment.
- **Phủ legacy:** thấp (~45%) — đuôi dài chưa v2 (xem 2.4): game, beginner, leaderboard, weekly-speaking, assessment, interviews, certificates, exercise-history, vocab-analytics, speaking-history, curriculum, lesson-player/practice/node (⏸).
- **Parked có chủ đích:** speaking-chat/results, report/student-report, ai-usage, lesson-player (⏸ backend/decision).
- **QA gap:** speaking/exam/mock-exam = **launcher deep-link engine legacy** (quyết định sản phẩm — nếu chấp nhận thì **legacy phải sống tiếp**).
- **Kết:** core hằng ngày OK; **không thể xoá legacy student** vì launcher + đuôi dài.

### 3.2 Teacher
- **Manifest:** 12–13/15 (~85%, −2 quiz đã DROP). Xong: dashboard, classes/[id] (DETAIL), grading (3-cột), sessions (lịch tuần thật), profile, analytics, tools/{grammar,images,materials}, grade-image (OCR thật), tc-checklist, tc-progress.
- **Phủ legacy:** ~80%. Thiếu: `teacher/media`, `teacher/reports`, `student-detail`, `teacher/schedule` (⏸ no-BE).
- **QA gap (buildable):** dashboard "cần chấm" nên là **list theo học viên** (đang là count); grading thiếu **waveform speaking**; materials-ai **generation disabled** (no WS endpoint).
- **Kết:** persona **sẵn sàng nhất** cho cutover.

### 3.3 Org / B2B
- **Manifest:** 9–11/13 (~75%). Xong: org (dashboard), students, teachers, classes, analytics, finance, billing, invitations, roles.
- **Phủ legacy:** ~86% (6/7; `org/accept` giữ legacy có chủ đích).
- **Parked (no per-entity endpoint):** `org-class-detail`, `org-student-detail`, `org-schedule`, `org-settings` (`BACKEND_SPEC` xác nhận endpoint **chưa có**).
- **QA gap:** modal "Xem tài chính" của admin-orgs, `GaOrgEmpty` onboarding state, `TkDonut` (seat-donut) chưa port.
- **Kết:** đủ cho org OWNER/ADMIN ở mức danh sách; thiếu drill-down chi tiết.

### 3.4 Admin
- **Manifest:** 13/13 build (~100% theo manifest) — gồm 2 màn **mới** (`personas`, `audit`).
- **Phủ legacy:** **~48%** — đây là **khoảng hở lớn nhất bị che**: 12 route admin legacy (analytics, classes, grammar-review, marketing, mock-exam-packs, reports×4, settings, training-dataset, weekly-speaking) **không có trong manifest v2** và **không được ghi là dropped**. → `chưa rõ — cần kiểm: cố ý gộp/bỏ hay sót`.
- **Phụ thuộc:** `/v2/admin/audit` cần `GET /api/admin/audit` (backend mới, **chưa deploy prod**); personas save disabled (no POST).
- **Kết:** "admin v2 done" chỉ đúng với **manifest đã thu hẹp**, **không** đúng với toàn bộ admin legacy.

### 3.5 Auth / Public
- **Manifest:** login, register, landing, notifications, profile, payment = LOCK (~75%).
- **Deferred:** `onboarding` (proto 3-bước ≠ funnel 5-bước value-first thật → **giữ legacy** khuyến nghị), `welcome` (help-tour P6), `messages` (no backend).
- **Marketing LP** (`giao-vien-mien-phi`, `luyen-thi*`, `news`, `free-grade`) + token public (`certificate/[token]`, `report/[token]`): **chưa v2, giữ legacy** — phải để sống.

### Tổng hợp % theo persona

| Persona | (A) Manifest đã LOCK | (B) Phủ bề mặt legacy | Còn legacy/chưa v2 đáng chú ý |
|---|---|---|---|
| Student | ~71% | ~45% | game, leaderboard, weekly-speaking, assessment, interviews, certificates, lesson-player, practice |
| Teacher | ~85% | ~80% | media, reports, student-detail, schedule |
| Org | ~75% | ~86% | class-detail, student-detail, schedule, settings (no-BE) |
| Admin | ~100% (manifest) | **~48%** | analytics, classes, reports×4, settings, marketing, mock-exam-packs, training-dataset, weekly-speaking |
| Auth/Public | ~75% | — | onboarding, welcome, messages, toàn bộ LP marketing + token public |

---

## 4. Cần NÂNG/LÀM gì để DEPLOY WEB bản mới (Bước 4)

> FE deploy = **auto qua Amplify** khi merge `main` (`amplify.yml` appRoot `frontend`, artifacts `.next`, có guard JWT). UI 2.0 **đã ở main**. Vấn đề **không phải** "build & ship" mà là **bật cho user + đóng gap + giữ legacy**.

### 4.1 🔴 CHẶN — cơ chế "dẫn user vào v2" (chưa tồn tại)
- [ ] **Xây nửa "route-in" của cờ `galerie-v2`** — Owner: FE. **CHẶN.** Cách tối thiểu: ở `login/page.tsx` (và/hoặc nơi điều hướng sau khi xác thực), nếu `useGalerieV2()===true` → đẩy về `v2RoleHome(role)` thay vì `/admin|/teacher|/dashboard`. (Hiện `useGalerieV2` có sẵn nhưng **0 caller** — `flags.ts:15`.) Cân nhắc thêm redirect legacy-home→/v2-home khi cờ bật.
- [ ] **Quyết kiến trúc gate:** giữ client-side (V2Gate) hay nâng lên **edge middleware** (Phase 3 trong runbook, chưa làm). Edge chắc chắn hơn nhưng cần map cờ ở middleware. — Owner: FE/Tech lead. **CHẶN.**
- [ ] **Đối chiếu redirect-map** (runbook §pre-launch): ADMIN→`/v2/admin/users` (vì `/v2/admin` không có index → tránh 404), org OWNER→`/v2/org`, TEACHER→`/v2/teacher`, STUDENT→`/v2/student/dashboard`. — Owner: FE.

### 4.2 🟡 NÊN đóng trước GA — punch-list P0/P1 fidelity (`CUTOVER_READINESS_AUDIT §7`, ~10 mục, rủi ro thấp)
- [ ] `GaPageHdr` thêm `accentColor?: string` (ảnh hưởng ~6 màn) — nhỏ.
- [ ] Dedup hex hardcode → token: `VIOLET`×13 (teacher), `#2F6FC9`×39, `TEAL`×6 (org) → `var(--ga-*)`.
- [ ] A11y: focus-ring cho `DataTable`/`TkSeg`/`TkTabs`/`TkModal`; `DataTable` keyboard + `aria-sort`; pager `aria-current`.
- [ ] Fix **404 asset** `public/companions/hannie.png` (`personas.ts:7`).
- [ ] `audit` dùng `DataTable` setter; `teacher/sessions` responsive; `teacher/profile` dùng `TkTabs` chung; cleanup dead export/import.

### 4.3 🟡 Quyết định sản phẩm (chốt trước khi bật 100%)
- [ ] **Chấp nhận launcher trỏ legacy** (speaking/exam/mock-exam) cho GA? Nếu CÓ → **legacy speaking/exam BẮT BUỘC sống tiếp** (không xoá). — Owner: PM/Tech lead. **CHẶN cho "Phase D xoá legacy", KHÔNG chặn rollout.**
- [ ] **Onboarding:** giữ legacy funnel (khuyến nghị) hay port? — Owner: PM.
- [ ] **Admin legacy 12 màn (2.4):** xác nhận **cố ý nằm ngoài v2** (user vẫn vào qua legacy `/admin/*`) hay phải migrate. — Owner: PM/Tech lead. **`chưa rõ — cần kiểm`.**
- [ ] **Mobile-web:** shell v2 là **desktop-first, sidebar cố định 248px, KHÔNG có drawer** (`QA_SWEEP §41-46`). Chấp nhận desktop-only cho bản v2 đầu, hay thêm responsive? — Owner: Design/FE.

### 4.4 🟡 Phụ thuộc Backend (xem mục 6) — phải deploy trước/đồng thời
- [ ] **Deploy backend** (`deploy-backend.sh`): migration **V219/V220** + module `curriculum` + `/api/roadmap/tree*` (nếu thiếu → `/v2/student/roadmap` không có dữ liệu cây) + `GET /api/admin/audit` (cho `/v2/admin/audit`). — Owner: Backend/DevOps. **CHẶN các màn backed.**

### 4.5 🟡 Build / Deploy / Vận hành
- [ ] Đặt env Amplify: `JWT_RSA_PUBLIC_KEY` **hoặc** `JWT_SECRET` (guard `amplify.yml:26-30` fail build nếu thiếu), `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_CLOUDFRONT_URL`, `NEXT_PUBLIC_POSTHOG_KEY/HOST`. — Owner: DevOps.
- [ ] Prod **KHÔNG** đặt `GALERIE_V2_DISABLED` (hoặc =false) khi muốn bật; test kill-switch 1 lần ở staging. — Owner: DevOps.
- [ ] **Smoke-test runtime 57 màn** (0 console error/warning) — **CHƯA chạy**; build tĩnh sạch ≠ runtime sạch (`READINESS_AUDIT §6.4`). — Owner: QA. **NÊN trước canary.**
- [ ] PostHog: tạo cờ `galerie-v2` (+ `student-coins-v1` nếu liên quan), bật nội bộ trước.

### 4.6 Critical path go-live Web
1. **(CHẶN)** Vá route-in cờ + chốt redirect-map (4.1).
2. **(CHẶN)** Deploy backend tree/audit (4.4).
3. Đóng punch-list P0/P1 + fix 404 (4.2) → `next build` xanh.
4. Smoke-test runtime 57 màn (4.5).
5. Chốt 3 quyết định sản phẩm (4.3) — ít nhất "giữ legacy".
6. Rollout theo `CUTOVER_RUNBOOK`: **nội bộ → 10% → 50% → 100%**, legacy làm fallback; rollback = `GALERIE_V2_DISABLED=true` hoặc giảm % PostHog.
7. **Phase D (tách riêng, cần duyệt):** flip route /v2→canonical, xoá UI legacy *trừ* các màn launcher/LP/token/admin-legacy còn dùng, gỡ cờ+V2Gate+kill-switch. **Chỉ làm khi ổn định 100% và đã port/đóng hết phần ở 2.4.**

---

## 5. Cần NÂNG/LÀM gì để DEPLOY MOBILE bản mới — Native iOS (Bước 5)

> Nguồn: `plans/2026-06-02-native-ios-migration-plan.md` (Phase 0–7), `appstore-release-plan.md`, code `ios/` + backend. **Native KHÔNG nằm trong cutover web** (UI 2.0 `READINESS_AUDIT §288-296`: native "ngoài phạm vi").

### 5.1 Trạng thái thật vs plan (Phase 0–7)

| Phase | Phạm vi | Thật | Bằng chứng |
|---|---|---|---|
| 0 — Foundation | Xcode+SPM, codegen OpenAPI, Networking/Auth, DesignSystem, CI build | ✅ **XONG** | `ios/project.yml`, `APIClientFactory.swift`, `TokenStore` actor+Keychain, spec `ios/openapi/openapi.json` (150 paths); BUILD SUCCEEDED (`281a05c4`,`1a3b43c6`,`79331d73`) |
| 1 — Slice Auth→Today | Login/Register/Forgot + Onboarding + Home/Today thật | 🟡 **MỘT PHẦN** (chỉ Login) | `LoginView.swift` POST `/api/auth/login` → TokenStore → `HomeView` gọi `/api/auth/me` (`me2()`). Register/forgot/onboarding/Today thật **chưa code** (`2f828982`) |
| 2 — SRS + Vocabulary + offline | Review, từ vựng, offline sync | ❌ **CHƯA** | Không có `Features/Srs`,`Features/Vocabulary`; persistence là stub |
| 3 — Speaking/Audio | Ghi âm, TTS, AI speaking | ❌ **CHƯA** | Không có `Features/Speaking`; chưa wire `AVAudioSession` |
| 4 — Roadmap/Exam/Stats | Cây học, mock exam | ❌ **CHƯA** | Không có view; backend tree có DTO |
| 5 — APNs + Paywall (StoreKit) | Push + IAP client + verify | ❌ **CHƯA (client)** | Không import `StoreKit`, không paywall. **Backend IAP đã xong** (5.2) |
| 6 — Polish | Liquid Glass, a11y, E2E | ❌ **CHƯA** | — |
| 7 — Release | TestFlight→App Store, khai tử Expo | ❌ **CHƯA** | Chưa có cert/ASC/metadata |

**Slice xa nhất thực tế:** Login → tạo session → 5-tab **placeholder**. Ước tính **~5–10% feature-complete**.

### 5.2 Blocker App Store (từng mục)

| Hạng mục (Guideline) | Trạng thái | Ghi chú |
|---|---|---|
| **IAP StoreKit + verify receipt (3.1.1)** | 🟡 **Backend XONG, client CHƯA** | `AppleIapController.java`: `/verify`,`/sync`,`/notifications`(ASSN v2),`/account-token`,`/products`. **Thiếu toàn bộ client StoreKit + paywall UI** + tạo 4 sản phẩm trong ASC. **#1 blocker submit.** |
| **Sign in with Apple (4.8)** | 🟢 **KHÔNG CẦN** | Backend chỉ email/password, **không có social login** → không bắt buộc. (Nếu sau này thêm Google → mới phải có.) |
| **Xoá tài khoản trong app (5.1.1(v))** | 🟡 **Backend XONG, UI CHƯA** | `DELETE /api/profile/me` có sẵn; cần nút + confirm trong Profile. Bắt buộc trước submit. |
| **Privacy: NSMicrophoneUsageDescription** | ✅ Khai trong `project.yml` (+ Speech) | App có luyện nói. |
| **Privacy: ATT (NSUserTrackingUsageDescription)** | 🟡 **Chưa quyết** | Dùng PostHog → quyết PostHog có = "tracking" không; nếu có phải thêm ATT prompt. |
| **Privacy: NSCameraUsageDescription** | ⚪ `chưa rõ — cần kiểm` | Plan nhắc handwriting-OCR upload nhưng native chưa có code camera → xác nhận có dùng không. |
| **App Privacy labels + Privacy Policy URL** | ❌ Chưa | Tác vụ ASC (admin), bắt buộc trước submit. |
| **APNs (.p8 + push token theo platform)** | 🟡 **Endpoint có, sender + client CHƯA** | `POST /api/profile/me/push-token` nhận `platform=ios|android` ✅; nhưng **`ApnsPushSenderService` grep = 0 kết quả** (`chưa rõ — cần kiểm`, có thể vẫn Expo sender). Client chưa đăng ký token. **Không chặn bản đầu** (bật push sau). |

### 5.3 "3 việc backend" của plan (§9) + thay đổi chưa commit

| Việc | Trạng thái |
|---|---|
| (1) `POST /profile/me/push-token` có discriminator `platform` | ✅ XONG (`ProfileController`) |
| (2) Endpoint verify StoreKit receipt | ✅ XONG (`AppleIapController#/verify`) |
| (3) `ApnsPushSenderService` định tuyến theo platform | 🟡 `chưa rõ — cần kiểm` (không tìm thấy class; có thể chưa dựng) |
| (Bonus) Universal Links + `apple-app-site-association` | ❌ Chưa có file |

**Thay đổi chưa commit (git status):** `AppleIapController.java` (sửa) + `TtsController.java` (`/api/ai-speaking/tts` trả `audio/mpeg`, `/tts/status` trả `TtsStatusDto`) + DTO/test mới. Theo memory `[[project_native_openapi_handoff]]` chúng đã được cherry-pick vào `main` qua **PR #128** (`467403b6`); working tree hiện hiển thị "modified" — `chưa rõ — cần kiểm` trạng thái commit chính xác trên nhánh này.

### 5.4 Khai tử Expo/Capacitor
- **Expo còn sống:** `mobile/` (app.json, eas.json, ios/) — bundle id `com.deutschflow.app` **trùng** với native dự kiến.
- **Capacitor:** path static-export đã bỏ ở web (`next.config.mjs:6-8` AR-M1), nhánh `feat/capacitor-mobile` còn.
- [ ] **Quyết bundle id:** (A) khai tử Expo, native tái dùng `com.deutschflow.app`; hay (B) native dùng id mới chạy song song giai đoạn beta. — Owner: Mobile/PM. **Cần trước khi build TestFlight đầu tiên.**
- [ ] Sau khi native ổn: gỡ `mobile/` + Capacitor + Expo push.

### 5.5 Critical path → TestFlight → App Store
1. **(Bên ngoài)** Apple Developer Program ($99); tạo App ID (bật Push + In-App Purchase); cert/provisioning.
2. **(ASC)** Tạo app record + 4 sản phẩm IAP (`com.deutschflow.app.{pro,ultra}.{monthly,yearly}`) + cấu hình webhook ASSN v2 → `<backend>/api/payments/apple/notifications`.
3. **(iOS)** Ký + archive slice Phase 0–1 hiện có → **TestFlight nội bộ** (chứng minh pipeline ký/upload chạy).
4. **(iOS)** Code Phase 2–4 (SRS/Vocab/Speaking/Roadmap/Exam) — codegen đã có hợp đồng, chỉ dựng UI theo design.
5. **(iOS)** Phase 5: Paywall + StoreKit 2 client + restore; **UI xoá tài khoản**.
6. **(iOS)** Sandbox test mua/restore; E2E (XCUITest/Maestro) Auth→Today→mua→entitlement.
7. **(ASC)** Privacy labels + ATT decision + screenshots + demo account cho reviewer.
8. **(ASC)** Submit App Review → xử lý phản hồi → phased release.
9. Khai tử Expo (5.4).

**Ước tính:** từ "bắt đầu Phase 2" → live App Store ≈ **6–9 tuần** (`chưa rõ — phụ thuộc nhân lực iOS + chu kỳ review Apple`).

---

## 6. Kết luận (Bước 6)

### 6.1 Bảng 3 cột — độ sẵn sàng & blocker lớn nhất

| | **WEB v2** | **NATIVE iOS** | **BACKEND (chung)** |
|---|---|---|---|
| % sẵn sàng | Scope ~89% build · **0% live** | ~5–10% (khung) | Hợp đồng API ~xong · **deploy treo** |
| Verdict | 🟡 gần xong, chưa bật | 🔴 mới khởi động | 🟡 code có, chưa lên prod |
| Blocker lớn nhất | **Chưa có cơ chế dẫn user vào /v2** (cờ chỉ "đá ra") | **5/8 phase chưa code** (đỉnh là StoreKit client) | **`deploy-backend.sh` chưa chạy** (tree V219/V220 + audit endpoint) |
| Phụ thuộc chéo | Cần backend deploy (tree/audit) | Cần ASN webhook + (sau) ApnsPushSender | Phục vụ cả 2 |

### 6.2 Hai lộ trình deploy tách biệt
- **Web v2 (đi trước, ~vài ngày–1 tuần):** vá route-in cờ → deploy backend → punch-list + smoke-test → rollout nội bộ→10%→50%→100% (legacy fallback). **Phase D xoá legacy = sau, cần duyệt riêng.**
- **Mobile native (đi sau, ~6–9 tuần):** độc lập với cutover web; chỉ phụ thuộc backend (đã sẵn IAP/contract). Có thể bắt đầu **TestFlight slice Phase 0–1 ngay** sau khi có Apple Developer.
- **Phụ thuộc chéo:** cả hai dùng chung backend; deploy backend (tree/audit + xác nhận ApnsPushSender) phục vụ cả web v2 lẫn (về sau) push native.

### 6.3 Việc kế tiếp ngay (top 5)
1. 🔴 **FE:** Hiện thực "route-in" cho cờ `galerie-v2` (login → `v2RoleHome` khi cờ bật) + chốt redirect-map. *Không có bước này, bật cờ = vô nghĩa.*
2. 🔴 **Backend/DevOps:** Chạy `deploy-backend.sh` đưa V219/V220 + `curriculum` + `/api/roadmap/tree*` + `GET /api/admin/audit` lên prod.
3. 🟡 **PM/Tech lead:** Chốt 3 quyết định: (a) launcher legacy speaking/exam cho GA, (b) 12 màn admin legacy ở 2.4 cố ý-ngoài-v2 hay phải migrate, (c) onboarding giữ legacy.
4. 🟡 **QA:** Smoke-test runtime 57 màn /v2 (0 console error) + test kill-switch staging.
5. 🟡 **Mobile/PM:** Quyết bundle id (Expo vs native) + đăng ký Apple Developer để mở TestFlight slice Phase 0–1.

### 6.4 Rủi ro 🔴
- 🔴 **Ảo giác "đã cutover":** docs đo theo **manifest tự thu hẹp** (~89%) khiến tưởng đã chuyển hết; thực tế **0% user trên v2** và **~48% admin / ~45% student bề mặt legacy chưa có v2**. Đừng xoá legacy.
- 🔴 **Cơ chế cờ nửa vời:** bật PostHog 100% **không** đưa user vào v2 → nếu launch mà không vá route-in sẽ "đã bật mà không ai thấy".
- 🔴 **Backend deploy treo:** các màn backed (tree, audit, org rollup) sẽ trống/lỗi nếu FE v2 lên trước backend.
- 🟡 **Legacy không thể khai tử:** launcher (speaking/exam) + LP marketing + trang token public + đuôi dài admin/student buộc legacy sống song song lâu dài → chi phí bảo trì 2 UI.
- 🟡 **Native trễ:** 5/8 phase chưa code; rủi ro audio/IAP + chu kỳ review Apple → mốc App Store khó chắc.
- ⚪ **`chưa rõ — cần kiểm`:** `ApnsPushSenderService`; chủ đích 12 màn admin legacy; trạng thái commit IAP/TTS trên nhánh hiện tại; NSCamera có cần không; teacher public marketplace (`teachers/*`) có vào v2 không.
