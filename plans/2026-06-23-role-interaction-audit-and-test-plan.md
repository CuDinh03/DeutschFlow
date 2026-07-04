# DeutschFlow — Kế hoạch kiểm tra luồng tương tác giữa các Role + Báo cáo

> Ngày: 2026-06-23 · Phạm vi: Teacher · Manager · Owner · Student (+ Admin nền tảng để đối chiếu)
> Mục tiêu: map toàn bộ luồng phân quyền/tương tác, tìm gap, viết test cases. **Không implement.**

---

## 0. TL;DR — Phát hiện chính

| # | Mức | Khu vực | Tóm tắt |
|---|-----|---------|---------|
| G-1 | ~~HIGH~~ ✅ **ĐÃ VÁ** (audit M-18) | Student → Teacher session | `POST /api/teacher-sessions` (bookSession) **không chặn org-teacher**. **FIX ĐÃ CÓ trong code:** `TeacherSessionService.bookSession` giờ ném Forbidden khi `profile.getUser().getOrgId() != null`. (Doc này viết trước khi fix land; test case H2 "hiện tại 200 (BUG)" giờ SAI — kỳ vọng 403.) |
| G-2 | ~~MEDIUM~~ ✅ **ĐÃ VÁ** (audit M-18) | Class join | `POST /api/classes/join` (legacy) **không có `@PreAuthorize`**. **FIX ĐÃ CÓ trong code:** `ClassController` join giờ gắn `@PreAuthorize("hasRole('STUDENT')")` (comment "G-2:"). Test case E3 kỳ vọng 200-BUG giờ SAI — kỳ vọng 403 cho non-student. |
| G-3 | **MEDIUM (product — ĐÃ QUYẾT ĐỊNH)** | Manager/Owner ↔ Teacher data | Toàn bộ `/api/v2/teacher/**` gate cứng `hasRole('TEACHER')` → MANAGER/OWNER không xem được roster/gradebook/lịch lớp. **Quyết định 2026-06-23: CÓ cho xem — read-only, org-scoped, cả OWNER+MANAGER, qua endpoint `/api/org/**` MỚI (KHÔNG nới `hasRole('TEACHER')`). Finance vẫn OWNER-only.** Chi tiết §4. |
| G-4 | **LOW** | Teacher AI tool | `POST /api/v2/teacher/grading/grade-image` chỉ check quota, **không nhận classId/studentId** → không phải IDOR (không đọc/ghi dữ liệu học viên khác) nhưng là tool stateless không ràng buộc ngữ cảnh; tiêu quota org-pool tự do. |
| G-5 | **LOW** | Middleware FE | Nếu thiếu cả `JWT_SECRET` + `JWT_RSA_PUBLIC_KEY`, gating `/v2/*` **tắt hoàn toàn** (degrade gracefully). Chấp nhận được vì backend authz là lưới an toàn, nhưng cần giám sát env lúc deploy. |
| OK | — | Org IDOR | **Không** có cross-org IDOR ở `/api/org/**`: `orgId` luôn lấy từ principal, mọi guard re-verify `org_members` trong DB. `break-glass` admin nhận orgId từ client nhưng có verify membership → an toàn. |
| OK | — | Teacher↔Student IDOR | Hầu hết endpoint teacher có `assertTeacherOwnsClass` / share-class check; student có `assertEnrolled` + `findByStudentIdAndAssignmentId`. Coverage tốt. |

---

## 1. Hệ thống Role hiện tại (đã đọc code)

### 1.1 Hai tầng phân quyền

**Tầng A — Platform role** (`users.role`, enum `User.Role`):
`STUDENT · TEACHER · MANAGER · OWNER · ADMIN`
- Đẩy vào JWT → `GrantedAuthority = ROLE_<role>` → dùng cho `@PreAuthorize("hasRole(...)")` và FE routing.
- **Quan trọng:** MANAGER/OWNER là danh tính org-admin **độc lập**, **KHÔNG kế thừa** quyền TEACHER (không có role hierarchy) — `User.java:117-123`.

