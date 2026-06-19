# PASS 2 — TRACE LUỒNG NGHIỆP VỤ B2B

> Trace từng bước qua code thật. Mỗi luồng: các bước (file:hàm:dòng), dữ liệu biến đổi, ai chạm được, điểm fail âm thầm. KHÔNG sửa.

---

## LUỒNG 1: Đăng nhập + resolve role + áp quyền

### Bước 1 — Rate limit + dispatch
**`AuthController.java:78-93`** — `POST /api/auth/login` (permitAll, không cần JWT)

```
AuthController.login()
  ├─ resolveClientIp(request)          :82  X-Forwarded-For → socket fallback
  ├─ authRateLimiterService.allow(ip, email)   :83  Redis sliding-window
  │   └─ Nếu vượt → RateLimitExceededException → HTTP 429
  └─ authService.login(request)        :88  @Transactional bắt đầu
```

### Bước 2 — Xác thực mật khẩu
**`AuthService.java:94-98`**

```
authenticationManager.authenticate(
    new UsernamePasswordAuthenticationToken(email, password))
  │
  └─ DaoAuthenticationProvider (SecurityConfig.java:124)
       ├─ UserDetailsService.loadUserByUsername(email)
       │   → userRepository.findByEmail(email)
       │   → nếu không tìm thấy → UsernameNotFoundException → BadRequestException("Invalid email or password")
       └─ BCryptPasswordEncoder.matches(rawPw, passwordHash)
            → nếu sai → BadCredentialsException → BadRequestException("Invalid email or password")
```

Dữ liệu được đọc: `users` (email, password_hash, role, org_id, active)

### Bước 3 — Load user lại + trial provisioning
**`AuthService.java:101-118`**

```
userRepository.findByEmail(email)     ← DB QUERY (trùng với query loadUserByUsername phía trên)

Nếu role == STUDENT:
  SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ?   (AuthService.java:105-107)
  Nếu count == 0:
    try {
      studentTrialSubscriptionProvisioner.provisionSevenDayTrial(userId, start, end)  (:111-112)
    } catch (Exception e) {
      System.err.println(...)   (:114)  ← KHÔNG phải SLF4J logger  ← ĐIỂM YẾU A
      // login tiếp tục dù provision fail  (:115)
    }
```

### Bước 4 — Revoke sessions cũ, tạo token
**`AuthService.java:120-121`**

```
refreshTokenRepository.revokeAllByUserId(user.getId())     ← UPDATE refresh_tokens SET revoked=true  (:120)
buildAuthResponse(user)  (:121)
  ├─ generateOrgContext(user)
  │   → SELECT org_id, role FROM org_members WHERE user_id=? AND status='ACTIVE'
  │   → trả về (orgId, orgRole) nếu user thuộc org
  ├─ JwtService.generateAccessToken(user, orgId, orgRole)  (JwtService.java:142-164)
  │   Claims: {sub: email, role: "TEACHER", userId: 123, orgId: 5, orgRole: "OWNER"}
  │   ← TTL: 15 phút (JWT_ACCESS_TOKEN_EXPIRY_MS)
  └─ createRefreshToken(user)  (AuthService.java:294-303)
      → UUID.randomUUID() → INSERT refresh_tokens (expires = 7 ngày)
```

### Bước 5 — Response + request tiếp theo

JWT được trả về. Request tiếp theo:

```
JwtAuthFilter.doFilterInternal()
  ├─ jwtService.isTokenValid(token)   → parse chữ ký + expiry  (JwtAuthFilter.java:73)
  ├─ jwtService.extractEmail(token)   → claims.getSubject()    (:88)
  ├─ userDetailsService.loadUserByUsername(email)  ← DB QUERY mỗi request  (:129)
  │   → User entity với getAuthorities() = [ROLE_TEACHER]   (User.java:79)
  └─ SecurityContextHolder.setAuthentication(...)  (JwtAuthFilter.java:133)

Controller:
  @PreAuthorize("hasRole('TEACHER')")   → Spring checks ROLE_TEACHER in authorities  (TeacherController.java:22)
  @AuthenticationPrincipal User user    → cast từ UserDetails
```

