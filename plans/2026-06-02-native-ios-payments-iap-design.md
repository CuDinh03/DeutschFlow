# DeutschFlow — Thiết kế chi tiết Payments / StoreKit IAP cho Native iOS

> **Ngày:** 2026-06-02 · **Phụ thuộc:** [Kế hoạch Native iOS](2026-06-02-native-ios-migration-plan.md) (Phase 5)
> **Phạm vi:** Bán subscription trong app iOS native đúng luật App Store, **dùng chung backend Java**, đồng bộ entitlement đa nền tảng (web Stripe/MoMo ↔ iOS Apple).
> **Stack đã xác nhận:** Spring Boot 3.2.5 / Java 17 · Postgres · StoreKit 2 (iOS 17+).

---

## 1. Bối cảnh & ràng buộc

**App Store Guideline 3.1.1:** nội dung số tiêu thụ trong app **bắt buộc dùng Apple IAP**. Stripe/MoMo checkout in-app sẽ bị từ chối review. App Expo hiện tại né bằng cách **không có UI mua** (chỉ text "quản lý trong tài khoản") → native cần paywall thật → cần IAP.

**Anti-steering (3.1.3):** trong app iOS **không** được link/khuyến khích mua ngoài (web). Nhưng **được phép tôn trọng** entitlement đã mua ở nơi khác (multiplatform service) — chỉ là không được dẫn dắt mua ngoài.

→ **Quy tắc thiết kế:** Paywall iOS **chỉ** chào sản phẩm StoreKit. Entitlement mua qua Stripe/MoMo (web) vẫn được honor im lặng trên iOS.

---

## 2. Phát hiện then chốt: tầng entitlement đã provider-agnostic

```
                      ┌─────────────────────────────────────────┐
   Stripe (web) ─┐    │  SubscriptionActivationService           │
   MoMo  (web) ──┼──► │  .activatePlan(userId, planCode, months) │ ──┐
   Apple (iOS) ──┘    └─────────────────────────────────────────┘   │
   (provider mới)                                                    ▼
                          ┌──────────────────────────────────────────────┐
                          │  user_subscriptions (SOURCE OF TRUTH)          │
                          │  (user_id, plan_code, status, starts_at, ends) │
                          └──────────────────────────────────────────────┘
                                                   │
              GET /api/auth/me/plan ◄──────────────┘  (PlanBadge → MyPlanResponse)
              → tier hiển thị cho MỌI client, không quan tâm mua bằng gì
```

- `user_subscriptions` = entitlement provider-agnostic: chỉ `plan_code` + `status` (ACTIVE/ENDED) + `ends_at`.
- `payment_transactions.provider` đã là string ("STRIPE"/"MOMO") + `order_id` UNIQUE để idempotent.
- `SubscriptionActivationService.activatePlan(...)` là điểm vào dùng chung (deactivate cũ → insert mới → seed token wallet → notify admin).
- App đọc tier qua `GET /api/auth/me/plan`.

→ **Apple = provider mới gọi vào cùng cơ chế.** Phần còn lại của app (QuotaService, PlanBadge, gating) **không đổi một dòng**.

Plan codes hiện có: `FREE` / `PRO` (299k VND, 1 tháng) / `ULTRA` (699k VND, 1 tháng) / `DEFAULT` / `INTERNAL`.

---

## 3. Khác biệt cốt lõi: Stripe one-time vs Apple auto-renew

| | Stripe hiện tại | Apple IAP |
|---|---|---|
| Loại | `Mode.PAYMENT` — trả 1 lần | **Auto-renewable subscription** |
| Gia hạn | Người dùng mua lại thủ công | **Apple tự charge** mỗi chu kỳ |
| `ends_at` | `now + durationMonths*30` | **= `expiresDate` do Apple cấp** |
| Lifecycle | Chỉ 1 sự kiện `completed` | Nhiều: renew, cancel, refund, grace, expire… |
| Đồng bộ | 1 webhook | **App Store Server Notifications V2** (liên tục) |

