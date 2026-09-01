package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "class_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    /** Optional link to the ClassLesson this assignment belongs to (Phase 1d-D1). Nullable;
     *  ON DELETE SET NULL keeps the assignment (and its grades) if the lesson is deleted. */
    @Column(name = "lesson_id")
    private Long lessonId;

    @Column(nullable = false)
    private String topic;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "assignment_type", length = 50)
    private String assignmentType; // GENERAL, VOCABULARY, SPEAKING_SCENARIO

    /** German-skill tag: HOREN | LESEN | SCHREIBEN | SPRECHEN | GENERAL */
    @Column(name = "skill", length = 20)
    private String skill;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "attachment_url", length = 1000)
    private String attachmentUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** P06 (V297): DRAFT vô hình với học viên — không StudentAssignment, không notification. */
    @Column(nullable = false, length = 16)
    @lombok.Builder.Default
    private String status = "PUBLISHED";

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    /** Bài gắn BUỔI (spec §8) — buổi dời qua duyệt: bài DRAFT tự dời hạn theo, PUBLISHED thì không. */
    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "lektion_id")
    private Long lektionId;

    @Column(name = "curriculum_item_id")
    private Long curriculumItemId;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
