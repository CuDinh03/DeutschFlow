# Kế hoạch nâng cấp: Chấm công giáo viên

**Ngày lập:** 2026-07-20
**Báo cáo nguồn:** [`BAO_CAO_CHAM_CONG_GIAO_VIEN_2026-07-20.md`](../BAO_CAO_CHAM_CONG_GIAO_VIEN_2026-07-20.md)
**Trạng thái:** 🟡 Đợt 0, Đợt 1, N-1, N-3, M-6, M-7 ĐÃ VÁ (chưa commit) — tầng chấm công thật (§7) đang xây
**Migration:** **V262 đã dùng** cho `class_sessions.original_date` (Đợt 0). Migration mới bắt đầu từ **V263** (tầng chấm công dùng V263/V264; migration toàn vẹn Đợt 2 lùi xuống V265).

> ⚠️ **Đổi so với bản kế hoạch gốc:** Đợt 0 ban đầu dự kiến "không migration". Thực tế phương án (a) cho H-3
> (gỡ `pattern_id` khi dời buổi) **không sửa được lỗi** — ngày gốc vẫn nằm trong `patternOccurrenceDates` nên
> vẫn bị sinh lại. Chỉ phương án (b) (nhớ ô lịch gốc) mới đúng → buộc phải có V262. Mọi số migration ở các
> đợt sau đã lùi một bậc.

---

## 0. Mục tiêu & phạm vi

Kế hoạch gồm **hai nửa tách bạch**, có thể chạy độc lập:

| Nửa | Nội dung | Đợt | Tính chất |
|---|---|---|---|
| **A. Vá lỗi** | Xử lý 20 phát hiện CONFIRMED + 4 PLAUSIBLE | Đ0 → Đ4 | Bắt buộc, không đổi mô hình dữ liệu |
| **B. Tầng chấm công thật** | Lấp G1–G4 — **chính là sản phẩm** (tính công + lương, tổng hợp phía manager) | §7 | Đã chốt thiết kế, đang xây |

> ⚠️ **Sửa lại nhận định ban đầu:** bản đầu xếp Nửa B là "tuỳ chọn, chỉ làm khi có nhu cầu". SAI — mục đích của cả cụm này LÀ tính công + lương giáo viên (§7). Nửa A vẫn nên xong trước vì xây tầng chấm công trên nền số liệu sai (M-6 trùng buổi, M-7 ngày tương lai) sẽ nhân rộng cái sai — cả hai lỗi đó nay đã vá.

### Nguyên tắc xuyên suốt

1. **Giữ ngữ nghĩa "chưa điểm danh ≠ vắng"** — đây là tài sản thiết kế của hệ hiện tại, mọi thay đổi phải bảo toàn.
2. **Một nguồn sự thật cho mỗi con số.** Tỉ lệ chuyên cần chỉ được tính ở backend; frontend hiển thị, không tự tính lại.
3. **Migration cộng thêm, không phá.** Cột mới `NULLABLE`, `ON DELETE SET NULL`, `IF NOT EXISTS` — theo đúng tiền lệ V252.
4. **TDD.** Mỗi đợt viết test đỏ trước. Đã có sẵn `LessonLogServiceTest`, `ClassScheduleServiceTest`, `StudentEvaluationServiceTest`, `ClassScheduleIT`, `AttendanceTab.test.tsx` để mở rộng.

---

# NỬA A — VÁ LỖI

## Đợt 0 · Chặn máu (HIGH) — ✅ ĐÃ THỰC HIỆN 2026-07-20

**Mục tiêu:** đóng lỗ hổng rò rỉ dữ liệu và hai lỗi làm hỏng/vỡ dữ liệu.

**Đã làm** (1446 test xanh, 3 phép thử đột biến đều bị test bắt):

| File | Thay đổi |
|---|---|
| `LessonLogService.java` | `buildAttendance` nhận `allowedStudentIds`; `rosterIds()`; dựng+validate **trước** khi xoá; `flush()` giữa delete và saveAll; chặn `studentId` trùng |
| `ClassSessionRepository.java` | `findLiveForPattern` — lấy buổi theo **cả hai trục** `startAt` và `originalDate` |
| `ClassScheduleService.java` | `keptDates` neo theo `patternSlotDate()`; buổi sinh mới ghi `originalDate`; `updateSession` chốt ô gốc (write-once) |
| `ClassSession.java` | thêm `originalDate` |
| `V262__class_session_original_date.sql` | cột `original_date DATE` (nullable, không backfill) |
| 2 file test | +9 test mới; 2 test cũ được bổ sung roster (chúng đang mã hoá hành vi mất an toàn) |

> 🔎 **Lỗ hổng trong chính bản vá, do rà soát đối kháng tìm ra và đã vá tiếp:** bản vá H-3 đầu tiên chỉ chặn
> chiều dời **tới**. Buổi bị dời **lùi** về quá khứ (dạy bù sớm) rơi khỏi cửa sổ `startAt >= today` nên
> `originalDate` không bao giờ vào `keptDates` → ô gốc vẫn bị sinh lại thành buổi ma. Đã sửa bằng
> `findLiveForPattern` lấy theo cả hai trục.

### Đ0.1 — Chặn IDOR/rò rỉ PII ở điểm danh `[H-1]`
`LessonLogService.buildAttendance()`

```java
// Nạp roster MỘT lần, từ chối mọi studentId ngoài lớp.
Set<Long> memberIds = classStudentRepository.findByIdClassId(classId).stream()
        .map(cs -> cs.getId().getStudentId())
        .collect(Collectors.toSet());
// trong vòng lặp:
if (!memberIds.contains(input.studentId())) {
    throw new BadRequestException("Học viên #" + input.studentId() + " không thuộc lớp này.");
}
```

**Điểm cần cẩn trọng:** frontend **cố ý** gửi lại điểm danh của học viên **đã rời lớp** (`AttendanceTab.tsx:184-188`, biến `preserved`) để việc sửa log không xoá mất lịch sử của họ. Nếu chỉ chặn theo roster hiện tại sẽ **phá tính năng này**.

→ **Roster hợp lệ phải là hợp của:** học viên đang trong lớp **∪** học viên đã có dòng điểm danh trên chính log đang sửa. Với `createLog` thì chỉ lấy roster hiện tại.

