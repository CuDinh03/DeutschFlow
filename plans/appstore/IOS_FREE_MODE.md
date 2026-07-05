# iOS Free Mode — sổ tay bật/tắt thanh toán (monetization gating)

> **Mục đích:** v1.0 ship iOS **hoàn toàn miễn phí** để qua App Store Review (2.1(b) + 3.1.1).
> Tài liệu này ghi lại **chính xác** cái gì đang bị khoá/ẩn và **cách bật lại** khi làm thanh toán ở **v1.1**.
> Đọc cùng: `REJECTION_v1.0_FIX_CHECKLIST.md`, `MONETIZATION_V1.1_SPEC.md`, `MONETIZATION_TECH_PLAN.md`.

---

## 1. Ba cờ điều khiển — `mobile/lib/paywall.ts`

| Cờ | v1.0 (free) | v1.1 (IAP live) | Ý nghĩa |
|---|---|---|---|
| `IAP_ENABLED` | `false` | **`true`** | Công tắc chính StoreKit. Bật = ship native `expo-iap` → **phải EAS build mới + qua review**, không OTA được. |
| `PAYWALL_ENABLED` | `false` trên iOS | `true` | Hiện bề mặt upsell/route `/upgrade`. Công thức: `Platform.OS !== 'ios' || IAP_ENABLED`. |
| `PRO_UNLOCKED_FREE` *(thêm ở v1.0)* | `true` trên iOS | **`false`** | Mở khoá mọi tính năng + ẩn nhãn thương mại trên iOS. Công thức: `Platform.OS === 'ios' && !IAP_ENABLED`. |

**Nguyên tắc vàng:** ở v1.1 chỉ cần đổi **`IAP_ENABLED = true`**. Khi đó:
- `PAYWALL_ENABLED` → `true` (upsell/route hiện lại).
- `PRO_UNLOCKED_FREE` → `false` (PRO-gate quay lại; nhãn PRO hiện lại).
- `upgrade.tsx` rẽ vào nhánh `IapPaywall` (mua/khôi phục StoreKit thật).

→ **Không phải sửa lại từng màn.** Mọi call-site đã trỏ về 3 cờ này. Đó là lý do dùng cờ dẫn xuất thay vì sửa cứng từng file.

---

## 2. Bản đồ đầy đủ những gì "free mode" tác động

### 2.1. Khoá tính năng (đọc `hasProAccess = isPro || PRO_UNLOCKED_FREE`)
| File | Vị trí | v1.0 (free) | v1.1 |
|---|---|---|---|
| `app/(student)/speaking.tsx` | `if (!hasProAccess)` ~d.341 | Không khoá trả lời giọng nói | Khoá lại cho non-PRO |
| `app/(student)/speaking.tsx` | `<CompanionSelect isPro={hasProAccess}>` ~d.593 | Mở mọi persona | Khoá persona nâng cao |
| `app/(student)/exam.tsx` | `enabled/isPro` ~d.27,34,41,77,109 | Mock Exam mở | Khoá cho non-PRO |
| `app/(student)/weekly-speaking.tsx` | `isPro` ~d.42,54,58 | Weekly Challenge mở | Khoá cho non-PRO |

### 2.2. Bề mặt thương mại (ẩn khi `PRO_UNLOCKED_FREE`, hiện lại khi có `PAYWALL_ENABLED`)
| File | Vị trí | Nội dung |
|---|---|---|
| `app/(student)/index.tsx` | ~d.273 | Card "DeutschFlow PRO / Xem PRO" (đã gate `PAYWALL_ENABLED`) |
| `app/(student)/profile.tsx` | ~d.98 Pill tier · ~d.121 card "Nâng cấp lên PRO" | Nhãn FREE/PRO + upsell |
| `app/(student)/upgrade.tsx` | cả màn | v1.0: redirect về Home nếu `PRO_UNLOCKED_FREE`. v1.1: `IapPaywall` |
| `lib/upsell.ts` | `handleAiError` ~d.24,26 | Message + nút "Nâng cấp" khi hết quota AI |
| `components/guide/tourContent.ts` | ~d.158 | Câu FAQ nhắc gói PRO |
| `app/(auth)/onboarding.tsx` | ~d.431 | Consent web-upsell PRO (skip trên iOS ở v1.0) |

