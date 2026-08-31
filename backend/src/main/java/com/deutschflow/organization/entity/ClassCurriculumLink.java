package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Lớp ↔ phiên bản giáo trình đang dùng — mỗi lớp đúng MỘT phiên bản (UNIQUE class_id, V289).
 * Chỉ gán được phiên bản PUBLISHED (P03). Đổi/gỡ phiên bản là thao tác org có kiểm tra tác động
 * (chặn khi bài sinh ra đã có dấu vết giảng dạy). {@code previousVersionId} giữ vết lần đổi gần nhất.
 */
@Entity
@Table(name = "class_curriculum_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassCurriculumLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false, unique = true)
    private Long classId;

    @Column(name = "version_id", nullable = false)
    private Long versionId;

    @Column(name = "previous_version_id")
    private Long previousVersionId;

    @Column(name = "assigned_by")
    private Long assignedBy;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private LocalDateTime assignedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (assignedAt == null) assignedAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
