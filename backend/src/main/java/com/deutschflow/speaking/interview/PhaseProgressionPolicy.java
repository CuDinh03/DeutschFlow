package com.deutschflow.speaking.interview;

/**
 * Content-aware interview phase progression — "phase stretches by quality, with a ceiling".
 *
 * <p>The turn count is the <b>ceiling</b> ({@link InterviewPhase#fromUserTurn}) that eventually
 * forces a struggling candidate forward, so an interview never stalls. Answer quality can advance
 * a strong candidate <b>earlier</b> than the turn bands. Progression is monotonic (never regresses)
 * and never goes past {@link InterviewPhase#CLOSING}.
 *
 * <p>Replaces the previous pure {@code fromUserTurn(userTurn)} decision (every candidate marched
 * through the same fixed turn bands regardless of answer depth — see design doc §13.2).
 */
public final class PhaseProgressionPolicy {

    private PhaseProgressionPolicy() {}

    /**
     * Resolve the phase for the upcoming turn.
     *
     * @param currentPhaseNumber phase recorded after the previous turn ({@code state.getPhase()})
     * @param userTurn           1-based index of the current candidate turn
     * @param currentGoalMet     whether the current phase's objective is satisfied (LLM
     *                           {@code phase_goal_met}, falling back to {@link #deterministicGoalMet})
     */
    /** Đợt E3 (10/08): STAR là tầng đánh giá hành vi quan trọng nhất — không được rời trước 2 lượt. */
    static final int MIN_STAR_TURNS = 2;

    public static InterviewPhase resolve(int currentPhaseNumber, int userTurn, boolean currentGoalMet) {
        return resolve(currentPhaseNumber, userTurn, currentGoalMet, MIN_STAR_TURNS);
    }

    /**
     * @param starTurnsSoFar số lượt đã ở STAR_SOFT ({@code state.getStarTurns()}) — dưới
     *                       {@link #MIN_STAR_TURNS} thì goalMet KHÔNG được đẩy sang CLOSING;
     *                       trần theo lượt (ceiling) vẫn thắng để phỏng vấn không kẹt vô hạn.
     */
    public static InterviewPhase resolve(int currentPhaseNumber, int userTurn, boolean currentGoalMet,
                                         int starTurnsSoFar) {
        InterviewPhase ceiling = InterviewPhase.fromUserTurn(userTurn);
        int current = clampPhaseNumber(currentPhaseNumber);
        int target = Math.max(current, ceiling.number());
        if (currentGoalMet && current < InterviewPhase.CLOSING.number()) {
            target = Math.max(target, current + 1);   // strong candidate advances early
        }
        if (current == InterviewPhase.STAR_SOFT.number()
                && starTurnsSoFar < MIN_STAR_TURNS
                && ceiling.number() < InterviewPhase.CLOSING.number()) {
            target = Math.min(target, InterviewPhase.STAR_SOFT.number());
        }
        target = Math.min(target, InterviewPhase.CLOSING.number());
        return fromNumber(target);
    }

    /**
     * Conservative deterministic fallback for "did the candidate satisfy this phase's goal".
     * Short phases (INTRO/ICE) and the terminal CLOSING return {@code false} so the turn ceiling
     * drives them; only the substantive phases can be early-advanced without an LLM signal.
     */
    public static boolean deterministicGoalMet(InterviewPhase phase, InterviewSessionState state) {
        if (phase == null || state == null) {
            return false;
        }
        return switch (phase) {
            case INTRO, ICE_BREAKER, CLOSING -> false;
            case HARD_SKILLS -> state.getChallengeCount() >= 2 && state.isConcreteExampleGiven();
            case STAR_SOFT -> state.isConcreteExampleGiven();
        };
    }

    public static InterviewPhase fromNumber(int n) {
        for (InterviewPhase p : InterviewPhase.values()) {
            if (p.number() == n) {
                return p;
            }
        }
        return n < InterviewPhase.INTRO.number() ? InterviewPhase.INTRO : InterviewPhase.CLOSING;
    }

    private static int clampPhaseNumber(int n) {
        return Math.max(InterviewPhase.INTRO.number(), Math.min(InterviewPhase.CLOSING.number(), n));
    }
}
