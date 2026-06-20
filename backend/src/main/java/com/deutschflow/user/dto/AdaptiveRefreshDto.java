package com.deutschflow.user.dto;

import com.deutschflow.user.service.WeakPointGrammarPlanInjector.InjectionResult;

/**
 * Response of {@code POST /api/plan/me/adaptive-refresh} — mirrors the legacy {@code LinkedHashMap}
 * 1:1 (keys + order: injected, reason, errorCode, week, sessionIndex; nulls kept, not omitted). Built
 * from the injector's {@link InjectionResult}.
 */
public record AdaptiveRefreshDto(
        boolean injected,
        String reason,
        String errorCode,
        Integer week,
        Integer sessionIndex) {

    public static AdaptiveRefreshDto from(InjectionResult r) {
        return new AdaptiveRefreshDto(r.injected(), r.reason(), r.errorCode(), r.week(), r.sessionIndex());
    }
}
