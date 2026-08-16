package com.deutschflow.admin.controller;

import com.deutschflow.admin.service.AdminManagementService;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Guards A-4: {@code PATCH /api/admin/users/{id}/role} had no self-demotion guard (unlike
 * {@code setUserActive}), so an admin could strip their own ADMIN role. On prod there is sometimes
 * exactly one ADMIN — self-demotion then hard-locks the whole platform out of admin.
 *
 * <p>Only the two dependencies this endpoint touches are mocked; {@code @InjectMocks} passes null
 * for the controller's other collaborators (unused here).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("admin users · self role-change guard")
class AdminManagementControllerRoleGuardTest {

    @Mock
    private AdminManagementService adminManagementService;
    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private AdminManagementController controller;

    private User actorWithId(long id) {
        User actor = mock(User.class);
        when(actor.getId()).thenReturn(id);
        return actor;
    }

    @Test
    @DisplayName("rejects an admin demoting their own account and never touches the service (A-4)")
    void rejectsSelfDemotion() {
        User actor = actorWithId(5L);
        AdminManagementController.UpdateRoleRequest req =
                new AdminManagementController.UpdateRoleRequest("STUDENT");

        assertThatThrownBy(() -> controller.updateRole(5L, req, actor, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(adminManagementService);
    }

    @Test
    @DisplayName("allows an admin to change SOMEONE ELSE's role (A-4)")
    void allowsChangingOthers() {
        User actor = actorWithId(5L);
        when(adminManagementService.updateUserRole(9L, "STUDENT")).thenReturn(Map.of("role", "STUDENT"));
        AdminManagementController.UpdateRoleRequest req =
                new AdminManagementController.UpdateRoleRequest("STUDENT");

        assertThatCode(() -> controller.updateRole(9L, req, actor, null)).doesNotThrowAnyException();
        verify(adminManagementService).updateUserRole(9L, "STUDENT");
    }
}
