package com.deutschflow.srs.service;

import com.deutschflow.srs.dto.ReviewRequest;
import com.deutschflow.srs.dto.SrsStatsDto;
import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.repository.VocabReviewRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Owner 05/09: {@code GET /api/srs/stats} thêm {@code reviewedCards} (thẻ đã ôn ≥ 1 lần, từ
 * {@code last_review_at}) và {@code totalReviews} (tổng lượt ôn = event XP SRS_REVIEW). Chạy
 * thật trên Postgres: thẻ mới thêm vào lịch → cả hai = 0; ôn một thẻ qua {@link SrsService#recordReview}
 * → cả hai = 1 (mobile gate coach mark SRS theo {@code reviewedCards == 0}).
 */
@SpringBootTest
@EnabledIf("com.deutschflow.testsupport.TestcontainersPostgresConditions#integrationPostgresAvailable")
class SrsStatsIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String IT_EMAIL = "srs-stats-it@test.com";

    @Autowired private SrsService srsService;
    @Autowired private VocabReviewRepository vocabReviewRepository;
    @Autowired private UserRepository userRepository;

    /** Real owner row: vocab_review_schedule.user_id và user_xp_events.user_id đều FK → users(id). */
    private Long userId;

    @BeforeEach
    void setup() {
        userRepository.findByEmail(IT_EMAIL).ifPresent(userRepository::delete); // leftover from an aborted run
        userRepository.flush();
        userId = userRepository.save(User.builder()
                .email(IT_EMAIL)
                .passwordHash("$2a$10$h")
                .displayName("SRS stats IT")
                .role(User.Role.STUDENT)
                .build()).getId();
    }

    @AfterEach
    void tearDown() {
        vocabReviewRepository.deleteAll(vocabReviewRepository.findByUserIdOrderByNextReviewAtAsc(userId));
        // ON DELETE CASCADE (V196) dọn luôn user_xp_events của user này.
        userRepository.deleteById(userId);
    }

    private void schedule(String vocabId, String german) {
        vocabReviewRepository.save(VocabReviewSchedule.builder()
                .userId(userId)
                .vocabId(vocabId)
                .german(german)
                .meaning("nghĩa " + german)
                .algorithmVersion(VocabReviewSchedule.AlgorithmVersion.SM2.name())
                .build());
    }

    @Test
    @DisplayName("thẻ mới trong lịch: reviewedCards = totalReviews = 0; ôn 1 thẻ thật → cả hai = 1")
    void reviewedCardsAndTotalReviewsFollowRealReviews() {
        schedule("it_stats_a", "Apfel");
        schedule("it_stats_b", "Brot");

        SrsStatsDto before = srsService.getStats(userId);
        assertThat(before.totalCards()).isEqualTo(2L);
        assertThat(before.dueCount()).isEqualTo(2L);       // next_review_at mặc định = lúc tạo → đã đến hạn
        assertThat(before.reviewedCards()).isZero();       // có thẻ nhưng CHƯA ôn → "chưa từng dùng SRS"
        assertThat(before.totalReviews()).isZero();

        srsService.recordReview(userId, new ReviewRequest("it_stats_a", 4));

        SrsStatsDto after = srsService.getStats(userId);
        assertThat(after.totalCards()).isEqualTo(2L);
        assertThat(after.reviewedCards()).isEqualTo(1L);   // last_review_at của thẻ A đã được ghi
        assertThat(after.totalReviews()).isEqualTo(1L);    // đúng một event XP SRS_REVIEW
        assertThat(after.dueCount()).isEqualTo(1L);        // thẻ A đã lên lịch về sau, thẻ B còn đến hạn
    }
}
