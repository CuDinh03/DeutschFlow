package com.deutschflow.notification.sse;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-process SSE subscribers per user. Pushes unread counts after DB commit.
 *
 * FIX (connection leak): Sử dụng JdbcTemplate thay vì JPA Repository.
 * JdbcTemplate tự động trả connection về HikariCP ngay sau khi execute query,
 * không cần @Transactional và không bị giữ bởi SSE stream thread.
 */
@Component
@Slf4j
public class NotificationSseBroadcaster {

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.notifications.sse.ping-interval-seconds:20}")
    private int pingIntervalSeconds;

    /** Emitters keyed by authenticated user id. */
    private final Map<Long, Set<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    private ScheduledExecutorService pingScheduler;

    public NotificationSseBroadcaster(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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
     * Broadcast latest unread count to all connections for {@code userId} (call after DB commit).
     */
    public void broadcastUnreadCount(long userId) {
        Set<SseEmitter> set = subscribers.get(userId);
        if (set == null || set.isEmpty()) {
            return;
        }
        // JdbcTemplate trả connection về pool ngay sau queryForObject → không leak
        long count = fetchUnreadCountJdbc(userId);
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
        // JdbcTemplate trả connection về pool ngay sau queryForObject → không leak
        long count = fetchUnreadCountJdbc(userId);
        emitter.send(SseEmitter.event().name("unread").data(Map.of("unreadCount", count)));
    }

    /**
     * Dùng JdbcTemplate để đếm notification chưa đọc.
     * JdbcTemplate tự động acquire + release connection trong cùng 1 method call
     * → không giữ connection khi SSE stream đang mở.
     */
    private long fetchUnreadCountJdbc(long userId) {
        try {
            Long count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ? AND read_at IS NULL",
                    Long.class, userId);
            return count != null ? count : 0L;
        } catch (Exception e) {
            log.warn("[SSE] fetchUnreadCount failed for userId={}: {}", userId, e.getMessage());
            return 0L;
        }
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
