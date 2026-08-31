package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * The requesting student's OWN evaluation row (never the class list).
 *
 * <p>Each skill is on the 0–10 scale — the same scale the teacher enters in the gradebook. A skill the
 * teacher has not scored falls back to the average of the student's own skill-tagged assignment scores,
 * converted from the 0–100 grading scale ({@code StudentEvaluationService#toDouble}); null when there is
 * no data for that skill at all. (The javadoc here used to claim 0-100, which never matched what the
 * endpoint returns nor the 0–10 thresholds {@code SkillReportDto#gradeOf} grades against.)
 *
 * <p>{@code teacherComment} is the teacher's written feedback for this student in this class. It used to
 * exist only on the teacher-facing {@code StudentEvaluationDto}: a teacher wrote the comment in the
 * gradebook and no endpoint ever handed it back to the student it was written for.
 */
public record MySkillReportDto(
        Double horen,
        Double lesen,
        Double schreiben,
        Double sprechen,
        Double total,
        String grade,
        String teacherComment,
        LocalDateTime evaluatedAt
) {}
