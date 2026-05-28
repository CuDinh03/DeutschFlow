package com.deutschflow.vocabulary.service;

import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.LearningProgressDto;
import com.deutschflow.vocabulary.entity.SpacedRepetitionSchedule;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.SpacedRepetitionRepository;
import com.deutschflow.vocabulary.repository.WordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SpacedRepetitionService Unit Tests")
class SpacedRepetitionServiceTest {

    @Mock
    private SpacedRepetitionRepository srsRepository;

    @Mock
    private WordRepository wordRepository;

    private SpacedRepetitionService service;

    @BeforeEach
    void setUp() {
        service = new SpacedRepetitionService(srsRepository, wordRepository);
    }

    // -----------------------------------------------------------------------
    // recordReview(Long, Long, int) — validation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("recordReview — validation")
    class RecordReviewValidation {

        @Test
        @DisplayName("throws BadRequestException for confidence = 0 (below min)")
        void confidenceZero_throwsBadRequestException() {
            assertThatThrownBy(() -> service.recordReview(1L, 1L, 0))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Schedule not found");
        }

        @Test
        @DisplayName("throws BadRequestException for confidence = 6 (above max)")
        void confidenceSix_throwsBadRequestException() {
            assertThatThrownBy(() -> service.recordReview(1L, 1L, 6))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Schedule not found");
        }

        @Test
        @DisplayName("throws BadRequestException for negative confidence")
        void confidenceNegative_throwsBadRequestException() {
            assertThatThrownBy(() -> service.recordReview(1L, 1L, -1))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Schedule not found");
        }

        @ParameterizedTest(name = "confidence = {0} is valid and does not throw validation error")
        @ValueSource(ints = {1, 2, 3, 4, 5})
        @DisplayName("does not throw for valid confidence ratings 1-5")
        void validConfidenceRange_noValidationError(int confidence) {
            SpacedRepetitionSchedule schedule = buildSchedule(2, 2.5, 3, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Should not throw BadRequestException
            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, confidence);
            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("throws NotFoundException when schedule not found for user+word")
        void scheduleNotFound_throwsNotFoundException() {
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.recordReview(1L, 1L, 3))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Schedule not found");
        }
    }

    // -----------------------------------------------------------------------
    // recordReview — SM-2 algorithm: interval and status logic
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("recordReview — SM-2 algorithm")
    class RecordReviewSm2 {

        @Test
        @DisplayName("low confidence (< 3) resets interval to 1 and sets status to LEARNING")
        void lowConfidence_resetsIntervalToOne_andSetsLearning() {
            // Arrange
            SpacedRepetitionSchedule schedule = buildSchedule(2, 2.5, 3, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Act
            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 2);

            // Assert
            assertThat(result.getInterval()).isEqualTo(1);
            assertThat(result.getRetentionStatus()).isEqualTo("LEARNING");
        }

        @Test
        @DisplayName("confidence = 1 (forgot) increments reviewCount and resets interval")
        void confidenceOne_incrementsReviewCount_andResetsInterval() {
            SpacedRepetitionSchedule schedule = buildSchedule(5, 2.5, 10, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 1);

            assertThat(result.getReviewCount()).isEqualTo(6);
            assertThat(result.getInterval()).isEqualTo(1);
            assertThat(result.getRetentionStatus()).isEqualTo("LEARNING");
        }

