package com.deutschflow.user.dto;

import java.util.List;

public record SessionDetailResponse(
        int week,
        int sessionIndex,
        String type,
        int minutes,
        int difficulty,
        List<String> theory,
        TheoryLesson theoryLesson,
        /** Ten quick checks on this session's theory only; 100% required before {@link #exercises()}. */
        List<ExerciseItem> theoryGateExercises,
        boolean theoryGatePassed,
        /** Main session exercises (this session + previous session knowledge). */
        List<ExerciseItem> exercises
) {
    /**
     * Rich theory: explanations follow the user's UI language; German lemmas/sentences stay German.
     * {@code speakDe} is German text for client-side TTS.
     */
    public record TheoryLesson(
            String title,
            String overview,
            List<String> focusBullets,
            List<VocabLine> vocabulary,
            List<PhraseLine> phrases,
            List<ExampleLine> examples
    ) {}

    public record VocabLine(
            String german,
            String meaning,
            String exampleDe,
            String exampleTranslation,
            String speakDe
    ) {}

    public record PhraseLine(
            String german,
            String meaning,
            String speakDe
    ) {}

    public record ExampleLine(
            String german,
            String translation,
            String note,
            String speakDe
    ) {}

    /**
     * @param format            MC | TRUE_FALSE | TEXT | SPEAK_REPEAT | ORDER_MC | ORDER_DRAG (pipe-separated token order)
     * @param correctOptionIndex index into {@code options} for MC / TRUE_FALSE; null only for pure TEXT without options
     * @param expectedAnswerNormalized for TEXT/SPEAK_REPEAT: optional extra check (normalized lower-case German);
     *                                   for ORDER_DRAG: canonical answer as {@code token|token|...} (normalized)
     * @param audioGerman       optional German line for client TTS (Hören / Nachsprechen)
     * @param explanation       short rationale (never exposed in session GET; may be returned on 100% submit only)
     */
    public record ExerciseItem(
            String id,
            String title,
            String skill,
            int difficulty,
            int minutes,
            String question,
            List<String> options,
            String format,
            Integer correctOptionIndex,
            String expectedAnswerNormalized,
            String audioGerman,
            String explanation
    ) {
        public ExerciseItem {
            if (format == null || format.isBlank()) {
                format = "MC";
            }
        }

        /** Legacy 7-arg constructor for older call sites (defaults to classic MC). */
        public ExerciseItem(String id, String title, String skill, int difficulty, int minutes, String question, List<String> options) {
            this(id, title, skill, difficulty, minutes, question, options, "MC", null, null, null, null);
        }
    }
}