**Dữ liệu biến đổi**: `refresh_tokens` (revoke + insert), `user_subscriptions` (insert nếu student mới)

**Ai chạm được**: Bất kỳ ai có đúng email+password. Không cần JWT để đăng nhập.

**⚠️ ĐIỂM YẾU A** — Dùng `System.err.println` (`AuthService.java:114`) thay vì `log.warn()`. Lỗi provision trial subscription sẽ **không xuất hiện trong application log** (SLF4J/Logback), chỉ ghi ra stderr — trong môi trường container (Docker/EC2) stderr thường bị bỏ qua. Student đăng nhập thành công nhưng không có subscription, quota kiểm tra sẽ cho họ vào `DEFAULT` plan.

**⚠️ ĐIỂM YẾU B** — Mỗi request sau đăng nhập tốn **1 DB query** (`loadUserByUsername`, `JwtAuthFilter.java:129`) để load `User` entity từ email trong JWT. Không có user cache (Redis). Với 48 Tomcat threads, 48 concurrent requests = 48 DB queries vào pool 20 connections.

**⚠️ ĐIỂM YẾU C** — `orgRole` trong JWT (OWNER/ADMIN/TEACHER) chỉ là **display hint cho frontend** — Spring Security không biết claim này. Backend tự re-verify từ `org_members`. Nếu frontend tin JWT claim để ẩn/hiện UI admin, một user bị revoke OWNER role nhưng chưa hết token 15 phút vẫn thấy UI admin.

**Điểm yếu nghiêm trọng nhất của luồng này là** dùng `System.err.println` (`AuthService.java:114`) thay vì SLF4J logger để báo lỗi provision trial — trong môi trường EC2/Docker, lỗi này biến mất hoàn toàn khỏi log stack, khiến student đăng nhập thành công nhưng không có quota nào và không ai hay biết.

### Bổ sung — Refresh token reuse detection
**`AuthService.java:124-146`**

```
refresh(token)
  ├─ findByToken → BadRequestException nếu không có  (:126-127)
  ├─ Nếu stored.isRevoked() → revokeAllByUserId + throw "Session compromised"  (:131-135)
  ├─ Nếu expired → throw  (:138-139)
  └─ stored.setRevoked(true) + save + buildAuthResponse  (:142-145)
```

Token reuse → revoke toàn bộ session (chống token theft). Đây là phần làm tốt.

---

## LUỒNG 2: Student tiêu thụ token (LLM + TTS)

### Ví dụ cụ thể: AI Speaking chat turn

### Bước 1 — Check quota (chỉ CHECK, không trừ)
**`ChatPrepService.java:189,312`** — trong `prepareSpeakingChatTurn()`

```
quotaService.assertAllowed(userId, Instant.now(), 1L)
  @Transactional(propagation = REQUIRES_NEW)  ← transaction riêng biệt  (QuotaService.java:46)
  │
  ├─ buildSnapshot(userId, now)  (:48,251)
  │   ├─ reconcileSubscriptions()   → update user_subscriptions nếu cần  (:252,370)
  │   └─ loadActiveCoveringSubscription()  (:253,484)
  │       SELECT us.plan_code, sp.daily_token_grant, sp.wallet_cap_days
  │       FROM user_subscriptions us JOIN subscription_plans sp
  │
  ├─ snap.unlimitedInternal() → INTERNAL plan: bỏ qua tất cả check  (:49-51)
  ├─ snap.remainingSpendable() <= 0 → QuotaExceededException (429)  (:52-53)
  ├─ estimatedMinTokens(1) > remaining → QuotaExceededException (429)  (:55-57)
  └─ orgQuotaService.wouldExceedOrgPool(userId, 1)  (:60)
      SELECT org_id FROM users WHERE id=?  (OrgQuotaService.java:65-74)
      → orgId null → return false (B2C bypass)  (:75-76)
      → pool <= 0 → return false (unlimited)  (:78-80)
      → SUM(total_tokens) FROM ai_token_usage_events JOIN users WHERE u.org_id=?  (:82)
```

**Token CHƯA bị trừ tại đây.** `assertAllowed` chỉ kiểm tra và trả về snapshot.

