package com.deutschflow.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * DTO for student to update their own learning profile.
 * All fields are optional — only non-null values will be applied (partial update).
 */
public record UpdateLearningProfileRequest(

        /** WORK | CERT */
        @Pattern(regexp = "^(WORK|CERT)$", message = "goalType must be WORK or CERT")
        String goalType,

        /** A1 | A2 | B1 | B2 | C1 | C2 */
        @Pattern(regexp = "^(A1|A2|B1|B2|C1|C2)$", message = "targetLevel must be A1-C2")
        String targetLevel,

        /** Free-text industry/occupation, e.g. "Bác sĩ", "Lập trình viên" */
        String industry,

        /** User interests / hobbies e.g. ["Du lịch", "Nấu ăn"] */
        List<String> interests,

        /** SLOW | NORMAL | FAST */
        @Pattern(regexp = "^(SLOW|NORMAL|FAST)$", message = "learningSpeed must be SLOW, NORMAL or FAST")
        String learningSpeed,

        @Min(value = 1, message = "sessionsPerWeek must be at least 1")
        @Max(value = 14, message = "sessionsPerWeek cannot exceed 14")
        Integer sessionsPerWeek,

        @Min(value = 5, message = "minutesPerSession must be at least 5")
        @Max(value = 180, message = "minutesPerSession cannot exceed 180")
        Integer minutesPerSession
) {}
