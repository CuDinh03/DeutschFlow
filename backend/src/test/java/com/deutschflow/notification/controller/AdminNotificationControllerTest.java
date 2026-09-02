package com.deutschflow.notification.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.notification.dto.BroadcastNotificationRequest;
import com.deutschflow.notification.dto.BroadcastNotificationResponse;
import com.deutschflow.notification.service.UserNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guards the A-1 hardening of the broadcast admin API: a preview endpoint that returns the real
 * recipient headcount (so the UI can confirm before an irreversible mass push) and an audit trail
 * on every send (there was none before — the fan-out left no record of who sent what).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("admin broadcast · preview count + audit")
class AdminNotificationControllerTest {

    @Mock
    private UserNotificationService userNotificationService;
    @Mock
    private AuditLogService auditLogService;

    private AdminNotificationController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminNotificationController(userNotificationService, auditLogService);
    }

    private BroadcastNotificationRequest allUsersRequest() {
        return new BroadcastNotificationRequest(
                "ADMIN_BROADCAST", "ALL", null, null, null,
                new BroadcastNotificationRequest.Payload("Tiêu đề", "Nội dung"), null);
    }

    @Test
    @DisplayName("preview returns the audience headcount and sends nothing (A-1)")
    void previewReturnsCountWithoutSending() {
        when(userNotificationService.countAudience(any())).thenReturn(42L);

        ResponseEntity<Map<String, Object>> res = controller.previewBroadcast(allUsersRequest());

        assertThat(res.getBody()).containsEntry("recipientCount", 42L);
        verify(userNotificationService, never()).broadcastToAudience(any());
    }

    @Test
    @DisplayName("broadcast leaves an audit trail (A-1)")
    void broadcastLeavesAuditTrail() {
        when(userNotificationService.broadcastToAudience(any()))
                .thenReturn(new BroadcastNotificationResponse(42, "sent"));

        controller.broadcast(allUsersRequest(), null);

        // F-M4 (03/09/2026): controller nay truyền AuditActor thay vì (null, email, role) rời rạc.
        verify(auditLogService).log(
                eq("admin.notification.broadcast"), eq(new AuditActor(null, null, null)),
                eq("NOTIFICATION"), eq("ALL"), anyMap());
    }

    // ─── F-M4: vết broadcast phải nói được GỬI CHO AI ────────────────────────────────

    @Test
    @DisplayName("SINGLE_USER: vết ghi kèm targetEmail — không chỉ chữ \"SINGLE_USER\"")
    @SuppressWarnings("unchecked")
    void singleUserBroadcastRecordsTheRecipient() {
        when(userNotificationService.broadcastToAudience(any()))
                .thenReturn(new BroadcastNotificationResponse(1, "sent"));
        BroadcastNotificationRequest req = new BroadcastNotificationRequest(
                "ADMIN_BROADCAST", "SINGLE_USER", null, null, "hocvien@x.com",
                new BroadcastNotificationRequest.Payload("Tiêu đề", "Nội dung"), null);

        controller.broadcast(req, null);

        org.mockito.ArgumentCaptor<Map> meta = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.notification.broadcast"), any(AuditActor.class),
                eq("NOTIFICATION"), eq("SINGLE_USER"), meta.capture());
        assertThat(meta.getValue()).containsEntry("targetEmail", "hocvien@x.com");
    }

    @Test
    @DisplayName("ROLE/TIER: vết ghi kèm tiêu chí chọn đối tượng, hai lần gửi khác nhau không nhìn giống nhau")
    @SuppressWarnings("unchecked")
    void audienceCriteriaAreRecorded() {
        when(userNotificationService.broadcastToAudience(any()))
                .thenReturn(new BroadcastNotificationResponse(10, "sent"));
        BroadcastNotificationRequest req = new BroadcastNotificationRequest(
                "ADMIN_BROADCAST", "ROLE", "PRO", "TEACHER", null,
                new BroadcastNotificationRequest.Payload("Tiêu đề", "Nội dung"), null);

        controller.broadcast(req, null);

        org.mockito.ArgumentCaptor<Map> meta = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.notification.broadcast"), any(AuditActor.class),
                eq("NOTIFICATION"), eq("ROLE"), meta.capture());
        assertThat(meta.getValue()).containsEntry("role", "TEACHER").containsEntry("tier", "PRO");
    }

    @Test
    @DisplayName("ALL: không nhét khoá rỗng vào metadata")
    @SuppressWarnings("unchecked")
    void allAudienceKeepsMetadataClean() {
        when(userNotificationService.broadcastToAudience(any()))
                .thenReturn(new BroadcastNotificationResponse(42, "sent"));

        controller.broadcast(allUsersRequest(), null);

        org.mockito.ArgumentCaptor<Map> meta = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.notification.broadcast"), any(AuditActor.class),
                eq("NOTIFICATION"), eq("ALL"), meta.capture());
        assertThat(meta.getValue()).doesNotContainKeys("targetEmail", "role", "tier");
    }
}
