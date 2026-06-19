package com.deutschflow.common.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One-time, short-lived tickets for authenticating SSE / EventSource connections WITHOUT putting the
 * access token in the URL (S15).
 *
 * <p>The browser {@code EventSource} API cannot set an {@code Authorization} header, so SSE auth
 * previously rode on a {@code ?access_token=<JWT>} query param — which leaks the bearer token into
 * access logs, proxy/CDN logs, browser history, and the {@code Referer} header.
 *
 * <p>Flow: a Bearer-authenticated client {@code POST}s {@code /api/sse/ticket} → receives an opaque
 * ticket → opens {@code EventSource(...?ticket=...)}. {@link JwtAuthFilter} consumes the ticket
 * (single-use, ~60s TTL) and resolves the user. Even if the URL is logged, the ticket is already
 * consumed / expired, so it grants nothing.
 *
 * <p><b>Storage (S-1):</b> when Redis is available, tickets are stored as Redis keys with 60s TTL —
 * safe across multiple nodes. Falls back to the in-memory {@link ConcurrentHashMap} (single-node
 * only) when Redis is unavailable, so speaking still works on a single instance.
 */
@Slf4j
@Service
public class SseTicketService {

    private static final long TTL_MS = 60_000L;
    private static final int PURGE_THRESHOLD = 512;
    private static final SecureRandom RNG = new SecureRandom();
    private static final String KEY_PREFIX = "sse-ticket:";

    // In-memory fallback (single-node) when Redis is unavailable.
    private final ConcurrentHashMap<String, Entry> tickets = new ConcurrentHashMap<>();
    private record Entry(String subject, long expiresAt) {}

    @Nullable
    private final StringRedisTemplate redis;
    private final DefaultRedisScript<String> getDelScript;
    private volatile boolean redisDownWarned = false;

    // Atomic GET + DEL so a ticket can only be consumed once even under concurrent requests.
    private static final String GET_DEL_LUA = """
            local v = redis.call('GET', KEYS[1])
            if v then
              redis.call('DEL', KEYS[1])
              return v
            end
            return nil
            """;

    public SseTicketService(@Nullable StringRedisTemplate redis) {
        this.redis = redis;
        this.getDelScript = new DefaultRedisScript<>(GET_DEL_LUA, String.class);
        log.info("[SseTicketService] storage = {}",
                redis != null ? "Redis (shared, multi-node safe)" : "in-memory (single-node only)");
    }

    /** Issue a one-time ticket bound to {@code subject} (the user's email/JWT subject). */
    public String issue(String subject) {
        byte[] buf = new byte[32];
        RNG.nextBytes(buf);
        String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);

        if (redis != null) {
            try {
                redis.opsForValue().set(KEY_PREFIX + ticket, subject, Duration.ofMillis(TTL_MS));
                redisDownWarned = false;
                return ticket;
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[SseTicketService] Redis unavailable — falling back to in-memory (single-node): {}",
                            e.getMessage());
                }
            }
        }

        // In-memory fallback
        if (tickets.size() > PURGE_THRESHOLD) {
            purgeExpired();
        }
        tickets.put(ticket, new Entry(subject, System.currentTimeMillis() + TTL_MS));
        return ticket;
    }

    /**
     * Validate + CONSUME a ticket (single-use). Returns the bound subject when the ticket exists and
     * has not expired; empty otherwise. The ticket is removed on first read regardless of expiry.
     */
    public Optional<String> consume(String ticket) {
        if (ticket == null || ticket.isBlank()) {
            return Optional.empty();
        }

        if (redis != null) {
            try {
                String subject = redis.execute(getDelScript, List.of(KEY_PREFIX + ticket));
                redisDownWarned = false;
                return Optional.ofNullable(subject);
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[SseTicketService] Redis unavailable — falling back to in-memory (single-node): {}",
                            e.getMessage());
                }
            }
        }

        // In-memory fallback
        Entry entry = tickets.remove(ticket);
        if (entry == null || entry.expiresAt() < System.currentTimeMillis()) {
            return Optional.empty();
        }
        return Optional.of(entry.subject());
    }

    /** TTL in seconds — surfaced to clients so they connect promptly. */
    public long ttlSeconds() {
        return TTL_MS / 1000L;
    }

    private void purgeExpired() {
        long now = System.currentTimeMillis();
        tickets.values().removeIf(e -> e.expiresAt() < now);
    }
}
