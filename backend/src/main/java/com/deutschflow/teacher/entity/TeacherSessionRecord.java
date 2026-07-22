package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Bản ghi công của một giáo viên cho một buổi dạy (V263).
 *
 * <p>Khác hẳn {@link ClassLessonLog}: bảng kia là sổ điểm danh học viên ("học viên Y có mặt"),
 * bảng này là căn cứ tính công ("giáo viên X đã dạy buổi này, bao nhiêu phút"). Không suy được cái
 * này từ cái kia — {@code class_sessions} không có teacher_id, một lớp có nhiều giáo viên, và
 * {@code class_lesson_logs.created_by} chỉ là người nhập liệu.
 *
 * <p><b>Các cột snapshot là nguồn sự thật.</b> {@code classId}/{@code sessionId}/{@code lessonLogId}
 * chỉ là liên kết tham chiếu và đều có thể biến mất: {@code ClassScheduleService.regenerate()} xoá
 * thật các buổi tương lai chưa chỉnh tay, và xoá lớp thì cascade xuống buổi. Vì vậy
 * {@code startedAt}, {@code durationMinutes}, {@code orgId}, {@code classNameSnapshot} được chốt
 * ngay lúc ghi nhận và không bao giờ đọc lại từ nguồn — cùng nguyên tắc với {@code OrgCertificate}.
 */
@Entity
@Table(name = "teacher_session_record")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeacherSessionRecord {

    /** Vai trò của giáo viên trong buổi dạy. Ràng buộc bằng CHECK {@code chk_tsr_role}. */
    public enum TeacherRole { PRIMARY, ASSISTANT, SUBSTITUTE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(name = "class_id")
    private Long classId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "lesson_log_id")
    private Long lessonLogId;

    /** Snapshot org của LỚP tại thời điểm ghi nhận — không phải org hiện tại của giáo viên. */
    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "class_name_snapshot")
    private String classNameSnapshot;

    /**
     * Thời điểm bắt đầu THỰC TẾ. Buổi bị dời được tính vào kỳ theo mốc này (thực dạy), không theo
     * {@code class_sessions.original_date} (ô lịch gốc) — trả công theo việc đã làm.
     */
    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(name = "teacher_role", nullable = false)
    @Builder.Default
    private TeacherRole teacherRole = TeacherRole.PRIMARY;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

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
