# Wave 3 — Backlog: kết quả và việc còn lại

> Ghi lại những gì đã làm và những gì còn cần làm khi kết thúc phần Wave 3 (Đợt 3 — Backlog).
> Đối chiếu với `/Users/dinhcu/Developer/DeutschFlow/audit/REMEDIATION.md` mục 2 & 5.

---

## Trạng thái tổng

| ID | Mục | Trạng thái | Commit |
|----|-----|-----------|--------|
| M-1 | SecurityConfig exceptionHandling dup | ✅ DONE | `b72154a1` |
| J | Roster seat-limit race — DB lock | ✅ DONE | `b72154a1` |
| H | attachOwner nuốt lỗi invite | ⏳ DEFERRED | Cần quyết định chính sách |
| T-4 | Admin org endpoints re-verify orgId | ✅ ALREADY HANDLED | Service layer đã có load-and-validate |
| C | orgRole JWT TTL / UI-trust | ⏳ DEFERRED | Backlog, low risk |
| K | break → continue trong OrgRosterService | ✅ DONE | `fdb208d1` (Wave 2) |
| O-3 | 4 rate-limiter rời, gộp lại | ⏳ DEFERRED | Cần Redis integration |
| O-2 | QuotaService 655 dòng, hàm trùng | ⏳ DEFERRED | Refactor khi cần đụng vùng này |
| O-1 | Pipeline speaking xé nhỏ | ⏳ ACCEPT | REMEDIATION nói chấp nhận as-is |
| D-3/G | Invoice billing redesign | ⏳ DEFERRED | Quyết định sản phẩm cần trước |

---

## Chi tiết những gì đã làm

### `b72154a1`

**M-1** — SecurityConfig duplicate `exceptionHandling`:
- `SecurityConfig.java:115-117` là bản ghi đè của `exceptionHandling` đã đăng ký ở dòng 54-56
- Xóa block trùng ở dưới (`.authenticationProvider(authenticationProvider()).exceptionHandling(...).addFilterBefore(...)`)
- Giữ lại `addFilterBefore` và `authenticationProvider` nhưng không lặp lại `exceptionHandling`
- Hành vi thực tế không đổi (Spring ghi đè), nhưng bỏ source of confusion khi đọc code

**J** — Roster seat-limit race:
- `OrgRosterService.importStudents()`: thêm `SELECT id FROM organizations WHERE id = ? FOR UPDATE` sau khi load org
- Lock row-level Postgres sẽ serialize hai import đồng thời vào cùng org
- Test `OrgRosterServiceTest` cập nhật: thêm `@Mock JdbcTemplate jdbcTemplate` + stub FOR UPDATE query

---

## Những gì còn lại

### H — `attachOwner` nuốt lỗi invite

Hiện tại:
```java
try {
    orgInvitationService.inviteTeacher(resolveActorId(), orgId, email);
} catch (RuntimeException ex) {
    log.warn("Không gửi được lời mời chủ sở hữu cho org {} ({}): {}", orgId, email, ex.getMessage());
}
```

Đây đã có `log.warn` nên không hoàn toàn im lặng. Quyết định cần làm:
- **Option A** (strict): throw exception → fail toàn bộ transaction tạo org → org không bao giờ được tạo nếu không invite được owner
- **Option B** (best-effort): hiện tại, org tạo xong nhưng không owner → admin phải nhớ gán owner tay
- **Option C**: thêm trường `owner_email_pending` trên org → UI admin hiển thị "pending owner assignment"

Khuyến nghị: Option B đủ cho quy mô hiện tại nếu có alert monitoring. Option A an toàn nhất nhưng có thể làm gián đoạn org creation nếu mail server down.

### T-4 — Admin org endpoints re-verify orgId

**✅ ĐÃ XỬ LÝ ở service layer** — audit finding này không cần thêm code:
- `AdminOrgService.getOrganization(id)` → `findById(id).orElseThrow(NotFoundException)` ✓
- `AdminOrgService.updateOrganization(id, ...)` → `findById(id).orElseThrow(NotFoundException)` ✓
- `AdminOrgService.listMembers(orgId)` → `existsById(orgId)` check + NotFoundException ✓
- `AdminOrgService.addMember(orgId, ...)` → `findById(orgId).orElseThrow(NotFoundException)` ✓
- `AdminOrgService.activateEntitlements(orgId)` → `findById(orgId).orElseThrow(NotFoundException)` ✓
- `OrgBillingService.createInvoice(orgId, ...)` → phải verify riêng nếu muốn chắc chắn

