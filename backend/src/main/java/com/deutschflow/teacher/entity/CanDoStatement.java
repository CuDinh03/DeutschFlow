package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One Kann-Beschreibung ("Ich kann …") competency target of a class lesson (Phase 1e). Anchored
 * to the lesson (class_lessons) — see V255. Reuses the 4-skill and CEFR enums; unlike knowledge
 * points it is NOT mirrored into class_lessons.description (DTO-only).
 */
@Entity
@Table(name = "can_do_statement")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CanDoStatement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lesson_id", nullable = false)
    private Long lessonId;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    /** One of A1..C2, or null. DB CHECK enforces the domain (V255). */
    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    /** One of HOEREN/LESEN/SCHREIBEN/SPRECHEN, or null. DB CHECK enforces the domain (V255). */
    @Column(name = "skill_tag", length = 16)
    private String skillTag;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