### Bước 2 — Gọi LLM (synchronous)
**`AiSpeakingServiceImpl.java:408`** — bên ngoài transaction

```
AiChatCompletionResult ai = chatCompletionService.runChatCompletion(prep)
  → HTTP call đến Groq/OpenAI (blocking, có thể mất 2-10 giây)
  → Trả về: {content, usage: {promptTokens, completionTokens, totalTokens}}
  → Nếu HTTP fail → exception propagate → KHÔNG ghi ledger
```

### Bước 3 — Ghi ledger + trừ token (SAU LLM)
**`TurnSideEffectsService.java:95-105`** → **`AiUsageLedgerService.java:27-48`**

```
if (ai.usage() != null) {
    aiUsageLedgerService.record(userId, provider, model,
        promptTokens, completionTokens, totalTokens, feature, requestId, sessionId)
    @Transactional(rollbackFor = Exception.class)  (AiUsageLedgerService.java:26)
    │
    ├─ INSERT INTO ai_token_usage_events (user_id, total_tokens, ...)  (:36-46)
    └─ quotaService.applyUsageDebit(userId, totalTokens, now)  (:47)
        @Transactional(propagation = REQUIRED)  ← join transaction của record()  (QuotaService.java:81)
        │
        └─ UPDATE user_ai_token_wallets
               SET balance = GREATEST(0, balance - totalTokens)
               WHERE user_id = ?  (:100)
```

**Dữ liệu biến đổi**: `ai_token_usage_events` (INSERT), `user_ai_token_wallets` (UPDATE balance)

### Race condition phân tích

```
Timeline hai request đồng thời (cùng user, gần cùng lúc):

  Request A: assertAllowed()  → remaining=10  → OK
  Request B: assertAllowed()  → remaining=10  → OK  (chưa thấy A trừ)
  Request A: LLM call (8 tokens)
  Request B: LLM call (8 tokens)
  Request A: record() → INSERT + debit 8  → balance=2
  Request B: record() → INSERT + debit 8  → balance=MAX(0, 2-8)=0
             (nhưng 8 tokens thực sự đã được tiêu → tổng 16, vượt quota 10)
```

**⚠️ ĐIỂM YẾU D — Race condition soft cap**: Kiểm tra quota (`assertAllowed`) và trừ quota (`applyUsageDebit`) nằm trong **hai transaction riêng biệt**, không có lock. Đây là **soft cap by design** (M4 ở Pass 1) nhưng không được document ở bất kỳ đâu trong code. Với FREE user chỉ có 10k tokens/ngày, concurrent calls có thể vượt 10-20% quota.

**⚠️ ĐIỂM YẾU E — Interview evaluation không ghi ledger và quota bị nuốt**

**`InterviewEvaluationService.java:42-79`**:

```java
public String generateReport(AiSpeakingSession session, Long userId) {
    try {                                              // line 43 — bắt đầu try
        // ...
        var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);  // line 59
        // ...
        AiChatCompletionResult result = openAiChatClient.chatCompletion(...);  // line 62-63
        // ...
        return raw;                                    // line 74
    } catch (Exception e) {                            // line 75 — bắt TẤT CẢ exception
        log.error("Failed to generate interview evaluation...");
        return null;                                   // line 77 — trả null, KHÔNG throw
    }
    // KHÔNG có aiUsageLedgerService.record() ở đây
}
```

Hệ quả kép:
1. `QuotaExceededException` bị **nuốt** bởi `catch(Exception)` → quota limit không được thực thi cho interview evaluation report. User FREE cạn token vẫn nhận được (hoặc null) report.
2. Nếu LLM call thành công, token usage **không được ghi vào ledger** → cost bị ẩn, analytics sai, wallet không bị trừ.

**Điểm yếu nghiêm trọng nhất của luồng này là** `InterviewEvaluationService.generateReport():75` bắt `Exception` bao trùm cả `quotaService.assertAllowed()` — vừa không thực thi quota với interview report, vừa để LLM gọi xong mà không ghi ledger, tạo hidden cost không track được.

