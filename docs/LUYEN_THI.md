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
| Bài chẩn đoán | `/v2/student/exam/diagnostic` | Khai ngày thi, phút mỗi ngày; đủ mọi Teil như đề thật (9 Teil phần viết + thi nói) chấm theo chuẩn telc B1; sinh lịch ôn |
| Hôm nay | `/v2/student/exam` | Thẻ Hôm nay, bốn kỹ năng, lịch tuần đổi chỗ được, danh sách đề |
| Đề | `/v2/student/mock-exam/practice?examId=` | Một đề: Teil theo phần thi, ngăn Chiến thuật, lịch sử thi thử |
| Làm bài | `/v2/student/mock-exam/practice/teil?examId=&teil=` | Luyện một Teil, không ép giờ, nộp xong có phân tích. `&at=<khối>:<đầu>:<cuối>&w=<chữ>` (mở từ sổ từ) ⇒ cuộn tới và tô tạm chữ đã lưu 4 s; chữ ở vị trí cũ lệch (đề đã sửa) ⇒ tìm lại chữ trong khối, không thấy thì thôi |
| Sổ từ | `/v2/student/vocabulary/my-words` | Từ đã lưu khi luyện đọc: theo chủ đề / theo bài đọc, tìm, "Mở trong bài", chuyển chủ đề, sửa nghĩa, gỡ (xác nhận); lối vào đầu dải bài luyện của trang Từ vựng |
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
  định bật, nhớ theo máy (`localStorage df.oral.autoStop`). Recorder và màn kiểm tra micro gọi `AudioContext.resume()`
  khi context khởi ở `suspended` (iOS) để thanh mức âm và tự dừng có tín hiệu.
- Nhận diện giọng nói lượt nói (`GroqWhisperClient`, 10/11/2026): STT chạy Fireworks. Host audio `audio-turbo` và
  `audio-prod` là dự phòng của nhau (cùng key): primary trả 5xx/lỗi kết nối thì tự thử host kia một lần. 400/413/415/422
  = audio không đọc được → `STT_FAILED` "ghi lại", không chuyển host. 09/11 `audio-turbo` trả 503 cả buổi.
- Phát giọng giám khảo trên iOS (`examTts.ts`, 09/11/2026): Safari chỉ cho `play()` trong cú chạm, còn `speakExamLine`
  phải chờ API TTS trước khi phát. Vì vậy mọi câu dùng MỘT thẻ `<audio>` chung, được mở khoá bằng đoạn im lặng ở lần
  chạm đầu tiên (`unlockExamAudio`: listener toàn trang + gọi tay ở "Nghe thử" và "Vào phòng"). `speakExamLine` trả
  `played | blocked | failed | skipped`; "Nghe thử" hiện lời nhắc khi `blocked` (tắt chế độ im lặng, tăng âm lượng)
  hoặc `failed` thay vì im lặng.
- Lời AI bị chặn trong phòng thi (`ExamRoom.speakSequence`, 10/11/2026): `blocked` thì micro vẫn khoá và hiện khung
  "Chạm để nghe" (`tts-blocked`). Chạm thì gọi `unlockExamAudio` trong cú chạm rồi phát lại câu đó; "Bỏ qua, tôi đọc chữ"
  thì mở lượt (lời vẫn hiện trong hội thoại). Không tự phát lại ở cú chạm sau, vì cú chạm đó có thể là nút micro và
  giọng AI sẽ lọt vào bản ghi.