**Tầng B — Org membership** (`org_members`, đọc qua `OrgGuard`):
- `role ∈ {OWNER, MANAGER, TEACHER, STUDENT}`, `status ∈ {ACTIVE, REVOKED, LEFT}`.
- Backend authz org-scoped **luôn re-verify DB**, không tin claim `orgRole` trong JWT (claim chỉ để FE routing) — `OrgGuard.java`.
- `OrgGuard`: `assertMember` (ACTIVE bất kỳ) · `assertOrgAdmin` ({OWNER,MANAGER}) · `assertOrgOwner` (OWNER) · `assertOrgFinance` (**OWNER only**, 2026-06-22).

### 1.2 Security config (`SecurityConfig.java`)
- Stateless JWT Bearer, CSRF off, `@EnableMethodSecurity`.
- Public: auth login/register/refresh/forgot/reset, các webhook payment (HMAC/Apikey-verified), `/api/public/**` (invite token), media GET, onboarding preview GET, `/actuator/health`.
- `anyRequest().authenticated()` — còn lại phải đăng nhập; phân quyền chi tiết qua `@PreAuthorize` ở controller + guard ở service.

### 1.3 FE gating (`frontend/src/middleware.ts`, `nav.ts`)
- Đọc cookie `auth_access` (RS256 prod / HS256 transition); claim `role` + `orgRole`.
- Redirect sau login: ADMIN→`/v2/admin/users` · OWNER/MANAGER→`/v2/org` · TEACHER→`/v2/teacher` · STUDENT→`/v2/student/dashboard`.
- `ownerOnly` nav flag: `org-finance`, `org-billing` chỉ OWNER thấy (MANAGER ẩn) — khớp backend `assertOrgFinance`.
- `/org/accept` public (invite token tự bảo vệ). Learner-shared paths (`/dashboard`,`/speaking`,`/roadmap`,`/news`) mở cho STUDENT|TEACHER|ADMIN.

---

## 2. Ma trận tương tác giữa các Role

### 2.1 Ai TẠO ai / cấp tài khoản

| Hành động | Endpoint | Ai được phép | Guard |
|-----------|----------|--------------|-------|
| Tạo org, gán OWNER, cấp seat | `/api/admin/organizations/**` | **ADMIN** (platform) | `hasRole('ADMIN')` |
| Tạo teacher trực tiếp (có mật khẩu) | `POST /api/org/teachers` | OWNER, MANAGER | check role chuỗi trong controller |
| Mời teacher qua email | `POST /api/org/teachers/invite` | OWNER, MANAGER | `assertOrgAdmin` |
| Import học viên (CSV roster) | `POST /api/org/students/import` | OWNER, MANAGER | `assertOrgAdmin` |
| Chấp nhận lời mời → thành TEACHER org | `POST /api/public/org-invitations/{token}/accept` | Người được mời (token) | token PENDING + TTL 7 ngày; role cố định = TEACHER |
| Student tự đăng ký (B2C) | `POST /api/auth/register` | Công khai | — |

### 2.2 Ai QUẢN LÝ ai

| Hành động | Endpoint | Ai được phép | Guard |
|-----------|----------|--------------|-------|
| Đổi role thành viên (MANAGER↔TEACHER) | `PATCH /api/org/members/{userId}/role` | **OWNER only** | `assertOrgOwner` (đồng bộ `users.role`) |
| Gỡ/thu hồi thành viên (→REVOKED) | `DELETE /api/org/members/{userId}` | OWNER, MANAGER | `assertOrgAdmin` |
| OWNER tự rời org | (selfLeave) | bị chặn — phải chuyển quyền trước | `BadRequestException` |
| Tạo lớp (thành PRIMARY teacher) | `POST /api/v2/teacher/classes` | TEACHER | `hasRole('TEACHER')` |
| Thêm co-teacher (ASSISTANT) | `POST /api/v2/teacher/classes/{id}/teachers` | PRIMARY teacher của lớp | `assertPrimaryTeacher` |
| Duyệt/từ chối join-request | `.../join-requests/{id}/approve|reject` | TEACHER thuộc lớp (PRIMARY/ASSISTANT) | `existsByIdClassIdAndIdTeacherId` |
| Thêm student vào lớp bằng email (không cần duyệt) | `POST /api/v2/teacher/classes/{id}/students` | TEACHER thuộc lớp | ownership check |

