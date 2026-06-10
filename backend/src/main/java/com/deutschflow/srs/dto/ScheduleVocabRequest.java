package com.deutschflow.srs.dto;

import jakarta.validation.constraints.NotBlank;

/** Request for scheduling a vocab item after node completion */
public record ScheduleVocabRequest(
        Long   nodeId,
        // vocabId is the FSRS card identity — a blank one would create an unreachable schedule row.
        @NotBlank String vocabId,
        String german,
        String meaning,
        String exampleDe,
        String speakDe
) {}
