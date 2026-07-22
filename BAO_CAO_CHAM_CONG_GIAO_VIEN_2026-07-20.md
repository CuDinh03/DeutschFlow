# Báo cáo rà soát: Chấm công giáo viên (nhật ký buổi dạy · điểm danh · lịch dạy)

**Ngày:** 2026-07-20
**Nhánh khảo sát:** `feat/materials-preview-libreoffice` (đối chiếu `origin/main` @ V261)
**Phương pháp:** rà soát đối kháng đa tác tử — 6 chiều rà soát song song → khử trùng lặp → mỗi phát hiện được **3 tác tử kiểm chứng độc lập** với 3 lăng kính khác nhau (tái hiện / phòng-thủ-nơi-khác / tác động thực). Tổng **96 tác tử**, ~8,6 triệu token.
**Kết quả:** 30 phát hiện thô → 30 độc nhất → **20 CONFIRMED · 4 PLAUSIBLE · 6 REFUTED · 0 chưa kiểm chứng**.

---

> ## ⚠️ ĐÍNH CHÍNH QUAN TRỌNG (bổ sung sau khi rà soát)
>
> Bản đầu của báo cáo này viết: *"cụm chấm công không phải hệ thống chấm công theo nghĩa nhân sự…
> không có bảng lương, đơn giá, giờ công"*. Câu đó **đúng về hiện trạng mã nhưng sai về mục đích sản phẩm**,
> và tôi đã trình bày nó như thể đó là phạm vi thiết kế.
>
> **Mục đích thật:** đây là dữ liệu để **tính công đi làm và lương của giáo viên**, **tổng hợp ở phía manager**.
>
> Vì vậy phát biểu đúng phải là: **toàn bộ tầng chấm công–trả lương đang thiếu** — đó là phát hiện lớn nhất
> của cả đợt rà soát, không phải một ghi chú bên lề. Bốn khoảng trống G1–G4 ở §2.3 không phải "nâng cấp
> tương lai" mà **chính là sản phẩm chưa được xây**. Xem §7 cho phần đánh giá lại mức độ nghiêm trọng.

## 1. Tóm tắt điều hành

Cụm "chấm công giáo viên" hiện tại **mới chỉ là sổ điểm danh học viên**, chưa phải bản ghi công của giáo viên.
Nó phục vụ báo cáo lớp và điều kiện cấp chứng chỉ. Không có bảng lương, đơn giá, giờ công hay quy trình
duyệt công ở bất kỳ đâu trong mã nguồn — trong khi **đó mới là mục đích của tính năng**.

Chất lượng mã ở cụm này **cao hơn mặt bằng** — đã qua nhiều đợt audit trước, có nhiều lớp phòng thủ được ghi chú tường minh (không mặc định `PRESENT`, phân biệt "chưa điểm danh" với "vắng", giữ điểm danh của học viên đã rời lớp, chống N+1 ở đường đọc). Tuy vậy rà soát lần này vẫn tìm ra **20 khiếm khuyết đã được kiểm chứng**, trong đó:

| Mức | Số lượng | Bản chất |
|---|---|---|
| **HIGH** | 3 | 1 lỗ hổng IDOR/rò rỉ PII xuyên tenant, 1 lỗi vỡ giao dịch khi sửa nhật ký, 1 lỗi sinh buổi ma khi dời lịch |
| **MEDIUM** | 8 | Sai số liệu chuyên cần (ảnh hưởng cấp chứng chỉ), rò trạng thái "đã dạy", thiếu ràng buộc chống trùng, chặn xoá tài khoản GV |
| **LOW** | 9 | Hiệu năng đường ghi, validate đầu vào, thông báo lỗi, a11y |

**Ba việc cần làm sớm nhất:**

1. **`buildAttendance` không kiểm tra học viên có thuộc lớp** → giáo viên bất kỳ có thể liệt kê họ tên + email của **mọi người dùng trong hệ thống, xuyên tổ chức**. (HIGH, đồng thuận 3/3)
2. **`updateLog` xoá-rồi-chèn cùng khoá chính** → sửa nhật ký trong trường hợp phổ biến nhất (giữ nguyên sĩ số) có thể vỡ vì thứ tự flush của Hibernate. (HIGH, 2/3)
3. **Mẫu số tỉ lệ chuyên cần sai** → học viên vào lớp muộn bị từ chối cấp chứng chỉ oan. (MEDIUM sau kiểm chứng, 3/3)

---

## 2. Bản đồ hiện trạng

### 2.1 Bốn khối cấu thành

```
┌─ LỊCH DẠY (kế hoạch) ────────────┐   ┌─ NHẬT KÝ (thực tế) ──────────────┐
│ class_schedule_patterns          │   │ class_lesson_logs                │
│   └─ class_sessions              │ ✗ │   └─ class_attendance            │
│      status: SCHEDULED/          │   │      status: PRESENT/LATE/ABSENT │
│              CANCELLED/MOVED     │   │   └─ lesson_id → class_lessons   │
│      durationMinutes ✓           │   │      (KHÔNG có thời lượng)       │
└──────────────────────────────────┘   └──────────────────────────────────┘
        ✗ = KHÔNG có liên kết nào giữa hai khối
```