- [x] Test: teacher gửi `studentId` ngoài lớp → 400, **không** có hàng nào được ghi
- [x] Test: sửa log giữ nguyên học viên đã rời lớp → vẫn thành công (chống hồi quy)
- [x] Test: response không còn chứa `email` của user ngoài lớp (verify `userRepository` không được gọi)
- [x] Áp cùng lúc cho `createLog` **và** `updateLog`

### Đ0.2 — Sửa vỡ giao dịch khi cập nhật điểm danh `[H-2]`
`LessonLogService.updateLog()`

**Đã chọn phương án 1** (tối thiểu, rủi ro thấp). Phương án 2 vẫn đáng làm ở Đợt 4 để khử `L-2`:

1. **Vá tối thiểu:** `attendanceRepository.flush()` ngay sau `deleteByIdLessonLogId(logId)`.
2. **Upsert tại chỗ:** so sánh diff tập cũ ↔ mới — cập nhật `status`/`note` hàng còn, xoá hàng thừa, chỉ chèn hàng mới. Bỏ hẳn chu trình xoá-tất-chèn-lại.

- [x] Test: sửa log **giữ nguyên sĩ số** (ca phổ biến nhất) → `InOrder` delete → flush → saveAll
- [x] Test: sửa log có thêm/bớt học viên → kết quả DB đúng

### Đ0.3 — Diệt buổi ma khi dời lịch `[H-3]`
`ClassScheduleService.regenerate()`

Khi một buổi bị dời sang ngày khác, `keptDates` neo theo `startAt` **mới** nên ngày gốc bị coi là "trống" và được sinh lại.

**Đã chọn phương án (b)** — thêm cột `original_date`, `keptDates` neo theo ô lịch gốc.

Phương án (a) (`pattern_id = NULL` khi dời) **đã được loại vì không sửa được lỗi**: ngày gốc vẫn nằm trong
`patternOccurrenceDates` nên vẫn bị sinh lại, chỉ khác là buổi đã dời không còn được job quản.

- [x] Test: dời Thứ Hai → Thứ Tư → **không** sinh lại buổi Thứ Hai
- [x] Test: dời **lùi** về quá khứ → ô gốc vẫn được giữ
- [x] Test: dời hai lần → giữ ô gốc đầu tiên (write-once)
- [x] Test: buổi ad-hoc / chỉ đổi phòng → không chốt ô gốc
- [ ] Mở rộng `ClassScheduleIT` (cần Postgres thật — chưa chạy)

---

## Đợt 1 · Chuẩn hoá số liệu chuyên cần — ✅ ĐÃ THỰC HIỆN 2026-07-20

**Mục tiêu:** một công thức duy nhất, đúng, dùng chung cho báo cáo — bản in — chứng chỉ. Đây là đợt **ảnh hưởng trực tiếp tới quyền lợi học viên**.

### Đ1.1 — Sửa mẫu số `[M-1, M-2, M-3]`
`StudentEvaluationService.java:228-254`

```java
// Mẫu số = số buổi CÓ GHI NHẬN của chính học viên này,
// không phải toàn bộ nhật ký của lớp.
int recorded = presentCount + lateCount + absentCount;
boolean hasAttendanceEvidence = recorded > 0;
double attendanceRate = hasAttendanceEvidence
        ? (double) (presentCount + lateCount) / recorded
        : 0.0;
```

Sửa đúng chỗ này giải quyết **cả ba** phát hiện cùng lúc:
- `M-1` học viên vào muộn không còn bị đánh trượt oan;
- `M-2` log "chỉ ghi chủ đề" không còn làm phình mẫu số (vì không có dòng điểm danh nào);
- `M-3` bản in PDF và tab Đánh giá khớp nhau (cả hai cùng hiểu "không có dòng = không tính").

- [x] Test: lớp 20 buổi, HV vào từ buổi 13, có mặt đủ 8 buổi → **100%**, đủ điều kiện chứng chỉ
- [x] Test: 10 log, 4 log không điểm danh ai, HV có mặt cả 6 buổi còn lại → **100%**
- [x] Test: HV chưa có dòng điểm danh nào → `0%` + không đủ điều kiện (**không** để hoá 100%)
- [x] Test: HV vắng thật → tỉ lệ vẫn giảm đúng
- [x] Đổi tên trường `totalSessions`→`recordedSessions` (DTO + FE + trang v1) để tên khớp nghĩa mới

> ⚠️ **Ảnh hưởng dữ liệu:** sau khi sửa, một số học viên **đang** bị đánh "không đủ điều kiện" sẽ chuyển thành "đủ điều kiện". Cần rà lại danh sách chứng chỉ bị từ chối trước đây. Chứng chỉ **đã cấp** không bị ảnh hưởng (đã xác minh: `OrgCertificate` lưu snapshot bất biến).

### Đ1.2 — Chốt một nguồn sự thật
- [x] Đã xác minh: **không nơi nào ở FE tự tính lại tỉ lệ %** — chỉ hiển thị số backend trả về
- [x] Không cần đổi gì thêm

---

## Đợt 2 · Toàn vẹn dữ liệu & lược đồ

**Migration: `V265__cham_cong_integrity.sql`**

### Đ2.1 — Chặn nhật ký trùng buổi `[M-6, L-4]`

```sql
-- Một lớp chỉ có một nhật ký cho mỗi (ngày, số buổi).
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_lesson_logs_session
    ON class_lesson_logs(class_id, session_date, session_number)
    WHERE session_number IS NOT NULL;

-- Khi không đánh số buổi, chặn trùng theo ngày.
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_lesson_logs_date
    ON class_lesson_logs(class_id, session_date)
    WHERE session_number IS NULL;

-- Chặn chèn trùng buổi lịch giữa job và thao tác tương tác.
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_sessions_pattern_start
    ON class_sessions(pattern_id, start_at)
    WHERE pattern_id IS NOT NULL;
```

> ⚠️ **Bắt buộc dọn dữ liệu trùng TRƯỚC khi tạo index** — nếu không migration sẽ thất bại trên prod. Viết script khảo sát đếm số bản trùng trước, quyết định gộp hay giữ bản mới nhất.

- [ ] Script khảo sát số lượng trùng trên prod (truy vấn đã sẵn ở §5; **chưa chạy** vì cần quyền prod)
- [ ] `createLog` bắt `DataIntegrityViolationException` → trả **409** kèm thông báo rõ (`GlobalExceptionHandler` đã trả 409 sẵn, chỉ cần thông điệp thân thiện)

