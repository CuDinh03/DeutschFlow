package com.deutschflow.teacher.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Một lần sửa/xoá bản ghi giảng dạy (V296, P07): bản chụp before/after + lý do. Lịch sử là
 * append-only — không sửa, không xoá; cửa sổ 7 ngày và mở khóa nằm ở {@code RecordEditGuard}.
 */
@Entity
@Table(name = "class_record_revisions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassRecordRevision {

    public enum EntityType { LESSON_LOG, SESSION_CONTENT, SESSION_COMPLETION }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 32)
    private EntityType entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "changed_by", nullable = false)
    private Long changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    @Column(columnDefinition = "text")
    private String reason;

    /** null = bản ghi vừa được tạo. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before_state", columnDefinition = "jsonb")
    private Map<String, Object> beforeState;

    /** null = bản ghi bị xoá. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "after_state", columnDefinition = "jsonb")
    private Map<String, Object> afterState;

    @PrePersist
    protected void onCreate() {
        changedAt = LocalDateTime.now();
    }
}
