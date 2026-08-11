package com.deutschflow.grammar.dto;

import java.util.List;

/**
 * Response of {@code POST /api/grammar/ai/practice-suggestions} — a list of level-appropriate
 * practice ideas. Shape matches the web "Gợi ý luyện tập" tab: {@code {suggestions:[{topic,
 * description, example}]}} (QA F-7).
 */
public record GrammarPracticeSuggestionsDto(List<Suggestion> suggestions) {

    public record Suggestion(String topic, String description, String example) {}
}
