package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Chương trình luyện của một lớp (V388, đặc tả luyendeu ORG-50): tuần 1 bắt đầu thứ Hai {@link #startDate}
 * (giờ VN), kéo dài {@link #weeks} tuần. Lớp có chương trình chưa kết thúc ⇒ học viên ACTIVE chỉ luyện
 * bằng giọng nói (ORG-65).
 */
@Entity
@Table(name = "class_practice_programs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassPracticeProgram {

    @Id
    @Column(name = "class_id")
    private Long classId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private int weeks;

    @Column(name = "target_per_week", nullable = false)
    private int targetPerWeek;

    @Column(name = "weeks_required", nullable = false)
    private int weeksRequired;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    /** Ngày đầu tiên SAU chương trình (thứ Hai kế tiếp tuần cuối). */
    public LocalDate endExclusive() {
        return startDate.plusWeeks(weeks);
    }
}