- Bản ghi quá ngắn (`MicBar`, 10/11/2026): bấm dừng tay trước 0,6 giây (`MIN_TURN_MS`) thì không gửi STT, báo
  "Bản ghi quá ngắn" để ghi lại. Hết trần thời lượng hay tự dừng khi im không bị chặn.

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
| Bốn kỹ năng | Lesen (gồm Sprachbausteine), Hören, Schreiben: lần chấm **gần nhất** của mỗi Teil qua mọi đề, gộp lượt luyện từng Teil và (từ 09/11/2026) điểm Teil của lượt thi thử đã nộp hoặc dừng giữa chừng (`GET /mock-exams/practice/mock-teile`; Teil có ≥ 1 câu trả lời mới tính; Viết chỉ khi lượt đã nộp, bài có chữ và AI chấm xong; chỉ đề telc có trên trang; lượt luyện so bằng mốc chấm `checkedAt`, không phải mốc lưu nháp); Sprechen: lần thi nói telc B1 có điểm gần nhất (`/speaking/exam/results`). Vạch 60%; Đạt ≥ 60 / Sát ngưỡng 50–59 / Dưới ngưỡng | `skillsFrom()`, `components/exam/today/SkillBars.tsx` |
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
| `ObjectiveTeilView.tsx` | 6 dạng khách quan (nối tiêu đề, a/b/c, rao vặt + x, chỗ trống a/b/c, kho từ, richtig/falsch); đáp án đã dùng có viền đứt; đánh dấu câu (mọi dạng, phím F, hàng "Câu đã đánh dấu" để nhảy tới); phím tắt; sau khi nộp: `ItemAnalysis` (vì sao sai + bẫy, vì sao đúng + "Xem trong bài", ghi chú "vì sao tôi chọn", "Hỏi AI về câu này") |
| `itemAssist.tsx` | B3 (09/11/2026): context `ItemAssist` (`askAi`, `notes`/`onNote`, `flags`/`onToggleFlag`, `jump`) — trang cấp, `ObjectiveTeilView`/`ItemAnalysis` đọc (Hören đi qua `HoerenTeilView` không đổi props); `AskAiPanel`, `NoteField`, `FlagToggle`, `FlaggedList`, `useCachedAsk` |
| `components/exam/marks/` (09/11/2026) | **Đánh dấu bài đọc** — đợt 1: luyện Teil Lesen có bài đọc (a/b/c), màn ≥ 760px (đợt 2b, 10/11/2026: mọi cỡ màn — màn < 760px hoặc thiết bị cảm ứng `pointer: coarse` dùng thanh công cụ neo đáy màn `data-docked`, chờ 400 ms sau `selectionchange` để người dùng kéo xong hai đầu, ô ghi chú ở đầu màn; chuột + màn rộng giữ thanh nổi cạnh vùng chọn). Bố cục điện thoại (11/11/2026, sau khi owner thử Safari thật): thanh neo đáy mở ⇒ `html[data-ga-marking]` ẩn thanh dưới của khung (`[data-practice-foot]`) và `SplitPanes sheetHidden` ẩn ngăn câu hỏi (trừ khi đang chọn trong đề câu nằm trong ngăn) để bài đọc chiếm cả màn; thanh hai hàng, nút 44px, màu có tên ngắn; `MarksBar` cảm ứng một dòng chú thích + nút "?" (gợi ý dài chỉ tự mở lần đầu, khoá `df.marks.touchHintSeen`); bài đọc < 640px thu lề số dòng và giãn dòng. Đợt 2 (10/11/2026): thi thử — đang thi `marksMode="exam"` (chỉ màu, gạch chân, tẩy, gạch bỏ phương án; không gắn câu/ghi chú), xem lại Teil ở kết quả đủ công cụ + chẩn đoán; lưu theo lượt (`MarksSource` `attempt`), đổi Teil thì lưu ngay gói của Teil cũ. Đợt 3 (10/11/2026): thêm Lesen 1 (khối `t:<id>` = đoạn văn của câu), Lesen 3 (`ad:<k>` = mẩu rao vặt; khi có bút đánh dấu mẩu là `AdCard` `role="radio"` để bôi đen được — thả chuột sau khi bôi đen / bấm vào đoạn đã tô không tính là chọn), Sprachbausteine (`gap` = thư có chỗ trống, chữ giữa các chỗ trống qua `MarkedText from/to`); bài chẩn đoán chế độ thi (lưu chung chỗ luyện Teil). Luật khối dùng chung `marks/marksBlocks.ts` ↔ `PassageMarksValidator.blocksOf`. Đợt 3b: lời bài Hören SAU khi kiểm tra — mỗi dòng lời thoại là khối `h:<teil|id câu>:<i>` (câu dẫn `lead_in_de` là dòng 0 của câu; dòng cắt khoảng trắng kiểu JS `trim`, bỏ dòng rỗng — y như `HoerenPlayer`/`normalizeTurns`, server `PassageMarksValidator.hoerenLines`); `HoerenPlayer` đọc lớp qua `MarkLayerContext`; `HoerenTeilView` chỉ chuyển `marks` khi đã có kết quả. Bôi đen trong bài / đề câu ⇒ `PassageMarker` (thanh nổi: 3 màu Vàng từ khoá · Xanh bằng chứng · Hồng chưa chắc, gạch chân, gắn câu, "Câu N", ghi chú, tẩy; phím 1/2/3 U Q T N Del Esc); `MarkedText` vẽ khối chữ thành `span[data-seg][data-b][data-s]`; `MarksBar` (chú thích màu, Hoàn tác, Ẩn, `data-tour="marks"`); nút ⊘ gạch bỏ phương án; chip "Xem trong bài"; `MarkDiagnosis` sau kiểm tra. Mô hình thuần `marksModel.ts` (+ test), lưu `usePassageMarks` (hẹn 1,5 s, `keepalive`). Bằng chứng tìm bằng `lib/exam/evidenceRanges.ts` (khoảng trắng gộp, câu trích vắt hai dòng vẫn tô). Kế hoạch các đợt: `plans/2026-11-09-ke-hoach-danh-dau-bai-doc.md` (LOCAL) |
| `components/exam/poster/` + `styles/ad-posters.css` (14/11/2026) | **Áp phích rao vặt Lesen Teil 3** (owner chốt 13/11/2026: "khuôn chữ, có thêm phông trang trí" — HTML/CSS, KHÔNG dùng ảnh: chữ trong ảnh sinh ra hay sai chính tả tiếng Đức, không bôi đen / đánh dấu được, trình đọc màn hình không thấy, nặng). Dùng ở mọi nơi học viên thấy mẩu rao vặt (luyện Teil, thi thử, bài chẩn đoán, xem lại — đều qua `AdPool` của `ObjectiveTeilView`) và ở xem trước Xưởng đề (`TeilPreviewSituational`). **Dữ liệu không đổi**: `ads` vẫn là chữ cái → chuỗi; áp phích suy ra từ chuỗi. `adParts.ts` `parseAdParts` (thuần, có test) cắt chuỗi thành các lát `[s, e)` LIỀN NHAU phủ kín chuỗi (ghép lại đúng bằng chuỗi gốc, không thêm/bớt/đảo ký tự): **quy ước dòng** — dòng 1 tiêu đề, dòng 2 ngắn (≤ 40 ký tự, không kết thúc bằng dấu câu, còn ít nhất một dòng thân sau nó) là dòng phụ, các dòng giữa là thân, dòng cuối trông như liên hệ (`Tel.`/`Telefon`/`Handy`/`Kontakt`, e-mail, địa chỉ web, số điện thoại) là liên hệ (chế độ `lines`); mẩu cũ viết liền một đoạn (đề tay V325–V345) ⇒ chế độ `inline`: tiêu đề = phần trước dấu ngắt SỚM NHẤT của câu đầu (dấu hai chấm — giữ lại; dấu phẩy, gạch nối có cách, hết câu bằng dấu chấm — thành "dấu ngắt mềm" `.ad-soft`: vẫn nằm trong DOM, vẽ trong suốt để tiêu đề không treo dấu phẩy; ngoặc mở; `?`/`!` — giữ lại) nếu ≤ 52 ký tự, mỗi câu còn lại là một phần thân (không ngắt sau `Tel.`, `ca.`, `max.`, số thứ tự "1. Oktober"), câu cuối có Tel./e-mail/web là liên hệ; không tìm ra tiêu đề ⇒ `plain` (khuôn không cần tiêu đề). `adTemplates.ts`: 12 khuôn (`rahmen` khung + dải trên · `grau` hộp xám chữ nghiêng canh giữa · `rechts` canh phải · `band` dải tối vắt ngang · `schraeg` dải tối nghiêng · `pixel` tiêu đề chữ điểm ảnh · `liste` gạch đầu dòng · `hand` chữ viết tay · `plakat` serif đậm khung kép · `schmal` chữ hẹp in hoa · `bild` hình minh hoạ lớn · `schlicht` trơn); `assignTemplates` gán ổn định theo băm (FNV-1a) chữ của CẢ bộ mẩu — cùng đề thì mọi máy, mọi lần vẽ ra cùng khuôn; mẩu kén khuôn chọn trước, mỗi mẩu lấy khuôn hợp ít dùng nhất ⇒ 12 mẩu 12 khuôn (mẩu `plain` chỉ hợp 3 khuôn `schlicht`/`grau`/`rechts`; `liste`/`band` cần ≥ 2 phần thân). Hình minh hoạ: nét Lucide theo bảng từ khoá trong TIÊU ĐỀ (`adIcon`: Fahrrad, Umzug, Auto/Mitfahr, Flug/Reise, Musik, Theater, Essen/Koch, Sport/Yoga, Hund, Foto, Näh, Maler, Kurs/Nachhilfe, Kinder, Buch, Computer, Möbel, Wohnung/Zimmer/WG, Job…), chỉ ở 6 khuôn có chỗ cho hình, không khớp thì không vẽ, luôn `aria-hidden`. **Bút đánh dấu**: `AdPoster` vẽ từng phần bằng `MarkedText from/to` trên CÙNG chuỗi và CÙNG khối `ad:<k>` nên vị trí ký tự, đánh dấu đã lưu, "mở từ sổ từ" không đổi; bôi đen vắt qua hai phần vẫn ra một mảnh; trên dải tối gạch chân đổi sang màu giấy. `AdCard` giờ luôn là `div role="radio"` (kể cả khi chưa có lớp đánh dấu), chữ cái đứng trên áp phích và có bản `sr-only` để trình đọc màn hình đọc chữ cái trước. **Bố cục** (`AdPosterSheet`, container query theo bề rộng của chính cột nguồn): ≥ 560px ba cột cao thấp không đều (CSS nhiều cột, đọc theo cột như tờ đề), hẹp hơn hai cột chữ 12px (điện thoại 390px: 12 mẩu dài chừng 1 240px thay vì 12 thẻ xếp dọc), < 280px một cột. **Màu** chỉ qua token `--ga-poster-*` (galerie.css: giấy, mực, một xám, một màu dải); web chưa có chế độ tối. **Phông** (`posterFonts.ts`, `next/font/local`, tệp ở `src/fonts/poster/` kèm giấy phép SIL OFL 1.1, lấy từ `@fontsource/*` 5.3.0, tập Latin đủ ä ö ü ß €, `display: swap`, không preload, tổng 94 852 byte): Caveat 700, VT323, Abril Fatface, Oswald 600 — CSS chỉ vào 5 route (luyện Teil, thi thử, chẩn đoán, 2 trang Xưởng đề), tệp phông chỉ tải khi có chữ dùng tới. Test: `adParts.test.ts`, `adTemplates.test.ts`, `AdPosterLesen3.test.tsx`, nhóm "áp phích" trong `PassageMarksDot3.test.tsx`; `src/test/setup.ts` giả `next/font/local` (hàm thật chỉ chạy qua trình biên dịch Next). **Xưởng đề**: `SituationalTeile.ADS_SYSTEM` yêu cầu mẩu mới theo quy ước dòng, `adLines` giữ xuống dòng khi nhận mẩu (trước đây gộp hết thành một dòng); đếm từ (`TextChecks.wordCount`) và chống trùng tách theo ký tự không phải chữ nên không đổi. Đề cũ KHÔNG migrate — vẽ bằng chế độ `inline`/`plain` |
| `HoerenTeilView.tsx` + `useHoerenRitual.ts` + `HoerenPlayer.tsx` | Hören 4 bước Chuẩn bị → Hướng dẫn (Ansage) → Đọc câu hỏi → Nghe; câu hỏi khoá tới hết Ansage; lượt nghe theo `max_plays` của đề (T1 1 lần + 30s đọc, T2 2 lần + 60s, T3 2 lần, không giờ đọc). Luyện từng Teil có công tắc "Như thi thật / Luyện thoải mái" (nhớ `df.practice.hoerenMode`); thi thử luôn như thi thật. Audio đọc bằng TTS (`speakExamLine`) |
| `WritingTeilView.tsx` | Đề + 4 ý tự đánh dấu \| ô viết, đếm tới 80 từ, cụm chèn nhanh; điện thoại hai thẻ Đề bài \| Bài viết |
| `WritingResultView.tsx` | Bài viết đã chấm: ô điểm /45 có vạch 60% và nhãn **"Ước tính"**, VI/DE nhớ `df.practice.writingLang`, lỗi tô vàng trong bài, ý thiếu là nhãn đỏ, thẻ ghi chú, 3 tiêu chí A–D, bài mẫu |

