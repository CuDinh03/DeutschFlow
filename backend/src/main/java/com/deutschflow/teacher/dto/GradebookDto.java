package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Sổ điểm một lớp: ma trận học viên × bài tập với điểm/trạng thái từng ô.
 * Cột bài tập theo thứ tự cũ → mới (chiều đọc tự nhiên của sổ điểm).
 */
public record GradebookDto(
        Long classId,
        String className,
        List<AssignmentColumn> assignments,
        List<StudentRow> students
) {
    public record AssignmentColumn(Long id, String topic, String assignmentType, LocalDateTime dueDate) {}

    /** cells: assignmentId → ô điểm; thiếu key = học viên chưa từng được giao bài đó. */
    public record StudentRow(Long studentId, String name, String email, Double avgScore,
                             Map<Long, Cell> cells) {}

    public record Cell(String status, Integer score, LocalDateTime submittedAt) {}
}
