package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Một buổi học lớp cụ thể. Sinh từ {@link ClassSchedulePattern} nhưng sửa từng buổi
 * được; cờ {@code overridden} giữ buổi đã chỉnh tay khỏi bị regenerate ghi đè.
 */
@Entity
@Table(name = "class_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassSession {

    public enum Mode { ONLINE, OFFLINE }

    public enum Status { SCHEDULED, CANCELLED, MOVED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "pattern_id")
    private Long patternId;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Mode mode = Mode.OFFLINE;

    @Column
    private String room;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.SCHEDULED;

    /** true = giáo viên đã chỉnh tay → regenerate từ pattern KHÔNG ghi đè. */
    @Column(name = "is_overridden", nullable = false)
    @Builder.Default
    private boolean overridden = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
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
