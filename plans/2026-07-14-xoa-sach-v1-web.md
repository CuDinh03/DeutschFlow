# Plan: Xóa sạch bản UI web v1 (legacy) — tránh user login nhầm bản cũ

> Ngày lập: 2026-07-14 · Khảo sát bằng 8 agent (7 trục + completeness critic), mọi `file:line` đã verify tại thời điểm khảo sát (cây làm việc đang bẩn trên `feat/materials-library-phase1` — **re-verify line number khi thực thi**).

## Trạng thái

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| Đợt 0 | Chặn mọi đường vào v1 (redirect + nắn link) — **giải quyết ngay "login nhầm"** | ✅ 2026-07-14 · nhánh `chore/v1-lockout-wave0` |
| Đợt 1 | Bù GAP tính năng v2 còn deep-link về v1 | ⬜ |
| Đợt 2 | Backend đổi URL sinh ra (email, payment, DTO href) | ⬜ |
| Đợt 3 | Xóa cây v1 (~161 file / ~38k dòng) + redirect map + gỡ kill-switch | ⬜ |
| Đợt 4 | Dọn dead code, dependencies, docs, PostHog | ⬜ |

**Thứ tự deploy bắt buộc**: FE (Đợt 0 → 1) → BE (Đợt 2) → FE (Đợt 3) → dọn (Đợt 4). Đảo thứ tự = nút trên chính trang v2 (`v2/student/speaking/page.tsx:60` dùng href backend trả) trỏ vào 404.

---

## 1. Hiện trạng (kết quả khảo sát)

- Cây v1 = **185 file / 40.507 dòng** trong `frontend/src/app` (ngoài `v2/`); phần xóa ≈ **161 file / 38.262 dòng**; phần giữ = trang public/marketing + infra root.
- v2 đã là surface mặc định (login v1 cũng route vào v2 sau khi đăng nhập — `login/LoginClient.tsx:148-149`), **nhưng v1 còn nguyên và còn 3 đường đưa user quay về v1**:
  1. `HomeClient.tsx:35` — user có token vào `/` → `router.replace('/dashboard')` (v1). **Đường phổ biến nhất.**
  2. `middleware.ts:316-317` — user đã login gõ `/login`/`/register` → bounce về `roleHome()` **legacy** (`/admin`, `/teacher`, `/student`).
  3. `/login`, `/register` v1 vẫn sống, không có redirect nào (`next.config.mjs` không có `redirects()`).
- **4 tính năng v2 vẫn deep-link về v1 vì chưa port**: speaking engine (`/speaking`, `/speaking/chat` — 715 dòng, engine thật; v2 chỉ là launcher), mock-exam runner (`/student/mock-exam`), grammar runner (`/student/grammar`), interviews (`/student/interviews`). Ngoài ra `v2/register/page.tsx:83` đổ user mới về `/onboarding` (v1, guest-reachable).
- **Backend sinh URL v1** (nhiều hơn 4 điểm mailer/payment — có cả relative href trong DTO):
  - `OrgInvitationMailer.java:44` → `/org/accept?token=` (email **bất biến**, guest chưa có account) — nghiêm trọng nhất.
  - `application.yml:536` MoMo return-url `/payment/success`; `:540-541` Stripe `/student/pricing?stripe=*` (cả 2 đang disabled-by-default nhưng phải dọn).
  - `AdaptivePolicyService.java:174,~185` → `/speaking?topic=`, `/student/vocab-practice?topic=` (TodayPlanDto — v2 đang tiêu thụ); `RecommendationService.java:36-71` → `/vocabulary/review`, `/speaking/drill?focus=`… (một số href hỏng sẵn); `RoadmapSetupController.java:51` → `/roadmap`.
