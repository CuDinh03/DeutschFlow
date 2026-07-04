# Báo cáo Kiểm tra Toàn diện B2B — DeutschFlow

> **Ngày:** 2026-07-04
> **Phạm vi:** Toàn bộ tầng B2B (organization / trung tâm tiếng Đức) trên backend, frontend, migrations và docs.
> **Phương pháp:** Audit đa tác nhân (9 trục) — mỗi finding được một tác nhân độc lập _phản biện đối kháng_ (adversarial verify) đọc lại code thật trước khi được tính. 48 agents, ~5.0M tokens, ~700 tool calls.
> **Kết luận tổng:** `READY_WITH_FIXES` — kiến trúc B2B vững, cô lập tenant (chống IDOR) **mạnh thật sự**, nhưng **bị chặn bởi 2 lỗi CRITICAL** phải vá trước khi onboard khách B2B.
>
> **🔧 CẬP NHẬT KHẮC PHỤC 2026-07-04:** 2 CRITICAL + phần lớn HIGH/MEDIUM/LOW **ĐÃ VÁ** trên 4 branch (chi tiết §0.1). Còn lại là các mục lớn/rủi ro cao đã **defer có chủ đích** (H-3 TOCTOU app-wide, gộp cây FE, build G-3, migration M-4).

---

## 0.1 Trạng thái khắc phục (Remediation Status) — 2026-07-04

**Branch đã tạo (chưa merge main — merge độc lập được vì đụng file rời nhau):**

| Branch | Findings | Test |
|---|---|---|
| `claude/nice-easley-7cd3df` | **C-1** account-takeover | 15/15 ✅ |
| `claude/confident-mclaren-3b587d` | **C-2** MANAGER-lật-OWNER + H-5 (transfer-ownership) | 51/51 ✅ |
| `fix/b2b-audit-remediation` (session này) | H-1, H-2, H-4, M-1, M-3, M-6, M-7, M-9, M-10, M-14, M-15, M-16, L-1, L-3, L-4, L-7, L-8 | ✅ green từng nhóm |

### ✅ ĐÃ VÁ (17 findings, session `fix/b2b-audit-remediation`)

| # | Tóm tắt fix | Commit |
|---|---|---|
| **H-1** | Sinh ảnh Bedrock giờ `record()` trừ pool + ví sau khi sinh | `f0bec667` |
| **H-2** | PPTX thread userId → charge 40k on-success | `f0bec667` |
| **M-3** | STT quy giây→token (`20/s`) trừ pool + ví, gom trong `recordStt` | `f0bec667` |
| **H-4** | Skill report chuẩn hoá fallback 0-100 → 0-10 trước khi chấm | `0d803fa7` |
| **M-1** | Seat gate chạy cả khi re-add học viên REVOKED/LEFT | `0d803fa7` |
| **M-14** | `createInvoice` từ chối amount ≤ 0 | `0d803fa7` |
| **M-15** | Invoice state machine forward-only (PAID/VOID terminal) | `0d803fa7` |
| **M-16** | Manual PAID activate org (`AdminOrgService.activateForPaidInvoice`) | `0d803fa7` |
| **M-6** | Analytics activeStudents7d/CEFR join org_members STUDENT/ACTIVE | `0d803fa7` |
| **M-10** | SecurityConfig backstop `/api/admin/**`→hasRole('ADMIN') | `e290f977` |
| **M-9** | Schedule dùng `QuotaVnCalendar.ZONE` (VN) thay UTC | `e290f977` |
| **M-7** | Cert co-brand lấy từ `class.org_id` (không phải issuer.org) | `e290f977` |
| **L-7** | `markRead` thêm `assertCanMessage` | `e290f977` |
| **L-4** | `TeacherReportService.overview` 1 query IN thay N+1 | `b1d157ae` |
| **L-3** | Roster CSV strip UTF-8 BOM (quoted-comma vẫn là residual) | `b1d157ae` |
| **L-1** | Quét sạch Javadoc org-role `ADMIN` → `MANAGER` | `b1d157ae` |
| **L-8** | Xoá dead `orgApi.activateEntitlements` | `96ff7f73` |

**Docs reconciliation** (H-6, M-18, L-11, L-12): ✅ đã cập nhật. M-18 (`plans/…`) commit `af50e773`; H-6/L-11/L-12 (`docs/*` — gitignored theo quy ước repo) sửa trên đĩa.

### ⏸ DEFER CÓ CHỦ ĐÍCH (lý do rõ ràng)

