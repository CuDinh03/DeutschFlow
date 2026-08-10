package com.deutschflow.speaking.dto;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Locale;

/**
 * Phần adaptive được phép RỜI KHỎI server (QA 09/08 mục D — lần rò rỉ thứ HAI của dải
 * adaptive). {@code cefrEffective}, {@code difficultyKnob}, {@code focusCodes},
 * {@code targetStructures} là cơ chế nội bộ lái prompt — đã bị hiển thị nhầm 2 lần
 * (04/08: focusCodes; 09/08: cefrEffective + targetStructures). Chốt chặn ở tầng DTO:
 * dữ liệu không xuống client thì không UI nào — web/mobile, nay hay mai — hiển thị lại được.
 * {@code SpeakingPolicy} phía server giữ nguyên đủ trường.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdaptiveMetaDto(
        boolean enabled,
        String topicSuggestion,
        boolean forceRepairBeforeContinue,
        String primaryRepairErrorCode
) {
    /**
     * Client hints after this assistant turn: force drill if model emitted BLOCKING structured errors.
     *
     * @param sessionTopic chủ đề PHIÊN — nguồn của {@code topicSuggestion} hiển thị. Bản cũ lấy
     *                     {@code policy.topicSuggestion()} từ kế hoạch học trong ngày nên cả ba
     *                     phiên QA đều hiện "→ Sport" giữa hội thoại về phim/kiến trúc/bảng chữ cái.
     */
    public static AdaptiveMetaDto fromPolicyAndResponse(SpeakingPolicy promptPolicy, AiResponseDto parsed,
                                                        String sessionTopic) {
        if (promptPolicy == null || !promptPolicy.enabled() || parsed == null) {
            return null;
        }
        List<ErrorItem> errs = parsed.errors() != null ? parsed.errors() : List.of();
        String primary = null;
        boolean force = false;
        for (ErrorItem e : errs) {
            String sev = GrammarErrorSeverity.normalizeToStored(
                    e.severity() != null ? e.severity() : GrammarErrorSeverity.MINOR.name());
            if (GrammarErrorSeverity.BLOCKING.name().equals(sev) && e.errorCode() != null && !e.errorCode().isBlank()) {
                force = true;
                if (primary == null) {
                    primary = e.errorCode().trim();
                }
            }
        }
        String topic = sessionTopic != null && !sessionTopic.isBlank() ? sessionTopic.trim() : null;
        return new AdaptiveMetaDto(true, topic, force, primary);
    }
}
