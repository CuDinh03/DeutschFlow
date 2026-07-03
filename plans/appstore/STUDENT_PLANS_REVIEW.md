# Rà soát các gói (plan/tier) của role STUDENT

_DeutschFlow · Audit gói học viên trước khi bật In-App Purchase iOS._

---

## 0. Kết luận nhanh

- **Có 5 tier thật** — `DEFAULT`, `FREE`, `PRO`, `ULTRA`, `INTERNAL` — cộng thêm **1 tier "ma" `PREMIUM`** chỉ tồn tại trong code, chưa bao giờ được seed.
- **Hạn mức thật sự duy nhất được đo đếm là token AI/ngày** theo tier. Gần như toàn bộ "tính năng Pro" **không** được gate bằng cờ tính năng; chúng quy về một câu hỏi: user còn token hay không.
- **Câu chuyện gói không nhất quán giữa các bề mặt:** web bán **3 tier** (Free / Pro / Ultra), mobile chỉ hiển thị **2 tier** (Free / Pro — `isUltra` được tính nhưng không màn nào dùng), Apple catalog có **4 gói** (PRO/ULTRA × tháng/năm) nhưng **đang ngủ** (chưa có client IAP).
- **1 HIGH:** Stripe (web) chạy chế độ **mua 1 lần** (`Mode.PAYMENT`), **KHÔNG auto-renew** → cùng một tier PRO/ULTRA nhưng Apple gia hạn tự động, còn web hết hạn âm thầm.
- **3 MEDIUM:** `features_json` là config chết; **ULTRA lệch thời hạn** (web 2 tháng vs Apple monthly 1 tháng, cùng giá 699k); grant `INTERNAL` **không có allow-list**.
- **Bug tiềm ẩn đáng lưu:** trên **fresh Flyway replay, ULTRA = 0 token** (V38 không seed ULTRA; V189 INSERT thiếu cột grant/cap). Prod hiện tại không dính vì đã UPDATE tay qua các migration cũ, nhưng env/CI mới sẽ hỏng.
- **Không mục nào là lỗ hổng bảo mật khai thác được hay gây mất dữ liệu.** Đây là các vấn đề đúng-đắn sản phẩm / nhất quán billing / quyền admin.
- **Vài mục phải sửa TRƯỚC khi bật IAP iOS** — xem [§5](#5-phải-sửa-trước-khi-bật-iap-ios).

---

## 1. Ma trận tier (student)

| Tier | Cách xác định | Token/ngày · rollover ví | Vai trò | Nguồn |
|---|---|---|---|---|
| **DEFAULT** | Không có sub ACTIVE (auto-insert), hoặc plan đã hết hạn | **0 token** (không dùng được AI) | Free / lapsed thật. **Label public = `DEFAULT`** (KHÔNG phải `FREE`) | `QuotaService.java:646-655`, `V73:6-28` |
| **FREE** | Row `plan_code='FREE'` (legacy) | 9.000/ngày · no rollover · hết sau 7 ngày | Gói trial cũ; **trial mới hiện là PRO** | `V73:30-53` |
| **PRO** | Sub ACTIVE `PRO` (trial 7 ngày / thanh toán / admin) | 400.000/ngày · ví cap 30 ngày | Gói trả phí chính + trial student | `V73:55-78`, `StudentTrialSubscriptionProvisioner.java:11,34` |
| **ULTRA** | Sub ACTIVE `ULTRA` (thanh toán / admin) | 2.000.000/ngày · ví cap 90 ngày | Gói trả phí cao nhất | `V73:80-103` |
| **INTERNAL** | Chỉ admin gán | bypass, `999_999_999`, không trừ ví | Staff / QA. **Hiện ra client thành `ULTRA`** | `QuotaService.java:167-176,654`, `V73:105-128` |
| **PREMIUM 👻** | Không seed ở bất kỳ đâu | — | Dead reference (mentor gate + admin badge map) | `FixedMentorResolver.java:43`, `AdminManagementService.java:1073` |

> `publicTier()` (`QuotaService.java:646-655`): `PRO→PRO`; `ULTRA`/`INTERNAL→ULTRA`; còn lại (`FREE`/`DEFAULT`/unknown) `→DEFAULT`. `isPro = tier ∈ {PRO, ULTRA}`.

---

## 2. Quảng cáo (paywall) vs Thực thi (backend)

### 2.1 `features_json` là config chết

`subscription_plans.features_json` (định nghĩa các cờ `streaming`, `mockExam`, `voiceClone`, `maxPersonas`, `crashCourse`, `advancedAnalytics`…) được set đầy đủ ở `V73` nhưng **KHÔNG có code nào đọc nó để gate quyền**. Chỗ duy nhất chạm tới cột này là admin plan-list, chỉ để hiển thị (`AdminManagementService.java:210-217`). ⇒ "ma trận tính năng" trong DB **không phản ánh** quyền thật của user.

### 2.2 Gate thật (rải rác, hardcode theo plan-code / token)

| Tính năng | Gate thật | File |
|---|---|---|
| Mock exam **packs** (curated, `requiresPaid`) | mở cho mọi tier trả phí (`publicTier != DEFAULT`) | `MockExamPackService.java:64-72` |
| Mock exam **attempts** (đề thường) | KHÔNG gate tier — chỉ token quota | `MockExamController.java:181` |
| AI Speaking / interview / conversation | KHÔNG gate tier — chỉ token quota | `AISpeakingController.java:54,74,90` |
| Video lessons | KHÔNG gate tier — chỉ token quota | `VideoLessonController.java:89` |
| SRS review | free **5 task/ngày**, trả phí unlimited | `ReviewTasksController.java:25,39-41` |
| Fixed mentor personas | BEGINNER cho free; INTERMEDIATE/ADVANCED cho trả phí (set chứa cả ghost PREMIUM) | `FixedMentorResolver.java:30,43` |
| AI image gen | **TEACHER/ADMIN** — không phải tính năng student | — |

### 2.3 Mobile paywall quảng cáo 5 điều

`upgrade.tsx:11-15` liệt kê: _"AI Speaking không giới hạn"_, _"Mock Exam Goethe chuẩn"_, _"Weekly Speaking Challenge"_, _"Toàn bộ lộ trình A1 đến B2"_, _"Phân tích lỗi chi tiết"_.

Thực tế "không giới hạn" = **ví token lớn hơn** (DEFAULT 0 token ⇒ gần như không dùng được AI), và phần lớn các mục này **không có gate riêng** — chúng chỉ quy về token quota. Marketing "unlimited / unlock" hơi lệch với cơ chế thật (token-metered): không sai chức năng, nhưng dễ gây hiểu nhầm rằng có một "công tắc tính năng" trong khi thực chất chỉ là hạn mức token.

> **Coins:** không tồn tại ở `main` (chỉ trên nhánh `feat/ui-2.0-galerie`) → không ảnh hưởng gói student hiện tại.

---

## 3. Catalog & giá theo provider

| Provider | Gói | Thời hạn | Giá | Auto-renew? | Bán được? |
|---|---|---|---|---|---|
| **Stripe (web)** | PRO / ULTRA | PRO 1 tháng · **ULTRA 2 tháng** | 299k / 699k VND (đọc `price_vnd`) | ❌ **mua 1 lần** | ✅ |
| **MoMo (web)** | PRO / ULTRA | như trên (đọc DB, bỏ qua client) | 299k / 699k | ❌ | ✅ |
| **Apple (mobile)** | PRO / ULTRA × **tháng + năm** | monthly = 1 · yearly = 12 | ở App Store Connect | ✅ (auto-renewable) | ❌ **chưa có IAP client** |
| **SePay** | — | — | — | — | Chỉ B2B org-invoice |

### Các bất nhất chính

- **Web 3 tier, mobile 2 tier.** `frontend/src/app/student/pricing/page.tsx:14-15` bán Free/Pro/Ultra; mobile tính `isUltra` (`usePlanStore.ts:29`) nhưng **0 màn nào dùng** → student iOS/Android không thấy ULTRA.
- **4 mô hình thời hạn khác nhau cho cùng bộ tier:** web PRO = 1 tháng, web ULTRA = 2 tháng, Apple monthly = 1 tháng, Apple yearly = 12 tháng. Apple **không có** gói năm ở web/MoMo, và Apple `ultra.monthly` (30 ngày) mâu thuẫn web ULTRA (60 ngày) **cùng giá 699k**.
- **Giá hardcode ở frontend** (`pricing/page.tsx:14-15`) có thể lệch `price_vnd` trong DB (chưa có API plan-list public để fetch giá thật).

---

## 4. Danh sách vấn đề đã xác nhận (14) — xếp theo mức độ

### 🔴 HIGH

**1. Stripe = mua 1 lần, không auto-renew.**
`StripePaymentService.java:90` dùng `SessionCreateParams.Mode.PAYMENT`; webhook chỉ nhận `checkout.session.completed`; fulfillment gọi `SubscriptionActivationService.java:27-31` set `endsAt = now + durationMonths × 30 ngày`. Web PRO/ULTRA **hết hạn âm thầm** sau kỳ — không gia hạn, không nhắc — trong khi Apple auto-renew qua `extendOrActivateApple` (`SubscriptionActivationService.java:84`). Cùng một tier nhưng 2 hành vi billing khác nhau, và nhãn web gọi là "gói" nghe như subscription.
**Fix:** hoặc chuyển Stripe sang `Mode.SUBSCRIPTION` + xử lý `invoice.paid` / `customer.subscription.*` (khớp Apple, đúng nhãn "subscription"); hoặc đổi nhãn web thành "gói N ngày" cho trung thực.

### 🟠 MEDIUM

**2. `features_json` là config chết** (xem §2.1). Ma trận DB "nói dối" so với gate thật.
**Fix:** hoặc biến nó thành nguồn sự thật (thêm `PlanFeatureService`, thay các check hardcode), hoặc xóa/ghi rõ "chỉ dùng cho marketing display". (Kèm sửa typo header "V72" ở `V73:2` — file là V73.)

**3. ULTRA lệch thời hạn 1 vs 2 tháng.**
`V129:15` đặt ULTRA `duration_months = 1`; `V177:2` sửa thành 2; nhưng Apple `ultra.monthly` (`V189:47`) = 1. Web trả 699k được **60 ngày**, Apple monthly cùng "ULTRA" chỉ **~30 ngày**. Latent vì IAP chưa bật.
**Fix:** chốt kỳ chuẩn (khuyến nghị giữ 2 tháng của web → tạo Apple product **bimonthly** `…ultra.bimonthly` thay vì `.monthly`), + assertion khi boot để `apple_products.duration_months == subscription_plans.duration_months`.

**4. Grant `INTERNAL` không có allow-list.**
`AdminManagementService.java:224-239` (`updateUserPlan`) chỉ kiểm tra plan-code có tồn tại (`SELECT COUNT(*) … WHERE code = ?`). Bất kỳ ADMIN nào cũng gán được `INTERNAL` (unlimited AI, hiện ra client thành ULTRA) cho bất kỳ user nào. Có audit nhưng không chặn.
**Fix:** định nghĩa `ADMIN_ASSIGNABLE_PLANS = {DEFAULT, FREE, PRO, ULTRA}`, loại `INTERNAL` khỏi path admin (theo mẫu allow-list role đã có ở tầng org).

### 🟡 LOW

**5. Trial drift (tài liệu).** Student mới nhận trial **PRO 7 ngày** (`StudentTrialSubscriptionProvisioner.java:11,34`), nhưng comment/safety-net cũ vẫn nói "FREE trial". Hoạt động đúng (PRO hết hạn qua `ends_at`); chỉ là drift tài liệu + footgun nếu trial PRO có `ends_at = null`.

**6. ULTRA `monthly_token_limit` drift + ⚠️ fresh-replay ULTRA = 0 token.**
`monthly_token_limit` của ULTRA còn 850k (từ `V42:19`) trong khi `daily_token_grant` = 2M (`V73:82`); cột này chỉ hiển thị admin, không dùng tính quota → cosmetic.
**Nặng hơn (adjacent):** trên **fresh Flyway replay**, ULTRA không được seed sớm — `V38:30-33` chỉ INSERT `FREE`/`PRO`/`INTERNAL`; `V42:19` là UPDATE (no-op khi chưa có row); `V73:82` cũng UPDATE (no-op). ULTRA chỉ thực sự được INSERT ở `V189:38-39`, mà INSERT đó **thiếu `daily_token_grant` và `wallet_cap_days`** (default 0) → ULTRA = **0 token**.
**Fix:** thêm migration reconcile `UPDATE subscription_plans SET daily_token_grant = 2000000, wallet_cap_days = 90, monthly_token_limit = 2000000 WHERE code = 'ULTRA'`, và bổ sung 2 cột grant/cap vào INSERT của `V189`.

**7. Mobile type/label `FREE`.** `usePlanStore.ts:6` khai type `'FREE' | 'PRO' | 'ULTRA'` và `:25` default `'FREE'`, nhưng backend trả `'DEFAULT'` cho user free → `profile.tsx:98` Pill hiển thị raw chữ **"DEFAULT"** cho user free (không dịch).
**Fix:** đổi union thành `'DEFAULT' | 'PRO' | 'ULTRA'`, map label "Miễn phí".

**8. Ghost PREMIUM.** `FixedMentorResolver.java:43` và `AdminManagementService.java:1073` xử lý `'PREMIUM'` nhưng không seed ở đâu. Không reachable (mọi write-path validate plan tồn tại).
**Fix:** bỏ `'PREMIUM'` để thống nhất từ vựng tier.

**9. Apple catalog đang ngủ.** 4 row `apple_products` `is_active` (`V189:44-48`) nhưng chưa client nào mua (paywall iOS tắt: `paywall.ts:13` `PAYWALL_ENABLED = Platform.OS !== 'ios'`; chưa có IAP lib). Đúng chủ đích; khớp [MONETIZATION_TECH_PLAN](MONETIZATION_TECH_PLAN.md).

**10. Không có gói năm ở web/MoMo.** `subscription_plans` chỉ 1 row/plan. Apple có `*.yearly` (`V189:46,48`) nhưng không có đối ứng web + chưa ai mua.

**11. Giá hardcode frontend** (§3) có thể lệch `price_vnd`.
**Fix:** thêm endpoint `GET /api/payments/plans` public + fetch (type `SubscriptionPlan` đã có sẵn ở `paymentApi.ts:31-36`).

**12. Stripe FX 25000 hardcode.** `StripePaymentService.java:81`: `priceUsdCents = round((priceVnd / 25_000.0) × 100)` (PRO → ~$11.96, ULTRA → ~$27.96) + sàn Stripe $0.50. Tỷ giá trôi theo thời gian.
**Fix:** `@Value("${payment.stripe.vnd-per-usd:25000}")` + log WARN khi chạm sàn.

**13. Mobile chip "DEFAULT" (mặt catalog).** Cùng gốc với #7: `usePlanStore` mistype tier là `FREE` nên user free nhận label sai; ở màn hồ sơ hiện chip "DEFAULT". (Gộp fix với #7.)

**14. MoMo bỏ qua `durationMonths` client gửi.** Field `durationMonths` có trong DTO (`paymentApi.ts:5`) nhưng backend đọc thời hạn từ DB (DB-authoritative). Vô hại (có cross-check amount) nhưng là field chết gây hiểu nhầm.
**Fix:** bỏ field khỏi DTO/`paymentApi.ts`.

---

## 5. Phải sửa TRƯỚC khi bật IAP iOS

Vì Hướng B sắp wiring StoreKit, các mục sau chuyển từ "latent" thành "tiền thật lệch":

1. **#3 — ULTRA 1 vs 2 tháng.** Chốt kỳ chuẩn + tạo Apple product khớp (bimonthly) trước khi bán ULTRA trên iOS. (Hoặc v1.0 chỉ bán PRO — xem dưới.)
2. **Chốt 2-tier hay 3-tier trên mobile.** Hiện mobile chỉ có story PRO. Nếu bán cả ULTRA trên iOS phải bổ sung UI ULTRA (`isUltra` đang không dùng). **Khuyến nghị v1.0 chỉ PRO** (monthly + yearly), hoãn ULTRA → giảm bề mặt lệch.
3. **#1 — Stripe auto-renew.** Quyết định "subscription thật" hay "gói N ngày" để câu chuyện billing web ↔ Apple nhất quán (Apple auto-renewable là bắt buộc theo loại sản phẩm).
4. **#6 — fresh-replay ULTRA = 0** + **product-ID alignment.** Cùng nhóm "config catalog": product IDs trong `apple_products` (`com.deutschflow.app.*`) phải khớp EXACTLY với ID tạo trên App Store Connect; đồng thời `APPLE_BUNDLE_ID` phải là `com.cudinh.mydeutschflow` (default cũ `com.deutschflow.app` sẽ khiến JWS verify từ chối mọi giao dịch). Chi tiết ở [MONETIZATION_TECH_PLAN](MONETIZATION_TECH_PLAN.md) §4.

---

## 6. Khuyến nghị ưu tiên

| Ưu tiên | Việc | Vì sao |
|---|---|---|
| **P0** (trước IAP) | Chốt kỳ ULTRA (#3) + chốt 2-tier/3-tier mobile + Stripe renew vs one-time (#1) | Tránh lệch tiền/kỳ khi iOS bắt đầu bán hàng |
| **P0** (trước IAP) | Reconcile ULTRA grant/cap (fresh-replay 0 token, #6) + align product-ID ↔ ASC + `APPLE_BUNDLE_ID` | CI/env mới hỏng; verify catalog trước khi verify JWS |
| **P1** | Allow-list `INTERNAL` (loại khỏi admin path, #4) | Rủi ro quyền: bất kỳ admin cấp unlimited AI |
| **P1** | `features_json`: chọn nguồn-sự-thật hoặc bỏ (#2) | Config đang nói dối gate thật |
| **P2** | Nhãn mobile `DEFAULT` → "Miễn phí" (#7/#13); bỏ ghost PREMIUM (#8); API plan-list public (#11); FX config (#12); bỏ field MoMo chết (#14) | Dọn drift + cosmetic |

---

> **Ghi chú kiểm chứng:** mọi file:line ở trên đã grep lại trên `main` ngày 02/07/2026. `AiImageGenerationController` (AI image gen là tính năng TEACHER/ADMIN) không nằm dưới quyền student nên không cite dòng cụ thể. `publicTier()` trong bản hiện tại nằm ở `QuotaService.java:646-655` (case `PRO` dòng 653, `ULTRA/INTERNAL` dòng 654) — nếu tài liệu khác cite dòng lệch vài số là do refactor, logic không đổi. Không mục nào trong 14 vấn đề là lỗ hổng bảo mật khai thác được hoặc gây mất dữ liệu.
