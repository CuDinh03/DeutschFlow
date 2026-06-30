package com.deutschflow.notification.sse;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * Wires the {@link NotificationSseBroadcaster} as a Redis pub/sub subscriber on
 * {@link NotificationSseBroadcaster#UNREAD_CHANNEL}, so unread-count changes
 * fan out across every node behind a load balancer.
 *
 * <p>Gated on an explicit flag (default off) so single-node / local-dev / CI —
 * where Redis may not be running — keep the in-process local fan-out and never
 * spin up a failing subscriber connection. Enable in multi-node prod via
 * {@code APP_NOTIFICATION_SSE_REDIS_PUBSUB=true} (Redis must be reachable).
 */
@Configuration
@ConditionalOnProperty(name = "app.notifications.sse.redis-pubsub-enabled", havingValue = "true")
@ConditionalOnClass(name = "org.springframework.data.redis.connection.RedisConnectionFactory")
public class NotificationSseRedisConfig {

    @Bean
    @ConditionalOnBean(RedisConnectionFactory.class)
    RedisMessageListenerContainer notificationSseRedisListenerContainer(
            RedisConnectionFactory connectionFactory,
            NotificationSseBroadcaster broadcaster) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(broadcaster, new ChannelTopic(NotificationSseBroadcaster.UNREAD_CHANNEL));
        return container;
    }
}
