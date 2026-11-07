# Luyện thi (telc) và Thi thử — tài liệu kỹ thuật

> Phạm vi: phần **Luyện thi** trên web (`/v2/student/exam` và các màn con), gồm luyện từng Teil, thi thử
> trọn đề, kết quả, lịch ôn, hướng dẫn lần đầu, bài chẩn đoán. Phòng thi **nói** nằm trong khu Luyện thi
> (`/v2/student/mock-exam/oral/**`, từ 07/11/2026), backend là module riêng (`examspeaking`); mục 1.3 tóm tắt luồng.
>
> Cập nhật: 07/11/2026, sau đợt làm mới giao diện (a)–(f), PR #760–#765, và phần thoát giữa chừng
> (hộp xác nhận, lượt thi thử "Dừng giữa chừng", mục 2.8). Repo PUBLIC: tài liệu không chứa
> địa chỉ máy chủ, khoá hay giá trị cấu hình bí mật. Quy trình merge/deploy: `docs/QUY_TRINH_PHAT_HANH.md`.
> Đặc tả nghiệp vụ (SRS): `TAI_LIEU_DAC_TA_SAN_PHAM/chi-tiet/modules/07-luyen-thi-va-thi-thu.md` (chỉ ở máy owner).

---

## 1. Tổng quan

### 1.1 Luồng học viên

```
Bài chẩn đoán ──► Hôm nay ──► Đề ──► Làm bài (luyện từng Teil) ──► Thi thử ──► Kết quả ──► về Hôm nay
 (lần đầu)        lịch tuần,        chiến thuật,     Hören 4 bước, Viết AI     3 chặng,     "Ước tính",
                  4 kỹ năng         nhãn Hôm nay     chấm, phân tích từng câu   hết giờ tự nộp  lấy lại điểm
```

| Bước | Route | Mục đích |
|---|---|---|
| Bài chẩn đoán | `/v2/student/exam/diagnostic` | Khai ngày thi, phút mỗi ngày; 5 phần chấm theo chuẩn telc B1; sinh lịch ôn |
| Hôm nay | `/v2/student/exam` | Thẻ Hôm nay, bốn kỹ năng, lịch tuần đổi chỗ được, danh sách đề |
| Đề | `/v2/student/mock-exam/practice?examId=` | Một đề: Teil theo phần thi, ngăn Chiến thuật, lịch sử thi thử |
| Làm bài | `/v2/student/mock-exam/practice/teil?examId=&teil=` | Luyện một Teil, không ép giờ, nộp xong có phân tích |
| Thi thử | `/v2/student/mock-exam/full?examId=` | Màn trước khi thi → làm bài có đồng hồ tổng của server |
| Kết quả | `/v2/student/mock-exam/full?attemptId=` | Kết luận, điểm "Ước tính", lấy lại điểm, xem lại từng Teil |
| Phòng thi nói — lối vào | `/v2/student/mock-exam/oral?provider=&level=&mode=MOCK\|DRILL&teil=&return=` | Thi thử: Kiểm tra micro (lần đầu hoặc micro chưa cho phép) rồi tạo phiên; luyện Teil: tạo phiên ngay |
| Phòng thi nói — phòng | `/v2/student/mock-exam/oral/{id}?return=` | Chuẩn bị → Đang thi (toàn màn hình) → Đang chấm → Kết quả |
| Kỳ thi khác | `/v2/student/mock-exam/oral/other` | Chọn Goethe/telc × cấp để thi/luyện nói, không đổi lịch ôn |
| Ôn yếu điểm (nói) | `/v2/student/mock-exam/oral/weakness` | Lỗi hay gặp theo dạng bài + gói Redemittel |

Route cũ `/v2/student/mock-exam` và `/v2/student/mock-exam/run` chuyển về Hôm nay. Route cũ của phòng thi nói
`/v2/student/speaking/exam/**` đã **xoá hẳn** (owner chốt 07/11/2026, không chuyển hướng); hub Luyện nói không còn thẻ
"Luyện thi nói". Đường dẫn dựng qua `frontend/src/lib/exam/oralRoutes.ts` (`oralEntryHref`, `oralSessionHref`,
`safeReturn` chỉ nhận `/v2/student/…`). Đề Goethe ẩn trên web
(dữ liệu và lịch sử giữ nguyên; mobile vẫn dùng đường cũ).

### 1.1b Phòng thi nói (giao diện mới, kế hoạch 5 đợt)

