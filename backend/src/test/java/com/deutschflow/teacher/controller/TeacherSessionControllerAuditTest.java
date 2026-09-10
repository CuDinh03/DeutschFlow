package com.deutschflow.teacher.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.teacher.dto.TeacherSessionDto;
import com.deutschflow.teacher.service.TeacherSessionService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * DEC-13 (09/09/2026): {@code TeacherSessionService.assertOwnsProfile} có một dòng
 * {@code if (role == ADMIN) return;} — cổng chống IDOR mở thẳng cho admin nền tảng đọc lịch dạy và
 * doanh thu của MỌI giáo viên. Quyền giữ nguyên, nhưng lần đi qua cửa đó phải để lại vết mà giám
 * đốc trung tâm của giáo viên đọc được, cùng khuôn {@code AdminTeacherService.breakGlassViewTeacher}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("TeacherSessionController — vết break-glass khi admin đọc hồ sơ người khác (DEC-13)")
class TeacherSessionControllerAuditTest {

    @Mock private TeacherSessionService sessionService;
    @Mock private AuditLogService auditLogService;
    @Mock private AuditOrgResolver auditOrgResolver;

    private static final User ADMIN = User.builder().id(3L).email("admin@x.com").role(User.Role.ADMIN).build();
    private static final User TEACHER = User.builder().id(9L).email("gv@x.com").role(User.Role.TEACHER).build();

    private TeacherSessionController controller() {
        return new TeacherSessionController(sessionService, auditLogService, auditOrgResolver);
    }

    private static Page<TeacherSessionDto> onePage() {
        return new PageImpl<>(List.of(TeacherSessionDto.builder().id(1L).build()));
    }

    /** Hồ sơ 55 thuộc giáo viên #9, và giáo viên #9 là người của trung tâm 42. */
    private void profile55OwnedByTeacherOfOrg42() {
        when(sessionService.teacherProfileOwnerUserId(55L)).thenReturn(9L);
        when(auditOrgResolver.forUser(9L)).thenReturn(42L);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> captureMetadata(String eventName, String targetId, Long orgId) {
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq(eventName), any(AuditActor.class), eq("TEACHER_SESSION"),
                eq(targetId), eq(orgId), meta.capture());
        return meta.getValue();
    }

    // ── GET /teacher?profileId= ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("admin đọc lịch dạy của giáo viên khác ⇒ vết vào sổ TRUNG TÂM của giáo viên đó")
    void adminReadingOtherSchedule_isAudited() {
        profile55OwnedByTeacherOfOrg42();
        when(sessionService.getTeacherSessions(ADMIN, 55L, 0)).thenReturn(onePage());

        controller().teacherSessions(ADMIN, 55L, 0);

        assertThat(captureMetadata("admin.teacher_session.schedule.read", "55", 42L))
                .containsEntry("profileId", 55L)
                .containsEntry("page", 0)
                .containsEntry("sessions", 1);
    }

    @Test
    @DisplayName("giáo viên xem lịch của chính mình KHÔNG sinh vết (việc thường ngày, không phải break-glass)")
    void teacherReadingOwnSchedule_isNotAudited() {
        when(sessionService.getTeacherSessions(TEACHER, 55L, 0)).thenReturn(onePage());

        controller().teacherSessions(TEACHER, 55L, 0);

        verifyNoInteractions(auditLogService);
        // Không phải ADMIN thì thậm chí không tốn truy vấn tra chủ hồ sơ.
        verify(sessionService, never()).teacherProfileOwnerUserId(any());
    }

    @Test
    @DisplayName("admin xem chính hồ sơ của mình KHÔNG sinh vết")
    void adminReadingOwnProfile_isNotAudited() {
        when(sessionService.teacherProfileOwnerUserId(55L)).thenReturn(ADMIN.getId());
        when(sessionService.getTeacherSessions(ADMIN, 55L, 0)).thenReturn(onePage());

        controller().teacherSessions(ADMIN, 55L, 0);

        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("giáo viên B2C (không thuộc trung tâm) ⇒ orgId null nhưng vết vẫn ghi")
    void b2cTeacher_stillAudited() {
        when(sessionService.teacherProfileOwnerUserId(55L)).thenReturn(9L);
        when(auditOrgResolver.forUser(9L)).thenReturn(null);
        when(sessionService.getTeacherSessions(ADMIN, 55L, 0)).thenReturn(onePage());

        controller().teacherSessions(ADMIN, 55L, 0);

        assertThat(captureMetadata("admin.teacher_session.schedule.read", "55", null)).isNotNull();
    }

    // ── GET /earnings?profileId= ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("admin đọc doanh thu giáo viên khác ⇒ có vết, nhưng vết KHÔNG chép con số doanh thu")
    void adminReadingEarnings_isAuditedWithoutAmounts() {
        profile55OwnedByTeacherOfOrg42();
        when(sessionService.getEarningsSummary(ADMIN, 55L)).thenReturn(Map.of(
                "totalEarningsVnd", 123_456_789L, "platformFeeVnd", 18_518_518L, "netEarningsVnd", 104_938_271L));

        controller().earnings(ADMIN, 55L);

        Map<String, Object> meta = captureMetadata("admin.teacher_session.earnings.read", "55", 42L);
        assertThat(meta).containsEntry("profileId", 55L);
        assertThat(String.valueOf(meta)).doesNotContain("123456789").doesNotContain("104938271");
    }

    @Test
    @DisplayName("giáo viên xem doanh thu của chính mình KHÔNG sinh vết")
    void teacherReadingOwnEarnings_isNotAudited() {
        when(sessionService.getEarningsSummary(TEACHER, 55L)).thenReturn(Map.of("totalEarningsVnd", 1L));

        controller().earnings(TEACHER, 55L);

        verifyNoInteractions(auditLogService);
    }

    // ── GET /admin/pending-payouts ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("hàng chờ chi trả: ghi vết kèm số phiên; orgId null vì chợ 1:1 là B2C (G-1)")
    void pendingPayouts_isAudited() {
        when(sessionService.getPendingPayouts()).thenReturn(List.of(
                TeacherSessionDto.builder().id(1L).build(), TeacherSessionDto.builder().id(2L).build()));

        controller().pendingPayouts(ADMIN);

        assertThat(captureMetadata("admin.teacher_session.pending_payouts.read", null, null))
                .containsEntry("count", 2);
    }

    // ── Fail-open ──────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("ghi vết hỏng KHÔNG được biến lần đọc đã thành công thành 500 (fail-open)")
    void auditFailure_neverBreaksRead() {
        profile55OwnedByTeacherOfOrg42();
        when(sessionService.getTeacherSessions(ADMIN, 55L, 0)).thenReturn(onePage());
        doThrow(new RuntimeException("audit_logs.org_id vi phạm khoá ngoại"))
                .when(auditLogService).log(anyString(), any(AuditActor.class), any(), any(), any(), any());

        assertThatCode(() -> controller().teacherSessions(ADMIN, 55L, 0)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("tra chủ hồ sơ hỏng cũng không làm hỏng lần đọc")
    void ownerLookupFailure_neverBreaksRead() {
        when(sessionService.teacherProfileOwnerUserId(55L)).thenThrow(new RuntimeException("DB tạm mất kết nối"));
        when(sessionService.getTeacherSessions(ADMIN, 55L, 0)).thenReturn(onePage());

        assertThatCode(() -> controller().teacherSessions(ADMIN, 55L, 0)).doesNotThrowAnyException();
        verifyNoInteractions(auditLogService);
    }
}
