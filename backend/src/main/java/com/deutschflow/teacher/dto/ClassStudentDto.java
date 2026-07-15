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
        /**
         * The student's CURRENT CEFR level (default A0). This used to carry {@code targetLevel} — the
         * level the student wants to reach, self-declared at onboarding — so the roster showed B2/C2 for
         * a beginner and a teacher could mis-place them. It is now the real current level.
         */
        String cefrLevel,
        /** Where {@code cefrLevel} came from: "SELF" (self-declared) or "ASSESSED". */
        String levelSource,
        /** The student's TARGET level (their goal), shown as context — not their current ability. */
        String targetLevel,
        BigDecimal skillHoren,
        BigDecimal skillLesen,
        BigDecimal skillSchreiben,
        BigDecimal skillSprechen,
        LocalDateTime evaluatedAt
) {}
