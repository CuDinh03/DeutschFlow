# BÁO CÁO ĐÁNH GIÁ TOÀN DIỆN DEUTSCHFLOW — 2026-07-03

> **Phương pháp:** audit độc lập theo `PROMPT_FABLE5_DANH_GIA_TOAN_DIEN.md`, thực hiện bằng 11 agent audit song song trên 4 trục (đọc trực tiếp code trên nhánh `main`), sau đó adversarial-verify các finding CRITICAL/HIGH (14/32 qua vòng verify độc lập; 6 finding thêm được chủ trì spot-check trực tiếp trong code; các finding còn lại đánh dấu ⚪ chưa-verify). **Code là sự thật** khi lệch tài liệu — các điểm docs-drift được liệt kê riêng.
>
> **Bối cảnh đã chốt dùng làm chuẩn:** App Store v1.0 = free + AdMob non-personalized (không ATT) + subscription **chỉ PRO** qua Apple IAP; web billing = SePay "gói N ngày" (MoMo hoãn); **free tier = KHÔNG AI** (chạm AI → paywall); team = 1 founder + AI; **deadline nộp App Store = 6–7/7/2026 (còn 3–4 ngày)**; phát hành tư cách cá nhân; prod ~7 active user (30 ngày tính đến 11/06); roadmap owner: chấm công/QR/lương/chuyên cần + thu thập CV.

---

## 1. TÓM TẮT ĐIỀU HÀNH (Executive Summary)

