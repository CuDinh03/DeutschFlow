package com.deutschflow.ai.tier;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ModelFailover — thứ tự thử và thời gian nghỉ của model lỗi")
class ModelFailoverTest {

    private final AtomicLong now = new AtomicLong(1_000_000_000L);
    private final ModelFailover failover = new ModelFailover(List.of("b", "c"), 120, now::get);

    @Test
    @DisplayName("chưa model nào lỗi ⇒ đúng thứ tự ưu tiên")
    void priorityOrder() {
        assertThat(failover.order(List.of("a", "b", "c"))).containsExactly("a", "b", "c");
    }

    @Test
    @DisplayName("model lỗi xuống cuối hàng; hết 120 giây thì về chỗ cũ")
    void cooldownAndRecovery() {
        failover.markUnavailable("a", "HTTP 503", null);
        assertThat(failover.order(List.of("a", "b", "c"))).containsExactly("b", "c", "a");
        now.addAndGet(119_000_000_000L);
        assertThat(failover.isCooling("a")).isTrue();
        now.addAndGet(2_000_000_000L);
        assertThat(failover.order(List.of("a", "b", "c"))).containsExactly("a", "b", "c");
    }

    @Test
    @DisplayName("mọi model đều nghỉ ⇒ vẫn thử hết, model hết nghỉ sớm nhất trước")
    void allCooling() {
        failover.markUnavailable("a", "x", null);
        now.addAndGet(10_000_000_000L);
        failover.markUnavailable("b", "x", null);
        assertThat(failover.order(List.of("a", "b"))).containsExactly("a", "b");
    }

    @Test
    @DisplayName("429 có Retry-After dài hơn thời gian nghỉ ⇒ nghỉ theo Retry-After")
    void retryAfterExtendsCooldown() {
        failover.markUnavailable("a", "429", 300);
        now.addAndGet(200_000_000_000L);
        assertThat(failover.isCooling("a")).isTrue();
    }

    @Test
    @DisplayName("trả lời được ⇒ hết nghỉ ngay")
    void healthyClearsCooldown() {
        failover.markUnavailable("a", "x", null);
        failover.markHealthy("a");
        assertThat(failover.order(List.of("a", "b"))).containsExactly("a", "b");
    }

    @Test
    @DisplayName("danh sách dự phòng: tách dấu phẩy, bỏ trống, bỏ trùng, bỏ chính model chính")
    void cleanFallbacks() {
        assertThat(ModelFailover.cleanFallbacks("a", List.of(" b , a,", "c", "b", ""))).containsExactly("b", "c");
        assertThat(ModelFailover.cleanFallbacks("a", null)).isEmpty();
        assertThat(failover.candidatesFor("b")).containsExactly("b", "c");
    }

    @Test
    @DisplayName("TierSpec: candidateModels = chính + dự phòng; withModel bỏ dự phòng")
    void tierSpecCandidates() {
        TierSpec spec = new TierSpec(LlmTier.EXPLAIN, "a", null, null, null, null, null, null, "low", false, false,
                List.of("b", "a", "c"));
        assertThat(spec.candidateModels()).containsExactly("a", "b", "c");
        assertThat(spec.withModel("x").candidateModels()).containsExactly("x");
        assertThat(new TierSpec(LlmTier.EXPLAIN, "a", null, null, null, null, null, null, null, false, false)
                .candidateModels()).containsExactly("a");
    }
}
