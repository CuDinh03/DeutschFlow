# PASS 3 — AUDIT AN NINH: TENANT ISOLATION + TOKEN-POOL

> Phương pháp: enumerate đầy đủ bằng grep (95 controller, mọi call-site LLM/TTS/STT, mọi chốt token, mọi ledger-write) → deep-read cluster rủi ro qua 4 agent → **tự verify trực tiếp 4 điểm quyết định nhất**. Mỗi phát hiện kèm `file:dòng` + mức độ.

---

## ĐÍNH CHÍNH MÔ HÌNH SO VỚI ĐỀ BÀI

Đề bài nói "5 role: admin/teacher/TA/accountant/student". **Code chỉ có 3 app-role**: `User.Role = {STUDENT, TEACHER, ADMIN}` (`user/entity/User.java:112`). Org-role `{OWNER, ADMIN, TEACHER, STUDENT}` (`OrgMember.java:22`) tồn tại nhưng **không** được nạp vào Spring Security authorities — chỉ dùng cho `OrgGuard` DB-check. **KHÔNG có role TA, KHÔNG có role accountant** ở bất kỳ đâu trong backend. → Xem Finding **T-5**.

---

# PHẦN A — TENANT ISOLATION

## A.1 — Cơ chế cách ly thực tế (đọc từ code)

Có **hai mô hình cách ly khác nhau**, không thống nhất:

| Loại dữ liệu | Biên cách ly | Cơ chế | File |
|---|---|---|---|
| Dữ liệu org (members, invoices, analytics, roster) | `org_id` lấy từ **token** (`user.getOrgId()`) | `OrgGuard.assertMember/assertOrgAdmin` re-verify DB | `OrgController.java` mọi endpoint |
| Dữ liệu teacher (class, student, grading, sessions) | **Class ownership** (không phải org_id) | `TeacherService.assertTeacherOwnsClass` → `classTeacherRepository.existsByIdClassIdAndIdTeacherId` | `teacher/service/TeacherService.java` |
| Dữ liệu student (assignments, class detail) | **Enrollment** | `assertEnrolled` → `classStudentRepository.existsByIdClassIdAndIdStudentId` | `StudentClassroomService.java:170-174` |

**Quan sát kiến trúc**: Cách ly dữ liệu teacher KHÔNG dựa trên `org_id` — nó dựa trên quan hệ sở hữu lớp. Teacher center A không đọc được data center B vì họ không sở hữu lớp của center B, *không phải* vì có filter `org_id`. Điều này tình cờ đúng, nhưng nghĩa là nếu một lớp bị gán nhầm teacher (co-teacher add sai), biên org bị xuyên thủng mà không có lớp phòng thủ `org_id` thứ hai.

## A.2 — Tenant lấy từ token hay input người dùng?

| Controller | Nguồn `orgId`/`classId` | Re-verify? | Kết luận |
|---|---|---|---|
| `OrgController` (12 endpoint) | **Token** `user.getOrgId()` | `assertMember`/`assertOrgAdmin` mọi endpoint | ✅ An toàn |
| `StudentClassroomController` (4) | Path `classId` (input) | `assertEnrolled` service-layer | ✅ An toàn |
| `StudentAssignmentController` (4) | Path/param `assignmentId` (input) | `findByStudentIdAndAssignmentId` | ✅ An toàn |
| `OrgCertificateController` (3) | Body `classId`+`studentId` (input) | `assertTeacherOwnsClass` + enrollment | ✅ An toàn |
| `TeacherController` (23) | Path `classId`/`studentId` (input) | `assertTeacherOwnsClass` / student-in-my-classes | ✅ An toàn (agent-traced) |
| `AdminOrganizationController` (10) | **Path `orgId`** (input) | ❌ KHÔNG re-verify | ⚠️ Xem T-4 |

**Điểm sống còn được xác minh**: `assertTeacherOwnsClass` là check sở hữu thật (`existsByIdClassIdAndIdTeacherId(classId, teacherId)`), không chỉ kiểm tra tồn tại. Các endpoint nhận `classId`/`studentId` từ path đều re-verify ownership ở service-layer.

## A.3 — Có lỗ hổng cross-tenant không?

**Cluster teacher + org + student: KHÔNG tìm thấy lỗ hổng đọc-chéo-tenant trực tiếp.** Pattern re-verify ownership nhất quán (agent đọc ~40 endpoint, tôi verify pattern + các điểm rủi ro nhất). Đây là phần *mạnh* của codebase.

Tuy nhiên, các finding cấu trúc/quyền sau cần ghi nhận:

