# DEUTSCHFLOW — KẾ HOẠCH SỬA LỖI (tổng hợp từ test E2E 2026-06-24)

> Tổng hợp toàn bộ phát hiện từ 8 báo cáo test trong `qa/` thành **một danh sách hành động** để chạy bên **Claude Code**.
> Nguồn chi tiết: `RESULTS_*` + `RUNBOOK_FULL_E2E.md` cùng thư mục.

## CÁCH DÙNG VỚI CLAUDE CODE
- Mở repo trong Claude Code, làm **từ trên xuống theo độ ưu tiên** (P0 → P2).
- Mỗi mục có: **Triệu chứng → Repro → File → Hướng sửa → Tiêu chí nghiệm thu**. Đường dẫn file là tương đối gốc repo.
- Sau mỗi fix, chạy lại Repro tương ứng (gọi API bằng tài khoản test) để xác nhận đạt "nghiệm thu".
- Quy ước: 🟠 Cao · 🟡 TB · ⚪ Thấp · Công: S(giờ)/M(ngày).

---

## BẢNG ƯU TIÊN
| ID | Mức | Công | Vùng | Tóm tắt |
|---|---|---|---|---|
| **MON-1** | 🟠 | M | quota | Plan admin cấp rớt về DEFAULT sau 1 lần dùng AI |
| **TF-1** | 🟠 | M | quota | INTERNAL/"unlimited" hiển thị ≠ enforcement org-pool (429) |
| **F-2** | 🟡 | S | auth | `refreshToken` lộ trong body login/`/me` |
| **MUT-1** | 🟡 | S | schedule | `dayOfWeek` 0–6 (0=T2), value 7→400, lệch ISO |
| **F-1** | 🟡 | S | schedule | 500 thay vì 400 khi param ngày sai định dạng |
| **U-1** | 🟡 | M | FE | Guard sai-role "mềm" trên `/v2/*` |
| **U-2** | 🟡 | S | FE | Thông báo lỗi lộ path API cho người dùng |
| **TF-2** | 🟡 | S | teacher | `/assignments/{id}/evaluate` nhận submissionId nhưng đặt tên assignmentId |
| **TF2-1** | 🟡 | S | teacher | Co-teacher add không kiểm org-membership |
| **PRON** | 🟡 | S | speaking | pronunciation-check 500 khi thiếu audio (nên 400) |
| **SCH-1** | ⚪ | S | schedule | room không lưu khi PATCH kèm status=CANCELLED |
| **SCH-2** | ⚪ | S | schedule | defaultRoom pattern không xuống session sinh tự động |
| **F-3** | ⚪ | S | common | Hình lỗi không nhất quán (Spring default vs RFC7807) |
| **TF2-2** | ⚪ | S | common | Mã trạng thái tạo không nhất quán (200/201/204) |
| **U-4/TF-3** | ⚪ | S | FE | Bounce sai-role không nhất quán; wording "Session compromised" |

---

## P0 — 🟠 CAO

### MON-1 — Plan admin cấp KHÔNG bền (rớt DEFAULT sau 1 lần dùng AI)
**Triệu chứng:** admin `PATCH /api/admin/users/{id}/plan {planCode:PRO, monthlyTokenLimitOverride}` → runtime honor PRO ngay, nhưng **sau lượt AI đầu tiên**, quota rớt về `DEFAULT/NONE`, `subscriptionEndsAtUtc=null` → lượt 2 trả **429**.
**Repro:** cấp PRO cho user 58 → `GET /api/ai-speaking/quota` (PRO/200000) → 1 lượt `POST /sessions/{id}/chat` (200) → `GET /api/admin/users/58/quota` ⇒ planCode=DEFAULT.
**File:**
- `backend/.../common/quota/SubscriptionReconcileJob.java` ← nghi chính: reconcile vô hiệu hoá subscription override.
- `backend/.../admin/service/AdminManagementService.java` (`updateUserPlan`) — kiểm bản ghi subscription tạo ra có `endsAtUtc` được lưu không.
- `backend/.../common/quota/QuotaService.java` (resolve plan/subscription).
**Hướng sửa:** `updateUserPlan` phải tạo subscription **hợp lệ & bền** (lưu đúng `startsAt/endsAt`, đúng cờ override); reconcile job **không được hạ** một subscription override còn hạn. Thêm test: cấp PRO → dùng AI 3 lượt → vẫn PRO.
**Nghiệm thu:** sau 3 lượt chat liên tiếp, `GET /api/admin/users/{id}/quota` vẫn `PRO`, không 429.

