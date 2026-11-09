package com.deutschflow.admin.controller;

import com.deutschflow.admin.service.AdminManagementService;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Guards A-4: {@code PATCH /api/admin/users/{id}/role} had no self-demotion guard (unlike
 * {@code setUserActive}), so an admin could strip their own ADMIN role. On prod there is sometimes
 * exactly one ADMIN — self-demotion then hard-locks the whole platform out of admin.
 *
 * <p>Đợt 1 admin (09/11/2026, AC-ADMIN-23): bốn thao tác nhạy cảm bắt buộc lý do 10–500 ký tự, kiểm
 * TRƯỚC khi gọi service (thiếu lý do thì không có gì bị ghi), và lý do nằm trong metadata của vết.
 *
 * <p>Only the dependencies these endpoints touch are mocked; {@code @InjectMocks} passes null
 * for the controller's other collaborators (unused here). {@link AuditOrgResolver} joined that list
 * when the audit trail started carrying the org_id of the user being changed (DEC-13), and
 * {@link JdbcTemplate} when the role endpoint started reading the CURRENT role (bỏ quyền ADMIN cũng
 * cần lý do).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("admin users · self role-change guard + lý do bắt buộc")
class AdminManagementControllerRoleGuardTest {

    private static final String REASON = "Chuyển người này sang đội vận hành nội dung";

    @Mock
    private AdminManagementService adminManagementService;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private AuditOrgResolver auditOrgResolver;
    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private AdminManagementController controller;

    private User actorWithId(long id) {
        User actor = mock(User.class);
        when(actor.getId()).thenReturn(id);
        return actor;
    }

