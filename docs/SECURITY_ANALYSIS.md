# DeutschFlow — Phân tích bảo mật & Kế hoạch tối ưu

> **Phạm vi:** Web (`frontend/` Next.js + Amplify), Mobile (`mobile/` Expo — canonical; `frontend/ios|android` Capacitor + `ios-native/` Swift đã đóng băng), và lớp backend đối-mặt-client (`backend/` Spring Boot).
> **Phương pháp:** phân tích tĩnh qua codegraph (1510 files, 22.5k nodes) + đọc mã nguồn.
> **Ngày:** 2026-06-03 · **Nhánh thực thi:** `security/hardening`

---

## 0. Bảng theo dõi (status tracker — để giao việc)

| ID | Hạng mục | Surface | Severity | Trạng thái |
|----|----------|---------|:--------:|:----------:|
| S1 | Prompt-injection chấm thi AI (delimiting + hardening) | Backend/AI | 🟡 | ✅ DONE |
| S2 | Security headers web (HSTS/X-Frame/nosniff/Referrer/Permissions + CSP-RO) | Web | 🟠 | ✅ DONE |
| S3 | Actuator `env`/`metrics` → ADMIN + bỏ `env` khỏi exposure | Backend | 🟡 | ✅ DONE |
| S4 | Middleware bypass `pathname.includes('.')` | Web | 🟡 | ✅ DONE |
| S5 | Rate-limit XFF spoof (trusted client IP) | Backend | 🟡 | ✅ DONE |
| S6 | Hạ log PII (JwtService INFO→DEBUG) | Backend | 🔵 | ✅ DONE |
| S7 | Mobile SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Mobile | 🟡 | ✅ DONE |
| S8 | Mobile ATS/cleartext tường minh (HTTPS-only) | Mobile | 🔵 | ✅ DONE |
| S9 | Bỏ `dangerouslySetInnerHTML` ở landing | Web | 🔵 | ✅ DONE |
| S10 | Dọn service worker cũ trùng lặp (`sw 4..19.js`) | Web | 🔵 | ✅ DONE |
| S11 | Stripe webhook fail-loud khi thiếu secret | Backend | 🔵 | ⏸️ DEFER (file đang được sửa dở; xem §8) |
| S12 | Cert pinning mobile (SPKI) | Mobile | 🟡 | 🧩 SCAFFOLDED (disabled; pins computed; activate per PHASE1 doc) |
| S13 | Jailbreak/root detection + screen-capture protection | Mobile | 🔵 | 🧩 SCAFFOLDED (deviceIntegrity + screenProtection modules; useAppBackgrounded works now; activate per PHASE1 doc) |
| S14 | EAS init + Sentry (observability) | Mobile | 🔵 | 🧩 SCAFFOLDED (DSN-guarded no-op; activate per PHASE1 doc) |
| S15 | SSE one-time ticket thay `?access_token=` | Backend | 🟡 | 📋 PLANNED |
| S16 | Rate-limit → Redis (multi-node) | Backend | 🟡 | 📋 PLANNED (trước khi scale) |
| S17 | CSP nonce-based (Report-Only; flip to enforce) | Web | 🟠 | ✅ DONE (nonce in middleware, Report-Only — flip name to enforce) |
| S18 | RS256 (bỏ chia sẻ secret ký với Amplify) | Backend | 🔵 | 📋 PLANNED |
| S19 | Web access token → in-memory + silent refresh | Web | 🟡 | 📋 PLANNED (refactor, rủi ro UX) |
| S20 | Retire Capacitor plaintext token storage (web auth) | Web | 🟡 | ✅ DONE (authSession.ts now web-only) |
| S20b | Full Capacitor/Swift removal — 5 native-util files refactored (web-safe), native dirs deleted (74 tracked files: frontend/ios, frontend/android, capacitor.config.json, ios-native) | Web/Mobile | 🔵 | 🟦 MOSTLY DONE (only @capacitor dep-lines in package.json deferred — blocked on your uncommitted package.json WIP; remove via `npm uninstall @capacitor/*` once that's committed) |
| S21 | CI security: gitleaks + npm audit + OWASP dep-check + CodeQL | Process | 🔵 | 📋 PLANNED |

Chú thích: ✅ đã làm trên nhánh này · ⏸️ hoãn có lý do · ⛔ cần hạ tầng/tài khoản/thiết bị · 📋 đã lên kế hoạch.

---

## 1. Bảng điểm trưởng thành

| Lĩnh vực | Điểm | Căn cứ |
|---|:---:|---|
| Xác thực & phiên | **A−** | refresh rotation + reuse-detection + revoke; BCrypt; JWT HS256≥32B + rotation + iss/aud; rate-limit |
| Phân quyền (RBAC + ownership) | **A−** | 108 `@PreAuthorize`/`hasRole` + ownership checks chống IDOR |
| Chống injection (SQL/upload) | **A−** | SQL parameterized; upload allowlist+size; Bean Validation |
| Toàn vẹn thanh toán | **A−** | Stripe SDK verify, MoMo HMAC, Apple JWS, idempotency |
| Client Mobile (Expo) | **B+** | SecureStore, HTTPS-only, no WebView/persist/cleartext, role-restricted |
| **Client Web (edge/headers)** | **C → B** | trước: không headers; sau S2/S4/S9/S10: đã thêm headers + sửa bypass |
| Bảo vệ dữ liệu | **B** | secret externalized, no committed secret, anti-enumeration |
| Vận hành / CI | **C+** | thiếu Sentry/EAS, chưa có scanning/SAST/dep-audit; rate-limit in-memory |

**Tổng thể: B/B+** — lõi server-side chín chắn; rủi ro tập trung ở edge web, hardening device mobile, và hạng mục scale/vận hành.

---

## 2. Threat model

| Tài sản | Đe doạ | Kiểm soát | Khoảng trống |
|---|---|---|---|
| Refresh token trên thiết bị | Trộm khi device bị xâm phạm/backup | SecureStore + **rotation+reuse-detection** | Keychain accessibility (S7), không biometric/cert-pin |
| Access token (15′) | XSS (web), MITM | HttpOnly refresh (web), SecureStore (mobile), HTTPS | Web JS đọc được + thiếu CSP nonce; mobile thiếu cert-pin |
| Phiên người dùng | Hijack/reuse | reuse-detection, revoke-all, rate-limit | XFF spoof (S5), rate-limit in-memory (S16) |
| Hạ tầng/cấu hình | Lộ qua actuator | health/info/prometheus đã gate | `env`/`metrics` (S3) |
| Toàn vẹn đánh giá AI | Prompt injection | clamp + recompute server-side | delimiting/hardening (S1) |

---

## 3. Điểm mạnh (giữ nguyên)

1. **Refresh token lifecycle chuẩn OWASP:** rotation + reuse-detection + revoke server-side — [AuthService.refresh()](../backend/src/main/java/com/deutschflow/user/service/AuthService.java).
2. **Phân quyền sâu + chống IDOR:** `@EnableMethodSecurity`, 108 annotation, ownership checks (`ensureTeacherOwns*`, `MediaAssetAccessPolicy`).
3. **Chống injection:** SQL parameterized ([WordQueryService](../backend/src/main/java/com/deutschflow/vocabulary/service/WordQueryService.java)); upload allowlist+size+role ([MediaAssetService](../backend/src/main/java/com/deutschflow/media/service/MediaAssetService.java)).
4. **Thanh toán verify chữ ký đa cổng** + idempotency (Stripe/MoMo/Apple).
5. **Mobile Expo sạch:** SecureStore, HTTPS-only, no WebView/persist/cleartext, log `__DEV__`, chỉ STUDENT, push token authenticated.
6. **Secret management kỷ luật:** externalize, fail-fast, no committed secret, `.gitignore` đúng, JWT rotation.
7. **API có CSP/headers**, anti-enumeration password reset, rate-limit mọi auth endpoint, Swagger/actuator gate ADMIN ở prod.

---

## 4. Phát hiện chi tiết

### 4.1 Web (Next.js / Amplify)
- **[S2] Thiếu toàn bộ security headers** trên origin web — [next.config.mjs](../frontend/next.config.mjs) không có `headers()`. → clickjacking, không có lớp giảm thiểu XSS. **(đã thêm headers)**
- **[S19] Access token JS đọc được** — `sessionStorage` + cookie non-HttpOnly [authSession.ts:174](../frontend/src/lib/authSession.ts). XSS ⇒ trộm token. (refresh token đã HttpOnly — tốt).
- **[S4] Middleware bypass** — `pathname.includes('.')` trả `next()` trước khi check role [middleware.ts:72](../frontend/middleware.ts). **(đã sửa)**
- **[S9] `dangerouslySetInnerHTML`** ở [page.tsx:435](../frontend/src/app/page.tsx) (tĩnh, chưa khai thác được). **(đã bỏ)**
- **[S10] Service worker cũ trùng lặp** `sw 4.js`..`sw 19.js` trong `public/`. **(đã xoá, giữ sw.js/workbox)**

### 4.2 Mobile (Expo)
- **[S7] SecureStore mặc định** không đặt `keychainAccessible` → có thể đồng bộ iCloud Keychain. **(đã đặt THIS_DEVICE_ONLY)**
- **[S8] ATS/cleartext dựa default** — đã đặt tường minh HTTPS-only. **(đã làm)**
- **[S12] Không cert pinning** → MITM nếu CA giả/proxy. **(cần hash cert + device)**
- **[S13] Không jailbreak detection / screen-capture protection.** (defense-in-depth)
- **[S20] Capacitor cũ** lưu token plaintext `@capacitor/preferences` [authSession.ts:16](../frontend/src/lib/authSession.ts) (comment ghi sai "secure storage"). → retire hoặc đổi secure storage.

### 4.3 Backend (đối-mặt-client)
- **[S3] actuator `env`+`metrics`** chỉ gate `authenticated()` (mọi STUDENT đọc được) [application.yml:104](../backend/src/main/resources/application.yml). **(đã gate ADMIN + bỏ env)**
- **[S5] XFF[0] spoof** — `resolveClientIp` lấy phần tử trái nhất [AuthController.java:268](../backend/src/main/java/com/deutschflow/user/controller/AuthController.java). **(đã đổi sang hop tin cậy theo cấu hình)**
- **[S6] PII log INFO** — [JwtService.java:96](../backend/src/main/java/com/deutschflow/common/security/JwtService.java). **(đã hạ DEBUG)**
- **[S11] Stripe fail-silent** khi thiếu secret [StripePaymentService.java:143](../backend/src/main/java/com/deutschflow/payment/service/StripePaymentService.java) — KHÔNG phải lỗ hổng gian lận (return sớm, không cấp quyền); là lỗi vận hành (payment không fulfill). **(hoãn — file đang sửa dở; xem §8)**
- **[S15] `?access_token=` trên URL** cho SSE [JwtAuthFilter](../backend/src/main/java/com/deutschflow/common/security/JwtAuthFilter.java) → lọt access-log. (planned: vé một-lần)
- **[S16] Rate-limit in-memory per-node** [AuthRateLimiterService](../backend/src/main/java/com/deutschflow/user/service/AuthRateLimiterService.java) → yếu khi multi-node. (planned: Redis)
- **[S18] HS256 secret chia sẻ** backend↔Amplify edge. (planned: RS256)

### 4.4 AI (đặc thù sản phẩm)
- **[S1] Prompt injection chấm thi** — xem [PoC](security/POC_PROMPT_INJECTION_EXAM.md). **(đã fix: delimiting + sanitize + hardening; vẫn giữ clamp/recompute)**.

---

## 5. Ảnh hưởng đến dự án

| Khía cạnh | Tác động | Mức |
|---|---|---|
| Doanh thu/entitlement | Thanh toán không giả mạo được; rủi ro = mất doanh thu thầm lặng nếu Stripe secret sai (S11) | 🟡 |
| Dữ liệu người dùng | Password BCrypt; không lưu thẻ (Stripe/MoMo hosted → PCI tối thiểu); rủi ro = PII log + web token theft | 🟡 |
| Compliance (GDPR/PDPD) | Có thể có user EU (app tiếng Đức) → rà quy trình data-subject/retention nếu mở EU | 🟡 |
| Sẵn sàng/chi phí | rate-limit in-memory + XFF + AI cost ⇒ abuse khi scale/bị nhắm | 🟡 |
| Niềm tin/danh tiếng | ATO chặn nhiều lớp; rủi ro lớn nhất = XSS web do thiếu CSP nonce | 🟠 (web) |
| Tốc độ phát triển | 3 codebase client (Expo + Capacitor + Swift đóng băng) ⇒ tăng bề mặt + chi phí bảo trì | 🟡 |
| App/Play Store | Quyền tối thiểu OK; khi bán PRO phải IAP + receipt validate server-side | 🟡 |

---

## 6. Điểm bất lợi / tradeoff

1. **Web edge yếu** (đang khắc phục) — chênh lệch lớn nhất giữa "an toàn" và hiện trạng.
2. **Token web JS-đọc-được** — XSS ⇒ chiếm phiên (S19, refactor có rủi ro UX).
3. **Rate-limit in-memory + XFF** — yếu khi scale (S5 đã giảm, S16 planned).
4. **3 codebase client + Capacitor token plaintext** — nợ kỹ thuật (S20).
5. **Mobile thiếu defense-in-depth** (cert-pin/jailbreak/screen-capture — S12/S13).
6. **Prompt-injection AI** — giảm thiểu nhưng không tuyệt đối (giới hạn LLM).
7. **HS256 secret chia sẻ** (S18 — kiến trúc).
8. **Login revoke-all ⇒ không đa thiết bị** — tradeoff an toàn↔UX.

---

## 7. Kế hoạch theo Phase (tham chiếu §0)

- **Phase 0 (đã làm trên nhánh này):** S1–S10 (trừ S11 hoãn) — fix cấu hình/mã rủi ro thấp.
- **Phase 1 — Mobile depth:** S7/S8 (✅) + S12 cert-pin + S13 + S14 Sentry + S20 retire Capacitor.
- **Phase 2 — Web:** S17 CSP nonce + S19 token in-memory.
- **Phase 3 — Backend platform:** S15 SSE ticket + S16 Redis rate-limit + S18 RS256.
- **Phase 4 — Process/CI:** S21.

---

## 8. Ghi chú thực thi

- **S11 (Stripe):** file `StripePaymentService.java` đang có thay đổi dở của người dùng (2 dòng,
  ngoài phạm vi nhánh security). Để tránh trộn lẫn công việc, **không** tự sửa trong đợt này.
  Đề xuất (áp khi file rảnh): khi thiếu `STRIPE_WEBHOOK_SECRET` ở môi trường production → ném 5xx
  (Stripe sẽ retry) + cảnh báo, thay vì `return` lặng lẽ.
- **docs/ bị gitignore** theo quy ước doc nội bộ của repo. File này + PoC được **force-add**
  (`git add -f`) vào nhánh `security/hardening` để phục vụ mục đích theo dõi/giao việc. Nếu muốn
  giữ local-only: `git rm --cached docs/SECURITY_ANALYSIS.md docs/security/POC_PROMPT_INJECTION_EXAM.md`.
- **Verify đã chạy:** typecheck mobile/frontend cho các file thay đổi; review thủ công thay đổi backend.

## 9. Tham chiếu
- [PoC Prompt Injection — Mock Exam](security/POC_PROMPT_INJECTION_EXAM.md)
- OWASP Top 10 (Web) · OWASP API Security Top 10 · OWASP MASVS (Mobile) · OWASP LLM Top 10
