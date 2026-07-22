# Báo cáo audit tiền-merge — PR #242 (chấm công giáo viên → `main`)

**Ngày:** 2026-07-22 · **Đối tượng:** PR #242, head `aacf4007`, base `main`
**Vì sao audit:** merge PR này KHÔNG phải vá nhỏ — `main` hiện chưa có tính năng chấm công (migration dừng ở
V261), nên merge đưa **toàn bộ** tính năng lên trunk: V262–V268, domain backend mới, trang frontend mới, i18n,
kèm sửa nhiều file **đã tồn tại từ trước**.

**Phương pháp:** 29 tác tử · 2 tác tử dựng bản đồ + 7 chiều audit + 20 verifier đối kháng. Mỗi phát hiện
HIGH/CRITICAL do 2 tác tử độc lập soi (lens *reproduce* và *refute*) và phải trả lời thêm `blocksMerge`.
~3.31M token, 660 lượt gọi công cụ, 0 tác tử lỗi.

**Khác gì với ultra-review 21/07:** vòng trước soi **diff**. Vòng này soi thứ diff **không thể** thấy — code
mà PR *không* đụng nhưng *phụ thuộc* vào code PR có đụng; các client khác (mobile, web v1); và điều gì xảy ra
khi 7 migration chạy trên **DB production đã có dữ liệu**.

## Kết quả

| | Số lượng |
|---|---|
| 🔴 CONFIRMED chặn merge | **1** |
| ✅ CONFIRMED không chặn | 3 |
| 🟡 PLAUSIBLE (1/2 verifier) | 5 |
| ❌ REFUTED (loại) | 1 |
| MEDIUM / LOW | 28 |

## Khuyến nghị: ⚠️ MERGE AN TOÀN — **NHƯNG ĐỪNG DEPLOY**, và nên vá blocker trước khi merge

Merge không gây hại tức thì: job `Deploy to EC2` trong `.github/workflows/backend-ci.yml:100` đặt **`if: false`**
— không có auto-deploy. Nhưng merge nguyên trạng nghĩa là **cài một cái bẫy vào trunk** mà lần
`./deploy-backend.sh` kế tiếp sẽ giẫm phải.

---

## 🔴 BLOCKER — V266 làm abort deploy giữa chừng, không có đường lùi

**File:** `backend/src/main/resources/db/migration/V266__lesson_log_unique_session.sql:22`

V266 tạo UNIQUE index trên `class_lesson_logs`. Nếu prod còn dòng trùng → `could not create unique index` →
Spring context fail → container GREEN chết → `deploy-backend.sh:382-397` abort.

**Vì sao đây là blocker thật, không phải lo xa:**

1. Chính plan của dự án ghi index này **"hoãn tới khi dọn xong dữ liệu trùng có sẵn trên prod"** — tức đội đã
   khẳng định prod CÓ dữ liệu trùng. PR này vẫn ship index.
2. Checkbox chạy script dọn tại `plans/2026-07-20-nang-cap-cham-cong-giao-vien.md:170` **chưa tick**, ghi rõ
   *"chưa chạy vì cần quyền prod"*.
3. Yêu cầu chạy `survey_timesheet_data_debt.sql` → `dedupe_class_lesson_logs.sql` **chỉ nằm trong comment SQL
   của chính V266**. Grep toàn repo: `deploy-backend.sh` (550 dòng) **0** lần nhắc psql/flyway/migration;
   `plans/2026-06-20-deploy-ops-runbook.md` **0** lần nhắc migration.
4. **CI không thể bắt được:** `backend-ci.yml:66` giới hạn integration-tests ở `push` lên `main`, nên CI của PR
   không áp migration nào; và kể cả sau merge nó chạy trên Testcontainer **rỗng** — DB rỗng đúng là ca *không
   bao giờ* lộ lỗi này. (Lần replay V1→V268 "sạch" hôm 21/07 cũng từ DB trống, nên không phản chứng được.)

**Hậu quả:** prod kẹt vĩnh viễn ở V265 — 266 file `V__`, **0** file `U__`, Flyway Community forward-only;
`deploy-backend.sh` chỉ rollback container, không rollback schema.

**Giảm nhẹ:** V262 (cột nullable), V263/V264 (bảng mới), V265 (FK nới thành SET NULL, CHECK thêm NOT VALID)
đều tương thích ngược với image cũ → hậu quả là **hỏng đợt phát hành**, không phải sự cố với người dùng.

