package com.deutschflow.assessment.service;

import com.deutschflow.assessment.entity.B1AssessmentState;
import com.deutschflow.assessment.repository.B1AssessmentStateRepository;
import com.deutschflow.progress.entity.LearnerPhaseState;
import com.deutschflow.progress.entity.PhaseType;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.user.entity.User;
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
class B1ReadinessServiceTest {

    @Mock
    B1AssessmentStateRepository assessmentRepository;

    @Mock
    PhaseEngineService phaseEngineService;

    @InjectMocks
    B1ReadinessService b1ReadinessService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).email("test@test.com").build();
    }

    @Test
    @DisplayName("all checks pass when learner meets B1 criteria")
    void evaluate_allCriteriaMet_allChecksPassed() {
        var phaseState = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FLUENCY)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(B1ReadinessService.VOCAB_THRESHOLD)
                .speakingMinutesTotal(B1ReadinessService.SPEAKING_MINUTES_MIN)
                .grammarAccuracyPercent(B1ReadinessService.GRAMMAR_ACCURACY_MIN)
                .build();
        var assessment = B1AssessmentState.builder().user(user).mockExamPassed(true).build();

        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(assessmentRepository.findByUserId(1L)).thenReturn(Optional.of(assessment));
        when(assessmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = b1ReadinessService.evaluate(user);

        assertThat(result.vocabularyCheckPassed()).isTrue();
        assertThat(result.speakingCheckPassed()).isTrue();
        assertThat(result.grammarCheckPassed()).isTrue();
        assertThat(result.confidenceCheckPassed()).isTrue();
        assertThat(result.mockExamPassed()).isTrue();
        assertThat(result.fullyReady()).isTrue();
    }

    @Test
    @DisplayName("readiness score is 0 for a brand-new learner")
    void evaluate_newLearner_scoreIsLow() {
        var phaseState = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(0)
                .speakingMinutesTotal(0)
                .grammarAccuracyPercent(0)
                .build();

        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(assessmentRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(assessmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = b1ReadinessService.evaluate(user);

        assertThat(result.fullyReady()).isFalse();
        assertThat(result.readinessScore()).isZero();
    }

    @Test
    @DisplayName("graduation confirmed when all checks pass")
    void evaluate_allChecksPassed_graduationConfirmed() {
        var phaseState = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FLUENCY)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(B1ReadinessService.VOCAB_THRESHOLD)
                .speakingMinutesTotal(B1ReadinessService.SPEAKING_MINUTES_MIN)
                .grammarAccuracyPercent(B1ReadinessService.GRAMMAR_ACCURACY_MIN)
                .build();
        var assessment = B1AssessmentState.builder()
                .user(user)
                .mockExamPassed(true)
                .build();

        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(assessmentRepository.findByUserId(1L)).thenReturn(Optional.of(assessment));
        when(assessmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = b1ReadinessService.evaluate(user);

        assertThat(result.graduationConfirmedAt()).isNotNull();
    }

    @Test
    @DisplayName("passing mock exam updates assessment and re-evaluates")
    void recordMockExamResult_passed_updatesAssessment() {
        var phaseState = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(0)
                .speakingMinutesTotal(0)
                .grammarAccuracyPercent(0)
                .build();
        var assessment = B1AssessmentState.builder().user(user).build();

        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(assessmentRepository.findByUserId(1L)).thenReturn(Optional.of(assessment));
        when(assessmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = b1ReadinessService.recordMockExamResult(user, true);

        assertThat(result.mockExamPassed()).isTrue();
    }

    @Test
    @DisplayName("failing mock exam does not grant graduation")
    void recordMockExamResult_failed_doesNotGraduate() {
        var phaseState = LearnerPhaseState.builder()
                .user(user)
                .currentPhase(PhaseType.FLUENCY)
                .phaseStartedAt(LocalDateTime.now())
                .vocabularyMasteredCount(B1ReadinessService.VOCAB_THRESHOLD)
                .speakingMinutesTotal(B1ReadinessService.SPEAKING_MINUTES_MIN)
                .grammarAccuracyPercent(B1ReadinessService.GRAMMAR_ACCURACY_MIN)
                .build();
        var assessment = B1AssessmentState.builder().user(user).mockExamPassed(false).build();

        when(phaseEngineService.getOrCreatePhaseState(user)).thenReturn(phaseState);
        when(assessmentRepository.findByUserId(1L)).thenReturn(Optional.of(assessment));
        when(assessmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = b1ReadinessService.recordMockExamResult(user, false);

        assertThat(result.fullyReady()).isFalse();
        assertThat(result.graduationConfirmedAt()).isNull();
    }
}
