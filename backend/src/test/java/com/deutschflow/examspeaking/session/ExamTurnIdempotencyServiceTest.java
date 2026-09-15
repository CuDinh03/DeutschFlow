package com.deutschflow.examspeaking.session;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.examspeaking.dto.ExamSessionView;
import com.deutschflow.examspeaking.dto.TurnResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** F-06: retry cùng clientTurnId → replay, không xử lý lại; khoá "đang xử lý" chặn request song song; Redis vắng → no-op. */
class ExamTurnIdempotencyServiceTest {

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private static ExamSessionView view(int step) {
        return new ExamSessionView(5L, "GOETHE", "A1", "DRILL", "IN_PART", 2, step, 3, Instant.parse("2026-09-05T10:00:00Z"),
                null, null, null, null, null, null, null, null, false, false, null);
    }

    private static TurnResponse response(int step) {
        return new TurnResponse("Ich heiße Minh.", "PARTNER", "Hallo Minh!", "THOMAS",
                List.of(new TurnResponse.AiTurn("PARTNER", "Hallo Minh!")), Map.of("score", 8), view(step));
    }

    @Test
    @DisplayName("không có Redis hoặc không có khoá → chạy thẳng, mỗi lần một lần xử lý")
    void noRedisOrNoKeyRunsWork() {
        ExamTurnIdempotencyService noRedis = new ExamTurnIdempotencyService(null, mapper);
        AtomicInteger calls = new AtomicInteger();
        noRedis.execute(1L, 5L, "abc", () -> { calls.incrementAndGet(); return response(1); }, r -> r);
        noRedis.execute(1L, 5L, "abc", () -> { calls.incrementAndGet(); return response(2); }, r -> r);
        assertThat(calls.get()).isEqualTo(2);

        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ExamTurnIdempotencyService withRedis = new ExamTurnIdempotencyService(redis, mapper);
        withRedis.execute(1L, 5L, null, () -> { calls.incrementAndGet(); return response(3); }, r -> r);
        withRedis.execute(1L, 5L, "   ", () -> { calls.incrementAndGet(); return response(3); }, r -> r);
        assertThat(calls.get()).isEqualTo(4);
    }

    @Test
    @DisplayName("lần đầu: khoá → xử lý → nhớ → mở khoá; lần hai cùng khoá: replay + session làm tươi, KHÔNG xử lý lại")
    @SuppressWarnings("unchecked")
    void replaysWithinTtl() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.setIfAbsent(anyString(), anyString(), any())).thenReturn(true);
        String dataKey = ExamTurnIdempotencyService.KEY_PREFIX + "1:5:t-1";
        when(ops.get(dataKey)).thenReturn(null);
        ExamTurnIdempotencyService svc = new ExamTurnIdempotencyService(redis, mapper);
        AtomicInteger calls = new AtomicInteger();

        TurnResponse first = svc.execute(1L, 5L, "t-1", () -> { calls.incrementAndGet(); return response(1); }, r -> r);
        assertThat(first.session().currentStep()).isEqualTo(1);
        verify(ops).set(eq(dataKey), anyString(), eq(ExamTurnIdempotencyService.TTL));
        verify(redis).delete(ExamTurnIdempotencyService.LOCK_PREFIX + "1:5:t-1");

        when(ops.get(dataKey)).thenReturn(mapper.writeValueAsString(first));
        TurnResponse replay = svc.execute(1L, 5L, "t-1",
                () -> { calls.incrementAndGet(); return response(9); },
                cached -> new TurnResponse(cached.transcript(), cached.aiRole(), cached.aiText(), cached.aiVoice(),
                        cached.aiTurns(), cached.turnEval(), view(2)));
        assertThat(calls.get()).isEqualTo(1);
        assertThat(replay.transcript()).isEqualTo("Ich heiße Minh.");
        assertThat(replay.aiTurns()).hasSize(1);
        assertThat(replay.session().currentStep()).as("snapshot phiên phải là bản MỚI").isEqualTo(2);
    }

    @Test
    @DisplayName("cùng khoá đang xử lý (SETNX thất bại) → 409, không chạy work; khoá lạ/quá dài bị bỏ qua như không có khoá")
    @SuppressWarnings("unchecked")
    void inProgressConflictAndKeyNormalization() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get(anyString())).thenReturn(null);
        when(ops.setIfAbsent(anyString(), anyString(), any())).thenReturn(false);
        ExamTurnIdempotencyService svc = new ExamTurnIdempotencyService(redis, mapper);
        AtomicInteger calls = new AtomicInteger();

        assertThatThrownBy(() -> svc.execute(1L, 5L, "busy-1", () -> { calls.incrementAndGet(); return response(1); }, r -> r))
                .isInstanceOf(ConflictException.class);
        assertThat(calls.get()).isZero();

        assertThat(ExamTurnIdempotencyService.normalize("ok_1.2:3-x")).isEqualTo("ok_1.2:3-x");
        assertThat(ExamTurnIdempotencyService.normalize("bad key with spaces")).isNull();
        assertThat(ExamTurnIdempotencyService.normalize("x".repeat(81))).isNull();
        // khoá không hợp lệ → chạy thẳng, không đụng Redis lock
        svc.execute(1L, 5L, "bad key", () -> { calls.incrementAndGet(); return response(1); }, r -> r);
        assertThat(calls.get()).isEqualTo(1);
    }
}