**Hệ quả thiết kế:** không tính `ends_at` bằng `now + duration` cho Apple. `ends_at` **luôn lấy từ `expiresDate`** của transaction/renewal, và được **App Store Server Notifications V2** đẩy về để gia hạn. Cần một biến thể activation nhận `endsAt` tường minh.

---

## 4. Thay đổi data model (additive, không phá vỡ)

### 4.1. Bảng mới: `apple_subscriptions` (sổ cái phía Apple, để correlate + lifecycle)
```sql
CREATE TABLE apple_subscriptions (
    original_transaction_id VARCHAR(64) PRIMARY KEY,  -- ID ổn định xuyên suốt các lần renew
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id        VARCHAR(128) NOT NULL,           -- com.deutschflow.app.pro.monthly...
    plan_code         VARCHAR(32) NOT NULL,            -- map → subscription_plans.code
    status            VARCHAR(24) NOT NULL,            -- ACTIVE / GRACE / EXPIRED / REVOKED / REFUNDED
    expires_at        TIMESTAMP,                       -- = Apple expiresDate (đẩy ends_at)
    auto_renew_status BOOLEAN,
    environment       VARCHAR(12) NOT NULL,            -- Sandbox / Production
    latest_transaction_id VARCHAR(64),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_apple_subs_user ON apple_subscriptions(user_id);
```

### 4.2. Bảng map sản phẩm: `apple_products` (hoặc config)
```sql
CREATE TABLE apple_products (
    product_id      VARCHAR(128) PRIMARY KEY,   -- App Store Connect product id
    plan_code       VARCHAR(32) NOT NULL REFERENCES subscription_plans(code),
    duration_months INT NOT NULL                -- để hiển thị/tham chiếu; ends_at vẫn theo Apple
);
-- VD: ('com.deutschflow.app.pro.monthly',   'PRO',   1)
--     ('com.deutschflow.app.ultra.monthly', 'ULTRA', 1)
```

### 4.3. `users`: thêm `apple_app_account_token UUID`
UUID ổn định/người dùng. App đính kèm khi mua (`appAccountToken`) → xuất hiện trong transaction & notification → **correlate notification về đúng user** mà không cần Apple biết userId.

### 4.4. `payment_transactions`: tái dùng nguyên trạng
- `provider = "APPLE"`, `order_id = transactionId` (UNIQUE → idempotent/replay-safe như Stripe), `provider_transaction_id = originalTransactionId`, `raw_ipn_payload = JWS payload`.

> Giá Apple do App Store Connect quản lý (price tier theo storefront), **không** đẩy `price_vnd` lên Apple. Server không cần giá Apple để cấp quyền — chỉ tin `productId → planCode`.

---

## 5. Thành phần Backend (Java)

Thêm package `com.deutschflow.payment.apple`. Thư viện: **`com.apple.itunes.storekit:app-store-server-library`** (verify JWS, decode transaction & notification, App Store Server API client).

```
payment/apple/
├── AppleIapController.java          # 3 endpoint: /verify, /sync, /notifications
├── AppleIapService.java             # verify JWS giao dịch → record tx → activate
├── AppleServerNotificationService.java  # xử lý ASSN V2 → chuyển trạng thái
├── AppleEntitlementSyncer.java      # apple_subscriptions → user_subscriptions
├── AppleJwsVerifier.java            # SignedDataVerifier (Apple Root CA + bundleId + env)
├── AppleProductCatalog.java         # productId ↔ planCode/duration
└── AppleStoreServerApiClient.java   # fallback reconcile (getAllSubscriptionStatuses)
```

### 5.1. Endpoints (`/api/payments/apple`)
| Method | Path | Mục đích | Bảo mật |
|---|---|---|---|
| `POST` | `/verify` | App gửi JWS giao dịch sau khi mua → verify + activate | JWT user (như mọi API) |
| `POST` | `/sync` | Restore / reconcile: app gửi current entitlements | JWT user |
| `POST` | `/notifications` | **Apple → server** (ASSN V2), payload JWS ký | **Không JWT** — xác thực bằng chữ ký JWS (giống webhook Stripe HMAC) |

