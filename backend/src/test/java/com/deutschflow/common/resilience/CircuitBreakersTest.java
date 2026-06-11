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
}
