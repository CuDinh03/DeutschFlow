package com.deutschflow.common.resilience;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.stereotype.Component;

import java.util.concurrent.Callable;
import java.util.function.Predicate;
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
        return call(name, action, whenOpen, t -> false);
    }

    /**
     * Như {@link #call(String, Callable, Supplier)} nhưng lỗi khớp {@code notAnUpstreamFailure}
     * KHÔNG bị đếm vào tỉ lệ failure của breaker (vẫn ném ra cho caller xử lý).
     *
     * <p>Dùng cho lỗi kiểu HẠN MỨC (429): upstream vẫn sống — nó từ chối vì bucket token cạn và sẽ
     * tự nhận lại sau vài giây refill. Nếu đếm 429 là failure thì 2 user chạm trần là breaker mở,
     * biến "một số request phải chờ" thành "MỌI user 503 trong 30s, kể cả greeting phiên mới" —
     * đúng chuỗi sập đo được trên prod 04/08 khi tài khoản Groq còn free tier 8000 TPM.
     */
    public <T> T call(String name, Callable<T> action, Supplier<? extends RuntimeException> whenOpen,
                      Predicate<Throwable> notAnUpstreamFailure) {
        CircuitBreaker breaker = registry.circuitBreaker(name);
        try {
            breaker.acquirePermission();
        } catch (CallNotPermittedException open) {
            throw whenOpen.get();
        }
        long start = breaker.getCurrentTimestamp();
        try {
            T result = action.call();
            breaker.onSuccess(breaker.getCurrentTimestamp() - start, breaker.getTimestampUnit());
            return result;
        } catch (Exception e) {
            if (notAnUpstreamFailure.test(e)) {
                // Trả permit mà không ghi nhận gì — giống hệt đường ignoreException của
                // resilience4j (CircuitBreakerImpl), chỉ khác là quyết định theo predicate tại chỗ.
                breaker.releasePermission();
            } else {
                breaker.onError(breaker.getCurrentTimestamp() - start, breaker.getTimestampUnit(), e);
            }
            if (e instanceof RuntimeException re) {
                throw re;
            }
            // Actions are expected to surface failures as RuntimeExceptions; wrap any stray checked one.
            throw new IllegalStateException("Guarded call '" + name + "' failed", e);
        }
    }
}
