# DeutschFlow — KẾ HOẠCH TUẦN (2026-06-22 → 06-28): đưa Web + Mobile tới deploy-complete

> **Mục tiêu tuần:** Web cán đích phát hành hoàn chỉnh; iOS đạt **submission-ready** (code + compliance) để
> ship ngay khi Apple duyệt. **Nguồn:** đọc toàn bộ docs/plan 20→22/06 + verify code/git phiên này.
> **Cập nhật realtime** (tick + chú thích từng mục khi xong — theo feedback "keep checklist synced").

---

## 0. TL;DR + 1 sự thật cứng (đọc trước)

| Track | Tuần này làm được tới đâu | Chốt |
|---|---|---|
| **WEB** | ✅ **Cán đích hoàn chỉnh** — deploy backend B2B + đóng audit round-2 + ổn định cutover | Khả thi 100% |
| **MOBILE (iOS)** | ⚠️ **Code + compliance đạt submission-ready**; **GO-LIVE (TestFlight/submit) KHÔNG thể tuần này** | Bị chặn bởi Apple |

**Sự thật cứng — iOS không thể go-live tuần này** dù code có xong: Apple Developer **đang chờ duyệt** →
không tạo được IAP product, không ký được build, không lên TestFlight, không submit. Đây là cổng chặn **bên ngoài**.
⇒ Tuần này iOS: làm hết phần **không phụ thuộc Apple** + xếp sẵn checklist Apple-gated để bấm-1-nút khi duyệt.

**Tin tốt:** iOS MVP core đã xong & build-verified (Auth→Hôm nay→Lộ trình→Ôn tập SRS — `ios/MVP_PROGRESS.md`).
Phần còn lại nhỏ hơn nhiều so với lo ngại ban đầu.

---

## 1. Trạng thái hiện tại (đã verify)