### Đ2.2 — Ràng buộc enum ở tầng DB `[P-1]`

```sql
ALTER TABLE class_attendance
    ADD CONSTRAINT chk_class_attendance_status
    CHECK (status IN ('PRESENT','LATE','ABSENT'));
```
Theo đúng tiền lệ V249 đã làm cho `cefr_level`. Hiện chỉ `buildAttendance` chặn — mọi writer tương lai đều có thể ghi giá trị lạ.

### Đ2.3 — Gỡ chặn xoá tài khoản giáo viên `[M-8]`

```sql
ALTER TABLE class_lesson_logs DROP CONSTRAINT IF EXISTS class_lesson_logs_created_by_fkey;
ALTER TABLE class_lesson_logs
    ADD CONSTRAINT class_lesson_logs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
```

> 🔴 **Rủi ro tuân thủ App Store 5.1.1(v)**: giáo viên đã ghi nhật ký hiện **không xoá được tài khoản**. Nên ưu tiên hạng mục này ngang Đợt 0.

- [ ] Test tích hợp: xoá tài khoản GV đã có nhật ký → thành công, log giữ nguyên với `created_by = NULL`

---

## Đợt 3 · Nhất quán trạng thái "đã dạy"

**Vấn đề gốc:** hệ không phân biệt được bài "đã dạy vì có nhật ký chứng minh" với bài "giáo viên tự tick tay". Nên khi nhật ký mất đi, không biết có nên gỡ đánh dấu không.

### Đ3.1 — Phân biệt nguồn gốc đánh dấu `[M-4, M-5]`

**Migration `V265`** (gộp chung file):
```sql
ALTER TABLE class_lessons
    ADD COLUMN IF NOT EXISTS completed_source VARCHAR(16);
-- 'LOG' = auto-complete từ nhật ký · 'MANUAL' = tick tay ở tc-checklist
COMMENT ON COLUMN class_lessons.completed_source IS
    'Nguồn đánh dấu đã dạy: LOG (tự động từ nhật ký) hoặc MANUAL (giáo viên tick tay)';
```

Quy tắc:
- `autoCompleteLesson` đặt `completed_source = 'LOG'`; tick tay ở `ClassLessonService` đặt `'MANUAL'`.
- `deleteLog` / `updateLog` đổi `lesson_id`: nếu bài cũ có `completed_source = 'LOG'` **và không còn nhật ký nào trỏ tới** → gỡ `completed`.
- Bài `'MANUAL'` **không bao giờ** bị gỡ tự động (tôn trọng ý định hiện tại của mã).

- [ ] Test: tạo log gắn L3 → xoá log → L3 hết `completed`
- [ ] Test: tạo log gắn L3 → sửa sang L2 → L3 hết `completed`, L2 `completed`
- [ ] Test: tick tay L4 rồi xoá một log không liên quan → L4 **giữ nguyên** `completed`
- [ ] Test: hai log cùng trỏ L5, xoá một → L5 **vẫn** `completed`
- [ ] Backfill: bản ghi cũ để `completed_source = NULL` → coi như `MANUAL` (an toàn, không gỡ nhầm)

### Đ3.2 — Chặn ngày dạy ở tương lai `[M-7]`
- [x] Validate `sessionDate <= hôm nay` (giờ VN) trong `createLog`/`updateLog` — đã làm cùng M-6/M-7
- [ ] Cân nhắc biên dưới hợp lý (ví dụ không quá 1 năm về trước), tham chiếu `PLANNED_MIN/MAX` ở `ClassLessonService`

---

## Đợt 4 · Gọt giũa frontend & trải nghiệm

| Việc | Mã | Ghi chú |
|---|---|---|
| Hiện thông báo lỗi thật từ backend | `L-6` | `catch (e) { toast.error(apiMessage(e) \|\| t('attendance.saveError')) }` ở cả 3 handler ghi của `AttendanceTab` + `EvaluationTab`. Quan trọng hơn sau Đợt 2 vì sẽ có 409 "trùng buổi" cần giải thích cho giáo viên. |
| Chốt chống response cũ | `L-7` | Nhân bản `loadSeq` từ `tc-reports` sang `tc-progress/page.tsx` |
| Validate `sessionNumber` | `L-3` | Client: `Math.trunc` + `min=1` + `step=1`. Server: từ chối `<= 0` |
| Khử trùng `studentId` trong request | `L-1` | Ném 400 nếu một `studentId` xuất hiện 2 lần |
| Bỏ `SELECT` thừa đường ghi | `L-2` | `ClassAttendance implements Persistable<ClassAttendanceId>`. **Tự khỏi** nếu Đ0.2 chọn phương án upsert |
| A11y bảng in | — | Thêm `scope="col"/"row"` và nhãn cho ô góc |
| Thêm `@NotNull` + `@Valid` | — | Đổi 409 khó hiểu thành 400 rõ nghĩa (xem đính chính mục 5.1 của báo cáo) |
| i18n | — | Mọi chuỗi lỗi mới phải có đủ `teacher.{vi,en,de}.json` |

### Quyết định sản phẩm còn treo `[P-2, P-3, P-4]`
- [ ] `P-2`: thêm `ORDER BY teacher_id` cho `primaryTeacherOf` (rẻ, nên làm) — hoặc bỏ hẳn tối ưu tránh-trùng-lịch khi lớp không có `PRIMARY`
- [ ] `P-3`: khi `rollForward` bỏ một buổi học viên **đã thấy** do trùng lịch mới — có phát `CLASS_SESSION_CANCELLED` không? **Cần chủ sản phẩm quyết**
- [ ] `P-4`: phân trang `getLogs` — hoãn tới khi có lớp dài hạn thật

---

# NỬA B — NÂNG CẤP KIẾN TRÚC

> ⛔ **Điều kiện khởi động:** hoàn tất Đợt 0–2 và có nhu cầu nghiệp vụ xác nhận (trả công theo buổi/giờ, đối soát B2B). Không làm nửa B "cho đủ".

## ~~Đợt 5~~ · Nối lịch dạy ↔ nhật ký `[G1, G2]` — ⚠️ THAY THẾ BỞI §7

> Phần dưới là bản nháp ban đầu, giữ lại để tham chiếu. Thiết kế thực thi nằm ở **§7** (đã xây xong V263/V264).

