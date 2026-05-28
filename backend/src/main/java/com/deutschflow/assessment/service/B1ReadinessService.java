package com.deutschflow.assessment.service;

import com.deutschflow.assessment.dto.B1ReadinessResponse;
import com.deutschflow.assessment.entity.B1AssessmentState;
import com.deutschflow.assessment.repository.B1AssessmentStateRepository;
import com.deutschflow.progress.entity.LearnerPhaseState;
import com.deutschflow.progress.entity.PhaseType;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class B1ReadinessService {

    // B1 graduation thresholds (from spec section 4.4)
    static final int VOCAB_THRESHOLD        = 700;
    static final int SPEAKING_MINUTES_MIN   = 1500; // 25 min/session × ~60 sessions
    static final int GRAMMAR_ACCURACY_MIN   = 85;

    private final B1AssessmentStateRepository assessmentRepository;
    private final PhaseEngineService phaseEngineService;

    @Transactional
    public B1ReadinessResponse evaluate(User user) {
        LearnerPhaseState phaseState = phaseEngineService.getOrCreatePhaseState(user);
        B1AssessmentState assessment = assessmentRepository.findByUserId(user.getId())
                .orElseGet(() -> createInitialAssessment(user));

        boolean vocabOk       = phaseState.getVocabularyMasteredCount() >= VOCAB_THRESHOLD;
        boolean speakingOk    = phaseState.getSpeakingMinutesTotal() >= SPEAKING_MINUTES_MIN;
        boolean grammarOk     = phaseState.getGrammarAccuracyPercent() >= GRAMMAR_ACCURACY_MIN;
        boolean confidenceOk  = phaseState.getCurrentPhase() == PhaseType.FLUENCY
                || phaseState.getCurrentPhase() == PhaseType.GRADUATED;

        assessment.setVocabularyCheckPassed(vocabOk);
        assessment.setSpeakingCheckPassed(speakingOk);
        assessment.setGrammarCheckPassed(grammarOk);
        assessment.setConfidenceCheckPassed(confidenceOk);
        assessment.setLastAssessmentAt(LocalDateTime.now());

        int score = computeScore(phaseState, assessment.isMockExamPassed());
        assessment.setReadinessScore(score);

        if (assessment.isFullyReady() && assessment.getGraduationConfirmedAt() == null) {
            assessment.setGraduationConfirmedAt(LocalDateTime.now());
            log.info("User {} confirmed B1 graduation", user.getId());
        }

        assessmentRepository.save(assessment);
        return B1ReadinessResponse.from(assessment);
    }

    @Transactional(readOnly = true)
    public B1ReadinessResponse getReadiness(User user) {
        return assessmentRepository.findByUserId(user.getId())
                .map(B1ReadinessResponse::from)
                .orElseGet(() -> B1ReadinessResponse.from(createInitialAssessment(user)));
    }

    @Transactional
    public B1ReadinessResponse recordMockExamResult(User user, boolean passed) {
        B1AssessmentState assessment = assessmentRepository.findByUserId(user.getId())
                .orElseGet(() -> createInitialAssessment(user));
        assessment.setMockExamPassed(passed);
        assessment.setLastAssessmentAt(LocalDateTime.now());
        assessmentRepository.save(assessment);
        return evaluate(user);
    }

    private int computeScore(LearnerPhaseState phaseState, boolean mockExamPassed) {
        int score = 0;
        score += Math.min(20, (phaseState.getVocabularyMasteredCount() * 20) / VOCAB_THRESHOLD);
        score += Math.min(20, (phaseState.getSpeakingMinutesTotal() * 20) / SPEAKING_MINUTES_MIN);
        score += Math.min(20, (phaseState.getGrammarAccuracyPercent() * 20) / GRAMMAR_ACCURACY_MIN);
        if (phaseState.getCurrentPhase() == PhaseType.FLUENCY
                || phaseState.getCurrentPhase() == PhaseType.GRADUATED) {
            score += 20;
        }
        if (mockExamPassed) {
            score += 20;
        }
        return Math.min(100, score);
    }

    private B1AssessmentState createInitialAssessment(User user) {
        var state = B1AssessmentState.builder()
                .user(user)
                .build();
        return assessmentRepository.save(state);
    }
}