**Sức khỏe tổng thể: 3/5.** Phần "lõi khó" của DeutschFlow trưởng thành bất ngờ so với team 1 người: backend thanh toán 4 provider đều fail-closed + idempotent, AuthZ/tenant-guard vững (các IDOR cũ đã vá thật), **không có secret nào bị commit** (đã quét cả git history), token-pool org **đã được enforce** (rủi ro margin #1 trong GTM plan đã lỗi thời). Ngược lại, phần "đưa sản phẩm ra chợ" đang là vùng yếu nhất: client chưa có đường thu tiền nào, QA gate bị vô hiệu trên thực tế, backup DB không có bằng chứng, và một bug vi phạm chính sách Apple đang nằm ngay trên đường nộp.

**5 rủi ro lớn nhất (thẳng thắn):**

1. 🔴 **Xóa tài khoản đang HỎNG** với học viên từng nhắn tin/đăng kênh lớp — `AccountDeletionService` viết trước khi V228 (`messages`) và V241 (`class_channel_messages`) thêm FK non-cascading → DELETE `/api/profile/me` fail FK. Vi phạm App Store Guideline **5.1.1(v)** (lý do reject phổ biến) + quyền xóa NĐ 13/2023. **[CONFIRMED]** — memory/checklist cũ ghi "delete-account DONE" đã lỗi thời sau merge P6. Fix ~0.5–1 ngày, **bắt buộc trước submit**.
2. 🔴 **Deadline 6–7/7 xung đột vật lý với Hướng B.** iOS hiện chưa có bất kỳ đường thu tiền nào: `PAYWALL_ENABLED = Platform.OS !== 'ios'`, `expo-iap`/AdMob **chưa cài**, Paid Apps Agreement **chưa ký** (lead-time Apple ngoài tầm kiểm soát), 2 blocker config backend còn nguyên (`APPLE_BUNDLE_ID` default sai + product IDs V189 lệch bundle). → Phải chọn: **(A) nộp 6–7/7 bản free-only** (khuyến nghị) rồi v1.1 monetization ~2 tuần sau, hoặc **(B) giữ full Hướng B và trượt deadline** sang giữa/cuối tháng 7.
3. 🔴 **Rủi ro mất dữ liệu:** không tìm thấy bất kỳ cơ chế backup/restore DB nào trong repo (1 RDS t4g.micro single-AZ); thêm vào đó `payment_transactions`/`user_subscriptions` bị **CASCADE xóa theo user** → xóa tài khoản = mất ledger tài chính/đối soát Apple. Việc xác minh RDS automated backup chỉ mất 15 phút trên console — **làm hôm nay**.
4. 🔴 **Cổng chất lượng đã vô hiệu mà không ai biết:** Integration Tests trên `main` **đỏ liên tục từ 24/06** (4 lần push), `main` không có branch protection, deploy thủ công không chờ CI, Playwright không chạy trong CI, 0 coverage gate ở cả 3 tầng — ngay trước launch.
5. 🔴 **Pháp lý tính năng thu thập CV:** tự động scrape CV công khai từ LinkedIn/Facebook/TopCV vi phạm ToS cả 3 nền tảng và lệch NĐ13 (dữ liệu công khai ≠ đồng ý xử lý), rủi ro đặc biệt cao với tư cách phát hành **cá nhân**. Khuyến nghị dứt khoát: **không build crawler** — thay bằng pipeline consent-based (form ứng tuyển + upload CV, tái dùng `DocumentParsingService` + Gemini, ~3.5 ngày, rẻ hơn cả crawler).

**5 khuyến nghị ưu tiên nhất:** (1) **Hôm nay**: ký Paid Apps Agreement + xác minh RDS backup + bật branch protection (tổng <1 giờ, toàn việc "click"); (2) fix delete-account + migration V243 sửa `CHECK day_of_week` (bug chặn tạo lịch Chủ nhật — đã confirm); (3) chốt phương án nộp A/B ở trên và chạy checklist Phase 0 tương ứng; (4) dọn **bề mặt bán hàng đang lệch quyết định** — web pricing vẫn bán ULTRA qua MoMo (dummy secret → thanh toán fail), copy mobile/store hứa "AI không giới hạn" cho free; (5) sau submit: dồn 2 tuần cho v1.1 monetization (IAP + ads + SePay web-PRO — backend đã sẵn ~70–100%, việc nằm ở client).

---

## 2. BẢNG ĐIỂM SỨC KHỎE (Scorecard)

| Hạng mục | Điểm (1–5) | Lý do (kèm bằng chứng) |
|---|---|---|
| Kiến trúc | **3.5** | Modular monolith 31 package, tenant-guard DB-backed, OpenAPI ios 0 free-form; trừ vì luồng học chính mobile chạy trên blind-`Map` (`SkillTreeController.java:55-244`), tenant-guard 100% gọi tay, contract 3 client sync tay đã drift thật. |
| Chất lượng code / nợ kỹ thuật | **3** | 0 TODO/FIXME thật, interceptor lỗi web/mobile chất lượng cao, bug @Async nuốt lỗi đã fix chuẩn (`GradingService.java:369-393`); trừ vì cây UI kép v1+v2 ~18.283 dòng, 4 god-file >800 dòng (AdminManagementService 1520), 13 empty catch. |
| Bảo mật | **3.5** | AuthZ vững (OrgGuard DB-backed, `anyRequest().authenticated()`, P-15/P-16/PAY-1 **đã vá**), secrets sạch cả git history; trừ nặng vì delete-account hỏng (🔴), thiếu age-gate/consent minor NĐ13, HS256 secret chia sẻ sang Amplify. |
| Hiệu năng & scale | **3.5** | Index phủ đủ bảng nóng, Hikari đã tôi luyện sau P0 pool-exhaustion, token-pool org enforce thật (`QuotaService.assertAllowed:85`); trừ vì chưa từng chạy k6, Groq streaming không circuit breaker, trần cứng 5 phiên chat đồng thời. |
| Test & QA | **2.5** | 1.232 unit test backend xanh + mobile jest 87/87; nhưng IT trên main **đỏ từ 24/06 không ai biết**, 0 coverage gate cả 3 tầng, Playwright không trong CI, đường tiền Apple IAP chưa có test HTTP. |
| DevOps / hạ tầng | **2.5** | CI 4 workflow sống thật (nghi vấn "CI chết vì billing" đã hết hiệu lực), deploy có health-gate 300s; nhưng backup không bằng chứng, monitoring không xác minh được đang chạy + scrape target sai, deploy có downtime 60-120s không rollback, bus-factor 1. |
| Dữ liệu / DB | **3** | Migration gần đây (V196-V241) kỷ luật tốt; nhưng 2 bug đúng đắn confirmed (CHECK `day_of_week` chặn lịch Chủ nhật sau V240; delete-account fail FK), ledger CASCADE theo user, fresh-replay ULTRA=0 token còn nguyên. |
| Sản phẩm & UX | **3** | Core loop web đầy đủ không dead-end, SRS đúng là FSRS-4.5, mobile reskin + a11y 24/24 màn; trừ vì trải nghiệm free/hết-trial "gãy thô" đúng chỗ kiếm tiền (429 alert tiếng Anh, iOS không mua được), mock exam mobile chỉ LESEN. |
| Kinh doanh & vận hành | **2.5** | Backend tiền trưởng thành (4 webhook fail-closed) nhưng **0 đường thu tiền client trên iOS**, web pricing bán ULTRA/MoMo ngược 3 quyết định đã chốt, chi phí ~4,38tr VNĐ/tháng trên 0 doanh thu, hạ tầng không HA. |
| Sẵn sàng cho tính năng mới (HR/Payroll) | **4** | Notification infra tái dùng ~100%, mốc giờ dạy sẵn (`class_sessions` V236), RBAC first-class, `DocumentParsingService` parse được CV ngay; trừ vì module HR là greenfield + tính năng (1) theo đề bài vướng pháp lý nặng. |

**Điểm trung bình: ~3.0/5** — dự án "làm được", nền code tốt hơn mức trung bình team nhỏ, nhưng khoảng cách giữa *code xong* và *vận hành ra tiền an toàn* còn rõ; toàn bộ P0 dưới đây đều nhắm đóng khoảng cách đó.

---
## 3. PHÁT HIỆN CHI TIẾT (Findings — 131 mục, nhóm theo 4 trục)

> Nhãn verify: ✅ CONFIRMED (đã xác minh độc lập/spot-check) · 🟨 PARTIAL (đúng một phần, severity đã điều chỉnh) · ⚪ chưa qua vòng verify (bằng chứng do agent audit trích, chưa được bên thứ hai xác nhận) · không nhãn = MEDIUM/LOW không thuộc diện verify.


# TRỤC A — KỸ THUẬT


## A1 Kiến trúc — điểm 3.5/5

**Tóm tắt:** Backend là modular monolith 31 package / 103 controller. Điểm mạnh đã kiểm chứng: OrgGuard + assertTeacherOwnsClass re-verify DB (không tin JWT claim), IDOR cũ đã vá thật, spec /v3/api-docs/ios typed 150 path. Vấn đề lớn nhất theo thứ tự: (1) luồng học chính của mobile App Store chạy trên SkillTreeController 100% Map<String,Object> mà tài liệu contract tuyên bố "bỏ qua/legacy" — vùng mù contract ngay trước launch; (2) cô lập multi-tenant là guard gọi tay từng method, không có cơ chế tập trung (annotation/AOP/ArchUnit/RLS) — rủi ro tái diễn IDOR khi build roadmap chấm công/lương; (3) web+mobile hand-copy type đã drift thật dù backend có OpenAPI sạch; (4) phụ thuộc vòng giữa các package hub + God service admin 1520 dòng; (5) versioning /api vs /api/v1 vs /api/v2 không quy tắc, kèm cặp endpoint trùng student/students. Xác minh yêu cầu riêng: KHÔNG có package "marketplace" — TeacherMarketplaceController + TeacherProfile nằm trong package `teacher` (mount /api/v2/teachers), là lát C2C marketplace sống không feature-flag, ngoài GTM đã chốt.

### A1-1. Luồng học chính của mobile App Store chạy trên API blind-Map không được quản trị contract (SkillTreeController)
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1.5 ngày · **Verify:** ✅ CONFIRMED
- **Bằng chứng:** backend/src/main/java/com/deutschflow/curriculum/controller/SkillTreeController.java:55-244 — toàn bộ 10 endpoint trả Map<String,Object>/ResponseEntity<?>. mobile/lib/skillTreeApi.ts:213-238 gọi /skill-tree/me, /skill-tree/node/{id}/session, /skill-tree/{id}/complete và tự hand-map "raw snake_case" (comment tại skillTreeApi.ts:118). Trong khi đó plans/2026-06-20-openapi-coverage-audit.md:79 ghi "SkillTreeController (17) — BỎ QUA" và PracticeNode "legacy/không dùng" — nhưng web student/practice-node/[nodeId]/client-page.tsx vẫn gọi PracticeNodeController (cùng prefix /api/skill-tree). Tiền sử: bug mastery_threshold P1 (backend hardcode ≥100) chính là drift trên surface này.
- **Tác động:** Đúng surface học tập cốt lõi của app sắp nộp App Store không có schema, không contract test, không codegen — mọi thay đổi backend có thể lặng lẽ phá mobile (đã xảy ra ≥2 lần: register/skill-tree/home/exam drift, mastery_threshold). Sau launch, fix native cần review Apple, chỉ cứu được bằng OTA nếu là JS.
- **Khuyến nghị:** Type 3 endpoint mobile đang dùng (/me, /node/{id}/session, /{id}/complete) thành record DTO theo đúng playbook byte-equivalence đã dùng cho 10 round MockExam/Certificate (có sẵn *DtoSerializationTest pattern), thêm contract guard vào IosOpenApiContractTest. Đồng thời sửa dòng "BỎ QUA" trong plans/2026-06-20-openapi-coverage-audit.md để không ai xóa nhầm controller này.
- **Ghi chú verify:** Đã tự xác minh từng mảnh bằng chứng, finding đứng vững:

1. **Controller blind-Map**: `backend/.../curriculum/controller/SkillTreeController.java` — mọi endpoint trả `Map<String,Object>` hoặc `ResponseEntity<?>`: `getMySkillTree` trả `List<Map<String,Object>>` (~dòng 88-93), `getNodeSession` trả `ResponseEntity<?>` (~dòng 160-168), `submitExercises`/`completeTheoryNode`/`evaluatePronunciation`/`correctWriting` đều `Map<String,Object>`. Không có DTO nào.

2. **Mobile là consumer chính**: `mobile/lib/skillTreeApi.ts` gọi `/skill-tree/me`, `/skill-tree/node/{id}/session`, `/skill-tree/{id}/submit`, `/skill-tree/{id}/complete` và hand-map snake_case (comment "The endpoint returns raw snake_case rows (queryForList Map)" ~dòng 104; `mapSkillNode` phải tự parse `to_jsonb(...)::text`, tự normalize status UNLOCKED→AVAILABLE — bằng chứng sống của drift đã từng render node "locked-grey"). Các màn học chính đều dùng: `mobile/app/(student)/roadmap.tsx`, `index.tsx`, `node.tsx`, `node-practice.tsx`, `learn.tsx`.

3. **Cố ý loại khỏi contract**: `backend/.../common/config/OpenApiConfig.java:70` ghi rõ "Deliberately excludes /api/skill-tree/**" khỏi group `ios`; `IosOpenApiContractTest` chỉ guard `/v3/api-docs/ios` → skill-tree hoàn toàn ngoài mọi schema/contract test/codegen. `plans/2026-06-20-openapi-coverage-audit.md:79` đúng nguyên văn "SkillTreeController (17) — BỎ QUA".

4. **Web vẫn gọi PracticeNode cùng prefix**: `frontend/src/app/student/practice-node/[nodeId]/client-page.tsx:112,142,155` gọi `/skill-tree/{nodeId}/practice...` — mâu thuẫn với ghi chú "legacy/không dùng" trong plan, đúng như finding nêu.

Điểm phản biện duy nhất: mobile đã có defensive mapping (asStringArray never-throw, normalizeStatus) nên một số drift được hấp thụ; và số endpoint là 9-10 chứ số "17" trong plan là đếm operation. Nhưng đó không đủ bác bỏ — bản chất "surface học cốt lõi không có schema/contract test trước App Store launch, đã có tiền sử drift" là chính xác. Severity HIGH hợp lý (rủi ro kiến trúc trước launch, không phải bug đang cháy nên không lên CRITICAL).

### A1-2. Cô lập multi-tenant B2B = 100% kỷ luật dev, không có cơ chế tập trung
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 2 ngày · **Verify:** ✅ CONFIRMED
- **Bằng chứng:** OrgGuard (organization/service/OrgGuard.java:33-68) và TeacherService.assertTeacherOwnsClass (teacher/service/TeacherService.java:593-597) đều DB-backed (tốt, không tin JWT claim) nhưng phải gọi tay từng method: OrgController có 20 mapping / 18 lời gọi orgGuard.assert; assertTeacherOwnsClass rải tay ở 7 service (ClassScheduleService, ClassLessonService, StudentEvaluationService, LessonLogService, OrgCertificateService…). Grep TenantContext/@Filter/@FilterDef/AOP = 0 kết quả. Lịch sử: SEC-1 IDOR TeacherSessionController (docs/CODEBASE_REVIEW_2026-06-10.md §SEC-1) xảy ra đúng vì 1 controller bị bỏ sót — nay đã fix (TeacherSessionService.java:91-92 assertOwnsProfile, đã verify). audit/full-2026-06-24/REMEDIATION.md xác nhận isolation hiện lành mạnh nhưng D-8 (bảng class/assignment thiếu org_id đầy đủ → không có nền cứng DB/RLS) và T-6 (media metadata cross-tenant) còn OPEN.
- **Tác động:** Mỗi endpoint org/teacher mới lại đặt cược vào việc dev (hoặc AI agent) nhớ gọi guard. Roadmap sắp tới (chấm công TEACHER/ADMIN/OWNER, lương, QR check-in) đều là dữ liệu nhạy cảm org-scoped — xác suất tái diễn IDOR cao nếu vẫn build theo pattern tay.
- **Khuyến nghị:** Trước khi code HR features: (a) thêm 1 ArchUnit/contract test khẳng định mọi handler trong organization/controller và teacher/controller nhận orgId/classId đều đi qua OrgGuard/assertTeacherOwnsClass (fail build nếu thiếu); hoặc (b) annotation @RequireOrgRole + AOP aspect bọc OrgGuard. Giữ D-8 (org_id + RLS) ở mốc "trước scale" như REMEDIATION đã xếp — không cần làm ngay cho launch.
- **Ghi chú verify:** Đã tự xác minh trên main, bằng chứng đứng vững:

1. **Guard là DB-backed nhưng gọi tay từng endpoint**: OrgGuard.java (backend/src/main/java/com/deutschflow/organization/service/OrgGuard.java:33-68) đúng là query OrgMemberRepository (assertMember/assertOrgAdmin/assertOrgOwner/assertOrgFinance). OrgController.java có **19** @*Mapping (finding nói 20 — lệch 1, không đáng kể) và đúng **18** lời gọi orgGuard.assert*; mapping duy nhất không guard là `POST /membership/leave` (OrgController.java:159) — self-scoped, không phải lỗ hổng.

2. **assertTeacherOwnsClass rải tay**: TeacherService.java:593-597 đúng như trích. Grep thấy gọi ở TeacherController (2), ClassScheduleService (6), LessonLogService (5), OrgCertificateService (4), StudentEvaluationService (5). Đáng chú ý: **ClassLessonService.java:133-141 tự copy-paste một bản private assertTeacherOwns riêng** thay vì dùng chung — bằng chứng còn MẠNH HƠN finding: pattern đã bắt đầu drift/duplicate đúng như cảnh báo DRY.

3. **Không có cơ chế tập trung**: grep `TenantContext|@FilterDef|@Filter\(|@Aspect|EnableAspectJAutoProxy` trong backend/src/main = **0 kết quả**. Grep ArchUnit/ArchRule toàn backend (main + pom) = 0 — chưa có contract test kiểu (a) trong khuyến nghị. Chỉ có OrgGuardTest/OrgControllerTest unit test cho endpoint hiện hữu, không ép endpoint MỚI phải có guard.

4. **Lịch sử + audit**: TeacherSessionService.java:82,92,151 có assertOwnsProfile (SEC-1 đã fix, đúng như finding thừa nhận). audit/full-2026-06-24/REMEDIATION.md dòng 52 (D-8 "thiếu org_id → không nền cứng tenant", mốc "Trước scale") và dòng 63 (T-6 media cross-tenant metadata) đều còn OPEN, khớp trích dẫn.

Severity HIGH hợp lý: đây là rủi ro kiến trúc forward-looking (mỗi endpoint mới = 1 lần đặt cược), đã có tiền lệ IDOR thật (SEC-1) và đã có dấu hiệu duplicate guard (ClassLessonService). Không thổi phồng — finding cũng tự ghi nhận isolation hiện tại lành mạnh và xếp D-8/RLS ở mốc trước-scale chứ không đòi làm ngay.

### A1-3. Không có shared contract cho web + mobile dù backend đã có OpenAPI typed — drift đang xảy ra thật
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 2 ngày · **Verify:** 🟨 PARTIAL → hạ mức MEDIUM
- **Bằng chứng:** frontend/package.json và mobile/package.json không có openapi-typescript hay codegen nào (grep "openapi" = 0); iOS Swift codegen thì đã ăn /v3/api-docs/ios (150 path, 0 free-form — plans/2026-06-20-openapi-coverage-audit.md:100). Drift cụ thể hiện tại: frontend/src/lib/studentClassesApi.ts khai `submissionContent: string | null` (bắt buộc) trong khi mobile/lib/studentClassesApi.ts đánh `submissionContent?` kèm comment "absent (undefined) on the lighter class-scoped list" — tức FE type đang SAI với response thật của list class-scoped (backend teacher/dto/StudentAssignmentDto.java:18). Hai file type gần giống nhau được copy tay 2 nơi; mobile/lib/gamificationApi.ts tự ghi chú "Field names mirror the backend DTOs" — sync bằng niềm tin.
- **Tác động:** Lặp lại đúng loại bug đã có tiền sử (snake_case/camelCase, notification unreadCount vs unread SSE chết). Với 1 founder, mỗi drift = một vòng debug device thật tốn nhiều giờ; sau App Store launch, drift phía mobile thành bug production khó vá.
- **Khuyến nghị:** Bước rẻ nhất (không cần monorepo package): thêm script `openapi-typescript http://localhost:8080/v3/api-docs/ios -o types/api.d.ts` vào cả frontend lẫn mobile, áp dụng dần cho file API mới/được sửa; CI so diff types để phát hiện breaking change backend. Không cần dời sang @deutschflow/contracts trước launch.
- **Ghi chú verify:** Phần kiến trúc ĐÚNG, nhưng bằng chứng drift cụ thể bị ĐẢO NGƯỢC chiều. Đã xác minh: (1) grep "openapi/codegen" = 0 hit ở frontend/package.json và mobile/package.json — không có codegen, đúng. (2) Type StudentAssignment bị copy tay 2 nơi (frontend/src/lib/studentClassesApi.ts:44-61 vs mobile/lib/studentClassesApi.ts) — đúng. (3) NHƯNG claim "FE type đang SAI với response thật của list class-scoped" là SAI: endpoint class-scoped GET /api/v2/students/classes/{classId}/assignments (StudentClassroomController.java:47-52) trả List<StudentAssignmentDto>, và toDto() tại StudentClassroomService.java:256-268 LUÔN set submissionContent = a.getSubmissionContent() (dòng 264). Record StudentAssignmentDto.java KHÔNG có @JsonInclude(NON_NULL), và không có global serialization-inclusion config (grep setSerializationInclusion/default-property-inclusion = 0) → field luôn hiện diện trong JSON (giá trị null khi chưa nộp). Tức FE type `submissionContent: string | null` là ĐÚNG; chính comment phía mobile ("absent (undefined) on the lighter class-scoped list") mới là mô tả sai — nhưng type optional `?: string | null` của mobile là superset nên vô hại runtime. Endpoint global /api/v2/students/assignments (StudentAssignmentController.java:56-79) cũng build cùng DTO với đầy đủ field. Kết luận: không có drift gây bug đang xảy ra ở ví dụ được trích; cái tồn tại là một comment/niềm-tin sai phía mobile — bản thân nó minh họa rủi ro sync-tay, nhưng không phải "FE type SAI" như finding nêu. Cấu trúc thiếu shared contract + tiền sử bug (unreadCount SSE) là thật → giữ finding ở mức MEDIUM (nợ kiến trúc/phòng ngừa), không phải HIGH "drift đang xảy ra thật".

### A1-4. Phụ thuộc vòng giữa các package hub — modular monolith không còn 'modular' ở lõi
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 3 ngày
- **Bằng chứng:** Dependency map dựng từ import thật: user↔teacher (user/controller/StudentClassroomController.java:3-7 import teacher.dto; chiều ngược teacher→user 42 import), user↔speaking (user/service/RecommendationService.java:3 import speaking.repository.UserGrammarErrorRepository), user↔organization, user↔notification, user↔srs, user↔media, organization↔payment, organization↔teacher, notification↔teacher, speaking↔ai/interview/training. Package `common` (đáng lẽ leaf) cũng import ngược user + organization (common/security/JwtAuthFilter.java).
- **Tác động:** Không thể tách/test module độc lập; thay đổi ở user/speaking lan sang 6+ package; AI agent sửa code dễ tạo thêm cạnh vòng mới vì không có rule nào chặn. Chưa gây bug trực tiếp nhưng là lý do các God-file phình ra (mọi thứ với tay được vào mọi thứ).
- **Khuyến nghị:** Không đại-refactor. Hai việc nhỏ có lãi: (1) move 3 Student*Controller (Class/Classroom/Assignment) từ `user` sang `teacher` (chúng import toàn teacher.dto/service — đặt sai chỗ là nguồn cycle user↔teacher); (2) thêm ArchUnit rule khóa hiện trạng (freeze) để cấm cạnh vòng MỚI — rẻ hơn nhiều so với gỡ cạnh cũ.

### A1-5. God-file cụm admin + controller chứa business logic/JdbcTemplate (nợ BE-C1 2026-06-10 vẫn còn)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 3 ngày
- **Bằng chứng:** wc -l: AdminManagementService.java 1520 dòng + 21 dependency `private final` (kể cả JdbcTemplate thô) — đã PHÌNH thêm từ 1171 dòng lúc review 2026-06-10; AdminManagementController.java 980 dòng; SkillTreeService.java 1124; TheoryBasedExerciseGenerator.java 1116; MockExamController.java 537 dòng vẫn tự query (`jdbcTemplate.query("""...` tại dòng 91) dù đã inject ExamScoringService. 5 controller còn JdbcTemplate trực tiếp: MockExam, Certificate, Progress, AdminManagement, AiSpeakingMockExam. 174 chỗ Map<String,Object> còn lại trong *Controller.java (tập trung admin/teacher/org).
- **Tác động:** Không unit-test được, không @Transactional boundary đúng, mọi thay đổi admin đụng 1 file khổng lồ — chính file này từng chứa bug legacy-quiz làm sai số liệu dashboard (đã fix, comment tại AdminManagementService.java:84). Với AI-assisted dev, file 1500 dòng còn làm giảm chất lượng patch do context loãng.
- **Khuyến nghị:** Không tách ngay trước launch. Quy tắc 'chạm là tách': lần tới đụng admin, tách AdminManagementService theo 4 cụm (users/orgs/ai-cost/content) — mỗi cụm đã có ranh giới tự nhiên trong file. MockExamController move phần query/scoring còn lại vào ExamScoringService khi làm exam feature kế tiếp.

### A1-6. Package đặt sai trách nhiệm: exam/certificate/progress nằm trong `grammar`, learning-engine nằm trong `user`, marketplace nằm trong `teacher`
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 2 ngày
- **Bằng chứng:** grammar/controller/ chứa MockExamController, MockExamPackController, AdminMockExamPackController, CertificateController, ProgressController — thi Goethe/chứng chỉ/tiến độ không phải grammar. user/service/ chứa LearningPlanService (820 dòng), TheoryBasedExerciseGenerator (1116), SessionExerciseService, RecommendationService — cả learning engine sống trong package định danh user. Verify yêu cầu prompt: KHÔNG tồn tại package `marketplace`; TeacherMarketplaceController + TeacherProfile + TeacherSession* đều nằm trong `teacher` (teacher/controller/TeacherMarketplaceController.java, mount /api/v2/teachers).
- **Tác động:** Tìm code sai chỗ làm chậm cả người lẫn AI agent; ranh giới mờ khiến grammar import speaking/organization và user import 6 package khác (nguồn của finding cycle). Khi tách 'exam' cho tính năng thi thật (GTM B1 Sprint) sẽ phải gỡ rối trước.
- **Khuyến nghị:** Ghi nhận mapping thật vào 1 trang ARCHITECTURE.md (module → trách nhiệm → package thật, kể cả chỗ sai) thay vì move ngay. Move vật lý chỉ làm khi đụng feature: exam→package `exam` riêng, learning-plan/exercise→`curriculum` hoặc `learning`.

### A1-7. Versioning API 3 chế độ không quy tắc + cặp endpoint trùng singular/plural
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** Dump @RequestMapping: ~80 controller ở /api/** không version; đúng 1 route /api/v1/grammar/cases — và ApiDeprecationInterceptor.java:17 phát Warning header "migrate to v2" cho MỌI /api/v1/** dù v2 tương đương không tồn tại; ~15 controller /api/v2/** nhưng v2 thực chất = namespace 'teacher/B2B mới' chứ không phải version của v1. Trùng lặp: StudentClassController.java:14 mount /api/v2/student/classes (chỉ join) vs StudentClassroomController.java:26 mount /api/v2/students/classes (read) — cùng feature, 2 controller, khác số ít/nhiều.
- **Tác động:** Client dev và codegen không đoán được endpoint mới sẽ nằm đâu; breaking-change không có chính sách; cặp student/students là bẫy 404 kinh điển khi viết client mới (3 client × N dev-session AI).
- **Khuyến nghị:** Không đổi URL nào (tránh break 3 client). Viết 1 trang docs/API_CONVENTIONS.md chốt: unversioned = student/B2C surface hiện hữu, /api/v2 = B2B/teacher surface, /api/v1 = frozen-deprecated; merge StudentClassController vào StudentClassroomController (giữ cả 2 route bằng 2 @RequestMapping value trong 1 controller nếu cần).

### A1-8. Hai 'hợp đồng lỗi' song song: RFC-7807 ProblemDetail vs ad-hoc {error} body
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** GlobalExceptionHandler (common/exception/GlobalExceptionHandler.java:96-120,178,242-280) trả ProblemDetail chuẩn (type/title/detail + errorId ERR-xxx). Nhưng nhiều endpoint trả lỗi dạng khác: CertificateClaimDto = union 4 outcome kể cả 400/500 {error,...} mà FE đọc `data.error` (plans/2026-06-20-openapi-coverage-audit.md:82, certificates/page.tsx:159); AppleIap verify/sync trả AppleErrorResponse {error} qua @ExceptionHandler cục bộ controller (openapi-audit:89). Success thì không có envelope (bare DTO/Map/array trộn lẫn).
- **Tác động:** Client phải biết shape lỗi theo từng endpoint — mobile expo-iap sắp wire vào /api/payments/apple sẽ gặp {error} thay vì ProblemDetail; toast/error-handling generic phía client không bắt được hết → lỗi im lặng. Đây là loại chi tiết dễ gây bug thanh toán khó tái hiện.
- **Khuyến nghị:** Không retrofit (break contract). Chốt quy ước từ nay: endpoint mới lỗi = ProblemDetail; document 2 shape hiện có trong API_CONVENTIONS.md kèm danh sách endpoint dùng {error}; phía mobile viết 1 helper parseApiError() hiểu cả 2 shape trước khi wire IAP.

### A1-9. Lát C2C marketplace (TeacherMarketplace + TeacherSession/payout) sống không flag, ngoài GTM đã chốt, trên bảng tiền không CHECK constraint
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** teacher/controller/TeacherMarketplaceController.java (/api/v2/teachers/public — hồ sơ gia sư công khai, org teachers bị exclude theo quyết định B2B 2026-06-10) + TeacherSessionController (/api/teacher-sessions — booking, earnings, admin mark-paid) + FE pages book-session/tutor/teachers còn sống, không có feature flag nào (grep isEnabled/featureFlag = 0 trong 2 controller). V179__teacher_sessions.sql:19-27: status/payment_status/payout_status VARCHAR không CHECK (chỉ teacher_rating có) — bảng có price_vnd/payout mà state machine không được DB enforce (DB-M4 cũ chưa fix). Mô hình 'thuê gia sư 1-1 + payout' không nằm trong monetization đã LOCK (Apple IAP PRO + SePay gói N ngày + B2B org-invoice).
- **Tác động:** Surface bảo trì + audit security + App Store review thêm cho một business model chưa quyết; IDOR SEC-1 trước đây phát sinh đúng ở cụm này. Nếu học viên bấm book-session trong app iOS có giá tiền mà không có luồng thanh toán thật → trải nghiệm gãy ngay trước mắt reviewer Apple.
- **Khuyến nghị:** Quyết định dứt điểm 1 trong 2: (a) park — flag config tắt controller (`@ConditionalOnProperty`) + ẩn FE/mobile entry points khỏi build App Store; hoặc (b) nhận vào roadmap chính thức thì bổ sung CHECK constraint + test payout. Khuyến nghị (a) cho v1.0.

### A1-10. Roadmap owner (chấm công/QR/lương/chuyên cần + CV crawler) chưa có chỗ đứng kiến trúc — quyết định placement trước khi code
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** Grep payroll/salary/luong/check-in trong backend = 0 surface tồn tại; thứ gần nhất là ClassAttendance (teacher/entity/ClassAttendance.java) — điểm danh HỌC VIÊN, không phải chấm công nhân sự. Package `teacher` đã là hub nặng (TeacherService 761 dòng, cycle với 4 package) và `admin` đã có God service 1520 dòng — 2 nơi 'tiện tay' nhất để nhét tính năng mới cũng là 2 nơi tệ nhất.
- **Tác động:** Nếu chấm công/lương bị nhét vào teacher/admin theo quán tính: lặp lại D-8 (bảng mới thiếu org_id), lặp pattern guard-tay (finding #2), và God-file phình tiếp. CV crawler TopCV/LinkedIn/Facebook nếu nằm trong monolith sẽ kéo scraping dependency + rủi ro pháp lý ToS vào deployable production.
- **Khuyến nghị:** (1) Chấm công→chuyên cần→lương: tạo package mới `hr` (hoặc `workforce`) với mọi bảng có org_id NOT NULL + FK từ ngày 1, mọi controller qua OrgGuard, và làm theo đúng chuỗi phụ thuộc (4)→(5)→(3), QR chỉ là input method của (4). (2) CV crawler: đứng NGOÀI monolith hoàn toàn (script/service riêng, DB/schema riêng, chỉ export CSV/API) — không share runtime với app học viên. Effort ghi ở đây chỉ là skeleton + ADR 1 trang.

### A1-11. Content-pipeline tooling (Goethe/Wiktionary enrichment ~4.500 dòng) sống trong artifact production
- **Mức độ:** 🟢 Thấp · **Tin cậy:** MEDIUM · **Effort:** 1 ngày
- **Bằng chứng:** util/GoetheWiktionaryDeepEnricher.java 1162 dòng (standalone, không @Service), GoetheSafeAutoCleaner 470, GoetheClassificationBackfill 419; vocabulary/service có 6 import/scraper service là @Service bean thật (WiktionaryEnrichmentBatchService.java:24 @Service, 682 dòng; GoetheVocabularyAutoImportService 674; GlosbeVocabularyImportService 594; WiktionaryScraperService 590; OfficialCefrVocabularyImportService 562; GoetheOfficialWordlistImportService 531) — tất cả load trong context prod trên EC2 t3.medium.
- **Tác động:** Phình build + bean context + attack surface cho code chỉ chạy vài lần khi import content; nhiễu khi grep/đọc code. Không gây bug trực tiếp.
- **Khuyến nghị:** Gắn @Profile("tools") (hoặc @ConditionalOnProperty app.content-tools.enabled) cho cụm import service để prod không khởi tạo bean; util standalone giữ nguyên (không vào context). Làm lúc rảnh, không ưu tiên trước launch.

**Docs-drift phát hiện trong trục này (6):**
- docs/ARCHITECTURE_DATA_FLOW.md — tên file gợi ý doc kiến trúc toàn hệ thống nhưng nội dung CHỈ là AI Speaking module (dòng 1: 'AI Speaking Module - Architecture & Data Flow', last updated 2026-05-23); vẫn mô tả OpenAiChatClient/ElevenLabs là đường chính trong khi prod chạy Groq + XTTS; nhiều mục 'Fix:' trong doc đã được fix từ lâu. Repo hiện KHÔNG có doc kiến trúc tổng thể nào còn đúng.
- docs/CLAUDE.md — 'Modular Monolith with 7 core domains' trong khi backend thực tế có 31 package domain; cấu trúc mô tả thiếu toàn bộ surface /api/v2, organization/payment/notification...; vẫn ghi Spring Boot 3.2.5 (đúng với pom.xml:10 — nhưng bản này đã EOL, review 2026-06-10 khuyến nghị bump chưa làm).
- docs/CODEBASE_REVIEW_2026-06-10.md — snapshot không được đánh dấu resolved: SEC-1 IDOR TeacherSessionController ĐÃ fix (TeacherSessionService.java:91 assertOwnsProfile — verified), BE-C3 legacy quiz ĐÃ gỡ (AdminManagementService.java:84), BE-H5 runAsync commonPool ĐÃ chuyển sang aiExecutor bean (PracticeNodeService.java:79). Người đọc hôm nay sẽ tưởng còn 9 CRITICAL đang mở.
- plans/2026-06-20-openapi-coverage-audit.md:79 — ghi 'SkillTreeController — BỎ QUA' và 'PracticeNode legacy/không dùng' nhưng Expo mobile app (app sẽ nộp App Store) đang gọi /skill-tree/me|node/{id}/session|{id}/complete (mobile/lib/skillTreeApi.ts:213-238) và web student/practice-node vẫn gọi PracticeNodeController — 'legacy' chỉ đúng trong phạm vi codegen iOS native, dễ khiến ai đó xóa nhầm controller đang sống.
- docs/API_CONTRACT_W2.md — 'contract' 31 dòng chỉ phủ 4 nhóm path (auth/plan/words/admin-reports); backend hiện có 103 controller và toàn bộ /api/v2 B2B surface nằm ngoài contract này; giá trị tài liệu ≈ 0 so với tên gọi.
- mobile/lib/paywall.ts — comment 'Flip back on once react-native-iap is wired' trong khi kế hoạch đã LOCK dùng expo-iap → backend /api/payments/apple sẵn có; comment cũ có thể dẫn AI agent cài nhầm thư viện.


## A2 Chất lượng code — điểm 3/5

**Tóm tắt:** Điểm nóng phức tạp: backend top-10 file lớn nhất là AdminManagementService.java 1520 dòng (method userLearningDetail:1213 dài 195 dòng, aiCostSummary:498 dài 126 dòng), GoetheWiktionaryDeepEnricher 1162, SkillTreeService 1124, TheoryBasedExerciseGenerator 1116, AdminManagementController 980, LearningPlanService 820, TeacherService 761, WordQueryService 759, QuotaService 698, SpeakingPersona 694. Frontend: teacher/dashboard/[id]/client-page.tsx 1662 dòng (1 component, 41 useState), teacher/reports 1199, student/mock-exam 1001 (nơi từng có bug white-screen), vocab-practice 856, swipe-cards 819. Mobile lành mạnh hơn (max 775). Trùng lặp đáng kể: (1) cây UI kép /v2 Galerie 97 file/18.283 dòng nhân đôi legacy tree; (2) 6 service import vocab ~4.049 dòng với helper copy-paste (upsertTranslation ×3, inferDtype ×3, normalizeCefr ×2). TODO/FIXME/HACK/XXX: 0 thật (mọi match là false positive kiểu toDouble/llmTodo) — nợ được track ở docs/BACKLOG_CHECKLIST.md thay vì rải trong code, đây là điểm cộng. Xử lý lỗi: bug AI grading @Async cũ ĐÃ FIX chuẩn (GradingService.java:369-393); còn lại 13 empty catch, nguy hiểm nhất là 5 cái ở StudentDashboardService (stats âm thầm =0) và 2 ở PlacementTestService (chấm sai đáp án âm thầm); không có AsyncUncaughtExceptionHandler tập trung. Nhất quán: admin/curriculum/vocabulary dùng JdbcTemplate+Map untyped trong khi teacher/speaking/notification dùng JPA+DTO; API path trộn /api/* unversioned với /api/v2/teacher và cả /api/v2/teachers (số nhiều). Điểm 3/5.

### A2-1. Cây UI kép v1 + v2 Galerie: 97 file / 18.283 dòng duplicate toàn bộ cohort, phải fix bug 2 lần
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 4 ngày · **Verify:** ✅ CONFIRMED → hạ mức HIGH
- **Bằng chứng:** frontend/src/app/v2/ có 97 file .tsx / 18.283 dòng phủ đủ admin, org, student, teacher, auth, payment, notifications — song song với cây legacy cùng chức năng (vd frontend/src/app/teacher/grading vs frontend/src/app/v2/teacher/grading). Gate: PostHog flag galerie-v2 (frontend/src/app/v2/V2Gate.tsx) + env kill-switch GALERIE_V2_DISABLED (frontend/src/middleware.ts:209-213).
- **Tác động:** Mọi bug fix / feature student-teacher phải land 2 nơi; drift đã là rủi ro thực (screen nào flag bật thấy behavior khác flag tắt). Với deadline App Store T7 và 1 founder, chi phí maintain kép này là khoản 'lãi suất' lớn nhất của cả codebase — càng để lâu 2 cây càng phân kỳ, chi phí hợp nhất tăng phi tuyến.
- **Khuyến nghị:** Chốt hạn kill 1 cây: đẩy galerie-v2 lên 100% (chỉ ~7 active user, rủi ro rollout thấp), giữ kill-switch 2 tuần, rồi xóa cây legacy + middleware mapping. Trong thời gian chờ, quy ước 'chỉ fix ở v2, legacy đóng băng'.
- **Ghi chú verify:** Đã tự xác minh mọi con số và cơ chế nêu trong finding:

1. Quy mô duplicate: `find frontend/src/app/v2 -name '*.tsx'` = đúng 97 file, 18.283 dòng. `ls frontend/src/app/v2` cho thấy đủ các cohort như finding nêu: admin, org, student, teacher, auth (login/register/authShared.tsx), payment, notifications, profile.

2. Song song thật, không phải wrapper: ví dụ grading — legacy `frontend/src/app/teacher/grading/client-page.tsx` là một implementation đầy đủ riêng (tự gọi `/v2/teacher/grading/queue|stats`), còn `frontend/src/app/v2/teacher/grading/page.tsx` là implementation thứ hai 657 dòng độc lập, chỉ dùng chung `@/lib/api` và component `ui-v2`. Hai màn cùng chức năng, hai codebase UI riêng → bug fix UI/behavior phải land 2 nơi. (Backend endpoint dùng chung nên fix backend chỉ 1 lần — nhưng finding nói về UI tree, đúng.)

3. Gate đúng như trích dẫn: `frontend/src/middleware.ts:209-215` có kill-switch `GALERIE_V2_DISABLED` redirect /v2/* về legacy, và comment xác nhận per-user rollout do PostHog flag `galerie-v2` quyết định phía client (`src/app/v2/V2Gate.tsx` tồn tại). Tức là cả 2 cây đều đang live tùy user → drift risk là thực.

Nuance nhỏ không đủ hạ verdict: "duplicate toàn bộ cohort" hơi mạnh — cây legacy (ngoài /v2) ~40.120 dòng .tsx, tức v2 mới phủ một tập con màn hình (khớp memory: ~32 màn built/22 locked), không phải 1:1 toàn bộ app. Nhưng mọi màn v2 đã build đều song song với legacy cùng chức năng, nên bản chất finding và severity HIGH (chi phí maintain kép + drift với 1 founder) đứng vững.

### A2-2. Domain curriculum trả Map<String,Object> untyped end-to-end — nguồn contract drift mobile↔backend đã từng gây lỗi thật
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 3 ngày · **Verify:** ✅ CONFIRMED → hạ mức HIGH
- **Bằng chứng:** backend/src/main/java/com/deutschflow/curriculum/service/SkillTreeService.java:76 `public List<Map<String, Object>> getSkillTreeForUser(long userId)`; :528 `submitNodeExercises(long, long, Map<String,Object> answers)` dài 89 dòng; 16 controller dùng ResponseEntity<Map<String,Object>>. Domain này là API chính của mobile app sắp lên App Store.
- **Tác động:** Không có compile-time contract: đổi tên key ở SQL/service là mobile vỡ im lặng (lịch sử đã có đợt 'mobile device-test surfaced contract drift' phải fix register/skill-tree/home/exam). Sát ngày submit App Store, một key đổi tên = crash/blank screen ở bản đã review, chỉ cứu được bằng OTA.
- **Khuyến nghị:** DTO-hóa có chọn lọc: chỉ các endpoint mobile đang gọi (skill-tree, node session, submit) chuyển sang Java record + kiểu hóa response; giữ Map cho endpoint admin nội bộ. Làm ngay trước khi build bản submit.
- **Ghi chú verify:** Đã xác minh trực tiếp, bằng chứng đứng vững:

1. `backend/src/main/java/com/deutschflow/curriculum/service/SkillTreeService.java:76` — đúng là `public List<Map<String, Object>> getSkillTreeForUser(long userId)`, build response trực tiếp từ `jdbcTemplate.queryForList(SELECT n.id, n.node_type, n.title_de, ...)` → key của contract = tên cột SQL, không có lớp kiểu nào ở giữa.
2. `SkillTreeService.java:528` — đúng chữ ký `submitNodeExercises(long, long, Map<String,Object>)`, đo được ~90 dòng (finding nói 89, khớp).
3. Controller: `SkillTreeController.java` (vd :57 `createPlacementTest`) trả `ResponseEntity<Map<String, Object>>`, không có annotation `@Schema`/OpenAPI nào. Đếm thực tế: 12 occurrence trong curriculum controllers (SkillTreeController + PracticeNodeController), 21 toàn backend — finding nói "16 controller" là số hơi lệch nhưng không đổi bản chất.
4. Không có test backend nào pin contract: grep `SkillTree|skill-tree` trong `src/test/java` = 0 kết quả → đổi tên key ở SQL sẽ không có gì fail lúc compile lẫn lúc test.
5. Phía mobile (`mobile/lib/skillTreeApi.ts:213-238`): `api.get<RawSkillNode[]>('/skill-tree/me')` + `mapSkillNode` — type TS chỉ là cast, comment tại :118 tự thừa nhận backend trả "raw snake_case". Đây đúng là API chính của app sắp submit (roadmap.tsx, node-practice.tsx, learn.tsx, home index.tsx đều query `['skill-tree']`).
6. Lịch sử drift có thật (memory: mobile device-test từng phải fix contract drift register/skill-tree/home/exam).

Điểm giảm nhẹ duy nhất: mobile có lớp mapping runtime tập trung (`mapSkillNode`) nên một số drift sẽ ra undefined/fallback thay vì crash cứng, và OTA (EAS Update) đã được set up làm lưới an toàn. Nhưng "không có compile-time contract + 0 test pin key" là chính xác → giữ HIGH.

### A2-3. 5 empty catch trong StudentDashboardService: stats học viên âm thầm về 0 khi query lỗi
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/user/service/StudentDashboardService.java:149,160,174,184,221 — `} catch (Exception ignored) { }` bao quanh các query XP tổng, số từ đã thuộc (stability>=21), phút speaking, grammar accuracy. Lỗi SQL/schema → giá trị mặc định 0 trả về UI, không log, không metric.
- **Tác động:** Một migration đổi tên cột hoặc lỗi pool là toàn bộ dashboard học viên hiện '0 XP / 0 từ' vô hạn mà không ai biết — đúng loại lỗi 'SRS/stats không revive' đã từng phải audit 8 agent mới tìm ra. Với app retention-driven, stats sai = user nghĩ mất tiến độ → churn.
- **Khuyến nghị:** Thay bằng log.warn(có userId + query name) + 1 counter metric chung 'dashboard_stat_query_failed'; giữ nguyên fallback 0 cho UX. Nửa ngày, làm cùng đợt với 2 catch rỗng ở PlacementTestService.

### A2-4. PlacementTestService nuốt exception khi so khớp đáp án — có thể chấm SAI câu đúng một cách im lặng
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/curriculum/service/PlacementTestService.java:315 và :328 — `} catch (Exception ignored) {}` trong logic so alternative answers và keyword matching; khi parse/regex lỗi, hàm rơi xuống return false → đáp án đúng bị tính sai.
- **Tác động:** Placement test quyết định level khởi đầu của user mới (luồng onboarding chính). Chấm sai âm thầm → xếp level thấp hơn thực tế → trải nghiệm 'quá dễ' → bỏ app. Không log nên không bao giờ phát hiện qua ops.
- **Khuyến nghị:** Log.warn với questionId + raw answer khi rơi vào catch; thêm unit test cho các alternative-answer edge case (chuỗi null, JSON alt hỏng).

### A2-5. Không có AsyncUncaughtExceptionHandler; một số @Async void không tự try/catch (notification broadcast) → thất bại chỉ còn default log
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/common/AsyncConfig.java định nghĩa 3 executor nhưng không implement AsyncConfigurer/getAsyncUncaughtExceptionHandler (grep toàn backend: 0 match). UserNotificationService.java:376 onNewClassAssignment (@Async @Transactional) không có try/catch — nếu insert/push throw, batch notification cho cả lớp mất im lặng. Ngược lại các luồng AI grading/video/skill-tree ĐÃ có catch + persist failure (GradingService.java:369-393, VideoRenderService.java:79-103, SkillTreeService.java:461-466) — bug nuốt lỗi AI grading cũ xác nhận đã fix.
- **Tác động:** Loại lỗi 'AI grading kẹt SUBMITTED' từng mất nhiều ngày debug chính là hậu quả của @Async không có safety net tập trung. Hiện các luồng tiền/chấm điểm đã tự vá, nhưng mỗi @Async MỚI viết thêm (roadmap chấm công, thông báo lương sắp tới đều là background job) lại phải nhớ tự try/catch — quên là lặp lại lịch sử.
- **Khuyến nghị:** AsyncConfig implements AsyncConfigurer, đăng ký handler chung: log.error + counter metric (PostHog/CloudWatch) kèm tên method + args. 0,5 ngày, bảo hiểm cho mọi @Async tương lai.

### A2-6. AdminManagementService 1520 dòng — god-service với method 195 dòng trả Map, đúng chỗ từng sai số liệu cost
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 2.5 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/admin/service/AdminManagementService.java: 1520 dòng; userLearningDetail (dòng 1213) dài ~195 dòng, aiCostSummary (dòng 498) ~126 dòng, cùng AdminManagementController.java 980 dòng — tất cả trả Map<String,Object>, SQL string inline.
- **Tác động:** Đây là service tính AI-COGS/doanh thu mà founder dùng ra quyết định pricing (đã từng phải refactor vì cost không chính xác). Method 195 dòng + untyped Map = gần như không unit-test được → sai số liệu tiền chỉ phát hiện bằng mắt. Lãi suất: mỗi lần thêm metric mới (roadmap thống kê lương) lại đắp vào file này.
- **Khuyến nghị:** Tách theo concern: AiCostReportService, UserLearningReportService, SystemHealthService; DTO record cho các con số tiền; unit test cho công thức cost (input ledger giả → số tiền kỳ vọng). Làm dần, ưu tiên phần cost.

### A2-7. 6 service import vocabulary copy-paste ~4.000 dòng: upsertTranslation ×3, inferDtype ×3, normalizeCefr ×2
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 2 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/vocabulary/service/: GoetheVocabularyAutoImportService 674, WiktionaryEnrichmentBatchService 682, GlosbeVocabularyImportService 594, WiktionaryScraperService 590, OfficialCefrVocabularyImportService 562, GoetheOfficialWordlistImportService 531 dòng (tổng 4.049). Grep tên private helper: upsertTranslation xuất hiện 3 file, inferDtype 3 file, normalizeCefr 2, ensureTag 2 — cùng trách nhiệm fetch→parse→upsert lặp lại.
- **Tác động:** Sửa logic upsert/CEFR-normalize ở 1 file mà quên 2 file còn lại → dữ liệu từ vựng (tài sản nội dung lõi của app học tiếng Đức) phân kỳ theo nguồn import; bug dtype/CEFR sai rất khó truy vì mỗi nguồn một đường code.
- **Khuyến nghị:** Extract VocabularyUpsertSupport (upsert lemma/translation/details, inferDtype, normalizeCefr, ensureTag) thành component chung + unit test một lần; các importer chỉ còn phần parse đặc thù nguồn.

### A2-8. God-component frontend: teacher class dashboard 1662 dòng / 41 useState trong 1 component; mock-exam 1001 dòng nơi từng có bug white-screen
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 3 ngày
- **Bằng chứng:** frontend/src/app/teacher/dashboard/[id]/client-page.tsx: 1662 dòng, duy nhất 1 component ClassDetailPage (dòng 89), 41 useState. frontend/src/app/student/mock-exam/page.tsx: 1001 dòng / 16 useState — chính file từng có bug min-h-0 white-screen phải root-cause thủ công. Vi phạm rule <800 dòng của chính repo owner.
- **Tác động:** 41 useState trong 1 component = mọi thay đổi nhỏ re-render cả trang và không thể test cô lập; lớp bug kiểu white-screen sẽ tái diễn vì không cách gì reason về state. Teacher dashboard là màn B2B bán tiền.
- **Khuyến nghị:** Không cần rewrite: tách theo tab/section (roster, gradebook, schedule, materials) thành component con + gom state server về react-query (đã có sẵn trong stack). Ưu tiên mock-exam trước (student-facing, nằm trong luồng App Store review).

### A2-9. Test bất cân xứng nghiêm trọng: backend 262 test file vs frontend 21 + mobile 12 — ngay trước App Store submit
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 3 ngày
- **Bằng chứng:** find: backend/src/test = 262 file .java (JaCoCo + surefire/failsafe cấu hình trong backend/pom.xml:322-356); frontend = 21 file .test.* + 7 e2e spec cho ~105.000 dòng TS; mobile = 12 file .test.* cho ~22.500 dòng. Số % coverage không đo được trong audit này (không chạy suite) — rule 80% của repo chắc chắn không đạt ở FE/mobile.
- **Tác động:** Các luồng sắp gắn TIỀN (paywall free-chạm-AI, expo-iap purchase→verify, SePay gói N ngày) nằm đúng ở 2 tầng mỏng test nhất. Regression ở mobile sau khi Apple duyệt = chờ review lại hoặc OTA khẩn; ở web = mất giao dịch SePay không ai biết.
- **Khuyến nghị:** Không đuổi 80% lúc này. Đầu tư đúng 3 chỗ: (1) jest cho paywall gating logic mobile (tier DEFAULT=0 token → hiện paywall), (2) contract test cho apple verify/sync client, (3) 3-4 Playwright smoke: login, mock-exam, SePay checkout, AI-gate hiện paywall. ~2-3 ngày, chạy trong CI sẵn có.

### A2-10. Quy ước data-access phân mảnh theo domain: JdbcTemplate+Map vs JPA+DTO, không có chuẩn chung
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** Đếm file dùng JdbcTemplate vs số Repository theo domain: vocabulary 20 jdbc-file/2 repo, admin 5/0, user 7/9, grammar 7/5, payment 5/1 — trong khi teacher 1/15, interview 1/6, progress 0/1. Cùng một app, 2 triết lý data-access tùy domain/tùy thời kỳ.
- **Tác động:** Mỗi lần AI-assistant hoặc chính founder mở domain mới phải đoán 'ở đây viết kiểu gì'; review chéo khó; bug kiểu N+1 (JPA) và bug kiểu typo-cột-SQL (jdbc) phân bố ngẫu nhiên. Đây là lãi suất nhận thức, chưa phải lỗi runtime.
- **Khuyến nghị:** Không refactor đại trà. Viết 1 trang CONVENTIONS.md trong backend/: 'JPA cho CRUD entity-centric, JdbcTemplate cho báo cáo/aggregate, mọi response mobile-facing phải là record DTO' — rồi enforce cho code MỚI (roadmap chấm công/lương sắp viết là chỗ áp dụng đầu tiên).

### A2-11. API path versioning trộn lẫn: /api/v2/teacher + /api/v2/teachers (số nhiều) giữa biển endpoint /api/* không version
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** grep @RequestMapping: 28 file dùng /api/v2/* nhưng chỉ trong domain teacher; tồn tại đồng thời "/api/v2/teacher" (3 controller) và "/api/v2/teachers" (1 controller); toàn bộ domain khác unversioned (/api/skill-tree, /api/ai-speaking ×3 controller chung prefix...).
- **Tác động:** Client web/mobile phải nhớ ngoại lệ từng domain; dễ gọi nhầm prefix khi thêm màn mới (đã từng: reports phải chuyển sang /api/v2/teacher/reports). Rối thêm khi viết OpenAPI codegen cho iOS.
- **Khuyến nghị:** Không đổi path đang chạy (breaking). Chốt quy ước: mọi endpoint MỚI dùng /api/<domain> singular, không thêm v2 mới; alias /api/v2/teachers → /api/v2/teacher nếu tiện. Ghi vào CONVENTIONS.md cùng finding trên.

### A2-12. Interview persona in-memory fallback quá hạn xóa 1 release — dual source of truth cho config persona
- **Mức độ:** 🟢 Thấp · **Tin cậy:** MEDIUM · **Effort:** 0.5 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/interview/service/PersonaRegistryService.java:18,66-84 javadoc nói in-memory registry 'remains authoritative … during the transition' và fallback parse-lỗi về in-memory pools; InterviewPersonaEntity.java:56 cùng ghi chú 'transition release'. Kế hoạch (V187, 2026-05-28) là xóa fallback ở release kế tiếp nếu warn log ngừng — nay 2026-07-03 vẫn còn.
- **Tác động:** Persona config tồn tại 2 nơi (DB + code): sửa DB mà fallback code cũ còn kích hoạt khi JSON lỗi → hành vi interview lẫn lộn giữa 2 nguồn, khó debug. Nợ nhỏ nhưng đúng loại 'để lâu quên hẳn'.
- **Khuyến nghị:** Check prod log 30 ngày: nếu không còn warn 'falling back to in-memory pools' thì xóa fallback + registry in-memory; nếu còn, fix data trước. SpeakingPersona.java 694 dòng cũng nên rà xem phần nào đã DB-hóa để cắt.

### A2-13. 4 tool CLI một-lần (2.100+ dòng, 62 System.out.println) sống trong src/main và đóng vào prod jar
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/util/: GoetheWiktionaryDeepEnricher.java 1162 dòng, GoetheSafeAutoCleaner.java 470, GoetheClassificationBackfill.java, VocabularyDataAudit.java — đều là class có public static void main(...) (không phải Spring bean), chứa toàn bộ 62 System.out.println của backend và nhiều catch(ignored) 'best-effort parsing'.
- **Tác động:** Không gây lỗi runtime (không được Spring load), nhưng phồng jar, phồng surface review/audit, và là mồi nhử cho AI-assistant copy pattern xấu (System.out, nuốt exception) vào code chạy thật. Đây cũng là lý do file-size top-10 backend bị nhiễu.
- **Khuyến nghị:** Di chuyển sang thư mục tools/ riêng (module Maven tách hoặc src/test/java) hoặc xóa hẳn nếu backfill đã chạy xong — dữ liệu đã ở DB, code một-lần không cần sống trong prod artifact.

### A2-14. Type-safety frontend rò rỉ: 82 chỗ ': any' + 34 ts-ignore/eslint-disable
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** grep frontend/src: 82 match ': any' và 34 match @ts-ignore/@ts-expect-error/eslint-disable trong ~105k dòng. Mobile sạch hơn đáng kể (apiMessage typed unknown, mobile/lib/api.ts:11).
- **Tác động:** Mật độ thấp so với quy mô (0,08%/dòng) nên chỉ là nợ nền; rủi ro chính là các 'any' nằm ở boundary API response — cùng gốc với vấn đề Map untyped backend: lỗi contract trượt qua cả 2 tầng type-check.
- **Khuyến nghị:** Không làm chiến dịch riêng. Quy tắc: mỗi PR chạm file có 'any' ở API boundary thì type hóa luôn chỗ đó; bật eslint rule no-explicit-any mức warn để chặn any mới.

**Docs-drift phát hiện trong trục này (4):**
- README.md (root, tracked trong git) mô tả SRS là 'spaced repetition (SM-2)' với интервалы 1/3/7/14/30 ngày — code thực tế là dual-algorithm router với FSRS-4.5 là primary, SM-2 chỉ còn legacy migrate-on-read (backend/src/main/java/com/deutschflow/srs/service/SrsService.java:23-31, FsrsWeightOptimizerService.java). Code là sự thật: README đang mô tả sai thuật toán lõi của sản phẩm.
- Javadoc PersonaRegistryService.java:18 và InterviewPersonaEntity.java:56 vẫn tuyên bố in-memory registry 'remains authoritative during the transition release' — transition đó (V187, 2026-05-28) đã qua hơn 1 tháng/nhiều release; doc trong code mô tả một trạng thái chuyển tiếp lẽ ra đã kết thúc.
- docs/ chứa hàng chục tài liệu phân tích đóng băng theo thời điểm (CODEBASE_ANALYSIS_v2.15.md, 'CLAUDE 2.md' bản trùng có dấu cách trong tên, AI_SPEAKING_*ебook…) nhưng hầu hết bị gitignore (chỉ 8 file tracked) — người/AI đọc repo local sẽ gặp tài liệu mô tả kiến trúc cũ mà không có cờ nào báo 'đã lỗi thời'. Đề xuất: thêm header OUTDATED hoặc dọn vào docs/archive/.
- Ghi chú tích cực (không phải drift nhưng cần nói rõ vì prompt yêu cầu kiểm tra): bug '@Async nuốt HTTP 400 của Groq JSON-mode làm AI grading kẹt SUBMITTED' mô tả trong tài liệu/memory cũ ĐÃ được fix triệt để trong code hiện tại — GradingService.java:369-393 và TeacherAiGradingService.java:124-142 nay persist status GRADING_FAILED kèm lý do, kèm comment giải thích đúng root cause tại chỗ.


## A3a Bảo mật AuthZ — điểm 4/5

**Tóm tắt:** Trục AuthN/AuthZ của DeutschFlow ở trạng thái tốt và đã trưởng thành qua nhiều đợt hardening. Cơ chế token: JWT stateless, ký HS256 mặc định (RS256 hỗ trợ sẵn), access-token TTL 15', refresh-token 7 ngày lưu DB có revoke + phát hiện tái sử dụng (theft detection revoke toàn session). Web lưu access trong sessionStorage + cookie mirror, refresh trong HttpOnly cookie SameSite=Strict path=/api/auth; mobile dùng expo-secure-store (Keychain). Phân quyền: @EnableMethodSecurity + @PreAuthorize (class/method) trên toàn bộ controller nhạy cảm; org-scoped role thực thi qua OrgGuard đọc org_members từ DB (KHÔNG tin claim orgRole trong JWT — claim chỉ để routing FE). SecurityConfig có allowlist permitAll rõ ràng + anyRequest().authenticated() fail-safe. IDOR: các endpoint teacher/org/cert đều re-verify ownership ở service layer (cert PDF có WHERE c.user_id=?, session truyền actor vào service assert, announce kiểm tra existsByIdClassIdAndIdTeacherId). Re-verify finding cũ: P-15/S-8 (gradeFree) ĐÃ VÁ — có honeypot + rate-limit per-IP 3/24h + global 200/24h + LLM gọi NGOÀI @Transactional; P-16 (AI image) ĐÃ VÁ — @PreAuthorize TEACHER/ADMIN + clamp count≤4 + OrgPoolGuard; PAY-1 (MoMo dummy) ĐÃ VÁ — IPN fail-closed khi secret rỗng/'dummy'. Rate-limit auth (login/register/refresh/reset) Redis Lua sliding-window shared, fallback in-memory an toàn. CORS env-driven (không wildcard), security headers đầy đủ (HSTS/XFO/CSP) cả BE lẫn next.config. Các điểm còn mở đều mức MEDIUM/LOW phòng thủ chiều sâu, không phải lỗ hổng khai thác trực tiếp.

### A3a-1. Mặc định ký HS256 → secret ký JWT bị chia sẻ sang môi trường frontend (Amplify)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 1 ngày
- **Bằng chứng:** backend/src/main/resources/application.yml:247 `algorithm: ${JWT_ALGORITHM:HS256}` mặc định HS256. JwtService.java:105-118 ký bằng HS256 secret khi alg!=RS256. Web middleware.ts:130-139 verify HS256 bằng `process.env.JWT_SECRET` — tức secret ĐỐI XỨNG vừa ký (backend EC2) vừa verify (Amplify) phải tồn tại ở cả 2 nơi. Không có application-prod.yml ghi đè algorithm=RS256 (chỉ 1 file application.yml). Toàn bộ đường RS256 đã code sẵn (JwtService.java:92-114, middleware.ts:119-128) nhưng chưa được kích hoạt bằng default.
- **Tác động:** Nếu env Amplify (frontend) rò rỉ JWT_SECRET, kẻ tấn công ký được token bất kỳ role kể cả ADMIN → chiếm toàn quyền. HS256 buộc secret ký hiện diện ở 2 mặt phẳng triển khai, gấp đôi bề mặt lộ. RS256 loại rủi ro này (FE chỉ cần public key).
- **Khuyến nghị:** Kiểm chứng biến JWT_ALGORITHM ở prod; nếu đang HS256, hoàn tất cutover RS256: đặt JWT_ALGORITHM=RS256 + JWT_RSA_PRIVATE_KEY (backend) + chỉ đẩy JWT_RSA_PUBLIC_KEY sang Amplify, rồi gỡ JWT_SECRET khỏi FE. Code đã sẵn sàng, chỉ là cấu hình + xoay khóa.

### A3a-2. Header X-Platform do client tự đặt cho phép rút refresh-token ra response body (phá HttpOnly)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** AuthController.java:74,92,126 `return isMobileRequest(httpRequest) ? authResp : stripRefreshToken(authResp)`; isMobileRequest (dòng 270-273) chỉ đọc header `X-Platform` == ios/android — không xác thực. /api/auth/refresh (dòng 101-127) đọc refresh-token từ HttpOnly cookie rồi, nếu X-Platform=ios, trả refresh-token MỚI trong body. Cookie SameSite=Strict chặn CSRF cross-site, nhưng script same-origin (XSS) gọi fetch('/api/auth/refresh',{headers:{'X-Platform':'ios'},credentials:'include'}) sẽ đọc được refresh-token — vô hiệu hoá lợi ích HttpOnly. CSP nonce hiện ở chế độ Report-Only trên route middleware (middleware.ts:203) nên phòng thủ XSS chưa cứng.
- **Tác động:** Kết hợp một lỗ XSS bất kỳ, kẻ tấn công đánh cắp refresh-token của người dùng web dù đã đặt trong HttpOnly cookie. Reuse-detection (AuthService.java:140-145) thu hẹp cửa sổ nhưng không loại bỏ hoàn toàn.
- **Khuyến nghị:** Với client web (không header hoặc origin trình duyệt) LUÔN strip refresh-token khỏi body bất kể X-Platform; chỉ trả body cho mobile khi có tín hiệu mạnh hơn (ví dụ app-attest/build-signed header) hoặc đơn giản để mobile cũng đọc từ cookie. Đồng thời đẩy CSP nonce sang enforced.

### A3a-3. AI image-gen bỏ qua quota token cá nhân & kiểm tra gói — TEACHER/ADMIN free vẫn sinh ảnh Bedrock
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** AiImageGenerationService.java:39-51 chỉ gọi `orgPoolGuard.assertOrgPoolAvailable(...)`; OrgPoolGuard.java:30-32 là NO-OP khi userId==null HOẶC user không thuộc org / org chưa cấu hình pool. KHÔNG hề gọi QuotaService.assertAllowed (ví token cá nhân) hay FreeTierGuard. Controller AiImageGenerationController.java:25 chỉ gate hasRole('TEACHER') or 'ADMIN'. Trái quyết định kinh doanh: AI chỉ dành Pro/trial, DEFAULT=0 token phải chạm paywall.
- **Tác động:** Giáo viên B2C (orgId null) hoặc org không pool sinh tối đa 4 ảnh Bedrock/request KHÔNG bị trừ token, KHÔNG kiểm tra subscription → rò COGS AI đắt + lệch mô hình 'AI = Pro-only'. Rủi ro tài chính, không phải chiếm quyền, và bị chặn ở mức role TEACHER/ADMIN nên phạm vi hẹp (~vài user).
- **Khuyến nghị:** Thêm `quotaService.assertAllowed(user.getId(), now, IMAGE_GEN_ESTIMATED_TOKENS_PER_IMAGE*count)` trước vòng lặp và ghi debit vào AiUsageLedger như PPTX/OCR để COGS thấy được; hoặc thêm FreeTierGuard cap ngày cho ảnh.

### A3a-4. permitAll '/api/quiz/*/join' và luồng guest-token là mã chết — bẫy permitAll tiềm ẩn
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** SecurityConfig.java:76 `auth.requestMatchers("/api/quiz/*/join").permitAll()` nhưng KHÔNG tồn tại QuizController nào (find -iname '*quiz*' chỉ ra DTO vocabulary). JwtService.generateGuestToken (dòng 170) không có caller ngoài chính nó; nhánh xử lý ROLE_GUEST trong JwtAuthFilter.java:104-119 do đó là dead-path.
- **Tác động:** Vô hại hiện tại, nhưng permitAll trên route chưa có controller là bẫy: nếu sau này ai đó thêm controller dưới /api/quiz/*/join, nó sẽ IM LẶNG thành public không auth. Tăng bề mặt tấn công/nhiễu khi audit.
- **Khuyến nghị:** Xoá dòng permitAll quiz/join, generateGuestToken và nhánh ROLE_GUEST trong JwtAuthFilter nếu tính năng quiz đã bỏ. Nếu còn kế hoạch dùng, để lại comment TODO gắn ticket.

### A3a-5. DiagnosticsController 'temporary — remove in production' vẫn còn triển khai
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** common/controller/DiagnosticsController.java:17-19 javadoc ghi 'Temporary diagnostic endpoint... Remove in production.' /api/diagnostics KHÔNG nằm trong allowlist permitAll nên rơi vào anyRequest().authenticated(): /time, /current-user (trả id/email/role/enabled của chính user), /jwt-config (trả TTL hardcode, không secret), /health đều yêu cầu đăng nhập; /validate-token đã gate ADMIN (dòng 48).
- **Tác động:** Rò rỉ thấp: mọi user đăng nhập đọc được current-user (dữ liệu của chính họ) + cấu hình TTL. Không lộ secret. Chủ yếu là vệ sinh mã & giảm bề mặt.
- **Khuyến nghị:** Xoá controller hoặc gate toàn bộ sau hasRole('ADMIN') trước khi phát hành App Store; ít nhất bỏ /jwt-config và /current-user trùng lặp với /api/auth/me.

### A3a-6. gradeFree (P-15/S-8) đã vá DoS nhưng vẫn chưa ghi AI-ledger — COGS mù (đã capped)
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** LeadMagnetService.java:62-108 XÁC NHẬN đã vá: không @Transactional quanh method (LLM gọi ngoài txn, dòng 111), honeypot (71-74), rate-limit per-IP 3/24h (99-103) + global 200/24h (104-108). TUY NHIÊN chỉ lưu MarketingLead (114) — KHÔNG gọi AiUsageLedgerService, nên chi phí Groq của luồng public không vào báo cáo COGS.
- **Tác động:** S-8 (cạn DB-pool) và rủi ro sập site ĐÃ được loại bỏ; chi phí worst-case bị chặn cứng ở 200 lượt/ngày. Điểm mù còn lại: COGS của lead-magnet không hiển thị trong ai-cost-summary. Tác động tiền nhỏ và có trần.
- **Khuyến nghị:** Ghi 1 dòng AiUsageLedger (attribution=FREE_GRADE_B1, không userId) mỗi lượt chấm để dashboard COGS phản ánh đủ. Không khẩn cấp.

**Docs-drift phát hiện trong trục này (4):**
- audit/full-2026-06-24/REMEDIATION.md liệt P-15/S-8, P-16, PAY-1 là 'Khắc phục — Ngay' và MEMORY.md [Full Audit] vẫn ghi chúng 'NEW open'. CODE cho thấy CẢ BA ĐÃ VÁ: gradeFree có rate-limit + LLM ngoài txn (LeadMagnetService.java:62-108); AI image gate TEACHER/ADMIN + clamp + OrgPoolGuard (AiImageGenerationController.java:25, AiImageGenerationService.java:45-51); MoMo IPN fail-closed khi secret 'dummy' (MomoPaymentService.java:329-333). Cập nhật memory: 3 mục này không còn mở.
- MEMORY.md [Full Audit 2026-06-24] ghi 'P-15/S-8 public gradeFree leak, P-16 AI img ungated' như still-open — thực tế đã remediated, chỉ còn residual mức LOW (thiếu AI-ledger ở gradeFree; thiếu quota cá nhân ở image-gen).
- JwtService.java:30-32 tham chiếu docs/security/RS256_MIGRATION_PLAN.md nhưng mặc định vẫn HS256 (application.yml:247); cần đánh dấu trạng thái cutover thực tế ở prod trong doc đó để tránh hiểu nhầm đã chuyển RS256.
- AuthController.java:90 comment '(Capacitor) native app' đã lỗi thời — app canonical hiện là Expo/mobile (SecureStore), Capacitor đã retire (xem authSession.ts:7-11).


## A3b Bảo mật Secrets/Payment/PII — điểm 3.5/5

**Tóm tắt:** TRỤC 1 (Secrets): SẠCH — .env/.env.local/.env.production/deutschflow-key.pem đều gitignored (git check-ignore khớp cả 4), git ls-files 0 match, git log --all --diff-filter=A rỗng → chưa từng bị commit. application.yml chỉ dùng ${ENV:} placeholder; docker-compose.prod.yml/amplify.yml không echo secret; docs/ không có pdf/xlsx tracked. Duy nhất PostHog public client key hardcode (chấp nhận được). Git history còn key MoMo sandbox CÔNG KHAI của MoMo docs (commit 5a39b8a4) — không phải secret thật. TRỤC 2 (Webhook): cả 4 provider đều đạt: MoMo IPN verify HMAC + fail-closed khi secret rỗng/"dummy" (PAY-1 ĐÃ FIX tại MomoPaymentService.java:328-335) + verify amount (SEC-9); SePay Apikey constant-time MessageDigest.isEqual + fail-closed + idempotent UNIQUE(sepay_id) V216 + chống re-pay invoice PAID/VOID + chống underpay; Stripe fail-closed khi thiếu webhook secret + atomic claim markSuccessIfNotAlready chống double-fulfillment + pg_advisory_xact_lock per-user; Apple /notifications permitAll nhưng JWS verify chain qua app-store-server-library + exactly-once theo notificationUUID + chống cross-account replay bằng appAccountToken. TRỤC 3: XÁC NHẬN SePay chỉ wired B2B org-invoice — SepayWebhookService chỉ match pattern DFINV+12hex vào org_invoices, kích hoạt Organization; frontend chỉ tham chiếu sepay trong orgApi.ts/admin settings; KHÔNG có đường student mua PRO → web billing "gói N ngày" cho student = việc MỚI. TRỤC 4 (NĐ13): audio speaking chỉ transcribe in-memory (không lưu S3); ảnh bài tay OCR in-memory; NHƯNG AccountDeletionService bỏ sót messages/class_channel_messages (FK non-cascading) → xóa tài khoản FAIL với học viên từng nhắn tin; không có age-gate/guardian consent; PostHog identify theo userId không được purge khi xóa. TRỤC 5: không tìm thấy SQL string-concat từ user input (các chỗ concat đều là constant/placeholder nội bộ); upload có cap 10MB + allowlist content-type audio; @Valid chỉ phủ 42/144 @RequestBody.

### A3b-1. Xóa tài khoản (DELETE /api/profile/me) FAIL với học viên từng nhắn tin hoặc đăng kênh lớp — vi phạm App Store 5.1.1(v) + NĐ13 quyền xóa dữ liệu
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 1 ngày · **Verify:** ✅ CONFIRMED
- **Bằng chứng:** backend/src/main/java/com/deutschflow/user/service/AccountDeletionService.java:27-44 chỉ pre-delete 5 bảng + teacher_sessions rồi DELETE users. Nhưng V228__messages.sql (messages.sender_id/recipient_id BIGINT NOT NULL REFERENCES users(id) — KHÔNG có ON DELETE) và V241__class_channel.sql (class_channel_messages.sender_id NOT NULL + deleted_by REFERENCES users(id) — KHÔNG có ON DELETE) được thêm SAU khi service này viết. MessageController.java:19-20 xác nhận học viên gửi/nhận tin nhắn; ClassChannelController.java:17 xác nhận học viên đăng kênh lớp. Không tìm thấy cleanup nào khác trước DELETE users (ProfileController.java:101-105 gọi thẳng deleteAccount).
- **Tác động:** Bất kỳ học viên nào từng nhắn tin với giáo viên hoặc đăng tin kênh lớp (tính năng P6 vừa merge #184) sẽ nhận 500 khi xóa tài khoản — FK violation rollback toàn bộ. Apple reviewer thường test delete-account; nếu dính là REJECT v1.0. Đồng thời không thực thi được quyền xóa dữ liệu NĐ 13/2023. Ngoài ra teacher/manager cũng bị block bởi materials.created_by, org_invitations.invited_by, class_lesson_logs.created_by (V227/V204/V208 — đều non-cascading).
- **Khuyến nghị:** Migration V243: ALTER các FK — messages.sender_id/recipient_id và class_channel_messages.sender_id → ON DELETE CASCADE (hoặc soft-anonymize: SET NULL + giữ nội dung ẩn danh cho counterpart); class_channel_messages.deleted_by → SET NULL. Với bảng audit (materials.created_by, invited_by, class_lesson_logs.created_by) thêm bước SET NULL trong AccountDeletionService. Viết 1 IT: tạo user + gửi message + post channel + delete account → expect 204 và 0 row còn lại. Sửa luôn javadoc của AccountDeletionService.
- **Ghi chú verify:** Đã xác minh trực tiếp, không bác bỏ được:

1. AccountDeletionService.java:29-35 chỉ pre-delete 5 bảng (b1_assessment_states, learner_phase_states, learning_review_items, grammar_feedback_events, placement_test_sessions) + teacher_sessions.student_id, rồi `DELETE FROM users WHERE id=?` (dòng 40-44). Javadoc claim "Remaining FKs cascade" đã lỗi thời.

2. V228__messages.sql:11-12: `sender_id`/`recipient_id BIGINT NOT NULL REFERENCES users(id)` — KHÔNG có ON DELETE (grep 'ON DELETE' trên file chỉ khớp teacher_classes trong V241). V241__class_channel.sql:16 `sender_id BIGINT NOT NULL REFERENCES users(id)` và :20 `deleted_by REFERENCES users(id)` — cũng không có ON DELETE. V241 là migration mới nhất (không có V242+ sửa FK), và không có `DELETE FROM messages`/`DELETE FROM class_channel_messages` nào khác trong backend/src.

3. ProfileController.java:101-105 gọi thẳng accountDeletionService.deleteAccount(user.getId()) — không có cleanup trung gian. Cả 2 controller messaging đều `@PreAuthorize("isAuthenticated()")` và javadoc xác nhận student dùng được (MessageController.java:20 teacher↔student; ClassChannelController.java:17 enrolled students post được).

⇒ Học viên từng gửi/nhận DM hoặc đăng kênh lớp sẽ dính FK violation khi DELETE users → transaction rollback → 500, đúng như finding. Các FK phụ (materials.created_by V227:17 NOT NULL, org_invitations.invited_by V204:37 NOT NULL, class_lesson_logs.created_by V208:11) cũng đã xác minh là non-cascading — chặn xóa tài khoản teacher/manager.

Severity CRITICAL hợp lý: endpoint này tồn tại chính vì App Store 5.1.1(v) (javadoc tự ghi), P6 channel vừa merge vào main, và mọi học viên active có nhắn tin đều không thể xóa tài khoản. Lưu ý nhỏ: user chỉ fail nếu ĐÃ có message/channel row, và Apple reviewer test bằng account mới có thể chưa nhắn tin — nhưng vi phạm quyền xóa dữ liệu với user thật là chắc chắn.

### A3b-2. Apple IAP bundle-id mặc định sai (com.deutschflow.app ≠ com.cudinh.mydeutschflow) — IAP chết toàn bộ nếu quên set env khi launch
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ✅ CONFIRMED → hạ mức HIGH
- **Bằng chứng:** backend/src/main/java/com/deutschflow/payment/apple/AppleJwsVerifier.java:41 default payment.apple.bundle-id=com.deutschflow.app, trong khi mobile/app.json:26 bundleIdentifier=com.cudinh.mydeutschflow. Thêm nữa: environment default Sandbox (dòng 47) và Production BẮT BUỘC payment.apple.app-apple-id (dòng 73-76, thiếu là verifier tự disable), root-cert-dir rỗng cũng disable verifier (dòng 61-64).
- **Tác động:** SignedDataVerifier verify JWS theo bundleId — bundle-id sai làm MỌI giao dịch /verify /sync /notifications bị reject hoặc verifier disabled → user trả tiền qua Apple nhưng không được kích hoạt PRO. Đây là blocker cấu hình đã biết trong plan nhưng nay xác nhận thêm 3 env liên đới (bundle-id, app-apple-id, environment, root-cert-dir) chứ không chỉ 1.
- **Khuyến nghị:** Trước khi submit: set đủ 4 env prod (PAYMENT_APPLE_BUNDLE_ID=com.cudinh.mydeutschflow, app-apple-id số từ ASC, environment=Production, root-cert-dir chứa Apple Root CA .cer) + đổi luôn default trong application.yml thành bundle id thật để fail-safe. Thêm 1 dòng vào health/startup log check (đã có log.warn — nâng thành item trong checklist deploy). Kèm V242 align apple_products IDs như plan.
- **Ghi chú verify:** Đã tự xác minh toàn bộ bằng chứng trên main:

1. Default bundle-id sai: `AppleJwsVerifier.java:41-42` — `@Value("${payment.apple.bundle-id:com.deutschflow.app}")`, và `application.yml:529` — `bundle-id: ${APPLE_BUNDLE_ID:com.deutschflow.app}`. Trong khi `mobile/app.json:26` — `"bundleIdentifier": "com.cudinh.mydeutschflow"`. Mismatch có thật.

2. 3 env liên đới đúng như nêu: `root-cert-dir` rỗng (default rỗng, yml:532) → verifier disable với log.warn (AppleJwsVerifier init, dòng 63-70); `environment` default Sandbox (yml:531, verifier dòng 47-48); Production BẮT BUỘC `app-apple-id` không thì disable (verifier dòng 74-77).

3. Tác động đúng: `AppleIapService.doVerifyAndActivate` (dòng 66-80) — verifier disabled → IllegalStateException "Apple IAP is not configured"; bundleId sai → `SignedDataVerifier` (Apple app-store-server-library) ném VerificationException INVALID_APP_IDENTIFIER cho MỌI JWS → map thành "Invalid Apple transaction." → user trả tiền qua Apple nhưng không activate PRO. Comment tại dòng 76 tự xác nhận: "SignedDataVerifier also enforces bundleId + environment; throws on mismatch."

Điểm giảm nhẹ (không đủ hạ severity): lỗi fail LOUD (log.warn + exception) chứ không silent, và root-cert-dir rỗng mặc định nghĩa là hiện tại verifier vốn disabled — nên bug chỉ bùng phát khi launch mà set thiếu/sai env. Nhưng đúng như finding nói, đây là blocker cấu hình đã biết (khớp plan APP_STORE_LAUNCH), hậu quả là "paid nhưng không nhận entitlement" cho 100% giao dịch iOS → HIGH là hợp lý cho review launch-readiness. Lưu ý phân loại: đây là lỗi cấu hình/availability payment, không phải lỗ hổng bảo mật/leak — nhưng nằm trong nhóm Payment nên chấp nhận được.

### A3b-3. Không có xử lý minor (<16 tuổi) theo NĐ 13/2023 — không age-gate, không guardian consent, không thu birthdate
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1.5 ngày · **Verify:** 🟨 PARTIAL → hạ mức MEDIUM
- **Bằng chứng:** backend/src/main/java/com/deutschflow/user/dto/RegisterRequest.java chỉ có email/phone/password/displayName/locale — không có ngày sinh. OnboardingProfileRequest.java:16 chỉ có ageRange tự khai (optional, không gate). Grep 'terms|điều khoản|consent|tuổi' trong frontend/src/app/register và mobile/app/(auth)/ không có checkbox điều khoản hay age-gate nào.
- **Tác động:** NĐ 13/2023 (Điều 20) yêu cầu xử lý dữ liệu trẻ em (<16 tuổi theo Luật Trẻ em) phải có sự đồng ý của cha mẹ/người giám hộ + xác minh tuổi. App học tiếng Đức tại VN chắc chắn có học viên cấp 2-3 (<16), nhất là kênh B2B trung tâm. Hiện không có cơ chế nào — rủi ro pháp lý khi phát hành dưới tư cách CÁ NHÂN (chịu trách nhiệm trực tiếp). Apple cũng yêu cầu khai age rating khớp thực tế.
- **Khuyến nghị:** Mức tối thiểu khả thi cho v1.0: (1) thêm checkbox 'Tôi từ 16 tuổi trở lên hoặc có sự đồng ý của cha mẹ/người giám hộ' + link Privacy Policy vào register web/mobile (lưu consented_at vào users); (2) Privacy Policy (đã có draft plans/appstore/) ghi rõ mục dữ liệu trẻ em; (3) set App Store age rating phù hợp. Xác minh tuổi đầy đủ để phase sau.
- **Ghi chú verify:** Phần lõi của finding ĐÚNG, nhưng bằng chứng có 2 điểm sai đáng kể.

XÁC NHẬN ĐÚNG:
1. backend/src/main/java/com/deutschflow/user/dto/RegisterRequest.java:8-29 — chỉ email/phoneNumber/password/displayName/locale, không có ngày sinh.
2. OnboardingProfileRequest.java: ageRange là String tự khai, optional (UserLearningProfileService.java:51-53 cho phép null/blank). Enum tại UserLearningProfile.java:146 chỉ có UNDER_18/18_24/... — thậm chí không phân biệt được <16 (ngưỡng trẻ em theo NĐ 13), và không có logic gate nào dùng giá trị này.
3. Không có cột consent nào trong migration: grep terms_accepted/consented_at trên db/migration chỉ khớp V194 (upsell opt-in email, không liên quan). Backend không nhận/lưu consent lúc đăng ký.
4. Không có cơ chế guardian consent hay xác minh tuổi ở bất kỳ đâu.

BẰNG CHỨNG SAI/THIẾU trong finding:
1. Mobile CÓ checkbox điều khoản gate submit: mobile/app/(auth)/register.tsx:36 (Alert chặn nếu chưa tick) + dòng 170-195 (checkbox "Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật"). Web v2 register cũng có dòng đồng ý ngầm (frontend/src/app/v2/register/page.tsx:168, dù link href="#" placeholder). Khẳng định "không có checkbox điều khoản nào" là sai với mobile — chỉ đúng là consent này client-side, không gửi/lưu backend.
2. Privacy Policy draft ĐÃ có mục Children (plans/appstore/PRIVACY_POLICY.md:80-82, 171-173) — nhưng viết theo chuẩn COPPA "dưới 13 tuổi", chưa khớp ngưỡng <16 của NĐ 13/2023. Ngoài ra MONETIZATION_TECH_PLAN.md:172 đã plan `tagForUnderAgeOfConsent: true` + maxAdContentRating 'T' cho ads — có ý thức về minor ở tầng quảng cáo.

Kết luận: gap thực = (a) không age-gate/không birthdate/không guardian consent, (b) consent điều khoản không được lưu server-side (không consented_at), (c) Privacy draft dùng ngưỡng 13 thay vì 16. Nhưng mức độ "hoàn toàn không có cơ chế nào" là thổi phồng: đã có terms checkbox mobile + Children clause + kế hoạch tagForUnderAgeOfConsent. Đây là rủi ro tuân thủ pháp lý (không phải lỗ hổng kỹ thuật khai thác được), có mitigation một phần → hạ HIGH → MEDIUM.

### A3b-4. Xóa tài khoản không xóa dữ liệu cá nhân trên PostHog (external processor) — hở quyền xóa NĐ13
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** frontend/src/hooks/useTracking.ts:24 posthog.identify(userId, traits) và mobile/lib/analytics.ts:66 posthog?.identify(String(id), props) — analytics định danh theo userId thật. AccountDeletionService.java chỉ xóa DB nội bộ, không có call nào tới PostHog delete-person API (grep 'posthog' trong backend = 0).
- **Tác động:** Sau khi user xóa tài khoản, toàn bộ event history + person profile (kèm traits có thể chứa email/tier) vẫn nằm trên PostHog Cloud → quyền xóa dữ liệu NĐ13 không trọn vẹn; nếu bị khiếu nại thì không có đường xử lý.
- **Khuyến nghị:** Thêm bước async trong deleteAccount: gọi PostHog API DELETE /api/projects/:id/persons/ (hoặc đưa vào hàng đợi/ghi log userId cần purge chạy tay hàng tuần — chấp nhận được với ~7 user). Ghi rõ retention analytics trong Privacy Policy. Đồng thời cân nhắc tắt gửi email vào person properties.

### A3b-5. SePay cho student 'gói N ngày' = việc MỚI hoàn toàn — code hiện chỉ settle org-invoice B2B (xác nhận)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 4 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/payment/service/SepayWebhookService.java:43 chỉ match pattern DFINV[0-9A-F]{12} → org_invoices.payment_code (V216), kích hoạt Organization + activateEntitlements. Grep 'sepay' toàn backend chỉ ra organization/*; frontend chỉ có orgApi.ts + v2/admin/settings; mobile = 0. Không tồn tại bảng/đường student order VietQR nào.
- **Tác động:** Kế hoạch kinh doanh đã chốt 'web billing = SePay gói N ngày' cho student nhưng chưa có dòng code nào: cần bảng student order + payment-code riêng (không đụng DFINV), match trong webhook, kích hoạt subscription N ngày qua SubscriptionActivationService, và UI hiện QR. Nếu không ước lượng đúng sẽ lệch timeline tháng 7.
- **Khuyến nghị:** Tái dùng skeleton SePay sẵn có: thêm prefix code mới (vd DFSTU+12hex) vào PAYMENT_CODE matcher với nhánh xử lý student_orders; tạo bảng student_payment_orders (user_id, plan_days, amount, code, status) + activatePlanDays; giữ nguyên idempotency sepay_id. Ước lượng 3-4 ngày gồm UI QR + test webhook thật.

### A3b-6. @Valid chỉ phủ 42/144 @RequestBody endpoint (~29%) — validation biên không đồng đều
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** grep '@RequestBody' backend/src/main/java = 144 vị trí, trong đó chỉ 42 có @Valid đi kèm. Ví dụ có @Valid: MomoPaymentController.java:34, ProfileController push-token:92. Ví dụ KHÔNG có: AppleIapController.java:54 (AppleVerifyRequest jws không giới hạn size), StripePaymentController.java:37 (CreateStripeSessionRequest).
- **Tác động:** Không phải lỗ injection (JPA + parameterized query phủ tốt, không tìm thấy string-concat SQL từ user input), nhưng payload không ràng buộc cho phép field rỗng/quá dài đi sâu vào service — lỗi 500 thay vì 400, log rác, và DTO như jws có thể nhận chuỗi lớn tùy ý (đã có cap multipart 10MB nhưng JSON body theo default server limit).
- **Khuyến nghị:** Không cần sửa cả 144. Ưu tiên thêm @Valid + constraint (@NotBlank, @Size) cho các endpoint state-changing công khai với client: payments/*, auth/*, profile/*, messaging/*. Khoảng 20 endpoint trọng yếu, làm dần theo module.

### A3b-7. Encryption at rest chưa xác minh được: S3 không set SSE tường minh, RDS không rõ storage_encrypted
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** LOW · **Effort:** 0.5 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/media/service/S3StorageService.java:46-54,75-83 PutObjectRequest không set serverSideEncryption (dựa vào bucket default — AWS mã hóa SSE-S3 mặc định cho object mới từ 1/2023 nên khả năng cao vẫn được mã hóa). RDS t4g.micro: không có IaC trong repo để xác minh StorageEncrypted — GIẢ ĐỊNH/CẦN KIỂM CHỨNG. Lưu ý giảm nhẹ: audio speaking và ảnh OCR xử lý in-memory, không lưu S3 (grep s3/upload trong speaking/ và HandwritingOcrService = 0), nên PII media thực tế rất ít.
- **Tác động:** NĐ13 yêu cầu 'biện pháp bảo vệ' dữ liệu cá nhân — DB chứa email/phone/transcript học viên trên RDS không mã hóa sẽ là điểm trừ khi có sự cố. RDS không thể bật encryption in-place (phải snapshot-restore).
- **Khuyến nghị:** Kiểm tra 5 phút bằng AWS console/CLI: aws rds describe-db-instances --query StorageEncrypted và aws s3api get-bucket-encryption. Nếu RDS chưa mã hóa: snapshot → copy-snapshot --kms → restore (downtime ~15-30 phút, làm lúc vắng user). Bật Block Public Access cho bucket nếu chưa.

### A3b-8. MoMo IPN: so sánh chữ ký non-constant-time + race read-check-set có thể double-activate (Stripe đã fix pattern này, MoMo chưa)
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** MomoPaymentService.java:354 expectedSignature.equalsIgnoreCase(receivedSignature) — không dùng MessageDigest.isEqual như SePay. MomoPaymentService.java:177-198 handleIpn đọc tx → check status → fulfill, không có atomic claim; đối chiếu StripePaymentService.java:196-227 đã chuyển sang markSuccessIfNotAlready chính vì race này (comment P0-2 tail). pg_advisory_xact_lock trong activatePlan chỉ serialize chứ không dedupe.
- **Tác động:** Thấp vì (a) MoMo đã hoãn theo quyết định kinh doanh, (b) fail-closed khi chưa cấu hình secret, (c) timing attack trên HMAC hex qua mạng gần như bất khả thi. Chỉ thành vấn đề nếu bật lại MoMo: 2 IPN đồng thời có thể cộng 2 lần duration.
- **Khuyến nghị:** Khi nào bật lại MoMo mới cần sửa: đổi equalsIgnoreCase → MessageDigest.isEqual (normalize case trước) và port pattern markSuccessIfNotAlready từ Stripe sang handleIpn. Không làm bây giờ.

### A3b-9. PostHog project key hardcode trong file tracked (app.json + seed script)
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** mobile/app.json:133 và frontend/scripts/seed-posthog.mjs:7 cùng chứa phc_vFERGwkAxSWCTagc39wk3uevgueqhZsXvjcc5dDSKoHB.
- **Tác động:** phc_ là public client key theo thiết kế PostHog (bắt buộc ship trong app binary) — KHÔNG phải secret leak. Rủi ro thực: người biết key có thể bơm event rác/đọc feature flags. Repo đang private nên gần như 0.
- **Khuyến nghị:** Không cần rotate. Dọn nhẹ: seed-posthog.mjs đọc key từ env thay vì hardcode để tránh thói quen; app.json giữ nguyên (client key phải nằm trong bundle).

### A3b-10. Git history chứa key MoMo sandbox công khai đã từng hardcode (đã gỡ)
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0 ngày
- **Bằng chứng:** git log -S 'F8BBA842ECF85' tìm thấy commits 57ab5c0d, 5a39b8a4, 5c7e59f7 — key sandbox công khai trong tài liệu MoMo từng nằm trong source, đã gỡ ở fix '5a39b8a4 fix(security): close P0 backend vulnerabilities'. MomoPaymentService.java:73-77 còn log.warn nhắc rotate. docker-compose.prod.yml lịch sử (072d42b5) chỉ chứa ${JWT_SECRET} reference — không có giá trị thật.
- **Tác động:** Key này là key test công khai của MoMo docs, không gắn tài khoản tiền thật; repo private từ 2026-06-02. Rủi ro thực tế ~0. Chỉ cần đảm bảo khi ký hợp đồng MoMo production sẽ dùng key mới hoàn toàn.
- **Khuyến nghị:** Không cần rewrite history. Ghi chú vào checklist 'khi bật MoMo production: cấp key mới, không tái dùng bất kỳ key nào từng xuất hiện trong repo'.

### A3b-11. S3 uploadFile lấy extension từ filename người dùng không sanitize — key S3 có thể chứa ký tự lạ
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** S3StorageService.java:35-44: extension = originalFilename.substring(lastIndexOf('.')) rồi ghép vào s3Key = folder + '/' + UUID + extension — extension có thể chứa '/' hoặc ký tự điều khiển nếu filename dị dạng (vd 'a.bar/baz').
- **Tác động:** Không có path traversal filesystem (S3 key phẳng), endpoint gated TEACHER/ADMIN (MediaController.java:31,40), multipart cap 10MB. Tệ nhất là object nằm sai 'folder' prefix hoặc content-type spoof khi serve public URL.
- **Khuyến nghị:** Sanitize extension bằng allowlist regex ^\.[a-zA-Z0-9]{1,8}$ (fallback bỏ extension) + allowlist content-type ảnh/audio/pdf khi upload media. 30 phút.

**Docs-drift phát hiện trong trục này (4):**
- audit/full-2026-06-24 + memory dự án vẫn ghi 'PAY-1 MoMo dummy secret' là OPEN, nhưng code đã fix fail-closed (MomoPaymentService.java:328-335 reject IPN khi secret rỗng/'dummy'; REMEDIATION.md:34 đã đánh 'Khắc phục') — trạng thái đúng: PAY-1 CLOSED trong code, chỉ còn verify env prod.
- Javadoc AccountDeletionService.java:10-15 tuyên bố 'Permanently deletes... all associated data' và 'Most child tables... ON DELETE CASCADE' — đã drift so với schema: V228 (messages) và V241 (class_channel_messages) thêm FK non-cascading SAU khi service này viết, khiến claim sai và deletion fail (xem finding CRITICAL).
- Memory/plan App Store ghi 'delete-account DONE (verified)' — chỉ đúng tại thời điểm verify (trước V241 class channel merge #184); sau P6 thì delete-account hỏng với user có hoạt động messaging. Cần cập nhật checklist launch.
- Comment SepayWebhookController.java:19 'Fails closed when no key is set' — KHỚP code (không drift), ghi nhận để đối chiếu: đây là điểm docs đúng.


## A4 Hiệu năng & scale — điểm 3.5/5

**Tóm tắt:** Audit trục A4 trên backend Spring Boot (EC2 t3.medium + RDS t4g.micro 1GB). (1) N+1: codebase sạch bất ngờ — chỉ 2 @OneToMany toàn repo, GrammarCase/Grading/Notification đều đã batch; còn sót ClassScheduleService đếm học viên 1 COUNT/lớp và StudentDashboard load toàn bộ session rồi lọc tuần trong Java. (2) Index: đối chiếu 241 migration — các bảng nóng (ai_token_usage_events V188+V218+V223, user_subscriptions V38, user_notifications V175, srs V110/V152, org counter V224) đều có index đúng truy vấn; docs/DATABASE_SCHEMA.md là tài liệu MySQL từ tháng 4, đã chết hoàn toàn so với PostgreSQL thực tế. (3) Cache: Caffeine L1 (TTL 5m–24h) + Redis L2 opt-in, nhưng L2 TTL đồng loạt 7 ngày phá vỡ ý đồ TTL của L1 sau mỗi blue-green; không @Cacheable nào bật sync=true → stampede trên /api/words (đường đọc nóng nhất theo chính docs). Hikari 20/Tomcat 48 đã tính đúng cho 2 vCPU. (4) AI/TTS: Groq blocking có semaphore+breaker+retry 5× đầy đủ; đường STREAMING (AI Speaking) không có breaker, timeout 120s; XTTS ngrok ephemeral không breaker/retry (degrade êm về text-only); edge-tts có cache 24h. (5) Capacity ước lượng: ~100 CCU duyệt nội dung là khả thi trên giấy sau P1-6 nhưng CHƯA đo (checklist k6 Đợt B/C/D còn trống); nghẽn đầu tiên khi scale org = 5 phiên Groq chat đồng thời (lớp 30 người nói cùng lúc sẽ bị dội), sau đó là RDS 1GB RAM rồi pool 20. (6) Token-pool org: ĐÃ enforce thật (QuotaService.assertAllowed:85 → OrgQuotaService.wouldExceedOrgPool, counter atomic V224, fail-safe pool=0→cap V237) — 'margin risk #1' trong GTM plan đã được xử lý, chỉ còn overage bounded do soft-cap race P-9 (có chủ đích, có log marker).

### A4-1. Capacity chưa được kiểm chứng bằng k6 trước làn sóng App Store tháng 7 — checklist 100 CCU còn dở Đợt B/C/D
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1 ngày · **Verify:** ✅ CONFIRMED
- **Bằng chứng:** docs/LOAD_TEST_100CCU_CHECKLIST.md (Đợt B ⬜ 0/6, C 🟡 1/5, D ⬜ 0/4 — ramp/spike chưa từng chạy); scripts/loadtest/README.md tự dự đoán điểm gãy số 1 = 'hikaricp_connections_pending, pool max 20'; lịch sử P0 pool exhaustion 2026-06-13 (memory + comment application.yml:72-79). Hạ tầng: EC2 t3.medium 2vCPU/4GB + RDS t4g.micro 1GB (docs/LOAD_TEST_100CCU_CHECKLIST.md header).
- **Tác động:** Launch App Store có thể tạo đợt đăng ký/duyệt nội dung đột biến; nếu điểm gãy thực tế thấp hơn ước lượng (~100 CCU trên giấy), lặp lại sự cố 503 kiểu 12-13/06 đúng tuần review/ra mắt — tổn hại rating và bị Apple reject vì app không load được.
- **Khuyến nghị:** Trước khi submit: chạy đúng bộ script có sẵn (baseline.js → dashboard-mix.js → login-storm.js) vào staging hoặc prod khung 2-4h sáng, theo dõi hikaricp_connections_pending + RDS FreeableMemory như README hướng dẫn. Chỉ cần PASS 100 CCU dashboard-mix là đủ tự tin cho v1.0 (7 user hiện tại → trần 100 là dư 10×).
- **Ghi chú verify:** Đã tự xác minh mọi bằng chứng nêu ra:

1. **Checklist đúng như trích dẫn** — `docs/LOAD_TEST_100CCU_CHECKLIST.md` bảng trạng thái: Đợt B ⬜ 0/6, C 🟡 1/5, D ⬜ 0/4 (dòng 10-13). Toàn bộ 4 bước Đợt D (baseline → ramp → spike → soak) đều `[ ]` chưa chạy; mục "Ghi kết quả" (dòng 96) trống. `git log` không có commit nào ghi kết quả test sau 2026-06-13 — chỉ có commit `d98b9b9d` thêm script. Nghĩa là **chưa từng có phép đo k6 nào được thực hiện**, khớp memory ("k6 ramp/spike never vs live prod").

2. **Pool max 20 đúng** — `backend/src/main/resources/application.yml:79` `maximum-pool-size: ${DB_POOL_MAX_SIZE:20}`, kèm comment cảnh báo blue-green chạy 2 JVM → peak 2× pool vs RDS max_connections.

3. **README tự dự đoán điểm gãy** — `scripts/loadtest/README.md` mục "Đọc kết quả": "`hikaricp_connections_pending > 0` … = đã chạm trần DB pool (max 20). Đây là điểm gãy số một được dự đoán."

4. **Hạ tầng đúng** — header checklist xác nhận EC2 t3.medium + RDS db.t4g.micro 1GB, và lịch sử P0 thật (503 ở ~5–10 CCU, 12-13/06) được ghi ngay trong file.

Điểm giảm nhẹ duy nhất (không đủ để hạ verdict): các fix Đợt 1/2/2.3 (async telemetry, cache, circuit breaker, Tomcat 48) đã merge PR #113 và backend đã deploy nhiều lần sau đó (gần nhất 2026-07-01), nên prod KHÔNG còn là bản gãy ở 5–10 CCU. Nhưng finding không claim prod đang gãy — nó claim capacity **chưa được kiểm chứng bằng đo đạc**, và điều đó đúng 100%: hệ thống từng có P0 pool exhaustion thật, fix chưa từng được xác nhận bằng tải, và điểm gãy mới chưa biết trước launch App Store. HIGH là hợp lý cho một finding launch-readiness (không phải CRITICAL vì có mitigation đã deploy và base user hiện tại chỉ ~7).

### A4-2. Đường Groq STREAMING (AI Speaking — hot path) không có circuit breaker, khác với đường blocking
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ✅ CONFIRMED
- **Bằng chứng:** backend/src/main/java/com/deutschflow/speaking/ai/GroqChatClient.java: blocking path bọc circuitBreakers.call tại dòng 101; streaming path (chatCompletionStream, dòng 174-192) gọi webClient trực tiếp, chỉ có .timeout(120s) + done.await(125s), không qua breaker. speakingStreamExecutor max 20 thread, queue 40 (application.yml:325-327).
- **Tác động:** Khi Groq treo (không phải chết hẳn), MỖI lượt nói giữ 1 thread stream executor tới 120s. 20 thread + queue 40 cạn trong ~1 phút giờ cao điểm → toàn bộ user AI Speaking (tính năng trả tiền PRO) nhận lỗi chậm thay vì fail-fast, trong khi blocking path đã fail-fast từ lâu. Không nhất quán chính là lỗ hổng đã được vá một nửa ở Đợt 2.3.
- **Khuyến nghị:** Bọc phần subscribe stream trong circuitBreakers.call('groqChat', ...) (cùng breaker với blocking để chia sẻ trạng thái mở/đóng), hoặc tối thiểu check breaker state trước khi mở stream. ~20 dòng code + 1 test.
- **Ghi chú verify:** Đã tự xác minh trực tiếp trên code, finding đứng vững:

1. Blocking path CÓ breaker: GroqChatClient.java:101-104 gọi `circuitBreakers.call("groqChat", ...)` với fallback fail-fast ("AI đang quá tải...").
2. Streaming path KHÔNG có breaker: GroqChatClient.java:174-208 (`chatCompletionStream`) gọi `webClient.post()...subscribe()` trực tiếp, chỉ có `.timeout(Duration.ofSeconds(120))` (dòng 182) + `done.await(125s)` (dòng 192). Không có bất kỳ tham chiếu `circuitBreakers` nào trong method này — breaker instance `groqChat` đã được cấu hình sẵn (application.yml:555-556) nhưng không được dùng, và lỗi stream không bao giờ feed vào trạng thái breaker.
3. Hot path xác nhận: SpeakingStreamService.java:111 chạy chat stream trên `speakingStreamExecutor` (core 8 / max 20 / queue 40, application.yml:325-327 đúng như finding trích).

Nuance nhỏ (không đủ để hạ verdict): streaming CÓ chia sẻ semaphore `GroqConcurrencyLimiter` với blocking (GroqChatClient.java:159; 5 permit chat, tryAcquire timeout 90s — application.yml:349,351). Semaphore giới hạn tối đa 5 stream treo đồng thời, NHƯNG không fail-fast: khi 5 permit bị stream treo giữ 120-125s, mỗi request mới vẫn block 90s trong `tryAcquireChat()` NGAY TRÊN thread của speakingStreamExecutor rồi mới lỗi. Tức mỗi thread executor vẫn bị giữ ~90-125s/request → 20 thread + queue 40 vẫn cạn trong vài phút cao điểm, đúng bản chất tác động nêu ra (chỉ khác chi tiết: đa số thread chết ở chỗ chờ semaphore 90s thay vì stream 120s). Ngược lại ở blocking path, breaker mở → fail ngay → permit trả lại tức thì → semaphore không nghẽn. Sự bất đối xứng đúng như finding mô tả. Severity HIGH hợp lý.

### A4-3. XTTS sidecar qua ngrok ephemeral = SPOF thoại; không breaker/retry, chết âm thầm
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1.5 ngày · **Verify:** 🟨 PARTIAL → hạ mức MEDIUM
- **Bằng chứng:** application.yml:386-391 (XTTS_BASE_URL default rỗng, ngrok-skip-warning:true, read-timeout 15s); XttsStreamClient.java:90-93 nuốt mọi exception trả null (degrade text-only); SpeakingTtsPipeline.java:73-83 synthesize TUẦN TỰ từng câu (chain). Không có health-check/metric/breaker cho XTTS. Memory xác nhận XTTS_BASE_URL=ngrok 'ephemeral→fixed host' còn treo từ 2026-06-15.
- **Tác động:** Ngrok free rotate URL mỗi lần restart máy chạy XTTS → giọng nói AI Speaking chết không cảnh báo (chỉ WARN log), user PRO trả tiền mất tính năng chủ lực mà ops không biết. Tệ hơn: host 'sống nhưng treo' làm mỗi câu chờ 15s read-timeout NỐI TIẾP nhau — 1 lượt nói 5 câu = 75s giữ thread executor.
- **Khuyến nghị:** Trước launch: (a) chuyển XTTS sang host/domain cố định (Cloudflare Tunnel named tunnel miễn phí, hoặc IP máy + DNS) — 0.5 ngày; (b) thêm counter Micrometer xtts_synthesize_failures + alert; (c) bọc CircuitBreakers 'xtts' để host treo chỉ đau 1-2 câu đầu rồi skip nhanh.
- **Ghi chú verify:** Các fact kỹ thuật ĐÚNG, nhưng severity HIGH bị thổi phồng vì bỏ qua các mitigation có chủ đích.

Xác nhận được:
- application.yml:386-391: XTTS_BASE_URL default rỗng, ngrok-skip-warning:true, read-timeout 15s / connect 3s — đúng như nêu.
- XttsStreamClient.java:90-93: catch (Exception) → log.warn + return null, không metric — đúng.
- SpeakingTtsPipeline.java:70: `chain = chain.thenRunAsync(...)` — synthesize tuần tự từng câu, đúng. Host "sống nhưng treo" → mỗi câu chờ 15s nối tiếp; 5 câu ≈ 75s.
- Không có CircuitBreaker cho XTTS: grep cho thấy CircuitBreakers chỉ dùng ở AIModelService/GroqChatClient/GroqWhisperClient, không có trong package speaking/tts. Không có Micrometer counter/health-check nào trong tts/ (grep rỗng).
- SpeakingStreamService.java:200: `ttsPipeline.drain().whenComplete(completeQuietly(emitter))` — SSE emitter bị giữ mở tới khi chain xong, nên kịch bản treo 75s có thật (giữ mở emitter + 1 thread xtts).

Điểm bác bỏ / giảm nhẹ:
1. "Giữ thread executor" gây hại chung là SAI ngữ cảnh: XttsConfiguration.java tạo pool RIÊNG `xttsTtsExecutor` (core 4/max 12/queue 48) tách khỏi speakingStreamExecutor; javadoc ghi rõ "a hung XTTS call must not pin a thread" cho LLM pump. Text vẫn stream đầy đủ, chỉ audio + thời điểm đóng SSE bị ảnh hưởng.
2. "User PRO mất tính năng chủ lực" quá đà: theo javadoc XttsStreamClient (dòng 18-20) và comment application.yml:383-384, khi XTTS chết client fallback edge-tts/on-device speech — mất giọng persona chất lượng cao, KHÔNG mất AI Speaking. Đây là graceful degrade có thiết kế, không phải "chết".
3. Kịch bản ngrok rotate: URL cũ chết thường trả lỗi nhanh (connect 3s hoặc 404 từ edge ngrok), không phải 15s/câu; kịch bản 75s chỉ xảy ra với host reachable-nhưng-treo, hẹp hơn nhiều so với mô tả.

Phần đứng vững: không có observability (chỉ WARN log) → ops không biết voice degrade; không breaker → host treo vẫn đau ~15s/câu tuần tự; ngrok ephemeral vẫn là nợ ops từ 2026-06-15. Đáng fix trước launch nhưng ở mức MEDIUM (degradation chất lượng có fallback + blast radius bị cô lập bằng pool riêng + timeout), không phải HIGH.

### A4-4. Trần cứng 5 phiên Groq chat đồng thời + semaphore chờ 90 giây — nghẽn ĐẦU TIÊN khi scale org B2B
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ✅ CONFIRMED → hạ mức HIGH
- **Bằng chứng:** application.yml:349-351 (GROQ_MAX_CONCURRENT_CHAT:5, GROQ_MAX_CONCURRENT_WHISPER:4, GROQ_SEMAPHORE_ACQUIRE_SEC:90). GroqChatClient.java:94-97: tryAcquireChat block tới 90s TRƯỚC khi trả 'AI service is busy'. Mọi luồng LLM (speaking, chấm bài, mock exam eval) chung semaphore chat.
- **Tác động:** Kịch bản GTM chuẩn (1 lớp 25-30 học viên cùng làm AI Speaking / thi thử có chấm AI) → chỉ 5 request chạy, số còn lại XẾP HÀNG 90 giây ôm thread rồi mới lỗi. Với Tomcat 48 thread, 30 request AI treo 90s chiếm 60%+ pool thread → ảnh hưởng lan sang cả user không dùng AI. Đây là điểm gãy trước cả DB khi bán cho trung tâm.
- **Khuyến nghị:** (a) Giảm GROQ_SEMAPHORE_ACQUIRE_SEC xuống 10-15s (fail nhanh, client retry); (b) nếu đã dùng Groq paid tier (rate limit cao hơn free 30 RPM) thì nâng GROQ_MAX_CONCURRENT_CHAT lên 8-10 theo đúng comment hướng dẫn trong yml; (c) expose queue-depth metric để biết khi nào chạm trần. Chỉ đổi env + đo, không cần code.
- **Ghi chú verify:** Đã tự xác minh đầy đủ bằng chứng:

1. Config đúng như nêu: `backend/src/main/resources/application.yml:349-351` — `max-concurrent-chat-requests: ${GROQ_MAX_CONCURRENT_CHAT:5}`, whisper 4, `semaphore-acquire-timeout-seconds: ${GROQ_SEMAPHORE_ACQUIRE_SEC:90}`.

2. Semaphore chờ blocking đúng 90s: `GroqConcurrencyLimiter.java:31-33` — `chatSemaphore.tryAcquire(acquireTimeoutSeconds, TimeUnit.SECONDS)` (fair semaphore). `GroqChatClient.java:94-97` (blocking) và :159-162 (stream) đều block tới hết timeout rồi mới ném "AI service is busy". Semaphore nằm NGOÀI circuit breaker (comment :99-100) nên breaker không cứu được backpressure cục bộ.

3. Tomcat 48 thread đúng: `application.yml:180` `max: ${TOMCAT_MAX_THREADS:48}` (comment nói rõ t3.medium 2 vCPU).

4. Prod thực sự đi qua Groq: `AiChatClientFactory.java` default là `local`, NHƯNG `.env.production.example:41` đặt `AI_CHAT_PROVIDER=groq` và audit `audit/full-2026-06-24/pass6.md:36` xác nhận "prod dùng AI_CHAT_PROVIDER=groq".

5. Các luồng đồng bộ giữ Tomcat thread: AI Speaking (`AiSpeakingServiceImpl`, `ChatCompletionService` — không @Async trong module speaking trừ GeminiApiClient) và chấm mock exam (`ExamScoringService.evaluateSprechen/Schreiben` gọi trực tiếp từ `MockExamController`, không @Async) đều chạy trên HTTP request thread → 30 request cùng lúc = 5 chạy + 25 chờ tới 90s, chiếm ~62% pool 48 thread. Đúng như finding.

6. Tình huống còn TỆ hơn nêu: `GroqChatClient.java:41-42,321-327` retry 5 lần với backoff 2/4/8/16/32s (tổng ~62s ngủ) trong khi VẪN GIỮ permit — dưới 429 (free tier 30 RPM) permit bị giữ hàng chục giây, hàng đợi càng nghẹt.

Nuance nhỏ không đủ hạ severity: teacher AI grading là `@Async("taskExecutor")` (`TeacherAiGradingService.java:31`) nên KHÔNG giữ Tomcat thread — câu "mọi luồng LLM" hơi rộng, nhưng kịch bản GTM chính (speaking + mock exam submit) đều đồng bộ nên tác động giữ nguyên. Severity HIGH hợp lý.

### A4-5. Redis L2 TTL đồng loạt 7 ngày đè lên ý đồ TTL của L1 (5 phút–24h) — dữ liệu stale sau mỗi blue-green deploy
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** RedisConfig.java:40 (entryTtl(Duration.ofDays(7)) cho MỌI cache); CacheConfig.java: words 5min, classLeaderboard 5min, subscriptionPlans 30min, systemConfig 1h, aiVocabQuiz 1h ('refresh để giữ variety'); TwoLevelCache.java:44-46: L1 miss → lấy từ L2 và promote ngược vào L1.
- **Tác động:** Sau mỗi deploy (L1 trống), leaderboard lớp / danh sách từ / config hệ thống có thể cũ tới 7 NGÀY được promote lại vào L1 như dữ liệu tươi. Admin sửa từ vựng/plan xong deploy lại càng thấy dữ liệu cũ — bug 'sửa rồi mà không thấy đổi' rất tốn thời gian debug cho team 1 người.
- **Khuyến nghị:** Dùng RedisCacheManager.builder().withCacheConfiguration(tên, config.entryTtl(...)) khai báo TTL L2 riêng từng cache = 2-3× TTL L1 tương ứng (words 15min, leaderboard 10min, aiVocabCache giữ 7 ngày vì deterministic). ~30 dòng.

### A4-6. Không @Cacheable nào bật sync=true — cache stampede trên /api/words (đường đọc nóng nhất) mỗi 5 phút
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** grep toàn repo: 20 chỗ @Cacheable, không chỗ nào có sync=true. VocabularyService.java:47-56: nhánh ALL chạy findAll() ~5k rows, endpoint public không cần auth; docs/LOAD_TEST_100CCU_CHECKLIST.md tự nhận '/api/words là đường đọc nóng nhất' và 'đủ để bão hoà pool'.
- **Tác động:** Đúng thời điểm TTL 5 phút hết hạn dưới tải, N request đồng thời CÙNG chạy lại findAll 5k rows + serialize → spike chiếm pool 20 connection theo chu kỳ. Chính là pattern đã góp phần vào P0 cũ, cache hiện tại chỉ che được giữa các lần expire.
- **Khuyến nghị:** Thêm sync=true vào @Cacheable của words/tags/curriculum/subscriptionPlans (Caffeine hỗ trợ native, 1 request rebuild + số còn lại chờ kết quả). Đổi 5 annotation.

### A4-7. Token-pool org ĐÃ được enforce đầy đủ — 'margin risk #1' của GTM plan đã lỗi thời; chỉ còn overage bounded do soft-cap race
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** QuotaService.assertAllowed (QuotaService.java:85) gọi OrgQuotaService.wouldExceedOrgPool trên MỌI request AI; counter O(1) org_monthly_token_counters tăng atomic bằng ON CONFLICT DO UPDATE (AiUsageLedgerService.java:53-61, V224); fail-safe V237: org pool=0 & !unlimited → CHẶN (OrgQuotaService.java:98-103). Residual: check đọc counter TRƯỚC LLM, debit SAU LLM 2-10s → race có chủ đích, docstring P-9 (QuotaService.java:53-61) + log marker [Quota][P-9/P-11][OVERAGE].
- **Tác động:** Tin tốt cho margin: org không thể xài chùa token (backdoor pool=0 đã đóng). Rủi ro còn lại: org 30 giáo viên bắn AI đồng thời có thể vượt pool ≈ (số request đồng thời × token/request) trước khi counter kịp debit — vài chục nghìn token/lần ≈ vài trăm đồng, chấp nhận được ở giá COGS 307đ/user/tháng nhưng cần theo dõi để không thành thói quen khai thác.
- **Khuyến nghị:** Không cần hard-cap (sửa 20+ call-site như docstring đã cân). Chỉ cần: (a) dựng log-based alert trên marker [OVERAGE] (đã có sẵn marker); (b) cập nhật TEACHER_B2B_GTM_PLAN.md gỡ 'token-pool enforcement = margin risk #1'; (c) chạy deploy-gate audit/prod_verify_section6.sql ITEM 5 xác nhận các org thật đã set pool>0/unlimited.

### A4-8. StudentDashboardService load TOÀN BỘ session hoàn thành của user rồi lọc tuần hiện tại trong Java — hot path Home
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** StudentDashboardService.java:62-83 gọi findCompletedWithTimestampByUserId (LearningSessionProgressRepository.java:20-21 — JPQL không WHERE thời gian, không LIMIT) rồi lọc monday..monday+7d trong vòng for. Home mobile bắn /api/student/dashboard song song với /api/srs/count + /api/notifications/unread-count (scripts/loadtest/README.md, dashboard-mix — được chính docs gọi là 'call nhiều query nhất, bão hoà pool trước tiên').
- **Tác động:** User học 1-2 năm tích ~500-1500 rows → mỗi lần mở Home hydrate cả nghìn entity JPA chỉ để đếm 7 ngày. Nhân với việc Home là màn hình mở nhiều nhất → phí RAM/GC + giữ connection lâu hơn cần thiết trên đúng endpoint dễ nghẽn nhất.
- **Khuyến nghị:** Thay bằng 1 query aggregate như computeWeeklyProgress đã làm ngay bên dưới (dòng 197-223 — cùng file đã có mẫu đúng!): SELECT DATE(completed_at), COUNT(*) WHERE completed_at >= :monday AND < :nextMonday GROUP BY 1. Xoá được cả completionDays không dùng.

### A4-9. N+1 COUNT học viên trong lịch tuần: 1 query COUNT mỗi lớp — nặng nhất ở view toàn org (weekForOrg)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** ClassScheduleService.java:264: for (Long id : classIds) counts.put(id, classStudentRepo.countByIdClassId(id)); được gọi từ cả weekForTeacher (dòng 70) và weekForOrg (dòng 93 — OWNER/MANAGER xem lịch toàn tổ chức).
- **Tác động:** Org 40-60 lớp → 40-60 COUNT queries mỗi lần org-admin mở lịch tuần. Ở 7 user hiện tại vô hại, nhưng đây đúng persona B2B đang bán (manager trung tâm xem lịch hằng ngày) và roadmap chấm công/QR check-in sẽ đè thêm lên chính màn hình này.
- **Khuyến nghị:** Thay bằng 1 query: SELECT class_id, COUNT(*) FROM class_students WHERE class_id IN (:ids) GROUP BY class_id (@Query trên ClassStudentRepository, trả List<Object[]> hoặc projection).

### A4-10. Tổng mem_limit các container vượt 4GB RAM vật lý trong cửa sổ blue-green — rủi ro OOM-killer khi deploy dưới tải
- **Mức độ:** 🟢 Thấp · **Tin cậy:** MEDIUM · **Effort:** 0.5 ngày
- **Bằng chứng:** deploy-backend.sh:360 (backend --memory=1500m; blue-green = 2×1500m) + deploy-backend.sh:314 (redis 256m) + docker-compose.prod.yml: prometheus 400m, loki 256m, grafana 256m, promtail 128m, alertmanager 128m → tổng limit ≈ 4.4GB > 4GB của t3.medium. mem_limit chặn từng container nhưng không chặn tổng.
- **Tác động:** Deploy đúng giờ cao điểm + cả 2 JVM cùng chạm trần heap → kernel OOM-killer có thể giết container ngẫu nhiên (kể cả node xanh đang nhận traffic). Xác suất thấp ở tải hiện tại (JVM thường không ăn hết limit ngay) nhưng là loại sự cố rất khó trace. Giả định: chưa kiểm chứng swap có bật trên EC2 hay không.
- **Khuyến nghị:** Rẻ nhất: bật swap 2GB trên EC2 (dd + mkswap, 15 phút) làm đệm cho cửa sổ blue-green; hoặc hạ --memory backend xuống 1300m. Kiểm tra free -m / dmesg sau lần deploy tới.

### A4-11. SSE notification fan-out in-process + Redis pub/sub default OFF — đúng cho 1 node hiện tại, sẽ gãy im lặng nếu scale ngang
- **Mức độ:** 🟢 Thấp · **Tin cậy:** MEDIUM · **Effort:** 0.5 ngày
- **Bằng chứng:** NotificationSseBroadcaster.java:61 (Map<Long,Set<SseEmitter>> in-JVM); application.yml:304 (APP_NOTIFICATION_SSE_REDIS_PUBSUB:false default, memory ghi 'prod on'); rate-limit SSE connect 20/60s (yml:311-312), timeout 900s + ping 20s.
- **Tác động:** Không phải bug hôm nay (1 node). Rủi ro là dạng 'quên bật cờ': nếu sau này thêm node thứ 2 (hướng scale tự nhiên khi App Store kéo user), notification realtime chỉ đến user may mắn nối đúng node phát — bug rất khó tái hiện. Giả định prod đã bật cờ theo memory — cần kiểm chứng env thực tế trên EC2.
- **Khuyến nghị:** Thêm 1 dòng vào deploy-backend.sh xác nhận/echo giá trị APP_NOTIFICATION_SSE_REDIS_PUBSUB lúc deploy, và ghi vào DEVELOPMENT.md điều kiện bắt buộc bật khi >1 node. 0 code backend.

### A4-12. Điểm CỘNG cần ghi nhận: index phủ đủ các bảng nóng + hot-path quota đọc-thuần — không tìm thấy index thiếu
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** Đối chiếu truy vấn nóng ↔ migration: sumUsageBetween/assertAllowed dùng idx_ai_token_usage_user_created (V188:24, V64:31); unread-count dùng idx_user_notifications_recipient_unread (V175:17); SRS due dùng idx_vrs_user_due (V110:28) + idx_srs_user_next_review (V152); streak dùng index expression (user_id, created_at::date) (V195:20); org counter là PK lookup O(1) (V224). DataRetentionJob (yml:206-215) giữ event tables bounded (telemetry 30d, token 90d, xp 180d). ShedLock đã có (pom.xml:198-204 + @SchedulerLock trên 9 jobs) — audit 2026-06-24 ghi 'no ShedLock' đã lỗi thời.
- **Tác động:** Không có hành động khẩn về index. Giá trị của finding này: tiết kiệm effort — KHÔNG cần đợt 'index audit' nào trước launch; và sửa lại nhận định cũ trong audit trước để không làm lại việc đã xong.
- **Khuyến nghị:** Chỉ cần 1 việc nhỏ: sau launch 2 tuần, chạy pg_stat_user_indexes trên RDS xoá index không dùng (V151 idx_ai_sessions_mode, idx_srs_word_id là ứng viên) để giảm write amplification trên RDS 1GB.

**Docs-drift phát hiện trong trục này (5):**
- docs/DATABASE_SCHEMA.md CHẾT HOÀN TOÀN: header ghi 'MySQL 8.0 · ENGINE=InnoDB · ENUM/DATETIME(6)' trong khi DB thực tế là PostgreSQL (RDS + pgvector, 241 Flyway migration syntax Postgres); thiếu toàn bộ bảng từ ~V110 trở đi (ai_token_usage_events V188, org_monthly_token_counters V224, user_notifications V175, user_ai_token_wallets, spaced_repetition_schedule V152...). File gitignored, mtime 12/04 — mọi audit index/schema phải đọc migrations, không đọc doc này. Nên xoá hoặc ghi banner DEPRECATED trỏ sang db/migration/.
- Nhận định 'no ShedLock' trong audit/full-2026-06-24 (và memory) đã lỗi thời: pom.xml:198-204 có shedlock-spring + shedlock-provider-jdbc-template, @SchedulerLock áp trên ≥9 scheduled jobs (SubscriptionReconcileJob, DataRetentionJob, DailyNotificationJob, FsrsWeightOptimizerService...).
- 'Token-pool enforcement = margin risk #1' trong TEACHER_B2B_GTM_PLAN.md/memory đã lỗi thời: enforcement shipped đầy đủ (QuotaService.assertAllowed:85 → OrgQuotaService.wouldExceedOrgPool, counter atomic V224, fail-safe pool=0→cap V237) — rủi ro còn lại chỉ là overage bounded do soft-cap race P-9 có chủ đích.
- docs/LOAD_TEST_100CCU_CHECKLIST.md ghi comment 'RDS pool là 20' và mục tiêu checklist 30 — khớp code hiện tại (DB_POOL_MAX_SIZE:20) nhưng trạng thái Đợt A ghi 'còn deploy backend' có thể đã xong (nhiều lần deploy sau 12/06); phần trạng thái tổng cần cập nhật trước khi dùng làm căn cứ chạy k6.
- docker-compose.prod.yml chứa service frontend (mem_limit 512m) trong khi web thực tế deploy qua AWS Amplify (amplify.yml) — ai đọc compose file sẽ hiểu sai topology prod; backend thực tế chạy bằng docker run trong deploy-backend.sh chứ không qua compose.


## A5 Test & QA — điểm 2.5/5

**Tóm tắt:** Đếm thực tế: BACKEND backend/src/test có 262 file test Java; CI (backend-ci.yml) chia 2 tầng — Surefire "Unit Tests" chạy mỗi push/PR (log CI 2026-07-01: 1232 tests, 0 fail, 1 skip) loại trừ *IntegrationTest/*ContractTest; Failsafe "Integration Tests" (Testcontainers pgvector/pgvector:pg16, chỉ chạy khi push main) gồm 12 class (9 *IntegrationTest + 3 *ContractTest) = 45 test. Gotcha pgvector/DEUTSCHFLOW_IT_JDBC_URL đã được giải quyết trong CI bằng PostgresTestContainerHolder (testsupport/PostgresTestContainerHolder.java dùng image pgvector; external JDBC URL chỉ là đường chạy local) — CI CHẠY ĐƯỢC IT, nhưng stage này đang ĐỎ 4 lần push main liên tiếp (24/06→01/07) với 4 test fail + 10 skip, và vì deploy tách rời (deploy job if:false) nên main đỏ không chặn gì cả. FRONTEND: 21 file Vitest (vitest 2.1.8, chạy trong frontend-ci với --coverage nhưng threshold đặt sai chỗ nên không gate) + 7 spec Playwright (886 dòng) KHÔNG nằm trong CI nào; spec "payment" mock toàn bộ API (chỉ test paywall UI); live-account.spec.ts là spec duy nhất chạm môi trường thật (mydeutschflow.com) nhưng hardcode credential prod trong repo. MOBILE: 12 suite jest / 87 test, xanh (0.57s), chạy trong mobile-ci cùng tsc. Domain backend KHÔNG có test: aiimage, news, phoneme, practice, system, util; domain mỏng (≤2 file): assessment (B1!), beginner, gamification, progress, messaging, training, video, marketing. Payment/organization/notification NGƯỢC với lo ngại — có test thật (payment 8 file gồm SePay webhook idempotency unit-level, MoMo IPN, Stripe, Apple IAP; organization 15; notification 8) nhưng chỉ ở mức service-unit, không có IT HTTP cho webhook/IAP endpoint. Skip/disabled: duy nhất @Disabled AIModelServiceIntegrationTest (10 test, cần AI server) + XttsStreamClientSmokeTest env-gated; frontend/mobile 0 skip. Coverage gate: KHÔNG có ở cả 3 tầng (jacoco chỉ prepare-agent+report, không goal check; vitest threshold vô hiệu; jest không coverage). E2E môi trường thật = phiên QA thủ công 2026-06-24 (qa/RESULTS_*, 8 báo cáo) — 25 finding đã fix trong commit 417fb661, các gap còn mở trong qa/COVERAGE_GAPS (refresh-token reuse, token-ledger, payment sandbox, cross-tenant 2 org, SSE, S3 presigned) đến nay vẫn chưa có test tự động.

### A5-1. Gate Integration Test trên main ĐỎ liên tục từ 24/06 mà không ai phát hiện
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 1 ngày · **Verify:** ✅ CONFIRMED
- **Bằng chứng:** gh run list backend-ci.yml branch=main: 4 lần push main gần nhất đều failure ở job '🐘 Integration Tests' (run 28512009955 ngày 01/07, 28494916402, 28120874712, 28077823164 từ 24/06). Log failsafe: 'Tests run: 45, Failures: 1, Errors: 3, Skipped: 10' → BUILD FAILURE. Job này chỉ chạy khi push main (backend-ci.yml: if github.ref == refs/heads/main), PR không chạy IT nên PR xanh mà main đỏ; deploy job if:false nên đỏ không chặn deploy thủ công.
- **Tác động:** Gate IT thực chất vô dụng: mọi regression ở tầng DB/Flyway/security-filter merge vào main sẽ không bao giờ bị bắt vì stage duy nhất chạy IT đã đỏ sẵn. Với team 1 người deploy bằng deploy-backend.sh (không nhìn CI), main đỏ 1 tuần không ai biết — đúng lúc chuẩn bị V242 + IAP config cho App Store.
- **Khuyến nghị:** Sửa 4 test fail (xem 2 finding dưới) để main xanh lại, sau đó bật notification khi backend-ci main fail (GitHub watch hoặc Slack/email action, ~10 dòng yaml). Cân nhắc chạy job IT cả trên PR (ubuntu runner có Docker, chỉ tốn ~3 phút) để lỗi bị chặn trước merge.
- **Ghi chú verify:** Tự xác minh toàn bộ bằng chứng, tất cả đứng vững:

1. `gh run list backend-ci.yml branch=main`: 4 lần push main gần nhất đều `conclusion=failure` — run 28512009955 (01/07, merge P6 #184), 28494916402 (01/07), 28120874712 (24/06), 28077823164 (24/06). Các run trước đó bị cancelled (push dồn), tức main đỏ liên tục ít nhất từ 24/06.

2. `gh run view 28512009955`: Compile ✅, Unit Tests ✅, job "🐘 Integration Tests" ❌ failure, Deploy skipped — đúng như finding nói: chỉ stage IT đỏ.

3. Log failsafe khớp chính xác: `[ERROR] Tests run: 45, Failures: 1, Errors: 3, Skipped: 10` → `BUILD FAILURE`. 4 test hỏng: QuotaExceededHandlerIntegrationTest (429 vs 404), MediaAssetServiceIntegrationTest (duplicate key media_assets_s3_key_key), FsrsIntegrationTest x2 (FK vocab_review_schedule_user_id_fkey).

4. `.github/workflows/backend-ci.yml:66`: job integration-tests có `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` → PR không chạy IT, PR xanh mà main đỏ — đúng. Dòng 100: deploy job `if: false` (deploy thủ công qua deploy-backend.sh) → CI đỏ không chặn deploy — đúng.

Về severity: dù các test fail trông giống lỗi isolation test (FK/duplicate-key) hơn là regression thật, bản chất finding là "gate IT duy nhất đã chết 1 tuần không ai biết" — với quy trình deploy thủ công không nhìn CI và đang chuẩn bị migration V242 + IAP, mọi regression tầng DB/Flyway/security sẽ không bao giờ bị chặn. Trong ngữ cảnh audit QA trước App Store launch, CRITICAL là hợp lý. Giữ nguyên severity.

### A5-2. QuotaExceededHandlerIntegrationTest test endpoint ma — không bao giờ pass, và đó là test duy nhất assert contract 429 paywall
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** backend/src/test/java/com/deutschflow/common/exception/QuotaExceededHandlerIntegrationTest.java:28 gọi GET /api/test/quota-exceeded và expect 429 problem+json; grep toàn bộ src/main và src/test không có controller nào serve path này (chỉ GlobalExceptionHandler.java:169 build response 429). CI log: 'Status expected:<429> but was:<404>'. Git log của file chỉ có 1 commit '072d42b5 backup file' — fixture controller chưa bao giờ được commit.
- **Tác động:** Business rule đã chốt 'Free tier = 0 token AI → phải hiện paywall' dựa trên contract 429 RFC7807 (planCode, remainingThisMonth) mà FE/mobile parse — contract này hiện KHÔNG có test nào còn sống. Đổi shape response 429 sẽ vỡ paywall client mà CI vẫn im lặng (vì test vốn đã fail sẵn).
- **Khuyến nghị:** Tạo test-scope @RestController fixture ném QuotaExceededException tại /api/test/quota-exceeded (nằm trong src/test, @Profile("test")), hoặc đổi test sang gọi endpoint AI thật với user DEFAULT 0-token qua MockMvc. Ưu tiên cách 2 vì test luôn cả enforcement DEFAULT=0.

### A5-3. 2 IT còn lại fail vì test-isolation trên container Postgres dùng chung (không cleanup)
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** CI log run 28512009955: MediaAssetServiceIntegrationTest.teacherList_onlyShowsOwnUploads:109 → 'duplicate key value violates unique constraint media_assets_s3_key_key'; FsrsIntegrationTest hai test → 'violates foreign key constraint vocab_review_schedule_user_id_fkey'. testsupport/PostgresTestContainerHolder.java là singleton container cho toàn suite, Flyway chạy 1 lần, không có cleanup/@Sql reset giữa class.
- **Tác động:** Kết quả IT phụ thuộc thứ tự chạy và dữ liệu class trước để lại → dạng flaky-by-design; kể cả khi sửa test ma ở trên, main vẫn đỏ vì 3 lỗi này. Đây là toàn bộ 'flaky đã biết' của repo (không tìm thấy tài liệu flaky nào khác).
- **Khuyến nghị:** Thêm seed user/cleanup rõ ràng: FsrsIntegrationTest phải tự insert user trước khi insert vocab_review_schedule; MediaAssetServiceIntegrationTest dùng s3_key random (UUID) thay vì hằng số. Quy ước chung: mỗi IT class tự seed + tự dọn (@AfterAll TRUNCATE bảng mình đụng).

### A5-4. Không có coverage gate ở bất kỳ tầng nào (jacoco không check, vitest threshold vô hiệu, jest không coverage)
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1 ngày · **Verify:** ✅ CONFIRMED
- **Bằng chứng:** backend/pom.xml:355-373 jacoco chỉ có execution prepare-agent + report, KHÔNG có goal 'check'/rules. frontend/vitest.config.ts đặt lines:60, statements:60 TRỰC TIẾP dưới coverage — vitest 2.1.8 (package.json) yêu cầu coverage.thresholds.lines nên bị bỏ qua, và include chỉ src/lib/** (loại toàn bộ components/app). frontend-ci.yml chạy 'npm test -- --coverage' nhưng vì threshold vô hiệu nên chỉ in report. mobile/package.json jest không cấu hình coverage. Không workflow nào fail theo coverage.
- **Tác động:** Coverage có thể tụt tự do mà CI vẫn xanh; các domain 0-test (xem finding riêng) không bao giờ bị lộ. Chuẩn nội bộ 80% (rules testing.md) hoàn toàn không được enforce — số liệu coverage hiện tại thậm chí không ai biết.
- **Khuyến nghị:** Bước 1 (rẻ): sửa vitest.config.ts chuyển sang coverage.thresholds{lines:60,statements:60} và mở rộng include dần. Bước 2: thêm jacoco 'check' goal với threshold khởi điểm thực tế (đo trước, đặt ratchet ~ hiện trạng −2%) chỉ trên các package tiền/bảo mật (payment, common.quota, user, organization) để không chặn ship. Mobile để sau v1.0.
- **Ghi chú verify:** Đã xác minh trực tiếp cả 3 tầng, không bác bỏ được điểm nào:

1. Backend: backend/pom.xml dòng ~354-373 — jacoco-maven-plugin 0.8.12 chỉ có 2 execution `prepare-agent` và `report` (phase test), KHÔNG có goal `check` hay `<rules>`; grep toàn pom không thấy `check` cho jacoco. Coverage chỉ được báo cáo, không gate.

2. Frontend: frontend/vitest.config.ts đặt `lines: 60, statements: 60` TRỰC TIẾP dưới `coverage` (không phải `coverage.thresholds`), cùng `include: ["src/lib/**"]`. package.json dùng `vitest ^2.1.8` + `@vitest/coverage-v8 ^2.1.8` — từ vitest 1.0 các key threshold đã chuyển vào `coverage.thresholds.*` (breaking change được ghi trong migration guide); key cấp `coverage.lines` bị bỏ qua âm thầm ở 2.x. `.github/workflows/frontend-ci.yml:42` chạy `npm test -- --coverage` → chỉ in report, không thể fail theo threshold. Thêm nữa include chỉ src/lib/** nên dù threshold có hiệu lực cũng bỏ qua toàn bộ components/app.

3. Mobile: mobile/package.json script `"test": "jest"`, config jest inline (preset ts-jest) KHÔNG có `coverageThreshold`, không có jest.config.* riêng, không chạy --coverage ở đâu.

Grep toàn bộ .github/workflows chỉ có đúng 1 dòng nhắc "coverage" (frontend-ci.yml:42) — không workflow nào gate theo coverage. Kết hợp chuẩn nội bộ 80% (rules/testing.md) không được enforce ở bất kỳ đâu, finding đúng nguyên vẹn; severity HIGH hợp lý theo thang nội bộ (significant quality issue, coverage có thể tụt tự do mà CI vẫn xanh).

### A5-5. Playwright e2e (7 spec) không chạy trong CI; spec payment mock 100% API — không có smoke tự động nào cho luồng thật
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** grep 'playwright|test:e2e' trên .github/workflows/* và amplify.yml → 0 kết quả. frontend/tests/e2e/ có 7 spec (886 dòng): payment-and-srs.spec.ts mock toàn bộ /api/auth/me, /api/auth/me/plan, /api/ai-speaking/quota bằng page.route (chỉ test paywall UI render, không chạm webhook/fulfillment); auth.spec, teacher-lms.spec, roadmap.spec tương tự chạy vs localhost:3000 (playwright.config.ts baseURL). Không có test webhook fulfillment (SePay/Apple) end-to-end nào, kể cả sandbox.
- **Tác động:** Các luồng quan trọng (login/refresh thật, thanh toán→kích hoạt gói, chấm bài) chỉ được bảo vệ bởi QA thủ công 1 lần (2026-06-24). Sau mỗi deploy Amplify/EC2 không có smoke nào chạy — regression UI/paywall chỉ phát hiện khi user báo (prod chỉ ~7 user nên gần như không ai báo).
- **Khuyến nghị:** Thêm job e2e vào frontend-ci chạy nhóm spec mocked (auth, payment-and-srs, v2-smoke) — chúng không cần backend nên chạy được trên runner (~3-4 phút). Viết thêm 1 smoke post-deploy (login + GET /dashboard + GET quota) chạy vs prod bằng account test, kích hoạt thủ công hoặc cron.

### A5-6. Con đường tiền v1.0 — Apple IAP: AppleServerNotificationService KHÔNG có test, không IT HTTP cho /api/payments/apple/*, mobile expo-iap 0 test
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 2 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** grep 'AppleServerNotification' trong src/test chỉ ra AppleEntitlementActionTest.java (test enum action, không test service xử lý notification). Test Apple hiện có: AppleIapServiceTest (4 @Test, mock AppleJwsVerifier — verify/ownership/idempotency mức service), AppleProductCatalogTest, AppleEntitlementActionTest, AppleIapDtoSerializationTest. Không có MockMvc/IT nào cho AppleIapController hay AppleServerNotificationService (renewal/revoke từ App Store Server). mobile/__tests__/ (12 file) không có file nào về purchase/IAP.
- **Tác động:** Theo quyết định đã chốt, v1.0 sống bằng subscription PRO qua Apple IAP. AppleServerNotificationService là nơi duy nhất xử lý renew/expire/refund từ Apple — bug ở đây = user trả tiền mà mất quyền (hoặc ngược lại, mất doanh thu) và chỉ phát hiện qua complaint. Trước deadline tháng 7 đây là vùng rủi ro tiền cao nhất chưa có lưới.
- **Khuyến nghị:** Trong tuần config V242: (1) unit test AppleServerNotificationService cho các notificationType chính (DID_RENEW, EXPIRED, REFUND, DID_CHANGE_RENEWAL_STATUS) với JWS payload fixture mock verifier; (2) 1 MockMvc IT cho POST /api/payments/apple/verify + /notifications (auth + shape); (3) 1 phiên sandbox e2e thủ công theo runbook (mua→verify→ledger user_subscriptions→expire) ghi lại thành checklist trước submit.

### A5-7. SepayWebhookController (auth Apikey) không có test controller-level; idempotency thanh toán chỉ được test ở unit
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** grep 'SepayWebhookController|/api/webhooks' trong src/test → 0 kết quả. SepayWebhookController.java:34-60 tự implement parse header 'Authorization: Apikey <key>' + constant-time compare — logic security chưa có test. SepayWebhookServiceTest.java có 7 test tốt mức service (handle_duplicate_noOp:82, underpaid:121, alreadyPaid_noReactivate:135, voidInvoice:147) nhưng không đi qua HTTP layer.
- **Tác động:** Web billing v1.0 = SePay 'gói N ngày' → webhook này là điểm kích hoạt gói duy nhất phía web. Regression ở header parsing/401 path (hoặc filter chain nuốt request) sẽ làm chuyển khoản thật không kích hoạt gói, mà không test nào bắt được; QA 2026-06-24 cũng ghi rõ payment bị BỎ QUA (qa/COVERAGE_GAPS mục A).
- **Khuyến nghị:** Thêm 1 MockMvc/WebMvcTest cho SepayWebhookController: đúng key→200+activate, sai/thiếu key→401, replay cùng referenceCode→200 no-op (đi xuyên controller→service). Khi triển khai 'student-web-SePay' mới nhớ tái dùng test này.

### A5-8. Credential prod hardcode trong live-account.spec.ts check-in vào repo
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** frontend/tests/e2e/live-account.spec.ts:46-48 hardcode login 'nvb@gmail.com' / '123456' chạy vs baseURL https://mydeutschflow.com (dòng 5), kèm artifactDir tuyệt đối '/Users/dinhcu/.gemini/antigravity/...' (dòng 7) — spec không chạy được trên máy khác và lộ credential một account prod trong git history.
- **Tác động:** Repo đã private nên rủi ro giới hạn, nhưng account prod này (mật khẩu 6 ký tự) là cửa vào dữ liệu thật nếu repo/CI bị lộ; spec cũng làm nhiễu suite (fail ở mọi môi trường khác máy owner).
- **Khuyến nghị:** Chuyển credential sang env (E2E_LIVE_EMAIL/PASSWORD), skip test khi thiếu env (test.skip(!process.env...)), đổi mật khẩu account nvb@gmail.com, artifactDir → test-results/ tương đối.

### A5-9. 6 domain backend 0 test, 8 domain ≤2 file — assessment (B1) mỏng bất thường so với vai trò
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1.5 ngày
- **Bằng chứng:** So sánh src/main/java/com/deutschflow (32 domain) với src/test: KHÔNG có thư mục test cho aiimage, news, phoneme, practice, system, util. Domain ≤2 file test: assessment(2), beginner(2), gamification(2), progress(2), messaging(2), training(2), video(2), marketing(2). Đối lập: speaking 57, user 30, vocabulary 28, teacher 22, organization 15.
- **Tác động:** assessment = chấm B1/readiness (giá trị cốt lõi 'Goethe exam-pass') chỉ có 2 file test; practice/phoneme/aiimage là endpoint tiêu token AI (tiền) không có test nào. Vùng phủ lệch nặng về speaking/vocab trong khi các bề mặt tiêu tiền và đánh giá học viên gần như trống.
- **Khuyến nghị:** Không cần trải đều — thêm test có chủ đích: (1) assessment: 3-5 unit test cho B1 evaluate scoring/threshold; (2) practice + aiimage: test quota gate (DEFAULT=0 → 429) cho từng endpoint tiêu token, dùng chung 1 helper. Bỏ qua news/system/util (rủi ro thấp).

### A5-10. 5 class *IT.java chạy nhầm stage 'Unit Tests' + cờ -DskipUnitTests=true là no-op
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** pom.xml surefire excludes chỉ có **/*IntegrationTest.java và **/*ContractTest.java (dòng 322-332); failsafe includes cùng 2 pattern. Nhưng tồn tại GrammarCasesControllerIT, RoadmapTreeLevelUpIT, GreetingControllerIT, ClassScheduleIT, MaterialPersistenceIT (+6 RbacTest @SpringBootTest) → chạy trong surefire ở MỌI push/PR, cần Docker/Testcontainers. Local không Docker chúng bị skip im lặng qua Assumptions (AbstractPostgresIntegrationTest.assumePostgresAvailable). Đồng thời backend-ci.yml stage IT chạy 'mvnw verify -DskipUnitTests=true' nhưng grep pom.xml không có property skipUnitTests → stage IT chạy lại toàn bộ 1232 unit test (log CI xác nhận surefire chạy đủ trước failsafe).
- **Tác động:** (1) Dev local 'mvn test' xanh nhưng thực tế 11 class DB-backed bị skip → cảm giác an toàn giả; (2) stage IT tốn ~1-2 phút chạy lại unit vô ích và log fail khó đọc (unit lẫn IT); (3) quy ước đặt tên hai trường phái (*IT vs *IntegrationTest) sẽ tiếp tục gây misroute.
- **Khuyến nghị:** Chuẩn hoá: đổi tên 5 file *IT.java → *IntegrationTest.java (hoặc thêm **/*IT.java vào cả excludes surefire + includes failsafe), và định nghĩa <skipUnitTests> property gắn vào surefire <skip> để cờ CI hoạt động đúng.

