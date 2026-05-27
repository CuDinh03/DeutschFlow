package com.deutschflow.speaking.dto;

public record CreateGreetingSessionRequest(
        Long templateId,
        Integer difficultyLevel
) {}
