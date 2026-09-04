package com.deutschflow.common.exception;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * Audit R-M9 (03/09/2026): guard bất biến ném trong @Transactional nên vết ghi TRƯỚC khi ném đều
 * rollback theo — GlobalExceptionHandler phải ghi vết lần-thử-bị-chặn SAU rollback, và lỗi ghi vết
 * không được đổi response 400 của client.
 */
@DisplayName("GlobalExceptionHandler — vết cho lần thử bị guard chặn (R-M9)")
class GlobalExceptionHandlerBlockedAuditTest {

    private static final PrivilegedActionBlockedException BLOCKED =
            new PrivilegedActionBlockedException(
                    "Không thể hạ quyền quản trị viên hoạt động cuối cùng.",
                    "admin.user.last_admin.blocked", "USER", "20",
                    Map.of("attemptedAction", "role.update"));

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("ghi vết với actor thật từ SecurityContext + trả đúng 400 như BadRequest thường")
    @SuppressWarnings("unchecked")
    void writesAuditWithRealActor_andReturns400() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        AuditLogService audit = mock(AuditLogService.class);
        ReflectionTestUtils.setField(handler, "auditLogService", audit);
        User admin = User.builder().id(2L).email("admin@x.com").displayName("A")
                .passwordHash("h").role(User.Role.ADMIN).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, List.of()));

        var response = handler.handleBlockedPrivilegedAction(BLOCKED, new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        var actor = ArgumentCaptor.forClass(AuditActor.class);
        var meta = ArgumentCaptor.forClass(Map.class);
        verify(audit).log(eq("admin.user.last_admin.blocked"), actor.capture(),
                eq("USER"), eq("20"), meta.capture());
        assertThat(actor.getValue().id()).isEqualTo(2L); // actor THẬT — không phải null
        assertThat(meta.getValue()).containsEntry("attemptedAction", "role.update");
    }

    @Test
    @DisplayName("standalone test dựng new GlobalExceptionHandler() (audit null) → không NPE, vẫn 400")
    void nullAuditService_stillReturns400() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler(); // như 5 chỗ test hiện có

        var response = handler.handleBlockedPrivilegedAction(BLOCKED, new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("không có Authentication (đường public, vd nhận lời mời) → vẫn ghi vết, actor rỗng")
    void anonymousCaller_stillAudited() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        AuditLogService audit = mock(AuditLogService.class);
        ReflectionTestUtils.setField(handler, "auditLogService", audit);

        handler.handleBlockedPrivilegedAction(BLOCKED, new MockHttpServletRequest());

        var actor = ArgumentCaptor.forClass(AuditActor.class);
        verify(audit).log(eq("admin.user.last_admin.blocked"), actor.capture(),
                eq("USER"), eq("20"), eq(Map.of("attemptedAction", "role.update")));
        assertThat(actor.getValue().id()).isNull(); // meta vẫn mang định danh mục tiêu
    }
}
