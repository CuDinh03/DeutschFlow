package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Mục nội dung BẮT BUỘC của một Lektion (spec §2.1) — cùng domain skill/content tag với
 * {@code lesson_knowledge_point} (V250) để khi gán lớp sinh knowledge point 1-1 không đổi hợp đồng.
 * {@code estimatedMinutes}: ước lượng phút dạy, dùng cho phân bổ buổi ở GĐ2 (không ép nhập).
 */
@Entity
@Table(name = "curriculum_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CurriculumItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lektion_id", nullable = false)
    private Long lektionId;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    /** HOEREN/LESEN/SCHREIBEN/SPRECHEN hoặc null. DB CHECK (V289). */
    @Column(name = "skill_tag", length = 16)
    private String skillTag;

    /** WORTSCHATZ/GRAMMATIK/AUSSPRACHE/LANDESKUNDE/REDEMITTEL/STRATEGIE hoặc null. DB CHECK (V289). */
    @Column(name = "content_tag", length = 16)
    private String contentTag;

    /** Phút dạy ước lượng (>0) hoặc null. DB CHECK (V289). */
    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

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
