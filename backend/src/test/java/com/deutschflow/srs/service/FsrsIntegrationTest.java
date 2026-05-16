package com.deutschflow.srs.service;

import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.repository.VocabReviewRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.junit.jupiter.api.condition.EnabledIf;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@EnabledIf("com.deutschflow.testsupport.TestcontainersPostgresConditions#integrationPostgresAvailable")
public class FsrsIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private FsrsService fsrsService;

    @Autowired
    private VocabReviewRepository vocabReviewRepository;

    @BeforeEach
    void setup() {
        vocabReviewRepository.deleteAll();
    }

    @Test
    void testFsrsInitializationAndPersistence() {
        // Create a new card without FSRS metrics
        VocabReviewSchedule card = VocabReviewSchedule.builder()
                .userId(1L)
                .vocabId("test_vocab_1")
                .german("Hallo")
                .meaning("Xin chào")
                .algorithmVersion(VocabReviewSchedule.AlgorithmVersion.SM2.name())
                .build();

        VocabReviewSchedule savedCard = vocabReviewRepository.save(card);
        assertThat(savedCard.getStability()).isNull();

        // 1. Initialize FSRS (e.g. first time review with rating 3 = Good)
        fsrsService.initializeCard(savedCard, 3);
        VocabReviewSchedule initializedCard = vocabReviewRepository.save(savedCard);

        // Verify FSRS parameters were computed and persisted
        assertThat(initializedCard.getAlgorithmVersion()).isEqualTo("FSRS");
        assertThat(initializedCard.getFsrsState()).isEqualTo((short) 2); // REVIEW
        assertThat(initializedCard.getStability()).isNotNull();
        assertThat(initializedCard.getStability().compareTo(BigDecimal.ZERO)).isGreaterThan(0);
        assertThat(initializedCard.getDifficulty()).isNotNull();
        assertThat(initializedCard.getRetrievability()).isNotNull();
        assertThat(initializedCard.getLastReviewAt()).isNotNull();
        assertThat(initializedCard.getNextReviewAt()).isAfter(OffsetDateTime.now());

        // 2. Perform a subsequent review (Simulate a review after 1 day with rating 2 = Hard)
        double previousStability = initializedCard.getStability().doubleValue();
        double previousDifficulty = initializedCard.getDifficulty().doubleValue();

        fsrsService.scheduleReview(initializedCard, 2, 1);
        VocabReviewSchedule updatedCard = vocabReviewRepository.save(initializedCard);

        // Verify parameters were updated
        assertThat(updatedCard.getStability().doubleValue()).isNotEqualTo(previousStability);
        assertThat(updatedCard.getDifficulty().doubleValue()).isNotEqualTo(previousDifficulty);
        assertThat(updatedCard.getFsrsState()).isEqualTo((short) 2); // Still REVIEW since we didn't fail
    }

    @Test
    void testFsrsFailureState() {
        VocabReviewSchedule card = VocabReviewSchedule.builder()
                .userId(1L)
                .vocabId("test_vocab_2")
                .german("Danke")
                .meaning("Cảm ơn")
                .build();
        
        fsrsService.initializeCard(card, 3);
        vocabReviewRepository.save(card);

        // Fail the review (rating 1 = Again)
        fsrsService.scheduleReview(card, 1, 1);
        VocabReviewSchedule failedCard = vocabReviewRepository.save(card);

        // State should be RELEARNING
        assertThat(failedCard.getFsrsState()).isEqualTo((short) 3); // RELEARNING
        // Difficulty should increase (capped at 10)
        assertThat(failedCard.getDifficulty().doubleValue()).isGreaterThan(5.0); 
    }
}
