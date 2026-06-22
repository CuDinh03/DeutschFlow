# DeutschFlow — Backlog Checklist

> **Nguồn:** [DEEP_REVIEW_2026-06-06.md](DEEP_REVIEW_2026-06-06.md) (PHẦN II — Backlog hợp nhất)
> **Cập nhật:** 2026-06-07 — sau khi ship #57–#67. **2026-06-22:** +P0-15 (default-cred prod) sau khi deploy #146–#149 (prod `61cf0104`, V228→V232 live).
> **Cách dùng:** tick `[x]` khi xong. Mỗi mục có vị trí file + effort: **XS** <1h · **S** nửa ngày · **M** 1–2 ngày · **L** 3+ ngày.
> Mục đã xong ghi kèm PR đóng nó (để biết phần nào KHÔNG cần làm lại).

---

## Tổng quan tiến độ

| Nhóm | ✅ Xong | ⚠️ Một phần | ❌ Chưa | Ghi chú |
|---|:--:|:--:|:--:|---|
| **P0** (chặn release) | 13 | 0 | 3 | P0-3b/P0-11 = external; **P0-15 default-cred prod = security gấp** |
| **P1** (sửa trong tháng) | 6 | 2 | 9 | Nhóm đáng làm tiếp |
| **P2 / P3** (bền vững) | 1 | 1 | ~17 | Nợ dài hạn, không chặn |

---

## 🔴 P0 — Chặn release

- [x] **P0-1** SQL injection — parameterize + whitelist enum · `AdminManagementController.java:758` — **#57**
- [x] **P0-2** Stripe webhook bypass khi secret rỗng → throw/503 · `StripePaymentService.java:143` — **#57** _(đuôi: advisory lock chống double-activate đồng thời — chưa, gộp vào P1 nếu cần)_
- [x] **P0-3** MoMo secret hardcode → env-only + xoá khỏi scripts · `MomoPaymentService.java` + 2 script — **#57**
- [ ] **P0-3b** ⚠️ **EXTERNAL — ROTATE MoMo key** với nhà cung cấp (key sandbox cũ còn trong git history) · **XS**
- [x] **P0-4** IDOR phỏng vấn → ownership check · `InterviewController.java:50,61,68,78` — **#57**
- [x] **P0-5** IDOR scenario bài tập → ownership check · `StudentAssignmentController.java:147` — **#57**
- [x] **P0-6** 500 leak → errorId + log server-side · `GlobalExceptionHandler.java:140` — **#57**
- [x] **P0-7** CSP enforce — qua `next.config.mjs headers()` (middleware không chạy trên Amplify) + **#67** sửa middleware chạy thật (move `src/middleware.ts`) · `frontend/next.config.mjs`, `frontend/src/middleware.ts` — **#66 + #67**
- [x] **P0-8** Tự-báo-cáo điểm → chấm server-side · `SkillTreeService.java`, `PracticeNodeService.java` — **#57**
- [x] **P0-9** a11y khoá zoom + `[DF_TRACE]` log lộ token + 3 logout no-op · frontend — **#58**
- [x] **P0-10** `NEXT_PUBLIC_API_URL` không khai báo (gãy 8 file) → `NEXT_PUBLIC_BACKEND_URL` — **#58**
- [ ] **P0-11** ⚠️ **EXTERNAL — `eas init`** lấy projectId thật (chặn build/push mobile) · `mobile/app.json:65` · **XS** (cần tài khoản Expo của bạn)
- [x] **P0-12** `userRepository.findAll()` broadcast OOM → `findByActiveTrue()`/`findAllById()` · `UserNotificationService.java:615` — **#57**
- [x] **P0-13** Thiếu FK (8 cột) → `V196` thêm FK + dọn orphan · migrations — **#66**, đã deploy
- [x] **P0-14** deploy auto-commit `--no-verify` → abort khi cây bẩn · `deploy-backend.sh:177` — **#66**, đã deploy
- [ ] **P0-15** ⚠️ **Default-cred prod còn sống (SECURITY, gấp)** — `teacher@`/`student@deutschflow.com` đăng nhập prod được bằng `password123` (verify 2026-06-22; `admin@` đã đổi, 2 account này CHƯA). Hash nằm trong migration seed `V7/V8/V48/V50` (công khai trong repo → ai cũng đoán được). → **đổi/khoá 2 account trên prod NGAY** + soạn migration rotate/disable default-cred + chuyển seed demo sang `db/migration-local` (chỉ local) · `db/migration/V48__reinsert_default_admin.sql`, `V50__restore_demo_student_teacher.sql` · **S**

