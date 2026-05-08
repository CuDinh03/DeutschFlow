package com.deutschflow.notification.sse;

import com.deutschflow.notification.repository.UserNotificationRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-process SSE subscribers per user. Pushes unread counts after DB commit; safe for single-node / local dev.
 *
 * FIX (connection leak): JPA query chạy trong @Transactional riêng biệt (self-proxy)
 * để đảm bảo connection được trả về HikariCP ngay sau khi query xong,
 * TRƯỚC KHI SSE stream giữ thread — tránh "Apparent connection leak detected".
 */
@Component
@Slf4j
public class NotificationSseBroadcaster {

    private final UserNotificationRepository notificationRepository;
    private final NotificationSseBroadcaster self; // Self-inject để @Transactional proxy hoạt động

    @Value("${app.notifications.sse.ping-interval-seconds:20}")
    private int pingIntervalSeconds;

    /** Emitters keyed by authenticated user id. */
    private final Map<Long, Set<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    private ScheduledExecutorService pingScheduler;

    public NotificationSseBroadcaster(
            UserNotificationRepository notificationRepository,
            @Lazy NotificationSseBroadcaster self) {
        this.notificationRepository = notificationRepository;
        this.self = self;
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
                // emitter may already be complete
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
     * Broadcast latest unread count to all connections for {@code userId} (queries DB — call after commit).
     */
    public void broadcastUnreadCount(long userId) {
        Set<SseEmitter> set = subscribers.get(userId);
        if (set == null || set.isEmpty()) {
            return;
        }
        // FIX: gọi qua self-proxy để @Transactional hoạt động → connection trả về pool trước khi write SSE
        long count = self.fetchUnreadCount(userId);
        for (SseEmitter emitter : Set.copyOf(set)) {
            try {
                emitter.send(SseEmitter.event().name("unread").data(Map.of("unreadCount", count)));
            } catch (IOException | IllegalStateException e) {
                log.debug("[SSE] broadcastUnreadCount drop userId={} {}", userId, e.toString());
                remove(userId, emitter);
            }
        }
    }

    private void sendUnreadSnapshot(long userId, SseEmitter emitter) throws IOException {
        // FIX: gọi qua self-proxy để @Transactional hoạt động → connection trả về pool trước khi write SSE
        long count = self.fetchUnreadCount(userId);
        emitter.send(SseEmitter.event().name("unread").data(Map.of("unreadCount", count)));
    }

    /**
     * Chạy trong transaction riêng biệt → connection được trả về HikariCP ngay sau COUNT(*),
     * tránh giữ connection trong suốt thời gian SSE stream mở.
     */
    @Transactional(readOnly = true)
    public long fetchUnreadCount(long userId) {
        return notificationRepository.countByRecipient_IdAndReadAtIsNull(userId);
    }

    private void heartbeatAllSafe() {
        try {
            for (Long userId : Set.copyOf(subscribers.keySet())) {
                Set<SseEmitter> set = subscribers.get(userId);
                if (set == null) {
                    continue;
                }
                for (SseEmitter emitter : Set.copyOf(set)) {
                    try {
                        emitter.send(SseEmitter.event().comment("hb"));
                    } catch (IOException | IllegalStateException e) {
                        remove(userId, emitter);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[SSE] heartbeatAllSafe failed {}", e.toString());
        }
    }

    private void remove(long userId, SseEmitter emitter) {
        subscribers.computeIfPresent(userId, (k, v) -> {
            v.remove(emitter);
            return v.isEmpty() ? null : v;
        });
    }
}
