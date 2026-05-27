package com.deutschflow.vocabulary.dto;

import java.util.List;

public record GrammarContextDto(
        String word,
        String partOfSpeech,
        GrammarInfo grammar,
        List<Example> examples,
        List<String> relatedWords
) {
    public record GrammarInfo(
            String caseInfo,
            String genderInfo,
            String tensInfo,
            String conjugationPattern
    ) {}

    public record Example(
            String german,
            String english
    ) {}
}
