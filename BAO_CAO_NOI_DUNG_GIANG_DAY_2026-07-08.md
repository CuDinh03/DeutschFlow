# BÁO CÁO KẾ HOẠCH — Màn "Nội dung giảng dạy" (Teacher) của DeutschFlow

> Tài liệu chiến lược + kế hoạch triển khai. Tổng hợp từ: **audit code nội bộ** (đọc trực tiếp source), **best-practice LMS** (Canvas/Google Classroom/Moodle/Schoology), **chuẩn giáo trình DaF/CEFR**, **phân tích đối thủ thị trường VN** (Azota/DeutschExam.ai/DotB), và **bản đồ Jobs-to-be-Done của giáo viên**. Ngày: 2026-07-08.
>
> **Trạng thái triển khai** (cập nhật 2026-07-08): **Phase 0 ✅ shipped + hardened**; **Phase 1a ✅ đã code + tự verify** (migration V249). Chi tiết ở §7. Cập nhật docs theo từng lát khi hoàn thành.

---

## 1. Tóm tắt điều hành

- **Hiện trạng lệch nghĩa nghiêm trọng:** Nhãn sidebar "Nội dung giảng dạy" (`/v2/teacher/tc-progress`) thực chất là **dashboard tiến độ CHỈ-ĐỌC** — ngay chính tiêu đề H1 của trang đã là *"Tiến độ khóa học"* (thấy rõ trong ảnh chụp màn hình), **mâu thuẫn với nhãn nav**. Còn nơi thật sự **soạn nội dung** lại nằm dưới nhãn "Lịch sử giảng dạy" (`/v2/teacher/tc-checklist`). Người dùng bị đảo ngược kỳ vọng UX (soạn trước → xem tiến độ sau).
- **Mô hình dữ liệu quá mỏng:** `ClassLesson` chỉ có `title` + `description` (bị "nhồi" knowledge points mã hoá bằng newline). Không có cấp CEFR, module/chương, ngày dự kiến (pacing), mục tiêu can-do, tag 4 kỹ năng, hay liên kết tới tài liệu/BTVN/lịch/điểm.
- **"Kho báu bị chôn":** Rất nhiều năng lực backend đã chạy production nhưng CHỈ nối vào UI v1 cũ — nhật ký buổi học + điểm danh (`LessonLogController`), sổ điểm ma trận (`gradebook`), báo cáo 4 kỹ năng (`skill-report`), phiếu đánh giá học viên (`StudentEvaluation`), và endpoint `reorder` bài học. **/v2 chưa gọi tới.**
- **Ba thực thể "buổi học" rời rạc:** `ClassLesson` (nội dung), `ClassLessonLog` (nhật ký + điểm danh), `ClassSession` (lịch) đều mô hình hoá "một buổi dạy" nhưng KHÔNG có FK nào nối chúng — giáo viên phải nhập trùng lặp, hệ thống không thể trả lời "bài nào dạy buổi nào".
- **Cơ hội lớn nhất — moat khả thi:** DeutschFlow đã sở hữu 4 khối AI hiếm có (chấm bài AI 4 kỹ năng, tạo tài liệu AI, luyện nói AI, SRS/skill-tree) + lớp vận hành lớp học. Không đối thủ đơn lẻ nào (Azota chỉ chấm; DeutschExam.ai chỉ luyện thi; DotB/CenterOnline chỉ vận hành) **hợp nhất được cả ba lớp**: nội dung chuẩn CEFR + AI chấm 4 kỹ năng + vận hành trung tâm — bản địa hoá VN.
- **Khuyến nghị chính:** Biến "Nội dung giảng dạy" từ dashboard mỏng thành **trung tâm điều phối giáo trình của lớp** (curriculum command center), với "sợi chỉ năng lực" (CEFR can-do) xuyên suốt bài học → BTVN → chấm → báo cáo. Neo mọi thứ vào `Kann-Beschreibung` theo backward design.
- **Chiến lược thực thi:** Ưu tiên **Phase 0 quick wins zero-backend** (đổi nhãn nav, phơi reorder, phơi lesson-log/attendance/gradebook v1→v2) để tạo giá trị tức thì, rồi mới mở rộng schema theo giai đoạn. Bám sát chiến lược Hybrid đã có (lõi soạn sẵn + AI luyện thêm).

---

## 2. Hiện trạng màn "Nội dung giảng dạy"

### 2.1. Hai màn — vai trò thực tế

| Route | Nhãn sidebar (nav.ts) | Icon | Vai trò THỰC TẾ | Ghi/Sửa? |
|---|---|---|---|---|
| `/v2/teacher/tc-progress` | **Nội dung giảng dạy** | trending_up | Dashboard tiến độ **chỉ-đọc** (H1 trang = *"Tiến độ khóa học"*): hero %hoàn thành, "bài kế tiếp", "buổi đã dạy", "bài hoàn thành gần nhất", timeline bài học | Không (chỉ nút "Mở checklist") |
| `/v2/teacher/tc-checklist` | **Lịch sử giảng dạy** | checklist | Nơi **CRUD thật**: thêm/sửa/xoá bài + soạn "kiến thức cần học", tick hoàn thành | Có (create/update/delete/toggle) |

- `tc-progress` dựng 100% trên `listLessons()` (`GET /api/v2/teacher/classes/{classId}/lessons`). Nó tự tính `pct()` từ `lessons.filter(l=>l.completed)`, tìm "bài kế tiếp" = phần tử `!completed` đầu tiên theo `orderIndex`, "buổi đã dạy" = `done.length/total`. **Không có thao tác ghi nào.**
- `tc-checklist` mới là nơi soạn nội dung: `KnowledgePointsEditor` encode/decode danh sách "kiến thức cần học" bằng **newline-separated nhồi vào cột `ClassLesson.description`** (`frontend/src/lib/knowledgePoints.ts` — `parseKnowledgePoints`/`formatKnowledgePoints`).
- Cả hai dùng chung `useTeacherClasses()`/`ClassPicker`/`pct()` trong `tcShared.tsx`, cùng gọi `teacherLessonsApi.ts`.

### 2.2. Nhãn nav lệch nghĩa (điểm gây nhầm lẫn lớn nhất)

- **Bằng chứng mạnh nhất (thấy trong ảnh):** trang `/v2/teacher/tc-progress` hiển thị H1 = **"Tiến độ khóa học"**, phụ đề "Tổng quan tiến độ giảng dạy theo lớp" — nhưng nhãn sidebar dẫn tới nó lại là **"Nội dung giảng dạy"**. Chính trang tự mâu thuẫn với nhãn của mình.
- `nav.ts` dòng 77-78: `tc-progress` → "Nội dung giảng dạy" (nhưng là dashboard tiến độ); `tc-checklist` → "Lịch sử giảng dạy" (nhưng là nơi soạn nội dung, không phải log quá khứ).
- "Lịch sử giảng dạy" còn **trùng ý niệm** với `ClassLessonLog` (nhật ký buổi: sessionDate/topic/homework/note) mà `tc-checklist` hoàn toàn không đụng tới — gây hiểu nhầm kép.
- Slug `tc-checklist` dễ nhầm với legacy UI v1 "Checklist buổi học" (`frontend/src/app/teacher/classes/[id]/lessons`) vốn có ngữ nghĩa khác.

### 2.3. Mô hình dữ liệu mỏng (`ClassLesson`)

Chỉ có: `id, classId, orderIndex, title, description(TEXT), completed, completedAt, completedByTeacherId, timestamps`.

**KHÔNG có:** cấp CEFR (A1/A2/B1), nhóm module/chương, ngày dự kiến/pacing, mục tiêu can-do, tag 4 kỹ năng, liên kết `materialId`/`assignmentId`/`classSessionId`/`lessonLogId`, nội dung theo từng học viên. "Kiến thức cần học" không có cột riêng → không ràng buộc, không tìm kiếm, không gắn cờ trạng thái được.

