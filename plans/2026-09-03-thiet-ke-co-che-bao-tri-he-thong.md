# Thiết kế cơ chế bảo trì hệ thống & thông báo bảo trì

- **Ngày**: 03/09/2026 · **Trạng thái**: PR-A backend **ĐÃ THI HÀNH** 03/09 (nhánh `feat/maintenance-mode` — migration lấy **V301** vì main đã tiến tới V300, không phải V271 như ước tính lúc thiết kế; IT 14/14 + renderer 20/20 xanh trên PG thật; SRS module 11/12 + matrix + bản gộp cập nhật cùng đợt). PR-B web / PR-C mobile / PR-D deploy: CHƯA.
- **Phạm vi**: backend (Spring Boot), web (Next.js /v2), mobile (Expo), hạ tầng (nginx/EC2, repo `DeutschFlow-deploy`)
- **Tài liệu liên quan**: SRS module 11 (thông báo) & 12 (quản trị hệ thống) trong `TAI_LIEU_DAC_TA_SAN_PHAM/chi-tiet/modules/`

---

## 1. Bối cảnh & hiện trạng (đã khảo sát 03/09)

### 1.1. Vấn đề

1. **Mỗi lần deploy backend đã có ~2 phút downtime thật.** `deploy-backend.sh` gọi là blue-green nhưng bước promote là: gỡ GREEN (instance kiểm chứng :8081) → dừng BLUE → chạy container mới trên :8080 với JVM boot ~2 phút (`deploy-backend.sh` dòng 485–575). Trong cửa sổ đó nginx trả **502 thô**; web/mobile hiện lỗi chung chung, SRS offline queue và chat outbox còn **retry dồn dập vào server đang chết** (mobile `lib/api.ts` coi mọi 5xx là transient).
2. **Không có cách nào báo trước cho người dùng** khi cần bảo trì có kế hoạch (migration nặng, nâng DB, đổi hạ tầng).
3. **Không có công tắc bảo trì khẩn cấp** khi sự cố (chỉ có thể tắt app → người dùng thấy lỗi vô nghĩa).

### 1.2. Hạ tầng liên quan đã có sẵn (tái dùng tối đa)

| Mảnh | Hiện trạng | Nguồn |
|---|---|---|
| Chuỗi phục vụ | Cloudflare → nginx (host EC2) → Spring :8080 (Docker, chỉ bind 127.0.0.1). Web Next.js đứng riêng trên Amplify — **vẫn sống khi backend bảo trì** | `DeutschFlow-deploy/docker/deutschflow.nginx.conf` |
| Thông báo in-app | `user_notifications` (payload jsonb, KHÔNG lưu title/body — render lúc đọc bằng `NotificationContentRenderer`, switch exhaustive không `default`), SSE chỉ đẩy `unreadCount` rồi client refetch REST | `backend/.../notification/` |
| Broadcast | `UserNotificationService.broadcastToAudience()` audienceType `ALL/ROLE/TIER/SINGLE_USER` + bảng staging `scheduled_broadcasts` + `ScheduledBroadcastJob` (fixedDelay 60s, ShedLock) | như trên |
| Push | Expo push (`ExpoPushSenderService.sendAsync` — **mỗi call 1 token**, fire-and-forget), token ở `users.push_token` | như trên |
| Email | SMTP có cấu hình nhưng chỉ dùng cho mời org + reset password; health mail tắt chủ đích → **không dựa vào email cho bảo trì** | `application.yml` |
| Error envelope | **RFC 7807** `application/problem+json` (`ProblemDetail` record + `extensions`), có sẵn handler 503 mẫu `DB_UNAVAILABLE` kèm `Retry-After` | `GlobalExceptionHandler.java` |
| Config admin | Bảng `system_config` + `SystemConfigService` (@Cacheable) + pattern `AdminAiConfigController` GET/PUT + audit log | `admin/`, `system/` |
| Public + rate-limit | `/api/public/**` permitAll VÀ được `PublicApiRateLimitFilter` gác 30 req/min/IP (fail-open) | `SecurityConfig.java` |
| Scheduled + ShedLock | `JdbcTemplateLockProvider` usingDbTime, pattern chuẩn: job `@Component` delegate sang service `@Transactional` (tránh self-invocation) | `ShedLockConfig.java`, `ScheduledBroadcastJob.java` |
| Observability | Prometheus scrape backend + Alertmanager → Telegram đã sống end-to-end | `DeutschFlow-deploy/docker/prometheus/` |
| Readiness deploy | `/actuator/health` là cổng health-check của blue-green (curl localhost:8080 trực tiếp) | `deploy-backend.sh` |

### 1.3. Ràng buộc cứng rút từ khảo sát

- ⛔ **`/actuator/health` không được đổi ngữ nghĩa**: bảo trì bật mà health DOWN thì blue-green không bao giờ cắt được. Trạng thái bảo trì đi endpoint riêng.
- ⛔ **CORS do Spring xử lý** (`CORS_ALLOWED_ORIGINS`) → khi Spring chết, JSON 503 do nginx tự trả **phải tự kèm CORS header** thì web mới đọc được body.
- ⛔ Preflight: request kèm `Authorization` bị browser bắt preflight OPTIONS — nếu OPTIONS cũng 503 thì browser báo network error, web **không phân biệt được bảo trì với mất mạng**. → Client thăm dò bằng **simple request không auth header** (không preflight) + nginx vẫn trả 204 cho OPTIONS trong khối bảo trì.
- ⛔ Exception ném từ **servlet Filter không đi qua** `GlobalExceptionHandler` → filter bảo trì phải tự ghi JSON (theo pattern `PublicApiRateLimitFilter`, nhớ `setCharacterEncoding(UTF_8)` — thiếu là mojibake, đã có tiền lệ).
- ⛔ Mobile: bắt maintenance **trước** khối transient-retry (`lib/api.ts:159–167` retry ngầm mọi 503 GET), loại 503-maintenance khỏi Sentry report (`lib/api.ts:103–107`), và **cấm `router.replace` từ root layout** (footgun crash React 19 đã ghi tại `app/_layout.tsx:182–189`) — gate bằng overlay kiểu `SplashAnimated`.
- ⛔ Mobile OTA: tính năng chỉ đụng `app/ components/ lib/ stores/ hooks/` thì OTA được; **thêm dependency (vd NetInfo) là vỡ fingerprint** → thiết kế không thêm dep mới.
- ⛔ Migration: mới nhất trên đĩa **V269**; V270 đã bị kế hoạch email-verify nhận; các plan khác nhận tới V289 (có va chạm V285 giữa 2 plan). → Đợt này lấy **V271**, và người thi hành PHẢI rà lại V mới nhất + PR đang mở tại thời điểm code (bài học trùng số migration).
- ⚠️ `user_notifications` không bao giờ được dọn (retention job là file rỗng 1 byte) — broadcast ALL cộng thêm 1 dòng/người/lần gửi. ~~Chấp nhận ở quy mô hiện tại, ghi nợ kỹ thuật.~~ → **ĐÃ TRẢ NỢ 03/09/2026**: `UserNotificationRetentionJob` viết lại theo pattern job hiện hành (delegate `UserNotificationRetentionService` @Transactional, ShedLock, đọc `app.notifications.retention.*`), kèm IT — **PR #487 MERGED** (squash `12a65558`, 03/09), SRS NOTIF-08/AC-NOTIF-02; CÒN deploy BE rồi nghiệm thu AC-NOTIF-02.

