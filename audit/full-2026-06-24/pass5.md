# PASS 5 — FRONTEND & MOBILE (trục A/C/D phía client)

> Greenfield (audit cũ chưa có FE-n/MOB-n). file:dòng + CONFIRMED/SUSPECTED. Web = `frontend/src` (Next.js 14). Mobile = `mobile/` (Expo SDK52/RN0.76) + `ios/`.

---

## A. WEB FRONTEND

### A.1 Route guard & auth
**Tốt (CONFIRMED):** `middleware.ts` **verify chữ ký JWT server-side** (Edge), không chỉ check tồn tại cookie:
- `middleware.ts:139` `jwtVerify(token, …secret)` (HS256) / `:125` `importSPKI` (RS256), chọn theo `alg` header (`:113`); role đọc từ claim đã verify (`:126 normalizeRole(payload.role)`). Matcher phủ toàn site (`:348`), `/org/*` qua `orgRole` claim, `/v2/*` nhánh riêng. → user **không** forge role bằng sửa cookie. ✅

- **FE-2 🟠** — **Middleware fail-OPEN khi thiếu verifier env.** `middleware.ts:269-279`: `if(!hasVerifier) return passThrough()` — không có `JWT_SECRET`/`JWT_RSA_PUBLIC_KEY` runtime → TẮT mọi gating, mọi route protected lọt. Cố ý (tránh outage #67) + có build-guard `amplify.yml:26` abort build. Nhưng env drop/rotation gap runtime → tụt về client-guard âm thầm. **CONFIRMED.** Fix: build-guard authoritative + alert runtime khi `hasVerifier=false`.
- **FE-3 🟠** — **Layout role KHÔNG re-check server-side.** `app/v2/admin/layout.tsx:5-7` server component trần, không assert role; `RoleShell.tsx:48` resolve role **client-side** chỉ để chọn accent, không chặn. Nếu FE-2 fail-open / middleware bypass → STUDENT vào `/v2/admin/users` render shell + trigger fetch admin; chặn duy nhất = backend 403. **CONFIRMED.** Single point of failure ở middleware. Fix: assert role ở mỗi role-layout (verify cookie) + boundary "not authorized" trên 403.

### A.2 Token storage (security-critical)
- **FE-5 🟠** — **Access token ở sessionStorage + mirror cookie KHÔNG HttpOnly** (`authSession.ts:154` sessionStorage; `:159` `setCookie(AUTH_ACCESS_COOKIE,…)` chỉ `SameSite=Lax;Secure`, **không HttpOnly** vì middleware+JS cần đọc). Refresh token **đúng** HttpOnly (`:98-101`). → XSS đọc được access token. Mitigate: refresh HttpOnly giới hạn blast tới TTL access. **CONFIRMED.** Fix: rút ngắn TTL access; ưu tiên CSP (FE-15)+XSS hygiene.
- **FE-6 🟠** — **Zustand `persist` ghi PII + JWT vào localStorage.** `useUserStore.ts:28-48` persist toàn state (không `partialize`) → `localStorage['deutschflow-user-store']` chứa `user.email/displayName/roles` mọi login; và **raw JWT** khi `setAccessToken` ở `org/accept/client-page.tsx:86` (sống qua restart, XSS đọc). Comment `:45` tự nhận "shouldn't persist tokens". **CONFIRMED.** Fix: `partialize:(s)=>({locale:s.locale})`, bỏ field accessToken.
- **Tốt:** `api.ts:106-163` attach Bearer từ sessionStorage, 401→refresh (single-flight `refreshPromise`)→retry, retry chỉ method idempotent (`:61`) → **không** double-submit POST. ✅ Không token trong URL (trừ invite token FE-9).
- **FE-9 🟡** — Org invite token đi trong **URL query** (`org/accept/client-page.tsx:82`) → lọt history/access-log/Referer. Fix: POST body / one-time exchange.
- **FE-10 ✅** — Mọi `dangerouslySetInnerHTML` là dev-controlled (JSON-LD/CSS tĩnh), **không** sink XSS.

### A.3 State / money / double-submit
- **FE-11 🟠** — **Giá plan hardcode 2 nơi** (`student/pricing/page.tsx:12-16` `{FREE:0,PRO:299000,ULTRA:699000}` + `v2/payment/page.tsx:24-55`), không có endpoint plan-list → drift với giá backend tính thật. **CONFIRMED.** Fix: `/payments/plans` endpoint, xoá 2 map.
- **FE-12 ✅** — Quota **display-only**, mirror backend (`aiSpeakingQuota.ts:4-9`, `/ai-speaking/quota`); FE không tự authorize. ✅
- **FE-13 ✅** — Nút checkout disable-on-submit (`pricing/page.tsx:228`, `v2/payment/page.tsx:131`) + full-nav away → chống double-submit. ✅
- **FE-14 🟡** — `PremiumGate.tsx:40` tin plan client (`PlanContext` từ `/auth/me/plan`); variant overlay chỉ blur (`:82` content vẫn trong DOM, đọc qua devtools). Đúng pattern NẾU backend enforce mọi premium endpoint. Fix: không render children khi `!hasAccess`; verify backend enforce.

### A.4 Perf / i18n / test
- **FE-15 🟡** — Lib nặng phần lớn **không** code-split: chỉ skill-tree (`@xyflow`) `next/dynamic` (`SkillTreeFlowWrapper.tsx:13`); `framer-motion`+`recharts` import tĩnh nhiều trang student → phình app-bundle (budget 300kb rủi ro). **SUSPECTED** (chưa đo, không có analyzer). Fix: `next/dynamic` cho recharts/framer nặng.
- **FE-17 🟠** — **Toàn bộ `/v2/*` (97 file) ZERO next-intl**, chuỗi hardcode tiếng Việt (`v2/payment/page.tsx:30,155`, `v2/admin/page.tsx:17`, `v2/admin/users/page.tsx:219`). Surface mặc định mới VN-only → user `en`/`de` thấy tiếng Việt; 3 catalog message chết cho v2. **CONFIRMED.** Fix: migrate v2 sang key next-intl.
- **FE-18 🟡** — Không `getMessageFallback`/`onError` trên intl provider (`layout.tsx:81`) → key thiếu ở `de`/`en` throw/hiện raw key. Fix: thêm fallback nuốt `MISSING_MESSAGE`.
- **FE-19 🟠** — **E2E login dùng `FAKESIGNATURE` JWT + mock route** (`tests/e2e/auth.spec.ts:15`; helper `tokens.ts:31` tự ghi "middleware not reached") → **bất biến authz cốt lõi (forged/wrong-role → reject) KHÔNG được test**. **CONFIRMED.** Fix: spec hit `/admin` bằng STUDENT-signed token, assert redirect.
- **FE-20 🟡** — Payment e2e chỉ happy-path (`payment-and-srs.spec.ts`); **không** test double-submit / quota-exceeded-block. Fix: thêm 2 spec.

---

## B. MOBILE (Expo) + iOS — surface AN TOÀN NHẤT

**Kết luận: mobile hardened tốt, chỉ LOW/INFO.** (CONFIRMED)
- **Token: SecureStore (Keychain/Keystore)** `lib/auth.ts:14-28`, `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` `:10-12` (loại khỏi iCloud/backup). Refresh single-flight + logout-on-fail (`api.ts:64-83`). MMKV chỉ cho SRS offline count, không token. ✅
- **TLS:** base HTTPS hardcode `constants.ts:1` `https://api.mydeutschflow.com/api`, **0 cleartext**, ATS `NSAllowsArbitraryLoads=false` (`mobile/ios/.../Info.plist:49-55`), Android `usesCleartextTraffic=false`. Cert pinning scaffold **tắt** có lý do (`certPinning.ts:19`). ✅
- **Secret:** `eas.json`/`app.json` không secret thật, chỉ PostHog `phc_` publishable. ✅
- **Deep link:** scheme `deutschflow` nhưng **không** handler auth/token deep-link; reset = OTP code nhập tay. ✅
- **iOS native `/ios/`** = shell OpenAPI-codegen (chỉ `.xcodeproj`, **không** Swift/Info.plist/entitlements), không tracked. Shipping config = `mobile/ios/` generated, entitlements rỗng, permission strings sane.
- **Student-only** enforce client (`useAuthStore.ts:41-43` reject non-STUDENT). Không eval/WebView untrusted.

- **MOB-1 ⚪** — Refresh force-logout nếu response thiếu refresh token mới (`api.ts:70-72`). Fix: fallback dùng refresh cũ.
- **MOB-2 ⚪** — `__DEV__` log full response body gồm `/auth/*` (`api.ts:50-56`). Fix: redact `/auth/*`. (Chỉ dev, không ship release.)
- **MOB-3 ⚪** — `Linking.openURL(attachmentUrl/submissionFileUrl)` server-provided không allowlist scheme (`assignments/[id].tsx:142,236`). Fix: guard `^https://`.
- **MOB-4 ⚪** — `NSFaceIDUsageDescription` thừa (Face ID không dùng) (`mobile/ios/.../Info.plist:58`). Fix: null hoá ở app.json prebuild.

---

## Bảng điểm Pass 5
| ID | Mức | Vấn đề | file:dòng |
|---|---|---|---|
| FE-2 | 🟠 | Middleware fail-open khi thiếu verifier env | middleware.ts:269-279 |
| FE-3 | 🟠 | Layout role không re-check server-side | app/v2/admin/layout.tsx:5-7; RoleShell.tsx:48 |
| FE-5 | 🟠 | Access token sessionStorage + cookie non-HttpOnly | authSession.ts:154,159 |
| FE-6 | 🟠 | Zustand persist ghi PII+JWT localStorage | useUserStore.ts:28-48; org/accept:86 |
| FE-11 | 🟠 | Giá plan hardcode 2 nơi (drift) | pricing/page.tsx:12; v2/payment/page.tsx:24 |
| FE-17 | 🟠 | /v2/* 97 file zero i18n (VN-only) | app/v2/** |
| FE-19 | 🟠 | E2E auth dùng FAKESIGNATURE, middleware untested | tests/e2e/auth.spec.ts:15 |
| FE-9 | 🟡 | Invite token trong URL query | org/accept/client-page.tsx:82 |
| FE-14 | 🟡 | PremiumGate tin client + blur content trong DOM | PremiumGate.tsx:40,82 |
| FE-15 | 🟡 | Lib nặng không code-split (SUSPECTED) | package.json; SkillTreeFlowWrapper.tsx:13 |
| FE-18 | 🟡 | Không intl fallback key | layout.tsx:81 |
| FE-20 | 🟡 | Payment e2e happy-path only | payment-and-srs.spec.ts |
| MOB-1..4 | ⚪ | refresh brittle / dev-log / openURL / FaceID string | mobile/lib/*, Info.plist:58 |

**Tóm tắt Pass 5**: Web middleware authz **đúng** (verify chữ ký) nhưng **fail-open** (FE-2) + không có lớp authz dự phòng (FE-3); **lưu token rủi ro XSS** (FE-5/FE-6, nhất là JWT vào localStorage ở org/accept). i18n v2 bỏ trống (FE-17). Test money/auth chỉ happy-path, không test reject (FE-19/20). **Mobile/iOS là surface chắc nhất** — chỉ LOW.
