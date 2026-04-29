package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.Size;

public record CreateSessionRequest(
        @Size(max = 200) String topic,
        @Size(max = 8)   String cefrLevel
) {}
