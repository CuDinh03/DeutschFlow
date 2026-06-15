# RCA & Plan — Lỗi "An unexpected error occurred. Reference: ERR-161"

**Status:** PLAN — chờ xác nhận trước khi thực thi (B0)
**Ngày:** 2026-06-13
**Liên quan:** PR #114 (đã deploy `205022c2` lúc 18:06), bug song sinh `ERR-74C`.

---

## 1) Vấn đề (cần làm gì, ràng buộc, input/output)

- **Hiện tượng:** `POST /api/auth/login` trả **HTTP 500** (UI hiển thị `ERR-161`, trước đó `ERR-74C`), đều **~5.9s**, MỌI request, trên backend bản cũ (trước deploy 18:06).
- **ERR-161 là gì:** mã tham chiếu do `GlobalExceptionHandler.handleGeneral` (GlobalExceptionHandler.java:217) sinh cho 500 chưa-xử-lý. Hex seq `161` = lỗi thứ **353** kể từ lần backend khởi động (counter `AtomicLong` reset khi restart; ERR-74C = 1868 ⇒ giữa 2 lần chụp màn hình backend ĐÃ restart trên code cũ). Bản thân ERR-161 KHÔNG phải lỗi — nó **che** exception thật; chỉ log server mới có stacktrace.
- **Định nghĩa "XONG":** làm rõ **dứt điểm exception thật** đứng sau ERR-161 ở mức **bằng chứng** (không phải suy đoán), và khẳng định fix đã deploy giải quyết đúng **gốc** + **bền** (Redis chết lại không tái phát).
- **Ràng buộc:**
  - Tôi bị chặn `ssh`/`sudo`/`git reset --hard` trực tiếp (bash-guard hook) → thao tác trên EC2 phải **nhờ bạn chạy** (read-only).
  - Container backend cũ (BLUE) **đã bị gỡ** trong blue-green swap → log gốc ERR-161 có thể đã mất (trừ khi Loki/Sentry/`docker logs`/old-image còn giữ).
  - Không sửa migration cũ; không làm gãy 884 unit test.
- **Input/Output:**
  - In: codebase hiện tại + lịch sử git; (nếu lấy được) log/old-image trên EC2.
  - Out: kết luận RCA **có bằng chứng** + mức độ chắc chắn + (nếu audit lộ gap) hardening cho điểm Redis chưa graceful.

## 2) Giải pháp (cách tiếp cận, design decision, edge case)

**Câu hỏi mấu chốt — phân định 4 giả thuyết:**
- **H1** — backend cũ chạy code **trước** `2a237214` (06-03, chưa có fallback) → exception Redis lọt ra → 500. *(khả nghi nhất, nhưng mâu thuẫn với ghi chú "last clean deploy ca830efc 06-05")*
- **H2** — có fallback nhưng exception **không bị** `catch (Exception e)` bắt. *(khó: Redis ex đều là RuntimeException)*
- **H3** — 500 đến từ **điểm chạm Redis KHÁC** trong luồng login, không fallback. *(phải audit để loại)*
- **H4** — hang quá lâu → bị timeout tầng trên giết. *(loại: 500 mang ERR-ref của backend ⇒ do GlobalExceptionHandler, tức ex đã lọt qua try/catch rate-limiter)*

**Cách xác minh (ưu tiên bằng chứng > suy luận):**
- **B1 — Bằng chứng trực tiếp** *(cần bạn chạy read-only trên EC2)*: tìm dòng log `[500][ERR-...]` (Loki / `docker logs` / Sentry) + commit/old-image đã deploy lần trước (so với `2a237214`).
- **B2 — Reproduce cục bộ**: chạy backend local trỏ `REDIS_HOST` vào host "đen" (drop gói, mô phỏng unreachable):
  - (a) code **hiện tại** → khẳng định login **KHÔNG 500** (degrade + nhanh nhờ timeout 300ms).
  - (b) tái dựng nhánh code **không-fallback** → tái hiện 500 → phân định H1 vs H3 bằng thực nghiệm.
