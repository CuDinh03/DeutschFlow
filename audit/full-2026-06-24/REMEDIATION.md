# REMEDIATION — HỢP NHẤT (audit toàn hệ thống 2026-06-24)

> Hợp nhất Pass 1–6. ID truy vết: `P-`(token-pool), `PAY-`(payment), `AUTH-`(auth/session), `ORG-`(org logic), `T-`(tenant), `S-`(scale), `D-`(data/migration), `O-`(over-eng/dead), `SEC-`(security chung), `FE-`(web), `MOB-`(mobile), `INF-`(infra/CI). Loại: **Khắc phục** (đang hỏng/rủi ro) / **Nâng cấp** (chạy được nhưng nên cải thiện). Công: S=giờ, M=ngày, L=tuần.

---

## 1. TÌNH TRẠNG DỰ ÁN (thẳng thắn)

DeutschFlow **an toàn ở quy mô hiện tại** (1 node EC2 t3.medium + RDS t4g.micro, một nhúm center): cách ly tenant tầng app **lành mạnh** (orgId luôn từ principal, OrgGuard re-verify DB, IDOR đã đóng — Pass 3A/L4), 3/4 payment webhook **chắc** (Stripe/Apple/SePay verify chữ ký + idempotent + amount-check), mobile/iOS là surface **chắc nhất** (SecureStore, ATS, no secret), và **gần như toàn bộ finding audit cũ (P-1..P-8/P-11, S-1..S-6, T-1/4/5, D-1..D-4, M-1/M-3, H, I, J, E/P-6) đã được vá thật** (đã verify lại từng dòng).

**Vỡ trước ở đâu — TIỀN, rồi VẬN HÀNH:**
1. **Rò lợi nhuận + mù COGS** ở cụm AI **mới** chưa từng được audit: `P-15` (chấm bài free **public + unauth + unledgered**), `P-16` (sinh ảnh Bedrock unbounded), `P-17/P-18` (AI tools generic), + 8 đường ledger-gap. Org pool & báo cáo chi phí **mù** với các đường này.
2. **Tự gây DoS DB-pool** (`S-8`): chính endpoint public `gradeFree` mở `@Transactional` quanh lời gọi Groq → 1 burst spam = cạn 20 connection = **sập toàn site**, đúng sự cố P0 đã từng xảy ra.
3. **Vận hành mù**: alert DB-pool hậu-P0 **gần như không fire** trong prod (`INF-1`+`INF-11`).
4. **Chưa scale-out được**: `S-7` (15 job không ShedLock → double-fire khi >1 node / blue-green chồng lấn) + nền tenant DB yếu (`D-8` thiếu org_id, `D-9` thiếu FK).

**Ngưỡng center:** đủ cho hiện tại. **Trước khi nhận thêm center trả tiền** → phải xong Đợt 1 (chặn rò tiền + DoS public + bật lại alert). **Trước khi scale >1 node** → Đợt 2 (ShedLock + org_id floor + token storage).

---

## 2. BẢNG ƯU TIÊN TỔNG

### 🔴 Nghiêm trọng
| ID | Vấn đề | Loại | Công | file:dòng | Thời điểm |
|---|---|---|---|---|---|
| P-15 / S-8 | `gradeFree` public: ungated+unledgered (rò tiền) **VÀ** `@Transactional` quanh LLM (cạn DB-pool 1 burst) | Khắc phục | S | LeadMagnetService.java:62-105 → GradingService.gradeGermanEssay:303 | **Ngay** |
| P-16 | Sinh ảnh AI ungated+unledgered, `count` không chặn (Bedrock đắt) | Khắc phục | S | BedrockImageGenerationProvider.java:41; AiImageGenerationService.java:29 | **Ngay** |
| INF-1+INF-11 | Prometheus scrape actuator không auth ↔ prod ADMIN-gate → không metric → **alert DB-pool (P0) chết** | Khắc phục | S | prometheus.yml:21-24; SecurityConfig.java:107; alert.rules.yml:13 | **Ngay** |
| S-7 | 15 `@Scheduled` không ShedLock → double-send/charge/cleanup đa-node | Khắc phục | M | DataRetentionJob.java:21; DailyNotificationJob.java:39 | Trước scale |

