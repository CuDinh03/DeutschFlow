package com.deutschflow.user.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory brute-force guard for auth endpoints.
 * Limits attempts per (ip, email) within a short window.
 */
@Service
public class AuthRateLimiterService {

    private static final int MAX_ATTEMPTS = 10;
    private static final long WINDOW_SECONDS = 300L; // 5 minutes

    private final ConcurrentHashMap<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    public boolean allow(String ip, String email) {
        String key = (safe(ip) + "|" + safe(email)).toLowerCase(Locale.ROOT);
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(WINDOW_SECONDS);

        Deque<Instant> deque = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }
            if (deque.size() >= MAX_ATTEMPTS) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }

    public int retryAfterSeconds() {
        return (int) WINDOW_SECONDS;
    }

    private static String safe(String s) {
        return s == null ? "" : s.trim();
    }
}

