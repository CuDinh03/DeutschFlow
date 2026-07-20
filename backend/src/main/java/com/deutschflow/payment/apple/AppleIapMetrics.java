package com.deutschflow.payment.apple;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * Micrometer counters for Apple StoreKit IAP activations, exposed on {@code /actuator/prometheus}.
 *
 * <p>The verifier deliberately accepts BOTH Apple environments (Production for real buyers, Sandbox
 * for TestFlight/review testers — see {@link AppleJwsVerifier}). That is intended, but it means a
 * TestFlight enrollee can mint a Sandbox transaction that grants the same real PRO entitlement as a
 * paid purchase. Tagging every activation by {@code environment} makes that observable instead of
 * silently absorbed by the ledger:
 *
 * <pre>{@code
 * # Sandbox activations should be ~0 on the production server. Alert if the rate is non-trivial —
 * # it means TestFlight/sandbox access is granting real PRO more than expected.
 * sum(rate(apple_iap_activations_total{environment="Sandbox"}[1h]))
 * }</pre>
 */
@Component
public class AppleIapMetrics {

    private final MeterRegistry registry;

    public AppleIapMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    /**
     * One increment per verified Apple activation.
     *
     * @param environment StoreKit environment from the signed transaction ({@code Production}/{@code Sandbox})
     * @param planCode    entitlement granted (e.g. {@code PRO})
     * @param isNew       {@code true} on the first time this transaction id is seen, {@code false} on an
     *                    idempotent replay — lets a dashboard separate genuine new grants from re-submits
     */
    public void recordActivation(String environment, String planCode, boolean isNew) {
        String env = (environment == null || environment.isBlank()) ? "unknown" : environment;
        String plan = (planCode == null || planCode.isBlank()) ? "unknown" : planCode;
        registry.counter("apple.iap.activations",
                "environment", env,
                "plan", plan,
                "new", String.valueOf(isNew)).increment();
    }
}
