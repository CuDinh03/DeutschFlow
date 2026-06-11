package com.deutschflow.grammar.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.util.HashMap;
import java.util.Map;

/**
 * Shared count of active mock exams per (cefrLevel, examFormat). A mock-exam "pack" resolves its
 * exams by that pair, so both the student catalog ({@link MockExamPackService}) and admin curation
 * ({@link AdminMockExamPackService}) need these counts; computing them in ONE {@code GROUP BY}
 * avoids an N+1 over the catalog. Backed by the partial composite index {@code idx_me_cefr_format}.
 */
final class MockExamCounts {

    private MockExamCounts() {
    }

    /** Active-exam counts keyed by {@link #key(String, String)} for every (level, format) present. */
    static Map<String, Integer> byLevelFormat(JdbcTemplate jdbcTemplate) {
        ResultSetExtractor<Map<String, Integer>> extractor = rs -> {
            Map<String, Integer> counts = new HashMap<>();
            while (rs.next()) {
                counts.put(key(rs.getString("cefr_level"), rs.getString("exam_format")), rs.getInt("cnt"));
            }
            return counts;
        };
        Map<String, Integer> counts = jdbcTemplate.query(
                "SELECT cefr_level, exam_format, COUNT(*) AS cnt FROM mock_exams "
                        + "WHERE is_active = TRUE GROUP BY cefr_level, exam_format",
                extractor);
        return counts == null ? Map.of() : counts;
    }

    /** Composite map key for (cefrLevel, examFormat); ':' never appears in a CEFR level or format. */
    static String key(String cefrLevel, String examFormat) {
        return cefrLevel + ':' + examFormat;
    }
}
