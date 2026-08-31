package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
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
    /**
     * Phút HỌC của buổi (D04: buổi lớp trung tâm 180'). NULL = bản ghi cũ chưa tách — đọc ra
     * hiểu là teaching = durationMinutes. durationMinutes GIỮ vai trò phút CHIẾM LỊCH (kiểm
     * trùng giờ), không đổi ngữ nghĩa (V292).
     */
    @Column(name = "teaching_minutes")
    private Integer teachingMinutes;

    /** Phút GIẢI LAO trong buổi (D04: 15'); không tính vào thời gian học. Default 0 (V292). */
    @Column(name = "break_minutes", nullable = false)
    @Builder.Default
    private int breakMinutes = 0;

    /** "Đã ghi nhận kết thúc" (spec §2.3): buổi qua giờ KHÔNG tự thành đã dạy — GV chốt ở PR-7. */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "completed_by")
    private Long completedBy;

    @Column(name = "is_overridden", nullable = false)
    @Builder.Default
    private boolean overridden = false;

    /**
     * Ngày của ô lịch gốc trong pattern (V262). Giữ nguyên khi buổi bị dời sang ngày khác, để
     * regenerate biết ô đó đã có chủ và không sinh ra một buổi "ma" trên ngày cũ.
     * NULL với buổi tạo tay và bản ghi trước V262 — khi đó lấy ngày của {@code startAt}.
     */
    @Column(name = "original_date")
    private LocalDate originalDate;

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
