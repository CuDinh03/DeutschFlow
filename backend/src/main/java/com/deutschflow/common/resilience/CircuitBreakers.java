package com.deutschflow.common.resilience;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.stereotype.Component;

import java.util.concurrent.Callable;
import java.util.function.Supplier;

/**
 * Thin wrapper over Resilience4j circuit breakers for outbound calls to flaky 3rd-party services
 * (Groq, the local AI server, …). Used programmatically — not via {@code @CircuitBreaker} AOP — so
 * the guard is explicit at the call site and trivially unit-testable.
 *
 * <p>Why this exists: the Đợt-1 HTTP timeouts stopped requests hanging <em>forever</em>, but a dead
 * upstream still makes every caller wait the full timeout (10–60s) before failing. When an upstream
 * is clearly down, the breaker trips and subsequent calls fail <em>instantly</em> with a friendly
 * error instead of each user (and the thread/connection they hold) eating the timeout.
 *
 * <p>Breaker state + metrics are auto-bound to Micrometer by {@code resilience4j-spring-boot3} →
 * visible on {@code /actuator/prometheus} → can be added to the Grafana dashboard.
 */
@Component
public class CircuitBreakers {

    private final CircuitBreakerRegistry registry;

    public CircuitBreakers(CircuitBreakerRegistry registry) {
        this.registry = registry;
    }

    /**
     * Runs {@code action} guarded by the named breaker. Records success/failure so the breaker can
     * open. When the breaker is OPEN it short-circuits and throws {@code whenOpen.get()} instead of
     * calling the (presumed-dead) upstream.
     *
     * <p>{@code action} must signal upstream failure by throwing a {@link RuntimeException}
     * (callers convert checked exceptions first), so the only checked path here is defensive.
     */
    public <T> T call(String name, Callable<T> action, Supplier<? extends RuntimeException> whenOpen) {
        CircuitBreaker breaker = registry.circuitBreaker(name);
        try {
            return breaker.executeCallable(action);
        } catch (CallNotPermittedException open) {
            throw whenOpen.get();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            // Actions are expected to surface failures as RuntimeExceptions; wrap any stray checked one.
            throw new IllegalStateException("Guarded call '" + name + "' failed", e);
        }
    }
}
