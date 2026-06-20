# PASS 1 — BẢN ĐỒ KIẾN TRÚC DEUTSCHFLOW

> Chỉ lập bản đồ. Không phán xét. Mọi nhận xét kèm `file:dòng`.

---

## 0. Lưu ý đầu tiên: Backend KHÔNG phải Node.js

Prompt mô tả "backend Node.js" — **sai**. Backend là **Java 21 + Spring Boot 3**, build bằng Maven. Frontend là **Next.js 14** (App Router). Mobile là **Expo / React Native**.

---

## 1. Các module/layer chính

### Backend (`backend/src/main/java/com/deutschflow/`)

| Package | Trách nhiệm | Cấu trúc nội bộ |
|---|---|---|
| `common/config` | SecurityConfig, CORS, async, Hikari | Cấu hình cross-cutting |
| `common/security` | JwtAuthFilter, JwtService, SseTicketService | Auth filter chain |
| `common/quota` | QuotaService, AiUsageLedgerService, FreeTierGuard, OrgPoolGuard | Kiểm soát token AI |
| `common/exception` | GlobalExceptionHandler | Xử lý lỗi tập trung |
| `common/resilience` | Circuit breaker | DB conn-pool protection |
| `user` | User entity, UserDetailsService, onboarding, mentor | Quản lý người dùng |
| `organization` | Organization, OrgMember, OrgGuard, OrgQuotaService | B2B tenant layer |
| `payment` | Stripe, MoMo, Apple, SePay webhooks | Thanh toán + subscription |
| `speaking` | AI speaking sessions, TTS, interview, persona | Tính năng nói AI (đắt nhất) |
| `curriculum` | Phase, lesson tree | Lộ trình học |
| `srs` | FSRS-4.5 vocab scheduler | Spaced repetition |
| `assessment` | Mock exam, B1/B2 tests | Thi thử |
| `grammar`, `vocabulary`, `beginner` | Nội dung học theo loại | Feature domains |
| `teacher` | GradingController, TeacherMaterialController | Teacher tools |
| `admin` | AdminOrganizationController, reports | Quản trị hệ thống |
| `gamification/coin` | Student coin economy | Coin earn/spend |
| `notification` | Bell, push, scheduled broadcast | Thông báo |
| `ai/rag` | Vector search (pgvector) | RAG pipeline |
| `system` | Nightly jobs | Background tasks |

Mỗi domain có cấu trúc `controller → service → repository → entity` riêng biệt. Không có shared service layer theo chiều ngang — từng domain tự chứa trừ `common/quota`.

---

## 2. Luồng một HTTP request

Ví dụ: `POST /api/ai-speaking/greeting-session`

```
[Client]
  │  Authorization: Bearer <JWT>
  ▼
[Tomcat thread pool]
  max=48, min-spare=10
  (application.yml:169-177)
  ▼
[Spring Security Filter Chain]
  ─────────────────────────────────────────────────────
  1. CorsFilter (cấu hình từ common/config/CorsConfig)

  2. JwtAuthFilter  ← TRƯỚC UsernamePasswordAuthenticationFilter
     (SecurityConfig.java:118)
     │
     ├─ Đọc header "Authorization"
     │  (JwtAuthFilter.java:36-41)
     ├─ Nếu không có header → thử ?ticket= (SSE path)
     │  (JwtAuthFilter.java:45-57)
     ├─ Không có gì → log debug, tiếp tục chain
     │  (JwtAuthFilter.java:64-68)
     ├─ Có token → jwtService.isTokenValid(token)
     │  (JwtAuthFilter.java:73)
     ├─ Token invalid → log warn, tiếp tục (KHÔNG throw)
     │  (JwtAuthFilter.java:76-80)
     ├─ subject bắt đầu "guest:" → set ROLE_GUEST, KHÔNG query DB
     │  (JwtAuthFilter.java:92-107)
     └─ Ngược lại → authenticateRegisteredUser()
        (JwtAuthFilter.java:110-118)
        │
        ├─ userDetailsService.loadUserByUsername(email)
        │  (JwtAuthFilter.java:129)  ← 1 DB query / request
        ├─ set SecurityContextHolder với UserDetails + authorities
        │  (JwtAuthFilter.java:133)
        └─ Nếu user không tồn tại → sendError(401), return false
           (JwtAuthFilter.java:139)

  3. AuthorizationFilter (built-in Spring Security)
     ├─ Khớp với requestMatchers().permitAll() → cho qua
     ├─ Khớp với .authenticated() → kiểm tra SecurityContext
     └─ anyRequest().authenticated() (SecurityConfig.java:112)
        Nếu không có auth → authenticationEntryPoint → 401
  ─────────────────────────────────────────────────────
  ▼
[DispatcherServlet → HandlerMapping]
  Route đến: SpeakingController
  (package: speaking/controller/)
  ▼
[Controller]
  @AuthenticationPrincipal UserDetails principal
  → resolve từ SecurityContext (đã set ở filter)
  → gọi service với userId
  ▼
[Service Layer]
  ví dụ: ChatPrepService.java:189
  quotaService.assertAllowed(userId, Instant.now(), 1L)
  → nếu vượt quota → QuotaExceededException → 429
  → gọi Groq/LLM API
  → AiUsageLedgerService.record(...) → ghi DB + debit wallet
  ▼
[Data Layer]
  JdbcTemplate (trực tiếp SQL) + JPA/Hibernate (entity)
  HikariCP pool: max=20 connections (application.yml:72)
  PostgreSQL statement_timeout=30s (application.yml:87)
  ▼
[Response]
  200 / 429 / 401 / 403 / 500
```

