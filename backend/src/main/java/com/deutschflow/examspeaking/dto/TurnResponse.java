package com.deutschflow.examspeaking.dto;

import java.util.List;
import java.util.Map;

/** {@code aiTurns}: mọi lượt AI sau lượt thí sinh (thường 1; B1 T3: partner trả lời + giám khảo hỏi = 2). aiRole/aiText = lượt cuối. */
public record TurnResponse(
        String transcript,
        String aiRole,
        String aiText,
        String aiVoice,
        List<AiTurn> aiTurns,
        Map<String, Object> turnEval,
        ExamSessionView session
) {
    public record AiTurn(String role, String text) {}
}
