# Kế hoạch hoàn thiện DeutschFlow Mobile

> Lập 2026-07-01. App = Expo React Native (`mobile/`). Đã lên TestFlight, 0 crash, deploy OK.
> Tài liệu này gồm **2 phần**: (1) Chẩn đoán + kế hoạch ưu tiên, (2) Bộ prompt copy-paste vào Claude Code.
> Mọi kết luận dưới đây đã **ground vào code thật** (đường dẫn file kèm theo). Chỗ nào là *quyết định sản phẩm* của PO đều được đánh dấu 🟡.
>
> **⟳ Rev 2026-07-01 — đã fact-check bằng 8 agent đọc code thật và sửa lại.** 3 claim trụ cột bị lật: (1) "màn trống do switch thiếu case" là **phantom** — GRAMMAR/RULE/EXAMPLE/PRONUNCIATION chỉ nằm trong `theory_cards[]`, mobile đã render sẵn; bug spine thật là **thiếu nút hoàn thành cho node lý thuyết** + **auto-pass 100% vô hình**. (2) SRS/Stats **không** tự sống lại khi sửa spine (5 nguồn nuôi). (3) merge + gate xanh **≠ live** (backend deploy `if:false` thủ công; EAS thủ công). Chi tiết sửa nằm ngay trong từng mục dưới, đánh dấu **[Rev]**.

---

# PHẦN 1 — CHẨN ĐOÁN

## 1.0 TL;DR

App **không thiếu màn hình** (30 route student, design system tốt, đủ loading/error/empty ở phần lớn màn). Vấn đề nằm ở **3 chỗ**, không phải "app hỏng":

