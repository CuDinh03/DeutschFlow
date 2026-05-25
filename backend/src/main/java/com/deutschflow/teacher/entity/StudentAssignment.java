package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "student_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(length = 50, nullable = false)
    @Builder.Default
    private String status = "PENDING"; // PENDING, SUBMITTED, GRADED

    private Integer score;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "graded_at")
    private LocalDateTime gradedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "submission_content", columnDefinition = "TEXT")
    private String submissionContent;

    @Column(name = "submission_file_url", length = 1024)
    private String submissionFileUrl;

    @Column(name = "is_deleted")
    @Builder.Default
    private boolean deleted = false;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
