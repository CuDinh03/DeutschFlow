package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A student's competency status for one Kann-Beschreibung (can_do_statement) — the competency
 * ledger (Phase 2a, V256). Phase 2a writes only student self-assessment (source=SELF); B4 will
 * auto-update the same rows from grading (GRADING) and SRS (SRS).
 */
@Entity
@Table(name = "student_competency")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentCompetency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "can_do_statement_id", nullable = false)
    private Long canDoStatementId;

    /** NOT_STARTED | IN_PROGRESS | MASTERED. DB CHECK enforces the domain (V256). */
    @Column(nullable = false, length = 16)
    private String status;

    /** SELF | GRADING | SRS — origin of the status. DB CHECK enforces the domain (V256). */
    @Column(nullable = false, length = 16)
    private String source;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = LocalDateTime.now();
    }
}
