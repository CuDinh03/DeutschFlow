package com.deutschflow.notification.sse;

import com.deutschflow.notification.repository.UserNotificationRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * SSE subscribers per user. Pushes the unread count after a notification's DB
 * commit so clients keep a realtime badge.
 *
 * <p><b>Multi-node:</b> emitters are held in-process per JVM, so a write on node
 * A would never reach a client whose stream is pinned to node B. To make this
 * correct behind a load balancer, count-change events are fanned out via Redis
 * pub/sub (when {@code app.notifications.sse.redis-pubsub-enabled=true}): every
 * node — including the originating one — receives the published userId on the
 * shared channel and pushes to ITS local emitters. When pub/sub is disabled or
 * Redis is unreachable, it degrades to a direct single-node local fan-out, which
 * is correct for single-node / local dev.
 */
@Component
@Slf4j
public class NotificationSseBroadcaster implements MessageListener {

    /** Shared Redis channel carrying the recipient userId whose unread count changed. */
    public static final String UNREAD_CHANNEL = "deutschflow:notif:unread";

    private final UserNotificationRepository notificationRepository;
    /** Null when no Redis is configured (e.g. local dev / CI). */
    @Nullable
    private final StringRedisTemplate redis;
    private final boolean redisPubSubEnabled;

    @Value("${app.notifications.sse.ping-interval-seconds:20}")
    private int pingIntervalSeconds;

    /** Emitters keyed by authenticated user id. */
    private final Map<Long, Set<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    private ScheduledExecutorService pingScheduler;
    private volatile boolean redisPublishWarned = false;

    public NotificationSseBroadcaster(
            UserNotificationRepository notificationRepository,
            @Nullable StringRedisTemplate redis,
            @Value("${app.notifications.sse.redis-pubsub-enabled:false}") boolean redisPubSubEnabled) {
        this.notificationRepository = notificationRepository;
        this.redis = redis;
        this.redisPubSubEnabled = redisPubSubEnabled && redis != null;
        log.info("[SSE] notification fan-out = {}",
                this.redisPubSubEnabled ? "Redis pub/sub (multi-node) + local fallback" : "local single-node");
    }

    @PostConstruct
    void startPingScheduler() {
        pingScheduler = Executors.newSingleThreadScheduledExecutor(
                new CustomizableThreadFactory("notification-sse-ping-"));
        long interval = Math.max(10, pingIntervalSeconds);
        pingScheduler.scheduleAtFixedRate(this::heartbeatAllSafe, interval, interval, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stopPingScheduler() {
        if (pingScheduler != null) {
            pingScheduler.shutdownNow();
        }
    }

    public SseEmitter register(long userId, long timeoutMs) {
        SseEmitter emitter = new SseEmitter(timeoutMs);
        subscribers.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(emitter);
        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> {
            remove(userId, emitter);
            emitter.complete();
        });
        emitter.onError(e -> {
            remove(userId, emitter);
            try {
                emitter.complete();
            } catch (Exception ignored) {
            }
        });
        try {
            sendUnreadSnapshot(userId, emitter);
        } catch (IOException e) {
            log.debug("[SSE] register initial send failed userId={} {}", userId, e.toString());
            remove(userId, emitter);
        }
        return emitter;
    }

    /**
     * Signals that the recipient's unread count changed. Publishes to Redis so
     * every node fans out to its own emitters; falls back to a local-only fan-out
     * when pub/sub is disabled or the publish fails.
     */
    public void notifyUnreadChanged(long userId) {
        if (redisPubSubEnabled && redis != null) {
            try {
                redis.convertAndSend(UNREAD_CHANNEL, Long.toString(userId));
                return; // onMessage on each node (incl. this one) performs the fan-out
            } catch (Exception e) {
                if (!redisPublishWarned) {
                    redisPublishWarned = true;
                    log.warn("[SSE] Redis publish failed — falling back to local fan-out: {}", e.getMessage());
                }
                // fall through to local fan-out so at least this node's clients update
            }
        }
        fanOutLocal(userId);
    }

    /** Redis pub/sub callback — a count change for {@code userId} was published. */
    @Override
    public void onMessage(Message message, @Nullable byte[] pattern) {
        try {
            long userId = Long.parseLong(new String(message.getBody(), StandardCharsets.UTF_8).trim());
            fanOutLocal(userId);
        } catch (NumberFormatException e) {
            log.debug("[SSE] ignoring malformed pub/sub message: {}", e.getMessage());
        }
    }

    /** Pushes the current unread count to this node's emitters for the user. */
    private void fanOutLocal(long userId) {
        Set<SseEmitter> emitters = subscribers.get(userId);
        if (emitters == null || emitters.isEmpty()) return;
        long unread = notificationRepository.countByRecipient_IdAndReadAtIsNull(userId);
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("unreadCount").data(unread));
            } catch (Exception e) {
                remove(userId, emitter);
            }
        }
    }

    private void heartbeatAllSafe() {
        for (Map.Entry<Long, Set<SseEmitter>> entry : subscribers.entrySet()) {
            Long userId = entry.getKey();
            for (SseEmitter emitter : Set.copyOf(entry.getValue())) {
                try {
                    emitter.send(SseEmitter.event().name("ping").data("ok"));
                } catch (Exception e) {
                    remove(userId, emitter);
                }
            }
        }
    }

    private void sendUnreadSnapshot(long userId, SseEmitter emitter) throws IOException {
        long unread = notificationRepository.countByRecipient_IdAndReadAtIsNull(userId);
        emitter.send(SseEmitter.event().name("unreadCount").data(unread));
    }

    private void remove(long userId, SseEmitter emitter) {
        Set<SseEmitter> set = subscribers.get(userId);
        if (set != null) {
            set.remove(emitter);
            if (set.isEmpty()) {
                subscribers.remove(userId);
            }
        }
    }
}
