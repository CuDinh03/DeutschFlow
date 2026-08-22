package com.deutschflow.examspeaking.api.model;

import java.util.List;

/**
 * Một lượt nói đã phiên âm. {@code words} (timestamps) và {@code avgLogprob}/{@code durationSeconds}
 * chỉ có khi đi qua STT verbose — text-only (drill/dev) thì null và các tiêu chí đo-từ-audio bị đánh dấu
 * "chưa chấm được" thay vì bịa số.
 */
public record Utterance(
        String role,
        String text,
        List<Word> words,
        Double avgLogprob,
        Double durationSeconds
) {
    public record Word(String word, double start, double end) {}

    public Utterance {
        words = words == null ? List.of() : List.copyOf(words);
    }

    public static Utterance candidateText(String text) {
        return new Utterance("CANDIDATE", text, List.of(), null, null);
    }

    public boolean hasTiming() {
        return !words.isEmpty() && durationSeconds != null && durationSeconds > 0;
    }
}
