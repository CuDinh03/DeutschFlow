# PASS 2 — TRACE LUỒNG NGHIỆP VỤ & DÒNG TIỀN (trục B)

> 5 luồng end-to-end (FE→BE→DB→bên thứ ba). Mọi nhận xét kèm `file:dòng` + CONFIRMED/SUSPECTED. ID mới đặt theo prefix: `AUTH-` (auth/session), `PAY-` (payment webhook), `P-` (token-pool, tiếp P-11), `ORG-` (org logic seat/role/billing), `D-` (data/migration, tiếp D-4), `SEC-` (security chung), `S-` (scale). Đối chiếu ID cũ ở cột "Liên hệ".

---

## L1 — Đăng nhập + resolve role + áp quyền

**Đường đi** (CONFIRMED): `POST /api/auth/login` → `AuthController` (rate-limit `allowLogin(ip,email)` 5/60s, Redis+fallback Lua, `application.yml:283-284`; vượt → 429) → `AuthService.login` `:102` trim email → `authenticationManager.authenticate` → `UserDetailsServiceConfig` trim + `findByEmailIgnoreCase` `:27-28` → BCrypt (default cost 10, `SecurityConfig.java:134`) → cấp JWT access 15ph (`application.yml:233`) + refresh UUID 7 ngày lưu bảng `refresh_tokens` (`RefreshToken.java:9`). Refresh **xoay vòng** (`AuthService.java:151` setRevoked) + **phát hiện reuse** → revoke toàn bộ session (`:140-145`). Email case-insensitive fix (#156/#165) **đã vào** code.

**Điểm yếu:**

- **AUTH-1 🟠** — **Reset mật khẩu qua OTP KHÔNG thu hồi session.** `PasswordResetService.resetPassword` cập nhật hash (`PasswordResetService.java:106-109`) nhưng **không** gọi `revokeAllByUserId` — trái với `changePassword` có gọi (`AuthService.java:224`). Luồng kinh điển "bị hack → reset mật khẩu" để nguyên refresh token (7 ngày) + access token của kẻ tấn công. **CONFIRMED.** Fix: sau resetPassword, revoke toàn bộ refresh token của user.
- **AUTH-2 🟠** (liên hệ C2/SEC-1) — **Access token không thu hồi được.** `SessionCreationPolicy.STATELESS` (`SecurityConfig.java:50`), không deny-list; logout chỉ đụng refresh (`AuthController.java:136`). Access JWT sống tới hết 15ph kể cả sau logout/disable/reset, **+60s** do cache UserDetails (`JwtAuthFilter.java:38-41,141`). **CONFIRMED.** Fix: deny-list Redis theo `userId` "tokens-invalid-before", check ở filter; hoặc rút ngắn TTL.
- **AUTH-3 🟡** — **Mỗi lần login revoke MỌI session khác** (`AuthService.java:129`). Đăng nhập máy mới → văng mọi máy cũ (single-session) — sai UX đa thiết bị cho app học. **CONFIRMED.** Fix: chỉ revoke token cùng device hoặc bỏ, dựa rotation+reuse-detection.
- **AUTH-4 🟡** — **Register rò rỉ tồn tại email/phone** (`AuthService.java:63` "Email này đã được đăng ký", `:67` phone) trong khi login/forgot đã enumeration-safe. Public endpoint rate-limit 10/600s chỉ làm chậm. **CONFIRMED.** Fix: success chung + email "bạn đã có tài khoản".
- **AUTH-5 🟡** — **Forgot + reset dùng chung 1 budget** (5/900s, `application.yml:292-293`; `AuthController.java:165,183`). Flood `forgot` có thể khoá nạn nhân khỏi reset thật; OTP `RANDOM.nextInt(1_000_000)` `%06d` (`PasswordResetService.java:59`). **CONFIRMED.** Fix: tách budget forgot vs reset.
- **AUTH-6 ⚪** — `refresh_tokens.token` **lưu plaintext UUID** (`RefreshToken.java:25-26`, `AuthService.java:304`). Rò DB/backup = token dùng được ngay. Fix: lưu `sha256(token)`.
- **AUTH-7 ⚪** — **PII (email) trong log INFO mỗi request** (`JwtAuthFilter.java:146` "USER AUTHENTICATION SET for {subject}…"), mâu thuẫn chính ghi chú "no PII" của project (`JwtService.java:163`). Fix: log `userId`.
- **AUTH-8 ⚪** — `findByEmail`/`existsByEmail` (case-sensitive) **vẫn tồn tại** (`UserRepository.java:12,24`) — footgun tái mở chính bug #156 nếu caller mới dùng nhầm. Fix: @Deprecated/xoá.

> Info-leak login: thông báo đồng nhất "Invalid email or password" (`AuthService.java:107,111`) — OK. Reset enumeration-safe (luôn 204) — OK.

---

## L2 — Student tiêu thụ token (1 lượt AI Speaking chat)

**Đường đi** (CONFIRMED): `AiSpeakingServiceImpl.chatInner` `:404-413` =
```
txn#1: prepareSpeakingChatTurn → resolveMaxTokens → quotaService.assertAllowed(...)  ChatPrepService.java:312  (CHECK, readOnly)
[ngoài txn] chatCompletionService.runChatCompletion(prep)  :408   ← gọi LLM (Groq/Bedrock), 2-10s
txn#2: finalizeSpeakingChatPersistence → TurnSideEffectsService → aiUsageLedgerService.record → applyUsageDebit  (DEBIT)
```
CHECK và DEBIT ở **2 transaction tách biệt**, kẹp lời gọi LLM ở giữa. `assertAllowed` là `@Transactional(readOnly=true, REQUIRES_NEW)` (`QuotaService.java:63-64`) — **không reserve gì**.

**Phần tốt (CONFIRMED):**
- Ledger + org-counter + wallet debit là **1 transaction nguyên tử** (`AiUsageLedgerService.record` `@Transactional(rollbackFor=Exception.class)` `:26`; org UPSERT `ON CONFLICT … tokens_used + EXCLUDED.tokens_used` `:60-61`; `applyUsageDebit` REQUIRED join txn `QuotaService.java:112`). Crash giữa chừng → rollback cả 3, không nửa-charge/mất-charge/double. → **bác bỏ nghi ngờ profit-leak do crash.**
- P-6/E (catch nuốt `QuotaExceededException`) **ĐÃ SỬA**: `ConversationEvaluationService.java:85-88` + `InterviewEvaluationService.java:84-88` catch riêng `QuotaExceededException` rồi rethrow trước catch rộng. ✅

**Điểm yếu:**

- **P-12 🟠 (MỚI)** — **Stream SSE bị huỷ → bỏ qua debit = LLM miễn phí.** Ledger chỉ ghi trong `onComplete` (`SpeakingStreamService.java:187-189`); khi client abort/timeout, `GroqChatClient.chatCompletionStream` trả `false` **không gọi** `onComplete` (`:196-198`) → `handleStreamCancelled` log "skipping persist" (`SpeakingStreamService.java:272-273`). Model đã sinh token nhưng **không ghi, không trừ**. Cancel là sự kiện thường xuyên ở voice UX → đường rò free dễ khai thác nhất. **CONFIRMED.** Fix: ghi token một phần khi cancel; hoặc reserve token trước (xem P-9).
- **P-13 🟡 (MỚI)** — **usage=null → lượt miễn phí.** `TurnSideEffectsService.java:94-106` chỉ ghi khi `ai.usage()!=null`; Groq blocking có thể trả 200 không có node `usage` → `GroqChatClient.extractResult` set `parsedUsage=null` (`:262-264`) → bỏ qua hoàn toàn (không ghi estimate). **SUSPECTED** (chỉ khi `AI_CHAT_PROVIDER=groq`; default `local` luôn estimate, `AiChatClientFactory.java:20-31`). Fix: nhánh null → ghi `estimateUsage`.
- **P-9 🟠 (CARRY, DEFERRED)** — **check-then-debit không nguyên tử = over-spend không chặn.** Không lock/version trên `user_ai_token_wallets` (PK-only, `V42:2-8`); N lượt đồng thời của 1 user đều qua check, đều gọi LLM. Clamp `GREATEST(0, balance-?)` (`QuotaService.java:140`) **hấp thụ** chứ không **chặn** overage, log `[Quota][P-9/P-11][OVERAGE]` `:135`. **CONFIRMED còn soft-cap.** Fix: reserve nguyên tử `UPDATE … SET balance=balance-? WHERE balance>=?` trước LLM, reconcile sau.

---

## L3 — Tính tiền theo chu kỳ + đếm seat

**Đường đi** (CONFIRMED): Invoice tạo DRAFT trong `OrgBillingService.java:55-86`; seat = `resolveSeats` `:81-86` — nếu `req.seats()>0` lưu nguyên; nếu ≤0 snapshot `COUNT(org_members STUDENT ACTIVE)` **tại thời điểm tạo**. Comment `:76-79` ghi rõ proration "Chưa làm". Activation subscription qua chokepoint chung `SubscriptionActivationService.activatePlan` (advisory lock per-user `:45,127-129`, END row cũ + INSERT 1 row ACTIVE `:49-65`).

**Điểm yếu:**

- **D-5 🟠 (MỚI)** — **Tụt hạng im lặng về DEFAULT (0 token).** `loadActiveCoveringSubscription` dùng **INNER JOIN** `subscription_plans` + lọc `sp.is_active` (`QuotaService.java:531`). Nếu user có row `user_subscriptions` ACTIVE nhưng plan bị `is_active=false` hoặc thiếu → query 0 row → null → `emptySnapshot(now, PLAN_DEFAULT)` (`:157,:293,:370`). User trả tiền (PRO/ULTRA) **bị tụt về 0 token, không lỗi, không đổi subscription**; reconcile không chạy vì vẫn còn row ACTIVE. **CONFIRMED.** Fix: nếu có row ACTIVE mà JOIN rỗng → log lỗi reconcile to/fallback, không giả vờ DEFAULT.
- **D-6 🟡 (MỚI, thay M-6 ở Pass 1)** — **ULTRA seed mong manh theo thứ tự migration.** ULTRA **không** ở V38 (chỉ FREE/PRO/INTERNAL `V38:30-33`); chỉ được INSERT ở `V189__apple_iap.sql:39`. Trước V189, mọi `UPDATE … WHERE code='ULTRA'` ở `V42:19`, `V73:81`, `V129:15`, `V177:2` là **no-op im lặng**. DB migrate đủ thì ULTRA tồn tại, nhưng phụ thuộc thứ tự dễ vỡ. **CONFIRMED.** (Sửa nhận định Pass 1 "ULTRA không seed" — nó CÓ seed, ở V189.) Fix: gộp seed ULTRA về migration sớm/idempotent.
- **P-14 🟠 (MỚI; REOPEN M-5 một phần)** — **Đường org-pool bỏ qua `pool_unlimited`.** `OrgQuotaService.wouldExceedOrgPool` coi `pool<=0` là unlimited (`:86-88`) và **không** đọc cột `pool_unlimited` (V237) — trong khi `FreeTierGuard.orgMemberCapped` **có** honor nó (`FreeTierGuard.java:105-110`). M-5 chỉ đóng cho PPTX/OCR (FreeTierGuard), **không** đóng cho org-pool metering. Org mới tạo (`monthly_token_pool=0` mặc định, `Organization.java:48`, `V205:5`) → org-pool gate **vô hiệu** tới khi admin set pool>0; wallet cá nhân vẫn áp. **CONFIRMED.** Fix: `OrgQuotaService` đọc cả `pool_unlimited`, dùng cùng bảng quyết định như `FreeTierGuard`.
- **ORG-1 🟠 (MỚI; REOPEN J cho admin-add)** — **Seat-limit không enforce ở chokepoint.** Check `COUNT(STUDENT ACTIVE) >= seat_limit` chỉ nằm ở 2 caller: `AdminOrgService.addMember` `:233-241` và `OrgRosterService` `:121-130`; **không** ở `OrgMembershipService.upsertMember` `:55` (nguồn-sự-thật add member). Roster có `SELECT … FOR UPDATE` (`OrgRosterService.java:71`) nhưng **admin-add KHÔNG có lock** và **không có constraint/trigger DB** (grep mọi migration = 0); `org_members` PK `(org_id,user_id)` chỉ chặn trùng user, không chặn vượt seat. 2 admin thêm 2 student khác nhau đồng thời ở `seat_limit-1` → cả hai pass → `seat_limit+1`. **CONFIRMED (race SUSPECTED nhưng không có backstop).** Fix: chuyển gate+lock vào `upsertMember`.

> Mid-cycle churn: invoice bất biến, `monthly_token_pool` độc lập số member → flat, không proration (đúng mô hình seat-license). Removal: `removeMember/selfLeave` set REVOKED/LEFT + `OrgEntitlementService.revokeStudent` kết thúc subscription source='ORG'. **CONFIRMED.**

---

## L4 — Admin tạo org + cấp seat + gán role (authz)

**Kết luận: mô hình authz LÀNH MẠNH — không có escalation/IDOR.** (CONFIRMED)
- Đổi role org chỉ OWNER (`OrgController.changeMemberRole` + `OrgGuard.assertOrgOwner` `:151`/`OrgGuard.java:52-54`), new role ∈ {MANAGER,TEACHER} (OWNER **không** assignable qua org surface); MANAGER/TEACHER/STUDENT không gọi được → không tự thăng. Set OWNER chỉ qua admin (`AdminOrgService`). `User.Role` = {STUDENT,TEACHER,MANAGER,OWNER,ADMIN}, **không kế thừa** (PR #152).
- `orgId` luôn lấy từ principal, **không nhận từ client** (`OrgController.java:40`); classId/userId path re-scope theo org caller → 404 nếu khác org (`OrgService.java:159,197,134`; `OrgInvitationService.java:110`). → **T-4 cũ xác nhận thực sự throw.**
- Auto-promote STUDENT→TEACHER on join + auto-demote→STUDENT on leave **có** check "còn membership staff ACTIVE khác không" (`OrgMembershipService.java:178-182,206-213`; `OrgMemberRepository.java:18`). ✅ (finding I cũ OK)
- **H cũ ĐÃ SỬA**: `attachOwner` nay nguyên tử trong `@Transactional createOrganization`, tạo owner lỗi → rollback cả org (`AdminOrgService.java:298-330`). ✅

**Điểm yếu (đều thấp/blast-radius):**
- **SEC-2 🟡** — **Admin god-mode reset password mọi user, không scope org, không notify.** `PATCH /api/admin/users/{id}/password` (`AdminManagementController.java:257-274`) reset bất kỳ ai kể cả B2C ngoài org; 1 credential ADMIN lộ = chiếm toàn bộ user base. **CONFIRMED.** Fix: email "mật khẩu bị admin reset" + cân nhắc step-up auth.
- **ORG-2 ⚪** — MANAGER pre-create TEACHER với mật khẩu tự đặt (`OrgController.java:108-110`; `OrgInvitationService.preCreateTeacher:193-221`); chặn email đã tồn tại (`:206-208`) nên không chiếm tài khoản có sẵn, nhưng không có chứng minh sở hữu email. Fix: ép verify email/đổi mật khẩu lần đầu.
- **ORG-3 ⚪** — **Không enforce bất biến 1-OWNER** (comment khẳng định nhưng không có guard DB/service); admin có thể gắn nhiều OWNER (`AdminOrgService.java:53`; `upsertMember` không check). Fix: chặn OWNER khi org đã có OWNER ACTIVE.
- **ORG-4 ⚪ (operability)** — **Không có endpoint chuyển quyền OWNER**; `selfLeave`/`changeRole` cấm đụng OWNER và trỏ tới "chuyển quyền sở hữu" — luồng **không tồn tại**. OWNER nghỉ việc → org kẹt. Fix: thêm `PATCH /api/org/ownership` OWNER-only.
- **ORG-5 ⚪ (SUSPECTED)** — `detachUser` demote mọi staff rời org về STUDENT, kể cả TEACHER độc lập (marketplace, `AdminTeacherService.listFreeTeachers:47`) chưa từng do org cấp → mất danh tính TEACHER. Fix: gate demote theo `createdVia`/flag.

---

## L5 — Payment webhook (4 cổng) — chữ ký / idempotency / replay / double-credit

4 endpoint đều `permitAll` (M-7): MoMo `SecurityConfig.java:80`, Stripe `:82`, Apple `:84`, SePay `:86` → an toàn phụ thuộc HOÀN TOÀN verify trong handler.

| Cổng | Chữ ký | Idempotency | Amount/Plan trust | Replay | Kết luận |
|---|---|---|---|---|---|
| **Stripe** | `Webhook.constructEvent(raw, sig, secret)` `StripePaymentService.java:151`; fail-closed 503 nếu secret rỗng `:143-149` | Atomic claim `markSuccessIfNotAlready` `:200` + UNIQUE order_id | ⚠ tin `metadata.planCode` `:178`, **không** so `amount_total` | timestamp tolerance 5ph + idempotent | **An toàn** (trừ PAY-3) |
| **MoMo** | HMAC-SHA256 verify trước xử lý `:171,328-352`; amount khớp đơn `:193` (SEC-9) | read-check-return trên `orderId` `:180-183` (không atomic) | OK (plan/amount từ row server) | không freshness check | ⚠ **PAY-1** |
| **Apple** | JWS/x5c verify (notification + inner txn) `AppleServerNotificationService.java:79,109`; fail-closed nếu chưa cấu hình | PK `notification_uuid` ON CONFLICT DO NOTHING `:96`,`V189:59-63` | productId từ JWS → catalog server (không tin giá Apple) | forward-only + uuid dedup | **An toàn** |
| **SePay** | API-Key header constant-time `MessageDigest.isEqual` `SepayWebhookController.java:55-62`; fail-closed nếu rỗng | UNIQUE(sepay_id) `V216:15` + catch DIVException `:42-46` | amount ≥ invoice `:86`; match `DFINV…` từ memo | uuid dedup + chỉ settle DRAFT/SENT | **An toàn** |

**Điểm yếu:**

- **PAY-1 🟠 (MỚI)** — **MoMo IPN không fail-closed với secret `"dummy"` mặc định.** `application.yml:513` `MOMO_SECRET_KEY:dummy` (khác Stripe/SePay fail-closed khi rỗng). `verifyIpnSignature` HMAC bằng `"dummy"` mà không guard; `@PostConstruct` chỉ log warn (`:73-77`). Deploy chưa cấu hình MoMo → kẻ tấn công biết key `"dummy"` **giả chữ ký IPN hợp lệ, kích hoạt plan bất kỳ**. **CONFIRMED.** Fix: từ chối IPN khi secret rỗng/`"dummy"`.
- **PAY-2 🟡 (MỚI)** — **Không rate-limit endpoint webhook** (`/api/payments/**` không có limiter — grep xác nhận). Mỗi request làm DB `@Transactional` + advisory lock; flood (kể cả forgery bị reject) saturate thread/Hikari pool — đúng tiền sử P0 DB-pool của project. **CONFIRMED.** Fix: rate-limit theo IP/global + IP allowlist Stripe/SePay.
- **PAY-3 🟡 (MỚI)** — **Stripe tin metadata `planCode` không so amount đã trả** (`StripePaymentService.java:178-230`); chưa khai thác được (metadata set server-side) nhưng thiếu defense-in-depth. **SUSPECTED.** Fix: so `session.getAmountTotal()` với giá plan trước `activatePlan`.
- **PAY-4 ⚪ (MỚI)** — MoMo idempotency là read-check-return (`:180-183`) không phải atomic claim như Stripe; advisory lock per-user chặn double ACTIVE nên không hiện thực hoá double-credit, nhưng dedup yếu hơn. Fix: dùng `markSuccessIfNotAlready` cho MoMo.
- **PAY-5 ⚪ (MỚI)** — MoMo/SePay không check freshness `responseTime`/timestamp (`MomoPaymentService.java:341` signed nhưng không validate). Replay bị chặn bởi idempotency, chỉ là hardening dư. Fix: reject IPN cũ hơn vài phút.

---

## Bảng điểm yếu Pass 2 (theo mức độ)

| ID | Luồng | Vấn đề | Mức | Trạng thái | file:dòng | Liên hệ |
|---|---|---|---|---|---|---|
| PAY-1 | L5 | MoMo IPN HMAC bằng secret `"dummy"`, không fail-closed | 🟠 | MỚI | application.yml:513; MomoPaymentService.java:171,328-352 | M-7 |
| AUTH-1 | L1 | OTP reset không revoke session | 🟠 | MỚI | PasswordResetService.java:106-109 | — |
| AUTH-2 | L1 | Access token không thu hồi (STATELESS, no deny-list) | 🟠 | MỚI | SecurityConfig.java:50; JwtAuthFilter.java:38-41,141 | C2/SEC-1 |
| P-12 | L2 | Stream cancel → bỏ debit = LLM free | 🟠 | MỚI | SpeakingStreamService.java:272-273; GroqChatClient.java:196-198 | — |
| D-5 | L3 | Tụt hạng im lặng → DEFAULT 0 token nếu plan inactive/thiếu | 🟠 | MỚI | QuotaService.java:531,157,370 | D-6 |
| P-14 | L3 | Org-pool bỏ qua `pool_unlimited`; pool=0=unlimited | 🟠 | MỚI (reopen M-5) | OrgQuotaService.java:86-88 vs FreeTierGuard.java:105-110 | M-5 |
| ORG-1 | L3/L4 | Seat-limit không ở chokepoint; admin-add race, no DB backstop | 🟠 | reopen J | OrgMembershipService.java:55; AdminOrgService.java:233 | J/K |
| P-9 | L2 | check-then-debit soft-cap (over-spend không chặn) | 🟠 | CARRY/DEFERRED | QuotaService.java:63-64,140 | P-9/P-10 |
| SEC-2 | L4 | Admin god-mode reset password, no notify/scope | 🟡 | MỚI | AdminManagementController.java:257-274 | — |
| PAY-2 | L5 | Không rate-limit webhook (DoS → DB-pool) | 🟡 | MỚI | (no limiter on /api/payments/**) | O-3 |
| PAY-3 | L5 | Stripe tin metadata planCode, không so amount | 🟡 | MỚI | StripePaymentService.java:178-230 | — |
| P-13 | L2 | usage=null (Groq) → turn free | 🟡 | MỚI (cond.) | TurnSideEffectsService.java:94-106 | P-1 |
| D-6 | L3 | ULTRA seed mong manh (chỉ V189) | 🟡 | MỚI | V189:39; V42/V73/V129/V177 | M-6 |
| AUTH-3 | L1 | Login revoke mọi session (single-session UX) | 🟡 | MỚI | AuthService.java:129 | — |
| AUTH-4 | L1 | Register rò rỉ email/phone (enumeration) | 🟡 | MỚI | AuthService.java:63,67 | — |
| AUTH-5 | L1 | Forgot+reset chung budget rate-limit | 🟡 | MỚI | AuthController.java:165,183 | — |
| AUTH-6 | L1 | refresh token plaintext at rest | ⚪ | MỚI | RefreshToken.java:25-26 | — |
| AUTH-7 | L1 | PII (email) trong log INFO | ⚪ | MỚI | JwtAuthFilter.java:146 | — |
| AUTH-8 | L1 | findByEmail case-sensitive còn tồn tại | ⚪ | MỚI | UserRepository.java:12,24 | #156 |
| ORG-2 | L4 | MANAGER pre-create teacher mật khẩu tự đặt | ⚪ | MỚI | OrgController.java:108-110 | — |
| ORG-3 | L4 | Không enforce 1-OWNER invariant | ⚪ | MỚI | OrgMembershipService.java:54-80 | — |
| ORG-4 | L4 | Không có chuyển quyền OWNER (operability) | ⚪ | MỚI | OrgController.java:159-164 | — |
| ORG-5 | L4 | Demote TEACHER độc lập → STUDENT khi rời org | ⚪ | SUSPECTED | OrgMembershipService.java:173-185 | I |
| PAY-4 | L5 | MoMo idempotency read-check-return | ⚪ | MỚI | MomoPaymentService.java:180-183 | — |
| PAY-5 | L5 | MoMo/SePay không freshness check | ⚪ | MỚI | MomoPaymentService.java:341 | — |

**Đã xác nhận SỬA (không báo lại): ** P-6/E (catch nuốt), H (attachOwner), T-4 (IDOR org), I (auto-demote), J/K (roster seat lock — chỉ roster), M-1/M-3.

---

## Danh sách file đã đọc để kiểm chứng (Pass 2)
```
user/: AuthController, AuthService, JwtService, JwtAuthFilter, UserDetailsServiceConfig,
       AuthRateLimiterService, PasswordResetService, StudentTrialSubscriptionProvisioner,
       RefreshToken(+Repository), UserRepository, User.java
common/security/SecurityConfig.java; common/quota/QuotaService.java, AiUsageLedgerService.java, FreeTierGuard.java
speaking/: AiSpeakingServiceImpl, ChatPrepService, ChatCompletionService, TurnSideEffectsService,
           SpeakingStreamService, AISpeakingController, SpeakingAiHelpersService,
           ConversationEvaluationService, InterviewEvaluationService; ai/GroqChatClient, AiChatClientFactory, LocalAiChatClient
organization/: OrgBillingService, OrgService, OrgController, OrgGuard, OrgMembershipService,
               OrgRosterService, OrgInvitationService, OrgEntitlementService, OrgQuotaService, OrgPoolGuard,
               Organization, OrgMember(+Repository); admin/AdminOrgService, AdminOrganizationController,
               AdminManagementController, AdminManagementService, AdminTeacherController, AdminTeacherService
payment/: StripePaymentController/Service, MomoPaymentController/Service, AppleIapController/Service,
          AppleServerNotificationService, AppleJwsVerifier, AppleSubscriptionStore, SepayWebhookController/Service,
          SubscriptionActivationService, PaymentTransaction(+Repository)
migrations: V38, V41, V42, V73, V129, V177, V189, V204, V205, V216, V237; application.yml:225-528
```
