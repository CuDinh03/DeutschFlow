package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Mở khóa sửa hồi tố 24h (V296, P07): người duyệt học vụ cấp cho một giáo viên trên một lớp
 * (session_id null = mọi buổi của lớp). Chính bảng này là audit — ai cấp, lý do, hết hạn.
 */
@Entity
@Table(name = "class_record_unlocks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassRecordUnlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "granted_to", nullable = false)
    private Long grantedTo;

    @Column(name = "granted_by", nullable = false)
    private Long grantedBy;

    @Column(nullable = false, columnDefinition = "text")
    private String reason;

    @Column(name = "granted_at", nullable = false, updatable = false)
    private LocalDateTime grantedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        grantedAt = LocalDateTime.now();
        if (expiresAt == null) expiresAt = grantedAt.plusHours(24);
    }
}
