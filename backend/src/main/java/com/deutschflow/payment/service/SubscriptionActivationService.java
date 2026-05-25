package com.deutschflow.payment.service;

import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Kích hoạt gói subscription sau khi thanh toán thành công.
 * Cập nhật bảng user_subscriptions (vô hiệu hoá gói cũ, tạo gói mới ACTIVE).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SubscriptionActivationService {

    private final JdbcTemplate jdbcTemplate;
    private final UserNotificationService userNotificationService;

    @Transactional
    public void activatePlan(Long userId, String planCode, int durationMonths) {
        Instant now = Instant.now();
        Instant endsAt = now.plus(durationMonths * 30L, ChronoUnit.DAYS);

        // 1. Vô hiệu hoá tất cả subscription ACTIVE cũ của user
        int updated = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', updated_at = ?
                WHERE user_id = ? AND status = 'ACTIVE'
                """, Timestamp.from(now), userId);
        log.info("[SUB] Deactivated {} old subscriptions for userId={}", updated, userId);

        // 2. Tạo subscription mới ACTIVE
        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, created_at, updated_at)
                VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?)
                """,
                userId, planCode,
                Timestamp.from(now), Timestamp.from(endsAt),
                Timestamp.from(now), Timestamp.from(now));
        log.info("[SUB] Activated plan={} for userId={} until={}", planCode, userId, endsAt);

        // 3. (Optional) Seed wallet balance cho gói PRO/ULTRA
        seedWalletIfNeeded(userId, planCode);

        // 4. Notify Admins
        userNotificationService.onLearnerSubscribed(userId, planCode);
    }

    private void seedWalletIfNeeded(Long userId, String planCode) {
        if ("PRO".equalsIgnoreCase(planCode) || "ULTRA".equalsIgnoreCase(planCode)) {
            // Kiểm tra xem đã có wallet chưa
            Integer exists = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_ai_token_wallets WHERE user_id = ?",
                    Integer.class, userId);
            if (exists != null && exists == 0) {
                // Lấy daily_token_grant từ plan
                Long grant = jdbcTemplate.queryForObject(
                        "SELECT daily_token_grant FROM subscription_plans WHERE code = ?",
                        Long.class, planCode);
                if (grant != null && grant > 0) {
                    jdbcTemplate.update("""
                            INSERT INTO user_ai_token_wallets (user_id, balance, updated_at)
                            VALUES (?, ?, NOW())
                            """, userId, grant);
                    log.info("[WALLET] Seeded wallet balance={} for userId={}", grant, userId);
                }
            }
        }
    }
}
