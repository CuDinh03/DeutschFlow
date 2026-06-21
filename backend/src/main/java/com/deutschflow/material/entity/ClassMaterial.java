package com.deutschflow.material.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Attaches a {@link Material} to a {@code teacher_classes} row (B2B model §5). A separate join
 * table keeps material ownership clean — a class never owns or mutates a material.
 */
@Entity
@Table(name = "class_materials")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassMaterial {

    @EmbeddedId
    private ClassMaterialId id;

    @Column(name = "attached_by", nullable = false)
    private Long attachedBy;

    @Column(name = "attached_at", nullable = false, updatable = false)
    private Instant attachedAt;

    @PrePersist
    void onCreate() {
        if (attachedAt == null) attachedAt = Instant.now();
    }
}