- **Mobile (build 11 đã phát hành)**: chỉ ràng buộc `https://mydeutschflow.com/privacy` + `/terms` phải tiếp tục 200 (nằm trong binary + metadata App Store Connect — `mobile/lib/legal.ts:3-6`). Không WebView, không universal link. Alert `login.tsx:57` hướng GV/admin gõ tay domain → cần redirect `/login`.
- **Nhánh native trong `lib/roleRouting.ts:46-57` là DEAD CODE** — `isNative()` hardcode `return false` (`authSession.ts:29-31`), mobile không có WebView. KHÔNG phải lý do giữ route v1. Xóa cùng test `src/__tests__/roleRouting.test.ts:40-45`.
- **Kill-switch `GALERIE_V2_DISABLED`** (`middleware.ts:234-236`): sau khi xóa v1 sẽ bounce toàn bộ `/v2` → 404 = **sập cả site**. Phải gỡ code + env Amplify + sửa runbook (`qa/RUNBOOK_FULL_E2E.md:8`, `plans/2026-06-22-week-deploy-plan.md:27`, `plans/2026-06-23-NEXT-SESSION-HANDOFF.md:115`).
- **PWA cũ**: `frontend/public/sw.js` + workbox artifacts còn đó — browser từng register có thể serve shell v1 từ cache sau khi xóa → cần self-destroying service worker.

## 2. Quyết định chốt (giải quyết mâu thuẫn giữa các trục khảo sát)

| # | Quyết định | Lý do |
|---|---|---|
| Q1 | **GIỮ** các trang public: `/`, `/about`, `/luyen-thi/*`, `/giao-vien-mien-phi`, `/teachers/*`, `/privacy`, `/terms`, `/support`, `/free-grade`, `/report/[token]`, `/certificate/[token]` | Marketing/SEO/legal + mobile ASC metadata + link share đã phát hành (bất biến) |
| Q2 | **GIỮ** `/org/accept` cho tới khi có `/v2/org/accept`, sau đó **redirect vĩnh viễn** (không bao giờ xóa redirect này — email mời đã gửi là bất biến) | `OrgInvitationMailer.java:44`; middleware exempt `middleware.ts:76` |
| Q3 | **GIỮ** `/news` tạm thời, nắn 3 link nội bộ sang v2 (`news/page.tsx:32,74,79`); cân nhắc port vào `/v2/student` sau (ngoài critical path) | Rẻ hơn port; là learner-gated nhưng không phải "login surface" |
| Q4 | **GIỮ** `/onboarding` (`(auth)/onboarding`) qua Đợt 0-2 vì `v2/register` phụ thuộc; port `/v2/onboarding` là việc của Đợt 1 (nếu trễ thì giữ tiếp, KHÔNG xóa cùng đợt login/register) | `v2/register/page.tsx:83`; guest exemption `middleware.ts:337-340` |
| Q5 | Nhánh `native:true` của `homeFor()` + `MobileLoginForm`/`MobileRegisterForm` = dead code → **xóa**, không bảo tồn route v1 vì nó | `isNative()` ≡ false; mobile không WebView |
| Q6 | Danh sách dead-code trục shared-code phải **chạy lại reachability** với tập-giữ gồm certificate/report/news — cụ thể `lib/certificateApi.ts`, `components/certificate/CertificateActions`, `lib/marketingApi.ts`, `components/marketing/ShareButtons` **PHẢI GIỮ** (trang public import — `certificate/[token]/page.tsx:5-6`, `report/[token]/page.tsx:5-6`) | Tránh vỡ `tsc` |
| Q7 | Redirect đặt ở **`next.config.mjs` `redirects()`** (static, sống cả trên cache CloudFront/Amplify — middleware KHÔNG chạy trên route cached, xem comment CSP `middleware.ts:162-173`); redirect có query (`?token=`, `?next=`) mặc định được Next forward nguyên vẹn. **Kiểm Amplify console "Rewrites and redirects" trước** (rule console nằm ngoài repo, có thể nuốt rule mới) | B4 critic |
| Q8 | Stripe/MoMo default URL đổi về `/v2/payment?stripe=…` / trang success v2 (cả hai service đang disabled — không chặn đợt nào) | A5 critic |
| Q9 | Route GAP-thuần không ai link (`weekly-speaking`, `leaderboard`, `assessment`, `beginner`, `swipe-cards`, `article-quiz`, `curriculum`, `exercise-history`, `vocab-analytics`, `speaking-history`, `grammar-review`, `groq-usage`, `practice*`, `learn/node`, `student/game`, `student/certificates`, `teacher/media`…) → **đo PostHog `$pageview` 7 ngày trước Đợt 3**; traffic ≈ 0 → xóa không port; có traffic → quyết định port từng cái | B2 critic — cách rẻ nhất để không xóa nhầm tính năng đang dùng |