### 2.3 Ai XEM được gì (đọc)

| Dữ liệu | OWNER | MANAGER | TEACHER | STUDENT | Cơ chế |
|---------|:-----:|:-------:|:-------:|:-------:|--------|
| Org summary, seats | ✅ | ✅ | ✅(member) | ✅(member) | `assertMember` |
| Org analytics, danh sách lớp/teacher/student | ✅ | ✅ | ❌ | ❌ | `assertOrgAdmin` |
| Hoá đơn / thanh toán / tài chính org | ✅ | ❌ | ❌ | ❌ | `assertOrgFinance` (OWNER) |
| Roster lớp, gradebook, grading-queue, lịch lớp | ❌* | ❌* | ✅(lớp mình) | một phần | `hasRole('TEACHER')` + ownership |
| Bài tập/lesson/điểm trong lớp | — | — | ✅(lớp mình) | ✅(đã enroll) | ownership / `assertEnrolled` |
| Bài nộp & điểm của CHÍNH MÌNH | — | — | — | ✅ | repo query theo `studentId` |
| Roster (tên bạn cùng lớp) | — | — | ✅ | ❌ (chỉ thấy số lượng) | không có endpoint roster cho student |

`*` = G-3: OWNER/MANAGER bị `hasRole('TEACHER')` chặn khỏi dữ liệu vận hành dạy-học.

---

## 3. Các điểm tương tác chính (end-to-end flows)

### F1. Provisioning org (ADMIN → OWNER → MANAGER/TEACHER/STUDENT)
ADMIN tạo org + OWNER → OWNER/MANAGER mời/tạo teacher + import student → invite token → accept → ACTIVE member.
Bất biến: 1 user chỉ ACTIVE staff-role ở **1 org** (`upsertMember` chặn cross-org); `users.org_id` ↔ `org_members` đồng bộ.

### F2. Vòng đời lớp & enroll (TEACHER ↔ STUDENT)
Tạo lớp (PRIMARY + inviteCode) → student `join` (PENDING `ClassroomJoinRequest`) → teacher approve (→ `ClassStudent`, status APPROVED) **hoặc** teacher add bằng email (enroll thẳng). State machine: PENDING→APPROVED|REJECTED.

### F3. Bài tập & chấm điểm (TEACHER → STUDENT → TEACHER)
Teacher tạo `ClassAssignment` → fan-out `StudentAssignment` (PENDING) cho mọi enrolled student → student xin presigned-url (S3, namespaced `assignments/{aid}/{uid}`) → submit (PENDING→SUBMITTED) → teacher chấm tay / AI-grade → EVALUATED. Mọi bước có composite check `findByStudentIdAndAssignmentId`.

### F4. Lesson / attendance / lịch (TEACHER → STUDENT)
`ClassLesson` (CRUD, `assertTeacherOwns`) · `LessonLog` attendance · `ClassSchedule` (pattern + ad-hoc session, V236). Student đọc lessons qua `assertStudentEnrolled`.

### F5. Đánh giá & report
`StudentEvaluation` (4 kỹ năng), comprehensive-report, skill-report, gradebook, overview — tất cả gate `hasRole('TEACHER')` + ownership.

### F6. 1:1 marketplace (STUDENT ↔ TEACHER B2C) — **chứa G-1**
`GET /api/v2/teachers/public` loại org-teacher → student book `POST /api/teacher-sessions` → teacher PATCH status CONFIRM/COMPLETE → student review. Org teacher đặt availability nhưng không publish profile public.

