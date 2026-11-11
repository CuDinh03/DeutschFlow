package com.deutschflow.srs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Nightly job that refines FSRS-4.5 weights for users who have accumulated
 * at least 50 card reviews. Stores the result in
 * {@code user_learning_profiles.fsrs_weights_json} so that {@link FsrsService}
 * can use them on subsequent reviews.
 *
 * <h3>Algorithm (simplified gradient descent on retention error):</h3>
 * <ol>
 *   <li>Query all (stability, interval, passed) tuples for the user.</li>
 *   <li>Compute predicted retrievability: R_pred = (1 + t / (9·S))^{-1}</li>
 *   <li>Compare with actual pass rate bucketed by stability range.</li>
 *   <li>Compute a multiplicative correction factor for S → w17 offset.</li>
 *   <li>Apply correction to the global FSRS-4.5 weights and persist.</li>
 * </ol>
 *
 * <p>Only runs if the user has ≥50 FSRS-mode reviews (algorithm_version = 'FSRS').
 * Runs nightly at 03:00 UTC to avoid production load spikes.
 *
 * <h3>ĐANG VÔ HIỆU (từ bản sửa FSRS-4.5)</h3>
 * Thuật toán dưới đây được viết cho mô hình cũ: đường cong quên của FSRS v4
 * ({@code (1 + t/(9·S))^-1}) và vector 20 phần tử với {@code w17} là "hệ số nhân độ ổn định".
 * FSRS-4.5 chỉ có 17 tham số (w0–w16) và đường cong quên khác, nên kết quả của job này không còn
 * áp dụng được: {@link #APPLY_ENABLED} = {@code false} làm job ban đêm bỏ qua, và
 * {@link FsrsWeightProvider} bỏ qua mọi vector không đúng 17 phần tử đã lưu trước đây.
 * Mã được giữ lại để tham khảo; muốn bật lại phải viết lại bộ tối ưu trên mô hình 4.5
 * (cần nhật ký từng lượt ôn — hiện chỉ có trạng thái mới nhất của mỗi thẻ).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FsrsWeightOptimizerService {

    private static final int MIN_REVIEWS_FOR_OPTIMIZATION = 50;
    private static final int W17 = 17; // stability multiplier on a successful review (mô hình cũ, 20 tham số)

    /** Xem Javadoc của lớp: bộ tối ưu này thuộc mô hình cũ nên không được áp dụng kết quả. */
    static final boolean APPLY_ENABLED = false;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final FsrsService fsrsService;

    // Container prod chạy đồng hồ UTC ⇒ zone="UTC" cũ nghĩa là 10:00 SÁNG giờ VN — job nặng nhất
    // hệ thống (loop mọi user đủ điều kiện, tải trọn lịch sử review từng người) chạy ngay giờ cao
    // điểm và tranh CPU/RDS với request người dùng. Ghim zone VN để "3 giờ đêm" là đêm thật.
    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Ho_Chi_Minh")
    @SchedulerLock(name = "fsrsNightlyOptimization", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void runNightlyOptimization() {
        if (!APPLY_ENABLED) {
            log.info("[FSRS-OPT] Bỏ qua: bộ tối ưu trọng số thuộc mô hình cũ (20 tham số), không áp dụng cho FSRS-4.5");
            return;
        }
        List<Long> eligibleUsers = findEligibleUsers();
        log.info("[FSRS-OPT] Starting nightly optimization for {} users", eligibleUsers.size());

        int updated = 0;
        for (Long userId : eligibleUsers) {
            try {
                if (optimizeForUser(userId)) updated++;
            } catch (Exception e) {
                log.warn("[FSRS-OPT] Failed optimization for userId={}", userId, e);
            }
        }
        log.info("[FSRS-OPT] Completed — updated {}/{} users", updated, eligibleUsers.size());
    }

    private List<Long> findEligibleUsers() {
        return jdbc.queryForList(
            """
            SELECT user_id
            FROM vocab_review_schedule
            WHERE algorithm_version = 'FSRS'
              AND stability IS NOT NULL
              AND last_review_at IS NOT NULL
            GROUP BY user_id
            HAVING COUNT(*) >= ?
            """,
            Long.class, MIN_REVIEWS_FOR_OPTIMIZATION
        );
    }

    @Transactional
    boolean optimizeForUser(Long userId) {
        if (!APPLY_ENABLED) return false; // không ghi vector 20 phần tử của mô hình cũ
        // Fetch (stability_days, interval_days, passed) tuples for all FSRS reviews
        List<Map<String, Object>> rows = jdbc.queryForList(
            """
            SELECT stability, interval_days, last_quality
            FROM vocab_review_schedule
            WHERE user_id = ?
              AND algorithm_version = 'FSRS'
              AND stability IS NOT NULL
              AND last_review_at IS NOT NULL
            """,
            userId
        );

        if (rows.isEmpty()) return false;

        // Compute observed vs predicted retention error
        double sumError = 0;
        int count = 0;
        for (Map<String, Object> row : rows) {
            double stability = toDouble(row.get("stability"));
            int intervalDays = toInt(row.get("interval_days"));
            int lastQuality = toInt(row.get("last_quality"));
            if (stability <= 0 || intervalDays <= 0) continue;

            double rPred = 1.0 / (1 + intervalDays / (9.0 * stability));
            double rActual = lastQuality >= 3 ? 1.0 : 0.0; // pass = quality Good or Easy

            sumError += (rActual - rPred);
            count++;
        }

        if (count < MIN_REVIEWS_FOR_OPTIMIZATION) return false;

        double avgError = sumError / count;

        // Adjust w17 (stability multiplier on pass) proportionally to error.
        // Correction is clamped to ±0.3 so a noisy signal can only nudge the
        // global weight, never replace it.
        double[] weights = fsrsService.defaultWeights();
        double correction = Math.max(-0.3, Math.min(0.3, avgError * 2.0));
        weights[W17] = weights[W17] * (1.0 + correction);

        try {
            String json = objectMapper.writeValueAsString(weights);
            int affectedRows = jdbc.update(
                """
                UPDATE user_learning_profiles
                SET fsrs_weights_json = ?::jsonb,
                    fsrs_weights_updated_at = NOW()
                WHERE user_id = ?
                """,
                json, userId
            );
            if (affectedRows > 0) {
                log.debug("[FSRS-OPT] userId={} correction={} w17={}",
                        userId,
                        String.format("%.4f", correction),
                        String.format("%.4f", weights[W17]));
                return true;
            }
        } catch (Exception e) {
            log.warn("[FSRS-OPT] Failed to persist weights for userId={}", userId, e);
        }
        return false;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private static double toDouble(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(v)); } catch (Exception e) { return 0.0; }
    }

    private static int toInt(Object v) {
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(v)); } catch (Exception e) { return 0; }
    }
}