> `/notifications` phải nằm trong allowlist `permitAll` của `SecurityConfig` (như `/api/payments/stripe/webhook`, `/api/payments/momo/ipn`), bảo vệ bằng verify chữ ký Apple — **không** bằng JWT.

### 5.2. Refactor nhỏ `SubscriptionActivationService`
Thêm biến thể nhận `endsAt` tường minh; giữ API cũ delegate vào nó (không phá Stripe/MoMo):
```java
@Transactional
public void activateWithExplicitEnd(Long userId, String planCode, Instant startsAt, Instant endsAt) { /* deactivate cũ → insert mới → seed wallet → notify */ }

public void activatePlan(Long userId, String planCode, int months) {  // giữ nguyên cho Stripe/MoMo
    Instant now = Instant.now();
    activateWithExplicitEnd(userId, planCode, now, now.plus(months*30L, DAYS));
}
```
Apple gọi `activateWithExplicitEnd(userId, planCode, purchaseDate, appleExpiresDate)`.
**Guard chống notification trễ/đảo thứ tự:** chỉ dời `ends_at` **tiến lên** (không rút ngắn vì payload cũ).

### 5.3. Bản đồ Notification V2 → hành động
| notificationType (subtype) | apple_subscriptions | user_subscriptions |
|---|---|---|
| `SUBSCRIBED` (INITIAL_BUY/RESUBSCRIBE) | upsert ACTIVE, expires_at | activate (planCode, ends=expires) |
| `DID_RENEW` | ACTIVE, dời expires_at | extend ends_at (forward-only) |
| `DID_CHANGE_RENEWAL_STATUS` (AUTO_RENEW_DISABLED) | auto_renew=false | giữ ACTIVE đến hết kỳ |
| `DID_CHANGE_RENEWAL_PREF` (up/down/crossgrade) | đổi product/plan kỳ tới | áp dụng khi renew |
| `DID_FAIL_TO_RENEW` (GRACE_PERIOD) | GRACE | giữ ACTIVE đến hết grace |
| `EXPIRED` / `GRACE_PERIOD_EXPIRED` | EXPIRED | end → về FREE |
| `REFUND` | REFUNDED | end ngay |
| `REVOKE` (Family Sharing) | REVOKED | end ngay |
| `RENEWAL_EXTENDED` | dời expires_at | extend |

---

## 6. Thành phần Client (Swift / StoreKit 2)

`Core/Payments/StoreKitManager.swift` (`@Observable` / actor):

1. **Tải sản phẩm:** `Product.products(for: productIds)` (productIds lấy từ server `/api/payments/apple/products` hoặc hằng số).
2. **Lấy appAccountToken:** đọc `apple_app_account_token` từ `/api/auth/me`.
3. **Mua:**
   ```swift
   let result = try await product.purchase(options: [.appAccountToken(token)])
   switch result {
   case .success(let verification):
       let jws = verification.jwsRepresentation           // gửi NGUYÊN cho server
       try await api.appleVerify(jws)                     // POST /api/payments/apple/verify
       try await refreshPlan()                            // GET /api/auth/me/plan
       if let txn = try? checkVerified(verification) { await txn.finish() }  // CHỈ finish sau khi server xác nhận
   case .pending, .userCancelled: ...
   }
   ```
4. **Listener gia hạn/ngắt quãng:** lắng `Transaction.updates` ở app launch → gửi JWS chưa finish lên server → finish.
5. **Restore:** `AppStore.sync()` + duyệt `Transaction.currentEntitlements` → `POST /api/payments/apple/sync`.

**Nguyên tắc vàng:**
- **Server entitlement (`/api/auth/me/plan`) là chân lý** quyết định mở khoá tính năng — KHÔNG tin StoreKit cục bộ để gating (chống jailbreak/giả mạo).
- **Chỉ `transaction.finish()` SAU KHI server xác nhận** activate. Nếu server lỗi → không finish → StoreKit replay ở lần mở app sau → không mất giao dịch.

---

## 7. Sequence chính

