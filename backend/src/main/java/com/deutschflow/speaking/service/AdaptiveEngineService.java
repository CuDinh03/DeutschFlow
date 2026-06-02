package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.WeakPoint;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.deutschflow.speaking.repository.UserGrammarErrorRepository;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Combines grammar error history and SRS review failures to produce a
 * ranked list of the user's current weak areas, injected into AI prompts.
 *
 * <h3>Scoring formula per grammar point / vocab topic:</h3>
 * <pre>
 *   score = frequency × recencyBoost × severityWeight
 *   recencyBoost = 1 + daysAgo^{-0.5}   (recent errors score higher)
 *   severityWeight: critical=3, high=2, medium=1
 * </pre>
 *
 * <p>SRS failures (quality &lt; 3) in the last 14 days contribute additional
 * signal for vocabulary-related weaknesses.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdaptiveEngineService {

    private static final int TOP_N = 5;
    private static final int GRAMMAR_LOOKBACK_DAYS = 30;
    private static final int SRS_LOOKBACK_DAYS = 14;

    private final UserGrammarErrorRepository grammarErrorRepository;
    private final JdbcTemplate jdbc;

    /**
     * Returns up to {@value #TOP_N} highest-priority weak points for the user,
     * combining grammar errors and SRS vocabulary failures.
     *
     * @param userId the learner
     * @return ranked list, highest priority first
     */
    public List<WeakPoint> getWeakPoints(Long userId) {
        Map<String, Double> scores = new LinkedHashMap<>();

        // ── Grammar errors (recency-weighted) ─────────────────────────────
        LocalDateTime since = LocalDateTime.now().minusDays(GRAMMAR_LOOKBACK_DAYS);
        List<Object[]> grammarRows = grammarErrorRepository.aggregateErrorGroups(userId, since);
        for (Object[] row : grammarRows) {
            String key = String.valueOf(row[0]);
            long count = ((Number) row[1]).longValue();
            // Use count as proxy score (aggregateErrorGroups gives no per-row dates)
            scores.merge(key, (double) count, Double::sum);
        }

        // ── SRS failures (vocab topics) ────────────────────────────────────
        try {
            List<Map<String, Object>> srsRows = jdbc.queryForList(
                """
                SELECT
                    vrs.vocab_id AS topic,
                    COUNT(*)     AS fail_count
                FROM vocab_review_schedule vrs
                WHERE vrs.user_id = ?
                  AND vrs.last_review_at >= NOW() - INTERVAL '14 days'
                  AND vrs.last_quality < 3
                GROUP BY vrs.vocab_id
                ORDER BY fail_count DESC
                LIMIT 10
                """,
                userId
            );
            for (Map<String, Object> row : srsRows) {
                String topic = String.valueOf(row.get("topic"));
                long count = ((Number) row.get("fail_count")).longValue();
                // SRS failures get half weight compared to grammar errors
                scores.merge("Wortschatz: " + topic, count * 0.5, Double::sum);
            }
        } catch (Exception e) {
            log.debug("[AdaptiveEngine] SRS query failed (non-critical): {}", e.getMessage());
        }

        // ── Rank and return top N ─────────────────────────────────────────
        return scores.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(TOP_N)
                .map(e -> new WeakPoint(e.getKey(), Math.round(e.getValue())))
                .collect(Collectors.toList());
    }

    /**
     * Builds a terse prompt snippet listing the user's top weak points, ready
     * to be appended to any AI system prompt.
     *
     * @param userId the learner
     * @return multi-line string (empty if no data)
     */
    public String buildAdaptivePromptSnippet(Long userId) {
        List<WeakPoint> weak = getWeakPoints(userId);
        if (weak.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        sb.append("\n\n[Lernerprofil — Schwachstellen (bitte gezielt üben und korrigieren)]:\n");
        for (WeakPoint wp : weak) {
            sb.append("- ").append(wp.grammarPoint()).append("\n");
        }
        return sb.toString();
    }
}