---

## 2. Mục tiêu & không-mục-tiêu

**Mục tiêu**
1. Người dùng **biết trước** lịch bảo trì (in-app + push + banner đếm ngược), **hiểu chuyện gì đang xảy ra** khi hệ thống gián đoạn (trang/màn bảo trì tử tế thay vì lỗi thô), và **được báo khi xong**.
2. Vận hành có **3 công tắc** phủ 3 kịch bản: deploy thường (tự động, không thao tác), bảo trì có kế hoạch (đặt lịch), sự cố khẩn (một nút bật ngay).
3. Cơ chế **sống được khi chính backend chết** (tầng nginx độc lập với Spring).
4. Admin luôn còn đường vào hệ thống trong lúc bảo trì (bypass theo role).
5. Không phá deploy blue-green, không phá webhook thanh toán một cách im lặng, không flood Sentry/Expo.

**Không-mục-tiêu (đợt này)**
- Read-only mode / degraded mode từng phân hệ (chỉ có FULL và ANNOUNCE_ONLY).
- Email bảo trì hàng loạt (SMTP chưa đáng tin cho việc này).
- Trang status công khai độc lập kiểu `status.mydeutschflow.com` (có thể làm sau bằng Cloudflare Worker).
- Batching Expo push 100 msg/request (ghi là nâng cấp khi user base lớn).

---

## 3. Kiến trúc tổng thể — 3 tầng, 1 nguồn sự thật

```
                         ┌────────────────────────────────────────────┐
                         │  NGUỒN SỰ THẬT: bảng maintenance_windows   │
                         │  (SCHEDULED → ACTIVE → COMPLETED/CANCELLED)│
                         └───────┬───────────────────┬────────────────┘
                                 │                   │
            ┌────────────────────┤                   ├──────────────────────┐
            ▼                    ▼                   ▼                      ▼
   TẦNG A — nginx (EC2)   TẦNG B — Spring    THÔNG BÁO (tái dùng)    QUAN SÁT
   cờ file + error_page   MaintenanceMode-   SYSTEM_MAINTENANCE      gauge Prometheus
   502/504 → 503 JSON     Filter đọc cache   in-app + Expo push      + alert quên tắt
   (sống khi app chết)    15s từ DB          + SSE unreadCount       → Telegram
            │                    │                   │
            └────────┬───────────┴───────────────────┘
                     ▼
   TẦNG C — client: web (banner + MaintenanceGate) · mobile (banner + MaintenanceScreen)
   Nhận diện: 503 problem+json code=MAINTENANCE → probe /api/public/system/status (không auth)
```

**Nguyên tắc nhận diện phía client (thống nhất web + mobile):**
1. Bất kỳ response 503 nào có body problem+json với `extensions.code == "MAINTENANCE"` (hoặc header `X-DF-Maintenance: 1`) ⇒ *tín hiệu* bảo trì.
2. Tín hiệu chỉ là cò súng — client **xác nhận bằng probe** `GET /api/public/system/status` (fetch trần, không Authorization → simple request, không preflight, không đi qua interceptor).
3. Probe trả `status=MAINTENANCE` (app sống, tầng B) **hoặc** chính probe nhận 503-maintenance (app chết, tầng A) ⇒ vào trạng thái bảo trì; poll 30s tới khi `status=OK` ⇒ thoát + refresh dữ liệu.

### 3.1. Ba kịch bản vận hành