**A. Mua mới**
```
App: product.purchase(appAccountToken=UUID)
 → StoreKit trả VerificationResult (JWS, ký bởi Apple)
 → App POST /verify { jws }
 → Server: AppleJwsVerifier.verify(jws)  [Apple Root CA + bundleId + env]
          → decode: productId, transactionId, originalTransactionId, expiresDate, appAccountToken
          → map productId → planCode ; correlate appAccountToken/originalTxId → userId
          → payment_transactions upsert (order_id=transactionId, UNIQUE → idempotent)
          → apple_subscriptions upsert (ACTIVE, expires_at)
          → activateWithExplicitEnd(userId, planCode, purchaseDate, expiresDate)
          → 200 OK
 → App: refresh /api/auth/me/plan (PRO) → transaction.finish()
```

**B. Gia hạn (không cần app mở)**
```
Apple → POST /api/payments/apple/notifications { signedPayload (JWS) }
 → verify chữ ký → notificationType=DID_RENEW
 → apple_subscriptions: dời expires_at (forward-only)
 → user_subscriptions: extend ends_at
 (lần sau app mở, /me/plan đã đúng)
```

**C. Refund / Revoke** → notification `REFUND`/`REVOKE` → end entitlement ngay → user về FREE.

**D. Cross-platform** → user mua PRO qua Stripe (web). Mở app iOS → `/me/plan` = PRO → hiện premium. Paywall iOS **không** hiện (đã PRO). Không vi phạm anti-steering.

---

## 8. Trial 7 ngày (đối chiếu)
`StudentTrialSubscriptionProvisioner` cấp 7 ngày PRO **ở tầng tài khoản** (mọi nền tảng), độc lập payment. → **Giữ nguyên.** Sản phẩm Apple cấu hình là **auto-renewable trả phí, KHÔNG kèm intro free-trial** (tránh trùng 2 lớp trial). Trial server cho trải nghiệm sớm; khi hết, user mua qua IAP. *(Quyết định mở — mục 13.)*

---

## 9. Bảo mật & idempotency (checklist)
- [ ] Verify JWS bằng **Apple Root CA** (x5c chain), kiểm `bundleId` khớp `com.deutschflow.app`.
- [ ] Kiểm `environment` (Sandbox vs Production) — không cấp quyền production từ payload sandbox ở môi trường prod.
- [ ] Idempotent: `payment_transactions.order_id = transactionId` UNIQUE; notification xử lý theo `(originalTransactionId, latest_transaction_id)`; **forward-only** trên `expires_at`/`ends_at`.
- [ ] Chống replay: bỏ qua payload có `expiresDate` cũ hơn state hiện tại.
- [ ] `/notifications` `permitAll` nhưng **chỉ** tin sau khi verify chữ ký (không JWT).
- [ ] Log + lưu `raw_ipn_payload` (JSONB) để audit/đối soát.
- [ ] Fallback: nếu nghi miss notification → gọi **App Store Server API** `getAllSubscriptionStatuses(transactionId)` để lấy trạng thái authoritative.

---

## 10. Cấu hình App Store Connect (việc một lần)
- [ ] Tạo **Subscription Group** "DeutschFlow Premium" + sản phẩm auto-renewable: `pro.monthly`, `ultra.monthly` (+ `.yearly` nếu muốn). Đặt giá theo price tier mỗi storefront.
- [ ] **In-App Purchase Key (.p8)** cho App Store Server API + **App Store Server Notifications V2 URL** (cấu hình **2 URL**: Production + Sandbox).
- [ ] Localized metadata + ảnh review (Apple bắt buộc để duyệt IAP).
- [ ] **Small Business Program** nếu doanh thu < $1M/năm → phí 15% thay vì 30%.
- [ ] Sandbox testers trong Users and Access.

---

