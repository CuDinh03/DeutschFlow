# DeutschFlow v1.0 — Checklist sửa reject App Store (per-file)

> Submission `ec05409d-…`, build `1.0 (4)`, reject 05/07/2026. Review device: iPad Air 11" (M3).
> 3 nhóm lỗi: **5.1.1(v) phone**, **5.1.1(v) account deletion**, **2.1(b) business model**.
> Chiến lược v1.0: **iOS miễn phí thật sự** — không mua, không nội dung khoá, không nhắc "PRO" trên iOS.
> Khi thêm thanh toán ở v1.1 → xem `IOS_FREE_MODE.md` để bật lại.

Ký hiệu đường dẫn: `mobile/…` = React Native (Expo); `backend/…` = Spring Boot.

---

## 📊 Trạng thái (cập nhật 2026-07-06 — MERGED + BACKEND DEPLOYED)

| Nhóm | Code | Kiểm thử tự động | Trạng thái |
|---|---|---|---|
| **A. Phone optional** (FE+BE) | ✅ XONG | ✅ mobile tsc + jest 151/151; backend RegisterRequest **8/8** + AuthService 15/15 | ✅ **BE LIVE prod** (`9b34e9b3`, health UP) — phone-optional đã chạy |
| **B. Account deletion nổi bật** | ✅ XONG (card đỏ ngang hàng "Đăng xuất") | tsc/jest xanh | ⏳ owner quay **video demo** xoá tài khoản |
| **C. iOS free mode** (ẩn PRO + mở khoá) | ✅ XONG (`PRO_UNLOCKED_FREE` + `hasProAccess`) | tsc/jest xanh; grep text-PRO → unreachable trên iOS | ⏳ QA trên build mới |
| **D. Build & nộp lại** | ✅ merged main | — | ⏳ owner: EAS build (chạy) → submit → reply 2.1(b)+video |

