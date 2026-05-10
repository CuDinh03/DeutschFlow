package com.deutschflow.srs.dto;

/** Request for scheduling a vocab item after node completion */
public record ScheduleVocabRequest(
        Long   nodeId,
        String vocabId,
        String german,
        String meaning,
        String exampleDe,
        String speakDe
) {}
