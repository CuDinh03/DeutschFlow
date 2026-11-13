package com.deutschflow.ai.tier;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Chuyển model khi model đang dùng không trả lời (owner chốt 13/11/2026: ưu tiên + dự phòng).
 *
 * <p>Bối cảnh: cổng AI tự host báo {@code 503 No capacity} cho cả họ Gemini cùng lúc, trong khi các model
 * khác trên cùng cổng vẫn trả lời trong ~3 giây. Trước đây mỗi tầng chỉ có một model, client thử lại đúng
 * model đó rồi báo lỗi ⇒ học viên "khựng".
 *
 * <p>Luật:
 * <ul>
 *   <li>Luôn thử theo thứ tự ưu tiên: model chính rồi tới {@code fallback-models}.</li>
 *   <li>Model vừa lỗi (5xx, 429, quá giờ, model không dùng được) bị <b>nghỉ</b>
 *       {@code failover-cooldown-seconds} giây: các lượt sau đưa nó xuống cuối hàng, khỏi tốn thời gian
 *       chờ nó báo lỗi lần nữa. Hết hạn nghỉ ⇒ tự về đúng chỗ ưu tiên.</li>
 *   <li>Mọi model đều đang nghỉ ⇒ vẫn thử hết, model hết hạn nghỉ sớm nhất trước.</li>
 * </ul>
 * Trạng thái nghỉ nằm trong bộ nhớ một tiến trình — đủ cho một máy chủ; blue-green khởi động màu mới
 * thì bắt đầu lại từ thứ tự ưu tiên.
 */
@Component
@Slf4j
public class ModelFailover {

    private final Map<String, Long> coolingUntilNanos = new ConcurrentHashMap<>();
    private final List<String> globalFallbacks;
    private final long cooldownNanos;
    private final LongSupplier nanoClock;

    @org.springframework.beans.factory.annotation.Autowired
    public ModelFailover(LlmProperties properties) {
        this(properties.getFallbackModels(), properties.getFailoverCooldownSeconds(), System::nanoTime);
    }

    ModelFailover(List<String> globalFallbacks, int cooldownSeconds, LongSupplier nanoClock) {
        this.globalFallbacks = cleanFallbacks(null, globalFallbacks);
        this.cooldownNanos = Math.max(0, cooldownSeconds) * 1_000_000_000L;
        this.nanoClock = nanoClock;
        if (!this.globalFallbacks.isEmpty()) {
            log.info("[ModelFailover] model dự phòng chung: {}, nghỉ model lỗi {}s", this.globalFallbacks, cooldownSeconds);
        }
    }

    /** Danh sách dự phòng chung — dùng cho đường gọi cũ (không theo tầng). */
    public List<String> globalFallbacks() {
        return globalFallbacks;
    }

    /** Model chính + dự phòng chung, bỏ trùng. */
    public List<String> candidatesFor(String primary) {
        List<String> fb = cleanFallbacks(primary, globalFallbacks);
        if (fb.isEmpty()) return List.of(primary);
        List<String> all = new ArrayList<>(fb.size() + 1);
        all.add(primary);
        all.addAll(fb);
        return List.copyOf(all);
    }

    /**
     * Thứ tự thử cho một lượt: model không nghỉ theo thứ tự ưu tiên, rồi model đang nghỉ (hết hạn sớm
     * trước). Một ứng viên ⇒ trả nguyên.
     */
    public List<String> order(List<String> candidates) {
        if (candidates.size() <= 1) return candidates;
        long now = nanoClock.getAsLong();
        List<String> ready = new ArrayList<>(candidates.size());
        List<String> cooling = new ArrayList<>();
        for (String m : candidates) {
            Long until = coolingUntilNanos.get(m);
            if (until != null && until - now > 0) {
                cooling.add(m);
            } else {
                if (until != null) coolingUntilNanos.remove(m, until);
                ready.add(m);
            }
        }
        if (cooling.isEmpty()) return candidates;
        cooling.sort(Comparator.comparingLong(m -> coolingUntilNanos.getOrDefault(m, now) - now));
        ready.addAll(cooling);
        return ready;
    }

    /** Model vừa lỗi kiểu "không trả lời được" ⇒ nghỉ. {@code minSeconds} > cooldown thì lấy số lớn hơn (vd Retry-After). */
    public void markUnavailable(String model, String reason, Integer minSeconds) {
        if (model == null || cooldownNanos == 0) return;
        long nanos = Math.max(cooldownNanos, minSeconds == null ? 0 : minSeconds * 1_000_000_000L);
        long until = nanoClock.getAsLong() + nanos;
        Long prev = coolingUntilNanos.put(model, until);
        if (prev == null || prev - nanoClock.getAsLong() <= 0) {
            log.warn("[ModelFailover] tạm bỏ qua model {} trong {}s: {}", model, nanos / 1_000_000_000L, reason);
        }
    }

    /** Model vừa trả lời được ⇒ hết nghỉ ngay. */
    public void markHealthy(String model) {
        if (model != null && coolingUntilNanos.remove(model) != null) {
            log.info("[ModelFailover] model {} trả lời lại bình thường", model);
        }
    }

    boolean isCooling(String model) {
        Long until = coolingUntilNanos.get(model);
        return until != null && until - nanoClock.getAsLong() > 0;
    }

    /** Bỏ trống, cắt khoảng trắng, bỏ trùng và bỏ chính model chính. */
    static List<String> cleanFallbacks(String primary, List<String> fallbacks) {
        if (fallbacks == null || fallbacks.isEmpty()) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String f : fallbacks) {
            if (f == null) continue;
            for (String part : f.split(",")) {
                String m = part.trim();
                if (!m.isEmpty() && !m.equals(primary == null ? null : primary.trim())) out.add(m);
            }
        }
        return List.copyOf(out);
    }
}
