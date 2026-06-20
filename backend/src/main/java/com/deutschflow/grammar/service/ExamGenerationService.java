package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamCoverageDto;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Selects exam variants for users using a least-recently-attempted strategy.
 * Ensures users cycle through all available exams before repeating one.
 */
@Service
public class ExamGenerationService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ExamGenerationService.class);

    private final JdbcOperations jdbc;

    public ExamGenerationService(JdbcOperations jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Returns the most suitable exam for a user — the one they have attempted
     * least recently (or never) among active exams for the given CEFR level.
     */
    public Optional<Long> recommendExamId(long userId, String cefrLevel) {
        // Get all active exams for this level, ordered by when the user last attempted them
        // (nulls first = never attempted = highest priority)
        var rows = jdbc.queryForList("""
            SELECT e.id,
                   MAX(a.started_at) AS last_attempt
            FROM mock_exams e
            LEFT JOIN mock_exam_attempts a
                   ON a.exam_id = e.id AND a.user_id = ?
            WHERE e.cefr_level = ? AND e.is_active = TRUE
            GROUP BY e.id
            ORDER BY last_attempt ASC NULLS FIRST, e.id ASC
            """, userId, cefrLevel);

        if (rows.isEmpty()) return Optional.empty();

        long examId = ((Number) rows.get(0).get("id")).longValue();
        log.debug("Recommended exam {} for user {} (level={})", examId, userId, cefrLevel);
        return Optional.of(examId);
    }

    /**
     * Returns summary stats for a user: how many exams they've completed per variant.
     */
    public List<Map<String, Object>> getUserExamStats(long userId, String cefrLevel) {
        return jdbc.queryForList("""
            SELECT e.id AS exam_id,
                   e.title,
                   COUNT(a.id)                                     AS total_attempts,
                   COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') AS completed_attempts,
                   MAX(a.total_score)                              AS best_score,
                   MAX(a.started_at)                               AS last_attempted_at
            FROM mock_exams e
            LEFT JOIN mock_exam_attempts a ON a.exam_id = e.id AND a.user_id = ?
            WHERE e.cefr_level = ? AND e.is_active = TRUE
            GROUP BY e.id, e.title
            ORDER BY e.id
            """, userId, cefrLevel);
    }

    /**
     * Returns a difficulty-balanced question selection for analytics.
     * topic_tag column is used when question_metadata is populated.
     */
    public ExamCoverageDto getExamCoverage(String cefrLevel) {
        var exams = jdbc.queryForList("""
            SELECT id, title, is_active,
                   (SELECT COUNT(*) FROM mock_exam_attempts WHERE exam_id = e.id) AS attempt_count
            FROM mock_exams e
            WHERE cefr_level = ?
            ORDER BY id
            """, cefrLevel);

        List<ExamCoverageDto.Exam> rows = exams.stream()
            .map(m -> new ExamCoverageDto.Exam(
                ((Number) m.get("id")).longValue(),
                (String) m.get("title"),
                (Boolean) m.get("is_active"),
                m.get("attempt_count") != null ? ((Number) m.get("attempt_count")).longValue() : null))
            .toList();

        return new ExamCoverageDto(cefrLevel, rows.size(), rows);
    }
}