- **B3 — Audit** mọi điểm chạm Redis trên luồng auth/login (+ hot path) → loại H3 / lộ bug tiềm ẩn.
- **B4 — Soát chất lượng fix**: giá trị 300ms hợp lý? đánh đổi `redis.enabled=false` vs readiness-group? edge case fallback (`redisDownWarned` volatile, Lua `ZADD/PEXPIRE`, member uniqueness).

**Edge case sẽ xử lý:** Redis healthy-nhưng-chậm (GC/blip) dưới timeout 300ms; blue-green 2 node chia tải in-memory; first-call-after-Redis-down (cú hang đầu của Lettuce).

## 3) Tác động (ảnh hưởng phần nào của hệ thống)

- **Đọc/phân tích:** `user/` (AuthController, AuthService, AuthRateLimiterService), `common/exception/` (GlobalExceptionHandler), config Redis/health (application.yml), `deploy-backend.sh`, observability (Loki/Prometheus/Sentry).
- **Nếu phát sinh code:** chỉ thêm **test reproduce** + (nếu audit lộ gap) hardening graceful cho điểm Redis chưa an toàn — diff tối thiểu, không refactor lan man. **Không đụng prod runtime** trừ khi bạn duyệt thêm 1 deploy.
- **Rủi ro:** thấp (chủ yếu phân tích + test cục bộ). Mọi thao tác EC2 read-only, do bạn chạy.

## Checklist
- [x] **B0** — Bạn duyệt plan + chọn "B1+B2" ✓
- [x] **B1a** — git/code (cục bộ): **lật giả thuyết Redis → DB-pool** ✓
- [ ] **B1b** — EC2 forensics: BỎ (tôi bị chặn SSH + log gốc đã mất khi swap blue-green). Tùy chọn — bạn chạy 3 lệnh read-only nếu muốn xác nhận gián tiếp.
- [x] **B2** — Reproduce bằng test xác định: 23/23 PASS ✓ (xem dưới)
- [x] **B3** — Audit điểm chạm Redis trên luồng login ✓ (chỉ rate-limiter, có fallback)
- [x] **B4** — Soát chất lượng fix + edge case ✓
- [x] **B5** — Kết luận RCA ✓ (xem dưới)

---

## 📌 B1a — Phát hiện (2026-06-13) — GIẢ THUYẾT REDIS BỊ LẬT NGƯỢC

**Bằng chứng thu được (cục bộ, git + code):**
1. Git: rate-limiter **chưa bao giờ** có phiên bản "Redis-không-fallback". `2a237214` (06-03) thêm Redis call VÀ try/catch fallback **cùng lúc**. Trước đó là in-memory thuần (không gọi Redis). ⇒ rate-limiter **không thể** là nguồn của một 500 *uncaught* do Redis.
2. `ca830efc` (06-05, "last clean deploy" theo memory) **ĐÃ có** fallback (`catch (Exception e)` → `checkInMemory`). ⇒ nếu prod chạy code này, Redis chết sẽ bị catch → degrade → **400, không 500**.
3. Luồng login (sai mật khẩu): `authenticationManager.authenticate()` (AuthService.java:95) **bắt buộc query DB** để load user. `catch` chỉ bắt `BadCredentialsException`. Một **lỗi không lấy được kết nối DB** (`CannotGetJdbcConnectionException`) **không bị catch** → lọt ra → **500**. Khớp với hành vi quan sát.
4. **Timing là bằng chứng quyết định:** 500 login VÀ 503 health đều **~5.9s** = khớp **`DB_POOL_CONNECTION_TIMEOUT_MS:5000`** (Hikari, application.yml:66). Lettuce (Redis) mặc định là **10s (connect) / 60s (command)** — KHÔNG khớp 5.9s. `DataSourceHealthIndicator` cũng mượn connection từ pool → pool cạn → chờ 5s → DOWN.
5. Pre-#114 **không** có Redis timeout (chỉ host/port) → nếu Redis chết, hang sẽ là ~10s, không phải 5.9s; và health sẽ là ~10s, không phải 5.9s đã đo. ⇒ Redis nhiều khả năng **vẫn sống** (RedisHealthIndicator UP/nhanh), thủ phạm là DB pool.
6. Deps: chỉ `spring-data-redis` + `webflux` (KHÔNG có spring-session-redis/bucket4j-redis) ⇒ không có Redis-backed session chen vào luồng request.