- Lối vào: Hôm nay (thẻ `ORAL_MOCK` / `ORAL_DRILL`, thanh Sprechen) dùng `oralHref(plan, teil?)`; màn Đề có nhóm
  "Mündliche Prüfung" (`OralTeilGroup`: thi thử phần nói + mỗi Teil một dòng, nhãn theo lần thi nói gần nhất) và lịch sử
  thi nói trong "Thi thử đã làm" (`OralHistory`); Thi thử chọn "Phần nói"; Kết quả thi thử; bài chẩn đoán.
- Màn Kiểm tra micro đứng **trước** khi tạo phiên (A1/A2 không có giờ chuẩn bị: tạo phiên là đồng hồ chạy). Đã qua thì
  ghi khoá `exam.oralMicCheck` vào kho hướng dẫn đã xem (`/auth/me/tours`).
- Chuẩn bị và Đang thi mở toàn màn hình (`useImmersiveChrome` theo trạng thái); rời phòng chuẩn bị, kết thúc, sang Teil
  khi thi thử đều hỏi trước. Chi tiết và các đợt còn lại: SRS module 07, EXAM-100 trở đi.
- Kết quả (`OralResult`): tiêu đề là kết luận theo ngưỡng riêng phần nói (`blueprint.speakingOnlyMin`, telc B1 45/75;
  không có ngưỡng thì chỉ ghi điểm), nhãn "Ước tính · Đỗ/Chưa đỗ/Sát ngưỡng", điểm từng Teil kèm nhận xét giám khảo +
  tiêu chí chung, "Xem lại hội thoại" đọc `GET /speaking/exam/sessions/{id}/transcript` (không lưu âm thanh cho mọi
  người — owner chốt), phiếu chấm chi tiết (`Ergebnisbogen`) thu gọn. Drill đã xong mở lại trang thì tổng kết dựng từ
  cùng API đó.
- Hướng dẫn lần đầu (khoá `exam.oral`): tự mở lần đầu vào Đang thi (cả luyện lẫn thi thử), 3 bước Ba phần thi → Nút
  micro → Thẻ đề; nút dấu hỏi trên thanh trên mở lại. Đồng hồ thi do server giữ nên không dừng được: giám khảo chờ tới
  khi hướng dẫn đóng (`useScreenTour().settled`), bước đầu nói rõ đồng hồ vẫn chạy (owner chốt 07/11/2026).
- Ý trên thẻ đề tự gạch: thẻ có `prompts` (telc B1 T3, Goethe B1 T1…) thì lời gọi AI bạn thi/giám khảo của mỗi lượt trả
  thêm `covered` (chỉ số ý đã bàn tới) — không tốn thêm lượt AI. Server chỉ cộng thêm, lưu theo Teil trong `plan_json`
  (`SessionPlan.PartPlan.coveredPoints`, không cần migration), trả về `directive.coveredPoints`.
- Tự dừng khi im (`lib/exam/silenceDetector.ts`): đã nói ≥ 300ms rồi im liền 2 giây thì dừng-và-gửi như bấm tay; chưa
  nói thì không cắt; mức âm phẳng (Safari/iOS chặn AudioContext) thì không tự dừng. Công tắc dưới dòng trạng thái, mặc
  định bật, nhớ theo máy (`localStorage df.oral.autoStop`).

### 1.2 Hiện có cho kỳ thi nào

| | telc B1 | telc A1, A2, B2 | telc C1 |
|---|---|---|---|
| Đề Lesen/Sprachbausteine/Hören/Schreiben (`mock_exams`) | 4 bộ | chưa có | chưa có |
| AI chấm Viết theo phiếu telc | có (3 tiêu chí I–III, bậc A–D, 45 điểm) | chưa | chưa |
| AI chấm Nói (phòng thi nói) | có | có | chưa |
| Lộ trình đếm ngược (`ExamPlanBlueprints`) | có | chưa | chưa |
| Bài chẩn đoán | có | chưa | chưa |

Chấm theo tiêu chí telc từng trình độ A1–C1 là việc của đợt sau (cần nguồn tiêu chí chính thức của telc).

### 1.3 Quyền vào

- Cờ đọc thẳng DB mỗi lần (`system_config`): `practice.telc.access` = `OFF | ALLOWLIST | ALL`,
  `practice.telc.allowlist` = id hoặc email, ngăn bằng dấu phẩy. ADMIN luôn vào được.
- Quản lý ở trang admin **Quyền luyện đề** `/v2/admin/practice-access` (`/api/admin/practice-access`).
- Ngoài cờ: bộ đề có thể khoá theo gói (`mock_exam_packs`, `MockExamPackService.assertExamUnlocked`);
  đề chưa duyệt (`reviewed = false`) hiện "Sắp có", không có đường vào.
- Cờ tắt ⇒ màn Hôm nay chỉ báo "chưa mở cho tài khoản này".

---

