package com.deutschflow.speaking.interview;

import java.util.List;

public record InterviewTurnPlan(
        int userTurn,
        InterviewPhase phase,
        InterviewDirectiveType directiveType,
        String directiveInstruction,
        String mandatoryQuestionDe,
        String questionId,
        String topicKey,
        int ackMaxWords,
        List<String> forbiddenPhrases,
        String closingAnswerGuide,
        boolean userAskedClosingQuestions
) {
    public static final List<String> DEFAULT_FORBIDDEN = List.of(
            "sehr gut", "sehr professionell", "sehr einfühlsam", "sehr umfassend",
            "sehr gründlich", "sehr strukturiert", "beeindruckend", "ausgezeichnet"
    );

    public InterviewDirectiveType directive() { return directiveType; }
    public String mandatoryQuestion() { return mandatoryQuestionDe; }
}
