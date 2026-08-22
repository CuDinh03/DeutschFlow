package com.deutschflow.examspeaking.dto;

import java.util.Map;

public record TurnResponse(
        String transcript,
        String aiRole,
        String aiText,
        String aiVoice,
        Map<String, Object> turnEval,
        ExamSessionView session
) {}