| # | Lý do defer |
|---|---|
| **H-3** pool TOCTOU | Reserve-then-reconcile đụng ~25 call-site AI toàn app (không chỉ B2B), rủi ro regression rộng. Post-charge (H-1/H-2/M-3) đã đóng lỗ "miễn phí" — TOCTOU chỉ cho vượt 1 burst nhỏ. User đã chọn "post-charge only". |
| **M-4** stt_usage_events org_id | Migration mới (V245) giữa 5 branch đang bay = rủi ro va số version. KHÔNG cần cho charge (M-3 derive org từ `users.org_id`) — chỉ cho reporting per-tenant. |
| **M-5** pool dual-source | Refactor charge=`users.org_id` → `org_members`; đụng đúng SQL vừa sửa ở M-3, cần cân nhắc kỹ. Invariant hiện vẫn giữ. |
| **M-11/M-12/M-13** cây FE kép | Gộp/xoá legacy tree + redirect = rủi ro deep-link + KHÔNG type-check được ở đây (thiếu `node_modules`). Backend đã enforce nên không rò data. |
| **M-17** G-3 4 endpoint | Là build feature (roster/gradebook/lesson-logs cho org-supervision), không phải sửa lỗi. |
| **M-2/L-5** rate-limit `/api/public/**` | Cần hạ tầng rate-limit filter; phần oracle của M-2 đã đóng ở C-1 (bỏ `requiresRegistration` + preview read-only). |
| **L-2** invite token rotation · **L-6** Sunday IT · **L-10** invoice audit trail · **M-8** V240 (lịch sử, không sửa ngược được) | Nhỏ/không chặn; L-6 cần IT vs Postgres thật. |

---

## 0. Bảng điều khiển trạng thái (Status Dashboard)

| Trục audit | Trạng thái | Finding cao nhất |
|---|---|---|
| Org core + roles + lifecycle | 🟡 1 lỗi RBAC | HIGH — MANAGER xoá OWNER |
| Invitations + provisioning + roster | 🔴 1 CRITICAL | **CRITICAL — account takeover qua accept-invite** |
| Entitlements + seats + token-pool | 🟡 rò rỉ COGS | HIGH — image/PPTX/STT không trừ pool |
| Billing + SePay payment | 🟢 an toàn | MEDIUM — validate amount / state machine |
| Analytics + certificates | 🟡 lỗi thang điểm | HIGH — skill report chấm sai thang 0–10/0–100 |
| Teacher classroom (class/schedule/material/channel) | 🟢 vững | MEDIUM — timezone UTC off-by-one |
| Multi-tenant isolation + RBAC | 🔴 1 CRITICAL | **CRITICAL — MANAGER lật OWNER** |
| Frontend B2B (dual tree) | 🟡 nợ kỹ thuật | MEDIUM — 2 cây UI song song ~6.4k dòng |
| Docs ↔ code reconciliation | 🟡 1 spec-only lớn | HIGH — HR/Payroll spec 335 dòng, 0 dòng code |

**Tổng số finding (đã qua phản biện):** 2 CRITICAL · 8 HIGH · 21 MEDIUM · 13 LOW · nhiều xác nhận-AN-TOÀN.

---

## 1. Tóm tắt điều hành

Tầng tenant B2B được kiến trúc tốt và **cô lập chiều ngang (horizontal isolation) rất chắc**: mọi endpoint org-scoped và teacher-scoped đều lấy danh tính tenant/owner từ principal đã xác thực (**không bao giờ** tin `orgId`/`classId` do client gửi), `OrgGuard` xác minh lại tư cách thành viên `ACTIVE` + role **trực tiếp trong DB** thay vì tin JWT claim, và authority nền tảng nạp tươi từ `users.role`. **Không tìm thấy IDOR / rò rỉ dữ liệu chéo tenant** trên org core, invitations, roster, analytics, certificates, class/schedule/material/channel. Việc đổi tên `ADMIN → MANAGER` đã hoàn tất end-to-end, seat enforcement chống race bằng `SELECT … FOR UPDATE`, cờ `pool_unlimited` (V237) đóng đúng backdoor cũ, và **bug lịch Chủ Nhật (day_of_week ISO 1–7) đã được vá thật** (V243). Cổng thanh toán **SePay đã xác thực đúng** (Apikey + so sánh hằng-thời-gian + fail-closed + idempotent), không thể giả mạo để kích hoạt org miễn phí.

Tuy nhiên **hai lỗi CRITICAL chặn launch:**

1. **Chiếm tài khoản (account takeover) qua accept-invite.** Endpoint accept-invite **không xác thực** cấp nguyên một phiên đăng nhập (access + refresh token) cho một tài khoản **đã tồn tại** mà **không cần mật khẩu hay bằng chứng sở hữu nào** — bất kỳ ai cầm được token lời mời có email trùng một user đã đăng ký (kể cả tài khoản đặc quyền OWNER/MANAGER/ADMIN) đều đăng nhập được vào tài khoản đó. Endpoint `preview()` public còn là "oracle" cho biết trước email đó đã có tài khoản, khiến việc chiếm quyền trở nên **tất định**.

2. **Leo thang dọc: MANAGER lật OWNER.** `DELETE /api/org/members/{userId}` cho phép cả MANAGER, và `removeMember → deactivate` **không có guard bảo vệ OWNER** — một MANAGER (nhân sự, không phải giám đốc) có thể thu hồi tư cách của OWNER, khiến org "mồ côi" không còn chủ, và **không có endpoint chuyển quyền sở hữu** để khôi phục trong app.

