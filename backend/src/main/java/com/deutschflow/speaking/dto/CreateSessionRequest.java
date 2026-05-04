package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.Size;

public record CreateSessionRequest(
        @Size(max = 200) String topic,
        @Size(max = 8)   String cefrLevel,
        /** Optional: DEFAULT | LUKAS | EMMA | HANNA | KLAUS (case-insensitive). Unknown → DEFAULT. */
        @Size(max = 32)  String persona,
        /** Optional: V1 (default full tutor JSON) | V2 compact persona JSON. Unknown → V1. */
        @Size(max = 8)   String responseSchema
) {}
