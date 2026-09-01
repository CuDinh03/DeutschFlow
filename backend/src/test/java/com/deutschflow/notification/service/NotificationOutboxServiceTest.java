package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Outbox worker logic (PR-5/G2): SENT bỏ qua (không gửi đôi), lỗi → backoff lũy tiến, chạm trần → FAILED. */
@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationOutboxService")
class NotificationOutboxServiceTest {

    @Mock private NotificationOutboxRepository outboxRepo;
    @Mock private UserNotificationService userNotificationService;

    private NotificationOutboxService service;

    @BeforeEach
    void setUp() {
        service = new NotificationOutboxService(outboxRepo, userNotificationService);
    }

    private NotificationOutbox row(NotificationOutbox.Status status, int attempts) {
        return NotificationOutbox.builder()
                .id(7L).dedupKey("request:1:v1:u9").notificationType(NotificationType.CLASS_SESSION_RESCHEDULED)
                .classId(3L).recipientId(9L).payload(Map.of("message", "x"))
                .status(status).attempts(attempts).nextAttemptAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("deliver: gửi notification + đánh dấu SENT")
    void deliver_sends() {
        NotificationOutbox row = row(NotificationOutbox.Status.PENDING, 0);
        when(outboxRepo.findById(7L)).thenReturn(Optional.of(row));

        service.deliver(7L);

        verify(userNotificationService).deliverToUser(9L, NotificationType.CLASS_SESSION_RESCHEDULED, row.getPayload());
        assertThat(row.getStatus()).isEqualTo(NotificationOutbox.Status.SENT);
        assertThat(row.getSentAt()).isNotNull();
        verify(outboxRepo).save(row);
    }

    @Test
    @DisplayName("deliver: dòng đã SENT bị bỏ qua — worker chạy trùng lượt không gửi đôi")
    void deliver_skipsSent() {
        when(outboxRepo.findById(7L)).thenReturn(Optional.of(row(NotificationOutbox.Status.SENT, 1)));

        service.deliver(7L);

        verify(userNotificationService, never()).deliverToUser(anyLong(), any(), any());
        verify(outboxRepo, never()).save(any());
    }

    @Test
    @DisplayName("markFailure: attempts++ và hẹn retry lũy tiến, chưa chạm trần thì vẫn PENDING")
    void markFailure_backsOff() {
        NotificationOutbox row = row(NotificationOutbox.Status.PENDING, 0);
        when(outboxRepo.findById(7L)).thenReturn(Optional.of(row));

        service.markFailure(7L, "boom");

        assertThat(row.getAttempts()).isEqualTo(1);
        assertThat(row.getStatus()).isEqualTo(NotificationOutbox.Status.PENDING);
        assertThat(row.getLastError()).isEqualTo("boom");
        assertThat(row.getNextAttemptAt()).isAfter(LocalDateTime.now().plusMinutes(3)); // 4^1 = 4′
        verify(outboxRepo).save(row);
    }

    @Test
    @DisplayName("markFailure: chạm trần retry → FAILED, nằm lại chờ xử lý tay (không retry vô hạn)")
    void markFailure_capsAtFailed() {
        NotificationOutbox row = row(NotificationOutbox.Status.PENDING, NotificationOutboxService.MAX_ATTEMPTS - 1);
        when(outboxRepo.findById(7L)).thenReturn(Optional.of(row));

        service.markFailure(7L, "still down");

        assertThat(row.getAttempts()).isEqualTo(NotificationOutboxService.MAX_ATTEMPTS);
        assertThat(row.getStatus()).isEqualTo(NotificationOutbox.Status.FAILED);
    }
}
