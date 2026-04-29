package com.deutschflow.vocabulary.dto;

import java.time.LocalDate;

public record WordCoverageResponse(
        LocalDate date,
        long totalWords,
        long nounWords,
        long nounRows,
        long nounWithGender,
        long nounDer,
        long nounDie,
        long nounDas,
        double nounCoveragePercent,
        long verbWords,
        long verbRows,
        double verbCoveragePercent
) {}

