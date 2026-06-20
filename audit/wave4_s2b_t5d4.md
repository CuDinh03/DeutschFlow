# Wave 4 — S-2/B + T-5/D-4: kết quả và việc còn lại

> Ghi lại những gì đã làm và những gì còn cần làm khi kết thúc phần Wave 4.
> Đối chiếu với `/Users/dinhcu/Developer/DeutschFlow/audit/REMEDIATION.md` mục 2 & 5.

---

## Trạng thái tổng

| ID | Mục | Trạng thái | Commit |
|----|-----|-----------|--------|
| S-2/B | JwtAuthFilter user cache | ✅ DONE | `(current)` |
| T-5/D-4 | ACCOUNTANT org-role | ✅ DONE | `(current)` |

---

## Chi tiết những gì đã làm

### S-2/B — JwtAuthFilter Caffeine user cache

**Vấn đề**: `JwtAuthFilter.authenticateRegisteredUser()` gọi `userDetailsService.loadUserByUsername(subject)` mỗi request → 1 DB query/request kể cả khi user vừa được xác thực xong.

**Fix** (`JwtAuthFilter.java`):
- Thêm `Cache<String, UserDetails>` (Caffeine, đã có trong pom.xml) với:
  - `expireAfterWrite(60, SECONDS)` — stale tối đa 60 giây, nhỏ hơn nhiều so với JWT TTL 15 phút
  - `maximumSize(10_000)` — đủ cho scale hiện tại
- Thay `userDetailsService.loadUserByUsername(subject)` bằng `userCache.get(subject, userDetailsService::loadUserByUsername)`
- Khi user không tồn tại → `UsernameNotFoundException` (unchecked) vẫn propagate qua Caffeine, không có gì bị cache

**Lý do 60s TTL hợp lý**:
- Nếu user bị xóa hoặc đổi role, stale tối đa 60 giây
- Backend re-verify qua `OrgGuard`/service layer nên không phải security hole
- Item C trong REMEDIATION.md đã accept behavior lag tương tự cho orgRole JWT (15 phút)

**Tác động**: ~1 DB query tiết kiệm mỗi authenticated request. Dưới tải 100 CCU với nhiều parallel calls, đây là win đáng kể cho Hikari pool.

---

### T-5/D-4 — ACCOUNTANT org-role

**Vấn đề**: Kế toán muốn xem hóa đơn/payment info của org phải là OWNER hoặc ADMIN → over-privilege (admin có thể xóa member, invite teacher, v.v.)

**Fix**:

**`OrgGuard.java`**:
- Thêm `FINANCE_ROLES = Set.of("OWNER", "ADMIN", "ACCOUNTANT")`
- Thêm method `assertOrgFinance(userId, orgId)` kiểm tra OWNER | ADMIN | ACCOUNTANT
- `ACCOUNTANT` là org-role (trong bảng `org_members.role`), **không** phải `User.Role` → không đụng đến user entity

**`OrgController.java`**:
- `GET /api/org/invoices` → đổi từ `assertOrgAdmin` sang `assertOrgFinance`
- `GET /api/org/payment-info` → đổi từ `assertOrgAdmin` sang `assertOrgFinance`
- Các endpoint quản lý member/invite/roster giữ nguyên `assertOrgAdmin`

**`OrgGuardTest.java`**:
- Thêm 6 test cho `assertOrgFinance`: OWNER pass, ADMIN pass, ACCOUNTANT pass, TEACHER fail, STUDENT fail, non-member fail

**Test result**: 957 tests, 0 failures (tăng từ 951 trước đó).

---

## Những gì còn lại (ưu tiên giảm dần)

Sau Wave 4, danh sách ưu tiên còn lại:

### 1. S-1 — SSE ticket in-memory ❗ (QUAN TRỌNG NHẤT cho scale ngang)
- `SseTicketService.java:33` dùng `ConcurrentHashMap` → node 2 không đọc được ticket node 1 tạo
- Fix: chuyển sang Redis TTL ngắn (pattern giống `AuthRateLimiterService`)
- **Blocker cho speaking feature khi scale ngang**

### 2. S-5 — LLM đồng bộ giữ thread Tomcat
- `SkillTreeService:417`, `PracticeNodeService:117`, `AiExamEvaluatorService:50`, `VideoLessonService:184`
- Fix: đẩy sang executor off-thread hoặc job queue (`AiJobWorker` đã có pattern)
- **~48 lượt AI đồng thời (2-10s/request) làm đói thread pool**

### 3. P-9 — Check-then-debit không atomic
- `assertAllowed` và `applyUsageDebit` cách nhau 2-10s → overage có thể 10-20%
- Fix: atomic reserve trước LLM call, điều chỉnh sau

### 4. P-10/S-3 full — Org pool counter
- `OrgQuotaService.wouldExceedOrgPool` dùng `SUM` không lock → race khi nhiều teacher đồng thời
- Fix đầy đủ cần bảng `org_monthly_token_counters` + atomic `INSERT ON CONFLICT DO UPDATE SET tokens_used = tokens_used + ?`
- Phụ thuộc quyết định D-2

### 5. T-1/D-1 — Chọn nguồn tenant duy nhất
- `OrgQuotaService` đọc `users.org_id`; `OrgGuard` đọc `org_members`
- Nên chọn `org_members` làm canonical source

### 6. D-2 — org_id trên bảng nghiệp vụ
- `classes`, `ai_token_usage_events`, `ai_speaking_sessions` không có `org_id`
- **Nợ đắt nhất nếu để lâu** — backfill rẻ ở 10 center, đau ở 500 center

### 7. M-5 — FreeTierGuard policy org member
- Cần quyết định chính sách: pool=0 = unlimited vs phải set `pool_unlimited=true` explicit

### 8. S-6 — SessionTurnGuard Redis (sau S-1)

### 9. H, C, O-3, O-2, D-3/G — low priority backlog
- **H**: `attachOwner` đã có `log.warn`, chờ quyết định chính sách strict/best-effort
- **C**: JWT orgRole lag 15' — accepted behavior, chỉ cần comment
- **O-3**: 4 rate-limiter rời → gộp sau khi có Redis
- **O-2**: QuotaService refactor — defer
- **D-3/G**: Invoice redesign — cần quyết định sản phẩm

---

## Tổng kết Remediation (Wave 1–4)

| Wave | Items hoàn thành |
|------|-----------------|
| Wave 1 (Ngay) | P-3, P-4, P-6/E, P-7, I, P-1, P-2, A, dead |
| Wave 2 (Trước scale) | P-5, P-8, P-11, M-3, F, S-4, S-3 (index), K |
| Wave 3 (Backlog) | M-1, J |
| Wave 4 (Tiếp theo) | **S-2/B**, **T-5/D-4** |
| Còn lại | S-1, S-5, P-9, P-10, T-1/D-1, D-2, M-5, S-6, H, C, O-3, O-2, D-3/G |