### 2.4. Năng lực backend tiềm ẩn — đã chạy production, /v2 chưa gọi

| Năng lực | Endpoint | Hiện chỉ dùng ở |
|---|---|---|
| Nhật ký buổi + điểm danh | `GET/POST/PUT/DELETE /api/v2/teacher/classes/{id}/lesson-logs` (+ `ClassAttendance` PRESENT/LATE/ABSENT) | v1 `teacher/reports` tab "Nhật ký & Điểm danh" |
| Phiếu đánh giá học viên | `StudentEvaluationService` (nhận xét + điểm 4 kỹ năng + chuyên cần + certificateEligible) | v1 `teacher/reports` tab "Phiếu đánh giá" |
| Báo cáo 4 kỹ năng toàn lớp | `GET /v2/teacher/reports/classes/{id}/skill-report` (xếp loại + TB lớp) | v1 reports tab "Điểm 4 kỹ năng" |
| Sổ điểm ma trận | `GET /v2/teacher/reports/classes/{id}/gradebook` (HV × bài tập) | v1 reports tab "Sổ điểm" |
| Xuất PDF báo cáo | window.print + print-area CSS | v1 `teacher/reports` |
| Reorder bài học | `POST .../lessons/reorder` + `teacherLessonsApi.reorderLessons()` | chỉ v1 client-page.tsx (nút mũi tên) |

Ghi chú: `/v2/teacher/analytics` chỉ gọi `reports/overview` + `reports/classes/{id}` phẳng — KHÔNG gọi skill-report/gradebook/evaluation.

---

## 3. Phân tích khoảng trống (Gap Analysis)

### 3.1. So với LMS chuẩn & khung sư phạm

| Trục | Chuẩn (UbD / LMS / CEFR) | DeutschFlow hiện tại | Vì sao quan trọng |
|---|---|---|---|
| **Backward design** | Bắt đầu từ mục tiêu can-do → rubric/đề → hoạt động | Bắt đầu từ "tiêu đề bài + text knowledge points" | Không có "sợi chỉ năng lực"; bài–BTVN–chấm–báo cáo không align |
| **Pacing/curriculum map** | Lehrwerk → lịch tuần-buổi, đối chiếu kịp/chậm | "Bài kế tiếp" chỉ theo `orderIndex`, không có ngày dự kiến | GV luôn lo "lớp đang chậm/kịp giáo án không" — không trả lời được |
| **Competency tracking** | Trạng thái từng can-do: not-started/in-progress/mastered | Chỉ `completed` bool ở cấp bài | Không đo được năng lực theo CEFR, chỉ đo "đã tick xong bài" |
| **Formative assessment** | Exit-ticket/quiz nhanh gắn từng bài | Chỉ có summative (mock exam) rời rạc | Không phát hiện & lấp lỗ hổng ngay trong buổi |
| **Liên kết bài ↔ tài nguyên** | Bài gắn tài liệu, BTVN, đề, lịch | 4 hệ thống song song, 0 FK | GV nhảy giữa 4-5 app, nhập trùng |

**Cơ chế cụ thể từ các LMS hàng đầu (tham chiếu để thiết kế):**

| LMS | Cơ chế lõi phần "nội dung giảng dạy" | Bài học cho DeutschFlow |
|---|---|---|
| **Canvas** | *Modules* gom nội dung theo tuần/chương; đặt **prerequisites** (phải xong module trước) + **requirements** (phải đạt điểm/xem xong mới mở tiếp); *Outcomes* gắn mastery từng chuẩn | Mô hình Module→Lektion + gate theo mastery = bản đồ tự nhiên cho A1→A2→B1 |
| **Google Classroom** | *Topics* nhóm bài; **scheduled posts** (đặt lịch mở nội dung); reuse post giữa lớp; đính kèm Drive vào bài | "Publish/đặt lịch mở Lektion" + reuse giữa cohort là kỳ vọng cơ bản GV VN đã quen |
| **Moodle** | *Course format* (theo tuần/chủ đề); **completion tracking** theo điều kiện; *Competency frameworks* map hoạt động ↔ competency | Completion không chỉ "tick tay" mà theo điều kiện (nộp bài/đạt điểm) → dữ liệu thật |
| **Schoology / Mastery** | *Mastery-based grading*: điểm gắn vào learning objective, xem tiến bộ theo mục tiêu chứ không chỉ theo bài | Nền cho competency ledger + báo cáo năng lực CEFR |
| **Pacing guide (chuẩn K-12/ngoại ngữ)** | Bảng "tuần/buổi × nội dung × mục tiêu", đối chiếu kế hoạch vs thực tế | Chính là thứ DeutschFlow thiếu nhất — GV/trung tâm sống bằng pacing |

### 3.2. So với chuẩn giáo trình tiếng Đức (DaF/CEFR)