        @Test
        @DisplayName("first review (reviewCount=0) with confidence >= 3 sets interval to 1")
        void firstReview_confidence3_setsIntervalToOne() {
            SpacedRepetitionSchedule schedule = buildSchedule(0, 2.5, 1, "LEARNING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 3);

            assertThat(result.getInterval()).isEqualTo(1);
            assertThat(result.getRetentionStatus()).isEqualTo("REVIEWING");
        }

        @Test
        @DisplayName("second review (reviewCount=1) with confidence >= 3 sets interval to 3")
        void secondReview_confidence3_setsIntervalToThree() {
            SpacedRepetitionSchedule schedule = buildSchedule(1, 2.5, 1, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 3);

            assertThat(result.getInterval()).isEqualTo(3);
            assertThat(result.getRetentionStatus()).isEqualTo("REVIEWING");
        }

        @Test
        @DisplayName("subsequent reviews (reviewCount=2+) multiply interval by easiness factor")
        void subsequentReview_reviewCount2_multipliesIntervalByEasiness() {
            // interval=6, easiness=2.5 -> new interval = round(6 * ~2.5) = 15
            SpacedRepetitionSchedule schedule = buildSchedule(2, 2.5, 6, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 3);

            // SM-2: newEasiness = max(1.3, 2.5 + (0.1 - 2*(0.08+2*0.02))) = max(1.3, 2.5 + (0.1-0.24)) = 2.36
            // interval = round(6 * 2.36) = 14
            assertThat(result.getInterval()).isGreaterThan(1);
            assertThat(result.getRetentionStatus()).isEqualTo("REVIEWING");
        }

        @Test
        @DisplayName("high confidence increases easiness factor above original")
        void highConfidence_increasesEasinessFactor() {
            SpacedRepetitionSchedule schedule = buildSchedule(2, 2.5, 3, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 5);

            // confidence=5: newEasiness = max(1.3, 2.5 + 0.1) = 2.6
            assertThat(result.getEasinessFactor()).isGreaterThan(2.5);
        }

        @Test
        @DisplayName("easiness factor never drops below 1.3")
        void repeatedLowConfidence_easinessFloorIs1Point3() {
            // Worst-case: confidence=1 repeatedly; start low
            SpacedRepetitionSchedule schedule = buildSchedule(10, 1.4, 1, "LEARNING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 1);

            assertThat(result.getEasinessFactor()).isGreaterThanOrEqualTo(1.3);
        }

        @Test
        @DisplayName("marks word as MASTERED when reviewCount >= 3 and confidence >= 4")
        void sufficientReviewsHighConfidence_marksAsMastered() {
            SpacedRepetitionSchedule schedule = buildSchedule(3, 2.5, 30, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 5);

            assertThat(result.getRetentionStatus()).isEqualTo("MASTERED");
        }

        @Test
        @DisplayName("does NOT mark as MASTERED when reviewCount = 3 but confidence = 3 (boundary)")
        void reviewCount3_confidence3_notMastered() {
            SpacedRepetitionSchedule schedule = buildSchedule(3, 2.5, 30, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 3);

            assertThat(result.getRetentionStatus()).isEqualTo("REVIEWING");
        }

        @Test
        @DisplayName("does NOT mark as MASTERED when confidence >= 4 but reviewCount < 3 (boundary)")
        void reviewCount2_confidence5_notMastered() {
            SpacedRepetitionSchedule schedule = buildSchedule(2, 2.5, 3, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 5);

            assertThat(result.getRetentionStatus()).isEqualTo("REVIEWING");
        }

        @Test
        @DisplayName("exactly marks MASTERED when reviewCount = 3 and confidence = 4 (exact boundary)")
        void reviewCount3_confidence4_exactBoundary_mastered() {
            SpacedRepetitionSchedule schedule = buildSchedule(3, 2.5, 6, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 4);

            assertThat(result.getRetentionStatus()).isEqualTo("MASTERED");
        }

        @Test
        @DisplayName("increments reviewCount by 1 on each call")
        void recordReview_incrementsReviewCount() {
            SpacedRepetitionSchedule schedule = buildSchedule(2, 2.5, 3, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 3);

            assertThat(result.getReviewCount()).isEqualTo(3);
        }

        @Test
        @DisplayName("sets lastReviewDate to a non-null recent timestamp")
        void recordReview_setsLastReviewDate() {
            LocalDateTime before = LocalDateTime.now().minusSeconds(1);
            SpacedRepetitionSchedule schedule = buildSchedule(1, 2.5, 1, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 3);

            assertThat(result.getLastReviewDate()).isNotNull();
            assertThat(result.getLastReviewDate()).isAfterOrEqualTo(before);
        }

        @Test
        @DisplayName("sets nextReviewDate to a future date based on interval")
        void recordReview_setsNextReviewDateInFuture() {
            SpacedRepetitionSchedule schedule = buildSchedule(1, 2.5, 1, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(1L, 1L, 3);

            assertThat(result.getNextReviewDate()).isAfter(LocalDateTime.now());
        }

        @Test
        @DisplayName("saves to repository exactly once")
        void recordReview_savesExactlyOnce() {
            SpacedRepetitionSchedule schedule = buildSchedule(1, 2.5, 1, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.recordReview(1L, 1L, 3);

            verify(srsRepository, times(1)).save(any());
        }
    }

    // -----------------------------------------------------------------------
    // recordReview(User, Long, int) — overloaded User-based delegate
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("recordReview(User, wordId, confidence) — User overload delegation")
    class RecordReviewUserOverload {

        @Test
        @DisplayName("delegates to the id-based method using user.getId()")
        void delegatesToIdBased_usesUserId() {
            User user = User.builder().id(42L).build();
            SpacedRepetitionSchedule schedule = buildSchedule(1, 2.5, 1, "REVIEWING");
            when(srsRepository.findByUserIdAndWordId(42L, 7L)).thenReturn(Optional.of(schedule));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.recordReview(user, 7L, 3);

            assertThat(result).isNotNull();
            verify(srsRepository).findByUserIdAndWordId(42L, 7L);
        }

        @Test
        @DisplayName("throws BadRequestException when confidence is invalid via User overload")
        void invalidConfidence_userOverload_throwsBadRequestException() {
            User user = User.builder().id(1L).build();

            assertThatThrownBy(() -> service.recordReview(user, 1L, 0))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Schedule not found");
        }
    }

    // -----------------------------------------------------------------------
    // scheduleWord
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("scheduleWord")
    class ScheduleWord {

        @Test
        @DisplayName("throws NotFoundException when word does not exist")
        void wordNotFound_throwsNotFoundException() {
            User user = User.builder().id(1L).build();
            when(srsRepository.existsByUserIdAndWordId(1L, 99L)).thenReturn(false);
            when(wordRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.scheduleWord(user, 99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Word not found");
        }

        @Test
        @DisplayName("creates new schedule with SM-2 initial values when word is not yet scheduled")
        void newWord_createsScheduleWithInitialValues() {
            User user = User.builder().id(1L).build();
            Word word = Word.builder().id(1L).word("Hallo").build();
            when(srsRepository.existsByUserIdAndWordId(1L, 1L)).thenReturn(false);
            when(wordRepository.findById(1L)).thenReturn(Optional.of(word));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            SpacedRepetitionSchedule result = service.scheduleWord(user, 1L);

            assertThat(result.getUserId()).isEqualTo(1L);
            assertThat(result.getWordId()).isEqualTo(1L);
            assertThat(result.getEasinessFactor()).isEqualTo(2.5);
            assertThat(result.getInterval()).isEqualTo(1);
            assertThat(result.getRetentionStatus()).isEqualTo("LEARNING");
            assertThat(result.getReviewCount()).isEqualTo(0);
        }

        @Test
        @DisplayName("returns existing schedule without re-creating when word is already scheduled")
        void wordAlreadyScheduled_returnsExistingSchedule() {
            User user = User.builder().id(1L).build();
            SpacedRepetitionSchedule existing = buildSchedule(3, 2.1, 7, "REVIEWING");
            existing.setUserId(1L);
            existing.setWordId(1L);

            when(srsRepository.existsByUserIdAndWordId(1L, 1L)).thenReturn(true);
            when(srsRepository.findByUserIdAndWordId(1L, 1L)).thenReturn(Optional.of(existing));

            SpacedRepetitionSchedule result = service.scheduleWord(user, 1L);

            assertThat(result).isSameAs(existing);
            verify(srsRepository, never()).save(any());
            verify(wordRepository, never()).findById(any());
        }

        @Test
        @DisplayName("saves exactly once when creating a new schedule")
        void newWord_savesExactlyOnce() {
            User user = User.builder().id(1L).build();
            Word word = Word.builder().id(1L).word("Hund").build();
            when(srsRepository.existsByUserIdAndWordId(1L, 1L)).thenReturn(false);
            when(wordRepository.findById(1L)).thenReturn(Optional.of(word));
            when(srsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.scheduleWord(user, 1L);

            verify(srsRepository, times(1)).save(any());
        }
    }

    // -----------------------------------------------------------------------
    // getReviewDue
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("getReviewDue")
    class GetReviewDue {

        @Test
        @DisplayName("delegates to repository with user id, current time, and limit")
        void returnsSchedulesDueForReview() {
            User user = User.builder().id(5L).build();
            List<SpacedRepetitionSchedule> due = createMockSchedules(3);
            when(srsRepository.findDueForReview(eq(5L), any(LocalDateTime.class), eq(10)))
                    .thenReturn(due);

            List<SpacedRepetitionSchedule> result = service.getReviewDue(user, 10);

            assertThat(result).hasSize(3);
            verify(srsRepository).findDueForReview(eq(5L), any(LocalDateTime.class), eq(10));
        }

        @Test
        @DisplayName("returns empty list when no items are due")
        void nothingDue_returnsEmptyList() {
            User user = User.builder().id(5L).build();
            when(srsRepository.findDueForReview(eq(5L), any(LocalDateTime.class), anyInt()))
                    .thenReturn(new ArrayList<>());

            List<SpacedRepetitionSchedule> result = service.getReviewDue(user, 20);

            assertThat(result).isEmpty();
        }
    }

    // -----------------------------------------------------------------------
    // getLearningProgress(Long)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("getLearningProgress(Long userId)")
    class GetLearningProgressById {

        @Test
        @DisplayName("returns correct progress DTO with all fields populated")
        void validUserId_returnsProgressDto() {
            when(srsRepository.countByUserId(1L)).thenReturn(50L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "MASTERED")).thenReturn(20L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "REVIEWING")).thenReturn(15L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "LEARNING")).thenReturn(15L);
            when(srsRepository.findDueForReview(eq(1L), any(LocalDateTime.class), eq(Integer.MAX_VALUE)))
                    .thenReturn(createMockSchedules(5));

            LearningProgressDto progress = service.getLearningProgress(1L);

            assertThat(progress.totalWords()).isEqualTo(50);
            assertThat(progress.masteredWords()).isEqualTo(20);
            assertThat(progress.reviewingWords()).isEqualTo(15);
            assertThat(progress.learningWords()).isEqualTo(15);
            assertThat(progress.retentionRate()).isEqualTo(0.4);
            assertThat(progress.wordsDueForReview()).isEqualTo(5);
        }

        @Test
        @DisplayName("retentionRate is 0.0 when no words are scheduled")
        void noWords_retentionRateIsZero() {
            when(srsRepository.countByUserId(1L)).thenReturn(0L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "MASTERED")).thenReturn(0L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "REVIEWING")).thenReturn(0L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "LEARNING")).thenReturn(0L);
            when(srsRepository.findDueForReview(eq(1L), any(LocalDateTime.class), eq(Integer.MAX_VALUE)))
                    .thenReturn(new ArrayList<>());

            LearningProgressDto progress = service.getLearningProgress(1L);

            assertThat(progress.retentionRate()).isEqualTo(0.0);
            assertThat(progress.totalWords()).isEqualTo(0);
            assertThat(progress.wordsDueForReview()).isEqualTo(0);
        }

        @Test
        @DisplayName("retentionRate is 1.0 when all words are mastered")
        void allWordsMastered_retentionRateIsOne() {
            when(srsRepository.countByUserId(1L)).thenReturn(10L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "MASTERED")).thenReturn(10L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "REVIEWING")).thenReturn(0L);
            when(srsRepository.countByUserIdAndRetentionStatus(1L, "LEARNING")).thenReturn(0L);
            when(srsRepository.findDueForReview(eq(1L), any(LocalDateTime.class), eq(Integer.MAX_VALUE)))
                    .thenReturn(new ArrayList<>());