**Cách vá (rẻ nhất):** gộp DML của `dedupe_class_lesson_logs.sql` — vốn idempotent và đã kiểm chứng — vào một
migration đứng **trước** index, để migration tự chữa và bỏ hẳn thao tác tay. Nếu muốn giữ thủ công thì phải
làm **cả hai**: thêm preflight vào `deploy-backend.sh` (chạy truy vấn đếm trùng, abort kèm hướng dẫn) **và**
ghi bước đó vào `plans/2026-06-20-deploy-ops-runbook.md`.

> ⚠️ Xem thêm 2 phát hiện MEDIUM liên quan ở §MED/LOW: script dedupe **tự nó có bug** khi một nhóm trùng có
> ≥3 log, và ngay cả khi dọn đúng, container CŨ vẫn tiếp tục nhận log trùng cho tới lúc GREEN được promote.

---

## ✅ CONFIRMED — không chặn merge nhưng nên vá

### 1. Trang v1 `/teacher/reports` chế ra bằng chứng chuyên cần giả
`frontend/src/app/teacher/reports/page.tsx:229`

Trang v1 **vẫn sống** và khi lưu nhật ký nó ghi `PRESENT` cho **toàn bộ roster**. Dưới mẫu số per-student mà
PR này đưa vào, hệ quả: học viên vào lớp muộn có 0 buổi ghi nhận → giáo viên chỉ sửa **một lỗi chính tả** ở
trường `topic` của một log → học viên đó bỗng có `recordedSessions=1, presentCount=1, attendanceRate=100%`, và
nếu `avgScore ≥ 50` thì `certificateEligible` **bật lên** — v2 hiện huy hiệu "đủ điều kiện cấp chứng chỉ" cho
một học viên chưa từng được điểm danh thật.

**Vá:** chuyển hướng `/teacher/*` → `/v2/teacher/*` trong `next.config.mjs` như một phần của merge; hoặc đưa
form v1 về đúng hợp đồng của v2 (thêm lựa chọn `UNMARKED`, mặc định khi chưa có bản ghi, và loại khỏi payload).

### 2. Cả hai client web nuốt mất thông điệp lỗi mà PR vừa thêm
`frontend/src/app/v2/teacher/tc-reports/AttendanceTab.tsx:214` (và `teacher/reports/page.tsx:252`)

PR thêm 3 lý do từ chối mới ở đường ghi nhật ký (ngày tương lai, trùng buổi…) nhưng cả hai client đều bắt lỗi
trần rồi hiện *"Lưu buổi học thất bại. Vui lòng thử lại."* Giáo viên dạy 2 ca/ngày để trống "Buổi số" sẽ nhận
409 kèm hướng dẫn chính xác từ server, nhưng chỉ thấy "thử lại" → **retry vô hạn**, buổi tối không bao giờ
được ghi, và vì lương nay suy từ nhật ký nên buổi đó **mất khỏi bảng công**.

**Vá:** `catch (e) { toast.error(apiMessage(e)) }`, giữ chuỗi chung làm fallback; thêm `max={todayIso}` cho ô
chọn ngày.

### 3. Nộp kỳ sớm đóng băng vĩnh viễn phần còn lại của kỳ
`backend/src/main/java/com/deutschflow/teacher/service/TimesheetPeriodService.java:100`

Frontend luôn mở kỳ theo **trọn tháng** (`tc-timesheet/page.tsx:29-37`), và nút "Nộp" hiện bất cứ khi nào kỳ
còn sửa được và có ≥1 bản ghi — **không kiểm tra `periodEnd` đã qua chưa**. Nộp ngày 25/07 cho kỳ 01–31/07,
manager duyệt 26/07 → dạy 27, 29, 31/07 **không ghi công được nữa** (409), và **không có transition nào mở
lại** kỳ APPROVED/LOCKED.

**Vá:** chặn `submit()` khi `todayVn() <= periodEnd` (hoặc cảnh báo rõ ở UI); hoặc thêm transition manager mở
lại APPROVED→OPEN; hoặc hẹp hơn: `assertRecordEditable` chỉ đóng băng các ngày `<= submittedAt`.

---

## 🟡 PLAUSIBLE — cần quyết định (1/2 verifier xác nhận)

