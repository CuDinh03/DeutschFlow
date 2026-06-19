# Wave 2 — Trước scale: kết quả và việc còn lại

> Ghi lại những gì đã làm và những gì còn cần làm khi kết thúc phần Wave 2 (Đợt 2 — Trước khi scale).
> Đối chiếu với `/Users/dinhcu/Developer/DeutschFlow/audit/REMEDIATION.md` mục 2 & 5.

---

## Trạng thái tổng

| Nhóm | Mục | Trạng thái | Commit |
|------|-----|-----------|--------|
| Token-pool | P-5 | ✅ DONE | `bbce5ee7` |
| Token-pool | P-8 (controller-level) | ✅ DONE | `bbce5ee7` |
| Token-pool | P-11 | ✅ DONE | `bbce5ee7` |
| Token-pool | M-3 | ✅ DONE | `bbce5ee7` |
| Seat | F | ✅ DONE | `bbce5ee7` |
| Hạ tầng | S-4 | ✅ DONE | current session |
| DB index | S-3 (index only) | ✅ DONE | current session |
| Roster bug | K | ✅ DONE | `fdb208d1` |
| Hạ tầng | S-1 | ⏳ DEFERRED | Redis ticket store |
| Hạ tầng | S-2/B | ⏳ DEFERRED | JwtAuthFilter user cache |
| Hạ tầng | S-5 | ✅ DONE | `e7ea78ff` |
| Hạ tầng | S-6 | ⏳ DEFERRED | SessionTurnGuard Redis |
| Race | P-9 | ⏳ DEFERRED | atomic reserve |
| Race | P-10 | ⏳ DEFERRED | org pool counter |
| Policy | M-5 | ⏳ DEFERRED | FreeTierGuard org decision |
| Tenant | T-1/D-1 | ⏳ DEFERRED | dual source decision |
| Schema | D-2 | ⏳ DEFERRED | org_id on business tables |
| Role | T-5/D-4 | ⏳ DEFERRED | ACCOUNTANT role |
| S-3 counter | S-3 (counter) | ⏳ DEFERRED | org_monthly_token_counters table (index done) |

---

## Chi tiết những gì đã làm

### Commit `bbce5ee7` (session trước)

**P-5** — `AiSpeakingMockExamController`:
- Thêm `QuotaService.assertAllowed` và `OrgPoolGuard.assertOrgPoolAvailable` vào `requireEvalBudget()`
- Trước đây chỉ rate-limit, không kiểm tra token quota

**P-8** — STT pre-check controller-level:
- `AiSessionController.transcribe()`: thêm `quotaService.assertAllowed` + `orgPoolGuard.assertOrgPoolAvailable` trước Whisper call
- `SkillTreeController.evaluatePronunciation()`: thêm tương tự
- NOTE: service-level STT (PhonemeService, AiJobWorker, PronunciationScorerService) chưa được gate — còn là gap nhỏ hơn

**P-11** — Wallet debt logging:
- `QuotaService.applyUsageDebit()`: thêm `log.warn` khi `totalTokens > walletBalance` để log thất thu
- Trước đây clamp GREATEST(0,...) nuốt overage im lặng

**M-3** — Timezone VN cho org pool:
- `OrgQuotaService.orgUsageThisMonth()`: sửa `date_trunc('month', now())` → `date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`

**F** — Seat limit khi thêm member đơn lẻ:
- `AdminOrgService.addMember()`: thêm kiểm tra seat limit trước khi `orgMembershipService.upsertMember()`
- Chỉ apply cho STUDENT role và `org.getSeatLimit() > 0`
- Existing member (đã có trong org) được exempt

### Session hiện tại

**S-4** — `reconcileSubscriptions` không còn chạy trên hot-path:
- `assertAllowed` chuyển sang `buildSnapshotReadOnly` thay vì `buildSnapshot` → không còn REQUIRES_NEW transaction với nhiều UPDATE
- Thêm virtual FREE expiry check (7 ngày từ starts_at) trong `assertAllowed` để handle FREE plan chưa được reconcile
- Thêm `reconcileForUser(userId, now)` public method
- Thêm `SubscriptionReconcileJob` chạy mỗi 10 phút để reconcile subscription ở nền

**S-3 (index)** — V222 migration: index trên `users.org_id`:
- `CREATE INDEX idx_users_org_id ON users(org_id) WHERE org_id IS NOT NULL`
- Giúp JOIN trong `orgUsageThisMonth()` nhanh hơn khi nhiều user trong bảng

**K** — `break` → `continue` trong `OrgRosterService`:
- Dòng 121: khi hit seat-limit với một new student, dùng `continue` thay vì `break`
- Đảm bảo existing member ở các dòng CSV sau vẫn được xử lý

---

## Những gì còn lại (ưu tiên giảm dần)

### Cụm hạ tầng scale-ngang — quan trọng nhất nếu muốn thêm node

