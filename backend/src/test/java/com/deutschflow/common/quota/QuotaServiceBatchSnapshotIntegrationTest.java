package com.deutschflow.common.quota;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link QuotaService#getSnapshotsReadOnly} (đợt 1 admin, 09/11/2026) phải cho ĐÚNG kết quả của
 * {@link QuotaService#getSnapshotReadOnly} cho từng người — chỉ khác số truy vấn (3 cho cả trang so
 * với 2–4 mỗi người). Phủ các nhánh: không có gói, FREE (trừ theo ngày), PRO có ví cộng dồn từ ngày
 * cộng cuối, ULTRA chưa có dòng ví, INTERNAL không giới hạn.
 */
@SpringBootTest
@DisplayName("QuotaService · snapshot theo lô = snapshot từng người")
class QuotaServiceBatchSnapshotIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private QuotaService quotaService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("mọi nhánh gói: bản lô bằng bản đơn, cùng thứ tự đầu vào, bỏ id trùng/null")
    void batchEqualsSingle() {
        Instant now = Instant.now();
        User none = account();
        User free = withPlan(account(), "FREE", now.minus(1, ChronoUnit.DAYS));
        User pro = withPlan(account(), "PRO", now.minus(10, ChronoUnit.DAYS));
        User ultraNoWallet = withPlan(account(), "ULTRA", now.minus(2, ChronoUnit.DAYS));
        User internal = withPlan(account(), "INTERNAL", now.minus(3, ChronoUnit.DAYS));

        // PRO: ví đã cộng tới 3 ngày trước → bản đọc phải tự cộng dồn tới hôm nay, như bản đơn.
        jdbcTemplate.update("""
                INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
                VALUES (?, 1234, ?)
                """, pro.getId(), Date.valueOf(QuotaVnCalendar.localDateOf(now).minusDays(3)));
        // Dùng hôm nay (giờ VN) cho FREE và PRO.
        usage(free, 300, now);
        usage(pro, 700, now);
        usage(pro, 50, now.minus(3, ChronoUnit.DAYS)); // ngoài cửa sổ hôm nay

        List<Long> ids = List.of(internal.getId(), none.getId(), free.getId(), pro.getId(),
                ultraNoWallet.getId(), free.getId());
        Map<Long, QuotaSnapshot> batch = quotaService.getSnapshotsReadOnly(
                new java.util.ArrayList<>(java.util.Arrays.asList(
                        internal.getId(), none.getId(), null, free.getId(), pro.getId(), ultraNoWallet.getId(), free.getId())),
                now);

        assertThat(batch.keySet()).containsExactly(internal.getId(), none.getId(), free.getId(), pro.getId(),
                ultraNoWallet.getId());
        for (Long id : ids) {
            assertThat(batch.get(id)).as("user %s", id).isEqualTo(quotaService.getSnapshotReadOnly(id, now));
        }
        assertThat(batch.get(none.getId()).planCode()).isEqualTo("DEFAULT");
        assertThat(batch.get(internal.getId()).unlimitedInternal()).isTrue();
        assertThat(batch.get(pro.getId()).usedToday()).isEqualTo(700);
        assertThat(batch.get(pro.getId()).walletBalance()).isGreaterThanOrEqualTo(1234);
    }

    @Test
    @DisplayName("danh sách rỗng → map rỗng, không truy vấn")
    void emptyInput() {
        assertThat(quotaService.getSnapshotsReadOnly(List.of(), Instant.now())).isEmpty();
    }

    private User account() {
        return userRepository.save(User.builder()
                .email("qbatch-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Quota batch")
                .role(User.Role.STUDENT)
                .build());
    }

    private User withPlan(User u, String plan, Instant startsAt) {
        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                VALUES (?, ?, 'ACTIVE', ?, NULL, 'ADMIN')
                """, u.getId(), plan, Timestamp.from(startsAt));
        return u;
    }

    private void usage(User u, int tokens, Instant at) {
        jdbcTemplate.update("""
                INSERT INTO ai_token_usage_events (user_id, model, total_tokens, prompt_tokens, completion_tokens, feature, created_at)
                VALUES (?, 'gpt-oss-20b', ?, ?, 0, 'SPEAKING', ?)
                """, u.getId(), tokens, tokens, Timestamp.from(at));
    }
}