Ngoài ra, **kế toán token-pool AI có nhiều đường rò COGS**: 3 tính năng AI đắt nhất (sinh ảnh Bedrock, PPTX Gemini, STT Whisper) **có cổng chặn nhưng không trừ pool**, và bản thân cổng chặn là _check-then-act_ (TOCTOU) → cap chi phí ~307đ/user/tháng **không giữ được**. Cùng với lỗi đọc thang điểm skill report (0–100 vs 0–10 → hầu hết học viên bị chấm "Xuất sắc") và cây frontend B2B legacy trùng lặp còn ship song song, đó là các mục lớn còn lại. **Không mục nào là "spec-only"** ở phần đã triển khai — mọi subsystem đều đã build và chạy; chỉ có luồng accept-invite và metering pool là "đã ship nhưng hỏng". Riêng **spec HR/Payroll (335 dòng) là 100% chưa code**.

---

## 2. Findings CRITICAL (chặn launch — P0)

### C-1 · [CRITICAL] Chiếm tài khoản qua accept-invite: cấp phiên đăng nhập cho tài khoản có sẵn mà không cần mật khẩu
- **File:** `backend/src/main/java/com/deutschflow/organization/service/OrgInvitationService.java:170`
- **Endpoint:** `POST /api/public/org-invitations/{token}/accept` (KHÔNG xác thực — qua `PublicOrgInvitationController`)
- **Bằng chứng:** khi email lời mời đã thuộc user đã đăng ký, `accept()` đi nhánh `userRepository.findByEmailIgnoreCase(...).orElseGet(...)` → gọi `membershipService.upsertMember()` → `authService.issueSession(refreshed)` (mint access + refresh token). Trường `AcceptInviteRequest.password` **chỉ** được dùng trong `registerInvitedUser()` (nhánh tài khoản CHƯA tồn tại, dòng ~224). Với tài khoản có sẵn: không mật khẩu, không mã xác minh email, không bằng chứng sở hữu. `syncPlatformRole()` (`OrgMembershipService:227`) **không hạ cấp** ADMIN → chiếm tài khoản đặc quyền vẫn giữ nguyên đặc quyền.
- **Tác động:** Token lời mời rò rỉ (email chuyển tiếp, hộp thư dùng chung, log mail server, referrer/history trình duyệt, URL `/org/accept?token=`) = **bypass xác thực hoàn toàn** vào tài khoản email được mời, kể cả OWNER/ADMIN.
- **Cách vá:** Ở nhánh tài khoản có sẵn, **KHÔNG** cấp phiên. Bắt user đăng nhập bình thường trước rồi mới gắn membership (trả `requiresLogin`), hoặc yêu cầu mật khẩu / mã xác minh email trước `upsertMember + issueSession`. Đồng thời **ngừng để `preview()` tiết lộ `requiresRegistration`** cho caller chưa xác thực.

### C-2 · [CRITICAL] MANAGER thu hồi tư cách của OWNER — leo thang dọc + org mồ côi
- **File:** `backend/src/main/java/com/deutschflow/organization/controller/OrgController.java:138` → `OrgMembershipService.java:108` (`deactivate`)
- **Bằng chứng:** `DELETE /api/org/members/{userId}` được gác bằng `orgGuard.assertOrgAdmin()` với `ADMIN_ROLES = {OWNER, MANAGER}`. `removeMember → deactivate` đặt `status=REVOKED` + `detachUser()` (xoá `users.org_id`, hạ role staff về STUDENT) cho **bất kỳ** target, **không kiểm tra role của target**. Guard bảo vệ OWNER chỉ tồn tại ở `selfLeave` (dòng 124-126) và `changeRole` (dòng 155-157) — **không có** ở đường remove.
- **Tác động:** Một MANAGER dùng token hợp lệ của mình gọi `DELETE /api/org/members/{ownerUserId}` → đá OWNER (giám đốc) ra khỏi org: mất quyền finance, đổi role, toàn bộ console. Vì **không có endpoint chuyển/thăng quyền OWNER** (xem C-2b), org rơi vào trạng thái **không còn OWNER, không khôi phục được trong app** (chỉ platform ADMIN cứu được). Đây là chiếm quyền thù địch / denial-of-control cùng tenant.
- **Cách vá:** Trong `deactivate()/removeMember()` từ chối khi target role = OWNER (mirror `selfLeave`/`changeRole`), HOẶC gác `DELETE /members/{userId}` bằng `assertOrgOwner`. Thêm **guard "last owner"** để org không bao giờ về 0 OWNER. Triển khai endpoint chuyển quyền sở hữu trước khi cho phép xoá OWNER.

**C-2b (cùng gốc, HIGH):** `removeMember → deactivate` (`OrgMembershipService:108`) không có guard OWNER và **không có "last owner" constraint** ở DB; `changeRole` giới hạn `ASSIGNABLE_ROLES={MANAGER,TEACHER}` nên **không có đường tạo lại OWNER** trong console (comment ở `OrgController:151,164` gọi chuyển-quyền là "out of scope" — chưa làm). Test `OrgMembershipServiceTest` có case guard cho `selfLeave`-OWNER và `changeRole`-OWNER nhưng **thiếu** case `removeMember`-OWNER.

---

## 3. Findings HIGH (vá trước khi scale — P1)

