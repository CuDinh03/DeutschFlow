package com.deutschflow.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * SỔ VÀO/RA TRUNG TÂM (G-05) — append-only, mỗi dòng là MỘT lần một người vào, ra, hoặc đổi vai.
 *
 * <p><b>Vì sao tồn tại:</b> {@code org_members} có khoá chính {@code (org_id, user_id)} nên mỗi cặp
 * chỉ có ĐÚNG MỘT dòng. Vào — ra — vào lại đè lên nhau: {@code joined_at} bị ghi lại thành ngày
 * quay lại, {@code left_at} bị xoá, và toàn bộ chuỗi sự kiện biến mất. Trung tâm không trả lời nổi
 * "người này làm ở đây từ bao giờ đến bao giờ", vốn là câu hỏi của mọi lần đối soát lương, tranh
 * chấp học phí, hay rà soát ai đã đụng vào lớp nào.
 *
 * <p>Bảng {@code org_member_history} được tạo sẵn ở V316 nhưng tới đợt này mới có mã ghi — trước
 * đó nó đúng nghĩa là mã chết.
 *
 * <p><b>Append-only:</b> không có đường sửa/xoá. Đây là sổ, không phải trạng thái;
 * {@code org_members} mới là trạng thái hiện tại.
 */
@Entity
@Table(name = "org_member_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrgMemberHistory {

    /** Vào trung tâm (lần đầu hoặc quay lại). */
    public static final String ACTION_JOINED = "JOINED";
    /** Tự rời trung tâm. */
    public static final String ACTION_LEFT = "LEFT";
    /** Bị org-admin gỡ khỏi trung tâm. */
    public static final String ACTION_REVOKED = "REVOKED";
    /** Đổi chức danh trong trung tâm (kể cả chuyển quyền giám đốc). */
    public static final String ACTION_ROLE_CHANGED = "ROLE_CHANGED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false)
    private Long orgId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** JOINED | LEFT | REVOKED | ROLE_CHANGED — CHECK constraint ở V316 chặn giá trị lạ. */
    @Column(nullable = false, length = 24)
    private String action;

    /** Vai TRƯỚC sự kiện; null khi vào lần đầu. */
    @Column(name = "from_role", length = 20)
    private String fromRole;

    /** Vai SAU sự kiện; null khi rời hẳn. */
    @Column(name = "to_role", length = 20)
    private String toRole;

    /** Ai gây ra sự kiện; null khi không có principal (ví dụ đường nhận lời mời qua liên kết). */
    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(length = 255)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
