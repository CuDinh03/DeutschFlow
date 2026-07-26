package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

/**
 * Idempotency replay cache for blocking speaking-chat turns (audit speaking 24/07, R-M5 backend leg).
 *
 * <p><b>Problem.</b> A learner's chat turn can round-trip like this: the client posts, the backend
 * calls the LLM (~seconds) and commits — deducting AI quota and awarding XP — but the HTTP response
 * is lost to a client-side timeout/network flake. The user then retries the SAME turn. Without a
 * server-side dedup the backend runs the LLM again and debits quota a second time (a double-charge),
 * and for org-pooled users it even re-reserves org tokens up front.
 *
 * <p><b>Defense in depth.</b> The mobile app already reconciles before retrying (PR #259: GET
 * messages, fuzzy-match the text, skip re-POST if the server already has it). That is best-effort and
 * fuzzy — it fails when two turns share identical text, when {@code getMessages} itself errors, or
 * across app reinstalls. This service is the exact, attempt-scoped backstop: the client mints one
 * stable {@code clientTurnId} per logical turn and reuses it on every retry, so a duplicate key
 * inside the TTL replays the FIRST response verbatim — no LLM call, no quota debit.
 *
 * <p><b>Why replay a cached response rather than rebuild from the DB.</b> {@link AiSpeakingChatResponse}
 * carries transient fields that are never persisted — adaptive meta, suggestions, similarity score,
 * interview hint. Rebuilding from {@code ai_speaking_messages} would silently return a degraded
 * response. Caching the exact DTO keeps the replay faithful.
 *
 * <p><b>Degradation.</b> Keyed in Redis so a retry that lands on a different node (blue-green /
 * horizontal scale) still dedups. When Redis is absent or down this service is a clean no-op —
 * {@link #lookup} returns empty and {@link #remember} does nothing — and the flow falls back to the
 * client-side reconcile above. It never throws into the request path.
 */
@Service
@Slf4j
public class SpeakingChatIdempotencyService {

    private static final String KEY_PREFIX = "speaking:idem:";

    /**
     * How long a completed turn's response stays replayable. Must comfortably outlive a realistic
     * retry window: client blocking timeout is 45s and a user may tap "Gửi lại" a minute or two
     * later. 15 minutes is generous without letting stale keys linger.
     */
    private static final Duration TTL = Duration.ofMinutes(15);

    @Nullable
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private volatile boolean redisDownWarned = false;

    public SpeakingChatIdempotencyService(@Nullable StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
        log.info("[SpeakingChatIdempotency] {}",
                redis != null ? "Redis-backed replay cache active (multi-node safe)"
                              : "Redis absent — chat idempotency disabled (client reconcile is the only backstop)");
    }

    /**
     * Returns the response cached under {@code (userId, sessionId, clientTurnId)} if this exact turn
     * already completed within the TTL. Empty when there is no key, when {@code clientTurnId} is
     * blank, or when Redis is unavailable — never throws.
     */
    public Optional<AiSpeakingChatResponse> lookup(Long userId, Long sessionId, @Nullable String clientTurnId) {
        if (redis == null || isBlank(clientTurnId)) {
            return Optional.empty();
        }
        try {
            String json = redis.opsForValue().get(key(userId, sessionId, clientTurnId));
            redisDownWarned = false;
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, AiSpeakingChatResponse.class));
        } catch (Exception e) {
            // A corrupt/undeserializable value or a Redis blip must NOT block the turn — treat as a
            // miss and let the request run normally (worst case: the turn is processed once more).
            warnRedisOnce(e);
            return Optional.empty();
        }
    }

    /**
     * Caches {@code response} so a later retry with the same {@code clientTurnId} replays it. No-op
     * when {@code clientTurnId} is blank or Redis is unavailable. Never throws.
     */
    public void remember(Long userId, Long sessionId, @Nullable String clientTurnId, AiSpeakingChatResponse response) {
        if (redis == null || isBlank(clientTurnId) || response == null) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(response);
            redis.opsForValue().set(key(userId, sessionId, clientTurnId), json, TTL);
            redisDownWarned = false;
        } catch (Exception e) {
            // Failing to cache only weakens the backstop for this one turn — the request already
            // succeeded, so swallow and rely on the client reconcile if a retry comes.
            warnRedisOnce(e);
        }
    }

    private String key(Long userId, Long sessionId, String clientTurnId) {
        // Scoped by user AND session: the client turn id is a per-launch counter that resets on
        // app reload, so it is only unique within a session — never key on clientTurnId alone.
        return KEY_PREFIX + userId + ':' + sessionId + ':' + clientTurnId;
    }

    private void warnRedisOnce(Exception e) {
        if (!redisDownWarned) {
            redisDownWarned = true;
            log.warn("[SpeakingChatIdempotency] Redis operation failed — idempotency degraded for now: {}",
                    e.getMessage());
        }
    }

    private static boolean isBlank(@Nullable String s) {
        return s == null || s.isBlank();
    }
}