    private void currentRoleIs(long userId, String role) {
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(userId))).thenReturn(List.of(role));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> loggedMetadata(String event) {
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq(event), any(AuditActor.class), eq("USER"), anyString(), any(), meta.capture());
        return meta.getValue();
    }

    @Test
    @DisplayName("rejects an admin demoting their own account and never touches the service (A-4)")
    void rejectsSelfDemotion() {
        User actor = actorWithId(5L);
        AdminManagementController.UpdateRoleRequest req =
                new AdminManagementController.UpdateRoleRequest("STUDENT", REASON);

        assertThatThrownBy(() -> controller.updateRole(5L, req, actor, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(adminManagementService);
    }

    @Test
    @DisplayName("allows an admin to change SOMEONE ELSE's role (A-4) — vai thường không cần lý do")
    void allowsChangingOthers() {
        User actor = actorWithId(5L);
        currentRoleIs(9L, "TEACHER");
        when(adminManagementService.updateUserRole(9L, "STUDENT")).thenReturn(Map.of("role", "STUDENT"));
        AdminManagementController.UpdateRoleRequest req =
                new AdminManagementController.UpdateRoleRequest("STUDENT", null);

        assertThatCode(() -> controller.updateRole(9L, req, actor, null)).doesNotThrowAnyException();
        verify(adminManagementService).updateUserRole(9L, "STUDENT");
    }

    @Test
    @DisplayName("cấp quyền ADMIN thiếu lý do → 400, service không bị gọi")
    void grantAdmin_withoutReason_isRejected() {
        User actor = actorWithId(5L);
        currentRoleIs(9L, "TEACHER");
        AdminManagementController.UpdateRoleRequest req =
                new AdminManagementController.UpdateRoleRequest("ADMIN", "  ngắn ");

        assertThatThrownBy(() -> controller.updateRole(9L, req, actor, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(adminManagementService);
    }

    @Test
    @DisplayName("BỎ quyền ADMIN của người khác cũng cần lý do; có lý do thì vết mang lý do")
    void revokeAdmin_requiresReason_andLogsIt() {
        User actor = actorWithId(5L);
        currentRoleIs(9L, "ADMIN");
        AdminManagementController.UpdateRoleRequest noReason =
                new AdminManagementController.UpdateRoleRequest("TEACHER", null);
        assertThatThrownBy(() -> controller.updateRole(9L, noReason, actor, null))
                .isInstanceOf(BadRequestException.class);

        when(adminManagementService.updateUserRole(9L, "TEACHER"))
                .thenReturn(Map.of("role", "TEACHER", "previousRole", "ADMIN"));
        controller.updateRole(9L, new AdminManagementController.UpdateRoleRequest("TEACHER", "  " + REASON + "  "),
                actor, null);
        assertThat(loggedMetadata("admin.user.role.updated")).containsEntry("reason", REASON);
    }

    @Test
    @DisplayName("khoá tài khoản thiếu lý do → 400; mở khoá không cần lý do")
    void lock_requiresReason_unlockDoesNot() {
        User actor = actorWithId(5L);
        assertThatThrownBy(() -> controller.setUserActive(9L,
                new AdminManagementController.SetActiveRequest(false, null), actor, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(adminManagementService);

        when(adminManagementService.setUserActive(9L, true)).thenReturn(Map.of("id", 9L));
        assertThatCode(() -> controller.setUserActive(9L,
                new AdminManagementController.SetActiveRequest(true, null), actor, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("đặt lại mật khẩu thiếu lý do → 400; có lý do thì vết mang lý do, không mang mật khẩu")
    void passwordReset_requiresReason() {
        assertThatThrownBy(() -> controller.setUserPassword(9L,
                new AdminManagementController.SetPasswordRequest("NewPass#2026", ""), null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(adminManagementService);

        when(adminManagementService.setUserPassword(9L, "NewPass#2026")).thenReturn(Map.of("id", 9L));
        controller.setUserPassword(9L, new AdminManagementController.SetPasswordRequest("NewPass#2026", REASON), null);
        Map<String, Object> meta = loggedMetadata("admin.user.password.reset");
        assertThat(meta).containsEntry("reason", REASON);
        assertThat(meta.toString()).doesNotContain("NewPass#2026");
    }

    @Test
    @DisplayName("đặt lại mật khẩu của ADMIN bị service chặn → ném lại 403 và ghi vết admin.user.password.reset.blocked")
    void passwordReset_adminTarget_blockedIsAudited() {
        when(adminManagementService.setUserPassword(4L, "NewPass#2026")).thenThrow(
                new com.deutschflow.common.exception.ForbiddenException("blocked",
                        AdminManagementService.ADMIN_PASSWORD_RESET_FORBIDDEN));

        assertThatThrownBy(() -> controller.setUserPassword(4L,
                new AdminManagementController.SetPasswordRequest("NewPass#2026", REASON), null))
                .isInstanceOf(com.deutschflow.common.exception.ForbiddenException.class);

        Map<String, Object> meta = loggedMetadata("admin.user.password.reset.blocked");
        assertThat(meta).containsEntry("reason", REASON);
        verify(auditLogService, org.mockito.Mockito.never()).log(eq("admin.user.password.reset"),
                any(AuditActor.class), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("đổi gói thiếu lý do → 400; có lý do thì vết mang gói cũ + số dư ví cũ")
    void planChange_requiresReason_andLogsPreviousState() {
        assertThatThrownBy(() -> controller.updatePlan(9L,
                new AdminManagementController.UpdatePlanRequest("PRO", null, null, null, null), null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(adminManagementService);

        java.util.Map<String, Object> updated = new java.util.LinkedHashMap<>();
        updated.put("planCode", "PRO");
        updated.put("previousPlanCode", "ULTRA");
        updated.put("previousWalletBalance", 12_000L);
        when(adminManagementService.updateUserPlan(9L, "PRO", null, null, null)).thenReturn(updated);
        controller.updatePlan(9L, new AdminManagementController.UpdatePlanRequest("PRO", null, null, null, REASON), null);

        Map<String, Object> meta = loggedMetadata("admin.user.plan.updated");
        assertThat(meta)
                .containsEntry("reason", REASON)
                .containsEntry("previousPlanCode", "ULTRA")
                .containsEntry("previousWalletBalance", "12000");
    }

    @Test
    @DisplayName("lý do quá 500 ký tự bị từ chối")
    void reason_tooLong_isRejected() {
        assertThatThrownBy(() -> AdminManagementController.requireReason("x".repeat(501)))
                .isInstanceOf(BadRequestException.class);
        assertThat(AdminManagementController.requireReason("  " + REASON + " ")).isEqualTo(REASON);
    }
}