### A5-11. Các gap trong qa/COVERAGE_GAPS_2026-06-24.md về monetization/bảo mật vẫn MỞ — chưa có test tự động nào được bổ sung
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1.5 ngày
- **Bằng chứng:** qa/COVERAGE_GAPS_2026-06-24.md mục A/D liệt kê: vòng tiêu token→ledger (lõi monetization), payment idempotency qua HTTP, cross-tenant 2 org, refresh-token reuse detection, rate limiting 429, SSE streams, S3 presigned upload, WebSocket. Verify lại code 2026-07-03: grep 'reuse' trong user/service/AuthServiceUnitTest.java → chỉ có refresh_throwsWhenTokenExpired:197, không có test reuse-detection; không tìm thấy test ledger-consumption xuyên suốt; không có org thứ 2 trong fixture IT. (25 finding chức năng trong audit/FIX_SPEC.md thì ĐÃ fix ở commit 417fb661 — spot-check MUT-1/F-2/PRON khớp code.)
- **Tác động:** Đây đúng là các luồng 'đắt nhất' mà chính tài liệu QA đã khoanh: mất token ledger = mất tiền/COGS sai; refresh reuse không detect = account takeover kéo dài; cross-tenant chỉ mới test 1 org. Sau 9 ngày các mục này vẫn chỉ tồn tại trên giấy.
- **Khuyến nghị:** Chọn 2 mục ROI cao làm trước v1.0: (1) IT 'tiêu token → ledger → 429 khi hết' cho 1 endpoint AI đại diện (dùng Testcontainers sẵn có); (2) unit test refresh-token reuse detection (revoke-all + flag). Các mục SSE/WebSocket/S3 để sau launch.

