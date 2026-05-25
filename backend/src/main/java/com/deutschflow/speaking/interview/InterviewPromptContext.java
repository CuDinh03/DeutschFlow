package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;

import java.util.concurrent.ThreadLocalRandom;

public record InterviewPromptContext(InterviewSessionState state, InterviewTurnPlan plan) {

    public static InterviewPromptContext fallback(SpeakingPersona persona, String position, int messageCount,
                                                  PersonaInterviewRegistry registry) {
        int seed = ThreadLocalRandom.current().nextInt(1000);
        String focus = registry.topicFocusForSession(persona, position, seed);
        InterviewSessionState state = InterviewSessionState.initial(seed, focus);
        int userTurn = messageCount / 2 + 1;
        InterviewPhase phase = InterviewPhase.fromUserTurn(userTurn);
        InterviewTurnPlan plan = new InterviewTurnPlan(
                userTurn, phase, InterviewDirectiveType.STANDARD,
                "Standard-Follow-up.", "Bitte fahren Sie fort.", "fallback", "general",
                8, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
        return new InterviewPromptContext(state, plan);
    }
}
