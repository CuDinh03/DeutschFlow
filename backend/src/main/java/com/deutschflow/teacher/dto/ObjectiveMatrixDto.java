package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Ma trận đánh giá mục tiêu (PR-9, spec §7): cột = mục tiêu giáo trình theo Lektion; hàng = học
 * viên với trạng thái hiệu lực từng ô + số bài "chờ chấm" (AC12 — trung tính, không phải yếu);
 * kèm gợi ý hỗ trợ theo ngưỡng của trung tâm (chỉ tính người đã đánh giá, nêu số chưa đánh giá).
 */
public record ObjectiveMatrixDto(
        Long classId,
        List<ObjectiveCol> objectives,
        List<StudentRow> students,
        List<Suggestion> suggestions
) {
    public record ObjectiveCol(Long id, Long lektionId, String text, String skillTag, String cefrLevel) {}

    public record StudentRow(Long studentId, String displayName,
                             /** AC12: bài đã nộp chờ giáo viên chấm — hiển thị riêng. */
                             int pendingGradingCount,
                             List<Cell> cells) {}

    public record Cell(Long objectiveId, String status, String evidence) {}

    /** kind: INDIVIDUAL_SUPPORT (≤ ngưỡng kèm riêng) | GROUP_REVIEW (≥ ngưỡng ôn chung) | MIXED. */
    public record Suggestion(Long objectiveId, String kind, List<Long> studentIds,
                             List<String> studentNames, int unassessedCount) {}
}