---

## 🟠 P1 — Sửa trong tháng

### ✅ Đã xong
- [x] **P1-1** Phase engine đứt + nối mock-exam → graduation · `PhaseEngineService`, `MockExamController` — **#57**
- [x] **P1-2** Streak gãy cho skill-tree (đọc sai bảng) · `XpService.java:352` — **#57**
- [x] **P1-3** N+1 `checkAchievements` (31–35 query/lần) → Set + `@Cacheable` + saveAll · `XpService.java` — **#57**
- [x] **P1-9** a11y mobile — `Card`/`ListRow`/`AppHeader` + `IconButton` · `mobile/components/ui/*` — **#61**
- [x] **P1-10** Mic-permission dead-end → check + `Linking.openSettings()` · `mobile/.../speaking.tsx` — **#62**
- [x] **P1-12** Error/loading boundary web + reduced-motion + Modal a11y · `frontend/src/app/**` — **#64**

### ⚠️ Mới một phần
- [ ] **P1-15** Rate-limit AI/transcribe — _đã làm endpoint Whisper transcribe (#63)_; **còn:** `/api/speaking/ai/*`, `/api/ai/*`, `/api/vocabulary/ai/*`, phoneme + **validate upload** (content-type/size) · `AiSessionController.java:85` · **M**
- [ ] **P1-17** Test P0 — _đã có `XpServiceLevelTest` (#65)_; **còn:** `MomoPaymentServiceTest` (HMAC+idempotency) + chuyển `AiSpeakingServiceImplUnitTest` sang test **hành vi** · `backend/src/test/**` · **M**

### ❌ Chưa làm
- [ ] **P1-4** Redis L2 vô hiệu → `CompositeCacheManager` (Caffeine L1 + Redis L2) cho skillTree/achievements/curriculum/ttsAudio · `RedisConfig.java:41` · **M**
- [ ] **P1-5** Ảnh web `unoptimized:true` áp cả SSR → gate `isMobileBuild`; `<img>`→`<Image>` · `frontend/next.config.mjs:30` · **S**
- [~] **P1-6** Một phần (PR #113 stability): đã thêm timeout HTTP + tách `@Transactional` + telemetry async (cầm máu pool). CÒN: `maximum-pool-size` vẫn =20 (`application.yml:72`) — bump 20→30 đang **gated trên nâng RDS RAM** (RECOVERY Đợt 2.1: t4g.micro→small). · **S**
- [x] **P1-7** ✅ ĐÃ TÁCH (phát hiện 2026-06-13) — `AiSpeakingServiceImpl` nay **664 dòng** (was 1.444); tách ra ~25 service (`GrammarPersistenceService`, `TurnEvaluatorService`, `ChatPrepService`, `ChatCompletionService`, `ReviewSchedulerService`, `ErrorDetectionService`…). Vượt blueprint "5 service". · **L**
- [x] **P1-8** ✅ ĐÃ XỬ LÝ (phát hiện 2026-06-13, đã sửa từ trước) — logic tách sang `GrammarPersistenceService.java`; cả 2 catch (structured + legacy) ghi `speakingMetrics.recordGrammarPersistFailure(...)` + `log.error` đủ ngữ cảnh (userId/sessionId/messageId/errorCode/wrong/corrected + stack). Chủ đích **KHÔNG rethrow** (lượt nói live không được 500 vì lỗi persist feedback) → observable (metric/alert) + recoverable (log). *Line ref cũ `:1147,1325` đã lỗi thời.* · **S**
- [ ] **P1-11** IAP mobile — backend đủ; wire `react-native-iap` (verify/sync/restore/fetchPlan) HOẶC ẩn paywall iOS · `mobile/app/(student)/upgrade.tsx` · **L / XS**
- [ ] **P1-13** `TIMESTAMP`→`TIMESTAMPTZ` trên `user_subscriptions`/`payment_transactions`/`ai_token_usage_events` (biên quota ngày VN sai TZ) · migrations · **M**
- [ ] **P1-14** XP lost-update (duplicate level-up) → atomic `user_xp_summary` / advisory lock; **enum thay VARCHAR** cho `PaymentTransaction.status`… · `XpService`, entities · **M**
- [ ] **P1-16** Observability — **deploy** Prometheus/Grafana/Loki (alert rules đã viết) **hoặc xoá** config chết; thêm error tracking backend · `docker-compose.prod.yml`, `deploy-backend.sh` · **M**

---

## 🟡 P2 / 🟢 P3 — Bền vững (không chặn)

- [x] **P2-5** 7 index thiếu (`review_queue`, `user_notifications(type)`, skill-tree dep composite…) — `V195` — **#59**
- [ ] **P2-6** _RS256 đã hoàn tất_; **còn:** bỏ `?access_token=` URL param + Apple OCSP `online-checks=true` + JWT `require-iss-aud=true` · **S**
- [ ] **P2-1** Hợp nhất 1 hệ curriculum (giữ skill-tree, port server-grading + weak-point từ LearningPlan) · **L**
- [ ] **P2-2** Hợp nhất 3 bản pronunciation → 1 `PronunciationService` + `/api/pronunciation/evaluate` · **L**
- [ ] **P2-3** Bỏ 3 bảng SRS thừa (giữ `vocab_review_schedule` canonical) · **M**
- [ ] **P2-4** `JdbcTemplate`+`Map` ở Admin/SkillTree → DTO projection · **M**
- [ ] **P2-7** Streaming Groq retry + `RejectedExecutionHandler` + RAG sanitize (prompt-injection gián tiếp) · **M**
- [ ] **P2-8** Tách `speaking.tsx` (927 dòng) mobile + `expo-av`→`expo-audio` · **M**
- [ ] **P2-9** Cutover zero-downtime thật (nginx upstream flip) + supervise Edge-TTS (systemd) + JaCoCo gate 25% · **M**
- [ ] **P2-10** i18n: bù key cho ~40 chuỗi tiếng Việt hardcode; xoá offline-SRS chết mobile; dọn 10 `Href` cast · **M**
- [ ] **P3** TanStack Query (web) bỏ refetch lặp; per-item notification deep-link; OTA `expo-updates`; PostHog key→EAS secret; pin Docker digest; structured logging · **L**

---

## 🧪 Xác minh thủ công (không phải code, nhưng nên làm)

- [ ] **Login thật trên prod** (web): đăng nhập → vào dashboard, không loop; đóng/mở lại trình duyệt → không bị bắt login lại. _(Curl không thay được — middleware auth gate giờ đã live.)_
- [ ] Xác nhận `JWT_RSA_PUBLIC_KEY` có trong **Amplify env** (nếu thiếu, route protected degrade về client-side — không sập nhờ fail-safe).
- [ ] Smoke API thật sau deploy: XP/achievements/teacher-class (các bảng vừa thêm FK ở V196).

---

## 💡 Gợi ý thứ tự làm (dễ→khó, gom theo PR)

**Cụm 1 — Quick wins backend (1 PR, ~S):** P1-5 (ảnh web) · P1-6 (pool sizing) · P1-8 (nuốt catch — đang **mất dữ liệu học thật**, ưu tiên cao dù effort thấp).

**Cụm 2 — An toàn tài chính/hành vi (~M):** P1-17 (`MomoPaymentServiceTest` — mảng tiền chưa có test) · P1-15 (rate-limit nốt các endpoint AI + validate upload) · P0-2-đuôi (advisory lock chống double-activate).

**Cụm 3 — Toàn vẹn dữ liệu (~M):** P1-14 (XP lost-update + enum) · P1-13 (TIMESTAMPTZ).

**Cụm 4 — Hiệu năng/vận hành (~M):** P1-4 (Redis L2) · P1-16 (observability: deploy-hoặc-xoá).

**Cụm 5 — Nợ kiến trúc (L, làm khi rảnh):** P1-7 (tách god-class) · P2-1/P2-2/P2-3 (hợp nhất curriculum/pronunciation/SRS).

**External (cần bạn, không chặn dev):** P0-11 (`eas init`) · P0-3b (rotate MoMo key) · P1-11 (IAP mobile — sau khi có eas).