## 3. Đợt 0 — Chặn mọi đường vào v1 (1 PR, deploy được ngay, chưa xóa gì) — ✅ ĐÃ LÀM

> Đây là đợt giải quyết trực tiếp yêu cầu "tránh login vào nhầm": sau đợt này user **không thể** thấy form login v1 và **không bị** đưa về v1 sau đăng nhập, kể cả khi cây v1 còn nguyên.

> ### ⚠️ THAY ĐỔI SO VỚI PLAN GỐC: kill-switch phải gỡ NGAY ở Đợt 0 (không đợi Đợt 3)
> `next.config.mjs` redirect `/login` → `/v2/login`, trong khi kill-switch `GALERIE_V2_DISABLED` bounce `/v2/*` → path legacy. Hai thứ này cùng sống = **vòng lặp redirect vô hạn** (`/login` → `/v2/login` → `/login` → …) nếu ai đó bật env theo runbook cũ → sập cả site. Nên Đợt 0 đã **gỡ hẳn kill-switch** khỏi `middleware.ts`, cập nhật 4 doc vận hành + comment `V2Gate.tsx`.
> **Rollback mới** (thay kill-switch): revert commit trên `main` (Amplify auto-deploy) hoặc Amplify Console → "Redeploy this version". Việc cần làm phía hạ tầng: **xóa env `GALERIE_V2_DISABLED` khỏi Amplify** (giờ là no-op — để lại chỉ khiến người trực tưởng đã rollback).

### 3.1 Redirect auth surface
- [ ] `next.config.mjs`: thêm `redirects()` — `/login` → `/v2/login`, `/register` → `/v2/register` (permanent, forward query `next`). Lưu ý `trailingSlash: true` — khai báo cả 2 dạng hoặc test kỹ `/login/`.
- [ ] `middleware.ts:316-317`: bounce logged-in trên `LOGIN_ROUTES` đổi `roleHome()` → `v2RoleHome()`; **thêm** `/v2/login`, `/v2/register` vào bounce logged-in (hiện user đã login vào `/v2/login` vẫn thấy form — B8 critic).
- [ ] `/v2/login` đọc và honor `?next=` (validate chỉ nhận path nội bộ bắt đầu bằng `/`) — middleware đã set (`middleware.ts:259`) nhưng chưa ai đọc.

### 3.2 Nắn mọi redirect/link về v1 trong code dùng chung + trang giữ lại
- [ ] `HomeClient.tsx:35` → `/v2/student/dashboard` (xóa luôn nhánh native chết `:28`).
- [ ] `hooks/useAdminData.ts:61` → `/v2/login`; `:42` → `homeFor(role)` từ `lib/roleRouting.ts`.
- [ ] `lib/aiSpeakingApi.ts:333,344` → `/v2/login` (hoặc đồng bộ cơ chế `useAuthRecoveryStore` như `lib/api.ts:157`).
- [ ] `components/auth/AuthRecoveryDialog.tsx`: `requiresLogin()` thêm `pathname.startsWith('/v2/')` (trừ `/v2/login`); `:45` → `/v2/login`.
- [ ] CTA marketing → `/v2/register`: `free-grade/client-page.tsx:263`, `luyen-thi/[slug]/page.tsx:57`, `giao-vien-mien-phi/page.tsx:51,106`, `certificate/[token]/page.tsx:158`, `report/[token]/page.tsx:99`.
- [ ] `news/page.tsx:32` → `/v2/login?next=/news`; `:74,79` → `/v2/student/dashboard`.
- [ ] `teachers/[id]/client-page.tsx:132` → `/v2/student/tutor?teacherId=…` **kèm** việc `v2/student/tutor/page.tsx` đọc `?teacherId=` (hiện không đọc query nào — A4 critic).
- [ ] Middleware: các bounce `roleHome()` còn lại (`:348`, `:361`, `:367`) → `v2RoleHome()` (an toàn hơn khi cây v1 vẫn tạm còn).

