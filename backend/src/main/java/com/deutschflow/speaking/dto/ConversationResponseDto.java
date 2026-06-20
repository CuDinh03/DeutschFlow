package com.deutschflow.speaking.dto;

/**
 * Response of {@code POST /api/speaking/ai/conversation} — mirrors the legacy
 * {@code {userMessage, aiResponse, level}} map 1:1 (echoed user turn + AI reply + level).
 */
public record ConversationResponseDto(String userMessage, String aiResponse, String level) {}
