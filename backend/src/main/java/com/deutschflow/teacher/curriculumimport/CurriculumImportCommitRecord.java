package com.deutschflow.teacher.curriculumimport;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A completed curriculum import, keyed by the client's idempotency key (V299).
 *
 * <p>Its only job is to make a retry safe: the row is written inside the same transaction as the
 * curriculum, so it exists exactly when the curriculum does, and its unique index turns a racing
 * duplicate into a lost insert instead of a second imported curriculum.
 */
@Entity
@Table(name = "curriculum_import_commit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CurriculumImportCommitRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    @Column(name = "source_material_id")
    private Long sourceMaterialId;

    @Column(name = "modules_created", nullable = false)
    private Integer modulesCreated;

    @Column(name = "lessons_created", nullable = false)
    private Integer lessonsCreated;

    /** The original {@code CurriculumImportCommitResult} as JSON, replayed verbatim on a retry. */
    @Column(name = "result_payload", nullable = false, columnDefinition = "TEXT")
    private String resultPayload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
