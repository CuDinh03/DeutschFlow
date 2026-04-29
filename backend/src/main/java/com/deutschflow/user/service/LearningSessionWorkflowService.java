package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.SessionDetailResponse;
import com.deutschflow.user.dto.SessionSubmitRequest;
import com.deutschflow.user.dto.SessionSubmitResponse;
import com.deutschflow.user.entity.LearningPlan;
import com.deutschflow.user.entity.LearningSessionState;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.LearningSessionAttemptRepository;
import com.deutschflow.user.repository.LearningSessionStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LearningSessionWorkflowService {
    private final LearningPlanRepository planRepository;
    private final LearningSessionStateRepository sessionStateRepository;
    private final LearningSessionAttemptRepository sessionAttemptRepository;
    private final SessionExerciseService sessionExerciseService;
    private final StoredLearningPlanSupport storedLearningPlanSupport;
    private final LearningSessionProgressService learningSessionProgressService;
    private final JdbcTemplate jdbcTemplate;

    public void markTheoryViewed(User user, int week, int sessionIndex) {
        if (week < 1 || sessionIndex < 1) {
            throw new BadRequestException("Invalid week/sessionIndex");
        }
        var st = sessionStateRepository.findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .orElse(com.deutschflow.user.entity.LearningSessionState.builder()
                        .user(user)
                        .weekNumber(week)
                        .sessionIndex(sessionIndex)
                        .build());
        if (st.getStartedAt() == null) st.setStartedAt(java.time.LocalDateTime.now());
        st.setLastSeenAt(java.time.LocalDateTime.now());
        st.setTheoryViewed(true);
        sessionStateRepository.save(st);
    }

    public SessionDetailResponse getSessionDetail(User user, int week, int sessionIndex) {
        LearningPlan plan = planRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning plan not found"));
        Map<String, Object> planObj = storedLearningPlanSupport.fromJsonMap(plan.getPlanJson());
        storedLearningPlanSupport.enrichMissingSessionDetails(planObj);

        Map<String, Object> session = storedLearningPlanSupport.findSession(planObj, week, sessionIndex);
        boolean theoryGatePassed = sessionStateRepository
                .findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .map(com.deutschflow.user.entity.LearningSessionState::isTheoryViewed)
                .orElse(false);
        return sessionExerciseService.buildSession(
                user, plan, planObj, week, sessionIndex, session, user.getLocale().name().toLowerCase(), theoryGatePassed, false);
    }

    public SessionSubmitResponse submitSession(User user, SessionSubmitRequest req) {
        String phase = req.phase() == null || req.phase().isBlank()
                ? "MAIN"
                : req.phase().trim().toUpperCase(Locale.ROOT);

        LearningPlan plan = planRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning plan not found"));
        Map<String, Object> planObj = storedLearningPlanSupport.fromJsonMap(plan.getPlanJson());
        storedLearningPlanSupport.enrichMissingSessionDetails(planObj);
        int week = req.week();
        int sessionIndex = req.sessionIndex();
        Map<String, Object> session = storedLearningPlanSupport.findSession(planObj, week, sessionIndex);
        String uiLang = user.getLocale().name().toLowerCase(Locale.ROOT);

        if ("THEORY_GATE".equals(phase)) {
            return submitTheoryGate(user, plan, planObj, week, sessionIndex, session, uiLang, req);
        }
        return submitMainSession(user, plan, planObj, week, sessionIndex, session, uiLang, req);
    }

    private SessionSubmitResponse submitTheoryGate(
            User user,
            LearningPlan plan,
            Map<String, Object> planObj,
            int week,
            int sessionIndex,
            Map<String, Object> session,
            String uiLang,
            SessionSubmitRequest req
    ) {
        LearningSessionState st = sessionStateRepository
                .findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .orElse(null);
        if (st == null) {
            st = LearningSessionState.builder()
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
                .map(SessionDetailResponse.ExerciseItem::id)
                .toList();
        requireAnswersForIds(requiredIds, req.answers());

        int total = requiredIds.size();
        int correct = 0;
        List<SessionSubmitResponse.Mistake> mistakes = new ArrayList<>();
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

        List<SessionSubmitResponse.ItemResult> itemResults = new ArrayList<>();
        for (String exId : requiredIds) {
            var ex = detail.theoryGateExercises().stream().filter(e -> e.id().equals(exId)).findFirst().orElseThrow();
            boolean ok = sessionExerciseService.isAnswerCorrect(ex, req.answers().get(exId));
            String expl = explanationOrDefault(ex);
            itemResults.add(new SessionSubmitResponse.ItemResult(exId, ok, expl));
        }
        logGrammarFeedbackCoverage(user, week, sessionIndex, "THEORY_GATE", itemResults);

        if (gateCompleted) {
            st.setTheoryViewed(true);
            st.setLastSeenAt(java.time.LocalDateTime.now());
            if (st.getStartedAt() == null) {
                st.setStartedAt(java.time.LocalDateTime.now());
            }
            sessionStateRepository.save(st);
        }

        return new SessionSubmitResponse(
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

    private SessionSubmitResponse submitMainSession(
            User user,
            LearningPlan plan,
            Map<String, Object> planObj,
            int week,
            int sessionIndex,
            Map<String, Object> session,
            String uiLang,
            SessionSubmitRequest req
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
        List<SessionSubmitResponse.Mistake> mistakes = new ArrayList<>();
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
        String mistakesJson = storedLearningPlanSupport.toJson(mistakes);
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

        List<SessionSubmitResponse.ItemResult> itemResults = new ArrayList<>();
        for (String exId : requiredIds) {
            var ex = detail.exercises().stream().filter(e -> e.id().equals(exId)).findFirst().orElseThrow();
            boolean ok = sessionExerciseService.isAnswerCorrect(ex, req.answers().get(exId));
            String expl = explanationOrDefault(ex);
            itemResults.add(new SessionSubmitResponse.ItemResult(exId, ok, expl));
        }
        logGrammarFeedbackCoverage(user, week, sessionIndex, "MAIN", itemResults);

        List<SessionDetailResponse.ExerciseItem> reinforcementExercises = new ArrayList<>();
        List<String> nextRequiredIds = List.of();
        Integer nextWeek = null;
        Integer nextSession = null;

        if (completed) {
            st.setReinforcementJson(null);
            st.setLastSeenAt(java.time.LocalDateTime.now());
            sessionStateRepository.save(st);
            learningSessionProgressService.markSessionCompleted(user, week, sessionIndex, null, null);
            int[] n = storedLearningPlanSupport.computeNextSessionPointer(planObj, plan, week, sessionIndex);
            if (n != null) {
                nextWeek = n[0];
                nextSession = n[1];
            }
        } else {
            nextRequiredIds = mistakes.stream().map(SessionSubmitResponse.Mistake::exerciseId).toList();
            reinforcementExercises = nextRequiredIds.stream()
                    .map(id -> sessionExerciseService.getExerciseById(
                            user, plan, planObj, week, sessionIndex, session, id, uiLang))
                    .toList();
            st.setReinforcementJson(storedLearningPlanSupport.toJson(nextRequiredIds));
            st.setLastSeenAt(java.time.LocalDateTime.now());
            sessionStateRepository.save(st);
        }

        return new SessionSubmitResponse(
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

    private SessionSubmitResponse.Mistake buildMistake(SessionDetailResponse.ExerciseItem ex, Object raw) {
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
        return new SessionSubmitResponse.Mistake(ex.id(), corr, chosenIdx, chosenTxt);
    }

    private String explanationOrDefault(SessionDetailResponse.ExerciseItem ex) {
        if (ex.explanation() != null && !ex.explanation().isBlank()) {
            return ex.explanation();
        }
        return "Tra loi dung theo yeu cau cua cau hoi.";
    }

    private List<String> resolveRequiredExerciseIds(
            LearningSessionState st,
            SessionSubmitRequest req,
            SessionDetailResponse detail
    ) {
        if (st.getReinforcementJson() != null && !st.getReinforcementJson().isBlank()) {
            List<String> saved = storedLearningPlanSupport.fromJsonList(st.getReinforcementJson());
            if (saved.isEmpty()) return saved;
            if (req.exerciseIds() == null || !req.exerciseIds().equals(saved)) {
                throw new BadRequestException("Reinforcement required. Please submit the required exerciseIds.");
            }
            return saved;
        }
        return detail.exercises().stream().map(SessionDetailResponse.ExerciseItem::id).toList();
    }

    private void logGrammarFeedbackCoverage(
            User user,
            int week,
            int sessionIndex,
            String phase,
            List<SessionSubmitResponse.ItemResult> itemResults
    ) {
        int total = itemResults == null ? 0 : itemResults.size();
        int withFeedback = 0;
        if (itemResults != null) {
            for (SessionSubmitResponse.ItemResult itemResult : itemResults) {
                if (itemResult.explanation() != null && !itemResult.explanation().isBlank()) {
                    withFeedback++;
                }
            }
        }
        double coverage = total == 0 ? 0.0 : Math.round((withFeedback * 10000.0) / total) / 100.0;
        jdbcTemplate.update("""
                INSERT INTO grammar_feedback_events (
                  user_id,
                  week_number,
                  session_index,
                  phase,
                  total_items,
                  items_with_feedback,
                  coverage_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                user.getId(),
                week,
                sessionIndex,
                phase,
                total,
                withFeedback,
                coverage
        );
    }
}

