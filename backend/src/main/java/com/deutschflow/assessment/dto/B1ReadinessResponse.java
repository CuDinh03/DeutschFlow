package com.deutschflow.assessment.dto;

import com.deutschflow.assessment.entity.B1AssessmentState;

import java.time.LocalDateTime;

public record B1ReadinessResponse(
        boolean vocabularyCheckPassed,
        boolean speakingCheckPassed,
        boolean grammarCheckPassed,
        boolean confidenceCheckPassed,
        boolean mockExamPassed,
        int readinessScore,
        boolean fullyReady,
        LocalDateTime lastAssessmentAt,
        LocalDateTime graduationConfirmedAt
) {
    public static B1ReadinessResponse from(B1AssessmentState state) {
        return new B1ReadinessResponse(
                state.isVocabularyCheckPassed(),
                state.isSpeakingCheckPassed(),
                state.isGrammarCheckPassed(),
                state.isConfidenceCheckPassed(),
                state.isMockExamPassed(),
                state.getReadinessScore(),
                state.isFullyReady(),
                state.getLastAssessmentAt(),
                state.getGraduationConfirmedAt()
        );
    }

    public static B1ReadinessResponse empty() {
        return new B1ReadinessResponse(false, false, false, false, false, 0, false, null, null);
    }
}
