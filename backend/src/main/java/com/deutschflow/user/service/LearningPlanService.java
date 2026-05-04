package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.LearningSessionAttemptSummaryDto;
import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.LearningPlan;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class LearningPlanService {
    private final UserLearningProfileService userLearningProfileService;
    private final LearningPlanBlueprintBuilder learningPlanBlueprintBuilder;
    private final StoredLearningPlanSupport storedLearningPlanSupport;
    private final LearningSessionProgressService learningSessionProgressService;
    private final LearningSessionWorkflowService learningSessionWorkflowService;

    private final UserLearningProfileRepository profileRepository;
    private final LearningPlanRepository planRepository;
    private final com.deutschflow.user.repository.LearningSessionProgressRepository progressRepository;
    private final com.deutschflow.user.repository.LearningSessionStateRepository sessionStateRepository;
    private final com.deutschflow.user.repository.LearningSessionAttemptRepository sessionAttemptRepository;
    private final SessionExerciseService sessionExerciseService;
    private final WeakPointGrammarPlanInjector weakPointGrammarPlanInjector;
    private final ObjectMapper objectMapper;

    @Transactional
    public LearningPlanResponse saveProfileAndGeneratePlan(User user, OnboardingProfileRequest req) {
        UserLearningProfile profile = userLearningProfileService.upsertProfile(user, req);
        Map<String, Object> plan = learningPlanBlueprintBuilder.build(profile);
        int weeklyMinutes = profile.getSessionsPerWeek() * profile.getMinutesPerSession();
        int weeksTotal = (int) plan.getOrDefault("weeksTotal", 8);

        LearningPlan lp = planRepository.findByUserId(user.getId())
                .orElse(LearningPlan.builder().user(user).build());
        lp.setProfile(profile);
        lp.setGoalType(profile.getGoalType());
        lp.setTargetLevel(profile.getTargetLevel());
        lp.setCurrentLevel(profile.getCurrentLevel());
        lp.setSessionsPerWeek(profile.getSessionsPerWeek());
        lp.setMinutesPerSession(profile.getMinutesPerSession());
        lp.setWeeklyMinutes(weeklyMinutes);
        lp.setWeeksTotal(weeksTotal);
        lp.setPlanJson(storedLearningPlanSupport.toJson(plan));

        planRepository.save(lp);
        return new LearningPlanResponse(weeklyMinutes, weeksTotal, plan);
    }

    @Transactional(readOnly = true)
    public LearningPlanResponse getMyPlan(User user) {
        LearningPlan plan = planRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning plan not found"));
        Map<String, Object> planObj = storedLearningPlanSupport.fromJsonMap(plan.getPlanJson());
        storedLearningPlanSupport.enrichMissingSessionDetails(planObj);
        learningSessionProgressService.attachProgressSummary(user.getId(), planObj);
        weakPointGrammarPlanInjector.injectWeakPointGrammarSession(user.getId(), planObj, false);
        PlanObjectiveLocalization.localizeWeekObjectives(planObj, user.getLocale());
        return new LearningPlanResponse(plan.getWeeklyMinutes(), plan.getWeeksTotal(), planObj);
    }

    /**
     * Persists an adaptive weak-point mini-session into stored {@code plan_json} (max once per 24h when enforced in injector).
     */
    @Transactional
    public WeakPointGrammarPlanInjector.InjectionResult persistAdaptiveRefresh(User user) {
        LearningPlan lp = planRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning plan not found"));
        Map<String, Object> planObj = storedLearningPlanSupport.fromJsonMap(lp.getPlanJson());
        storedLearningPlanSupport.enrichMissingSessionDetails(planObj);
        learningSessionProgressService.attachProgressSummary(user.getId(), planObj);
        WeakPointGrammarPlanInjector.InjectionResult res =
                weakPointGrammarPlanInjector.injectWeakPointGrammarSession(user.getId(), planObj, true);
        if (res.injected()) {
            planObj.remove("progress");
            lp.setPlanJson(storedLearningPlanSupport.toJson(planObj));
            planRepository.save(lp);
        }
        return res;
    }

    @Transactional(readOnly = true)
    public boolean hasPlan(User user) {
        return planRepository.findByUserId(user.getId()).isPresent();
    }

    @Transactional
    public void markSessionCompleted(User user, int week, int sessionIndex, Double abilityScore, Double timeSeconds) {
        learningSessionProgressService.markSessionCompleted(user, week, sessionIndex, abilityScore, timeSeconds);
    }

    @Transactional
    public void markTheoryViewed(User user, int week, int sessionIndex) {
        learningSessionWorkflowService.markTheoryViewed(user, week, sessionIndex);
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public com.deutschflow.user.dto.SessionDetailResponse getSessionDetail(User user, int week, int sessionIndex) {
        return learningSessionWorkflowService.getSessionDetail(user, week, sessionIndex);
    }

    @Transactional
    public com.deutschflow.user.dto.SessionSubmitResponse submitSession(User user, com.deutschflow.user.dto.SessionSubmitRequest req) {
        return learningSessionWorkflowService.submitSession(user, req);
    }

    private com.deutschflow.user.dto.SessionSubmitResponse submitTheoryGate(
            User user,
            LearningPlan plan,
            Map<String, Object> planObj,
            int week,
            int sessionIndex,
            Map<String, Object> session,
            String uiLang,
            com.deutschflow.user.dto.SessionSubmitRequest req
    ) {
        com.deutschflow.user.entity.LearningSessionState st = sessionStateRepository
                .findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .orElse(null);
        if (st == null) {
            st = com.deutschflow.user.entity.LearningSessionState.builder()
                    .user(user)
                    .weekNumber(week)
                    .sessionIndex(sessionIndex)
                    .theoryViewed(false)
                    .build();
            st = sessionStateRepository.save(st);
        }
        if (st.isTheoryViewed()) {
            throw new BadRequestException("Theory practice for this session is already completed");
        }
        if (req.exerciseIds() != null && !req.exerciseIds().isEmpty()) {
            throw new BadRequestException("exerciseIds must not be sent for theory gate submit");
        }

        var detail = sessionExerciseService.buildSession(user, plan, planObj, week, sessionIndex, session, uiLang, false, true);
        List<String> requiredIds = detail.theoryGateExercises().stream()
                .map(com.deutschflow.user.dto.SessionDetailResponse.ExerciseItem::id)
                .toList();
        requireAnswersForIds(requiredIds, req.answers());

        int total = requiredIds.size();
        int correct = 0;
        List<com.deutschflow.user.dto.SessionSubmitResponse.Mistake> mistakes = new ArrayList<>();
        for (String exId : requiredIds) {
            var ex = detail.theoryGateExercises().stream().filter(e -> e.id().equals(exId)).findFirst().orElseThrow();
            Object raw = req.answers().get(ex.id());
            if (sessionExerciseService.isAnswerCorrect(ex, raw)) {
                correct++;
            } else {
                mistakes.add(buildMistake(ex, raw));
            }
        }
        int scorePercent = total == 0 ? 0 : (int) Math.round((correct * 100.0) / total);
        boolean gateCompleted = scorePercent == 100;

        List<com.deutschflow.user.dto.SessionSubmitResponse.ItemResult> itemResults = new ArrayList<>();
        for (String exId : requiredIds) {
            var ex = detail.theoryGateExercises().stream().filter(e -> e.id().equals(exId)).findFirst().orElseThrow();
            boolean ok = sessionExerciseService.isAnswerCorrect(ex, req.answers().get(exId));
            String expl = gateCompleted ? explanationOrDefault(ex) : null;
            itemResults.add(new com.deutschflow.user.dto.SessionSubmitResponse.ItemResult(exId, ok, expl));
        }

        if (gateCompleted) {
            st.setTheoryViewed(true);
            st.setLastSeenAt(java.time.LocalDateTime.now());
            if (st.getStartedAt() == null) {
                st.setStartedAt(java.time.LocalDateTime.now());
            }
            sessionStateRepository.save(st);
        }

        return new com.deutschflow.user.dto.SessionSubmitResponse(
                scorePercent,
                scorePercent >= 60,
                gateCompleted,
                "THEORY_GATE",
                List.of(),
                mistakes,
                List.of(),
                itemResults,
                null,
                null
        );
    }

    private com.deutschflow.user.dto.SessionSubmitResponse submitMainSession(
            User user,
            LearningPlan plan,
            Map<String, Object> planObj,
            int week,
            int sessionIndex,
            Map<String, Object> session,
            String uiLang,
            com.deutschflow.user.dto.SessionSubmitRequest req
    ) {
        var st = sessionStateRepository.findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .orElseThrow(() -> new BadRequestException("Complete the theory practice (10 exercises) before main exercises"));
        if (!st.isTheoryViewed()) {
            throw new BadRequestException("Complete the theory practice (10 exercises) before main exercises");
        }

        var detail = sessionExerciseService.buildSession(user, plan, planObj, week, sessionIndex, session, uiLang, true, true);

        List<String> requiredIds = resolveRequiredExerciseIds(st, req, detail);

        int total = requiredIds.size();
        int correct = 0;
        List<com.deutschflow.user.dto.SessionSubmitResponse.Mistake> mistakes = new ArrayList<>();
        for (String exId : requiredIds) {
            var ex = detail.exercises().stream().filter(e -> e.id().equals(exId)).findFirst().orElse(null);
            if (ex == null) {
                throw new BadRequestException("Invalid exerciseIds");
            }
            Object raw = req.answers().get(ex.id());
            if (sessionExerciseService.isAnswerCorrect(ex, raw)) {
                correct++;
            } else {
                mistakes.add(buildMistake(ex, raw));
            }
        }
        int scorePercent = total == 0 ? 0 : (int) Math.round((correct * 100.0) / total);
        boolean passed60 = scorePercent >= 60;

        int attemptNo = sessionAttemptRepository.maxAttemptNo(user.getId(), week, sessionIndex) + 1;
        String mistakesJson = toJson(mistakes);
        sessionAttemptRepository.save(com.deutschflow.user.entity.LearningSessionAttempt.builder()
                .user(user)
                .weekNumber(week)
                .sessionIndex(sessionIndex)
                .attemptNo(attemptNo)
                .scorePercent(scorePercent)
                .mistakesJson(mistakes.isEmpty() ? null : mistakesJson)
                .build());

        boolean completed = scorePercent == 100;
        String mode = (st.getReinforcementJson() != null) ? "REINFORCEMENT" : "MAIN";

        List<com.deutschflow.user.dto.SessionSubmitResponse.ItemResult> itemResults = new ArrayList<>();
        for (String exId : requiredIds) {
            var ex = detail.exercises().stream().filter(e -> e.id().equals(exId)).findFirst().orElseThrow();
            boolean ok = sessionExerciseService.isAnswerCorrect(ex, req.answers().get(exId));
            String expl = completed ? explanationOrDefault(ex) : null;
            itemResults.add(new com.deutschflow.user.dto.SessionSubmitResponse.ItemResult(exId, ok, expl));
        }

        List<com.deutschflow.user.dto.SessionDetailResponse.ExerciseItem> reinforcementExercises = new ArrayList<>();
        List<String> nextRequiredIds = List.of();
        Integer nextWeek = null;
        Integer nextSession = null;

        if (completed) {
            st.setReinforcementJson(null);
            st.setLastSeenAt(java.time.LocalDateTime.now());
            sessionStateRepository.save(st);
            markSessionCompleted(user, week, sessionIndex, null, null);
            int[] n = computeNextSessionPointer(planObj, plan, week, sessionIndex);
            if (n != null) {
                nextWeek = n[0];
                nextSession = n[1];
            }
        } else {
            nextRequiredIds = mistakes.stream().map(com.deutschflow.user.dto.SessionSubmitResponse.Mistake::exerciseId).toList();
            reinforcementExercises = nextRequiredIds.stream()
                    .map(id -> sessionExerciseService.getExerciseById(
                            user, plan, planObj, week, sessionIndex, session, id, uiLang))
                    .toList();
            st.setReinforcementJson(toJson(nextRequiredIds));
            st.setLastSeenAt(java.time.LocalDateTime.now());
            sessionStateRepository.save(st);
        }

        return new com.deutschflow.user.dto.SessionSubmitResponse(
                scorePercent,
                passed60,
                completed,
                mode,
                completed ? List.of() : nextRequiredIds,
                mistakes,
                reinforcementExercises,
                itemResults,
                nextWeek,
                nextSession
        );
    }

    private void requireAnswersForIds(List<String> requiredIds, Map<String, Object> answers) {
        if (answers == null) {
            throw new BadRequestException("answers is required");
        }
        for (String id : requiredIds) {
            if (!answers.containsKey(id)) {
                throw new BadRequestException("Missing answer for exercise " + id);
            }
            Object v = answers.get(id);
            if (v == null) {
                throw new BadRequestException("Missing answer for exercise " + id);
            }
            if (v instanceof String s && s.trim().isEmpty()) {
                throw new BadRequestException("Missing answer for exercise " + id);
            }
        }
    }

    private com.deutschflow.user.dto.SessionSubmitResponse.Mistake buildMistake(
            com.deutschflow.user.dto.SessionDetailResponse.ExerciseItem ex,
            Object raw
    ) {
        Integer chosenIdx = null;
        String chosenTxt = null;
        String fmt = ex.format();
        if ("TEXT".equals(fmt) || "SPEAK_REPEAT".equals(fmt) || "ORDER_DRAG".equals(fmt)) {
            chosenTxt = raw == null ? "" : String.valueOf(raw);
        } else {
            if (raw instanceof Number n) {
                chosenIdx = n.intValue();
            } else {
                try {
                    chosenIdx = Integer.parseInt(String.valueOf(raw).trim());
                } catch (Exception e) {
                    chosenIdx = -1;
                }
            }
        }
        int corr = ex.correctOptionIndex() != null ? ex.correctOptionIndex() : -1;
        return new com.deutschflow.user.dto.SessionSubmitResponse.Mistake(ex.id(), corr, chosenIdx, chosenTxt);
    }

    private String explanationOrDefault(com.deutschflow.user.dto.SessionDetailResponse.ExerciseItem ex) {
        if (ex.explanation() != null && !ex.explanation().isBlank()) {
            return ex.explanation();
        }
        return "Trả lời đúng theo yêu cầu của câu hỏi.";
    }

    private int[] computeNextSessionPointer(Map<String, Object> planObj, LearningPlan plan, int week, int sessionIndex) {
        int spw = extractSessionsPerWeek(planObj);
        if (spw < 1) {
            return null;
        }
        int nw = week;
        int ni = sessionIndex + 1;
        if (ni > spw) {
            nw++;
            ni = 1;
        }
        if (nw > plan.getWeeksTotal()) {
            return null;
        }
        try {
            findSession(planObj, nw, ni);
        } catch (NotFoundException e) {
            return null;
        }
        return new int[]{nw, ni};
    }

    private List<String> resolveRequiredExerciseIds(com.deutschflow.user.entity.LearningSessionState st,
                                                    com.deutschflow.user.dto.SessionSubmitRequest req,
                                                    com.deutschflow.user.dto.SessionDetailResponse detail) {
        // If server has reinforcement set, enforce it.
        if (st.getReinforcementJson() != null && !st.getReinforcementJson().isBlank()) {
            List<String> saved = fromJsonList(st.getReinforcementJson());
            if (saved.isEmpty()) return saved;
            // Client must submit exactly these ids; otherwise reject.
            if (req.exerciseIds() == null || !req.exerciseIds().equals(saved)) {
                throw new BadRequestException("Reinforcement required. Please submit the required exerciseIds.");
            }
            return saved;
        }

        // Otherwise: main submission requires all exercises in the session.
        return detail.exercises().stream().map(com.deutschflow.user.dto.SessionDetailResponse.ExerciseItem::id).toList();
    }

    private List<String> fromJsonList(String json) {
        try {
            return objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> findSession(Map<String, Object> planObj, int week, int sessionIndex) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks)) throw new NotFoundException("Session not found");
        for (Object wObj : weeks) {
            if (!(wObj instanceof Map<?, ?>)) continue;
            Map<String, Object> w = (Map<String, Object>) wObj;
            int wn = safeInt(w.get("week"), -1);
            if (wn != week) continue;
            Object sessionsObj = w.get("sessions");
            if (!(sessionsObj instanceof List<?> sessions)) break;
            for (Object sObj : sessions) {
                if (!(sObj instanceof Map<?, ?>)) continue;
                Map<String, Object> s = (Map<String, Object>) sObj;
                int idx = safeInt(s.get("index"), -1);
                if (idx == sessionIndex) return s;
            }
        }
        throw new NotFoundException("Session not found");
    }

    private void attachProgressSummary(Long userId, Map<String, Object> planObj) {
        var completed = progressRepository.findCompletedByUserId(userId);
        int completedCount = completed.size();

        int currentWeek = 1;
        int currentSessionIndex = 1;
        if (!completed.isEmpty()) {
            var latest = completed.get(0);
            int sessionsPerWeek = extractSessionsPerWeek(planObj);
            int nextIndex = latest.getSessionIndex() + 1;
            int nextWeek = latest.getWeekNumber();
            if (sessionsPerWeek > 0 && nextIndex > sessionsPerWeek) {
                nextWeek = nextWeek + 1;
                nextIndex = 1;
            }
            currentWeek = nextWeek;
            currentSessionIndex = nextIndex;
        }

        planObj.put("progress", new LinkedHashMap<>(Map.of(
                "completedSessions", completedCount,
                "currentWeek", currentWeek,
                "currentSessionIndex", currentSessionIndex
        )));
    }

    @SuppressWarnings("unchecked")
    private int extractSessionsPerWeek(Map<String, Object> planObj) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks) || weeks.isEmpty()) return -1;
        Object w0 = weeks.get(0);
        if (!(w0 instanceof Map<?, ?>)) return -1;
        Object sessionsObj = ((Map<String, Object>) w0).get("sessions");
        if (!(sessionsObj instanceof List<?> sessions)) return -1;
        return sessions.size();
    }

    @SuppressWarnings("unchecked")
    private void enrichMissingSessionDetails(Map<String, Object> planObj) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks)) return;

        for (Object wObj : weeks) {
            if (!(wObj instanceof Map<?, ?> w)) continue;
            Object sessionsObj = ((Map<String, Object>) w).get("sessions");
            if (!(sessionsObj instanceof List<?> sessions)) continue;

            for (Object sObj : sessions) {
                if (!(sObj instanceof Map<?, ?>)) continue;
                Map<String, Object> s = (Map<String, Object>) sObj;
                if (s.get("details") != null) continue;

                String type = String.valueOf(s.getOrDefault("type", "GRAMMAR"));
                int minutes = safeInt(s.getOrDefault("minutes", 25), 25);
                int difficulty = safeInt(s.getOrDefault("difficulty", 3), 3);

                s.put("details", buildSessionDetailsFallback(type, minutes, difficulty));
            }
        }
    }

    private int safeInt(Object v, int fallback) {
        if (v == null) return fallback;
        if (v instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private Map<String, Object> buildSessionDetailsFallback(String type, int minutes, int difficulty) {
        List<String> theory = new ArrayList<>();
        List<Map<String, Object>> exercises = new ArrayList<>();

        if ("GRAMMAR".equals(type)) {
            theory.add("Articles (der/die/das, ein/eine) + basic sentence order (V2).");
            exercises.add(ex("Choose the correct article (DER/DIE/DAS)", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
            exercises.add(ex("Word order: build 5 sentences (S-V-O)", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
        } else if ("PRACTICE".equals(type)) {
            theory.add("Practice vocabulary-in-context + grammar micro-drills.");
            exercises.add(ex("Vocabulary in short sentences (10 items)", "VOCABULARY", difficulty, Math.max(6, minutes / 2)));
            exercises.add(ex("Mini quiz: article + noun (10 items)", "GRAMMAR", difficulty, Math.max(6, minutes / 2)));
        } else if ("SPEAKING".equals(type)) {
            theory.add("Speaking drills: shadowing + role-play.");
            exercises.add(ex("Role-play dialogue (2 rounds)", "SPEAKING", difficulty, Math.max(8, minutes)));
        } else { // REVIEW
            theory.add("Review: mixed recall + quick test.");
            exercises.add(ex("Mixed review quiz (15 items)", "REVIEW", difficulty, Math.max(6, minutes)));
        }

        return new LinkedHashMap<>(Map.of(
                "title", type + " session",
                "theory", theory,
                "exercises", exercises
        ));
    }

    private Map<String, Object> generatePlan(UserLearningProfile profile) {
        int weeklyMinutes = profile.getSessionsPerWeek() * profile.getMinutesPerSession();
        int requiredHours = estimateRequiredHours(profile.getCurrentLevel(), profile.getTargetLevel(), profile.getGoalType());
        int weeksTotal = Math.max(4, (int) Math.ceil((requiredHours * 60.0) / Math.max(weeklyMinutes, 1)));

        Map<String, Integer> focusSplit = defaultFocusSplit(profile.getGoalType());
        List<Map<String, Object>> weeks = new ArrayList<>();

        for (int w = 1; w <= Math.min(weeksTotal, 12); w++) { // MVP: materialize first 12 weeks
            weeks.add(buildWeek(w, profile, focusSplit));
        }

        return new LinkedHashMap<>(Map.of(
                "goalType", profile.getGoalType().name(),
                "targetLevel", profile.getTargetLevel().name(),
                "currentLevel", profile.getCurrentLevel().name(),
                "weeklyMinutes", weeklyMinutes,
                "weeksTotal", weeksTotal,
                "focusSplit", focusSplit,
                "weeks", weeks
        ));
    }

    private Map<String, Object> buildWeek(int weekNumber, UserLearningProfile profile, Map<String, Integer> focusSplit) {
        List<Map<String, String>> objectives = PlanObjectiveCatalog.weekObjectives(weekNumber, profile.getGoalType());

        List<Map<String, Object>> sessions = new ArrayList<>();
        for (int i = 1; i <= profile.getSessionsPerWeek(); i++) {
            sessions.add(buildSession(i, profile));
        }

        return new LinkedHashMap<>(Map.of(
                "week", weekNumber,
                "objectives", objectives,
                "sessions", sessions
        ));
    }

    private Map<String, Object> buildSession(int index, UserLearningProfile profile) {
        // NOTE: Plan is for learning sessions. Vocabulary lookup is a separate feature (/student/vocabulary).
        String type = switch (index % 4) {
            case 1 -> "GRAMMAR";
            case 2 -> "PRACTICE";
            case 3 -> "SPEAKING";
            default -> "REVIEW";
        };

        List<String> tags = new ArrayList<>();
        if (profile.getIndustry() != null) tags.add(profile.getIndustry());
        tags.add(profile.getTargetLevel().name());

        List<String> skills = switch (type) {
            case "GRAMMAR" -> List.of("GRAMMAR");
            case "PRACTICE" -> List.of("GRAMMAR", "VOCABULARY");
            case "SPEAKING" -> List.of("SPEAKING", "LISTENING");
            case "REVIEW" -> List.of("REVIEW");
            default -> List.of("GRAMMAR");
        };

        int difficulty = estimateSessionDifficulty(type, profile);
        Map<String, Object> contentRef = buildContentRef(type, profile);
        Map<String, Object> details = buildSessionDetails(type, profile, difficulty);

        return new LinkedHashMap<>(Map.of(
                "index", index,
                "type", type,
                "minutes", profile.getMinutesPerSession(),
                "tags", tags,
                "skills", skills,
                "difficulty", difficulty,
                "contentRef", contentRef,
                "details", details
        ));
    }

    private Map<String, Object> buildSessionDetails(String type, UserLearningProfile profile, int difficulty) {
        int minutes = profile.getMinutesPerSession();
        String cefr = profile.getTargetLevel().name();
        String industry = profile.getIndustry() != null ? profile.getIndustry() : "GENERAL";

        List<String> theory = new ArrayList<>();
        List<Map<String, Object>> exercises = new ArrayList<>();

        if ("GRAMMAR".equals(type)) {
            theory.add("Definite/indefinite articles (der/die/das, ein/eine)");
            theory.add("Basic word order (SVO) in Hauptsatz");
            exercises.add(ex("Article pick (DER/DIE/DAS)", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
            exercises.add(ex("Fill the blank: Ich ___ Student.", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
        } else if ("PRACTICE".equals(type)) {
            theory.add("High-frequency phrases for " + industry);
            exercises.add(ex("Vocabulary-in-context (short sentences)", "VOCABULARY", difficulty, Math.max(6, minutes / 2)));
            exercises.add(ex("Mini quiz: choose correct article + noun", "GRAMMAR", difficulty, Math.max(6, minutes / 2)));
        } else if ("SPEAKING".equals(type)) {
            theory.add("Speaking drills (shadowing) at " + cefr);
            exercises.add(ex("Dialogue role-play (contextual)", "SPEAKING", difficulty, Math.max(8, minutes)));
        } else { // REVIEW
            theory.add("Spaced review (SRS-style) + quick recap");
            exercises.add(ex("Review quiz (mixed)", "REVIEW", difficulty, Math.max(6, minutes)));
        }

        return new LinkedHashMap<>(Map.of(
                "title", type + " session",
                "theory", theory,
                "exercises", exercises
        ));
    }

    private Map<String, Object> ex(String title, String skill, int difficulty, int minutes) {
        return new LinkedHashMap<>(Map.of(
                "title", title,
                "skill", skill,
                "difficulty", difficulty,
                "minutes", minutes
        ));
    }

    private int estimateSessionDifficulty(String type, UserLearningProfile profile) {
        int base = switch (profile.getTargetLevel()) {
            case A1 -> 2;
            case A2 -> 4;
            case B1 -> 6;
            case B2 -> 7;
            case C1 -> 8;
            case C2 -> 9;
        };
        if ("SPEAKING".equals(type)) base += 1;
        if (profile.getLearningSpeed() == UserLearningProfile.LearningSpeed.FAST) base += 1;
        if (profile.getLearningSpeed() == UserLearningProfile.LearningSpeed.SLOW) base -= 1;
        return Math.min(10, Math.max(1, base));
    }

    private Map<String, Object> buildContentRef(String type, UserLearningProfile profile) {
        String cefr = profile.getTargetLevel().name();
        String industry = profile.getIndustry();

        if ("GRAMMAR".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "GRAMMAR",
                    "cefr", cefr,
                    "topics", List.of("ARTICLES", "BASIC_WORD_ORDER")
            ));
        }

        if ("PRACTICE".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "PRACTICE",
                    "cefr", cefr,
                    "topics", industry != null ? List.of(industry) : List.of("GENERAL")
            ));
        }

        if ("SPEAKING".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "SPEAKING",
                    "cefr", cefr,
                    "scenarios", industry != null ? List.of("WORK_" + industry) : List.of("DAILY_LIFE"),
                    "promptStyle", "CONTEXTUAL_DIALOGUE"
            ));
        }

        return new LinkedHashMap<>(Map.of(
                "module", "REVIEW",
                "cefr", cefr
        ));
    }

    private Map<String, Integer> defaultFocusSplit(UserLearningProfile.GoalType goalType) {
        if (goalType == UserLearningProfile.GoalType.WORK) {
            return new LinkedHashMap<>(Map.of(
                    "VOCAB", 35,
                    "SPEAKING", 25,
                    "GRAMMAR", 20,
                    "LISTENING", 10,
                    "REVIEW", 10
            ));
        }
        return new LinkedHashMap<>(Map.of(
                "GRAMMAR", 30,
                "READING", 20,
                "LISTENING", 20,
                "WRITING", 15,
                "SPEAKING", 10,
                "REVIEW", 5
        ));
    }

    private int estimateRequiredHours(UserLearningProfile.CurrentLevel current, UserLearningProfile.TargetLevel target, UserLearningProfile.GoalType goalType) {
        int base = switch (target) {
            case A1 -> 90;
            case A2 -> 160;
            case B1 -> 280;
            case B2 -> 420;
            case C1 -> 600;
            case C2 -> 800;
        };
        if (goalType == UserLearningProfile.GoalType.CERT) base = (int) Math.round(base * 1.1);
        if (current != UserLearningProfile.CurrentLevel.A0) base = (int) Math.round(base * 0.7);
        return base;
    }

    private <E extends Enum<E>> E parseEnum(Class<E> clazz, String raw, String field) {
        try {
            return Enum.valueOf(clazz, normalizeEnumToken(raw));
        } catch (Exception e) {
            throw new BadRequestException("Invalid " + field);
        }
    }

    /**
     * Accept common user-facing inputs and normalize to enum names.
     * Examples:
     * - "b1" -> "B1"
     * - "18_24" -> "AGE_18_24"
     * - "age_18_24" -> "AGE_18_24"
     * - "45+" -> "AGE_45_PLUS"
     */
    private String normalizeEnumToken(String raw) {
        if (raw == null) return "";
        String s = raw.trim()
                .toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        if (s.equals("45+")) return "AGE_45_PLUS";
        if (s.matches("^\\d.*")) return "AGE_" + s;
        return s;
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String toJsonOrNull(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Collection<?> c && c.isEmpty()) return null;
        return toJson(obj);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Invalid JSON payload");
        }
    }

    private Map<String, Object> fromJsonMap(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    @Transactional(readOnly = true)
    public Page<LearningSessionAttemptSummaryDto> listMyAttempts(User user, Pageable pageable) {
        return sessionAttemptRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable).map(a ->
                new LearningSessionAttemptSummaryDto(
                        a.getId(),
                        a.getWeekNumber(),
                        a.getSessionIndex(),
                        a.getAttemptNo(),
                        a.getScorePercent(),
                        a.getCreatedAt(),
                        countMistakeEntries(a.getMistakesJson())
                ));
    }

    private Integer countMistakeEntries(String mistakesJson) {
        if (mistakesJson == null || mistakesJson.isBlank()) {
            return null;
        }
        try {
            var n = objectMapper.readTree(mistakesJson);
            if (!n.isArray()) {
                return null;
            }
            return n.size();
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}