**Giả thuyết mới (mạnh, chưa chứng minh dứt điểm):** ERR-161/ERR-74C = **`GlobalExceptionHandler` che một `CannotGetJdbcConnectionException` do CẠN HIKARI POOL** (chờ 5s rồi timeout), tức đúng **P0 pool DB** mà PR #113 nhắm tới — KHÔNG phải Redis. Login hết lỗi sau deploy là vì deploy đã ship **#113** (telemetry batching bỏ INSERT/request làm starve pool, thread 80→48, min-idle 2→5…), chứ không phải nhờ phần Redis của #114.

**Hệ quả thẳng thắn:** PR #114 (300ms Redis timeout + loại redis khỏi health) **nhiều khả năng chữa nhầm chỗ** — vô hại + hợp vệ sinh, nhưng KHÔNG phải fix gốc. Fix gốc = #113 (đi cùng chuyến deploy). Cần B1b/B2 xác nhận bằng chứng.

**Giới hạn:** log ERR-161 gốc gần như đã mất (container BLUE bị `docker rm` lúc swap; Loki/Promtail chỉ chạy từ 18:06; không có git-commit-id trong image; SENTRY_DSN nhiều khả năng trống). ⇒ B2 (reproduce) sẽ là bằng chứng chính; B1b chỉ còn xác nhận gián tiếp (Redis có sống trước deploy không + ngày build image cũ).

---

## 📌 B2 — Reproduce (test xác định, không cần DB) — ĐÃ CHỨNG MINH

Chạy `./mvnw -Dtest='GlobalExceptionHandlerTest,AuthServiceUnitTest,AuthRateLimiterServiceUnitTest' test` → **23/23 PASS**. Bộ ba test khóa chặt chuỗi nhân-quả:
1. `GlobalExceptionHandlerTest#dbConnectionFailure_maskedAs500WithErrReference` — `CannotGetJdbcConnectionException` ("HikariPool … timed out after 5000ms") → `handleGeneral` → **HTTP 500**, detail = **"An unexpected error occurred. Reference: ERR-xxx"** (đúng chuỗi ERR-161), KHÔNG lộ HikariPool/JDBC. Log chạy test in ra: `[500][ERR-1] Unhandled exception on /api/auth/login` — tái hiện đúng cơ chế.
2. `AuthServiceUnitTest#login_dbConnectionFailure_propagatesUncaught_notMaskedAsBadRequest` — `login()` chỉ `catch (BadCredentialsException)`; lỗi DB lọt ra *uncaught* (không bị nhầm thành 400) → tới catch-all.
3. `AuthRateLimiterServiceUnitTest#redisDown_degradesToInMemory_doesNotThrow` — Redis ném exception → degrade in-memory, KHÔNG 500. ⇒ **Redis được loại trừ.**

## 📌 B3 — Audit điểm chạm Redis trên luồng login
`/api/auth/login` → `authRateLimiterService.allow()` (Redis **có** try/catch fallback) → `authService.login()` (thuần DB) → `setRefreshTokenCookie`. Deps chỉ có `spring-data-redis` + `webflux` (KHÔNG spring-session-redis/bucket4j) → không có Redis chen vào filter chain. L2 cache Redis `@ConditionalOnProperty(redis-l2-enabled=true)` = OFF ở prod → cache là Caffeine in-memory, không chạm Redis. ⇒ **điểm chạm Redis duy nhất trên luồng login là rate-limiter, và nó degrade an toàn.** H3 bị loại.