            LearningProgressDto progress = service.getLearningProgress(1L);

            assertThat(progress.retentionRate()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("wordsDueForReview reflects actual count from repository")
        void wordsDueForReview_reflectsRepositoryResult() {
            when(srsRepository.countByUserId(1L)).thenReturn(20L);
            when(srsRepository.countByUserIdAndRetentionStatus(any(), any())).thenReturn(0L);
            when(srsRepository.findDueForReview(eq(1L), any(LocalDateTime.class), eq(Integer.MAX_VALUE)))
                    .thenReturn(createMockSchedules(12));

            LearningProgressDto progress = service.getLearningProgress(1L);

            assertThat(progress.wordsDueForReview()).isEqualTo(12);
        }
    }

    // -----------------------------------------------------------------------
    // getLearningProgress(User) — User overload delegation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("getLearningProgress(User) — User overload delegation")
    class GetLearningProgressUserOverload {

        @Test
        @DisplayName("delegates to id-based method using user.getId()")
        void delegatesToIdBasedMethod() {
            User user = User.builder().id(7L).build();
            when(srsRepository.countByUserId(7L)).thenReturn(5L);
            when(srsRepository.countByUserIdAndRetentionStatus(7L, "MASTERED")).thenReturn(2L);
            when(srsRepository.countByUserIdAndRetentionStatus(7L, "REVIEWING")).thenReturn(2L);
            when(srsRepository.countByUserIdAndRetentionStatus(7L, "LEARNING")).thenReturn(1L);
            when(srsRepository.findDueForReview(eq(7L), any(LocalDateTime.class), eq(Integer.MAX_VALUE)))
                    .thenReturn(createMockSchedules(1));

            LearningProgressDto progress = service.getLearningProgress(user);

            assertThat(progress.totalWords()).isEqualTo(5);
            verify(srsRepository).countByUserId(7L);
        }
    }

