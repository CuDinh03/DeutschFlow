package com.deutschflow.teacher.curriculumimport;

import java.util.List;

/**
 * One phase of the standard three-part chapter arc, expressed as data so the split is a rule and not
 * coursebook-specific code:
 *
 * <ol>
 *   <li>Einstieg — vocabulary and phrases, first productive use;</li>
 *   <li>Grammar and receptive practice — guided work on structures, Hören/Lesen;</li>
 *   <li>Transfer — culture and strategy, free speaking/writing (never a revision hour: revision has
 *       its own review module).</li>
 * </ol>
 *
 * <p>{@code preferredTags} is the affinity used to route a chapter's topic labels to a session;
 * {@code skillTag} is what the generated points and can-do statements are tagged with.
 *
 * @param titleKey stable German phase label used to name the session
 */
public record SessionProfile(String titleKey, String skillTag, List<String> preferredTags) {

    /** The default arc for a three-session chapter (the shape the spec describes). */
    public static final List<SessionProfile> THREE_PART = List.of(
            new SessionProfile("Einstieg und Wortschatz", "SPRECHEN", List.of("WORTSCHATZ", "REDEMITTEL")),
            new SessionProfile("Grammatik und Verstehen", "HOEREN", List.of("GRAMMATIK", "AUSSPRACHE")),
            new SessionProfile("Anwendung und Transfer", "SCHREIBEN", List.of("LANDESKUNDE", "STRATEGIE")));

    /** The single session a review unit becomes. */
    public static final SessionProfile REVIEW =
            new SessionProfile("Wiederholung und Training", "SPRECHEN", List.of("STRATEGIE", "LANDESKUNDE"));

    /**
     * Profiles for a chapter split into {@code sessions} parts. Three is the documented arc; any
     * other count reuses the arc cyclically so a two- or four-session centre still gets a sensible
     * progression rather than an error.
     */
    public static List<SessionProfile> forCount(int sessions) {
        if (sessions == THREE_PART.size()) return THREE_PART;
        return java.util.stream.IntStream.range(0, sessions)
                .mapToObj(i -> THREE_PART.get(i % THREE_PART.size()))
                .toList();
    }
}
