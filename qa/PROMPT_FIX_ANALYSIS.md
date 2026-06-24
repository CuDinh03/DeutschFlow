# PROMPT — PHÂN TÍCH CODEBASE & RA HƯỚNG SỬA CHI TIẾT (cho Claude Code)

> Dán nguyên file này cho **Claude Code** chạy tại gốc repo `DeutschFlow`.
> Mục tiêu: đọc 2 tài liệu lỗi dưới đây, **đào codebase tới tận file:dòng**, xác nhận nguyên nhân gốc, và xuất **spec sửa chi tiết** cho từng lỗi. KHÔNG vá vội — ra phương án trước, sửa khi được duyệt.

## INPUT (đọc đầy đủ trước)
1. `qa/FIX_PLAN.md` — findings từ test API/E2E (MON-1, TF-1, F-1/F-2, MUT-1, U-1/U-2, TF-2, TF2-1, PRON, SCH-*, F-3…).
2. `audit/QA_2ACCOUNTS_2026-06-24.md` — findings từ QA thủ công 2 tài khoản (H-1/H-2 AI 500, H-3 user.id "undefined", M-1 dashboard 0/0, M-2, L-1…L-5, I-1/I-2).
3. Tham chiếu thêm (để khỏi trùng việc): `audit/REMEDIATION.md`, `audit/pass1-4.md`, `audit/wave*.md`, các `qa/RESULTS_*`.

---