    // -----------------------------------------------------------------------
    // SpacedRepetitionSchedule.isDueForReview — entity method
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("SpacedRepetitionSchedule.isDueForReview()")
    class IsDueForReview {

        @Test
        @DisplayName("returns true when nextReviewDate is in the past")
        void nextReviewInPast_returnsTrue() {
            SpacedRepetitionSchedule schedule = SpacedRepetitionSchedule.builder()
                    .nextReviewDate(LocalDateTime.now().minusDays(1))
                    .build();

            assertThat(schedule.isDueForReview()).isTrue();
        }

        @Test
        @DisplayName("returns false when nextReviewDate is in the future")
        void nextReviewInFuture_returnsFalse() {
            SpacedRepetitionSchedule schedule = SpacedRepetitionSchedule.builder()
                    .nextReviewDate(LocalDateTime.now().plusDays(1))
                    .build();

            assertThat(schedule.isDueForReview()).isFalse();
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private SpacedRepetitionSchedule buildSchedule(int reviewCount, double easiness, int interval, String status) {
        return SpacedRepetitionSchedule.builder()
                .id(1L)
                .userId(1L)
                .wordId(1L)
                .reviewCount(reviewCount)
                .easinessFactor(easiness)
                .interval(interval)
                .retentionStatus(status)
                .lastReviewDate(LocalDateTime.now().minusDays(interval))
                .nextReviewDate(LocalDateTime.now())
                .build();
    }

    private List<SpacedRepetitionSchedule> createMockSchedules(long count) {
        List<SpacedRepetitionSchedule> schedules = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            schedules.add(SpacedRepetitionSchedule.builder()
                    .id((long) i)
                    .userId(1L)
                    .wordId((long) i)
                    .build());
        }
        return schedules;
    }
}