### 2.3. Không đổi giữa 2 phiên bản (giữ nguyên cho v1.1)
- `lib/iapProducts.ts` — catalog 4 product id (`com.deutschflow.app.pro.monthly|yearly`, `…ultra.…`) + logic JWS. **Đã unit-test.**
- `lib/iapApi.ts`, `hooks/useAppleIap.ts` — client StoreKit.
- `stores/usePlanStore.ts` — `isPro/isUltra/tier` đọc từ `/api/auth/me/plan` (canonical, provider-agnostic).
- Backend: `payment/…/AppleIapController`, `AppleIapService`, seed product `V189`, `SepayWebhookService`.

---

## 3. Checklist bật thanh toán ở v1.1 (làm theo thứ tự)

1. [ ] App Store Connect: tạo 4 **auto-renewable subscription** đúng product id ở §2.3, điền giá, ảnh, mô tả → trạng thái "Ready to Submit".
2. [ ] Xác nhận seed backend `apple_products` (V189) khớp **từng ký tự** với product id trên ASC (mismatch = mua xong không kích hoạt được).
3. [ ] `mobile/lib/paywall.ts`: đổi `IAP_ENABLED = false` → **`true`**.
4. [ ] Kiểm tra 3 nhánh `upgrade.tsx`: `IAP_ENABLED` → `IapPaywall` (mua + "Khôi phục giao dịch").
5. [ ] Thêm bắt buộc theo App Store: link **Terms (EULA)** + **Privacy Policy** trong màn paywall; nút **Restore Purchases** (đã có); mô tả giá/kỳ hạn/tự gia hạn (đã có ở `IapPaywall`).
6. [ ] Thử **sandbox tester** trên thiết bị thật: mua PRO monthly → `/api/payments/apple/verify` nhận JWS → tier lên PRO → tính năng mở; test **Restore**; test hết hạn.
7. [ ] Gỡ/không dùng `PRO_UNLOCKED_FREE` (tự thành `false` nhờ `IAP_ENABLED=true`; có thể xoá cờ + đổi `hasProAccess` về `isPro` khi dọn dẹp).
8. [ ] Onboarding iOS: bật lại consent (nếu vẫn muốn) — nhưng **chỉ** hướng tới IAP, **không** steer ra web (3.1.1).
9. [ ] **Quan trọng — 3.1.1 về "unlock hàng mua ngoài":** ở v1.1, PRO mua trên web/SePay **vẫn** phản chiếu `isPro` trên iOS. Apple coi việc mở khoá nội dung đã mua ngoài IAP là vi phạm. Quyết định trước khi ship v1.1:
   - (a) iOS chỉ bán qua IAP; account mua-web hiển thị PRO nhưng **không** hé mở đường mua web trong app (không link, không nhắc), **và** đủ điều kiện "multiplatform service" — hoặc
   - (b) Tách hẳn: tính năng PRO trên iOS chỉ mở bằng IAP.
   - → Bàn kỹ với chính sách App Store trước, đừng để lặp lại reject.
10. [ ] EAS build mới (native thay đổi) → submit → review.

---

## 4. Lịch sử quyết định
- **2026-07-02:** chốt v1.0 free-only, monetization để v1.1 (memory `deutschflow-monetization-v1-decisions`).
- **2026-07-05:** submit build `1.0(4)` — **vẫn lộ bề mặt PRO** (chưa có `PRO_UNLOCKED_FREE`).
- **2026-07-05/06:** reject 2.1(b) + 5.1.1(v)×2.
- **2026-07-06:** thêm `PRO_UNLOCKED_FREE` + `hasProAccess`, iOS free thật sự; phone optional (FE+BE); delete-account = card đỏ nổi bật. Committed `62c23d8d`.
- **2026-07-06:** ⚠️ **BÀI HỌC — `EMAIL_CAPTURE_UPSELL` có 2 call-site trong `onboarding.tsx`** (`handleSubmit` d.253 + resume-from-draft d.176). Lần đầu chỉ guard 1, sót nhánh resume (guest-signup happy-path beginner iOS) → pre-merge review (workflow adversarial) bắt được, vá cả 2 (`a51a97fe`). **Khi bật lại/đổi cờ ở v1.1 phải rà HẾT call-site, đừng tin 1 chỗ.**
- **2026-07-06:** ✅ **MERGED PR #201 → main `9b34e9b3`** (CI xanh) + **backend DEPLOYED prod** (`9b34e9b3`, `actuator/health`=200 UP, phone-optional live). Còn owner: EAS build `production` → submit → reply 2.1(b)+video → resubmit (build number auto qua `appVersionSource:remote`).
