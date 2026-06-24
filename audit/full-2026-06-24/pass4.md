# PASS 4 — SCALE, HIỆU NĂNG & MÔ HÌNH DỮ LIỆU (trục C + D)

> file:dòng + CONFIRMED/SUSPECTED. ID MỚI đánh tiếp để **không trùng** prior: scale `S-7+` (S-1..S-6 cũ là issue ĐÃ SỬA), data `D-8+` (D-1..D-7 đã dùng), over-eng `O-4+`. Mỗi mục: mức / công (S giờ, M ngày, L tuần) / "đúng cho N, vỡ ở M".

---

## 0. Xác minh fix scale cũ (đọc lại, không tin)

| Fix cũ | Trạng thái hiện tại | Bằng chứng |
|---|---|---|
| S-1 SSE ticket Redis | ✅ FIXED (fallback in-mem khi Redis down) | `SseTicketService.java:74-117` Lua atomic GET+DEL |
| S-2 loadUserByUsername cache | ✅ FIXED | `JwtAuthFilter.java:38-41,141` Caffeine 60s/10k |
| S-3 org pool counter table | ✅ FIXED | `OrgQuotaService.java:31-40` PK lookup; tăng atomic `AiUsageLedgerService.java:54-64` |
| S-4 reconcile off hot-path | ✅ FIXED | `SubscriptionReconcileJob.java:31` cron 10' (⚠ no lock → S-7) |
| S-5 LLM async | ⚠ MỘT PHẦN | grading/stream/gemini async; **/api/ai/*, grade-image, public free-grade vẫn sync** → S-8 |
| S-6 SessionTurnGuard Redis | ✅ FIXED (fallback) | `SessionTurnGuard.java:48-57` setIfAbsent 30s |
| O-3 NotificationRateLimiter | ⚠ VẪN in-memory | `NotificationRateLimiterService.java:33` ConcurrentHashMap |

---

## 1. VỠ KHI SCALE (trục C)

### S-7 🔴 — 15 `@Scheduled` job KHÔNG có distributed lock → double-fire đa-node | M | đúng cho 1 node, vỡ ở 2+ node / cửa sổ blue-green
ShedLock **không** trong `pom.xml`. Mọi job fire trên MỌI node. `DataRetentionJob.java:21-23` tự ghi chú thiếu lock mà chưa thêm. Tác hại 2 node:
- `DailyNotificationJob.java:39` **double-send** REVIEW_DUE/STREAK; dedup `:86-91` `SELECT COUNT(*) … >= CURRENT_DATE` là TOCTOU race (không có unique constraint).
- `ScheduledBroadcastJob.java:30` double-send broadcast; `SubscriptionReconcileJob.java:31` double subscription transition; `DataRetentionJob.java:54` double DELETE; Glosbe/Wiktionary/LlmVi/Fsrs/SessionCleanup double external-API spend.
- **An toàn**: `AiJobWorker.java:39` dùng `FOR UPDATE SKIP LOCKED` (`AiJobRepository.java:24`) ✅; `ApiTelemetryService.java:70` flush buffer per-node (đúng).
**CONFIRMED.** Fix: thêm ShedLock (JDBC table) cho mọi job trừ AiJobWorker/Telemetry; + unique index `(recipient,type,date)` cho DailyNotification.

### S-8 🔴 — LLM đồng bộ giữ thread Tomcat; tệ nhất: public endpoint giữ cả Hikari connection trong lúc gọi LLM | M | OK lúc tải thấp, **pool-exhaustion với 1 burst 20 request, ngay ở 1 node**
1. **`LeadMagnetService.gradeFree` `:62-105` là `@Transactional` + gọi `gradingService.gradeGermanEssay()` SYNC (Groq) tại `:105`** → **giữ 1 Hikari connection suốt lời gọi LLM**, trên endpoint **public unauth** (`PublicLeadMagnetController`). 20 request đồng thời = 20/20 connection (pool max=20) treo trên Groq → **tái hiện P0 DB-pool cũ, tự gây**. Chỉ chặn bằng global 200/ngày, không chặn concurrency burst.
2. `/api/ai/*` (`AIController.java:36-133`) + `grade-image` (`GradingController.java:116-140`, Gemini OCR 45s **rồi** Groq 70B) chạy sync trên thread Tomcat (max=48). ~48 user AI đồng thời → cạn pool, login/dashboard xếp sau `accept-count=30` → 503.
**CONFIRMED.** Fix: (a) **ưu tiên cao nhất** — đưa lời gọi LLM RA NGOÀI `@Transactional` trong `gradeFree` (mở txn chỉ để save sau khi LLM trả). (b) `/api/ai/*` + grade-image trả `202 + jobId` qua `AiJobWorker`. (c) per-IP concurrency gate cho free-grade.

### S-9 🟠 (= O-3 tail) — NotificationRateLimiter in-memory là nguồn-sự-thật | S | đúng 1 node, vỡ 2+ node
`NotificationRateLimiterService.java:33` ConcurrentHashMap, không backing → N node = N× budget; key per `(userId|category)` chỉ prune khi chạm lại → rò bộ nhớ user đã rời. Fix: chuyển Redis sliding-window như auth limiter.

### S-10 🟠 — N+1 trong analytics teacher/org (~150 query/request, giữ connection) | M | đúng lớp ~10 HV, vỡ ở 30-50+
`TeacherService.getClassAnalytics:432-442`: `for studentId → xpService.getSummary(studentId)` (mỗi call **4 query**: `XpService.java:187,194,195,200`, gồm `achievementRepository.findAll()` lặp lại vô ích) + `for → grammarErrorRepository.findTop20…`. Lớp 30 HV ≈ 150 query trong 1 readOnly txn giữ 1 Hikari connection. Cũng: `getClassStudents:399-416`, `ClassScheduleService.java:263`, `TeacherReportService.java:54-58`.
**CONFIRMED.** Fix: batch `WHERE user_id IN (:ids) GROUP BY`, hoist `findAll()` ra ngoài loop. (Tích cực: `OrgService.listMembers/getClassDetail` + `GradingService` đã batch đúng.)

### S-11 🟡 — Aggregate hot-path thiếu index trên bảng event đang phình | S | đúng lúc bảng nhỏ, vỡ khi event lên 100k+ (retention giữ 90-180 ngày)
- `student_assignments(student_id,status,created_at)` — chỉ index `(student_id)` (`StudentAssignmentRepository.java:18-35`).
- XP leaderboard full-table `GROUP BY user_id ORDER BY SUM` (`UserXpEventRepository.java:56-63`) — không index nào cứu full aggregate.
- `ai_speaking_sessions(user_id,status,started_at)` — index chỉ `(user_id,status)` (V64), `started_at` không phủ.
**CONFIRMED+SUSPECTED.** Fix: 2 composite index; leaderboard → cache/rollup `user_xp_totals`.

### S-12 🟡 — Tỉ lệ Tomcat:Hikari 48:20; blue-green peak 40 conn | S | OK ≤2 node SAU khi sửa S-8/S-10, vỡ 3+ node
48 thread tranh 20 connection (`application.yml:79,180`), conn-timeout 5s → P0 cũ. 48:20 cố ý (SSE/speaking không đụng DB) nhưng **chỉ an toàn khi S-8 (#1) và S-10 không giữ connection**. RDS t4g.micro ~112 max, blue-green 2 instance×20=40 + ~13 reserve → trần `nodes × pool ≤ ~90`. Fix: giữ 20, sửa S-8/S-10 trước; >2 node thì giảm pool/nâng RDS.

---

## 2. MÔ HÌNH DỮ LIỆU (trục D)

### D-8 🟠 — Bảng nghiệp vụ cốt lõi THIẾU `org_id` → cách ly tenant không có nền DB | L | đúng khi authz query luôn join đúng, vỡ khi 1 query quên join
`class_students`, `class_assignments`, `student_assignments` (`V134:33`), `class_lessons`, `class_lesson_logs` **không có `org_id`** — cách ly dữ liệu nhạy nhất (ai trong lớp nào, bài nộp, điểm) hoàn toàn dựa join qua `teacher_classes.org_id` ở tầng app; **DB không chặn được** cross-tenant (không cột, không FK, không RLS). HIGH cho sản phẩm B2B. (Chấp nhận được: `payment_transactions`/`user_subscriptions`/`cefr_certificates` thiếu org_id vì là B2C/per-user.)
**CONFIRMED.** Fix: thêm `org_id` denormalized (backfill từ class) vào 3 bảng class/assignment + cân nhắc Postgres RLS làm nền cứng; hoặc test cạn kiệt filter tenant tầng app. (D-2/V223 đã thêm org_id cho `ai_token_usage_events`+`ai_speaking_sessions` ✅.)

### D-9 🟠 — `class_students` & `class_assignments` KHÔNG có foreign key | S | luôn đúng tới khi có orphan
`V133:12-17` chỉ composite PK `(class_id, student_id)`, **không FK** `class_id→teacher_classes`, không `student_id→users`. → enrollment mồ côi (trỏ lớp/HV đã xoá) khả thi ở DB. Trái với `student_assignments` (`V134:43` có `fk_sa_assignment ON DELETE CASCADE`). **CONFIRMED** — lỗ integrity cụ thể nhất. Fix: thêm FK (verify không có orphan trước).

### D-10 🟡 — `migration-local/R__seed_demo_users_local.sql` repeatable mồ côi = súng đã lên đạn | S | vô hại tới khi `flyway.locations` đụng tới
Repeatable seed `student@/teacher@/admin@deutschflow.com` với `ON CONFLICT (email) DO UPDATE SET password_hash` (`:32-37`). Hiện **không profile nào load** (`application.yml:108` chỉ `classpath:db/migration`, không có `application-local.yml`). Nếu tương lai thêm `db/migration-local` vào `flyway.locations` → **reset mật khẩu mọi prod account trùng email mỗi deploy**. **SUSPECTED config gap.** Fix: xoá file, hoặc CI assert `migration-local` không bao giờ vào `flyway.locations` prod.

### D-11 🟡 — `repair-before-migrate` mặc định TRUE → tự sửa checksum, che giấu sửa migration đã apply | S
`application.yml:224` `${APP_FLYWAY_REPAIR_BEFORE_MIGRATE:true}` — comment bảo prod set `false` nhưng **default true**; nếu env không set, Flyway auto-repair mỗi boot → sửa nhầm migration đã chạy không fail to. **CONFIRMED (default), SUSPECTED prod.** Fix: verify prod set `APP_FLYWAY_REPAIR_BEFORE_MIGRATE=false`; đổi default thành false.

### D-12 🟡 — Cột enum-VARCHAR phần lớn không CHECK → status typo insert âm thầm | M
56 cột enum-ish, chỉ ~14 có CHECK. Thiếu CHECK: `users.role VARCHAR(64)` (V1:10), `payment_transactions.provider/status` (V129:25-26), `user_subscriptions.status` (V38:16), `org_invoices.status` (V206:8). Typo `'Suceess'` insert sạch → vỡ state-machine query. **CONFIRMED.** Fix: thêm CHECK / Postgres enum cho payment/subscription/invoice/role status.

### D-13 🟡 — Trộn timestamp tz: 200 `TIMESTAMP` naive vs 97 `TIMESTAMPTZ` | L | bug `AT TIME ZONE` tiềm ẩn
Bảng org mới dùng TIMESTAMPTZ, core/cũ dùng naive (`payment_transactions`, `student_assignments`, `refresh_tokens`). Counter backfill đã `AT TIME ZONE 'Asia/Ho_Chi_Minh'` → so sánh naive↔aware sai tinh vi. **CONFIRMED.** Fix: chuẩn hoá cột mới = TIMESTAMPTZ; document; ngừng thêm naive.

### D-14 ⚪ — `student_assignments.student_id` không FK tới users (orphan submission) | S. `V134:36` NOT NULL nhưng không FK. Fix: thêm FK.
### D-15 ⚪ — `refresh_tokens` không index `user_id`/`expires_at` (revoke-all / sweep full scan) | S. Fix: index `(user_id)` + partial `(expires_at) WHERE NOT revoked`.

**Migration health**: 237 file V1–V238, **0 trùng version**, 1 gap (V221, cố ý), out-of-order=false ✅, ~34% là content/seed migration (bootstrap phình; `ai_speaking_sessions` **40 ALTER** churn). Two-source tenant (`users.org_id` vs `org_members`): drift **không** xảy ra qua app (removeMember clear `users.org_id` `OrgMembershipService.java:178-182`) nhưng **không có nền DB** (chỉ app-code). Money = BIGINT minor-units ✅. Index hot-path phần lớn ĐÃ CÓ ✅.

---

## 3. OVER-ENGINEERED / DEAD CODE (trục D)

### Dead code (xoá được ngay) | đều S
- **O-4 ⚪** `speaking/RateLimiterService.java:26` — Redis limiter **0 caller**, trùng `AiRateLimiterService`. Xoá.
- **O-5 ⚪** `curriculum/WhisperApiClient.java:23` — STT **chết**, đã thay bằng `GroqWhisperClient`. Xoá + config `app.openai.whisper-base-url` stale.
- **O-6 ⚪** cụm noun-declension chết (5 symbol: `GrammarDeclinationService`/`WordDeclensionRepository`/`WordDeclension`/2 DTO) + bảng `word_declensions`. Xoá (cần migration drop bảng).
- **O-7 ⚪** `teacher/TemplateBasedPptxService.java:30` (207 dòng) orphan; live dùng `GoogleSlidesService`. Xoá.
- **O-8 ⚪** 5 DTO không dùng (gồm `ErrorDetectionRequest/Result` tàn dư). Xoá.
- **O-9 ⚪** 5 script `main()` không wiring (`util/GoetheWiktionaryDeepEnricher.java` 1162 dòng…) phình artifact. Chuyển `scripts/` hoặc xoá.
> 0 `@Deprecated`, 0 block comment-out — sạch trên 2 trục đó.

### Trùng lặp / quyết định
- **O-10 🟡** 2 endpoint AI-grade trùng hành vi: `GradingController.java:87` vs `TeacherController.java:250`. Giữ 1 (GradingController), FE trỏ lại. | S
- **O-12 🟡 SUSPECTED (cần quyết định deploy)** — Python `AIModelService` (`:8000`) phục vụ `/api/ai/*` + grammar/vocabulary AI tools, FE có bind (`aiToolsApi.ts`), **nhưng `deploy-backend.sh` chỉ health-check TTS `:5050`, không check `:8000`** → nhiều khả năng Python server **không deploy prod** → các tool đó dark/circuit-breaker-tripped. **Liên hệ P-17/P-18**: nếu Python server self-hosted/không-deploy thì P-17/P-18 ít là "rò tiền", nhiều là "feature chết + mù COGS nếu CÓ deploy". **Phải quyết**: deploy Python server, hoặc bỏ `AIModelService`+4 controller và chuyển feature sang đường Groq/Bedrock đã có. | M
- **O-11** chat-client dual abstraction (Local vs Groq) **earning keep** (2 impl thật, prod=Groq) — không động.
- **O-15 🟡 (= O-2 tail)** `QuotaService` `buildSnapshot`/`buildSnapshotReadOnly` 2 bản ~80 dòng song sinh (`:154-235` vs `:290-369`) phải đồng bộ tay. Extract `boolean persist`. | M

### God-class (refactor backlog, không gấp) | đều L
| File | Dòng | Verdict |
|---|---|---|
| `admin/AdminManagementService.java` | 1500 | GOD-CLASS (21 dep) → tách AdminUser/PlanQuota/AiCost/Quality |
| `user/TheoryBasedExerciseGenerator.java` | 1116 | DRY violation (~10 cặp `xMc`/`gateXMc`) |
| `curriculum/SkillTreeService.java` | 1054 | GOD-CLASS → tách Pronunciation/InterviewAnalysis |
| `admin/AdminManagementController.java` | 980 | GOD-CLASS (~45 endpoint) → tách AdminVocabulary/Reports |
| `common/quota/QuotaService.java` | 671 | cohesive nhưng có O-15 |

---

## 4. Nợ kỹ thuật lớn nhất + chi phí nếu hoãn

1. **S-7 (ShedLock)** — *chặn scale-out hoàn toàn*. Không sửa thì không thể chạy >1 node (kể cả blue-green chồng lấn đã double-send/double-charge). Hoãn = không thể mở rộng theo số center.
2. **S-8 (#1 LeadMagnet @Transactional+LLM)** — *rủi ro P0 ngay ở 1 node*: 1 kẻ spam public endpoint → cạn DB pool → sập toàn site. Hoãn = lặp lại sự cố prod đã từng xảy ra.
3. **D-8 (org_id floor)** — *nợ kiến trúc tenant*: càng nhiều center, 1 query quên join = rò dữ liệu HV cross-tenant; sửa muộn tốn (backfill + RLS + test toàn bộ). Hoãn rẻ về tiền nhưng đắt về rủi ro pháp lý/uy tín B2B.

---

## Danh sách file đã đọc để kiểm chứng (Pass 4)
```
scale: SseTicketService, JwtAuthFilter, OrgQuotaService, AiUsageLedgerService, SubscriptionReconcileJob,
  DataRetentionJob, DailyNotificationJob, ScheduledBroadcastJob, SessionCleanupJob, FsrsWeightOptimizerService,
  AiJobWorker(+Repository), ApiTelemetryService, NotificationRateLimiterService, AsyncConfig, application.yml(threads/hikari/ai),
  AIController, LeadMagnetService, GradingController, HandwritingOcrService, TeacherService, XpService,
  ClassScheduleService, TeacherReportService, StudentAssignmentRepository, UserXpEventRepository, AiSpeakingSessionRepository
data: db/migration/ (ls/grep 237 file; V1,V38,V42,V58,V64,V122,V129,V133,V134,V197,V204,V206,V214,V222,V223,V227),
  migration-local/R__seed_demo_users_local.sql, scripts/check-flyway-repeatables.sh, User.java, OrgMembershipService, OrgBillingService
over-eng: RateLimiterService, WhisperApiClient, GrammarDeclinationService(+repo/entity/2 dto), TemplateBasedPptxService,
  5 unused DTO, util/*.java (5 script), GradingController vs TeacherController, AIModelService, AiChatClientFactory,
  ImageGenerationProvider, AiSpeakingService, QuotaService; deploy-backend.sh, frontend/src/lib/aiToolsApi.ts
```

**Tóm tắt Pass 4**: Fix scale cũ (S-1..S-6) **thật**. NHƯNG 2 nợ scale nghiêm trọng MỚI: **S-7 (no ShedLock → chặn multi-node)** và **S-8 (public LLM-in-transaction → P0 1-node)**. Data model: nền tenant yếu (**D-8 thiếu org_id**, **D-9 thiếu FK**) + footgun (D-10 seed, D-11 repair-default, D-12 CHECK, D-13 tz). Dead code dọn được ~10 symbol; **O-12 (Python AI server) cần quyết định deploy** (ảnh hưởng P-17/P-18).