**✅ MERGED:** PR [#201](https://github.com/CuDinh03/DeutschFlow/pull/201) → main merge commit **`9b34e9b3`** (2 commit: `62c23d8d` fix chính + `a51a97fe` fix blocker review). CI xanh (Compile + Unit Tests + SAST). Files: `paywall.ts` (+`PRO_UNLOCKED_FREE`), `usePlanStore.ts` (+`hasProAccess`), `speaking/exam/weekly-speaking/profile/upgrade/register.tsx`, `upsell.ts`, `tourContent.ts`+`guide.tsx`, `onboarding.tsx`; BE `RegisterRequest.java`+`AuthService.java`; tests.

**🔬 PRE-MERGE REVIEW (workflow adversarial, 15 agent) bắt 1 BLOCKER thật đã VÁ trước khi merge:** `onboarding.tsx` có **2 nhánh** `EMAIL_CAPTURE_UPSELL` — mình chỉ guard nhánh `handleSubmit` (d.253), BỎ SÓT nhánh **resume-from-draft** (d.176) = đường guest-signup happy-path của beginner iOS → vẫn lộ màn PRO email-capture (2.1(b)). Đã thêm `&& !PRO_UNLOCKED_FREE` cho cả 2 nhánh. Kèm fix nhỏ: `RegisterRequest` trim phone trong compact constructor (whitespace-only "   " → "" → NULL, không 400).

**✅ BACKEND DEPLOYED prod 2026-07-06** — `./deploy-backend.sh` blue-green OK 266s, promote `9b34e9b3`, banner `DEPLOY THÀNH CÔNG ✓`; verify ngoài EC2: `curl https://api.mydeutschflow.com/actuator/health` = **200 `{"status":"UP"}`**. (⚠️ script exit 1 do trailing `read` EOF — verify bằng banner+curl, KHÔNG bằng exit code.)

**⏳ CÒN (owner):** EAS build iOS `production` (đang chạy — native flag `PRO_UNLOCKED_FREE` không OTA được) → `eas submit` → gắn build vào version 1.0 → Resolution Center reply 2.1(b) + **video xoá tài khoản** (`APPLE_REPLY_2026-07-06.md`) → demo student còn trial → Resubmit.

---

## A. Lỗi 1 — Phone bắt buộc (Guideline 5.1.1(v))

**Gốc:** SĐT là trường bắt buộc khi đăng ký, không cần cho chức năng lõi. Bị ép ở cả FE + BE.
**Đích:** phone thành **tuỳ chọn** (optional). Sửa cả 3 tầng, nếu thiếu 1 tầng sẽ vẫn 400 hoặc vẫn hiện "bắt buộc".

- [x] **`mobile/app/(auth)/register.tsx`**
  - [x] `handleRegister`: bỏ `!phoneTrimmed` khỏi điều kiện "Thiếu thông tin".
  - [x] Regex SĐT chỉ chạy khi có nhập: `if (phoneTrimmed && !/^0[35789]\d{8}$/.test(phoneTrimmed)) {…}`.
  - [x] Payload: `...(phoneTrimmed ? { phoneNumber: phoneTrimmed } : {})` — không gửi chuỗi rỗng.
  - [x] Label field: `Số điện thoại (không bắt buộc)`.
- [x] **`backend/src/main/java/com/deutschflow/user/dto/RegisterRequest.java`**
  - [x] Xoá `@NotBlank` trên `phoneNumber`.
  - [x] `@Pattern` cho phép rỗng/null: `regexp = "^$|^0[35789]\\d{8}$"` (giữ message).
- [x] **`backend/.../user/service/AuthService.java`** (hàm `register`)
  - [x] `phoneNumber` null/blank → set **`null`** vào entity (KHÔNG lưu `""`); uniqueness chỉ check khi có số.
  - Lý do: `User.java:29` có `@Column(name="phone_number", unique=true, length=15)`. Postgres cho phép **nhiều NULL** dưới UNIQUE, nhưng 2 chuỗi `""` sẽ vi phạm unique → account thứ 2 không có SĐT sẽ đăng ký lỗi.
- [x] **DB**: cột `phone_number` đã nullable → **không cần migration** (xác nhận: entity không có `nullable=false`).
- [x] **Không đụng** `UpdateProfileRequest.java` / `AdminUpdateProfileRequest.java` (giữ nguyên).

**Verify:** đăng ký mới **bỏ trống SĐT** → tạo account thành công (FE + curl `/api/auth/register` không có `phoneNumber` → 200). Đăng ký 2 account đều bỏ trống → cả 2 OK (test ràng buộc unique/null).

---

## B. Lỗi 2 — Thiếu Account Deletion (Guideline 5.1.1(v))

**Sự thật:** luồng xoá **ĐÃ CÓ và hoạt động** — `confirmDeleteAccount()` → `DELETE /api/profile/me` → `AccountDeletionService` (xoá cascade nhiều bảng: messages, teacher_sessions, learner states…). Reviewer **không tìm thấy** vì nút quá mờ (caption màu `faint`, dưới dòng version) và/hoặc demo account/review-note không dẫn tới.

**Đích:** nút xoá **rõ ràng, dễ thấy** + gửi Apple video demo (xem `APPLE_REPLY_2026-07-06.md`).

- [x] **`mobile/app/(student)/profile.tsx`**
  - [x] Thay `<Pressable>` "Xoá tài khoản" mờ bằng **`Card` màu đỏ** (`c.dangerSoft` nền + `c.danger` viền) đặt ngay dưới nút "Đăng xuất", icon `Trash2` + chevron, chữ `bodyStrong` màu `danger` + subtitle — cùng cấp với Đăng xuất.
  - [x] Giữ nguyên `confirmDeleteAccount` (Alert "Xoá vĩnh viễn").
  - [ ] (Tuỳ chọn) màn trung gian `settings/delete-account` — **bỏ qua**, card đỏ + Alert đã đủ rõ.
- [x] **Backend**: không đổi. `DELETE /api/profile/me` (`ProfileController.java:103`) vẫn 200.
- [ ] **ASC / demo account** *(owner)*: demo là **role student**, note chỉ đường (Hồ sơ → cuối trang → Xoá tài khoản). Dùng **secondary demo** để quay video.

**Verify:** trên **thiết bị thật**, tạo account → Hồ sơ → Xoá tài khoản → xác nhận → bị đăng xuất, login lại báo sai thông tin. Quay màn hình toàn bộ bước này.

---

## C. Lỗi 3 — Business model / nội dung trả phí (Guideline 2.1(b) + 2.1.0)

**Gốc:** app có khái niệm **PRO/ULTRA**, màn "DeutschFlow PRO", tính năng khoá sau PRO, và **code StoreKit (`expo-iap`, `useAppleIap`) nhưng không có sản phẩm IAP** → Apple hỏi mô hình kinh doanh. "Màn trung tính" né được 3.1.1 nhưng vẫn kích hoạt câu hỏi.

**Đích (v1.0):** iOS **không có gì trả phí, không nội dung khoá, không chữ "PRO/Nâng cấp"**. Mọi tính năng mở cho mọi người. → Trả lời 2.1(b) sạch + loại luôn rủi ro 3.1.1 "unlock hàng mua ngoài" (vì web-PRO không cho thêm gì trên iOS).

### C1. Công tắc trung tâm (1 chỗ, dễ revert)

- [x] **`mobile/lib/paywall.ts`** — thêm `export const PRO_UNLOCKED_FREE = Platform.OS === 'ios' && !IAP_ENABLED` (kèm doc bật lại ở v1.1).
- [x] **`mobile/stores/usePlanStore.ts`** — thêm `hasProAccess` vào state: default `PRO_UNLOCKED_FREE`; trong `fetchPlan().set()` = `PRO_UNLOCKED_FREE || isPro`; nhánh catch = `PRO_UNLOCKED_FREE`.
  → Dùng **`hasProAccess`** cho khoá **tính năng**; `isPro` chỉ cho nhãn thương mại (ẩn trên iOS).

### C2. Mở khoá tính năng trên iOS (đổi `isPro` → `hasProAccess`)

- [x] **`mobile/app/(student)/speaking.tsx`**
  - [x] `if (!isPro)` → `if (!hasProAccess)` (Alert cũng đổi sang "Tính năng nâng cao"). iOS → không bao giờ hiện.
  - [x] `<CompanionSelect isPro={hasProAccess} …>`.
- [x] **`mobile/components/speaking/CompanionSelect.tsx`** — không sửa (nhận prop); persona mở khoá trên iOS nhờ C2.
- [x] **`mobile/app/(student)/exam.tsx`** — `enabled: hasProAccess` (×3) + `{hasProAccess ?}` / `{!hasProAccess ?}`.
- [x] **`mobile/app/(student)/weekly-speaking.tsx`** — `enabled: hasProAccess` (×2) + `if (!hasProAccess)`.

### C3. Ẩn mọi chữ/điểm vào thương mại trên iOS

- [x] **`mobile/app/(student)/profile.tsx`**
  - [x] Pill tier: bọc `{!PRO_UNLOCKED_FREE ? <Pill…/> : null}` — ẩn nhãn FREE/PRO trên iOS.
  - [x] Card "Nâng cấp lên PRO" đã gate `!isPro && PAYWALL_ENABLED` → ẩn trên iOS (xác nhận).
- [x] **`mobile/app/(student)/index.tsx`** card upsell "DeutschFlow PRO" gate `!isPro && PAYWALL_ENABLED` → ẩn trên iOS (xác nhận).
- [x] **`mobile/lib/upsell.ts`** `handleAiError` — khi `PRO_UNLOCKED_FREE`: message trung tính `'Bạn đã dùng hết lượt AI hôm nay, vui lòng thử lại sau.'` (không dùng `detail` từ server để tránh chữ "nâng cấp"/"dùng thử"). Nút "Nâng cấp" vẫn gate `PAYWALL_ENABLED`.
- [x] **`mobile/components/guide/tourContent.ts` + `guide.tsx`** — FAQ PRO gắn `proOnly: true`; `guide.tsx` lọc `FAQ.filter(e => !e.proOnly)` khi `PRO_UNLOCKED_FREE`.
- [x] **`mobile/app/(auth)/onboarding.tsx`** — nhánh `EMAIL_CAPTURE_UPSELL` thêm điều kiện `&& !PRO_UNLOCKED_FREE` → iOS bỏ qua consent, rơi thẳng vào buổi luyện đầu tiên.
- [x] **`mobile/app/(student)/upgrade.tsx`** — nếu `PRO_UNLOCKED_FREE`: `useEffect` `router.replace('/(student)')` + `return null` (không bao giờ mở màn PRO). File giữ lại cho v1.1.

### C4. Backend — không để tính năng "gãy" sau khi mở khoá UI

Quyết định sản phẩm (chọn 1, ghi vào `IOS_FREE_MODE.md`):

- [x] **✅ ĐÃ CHỌN — Phương án A "miễn phí có giới hạn công bằng":** giữ nguyên quota AI backend, client iOS **diễn đạt trung tính** (đã làm ở C3 `upsell.ts`). "App free có fair-use limit" — Apple chấp nhận; message lỗi AI **không** nhắc mua/PRO.
- [ ] ~~Phương án B "mở hết cho iOS"~~ — không làm ở v1.0 (nhiều việc, để v1.1).
- [ ] **Trial** *(owner)*: giữ nguyên `StudentTrialSubscriptionProvisioner`. Đảm bảo **demo account của reviewer còn full-access suốt review** (tạo FRESH sát giờ nộp, hoặc admin cấp PRO tạm). Xem cảnh báo trial-hết-hạn trong `APP_STORE_SUBMIT_V1.0.md`.

**Verify C:** trên build iOS mới, tài khoản **non-PRO/hết trial**: không thấy chữ "PRO/Nâng cấp/Tính năng PRO" ở bất kỳ đâu (Home, Hồ sơ, Speaking, Exam, Weekly, onboarding, tour); AI Speaking/persona/Exam đều dùng được; lỗi hết lượt (nếu có) diễn đạt trung tính. `grep -rn "PRO\|Nâng cấp" mobile/app mobile/components` — rà soát text còn sót.

---

## D. Build & nộp lại

- [x] `cd mobile && npx tsc --noEmit` (xanh 0 lỗi) + `jest` (151/151 xanh — `quota`/`iapProducts` không đổi).
- [x] Backend `RegisterRequestTest` (**8/8**) + `AuthServiceUnitTest` (15/15) xanh + CI (Compile/Unit Tests/SAST) xanh trên PR #201.
- [x] **Build number**: KHÔNG bump tay — `eas.json` dùng `appVersionSource:remote` + production `autoIncrement:true` ⇒ EAS tự tăng khi build. (`app.json` không có `ios.buildNumber`, đúng.)
- [x] **Merge PR #201 → main** (`9b34e9b3`).
- [x] **Deploy backend** — DONE 2026-07-06 (`9b34e9b3` LIVE, `curl .../actuator/health`=200 UP). Phone-optional live → đăng ký bỏ trống SĐT không còn 400.
- [ ] *(owner)* `eas build --platform ios --profile production` (ĐANG CHẠY) → `eas submit` (bắt buộc build mới: `PRO_UNLOCKED_FREE` là flag native, không OTA được).
- [ ] *(owner)* Gắn build mới vào version 1.0, dán demo creds (student, còn trial) + review notes.
- [ ] *(owner)* **Reply 2.1(b)** trong Resolution Center kèm **video xoá tài khoản** (nội dung ở `APPLE_REPLY_2026-07-06.md`).
- [ ] *(owner)* Resubmit for Review.

## E. Định nghĩa "Done"
- [x] Đăng ký không cần SĐT (FE+BE) — **code + test xong**; verify prod sau deploy.
- [x] Nút Xoá tài khoản nổi bật (card đỏ ngang "Đăng xuất") — **code xong**; video demo = việc owner.
- [x] iOS không còn bề mặt trả phí/PRO nào reachable; mọi tính năng mở (`hasProAccess`).
- [ ] *(owner)* Đã trả lời 4 câu 2.1(b).
- [ ] *(owner)* Build mới đã submit.
