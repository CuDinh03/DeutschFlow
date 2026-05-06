# AI Interview Mode v2 — Walkthrough

## Tổng quan thay đổi

Nâng cấp INTERVIEW mode thành buổi phỏng vấn chuyên nghiệp với:
- **Chọn vị trí ứng tuyển** theo persona domain
- **Chọn kinh nghiệm** (0-6th → 5+ năm) + **CEFR level**
- **Kịch bản phỏng vấn 5 phase** chuẩn HR
- **Bản đánh giá cuối** tự động khi kết thúc phỏng vấn

---

## Files Changed

### Backend (9 files)

| File | Change |
|------|--------|
| `V60__ai_speaking_interview_fields.sql` | **[NEW]** Migration: thêm 3 columns |
| `AiSpeakingSession.java` | Thêm `interviewPosition`, `experienceLevel`, `interviewReportJson` |
| `CreateSessionRequest.java` | Thêm `interviewPosition`, `experienceLevel` |
| `AiSpeakingSessionDto.java` | Thêm 3 fields cho frontend consume |
| `AiSpeakingService.java` | Update `createSession` signature |
| `AiSpeakingServiceImpl.java` | Wire fields; endSession → evaluation; tăng history 10 msg cho interview |
| `SystemPromptBuilder.java` | **Core**: `appendInterviewPreamble()` — 5 phases, adaptive rules, STAR |
| `SpeakingPersona.java` | New interview greetings with self-intro; `displayName()` |
| `InterviewEvaluationService.java` | **[NEW]** Report generation (1200 tokens, Vietnamese + German keywords) |

### Frontend (3 files)

| File | Change |
|------|--------|
| `personas.ts` | `interviewPositions[]` per persona (5 positions each) |
| `aiSpeakingApi.ts` | `ExperienceLevel` type; new params in `createSession()` |
| `CompanionSelect.tsx` | Interview setup flow: position + experience + CEFR pickers |

---

## Key Design Decisions

### 1. Interview System Prompt — 5 Phases

```
Phase 1: Begrüßung (AI tự giới thiệu + yêu cầu ứng viên giới thiệu)
Phase 2: Ice-breaker (2 câu)
Phase 3: Hard Skills (4 câu + case study, adaptive +1 nếu 2/4 fail)
Phase 4: Soft Skills/STAR (3 câu)
Phase 5: Abschluss (câu hỏi ngược + cảm ơn)
```

### 2. Suggestion Differentiation by Experience

| Experience | Suggestions |
|-----------|-------------|
| 0-12 tháng | Câu trả lời chi tiết (2-3 câu), viết sẵn sẵn sàng đọc |
| 1+ năm | Chỉ gợi ý hướng triển khai (1 câu, denkanstoß) |

### 3. Evaluation Report Structure

JSON report tiếng Việt + từ khóa Đức:
- 4 categories (Cấu trúc, Chuyên môn, Giao tiếp, Động lực) — mỗi cái có score, green/red flags
- German language assessment (grammar %, vocabulary level, fluency)
- 3-5 giải pháp khắc phục cụ thể
- Lời động viên cá nhân hóa

---

## Verification

- ✅ `mvn compile -q` — clean
- ✅ TypeScript type-check — our files clean (pre-existing errors in unrelated files)
- Report chỉ generate khi endSession() cho INTERVIEW mode, maxTokens=1200
