package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Màn làm việc theo buổi (PR-7, spec §8): một response gom đủ ba khối Trước/Trong/Sau —
 * thông tin buổi, phân bổ nội dung (kèm phần chuyển tiếp đứng đầu), nhật ký + điểm danh của
 * CHÍNH buổi, roster lớp, trạng thái chốt buổi và cửa sổ sửa hồi tố (P07).
 */
public record SessionWorkspaceDto(
        Long sessionId,
        Long classId,
        String className,
        LocalDateTime startAt,
        int durationMinutes,
        Integer teachingMinutes,
        Integer breakMinutes,
        String mode,
        String room,
        String status,
        LocalDateTime completedAt,
        Long completedByTeacherId,
        /** Còn trong cửa sổ sửa 7 ngày (hoặc đang có mở khóa 24h). */
        boolean editable,
        /** Đang có mở khóa của người duyệt học vụ cho giáo viên này. */
        boolean unlockActive,
        int editWindowDays,
        SessionContentsDto contents,
        /** Nhật ký của CHÍNH buổi (null = chưa ghi). */
        ClassLessonLogDto log,
        List<RosterStudent> roster,
        ScheduleForecastDto forecast,
        /** PR-8 (spec §8): bài tập gắn CHÍNH buổi này — kể cả nháp (chỉ giáo viên thấy nháp). */
        List<ClassAssignmentDto> assignments
) {
    public record RosterStudent(Long studentId, String displayName) {}
}
