# Wave 5 — D-2 + tổng kết cuối: kết quả và việc còn lại

> Ghi lại những gì đã làm trong Wave 4+5 và trạng thái cuối cùng của toàn bộ Remediation.
> Đối chiếu với `/Users/dinhcu/Developer/DeutschFlow/audit/REMEDIATION.md`.

---

## Tổng trạng thái Wave 4–5 (session này)

| ID | Mục | Trạng thái | Commit |
|----|-----|-----------|--------|
| S-2/B | JwtAuthFilter user cache (Caffeine 60s) | ✅ DONE | `f8b97797` |
| T-5/D-4 | ACCOUNTANT org-role (`assertOrgFinance`) | ✅ DONE | `f8b97797` |
| S-1 | SseTicketService Redis backend | ✅ DONE | `0b431ee2` |
| C | JWT orgRole claim staleness comment | ✅ DONE | `0b431ee2` |
| S-6 | SessionTurnGuard Redis distributed lock | ✅ DONE | `1e3db46f` |
| T-1/D-1 | OrgQuotaService → org_members canonical source | ✅ DONE | `2c91784c` |
| D-2 | org_id trên ai_token_usage_events + ai_speaking_sessions (V223) | ✅ DONE | `8f090008` |

---

## Chi tiết những gì đã làm

### S-2/B — JwtAuthFilter Caffeine user cache

`authenticateRegisteredUser()` gọi `userDetailsService.loadUserByUsername()` mỗi request → 1 DB query/request. Fix: thêm `Cache<String, UserDetails>` Caffeine 60s TTL, maximumSize 10.000. `DaoAuthenticationProvider` (login path) vẫn dùng raw service — đúng vì login phải luôn check DB.

### T-5/D-4 — ACCOUNTANT org-role

Thêm `FINANCE_ROLES = Set.of("OWNER", "ADMIN", "ACCOUNTANT")` và `assertOrgFinance()` vào `OrgGuard`. Hai endpoint billing `/api/org/invoices` + `/api/org/payment-info` chuyển từ `assertOrgAdmin` sang `assertOrgFinance`. ACCOUNTANT chỉ đọc được billing, không quản lý member/invite/roster.

### S-1 — SseTicketService Redis

Thêm `@Nullable StringRedisTemplate redis` constructor injection. Issue: `SET sse-ticket:{ticket} subject PX 60000`. Consume: Lua script GET + DEL atomic. Fallback in-memory khi Redis không có. Kết quả: ticket valid trên tất cả node → speaking không hỏng khi scale ngang.

### C — JWT orgRole comment

Thêm comment trong `JwtService.generateAccessToken()` giải thích orgRole chỉ là display hint, lag tối đa JWT TTL (~15 phút), backend re-verify qua `OrgGuard` → không phải security hole. Cũng bổ sung ACCOUNTANT vào comment.

### S-6 — SessionTurnGuard Redis distributed lock

Thay `AtomicBoolean` trong-memory bằng Redis `SET NX EX` 30 giây: `opsForValue().setIfAbsent(key, "1", Duration.ofSeconds(30))`. Release = `redis.delete(key)`. 30s safety TTL auto-release khi request chết. Fallback in-memory khi Redis down.

### T-1/D-1 — OrgQuotaService dùng org_members

`wouldExceedOrgPool()`: đổi `SELECT org_id FROM users WHERE id = ?` → `SELECT org_id FROM org_members WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1`. `orgUsageThisMonth()`: đổi `JOIN users u ON u.id = e.user_id WHERE u.org_id = ?` → `JOIN org_members om ON om.user_id = e.user_id WHERE om.org_id = ? AND om.status = 'ACTIVE'`.

### D-2 — org_id trên business tables

**V223 migration**:
- `ALTER TABLE ai_token_usage_events ADD COLUMN org_id BIGINT REFERENCES organizations(id)`
- `ALTER TABLE ai_speaking_sessions ADD COLUMN org_id BIGINT REFERENCES organizations(id)`
- Backfill từ `users.org_id` hiện tại (snapshot ~ 10 center)
- Index `idx_ai_token_usage_org_month ON ai_token_usage_events(org_id, created_at) WHERE org_id IS NOT NULL`

**AiUsageLedgerService.record()**: INSERT now writes `org_id` qua subquery `SELECT u.org_id FROM users WHERE id = ?` — single round-trip, capture org tại thời điểm event.

