package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "class_lessons")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassLesson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    /** Optional curriculum module this lesson belongs to; null = ungrouped. FK SET NULL (V251). */
    @Column(name = "module_id")
    private Long moduleId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Cấp CEFR của bài (A1..C2); null = chưa gán. DB CHECK ràng buộc domain (V249). */
    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    /** Ngày dự kiến dạy bài — đối chiếu completed/completedAt để tính nhịp độ. */
    @Column(name = "planned_date")
    private LocalDate plannedDate;

    /** Số tiết 45' dự kiến cho bài; null = chưa ước lượng. DB CHECK > 0 (V249). */
    @Column(name = "estimated_units")
    private Integer estimatedUnits;

    @Column(name = "is_completed", nullable = false)
    @Builder.Default
    private boolean completed = false;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "completed_by_teacher_id")
    private Long completedByTeacherId;

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