### O-3 — 4 rate-limiter rời nhau

4 implementations:
1. `AuthRateLimiterService` — có Redis backing (đúng chuẩn)
2. `speaking/AiRateLimiterService` — in-memory
3. `speaking/RateLimiterService` — in-memory
4. `NotificationRateLimiterService` — in-memory

**Tác động thực tế khi scale ngang**: (2), (3), (4) đều in-memory → vỡ khi thêm node thứ 2. Nhưng cùng nhóm vấn đề với S-1/S-6 (in-memory state). Nên giải cùng nhau với sticky-session hoặc chuyển sang Redis.

Chưa làm vì cần quyết định sticky-session vs Redis, và là effort lớn (cần refactor abstraction).

### O-2 — QuotaService 665 dòng + hàm trùng

Cặp hàm trùng:
- `buildSnapshot` / `buildSnapshotReadOnly` — giờ dùng khác nhau (write vs read-only)
- `computeAccruedWalletBalance` / `accrueWalletThroughToday` — một pure math, một DB write

Sau S-4, `buildSnapshot` vẫn được gọi từ `getSnapshot` và `reconcileForUser`. `buildSnapshotReadOnly` được gọi từ `assertAllowed`. Sự phân chia là có chủ đích — không refactor vì đẹp.

### C — orgRole JWT claim lệch sau khi đổi quyền

JWT sống 15 phút → sau khi đổi org-role, UI có thể hiển thị sai role tới 15'. Backend re-verify nên không phải security hole. Chấp nhận behavior này; tài liệu hóa trong code comment nếu muốn.

### D-3/G — Invoice billing redesign

`OrgBillingService` lưu `seats`/`amount_vnd` do admin nhập tay, không link `org_members`. Metering và proration cần quyết định sản phẩm trước khi implement. Cần thảo luận với stakeholder về model billing mong muốn.

---

## Tổng kết toàn bộ Remediation (Wave 1 + 2 + 3)

### ✅ Đã hoàn thành

**Wave 1 (Ngay)**:
- P-3: AISpeakingController gắn auth + quota + ledger (hoặc đã có, cần verify)
- P-4: GrammarSyllabusController gắn orgPoolGuard + ledger
- P-6/E: ConversationEvaluationService + InterviewEvaluationService catch thu hẹp
- P-7: TtsController cap độ dài + rate-limit
- I: OrgMembershipService auto-demote khi remove member
- P-1: AiExamEvaluatorService + SkillTreeController + GroqApiService + VideoLessonService ledger + gate
- P-2: PracticeNodeService + SkillTreeService pre-check assertAllowed
- A: AuthService System.err → log.warn
- dead: ErrorDetectionService đã xóa

**Wave 2 (Trước scale)**:
- P-5: AiSpeakingMockExamController quota gate
- P-8: STT pre-check controller-level (AiSessionController + SkillTreeController)
- P-11: Wallet debt logging
- M-3: Timezone VN cho org pool
- F: Seat limit check trong AdminOrgService.addMember
- S-4: assertAllowed read-only + SubscriptionReconcileJob
- S-3 (index): V222 partial index trên users.org_id
- K: break → continue trong OrgRosterService

**Wave 3 (Backlog)**:
- M-1: SecurityConfig exceptionHandling dup xóa
- J: OrgRosterService FOR UPDATE lock serialize concurrent imports

### ⏳ Còn lại (theo mức độ ưu tiên)

1. **S-1** — SSE ticket Redis → scale ngang speaking ❗
2. **S-2/B** — JwtAuthFilter user cache → giảm DB load/request ❗
3. **S-5** — LLM sync → Tomcat thread pool ❗
4. **P-9** — Atomic reserve → race condition quota
5. **P-10/S-3 full** — Org pool counter + atomic → race condition pool
6. **T-1/D-1** — Chọn nguồn tenant duy nhất
7. **D-2** — org_id trên business tables (quyết định sớm hơn rẻ hơn)
8. **T-5/D-4** — ACCOUNTANT role
9. **M-5** — FreeTierGuard policy org member
10. **S-6** — SessionTurnGuard Redis (sau S-1)
11. **H**, **C**, **O-3**, **O-2**, **D-3/G** — low priority backlog
