package com.deutschflow.speaking.ai;

public record AiChatCompletionResult(
        String content,
        TokenUsage usage,
        String provider,
        String model
) {}