### Trả lời 3 câu hỏi của luồng
- **(a) Trừ TRƯỚC hay SAU LLM?** SAU. `assertAllowed` chỉ check; trừ thật ở `applyUsageDebit` sau khi LLM trả `usage`.
- **(b) LLM fail có bị trừ không?** KHÔNG. `record()` chỉ chạy khi `ai.usage() != null`; lỗi LLM → không ghi ledger → không debit.
- **(c) Có @Async không, QuotaException tới caller không?** Speaking chat flow KHÔNG @Async (chỉ `GeminiApiClient.generateJsonFromDocument:56` là @Async nhưng dùng cho document, không cho chat). QuotaException propagate đồng bộ tới client — TRỪ 2 eval (Conversation/Interview) bị try-catch nuốt (ĐIỂM YẾU E).

---

## LUỒNG 3: Tính tiền theo course cycle — seat counting

### Bước 1 — Admin tạo invoice (thủ công)
**`OrgBillingService.java:50-68`** — `POST /api/v2/admin/orgs/{orgId}/invoices`

```
createInvoice(orgId, CreateInvoiceRequest req, createdBy)
  @Transactional
  │
  ├─ Sinh payment_code: "DFINV" + hex (pattern DFINV[0-9A-F]{12})
  ├─ INSERT org_invoices:
  │   { org_id, period_start, period_end,
  │     seats     = req.seats()       ← TĨNH: admin tự nhập, KHÔNG link với org_members
  │     amount_vnd = req.amountVnd()  ← TĨNH: admin tự nhập
  │     status = 'DRAFT',
  │     payment_code }
  └─ return OrgInvoiceDto
```

**Seat đếm thực tế**: Không có. `seats` trong invoice là số admin khai báo, không validate với `org_members`. Admin có thể invoice 5 seats dù org có 50 students.

### Bước 2 — Đếm seat hiện tại (chỉ dùng cho UI + gate)
**`OrgMembershipService.java:80-84`**

```
countByRole(orgId, "STUDENT")
  → OrgMemberRepository.countByIdOrgIdAndRoleAndStatus(orgId, "STUDENT", "ACTIVE")
  → SELECT COUNT(*) FROM org_members WHERE org_id=? AND role='STUDENT' AND status='ACTIVE'
```

Seat limit được enforce ở 2 nơi:
1. `OrgRosterService.java:113-114` — trước khi add student mới qua CSV import
2. `OrgMembershipService` — KHÔNG có check tự động khi admin thêm member đơn lẻ qua UI

**⚠️ ĐIỂM YẾU F** — Thêm student qua `OrgController` endpoint không đi qua seat limit check. Chỉ roster CSV import có check. Một admin có thể vượt seat limit bằng cách thêm từng student qua API thay vì CSV.

### Bước 3 — Thanh toán SePay webhook
**`SepayWebhookService.java:50-95`** — `POST /api/payments/sepay/webhook`

```
@Transactional
handle(SepayWebhookPayload payload)
  ├─ Auth: constant-time compare Apikey header       ← fail-closed nếu key chưa set
  ├─ Idempotency: eventRepo.existsBySepayId(sepayId) ← UNIQUE(sepay_id) guard
  │   → nếu duplicate → return (SePay nhận 200, không retry)
  ├─ transferType == "in" check
  ├─ extractPaymentCode(memo):
  │   → regex DFINV[0-9A-F]{12} trên payload.code() rồi payload.content()
  ├─ invoiceRepo.findByPaymentCode(code) → match invoice
  ├─ recordEvent() → INSERT org_payment_events (audit)
  ├─ status IN ('DRAFT','SENT') check
  ├─ amount >= invoice.amountVnd check
  ├─ invoice.setStatus("PAID") → UPDATE
  └─ activateOrg(invoice)
      ├─ org.setStatus("ACTIVE")
      ├─ org.setValidUntil(periodEnd + 1 day)
      └─ adminOrgService.activateEntitlements(orgId)
          → re-grant subscription to ALL ACTIVE STUDENT members
```

### Bước 4 — Thêm/bớt student GIỮA chu kỳ

Invoice là bản ghi tĩnh. Khi thêm/bớt student:

