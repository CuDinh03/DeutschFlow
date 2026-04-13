package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.SessionDetailResponse;
import com.deutschflow.user.entity.LearningPlan;
import com.deutschflow.user.entity.LearningSessionState;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningSessionStateRepository;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SessionExerciseService {

    private final TheoryLessonLoader theoryLessonLoader;
    private final UserLearningProfileRepository profileRepository;
    private final LearningSessionStateRepository sessionStateRepository;
    private final ObjectMapper objectMapper;

    public SessionDetailResponse buildSession(
            User user,
            LearningPlan plan,
            Map<String, Object> planObj,
            int week,
            int sessionIndex,
            Map<String, Object> sessionFromPlan,
            String uiLang,
            boolean theoryGatePassed,
            boolean includeSensitiveContent
    ) {
        String type = sessionTypeString(sessionFromPlan);
        int minutes = safeInt(sessionFromPlan.getOrDefault("minutes", plan.getMinutesPerSession()), plan.getMinutesPerSession());
        int difficulty = safeInt(sessionFromPlan.getOrDefault("difficulty", 3), 3);

        String normalized = normalize(type);
        SessionDetailResponse.TheoryLesson theoryLesson = theoryLessonLoader.lesson(week, sessionIndex, normalized, uiLang);
        List<String> theory = mergeTheoryBullets(extractTheory(sessionFromPlan), theoryLesson.focusBullets());

        SessionDetailResponse.TheoryLesson previousTheory = null;
        PrevRef prev = findPreviousSession(planObj, week, sessionIndex);
        if (prev != null) {
            String prevType = sessionTypeString(prev.session());
            String prevNorm = normalize(prevType);
            previousTheory = theoryLessonLoader.lesson(prev.week(), prev.sessionIndex(), prevNorm, uiLang);
        }

        var profile = profileRepository.findByUserId(user.getId()).orElse(null);
        String industry = profile != null ? profile.getIndustry() : null;
        List<String> interests = TheoryBasedExerciseGenerator.parseInterestTags(
                profile != null ? profile.getInterestsJson() : null, objectMapper);

        List<SessionDetailResponse.ExerciseItem> theoryGateExercises = TheoryBasedExerciseGenerator.generateTheoryGate(
                user.getId(),
                week,
                sessionIndex,
                theoryLesson,
                industry,
                interests,
                minutes,
                difficulty,
                uiLang,
                objectMapper
        );

        List<SessionDetailResponse.ExerciseItem> exercises = TheoryBasedExerciseGenerator.generate(
                user.getId(),
                week,
                sessionIndex,
                normalized,
                theoryLesson,
                previousTheory,
                industry,
                interests,
                minutes,
                difficulty,
                uiLang,
                objectMapper
        );

        List<SessionDetailResponse.ExerciseItem> gateOut = includeSensitiveContent
                ? theoryGateExercises
                : theoryGateExercises.stream().map(SessionExerciseService::withoutExplanation).toList();
        List<SessionDetailResponse.ExerciseItem> mainOut = includeSensitiveContent
                ? exercises
                : exercises.stream().map(SessionExerciseService::withoutExplanation).toList();

        return new SessionDetailResponse(
                week,
                sessionIndex,
                type,
                minutes,
                difficulty,
                theory,
                theoryLesson,
                gateOut,
                theoryGatePassed,
                mainOut
        );
    }

    private static SessionDetailResponse.ExerciseItem withoutExplanation(SessionDetailResponse.ExerciseItem ex) {
        if (ex.explanation() == null) {
            return ex;
        }
        return new SessionDetailResponse.ExerciseItem(
                ex.id(),
                ex.title(),
                ex.skill(),
                ex.difficulty(),
                ex.minutes(),
                ex.question(),
                ex.options(),
                ex.format(),
                ex.correctOptionIndex(),
                ex.expectedAnswerNormalized(),
                ex.audioGerman(),
                null
        );
    }

    private record PrevRef(int week, int sessionIndex, Map<String, Object> session) {}

    private PrevRef findPreviousSession(Map<String, Object> planObj, int week, int sessionIndex) {
        if (sessionIndex > 1) {
            Map<String, Object> s = findSessionSilently(planObj, week, sessionIndex - 1);
            if (s != null) {
                return new PrevRef(week, sessionIndex - 1, s);
            }
        }
        if (week > 1) {
            int last = lastSessionIndexInWeek(planObj, week - 1);
            if (last >= 1) {
                Map<String, Object> s = findSessionSilently(planObj, week - 1, last);
                if (s != null) {
                    return new PrevRef(week - 1, last, s);
                }
            }
        }
        return null;
    }

    private int lastSessionIndexInWeek(Map<String, Object> planObj, int week) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks)) {
            return 0;
        }
        for (Object wObj : weeks) {
            if (!(wObj instanceof Map<?, ?>)) continue;
            Map<String, Object> w = (Map<String, Object>) wObj;
            if (safeInt(w.get("week"), -1) != week) continue;
            Object sessionsObj = w.get("sessions");
            if (!(sessionsObj instanceof List<?> sessions) || sessions.isEmpty()) {
                return 0;
            }
            int maxIdx = 0;
            for (Object sObj : sessions) {
                if (!(sObj instanceof Map<?, ?>)) continue;
                Map<String, Object> s = (Map<String, Object>) sObj;
                maxIdx = Math.max(maxIdx, safeInt(s.get("index"), 0));
            }
            return maxIdx;
        }
        return 0;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> findSessionSilently(Map<String, Object> planObj, int week, int sessionIndex) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks)) {
            return null;
        }
        for (Object wObj : weeks) {
            if (!(wObj instanceof Map<?, ?>)) continue;
            Map<String, Object> w = (Map<String, Object>) wObj;
            if (safeInt(w.get("week"), -1) != week) continue;
            Object sessionsObj = w.get("sessions");
            if (!(sessionsObj instanceof List<?> sessions)) {
                return null;
            }
            for (Object sObj : sessions) {
                if (!(sObj instanceof Map<?, ?>)) continue;
                Map<String, Object> s = (Map<String, Object>) sObj;
                if (safeInt(s.get("index"), -1) == sessionIndex) {
                    return s;
                }
            }
        }
        return null;
    }

    public boolean isAnswerCorrect(SessionDetailResponse.ExerciseItem ex, Object rawAnswer) {
        if (rawAnswer == null) {
            return false;
        }
        String fmt = ex.format() == null ? "MC" : ex.format();
        if ("TEXT".equals(fmt) || "SPEAK_REPEAT".equals(fmt)) {
            String exp = ex.expectedAnswerNormalized();
            if (exp == null || exp.isBlank()) {
                return false;
            }
            return TheoryBasedExerciseGenerator.textMatches(exp, String.valueOf(rawAnswer));
        }
        if ("MC".equals(fmt) || "TRUE_FALSE".equals(fmt) || "ORDER_MC".equals(fmt)) {
            if (ex.correctOptionIndex() == null) {
                return false;
            }
            int chosen = parseIntAnswer(rawAnswer);
            return chosen == ex.correctOptionIndex();
        }
        if ("ORDER_DRAG".equals(fmt)) {
            String exp = ex.expectedAnswerNormalized();
            if (exp == null || exp.isBlank()) {
                return false;
            }
            return TheoryBasedExerciseGenerator.normalizeOrderDragAnswer(exp)
                    .equals(TheoryBasedExerciseGenerator.normalizeOrderDragAnswer(String.valueOf(rawAnswer)));
        }
        return false;
    }

    private static int parseIntAnswer(Object v) {
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (Exception e) {
            return -1;
        }
    }

    public SessionDetailResponse.ExerciseItem getExerciseById(
            User user,
            LearningPlan plan,
            Map<String, Object> planObj,
            int week,
            int sessionIndex,
            Map<String, Object> sessionFromPlan,
            String exerciseId,
            String uiLang
    ) {
        boolean theoryGatePassed = sessionStateRepository
                .findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .map(LearningSessionState::isTheoryViewed)
                .orElse(false);
        SessionDetailResponse detail = buildSession(user, plan, planObj, week, sessionIndex, sessionFromPlan, uiLang, theoryGatePassed, false);
        return detail.exercises().stream()
                .filter(e -> e.id().equals(exerciseId))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Unknown exerciseId"));
    }

    private List<String> mergeTheoryBullets(List<String> fromPlan, List<String> focusBullets) {
        java.util.ArrayList<String> out = new java.util.ArrayList<>();
        for (String s : fromPlan) {
            if (s != null && !s.isBlank() && !out.contains(s)) {
                out.add(s);
            }
        }
        for (String s : focusBullets) {
            if (s != null && !s.isBlank() && !out.contains(s)) {
                out.add(s);
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<String> extractTheory(Map<String, Object> sessionFromPlan) {
        Object details = sessionFromPlan.get("details");
        if (details instanceof Map<?, ?> d) {
            Object t = ((Map<String, Object>) d).get("theory");
            if (t instanceof List<?> l) {
                java.util.ArrayList<String> out = new java.util.ArrayList<>();
                for (Object o : l) {
                    out.add(String.valueOf(o));
                }
                return out;
            }
        }
        return List.of();
    }

    public static String sessionTypeString(Map<String, Object> sessionFromPlan) {
        Object raw = sessionFromPlan != null ? sessionFromPlan.get("type") : null;
        if (raw instanceof String s && !s.isBlank()) {
            return s;
        }
        return "GRAMMAR";
    }

    private String normalize(String type) {
        return String.valueOf(type).trim().toUpperCase(Locale.ROOT);
    }

    private int safeInt(Object v, int fallback) {
        if (v == null) {
            return fallback;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
