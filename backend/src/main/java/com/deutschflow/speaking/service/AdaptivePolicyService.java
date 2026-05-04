package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.ErrorStructureHints;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.TodayPlanDto;
import com.deutschflow.speaking.dto.TodayProgressDto;
import com.deutschflow.speaking.dto.TodayRecommendedDto;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.ErrorReviewTask;
import com.deutschflow.speaking.entity.SpeakingUserState;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.ErrorReviewTaskRepository;
import com.deutschflow.speaking.repository.SpeakingUserStateRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdaptivePolicyService {

    private static final DateTimeFormatter COOLDOWN_FMT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private static final String[] FALLBACK_TOPICS = {
            "Alltag", "Reise", "Beruf", "Freizeit", "Essen", "Familie"
    };

    private final SpeakingUserStateRepository stateRepository;
    private final ErrorReviewTaskRepository taskRepository;
    private final UserErrorSkillRepository skillRepository;
    private final AiSpeakingSessionRepository sessionRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.speaking.adaptive.enabled:true}")
    private boolean adaptiveEnabled;

    @Transactional
    public SpeakingUserState getOrCreateState(Long userId) {
        return stateRepository.findById(userId).orElseGet(() ->
                stateRepository.save(SpeakingUserState.builder()
                        .userId(userId)
                        .rollingAccuracyPct(new BigDecimal("100.00"))
                        .rollingWindow(8)
                        .difficultyKnob((short) 0)
                        .build()));
    }

    /**
     * @param session active speaking session, or {@code null} for dashboard-only policy (no session topic).
     */
    @Transactional
    public SpeakingPolicy computePolicy(Long userId, AiSpeakingSession session,
                                        UserLearningProfile profile,
                                        List<String> knownInterests) {
        UserLearningProfile p = profile != null ? profile : minimalProfileForAdaptive();
        if (!adaptiveEnabled) {
            return SpeakingPolicy.disabled(resolveBaseCefr(session, p));
        }

        SpeakingUserState state = getOrCreateState(userId);
        LocalDateTime now = LocalDateTime.now();

        List<String> cooldownActive = parseActiveCooldownCodes(state.getCooldownCodesJson(), now);
        List<String> focusCodes = buildFocusCodes(userId, now, cooldownActive);

        String baseCefr = resolveBaseCefr(session, p);
        int knob = state.getDifficultyKnob();
        String effectiveCefr = SpeakingCefrSupport.applyKnobClamp(baseCefr, knob, p);

        List<String> structures = ErrorStructureHints.hintsFor(focusCodes);
        List<String> banned = new ArrayList<>(cooldownActive);

        String topicSuggestion = pickTopicSuggestion(userId, session, state, knownInterests, now,
                state.getRollingAccuracyPct());

        persistFocusSnapshot(state, focusCodes);

        String explanation = "Focus: " + String.join(", ", focusCodes)
                + " | knob=" + knob + " | rollingAcc=" + state.getRollingAccuracyPct();

        return new SpeakingPolicy(
                true,
                effectiveCefr,
                knob,
                List.copyOf(focusCodes),
                banned,
                structures,
                topicSuggestion,
                false,
                null,
                explanation
        );
    }

    @Transactional
    public void recordCooldownAfterRepair(Long userId, String errorCode) {
        if (!cooldownPreconditions(errorCode)) {
            return;
        }
        applyCooldownEntries(getOrCreateState(userId), errorCode.trim());
    }

    /** Like {@link #recordCooldownAfterRepair(Long, String)} but updates the given managed row (avoids duplicate instances in one transaction). */
    @Transactional
    public void recordCooldownAfterRepair(SpeakingUserState state, String errorCode) {
        if (state == null || !cooldownPreconditions(errorCode)) {
            return;
        }
        applyCooldownEntries(state, errorCode.trim());
    }

    private boolean cooldownPreconditions(String errorCode) {
        return adaptiveEnabled && errorCode != null && !errorCode.isBlank();
    }

    private void applyCooldownEntries(SpeakingUserState state, String trimmedCode) {
        LocalDateTime until = LocalDateTime.now().plusHours(24);
        List<CooldownEntry> entries = readCooldownEntries(state.getCooldownCodesJson());
        entries.removeIf(e -> e.code().equalsIgnoreCase(trimmedCode));
        entries.add(new CooldownEntry(trimmedCode, until.format(COOLDOWN_FMT)));
        entries.removeIf(e -> e.untilDateTime().isBefore(LocalDateTime.now()));
        try {
            state.setCooldownCodesJson(objectMapper.writeValueAsString(entries));
            stateRepository.save(state);
        } catch (Exception e) {
            log.warn("Failed to persist cooldown: {}", e.getMessage());
        }
    }

    @Transactional
    public TodayPlanDto todayPlanForUser(Long userId, UserLearningProfile profile, List<String> knownInterests,
                                         int streakDays) {
        List<ErrorReviewTask> due = taskRepository.findDueTasks(userId, "PENDING", LocalDateTime.now(),
                PageRequest.of(0, 5));
        SpeakingUserState state = stateRepository.findById(userId).orElse(null);
        SpeakingPolicy policy = computePolicy(userId, null, profile, knownInterests);
        return computeTodayPlan(userId, due, state, policy, streakDays);
    }

    @Transactional(readOnly = true)
    public TodayPlanDto computeTodayPlan(Long userId,
                                         List<ErrorReviewTask> dueTasks,
                                         SpeakingUserState stateSnapshot,
                                         SpeakingPolicy policy,
                                         int streakDays) {
        List<TodayPlanDto.DueRepairTaskDto> due = dueTasks.stream()
                .map(t -> new TodayPlanDto.DueRepairTaskDto(
                        t.getId(), t.getErrorCode(), t.getTaskType(), t.getDueAt(), t.getIntervalDays()))
                .toList();

        String speakTopic = policy != null ? policy.topicSuggestion() : "Alltag";
        String speakCefr = policy != null ? policy.cefrEffective() : SpeakingCefrSupport.DEFAULT_BAND;
        TodayRecommendedDto speaking = new TodayRecommendedDto(
                "/speaking?topic=" + urlEncode(speakTopic != null ? speakTopic : "Alltag")
                        + "&cefr=" + urlEncode(speakCefr != null ? speakCefr : SpeakingCefrSupport.DEFAULT_BAND),
                speakTopic,
                speakCefr,
                policy != null ? policy.targetStructures() : List.of()
        );
        String vocabTopic = policy != null && policy.topicSuggestion() != null
                ? policy.topicSuggestion()
                : (policy != null && !policy.focusCodes().isEmpty() ? policy.focusCodes().get(0) : "Alltag");
        TodayRecommendedDto vocab = new TodayRecommendedDto(
                "/student/vocab-practice?topic=" + urlEncode(vocabTopic)
                        + (policy != null && !policy.focusCodes().isEmpty()
                        ? "&focus=" + urlEncode(policy.focusCodes().get(0)) : ""),
                vocabTopic,
                policy != null ? policy.cefrEffective() : SpeakingCefrSupport.DEFAULT_BAND,
                policy != null ? policy.focusCodes() : List.of()
        );

        BigDecimal roll = stateSnapshot != null ? stateSnapshot.getRollingAccuracyPct() : new BigDecimal("100");
        String topWeak = policy != null && !policy.focusCodes().isEmpty() ? policy.focusCodes().get(0) : null;
        TodayProgressDto progress = new TodayProgressDto(
                roll.setScale(1, RoundingMode.HALF_UP).doubleValue(),
                Math.max(0, streakDays),
                topWeak
        );
        String weeklyCefr = speakCefr != null ? speakCefr : SpeakingCefrSupport.DEFAULT_BAND;
        TodayRecommendedDto weekly = new TodayRecommendedDto(
                "/student/weekly-speaking?cefBand=" + urlEncode(weeklyCefr),
                null,
                weeklyCefr,
                policy != null ? policy.targetStructures() : List.of()
        );
        return new TodayPlanDto(due, speaking, weekly, vocab, progress);
    }

    private static String urlEncode(String s) {
        if (s == null) {
            return "";
        }
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }

    private void persistFocusSnapshot(SpeakingUserState state, List<String> focusCodes) {
        try {
            state.setCurrentFocusCodesJson(objectMapper.writeValueAsString(focusCodes));
            stateRepository.save(state);
        } catch (Exception e) {
            log.debug("Could not persist focus snapshot: {}", e.getMessage());
        }
    }

    private List<String> buildFocusCodes(Long userId, LocalDateTime now, List<String> cooldownActive) {
        Set<String> cooldownLower = cooldownActive.stream()
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        LinkedHashSet<String> out = new LinkedHashSet<>();

        List<ErrorReviewTask> due = taskRepository.findDueTasks(userId, "PENDING", now, PageRequest.of(0, 5));
        for (ErrorReviewTask t : due) {
            if (out.size() >= 2) {
                break;
            }
            if (t.getErrorCode() != null && !cooldownLower.contains(t.getErrorCode().toLowerCase(Locale.ROOT))) {
                out.add(t.getErrorCode().trim());
            }
        }

        List<UserErrorSkill> skills = skillRepository.findByUserIdOrderByPriorityScoreDesc(userId);
        for (UserErrorSkill s : skills) {
            if (out.size() >= 3) {
                break;
            }
            String c = s.getErrorCode();
            if (c == null || c.isBlank()) {
                continue;
            }
            if (cooldownLower.contains(c.toLowerCase(Locale.ROOT))) {
                continue;
            }
            out.add(c.trim());
        }
        return new ArrayList<>(out);
    }

    private String resolveBaseCefr(AiSpeakingSession session, UserLearningProfile profile) {
        if (session != null && session.getCefrLevel() != null && !session.getCefrLevel().isBlank()) {
            return SpeakingCefrSupport.clampToProfileRange(session.getCefrLevel(), profile);
        }
        return SpeakingCefrSupport.floorPracticeBand(profile);
    }

    /** Fallback profile when onboarding row missing — conservative beginner ceiling. */
    private static UserLearningProfile minimalProfileForAdaptive() {
        return UserLearningProfile.builder()
                .currentLevel(UserLearningProfile.CurrentLevel.A0)
                .targetLevel(UserLearningProfile.TargetLevel.A1)
                .build();
    }

    private String pickTopicSuggestion(Long userId,
                                       AiSpeakingSession session,
                                       SpeakingUserState state,
                                       List<String> interests,
                                       LocalDateTime now,
                                       BigDecimal rollingAccuracy) {
        if (session != null && session.getTopic() != null && !session.getTopic().isBlank()) {
            if (state.getLastTopicAt() != null
                    && state.getLastTopic() != null
                    && state.getLastTopic().equalsIgnoreCase(session.getTopic())
                    && state.getLastTopicAt().isAfter(now.minusHours(24))
                    && rollingAccuracy != null
                    && rollingAccuracy.compareTo(new BigDecimal("70")) >= 0) {
                return session.getTopic();
            }
        }

        Set<String> recentTopics = sessionRepository.findTop7ByUserIdOrderByStartedAtDesc(userId)
                .stream()
                .map(AiSpeakingSession::getTopic)
                .filter(t -> t != null && !t.isBlank())
                .map(t -> t.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        if (interests != null) {
            for (String interest : interests) {
                if (interest == null || interest.isBlank()) {
                    continue;
                }
                String key = interest.trim().toLowerCase(Locale.ROOT);
                if (!recentTopics.contains(key)) {
                    return interest.trim();
                }
            }
        }
        for (String t : FALLBACK_TOPICS) {
            if (!recentTopics.contains(t.toLowerCase(Locale.ROOT))) {
                return t;
            }
        }
        return FALLBACK_TOPICS[0];
    }

    private List<String> parseActiveCooldownCodes(String json, LocalDateTime now) {
        return readCooldownEntries(json).stream()
                .filter(e -> e.untilDateTime().isAfter(now))
                .map(CooldownEntry::code)
                .toList();
    }

    private List<CooldownEntry> readCooldownEntries(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(objectMapper.readValue(json, new TypeReference<List<CooldownEntry>>() {}));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private record CooldownEntry(String code, String untilIso) {
        LocalDateTime untilDateTime() {
            return LocalDateTime.parse(untilIso, COOLDOWN_FMT);
        }
    }
}
