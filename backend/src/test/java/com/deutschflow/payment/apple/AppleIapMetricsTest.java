package com.deutschflow.payment.apple;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("AppleIapMetrics — activation counters tagged by StoreKit environment")
class AppleIapMetricsTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final AppleIapMetrics metrics = new AppleIapMetrics(registry);

    @Test
    @DisplayName("records an activation tagged by environment / plan / new")
    void recordsActivationWithTags() {
        metrics.recordActivation("Sandbox", "PRO", true);

        double count = registry.get("apple.iap.activations")
                .tags("environment", "Sandbox", "plan", "PRO", "new", "true")
                .counter().count();
        assertThat(count).isEqualTo(1.0);
    }

    @Test
    @DisplayName("Production and Sandbox activations are separate series (the alert can isolate Sandbox)")
    void separatesEnvironments() {
        metrics.recordActivation("Production", "PRO", true);
        metrics.recordActivation("Production", "PRO", false);
        metrics.recordActivation("Sandbox", "PRO", true);

        double production = registry.get("apple.iap.activations").tag("environment", "Production")
                .counters().stream().mapToDouble(c -> c.count()).sum();
        double sandbox = registry.get("apple.iap.activations").tag("environment", "Sandbox")
                .counter().count();

        assertThat(production).isEqualTo(2.0);
        assertThat(sandbox).isEqualTo(1.0);
    }

    @Test
    @DisplayName("null/blank environment or plan falls back to 'unknown' (never an empty tag value)")
    void nullSafeTags() {
        metrics.recordActivation(null, "  ", true);

        double count = registry.get("apple.iap.activations")
                .tags("environment", "unknown", "plan", "unknown", "new", "true")
                .counter().count();
        assertThat(count).isEqualTo(1.0);
    }
}