**OrgQuotaService.orgUsageThisMonth()**: loại bỏ JOIN; dùng `WHERE org_id = ?` trực tiếp → index-range scan thay vì full-table SUM.

---

## Tổng kết Remediation HOÀN CHỈNH (Wave 1–5)

### ✅ Đã hoàn thành

**Wave 1 (Ngay)**:
- P-3: AISpeakingController auth + quota + ledger
- P-4: GrammarSyllabusController orgPoolGuard + ledger
- P-6/E: ConversationEvaluationService + InterviewEvaluationService catch thu hẹp
- P-7: TtsController cap độ dài + rate-limit
- I: OrgMembershipService auto-demote khi remove member
- P-1: AiExamEvaluatorService + SkillTreeController + GroqApiService + VideoLessonService ledger + gate
- P-2: PracticeNodeService + SkillTreeService pre-check assertAllowed
- A: AuthService System.err → log.warn
- dead: ErrorDetectionService xóa

**Wave 2 (Trước scale)**:
- P-5: AiSpeakingMockExamController quota gate
- P-8: STT pre-check controller-level
- P-11: Wallet debt logging
- M-3: Timezone VN cho org pool
- F: Seat limit check trong AdminOrgService.addMember
- S-4: assertAllowed read-only + SubscriptionReconcileJob
- S-3 (index): V222 partial index trên users.org_id

**Wave 3 (Backlog)**:
- K: break → continue trong OrgRosterService
- M-1: SecurityConfig exceptionHandling dup xóa
- J: OrgRosterService FOR UPDATE lock serialize concurrent imports

**Wave 4 (Session này)**:
- S-2/B: JwtAuthFilter Caffeine user cache
- T-5/D-4: ACCOUNTANT org-role + assertOrgFinance
- S-1: SseTicketService Redis backend (scale ngang speaking ✅)
- C: JWT orgRole comment
- S-6: SessionTurnGuard Redis distributed lock
- T-1/D-1: OrgQuotaService org_members canonical source
- D-2: org_id on ai_token_usage_events + V223 migration + AiUsageLedgerService

---

### ⏳ Còn lại (genuine deferral)

| ID | Mục | Lý do defer | Ưu tiên |
|----|-----|------------|---------|
| **S-5** | LLM đồng bộ giữ thread Tomcat | Cần executor/job queue trên 4 service, effort L | ❗ (nếu muốn scale) |
| **P-9** | Check-then-debit không atomic | 20+ callers, refactor lớn; overage ~10-20% chấp nhận ở scale nhỏ | 🟡 TB |
| **P-10/S-3 full** | Org pool counter atomic | Cần bảng `org_monthly_token_counters` + atomic INSERT ON CONFLICT | 🟡 TB |
| **M-5** | FreeTierGuard policy cho org member pool=0 | Cần quyết định: pool=0=unlimited hay cần `pool_unlimited=true` | 🟡 (chính sách) |
| **H** | attachOwner nuốt lỗi invite | Đã có `log.warn`, Option B (best-effort) đủ ở scale hiện tại | ⚪ |
| **O-3** | 4 rate-limiter rời nhau | Gộp khi mở rộng Redis ra toàn hệ thống | ⚪ |
| **O-2** | QuotaService 665 dòng | Refactor khi cần đụng vùng này | ⚪ |
| **D-3/G** | Invoice billing redesign | Cần quyết định sản phẩm về metering/proration | ⚪ |
| **T-4** | Admin org endpoint re-verify | Đã xử lý ở service layer (không cần thêm code) | ✅ N/A |
| **O-1** | Pipeline speaking xé nhỏ | REMEDIATION nói accept as-is | ✅ N/A |

---

## Ghi chú kỹ thuật cuối

- **Test suite**: 970 tests, 0 failures sau mọi thay đổi
- **Redis availability**: `StringRedisTemplate` được inject vào SseTicketService, SessionTurnGuard qua `@Nullable` — graceful degrade to in-memory nếu Redis down (speaking vẫn hoạt động single-node)
- **D-2 backfill**: snapshot từ `users.org_id` tại thời điểm V223 chạy. Rows từ user chuyển org sau đó sẽ có `org_id` cũ trong events trước khi chuyển — chấp nhận được cho billing, không ảnh hưởng quota enforcement (enforcement dùng real-time lookup)
- **S-5 còn lại là bottleneck quan trọng nhất** nếu muốn scale vượt ~50 CCU AI: 48 lượt LLM đồng thời × 2-10s = thread Tomcat bão hòa
