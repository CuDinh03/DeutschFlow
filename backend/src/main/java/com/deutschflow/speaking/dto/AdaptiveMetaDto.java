package com.deutschflow.speaking.dto;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Locale;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdaptiveMetaDto(
        boolean enabled,
        String cefrEffective,
        int difficultyKnob,
        List<String> focusCodes,
        List<String> targetStructures,
        String topicSuggestion,
        boolean forceRepairBeforeContinue,
        String primaryRepairErrorCode
) {
    public static AdaptiveMetaDto fromPolicy(SpeakingPolicy p) {
        if (p == null || !p.enabled()) {
            return null;
        }
        return new AdaptiveMetaDto(
                true,
                p.cefrEffective(),
                p.difficultyKnob(),
                p.focusCodes(),
                p.targetStructures(),
                p.topicSuggestion(),
                p.forceRepairBeforeContinue(),
                p.primaryRepairErrorCode()
        );
    }

    /** Client hints after this assistant turn: force drill if model emitted BLOCKING structured errors. */
    public static AdaptiveMetaDto fromPolicyAndResponse(SpeakingPolicy promptPolicy, AiResponseDto parsed) {
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
        return new AdaptiveMetaDto(
                true,
                promptPolicy.cefrEffective(),
                promptPolicy.difficultyKnob(),
                promptPolicy.focusCodes(),
                promptPolicy.targetStructures(),
                promptPolicy.topicSuggestion(),
                force,
                primary
        );
    }
}
