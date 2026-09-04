package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Mốc của lớp trung tâm (V295, PR-6): ngày thi chính thức (EXAM) hoặc ngày kết thúc khóa
 * (COURSE_END — mỗi lớp một mốc, partial unique). P05: lớp đã gắn giáo trình DỜI
 * {@code plannedDate} qua luồng đề xuất MOVE_MILESTONE (V294); dự báo AC09 đối chiếu mốc với
 * ngày-hoàn-thành-dự-kiến để cảnh báo rủi ro — hệ thống không tự dời.
 */
@Entity
@Table(name = "class_milestones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassMilestone {

    public enum Kind { EXAM, COURSE_END }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Kind kind;

    @Column(nullable = false)
    private String title;

    @Column(name = "planned_date", nullable = false)
    private LocalDate plannedDate;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
