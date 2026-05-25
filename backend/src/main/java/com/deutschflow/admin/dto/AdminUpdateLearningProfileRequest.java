package com.deutschflow.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

/**
 * Request DTO for admin to create or update a user's learning profile.
 * All fields are optional — only non-null values will be applied (partial update).
 */
public record AdminUpdateLearningProfileRequest(

        /** WORK | CERT */
        @Pattern(regexp = "^(WORK|CERT)$", message = "goalType must be WORK or CERT")
        String goalType,

        /** A1 | A2 | B1 | B2 | C1 | C2 */
        @Pattern(regexp = "^(A1|A2|B1|B2|C1|C2)$", message = "targetLevel must be A1-C2")
        String targetLevel,

        /** A0 | A1 | A2 | B1 | B2 | C1 | C2 */
        @Pattern(regexp = "^(A0|A1|A2|B1|B2|C1|C2)$", message = "currentLevel must be A0-C2")
        String currentLevel,

        /** SLOW | NORMAL | FAST */
        @Pattern(regexp = "^(SLOW|NORMAL|FAST)$", message = "learningSpeed must be SLOW, NORMAL or FAST")
        String learningSpeed,

        /** Industry e.g. IT, MEDICINE, EDUCATION */
        String industry,

        @Min(value = 1, message = "sessionsPerWeek must be at least 1")
        @Max(value = 14, message = "sessionsPerWeek cannot exceed 14")
        Integer sessionsPerWeek,

        @Min(value = 10, message = "minutesPerSession must be at least 10")
        @Max(value = 180, message = "minutesPerSession cannot exceed 180")
        Integer minutesPerSession
) {}