### 3.3 Test + đo đạc chuẩn bị
- [ ] `tests/e2e/auth.spec.ts` chuyển sang `/v2/login` + assert đích v2 (`:57,65,93,133,147`).
- [ ] Thêm capture 404 (path + referrer) vào `src/app/not-found.tsx` (PostHog event) — **trước** mọi đợt xóa, để redirect map thiếu entry là thấy ngay (B7 critic).
- [ ] Bật đo PostHog `$pageview` cho danh sách route Q9 (không cần code — chỉ cần dựng insight/dashboard đếm theo path 7 ngày).

**Nghiệm thu Đợt 0**: gõ `/login` → về `/v2/login`; login xong mọi role đứng trong `/v2/*`; vào `/` khi có token → `/v2/student/dashboard`; session hết hạn trên trang v2 → dialog đưa về `/v2/login`.

## 4. Đợt 1 — Bù GAP tính năng (v2 hết phụ thuộc v1)

- [ ] **Speaking engine**: port `/speaking` + `/speaking/chat` → `/v2/student/speaking/live` (di chuyển components `features/ai-speaking/*`, `speaking/*`, hooks `useAiSpeakingSession`, `useSpeakingRecorderMic`, `useGermanTTS`… đổi shell v1 → RoleShell v2). Sửa 3 điểm deep-link: `v2/student/speaking/page.tsx:22,36`, `v2/student/classes/[id]/assignments/[aid]/page.tsx:109`, fallback `:60`.
- [ ] **Mock-exam runner**: port `/student/mock-exam` → `/v2/student/mock-exam/run`; sửa `v2/student/mock-exam/page.tsx:130`.
- [ ] **Grammar runner**: port `/student/grammar` → `/v2/student/grammar/practice`; sửa `v2/student/grammar/page.tsx:142`.
- [ ] **Interviews**: port `/student/interviews` → `/v2/student/interviews`; sửa `v2/student/speaking/page.tsx:29`.
- [ ] **Onboarding**: port funnel `(auth)/onboarding` (placement + mentor + A/B PostHog, 530 dòng) → `/v2/onboarding` (guest-reachable — thêm exemption middleware); sửa `v2/register/page.tsx:83`. Nếu trễ → giữ `/onboarding` v1 thêm 1 đợt (Q4).
- [ ] **`/v2/org/accept`**: xây trang nhận lời mời (port `org/accept/client-page.tsx`, 301 dòng, public + token query) — điều kiện tiên quyết cho Đợt 2.
- [ ] **Auth parity v2** (gap so với v1 + nợ phải trả trước khi khai tử v1 login):
  - [ ] i18n 3 thứ tiếng cho `/v2/login` + `/v2/register` (hiện hardcode tiếng Việt — regression với user EN/DE).
  - [ ] Maintenance banner `NEXT_PUBLIC_MAINTENANCE_MESSAGE` port sang v2 login (công cụ vận hành đang dùng).
  - [ ] Sửa remember-me giả (`v2/login/page.tsx:141`) — nối thật hoặc bỏ checkbox.
  - [ ] Link Terms/Privacy `href="#"` ở v2 register (`:168-169`) → `/terms`, `/privacy`.
  - [ ] (Khuyến nghị, ngoài critical path) Forgot-password UI thật — backend đã có `POST /api/auth/forgot-password` + `reset-password` (`AuthController.java:160,178`), v2 đang toast giả "sắp ra mắt".
- [ ] Quyết định Q9: xem số liệu PostHog → chốt danh sách route GAP-thuần xóa-không-port; route có traffic thì port ở đợt này.

