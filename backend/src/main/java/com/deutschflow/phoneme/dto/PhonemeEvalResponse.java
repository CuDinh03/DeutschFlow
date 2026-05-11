package com.deutschflow.phoneme.dto;

import java.util.List;

/** Response from Phoneme Coach evaluation */
public record PhonemeEvalResponse(
        /** Whisper-transcribed text from user's audio */
        String transcribed,
        /** Original target text */
        String target,
        /** 0-100 pronunciation score */
        int score,
        /** Emoji feedback */
        String emoji,
        /** Vietnamese feedback message */
        String feedbackVi,
        /** Word-level analysis */
        List<WordResult> words
) {
    public record WordResult(
            String word,
            boolean correct,
            /** Levenshtein similarity 0.0-1.0 */
            double similarity
    ) {}
}
