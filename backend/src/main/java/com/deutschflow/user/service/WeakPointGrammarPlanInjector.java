package com.deutschflow.user.service;

import com.deutschflow.speaking.ai.ErrorStructureHints;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Injects one short GRAMMAR session into the learner's <em>next</em> plan week based on top
 * {@link UserErrorSkill} priority (adaptive loop / learning plan bridge).
 */
@Service
@RequiredArgsConstructor
public class WeakPointGrammarPlanInjector {

    private static final DateTimeFormatter ISO_LOCAL = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final UserErrorSkillRepository userErrorSkillRepository;

    public record InjectionResult(
            boolean injected,
            String reason,
            String errorCode,
            Integer week,
            Integer sessionIndex
    ) {
        public static InjectionResult injected(String code, int week, int sessionIndex) {
            return new InjectionResult(true, "INJECTED", code, week, sessionIndex);
        }

        public static InjectionResult skip(String reason, String code) {
            return new InjectionResult(false, reason, code, null, null);
        }

        public static InjectionResult skip(String reason) {
            return new InjectionResult(false, reason, null, null, null);
        }
    }

    /**
     * @param enforceCooldown when {@code true}, blocks a new injection if {@code adaptiveMeta.lastInjectedAt}
     *                        is within the last 24 hours (persist path). Also updates {@code adaptiveMeta}
     *                        only when this is {@code true} and injection succeeds.
     */
    @SuppressWarnings("unchecked")
    public InjectionResult injectWeakPointGrammarSession(long userId,
                                                         Map<String, Object> planObj,
                                                         boolean enforceCooldown) {
        List<UserErrorSkill> skills = userErrorSkillRepository.findByUserIdOrderByPriorityScoreDesc(userId);
        if (skills.isEmpty()) {
            return InjectionResult.skip("NO_SKILLS");
        }
        String code = skills.get(0).getErrorCode();
        if (code == null || code.isBlank()) {
            return InjectionResult.skip("NO_SKILLS");
        }
        String codeTrim = code.trim();

        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeksRaw) || weeksRaw.isEmpty()) {
            return InjectionResult.skip("NO_PLAN_WEEKS", codeTrim);
        }

        Map<String, Object> progress = planObj.get("progress") instanceof Map<?, ?> p
                ? (Map<String, Object>) p
                : Map.of();
        int currentWeek = safeInt(progress.get("currentWeek"), 1);
        int weeksTotal = safeInt(planObj.get("weeksTotal"), 12);
        int targetWeek = Math.min(Math.max(1, currentWeek + 1), Math.max(1, weeksTotal));

        Map<String, Object> weekMap = null;
        for (Object wObj : weeksRaw) {
            if (!(wObj instanceof Map<?, ?>)) {
                continue;
            }
            Map<String, Object> w = (Map<String, Object>) wObj;
            if (safeInt(w.get("week"), -1) == targetWeek) {
                weekMap = w;
                break;
            }
        }
        if (weekMap == null) {
            Object last = weeksRaw.get(weeksRaw.size() - 1);
            if (last instanceof Map<?, ?> lm) {
                weekMap = (Map<String, Object>) lm;
                targetWeek = safeInt(weekMap.get("week"), targetWeek);
            }
        }
        if (weekMap == null) {
            return InjectionResult.skip("NO_PLAN_WEEKS", codeTrim);
        }

        Object sessionsObj = weekMap.get("sessions");
        if (!(sessionsObj instanceof List<?> sessionsList)) {
            return InjectionResult.skip("NO_PLAN_WEEKS", codeTrim);
        }
        List<Map<String, Object>> sessions = new ArrayList<>();
        for (Object s : sessionsList) {
            if (s instanceof Map<?, ?> sm) {
                sessions.add((Map<String, Object>) sm);
            }
        }

        if (enforceCooldown && isWithinCooldown(planObj)) {
            return InjectionResult.skip("COOLDOWN_24H", codeTrim);
        }

        if (alreadyInjected(sessions, codeTrim)) {
            return InjectionResult.skip("DEDUP_WEEK_CODE", codeTrim);
        }

        int maxIdx = 0;
        for (Map<String, Object> s : sessions) {
            maxIdx = Math.max(maxIdx, safeInt(s.get("index"), 0));
        }
        int newIndex = maxIdx + 1;

        String hint = ErrorStructureHints.hintFor(codeTrim);
        List<String> theory = List.of(
                "Adaptive mini-session based on your recent speaking errors.",
                hint
        );
        List<Map<String, Object>> exercises = List.of(
                miniEx("Micro-drill: " + hint, "GRAMMAR", 2, 5),
                miniEx("Quick check: apply the rule in 3 short sentences", "GRAMMAR", 2, 5)
        );

        Map<String, Object> details = new LinkedHashMap<>(Map.of(
                "title", "Grammar focus: " + codeTrim,
                "theory", new ArrayList<>(theory),
                "exercises", new ArrayList<>(exercises)
        ));

        Map<String, Object> contentRef = new LinkedHashMap<>(Map.of(
                "module", "GRAMMAR",
                "weakPointErrorCode", codeTrim,
                "source", "adaptive_speaking_skills"
        ));

        Map<String, Object> newSession = new LinkedHashMap<>(Map.of(
                "index", newIndex,
                "type", "GRAMMAR",
                "minutes", 10,
                "tags", List.of("ADAPTIVE_WEAK_POINT", codeTrim),
                "skills", List.of("GRAMMAR"),
                "difficulty", 2,
                "weakPointAdaptive", true,
                "weakPointErrorCode", codeTrim,
                "contentRef", contentRef,
                "details", details
        ));

        sessions.add(newSession);
        weekMap.put("sessions", sessions);

        if (enforceCooldown) {
            touchAdaptiveMeta(planObj, codeTrim, targetWeek);
        }

        return InjectionResult.injected(codeTrim, targetWeek, newIndex);
    }

    @SuppressWarnings("unchecked")
    private static void touchAdaptiveMeta(Map<String, Object> planObj, String code, int targetWeek) {
        Map<String, Object> meta = planObj.get("adaptiveMeta") instanceof Map<?, ?> m
                ? new LinkedHashMap<>((Map<String, Object>) m)
                : new LinkedHashMap<>();
        meta.put("lastInjectedAt", LocalDateTime.now().format(ISO_LOCAL));
        meta.put("lastErrorCode", code);
        meta.put("lastInjectedWeek", targetWeek);
        int prev = 0;
        Object c = meta.get("count");
        if (c instanceof Number n) {
            prev = n.intValue();
        }
        meta.put("count", prev + 1);
        planObj.put("adaptiveMeta", meta);
    }

    private static boolean isWithinCooldown(Map<String, Object> planObj) {
        Object metaObj = planObj.get("adaptiveMeta");
        if (!(metaObj instanceof Map<?, ?> m)) {
            return false;
        }
        Object raw = m.get("lastInjectedAt");
        if (raw == null) {
            return false;
        }
        try {
            LocalDateTime last = LocalDateTime.parse(String.valueOf(raw).trim(), ISO_LOCAL);
            return LocalDateTime.now().isBefore(last.plusHours(24));
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private static boolean alreadyInjected(List<Map<String, Object>> sessions, String code) {
        for (Map<String, Object> s : sessions) {
            if (Boolean.TRUE.equals(s.get("weakPointAdaptive"))) {
                Object c = s.get("weakPointErrorCode");
                if (c != null && code.equalsIgnoreCase(String.valueOf(c).trim())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static Map<String, Object> miniEx(String title, String skill, int difficulty, int minutes) {
        return new LinkedHashMap<>(Map.of(
                "title", title,
                "skill", skill,
                "difficulty", difficulty,
                "minutes", minutes
        ));
    }

    private static int safeInt(Object v, int fallback) {
        if (v == null) {
            return fallback;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (Exception e) {
            return fallback;
        }
    }
}