| Vấn đề | Vì sao đáng quyết |
|---|---|
| **`belongsToPeriodOrg` fail OPEN** (`TimesheetPeriodService.java:284`) | Dòng công có `orgId = NULL` (lớp tư/B2C, hoặc lớp tạo trước khi GV vào trung tâm) được tính vào kỳ của trung tâm → **trung tâm trả cho buổi không dạy cho họ**. Đây là hệ quả của lựa chọn *bảo thủ* ở bản vá 21/07 (giữ nguyên hành vi đơn-tổ-chức). Vá: đổi sang fail-closed. |
| **CSV kế toán trộn mọi trạng thái** (`:185`) | `orgSummary`/`exportOrgCsv` không lọc status → file gửi kế toán chứa cả kỳ OPEN (totals luôn = 0), SUBMITTED (chưa duyệt) và REJECTED (snapshot cũ đang tranh chấp). GV làm 18 buổi nhưng chưa nộp sẽ hiện **0 buổi**. |
| **V265 khoá bảng `users`** (`V265:29`) | Lấy `ACCESS EXCLUSIVE` trên bảng nóng trong lúc container cũ còn phục vụ; Flyway thừa hưởng `statement_timeout` 30s của pool → hoặc nghẽn mọi request đã đăng nhập, hoặc migration bị giết và abort deploy. |
| **Quyền ghi công tra roster LIVE** (`TeacherTimesheetService.java:211`) | GV bị gỡ khỏi lớp (hoặc lớp bị xoá) **mất quyền ghi công cho buổi đã dạy** trước đó. |
| **`*IT.java` không chạy trong CI** (`pom.xml:338`) | Không khớp cả Surefire lẫn Failsafe → `ClassScheduleIT` — test DB-level duy nhất của phân hệ lịch mà PR này viết lại — **âm thầm không bao giờ chạy**. |

## ❌ REFUTED
"Tính năng không có test DB-level nào" — bị bác: có test DB-level tồn tại, vấn đề thật là **cấu hình pom không
chạy chúng** (đã ghi ở mục PLAUSIBLE trên).

---

## MEDIUM / LOW (28)

### deploy-ops (4)
- 🟠 `dedupe_class_lesson_logs.sql:62` — **script dọn bắt buộc TỰ NÓ có bug**: abort vì vi phạm khoá chính khi
  một nhóm trùng có ≥3 log và một học viên được đánh dấu ở 2 log thua nhưng không có ở log giữ.
- 🟠 `V266:22` — kể cả dọn đúng, **container CŨ vẫn tiếp tục nhận log trùng** cho tới lúc GREEN promote → cửa
  sổ đua vẫn làm index fail.
- 🔵 `survey_timesheet_data_debt.sql:4` — hướng dẫn chạy `cleanup_orphan_class_attendance.sql`, **file này
  không tồn tại** trong repo.
- 🔵 `V265:51` — CHECK thêm dạng NOT VALID, bước VALIDATE chỉ ghi trong comment → sẽ không bao giờ được chạy.

### domain-correctness (4)
- 🟠 `:151` — `reject()` không chụp lại và không xoá `total_*` → kỳ bị trả về vẫn quảng cáo con số đang tranh chấp.
- 🟠 `TeacherTimesheetService.java:103` — sửa giờ bắt đầu của pattern làm sinh lại buổi hôm nay ở `startAt` mới,
  phá cả hai lớp chống trùng của gợi ý → **cùng một buổi đã dạy có thể ghi (và trả) hai lần**.
- 🟠 `:283` — cùng gốc với fail-open ở trên; thêm chi tiết `teacher_classes.org_id` chỉ đóng dấu lúc tạo lớp,
  không bao giờ backfill.
- 🔵 `:123` — chọn kỳ theo `period_start ∈ [from,to]` → cửa sổ không chứa ngày đầu kỳ trả về **rỗng** thay vì
  các kỳ giao nhau.

### tests-perf (7)
- 🟠 `ClassSessionRepository.java:51` — `findLiveForPattern` **không dùng được index nào**, seq scan toàn bộ
  `class_sessions` mỗi lần roll-forward, mỗi pattern một lần.
- 🟠 `OrgTimesheetController.java:40` — **không có test authz tầng HTTP** cho cả hai controller mới.
- 🟠 `org/timesheets/page.tsx:121` — hai trang frontend mới + `timesheetApi.ts` **không có test nào**, kể cả 2
  guard vừa được thêm vì chính chúng từng là bug.
- 🔵 `:268` cửa sổ hiển thị và cửa sổ snapshot dùng biên khác nhau, không test nào ghim.
- 🔵 `TeacherSessionRecordRepository.java:38` — `findForOrgInRange` và `GET /periods` **không có caller, không test**.
- 🔵 `TeacherTimesheetService.java:103` — mỗi lần tải trang bảng công phát 6 truy vấn + 1 transaction ghi, trong
  đó một truy vấn lặp lại chính nó.
- 🔵 `:185` — export nhận khoảng ngày không giới hạn, không phân trang, **buffer toàn bộ CSV trong heap**.

