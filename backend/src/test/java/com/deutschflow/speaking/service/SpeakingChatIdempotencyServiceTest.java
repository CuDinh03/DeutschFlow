package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit speaking 24/07 — R-M5 backend leg: replay a completed chat turn on retry instead of
 * re-calling the LLM and re-debiting quota. Keyed in Redis and MUST degrade to a clean no-op when
 * Redis (or a blank client id) is absent so the flow falls back to the PR-#259 client reconcile.
 */
class SpeakingChatIdempotencyServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private static AiSpeakingChatResponse response(String speech) {
        return new AiSpeakingChatResponse(
                42L, 7L, speech, null, null, null, null,
                List.of(), null, null, null, null, List.of(),
                "V1", null, false, null, null);
    }

    /** A StringRedisTemplate whose value ops are backed by a real map — exercises real (de)serialization. */
    private static StringRedisTemplate redisBackedBy(Map<String, String> store) {
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(ops.get(anyString())).thenAnswer(inv -> store.get(inv.getArgument(0, String.class)));
        org.mockito.Mockito.doAnswer(inv -> {
            store.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(ops).set(anyString(), anyString(), any(Duration.class));
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenReturn(ops);
        return redis;
    }

    @Test
    @DisplayName("remember → lookup replays the SAME response for the same key")
    void roundTripReplaysResponse() {
        Map<String, String> store = new HashMap<>();
        var svc = new SpeakingChatIdempotencyService(redisBackedBy(store), mapper);

        svc.remember(1L, 7L, "t-abc-1", response("Guten Tag"));
        Optional<AiSpeakingChatResponse> replay = svc.lookup(1L, 7L, "t-abc-1");

        assertThat(replay).isPresent();
        assertThat(replay.get().aiSpeechDe()).isEqualTo("Guten Tag");
        assertThat(replay.get().messageId()).isEqualTo(42L);
    }

    @Test
    @DisplayName("key is scoped by user AND session — same clientTurnId in another session does not collide")
    void keyScopedByUserAndSession() {
        Map<String, String> store = new HashMap<>();
        var svc = new SpeakingChatIdempotencyService(redisBackedBy(store), mapper);

        svc.remember(1L, 7L, "t-1", response("session seven"));

        assertThat(svc.lookup(1L, 8L, "t-1")).isEmpty();   // different session
        assertThat(svc.lookup(2L, 7L, "t-1")).isEmpty();   // different user
        assertThat(svc.lookup(1L, 7L, "t-1")).isPresent(); // exact match
    }

    @Test
    @DisplayName("stored with the 15-minute TTL, not without expiry")
    void storesWithTtl() {
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenReturn(ops);
        var svc = new SpeakingChatIdempotencyService(redis, mapper);

        svc.remember(1L, 7L, "t-1", response("x"));

        ArgumentCaptor<Duration> ttl = ArgumentCaptor.forClass(Duration.class);
        verify(ops).set(anyString(), anyString(), ttl.capture());
        assertThat(ttl.getValue()).isEqualTo(Duration.ofMinutes(15));
    }

    @Test
    @DisplayName("blank / null clientTurnId → lookup empty, remember never touches Redis")
    void blankClientTurnIdIsNoOp() {
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenReturn(ops);
        var svc = new SpeakingChatIdempotencyService(redis, mapper);

        assertThat(svc.lookup(1L, 7L, null)).isEmpty();
        assertThat(svc.lookup(1L, 7L, "   ")).isEmpty();
        svc.remember(1L, 7L, null, response("x"));
        svc.remember(1L, 7L, "", response("x"));

        verify(ops, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("Redis absent (null) → lookup empty, remember no-op, never throws")
    void nullRedisDegradesCleanly() {
        var svc = new SpeakingChatIdempotencyService(null, mapper);

        assertThat(svc.lookup(1L, 7L, "t-1")).isEmpty();
        svc.remember(1L, 7L, "t-1", response("x")); // must not throw
    }

    @Test
    @DisplayName("Redis throwing on read → treated as a miss (turn runs normally), never throws")
    void redisFailureOnLookupIsAMiss() {
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(ops.get(anyString())).thenThrow(new RuntimeException("redis down"));
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenReturn(ops);
        var svc = new SpeakingChatIdempotencyService(redis, mapper);

        assertThat(svc.lookup(1L, 7L, "t-1")).isEmpty();
    }

    @Test
    @DisplayName("a corrupt cached value → miss, not a crash")
    void corruptValueIsAMiss() {
        Map<String, String> store = new HashMap<>();
        var svc = new SpeakingChatIdempotencyService(redisBackedBy(store), mapper);
        // simulate a garbage value under the exact key remember() would use
        svc.remember(1L, 7L, "t-1", response("ok"));
        store.replaceAll((k, v) -> "}{ not json");

        assertThat(svc.lookup(1L, 7L, "t-1")).isEmpty();
    }
}