## 📌 B4 — Chất lượng fix + đánh giá thẳng thắn
- **Fix gốc THẬT = PR #113** (telemetry batched bỏ INSERT/request làm starve pool; Tomcat 80→48; Hikari min-idle 2→5; circuit breaker AI). Đi cùng chuyến deploy 18:06 → đó là cái thật sự dập ERR-161.
- **PR #114 (Redis timeout 300ms + `health.redis.enabled=false`) = chữa nhầm chỗ.** Vô hại + hợp vệ sinh (Redis vốn best-effort, không nên gate health/deploy), nhưng KHÔNG phải nguyên nhân ERR-161. → **Giữ lại như hardening**, nhưng phải sửa lại mô tả (SRS v2.25 + memory đang ghi sai rằng #114 là fix của ERR-161).
- **Edge case còn hở (khuyến nghị, chưa làm):** lỗi mất-kết-nối-DB hiện bị che thành **500 "ERR-xxx"** chung chung (trông như crash). Nên thêm `@ExceptionHandler` riêng cho `CannotGetJdbcConnectionException`/`DataAccessResourceFailureException` → map **503 Service Unavailable** + thông điệp "thử lại sau" (FE đã có retry cho GET → 503 sẽ được xử lý đúng hơn 500). → đề xuất PR riêng, cần deploy.

## ✅ B5 — KẾT LUẬN RCA

**Vấn đề của ERR-161 (đã làm rõ):** `ERR-161` không phải lỗi riêng — nó là **mã che của `GlobalExceptionHandler` cho một exception tầng DB chưa-xử-lý trên `POST /api/auth/login`**. Cụ thể: khi **Hikari connection pool cạn (hoặc Postgres không với tới được)**, bước `authenticationManager.authenticate()` (load user từ DB) chờ hết `connection-timeout` **5s** rồi ném `CannotGetJdbcConnectionException`. Exception này **không** phải `BadCredentialsException` nên không bị `catch` ở `AuthService.login` → lọt ra catch-all → 500 với chuỗi "An unexpected error occurred. Reference: ERR-…". Cùng nguyên nhân (pool cạn) làm `DataSourceHealthIndicator` cũng 503. ⇒ đúng **P0 pool DB** của PR #113.

**Độ chắc chắn:**
- **CHẮC CHẮN (test xác định):** cơ chế — lỗi tầng DB trên luồng login → che thành ERR-xxx; Redis-fail thì degrade, không 500.
- **RẤT MẠNH (timing + code):** prod 5.9s = Hikari 5000ms (Lettuce/Redis mặc định 10s/60s — loại); luồng login chỉ có đúng một loại lỗi uncaught là tầng DB.
- **KHÔNG chứng minh tuyệt đối được:** stacktrace ERR-161 gốc (đã mất khi swap blue-green). Phân biệt "pool cạn do tải" vs "RDS chớp tắt" không đổi bản chất (đều là DB-connectivity, đều thuộc phạm vi #113).

**Redis KHÔNG phải thủ phạm** — chẩn đoán ban đầu (PR #114) sai hướng, dù vô hại.

**Trạng thái sau deploy 18:06 (verify live):** login bad-creds 400@0.8s, health 200@0.9s, commit `205022c2`. ERR-161 đã hết.

**Khuyến nghị — trạng thái (cập nhật 2026-06-13):**
1. ✅ **XONG** — sửa mô tả #114 trong SRS v2.25 (4 chỗ) + memory: #114 = Redis hardening, KHÔNG phải fix ERR-161.
2. ✅ **XONG** — map DB-conn-failure → **503 Service Unavailable + Retry-After** thay vì 500: `GlobalExceptionHandler.handleDbUnavailable` bắt `DataAccessResourceFailureException` (gồm `CannotGetJdbcConnectionException`) + `CannotCreateTransactionException` (trường hợp @Transactional fail ở tx-begin — chính là login). 2 test mới, full suite 887/887 green. ⏳ cần deploy để có hiệu lực prod.
3. ⚠️ **MỘT PHẦN** — k6: đã chạy `baseline.js` (10 VUs/30s, read-only) lên prod → healthy (health 200, không 500; p95~1s do mạng VN↔us-east-1 + HW nhỏ). **KHÔNG chạy `ramp.js`/`spike.js` (100-250 VUs) lên prod** vì chúng được thiết kế để ép pool tới ngưỡng vỡ → rủi ro gây outage thật cho user. Bằng chứng "bền" 100 CCU phải chạy trên **staging** (chưa có) hoặc prod trong **maintenance window + abort thresholds + giám sát**, không phải bừa lên live. Đây là quyết định cần con người.
