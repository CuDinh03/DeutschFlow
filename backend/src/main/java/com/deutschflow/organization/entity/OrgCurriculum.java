package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Bộ giáo trình do TRUNG TÂM (org) quản lý — nguồn nội dung chuẩn cho lớp trung tâm (spec §2.1,
 * quyết định P03). Nội dung thật nằm trong các phiên bản ({@link OrgCurriculumVersion}); bảng này
 * chỉ giữ metadata. {@code sample} = bộ mẫu để thử luồng vận hành, không dùng cho lớp thật.
 */
@Entity
@Table(name = "org_curricula")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgCurriculum {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false)
    private Long orgId;

    @Column(nullable = false, length = 300)
    private String name;

    /** Cấp CEFR mục tiêu của bộ (A1..C2); dùng làm cefr_level cho bài sinh ra. DB CHECK (V289). */
    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Bộ mẫu (seed) chỉ để chạy thử — không coi là giáo trình chính thức (P03). */
    @Column(name = "is_sample", nullable = false)
    @Builder.Default
    private boolean sample = false;

    @Column(name = "created_by")
    private Long createdBy;

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
