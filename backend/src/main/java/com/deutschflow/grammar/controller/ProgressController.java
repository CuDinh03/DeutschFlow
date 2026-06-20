package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.ProgressOverviewDto;
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
        if (p instanceof com.deutschflow.user.entity.User user) {
            return user.getId();
        }
        try { return Long.parseLong(p.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }

    @GetMapping("/me/overview")
    public ResponseEntity<ProgressOverviewDto> getOverview(@AuthenticationPrincipal UserDetails principal) {
        long userId = userId(principal);

        // CEFR level from user profile
        String cefrLevel = "A1";
        try {
            cefrLevel = jdbcTemplate.queryForObject(
                "SELECT COALESCE(learning_target_level, 'A1') FROM users WHERE id = ?",
                String.class, userId);
        } catch (Exception e) { log.warn("[Progress] cefrLevel query failed for user {}: {}", userId, e.getMessage()); }

        // Speaking skill score (Sprechen) — from weekly speaking or AI speaking
        double sprechenScore = 0;
        try {
            Double s = jdbcTemplate.queryForObject("""
                SELECT AVG(COALESCE(total_score, 0)) FROM weekly_speaking_submissions
                WHERE user_id = ? AND status = 'GRADED'
                """, Double.class, userId);
            sprechenScore = s != null ? s : 0;
        } catch (Exception e) { log.warn("[Progress] sprechenScore query failed for user {}: {}", userId, e.getMessage()); }

        // Grammar score (Schreiben proxy)
        double grammarMastery = 0;
        try {
            Double g = jdbcTemplate.queryForObject("""
                SELECT AVG(mastery_percent) FROM grammar_topic_progress WHERE user_id = ?
                """, Double.class, userId);
            grammarMastery = g != null ? g : 0;
        } catch (Exception e) { log.warn("[Progress] grammarMastery query failed for user {}: {}", userId, e.getMessage()); }

        // Vocab coverage
        double vocabCoverage = 0;
        try {
            Double v = jdbcTemplate.queryForObject("""
                SELECT (COUNT(CASE WHEN srs_interval > 0 THEN 1 END)::real / GREATEST(COUNT(*), 1)) * 100
                FROM user_vocabulary_srs WHERE user_id = ?
                """, Double.class, userId);
            vocabCoverage = v != null ? v : 0;
        } catch (Exception e) { log.warn("[Progress] vocabCoverage query failed for user {}: {}", userId, e.getMessage()); }

        // Mock exam best score
        int mockBest = 0;
        try {
            Integer m = jdbcTemplate.queryForObject("""
                SELECT COALESCE(MAX(total_score), 0) FROM mock_exam_attempts
                WHERE user_id = ? AND status = 'COMPLETED'
                """, Integer.class, userId);
            mockBest = m != null ? m : 0;
        } catch (Exception e) { log.warn("[Progress] mockBest query failed for user {}: {}", userId, e.getMessage()); }

        // Skill data
        int exDone = 0;
        try {
            Integer d = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(exercises_done),0) FROM grammar_topic_progress WHERE user_id = ?",
                Integer.class, userId);
            exDone = d != null ? d : 0;
        } catch (Exception e) { log.warn("[Progress] exercisesDone query failed for user {}: {}", userId, e.getMessage()); }

        var skills = new ProgressOverviewDto.Skills(
                new ProgressOverviewDto.SkillScore((int) Math.min(100, vocabCoverage), exDone),
                new ProgressOverviewDto.SkillScore((int) Math.min(100, vocabCoverage * 0.8), 0),
                new ProgressOverviewDto.SkillScore((int) grammarMastery, exDone),
                new ProgressOverviewDto.SkillScore((int) Math.min(100, sprechenScore), 0));

        // weeklyProgress stays an empty list (same as before) until the weekly trend ships.
        var overview = new ProgressOverviewDto(
                cefrLevel,
                skills,
                Math.round(grammarMastery * 10.0) / 10.0,
                Math.round(vocabCoverage * 10.0) / 10.0,
                mockBest,
                mockBest >= 60 && grammarMastery >= 70 && sprechenScore >= 60,
                List.of());

        return ResponseEntity.ok(overview);
    }
}
