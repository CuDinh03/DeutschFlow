package com.deutschflow.teacher.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A student row in a teacher's class roster. The four CEFR skill scores (0–10, ≥5 = passing) and
 * {@code evaluatedAt} are null until the teacher evaluates the student (see StudentEvaluationService);
 * the class-detail UI shows score-bars / a class skill average from these.
 */
public record ClassStudentDto(
        Long studentId,
        String displayName,
        String email,
        Integer xp,
        Integer level,
        String cefrLevel,
        BigDecimal skillHoren,
        BigDecimal skillLesen,
        BigDecimal skillSchreiben,
        BigDecimal skillSprechen,
        LocalDateTime evaluatedAt
) {}
