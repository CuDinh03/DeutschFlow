package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Phân công NGƯỜI DUYỆT HỌC VỤ ("giáo viên trưởng") của trung tâm — PR-2, quyết định P01.
 *
 * <p>Phạm vi {@code ORG} = duyệt học vụ mọi lớp của trung tâm; {@code CLASS} = chỉ lớp được giao
 * (spec §6 "quyền phải đúng trung tâm và phạm vi được giao"). Giám đốc (org OWNER) luôn có quyền
 * duyệt — không cần dòng phân công. MANAGER KHÔNG mặc định có quyền này (tách quyền học vụ khỏi
 * quản trị). Ngoại lệ cuối tuần (D14) vẫn là {@code assertOrgOwner} — bảng này không cấp.
 *
 * <p>Thu hồi là soft ({@code revokedAt/revokedBy}) để giữ lịch sử; các partial unique index V291
 * chặn trùng phân công đang hiệu lực.
 */
@Entity
@Table(name = "org_academic_approvers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgAcademicApprover {

    public static final String SCOPE_ORG = "ORG";
    public static final String SCOPE_CLASS = "CLASS";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false)
    private Long orgId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** ORG | CLASS. DB CHECK (V291) kèm ràng buộc class_id đi đôi với scope. */
    @Column(nullable = false, length = 8)
    private String scope;

    @Column(name = "class_id")
    private Long classId;

    @Column(name = "granted_by")
    private Long grantedBy;

    @Column(name = "granted_at", nullable = false, updatable = false)
    private LocalDateTime grantedAt;

    @Column(name = "revoked_by")
    private Long revokedBy;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @PrePersist
    protected void onCreate() {
        if (grantedAt == null) grantedAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return revokedAt == null;
    }
}