**Điểm quan trọng**: Service layer KHÔNG nhận `Authentication` object — controller extract `userId` từ `UserDetails` rồi truyền xuống. Các service không biết về JWT hay HTTP context.

---

## 3. Tenant phân biệt và truyền như thế nào

### 3.1 Mô hình tenant

**Single-database, column-based tenancy** — KHÔNG phải schema riêng, KHÔNG phải subdomain.

```
users (bảng)
  id | email | role | org_id  ← NULL = B2C, NOT NULL = org member
                               (User.java:61-63)

organizations (bảng)
  id | name | slug | plan_code | seat_limit | monthly_token_pool | valid_until
                                              (Organization.java:42-44)

org_members (bảng)
  org_id | user_id | role (OWNER/ADMIN/TEACHER/STUDENT) | status
  (OrgMember.java:17-35, composite PK: OrgMemberId.java)
```

### 3.2 Luồng tenant context

Tenant **KHÔNG được truyền qua thread-local hay SecurityContext claim**. Mỗi nơi cần biết org của user đều tự query DB:

```
OrgQuotaService.wouldExceedOrgPool(userId, ...)
  → SELECT org_id FROM users WHERE id = ?
     (OrgQuotaService.java:65-74)
  → nếu orgId == null → return false (B2C bypass)
     (OrgQuotaService.java:75-76)

OrgGuard.assertMember(userId, orgId)
  → query org_members để xác nhận tư cách thành viên
     (OrgGuard.java:31-33)
```

JWT claim (`orgRole`) có tồn tại nhưng **chỉ dùng cho frontend routing/UI** — comment trong `OrgGuard.java:16-17` ghi rõ: "backend authz always re-verifies membership in `org_members` from the DB rather than trusting the JWT `orgRole` claim".

### 3.3 Hai hệ thống role song song

| Hệ thống | File | Giá trị |
|---|---|---|
| User.Role (app role) | `User.java:112` | `STUDENT, TEACHER, ADMIN` |
| OrgMember.role (org role) | `OrgMember.java:22` | `OWNER, ADMIN, TEACHER, STUDENT` |

Spring Security authorities lấy từ `User.Role` → `"ROLE_" + role.name()` (`User.java:79`). `@PreAuthorize` dùng `ROLE_TEACHER`, `ROLE_ADMIN`, `ROLE_STUDENT`. OrgMember.role là org-level RBAC riêng.

---

## 4. Token-pool: chính xác file + hàm + dòng

### 4.1 Sơ đồ enforcement

```
[Request đến AI feature]
  │
  ├── Path A: Speaking / Interview / Weekly
  │   quotaService.assertAllowed(userId, now, 1L)
  │   → ChatPrepService.java:189,312
  │   → InterviewEvaluationService.java:59
  │   → ConversationEvaluationService.java:61
  │   → WeeklySpeakingService.java:143
  │
  └── Path B: Grading / PPTX (đắt, không qua assertAllowed)
      orgPoolGuard.assertOrgPoolAvailable(userId, estimatedTokens)
      → GradingController.java:105  (GRADING_ESTIMATED_TOKENS)
      → GradingController.java:128  (IMAGE_GRADE_ESTIMATED_TOKENS)
      → TeacherMaterialController.java:74  (PPTX_ESTIMATED_TOKENS)
      → TeacherController.java:273  (GRADING_ESTIMATED_TOKENS)
```