### A5-12. Mobile chỉ có test API-mapper/layout thuần logic — 0 test component/hook, 0 e2e; QA thiết bị hoàn toàn thủ công trước launch
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.25 ngày
- **Bằng chứng:** mobile/__tests__/ 12 file đều là api-mapper (notificationsApi, examApi, grammarApi...) hoặc skill-tree layout (skillTreeLayout/Pha2/Stages) — jest chạy 87 test trong 0.57s (không render RN component nào, preset ts-jest thuần). Không có Detox/Maestro; không jest-expo/@testing-library/react-native trong package.json. Device-QA là quy trình tay (mobile/QA_SCREENS_AUDIT.md 181 findings, SESSION_HANDOFF.md).
- **Tác động:** Chấp nhận được cho team 1 người (QA tay đã rất kỹ, đã bắt được Fabric bug), nhưng có nghĩa mọi regression UI/navigation sau OTA update (EAS Update đã bật) chỉ được bắt bằng mắt. Rủi ro tăng khi bắt đầu ship OTA JS-only fix nhanh.
- **Khuyến nghị:** Không đầu tư e2e mobile trước v1.0. Chỉ thêm 1 checklist smoke 10 phút (login→home→1 lesson→paywall→purchase sandbox) chạy tay trước MỖI eas update/submit, lưu tại mobile/DEVELOPMENT.md.

