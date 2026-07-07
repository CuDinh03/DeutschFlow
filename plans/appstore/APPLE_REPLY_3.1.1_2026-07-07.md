# Reply cho App Review — 3.1.1 (submission ec05409d, build 1.0(8) → nộp lại 1.0(9))

> Reject 06/07/2026, Guideline **3.1.1** (In-App Purchase). Review device: iPad Air 11" (M3).
> Chiến lược: **Hướng A — iOS free thật** (monetize để v1.1). Đọc kèm `IOS_FREE_MODE.md`, `STORE_COPY.md`.
> **Thứ tự bắt buộc:** build 1.0(9) sạch phải lên ASC + metadata đã scrub + demo account full-access **TRƯỚC**, rồi mới dán reply §A và Resubmit. Đừng gửi reply khi bản đang review vẫn là 1.0(8).

---

## 0. Vì sao 1.0(8) dính 3.1.1 (tóm tắt)

Không phải "Premium" — app không có chuỗi đó; đấy là chữ mẫu của Apple. Thứ reviewer thực sự thấy (qua **build cũ** và/hoặc **Review Notes cũ**):
- Tài khoản mới có **trial PRO 7 ngày**; **trả lời bằng giọng nói bị khoá "Tính năng PRO — cần PRO"**; vài persona có **khoá**.
- Hết trial → **"Gói dùng thử 7 ngày đã hết hạn. Hãy nâng cấp để tiếp tục."**
- Nhưng **không có IAP** để mua → đúng khuôn 3.1.1: *cho truy cập nội dung trả phí mua ngoài, không bán bằng In-App Purchase.*