### 4.2 `QuotaService.assertAllowed` — luồng chi tiết

**File**: `common/quota/QuotaService.java`

| Dòng | Việc gì xảy ra |
|---|---|
| 47 | Entry point `assertAllowed(userId, nowUtc, estimatedMinTokens)` |
| 48 | `buildSnapshot(userId, nowUtc)` → reconcile subscriptions + load plan |
| 49-51 | Nếu `INTERNAL` plan → bỏ qua tất cả kiểm tra (`unlimitedInternal()`) |
| 52-53 | Nếu `remainingSpendable() <= 0` → `QuotaExceededException` |
| 55-57 | Nếu `estimatedMinTokens > remainingSpendable()` → `QuotaExceededException` |
| 60-62 | `orgQuotaService.wouldExceedOrgPool(userId, estimatedMinTokens)` → nếu true → exception |
| 63 | Return snapshot (cho phép tiếp tục) |

### 4.3 `OrgQuotaService.wouldExceedOrgPool` — chi tiết

**File**: `organization/service/OrgQuotaService.java`

| Dòng | Việc gì xảy ra |
|---|---|
| 64 | `wouldExceedOrgPool(userId, estimatedTokens)` |
| 65-74 | `SELECT org_id FROM users WHERE id = ?` → lấy orgId |
| 75-76 | orgId == null → `return false` (B2C bypass) |
| 78-80 | `monthlyPool(orgId)` ≤ 0 → `return false` (pool chưa cấu hình) |
| 82 | `orgUsageThisMonth(orgId)` → `SUM(total_tokens) FROM ai_token_usage_events JOIN users WHERE u.org_id = ?` |
| 83 | `maybeAlert80()` → log warn khi chạm 80% pool |
| 84 | `exceeds(orgId, pool, used, estimatedTokens)` → `used + estimated > pool` |

### 4.4 Ghi ledger sau khi dùng

**File**: `common/quota/AiUsageLedgerService.java`

| Dòng | Việc gì xảy ra |
|---|---|
| 36-46 | `INSERT INTO ai_token_usage_events (user_id, ...)` |
| 47 | `quotaService.applyUsageDebit(userId, totalTokens, now)` → trừ wallet |

### 4.5 `OrgPoolGuard.assertOrgPoolAvailable`

**File**: `organization/service/OrgPoolGuard.java`

| Dòng | Việc gì xảy ra |
|---|---|
| 29 | `assertOrgPoolAvailable(userId, estimatedTokens)` |
| 30-32 | userId == null → no-op |
| 33 | `orgQuotaService.wouldExceedOrgPool(...)` |
| 34-38 | `QuotaExceededException` → HTTP 429 |

### 4.6 Subscription → plan code mapping

**File**: `common/quota/QuotaService.java:484-520`

```sql
SELECT us.plan_code, sp.daily_token_grant, sp.wallet_cap_days
FROM user_subscriptions us
JOIN subscription_plans sp ON sp.code = us.plan_code
WHERE us.user_id = ? AND us.status = 'ACTIVE'
  AND us.starts_at <= ? AND (us.ends_at IS NULL OR us.ends_at > ?)
ORDER BY us.starts_at DESC LIMIT 1
```

Plan codes: `DEFAULT`, `FREE` (7 ngày), `PRO` (wallet, 30 ngày), `ULTRA` (wallet), `INTERNAL` (unlimited, dùng cho staff).

---

## 5. Mâu thuẫn cấu trúc và chỗ KHÔNG CHẮC

### M1 — `exceptionHandling` đăng ký 2 lần trong cùng bean

**File**: `common/config/SecurityConfig.java:54` và `:115`

```java
// Dòng 54-56: lần 1
.exceptionHandling(e -> e
    .accessDeniedHandler(...)
    .authenticationEntryPoint(...))
// ...
// Dòng 115-117: lần 2, y hệt
.exceptionHandling(e -> e
    .accessDeniedHandler(...)
    .authenticationEntryPoint(...))
```

Spring Security cho phép cấu hình nhiều lần vào cùng configurer — lần sau ghi đè lần trước. Kết quả thực tế là cấu hình cuối (dòng 115) có hiệu lực. Lần đầu (dòng 54) là thừa. **KHÔNG CHẮC** đây có ý đồ gì khác hay chỉ là code thừa từ lần refactor.

### M2 — Hai nguồn membership song song: `users.org_id` vs `org_members`

`users.org_id` (cột flat) xác định org của user cho mục đích **token accounting** (`OrgQuotaService.java:65-74`).