- Giáo trình chuẩn (Menschen, Netzwerk neu, Schritte international Neu, DaF kompakt neu, Aspekte neu) đều phân tầng **CefrLevel → Module/Teilband → Lektion**, mỗi Lektion có template lặp lại: openingMedia, Wortschatz, Grammatik, 4 skill blocks, Redemittel, Aussprache, Landeskunde, Selbstevaluation.
- Mật độ chuẩn: **A1 ≈ 8 Einheit / 14 Lektion, A2 ≈ 10, B1 ≈ 12** (~85 UE tiết 45' cho A1).
- Mọi bộ đều neo vào **Kann-Beschreibungen** (Profile deutsch): "Ich kann mich vorstellen", "Ich kann im Restaurant bestellen" — dạy theo năng lực, không theo ngữ pháp thuần.
- DeutschFlow hiện **hoàn toàn không** có tầng CEFR, module, can-do, hay tag kỹ năng → nội dung "phẳng", không map được sang cấu trúc thi Goethe/telc/ÖSD (4 module, đạt ≥60%/module, modular từ B1 hợp nhất 365 ngày).

### 3.3. So với kỳ vọng thị trường VN

- Trung tâm VN đang **ghép tạm 4-5 công cụ**: Google Classroom (tài liệu) + Azota (giao-chấm) + Google Form/Quizizz (quiz) + Zalo/Facebook (nhắc bài) + Excel (điểm danh/học bạ). Không công cụ nào có nội dung tiếng Đức chuẩn.
- Kỳ vọng cốt lõi của trung tâm: giáo trình chuẩn CEFR, mock test sát thi thật, **lộ trình theo mục tiêu đầu ra** (du học/Ausbildung/Pflege/FSP), **báo cáo tiến độ minh bạch + cổng phụ huynh**.
- Lỗ hổng DeutschFlow đang thiếu nhất so với center-management: **điểm danh, học phí/buổi, cổng & sổ liên lạc phụ huynh, bảng điểm theo lớp (phổ điểm, tỉ lệ hoàn thành)** — dù backend đã có một phần (lesson-log/attendance/gradebook) nhưng chưa lên v2.
- Lộ trình thực địa VN: **A1 ≈ 40-50 buổi, A2 ≈ 40, B1 ≈ 40**; buổi 90' (thường) hoặc 180' (cấp tốc T2–T6). DeutschFlow chưa có khái niệm pacing/preset lộ trình.

---

## 4. Định vị & Tầm nhìn

### 4.1. Từ "dashboard mỏng" → "Trung tâm điều phối giáo trình của lớp"

**"Nội dung giảng dạy" NÊN là node gốc của toàn bộ vòng đời dạy học của một lớp:**

```
CEFR Level (A1/A2/B1)
  └─ Module/Teilband
       └─ Lektion  ← NODE GỐC
            ├─ Mục tiêu can-do (Kann-Beschreibung)  ← sợi chỉ năng lực
            ├─ Tag 4 kỹ năng + trục nội dung (Wortschatz/Grammatik/…)
            ├─ Tài liệu (Content Pack, materialId)
            ├─ BTVN (assignmentId) → AI grading → competency ledger
            ├─ Buổi lịch (classSessionId) + Nhật ký + Điểm danh
            └─ Đồng bộ → app học viên + báo cáo phụ huynh
```

### 4.2. Nguyên tắc định vị

1. **Backward design mặc định:** Soạn Lektion bắt đầu từ ô "mục tiêu can-do", AI đề xuất rubric/đề TRƯỚC, rồi mới sinh hoạt động + tài liệu. `Kann-Beschreibung` là khoá ngoại nối bài ↔ BTVN ↔ chấm ↔ báo cáo.
2. **Tận dụng lợi thế AI khó sao chép:** 4 khối AI đã có (chấm 4 kỹ năng, tạo tài liệu, luyện nói, SRS/skill-tree) biến chuỗi thủ công thành pipeline bán-tự-động.
3. **Hybrid content:** Lõi giáo trình mẫu A1/A2/B1 soạn sẵn (data-driven, clone được) + AI luyện thêm — khớp GTM "Tự động hoá Sư phạm cho trung tâm tiếng Đức".
4. **Hợp nhất 3 lớp bị ghép tạm:** nội dung chuẩn CEFR + AI chấm + vận hành lớp — trong một nền tảng bản địa hoá VN.
5. **Định vị theo đầu ra:** đỗ B1/B2 để du học/việc làm/Pflege, không chỉ "app học từ vựng".

---

## 5. Danh mục tính năng đề xuất

> Độ phức tạp: **Thấp** = zero/ít backend, tái dùng cái đã có · **TB** = thêm cột/endpoint vừa phải · **Cao** = schema mới + AI + đồng bộ.

### A. Trình soạn giáo trình theo Module/Lektion + cấp CEFR

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| A1. Phân tầng CEFR → Module → Lektion | Thêm `cefrLevel`, `moduleId`, cờ `isModular` cho phép dạy phi tuyến kiểu Aspekte | Chuẩn hoá nội dung theo kiến trúc DaF đã kiểm chứng | TB | Bảng `curriculum_module`, cột mới trên `class_lessons` |
| A2. Template Lektion chuẩn | Các section con: openingMedia, Wortschatz, grammarPoints[], skillBlocks[4], redemittel, Aussprache, Landeskunde, summary, Selbstevaluation | GV/AI soạn nhất quán, tái sử dụng | Cao | Tách khỏi `description`; JSON/bảng con |
| A3. `estimatedTeachingUnits` | Số tiết 45' ở cấp Lektion & Level | Tính lộ trình & tiến độ | Thấp | Cột số |

### B. Mục tiêu can-do & tag 4 kỹ năng

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| B1. Thực thể `CanDoStatement` | `(id, level, skill, text_i18n vi/en/de)` chuẩn hoá, gắn nhiều Lektion | Dạy theo năng lực; khớp i18n /v2 trilingual | TB | Bảng mới + bảng nối |
| B2. SkillTag + ContentTag | Enum `{HOEREN, LESEN, SCHREIBEN, SPRECHEN}` + `{WORTSCHATZ, GRAMMATIK, AUSSPRACHE, LANDESKUNDE, REDEMITTEL, STRATEGIE}` trên mỗi hoạt động/BTVN | Lọc luyện theo kỹ năng yếu, cân bằng 4 kỹ năng, định tuyến đúng AI grader | TB | Cột enum + join |
| B3. Selbstevaluation "Tôi có thể…" | Checklist can-do cuối bài cho HV tự đánh giá | Self-assessment; bản đồ tiến độ CEFR = tổng can-do đạt | TB | B1 + student sync | — ✅ **Lát 2a XONG** (`student_competency` V256 + `<select>` tự đánh giá trên trang lớp HV + tổng "{mastered}/{total} đạt") |
| B4. Competency ledger | Mỗi HV × can-do: not-started/in-progress/mastered, cập nhật tự động từ điểm + SRS | Nền cho báo cáo & remediation | Cao | B1 + AI grading + SRS | — ✅ **Lát 2b: nhánh CHẤM ĐIỂM xong** (`applyGradingResult` source=GRADING, upgrade-only); **SRS HOÃN** (chưa có link SRS→can-do — SRS neo skill_tree_nodes, khác vũ trụ lesson) |

### C. Nhịp độ/Pacing (kế hoạch vs thực tế) + gắn lịch

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| C1. `plannedDate`/target-week cho Lektion | Ngày dự kiến dạy từng bài | Đối chiếu kịp/chậm/vượt | Thấp | Cột date |
| C2. Dashboard tô màu tiến độ | Đúng tiến độ / chậm / vượt dựa trên completed vs planned | Giải nỗi lo "lớp đang chậm không" | TB | C1 |
| C3. Preset lộ trình Thường/Cấp tốc | `sessionDurationMinutes` + `sessionsPerWeek`; A1≈45 buổi 90' vs T2–T6 180' | Khớp thực địa VN; đặt kỳ vọng → retention | TB | `CourseSchedule` |
| C4. Gắn Lektion ↔ ClassSession | Chọn "bài nào dạy buổi này" trên lịch | Nối nội dung với thời khoá biểu | TB | FK `classSessionId` |

### D. Liên kết bài học ↔ tài liệu ↔ BTVN ↔ chấm điểm

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| D1. FK `lessonId` trên ClassAssignment | Gắn BTVN với bài cụ thể | Trả lời "bài tập thuộc bài học nào" | Thấp | Cột FK + migration |
| D2. FK `lessonId`/`materialId` liên kết tài liệu | Tài liệu gắn vào Lektion để HV tra khi xem tiến độ | Giảm ghép tạm Classroom | TB | Materials scope |
| D3. One-click Homework từ Lektion | Nút "Giao BTVN" sinh bài khớp nội dung buổi; vocab tự đẩy vào SRS deck lớp; bài nộp → AI grading | Khép mắt xích bài↔BTVN mà Azota/Classroom để rời | Cao | AI content + SRS + grading |
| D4. Rubric-based grading gắn thẻ năng lực | AI chấm theo rubric Goethe, mỗi lỗi map về can-do → đẩy vào ledger | Biến điểm số chết thành dữ liệu năng lực | Cao | B4 + AI grading (đã hardened PR #205) |

### E. Thư viện giáo trình mẫu A1/A2/B1 & tái dùng giữa lớp

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| E1. Seed 3 curriculum mẫu | A1 ~8-14 Lektion, A2 ~10, B1 ~12; điền sẵn Thema, can-do, grammarPoints, Wortschatz, tags, examAlignment (data-driven, không hardcode) | Trung tâm B2B triển khai nhanh, chuẩn CEFR | Cao | A1-A3, B1-B2 |
| E2. Course Template clone-and-tweak | "Lưu khóa thành Template" → khóa mới clone pacing + content + BTVN + đề, giữ liên kết competency | Reuse giữa cohort → switching cost | Cao | E1 + toàn bộ schema |
| E3. Content Pack theo Lektion (AI) | Nhập chủ đề+cấp → sinh bài đọc leveled, hội thoại, vocab deck (→SRS), 3-2-1 summary | Việc tốn giờ nhất của GV DaF; ưu thế so Diffit = Đức-ngữ chuẩn CEFR + cắm SRS | Cao | AI content + SRS |

### F. Nhật ký buổi học + điểm danh (phơi backend tiềm ẩn lên v2)

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| F1. Port Nhật ký & Điểm danh lên /v2 | Route v2 gọi `lesson-logs` (sessionDate/topic/homework/note + ClassAttendance) | Lớp trung tâm VN cần điểm danh; backend đã chạy | **Thấp** | Chỉ port UI |
| F2. Port Sổ điểm ma trận + Báo cáo 4 kỹ năng | Route v2 gọi `gradebook` + `skill-report` | Lỗ hổng Azota (thiếu phổ điểm/bảng điểm theo lớp) | **Thấp** | Chỉ port UI |
| F3. Port Phiếu đánh giá học viên | v2 UI nhập/xem StudentEvaluation (v2 mới chỉ đọc SkillBars) | Đánh giá cuối khoá + certificateEligible | **Thấp** | Chỉ port UI |
| F4. Xuất PDF gradebook/skill-report/evaluation | Port print-area CSS v1 → v2 Galerie | Báo cáo chất lượng cho trung tâm | Thấp | F1-F3 |

### G. Đồng bộ & báo cáo tiến độ cho học viên/phụ huynh

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| G1. Cổng & Sổ liên lạc phụ huynh | Báo cáo định kỳ tự sinh: buổi đã học, bài đã nộp, điểm AI 4 kỹ năng, SRS mastery, sẵn sàng B1/B2, chuyên cần; xem CHI TIẾT bài chấm | Kỳ vọng chuẩn center VN + lỗ hổng Azota; DeutschFlow gắn dữ liệu học THẬT | Cao | B4 + F1-F3 + notification |
| G2. Competency Progress Report song ngữ | Tự tổng hợp từ ledger + SRS + điểm; xuất PDF/đẩy app; bản phụ huynh dễ hiểu | Job tốn giờ nhất; điểm chạm giữ chân/upsell | Cao | B4 + i18n |
| G3. Publish & Sync teacher→student | Nút "Publish Lektion" đồng bộ bài+BTVN+vocab deck + notification; drip theo pacing | Khép mắt xích "soạn xong → tới tay HV" | TB | Tái dùng SSE/Redis/Expo push, `NotificationContentRenderer` |

### H. Tự động hoá bằng AI (theo Lektion)

| Tính năng | Mô tả | Giá trị | Độ phức tạp | Phụ thuộc |
|---|---|---|---|---|
| H1. AI Pacing Guide/Curriculum Mapper | Chọn Lehrwerk + buổi/tuần → AI dựng bảng pacing gắn can-do mỗi buổi | Job nền, mọi thứ treo vào bản đồ này | Cao | C1-C3 + AI |
| H2. Backward-Design Lesson Builder | Nhập can-do → AI đề xuất rubric+đề trước, rồi sinh hoạt động+tài liệu | Áp UbD trực tiếp vào sản phẩm | Cao | B1 + AI |
| H3. Formative Exit-Ticket + Gap Heatmap | AI sinh 5-8 câu cuối buổi → chấm tức thì → heatmap lỗ hổng → feed SRS/skill-tree | Lấp khoảng trống formative | Cao | AI + SRS |
| H4. Summative Mock-Exam bám mục tiêu đã dạy | Chọn khoảng Lektion → AI lắp đề 4 kỹ năng chỉ gồm can-do đã cover, chấm ngưỡng 60%/module | Tận dụng mock_exam_packs, thêm alignment | Cao | B1 + mock engine |
| H5. Adaptive Remediation | Từ heatmap/ledger → AI sinh mini-bài luyện đúng điểm yếu → node skill-tree + thẻ SRS ưu tiên | Cá nhân hoá quy mô lớn cho 20+ HV | Cao | B4 + skill-tree + SRS |
| H6. Assign AI-Speaking theo Lektion + Review Board | Giao kịch bản luyện nói AI theo chủ đề Lektion; GV xem bảng tổng hợp lỗi phát âm/ngữ pháp | Mở rộng giờ luyện nói; AI khó sao chép | TB | AI speaking (đã có) |

---

## 6. Thay đổi mô hình dữ liệu đề xuất

### 6.1. Gỡ "nhồi knowledge points vào description" — ✅ ĐÃ LÀM (V250, lát 1b)

Đã tách sang bảng con `lesson_knowledge_point(id, lessonId, orderIndex, text, skillTag, contentTag, timestamps)`. **Cột `status`** (đã luyện/đã kiểm tra từng điểm) hoãn sang Phase 2 (chưa có consumer). Bảng con là **nguồn chính**; `description` giữ nguyên làm **bản sao dual-write** cho mobile (render nguyên văn) + fallback đọc.

**Di trú (đã làm):** migration V250 backfill đọc `description` → `regexp_split_to_table` + strip bullet (khớp `parseKnowledgePoints`) → insert bảng con; **non-destructive** (không đụng description), guard `NOT EXISTS`. View student đã chuyển sang `resolvePointTexts` (structured-hoặc-fallback) nên không vỡ.

### 6.2. Bảng/trường mới đề xuất

| Bảng/Trường | Loại | Mục đích |
|---|---|---|
| `curriculum_module` | Bảng mới `(id, class_id, title, order_index, ts)` | Nhóm Lektion thành Module — ✅ **V251 (1c)** (bỏ `isModular`/template → P3) |
| `class_lessons.cefr_level` | Cột `VARCHAR(8)` + CHECK A1..C2 | Cấp CEFR — ✅ **V249 (1a)** |
| `class_lessons.module_id` | FK ON DELETE SET NULL | Nối module — ✅ **V251 (1c)** |
| `class_lessons.planned_date` | date | Pacing kế hoạch vs thực tế — ✅ **V249 (1a)** |
| `class_lessons.estimated_units` | int + CHECK > 0 | Số tiết 45' — ✅ **V249 (1a)** |
| `class_lessons.class_session_id` | FK → `class_sessions` | Nối nội dung ↔ lịch |
| `can_do_statement` | Bảng mới `(id, lesson_id, order_index, cefr_level, skill_tag, text, ts)` | Kann-Beschreibung — ✅ **V255 (1e)** neo **thẳng vào lesson** (bỏ bảng nối `lesson_can_do`: module_id nullable nên nếu neo vào module thì bài chưa nhóm mất can-do; tái dùng enum 4 kỹ năng + CEFR) |
| ~~`lesson_can_do`~~ | ~~Bảng nối~~ | **Bỏ** — can_do_statement neo trực tiếp lesson_id (đơn giản hơn; 1 can-do thuộc 1 bài) |
| `lesson_knowledge_point` | Bảng mới (xem 6.1) | Gỡ nhồi description + tag — ✅ **V250 (1b)** (cột `status` hoãn P2) |
| `class_assignments.lesson_id` | FK ON DELETE SET NULL | BTVN gắn bài — ✅ **V253 (1d-D1)** (trên TEMPLATE `class_assignments`, ko phải `student_assignments`; guard cross-class trong `createAssignment`) |
| `lesson_material` | Bảng nối `(lesson_id, material_id, order_index, attached_by, attached_at)` PK`(lesson_id,material_id)` | Tài liệu gắn bài (M:N) — ✅ **V254 (1d-D2)** (FK CASCADE cả 2; `MaterialService.attach/detach/listForLesson` giữ ORG cross-org guard) |
| `class_lesson_logs.lesson_id` | FK → `class_lessons` ON DELETE SET NULL | Nối nhật ký ↔ bài đã dạy — ✅ **V252 (1d-D3)** (nullable; guard cross-class; batch-load `lessonTitle`) |
| `student_competency` | Bảng mới `(id, student_id, can_do_statement_id, status, source, updated_at)` UNIQUE(student,can-do) | Competency ledger — ✅ **V256 (2a)** (B3 self-eval source=SELF; B4 sau ghi source=GRADING/SRS cùng bảng) |
| `course_template` + `course_schedule` | Bảng mới | Clone giữa cohort + pacing preset |

### 6.3. Hợp nhất 3 thực thể "buổi học"

Thêm FK để `ClassLesson` (nội dung) ↔ `ClassLessonLog` (nhật ký+điểm danh) ↔ `ClassSession` (lịch) join được. Nguyên tắc: **ClassLesson = curriculum (cái gì dạy)**, **ClassSession = lịch (khi nào)**, **ClassLessonLog = thực tế đã dạy (nhật ký+điểm danh của buổi)**. Một buổi lịch → dạy 1-2 Lektion → sinh 1 log.

---

## 7. Lộ trình theo giai đoạn

### Phase 0 — Quick Wins (zero/ít backend, tận dụng cái đã có) — 1-2 tuần · ✅ ĐÃ SHIP + HARDEN

| # | Việc | Độ khó | Backend | TT |
|---|---|---|---|---|
| 0.1 | **Đổi nhãn nav** (nav.ts + chrome/teacher i18n vi/en/de): `tc-progress`→"Tiến độ khóa học"; `tc-checklist`→"Nội dung giảng dạy" (giữ route) | Thấp | Zero | ✅ |
| 0.2 | **Phơi reorder** lên tc-checklist (nút lên/xuống) dùng `reorderLessons()` đã có | Thấp | Zero | ✅ |
| 0.3 | **Port Nhật ký & Điểm danh** (F1) v1→v2 (tab trong `/v2/teacher/tc-reports`) | Thấp | Zero | ✅ |
| 0.4 | **Port Sổ điểm + Báo cáo 4 kỹ năng + Phiếu đánh giá** (F2/F3) v1→v2 | Thấp | Zero | ✅ |
| 0.5 | tc-progress: bullet knowledge-points + dòng "buổi đã ghi nhật ký" | Thấp | 1 API call | ✅ |
| 0.6 | Link "Xem báo cáo đầy đủ" tc-progress → `/v2/teacher/tc-reports` | Thấp | Zero | ✅ |

**Kết quả:** trang mới `/v2/teacher/tc-reports` (4 tab: Sổ điểm/4 kỹ năng/Nhật ký+Điểm danh/Phiếu đánh giá) + 3 lib API (`teacher{Gradebook,LessonLog,Evaluation}Api.ts`). Soát 3 luồng độc lập (code-reviewer + typescript-reviewer + workflow audit đối kháng) → **12 finding CONFIRMED, đã fix hết**: 2 HIGH (stale-closure race concurrent-save → functional-updater props; **mất điểm danh khi edit** học viên ngoài roster → merge-preserve), 4 MEDIUM (swallow fetch→`allSettled`+banner+retry; roster fallback gradebook→eval→logs; class-switch race→`loadSeq` guard; attendance status→1 normalizer), 4 LOW. Verify: tsc/build/i18n sạch, 272→**281 test** (thêm regression data-loss). CHƯA commit/deploy.

### Phase 1 — Nền tảng dữ liệu giáo trình — chia lát độc lập, additive-trước

| Lát | Nội dung | Rủi ro migration | TT |
|---|---|---|---|
| **1a** | CEFR level + **pacing** (`cefr_level`/`planned_date`/`estimated_units`) + dashboard nhịp độ | Thấp — cột nullable thuần | ✅ **đã code + tự verify** |
| 1b | Gỡ knowledge-points khỏi `description` → bảng `lesson_knowledge_point` + backfill (6.1) | TB — có di trú + đổi read/write path | ✅ **đã code + tự verify** (dual-write, non-destructive) |
| 1c | Nhóm `curriculum_module` + `module_id` (A1-A2) | Thấp | ✅ **teacher-side code + review đối kháng (4 fix) + verify** (student grouping hoãn) |
| 1d | FK liên kết: `class_assignments.lesson_id` (D1) + `lesson_material` (D2) + `class_lesson_logs.lesson_id` (D3) | Thấp (nullable) | ✅ **code + review đối kháng (1 fix) + verify** |
| 1e | `can_do_statement` (B1) — tag 4 kỹ năng (B2) **đã xong ở 1b** (point-level) | TB | ✅ **code + review đối kháng (1 fix) + verify** |

**Lát 1a — chi tiết đã làm** (branch hiện tại, CHƯA commit/deploy):
- **Backend**: migration **V249** (`class_lessons` +3 cột nullable + CHECK `cefr_level ∈ A1..C2` & `estimated_units > 0` + index pacing; `ADD COLUMN IF NOT EXISTS` + guard `pg_constraint` → idempotent/replay sạch). Entity + `ClassLessonDto` + `Create/UpdateLessonRequest` + `ClassLessonService` (persist + validation → 400 sạch thay vì DB CHECK 500; PATCH null=giữ-nguyên → toggle hoàn thành không đụng CEFR/pacing). Test **15/15** (+5).
- **Frontend**: `lessonPacing.ts` (util thuần, 8 test biên) + `tc-checklist` (component `LessonMetaFields`: CEFR select/ngày/tiết trong form thêm+sửa; hàng đọc hiện badge CEFR + ngày) + `tc-progress` (chip nhịp độ hero + timeline CEFR/ngày dự kiến/"Quá hạn" đỏ) + i18n 3 ngôn ngữ.
- **Verify**: tsc/build/i18n sạch, **283 test** (BE 17/17); DTO additive an toàn cả 3 consumer (teacher/student web + mobile).
- **✅ Review đối kháng xong** (workflow 2 auditor + verify): 6 finding CONFIRMED (1 MEDIUM + 5 LOW/NONE), **đã fix hết**: (MEDIUM) hiển thị ngày `new Date('yyyy-MM-dd')` parse UTC → lệch ngày ở timezone âm → thêm `parseIsoDateLocal` (VN UTC+7 không bị nhưng en/de miền tây bị); (LOW) `plannedDate` chưa validate → ngày ngoài dải → 500 thay 400 → `validatePlannedDate` (2000–2100); (LOW) blank cefrLevel khi update lỡ xoá field → chặn `!isBlank()`; (LOW) input "số tiết" nhận thập phân → `step={1}` + `parseUnits` (floor+guard); (LOW) a11y label chưa gắn → `aria-label`; (NONE) CHECK lock full-scan — không đáng ở quy mô này.
- ~~**Giới hạn**: chưa xoá được CEFR/ngày về null~~ → ✅ **đã bổ sung clear-flags** (`clearCefrLevel/clearPlannedDate/clearEstimatedUnits`) ở review 1b — giờ xoá được.

**Lát 1b — chi tiết đã làm** (CHƯA commit/deploy; chọn hướng "1b đầy đủ"):
- **Ràng buộc phát hiện**: mobile render `class_lessons.description` NGUYÊN VĂN → không thể gỡ điểm khỏi description mà không vỡ mobile. → Thiết kế **dual-write, non-destructive**: bảng con là nguồn chính, description được ghi song song làm bản sao cho mobile/legacy; đọc ưu tiên bảng con, **fallback** parse description cho bài chưa re-save.
- **Backend**: migration **V250** (`lesson_knowledge_point`: lesson_id FK CASCADE, order_index, text, `skill_tag` CHECK∈{HOEREN/LESEN/SCHREIBEN/SPRECHEN}, `content_tag` CHECK∈{WORTSCHATZ/GRAMMATIK/AUSSPRACHE/LANDESKUNDE/REDEMITTEL/STRATEGIE} + index; **backfill** từ description qua `regexp_split_to_table` + strip bullet, khớp `parseKnowledgePoints`, guard `NOT EXISTS`, non-destructive). Entity/repo + `KnowledgePointDto`/`KnowledgePointInput` + `ClassLessonDto/Create/UpdateLessonRequest` (+`knowledgePoints`). `ClassLessonService`: create/update sync bảng con (delete+insert) + re-derive description (dual-write); đọc **batch-load chống N+1** + fallback; validate tag → 400. Test **21/21** (+4: structured persist+dual-write, tag lạ→400, fallback description, ưu tiên sub-table).
- **Frontend**: `KnowledgePoint` type + payload `knowledgePoints`; helper `resolvePointTexts` (structured-hoặc-fallback); `tc-checklist` editor per-point **có tag kỹ năng + loại nội dung** (gửi `knowledgePoints`, không encode description nữa); 4 màn đọc (tc-progress/tc-checklist + student progress/classes) chuyển sang `resolvePointTexts`; i18n tag ×3. Test FE **284** (+2 editor tag/structured).
- **Verify**: backend BUILD SUCCESS **22/22**, FE tsc/build/i18n sạch, **285 test**. **✅ Review đối kháng xong** (2 auditor + verify): 3 finding, 2 CONFIRMED MEDIUM **đã fix** — (1) backfill `btrim()` chỉ strip space → lệch `.trim()` ở description CRLF legacy → đổi sang full-whitespace trim khớp Java/JS; (2) không xoá được cefr/planned/units khi edit (no-op im lặng) → thêm **clear-flags** end-to-end. 1 finding bị bác (dual-write raw vs stripped). ⚠️ mobile CHƯA đọc structured (vẫn qua description dual-write — an toàn); cập nhật mobile để lại sau.

**Lát 1c — chi tiết đã làm** (CHƯA commit/deploy):
- **Backend**: migration **V251** (`curriculum_module`: class_id FK CASCADE, order_index, title + index; `class_lessons.module_id` nullable FK **ON DELETE SET NULL** = xoá module chỉ gỡ-nhóm bài, không xoá bài). Entity/repo + DTO + `CurriculumModuleService` (CRUD+reorder, authz `assertTeacherOwns`/`assertStudentEnrolled`) + `CurriculumModuleController` (`/api/v2/teacher/classes/{id}/modules`) + endpoint student `/v2/students/classes/{id}/modules`. `ClassLesson.moduleId` + `ClassLessonService.assignModule` (validate module cùng lớp qua `existsByIdAndClassId`, null=gỡ-nhóm) + `PATCH .../lessons/{id}/module` (endpoint riêng → tránh nhồi Create/UpdateLessonRequest). Test **BE 33** (ClassLesson 25 +3 assignModule, Module 8 mới).
- **Frontend**: `moduleGrouping.ts` (util `groupLessonsByModule` thuần, 5 test) + `teacherModulesApi`/`studentClassesApi` (types+API). `tc-checklist`: **module manager** (thêm/đổi tên/xoá/reorder) + `<select>` gán module mỗi bài + **danh sách bài nhóm theo module** (module rỗng chỉ hiện ở manager). `tc-progress`: **timeline nhóm theo module + %/module**. i18n ×3.
- **Verify**: BE **35 test** + BUILD SUCCESS, FE tsc/build/i18n sạch, **294 test**, routes compile+redirect sạch. **✅ Review đối kháng xong** (workflow 2 auditor + verify từng finding): 5 finding, 4 CONFIRMED **đã fix hết**, 1 REFUTED (title-length không tràn 500 như nghi):
  - **(HIGH) reorder bài lệch nhóm**: nút ↑/↓ dùng chỉ-số PHẲNG `orderIndex` nhưng list render NHÓM theo module → khi bài trong 1 module không liền mạch orderIndex, click swap nhầm bài module khác → nhìn như no-op. Fix: `moveWithinGroup(group, gi, dir)` + helper thuần `swapInOrder` (đổi chỗ 2 bài **cùng-module** theo id trong danh sách phẳng, chỉ 2 vị trí đổi orderIndex, module khác nguyên vẹn); nút disable theo **ranh giới nhóm** (`gi===0`/`gi===len-1`) thay vì global. +4 unit test `swapInOrder` (gồm regression bài non-contiguous).
  - **(MEDIUM) reorder nhận id trùng/thiếu**: `[1,2,2]` cùng độ dài + toàn id-hợp-lệ vẫn lọt → ghi đè order_index (bản sao thắng), bài bị bỏ giữ index cũ = trùng, không có UNIQUE bắt. Fix: guard **permutation thật** (`HashSet.size==size` + `containsAll`) ở CẢ `CurriculumModuleService.reorder` VÀ `ClassLessonService.reorder` (khuyết cũ) + 2 test từ chối.
  - **(LOW) authz trả 409 Conflict** thay 403 (copy từ `ClassLessonService`) → đổi `assertTeacherOwns` sang **`ForbiddenException`** ở CẢ 2 service (khớp convention mới `TeacherService.assertTeacherOwnsClass`=403); cập nhật 2 test.
  - **(LOW) badge "Lektion N"** tính từ orderIndex phẳng → đọc lệch trong view nhóm → dựng `seqById` từ thứ-tự-đọc-nhóm (1..n liền mạch top-to-bottom) ở cả tc-checklist + tc-progress (bỏ luôn `findIndex` O(n)/hàng).
- **Hoãn có chủ đích**: **grouping phía student** (student/progress+classes vẫn phẳng; `moduleId`+endpoint+`fetchClassModules` đã sẵn — thêm sau). *(reorder bài giờ theo NHÓM sau fix HIGH — không còn dùng chỉ-số phẳng)*.

**Lát 1d + 1e — chi tiết đã làm** (CHƯA commit/deploy). Tất cả FK **nullable, additive, idempotent** (guard `pg_constraint`/`IF NOT EXISTS`); pre-map bằng workflow 4 reader trước khi code:

- **1d-D1 — BTVN gắn bài** (V253): cột `class_assignments.lesson_id` FK **ON DELETE SET NULL** (xoá bài KHÔNG xoá BTVN/điểm HV). Đặt trên TEMPLATE `class_assignments`, **không** `student_assignments` (tránh nhân bản khi fan-out). `TeacherService.createAssignment` inject `ClassLessonRepository`, **validate lesson cùng lớp** (chống cross-class). `ClassAssignmentDto`+`CreateAssignmentRequest` +`lessonId` (cuối record). FE: `classes/[id]` load thêm `listLessons` (guarded), AddAssignmentModal có `<select>` chọn bài + badge tên bài ở danh sách BTVN. Test **TeacherServiceTest 22** (+2: cross-class→403, valid→set lessonId).
- **1d-D2 — Tài liệu gắn bài** (V254): bảng nối M:N `lesson_material` (chọn join thay vì cột đơn vì material **tái dùng** nhiều lớp/bài + scope PERSONAL/ORG). Entity `LessonMaterial`+`LessonMaterialId` (mirror `ClassMaterial`), repo, `MaterialService.attachToLesson/detachFromLesson/listForLesson` **tái dùng authz** (`assertCanAccess`+`canAttachToClass`+**ORG cross-org guard**), 3 endpoint trên `MaterialController`. `listForLesson` giữ thứ tự `order_index`, lọc ARCHIVED, ko lộ S3 key. FE: `materialApi` (+3 hàm) + **`LessonMaterialsPanel`** (file riêng, giữ tc-checklist gọn) gắn/gỡ tài liệu trong form sửa bài. Test **MaterialServiceTest 18** (+4: cross-org→403, ko-dạy-lớp→403, attach set order_index max+1, listForLesson lọc archived+giữ order).
- **1d-D3 — Nhật ký gắn bài** (V252): cột `class_lesson_logs.lesson_id` FK **ON DELETE SET NULL**. `LessonLogService` inject `ClassLessonRepository`, validate cross-class, resolve `lessonTitle` **batch findAllById** (chống N+1). `ClassLessonLogDto`+`CreateLessonLogRequest` +`lessonId`(+`lessonTitle`). FE: `teacherLessonLogApi` +`lessonId`; AttendanceTab `<select>` chọn bài (preselect chỉ khi bài còn tồn tại) + badge; tc-reports load `listLessons` như phần **bổ trợ** (KHÔNG tính vào 4-section degradation → banner "tất cả hỏng" vẫn đúng). Test **LessonLogServiceTest 12** (+2).
- **1e — can_do_statement** (V255): bảng con neo **lesson_id** FK CASCADE (order_index, cefr_level, skill_tag, text) + CHECK enum tái dùng (A1..C2, 4 kỹ năng). **Không** neo module (nullable → bài chưa nhóm mất can-do) hay class (quá thô). Entity/repo (mirror `LessonKnowledgePoint`) + `CanDoStatementDto`/`Input`. `ClassLessonDto`+`Create/UpdateLessonRequest` +`canDoStatements`; `ClassLessonService` thread qua create/update như knowledgePoints (`replaceCanDos` delete+insert, null=giữ / []=xoá), `toDtos` **batch cả điểm + can-do** (chống N+1). **KHÔNG** dual-write vào description (tránh làm hỏng vòng knowledge-point + đổ raw "Ich kann…" lên mobile). FE: `CanDoStatement` type + **`CanDoEditor`** (file riêng, tag CEFR+kỹ năng) trong tc-checklist (add+edit form, chỉ gửi khi đổi), hiển thị read-view + tc-progress + trang HV (marker ✓ violet). **B2 tag 4 kỹ năng đã có sẵn ở 1b** (point-level). Test **ClassLessonServiceTest 29** (+3: persist normalize+drop blank, null=giữ, []=xoá).
- **Verify chung**: BE **91 test** 5 suite xanh (ClassLesson 30 · LessonLog 12 · Module 9 · Material 18 · Teacher 22, MVN_EXIT=0); FE tsc sạch · vitest **294** · i18n **2021×3** · `next build` OK · 5 route compile+redirect sạch, no server error.
- **✅ Review đối kháng xong** (workflow 4 auditor: migration-db / authz / correctness / frontend → verify từng finding): **1 CONFIRMED (LOW) đã fix**, 3 auditor sạch (0 finding). Fix: phần tử `null` trong mảng `knowledgePoints`/`canDoStatements` (JSON `[null]`) làm `.text()` NPE → **500** thay vì 400 sạch → thêm guard bỏ phần tử null ở `replacePoints`/`replaceCanDos`/`joinTexts` + test regression (create với `[valid, null]` → drop null, ko throw). Authz/migration/N+1/cascade/DTO-additive **không có defect**.
- **Hoãn có chủ đích**: mobile chưa đọc structured can-do (an toàn — DTO thêm cuối, axios bỏ field lạ); `ClassSession.lesson_id` (nối lịch↔bài) để lát D riêng, ko over-scope.

### Phase 2 — Sợi chỉ năng lực & AI content — 5-8 tuần

- Competency ledger (B4) + Selbstevaluation (B3). — **✅ 2a = nền ledger + B3 self-eval XONG**; **✅ 2b = B4 auto-cập nhật từ CHẤM ĐIỂM XONG** (SRS hoãn — thiếu link). Xem chi tiết dưới.
- One-click Homework (D3) + Rubric grading gắn thẻ năng lực (D4).
- Content Pack theo Lektion (E3) + AI Pacing Guide (H1) + Backward-Design Builder (H2).
- Gắn Lektion ↔ ClassSession + preset lộ trình Thường/Cấp tốc (C3-C4).

**Lát 2a — Competency ledger + Selbstevaluation (B3)** (CHƯA commit/deploy). Nền của cả Phase 2 (B4/D4 sau ghi cùng bảng). Migration **V256** `student_competency` `(id, student_id, can_do_statement_id FK CASCADE, status CHECK{NOT_STARTED,IN_PROGRESS,MASTERED}, source CHECK{SELF,GRADING,SRS} default SELF, updated_at)` UNIQUE(student_id, can_do_statement_id), FK student→users CASCADE. Backend: entity/repo + `StudentCompetencyDto`/`SetCompetencyRequest` + `StudentCompetencyService` (`getForClass` scope theo enrollment+can-do của lớp, batch N+1-safe; `setSelfAssessment` guard **enrolled** + **can-do thuộc đúng lớp** (cross-class) + validate status→400, upsert source=SELF) + 2 endpoint student (`GET/PUT /v2/students/classes/{classId}/competency[/{canDoStatementId}]`). FE: `studentClassesApi` +`fetchClassCompetency`/`setCompetency`; trang lớp HV **`<select>` tự đánh giá** mỗi can-do (Chưa/Đang học/Thành thạo, optimistic+rollback, ✓ xanh khi Thành thạo) + tổng **"{mastered}/{total} đã đạt"**; i18n vi/en/de. Test **BE StudentCompetencyServiceTest 8** (enrollment/cross-class/status guard + upsert) · tsc/vitest 294/i18n 2026×3 sạch · `next build` OK · route student/classes compile+redirect sạch. **✅ Review** (1 code-reviewer agent, ultracode OFF → ko workflow): **APPROVE 0 finding** (authz/migration/upsert-race qua GlobalExceptionHandler 409/N+1 đều đạt). **Còn Phase 2**: 2b B4 auto-ledger (chấm→can-do map + SRS), D3/D4, AI content.

**Lát 2b — B4 Competency ledger auto từ CHẤM ĐIỂM** (CHƯA commit/deploy). **KHÔNG migration** (V256 `source` CHECK đã cho GRADING). Pre-map bằng workflow 4-reader (grading-hook / assignment→can-do / SRS / ledger). Thêm `StudentCompetencyService.applyGradingResult(studentId, assignmentId, score)` `@Transactional(REQUIRES_NEW)` gọi **best-effort try/catch** tại **3 điểm chốt điểm**: manual `TeacherService.evaluateAssignment` (@Transactional), AI essay `GradingService.aiGradeAssignment` (@Async), AI Sprechen `TeacherAiGradingService.autoGradeSession` (@Async) — ngay sau `onAssignmentGraded` sẵn có. Ánh xạ: assignment → `ClassAssignment.lessonId` (1d-D1) → can-do của bài, **lọc theo kỹ năng** (chuẩn hoá **`HOREN`→`HOEREN`** — assignment dùng HOREN, can-do dùng HOEREN; GENERAL/blank/null = wildcard; can-do untagged = toàn bài). Điểm→trạng thái: ≥80 MASTERED else IN_PROGRESS; null score/null lessonId → no-op. Merge **upgrade-only** (chỉ THĂNG, không hạ — bảo vệ SELF MASTERED, chống thrash; source=GRADING chỉ khi thăng thật). Batch-load `findByStudentIdAndCanDoStatementIdIn` chống N+1. **REQUIRES_NEW + inner try/catch**: lỗi ledger KHÔNG làm hỏng/rollback điểm, KHÔNG chạm outer catch (tránh lật GRADED→FAILED). **SRS HOÃN**: SRS neo `skill_tree_nodes` (vũ trụ self-study), không có link tới `class_lessons`/can-do → cần link mới + job tổng hợp (lát riêng). FE: DTO `source` (SELF/GRADING/SRS) → trang lớp HV badge **"(auto)"** khi GRADING (đổi thủ công → SELF). Test **BE 6 suite** (StudentCompetency **15**, Teacher 22, Grading 5+3, TeacherAiGrading 2+1) MVN_EXIT=0 · tsc/vitest 294/i18n **2027×3**/next build/preview sạch. **✅ Review đối kháng** (workflow 4 auditor + verify từng finding): **8 candidate → 6 CONFIRMED, đã fix hết; 2 REFUTED**. Fix: **(1 HIGH)** assignment GENERAL/wildcard trước đây mark CẢ 4 kỹ năng MASTERED (GENERAL là default!) → sửa: wildcard chỉ chạm can-do **untagged** (lesson-wide), skill-specific = đúng skill + untagged; **(MED)** re-grade thấp hơn (GRADING→GRADING) bị upgrade-only chặn → sửa: merge **source-aware** (GRADING ghi đè GRADING latest-wins kể cả hạ; upgrade-only CHỈ vs SELF — vẫn bảo vệ tự đánh giá HV); **(MED)** sync-path REQUIRES_NEW commit ledger TRƯỚC khi grade tx commit → orphan khi @Version rollback → sửa: `evaluateAssignment` bắn ledger qua **afterCommit** synchronization. **(2 LOW)** read-then-insert race → chấp nhận best-effort self-healing (đã ghi chú, đúng convention ledger). Docs §7+B4 row cập nhật.

### Phase 3 — Hệ sinh thái hoàn chỉnh — 8+ tuần

- Seed 3 giáo trình mẫu A1/A2/B1 (E1) + Course Template clone-and-tweak (E2).
- Cổng phụ huynh + Competency Report song ngữ (G1-G2) + Publish/Sync (G3).
- Formative exit-ticket + Gap Heatmap (H3), Summative Mock aligned (H4), Adaptive Remediation (H5), Assign AI-Speaking (H6).

---

## 8. Rủi ro & Lưu ý

- **Scope creep:** Danh mục lớn — phải kỷ luật ship Phase 0 trước, không nhảy thẳng vào competency ledger/AI. Mỗi Phase phải độc lập tạo giá trị.
- **Di trú dữ liệu `description`:** Rủi ro mất knowledge points khi gỡ khỏi description. Bắt buộc migration đọc-parse-insert có kiểm thử, backfill idempotent, giữ description gốc cho tới khi verify xong. Đây là dữ liệu production của lớp thật.
- **Đồng bộ student:** `/v2/student/progress` đọc cùng `class_lessons` (V197). Mọi thay đổi schema/hiển thị phải đồng bộ view student, tránh vỡ màn tiến độ HV. Publish/Sync tái dùng SSE/Redis/Expo push — **thêm case `render()` cho NotificationType mới, KHÔNG xoá dead enum** (theo lệ đã ghi nhận trong `NotificationContentRenderer`).
- **i18n vi/en/de:** CanDoStatement và mọi nhãn mới phải theo `messages/v2/<area>.<locale>.json` (guard `scripts/check-i18n-v2.js`). Nội dung học (can-do) có thể flag learning-content, UI dịch qua LLM.
- **Tải AI & chi phí:** Content Pack/Pacing/Exit-ticket/Remediation gọi LLM nhiều → phải trừ token pool (image/PPTX/STT từng KHÔNG trừ pool — tránh lặp lỗi), backpressure (đã có `CallerRunsPolicy`), và cache. Định tuyến Sprechen/Schreiben qua đúng grader đã hardened (PR #205).
- **Ba thực thể "buổi học":** Hợp nhất bằng FK phải thận trọng — dữ liệu lịch sử `ClassLessonLog`/`ClassSession` cũ chưa có `lessonId` (nullable, backfill dần).
- **Nhầm lẫn v1/v2:** Khi port reports v1→v2, giữ v1 chạy song song tới khi v2 ổn định; tránh phá luồng GV đang dùng.
- **Consistency với backend enforce quota:** Client `PRO_UNLOCKED_FREE` chỉ ở client; backend vẫn enforce — mọi tính năng AI mới phải route lỗi quota qua `handleAiError`/`apiMessage(e)` (bài học PR #203).

---

## 9. Phụ lục

### 9.1. Bảng đối chiếu DeutschFlow vs LMS/đối thủ

| Năng lực | DeutschFlow (hiện) | DeutschFlow (tầm nhìn) | Azota | DeutschExam.ai | DotB/CenterOnline | Google Classroom |
|---|---|---|---|---|---|---|
| Nội dung tiếng Đức chuẩn CEFR | ❌ (phẳng) | ✅ Module/Lektion + can-do | ❌ | ✅ (đề luyện) | ❌ | ❌ |
| AI chấm 4 kỹ năng (tự luận/Sprechen/Schreiben) | ✅ (đã có) | ✅ + gắn thẻ năng lực | ⚠️ (tự luận chấm tay) | ✅ rubric | ❌ | ❌ |
| Nộp bài bằng ảnh (OCR) | ✅ | ✅ + rubric telc 3 tiêu chí | ✅ | ✅ | ❌ | ❌ |
| Luyện nói AI | ✅ | ✅ + assign theo Lektion | ❌ | ✅ | ❌ | ❌ |
| Pacing/curriculum map | ❌ | ✅ AI mapper | ❌ | ⚠️ (lộ trình cá nhân) | ⚠️ | ❌ |
| Điểm danh | ⚠️ (backend, chưa v2) | ✅ v2 + gắn nội dung | ❌ | ❌ | ✅ | ❌ |
| Sổ điểm/phổ điểm theo lớp | ⚠️ (backend, chưa v2) | ✅ v2 | ❌ (thiếu) | ⚠️ | ✅ | ⚠️ |
| Cổng/sổ liên lạc phụ huynh | ❌ | ✅ competency report | ❌ | ❌ | ✅ | ⚠️ |
| Kênh thông báo lớp (thay Zalo) | ⚠️ (đang làm branch này) | ✅ | ❌ | ❌ | ⚠️ (stream) | ⚠️ |
| SRS/skill-tree gắn nội dung | ✅ (đã có) | ✅ + remediation | ❌ | ⚠️ | ❌ | ❌ |
| Bản địa hoá VN (vi/en/de) | ✅ (đang làm) | ✅ | ✅ | ❌ (chỉ EN) | ✅ | ✅ |
| Mock test Goethe/telc/ÖSD | ✅ (engine có) | ✅ + aligned mục tiêu | ⚠️ (tự tạo) | ✅ | ❌ | ❌ |

**Kết luận cạnh tranh:** DeutschFlow là ứng viên DUY NHẤT có thể hợp nhất cả 3 lớp (nội dung CEFR + AI chấm + vận hành trung tâm) bản địa hoá VN. Không đấu "miễn phí giao-chấm bài" trực diện với Azota; khác biệt bằng nội dung tiếng Đức + AI 4 kỹ năng + báo cáo năng lực.

### 9.2. Nguồn tham khảo

**Best-practice LMS (cơ chế nội dung/giáo trình):**
- Canvas Modules, Requirements & Prerequisites, Outcomes — community.canvaslms.com / instructure.com
- Google Classroom Topics, scheduled posts, reuse post — support.google.com/edu/classroom
- Moodle Course formats, Activity completion, Competency frameworks — docs.moodle.org
- Schoology mastery-based grading / learning objectives — powerschool.com

**Giáo trình DaF & CEFR:**
- Hueber Menschen — hueber.de/reihe/menschen; Schritte international Neu — hueber.de/reihe/schritte-international-neu
- Klett DaF kompakt neu — klett-international.com; Aspekte neu / Netzwerk neu — klett-sprachen.de
- Council of Europe CEFR — coe.int; Profile deutsch (Kann-Beschreibungen)

**Kỳ thi:**
- Goethe-Institut Prüfungen — goethe.de/de/spr/prf.html; Durchführungsbestimmungen B1
- telc Deutsch A2·B1 — telc.net; ÖSD — osd.at

**Đối thủ & thị trường VN:**
- Azota — azota.vn; case study — techcrunch.com/2022/07/05/azota-is-solving-exam-headaches-for-vietnams-teachers
- DeutschExam.ai — deutschexam.ai
- DotB EMS — dotb.vn; CenterOnline — center.edu.vn; MONA — mona.media
- Google Classroom trung tâm VN; Excel học bạ — edusa.vn

**Khung sư phạm & công cụ AI giáo dục:**
- Backward Design (Wiggins & McTighe) — en.wikipedia.org/wiki/Backward_design; teaching.uic.edu
- Khanmigo — khanmigo.ai/teachers; Diffit — diffit.me; Common Planner — commonplanner.com

---

### 9.3. File liên quan (để triển khai)

- `frontend/src/lib/knowledgePoints.ts` — encode/decode knowledge points (điểm cần gỡ khỏi description)
- `frontend/src/lib/teacherLessonsApi.ts` — client API (có sẵn `reorderLessons()`)
- `frontend/src/app/v2/teacher/tc-progress/page.tsx` + `tc-checklist/page.tsx` + `tcShared.tsx` — 2 màn hiện tại
- `frontend/src/components/ui-v2/nav.ts` (dòng 77-78) — nhãn nav cần đổi (Phase 0.1)
- `frontend/src/app/teacher/reports/page.tsx` — nguồn UI v1 để port lên /v2 (gradebook/skill-report/attendance/evaluation)
- `frontend/src/app/teacher/classes/[id]/lessons/client-page.tsx` — v1 có nút reorder tham chiếu
- `backend/.../teacher/entity/ClassLesson.java`, `ClassLessonLog.java`, `ClassAssignment.java` — 3 thực thể "buổi học" cần hợp nhất FK
- `backend/.../teacher/service/LessonLogService.java`, `StudentEvaluationService.java`, `ClassLessonService.java` — service tầng nghiệp vụ
