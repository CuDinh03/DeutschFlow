package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiSpeakingChatRequest(
        @NotBlank(message = "userMessage must not be blank")
        @Size(max = 5000, message = "userMessage must not exceed 5000 characters")
        String userMessage,

        /** Opt-in to streaming TTS audio events on the chat stream. Absent in JSON → false. */
        boolean streamAudio,

        /**
         * Optional client-minted idempotency key for this turn (audit R-M5). Stable across the first
         * attempt and every retry of the same turn; lets the backend replay the original response
         * without re-calling the LLM or re-debiting quota. Bounded so it can't bloat the Redis key;
         * absent in legacy clients → no idempotency, falls back to the client-side reconcile.
         */
        @Size(max = 100, message = "clientTurnId must not exceed 100 characters")
        String clientTurnId
) {}
