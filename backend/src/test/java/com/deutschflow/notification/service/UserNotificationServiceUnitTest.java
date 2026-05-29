package com.deutschflow.notification.service;

import com.deutschflow.notification.dto.BroadcastNotificationRequest;
import com.deutschflow.notification.dto.BroadcastNotificationResponse;
import com.deutschflow.notification.entity.ScheduledBroadcast;
import com.deutschflow.notification.repository.ScheduledBroadcastRepository;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.notification.sse.NotificationUnreadPushCoordinator;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserNotificationServiceUnitTest {

    @Mock UserNotificationRepository notificationRepository;
    @Mock UserRepository userRepository;
    @Mock NotificationUnreadPushCoordinator unreadPushCoordinator;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ScheduledBroadcastRepository scheduledBroadcastRepository;

    @InjectMocks
    UserNotificationService service;

    private static BroadcastNotificationRequest allAudience(String scheduledAt) {
        return new BroadcastNotificationRequest(
                null, "ALL", null, null, null,
                new BroadcastNotificationRequest.Payload("Title", "Body"),
                scheduledAt);
    }

    @Test
    @DisplayName("immediate broadcast fans out to active recipients and returns real count")
    void broadcast_immediate_deliversToActiveRecipients() {
        User active = org.mockito.Mockito.mock(User.class);
        when(active.isActive()).thenReturn(true);
        when(active.getId()).thenReturn(42L);
        when(userRepository.findAll()).thenReturn(List.of(active));

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(null));

        assertThat(response.status()).isEqualTo("sent");
        assertThat(response.recipientCount()).isEqualTo(1);
        verify(notificationRepository).saveAll(any());
        verify(unreadPushCoordinator).afterCommit(42L);
        verify(scheduledBroadcastRepository, never()).save(any());
    }

    @Test
    @DisplayName("broadcast with no matching recipients reports no_recipients")
    void broadcast_noRecipients_reportsStatus() {
        when(userRepository.findAll()).thenReturn(List.of());

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(null));

        assertThat(response.status()).isEqualTo("no_recipients");
        assertThat(response.recipientCount()).isZero();
        verify(notificationRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("future scheduledAt persists a PENDING ScheduledBroadcast instead of delivering")
    void broadcast_futureScheduledAt_isQueued() {
        String future = OffsetDateTime.now(ZoneOffset.UTC).plusHours(2).toString();

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(future));

        assertThat(response.status()).isEqualTo("scheduled");
        assertThat(response.recipientCount()).isZero();
        verify(scheduledBroadcastRepository).save(any(ScheduledBroadcast.class));
        verify(notificationRepository, never()).saveAll(any());
        verify(userRepository, never()).findAll();
    }

    @Test
    @DisplayName("past scheduledAt is delivered immediately, not queued")
    void broadcast_pastScheduledAt_deliversImmediately() {
        String past = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5).toString();
        User active = org.mockito.Mockito.mock(User.class);
        when(active.isActive()).thenReturn(true);
        when(active.getId()).thenReturn(7L);
        when(userRepository.findAll()).thenReturn(List.of(active));

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(past));

        assertThat(response.status()).isEqualTo("sent");
        verify(scheduledBroadcastRepository, never()).save(any());
    }

    @Test
    @DisplayName("parseScheduledAt handles offset, offset-less, blank, and malformed input")
    void parseScheduledAt_variants() {
        LocalDateTime fromOffset = UserNotificationService.parseScheduledAt("2030-01-01T10:00:00+02:00");
        assertThat(fromOffset).isEqualTo(LocalDateTime.of(2030, 1, 1, 8, 0)); // normalized to UTC

        LocalDateTime fromLocal = UserNotificationService.parseScheduledAt("2030-01-01T08:00:00");
        assertThat(fromLocal).isEqualTo(LocalDateTime.of(2030, 1, 1, 8, 0));

        assertThat(UserNotificationService.parseScheduledAt(null)).isNull();
        assertThat(UserNotificationService.parseScheduledAt("   ")).isNull();

        assertThatThrownBy(() -> UserNotificationService.parseScheduledAt("not-a-date"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("scheduledAt");
    }
}