| Vai trò | File chính |
|---|---|
| API nhật ký | `backend/.../teacher/controller/LessonLogController.java` |
| Nghiệp vụ nhật ký + điểm danh | `backend/.../teacher/service/LessonLogService.java` (236 dòng) |
| Lịch định kỳ + sinh buổi | `backend/.../teacher/service/ClassScheduleService.java` (558 dòng) |
| Job gia hạn lịch hằng ngày | `backend/.../teacher/jobs/ClassScheduleRollForwardJob.java` |
| Số liệu chuyên cần + chứng chỉ | `backend/.../teacher/service/StudentEvaluationService.java` |
| Giao diện nhập & báo cáo | `frontend/src/app/v2/teacher/tc-reports/AttendanceTab.tsx` (557 dòng) |
| Tiến độ bài dạy | `frontend/src/app/v2/teacher/tc-progress/page.tsx` |
| Client API | `frontend/src/lib/teacherLessonLogApi.ts` |
| Lược đồ | `V208__class_lesson_logs_attendance.sql`, `V252__class_lesson_logs_lesson_link.sql` |

### 2.2 Luồng nghiệp vụ

1. Giáo viên tạo **mẫu lịch định kỳ** → hệ sinh sẵn `class_sessions` cho cửa sổ **12 tuần**; job `02:15` hằng ngày trượt cửa sổ này về phía trước.
2. Sau mỗi buổi, giáo viên mở tab **Điểm danh** → ghi một `class_lesson_log` (ngày, số buổi, chủ đề, bài tập, gắn `lesson_id`) kèm các dòng điểm danh.
3. Ghi log có gắn `lesson_id` sẽ **tự đánh dấu bài đó là "đã dạy"** (`ClassLesson.completed = true`) — để giáo viên không phải nhập cùng một sự kiện hai lần.
4. `StudentEvaluationService` tính tỉ lệ chuyên cần và quyết định **đủ điều kiện cấp chứng chỉ** (`≥ 50/100` điểm trung bình **và** `≥ 80%` chuyên cần).

### 2.3 Bốn khoảng trống kiến trúc

Đây là phần quan trọng nhất của báo cáo — không phải "lỗi", mà là **giới hạn thiết kế** khiến hệ không thể trở thành chấm công thật:

| # | Khoảng trống | Hệ quả |
|---|---|---|
| **G1** | `class_lesson_logs` **không có** cột `session_id` | Không đối soát được "buổi đã lên lịch" ↔ "buổi thực dạy". Không biết buổi nào bị bỏ, buổi nào dạy bù. |
| **G2** | `ClassSession.Status` chỉ có `SCHEDULED / CANCELLED / MOVED` | **Không tồn tại trạng thái "đã dạy"**. Một buổi đã qua và một buổi sắp tới trông giống hệt nhau. |
| **G3** | Nhật ký **không có thời lượng** (chỉ `session_date` kiểu `DATE`) | "Công" chỉ đếm được theo **số bản ghi**, không quy ra **giờ dạy**. `durationMinutes` chỉ nằm ở `class_sessions` — khối không được nối. |
| **G4** | Không có **kỳ công / duyệt / khoá sổ** | Nhật ký sửa-xoá tự do vĩnh viễn. Số liệu tháng trước có thể đổi bất cứ lúc nào, không dấu vết duyệt. |

> **Kết luận mục 2:** với thiết kế hiện tại, câu hỏi *"Tháng 7 giáo viên A lên lịch bao nhiêu buổi, thực dạy bao nhiêu, tổng bao nhiêu giờ?"* **không trả lời được** bằng dữ liệu đang có.

---

## 3. Phát hiện đã kiểm chứng (CONFIRMED — 20)

Ký hiệu: `[đề xuất ban đầu → đồng thuận sau kiểm chứng]` và số phiếu `(x/3)`.

### 3.1 Mức HIGH

#### H-1 · IDOR + rò rỉ PII xuyên tenant qua điểm danh `[HIGH → HIGH] (3/3)`
`LessonLogService.java:198` — `buildAttendance()`

`buildAttendance` dựng `ClassAttendance` thẳng từ `input.studentId()` của client mà **không kiểm tra học viên có thuộc lớp**. Lớp bảo vệ duy nhất trên đường ghi là `assertTeacherOwnsClass(teacherId, classId)` — chỉ chứng minh *giáo viên sở hữu lớp*, không nói gì về *các học viên được trỏ tới*. Sau đó `toDto()` gọi `userRepository.findAllById(studentIds)` (tra cứu **toàn cục, không giới hạn theo tổ chức**) và trả về `displayName` + `email` của từng người trong response.

**Kịch bản khai thác:**
```http
POST /api/v2/teacher/classes/{classId}/lesson-logs
{ "sessionDate":"2026-07-20", "attendance":[{"studentId": N, "status":"PRESENT"}] }
```
Response `201` chứa `displayName` và `email` của user `N` — kể cả người thuộc lớp khác, **tổ chức khác**, hoặc tài khoản ADMIN. Lặp `N` sẽ **liệt kê toàn bộ PII của bảng `users` xuyên mọi tenant**. Ngoài ra hàng `class_attendance` rác được ghi vào DB, làm sai tỉ lệ chuyên cần, và bị `getLogs()` đọc lại + rò lại ở mọi lần mở màn hình.

