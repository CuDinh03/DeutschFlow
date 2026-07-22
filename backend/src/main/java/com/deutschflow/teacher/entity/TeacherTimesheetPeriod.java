package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Kỳ công của một giáo viên và trạng thái duyệt của kỳ đó (V264).
 *
 * <p>Vòng đời: {@code OPEN → SUBMITTED → APPROVED → LOCKED}, nhánh phụ
 * {@code SUBMITTED → REJECTED → SUBMITTED}. Giáo viên nộp; OWNER/MANAGER của tổ chức duyệt, trả lại
 * hoặc khoá.
 *
 * <p><b>Ý nghĩa của khoá:</b> khi kỳ rời khỏi {@link #isEditable()} (tức đã nộp trở đi), mọi
 * {@link TeacherSessionRecord} có {@code startedAt} nằm trong kỳ bị chặn thêm/sửa/xoá. Không có
 * ràng buộc này thì bước duyệt vô nghĩa — số công vẫn đổi được sau khi đã trả lương.
 *
 * <p>{@code totalSessions}/{@code totalMinutes} là <b>snapshot</b> chốt tại mỗi lần chuyển trạng
 * thái, không tính động khi đọc.
 */
@Entity
@Table(name = "teacher_timesheet_period")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeacherTimesheetPeriod {

    /** Ràng buộc bằng CHECK {@code chk_ttp_status}. Liệt kê đủ ngay từ đầu (bài học V229). */
    public enum Status { OPEN, SUBMITTED, APPROVED, REJECTED, LOCKED }

    /** Đơn vị tính công mặc định của kỳ; {@code teacher_classes.pay_unit} ghi đè ở mức lớp. */
    public enum PayUnit { SESSION, HOUR }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    /** Snapshot org lúc mở kỳ — giáo viên chuyển tổ chức thì kỳ cũ vẫn thuộc tổ chức đã duyệt nó. */
    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Enumerated(EnumType.STRING)
    @Column(name = "pay_unit", nullable = false)
    @Builder.Default
    private PayUnit payUnit = PayUnit.SESSION;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.OPEN;

    @Column(name = "total_sessions", nullable = false)
    @Builder.Default
    private int totalSessions = 0;

    @Column(name = "total_minutes", nullable = false)
    @Builder.Default
    private int totalMinutes = 0;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Kỳ còn cho phép thêm/sửa/xoá dòng công hay không.
     *
     * <p>Chỉ {@code OPEN} và {@code REJECTED} là sửa được. {@code SUBMITTED} cũng khoá: giáo viên
     * không được đổi số trong lúc manager đang xem — nếu không, thứ được duyệt sẽ khác thứ đã nộp.
     */
    public boolean isEditable() {
        return status == Status.OPEN || status == Status.REJECTED;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
