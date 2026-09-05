package com.deutschflow.examspeaking.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.examspeaking.golden.ExamGoldenService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * R-L7/C2 (03/09/2026): export golden-set CSV (tên người chấm + band điểm) trước đây thiếu cả vết
 * audit lẫn Cache-Control: no-store.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminExamGoldenController — audit + no-store cho export (R-L7/C2)")
class AdminExamGoldenControllerAuditTest {

    @Mock private ExamGoldenService goldenService;
    @Mock private AuditLogService auditLogService;

    private static User admin() {
        return User.builder().id(4L).email("admin@x.com").displayName("Admin")
                .role(User.Role.ADMIN).build();
    }

    @Test
    @DisplayName("exportCsv: ghi vết admin.exam_golden.exported + đặt no-store")
    void exportCsv_auditsAndSetsNoStore() {
        when(goldenService.exportCsv("openai", "B2")).thenReturn("session,rater,band\n");
        var controller = new AdminExamGoldenController(goldenService, auditLogService);

        ResponseEntity<String> response = controller.exportCsv("openai", "B2", admin());

        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getBody()).contains("session,rater,band");
        verify(auditLogService).log(eq("admin.exam_golden.exported"), any(AuditActor.class),
                eq("EXAM_GOLDEN"), eq(null), any());
    }

    @Test
    @DisplayName("exportCsv: body mở đầu bằng BOM UTF-8 + Content-Type charset=utf-8 (Excel Windows đọc đúng tiếng Việt)")
    void exportCsv_prefixesUtf8Bom() {
        when(goldenService.exportCsv("goethe", "A1")).thenReturn("session,rater,band\n1,Prüferin Anna,B1\n");
        var controller = new AdminExamGoldenController(goldenService, auditLogService);

        ResponseEntity<String> response = controller.exportCsv("goethe", "A1", admin());

        assertThat(response.getBody()).startsWith("\uFEFF" + "session,rater,band");
        assertThat(response.getBody()).contains("Prüferin Anna");
        assertThat(String.valueOf(response.getHeaders().getContentType())).contains("charset=utf-8");
    }
}