**Vấn đề:** hai khối dữ liệu hoàn toàn rời nhau. Không trả lời được *"buổi nào đã lên lịch mà chưa dạy?"*

**Migration `V264__lesson_log_session_link.sql`:**
```sql
-- G1: nối nhật ký với buổi đã lên lịch
ALTER TABLE class_lesson_logs
    ADD COLUMN IF NOT EXISTS session_id BIGINT;
ALTER TABLE class_lesson_logs
    ADD CONSTRAINT fk_class_lesson_logs_session
    FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_lesson_logs_session
    ON class_lesson_logs(session_id) WHERE session_id IS NOT NULL;

-- G2: trạng thái "đã dạy" của buổi lịch
ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS taught_at TIMESTAMPTZ;
```

**Vì sao dùng cột `taught_at` riêng thay vì thêm giá trị vào `ClassSession.Status`?**
`SCHEDULED / CANCELLED / MOVED` mô tả **trạng thái lập lịch**; "đã dạy" là **trạng thái thực hiện**. Hai chiều độc lập — một buổi có thể vừa `MOVED` vừa đã dạy. Gộp vào một enum sẽ mất thông tin.

**Backfill:** ghép `class_lesson_logs` ↔ `class_sessions` theo `(class_id, session_date)`; ca mơ hồ (nhiều buổi cùng ngày) để `NULL` và báo cáo cho người vận hành xử lý tay.

**Giá trị thu được:**
- Đối soát "lên lịch vs thực dạy" theo lớp và theo giáo viên
- Cảnh báo buổi đã qua mà chưa có nhật ký (nhắc giáo viên ghi công)
- Giao diện ghi nhật ký có thể **chọn từ buổi đã lên lịch** thay vì gõ tay ngày — khử luôn phần lớn nguy cơ trùng ở `M-6`

## ~~Đợt 6~~ · Chấm công thực thụ `[G3, G4]` — ⚠️ THAY THẾ BỞI §7

> Bản nháp ban đầu. Xem **§7.3** cho lược đồ đã thực thi (khác bản nháp này: có `teacher_session_record` riêng, snapshot, và `UNIQUE(teacher_id, started_at)`).

**Migration `V265__teacher_timesheet.sql`:**

```sql
-- G3: thời lượng thực dạy (mặc định kế thừa từ buổi đã lên lịch)
ALTER TABLE class_lesson_logs
    ADD COLUMN IF NOT EXISTS duration_minutes INT;

-- G4: kỳ công + quy trình duyệt/khoá sổ
CREATE TABLE IF NOT EXISTS teacher_timesheet_period (
    id           BIGSERIAL PRIMARY KEY,
    org_id       BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    teacher_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    status       VARCHAR(16) NOT NULL DEFAULT 'OPEN'
                 CHECK (status IN ('OPEN','SUBMITTED','APPROVED','LOCKED')),
    total_sessions INT NOT NULL DEFAULT 0,
    total_minutes  INT NOT NULL DEFAULT 0,
    approved_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at  TIMESTAMPTZ,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (teacher_id, period_start, period_end)
);
```

**Năng lực mới:**

| Năng lực | Mô tả |
|---|---|
| Bảng công theo kỳ | Giáo viên xem tổng buổi + tổng phút theo tháng, đối chiếu lịch vs thực dạy |
| Nộp & duyệt | `OPEN → SUBMITTED → APPROVED → LOCKED`; sau `LOCKED` nhật ký trong kỳ **không sửa được** |
| Console quản lý | `MANAGER`/`OWNER` duyệt công theo tổ chức (tận dụng phân quyền B2B sẵn có) |
| Xuất dữ liệu | CSV/PDF cho kế toán |

**Quy tắc bất biến bắt buộc:** một khi kỳ công `LOCKED`, `createLog`/`updateLog`/`deleteLog` phải **từ chối** mọi thay đổi có `session_date` nằm trong kỳ đó. Không có quy tắc này thì toàn bộ quy trình duyệt là hình thức.

> **Vẫn nằm ngoài phạm vi:** đơn giá, tiền lương, thuế. Kế hoạch này dừng ở việc **ghi nhận và chốt số công**; phần tiền nên tích hợp hệ kế toán ngoài thay vì tự xây.

---

## 1. Trình tự & phụ thuộc

```
Đ0 (HIGH, không migration) ──┐
Đ2.3 (FK xoá tài khoản)  ────┴─→ triển khai sớm nhất
                 │
Đ1 (số liệu) ────┤   ← Đ1 độc lập với Đ2, chạy song song được
Đ2 (ràng buộc) ──┤   ← cần dọn dữ liệu trùng trước
Đ3 (đã dạy) ─────┘   ← cần cột completed_source ở V265
                 │
Đ4 (FE) ─────────┘   ← nên sau Đ2 để hiển thị đúng lỗi 409
                 │
        ═══ chốt nửa A ═══
                 │
Đ5 (nối lịch↔log) ──→ Đ6 (bảng công)   ← chỉ khi có nhu cầu nghiệp vụ
```

| Đợt | Migration | Rủi ro | Triển khai được ngay? |
|---|---|---|---|
| Đ0 | — | Thấp | ✅ |
| Đ1 | — | **Trung bình** (đổi kết quả đủ-điều-kiện chứng chỉ) | ✅ sau khi rà danh sách bị từ chối |
| Đ2 | V265 | **Cao** (index unique có thể fail nếu tồn dữ liệu trùng) | ⚠️ phải khảo sát prod trước |
| Đ3 | V265 (gộp) | Thấp | ✅ |
| Đ4 | — | Thấp | ✅ |
| Đ5 | V264 | Trung bình (backfill mơ hồ) | ⛔ chờ quyết định |
| Đ6 | V265 | Cao (quy trình nghiệp vụ mới) | ⛔ chờ quyết định |

## 2. Kiểm thử

**Đã có sẵn để mở rộng:** `LessonLogServiceTest`, `ClassScheduleServiceTest`, `StudentEvaluationServiceTest`, `TeacherReportServiceTest`, `OrgCertificateServiceTest`, `ClassScheduleIT`, `AttendanceTab.test.tsx`.

- [ ] Mỗi phát hiện CONFIRMED phải có **một test đỏ trước khi vá** (theo TDD của dự án)
- [ ] `ClassScheduleIT` cần Postgres thật: `DEUTSCHFLOW_IT_JDBC_URL` + `TZ=UTC` + DB sạch
- [ ] IT bị skip trong CI → **chạy tay trước lần deploy đầu có V262/V263**
- [ ] Ngưỡng bao phủ dự án: 80%

