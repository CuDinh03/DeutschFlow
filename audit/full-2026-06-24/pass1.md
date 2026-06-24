# PASS 1 — BẢN ĐỒ KIẾN TRÚC DEUTSCHFLOW (audit lại 2026-06-24)

> Chỉ lập bản đồ. Không phán xét. Mọi nhận xét kèm `file:dòng`. Số dòng đã **xác minh lại** với code hiện tại (codebase đã dịch chuyển từ pass1 cũ 2026-06-20: thêm các PR #150–#165).

---

## 0. Điểm lệch giữa tài liệu và code (verify, đừng tin)

| Nguồn | Khẳng định | Thực tế (code) | Kết luận |
|---|---|---|---|
| Prompt §4 bản đồ khởi điểm | "Java 17 + Spring Boot 3" (kèm "cần verify") | `<java.version>17</java.version>` `backend/pom.xml:21`; compiler `source/target/release=17` `pom.xml:279-281`; Spring Boot `3.2.5` `pom.xml:10` | **Đúng** — Java 17, SB 3.2.5 |
| `audit/pass1.md` cũ (dòng 9) | "Java **21** + Spring Boot 3" | Java 17 (xem trên) | **pass1 cũ SAI** — không phải 21. Ghi nhận lệch. |
| Prompt mô tả gốc (lịch sử) | "backend Node.js" | Spring Boot monolith | Sai (đã được pass1 cũ sửa) |
| Prompt §4 | "~237 migration" | `ls db/migration | wc -l` = **237** | Đúng |
| Prompt §4 | "~31 module domain" | 33 package domain dưới `com/deutschflow/` (xem §1) | Gần đúng |

---

## 1. Module/layer chính

### 1.1 Backend (`backend/src/main/java/com/deutschflow/`) — 33 package, 102 controller

| Package | Trách nhiệm | #Controller |
|---|---|---|
| `common/config` | SecurityConfig, CORS, async, Hikari, cache | (common: 3) |
| `common/security` | JwtAuthFilter, JwtService, SseTicketService, SessionTurnGuard | — |
| `common/quota` | QuotaService, AiUsageLedgerService, FreeTierGuard, OrgPoolGuard(*) | — |
| `common/exception` | GlobalExceptionHandler | — |
| `common/resilience` | Circuit breaker (Resilience4j, dùng registry programmatic) | — |
| `user` | User, UserDetailsService, onboarding, mentor, auth | 12 |
| `organization` | Organization, OrgMember, OrgGuard, OrgQuotaService, OrgPoolGuard, billing | 5 |
| `payment` | Stripe, MoMo, Apple, SePay webhook + subscription | 4 |
| `speaking` | AI speaking session, TTS, persona (đường tốn tiền nhất) | 11 |
| `interview` | Phỏng vấn AI (tách khỏi speaking) | 2 |
| `teacher` | Grading, TeacherMaterial, schedule, co-teaching, gradebook | 16 |
| `admin` | AdminOrganization, reports, AI-cost | 5 |
| `grammar` | Nội dung + AI syllabus | 9 |
| `vocabulary` | Từ vựng | 7 |
| `curriculum` | Phase, lesson tree | 6 |
| `marketing` | Landing/marketing (MỚI so với pass1 cũ) | 3 |
| `gamification` | Coin economy (`gamification/coin`) | 2 |
| `notification` | Bell, push, broadcast | 2 |
| `ai` | RAG / pgvector, AI helpers | 2 |
| `aiimage` | Sinh ảnh AI (MỚI) | 1 |
| `news` | Tin tức (MỚI) | 1 |
| `messaging` | Nhắn tin (MỚI) | 1 |
| `video` | Bài học video + AI | 1 |
| `practice` | Practice node + AI | 1 |
| `phoneme` | Chấm phát âm (STT) | 1 |
| `progress` | Tiến độ học | 1 |
| `training` | Training | 1 |
| `srs` | FSRS-4.5 vocab scheduler | 1 |
| `assessment` | Mock exam, B1/B2 | 1 |
| `material` | Tài liệu | 1 |
| `media` | Media (public GET) | 1 |
| `beginner` | Nội dung sơ cấp | 1 |
| `system` | Nightly jobs, SubscriptionReconcileJob | — |

(*) `OrgPoolGuard`/`OrgQuotaService` đặt ở `organization/service/` nhưng được `common/quota` gọi xuyên domain — đây là **đường ghép ngang duy nhất** ngoài `common/`.

Mỗi domain: `controller → service → repository → entity`. Không có shared service ngang trừ `common/`.

### 1.2 Frontend — Next.js 14 App Router (`frontend/src/`)
`app/` (route group `(auth)`, `admin`, `org`, `teacher`, `student`, `v2/*`), `components/`, `stores/` (Zustand), `lib/api/*` (axios → `:8080`), `middleware.ts` (route guard), `messages/` + `i18n/`, Sentry, PWA. → chi tiết Pass 5.

### 1.3 Mobile — Expo / React Native (`mobile/`) + iOS native (`ios/DeutschFlow.xcodeproj`)
`app.json`, `eas.json`; iOS native dùng OpenAPI codegen tái dùng backend Spring. → chi tiết Pass 5.

### 1.4 Hạ tầng (`docker/`, root)
`docker-compose.prod.yml`, `docker-compose.ai.yml`, `amplify.yml`, `deploy-backend.sh`, `cleanup-deploy.sh`, nginx, observability (Prometheus/Grafana/Loki/Promtail/Alertmanager). → chi tiết Pass 6.

---

## 2. Luồng một HTTP request (endpoint AI tốn tiền)

Ví dụ `POST /api/ai-speaking/...` (Groq LLM):

```
[Client]  Authorization: Bearer <JWT>   (hoặc ?ticket= cho SSE)
  ▼
[Tomcat]  max=48 / min-spare=10   (application.yml:180-181)
  ▼
[Spring Security Filter Chain]   (SecurityConfig.java)
  csrf disabled :48 · cors pass-through :49 · session STATELESS :50
  exceptionHandling (1 block, M-1 đã sửa) :54-56
  │
  ├─ JwtAuthFilter  addFilterBefore(UsernamePassword…) :115
  │    ├─ đọc header "Authorization" :48 ; Bearer substring(7) :53
  │    ├─ không header → ?ticket= (SSE single-use) :57 ; consume() :59
  │    ├─ subject "guest:" → ROLE_GUEST, KHÔNG query DB :104-111
  │    └─ user thường → userCache.get(subject, loadUserByUsername) :141
  │         Caffeine 60s / 10k  :38-41   (S-2 fix)
  │         user không tồn tại → sendError(401) :151
  │
  └─ AuthorizationFilter:  permitAll matchers (xem §6.2) · anyRequest().authenticated() :112
  ▼
[Controller]  @AuthenticationPrincipal UserDetails → extract userId → gọi service
  ▼
[Service]  quotaService.assertAllowed(userId, now, estTokens)  QuotaService.java:64
            → vượt → QuotaExceededException → 429
            → gọi Groq/Bedrock/TTS/STT
            → AiUsageLedgerService.record(...) → INSERT ledger + applyUsageDebit
  ▼
[Data]  JdbcTemplate (SQL) + JPA/Hibernate · HikariCP max=20 (application.yml:79)
        connection-timeout 5000ms :81 · statement_timeout '30s' :94
  ▼
[Response]  200 / 429 / 401 / 403 / 500
```

**Bất biến**: service layer không nhận `Authentication`; controller extract `userId` từ `UserDetails` rồi truyền xuống.

---

## 3. Tenant — phân biệt & truyền

### 3.1 Mô hình
**Single-DB, column-based tenancy** (không schema riêng, không subdomain):
```
users(id, email, role, org_id)              org_id NULL=B2C, NOT NULL=org member
organizations(id, name, slug, plan_code, seat_limit, monthly_token_pool, valid_until)
org_members(org_id, user_id, role[OWNER/MANAGER/TEACHER/STUDENT], status[ACTIVE/...])  composite PK
```
> Lưu ý: role org đã đổi `ADMIN → MANAGER` (PR #152 first-class OWNER/MANAGER), khác pass1 cũ.

### 3.2 Truyền context
Tenant **không** đi qua thread-local/SecurityContext claim. Mỗi nơi tự query:
- Token accounting: `OrgQuotaService.wouldExceedOrgPool` resolve org qua **`org_members`** (`OrgQuotaService.java:72-81`) — **đã đổi** so với pass1 cũ (trước resolve qua `users.org_id`; đây là fix T-1/D-1, wave5). 
- Authorization: `OrgGuard.assertMember(userId, orgId)` re-verify `org_members` từ DB, **không tin JWT `orgRole`** (claim chỉ cho FE routing/UI).

### 3.3 Hai hệ role song song
| Hệ | File | Giá trị |
|---|---|---|
| `User.Role` (platform/Spring authorities) | `User.java` | `STUDENT, TEACHER, ADMIN` (+ OWNER/MANAGER first-class, PR #152) |
| `OrgMember.role` (org RBAC) | `OrgMember.java` | `OWNER, MANAGER, TEACHER, STUDENT` |

Spring authorities = `"ROLE_" + role.name()`. `@PreAuthorize` dùng `ROLE_*`. OrgMember.role là RBAC org-level riêng, re-verify ở service.

---

## 4. Token-pool — chốt enforcement (file + hàm + dòng, hiện tại)

> Liệt kê **đầy đủ** call-site LLM/TTS/STT là việc của **Pass 3** (sau khi enumerate hết). Đây chỉ là sơ đồ 2 đường chốt đã biết, số dòng verify lại.

```
Path A — assertAllowed (user wallet + org pool gộp 1 chỗ):
  QuotaService.assertAllowed(userId, now, estTokens)   QuotaService.java:64
    :66-68  INTERNAL → unlimited (bỏ mọi check)
    :77     remainingSpendable()<=0 → QuotaExceededException
    :80     estTokens > remainingSpendable() → exception
    :85     orgQuotaService.wouldExceedOrgPool(userId, estTokens) → exception
  gọi tại: ChatPrep / Interview / Conversation / WeeklySpeaking / Practice / SkillTree /
           AiSpeakingMockExam / AiSession / … (Pass 3 enumerate đủ)

Path B — OrgPoolGuard (chỉ org pool, dùng cho đường KHÔNG qua assertAllowed):
  OrgPoolGuard.assertOrgPoolAvailable(userId, estTokens)   OrgPoolGuard.java:29
    → orgQuotaService.wouldExceedOrgPool(...) → :35 QuotaExceededException
  gọi tại: Grading / ImageGrade / PPTX / GrammarSyllabus generate / …

Ghi nhận sau khi dùng:
  AiUsageLedgerService.record(...) → INSERT ai_token_usage_events
  QuotaService.applyUsageDebit(userId, tokens, now)   QuotaService.java:113
    :140  UPDATE user_ai_token_wallets SET balance = GREATEST(0, balance-?)  (clamp)
    :135  log.warn "[Quota][P-9/P-11][OVERAGE] …"  (P-11: log thất thu khi clamp)
```

### 4.1 Org pool usage — nguồn đếm (đã đổi)
`OrgQuotaService.java:32-38`: đọc `org_monthly_token_counters.tokens_used` (bảng đếm V224, PK theo `org_id` + `month_start`), **không còn** `SUM(total_tokens)` mỗi request (fix S-3/P-10 wave7). Cửa sổ tháng: `date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')` (`OrgQuotaService.java:35`) — đã canh VN-day (fix M-3). Alert 80%: `:90/:100`, hằng `POOL_ALERT_PERCENT=80` `:118`.

### 4.2 OrgPoolGuard vẫn **check-only**
`OrgPoolGuard` không reserve/increment atomic; chỉ CHECK trước job đắt. → soft-cap (P-9/P-10) còn nguyên (xem §6).

---

## 5. Subscription → plan code

`QuotaService.java:523-531`:
```sql
SELECT us.id, us.plan_code, us.starts_at, us.ends_at,
       COALESCE(us.monthly_token_limit_override, sp.daily_token_grant) AS dailyGrant,
       sp.wallet_cap_days
FROM user_subscriptions us
JOIN subscription_plans sp ON sp.code = us.plan_code
WHERE us.user_id = ? AND us.status='ACTIVE' AND us.starts_at <= ? AND (us.ends_at IS NULL OR us.ends_at > ?)
ORDER BY us.starts_at DESC LIMIT 1
```
Plan code (hằng): `DEFAULT :25`, `FREE :26`, `PRO :27`, `ULTRA :28`, `INTERNAL :29` (QuotaService).
Seed `subscription_plans` (V38): **FREE / PRO / INTERNAL** có row. **ULTRA KHÔNG được seed trong V38** → xem M-6.

---

## 6. Mâu thuẫn / KHÔNG CHẮC (trạng thái hiện tại, chưa chấm điểm)

### Kế thừa từ pass1 cũ (M-1…M-5) — trạng thái đã verify:
- **M-1** (exceptionHandling dup) — **ĐÃ SỬA**: chỉ còn 1 block `SecurityConfig.java:54-56`. ✅
- **M-2 / T-1 / D-1** (lệch `users.org_id` vs `org_members`) — **ĐÃ SỬA**: `OrgQuotaService` resolve qua `org_members` (`:72-81`). Còn câu hỏi đồng bộ cột `users.org_id` (Pass 4).
- **M-3** (timezone org pool) — **ĐÃ SỬA**: VN timezone (`:35`). ✅
- **M-4 / P-10** (race org pool) — **CẢI THIỆN một phần**: counter table V224 giảm cost nhưng `OrgPoolGuard` vẫn check-only, không reserve → race vượt pool vẫn lý thuyết khả thi. Pass 2/3 truy.
- **M-5** (`FreeTierGuard` chỉ B2C → org pool=0 = unlimited backdoor) — **DEFERRED**; PR #126/#5085edbf thêm `pool_unlimited` flag + deploy-gate (`audit/m5_deploy_gate.sql`). Cần verify code dùng flag đúng (Pass 3).

### Mới phát hiện ở Pass 1 (cần truy ở pass sau — chưa phán xét):
- **M-6** — `ULTRA` là plan code hợp lệ (`QuotaService.java:28`) nhưng **không có row trong `subscription_plans` (V38)**. Nếu user có subscription `plan_code='ULTRA'` mà không migration nào seed ULTRA → JOIN `subscription_plans` trả 0 row → snapshot/plan ra sao? (NPE / fallback DEFAULT / quota = 0?). **KHÔNG CHẮC** — verify Pass 2 (L1/L3) + Pass 4. Phải grep mọi migration xem ULTRA có được seed về sau không.
- **M-7** — 4 webhook thanh toán đều `permitAll` (không auth): MoMo IPN `SecurityConfig.java:80`, Stripe `:82`, Apple `:84`, SePay `:86`. An toàn phụ thuộc HOÀN TOÀN vào verify chữ ký + idempotency trong controller. **Bản đồ-only**; đánh giá L5 (Pass 2).
- **M-8** — Các module AI **mới** (marketing, news, aiimage, interview, video, practice, phoneme) ra đời sau lần enumerate call-site cũ (P-1…P-8). **KHÔNG CHẮC** mọi đường LLM/TTS/STT trong chúng đã qua `assertAllowed`/`OrgPoolGuard`/ledger chưa. → Pass 3 phải enumerate lại TOÀN BỘ, không lấy mẫu.
- **M-9** — `/api/public/**` `permitAll` `SecurityConfig.java:93` (org invitations) và `GET /api/v2/media/**` `:90`. **KHÔNG CHẮC** phạm vi controller phía sau — có rò thông tin org/tenant không. → Pass 3.

---

## 7. Danh sách file đã đọc để kiểm chứng (Pass 1)

```
backend/pom.xml                                                   (toàn bộ, 365 dòng)
audit/pass1.md (cũ), audit/REMEDIATION.md, audit/wave1-8 (qua agent, để kế thừa ID)
backend/src/main/java/com/deutschflow/common/config/SecurityConfig.java   (qua agent: :48-115)
backend/src/main/java/com/deutschflow/common/security/JwtAuthFilter.java  (qua agent: :38-151)
backend/src/main/java/com/deutschflow/common/quota/QuotaService.java      (qua agent: :25-29,64-140,523-531; 672 dòng)
backend/src/main/java/com/deutschflow/organization/service/OrgQuotaService.java (qua agent: :32-118; 142 dòng)
backend/src/main/java/com/deutschflow/organization/service/OrgPoolGuard.java    (qua agent: :29-35)
backend/src/main/resources/application.yml                       (qua agent: :55-244)
backend/src/main/resources/db/migration/V38__subscription_plans_and_user_subscriptions.sql (qua agent)
git log --since=2026-06-20 (PR #150-#165) ; find *Controller.java (102 file, theo module)
```

**Tóm tắt**: Spring Boot 3.2.5 / Java 17 monolith, JWT stateless (HS256 mặc định, có nhánh RS256), tenancy column-based qua `org_members`. Token-pool 2 đường chốt (assertAllowed + OrgPoolGuard); org pool nay dùng counter table V224 canh VN-day. Phần lớn finding cũ ĐÃ SỬA (M-1/M-3/T-1/S-2/S-3). Còn mở/đáng truy: soft-cap race (P-9/P-10), M-5 backdoor flag, **M-6 ULTRA chưa seed**, **M-7 webhook permitAll**, **M-8 module AI mới chưa verify gate**, **M-9 public endpoints**. Pass 2 bắt đầu trace L1–L5.
