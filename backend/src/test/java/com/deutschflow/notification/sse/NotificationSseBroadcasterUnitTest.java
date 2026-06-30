package com.deutschflow.notification.sse;

import com.deutschflow.notification.repository.UserNotificationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.nio.charset.StandardCharsets;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    @DisplayName("onMessage parses the userId and fans out to local emitters")
    void onMessage_fansOutForPublishedUser() {
        var broadcaster = new NotificationSseBroadcaster(notificationRepository, redis, true);
        broadcaster.register(7L, 60_000L); // registering creates a local emitter for user 7
        Message msg = mock(Message.class);
        when(msg.getBody()).thenReturn("7".getBytes(StandardCharsets.UTF_8));

        broadcaster.onMessage(msg, null);

        // A registered emitter for user 7 means the count is queried to push the update.
        verify(notificationRepository, org.mockito.Mockito.atLeastOnce())
                .countByRecipient_IdAndReadAtIsNull(7L);
    }

    @Test
    @DisplayName("a Redis publish failure falls back to a local fan-out")
    void publishFailure_fallsBackToLocal() {
        var broadcaster = new NotificationSseBroadcaster(notificationRepository, redis, true);
        broadcaster.register(9L, 60_000L);
        when(redis.convertAndSend(any(), any())).thenThrow(new RuntimeException("redis down"));

        broadcaster.notifyUnreadChanged(9L);

        verify(notificationRepository, org.mockito.Mockito.atLeastOnce())
                .countByRecipient_IdAndReadAtIsNull(9L);
    }
}