## 11. Edge cases
| Tình huống | Xử lý |
|---|---|
| Server down lúc mua | Không `finish()` → StoreKit replay lần sau → re-verify |
| Ask to Buy (trẻ em) | `result == .pending` → chờ `Transaction.updates` |
| Đổi máy / cài lại | Restore: `AppStore.sync()` + `/sync` |
| Family Sharing | `REVOKE` → end entitlement |
| Billing retry/grace | `DID_FAIL_TO_RENEW`(GRACE) giữ ACTIVE đến `gracePeriodExpiresDate` |
| Up/downgrade gói | `DID_CHANGE_RENEWAL_PREF` áp dụng kỳ tới; upgrade tức thì → transaction mới |
| User có cả Stripe (web) + Apple | "latest purchase wins" (theo activatePlan hiện tại) — *xem mục 13* |
| Notification đến trước /verify | Cả hai upsert idempotent; forward-only → không xung đột |

---

## 12. Testing
- **StoreKit Configuration File** (`.storekit`) trong Xcode → test mua/renew/refund **không cần** App Store Connect (renew tăng tốc).
- **Sandbox** (tài khoản sandbox): test luồng thật + ASSN V2 (cấu hình Sandbox URL).
- **TestFlight**: dùng môi trường Sandbox cho IAP.
- Backend: unit test `AppleJwsVerifier` (payload mẫu của Apple), `AppleServerNotificationService` (bảng chuyển trạng thái mục 5.3), idempotency/replay.

---

## 13. Quyết định mở (cần bạn chốt trước khi code)
1. **Gói cho iOS:** chỉ `PRO`/`ULTRA` monthly, hay thêm yearly? (Yearly tăng LTV, giảm churn.)
2. **Trial:** giữ trial-server 7 ngày như hiện tại (đề xuất), hay chuyển sang intro-offer của Apple cho người mua iOS?
3. **Xung đột đa provider:** "latest purchase wins" (đơn giản, đúng code hiện tại) hay "highest tier wins" (ưu ái user)?
4. **Hoàn tiền chéo:** refund Apple chỉ end entitlement, hay thông báo cho user?

---

## 14. Lộ trình triển khai (Phase 5 của kế hoạch native)
| Bước | Backend | iOS |
|---|---|---|
| P5.1 | Migration: `apple_subscriptions`, `apple_products`, `users.apple_app_account_token`; refactor `activateWithExplicitEnd` | — |
| P5.2 | `AppleJwsVerifier` + `app-store-server-library` dep + `AppleProductCatalog` | `StoreKitManager`: load products, hiển thị paywall |
| P5.3 | `POST /verify` + `AppleIapService` → activate | luồng mua → `/verify` → refresh plan → finish |
| P5.4 | `POST /notifications` (ASSN V2) + `AppleServerNotificationService` + `AppleEntitlementSyncer` | `Transaction.updates` listener |
| P5.5 | `POST /sync` + App Store Server API fallback | Restore purchases |
| P5.6 | Unit tests verifier/notification/idempotency | StoreKit config + Sandbox E2E |
| P5.7 | Đối soát Stripe/MoMo (web) vẫn chạy song song | Paywall ẩn khi đã có entitlement |

**Nguyên tắc xuyên suốt:** Apple là **provider cộng thêm**. Stripe/MoMo trên web giữ nguyên. App đọc entitlement qua `/api/auth/me/plan` — không client nào tự quyết tier.

---

## 15. Trạng thái triển khai (2026-06-02)

### ✅ Backend — ĐÃ XONG, build xanh, 20 unit test PASS, đã review (java + security)
- Migration `V189__apple_iap.sql`: `apple_subscriptions`, `apple_products` (+seed PRO/ULTRA monthly+yearly), `users.apple_app_account_token`, `user_subscriptions.source`, `apple_processed_notifications` (exactly-once).
- `SubscriptionActivationService`: `activateWithExplicitEnd` / `extendOrActivateApple` (forward-only) / `endAppleSubscription`; advisory-lock per user; `activatePlan` cũ delegate (Stripe/MoMo không đổi).
- `payment/apple/`: `AppleJwsVerifier` (SignedDataVerifier + Apple Root CA), `AppleProductCatalog`, `AppleSubscriptionStore`, `AppleEntitlementAction` + `AppleServerNotificationService` (ASSN V2, dedup), `AppleIapService` (verify/sync, idempotent, **chống cross-user replay**).
- `AppleIapController`: `POST /verify`, `POST /sync`, `POST /notifications` (permitAll), `GET /account-token`, `GET /products`.
- `SecurityConfig`: `/api/payments/apple/notifications` permitAll (verify bằng chữ ký JWS).
- `application.yml`: block `payment.apple.*` (env-var, default disabled).

