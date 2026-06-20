package com.deutschflow.grammar.controller;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.grammar.dto.ExamAttemptDto;
import com.deutschflow.grammar.dto.ExamCoverageDto;
import com.deutschflow.grammar.dto.ExamFinishAcceptedDto;
import com.deutschflow.grammar.dto.ExamQuestionsDto;
import com.deutschflow.grammar.dto.ExamRecommendationDto;
import com.deutschflow.grammar.dto.ExamResultDto;
import com.deutschflow.grammar.dto.ExamReviewDto;
import com.deutschflow.grammar.dto.ExamStartDto;
import com.deutschflow.grammar.dto.ExamStatDto;
import com.deutschflow.grammar.dto.ExamSummaryDto;
import com.deutschflow.grammar.entity.MockExamPack;
import com.deutschflow.grammar.service.AiExamEvaluatorService;
import com.deutschflow.grammar.service.ExamGenerationService;
import com.deutschflow.grammar.service.ExamQuestionSanitizer;
import com.deutschflow.grammar.service.ExamScoringService;
import com.deutschflow.grammar.service.MockExamPackService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

/**
 * Mock Goethe Exam API
 * Provides endpoints for exam management, grading, and result retrieval
 */
@RestController
@RequestMapping("/api/mock-exams")
@PreAuthorize("isAuthenticated()")
public class MockExamController {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MockExamController.class);
    private static final ObjectMapper om = new ObjectMapper();
    private static final long EXAM_AI_ESTIMATED_TOKENS = 1_500L;

    private final JdbcTemplate jdbcTemplate;
    private final ExamScoringService scoringService;
    private final AiExamEvaluatorService aiEvaluator;
    private final ExamGenerationService generationService;
    private final ExamQuestionSanitizer questionSanitizer;
    private final com.deutschflow.assessment.service.B1ReadinessService b1ReadinessService;
    private final com.deutschflow.progress.service.PhaseEngineService phaseEngineService;
    private final MockExamPackService mockExamPackService;
    private final com.deutschflow.gamification.coin.service.CoinService coinService;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;

    // S-5: injected separately to avoid growing the explicit constructor
    @Autowired private AsyncJobService asyncJobService;
    @Autowired @Qualifier("aiExecutor") private Executor aiExecutor;

    public MockExamController(JdbcTemplate jdbcTemplate, ExamScoringService scoringService,
                               AiExamEvaluatorService aiEvaluator, ExamGenerationService generationService,
                               ExamQuestionSanitizer questionSanitizer,
                               com.deutschflow.assessment.service.B1ReadinessService b1ReadinessService,
                               com.deutschflow.progress.service.PhaseEngineService phaseEngineService,
                               MockExamPackService mockExamPackService,
                               com.deutschflow.gamification.coin.service.CoinService coinService,
                               QuotaService quotaService,
                               OrgPoolGuard orgPoolGuard) {
        this.jdbcTemplate = jdbcTemplate;
        this.scoringService = scoringService;
        this.aiEvaluator = aiEvaluator;
        this.generationService = generationService;
        this.questionSanitizer = questionSanitizer;
        this.b1ReadinessService = b1ReadinessService;
        this.phaseEngineService = phaseEngineService;
        this.mockExamPackService = mockExamPackService;
        this.coinService = coinService;
        this.quotaService = quotaService;
        this.orgPoolGuard = orgPoolGuard;
    }

    private long userId(UserDetails p) {
        if (p instanceof com.deutschflow.user.entity.User user) {
            return user.getId();
        }
        try { return Long.parseLong(p.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }

    @GetMapping
    public ResponseEntity<List<ExamSummaryDto>> listExams(
            @RequestParam(defaultValue = "A1") String cefrLevel) {
        var exams = jdbcTemplate.query("""
            SELECT id, cefr_level, exam_format, title, description_vi,
                   total_points, pass_points, time_limit_minutes
            FROM mock_exams
            WHERE cefr_level = ? AND is_active = TRUE
            ORDER BY id
            """, (rs, n) -> new ExamSummaryDto(
                rs.getLong("id"),
                rs.getString("cefr_level"),
                rs.getString("exam_format"),
                rs.getString("title"),
                rs.getString("description_vi"),
                (Integer) rs.getObject("total_points"),
                (Integer) rs.getObject("pass_points"),
                (Integer) rs.getObject("time_limit_minutes")),
            cefrLevel);
        return ResponseEntity.ok(exams);
    }

    @PostMapping("/{examId}/start")
    @Transactional
    public ResponseEntity<ExamStartDto> startExam(
            @PathVariable long examId,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);

        // Check active attempt
        var existing = jdbcTemplate.queryForList("""
            SELECT id FROM mock_exam_attempts
            WHERE user_id = ? AND exam_id = ? AND status = 'IN_PROGRESS'
            """, uid, examId);

        boolean reusing = !existing.isEmpty();

        // Access gate for paid packs. PRO/ULTRA unlock permanently; a FREE learner can start a single
        // attempt with a coin trial pass, which is consumed here and re-locks the pack afterwards.
        // Reusing an already-IN_PROGRESS attempt must NOT consume a second pass. (This also closes a
        // prior hole where /start had no paid gate at all — FREE users could start paid-pack exams.)
        MockExamPack pack = reusing ? null : mockExamPackService.findPackForExam(examId).orElse(null);
        boolean needsTrialPass = false;
        Long packId = null;
        if (pack != null && pack.isRequiresPaid() && !mockExamPackService.isPaid(uid)) {
            packId = pack.getId();
            if (!coinService.hasTrialPassFor(uid, packId)) {
                throw new ForbiddenException("Nâng cấp gói hoặc dùng xu để mở khoá bộ đề luyện thi này.");
            }
            needsTrialPass = true;
        }

        Map<String, Object> attemptRow;
        if (reusing) {
            attemptRow = existing.get(0);
        } else {
            attemptRow = jdbcTemplate.queryForMap("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status)
                VALUES (?, ?, 'IN_PROGRESS')
                RETURNING id, exam_id, started_at, status
                """, uid, examId);
            if (needsTrialPass) {
                long attemptId = ((Number) attemptRow.get("id")).longValue();
                coinService.consumeTrialPass(uid, packId, attemptId);
            }
        }

        // Return attempt details AND the exam structure (answers stripped — scoring happens server-side)
        var examDetails = jdbcTemplate.queryForMap("""
            SELECT sections_json::text AS sections_json, time_limit_minutes
            FROM mock_exams WHERE id = ?
            """, examId);

        // Strip the answer key before sending to the client: an in-progress exam must not
        // expose `correct`/explanations. Scoring (/finish) and review re-read them from the DB.
        // exam_id/started_at/status are absent when reusing an attempt (only `id` was selected) —
        // @JsonInclude(NON_NULL) on ExamStartDto reproduces that omission.
        ExamStartDto response = new ExamStartDto(
                ((Number) attemptRow.get("id")).longValue(),
                attemptRow.get("exam_id") != null ? ((Number) attemptRow.get("exam_id")).longValue() : null,
                (java.util.Date) attemptRow.get("started_at"),
                (String) attemptRow.get("status"),
                questionSanitizer.stripAnswerKey((String) examDetails.get("sections_json")),
                (Integer) examDetails.get("time_limit_minutes"));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{examId}/questions")
    public ResponseEntity<ExamQuestionsDto> getExamQuestions(@PathVariable long examId) {
        try {
            var row = jdbcTemplate.queryForMap("""
                SELECT sections_json::text AS sections_json
                FROM mock_exams WHERE id = ?
                """, examId);
            // Strip the answer key before serving — same reason as /start.
            return ResponseEntity.ok(new ExamQuestionsDto(
                    questionSanitizer.stripAnswerKey((String) row.get("sections_json"))));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * S-5: finishExam now returns 202 + jobId immediately (quota check stays synchronous for fail-fast).
     * Scoring + AI eval run on aiExecutor off the Tomcat thread; client polls GET /api/async-jobs/{jobId}.
     */
    @PostMapping("/attempts/{attemptId}/finish")
    public ResponseEntity<ExamFinishAcceptedDto> finishExam(
            @PathVariable long attemptId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);

        // Quota gate stays synchronous — fast DB read, propagates QuotaExceededException immediately
        quotaService.assertAllowed(uid, Instant.now(), EXAM_AI_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(uid, EXAM_AI_ESTIMATED_TOKENS);

        AsyncJob job = asyncJobService.createJob("FINISH_EXAM", uid);
        Map<String, Object> safeBody = body != null ? new HashMap<>(body) : Map.of();

        UserDetails capturedPrincipal = principal;
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> result = processFinishExam(uid, attemptId, safeBody, capturedPrincipal);
                asyncJobService.completeJob(job.getId(), om.writeValueAsString(result));
            } catch (Exception e) {
                asyncJobService.failJob(job.getId(),
                        e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                log.error("[MockExam] Async finish failed attempt={} uid={}: {}",
                        attemptId, uid, e.getMessage(), e);
            }
        }, aiExecutor);

        return ResponseEntity.accepted().body(new ExamFinishAcceptedDto(
                job.getId().toString(),
                AsyncJob.Status.PENDING.name(),
                attemptId));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> processFinishExam(long uid, long attemptId,
                                                   Map<String, Object> body,
                                                   UserDetails caller) throws Exception {
        // Get attempt details
        var attempt = jdbcTemplate.queryForMap("""
            SELECT a.exam_id, a.answers_submitted_json::text AS answers
            FROM mock_exam_attempts a
            WHERE a.id = ? AND a.user_id = ?
            """, attemptId, uid);

        long examId = ((Number) attempt.get("exam_id")).longValue();

        // Get exam structure
        var exam = jdbcTemplate.queryForMap("""
            SELECT sections_json::text AS sections_json
            FROM mock_exams WHERE id = ?
            """, examId);

        String sectionsJson = (String) exam.get("sections_json");
        Map<String, Object> examStructure = om.readValue(sectionsJson, Map.class);
        List<Map<String, Object>> sections = (List<Map<String, Object>>) examStructure.get("sections");

        // Parse submitted answers
        Map<String, Object> answers = new HashMap<>();
        if (body.containsKey("answers")) {
            answers = (Map<String, Object>) body.get("answers");
        }

        // Calculate scores for each section using real rubrics
        Map<String, Object> detailedScores = new HashMap<>();
        int lesenScore = 0;
        int hoerenScore = 0;
        Map<String, Object> schreibenScores = new HashMap<>();

        for (Map<String, Object> section : sections) {
            String sectionName = (String) section.get("name");

            switch (sectionName) {
                case "LESEN" -> {
                    lesenScore = scoringService.scoreLesenSection(answers, section);
                    detailedScores.put("LESEN", Map.of(
                        "total", lesenScore,
                        "max", 25,
                        "percentage", (lesenScore * 100) / 25,
                        "status", "COMPLETED"
                    ));
                }
                case "HOEREN" -> {
                    hoerenScore = scoringService.scoreHoerenSection(answers, section);
                    detailedScores.put("HOEREN", Map.of(
                        "total", hoerenScore,
                        "max", 25,
                        "percentage", (hoerenScore * 100) / 25,
                        "status", "COMPLETED"
                    ));
                }
                case "SCHREIBEN" -> {
                    schreibenScores = scoringService.scoreSchreibenSection(answers, section);

                    // AI-evaluate the email Teil 2 if content was submitted
                    Object teil2Raw = schreibenScores.get("teil2_email");
                    String emailContent = null;
                    String taskPrompt = null;
                    if (teil2Raw instanceof Map<?,?> t2Map) {
                        Object ec = t2Map.get("email_content");
                        emailContent = ec instanceof String s ? s : null;
                    }
                    // Try to get task prompt from section structure
                    if (section.get("teile") instanceof List<?> teile) {
                        for (Object t : teile) {
                            if (t instanceof Map<?,?> tm && "WRITE_EMAIL".equals(tm.get("type"))) {
                                Object inst = tm.get("instruction_vi");
                                if (inst == null) inst = tm.get("instruction_de");
                                if (inst instanceof String s) taskPrompt = s;
                            }
                        }
                    }

                    if (emailContent != null && !emailContent.isBlank()) {
                        Map<String, Object> aiResult = aiEvaluator.evaluateSchreibenEmail(uid, emailContent, taskPrompt);
                        schreibenScores = new HashMap<>(schreibenScores);
                        schreibenScores.put("teil2_email", aiResult);
                        int aiScore = ((Number) aiResult.get("total")).intValue();
                        int teil1 = schreibenScores.containsKey("teil1_form")
                            ? ((Number) schreibenScores.get("teil1_form")).intValue() : 0;
                        schreibenScores.put("total_provisional", teil1 + aiScore);
                    }
                    detailedScores.put("SCHREIBEN", schreibenScores);
                }
                case "SPRECHEN" -> {
                    Map<String, Object> sprechenScores = scoringService.scoreSperechenSection(uid, answers, section);
                    detailedScores.put("SPRECHEN", sprechenScores);
                }
            }
        }

        // Calculate total score (provisional — Speaking requires manual eval)
        int totalScore = lesenScore + hoerenScore;
        if (schreibenScores.containsKey("total_provisional")) {
            totalScore += ((Number) schreibenScores.get("total_provisional")).intValue();
        }

        // Identify weak areas
        List<String> weakAreas = scoringService.identifyWeakAreas(detailedScores);

        // Save results
        String detailedScoresJson = om.writeValueAsString(detailedScores);
        String weakAreasJson = om.writeValueAsString(weakAreas);

        jdbcTemplate.update("""
            UPDATE mock_exam_attempts
            SET status = 'COMPLETED',
                finished_at = NOW(),
                total_score = ?,
                passed = (? >= 60),
                detailed_scores_json = ?::jsonb,
                weak_areas = ?::jsonb,
                answers_submitted_json = ?::jsonb
            WHERE id = ? AND user_id = ?
            """, totalScore, totalScore, detailedScoresJson, weakAreasJson,
            om.writeValueAsString(answers), attemptId, uid);

        log.info("[MockExam] Exam {} finished for user {} with score {}", attemptId, uid, totalScore);

        // Best-effort post-exam updates (phase recompute + B1 graduation)
        try {
            phaseEngineService.recompute(uid);
            String cefr = jdbcTemplate.queryForObject(
                    "SELECT cefr_level FROM mock_exams WHERE id = ?", String.class, examId);
            if ("B1".equalsIgnoreCase(cefr) && caller instanceof com.deutschflow.user.entity.User user) {
                b1ReadinessService.recordMockExamResult(user, totalScore >= 60);
            }
        } catch (Exception ex) {
            log.warn("[MockExam] Post-exam phase/B1 update failed for attempt {}: {}",
                    attemptId, ex.getMessage());
        }

        return Map.of(
            "attemptId", attemptId,
            "totalScore", totalScore,
            "passed", totalScore >= 60,
            "detailedScores", detailedScores,
            "weakAreas", weakAreas
        );
    }

    @GetMapping("/attempts/me")
    public ResponseEntity<List<ExamAttemptDto>> myAttempts(
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        var attempts = jdbcTemplate.query("""
            SELECT a.id, a.exam_id, e.title AS exam_title, a.started_at, a.finished_at,
                   a.total_score, a.passed, a.status,
                   a.detailed_scores_json::text AS detailed_scores_json,
                   a.weak_areas::text AS weak_areas
            FROM mock_exam_attempts a
            JOIN mock_exams e ON e.id = a.exam_id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC
            """, (rs, n) -> new ExamAttemptDto(
                rs.getLong("id"),
                (Long) rs.getObject("exam_id"),
                rs.getString("exam_title"),
                rs.getTimestamp("started_at"),
                rs.getTimestamp("finished_at"),
                (Integer) rs.getObject("total_score"),
                (Boolean) rs.getObject("passed"),
                rs.getString("status"),
                rs.getString("detailed_scores_json"),
                rs.getString("weak_areas")),
            uid);
        return ResponseEntity.ok(attempts);
    }

    @GetMapping("/attempts/{attemptId}/result")
    public ResponseEntity<ExamResultDto> getResult(
            @PathVariable long attemptId,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        try {
            ExamResultDto row = jdbcTemplate.queryForObject("""
                SELECT a.id, a.exam_id, e.title, a.started_at, a.finished_at,
                       a.total_score, a.passed, a.status,
                       a.detailed_scores_json::text AS detailed_scores_json,
                       a.weak_areas::text AS weak_areas
                FROM mock_exam_attempts a
                JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.id = ? AND a.user_id = ?
                """, (rs, n) -> new ExamResultDto(
                    rs.getLong("id"),
                    (Long) rs.getObject("exam_id"),
                    rs.getString("title"),
                    rs.getTimestamp("started_at"),
                    rs.getTimestamp("finished_at"),
                    (Integer) rs.getObject("total_score"),
                    (Boolean) rs.getObject("passed"),
                    rs.getString("status"),
                    rs.getString("detailed_scores_json"),
                    rs.getString("weak_areas")),
                attemptId, uid);
            return ResponseEntity.ok(row);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/recommend")
    public ResponseEntity<ExamRecommendationDto> recommendExam(
            @RequestParam(defaultValue = "A1") String cefrLevel,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        var examId = generationService.recommendExamId(uid, cefrLevel);
        var examStats = generationService.getUserExamStats(uid, cefrLevel).stream()
                .map(ExamStatDto::from)
                .toList();

        return ResponseEntity.ok(new ExamRecommendationDto(examId.orElse(-1L), cefrLevel, examStats));
    }

    @GetMapping("/coverage")
    public ResponseEntity<ExamCoverageDto> examCoverage(
            @RequestParam(defaultValue = "A1") String cefrLevel) {
        return ResponseEntity.ok(generationService.getExamCoverage(cefrLevel));
    }

    @GetMapping("/attempts/{attemptId}/review")
    public ResponseEntity<ExamReviewDto> getAttemptReview(
            @PathVariable long attemptId,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        try {
            // 1. Load the attempt
            List<Map<String, Object>> attemptRows = jdbcTemplate.queryForList("""
                SELECT id, exam_id, answers_submitted_json::text AS answers_submitted_json,
                       detailed_scores_json::text AS detailed_scores_json,
                       total_score, status
                FROM mock_exam_attempts
                WHERE id = ? AND user_id = ?
                """, attemptId, uid);

            if (attemptRows.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Map<String, Object> attempt = attemptRows.get(0);

            // 2. Only allow review of completed attempts
            String status = (String) attempt.get("status");
            if (!"COMPLETED".equals(status)) {
                return ResponseEntity.notFound().build();
            }

            long examId = ((Number) attempt.get("exam_id")).longValue();
            int totalScore = attempt.get("total_score") != null
                ? ((Number) attempt.get("total_score")).intValue() : 0;

            // 3. Load exam content
            var examRow = jdbcTemplate.queryForMap("""
                SELECT sections_json::text AS sections_json
                FROM mock_exams WHERE id = ?
                """, examId);

            // 4. Parse submitted answers: Map<questionId, userAnswer>
            String answersJson = (String) attempt.get("answers_submitted_json");
            Map<String, String> submittedAnswers = new HashMap<>();
            if (answersJson != null && !answersJson.isBlank() && !"null".equals(answersJson)) {
                Map<String, Object> raw = om.readValue(answersJson, Map.class);
                for (Map.Entry<String, Object> entry : raw.entrySet()) {
                    submittedAnswers.put(entry.getKey(),
                        entry.getValue() != null ? entry.getValue().toString() : null);
                }
            }

            // 5. Build review sections
            String sectionsJson = (String) examRow.get("sections_json");
            Map<String, Object> examStructure = om.readValue(sectionsJson, Map.class);
            List<Map<String, Object>> sections =
                (List<Map<String, Object>>) examStructure.get("sections");

            List<ExamReviewDto.Section> reviewSections = new ArrayList<>();
            for (Map<String, Object> section : sections) {
                String sectionName = (String) section.get("name");
                List<ExamReviewDto.Item> reviewItems = new ArrayList<>();

                List<Map<String, Object>> teile =
                    (List<Map<String, Object>>) section.get("teile");
                if (teile == null) continue;

                for (Map<String, Object> teil : teile) {
                    List<Map<String, Object>> items =
                        (List<Map<String, Object>>) teil.get("items");
                    if (items == null) continue;

                    for (Map<String, Object> item : items) {
                        String itemId = item.get("id") != null ? item.get("id").toString() : null;
                        if (itemId == null) continue;

                        String question = item.containsKey("question")
                            ? (String) item.get("question")
                            : (String) item.get("prompt");
                        String correctAnswer = item.containsKey("correct")
                            ? item.get("correct").toString()
                            : item.containsKey("correct_answer")
                                ? item.get("correct_answer").toString()
                                : null;
                        String userAnswer = submittedAnswers.get(itemId);

                        boolean isCorrect = false;
                        if (userAnswer != null && correctAnswer != null) {
                            isCorrect = userAnswer.trim().equalsIgnoreCase(correctAnswer.trim());
                        }

                        // explanation kept null when absent → @JsonInclude(NON_NULL) omits the key
                        // (matches the old map, which only put "explanation" when non-null).
                        Object explanation = item.get("explanation_vi");
                        reviewItems.add(new ExamReviewDto.Item(
                            itemId, question, userAnswer, correctAnswer, isCorrect,
                            explanation != null ? explanation.toString() : null));
                    }
                }

                reviewSections.add(new ExamReviewDto.Section(sectionName, reviewItems));
            }

            return ResponseEntity.ok(new ExamReviewDto(attemptId, totalScore, reviewSections));

        } catch (Exception e) {
            log.error("Error building review for attempt {}: {}", attemptId, e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        }
    }
}
