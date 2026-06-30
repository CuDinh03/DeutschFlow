package com.deutschflow.notification.sse;

import com.deutschflow.notification.repository.UserNotificationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationSseBroadcasterUnitTest {

    @Mock UserNotificationRepository notificationRepository;
    @Mock StringRedisTemplate redis;

    @Test
    @DisplayName("with pub/sub enabled, notifyUnreadChanged publishes to Redis and does not fan out locally")
    void publishesToRedis_whenEnabled() {
        var broadcaster = new NotificationSseBroadcaster(notificationRepository, redis, true);

        broadcaster.notifyUnreadChanged(42L);

        verify(redis).convertAndSend(eq(NotificationSseBroadcaster.UNREAD_CHANNEL), eq("42"));
        // Fan-out happens on the pub/sub callback (every node), not on the publish path.
        verify(notificationRepository, never()).countByRecipient_IdAndReadAtIsNull(anyLong());
    }

    @Test
    @DisplayName("with pub/sub disabled, notifyUnreadChanged fans out locally and never touches Redis")
    void fansOutLocally_whenDisabled() {
        var broadcaster = new NotificationSseBroadcaster(notificationRepository, redis, false);

        // No local emitters registered → still consults the unread count is skipped because
        // there are no subscribers; assert it does NOT publish to Redis.
        broadcaster.notifyUnreadChanged(42L);

        verify(redis, never()).convertAndSend(any(), any());
    }

    @Test
    @DisplayName("onMessage parses the userId and fans out ONLY to that user's local emitters")
    void onMessage_fansOutForPublishedUser() {
        var broadcaster = new NotificationSseBroadcaster(notificationRepository, redis, true);
        broadcaster.register(7L, 60_000L);
        broadcaster.register(8L, 60_000L);
        // register() already sent each user's initial snapshot; reset so we measure ONLY onMessage.
        clearInvocations(notificationRepository);
        Message msg = mock(Message.class);
        when(msg.getBody()).thenReturn("8".getBytes(StandardCharsets.UTF_8));

        broadcaster.onMessage(msg, null);

        // The published body '8' must drive a count for user 8 and NOT user 7 — proving the
        // body is actually parsed and routed, not coincidentally satisfied by setup.
        verify(notificationRepository, times(1)).countByRecipient_IdAndReadAtIsNull(8L);
        verify(notificationRepository, never()).countByRecipient_IdAndReadAtIsNull(7L);
    }

    @Test
    @DisplayName("SSE wire format contract: event name 'unreadCount' carrying a bare integer")
    void sseWireFormat_eventNameAndBareInteger() {
        // Pins the exact frame the web client parses (notificationStream.ts). The
        // original bug was a drift here: backend emitted event 'unreadCount' + a bare
        // int while the client expected event 'unread' + JSON {unreadCount}. If anyone
        // changes the emit name/shape, this and the frontend parser test must both move.
        assertThat(NotificationSseBroadcaster.UNREAD_EVENT_NAME).isEqualTo("unreadCount");

        // Build the frame exactly as the broadcaster does (same public constant) and
        // assert the serialized bytes: `event:unreadCount` + a bare integer `data:3`.
        String frame = SseEmitter.event()
                .name(NotificationSseBroadcaster.UNREAD_EVENT_NAME)
                .data(3L)
                .build().stream()
                .map(part -> String.valueOf(part.getData()))
                .collect(Collectors.joining());

        assertThat(frame).contains("event:unreadCount");
        assertThat(frame).contains("data:3");
    }

    @Test
    @DisplayName("a Redis publish failure falls back to a local fan-out")
    void publishFailure_fallsBackToLocal() {
        var broadcaster = new NotificationSseBroadcaster(notificationRepository, redis, true);
        broadcaster.register(9L, 60_000L);
        clearInvocations(notificationRepository); // ignore register()'s initial snapshot count
        when(redis.convertAndSend(any(), any())).thenThrow(new RuntimeException("redis down"));

        broadcaster.notifyUnreadChanged(9L);

        // Publish threw → must still fan out locally → exactly one count query for user 9.
        verify(notificationRepository, times(1)).countByRecipient_IdAndReadAtIsNull(9L);
    }
}