| | B1 — Deploy thường | B2 — Bảo trì có kế hoạch | B3 — Khẩn cấp |
|---|---|---|---|
| Ví dụ | deploy code mỗi ngày (~2') | migration nặng, nâng DB, đổi hạ tầng | sự cố dữ liệu, tấn công, hotfix gấp |
| Báo trước | Không (không cần) | In-app + push khi đặt lịch, nhắc T-1h, banner đếm ngược | Không |
| Kích hoạt | **Tự động**: `error_page 502/504` của nginx (không ai phải bấm gì) | Job tự bật lúc `starts_at` (hoặc admin bấm Activate); tuỳ chọn thêm cờ nginx nếu phải tắt hẳn app | Nút **Bật bảo trì khẩn cấp** trên admin (tạo window ACTIVE ngay) |
| Người dùng thấy | Toast/banner "Hệ thống đang cập nhật, tự thử lại…" (client tự retry, không chặn trang) | Trang/màn bảo trì + thời gian dự kiến xong | Trang/màn bảo trì + ghi chú |
| Kết thúc | Tự hết khi app UP | Admin bấm Complete (hoặc auto nếu bật) → thông báo "đã hoạt động trở lại" | Admin bấm Complete → thông báo |

---

## 4. Dữ liệu — migration `V271__maintenance_windows.sql`

```sql
CREATE TABLE maintenance_windows (
    id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,           -- vd "Nâng cấp cơ sở dữ liệu"
    note          TEXT,                             -- ghi chú tự do của admin, hiện nguyên văn
    starts_at     TIMESTAMP NOT NULL,
    ends_at       TIMESTAMP,                        -- NULL = chưa rõ (khẩn cấp); auto_complete đòi NOT NULL
    mode          VARCHAR(20)  NOT NULL DEFAULT 'FULL',      -- FULL | ANNOUNCE_ONLY
    status        VARCHAR(20)  NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED | ACTIVE | COMPLETED | CANCELLED
    auto_activate BOOLEAN NOT NULL DEFAULT TRUE,
    auto_complete BOOLEAN NOT NULL DEFAULT FALSE,
    -- chống gửi thông báo lặp (cùng pattern notified-once của regrade #437):
    notified_schedule_at TIMESTAMP,   -- đã gửi "có lịch bảo trì"
    notified_before_at   TIMESTAMP,   -- đã gửi nhắc T-{remind_minutes}
    notified_complete_at TIMESTAMP,   -- đã gửi "đã hoạt động trở lại"
    created_by    VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_mw_mode   CHECK (mode   IN ('FULL','ANNOUNCE_ONLY')),
    CONSTRAINT chk_mw_status CHECK (status IN ('SCHEDULED','ACTIVE','COMPLETED','CANCELLED')),
    CONSTRAINT chk_mw_ends   CHECK (ends_at IS NULL OR ends_at > starts_at)
);
-- Tối đa MỘT window đang ACTIVE — bất biến hệ thống, enforce bằng DB chứ không chỉ bằng code:
CREATE UNIQUE INDEX uq_maintenance_windows_active ON maintenance_windows (status) WHERE status = 'ACTIVE';
CREATE INDEX idx_maintenance_windows_status_starts ON maintenance_windows (status, starts_at);
```

Ghi chú:
- Kiểu thời gian theo pattern bảng notification hiện có (server chạy UTC; entity `LocalDateTime`); **API luôn trả `Instant` UTC** — có tiền lệ `NotificationItemResponse.createdAtUtc`. 🪤 IT local nhớ trap TZ: PG :55442 `TZ=UTC` (bộ nhớ dự án).
- IDENTITY chấp nhận được ở đây (bảng ghi cực ít, không bao giờ batch-insert — khác bài học XP batch).
- `note` là free text đơn ngữ (admin viết), hiện nguyên văn mọi ngôn ngữ; phần chữ chuẩn hoá do client render đa ngữ (xem §8).

**Entity**: `com.deutschflow.system.entity.MaintenanceWindow` (+ enum `Mode`, `Status` lồng trong entity, `@Enumerated(STRING)`). Đặt trong package `system` cạnh `SystemConfig` — đây là tính năng hệ thống, không phải notification.

---

## 5. Backend — tầng B

### 5.1. `MaintenanceStateService` (nguồn cờ runtime)

- Giữ cache in-memory (Caffeine hoặc `AtomicReference` + `@Scheduled` refresh) **TTL 15 giây**: `Optional<MaintenanceWindow> activeWindow`, `Optional<MaintenanceWindow> upcomingWindow` (SCHEDULED gần nhất trong 7 ngày).
- 1 query indexed / 15s / node — không đáng kể; **không** dùng `system_config` làm nguồn thứ hai (một nguồn sự thật duy nhất là bảng, tránh hai cờ lệch nhau).
- Mọi thao tác admin đổi trạng thái gọi `refreshNow()` để node hiện tại áp dụng tức thì; node khác trễ tối đa 15s (chấp nhận — prod 1 node, blue-green chỉ chồng vài phút).
- Đăng ký **Micrometer gauge** `deutschflow_maintenance_active{mode}` (0/1) tại đây.

### 5.2. `MaintenanceModeFilter` (điểm chặn)

- `OncePerRequestFilter`, đăng ký **trong security chain**: `.addFilterAfter(maintenanceModeFilter, JwtAuthFilter.class)` — chạy SAU JWT để đọc được `Authentication` (bypass admin), TRƯỚC authorization. Đây là ràng buộc thứ tự filter đầu tiên của codebase (hiện chưa file nào có `@Order`) — kèm `FilterRegistrationBean.setEnabled(false)` để khỏi bị servlet container auto-register chạy đúp.
- Logic khi `activeWindow` có `mode=FULL`:

```
CHO QUA (không chặn):
  • /api/public/**                    → probe status + preview mời org vẫn sống
  • /api/auth/login, /api/auth/refresh → admin còn đường đăng nhập (học viên login xong
                                         vẫn bị chặn API khác → client hiện màn bảo trì)
  • /api/admin/**                      → admin phải TẮT được bảo trì qua UI (đã có role-gate riêng)
  • /actuator/**                       → readiness blue-green + monitor nội bộ
  • Authentication có ROLE_ADMIN       → bypass toàn bộ (admin thao tác kiểm thử trong lúc bảo trì)
CHẶN phần còn lại → 503:
  • Kể cả webhook thanh toán /api/payments/** — CHỦ ĐÍCH: đang migrate DB mà nhận webhook ghi
    dữ liệu là rủi ro hỏng dữ liệu; Stripe/MoMo/Apple/SePay đều retry theo backoff khi gặp 503,
    đó là hợp đồng chuẩn của họ. Trade-off đã cân: mất realtime vài phút < ghi vào schema dở dang.
```

- Response 503 filter **tự ghi** (không qua `GlobalExceptionHandler`), đúng shape RFC 7807 hiện hành:

```json
HTTP 503 · Content-Type: application/problem+json · Retry-After: 300 · X-DF-Maintenance: 1
{
  "type": "https://deutschflow.com/errors/maintenance",
  "title": "Service Under Maintenance",
  "status": 503,
  "detail": "Hệ thống đang bảo trì theo kế hoạch, dự kiến hoạt động lại lúc 23:30.",
  "instance": "/api/...",
  "timestamp": "...",
  "extensions": { "code": "MAINTENANCE", "endsAtUtc": "2026-09-10T16:30:00Z", "windowId": 12 }
}
```

  `detail` viết tiếng Việt có giờ cụ thể — mobile `apiMessage()` đọc `detail` verbatim nên **app cũ chưa OTA vẫn hiện đúng câu này**, degrade tử tế ngay từ ngày backend deploy.
- `ANNOUNCE_ONLY`: filter không chặn gì (chỉ status endpoint đổi payload → client hiện banner).

### 5.3. Endpoint trạng thái công khai

`GET /api/public/system/status` — controller `system/controller/SystemStatusController`:

```json
200 OK · Cache-Control: no-store   (nhẹ, đọc từ cache RAM 15s — không chạm DB mỗi request)
{
  "status": "OK" | "MAINTENANCE",          // MAINTENANCE ⇔ có window ACTIVE mode=FULL
  "serverTimeUtc": "2026-09-03T12:00:00Z", // client tính countdown bằng đồng hồ server, khỏi lệch giờ máy
  "active":   null | { "id", "title", "note", "mode", "startsAtUtc", "endsAtUtc" },
  "upcoming": null | { "id", "title", "note", "mode", "startsAtUtc", "endsAtUtc" }
}
```

- Đường `/api/public/**` đã permitAll + đã nằm sau `PublicApiRateLimitFilter` (30 req/min/IP, fail-open) → **không phải đụng SecurityConfig, được chống abuse miễn phí**. Chỉ cần thêm path vào `ApiTelemetryFilter.shouldNotFilter` để poll không rác telemetry.
- Luôn 200 khi app sống (kể cả đang bảo trì) — đây là "đường dây nóng luôn trả lời"; filter §5.2 whitelist nó. Khi app chết thì nginx trả 503 JSON cùng shape (§7) — client xử lý một kiểu.

### 5.4. API admin — `AdminMaintenanceController`

`@RequestMapping("/api/admin/maintenance-windows")` + `@PreAuthorize("hasRole('ADMIN')")` class-level (đúng pattern `AdminAiConfigController`, kèm URL backstop có sẵn `/api/admin/**`):

| Method | Path | Việc | Ghi chú |
|---|---|---|---|
| GET | `/` | List (phân trang, lọc status) | |
| POST | `/` | Tạo lịch (SCHEDULED) | validate: `starts_at` tương lai, `ends_at > starts_at`; cảnh báo mềm nếu chồng lấn lịch khác. **Gửi ngay thông báo "có lịch"** nếu `notify=true` (mặc định) |
| PATCH | `/{id}` | Sửa lịch SCHEDULED / gia hạn `ends_at` khi ACTIVE | đổi giờ sau khi đã thông báo → gửi thông báo cập nhật (reset `notified_before_at` nếu dời xa) |
| POST | `/{id}/activate` | Bật sớm | SCHEDULED → ACTIVE |
| POST | `/{id}/complete` | Kết thúc | ACTIVE → COMPLETED + thông báo "đã hoạt động trở lại" |
| POST | `/{id}/cancel` | Huỷ | SCHEDULED → CANCELLED; chỉ gửi thông báo huỷ nếu `notified_schedule_at != null` |
| POST | `/emergency` | **Khẩn cấp** | body `{title?, note?, endsAtUtc?}` → tạo window `starts_at=now, status=ACTIVE, mode=FULL` ngay |

- Mọi mutation ghi **audit log** đúng chữ ký hiện hành: `auditLogService.log("admin.maintenance.<action>", null, actorEmail, actorRole, "MAINTENANCE", String.valueOf(id), details)`.
- Chuyển trạng thái sai (vd complete một window SCHEDULED) → 409 `ConflictException` (đã có handler).
- Unique index partial `WHERE status='ACTIVE'` là chốt chặn cuối: activate khi đang có window ACTIVE khác → `DataIntegrityViolationException` → 409 (đã có handler).

### 5.5. Job định kỳ — `MaintenanceWindowJob`

Đúng pattern `ScheduledBroadcastJob`: job `@Component` mỏng, `@Scheduled(fixedDelayString = "${app.maintenance.job-delay-ms:60000}")` + `@SchedulerLock(name="maintenanceWindowTick", lockAtMostFor="PT5M", lockAtLeastFor="PT0S")`, **delegate sang service `@Transactional`** (tránh self-invocation vô hiệu transaction — bài học Spring proxy), mỗi bước try/catch riêng:

1. **Nhắc trước**: `SCHEDULED` ∧ `starts_at − now ≤ remind` (`app.maintenance.remind-before-minutes:60`) ∧ `notified_before_at IS NULL` → broadcast nhắc + set mốc.
2. **Tự bật**: `SCHEDULED` ∧ `auto_activate` ∧ `starts_at ≤ now` → `ACTIVE` + `refreshNow()`.
3. **Tự tắt**: `ACTIVE` ∧ `auto_complete` ∧ `ends_at ≤ now` → `COMPLETED` + thông báo hoàn tất. (Mặc định `auto_complete=false` — bảo trì chưa xong mà cơ chế tự mở cửa nguy hiểm hơn quên tắt, vì quên tắt đã có chuông ở bước 4.)
4. **Chuông quên tắt**: `ACTIVE` ∧ `ends_at + 30' < now` → `UserNotificationService.onSystemAlert(...)` cho admin (type `ADMIN_SYSTEM_ALERT` có sẵn) — mỗi 30' một lần, + alert Prometheus (§9).

### 5.6. Thông báo — mở rộng notification domain (không xây mới)

- Thêm enum **`NotificationType.SYSTEM_MAINTENANCE`** → compile error tại `NotificationContentRenderer.render()` cho tới khi thêm case (chủ đích của switch exhaustive). Payload jsonb:

```json
{ "kind": "SCHEDULED|UPDATED|REMINDER|STARTED|COMPLETED|CANCELLED",
  "windowId": 12, "title": "Nâng cấp cơ sở dữ liệu",
  "startsAtUtc": "...", "endsAtUtc": "...", "note": "..." }
```

- Renderer case (tiếng Việt, khớp giọng hiện có — renderer là Vietnamese-first toàn cục):
  - SCHEDULED: `🔧 Lịch bảo trì: {title} — từ {giờ} đến {giờ} ngày {ngày}` / body kèm note.
  - REMINDER: `⏰ Còn ~1 giờ nữa hệ thống bảo trì ({giờ}–{giờ}). Hãy lưu bài đang làm.`
  - COMPLETED: `✅ Hệ thống đã hoạt động bình thường trở lại. Cảm ơn bạn đã chờ!`
  - CANCELLED: `❎ Lịch bảo trì {ngày} đã được huỷ. Hệ thống hoạt động bình thường.`
- Fan-out: method mới `UserNotificationService.broadcastMaintenance(window, kind)` tái dùng `resolveAudience(ALL)` + `insertForUser` + SSE nudge + `pushForNotification` (Expo push tự đi kèm, title/body khớp in-app). **Caveat tải**: audienceType=ALL nạp toàn bộ user active vào JVM và `saveAll` per-row — chấp nhận ở quy mô hiện tại (vài nghìn), ghi hướng nâng cấp `INSERT … SELECT` native + Expo batch 100/request khi user base lớn. KHÔNG gửi push cho kind STARTED khi FULL (app đang chặn, đẩy noti "đang bảo trì" là thừa — banner/màn chặn đã nói điều đó; STARTED chỉ ghi in-app cho lịch sử).
- Mobile inbox: `notificationTypeLabel()` thêm case `SYSTEM_MAINTENANCE` (label "Bảo trì hệ thống"); không cần route mới — fallback về inbox là đúng.

### 5.7. Kiểm thử backend (theo chuẩn IT dự án)

- IT filter: bật window ACTIVE FULL → user thường gọi API bất kỳ nhận 503 problem+json `code=MAINTENANCE`; admin gọi vẫn 200; `/api/public/system/status` vẫn 200 `status=MAINTENANCE`; login vẫn 200. 🪤 nhớ gotcha auth-test: plain `@SpringBootTest` → 401/403 với `@PreAuthorize`.
- IT job: nhắc/bật/tắt/chuông — dùng `*IntegrationTest` naming (không `*IT.java` mồ côi), env `DEUTSCHFLOW_IT_JDBC_URL` + `TZ=UTC`.
- IT state machine + unique ACTIVE (2 activate song song → 1 thắng 1 nhận 409).
- Chạy cổng fresh-migration (V271 replay sạch từ đầu).

---

## 6. Hạ tầng — tầng A (repo `DeutschFlow-deploy`)

### 6.1. Khối nginx (sửa `docker/deutschflow.nginx.conf`, server `api.mydeutschflow.com`)

Ý đồ (cấu hình minh hoạ — khi thi hành PHẢI `nginx -t` + curl kiểm cả 4 nhánh: flag on/off × app up/down):

```nginx
# Tầng http: map origin được phép cho response nginx tự sinh (Spring chết thì không ai thêm CORS hộ)
map $http_origin $df_cors_origin {
    default "";
    "https://mydeutschflow.com"      $http_origin;
    "https://www.mydeutschflow.com"  $http_origin;
}

# Trong server api.mydeutschflow.com:
set $df_maint 0;
if (-f /var/www/deutschflow-maintenance/maintenance.on) { set $df_maint 1; }

location / {
    if ($df_maint) { return 503; }        # bảo trì chủ động (cờ file) — dùng chung error_page dưới
    proxy_pass http://localhost:8080;
    proxy_buffering off;
    proxy_read_timeout 90s;
}

# Cả cờ chủ động (503 ở trên) lẫn app chết (502/504) đều đổ về MỘT nhánh, mã ra thống nhất 503:
error_page 502 503 504 = @df_maintenance;
location @df_maintenance {
    if ($request_method = OPTIONS) { return 204; }   # preflight không được chết
    default_type application/problem+json;
    add_header Retry-After 120 always;
    add_header X-DF-Maintenance 1 always;
    add_header Access-Control-Allow-Origin  $df_cors_origin always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Expose-Headers "X-DF-Maintenance, Retry-After" always;
    root /var/www/deutschflow-maintenance;
    try_files /maintenance.json =503;
    # ⚠️ chi tiết thi hành: bảo đảm mã trả ra là 503 (không phải 200 của try_files) —
    #    nếu cần, tách return 503 + error_page 503 nội bộ, hoặc dùng `=503` ở error_page.
}
```

`/var/www/deutschflow-maintenance/maintenance.json` (tĩnh, cùng shape §5.2 — mobile cũ đọc `detail` vẫn ra câu tử tế):

```json
{ "type": "https://deutschflow.com/errors/maintenance", "title": "Service Under Maintenance",
  "status": 503, "detail": "Hệ thống đang bảo trì, vui lòng quay lại sau ít phút.",
  "extensions": { "code": "MAINTENANCE" } }
```

- `location = /actuator/health` giữ NGUYÊN pass-through (không dính cờ): monitor ngoài phân biệt được "app sống nhưng đang gate" với "app chết"; readiness deploy vốn curl thẳng localhost:8080 không qua nginx.
- SSE `/api/notifications/stream`: khi cờ bật, kết nối mới nhận 503 (đúng); kết nối cũ đứt khi app dừng — client tự nhận diện qua probe.

### 6.2. Script vận hành (thêm vào `DeutschFlow-deploy/scripts/`)

- `maintenance-on.sh [--message "..."]` — SSH lên EC2: ghi `maintenance.json` (câu message tuỳ chọn) + `touch maintenance.on`. Idempotent.
- `maintenance-off.sh` — `rm -f maintenance.on`.
- Thư mục `/var/www/deutschflow-maintenance/` tạo một lần (owner root, world-readable) trong script setup.

### 6.3. Tích hợp `deploy-backend.sh`

- **Mặc định KHÔNG đổi hành vi**: deploy thường dựa vào `error_page 502/504` tự động — cửa sổ ~2 phút được che mà không ai phải bấm gì (kịch bản B1).
- Thêm cờ tuỳ chọn `MAINTENANCE=1 ./deploy-backend.sh` cho deploy kèm migration nặng: bật cờ file **trước** khi dừng BLUE, tắt **sau** final health OK; trap lỗi giữa chừng thì để cờ NGUYÊN (an toàn: thà chặn thừa còn hơn mở cửa vào app hỏng) + in cảnh báo tắt tay.

### 6.4. Alert (sửa `docker/prometheus/alert.rules.yml`)

- `DeutschflowMaintenanceActive`: `deutschflow_maintenance_active == 1 for: 5m` → severity info (Telegram biết đang bảo trì).
- `DeutschflowMaintenanceOverrun`: `deutschflow_maintenance_active == 1` kéo dài quá kỳ vọng (vd `for: 2h`) → severity warning — lưới thứ hai sau chuông §5.5-4.

---

## 7. Web (Next.js /v2) — tầng C

**Quyết định kiến trúc quan trọng: KHÔNG dùng middleware/redirect cho trang bảo trì.** Hai lý do đã kiểm chứng trong code:
- Amplify phục vụ phần lớn route từ cache CloudFront **không chạy middleware** (finding prod ghi tại `next.config.mjs` + `middleware.ts:190–201`).
- Post-mortem kill-switch `GALERIE_V2_DISABLED` (`middleware.ts:257–266`): redirect middleware đánh nhau với redirect `next.config` từng gây **loop vô hạn sập site**.

Mọi page /v2 đều `'use client'` (chỉ 10 server component, toàn layout mỏng) → **interceptor + overlay client-side phủ được toàn bộ**, không cần chặn server-side. Cơ chế:

1. **`lib/systemStatus.ts`** (mới): `probeSystemStatus()` dùng `fetch` trần (không Authorization → simple request không preflight, không đi qua interceptor/retry) + parse cả 2 nhánh (200 `status=MAINTENANCE` | 503 problem+json `code=MAINTENANCE`); export `subscribe` cho banner/gate dùng chung 1 poller.
2. **`stores/useMaintenanceStore.ts`** (mới, zustand) + **`components/system/MaintenanceOverlay.tsx`** — nhân bản pattern có sẵn `useAuthRecoveryStore` + `AuthRecoveryDialog` (mount cạnh nhau trong root layout). Overlay: title + note + countdown (tính từ `serverTimeUtc`, không tin đồng hồ máy) + poll 30s + nút "Tải lại trang".
3. **Interceptor trong `src/lib/api.ts`**: bắt `503 && extensions.code==='MAINTENANCE'` → xác nhận qua probe → `useMaintenanceStore.enter()`. ⚠️ **Phải đăng ký TRƯỚC retry-interceptor hiện có** (dòng ~86 — đang retry mọi 5xx GET 2 lần với backoff): đăng ký sau là mỗi request nhân 3 tải lên server đang bảo trì + trễ ~3s vô ích. Đường vòng ngoài choke point (SSE `notificationStream.ts` báo `onError('http-503')`, `aiSpeakingApi`, `jobSseApi`…) không cần sửa từng cái — SSE onError chỉ cần gọi probe (debounce); các API lẻ hỏng thì gate đã hiện do probe.
4. **Thoát bảo trì: KHÔNG ép reload.** Auto-dismiss overlay + toast "Hệ thống đã hoạt động trở lại" (kèm action Tải lại). Lý do: học viên đang làm dở bài viết — textarea còn nguyên dưới overlay; ép `window.location.reload()` là xoá bài của họ. Ai muốn sạch thì bấm nút.
5. **Banner trước bảo trì**: client component chèn trong `GaShell.tsx` phía trên `GaTopBar` — GaShell là flex `h-[100dvh]` nên banner phải là **flex sibling, không phải fixed overlay** (fixed sẽ che content). Poll 5'/lần + khi tab focus; có `upcoming` ≤24h → đếm ngược; ≤1h đổi tông warning. Dismiss theo `windowId` (localStorage); đổi giờ → hiện lại. Banner `MaintenanceBanner` cũ ở trang login (đọc env build-time `NEXT_PUBLIC_MAINTENANCE_MESSAGE`, phải rebuild Amplify mới đổi được — cơ chế yếu) giữ nguyên như kênh dự phòng độc lập, không đụng.
6. **Toast thông báo lịch: miễn phí.** Bell /v2 đã có `notifyNewArrival()` — SSE unreadCount tăng lúc panel đóng → tự fetch item mới nhất → toast Sonner kèm deep-link. Broadcast SYSTEM_MAINTENANCE nghiễm nhiên nổi toast.
7. **Admin UI `/v2/admin/maintenance`**: mirror `weekly-speaking/page.tsx` (CRUD một file, TkModal, toast + `apiMessage`) + hook `useAdminData` (tự refresh 120s khi tab visible) + API module tách riêng `lib/adminMaintenanceApi.ts` (style `adminMockPackApi.ts`). Sidebar: thêm item vào `adminNav` trong `components/ui-v2/nav.ts` + key `nav.items.admin-maintenance` trong chrome. **Mọi nút chuyển trạng thái mở ConfirmDialog nêu hệ quả** ("Toàn bộ học viên bị chặn ngay lập tức…") — chuẩn dự án đã chốt.
8. **Nice-to-have cùng PR-B**: chip `GaTopBar` "● Hệ thống ổn định" (`v2.ui.roleChipAdmin` — hiện là chuỗi tĩnh) nối vào status thật: MAINTENANCE → "● Đang bảo trì" tông amber.
9. **i18n**: nhóm `"maintenance"` đặt **top-level trong `messages/v2/chrome.{vi,en,de}.json`** (chrome là area duy nhất không tự bọc namespace — top-level key thành `v2.maintenance.*`, không phải đổi `V2_AREAS`); chuỗi admin vào `adminOps` → `v2.adminOps.maintenance.*`. vi là nguồn sự thật, 3 locale phải khớp key tuyệt đối; chạy `npm run check:i18n` (guard tự parse `V2_AREAS` + bắt key thiếu/thừa).
10. **Test**: vitest cho interceptor (mirror `api.test.ts` — 3 test latch refresh có sẵn làm mẫu), store transitions, probe parse 2 nhánh. 🪤 bẫy vitest đã ghi: jsdom localStorage, `clearAllMocks` không xoá impl.

## 8. Mobile (Expo) — tầng C

Điểm móc đã khảo sát chính xác:

1. **`lib/api.ts`** — trong response-error interceptor, **chèn nhánh maintenance TRƯỚC khối transient-retry** (hiện ở dòng 159–167): `status===503 && data?.extensions?.code==='MAINTENANCE'` → `useMaintenanceStore.getState().enter(data)` (lazy `require()` đúng pattern chống import-cycle đã ghi chú tại chỗ) → reject có đánh dấu `_maintenance` để `shouldReportApiFailure` (103–107) **bỏ qua Sentry** và transient-retry không chạy.
2. **`stores/useMaintenanceStore.ts`** (zustand, mới): `{active, info, enter(), exitIfOk()}` + probe bằng `fetch` trần tới `/api/public/system/status`.
3. **Gate**: trong `app/_layout.tsx`, render overlay `MaintenanceOverlay` **kiểu `SplashAnimated`** (absoluteFill, zIndex cao, sibling cạnh splash — KHÔNG `router.replace` từ root layout, footgun crash React 19 đã ghi tại chỗ). Nội dung: icon + title + note + countdown + nút "Thử lại"; poll 30s; thoát → `invalidateNotificationQueries()` + refetch queries.
4. **Probe khởi động**: thêm vào `bootstrap()` (`_layout.tsx:164–175`) một probe **không cần token** (2 call hiện tại đều token-gated, user chưa đăng nhập cũng phải thấy màn bảo trì thay vì form login lỗi); re-check ở listener `AppState` foreground có sẵn (149–162).
5. **Offline queues**: `useSrsOfflineStore` + `useChatOutboxStore` sửa `isTransientFailure` (hoặc điều kiện flush) để **không retry khi đang maintenance** — hết bão request vào server đang bảo trì.
6. **Banner upcoming**: thẻ nhỏ trên Home đọc cùng store (poll 5'/foreground).
7. **Inbox**: `notificationTypeLabel()` case `SYSTEM_MAINTENANCE`; deep-link fallback inbox giữ nguyên.
8. **OTA**: toàn bộ chỉ đụng `app/ lib/ stores/ components/` — không thêm dependency → **OTA được** theo quy trình chuẩn (cây sạch + `npm ci` + `eas-cli fingerprint:compare`). App cũ chưa nhận OTA: vẫn thấy câu `detail` tiếng Việt từ `apiMessage()` — degrade chấp nhận được.

## 9. i18n — chiến lược 2 lớp

| Lớp | Nội dung | Ngôn ngữ |
|---|---|---|
| Client render (banner, gate, màn bảo trì) | Chuỗi chuẩn hoá + tham số thời gian (`startsAtUtc/endsAtUtc` format theo locale) | **Đủ de/en/vi** qua messages/v2 (web) & chuỗi mobile |
| Server render (in-app notification, push, `detail` trong 503) | Renderer tiếng Việt — nhất quán với TOÀN BỘ notification hiện hành (renderer là Vietnamese-first có chủ đích) | vi (như mọi notification khác) |

`note` của admin là free text — hiện nguyên văn ở mọi client. Nâng cấp đa ngữ notification server-side (MessageSource de/en/vi đã có sẵn plumbing nhưng chưa ai dùng) là việc riêng, ngoài phạm vi.

## 10. Bảo mật & vận hành

- Không lộ chi tiết nội bộ trong 503 (chỉ title/note admin tự viết + thời gian).
- Status endpoint public nhưng: đọc từ cache RAM (không đập DB), sau rate-limit 30 req/min/IP có sẵn, `no-store` (không để Cloudflare cache già làm client kẹt trạng thái cũ; nếu cần giảm tải sau này → `max-age=15` là nút vặn có sẵn).
- Admin bypass theo **role trong JWT**, không theo IP (IP EC2/SG không liên quan; repo public — không nhét secret/IP vào code/doc).
- Audit log đầy đủ mọi thao tác admin (pattern có sẵn).
- Emergency + mọi nút chuyển trạng thái: ConfirmDialog nêu rõ hệ quả ("Toàn bộ học viên sẽ bị chặn ngay lập tức…").

## 11. Kế hoạch thi hành (đợt/PR — mỗi PR tự đứng, không xếp chồng)

| Đợt | Repo | Nội dung | Phụ thuộc |
|---|---|---|---|
| **PR-A** ✅ | DeutschFlow (backend) | **ĐÃ THI HÀNH 03/09 — PR #488** (V301 thay V271 vì main đã tới V300): entity/service/filter/status endpoint/admin API/emergency/job/renderer case/gauge + IT 14/14 + SRS module 12 & 11 + matrix + bản gộp cùng đợt (SRS ở cây chính vì thư mục untracked) | — |
| **PR-B** ✅ | DeutschFlow (frontend) | **ĐÃ THI HÀNH 03/09 — PR #490**: systemStatus probe + useMaintenanceStore + MaintenanceOverlay (root layout, không ép reload) + MaintenanceBanner (GaShell flex-sibling) + interceptor trước-retry + `/v2/admin/maintenance` (ConfirmDialog mọi chuyển trạng thái) + i18n vi/en/de (`maintenance` vào V2_CORE) + vitest 29/29; demo e2e overlay/hồi phục với mock 503 | PR-A merged ✅ |
| **PR-C** | DeutschFlow (mobile) | interceptor + store + overlay + banner + inbox label; OTA sau merge | PR-A merged |
| **PR-D** | DeutschFlow-deploy | nginx conf + maintenance.json + scripts on/off + `MAINTENANCE=1` trong deploy script + alert rules | độc lập (làm song song được); áp lên EC2 khi deploy đợt A |
| Nghiệm thu | prod | Kịch bản B1 (deploy thật quan sát 503 JSON + client tự hồi), B2 (lịch giả 5 phút), B3 (emergency + tắt) | A–D deployed |

Ca nghiệm thu đề xuất (thêm vào acceptance matrix, NOT_RUN):
- **AC-MAINT-01**: Tạo lịch → mọi user nhận in-app + push "có lịch"; T-1h nhận nhắc đúng MỘT lần (job chạy lặp không gửi đúp).
- **AC-MAINT-02**: Đến giờ, window FULL tự ACTIVE → user thường gọi API nhận 503 problem+json `code=MAINTENANCE`; admin vẫn thao tác được; login vẫn được; `/api/public/system/status` trả 200 `status=MAINTENANCE`.
- **AC-MAINT-03**: Web + mobile hiện màn bảo trì có countdown; khi Complete → client tự thoát trong ≤30s; user nhận thông báo "đã hoạt động trở lại" đúng một lần.
- **AC-MAINT-04**: Tắt hẳn app (mô phỏng deploy) khi cờ nginx bật → mọi request `/api/**` nhận 503 JSON tĩnh kèm CORS + `X-DF-Maintenance`; OPTIONS trả 204; web không rơi vào "network error" mù.
- **AC-MAINT-05**: Không thể có 2 window ACTIVE (activate cái thứ hai → 409); `/actuator/health` vẫn UP suốt thời gian app sống.
- **AC-MAINT-06**: Emergency: bật ngay có hiệu lực ≤15s (TTL cache); huỷ lịch đã thông báo → user nhận thông báo huỷ.

## 12. Rủi ro & bẫy đã biết (nhúng từ bộ nhớ dự án)

| Bẫy | Phòng |
|---|---|
| Trùng số migration với PR đang mở | Rà `V*` mới nhất + PR mở NGAY TRƯỚC khi code (V271 là số tại 03/09) |
| ShedLock: `@SchedulerLock` đòi void; `@Scheduled` nên có initialDelay; self-invocation vô hiệu `@Transactional` | Job mỏng delegate sang service bean riêng (pattern `ScheduledBroadcastJob` có sẵn) |
| Filter 503 mojibake | `response.setCharacterEncoding("UTF-8")` (tiền lệ `PublicApiRateLimitFilter`) |
| Health DOWN làm kẹt blue-green | Bảo trì KHÔNG đụng `/actuator/health` |
| Preflight chết → web mù | Probe simple-request không auth; nginx trả 204 cho OPTIONS |
| Mobile transient-retry + Sentry flood + offline queue bão | 3 điểm sửa nêu ở §8 |
| Crash root-layout React 19 | Overlay, không điều hướng imperative |
| OTA vỡ fingerprint | Không thêm dependency mobile |
| PG local TZ | IT với `TZ=UTC`, PG :55442 |
| Cache `systemConfig` không dùng cho cờ | Nguồn duy nhất là bảng + cache RAM TTL 15s của service |
| Web: interceptor maintenance đăng ký SAU retry-interceptor → mỗi request nhân 3 tải lên server đang bảo trì | Đăng ký trước dòng retry trong `api.ts` + vitest chốt thứ tự |
| Web: Amplify/CloudFront không chạy middleware trên route đã cache; redirect middleware từng gây loop sập site (post-mortem `GALERIE_V2_DISABLED`) | Tuyệt đối không làm trang bảo trì bằng middleware/redirect — chỉ overlay client-side |
| Web: ép reload khi thoát bảo trì xoá bài đang làm dở của học viên | Auto-dismiss + toast, reload là nút tuỳ chọn |

## 12b. Phát hiện từ drill nghiệm thu prod 03/09 (gộp vào PR kế — PR-A2 daily)

Nghiệm thu AC-MAINT-01/-02/-03/-05 PASS trên prod (xem acceptance-matrix). Ba rough edge lộ ra khi owner drill tay, KHÔNG chặn nghiệm thu nhưng cần vá:

1. **Banner hiện lịch quá-giờ-vẫn-SCHEDULED.** Window `auto_activate=false` (owner không tick, không bấm "Bật ngay") mà quá cả `starts_at` lẫn `ends_at` vẫn nằm `upcoming` → banner treo "còn 0 phút" mãi. Vá: `MaintenanceStateService.upcomingWindow()` loại window có `starts_at < now − ε`; và/hoặc job đánh dấu SCHEDULED quá hạn (auto_activate=false, starts_at đã qua) thành EXPIRED/CANCELLED.
2. **Tab đã mở không tự nhảy overlay khi window vào ACTIVE.** Chặn ở tầng API (503 khi bấm/reload — đúng thiết kế), nhưng tab để yên chỉ bắt kịp qua poll nền của banner (5') hoặc refocus. Cân nhắc: overlay/banner poll status nhanh hơn (vd 60s) khi có `upcoming` sắp tới giờ, để tab để-yên vào màn chặn kịp thời.
3. **Cancel im lặng khi chỉ mới gửi REMINDER (chưa gửi SCHEDULED).** `cancel()` chỉ broadcast CANCELLED nếu `notified_schedule_at != null`. Nhưng job nhắc (`sendDueReminders`) chạy độc lập theo `notified_before_at`, nên một window `notifyUsers=off` vẫn có thể đã gửi "⏰ Sắp bảo trì" rồi bị huỷ IM LẶNG → user bị cảnh báo bảo trì mà không được báo huỷ (quan sát prod: window id=2 chỉ có REMINDER, cancel không gửi CANCELLED). Vá: cancel gửi CANCELLED nếu `notified_schedule_at != null` **HOẶC** `notified_before_at != null`.

Dọn sau drill: tài khoản `qa.maint.drill.*@example.com` (STUDENT, không dữ liệu thật) còn trên prod — vô hại, owner có thể tự xoá qua hồ sơ; window id=1/2/3 ở trạng thái kết thúc, để làm lịch sử.

## 13. Câu hỏi mở cho owner (không chặn thi hành — có mặc định)

1. Mốc nhắc trước: mặc định **T-1h** (thêm T-24h chỉ là đổi config) — đủ chưa?
2. Webhook thanh toán bị chặn khi FULL (provider tự retry) — đồng ý trade-off? (mặc định: chặn)
3. `auto_complete` mặc định TẮT (người vận hành xác nhận xong mới mở cửa) — giữ?
