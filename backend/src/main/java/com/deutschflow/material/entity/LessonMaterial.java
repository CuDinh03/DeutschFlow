package com.deutschflow.material.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Attaches a {@link Material} to a {@code class_lessons} row (Phase 1d-D2). Mirrors
 * {@link ClassMaterial}: a lesson never owns or mutates a material — the join keeps ownership
 * clean and lets one material be reused across many lessons/classes. {@code orderIndex} orders
 * the materials within a lesson.
 */
@Entity
@Table(name = "lesson_material")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LessonMaterial {

    @EmbeddedId
    private LessonMaterialId id;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(name = "attached_by", nullable = false)
    private Long attachedBy;

    @Column(name = "attached_at", nullable = false, updatable = false)
    private Instant attachedAt;

    @PrePersist
    void onCreate() {
        if (attachedAt == null) attachedAt = Instant.now();
        if (orderIndex == null) orderIndex = 0;
    }
}
