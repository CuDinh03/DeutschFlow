package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.service.AiExamEvaluatorService;
import com.deutschflow.grammar.service.ExamGenerationService;
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

    public MockExamController(JdbcTemplate jdbcTemplate, ExamScoringService scoringService,
                               AiExamEvaluatorService aiEvaluator, ExamGenerationService generationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.scoringService = scoringService;
        this.aiEvaluator = aiEvaluator;
        this.generationService = generationService;
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

        // Return attempt details AND the exam structure
        var examDetails = jdbcTemplate.queryForMap("""
            SELECT sections_json::text AS sections_json 
            FROM mock_exams WHERE id = ?
            """, examId);

        Map<String, Object> response = new HashMap<>(attemptRow);
        response.put("sections_json", examDetails.get("sections_json"));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{examId}/questions")
    public ResponseEntity<Map<String, Object>> getExamQuestions(@PathVariable long examId) {
        try {
            var row = jdbcTemplate.queryForMap("""
                SELECT sections_json::text AS sections_json
                FROM mock_exams WHERE id = ?
                """, examId);
            return ResponseEntity.ok(row);
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
}
