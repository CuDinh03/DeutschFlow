package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Mục tiêu học tập chuẩn ("Ich kann …") của một Lektion do trung tâm quy định (spec §2.1, §7).
 * Cùng domain cefr/skill với {@code can_do_statement} (V255): khi gán lớp sinh can-do 1-1 để
 * luồng competency/grading hiện có chạy tiếp; GĐ5 sẽ đánh giá trực tiếp theo objective.
 */
@Entity
@Table(name = "curriculum_objectives")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CurriculumObjective {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lektion_id", nullable = false)
    private Long lektionId;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    /** A1..C2 hoặc null. DB CHECK (V289). */
    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    /** HOEREN/LESEN/SCHREIBEN/SPRECHEN hoặc null. DB CHECK (V289). */
    @Column(name = "skill_tag", length = 16)
    private String skillTag;

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