### TF-1 — Hiển thị "không giới hạn" ≠ enforcement (org-pool 429)
**Triệu chứng:** `GET /api/admin/users/62/quota` → `INTERNAL_UNLIMITED, remaining 999,999,999`; nhưng thao tác AI tính theo **org-pool** (ai-grade, mock-exam, speaking org) trả **429 "Tổ chức đã dùng hết ngân sách"**. Org dashboard cũng ghi "pool không giới hạn" trong khi member bị chặn.
**Repro:** đăng nhập testgv03 → `POST /api/v2/teacher/grading/submissions/{id}/ai-grade` ⇒ 429; nhưng admin-panel & `/v2/org` hiển thị unlimited.
**File:**
- `backend/.../common/quota/QuotaService.java`, `OrgPoolGuard`(trong quota), `OrgQuotaService` (org) — hai đường resolve gói/“unlimited”.
- `backend/.../admin/service/AdminManagementService.java` (`userQuota`) — nguồn hiển thị admin.
- FE: `frontend/src/app/v2/org/page.tsx` (chip "pool không giới hạn").
**Hướng sửa:** thống nhất **một nguồn sự thật** cho quota/unlimited. Nếu org `poolUnlimited=true` thì enforcement org-pool phải honor (không 429); nếu không honor thì **không hiển thị "không giới hạn"**. Đảm bảo cờ `unlimitedInternal`/`poolUnlimited` đi xuyên suốt cả hiển thị lẫn enforcement.
**Nghiệm thu:** với user/org thật sự unlimited, ai-grade/mock-exam **không 429**; nếu hết ngân sách thì admin-panel & dashboard **không** ghi "không giới hạn".

---

## P1 — 🟡 TRUNG BÌNH

### F-2 — `refreshToken` lộ trong body
**Triệu chứng:** `POST /api/auth/login` và `GET /api/auth/me` trả `refreshToken` trong JSON (ngoài httpOnly cookie).
**File:** `backend/.../user/dto/AuthResponse.java`, `user/service/AuthService.java`, `user/controller/AuthController.java`.
**Hướng sửa:** bỏ `refreshToken` khỏi `AuthResponse` body; chỉ set qua httpOnly cookie (refresh đã dùng cookie). Kiểm FE không đọc `refreshToken` từ body.
**Nghiệm thu:** body login/`/me` không còn field `refreshToken`; luồng refresh vẫn chạy.

### MUT-1 — Quy ước `dayOfWeek` 0–6 lệch ISO + value 7 lỗi
**Triệu chứng:** pattern `dayOfWeek=3`→Thứ 5, `=5`→Thứ 7, **`=7`→400**. Convention 0=Thứ 2…6=CN, khác ISO (Mon=1..Sun=7) → dễ lệch 1 ngày / lỗi khi chọn CN.
**File:** `backend/.../teacher/dto/UpsertPatternRequest.java`, `teacher/service/ClassScheduleService.java` (sinh buổi từ dayOfWeek), FE form chọn thứ trong `frontend/src/app/v2/.../schedule`.
**Hướng sửa:** chọn **một convention** (khuyến nghị ISO 1–7) và áp đồng bộ BE↔FE; validate range rõ ràng (trả 400 có message "dayOfWeek 1–7"); map đúng sang `java.time.DayOfWeek`.
**Nghiệm thu:** chọn từng thứ ở FE sinh đúng ngày; giá trị ngoài range trả 400 có message rõ.

### F-1 — 500 thay vì 400 khi param ngày sai
**Triệu chứng:** `GET /api/org/schedule/week?from=2026-06-22` (date-only) → **500 ERR-x**; đúng `...T00:00:00` → 200. Cùng lỗi ở `/api/v2/teacher/class-schedule/week`.
**File:** `backend/.../teacher/controller/ClassScheduleController.java` (`@DateTimeFormat ISO.DATE_TIME`), `common/exception/GlobalExceptionHandler.java`.
**Hướng sửa:** bắt lỗi parse tham số (`MethodArgumentTypeMismatchException`) → trả **400** với message hướng dẫn định dạng; hoặc chấp nhận cả date-only.
**Nghiệm thu:** param sai định dạng → 400 (không 500).

### U-1 — Guard sai-role "mềm" trên `/v2/*`
**Triệu chứng:** ADMIN mở được shell `/v2/org`, `/v2/teacher` (render giao diện role khác) thay vì bị bật về `/v2/admin/users`. Dữ liệu vẫn an toàn (BE 403) nhưng UX sai.
**File:** `frontend/src/middleware.ts` (hàm `v2RoleHome`, nhánh kiểm role cho `/v2/*`).
**Hướng sửa:** middleware chặn truy cập surface không khớp role → redirect về `v2RoleHome(role)` nhất quán (giống nhánh đã làm cho route legacy `/student`).
**Nghiệm thu:** mỗi role chỉ vào được `/v2/<role>/*`; sai role → bị đẩy về home đúng.