## 2. Các màn (frontend)

Tất cả nằm dưới `frontend/src/`. Giao diện Galerie (`.ga-scope`, token `ga-*` trong `tailwind.config.ts`,
`styles/galerie.css`), icon Lucide 0.487 nét 1.9, không có giao diện tối. Ô icon `Glyph` (`components/exam/today/visual.tsx`)
chính là `GaGlyph` dùng chung của web (`components/ui-v2/GaGlyph.tsx`); eyebrow là chữ trơn, không icon; Viết dùng `PenLine`
(không dùng `PenTool` — đó là bút vẽ vector). Quy ước icon chung của web: `frontend/ICON_WEB.md`.

### 2.1 Hôm nay — `app/v2/student/exam/page.tsx`

Thứ tự: (thẻ bài chẩn đoán) → **thẻ Hôm nay** → nút gợi ý → **Bốn kỹ năng** → **Tuần này** → **Đề luyện**.

| Khối | Dữ liệu | Code |
|---|---|---|
| Nhãn "N ngày nữa thi" | `GET /exam-plan` (`daysLeft`, `targetDate`) | `CountChip` |
| Thẻ bài chẩn đoán | `GET /exam-diagnostic`: `NONE` ⇒ "Làm bài chẩn đoán", `IN_PROGRESS` ⇒ "Làm tiếp". Người mới chưa có lịch chỉ thấy thẻ này | `DiagnosticCard` |
| Thẻ Hôm nay | Buổi của hôm nay trong lịch tuần; không có lịch ⇒ Teil yếu nhất | `todayCard()` trong `components/exam/today/todayModel.ts` |
| Nút gợi ý (tối đa 3, chỉ khi đã xem hướng dẫn màn này) | Ôn câu sai Teil vừa kiểm tra · Teil yếu kế tiếp · thi thử sắp tới trong tuần (không có ⇒ "Thi nói lần đầu") | `suggestionsFor()`, `SuggestionRow` |
| Ô đặt ngày thi | Khi `NEEDS_DATE`/`EXAM_PASSED` và đã làm bài chẩn đoán | `DateCard` → `PUT /exam-plan/target-date` |
| Bốn kỹ năng | Lesen (gồm Sprachbausteine), Hören, Schreiben: lần kiểm tra **gần nhất** của mỗi Teil qua mọi đề; Sprechen: lần thi nói telc B1 có điểm gần nhất (`/speaking/exam/results`). Vạch 60%; Đạt ≥ 60 / Sát ngưỡng 50–59 / Dưới ngưỡng | `skillsFrom()`, `components/exam/today/SkillBars.tsx` |
| Tuần này | `weeks[current].days` của `/exam-plan`; kéo thả hoặc bấm hai buổi để đổi chỗ; buổi đã làm/đã qua khoá | `components/exam/today/WeekPlan.tsx`, `swapLocally()` + `PUT /exam-plan/days/swap` |
| Đề luyện | `/mock-exams/packs` (chỉ telc) + `/mock-exams/practice/{id}` | `ExamRowView` |

Chọn đề để mở một Teil (`pickExamFor`): đề đang làm dở Teil đó → đề chưa luyện Teil đó → đề luyện Teil đó điểm thấp nhất.

### 2.2 Màn Đề — `app/v2/student/mock-exam/practice/page.tsx`

- Đầu trang: tên đề, nhãn "x/y Teil đã luyện", nhãn lần thi thử gần nhất, nút **Thi thử trọn đề** (lượt dở ⇒ "Làm tiếp thi thử").
- "Luyện từng Teil" theo phần thi; dòng Teil có cột trạng thái cố định, nút bóng đèn mở **ngăn Chiến thuật**
  (`components/exam/strategy/StrategyDrawer.tsx`, dữ liệu `/exam-strategies`, Teil chưa duyệt ⇒ mẹo chung + "sắp có").
- Teil của buổi hôm nay có nhãn vàng **Hôm nay** (`teilKeyOf(todaySession(plan))`).
- "Thi thử đã làm": biểu đồ điểm phần viết 6 lượt gần nhất, vạch 60%; danh sách Đỗ/Chưa đỗ của riêng đề này.

### 2.3 Khung làm bài — `components/exam/practice/`

