package com.deutschflow.vocabulary.service;

import com.deutschflow.common.config.VocabularyEnrichmentProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Định kỳ dịch {@code words.base_form} (DE) sang EN và/hoặc VI qua DeepL khi thiếu nghĩa hợp lệ
 * trong {@code word_translations}. Bổ sung cho Wiktionary (EN) và Glosbe (VI): tốc độ làm đầy ~10k từ
 * phụ thuộc quota DeepL; không bật nếu không có API key.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DeepLLemmaBackfillService {

    private static final String SOURCE = "DEEPL_LEMMA_BACKFILL";

    private final JdbcTemplate jdbcTemplate;
    private final DeepLTranslationService deepLTranslationService;
    private final TranslationUsageMeter translationUsageMeter;
    private final VocabularyEnrichmentProperties enrichmentProperties;

    @Value("${app.vocabulary.deepl-lemma-backfill.batch-size:25}")
    private int batchSize;

    @Value("${app.vocabulary.deepl-lemma-backfill.max-chars-per-run:12000}")
    private long maxCharsPerRun;

    @Value("${app.vocabulary.deepl-lemma-backfill.delay-ms-between-words:250}")
    private long delayMsBetweenWords;

    public Map<String, Object> runBatch(Integer limitOverride, boolean resetCursor) {
        if (!deepLTranslationService.isConfigured()) {
            return Map.of("source", SOURCE, "status", "NO_API_KEY", "processedRows", 0);
        }
        if (resetCursor) {
            setState("last_processed_word_id", "0");
        }

        int limit = limitOverride != null && limitOverride > 0 ? Math.min(limitOverride, 500) : batchSize;
        Long lastId = parseLong(getState("last_processed_word_id"));
        if (lastId == null) {
            lastId = 0L;
        }

        List<Row> rows = jdbcTemplate.query(
                """
                WITH scored AS (
                  SELECT w.id,
                         w.base_form,
                         NOT EXISTS (
                           SELECT 1 FROM word_translations t
                           WHERE t.word_id = w.id AND t.locale = 'en'
                             AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> ''
                             AND LOWER(t.meaning) NOT LIKE 'not in wordlists/local_lexicon.tsv%'
                             AND LOWER(t.meaning) NOT LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                         ) AS need_en,
                         NOT EXISTS (
                           SELECT 1 FROM word_translations t
                           WHERE t.word_id = w.id AND t.locale = 'vi'
                             AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> ''
                             AND LOWER(t.meaning) NOT LIKE 'not in wordlists%'
                             AND LOWER(t.meaning) NOT LIKE 'chưa có trong%'
                         ) AS need_vi
                  FROM words w
                  WHERE w.id > ?
                )
                SELECT s.id, s.base_form, s.need_en, s.need_vi
                FROM scored s
                JOIN words w ON w.id = s.id
                WHERE s.need_en OR s.need_vi
                ORDER BY s.id ASC
                LIMIT ?
                """,
                (rs, rowNum) -> new Row(rs.getLong("id"), rs.getString("base_form"), rs.getBoolean("need_en"), rs.getBoolean("need_vi")),
                lastId, limit
        );
        return Map.of("source", SOURCE, "rows", rows.size());
    }

    private void setState(String key, String value) {
        // omitted in this snapshot
    }

    private String getState(String key) {
        return null;
    }

    private Long parseLong(String s) { return s == null ? null : Long.parseLong(s); }

    private record Row(long id, String baseForm, boolean needEn, boolean needVi) {}
}
