package com.deutschflow.vocabulary.service;

import com.deutschflow.common.config.VocabularyEnrichmentProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Tự suspend toàn bộ scheduler enrich khi không còn từ thiếu EN hoặc VI (theo định nghĩa dưới)
 * và tổng lemma ≥ {@link VocabularyEnrichmentProperties#getEnrichmentAutoStopMinTotalWords()}
 * — mặc định 10k corpus đã được enrich xong theo SRS.
 *
 * <p>Latch một chiều: sau khi suspend cần restart app để chạy lại (tránh churn khi chỉnh sửa tay DB nhỏ).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EnrichmentSuspendGate {

    private final JdbcTemplate jdbcTemplate;
    private final VocabularyEnrichmentProperties properties;

    private final AtomicBoolean enrichmentSuspendedLatch = new AtomicBoolean(false);

    public boolean isEnrichmentSuspended() {
        return enrichmentSuspendedLatch.get();
    }

    @Scheduled(initialDelayString = "${app.vocabulary.enrichment-auto-stop-scan-ms:90000}",
            fixedDelayString = "${app.vocabulary.enrichment-auto-stop-scan-ms:90000}")
    public void evaluate() {
        if (!properties.isEnrichmentAutoStopEnabled()) {
            return;
        }
        if (enrichmentSuspendedLatch.get()) {
            return;
        }

        Integer totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Integer.class);
        if (totalWords == null || totalWords < properties.getEnrichmentAutoStopMinTotalWords()) {
            return;
        }

        Integer stillNeedDual = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                WHERE (
                    NOT EXISTS (
                    SELECT 1 FROM word_translations t
                    WHERE t.word_id = w.id AND t.locale = 'en'
                      AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> ''
                      AND LOWER(t.meaning) NOT LIKE 'not in wordlists/local_lexicon.tsv%'
                      AND LOWER(t.meaning) NOT LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                    )
                    OR NOT EXISTS (
                    SELECT 1 FROM word_translations t
                    WHERE t.word_id = w.id AND t.locale = 'vi'
                      AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> ''
                      AND LOWER(t.meaning) NOT LIKE 'not in wordlists%'
                      AND LOWER(t.meaning) NOT LIKE 'chưa có trong%'
                    )
                )
                """, Integer.class);

        if (stillNeedDual != null && stillNeedDual == 0 && enrichmentSuspendedLatch.compareAndSet(false, true)) {
            log.warn("EnrichmentSuspendGate: corpus totalWords={} ≥ minWords={}; no words missing EN or VI — enriching schedulers STOP until restart.",
                    totalWords,
                    properties.getEnrichmentAutoStopMinTotalWords());
        }
    }
}