### F7. Thanh toán
- **B2C student**: MoMo/Stripe/Apple → webhook (HMAC/JWS) → `activatePlan` (PRO/ULTRA + token wallet).
- **B2B org**: ADMIN tạo invoice DRAFT (`DFINV...` code) → OWNER xem `/api/org/invoices` + `/api/org/payment-info` (`assertOrgFinance`) → chuyển khoản VietQR → SePay webhook (Apikey, idempotent theo `sepay_id`) match code → invoice PAID → org ACTIVE + re-grant entitlement student (source=ORG). Rời org → revoke ORG-source, giữ web/Apple sub.

---

## 4. Gap & Bug chi tiết

### G-1 (HIGH) — Booking không chặn org-teacher
`TeacherSessionService.bookSession()` (`:36-59`) chỉ `findByIdWithUser(teacherProfileId)`, **thiếu** `if (profile.getUser().getOrgId() != null) throw Forbidden`. Marketplace list & profile GET đã loại org-teacher (trả 404), nhưng booking POST thì không → IDOR theo profileId.
**Fix đề xuất:** thêm org-guard trong `bookSession` (đối xứng với `TeacherMarketplaceController` GET).

### G-2 (MEDIUM) — `/api/classes/join` không gate role
`ClassController.joinClass` (`:24-28`) không `@PreAuthorize`. Mọi authenticated user gửi join-request được (cần teacher duyệt nên impact thấp), nhưng **trùng** `POST /api/v2/student/classes/join` (`hasRole('STUDENT')`). Nên: gate `hasRole('STUDENT')` hoặc deprecate endpoint legacy.

### G-3 (MEDIUM, product) — Manager/Owner xem dữ liệu dạy-học — **QUYẾT ĐỊNH: CÓ**

**Bối cảnh:** `@PreAuthorize("hasRole('TEACHER')")` ở mọi `/api/v2/teacher/**` chặn MANAGER/OWNER (đúng "no hierarchy"). Giám đốc/nhân sự không giám sát được vận hành dạy-học — thiếu feature lõi B2B.

**Quyết định (2026-06-23): CÓ cho OWNER + MANAGER xem, với 3 ràng buộc:**
1. **Read-only** — chỉ đọc; ghi (chấm điểm, tạo bài tập/lesson, điểm danh, sửa lịch) vẫn là đặc quyền TEACHER. Giữ nguyên "MANAGER/OWNER không kế thừa TEACHER".
2. **Org-scoped** — chỉ lớp `org_id == caller.orgId`; không thấy lớp B2C (`org_id IS NULL`) hay org khác.
3. **Finance vẫn OWNER-only** — không đụng `assertOrgFinance`.

**Cách làm ĐÚNG — endpoint org-admin MỚI, KHÔNG nới `hasRole('TEACHER')`:**
> Nới annotation thành `... or hasRole('MANAGER')` **không chạy**: service teacher query theo principal `teacherId` (`getClassesForTeacher(user.getId())` → rỗng; `assertTeacherOwnsClass(managerId, classId)` → 403). Phải scoping theo orgId → làm endpoint riêng sạch hơn.

Khả thi ngay: `TeacherClass.orgId` đã có (V204) + `TeacherClassRepository.findByOrgId(orgId)` đã tồn tại. Đề xuất thêm dưới `/api/org/**`, guard `assertOrgAdmin`, orgId từ principal, mỗi handler verify `targetClass.orgId == caller.orgId`:
```
GET /api/org/classes/{classId}/roster        DS học viên lớp
GET /api/org/classes/{classId}/gradebook      ma trận điểm (read-only)
GET /api/org/classes/{classId}/lesson-logs    điểm danh/buổi học
GET /api/org/schedule/week                     lịch dạy toàn trung tâm (findByOrgId)
GET /api/org/teachers/{teacherId}/classes      lớp của 1 giáo viên trong org
```
FE: thêm vào nav OWNER+MANAGER (không gắn `ownerOnly`). Tái dùng service đọc + DTO đã có.

