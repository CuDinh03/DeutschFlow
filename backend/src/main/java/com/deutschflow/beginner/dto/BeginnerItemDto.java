package com.deutschflow.beginner.dto;

public record BeginnerItemDto(
        int sequenceOrder,
        String itemType,
        String titleDe,
        String titleVi,
        String exampleDe,
        String exampleVi,
        String audioHint
) {}
