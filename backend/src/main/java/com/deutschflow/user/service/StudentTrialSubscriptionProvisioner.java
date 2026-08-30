package com.deutschflow.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;

/**
 * New students receive a 7-day PRO trial ({@code plan_code PRO}) so they experience all features
 * before deciding whether to subscribe.
 */
@Service
@RequiredArgsConstructor
public class StudentTrialSubscriptionProvisioner {

    private static final String PRO = "PRO";

    /**
     * Đánh dấu quyền lợi này do provisioner cấp, không phải do trả tiền.
     *
     * <p>Q2/Q3 (quyết định owner 28/08) rẽ nhánh theo đúng cột này: ví cạn giữa trial
     * thì KHÔNG hạ gói, còn ngày 8 thì kết thúc hẳn + xoá ví — trong khi gói TRẢ PHÍ
     * vẫn được grace-drain. Không ghi cột này thì hai luật đó áp nhầm lên nhau.
     */
    public static final String SOURCE_TRIAL = "TRIAL";

    private final JdbcTemplate jdbcTemplate;

    public void provisionSevenDayTrial(long userId, Instant trialStart, Instant trialEnd) {
        try {
            // PostgreSQL: user_subscriptions has no UNIQUE on user_id, so the previous MySQL
            // ON DUPLICATE KEY UPDATE never actually upserted — it inserted. Preserve that intent
            // idempotently with a NOT EXISTS guard (grant the trial only if no active sub exists).
            jdbcTemplate.update("""
                            INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                            SELECT ?, ?, 'ACTIVE', ?, ?, ?
                            WHERE NOT EXISTS (
                                SELECT 1 FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'
                            )
                            """,
                    userId, PRO, Timestamp.from(trialStart), Timestamp.from(trialEnd), SOURCE_TRIAL, userId);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to provision trial subscription for user " + userId + ": " + e.getMessage());
            throw e;
        }
    }
}