### G-4 (LOW) — grade-image không ràng buộc ngữ cảnh
`GradingController.gradeImage` (`:116`) nhận `file[,topic]`, không classId/studentId. Là tool OCR+chấm stateless (không đọc/ghi record student khác) → **không phải IDOR**, nhưng tiêu org-pool token tự do, không gắn lớp. Cân nhắc thêm classId (optional) để audit/giới hạn.

### G-5 (LOW) — `/v2/*` gating tắt khi thiếu key
`middleware.ts` degrade gracefully nếu thiếu JWT verifier env → `/v2/*` không gate ở edge (backend authz vẫn chặn). Theo dõi env lúc deploy (đã từng gây sự cố Amplify JWT 06-07).

---

## 5. KẾ HOẠCH KIỂM TRA (Test cases)

> Quy ước kỳ vọng: **200/2xx** = cho phép · **403** = sai role/không sở hữu · **401** = chưa auth · **404** = không thấy/không thuộc phạm vi (dùng thay 403 để chống dò id) · **409** = vi phạm bất biến.
> Seed (từ memory): `admin@local.test` (ADMIN), `teacher@local.test` (org1 OWNER), `student@deutschflow.com` (STUDENT, pw `Admin12345!`), tutor public `tutor.anna/minh@local.test` (org_id NULL). Stack QA: Docker pg/redis + `backend-local`(HS256) + `frontend-localapi`.

### Suite A — Org provisioning & membership (OWNER/MANAGER/ADMIN)
- A1 OWNER tạo teacher `POST /api/org/teachers` → 200; user mới role=TEACHER, createdVia=OWNER, ACTIVE member.
- A2 MANAGER tạo teacher → 200 (cho phép); MANAGER tạo MANAGER → 403/không cho.
- A3 TEACHER gọi `POST /api/org/teachers` → 403.
- A4 STUDENT gọi bất kỳ `/api/org/*admin*` → 403.
- A5 OWNER `PATCH /members/{id}/role` MANAGER→TEACHER → 200, `users.role` đồng bộ. MANAGER gọi cùng endpoint → 403 (`assertOrgOwner`).
- A6 OWNER đổi role của chính OWNER / của STUDENT → bị chặn.
- A7 MANAGER `DELETE /members/{teacherId}` → 200, status=REVOKED; entitlement org bị thu hồi.
- A8 OWNER selfLeave → 400 ("chuyển quyền trước").
- A9 Cross-org: userA của org1 cố thao tác trên member org2 → 403 (orgId lấy từ principal, không nhận client).
- A10 Bất biến 1-org: import/tạo teacher đã ACTIVE ở org khác → 409 conflict.
- A11 CSV import roster (OWNER/MANAGER) → student tạo + (tuỳ chọn) enroll classId; vượt seatLimit → 400.

### Suite B — Org invitation (token public)
- B1 `GET /api/public/org-invitations/{token}` PENDING → 200 preview (org, role=TEACHER, email).
- B2 Accept user mới → tạo User role=TEACHER + ACTIVE member + JWT.
- B3 Token EXPIRED (>7 ngày) / đã ACCEPTED / REVOKED → 4xx, không kích hoạt.
- B4 Token sai/giả → 404.
- B5 Accept khi email đã tồn tại ở org khác (ACTIVE staff) → 409.

### Suite C — Finance OWNER-only (G đối chiếu)
- C1 OWNER `GET /api/org/invoices` & `/payment-info` → 200.
- C2 MANAGER gọi 2 endpoint trên → **403** ("chỉ chủ sở hữu… tài chính").
- C3 TEACHER/STUDENT → 403.
- C4 FE: đăng nhập MANAGER → nav **không** hiện `org-finance`/`org-billing`; truy cập thẳng `/v2/org/billing` → bị bounce/empty.
- C5 SePay webhook: memo chứa `DFINV...` đúng + đủ tiền → invoice PAID + org ACTIVE + re-grant student (source=ORG). Thiếu tiền → reject. Replay cùng `sepay_id` → idempotent (không double).

