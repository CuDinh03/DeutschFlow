package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Đề xuất thay đổi lịch của lớp trung tâm đã gắn giáo trình (V294, GĐ3 PR-5).
 *
 * <p>Vòng đời: {@code PENDING → APPROVED | REJECTED | CANCELLED} — một chiều, đổi trạng thái bằng
 * UPDATE có điều kiện {@code WHERE status='PENDING'} để hai người duyệt cùng lúc không cùng thắng
 * (AC10). PENDING không đụng lịch chính thức và không sinh thông báo học viên (AC18); thay đổi chỉ
 * được áp trong CÙNG giao dịch với bước duyệt, sau khi so {@link #baseVersion} với
 * {@code teacher_classes.schedule_version}.
 */
@Entity
@Table(name = "class_schedule_change_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassScheduleChangeRequest {

    /** Ràng buộc bằng CHECK {@code chk_cscr_type}; MOVE_MILESTONE dùng từ PR-6 (khai đủ từ đầu). */
    public enum Type { CANCEL_SESSION, ADD_MAKEUP, MOVE_SESSION, UPDATE_PATTERN, MOVE_MILESTONE }

    public enum Status { PENDING, APPROVED, REJECTED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 32)
    private Type requestType;

    /** Nội dung thay đổi theo loại — JSON của request tương ứng đường ghi cũ. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> payload = new HashMap<>();

    /** Bản chụp tác động lúc NỘP — người duyệt thấy đúng cái giáo viên thấy, không tính lại khi đọc. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "impact_snapshot", columnDefinition = "jsonb")
    private Map<String, Object> impactSnapshot;

    @Column(columnDefinition = "text")
    private String reason;

    /** Đề xuất chạm T7/CN → chỉ OWNER duyệt (AC19/AC20/AC23). */
    @Column(name = "has_weekend", nullable = false)
    @Builder.Default
    private boolean hasWeekend = false;

    /** schedule_version của lớp lúc tạo đề xuất (AC10). */
    @Column(name = "base_version", nullable = false)
    private long baseVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "requested_by", nullable = false)
    private Long requestedBy;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private LocalDateTime requestedAt;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reject_reason", columnDefinition = "text")
    private String rejectReason;

    /** Thời điểm thay đổi THẬT SỰ áp vào lịch — cùng giao dịch APPROVED. */
    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        requestedAt = LocalDateTime.now();
        updatedAt = requestedAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
