package com.deutschflow.common.quota;

import com.deutschflow.common.exception.RateLimitExceededException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Hạn mức theo NGÀY cho tính năng AI ĐẮT ở gói miễn phí của GV tự do (non-org) — checklist D6
 * ("unlimited chấm core + cap AI đắt").
 *
 * <p>Chỉ áp cho GV KHÔNG thuộc org ({@code orgId == null}); GV thuộc org đã được org token-pool
 * quản (xem {@link com.deutschflow.organization.service.OrgPoolGuard}). Chấm bài text (core) KHÔNG
 * gọi guard này nên vẫn không giới hạn — chỉ PPTX và OCR-ảnh (đắt) mới bị cap.
 */
@Service
@Slf4j
public class FreeTierGuard {

    public static final String FEATURE_PPTX = "PPTX";
    public static final String FEATURE_OCR_GRADE = "OCR_GRADE";

    private final JdbcTemplate jdbcTemplate;
    private final int pptxDailyLimit;
    private final int ocrDailyLimit;

    public FreeTierGuard(JdbcTemplate jdbcTemplate,
                         @Value("${app.free-tier.pptx-daily:2}") int pptxDailyLimit,
                         @Value("${app.free-tier.ocr-daily:5}") int ocrDailyLimit) {
        this.jdbcTemplate = jdbcTemplate;
        this.pptxDailyLimit = pptxDailyLimit;
        this.ocrDailyLimit = ocrDailyLimit;
    }

    public int dailyLimit(String feature) {
        if (FEATURE_PPTX.equals(feature)) {
            return pptxDailyLimit;
        }
        if (FEATURE_OCR_GRADE.equals(feature)) {
            return ocrDailyLimit;
        }
        return Integer.MAX_VALUE;
    }

    /** Số lượt đã dùng hôm nay cho {@code feature} — để hiển thị trạng thái gói miễn phí (D6²). */
    @Transactional(readOnly = true)
    public int usedToday(Long userId, String feature) {
        return currentCount(userId, feature);
    }

    /**
     * Chặn (429) nếu GV gói-miễn-phí đã đạt hạn mức ngày cho {@code feature}; nếu chưa thì +1 lượt.
     * No-op khi user null hoặc thuộc org (org pool quản).
     */
    @Transactional
    public void assertAndConsume(Long userId, Long orgId, String feature) {
        if (!appliesTo(userId, orgId)) {
            return;
        }
        int limit = dailyLimit(feature);
        int used = currentCount(userId, feature);
        if (overLimit(used, limit)) {
            log.info("[FreeTier] userId={} feature={} đạt hạn mức {}/ngày", userId, feature, limit);
            throw new RateLimitExceededException(
                    "Gói miễn phí đã đạt giới hạn " + limit + " lượt/ngày cho tính năng này. "
                            + "Nâng cấp hoặc tham gia tổ chức để dùng nhiều hơn.",
                    secondsToUtcMidnight());
        }
        increment(userId, feature);
    }

    /** Cap chỉ áp cho GV tự do (có user, không thuộc org). */
    static boolean appliesTo(Long userId, Long orgId) {
        return userId != null && orgId == null;
    }

    static boolean overLimit(int used, int limit) {
        return used >= limit;
    }

    /** Giây tới nửa đêm UTC (mốc reset của CURRENT_DATE) — cho Retry-After. */
    static int secondsToUtcMidnight() {
        Instant now = Instant.now();
        Instant nextMidnight = now.truncatedTo(ChronoUnit.DAYS).plus(1, ChronoUnit.DAYS);
        return (int) Math.max(60, Duration.between(now, nextMidnight).getSeconds());
    }

    private int currentCount(Long userId, String feature) {
        Integer c = jdbcTemplate.query(
                "SELECT count FROM free_tier_usage WHERE user_id = ? AND usage_date = CURRENT_DATE AND feature = ?",
                rs -> rs.next() ? rs.getInt(1) : 0,
                userId, feature);
        return c == null ? 0 : c;
    }

    private void increment(Long userId, String feature) {
        jdbcTemplate.update("""
                        INSERT INTO free_tier_usage (user_id, usage_date, feature, count)
                        VALUES (?, CURRENT_DATE, ?, 1)
                        ON CONFLICT (user_id, usage_date, feature)
                        DO UPDATE SET count = free_tier_usage.count + 1
                        """,
                userId, feature);
    }
}