### 🟠 Cao
| ID | Vấn đề | Loại | Công | file:dòng | Thời điểm |
|---|---|---|---|---|---|
| PAY-1 | MoMo IPN HMAC secret `"dummy"`, không fail-closed (forge khi prod chưa cấu hình MoMo) | Khắc phục | S | MomoPaymentService.java:70-78,171 | **Ngay** |
| D-5 | Plan `is_active=false`/thiếu → user trả tiền tụt DEFAULT 0 token im lặng (INNER JOIN) | Khắc phục | S | QuotaService.java:531,157,370 | **Ngay** |
| P-14 | Org-pool bỏ qua `pool_unlimited`; pool=0=unlimited (M-5 reopen) | Khắc phục | S | OrgQuotaService.java:86-88 | **Ngay** |
| P-12 | Stream cancel/timeout bỏ debit = Groq miễn phí | Khắc phục | M | SpeakingStreamService.java:272-273; GroqChatClient.java:196 | **Ngay** |
| SEC-8 | `POST /api/media/upload` zero-validation, any-user, bucket public → stored XSS/open host | Khắc phục | S | MediaController.java:31-40; S3StorageService.java:49 | **Ngay** |
| SEC-6 | SSRF: `/approve` vocab image fetch không guard host | Khắc phục | S | VocabularyImageReviewService.java:73; VocabularyImageGeneratorService.java:133 | **Ngay** |
| SEC-9 | SVG trong allowlist media public → stored XSS | Khắc phục | S | MaterialService.java/MediaAssetService.java:34 | **Ngay** |
| AUTH-1 | OTP reset không revoke session | Khắc phục | S | PasswordResetService.java:106-109 | **Ngay** |
| FE-2 | Middleware fail-open khi thiếu verifier env | Khắc phục | S | middleware.ts:269-279 | **Ngay** |
| FE-6 | Zustand persist ghi JWT+PII vào localStorage (org/accept) | Khắc phục | S | useUserStore.ts:28-48; org/accept:86 | **Ngay** |
| INF-2 | `/actuator/*` reachable từ internet (nginx) | Khắc phục | S | deutschflow.nginx.conf:80-81 | **Ngay** |
| P-17 | AIController/AIGrammar ungated+unledgered (phụ thuộc O-12) | Khắc phục | M | AIController.java:36-142 | **Ngay**/decision |
| P-18 | AIVocabulary ungated+unledgered+no-ratelimit | Khắc phục | S | AIVocabularyController.java:34 | **Ngay** |
| P-19 | Teacher auto-grade session-end không pre-gate | Khắc phục | S | TeacherAiGradingService.java:32,71 | Trước scale |
| ORG-1 | Seat-limit không ở chokepoint; admin-add race no-FOR-UPDATE no-constraint | Khắc phục | M | OrgMembershipService.java:55; AdminOrgService.java:233 | Trước scale |
| AUTH-2 | Access token không thu hồi (STATELESS no deny-list) | Nâng cấp | M | SecurityConfig.java:50; JwtAuthFilter.java:38-41 | Trước scale |
| S-9 | NotificationRateLimiter in-memory (N× budget đa-node) | Khắc phục | S | NotificationRateLimiterService.java:33 | Trước scale |
| S-10 | N+1 analytics teacher (~150 query/request giữ connection) | Khắc phục | M | TeacherService.java:432-442; XpService.java | Trước scale |
| D-8 | Bảng class/assignment thiếu `org_id` → không nền cứng tenant | Khắc phục | L | V133/V134; student_assignments | Trước scale |
| D-9 | `class_students`/`class_assignments` không FK (orphan) | Khắc phục | S | V133:12-26 | Trước scale |
| PAY-2 | Webhook không rate-limit (DoS → DB-pool) | Khắc phục | S | /api/payments/** | Trước scale |
| FE-3 | Layout role không re-check server-side | Nâng cấp | M | app/v2/admin/layout.tsx:5; RoleShell.tsx:48 | Trước scale |
| FE-5 | Access token sessionStorage + cookie non-HttpOnly | Nâng cấp | M | authSession.ts:154,159 | Trước scale |
| FE-19 | E2E auth FAKESIGNATURE, middleware untested | Nâng cấp | S | tests/e2e/auth.spec.ts:15 | Trước scale |
| INF-3 | Image hạ tầng `:latest` không pin | Nâng cấp | S | docker-compose.prod.yml:104,123,165 | Trước scale |

### 🟡 Trung bình (rút gọn — chi tiết ở các pass)
| ID | Vấn đề | Công | Thời điểm |
|---|---|---|---|
| T-6 | Media `GET /api/v2/media/{id}` unauth enumeration cross-tenant metadata | S | Trước scale |
| SEC-4 | CORS `allowCredentials`+`http://localhost` | S | Trước scale |
| SEC-5 | JWT `aud` không validate khi require-iss-aud | S | Backlog |
| SEC-7 | SSRF stored image_url→video renderer | S | Trước scale |
| SEC-10 | Materials MIME denylist null-bypass | S | Trước scale |
| SEC-11 | 2 audio endpoint không allowlist/cap | S | Trước scale |
| SEC-14 | RSS XXE chưa hardened | S | Backlog |
| SEC-15 | MoMo sandbox key trong git history (rotate) | S | **Ngay** (rotate) |
| PAY-3 | Stripe tin metadata planCode không so amount | S | Trước scale |
| P-13/P-20..P-26 | Ledger-gap/under-count (greeting, PPTX/Gemini, mock-exam, prefetch, STT enqueue, embeddings) | M | Trước scale |
| D-6 | ULTRA seed mong manh (chỉ V189) | S | Backlog |
| D-10 | `migration-local` repeatable seed = súng lên đạn | S | Trước scale |
| D-11/INF-5 | `repair-before-migrate` default true | S | **Ngay** (set env) |
| D-12 | enum-VARCHAR thiếu CHECK | M | Backlog |
| D-13 | trộn TIMESTAMP/TIMESTAMPTZ | L | Backlog |
| O-10/O-12/O-15 | dup AI-grade endpoint / Python AI server deploy-decision / QuotaService twin | M | Trước scale (O-12 decision) |
| S-11/S-12 | index aggregate event tables / Tomcat:Hikari 48:20 | S | Trước scale |
| AUTH-3/4/5 | login revoke-all / register enumeration / forgot-reset budget chung | S | Backlog |
| FE-9/14/15/18/20 | invite-token URL / PremiumGate DOM / bundle split / intl fallback / e2e money | S-M | Backlog |
| INF-6/7/9/10 | deploy push+reset / cleanup-exit1 / observability port phơi / promtail no-scrub | S | Trước scale |
| INF-CI | thiếu `permissions:` + action không SHA-pin; SAST/deps report-only | S | Trước scale |
| SEC-2 | Admin god-mode reset password không notify | S | Backlog |

### ⚪ Thấp / dọn dẹp
AUTH-6 (refresh plaintext), AUTH-7 (PII log), AUTH-8 (findByEmail footgun), SEC-3 (stale quiz matcher), SEC-12 (filename ext key), SEC-13 (image preset key SUSPECTED), D-7 (attendance studentId), D-14/D-15 (FK/index refresh_tokens), P-27 (TTS unmetered), ORG-2/3/4/5, MOB-1..4, **O-4..O-9 (dead code: RateLimiterService, WhisperApiClient, declension cluster, TemplateBasedPptxService, 5 DTO, 5 util script — xoá được ~đв).** → Backlog.

---

## 3. KHẮC PHỤC (đang hỏng/rủi ro) — nhóm theo mức

**🔴 P-15/S-8 (cùng endpoint `gradeFree`):** triệu chứng → public chấm bài đốt Groq vô hình + giữ Hikari connection suốt LLM. Vì sao nguy → vừa rò tiền/mù COGS vừa **1 kẻ spam = sập DB-pool toàn site** (lặp P0). Hướng → (1) đưa lời gọi LLM RA NGOÀI `@Transactional` (mở txn chỉ để save); (2) per-IP concurrency gate + đếm/ghi ledger có attribution; (3) cân nhắc async 202+jobId.

**🔴 P-16:** sinh ảnh Bedrock loop `count×` không gate/ledger/clamp. → thêm `assertAllowed`+`OrgPoolGuard`+ledger + clamp `count` (max nhỏ).

**🔴 INF-1+INF-11:** Prometheus không scrape được metric prod (ADMIN-gate) → alert DB-pool chết. → thêm credential scrape hoặc expose `/actuator/prometheus` nội-bộ-network permitAll; verify `hikaricp_connections_pending` query được.

**🔴 S-7:** 15 job double-fire đa-node. → thêm ShedLock (JDBC table) cho mọi job trừ AiJobWorker/Telemetry; unique index dedup cho DailyNotification.

**🟠 (Ngay, rẻ):** PAY-1 (reject IPN khi secret rỗng/`dummy` trong `handleIpn`) · D-5 (LEFT JOIN/loud log thay vì giả DEFAULT) · P-14 (`OrgQuotaService` đọc `pool_unlimited`) · SEC-8 (route media upload qua allowlist hoặc xoá) · SEC-6 (centralize `requireUnsplashHost` trong `generateFromUrl`) · SEC-9 (bỏ SVG public) · AUTH-1 (revoke session sau reset) · FE-2 (build-guard authoritative + runtime alert) · FE-6 (`partialize` bỏ token/PII) · INF-2 (`location /actuator/ deny`) · SEC-15 (rotate MoMo key) · D-11 (set `APP_FLYWAY_REPAIR_BEFORE_MIGRATE=false`).

**🟠 (Trước scale):** P-12 (reserve/ghi token khi cancel) · P-17/P-18/P-19 (gate+ledger; P-17 chờ O-12) · ORG-1 (gate+lock vào `upsertMember`) · AUTH-2 (Redis deny-list) · S-9 (Redis limiter) · S-10 (batch query) · D-8 (org_id + RLS) · D-9 (thêm FK) · PAY-2 (rate-limit webhook).

---

## 4. NÂNG CẤP (chạy được nhưng nên cải thiện)
FE-3/FE-5 (lớp authz dự phòng + token storage) · FE-19 (test reject authz) · INF-3 (pin image) · O-4..O-9 (xoá dead code) · O-10/O-15 (gộp dup) · O-12 (quyết định Python AI server deploy/retire) · S-11/S-12 (index + sizing) · D-12/D-13 (CHECK + tz convention) · INF-CI (`permissions:`+SHA-pin) · god-class refactor (AdminManagementService 1500, SkillTreeService 1054…) · FE-17 (i18n v2).

---

## 5. LỘ TRÌNH

**Đợt 1 — Chặn rò rỉ + DoS + mù-vận-hành (LÀM TRƯỚC khi nhận thêm center trả tiền).** Hầu hết là S (giờ):
P-15/S-8, P-16, PAY-1, D-5, P-14, P-18, SEC-8, SEC-6, SEC-9, AUTH-1, FE-2, FE-6, INF-1, INF-11, INF-2, D-11, SEC-15. (+ quyết O-12 để chốt P-17.)

**Đợt 2 — Trước khi scale (>1 node / nhiều center).**
S-7 (ShedLock), AUTH-2, ORG-1, S-9, S-10, D-8, D-9, P-12, P-19, P-20..P-26 (ledger-gap), PAY-2, PAY-3, FE-3, FE-5, FE-19, INF-3, INF-6/7/9/10, INF-CI, S-11/S-12, D-10, T-6, SEC-4/7/10/11, dọn dead code O-4..O-9.

**Đợt 3 — Backlog.**
God-class refactor, FE-17 i18n v2, FE-9/14/15/18, D-12/D-13/D-6, SEC-2/5/14, AUTH-3..8, ORG-2..5, MOB-1..4, SEC-3/12/13, P-27, IaC hoá hạ tầng + RDS backup as-code.

---

## 6. ĐÃ DONE TỪ AUDIT CŨ (verify còn fixed — KHÔNG báo lại)
P-1..P-8, P-11 (gate+ledger các đường cũ) · S-1 (SSE Redis) · S-2 (loadUser cache) · S-3 (org counter V224) · S-4 (reconcile job) · S-5 (LLM async một phần) · S-6 (SessionTurnGuard Redis) · T-1/D-1/M-2 (org_members nguồn tenant) · D-2 (org_id event tables V223) · T-4 (IDOR org) · T-5/D-4 (ACCOUNTANT/finance) · M-1 (exceptionHandling dup) · M-3 (timezone VN) · E/P-6 (catch nuốt) · H (attachOwner atomic) · I (auto-demote) · J/K (roster seat lock — **chỉ roster**, admin-add vẫn hở → ORG-1) · O-3 một phần (3/4 limiter Redis; còn Notification → S-9).
**Reopen/partial:** M-5→P-14 (flag chỉ FreeTierGuard), M-4/P-10 (counter atomic nhưng OrgPoolGuard vẫn check-only — P-9 soft-cap còn nguyên), J→ORG-1 (admin path).

---

## 7. CẦN XÁC MINH THÊM (chưa truy hết / phụ thuộc runtime)
1. **Prod profile** — INF-1/INF-11/PAY-1 đều giả định prod chạy KHÔNG profile `local/dev/test` (mọi tín hiệu khớp nhưng profile active không pin trong file tracked). Verify `SPRING_PROFILES_ACTIVE` prod.
2. **MoMo cấu hình prod** — PAY-1 chỉ là HIGH nếu `MOMO_SECRET_KEY=dummy` (chưa cấu hình). Verify env prod.
3. **Python AI server (`:8000`)** — O-12/P-17/P-18: có deploy prod không? Nếu không → feature `/api/ai/*` dark + P-17/P-18 ít là rò tiền hơn. Verify deploy.
4. **`AI_CHAT_PROVIDER` prod** — P-13 (usage=null) chỉ bite khi `groq`; verify.
5. **EC2 security group** — INF-9: port observability (3001/9090/9093/3100) có mở internet không? Không trong repo.
6. **RDS backup/PITR** — không as-code; verify snapshot tự động bật.
7. **`subscription_plans.is_active` prod** — D-5: có plan nào đang `is_active=false` mà còn user ACTIVE trỏ tới? Query prod.
8. **`pg_advisory_xact_lock` + P-9 soft-cap** — mức over-spend thực tế dưới tải đồng thời chưa đo (chỉ phân tích code).

---

## 8. PHƯƠNG PHÁP & ĐỘ TIN CẬY
- **Đã đọc/verify:** ~200+ file backend (controller/service/repo/entity + 30+ migration), `frontend/src` (middleware/auth/api/stores/v2), `mobile/` + `ios/`, `docker/` (compose/nginx/prometheus/promtail/loki/alertmanager), `.github/workflows/` (4), `deploy-backend.sh`/`cleanup-deploy.sh`, `application.yml`, `pom.xml`. Token-pool: **enumerate đủ** egress LLM/TTS/STT/image (không lấy mẫu) — completeness check ở Pass 3 B.4.
- **Tự verify mâu thuẫn:** đọc trực tiếp `MomoPaymentService.java:70-78` để giải mâu thuẫn 2 agent về PAY-1 (kết: chỉ log.warn, KHÔNG fail-closed → PAY-1 đứng vững). Sửa nhận định Pass 1 M-6 (ULTRA CÓ seed ở V189, không phải "không seed").
- **Độ tự tin từng trục:** Tenant/authz **Cao** (truy nhiều đường, IDOR proven safe bằng dòng check). Token-pool/profit **Cao** (enumerate đủ egress). Payment **Cao** (đọc cả 4 cổng + chokepoint). Scale **Cao-Trung** (phân tích code chắc; mức over-spend/bundle size chưa đo runtime). Data/migration **Cao** (bash phân tích 237 file). Infra **Trung-Cao** (config trong repo chắc; SG/backup/profile prod nằm ngoài repo → mục §7).
- **Giới hạn:** không chạy app/test/load; không truy cập prod DB/env; suy luận runtime đánh dấu SUSPECTED. Mọi finding 🔴/🟠 đều có `file:dòng` đã đọc.

---

**Một câu:** Sản phẩm vững về cách-ly-tenant và đã vá sạch audit cũ, nhưng **cụm AI mới (marketing/aiimage/ai-tools) rò tiền + mù COGS**, một endpoint **public có thể tự sập DB**, và **alert hậu-P0 đang chết** — ba thứ này (Đợt 1) phải xong trước khi nhận thêm center; ShedLock + nền tenant DB (Đợt 2) trước khi scale node.