- **Web v2 "Galerie" = LIVE 100%** mọi user (hardcode v2-default, không cờ). ~~Rollback = `GALERIE_V2_DISABLED=true`~~ → ⚠️ **kill-switch ĐÃ GỠ 2026-07-14** (đợt 0 xoá cây v1). Rollback bây giờ = revert commit / Amplify "Redeploy this version". Xem `plans/2026-07-14-xoa-sach-v1-web.md`.
- **`main` = `37678da8` (#143 B2B finalize)** — chứa **V225/V226/V227** + endpoint B2B mới (`PATCH /api/org/members/{id}/role`, materials, free-teachers) → **CHƯA deploy lên prod** (prod backend còn ~V224).
  - 🔴 **Rủi ro LIVE:** FE của #143 (`/v2/org/roles`, `/v2/teacher/materials`, `/v2/admin/free-teachers`) đang auto-deploy qua Amplify nhưng **backend chưa có endpoint → các trang này 404/vỡ trên prod tới khi deploy.**
- **iOS:** `feat/native-ios-phase0` — Mốc 4 (M4.1/M4.2/M4.4 ✅, M4.3 defer-minor) + Mốc 5 (M5.1/M5.2 ✅; M5.3 optional; M5.4 Paywall ⏸ chờ Apple). Backend mobile: B3.2 ✅, B3.3 verify-receipt ✅ (#128), B3.1 APNs ☐ (cần `.p8`, không chặn MVP).

## 2. Cổng chặn / ràng buộc bên ngoài

| Cổng | Trạng thái | Hệ quả |
|---|---|---|
| 🍎 Apple Developer | **đang chờ duyệt** | Chặn MỌI go-live iOS (IAP product · ký · TestFlight · submit) |
| 🔑 SSH deploy backend | **user mở được tuần này** | Tôi chạy `deploy-backend.sh` khi có cửa sổ SSH |
| ✋ Merge `main` | cần user duyệt | Classifier chặn auto-merge prod — mỗi PR chờ user "merge" |

---

## 3. TRACK A — WEB (cán đích) · 🤖 = tôi làm · 👤 = cần bạn

### A1 🔴 Deploy backend prod (#143) — **LÀM ĐẦU TIÊN, gỡ rủi ro LIVE**
- [ ] 👤 ⏳ **ĐANG CHỜ:** whitelist **`117.5.147.64/32`** (IP máy tôi) cho **port 22** trên SG EC2 `35.175.232.152`. *(Thử 08:26 + retry → vẫn timeout. Instance OK: API `UP` trên 443 → thuần là SG chưa có IP này. Gotcha cũ: từng nhầm `.190`.)*
- [ ] 🤖 `git checkout main && git pull` → cây sạch → `./deploy-backend.sh` (blue-green; **exit 1 ở cleanup-prompt = cosmetic, đọc log**)
- [ ] 🤖 Verify: `curl -sf https://api.mydeutschflow.com/actuator/health` = `UP`; migration **V225/V226/V227 applied**
- [ ] 🤖 Verify endpoint mới: `PATCH /api/org/members/{id}/role` (org-admin) · materials · free-teachers → 200/đúng-gate
- **Gotcha:** `mvn clean` nếu target migration stale (memory B2B); script Phase-1 auto-commit dirty tree → `git stash -u` WIP trước.

### A2 🔴 Smoke post-deploy 4 vai (xác nhận B2B FE hết vỡ)
- [ ] 🤖 admin@ · teacher@ · student@ + 1 org-owner → login đúng `/v2/*`; 0 console error
- [ ] 🤖 Mở `/v2/org/roles`, `/v2/teacher/materials`, `/v2/admin/free-teachers` → render data thật (không 404)

### A3 🟡 Round-2 audit FE fixes (`plans/2026-06-22-v2-audit-followups.md`)
- [x] 🤖 **weekly-speaking** (HIGH) ✅ **PR #144** — rewrite toàn bộ form+list theo `WeeklyPromptAdminUpsertRequest` (date-picker weekStart · cefrBand · title · promptDe · mandatory/optional points = textarea mỗi-dòng-1-ý · active); list đọc JDBC snake_case thật.
- [x] 🤖 **3 reports con** (MED) ✅ **PR #144** — `vocabulary-quality`→2 time-series phủ giống-DT + bản-dịch · `grammar-feedback-coverage`→series ngày `{snapshotDate,coveragePercent,...}` · `personalization-ruleset`→`{version,dimensionsSupported[]}` (banner version + grid chiều). Bỏ hết field giả.
- [x] 🤖 **Wire rubric phỏng vấn** (HIGH) ✅ **PR #144** — ⚠️ thực ra là **M không phải S**: backend per-template (nhiều rubric/ngành, 4-8 tiêu chí float Σ=1) ≠ editor giả 4-nhãn-VN. Wire ngây thơ sẽ **ghi đè phá rubric chấm AI**. Đã build per-template editor đúng: chọn template → sửa weight thật → `updateRubric` (%→fraction, gate Σ=100%).
- [x] 🤖 **orgs seat/validUntil** (MED) ✅ **PR #145** (BE) — `OrgDto`+`OrgDetailDto`+2 builder thêm `seatUsed`(=studentCount)/`monthlyTokenPool`/`validUntil`/`createdAt` (Instant→ISO). FE `AdminOrg` đã đọc sẵn → KHÔNG đổi FE. test-compile + AdminOrganizationControllerTest (3/0). **Surface trên prod sau Deploy #2.**

### A4 🟡 B2B role model — đóng phần CÒN LẠI sau #143 (`plans/2026-06-22-b2b-role-model-checklist.md`)
- [x] 🤖 **P0-1 (S)** ✅ **PR #144** — khôi phục khối "Vai trò hệ thống" (STUDENT/TEACHER/ADMIN + nút Đổi) ở `UserDetailModal.tsx` → `PATCH /admin/users/{id}/role`; baseline re-disable sau khi lưu.
- [x] 🤖 **P1-1 (S)** ✅ **đã wire sẵn ở #143** — `/v2/org/roles` gọi `changeMemberRole`→`PATCH /org/members/{id}/role` thật + `<select>` MANAGER↔TEACHER (OWNER-only). #144 chỉ dọn comment stale ("read-only=toast" sai). Verify end-to-end chờ A1 deploy (endpoint chưa lên prod).
- [x] 🤖 **P0-3 (S)** ✅ **PR #145** — enum `OrgRole {OWNER,MANAGER,TEACHER,STUDENT}` + tiers ADMIN/ASSIGNABLE + `from()` fail-closed; dùng ở `OrgGuard`+`changeRole` (bỏ String sets trùng). Bug `Set.of.contains(null)`→NPE đã bắt (OrgGuardTest) + fix null-safe. 45 org tests pass.
- [x] 🤖 **P1-2 (M)** ✅ **PR #145** — invite nhận role MANAGER/TEACHER (cũ hardcode TEACHER): `InviteTeacherRequest`+controller+service validate; accept-flow map invitation.role→membership. FE `orgApi.inviteTeacher(email,role)` + selector `/v2/org/invitations` thêm MANAGER. Verify chờ Deploy #2.
- [x] 🤖 **P1-4 (M)** ✅ **PR #145** — org-admin phân teacher→lớp: BE 3 endpoint (`POST/DELETE /org/classes/{id}/teachers` + `GET /org/members/{id}/classes`; `assertOrgAdmin` + IDOR-safe + reuse `ClassTeacher` ASSISTANT, PRIMARY-protected) + FE modal `/v2/org/teachers` "Phân công" (thay toast). +7 tests (happy/IDOR/non-member/student/dup/unassign-primary/ok). Verify chờ Deploy #2.
- **✅ #143 đã làm (không lặp):** P0-2 ACCOUNTANT đã drop · ADMIN→MANAGER · BE endpoint đổi org-role.

### A5 🔴 Deploy #2 (batch BE) + đóng web
- [ ] 👤 Cửa sổ SSH thứ 2 (cuối tuần) cho batch BE = **[#145](https://github.com/CuDinh03/DeutschFlow/pull/145)** (orgs-DTO + OrgRole enum P0-3 + P1-2 + P1-4, **V không mới**) + **[#146](https://github.com/CuDinh03/DeutschFlow/pull/146)** (messaging, **V228**) — merge cả 2 trước rồi deploy.
- [ ] 🤖 `deploy-backend.sh` lần 2 → verify health + V228 applied + endpoint mới (org assign-teacher · messages)
- [ ] 🤖 Smoke 4 vai lần cuối → **WEB = DEPLOY-COMPLETE** ✅

> **Hoãn có chủ đích (KHÔNG làm tuần này):** W2.5 swap `/v2`→canonical + W2.6 gỡ legacy/V2Gate — *destructive, cần duyệt riêng, chỉ làm sau khi 100% ổn định nhiều ngày*. Backlog BE→FE coverage (gradebook, comprehensive-report, co-teaching, bulk-assign…) — ngoài phạm vi "deploy", để đợt sau.

### A6 🟡 Student↔Teacher messaging (thêm 06-22 theo yêu cầu "student tương tác giáo viên")
> 6 kênh tương tác đã chạy (vào lớp · giao/nộp/chấm bài · feedback · buổi 1-1 · thông báo); chỉ thiếu **chat trực tiếp**.
- [x] 🤖 **BE foundation** ✅ **[#146](https://github.com/CuDinh03/DeutschFlow/pull/146)** — V228 `messages` + Message/repo/service/controller; authz = cùng-lớp teacher↔student (re-check DB); send→noti `NEW_MESSAGE`. 5 tests (gồm no-share→403). 5 endpoint `/api/messages/*`.
- [x] 🤖 **FE chat** ✅ **[#146](https://github.com/CuDinh03/DeutschFlow/pull/146)** — `messagesApi` + `messagesShared` MessagesView (list hội thoại + thread + composer, poll 12s, badge unread, responsive) + màn `/v2/student/messages` + `/v2/teacher/messages` (?to=&name= deep-link) + nav "Tin nhắn" (student+teacher) + render `NEW_MESSAGE` ở notifications + entry "Nhắn giáo viên" (student class-detail) & bulk "Nhắn tin" (teacher roster). tsc+eslint+build xanh.
- ⏳ **Functional verify chờ Deploy #2** (V228 + 1 cặp student↔teacher cùng lớp): chat 2 chiều · khác lớp 403 · noti `NEW_MESSAGE`.

---

## 4. TRACK B — MOBILE iOS (submission-ready, go-live chờ Apple)

> Làm trên `feat/native-ios-phase0`. ⚠️ Đây là **đảo ngược quyết định "HOÃN/không đụng"** trước đó — giờ resume vì bạn muốn đẩy mobile. iOS MVP core đã ✅ build-verified.

### B1 🟢 Làm ĐƯỢC tuần này (KHÔNG cần Apple account)
- [ ] 🤖 **M6.3 — UI Xoá tài khoản** → `DELETE /api/profile/me` (endpoint đã có) + confirm + logout *(bắt buộc compliance App Store)*
- [ ] 🤖 **M6.4 — Privacy Info.plist** — `NSMicrophoneUsageDescription` (đã khai) + rà `NSCamera*`; quyết ATT (PostHog tracking?) → khai/none
- [ ] 🤖 **M6.5 — Icon + launch screen + brand assets** (đủ size icon + launch)
- [ ] 🤖 **M5.4 (code-only) — Paywall UI + StoreKit 2 client scaffold** — `Product.purchase()`→JWS→`POST /verify`→entitlement; restore qua `/sync`. **Viết được code; KHÔNG test được** (cần IAP product trong ASC → Apple-gated)
- [ ] 🤖 **Runtime QA trên simulator** — chạy slice Auth→Hôm nay→Lộ trình→Ôn tập SRS với 1 account thật xem data sống *(simulator KHÔNG cần ký → làm được ngay)*
- [ ] 🤖 **M5.3 (optional) — Offline SRS** SwiftData queue — chỉ làm nếu còn thời gian; v1 online-only chấp nhận được
- [ ] 🤖 **B3.1 (optional) — `ApnsPushSenderService`** code (HTTP/2 token) — viết được; test cần `.p8` (Apple-gated, post-v1, không chặn submit)
- [ ] 🤖 Verify **AppleIapController** đã lên prod sau Deploy #1 (B3.3 verify-receipt typed) → backend sẵn sàng cho Paywall

### B2 🍎 Apple-gated — KHÔNG làm được tuần này, **xếp sẵn để bấm-1-nút khi Apple duyệt** (`deploy-ops-runbook.md §5`)
- [ ] 👤 **B6.1** — hoàn tất enroll → App ID `com.deutschflow.app` (bật IAP + Push) → 4 IAP product `com.deutschflow.app.{pro,ultra}.{monthly,yearly}` + giá theo region → cert/provisioning
- [ ] 🍎 **M7.1** — quyết bundle id (khai tử Expo & tái dùng `com.deutschflow.app` HAY id mới chạy song song beta)
- [ ] 🍎 **M5.4 test** — sandbox mua → entitlement; restore (sau khi có IAP product)
- [ ] 🍎 **B3.5** — webhook App Store Server Notifications V2 → `/api/payments/apple/notifications`
- [ ] 🍎 **M6.6** — metadata VI/DE + screenshots + demo account + privacy-policy URL
- [ ] 🍎 **M7.2→M7.4** — TestFlight internal → external → Submit App Review → phased release

---

## 5. Trình tự đề xuất (5 ngày)

```
Ngày 1 (06-22)  A1 deploy BE #143 (👤 mở SSH) → A2 smoke 4 vai   [gỡ rủi ro LIVE — ưu tiên tuyệt đối]
Ngày 2 (06-23)  A4 P0-1 global-role UI + P1-1 org-role wire + A3 rubric   (3× S, gọn)
Ngày 3 (06-24)  A3 weekly-speaking (HIGH) + 3 reports con
Ngày 4 (06-25)  A3 orgs-DTO (BE) + A4 P0-3 OrgRole enum (BE) → batch cho Deploy #2
                ‖ B1 iOS: M6.3 xoá-TK + M6.4 privacy + M6.5 icon (song song, khác stack)
Ngày 5 (06-26)  A5 Deploy #2 (👤 SSH) → smoke cuối → WEB DONE ✅
                B1 iOS: Paywall scaffold + runtime QA simulator → iOS submission-ready
Đệm (27–28)     B1 optional (offline SRS / APNs) · chốt B2 checklist chờ Apple
```
> Web (Track A) và iOS (Track B) khác stack → chạy song song được; nút thắt chung = 2 cửa sổ SSH (A1, A5) + duyệt-merge mỗi PR.

## 6. Định nghĩa "XONG tuần này" (Definition of Done)

**WEB ✅ (đạt được):**
- Backend prod = `main` (#143, V225-V227 + orgs-DTO + OrgRole enum) deployed, health UP
- 4 vai smoke sạch; B2B pages (roles/materials/free-teachers) hoạt động thật
- Round-2 audit FE đóng (weekly-speaking + 3 reports + rubric + orgs seat/validUntil)
- B2B role model: P0-1 + P1-1 đóng; cutover ổn định, rollback lever còn nguyên

**MOBILE ⚠️ (đạt "ready", KHÔNG "live"):**
- iOS code submission-ready: MVP slice runtime-verified + xoá-TK + privacy + icon + Paywall scaffold
- Backend mobile sẵn trên prod (verify-receipt)
- Checklist B2 Apple-gated xếp sẵn → **ship trong vài giờ kể từ lúc Apple duyệt**
- ❌ **KHÔNG có:** TestFlight build, App Store submission (Apple chưa duyệt — ngoài tầm)

## 7. Rủi ro

1. 🔴 **Quên Deploy #1** → trang B2B vỡ trên prod (đang xảy ra). → A1 ưu tiên #1.
2. 🟡 SSH bị chặn IP (gotcha `.190`) → xác nhận IP trước khi mở.
3. 🟡 orgs-DTO + OrgRole enum cần Deploy #2 → nếu lỡ cửa sổ SSH thì 2 mục này trượt sang đầu tuần sau (web vẫn "done" phần lớn).
4. 🍎 **Apple lead-time bất định** → mobile go-live có thể trượt nhiều ngày/tuần sau khi code xong. Đã phản ánh trung thực ở DoD.
5. 🟡 Resume iOS = đảo quyết định "hoãn" cũ → xác nhận đây là ưu tiên mới (đã chốt qua câu hỏi tuần này).