### Suite D — Org analytics/list + giám sát dạy-học read-only (OWNER+MANAGER) — *gồm G-3*
- D1 OWNER & MANAGER `GET /api/org/analytics|classes|students|members` → 200.
- D2 TEACHER/STUDENT → 403.
- D3 `GET /api/org` + `/seats` cho mọi ACTIVE member → 200; non-member → 403.
- **D4 (G-3)** OWNER & MANAGER đọc endpoint dạy-học mới `GET /api/org/classes/{id}/roster|gradebook|lesson-logs`, `/api/org/schedule/week`, `/api/org/teachers/{tid}/classes` (lớp thuộc org mình) → 200.
- **D5 (G-3)** Cross-org/B2C: đọc `classId` của org khác hoặc lớp `org_id IS NULL` → 403/404 (verify `class.orgId == caller.orgId`).
- **D6 (G-3)** Read-only: thử POST/PATCH/DELETE lên các path `/api/org/classes/.../gradebook|roster|...` → 405/404 (không tồn tại verb ghi).
- **D7 (G-3)** TEACHER/STUDENT gọi các endpoint org dạy-học mới → 403 (`assertOrgAdmin`).
- **D8 (G-3)** Finance vẫn cách ly: MANAGER đọc được gradebook (D4) nhưng `GET /api/org/invoices` → **403** (chứng minh mở dạy-học không rò rỉ tài chính).

### Suite E — Class lifecycle & enroll (TEACHER↔STUDENT)
- E1 TEACHER tạo lớp → PRIMARY + inviteCode; gọi bởi STUDENT → 403.
- E2 STUDENT `POST /api/v2/student/classes/join` đúng code → PENDING request.
- E3 **G-2:** `POST /api/classes/join` gọi bởi MANAGER/OWNER/ADMIN → hiện tại 200 (BUG); kỳ vọng sau fix: 403 hoặc chỉ STUDENT.
- E4 Teacher PRIMARY/ASSISTANT approve → ClassStudent tạo, status APPROVED. Teacher **khác lớp** approve → 403.
- E5 Teacher add student bằng email (không duyệt) → enroll thẳng; teacher khác lớp → 403.
- E6 Co-teaching: chỉ PRIMARY add/remove co-teacher (`assertPrimaryTeacher`); ASSISTANT thử add → 403. ASSISTANT vẫn grade/lesson/approve được.
- E7 Xoá lớp: chỉ PRIMARY; ASSISTANT → 403.

### Suite F — IDOR teacher↔teacher / teacher↔student
- F1 Teacher A đọc roster/gradebook/lessons/schedule lớp của Teacher B → **403** (mọi endpoint `assertTeacherOwnsClass`).
- F2 Teacher A grade assignment/speaking của student không cùng lớp → 403 (share-class check).
- F3 Teacher A `comprehensive-report` student không thuộc lớp A → 403.
- F4 Teacher A `evaluations/{studentId}` student ngoài lớp → 403.
- F5 Bảng quét toàn bộ `/api/v2/teacher/**` với classId/studentId của người khác → tất cả 403/404 (checklist từng endpoint ở §6).

### Suite G — Student self-scope & IDOR
- G1 Student đọc class detail/assignments/lessons lớp **chưa enroll** → 404 (`assertEnrolled`).
- G2 Student xin presigned-url / submit cho assignmentId **không được giao** → 403/404.
- G3 Student đọc submission/điểm của student khác → không có endpoint; chỉ thấy của mình.
- G4 Student xem roster (tên bạn cùng lớp) → chỉ trả `student_count`, không danh sách.
- G5 Submit lại assignment đã SUBMITTED → 409.
- G6 Scenario `GET /assignments/{aid}/scenario` aid không được giao → 404.