## 3. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| V263 fail trên prod do dữ liệu trùng sẵn có | Chạy script khảo sát + dọn **trước**; tách migration dọn dữ liệu khỏi migration tạo index |
| Đ1 làm đổi kết quả chứng chỉ đang hiển thị | Rà danh sách học viên từng bị từ chối; thông báo cho trung tâm trước khi bật |
| Đ0.1 chặn nhầm học viên đã rời lớp | Roster hợp lệ = đang-trong-lớp **∪** đã-có-dòng-trên-log-này. Có test hồi quy riêng |
| Đ3 backfill gỡ nhầm bài tick tay | `completed_source = NULL` (bản ghi cũ) được coi là `MANUAL` — không bao giờ gỡ tự động |
| Trùng số migration với nhánh khác | V262 đã dùng cho Đợt 0. Xác nhận lại ngay trước khi tạo file |

## 4. Việc cần chủ sản phẩm quyết

1. **Đ0.3** — dời buổi thì tách khỏi mẫu (a) hay giữ quan hệ qua `original_date` (b)?
2. **P-3** — job bỏ buổi học viên đã thấy: có thông báo không?
3. **Nửa B** — có nhu cầu chấm công theo giờ và duyệt công thật không, hay chỉ cần đếm buổi?

---

## 5. Việc mới phát sinh từ rà soát bản vá Đợt 0

Sau khi vá, một workflow 49 tác tử đã tấn công lại chính bản vá (8 CONFIRMED · 10 SPLIT · 4 REFUTED).
Những mục dưới đây **chưa xử lý**, xếp theo mức độ:

| # | Mức | Nội dung | Vì sao chưa làm |
|---|---|---|---|
| ~~N-1~~ | ~~HIGH~~ | ~~`addStudentToClassByEmail` không kiểm tra tổ chức~~ | ✅ **ĐÃ VÁ 2026-07-20** — mirror quy tắc `addCoTeacher`, +3 test. |
| N-2 | **MEDIUM** | `getLogs()` vẫn tra `userRepository.findAllById` không lọc → **hàng rác có sẵn từ trước bản vá vẫn rò PII**. Bản vá chỉ chặn ghi mới. | Cần **truy vấn kiểm đếm trên prod trước**. ⚠️ Người kiểm chứng cảnh báo: **KHÔNG** lọc theo roster ở đường đọc — sẽ phá hành vi `preserved` (HV đã rời lớp sẽ mất tên/email trong lịch sử). Cách đúng: migration dọn một lần. |
| ~~N-3~~ | ~~HIGH~~ | ~~`tc-reports/page.tsx:111` fallback roster từ lesson log → guard H-1 chặn GV lưu mọi nhật ký~~ | ✅ **ĐÃ XỬ LÝ 2026-07-20** — xem §6. |
| N-4 | MEDIUM | Trang **v1** `/teacher/reports:227` vẫn xoá trắng điểm danh của HV đã rời lớp khi sửa nhật ký (không có nhánh `preserved`). | Cây v1 đang chờ xoá (kế hoạch riêng). |
| N-5 | MEDIUM | `deletePattern` rồi tạo lại mẫu cùng thứ → **nhân đôi** buổi đã chỉnh tay; `original_date` không cứu được vì ô lịch khoá theo `pattern_id`. | Lỗi có sẵn, ngoài phạm vi Đợt 0. |
| N-6 | MEDIUM | Bản ghi **đã bị dời trước V262** có `original_date` NULL → buổi ma cũ vẫn còn. | Cần backfill suy luận theo `day_of_week` của pattern; gộp vào V263. |

**Truy vấn kiểm đếm cho N-2** (chạy trên prod trước khi quyết định):
```sql
SELECT COUNT(*) FROM class_attendance a
JOIN class_lesson_logs l ON l.id = a.lesson_log_id
WHERE NOT EXISTS (
  SELECT 1 FROM class_students cs
  WHERE cs.class_id = l.class_id AND cs.student_id = a.student_id);
```
Nếu kết quả **0** → chưa từng bị khai thác, không cần dọn gì thêm.

## 6. N-3 đã xử lý — tách "roster để nhập" khỏi "roster để hiển thị"

**Gốc lỗi:** `tc-reports/page.tsx` dùng **một** biến `roster` cho hai mục đích trái ngược nhau — dựng form
nhập điểm danh **và** dựng bảng in. Fallback tầng 3 (suy ra từ chính lesson log) chỉ đúng cho bảng in;
đưa vào form nhập thì gửi lên cả học viên **đã rời lớp**, và guard H-1 mới sẽ từ chối → GV không lưu được
gì, chỉ thấy toast lỗi chung chung.

**Cách sửa:** tách làm hai, theo đúng ngữ nghĩa:

| Biến | Nguồn | Dùng cho |
|---|---|---|
| `roster` | `gradebook` → `evaluations`. **Không** có fallback từ lesson log. | Form nhập điểm danh (thẩm quyền) |
| `printRoster` | `roster`, nếu rỗng thì suy từ lesson log | Bảng in (chỉ đọc) |

Khi cả hai endpoint ghi danh cùng lỗi: form **vẫn lưu được** chủ đề + bài tập, phần điểm danh hiện thông
báo `attendance.rosterUnavailable` giải thích lý do (3 ngôn ngữ), và **bảng in vẫn liệt kê đủ học viên**
nên lịch sử không mất. Sửa nhật ký cũ vẫn giữ nguyên điểm danh của HV đã rời lớp (`preserved` không đổi —
`roster` rỗng ⇒ toàn bộ dòng cũ được giữ lại, backend cho qua nhờ vế "đã có trên chính log đó").

**Kiểm thử:** +2 test (1 tầng component, 1 tầng page). Đã thử phá lại logic cũ ở **cả hai tầng** —
mỗi lần đều có test đỏ đúng chỗ. FE: 307 test xanh, i18n parity 2099 key × 3 locale, typecheck sạch.

> ⚠️ **Chưa kiểm thử trên trình duyệt thật:** kịch bản này chỉ xuất hiện khi *hai* endpoint cùng lỗi,
> không dựng lại được trong preview nếu không giả lập. Bù lại, test tầng page render **component thật**
> (không mock ui-v2) đúng ở trạng thái degraded đó.