### H-1 · [HIGH] Sinh ảnh AI có cổng pool nhưng KHÔNG trừ pool — org bị đo giá được sinh ảnh Bedrock không giới hạn
- **File:** `backend/src/main/java/com/deutschflow/aiimage/service/AiImageGenerationService.java:48`
- **Bằng chứng:** `generate()` gọi `orgPoolGuard.assertOrgPoolAvailable(userId, 15_000*count)` **trước**, nhưng không nơi nào gọi `ledgerService.record()` hay tăng `org_monthly_token_counters`. Counter chỉ tăng trong `AiUsageLedgerService.record()` → với sinh ảnh nó **không bao giờ tăng** → cổng không bao giờ chặn. Ước lượng 15k/ảnh chỉ dùng cho pre-check rồi vứt.
- **Tác động:** Org metered (`pool_unlimited=false`, `monthly_token_pool>0`) sinh ảnh **miễn phí với pool**. Bedrock/Stable-Image là một trong các tính năng AI đắt nhất → phá cap chi phí, vỡ COGS ~307đ/user/tháng.
- **Vá:** Gọi `record()` với token thực/ước lượng sau khi hoàn tất.

### H-2 · [HIGH] Sinh PPTX có cổng 40k token nhưng ghi 0 usage
- **File:** `backend/src/main/java/com/deutschflow/teacher/controller/TeacherMaterialController.java:74`
- **Bằng chứng:** gate `assertOrgPoolAvailable(userId, PPTX_ESTIMATED_TOKENS=40_000)` rồi `processDocumentToPptxAsync` (Gemini) — đường async **không** gọi `ledgerService.record()`. Cùng lớp lỗi với H-1.
- **Tác động:** PPTX (chi phí/request lớn nhất, 40k) **không** rút pool. Cùng với ảnh + STT → 3 tính năng đắt nhất đều không tính, cap tháng chỉ phản ánh text-completion rẻ.

### H-3 · [HIGH] Cổng token-pool là check-then-act (TOCTOU) — thành viên đồng thời của cùng org tiêu vượt
- **File:** `backend/src/main/java/com/deutschflow/organization/service/OrgQuotaService.java:76`
- **Bằng chứng:** `wouldExceedOrgPool()` đọc counter lúc vào request; counter chỉ tăng trong `record()` chạy **sau** LLM (2–10s). Giữa check và increment, nhiều request đồng thời đọc cùng counter cũ, đều pass, đều tiêu. Increment là atomic (`ON CONFLICT`) nhưng chuỗi read-then-write thì không. **Không có** cơ chế reserve token trước LLM. Comment trong code khẳng định "org pool đã atomic / không thể vượt" là **sai** và sẽ đánh lừa người bảo trì.
- **Tác động:** Dưới tải đồng thời (cả lớp org metered nộp AI grading/speaking cùng lúc, hoặc teacher batch-grade) org vượt `monthly_token_pool` ~ (số request đồng thời) × (token/request). Không có `AiRateLimiter` ở mức org.
- **Vá:** Reserve-then-reconcile: trừ ước lượng vào counter **trước** LLM, chốt lại sau.

### H-4 · [HIGH] Skill report trộn thang 0–100 (assignment) vào chấm 0–10 (CEFR) → sai điểm hệ thống
- **File:** `backend/src/main/java/com/deutschflow/teacher/service/StudentEvaluationService.java:97`
- **Bằng chứng:** cột `skill_*` thủ công là 0–10 (V232 CHECK `chk_class_students_skill_range`), nhưng khi NULL, `toDouble()` fallback lấy `StudentAssignment.getScore()` **thang 0–100** (`GradingService` prompt "0-100", `TeacherReportService` "0-100 scale"), rồi đưa thẳng vào `SkillReportDto.gradeOf(total)` phân loại theo thang 0–10 (`>=9.0` Xuất sắc). Kết quả: học viên chỉ có điểm từ assignment tổng ~75/100 → `75>=9` → **"Xuất sắc" cho tất cả**; còn trộn skill thủ công 0–10 với fallback 0–100 trong cùng một học viên.
- **Tác động:** Giáo viên/trung tâm thấy điểm skill + tổng **sai hệ thống** cho mọi học viên có điểm từ assignment: gần như tất cả bị gán "Xuất sắc"/"Giỏi". Đúng lỗi mà V232 đã tốn 1 migration để dọn ở tầng DB, nay tái sinh ở tầng đọc. Phá giá trị báo cáo B2B.
- **Vá:** Chuẩn hoá fallback assignment về thang 0–10 (chia 10) trước khi trung bình/chấm; thêm test một học viên chỉ-assignment không bị "Xuất sắc" toàn bộ.

### H-5 · [HIGH] Xoá OWNER cuối cùng làm org mồ côi — không có đường khôi phục quyền sở hữu trong console
- **File:** `backend/src/main/java/com/deutschflow/organization/service/OrgMembershipService.java:108`
- **Bằng chứng:** `removeMember/deactivate` thu hồi được OWNER (không có "last owner" protection); `changeRole` giới hạn `ASSIGNABLE_ROLES={MANAGER,TEACHER}` và chặn đổi role OWNER; không có endpoint transfer/promote-to-OWNER. `selfLeave` chặn OWNER tự rời nhưng `removeMember` thì không.
- **Tác động:** Một khi org không còn OWNER `ACTIVE`: finance (`assertOrgFinance` = OWNER-only), đổi role (`assertOrgOwner`) vĩnh viễn không truy cập được từ trong tenant. Chỉ platform ADMIN cứu qua `AdminOrgService.addMember`. Vừa là rủi ro availability vừa là "phần thưởng" khiến leo thang C-2 thành vĩnh viễn.

