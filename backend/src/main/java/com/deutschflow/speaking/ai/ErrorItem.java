package com.deutschflow.speaking.ai;

/**
 * One structured error detected in the learner's utterance (from AI JSON {@code errors[]}).
 */
public record ErrorItem(
        String errorCode,
        String severity,
        Double confidence,
        String wrongSpan,
        String correctedSpan,
        String ruleViShort,
        String exampleCorrectDe
) {}
