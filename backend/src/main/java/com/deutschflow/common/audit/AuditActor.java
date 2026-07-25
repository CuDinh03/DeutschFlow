package com.deutschflow.common.audit;

import com.deutschflow.user.entity.User;

/**
 * Ai đã thực hiện một thao tác — dựng ở controller từ {@code @AuthenticationPrincipal} rồi truyền
 * xuống service.
 *
 * <p><b>Vì sao truyền xuống thay vì để service tự tra:</b> service tầng nghiệp vụ chỉ nhận id người
 * dùng, không có email/vai trò, mà vết audit cần cả ba để đọc được sáu tháng sau ("ai" phải là một
 * cái tên, không phải một con số). Hai lựa chọn còn lại đều tệ hơn: đọc
 * {@code SecurityContextHolder} trong service làm nghiệp vụ phụ thuộc ngầm vào Spring Security và
 * vỡ ở luồng job/webhook không có principal; ghi audit ở controller thì vết nằm NGOÀI transaction
 * nghiệp vụ, tức mutation thành công mà audit lỗi là mất vết vĩnh viễn.
 *
 * <p>{@code role} lấy từ {@code users.role} (vai trò nền tảng). Với thành viên tổ chức nó luôn khớp
 * vai trò org — {@code OrgMembershipService.syncPlatformRole} giữ hai bên đồng bộ ở mọi đường ghi.
 */
public record AuditActor(Long id, String email, String role) {

    /** Dựng từ principal. Chấp nhận {@code null} để controller không phải rào trước mỗi lần gọi. */
    public static AuditActor of(User user) {
        if (user == null) {
            return new AuditActor(null, null, null);
        }
        return new AuditActor(
                user.getId(),
                user.getEmail(),
                user.getRole() == null ? null : user.getRole().name());
    }
}
