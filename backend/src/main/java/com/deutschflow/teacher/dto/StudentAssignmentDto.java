package com.deutschflow.teacher.dto;

import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;

import java.time.LocalDateTime;

public record StudentAssignmentDto(
        Long id,
        Long assignmentId,
        Long studentId,
        String status,
        Integer teacherScore,
        String teacherFeedback,
        LocalDateTime submittedAt,
        LocalDateTime createdAt,
        String topic,
        String description,
        String assignmentType,
        LocalDateTime dueDate,
        String submissionContent,
        String submissionFileUrl,
        String attachmentUrl,
        Long referenceId
) {

    /**
     * Student-facing view of a submission row — the ONLY mapper student surfaces may use. Until a
     * teacher finalizes the grade ({@link AssignmentStatus#isFinal}), {@code score} is an unconfirmed
     * AI proposal and {@code feedback} can even be an ops error note from a failed AI pass
     * (GRADING_FAILED) — neither has been published to the student, so both read as null here.
     * Teacher-facing mappers keep the raw values: the proposal is the teacher's to review.
     */
    public static StudentAssignmentDto forStudent(StudentAssignment a, ClassAssignment ca) {
        boolean published = AssignmentStatus.isFinal(a.getStatus());
        return new StudentAssignmentDto(
                a.getId(), a.getAssignmentId(), a.getStudentId(), a.getStatus(),
                published ? a.getScore() : null,
                published ? a.getFeedback() : null,
                a.getSubmittedAt(), a.getCreatedAt(),
                ca != null ? ca.getTopic() : "",
                ca != null ? ca.getDescription() : "",
                ca != null ? ca.getAssignmentType() : "GENERAL",
                ca != null ? ca.getDueDate() : null,
                a.getSubmissionContent(),
                a.getSubmissionFileUrl(),
                ca != null ? ca.getAttachmentUrl() : null,
                ca != null ? ca.getReferenceId() : null);
    }
}
