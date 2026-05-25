package com.deutschflow.srs.dto;

import java.time.OffsetDateTime;

/** Vocab card returned for review session */
public record VocabReviewCard(
        Long   id,
        String vocabId,
        String german,
        String meaning,
        String exampleDe,
        String speakDe,
        int    repetitions,
        OffsetDateTime nextReviewAt
) {}
