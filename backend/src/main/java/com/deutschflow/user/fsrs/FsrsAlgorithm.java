package com.deutschflow.user.fsrs;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * FSRS (Free Spaced Repetition Scheduler) v4.5 Algorithm Implementation.
 * Replaces the legacy SM-2 algorithm.
 */
public class FsrsAlgorithm {

    // FSRS States
    public static final int STATE_NEW = 0;
    public static final int STATE_LEARNING = 1;
    public static final int STATE_REVIEW = 2;
    public static final int STATE_RELEARNING = 3;

    // FSRS Ratings
    public static final int RATING_AGAIN = 1;
    public static final int RATING_HARD = 2;
    public static final int RATING_GOOD = 3;
    public static final int RATING_EASY = 4;

    // Default parameters (weights) optimized for language learning
    private static final double[] w = {
        0.40255, 1.18385, 3.173, 15.69105, // Initial stability [w0, w1, w2, w3]
        7.1949,                            // Initial difficulty [w4]
        0.5345,                            // w5
        1.4604,                            // w6
        0.0046,                            // w7
        1.54575,                           // w8
        0.1192,                            // w9
        1.01925,                           // w10
        1.9395,                            // w11
        0.11,                              // w12
        0.29605,                           // w13
        2.2698,                            // w14
        0.2315,                            // w15
        2.9898                             // w16
    };

    public record Card(
            int state,
            double difficulty,
            double stability,
            int lapses,
            int reps,
            LocalDateTime lastReviewedAt
    ) {}

    public record SchedulingResult(
            int newState,
            double newDifficulty,
            double newStability,
            int newLapses,
            int newReps,
            int intervalDays
    ) {}

    public static SchedulingResult calculate(Card card, int rating, LocalDateTime now) {
        int state = card.state();
        double d = card.difficulty();
        double s = card.stability();
        int lapses = card.lapses();
        int reps = card.reps();

        double nextS = s;
        double nextD = d;
        int nextState = state;
        int nextLapses = lapses;
        int interval = 0;

        // Calculate retrievability (if not new)
        double r = 1.0;
        if (state != STATE_NEW && card.lastReviewedAt() != null) {
            long daysElapsed = ChronoUnit.DAYS.between(card.lastReviewedAt(), now);
            if (daysElapsed < 0) daysElapsed = 0;
            if (s > 0) {
                r = Math.pow(1.0 + (daysElapsed / (9.0 * s)), -1.0);
            }
        }

        if (state == STATE_NEW) {
            nextD = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
            nextS = w[rating - 1]; // w[0] to w[3]
            nextState = (rating == RATING_AGAIN) ? STATE_LEARNING : STATE_REVIEW;
            interval = (rating == RATING_EASY) ? (int) Math.round(nextS) : 0;
            
        } else if (state == STATE_LEARNING || state == STATE_RELEARNING) {
            nextD = nextDifficulty(d, rating);
            nextS = nextStabilityForLearning(s, nextD, rating);
            
            if (rating == RATING_AGAIN) {
                nextState = state;
                interval = 0;
            } else {
                nextState = STATE_REVIEW;
                interval = Math.max(1, (int) Math.round(nextS));
            }
            
        } else if (state == STATE_REVIEW) {
            nextD = nextDifficulty(d, rating);
            
            if (rating == RATING_AGAIN) {
                nextLapses++;
                nextS = nextForgetStability(d, s, r);
                nextState = STATE_RELEARNING;
                interval = 0;
            } else {
                nextS = nextRecallStability(d, s, r, rating);
                nextState = STATE_REVIEW;
                interval = Math.max(1, (int) Math.round(nextS));
            }
        }

        // Bound difficulty
        nextD = Math.min(Math.max(nextD, 1.0), 10.0);
        
        return new SchedulingResult(nextState, nextD, nextS, nextLapses, reps + 1, interval);
    }

    private static double nextDifficulty(double d, int rating) {
        double nextD = d - w[6] * (rating - 3);
        double meanD = w[4];
        return w[7] * meanD + (1 - w[7]) * nextD;
    }

    private static double nextStabilityForLearning(double s, double d, int rating) {
        // Simplified fallback for learning states if initial S wasn't set correctly
        double sFixed = s > 0 ? s : w[rating - 1]; 
        return sFixed * Math.exp(w[16] * (rating - 3));
    }

    private static double nextRecallStability(double d, double s, double r, int rating) {
        double hardPenalty = (rating == RATING_HARD) ? w[15] : 1.0;
        double easyBonus = (rating == RATING_EASY) ? w[16] : 1.0;
        double inc = Math.exp(w[8]) *
                (11.0 - d) *
                Math.pow(s, -w[9]) *
                (Math.exp((1 - r) * w[10]) - 1);
        return s * (1.0 + inc * hardPenalty * easyBonus);
    }

    private static double nextForgetStability(double d, double s, double r) {
        double ret = w[11] *
                Math.pow(d, -w[12]) *
                (Math.pow(s + 1, w[13]) - 1) *
                Math.exp((1 - r) * w[14]);
        return Math.max(0.1, ret);
    }
}
