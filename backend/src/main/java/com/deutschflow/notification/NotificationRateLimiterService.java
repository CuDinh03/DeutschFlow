package com.deutschflow.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NotificationRateLimiterService {

    @Value("${app.notifications.rate-limit.read-max-per-window:120}")
    private int readMaxPerWindow;

    @Value("${app.notifications.rate-limit.read-window-seconds:60}")
    private int readWindowSeconds;

    @Value("${app.notifications.rate-limit.mutate-max-per-window:40}")
    private int mutateMaxPerWindow;

    @Value("${app.notifications.rate-limit.mutate-window-seconds:60}")
    private int mutateWindowSeconds;

    @Value("${app.notifications.rate-limit.stream-connect-max-per-window:12}")
    private int streamConnectMaxPerWindow;

    @Value("${app.notifications.rate-limit.stream-connect-window-seconds:60}")
    private int streamConnectWindowSeconds;

    private final ConcurrentHashMap<String, Deque<Instant>> windows = new ConcurrentHashMap<>();

    public boolean allowReadPoll(Long userId) {
        return allow(key(userId, "poll"), readMaxPerWindow, readWindowSeconds);
    }

    public boolean allowMutate(Long userId) {
        return allow(key(userId, "mutate"), mutateMaxPerWindow, mutateWindowSeconds);
    }

    public boolean allowStreamConnect(Long userId) {
        return allow(key(userId, "sse"), streamConnectMaxPerWindow, streamConnectWindowSeconds);
    }

    public int retryAfterSeconds(String category) {
        return switch (category) {
            case "poll" -> readWindowSeconds;
            case "mutate" -> mutateWindowSeconds;
            case "sse" -> streamConnectWindowSeconds;
            default -> 60;
        };
    }

    private static String key(Long userId, String category) {
        return userId + "|" + category.toLowerCase(Locale.ROOT);
    }

    private boolean allow(String key, int max, int windowSeconds) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(Math.max(1, windowSeconds));
        Deque<Instant> deque = windows.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }
            if (deque.size() >= Math.max(1, max)) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }
}