**S-1** — SSE ticket in-memory:
- `SseTicketService.java:33` dùng `ConcurrentHashMap` → khi thêm node thứ 2, ticket từ node A không có trên node B → 401
- Fix: chuyển sang Redis TTL ngắn (pattern giống `AuthRateLimiterService`)
- Hoặc bật sticky-session ở load balancer (tạm thời)
- **Chặn scale ngang cho speaking** — cần làm trước khi thêm instance

**S-2/B** — User cache trong JwtAuthFilter:
- `JwtAuthFilter.java:129` gọi `loadUserByUsername` mỗi request → 1 DB query/request
- Fix: cache user theo email/JWT subject (Caffeine 60s TTL), invalidate khi đổi role
- **Thêm latency vào mọi endpoint** dưới tải

**S-5** — ✅ DONE (`e7ea78ff`, `wave6_s5_llm_async.md`):
- `PracticeNodeService`: thêm `startPracticeSessionAsync` + `generateNextAsync` (202+jobId)
- `PracticeNodeController`: cache-hit→200, cache-miss→202+jobId
- `MockExamController.finishExam`: tách `processFinishExam` sang `aiExecutor`; quota gate giữ synchronous trên Tomcat
- SkillTreeService đã @Async trước; VideoLessonService đã async trước

**S-6** — `SessionTurnGuard` in-memory:
- Thấp hơn S-1; chỉ cần Redis khi đã thật sự đa-node

### Cụm race condition

**P-9** — Check-then-debit không atomic:
- `assertAllowed` và `applyUsageDebit` cách nhau 2-10s → N concurrent request cùng user đều pass
- Fix: atomic reserve trước LLM; điều chỉnh sau
- Mức độ: overage 10-20% khi concurrency cao; chấp nhận được khi scale nhỏ

**P-10/M-4** — Org pool race:
- `OrgQuotaService.wouldExceedOrgPool` không lock → nhiều teacher đồng thời đều pass khi pool sắp cạn
- Fix lý tưởng: chuyển org pool sang counter tăng-dần với atomic update (cần S-3 đầy đủ)

### S-3 đầy đủ — counter tăng-dần org pool

- Index đã có (V222) nhưng vẫn dùng `SUM(total_tokens)` mỗi request
- Fix đầy đủ: bảng `org_monthly_token_counters(org_id, month_start DATE PK, tokens_used BIGINT)` + atomic `INSERT ON CONFLICT DO UPDATE SET tokens_used = tokens_used + ?` trong `AiUsageLedgerService.record()`
- Cần quyết định D-2 trước: có thêm `org_id` vào `ai_token_usage_events` không? Nếu có, counter càng dễ build

### Cụm tenant & schema (quyết định kiến trúc)

**T-1/D-1** — Hai nguồn tenant:
- `OrgQuotaService` đọc `users.org_id`; `OrgGuard` đọc `org_members`
- Risk chỉ ở kịch bản multi-org lịch sử; hiện tại `removeMember` sync đúng
- Nên chọn `org_members` làm nguồn duy nhất và derive `org_id`

**D-2** — Không có `org_id` trên bảng nghiệp vụ:
- `classes`, `ai_token_usage_events`, `ai_speaking_sessions`, v.v. không có `org_id`
- Query isolation phải JOIN qua đồ thị sở hữu → chậm + dễ bug
- **Khoản nợ đắt nhất nếu để lâu** — backfill 10 center rẻ, 500 center đau

**T-5/D-4** — Thiếu ACCOUNTANT role:
- Kế toán xem hóa đơn phải là org-ADMIN → over-privilege
- Fix: org-role ACCOUNTANT ở tầng `OrgGuard`, không cần đụng `User.Role`

### M-5 — FreeTierGuard policy cho org member

- Hiện tại: org member bỏ qua free-tier PPTX/OCR hoàn toàn (chỉ chịu org pool)
- Nếu org pool = 0 (unconfigured) → teacher dùng PPTX/OCR vô giới hạn
- **Cần quyết định chính sách** trước khi implement:
  - Option A: org member với pool=0 → apply free-tier cap (conservative)
  - Option B: pool=0 = unlimited có chủ đích → OK as-is (current behavior)
  - Option C: require orgs to explicitly set `pool_unlimited = true` thay vì dùng pool=0 làm sentinel

---

## Ghi chú kỹ thuật

- Tất cả P-8 service-level (PhonemeService, AiJobWorker, PronunciationScorerService) chưa có pre-check — chỉ controller-level được gate. Đây là gap nhỏ hơn vì STT ở các service đó thường được gọi qua background job (không phải direct request).
- `org_monthly_token_counters` table đã được plan nhưng chưa tạo migration — cần làm khi quyết định D-2 xong.
- Build hiện tại: 951 tests, tất cả green trước wave 2 current session.
