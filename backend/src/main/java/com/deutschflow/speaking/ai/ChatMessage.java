package com.deutschflow.speaking.ai;

/**
 * Represents a single message in an OpenAI Chat Completions request.
 *
 * @param role    one of "system", "user", or "assistant"
 * @param content the message text
 */
public record ChatMessage(String role, String content) {}
