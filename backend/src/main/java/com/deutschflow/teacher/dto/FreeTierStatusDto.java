package com.deutschflow.teacher.dto;

/**
 * The teacher's plan status (D6²). {@code freeTier} = a non-org (freelance) teacher governed by the
 * daily caps on expensive AI; org teachers ({@code freeTier=false}) are governed by their org pool.
 * Daily limits + today's usage make the free plan visible/official.
 */
public record FreeTierStatusDto(
        boolean freeTier,
        int pptxDaily,
        int pptxUsedToday,
        int ocrDaily,
        int ocrUsedToday
) {}
