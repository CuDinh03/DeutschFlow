package com.deutschflow.speaking.util;

import com.deutschflow.user.entity.UserLearningProfile;

import java.util.Locale;

/** Shared CEFR ladder rules for AI speaking / weekly prompts. */
public final class SpeakingCefrSupport {

    public static final String DEFAULT_BAND = "A1";

    private static final String[] ORDER = {"A1", "A2", "B1", "B2", "C1", "C2"};

    private SpeakingCefrSupport() {
    }

    public static int bandIndex(String band) {
        if (band == null) {
            return -1;
        }
        String b = band.trim().toUpperCase(Locale.ROOT);
        for (int i = 0; i < ORDER.length; i++) {
            if (ORDER[i].equals(b)) {
                return i;
            }
        }
        return -1;
    }

    /** Normalize to a supported band; unknown values fall back to A1. */
    public static String clampBand(String proposed) {
        if (proposed == null || proposed.isBlank()) {
            return DEFAULT_BAND;
        }
        int i = bandIndex(proposed);
        return i < 0 ? DEFAULT_BAND : ORDER[i];
    }

    /** Absolute beginner marker → prompts use at least A1 material. */
    public static String bandFromCurrentLevel(UserLearningProfile.CurrentLevel cur) {
        if (cur == null) {
            return DEFAULT_BAND;
        }
        if (cur == UserLearningProfile.CurrentLevel.A0) {
            return DEFAULT_BAND;
        }
        return clampBand(cur.name());
    }

    public static String floorPracticeBand(UserLearningProfile profile) {
        if (profile == null) {
            return DEFAULT_BAND;
        }
        if (profile.getCurrentLevel() != null) {
            return bandFromCurrentLevel(profile.getCurrentLevel());
        }
        if (profile.getTargetLevel() != null) {
            return clampBand(profile.getTargetLevel().name());
        }
        return DEFAULT_BAND;
    }

    public static String ceilingBand(UserLearningProfile profile) {
        if (profile == null || profile.getTargetLevel() == null) {
            return "C2";
        }
        return clampBand(profile.getTargetLevel().name());
    }

    /**
     * Inclusive ladder clamp: learner-chosen band must stay between practice floor (from currentLevel)
     * and profile target ceiling.
     */
    public static String clampToProfileRange(String proposed, UserLearningProfile profile) {
        String floor = floorPracticeBand(profile);
        String ceil = ceilingBand(profile);
        String p = proposed == null || proposed.isBlank() ? floor : clampBand(proposed);
        return clampInclusive(p, floor, ceil);
    }

    public static String clampInclusive(String proposedBand, String floorBand, String ceilingBand) {
        int pi = bandIndex(proposedBand);
        int fi = bandIndex(floorBand);
        int ci = bandIndex(ceilingBand);
        if (fi < 0) {
            fi = 0;
        }
        if (ci < 0) {
            ci = ORDER.length - 1;
        }
        if (fi > ci) {
            int swap = fi;
            fi = ci;
            ci = swap;
        }
        if (pi < 0) {
            pi = fi;
        }
        int clamped = Math.max(fi, Math.min(ci, pi));
        return ORDER[clamped];
    }

    /** CEFR band at ladder index (0=A1 … 5=C2), or DEFAULT_BAND when out of range. */
    public static String bandFromLadderIndex(int index) {
        if (index < 0 || index >= ORDER.length) {
            return DEFAULT_BAND;
        }
        return ORDER[index];
    }

    /** Number of steps on the CEFR ladder (A1→C2). */
    public static int ladderStepCount() {
        return ORDER.length;
    }

    /** Apply adaptive difficulty knob without exceeding [floorPractice, target] on the ladder. */
    public static String applyKnobClamp(String base, int knob, UserLearningProfile profile) {
        String floorBand = profile == null ? DEFAULT_BAND : floorPracticeBand(profile);
        String ceilBand = profile == null ? "C2" : ceilingBand(profile);
        int bi = bandIndex(base);
        if (bi < 0) {
            bi = bandIndex(floorBand);
        }
        if (bi < 0) {
            bi = 0;
        }
        int nextIdx = Math.max(0, Math.min(ORDER.length - 1, bi + knob));
        return clampInclusive(ORDER[nextIdx], floorBand, ceilBand);
    }
}