## 7. Tầng chấm công thật (mục đích sản phẩm) — thiết kế đã chốt

> **Đây không còn là "Nửa B tuỳ chọn".** Mục đích của cụm này là **tính công đi làm và lương giáo viên,
> tổng hợp phía manager**. Phần dưới thay thế Đợt 5–6 ở trên.

### 7.1 Quyết định đã chốt

| Câu hỏi | Chốt |
|---|---|
| Đơn vị tính công | **Cả hai** — theo buổi hoặc theo giờ, cấu hình theo lớp/hợp đồng |
| Quy trình | **GV nộp → manager duyệt → khoá kỳ** (`OPEN→SUBMITTED→APPROVED→LOCKED`) |
| Tiền lương | **Không** lưu đơn giá, không tính tiền — chỉ chốt số công rồi xuất ra ngoài |

### 7.2 Vấn đề gốc phải giải quyết trước

Hệ hiện tại ghi *"học viên Y có mặt"*, **không** ghi *"giáo viên X đã dạy"*. Không thể suy cái sau từ cái
trước, vì: một lớp có nhiều giáo viên (`class_teachers`: `PRIMARY`/`ASSISTANT`), và `class_lesson_logs.created_by`
chỉ là *người nhập liệu*, không phải *người đứng lớp*. Nên **bản ghi công phải là một bảng riêng**.

### 7.3 Mô hình dữ liệu đề xuất

```sql
-- V263: bản ghi công của GIÁO VIÊN (khác sổ điểm danh học viên)
CREATE TABLE teacher_session_record (
    id             BIGSERIAL PRIMARY KEY,
    teacher_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    class_id       BIGINT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    session_id     BIGINT REFERENCES class_sessions(id) ON DELETE SET NULL,  -- G1: nối lịch
    lesson_log_id  BIGINT REFERENCES class_lesson_logs(id) ON DELETE SET NULL,
    session_date   DATE NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),              -- G3
    role           VARCHAR(16) NOT NULL DEFAULT 'PRIMARY',                   -- PRIMARY | ASSISTANT
    period_id      BIGINT REFERENCES teacher_timesheet_period(id) ON DELETE SET NULL,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (teacher_id, session_date, class_id, session_id)                  -- chống trả thừa công
);

-- V264: kỳ công + quy trình duyệt (G4)
CREATE TABLE teacher_timesheet_period (
    id           BIGSERIAL PRIMARY KEY,
    org_id       BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    teacher_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    pay_unit     VARCHAR(8) NOT NULL DEFAULT 'SESSION' CHECK (pay_unit IN ('SESSION','HOUR')),
    status       VARCHAR(16) NOT NULL DEFAULT 'OPEN'
                 CHECK (status IN ('OPEN','SUBMITTED','APPROVED','LOCKED')),
    total_sessions INT NOT NULL DEFAULT 0,
    total_minutes  INT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    approved_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at  TIMESTAMPTZ,
    note         TEXT,
    UNIQUE (teacher_id, period_start, period_end)
);

-- Đơn vị tính công theo lớp (ghi đè mặc định của kỳ)
ALTER TABLE teacher_classes ADD COLUMN IF NOT EXISTS pay_unit VARCHAR(8);
```

### 7.4 Quy tắc bất biến (không có thì quy trình duyệt vô nghĩa)

1. **Kỳ đã `LOCKED` ⇒ chặn mọi thay đổi** với `session_date` nằm trong kỳ — áp ở `LessonLogService`
   (create/update/delete) **và** ở service bản ghi công. Đây là ràng buộc quan trọng nhất của cả tầng này.
2. **Chỉ manager/owner cùng tổ chức** mới được `APPROVED`/`LOCKED`; giáo viên chỉ được `SUBMITTED`.
3. **Tổng số công chốt tại thời điểm duyệt** phải là snapshot (`total_sessions`/`total_minutes`), không tính
   lại động — nếu không, sửa dữ liệu sau khi duyệt sẽ âm thầm đổi số đã trả.
4. Bản ghi công **không tự sinh** từ nhật ký: giáo viên xác nhận buổi mình dạy (hoặc hệ đề xuất từ
   `class_sessions` + nhật ký để họ xác nhận một chạm).

### 7.5 Bề mặt còn thiếu

| Phía | Cần xây |
|---|---|
| Giáo viên | Trang bảng công theo kỳ: buổi đã dạy, tổng giờ, đối soát lịch ↔ thực dạy, nút **Nộp** |
| Manager | Màn hình tổng hợp toàn tổ chức: danh sách GV × kỳ, duyệt/trả lại, **khoá kỳ**, xuất CSV/PDF |
| Backend | Service + controller cho bản ghi công và kỳ công; chốt chặn kỳ khoá; tổng hợp org-scoped |

