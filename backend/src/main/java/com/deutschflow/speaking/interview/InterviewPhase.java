package com.deutschflow.speaking.interview;

/**
 * Interview flow phases (aligned with turn bands in {@link InterviewOrchestrator}).
 */
public enum InterviewPhase {
    INTRO(1),
    ICE_BREAKER(2),
    HARD_SKILLS(3),
    STAR_SOFT(4),
    CLOSING(5);

    private final int number;

    InterviewPhase(int number) {
        this.number = number;
    }

    public int number() {
        return number;
    }

    public static InterviewPhase fromUserTurn(int userTurn) {
        if (userTurn <= 1) {
            return INTRO;
        }
        if (userTurn <= 3) {
            return ICE_BREAKER;
        }
        if (userTurn <= 9) {
            return HARD_SKILLS;
        }
        if (userTurn <= 12) {
            return STAR_SOFT;
        }
        return CLOSING;
    }
}