**Đã xử lý theo review:** cross-user JWS replay (bind `appAccountToken` + ownership), self-invocation transaction (TransactionTemplate per-item cho /sync), idempotency notification (Apple at-least-once), TOCTOU race (advisory lock), 200→500 cho lỗi hạ tầng (Apple retry), token race (atomic claim), null-guard, SET_GRACE giữ access, tránh double admin-notify.

**Follow-up đã ghi nhận (không chặn):** rate-limit `/verify`+`/sync` · TTL cache product · health indicator khi verifier tắt ở prod · notify user khi refund (cần `NotificationType.REFUND`) · highest-tier-wins (đang latest-wins) · bật OCSP ở prod.

### ⏳ iOS Swift client — CHẶN bởi Phase 0 (chưa có Xcode project)
Code tham chiếu sẵn-dùng ở mục 16. Drop vào `Core/Payments/` khi Phase 0 dựng project.

### 🔑 Chỉ BẠN làm được (cần tài khoản Apple)
1. App Store Connect: tạo Subscription Group + 4 sản phẩm khớp `apple_products` (`com.deutschflow.app.{pro,ultra}.{monthly,yearly}`).
2. Tải Apple Root CA `*.cer` → set `APPLE_ROOT_CERT_DIR`; set `APPLE_APP_APPLE_ID` + `APPLE_IAP_ENVIRONMENT=Production` khi lên prod.
3. Cấu hình **ASSN V2 URL** (Production + Sandbox) → `https://.../api/payments/apple/notifications`.
4. Sandbox testers; (khuyến nghị) Small Business Program 15%.

---

## 16. Swift StoreKit 2 client (tham chiếu)

```swift
import StoreKit

@MainActor
final class StoreKitManager: ObservableObject {
    @Published private(set) var products: [Product] = []
    private var updatesTask: Task<Void, Never>?
    private let api: PaymentsAPI            // your networking layer (URLSession + Bearer JWT)

    init(api: PaymentsAPI) { self.api = api }

    /// Call once at app launch (after login).
    func start(productIds: [String]) async {
        products = (try? await Product.products(for: productIds)) ?? []
        // Renewals, Ask-to-Buy approvals, cross-device purchases arrive here — replay to our server.
        updatesTask = Task.detached { [weak self] in
            for await update in Transaction.updates { await self?.handle(update) }
        }
    }

    func purchase(_ product: Product) async throws {
        // Server-issued UUID binds the purchase to this account for ASSN V2 correlation + anti-replay.
        let token = try await api.appleAccountToken()          // GET /api/payments/apple/account-token
        let result = try await product.purchase(options: [.appAccountToken(token)])
        switch result {
        case .success(let verification): await handle(verification)
        case .pending, .userCancelled:   break                 // pending → wait for Transaction.updates
        @unknown default:                break
        }
    }

    func restore() async throws {
        try await AppStore.sync()
        var jws: [String] = []
        for await entitlement in Transaction.currentEntitlements {
            jws.append(entitlement.jwsRepresentation)
        }
        _ = try await api.appleSync(jws)                       // POST /api/payments/apple/sync
        // Server is the source of truth → caller refreshes GET /api/auth/me/plan afterwards.
    }

    private func handle(_ verification: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = verification else { return }  // discard unverified
        do {
            // GOLDEN RULE: finish() only AFTER our server confirms activation. A server failure leaves the
            // transaction unfinished → StoreKit replays it via Transaction.updates → no lost purchase.
            _ = try await api.appleVerify(verification.jwsRepresentation)      // POST /api/payments/apple/verify
            await transaction.finish()
        } catch {
            // leave unfinished; it will be redelivered
        }
    }
}
```

> Sau `appleVerify`/`appleSync`, gọi `GET /api/auth/me/plan` để lấy tier chuẩn từ server và mở khoá tính năng — **không** gate tính năng bằng StoreKit cục bộ.
```
