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
                ORDER BY
                  CASE COALESCE(NULLIF(TRIM(w.cefr_level), ''), 'ZZ')
                    WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3 WHEN 'B2' THEN 4
                    WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
                    ELSE 99 END,
                  s.id ASC
                LIMIT ?
                """,
                (rs, rn) -> new Row(
                        rs.getLong("id"),
                        rs.getString("base_form"),
                        rs.getBoolean("need_en"),
                        rs.getBoolean("need_vi")
                ),
                lastId,
                limit);

        Map<String, Object> out = new LinkedHashMap<>();
        long charsUsed = 0;
        int enUpserts = 0;
        int viUpserts = 0;
        int skippedBudget = 0;
        long maxSeen = lastId;

        for (Row row : rows) {
            String lemma = row.baseForm == null ? "" : row.baseForm.trim();
            if (lemma.isEmpty()) {
                maxSeen = Math.max(maxSeen, row.id);
                setState("last_processed_word_id", String.valueOf(maxSeen));
                continue;
            }

            long planned = (row.needEn ? lemma.length() : 0) + (row.needVi ? lemma.length() : 0);
            if (planned > 0 && charsUsed + planned > maxCharsPerRun) {
                skippedBudget++;
                break;
            }

            boolean wrote = false;
            var ym = TranslationUsageMeter.currentBillingMonthUtc();
            long monthlyCap = enrichmentProperties.getDeeplFreeMonthlyCharCap();

            if (row.needEn) {
                if (!translationUsageMeter.tryConsume(TranslationUsageMeter.PROVIDER_DEEPL_FREE, ym, lemma.length(),
                        monthlyCap)) {
                    out.put("deeplMonthlyCapReached", true);
                    out.put("billingMonthUtc", ym.toString());
                    out.put("source", SOURCE);
                    out.put("processedRows", rows.size());
                    out.put("enUpserts", enUpserts);
                    out.put("viUpserts", viUpserts);
                    out.put("charsUsedEstimate", charsUsed);
                    out.put("skippedBudget", skippedBudget);
                    out.put("lastProcessedWordId", Math.max(maxSeen, row.id));
                    out.put("status", "CAP");
                    setState("last_processed_word_id", String.valueOf(Math.max(maxSeen, row.id)));
                    return out;
                }

                Optional<String> en = deepLTranslationService.translate(lemma, "EN");
                charsUsed += lemma.length();
                if (en.isPresent() && !en.get().isBlank()) {
                    upsertTranslation(row.id, "en", en.get().trim());
                    enUpserts++;
                    wrote = true;
                }
            }

            if (row.needVi) {
                if (!translationUsageMeter.tryConsume(TranslationUsageMeter.PROVIDER_DEEPL_FREE, ym, lemma.length(),
                        monthlyCap)) {
                    out.put("deeplMonthlyCapReached", true);
                    out.put("billingMonthUtc", ym.toString());
                    out.put("source", SOURCE);
                    out.put("processedRows", rows.size());
                    out.put("enUpserts", enUpserts);
                    out.put("viUpserts", viUpserts);
                    out.put("charsUsedEstimate", charsUsed);
                    out.put("skippedBudget", skippedBudget);
                    out.put("lastProcessedWordId", Math.max(maxSeen, row.id));
                    out.put("status", "CAP");
                    setState("last_processed_word_id", String.valueOf(Math.max(maxSeen, row.id)));
                    return out;
                }
                Optional<String> vi = deepLTranslationService.translate(lemma, "VI");
                charsUsed += lemma.length();
                if (vi.isPresent() && !vi.get().isBlank()) {
                    upsertTranslation(row.id, "vi", vi.get().trim());
                    viUpserts++;
                    wrote = true;
                }
            }

            maxSeen = Math.max(maxSeen, row.id);
            setState("last_processed_word_id", String.valueOf(maxSeen));
            if (wrote) {
                sleepQuietly(delayMsBetweenWords);
            }
        }

        out.put("source", SOURCE);
        out.put("processedRows", rows.size());
        out.put("enUpserts", enUpserts);
        out.put("viUpserts", viUpserts);
        out.put("charsUsedEstimate", charsUsed);
        out.put("skippedBudget", skippedBudget);
        out.put("lastProcessedWordId", maxSeen);
        out.put("status", rows.isEmpty() ? "IDLE" : "OK");
        return out;
    }

    private void upsertTranslation(long wordId, String locale, String meaning) {
        jdbcTemplate.update(
                """
                INSERT INTO word_translations (word_id, locale, meaning, example)
                VALUES (?, ?, ?, NULL)
                ON CONFLICT (word_id, locale) DO UPDATE SET
                  meaning = CASE
                    WHEN word_translations.meaning IS NULL OR TRIM(word_translations.meaning) = ''
                      OR LOWER(word_translations.meaning) LIKE 'not in wordlists%'
                      OR LOWER(word_translations.meaning) LIKE 'chưa có trong%'
                    THEN EXCLUDED.meaning
                    ELSE word_translations.meaning
                  END
                """,
                wordId, locale, meaning);
    }

    private record Row(long id, String baseForm, boolean needEn, boolean needVi) {}

    private void sleepQuietly(long ms) {
        if (ms <= 0) {
            return;
        }
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private Long parseLong(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String getState(String key) {
        return jdbcTemplate.query(
                "SELECT state_value FROM vocabulary_import_state WHERE source_name = ? AND state_key = ? LIMIT 1",
                rs -> rs.next() ? rs.getString("state_value") : null, SOURCE, key);
    }

    private void setState(String key, String value) {
        jdbcTemplate.update(
                """
                INSERT INTO vocabulary_import_state (source_name, state_key, state_value)
                VALUES (?, ?, ?)
                ON CONFLICT (source_name, state_key)
                DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = CURRENT_TIMESTAMP
                """, SOURCE, key, value);
    }

    public void resetCursor() {
        setState("last_processed_word_id", "0");
    }
}
