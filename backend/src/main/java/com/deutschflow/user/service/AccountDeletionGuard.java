package com.deutschflow.user.service;

import com.deutschflow.common.exception.ConflictException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Chặn "tự xoá tài khoản" khi tài khoản còn dính vào một trung tâm — cửa hậu xoá dữ liệu của
 * trung tâm (G-09).
 *
 * <p><b>Vì sao cần:</b> {@code DELETE /api/profile/me} xoá VĨNH VIỄN dòng {@code users}, và phần
 * lớn bảng con trỏ tới {@code users(id)} bằng {@code ON DELETE CASCADE}. Hai hậu quả:
 * <ul>
 *   <li><b>Học viên:</b> hồ sơ học tập (bài nộp, điểm, điểm danh) mà trung tâm đang cần biến mất,
 *       trong khi D2 nói rõ dữ liệu học tập trong lớp phải GIỮ NGUYÊN khi rời lớp.</li>
 *   <li><b>Giáo viên/nhân sự:</b> {@code teacher_classes.teacher_id → users(id) ON DELETE CASCADE}
 *       (V196), nên xoá một tài khoản giáo viên kéo theo TOÀN BỘ lớp của họ, và từ lớp lại cascade
 *       xuống buổi học, nhật ký, điểm danh, tin nhắn kênh lớp, bài nộp. Đường xoá lớp có
 *       {@code ClassDeletionGuard} chặn 409 đúng những thứ đó — xoá tài khoản đi vòng qua chốt ấy
 *       trong im lặng.</li>
 * </ul>
 *
 * <p><b>Luật (D6 — owner chốt 08/09/2026):</b> người đang là thành viên ACTIVE của một trung tâm
 * KHÔNG được tự xoá tài khoản; phải rời trung tâm (hoặc nhờ giám đốc/quản lý gỡ) trước. Thông điệp
 * lỗi phải NÓI RÕ PHẢI LÀM GÌ, không phải một cái 403 trống.
 *
 * <p>Chốt này chỉ chặn — không tự động rời trung tâm, không xoá lớp hộ. Người dùng vẫn xoá được
 * tài khoản, chỉ là sau khi đã gỡ mình khỏi trung tâm.
 */
@Service
@RequiredArgsConstructor
public class AccountDeletionGuard {

    private static final String ROLE_OWNER = "OWNER";
    private static final String ROLE_MANAGER = "MANAGER";
    private static final String ROLE_STUDENT = "STUDENT";

    /**
     * Membership ACTIVE của user kèm tên trung tâm. Cùng thứ tự ưu tiên với
     * {@code OrgQuotaService.resolveActiveMembership} (staff trước STUDENT, rồi org_id nhỏ nhất)
     * để hai chỗ luôn nói về cùng một membership.
     */
    private static final String MEMBERSHIP_SQL = """
            SELECT m.org_id, m.role, o.name
              FROM org_members m
              JOIN organizations o ON o.id = m.org_id
             WHERE m.user_id = ? AND m.status = 'ACTIVE'
             ORDER BY (m.role = 'STUDENT'), m.org_id
             LIMIT 1
            """;

    /**
     * Số lớp CỦA TRUNG TÂM mà user còn đứng tên — phụ trách chính
     * ({@code teacher_classes.teacher_id}) hoặc trợ giảng ({@code class_teachers}). Lớp không thuộc
     * trung tâm nào ({@code org_id IS NULL}) không tính: đó là lớp riêng của chính người dùng.
     */
    /**
     * Chỉ đếm lớp mà user ĐỨNG TÊN phụ trách ({@code teacher_classes.teacher_id}) — đúng những lớp
     * sẽ bị cuốn theo khi xoá tài khoản.
     *
     * <p>🔑 CỐ Ý không đếm {@code class_teachers} (trợ giảng): khoá ngoại của bảng ghép là
     * {@code ON DELETE CASCADE} trên chính DÒNG GHÉP (V200), nên xoá tài khoản trợ giảng chỉ làm
     * mất vai trợ giảng chứ KHÔNG xoá lớp. Đếm gộp hai thứ vừa nhốt người vô can — một người đã rời
     * sạch trung tâm mà còn sót dòng trợ giảng sẽ không xoá nổi tài khoản, trong khi App Store
     * Guideline 5.1.1(v) đòi phải xoá được trong ứng dụng — vừa nói dối hệ quả ("sẽ xoá luôn N lớp"
     * trong khi không lớp nào mất).
     */
    private static final String ORG_CLASSES_SQL = """
            SELECT COUNT(*) FROM teacher_classes c
             WHERE c.org_id IS NOT NULL
               AND c.teacher_id = ?
            """;

