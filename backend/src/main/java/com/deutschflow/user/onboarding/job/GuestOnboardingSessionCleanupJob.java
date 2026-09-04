package com.deutschflow.user.onboarding.job;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dọn phiên onboarding của khách đã hết hạn (V286, TTL 72h).
 *
 * <p>Phiên chưa claim là rác thuần: khách bỏ ngang thì không ai quay lại nữa. Để
 * chúng nằm mãi là vừa phình bảng vừa giữ câu trả lời của người lạ lâu hơn mức
 * cần thiết.
 *
 * <p><b>Một entry point, đủ ba annotation, trả {@code void}</b> — đây là khuôn bắt
 * buộc của repo. Tự gọi method khác trong cùng bean sẽ đi vòng qua proxy nên
 * {@code @Transactional} mất tác dụng, và {@code @SchedulerLock} trên method trả về
 * kiểu nguyên thuỷ sẽ nổ lúc chạy.
 *
 * <p>Dùng {@link JdbcTemplate} thay vì JPA: đây là xoá hàng loạt, không cần load
 * entity, và tránh luôn chuyện Hibernate diễn giải {@code ::} trong native query.
 */
@Slf4j
@Component
public class GuestOnboardingSessionCleanupJob {

    private final JdbcTemplate jdbcTemplate;
    private final boolean enabled;
    private final int batchSize;

    public GuestOnboardingSessionCleanupJob(
            JdbcTemplate jdbcTemplate,
            @Value("${app.onboarding.guest-session-cleanup.enabled:true}") boolean enabled,
            @Value("${app.onboarding.guest-session-cleanup.batch-size:5000}") int batchSize) {
        this.jdbcTemplate = jdbcTemplate;
        this.enabled = enabled;
        this.batchSize = Math.max(100, batchSize);
    }

    @Scheduled(cron = "${app.onboarding.guest-session-cleanup.cron:0 15 3 * * *}", zone = "Asia/Ho_Chi_Minh")
    @SchedulerLock(name = "guestOnboardingSessionCleanup", lockAtMostFor = "PT15M", lockAtLeastFor = "PT1M")
    @Transactional
    public void purgeExpiredSessions() {
        if (!enabled) {
            return;
        }
        // Xoá theo lô: một DELETE không giới hạn trên bảng đã phình sẽ giữ khoá lâu
        // và thổi WAL. Vòng lặp dừng khi lô cuối không còn hàng nào.
        long total = 0;
        int deleted;
        do {
            deleted = jdbcTemplate.update("""
                    DELETE FROM guest_onboarding_sessions
                     WHERE id IN (
                           SELECT id FROM guest_onboarding_sessions
                            WHERE expires_at <= NOW()
                            LIMIT ?
                     )
                    """, batchSize);
            total += deleted;
        } while (deleted == batchSize);

        if (total > 0) {
            log.info("[GUEST_ONB_CLEANUP] đã xoá {} phiên hết hạn", total);
        }
    }
}
