package com.deutschflow.speaking.dto;

import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.interview.InterviewPromptContext;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.user.entity.UserLearningProfile;

import java.util.List;

/**
 * Tham số dựng system prompt Speaking — thay cho 9 overload {@code buildSystemPrompt} cũ
 * (dọn nợ Đ6, kế hoạch 04/08). Trường nào không set thì builder tự lấy default an toàn:
 * persona {@code DEFAULT}, schema {@code V1}, mode {@code COMMUNICATION}, list rỗng.
 *
 * <p>{@code policy} nullable — {@code SystemPromptBuilder} tự kiểm tra {@code enabled()},
 * caller KHÔNG cần tự tay đổi policy thành null khi policy tắt như thời còn overload.
 */
@lombok.Builder
public record SpeakingPromptRequest(
        UserLearningProfile profile,
        List<String> knownInterests,
        String topic,
        List<WeakPoint> weakPoints,
        String sessionCefrLevel,
        SpeakingPolicy policy,
        SpeakingPersona persona,
        SpeakingResponseSchema responseSchema,
        SpeakingSessionMode sessionMode,
        String interviewPosition,
        String experienceLevel,
        int turnCount,
        InterviewPromptContext interviewContext,
        /**
         * Đ4: schema V1 có sinh 2 suggestions trong lượt chat không. Mặc định {@code true} (hành vi
         * gốc); {@code ChatPrepService} đặt {@code false} khi config {@code speaking.suggestionsMode}
         * = on_demand — khi đó client lấy gợi ý qua endpoint riêng, tiết kiệm ~⅓ completion token.
         */
        Boolean includeSuggestions
) {
    public SpeakingPromptRequest {
        knownInterests = knownInterests == null ? List.of() : List.copyOf(knownInterests);
        weakPoints = weakPoints == null ? List.of() : List.copyOf(weakPoints);
        persona = persona == null ? SpeakingPersona.DEFAULT : persona;
        responseSchema = responseSchema == null ? SpeakingResponseSchema.V1 : responseSchema;
        sessionMode = sessionMode == null ? SpeakingSessionMode.COMMUNICATION : sessionMode;
        includeSuggestions = includeSuggestions == null || includeSuggestions;
    }
}
