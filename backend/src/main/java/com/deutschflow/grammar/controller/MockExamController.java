package com.deutschflow.grammar.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Mock Goethe Exam API
 * GET  /api/mock-exams?cefrLevel=A1        — list exams
 * POST /api/mock-exams/{id}/start          — start attempt
 * POST /api/mock-exams/attempts/{id}/save  — save answers
 * POST /api/mock-exams/attempts/{id}/finish— finish & get score
 * GET  /api/mock-exams/attempts/me         — my attempts
 */
@Slf4j
@RestController
@RequestMapping("/api/mock-exams")
@RequiredArgsConstructor
public class MockExamController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    private long uid(UserDetails p) {
        try { return Long.parseLong(p.getUsername()); } catch (Exception e) { throw new RuntimeException("uid"); }
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listExams(
            @RequestParam(defaultValue = "A1") String cefrLevel) {
        return ResponseEntity.ok(jdbc.queryForList("""
            SELECT id, cefr_level, exam_format, title, description_vi,
                   total_points, pass_points, time_limit_minutes, is_active,
                   (SELECT COUNT(*) FROM mock_exam_attempts mea WHERE mea.exam_id = me.id) AS attempt_count
            FROM mock_exams me
            WHERE cefr_level = ? AND is_active = TRUE
            ORDER BY id
            """, cefrLevel));
    }

    @PostMapping("/{examId}/start")
    public ResponseEntity<Map<String, Object>> startExam(
            @PathVariable long examId,
            @AuthenticationPrincipal UserDetails principal) {
        long userId = uid(principal);

        // Check time limit
        var exam = jdbc.queryForMap("SELECT time_limit_minutes FROM mock_exams WHERE id = ?", examId);
        int minutes = ((Number) exam.get("time_limit_minutes")).intValue();

        var attempt = jdbc.queryForMap("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, started_at, deadline_at)
            VALUES (?, ?, NOW(), NOW() + (? || ' minutes')::interval)
            RETURNING id, started_at, deadline_at
            """, userId, examId, minutes);

        // Return exam data + attempt id
        var examData = jdbc.queryForMap("""
            SELECT id, title, description_vi, total_points, pass_points, time_limit_minutes,
                   sections_json::text AS sections_json
            FROM mock_exams WHERE id = ?
            """, examId);

        examData.put("attempt_id", attempt.get("id"));
        examData.put("started_at", attempt.get("started_at"));
        examData.put("deadline_at", attempt.get("deadline_at"));
        return ResponseEntity.ok(examData);
    }

    @PostMapping("/attempts/{attemptId}/save")
    public ResponseEntity<Void> saveAnswers(
            @PathVariable long attemptId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        jdbc.update("""
            UPDATE mock_exam_attempts SET answers_json = ?::jsonb
            WHERE id = ? AND user_id = ? AND status = 'IN_PROGRESS'
            """,
            toJson(body.getOrDefault("answers", Map.of())),
            attemptId, uid(principal));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/attempts/{attemptId}/finish")
    public ResponseEntity<Map<String, Object>> finishExam(
            @PathVariable long attemptId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {

        long userId = uid(principal);

        // Save final answers
        jdbc.update("UPDATE mock_exam_attempts SET answers_json = ?::jsonb WHERE id = ? AND user_id = ?",
            toJson(body.getOrDefault("answers", Map.of())), attemptId, userId);

        // Auto-grade LESEN and HOEREN sections
        var attempt = jdbc.queryForMap("""
            SELECT mea.answers_json::text AS answers_json, me.sections_json::text AS sections_json,
                   me.total_points, me.pass_points, me.id AS exam_id
            FROM mock_exam_attempts mea
            JOIN mock_exams me ON me.id = mea.exam_id
            WHERE mea.id = ? AND mea.user_id = ?
            """, attemptId, userId);

        Map<String, Object> scores = new LinkedHashMap<>();
        int totalScore = 0;

        try {
            Map<String, Object> answers = fromJson((String) attempt.get("answers_json"));
            List<Map<String, Object>> sections = fromJsonList((String) attempt.get("sections_json"));

            for (var section : sections) {
                String sectionName = (String) section.get("section");
                List<Map<String, Object>> teile = fromJsonList(toJson(section.get("teile")));
                int sectionScore = 0;

                if ("LESEN".equals(sectionName) || "HOEREN".equals(sectionName)) {
                    for (var teil : teile) {
                        List<Map<String, Object>> questions = fromJsonList(toJson(teil.get("questions")));
                        for (var q : questions) {
                            String qId = (String) q.get("id");
                            String correct = (String) q.get("correct");
                            Object given = answers.get(qId);
                            if (correct != null && correct.equalsIgnoreCase(String.valueOf(given))) {
                                sectionScore++;
                            }
                        }
                    }
                } else {
                    // SCHREIBEN/SPRECHEN — basic scoring (submitted = 5, not submitted = 0)
                    sectionScore = answers.containsKey(sectionName + "_submitted") ? 10 : 0;
                }

                scores.put(sectionName.toLowerCase(), sectionScore);
                totalScore += sectionScore;
            }
        } catch (Exception e) {
            log.error("Scoring error", e);
        }

        int passPoints = ((Number) attempt.get("pass_points")).intValue();
        boolean passed = totalScore >= passPoints;

        jdbc.update("""
            UPDATE mock_exam_attempts
            SET scores_json = ?::jsonb, total_score = ?, passed = ?, status = 'COMPLETED', finished_at = NOW()
            WHERE id = ? AND user_id = ?
            """, toJson(scores), totalScore, passed, attemptId, userId);

        return ResponseEntity.ok(Map.of(
            "attempt_id", attemptId,
            "scores", scores,
            "total_score", totalScore,
            "pass_points", passPoints,
            "passed", passed,
            "message_vi", passed
                ? "🎉 Chúc mừng! Bạn đã vượt qua bài thi!"
                : String.format("Bạn đạt %d/%d điểm. Hãy ôn tập thêm!", totalScore, ((Number) attempt.get("total_points")).intValue())
        ));
    }

    @GetMapping("/attempts/me")
    public ResponseEntity<List<Map<String, Object>>> myAttempts(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(jdbc.queryForList("""
            SELECT mea.id, mea.exam_id, me.title, me.cefr_level,
                   mea.started_at, mea.finished_at, mea.total_score, mea.passed,
                   mea.status, me.total_points, me.pass_points,
                   mea.scores_json::text AS scores_json
            FROM mock_exam_attempts mea
            JOIN mock_exams me ON me.id = mea.exam_id
            WHERE mea.user_id = ?
            ORDER BY mea.created_at DESC
            """, uid(principal)));
    }

    // helpers
    private String toJson(Object o) {
        try { return objectMapper.writeValueAsString(o); } catch (Exception e) { return "{}"; }
    }
    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJson(String s) {
        try { return objectMapper.readValue(s == null ? "{}" : s, new TypeReference<>() {}); }
        catch (Exception e) { return Map.of(); }
    }
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fromJsonList(String s) {
        try { return objectMapper.readValue(s == null ? "[]" : s, new TypeReference<>() {}); }
        catch (Exception e) { return List.of(); }
    }
}
