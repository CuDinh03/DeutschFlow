# KẾT QUẢ TEST (phần 2) — reject join · co-teacher · nội dung giảng dạy · lesson-log

> Chạy: 2026-06-24 · org df-center (7) · TEACHER testgv03 / STUDENT test01 · API thật.
> Tất cả PASS. 1 quan sát đáng lưu ý: **co-teacher add không kiểm tra org-membership** (cho phép GV ngoài org vào lớp).

---

## 1. Reject join-request (PASS)

Lớp test `ZZ_TEST_REJECT` (id 8).

| Bước | KQ |
|---|:--:|
| Student nhập mã → join | ✅ 200 (request id 4, PENDING) |
| Teacher **reject** `POST .../join-requests/4/reject` | ✅ 200 |
| Pending sau reject | ✅ 0 |
| Roster sau reject | ✅ 0 — **test01 KHÔNG được thêm** (đúng) |

---

## 2. Co-teacher add / remove (PASS) — + 1 quan sát

Lớp 6.

| Bước | Endpoint | KQ |
|---|---|:--:|
| Email rỗng | `POST /classes/6/teachers {email:""}` | ✅ 400 "Email không được để trống" |
| Thêm **STUDENT** làm GV | `... {email:test01}` | ✅ 400 "Người dùng này không có vai trò giáo viên" |
| Thêm co-teacher testgv02 | `... {email:testgv02}` | ✅ 200 — vai trò ASSISTANT (primary giữ PRIMARY) |
| List | `GET /classes/6/teachers` | ✅ 2 GV: gv2 PRIMARY, gva ASSISTANT |
| **Remove** | `DELETE /classes/6/teachers/59` | ✅ 200 → còn 1 |

**Quan sát TF2-1:** `addCoTeacher` chỉ kiểm **role = TEACHER/ADMIN**, **không kiểm org-membership**. testgv02 (không thuộc org 7) vẫn được thêm vào lớp org 7 → GV ngoài tổ chức có quyền truy cập dữ liệu lớp của org. Có thể **chủ ý** (teacher marketplace) nhưng cần xác nhận về mặt cách-ly tenant. Mức: 🟡 verify.

---

## 3. Nội dung giảng dạy — lessons CRUD + reorder (PASS)

Lớp 6.

| Bước | Endpoint | KQ |
|---|---|:--:|
| Tạo 2 bài | `POST /classes/6/lessons {title,description}` | ✅ 200 ×2 (id 3, 4) |
| Liệt kê | `GET /classes/6/lessons` | ✅ order 0,1 |
| Sửa + đánh dấu xong | `PATCH /lessons/3 {title,completed:true}` | ✅ 200, completed=true, đổi tên OK |
| **Đổi thứ tự** | `POST /lessons/reorder {orderedLessonIds:[4,3]}` | ✅ 200 — thứ tự đảo đúng [4,3] |
| Xoá | `DELETE /lessons/4` | ✅ 204 → còn 1 |

---

## 4. Lesson-log (nhật ký buổi dạy) CRUD + điểm danh (PASS)

Lớp 6.

| Bước | Endpoint | KQ |
|---|---|:--:|
| Tạo log + điểm danh test01 PRESENT | `POST /classes/6/lesson-logs` | ✅ 201 (logId 1, attendance 1) |
| Liệt kê | `GET /classes/6/lesson-logs` | ✅ 1 log, có điểm danh |
| Sửa (đổi topic + status LATE) | `PUT /lesson-logs/1` | ✅ 200, topic="ZZ Begrüßung (updated)" |
| Xoá | `DELETE /lesson-logs/1` | ✅ 204 → còn 0 |

---

## 5. Phát hiện / quan sát

| ID | Vấn đề | Mức độ |
|---|---|---|
| TF2-1 | **Co-teacher add không kiểm org-membership** — GV ngoài org được thêm vào lớp org (cross-org access). Xác nhận có phải chủ ý (marketplace) không. | 🟡 verify |
| TF2-2 | **Mã trạng thái tạo không nhất quán**: tạo lesson → 200, tạo lesson-log → 201, tạo class/assignment → 200; xoá lesson/lesson-log → 204, các xoá khác → 200. Nhỏ, nên chuẩn hoá REST. | ⚪ |

---

## 6. Tổng dữ liệu test còn lại (org df-center) — cần cleanup

| Loại | ID |
|---|---|
| Lớp | **6** (ZZ_TEST_AUTO — 28 buổi, roster test01, assignment 10/11, submission 25/26, lesson id3), **7** (ZZ_TEST_JOIN), **8** (ZZ_TEST_REJECT) |

Xoá: `DELETE /api/v2/teacher/classes/6` `/7` `/8`. **Chưa xoá — chờ xác nhận.**
