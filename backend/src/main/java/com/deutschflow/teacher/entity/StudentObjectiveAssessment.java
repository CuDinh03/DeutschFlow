package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Đánh giá một học viên theo MỘT mục tiêu giáo trình (V298, spec §7). Ba trạng thái —
 * NOT_ASSESSED/NEEDS_PRACTICE/ACHIEVED; đánh giá lại supersede bản cũ (lịch sử append-only,
 * partial unique giữ đúng một bản hiệu lực). AC12: "chưa đánh giá" và "bài chờ chấm" là những
 * trạng thái TRUNG TÍNH — không bao giờ đọc thành yếu.
 */
@Entity
@Table(name = "student_objective_assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentObjectiveAssessment {

    public enum Status { NOT_ASSESSED, NEEDS_PRACTICE, ACHIEVED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "objective_id", nullable = false)
    private Long objectiveId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(columnDefinition = "text")
    private String evidence;

    @Column(name = "assessed_by", nullable = false)
    private Long assessedBy;

    @Column(name = "assessed_at", nullable = false, updatable = false)
    private LocalDateTime assessedAt;

    @Column(name = "supersedes_id")
    private Long supersedesId;

    @Column(nullable = false)
    @Builder.Default
    private boolean superseded = false;

    @PrePersist
    protected void onCreate() {
        assessedAt = LocalDateTime.now();
    }
}