Trang luyện Teil: `app/v2/student/mock-exam/practice/teil/page.tsx` — lưu nháp tự động (`PUT .../draft`, hook
`usePracticeDraft`: hẹn giờ 1,5 s, lưu ngay khi thoát, `keepalive` khi đóng/ẩn tab; từ B3 gửi kèm `notes` = ghi chú
"vì sao tôi chọn" theo câu, tối đa 300 ký tự, không bắt buộc), nộp
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
   **Đánh dấu xem lại** (B3): cờ ở từng câu (mọi dạng, phím F) lưu cùng nháp (`flags`, cột `draft_flags_json`, V374) — tải
   lại/đổi máy vẫn còn; nút "Câu đánh dấu (N)" ở thanh dưới (`components/exam/mock/FlaggedNav.tsx`) liệt kê câu của chặng
   đang thi, bấm để sang Teil đó và tới câu đó. Thi thử không có ô "vì sao tôi chọn".
3. **Nộp**: `POST /attempts/{id}/finish` → job chấm nền (Viết bằng AI) → client chờ `/async-jobs` → mở kết quả.
4. **Dừng giữa chừng**: bấm thoát (mục 2.8) → `POST /attempts/{id}/stop` → kết quả "Dừng giữa chừng" (`PartialSummary`).