> Console MANAGER/OWNER đã có sẵn (`ManagerDashboard`/`OwnerDashboard`, PR #218) — bổ sung mục chấm công
> vào đó thay vì dựng nav mới.

### 7.6 Thứ tự đề xuất

1. **Đ7.1** ✅ — Chốt chặn dữ liệu trả lương: M-6, M-7 đã xong. Còn: unique index ở DB sau khi dọn dữ liệu trùng.
2. **Đ7.2** ✅ — `teacher_session_record` (V263) + service + API + màn hình giáo viên.
3. **Đ7.3** ✅ — Kỳ công + quy trình duyệt (V264) + **chốt chặn kỳ khoá**.
4. **Đ7.4** 🟡 — Màn hình manager ✅; **xuất CSV/PDF chưa có**.
5. **Đ7.5** ✅ (một phần) — Đề xuất buổi đã qua chưa ghi công đã có trong bảng công GV.

### 7.7 Đ7.2 đã làm được gì (2026-07-20)

| File | Nội dung |
|---|---|
| `V263__teacher_session_record.sql` | Bảng ghi công + `teacher_classes.pay_unit` (CHECK `SESSION`/`HOUR`) |
| `TeacherSessionRecord.java` | Entity, enum `PRIMARY/ASSISTANT/SUBSTITUTE` |
| `TeacherSessionRecordRepository.java` | Truy vấn theo kỳ cho GV + `findForOrgInRange` cho manager |
| `TeacherTimesheetService.java` | Ghi/sửa/xoá dòng công, đề xuất buổi chưa ghi, tổng hợp kỳ |
| `TeacherTimesheetController.java` | `/api/v2/teacher/timesheet` |
| `TimesheetDtos.java` | DTO — **không có trường nào về tiền** |

**Ba quyết định thiết kế đáng ghi lại:**

1. **Snapshot là nguồn sự thật.** `started_at`, `duration_minutes`, `org_id`, `class_name_snapshot`
   chốt vào chính dòng công; các FK đều `ON DELETE SET NULL`. Lý do cụ thể: `regenerate()` **xoá thật**
   buổi tương lai chưa chỉnh tay rồi sinh lại, và xoá lớp thì cascade xuống buổi — join live sẽ khiến
   số công đã duyệt đổi hoặc biến mất sau lưng người duyệt. Cùng nguyên tắc `OrgCertificate` (V214).
2. **Chống trả thừa công bằng `UNIQUE (teacher_id, started_at)`**, không phải `(lớp, ngày)`: một GV
   dạy hai ca/ngày là hợp lệ, nhưng không ai đứng hai lớp cùng lúc. Khoá theo `session_id` sẽ lọt
   trùng với buổi ad-hoc vì Postgres coi mọi NULL là khác nhau.
3. **Không tự sinh bản ghi công.** Lịch chỉ nói "lớp có buổi lúc đó", không nói ai dạy —
   `class_sessions` không có `teacher_id`, lớp có 1 PRIMARY + N ASSISTANT, còn có dạy thay. Hệ chỉ
   *đề xuất* để GV xác nhận một chạm.

### 7.8 Đ7.3 + Đ7.4 đã làm được gì (2026-07-20)

| File | Nội dung |
|---|---|
| `V264__teacher_timesheet_period.sql` | Kỳ công + `period_id` trên dòng công; CHECK đủ 5 trạng thái |
| `TeacherTimesheetPeriod.java` | Entity + `isEditable()` — chỉ `OPEN`/`REJECTED` mới sửa được |
| `TimesheetPeriodService.java` | Nộp / duyệt / trả lại / khoá + `assertRecordEditable` |
| `OrgTimesheetController.java` | `/api/org/timesheet` — `isAuthenticated()` + `OrgGuard.assertOrgAdmin` |
| `timesheetApi.ts` | Client cho cả hai surface |
| `v2/org/timesheets/page.tsx` | Màn hình tổng hợp + duyệt của manager |
| `v2/teacher/tc-timesheet/page.tsx` | Bảng công giáo viên + nút Nộp |
| `nav.ts` + i18n ×3 | 2 mục sidebar; `org-timesheets` **không** đặt `ownerOnly` để MANAGER thấy |

**Ba điểm thiết kế đáng ghi:**

1. **`SUBMITTED` cũng khoá, không chỉ `APPROVED`/`LOCKED`.** Nếu giáo viên còn sửa được trong lúc
   manager đang xem thì thứ được duyệt sẽ khác thứ đã nộp.
2. **Snapshot tổng số công tại MỖI lần chuyển trạng thái**, không tính động khi đọc — sửa dữ liệu sau
   khi duyệt không được phép âm thầm đổi con số đã trả lương.
3. **Hai lớp kiểm tra khi duyệt**: `OrgGuard.assertOrgAdmin` (đọc `org_members` từ DB, không tin JWT)
   *và* `period.orgId == orgId` để chặn duyệt chéo tổ chức.

> ⚠️ **Lệch có chủ ý so với §7.4 quy tắc 1:** kế hoạch ghi khoá kỳ phải chặn cả `LessonLogService`.
> Đã **không** làm vậy. Từ khi tách bảng ghi công (V263), sổ điểm danh học viên không còn là dữ liệu
> lương; đóng băng nó theo kỳ lương sẽ cản giáo viên bổ sung điểm danh sót cho buổi đã qua. Khoá kỳ
> chỉ chặn dòng công.

### 7.9 Việc tiếp theo

- **Xuất CSV/PDF** bảng công cho kế toán (Đ7.4 còn thiếu).
- **Cấu hình `pay_unit`** theo lớp: cột đã có (V263) nhưng chưa có UI đặt giá trị.
- **Test tích hợp** cho V263/V264 trên Postgres thật (unique index, CHECK, FK) — unit test hiện dùng mock.
- ✅ **QA luồng thật ĐÃ CHẠY (2026-07-20) — 20/20 đạt.** Backend thật + Postgres thật + JWT thật,
  chạy từ worktree sạch của nhánh PR. Kịch bản: `scratchpad/qa_flow.sh`.

  Đã chứng minh trên hệ chạy thật, không phải mock:
  | Kiểm chứng | Kết quả |
  |---|---|
  | Buổi đã dạy hiện ở gợi ý, ghi công snapshot đúng 90 phút | ✓ |
  | Ghi trùng cùng buổi → **409** (chống trả thừa công) | ✓ |
  | Ghi công buổi chưa dạy → **400** | ✓ |
  | Nộp kỳ → `SUBMITTED`, snapshot 1 buổi / 90 phút | ✓ |
  | **Xoá dòng công trong kỳ đã nộp → 409** (chốt làm quy trình duyệt có nghĩa) | ✓ |
  | **Giáo viên tự duyệt kỳ của mình → 403** | ✓ |
  | Manager duyệt → `APPROVED` → khoá → `LOCKED` → khoá lại **409** | ✓ |
  | CSV: BOM UTF-8, tiếng Việt nguyên vẹn, `"LOCKED","SESSION",1,90` | ✓ |

  > Lần chạy đầu 9/20 hỏng — **do seed SQL của tôi thiếu `created_at`**, không phải sản phẩm. Bài học:
  > script QA phải có chốt kiểm tra seed, im lặng ở bước dựng dữ liệu làm mọi kiểm chứng sau đó vô nghĩa.

## Nhật ký tiến độ

| Ngày | Đợt | Trạng thái | Ghi chú |
|---|---|---|---|
| 2026-07-20 | — | 📋 Lập kế hoạch | Rà soát 96 tác tử, 20 CONFIRMED. Chưa viết mã. |
| 2026-07-20 | **Đ0** | ✅ Đã vá (chưa commit) | H-1 biên roster · H-2 flush trước khi chèn lại · H-3 `original_date` (V262) **+ vá tiếp lỗ hổng dời-lùi** do rà soát tìm ra. Bonus: chặn `studentId` trùng (L-1). **1446 test xanh**; 3 phép thử đột biến đều bị test bắt. Phát sinh N-1…N-6 ở §5. |
| 2026-07-20 | **N-3** | ✅ Đã vá (chưa commit) | Tách `roster` (nhập) khỏi `printRoster` (in) ở `tc-reports`; thêm thông báo `attendance.rosterUnavailable` ×3 ngôn ngữ. **FE 307 test xanh**, +2 test hồi quy, đột biến bắt được ở cả tầng component lẫn tầng page. Chi tiết §6. |
| 2026-07-20 | **Đ1** | ✅ Đã vá (chưa commit) | Mẫu số chuyên cần = buổi CÓ ghi nhận của chính học viên (`presentCount+lateCount+absentCount`), không phải `logs.size()`. Đổi tên trường `totalSessions`→`recordedSessions` ở DTO + FE + trang v1 để tên không nói dối. +4 test; đột biến khôi phục mẫu số cũ làm đỏ đúng 4 test. Đ1.2: đã xác minh **không nơi nào ở FE tự tính lại tỉ lệ %**. |
| 2026-07-20 | **N-1** | ✅ Đã vá (chưa commit) | `addStudentToClassByEmail` kiểm tra tổ chức, mirror đúng quy tắc `addCoTeacher` đã có sẵn ở dòng 333 (lớp `orgId=null` giữ nguyên hành vi cũ). +3 test. |
| 2026-07-20 | **M-6, M-7** | ✅ Đã vá (chưa commit) | Nâng lên HIGH sau khi biết dữ liệu này dùng trả lương. Chặn ghi nhật ký cho **ngày tương lai** và chặn **trùng buổi** `(lớp, ngày, số buổi)` → 409. +3 test. Unique index ở DB **hoãn** tới khi dọn xong dữ liệu trùng có sẵn trên prod. |
| 2026-07-20 | — | 📋 Thiết kế | Chốt 3 quyết định tầng chấm công thật (§7.1) và mô hình dữ liệu (§7.3). |
| 2026-07-20 | **Đ7.2** | ✅ Xong (chưa commit) | **V263** `teacher_session_record` + `pay_unit`; entity/repo/service/controller; +11 test → **BE 1467 xanh**. Khảo sát 5 tác tử trước khi viết đã chặn 2 lỗi thiết kế: FK sang `class_sessions` sẽ mất dữ liệu khi `regenerate()` xoá buổi, và `created_by` là người GHI chứ không phải người DẠY. Màn hình GV đã có ở Đ7.4. |
| 2026-07-20 | **Đ7.3** | ✅ Xong (chưa commit) | **V264** kỳ công + vòng đời `OPEN→SUBMITTED→APPROVED→LOCKED` (+`REJECTED`); `assertRecordEditable` cắm vào record/update/delete; chống duyệt chéo tổ chức. +15 test → **BE 1482 xanh**. |
| 2026-07-20 | **Đ7.4** | 🟡 Màn hình xong (chưa commit) | `timesheetApi.ts`, màn hình manager `/v2/org/timesheets`, bảng công GV `/v2/teacher/tc-timesheet`, 2 mục nav, i18n **2167 key × 3 locale parity OK**. FE 307 test xanh, typecheck sạch, hai trang render HTTP 200. **Còn thiếu xuất CSV/PDF.** |
| 2026-07-21 | **Ultra-review** | 🔍 Rà soát vòng 2 | 24 tác tử đối kháng soi chính tầng chấm công vừa xây. Phát hiện lỗ hổng vòng 1 **bỏ sót**: `openPeriod` nhận `from`/`to` tuỳ ý và chỉ có `UNIQUE (teacher_id, period_start)` → **hai kỳ giao ngày nhau** vừa trả lương gấp đôi (`snapshotTotals` đếm theo khoảng ngày, `orgSummary`/CSV cộng cả hai kỳ) vừa gây **500** (`assertRecordEditable` khớp 2 dòng). Chi tiết §8 báo cáo. |
| 2026-07-21 | **HIGH-3** | ✅ Đã vá + push | `openPeriod`: idempotent theo `period_start` → `assertNoOverlap` (409). **V267** `EXCLUDE USING gist (teacher_id =, daterange(start,end,'[]') &&)` + `btree_gist` làm chốt cứng DB. Finder `Optional`→`List` + `assertRecordEditable` dùng stream → khử 500. |
| 2026-07-21 | **MEDIUM ×3** | ✅ Đã vá + push | (1) `snapshotTotals` lọc `belongsToPeriodOrg` — chống dồn công org khác vào kỳ org nhà; (2) modal từ chối kỳ chỉ đóng + xoá lý do KHI thành công (`runAction` trả `boolean`); (3) +4 test guard khoá kỳ cho `updateRecord` (kỳ nguồn **và kỳ đích** khi dời buổi) + `deleteRecord` (IDOR + khoá kỳ). |
| 2026-07-21 | **LOW ×4** | ✅ Đã vá + push | `insertIfAbsent` native upsert (`ON CONFLICT DO NOTHING`) cho `openPeriod` atomic; **V268** gỡ schema chết `period_id`+FK+index; Export CSV bám `loadedRange`; xoá dead client `updateRecord`. |
| 2026-07-21 | **Kiểm chứng** | ✅ Postgres 16 thật | Docker `pgvector/pgvector:pg16`: Flyway áp **266 migration V1→V268** sạch từ DB trống, `ClassScheduleIT` **5/5**; `btree_gist` có sẵn. 8 kiểm SQL đều đạt (EXCLUDE chặn chồng kỳ **và** biên kề chung 1 ngày; kỳ liền kề không chung ngày vẫn chèn được; `insertIfAbsent` idempotent). BE 37/37 unit, FE `tsc` sạch. |
| 2026-07-21 | **PR #242** | 🟢 MERGEABLE / CLEAN | Bản vá fast-forward vào head PR (`1508d280 → 122b8064`), không force. CI toàn xanh (Compile · Unit Tests · build-lint · Semgrep · gitleaks · npm audit). ⚠️ Đính chính: nhóm phát hiện *migration* của review là artifact **bản local stale `9f74a120`**, KHÔNG áp dụng PR #242 (§8.4). **Còn lại: owner quyết merge** — merge = đưa cả feature (V262–V268) lên `main`. |
