# PASS 3 — BẢO MẬT & CÁCH LY TENANT (trục A) + TOKEN-POOL ENFORCEMENT (trục B)

> Enumerate đầy đủ, không lấy mẫu. file:dòng + CONFIRMED/SUSPECTED. ID: `P-`(token-pool, tiếp P-14), `T-`(tenant, tiếp T-5), `SEC-`(security chung), `PAY-`(payment).

---

## PHẦN A — TENANT ISOLATION

### A.1 Cơ chế thực tế (đọc từ code)
Single-DB column-based. `orgId` **luôn lấy từ principal**, **không nhận từ client** trên `/api/org/**` (`OrgController.java:40`); authz org re-verify ở DB qua `OrgGuard` (`assertOrgAdmin`=OWNER/MANAGER, `assertOrgOwner`/`assertOrgFinance`=OWNER) đọc `org_members` — **không tin JWT `orgRole`**. → **Tenant lấy từ TOKEN, không từ input người dùng.** (CONFIRMED)

### A.2 Cross-tenant / IDOR — kết luận: surface RỘNG sạch, 1 lỗ MEDIUM
- 48 endpoint teacher/grading + 47 endpoint student: mọi `{classId}/{assignmentId}/{submissionId}/{sessionId}/{userId}` đều re-verify ownership/enrollment qua `assertTeacherOwnsClass` (`TeacherService.java:596-600`, throw `ForbiddenException`) hoặc `findByStudentIdAndAssignmentId`. Child-id resolve parent→class→owner trước khi mutate (vd `ClassScheduleService.java:135-138`, `GradingController.java:92-102`, `ClassLessonService.java:145-151`). **0 IDOR.** (CONFIRMED). Commit `a31063fc`/`d39205e0` (đóng G-2 join + materials/cert IDOR) **thật & đủ**; `POST /api/classes/join` nay `hasRole('STUDENT')` (`ClassController.java:27-28`).
- Messaging: `assertCanMessage` re-verify lớp chung 2 chiều ở `send`+`getThread` (`MessageService.java:124-132`); `markRead` bỏ check nhưng SQL self-scoped `WHERE recipientId=:me` (`MessageRepository.java:25-29`) → an toàn.
- `/api/public/**`: 4 controller dùng **UUID token entropy cao** không enumerable (invitation `findByTokenAndStatus`, certificate `findByVerifyToken`, lead-magnet `findByShareToken` lưu không-PII) → an toàn.

- **T-6 🟡 (MỚI)** — **Liệt kê media + rò metadata cross-tenant không cần auth.** `GET /api/v2/media/{id}` `permitAll` (`SecurityConfig.java:90`) → `MediaController.java:79-83` → `MediaAssetService.getMediaById` `:100-103` fetch PK trần, **bảng `media_assets` không có cột tenant**, id tuần tự (IDENTITY). Ẩn danh duyệt `/1,2,3…` thu `s3Key`, URL CDN, tên file gốc, `uploadedById/Name` của MỌI asset toàn hệ thống. Hôm nay chưa chứa bài nộp/handwriting riêng tư (in-memory) nên MEDIUM — nhưng chỉ cách HIGH 1 thay đổi routing. `GET /api/v2/media/by-tag` `:89` cùng lỗ. Fix: bỏ blanket permitAll, authorize hoặc allowlist category public.
- **D-7 ⚪ (MỚI, data-integrity)** — `LessonLogService.buildAttendance` `:127-138` ghi `attendance[].studentId` từ body không verify thuộc roster lớp; parent log đã owner-check nên không cross-teacher, chỉ rác trong lớp của chính teacher. Fix: `existsByIdClassIdAndIdStudentId`.