### T-1 — `users.org_id` và `org_members` có thể lệch (rủi ro tính-usage-sai) — **Trung bình**
`OrgQuotaService.wouldExceedOrgPool:65-74` lấy org của user qua `SELECT org_id FROM users`. Nhưng `OrgGuard.assertMember:31` dùng `org_members`. `removeMember` (`OrgMembershipService.java:65-78`) set `org_id=null` chỉ khi `orgId.equals(user.getOrgId())`. Nếu user thuộc nhiều org-row lịch sử, hai nguồn lệch → usage tính nhầm vào pool org cũ. KHÔNG có ràng buộc DB ép đồng bộ.

### T-4 — `AdminOrganizationController` không re-verify orgId từ path — **Thấp** (admin-only, defense-in-depth)
10 endpoint nhận `@PathVariable orgId` (`getOrganization`, `updateOrganization`, `listMembers`, `addMember`, `activateEntitlements`, `createInvoice`, `listInvoices`, `updateInvoiceStatus`...) không gọi guard nào ngoài `@PreAuthorize("hasRole('ADMIN')")` class-level. Không phải IDOR cross-org (chỉ platform-admin chạm được), nhưng không có `existsById` fail-fast.

### T-5 — Mô hình 5-role không được hiện thực; finance bị over-privilege — **Trung bình**
Không có role `accountant`/`TA`. Mọi truy cập billing org (`/api/org/invoices`, `/api/org/payment-info`) gate bằng `assertOrgAdmin` = OWNER/ADMIN. Một nhân viên kế toán muốn xem hóa đơn **buộc phải** là org ADMIN → có luôn quyền thêm/xóa member, đổi role, import roster. Không có scoping tài chính riêng. Vi phạm least-privilege.

---

# PHẦN B — TOKEN-POOL ENFORCEMENT

## B.1 — Hai chốt token tồn tại, và chúng phủ rất ít

| Chốt | File | Phủ luồng nào |
|---|---|---|
| `QuotaService.assertAllowed` | `common/quota/QuotaService.java:47` | CHỈ speaking chat + 3 eval |
| `OrgPoolGuard.assertOrgPoolAvailable` + `FreeTierGuard` | `organization/service/OrgPoolGuard.java:29` | CHỈ teacher grading + PPTX + OCR |

**Mọi luồng AI khác không có chốt nào.**

## B.2 — Bảng đầy đủ MỌI call-site LLM/TTS/STT + trạng thái chốt

### LLM (chatCompletion) — đã enumerate toàn bộ

| # | Call-site | Endpoint / Role | Chốt token? | Ghi ledger? | Mức |
|---|---|---|---|---|---|
| 1 | `ChatCompletionService.java:60` (chat turn) | AiSession chat / authed | ✅ `assertAllowed` (ChatPrep:312) | ✅ TurnSideEffects:95 | OK |
| 2 | `AiSpeakingServiceImpl.java:305` (greeting) | speaking / authed | ✅ ChatPrep:189 | ✅ | OK |
| 3 | `SpeakingStreamService.java:171` (stream) | SSE chat / authed | ✅ ChatPrep:312 | ✅ | OK |
| 4 | `InterviewQuestionGenerator.java:62` | qua ChatPrep | ✅ ChatPrep:312 | ✅ | OK |
| 5 | `WeeklySpeakingService.java:161` | weekly / authed | ✅ :143 | ✅ :168 | OK |
| 6 | `ConversationEvaluationService.java:64` | end-session / authed | ⚠️ gated :61 **nhưng nuốt** | ❌ | **Cao (P-6)** |
| 7 | `InterviewEvaluationService.java:62` | end-session / authed | ⚠️ gated :59 **nhưng nuốt** | ❌ | **Cao (P-6)** |
| 8 | `GradingService.java:300` | teacher grade | ✅ OrgPool (Ctrl:105/273) | ✅ :400 | OK (chỉ org pool) |
| 9 | `TeacherAiGradingService.java:71` | teacher grade | ✅ OrgPool | ✅ :156 | OK (chỉ org pool) |
| 10 | `AiExamEvaluatorService.java:50,169` | **`/api/mock-exams/.../finish`** no @PreAuthorize | ❌ KHÔNG | ❌ KHÔNG | **Cao (P-1)** |
| 11 | `SkillTreeController.java:245` correct-writing | isAuthenticated | ❌ KHÔNG | ❌ KHÔNG | **Cao (P-1)** ✓verify |
| 12 | `PracticeNodeService.java:117,143` | `/skill-tree/.../practice/start` isAuthenticated | ❌ KHÔNG | ✅ :172 (sau) | **Cao (P-2)** |
| 13 | `SkillTreeService.java:417` (satellite gen) | `/skill-tree/.../unlock` isAuthenticated | ❌ KHÔNG | ✅ :438 (sau) | **Cao (P-2)** |
| 14 | `SkillTreeService.java:886` (pronunciation) | isAuthenticated | ❌ KHÔNG | ✅ :903 | **Cao (P-2)** |
| 15 | `SkillTreeService.java:1024` (interview report) | async worker | ❌ KHÔNG | ✅ :1032 | **Trung bình (P-2)** |
| 16 | `SpeakingAiHelpersService.java:26` | **`AISpeakingController` KHÔNG @PreAuthorize** | ❌ KHÔNG | ❌ KHÔNG | **Nghiêm trọng (P-3)** ✓verify |
| 17 | `GroqApiService.java:31,53` (greeting-session) | `SpeakingController` authed | ❌ KHÔNG | ❌ KHÔNG | **Cao (P-1)** |
| 18 | `VideoLessonService.java:184` (listening gen) | `/video-lessons/listening` authed | ❌ KHÔNG | ❌ KHÔNG | **Cao (P-1)** |
| 19 | `GrammarSyllabusController` generate (teacher AI) | `hasAnyRole(TEACHER,ADMIN)` | ❌ KHÔNG (kể cả org pool!) | ❌ | **Cao (P-4)** |
| 20 | `LlmViTranslationService.java:193` | admin batch | ❌ (admin) | ❌ | Thấp |
| 21 | `LlmDtypeFixService.java:263` | admin batch | ❌ (admin) | ❌ | Thấp |
| 22 | `VocabularyAutoTaggingService.java:191` | admin batch | ❌ (admin) | ✅ :199 | Thấp |
| 23 | `ErrorDetectionService.java:43` | **không caller** | — | — | Dead code |
| 24 | `AiSpeakingMockExamController.java:91` + `SprechenTeil2Service:134,159` | onboarding mock | ⚠️ chỉ **rate-limiter** (`requireEvalBudget`), KHÔNG token quota | ❌ | **Trung bình (P-5)** |