1. **Lộ trình học bị kẹt ngay cửa** — cơ chế "qua bài" lỗi (không phải thiếu nội dung, cũng **không phải màn trống**). **[Rev]** Bug thật: node toàn lý thuyết (vd alphabet) **không có nút hoàn thành** nên không qua được; node chỉ có câu tự-kiểm thì **tự pass 100% vô hình**. Đây là nguyên nhân "học không thoát ra được".
2. **Tương tác giáo viên gần như chưa lộ trên mobile** — backend giàu tính năng nhưng mobile mới hiển thị 4 thứ read-only. (Ưu tiên #1 của PO.)
3. **Feature phụ thuộc "trống"** — SRS, thống kê, ngữ pháp, thi thử hiện trống với user mới. **[Rev]** Nhưng chúng **KHÔNG** chỉ phụ thuộc spine: SRS/Stats được nuôi bởi 5 nguồn (mark-word-learned, learning-plan session, speaking, XP…), chỉ 1 là node completion. → Sửa spine **không tự** làm chúng đầy; phải test riêng đường vocabulary/session.

Nói (AI real-time) và Lớp học (giáo viên nhập nội dung) chạy được **vì không phụ thuộc curriculum seed**. Đúng như PO quan sát.

---

## 1.1 Vì sao "lộ trình học không thoát ra được"

**Kiến trúc:** lộ trình = skill tree. `roadmap.tsx` → `skillTreeApi.getMySkillTree()` (`/api/skill-tree/me`) → `node.tsx` (màn tổng quan, render lý thuyết) → nút vào `node-practice.tsx` (runner luyện tập) → `submitNode` (`/api/skill-tree/{id}/submit`).

**[Rev] Mô hình dữ liệu 3 ngăn (đã verify):** content mỗi node có `theory_cards[]` (thẻ dạy — read-only), `exercises.theory_gate[]` và `exercises.practice[]` (câu tương tác). **Quan trọng:** `RULE / EXAMPLE / GRAMMAR / PRONUNCIATION` **chỉ nằm trong `theory_cards[]`**, **không bao giờ** nằm trong `exercises.*` (verify toàn bộ content migration: `V74:14,26`, `V126:11,68`…). Ngăn `exercises.*` chỉ chứa `MULTIPLE_CHOICE / FILL_BLANK / TRANSLATE / REORDER`.

### ⚠️ Đính chính lớn: KHÔNG có bug "màn trống do switch"
Bản doc cũ nói mobile render 8 loại exercise ra màn trống. **Sai.** Sự thật:
- `node-practice.tsx:231-249` switch có case cho cả 4 loại thật sự xuất hiện trong `exercises.*` (MC/FILL_BLANK/TRANSLATE/REORDER). `default: return null` là **code chết** — runner không bao giờ nhận RULE/EXAMPLE/GRAMMAR/PRONUNCIATION.
- `theory_cards[]` **đã được mobile render sẵn** ở `node.tsx:107-113` (`TheoryCardView`), empty-state độc lập với số exercise.
- → **Bỏ hẳn** mọi việc kiểu "tách display items", "thêm case switch", "port mini-game GRAMMAR". Không cần.

**Bug spine THẬT gồm 2 ca (đã verify):**

### (A) Node toàn lý thuyết không có đường hoàn thành — đây là "kẹt cửa" alphabet
Node alphabet (`V128__alphabet_full_content.sql`) = **2 `theory_cards` (type GRAMMAR) + 0 exercise** (`exercises: {theory_gate:[], practice:[]}`). Trên mobile: 2 thẻ lý thuyết **render bình thường** (không phải màn trống). Nhưng nút vào luyện tập bị gate `exerciseCount > 0` (`node.tsx:44,137`) → alphabet 0 exercise → **không có nút nào** → `submit` chỉ chạy từ runner → **không có đường complete/cộng XP** → node kẹt mãi. **Đây là nguyên nhân thật của "học không thoát ra được".**

Skill-tree **không có** `markTheoryViewed`/`markSessionCompleted` (backend có hệ tiến độ **thứ hai** `LearningPlanController` với hàm đó, nhưng mobile không dùng). → Bài toàn lý thuyết thiếu nút "Hoàn thành".

### (B) Node chỉ có câu tự-kiểm → tự pass 100% vô hình
Node có exercise nhưng **0 câu chấm được** (chỉ TRANSLATE/REORDER — không thuộc `SCORED={MC,FILL_BLANK}`): vào runner → `scoredCount==0` → `node-practice.tsx:77` gửi `percent=100` mặc định → backend `>=100` → **"hoàn thành" vô hình**, HV không biết mình đã/​chưa qua. (Khác Ca A: ca này có nút vào runner, ca A thì không.)

### Luật "qua bài" quá gắt + mâu thuẫn schema (áp cho cả A/B)
`SkillTreeService.java:579-585` → `submitNodeExercises()`: node thường `completed = scorePercent >= 100` (**sai 1 câu là không qua**); SPEAKING/WRITING cần ≥ 80%.

🟡 **Mâu thuẫn đã verify:** cột `skill_tree_nodes.mastery_threshold INTEGER DEFAULT 70` (`V144:14`) được **load nhưng chỉ trả về client**, hàm submit **bỏ qua**, hardcode 100. → Cần PO chốt ngưỡng qua bài (dùng cột này không).

---

## 1.2 Tương tác giáo viên — backend có, mobile thiếu (ưu tiên #1)

Mobile hiện chỉ có: xem lớp, xem bài tập, **nộp bài text**, xem điểm+nhận xét (read-only). Không có route nào cho chat/lịch/điểm danh (`ls mobile/app/(student)/` xác nhận).

| Tính năng PO muốn | Backend | Web tham chiếu | Mobile | Lực |
|---|---|---|---|---|
| Chat 1:1 với giáo viên | ✅ `/api/messages` (`messaging/MessageController` — "Direct student↔teacher") | ✅ `/v2/student/messages` | ❌ | M |
| Nộp bài ảnh/file/audio | ✅ `GET /v2/students/assignments/presigned-url` → PUT S3 → submit | ✅ | ❌ chỉ text | M |
| Chat **nhóm lớp** | ❌ **chưa có** (backend chỉ 1:1) | ❌ | ❌ | **L — cần backend mới** |
| Lịch buổi học + link online | ⚠️ có `ClassSession` nhưng **chỉ endpoint teacher** (`/api/v2/teacher/class-schedule`) | ? | ❌ | L — cần endpoint student |
| Xem đánh giá/điểm danh/nhận xét | ⚠️ teacher ghi (`StudentEvaluationController`, `ClassAttendance`); **chưa có endpoint student đọc** | ? | ❌ | M–L — cần endpoint student |

**Luồng nộp file (đã verify, backend + web sẵn sàng):**
`GET /v2/students/assignments/presigned-url?assignmentId=&filename=&contentType=` → `{url}` → `PUT` bytes lên S3 → `POST /v2/students/assignments/{id}/submit {submissionContent, submissionFileUrl}`.
Mobile `submitAssignment` **đã** nhận `submissionFileUrl` — chỉ thiếu picker (chưa có `expo-image-picker`/`expo-document-picker` trong deps) + bước upload.

---

## 1.3 Feature phụ thuộc "trống" — **[Rev] KHÔNG chỉ vì spine**

⚠️ **Đính chính:** doc cũ nói các màn này "tự sống lại khi sửa spine". **Sai** — verify cho thấy chúng có nhiều nguồn nuôi độc lập, sửa spine **không đủ**.

- **SRS** (`srs.tsx` → `/srs/due` → `vocab_review_schedule`): bảng này được nuôi bởi **5 đường** (`SrsVocabScheduler` javadoc `:16-17`) — chỉ 1 là node completion; còn lại: Vocabulary "mark as learned" (`/vocabulary/{id}/learn`, `VocabularyController:44`), learning-plan session (`scheduleSessionVocab`), Beginner journey (`BeginnerJourneyService:82`), speaking session. → Nếu SRS trống, gốc nhiều khả năng là **`vocab_review_schedule` chưa được seed** hoặc `markWordLearned` hỏng, **không phải** spine.
- **Thống kê / Tiến độ** (`stats.tsx` → `/student/stats` → `StudentDashboardService`): `wordsLearned` từ `vocab_review_schedule WHERE stability>=21` (`:157`), `speakingMinutes` từ `ai_speaking_sessions` (`:169`), `streakDays` từ `user_xp_events` (`:234`). **Không** gate trên node completion.
- **Ngữ pháp**: syllabus topics (`/grammar/syllabus/topics`) có, nhưng mở topic có thể thiếu bài học chi tiết. Màn thiếu empty-state (QA H14).
- **Thi thử**: chỉ seed mẫu B1 (`V113`) → cấp khác trống.

→ **Phải test riêng** đường vocabulary/session (P7), **đừng** giả định sửa spine (1.1) là xong. Phần còn lại là polish state (Phần QA).

---

## 1.4 Những gì ĐANG ổn — đừng đụng vào

Speaking (AI real-time, persona) · Lớp học phần xem cơ bản · Design system (`components/ui`, `lib/theme`) · Notifications realtime (SSE + push, PR #176) · Skill tree UI/gesture/render · Pipeline EAS/deploy. Xem `mobile/SESSION_HANDOFF.md`, `mobile/VIEC_CAN_LAM.md`.

---

## 1.5 Lưu ý kiến trúc (để không làm sai)

- **Hai hệ tiến độ song song:** skill-tree (`/api/skill-tree`, mobile dùng) vs learning-plan (`/api/.../sessions/{week}/{index}`, mobile KHÔNG dùng). Đừng lẫn khi sửa completion.
- **Chấm điểm server-authoritative:** luôn gửi `item_answers` thô; `score_percent` chỉ là fallback. Đừng tin điểm client.
- **Roles** `OrgMember.role`: OWNER | ADMIN | TEACHER | STUDENT ("Manager" của PO = ADMIN).
- **Chat nhóm ≠ chat 1:1:** `MessageController` chỉ 1:1 (thread `with/{userId}`). Nhóm lớp là domain mới.
- **[Rev] Merge + gate xanh ≠ LIVE (bẫy lớn):** backend auto-deploy bị tắt cứng `if: false` (`.github/workflows/backend-ci.yml:94-100`) — deploy là **thủ công** `./deploy-backend.sh` (blue-green EC2). Mobile **không có EAS trong CI** — TestFlight cần **thủ công** `eas build` + `eas submit` (`mobile/DEPLOYMENT.md:91,100`). → Mọi hạng mục đụng backend (P1/P4/P5/P6): **deploy backend TRƯỚC → rồi mới cut EAS build**, đây là 2 bước riêng, không phải hệ quả của merge.
- Gotchas kỹ thuật bắt buộc nhớ: xem `mobile/VIEC_CAN_LAM.md` §6 (render-loop React 19/Hermes chỉ hiện ở dev build; EAS loại file khớp `.gitignore`; expo-audio recording là hook-only; hợp đồng SSE notification).

---

# PHẦN 2 — KẾ HOẠCH ƯU TIÊN

**Nguyên tắc thứ tự:** sửa **spine** trước (mở khoá việc học) → **tương tác giáo viên** (ưu tiên #1 của PO) → **làm sống feature phụ thuộc** → **polish QA**. Ước lượng theo T-shirt (S<M<L) tính bằng phiên Claude Code, không phải ngày công.

| # | Hạng mục | Phase | Lực | Phụ thuộc | Cần PO chốt |
|---|---|---|---|---|---|
| P1 | Sửa cơ chế hoàn thành lộ trình (spine) | 1 | M | — | 🟡 ngưỡng qua bài; node lý thuyết qua bài kiểu gì |
| P2 | Nộp bài ảnh/file/audio | 2 | M | — | — |
| P3 | Chat 1:1 giáo viên | 2 | M | — | — |
| P4 | Xem đánh giá/điểm danh/nhận xét | 2 | M–L | endpoint student mới | 🟡 lộ dữ liệu nào cho HV |
| P5 | Lịch buổi học + link online | 2 | L | endpoint student mới | 🟡 nguồn link online |
| P6 | Chat nhóm lớp | 2 | L | **backend mới** | 🟡 mô hình nhóm + kiểm duyệt |
| P7 | Làm sống feature phụ thuộc + QA polish | 3–4 | M | P1 | — |

**Phase 0 — PO chốt trước khi code (5 câu, ở Phần 3 mục "Prompt 0").** Vì có 🟡, PO nên trả lời trước để Claude Code không phải dừng giữa chừng.

**Gợi ý lộ trình:** P1 → (P2 ∥ P3) → P4 → P5 → P6 → P7. P2/P3 độc lập, có thể làm song song ở 2 phiên.

---

# PHẦN 3 — BỘ PROMPT CLAUDE CODE

> Cách dùng: mở Claude Code tại repo, dán **Prompt 0** (chốt quyết định) một lần, rồi dán từng prompt P1…P7 theo thứ tự. Mỗi prompt là 1 phiên/1 PR.
> **Guardrail** dưới đây đã nhúng vào mỗi prompt: *verify trước khi sửa, chạy gate xanh, và **cấm đoán** — thiếu thông tin thì DỪNG hỏi PO.*

## Guardrail chung (mặc định mọi prompt)

```
Ràng buộc bắt buộc cho phiên này:
1. KHÔNG đoán. Nếu thiếu thông tin hoặc gặp quyết định sản phẩm chưa rõ → DỪNG, liệt kê câu hỏi cho PO, không tự giả định.
2. Verify trước khi sửa: đọc code thật (đường dẫn nêu trong prompt), xác nhận hành vi hiện tại rồi mới đổi.
3. App mobile ở thư mục `mobile/` (Expo RN), KHÁC app native `ios/`. Backend Spring ở `backend/`.
4. Gate xanh trước khi coi là xong: `cd mobile && npx tsc --noEmit && npm test && npx expo-doctor`. Backend: `cd backend && ./mvnw -q -DskipTests=false test` cho phần đụng tới. **[Rev] Gate xanh ≠ LIVE:** nếu đụng backend, ghi rõ trong báo cáo rằng còn cần **deploy thủ công** (`./deploy-backend.sh`) + **EAS build/submit** thì tính năng mới lên TestFlight — merge không tự deploy.
5. Gotchas: render-loop React 19/Hermes chỉ đỏ ở dev build (test bằng `npx expo run:ios`, tránh redirect imperative ở root layout); EAS loại file khớp `.gitignore` (giữ negation `!mobile/assets/**`); expo-audio recording là hook-only (`useAudioRecorder`); đổi SSE notification phải sửa cả FE+BE test. Chi tiết: `mobile/VIEC_CAN_LAM.md` §6.
6. Bám design system: dùng `components/ui` + `lib/theme` (Screen/Card/ThemedText/Button/Pill/EmptyState/ErrorState…), không hardcode màu hex.
7. Mỗi màn fetch phải có đủ loading / error (ErrorState + retry) / empty — tránh lỗi "silent error = fake empty" (xem `mobile/QA_SCREENS_AUDIT.md`).
```

---

## Prompt 0 — Chốt quyết định sản phẩm (dán 1 lần, TRẢ LỜI, chưa code)

```
Đọc `mobile/KE_HOACH_HOAN_THIEN_MOBILE.md`. Trước khi code, tôi cần chốt 5 quyết định sản phẩm. Với MỖI câu, hãy đọc code liên quan, nêu hiện trạng thực tế, đề xuất phương án + đánh đổi, rồi HỎI tôi chốt. Cấm tự quyết:

1. NGƯỠNG QUA BÀI: hiện `SkillTreeService.submitNodeExercises` hardcode 100% cho node thường, nhưng cột `skill_tree_nodes.mastery_threshold` mặc định 70 (bị bỏ qua). Nên dùng ngưỡng nào? Có dùng cột mastery_threshold theo từng node không? (Câu này và câu 2, 3 là **một mạch logic** — chốt cùng lúc.)
2. NODE TOÀN LÝ THUYẾT (Ca A — vd alphabet = **2 theory_cards + 0 exercise**; mobile đã render thẻ nhưng KHÔNG có nút hoàn thành): cho "qua bài" bằng nút "Đánh dấu đã học" (không cần điểm) hay đòi phải có câu chấm được? Nếu dùng nút — backend cần endpoint markComplete cho node không-exercise; XP tính sao?
3. NODE CHỈ CÓ CÂU TỰ-KIỂM (Ca B — chỉ TRANSLATE/REORDER, `scoredCount==0` → hiện tự pass 100% vô hình): coi hoàn thành thế nào? (đánh dấu đã làm như Ca A / không cho auto-pass, đòi tương tác / vẫn pass nhưng hiển thị rõ). **Lưu ý [Rev]:** GRAMMAR/PRONUNCIATION KHÔNG phải exercise — chúng là `theory_cards`, mobile đã render, **không cần** làm gì thêm; đừng port mini-game.
4. CHAT NHÓM LỚP: mô hình nào — kênh chung mỗi lớp (mọi HV + GV thấy nhau) hay chỉ HV↔(các GV của lớp)? Có cần kiểm duyệt/chặn HV chat với nhau không? (Backend hiện CHƯA có, sẽ phải làm mới.)
5. DỮ LIỆU GV LỘ CHO HV: trong đánh giá/điểm danh/báo cáo, HV được xem những gì (điểm danh của chính mình, nhận xét, bảng điểm, skill-report)? Có gì KHÔNG được lộ?

Không sửa code trong phiên này. Chỉ trả lời + hỏi.
```

---

## Prompt P1 — Sửa cơ chế hoàn thành lộ trình (spine) 🎯 làm trước

```
[Dán Guardrail chung]

MỤC TIÊU: học viên có thể HỌC và QUA được các bài trên lộ trình (skill tree), kể cả bài đầu (alphabet). Hiện đang kẹt.

⚠️ ĐÍNH CHÍNH so với bản plan cũ (ĐÃ VERIFY code — đừng làm lại việc phantom):
- KHÔNG có bug "màn trống do switch thiếu case". `node-practice.tsx:231-249` switch có đủ case cho cả 4 loại thật sự xuất hiện trong `exercises.*` (MC/FILL_BLANK/TRANSLATE/REORDER); `default:return null` là code chết.
- RULE/EXAMPLE/GRAMMAR/PRONUNCIATION **chỉ nằm trong `theory_cards[]`, KHÔNG nằm trong `exercises.*`** (verify `V74:14,26`, `V126:11,68`). `theory_cards` **mobile đã render sẵn** (`node.tsx:107-113` `TheoryCardView`). → TUYỆT ĐỐI không "tách display items", "thêm case switch", "port mini-game". Không cần.

BỐI CẢNH THẬT (đọc lại để xác nhận):
- Luồng: `mobile/app/(student)/roadmap.tsx` → `node.tsx` (render lý thuyết + nút vào luyện tập) → `node-practice.tsx` (runner + submit). Backend `SkillTreeService.java` (`getNodeSession`, `submitNodeExercises:579-585`).
- **Ca A** — node toàn lý thuyết (vd alphabet `V128` = 2 theory_cards + 0 exercise): thẻ render OK, nhưng nút luyện tập gate `exerciseCount>0` (`node.tsx:44,137`) → không có nút → `submit` không chạy → **không có đường complete/XP → kẹt**.
- **Ca B** — node chỉ có câu tự-kiểm (TRANSLATE/REORDER): `scoredCount==0` → `node-practice.tsx:77` gửi `percent=100` → backend `>=100` → **tự pass vô hình**.
- Ngưỡng: `submitNodeExercises` hardcode `>=100` (thường)/`>=80` (Speaking/Writing), **bỏ qua** cột `mastery_threshold` (`V144:14`, default 70, chỉ trả về client).

VIỆC CẦN LÀM (theo quyết định PO ở Prompt 0 câu 1-3 — nếu chưa có, DỪNG hỏi):
1. **Ca A:** thêm nút "Đánh dấu đã học" trên `node.tsx` cho node không có exercise (hoặc node có theory_cards); backend thêm đường markComplete (không cần điểm) — cộng XP theo PO. Cập nhật test.
2. **Ca B:** xử lý `scoredCount==0` theo PO (không auto-pass vô hình) ở `node-practice.tsx` + backend. Đừng để "pass mà HV không biết".
3. **Ngưỡng:** sửa `submitNodeExercises` theo PO (vd dùng `mastery_threshold` thay hardcode 100) — cập nhật cả `NodeExerciseGraderTest`, `PracticeNodeServiceXpWiringTest`.
4. **AUDIT:** viết truy vấn liệt kê node nào có 0 câu chấm được (0 MC/FILL_BLANK trong `exercises.*`) và node nào toàn theory_cards → PO biết bài nào cần bổ sung nội dung. In danh sách, KHÔNG tự sửa nội dung.

TIÊU CHÍ HOÀN THÀNH:
- Mở alphabet: thấy 2 thẻ lý thuyết + **có nút "Đánh dấu đã học"** → bấm → node COMPLETED, mở khoá node kế.
- Làm 1 node có MC/FILL_BLANK đạt ngưỡng PO chốt → COMPLETED + XP + unlock. 1 node chỉ TRANSLATE/REORDER → KHÔNG còn tự pass vô hình.
- **Device/simulator verify thật** (screenshot flow alphabet), không chỉ unit xanh. tsc/jest/expo-doctor xanh; backend test phần đụng tới xanh.
- **[Rev] Nhắc:** merge xong CẦN `./deploy-backend.sh` + EAS build mới live (xem Guardrail 4).
- Báo cáo: danh sách node thiếu câu chấm được + node toàn theory.
```

---

## Prompt P2 — Nộp bài bằng ảnh/file/audio

```
[Dán Guardrail chung]

MỤC TIÊU: học viên nộp bài tập lớp bằng ẢNH (chụp bài viết tay), FILE (PDF/Word), hoặc GHI ÂM — không chỉ text như hiện tại.

BỐI CẢNH (đã verify — backend + web sẵn sàng, chỉ port mobile):
- Luồng backend (student): `GET /v2/students/assignments/presigned-url?assignmentId=&filename=&contentType=` → nhận `{url}` → `PUT` bytes lên S3 URL đó → `POST /v2/students/assignments/{id}/submit {submissionContent, submissionFileUrl}`. Endpoint: `backend/.../user/controller/StudentAssignmentController.java` (getPresignedUrl ~dòng 77).
- Web tham chiếu: `frontend/src/app/student/assignments/[id]/client-page.tsx` (uploadToS3, ~dòng 73–86).
- Mobile: `mobile/lib/studentClassesApi.ts` (`submitAssignment` ĐÃ nhận `submissionFileUrl`), màn `mobile/app/(student)/assignments/[id].tsx` (hiện ghi chú "Đính kèm file... hỗ trợ trên web"). Deps mobile CHƯA có picker.

VIỆC CẦN LÀM:
1. Thêm dependency picker phù hợp Expo SDK 54 (vd `expo-image-picker`, `expo-document-picker`; audio dùng `expo-audio` hook-only đã có). Kiểm tra tương thích trước khi thêm; nếu nghi ngờ version → DỪNG hỏi.
2. Thêm hàm `uploadAssignmentFile()` trong `studentClassesApi.ts`: xin presigned-url → PUT (dùng `expo-file-system`) → trả `submissionFileUrl`.
3. UI trong `assignments/[id].tsx`: nút chọn Ảnh / File / Ghi âm; hiển thị tiến trình upload; preview; cho xoá/chọn lại; rồi submit kèm URL. Giữ nhánh text hiện có.
4. Xử lý lỗi rõ ràng (upload fail, file quá lớn, mất mạng) + trạng thái loading. Tôn trọng a11y + safe-area (xem QA H25 keyboard).
5. Quyền iOS: thêm mô tả Info.plist (camera/photo/mic) qua `app.json` nếu picker cần.

TIÊU CHÍ HOÀN THÀNH:
- Nộp được 1 ảnh + 1 PDF + 1 ghi âm cho 1 bài tập; GV xem lại được file (mở `submissionFileUrl`).
- Không phá luồng nộp text cũ. tsc/jest/expo-doctor xanh. Kiểm thử trên device thật (upload thật) — nêu rõ nếu chỉ test được simulator.
```

---

## Prompt P3 — Chat 1:1 với giáo viên

```
[Dán Guardrail chung]

MỤC TIÊU: học viên nhắn tin trực tiếp với giáo viên của lớp trên mobile.

BỐI CẢNH (đã verify — backend + web sẵn sàng, port mobile):
- Backend `/api/messages` (`backend/.../messaging/controller/MessageController.java`): `GET /conversations`, `GET /unread-count`, `GET /with/{userId}` (đọc thread + đánh dấu đã đọc), `POST /` (gửi; người nhận phải chung lớp), `POST /with/{userId}/read`. Thread giới hạn teacher↔student chung lớp.
- Web tham chiếu: `frontend/src/app/v2/messagesShared.tsx`, `frontend/src/app/v2/student/messages/page.tsx`.
- Mobile: chưa có route chat. Có sẵn hạ tầng notifications (`mobile/lib/notificationsApi.ts`, `hooks/usePushNotifications.ts`) để gắn badge/điều hướng.

VIỆC CẦN LÀM:
1. `mobile/lib/messagesApi.ts`: typed client cho 5 endpoint trên. Verify shape trả về bằng cách đọc DTO backend (`ConversationDto`, `MessageDto`) — không tự bịa field.
2. Route mobile: `app/(student)/messages/index.tsx` (danh sách hội thoại) + `app/(student)/messages/[userId].tsx` (thread + ô soạn). Dùng react-query; poll unread hoặc tái dùng focus-refetch.
3. Điểm vào: từ tab lớp `classes/[id].tsx` (tab "Giáo viên" → nút "Nhắn tin"), và badge unread ở Home nếu hợp lý.
4. Đủ loading/error/empty; KeyboardAvoidingView cho ô soạn; safe-area; a11y cho nút gửi.
5. (Tùy) tích hợp push: khi có tin nhắn mới, tap notification mở đúng thread — chỉ làm nếu backend đã phát loại notification này; nếu chưa, DỪNG hỏi, đừng tự thêm loại notification.

TIÊU CHÍ HOÀN THÀNH:
- HV mở được danh sách hội thoại, mở thread với GV, gửi + nhận, unread giảm khi đọc.
- tsc/jest/expo-doctor xanh. Không đổi hợp đồng SSE/notification hiện có.
```

---

## Prompt P4 — Xem đánh giá / điểm danh / nhận xét của giáo viên

```
[Dán Guardrail chung]

MỤC TIÊU: học viên xem trên mobile: điểm danh của mình, nhận xét/đánh giá của GV, bảng điểm, và (nếu PO đồng ý) báo cáo kỹ năng.

BỐI CẢNH (đã verify — CẦN endpoint student mới):
- Teacher đã ghi: `backend/.../teacher/controller/StudentEvaluationController.java`, `GradingController` (gradebook, evaluate), `ClassAttendance` (điểm danh HV PRESENT/ABSENT/LATE), skill-report. NHƯNG các endpoint này là teacher-scoped.
- Student hiện chỉ có: `StudentClassroomController` (list/detail/assignments/lessons). KHÔNG có endpoint đọc evaluation/attendance/report.

VIỆC CẦN LÀM:
1. TRƯỚC TIÊN: xác nhận với PO (Prompt 0 câu 5) HV được lộ dữ liệu gì. Nếu chưa rõ → DỪNG.
2. Backend: thêm endpoint student-facing READ-ONLY, chỉ trả dữ liệu CỦA CHÍNH HV đó (bảo mật: kiểm tra userId == principal, thuộc lớp):
   - `GET /v2/students/classes/{classId}/my-attendance`
   - `GET /v2/students/classes/{classId}/my-evaluation`
   - (tùy PO) `GET /v2/students/classes/{classId}/my-report`
   Tái dùng service/entity teacher sẵn có; viết unit test cho phân quyền (HV A không xem được của HV B).
3. Mobile: thêm tab/màn trong `classes/[id].tsx` (vd tab "Nhận xét" / "Điểm danh") hiển thị dữ liệu; đủ loading/error/empty.
4. Typed client trong `studentClassesApi.ts`, shape khớp DTO backend thật.

TIÊU CHÍ HOÀN THÀNH:
- HV xem được điểm danh + nhận xét của chính mình; KHÔNG xem được của HV khác (có test chứng minh).
- Backend test + mobile tsc/jest xanh.
```

---

## Prompt P5 — Lịch buổi học + link học online

```
[Dán Guardrail chung]

MỤC TIÊU: học viên xem lịch các buổi học của lớp (thời gian, ONLINE/OFFLINE, phòng, link online) trên mobile.

BỐI CẢNH (đã verify — CẦN endpoint student mới):
- Backend đã có model buổi học: `ClassSchedulePattern` + `ClassSession` (`backend/.../teacher/entity/`; `ClassSession` có `startAt`, `durationMinutes`, `mode` ONLINE/OFFLINE, `room`, `status` SCHEDULED/CANCELLED/MOVED). Controller hiện teacher-scoped: `/api/v2/teacher/class-schedule` (`ClassScheduleController`).
- Student: chưa có endpoint xem session/schedule.
- Xem thêm spec: `docs/SPEC_TEACHER_SCHEDULE_V2.md` nếu có.

VIỆC CẦN LÀM:
1. Xác nhận PO (Prompt 0 câu — nguồn LINK ONLINE): link buổi online lấy từ đâu (field nào trên ClassSession? do GV nhập?). Nếu model CHƯA có field link → DỪNG hỏi PO có muốn thêm không; đừng tự thêm field bừa.
2. Backend: `GET /v2/students/classes/{classId}/sessions?from=&to=` (chỉ lớp HV thuộc), trả các buổi sắp tới + trạng thái. Test phân quyền.
3. Mobile: màn/tab lịch trong `classes/[id].tsx` hoặc route `app/(student)/classes/[id]/schedule.tsx`: danh sách buổi theo ngày, nhãn ONLINE/OFFLINE, phòng/giờ, nút "Vào học" (mở link online — mở qua trình duyệt an toàn, verify URL). Đủ empty/error.
4. (Tùy) nhắc lịch: chỉ nếu PO muốn — dùng expo-notifications local; nếu không chắc, DỪNG hỏi.

TIÊU CHÍ HOÀN THÀNH:
- HV thấy đúng lịch buổi của lớp mình, phân biệt online/offline, mở được link online (nếu có).
- Backend + mobile test xanh; không lộ lịch lớp khác.
```

---

## Prompt P6 — Chat nhóm lớp (cần backend mới)

```
[Dán Guardrail chung]

MỤC TIÊU: kênh chat chung theo lớp (nhiều HV + GV). Backend HIỆN CHƯA CÓ — chỉ có chat 1:1.

BƯỚC BẮT BUỘC ĐẦU TIÊN: xác nhận mô hình với PO (Prompt 0 câu 4) — kênh chung cả lớp vs chỉ HV↔GV; quyền kiểm duyệt; HV có được chat với nhau không. NẾU CHƯA RÕ → DỪNG, không thiết kế bừa.

BỐI CẢNH:
- Chat 1:1 hiện có: `backend/.../messaging/` (`MessageController`, entity/DTO message). Nên MỞ RỘNG domain này cho nhóm, đừng tạo hệ song song trùng lặp.
- Cân nhắc tái dùng hạ tầng realtime SSE của notifications (`NotificationSseBroadcaster`) cho cập nhật tức thì — nhưng ĐỪNG phá hợp đồng SSE hiện có (đổi event phải sửa cả FE + 2 test, xem VIEC_CAN_LAM §6).

VIỆC CẦN LÀM (sau khi PO chốt mô hình):
1. Backend: model kênh lớp (vd `ClassChannel` + `ClassMessage` gắn `classId`), endpoint gửi/đọc/đánh dấu đã đọc, phân quyền theo thành viên lớp. Migration Flyway version kế tiếp. Unit test phân quyền + smoke.
2. (Tùy chọn realtime) phát sự kiện tin nhắn nhóm; nếu dùng SSE, thêm loại event MỚI, không sửa loại cũ.
3. Mobile: route `app/(student)/classes/[id]/chat.tsx` (danh sách tin nhóm + soạn), điểm vào từ tab lớp. Đủ loading/error/empty, keyboard, a11y.
4. Typed client mới, shape khớp DTO thật.

TIÊU CHÍ HOÀN THÀNH:
- Trong 1 lớp, HV gửi tin → HV/GV khác trong lớp thấy; ngoài lớp không thấy (có test).
- Backend + mobile test xanh; SSE cũ không đổi hành vi.
```

---

## Prompt P7 — Làm sống feature phụ thuộc + polish QA

```
[Dán Guardrail chung]

MỤC TIÊU: sau khi spine (P1) chạy, đảm bảo SRS / Thống kê / Ngữ pháp / Từ vựng / Thi thử dùng được mượt; và dọn cụm lỗi HIGH.

BỐI CẢNH:
- Các màn: `mobile/app/(student)/srs.tsx, stats.tsx, grammar.tsx, vocabulary.tsx, exam*.tsx`. API tương ứng trong `mobile/lib/`.
- **[Rev] SRS/Stats KHÔNG chỉ phụ thuộc spine:** `vocab_review_schedule` nuôi bởi 5 đường (node completion **chỉ 1**; còn Vocabulary "mark as learned" `/vocabulary/{id}/learn`, learning-plan session, Beginner journey, speaking). Stats từ `vocab_review_schedule` + `ai_speaking_sessions` + `user_xp_events`. → Nếu trống, gốc nhiều khả năng là chưa có hoạt động seed SRS, **không phải** spine.
- Cụm lỗi HIGH đã liệt kê ở `mobile/QA_SCREENS_AUDIT.md` (25 HIGH): thiếu error-state (home 4 query, srs, weekly-speaking, learn, grammar empty), keyboard (node-practice, assignments, settings), a11y (nhiều Pressable), bug badge unread không invalidate, mất dữ liệu khi back giữa exam-attempt.

VIỆC CẦN LÀM:
1. Kiểm chứng end-to-end **từng đường độc lập**: (a) vào Vocabulary → "mark as learned" 1 từ → thẻ xuất hiện ở `/srs/due`; (b) hoàn thành 1 learning-plan session → thẻ SRS sinh ra; (c) học 1 node có từ vựng → thẻ sinh. Xác định đường nào KHÔNG sinh thẻ (đó mới là bug thật). Đồng thời stats tăng số thật. Sửa chỗ nào còn "silent error = fake empty". **Đừng** giả định "sửa spine là SRS tự đầy".
2. Xử lý cụm HIGH theo QA_SCREENS_AUDIT.md, ưu tiên: (a) thêm ErrorState+retry cho các màn còn thiếu; (b) KeyboardAvoidingView cho màn nhập liệu; (c) bug badge unread (H17); (d) chặn mất dữ liệu khi back giữa exam-attempt (H10). a11y có thể gom vào component dùng chung (IconButton/SelectableRow) như QA gợi ý.
3. Ngữ pháp: thêm empty-state cho danh sách bài (H14); kiểm tra mở topic có nội dung không, nếu trống thì báo cáo (đừng tự tạo nội dung).

TIÊU CHÍ HOÀN THÀNH:
- Không màn học nào hiển thị sai "trống" khi thực ra lỗi tải.
- Danh sách HIGH đã xử lý (ghi rõ mục nào làm, mục nào để lại + lý do).
- tsc/jest/expo-doctor xanh.
```

---

## Phụ lục — Tài liệu tham chiếu trong repo
`mobile/QA_SCREENS_AUDIT.md` (audit 24 màn) · `mobile/VIEC_CAN_LAM.md` (việc còn lại + gotchas §6) · `mobile/SESSION_HANDOFF.md` · `mobile/SKILL_TREE.md` · `backend/.../curriculum/service/SkillTreeService.java` · `backend/.../messaging/` · `docs/SPEC_TEACHER_SCHEDULE_V2.md` (nếu có).
