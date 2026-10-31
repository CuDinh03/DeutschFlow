package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.util.List;

/**
 * Lộ trình đếm ngược tới ngày thi (LT3) — {@code GET /api/exam-plan}.
 *
 * @param status      {@code ACTIVE} có kế hoạch · {@code NEEDS_DATE} thiếu ngày thi ·
 *                    {@code EXAM_PASSED} ngày thi đã qua · {@code UNAVAILABLE} chưa có kế hoạch cho kỳ thi này
 * @param daysLeft    số ngày tới ngày thi; 0 = hôm nay
 * @param currentWeek tuần hiện tại, đếm từ 1
 * @param warnings    mã cảnh báo, client tự dịch: {@code LOW_WEEKLY_TIME}, {@code LEVEL_GAP}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExamPlanDto(
        String status,
        String provider,
        String level,
        LocalDate targetDate,
        Integer daysLeft,
        Integer totalWeeks,
        Integer currentWeek,
        Integer weeklyMinutes,
        List<String> warnings,
        List<WeekDto> weeks
) {
    public static ExamPlanDto of(String status, String provider, String level, LocalDate targetDate) {
        return new ExamPlanDto(status, provider, level, targetDate, null, null, null, null, List.of(), List.of());
    }

    /**
     * @param endDate    ngày cuối của tuần, tính cả ngày đó
     * @param phase      {@code ROADMAP} / {@code FOUNDATION} / {@code TEIL} / {@code FULL}
     * @param doneTasks  số việc đã xong, chỉ đếm việc {@code counted}
     * @param totalTasks số việc tính tiến độ
     */
    public record WeekDto(int weekNo, LocalDate startDate, LocalDate endDate, String phase,
                          List<FocusDto> focus, List<TaskDto> tasks, int doneTasks, int totalTasks) {}

    /** Teil trọng tâm của tuần; client mở chiến thuật LT2 theo cặp này. */
    public record FocusDto(String section, int teil) {}

    /**
     * @param type       {@code DIAGNOSTIC_EXAM} / {@code FULL_EXAM} / {@code ORAL_MOCK} / {@code ORAL_DRILL} /
     *                   {@code ROADMAP_NODES} / {@code WEAKNESS_REVIEW}
     * @param teil       Teil của phiên luyện Nói
     * @param target     số lần cần làm trong tuần
     * @param doneCount  số lần đã làm, đếm từ dữ liệu thật
     * @param counted    {@code false}: việc gợi ý hoặc "Sắp có", không vào tiến độ tuần
     * @param locked     cần gói trả phí
     * @param comingSoon hết đề chưa làm, đề tiếp theo còn chờ duyệt
     * @param examId     đề sẽ làm hoặc đã làm; {@code null} với tuần đã bỏ lỡ
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TaskDto(String type, Integer teil, int target, int doneCount, boolean done, boolean counted,
                          boolean locked, boolean comingSoon, Long examId, String examTitle) {}
}
