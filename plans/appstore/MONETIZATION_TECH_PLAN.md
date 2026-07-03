# DeutschFlow — Monetization Technical Plan (IAP + Ads + ATT)

_Hướng B (full monetization) · Expo SDK 54 · RN 0.81.5 · New Architecture · bundle iOS `com.cudinh.mydeutschflow` · Apple Team `4M3CU3X9SS`._

Bản kỹ thuật quyết định (authoritative) cho monetization v1.0: In-App Purchase (subscription "DeutschFlow Pro"), quảng cáo AdMob cho tài khoản miễn phí, và App Tracking Transparency (ATT). Mọi kết luận dưới đây là quyết định cuối cùng — làm theo là đủ để build & submit.

---

## 0. TL;DR — 3 điều quan trọng nhất

1. **Backend Apple IAP ĐÃ CÓ SẴN và trưởng thành.** Commit `635edbc`, migration `V189`, package `com.deutschflow.payment.*`. `AppleIapController` (`@RequestMapping("/api/payments/apple")`) đã có `/verify`, `/sync`, `/notifications` (ASSN V2), `/account-token`, `/products`; `AppleJwsVerifier` verify chữ ký JWS StoreKit 2 + enforce `bundleId`; idempotency + chống replay cross-account/cross-user + forward-only renewal; ghi vào ledger `user_subscriptions` chung với Stripe/MoMo/SePay. ⇒ **Backend code cần viết thêm ≈ 0** — chỉ **config + 1 migration nhỏ**.
2. **Dùng `expo-iap` (dòng react-native-iap), KHÔNG dùng RevenueCat.** App chỉ lấy JWS StoreKit 2 đã ký rồi POST lên `/api/payments/apple/verify` sẵn có; backend vẫn là **nguồn sự thật entitlement duy nhất**. RevenueCat sẽ tạo nguồn sự thật thứ 2 + phí ~1% MTR không cần thiết.
3. **Quảng cáo cá nhân hóa (ATT) là LỰA CHỌN, KHÔNG phải gate của Apple.** Có thể ship AdMob **non-personalized với `NSPrivacyTracking:false`, không ATT** và vẫn qua review. → **Khuyến nghị v1.0: ads non-personalized, bỏ ATT** (đơn giản, ít bề mặt bị reject); thêm ATT/personalized ở bản sau nếu doanh thu xứng đáng. Xem [§3](#3-quyết-định-2--quảng-cáo-cá-nhân-hóa-att-hay-không).

**Phạm vi v1.0 (nhất quán với `STUDENT_PLANS_REVIEW.md`):** bán **CHỈ gói PRO** (monthly + yearly) trên iOS, **hoãn ULTRA** — mobile hiện chỉ có story PRO (`isUltra` được tính nhưng không màn nào dùng), và ULTRA lệch thời hạn web (60 ngày) vs Apple monthly (30 ngày) ⇒ để lại giảm bề mặt lệch.

---

## 1. Kiến trúc hiện trạng (đã verify trong code)

**Backend — nguồn sự thật entitlement:**
- `user_subscriptions` = ledger provider-agnostic; Stripe (web), MoMo, SePay, **và Apple** đều ghi vào đây (cột `source` phân biệt).
- `GET /api/auth/me/plan` → trả `tier` (`AuthMePlanController` + `QuotaService.publicTier()` tại `QuotaService.java:646`: PRO→`PRO`, ULTRA/INTERNAL→`ULTRA`, còn lại (FREE/DEFAULT/unknown)→`DEFAULT`).
- Apple StoreKit layer (commit `635edbc`, `V189`): `AppleIapController` @ `/api/payments/apple` — `POST /verify {jws}` → `{planCode,endsAt}`; `POST /sync {jws:[]}` (restore); `POST /notifications` (ASSN V2, `permitAll` + JWS-verified, dedup qua `apple_processed_notifications`); `GET /account-token`; `GET /products`. `AppleJwsVerifier` enforce `bundle-id` (`application.yml:529`), **disabled đến khi `root-cert-dir` set** (app khởi động bình thường khi chưa set).

**Mobile — chỉ đọc entitlement, không giữ receipt:**
- `stores/usePlanStore.ts`: `fetchPlan()` → `GET /auth/me/plan` → `isPro = tier==='PRO'||'ULTRA'`. Gọi ở cold-start (`app/_layout.tsx:163`), login, register.
- `app/(student)/upgrade.tsx` + `lib/paywall.ts`: paywall **tắt trên iOS** — `PAYWALL_ENABLED = Platform.OS !== 'ios'`, kèm comment "Flip back on … once `react-native-iap` is wired and StoreKit products are live."
- Gate hiện tại: `enabled:isPro` ở `exam.tsx` + `weekly-speaking.tsx`; check `!isPro` mệnh lệnh ở `speaking.tsx`, `index.tsx`, `profile.tsx`.
- HTTP: axios singleton `lib/api.ts` (baseURL đã gồm `/api`, token qua `expo-secure-store`).
- **Chưa có** thư viện IAP/ads/ATT nào cài đặt.

> Lưu ý type: `usePlanStore.ts:6` khai `tier: 'FREE'|'PRO'|'ULTRA'` default `'FREE'`, nhưng backend trả `'DEFAULT'` cho user free ⇒ `profile.tsx` Pill hiển thị chữ **"DEFAULT"** thô. Cần sửa union thành `'DEFAULT'|'PRO'|'ULTRA'` + map label "Miễn phí" (LOW, sửa cùng Workstream A).

---

## 2. Quyết định 1 — Thư viện IAP: `expo-iap` → backend sẵn có (KHÔNG RevenueCat)

**Vì backend đã sở hữu entitlement + đã có verify JWS trưởng thành**, `expo-iap` (chỉ trả JWS StoreKit 2 đã ký) map 1:1 vào `/verify` sẵn có: **0 rework backend**, license MIT/free, là Expo Module New-Arch sạch trên SDK 54.

RevenueCat chỉ hơn ở paywall dựng sẵn + Customer Center (tiết kiệm ~1–1.5 ngày), nhưng đổi lại **phí ~1% MTR vĩnh viễn + nguồn sự thật entitlement thứ 2** phải reconcile với `user_subscriptions`. Không đáng.

**Trade-off chấp nhận:** tự dựng paywall + nút Restore (~1–1.5 ngày trên `upgrade.tsx` sẵn có); analytics subscription dựa PostHog (đã wired) thay vì dashboard RevenueCat.

---

## 3. Quyết định 2 — Quảng cáo cá nhân hóa (ATT) hay không?

Đây là **quyết định kinh doanh**, KHÔNG phải gate kỹ thuật của Apple. Non-personalized ads chạy được với `NSPrivacyTracking:false`, **không** ATT, vẫn qua review:

| | **A. Non-personalized (khuyến nghị v1.0)** | **B. Personalized + ATT** |
|---|---|---|
| ATT prompt | ❌ không cần | ✅ bắt buộc (`expo-tracking-transparency` + `NSUserTrackingUsageDescription`) |
| `NSPrivacyTracking` | giữ `false` | flip `true` + khai advertising data types |
| App Privacy labels | analytics (PostHog) như hiện tại | + "Used to Track You" (IDFA / Advertising Data) |
| Doanh thu/ad | thấp hơn | cao hơn |
| Bề mặt bị reject | nhỏ (bỏ được cả Workstream C) | lớn hơn (5.1.2(i) ATT-gating, manifest mismatch) |
| Công sức | ít hơn (~1 mảng) | + toàn bộ [Workstream C](#workstream-c--att--privacy-manifest-hướng-b--personalized-only) |

> **Khuyến nghị v1.0: đi Hướng A** — AdMob non-personalized, bỏ ATT, giữ manifest hiện tại. Kỹ thuật: init AdMob với `requestNonPersonalizedAdsOnly: true` cho **mọi** ad request; **không** cài `expo-tracking-transparency`; **không** flip privacy manifest. Lên bản sau thêm ATT nếu cần doanh thu. Phần dưới đánh dấu 🅑 cho các bước **chỉ** cần ở Hướng B (personalized).

---

## 4. Hai blocker CONFIG bắt buộc (không phải code)

Cả hai độc lập với lựa chọn thư viện; phải xử lý **trước mọi sandbox purchase**.

**Blocker 1 — `APPLE_BUNDLE_ID` (CRITICAL).** `application.yml:529` mặc định `com.deutschflow.app`, nhưng bundle iOS là `com.cudinh.mydeutschflow`. `AppleJwsVerifier` enforce `bundleId` ⇒ khi bật verification (set `root-cert-dir`), **mọi** giao dịch bị reject (`INVALID_APP_IDENTIFIER`). Gate này **dormant** đến khi verification bật, nhưng phải fix trước khi test sandbox. **Set env `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow`** trên backend deploy.

**Blocker 2 — Product-ID alignment (CRITICAL).** `V189:44-48` seed `apple_products.product_id` = `com.deutschflow.app.{pro,ultra}.{monthly,yearly}` (prefix Android — placeholder). Product ID là **tự do**, độc lập bundle (Apple QA1329), nhưng `AppleProductCatalog.find()` khớp string **byte-for-byte** ⇒ seed phải khớp **chính xác** ID tạo ở App Store Connect. Chọn scheme chuẩn `com.cudinh.mydeutschflow.pro.{monthly,yearly}`, tạo ở ASC, rồi **1 Flyway migration (V242 — kế tiếp V241, đã verify)** update:

```sql
-- backend/src/main/resources/db/migration/V242__align_apple_product_ids_ios_bundle.sql
UPDATE apple_products SET product_id='com.cudinh.mydeutschflow.pro.monthly'   WHERE product_id='com.deutschflow.app.pro.monthly';
UPDATE apple_products SET product_id='com.cudinh.mydeutschflow.pro.yearly'    WHERE product_id='com.deutschflow.app.pro.yearly';
-- v1.0 bán CHỈ PRO ⇒ hoãn ULTRA khỏi catalog iOS (giữ row nhưng inactive):
UPDATE apple_products SET is_active=FALSE WHERE plan_code='ULTRA';
-- (Khi bật ULTRA sau này: đổi 2 ID ultra.monthly/yearly + is_active=TRUE, và chốt kỳ chuẩn
--  vì web ULTRA=60 ngày lệch Apple monthly=30 ngày — xem STUDENT_PLANS_REVIEW.md #3.)
```

**Config/ops backend còn lại (bật provider — env-gated, đang tắt):**
```bash
APPLE_BUNDLE_ID=com.cudinh.mydeutschflow                 # Blocker 1
APPLE_APP_APPLE_ID=[[numeric App Store id]]              # BẮT BUỘC cho Production verify (application.yml:530)
APPLE_ROOT_CERT_DIR=/opt/deutschflow/apple-root-certs    # thư mục AppleRootCA-*.cer → BẬT verification
APPLE_IAP_ENVIRONMENT=Sandbox                            # Sandbox cho TestFlight, Production cho release
APPLE_IAP_ONLINE_CHECKS=false                            # true ở Production (OCSP revocation)
```
+ Đăng ký **ASSN V2 URL** ở ASC → `https://[[api-host]]/api/payments/apple/notifications`. Nếu không, renewal/refund/expiry **không** chảy về (`/verify` vẫn cấp lúc mua, nhưng gói không tự hết hạn phía server).

---

## Workstream A — IAP / Subscription (DeutschFlow Pro)

**Backend:** ≈0 code + 1 migration ([§4](#4-hai-blocker-config-bắt-buộc-không-phải-code)) + config. **Mobile:** net-new (~3.5–5 ngày).

### Các bước (theo thứ tự build)

1. **Reconcile product IDs + config backend** — [§4](#4-hai-blocker-config-bắt-buộc-không-phải-code) làm trước, gate mọi thứ.
2. **Cài `expo-iap` + config plugin** — `npx expo install expo-iap`, thêm `"expo-iap"` vào `plugins` trong `app.json`. StoreKit **không** cần usage-description. `npx expo prebuild --clean`. (Native đổi → ship qua build mới, **không** OTA.)
3. **`mobile/lib/iap.ts`** — module trung tâm:
   - `fetchBackendCatalog()` → `GET /payments/apple/products` (product ID **do server sở hữu**, không hardcode ở client).
   - `loadStoreProducts(ids)` → expo-iap `getProducts` (giá/tiêu đề/kỳ **bản địa hóa** từ StoreKit qua `displayPrice`, **không** hardcode giá).
   - `getAppAccountToken()` → `GET /payments/apple/account-token` (backend bind giao dịch để chống replay + ASSN correlation).
   - `verifyJws(jws)` → `POST /payments/apple/verify {jws}` **rồi** gọi `usePlanStore.getState().fetchPlan()`.
4. **Purchase flow** (`buy → verify → finish → refresh`):
   ```ts
   export async function buy(productId: string) {
     const appAccountToken = await getAppAccountToken()
     const purchase = await requestPurchase({ request: { sku: productId, appAccountToken } })
     const jws = purchase?.jwsRepresentationIos ?? purchase?.transactionReceipt  // ⚠️ tên field theo version expo-iap
     if (!jws) throw new Error('Không lấy được giao dịch từ App Store')
     await verifyJws(jws)                                        // POST /verify -> fetchPlan()
     await finishTransaction({ purchase, isConsumable: false })  // CHỈ finish SAU khi backend đã cấp
   }
   ```
   Xử lý đủ nhánh: user-cancel (im lặng), pending/Ask-to-Buy, **network fail sau charge trước verify** (đừng finish → StoreKit re-deliver; đăng ký `purchaseUpdatedListener` lúc launch để "drain" giao dịch chưa finish qua cùng đường verify), backend 400/503 (báo lỗi thân thiện, để giao dịch retry). Track PostHog `purchase_started/succeeded/failed`.
5. **Rebuild `upgrade.tsx` thành paywall tuân Guideline 3.1.2 / 3.1.1** (`PAYWALL_ENABLED = true`). MỖI card PHẢI có: **giá** (`displayPrice`, không hardcode) + **kỳ gia hạn** ("mỗi tháng / mỗi năm · tự động gia hạn") + quyền lợi Pro. Các phần **bắt buộc** khác: nút **"Khôi phục giao dịch"**, link **Terms (EULA) + Privacy**, dòng disclosure auto-renew, link **"Quản lý gói"** → `itms-apps://apps.apple.com/account/subscriptions`.
   ```ts
   export async function restore(): Promise<boolean> {
     const purchases = await getAvailablePurchases()
     const jws = purchases.map(p => p.jwsRepresentationIos ?? p.transactionReceipt).filter(Boolean)
     if (!jws.length) return false
     await api.post('/payments/apple/sync', { jws })
     await usePlanStore.getState().fetchPlan()
     return usePlanStore.getState().isPro
   }
   ```
6. **Post-purchase unlock** — sau `fetchPlan()`, `isPro` flip → `exam.tsx` / `weekly-speaking.tsx` (`enabled:isPro`) tự refetch; màn check mệnh lệnh (`speaking/index/profile`) re-render theo store. Tùy chọn `queryClient.invalidateQueries` các feature key cho tức thì. Sửa type `usePlanStore` tier gồm `'DEFAULT'`.
7. **Lifecycle** — restore (`/sync`); upgrade/downgrade (cùng Subscription Group, proration; JWS mới → `/verify` + ASSN renewal-pref); expiry/refund/grace **do ASSN backend xử lý** (`AppleServerNotificationService` cập nhật row `source=apple`, không đụng Stripe). Client tùy chọn `fetchPlan()` khi app trở lại foreground (`AppState`).

### App Store Connect (IAP)
- **Subscription Group "DeutschFlow Pro"** → product auto-renewable dưới bundle iOS, ID **khớp catalog** sau V242. v1.0: **PRO monthly + yearly** (ULTRA hoãn). Kỳ ≥ 7 ngày. Giá theo quốc gia. Display name/description bản địa (vi + en). **Ảnh review paywall**. Link EULA + Privacy.
- **Sandbox testers** (Users and Access → Sandbox). **Paid Applications Agreement + W-8BEN + banking phải Active** — nếu không, product kẹt "Missing Metadata" và không mua được.
- Đăng ký **ASSN V2 URL** (cả Production + Sandbox).

### Testing (IAP)
- **Sandbox purchase** (máy thật, build `development`): tester đăng nhập ở Settings → App Store → Sandbox; mua → `/verify` trả `{planCode,endsAt}` → `/auth/me/plan` trả PRO → `isPro` flip → gated features mở. (StoreKit cũng test được trên **simulator** qua StoreKit Configuration file, nhưng device build cho path đầy đủ.)
- **Guard test:** trước khi set `APPLE_BUNDLE_ID` đúng + bật verification, sandbox `/verify` phải FAIL (chứng minh guard sống) → set đúng → success.
- Restore (xóa + cài lại / máy thứ 2); interrupted purchase (kill sau charge trước verify → listener drain); ASSN accelerated renewal + EXPIRED; upgrade/downgrade không double-charge.
- **Audit compliance paywall trước submit** (giá / kỳ / disclosure / cancel / Terms+Privacy / Restore).
- Jest unit `lib/iap.ts` (mock expo-iap + api): buy gọi verify **trước** finish; restore post `/sync`; cancel im lặng.

### Rủi ro (IAP)
- 🔴 `APPLE_BUNDLE_ID` default sai → 100% reject giao dịch (dormant đến khi bật verify).
- 🔴 product-ID mismatch → `/verify` "unknown product" / paywall rỗng.
- 🔴 ASSN chưa đăng ký → gói expired vẫn hiện PRO phía server.
- 🔴 paywall thiếu price / Restore / links → gần chắc chắn reject 3.1.2 / 3.1.1.
- ⚠️ tên field JWS StoreKit 2 khác theo version expo-iap → pin version + verify types.
- ⚠️ New Architecture: verify purchase trên **device dev build** (repo từng dính Fabric bug với react-native-svg).
- ⚠️ `APPLE_IAP_ENVIRONMENT` phải khớp channel build (Sandbox cho TestFlight, Production cho release).

---

## Workstream B — Ads (AdMob, CHỈ tài khoản free)

**Backend: 0.** Gate free/PRO đọc `usePlanStore.isPro` (đã có). Mobile net-new (~1.5–2.5 ngày).

### Các bước
1. **Cài** `npx expo install react-native-google-mobile-ads` (16.x New-Arch compatible; nếu prebuild báo "Unexpected token 'typeof' / not a valid config plugin" thì chạy `npx expo install --fix` + restart editor — đây là lỗi spurious khắp 16.x, **không** phải do version, KHÔNG cần pin 16.4.0). *(🅑 Hướng B: thêm `npx expo install expo-tracking-transparency`.)* `npx expo prebuild --clean` phải xanh.
2. **`app.json` plugin + AdMob App ID:**
   ```jsonc
   ["react-native-google-mobile-ads", {
     "iosAppId": "[[ca-app-pub-XXXX~YYYY]]",      // ~-style APP ID (KHÁC /-style ad unit)
     "androidAppId": "[[ca-app-pub-XXXX~ZZZZ]]",
     "skAdNetworkItems": ["cstr6suwn9.skadnetwork", "[[…Google's SKAdNetwork list…]]"]
   }]
   ```
   Plugin ghi `GADApplicationIdentifier` + `SKAdNetworkItems` vào `Info.plist` (bạn **tự** cung cấp danh sách SKAdNetwork — plugin không auto-populate; lấy từ docs Google, re-verify lúc build). Dev dùng demo App ID `ca-app-pub-3940256099942544~1458002511`. *(Android sau này: thêm `com.google.android.gms.permission.AD_ID` vào `android.permissions`.)*
   > GMA SDK ≥ 11.2.0 tự kèm `PrivacyInfo.xcprivacy` của riêng nó; Xcode **tự gộp** manifest của SDK ⇒ **không cần** tự liệt kê domains của Google ở privacy manifest app-level.
3. **`mobile/lib/ads.ts`** (theo pattern guarded-bootstrap của `lib/observability.ts`): ad unit ID = `TestIds` khi `__DEV__`, real ID (trong `lib/constants.ts`, **baked vào binary** — không phải eas env) khi release; `initAds()` idempotent gọi `mobileAds().setRequestConfiguration({ maxAdContentRating: 'T', tagForUnderAgeOfConsent: true })` rồi `mobileAds().initialize()`; try/catch no-op (ads fail thì app vẫn chạy).
   - **Hướng A:** luôn `requestNonPersonalizedAdsOnly: true`.
   - 🅑 **Hướng B:** resolve ATT trước, `nonPersonalized = status !== 'granted'` (xem Workstream C).
4. **Bootstrap `initAds()` SAU khi UI active** (không ở top-level cold-launch): trong `app/_layout.tsx`, `useEffect([appReady, isPro])` → `if (appReady && !isPro) initAds()` (chỉ free users; 🅑 để ATT prompt hiện trên UI đã render).
5. **`components/ads/FreeBanner.tsx`** — `if (isPro) return null` (Pro **không** mount view nào), free → `BannerAd` ANCHORED_ADAPTIVE, truyền `requestNonPersonalizedAdsOnly`.
6. **Đặt banner CHỈ ở màn free không nhạy cảm:** Home (`index.tsx`), `learn` / `vocabulary` / `grammar` / `srs` (cuối scroll, trong SafeArea, 1 banner/màn). **KHÔNG** đặt ở: `speaking.tsx` (đang ghi âm), `exam-attempt.tsx` (đang thi), `(auth)`, `upgrade.tsx`, `class-chat` / `messages`. (Lưu ý `exam.tsx` hiện là Lock wall cho free → đừng đặt banner đè lên upsell.)
7. **(Tùy chọn) Interstitial** ở ranh giới phiên (sau khi xong 1 node/practice — **không** giữa task, **không** mỗi navigation): gate `isPro`, cap tần suất (≥ 3–4 phút), preload cái kế khi close, NPA theo consent.
8. **Rebuild + release** (native → không OTA): device build QA → production build → `eas submit`.

### App Store Connect (Ads)
- **Hướng A (non-personalized):** khai App Privacy như hiện tại (PostHog analytics). Có thể vẫn phải khai "Device ID / Advertising Data" ở mức Nutrition-Label (frequency capping dùng identifier) nhưng **KHÔNG** đánh "Used to Track You". Trả lời IDFA questionnaire theo thực tế (non-personalized).
- 🅑 **Hướng B:** khai "Data Used to Track You" = Device ID (IDFA) + Advertising Data, purpose Third-Party Advertising; IDFA questionnaire = Yes + "asks ATT before tracking".
- **Cả hai:** AdMob console tạo app dưới bundle iOS thật → lấy real App ID + tạo banner/interstitial unit; **KHÔNG** Kids Category (AdMob cấm ở Kids — Guideline 1.3); Age Rating hợp lý (teen); ads chỉ trong main app binary (Guideline 2.5.18).

### Testing (Ads)
- **Máy thật** cho full path (AdMob **test ads** hiện trên simulator nhưng không có real fill/ATT; profile `preview` là `ios.simulator:true` → build `development` để test device). **Dev builds chỉ được hiện TEST ads** (live ads trên test traffic = AdMob strike).
- Pro gating: PRO/ULTRA → `FreeBanner` null, không interstitial; free → banner đúng màn. Placement audit (không đè control, không layout-shift).
- Prebuild sanity (không còn lỗi "valid config plugin"). Interstitial: cap giữ, không back-to-back, không giữa task.

### Rủi ro (Ads)
- ⚠️ Nếu `requestNonPersonalizedAdsOnly` không truyền vào **mọi** request → 🅑 user từ chối ATT vẫn nhận personalized (vi phạm).
- 🔴 Kids Category + AdMob → reject 1.3.
- ⚠️ Pre-fetch window: `isPro` mặc định false đến khi `fetchPlan()` xong → Pro user **thoáng** thấy ads (fail-safe, nhưng cân nhắc chặn render banner đến khi plan resolved).
- ⚠️ New-Arch Fabric banner: verify render trên device.
- ⚠️ Over-ads hại retention/convert.

---

## Workstream C — ATT + Privacy Manifest (🅑 Hướng B / personalized ONLY)

> ⏭️ **Bỏ toàn bộ mục này nếu chọn Hướng A (khuyến nghị v1.0).** ATT chỉ cần khi bán personalized ads.

1. **Cài `expo-tracking-transparency`** + plugin với `userTrackingPermission` (VI, honest/no-coercion): _"DeutschFlow dùng định danh này để hiển thị quảng cáo phù hợp hơn với bạn. Bạn vẫn dùng đầy đủ ứng dụng nếu từ chối."_ → ghi `NSUserTrackingUsageDescription`.
2. **`mobile/lib/att.ts`** — `ensureTrackingPermission()`: iOS-only; `getTrackingPermissionsAsync()` trước, chỉ `requestTrackingPermissionsAsync()` khi `status === 'undetermined' && canAskAgain`; mirror status sang PostHog super-property; `isTrackingAuthorized()` sync đọc cho ad options.
3. **Trigger prompt đúng lúc** — **không** ở `_layout` cold-launch (iOS nuốt prompt nếu app chưa active → cháy vĩnh viễn cơ hội prompt 1 lần). Gọi ngay trước ad request đầu tiên ở màn ad-supported đầu tiên (init AdMob → (tùy chọn pre-prompt) → `ensureTrackingPermission()` → load ad). **Không bao giờ** gate chức năng theo kết quả ATT (5.1.2(i)).
4. **Nối ATT → AdMob:** mọi request `requestNonPersonalizedAdsOnly: !isTrackingAuthorized()`.
5. **Flip `app.json ios.privacyManifests`** (chỉ khi personalized): `NSPrivacyTracking: true`; `NSPrivacyTrackingDomains` = domains **app tự** kết nối để tracking (vd endpoint riêng) — **KHÔNG cần** thêm domains của AdMob (SDK ≥ 11.2.0 tự kèm manifest, Xcode auto-gộp); thêm `NSPrivacyCollectedDataTypeAdvertisingData` + `…DeviceID` với `Tracking: true`, purpose ThirdPartyAdvertising; **giữ nguyên** entry PostHog (`Tracking: false`, Analytics).
6. **Prebuild + device build** (OTA không ship được manifest/native).
7. **App Privacy labels ở ASC** khớp manifest (Device ID / Advertising = Used to Track You).

**Testing:** reset ATT (Settings → Privacy → Tracking, hoặc reinstall); prompt hiện SAU UI, không re-prompt sau khi đã chọn; granted → personalized / denied → NPA nhưng app **vẫn dùng đủ**; validate manifest + `Info.plist` trong binary; test cả global toggle OFF.

**Rủi ro:** ⚠️ prompt cháy do timing xấu; 🔴 gate chức năng theo ATT → reject 5.1.2(i); 🔴 manifest / ASC mismatch → reject; ⚠️ drift danh sách domain.

---

## 5. Cross-cutting — build ordering & phases (1 native build duy nhất)

**Ràng buộc then chốt:** `runtimeVersion.policy = "fingerprint"` (`app.json`) → cả 3 mảng đều native → **không mảng nào OTA được**. Gộp **tất cả native deps vào 1 lần** để chỉ có **một** lần đổi fingerprint, rồi mới layer JS.

- **PHASE 0 — Prereq (song song, ngày 1):**
  - Track A (Apple contracts, gate MỌI IAP test): Paid Applications Agreement + W-8BEN + banking → Active.
  - Track B (backend): 2 blocker [§4](#4-hai-blocker-config-bắt-buộc-không-phải-code) (env `APPLE_BUNDLE_ID` + migration V242 product-ID) + host **Privacy Policy URL + Support URL** (2 launch blocker OPEN).
- **PHASE 1 — Native, một commit:** `npx expo install expo-iap` (🅑 `expo-tracking-transparency`) + `npx expo install react-native-google-mobile-ads`; thêm plugins + AdMob App ID (+ 🅑 manifest/ATT) vào `app.json`; `npx expo prebuild --clean`.
- **PHASE 1b — Device dev-client** (`eas build --profile development -p ios`, KHÔNG `preview` vì simulator-only): verify native wiring — expo-iap query `/products`, AdMob `TestIds` render (Fabric/New-Arch), (🅑 ATT dialog). `expo start`/Metro không nạp native mới.
- **PHASE 2 — 3 mảng JS song song** trên dev-client: (A) paywall IAP; (B) ads (đọc entitlement + NPA); (🅑 C) ATT helper. Phụ thuộc: ads (B) cần ATT (C) cho quyết định NPA → build helper C trước khi nối ad request; paywall (A) độc lập.
- **PHASE 3 — Bật backend provider + ASSN** ([§4](#4-hai-blocker-config-bắt-buộc-không-phải-code)) trước submit; verify `/products` + sandbox `/verify` → `/auth/me/plan`.
- **PHASE 4 — MỘT production build → submit:** `eas build -p ios --profile production` (autoIncrement bump buildNumber; marketing `1.0.0`) → `eas submit -p ios --profile production --latest`. Sau build này OTA resume **chỉ** cho build cùng fingerprint mới.
- **PHASE 5 — ASC metadata + App Privacy labels + review notes → Submit for Review** (Phased Release).

### Test matrix
| Build | Test được | Không test được |
|---|---|---|
| **dev-client** (device, `development`) | native wiring, StoreKit sandbox\*, AdMob `TestIds`, ATT dialog | (\*sandbox cần Paid Apps Active + 2 blocker fix) |
| **preview** (`ios.simulator:true`) | regression non-monetization | ❌ StoreKit real / AdMob fill / ATT |
| **production → TestFlight/Sandbox** | full purchase → verify → unlock, restore, ASSN renewal/refund, ATT states | — |

### App Review notes (điền lúc submit)
Demo account **[[demo account]]** + các bước: đăng nhập → Học; Luyện nói (cần micro); **Subscription**: màn Nâng cấp → mua bằng **Sandbox tester** → Restore; **Ads**: hiện ở [màn] cho tài khoản free (🅑 ATT prompt lần đầu vào màn ad); **Xóa tài khoản**: Hồ sơ → Xóa tài khoản (đã wired: `profile.tsx` → `DELETE /api/profile/me`, thỏa 5.1.1(v)).

### Rejection pitfalls khi kết hợp sub + ads + ATT
1. Paywall thiếu price / period / Terms / Privacy / Restore → **3.1.2 / 3.1.1**.
2. 🅑 personalized khi ATT denied, hoặc gate content theo ATT → **5.1.2(i)**.
3. Age-rating vs ad-content mismatch / Kids + AdMob → **1.3**.
4. Ads phải chỉ trong main app binary → **2.5.18**.

> **Nhất quán billing web ↔ Apple (từ `STUDENT_PLANS_REVIEW.md`, P0):** Apple subscription **bắt buộc** auto-renew theo loại sản phẩm; nhưng Stripe (web) hiện chạy `Mode.PAYMENT` = **mua 1 lần** (`StripePaymentService.java:90`), gói web hết hạn âm thầm. Trước/song song khi bật IAP, chốt "subscription thật" (chuyển Stripe sang `Mode.SUBSCRIPTION`) hoặc đổi nhãn web thành "gói N ngày" để câu chuyện gói giữa 2 nền tảng nhất quán. Đây là **quyết định billing v1.0**, không phải blocker build iOS.

---

## 6. Ước tính công sức & checklist

| Mảng | Backend | Mobile |
|---|---|---|
| IAP | ~0.5 ngày (config + 1 migration + QA) | ~3.5–5 ngày (lib/iap + paywall + flows) |
| Ads (Hướng A) | 0 | ~1.5–2.5 ngày |
| 🅑 ATT (Hướng B) | 0 | ~1–1.5 ngày |
| Cross-cut (build / QA / ASC / submit) | — | ~1–2 ngày |

**Checklist rút gọn (v1.0 = PRO-only + ads non-personalized khuyến nghị):**
1. [ ] Paid Apps Agreement + W-8BEN + banking Active · host Privacy Policy URL + Support URL
2. [ ] Backend: env `APPLE_BUNDLE_ID` + migration V242 product-ID (PRO; ULTRA inactive) + `root-cert-dir` / `app-apple-id` / env · đăng ký ASSN V2 URL
3. [ ] ASC: Subscription Group "DeutschFlow Pro" + PRO monthly/yearly (ID khớp catalog) + Sandbox testers · AdMob console app + units
4. [ ] Mobile PHASE 1: cài expo-iap + AdMob (+ 🅑 ATT), plugins/app.json, `prebuild --clean` xanh
5. [ ] PHASE 2: `lib/iap` + paywall 3.1.2 (giá/kỳ/Restore/Terms+Privacy) + `FreeBanner` gate `isPro` (+ 🅑 `lib/att`)
6. [ ] PHASE 1b/3: device dev build QA (sandbox purchase → unlock, restore, ads TestIds) + bật backend provider
7. [ ] PHASE 4: 1 production build → `eas submit`
8. [ ] PHASE 5: ASC metadata + App Privacy labels (**KHÔNG** khai Sentry — inactive) + review notes → Submit (Phased Release)

---

## 7. Placeholder cần cung cấp
- **AdMob App ID (iOS `~`) + ad unit IDs (`/`)** — tạo ở AdMob console dưới bundle `com.cudinh.mydeutschflow`. → `[[ca-app-pub-…~…]]`, `[[…/…]]`
- **`APPLE_APP_APPLE_ID`** (numeric App Store id) + thư mục **Apple Root CA `.cer`** cho `root-cert-dir`.
- **Product ID scheme chuẩn** (đề xuất `com.cudinh.mydeutschflow.pro.{monthly,yearly}`) + **giá từng gói/quốc gia**.
- **Chốt Hướng A vs B** cho ads ([§3](#3-quyết-định-2--quảng-cáo-cá-nhân-hóa-att-hay-không)).
- **api-host** cho ASSN V2 URL + **host URLs** (Privacy Policy, Support).
- Các `[[…]]` ở `PRIVACY_POLICY.md` / `TERMS_OF_USE.md` / `STORE_COPY.md` (tên pháp lý, support email/URL, demo account).

---

> **Ghi chú kiểm chứng (2026-07-02):** Đã verify tại repo — `application.yml:529` `bundle-id` default `com.deutschflow.app`; `AppleIapController` `/api/payments/apple` `/verify`·`/sync`·`/notifications`·`/account-token`·`/products` (`backend/.../payment/controller/AppleIapController.java`); `V189:44-48` seed 4 placeholder product IDs; `V189` bảng `apple_products` KHÔNG có cột `daily_token_grant`/`wallet_cap_days` (chúng nằm ở `subscription_plans`, giải thích latent "fresh replay ULTRA=0 token"); `QuotaService.publicTier()` `QuotaService.java:646`; gate `enabled:isPro` ở `exam.tsx`+`weekly-speaking.tsx`, `!isPro` mệnh lệnh ở `index/speaking/profile.tsx`; `usePlanStore.ts:6` type `'FREE'|'PRO'|'ULTRA'` (nên đổi `'DEFAULT'`); migration mới nhất trong repo = **V241** ⇒ **V242** là số kế tiếp đúng.
