# v2 Admin/Teacher BE↔FE Audit — Round-2 Follow-ups (để phiên sau)

> Nguồn: audit BE↔FE admin+teacher 2026-06-22. Round-1 (logo brand · grammar explain · revenue KPIs ·
> teacher duyệt-vào-lớp) đã xong + merged ([PR #141](https://github.com/CuDinh03/DeutschFlow/pull/141)).
> Dưới đây là phần CÒN LẠI — admin-niche / lớn hơn — kèm shape thật để làm thẳng.

## 1. Admin trang build SAI DTO (đang trắng/hỏng)

### 1a. `weekly-speaking` (`frontend/src/app/v2/admin/weekly-speaking/page.tsx`) — HIGH
- **Triệu chứng:** form CRUD gửi `{weekNumber, cefrLevel, topicDe, topicVi, descriptionVi, isActive}` → **400** (sai hết field bắt buộc); list đọc `weekNumber/topicDe/...` → trắng.
- **DTO thật** `WeeklyPromptAdminUpsertRequest` (`backend/.../speaking/dto/WeeklySpeakingDtos.java`): `weekStartDate (LocalDate @NotNull)`, `cefrBand (@NotBlank)`, `title (@NotBlank)`, `promptDe (@NotBlank)`, `mandatoryPoints (List @NotNull)`, `optionalPoints?`, `active?`.
- **List** trả cột JDBC: `week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, prompt_version, is_active`.
- **Fix:** viết lại form (date-picker weekStart · cefrBand · title · promptDe textarea · mandatory/optional points list) + list đọc field thật.

### 1b. 3 trang reports con — MED (hub cha `reports/page.tsx` đọc ĐÚNG → tham chiếu)
- **`reports/vocabulary-quality`**: BE `AdminManagementService.vocabularyQualityDaily()` trả `{nounGenderCoverage, translationCoverage}` — KHÔNG có `days/total_generated/approval_rate_pct`. → đổi page sang shape coverage, HOẶC thêm BE projection nếu muốn breakdown theo ngày.
- **`reports/grammar-feedback-coverage`**: BE trả rows `{snapshotDate, totalSubmits, totalItems, itemsWithFeedback, coveragePercent}`. Page đọc fake `{grammar_point, feedback_count, distinct_users, last_seen}`. → đọc field thật (hub `reports/page.tsx:62,84` làm đúng).
- **`reports/personalization-ruleset`**: BE `describeActiveRuleset()` trả CHỈ `{version, dimensionsSupported}`. Page đọc fake `{total_learners_with_plan, avg_sessions_per_week, cefr_distribution, topic_preferences}`. → render version/dimensions, HOẶC thêm BE endpoint stats learner.

## 2. Admin shape/wire
- **Wire rubric phỏng vấn** (`frontend/src/app/v2/admin/personas/page.tsx:64-69,268`) — HIGH. `GET/PUT /api/admin/interviews/rubrics[/{id}]` đã có (`interviewAdminApi.listRubrics/updateRubric`); page đang lưu **client-side giả** ("Lưu rubric (chờ backend per-template)"). → gọi `updateRubric`.
- **orgs seat/validUntil** (`frontend/src/app/v2/admin/organizations/page.tsx:352,220,356`) — MED + ⚠️ **BE gap**. `OrgDto` list THIẾU `seatUsed`/`validUntil`/`monthlyTokenPool`/`createdAt`; `validUntil` **không có trên DTO nào** (chỉ trên entity). → thêm field vào `OrgDto`/`OrgDetailDto` (backend) + modal fetch detail. Không fix FE-thuần được.

## 3. BE→FE coverage gaps (BE có sẵn, v2 chưa surface — backlog)
- **Admin:** role-change UI (xem [b2b checklist P0-1]) · bulk-assign students (`/admin/classes/{id}/students/bulk-assign`) · grading-eval (`AdminGradingEvalController`) · ai-cost-summary planning · vocab review-queue + import/cleanup suite.
- **Teacher:** gradebook (`/classes/{id}/gradebook` → `GradebookDto`) · comprehensive-report (class-detail "Chi tiết" = toast stub) · co-teaching (`/classes/{id}/teachers`) · student evaluations/skill-report · materials PPTX (`/v2/teacher/materials/generate-pptx` thật nhưng page disabled).
- **Lưu ý:** teacher `analytics` page THỰC SỰ chạy (note memory cũ "no-backend" = sai).

## Đã sạch (không cần làm)
Mọi endpoint FE gọi đều tồn tại + đúng quyền; nav không link chết; API method đều có thật; không link chéo vai trò.
