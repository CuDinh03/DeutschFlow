package com.deutschflow.srs.service;

import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.entity.VocabReviewSchedule.FsrsState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.OffsetDateTime;

/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler) implementation.
 *
 * <h3>Rating scale (replaces SM-2 quality 0-5):</h3>
 * <ul>
 *   <li>1 = Again  — completely forgot, reset card</li>
 *   <li>2 = Hard   — remembered with significant effort</li>
 *   <li>3 = Good   — remembered with some effort (normal)</li>
 *   <li>4 = Easy   — remembered effortlessly</li>
 * </ul>
 *
 * <h3>Compatibility with existing SM-2 quality field:</h3>
 * The frontend still sends {@code quality} (0-5). {@link #mapSm2ToFsrs(int)} converts it:
 * <pre>
 *   quality 0-1 → Again(1)
 *   quality 2   → Hard(2)
 *   quality 3-4 → Good(3)
 *   quality 5   → Easy(4)
 * </pre>
 *
 * <h3>FSRS-4.5 core formulas:</h3>
 * <pre>
 *   R(t) = (1 + t / (9 × S))^(-1)              // retrievability at time t
 *   New_S(pass) = S × e^(w17 × (11−D) × S^−w18 × (e^(w19×(1−R)) − 1))
 *   New_S(fail) = w11 × D^−w12 × ((S+1)^w13 − 1) × e^(w14 × (1−R))
 *   New_D       = D − w6 × (rating − 3)
 *   Interval    = S × 9 × (1/targetR − 1)       // targetR = 0.9
 * </pre>
 *
 * <h3>Per-user weights:</h3>
 * The default weights are the published FSRS-4.5 reference weights optimized on
 * the open Anki dataset (2023). When {@link FsrsWeightOptimizerService} has
 * accumulated enough reviews for a user, it persists a personalised weight vector
 * to {@code user_learning_profiles.fsrs_weights_json}. {@link SrsService} resolves
 * those weights via {@link FsrsWeightProvider} and passes them to the weighted
 * overloads here; callers without per-user weights fall back to {@link #defaultWeights()}.
 *
 * @see <a href="https://github.com/open-spaced-repetition/fsrs4anki">FSRS4Anki</a>
 */
@Slf4j
@Service
public class FsrsService {

    // ─── FSRS-4.5 reference weights (w0 – w19) ───────────────────────────────
    // Source: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

    private static final double[] DEFAULT_WEIGHTS = {
        /*w0*/  0.4072,  /*w1*/  1.1829,  /*w2*/  3.1262,  /*w3*/  15.4722,
        /*w4*/  7.2102,  /*w5*/  0.5316,  /*w6*/  1.0651,  /*w7*/  0.0589,
        /*w8*/  1.5330,  /*w9*/  0.1544,  /*w10*/ 1.0042,  /*w11*/ 1.9395,
        /*w12*/ 0.1100,  /*w13*/ 0.2900,  /*w14*/ 2.2700,  /*w15*/ 2.9898,
        /*w16*/ 0.5100,  /*w17*/ 2.8798,  /*w18*/ 0.0714,  /*w19*/ 0.4676
    };

    /** Number of weights a valid FSRS-4.5 weight vector must contain. */
    public static final int WEIGHT_COUNT = 20;

    // Target retrievability: schedule interval so user remembers with 90% probability
    private static final double TARGET_RETRIEVABILITY = 0.9;

    // D constraints: 1.0 (easy) to 10.0 (hard)
    private static final double D_MIN = 1.0;
    private static final double D_MAX = 10.0;

    // Minimum stability floor (days)
    private static final double S_MIN = 0.1;

    private static final MathContext MC = MathContext.DECIMAL128;
    private static final RoundingMode RM = RoundingMode.HALF_UP;

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns a defensive copy of the global FSRS-4.5 reference weights.
     * Used as the fallback when a user has no personalised weight vector.
     */
    public double[] defaultWeights() {
        return DEFAULT_WEIGHTS.clone();
    }

    /**
     * Maps SM-2 quality (0-5) to FSRS-4.5 rating (1-4).
     * Call this when upgrading an SM-2 card on first FSRS review.
     */
    public int mapSm2ToFsrs(int sm2Quality) {
        return switch (sm2Quality) {
            case 0, 1 -> 1; // Again
            case 2    -> 2; // Hard
            case 3, 4 -> 3; // Good
            case 5    -> 4; // Easy
            default   -> 3; // Good (safe default)
        };
    }

    /**
     * Initializes FSRS parameters for a brand-new card (first review) using the
     * global reference weights.
     */
    public void initializeCard(VocabReviewSchedule card, int rating) {
        initializeCard(card, rating, DEFAULT_WEIGHTS);
    }

    /**
     * Initializes FSRS parameters for a brand-new card (first review).
     * Applies the "initial stability" formula from FSRS-4.5 spec.
     *
     * @param card    the card to initialize (mutates in-place)
     * @param rating  FSRS rating 1-4
     * @param weights per-user (or global) FSRS-4.5 weight vector
     */
    public void initializeCard(VocabReviewSchedule card, int rating, double[] weights) {
        double[] w = safeWeights(weights);
        int r = clampRating(rating);

        // Initial stability: w[r-1] maps rating to stability in days
        double s0 = w[r - 1]; // w0=Again, w1=Hard, w2=Good, w3=Easy

        // Initial difficulty: D0 = w4 − (r−3) × w5
        double d0 = w[4] - (r - 3.0) * w[5];

        double r0 = retrievability(s0, 0); // R=1.0 at t=0 (just reviewed)
        int intervalDays = computeInterval(s0);

        card.setStability(bd(s0, 4));
        card.setDifficulty(bd(clamp(d0, D_MIN, D_MAX), 2));
        card.setRetrievability(bd(r0, 4));
        card.setFsrsState(FsrsState.REVIEW.value);
        card.setAlgorithmVersion(VocabReviewSchedule.AlgorithmVersion.FSRS.name());
        card.setNextReviewAt(OffsetDateTime.now().plusDays(intervalDays));
        card.setLastReviewAt(OffsetDateTime.now());

        log.debug("[FSRS] Init card '{}': S={} D={} interval={}d",
                card.getGerman(), s0, d0, intervalDays);
    }

    /**
     * Updates FSRS scheduling parameters after a review of an already-FSRS card,
     * using the global reference weights.
     */
    public void scheduleReview(VocabReviewSchedule card, int rating, long elapsedDays) {
        scheduleReview(card, rating, elapsedDays, DEFAULT_WEIGHTS);
    }

    /**
     * Updates FSRS scheduling parameters after a review of an already-FSRS card.
     *
     * @param card        card to update (mutates in-place)
     * @param rating      FSRS rating 1-4
     * @param elapsedDays days since last review
     * @param weights     per-user (or global) FSRS-4.5 weight vector
     */
    public void scheduleReview(VocabReviewSchedule card, int rating, long elapsedDays, double[] weights) {
        double[] w = safeWeights(weights);
        int r = clampRating(rating);

        double s = card.getStability() != null ? card.getStability().doubleValue() : 1.0;
        double d = card.getDifficulty() != null ? card.getDifficulty().doubleValue() : 5.0;
        double rVal = retrievability(s, elapsedDays);

        double newS;
        double newD;

        if (r >= 2) { // Hard / Good / Easy → pass
            newS = stabilityAfterPass(s, d, rVal, r, w);
            newD = updateDifficulty(d, r, w);
            card.setFsrsState(FsrsState.REVIEW.value);
        } else { // Again → fail
            newS = stabilityAfterFail(s, d, rVal, w);
            newD = updateDifficulty(d, r, w);
            card.setFsrsState(FsrsState.RELEARNING.value);
        }

        newS = Math.max(newS, S_MIN);
        newD = clamp(newD, D_MIN, D_MAX);

        int intervalDays = computeInterval(newS);

        card.setStability(bd(newS, 4));
        card.setDifficulty(bd(newD, 2));
        card.setRetrievability(bd(rVal, 4));
        card.setAlgorithmVersion(VocabReviewSchedule.AlgorithmVersion.FSRS.name());
        card.setNextReviewAt(OffsetDateTime.now().plusDays(intervalDays));
        card.setLastReviewAt(OffsetDateTime.now());

        log.debug("[FSRS] Review '{}' rating={}: S={}->{} D={}->{} R={} interval={}d",
                card.getGerman(), r, s, newS, d, newD, rVal, intervalDays);
    }

    /**
     * Computes current retrievability R(t) for a card.
     * Used for analytics / forecasting without mutating card state.
     *
     * @param card the card (must have stability set)
     * @param now  current time to compare against lastReviewAt
     * @return R ∈ [0, 1], or 1.0 if card has never been reviewed
     */
    public double computeCurrentRetrievability(VocabReviewSchedule card, OffsetDateTime now) {
        if (card.getStability() == null || card.getLastReviewAt() == null) return 1.0;
        long elapsed = java.time.Duration.between(card.getLastReviewAt(), now).toDays();
        return retrievability(card.getStability().doubleValue(), elapsed);
    }

    // ─── FSRS-4.5 core formulas ───────────────────────────────────────────────

    /**
     * R(t) = (1 + t / (9 × S))^(-1)
     * Retrievability at time t days after last review with stability S.
     */
    double retrievability(double stability, long elapsedDays) {
        if (stability <= 0) return 0.0;
        return Math.pow(1.0 + elapsedDays / (9.0 * stability), -1.0);
    }

    /**
     * Stability after a successful review (Hard/Good/Easy):
     * S'(pass) = S × e^(w17 × (11−D) × S^−w18 × (e^(w19×(1−R)) − 1))
     * With Hard/Easy modifiers w15/w16.
     */
    double stabilityAfterPass(double s, double d, double r, int rating, double[] w) {
        double hardPenalty  = (rating == 2) ? w[15] : 1.0;
        double easyBonus    = (rating == 4) ? w[16] : 1.0;
        double base = s * Math.exp(
                w[17] * (11.0 - d) * Math.pow(s, -w[18]) * (Math.exp(w[19] * (1.0 - r)) - 1.0)
        );
        return base * hardPenalty * easyBonus;
    }

    /**
     * Stability after a failed review (Again):
     * S'(fail) = w11 × D^−w12 × ((S+1)^w13 − 1) × e^(w14×(1−R))
     */
    double stabilityAfterFail(double s, double d, double r, double[] w) {
        return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1.0 - r));
    }

    /**
     * D' = D − w6 × (rating − 3)
     * Mean-reverts toward 5.0 with: D'' = D' − w7 × (D' − 5)
     */
    double updateDifficulty(double d, int rating, double[] w) {
        double delta  = -w[6] * (rating - 3.0);
        double dPrime = d + delta;
        // Mean-reversion to prevent drift
        double dPP    = dPrime - w[7] * (dPrime - 5.0);
        return clamp(dPP, D_MIN, D_MAX);
    }

    /**
     * I = S × 9 × (1/targetR − 1)
     * Interval in days that achieves targetR = 0.9 retention.
     */
    int computeInterval(double stability) {
        double interval = stability * 9.0 * (1.0 / TARGET_RETRIEVABILITY - 1.0);
        return Math.max(1, (int) Math.round(interval));
    }

    // ─── Utilities ────────────────────────────────────────────────────────────

    /**
     * Returns {@code weights} when it is a valid FSRS-4.5 vector (length
     * {@link #WEIGHT_COUNT}, all finite); otherwise falls back to the global
     * reference weights. Guards against corrupt per-user weight rows.
     */
    private double[] safeWeights(double[] weights) {
        if (weights == null || weights.length != WEIGHT_COUNT) {
            return DEFAULT_WEIGHTS;
        }
        for (double v : weights) {
            if (!Double.isFinite(v)) return DEFAULT_WEIGHTS;
        }
        return weights;
    }

    private int clampRating(int r) {
        return Math.max(1, Math.min(4, r));
    }

    private double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private BigDecimal bd(double v, int scale) {
        return BigDecimal.valueOf(v).setScale(scale, RM);
    }
}
