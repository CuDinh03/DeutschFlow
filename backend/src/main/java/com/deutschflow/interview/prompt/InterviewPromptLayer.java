package com.deutschflow.interview.prompt;

/**
 * A single composable layer in the interview system prompt.
 * Layers are assembled in order by {@link InterviewPromptBuilder}.
 */
public interface InterviewPromptLayer {

    /** Appends this layer's content to the given prompt builder. */
    void appendTo(StringBuilder sb, InterviewPromptContext context);

    /** Human-readable name for debugging and telemetry. */
    String name();

    record InterviewPromptContext(
            String personaCode,
            String personaDisplayName,
            String personaRole,
            String industry,
            String position,
            String experienceLevel,
            String cefrLevel,
            int sessionSeed,
            int userTurn,
            String phaseName,
            String phaseNumber,
            String topicFocus,
            String topicsCovered,
            String directiveType,
            String directiveInstruction,
            String mandatoryQuestion,
            int ackMaxWords,
            String forbiddenPhrases,
            String closingAnswerGuide,
            boolean isClosingTurn,
            String rubricCriteriaJson,
            String rubricWeightJson,
            String promptVariant
    ) {}
}
