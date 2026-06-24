# KẾT QUẢ TEST — JOIN-REQUEST + CHẤM BÀI + TOÀN BỘ CHỨC NĂNG GIÁO VIÊN

> Chạy: 2026-06-24 · org df-center (id 7) · Role: TEACHER (testgv03), STUDENT (test01) · API thật + verify UI v2.
> Tổng quan: **tất cả luồng giáo viên PASS.** Phát hiện đáng chú ý: AI-grade bị chặn 429 "org hết ngân sách token" trong khi dashboard ghi "pool không giới hạn" (xác nhận lại U-3).

---

## A. JOIN-REQUEST — học viên nhập mã → giáo viên duyệt (PASS)

Lớp test: `ZZ_TEST_JOIN 2026-06-24` (id 7).

| Bước | Hành động | Endpoint | KQ |
|---|---|---|:--:|
| 1 | Student nhập mã đúng | `POST /api/classes/join` `{inviteCode}` | ✅ 200 |
| 2 | Student nhập **mã sai** | `POST /api/classes/join` `{inviteCode:"BADCODE9"}` | ✅ 404 (chặn) |
| 3 | Teacher xem yêu cầu | `GET /api/v2/teacher/classes/7/join-requests` | ✅ 1 request: id 3, test01, PENDING |
| 4 | Teacher **duyệt** | `POST .../join-requests/3/approve` | ✅ 200 |
| 5 | Verify roster | `GET .../classes/7/students` | ✅ test01 vào lớp |
| 6 | Verify hàng chờ | `GET .../join-requests` | ✅ pending = 0 |

Có sẵn cả endpoint `reject` (`POST .../join-requests/{id}/reject`) — chưa chạy (cần 1 request khác).

---

## B. CHẤM BÀI (PASS — chấm tay; AI-grade bị chặn token đúng)

Lớp 6, học viên test01.

| Bước | Hành động | Endpoint | KQ |
|---|---|---|:--:|
| 1 | Teacher giao bài (Viết/Schreiben) | `POST /api/v2/teacher/classes/6/assignments` | ✅ 200 — assignment id 10, fan-out PENDING cho student |
| 2 | Student thấy bài | `GET /api/v2/students/assignments` | ✅ topic + PENDING |
| 3 | Student **nộp** | `POST /api/v2/students/assignments/10/submit` `{submissionContent}` | ✅ 200 → SUBMITTED |
| 4 | Teacher hàng đợi chấm | `GET /api/v2/teacher/grading/queue` + `/stats` | ✅ 1 bài SUBMITTED, pending 1 |
| 5 | Teacher **chấm tay** | `POST /api/v2/teacher/assignments/25/evaluate` `{teacherScore:85,teacherFeedback}` | ✅ 200 → EVALUATED |
| 6 | Verify student | `GET /api/v2/students/assignments` | ✅ status EVALUATED, **điểm 85 + nhận xét** |
| 7 | Verify stats | `/grading/stats` | ✅ graded 1 / pending 0 |
| 8 | **AI-grade** (bài thứ 2) | `POST /api/v2/teacher/grading/submissions/26/ai-grade` | ⚠ **429 "Tổ chức đã dùng hết ngân sách token AI tháng này"** |

**Verify UI** (`/v2/teacher/grading`): "Trung tâm Chấm bài" hiện **"1/2 đã chấm"**, hàng đợi có test01 "Viết·Schreiben", bài làm đúng nội dung đã nộp, panel chấm tay (nút điểm 60–100 + nhận xét + "Chấm AI"). → UI khớp 100% mutation API.

---

## C. SWEEP TOÀN BỘ CHỨC NĂNG GIÁO VIÊN — 200 gần như toàn bộ

| Endpoint | KQ |
|---|:--:|
| `GET /dashboard/summary` | ✅ 200 {pendingReviewCount, pendingJoinRequests} |
| `GET /classes/6/analytics` | ✅ 200 {totalStudents, totalXp, completedAssignments, avgSpeakingScore} |
| `GET /classes/6/leaderboard` | ✅ 200 |
| `GET /classes/6/teachers` (co-teacher) | ✅ 200 array[1] |
| `GET /classes/6/assignments` | ✅ 200 array[2] |
| `GET /reports/overview` · `/reports/classes/6` · `/gradebook` · `/skill-report` | ✅ 200 |
| `GET /classes/6/evaluations` · `/evaluations/58` | ✅ 200 |
| `GET /certificates/class/6` | ✅ 200 |
| `GET /availability` · `/center` | ✅ 200 |
| `GET /api/teacher-sessions/my` | ✅ 200 (paginated) |
| `GET /students/58/assignments` · `/speaking-sessions` · `/comprehensive-report` | ✅ 200 |
| `GET /api/teacher-sessions/earnings` | ⚠ 400 — cần param `profileId` (auth pass, không phải lỗi quyền) |

Mọi endpoint giáo viên xác thực OK; chỉ thiếu param ở 1–2 chỗ (earnings, schedule/week — đã biết).

---

## D. Phát hiện

| ID | Vấn đề | Bằng chứng | Mức độ |
|---|---|---|---|
| TF-1 | **"Pool không giới hạn" (UI/admin) ≠ thực thi.** AI-grade trả **429 "org hết ngân sách token"**, đồng thời speaking trả 429 `DEFAULT/0`, trong khi org dashboard + admin-panel ghi gói INTERNAL/"không giới hạn". Hiển thị quota **sai lệch so với enforcement**. | submission 26 ai-grade 429; §B8 + UI org | 🟠 Cao (cần xác minh resolve plan ở `common/quota`) |
| TF-2 | **Đặt tên path gây nhầm.** `POST /api/v2/teacher/assignments/{assignmentId}/evaluate` thực ra cần **id bài-nộp (StudentAssignment)** chứ không phải assignmentId. Truyền nhầm id lớp-bài (10) → 409 "Học viên không thuộc lớp của bạn" (thông báo lệch nguyên nhân thật). | evaluate id 10 → 409; id 25 → 200 | 🟡 TB |
| TF-3 | **UI báo "Session compromised / Phiên hết hạn"** giữa chừng. Do test gọi `logout` nhiều lần (revoke refresh) → cơ chế chống reuse kích hoạt; không phải lỗi sản phẩm, nhưng wording "compromised" lộ ra người dùng. | màn /v2/teacher/grading | ⚪ Thấp (test-induced) |

---

## E. Dữ liệu test còn lại trong org df-center (cần cleanup)

| Loại | ID | Ghi chú |
|---|---|---|
| Lớp | **6** `ZZ_TEST_AUTO` | + 28 buổi, roster test01, assignment 10 (graded) + 11 (submitted) |
| Lớp | **7** `ZZ_TEST_JOIN` | roster test01 (qua join) |
| Assignment | 10, 11 | submission 25 (graded 85), 26 (chờ chấm) |

Xoá: `DELETE /api/v2/teacher/classes/6` và `/7`. **Chưa xoá — chờ xác nhận.**

---

## F. Chưa chạy (cần điều kiện)

- **Co-teacher add/remove** (`POST/DELETE /classes/6/teachers`) — cần GV khác cùng org; testgv02 không thuộc org 7.
- **Reject join-request** — cần tạo thêm 1 request.
- **Chấm bài qua ảnh / Tạo tài liệu AI (PPTX) / Ngữ pháp AI** — tốn token AI (đang bị 429 org).
- **Nội dung giảng dạy, lesson-logs, evaluation PUT, availability PUT** — mutation, chạy tiếp nếu muốn.
