package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "class_students")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassStudent {

    public static final String STATUS_ACTIVE = "ACTIVE";
    /** Bảo lưu — D1: VẪN giữ chỗ (tính ghế) và vẫn xem được nội dung lớp ở chế độ chỉ đọc. */
    public static final String STATUS_RESERVED = "RESERVED";
    public static final String STATUS_ENDED = "ENDED";
    public static final String STATUS_TRANSFERRED = "TRANSFERRED";

    /** Lý do rời lớp — phải nằm gọn trong VARCHAR(32) của V316. */
    public static final String END_REASON_BY_TEACHER = "REMOVED_BY_TEACHER";
    public static final String END_REASON_BY_ORG = "REMOVED_BY_ORG";
    public static final String END_REASON_LEFT_ORG = "LEFT_ORG";

    @EmbeddedId
    private ClassStudentId id;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    /**
     * Vòng đời ghi danh (V316): ACTIVE | RESERVED | ENDED | TRANSFERRED.
     *
     * <p>Vì bảo lưu vẫn giữ chỗ (D1), "còn chiếm ghế" là {@code {ACTIVE, RESERVED}} còn "đang học"
     * (điểm danh, nhận bài mới) chỉ là {@code {ACTIVE}}. Hai tập này KHÁC nhau — xem
     * {@link com.deutschflow.teacher.repository.ClassStudentRepository}.
     */
    @Column(nullable = false)
    @Builder.Default
    private String status = STATUS_ACTIVE;

    /** Thời điểm rời lớp; NULL khi còn ghi danh. */
    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    /** REMOVED_BY_TEACHER | REMOVED_BY_ORG | LEFT_ORG | … */
    @Column(name = "end_reason", length = 32)
    private String endReason;

    /** Lớp đích khi status = TRANSFERRED. */
    @Column(name = "transferred_to_class_id")
    private Long transferredToClassId;

    @Column(name = "teacher_comment", columnDefinition = "TEXT")
    private String teacherComment;

    @Column(name = "skill_horen", precision = 4, scale = 1)
    private BigDecimal skillHoren;

    @Column(name = "skill_lesen", precision = 4, scale = 1)
    private BigDecimal skillLesen;

    @Column(name = "skill_schreiben", precision = 4, scale = 1)
    private BigDecimal skillSchreiben;

    @Column(name = "skill_sprechen", precision = 4, scale = 1)
    private BigDecimal skillSprechen;

    @Column(name = "evaluated_at")
    private LocalDateTime evaluatedAt;

    /**
     * Hạn MỀM của {@link #STATUS_RESERVED} (E6, V323): hết hạn chỉ NHẮC trung tâm, không tự đổi trạng thái.
     * NULL = không hạn (hành vi hiện tại). Mới có cột, CHƯA có hành vi — đợt sau.
     */
    @Column(name = "reserved_until")
    private Instant reservedUntil;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
        // Lưới an toàn cho đường `new ClassStudent()` (Lombok @Builder.Default gỡ initializer khỏi
        // constructor rỗng) — cột NOT NULL nên null ở đây là vỡ INSERT chứ không phải mặc định.
        if (status == null) {
            status = STATUS_ACTIVE;
        }
    }
}