### A5-13. Test bị disable: AIModelServiceIntegrationTest (10 test) @Disabled làm nhiễu số liệu failsafe
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.1 ngày
- **Bằng chứng:** backend/src/test/.../ai/AIModelServiceIntegrationTest.java:20 @Disabled("Requires AI server to be running") — 10/45 test của stage IT luôn Skipped (CI log 'Tests run: 10, Skipped: 10'). XttsStreamClientSmokeTest dùng @EnabledIfEnvironmentVariable(XTTS_BASE_URL) — pattern env-gate tốt hơn. Frontend/mobile: 0 skip (grep .skip/xit/xdescribe sạch).
- **Tác động:** Nhỏ: 22% suite IT là số liệu chết, che mờ tỷ lệ pass thật; @Disabled vô điều kiện không bao giờ tự bật lại (khác env-gate).
- **Khuyến nghị:** Đổi @Disabled sang @EnabledIfEnvironmentVariable(named="AI_SERVER_URL") giống XttsStreamClientSmokeTest để có thể chạy lại khi có môi trường, và số skip phản ánh đúng lý do.

**Docs-drift phát hiện trong trục này (5):**
- backend-ci.yml stage 'Integration Tests' chạy 'mvnw verify -DskipUnitTests=true' nhưng pom.xml không định nghĩa property skipUnitTests → mô tả stage (chỉ chạy IT) sai với thực tế (chạy lại toàn bộ unit + IT); log CI 2026-07-01 xác nhận surefire chạy đủ 1232 test trong job này.
- audit/FIX_SPEC.md:5 tuyên bố '✅ TOÀN BỘ 25 mục đã implement... Verified' nhưng dòng 18 của chính nó còn 2 mục 'CẦN XÁC MINH thêm' (TF-1 prod scenario, F-2 web leak) — trạng thái tự mâu thuẫn trong cùng file.
- ID finding không nhất quán giữa 3 nguồn: qa/FIX_PLAN.md định nghĩa MON-1 = 'plan admin cấp rớt DEFAULT', audit/FIX_SPEC.md:28 map MON-1 = 'wallet debit race / seed wallet ON CONFLICT', còn commit message 417fb661 ghi 'MON-1: stop exposing refreshToken' (thực chất là F-2) — audit trail dễ dẫn sai khi tra cứu.
- frontend/playwright.config.ts comment 'Requires dev server to be running externally: npm run dev' nhưng block webServer ngay bên dưới tự khởi động dev server (reuseExistingServer:true) — hướng dẫn cũ chưa xoá.
- qa/COVERAGE_GAPS_2026-06-24.md vẫn chính xác (các gap payment/ledger/reuse-detection còn mở đúng như ghi) — KHÔNG drift, nhưng chưa có mục nào được tick/annotate từ 24/06 dù user có quy ước 'keep checklist synced'.


## A6 DevOps & hạ tầng — điểm 2.5/5

**Tóm tắt:** CI hoạt động thật (gh run list cho thấy runs xanh 01/07/2026 — nghi vấn "CI chết vì billing 13/06" đã HẾT hiệu lực). 4 workflow: backend-ci (compile→unit test→IT chỉ trên main-push→deploy đã tắt if:false), frontend-ci (tsc/lint/vitest/i18n — KHÔNG có next build), mobile-ci (tsc+jest, không EAS), security-ci (gitleaks blocking; semgrep/npm-audit report-only). Vấn đề lớn nhất: (1) Integration Tests trên main fail 4 lần liên tiếp từ 24/06 (QuotaExceededHandler, MediaAsset, FsrsIntegrationTest — 1F/3E/10 skipped) mà không ai bị chặn vì main không có branch protection và deploy thủ công không chờ CI; (2) không tìm thấy bất kỳ cơ chế backup/restore RDS nào trong repo — chỉ có TODO unchecked; (3) monitoring stack (Prometheus/Grafana/Loki/Alertmanager→Telegram) được định nghĩa đầy đủ trong docker-compose.prod.yml + alert rules (DbPoolExhausted/HighErrorRate/HighAiLatency) nhưng không xác minh được đang chạy (probe 4 port đều timeout, GRAFANA_ADMIN_PASSWORD không có trong .env.production thật, alertmanager.yml thật gitignored) — và ngay cả khi chạy, Prometheus scrape target `backend:8080` không khớp container `deutschflow-backend` do deploy-backend.sh chạy ngoài compose; (4) deploy "blue-green" thực chất cold-start container mới trên :8080 sau khi đã xóa cả BLUE lẫn GREEN → downtime 60-120s và không có rollback nếu bước cuối fail. Điểm sáng: deploy-backend.sh đã FIX vụ auto-commit dirty tree (giờ abort — nhiều docs vẫn ghi sai), health-gate GREEN 300s + warm-up pool, amplify.yml có guard JWT verifier và cố tình không cache .next để tránh stale deploy. Lưu ý cho launch tháng 7: .env.production chưa có APPLE_* lẫn SENTRY_DSN.

### A6-1. Không tìm thấy bất kỳ cơ chế backup/restore DB nào — toàn bộ dữ liệu nằm trên 1 RDS t4g.micro
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 1 ngày · **Verify:** ✅ PARTIAL (spot-check)
- **Bằng chứng:** Grep toàn repo (docs/, *.sh, *.md) cho backup|snapshot|pg_dump|PITR: chỉ ra TODO unchecked — docs/RECOVERY_CHECKLIST.md:159 "[ ] DR: viết script restore-from-snapshot RDS + diễn tập 1 lần; ghi rõ RTO/RPO" và docs/MASTER_DEPLOYMENT_CHECKLIST.md:304 "[ ] Backups running (check RDS console)" đều chưa tick. Không có script backup, không có runbook restore. Cấu hình automated backup của RDS không kiểm được từ repo (cần AWS console).
- **Tác động:** Nếu RDS hỏng/xóa nhầm/migration phá dữ liệu (240 migration Flyway, V242 sắp chạy cho IAP), mất toàn bộ dữ liệu user + subscription ledger + org B2B không khôi phục được — rủi ro tử vong cho business, đặc biệt khi sắp có user trả tiền qua App Store.
- **Khuyến nghị:** (1) Vào RDS console xác nhận automated backup retention ≥7 ngày + bật deletion protection (0 code). (2) Viết runbook restore-from-snapshot vào docs/RECOVERY_CHECKLIST.md và diễn tập restore 1 lần sang instance tạm trước khi submit App Store. (3) Thêm cron pg_dump hàng ngày lên S3 làm lớp 2.
- **Ghi chú verify:** PARTIAL (spot-check): xác nhận repo không có cơ chế backup nào (chỉ 1 file migration MySQL cũ); trạng thái RDS automated backup KHÔNG thể verify từ repo — cần AWS console.

### A6-2. Integration Tests trên main ĐỎ liên tục từ 24/06 — gate bị vô hiệu hóa trên thực tế
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** gh run list workflow "Backend CI/CD" branch main: 4 push gần nhất đều failure (28512009955 01/07, 28494916402 01/07, 28120874712 24/06, 28077823164 24/06). Log run 28512009955: "Tests run: 45, Failures: 1, Errors: 3, Skipped: 10" — QuotaExceededHandlerIntegrationTest.quotaExceeded_shouldReturn429ProblemJsonWithExtensions, MediaAssetServiceIntegrationTest.teacherList_onlyShowsOwnUploads, FsrsIntegrationTest (2 test). IT chỉ chạy post-merge trên main (backend-ci.yml:66 `if: github.ref == 'refs/heads/main' && push`), PR chỉ chạy unit test.
- **Tác động:** Broken-window: main đỏ hơn 1 tuần mà vẫn merge/deploy tiếp → tín hiệu regression thật (quota 429 liên quan trực tiếp paywall/token-pool sắp launch) bị chôn trong nhiễu; IT mất hoàn toàn giá trị gate.
- **Khuyến nghị:** Sửa 4 test fail (hoặc xác định là env-issue của runner và fix hạ tầng test). Sau đó chuyển IT chạy trên PR (Testcontainers đã chạy được trên ubuntu-latest) hoặc ít nhất bật notification khi main đỏ.

### A6-3. Monitoring stack không xác minh được là đang chạy — alert rules có thể đang bắn vào hư vô
- **Mức độ:** 🟠 Cao · **Tin cậy:** MEDIUM · **Effort:** 0.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** docker-compose.prod.yml định nghĩa đủ prometheus/alertmanager/loki/promtail/grafana; docker/prometheus/alert.rules.yml có 3 alert (HighAiLatency, DbPoolExhausted, HighErrorRate) route ra Telegram qua docker/alertmanager/alertmanager.yml.example. NHƯNG: probe http://35.175.232.152 các port 9090/3001/9093/3100 đều timeout (không phân biệt được SG chặn hay stack không chạy — SSH audit bị hook chặn, không kiểm trực tiếp được); GRAFANA_ADMIN_PASSWORD/GRAFANA_ADMIN_USER có trong .env.production.example nhưng KHÔNG có trong .env.production thật; docs/RECOVERY_CHECKLIST.md mục 1.4 dừng ở "🟡 chờ user điền bot token + deploy"; docs/DEEP_REVIEW_2026-06-06.md:23 "observability defined-but-not-deployed". alertmanager.yml thật gitignored nên không verify được từ repo.
- **Tác động:** Sự cố DB-pool 13/06 (P0 login 500) đã từng KHÔNG có notification — chính comment trong prometheus.yml thừa nhận điều này. Nếu stack vẫn chưa chạy, incident tiếp theo (khi có user trả tiền) lại chỉ được phát hiện khi user phàn nàn.
- **Khuyến nghị:** SSH vào EC2, chạy `docker compose -f docker-compose.prod.yml up -d prometheus alertmanager grafana loki promtail`, điền Telegram bot token vào alertmanager.yml, rồi test bằng cách bắn 1 alert giả (amtool hoặc stop backend 30s). Ghi trạng thái thật vào RECOVERY_CHECKLIST.

### A6-4. Prometheus scrape target `backend:8080` không khớp cách backend thực sự được deploy → metrics mù ngay cả khi stack chạy
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** docker/prometheus/prometheus.yml scrape `targets: ['backend:8080']` — DNS `backend` chỉ tồn tại khi backend chạy qua compose (service name). Nhưng deploy-backend.sh:460-472 chạy backend bằng `docker run` với tên `deutschflow-backend` trên network `deutschflow-net` tạo tay (deploy-backend.sh:305), còn compose tự tạo network prefix riêng (`deutschflow_deutschflow-net`, docker-compose.prod.yml networks không có `name:` override). Prometheus trong compose network không resolve được `backend` lẫn `deutschflow-backend`.
- **Tác động:** hikaricp_connections_* / http_server_requests metrics không được scrape → cả 3 alert rule không bao giờ fire dù backend đang chết — monitoring giả.
- **Khuyến nghị:** Sửa prometheus.yml target thành `deutschflow-backend:8080` + thêm `name: deutschflow-net` (external: true) vào networks của docker-compose.prod.yml để compose join đúng network mà deploy script dùng. Verify trên /targets sau khi lên.

### A6-5. "Blue-green" thực chất có downtime 60-120s mỗi deploy và KHÔNG có rollback sau khi promote
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** deploy-backend.sh:446-469: sau khi GREEN (:8081) healthy, script `docker_force_remove deutschflow-backend` (xóa BLUE) rồi `docker_force_remove deutschflow-backend-green` (xóa luôn GREEN!) rồi `docker run` container HOÀN TOÀN MỚI trên :8080 → cold-start JVM Spring Boot lần 2 (final health check chờ tối đa 90s, deploy-backend.sh:480-490). Nếu container mới fail ở bước này, BLUE đã bị xóa và image :latest đã bị tag đè (dòng 475) → exit 1 với site down, khôi phục hoàn toàn thủ công. Rollback chỉ tồn tại TRƯỚC promote (GREEN unhealthy → giữ BLUE, dòng 399-410 — phần này đúng).
- **Tác động:** Mỗi backend deploy = ~1-2 phút downtime (rớt SSE notification, request 5xx); worst-case deploy fail cuối = outage kéo dài đến khi founder can thiệp tay. Với deploy thường xuyên trước launch, rủi ro tích lũy.
- **Khuyến nghị:** Cách rẻ nhất giữ nguyên kiến trúc: đặt nginx (đã có docker/deutschflow.nginx.conf) làm reverse proxy 8080→upstream, promote = đổi upstream sang GREEN đang chạy sẵn (không cold-start lần 2, không xóa BLUE cho tới khi GREEN nhận traffic ổn). Tối thiểu: giữ image cũ với tag :prev + in sẵn lệnh rollback trong error path.

### A6-6. Bus-factor = 1: toàn bộ khả năng deploy backend phụ thuộc 1 laptop
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** deploy-backend.sh:23 hardcode PEM `/Users/dinhcu/Developer/DeutschFlow/deutschflow-key.pem`; :29-30 `.env.production` + `google-sa.json` chỉ tồn tại local (gitignored, xác nhận `ls -la` có .env.production 6.4KB local); backend-ci.yml:100 deploy stage `if: false` — CI không deploy. Web thì auto qua Amplify, nhưng backend/secret chỉ đi qua máy này.
- **Tác động:** Laptop hỏng/mất giữa đợt launch tháng 7 = không deploy backend được, không có bản sao secrets nào khác được ghi nhận; cũng không rotate được nhanh nếu lộ key.
- **Khuyến nghị:** 1 buổi: backup có mã hóa (.env.production + PEM + google-sa.json) vào password manager / S3+KMS; ghi runbook "deploy từ máy mới" vào DEPLOYMENT.md. Cân nhắc bật lại self-hosted runner deploy stage làm đường dự phòng (đã có sẵn code, chỉ cần giải quyết double-deploy race bằng lock).

### A6-7. main không có branch protection + deploy không bị gate bởi CI
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.2 ngày
- **Bằng chứng:** `gh api repos/.../branches/main/protection` → 404 "Branch not protected". deploy-backend.sh:194-198 push origin rồi deploy NGAY, không chờ/kiểm CI status. Kết hợp: code có thể lên prod mà chưa qua bất kỳ test nào (unit test chỉ chạy song song trên Actions, không chặn).
- **Tác động:** Với 1 founder tự merge thì protection ít giá trị hằng ngày, nhưng deploy-không-chờ-CI + IT chỉ chạy post-merge nghĩa là regression được phát hiện SAU khi đã ở prod.
- **Khuyến nghị:** Bật branch protection main yêu cầu Backend CI/Frontend CI/Mobile CI + gitleaks pass (10 phút). Thêm vào deploy-backend.sh Phase 1 một check `gh run list --commit $(git rev-parse HEAD)` cảnh báo nếu CI chưa xanh.

### A6-8. Luồng release 3 nền tảng 3 nhịp khác nhau — "merge nhưng chưa live" là rủi ro cấu trúc, không phải tai nạn
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.3 ngày
- **Bằng chứng:** Web: Amplify auto-build trên push main (amplify.yml; comment dòng 38-42 ghi nhận đã từng serve STALE /login do cache .next — đã fix bằng cách bỏ cache). Backend: thủ công deploy-backend.sh (CI deploy if:false, backend-ci.yml:100). Mobile: thủ công `eas build`→`eas submit` (eas.json; mobile-ci.yml chỉ tsc+jest, không có build/submit job) + OTA `eas update --channel production` cho JS-only. Lịch sử đã có gap thật: memory ghi "ONLY live-gap left = EAS mobile build" sau khi P1-P7 merged.
- **Tác động:** Mỗi lần ship tính năng cross-platform (vd IAP tháng 7: backend V242 + mobile expo-iap + web paywall copy) rất dễ ở trạng thái backend live nhưng mobile chưa build, hoặc ngược lại mobile build trước khi backend deploy → lỗi contract runtime cho user thật.
- **Khuyến nghị:** Không cần tự động hóa thêm (EAS build có phí + store review vốn manual). Chỉ cần 1 RELEASE_CHECKLIST.md cố định thứ tự: backend deploy (migration trước) → verify prod → web (auto) → eas update/build → smoke test, và đánh dấu commit đã-live của từng platform (git tag backend-live/mobile-1.0.x).

### A6-9. Frontend CI không chạy `next build` — lỗi build production chỉ lộ ở Amplify sau khi merge
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.2 ngày
- **Bằng chứng:** frontend-ci.yml chỉ có: npm ci, `npx tsc --noEmit`, `npm run lint`, `npm test -- --coverage`, i18n check (dòng 28-47). Không có bước `npm run build`. Amplify là nơi duy nhất chạy next build (amplify.yml:31), tức sau merge.
- **Tác động:** Các lớp lỗi chỉ xuất hiện lúc build (SSG page throw, import server-only vào client, env thiếu lúc build) làm đỏ Amplify sau merge → web không ship được cho tới khi fix, trong khi PR đã xanh giả.
- **Khuyến nghị:** Thêm step `npm run build` (với env giả JWT_RSA_PUBLIC_KEY dummy) vào frontend-ci.yml. Chấp nhận +2-3 phút CI.

### A6-10. Secrets = file plaintext + scp; .env.production.example drift nặng so với thực tế; không có quy trình rotation
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.3 ngày
- **Bằng chứng:** deploy-backend.sh:207 scp .env.production lên EC2 mỗi lần deploy (plaintext trên disk EC2). So khớp key: .env.production thật CÓ mà example THIẾU: SEPAY_API_KEY/SEPAY_BANK_*, ELEVENLABS_* (6 key), GEMINI_API_KEY, JWT_RSA_*, GOOGLE_SERVICE_ACCOUNT_JSON...; example CÓ mà thật KHÔNG: OPENAI_API_KEY, AI_SERVER_URL, GRAFANA_ADMIN_*. Không tìm thấy secret manager hay lịch rotate; điểm cộng duy nhất: cơ chế JWT_SECRET_PREVIOUS cho zero-downtime JWT rotation (docker-compose.prod.yml comment) và preflight validate biến bắt buộc (deploy-backend.sh:77-100).
- **Tác động:** Example drift → dựng lại env từ example sẽ thiếu SePay (webhook thanh toán B2B chết im lặng) và ElevenLabs/Gemini (AI feature chết). Không rotation process → key lộ (vd GROQ/AWS) không có đường xử lý nhanh.
- **Khuyến nghị:** Đồng bộ .env.production.example với tập key thật (30 phút, chỉ key không value). Thêm mục "rotate key X" vào RECOVERY_CHECKLIST. Secret manager thật (SSM Parameter Store) để sau launch.

