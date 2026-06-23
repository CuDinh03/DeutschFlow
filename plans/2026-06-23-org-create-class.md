# Org-admin tạo lớp cho trung tâm (G-3 follow-up)

**Ngày:** 2026-06-23
**Loại:** feat (org B2B) — endpoint mới + service + DTO + modal FE + test.
**Bối cảnh:** nối tiếp G-3 (lịch dạy center-wide cho OWNER/MANAGER, commit `1a713620`). Sau khi
org-admin xem được lịch + danh sách lớp, bước thiếu là **tự tạo lớp** thay vì chỉ chờ giáo viên tạo.

**File chạm tới:**
- Backend: `controller/OrgController.java`, `service/OrgService.java`, `dto/CreateClassRequest.java` (mới)
- Test BE: `service/OrgServiceTest.java`, `service/OrgServiceDetailTest.java`, `controller/OrgControllerTest.java` (mới)
- Frontend: `app/v2/org/classes/page.tsx`, `app/v2/org/classes/CreateClassModal.tsx` (mới), `lib/orgApi.ts`

---

## Yêu cầu

1. OWNER/MANAGER của trung tâm tạo được lớp ngay trong `/v2/org/classes` (trước đây nút "Tạo lớp"
   chỉ toast "sắp ra mắt").
2. Lớp phải thuộc đúng org của người tạo và có giáo viên phụ trách.
3. Không cho gán giáo viên thuộc org khác (chống IDOR).

## Ràng buộc dữ liệu (vì sao teacherId bắt buộc)

- `teacher_classes.teacher_id` là **NOT NULL** → mỗi lớp phải có một giáo viên phụ trách ngay khi tạo.
- Mô hình quyền sở hữu/đồng giảng dạy dùng bảng `class_teachers` (role `PRIMARY`/...). Luồng giáo viên
  tự tạo lớp đã ghi một `class_teachers` PRIMARY; org-admin tạo lớp phải làm **giống hệt** để các truy
  vấn quyền hoạt động đồng nhất.

## Thay đổi đã thực hiện

### 1. Backend — endpoint + service
- **`POST /api/org/classes`** (`OrgController.createClass`): lấy `orgId` từ principal (`requireOrgId`),
  gọi `orgGuard.assertOrgAdmin(userId, orgId)` **trước** service, rồi `orgService.createClass(...)`.
  Body validate bằng `@Valid`.
- **`CreateClassRequest`** (record DTO): `name` `@NotBlank` + `@Size(max = 120)`; `teacherId` `@NotNull`.
- **`OrgService.createClass(orgId, name, teacherId)`** (`@Transactional`):
  - Re-validate `name`/`teacherId` (defense-in-depth, service có thể được gọi ngoài controller) →
    `BadRequestException` nếu rỗng/null.
  - Verify `teacherId` là **TEACHER ACTIVE của chính org** qua `memberRepo.findByIdOrgIdAndIdUserId`
    + filter `STATUS_ACTIVE` & `ROLE_TEACHER` → nếu không khớp ném `BadRequestException` (chống IDOR:
    không gán được giáo viên org khác, kể cả MANAGER hay giáo viên đã rời).
  - Lưu `TeacherClass` (stamp `orgId`, `name` đã trim, `inviteCode` = 8 ký tự UUID hoa).
  - Lưu `ClassTeacher` PRIMARY `(classId, teacherId)`.
  - Trả `OrgClassDto`.

### 2. Frontend — modal + wiring
- **`createOrgClass(body)`** trong `orgApi.ts`: `POST /org/classes`.
- **`CreateClassModal.tsx`** (mới): form Tên lớp + dropdown Giáo viên phụ trách.
  - Nạp giáo viên qua `listMembers('TEACHER')`, lọc `status === 'ACTIVE'`.
  - Auto-chọn nếu org chỉ có 1 giáo viên.
  - Nếu org **chưa có giáo viên** → chặn tạo + hướng dẫn "thêm giáo viên trước rồi mới tạo lớp".
  - Validate client (tên rỗng / chưa chọn GV), `maxLength=120`, toast thành công, gọi `onCreated()` reload.
- **`classes/page.tsx`**: nút "Tạo lớp" mở `CreateClassModal` (thay cho toast "sắp ra mắt");
  `onCreated` → `load()` refresh danh sách. Cập nhật comment đầu file (bỏ ghi chú "zero backend" cũ).

## Bảo mật / RBAC

- **AuthZ:** chỉ OWNER/MANAGER (qua `assertOrgAdmin`, kiểm `ADMIN_ROLES`). Non-admin → 403, service KHÔNG chạy.
- **IDOR:** `orgId` luôn lấy từ principal, không tin path/body; giáo viên verify từ `org_members` của chính org.
- **Validation:** 2 lớp — bean validation ở DTO (400 tại binding) + check lại trong service (`BadRequestException`).

## Test

**`OrgServiceTest`** (6 unit mới):
- gán GV hợp lệ → lưu lớp + `class_teachers` PRIMARY, stamp org, trim tên, inviteCode 8 ký tự.
- GV không thuộc org → BadRequest, không chạm DB.
- thành viên không phải TEACHER (vd MANAGER) → BadRequest.
- GV đã rời (status != ACTIVE) → BadRequest.
- tên trống → BadRequest, không chạm DB.
- teacherId null → BadRequest, không chạm DB.

**`OrgControllerTest`** (4 MockMvc standalone mới) — phủ phần service-test không chạm tới:
- org-admin hợp lệ → 200 + lớp vừa tạo.
- guard ném Forbidden → 403, service KHÔNG được gọi (chốt RBAC ở handler).
- tên trống → 400 (`@NotBlank`); teacherId null → 400 (`@NotNull`); tên > 120 → 400 (`@Size`).

**`OrgServiceDetailTest`**: thêm mock `ClassTeacherRepository` vào constructor `OrgService` (thay đổi chữ ký).

## Verify

- [x] **BE unit (2026-06-23):** `./mvnw test -Dtest='OrgServiceTest,OrgControllerTest,OrgServiceDetailTest'`
  → **21 test xanh** (OrgServiceTest 9 / OrgControllerTest 5 / OrgServiceDetailTest 7), 0 fail/error.
  (Lọc theo class vì là unit Mockito/standalone MockMvc — không cần DB, né Testcontainers vốn hỏng local.)
- [x] **FE (2026-06-23):** `tsc --noEmit` exit 0 + `eslint` 4 file đổi exit 0.
- [ ] **Smoke (chưa chạy — cần stack chạy):** đăng nhập org OWNER → `/v2/org/classes` → Tạo lớp →
  chọn GV → lớp xuất hiện trong danh sách.
- [ ] **IT đầy đủ (khi tách nhánh):** `./mvnw -B test` toàn bộ — local Testcontainers BROKEN, dùng external
  pgvector + `DEUTSCHFLOW_IT_JDBC_URL` + `TZ=UTC`.

## Ghi chú phạm vi

- Là **công việc riêng**, độc lập với session dọn `nav.ts` (teacher-nav-cleanup) — không đụng file nhau,
  **commit tách 2 nhánh được**.
- Option-1 (giữ tối giản): `OrgClass` DTO chưa có teacher NAME / level / sĩ số / điểm TB nên cột tương ứng
  trong proto bị bỏ; modal chỉ gồm tên + giáo viên phụ trách.