### H-6 · [HIGH · doc-drift] SPEC_OWNER_HR_PAYROLL_V1 là 100% spec-only — không tồn tại code HR/payroll/tuyển dụng nào
- **File:** `docs/SPEC_OWNER_HR_PAYROLL_V1.md:1-335`
- **Bằng chứng:** không có match `payroll|payslip|staff_attendance|diligence|salary_rule|qr_checkin|recruitment/candidate` trong `backend/src`, `frontend/src`, hay bất kỳ migration nào. Package `organization/` chỉ có `Org*`; không có package `workforce`/`recruitment`. 5 tính năng (chấm công nhân viên, QR check-in, KPI chuyên cần, tính lương/payslip, ATS tuyển dụng) + 9 bảng migration — **0 dòng**. Trang `/v2/org/finance` **không liên quan**: nó tái dùng hoá đơn org-subscription (`getOrgSummary` + `listMyInvoices`, comment "No new endpoint").
- **Tác động:** Spec B2B lớn nhất nằm cùng thư mục `docs/` với các spec đã ship, không có nhãn "draft/chưa bắt đầu" phân biệt → dễ tưởng HR/payroll đã build. Header spec có ghi "Draft để PO/Eng chốt phạm vi" (trung thực), nhưng cần đánh dấu trạng thái rõ.

---

## 4. Findings MEDIUM (P2)

| # | Finding | File:line | Loại |
|---|---|---|---|
| M-1 | **Bypass giới hạn seat khi kích hoạt lại học viên REVOKED/LEFT** — seat check `SELECT FOR UPDATE` chỉ chạy khi `existingOpt.isEmpty()`; re-add học viên cũ bỏ qua check → org tại seat_limit vẫn vượt được (lách seat trả phí) | `OrgMembershipService.java:72` | bug/billing |
| M-2 | **preview() public là oracle email/tồn-tại-tài-khoản, không rate-limit, GET ghi state** — trả org name + email + role + `requiresRegistration`; là `@Transactional` (không readOnly) và ghi `EXPIRED` (crawler/prefetch làm hỏng invite hợp lệ). Tiền đề cho C-1 | `OrgInvitationService.java:142` | security |
| M-3 | **Whisper STT không tính vào pool lẫn ví** — `recordStt()` chỉ insert `stt_usage_events` (hiển thị COGS), không tăng org counter, không `applyUsageDebit`. STT là driver COGS lặp lớn nhất (AI-Speaking) | `AiUsageLedgerService.java:18` | data-integrity |
| M-4 | **stt_usage_events không có cột org_id** (V223 bỏ sót) — không thể quy STT COGS về từng tenant | `V223__org_id_on_event_tables.sql:5` | tenant-isolation |
| M-5 | **Kế toán pool 2 nguồn sự thật: CHARGE theo `users.org_id`, GATE theo `org_members(ACTIVE)`** — lệch nguồn → tính nhầm org hoặc không tính (org_id NULL = no-op) | `AiUsageLedgerService.java:43,54`; `OrgQuotaService.java:77` | consistency |
| M-6 | **CEFR distribution & activeStudents7d đếm cả staff** — chỉ filter `u.org_id=?` không lọc role → OWNER/MANAGER/TEACHER bị tính là "active student", lệch với `studentCount` (nguồn `org_members` STUDENT) | `OrgAnalyticsService.java:83` | consistency |
| M-7 | **Co-brand certificate lấy từ org HIỆN TẠI của người cấp, không phải org_id đã stamp của lớp** — teacher đổi org sau khi tạo lớp → cert gắn nhầm trung tâm | `OrgCertificateService.java:74` | data-integrity |
| M-8 | **V240 chạy UPDATE trên CHECK 0-6 còn hiệu lực** — nếu tồn tại row Chủ Nhật (=6) migration sẽ abort; hiện qua được do may (không có row CN). Thứ tự constraint-then-data bị đảo | `V240__dayofweek_iso_1_7.sql:5` | consistency (latent) |
| M-9 | **Sinh lịch dùng `LocalDate.now()` UTC, không TZ VN** — cửa sổ 00:00–07:00 giờ VN lệch 1 ngày biên; có thể sinh/xoá nhầm session ngày biên | `ClassScheduleService.java:195` | bug |
| M-10 | **SecurityConfig không có URL matcher cho `/api/admin/**` hay `/api/org/**`** — rơi về `anyRequest().authenticated()`; controller admin mới quên `@PreAuthorize` → STUDENT truy cập được. Thiếu lớp phòng thủ backstop | `SecurityConfig.java:114` | security (defense-in-depth) |
| M-11 | **Cây UI B2B kép ship song song** — legacy `/org` + `/admin/organizations` (~3.7k dòng) chạy cạnh v2 (~2.7k dòng); không có redirect `/org→/v2/org`; cùng import `lib/orgApi.ts` | `frontend/src/app/org/client-page.tsx:1` | tech-debt |
| M-12 | **Legacy `/org` là landing sống qua legacy `/login` + `roleHome()`** (không phải orphan) — `roleHome()` map OWNER/MANAGER về `/org`, `v2RoleHome()` về `/v2/org` → user bị chia đôi UI theo đường login | `frontend/src/middleware.ts:28` | consistency (PLAUSIBLE) |
| M-13 | **Legacy `/org/billing` lộ billing cho MANAGER** — v2 bọc `<OrgOwnerOnly>` + nav `ownerOnly`; legacy không có guard nào → MANAGER thấy hoá đơn (backend `assertOrgFinance` vẫn chặn data, nên là lệch UX/policy) | `frontend/src/app/org/billing/client-page.tsx:1` | consistency |
| M-14 | **[Billing] Không validate cận dưới amount hoá đơn** — `createInvoice` lưu `amountVnd` nguyên; hoá đơn 0/âm sẽ tự settle với bất kỳ chuyển khoản dương (`amount < 0` là false). Chỉ ADMIN tạo được → rủi ro insider/nhầm tay | `OrgBillingService.java:64` | data-integrity |
| M-15 | **[Billing] State machine hoá đơn không được enforce** — `updateStatus` cho phép PAID→DRAFT, hồi sinh VOID, nhảy DRAFT→PAID không thanh toán. Chỉ platform ADMIN, nhưng hỏng bản ghi tài chính | `OrgBillingService.java:100` | data-integrity |
| M-16 | **[Billing] Manual PAID notify nhưng KHÔNG activate entitlements** — webhook thì `activateOrg()` (ACTIVE + validUntil + grant students); manual chỉ gửi thông báo → học viên PAID mà thiếu quyền lợi | `OrgBillingService.java:110` | bug (consistency) |
| M-17 | **[Docs] G-3 org-supervision chỉ build 1/5 endpoint** — spec liệt kê roster/gradebook/lesson-logs/schedule/teachers-classes; chỉ `OrgTeachingController:37` `/schedule/week` tồn tại. OWNER/MANAGER **không** đọc được roster/gradebook cho org | `plans/2026-06-23-role-interaction-audit-and-test-plan.md:140` | gap |
| M-18 | **[Docs] role-interaction-audit liệt G-1/G-2 là OPEN nhưng cả hai đã vá** — `TeacherSessionService:45` chặn org-teacher bookSession; `ClassController:28` có `@PreAuthorize("hasRole('STUDENT')")`. Doc chưa reconcile (drift theo hướng an toàn) | `plans/2026-06-23-role-interaction-audit-and-test-plan.md:12` | doc-drift |