### A6-11. Vùng mù observability cho launch: không Sentry (backend lẫn mobile), không external uptime monitor, APPLE_* env chưa tồn tại
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** grep .env.production: KHÔNG có SENTRY_DSN (application.yml ghi rõ Sentry inert khi DSN unset), KHÔNG có APPLE_* nào (application.yml:529 fallback `bundle-id: ${APPLE_BUNDLE_ID:com.deutschflow.app}` — cần đối chiếu ASC trước IAP launch, khớp blocker đã ghi trong plan). Mobile: eas.json set SENTRY_DISABLE_AUTO_UPLOAD=true mọi profile, Sentry đã gỡ khỏi app (crash launch New-Arch). Không tìm thấy cấu hình uptime check ngoài (UptimeRobot/Pingdom/CloudWatch alarm) trong repo.
- **Tác động:** Sau khi lên App Store: crash mobile chỉ thấy qua App Store Connect (chậm, thiếu context); 500 backend chỉ thấy nếu monitoring stack chạy (finding #3); site down ban đêm không ai biết. Thiếu APPLE_BUNDLE_ID env là blocker cấu hình IAP.
- **Khuyến nghị:** Trước submit: (1) thêm APPLE_* vào .env.production theo MONETIZATION_TECH_PLAN; (2) đăng ký 1 uptime monitor free (UptimeRobot) cho https://api.mydeutschflow.com/actuator/health + web — 15 phút, độc lập với Prometheus; (3) set SENTRY_DSN cho backend (code đã sẵn); mobile crash-reporting để post-1.0.

### A6-12. Monitoring ports bind 0.0.0.0 không auth trong compose (Prometheus/Alertmanager/Loki)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 0.2 ngày
- **Bằng chứng:** docker-compose.prod.yml: prometheus `"9090:9090"`, alertmanager `"9093:9093"`, loki `"3100:3100"`, grafana `"3001:3000"` — bind mọi interface. Prometheus/Alertmanager/Loki không có auth built-in. Probe từ ngoài hiện trả 000 (nhiều khả năng Security Group chặn — không xác minh được vì không SSH được), nhưng chỉ 1 rule SG mở nhầm là toàn bộ metrics + khả năng silence alert lộ public.
- **Tác động:** Nếu SG mở (vd để founder xem Grafana từ nhà): lộ metrics nội bộ (endpoint, latency, error rate), kẻ xấu có thể silence alert qua Alertmanager API không auth.
- **Khuyến nghị:** Đổi thành `127.0.0.1:9090:9090` (tương tự Redis đã làm đúng trong deploy-backend.sh:315) cho prometheus/alertmanager/loki; truy cập qua SSH tunnel. Grafana có auth thì có thể giữ nhưng cũng nên tunnel.

### A6-13. Security CI phần lớn report-only — chỉ gitleaks là gate thật
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** security-ci.yml: semgrep `|| true` (dòng 65), npm audit `|| true` (dòng 91), OWASP Dependency-Check chỉ chạy schedule/manual + `continue-on-error: true` (dòng 98,104). Header tự nhận đây là chủ đích ("flip to blocking once triaged").
- **Tác động:** SAST/dependency vuln mới sẽ pass CI im lặng; artifact SARIF không ai đọc định kỳ (không có evidence review process).
- **Khuyến nghị:** Sau khi triage baseline 1 lần: bỏ `|| true` cho npm audit --audit-level=critical (blocking mức critical thôi), giữ semgrep report-only. Đặt NVD_API_KEY secret để OWASP DC bớt flaky.

### A6-14. Edge TTS sidecar chạy nohup ngoài Docker — không tự hồi phục khi crash/reboot
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.3 ngày
- **Bằng chứng:** deploy-backend.sh:287-288: `nohup "$VENV_DIR/bin/python" .../server.py > /home/ubuntu/edge-tts.log 2>&1 &` — không systemd unit, không restart policy; chỉ được kiểm/khởi động lại ở đầu MỖI LẦN deploy (dòng 282-297). EC2 reboot → sidecar chết cho tới lần deploy kế.
- **Tác động:** TTS (một phần AI Speaking — feature trả tiền của PRO) degrade im lặng giữa 2 lần deploy; backend "tự retry" nhưng không có gì khởi động lại process.
- **Khuyến nghị:** Viết 1 systemd unit `edge-tts.service` (Restart=always) hoặc đóng container với restart unless-stopped như Redis. 1-2 giờ.

### A6-15. deploy-backend.sh có prompt interactive cuối script — chặn dùng unattended/CI
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.1 ngày
- **Bằng chứng:** deploy-backend.sh:536 `read -r -p "Chạy cleanup sau deploy không? [y/N]"` — script sẽ treo nếu chạy không có TTY (cron, CI, agent).
- **Tác động:** Nhỏ hôm nay, nhưng chặn đường tự động hóa deploy (kể cả phương án runner dự phòng ở finding bus-factor).
- **Khuyến nghị:** Gate prompt sau `[ -t 0 ]` hoặc thêm flag `--no-cleanup`/`AUTO_CLEANUP=`. 15 phút.

**Docs-drift phát hiện trong trục này (5):**
- Nhiều docs + memory vẫn ghi "deploy-backend.sh Phase-1 AUTO-COMMIT dirty tree — stash WIP trước" (docs/LOAD_TEST_100CCU_CHECKLIST.md:36, docs/SESSION_SUMMARY_2026-06-22.md:131, docs/PRODUCT_STATE_AND_PLAN_2026-06-22.md:254, docs/CODEBASE_REVIEW_2026-06-10.md:286) — CODE đã fix P0-14: script giờ ABORT khi cây bẩn, không auto-commit (deploy-backend.sh:177-191, xác nhận bởi docs/BACKLOG_CHECKLIST.md:36 đánh dấu done #66).
- Nhận định "CI dead vì GitHub billing (2026-06-13)" đã lỗi thời — gh run list cho thấy cả 4 workflow chạy bình thường tới 01/07/2026 (run 28524184114 v.v.).
- docs/RECOVERY_CHECKLIST.md (cập nhật 12/06) bảng trạng thái ghi hàng loạt mục "CODE XONG — chờ deploy" (telemetry async, circuit breaker, V218...) trong khi các đợt deploy sau đó (main đã deploy nhiều lần tới 01/07) gần như chắc đã ship — trạng thái stale, riêng mục 1.4 AlertManager "chờ user điền bot token" chưa có bằng chứng đã làm.
- docs/DEEP_REVIEW_2026-06-06.md:232 chê deploy script "auto-commit --no-verify" và "docker network connect || true nuốt lỗi" — điểm 1 đã fix trong code; điểm 2 vẫn đúng (deploy-backend.sh:379,472 vẫn `|| true`).
- .env.production.example (10.9KB, sửa 24/06) lệch nặng so với .env.production thật: thiếu toàn bộ SEPAY_*, ELEVENLABS_*, GEMINI_API_KEY, JWT_RSA_*; thừa OPENAI_API_KEY/AI_SERVER_URL không dùng trong env thật.


## A7 Dữ liệu & DB — điểm 3/5

**Tóm tắt:** 240 Flyway migrations (1.7MB, 66 file chứa seed INSERT) chạy fresh-replay được về mặt cú pháp (IT Testcontainers pgvector/pg16 replay toàn bộ, nhưng chỉ chạy trên push main). Đã verify: bug fresh-replay ULTRA=0 token VẪN CÒN — V189 seed ULTRA với daily_token_grant=0 (default V42), price_vnd=NULL, features='{}' vì V42/V73/V129 UPDATE chạy trước khi row tồn tại; tác động giảm vì ULTRA sẽ inactive ở V242 nhưng nên canonicalize luôn trong V242. Phát hiện mới nghiêm trọng hơn: (1) V240 đổi day_of_week sang ISO 1-7 nhưng KHÔNG sửa CHECK (0-6) của V236 → tạo lịch Chủ nhật (7) sẽ 500; comment "safe to re-run" trong V240 cũng sai (không idempotent). (2) AccountDeletionService liệt kê cứng 6 bảng non-cascading nhưng V228 messages và V241 class_channel_messages (ra đời sau) có FK users không cascade → xóa tài khoản fail với user từng nhắn tin — vi phạm App Store Guideline 5.1.1(v). Payment: SePay webhook có idempotency (UNIQUE sepay_id), nhưng payment_transactions/user_subscriptions CASCADE theo user (mất ledger tài chính khi xóa account) và không có ràng buộc chặn 2 subscription ACTIVE chồng nhau (rủi ro khi bán song song Apple IAP + SePay web). Soft-delete chỉ dùng ở class_channel (V241, deleted_at giữ body) và submissions (V136 is_deleted); phần còn lại hard-delete CASCADE. pgvector: 1 bảng knowledge_base vector(1536)+HNSW cho RAG, không seed, kích thước hiện nhỏ (~6KB/row). Backup: KHÔNG tìm thấy cấu hình thực trong repo — chỉ checklist chưa tick. Chuẩn bị payroll: spec docs/SPEC_OWNER_HR_PAYROLL_V1.md đã map reuse chuẩn — mốc giờ dạy = class_sessions.start_at + duration_minutes (kèm status/mode/room), đơn giá = teacher_profiles.hourly_rate_vnd, vai trò = org_members.role; nhưng cần vá unique constraints lịch/điểm danh trước khi xây chấm công.

### A7-1. V240 đổi day_of_week sang ISO 1-7 nhưng không sửa CHECK (0-6) → không thể tạo lịch Chủ nhật
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.25 ngày · **Verify:** ✅ CONFIRMED (spot-check)
- **Bằng chứng:** backend/src/main/resources/db/migration/V236__class_schedule.sql:9 `day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6)`; V240__dayofweek_iso_1_7.sql chỉ UPDATE +1, không ALTER CHECK; ClassScheduleService.java:297 validate 1-7 (7=Chủ nhật) và :270 dùng `getDayOfWeek().getValue()`. Không migration nào khác đụng CHECK này (grep toàn bộ db/migration). Thêm nữa comment V240 'Safe to re-run (WHERE guards)' là SAI: WHERE 0-6 vẫn match giá trị 1-6 đã migrate.
- **Tác động:** Teacher/org đặt lịch cố định vào Chủ nhật → INSERT vi phạm CHECK → 500. Trung tâm tiếng Đức VN dạy cuối tuần rất phổ biến — đây là ca thực tế chắc chắn gặp. Cũng là mốc dữ liệu cho chấm công sau này.
- **Khuyến nghị:** Migration V243: `ALTER TABLE class_schedule_patterns DROP CONSTRAINT <tên auto>; ADD CHECK (day_of_week BETWEEN 1 AND 7)` (tra tên constraint qua pg_constraint hoặc dùng DO block). Thêm IT tạo pattern dayOfWeek=7.
- **Ghi chú verify:** CONFIRMED (spot-check): V236:9 CHECK (0-6) không bị drop ở bất kỳ migration nào; V240 chỉ UPDATE +1 → giá trị 7 (Chủ nhật) vi phạm CHECK.

### A7-2. Delete-account (App Store 5.1.1(v)) sẽ fail FK với user có tin nhắn / bài đăng channel
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ✅ CONFIRMED (đối chứng chéo)
- **Bằng chứng:** AccountDeletionService.java:27-41 chỉ dọn 5 bảng + teacher_sessions rồi `DELETE FROM users`. Nhưng V228__messages.sql:11-12 (sender_id/recipient_id NOT NULL REFERENCES users(id), không ON DELETE) và V241__class_channel.sql:16,20 (sender_id/deleted_by) ra đời SAU service này → FK NO ACTION chặn DELETE. Tương tự org_members.invited_by (V204:37), materials.created_by/attached_by (V227:15-43), class_lesson_logs.created_by (V208:11), org_invoices.created_by (V206:10) chặn xóa user phía org/teacher.
- **Tác động:** Học viên từng dùng nhắn tin 1-1 hoặc channel lớp (P6 vừa merge #184) bấm 'Xóa tài khoản' → 500. Apple test flow này khi review; fail = reject hoặc gỡ app. Đây là regression do V228/V241 thêm sau khi delete-account được viết.
- **Khuyến nghị:** Cập nhật AccountDeletionService: DELETE messages WHERE sender_id=? OR recipient_id=?; với class_channel_messages nên anonymize (đổi sender_id sang user hệ thống hoặc thêm ON DELETE SET NULL + sender_id nullable qua migration) để giữ lịch sử channel cho lớp. Bổ sung IT: tạo user có message+channel post rồi deleteAccount. Cân nhắc thay danh sách bảng hardcode bằng query pg_constraint để test bắt được FK mới.
- **Ghi chú verify:** CONFIRMED (đối chứng chéo): trùng finding A3b đã CONFIRMED bởi verify độc lập.

### A7-3. Fresh-replay: plan ULTRA drift (daily_token_grant=0, price NULL, features rỗng) — bug đã biết VẪN CÒN
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.1 ngày
- **Bằng chứng:** V38:30-33 chỉ seed FREE/PRO/INTERNAL; V42:19 và V73:82 UPDATE ULTRA (0 row trên fresh DB); V129:15 UPDATE price ULTRA (0 row); V189:38-40 mới INSERT ULTRA với monthly_token_limit=850000 nhưng daily_token_grant nhận DEFAULT 0 (V42:10), price_vnd NULL, features_json '{}'. DB prod (đã chạy tuần tự) ≠ DB fresh/test.
- **Tác động:** Môi trường test/IT/staging dựng từ fresh replay có hành vi quota ULTRA khác prod → test entitlement sai lệch. Tác động kinh doanh thấp vì v1.0 chốt ULTRA inactive (V242 sắp tạo), nhưng drift schema-data giữa prod và fresh DB là nợ tiềm ẩn khi ULTRA bật lại.
- **Khuyến nghị:** Trong chính V242 (set is_active=FALSE cho ULTRA): thêm UPDATE canonicalize ULTRA (daily_token_grant, wallet_cap_days, price_vnd, features_json) khớp prod, idempotent. Gần như 0 chi phí vì V242 đằng nào cũng viết.

### A7-4. Ledger tài chính bị CASCADE xóa theo user — mất audit doanh thu/đối soát Apple
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1 ngày · **Verify:** ✅ CONFIRMED (spot-check)
- **Bằng chứng:** V129__payment_gateway.sql:33 `fk_payment_tx_user ... ON DELETE CASCADE`; V38:22 user_subscriptions ON DELETE CASCADE; V189:15 apple_subscriptions ON DELETE CASCADE. Kết hợp AccountDeletionService (hard delete users) → toàn bộ lịch sử giao dịch, entitlement, ledger Apple của user biến mất.
- **Tác động:** Xóa tài khoản (bắt buộc theo App Store) đồng thời xóa bằng chứng thanh toán: không đối soát được refund/chargeback Apple (originalTransactionId mất), báo cáo doanh thu tháng thay đổi hồi tố, rủi ro thuế/kế toán khi có doanh thu thật từ T7-T8/2026.
- **Khuyến nghị:** Migration: đổi FK payment_transactions/apple_subscriptions/user_subscriptions sang ON DELETE SET NULL (user_id nullable) hoặc giữ row với user_id trỏ tới user 'deleted' ẩn danh; AccountDeletionService xóa PII trên users nhưng giữ ledger. Làm TRƯỚC khi lên App Store vì sau đó là tiền thật.
- **Ghi chú verify:** CONFIRMED (spot-check): V38:22 fk_user_subscriptions_user ... ON DELETE CASCADE.

### A7-5. Không có ràng buộc chặn 2 subscription ACTIVE chồng nhau trên user_subscriptions
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 0.5 ngày
- **Bằng chứng:** V38:25-26 chỉ có index thường (user_id,status) và (user_id,plan_code); V189:56 thêm cột source nhưng không unique. Không migration nào tạo partial unique WHERE status='ACTIVE'. (Logic app trong SubscriptionActivationService chưa audit sâu — giả định/cần kiểm chứng có guard tầng service.)
- **Tác động:** v1.0 bán song song Apple IAP (mobile) + SePay 'gói N ngày' (web) cho cùng user: race hoặc bug service có thể tạo 2 row ACTIVE → entitlement/token grant nhân đôi, hoặc Apple expire kết thúc nhầm quyền web. Với 7 user hiện tại chưa đau, nhưng là loại bug tiền bạc khó truy khi có traffic.
- **Khuyến nghị:** Thêm partial unique index `ON user_subscriptions (user_id, source) WHERE status='ACTIVE'` (source nullable → coalesce hoặc backfill source cho row cũ trước), kèm quy tắc resolution 1-user-nhiều-nguồn ở QuotaService được test rõ.

### A7-6. class_schedule_patterns thiếu UNIQUE (class_id, day_of_week) dù service upsert theo cặp này
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** V236 không có unique nào ngoài PK; ClassScheduleService.java:117 `patternRepo.findByClassIdAndDayOfWeek(classId, req.dayOfWeek())` rồi update-or-insert — race 2 request song song tạo 2 pattern cùng thứ. Tương tự class_sessions không có UNIQUE (class_id, start_at) chống trùng buổi khi regenerate từ pattern (V236:23-41).
- **Tác động:** Pattern trùng → sinh buổi học nhân đôi trên lịch teacher/student; buổi trùng phá số liệu 'số buổi dạy' — chính là dữ liệu gốc cho chấm công/lương sắp làm (roadmap ④③).
- **Khuyến nghị:** Migration: dedupe hiện trạng rồi `CREATE UNIQUE INDEX uq_csp_class_dow ON class_schedule_patterns(class_id, day_of_week)` (nếu nghiệp vụ cho 2 ca/ngày thì thêm start_time vào key) và `UNIQUE (class_id, start_at)` trên class_sessions (partial WHERE status <> 'CANCELLED' nếu cần).

### A7-7. class_lesson_logs không UNIQUE (class_id, session_date) và không liên kết class_sessions → điểm danh có thể nhân đôi, không nối được buổi
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** V208__class_lesson_logs_attendance.sql:3-17 — chỉ index thường idx_class_lesson_logs_date(class_id, session_date), không unique, không FK sang class_sessions (V236 ra đời sau, không backfill liên kết). class_attendance PK (lesson_log_id, student_id) đúng nhưng kế thừa rủi ro log trùng ngày.
- **Tác động:** 2 lesson log cùng lớp cùng ngày → học viên bị điểm danh 2 lần/ngày → điểm chuyên cần (feature ⑤ roadmap) sai. Không có cầu nối lesson_log ↔ class_session nghĩa là 'buổi dạy thực tế' (chấm công GV) và 'nhật ký + điểm danh' là 2 nguồn sự thật tách rời theo date, dễ lệch khi buổi bị MOVED.
- **Khuyến nghị:** Thêm cột class_lesson_logs.session_id BIGINT REFERENCES class_sessions(id) ON DELETE SET NULL (backfill best-effort theo class_id+date) + UNIQUE (class_id, session_date) sau khi dedupe. Làm trước khi build chấm công để attendance/chuyên cần neo vào buổi thay vì ngày.

### A7-8. Không tìm thấy chiến lược backup/restore nào trong repo — chỉ checklist chưa tick
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** grep toàn repo: không có script pg_dump/snapshot; deploy-backend.sh và docker-compose.prod.yml không nhắc backup; docs/MASTER_DEPLOYMENT_CHECKLIST.md:158 '[ ] Backup retention: 30 days' (chưa tick), docs/AWS_DEPLOYMENT_CHECKLIST.md:322 chỉ là template CLI `--backup-retention-period 30`. KHÔNG tìm thấy bằng chứng RDS automated backup đã bật/verify — cần xác nhận trên RDS console.
- **Tác động:** RDS t4g.micro single-AZ chứa toàn bộ ledger thanh toán + tiến độ học. Nếu automated backup không bật (hoặc retention mặc định 7 ngày, chưa từng test restore) thì một sự cố xóa nhầm/migration hỏng trước launch App Store là mất dữ liệu không khôi phục được.
- **Khuyến nghị:** 0.5 ngày: (1) xác nhận RDS automated backup ON + retention ≥7 ngày + PITR; (2) chạy thử restore snapshot ra instance tạm 1 lần, đo thời gian; (3) ghi runbook restore ngắn vào docs (thay checklist suông) — bắt buộc trước ngày submit App Store.

### A7-9. Fresh-replay gate chỉ chạy trên push main, PR không được bảo vệ; deploy CI đã tắt
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 0.5 ngày
- **Bằng chứng:** .github/workflows/backend-ci.yml:66 integration-tests `if: github.ref == 'refs/heads/main' && push` (Testcontainers pgvector/pg16 replay full Flyway — PostgresTestContainerHolder.java:18); PR chỉ chạy compile+unit. backend-ci.yml:100 deploy `if: false`. Ghi chú cũ (2026-06-13) CI từng chết vì GitHub billing — hiện trạng quota cần kiểm chứng.
- **Tác động:** Migration hỏng fresh-replay (như lớp bug ULTRA/V240) chỉ bị phát hiện SAU khi merge vào main, hoặc không bao giờ nếu CI billing lại chết. Với 1 founder tự deploy tay, đây là lưới an toàn duy nhất cho 240 migrations.
- **Khuyến nghị:** Thêm job nhẹ chạy trên PR đụng db/migration: chỉ `flyway migrate` vào container pgvector (không cần full IT, ~2-3 phút). Kèm 1 assertion SQL sau replay: các plan FREE/PRO/DEFAULT có daily_token_grant đúng kỳ vọng.

### A7-10. 66/240 migration là seed content trộn lẫn schema (1.7MB) — nội dung học bị đóng băng trong migration
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0 ngày
- **Bằng chứng:** 66 file chứa INSERT INTO (đếm grep); file lớn nhất V181__curriculum_b1.sql 48K, V180 36K, V184 32K; nhiều file thiếu guard idempotent (106/240 không có IF EXISTS/ON CONFLICT — đa số là seed chạy-một-lần nên chấp nhận được).
- **Tác động:** Sửa 1 câu trong giáo trình = 1 migration mới; replay fresh DB chậm dần; lịch sử schema khó đọc. Không phải bug, là nợ kiến trúc content-in-migration đã ăn sâu — chi phí đảo ngược cao hơn lợi ích ở giai đoạn này.
- **Khuyến nghị:** KHÔNG refactor bây giờ (không đáng trước deadline App Store). Quy ước từ nay: content mới đi qua bảng + admin import (đã có media_assets/mock_exam_packs admin CRUD) thay vì migration; chỉ schema vào Flyway.

### A7-11. pgvector: 1 bảng knowledge_base vector(1536) HNSW — nhỏ, nhưng cần để mắt RAM khi RAG phình
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0 ngày
- **Bằng chứng:** V132__add_knowledge_base_pgvector.sql: embedding vector(1536) NOT NULL + HNSW vector_cosine_ops; dùng bởi com.deutschflow.ai.rag (KnowledgeBaseRepository/EmbeddingClient/KnowledgeBaseService). Không migration nào seed knowledge_base → dữ liệu nạp runtime, kích thước hiện tại giả định nhỏ (cần kiểm chứng row count prod).
- **Tác động:** ~6KB/row (1536 float4) + HNSW index; 10k row ≈ 60-100MB — trên RDS t4g.micro 1GB shared_buffers rất hẹp, HNSW ngoài cache sẽ chậm. Hiện chưa phải vấn đề với 7 user.
- **Khuyến nghị:** Không hành động ngay. Ghi 1 dòng vào monitoring: nếu knowledge_base > ~20k row hoặc thêm embedding per-user thì cân nhắc halfvec(1536) (giảm 50% size, pgvector ≥0.7) hoặc nâng RDS.

### A7-12. Soft-delete không nhất quán: chỉ channel (V241) và submissions (V136); user/org/class là hard-delete CASCADE
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** V241__class_channel.sql:4-20 soft (deleted_at/deleted_by, giữ body); V136 submissions.is_deleted; org_members dùng lifecycle status ACTIVE/REVOKED/LEFT (V226) — giữ row, tốt. Ngược lại teacher_classes xóa → CASCADE class_sessions/patterns/lesson_logs/attendance/channel (V236:8,25; V208:5; V241:15); organizations xóa → CASCADE org_members/invites nhưng users.org_id/teacher_classes.org_id (V204:47-48) không ON DELETE → chặn xóa org (vô tình an toàn).
- **Tác động:** Teacher xóa nhầm lớp = mất vĩnh viễn toàn bộ lịch + điểm danh + nhật ký + chat của lớp — với B2B (trung tâm trả tiền) đây là dữ liệu vận hành họ cần giữ, và sắp là dữ liệu gốc tính LƯƠNG (xóa lớp = mất bằng chứng buổi dạy đã trả công).
- **Khuyến nghị:** Trước khi xây payroll: chuyển xóa lớp sang soft-delete (archived_at trên teacher_classes, filter ở query) — hoặc tối thiểu chặn xóa lớp đã có lesson_logs/sessions quá khứ ở tầng service. Giữ nguyên CASCADE cho lớp rỗng.

### A7-13. Chuẩn bị domain chấm công/payroll: nền có sẵn khá tốt, spec đã đúng hướng — mốc giờ dạy = class_sessions.start_at
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** docs/SPEC_OWNER_HR_PAYROLL_V1.md (draft 23/06) đã map reuse chuẩn xác với code: ClassSession (start_at, duration_minutes, mode, room, status SCHEDULED/CANCELLED/MOVED — V236:23-37) = mốc gắn check-in QR; teacher_profiles.hourly_rate_vnd (V179:5, default 200000) = đơn giá; org_members.role OWNER/MANAGER/TEACHER (V204+V225/V229) = phạm vi chấm công; notification infra sẵn (V176+). THIẾU hoàn toàn: bảng check-in/QR token, attendance nhân sự, kỳ lương — đúng như spec ghi.
- **Tác động:** Domain mới chỉ cần ~3-4 bảng mới (staff_checkins FK class_sessions.id + users.id, qr_tokens, payroll_periods, payroll_items) — không phải đụng schema học tập. Điều kiện tiên quyết là các finding #1 (CHECK Chủ nhật), #6 (unique pattern/session) và #12 (soft-delete lớp) vì chấm công tin vào tính đúng và tính bất biến của class_sessions.
- **Khuyến nghị:** Xây theo spec với package com.deutschflow.workforce; check-in neo vào class_sessions.id (không neo date); ca hành chính (manager/owner) dùng bảng shift riêng vì không có class_session. Vá #1/#6/#12 trong cùng sprint mở màn.

**Docs-drift phát hiện trong trục này (5):**
- V240__dayofweek_iso_1_7.sql tự ghi 'Safe to re-run (WHERE guards against already-migrated rows)' — SAI: WHERE 0-6 vẫn match giá trị 1-6 đã migrate; chỉ an toàn nhờ Flyway chạy một lần.
- V38__subscription_plans...sql comment 'Seed default plans (safe to re-run? insert-only is fine)' — chính pattern seed-không-đủ này gây bug ULTRA fresh-replay mà V189 phải vá; comment tạo cảm giác an toàn giả.
- docs/SPEC_OWNER_HR_PAYROLL_V1.md ghi 'Migration ... tới ~V99+' trong bảng rà backend — thực tế đã tới V241; phần còn lại của bảng reuse vẫn khớp code.
- docs/MASTER_DEPLOYMENT_CHECKLIST.md và AWS_DEPLOYMENT_CHECKLIST.md liệt kê backup dạng checklist '[ ]' chưa tick — không phản ánh (và không chứng minh) trạng thái backup prod thực tế.
- AccountDeletionService.java javadoc khẳng định 'A handful of tables use a plain FK ... those are removed first' — danh sách đã lỗi thời so với schema: V228 messages và V241 class_channel_messages không nằm trong danh sách.


# TRỤC B — SẢN PHẨM & UX


## B Sản phẩm & UX — điểm 3/5

**Tóm tắt:** Luồng lõi web: onboarding (frontend/src/app/(auth)/onboarding) → learn/roadmap/SRS/grammar → AI speaking (/speaking/chat) → mock exam (/student/mock-exam, PremiumGate) → assessment/certificates — không tìm thấy dead-end hay màn "coming soon" trên web student; mobile chỉ có 1 "Sắp ra mắt" (đổi ngôn ngữ, profile.tsx:165). Mobile loop dừng ở mock exam LESEN-only và không có certificates/leaderboard/badges/tutor. TRẢI NGHIỆM FREE HIỆN TẠI: user mới được auto 7 ngày PRO trial (AuthService.java:87 → StudentTrialSubscriptionProvisioner — lưu ý: code cấp plan_code=PRO, không phải FREE); hết trial → DEFAULT 0 token → backend ném QuotaExceededException = HTTP 429 ProblemDetail (GlobalExceptionHandler.java:148). Web có SpeakingQuotaBlockedBanner + toast quota i18n (quotaReset.ts) — chấp nhận được; mobile KHÔNG có nhánh 429 nào (grep 0 hit), chỉ Alert.alert('Lỗi', message-thô-tiếng-Anh) và trên iOS màn Upgrade là màn "neutral" không có nút mua (paywall.ts:13 PAYWALL_ENABLED = Platform.OS !== 'ios'). Đây là input trực tiếp cho paywall wall: phải (a) wire expo-iap, (b) map 429 type=quota-exceeded → điều hướng paywall, (c) pre-gate entry AI theo entitlement. SRS: xác nhận FSRS-4.5 primary + SM-2 migrate-on-read (FsrsService.java, SrsService.java:23-35) — đúng như docs. Gamification: streak+XP live trên home mobile; coins đã build nhưng dark flag. B2B: teacher/org route đầy đủ (classes/grading/reports/sessions/materials; org: teachers/students/invitations/billing), lịch dạy đã parity; chấm công/QR check-in/lương (roadmap owner) hoàn toàn chưa tồn tại trong code — làm tay 100%. i18n: messages vi/en/de gần khớp key (en thiếu 2 key adminNav) nhưng chỉ ~15/43 student routes dùng useTranslations — nửa app web hardcode tiếng Việt (FE-M7 còn nguyên). 5 drop-off rủi ro nhất: (1) ngày 8 hết trial chạm AI trên iOS → alert thô + không mua được; (2) web bấm nâng cấp → MoMo dummy secret/Stripe USD → thanh toán fail; (3) học viên luyện thi trên mobile phát hiện mock exam chỉ có đọc; (4) start speaking fail (quota/LLM) → 'Không thể bắt đầu' generic ngay first-run vì onboarding archetype replace thẳng vào speaking (mobile onboarding.tsx:254-262); (5) freemium wall chưa được báo trước ở entry — user chọn persona, gõ chat rồi mới bị chặn server-side.

### B-1. iOS không có purchase path: PAYWALL_ENABLED=false, expo-iap chưa wire — free/hết-trial chạm AI là dead-end thương mại
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 5 ngày · **Verify:** ✅ CONFIRMED (spot-check)
- **Bằng chứng:** mobile/lib/paywall.ts:13 `export const PAYWALL_ENABLED = Platform.OS !== 'ios'`; mobile/app/(student)/upgrade.tsx:30-51 render màn neutral không nút mua (comment: 'no StoreKit IAP wired yet'); backend Apple IAP đã sẵn (/api/payments/apple, V189) nhưng client chưa gọi.
- **Tác động:** Đúng vào quyết định kinh doanh v1.0 (free+PRO IAP): user hết trial trên iOS không thể trả tiền trong app → mất 100% conversion mobile, và App Store copy hứa subscription sẽ bị reviewer soi.
- **Khuyến nghị:** Wire expo-iap → /api/payments/apple/verify+sync, bật PAYWALL_ENABLED trên iOS với paywall screen thật (monthly+yearly PRO), giữ neutral screen làm fallback khi products load fail.
- **Ghi chú verify:** CONFIRMED (spot-check): paywall.ts:13 PAYWALL_ENABLED = Platform.OS !== 'ios'; mobile/package.json 0 match expo-iap/google-mobile-ads.

### B-2. Mobile không xử lý 429 quota-exceeded: hết token → Alert thô 'AI token quota exceeded.' (tiếng Anh), không điều hướng paywall
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1.5 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** Backend: QuotaService.java:75-81 ném QuotaExceededException → GlobalExceptionHandler.java:148-170 trả 429 type='quota-exceeded' kèm snapshot. Mobile: grep '429|quota' trong mobile/app+lib = 0 nhánh xử lý; speaking.tsx:275 `Alert.alert('Không thể bắt đầu', apiMessage(e))` và :305 `Alert.alert('Lỗi', apiMessage(e))`; apiMessage (mobile/lib/api.ts:11-20) trả nguyên message backend.
- **Tác động:** Trải nghiệm hết-trial 'gãy đột ngột' đúng như lo ngại: lỗi thô, sai ngôn ngữ, không CTA nâng cấp — chính là chỗ cần dựng paywall wall.
- **Khuyến nghị:** Thêm interceptor/helper isQuotaError(e) (status 429 + type quota-exceeded) → modal 'Hết lượt AI' tiếng Việt với CTA mở /(student)/upgrade; áp cho speaking, weekly-speaking, node-practice (chấm AI).

### B-3. Web pricing chào MoMo + Stripe + ULTRA — mâu thuẫn quyết định đã chốt và MoMo đang dummy secret → bấm nâng cấp = thanh toán fail
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 4 ngày · **Verify:** ✅ CONFIRMED (spot-check)
- **Bằng chứng:** frontend/src/app/student/pricing/page.tsx:6 import {createMomoOrder, createStripeSession}; :10 LoadingKey gồm cả 'momo-ULTRA'/'stripe-ULTRA'. Quyết định: MoMo hoãn (PAY-1 dummy secret — audit/full-2026-06-24), ULTRA inactive (V242), web billing = SePay 'gói N ngày' (SePay hiện chỉ wired B2B org-invoice).
- **Tác động:** Học viên VN hết trial trên web đi đúng funnel nâng cấp nhưng không có phương thức thanh toán hoạt động thực tế → drop-off tại điểm chuyển đổi quan trọng nhất của web.
- **Khuyến nghị:** Sửa pricing page: ẩn ULTRA + MoMo; thêm luồng SePay VietQR 'gói N ngày' cho student (tái dùng webhook SePay B2B); quyết định giữ/bỏ Stripe theo khuyến nghị trục thanh toán.
- **Ghi chú verify:** CONFIRMED (spot-check): pricing/page.tsx import createMomoOrder/createStripeSession, PLAN_CODES gồm ULTRA, handleMomoCheckout(PRO|ULTRA).

### B-4. Không có pre-gate entitlement phía client cho AI: free user đầu tư thời gian (chọn persona, gõ chat) rồi mới bị chặn server-side
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 2 ngày · **Verify:** ⚪ chưa qua vòng verify
- **Bằng chứng:** mobile/app/(student)/speaking.tsx:341 chỉ gate voice-record bằng isPro (Alert 'Tính năng PRO'), còn start session + chat text đi thẳng backend; web /speaking/chat chỉ hiện SpeakingQuotaBlockedBanner sau khi quotaBlocked=true (page.tsx:511-513) tức đã ăn 429. Không tìm thấy check quota/plan nào trước khi vào màn speaking ở cả 2 client.
- **Tác động:** Wall xuất hiện SAU khi user đã kỳ vọng — cảm giác 'lỗi app' thay vì 'tính năng trả phí'; tệ nhất ở first-run vì onboarding archetype replace thẳng vào speaking (mobile/app/(auth)/onboarding.tsx:254-262).
- **Khuyến nghị:** Fetch my-plan/quota snapshot ở entry (CompanionSelect web + speaking.tsx mobile): nếu DEFAULT/0 token → render paywall card ngay tại chỗ thay vì cho start; giữ 429 làm lưới an toàn.

### B-5. Parity mobile↔web: mock exam mobile chỉ LESEN objective — loop 'luyện thi B1 → tốt nghiệp' không hoàn thành được trên mobile
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 3 ngày
- **Bằng chứng:** mobile/lib/examApi.ts:35 comment 'The app supports the auto-scored objective LESEN items only' + :114 lọc `if (name !== 'LESEN')`; web mock-exam full sections + AI eval + PremiumGate (frontend/src/app/student/mock-exam/page.tsx:19,720). Mobile cũng không có certificates/leaderboard/badges/game/tutor/book-session/vocab-analytics/speaking-history/review-queue (so route trees frontend/src/app/student vs mobile/app/(student)).
- **Tác động:** Học viên mobile-first (đối tượng App Store v1.0) không trải nghiệm được value prop 'thi thử Goethe chuẩn' — đúng tính năng đang bán trong PRO_FEATURES của upgrade.tsx ('Mock Exam Goethe chuẩn').
- **Khuyến nghị:** V1.0: thêm HÖREN objective (audio đã có expo-audio) hoặc ít nhất sửa copy paywall/store không hứa 'Mock Exam Goethe chuẩn' đầy đủ trên mobile; đưa full-exam vào web-handoff banner ('làm bài đầy đủ trên web').

### B-6. Trial thực tế là PRO 7 ngày auto cấp lúc đăng ký — khớp quyết định, nhưng message hết hạn dành cho plan FREE, còn DEFAULT hết token nhận message tiếng Anh không nói lý do
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** AuthService.java:87 gọi StudentTrialSubscriptionProvisioner.provisionSevenDayTrial (plan_code='PRO'); QuotaService.assertAllowed:71-76 chỉ có message tiếng Việt 'Gói dùng thử 7 ngày đã hết hạn…' cho PLAN_FREE (nhánh gần như dead vì trial cấp PRO); nhánh thực tế user rơi vào là :78 'AI token quota exceeded.' (EN, không CTA).
- **Tác động:** Message hết-trial được viết cẩn thận nhưng nằm ở nhánh không chạy; user thật nhận chuỗi kỹ thuật tiếng Anh — thông điệp nâng cấp không bao giờ tới người cần.
- **Khuyến nghị:** Chuẩn hoá message 429 cho DEFAULT/hết-token thành tiếng Việt + planCode trong ext (đã có sẵn trong ProblemDetail) để client render wall đúng ngữ cảnh (hết trial vs hết quota tháng PRO).

### B-7. i18n web nửa vời: chỉ ~15/43 student routes dùng next-intl, mock-exam/tutor/assignments/classes hardcode tiếng Việt — en/de locale vô dụng ở nửa app
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** grep useTranslations: 15/43 thư mục student (65 file toàn frontend); messages vi/en/de đồng bộ key (1301/1299/1301, en thiếu adminNav.refresh/refreshing); FE-M7 trong docs/CODEBASE_REVIEW_2026-06-10.md:238 vẫn đúng nguyên trạng; mobile 100% tiếng Việt, đổi ngôn ngữ = Alert 'Sắp ra mắt' (mobile/app/(student)/profile.tsx:165).
- **Tác động:** Với target VN→Đức thì tiếng Việt-first chấp nhận được cho v1.0, nhưng UI có language switcher web tạo kỳ vọng sai (đổi sang EN/DE chỉ đổi được nửa app).
- **Khuyến nghị:** V1.0: KHÔNG dịch thêm; thay vào đó ẩn/thu hẹp language switcher web về các khu đã dịch, bổ sung 2 key en thiếu. Dịch mock-exam/tutor để dành sau launch.

### B-8. Mobile QA debt còn 59 MEDIUM + 97 LOW mở (HIGH đã đóng 25/25); parity design v2 còn Grammar hub + Skill Tree canvas chưa build theo mockup
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 2 ngày
- **Bằng chứng:** mobile/QA_SCREENS_AUDIT.md header re-verify 2026-07-01: 24/25 HIGH fixed + H2 fixed trong nhánh → HIGH sạch; còn nguyên 59 MEDIUM/97 LOW. mobile/DESIGN_PARITY_QA.md BUILD LOG: 'Còn lại (chưa làm): Grammar leveled hub + quiz flow; Skill Tree SVG canvas' + mục 'Cần visual-QA Xcode'. (Lưu ý: Skill Tree canvas thực tế ĐÃ làm sau đó trên nhánh chore/ios-deploy-sdk54 theo mobile/SKILL_TREE.md — doc parity lỗi thời một phần.)
- **Tác động:** Không chặn submit (0 CRITICAL/HIGH), nhưng cụm MEDIUM lặp lại (safe-area dưới tab bar, hex-alpha token, Dynamic Type) sẽ lộ trên máy thật/reviewer.
- **Khuyến nghị:** Trước submit chỉ quét cụm MEDIUM ảnh hưởng App Review: safe-area bottom + Dynamic Type maxFontSizeMultiplier; phần còn lại để OTA sau (EAS Update đã sẵn).

### B-9. AI Speaking: chat non-streaming → độ trễ cảm nhận 2-10s mỗi lượt; web TTS phụ thuộc XTTS_BASE_URL ngrok ephemeral
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 1.5 ngày
- **Bằng chứng:** mobile/app/(student)/speaking.tsx:292 `await speakingApi.chat(...)` chờ full response với stage 'thinking' (không stream token); TTS mobile dùng expo-speech local de-DE (speaking.tsx:193) — nhanh, offline. Web XTTS streaming per-sentence deploy với XTTS_BASE_URL=ngrok ephemeral (memory project_xtts_streaming_tts — cần kiểm chứng trạng thái host hiện tại).
- **Tác động:** Mỗi lượt hội thoại chờ trắng vài giây làm giảm cảm giác 'trò chuyện'; nếu ngrok chết thì giọng web im lặng không báo lỗi rõ.
- **Khuyến nghị:** V1.0 mobile giữ nguyên (expo-speech ổn); thêm skeleton/typing indicator có nhịp + timeout message; web: chuyển XTTS sang host cố định hoặc fallback Web Speech API khi XTTS unreachable.

### B-10. B2B UX: quản lý lớp/lịch/roster/chấm bài đã trọn vẹn trên web, nhưng toàn bộ khối vận hành nhân sự (chấm công, QR check-in, lương, chuyên cần) chưa tồn tại — làm tay 100%
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 10 ngày
- **Bằng chứng:** Route đầy đủ: frontend/src/app/teacher/{classes,grading,reports,sessions,materials,media} + /org/{teachers,students,invitations,billing,classes}; lịch dạy parity V236 đã deploy. Không tìm thấy domain/route nào cho attendance/checkin/payroll trong backend/src/main/java/com/deutschflow (danh sách 30 domain không có) lẫn frontend — khớp roadmap owner items (2)-(5) là việc MỚI.
- **Tác động:** Design partner B2B (mục tiêu T7-T8/2026) sẽ phải chạy song song Excel/Zalo cho chấm công-lương; teacher grading và roster thì không có gap lớn phải làm tay.
- **Khuyến nghị:** Không nhồi vào v1.0 App Store. Sequence đúng phụ thuộc đã chốt: chấm công (4) tối thiểu = bảng session check-in thủ công trên web trước, QR (2) là enhancement; ước lượng riêng ngoài scope launch.

### B-11. Gamification: streak+XP live, skill tree mobile hoàn thiện, nhưng coins đã build xong lại nằm dark flag — retention loop chưa khai thác
- **Mức độ:** 🟢 Thấp · **Tin cậy:** MEDIUM · **Effort:** 1 ngày
- **Bằng chứng:** mobile/app/(student)/index.tsx:171 hiển thị streakDays; skill tree 'Cây học tập' full spec (mobile/SKILL_TREE.md); coin system merged V226 nhưng dark behind app.coins.enabled (memory project_student_coin_currency — cần kiểm chứng flag prod).
- **Tác động:** Free tier sau khi mất AI chỉ còn nội dung tĩnh — coins/leaderboard là thứ giữ chân free user xem ads; để dark là bỏ phí engine đã trả chi phí build.
- **Khuyến nghị:** Cân nhắc bật coins cho free tier như phần thưởng phi-AI (earn khi học tĩnh) đồng thời với paywall — tăng lý do quay lại của free user xem ads.

**Docs-drift phát hiện trong trục này (5):**
- docs/DEUTSCHFLOW_COMPLETE_FLOWS.md §1 nói 'PostgreSQL hoặc MySQL' — code là PostgreSQL-only (StudentTrialSubscriptionProvisioner.java comment ghi rõ đường MySQL ON DUPLICATE KEY đã bỏ); và nói 'GPT-4/OpenAI' trong khi stack AI thực tế là Groq/Llama.
- mobile/DESIGN_PARITY_QA.md liệt kê 'Skill Tree SVG canvas — chưa làm' nhưng skill tree đã build đầy đủ sau đó (mobile/SKILL_TREE.md, commits trên chore/ios-deploy-sdk54) — doc parity lỗi thời một phần.
- docs/CODEBASE_REVIEW_2026-06-10.md FE-M7 (teacher dashboard + mock exam hardcode tiếng Việt) vẫn đúng nguyên trạng — chưa remediate dù review đánh dấu remediation '~complete'.
- Memory/plan gọi trial là 'FREE trial 7 ngày' nhưng code cấp plan_code='PRO' 7 ngày (StudentTrialSubscriptionProvisioner.java:18,34); nhánh message hết hạn cho PLAN_FREE trong QuotaService.assertAllowed gần như dead code.
- QA_SCREENS_AUDIT.md thân bài vẫn ghi '25 HIGH cần xử lý trước submit' trong khi header re-verify 2026-07-01 xác nhận đã fix hết — người đọc lướt dễ hiểu sai trạng thái.


# TRỤC C — KINH DOANH & VẬN HÀNH


## C Kinh doanh & vận hành — điểm 2.5/5

**Tóm tắt:** Trục C xác nhận bằng code: (1) SePay CHỈ wired cho B2B org-invoice (SepayWebhookController → OrgInvoice, pattern DFINV, V216) — web-PRO-SePay là việc mới ~4-6 ngày nhưng backend activation đã sẵn (SubscriptionActivationService.activateWithExplicitEnd hỗ trợ "gói N ngày"). (2) Token-pool org có enforcement thật (OrgQuotaService.wouldExceedOrgPool gọi từ QuotaService.assertAllowed) nhưng là soft-cap check-then-debit tự nhận trong code (P-9) — overage có thật, chỉ có log-marker, chưa có alert. (3) Bề mặt monetization lệch nặng quyết định đã chốt: upgrade.tsx hứa "AI Speaking không giới hạn", pricing i18n cho FREE có "Mini Quiz AI"/"2 Persona", STORE_COPY hứa AI speaking "Start free", web pricing vẫn bán ULTRA qua MoMo+Stripe. (4) Chi phí đọc được từ xlsx: ~4,38M VNĐ/tháng dự kiến T6 (AWS ~$85 + API 789k + tools ~1,1M), fixed-cost chiếm áp đảo so với AI COGS 307đ/user. (5) SPOF: Groq single-provider cho chat+chấm+Whisper; XTTS qua ngrok (có fallback); 1 EC2/1 RDS 1GB không HA. (6) Marketplace giáo viên = niêm yết thuần (hourlyRateVnd hiển thị), KHÔNG có booking/hoa hồng/thanh toán. (7) App Store: config app.json đã tốt (SDK54, projectId thật, privacy manifest PostHog, supportsTablet=false) nhưng expo-iap + react-native-google-mobile-ads CHƯA cài, PAYWALL_ENABLED tắt trên iOS, 2 blocker config backend (APPLE_BUNDLE_ID default sai + apple_products IDs prefix com.deutschflow.app.* ≠ bundle thật com.cudinh.mydeutschflow), Privacy/Support URL còn placeholder.

### C-1. SePay chỉ wired B2B org-invoice — web-PRO-SePay cho học viên là việc mới hoàn toàn (nhưng backend activation sẵn 70%)
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 5 ngày
- **Bằng chứng:** backend/src/main/java/com/deutschflow/payment/service/SepayWebhookService.java:43 pattern `DFINV[0-9A-F]{12}` chỉ match mã hóa đơn org; :70-71 chỉ tra OrgInvoiceRepository.findByPaymentCode; :93 activateOrg → Organization + AdminOrgService.activateEntitlements. Toàn bộ package payment/ không có DTO/endpoint SePay nào cho học viên (chỉ Stripe/MoMo/Apple). Frontend chỉ đụng SePay ở admin settings (frontend/src/app/v2/admin/settings/page.tsx) và orgApi.ts. Ngược lại SubscriptionActivationService.activateWithExplicitEnd (payment/service/SubscriptionActivationService.java:43) đã nhận endsAt tùy ý + source → hỗ trợ 'gói N ngày' không auto-renew ngay.
- **Tác động:** Quyết định web billing = SePay VietQR 'gói N ngày' hiện KHÔNG có đường code nào; web hiện chỉ có MoMo (hoãn) và Stripe. Không ship = web không thu được tiền học viên.
- **Khuyến nghị:** Mảnh cần build: (a) migration bảng student_payment_intents (user_id, plan_code, duration_days, amount, payment_code prefix riêng vd DFPRO+hex, status, expires_at); (b) endpoint tạo intent + trả VietQR (SePay QR = STK + số tiền + memo chứa code); (c) mở rộng SepayWebhookService: match thêm pattern DFPRO → gọi SubscriptionActivationService.activateWithExplicitEnd(userId, 'PRO', now, now+N ngày, 'SEPAY', true), giữ idempotency sepay_id sẵn có; (d) FE trang initiation hiển thị QR + poll trạng thái; (e) xử lý underpay/quá hạn intent như org (log-only).

### C-2. Token-pool org: enforcement có thật nhưng là soft-cap check-then-debit — code tự nhận overage, chưa có alert pipeline
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** QuotaService.java:53-62 javadoc tự nhận: 'N request đồng thời của cùng một user đều có thể pass check trước khi request đầu tiên kịp debit → overage tối đa ≈ (số request đồng thời) × (token/request)'; debit chạy SAU LLM 2-10s (applyUsageDebit :113). Org pool: wouldExceedOrgPool (OrgQuotaService.java:76) là @Transactional(readOnly) — check thời điểm, KHÔNG reserve atomic; counter org_monthly_token_counters chỉ tăng sau khi usage ghi ledger → nhiều member org đồng thời vẫn vượt pool. Overage chỉ ghi log marker `[Quota][P-9/P-11][OVERAGE]` (QuotaService.java:135) và alert 80% cũng chỉ là log.warn (OrgQuotaService.java:151). Không tìm thấy alerting rule nào tiêu thụ 2 marker này trong docker/ hoặc cấu hình Loki.
- **Tác động:** Đây đúng là rủi ro margin #1 của B2B GTM: org trả gói cố định nhưng tiêu thụ token có thể vượt pool không giới hạn cứng; founder chỉ biết nếu tự grep log. Với COGS 307đ/user hiện tại rủi ro nhỏ, nhưng scale theo design partner.
- **Khuyến nghị:** Không làm hard-cap ngay (code ghi rõ đụng 20+ call-site). Thay vào đó: (1) thêm Loki/Alertmanager rule đếm marker [OVERAGE] và 'Org token pool alert' → notify (0.5 ngày); (2) dashboard admin ai-cost-summary đã có — thêm cột overage/tháng theo org; (3) hạ AiRateLimiterService window cho org metered nếu overage thực tế xuất hiện.

### C-3. iOS v1.0 chưa có bất kỳ đường thu tiền client nào: PAYWALL tắt, expo-iap và AdMob SDK chưa cài
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 6 ngày
- **Bằng chứng:** mobile/lib/paywall.ts:13 `PAYWALL_ENABLED = Platform.OS !== 'ios'`; mobile/app/(student)/upgrade.tsx:30-50 render màn trung tính không giá/không nút mua trên iOS. mobile/package.json dependencies: KHÔNG có expo-iap, react-native-iap, react-native-google-mobile-ads hay bất kỳ package ads/purchase nào (đã grep). Backend Apple IAP thì đã sẵn (payment/apple/* + AppleIapController).
- **Tác động:** Quyết định v1.0 = free+ads+PRO subscription qua Apple IAP hiện là 0% ở client. Đây là đường găng lớn nhất còn lại của deadline tháng 7.
- **Khuyến nghị:** Thứ tự: cài expo-iap → wire upgrade.tsx (fetch products từ /api/payments/apple/products, purchase → /verify, nút Restore) → flip PAYWALL_ENABLED per-build → cài react-native-google-mobile-ads config non-personalized (npa=1), không ATT. Cần native rebuild (không OTA được).

### C-4. 2 blocker config backend Apple IAP: APPLE_BUNDLE_ID default sai + apple_products product IDs không khớp bundle thật
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** backend/src/main/resources/application.yml:529 `bundle-id: ${APPLE_BUNDLE_ID:com.deutschflow.app}` trong khi mobile/app.json ios.bundleIdentifier = `com.cudinh.mydeutschflow`. V189__apple_iap.sql:44-48 seed apple_products với product_id prefix `com.deutschflow.app.pro.monthly|yearly` + 2 ULTRA rows is_active=TRUE (quyết định: ULTRA inactive). application.yml:530 APPLE_APP_APPLE_ID rỗng (bắt buộc cho Production verify).
- **Tác động:** JWS verify sẽ reject mọi transaction thật (bundle mismatch) và productId từ ASC sẽ không map được plan → mua xong không kích hoạt. Lỗi im lặng, chỉ lộ khi test sandbox/prod.
- **Khuyến nghị:** Flyway V242: UPDATE apple_products product_id theo IDs thật tạo trong App Store Connect + set ULTRA rows is_active=FALSE + set subscription_plans ULTRA is_active=FALSE; set env APPLE_BUNDLE_ID=com.cudinh.mydeutschflow và APPLE_APP_APPLE_ID trên EC2 trước deploy.

### C-5. Copy marketing hứa AI cho free và "không giới hạn" — lệch trực tiếp quyết định đã chốt (free = không AI, PRO = token wallet)
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** Câu chữ chính xác cần sửa: (1) mobile/app/(student)/upgrade.tsx:11 & :38 'AI Speaking không giới hạn' — PRO thực tế là wallet 400K token/ngày cap 30 ngày (V73__subscription_plans_v2.sql:55-57, QuotaService wallet). (2) frontend/messages/vi.json pricing.plans.FREE.features: '✅ 2 Persona (Emma & Anna)', '✅ Mini Quiz AI (2 tab)' — hứa AI cho free; pricing.plans.PRO: '✅ Ôn tập không giới hạn'; pricing.subtitle 'Mở khoá toàn bộ sức mạnh AI... gấp 10 lần'. (3) plans/appstore/STORE_COPY.md:23 promotional 'AI speaking practice... Start free'; :51-52 'core lessons and practice cost nothing (ad-supported)' + Pro chỉ 'deeper AI feedback' (ngụ ý free có AI feedback nông); :77 & :105-106 bản VI tương tự 'luyện nói cùng AI... Bắt đầu miễn phí'. Ghi chú :182 đã tự cảnh báo tránh 'unlimited' nhưng thân bài EN/VI ở mục AI Speaking chưa nói Pro-only.
- **Tác động:** Apple reviewer test bằng tài khoản free (DEFAULT = 0 token, V73:6-8) sẽ thấy tính năng quảng cáo trong listing bị chặn paywall → rủi ro reject 2.3.1 (metadata misleading); user thật churn vì hứa hão.
- **Khuyến nghị:** Sửa 1 lượt: bỏ 'không giới hạn' → 'hạn mức luyện tập mỗi ngày cao'; FREE features chỉ liệt kê nội dung tĩnh + SRS + ads; STORE_COPY promo đổi thành 'AI speaking with Pro / dùng thử 7 ngày'; thêm dòng 'AI Speaking & chấm AI là tính năng Pro (có dùng thử)'.

### C-6. Web pricing page bán ULTRA qua MoMo + Stripe — ngược cả 3 quyết định (ULTRA hoãn, MoMo hoãn, SePay thay thế)
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** frontend/src/app/student/pricing/page.tsx:9-16 PLAN_PRICES gồm ULTRA 699000; :81-97 handleMomoCheckout (MoMo dummy secret theo audit PAY-1); :99-114 handleStripeCheckout; :156 render cả 3 card FREE/PRO/ULTRA với nút mua. Sau V242 (ULTRA is_active=FALSE) user mua ULTRA sẽ trả tiền nhưng loadActiveCoveringSubscription (QuotaService.java:560 `AND sp.is_active`) không resolve plan → bị phục vụ DEFAULT 0 token (chính scenario D-5 log.error QuotaService.java:541).
- **Tác động:** Rủi ro thu tiền thật của khách mà không giao quyền lợi (mất tiền + mất uy tín) ngay khi V242 deploy trước khi gỡ trang.
- **Khuyến nghị:** Cùng PR với V242: gỡ card ULTRA + nút MoMo khỏi pricing page; giữ Stripe PRO tạm (đang hoạt động, Mode.PAYMENT one-time) đến khi SePay web-PRO ship rồi quyết định gỡ; hoặc feature-flag ẩn cả trang đến khi SePay sẵn.

### C-7. Groq là single-provider cho toàn bộ AI trả phí (chat + chấm bài + Whisper STT) — SPOF doanh thu chính
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 1 ngày
- **Bằng chứng:** application.yml:334-351: chat-provider local|groq (prod = groq theo lịch sử deploy), groq.model llama-4-scout cho speaking real-time, grading-model llama-3.3-70b cho chấm Schreiben/Sprechen, whisper-model whisper-large-v3 cho STT; openai.api-key chỉ dự phòng Whisper (:359). CircuitBreakers.java có breaker groqChat/groqWhisper (application.yml:555-557) nhưng không có provider failover — breaker mở = tính năng chết có kiểm soát, không phải chuyển nhà cung cấp.
- **Tác động:** Groq outage/đổi giá/khai tử model = mất đồng thời AI Speaking, chấm AI, STT — đúng các tính năng PRO đang bán. Đã từng có 2 AI tool 500 prod vì LLM env (memory QA 2026-06-24).
- **Khuyến nghị:** Không cần multi-provider ngay (YAGNI với 7 user). Việc rẻ: (1) khai OPENAI_API_KEY để Whisper có fallback thật (config đã hỗ trợ); (2) document runbook 'Groq down' + status-page check; (3) khi có doanh thu, thêm provider thứ 2 sau GradingModelConfig (đã tách config-point).

### C-8. XTTS streaming TTS chạy qua ngrok URL ephemeral — chấp nhận được vì có fallback, nhưng là chi phí vận hành ngầm
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** application.yml:386-391: xtts.base-url default rỗng, `ngrok-skip-warning: ${XTTS_NGROK_SKIP_WARNING:true}` xác nhận thiết kế quanh ngrok; comment :383-385 'Empty by default → speaking stream omits audio events and clients keep their edge-tts / on-device fallback'. Memory: prod XTTS_BASE_URL=ngrok ephemeral.
- **Tác động:** Tunnel chết (ngrok restart) = mất giọng XTTS chất lượng cao trong AI Speaking; app không hỏng (fallback edge-tts/on-device) nhưng trải nghiệm PRO giảm âm thầm, không có alert.
- **Khuyến nghị:** Trước launch App Store: hoặc chuyển XTTS host cố định (ngrok paid domain / cloudflared tunnel named), hoặc chấp nhận tắt hẳn cho v1.0 (để rỗng) và chỉ dựa edge-tts để hành vi nhất quán khi Apple review.

### C-9. Hạ tầng prod không HA: 1 EC2 t3.medium chạy docker-compose + 1 RDS t4g.micro 1GB single-AZ
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** docker-compose.prod.yml: mỗi service 1 container (deutschflow-backend :18-22, frontend :72-84, prometheus/alertmanager/loki cùng máy) — không replicas, không orchestrator. RDS t4g.micro 1GB (memory: prod load eval). Lịch sử P0 login 500 do Hikari pool exhaustion (memory Redis-Down 2026-06-13). docs/AWS_MONITORING_PRODUCTION_SUPPORT.md mô tả ECS + Multi-AZ replication lag — KHÔNG khớp hạ tầng thật (docs drift).
- **Tác động:** EC2 chết = toàn bộ backend + monitoring chết cùng lúc (monitoring nằm chung máy nên mù luôn); RDS single-AZ maintenance = downtime. Với App Store launch, 1 spike review/featured có thể lặp lại P0 DB-pool.
- **Khuyến nghị:** Chấp nhận không-HA ở quy mô này (đúng KISS), nhưng: (1) bật RDS automated backup + xác nhận restore runbook; (2) tách uptime check ra ngoài máy (UptimeRobot free ping /actuator/health); (3) hoãn Multi-AZ/ECS đến khi có doanh thu.

### C-10. Chi phí vận hành ~4,38M VNĐ/tháng (T6) trên 0 doanh thu; nghi vấn 2 dòng API có thể không dùng (ElevenLab 289k, 'Lama 4' 300k)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** MEDIUM · **Effort:** 0.5 ngày
- **Bằng chứng:** docs/Bang_Chi_Tiet_Chi_Phi_DeutschFlow_V2.xlsx (đọc được đầy đủ): T6 dự kiến 4.380.873đ = AWS ~$85 (RDS $20 + Amplify $20 + EC2 $45 ≈ 2,24M) + API 789k (ElevenLab 289k + Groq 200k + 'Lama 4' 300k) + tools 1.098k (Cursor 499k + Antigravity 599k) + voiceover 256k; T4-T5 thực tế ~2,5M/tháng (AWS còn free tier). Sheet tổng: đã chi 5.086.000đ, dự kiến lũy kế 9.466.873đ. NHƯNG: codebase không có tích hợp ElevenLabs nào (STT = OpenAI/Groq Whisper — application.yml:357-361, WhisperApiClient.java); 'Lama 4' 300k là dòng riêng trong khi model Groq chính là llama-4-scout (application.yml:342) → khả năng double-count hoặc trả subscription không dùng. Giả định/cần kiểm chứng với hóa đơn thật (docs/Bills...pdf chưa đọc).
- **Tác động:** ~589k/tháng (~13% tổng chi) có thể là chi phí chết. Fixed cost (AWS + tools ~3,3M) chiếm áp đảo so với AI COGS biến đổi (307đ × 7 user ≈ 2.149đ/tháng) → break-even cần ~15 PRO web (299k) hoặc ~25 PRO IAP sau 30% Apple fee.
- **Khuyến nghị:** Đối chiếu Bills PDF/tài khoản: hủy ElevenLab nếu không có integration; gộp/làm rõ dòng 'Lama 4' vs Groq. Cân nhắc EC2 savings plan/reserved (~30% giảm $45) khi cam kết 1 năm.

### C-11. Marketplace giáo viên = niêm yết thuần, KHÔNG có cơ chế kiếm tiền nào trong code
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0 ngày
- **Bằng chứng:** TeacherMarketplaceController.java: chỉ 3 endpoint — GET /api/v2/teachers/public (list, sort featured), GET /{id}, PUT /profile (tự cập nhật headline/bio/qualifications/hourlyRateVnd/maxStudentsPerWeek). hourlyRateVnd chỉ là con số hiển thị (toDto :109); không có entity/endpoint booking, escrow, commission, contact-unlock hay payment nào tham chiếu TeacherProfile. Org teachers bị loại khỏi marketplace (:35-36, B2B decision).
- **Tác động:** Roadmap owner (1) tự động thu thập CV giáo viên đổ vào một marketplace hiện không có revenue path — thu thập dữ liệu trước khi có mô hình kiếm tiền (hoa hồng? phí niêm yết? lead-gen cho trung tâm B2B?) là chi phí + rủi ro pháp lý (scraping LinkedIn/Facebook vi phạm ToS) mà chưa có đầu ra.
- **Khuyến nghị:** Chốt mô hình tiền trước khi build scraper: khả thi nhất với B2B GTM hiện tại là lead-gen bán cho trung tâm (org) — cần thêm 'contact request' + gate; hoa hồng lớp 1-1 cần booking+payment (~2-3 tuần, chưa nên). Lưu ý riêng: scraping TopCV/LinkedIn nên giới hạn nguồn cho phép.

### C-12. Privacy Policy + Support URL vẫn là placeholder — blocker metadata bắt buộc của App Store Connect
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** plans/appstore/STORE_COPY.md:60-65, :114-118, :173 toàn bộ URL dạng [[privacy-policy-url]], [[https://your-domain/support]]. Nội dung PRIVACY_POLICY.md và TERMS_OF_USE.md đã soạn sẵn trong plans/appstore/ nhưng chưa host public. Không tìm thấy route /privacy hay /support trong frontend/src/app (không grep thấy trang tương ứng).
- **Tác động:** Không có URL sống = không submit được (App Store Connect bắt buộc Privacy Policy URL; Support URL bắt buộc per locale).
- **Khuyến nghị:** Nhanh nhất: thêm 2 static route Next.js /privacy và /support render 2 file markdown sẵn có, deploy qua Amplify (tự động), điền URL vào ASC + STORE_COPY.

### C-13. Đường găng App Store còn lại (xếp thứ tự) — item dài nhất là Paid Apps Agreement nằm ngoài tầm code
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 9 ngày
- **Bằng chứng:** Tổng hợp từ các finding trên + mobile/app.json (đã sẵn: SDK54/expo ^54.0.0, projectId 26fa9e21 thật, supportsTablet=false, privacyManifests đã khai PostHog ProductInteraction/OtherUsageData, NSPrivacyTracking=false đúng hướng không-ATT, bundleId com.cudinh.mydeutschflow, expo-updates configured). Còn thiếu theo code: expo-iap + ads SDK (package.json NONE), PAYWALL_ENABLED ios=false, APPLE_BUNDLE_ID env, V242, Privacy/Support URL, store copy rework, demo account.
- **Tác động:** Deadline nộp trong tháng 7/2026: nếu Paid Apps Agreement (tax/banking, tư cách cá nhân) không ký ngay tuần này thì mọi việc IAP phía sau bị chặn — Apple xử lý banking có thể mất nhiều ngày đến vài tuần.
- **Khuyến nghị:** Thứ tự đường găng: (1) HÔM NAY ký Paid Apps Agreement + banking/tax trong ASC (chờ đợi song song mọi việc khác); (2) tạo app record + 2 subscription products (pro.monthly/yearly) → chốt product IDs; (3) V242 + env APPLE_BUNDLE_ID (0.5d); (4) host Privacy/Support URL (0.5d); (5) expo-iap wiring + paywall flip (3-4d); (6) AdMob non-personalized (2d); (7) rework copy/screenshots free-không-AI (1d); (8) EAS production build + sandbox test + demo account + submit (1-2d). Tổng ~8-10 ngày-người, khớp deadline nếu Agreement không tắc.

**Docs-drift phát hiện trong trục này (6):**
- mobile/IOS_DEPLOY_AUDIT.md (2026-06-27) đã lỗi thời nặng: vẫn ghi P0 'Expo SDK 52 phải nâng 54', 'projectId placeholder', 'aps-environment thiếu', 'supportsTablet: true', 'Privacy Manifest khai thiếu PostHog' — code hiện tại: expo ^54.0.0 (mobile/package.json), projectId 26fa9e21 thật, supportsTablet=false, privacyManifests đã khai đủ PostHog data types (mobile/app.json), expo-updates + runtimeVersion fingerprint đã cấu hình.
- mobile/IOS_DEPLOY_AUDIT.md checklist B ghi 'Bundle ID com.deutschflow.app' nhưng app.json thực tế = com.cudinh.mydeutschflow; backend application.yml:529 default APPLE_BUNDLE_ID cũng vẫn là com.deutschflow.app (code phải theo bundle thật).
- docs/AWS_MONITORING_PRODUCTION_SUPPORT.md mô tả hạ tầng ECS + RDS Multi-AZ (replication lag metric) — hạ tầng thật là 1 EC2 chạy docker-compose.prod.yml single-container + RDS t4g.micro single-AZ; toàn bộ hướng dẫn auto-scale ECS không áp dụng được.
- plans/appstore/STORE_COPY.md hứa 'AI speaking practice... Start free' và 'core lessons and practice cost nothing' — mâu thuẫn quyết định LOCKED 2026-07-03 'free tier = KHÔNG AI, chạm AI phải hiện paywall'; ghi chú cuối file (:182) mới chỉ xử lý vụ 'unlimited', chưa xử lý vụ free-AI.
- frontend/messages/vi.json (pricing) + frontend/src/app/student/pricing/page.tsx vẫn phản ánh mô hình cũ: FREE có 'Mini Quiz AI', bán ULTRA 699k/2 tháng qua MoMo — mâu thuẫn quyết định ULTRA hoãn (V242) + MoMo hoãn + SePay web thay thế.
- docs/Bang_Chi_Tiet_Chi_Phi_DeutschFlow_V2.xlsx sheet Tháng 4 ghi 'AWS RDS (MySQL)' — DB thật là PostgreSQL (đã sửa từ sheet Tháng 5); dòng 'API Nhận diện giọng nói | Eleven Lab' không có integration ElevenLabs nào trong code (STT = OpenAI/Groq Whisper).


# TRỤC D — ROADMAP HR/PAYROLL


## D Roadmap HR/Payroll — điểm 4/5

**Tóm tắt:** TRỤC D — THIẾT KẾ HR/PAYROLL PHÍA OWNER.

═══ 1. INVENTORY TÁI SỬ DỤNG (đọc code thật) ═══
• Notification: tái dùng ~100%. `notification/` có UserNotificationService với generic `insertForUser(User, NotificationType, Map payload)` (UserNotificationService.java:256), NotificationContentRenderer render title/body server-side, NotificationSseBroadcaster (SSE + Redis pub/sub, NotificationSseBroadcaster.java:40-139), ExpoPushSenderService, và DailyNotificationJob dùng `@Scheduled` + `@SchedulerLock` (DailyNotificationJob.java:40-41, ShedLock có trong pom.xml:198). Thêm thông báo lương = thêm enum PAYROLL_READY/PAYROLL_PAID vào NotificationType.java + 1 case render.
• Parse CV: DocumentParsingService TỒN TẠI tại backend/.../teacher/service/DocumentParsingService.java — PDFBox extract text PDF, POI extract DOCX, base64-encode cho LLM (dòng 19-62). HandwritingOcrService (teacher/service/HandwritingOcrService.java) đã có pipeline ảnh→Gemini vision→JSON. ⇒ parse CV PDF/DOCX/ảnh sang structured profile là việc rẻ — nhưng cho luồng UPLOAD có consent, không phải scraping.
• Mốc giờ dạy: ClassSession (class_sessions, V236__class_schedule.sql) có `startAt`, `durationMinutes`, `mode ONLINE/OFFLINE`, `room`, `status SCHEDULED/CANCELLED/MOVED` (ClassSession.java:35-52) — chính xác là planned-shift của giáo viên. ClassSchedulePattern sinh session định kỳ (ClassSchedulePattern.java:31-53). ClassAttendance là điểm danh HỌC VIÊN, khóa (lesson_log_id, student_id) (ClassAttendanceId.java:17-21) — KHÔNG dùng cho chấm công nhân sự.
• Pool ứng viên nội bộ: TeacherProfile (headline/bio/qualifications/hourlyRateVnd, TeacherProfile.java:28-52) + TeacherMarketplaceController `GET /api/v2/teachers/public` (TeacherMarketplaceController.java:23-35). Có thể mở rộng thành candidate pool thay vì scrape ngoài.
• Ranh giới payment: OrgInvoice = DOANH THU B2B (org_invoices, paymentCode khớp SePay webhook, OrgInvoice.java:43-45); PaymentTransaction = doanh thu B2C. Payroll = CHI PHÍ — bắt buộc module/bảng riêng, chỉ tái dùng pattern (paymentCode/VietQR memo) nếu muốn QR chuyển khoản lương.
• Gamification: UserXpEvent là immutable ledger + bảng summary (UserXpEvent.java:8-10) — pattern đáng mirror, nhưng XpService là gamification HỌC VIÊN (XpService.java:58-66); điểm chuyên cần nhân sự phải là metric tính từ attendance, không phải XP.
• RBAC: User.Role {STUDENT, TEACHER, MANAGER, OWNER, ADMIN} first-class (User.java:123), OrgMember role/status (OrgMember.java:21-27) — đủ để gate API HR theo OWNER/MANAGER.
• HMAC precedent: MomoPaymentService đã dùng HmacSHA (file duy nhất match `Mac.getInstance`) — pattern ký QR có sẵn.
• Mobile: package.json KHÔNG có expo-camera/barcode/vision-camera ⇒ quét QR trên app = native dep mới = EAS build mới (OTA không kích hoạt native module).

═══ 2. THIẾT KẾ DOMAIN MỚI (đề xuất package com.deutschflow.hr, migration V243+) ═══
Bảng:
• `work_shifts`: id, org_id, staff_user_id, role_snapshot, planned_start, planned_end, source ENUM{CLASS_SESSION, MANUAL}, class_session_id (nullable FK → class_sessions.id), status. Ca của TEACHER sinh tự động từ class_sessions (job nightly clone pattern DailyNotificationJob); ca ADMIN/OWNER tạo tay.
• `attendance_records`: id, org_id, staff_user_id, work_shift_id (nullable — cho check-in ngoài ca), check_in_at, check_out_at, method ENUM{QR, MANUAL, ADMIN_OVERRIDE}, qr_jti, device_id, lat/lng (nullable), derived_status ENUM{ON_TIME, LATE, EARLY_LEAVE, ABSENT}, note, approved_by. Immutable-append + sửa bằng bản ghi override (mirror pattern UserXpEvent ledger).
• `qr_checkin_consumed` (chống replay): jti PK, consumed_at, user_id — QR token stateless HMAC, chỉ lưu jti đã dùng.
• `staff_pay_rates`: id, org_id, staff_user_id, rate_type ENUM{PER_HOUR, PER_SESSION, MONTHLY}, rate_vnd, effective_from, effective_to — KHÔNG dùng TeacherProfile.hourlyRateVnd (đó là giá marketplace B2C).
• `pay_periods`: id, org_id, period_start, period_end, status ENUM{OPEN, LOCKED, NOTIFIED, PAID}.
• `payroll_lines`: id, pay_period_id, staff_user_id, worked_minutes, session_count, rate_type+rate_vnd SNAPSHOT (bất biến khi rate đổi), gross_vnd, diligence_bonus_vnd, adjustments JSONB, note.
• Điểm chuyên cần = aggregate query trên attendance_records (on_time/late/absent count → score %), materialize vào payroll_lines lúc LOCK period; không cần bảng riêng ở V1.
API chính (gate @PreAuthorize OWNER/MANAGER trừ khi ghi chú): POST/GET `/api/v2/org/hr/shifts`, POST `/api/v2/org/hr/qr/current` (lấy QR động), POST `/api/v2/hr/checkin` (TEACHER/ADMIN/OWNER tự check-in), GET `/api/v2/me/attendance` (nhân sự xem của mình), POST `/api/v2/org/hr/pay-periods/{id}/lock|notify`, GET `/api/v2/org/hr/payroll/summary`.
Ranh giới cứng: hr.* không FK vào org_invoices/payment_transactions; chỉ đọc class_sessions (read-only) làm nguồn sinh ca.

═══ 3. QR CHECK-IN CHỐNG GIAN LẬN ═══
Thiết kế: màn hình owner (web, tablet tại trung tâm) hiển thị QR ĐỘNG: payload = base64(orgId|locationId|issuedAt|exp|jti) + HMAC-SHA256(server secret) — reuse pattern MomoPaymentService; TTL 60-90s, rotate 30s. Người quét = GIÁO VIÊN dùng thiết bị CỦA MÌNH đã đăng nhập → identity lấy từ JWT, QR chỉ là "proof-of-presence token". Chống gian lận: (a) TTL ngắn + rotate → chụp ảnh QR gửi cho đồng nghiệp ở nhà hết hạn ngay; (b) jti one-time-use per user (bảng qr_checkin_consumed) → chống replay; (c) chống check-in hộ: 1 thiết bị (device_id/installationId) chỉ check-in được 1 user/khung giờ + JWT là danh tính, muốn check-in hộ phải đưa cả điện thoại đã login; (d) tùy chọn: geofence lat/lng bán kính 100-200m (mobile) — để flag chứ không block ở V1 (GPS trong nhà kém); (e) audit: lưu method + device_id + qr_jti trên attendance_records. Phương án V1 KHÔNG đụng mobile binary: đảo chiều — web owner mở camera (getUserMedia + thư viện jsQR, frontend-only) quét QR tĩnh cá nhân của giáo viên (app render QR từ JWT-derived token bằng SVG, không cần native module) → tránh EAS build trước deadline App Store. Effort: 3-4 ngày (web-scan 2.5 ngày; mobile-scan +1.5 ngày + 1 EAS build).

═══ 4. RỦI RO PHÁP LÝ TÍNH NĂNG (1) — xem findings #1 (CRITICAL). Kết luận: KHÔNG build crawler; thay bằng form ứng tuyển + upload CV có consent (tái dùng DocumentParsingService + Gemini extraction) + tài khoản employer chính thức trên TopCV. Mức rủi ro: Facebook RẤT CAO, LinkedIn CAO, TopCV CAO. ═══

═══ 5. THỨ TỰ TRIỂN KHAI + ROI ═══
Thứ tự: F4 chấm công core (4-5d, tiêu chí: teacher check-in/out manual + shift sinh từ class_sessions + owner xem bảng công tháng) → F2 QR (3-4d, tiêu chí: QR động HMAC+TTL, replay bị chặn, e2e 1 org thật) → F5 điểm chuyên cần (1.5-2d, tiêu chí: score % on-time/late/absent per staff per period, hiển thị owner dashboard) → F3 lương (4-5d, tiêu chí: lock period → payroll_lines snapshot + notification PAYROLL_READY qua SSE/push + màn thống kê) → F1 dạng consent-based (3-4d, tiêu chí: form ứng tuyển public + CV parse tự động vào candidate pool). Tổng ≈ 16-20 ngày-người. LƯU Ý ROI: toàn trục là B2B owner-side phục vụ ~vài org (7 active user prod) — KHÔNG chặn App Store v1.0; nên xếp SAU khi submit App Store trong tháng 7/2026.

### D-1. Tự động scrape CV từ LinkedIn/Facebook/TopCV = rủi ro pháp lý + block cao; KHÔNG nên build, thay bằng pipeline consent-based
- **Mức độ:** 🔴 Nghiêm trọng · **Tin cậy:** HIGH · **Effort:** 3.5 ngày
- **Bằng chứng:** Yêu cầu roadmap item (1). Bối cảnh pháp lý: LinkedIn User Agreement §8.2 cấm scraping — án lệ hiQ v. LinkedIn kết cục hiQ THUA claim breach-of-contract (summary judgment 11/2022) và chịu permanent injunction dù thắng điểm CFAA về dữ liệu public; Meta ToS §3.2 cấm automated collection không có văn bản cho phép và Meta kiện scrapers đều đặn (BrandTotal, Voyager Labs); TopCV ToS cấm crawl + CV trên TopCV thực chất chỉ mở cho employer trả phí. Việt Nam: NĐ 13/2023/NĐ-CP — dữ liệu 'công khai' KHÔNG nằm trong các trường hợp xử lý không cần consent (Điều 17), có nghĩa vụ thông báo chủ thể dữ liệu + hồ sơ đánh giá tác động gửi A05; Luật Bảo vệ dữ liệu cá nhân 2025 hiệu lực 01/01/2026 nâng chế tài đáng kể (mức phạt cụ thể: cần luật sư kiểm chứng). Phát hành dưới TƯ CÁCH CÁ NHÂN → trách nhiệm pháp lý cá nhân trực tiếp, không có pháp nhân đệm. Chấm rủi ro: Facebook = RẤT CAO (ban account gần như chắc chắn + lịch sử kiện), LinkedIn = CAO (block kỹ thuật mạnh + án lệ bất lợi), TopCV = CAO (ToS + PDPD nội địa, cùng thị trường VN dễ bị nhắm).
- **Tác động:** Bị khóa tài khoản nền tảng, thư cease-and-desist, phạt hành chính PDPD, và rủi ro danh tiếng đúng lúc chuẩn bị phát hành App Store cá nhân — trong khi giá trị thu về (pool CV giáo viên tiếng Đức, thị trường ngách rất nhỏ) hoàn toàn đạt được bằng cách hợp pháp rẻ hơn.
- **Khuyến nghị:** Thay bằng 3 kênh hợp pháp: (a) trang 'Tuyển giáo viên' public + form ứng tuyển upload CV (consent rõ ràng, checkbox đồng ý xử lý dữ liệu theo NĐ13) — tái dùng DocumentParsingService + Gemini để auto-parse CV thành candidate profile; (b) mua tin tuyển dụng employer chính thức trên TopCV — CV về qua kênh hợp đồng; (c) owner tự sourcing thủ công và dán link/ghi chú vào candidate pool (hệ thống chỉ lưu bookmark do người nhập, không crawl). Nếu vẫn muốn 'phát hiện' ứng viên: chỉ dùng Google Custom Search API trên dữ liệu index công khai và lưu LINK chứ không lưu nội dung CV.

### D-2. Chấm công nhân sự phải là module MỚI, tách hẳn ClassAttendance (điểm danh học viên) — không nhồi chung
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 4.5 ngày
- **Bằng chứng:** ClassAttendance khóa composite (lesson_log_id, student_id) — backend/src/main/java/com/deutschflow/teacher/entity/ClassAttendanceId.java:17-21 — và status PRESENT/ABSENT/LATE gắn với ClassLessonLog (class_lesson_logs, ClassLessonLog.java:10) do giáo viên tick cho HỌC VIÊN. Không có bảng/entity nào cho chấm công nhân sự: grep 'payroll|salary|timesheet|work_shift|cham_cong' trên backend/src/main/java + db/migration = 0 kết quả (chỉ 1 hit vô nghĩa trong V171 question bank).
- **Tác động:** Nếu tái dùng class_attendance cho staff sẽ trộn 2 domain khác chu kỳ sống (điểm danh theo buổi học vs chấm công theo ca + kỳ lương), phá query hiện có của teacher và không mô hình được ADMIN/OWNER (không dạy lớp nào).
- **Khuyến nghị:** Tạo package com.deutschflow.hr + migration V243: bảng work_shifts (planned ca, source CLASS_SESSION|MANUAL, class_session_id nullable) và attendance_records (check_in_at/check_out_at, method QR|MANUAL|ADMIN_OVERRIDE, derived_status ON_TIME|LATE|EARLY_LEAVE|ABSENT, device_id, qr_jti, approved_by) — append-only, sửa sai bằng bản ghi ADMIN_OVERRIDE thay vì update (mirror pattern immutable ledger của UserXpEvent.java:8-10). API /api/v2/org/hr/** gate OWNER/MANAGER, /api/v2/hr/checkin + /api/v2/me/attendance cho chính nhân sự.

### D-3. Mốc giờ dạy để chấm công TEACHER đã có sẵn: sinh work_shifts từ class_sessions (V236) thay vì bắt owner nhập ca tay
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 1.5 ngày
- **Bằng chứng:** ClassSession có đủ startAt, durationMinutes, mode ONLINE/OFFLINE, room, status SCHEDULED/CANCELLED/MOVED (backend/.../teacher/entity/ClassSession.java:35-52), sinh từ ClassSchedulePattern (day_of_week + start_time + effective_from/to, ClassSchedulePattern.java:31-53), migration V236__class_schedule.sql, service ClassScheduleService.java tồn tại. Đây chính là 'ca dạy dự kiến' của giáo viên — deploy prod từ 2026-06-23 (Teacher Schedule Parity).
- **Tác động:** Tiết kiệm ~2-3 ngày effort + tránh double-entry: owner đã nhập lịch dạy 1 lần cho tính năng schedule, chấm công chỉ cần đối chiếu check-in với session. Late/early-leave tính được ngay từ startAt/durationMinutes.
- **Khuyến nghị:** Job nightly (clone pattern DailyNotificationJob.java:40-41 với @Scheduled + @SchedulerLock) project class_sessions 7 ngày tới → upsert work_shifts(source=CLASS_SESSION, class_session_id); session CANCELLED/MOVED → sync trạng thái ca. ADMIN/OWNER (không có lớp) dùng work_shifts source=MANUAL hoặc chế độ 'chấm công tự do' chỉ ghi attendance_records không gắn ca. Giữ quan hệ read-only: hr KHÔNG ghi ngược vào class_sessions.

### D-4. QR check-in trên mobile đòi native dependency mới (expo-camera) → EAS build mới, đụng deadline App Store; V1 nên quét bằng WEB
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 3 ngày
- **Bằng chứng:** mobile/package.json KHÔNG có expo-camera/expo-barcode-scanner/vision-camera (grep = 0 hit; 'qrcode' chỉ xuất hiện transitively trong package-lock.json). OTA EAS Update chỉ áp dụng JS-only (memory: OTA needs new build khi thêm native module). Backend/frontend không có thư viện QR nào (grep zxing/QrCode = 0 hit backend + frontend/src).
- **Tác động:** Thêm expo-camera = rebuild binary + re-submit — chen vào pipeline nộp App Store v1.0 tháng 7/2026 và kéo dài review. Trong khi người dùng của tính năng này (owner + vài giáo viên) hoàn toàn dùng được web.
- **Khuyến nghị:** V1 không đụng mobile binary — 2 biến thể: (a) tablet/màn hình owner (web) HIỂN THỊ QR động, giáo viên quét bằng web app trên điện thoại (getUserMedia + jsQR, thuần frontend); hoặc (b) đảo chiều: app mobile RENDER QR cá nhân bằng SVG (react-native-svg đã có sẵn — không cần native module mới, OTA được) và owner quét bằng webcam trên web. Đưa expo-camera vào binary ở bản build 1.1 sau khi v1.0 đã lên store.

### D-5. Thiết kế chống gian lận QR: HMAC-signed + TTL + jti one-time + danh tính từ JWT người quét (pattern HMAC đã có sẵn)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 2 ngày
- **Bằng chứng:** MomoPaymentService là nơi duy nhất trong backend đã dùng HmacSHA/Mac.getInstance (grep xác nhận) — pattern ký/verify chữ ký server-side có sẵn để copy. Chưa có bất kỳ hạ tầng token QR nào khác (grep QrCode/zxing = 0).
- **Tác động:** QR tĩnh không ký = chụp màn hình gửi nhóm Zalo là cả trung tâm 'có mặt'. Thiết kế đúng ngay từ đầu rẻ hơn nhiều so với vá sau khi owner phát hiện gian lận chấm công (dính trực tiếp đến tiền lương).
- **Khuyến nghị:** Payload QR = base64(orgId|locationId|issuedAt|exp|jti) + HMAC-SHA256 secret server (không cần bảng token phát hành — stateless); TTL 60-90s, client hiển thị tự refresh 30s. Check-in: (1) verify chữ ký + exp; (2) insert jti vào bảng qr_checkin_consumed(jti PK, user_id) — unique violation = replay; (3) danh tính = JWT của người gọi /api/v2/hr/checkin, QR chỉ chứng minh hiện diện → check-in hộ đòi đưa cả thiết bị đã đăng nhập; (4) lưu device_id, giới hạn 1 device/1 user/khung ca, flag bất thường; (5) geofence lat/lng chỉ FLAG (không block) ở V1 vì GPS indoor kém.

### D-6. Payroll phải tách ranh giới với payment/org_invoices: doanh thu ≠ chi phí lương, chỉ tái dùng pattern chứ không tái dùng bảng
- **Mức độ:** 🟠 Cao · **Tin cậy:** HIGH · **Effort:** 4.5 ngày
- **Bằng chứng:** OrgInvoice là hóa đơn THU của org (seats, amountVnd, status DRAFT|SENT|PAID|VOID, paymentCode khớp SePay webhook — backend/.../organization/entity/OrgInvoice.java:33-45); PaymentTransaction là thu B2C; user_subscriptions là ledger subscription Apple IAP. Không có entity chi phí/expense nào tồn tại.
- **Tác động:** Nhét payroll vào org_invoices (vd status mới, amount âm) sẽ phá SePay webhook matching (OrgBillingService khớp paymentCode), phá báo cáo doanh thu, và trộn quyền: người xem hóa đơn khách không đồng nghĩa được xem lương nhân viên.
- **Khuyến nghị:** Bảng riêng: pay_periods(org_id, period_start/end, status OPEN|LOCKED|NOTIFIED|PAID) + payroll_lines(pay_period_id, staff_user_id, worked_minutes, session_count, rate SNAPSHOT, gross_vnd, diligence_bonus_vnd, adjustments JSONB) + staff_pay_rates(rate_type PER_HOUR|PER_SESSION|MONTHLY, rate_vnd, effective_from/to). Snapshot rate vào payroll_lines lúc LOCK để kỳ lương bất biến khi đổi rate. Nếu muốn QR chuyển khoản lương: copy pattern VietQR-memo của OrgInvoice.paymentCode chứ không dùng chung bảng. LƯU Ý: KHÔNG dùng TeacherProfile.hourlyRateVnd (TeacherProfile.java:41-43) làm rate lương — đó là giá niêm yết marketplace B2C, ngữ nghĩa khác hợp đồng lao động.

### D-7. Thông báo + thống kê lương tái dùng ~100% notification infra hiện có — effort thực nằm ở phần thống kê, không phải phần thông báo
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 4.5 ngày
- **Bằng chứng:** UserNotificationService.insertForUser(User, NotificationType, Map payload) là API generic (UserNotificationService.java:256); NotificationContentRenderer render title/body server-side (memory PR #176: thêm type mới chỉ cần thêm case render); SSE realtime + Redis pub/sub (NotificationSseBroadcaster.java:40-139, event 'unreadCount'); Expo push (ExpoPushSenderService.java); job hàng ngày có khóa phân tán (@Scheduled + @SchedulerLock, DailyNotificationJob.java:40-41).
- **Tác động:** Feature (3) rẻ hơn ước tính ngây thơ: phần 'thông báo lương' chỉ ~0.5 ngày (enum PAYROLL_READY/PAYROLL_PAID + render case + gọi insertForUser khi lock/notify pay_period). Ngân sách còn lại dồn vào aggregate thống kê (tổng giờ, tổng lương theo tháng/nhân sự) + màn owner dashboard.
- **Khuyến nghị:** Thêm 2-3 giá trị vào NotificationType.java (đặt cạnh nhóm ADMIN_*), case render trong NotificationContentRenderer, và gọi từ PayrollService khi chuyển status pay_period. Thống kê: query aggregate trực tiếp trên payroll_lines + attendance_records (quy mô vài chục nhân sự/org → không cần bảng summary, RDS t4g.micro chịu được). FE: thêm section vào frontend/src/app/v2/org.

### D-8. Điểm chuyên cần: KHÔNG tái dùng XpService/UserXpEvent (gamification học viên) — dùng aggregate trên attendance_records, chỉ mirror pattern ledger
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1.5 ngày
- **Bằng chứng:** XpService là hằng số thưởng XP cho hành vi HỌC (XP_SPEAKING_TURN, XP_VOCAB_REVIEW... — XpService.java:58-66) và UserXpEvent.XpEventType toàn event học tập (UserXpEvent.java:46-58); coin currency (V226) KHÔNG có trên main (grep 'coin' backend/src/main/java = 0 hit — PR #124 nằm ở nhánh feat/ui-2.0-galerie). Không có cơ chế điểm nào cho nhân sự.
- **Tác động:** Nhét ATTENDANCE_BONUS vào XpEventType sẽ làm điểm chuyên cần của giáo viên lẫn vào leaderboard/level/achievement của học viên (XpService bắn LEVEL_UP notification, achievement unlock...) — sai ngữ nghĩa và lộ dữ liệu nhân sự sang surface học viên.
- **Khuyến nghị:** Điểm chuyên cần = metric TÍNH TOÁN: score = f(on_time_count, late_count, absent_count, early_leave_count) trên attendance_records theo pay_period (vd 100 − 2×late − 10×absent, min 0 — công thức configurable per org sau). V1 để là query aggregate + materialize kết quả vào payroll_lines.diligence_bonus_vnd lúc LOCK kỳ lương; không cần bảng điểm riêng, không cần event ledger mới. Effort nhỏ vì (4) đã chuẩn hóa derived_status.

### D-9. Pipeline CV consent-based gần như 'lắp ráp' từ hạ tầng sẵn có: DocumentParsingService + Gemini vision + TeacherProfile pool
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 3.5 ngày
- **Bằng chứng:** DocumentParsingService.extractTextFallback đọc PDF (PDFBox Loader.loadPDF + PDFTextStripper) và DOCX (XWPFWordExtractor) — backend/.../teacher/service/DocumentParsingService.java:44-62; encodeFileToBase64 + determineMimeType (dòng 19-39) đã phục vụ gửi file cho LLM. HandwritingOcrService đã có pipeline ảnh→GeminiApiClient→forced-JSON (HandwritingOcrService.java:34-45 prompt pattern). TeacherProfile + TeacherMarketplaceController /api/v2/teachers/public (TeacherMarketplaceController.java:29) là pool giáo viên nội bộ có sẵn.
- **Tác động:** Feature (1) phiên bản hợp pháp chỉ ~3-4 ngày: form ứng tuyển public → upload CV → parse text → 1 Gemini call trích {name, phone, email, degrees, german_level, experience_years} → lưu candidate. Giá trị tuyển dụng giữ nguyên mà không dính rủi ro pháp lý ở finding #1.
- **Khuyến nghị:** Bảng teacher_candidates(org_id nullable, source ENUM{APPLY_FORM, MANUAL, TOPCV_OFFICIAL}, cv_media_id, parsed_profile JSONB, consent_at NOT NULL, status NEW|CONTACTED|HIRED|REJECTED) + endpoint public POST /api/v2/careers/apply (rate-limit + size-limit 5MB như DocumentParsingService đã cảnh báo) + màn owner duyệt. Prompt trích xuất theo pattern forced-JSON của HandwritingOcrService. Ghi rõ consent text theo NĐ13 ngay trên form.

### D-10. Dữ liệu chấm công + lương là dữ liệu cá nhân nhạy cảm — cần RBAC chặt và audit ngay từ V1 (nền RBAC đã sẵn)
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 1 ngày
- **Bằng chứng:** User.Role đã có MANAGER/OWNER là first-class org-admin identity 'strictly administrative — do NOT inherit TEACHER capabilities' (User.java:118-123); OrgMember role/status per-org (OrgMember.java:21-27). NĐ 13/2023 xếp dữ liệu tài chính cá nhân vào nhóm nhạy cảm (căn cứ pháp lý — cần luật sư xác nhận phạm vi với lương). Chưa có audit-log framework chung nào cho mutation (không tìm thấy package audit).
- **Tác động:** Lương của giáo viên lộ cho giáo viên khác (hoặc MANAGER của org khác) = mất khách B2B ngay; tranh chấp chấm công không có audit trail = không phân xử được — đây là hệ thống đụng đến TIỀN của người thật.
- **Khuyến nghị:** Mọi endpoint /api/v2/org/hr/** phải assert caller là OWNER/MANAGER CỦA ĐÚNG org đó (theo pattern assertTeacherOwnsClass đã dùng để vá IDOR trước đây); nhân sự thường chỉ được /api/v2/me/attendance + notification lương của chính mình. attendance_records append-only + cột approved_by; payroll_lines chỉ sửa được khi pay_period ở OPEN, sau LOCK là immutable. Viết RBAC IT test theo pattern RbacContractTest hiện có.

### D-11. Thứ tự triển khai và timing: F4→F2→F5→F3→F1, tổng ≈16-20 ngày-người, và nên xếp SAU App Store submission tháng 7
- **Mức độ:** 🟡 Trung bình · **Tin cậy:** HIGH · **Effort:** 17 ngày
- **Bằng chứng:** Phụ thuộc đề bài: (4)→(5)→(3), (2) phục vụ (4), (1) độc lập. Bối cảnh đã chốt: deadline nộp App Store trong tháng 7/2026, team 1 founder + AI, B2B GTM cần design partner T6-T7. Toàn bộ trục D là owner-side web (frontend/src/app/v2/org đã có shell), không đụng binary mobile nếu theo finding #4.
- **Tác động:** Nếu chen trục D trước khi submit App Store sẽ trễ deadline v1.0 (nguồn doanh thu B2C + điều kiện ads/subscription); ngược lại trục D là 'sticky feature' giữ chân design partner B2B — làm ngay sau submit là điểm rơi tốt nhất.
- **Khuyến nghị:** Tuần tự sau khi v1.0 vào App Review: F4 chấm công core 4.5d (DoD: shift sinh từ class_sessions + check-in manual + bảng công owner) → F2 QR web-scan 3d (DoD: QR HMAC+TTL, test replay bị chặn, chạy thật 1 org) → F5 chuyên cần 1.5d (DoD: score hiển thị + bonus vào payroll_lines) → F3 lương 4.5d (DoD: lock→snapshot→notification PAYROLL_READY + dashboard thống kê) → F1 consent-based 3.5d (DoD: form apply public + CV auto-parse vào pool). Mobile QR-scan native (expo-camera) gộp vào build 1.1.

### D-12. Chấm công ONLINE session: QR vật lý không áp dụng cho lớp dạy online — cần nhánh check-in riêng ngay trong thiết kế V1
- **Mức độ:** 🟢 Thấp · **Tin cậy:** HIGH · **Effort:** 0.5 ngày
- **Bằng chứng:** ClassSession.mode có ONLINE bên cạnh OFFLINE (ClassSession.java:21,41-44) và ClassSchedulePattern.defaultMode tương tự (ClassSchedulePattern.java:22,41-44) — nghĩa là một phần ca dạy thật sự diễn ra online, không có mặt tại trung tâm để quét QR.
- **Tác động:** Nếu V1 chỉ có QR, giáo viên dạy online sẽ luôn 'ABSENT' → bảng công sai → lương sai, owner mất niềm tin vào hệ thống ngay kỳ lương đầu.
- **Khuyến nghị:** attendance_records.method đã có MANUAL: cho phép check-in không QR khi work_shift.class_session.mode=ONLINE (nút 'Bắt đầu ca online' trong app/web, ghi method=MANUAL + flag online), hoặc owner xác nhận sau (ADMIN_OVERRIDE + approved_by). Đây là lý do method là enum mở thay vì hard-code QR-only.

**Docs-drift phát hiện trong trục này (3):**
- Memory/audit trước đây (project_full_audit_2026_06_24: 'no ShedLock') đã LỖI THỜI so với code: ShedLock hiện có trong backend/pom.xml:198-203 (shedlock-spring), có ShedLockConfig.java và đang được dùng thật (@SchedulerLock trong notification/jobs/DailyNotificationJob.java:41) — mọi job HR/payroll mới cứ dùng @SchedulerLock, không cần bổ sung hạ tầng.
- Memory 'Student Coin Currency V226 + gamification.coin' KHÔNG có trên main: grep 'coin' toàn backend/src/main/java = 0 kết quả — coin nằm ở nhánh feat/ui-2.0-galerie (PR #124) chưa merge; không được viện dẫn coin làm cơ chế điểm chuyên cần.
- Javadoc HandwritingOcrService tự mô tả là 'checklist D2' cho chấm bài viết tay — tên service dễ gây hiểu nhầm là OCR đa dụng; thực tế prompt hard-code cho bài viết tiếng Đức của học viên (HandwritingOcrService.java:38-45), muốn OCR CV ảnh phải viết prompt khác chứ không gọi thẳng ocr().

---

## 4. KẾ HOẠCH PHÁT TRIỂN – NÂNG CẤP – CHỈNH SỬA

Nguyên tắc xếp: **P0** = chặn ra mắt / bảo mật / mất dữ liệu · **P1** = quan trọng, làm trong 2–4 tuần · **P2** = nên làm. Effort tính theo **ngày-người của 1 founder + AI**. Deadline neo: **nộp App Store 6–7/7**.

### ⚠️ Quyết định trước tiên: phương án nộp

| | **A. Nộp 6–7/7 bản FREE-ONLY (khuyến nghị)** | **B. Giữ full Hướng B, trượt deadline** |
|---|---|---|
| Nội dung v1.0 | Free, không ads, không IAP; copy/screenshot bỏ phần subscription | Free + ads + PRO IAP như kế hoạch |
| Khả thi 6–7/7 | ✅ (khối lượng Phase 0 ≈ 3–4 ngày) | ❌ (riêng mobile ~6–9 ngày + chờ Paid Apps Agreement Active — ngoài tầm kiểm soát) |
| Rủi ro | v1.1 monetization cần build mới + review lại (~1 tuần sau khi xong) | Mất mốc 6–7/7; ngày nộp thực tế ≈ 18–25/7 |
| Vì sao khuyến nghị A | Paid Apps Agreement là đường găng **không code được**; nộp free-only vẫn ký hợp đồng + build IAP song song → v1.1 ra sát ngay sau, không mất gì ngoài 1 lần review thêm | — |

### Phase 0 — Trước submit 6–7/7 (P0, tổng ≈ 3.5–4.5 ngày-người)

| # | Việc | Finding | Effort | Phụ thuộc | Rủi ro | Definition of Done |
|---|---|---|---|---|---|---|
| 0.1 | **Ký Paid Apps Agreement + W-8BEN + banking** trên ASC (làm NGAY, kể cả chọn phương án A) | C-7 | 0.1d (chờ Apple) | Không | Apple duyệt chậm | Trạng thái Agreements = Active |
| 0.2 | **Fix delete-account**: thêm `messages` + `class_channel_messages` vào `AccountDeletionService` (hoặc ALTER FK) + 1 IT "xóa account có tin nhắn" | A3b-1 🔴 | 0.5–1d | Không | FK khác còn sót → IT phải quét bảng FK tới users | IT xanh; xóa account demo có tin nhắn thành công trên staging |
| 0.3 | **Xác minh RDS automated backup + deletion protection** (console) + chạy thử restore 1 snapshot, ghi runbook 1 trang | A6-1 🔴, A7-4 | 0.5d | Không | Nếu backup đang TẮT → bật ngay, retention ≥7 ngày | Ảnh chụp console + runbook trong repo |
| 0.4 | **Host Privacy Policy + Terms + Support**: 2–3 static route Next.js render nội dung `plans/appstore/`, điền hết `[[…]]` (tên pháp lý cá nhân, email) | C-6 | 0.5d | Amplify | — | 3 URL công khai truy cập được, dán vào ASC |
| 0.5 | **Dọn bề mặt bán hàng theo quyết định**: ẩn ULTRA + MoMo khỏi `pricing/page.tsx`; sửa copy `upgrade.tsx`/`vi.json`/`STORE_COPY.md` (bỏ hứa AI-free/"không giới hạn"); Stripe đổi nhãn "gói 30 ngày" hoặc ẩn tạm | B-3, C-4, C-5 | 0.5–1d | Không | Reject 2.3.1 nếu copy hứa thứ app không cho free dùng | Không còn chữ "AI"/"unlimited" trong benefit của free; pricing chỉ còn kênh hoạt động |
| 0.6 | **V243**: sửa `CHECK day_of_week` (0-6 → 1-7) + gộp canonicalize ULTRA row vào V242 khi tạo | A7-1, A7-5 | 0.25d | Deploy backend | — | Tạo lịch Chủ nhật OK trên staging |
| 0.7 | **Bật branch protection main + UptimeRobot + notify CI-fail** (3 việc click) | A6-2, A6-6 | 0.25d | Không | — | Push thẳng main bị chặn; alert email khi /actuator/health down |
| 0.8 | **Screenshots 6.9″ + demo account + review notes (bản free-only) → `eas build production` → `eas submit`** | C-7 | 1–1.5d | 0.2, 0.4, 0.5 | Reviewer đụng bug delete-account nếu 0.2 chưa deploy | Build Waiting for Review trước 7/7 |

*(Nếu chọn phương án B: bỏ 0.8, giữ nguyên phần còn lại và chuyển thẳng sang Phase 1.)*

### Phase 1 — Monetization v1.1 (P0/P1, tuần 2–4 tháng 7, ≈ 12–16 ngày-người)

| # | Việc | Finding | Effort | Phụ thuộc | Rủi ro | DoD |
|---|---|---|---|---|---|---|
| 1.1 | Config backend Apple IAP: env `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow`, `APPLE_APP_APPLE_ID`, `root-cert-dir`; **V242** align product IDs + ULTRA `is_active=FALSE`; đăng ký ASSN V2 URL | C-2 🔴, A3b-2 | 0.5d | 0.1 Active | Quên env → 100% verify reject | Sandbox `/verify` pass sau khi set đúng (guard-test fail trước đó) |
| 1.2 | Tạo Subscription Group + PRO monthly/yearly trong ASC (ID khớp V242) + sandbox tester | C-7 | 0.5d | 1.1 | Product kẹt "Missing Metadata" nếu agreement chưa Active | 2 product Ready to Submit |
| 1.3 | `expo-iap` + `lib/iap.ts` + paywall 3.1.2 (giá `displayPrice`, kỳ, Restore, Terms/Privacy links, quản lý gói) + bật `PAYWALL_ENABLED` iOS | B-1 🔴, C-1 🔴 | 3.5–5d | 1.1, 1.2 | New-Arch: verify purchase trên device dev-build (tiền sử Fabric bug) | Sandbox mua → `/verify` → `isPro` flip → gate mở; restore OK; interrupted purchase drain OK |
| 1.4 | **Paywall wall cho free**: interceptor mobile map 429 `type=quota-exceeded` → modal tiếng Việt + CTA upgrade; pre-gate entry AI (speaking/exam) theo entitlement; web pre-gate tương tự | B-2, B-4 | 2–3d | 1.3 | — | Free chạm AI thấy paywall (không alert thô), PostHog track wall-hit |
| 1.5 | AdMob non-personalized: `react-native-google-mobile-ads` 16.x, `FreeBanner` gate `isPro`, chỉ màn free không nhạy cảm, không ATT | C-1 | 1.5–2.5d | 1.3 (chung 1 native build) | Dev build chỉ hiện TEST ads | Banner hiện cho free, PRO = 0 ad view; prebuild xanh |
| 1.6 | Test đường tiền: IT HTTP `/api/payments/apple/*` + `AppleServerNotificationService` test + MockMvc SePay Apikey 200/401/replay | A5-5, A5-6 | 2d | 1.1 | — | CI xanh với test mới; ASSN sandbox renewal/expire chảy đúng ledger |
| 1.7 | **SePay web-PRO "gói N ngày"** cho student: trang mua + mã `DFSTU-…` + mở rộng `SepayWebhookService` match student-topup → `SubscriptionActivationService.activateWithExplicitEnd` | C-3 | 4–6d | Không (song song) | Đối soát tiền lệch nếu match code lỏng — bắt buộc idempotent + underpay-guard như org-invoice | Chuyển khoản thật (test 10k) kích hoạt PRO đúng N ngày |
| 1.8 | 1 production build duy nhất (fingerprint đổi 1 lần) → submit v1.1 + App Privacy labels (KHÔNG khai Sentry) | C-7 | 1–2d | 1.3–1.5 | — | v1.1 Waiting for Review |

### Phase 2 — Ổn định nền tảng & scale (P1, tháng 8, ≈ 12–15 ngày-người)

| # | Việc | Finding | Effort | DoD |
|---|---|---|---|---|
| 2.1 | Làm main xanh lại: fix `QuotaExceededHandlerIntegrationTest` (endpoint ma) + 2 IT isolation; định nghĩa property `skipUnitTests` | A5-1 🔴, A5-2 | 1.5d | 3 lần push main liên tiếp CI xanh |
| 2.2 | Coverage gate 3 tầng (jacoco check, vitest thresholds đúng chỗ, jest --coverage) + Playwright smoke vào CI + `next build` vào frontend-ci | A5-3, A5-4, A6-8 | 2d | PR fail khi coverage tụt / build gãy |
| 2.3 | Monitoring có thật: sửa Prometheus target `deutschflow-backend:8080` + network, bind 127.0.0.1, verify Alertmanager→Telegram bắn thật, alert log-marker `[OVERAGE]` | A6-3, A6-4, C-2 (soft-cap) | 1.5d | Kill backend 1 phút → nhận Telegram |
| 2.4 | k6 baseline + dashboard-mix (script sẵn trong `scripts/loadtest/`) vs staging; hạ `GROQ_SEMAPHORE_ACQUIRE_SEC` 90→15; breaker cho Groq streaming; `sync=true` + TTL L2 riêng cho cache nóng | A4-1..A4-4 | 2–3d | Báo cáo k6 100 CCU + không còn stampede marker |
| 2.5 | Contract hardening: DTO hóa 3 endpoint skill-tree mobile dùng + `openapi-typescript` vào FE/mobile + ArchUnit freeze (cấm cycle mới + bắt buộc tenant-guard) | A1-1..A1-4 | 3–4d | Contract test fail khi backend đổi shape |
| 2.6 | NĐ13 bổ sung: checkbox tuổi/consent khi đăng ký + purge PostHog khi xóa account + xác minh encryption-at-rest (2 lệnh AWS CLI) | A3b-3, A3b-4 | 1.5d | Register có consent; runbook purge |
| 2.7 | Deploy an toàn: giữ container cũ đến khi GREEN healthy (blue-green thật) + đường rollback + đưa deploy vào GitHub Actions (hết bus-factor 1) | A6-5, A6-7 | 1.5–2d | Deploy không downtime; rollback 1 lệnh |
| 2.8 | Quyết định cây UI: chốt v2 Galerie làm chuẩn → xóa dần cây v1 (97 file/18k dòng) | A2-1 | 3–4d (dần) | Không còn route trỏ cây cũ |

### Phase 3 — HR/Payroll owner-side (P2, tháng 8–9, ≈ 16–20 ngày-người)

Thứ tự theo phụ thuộc (4)→(2)→(5)→(3), (1) độc lập — **toàn bộ xếp SAU App Store submission**:

| # | Feature | Effort | Ghi chú thiết kế (chi tiết ở Trục D findings) | DoD |
|---|---|---|---|---|
| 3.0 | Tiền đề: ArchUnit tenant-rule (2.5) + UNIQUE `(class_id, day_of_week)` / `(class_id, session_date)` | 0.5–1d | Bảo vệ dữ liệu gốc trước khi tính công/lương | Constraint áp dụng, dedupe xong |
| 3.1 | **F4 Chấm công** — package `com.deutschflow.hr` mới: `work_shifts` (sinh tự động từ `class_sessions` V236 cho TEACHER; tay cho ADMIN/OWNER) + `attendance_records` (append-only, override bằng bản ghi mới) | 4–5d | TÁCH HẲN `ClassAttendance` (điểm danh học viên) và `payment` (doanh thu) | Teacher check-in/out; owner xem bảng công tháng |
| 3.2 | **F2 QR check-in** — QR động HMAC-SHA256 + TTL 60-90s + jti one-time (`qr_checkin_consumed`); danh tính = JWT người quét; **V1 quét bằng WEB** (getUserMedia + jsQR) để né EAS build mới | 3–4d | Pattern HMAC copy từ `MomoPaymentService`; geofence = flag chứ không block; nhánh riêng cho lớp ONLINE | Replay bị chặn; check-in hộ cần đưa cả máy đã login |
| 3.3 | **F5 Điểm chuyên cần** — aggregate `attendance_records` (on-time/late/absent → score %), materialize vào `payroll_lines` lúc LOCK kỳ; KHÔNG dùng XP học viên | 1.5–2d | | Dashboard owner hiện score per staff per kỳ |
| 3.4 | **F3 Lương + thông báo** — `staff_pay_rates` (snapshot vào `payroll_lines`), `pay_periods` OPEN→LOCKED→NOTIFIED→PAID; notification = thêm enum `PAYROLL_READY/PAID` vào infra sẵn có (SSE+push tự chạy) | 4–5d | Ranh giới cứng: `hr.*` không FK vào `org_invoices`/`payment_transactions` | Lock kỳ → payroll_lines bất biến + push/SSE tới staff |
| 3.5 | **F1 Tuyển dụng consent-based** (THAY THẾ crawler): form ứng tuyển public + upload CV → `DocumentParsingService` (PDF/DOCX) + Gemini extraction → candidate pool trên nền `TeacherProfile` (+ tài khoản employer chính thức TopCV nếu cần nguồn ngoài) | 3–4d | 🔴 KHÔNG build scraper LinkedIn/Facebook/TopCV (ToS + NĐ13 + tư cách cá nhân) | Ứng viên nộp form → hồ sơ structured trong pool |

---

## 5. QUICK WINS (làm được ngay tuần này, tác động cao / công sức thấp)

1. **Xác minh RDS backup + deletion protection** — 15 phút console, chặn rủi ro tử vong lớn nhất (A6-1).
2. **Bật branch protection cho `main`** — 10 phút (hiện KHÔNG có, đã xác nhận qua `gh api`).
3. **UptimeRobot free → `/actuator/health`** — 15 phút, có cảnh báo down độc lập stack (monitoring hiện không xác minh được).
4. **Ký Paid Apps Agreement + W-8BEN + banking** — 0 dòng code, đường găng dài nhất của mọi phương án.
5. **Fix delete-account (2 bảng messages) + IT** — 0.5 ngày, gỡ blocker App Store nghiêm trọng nhất (A3b-1).
6. **V243 CHECK day_of_week 1-7** — 0.25 ngày, mở khóa tạo lịch Chủ nhật (A7-1, đang 500 với mọi org dạy cuối tuần).
7. **Ẩn ULTRA + MoMo khỏi pricing web + sửa copy "free không AI"** — 0.5–1 ngày, tránh thanh toán fail + reject 2.3.1 (B-3, C-4/5).
8. **Gỡ credential prod khỏi `frontend/tests/e2e/live-account.spec.ts` + đổi mật khẩu account đó** — 30 phút (A5, secret hygiene).
9. **`GROQ_SEMAPHORE_ACQUIRE_SEC` 90→15** — chỉ đổi env trên EC2, chặn 30 request AI ôm thread 90 giây khi lớp học dùng đồng thời.
10. **Bật notification khi CI fail trên main** — 30 phút; main đã đỏ 7+ ngày không ai biết.
11. **Sửa README SM-2 → FSRS-4.5** + đánh dấu OUTDATED cho `docs/DATABASE_SCHEMA.md` (đang mô tả MySQL) — 15 phút, chặn AI agent đọc nhầm nền tảng.
12. **2 lệnh AWS CLI xác minh encryption-at-rest (RDS + S3)** — 15 phút, chốt finding NĐ13.

---

## 6. GIẢ ĐỊNH, KHOẢNG TRỐNG & CÂU HỎI CHO CHỦ DỰ ÁN

### Giả định đã dùng
- Deadline "6–7" = **ngày 6–7/7/2026** (đã xác nhận). Kế hoạch Phase 0 neo theo mốc này.
- Đánh giá trên nhánh `main` tại checkout 2026-07-03 (`53ebf015`); code là sự thật khi lệch docs.
- "Chưa có" cho toàn bộ C1 (ngân sách/DAU/doanh thu) → mức ưu tiên được neo theo dữ kiện duy nhất có thật: **~7 active user prod, 0 doanh thu, chi phí ~4,38tr VNĐ/tháng** (đọc từ `docs/Bang_Chi_Tiet_Chi_Phi_DeutschFlow_V2.xlsx`).

### Khoảng trống chưa xác minh được (cần anh/AWS console)
- **RDS automated backup + storage encryption + S3 SSE** — không thể verify từ repo; 3 lệnh console/CLI là chốt được.
- **Monitoring stack có đang chạy trên EC2 không** (probe 4 port timeout từ ngoài; `alertmanager.yml` thật bị gitignore) — cần SSH kiểm tra `docker ps`.
- **Trạng thái GĐ0 GTM B2B** (3 design partner hẹn T6/2026): đã ký được ai chưa? Ảnh hưởng trực tiếp thứ tự ưu tiên Phase 3 (HR/payroll phục vụ chính org của anh hay khách?).
- 18/32 finding CRITICAL/HIGH **chưa qua vòng verify độc lập** (đứt vì session limit) — 6 mục quan trọng nhất đã được spot-check thủ công (đánh dấu trong Mục 3); phần A6 (DevOps) là cụm ⚪ lớn nhất còn lại.

### Quyết định cần anh chốt
1. **Phương án nộp A (free-only 6–7/7) hay B (full Hướng B, trượt ~2 tuần)?** — quyết định lớn nhất, mọi thứ ở Phase 0/1 xếp theo nó.
2. **Stripe giữ hay bỏ?** Khuyến nghị: **giữ nhưng đổi nhãn "gói 30 ngày"** — `Mode.PAYMENT` một-lần thực ra *khớp đúng* mô hình "gói N ngày" đã chốt, chỉ nhãn đang sai; Stripe thành kênh thẻ quốc tế, SePay là kênh VN chính.
3. **Marketplace C2C** (`/api/v2/teachers/public`, đang sống không feature-flag, ngoài GTM đã chốt): flag tắt ở v1.0 hay giữ như phễu Plan C?
4. **Coins** (đã build, dark flag, chỉ trên nhánh galerie): có nằm trong retention loop v1.x không?
5. **Tài khoản demo cho App Review**: tạo account student seed sẵn dữ liệu học (và 1 account phụ để reviewer test delete) — cần anh cấp trước khi submit.

### Cập nhật tri thức nội bộ (memory/docs đã lỗi thời — audit này phát hiện)
- ✅ Đã vá từ lâu nhưng tài liệu vẫn ghi mở: P-15/S-8 gradeFree, P-16 AI image, PAY-1 MoMo dummy, deploy-script auto-commit, "no ShedLock", "CI chết vì billing".
- ❌ Ngược lại, "delete-account DONE (verified)" đã **sai** sau merge P6 (V241) — bài học: mọi checklist "DONE" chạm bảng `users` cần re-verify sau mỗi migration thêm FK.
