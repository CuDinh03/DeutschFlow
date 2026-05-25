package com.deutschflow.speaking.interview;

public record InterviewAnswerAnalysis(
        boolean hypotheticalHeavy,
        boolean bulletListWithoutConcrete,
        boolean monologue,
        boolean missingStar,
        boolean roleScopeCreep,
        boolean concreteExample,
        boolean weakAnswer
) {}