## 5. Đợt 2 — Backend đổi URL sinh ra (deploy backend TRƯỚC khi FE xóa)

- [ ] `OrgInvitationMailer.java:44` → `/v2/org/accept?token=`; nhân tiện tách config riêng `app.web-url` thay vì đu theo origin đầu tiên của `app.cors.allowed-origins` (`:30,76-82` — đổi thứ tự origin là đổi domain trong email).
- [ ] `application.yml:536` (`MOMO_RETURN_URL`) + `:540-541` (`STRIPE_SUCCESS_URL/CANCEL_URL`) → đích v2 (Q8); đổi cả env prod nếu đang set.
- [ ] `AdaptivePolicyService.java:174,~185` → `/v2/student/speaking?topic=`, đích vocab-practice v2 tương ứng.
- [ ] `RecommendationService.java:36,47,61,71` → path v2 (lưu ý `/vocabulary/review`, `/speaking/drill` đang hỏng sẵn — nhân tiện sửa đúng).
- [ ] `RoadmapSetupController.java:51` → `/v2/student/roadmap`.
- [ ] Grep chốt lại toàn backend theo pattern relative-path `"/(student|teacher|admin|org|speaking|vocabulary|roadmap|dashboard|login|register|payment|onboarding)` trước khi đóng đợt.
- [ ] CORS **không** cần đổi (chỉ so origin, đã xác nhận `WebConfig.java:16-38`).

## 6. Đợt 3 — Xóa cây v1 + redirect map + gỡ kill-switch (1 PR lớn, tag trước khi merge)

**Gate bắt buộc trước khi merge** (B9 critic):
- [ ] E2E smoke v2 pass đủ **4 role** (STUDENT / TEACHER / ADMIN / OWNER-MANAGER) — mở rộng `v2-smoke.spec.ts` (helpers `tests/helpers/tokens.ts` hiện thiếu token admin/org) + viết bản thay thế `live-account.spec.ts` chạy trên prod.
- [ ] Đã kiểm Amplify console "Rewrites and redirects" (rule ngoài repo).
- [ ] Đã xác nhận env `GALERIE_V2_DISABLED` **không set** trên Amplify; xóa env + sửa 3 runbook docs cùng PR.
- [ ] `git tag pre-v1-removal` trên main trước merge.