| Sự kiện | Ảnh hưởng đến invoice? | File |
|---|---|---|
| Add student qua roster | KHÔNG | `OrgRosterService.java:139` |
| Remove student | KHÔNG | `OrgMembershipService.java:65-78` |
| Invoice đã PAID | Vẫn PAID, không recalculate | `OrgBillingService.java:78-91` |

**⚠️ ĐIỂM YẾU G** — Khi `activateOrg` chạy, `activateEntitlements` grant subscription cho toàn bộ ACTIVE STUDENT members tại thời điểm thanh toán — không phải số seats trên invoice. Nếu org có 50 students nhưng invoice ghi 10 seats, toàn bộ 50 students vẫn được kích hoạt sau khi payment về.

**Điểm yếu nghiêm trọng nhất của luồng này là** không có validation link giữa `org_invoices.seats` và `org_members` count — `activateEntitlements` kích hoạt theo danh sách member thực tế, không theo số seats trên invoice (`OrgBillingService.java:50-68`). Billing là hệ thống ghi chép thủ công hoàn toàn tách biệt với seat enforcement.

---

## LUỒNG 4: Admin tạo org + cấp seat + gán role

### Bước 1 — Tạo Organization
**`AdminOrgService.java:67-92`** — `POST /api/v2/admin/orgs`
`@PreAuthorize("hasRole('ADMIN')")` tại `AdminOrganizationController.java:32`

```
@Transactional
createOrganization(CreateOrgRequest req)
  ├─ slug = slugify(req.name())
  ├─ organizationRepository.existsBySlug(slug) → ConflictException nếu trùng
  ├─ Organization.builder()
  │   .name(req.name().trim())
  │   .slug(slug)
  │   .planCode(normalizePlanCode(req.planCode()))  ← validate whitelist
  │   .seatLimit(req.seatLimit() ?? 0)             ← 0 = unlimited
  │   .monthlyTokenPool(0)                         ← default: unlimited pool
  │   .status("ACTIVE")
  │   → INSERT organizations
  └─ attachOwner(org.getId(), req.ownerEmail())
      ├─ Nếu email tồn tại trong users:
      │   orgMembershipService.upsertMember(orgId, userId, "OWNER")
      └─ Nếu email chưa tồn tại:
          orgInvitationService.inviteTeacher(actorId, orgId, email)
          catch (RuntimeException ex) → log.warn, tiếp tục   ← ĐIỂM YẾU H
```

Toàn bộ trong một `@Transactional`.

**⚠️ ĐIỂM YẾU H** — `attachOwner` gọi `inviteTeacher` và bắt RuntimeException, tiếp tục tạo org dù chưa có owner. Org được tạo thành công nhưng lời mời OWNER bị nuốt lỗi (`AdminOrgService.java` — khớp với `log.warn` trong attachOwner). Không có cơ chế retry hay alert.

### Bước 2 — Gán membership (upsertMember)
**`OrgMembershipService.java:38-59`**

```
@Transactional
upsertMember(orgId, userId, role)
  │
  ├─ memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
  │   → INSERT hoặc UPDATE org_members (role, status="ACTIVE")
  │
  ├─ userRepository.findById(userId)
  ├─ user.setOrgId(orgId)          ← SET users.org_id
  │
  ├─ Nếu role IN ("ADMIN","TEACHER") AND user.role == STUDENT:
  │   user.setRole(User.Role.TEACHER)  ← auto-promote role!  (:55-57)
  │
  └─ userRepository.save(user)   ← UPDATE users (org_id, role)
```

**⚠️ ĐIỂM YẾU I** — Auto-promote `STUDENT → TEACHER` khi gán org role `ADMIN` hoặc `TEACHER` (`OrgMembershipService.java:55-57`). Nhưng không có auto-demote ngược lại: nếu sau đó remove member khỏi org, `removeMember()` chỉ set `org_id = null` và `status = REMOVED` (`:65-78`), **không restore role về STUDENT**. Một student bị gán làm teacher trong org B, sau đó bị remove, vẫn có `role = TEACHER` trong hệ thống với quyền truy cập tất cả teacher endpoints.

### Bước 3 — Roster import (bulk)
**`OrgRosterService.java:61-159`**

