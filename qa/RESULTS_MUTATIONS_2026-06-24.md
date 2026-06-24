# KẾT QUẢ TEST MUTATION — lớp/lịch (df-center, org 7) — DeutschFlow

> Chạy: 2026-06-24 · Role: TEACHER (testgv03) · Cách: API thật + verify trên UI v2.
> Dữ liệu test dùng-một-lần: **lớp `ZZ_TEST_AUTO 2026-06-24 (xoá được)` — id 6, inviteCode 6EE64AD1**. Chưa xoá (chờ xác nhận cleanup).
> Tổng quan: **toàn bộ vòng đời lớp + lịch hoạt động đúng; tính năng lõi "đổi giờ/phòng 1 buổi không phá pattern" PASS.** Vài quan sát nhỏ cần xác minh.

---

## 1. Các bước đã chạy (API) — tất cả PASS

| # | Hành động | Endpoint | KQ |
|---|---|---|:--:|
| 1 | Tạo lớp | `POST /api/v2/teacher/classes` `{name}` | ✅ 200 — class id 6, inviteCode 6EE64AD1, studentCount 0 |
| 2 | Đặt lịch cố định (pattern) | `PUT /api/v2/teacher/class-schedule/classes/6/pattern` | ✅ 200 — **generated 28 buổi**, patternId 1, keptOverridden 0 |
| 3 | Thêm buổi lẻ | `POST .../classes/6/sessions` | ✅ 200 — tạo buổi 25/06 18:00 |
| 4 | **Đổi giờ + phòng 1 buổi** | `PATCH .../sessions/1` `{startAt,room,mode}` | ✅ 200 — buổi id 1: 18:00→**20:30**, room→**Room-B-CHANGED**, mode→OFFLINE, overridden=true; buổi id 29 **giữ nguyên** 18:00/Online |
| 5 | Thêm học viên | `POST .../classes/6/students` `{email}` | ✅ 200 — roster có test01@gmail.com (1 HV) |
| 6 | (Negative) thêm email rỗng | `POST .../classes/6/students` `{email:""}` | ✅ 400 — guard chặn đúng (khớp fix gần đây) |

**Tính năng lõi PASS:** đổi giờ/phòng một buổi (ClassSession override) không ảnh hưởng các buổi khác sinh từ ClassSchedulePattern — đúng mô hình đã thiết kế.

---

## 2. Verify trên UI v2 (teacher) — khớp API

- `/v2/teacher`: "Các lớp đang giảng dạy **1**", card **ZZ_TEST_AUTO 2026-06-24**, **1 HV**, inviteCode 6EE64AD1, "Tổng học viên 1". → student add + class create hiển thị đúng.
- `/v2/teacher/schedule` (Lịch dạy, tuần 22–28/06): mục "Buổi lớp sắp tới" hiện **cả 2 buổi**:
  - `25/06 · 18:00 · 1 · Online` (buổi không đổi)
  - `25/06 · 20:30 · 1 · Room-B-CHANGED` (buổi đã PATCH) ✅
- Lưới lịch render buổi trên cột T5 (Thứ 5 25/06). → UI đọc đúng mutation.

---

## 3. Quan sát nhỏ (cần xác minh, không chặn)

| ID | Quan sát | Bằng chứng | Mức độ |
|---|---|---|---|
| MUT-1 | **`dayOfWeek=3` (gửi qua API) sinh buổi vào Thứ 5 (25/06), không phải Thứ 4.** Quy ước đánh số thứ có thể là 0=Thứ 2 (lệch so với ISO Mon=1). Nếu UI map tên thứ sai có thể lệch 1 ngày. | pattern dayOfWeek=3 → sessions 25/06 (Thu) | 🟡 verify |
| MUT-2 | **`defaultRoom` của pattern không truyền xuống `room` của buổi sinh tự động** (week view trả `room=null` cho buổi pattern, dù defaultRoom="Room-A"). Buổi override thì có room. | session id 29 room=null | ⚪ |
| MUT-3 | **Buổi không sửa cũng mang `overridden=true`** (id 29 không bị tôi đụng vẫn overridden). Ngữ nghĩa cờ overridden cần làm rõ. | week view | ⚪ |

---

## 4. Cleanup

Lớp test **id 6** (`ZZ_TEST_AUTO 2026-06-24 (xoá được)`) + 28 buổi + roster test01 **vẫn đang tồn tại trong org df-center**. Endpoint xoá: `DELETE /api/v2/teacher/classes/6`. **Chưa xoá — chờ bạn xác nhận** (xoá là thao tác không hồi lại).

---

## 5. CHƯA chạy (mutation khác)

- **Co-teacher** (`POST/DELETE .../classes/6/teachers`) — cần email GV khác; bỏ qua để khỏi gửi mời.
- **Join-request approve/reject** — cần student tự gửi yêu cầu vào lớp trước.
- **Grading + AI grade** — cần có assignment + bài nộp; AI grade tốn token (org pool).
- **Org: mời thành viên / tạo teacher** (`/api/org/*`) — gửi email thật → cần bạn cho phép.
- **SRS review / onboarding ghi profile (student)** — đổi trạng thái tài khoản test01.
- **Payment** — chỉ sandbox.
