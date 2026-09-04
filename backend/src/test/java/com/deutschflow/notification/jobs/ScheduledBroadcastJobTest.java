package com.deutschflow.notification.jobs;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.ScheduledBroadcast;
import com.deutschflow.notification.repository.ScheduledBroadcastRepository;
import com.deutschflow.notification.service.UserNotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduledBroadcastJobTest {

    @Mock ScheduledBroadcastRepository scheduledBroadcastRepository;
    @Mock UserNotificationService userNotificationService;
    @Mock com.deutschflow.common.audit.AuditLogService auditLogService;

    @InjectMocks
    ScheduledBroadcastJob job;

    private static ScheduledBroadcast pending() {
        return ScheduledBroadcast.builder()
                .id(1L)
                .notificationType(NotificationType.ADMIN_BROADCAST)
                .audienceType("ALL")
                .title("T")
                .body("B")
                .scheduledAt(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(1))
                .status(ScheduledBroadcast.Status.PENDING)
                .build();
    }

    @Test
    @DisplayName("due broadcast is dispatched and marked SENT with recipient count")
    void dispatch_dueBroadcast_marksSent() {
        ScheduledBroadcast broadcast = pending();
        when(scheduledBroadcastRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(eq(ScheduledBroadcast.Status.PENDING), any()))
                .thenReturn(List.of(broadcast));
        when(userNotificationService.dispatchScheduledBroadcast(broadcast)).thenReturn(12);

        job.dispatchDueBroadcasts();

        ArgumentCaptor<ScheduledBroadcast> saved = ArgumentCaptor.forClass(ScheduledBroadcast.class);
        verify(scheduledBroadcastRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ScheduledBroadcast.Status.SENT);
        assertThat(saved.getValue().getRecipientCount()).isEqualTo(12);
        assertThat(saved.getValue().getSentAt()).isNotNull();
    }

    @Test
    @DisplayName("failure during dispatch marks the broadcast FAILED and records the error")
    void dispatch_failure_marksFailed() {
        ScheduledBroadcast broadcast = pending();
        when(scheduledBroadcastRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(eq(ScheduledBroadcast.Status.PENDING), any()))
                .thenReturn(List.of(broadcast));
        when(userNotificationService.dispatchScheduledBroadcast(broadcast))
                .thenThrow(new IllegalStateException("boom"));

        job.dispatchDueBroadcasts();

        ArgumentCaptor<ScheduledBroadcast> saved = ArgumentCaptor.forClass(ScheduledBroadcast.class);
        verify(scheduledBroadcastRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ScheduledBroadcast.Status.FAILED);
        assertThat(saved.getValue().getError()).contains("boom");
    }

    @Test
    @DisplayName("no due broadcasts performs no work")
    void dispatch_noneDue_noop() {
        when(scheduledBroadcastRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(eq(ScheduledBroadcast.Status.PENDING), any()))
                .thenReturn(List.of());

        job.dispatchDueBroadcasts();

        verify(scheduledBroadcastRepository, never()).save(any());
        verify(userNotificationService, never()).dispatchScheduledBroadcast(any());
    }

    // ── R-M7: dispatch thật (thành công/thất bại) phải để lại vết trong audit_logs ──────

    @Test
    @DisplayName("R-M7: gửi thành công ghi admin.notification.broadcast.dispatched status=sent")
    @SuppressWarnings("unchecked")
    void dispatch_success_writesAudit() {
        ScheduledBroadcast broadcast = pending();
        when(scheduledBroadcastRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(eq(ScheduledBroadcast.Status.PENDING), any()))
                .thenReturn(List.of(broadcast));
        when(userNotificationService.dispatchScheduledBroadcast(broadcast)).thenReturn(12);

        job.dispatchDueBroadcasts();

        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.notification.broadcast.dispatched"),
                any(com.deutschflow.common.audit.AuditActor.class), eq("NOTIFICATION"), eq("1"), meta.capture());
        assertThat(meta.getValue()).containsEntry("status", "sent")
                .containsEntry("recipientCount", 12).containsEntry("scheduledId", 1L);
    }

    @Test
    @DisplayName("R-M7: gửi thất bại vẫn ghi vết status=failed kèm lỗi (không mất vết vì tx rollback)")
    @SuppressWarnings("unchecked")
    void dispatch_failure_writesFailedAudit() {
        ScheduledBroadcast broadcast = pending();
        when(scheduledBroadcastRepository
                .findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(eq(ScheduledBroadcast.Status.PENDING), any()))
                .thenReturn(List.of(broadcast));
        when(userNotificationService.dispatchScheduledBroadcast(broadcast))
                .thenThrow(new IllegalStateException("boom"));

        job.dispatchDueBroadcasts();

        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.notification.broadcast.dispatched"),
                any(com.deutschflow.common.audit.AuditActor.class), eq("NOTIFICATION"), eq("1"), meta.capture());
        assertThat(meta.getValue()).containsEntry("status", "failed");
        assertThat(String.valueOf(meta.getValue().get("error"))).contains("boom");
    }
}
