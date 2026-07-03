# KẾ HOẠCH TRIỂN KHAI — Remediation Audit 2026-07-03

> **Nguồn:** `BAO_CAO_DANH_GIA_TOAN_DIEN_2026-07-03.md` (131 findings, 4 trục, điểm TB ~3.0/5).
> **Ngày lập:** 2026-07-03 · **Neo deadline:** nộp App Store **6–7/7/2026**.
> **Quy ước tick:** `[ ]` chưa làm · `[~]` đang làm · `[x]` xong (ghi chú kết quả + commit/PR ngay bên dưới item). Giữ Dashboard đầu file luôn cập nhật.

---

## 🔒 QUYẾT ĐỊNH ĐÃ CHỐT (2026-07-03)

1. **Phương án nộp = A** — nộp bản **FREE-ONLY** đúng 6–7/7; ký hợp đồng Apple + build IAP **song song**; v1.1 monetization ra ~2 tuần sau.
2. **Stripe = ẨN TẠM** ở v1.0 web (chỉ để lại SePay là kênh VN; bật lại Stripe sau khi sửa nhãn/flow tử tế).
3. **CV scraper = KHÔNG BUILD** — thay bằng pipeline consent-based (Phase 3, F1).
4. **Free tier = KHÔNG AI** (chạm AI → paywall); PRO = token wallet; ULTRA hoãn (V242 `is_active=FALSE`); MoMo hoãn.
5. **Marketplace C2C = ẨN entry-point WEB, giữ backend** (2026-07-03, đã verify). Mobile vốn KHÔNG có UI marketplace (chỉ tile comment-out) → App Store không dính. Ẩn 3 link web sau 1 flag (`book-session`, "Marketplace GV" `/teachers`) để gỡ luồng-tiền-nửa-vời (đặt lịch hiện "Tổng thanh toán" nhưng không charge, settle offline), giữ code làm optionality Plan C.
6. **Coins = ĐỂ DARK cả v1.0 + v1.1** (2026-07-03, đã verify). Coins vắng mặt khỏi `main` (ở branch `feat/student-coin-currency`); spend catalog hiện cho free user chạm AI (`purchaseBonusSpeakingSession` +8000 token, `purchaseTrialPass` PRO mock) → **phá lock "free=NO AI"**. Xét lại v1.2+ CHỈ sau khi redesign spend catalog thành non-AI. 0 công.
7. **Demo account App Review = FREE tier + review-notes rõ** (2026-07-03). Cả 2 account để FREE (khớp v1.0 free-only); reviewer thấy đúng trải nghiệm shipped, AI hiện card khóa PRO cố ý; notes ghi rõ "AI is Pro-gated, purchase in a future version".

---

## 📊 DASHBOARD

| Nhóm | Xong | Tổng | Ghi chú |
|---|---|---|---|
| ⚡ Hôm nay (click, <1h) | 0 | 5 | Doc hướng dẫn: `plans/2026-07-03-OWNER-MANUAL-STEPS.md` — CHỦ DỰ ÁN tự làm |
| 📦 Phase 0 — trước submit | **7** | 8 | Code XONG hết (branch `chore/phase0-audit-remediation`); còn 0.8 submit (thủ công) |
| 💰 Phase 1 — monetization v1.1 | 0 | 8 | ≈ 12–16 ngày · sau submit |
| 🛡️ Phase 2 — ổn định & scale | 0 | 8 | ≈ 12–15 ngày · tháng 8 |
| 🧑‍💼 Phase 3 — HR/Payroll | 0 | 6 | ≈ 16–20 ngày · tháng 8–9 |

**Đường găng:** Paid Apps Agreement (0 code, lead-time Apple) → phải ký **hôm nay**.

> **✅ PROGRESS 2026-07-03 (session — branch `chore/phase0-audit-remediation`):** Phase 0 code hoàn tất & verified (backend compile ✅, frontend `tsc` + `next build` ✅, java-reviewer APPROVED delete-account). Chi tiết từng item ở checkbox bên dưới. Việc CÒN LẠI thủ công: 3 việc "click" (doc riêng), tạo 2 demo account + điền `[[Legal name]]` vào `frontend/src/content/legal/*.ts`, rồi 0.8 submit. ⚠️ IT delete-account đã viết nhưng CHƯA chạy được ở máy này (không có Docker/Postgres) → chạy trong CI. ⚠️ Đổi mật khẩu account `nvb@gmail.com` (đã gỡ khỏi test).

---

## ⚡ HÔM NAY — việc "click", làm ngay (bất kể A/B)

