package com.deutschflow.ai.queue;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hồi quy cho bug worker không claim được job: processPendingJobs() tự-gọi claimJobs() nên REQUIRES_NEW bị bỏ qua
 * → bulkUpdateStatus ném TransactionRequiredException (từ a7e48b28 10/06 tới 23/08). Sau vá: job PENDING loại lạ
 * phải được claim và kết thúc ở COMPLETED với thông điệp "Unknown job type" thay vì nằm PENDING mãi.
 */
@SpringBootTest
class AiJobWorkerClaimIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private AiJobWorker worker;
    @Autowired private AiJobRepository aiJobRepository;
    @Autowired private UserRepository userRepository;

    @Test
    @DisplayName("processPendingJobs claim được job PENDING (không còn TransactionRequiredException)")
    void workerClaimsPendingJobs() {
        User u = userRepository.save(User.builder().email("worker-it-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Worker IT").role(User.Role.STUDENT).build());
        AiJob job = aiJobRepository.save(AiJob.builder().jobType("UNKNOWN_TYPE_FOR_TEST").userId(u.getId())
                .payload(Map.of("x", 1)).build());

        worker.processPendingJobs();

        AiJob after = aiJobRepository.findById(job.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(AiJob.STATUS_COMPLETED);
        assertThat(after.getResult()).containsEntry("error", "Unknown job type: UNKNOWN_TYPE_FOR_TEST");
    }
}
