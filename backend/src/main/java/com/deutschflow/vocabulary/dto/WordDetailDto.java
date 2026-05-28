package com.deutschflow.vocabulary.dto;

import java.util.List;

public record WordDetailDto(
        Long id,
        String word,
        String translation,
        String wordType,
        String gender,
        String cefrLevel,
        String pronunciationIpa,
        String exampleSentence,
        Integer frequencyRank,
        String imageUrl,
        String audioUrl,
        String nominativeArticle,
        DeclensionsDto declensions,
        List<String> grammarTips
) {}
