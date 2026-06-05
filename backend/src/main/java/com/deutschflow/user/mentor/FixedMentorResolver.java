package com.deutschflow.user.mentor;

import com.deutschflow.user.entity.UserLearningProfile.CurrentLevel;
import com.deutschflow.user.entity.UserLearningProfile.GoalType;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Derives a learner's <b>fixed mentor</b> (a {@code SpeakingPersona} code) from their
 * learning profile and subscription tier.
 *
 * <p>Pure and side-effect free — no Spring context, DB, or clock — so it unit-tests
 * directly. Determinism is the point: the same inputs always yield the same mentor,
 * so {@code user_learning_profiles.assigned_persona_code} is reproducible on audit
 * (data integrity). The learner can still override the choice later in the Speaking
 * module; this only sets the default.
 *
 * <p>Decision rules mirror
 * {@code docs/superpowers/specs/2026-06-05-onboarding-type-selection-design.md} §3
 * and the persona catalog in SRS §59.3:
 * <ol>
 *   <li><b>CERT goal</b> → ANNA, the generalist exam coach, regardless of industry
 *       (always BEGINNER, so always unlockable).</li>
 *   <li><b>WORK goal</b> → map {@code industry} to a family, then pick a persona in
 *       that family.</li>
 *   <li><b>Tier gate (hard filter)</b> → FREE keeps only BEGINNER personas; if that
 *       empties the family, fall back to the default mentor.</li>
 *   <li><b>Level fit (soft tie-break)</b> → among the survivors, prefer the difficulty
 *       closest to the learner's level, then the gentler tier, then a stable code order.</li>
 * </ol>
 */
@Component
public class FixedMentorResolver {

    /** Universal default mentor: BEGINNER generalist, always unlockable on FREE. */
    public static final String DEFAULT_MENTOR = "ANNA";

    /** Plan codes that unlock INTERMEDIATE / ADVANCED mentors. Everything else is BEGINNER-only. */
    private static final Set<String> PREMIUM_PLAN_CODES = Set.of("PRO", "ULTRA", "PREMIUM", "INTERNAL");

    /** Persona catalog mirroring SRS §59.3 (code → family → difficulty). */
    private static final List<MentorPersona> CATALOG = List.of(
            new MentorPersona("LUKAS",     IndustryFamily.IT,         MentorDifficulty.ADVANCED),
            new MentorPersona("EMMA",      IndustryFamily.BUSINESS,   MentorDifficulty.INTERMEDIATE),
            new MentorPersona("ANNA",      IndustryFamily.EDUCATION,  MentorDifficulty.BEGINNER),
            new MentorPersona("KLAUS",     IndustryFamily.GASTRONOMY, MentorDifficulty.INTERMEDIATE),
            new MentorPersona("WEBER",     IndustryFamily.HEALTHCARE, MentorDifficulty.ADVANCED),
            new MentorPersona("SARAH",     IndustryFamily.HEALTHCARE, MentorDifficulty.INTERMEDIATE),
            new MentorPersona("SCHNEIDER", IndustryFamily.HEALTHCARE, MentorDifficulty.ADVANCED),
            new MentorPersona("LENA",      IndustryFamily.RETAIL,     MentorDifficulty.BEGINNER),
            new MentorPersona("THOMAS",    IndustryFamily.RETAIL,     MentorDifficulty.BEGINNER),
            new MentorPersona("PETRA",     IndustryFamily.RETAIL,     MentorDifficulty.BEGINNER),
            new MentorPersona("MAX",       IndustryFamily.OPERATIONS, MentorDifficulty.INTERMEDIATE),
            new MentorPersona("OLIVER",    IndustryFamily.OPERATIONS, MentorDifficulty.ADVANCED),
            new MentorPersona("NIKLAS",    IndustryFamily.SERVICE,    MentorDifficulty.BEGINNER),
            new MentorPersona("NINA",      IndustryFamily.SERVICE,    MentorDifficulty.INTERMEDIATE),
            new MentorPersona("HANNIE",    IndustryFamily.MEDIA,      MentorDifficulty.INTERMEDIATE)
    );

    private static final MentorPersona DEFAULT_PERSONA = CATALOG.stream()
            .filter(p -> p.code().equals(DEFAULT_MENTOR))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("Default mentor " + DEFAULT_MENTOR + " missing from catalog"));

    /**
     * Resolve the fixed mentor for a learner.
     *
     * @param goalType     learner's goal (WORK or CERT); a {@code null} goal is treated as WORK
     * @param industry     free-text industry from the profile (may be {@code null}/blank)
     * @param currentLevel learner's current CEFR level (a {@code null} level is treated as A0)
     * @param planCode     subscription plan code (FREE, DEFAULT, PRO, ULTRA, …); {@code null} → free
     * @return the resolved mentor, never {@code null}
     */
    public FixedMentor resolve(GoalType goalType, String industry, CurrentLevel currentLevel, String planCode) {
        boolean premiumUnlocked = isPremium(planCode);

        // (1) CERT goal → generalist exam coach, regardless of industry. ANNA is BEGINNER, so always unlockable.
        if (goalType == GoalType.CERT) {
            return new FixedMentor(DEFAULT_PERSONA.code(), DEFAULT_PERSONA.difficulty(),
                    "CERT goal -> generalist exam coach");
        }

        // (2) WORK goal → industry family.
        IndustryFamily family = IndustryFamily.fromText(industry);
        MentorDifficulty desired = difficultyForLevel(currentLevel);

        // (3) Tier gate (hard filter): FREE keeps only BEGINNER personas.
        List<MentorPersona> candidates = CATALOG.stream()
                .filter(p -> p.family() == family)
                .filter(p -> premiumUnlocked || p.difficulty() == MentorDifficulty.BEGINNER)
                .toList();

        if (candidates.isEmpty()) {
            String reason = premiumUnlocked
                    ? "no persona for family " + family + " -> default"
                    : "FREE tier has no BEGINNER mentor for family " + family + " -> default";
            return new FixedMentor(DEFAULT_PERSONA.code(), DEFAULT_PERSONA.difficulty(), reason);
        }

        // (4) Level fit (soft tie-break): closest difficulty to the level target, then gentler, then stable by code.
        MentorPersona pick = candidates.stream()
                .min(Comparator
                        .comparingInt((MentorPersona p) -> Math.abs(p.difficulty().ordinal() - desired.ordinal()))
                        .thenComparingInt(p -> p.difficulty().ordinal())
                        .thenComparing(MentorPersona::code))
                .orElse(DEFAULT_PERSONA);

        return new FixedMentor(pick.code(), pick.difficulty(),
                "WORK/" + family + "/" + (currentLevel == null ? "A0" : currentLevel)
                        + (premiumUnlocked ? "/premium" : "/free"));
    }

    /** True when the plan code unlocks INTERMEDIATE / ADVANCED mentors. */
    public boolean isPremium(String planCode) {
        return planCode != null && PREMIUM_PLAN_CODES.contains(planCode.trim().toUpperCase(Locale.ROOT));
    }

    /** Level-appropriate target difficulty: A0/A1 → BEGINNER, A2/B1 → INTERMEDIATE, B2+ → ADVANCED. */
    private static MentorDifficulty difficultyForLevel(CurrentLevel level) {
        if (level == null) {
            return MentorDifficulty.BEGINNER;
        }
        return switch (level) {
            case A0, A1 -> MentorDifficulty.BEGINNER;
            case A2, B1 -> MentorDifficulty.INTERMEDIATE;
            case B2, C1, C2 -> MentorDifficulty.ADVANCED;
        };
    }
}