**Điểm đáng chú ý:** `classStudentRepository` **đã được inject** vào service (dòng 37) nhưng **không hề được dùng** — dấu hiệu rõ ràng bước kiểm tra membership bị bỏ sót. Guard `existsByIdClassIdAndIdStudentId` được áp dụng ở ~11 service anh em (`OrgCertificateService:69`, `ClassLessonService:223`, `MaterialService:667`, `TeacherService:213`…) nhưng thiếu đúng ở đây. `updateLog` mắc y hệt.

**Hướng sửa:** nạp roster một lần vào `Set` và từ chối mọi `studentId` ngoài roster (400/403).

> Xếp HIGH chứ không CRITICAL vì cần principal TEACHER hợp lệ, và rò họ tên + email chứ không phải thông tin xác thực.

#### H-2 · `updateLog` xoá-rồi-chèn cùng khoá chính có thể vỡ `[HIGH → HIGH] (2/3)`
`LessonLogService.java:135`

`attendanceRepository.deleteByIdLessonLogId(logId)` là derived-delete: Spring Data chỉ `SELECT` rồi `em.remove()` (xếp vào ActionQueue), **không flush ngay**. Ngay sau đó `saveAll(attendances)` dựng lại các `ClassAttendance` với **đúng khoá chính cũ** `(lesson_log_id, student_id)`.

**Kịch bản:** giáo viên sửa nhật ký nhưng giữ nguyên danh sách điểm danh — **đây là trường hợp phổ biến nhất** (chỉ sửa chủ đề/bài tập). Nếu Hibernate flush `INSERT` trước `DELETE` → `duplicate key value violates unique constraint`.

**Hướng sửa:** chèn `attendanceRepository.flush()` ngay sau lệnh xoá; hoặc tốt hơn, chuyển sang **upsert tại chỗ** (so sánh diff: cập nhật hàng còn, xoá hàng thừa, chỉ chèn hàng mới) — cách này cũng khử luôn L-2 bên dưới.

#### H-3 · Dời buổi sang thứ khác sinh ra buổi ma `[HIGH → HIGH] (3/3)`
`ClassScheduleService.java:319` — `regenerate()`

`keptDates` được tính từ **ngày hiện tại** của các buổi đã override (`s.getStartAt().toLocalDate()`), rồi hệ sinh lại mọi lần xuất hiện theo thứ của mẫu mà không nằm trong `keptDates`.

**Kịch bản:** mẫu = Thứ Hai 18:00. Giáo viên dời buổi Thứ Hai sang **Thứ Tư** 18:00 (`updateSession` đặt `startAt`=Thứ Tư, `overridden=true`). Lần `rollForward` kế tiếp: `keptDates = {Thứ Tư}`; buổi Thứ Hai không nằm trong đó → hệ **chèn thêm một buổi Thứ Hai 18:00 mới**. Kết quả: học viên thấy **cả hai** buổi — một buổi ma trên ngày gốc.

**Hướng sửa:** khi dời buổi, hoặc gỡ `pattern_id` (tách khỏi mẫu), hoặc neo `keptDates` theo **ngày gốc của lần xuất hiện** thay vì `startAt` hiện tại; kèm unique index `(pattern_id, start_at)`.

### 3.2 Mức MEDIUM

#### M-1 · Mẫu số tỉ lệ chuyên cần sai — học viên vào muộn bị từ chối chứng chỉ oan `[HIGH → MEDIUM] (3/3)`
`StudentEvaluationService.java:250`

```java
int totalSessions = logs.size();                                   // TẤT CẢ buổi của lớp
double attendanceRate = (presentCount + lateCount) / totalSessions; // nhưng tử số chỉ của HV này
```

Tử số đếm các dòng điểm danh **của riêng học viên**, mẫu số lại là **toàn bộ nhật ký của lớp**. Chính hằng số trong mã ghi *"80% of recorded sessions"* — tức ý định thiết kế là chia cho **số buổi có ghi nhận của học viên đó**.

**Kịch bản:** lớp có 20 buổi; học viên vào từ buổi 13 và **có mặt đủ cả 8 buổi của mình** (8 `PRESENT`, 0 `ABSENT`). → `8/20 = 40%` → **bị đánh trượt điều kiện chứng chỉ**, dù chuyên cần thực tế là 100%. Báo cáo hiển thị "8/20 buổi" với `absentCount = 0` — tự mâu thuẫn.

**Hướng sửa:**
```java
int recorded = presentCount + lateCount + absentCount;
attendanceRate = (double)(presentCount + lateCount) / recorded;
```
Cách này tôn trọng đúng ngữ nghĩa "không có dòng = chưa điểm danh ≠ vắng" mà phần còn lại của hệ đã cẩn thận giữ.

