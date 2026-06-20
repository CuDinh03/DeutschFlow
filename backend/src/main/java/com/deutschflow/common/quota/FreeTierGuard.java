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
 * Hạn mức theo NGÀY cho tính năng AI ĐẮT (PPTX, OCR-ảnh) ở gói miễn phí — checklist D6
 * ("unlimited chấm core + cap AI đắt"). Chấm bài text (core) KHÔNG gọi guard này.
 *
 * <p><b>M-5 — ai bị cap (đóng backdoor org member):</b>
 * <ul>
 *   <li>GV B2C ({@code orgId == null}) → cap (như cũ).</li>
 *   <li>Org member, {@code pool_unlimited = true} → KHÔNG cap (unlimited có chủ đích).</li>
 *   <li>Org member, {@code monthly_token_pool > 0} → KHÔNG cap ở đây (metered bởi
 *       {@link com.deutschflow.organization.service.OrgPoolGuard}).</li>
 *   <li>Org member, {@code pool = 0 & !unlimited} → <b>cap</b> (default fail-safe; trước M-5
 *       org member bỏ qua hoàn toàn → dùng PPTX/OCR đắt miễn phí không giới hạn).</li>
 * </ul>
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

    /**
     * Free-tier cap áp cho request này không? (M-5 — xem class doc cho bảng quyết định).
     * Org member phải tra cấu hình pool/unlimited; B2C và user-null quyết định ngay không chạm DB.
     */
    boolean appliesTo(Long userId, Long orgId) {
        if (userId == null) {
            return false;
        }
        if (orgId == null) {
            return true; // GV B2C tự do
        }
        OrgPoolConfig cfg = loadOrgPoolConfig(orgId);
        if (cfg.unlimited()) {
            // Bước 5 — observability: org member bypass cap do unlimited tường minh (giám sát ai xài unlimited).
            log.info("[FreeTier][UNLIMITED-BYPASS] userId={} orgId={} — bỏ qua cap do pool_unlimited=true",
                    userId, orgId);
        }
        return orgMemberCapped(cfg.pool(), cfg.unlimited());
    }

    /** Quyết định thuần cho org member (tách để test không cần DB). */
    static boolean orgMemberCapped(long monthlyTokenPool, boolean poolUnlimited) {
        if (poolUnlimited) {
            return false;            // unlimited thật → không cap
        }
        return monthlyTokenPool <= 0L; // pool=0 → cap (đóng backdoor); pool>0 → metered bởi OrgPoolGuard
    }

    /** Cấu hình pool của org. Org không tồn tại → fail-safe (cap, không unlimited). */
    private OrgPoolConfig loadOrgPoolConfig(Long orgId) {
        return jdbcTemplate.query(
                "SELECT monthly_token_pool, pool_unlimited FROM organizations WHERE id = ?",
                rs -> rs.next()
                        ? new OrgPoolConfig(rs.getLong(1), rs.getBoolean(2))
                        : new OrgPoolConfig(0L, false),
                orgId);
    }

    private record OrgPoolConfig(long pool, boolean unlimited) {}

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
