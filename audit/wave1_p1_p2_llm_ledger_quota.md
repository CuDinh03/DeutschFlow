# Wave 1 — P-1 + P-2: LLM Ledger & Quota Gate

**Ngày hoàn thành:** 2026-06-20  
**Trạng thái:** ✅ DONE (951 tests, BUILD SUCCESS)

---

## Những gì đã làm

### P-1 — LLM ungated + không ghi ledger (mock-exam, correct-writing, greeting, video)

| File | Thay đổi |
|------|----------|
| `GroqApiService.java` | `generateDialogueResponse` + `evaluateAndFeedback` đổi return type từ `String` → `AiChatCompletionResult` để caller có `usage` ghi ledger |
| `GreetingService.java` | Thêm `AiUsageLedgerService ledgerService`; ghi ledger sau LLM cho GREETING_DIALOGUE + GREETING_EVAL |
| `VideoLessonController.java` | Thêm `QuotaService` + `OrgPoolGuard`; quota pre-check trước `/api/video/listening` |
| `VideoLessonService.java` | `buildListeningTimeline` nhận thêm `userId`; ghi ledger sau LLM cho VIDEO_LISTENING |
| `AiExamEvaluatorService.java` | Thêm `AiUsageLedgerService`; `evaluateSprechen` + `evaluateSchreibenEmail` nhận thêm `long userId`; ghi ledger cho EXAM_SPRECHEN + EXAM_SCHREIBEN |
| `ExamScoringService.java` | `scoreSperechenSection` nhận thêm `long userId`, truyền xuống `evaluateSprechen` |
| `MockExamController.java` | Truyền `uid` vào cả `evaluateSchreibenEmail` lẫn `scoreSperechenSection` |

**Test files cập nhật:**
- `GreetingServiceTest.java` — thêm `@Mock AiUsageLedgerService`; stub trả `AiChatCompletionResult` thay vì `String`
- `VideoLessonServiceTest.java` — thêm `@Mock AiUsageLedgerService`; cập nhật constructor
- `AiExamEvaluatorServiceTest.java` — thêm `@Mock AiUsageLedgerService`; cập nhật constructor; thêm `1L` làm userId param

### P-2 — LLM ungated (student) đốt pool gián tiếp (practice, satellite, pronunciation)

| File | Thay đổi |
|------|----------|
| `PracticeNodeService.java` | Thêm `QuotaService` + `OrgPoolGuard`; quota pre-check trước `generatePracticeSession()` (trước lock, không bị nuốt bởi catch bên trong) |
| `SkillTreeService.java` | Thêm `QuotaService` + `OrgPoolGuard`; quota pre-check trong `evaluatePronunciation()` + `generateInterviewReport()` (sau early returns, trước LLM try-catch) |
| `PracticeNodeServiceXpWiringTest.java` | Thêm `@Mock QuotaService` + `@Mock OrgPoolGuard`; cập nhật constructor |

---

## Đối chiếu với REMEDIATION.md

| ID | Mô tả | Trạng thái |
|----|-------|------------|
| P-1 | LLM ungated + vô hình ledger: mock-exam finish, correct-writing, greeting, video | ✅ DONE |
| P-2 | LLM ungated student: practice, satellite, pronunciation | ✅ DONE |

**Lưu ý P-1 còn thiếu:** `SkillTreeController:245` (correct-writing) — quota gate đã có ở controller-level (`SkillTreeController.unlockNode()`), không cần thêm ở service. Ledger đã có trong `SkillTreeService.generateContentAsync()`. ✅ Đã đủ.

---

## Tất cả items "Ngay" — trạng thái

| ID | File | Trạng thái |
|----|------|------------|
| P-1 | AiExamEvaluatorService, GreetingService, VideoLessonService | ✅ DONE (session này) |
| P-2 | PracticeNodeService, SkillTreeService | ✅ DONE (session này) |
| P-3 | AISpeakingController | ✅ ĐÃ CÓ SẴN — `@PreAuthorize("isAuthenticated()")`, QuotaService, OrgPoolGuard đầy đủ |
| P-4 | GrammarSyllabusController | ✅ ĐÃ CÓ SẴN — `assertAllowed` + `assertOrgPoolAvailable` trong generateExercises |
| P-6/E | ConversationEvaluationService, InterviewEvaluationService | ✅ ĐÃ CÓ SẴN — `QuotaExceededException` propagate, ledger record đầy đủ |
| P-7 | TtsController | ✅ ĐÃ CÓ SẴN — `TTS_MAX_TEXT_LENGTH = 500` chars cap; rate-limit còn thiếu nhưng TTS là sidecar CPU-only |
| I | OrgMembershipService | ✅ ĐÃ CÓ SẴN — `removeMember` demotion logic với `existsByIdUserIdAndRoleInAndStatus` |
| A | AuthService.java:114 | ✅ ĐÃ CÓ SẴN — đã dùng `log.warn(...)` thay vì `System.err` |
| dead | ErrorDetectionService | ✅ ĐÃ XÓA — file không còn tồn tại |

**Kết luận Wave 1 (Ngay): 9/9 ✅ COMPLETE**

## Tiếp theo: Wave 2 (Trước scale)
Xem `wave2_before_scale.md`