### hygiene (6)
- 🟠 `.claude/reviews/2026-07-21-…md:128` — **biên bản review AI lên trunk tuyên bố "mọi rào cản kỹ thuật đã
  dọn"**, trong khi bỏ sót đúng bước dedupe bắt buộc của V266; và `.claude/reviews/` không phải quy ước sẵn có.
- 🟠 `plans/2026-07-20-…md:351` — plan lên trunk với **số hiệu migration sai**: gán unique index cho V265 và lỗi
  dữ liệu trùng cho V263, trong khi thực tế index ship ở V266.
- 🟠 `timesheetApi.ts:159` — `formatMinutes` hardcode đơn vị tiếng Việt `"g"/"p"` ngoài i18n → người dùng
  Anh/Đức thấy chữ viết tắt tiếng Việt trên cả hai trang mới.
- 🟠 `frontend-ci.yml:44` — ~115 key i18n mới **không có cổng CI nào bảo vệ**: checker parity v2 mồ côi (không
  workflow nào gọi), còn checker CI thật sự chạy thì hardcode luôn `exit 0`.
- 🟠 `backend-ci.yml:68` — integration-tests (khâu CI duy nhất thực sự replay Flyway trên Postgres thật) bị
  giới hạn ở push lên main → **không migration nào trong 7 cái được CI chạy trước khi merge**.
- 🔵 `scripts/qa-timesheet-flow.sh:5` — script QA chỉ chạy được trên macOS và ghim cứng container của một máy.

### merge-impact (3)
- 🟠 `TeacherService.java:403` — cổng cách ly org mới **chỉ áp cho 1 trong 2 đường ghi danh** → vừa làm hỏng một
  luồng cũ còn sống, vừa không bịt được lỗ hổng mà nó viện dẫn làm lý do.
- 🟠 `AttendanceTab.tsx:214` — (cùng gốc với CONFIRMED #2).
- 🔵 `StudentEvaluationService.java:234` — bản ghi điểm danh có status ngoài PRESENT/LATE/ABSENT trước đây còn
  làm phồng mẫu số; nay **không vào nhóm nào**, âm thầm thu nhỏ mẫu số của tỉ lệ xét chứng chỉ.

### authz (3)
- 🟠 `TimesheetPeriodDtos.java:15` — manager **duyệt và khoá một con số tổng mờ đục**: không endpoint/DTO nào
  cho xem các dòng công bên dưới → bước duyệt không thể phát hiện dữ liệu sai hoặc xuyên tenant.
- 🔵 `TeacherTimesheetService.java:128` — `POST /records` xác thực `sessionId` do client gửi (tồn tại/CANCELLED)
  **trước khi** kiểm tra người gọi có dạy lớp đó → thành **oracle dò session-id xuyên tenant**.
- 🔵 `OrgTimesheetController.java:25` — javadoc khẳng định đây là endpoint ghi **đầu tiên** trên `/api/org` —
  **sai**: `OrgController` đã có 8 endpoint đổi trạng thái, gồm xoá thành viên và đổi vai trò.

### contract-drift (1)
- 🟠 `timesheetApi.ts:141` — export CSV ép `responseType: 'blob'` cho **mọi** response kể cả lỗi → `apiMessage()`
  không đọc được envelope JSON, manager thấy chuỗi tiếng Anh chung chung của axios.

> **Điểm tích cực đáng ghi nhận:** chiều *contract-drift* xác nhận **không có** client nào bị bỏ sót vì đổi tên
> `totalSessions → recordedSessions` — mobile không gọi các endpoint này, và các consumer web đều đã cập nhật.
> Đây là rủi ro lớn nhất được kiểm tra và **đã loại trừ**.

---

## Đề xuất thứ tự xử lý

1. **Bắt buộc trước khi deploy (nên làm trước khi merge):** vá blocker V266 — gộp dedupe vào migration đứng
   trước index. Đồng thời sửa bug của chính script dedupe (nhóm ≥3 log) và tính đến cửa sổ đua với container cũ.
2. **Nên vá trước khi merge:** CONFIRMED #1 (chứng chỉ giả từ trang v1) — đây là lỗi *đang* ảnh hưởng nghiệp vụ
   thật ngay khi tính năng lên trunk.
3. **Vá sớm sau merge:** CONFIRMED #2, #3; PLAUSIBLE fail-open org và lọc trạng thái CSV.
4. **Sửa docs sai:** biên bản review 21/07 tuyên bố sai "đã dọn mọi rào cản"; plan ghi sai số hiệu migration.
5. **Nợ hạ tầng kiểm thử:** `*IT.java` không được Surefire/Failsafe chạy; parity i18n không có cổng CI.
