package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * Một bài tập của lớp, phía giáo viên.
 *
 * <p>{@code skill} mới được đưa vào DTO: trước đó nó chỉ tồn tại trong DB, nên màn sửa bài tập không
 * có cách nào đổ lại kỹ năng đang đặt — mở ra sửa tiêu đề là kỹ năng âm thầm về mặc định. Giá trị
 * theo quy ước của cột {@code class_assignments.skill}: GENERAL | HOREN | LESEN | SCHREIBEN | SPRECHEN
 * ({@code HOREN} KHÔNG có E — khác {@code can_do_statements.skill_tag}).
 */
public record ClassAssignmentDto(
        Long id,
        Long classId,
        String topic,
        String description,
        String assignmentType,
        String skill,
        Long referenceId,
        LocalDateTime dueDate,
        LocalDateTime createdAt,
        String attachmentUrl,
        Long lessonId
) {}