### Suite H — 1:1 marketplace & session (chứa G-1)
- H1 `GET /api/v2/teachers/public` → **không** chứa org-teacher; `GET /api/v2/teachers/{orgTeacherId}` → 404.
- H2 **G-1:** student `POST /api/teacher-sessions` với `teacherProfileId` của org-teacher → hiện tại 200 (BUG); kỳ vọng sau fix: 403.
- H3 Student book public tutor hợp lệ → PENDING; teacher PATCH CONFIRM/COMPLETE (chỉ teacher chủ profile); student PATCH sang COMPLETE → 403.
- H4 Student review session không phải của mình → 403 (`session.student == actor`).
- H5 Teacher xem `/teacher-sessions/teacher?profileId=X` / `earnings` profile không sở hữu → 403 (`assertOwnsProfile`).
- H6 Org-teacher set availability `PUT /api/v2/teacher/availability` → 200; publish marketplace profile → 403.

### Suite I — Payment B2C (STUDENT)
- I1 Student create MoMo/Stripe order → payUrl/sessionUrl; PaymentTransaction PENDING.
- I2 Webhook success → activatePlan; sub cũ deactivate; token wallet seed (PRO/ULTRA).
- I3 Webhook chữ ký sai → reject, không activate.
- I4 Apple JWS notification verified → activateWithExplicitEnd (source=APPLE).
- I5 `/api/auth/me/plan` gộp ORG+web+Apple, latest-wins.

### Suite J — FE routing/role gating (Playwright, 4 breakpoint nếu UI)
- J1 Redirect sau login đúng từng role (ADMIN/OWNER/MANAGER/TEACHER/STUDENT).
- J2 STUDENT vào `/v2/teacher|/v2/org|/v2/admin` → bounce. TEACHER vào `/v2/org` → bounce.
- J3 MANAGER vs OWNER: MANAGER không thấy finance/billing nav (C4).
- J4 `/org/accept?token=` reachable khi chưa login.
- J5 Thiếu JWT env (G-5): xác nhận `/v2/*` qua được edge nhưng backend vẫn 403 đúng role.
- J6 Mỗi role có landing index (không 404 trap): ADMIN→/v2/admin/users, v.v.

### Suite K — Regression bất biến nền tảng
- K1 `assertMember` từ chối REVOKED/LEFT member.
- K2 JWT `orgRole` bị giả mạo nhưng `org_members` không ACTIVE → backend vẫn 403 (không tin claim).
- K3 Actuator `/env`,`/metrics`,`/prometheus`(prod),`/api-docs`(prod) → chỉ ADMIN; STUDENT → 403.

---

## 6. Checklist quét IDOR theo endpoint (phụ lục thực thi)
Với mỗi endpoint nhận `{classId|studentId|assignmentId|submissionId|sessionId|userId|orgId}`, chạy ma trận: (a) chủ sở hữu hợp lệ → 2xx; (b) cùng role khác chủ sở hữu → 403/404; (c) role thấp hơn → 403; (d) chưa auth → 401. Nguồn danh sách endpoint: 3 báo cáo Explore (org / teacher / student) — đã liệt kê đầy đủ method+path+guard trong audit.

---

## 7. Thứ tự thực thi đề xuất
1. **Xác nhận product G-3** (Manager/Owner xem dữ liệu dạy-học?) — quyết định này ảnh hưởng phạm vi test Suite F/D.
2. Viết **Suite C/F/G/H** trước (giá trị bảo mật cao nhất; G-1/G-2 nằm đây).
3. Suite A/B/D/E (provisioning & lifecycle).
4. Suite I/J/K (payment, FE, regression).
5. Pattern test backend: plain `@SpringBootTest` RBAC IT (KHÔNG import TestSecurityConfig — gây bean-override halt; xem memory `reference_backend_auth_test_gotcha`); chạy IT qua pgvector ngoài + `DEUTSCHFLOW_IT_JDBC_URL` + `TZ=UTC`.
