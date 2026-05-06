package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.Size;

public record CreateSessionRequest(
        @Size(max = 200) String topic,
        @Size(max = 8)   String cefrLevel,
        /** Optional: DEFAULT | LUKAS | EMMA | HANNA | KLAUS (case-insensitive). Unknown → DEFAULT. */
        @Size(max = 32)  String persona,
        /** Optional: V1 (default full tutor JSON) | V2 compact persona JSON. Unknown → V1. */
        @Size(max = 8)   String responseSchema,
        /** Optional: COMMUNICATION (default) | INTERVIEW — mock interview prompts. Unknown → COMMUNICATION. */
        @Size(max = 20) String sessionMode,
        /** Interview mode only: position the candidate is applying for (e.g. "Backend Developer"). */
        @Size(max = 100) String interviewPosition,
        /** Interview mode only: candidate experience level (e.g. "0-6M", "6-12M", "1-2Y", "3Y", "5Y"). */
        @Size(max = 20) String experienceLevel
) {}
