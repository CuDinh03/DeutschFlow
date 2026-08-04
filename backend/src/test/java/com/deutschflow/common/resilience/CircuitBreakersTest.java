package com.deutschflow.common.resilience;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CircuitBreakersTest {

    @Test
    void returnsResult_whenBreakerClosed() {
        var circuitBreakers = new CircuitBreakers(CircuitBreakerRegistry.ofDefaults());

        String result = circuitBreakers.call("svc", () -> "ok", () -> new RuntimeException("open"));

        assertThat(result).isEqualTo("ok");
    }

    @Test
    void throwsWhenOpenException_whenBreakerOpen() {
        var registry = CircuitBreakerRegistry.ofDefaults();
        registry.circuitBreaker("svc").transitionToOpenState(); // force OPEN → short-circuit
        var circuitBreakers = new CircuitBreakers(registry);

        assertThatThrownBy(() ->
                circuitBreakers.call("svc", () -> "ok", () -> new IllegalStateException("UPSTREAM_DOWN")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("UPSTREAM_DOWN");
    }

    @Test
    void propagatesActionRuntimeException_whenBreakerClosed() {
        var circuitBreakers = new CircuitBreakers(CircuitBreakerRegistry.ofDefaults());

        assertThatThrownBy(() ->
                circuitBreakers.call("svc", () -> { throw new IllegalArgumentException("boom"); },
                        () -> new RuntimeException("open")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("boom");
    }

    // ── Overload 4 tham số: lỗi "không phải upstream chết" (429) không được đếm ──

    @Test
    void ignoredFailures_areRethrownButNeverOpenTheBreaker() {
        var registry = smallWindowRegistry();
        var circuitBreakers = new CircuitBreakers(registry);

        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() ->
                    circuitBreakers.call("svc",
                            () -> { throw new IllegalStateException("quota"); },
                            () -> new RuntimeException("open"),
                            t -> t instanceof IllegalStateException))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("quota");
        }

        // 10 lỗi bị bỏ qua liên tiếp: breaker vẫn CLOSED và call sau chạy bình thường.
        assertThat(registry.circuitBreaker("svc").getState())
                .isEqualTo(io.github.resilience4j.circuitbreaker.CircuitBreaker.State.CLOSED);
        assertThat(circuitBreakers.call("svc", () -> "ok", () -> new RuntimeException("open"),
                t -> t instanceof IllegalStateException)).isEqualTo("ok");
    }

    @Test
    void nonMatchingFailures_stillOpenTheBreaker() {
        var circuitBreakers = new CircuitBreakers(smallWindowRegistry());

        for (int i = 0; i < 2; i++) {
            assertThatThrownBy(() ->
                    circuitBreakers.call("svc",
                            () -> { throw new IllegalArgumentException("down"); },
                            () -> new IllegalStateException("OPEN"),
                            t -> false))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        // 2 lỗi thật trong cửa sổ 2 mẫu ⇒ OPEN ⇒ lượt sau nhận whenOpen, action không chạy.
        assertThatThrownBy(() ->
                circuitBreakers.call("svc", () -> "ok", () -> new IllegalStateException("OPEN"), t -> false))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("OPEN");
    }

    @Test
    void checkedExceptionFromAction_isWrappedDefensively() {
        var circuitBreakers = new CircuitBreakers(CircuitBreakerRegistry.ofDefaults());

        assertThatThrownBy(() ->
                circuitBreakers.call("svc", () -> { throw new Exception("checked"); },
                        () -> new RuntimeException("open"), t -> false))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("svc");
    }

    /** Ngưỡng nhỏ nhất resilience4j cho phép — mở mạch sau đúng 2 lỗi được ĐẾM. */
    private static CircuitBreakerRegistry smallWindowRegistry() {
        return CircuitBreakerRegistry.of(
                io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.custom()
                        .slidingWindowSize(2)
                        .minimumNumberOfCalls(2)
                        .failureRateThreshold(50f)
                        .build());
    }
}
