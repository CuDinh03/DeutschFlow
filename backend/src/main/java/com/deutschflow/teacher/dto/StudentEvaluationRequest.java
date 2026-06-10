package com.deutschflow.teacher.dto;

import java.math.BigDecimal;

public record StudentEvaluationRequest(
        String teacherComment,
        BigDecimal skillHoren,
        BigDecimal skillLesen,
        BigDecimal skillSchreiben,
        BigDecimal skillSprechen
) {}