### 6.1 Xóa route (`frontend/src/app/`)
`login/`, `register/`, `dashboard/`, `student/` (71 file), `teacher/` (24), `admin/` (36), `org/` **trừ** `accept/` (nếu chưa có v2/org/accept thì giữ cả accept), `speaking/`, `roadmap/`, `vocabulary/`, `lesson/`, `game/`, `payment/`, `onboarding/` + `(auth)/onboarding` (nếu đã port), `news/` (chỉ khi Q3 đổi thành xóa). **Giữ**: danh sách Q1 + `org/accept` + infra root (`layout.tsx`, `globals.css`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts`).

### 6.2 Redirect map (thêm vào `next.config.mjs` cùng PR xóa)
| Route v1 | Đích | Loại |
|---|---|---|
| `/login`, `/register` | `/v2/login`, `/v2/register` | 301 (đã có từ Đợt 0) |
| `/org/accept` | `/v2/org/accept` (+ giữ nguyên query) | 301 **vĩnh viễn — không bao giờ gỡ** |
| `/dashboard`, `/student/:path*` | `/v2/student/dashboard` | 301 (đủ — trang con v1 không có bookmark đáng giữ mapping 1-1) |
| `/teacher/:path*` | `/v2/teacher` | 301 |
| `/admin/:path*` | `/v2/admin/users` | 301 |
| `/org/:path*` (trừ accept) | `/v2/org` | 301 |
| `/speaking/:path*`, `/roadmap/:path*`, `/vocabulary` | đích v2 tương ứng | 301 |
| `/onboarding` | `/v2/onboarding` | 301 (khi đã port) |
| `/payment/success` | đích success v2 (Q8) | 301 |
| Còn lại (`/lesson`, `/game`…) | 404 chủ động (đã có tracking từ Đợt 0) | — |

### 6.3 Middleware viết lại
- [ ] Gỡ kill-switch `GALERIE_V2_DISABLED` (`:234-236`).
- [ ] Gỡ toàn bộ khối gate legacy (`:282-370`): `LOGIN_ROUTES`, `roleHome()`, `requiredRole()` prefix v1, `learnerSharedPaths()`, `requiresOrg()` legacy — chỉ giữ gate `/v2/*` + CSP. Giữ exemption public cho `/org/accept` (nếu còn) và `/v2/onboarding` guest.

### 6.4 Xóa dead code kèm (theo import-graph trục 4, ĐÃ sửa Q6)
- Components chỉ-v1: `exam`, `features`, `speaking`, `teacher`, `learn`, `layouts` (StudentShell/TeacherShell/OrgShell/StudentBottomNav), `admin/AdminShell`, `journey`, `guide`, `game`, `gamification`, `analytics`, `errors`, `notifications/NotificationBell` (v1), `practice`, `characters`, `vocabulary`, `ErrorBoundary.tsx`, `auth/Mobile*Form`, `chat`, `roadmap` (orphan sẵn). **Giữ**: `ui-v2`, `learning-tree`, `landing-v2`, `system`, `BauhausLogo`, `admin/LearningDetailModal`, `auth/AuthRecoveryDialog`, `legal`, `marketing`, `certificate/CertificateActions` (Q6), 9 file `components/ui` (sonner, LanguageSwitcher, alert-dialog, utils, button, popover, DeutschFlowLogo, badge, card).
- Hooks xóa 11 + orphan 3; lib xóa ~38 + orphan 8 (**trừ** `certificateApi`, `marketingApi` — Q6); `contexts/PlanContext`, stores `useNodeSessionStore`/`useSpeakingStore`/`useSrsStore`, types v1. Sau đó chạy `npx tsc --noEmit` + một lượt knip/ts-prune xác nhận không còn orphan import.
- Nhánh `native` trong `lib/roleRouting.ts:46-57` + `roleRouting.test.ts:40-45` (Q5).
- i18n: sửa `src/i18n/request.ts:30` bỏ base catalog v1; thay `components/ui/LanguageSwitcher` bằng `ui-v2/LanguageToggle` trong root layout (key `nav.*`); xóa `messages/{de,en,vi}.json` + cụm `scripts/i18n/update_i18n_*.py`; wire `frontend/scripts/check-i18n-v2.js` vào `frontend-ci.yml` (đang mồ côi).
- [ ] `robots.ts:12` đổi disallow sang prefix `/v2/*` app routes.
- [ ] Thay `public/sw.js` bằng **self-destroying service worker** (xóa `workbox-*.js`, `swe-worker-*.js`) — chống cache PWA cũ serve shell v1 (B6 critic).

### 6.5 Test/CI
- [ ] Xóa/viết lại spec v1: `speaking.spec.ts`, `payment-and-srs.spec.ts`, `teacher-lms.spec.ts`, `student/roadmap.spec.ts`, `live-account.spec.ts` (bản v2 thay thế đã làm ở gate).
- [ ] `playwright.config.ts:24` — webServer readiness URL `/student/roadmap` → `/v2` hoặc `/`.
- [ ] `src/test/components/OnboardingWizard.test.tsx` xóa/port cùng `(auth)/onboarding` (nếu không: vỡ cả `tsc` lẫn `vitest` trong `frontend-ci.yml:32-42`).

**Theo dõi sau deploy Đợt 3 (48h)**: 404 event từ not-found tracking (path + referrer) — thiếu entry redirect thì thêm ngay; Amplify revert = rollback (redirect map nằm cùng PR nên revert an toàn).

## 7. Đợt 4 — Dọn dẹp

- [ ] Gỡ dependency: `@dnd-kit/*`, `@radix-ui/react-dropdown-menu`, `idb-keyval` (v1-only) + ~30 gói orphan (`@xyflow/react`, `react-hook-form`, `cmdk`, `vaul`, `embla-carousel-react`, `react-day-picker`, `input-otp`, `react-resizable-panels`, `canvas-confetti`, `@ducanh2912/next-pwa`, `next-themes`, ~20 gói `@radix-ui/*` — chỉ 42 file shadcn orphan dùng). Giữ `react-dom`.
- [ ] PostHog: archive flag `galerie-v2` (console + `src/lib/flags.ts:11` orphan); port event của tính năng đã port (`onboarding_step_completed`, `mock_exam_render_error`, `feature_session`, `streak_extended`); chấp nhận đứt chuỗi funnel theo `$current_url` v1 (ghi chú mốc thời gian vào dashboard).
- [ ] Docs ưu tiên: `docs/GUIDE.md:133,139`, `docs/QA_TEACHER_PROD_CHECKLIST.md`, `docs/UI_2.0_HANDOFF.md`, `docs/UI_2.0_VISUAL_QA_RUNBOOK.md`, `docs/FE_END_TO_END_TESTING.md:91`, `docs/ROUTING.md` (viết lại theo v2), `docs/UI_2.0_MIGRATION_MAP.md` (đánh dấu Phase 4 cutover DONE), `plans/2026-07-03-OWNER-MANUAL-STEPS.md:79`, `frontend/I18N_V2_PROGRESS.md`, comment cache `amplify.yml:38-41`. Nhóm BAO_CAO/KE_HOACH lịch sử: chỉ chú thích "route v1 đã gỡ".
- [ ] **Hợp nhất kế hoạch**: `plans/2026-07-14-b2b-completion.md` mục M-11/12/13 ("xoá `frontend/src/app/org/`") được plan này **nuốt** — cập nhật file đó trỏ về đây, tránh 2 nhánh cùng xóa `org/` với 2 scope.

## 8. Rủi ro & rollback

| Rủi ro | Phòng ngừa |
|---|---|
| Email mời org đã gửi → link chết | Redirect `/org/accept` **vĩnh viễn**; backend đổi mailer trước khi xóa |
| Mobile binary cũ mở `/privacy`, `/terms` | Giữ nguyên 2 trang (Q1); nếu sau này dời → 301 trước khi dời |
| Bật nhầm kill-switch cũ theo runbook → sập site | Gỡ code + env + sửa 3 runbook trong CÙNG PR Đợt 3 |
| Cache CloudFront/PWA serve shell v1 sau xóa | Redirect đặt ở `next.config.mjs` (static, sống trên cache); self-destroying sw.js; Amplify invalidate sau deploy |
| Xóa nhầm tính năng đang dùng (GAP thuần) | Đo PostHog 7 ngày (Q9) trước khi chốt danh sách xóa-không-port |
| Redirect map thiếu entry | 404 tracking từ Đợt 0; theo dõi 48h sau Đợt 3 |
| Vỡ build vì dead-code list sai | Q6 + `tsc --noEmit` + vitest + build local trước mỗi PR |
| Cây làm việc hiện bẩn (`feat/materials-library-phase1`) | Mỗi đợt = 1 nhánh mới từ `main` sạch; không trộn với materials |

## 9. Ước lượng

| Đợt | Khối lượng | Ghi chú |
|---|---|---|
| Đợt 0 | ~1 buổi | Toàn bộ là nắn link/redirect + test; **ship được độc lập, giải quyết ngay yêu cầu "login nhầm"** |
| Đợt 1 | 3–5 buổi | Port speaking engine là nặng nhất (715 dòng + hooks + shell); org/accept + auth parity vừa; chờ 7 ngày số liệu Q9 chạy song song |
| Đợt 2 | ~0.5 buổi | 5 file backend + env + regression test |
| Đợt 3 | 1–2 buổi | Xóa là nhanh, viết lại middleware + test + verify build là phần chính |
| Đợt 4 | ~1 buổi | Dọn deps + docs |