## QUY TẮC BẮT BUỘC
1. **Nguyên nhân gốc phải có bằng chứng `file:dòng` đã đọc thật** — không suy đoán. Trace trọn đường: FE component → `middleware.ts`/api lib → Controller → Service → Repository/Entity (hoặc job/scheduler).
2. **Gộp & khử trùng** findings giữa 2 tài liệu (vài lỗi có thể liên quan nhau, vd MON-1 ↔ TF-1 ↔ flag unlimited; M-2 ↔ H-3). Lập **một danh sách hợp nhất** có ID ổn định.
3. **Kiểm lại mục đã đánh "đã fix"** (vd H-3 user.id, M-2) trong code hiện tại: xác nhận đã sửa thật chưa, còn sót đường nào không. Nếu đã fix trọn → ghi "ĐÃ FIX, verified `file:dòng`", không làm lại.
4. **Đối chiếu `audit/REMEDIATION.md` + wave*`** — nhiều mục có thể đã có ID/đã xử lý; tái dùng, đừng tạo trùng.
5. **KHÔNG đụng các luồng đã verify OK** (xem cuối `FIX_PLAN.md`) — tránh hồi quy.
6. Phân biệt **đã xác nhận** (đọc đúng code) vs **nghi ngờ** (chưa truy hết → để mục "CẦN XÁC MINH").
7. Tiếng Việt, súc tích, kỹ thuật. Mức độ: 🔴/🟠/🟡/⚪. Công: S(giờ)/M(ngày)/L(tuần).
8. **Read-only ở pha phân tích.** Chỉ sửa code khi người dùng duyệt từng mục (hoặc duyệt cả P0).

---

## NỀN TẢNG & BẢN ĐỒ ĐIỂM-BẮT-ĐẦU (xác minh lại, có thể chưa đủ)
- Backend: **Java 17 + Spring Boot 3**, `backend/src/main/java/com/deutschflow/…`. FE: **Next.js (App Router), bản v2** ở `frontend/src/app/v2/…`, middleware `frontend/src/middleware.ts`, api libs `frontend/src/lib/*.ts`, i18n `frontend/messages/{vi,en,de}.json`.
- Quota/tiền: `backend/.../common/quota/` — `QuotaService`, `OrgQuotaService`(org), `FreeTierGuard`, `AiUsageLedgerService`, **`SubscriptionReconcileJob`**, `QuotaVnCalendar`, `QuotaSnapshot`. Lỗi tập trung: `GlobalExceptionHandler` ở `common/exception/`.

| ID (nguồn) | Triệu chứng | Điểm bắt đầu trong code (verify + đào sâu) |
|---|---|---|
| **MON-1** (FIX_PLAN) | Plan admin cấp rớt về DEFAULT sau 1 lần dùng AI (subEnd=null) | `common/quota/SubscriptionReconcileJob.java`; `admin/service/AdminManagementService.java` `updateUserPlan`; `common/quota/QuotaService.java` resolve subscription |
| **TF-1** (FIX_PLAN) | Admin/UI báo INTERNAL/"unlimited" nhưng org-pool enforcement 429 | `common/quota/QuotaService.java` + `OrgQuotaService`; `admin/service/AdminManagementService.java` `userQuota`; FE `app/v2/org/page.tsx` (chip "pool không giới hạn") |
| **H-1** (QA_2ACC) | `POST /api/ai/grammar/correct` → 500 (ERR-1) | `grammar/controller/AIGrammarController.java` và/hoặc `ai/AIController.java` → service gọi LLM; xem nuốt exception/null |
| **H-2** (QA_2ACC) | `POST /api/v2/ai-images/generate` → 500 (ERR-2) | `aiimage/controller/AiImageGenerationController.java` → service (Bedrock/S3) |
| **H-3** (QA_2ACC, "đã fix") | `user.id` = chuỗi `"undefined"` mọi user | FE `frontend/src/lib/api.ts` + nơi lưu user sau login (authSession/store) — **verify đã fix toàn bộ** |
| **M-1** (QA_2ACC) | Org dashboard load lần đầu 0 lớp/0 GV/0 ghế, đúng sau khi điều hướng lại | FE `frontend/src/app/v2/org/page.tsx` (race/effect đầu, orgId chưa sẵn) |
| **M-2** (QA_2ACC) | PostHog `identify("undefined")` ×4 mỗi login | gốc = H-3; verify hết sau khi H-3 fix |
| **F-2** (FIX_PLAN) | `refreshToken` lộ trong body login/`/me` | `user/dto/AuthResponse.java`, `user/service/AuthService.java`, `user/controller/AuthController.java`, `ProfileController` |
| **MUT-1** (FIX_PLAN) | `dayOfWeek` 0–6 (0=T2), value 7→400, lệch ISO | `teacher/dto/UpsertPatternRequest.java`, `teacher/service/ClassScheduleService.java` (sinh buổi), FE form chọn thứ |
| **F-1** (FIX_PLAN) | 500 thay vì 400 khi param ngày sai | `teacher/controller/ClassScheduleController.java`, `common/exception/GlobalExceptionHandler.java` |
| **U-1/U-2** (FIX_PLAN) | Guard sai-role "mềm" /v2 + lỗi lộ path API | `frontend/src/middleware.ts` (`v2RoleHome`); error states `frontend/src/app/v2/org/*`, `v2/teacher/*` |
| **TF-2** (FIX_PLAN) | `/assignments/{id}/evaluate` nhận submissionId, tên sai | `teacher/controller/TeacherController.java` `evaluateAssignment` + service |
| **TF2-1** (FIX_PLAN) | Co-teacher add không kiểm org-membership | `teacher/service/TeacherService.java` `addCoTeacher` (~dòng 310) |
| **PRON** (FIX_PLAN) | pronunciation-check 500 khi thiếu audio | `speaking/controller/PronunciationController.java` + service |
| **L-1** | Link "Trợ giúp" trỏ về home | FE header/layout `app/v2/teacher`, `app/v2/org` |
| **L-2** | Notification hiện key thô "LEARNER PLAN UPDATED" | `notification/NotificationType.java`, `notification/service/UserNotificationService.java`, FE `app/v2/notifications/page.tsx`, `messages/*.json` |
| **L-3** | Radix `DialogContent` thiếu `Description` | FE `frontend/src/components/ui/dialog*` + nơi dùng |
| **L-4** | Chọn DE nhưng UI vẫn tiếng Việt | `frontend/messages/de.json` (thiếu key) |
| **L-5** | Org-Manager thấy tab "Học tập" | FE nav/profile theo role ở `app/v2` |
| **SCH-1/2, F-3, TF2-2, I-1/I-2** | (xem 2 tài liệu) | `teacher/service/ClassScheduleService.java`; `GlobalExceptionHandler`; controllers teacher; các stub "sắp ra mắt" |

> Bảng trên là **gợi ý khởi điểm** — phải mở file, đọc, và bám theo lời gọi để chốt `file:dòng` thật.

---

## QUY TRÌNH CHO MỖI FINDING
Xuất một khối theo mẫu:

```
### <ID> — <tiêu đề> [<mức độ> · công <S/M/L>]
- Triệu chứng: … (kèm repro: API call / bước UI)
- Nguyên nhân gốc: <giải thích> — bằng chứng `path/File.java:dòng` (đã đọc).
- Đường đi: FE … → Controller … → Service … → Repo/Entity/Job … (các file:dòng mấu chốt).
- Hướng sửa: cụ thể — file nào, hàm nào, đổi gì (kèm đoạn code minh hoạ nếu cần).
- Phạm vi ảnh hưởng / rủi ro hồi quy: …
- Nghiệm thu: chạy lại <repro> ⇒ kỳ vọng <kết quả>.
- Liên quan/trùng: <ID khác / mục REMEDIATION/wave nếu có>.
```

Riêng nhóm tiền (**MON-1, TF-1**): nêu rõ **một nguồn sự thật** đề xuất cho trạng thái quota/"unlimited", và mọi call-site đọc/ghi cần đồng bộ; thêm test bao phủ "cấp gói → dùng nhiều lượt → vẫn còn quyền".

---

## ĐẦU RA
- Ghi spec hợp nhất vào **`audit/FIX_SPEC.md`**: (1) tình trạng chung; (2) bảng ưu tiên hợp nhất (ID · mức · công · vùng · trạng thái: Mở/Đã-fix/Cần-xác-minh); (3) các khối chi tiết theo §QUY TRÌNH, xếp **P0 (🔴/🟠) → P1 (🟡) → P2 (⚪)**; (4) "CẦN XÁC MINH"; (5) đề xuất thứ tự thực thi + nhóm có thể gộp 1 PR.
- Sau khi mình duyệt, **mới** thực hiện sửa **theo từng mục/PR nhỏ**, mỗi mục: thay đổi tối thiểu + chạy lại nghiệm thu + (nếu có) thêm test.

## ĐỊNH NGHĨA XONG (pha phân tích)
- 100% finding ở cả 2 tài liệu có khối chi tiết với **nguyên nhân gốc kèm file:dòng** (hoặc nằm ở "CẦN XÁC MINH" nếu chưa chắc).
- Mục "đã fix" (H-3/M-2) được **verify lại trong code hiện tại**.
- Không đề xuất chạm vào danh sách "đã verify OK".

> Bắt đầu: đọc `qa/FIX_PLAN.md` và `audit/QA_2ACCOUNTS_2026-06-24.md`, rồi P0 trước (MON-1, TF-1, H-1, H-2, H-3).