> Đây là **cùng một lớp lỗi late-joiner** đã từng vá cho bài tập (PR #234 / V260) nhưng **chưa vá cho điểm danh**.

#### M-2 · Nhật ký chỉ ghi chủ đề cũng làm phình mẫu số `[MEDIUM → MEDIUM] (3/3)`
`AttendanceTab.tsx:179` + `StudentEvaluationService.java:228`

Thiết kế `UNMARKED` (bỏ qua học viên không được đánh dấu) là đúng, nhưng vì mẫu số là `logs.size()`, một log viết **chỉ để ghi chủ đề** (không điểm danh ai) vẫn cộng vào mẫu số.

**Kịch bản:** lớp 10 log, giáo viên điểm danh 6 buổi và dùng 4 buổi làm ghi chú chủ đề. Học viên có mặt cả 6 buổi → `6/10 = 60% < 80%` → mất chứng chỉ.

**Hướng sửa:** mẫu số chỉ đếm các log **có ít nhất một dòng điểm danh**. Sửa chung với M-1.

#### M-3 · Bản in điểm danh và phép tính chứng chỉ bất đồng `[MEDIUM → MEDIUM] (3/3)`
`AttendanceTab.tsx:495`

Bảng in tính vắng **chỉ khi có dòng `ABSENT` tường minh** và để trống ô khi không có dòng — tức bản in hiểu đúng "không có dòng = không tính". Nhưng backend lại chia cho tổng số log.

**Kịch bản:** cùng học viên vào muộn ở M-1 — bản in PDF hiện **trống ở buổi 1–12 và 0 lượt vắng** (chuyên cần trông hoàn hảo), trong khi tab Đánh giá hiện **40% và "không đủ điều kiện"**. Giáo viên tin bản in sẽ kết luận ngược với hệ thống.

**Hướng sửa:** đồng bộ mẫu số backend (M-1) theo đúng ngữ nghĩa của bản in.

#### M-4 · Xoá nhật ký cuối cùng vẫn để bài ở trạng thái "đã dạy" `[HIGH → MEDIUM] (2/3)`
`LessonLogService.java:148` — `deleteLog()` chỉ xoá log + điểm danh, không đụng tới `ClassLesson`. Bài vẫn `completed = true` vĩnh viễn dù không còn nhật ký nào chứng minh.

#### M-5 · Sửa log sang bài khác làm rò `completed` trên bài cũ `[HIGH → MEDIUM] (3/3)`
`LessonLogService.java:133` — `updateLog` chỉ gọi `autoCompleteLesson` cho bài **mới**. Bài **cũ** không bao giờ được xét lại.

**Kịch bản:** tạo log gắn Lektion 3 (L3 → completed). Nhận ra nhầm, sửa sang Lektion 2 (L2 → completed). Giờ **cả L2 lẫn L3 đều "đã dạy"** dù chỉ có đúng 1 buổi. `tc-progress` đếm 2 bài.

> Chú thích trong mã thừa nhận **cố ý** không un-complete (sợ gây bất ngờ). Nhưng hệ quả tích luỹ là số bài đã dạy phình lên theo mỗi lần sửa nhầm. Cần tách bạch "auto-complete từ log" với "tick thủ công" để chỉ hoàn tác cái do log sinh ra.

#### M-6 · Không chặn nhật ký trùng buổi `[HIGH → MEDIUM] (3/3)`
`LessonLogService.java:74` + `V208`

Không có unique constraint trên `(class_id, session_date, session_number)` và service cũng không kiểm tra trùng. Bấm Lưu hai lần (double-click / mạng chập) tạo **2 bản ghi cho cùng một buổi** → mọi thống kê "số buổi" đếm gấp đôi, và mỗi log có bộ điểm danh riêng nên không có cách tự động gộp.

#### M-7 · Ngày buổi dạy ở tương lai vẫn đánh dấu "đã dạy" `[MEDIUM → MEDIUM] (3/3)`
`LessonLogService.java:110` — không ràng buộc `sessionDate <= hôm nay`. Chọn nhầm `2026-12-31` → bài lập tức `completed` với `completedAt` ở tương lai, làm hỏng báo cáo nhịp độ.

#### M-8 · FK `created_by` chặn xoá tài khoản giáo viên `[MEDIUM → MEDIUM] (3/3)`
`V208:11` — `created_by BIGINT REFERENCES users(id)` không khai `ON DELETE` (mặc định `RESTRICT`). Giáo viên đã từng ghi nhật ký mà yêu cầu xoá tài khoản → `DELETE FROM users` vướng FK → **xoá tài khoản thất bại**.

> Đây là **rủi ro tuân thủ App Store 5.1.1(v)** (quyền xoá tài khoản). Sửa: đổi sang `ON DELETE SET NULL` như `lesson_id` đã làm ở V252.

### 3.3 Mức LOW (tóm tắt)

| Mã | Vị trí | Nội dung | Phiếu |
|---|---|---|---|
| L-1 | `LessonLogService.java:198` | `studentId` trùng trong một request bị ghi đè im lặng (last-wins); response trả 2 dòng nhưng DB chỉ có 1 | 2/3 |
| L-2 | `LessonLogService.java:93` | `saveAll` đi đường `merge` → thêm 1 `SELECT`/học viên. Lớp N học viên tốn `2N` round-trip thay vì `N` | 2/3 |
| L-3 | `LessonLogService.java:78` | `sessionNumber` không validate `> 0`, cho phép trùng số, dựa ngầm vào `NULLS LAST` mặc định của Postgres | 2/3 |
| L-4 | `ClassScheduleService.java:311` | Thiếu unique `(pattern_id, start_at)`: job và thao tác tương tác chạy song song có thể chèn trùng buổi (ShedLock chỉ chặn job với chính nó) | 3/3 |
| L-5 | `ClassScheduleService.java:278` | `@Transactional` bọc toàn vòng lặp + flush trễ làm **vô hiệu** try/catch tách lỗi từng mẫu → một mẫu hỏng kéo đổ cả lượt | 2/3 |
| L-6 | `AttendanceTab.tsx:207` | `catch { toast.error(...) }` nuốt thông báo backend ở cả 3 handler ghi — giáo viên không biết vì sao lưu hỏng | 3/3 |
| L-7 | `tc-progress/page.tsx:48` | `load()` thiếu chốt chống response cũ; đổi lớp nhanh có thể hiển thị dữ liệu **lớp khác** mà không báo lỗi | 3/3 |

> L-7 ban đầu được đề xuất HIGH và giữ 3/3 phiếu "có thật", nhưng tác động là hiển thị sai tạm thời (tự khỏi khi tải lại), nên xếp cùng nhóm ưu tiên thấp hơn về mức độ nguy hại dữ liệu. `tc-reports` đã có `loadSeq` đúng — chỉ cần nhân bản sang `tc-progress`.

---

## 4. Phát hiện chưa chắc chắn (PLAUSIBLE — 4)

Chỉ 1/3 phiếu xác nhận. Cần người có ngữ cảnh vận hành quyết định.

| Mã | Vị trí | Nội dung | Ghi chú |
|---|---|---|---|
| P-1 | `V208:22` | `class_attendance.status` là `VARCHAR(10)` **không có `CHECK`** — enum chỉ được ép ở tầng ứng dụng | Hiện chỉ `buildAttendance` chặn; mọi writer tương lai (script backfill, endpoint mới) có thể ghi `'present'`/`'EXCUSED'`. V249 đã tạo tiền lệ thêm `CHECK` cho `cefr_level`. **Nên làm** — rẻ và phòng thủ chiều sâu. |
| P-2 | `ClassScheduleService.java:302` | `primaryTeacherOf` chọn giáo viên **không xác định thứ tự** khi lớp không có `PRIMARY` → lịch "chập chờn" giữa các ngày | Chỉ xảy ra khi lớp thiếu `PRIMARY`. Sửa rẻ: thêm `ORDER BY teacher_id`. |
| P-3 | `ClassScheduleService.java:316` | `rollForward` **âm thầm xoá** buổi học viên đã thấy khi phát sinh trùng lịch mới, không thông báo | Cần quyết định sản phẩm: có nên tự bỏ buổi đã hiện hữu, hay phải phát `CLASS_SESSION_CANCELLED`? |
| P-4 | `LessonLogService.java:45` | `getLogs` không phân trang — kéo toàn bộ nhật ký + điểm danh của lớp | Tăng tuyến tính, chưa tới ngưỡng sập. Xử lý khi lớp dài hạn thực sự xuất hiện. |

---

## 5. Đã bác bỏ (REFUTED — 6) — và một đính chính

Ghi lại để **không phải điều tra lại**.

### 5.1 Đính chính của chính báo cáo này

Trong quá trình khảo sát ban đầu, tôi đã kết luận rằng **`sessionDate = null` sẽ trả HTTP 500 và lộ lỗi DB** do `CreateLessonLogRequest` thiếu `@NotNull` và controller thiếu `@Valid`.

**Kết luận đó SAI**, bị bác bỏ **0/3 phiếu** và tôi đã tự kiểm chứng lại trực tiếp:

- `GlobalExceptionHandler.java:267` có `@ExceptionHandler(DataIntegrityViolationException.class)` trả **HTTP 409** với thông báo chung, chỉ log chi tiết ở phía server (WARN).
- Ngay cả nhánh 500 dự phòng cũng chỉ trả mã tham chiếu `ERR-x`, **không bao giờ lộ tên bảng/cột/SQL**.
- `autoCompleteLesson` cũng không kịp chạy: `save()` ở dòng 84 vỡ trước dòng 90, và `@Transactional` rollback.

**Phần còn đúng:** DTO thật sự thiếu Bean Validation và controller thật sự thiếu `@Valid`. Nhưng hậu quả là **409 thay vì 400** — một điểm gọt giũa API mức **LOW**, không phải lỗi HIGH. Vẫn nên thêm `@NotNull` + `@Valid` để thông báo lỗi đúng ngữ nghĩa.

### 5.2 Các nghi vấn khác đã được xác nhận là an toàn

| Nghi vấn | Phán quyết |
|---|---|
| `findTeacherConflictDates` gọi `dates.get(0)` khi danh sách rỗng → `IndexOutOfBounds` | **Đã có chốt chặn** ở `ClassScheduleService.java:390` (`return Set.of()`). Mẫu rỗng chỉ sinh 0 buổi, vẫn hợp lệ và được thử lại hôm sau. |
| `LATE` bị tính không nhất quán giữa BE và FE | **Nhất quán**: cả hai đều tính `LATE` là có mặt (`presentCount + lateCount`; `AttendanceTab:82`). Chia cho 0 cũng đã được chặn. |
| Sửa/xoá nhật ký làm hỏng chứng chỉ **đã cấp** | **Không**: `OrgCertificate` lưu snapshot bất biến khi cấp. *Nhưng* huy hiệu "đủ điều kiện" hiển thị trực tiếp thì có tính lại — gây khó hiểu, không gây sai dữ liệu. |
| Thiếu validate số phía client | Có thật nhưng nhỏ: `sessionNumber` thiếu `step` nên `2.5` gửi được xuống field integer. Gộp chung với L-6. |
| Bảng in điểm danh thiếu `scope`/nhãn ô góc | Có thật, mức a11y thấp. |

> **Lưu ý phương pháp:** lượt chạy đầu có 46/96 tác tử chết vì chạm giới hạn phiên. Script tổng hợp ban đầu tính "0 phiếu" thành **REFUTED**, khiến 17 phát hiện bị gán nhãn sai là "đã bác bỏ". Sau khi sửa logic (phân biệt `UNVERIFIED` với `REFUTED`) và chạy lại phần dang dở, con số thật là **20 CONFIRMED / 4 PLAUSIBLE / 6 REFUTED**. Bài học: **agent lỗi không bao giờ được tính là phiếu bác bỏ.**

---

## 6. Đánh giá tổng thể

**Điểm mạnh thực sự** (nên giữ khi tái cấu trúc):

- Ngữ nghĩa "chưa điểm danh ≠ vắng" được giữ nhất quán ở đường ghi, giao diện và bản in — đây là quyết định thiết kế đúng và hiếm.
- Không mặc định `PRESENT`; có ghi chú tường minh về lỗi cũ đã từng gây bịa dữ liệu.
- Giữ điểm danh của học viên đã rời lớp khi sửa log.
- Đường đọc `getLogs` đã chống N+1 chủ động.
- Job gia hạn lịch có ShedLock, tính ngày theo giờ VN (không phải UTC), bảo toàn buổi đã chỉnh tay.

**Điểm yếu hệ thống:** cụm này được xây theo hướng *nhật ký giảng dạy*, rồi bị dùng dần cho *báo cáo* và *quyết định cấp chứng chỉ* mà mô hình dữ liệu chưa nâng theo. Hầu hết lỗi số liệu ở mục 3.2 đều bắt nguồn từ đúng một chỗ: **`logs.size()` bị dùng làm mẫu số cho một phép tính vốn thuộc về từng học viên.**

Chiến lược nâng cấp chi tiết: xem [`plans/2026-07-20-nang-cap-cham-cong-giao-vien.md`](plans/2026-07-20-nang-cap-cham-cong-giao-vien.md).

---

## 7. Đánh giá lại mức độ khi dữ liệu này dùng để trả lương

Khi số buổi/giờ ra tiền, một số lỗi đổi hẳn tính chất — từ "sai báo cáo" thành "sai tiền":

| Mã | Trước | Khi có lương | Vì sao |
|---|---|---|---|
| **M-6** không chặn nhật ký trùng buổi | MEDIUM | 🔴 **HIGH** | Bấm Lưu hai lần = hai bản ghi cho một buổi = **trả thừa công** |
| **M-7** ngày dạy ở tương lai vẫn ghi nhận | MEDIUM | 🔴 **HIGH** | Giáo viên **ghi công cho buổi chưa dạy** |
| **G4** không có kỳ công / duyệt / khoá sổ | "nâng cấp sau" | 🔴 **CHẶN CỬA** | Không thể trả lương từ dữ liệu sửa–xoá tự do vô thời hạn, không dấu vết duyệt |
| **G3** không có thời lượng buổi dạy | MEDIUM | 🔴 **CHẶN CỬA** | Hợp đồng tính theo giờ thì không có dữ liệu để tính |
| **G1/G2** không nối lịch ↔ thực dạy | MEDIUM | 🟠 HIGH | Không đối soát được "lên lịch bao nhiêu, thực dạy bao nhiêu" |
| **N-2** hàng điểm danh rác | MEDIUM | 🟠 HIGH | Làm lệch số liệu đầu vào của bảng công |
| **M-1/M-2/M-3** mẫu số chuyên cần | MEDIUM | ⬜ *không đổi* | Thuộc **chứng chỉ học viên**, không liên quan lương giáo viên |

**Điều còn thiếu căn bản nhất:** hệ hiện tại ghi *"học viên Y có mặt buổi này"*, chứ **không hề ghi
*"giáo viên X đã dạy buổi này"***. Hai việc đó khác nhau — một buổi có thể có nhật ký điểm danh do trợ giảng
nhập, và một lớp có nhiều giáo viên (`class_teachers` có `PRIMARY`/`ASSISTANT`). Muốn tính công đúng người
thì phải có bản ghi công riêng cho giáo viên, không thể suy từ sổ điểm danh.

### Quyết định thiết kế đã chốt (2026-07-20)

| Câu hỏi | Chốt | Hệ quả kỹ thuật |
|---|---|---|
| Đơn vị tính công | **Cả hai — tuỳ lớp/hợp đồng** | Bắt buộc lưu thời lượng buổi **và** cấu hình đơn vị (`SESSION`/`HOUR`) theo lớp hoặc hợp đồng |
| Quy trình chốt | **GV nộp → manager duyệt → khoá kỳ** | Cần bảng kỳ công `OPEN→SUBMITTED→APPROVED→LOCKED`; nhật ký trong kỳ đã khoá **phải bị chặn sửa**, nếu không bước duyệt là hình thức |
| Tiền lương | **Chỉ chốt số công, xuất ra ngoài** | Không lưu đơn giá, không tính thành tiền → loại bỏ dữ liệu lương nhạy cảm khỏi hệ thống |

Kế hoạch thực thi chi tiết: [`plans/2026-07-20-nang-cap-cham-cong-giao-vien.md`](plans/2026-07-20-nang-cap-cham-cong-giao-vien.md) §7.

## 8. Rà soát bổ sung 2026-07-21 — ultra-review chính tầng chấm công vừa xây

Bản rà soát ngày 20/07 soi **hiện trạng trước khi xây** (sổ điểm danh, lịch dạy). Sau khi tầng chấm công thật
(V263–V266) đã được viết, ngày 21/07 chạy thêm một vòng **ultra-review đa-tác-tử đối kháng** nhắm thẳng vào
mã mới: 3 tác tử dựng bản đồ, 7 tác tử review theo 7 chiều, 14 tác tử xác minh đối kháng (mỗi lỗi HIGH/CRITICAL
được 2 tác tử độc lập soi bằng lens *reproduce* và *refute*). Tổng 24 tác tử.

### 8.1 Lỗ hổng mà bản rà soát 20/07 ĐÃ BỎ SÓT

> 🟠 **HIGH — kỳ công chồng ngày → trả lương gấp đôi + HTTP 500.**
> Thiết kế kỳ công ở §7 chốt vòng đời `OPEN→SUBMITTED→APPROVED→LOCKED` và ràng buộc
> `UNIQUE (teacher_id, period_start)`, nhưng **không ai đặt câu hỏi: hai kỳ khác mốc bắt đầu mà GIAO NGÀY
> nhau thì sao?** `openPeriod` nhận `from`/`to` tuỳ ý từ client, nên giáo viên mở kỳ A = 01/01–31/01 rồi
> kỳ B = 15/01–15/02 là hợp lệ với mọi ràng buộc đang có.
>
> Hậu quả kép: (1) `snapshotTotals()` đếm dòng công theo **khoảng ngày**, không theo `period_id`, nên buổi
> 15–31/01 được cộng vào tổng của **cả hai kỳ** và `orgSummary`/`exportOrgCsv` cộng dồn → 8 buổi × 90′ bị
> xuất thành 16 buổi / 1440′; (2) `assertRecordEditable()` tra kỳ phủ một ngày bằng finder trả `Optional`,
> hai kỳ cùng phủ → `IncorrectResultSizeDataAccessException` → **500 trên mọi thao tác dòng công**.
>
> Giáo viên **tự gây được**, và chính họ là người hưởng lợi khi trả thừa.

**Vì sao bỏ sót:** cả rà soát lẫn thiết kế đều tập trung vào *vòng đời trạng thái* của kỳ (chốt chặn sửa sau
khi nộp) mà không xét *bất biến hình học* của tập kỳ (các kỳ phải rời nhau). Ràng buộc `UNIQUE` trên một cột
mốc bắt đầu tạo cảm giác an toàn sai — nó chặn trùng mốc, không chặn giao khoảng.

**Đã vá:** `openPeriod` kiểm tra idempotent theo `period_start` rồi `assertNoOverlap` (409 rõ nghĩa);
**V267** `EXCLUDE USING gist (teacher_id WITH =, daterange(period_start, period_end, '[]') WITH &&)` +
`btree_gist` làm chốt cứng ở DB; finder đổi `Optional`→`List` để khử 500 kể cả nếu lọt chồng.

### 8.2 Các phát hiện còn lại (đều đã vá)

| Mức | Phát hiện | Cách vá |
|---|---|---|
| 🟡 MEDIUM | `snapshotTotals` không lọc theo `orgId` snapshot của kỳ → giáo viên dạy chéo trung tâm làm org nhà bị cộng công của org khác | `belongsToPeriodOrg()` — chỉ loại khi cả hai org đều biết và khác nhau |
| 🟡 MEDIUM | Modal từ chối kỳ (`/v2/org/timesheets`) đóng + xoá lý do **trước** khi `await` → thất bại là mất input manager | `runAction` trả `boolean`; chỉ đóng khi thành công |
| 🟡 MEDIUM | Guard khoá kỳ của `updateRecord` (đặc biệt vế **kỳ đích** khi dời buổi) và toàn bộ `deleteRecord` **không có test** | +4 test chặn kỳ nguồn/kỳ đích đã chốt và IDOR khi xoá |
| 🔵 LOW | `openPeriod` get-or-create không atomic → 2 request đồng thời ném 500 | Native upsert `insertIfAbsent` (`ON CONFLICT DO NOTHING`) rồi tra lại |
| 🔵 LOW | `teacher_session_record.period_id` + FK + index là **schema chết** (entity không map, không dòng nào ghi) | **V268** gỡ cả ba |
| 🔵 LOW | Export CSV dùng ô nhập `from`/`to` hiện tại thay vì range đang hiển thị | Track `loadedRange`; disable nút khi ô nhập lệch |
| 🔵 LOW | Client `updateRecord` trong `timesheetApi.ts` là dead code | Xoá (endpoint backend vẫn giữ) |

> 🔑 **Vì sao `openPeriod` dùng upsert chứ không `try/catch`:** bắt `DataIntegrityViolationException` trong
> cùng `@Transactional` rồi tra lại **không chạy được** — Postgres abort cả transaction khi vi phạm ràng buộc.
> `INSERT … ON CONFLICT DO NOTHING` là một câu lệnh *thành công* nên không abort transaction.

### 8.3 Kiểm chứng trên Postgres 16 thật

Unit test mock repository nên **không phủ SQL**, và CI **skip Integration Tests** — phải chạy tay
(Docker `pgvector/pgvector:pg16`):

- Flyway: `Successfully applied 266 migrations … now at version v268` — V1→V268 replay sạch từ DB trống,
  không checksum/exception. `ClassScheduleIT` **5/5 xanh**. `btree_gist` **có sẵn** trong image.
- Hành vi SQL đều đạt: `EXCLUDE` tồn tại (`contype=x`); V268 gỡ đủ cột/FK/index; `insertIfAbsent` idempotent
  (`INSERT 0 1` rồi `INSERT 0 0`); EXCLUDE chặn kỳ chồng; **biên kề chung đúng 1 ngày (30/04) cũng bị chặn**
  (đúng, vì `[]` inclusive normalize thành `[start, end+1)`); kỳ liền kề không chung ngày vẫn chèn được.

Kết quả đầy đủ: [`.claude/reviews/2026-07-21-feat-teacher-timesheet-ultra-review.md`](.claude/reviews/2026-07-21-feat-teacher-timesheet-ultra-review.md).

### 8.4 Đính chính về phạm vi review (bài học quy trình)

Vòng review ban đầu soi nhầm **bản LOCAL `feat/teacher-timesheet` = `9f74a120`** (nhánh cũ còn đọng commit WIP),
trong khi head thật của PR #242 là **`origin/feat/teacher-timesheet` = `1508d280`** đã merge main và sạch.
Vì vậy nhóm phát hiện *migration/đóng gói* (Flyway checksum V259, thiếu V260/V261, lệch `app.json`, scope-creep)
**chỉ đúng với bản local stale và KHÔNG áp dụng cho PR #242** — PR này chưa bao giờ là deploy-blocker.
Chỉ nhóm phát hiện *code-level* ở §8.1–8.2 là thật.

**Bài học:** luôn đối chiếu `git rev-parse origin/<branch>` với ref local trước khi kết luận về một PR —
repo này nhiều nhánh/worktree nên hai ref rất dễ lệch.

## Phụ lục A — Bảng tổng hợp

| Mã | Mức | File | Dòng | Phiếu |
|---|---|---|---|---|
| H-1 | HIGH | `LessonLogService.java` | 198 | 3/3 |
| H-2 | HIGH | `LessonLogService.java` | 135 | 2/3 |
| H-3 | HIGH | `ClassScheduleService.java` | 319 | 3/3 |
| M-1 | MEDIUM | `StudentEvaluationService.java` | 250 | 3/3 |
| M-2 | MEDIUM | `AttendanceTab.tsx` | 179 | 3/3 |
| M-3 | MEDIUM | `AttendanceTab.tsx` | 495 | 3/3 |
| M-4 | MEDIUM | `LessonLogService.java` | 148 | 2/3 |
| M-5 | MEDIUM | `LessonLogService.java` | 133 | 3/3 |
| M-6 | MEDIUM | `LessonLogService.java` | 74 | 3/3 |
| M-7 | MEDIUM | `LessonLogService.java` | 110 | 3/3 |
| M-8 | MEDIUM | `V208__class_lesson_logs_attendance.sql` | 11 | 3/3 |
| L-1 | LOW | `LessonLogService.java` | 198 | 2/3 |
| L-2 | LOW | `LessonLogService.java` | 93 | 2/3 |
| L-3 | LOW | `LessonLogService.java` | 78 | 2/3 |
| L-4 | LOW | `ClassScheduleService.java` | 311 | 3/3 |
| L-5 | LOW | `ClassScheduleService.java` | 278 | 2/3 |
| L-6 | LOW | `AttendanceTab.tsx` | 207 | 3/3 |
| L-7 | LOW | `tc-progress/page.tsx` | 48 | 3/3 |
| P-1…P-4 | (chưa chắc) | xem mục 4 | — | 1/3 |

## Phụ lục B — Dữ liệu gốc

- Kết quả workflow đầy đủ (JSON, gồm lập luận của cả 96 tác tử): run `wf_aa59ba12-2be`
- Journal từng tác tử: `~/.claude/projects/…/subagents/workflows/wf_aa59ba12-2be/journal.jsonl`
