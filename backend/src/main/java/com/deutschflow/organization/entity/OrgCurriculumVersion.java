package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Một phiên bản của bộ giáo trình. Vòng đời {@code DRAFT → PUBLISHED → ARCHIVED} (DB CHECK V289):
 * chỉ DRAFT được sửa nội dung; PUBLISHED là BẤT BIẾN (sửa = tạo phiên bản mới — spec §2.1 "sửa mẫu
 * chung không âm thầm đổi nội dung lớp đang học"); ARCHIVED không gán mới nhưng lớp đang gắn vẫn
 * giữ nguyên. Lớp gắn phiên bản qua {@link ClassCurriculumLink}.
 */
@Entity
@Table(name = "org_curriculum_versions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgCurriculumVersion {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_PUBLISHED = "PUBLISHED";
    public static final String STATUS_ARCHIVED = "ARCHIVED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "curriculum_id", nullable = false)
    private Long curriculumId;

    /** Số phiên bản tăng dần trong một bộ; UNIQUE (curriculum_id, version_no) (V289). */
    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = STATUS_DRAFT;

    /** Ghi chú nguồn (ví dụ: nhập từ bộ giáo trình thật đợt nào) — phục vụ truy vết P03. */
    @Column(name = "source_note", columnDefinition = "TEXT")
    private String sourceNote;

    @Column(name = "published_by")
    private Long publishedBy;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

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
