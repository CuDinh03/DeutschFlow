package com.deutschflow.system.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

/**
 * Một cửa sổ bảo trì hệ thống — NGUỒN SỰ THẬT DUY NHẤT cho trạng thái bảo trì
 * (thiết kế plans/2026-09-03: không có cờ thứ hai trong system_config).
 *
 * <p>Vòng đời: {@code SCHEDULED → ACTIVE → COMPLETED | CANCELLED}. Partial unique
 * index {@code uq_maintenance_windows_active} đảm bảo tối đa MỘT window ACTIVE.
 *
 * <p>Mọi thời điểm là UTC (LocalDateTime, cùng quy ước với phần còn lại của hệ);
 * API trả {@link java.time.Instant} qua {@code toInstant(ZoneOffset.UTC)}.
 */
@Entity
@Table(name = "maintenance_windows")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaintenanceWindow {

    /** FULL chặn API (trừ whitelist + admin); ANNOUNCE_ONLY chỉ hiện banner phía client. */
    public enum Mode { FULL, ANNOUNCE_ONLY }

    public enum Status { SCHEDULED, ACTIVE, COMPLETED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    /** Ghi chú tự do của admin — hiện nguyên văn ở mọi client, mọi ngôn ngữ. */
    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    /** NULL = chưa rõ giờ xong (khẩn cấp). {@code autoComplete} đòi ends_at NOT NULL (service enforce). */
    @Column(name = "ends_at")
    private LocalDateTime endsAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Mode mode = Mode.FULL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.SCHEDULED;

    @Column(name = "auto_activate", nullable = false)
    @Builder.Default
    private boolean autoActivate = true;

    @Column(name = "auto_complete", nullable = false)
    @Builder.Default
    private boolean autoComplete = false;

    // Các mốc "đã gửi" — chống thông báo lặp khi job quét mỗi phút (pattern #437).
    @Column(name = "notified_schedule_at")
    private LocalDateTime notifiedScheduleAt;

    @Column(name = "notified_before_at")
    private LocalDateTime notifiedBeforeAt;

    @Column(name = "notified_complete_at")
    private LocalDateTime notifiedCompleteAt;

    @Column(name = "overdue_alerted_at")
    private LocalDateTime overdueAlertedAt;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