### 2.5 Kết quả thi thử — `components/exam/mock/ResultSummary.tsx`

- Tiêu đề là kết luận: "Đỗ phần viết, hơn ngưỡng N điểm" / "Còn thiếu N điểm phần viết".
- Xem lại một Teil khách quan (Lesen, Sprachbausteine, Hören) có nút **"Hỏi AI về câu này"** ở phân tích từng câu (mục 3.6).
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
- **Đủ mọi Teil như đề thật** (owner chốt 13/11/2026; trước đó chỉ Teil 1 mỗi phần), theo thứ tự thi thật — mười
  phần: Lesen 1, 2, 3 → Sprachbausteine 1, 2 → Hören 1, 2, 3 → Schreiben → Sprechen. Khoảng 170 phút
  (`ABOUT_MINUTES` = phần viết 150' như thi thật + thi nói ~20'); mỗi Teil lưu riêng, làm dở được, chia nhiều buổi được
  — lần sau vào thẳng phần đầu tiên chưa xong:

| Phần | Nguồn | Chấm |
|---|---|---|
| Lesen T1–T3, Sprachbausteine T1–T2, Hören T1–T3 | Một đề telc B1 học viên mở được: đề đủ cả chín Teil trước, rồi tới đề ít Teil chẩn đoán đã luyện nhất, bằng nhau thì đề mới nhất | Theo đáp án, qua luyện đề (`check`) |
| Schreiben | Đề Viết thật của đề đó (30') | AI theo phiếu telc B1 (`schreiben`) |
| Sprechen | Một lượt **thi thử phần nói** telc B1 làm sau khi bắt đầu bài chẩn đoán | AI theo rubric telc của phòng thi nói |

  Phòng thi nói chỉ chấm theo phiếu ở chế độ thi thử trọn phần (chế độ luyện từng Teil chỉ nhận xét từng lượt), nên
  phần Nói là thi thử trọn phần. Teil đã luyện trước đó trong đề được chọn tính là đã làm (dùng điểm cũ).
- Danh sách phần do server trả (`teile` của `GET /exam-diagnostic` = `ExamDiagnosticScoring.TEILE`); màn làm bài bỏ
  Teil mà đề đã chọn không có. Tiêu đề ghi "Lesen · Teil 2" với phần thi có nhiều Teil; thanh tiến độ gom năm nhóm
  phần thi, mỗi Teil một vạch (`data-part`, `data-state`).
- Hören luôn như thi thật (không có "Luyện thoải mái"): mỗi Teil một lần Chuẩn bị → Ansage → đọc câu hỏi → nghe; lượt
  nghe theo `max_plays` của đề (Teil 1 một lần, Teil 2 và 3 hai lần). Đề không khai `max_plays` thì bài chẩn đoán bù
  theo đề thật (`withExamPlays`: 1/2/2) thay vì để nghe không giới hạn. Object Teil được memo theo (đề, khoá Teil) —
  dựng lại ở mỗi lần render sẽ làm màn Nghe chạy lại hướng dẫn mỗi khi chọn đáp án.
- **Lượt bắt đầu từ bản ngắn** (đang dở lúc phát hành bản đủ Teil): bài chẩn đoán không lưu "danh sách phần đã làm" —
  phần nào xong là đọc từ tiến độ luyện (`mock_exam_practice_progress`) của đề đã chọn. Vì vậy Teil 1 đã chấm, nháp đang
  viết và lượt thi nói đã có đều được giữ; học viên làm tiếp phần đầu tiên chưa xong theo thứ tự mới (ví dụ đã xong
  Lesen 1 + Sprachbausteine 1 ⇒ vào Lesen 2) và chỉ chốt khi đủ mọi Teil. Đề đã chọn mà thiếu Teil 2/3 thì chỉ làm các
  Teil đề có (bắt buộc bốn Teil lõi `CORE_TEILE`). Bài bản ngắn **đã chốt** giữ nguyên kết quả và lịch ôn; `shortForm =
  true` ⇒ màn kết quả thêm dòng mời làm lại để đo đủ Teil. Không có migration.
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
| PUT | `/mock-exams/practice/{examId}/teile/{key}/draft` | Lưu nháp Teil (+ `notes` tuỳ chọn, B3; thiếu ⇒ giữ ghi chú cũ) | 〃 |
| POST | `/mock-exams/practice/{examId}/teile/{key}/check` | Nộp Teil khách quan ⇒ phân tích từng câu (+ `notes`) | 〃 |
| POST | `/mock-exams/practice/{examId}/teile/{key}/items/{itemId}/ask-ai` `{locale}` | "Hỏi AI về câu này" — Teil đã kiểm tra (chưa ⇒ 409) | 〃 + `ExamItemAiService` |
| POST | `/mock-exams/practice/attempts/{id}/teile/{key}/items/{itemId}/ask-ai` `{locale}` | 〃 cho lượt thi thử đã nộp/dừng (người khác ⇒ 404, đang làm ⇒ 409) | 〃 |
| DELETE | `/mock-exams/practice/{examId}/teile/{key}[?keepMarks=false]` | Làm lại Teil (mặc định giữ đánh dấu bài đọc) | 〃 |
| GET/PUT | `/mock-exams/practice/{examId}/teile/{key}/marks` | Đánh dấu bài đọc của Teil (ghi đè cả gói; sai ⇒ 400) | 〃 + `PassageMarksValidator` |
| POST / GET | `/my-words` `{text, sentence, examId, teilKey, block, start, end, attemptId?}` | "Lưu từ" ở Luyện Teil và xem lại thi thử (13/11/2026; `attemptId` ⇒ server lấy đề từ lượt, lượt người khác ⇒ 404, chưa nộp / đã huỷ ⇒ 409): 1–5 từ bôi đen ⇒ sổ từ riêng + thẻ ôn. Nghĩa: kho `words` (dạng gốc / biến cách / Partizip II) → `vocab_lookup_cache` → AI tầng EXPLAIN (không trừ ví, trần 40 từ cần AI / ngày ⇒ 429; AI lỗi ⇒ 503; chữ sai ⇒ 400). Đã có ⇒ `alreadySaved`. GET = cả sổ | STUDENT, `SavedWordService`, `SavedWordLookupService` |
| DELETE | `/my-words/{id}` | Gỡ khỏi sổ + gỡ thẻ ôn do sổ tạo (thẻ có từ trước thì giữ); người khác ⇒ 404 | 〃 |
| GET | `/my-words/topics[?locale=]` | Bộ chủ đề sẵn của kho `{name, label}` cho ô chuyển chủ đề (đợt 2) | 〃 |
| PUT | `/my-words/{id}/topic` `{topic}` | Chuyển chủ đề (`null` = chưa phân loại; tên ngoài bộ sẵn ⇒ 400; `topic_source = USER`) | 〃 |
| PUT | `/my-words/{id}/meaning` `{meaning}` | Sửa nghĩa 1–200 ký tự; thẻ ôn do sổ tạo đổi theo | 〃 |
| GET/PUT | `/mock-exams/attempts/{attemptId}/teile/{key}/marks` | Đánh dấu bài đọc theo lượt thi thử (đợt 2): lượt `IN_PROGRESS` ⇒ server bỏ `q`/`n`; `COMPLETED`/`PARTIAL` ⇒ xem lại sửa đủ; `CANCELLED` ⇒ 409; lượt người khác ⇒ 404. Riêng với nháp đáp án (không đụng `draft_version`) | chủ lượt, `MockExamAttemptMarksService` |
| POST | `/mock-exams/practice/{examId}/schreiben` | Chấm Viết bằng AI (trả `jobId`) | 〃 |
| GET | `/mock-exams/practice/attempts/{id}/analysis` | Phân tích từng câu của lượt thi thử | 〃 |
| GET | `/mock-exams/practice/mock-teile` | Điểm từng Teil của 30 lượt thi thử gần nhất (`COMPLETED` + `PARTIAL`) cho Bốn kỹ năng | 〃 + `MockAttemptTeilScores` |
| POST | `/mock-exams/{examId}/start` | Bắt đầu / làm tiếp thi thử (idempotent) | `MockExamController` |
| PATCH | `/mock-exams/attempts/{id}/draft` | Lưu nháp thi thử (có phiên bản; `flags` tuỳ chọn = câu đánh dấu, B3; thiếu ⇒ giữ) | 〃 |
| POST | `/mock-exams/attempts/{id}/finish` | Nộp ⇒ job chấm nền | 〃 |
| POST | `/mock-exams/attempts/{id}/stop` | Dừng giữa chừng ⇒ `PARTIAL` (chấm theo Teil) / `CANCELLED` (chưa chạm câu); idempotent | 〃 + `MockExamStopService` |
| GET | `/mock-exams/attempts/me[?includePartial=true]`, `/mock-exams/attempts/{id}/result` | Lịch sử (mặc định không có `PARTIAL` cho mobile), kết quả (`gates`, `budget`; lượt `PARTIAL` không có) | 〃 |
| GET | `/exam-strategies?provider&level&lang` | Chiến thuật từng Teil (LT2) | `ExamStrategyController` |
| GET | `/exam-plan` | Lộ trình đếm ngược; tuần hiện tại có `days` | `ExamPlanController` |
| PUT | `/exam-plan/target-date` | Đặt ngày thi | 〃 |
| PUT | `/exam-plan/days/swap` `{weekNo, from, to}` | Đổi chỗ hai buổi của tuần hiện tại | 〃 |
| GET | `/exam-diagnostic` | Trạng thái bài chẩn đoán (`NONE`/`IN_PROGRESS`/`DONE`) + danh sách Teil theo thứ tự làm + lượt thi nói đã dùng + `shortForm`; chỉ đọc (QLT-21) | `ExamDiagnosticController` |
| POST | `/exam-diagnostic/start` `{targetDate, dailyMinutes}` | Ghi hồ sơ + chọn đề | 〃 |
| POST | `/exam-diagnostic/finish` | Chốt kết quả (đủ mọi Teil chẩn đoán đề có — 9 Teil với đề đủ — + lượt thi nói) | 〃 |
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
  dùng tỉ lệ đạt của bài chẩn đoán** (`ExamDiagnosticScoring.losses`: tỉ lệ của chính Teil đó nếu bài chẩn đoán đã đo,
  không thì tỉ lệ cả phần — ba Teil Nói và kết quả bản ngắn); không có gì thì theo trọng số điểm.
- `ExamPlanDays` (hàm thuần): chia tuần hiện tại thành buổi theo ngày — luyện Teil trọng tâm, thi thử phần viết (150')
  cuối tuần, thi nói, luyện nói, bài lộ trình, nghỉ, ngày thi. Số buổi = phút/tuần ÷ 30, kẹp 3–6, luôn ≥ 1 ngày nghỉ.
  Buổi "đã làm" khi có hoạt động khớp trong tuần (Teil đã kiểm tra, đề đã nộp, phiên Nói…), ghép theo thứ tự ngày.

### 3.3 Bài chẩn đoán

`ExamDiagnosticService` + `ExamDiagnosticScoring` (hàm thuần). Chín Teil (`TEILE`) đọc tiến độ luyện đề của đề đã chọn;
phần Nói đọc `speaking_exam_results` (TELC B1, có điểm, `created_at ≥ started_at`). `finish` ghi `result_json` =
`{ratios, teile, skills, oralSessionId}`:

- Điểm và điểm tối đa từng Teil là của chính đề (điểm từng câu / `point_per_item`, cùng trọng số thi thử dùng ở
  `ExamBudgetService`; Viết 45, Nói 75). Đề telc B1: Lesen 25+25+25, Sprachbausteine 15+15, Hören 25+25+25 — khớp
  `ExamPlanBlueprints`.
- `ratios` (theo phần) và `skills` (bốn kỹ năng, Lesen gồm Sprachbausteine) = tổng điểm ÷ tổng điểm tối đa của mọi Teil
  thuộc phần/kỹ năng đó — không phải trung bình cộng các tỉ lệ Teil.
- `teile` = tỉ lệ từng Teil (`LESEN-2` → 0,4), có từ bản đủ Teil; lộ trình dùng nó để xếp đúng Teil yếu. Kết quả không có
  khoá này là của bài bản ngắn (`View.shortForm`), lộ trình dùng tỉ lệ phần cho mọi Teil cùng phần như trước.
- `GET` không gọi đường luyện đề, không ghi DB.

### 3.4 Chấm điểm

- Teil khách quan: `PracticeAnalysis` (phân tích + giải thích từ `mock_exam_explanations`).
- Viết: `ExamScoringService` + job AI (phiếu telc B1). Kết quả AI là **ước tính**, giao diện luôn ghi rõ.
- Thi thử: `ExamScoringService.summarize` ra các cổng đỗ (`written`, `oral`); điểm Nói lấy từ phòng thi nói
  (`MockExamOralGateService`). `ExamBudgetService` tính điểm mất từng Teil.
- Mọi lần chấm bằng AI trừ quota AI của học viên.

### 3.6 "Hỏi AI về câu này" (B3, 09/11/2026)

`ExamItemAiService` + `ExamItemAiPrompt` (hàm thuần). Chỉ POST (QLT-21: GET không ghi, không gọi AI).

1. Quyền: `MockExamPracticeService.practiceReview` (Teil luyện của chính mình, phải `checked`, không thì 409; Viết 400)
   / `attemptReview` (lượt của chính mình, không thì 404; `IN_PROGRESS` 409; chỉ `COMPLETED`/`PARTIAL`).
2. Ngữ cảnh gửi AI: đoạn văn / Lückentext quanh ô / lời nghe (cắt ~2 400 ký tự quanh dấu hiệu), câu hỏi, lựa chọn
   (Lesen 3 chỉ mẩu đã chọn + mẩu đúng), đáp án đã chọn, đáp án đúng, giải thích sẵn (`PracticeAnalysis`). Ghi chú
   "vì sao tôi chọn" KHÔNG gửi AI.
3. Bộ nhớ đệm `exam_item_ai_explanations` (V374), khoá (đề, Teil, câu, đáp án đã chọn, ngôn ngữ `vi|en|de`,
   SHA-256 của ngữ cảnh). Dùng chung mọi người. Có sẵn ⇒ trả `cached: true`: không gọi AI, không giới hạn lượt, không
   trừ quota. Sửa đề/giải thích ⇒ hash mới ⇒ hỏi lại AI.
4. Chưa có: giới hạn lượt (`AiRateLimiterService` bucket `TEXT`, 429) → `QuotaService.assertAllowed` (ví, 429) →
   `OrgPoolGuard` (pool trung tâm, 429) → AI tầng `EXPLAIN`, văn bản thường, tối đa 900 token → sổ token
   `EXAM_ITEM_EXPLAIN` (`AiUsageLedgerService`, trừ ví/pool theo token thật) → lưu bộ đệm. Trả lời ngắn (≤ 6 câu) theo
   ngôn ngữ giao diện; web nhớ thêm trong trang (`useCachedAsk`).

### 3.5 Dữ liệu và migration

| Migration | Nội dung |
|---|---|
| V357, V358, V361 | `mock_exam_practice_progress`, `mock_exam_explanations`, giải thích đề |
| V349 | `exam_plan_state` |
| **V363** | `exam_plan_state.day_order_json` (JSONB, mặc định `{}`) |
| **V364** | `user_ui_tours (user_id, tour_key, seen_at)` |
| **V365** | `exam_diagnostics (user_id PK, exam_id, result_json, started_at, finished_at)` |
| **V374** | B3: `mock_exam_practice_progress.notes_json` (JSONB `{}`), `mock_exam_attempts.draft_flags_json` (JSONB), bảng `exam_item_ai_explanations` (bộ đệm "Hỏi AI", `UNIQUE (exam_id, teil_key, item_id, chosen, locale, content_hash)`) |
| **V375** | `exam_passage_marks (user_id, exam_id, teil_key, attempt_id NULL = luyện Teil, marks_json, …)` — đánh dấu bài đọc, hai chỉ mục duy nhất một phần |
| **V386** | `user_saved_words` (sổ từ riêng, `UNIQUE (user_id, lemma_key)`, chủ đề, câu gốc, vị trí trong bài, `srs_vocab_id`, `srs_created`, `ai_lookup`) + `vocab_lookup_cache` (nghĩa AI dùng chung, khoá = chữ bôi) — lưu từ từ bài đọc |

V363–V365, V374, V375, V386 chỉ thêm cột/bảng (tương thích ngược khi blue-green). Xoá người dùng ⇒ xoá theo (`ON DELETE CASCADE`).
V374 cần V368–V372 lên trước (`out-of-order: false`).

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
  `ScreenTour`, `DiagnosticPage`, `TelcPracticeViews`, `cnGaFontSize`, `AdPosterLesen3` (+ `adParts`, `adTemplates`).
- Test backend chính: `ExamPlanDaysTest`, `ExamPlanServiceTest`, `ExamPlanGeneratorTest`, `ExamDiagnosticScoringTest`,
  `ExamDiagnosticServiceTest`, `UiTourServiceTest`; Postgres (Testcontainers, chỉ CI/máy có Docker):
  `ExamPlanServiceIntegrationTest`, `ExamDiagnosticServiceIntegrationTest`, `UiTourServiceIntegrationTest`.
  **Đừng thêm `@MockBean` mới vào test Postgres**: mỗi tổ hợp là một Spring context + pool kết nối, CI từng vượt
  `max_connections` ("too many clients"); dựng service bằng tay với bản giả.

---

## 6. Vận hành

- Phát hành: `docs/QUY_TRINH_PHAT_HANH.md`. Thứ tự migration: V363 → V364 → V365 (→ V368–V370 admin → V374 B3 → V375 đánh dấu bài đọc → V386 sổ từ), backend deploy trước frontend.
- Mở cho học viên: trang admin Quyền luyện đề (cờ `ALLOWLIST` thêm người, hoặc `ALL`).
- Mobile **chưa** có giao diện mới; mobile vẫn dùng endpoint cũ — không gỡ endpoint cũ cho tới khi mobile chuyển xong.
  `/exam-plan` chỉ thêm trường mới (`days`), không phá mobile.

| Triệu chứng | Kiểm |
|---|---|
| Học viên báo không vào được Luyện thi | Cờ `practice.telc.access` / allowlist; bộ đề có bị khoá theo gói |
| Lịch tuần trống | Hồ sơ thiếu `exam_type`/`target_level` khác TELC B1 (⇒ `UNAVAILABLE`) hoặc chưa có ngày thi (`NEEDS_DATE`) |
| Viết "đang chờ chấm" mãi | Job AI (`/async-jobs`), quota AI của học viên |
| Bài chẩn đoán không chốt được | Còn Teil chưa chấm (chín Teil với đề đủ; lượt bắt đầu từ bản ngắn phải làm thêm Teil 2/3), hoặc chưa có lượt thi nói telc B1 có điểm **sau** lúc bắt đầu |
| Hướng dẫn tự mở lại | Bảng `user_ui_tours` không ghi được (xem log `PUT /auth/me/tours`) |
