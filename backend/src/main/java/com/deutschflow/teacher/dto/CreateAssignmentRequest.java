package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CreateAssignmentRequest(
        String topic,
        String description,
        String assignmentType,
        /** German-skill tag: HOREN | LESEN | SCHREIBEN | SPRECHEN | GENERAL */
        String skill,
        Long referenceId,
        LocalDateTime dueDate,
        String attachmentUrl,
        /** Optional link to a ClassLesson in the same class (Phase 1d-D1). */
        Long lessonId,
        /** Materials from the teacher's library to attach to this assignment (in pick order). Optional. */
        List<Long> materialIds,
        /** PR-8 (P06): DRAFT = nháp vô hình với học viên; null/PUBLISHED = công bố ngay (hành vi cũ). */
        String status,
        /** PR-8 (spec §8): bài gắn BUỔI — buổi dời qua duyệt thì bài nháp tự dời hạn theo. */
        Long sessionId,
        Long lektionId,
        Long curriculumItemId,
        /** PR-8 (AC14): null/rỗng = giao cả lớp; có phần tử = CHỈ những học viên này nhận bài. */
        List<Long> recipientStudentIds
) {
    /** Arity cũ (trước PR-8) — caller/test hiện có giữ nguyên: công bố ngay, cả lớp. */
    public CreateAssignmentRequest(String topic, String description, String assignmentType, String skill,
                                   Long referenceId, LocalDateTime dueDate, String attachmentUrl,
                                   Long lessonId, List<Long> materialIds) {
        this(topic, description, assignmentType, skill, referenceId, dueDate, attachmentUrl,
                lessonId, materialIds, null, null, null, null, null);
    }
}
