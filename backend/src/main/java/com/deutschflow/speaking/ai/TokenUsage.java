package com.deutschflow.speaking.ai;

public record TokenUsage(
        int promptTokens,
        int completionTokens,
        int totalTokens,
        boolean estimated
) {
    public static TokenUsage exact(int promptTokens, int completionTokens, int totalTokens) {
        return new TokenUsage(promptTokens, completionTokens, totalTokens, false);
    }

    public static TokenUsage estimated(int promptTokens, int completionTokens, int totalTokens) {
        return new TokenUsage(promptTokens, completionTokens, totalTokens, true);
    }
}

