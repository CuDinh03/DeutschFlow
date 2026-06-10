package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.service.AiExamEvaluatorService;
import com.deutschflow.grammar.service.ExamGenerationService;
import com.deutschflow.grammar.service.ExamQuestionSanitizer;
import com.deutschflow.grammar.service.ExamScoringService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Mock Goethe Exam API
 * Provides endpoints for exam management, grading, and result retrieval
 */
@RestController
@RequestMapping("/api/mock-exams")
public class MockExamController {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MockExamController.class);
    private static final ObjectMapper om = new ObjectMapper();

    private final JdbcTemplate jdbcTemplate;
    private final ExamScoringService scoringService;
    private final AiExamEvaluatorService aiEvaluator;
    private final ExamGenerationService generationService;
    private final ExamQuestionSanitizer questionSanitizer;
    private final com.deutschflow.assessment.service.B1ReadinessService b1ReadinessService;
    private final com.deutschflow.progress.service.PhaseEngineService phaseEngineService;

    public MockExamController(JdbcTemplate jdbcTemplate, ExamScoringService scoringService,
                               AiExamEvaluatorService aiEvaluator, ExamGenerationService generationService,
                               ExamQuestionSanitizer questionSanitizer,
                               com.deutschflow.assessment.service.B1ReadinessService b1ReadinessService,
                               com.deutschflow.progress.service.PhaseEngineService phaseEngineService) {
        this.jdbcTemplate = jdbcTemplate;
        this.scoringService = scoringService;
        this.aiEvaluator = aiEvaluator;
        this.generationService = generationService;
        this.questionSanitizer = questionSanitizer;
        this.b1ReadinessService = b1ReadinessService;
        this.phaseEngineService = phaseEngineService;
    }

    private long userId(UserDetails p) {
        if (p instanceof com.deutschflow.user.entity.User user) {
            return user.getId();
        }
        try { return Long.parseLong(p.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listExams(
            @RequestParam(defaultValue = "A1") String cefrLevel) {
        var exams = jdbcTemplate.queryForList("""
            SELECT id, cefr_level, exam_format, title, description_vi,
                   total_points, pass_points, time_limit_minutes
            FROM mock_exams
            WHERE cefr_level = ? AND is_active = TRUE
            ORDER BY id
            """, cefrLevel);
        return ResponseEntity.ok(exams);
    }

    @PostMapping("/{examId}/start")
    public ResponseEntity<Map<String, Object>> startExam(
            @PathVariable long examId,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);

        // Check active attempt
        var existing = jdbcTemplate.queryForList("""
            SELECT id FROM mock_exam_attempts
            WHERE user_id = ? AND exam_id = ? AND status = 'IN_PROGRESS'
            """, uid, examId);
        
        Map<String, Object> attemptRow;
        if (!existing.isEmpty()) {
            attemptRow = existing.get(0);
        } else {
            attemptRow = jdbcTemplate.queryForMap("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status)
                VALUES (?, ?, 'IN_PROGRESS')
                RETURNING id, exam_id, started_at, status
                """, uid, examId);
        }

        // Return attempt details AND the exam structure (answers stripped — scoring happens server-side)
        var examDetails = jdbcTemplate.queryForMap("""
            SELECT sections_json::text AS sections_json, time_limit_minutes
            FROM mock_exams WHERE id = ?
            """, examId);

        Map<String, Object> response = new HashMap<>(attemptRow);
        // Strip the answer key before sending to the client: an in-progress exam must not
        // expose `correct`/explanations. Scoring (/finish) and review re-read them from the DB.
        response.put("sections_json",
                questionSanitizer.stripAnswerKey((String) examDetails.get("sections_json")));
        response.put("time_limit_minutes", examDetails.get("time_limit_minutes"));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{examId}/questions")
    public ResponseEntity<Map<String, Object>> getExamQuestions(@PathVariable long examId) {
        try {
            var row = jdbcTemplate.queryForMap("""
                SELECT sections_json::text AS sections_json
                FROM mock_exams WHERE id = ?
                """, examId);
            // Strip the answer key before serving — same reason as /start.
            Map<String, Object> safe = new HashMap<>();
            safe.put("sections_json",
                    questionSanitizer.stripAnswerKey((String) row.get("sections_json")));
            return ResponseEntity.ok(safe);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/attempts/{attemptId}/finish")
    public ResponseEntity<Map<String, Object>> finishExam(
            @PathVariable long attemptId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);

        try {
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
            if (body != null && body.containsKey("answers")) {
                answers = (Map<String, Object>) body.get("answers");
            }

            // Calculate scores for each section using real rubrics
            Map<String, Object> detailedScores = new HashMap<>();
            int lesenScore = 0;
            int hoerenScore = 0;
            Map<String, Object> schreibenScores = new HashMap<>();
            Map<String, Object> sprechenScores = new HashMap<>();

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
                            Map<String, Object> aiResult = aiEvaluator.evaluateSchreibenEmail(emailContent, taskPrompt);
                            // Merge AI evaluation into schreiben scores
                            schreibenScores = new HashMap<>(schreibenScores);
                            schreibenScores.put("teil2_email", aiResult);
                            // Update provisional total with AI score
                            int aiScore = ((Number) aiResult.get("total")).intValue();
                            int teil1 = schreibenScores.containsKey("teil1_form")
                                ? ((Number) schreibenScores.get("teil1_form")).intValue() : 0;
                            schreibenScores.put("total_provisional", teil1 + aiScore);
                        }
                        detailedScores.put("SCHREIBEN", schreibenScores);
                    }
                    case "SPRECHEN" -> {
                        sprechenScores = scoringService.scoreSperechenSection(answers, section);
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

            log.info("Exam {} finished for user {} with score {}", attemptId, uid, totalScore);

            // Refresh learner phase progress from real signals, and — for B1 exams — feed the
            // pass/fail into B1 graduation tracking. Without this wire, a passed B1 mock exam
            // never reached B1ReadinessService and graduation could never be confirmed.
            // Best-effort: never fail the exam-finish response on a progress-update error.
            try {
                if (principal instanceof com.deutschflow.user.entity.User user) {
                    phaseEngineService.recompute(user);
                    String cefr = jdbcTemplate.queryForObject(
                            "SELECT cefr_level FROM mock_exams WHERE id = ?", String.class, examId);
                    if ("B1".equalsIgnoreCase(cefr)) {
                        b1ReadinessService.recordMockExamResult(user, totalScore >= 60);
                    }
                }
            } catch (Exception ex) {
                log.warn("Post-exam phase/B1 readiness update failed for attempt {}: {}",
                        attemptId, ex.getMessage());
            }

            return ResponseEntity.ok(Map.of(
                "attemptId", attemptId,
                "totalScore", totalScore,
                "passed", totalScore >= 60,
                "detailedScores", detailedScores,
                "weakAreas", weakAreas
            ));

        } catch (Exception e) {
            log.error("Error finishing exam {}: {}", attemptId, e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Could not process exam results: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/attempts/me")
    public ResponseEntity<List<Map<String, Object>>> myAttempts(
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        var attempts = jdbcTemplate.queryForList("""
            SELECT a.id, a.exam_id, e.title AS exam_title, a.started_at, a.finished_at,
                   a.total_score, a.passed, a.status,
                   a.detailed_scores_json::text AS detailed_scores_json,
                   a.weak_areas::text AS weak_areas
            FROM mock_exam_attempts a
            JOIN mock_exams e ON e.id = a.exam_id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC
            """, uid);
        return ResponseEntity.ok(attempts);
    }

    @GetMapping("/attempts/{attemptId}/result")
    public ResponseEntity<Map<String, Object>> getResult(
            @PathVariable long attemptId,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        try {
            var row = jdbcTemplate.queryForMap("""
                SELECT a.id, a.exam_id, e.title, a.started_at, a.finished_at,
                       a.total_score, a.passed, a.status,
                       a.detailed_scores_json::text AS detailed_scores_json,
                       a.weak_areas::text AS weak_areas
                FROM mock_exam_attempts a
                JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.id = ? AND a.user_id = ?
                """, attemptId, uid);
            return ResponseEntity.ok(row);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/recommend")
    public ResponseEntity<Map<String, Object>> recommendExam(
            @RequestParam(defaultValue = "A1") String cefrLevel,
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        var examId = generationService.recommendExamId(uid, cefrLevel);
        var stats = generationService.getUserExamStats(uid, cefrLevel);

        return ResponseEntity.ok(Map.of(
            "recommendedExamId", examId.orElse(-1L),
            "cefrLevel", cefrLevel,
            "examStats", stats
        ));
    }

    @GetMapping("/coverage")
    public ResponseEntity<Map<String, Object>> examCoverage(
            @RequestParam(defaultValue = "A1") String cefrLevel) {
        return ResponseEntity.ok(generationService.getExamCoverage(cefrLevel));
    }

    @GetMapping("/attempts/{attemptId}/review")
    public ResponseEntity<Map<String, Object>> getAttemptReview(
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

            List<Map<String, Object>> reviewSections = new ArrayList<>();
            for (Map<String, Object> section : sections) {
                String sectionName = (String) section.get("name");
                List<Map<String, Object>> reviewItems = new ArrayList<>();

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

                        Map<String, Object> reviewItem = new LinkedHashMap<>();
                        reviewItem.put("id", itemId);
                        reviewItem.put("question", question);
                        reviewItem.put("user_answer", userAnswer);
                        reviewItem.put("correct_answer", correctAnswer);
                        reviewItem.put("is_correct", isCorrect);

                        Object explanation = item.get("explanation_vi");
                        if (explanation != null) {
                            reviewItem.put("explanation", explanation);
                        }

                        reviewItems.add(reviewItem);
                    }
                }

                Map<String, Object> reviewSection = new LinkedHashMap<>();
                reviewSection.put("sectionName", sectionName);
                reviewSection.put("items", reviewItems);
                reviewSections.add(reviewSection);
            }

            return ResponseEntity.ok(Map.of(
                "attemptId", attemptId,
                "totalScore", totalScore,
                "sections", reviewSections
            ));

        } catch (Exception e) {
            log.error("Error building review for attempt {}: {}", attemptId, e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Could not build review: " + e.getMessage()
            ));
        }
    }
}