- [ ] **T1. Ký Paid Apps Agreement + W-8BEN + banking** trên App Store Connect *(finding C-7 · đường găng dài nhất)*
  - DoD: Agreements → **Active**. Không có bước này thì IAP không thể "Ready to Submit".
- [ ] **T2. Xác minh RDS automated backup + deletion protection** (AWS console 15') *(A6-1 🔴, A7-8)*
  - Nếu backup TẮT → bật retention ≥7 ngày; bật deletion protection. Chụp màn hình lưu vào repo (`plans/appstore/` hoặc runbook).
  - DoD: có bằng chứng backup đang chạy + 1 lần thử restore snapshot.
- [ ] **T3. Bật branch protection cho `main`** *(A6-7 · đã xác nhận đang OFF qua `gh api`)*
  - Yêu cầu PR + CI xanh trước merge; chặn push thẳng.
- [ ] **T4. UptimeRobot free → `/actuator/health`** *(A6-11)* — cảnh báo down độc lập stack.
- [ ] **T5. Bật notify khi CI fail trên `main`** *(A6-2)* — main đã đỏ từ 24/06 không ai biết.

---

## 📦 PHASE 0 — Trước submit 6–7/7 (P0, ≈ 3.5–4.5 ngày)

- [x] **0.2 Fix delete-account** 🔴 ✅ (AccountDeletionService + messages/class_channel_messages + IT `AccountDeletionIT`; reviewer APPROVED; IT run in CI) *(A3b-1, A7-2 · App Store 5.1.1(v) + NĐ13)* — **~0.5–1d**
  - File: `backend/src/main/java/com/deutschflow/user/service/AccountDeletionService.java` (mảng `NON_CASCADING_BY_USER_ID`).
  - ⚠️ **Rộng hơn báo cáo** — các FK non-cascading tới `users(id)` mà service ĐANG THIẾU (learner path):
    - `messages.sender_id` **và** `messages.recipient_id` (V228 — cả người GỬI và người NHẬN đều chặn xóa)
    - `class_channel_messages.sender_id` + `class_channel_messages.deleted_by` (V241)
  - Xóa theo thứ tự phụ thuộc trong cùng transaction; cân nhắc **anonymize thay vì DELETE** nếu muốn giữ lịch sử chat của người còn lại (set sender→NULL không được vì NOT NULL → phải xóa row message của user, hoặc soft-anonymize bằng tài khoản "deleted user").
  - Test: 1 IT "xóa account từng gửi + nhận tin nhắn + đăng kênh lớp" phải xanh; nên viết helper **quét toàn bộ FK trỏ users** để CI bắt bảng mới thêm sau này.
  - DoD: IT xanh; xóa account demo có tin nhắn thành công trên staging.
- [x] **0.6 V243 — sửa `CHECK day_of_week`** ✅ (V243 drop-any-check→1-7; ULTRA canonicalize DỜI sang V242/Phase 1) *(A7-1 ✅ CONFIRMED, A7-3)* — **~0.25d**
  - `V236__class_schedule.sql:9` hiện `CHECK (day_of_week BETWEEN 0 AND 6)`; V240 đã đổi sang ISO **1–7** nhưng chưa sửa CHECK → **tạo lịch Chủ nhật (7) fail**.
  - V243: `ALTER … DROP CONSTRAINT` cũ, thêm `CHECK (day_of_week BETWEEN 1 AND 7)`; áp cho cả `class_schedule_patterns` và `class_sessions` nếu có.
  - Gộp luôn: canonicalize row plan **ULTRA** (fresh-replay `daily_token_grant=0`, price NULL, features rỗng — A7-3) + `is_active=FALSE`.
  - DoD: tạo lịch Chủ nhật OK trên staging; fresh-DB Flyway replay xanh.
- [x] **0.4 Host Privacy Policy + Terms + Support** *(C-12)* — **~0.5d** ✅ (routes `/privacy` `/terms` `/support`; ⚠️ điền `[[Legal name]]` vào `src/content/legal/*.ts`)
  - Draft đã có sẵn: `plans/appstore/PRIVACY_POLICY.md`, `TERMS_OF_USE.md` → render thành route Next.js công khai (điền hết `[[…]]`: tên pháp lý cá nhân, email support).
  - DoD: 3 URL public truy cập được; dán vào App Store Connect metadata.
- [x] **0.5 Dọn bề mặt bán hàng theo quyết định** *(B-3, C-5, C-6)* — **~0.5–1d** ✅ (pricing v1 + v2/payment: bỏ ULTRA/MoMo/Stripe → coming-soon SePay; i18n vi/en/de FREE bỏ AI/unlimited)
  - `frontend/src/app/student/pricing/page.tsx`: **ẩn ULTRA + MoMo + Stripe** (chốt "ẩn tạm Stripe"), chỉ để SePay.
  - Sửa copy hết chỗ hứa "AI cho free" / "không giới hạn": `mobile/app/(student)/upgrade.tsx`, `vi.json`, `plans/appstore/STORE_COPY.md`.
  - DoD: không còn chữ "AI"/"unlimited" trong benefit của FREE; pricing chỉ còn kênh đang hoạt động (SePay).
- [x] **0.5b Ẩn entry-point marketplace C2C trên web** *(A1-9, C-11 · quyết định #5)* — **~1–2h** ✅ (flag `MARKETPLACE_ENABLED` off; nav.ts + TeacherShell ẩn; 3 route guard `notFound()`; backend giữ nguyên)
  - Ẩn sau 1 flag: nav `book-session` "Gia sư 1:1" (`frontend/src/components/ui-v2/nav.ts:227`), `TeacherShell.tsx:66` "Marketplace GV", route `frontend/src/app/teachers/page.tsx` + `/v2/student/tutor` + `/student/book-session`.
  - **Giữ nguyên** backend (`TeacherMarketplaceController`, `TeacherSessionController`) + code — chỉ ẩn mặt tiền để gỡ luồng-đặt-lịch-hiện-"Tổng thanh toán"-nhưng-không-charge. Optionality Plan C được bảo toàn.
  - DoD: student không tự vào được luồng đặt lịch GV có tiền; backend còn nguyên, bật lại = gỡ flag.
- [x] **0.9 Gỡ credential prod khỏi test + đổi mật khẩu** *(A5-8 · secret hygiene)* — **~0.5h** ✅ (dùng env `E2E_LIVE_EMAIL/PASSWORD` + `test.skip`; ⚠️ CHỦ DỰ ÁN đổi mật khẩu `nvb@gmail.com`)
  - `frontend/tests/e2e/live-account.spec.ts` — gỡ hardcode, chuyển sang env; đổi mật khẩu account đó.
- [~] **0.10 Demo accounts + rewrite review-notes** *(C-13 · quyết định #7)* — **~0.5d (+15–20' dùng app)** · phụ thuộc 0.2 deploy · ✅ review-notes ĐÃ viết lại free-only (STORE_COPY.md); ⏳ tạo 2 demo account = THỦ CÔNG (cần build TestFlight)
  - **KHÔNG viết SQL seed** (dễ tạo state FSRS/skill-tree không hợp lệ). Tạo **account primary** = đăng ký thật trên build TestFlight rồi dùng app 15–20' (3–5 lesson, vài SRS review, 1 mock exam) → dữ liệu học đảm bảo hợp lệ.
  - **Account secondary tối giản** (chỉ đăng ký, KHÔNG data/KHÔNG nhắn tin/KHÔNG join lớp) — dành riêng cho reviewer test xóa tài khoản (tránh dính bug delete-account 0.2).
  - Cả 2 để **FREE** (đừng cấp PRO qua admin). Viết lại App Review Information trong `plans/appstore/STORE_COPY.md`: **bỏ mục ADS + SUBSCRIPTION**, thêm 2–3 dòng "AI features (Speaking, một số exam) là Pro-gated, hiện card 'Tính năng PRO' — cố ý, IAP ở version sau".
  - Giao credential **chỉ qua ô Review Information của ASC**, KHÔNG commit plaintext (bài học V233).
  - DoD: 2 account sẵn sàng; review-notes free-only; card khóa PRO hiển thị sạch (không crash) trên build.
- [ ] **0.8 Submit bản FREE-ONLY** *(C-13)* — **~1–1.5d** · phụ thuộc 0.2, 0.4, 0.5, 0.10
  - Screenshots 6.9″ (spec `plans/appstore/SCREENSHOTS_ICON_SPEC.md`) + demo accounts (từ 0.10) + review notes free-only (KHÔNG khai Sentry).
  - `eas build --profile production` → `eas submit`.
  - ⚠️ Reviewer sẽ đụng bug delete-account nếu 0.2 chưa deploy lên prod → **deploy 0.2 trước khi submit**.
  - DoD: build **Waiting for Review** trước 7/7.

---

## 💰 PHASE 1 — Monetization v1.1 (P0/P1, tuần 2–4 tháng 7, ≈ 12–16 ngày)

Backend Apple IAP đã sẵn ~70–100% (V189, `/api/payments/apple/*`); việc chính nằm ở client + config.

- [ ] **1.1 Config backend Apple IAP** *(C-4 🔴, A3b-2)* — 0.5d · phụ thuộc T1 Active
  - Env `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow` (default hiện SAI = `com.deutschflow.app`), `APPLE_APP_APPLE_ID`, root-cert-dir; **V242** align product IDs với bundle thật; đăng ký ASSN V2 URL.
- [ ] **1.2 Tạo Subscription Group + PRO monthly/yearly trong ASC** — 0.5d · phụ thuộc 1.1 · ID khớp V242.
- [ ] **1.3 `expo-iap` + paywall 3.1.2 + bật `PAYWALL_ENABLED` iOS** 🔴 *(B-1, C-1)* — 3.5–5d · phụ thuộc 1.1, 1.2
  - `mobile/lib/paywall.ts` hiện `PAYWALL_ENABLED = Platform.OS !== 'ios'`; wire `lib/iap.ts` (dùng `expo-iap`, **KHÔNG** RevenueCat).
  - Paywall: `displayPrice`, kỳ hạn, Restore, links Terms/Privacy, quản lý gói.
  - ⚠️ New-Arch/Fabric — verify purchase trên device dev-build.
  - DoD: sandbox mua → `/verify` → `isPro` flip → gate mở; restore OK; interrupted purchase drain OK.
- [ ] **1.4 Paywall wall cho free** *(B-2, B-4)* — 2–3d · phụ thuộc 1.3
  - Interceptor mobile map 429 `type=quota-exceeded` → modal **tiếng Việt** + CTA upgrade (hiện là Alert thô tiếng Anh); pre-gate entry AI (speaking/exam) theo entitlement; web pre-gate tương tự.
  - DoD: free chạm AI thấy paywall (không alert thô), PostHog track wall-hit.
- [ ] **1.5 AdMob non-personalized** *(C-1)* — 1.5–2.5d · chung 1 native build với 1.3
  - `react-native-google-mobile-ads` 16.x, `FreeBanner` gate `isPro`, chỉ màn free không nhạy cảm, **không ATT**.
- [ ] **1.6 Test đường tiền** *(A5-5, A5-6)* — 2d · phụ thuộc 1.1
  - IT HTTP `/api/payments/apple/*` + `AppleServerNotificationService` test + MockMvc SePay Apikey 200/401/replay.
- [ ] **1.7 SePay web-PRO "gói N ngày" cho student** *(C-3, A3b-5)* — 4–6d · song song
  - `backend/…/payment/service/SepayWebhookService.java` hiện chỉ settle **org-invoice**; mở rộng match student-topup (mã `DFSTU-…`) → `SubscriptionActivationService.activateWithExplicitEnd`.
  - ⚠️ Bắt buộc idempotent + underpay-guard như org-invoice (đối soát tiền lệch nếu match code lỏng).
  - DoD: chuyển khoản thật (test 10k) kích hoạt PRO đúng N ngày.
- [ ] **1.8 Production build + submit v1.1** — 1–2d · phụ thuộc 1.3–1.5
  - 1 build duy nhất (fingerprint đổi 1 lần) + App Privacy labels (KHÔNG khai Sentry). DoD: v1.1 Waiting for Review.

---

## 🛡️ PHASE 2 — Ổn định nền tảng & scale (P1, tháng 8, ≈ 12–15 ngày)

- [ ] **2.1 Làm `main` xanh lại** *(A5-1 🔴, A5-2)* — 1.5d — fix `QuotaExceededHandlerIntegrationTest` (endpoint ma) + 2 IT isolation; định nghĩa property `skipUnitTests`.
- [ ] **2.2 Coverage gate 3 tầng + Playwright + `next build` vào CI** *(A5-3, A5-4, A6-9)* — 2d.
- [ ] **2.3 Monitoring có thật** *(A6-3, A6-4, C-2)* — 1.5d — sửa Prometheus target `deutschflow-backend:8080`, bind 127.0.0.1, verify Alertmanager→Telegram, alert marker `[OVERAGE]`.
- [ ] **2.4 k6 baseline + tuning hot-path** *(A4-1..A4-4)* — 2–3d — chạy `scripts/loadtest/` vs staging; `GROQ_SEMAPHORE_ACQUIRE_SEC` 90→15; breaker cho Groq streaming; `sync=true` + TTL L2 riêng cho cache nóng.
- [ ] **2.5 Contract hardening** *(A1-1..A1-4)* — 3–4d — DTO-hóa 3 endpoint skill-tree mobile + `openapi-typescript` FE/mobile + ArchUnit freeze (cấm cycle mới + bắt buộc tenant-guard).
- [ ] **2.6 NĐ13 bổ sung** *(A3b-3, A3b-4)* — 1.5d — checkbox tuổi/consent khi đăng ký + purge PostHog khi xóa account + verify encryption-at-rest (2 lệnh AWS CLI).
- [ ] **2.7 Deploy an toàn + rollback** *(A6-5, A6-7)* — 1.5–2d — giữ container cũ đến khi GREEN healthy + đường rollback + đưa deploy vào GitHub Actions (hết bus-factor 1).
- [ ] **2.8 Chốt cây UI v2, xóa v1** *(A2-1)* — 3–4d (dần) — v2 Galerie làm chuẩn → xóa dần cây v1 (97 file/18k dòng).

---

## 🧑‍💼 PHASE 3 — HR/Payroll owner-side (P2, tháng 8–9, ≈ 16–20 ngày) — SAU submit

Thứ tự phụ thuộc: **3.0 → F4 → F2 → F5 → F3**, F1 độc lập.

- [ ] **3.0 Tiền đề** — 0.5–1d — ArchUnit tenant-rule (2.5) + UNIQUE `(class_id, day_of_week)` (A7-6) / `(class_id, session_date)` (A7-7); dedupe trước khi tính công/lương.
- [ ] **3.1 F4 Chấm công** — 4–5d — package `com.deutschflow.hr` mới: `work_shifts` (sinh tự động từ `class_sessions` V236 cho TEACHER) + `attendance_records` (append-only). **TÁCH HẲN** `ClassAttendance` (điểm danh học viên) và `payment` (doanh thu).
- [ ] **3.2 F2 QR check-in** — 3–4d — QR động HMAC-SHA256 + TTL 60–90s + jti one-time; danh tính = JWT người quét; **V1 quét bằng WEB** (getUserMedia + jsQR) để né EAS build mới; nhánh riêng cho lớp ONLINE (D-12).
- [ ] **3.3 F5 Điểm chuyên cần** — 1.5–2d — aggregate `attendance_records` → score %, materialize vào `payroll_lines` lúc LOCK kỳ; KHÔNG dùng XP học viên (D-8).
- [ ] **3.4 F3 Lương + thông báo** — 4–5d — `staff_pay_rates` snapshot + `pay_periods` OPEN→LOCKED→NOTIFIED→PAID; notification = thêm enum `PAYROLL_READY/PAID`. Ranh giới cứng: `hr.*` **không FK** vào `org_invoices`/`payment_transactions` (D-6).
- [ ] **3.5 F1 Tuyển dụng consent-based** — 3–4d — 🔴 **THAY THẾ crawler**: form ứng tuyển public + upload CV → `DocumentParsingService` + Gemini extraction → candidate pool trên nền `TeacherProfile`.

---

## 🧭 GHI CHÚ PHÁT HIỆN TRONG SESSION NÀY (bổ sung/đính chính audit)

- **Delete-account rộng hơn báo cáo:** ngoài `messages.sender_id` + `class_channel_messages.sender_id`, còn thiếu **`messages.recipient_id`** và `class_channel_messages.deleted_by`. Ngoài ra nhiều bảng teacher/org (V227 materials, V204 org, V4/V5 quiz/skill `created_by ON DELETE RESTRICT`) cũng non-cascading — nếu user bị xóa là TEACHER/ADMIN sẽ fail. → Cân nhắc **scope endpoint chỉ cho learner** hoặc quét toàn bộ FK.
- **Branch protection `main`:** xác nhận ĐANG OFF (`gh api … 404 Branch not protected`).
- **`day_of_week` CHECK:** xác nhận `V236:9` = `BETWEEN 0 AND 6` (comment "0=Mon…6=Sun"), lệch với V240 ISO 1–7 → Chủ nhật fail.

## 📎 Cập nhật tri thức nội bộ (docs/memory lỗi thời — đã ghi trong audit)
- Đã vá nhưng docs còn ghi mở: P-15/S-8, P-16, PAY-1, deploy-script auto-commit, "no ShedLock", "CI chết vì billing".
- SAI: "delete-account DONE (verified)" — lỗi thời sau merge P6 (V241).
- README ghi SM-2 → thực tế **FSRS-4.5**; `docs/DATABASE_SCHEMA.md` mô tả MySQL (sai, đang Postgres).
