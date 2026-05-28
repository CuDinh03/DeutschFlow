package com.deutschflow.progress.dto;

import com.deutschflow.progress.entity.LearnerPhaseState;

import java.time.LocalDateTime;

public record PhaseStateResponse(
        String currentPhase,
        LocalDateTime phaseStartedAt,
        int vocabularyMasteredCount,
        int speakingMinutesTotal,
        int grammarAccuracyPercent,
        int sessionsCompleted,
        boolean readyToAdvance,
        LocalDateTime graduatedAt
) {
    public static PhaseStateResponse from(LearnerPhaseState state, boolean readyToAdvance) {
        return new PhaseStateResponse(
                state.getCurrentPhase().name(),
                state.getPhaseStartedAt(),
                state.getVocabularyMasteredCount(),
                state.getSpeakingMinutesTotal(),
                state.getGrammarAccuracyPercent(),
                state.getSessionsCompleted(),
                readyToAdvance,
                state.getGraduatedAt()
        );
    }
}
