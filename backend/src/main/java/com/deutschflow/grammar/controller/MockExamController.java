package com.deutschflow.grammar.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Mock Goethe Exam API
 */
@Slf4j
@RestController
@RequestMapping("/api/mock-exams")
@RequiredArgsConstructor
public class MockExamController {

    private final JdbcTemplate jdbcTemplate;

    private long userId(UserDetails p) {
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

        // Simple scoring: calculate from submitted answers or default
        int totalScore = body != null && body.containsKey("totalScore")
            ? ((Number) body.get("totalScore")).intValue() : 0;

        jdbcTemplate.update("""
            UPDATE mock_exam_attempts
            SET status = 'COMPLETED', finished_at = NOW(), total_score = ?,
                passed = (? >= 60)
            WHERE id = ? AND user_id = ?
            """, totalScore, totalScore, attemptId, uid);

        return ResponseEntity.ok(Map.of(
            "attemptId", attemptId,
            "totalScore", totalScore,
            "passed", totalScore >= 60
        ));
    }

    @GetMapping("/attempts/me")
    public ResponseEntity<List<Map<String, Object>>> myAttempts(
            @AuthenticationPrincipal UserDetails principal) {
        long uid = userId(principal);
        var attempts = jdbcTemplate.queryForList("""
            SELECT a.id, a.exam_id, e.title AS exam_title, a.started_at, a.finished_at,
                   a.total_score, a.passed, a.status,
                   a.scores_json::text AS scores_json
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
                       a.scores_json::text AS scores_json
                FROM mock_exam_attempts a
                JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.id = ? AND a.user_id = ?
                """, attemptId, uid);
            return ResponseEntity.ok(row);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
