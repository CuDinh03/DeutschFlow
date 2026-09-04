package com.deutschflow.common.audit;

import com.deutschflow.user.entity.User;
import org.springframework.security.core.Authentication;

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

    /**
     * Dựng từ {@link Authentication} — dành cho controller đang nhận {@code Authentication} thay vì
     * {@code @AuthenticationPrincipal User}.
     *
     * <p>Audit F-M4 (03/09/2026): 32 call site của console admin trước đây truyền thẳng {@code null}
     * làm {@code actor_user_id}, nên vết chỉ có email — không nối được sang bảng {@code users}, và
     * một tài khoản đổi email là mọi vết cũ mồ côi. {@code JwtAuthFilter} đặt principal chính là
     * entity {@link User}, nên id vẫn luôn có sẵn ngay tại chỗ; chỉ là chưa ai lấy.
     *
     * <p>Vai trò lấy từ {@code users.role} khi principal là entity của mình. Đường dự phòng dùng
     * authority ĐẦU TIÊN — cách cũ, giữ lại cho principal không phải entity (test
     * {@code @WithMockUser}, phiên guest); đúng chừng nào mỗi phiên chỉ mang một vai trò, mà hiện
     * tại đúng như vậy.
     */
    public static AuditActor ofAuthentication(Authentication authentication) {
        if (authentication == null) {
            return new AuditActor(null, null, null);
        }
        if (authentication.getPrincipal() instanceof User user) {
            return of(user);
        }
        String role = authentication.getAuthorities() == null || authentication.getAuthorities().isEmpty()
                ? null
                : authentication.getAuthorities().iterator().next().getAuthority();
        return new AuditActor(null, authentication.getName(), role);
    }

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
