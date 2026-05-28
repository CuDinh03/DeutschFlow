package com.deutschflow.beginner.dto;

import java.util.List;

public record BeginnerSessionResponse(
        String welcomeMessage,
        List<BeginnerItemDto> items,
        String firstSpeakingPrompt,
        String encouragement
) {}