`org_members` (bảng join) xác định org membership cho mục đích **authorization** (`OrgGuard.java:31-33`).

**Câu hỏi chưa rõ**: Hai nguồn có thể lệch nhau không? Ví dụ: một user bị xóa khỏi `org_members` (status=REMOVED) nhưng `users.org_id` vẫn còn trỏ về org đó → token vẫn bị tính vào pool org đó. **KHÔNG CHẮC** có cơ chế đồng bộ `users.org_id = NULL` khi member bị remove không — không tìm thấy logic này trong `OrgMembershipService` (lúc Pass 1; Pass 2 xác nhận removeMember CÓ clear org_id).

### M3 — `orgUsageThisMonth` dùng `date_trunc('month', now())` phía DB

**File**: `OrgQuotaService.java:28-35`

```sql
AND e.created_at >= date_trunc('month', now())
```

`now()` phía PostgreSQL theo timezone server. Quota window cá nhân (`QuotaService`) dùng timezone `Asia/Ho_Chi_Minh` (`QuotaVnCalendar.java`). Hai quota window không đồng nhất: cá nhân theo VN-day, org pool theo UTC-midnight của tháng calendar theo server timezone. **KHÔNG CHẮC** server DB timezone là gì — nếu UTC thì org pool reset đầu tháng UTC, còn personal quota reset theo VN day.

### M4 — `OrgPoolGuard` KHÔNG ghi usage sau khi check

`OrgPoolGuard.assertOrgPoolAvailable` chỉ CHECK, không lock. Nếu 2 request đến đồng thời khi pool gần cạn, cả hai đều pass check, tổng có thể vượt pool. Không có optimistic lock hay `SELECT FOR UPDATE`. **KHÔNG CHẮC** đây là ý đồ chấp nhận "soft cap" hay là bug race condition.

### M5 — `FreeTierGuard` chỉ áp cho B2C users

**File**: `FreeTierGuard.java:78-81`

```java
public boolean appliesTo(Long userId, Long orgId) {
    return userId != null && orgId == null;
}
```

Org member dùng tính năng PPTX/OCR không bị `FreeTierGuard` chặn — chỉ bị `OrgPoolGuard`. Nếu org pool = 0 (unlimited), giáo viên trong org có thể dùng PPTX không giới hạn mà không cần subscription cá nhân. **KHÔNG CHẮC** đây có phải design intent hay là gap.

---

## 6. Danh sách file đã đọc để kiểm chứng

```
backend/src/main/java/com/deutschflow/
  common/config/SecurityConfig.java          (toàn bộ, 139 dòng)
  common/security/JwtAuthFilter.java         (toàn bộ, 143 dòng)
  common/quota/QuotaService.java             (toàn bộ, 655 dòng)
  common/quota/AiUsageLedgerService.java     (toàn bộ, 49 dòng)
  organization/service/OrgQuotaService.java  (toàn bộ, 134 dòng)
  organization/service/OrgPoolGuard.java     (toàn bộ, 40 dòng)
  organization/service/OrgGuard.java         (toàn bộ, 44 dòng)
  organization/entity/Organization.java      (toàn bộ, 64 dòng)
  organization/entity/OrgMember.java         (toàn bộ, 35 dòng)
  organization/entity/OrgMemberId.java       (toàn bộ, 26 dòng)
  user/entity/User.java                      (toàn bộ, 114 dòng)

  (qua agent, đã xác minh với grep):
  backend/src/main/resources/application.yml
  backend/src/main/java/com/deutschflow/DeutschFlowApplication.java
  speaking/controller/SpeakingController.java
  speaking/service/ChatPrepService.java      (dòng 189, 312)
  speaking/service/InterviewEvaluationService.java (dòng 59)
  speaking/service/ConversationEvaluationService.java (dòng 61)
  speaking/service/WeeklySpeakingService.java (dòng 143)
  teacher/controller/GradingController.java  (dòng 36, 105, 126, 128)
  teacher/controller/TeacherMaterialController.java (dòng 41, 74)
  teacher/controller/TeacherController.java  (dòng 43, 273)
```

---

**Tóm tắt**: Backend là Spring Boot monolith, stateless JWT, single-DB column-based tenancy qua `users.org_id`. Token-pool enforcement có 2 đường: `QuotaService.assertAllowed` (speaking/interview) và `OrgPoolGuard.assertOrgPoolAvailable` (grading/PPTX). 4 điểm mâu thuẫn/không chắc đã được đánh dấu — M2 (membership sync) và M4 (race condition) là đáng chú ý nhất cho Pass 2.