    private final JdbcTemplate jdbc;

    /** Ném 409 kèm hướng dẫn cụ thể nếu tài khoản còn thuộc / còn phụ trách lớp của một trung tâm. */
    public void assertDeletable(long userId) {
        String blocked = blockReason(activeMembership(userId), countOrgClasses(userId));
        if (blocked != null) {
            throw new ConflictException(blocked);
        }
    }

    /**
     * Quyết định thuần (tách khỏi JDBC để test được từng nhánh thông điệp): trả về lý do chặn, hoặc
     * {@code null} khi tài khoản xoá được.
     *
     * @param membership membership ACTIVE của user, {@code null} nếu không thuộc trung tâm nào
     * @param orgClasses số lớp CỦA TRUNG TÂM user còn đứng tên
     */
    static String blockReason(Membership membership, long orgClasses) {
        if (membership == null) {
            // Đã rời trung tâm nhưng lớp chưa bàn giao: xoá tài khoản vẫn cascade mất cả cây lớp.
            if (orgClasses > 0) {
                return "Bạn không còn là thành viên trung tâm nhưng vẫn đang đứng tên " + orgClasses
                        + " lớp của trung tâm. Xoá tài khoản lúc này sẽ xoá luôn " + orgClasses
                        + " lớp đó cùng buổi học, điểm danh và bài học viên đã nộp trong lớp."
                        + " Hãy đề nghị trung tâm chuyển các lớp này cho giáo viên khác trước,"
                        + " rồi xoá tài khoản.";
            }
            return null;
        }

        if (ROLE_STUDENT.equals(membership.role())) {
            return "Bạn đang là học viên của trung tâm \"" + membership.orgName() + "\" nên chưa xoá"
                    + " được tài khoản: hồ sơ học tập của bạn (bài nộp, điểm, điểm danh) là dữ"
                    + " liệu trung tâm đang dùng. Hãy rời trung tâm trong Cài đặt → Trung tâm →"
                    + " Rời trung tâm, hoặc nhờ giám đốc/quản lý trung tâm gỡ bạn khỏi danh"
                    + " sách, rồi quay lại xoá tài khoản.";
        }

        return staffMessage(membership, orgClasses);
    }

    /** Thông điệp riêng cho nhân sự — nói rõ mất gì và ai gỡ được (G-09). */
    private static String staffMessage(Membership membership, long orgClasses) {
        String head = "Bạn đang là " + roleLabel(membership.role()) + " của trung tâm \""
                + membership.orgName() + "\" nên chưa xoá được tài khoản.";
        String classes = orgClasses > 0
                ? " Bạn còn đứng tên " + orgClasses + " lớp của trung tâm; xoá tài khoản lúc này sẽ"
                    + " xoá luôn " + orgClasses + " lớp đó cùng buổi học, nhật ký, điểm danh, tin nhắn"
                    + " kênh lớp và bài học viên đã nộp — không khôi phục được. Hãy bàn giao các lớp"
                    + " này cho giáo viên khác trước."
                : "";
        String exit = ROLE_OWNER.equals(membership.role())
                ? " Là giám đốc, bạn phải chuyển quyền sở hữu trung tâm cho người khác rồi rời trung"
                    + " tâm, sau đó mới xoá tài khoản."
                : " Sau đó hãy rời trung tâm trong Cài đặt → Trung tâm → Rời trung tâm, hoặc nhờ giám"
                    + " đốc trung tâm gỡ bạn, rồi quay lại xoá tài khoản.";
        return head + classes + exit;
    }

    private static String roleLabel(String role) {
        if (ROLE_OWNER.equals(role)) {
            return "giám đốc";
        }
        return ROLE_MANAGER.equals(role) ? "quản lý" : "giáo viên";
    }

    private Membership activeMembership(long userId) {
        return jdbc.query(MEMBERSHIP_SQL,
                rs -> rs.next() ? new Membership(rs.getLong(1), rs.getString(2), rs.getString(3)) : null,
                userId);
    }

    private long countOrgClasses(long userId) {
        Long count = jdbc.queryForObject(ORG_CLASSES_SQL, Long.class, userId);
        return count != null ? count : 0L;
    }

    /** Membership ACTIVE của user kèm tên trung tâm — package-private để test quyết định thuần. */
    record Membership(long orgId, String role, String orgName) {}
}
