package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One "kiến thức cần học" (knowledge point) of a class lesson. The authoritative store
 * for a lesson's points (Phase 1b); the parent {@code class_lessons.description} keeps a
 * newline-encoded mirror for legacy/mobile readers (dual-write in the service).
 */
@Entity
@Table(name = "lesson_knowledge_point")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LessonKnowledgePoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lesson_id", nullable = false)
    private Long lessonId;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    /** One of HOEREN/LESEN/SCHREIBEN/SPRECHEN, or null. DB CHECK enforces the domain (V250). */
    @Column(name = "skill_tag", length = 16)
    private String skillTag;

    /** One of WORTSCHATZ/GRAMMATIK/AUSSPRACHE/LANDESKUNDE/REDEMITTEL/STRATEGIE, or null. */
    @Column(name = "content_tag", length = 16)
    private String contentTag;

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
