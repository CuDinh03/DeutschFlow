package com.deutschflow.teacher.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.service.TimesheetPeriodService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit R-M8 (03/09/2026): xuất CSV chấm công toàn bộ giáo viên (payroll-adjacent) trước đây không
 * để lại vết nào, khác hai export PII nền tảng đã ghi vết ở B4b. Vết ghi ở controller vì
 * exportOrgCsv là read-only transaction (audit INSERT trong đó sẽ nổ).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OrgTimesheetController — vết audit export (R-M8)")
class OrgTimesheetControllerAuditTest {

    @Mock private TimesheetPeriodService periodService;
    @Mock private AuditLogService auditLogService;

    private OrgTimesheetController controller() {
        return new OrgTimesheetController(periodService, auditLogService);
    }

    private static User orgAdmin() {
        User u = User.builder().id(5L).email("owner@tt.vn").displayName("Owner")
                .role(User.Role.OWNER).build();
        u.setOrgId(88L);
        return u;
    }

    @Test
    @DisplayName("exportCsv ghi admin.org.timesheet.exported kèm actor thật, orgId, khoảng ngày")
    @SuppressWarnings("unchecked")
    void exportCsv_writesAudit() {
        LocalDate from = LocalDate.of(2026, 9, 1);
        LocalDate to = LocalDate.of(2026, 9, 30);
        when(periodService.exportOrgCsv(5L, 88L, from, to)).thenReturn("name,hours\nA,10\n");

        var response = controller().exportCsv(orgAdmin(), from, to);

        assertThat(response.getBody()).contains("name,hours");
        var actor = ArgumentCaptor.forClass(AuditActor.class);
        var meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.org.timesheet.exported"), actor.capture(),
                eq("ORG_TIMESHEET"), eq("88"), meta.capture());
        assertThat(actor.getValue().id()).isEqualTo(5L);
        assertThat(meta.getValue()).containsEntry("from", "2026-09-01").containsEntry("to", "2026-09-30");
    }

    @Test
    @DisplayName("user không thuộc org → 403 trước khi export/ghi vết")
    void exportCsv_noOrg_forbiddenBeforeAudit() {
        User noOrg = User.builder().id(6L).email("x@y.z").displayName("X").role(User.Role.TEACHER).build();

        assertThatThrownBy(() -> controller().exportCsv(noOrg, LocalDate.now(), LocalDate.now()))
                .isInstanceOf(ForbiddenException.class);

        verify(periodService, never()).exportOrgCsv(anyLong(), any(), any(), any());
        verify(auditLogService, never()).log(any(), any(AuditActor.class), any(), any(), any());
    }
}