```
@Transactional
importStudents(orgId, csvText, classIdOrNull)
  │
  for row in csv:
    try {
      isNewMember = (existing == null) || (không có trong org_members)  (:111-112)

      if (isNewMember && seatLimit > 0
          && membershipService.countByRole(orgId, "STUDENT") >= seatLimit):   ← SELECT COUNT(*)  (:113-114)
        seatLimitHit = true  (:116)
        break           ← dừng TẤT CẢ các hàng, kể cả hàng existing member tiếp theo  (:121)

      upsertMember(orgId, userId, "STUDENT")  ← SET users.org_id trong cùng transaction  (:139)
      entitlementService.grantStudent(userId, org)  (:140)

    } catch (Exception ex):   (:149)
      failed++
      errors.add(...)   ← lỗi mỗi hàng không abort toàn bộ import
```

**⚠️ ĐIỂM YẾU J — Race condition seat limit**: `countByRole()` là `SELECT COUNT(*)` không có `FOR UPDATE` lock (`OrgRosterService.java:113-114`). Hai request import CSV đồng thời cùng đọc count=9, seatLimit=10, cả hai đều thêm 1 student → tổng thực tế 11 seats, vượt limit. Không có database-level enforcement.

**⚠️ ĐIỂM YẾU K — `break` khi hit seat limit**: `OrgRosterService.java:121`. Khi hàng thứ N là new student và vượt seat limit, `break` dừng toàn bộ vòng lặp — các hàng tiếp theo dù là **existing member** (đã có trong org) cũng không được xử lý. Comment thừa nhận: *"existing members below would still be allowed, but per contract we halt new additions here"* — nhưng code dùng `break` thay vì `continue`, nên việc re-link existing member từ hàng tiếp theo bị bỏ qua.

### Tổng quan dữ liệu biến đổi trong Flow 4

| Bước | Bảng bị ghi | Điều kiện rollback |
|---|---|---|
| Tạo org | `organizations` | Trùng slug |
| Attach owner | `org_members`, `users` (org_id, role) | Trong tx của createOrganization |
| Roster import | `users` (new), `org_members`, `user_subscriptions`, class_students | Per-row try-catch, không full rollback |

**Điểm yếu nghiêm trọng nhất của luồng này là** auto-promote `STUDENT → TEACHER` khi gán org membership (`OrgMembershipService.java:55-57`) mà không có auto-demote khi remove — một student bị assigned teacher role cho org sau đó bị remove vẫn giữ `ROLE_TEACHER` toàn hệ thống, có thể truy cập mọi teacher endpoint.

---

## Tổng hợp điểm yếu theo mức độ

| ID | Luồng | File:Dòng | Mô tả | Mức độ |
|---|---|---|---|---|
| **E** | 2 | `InterviewEvaluationService.java:75` | `catch(Exception)` nuốt QuotaExceededException + không ghi ledger | 🔴 Cao |
| **I** | 4 | `OrgMembershipService.java:55-57` | Auto-promote STUDENT→TEACHER, không có auto-demote khi remove | 🔴 Cao |
| **J** | 4 | `OrgRosterService.java:113-114` | Race condition seat limit: SELECT COUNT không có lock | 🟠 Trung bình-Cao |
| **G** | 3 | `OrgBillingService.java:50-68` | `seats` trong invoice không link với `org_members` thực tế | 🟠 Trung bình-Cao |
| **A** | 1 | `AuthService.java:114` | `System.err.println` cho lỗi trial provision — biến mất khỏi log | 🟠 Trung bình |
| **D** | 2 | `QuotaService.java:47-64` | Soft cap race: check và debit trong 2 transaction riêng | 🟡 Thấp-Trung bình |
| **H** | 4 | `AdminOrgService.java` attachOwner | Invite failure bị nuốt, org tạo thành công không có owner | 🟡 Thấp-Trung bình |
| **K** | 4 | `OrgRosterService.java:121` | `break` khi hit seat limit bỏ qua cả existing member ở hàng sau | 🟡 Thấp |
| **B** | 1 | `JwtAuthFilter.java:129` | 1 DB query per request để load user, không cache | ℹ️ Perf |
| **F** | 3 | `OrgController` | Thêm member đơn lẻ qua API không check seat limit | 🟡 Thấp |