| File | Vai trò |
|---|---|
| `PracticeShell.tsx` | Khung toàn màn: thanh trên (thoát · ô icon + tên Teil · dấu hỏi hướng dẫn · bóng đèn chiến thuật · đồng hồ), thanh dưới (ô số câu gắn qua `PracticeFootSlot`, "Đã lưu", nút chính). Đồng hồ luyện đếm lên, ẩn được; thi thử đếm xuống, cam ≤ 5', đỏ ≤ 1' |
| `SplitPanes.tsx` | ≥ 760px: hai cột cuộn riêng, vạch chia kéo được 35–65% (nhớ `df.practice.split`, nhấp đúp về 52%, phím mũi tên). < 760px: ngăn câu hỏi kéo lên xuống, mốc 28/55/88%. Thanh cuộn chỉ hiện khi đang cuộn (`.ga-autoscroll`) |
| `ObjectiveTeilView.tsx` | 6 dạng khách quan (nối tiêu đề, a/b/c, rao vặt + x, chỗ trống a/b/c, kho từ, richtig/falsch); đáp án đã dùng có viền đứt; đánh dấu câu; phím tắt; sau khi nộp: `ItemAnalysis` (vì sao sai + bẫy, vì sao đúng + "Xem trong bài") |
| `HoerenTeilView.tsx` + `useHoerenRitual.ts` + `HoerenPlayer.tsx` | Hören 4 bước Chuẩn bị → Hướng dẫn (Ansage) → Đọc câu hỏi → Nghe; câu hỏi khoá tới hết Ansage; lượt nghe theo `max_plays` của đề (T1 1 lần + 30s đọc, T2 2 lần + 60s, T3 2 lần, không giờ đọc). Luyện từng Teil có công tắc "Như thi thật / Luyện thoải mái" (nhớ `df.practice.hoerenMode`); thi thử luôn như thi thật. Audio đọc bằng TTS (`speakExamLine`) |
| `WritingTeilView.tsx` | Đề + 4 ý tự đánh dấu \| ô viết, đếm tới 80 từ, cụm chèn nhanh; điện thoại hai thẻ Đề bài \| Bài viết |
| `WritingResultView.tsx` | Bài viết đã chấm: ô điểm /45 có vạch 60% và nhãn **"Ước tính"**, VI/DE nhớ `df.practice.writingLang`, lỗi tô vàng trong bài, ý thiếu là nhãn đỏ, thẻ ghi chú, 3 tiêu chí A–D, bài mẫu |

Trang luyện Teil: `app/v2/student/mock-exam/practice/teil/page.tsx` — lưu nháp tự động (`PUT .../draft`, hook
`usePracticeDraft`: hẹn giờ 1,5 s, lưu ngay khi thoát, `keepalive` khi đóng/ẩn tab), nộp
(`POST .../check`) hoặc chấm Viết (`POST .../schreiben`, job nền), "Làm lại", "Viết lại bài này", nộp dưới 60% có
nút "Xem chiến thuật". Đồng hồ dừng khi tab ẩn, khi luyện thoải mái và khi hướng dẫn đang mở.

### 2.4 Thi thử — `app/v2/student/mock-exam/full/page.tsx`