### U-2 — Lỗi lộ path/method API ra người dùng
**Triệu chứng:** màn lỗi hiện "Forbidden `GET /api/v2/teacher/classes`", "`GET /api/org`".
**File:** các trang `frontend/src/app/v2/org/*` và `v2/teacher/*` (component error state — grep "GET /api" / "Forbidden").
**Hướng sửa:** thay bằng message thân thiện ("Bạn không có quyền…/Chưa thuộc tổ chức"), không in path/method API.
**Nghiệm thu:** không còn chuỗi `GET /api/...` trên UI.

### TF-2 — `/assignments/{assignmentId}/evaluate` thực ra nhận submissionId
**Triệu chứng:** truyền id lớp-bài → 409 "Học viên không thuộc lớp của bạn"; phải truyền **StudentAssignment id** mới đúng.
**File:** `backend/.../teacher/controller/TeacherController.java` (`evaluateAssignment`), service tương ứng.
**Hướng sửa:** đổi tên path param thành `{submissionId}` (hoặc nhận đúng assignmentId rồi tự tra submission của lớp); cập nhật FE gọi đúng. Sửa message lỗi cho khớp nguyên nhân.
**Nghiệm thu:** chấm bằng id rõ nghĩa; message lỗi đúng khi sai.

### TF2-1 — Co-teacher add không kiểm org-membership
**Triệu chứng:** thêm GV **không thuộc org** vào lớp của org vẫn thành công (chỉ kiểm role TEACHER/ADMIN).
**File:** `backend/.../teacher/service/TeacherService.java` (`addCoTeacher`, ~dòng 310).
**Hướng sửa:** nếu yêu cầu cách-ly tenant → thêm kiểm co-teacher cùng org. Nếu chủ ý (marketplace) → giữ nhưng ghi rõ + log + giới hạn quyền co-teacher ngoài org.
**Nghiệm thu:** theo quyết định sản phẩm; có test cho hành vi đã chọn.

### PRON — pronunciation-check 500 khi thiếu audio
**Triệu chứng:** `POST /api/speaking/pronunciation-check` với body text-only → **500 ERR-x**.
**File:** `backend/.../speaking/controller/PronunciationController.java` + service.
**Hướng sửa:** validate input (cần audio/đúng field) → trả **400** message rõ thay vì 500.
**Nghiệm thu:** thiếu/sai input → 400.

---

## P2 — ⚪ THẤP (gom làm 1 đợt dọn)
- **SCH-1:** PATCH session kèm `status:CANCELLED` làm mất `room` → quyết định giữ room khi huỷ (sửa `ClassScheduleService.updateSession`).
- **SCH-2:** `defaultRoom` của pattern không xuống `room` buổi sinh tự động → đổ defaultRoom khi generate (`ClassScheduleService`).
- **F-3:** chuẩn hoá toàn bộ lỗi về RFC7807 — `/api/v2/teacher/*` còn trả shape Spring mặc định; xem `GlobalExceptionHandler` có phủ security 403 của module v2 không.
- **TF2-2:** chuẩn hoá mã trạng thái REST (tạo → 201, xoá → 204) trên các controller teacher.
- **U-4/TF-3:** bounce sai-role nhất quán; đổi wording "Session compromised" thành "Phiên đã hết hạn, đăng nhập lại".
- **grammar/validate** trả 400 với body chưa rõ field — bổ sung message validation; **presigned-url** (`/api/v2/students/assignments/presigned-url`) trả 400 — tài liệu hoá tham số bắt buộc (`filename`,`contentType`).

---

## ĐÃ VERIFY OK — ĐỪNG "SỬA" (tránh hồi quy)
Auth 6 role; ma trận phân quyền (admin/org/teacher/student/public) đúng; cross-tenant & leo-quyền bị chặn (403/401); gate token AI hoạt động; **ledger ghi đúng** (1 lượt chat = 2433 token); rate-limit (429 sau 5 lần); FSRS SRS; onboarding→plan; mock-exam start/finish; TTS; interview; **auto-demote** khi remove member; join-request approve/reject; chấm bài tay; lessons/lesson-log CRUD; schedule pattern/session CRUD; owner role-change; admin invoice; messaging 2 chiều; register/forgot-password; free-grade ẩn danh.

## CLEANUP (môi trường test, không phải fix code)
Xoá lớp test `6,7,8,9,10` (`DELETE /api/v2/teacher/classes/{id}`); invoice #1 / account `zztest_*` / usage ledger không có endpoint xoá (đã gắn nhãn).