---

## 5. Findings LOW (P3)

| # | Finding | File:line |
|---|---|---|
| L-1 | Javadoc còn ghi org-role `ADMIN` (đã đổi MANAGER V225/V229) — DB CHECK từ chối `ADMIN`, comment gây hiểu nhầm | `OrgMember.java:22` (và vài entity/DTO) |
| L-2 | Không xoay được token invite PENDING — UUID là bearer secret 7 ngày trong email plaintext (cửa sổ phơi nhiễm của C-1) | `OrgInvitationService.java:127` |
| L-3 | Roster CSV không strip UTF-8 BOM / không xử lý field trong ngoặc kép → export Excel/Sheets fail header hoặc cắt tên có dấu phẩy | `OrgRosterService.java:108` |
| L-4 | `TeacherReportService.overview()` N+1 (1 query/lớp gom student) — nên `findByIdClassIdIn` | `TeacherReportService.java:55` |
| L-5 | Endpoint public verify (`/api/public/**`: cert, grade-report, invite preview) không rate-limit (token 122-bit nên không brute-force được; là defense-in-depth) | `SecurityConfig.java:95` |
| L-6 | Không có test cho lịch Chủ Nhật (day_of_week=7) — đúng case V243 sinh ra để vá; migration tương lai có thể tái phá thầm lặng | `V243__fix_dayofweek_check_iso.sql:1` |
| L-7 | `MessageService.markRead` bỏ check `assertCanMessage` — chỉ ghi no-op trên row của chính caller (không rò dữ liệu), nên impact thấp; thêm cho nhất quán | `MessageService.java:88` |
| L-8 | Dead code: `orgApi.activateEntitlements` là bản sao y hệt của `adminOrgApi`, không nơi nào import; còn đặt sai (org client gọi route `/admin/*`) | `frontend/src/lib/orgApi.ts:374` |
| L-9 | Middleware pass-through (tắt toàn bộ edge gating) khi thiếu `JWT_SECRET`/`JWT_RSA_PUBLIC_KEY` — chủ ý (tránh outage #67), an toàn vì backend enforce; chỉ còn `console.error` làm tín hiệu | `frontend/src/middleware.ts:277` |
| L-10 | [Billing] Không có audit trail cho đổi status thủ công (`updateStatus` không ghi event/`updated_by`) | `OrgBillingService.updateStatus` |
| L-11 | [Docs] `TEACHER_B2B_ROADMAP.md:13` ghi `User.Role={STUDENT,TEACHER,ADMIN}` — thực tế 5 giá trị (thêm MANAGER, OWNER) | `docs/TEACHER_B2B_ROADMAP.md:13` |
| L-12 | [Docs] `TEACHER_B2B_PHASE1_DESIGN.md:53` còn org-role `ADMIN`/`ACCOUNTANT` đã bỏ (snapshot design, đã bị doc mới thay) | `docs/TEACHER_B2B_PHASE1_DESIGN.md:53` |

---

## 6. Đã XÁC NHẬN AN TOÀN (kết quả dương tính có giá trị)

Những mục sau đã được kiểm tra kỹ và **đúng/an toàn** — ghi lại để khỏi kiểm lại:

- ✅ **Cô lập tenant / chống IDOR mạnh** trên toàn bộ endpoint org + teacher: orgId/classId luôn lấy từ principal; `OrgGuard` xác minh membership `ACTIVE` trong DB; endpoint chỉ-ID (updateSession, deletePattern, revoke cert) đều resolve entity→classId rồi mới check ownership.
- ✅ **SePay webhook xác thực đúng** (`SepayWebhookController`): header `Apikey` + `MessageDigest.isEqual` (hằng thời gian) + **fail-closed** khi chưa cấu hình key. Attacker ẩn danh POST payload giả → **401**. Idempotent 2 lớp (`existsBySepayId` + DB `UNIQUE(sepay_id)` + catch race). Match theo `DFINV[0-9A-F]{12}` random + amount ≥ total. Manual mark-PAID **chỉ platform ADMIN** (MANAGER/OWNER không với tới).
- ✅ **Kích hoạt entitlement bó chặt theo org** — `activateEntitlements(orgId)` chỉ grant `findByIdOrgIdAndRoleAndStatus(orgId, STUDENT, ACTIVE)`, không rò chéo tenant; revoke chỉ xoá `source='ORG'`.
- ✅ **Bug lịch Chủ Nhật (day_of_week) đã vá thật** end-to-end: DB CHECK `BETWEEN 1 AND 7` (V243), service ghi ISO 1–7, validate 1–7, FE render CN vào cột cuối. Tạo lịch CN **không** còn vi phạm CHECK.
- ✅ **Đổi tên ADMIN→MANAGER hoàn tất** — CHECK V229 khớp role set code + FE union; không còn literal `ADMIN` org-role.
- ✅ **Seat enforcement chống race** (`SELECT … FOR UPDATE` trên org row) cho mọi đường add (trừ lỗ hổng reactivation M-1); **`pool_unlimited` fail-safe đúng** (pool=0 & !unlimited → cap; không có bypass toàn cục).
- ✅ **Materials tenant binding đúng** (ORG material buộc theo membership ACTIVE, chặn attach chéo org, blocklist mime XSS); **class channel (V241) cô lập tốt** (assertMember mỗi call, teacher-only moderation, soft-delete + WordFilter/UserBlock V244).
- ✅ **Nhất quán chéo docs** về seat (= ACTIVE STUDENT), finance (OWNER-only), ma trận provisioning top-down — không mâu thuẫn; các entity/migration khớp `b2b-model.md`.

---

## 7. Chủ đề xuyên suốt (root causes)

1. **Bảo vệ OWNER không nhất quán giữa các đường mutation membership** — `selfLeave`/`changeRole` chặn OWNER, nhưng `removeMember/deactivate` (MANAGER với tới được) thì không → vừa là vector chiếm tenant (C-2) vừa là bug org-mồ-côi (H-5). Một guard thiếu = hai lỗi.
2. **Cổng và tính-phí token-pool bị tách rời + không atomic** — gate đọc `org_monthly_token_counters` lúc vào, charge (nếu có) chạy sau LLM; 3 tính năng đắt nhất không charge; charge theo `users.org_id`, gate theo `org_members`. → cap COGS/tenant **không giữ**.
3. **Bề mặt public rò tồn-tại tài khoản/tenant + thiếu rate-limit** — `preview()` là oracle (M-2) chính là tiền đề khiến C-1 tất định; toàn bộ `/api/public/**` không throttle.
4. **Drift sau migration ở tầng đọc + comment** — Javadoc còn `ADMIN`/`0-6`; nguy hiểm nhất là skill report trộn thang 0–100/0–10 (H-4) tái sinh đúng lỗi V232 đã dọn ở DB.
5. **Hai cây frontend B2B song song** — legacy + v2 đều reachable, cùng data, gating lệch (legacy lộ billing cho MANAGER) → gấp đôi bề mặt bảo trì/bảo mật.

---

## 8. Kế hoạch khắc phục (ưu tiên)

### P0 — Chặn launch (vá trước khi onboard khách B2B)
1. `OrgInvitationService.accept()`: nhánh tài khoản có sẵn **ngừng cấp phiên bằng token đơn thuần**; bắt xác thực (mật khẩu / mã email) trước `upsertMember`. **(C-1)**
2. `OrgInvitationService.preview()`: ngừng trả `requiresRegistration` cho caller chưa xác thực; giảm field lộ ra. **(C-1/M-2)**
3. Thêm guard OWNER vào `deactivate()/removeMember()` (mirror `selfLeave/changeRole`) HOẶC gác `DELETE /members/{userId}` bằng `assertOrgOwner`. **(C-2)**
4. Thêm guard "last owner" — org không bao giờ về 0 OWNER. **(H-5)**
5. Thêm test hồi quy: accept tài khoản có sẵn không mint phiên; MANAGER xoá OWNER bị từ chối.

### P1 — Toàn vẹn doanh thu & đúng đắn (trước khi scale org trả phí)
6. Pool **reserve-then-reconcile**: trừ ước lượng vào counter **trước** LLM, chốt sau (đóng TOCTOU H-3).
7. Nối charge pool cho **sinh ảnh (H-1), PPTX (H-2), Whisper STT (M-3)**; thêm `org_id` vào `stt_usage_events` (migration mới, M-4).
8. Sửa `skillReport()`: chuẩn hoá fallback 0–100 về 0–10 trước khi chấm; thêm test. **(H-4)**
9. Sửa bypass seat khi reactivation: chạy `SELECT FOR UPDATE` seat check cả khi flip membership STUDENT non-ACTIVE → ACTIVE. **(M-1)**
10. Triển khai endpoint **transfer/promote-to-OWNER** để xoá OWNER có đường khôi phục. **(H-5)**

### P2 — Phòng thủ nhiều lớp & nhất quán
11. Thêm URL matcher tường minh trong `SecurityConfig`: `/api/admin/**`→`hasRole('ADMIN')`, `/api/org/**`→authenticated (backstop cho `@PreAuthorize`). **(M-10)**
12. Rate-limit toàn bộ `/api/public/**`; làm `preview()` read-only (chuyển EXPIRED sang sweep). **(M-2/L-5)**
13. Hợp nhất nguồn sự thật ledger AI: charge & gate cùng đọc `org_members(ACTIVE)`, hoặc assert invariant `users.org_id == org_members(ACTIVE)` lúc ghi. **(M-5)**
14. Co-brand cert lấy từ `org_id` đã stamp của lớp; xác nhận tập role được cấp cert (TEACHER vs MANAGER/OWNER). **(M-7)**
15. Sửa query CEFR/activeStudents7d lọc theo `org_members` STUDENT thay vì mọi org user. **(M-6)**
16. Validate `amountVnd > 0` + state machine hoá đơn forward-only + gộp manual-PAID và webhook qua một `settleAndActivate()`. **(M-14/M-15/M-16)**

### P3 — Nợ kỹ thuật & hoàn thiện
17. Redirect legacy `/org` + `/admin/organizations` → v2 (next.config + hợp nhất `roleHome/v2RoleHome`), rồi xoá cây legacy; tối thiểu thêm guard OWNER-only cho legacy billing. **(M-11/M-12/M-13)**
18. Xoá dead `orgApi.activateEntitlements` (L-8); harden roster CSV (BOM/quote, L-3); fix TZ `Asia/Ho_Chi_Minh` trong ClassScheduleService (M-9) + test lịch CN (L-6).
19. Quét sạch Javadoc drift (`ADMIN`/`0-6`) (L-1/L-11/L-12); thêm token rotation cho invite PENDING (L-2); audit trail cho manual invoice status (L-10).
20. Đánh dấu trạng thái `SPEC_OWNER_HR_PAYROLL_V1` là DRAFT/CHƯA-CODE; xây G-3 4 endpoint còn thiếu (roster/gradebook/lesson-logs/teachers-classes) nếu muốn giữ lời hứa supervision. **(H-6/M-17)**; reconcile role-interaction-audit (G-1/G-2 đã vá). **(M-18)**

---

## 9. Khoảng trống cần theo dõi (follow-up)

- **Xác minh runtime prod:** C-1, C-2, và các đường overspend pool mới chỉ confirm qua đọc code — nên tái hiện end-to-end trên staging với token/account thật.
- **Trạng thái deploy prod:** chưa diff build prod hiện tại với cây source đã audit — xác nhận không có hotfix nào đã vá sẵn trước khi lên lịch remediation.
- **Xoá dữ liệu org / GDPR:** khi xoá member/org, cascade (hay orphan) messages, ledger, certificates, shared reports, media chéo tenant chưa được kiểm (liên quan lịch sử FK delete-account).
- **Roster import ở quy mô lớn:** import CSV rất lớn giữ `SELECT FOR UPDATE` trên org row suốt vòng lặp = câu hỏi lock-duration/DoS chưa audit.
- **Class-channel/messaging abuse:** WordFilter/UserBlock (V244) + Expo-push broadcast chưa test đối kháng moderation-bypass / push chéo tenant.
- **Test coverage:** chưa có test hồi quy cho lịch CN (=7), bypass seat reactivation, accept-invite tài khoản có sẵn, các đường charge pool.

---

*Báo cáo tạo bởi audit đa tác nhân (9 trục · 48 agents · phản biện đối kháng từng finding). File nguồn kết quả: `.claude/.../tasks/wwhwcpoxz.output`.*