Code hiện tại (sau PR #201) đã sạch — `PRO_UNLOCKED_FREE` mở mọi tính năng cho mọi user iOS và làm trung tính thông báo hết lượt AI. **Audit 2026-07-07:** không còn bề mặt PRO/upgrade/trial nào reachable trên iOS. Vấn đề là bản build/metadata **đã nộp** còn cũ.

> **Vá thêm 2026-07-08 (defense-in-depth):** rà lại toàn bộ endpoint AI có quota (`QuotaService.assertAllowed`) — vì `PRO_UNLOCKED_FREE` chỉ là cờ client, backend vẫn chặn quota thật, nên account free hết trial (KHÔNG phải account demo quota-cao) khi gọi AI vẫn có thể nhận message server `"…Hãy nâng cấp để tiếp tục."`. 3 màn còn phơi message thô qua `apiMessage(e)`: `weekly-speaking`, `exam-attempt` (chấm mock exam), `video-lesson` (render). Đã cho cả 3 đi qua `handleAiError` → trên iOS hiển thị trung tính `"Bạn đã dùng hết lượt AI hôm nay, vui lòng thử lại sau."`, không có nút "Nâng cấp". `tsc` sạch, `jest` 151/151. Xem chi tiết `STORE_COPY.md` (ghi chú kiểm chứng, mục 2026-07-08).

---

## A. REPLY TEXT (paste vào ASC → Messages — English)

```
Hello, and thank you for the review.

Regarding Guideline 3.1.1: the iOS app does not access, unlock, or provide any paid digital
content, and it contains no In-App Purchase because there is nothing to buy.

To remove any ambiguity, build 9 (version 1.0) makes the iOS app completely free:

- Every feature is available to every user at no charge — including AI Speaking by text and by
  voice, all conversation partners, mock exams, weekly challenges, and the full A1-B1 path.
- There is no trial, no "Pro"/"Premium" tier, no locked content, and no "upgrade" prompt
  anywhere in the iOS app.
- There are no In-App Purchase products, no purchase buttons, and no external purchase links or
  calls to action. There is no way to spend money in the app.

Answers to the standard questions:

1) Who are the users that will use the paid content, subscriptions, features, and services?
   None. Every iOS user receives the same full feature set for free.

2) Where can users purchase the content, subscriptions, features, and services accessed in the app?
   Nowhere in the iOS app. There is no purchase entry point of any kind.

3) What specific types of previously purchased content can a user access in the app?
   None that is treated as paid. A "PRO" plan exists only on our website and on Android (for higher
   AI usage limits). It grants no additional capability inside the iOS app and is never referenced,
   advertised, or unlockable there. On iOS every feature is already free for everyone, so a purchase
   made on another platform unlocks nothing extra in the app.

4) What paid content, subscriptions, or features are unlocked within the app that do not use IAP?
   None. Nothing in the iOS app is unlocked by any purchase made anywhere.

Note on AI usage: some AI generation has a daily fair-use limit that applies equally to all users
and resets each day. This is a usage cap, not a paid feature, and it is not tied to any purchase.
The demo account has an elevated limit so you can review without interruption.

Our earlier review notes mentioned a 7-day trial and "Pro" voice input; that described a previous
build and no longer applies — build 9 unlocks every feature for all users. We have also updated the
App Store description accordingly. If any further information would help, we are glad to provide it.
Thank you.
```

---

## B. REVIEW NOTES MỚI (paste vào Version → App Review Information → Notes — English)

> Thay TOÀN BỘ notes cũ bằng bản này (đã đồng bộ vào `STORE_COPY.md`). Không nhắc trial/PRO/upgrade nữa.

```
MyDeutschFlow is a German-learning app (A1-B1, Goethe/OSD prep). Sign in with the primary demo
account provided above.

THIS VERSION IS COMPLETELY FREE
- Every feature is unlocked for every user at no charge: AI Speaking (text AND voice), all
  conversation partners, mock exams, weekly challenges, and the full A1-B1 learning path.
- There is no trial, no "Pro"/"Premium" tier, no locked content, no upgrade screen, and no
  In-App Purchase. There is no purchase button and no external purchase link anywhere in the app.
- The only limit is a daily fair-use cap on AI generation that applies to all users and resets
  daily; it is not a paid feature. The demo account has an elevated cap so AI works throughout
  your review.

WHAT TO TRY
- Hoc (Learn) tab: vocabulary, grammar, listening, reading, spaced-repetition review, streaks,
  and the full learning path.
- Luyen noi (Speaking): pick any partner and hold a German conversation by typing OR by voice
  (tap the mic) - both work for free.

ACCOUNT DELETION (Guideline 5.1.1(v))
- In-app: Ho so (Profile) -> Xoa tai khoan (Delete account) -> confirm. This permanently deletes
  the account and its data. PLEASE USE THE SECONDARY demo account below for this test so the
  primary login is preserved for the rest of your review.

USER SAFETY (Guideline 1.2)
- Messaging (student-teacher direct messages / class channels) supports REPORT (long-press a
  message or the three-dot menu) and BLOCK (a blocked user cannot message you; their content is
  hidden). Manage at Profile -> "An toan & chan". Objectionable words are filtered server-side and
  reports are admin-reviewed. A fresh solo demo account has an empty inbox, but the safety tools
  are still reachable under Profile -> "An toan & chan".

Privacy Policy: https://mydeutschflow.com/privacy
```

---

## C. Metadata scrub (ĐÃ sửa trong `STORE_COPY.md` — copy sang ASC)

| Chỗ | Cũ | Mới |
|---|---|---|
| EN Description, "FREE TO LEARN" | "Some advanced AI features are **marked Pro**…" | "…every feature is available to everyone at no charge…"; "There are no in-app purchases…" |
| VI Description, "MIỄN PHÍ ĐỂ HỌC" | "Một số tính năng AI nâng cao được **đánh dấu Pro**…" | "…mọi tính năng đều mở cho tất cả người dùng…"; "Không có mua trong ứng dụng…" |
| Review Notes | trial 7 ngày + voice "cần PRO" + "hãy nâng cấp" | §B (fully-free, no trial/tier/upgrade) |

Không hứa "unlimited" ở bất cứ đâu (fair-use quota vẫn tồn tại ở backend).

---

## D. Checklist nộp lại build 1.0(9) — *(owner)*

1. [ ] **Xác nhận cờ:** `mobile/lib/paywall.ts` → `IAP_ENABLED = false` (kéo theo `PRO_UNLOCKED_FREE = true` trên iOS). *(đang đúng)*
2. [ ] **Backend — demo account reviewer:** cấp **full access vĩnh viễn + quota AI cao** cho tài khoản demo (admin grant, KHÔNG dùng account phụ thuộc trial). Trên iOS free mode account này **không** hiện nhãn PRO. Lý do: để AI không "hết lượt" và không có gì hết hạn giữa review.
3. [ ] **EAS build mới:** `eas build --platform ios --profile production` → build number tự tăng lên **8→9** (`appVersionSource: remote`). `eas submit`.
4. [ ] **ASC — gắn build 9** vào version 1.0.
5. [ ] **ASC — Description:** dán EN + VI đã scrub (mục C).
6. [ ] **ASC — App Review Information:**
   - [ ] Primary demo (full-access vĩnh viễn) + Secondary demo (để test xoá account).
   - [ ] Notes: dán §B.
7. [ ] **ASC — Messages:** dán §A.
8. [ ] **Resubmit for Review.**

**Kiểm thử nhanh trên build 9 (thiết bị/simulator) trước khi submit:**
- [ ] Vào Speaking → chạm mic → **ghi âm được** (không hiện "cần PRO").
- [ ] Weekly Speaking + Mock Exam → **mở thẳng** (không màn "Tính năng PRO").
- [ ] Hồ sơ → **không** thấy nhãn FREE/PRO, **không** card "Nâng cấp lên PRO".
- [ ] Dí AI đến hết quota (nếu account thường) → thông báo **"Bạn đã dùng hết lượt AI hôm nay, vui lòng thử lại sau."** (không có nút "Nâng cấp").

---

## E. (Tuỳ chọn — KHÔNG bắt buộc) Gỡ `expo-iap` khỏi binary

Không phải nguyên nhân reject; nhiều app free vẫn bundle StoreKit. **Khuyến nghị BỎ QUA lần này** để không đụng code IAP đang chạy tốt. Chỉ làm nếu muốn xoá sạch mọi tín hiệu StoreKit:
- Bỏ `"expo-iap"` khỏi `mobile/app.json` → `plugins`.
- `useAppleIap` chỉ được import ở `upgrade.tsx` (nhánh `IapPaywall`, đã chết vì `IAP_ENABLED=false`). Stub import đó về `null` cho v1.0, giữ file thật cho v1.1, rồi `npm uninstall expo-iap`.
- Rebuild. (Là native change, nhưng dù sao cũng đang build mới nên không tốn thêm vòng review.)

---

## F. Bẫy cần tránh
- **Đừng** dán reply §A khi bản đang review vẫn là 1.0(8) — câu trả lời chỉ đúng với build 9.
- **Đừng** để sót chữ "Pro/Nâng cấp/dùng thử/upgrade" ở Description, screenshots, hay Promotional text.
- **Đừng** hứa "web PRO sẽ mở khoá trên iOS" — đó là bẫy 3.1.1 cho v1.1 (xem `IOS_FREE_MODE.md` §3.9).
- Demo account trial hết hạn giữa review = rủi ro 2.1 → dùng account full-access vĩnh viễn (bước D2).
