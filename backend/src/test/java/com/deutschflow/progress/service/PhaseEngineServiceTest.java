package com.deutschflow.progress.service;

import com.deutschflow.gamification.repository.UserXpEventRepository;
import com.deutschflow.progress.entity.LearnerPhaseState;
import com.deutschflow.progress.entity.PhaseType;
import com.deutschflow.progress.repository.LearnerPhaseStateRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.srs.repository.VocabReviewRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PhaseEngineServiceTest {

    @Mock
    LearnerPhaseStateRepository phaseStateRepository;
    @Mock
    VocabReviewRepository vocabReviewRepository;
    @Mock
    UserXpEventRepository xpEventRepository;
    @Mock
    AiSpeakingSessionRepository speakingSessionRepository;
    @Mock
    UserRepository userRepository;

    @InjectMocks
    PhaseEngineService phaseEngineService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).email("test@test.com").build();
    }

    @Test
    @DisplayName("new learner starts in FOUNDATION")
    void getOrCreate_newLearner_startsInFoundation() {
        when(phaseStateRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(phaseStateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var state = phaseEngineService.getOrCreatePhaseState(user);

        assertThat(state.getCurrentPhase()).isEqualTo(PhaseType.FOUNDATION);
    }

    @Test
    @DisplayName("existing learner returns stored phase")
    void getOrCreate_existingLearner_returnsStoredPhase() {
        var existing = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.PRODUCTION)
                .phaseStartedAt(LocalDateTime.now())
                .build();
        when(phaseStateRepository.findByUserId(1L)).thenReturn(Optional.of(existing));

        var state = phaseEngineService.getOrCreatePhaseState(user);

        assertThat(state.getCurrentPhase()).isEqualTo(PhaseType.PRODUCTION);
        verify(phaseStateRepository, never()).save(any());
    }

    @Test
    @DisplayName("FOUNDATION not ready to advance when below thresholds")
    void isReadyToAdvance_foundationBelowThresholds_returnsFalse() {
        var state = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(10)
                .sessionsCompleted(2)
                .build();

        assertThat(phaseEngineService.isReadyToAdvance(state)).isFalse();
    }

    @Test
    @DisplayName("FOUNDATION advances to PRODUCTION when thresholds met")
    void updateProgress_foundationThresholdsMet_advancesToProduction() {
        var state = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(0)
                .sessionsCompleted(0)
                .build();
        when(phaseStateRepository.findByUserId(1L)).thenReturn(Optional.of(state));
        when(phaseStateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = phaseEngineService.updateProgress(
                user,
                PhaseEngineService.FOUNDATION_VOCAB_THRESHOLD,
                0,
                0,
                PhaseEngineService.FOUNDATION_SESSIONS_THRESHOLD
        );

        assertThat(result.getCurrentPhase()).isEqualTo(PhaseType.PRODUCTION);
        assertThat(result.getFoundationCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("PRODUCTION advances to FLUENCY when thresholds met")
    void updateProgress_productionThresholdsMet_advancesToFluency() {
        var state = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.PRODUCTION)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(0)
                .sessionsCompleted(0)
                .build();
        when(phaseStateRepository.findByUserId(1L)).thenReturn(Optional.of(state));
        when(phaseStateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = phaseEngineService.updateProgress(
                user,
                PhaseEngineService.PRODUCTION_VOCAB_THRESHOLD,
                0,
                0,
                PhaseEngineService.PRODUCTION_SESSIONS_THRESHOLD
        );

        assertThat(result.getCurrentPhase()).isEqualTo(PhaseType.FLUENCY);
        assertThat(result.getProductionCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("FOUNDATION content always accessible")
    void canAccessContent_foundationContent_alwaysAccessible() {
        var foundationState = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION).phaseStartedAt(LocalDateTime.now()).build();
        var productionState = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.PRODUCTION).phaseStartedAt(LocalDateTime.now()).build();

        assertThat(phaseEngineService.canAccessContent(foundationState, "FOUNDATION")).isTrue();
        assertThat(phaseEngineService.canAccessContent(productionState, "FOUNDATION")).isTrue();
    }

    @Test
    @DisplayName("FLUENCY content gated until FLUENCY phase")
    void canAccessContent_fluencyContentGated_untilFluencyPhase() {
        var foundationState = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION).phaseStartedAt(LocalDateTime.now()).build();
        var fluencyState = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FLUENCY).phaseStartedAt(LocalDateTime.now()).build();

        assertThat(phaseEngineService.canAccessContent(foundationState, "FLUENCY")).isFalse();
        assertThat(phaseEngineService.canAccessContent(fluencyState, "FLUENCY")).isTrue();
    }

    @Test
    @DisplayName("FOUNDATION learner gets beginner next actions")
    void getNextActions_foundationPhase_returnsBeginnerActions() {
        var state = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION).phaseStartedAt(LocalDateTime.now()).build();

        var actions = phaseEngineService.getNextActions(state);

        assertThat(actions).contains("vocabulary_review", "beginner_speaking", "srs_review");
    }

    @Test
    @DisplayName("FLUENCY learner gets B1 exam next actions")
    void getNextActions_fluencyPhase_includesMockB1Exam() {
        var state = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FLUENCY).phaseStartedAt(LocalDateTime.now()).build();

        var actions = phaseEngineService.getNextActions(state);

        assertThat(actions).contains("mock_b1_exam");
    }

    @Test
    @DisplayName("recompute derives real signals and advances FOUNDATION→PRODUCTION when met")
    void recompute_realSignalsMeetFoundationThreshold_advancesToProduction() {
        var state = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION).phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(0).sessionsCompleted(0).build();
        when(phaseStateRepository.findByUserId(1L)).thenReturn(Optional.of(state));
        when(phaseStateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(vocabReviewRepository.countMastered(1L))
                .thenReturn((long) PhaseEngineService.FOUNDATION_VOCAB_THRESHOLD);
        when(xpEventRepository.countSessionCompleteByUserId(1L))
                .thenReturn((long) PhaseEngineService.FOUNDATION_SESSIONS_THRESHOLD);
        when(xpEventRepository.countSatelliteCompleteByUserId(1L)).thenReturn(0L);
        when(speakingSessionRepository.countEndedByUserId(1L)).thenReturn(0L);
        when(speakingSessionRepository.avgEndedScoreByUserId(1L)).thenReturn(0.0);

        var result = phaseEngineService.recompute(user);

        assertThat(result.getCurrentPhase()).isEqualTo(PhaseType.PRODUCTION);
        assertThat(result.getVocabularyMasteredCount())
                .isEqualTo(PhaseEngineService.FOUNDATION_VOCAB_THRESHOLD);
        assertThat(result.getSessionsCompleted())
                .isEqualTo(PhaseEngineService.FOUNDATION_SESSIONS_THRESHOLD);
    }

    @Test
    @DisplayName("recompute stays in FOUNDATION when real signals are below thresholds")
    void recompute_realSignalsBelowThreshold_staysFoundation() {
        var state = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION).phaseStartedAt(LocalDateTime.now()).build();
        when(phaseStateRepository.findByUserId(1L)).thenReturn(Optional.of(state));
        when(phaseStateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(vocabReviewRepository.countMastered(1L)).thenReturn(10L);
        when(xpEventRepository.countSessionCompleteByUserId(1L)).thenReturn(2L);
        when(xpEventRepository.countSatelliteCompleteByUserId(1L)).thenReturn(0L);
        when(speakingSessionRepository.countEndedByUserId(1L)).thenReturn(1L);
        when(speakingSessionRepository.avgEndedScoreByUserId(1L)).thenReturn(50.0);

        var result = phaseEngineService.recompute(user);

        assertThat(result.getCurrentPhase()).isEqualTo(PhaseType.FOUNDATION);
    }

    @Test
    @DisplayName("recompute(userId) loads the user and recomputes; null when user missing")
    void recompute_byUserId_loadsUserOrReturnsNull() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        var state = LearnerPhaseState.builder()
                .user(user).currentPhase(PhaseType.FOUNDATION).phaseStartedAt(LocalDateTime.now()).build();
        when(phaseStateRepository.findByUserId(1L)).thenReturn(Optional.of(state));
        when(phaseStateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(vocabReviewRepository.countMastered(1L)).thenReturn(0L);
        when(xpEventRepository.countSessionCompleteByUserId(1L)).thenReturn(0L);
        when(xpEventRepository.countSatelliteCompleteByUserId(1L)).thenReturn(0L);
        when(speakingSessionRepository.countEndedByUserId(1L)).thenReturn(0L);
        when(speakingSessionRepository.avgEndedScoreByUserId(1L)).thenReturn(0.0);

        var result = phaseEngineService.recompute(1L);

        assertThat(result).isNotNull();
        assertThat(result.getCurrentPhase()).isEqualTo(PhaseType.FOUNDATION);

        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThat(phaseEngineService.recompute(99L)).isNull();
    }
}
