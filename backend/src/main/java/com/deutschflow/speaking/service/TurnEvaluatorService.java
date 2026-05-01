package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.entity.SpeakingTurnEvaluation;
import com.deutschflow.speaking.entity.SpeakingUserState;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.SpeakingTurnEvaluationRepository;
import com.deutschflow.speaking.repository.SpeakingUserStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TurnEvaluatorService {

    private final SpeakingTurnEvaluationRepository evaluationRepository;
    private final SpeakingUserStateRepository stateRepository;
    private final SpeakingMetrics speakingMetrics;
    private final AdaptivePolicyService adaptivePolicyService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Value("${app.speaking.adaptive.enabled:true}")
    private boolean adaptiveEnabled;

    @Transactional
    public void recordTurn(Long userId,
                           Long sessionId,
                           Long assistantMessageId,
                           AiResponseDto parsed,
                           SpeakingPolicy policyAtTurn) {
        if (!adaptiveEnabled || policyAtTurn == null || !policyAtTurn.enabled()) {
            return;
        }

        List<ErrorItem> errs = parsed.errors() != null ? parsed.errors() : List.of();
        int errCount = errs.size();
        int majorPlus = (int) errs.stream()
                .filter(e -> {
                    String s = GrammarErrorSeverity.normalizeToStored(
                            e.severity() != null ? e.severity() : GrammarErrorSeverity.MINOR.name());
                    return GrammarErrorSeverity.MAJOR.name().equals(s)
                            || GrammarErrorSeverity.BLOCKING.name().equals(s);
                })
                .count();

        Set<String> focusLower = policyAtTurn.focusCodes().stream()
                .map(c -> c.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        boolean focusHit = errs.stream().anyMatch(e ->
                e.errorCode() != null && focusLower.contains(e.errorCode().toLowerCase(Locale.ROOT)));

        SpeakingTurnEvaluation row = SpeakingTurnEvaluation.builder()
                .turnId(assistantMessageId)
                .userId(userId)
                .sessionId(sessionId)
                .errorCount(errCount)
                .majorPlusCount(majorPlus)
                .focusHit(focusHit)
                .difficultyAtTurn((short) policyAtTurn.difficultyKnob())
                .build();
        evaluationRepository.save(row);

        if (focusHit) {
            String matched = policyAtTurn.focusCodes().stream()
                    .filter(c -> errs.stream().anyMatch(e -> c.equalsIgnoreCase(e.errorCode())))
                    .findFirst()
                    .orElse("unknown");
            speakingMetrics.recordPolicyFocusHit(matched);
        }

        SpeakingUserState state = adaptivePolicyService.getOrCreateState(userId);
        updateRepairCooldownState(state, errs, policyAtTurn);
        int window = Math.max(3, Math.min(20, state.getRollingWindow()));
        List<SpeakingTurnEvaluation> recent = evaluationRepository.findRecentByUserId(userId, PageRequest.of(0, window));
        long noMajor = recent.stream().filter(e -> e.getMajorPlusCount() == 0).count();
        BigDecimal acc = recent.isEmpty()
                ? BigDecimal.valueOf(100)
                : BigDecimal.valueOf(100.0 * noMajor / recent.size()).setScale(2, RoundingMode.HALF_UP);

        int knob = state.getDifficultyKnob();
        if (acc.compareTo(new BigDecimal("85")) >= 0) {
            knob = Math.min(2, knob + 1);
        } else if (acc.compareTo(new BigDecimal("50")) <= 0) {
            knob = Math.max(-2, knob - 1);
        }

        state.setRollingAccuracyPct(acc);
        state.setDifficultyKnob((short) knob);
        state.setLastEvaluatedTurnId(assistantMessageId);
        stateRepository.save(state);

        speakingMetrics.recordPolicyDifficultyKnob(knob);
        speakingMetrics.recordTurnAccuracy(majorPlus == 0);
    }

    private void updateRepairCooldownState(SpeakingUserState state,
                                          List<ErrorItem> errs,
                                          SpeakingPolicy policyAtTurn) {
        if (state == null || policyAtTurn == null || !policyAtTurn.enabled()) {
            return;
        }
        List<String> focus = policyAtTurn.focusCodes() == null ? List.of() : policyAtTurn.focusCodes();
        if (focus.isEmpty()) {
            return;
        }

        // We only count a "success repair turn" if the current turn has zero structured errors.
        if (errs != null && !errs.isEmpty()) {
            // Reset streaks for any focus code that was hit this turn.
            for (String code : focus) {
                if (code == null || code.isBlank()) continue;
                boolean hit = errs.stream().anyMatch(e -> code.equalsIgnoreCase(e.errorCode()));
                if (hit) {
                    setStreak(state, code, 0);
                }
            }
            persistStreaks(state);
            return;
        }

        // No errors => increment streak for all focus codes; after N, apply cooldown.
        for (String code : focus) {
            if (code == null || code.isBlank()) continue;
            int next = getStreak(state, code) + 1;
            if (next >= 3) {
                adaptivePolicyService.recordCooldownAfterRepair(state.getUserId(), code);
                setStreak(state, code, 0);
            } else {
                setStreak(state, code, next);
            }
        }
        persistStreaks(state);
    }

    private int getStreak(SpeakingUserState state, String code) {
        Map<String, Integer> map = readStreaks(state.getFocusSuccessStreakJson());
        return Math.max(0, map.getOrDefault(code.trim(), 0));
    }

    private void setStreak(SpeakingUserState state, String code, int value) {
        Map<String, Integer> map = readStreaks(state.getFocusSuccessStreakJson());
        map.put(code.trim(), Math.max(0, value));
        try {
            state.setFocusSuccessStreakJson(objectMapper.writeValueAsString(map));
        } catch (Exception e) {
            // best-effort
        }
    }

    private void persistStreaks(SpeakingUserState state) {
        // state is saved by caller anyway; keep as best-effort no-op helper for readability.
    }

    private Map<String, Integer> readStreaks(String json) {
        if (json == null || json.isBlank()) {
            return new HashMap<>();
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> raw = objectMapper.readValue(json, Map.class);
            Map<String, Integer> out = new HashMap<>();
            for (var e : raw.entrySet()) {
                String k = e.getKey();
                Object v = e.getValue();
                if (k == null) continue;
                if (v instanceof Number n) out.put(k, n.intValue());
                else {
                    try { out.put(k, Integer.parseInt(String.valueOf(v))); } catch (Exception ignored) {}
                }
            }
            return out;
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}
