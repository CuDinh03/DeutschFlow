# Teacher role — Design ↔ Production parity: QA, phương án & bộ prompt

> **Mục đích:** đóng khoảng cách giữa **design (Prototype A · Galerie)** và **production `/v2/teacher`** mà bạn thấy ở 2 ảnh chụp (navbar khác nhau). Tài liệu tự chứa: phân tích → phương án theo phase → **bộ prompt copy-paste** để bạn (hoặc agent) thực thi.
> **Verify ngày:** 2026-06-22, từ `git`/code/docs thật. Nguồn đối chiếu: `docs/UI_2.0_HANDOFF.md`, `docs/UI_2.0_SCREEN_CHECKLIST.md`, `docs/PRODUCT_STATE_AND_PLAN_2026-06-22.md`, `docs/QA_TEACHER_*`, các nhánh git (#146/#147 + nhánh chứa quiz), và ảnh chụp design bạn gửi.
> **Trọng tâm:** vai trò **Giáo viên** (theo yêu cầu "ưu tiên hoàn chỉnh toàn bộ màn teacher").

---

## 0. TL;DR

Cảm giác "production thiếu nhiều so với design" đến từ **3 lớp khác biệt riêng biệt**, không phải 1:

1. **Lệch deploy (lớn nhất, gần như free):** prod đang chạy `main` (`c7e72571`). Hàng loạt cải tiến nav giáo viên + **màn Tin nhắn** đã **build xong, CI xanh, chỉ đang chờ deploy** trong 2 PR mergeable:
   - **#146** (`feat/student-teacher-messaging`) — **đã có** màn `/v2/teacher/messages` + mục nav "Tin nhắn" + backend chat (V228).
   - **#147** (`feat/b2b-provisioning` = nhánh hiện tại) — đã gộp QA-teacher fix (FIX-1/2/3), gom "Chấm ảnh viết tay" về nhóm grading, thêm "Hồ sơ", role `ADMIN→MANAGER` (V229/V230).
   → Chỉ cần **deploy đúng thứ tự** là đóng được ~50% khoảng cách bạn thấy.

2. **Lệch IA/nhãn so với design (FE thuần, build ngay được, không cần backend):** design gom nhóm **QUẢN LÝ LỚP / GIẢNG DẠY / CÔNG CỤ AI / THỐNG KÊ** và đổi nhãn ("Trung tâm Chấm bài", "Tiến độ khóa học", "Báo cáo & Phân tích"…). Code hiện tại dùng nhóm/nhãn khác. Đây là **1 file `nav.ts`** + vài chỉnh top bar.

3. **1 tính năng design có mà code chưa có màn v2 — nhưng KHÔNG phải từ số 0:**
   - **Lịch dạy** (availability): cột `teacher_profiles.available_slots_json` **đã tồn tại**, chỉ thiếu endpoint + màn v2.

   > **Quiz & Kiểm tra — QUYẾT ĐỊNH 2026-06-22: KHÔNG hồi sinh.** Backend cũ từng tồn tại nhưng đã bị gỡ khỏi `main` có chủ đích (`V203__drop_legacy_quiz_tables`). Bỏ mục này khỏi nav target — sidebar sẽ **không** có "Quiz & Kiểm tra".

**Tiện ích DEMO trong design:** thanh "CHUYỂN VAI TRÒ XEM THỬ" là đồ chơi của prototype → **bỏ ở prod** (đúng lựa chọn của bạn). Nút **VI/EN/DE giữ lại** — hạ tầng i18n (`next-intl` + `messages/{vi,en,de}.json`) **đã có sẵn**, chỉ thiếu UI toggle + phủ chuỗi.

> **Kết luận:** việc thật sự cần "code mới" chỉ còn **Lịch dạy** + **toggle ngôn ngữ**. Phần còn lại là **deploy + sửa `nav.ts`/top bar**. (Quiz đã chốt không làm.)

---

## 1. Bối cảnh prod đã verify (đọc kỹ — quyết định thứ tự)

| Sự thật | Giá trị | Vì sao quan trọng |
|---|---|---|
| Prod = `main` | `c7e72571` (#143 B2B core + #144) | nav giáo viên trên prod là bản **trước** FIX-3 / messaging |
| Web v2 "Galerie" | **LIVE 100% mọi user** (hardcode, không cờ) | sửa `/v2/teacher` là sửa thẳng prod khi deploy |
| Migration trên main | tới **V227** | bản vá mới phải đánh số **≥ V231** |
| #146 messaging | **V228**, mergeable | có màn teacher messages + nav "Tin nhắn" |
| #147 provisioning | **V229 + V230**, mergeable, = nhánh đang đứng | có FIX teacher nav + role change |
| Ràng buộc Flyway | `out-of-order=false` | **#146 (V228) PHẢI deploy TRƯỚC #147 (V229/V230)**, sai = Flyway fail |
| ⚠️ Xung đột | **cả #146 và #147 đều sửa `frontend/src/components/ui-v2/nav.ts`** | merge cả hai sẽ **conflict ở nav.ts** — xử lý ở PROMPT 1 |
| Deploy backend | `./deploy-backend.sh` (cần SSH whitelist IP) | cổng 👤 thủ công; web tự lên qua Amplify khi merge main |

---

## 2. Đối chiếu Sidebar — design ↔ các trạng thái code

Cột **DESIGN** = ảnh bạn gửi (Prototype A). **MAIN/PROD** = đang chạy. **#147** = sau khi deploy nhánh hiện tại. **TARGET** = đích cần đạt để khớp design.

| # | DESIGN (nhóm → mục) | MAIN/PROD hiện tại | Sau #146+#147 | TARGET (đích) | Việc cần làm |
|---|---|---|---|---|---|
| | **QUẢN LÝ LỚP** | nhóm "Quản lý" | "Quản lý" | đổi tên nhóm → **"Quản lý lớp"** | nav.ts |
| 1 | Dashboard & Lớp học | Tổng quan & Lớp | Tổng quan & Lớp | **Dashboard & Lớp học** (đổi nhãn — tuỳ) | nav.ts |
| 2 | **Lịch dạy** | ❌ không có | ❌ | ✅ **mục mới** `/v2/teacher/schedule` | **BE + FE mới** (PROMPT 4) |
| 3 | Tiến độ khóa học | Tiến độ lớp | Tiến độ lớp | **Tiến độ khóa học** | nav.ts (relabel) |
| 4 | Checklist khóa học | Checklist bài giảng | Checklist bài giảng | **Checklist khóa học** | nav.ts (relabel) |
| 5 | Trung tâm Chấm bài | Chấm bài | Chấm bài | **Trung tâm Chấm bài** | nav.ts (relabel) |
| 6 | Chấm bài qua ảnh | "Chấm ảnh viết tay" (ở **Tài khoản**) | đã chuyển sang Quản lý (FIX-3) | **Chấm bài qua ảnh**, trong Quản lý lớp | nav.ts (relabel + đã đúng nhóm sau #147) |
| 7 | ~~Quiz & Kiểm tra~~ | ❌ (đã drop V203) | ❌ | ❌ **KHÔNG đưa vào** (chốt 2026-06-22) | — (bỏ qua) |
| | **GIẢNG DẠY** | (không có nhóm này) | — | thêm nhóm **"Giảng dạy"** | nav.ts |
| 8 | Buổi học 1:1 | "Buổi 1:1" (trong Quản lý) | Buổi 1:1 | **Buổi học 1:1** → chuyển vào Giảng dạy | nav.ts |
| 9 | **Tin nhắn học viên** | ❌ | ✅ "Tin nhắn" (#146, ở nhóm "Thông báo") | **Tin nhắn học viên** → chuyển vào Giảng dạy | **chỉ deploy #146** + relabel/regroup |
| | **CÔNG CỤ AI** | "Công cụ AI" | "Công cụ AI" | giữ | — |
| 10 | Ngữ pháp AI | Ngữ pháp AI | ✅ | giữ | — |
| 11 | Tạo Tài liệu AI | Tài liệu AI | Tài liệu AI | **Tạo Tài liệu AI** (relabel — tuỳ) | nav.ts |
| 12 | Tạo ảnh AI | Tạo ảnh AI | ✅ | giữ | — |
| | **THỐNG KÊ** | "Thống kê" | "Thống kê" | giữ | — |
| 13 | Báo cáo & Phân tích | Phân tích | Phân tích | **Báo cáo & Phân tích** | nav.ts (relabel) |
| | (footer user) | có | có | giữ — **không** thêm role-switcher | — |

> **Lưu ý nhãn:** đổi nhãn ("Dashboard & Lớp học", "Tạo Tài liệu AI"…) là tuỳ chọn thẩm mỹ — khớp design 1:1 thì đổi hết; nếu muốn giữ tiếng Việt thuần có thể giữ vài nhãn cũ. Các đổi **bắt buộc để khớp cấu trúc**: thêm nhóm "Giảng dạy", thêm "Lịch dạy", chuyển "Tin nhắn" + "Buổi học 1:1" vào Giảng dạy. **"Quiz & Kiểm tra" chốt không đưa vào** — sidebar sẽ thiếu đúng 1 mục so với design, chấp nhận.

---

## 3. Đối chiếu Top bar

| Thành phần design | Code hiện tại (`GaTopBar.tsx`) | Việc cần làm |
|---|---|---|
| Ô tìm kiếm "Tìm bài học, từ vựng, lớp…" | ✅ có (decor, chưa backend search) | giữ |
| Pill **"2 bài chờ chấm"** (số thật) | ❌ — đang là chip tĩnh "Khu vực giáo viên" | **PROMPT 2** — đếm thật từ `/v2/teacher/grading/queue` hoặc `/dashboard/summary.pendingReview` |
| Chuông + **badge số (3)** | ✅ chuông, ❌ badge số | **PROMPT 2** — badge từ `notificationApi` (unread count) |
| Nút "?" trợ giúp | ✅ | giữ |
| Toggle **VI/EN/DE** | ❌ | **PROMPT 3** — wire `next-intl` (đã cài) + lưu `locale` |
| "CHUYỂN VAI TRÒ XEM THỬ" (demo) | ❌ | **bỏ** (đúng ý bạn) |

---

## 4. Backlog backend — chính xác cái gì cần build

Sau khi soi git, "thiếu backend" thu hẹp lại còn **đúng 1 hạng mục** (messaging đã xong, quiz đã chốt bỏ):

| Tính năng | Trạng thái thật | Hành động |
|---|---|---|
| **Tin nhắn học viên** | ✅ **Đã build** (#146): `MessageController/Service`, `Message`, `V228__messages.sql`, `messagesApi.ts`, `messagesShared.tsx`, màn teacher+student. CI xanh. | **Chỉ deploy** (PROMPT 0) |
| **Lịch dạy (availability)** | ⚠️ cột `teacher_profiles.available_slots_json` có sẵn; **không có endpoint** | **Build mới**: endpoint GET/PUT availability + màn v2 (PROMPT 4) |
| ~~Quiz & Kiểm tra~~ | đã drop khỏi main (`V203`) | **KHÔNG làm** — chốt 2026-06-22 |
| Rubric chấm theo tiêu chí (Phát âm/Ngữ pháp/Nội dung) + AI-confidence % | `/evaluate` chỉ nhận 1 điểm 0–100 (Option-1) | **Tuỳ chọn** — ngoài phạm vi parity nav; xem PROMPT 6 (optional) |

---

## 5. Phương án theo phase

Ký hiệu: 🤖 agent/bạn code được · 👤 cần bạn mở cổng (SSH/duyệt merge).

### P0 — Deploy cái đã có (đóng ~50% khoảng cách, gần như free)
- 👤 Whitelist IP + duyệt merge **#146** → 🤖 `./deploy-backend.sh` (áp **V228**) → smoke chat 1-1.
- 👤 Duyệt merge **#147** → 🤖 deploy (áp **V229→V230**, **sau** V228) → smoke 4 vai.
- Kết quả: prod có **Tin nhắn**, grade-image đúng nhóm, Hồ sơ, role fix.
- **→ PROMPT 0.**

### P1 — Khớp IA/nav + top bar với design (FE thuần, không cần backend)
- 🤖 Viết lại `teacherNav` trong `nav.ts` theo TARGET ở §2 (xử lý conflict #146↔#147).
- 🤖 Top bar: pill "X bài chờ chấm" + badge chuông.
- 🤖 Toggle VI/EN/DE.
- **→ PROMPT 1, 2, 3.** (Có thể làm song song P0; gộp vào cùng đợt deploy web qua Amplify.)

### P2 — Build màn còn thiếu
- 🤖 **Lịch dạy**: endpoint availability + màn `/v2/teacher/schedule` (migration mới nếu cần bảng riêng, hoặc dùng cột JSON sẵn có). **→ PROMPT 4.**
- ~~Quiz & Kiểm tra~~ — **chốt KHÔNG làm** (2026-06-22).

### P3 — Tuỳ chọn nâng cấp nội dung màn (Option-1 gaps)
- Rubric chấm đa tiêu chí, AI-confidence, student-report "Chi tiết"… **→ PROMPT 6 (optional).**

---

## 6. BỘ PROMPT (copy-paste để thực thi)

> Mỗi prompt tự chứa. Quy tắc chung của dự án (lặp lại trong từng prompt): **tái dùng plumbing có sẵn, không bịa số; chỉ sửa trong `frontend/src/app/v2/**`, `components/ui-v2/**`, `styles/galerie.css`, backend module tương ứng; cổng verify = `tsc --noEmit` + `eslint` + `next build` exit 0 (+ test BE); QA đối chiếu proto thật, không đối chiếu bản handoff cũ.**

---

### PROMPT 0 — Deploy hàng đợi B2B (#146 → #147) đúng thứ tự

```
Bối cảnh: prod = main (V227). Hai PR mergeable đang chờ deploy, có ràng buộc Flyway out-of-order=false.
Thứ tự BẮT BUỘC: #146 (V228) trước, rồi #147 (V229→V230).

Việc:
1. Merge PR #146 (feat/student-teacher-messaging) vào main. Web Amplify tự deploy.
2. Chạy ./deploy-backend.sh để áp V228 (bảng messages). Lưu ý: script có thể exit 1 ở bước
   cleanup-prompt DÙ deploy THÀNH CÔNG — đọc log, đừng tin exit code. Verify:
   curl -sf https://api.mydeutschflow.com/actuator/health  → UP
3. Smoke: 1 cặp teacher↔student CÙNG LỚP nhắn được cho nhau (/v2/teacher/messages, /v2/student/messages).
4. Merge PR #147 (feat/b2b-provisioning) vào main → deploy (áp V229 rồi V230, SAU V228).
   ⚠️ #146 và #147 đều sửa frontend/src/components/ui-v2/nav.ts → giải conflict khi merge #147:
   GIỮ mục "Tin nhắn" từ #146 VÀ thay đổi nav teacher của #147. (PROMPT 1 sẽ chuẩn hoá nav cuối cùng.)
5. Smoke 4 vai (admin/owner/manager/teacher/student) theo docs/QA_TEACHER_PROD_CHECKLIST.md §1.

Không sửa code tính năng trong prompt này — chỉ merge/deploy/verify.
```

---

### PROMPT 1 — Chuẩn hoá `nav.ts` teacher theo design (sau khi #146+#147 đã merge)

```
Mục tiêu: sidebar /v2/teacher khớp Prototype A (Galerie). CHỈ sửa frontend/src/components/ui-v2/nav.ts.
Sau khi #146 (mục "Tin nhắn") và #147 (grade-image→Quản lý, Hồ sơ) đã hợp nhất, thay teacherNav bằng đúng cấu trúc design:

Nhóm + mục (giữ field id ổn định cho mục đã có; href phải trỏ route thật):
- "Quản lý lớp":
  - teacher        → "Dashboard & Lớp học"   /v2/teacher              icon dashboard
  - schedule       → "Lịch dạy"               /v2/teacher/schedule     icon event           (route sẽ có ở PROMPT 4 — tạm trỏ, hoặc thêm sau khi PROMPT 4 xong để tránh dead-link)
  - tc-progress    → "Tiến độ khóa học"        /v2/teacher/tc-progress  icon trending_up
  - tc-checklist   → "Checklist khóa học"      /v2/teacher/tc-checklist icon checklist
  - grading        → "Trung tâm Chấm bài"      /v2/teacher/grading      icon grading
  - grade-image    → "Chấm bài qua ảnh"        /v2/teacher/grade-image  icon draw
  (KHÔNG thêm "Quiz & Kiểm tra" — chốt không làm 2026-06-22)
- "Giảng dạy":
  - sessions       → "Buổi học 1:1"            /v2/teacher/sessions     icon co_present
  - tc-messages    → "Tin nhắn học viên"       /v2/teacher/messages     icon chat
- "Công cụ AI":
  - grammar-ai     → "Ngữ pháp AI"             /v2/teacher/tools/grammar   icon spellcheck
  - materials-ai   → "Tạo Tài liệu AI"         /v2/teacher/tools/materials icon description
  - ai-images      → "Tạo ảnh AI"              /v2/teacher/tools/images    icon image
- "Thống kê":
  - analytics      → "Báo cáo & Phân tích"     /v2/teacher/analytics    icon monitoring
- "Tài khoản":
  - t-profile      → "Hồ sơ"                   /v2/teacher/profile      icon person

Quy tắc:
- "Thông báo" (notifications) chuyển lên top bar (PROMPT 2) → BỎ khỏi sidebar (hoặc giữ 1 mục nếu muốn).
- KHÔNG thêm role-switcher demo.
- Icon dùng Material Symbols names (kiểm tra GaIcon đã map; thiếu thì thêm vào GaIcon).
- ⚠️ Để tránh dead-link: chỉ thêm mục "schedule" SAU khi route (PROMPT 4) tồn tại;
  nếu làm nav trước, để mục đó comment lại kèm TODO.
Verify: tsc --noEmit, eslint nav.ts, next build exit 0; chụp sidebar đối chiếu ảnh design.
```

---

### PROMPT 2 — Top bar: pill "X bài chờ chấm" + badge chuông

```
Sửa frontend/src/components/ui-v2/GaTopBar.tsx (và GaShell nếu cần truyền data).
Mục tiêu (chỉ cho role teacher; vai khác giữ nguyên):
1. Thay chip tĩnh "Khu vực giáo viên" bằng PILL ĐỘNG "{n} bài chờ chấm":
   - Lấy n từ plumbing có sẵn: GET /v2/teacher/dashboard/summary (field pendingReview) HOẶC
     GET /v2/teacher/grading/queue (đếm phần tử). Dùng cái dashboard nếu có sẵn để nhẹ.
   - n=0 → ẩn pill (hoặc hiện "Đã chấm hết"); n>0 → pill nền accent, bấm vào → /v2/teacher/grading.
   - Fetch client-side (GaTopBar thành client component cho nhánh teacher, hoặc tách TeacherTopBarExtras).
2. Chuông thông báo: thêm badge số unread:
   - Dùng notificationApi (lib/notificationApi.ts) lấy unread count; badge đỏ góc phải chuông, ẩn khi 0.
Quy tắc: KHÔNG bịa số — chỉ hiển thị khi fetch thành công; lỗi/đang tải thì ẩn pill/badge.
Reuse pattern fetch teacher (useState+useEffect, KHÔNG dùng useAdminData — nó gate admin).
Verify: tsc + eslint + next build exit 0; chụp top bar với n>0 và n=0.
```

---

### PROMPT 3 — Toggle ngôn ngữ VI/EN/DE (giữ, bỏ role-switcher)

```
Hạ tầng đã có: next-intl (next.config.mjs withNextIntl, layout.tsx NextIntlClientProvider),
frontend/messages/{vi,en,de}.json, src/i18n/request.ts; user.locale có trong /auth/me + PATCH /profile/me.

Việc:
1. Thêm 1 LanguageToggle (VI/EN/DE) vào GaTopBar (cạnh chuông/help), style theo design (segmented nhỏ).
2. Đổi ngôn ngữ = set cookie locale (next-intl đọc trong i18n/request.ts) + router.refresh();
   nếu đã đăng nhập, persist bằng updateProfile({ locale }) (đã dùng ở profile/page.tsx).
3. Đảm bảo i18n/request.ts đọc locale từ cookie (nếu chưa, thêm).
LƯU Ý PHẠM VI (nói rõ với user): các màn /v2/teacher hiện hard-code chuỗi tiếng Việt.
Toggle sẽ đổi locale nhưng chuỗi chưa dịch sẽ vẫn hiện tiếng Việt cho tới khi extract sang messages/*.json.
→ Phase 1: chỉ wire toggle + chuyển locale (đã có giá trị thật). Phase 2 (riêng): trích chuỗi teacher sang i18n.
Verify: đổi VI→DE đổi được cookie + persist locale; tsc/eslint/build exit 0.
```

---

### PROMPT 4 — "Lịch dạy" (teacher availability) — backend + màn v2

```
Mục tiêu: dựng màn /v2/teacher/schedule (design GaTeacherSchedule) + endpoint availability.
Hiện trạng: cột teacher_profiles.available_slots_json TỒN TẠI nhưng KHÔNG có endpoint.

Backend (module teacher):
1. Endpoint (TeacherCenterController hoặc controller mới TeacherAvailabilityController):
   - GET  /api/v2/teacher/availability        → trả slots tuần (đọc available_slots_json của teacher hiện tại)
   - PUT  /api/v2/teacher/availability {slots} → ghi available_slots_json
   Định dạng slots đề xuất: [{ day: 0-6, start: "HH:mm", end: "HH:mm" }] (JSON, tuần lặp).
   Nếu muốn lịch theo ngày cụ thể (không chỉ tuần lặp) → tạo bảng mới teacher_availability
   (migration V≥231, SAU V230) thay vì cột JSON; chọn 1 hướng và ghi rõ.
2. Authz: chỉ teacher tự sửa của mình. Test service (mirror MessageServiceTest).

Frontend:
3. FE api client lib/teacherAvailabilityApi.ts (getAvailability/putAvailability).
4. Màn frontend/src/app/v2/teacher/schedule/page.tsx — lưới tuần 7 ngày × khung giờ, accent violet,
   Newsreader headings, dùng ui-v2 (GaPageHdr, GaCard…). Đối chiếu GaTeacherSchedule trong proto.
   States: loading/empty/error/data honest (không bịa slot).
5. Mở mục "Lịch dạy" trong nav.ts (PROMPT 1) sau khi route tồn tại.
Reuse: useState+useEffect fetch (không useAdminData). Quy tắc Option-1 nếu proto có field không có backend → bỏ, không bịa.
Verify: BE compile + test pass; FE tsc/eslint/build exit 0; live-test set 1 slot → reload còn → chụp.
```

---

### ~~PROMPT 5 — "Quiz & Kiểm tra"~~ — ĐÃ HUỶ

> **Chốt 2026-06-22: KHÔNG hồi sinh Quiz.** Quiz đã bị gỡ khỏi `main` có chủ đích (`V203__drop_legacy_quiz_tables`). Không build lại — bỏ mục "Quiz & Kiểm tra" khỏi nav target. Sidebar chấp nhận thiếu đúng 1 mục so với design.

---

### PROMPT 6 — (Tuỳ chọn) Nâng cấp nội dung màn theo proto (Option-1 gaps)

```
Chỉ làm khi muốn khớp NỘI DUNG màn (không chỉ nav). Mỗi mục cần backend riêng — coi là backlog:
- Grading rubric đa tiêu chí (Phát âm/Ngữ pháp/Nội dung) + AI-confidence %:
  cần lưu điểm theo từng tiêu chí trên submission + field confidence ở /evaluate (hiện chỉ 1 điểm 0–100).
- Class-detail: cột điểm/streak/lần-cuối + score-bars/donut/skill-heatmap:
  class_students ĐÃ có skill_horen/lesen/schreiben/sprechen nhưng DTO không expose → thêm field vào students/analytics DTO.
- Student-report ("Chi tiết" học viên đang toast): build màn GaStudentReport.
- tc-progress: pace/module/milestone (cần lịch khoá học + nhóm module, hiện lessons phẳng).
- materials-ai: endpoint sinh worksheet (type/topic/level/count → reading+MCQ); hiện chỉ doc→PPTX.
Mỗi mục: thêm field/endpoint backend tối thiểu → bật lại phần UI đã bị Option-1 cắt. Tham chiếu docs/UI_2.0_HANDOFF.md §8.
```

---

## 7. Rủi ro & lưu ý

- **Thứ tự migration cứng:** V228 (#146) → V229/V230 (#147) → mới tới V231+ (Lịch dạy nếu cần bảng riêng). Sai thứ tự Flyway fail.
- **Conflict `nav.ts`:** #146 + #147 + PROMPT 1 đều đụng file này → làm tuần tự, PROMPT 1 là bản chuẩn cuối.
- **Dead-link:** chỉ thêm mục nav "Lịch dạy" sau khi route tồn tại (hoặc để placeholder honest), tránh nav trỏ 404.
- **Quiz: chốt KHÔNG làm** (2026-06-22) — sidebar teacher sẽ thiếu đúng 1 mục so với design, chấp nhận.
- **i18n toggle ≠ đã dịch:** wire toggle nhanh, nhưng chuỗi teacher đang hard-code VN → cần phase trích chuỗi riêng mới thực sự đa ngữ.
- **Deploy backend = cổng 👤:** cần SSH whitelist IP; web (FE thuần như PROMPT 1/2/3) tự lên qua Amplify khi merge main, không cần SSH.

## 8. Thứ tự đề xuất (gọn)
1. **PROMPT 0** (deploy #146→#147) — đóng phần lớn khoảng cách ngay.
2. **PROMPT 1 + 2 + 3** (nav + top bar + lang) — 1 đợt FE, khớp design về cấu trúc/visual.
3. **PROMPT 4** (Lịch dạy) → mở mục nav.
4. **PROMPT 6** (tuỳ chọn) khi muốn khớp nội dung sâu.

*(Quiz & Kiểm tra — chốt không làm.)*
```
