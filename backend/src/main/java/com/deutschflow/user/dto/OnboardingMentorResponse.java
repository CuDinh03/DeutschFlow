package com.deutschflow.user.dto;

/**
 * The fixed mentor a learner would be assigned for their current onboarding
 * selections, for a live "meet your mentor" preview. Resolved deterministically by
 * {@code FixedMentorResolver} from goal + industry + level + the user's tier.
 *
 * <p>When the learner is on a FREE tier and their industry's ideal mentor is gated
 * behind PRO, {@code upsellCode}/{@code upsellDisplayName} carry that locked mentor so
 * the client can show a "unlock with PRO" nudge (design §3.2). Both are {@code null}
 * when there is no upsell (already on the ideal mentor, or already premium).
 *
 * @param code              assigned persona code (e.g. {@code "ANNA"}) — a {@code SpeakingPersona}
 * @param displayName       assigned mentor name (e.g. {@code "Anna"})
 * @param difficulty        assigned mentor difficulty (BEGINNER / INTERMEDIATE / ADVANCED)
 * @param upsellCode        gated ideal mentor's code, or {@code null} if no upsell
 * @param upsellDisplayName gated ideal mentor's name, or {@code null} if no upsell
 */
public record OnboardingMentorResponse(
        String code,
        String displayName,
        String difficulty,
        String upsellCode,
        String upsellDisplayName
) {}
