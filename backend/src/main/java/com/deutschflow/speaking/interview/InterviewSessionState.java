package com.deutschflow.speaking.interview;

import java.util.ArrayList;
import java.util.List;

/**
 * Serializable interview orchestration state stored on {@link com.deutschflow.speaking.entity.AiSpeakingSession}.
 */
public class InterviewSessionState {

    private int seed;
    private int phase = 1;
    private int userTurn;
    private int challengeCount;
    private int weakAnswerStreak;
    private int praiseStreakBlocked;
    private boolean concreteExampleGiven;
    /** Whether the previous turn satisfied its phase goal (LLM phase_goal_met, else deterministic). */
    private boolean lastPhaseGoalMet;
    private List<String> topicsCovered = new ArrayList<>();
    private List<String> askedQuestionIds = new ArrayList<>();
    private String lastDirectiveType;
    private String sessionTopicFocus;

    public static InterviewSessionState initial(int seed, String sessionTopicFocus) {
        InterviewSessionState s = new InterviewSessionState();
        s.seed = seed;
        s.sessionTopicFocus = sessionTopicFocus;
        return s;
    }

    public int getSeed() {
        return seed;
    }

    public void setSeed(int seed) {
        this.seed = seed;
    }

    public int getPhase() {
        return phase;
    }

    public void setPhase(int phase) {
        this.phase = phase;
    }

    public int getUserTurn() {
        return userTurn;
    }

    public void setUserTurn(int userTurn) {
        this.userTurn = userTurn;
    }

    public int getChallengeCount() {
        return challengeCount;
    }

    public int getWeakAnswerStreak() {
        return weakAnswerStreak;
    }

    public boolean isConcreteExampleGiven() {
        return concreteExampleGiven;
    }

    public boolean isLastPhaseGoalMet() {
        return lastPhaseGoalMet;
    }

    public void setLastPhaseGoalMet(boolean lastPhaseGoalMet) {
        this.lastPhaseGoalMet = lastPhaseGoalMet;
    }

    public List<String> getTopicsCovered() {
        return topicsCovered;
    }

    public List<String> getAskedQuestionIds() {
        return askedQuestionIds;
    }

    public String getLastDirectiveType() {
        return lastDirectiveType;
    }

    public String getSessionTopicFocus() {
        return sessionTopicFocus;
    }

    public void applyAfterTurn(InterviewTurnPlan plan, InterviewAnswerAnalysis analysis) {
        userTurn = plan.userTurn();
        phase = plan.phase().number();
        lastDirectiveType = plan.directiveType().name();
        if (plan.questionId() != null && !plan.questionId().isBlank()
                && !askedQuestionIds.contains(plan.questionId())) {
            askedQuestionIds.add(plan.questionId());
        }
        if (plan.topicKey() != null && !plan.topicKey().isBlank()
                && !topicsCovered.contains(plan.topicKey())) {
            topicsCovered.add(plan.topicKey());
        }
        if (plan.directiveType() == InterviewDirectiveType.CHALLENGE_EXAMPLE
                || plan.directiveType() == InterviewDirectiveType.PROBE_SPECIFIC
                || plan.directiveType() == InterviewDirectiveType.STAR_PROMPT) {
            challengeCount++;
        }
        if (analysis.weakAnswer()) {
            weakAnswerStreak++;
        } else {
            weakAnswerStreak = 0;
        }
        if (analysis.concreteExample()) {
            concreteExampleGiven = true;
        }
    }

    /** Metrics blob for evaluation prompt. */
    public String metricsSummary() {
        return "userTurn=" + userTurn
                + ", phase=" + phase
                + ", challenges=" + challengeCount
                + ", concreteExample=" + concreteExampleGiven
                + ", weakStreak=" + weakAnswerStreak
                + ", topics=" + String.join(",", topicsCovered)
                + ", topicFocus=" + (sessionTopicFocus == null ? "" : sessionTopicFocus);
    }
}
