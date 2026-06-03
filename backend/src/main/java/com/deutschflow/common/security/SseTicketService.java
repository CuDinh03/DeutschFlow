package com.deutschflow.common.security;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
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
 * <p>In-memory + single-node — matches the current in-process SSE. For multi-node, back this with
 * Redis (see {@code docs/SECURITY_ANALYSIS.md} S16).
 */
@Service
public class SseTicketService {

    private static final long TTL_MS = 60_000L;          // 60s window to open the connection
    private static final int PURGE_THRESHOLD = 512;      // opportunistic cleanup cap
    private static final SecureRandom RNG = new SecureRandom();

    private final ConcurrentHashMap<String, Entry> tickets = new ConcurrentHashMap<>();

    private record Entry(String subject, long expiresAt) {}

    /** Issue a one-time ticket bound to {@code subject} (the user's email/JWT subject). */
    public String issue(String subject) {
        if (tickets.size() > PURGE_THRESHOLD) {
            purgeExpired();
        }
        byte[] buf = new byte[32];
        RNG.nextBytes(buf);
        String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
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
        Entry entry = tickets.remove(ticket); // single-use: remove on read
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
