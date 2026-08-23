package com.deutschflow.ai.queue;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chặn chống lặp lại sự cố 10/06–23/08: khi AiJobWorker chết một thời gian dài, backlog job
 * PENDING tích lại; lúc worker sống lại nó sẽ gọi AI thật cho những job đã hết giá trị.
 *
 * Hai lớp phòng vệ được kiểm ở đây:
 *   1. claimPendingJobs KHÔNG nhận job quá hạn  → worker không đốt token.
 *   2. StaleAiJobExpirer đánh dấu FAILED job quá hạn → không kẹt PENDING vĩnh viễn.
 */
@SpringBootTest
class StaleAiJobGuardIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private AiJobWorker worker;
    @Autowired private StaleAiJobExpirer expirer;
    @Autowired private AiJobRepository aiJobRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long newJobAgedDays(int days) {
        User u = userRepository.save(User.builder()
                .email("stale-guard-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Stale Guard IT").role(User.Role.STUDENT).build());
        AiJob job = aiJobRepository.save(AiJob.builder()
                .jobType("UNKNOWN_TYPE_FOR_TEST").userId(u.getId()).payload(Map.of("x", 1)).build());
        // created_at là updatable=false ở tầng JPA → lùi tuổi bằng SQL trực tiếp.
        jdbcTemplate.update("UPDATE ai_jobs SET created_at = NOW() - make_interval(days => ?) WHERE id = ?",
                days, job.getId());
        return job.getId();
    }

    @Test
    @DisplayName("worker KHÔNG claim job PENDING quá hạn — không gọi AI cho backlog cũ")
    void workerSkipsStalePendingJob() {
        Long staleId = newJobAgedDays(30);

        worker.processPendingJobs();

        AiJob after = aiJobRepository.findById(staleId).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(AiJob.STATUS_PENDING);
        assertThat(after.getResult()).isNull();
    }

    @Test
    @DisplayName("worker VẪN claim job PENDING còn hạn — hàng đợi bình thường không bị ảnh hưởng")
    void workerStillClaimsFreshJob() {
        Long freshId = newJobAgedDays(1);

        worker.processPendingJobs();

        AiJob after = aiJobRepository.findById(freshId).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(AiJob.STATUS_COMPLETED);
    }

    @Test
    @DisplayName("expirer đánh dấu FAILED job quá hạn và bỏ qua job còn hạn")
    void expirerFailsOnlyStaleJobs() {
        Long staleId = newJobAgedDays(30);
        Long freshId = newJobAgedDays(1);

        // Gọi qua proxy đúng như scheduler gọi — đây LÀ entry point duy nhất, không có tầng tự-gọi,
        // nên test này phủ luôn cả ràng buộc của ShedLock (method mang @SchedulerLock phải trả void).
        expirer.expireStalePendingJobs();

        AiJob stale = aiJobRepository.findById(staleId).orElseThrow();
        assertThat(stale.getStatus()).isEqualTo(AiJob.STATUS_FAILED);
        assertThat(stale.getErrorMsg()).contains("STALE_PENDING_EXPIRED");
        AiJob fresh = aiJobRepository.findById(freshId).orElseThrow();
        assertThat(fresh.getStatus()).isEqualTo(AiJob.STATUS_PENDING);
    }

}
