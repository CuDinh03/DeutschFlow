package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;

public record ErrorSkillDto(
        String errorCode,
        long count,
        LocalDateTime lastSeenAt,
        double priorityScore,
        String sampleWrong,
        String sampleCorrected,
        String ruleViShort,
        boolean resolved
) {}
