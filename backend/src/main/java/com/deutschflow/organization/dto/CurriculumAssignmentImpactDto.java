package com.deutschflow.organization.dto;

/**
 * Tác động của việc gán/đổi/gỡ giáo trình lên lớp — hiển thị trong dialog xác nhận (§2.11 plan).
 * {@code canApply} = false khi bài sinh từ giáo trình hiện tại đã có dấu vết giảng dạy/học tập:
 * nhật ký buổi dạy, bài tập, bài đã đánh dấu hoàn thành, hoặc sổ năng lực học viên gắn can-do
 * của bài. PR-1 chặn các ca này để không mất lịch sử (spec §2.1); luồng chuyển đổi sâu hơn thuộc
 * giai đoạn sau.
 */
public record CurriculumAssignmentImpactDto(
        Long currentVersionId,
        Long targetVersionId,
        long generatedLessonCount,
        long logCount,
        long assignmentCount,
        long completedLessonCount,
        long competencyRecordCount,
        boolean canApply
) {}
