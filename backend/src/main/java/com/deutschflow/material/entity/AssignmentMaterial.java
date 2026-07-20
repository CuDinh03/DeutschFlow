package com.deutschflow.material.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Attaches a {@link Material} to a {@code class_assignments} row. Mirrors {@link LessonMaterial}:
 * an assignment never owns or mutates a material — the join keeps ownership clean and lets one
 * material be handed out across many assignments/lessons/classes. {@code orderIndex} orders the
 * materials within an assignment.
 */
@Entity
@Table(name = "assignment_material")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignmentMaterial {

    @EmbeddedId
    private AssignmentMaterialId id;

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
