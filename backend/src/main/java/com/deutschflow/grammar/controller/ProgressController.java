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
 * Progress Dashboard API — Aggregates all skill scores for the student
 */
@Slf4j
@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
public class ProgressController {

    private final JdbcTemplate jdbcTemplate;

    private long userId(UserDetails p) {
        try { return Long.parseLong(p.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }

    @GetMapping("/me/overview")
    public ResponseEntity<Map<String, Object>> getOverview(@AuthenticationPrincipal UserDetails principal) {
        long userId = userId(principal);
        Map<String, Object> result = new LinkedHashMap<>();

        // CEFR level from user profile
        String cefrLevel = "A1";
        try {
            cefrLevel = jdbcTemplate.queryForObject(
                "SELECT COALESCE(learning_target_level, 'A1') FROM users WHERE id = ?",
                String.class, userId);
        } catch (Exception ignored) {}
        result.put("cefrLevel", cefrLevel);

        // Speaking skill score (Sprechen) — from weekly speaking or AI speaking
        double sprechenScore = 0;
        try {
            Double s = jdbcTemplate.queryForObject("""
                SELECT AVG(COALESCE(total_score, 0)) FROM weekly_speaking_submissions
                WHERE user_id = ? AND status = 'GRADED'
                """, Double.class, userId);
            sprechenScore = s != null ? s : 0;
        } catch (Exception ignored) {}

        // Grammar score (Schreiben proxy)
        double grammarMastery = 0;
        try {
            Double g = jdbcTemplate.queryForObject("""
                SELECT AVG(mastery_percent) FROM grammar_topic_progress WHERE user_id = ?
                """, Double.class, userId);
            grammarMastery = g != null ? g : 0;
        } catch (Exception ignored) {}

        // Vocab coverage
        double vocabCoverage = 0;
        try {
            Double v = jdbcTemplate.queryForObject("""
                SELECT (COUNT(CASE WHEN srs_interval > 0 THEN 1 END)::real / GREATEST(COUNT(*), 1)) * 100
                FROM user_vocabulary_srs WHERE user_id = ?
                """, Double.class, userId);
            vocabCoverage = v != null ? v : 0;
        } catch (Exception ignored) {}

        // Mock exam best score
        int mockBest = 0;
        try {
            Integer m = jdbcTemplate.queryForObject("""
                SELECT COALESCE(MAX(total_score), 0) FROM mock_exam_attempts
                WHERE user_id = ? AND status = 'COMPLETED'
                """, Integer.class, userId);
            mockBest = m != null ? m : 0;
        } catch (Exception ignored) {}

        // Skill data
        Map<String, Object> skills = new LinkedHashMap<>();
        int exDone = 0;
        try {
            Integer d = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(exercises_done),0) FROM grammar_topic_progress WHERE user_id = ?",
                Integer.class, userId);
            exDone = d != null ? d : 0;
        } catch (Exception ignored) {}

        skills.put("lesen", Map.of("score", (int) Math.min(100, vocabCoverage), "exercisesDone", exDone));
        skills.put("hoeren", Map.of("score", (int) Math.min(100, vocabCoverage * 0.8), "exercisesDone", 0));
        skills.put("schreiben", Map.of("score", (int) grammarMastery, "exercisesDone", exDone));
        skills.put("sprechen", Map.of("score", (int) Math.min(100, sprechenScore), "exercisesDone", 0));

        result.put("skills", skills);
        result.put("grammarMastery", Math.round(grammarMastery * 10.0) / 10.0);
        result.put("vocabCoverage", Math.round(vocabCoverage * 10.0) / 10.0);
        result.put("mockExamBestScore", mockBest);
        result.put("examReady", mockBest >= 60 && grammarMastery >= 70 && sprechenScore >= 60);
        result.put("weeklyProgress", List.of()); // Extend later

        return ResponseEntity.ok(result);
    }
}
