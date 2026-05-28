package com.deutschflow.speaking.dto;

import java.util.List;

public record BeginnerSpeakingResponse(
        Long templateId,
        String templateName,
        String userPrompt,
        String systemPrompt,
        String encouragement,
        List<String> sampleResponses
) {}
