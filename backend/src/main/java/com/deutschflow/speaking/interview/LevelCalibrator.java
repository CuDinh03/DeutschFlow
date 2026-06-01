package com.deutschflow.speaking.interview;

import java.util.Locale;

/**
 * Maps a candidate's chosen level (CEFR + experience) to a target {@link QuestionDifficulty}
 * so interview questions are calibrated — neither trivial nor over their head.
 *
 * <p>Pure and stateless, exposed as a static utility on purpose: {@link InterviewOrchestrator}
 * has hand-written test constructors, so adding a Spring-injected dependency there would force
 * test churn for zero behavioral gain. Calibration has no collaborators, so a static method is
 * the simplest correct shape.
 *
 * <p>Mapping:
 * <ul>
 *   <li>CEFR sets the base band: A1/A2 → BEGINNER, B1 → INTERMEDIATE, B2/C1/C2 → ADVANCED.</li>
 *   <li>Experience nudges ±1 band (clamped): senior/lead/expert raise; entry/junior/none lower.</li>
 * </ul>
 *
 * <p>The experience vocabulary is heuristic and intentionally tunable — confirm against the
 * actual {@code experienceLevel} values the client sends before tightening.
 */
public final class LevelCalibrator {

    private LevelCalibrator() {}

    public static QuestionDifficulty resolve(String cefrLevel, String experienceLevel) {
        return adjustByExperience(baseFromCefr(cefrLevel), experienceLevel);
    }

    private static QuestionDifficulty baseFromCefr(String cefrLevel) {
        String c = cefrLevel == null ? "" : cefrLevel.trim().toUpperCase(Locale.ROOT);
        if (c.startsWith("A")) {
            return QuestionDifficulty.BEGINNER;
        }
        if (c.startsWith("B2") || c.startsWith("C")) {
            return QuestionDifficulty.ADVANCED;
        }
        // B1, bare "B", or unknown → middle band
        return QuestionDifficulty.INTERMEDIATE;
    }

    private static QuestionDifficulty adjustByExperience(QuestionDifficulty base, String experienceLevel) {
        int idx = base.ordinal() + experienceDelta(experienceLevel);
        int clamped = Math.max(0, Math.min(QuestionDifficulty.values().length - 1, idx));
        return QuestionDifficulty.values()[clamped];
    }

    private static int experienceDelta(String experienceLevel) {
        if (experienceLevel == null || experienceLevel.isBlank()) {
            return 0;
        }
        String e = experienceLevel.trim().toLowerCase(Locale.ROOT);
        if (e.contains("senior") || e.contains("lead") || e.contains("expert")
                || e.contains("4y") || e.contains("5y") || e.contains("5+") || e.contains(">5")) {
            return +1;
        }
        if (e.contains("entry") || e.contains("junior") || e.contains("fresh")
                || e.contains("none") || e.contains("kein") || e.contains("0-1")) {
            return -1;
        }
        return 0;
    }
}