1. **Màn trước khi thi** (`components/exam/mock/MockStart.tsx`): Trọn đề (~165') · Phần viết (150') · Phần nói (~15'),
   radiogroup có phím mũi tên; danh sách phần thi (phần không thi mờ 35%); 3 quy tắc. Đồng hồ của server **chỉ chạy
   khi bấm Bắt đầu** (`POST /mock-exams/{id}/start`, idempotent: lượt dở thì làm tiếp). Phần nói mở phòng thi nói.
2. **Làm bài**: ba chặng theo thứ tự thi thật — Lesen + Sprachbausteine → Hören → Schreiben (`components/exam/mock/mockModel.ts`).
   Chỉ chuyển Teil trong chặng hiện tại; "Sang Hören" mở màn tối đếm 10s (`HoerenRitual.tsx`), "Sang Schreiben" có hộp
   xác nhận; chặng lưu theo lượt ở `df.fullExam.stage.{attemptId}`. Nháp lưu lên server (`PATCH /attempts/{id}/draft`,
   có phiên bản chống ghi đè, rời trang thì `fetch keepalive`). Hết giờ ⇒ tự nộp, màn "Hết giờ. Bài đã tự nộp." + các bước chấm.
3. **Nộp**: `POST /attempts/{id}/finish` → job chấm nền (Viết bằng AI) → client chờ `/async-jobs` → mở kết quả.
4. **Dừng giữa chừng**: bấm thoát (mục 2.8) → `POST /attempts/{id}/stop` → kết quả "Dừng giữa chừng" (`PartialSummary`).

### 2.5 Kết quả thi thử — `components/exam/mock/ResultSummary.tsx`

- Tiêu đề là kết luận: "Đỗ phần viết, hơn ngưỡng N điểm" / "Còn thiếu N điểm phần viết".
- Hai ô điểm (phần viết, phần nói) từ `gates` của `/attempts/{id}/result`; trạng thái **"Ước tính · Đỗ/Chưa đỗ · cần N"**
  và một dòng "điểm AI chấm theo tiêu chí telc, không phải điểm chính thức". Phần nói chưa thi ⇒ "Thi phần nói".
- **Lấy lại điểm**: 3 dòng mất nhiều điểm nhất từ `budget.losses` (bỏ Nói, dòng chưa chấm), bấm mở Teil ở chế độ xem lại
  (`/mock-exams/practice/attempts/{id}/analysis`).
- "Điểm từng phần" thu gọn: bảng điểm, xem lại từng Teil, ngân sách điểm (`ExamBudgetPanel`).
- Xem lại Schreiben có nút **Viết lại bài này**: mang bài sang luyện Teil Schreiben qua `sessionStorage`
  (`df.practice.rewrite.{examId}`, mở `...teil?...&rewrite=1`).
- Hiệu ứng đếm điểm / nhô dòng chỉ chạy lần đầu mở (`df.mock.resultSeen.{attemptId}`).

### 2.6 Bài chẩn đoán — `app/v2/student/exam/diagnostic/page.tsx`

- Khai thông tin: kỳ thi telc Deutsch B1 (chỉ hiện), ngày thi ("Còn N ngày", ngày đã qua báo lỗi dưới ô), phút mỗi ngày
  20/30/45/60. Bắt đầu **đặt mục tiêu học của hồ sơ thành telc B1** (ghi rõ trên form).
- Năm phần (~85 phút, lưu từng phần, làm dở được — lần sau vào thẳng phần đang dở):

| Phần | Nguồn | Chấm |
|---|---|---|
| Lesen T1, Sprachbausteine T1, Hören T1 | Một đề telc B1 học viên mở được, ít luyện nhất trong các Teil chẩn đoán | Theo đáp án, qua luyện đề (`check`) |
| Schreiben | Đề Viết thật của đề đó (30') | AI theo phiếu telc B1 (`schreiben`) |
| Sprechen | Một lượt **thi thử phần nói** telc B1 làm sau khi bắt đầu bài chẩn đoán | AI theo rubric telc của phòng thi nói |

  Phòng thi nói chỉ chấm theo phiếu ở chế độ thi thử trọn phần (chế độ luyện từng Teil chỉ nhận xét từng lượt), nên
  phần Nói là thi thử trọn phần. Teil đã luyện trước đó trong đề được chọn tính là đã làm (dùng điểm cũ).
- Kết quả: "<kỹ năng thấp nhất> cần luyện trước", 4 thanh (Viết/Nói ghi "AI chấm theo tiêu chí telc · ước tính"),
  thẻ "Lịch ôn N tuần đã sẵn sàng · M phút mỗi ngày · K lần thi thử", "Làm lại bài chẩn đoán".

### 2.7 Hướng dẫn lần đầu và gợi ý — `components/exam/tour/ScreenTour.tsx`

- `useScreenTour({ key, steps, ready })`: lần đầu vào màn, tự mở sau 450ms khi màn đã tải; nền tối, khoanh vàng vùng có
  `data-tour="…"` (vùng không hiện thì bỏ bước), thẻ 1–2 câu, Tiếp/Bỏ qua, Enter/Esc; xong thì nhắc nút dấu hỏi.
  `familiar` = đã xem ⇒ màn hiện nút gợi ý. `TourHelpButton` mở lại.
- Đã xem lưu **theo tài khoản** (`GET/PUT /auth/me/tours`), máy giữ thêm bản `df.tours.seen` (mất mạng không tự mở lại).

| Khoá | Màn | Vùng `data-tour` |
|---|---|---|
| `exam.today` | Hôm nay | `today`, `skills`, `week`, `exams` |
| `exam.set` | Đề | `teile`, `mock`, `history` |
| `exam.teil` | Làm bài trắc nghiệm | `source`, `divider` (≥ 760px) / `handle` (< 760px), `dots`, `strategy`, `submit` |
| `exam.hoeren` | Làm bài Hören | `hoeren-prep`, `hoeren-mode`, `strategy`, `submit` |
| `exam.writing` | Làm bài Viết | `task`, `editor`, `strategy`, `submit` |
| `exam.mockStart` | Trước khi thi thử | `modes`, `rules` |
| `exam.result` | Kết quả thi thử | `scores`, `lost` |
| `exam.writingResult` | Bài viết đã chấm | `essay`, `note`, `criteria` |

Thêm bước cho màn mới: đặt `data-tour` lên vùng, khai `steps` (chuỗi trong `v2.student.tour.*`), gọi hook trước mọi
`return` sớm, render `tour.overlay`.


### 2.8 Thoát giữa chừng (owner chốt 07/11/2026)

Nút thoát của `PracticeShell` nhận `onExit`: màn làm bài hỏi trước khi rời. Luật chung: **Teil đã làm = đã trả lời
ít nhất 1 câu** (câu trống trong Teil đó tính 0); Teil chưa chạm không tính; **Viết dở không chấm**, AI chỉ chấm khi
bấm nộp.

| Màn | Chưa làm gì | Đã làm |
|---|---|---|
| Luyện Teil | Thoát thẳng | "Thoát khỏi …?" → "Lưu và thoát" lưu nháp ngay rồi rời; lỗi thì ở lại. Nháp không tính điểm kỹ năng |
| Bài chẩn đoán | Thoát thẳng | "Rời bài chẩn đoán?" → lưu nháp phần đang làm; vào lại nạp nháp, đồng hồ phần chạy tiếp |
| Thi thử | Huỷ lượt (`CANCELLED`, không vào lịch sử), rời | "Dừng lượt thi thử?" liệt kê Sẽ tính / Viết không chấm / Không tính → `/stop` → lượt `PARTIAL` |

**Lượt `PARTIAL`**: điểm từng Teil đã làm ở `detailed_scores_json` (`partial` = lý do `STOPPED`/`EXPIRED` + số Teil;
`teile` = `SCORED`/`WRITTEN_NOT_GRADED`/`NOT_ATTEMPTED`), `total_score`/`passed` rỗng, `finished_at` = mốc dừng đồng
hồ. Không vào xét đỗ, chứng nhận, điểm cao nhất, B1, lịch ôn, ngày thi thử của tuần (các chỗ đó lọc `COMPLETED`).
Lịch sử màn Đề hiện dòng "Dừng giữa chừng · đã làm N/M Teil", không vào biểu đồ; kết quả xem lại được từng câu.

**Đồng hồ server** không phải tiến trình (hạn giờ = `started_at + time_limit`). Lượt bỏ dở ngoài ý muốn quá hạn +
2 phút được **chốt lười** (`MockExamStopService.closeExpired`) khi chính người học gọi `/start`, `/attempts/me`,
`/exam-plan` — không có job định kỳ. `/start` khi đó mở lượt mới và trả `closed_attempt_id` để web báo một dòng. Hết
giờ lúc đang ngồi thi (tab mở) vẫn tự nộp cả đề như cũ.

---

## 3. Backend

### 3.1 API

| Method | Đường dẫn (`/api` + …) | Việc | Code |
|---|---|---|---|
| GET | `/mock-exams/packs`, `/mock-exams/packs/{id}` | Bộ đề, khoá theo gói | `MockExamPackController` |
| GET | `/mock-exams/practice/access` | Có quyền luyện đề không | `MockExamPracticeController` |
| GET | `/mock-exams/practice/{examId}` | Đề (đã bỏ đáp án) + tiến độ từng Teil | 〃 |
| PUT | `/mock-exams/practice/{examId}/teile/{key}/draft` | Lưu nháp Teil | 〃 |
| POST | `/mock-exams/practice/{examId}/teile/{key}/check` | Nộp Teil khách quan ⇒ phân tích từng câu | 〃 |
| DELETE | `/mock-exams/practice/{examId}/teile/{key}` | Làm lại Teil | 〃 |
| POST | `/mock-exams/practice/{examId}/schreiben` | Chấm Viết bằng AI (trả `jobId`) | 〃 |
| GET | `/mock-exams/practice/attempts/{id}/analysis` | Phân tích từng câu của lượt thi thử | 〃 |
| POST | `/mock-exams/{examId}/start` | Bắt đầu / làm tiếp thi thử (idempotent) | `MockExamController` |
| PATCH | `/mock-exams/attempts/{id}/draft` | Lưu nháp thi thử (có phiên bản) | 〃 |
| POST | `/mock-exams/attempts/{id}/finish` | Nộp ⇒ job chấm nền | 〃 |
| POST | `/mock-exams/attempts/{id}/stop` | Dừng giữa chừng ⇒ `PARTIAL` (chấm theo Teil) / `CANCELLED` (chưa chạm câu); idempotent | 〃 + `MockExamStopService` |
| GET | `/mock-exams/attempts/me[?includePartial=true]`, `/mock-exams/attempts/{id}/result` | Lịch sử (mặc định không có `PARTIAL` cho mobile), kết quả (`gates`, `budget`; lượt `PARTIAL` không có) | 〃 |
| GET | `/exam-strategies?provider&level&lang` | Chiến thuật từng Teil (LT2) | `ExamStrategyController` |
| GET | `/exam-plan` | Lộ trình đếm ngược; tuần hiện tại có `days` | `ExamPlanController` |
| PUT | `/exam-plan/target-date` | Đặt ngày thi | 〃 |
| PUT | `/exam-plan/days/swap` `{weekNo, from, to}` | Đổi chỗ hai buổi của tuần hiện tại | 〃 |
| GET | `/exam-diagnostic` | Trạng thái bài chẩn đoán (`NONE`/`IN_PROGRESS`/`DONE`) + lượt thi nói đã dùng | `ExamDiagnosticController` |
| POST | `/exam-diagnostic/start` `{targetDate, dailyMinutes}` | Ghi hồ sơ + chọn đề | 〃 |
| POST | `/exam-diagnostic/finish` | Chốt kết quả (đủ 4 Teil + lượt thi nói) | 〃 |
| GET | `/auth/me/tours` | Khoá hướng dẫn đã xem | `UiTourController` |
| PUT | `/auth/me/tours/{key}` | Đánh dấu đã xem | 〃 |
| GET | `/speaking/exam/sessions/{id}/transcript` | Hội thoại đã lưu của phiên (chủ phiên; người khác 404) | `ExamSpeakingController` |
| * | `/speaking/exam/**` | Phòng thi nói | `ExamSpeakingController` |
| * | `/admin/practice-access/**` | Admin: cờ + danh sách được vào | `AdminPracticeAccessController` |

### 3.2 Lộ trình đếm ngược và lịch tuần

- `ExamPlanService.planFor`: sinh lại mỗi lần đọc từ hồ sơ (`exam_type`, `target_level`, `target_date`, phút/tuần) và kết
  quả gần nhất; `exam_plan_state` chỉ giữ ngày bắt đầu, trọng tâm các tuần đã chốt (`locked_weeks_json`) và thứ tự buổi
  học viên đã đổi (`day_order_json`, V363).
- Xếp Teil ưu tiên (`ExamPlanGenerator.rank`): điểm mất của bài thi thử telc B1 gần nhất; **chưa thi thử lần nào thì
  dùng tỉ lệ đạt của bài chẩn đoán** (`ExamDiagnosticScoring.losses`); không có gì thì theo trọng số điểm.
- `ExamPlanDays` (hàm thuần): chia tuần hiện tại thành buổi theo ngày — luyện Teil trọng tâm, thi thử phần viết (150')
  cuối tuần, thi nói, luyện nói, bài lộ trình, nghỉ, ngày thi. Số buổi = phút/tuần ÷ 30, kẹp 3–6, luôn ≥ 1 ngày nghỉ.
  Buổi "đã làm" khi có hoạt động khớp trong tuần (Teil đã kiểm tra, đề đã nộp, phiên Nói…), ghép theo thứ tự ngày.

### 3.3 Bài chẩn đoán

`ExamDiagnosticService` + `ExamDiagnosticScoring` (hàm thuần). Bốn Teil đọc tiến độ luyện đề của đề đã chọn; phần Nói đọc
`speaking_exam_results` (TELC B1, có điểm, `created_at ≥ started_at`). `finish` ghi `result_json` =
`{ratios, skills, oralSessionId}`; tỉ lệ của mỗi phần áp cho mọi Teil cùng phần khi xếp ưu tiên.

### 3.4 Chấm điểm

- Teil khách quan: `PracticeAnalysis` (phân tích + giải thích từ `mock_exam_explanations`).
- Viết: `ExamScoringService` + job AI (phiếu telc B1). Kết quả AI là **ước tính**, giao diện luôn ghi rõ.
- Thi thử: `ExamScoringService.summarize` ra các cổng đỗ (`written`, `oral`); điểm Nói lấy từ phòng thi nói
  (`MockExamOralGateService`). `ExamBudgetService` tính điểm mất từng Teil.
- Mọi lần chấm bằng AI trừ quota AI của học viên.

### 3.5 Dữ liệu và migration

| Migration | Nội dung |
|---|---|
| V357, V358, V361 | `mock_exam_practice_progress`, `mock_exam_explanations`, giải thích đề |
| V349 | `exam_plan_state` |
| **V363** | `exam_plan_state.day_order_json` (JSONB, mặc định `{}`) |
| **V364** | `user_ui_tours (user_id, tour_key, seen_at)` |
| **V365** | `exam_diagnostics (user_id PK, exam_id, result_json, started_at, finished_at)` |

V363–V365 chỉ thêm cột/bảng (tương thích ngược khi blue-green). Xoá người dùng ⇒ xoá theo (`ON DELETE CASCADE`).

---

## 4. Lưu trên máy (localStorage / sessionStorage)

| Khoá | Dùng cho |
|---|---|
| `df.practice.split` | Tỷ lệ vạch chia hai cột |
| `df.practice.hoerenMode` | Như thi thật / Luyện thoải mái |
| `df.practice.hideClock` | Ẩn đồng hồ luyện |
| `df.practice.ticks.{examId}`, `df.fullExam.ticks.{attemptId}` | Ý Viết đã đánh dấu |
| `df.practice.writingLang` | VI/DE ở bài viết đã chấm |
| `df.fullExam.stage.{attemptId}` | Chặng thi thử đang làm |
| `df.mock.resultSeen.{attemptId}` | Hiệu ứng kết quả chỉ chạy lần đầu |
| `df.tours.seen` | Bản sao khoá hướng dẫn đã xem |
| `df.practice.rewrite.{examId}` (sessionStorage) | Bài mang sang "Viết lại bài này" |

---

## 5. i18n, giao diện, test

- Chuỗi: `frontend/messages/v2/student.{vi,en,de}.json` — `student.examHub`, `student.practice` (+ `.frame`, `.hoeren`,
  `.map`), `student.fullExam` (+ `.start`, `.ritual`, `.result`), `student.examStrategy`, `student.tour`,
  `student.diagnostic`. `check-i18n-usage` gắn **một tên biến dịch với một namespace cho cả file** (`t`, `tp`, `tf`, `th`, `tt`…).
  Tên phần thi tiếng Đức (Lesen, Hören…) khai miễn trong `src/__tests__/catalogLanguagePurity.test.ts`.
- Hiệu ứng (`galerie.css`): `.ga-bar-grow`, `.ga-day-flash`, `.ga-rise`, `.ga-pop`, `.ga-pop-now`, `.ga-ritual`,
  `.ga-drawer-in`, `.ga-fade-in`, `.ga-timer-pulse`, `.ga-evidence-glow`, `.ga-spin`; tắt khi giảm chuyển động. Tailwind
  dự án **không** có plugin animate. Không có hiệu ứng theo cuộn.
- `cn()` (`lib/utils.ts`) khai báo cỡ chữ Galerie cho tailwind-merge — không có thì `cn('text-ga-small', 'text-ga-muted')`
  mất cỡ chữ.
- `npm run check:design-tokens` cấm thêm giá trị tuỳ ý (`text-[11px]`, `shadow-[…]`).
- Test frontend chính: `PracticeFrame`, `HoerenFlow`, `PracticeMapPage`, `ExamHubPage`, `MockFlow`, `todayModel`,
  `ScreenTour`, `DiagnosticPage`, `TelcPracticeViews`, `cnGaFontSize`.
- Test backend chính: `ExamPlanDaysTest`, `ExamPlanServiceTest`, `ExamPlanGeneratorTest`, `ExamDiagnosticScoringTest`,
  `ExamDiagnosticServiceTest`, `UiTourServiceTest`; Postgres (Testcontainers, chỉ CI/máy có Docker):
  `ExamPlanServiceIntegrationTest`, `ExamDiagnosticServiceIntegrationTest`, `UiTourServiceIntegrationTest`.
  **Đừng thêm `@MockBean` mới vào test Postgres**: mỗi tổ hợp là một Spring context + pool kết nối, CI từng vượt
  `max_connections` ("too many clients"); dựng service bằng tay với bản giả.

---

## 6. Vận hành

- Phát hành: `docs/QUY_TRINH_PHAT_HANH.md`. Thứ tự migration: V363 → V364 → V365, backend deploy trước frontend.
- Mở cho học viên: trang admin Quyền luyện đề (cờ `ALLOWLIST` thêm người, hoặc `ALL`).
- Mobile **chưa** có giao diện mới; mobile vẫn dùng endpoint cũ — không gỡ endpoint cũ cho tới khi mobile chuyển xong.
  `/exam-plan` chỉ thêm trường mới (`days`), không phá mobile.

| Triệu chứng | Kiểm |
|---|---|
| Học viên báo không vào được Luyện thi | Cờ `practice.telc.access` / allowlist; bộ đề có bị khoá theo gói |
| Lịch tuần trống | Hồ sơ thiếu `exam_type`/`target_level` khác TELC B1 (⇒ `UNAVAILABLE`) hoặc chưa có ngày thi (`NEEDS_DATE`) |
| Viết "đang chờ chấm" mãi | Job AI (`/async-jobs`), quota AI của học viên |
| Bài chẩn đoán không chốt được | Còn Teil chưa chấm, hoặc chưa có lượt thi nói telc B1 có điểm **sau** lúc bắt đầu |
| Hướng dẫn tự mở lại | Bảng `user_ui_tours` không ghi được (xem log `PUT /auth/me/tours`) |