### A.3 Role model — khai báo vs thực thi
`User.Role` = {STUDENT, TEACHER, MANAGER, OWNER, ADMIN} (`User.java:123`), authorities `ROLE_<name>` (`:84`), **không kế thừa**. `@PreAuthorize` chỉ tham chiếu STUDENT/TEACHER/ADMIN (grep toàn bộ) — **MANAGER/OWNER không có trong bất kỳ `@PreAuthorize`** → enforce qua `OrgGuard` (DB, `org_members`). 2 trục tách biệt (cố ý, PR #152). **Không** có role string typo (always-deny/allow). GUEST (`JwtAuthFilter.java:104-118`) chỉ `ROLE_GUEST`, không endpoint nào cấp quyền → **inert** (path duy nhất `/api/quiz/*/join` không có controller). Không có endpoint STUDENT mutate dữ liệu teacher/org.

- **SEC-3 ⚪ (MỚI)** — permitAll **stale** `/api/quiz/*/join` (`SecurityConfig.java:76`) trỏ controller không tồn tại (quiz đã gỡ) — footgun tiềm ẩn nếu sau này thêm route `/api/quiz/*`. Fix: xoá dòng.

**Ma trận role (mutate gì):** STUDENT→profile/SRS/progress/submit-bài-đã-enroll/join-lớp(PENDING); TEACHER→chỉ lớp sở hữu; MANAGER→org-scope own-org (invite/import/remove member, xem analytics) **không** finance/đổi-role; OWNER→+finance+đổi-role own-org; ADMIN→platform-wide; GUEST→≈anonymous.

---

## PHẦN B — TOKEN-POOL: BẢNG ĐẦY ĐỦ CALL-SITE LLM/TTS/STT/IMAGE

> Egress enumerate đủ (kiểm completeness ở cuối). Gate A=`assertAllowed`, B=`OrgPoolGuard`; Ledger=`AiUsageLedgerService.record`(LLM) / `recordStt`(STT, không debit token).

### B.1 GATED+LEDGER (đúng chuẩn) — không liệt kê hết, gồm:
Speaking chat blocking+stream (`ChatCompletionService.java:60`/`SpeakingStreamService.java:171`, gate `ChatPrepService.java:312`, ledger `TurnSideEffectsService.java:95`), STT transcribe (`AiSessionController.java:104-118`), conversation/interview report eval (`ConversationEvaluationService.java:64-71`, `InterviewEvaluationService.java:62-69`), AI helpers 6-endpoint (`AISpeakingController.java:54-138`), weekly speaking, correctWriting (`SkillTreeController.java:236-265`), satellite/practice async (gate sync pre-dispatch + ledger trong worker), mock-exam Sprechen/Schreiben (`MockExamController.java:181-182` + `AiExamEvaluatorService.java:55,179`), video listening (`VideoLessonController.java:89-90`), pronunciation STT+LLM (`SkillTreeController.java:194-200`). → P-1..P-8 cũ phần lớn đã được vá đúng. ✅

### B.2 UNGATED / LEDGER-MISSING — profit leak (MỚI)

| ID | Mức | Entry | Egress | Pre-gate | Ledger | file:dòng |
|---|---|---|---|---|---|---|
| **P-15** | 🔴 | `PublicLeadMagnetController.gradeFree` (PUBLIC) | Groq grade | NONE (chỉ IP 3/24h + global 200/24h) | NONE | LeadMagnetService.java:105 → GradingService.gradeGermanEssay:303 |
| **P-16** | 🔴 | `AiImageGenerationController.generate` (TEACHER/ADMIN) | Bedrock Stable Image, loop `count×` | NONE | NONE | BedrockImageGenerationProvider.java:41; AiImageGenerationService.java:29 |
| **P-17** | 🟠 | `AIController` 6 ep + `AIGrammarController` | Python AI server (`AIModelService`) | NONE (chỉ rate-limit `requireTextBudget`) | NONE | AIController.java:36-142; ai/AIModelService.java:45-207 |
| **P-18** | 🟠 | `AIVocabularyController` 7 ep | `AIModelService.generate` | NONE (không cả rate-limit) | NONE | AIVocabularyController.java:34; AIVocabularyService |
| **P-19** | 🟠 | `endSession`→`autoGradeSession` (async) | Groq | NONE | record `:156` | TeacherAiGradingService.java:32,71,156 |
| **P-20** | 🟡 | greeting tạo session | chatCompletion | gate có | NONE | AiSpeakingServiceImpl.java:305 |
| **P-21** | 🟡 | onboarding mock-exam + Sprechen Teil2 | Groq (2 call/turn) | gate có (`:227-228`) | NONE | AiSpeakingMockExamController.java:101; SprechenTeil2Service.java:134,159 |
| **P-22** | 🟡 | PPTX + grade-image (Gemini) | Gemini | gate B+FreeTier | NONE (Gemini không trả usage) | TeacherMaterialController.java:74; HandwritingOcrService.java:61 |
| **P-23** | 🟡 | grammar syllabus generate | `AIModelService.generate` 4096tok | gate A+B (`:82-83`) | NONE | GrammarSyllabusService.java:150 |
| **P-24** | 🟡 | prefetch/triggerAllPracticeNodes (fire-forget) | chatCompletion | gate chạy SAU runAsync (post-dispatch) | record có | SkillTreeService.java:515-517; PracticeNodeService.java:72-79 |
| **P-25** | 🟡 | `AiJobController.submitPronunciationEval` enqueue | Whisper STT | NONE pre-gate | recordStt `:108` | AiJobController.java:38; AiJobWorker.java:108 |
| **P-26** | ⚪ | RAG embedding mỗi chat turn | OpenAI embeddings | (parent gated) | NONE | EmbeddingClient; ChatPrepService.java:289 |
| **P-27** | ⚪ | `TtsController` | EdgeTTS/XTTS | NONE | NONE (TTS không metered) | EdgeTtsService.java:35; XttsStreamClient |

### B.3 Kết luận profit leak
- **Org-pool KHÔNG mù với đường ungated nếu đường đó ghi ledger** — nhưng các đường ở B.2 (đặc biệt P-15/P-16/P-17/P-18/P-19/P-22) **không ghi ledger** → org pool + admin COGS **mù hoàn toàn** với chúng. Đây là rò lợi nhuận thật, MỚI so với audit cũ (tập trung ở module mới: marketing, aiimage, ai/grammar/vocabulary generic).
- **P-15** nghiêm trọng nhất: **public + unauth + unledgered**, chỉ chặn bằng IP 3/24h + global 200/24h hardcode — bất kỳ ai trên internet đốt Groq, vô hình.
- **P-16**: `count` không bị gate giới hạn → 1 request = `count`× Bedrock Stable Image (egress đắt nhất).
- **P-17/P-18 caveat**: severity phụ thuộc **Python AI server (`AIModelService`) backing là gì** — nếu self-hosted GPU thì chi phí biên ≈0 (chỉ mù COGS + abuse-DoS); nếu proxy tới API trả tiền thì là rò tiền trực tiếp. **SUSPECTED về backing.** Dù sao: endpoint authed không quota = abuse vector; không ledger = mù COGS.
- Soft-cap (P-9) vẫn áp cho đường gated; org-pool atomic (counter V224) nhưng wallet cá nhân check-then-debit non-atomic.

### B.4 Egress enumerate (completeness)
`AIModelService` (Python `/generate,/translate,/grammar`), `LocalAiChatClient`/`GroqChatClient` (chat, provider switch), `GeminiApiClient` (OCR/PPTX), `BedrockImageGenerationProvider` (image), `GroqWhisperClient`+`WhisperApiClient` (STT), `EmbeddingClient` (embeddings), `EdgeTtsService`+`XttsStreamClient` (TTS), `DeepLTranslationService` (dịch trả phí, không LLM). `NewsService`=RSS, không AI. → `chatCompletion` interface tới từ 30 call-site (đã liệt kê); `AIModelService.generate` thêm cụm AIController/Vocabulary/Grammar/Syllabus.

---

## PHẦN C — BẢO MẬT CHUNG

### C.1 Secrets/config — CONFIRMED không có secret thật bị tracked
Grep `sk_live|gsk_|AKIA|AIza|BEGIN PRIVATE KEY|password=` trong `backend/src/main` = **0**. Mọi secret dùng `${ENV:}` default rỗng (fail-safe) hoặc bắt buộc (DB_PASSWORD không default → fail-fast). `.env`/`.env.local` gitignored; chỉ `.env.example`/`.env.production.example` tracked (xác nhận `git ls-files`). `deutschflow-key.pem` **không** tracked (gitignored `.gitignore:157`), chỉ tồn tại working-tree (vệ sinh op).

**Bảng default đáng chú ý:**
| Var | Default | Phân loại |
|---|---|---|
| JWT_SECRET | rỗng | fail-safe (HS256 throw nếu rỗng/<32B, `JwtService.java:69-75`) |
| MOMO_SECRET_KEY/ACCESS_KEY | **`dummy`** | placeholder **NGUY HIỂM** → PAY-1 |
| STRIPE/SEPAY/GROQ/GEMINI/OPENAI/DEEPL keys | rỗng | fail-safe (webhook fail-closed) |
| app.jwt.secret (test) | `test-secret-…` | test-scoped, vô hại |

- **PAY-1 🟠 (xác minh trực tiếp, giải mâu thuẫn 2 agent)** — **MoMo IPN KHÔNG fail-closed với secret `dummy`.** `@PostConstruct` `MomoPaymentService.java:70-78` chỉ `log.warn` khi key rỗng/`dummy` — **KHÔNG** disable. `handleIpn:171` gọi `verifyIpnSignature` vô điều kiện → nếu deploy chưa cấu hình MoMo (`MOMO_SECRET_KEY=dummy`), kẻ tấn công biết key `"dummy"` tạo HMAC hợp lệ; chỉ cần 1 orderId PENDING (createOrder authed, row lưu trước cả khi gọi API MoMo `:116`) + amount khớp → IPN giả → SUCCESS → kích hoạt subscription free. **HIGH có điều kiện** (deploy chưa cấu hình MoMo). Fix: trong `handleIpn` reject khi secret rỗng/`dummy`.
- **SEC-15 ⚪ (MỚI)** — comment `MomoPaymentService.java:75-76`: "old public sandbox keys… remain in git history" → **secret MoMo sandbox từng commit vào git history**. Fix: xác nhận đã rotate; cân nhắc `git filter-repo` nếu là key thật.

### C.2 JWT
HS256 mặc định (`application.yml:244`), secret từ env (rỗng→throw startup; <32B→throw `:69` → không có default yếu cho phép forgery). RS256 verify-both hỗ trợ. Alg pinned (jjwt 0.12 reject `none`; HS↔RS mismatch → exception). `exp` enforce; `iss` enforce khi `require-iss-aud=true` (default **false** `:239`).
- **SEC-5 ⚪ (MỚI)** — **`aud` KHÔNG bao giờ validate** kể cả `require-iss-aud=true`: `JwtService.java:198-201` chỉ `requireIssuer`, audience là comment trống. Control không làm đúng tên. Fix: `pb.require(Claims.AUDIENCE, audience)`.
- **AUTH-2/SEC-1 (carry)** — HS256 symmetric: verify-key = sign-key → ai có verify key (vd edge/middleware) forge được token. RS256 chưa mặc định. (đã nêu Pass 2 AUTH-2.)

### C.3 CORS
`WebConfig.java:19-42`: origins = env `CORS_ALLOWED_ORIGINS` (prod: domain thật) **+ hardcode** `capacitor://localhost, ionic://localhost, http://localhost`; `allowCredentials(true)`; headers `*`. Không wildcard (Spring cấm `*`+credentials).
- **SEC-4 🟡 (MỚI)** — `allowCredentials(true)` + **`http://localhost` luôn trong allow-list** (`WebConfig.java:19-42`). App/tool độc hại chạy `http://localhost` thành origin credentialed tin cậy → đọc response đã auth. Capacitor/ionic origins là rác (đã bỏ Capacitor, `next.config.mjs:6`). Fix: bỏ `http://localhost` (+ capacitor/ionic) khỏi prod; chỉ bật ở local profile.

### C.4 Rate-limit & Actuator
2 limiter Redis-backed (Lua sorted-set) + fallback in-memory: `AuthRateLimiterService` (login 5/60s, register 10/600s, refresh 10/60s, forgot/reset 5/900s — **register CÓ phủ**); `AiRateLimiterService` (TRANSCRIBE/PHONEME/CHAT/EVAL/REPORT/TEXT, wired AIController/AIGrammar/Phoneme/MockExam/AiSession). **KHÔNG phủ**: payment webhook (→ PAY-2 Pass 2), generic AI ungated (P-17/P-18). Actuator: expose `health,info,prometheus,metrics`; prod `prometheus`+`env`+`metrics` ADMIN-gated, `health` permitAll show-details when_authorized; **không** heapdump/threaddump/loggers/env lộ. → **Actuator prod an toàn** (CONFIRMED).

### C.5 Injection — CONFIRMED SẠCH
Không có SQL/JPQL ghép chuỗi từ input. Mọi giá trị user → `?`/`:param` (JdbcTemplate varargs, named). Dynamic WHERE/IN/LIKE đều bind qua args (`AuditLogService`). 3 chỗ ghép chuỗi (`DemoDataFilter.java:75`, `DataRetentionJob.java:70-72`, `AccountDeletionService.java:38`) chỉ nội suy **giá trị nội bộ** (ID từ DB / hằng call-site), an toàn. Path traversal: **không** (mọi `getOriginalFilename()` chỉ lấy extension/label; key S3 = UUID). Native deser / Jackson polymorphism: **không**.

### C.6 SSRF — 2 lỗ
- **SEC-6 🟠 (MỚI)** — `/{wordId}/approve` vocab image fetch **không guard host**: `VocabularyImageReviewService.java:73-74` → `VocabularyImageGeneratorService.java:133` `URI.create(imageUrl).toURL().openStream()`, `imageUrl` từ client (ADMIN). Endpoint anh em `/unsplash` CÓ `requireUnsplashHost` (`VocabularyImageAdminController.java:78`) — `approve` thiếu. ADMIN-gated (giảm), nhưng confused-deputy/CSRF + hit `169.254.169.254`/RFC1918, bytes re-upload S3. Fix: centralize allowlist trong `generateFromUrl`.
- **SEC-7 🟡 (MỚI)** — stored→fetch: `image_url` ghi không-validate (`VocabularyImageService.java:49`, TEACHER/ADMIN `/override`) → video renderer fetch sau (`VideoRenderService.java:248` openStream). Blind SSRF. Fix: validate host khi ghi + ở renderer.

### C.7 Upload S3
Global cap 10MB (`application.yml:186-188`). Presign **không nhận key từ client** — key server-derived theo userId (`StudentAssignmentController.java:98-99`, `TeacherController.java:141-142`) → **không cross-tenant IDOR**. GET-presign DB-stored access-checked (`MaterialService.java:244` `assertCanAccess`).
- **SEC-8 🟠 (MỚI, CRITICAL-leaning)** — `POST /api/media/upload` (`MediaController.java:31-40`) **zero validation**, **bất kỳ user authed (kể cả STUDENT)**, content-type tin client, ghi **bucket public-read** (`S3StorageService.java:49`) → stored XSS (upload `text/html`) + open file host. Bypass allowlist của v2. Fix: route qua `MediaAssetService.uploadMedia` hoặc xoá endpoint.
- **SEC-9 🟠 (MỚI)** — `image/svg+xml` trong allowlist media public (`MaterialService` chặn SVG — bất nhất) → SVG `<script>` = stored XSS bucket public. Fix: bỏ SVG/sanitize.
- **SEC-10 🟡 (MỚI)** — materials dùng **denylist MIME có null-bypass** (`MaterialService.java:61-63` `if(mime!=null && BLOCKED…)`) — bỏ content-type → qua. Fix: chuyển allowlist, reject null.
- **SEC-11 🟡 (MỚI)** — `PronunciationController.java:29-43` + `SkillTreeController.java:186-199` nhận audio **không allowlist + chỉ cap 10MB global** (khác `/transcribe` dùng `TranscribeUploads` allowlist+8MB) → đẩy blob 10MB non-audio vào Whisper/Gemini. Fix: dùng `TranscribeUploads`.
- **SEC-12 ⚪ (MỚI)** — extension filename client ghép vào key S3 (`S3StorageService.java:38-43`) — không traversal (body key=UUID) nhưng segment extension chưa sanitize. Fix: `[A-Za-z0-9]{1,8}`.
- **SEC-13 ⚪ SUSPECTED** — `AiImageGenerationService.java:62-63` key prefix từ `preset/style` chưa rõ enum-validate. Fix: allowlist.

### C.8 XXE
- **SEC-14 🟡 (MỚI)** — `NewsService.java:72-74` `DocumentBuilderFactory` parse RSS remote **không tắt DTD/external-entity**. Feed hardcode (cần MITM/upstream độc) → MEDIUM. Fix: `disallow-doctype-decl`+`FEATURE_SECURE_PROCESSING`. POI/PDFBox parse upload — an toàn (giữ patch).

### C.9 Client bundle
Chỉ `NEXT_PUBLIC_*` (BACKEND_URL/CLOUDFRONT/POSTHOG publishable/SENTRY_DSN/AI_CHAT_PROVIDER) ship browser — **không** secret key. (CONFIRMED an toàn). Note: prod CSP `next.config.mjs:29` dùng `script-src 'self' 'unsafe-inline' https:` (nới do Amplify CDN bypass nonce) — hardening riêng.

---

## Danh sách file đã đọc để kiểm chứng (Pass 3)
```
(enumerate B): AIModelService, AIController, AIGrammarController, AIVocabularyController/Service,
  LocalAiChatClient, GroqChatClient, GeminiApiClient, BedrockImageGenerationProvider, AiImageGenerationService/Controller,
  GroqWhisperClient, WhisperApiClient, EmbeddingClient, EdgeTtsService, XttsStreamClient, NewsService,
  GradingService, LeadMagnetService, PublicLeadMagnetController, TeacherAiGradingService, SkillTreeService/Controller,
  PracticeNodeService, AiJobController/Worker, ChatPrepService, TurnSideEffectsService, SpeakingStreamService,
  VideoLessonService, GrammarSyllabusService, AiSpeakingMockExamController, SprechenTeil2Service, AiSpeakingServiceImpl
(A tenant): SecurityConfig, OrgController, OrgGuard, TeacherService, GradingController, ClassController,
  ClassScheduleService, ClassLessonService, LessonLogService, MessageService/Controller/Repository,
  MediaController, MediaAssetService(+Dto), Public*Controller (invitation/cert/grade/leadmagnet), User.java
(C security): MomoPaymentService (đọc trực tiếp :60-189), application.yml(secrets/actuator/cors/ratelimit),
  JwtService, WebConfig, AuthRateLimiterService, AiRateLimiterService,
  VocabularyImageReviewService/GeneratorService/AdminController/Service, VideoRenderService,
  S3StorageService, MaterialService, PronunciationController, StudentAssignmentController, TeacherController,
  AuditLogService, DemoDataFilter, DataRetentionJob, AccountDeletionService, frontend/.env.example, next.config.mjs
```

**Tóm tắt Pass 3**: Tenant isolation RỘNG **sạch** (orgId từ principal, OrgGuard DB, IDOR đã đóng) — 1 lỗ T-6 (media unauth). Token-pool: đường gated cũ OK, nhưng **13 đường mới ungated/un-ledgered** (P-15..P-27) ở module mới = rò tiền + mù COGS, nặng nhất **P-15 (public+unauth)** và **P-16 (Bedrock image)**. Security chung: không injection, không secret tracked, actuator prod OK; nhưng **PAY-1 (MoMo dummy)**, **SEC-6 (SSRF approve)**, **SEC-8 (upload public bucket)**, **SEC-9 (SVG XSS)**, **SEC-4 (CORS localhost)**, **SEC-14 (XXE RSS)** là các lỗ thật cần xử.