### TTS

| Call-site | Endpoint / Role | Chốt? | Mức |
|---|---|---|---|
| `TtsController.java:50` `POST /api/ai-speaking/tts` | `isAuthenticated()`, **text do user nhập, không giới hạn độ dài** | ❌ KHÔNG | **Cao (P-7)** ✓verify |
| `SpeakingStreamService` XTTS pipeline (:198-200) | qua speaking turn | ✅ gián tiếp (ChatPrep) | OK |
| `VideoLessonService.java:255` edgeTts | admin video gen | ❌ (admin) | Thấp |

### STT (Whisper) — tất cả ghi `recordStt` SAU, KHÔNG pre-check

`SkillTreeController:183`, `PhonemeService:38`, `AiJobWorker:107`, `AiSessionController:106`, `PronunciationScorerService:42` — đều `recordStt` post-hoc vào `stt_usage_events`, **không** kiểm tra quota/pool trước. STT phí audio-giây không bao giờ bị chặn. → **P-8, Trung bình**.

## B.3 — Profit leak: org pool MÙ với phần lớn tiêu thụ AI

`OrgQuotaService.orgUsageThisMonth:28-34` tính pool bằng `SUM(total_tokens) FROM ai_token_usage_events`. Hệ quả theo hai lớp:

- **Lớp A — ungated nhưng CÓ ghi ledger** (#12-15): pool *thấy* tiêu thụ này (cộng dồn vào SUM) nhưng **không bao giờ chặn trước** các call này. Một student org dùng skill-tree/practice thoải mái; usage được ghi → đẩy SUM lên → chỉ làm **luồng speaking (đã gated) của chính org đó bị khóa**. Pool bị "đốt" bởi đường không kiểm soát.
- **Lớp B — ungated VÀ KHÔNG ghi ledger** (#10,11,16,17,18,19): hoàn toàn **vô hình** với mọi accounting. Mock-exam finish, correct-writing, speaking-helpers, greeting-session, video listening, grammar-syllabus → gọi Groq mà pool/quota/ledger **đều không thấy**. Đây là rò rỉ chi phí thuần.

## B.4 — Token có thể bị tiêu quá hạn mức (race / không atomic)?

**CÓ — ba cơ chế:**

### P-9 — Check-then-debit không atomic (race) — **Trung bình**
`QuotaService.assertAllowed:47` là `@Transactional(REQUIRES_NEW)` — transaction **riêng**, chỉ đọc. Trừ tiền (`applyUsageDebit:82`) xảy ra ở transaction ledger **sau** LLM call. Giữa hai mốc là LLM call (2-10s). N request đồng thời cùng user đều đọc `remaining=10`, đều pass, đều tiêu → tổng vượt quota. Không có lock, không `SELECT FOR UPDATE`.

### P-10 — Org pool không có khóa, chỉ là SUM — **Trung bình**
`OrgQuotaService.wouldExceedOrgPool:64-85` làm `SELECT SUM` không lock. `OrgPoolGuard:29-39` chỉ check, không decrement counter. Hai teacher chấm bài đồng thời khi pool sắp cạn → cả hai pass → vượt pool. Soft cap, không enforce cứng.

### P-11 — Wallet clamp `GREATEST(0, ...)` nuốt phần vượt — **Trung bình**
`QuotaService.java:100`: `balance = GREATEST(0, balance - ?)`. Balance không bao giờ âm → nhưng nghĩa là phần tiêu vượt (spend > balance) bị **hấp thụ im lặng thành 0**, user dùng free phần dôi. Doanh thu thất thoát không được ghi nhận ở đâu.

---

# TỔNG HỢP FINDING THEO MỨC ĐỘ

| ID | Mô tả | File:dòng | Mức |
|---|---|---|---|
| **P-3** | `AISpeakingController` /api/speaking/ai/* — KHÔNG @PreAuthorize, KHÔNG token, KHÔNG ledger; mọi user authed gọi LLM với input tùy ý | `AISpeakingController.java:35-90`, `SpeakingAiHelpersService.java:26` | 🔴 **Nghiêm trọng** |
| **P-1** | LLM ungated + vô hình ledger: mock-exam finish, correct-writing, greeting-session, video listening | `AiExamEvaluatorService:50,169`; `SkillTreeController:245`; `GroqApiService:31,53`; `VideoLessonService:184` | 🔴 **Cao** |
| **P-2** | LLM ungated (student) đốt org pool gián tiếp: practice, satellite, pronunciation | `PracticeNodeService:117,143`; `SkillTreeService:417,886` | 🔴 **Cao** |
| **P-4** | Teacher AI tool (sinh bài tập) bỏ qua cả org pool | `GrammarSyllabusController` generate | 🔴 **Cao** |
| **P-6** | `assertAllowed` bị `catch(Exception)` nuốt ở 2 eval → enforcement vô hiệu + không ghi ledger | `ConversationEvaluationService.java:44-79`; `InterviewEvaluationService.java:43-78` | 🔴 **Cao** |
| **P-7** | TTS endpoint không chốt, text user nhập không giới hạn độ dài | `TtsController.java:37-62` | 🔴 **Cao** |
| **B-leak** | Org pool = SUM(ledger) nên mù với toàn bộ Lớp B; enforce sai đối tượng | `OrgQuotaService.java:28-34` | 🔴 **Cao** |
| **P-5** | Onboarding mock-exam chỉ rate-limit, không token quota | `AiSpeakingMockExamController:34,143` | 🟠 Trung bình |
| **P-8** | STT không pre-check, chỉ ghi post-hoc | `AiSessionController:106`, `PhonemeService:38`, +3 | 🟠 Trung bình |
| **P-9** | Check-then-debit không atomic (race over-spend) | `QuotaService.java:47,82` | 🟠 Trung bình |
| **P-10** | Org pool không khóa (race vượt pool) | `OrgQuotaService.java:64-85` | 🟠 Trung bình |
| **P-11** | Wallet clamp nuốt overage → thất thoát doanh thu im lặng | `QuotaService.java:100` | 🟠 Trung bình |
| **T-1** | `users.org_id` vs `org_members` có thể lệch → usage tính sai org | `OrgQuotaService.java:65-74` vs `OrgGuard.java:31` | 🟠 Trung bình |
| **T-5** | Không có role accountant/TA → finance buộc làm org-admin (over-privilege) | `User.java:112`, `OrgController` billing | 🟠 Trung bình |
| **T-4** | Admin org endpoint không re-verify orgId từ path | `AdminOrganizationController.java` (10 ep) | 🟡 Thấp |
| **dead** | `ErrorDetectionService` không có caller | `ErrorDetectionService.java:43` | 🟡 Thấp |

---

## Kết luận hai mặt trận

**Tenant isolation (đọc-chéo): MẠNH.** Cluster teacher/org/student re-verify ownership nhất quán; không tìm thấy IDOR cross-tenant trực tiếp. Rủi ro còn lại là cấu trúc (T-1 drift, T-5 thiếu role) và defense-in-depth (T-4).

**Token-pool enforcement: YẾU NGHIÊM TRỌNG — đúng như lo ngại "profit risk #1".** Chốt token chỉ phủ ~5/24 đường LLM. Lỗ hổng tệ nhất là **P-3** (`AISpeakingController`: không auth-role, không token, không ledger — bất kỳ user đăng nhập nào cũng bơm Groq vô hạn với prompt tùy ý) và **B-leak** (org pool tính bằng SUM ledger nên mù với toàn bộ luồng skill-tree/mock-exam/helpers — vừa không chặn, vừa không thấy).

**Đã verify trực tiếp** (không qua agent): P-3, P-1 (correct-writing + mock-exam no-@PreAuthorize), P-7, và bảng ledger-write. Phần tenant teacher-cluster dựa trên agent-trace pattern (`assertTeacherOwnsClass`) — nếu cần chắc 100% nên đọc trực tiếp toàn bộ 23 method `TeacherController` ở pass sau.
